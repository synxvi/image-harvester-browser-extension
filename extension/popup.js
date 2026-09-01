// Image Harvester - Popup Script (settings UI, multi-path, gallery, ZIP, events)
// Copyright (c) Jaewoo Jeon (@thejjw) and Image Harvester Contributors
// SPDX-License-Identifier: zlib-acknowledgement
//
// Third-party libraries:
// - JSZip v3.10.1 (MIT) - Copyright (c) 2009-2016 Stuart Knightley, David Duponchel, Franz Buchinger, António Afonso
//
// MUST load after: jszip.min.js, naming.js, popup-config.js, popup-i18n.js.
// Globals (EXTENSION_VERSION, DEBUG, debug, diag, CONFIG, storage, showStatus,
// updateDelayDisplay, sanitizeFilename, i18n) come from
// popup-config.js / popup-i18n.js. This file holds the rest of the popup logic.

// Guard against double-init (jsdom fires both bootstrapPopup and DOMContentLoaded)
let _popupInitialized = false;

// Initialize popup
async function initializePopup() {
    if (_popupInitialized) {
        diag.log('[IH Popup] initializePopup already ran, skipping');
        return;
    }
    _popupInitialized = true;
    try {
        // Initialize i18n first so DOM gets translated before we touch it
        await i18n.init();

        // Load current settings
        const enabled = await storage.get('ih_enabled');
        const delay = await storage.get('ih_hover_delay');
        const detectImg = await storage.get('ih_detect_img');
        const detectSvg = await storage.get('ih_detect_svg');
        const detectBackground = await storage.get('ih_detect_background');
        const detectVideo = await storage.get('ih_detect_video');
        const allowedExtensions = await storage.get('ih_allowed_extensions');
        const convertWebpToPng = await storage.get('ih_convert_webp_to_png');
        const borderHighlightMode = await storage.get('ih_border_highlight_mode');
        const longHideDelaySetting = await storage.get('ih_long_hide_delay');
        const baseSubfolder = await storage.get('ih_base_subfolder');
        
        // Multi-path settings
        const multiPathEnabled = await storage.get('ih_multi_path_enabled');
        const multiPaths = await storage.get('ih_multi_paths');
        
        // Set toggle state
        const enabledToggle = document.getElementById('enabledToggle');
        enabledToggle.checked = enabled !== false; // Default to true
        
        // Set delay slider
        const hoverDelay = document.getElementById('hoverDelay');
        const delayValue = delay || CONFIG.DEFAULT_HOVER_DELAY;
        hoverDelay.value = delayValue;
        updateDelayDisplay(delayValue);

        // Set button size slider
        const storedButtonSize = await storage.get('ih_button_size');
        const buttonSizeVal = storedButtonSize || 26;
        document.getElementById('buttonSize').value = buttonSizeVal;
        document.getElementById('buttonSizeValue').textContent = buttonSizeVal + 'px';

        // Set toolbar spacing slider
        const storedToolbarSpacing = await storage.get('ih_toolbar_spacing');
        const toolbarSpacingVal = storedToolbarSpacing || 7;
        document.getElementById('toolbarSpacing').value = toolbarSpacingVal;
        document.getElementById('toolbarSpacingValue').textContent = toolbarSpacingVal + 'px';

        // Set glow delay slider
        const storedGlowDelay = await storage.get('ih_glow_delay');
        const glowDelayVal = storedGlowDelay != null ? storedGlowDelay : 500;
        document.getElementById('glowDelay').value = glowDelayVal;
        document.getElementById('glowDelayValue').textContent = (glowDelayVal / 1000).toFixed(1) + 's';

        // Set button position radio
        const storedPosition = await storage.get('ih_button_position') || 'top-right';
        const posRadio = document.querySelector(`input[name="buttonPosition"][value="${storedPosition}"]`);
        if (posRadio) posRadio.checked = true;

        // Set image detection checkboxes
        document.getElementById('detectImg').checked = detectImg !== false;
        document.getElementById('detectSvg').checked = detectSvg === true; // Disabled by default
        document.getElementById('detectBackground').checked = detectBackground === true; // Disabled by default
        document.getElementById('detectVideo').checked = detectVideo === true; // Disabled by default
        
        // Set border highlighting radio buttons
        const borderMode = borderHighlightMode || CONFIG.DEFAULT_BORDER_HIGHLIGHT;
        if (borderMode === 'custom') {
            document.getElementById('borderHighlightCustom').checked = true;
        } else if (borderMode === 'off') {
            document.getElementById('borderHighlightOff').checked = true;
        } else {
            // 兼容旧值 gray/green → 迁移到 custom
            const colorMap = { gray: '#888888', green: '#00ff00' };
            document.getElementById('borderHighlightCustom').checked = true;
            document.getElementById('borderHighlightColor').value = colorMap[borderMode] || '#e6a100';
            await storage.set('ih_border_highlight_mode', 'custom');
            await storage.set('ih_border_highlight_color', colorMap[borderMode] || '#e6a100');
        }
        // 加载已保存的自定义颜色
        const borderColor = await storage.get('ih_border_highlight_color');
        if (borderColor) {
            document.getElementById('borderHighlightColor').value = borderColor;
        }
        
        // Set experimental download mode
        const downloadMode = await storage.get('ih_download_mode') || 'normal';
        document.getElementById('downloadMode' + downloadMode.charAt(0).toUpperCase() + downloadMode.slice(1)).checked = true;
        
        // Set up download mode UI
        setupDownloadModeUI(downloadMode);
        
        // Lock/unlock multi-path based on current mode
        updateMultiPathAvailability(downloadMode);
        
        // Set allowed extensions
        const extensionsInput = document.getElementById('allowedExtensions');
        extensionsInput.placeholder = CONFIG.DEFAULT_EXTENSIONS_STRING;
        extensionsInput.value = allowedExtensions || CONFIG.DEFAULT_EXTENSIONS_STRING;
        
        // Set minimum image size
        const minImageSize = await storage.get('ih_min_image_size');
        const minImageSizeInput = document.getElementById('minImageSize');
        minImageSizeInput.value = minImageSize || CONFIG.MIN_IMAGE_SIZE;
        
        // Set WebP to PNG conversion option
        document.getElementById('convertWebpToPng').checked = convertWebpToPng === true; // Default: false
        
        // Set long hide delay option
        document.getElementById('longHideDelay').checked = longHideDelaySetting === true;

        // Set base subfolder (parent for all download paths)
        const baseSubfolderInput = document.getElementById('baseSubfolder');
        if (baseSubfolderInput) {
            baseSubfolderInput.value = baseSubfolder || '';
        }

        // 命名模板
        // 优先读 sync，失败/空时回退 local（双写策略保证可靠性）
        let filenameTemplate = await storage.get('ih_filename_template');
        if (!filenameTemplate) {
            // 回退读 local
            try {
                const localResult = await chrome.storage.local.get('ih_filename_template');
                filenameTemplate = localResult.ih_filename_template || '';
                if (filenameTemplate) {
                    diag.log('[IH Popup] template recovered from local storage');
                    // 回写到 sync 修复不一致
                    chrome.storage.sync.set({ ih_filename_template: filenameTemplate });
                }
            } catch (e) { /* ignore */ }
        }
        diag.log('[IH Popup] loaded ih_filename_template =', JSON.stringify(filenameTemplate));
        const tplInput = document.getElementById('filenameTemplate');
        diag.log('[IH Popup] #filenameTemplate element =', tplInput ? 'found' : 'MISSING');
        if (tplInput) {
            tplInput.value = filenameTemplate || '';
            diag.log('[IH Popup] set #filenameTemplate.value =', JSON.stringify(tplInput.value));
            updateTemplatePreview(tplInput.value);
        }

        // Set up multi-path UI
        const multiPathCheckbox = document.getElementById('multiPathEnabled');
        if (multiPathCheckbox) {
            multiPathCheckbox.checked = multiPathEnabled === true;
            document.getElementById('multiPathContainer').classList.toggle('hidden-container', !multiPathEnabled);
            renderPathList(multiPaths || []);
        }
        
        // Set up additional event listeners
        setupImageDetectionListeners();

        // Set up download history tab
        setupDownloadHistory();

        // Set up language selector listener
        setupLanguageSelectorListener();

        // Set up theme switcher (Appearance section in Advanced tab)
        setupThemeUI();

        // Set up current site domain display
        setupCurrentSite();
        
        // Set version display
        const versionElement = document.getElementById('version');
        if (versionElement) {
            versionElement.textContent = `v${EXTENSION_VERSION}`;
        }

    } catch (error) {
        diag.error('[IH Popup] initializePopup FAILED:', error.message, error.stack);
        showStatus(i18n.t('statusLoadFailed'), 'error');
    }
}

// 切换到指定标签页
function switchToTab(tabName) {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const tabTrack = document.querySelector('.tab-track');

    tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
    if (tabTrack) tabTrack.dataset.active = tabName;
    tabPanes.forEach(pane => pane.classList.remove('active'));
    const target = document.getElementById('tab-' + tabName);
    if (target) target.classList.add('active');
}

// 初始化标签页切换
function setupTabSwitching() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            switchToTab(btn.dataset.tab);
        });
    });
}

// ===== 下载记录（近期下载列表）=====
// 数据由 background 写入 storage.local（ih_download_history），
// 触发"开始下载"即记 pending，downloads.onChanged 终结为 success/failed。
const DL_HISTORY_KEY = 'ih_download_history';

// 相对时间：10 分钟内显示"刚刚/N 分钟前"，超过 10 分钟显示具体日期
// （跨年带年份的 MM-DD HH:mm）
function formatRelativeTime(ts) {
    const diff = Date.now() - ts;
    const min = Math.floor(diff / 60000);
    if (min < 1) return i18n.t('dlTimeJustNow');
    if (min <= 10) return i18n.tf('dlTimeMinutesAgo', { n: min });

    const d = new Date(ts);
    const now = new Date();
    const pad = (v) => String(v).padStart(2, '0');
    const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    if (d.getFullYear() !== now.getFullYear()) {
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hm}`;
    }
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hm}`;
}

// 对 pending 记录用 chrome.downloads.search 主动校正状态：
// 弥补 background SW 休眠期间丢失的 onChanged 终态事件（大图/慢下载常见）。
// 返回是否发生了状态修正。
async function reconcilePendingFromPopup(list) {
    let changed = false;
    for (const rec of list) {
        if (rec.status !== 'pending' || rec.downloadId == null) continue;
        try {
            const items = await chrome.downloads.search({ id: rec.downloadId });
            if (items.length === 1) {
                const state = items[0].state;
                if (state === 'complete') {
                    rec.status = 'success';
                    changed = true;
                } else if (state === 'interrupted') {
                    rec.status = 'failed';
                    rec.error = items[0].error || 'INTERRUPTED';
                    changed = true;
                }
            } else {
                rec.status = 'failed';
                rec.error = 'DOWNLOAD_ITEM_NOT_FOUND';
                changed = true;
            }
        } catch (e) {
            diag.error('popup 校正下载记录失败:', e);
        }
    }
    return changed;
}

async function renderDownloadHistory() {
    const listEl = document.getElementById('downloadHistoryList');
    if (!listEl) return;

    let list = [];
    try {
        const data = await chrome.storage.local.get(DL_HISTORY_KEY);
        list = Array.isArray(data[DL_HISTORY_KEY]) ? data[DL_HISTORY_KEY] : [];
    } catch (e) {
        diag.error('读取下载记录失败:', e);
    }

    // 即时校正：查询浏览器真实下载状态并写回
    if (await reconcilePendingFromPopup(list)) {
        try {
            await chrome.storage.local.set({ [DL_HISTORY_KEY]: list });
        } catch (e) {
            diag.error('保存 popup 校正结果失败:', e);
        }
    }

    listEl.innerHTML = '';

    if (list.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'dl-empty';
        empty.textContent = i18n.t('downloadHistoryEmpty');
        listEl.appendChild(empty);
        return;
    }

    list.forEach(rec => {
        const statusKey = rec.status === 'success' ? 'downloadStatusSuccess'
            : rec.status === 'failed' ? 'downloadStatusFailed'
            : 'downloadStatusPending';

        const item = document.createElement('div');
        item.className = 'dl-item dl-' + (rec.status || 'pending');
        if (rec.downloadId != null) item.dataset.downloadId = rec.downloadId;
        item.dataset.status = rec.status || 'pending';

        const dot = document.createElement('span');
        dot.className = 'dl-dot';
        dot.title = i18n.t(statusKey);

        // 来源徽章：区分悬浮按钮 / 右键菜单 / 批量 ZIP / 画廊（老记录无字段按悬浮按钮）
        const SOURCE_LABEL_KEYS = { hover: 'dlSourceHover', context: 'dlSourceContext', zip: 'dlSourceZip', gallery: 'dlSourceGallery' };
        const sourceKey = SOURCE_LABEL_KEYS[rec.source] || 'dlSourceOther';
        const sourceLabel = i18n.t(sourceKey);
        const badge = document.createElement('span');
        badge.className = 'dl-source dl-source-' + (rec.source || 'hover');
        badge.textContent = sourceLabel;

        const name = document.createElement('span');
        name.className = 'dl-name';
        name.textContent = rec.filename || 'media';

        const time = document.createElement('span');
        time.className = 'dl-time';
        time.textContent = formatRelativeTime(rec.ts || Date.now());

        item.appendChild(dot);
        item.appendChild(badge);
        item.appendChild(name);
        item.appendChild(time);

        // 悬停可见完整信息：来源 URL + 失败原因（含重试提示）/ 打开目录提示
        const errLine = rec.status === 'failed'
            ? `\n${i18n.t('downloadStatusFailed')}: ${rec.error || 'unknown'}\n${i18n.t('retryHint')}`
            : '';
        const openLine = rec.status === 'success'
            ? `\n${i18n.t('openFolderHint')}`
            : '';
        const sourceLine = `\n${i18n.t('dlSourceTitle')}: ${sourceLabel}`;
        const noteLine = rec.note ? `\n${rec.note}` : '';
        item.title = `${rec.filename || ''}\n${rec.url || ''}${errLine}${openLine}${sourceLine}${noteLine}`;

        // 点击成功记录：在系统文件管理器中打开所在目录并高亮文件。
        // 记录自「大图下载收口 background」起均绑定 downloadId；
        // 文件可能已被用户移动/删除，先经 search 确认存在再调 show。
        item.addEventListener('click', async () => {
            if (rec.status === 'success') {
                try {
                    if (rec.downloadId == null) {
                        showStatus(i18n.t('openFolderMissing'), 'error');
                        return;
                    }
                    const items = await chrome.downloads.search({ id: rec.downloadId });
                    if (!items.length || !items[0].exists) {
                        showStatus(i18n.t('openFolderMissing'), 'error');
                        return;
                    }
                    await chrome.downloads.show(rec.downloadId);
                } catch (e) {
                    diag.error('打开所在目录失败:', e);
                    showStatus(i18n.t('openFolderMissing'), 'error');
                }
                return;
            }
            if (rec.status !== 'failed') return;
            if (!rec.url || rec.url.startsWith('data:') || rec.url.startsWith('blob:')) {
                showStatus(i18n.t('retryNotAvailable'), 'error');
                return;
            }
            try {
                await chrome.runtime.sendMessage({
                    type: 'retry_download',
                    url: rec.url,
                    filename: rec.filename || 'media',
                    mode: rec.mode || 'normal',
                    pathIndex: (rec.pathIndex != null ? rec.pathIndex : -1),
                    source: rec.source || 'hover'
                });
                showStatus(i18n.tf('statusRetryQueued', { name: rec.filename || '' }), 'success');
            } catch (e) {
                diag.error('发送重试请求失败:', e);
                showStatus(i18n.t('statusSaveFailed'), 'error');
            }
        });

        listEl.appendChild(item);
    });

    enrichDownloadRecords(list);
    updateRetryAllVisibility(list);
}

// 为已渲染的记录补充实时信息：成功条目附文件大小、pending 条目显示进度百分比。
// 一次 downloads.search 批量查询，避免逐条请求。
let enrichTimer = null;
function scheduleEnrich() {
    if (enrichTimer) return;
    enrichTimer = setTimeout(() => { enrichTimer = null; enrichDownloadRecords(); }, 400);
}

async function enrichDownloadRecords() {
    try {
        const items = await chrome.downloads.search({});
        const byId = new Map(items.map(it => [it.id, it]));
        document.querySelectorAll('.dl-item[data-download-id]').forEach(itemEl => {
            const it = byId.get(parseInt(itemEl.dataset.downloadId, 10));
            const timeEl = itemEl.querySelector('.dl-time');
            if (!it || !timeEl) return;
            if (itemEl.dataset.status === 'pending') {
                const total = it.totalBytes > 0 ? it.totalBytes : 0;
                if (total && it.bytesReceived >= 0) {
                    timeEl.textContent = Math.min(100, Math.floor(it.bytesReceived / total * 100)) + '%';
                }
            } else if (itemEl.dataset.status === 'success' && it.fileSize > 0) {
                timeEl.textContent = `${formatFileSize(it.fileSize)} · ${timeEl.textContent.split(' · ').pop()}`;
            }
        });
    } catch (e) {
        debug.warn('补充下载记录信息失败:', e);
    }
}

function formatFileSize(bytes) {
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return bytes + ' B';
}

// 「重试全部失败」仅在存在可重试的失败记录时显示
function updateRetryAllVisibility(list) {
    const btn = document.getElementById('retryAllBtn');
    if (!btn) return;
    const retryable = (list || []).some(r => r.status === 'failed' && r.url &&
        !r.url.startsWith('data:') && !r.url.startsWith('blob:'));
    btn.hidden = !retryable;
}

function setupDownloadHistory() {
    renderDownloadHistory();

    // popup 打开期间后台持续更新记录（状态 pending→success/failed），实时刷新
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes[DL_HISTORY_KEY]) {
            renderDownloadHistory();
        }
    });

    // pending 条目的进度百分比不触发 storage 变化，轮询补充（仅 popup 打开期间）
    window.setInterval(scheduleEnrich, 2000);

    const clearBtn = document.getElementById('clearHistoryBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', async () => {
            try {
                await chrome.storage.local.set({ [DL_HISTORY_KEY]: [] });
            } catch (e) {
                diag.error('清空下载记录失败:', e);
            }
        });
    }

    const retryAllBtn = document.getElementById('retryAllBtn');
    if (retryAllBtn) {
        retryAllBtn.addEventListener('click', async () => {
            try {
                const data = await chrome.storage.local.get(DL_HISTORY_KEY);
                const list = data[DL_HISTORY_KEY] || [];
                let queued = 0;
                for (const rec of list) {
                    if (rec.status !== 'failed') continue;
                    if (!rec.url || rec.url.startsWith('data:') || rec.url.startsWith('blob:')) continue;
                    try {
                        await chrome.runtime.sendMessage({
                            type: 'retry_download',
                            url: rec.url,
                            filename: rec.filename || 'media',
                            mode: rec.mode || 'normal',
                            pathIndex: (rec.pathIndex != null ? rec.pathIndex : -1),
                            source: rec.source || 'hover'
                        });
                        queued++;
                    } catch (e) { /* 单条失败不中断 */ }
                }
                showStatus(i18n.tf('galleryQueued', { n: queued }), queued ? 'success' : 'error');
            } catch (e) {
                diag.error('重试全部失败:', e);
            }
        });
    }
}

// Set up download mode UI
function setupDownloadModeUI(currentMode) {
    // 打开 popup 时若处于实验模式，自动切到高级 tab 让用户看到当前模式选项
    if (currentMode !== 'normal') {
        switchToTab('advanced');
    }
}

// ====== 分段滑块（语言/主题共用的三段选择控件） ======
// 初始定位不带动画（避免打开时滑块从首段滑走），切换时 0.25s 滑动
function setupSegmentSlider(segmentEl, initialValue, onChange) {
    if (!segmentEl) return;
    const thumb = segmentEl.querySelector('.seg-slider-thumb');
    const radios = [...segmentEl.querySelectorAll('input[type="radio"]')];

    const moveThumb = (animate) => {
        const checked = segmentEl.querySelector('input:checked');
        if (!checked || !thumb) return;
        const idx = radios.indexOf(checked);
        if (idx < 0) return;
        if (!animate) thumb.style.transition = 'none';
        thumb.style.transform = `translateX(${idx * 100}%)`;
        if (!animate) requestAnimationFrame(() => { thumb.style.transition = ''; });
    };

    if (initialValue != null) {
        const r = radios.find(x => x.value === initialValue);
        if (r) r.checked = true;
    }
    moveThumb(false);

    radios.forEach(r => r.addEventListener('change', function () {
        if (!this.checked) return;
        moveThumb(true);
        if (onChange) onChange(this.value);
    }));
}

// Set up language segment slider
function setupLanguageSelectorListener() {
    const segment = document.getElementById('langSegment');
    if (!segment) {
        diag.error('setupLanguageSelectorListener: #langSegment NOT FOUND!');
        return;
    }
    setupSegmentSlider(segment, i18n.currentLocale || 'auto', async (value) => {
        diag.log('language segment changed, new value:', value);
        await i18n.setLocale(value);
        // 语言切换后动态渲染的内容（下载记录/路径列表/模板预览）不会随 data-i18n
        // 自动更新，需手动重渲染
        renderDownloadHistory();
        renderPathList(await storage.get('ih_multi_paths') || []);
        updateTemplatePreview();
    });
}

// ====== 主题切换（ih_theme: auto | light | dark） ======
function applyTheme(theme) {
    document.documentElement.dataset.theme = (theme === 'light' || theme === 'dark') ? theme : '';
}

async function setupThemeUI() {
    const saved = await storage.get('ih_theme');
    const theme = (saved === 'light' || saved === 'dark') ? saved : 'auto';
    applyTheme(theme);
    setupSegmentSlider(document.getElementById('themeSegment'), theme, async (value) => {
        applyTheme(value);
        await storage.set('ih_theme', value);
    });
}

// 检测当前页面是否支持 content script 通信，不支持则禁用批量下载按钮
async function checkPageAndDisableBulkButtons() {
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    const downloadZipBtn = document.getElementById('downloadZipBtn');
    if (!downloadAllBtn || !downloadZipBtn) return;

    const disable = (tipKey) => {
        const tip = i18n.t(tipKey);
        downloadAllBtn.disabled = true;
        downloadAllBtn.title = tip;
        downloadZipBtn.disabled = true;
        downloadZipBtn.title = tip;
    };

    try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const url = activeTab?.url || '';
        const supported = url.startsWith('http://') || url.startsWith('https://');

        if (!supported) {
            disable('statusUnsupportedPage');
            return;
        }

        // 页面可通信但扩展被关闭/当前域名被排除时，批量操作同样不可用
        const enabled = await storage.get('ih_enabled');
        if (enabled === false) {
            disable('statusDisabled');
            return;
        }
        const exclusions = await storage.get('ih_domain_exclusions') || [];
        if (Array.isArray(exclusions) && exclusions.length && url) {
            let host = '';
            try { host = new URL(url).hostname; } catch { /* ignore */ }
            const excluded = exclusions.some(d => host === d || host.endsWith('.' + d));
            if (excluded) disable('statusDomainExcluded');
        }
    } catch (e) {
        debug.warn('Failed to check page type for bulk buttons:', e.message);
    }
}

// Set up event listeners
function setupEventListeners() {
    const enabledToggle = document.getElementById('enabledToggle');
    const hoverDelay = document.getElementById('hoverDelay');
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    const downloadZipBtn = document.getElementById('downloadZipBtn');
    const exclusionBtn = document.getElementById('exclusionBtn');

    // 在不支持的页面禁用批量下载按钮
    checkPageAndDisableBulkButtons();

    // Toggle enabled/disabled
    enabledToggle.addEventListener('change', async (e) => {
        const checked = e.target.checked;
        const success = await storage.set('ih_enabled', checked);
        if (success) {
            showStatus(checked ? i18n.t('statusEnabled') : i18n.t('statusDisabled'));
            await notifyContentScriptSettingsChanged();
        } else {
            showStatus(i18n.t('statusSaveFailed'), 'error');
            e.target.checked = !checked; // Revert
        }
    });
    
    // Update hover delay
    hoverDelay.addEventListener('input', (e) => {
        updateDelayDisplay(e.target.value);
    });

    hoverDelay.addEventListener('change', async (e) => {
        const value = parseInt(e.target.value);
        const success = await storage.set('ih_hover_delay', value);
        if (success) {
            showStatus(i18n.tf('statusDelaySet', { value: (value / 1000).toFixed(1) }));
            await notifyContentScriptSettingsChanged();
        } else {
            showStatus(i18n.t('statusDelaySaveFailed'), 'error');
        }
    });

    // 按钮大小滑块
    const buttonSizeSlider = document.getElementById('buttonSize');
    buttonSizeSlider.addEventListener('input', (e) => {
        document.getElementById('buttonSizeValue').textContent = e.target.value + 'px';
    });
    buttonSizeSlider.addEventListener('change', async (e) => {
        const value = parseInt(e.target.value);
        const success = await storage.set('ih_button_size', value);
        if (success) {
            showStatus(i18n.tf('statusButtonSizeSet', { value }));
            await notifyContentScriptSettingsChanged();
        } else {
            showStatus(i18n.t('statusSaveFailed'), 'error');
        }
    });

    // 多路径工具栏间距
    const toolbarSpacingSlider = document.getElementById('toolbarSpacing');
    toolbarSpacingSlider.addEventListener('input', (e) => {
        document.getElementById('toolbarSpacingValue').textContent = e.target.value + 'px';
    });
    toolbarSpacingSlider.addEventListener('change', async (e) => {
        const value = parseInt(e.target.value);
        const success = await storage.set('ih_toolbar_spacing', value);
        if (success) {
            showStatus(i18n.tf('statusToolbarSpacingSet', { value }));
            await notifyContentScriptSettingsChanged();
        } else {
            showStatus(i18n.t('statusSaveFailed'), 'error');
        }
    });

    // 光晕延迟滑块
    const glowDelaySlider = document.getElementById('glowDelay');
    if (glowDelaySlider) {
        glowDelaySlider.addEventListener('input', (e) => {
            document.getElementById('glowDelayValue').textContent = (parseInt(e.target.value) / 1000).toFixed(1) + 's';
        });
        glowDelaySlider.addEventListener('change', async (e) => {
            const value = parseInt(e.target.value);
            const success = await storage.set('ih_glow_delay', value);
            if (success) {
                showStatus(i18n.tf('statusGlowDelaySet', { value: (value / 1000).toFixed(1) }));
                await notifyContentScriptSettingsChanged();
            } else {
                showStatus(i18n.t('statusSaveFailed'), 'error');
            }
        });
    }

    // 按钮位置 radio
    document.querySelectorAll('input[name="buttonPosition"]').forEach(radio => {
        radio.addEventListener('change', async (e) => {
            if (e.target.checked) {
                const success = await storage.set('ih_button_position', e.target.value);
                if (success) {
                    await notifyContentScriptSettingsChanged();
                }
            }
        });
    });

    // Bulk download buttons
    downloadAllBtn.addEventListener('click', handleGalleryView);
    downloadZipBtn.addEventListener('click', handleDownloadZip);
    
    // Exclusion button
    exclusionBtn.addEventListener('click', () => {
        chrome.tabs.create({
            url: chrome.runtime.getURL('exclusions.html')
        });
    });

    // URL 转换策略按钮
    const strategyBtn = document.getElementById('strategyBtn');
    strategyBtn.addEventListener('click', () => {
        chrome.tabs.create({
            url: chrome.runtime.getURL('strategies.html')
        });
    });
}

// Set up image detection event listeners
function setupImageDetectionListeners() {
    diag.log('[IH Popup] setupImageDetectionListeners() ENTER');
    const detectImg = document.getElementById('detectImg');
    const detectSvg = document.getElementById('detectSvg');
    const detectBackground = document.getElementById('detectBackground');
    const detectVideo = document.getElementById('detectVideo');
    const allowedExtensions = document.getElementById('allowedExtensions');
    const downloadModeRadios = document.querySelectorAll('input[name="downloadMode"]');
    const borderHighlightRadios = document.querySelectorAll('input[name="borderHighlight"]');
    
    // Image type detection checkboxes
    detectImg.addEventListener('change', async (e) => {
        const success = await storage.set('ih_detect_img', e.target.checked);
        if (success) {
            showStatus(e.target.checked ? i18n.t('statusImgDetOn') : i18n.t('statusImgDetOff'));
            await notifyContentScriptSettingsChanged();
        } else {
            showStatus(i18n.t('statusSaveFailed'), 'error');
            e.target.checked = !e.target.checked;
        }
    });
    
    detectSvg.addEventListener('change', async (e) => {
        const success = await storage.set('ih_detect_svg', e.target.checked);
        if (success) {
            showStatus(e.target.checked ? i18n.t('statusSvgDetOn') : i18n.t('statusSvgDetOff'));
            await notifyContentScriptSettingsChanged();
        } else {
            showStatus(i18n.t('statusSaveFailed'), 'error');
            e.target.checked = !e.target.checked;
        }
    });
    
    detectBackground.addEventListener('change', async (e) => {
        const success = await storage.set('ih_detect_background', e.target.checked);
        if (success) {
            showStatus(e.target.checked ? i18n.t('statusBgImgDetOn') : i18n.t('statusBgImgDetOff'));
            await notifyContentScriptSettingsChanged();
        } else {
            showStatus(i18n.t('statusSaveFailed'), 'error');
            e.target.checked = !e.target.checked;
        }
    });
    
    detectVideo.addEventListener('change', async (e) => {
        const success = await storage.set('ih_detect_video', e.target.checked);
        if (success) {
            showStatus(e.target.checked ? i18n.t('statusVideoDetOn') : i18n.t('statusVideoDetOff'));
            await notifyContentScriptSettingsChanged();
        } else {
            showStatus(i18n.t('statusSaveFailed'), 'error');
            e.target.checked = !e.target.checked;
        }
    });
    
    // Allowed extensions input
    allowedExtensions.addEventListener('change', async (e) => {
        const value = e.target.value.trim();
        const success = await storage.set('ih_allowed_extensions', value);
        if (success) {
            showStatus(i18n.t('statusExtUpdated'));
        } else {
            showStatus(i18n.t('statusExtSaveFailed'), 'error');
        }
    });
    
    // Download mode radio buttons
    downloadModeRadios.forEach(radio => {
        radio.addEventListener('change', async (e) => {
            if (e.target.checked) {
                const success = await storage.set('ih_download_mode', e.target.value);
                if (success) {
                    const msgKey = e.target.value === 'normal' ? 'statusModeNormal' : 'statusModeCanvas';
                    showStatus(i18n.t(msgKey));

                    // Lock/unlock multi-path based on mode
                    updateMultiPathAvailability(e.target.value, true);
                } else {
                    showStatus(i18n.t('statusSaveFailed'), 'error');
                    // Revert to previous selection
                    const currentMode = await storage.get('ih_download_mode') || 'normal';
                    document.getElementById('downloadMode' + currentMode.charAt(0).toUpperCase() + currentMode.slice(1)).checked = true;
                }
            }
        });
    });
    
    // Border highlighting radio buttons
    borderHighlightRadios.forEach(radio => {
        radio.addEventListener('change', async (e) => {
            if (e.target.checked) {
                const mode = e.target.value;
                if (mode === 'custom') {
                    const color = document.getElementById('borderHighlightColor').value;
                    await storage.set('ih_border_highlight_mode', 'custom');
                    await storage.set('ih_border_highlight_color', color);
                    showStatus(i18n.tf('statusBorderCustom', { color }));
                } else {
                    await storage.set('ih_border_highlight_mode', 'off');
                    showStatus(i18n.t('statusBorderOff'));
                }
                await notifyContentScriptSettingsChanged();
            }
        });
    });

            // 兼容旧值 gray/green → 迁移到 custom
    // 用 input 事件保证拖动选色板时即时生效，但加 trailing 节流：拖动期间不写 storage，
    // 停顿 250ms 后只写一次。否则 input 每帧触发会让 chrome.storage.sync 写入风暴，
    // 撞上 MAX_WRITE_OPERATIONS 配额，导致后续（如关子保存目录）的 set 抛错报"保存设置失败"。
    // 不能改用纯 change：<input type="color"> 在 popup 关闭卸载时可能不派发 change，
    // 会导致"改完颜色关面板"颜色不生效。
    let colorWriteTimer = null;
    let pendingColorValue = null;
    const flushColorWrite = async () => {
        if (colorWriteTimer) {
            clearTimeout(colorWriteTimer);
            colorWriteTimer = null;
        }
        if (pendingColorValue == null) return;
        const v = pendingColorValue;
        pendingColorValue = null;
        await storage.set('ih_border_highlight_mode', 'custom');
        await storage.set('ih_border_highlight_color', v);
        notifyContentScriptSettingsChanged().catch(() => {});
    };
    document.getElementById('borderHighlightColor').addEventListener('input', (e) => {
        document.getElementById('borderHighlightCustom').checked = true;
        pendingColorValue = e.target.value;
        if (colorWriteTimer) clearTimeout(colorWriteTimer);
        colorWriteTimer = setTimeout(flushColorWrite, 250);
    });
    // 兜底：popup 关闭（pagehide）时若有未写的颜色，立即同步写掉，避免丢写。
    window.addEventListener('pagehide', flushColorWrite);
    
    // Minimum image size input
    const minImageSize = document.getElementById('minImageSize');
    minImageSize.addEventListener('change', async (e) => {
        const value = parseInt(e.target.value);
        if (e.target.validity.valid && value >= 50 && value <= 1000) {
            const success = await storage.set('ih_min_image_size', value);
            if (success) {
                showStatus(i18n.tf('statusMinSizeSet', { value }));
                await notifyContentScriptSettingsChanged();
            } else {
                showStatus(i18n.t('statusMinSizeFailed'), 'error');
            }
        } else {
            showStatus(i18n.t('statusMinSizeInvalid'), 'error');
            e.target.value = CONFIG.MIN_IMAGE_SIZE;
        }
    });
    
    // WebP to PNG conversion checkbox
    const convertWebpToPng = document.getElementById('convertWebpToPng');
    convertWebpToPng.addEventListener('change', async (e) => {
        const success = await storage.set('ih_convert_webp_to_png', e.target.checked);
        if (success) {
            showStatus(e.target.checked ? i18n.t('statusWebpPngOn') : i18n.t('statusWebpPngOff'));
            await notifyContentScriptSettingsChanged();
        } else {
            showStatus(i18n.t('statusWebpPngFailed'), 'error');
            e.target.checked = !e.target.checked;
        }
    });

    // Long hide delay checkbox
    const longHideDelay = document.getElementById('longHideDelay');
    longHideDelay.addEventListener('change', async (e) => {
        const success = await storage.set('ih_long_hide_delay', e.target.checked);
        if (success) {
            showStatus(e.target.checked ? i18n.t('statusLongHideOn') : i18n.t('statusLongHideOff'));
            await notifyContentScriptSettingsChanged();
        } else {
            showStatus(i18n.t('statusDelaySettingFailed'), 'error');
            e.target.checked = !e.target.checked;
        }
    });

    // Base subfolder input (parent directory for all download paths)
    const baseSubfolderInputEl = document.getElementById('baseSubfolder');
    if (baseSubfolderInputEl) {
        baseSubfolderInputEl.addEventListener('change', async (e) => {
            let rawValue = e.target.value.trim();
            let sanitized = rawValue.replace(/[<>:"\\|?*]/g, '').replace(/^[/\\]+|[/\\]+$/g, '');
            e.target.value = sanitized;
            const success = await storage.set('ih_base_subfolder', sanitized);
            if (success) {
                if (sanitized) {
                    showStatus(`Base dir: Downloads/${sanitized}/`);
                } else {
                    showStatus('Base dir cleared, saving to Downloads/');
                }
                await notifyContentScriptSettingsChanged();
            } else {
                showStatus('Failed to save base directory setting', 'error');
            }
        });
    }
    
    // Filename template input + placeholder chips
    const filenameTemplateInput = document.getElementById('filenameTemplate');
    diag.log('[IH Popup] setupImageDetectionListeners: filenameTemplateInput =', filenameTemplateInput ? 'found' : 'MISSING');

    // 增强的保存函数：双写 sync + local 保证可靠（sync 可能因未登录/配额静默丢失）
    const persistTemplate = async (value) => {
        updateTemplatePreview(value); // 所有落库路径（chip/分隔符/blur）统一刷新预览
        const trimmed = (value || '').trim();
        diag.log('[IH Popup] persistTemplate:', JSON.stringify(trimmed));
        try {
            await Promise.all([
                chrome.storage.sync.set({ ih_filename_template: trimmed, ih_active_separator: activeSeparator || '' }),
                chrome.storage.local.set({ ih_filename_template: trimmed, ih_active_separator: activeSeparator || '' }),
            ]);
            diag.log('[IH Popup] persistTemplate OK');
            if (trimmed) {
                showStatus(i18n.tf('statusTemplateSet', { value: trimmed }));
            } else {
                showStatus(i18n.t('statusTemplateCleared'));
            }
            await notifyContentScriptSettingsChanged();
            return true;
        } catch (e) {
            diag.log('[IH Popup] persistTemplate FAILED:', e.message);
            showStatus(i18n.t('statusSaveFailed'), 'error');
            return false;
        }
    };

    // 防抖保存：输入停止 300ms 后持久化
    let templateSaveTimer = null;
    const scheduleTemplateSave = (value) => {
        if (templateSaveTimer) clearTimeout(templateSaveTimer);
        templateSaveTimer = setTimeout(() => {
            templateSaveTimer = null;
            persistTemplate(value);
        }, 300);
    };

    // ====== 占位符 chip（{site} 等）：每个只允许添加一次 ======
    const placeholderChips = document.querySelectorAll('.placeholder-chip:not(.separator-chip)');
    diag.log('[IH Popup] found', placeholderChips.length, 'placeholder chips');

    // ====== 分隔符 chip（单选激活模式）======
    const separatorChips = document.querySelectorAll('.separator-chip');
    const SEPARATOR_VALUES = ['_', '-', '.', ' '];
    let activeSeparator = null;

    const refreshSeparatorStates = () => {
        separatorChips.forEach(chip => {
            if (chip.getAttribute('data-sep') === activeSeparator) chip.classList.add('chip-active');
            else chip.classList.remove('chip-active');
        });
    };

    // 把模板中所有连续的已知分隔符段统一替换为指定分隔符（逐字符扫描，无正则转义问题）
    const replaceAllSeparators = (text, newSep) => {
        const sepSet = new Set(SEPARATOR_VALUES);
        let out = '';
        let i = 0;
        while (i < text.length) {
            if (sepSet.has(text[i])) {
                out += newSep;
                while (i < text.length && sepSet.has(text[i])) i++;
            } else {
                out += text[i];
                i++;
            }
        }
        return out;
    };

    const refreshChipStates = (currentValue) => {
        placeholderChips.forEach(chip => {
            const ph = chip.getAttribute('data-ph') || '';
            if (ph.startsWith('{') && ph.endsWith('}') && currentValue.includes(ph)) {
                chip.classList.add('chip-used');
                chip.disabled = true;
            } else {
                chip.classList.remove('chip-used');
                chip.disabled = false;
            }
        });
    };

    // 占位符 chip 点击：插入占位符；若已激活分隔符且不在开头，自动补分隔符
    placeholderChips.forEach(chip => {
        chip.addEventListener('click', () => {
            if (chip.disabled) return;
            const ph = chip.getAttribute('data-ph');
            const input = document.getElementById('filenameTemplate');
            if (!input || !ph) return;
            const start = input.selectionStart ?? input.value.length;
            const end = input.selectionEnd ?? input.value.length;
            let insert = ph;
            if (activeSeparator && start > 0) {
                insert = activeSeparator + ph;
            }
            input.value = input.value.slice(0, start) + insert + input.value.slice(end);
            input.selectionStart = input.selectionEnd = start + insert.length;
            input.focus();
            refreshChipStates(input.value);
            diag.log('[IH Popup] chip click, new value =', JSON.stringify(input.value));
            if (templateSaveTimer) { clearTimeout(templateSaveTimer); templateSaveTimer = null; }
            persistTemplate(input.value);
        });
    });

    // 分隔符 chip 点击：单选激活，切换时整体替换模板中的分隔符
    separatorChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const sep = chip.getAttribute('data-sep');
            if (sep === null) return;
            const oldSep = activeSeparator;
            activeSeparator = sep;
            refreshSeparatorStates();

            const input = document.getElementById('filenameTemplate');
            if (input) {
                if (input.value) {
                    const replaced = replaceAllSeparators(input.value, activeSeparator);
                    if (replaced !== input.value) input.value = replaced;
                }
                if (templateSaveTimer) { clearTimeout(templateSaveTimer); templateSaveTimer = null; }
                persistTemplate(input.value);
            }
            diag.log('[IH Popup] separator activated:', JSON.stringify(activeSeparator), '(was:', JSON.stringify(oldSep) + ')');
        });
    });

    // 输入框事件
    if (filenameTemplateInput) {
        filenameTemplateInput.addEventListener('input', (e) => {
            refreshChipStates(e.target.value);
            updateTemplatePreview(e.target.value);
            scheduleTemplateSave(e.target.value);
        });
        filenameTemplateInput.addEventListener('blur', (e) => {
            if (templateSaveTimer) { clearTimeout(templateSaveTimer); templateSaveTimer = null; }
            persistTemplate(e.target.value);
        });
        // Backspace/Delete 时整体删除大括号标签
        filenameTemplateInput.addEventListener('keydown', (e) => {
            if (e.key !== 'Backspace' && e.key !== 'Delete') return;
            const input = e.target;
            const pos = input.selectionStart;
            if (pos === null || input.selectionStart !== input.selectionEnd) return;
            const val = input.value;
            const tagRegex = /\{[\w]+\}/g;
            let match;
            while ((match = tagRegex.exec(val)) !== null) {
                const tag = match[0];
                const tagStart = match.index;
                const tagEnd = tagStart + tag.length;
                if (e.key === 'Backspace' && tagStart < pos && tagEnd >= pos) {
                    e.preventDefault();
                    input.value = val.slice(0, tagStart) + val.slice(tagEnd);
                    input.selectionStart = input.selectionEnd = tagStart;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    return;
                }
                if (e.key === 'Delete' && tagStart <= pos && tagEnd > pos) {
                    e.preventDefault();
                    input.value = val.slice(0, tagStart) + val.slice(tagEnd);
                    input.selectionStart = input.selectionEnd = tagStart;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    return;
                }
            }
        });
        // 初始化 chip 置灰状态 + 恢复激活的分隔符
        refreshChipStates(filenameTemplateInput.value);
        // 优先从存储读取用户选中的分隔符，其次从模板文本推断
        storage.get('ih_active_separator').then(savedSep => {
            if (savedSep && SEPARATOR_VALUES.includes(savedSep)) {
                activeSeparator = savedSep;
            } else {
                const v = filenameTemplateInput.value;
                if (v) {
                    for (const sv of SEPARATOR_VALUES) {
                        if (v.includes(sv)) { activeSeparator = sv; break; }
                    }
                }
            }
            refreshSeparatorStates();
        });
    } else {
        diag.log('[IH Popup] WARNING: #filenameTemplate not found, no listeners attached');
    }

    // pagehide 兜底：popup 关闭时立即写 sync + local
    window.addEventListener('pagehide', () => {
        const input = document.getElementById('filenameTemplate');
        const val = input ? input.value.trim() : '';
        diag.log('[IH Popup] pagehide, saving:', JSON.stringify(val));
        try {
            const sep = activeSeparator || '';
            chrome.storage.sync.set({ ih_filename_template: val, ih_active_separator: sep });
            chrome.storage.local.set({ ih_filename_template: val, ih_active_separator: sep });
        } catch (e) { /* 忽略，popup 已关闭 */ }
    });

    // Reset button
    const resetBtn = document.getElementById('resetBtn');
    resetBtn.addEventListener('click', async () => {
        if (confirm(i18n.t('confirmReset'))) {
            await resetAllSettings();
        }
    });
    
    // Multi-path settings
    setupMultiPathListeners();
}

// ===== Multi-Path Save Functions =====
const MAX_MULTI_PATHS = 10;

// Render the path list from stored data
function renderPathList(paths) {
    const container = document.getElementById('pathList');
    if (!container) return;
    container.innerHTML = '';
    
    (paths || []).forEach((path, index) => {
        const item = document.createElement('div');
        item.className = 'path-item';
        item.dataset.index = index;
        
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'path-name';
        nameInput.placeholder = i18n.t('pathNamePlaceholder');
        nameInput.value = path.name || '';
        nameInput.dataset.index = index;
        nameInput.dataset.field = 'name';
        
        const folderInput = document.createElement('input');
        folderInput.type = 'text';
        folderInput.className = 'path-folder';
        folderInput.placeholder = i18n.t('pathFolderPlaceholder');
        folderInput.value = path.path || '';
        folderInput.dataset.index = index;
        folderInput.dataset.field = 'folder';
        
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'remove-path-btn';
        removeBtn.title = i18n.t('deletePathTooltip');
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', () => removePath(index));

        // Reorder buttons
        const reorderGroup = document.createElement('div');
        reorderGroup.className = 'path-reorder';

        const moveUpBtn = document.createElement('button');
        moveUpBtn.type = 'button';
        moveUpBtn.className = 'reorder-btn reorder-up';
        moveUpBtn.title = i18n.t('moveUpTooltip');
        moveUpBtn.disabled = index === 0;
        moveUpBtn.textContent = '↑';
        moveUpBtn.addEventListener('click', () => movePath(index, -1));

        const moveDownBtn = document.createElement('button');
        moveDownBtn.type = 'button';
        moveDownBtn.className = 'reorder-btn reorder-down';
        moveDownBtn.title = i18n.t('moveDownTooltip');
        moveDownBtn.disabled = index === paths.length - 1;
        moveDownBtn.textContent = '↓';
        moveDownBtn.addEventListener('click', () => movePath(index, 1));

        reorderGroup.appendChild(moveUpBtn);
        reorderGroup.appendChild(moveDownBtn);

        // Auto-save on blur (change)
        nameInput.addEventListener('change', () => updatePath(index));
        folderInput.addEventListener('change', () => updatePath(index));

        item.appendChild(nameInput);
        item.appendChild(folderInput);
        item.appendChild(reorderGroup);
        item.appendChild(removeBtn);
        container.appendChild(item);
    });
    
    updateAddPathButtonVisibility(paths);
}

// Add a new empty path entry
function addPath() {
    storage.get('ih_multi_paths').then((paths) => {
        if (!Array.isArray(paths)) paths = [];
        if (paths.length >= MAX_MULTI_PATHS) {
            showStatus(i18n.t('maxPathsWarning'), 'error');
            return;
        }
        paths.push({ name: '', path: '', enabled: true });
        storage.set('ih_multi_paths', paths).then(() => {
            renderPathList(paths);
        });
    });
}

// Remove a path at given index
function removePath(index) {
    storage.get('ih_multi_paths').then((paths) => {
        if (!Array.isArray(paths)) return;
        paths.splice(index, 1);
        storage.set('ih_multi_paths', paths).then(() => {
            renderPathList(paths);
            showStatus(i18n.t('statusPathRemoved'));
            // 删除到空时自动禁用多路径
            if (paths.length === 0) {
                const checkbox = document.getElementById('multiPathEnabled');
                if (checkbox && checkbox.checked) {
                    checkbox.checked = false;
                    const container = document.getElementById('multiPathContainer');
                    if (container) container.classList.add('hidden-container');
                    storage.set('ih_multi_path_enabled', false);
                    notifyContentScriptSettingsChanged().catch(() => {});
                }
            }
        });
    });
}

// Move a path up or down by one position
function movePath(index, direction) { // direction: -1 = up, +1 = down
    storage.get('ih_multi_paths').then((paths) => {
        if (!Array.isArray(paths)) return;
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= paths.length) return;

        // Swap elements in array
        [paths[index], paths[newIndex]] = [paths[newIndex], paths[index]];
        storage.set('ih_multi_paths', paths).then(() => {
            renderPathList(paths);
        });
    });
}

// Update a path's fields from input values
function updatePath(index) {
    storage.get('ih_multi_paths').then((paths) => {
        if (!Array.isArray(paths) || !paths[index]) return;
        
        const container = document.getElementById('pathList');
        if (!container) return;
        
        const items = container.querySelectorAll('.path-item');
        const targetItem = items[index];
        if (!targetItem) return;
        
        const nameInput = targetItem.querySelector('.path-name');
        const folderInput = targetItem.querySelector('.path-folder');
        
        const newName = (nameInput ? nameInput.value.trim() : '');
        const newFolder = (folderInput ? folderInput.value.trim() : '');
        
        // Validate: both fields required
        if (!newName || !newFolder) {
            // 任一项为空都视为无效：半填的路径在页面上会渲染出无名/无目录的按钮
            showStatus(i18n.t('statusPathEmpty'), 'error');
            // Restore original values
            if (nameInput) nameInput.value = paths[index].name || '';
            if (folderInput) folderInput.value = paths[index].path || '';
            return;
        }
        
        // Sanitize folder name
        const sanitizedFolder = newFolder.replace(/[<>:"\\|?*]/g, '').replace(/^[/\\]+|[/\\]+$/g, '');
        
        paths[index].name = newName;
        paths[index].path = sanitizedFolder;
        
        // Update input with sanitized value
        if (folderInput) folderInput.value = sanitizedFolder;
        
        storage.set('ih_multi_paths', paths).then(() => {
            showStatus(i18n.tf('statusPathAdded', { name: newName || '(unnamed)', folder: sanitizedFolder }));
            
            // Notify content script of settings change
            notifyContentScriptSettingsChanged().catch(() => {});
        });
    });
}

// Show/hide Add Path button based on current count
function updateAddPathButtonVisibility(paths) {
    const btn = document.getElementById('addPathBtn');
    if (!btn) return;
    if ((paths || []).length >= MAX_MULTI_PATHS) {
        btn.style.display = 'none';
        showStatus(i18n.t('maxPathsWarning'), 'info');
    } else {
        btn.style.display = '';
    }
}

// Enable or disable multi-path settings based on download mode
// Multi-path only works in Normal mode
// isModeSwitch: true when called from mode radio change, false on popup init
function updateMultiPathAvailability(downloadMode, isModeSwitch = false) {
    const multiPathCheckbox = document.getElementById('multiPathEnabled');
    const multiPathContainer = document.getElementById('multiPathContainer');
    const multiPathSection = document.querySelector('.multi-path-section');

    if (!multiPathCheckbox) return;

    // 子保存目录不再受下载模式限制：canvas 提取已统一走 background 的
    // download_canvas_image，与 normal 模式共用 buildDownloadPath() 路径逻辑，
    // 基础目录/子目录对两种模式同样生效。这里只管 UI 显隐，不再禁用。
    multiPathCheckbox.disabled = false;
    if (multiPathSection) {
        multiPathSection.style.opacity = '1';
        multiPathSection.style.pointerEvents = 'auto';
    }
    if (multiPathContainer) {
        multiPathContainer.classList.toggle('hidden-container', !multiPathCheckbox.checked);
    }
}

// Set up all multi-path event listeners
function setupMultiPathListeners() {
    // Toggle multi-path container visibility
    const multiPathCheckbox = document.getElementById('multiPathEnabled');
    const multiPathContainer = document.getElementById('multiPathContainer');
    if (multiPathCheckbox && multiPathContainer) {
        multiPathCheckbox.addEventListener('change', async (e) => {
            const enabled = e.target.checked;
            multiPathContainer.classList.toggle('hidden-container', !enabled);
            if (enabled) {
                const paths = await storage.get('ih_multi_paths');
                if (!Array.isArray(paths) || paths.length === 0) {
                    const defaultPath = { name: '', path: '', enabled: true };
                    await storage.set('ih_multi_paths', [defaultPath]);
                    renderPathList([defaultPath]);
                }
            }
            const success = await storage.set('ih_multi_path_enabled', enabled);
            if (success) {
                showStatus(enabled ? i18n.t('statusMultiPathOn') : i18n.t('statusMultiPathOff'));
                await notifyContentScriptSettingsChanged();
            } else {
                showStatus(i18n.t('statusSaveFailed'), 'error');
                e.target.checked = !enabled;
                multiPathContainer.classList.toggle('hidden-container', enabled);
            }
        });
    }
    
    // Add new path button
    const addPathBtn = document.getElementById('addPathBtn');
    if (addPathBtn) {
        addPathBtn.addEventListener('click', addPath);
    }
}

// Get current settings for image detection
async function getCurrentSettings() {
    try {
        const detectImg = await storage.get('ih_detect_img');
        const detectSvg = await storage.get('ih_detect_svg');
        const detectBackground = await storage.get('ih_detect_background');
        const detectVideo = await storage.get('ih_detect_video');
        const allowedExtensions = await storage.get('ih_allowed_extensions');
        const convertWebpToPng = await storage.get('ih_convert_webp_to_png');
        const minImageSize = await storage.get('ih_min_image_size');
        const borderHighlightMode = await storage.get('ih_border_highlight_mode');
        const longHideDelay = await storage.get('ih_long_hide_delay');
        const hoverDelaySetting = await storage.get('ih_hover_delay');
        const glowDelaySetting = await storage.get('ih_glow_delay');

        return {
            detectImg: detectImg !== false, // Default: true
            detectSvg: detectSvg === true, // Default: false
            detectBackground: detectBackground === true, // Default: false
            detectVideo: detectVideo === true, // Default: false
            convertWebpToPng: convertWebpToPng === true, // Default: false
            longHideDelay: longHideDelay === true, // Default: false
            hoverDelay: hoverDelaySetting || CONFIG.DEFAULT_HOVER_DELAY,
            glowDelay: glowDelaySetting != null ? glowDelaySetting : 500,
            borderHighlightMode: borderHighlightMode || CONFIG.DEFAULT_BORDER_HIGHLIGHT, // Default: 'off'
            minImageSize: minImageSize || CONFIG.MIN_IMAGE_SIZE,
            allowedExtensions: (allowedExtensions || CONFIG.DEFAULT_EXTENSIONS_STRING)
                .split(',')
                .map(ext => ext.trim())
                .filter(ext => ext.length > 0)
        };
    } catch (error) {
        debug.error('Error getting settings:', error);
        // Return defaults if storage fails
        return {
            detectImg: true,
            detectSvg: false, // Changed default
            detectBackground: false, // Changed default
            detectVideo: false,
            convertWebpToPng: false, // Default: false
            minImageSize: CONFIG.MIN_IMAGE_SIZE,
            allowedExtensions: CONFIG.DEFAULT_EXTENSIONS
        };
    }
}

// 命名模板实时预览：用固定示例上下文渲染当前输入，让用户看到将产出的文件名
function updateTemplatePreview(templateValue) {
    const el = document.getElementById('templatePreview');
    if (!el || !window.IHNaming) return;
    const tpl = String(templateValue != null ? templateValue
        : (document.getElementById('filenameTemplate')?.value || '')).trim();
    if (!tpl) {
        el.textContent = i18n.t('templatePreviewEmpty');
        el.classList.add('empty');
        return;
    }
    el.classList.remove('empty');
    const ctx = window.IHNaming.buildContext({
        pageUrl: 'https://www.example.com/gallery/night-city',
        pageTitle: 'Night City Gallery',
        mediaUrl: 'https://cdn.example.com/img/2026/sunset.jpg',
        defaultExtension: 'jpg',
        strategy: 'demo'
    });
    el.textContent = window.IHNaming.renderTemplate(tpl, ctx) || i18n.t('templatePreviewEmpty');
}

// Handle gallery view
async function handleGalleryView() {
    try {
        debug.log('Gallery view started');
        showStatus(i18n.t('statusScanning'), 'info');
        
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        debug.log('Active tab:', activeTab);

// 检测当前页面是否支持 content script 通信，不支持则禁用批量下载按钮
        const url = activeTab.url || '';
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            debug.warn('Unsupported page for gallery view:', url);
            showStatus(i18n.t('statusUnsupportedPage'), 'info');
            return;
        }

        const settings = await getCurrentSettings();
        debug.log('Current settings:', settings);

        debug.log('Sending message to content script...');
        let response;
        try {
            response = await chrome.tabs.sendMessage(activeTab.id, {
                type: 'scan_images',
                settings: settings
            });
        } catch (e) {
            debug.error('Content script not available:', e.message);
            showStatus(i18n.t('statusContentScriptError'), 'error');
            return;
        }
        
        debug.log('Response from content script:', response);
        
        if (!response.success) {
            debug.error('Scan failed:', response.error);
            showStatus(i18n.tf('statusScanFailed', { error: response.error }), 'error');
            return;
        }
        
        const images = response.images;
        debug.log('Found images:', images.length, images);
        
        if (images.length === 0) {
            showStatus(i18n.t('statusNoImages'), 'info');
            return;
        }
        
        // 扫描结果经 storage.session 交给扩展画廊页 gallery.html。
        // 旧方案用 data: URL 内联整页：受 Chrome 顶层 data: 导航限制、页面
        // 关闭即丢、且无法使用扩展 API（下载入记录等）。画廊页读后即删数据。
        try {
            await chrome.storage.session.set({
                ih_gallery_data: {
                    images: images,
                    pageTitle: activeTab.title || '',
                    pageUrl: activeTab.url || '',
                    ts: Date.now()
                }
            });
        } catch (e) {
            debug.error('写入画廊扫描数据失败:', e);
            showStatus(i18n.t('statusGalleryFailed'), 'error');
            return;
        }

        chrome.tabs.create({
            url: chrome.runtime.getURL('gallery.html')
        });

        showStatus(i18n.tf('statusGalleryOpened', { count: images.length }));
        debug.log('Gallery view completed successfully');
        
    } catch (error) {
        debug.error('Gallery view error:', error);
        showStatus(i18n.t('statusGalleryFailed'), 'error');
    }
}

// Handle ZIP download
// ZIP 批量下载的进行中/取消状态：批量期间 🗜️ 按钮复用为「取消」开关
let zipInProgress = false;
let zipCancelRequested = false;

async function handleDownloadZip() {
    // 进行中再次点击 = 请求取消后续拉取
    if (zipInProgress) {
        zipCancelRequested = true;
        showStatus(i18n.t('zipCancelling'), 'info');
        return;
    }

    debug.log('[IH Popup] ZIP download started');

    // First check if JSZip is available
    if (typeof JSZip === 'undefined') {
        debug.error('[IH Popup] JSZip not available during download');
        showStatus(i18n.t('statusJszipNotAvailable'), 'error');
        return;
    }
    
    try {
        showStatus(i18n.t('statusScanning'), 'info');
        
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        debug.log('[IH Popup] Active tab:', activeTab.url);

// 检测当前页面是否支持 content script 通信，不支持则禁用批量下载按钮
        if (!activeTab.url || (!activeTab.url.startsWith('http://') && !activeTab.url.startsWith('https://'))) {
            debug.warn('[IH Popup] Unsupported page for ZIP download:', activeTab.url);
            showStatus(i18n.t('statusUnsupportedPage'), 'info');
            return;
        }

        const settings = await getCurrentSettings();
        debug.log('[IH Popup] Current settings:', settings);
        
        debug.log('[IH Popup] Sending message to content script...');
        
        let response;
        try {
            response = await chrome.tabs.sendMessage(activeTab.id, {
                type: 'scan_images',
                settings: settings
            });
        } catch (messageError) {
            debug.error('[IH Popup] Failed to send message to content script:', messageError);
            showStatus(i18n.t('statusContentScriptError'), 'error');
            return;
        }
        
        debug.log('[IH Popup] Response from content script:', response);
        
        if (!response) {
            debug.error('[IH Popup] No response from content script');
            showStatus(i18n.t('statusContentScriptNoResponse'), 'error');
            return;
        }
        
        if (!response.success) {
            debug.error('Scan failed:', response.error);
            showStatus(i18n.tf('statusScanFailed', { error: response.error }), 'error');
            return;
        }
        
        const images = response.images;
        debug.log('Found images:', images.length, images);
        
        if (images.length === 0) {
            showStatus(i18n.t('statusNoImages'), 'info');
            return;
        }

        // 数量确认：批量拉取耗时且占带宽，先让用户知道规模再开始
        if (!window.confirm(i18n.tf('zipConfirm', { count: images.length }))) {
            return;
        }

        // 批量期间按钮转为「取消」模式，结束后恢复
        const zipBtn = document.getElementById('downloadZipBtn');
        const zipBtnOriginalHtml = zipBtn ? zipBtn.innerHTML : '';
        const setZipCancelMode = (on) => {
            if (!zipBtn) return;
            zipBtn.innerHTML = on ? `🛑 ${i18n.t('zipCancel')}` : zipBtnOriginalHtml;
            zipBtn.classList.toggle('cancel-mode', on);
        };

        zipInProgress = true;
        zipCancelRequested = false;
        setZipCancelMode(true);
        try {
            await collectAndZipImages(images, activeTab);
        } finally {
            zipInProgress = false;
            zipCancelRequested = false;
            setZipCancelMode(false);
        }

    } catch (error) {
        debug.error('ZIP download error:', error);
        showStatus(i18n.t('statusZipCreateFailed'), 'error');
    }
}

// 拉取已扫描图片并打包落盘（由 handleDownloadZip 调用，期间 zipCancelRequested 生效）
async function collectAndZipImages(images, activeTab) {
    showStatus(i18n.tf('statusDownloading', { count: images.length }), 'info');

    // Create ZIP file
    debug.log('Creating ZIP file with JSZip...');
    const zip = new JSZip();
    const imageFolder = zip.folder('images');

    let downloadedCount = 0;
    const totalCount = images.length;

    // Download each image and add to ZIP
    let skippedCount = 0;
    for (let i = 0; i < images.length; i++) {
        if (zipCancelRequested) break;
        const image = images[i];
        debug.log(`Processing image ${i + 1}/${totalCount}:`, image.url);

        try {
            debug.log('Fetching image data...');
            const imageData = await fetchImageAsBlob(image.url);
            debug.log('Image data received, size:', imageData.size);

            const filename = generateImageFilename(image, i);
            debug.log('Generated filename:', filename);

            imageFolder.file(filename, imageData);
            downloadedCount++;

            // Update progress
            showStatus(i18n.tf('statusDownloadProgress', { current: downloadedCount, total: totalCount }), 'info');
            debug.log(`Successfully added image ${downloadedCount}/${totalCount} to ZIP`);

        } catch (error) {
            skippedCount++;
            debug.warn(`Failed to download image ${i + 1}/${totalCount} (${image.url}):`, error.message);
            // Continue with other images - this handles CORS and other fetch errors gracefully
        }
    }

    debug.log(`ZIP creation completed. Downloaded: ${downloadedCount}/${totalCount}`);

    // 用户取消：无已获取内容则直接放弃；有则询问是否打包已获取部分
    if (zipCancelRequested) {
        if (downloadedCount === 0) {
            showStatus(i18n.t('zipAborted'), 'info');
            return;
        }
        if (!window.confirm(i18n.tf('zipPartialConfirm', { count: downloadedCount }))) {
            showStatus(i18n.t('zipAborted'), 'info');
            return;
        }
    }

    if (downloadedCount === 0) {
        showStatus(i18n.t('statusNoDownloads'), 'error');
        return;
    }

    // Generate ZIP file
    debug.log('Generating ZIP blob...');
    showStatus(i18n.t('statusCreatingZip'), 'info');
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    debug.log('ZIP blob created, size:', zipBlob.size);

    // Create download link
    const url = URL.createObjectURL(zipBlob);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const pageTitle = activeTab.title ? sanitizeFilename(activeTab.title).substring(0, 30) : 'page';
    const zipFilename = `ih_images_${pageTitle}_${timestamp}.zip`;

    // ZIP 与单图下载同规则：落入基础保存目录（如有配置）
    const subfolder = await storage.get('ih_base_subfolder');
    const filename = (subfolder && subfolder.trim())
        ? `${subfolder.trim().replace(/[<>:"\\|?*]/g, '').replace(/^[/\\]+|[/\\]+$/g, '')}/${zipFilename}`
        : zipFilename;

    debug.log('Starting download with filename:', filename);

    // 批量结果写入下载记录（source='zip'），note 携带成功/跳过汇总
    const skippedTotal = totalCount - downloadedCount;
    const recordNote = (skippedTotal > 0)
        ? i18n.tf('zipRecordNote', { ok: downloadedCount, skip: skippedTotal })
        : null;

    // Use Chrome downloads API
    chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: false  // Download directly without prompting
    }, (downloadId) => {
        if (chrome.runtime.lastError) {
            debug.error('Download failed:', chrome.runtime.lastError.message);
            showStatus(i18n.tf('statusDownloadFailed', { error: chrome.runtime.lastError.message }), 'error');
            chrome.runtime.sendMessage({
                type: 'record_batch_result',
                filename: zipFilename,
                url: activeTab.url,
                status: 'failed',
                error: chrome.runtime.lastError.message
            }).catch(() => {});
        } else {
            debug.log('Download started with ID:', downloadId);
            showStatus(
                skippedTotal > 0
                    ? i18n.tf('zipDoneSummary', { ok: downloadedCount, skip: skippedTotal })
                    : i18n.tf('zipDoneClean', { ok: downloadedCount }),
                'success');
            chrome.runtime.sendMessage({
                type: 'record_batch_result',
                filename: zipFilename,
                url: activeTab.url,
                downloadId: downloadId,
                note: recordNote
            }).catch(() => {});
        }

        // Clean up object URL
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    });

    debug.log('ZIP download completed successfully');
}

// Fetch image as blob
async function fetchImageAsBlob(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.blob();
}

// Generate filename for image
function generateImageFilename(image, index) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    
    try {
        const url = new URL(image.url, window.location.href);
        let filename = url.pathname.split('/').pop();
        
        // If no filename or no extension, generate one with timestamp
        if (!filename || !filename.includes('.')) {
            const extension = getExtensionFromType(image.type);
            filename = `image_${timestamp}_${index + 1}.${extension}`;
        } else {
            // If filename exists but might be generic, add timestamp for uniqueness
            const nameParts = filename.split('.');
            if (nameParts.length > 1) {
                const extension = nameParts.pop();
                const baseName = nameParts.join('.');
                // Add timestamp if filename is very generic or short
                if (baseName.length < 3 || ['image', 'img', 'pic', 'photo'].includes(baseName.toLowerCase())) {
                    filename = `${baseName}_${timestamp}.${extension}`;
                }
                // Otherwise use original filename as-is
            }
        }
        
        // Sanitize filename while preserving CJK characters
        filename = sanitizeFilename(filename);
        
        return filename;
    } catch {
        const extension = getExtensionFromType(image.type);
        return `image_${timestamp}_${index + 1}.${extension}`;
    }
}

// Get file extension based on image type
function getExtensionFromType(type) {
    switch (type) {
        case 'svg': return 'svg';
        case 'video': return 'mp4';
        case 'background': return 'jpg';
        default: return 'jpg';
    }
}

// Initialize when DOM is loaded (or immediately if already loaded — important for
// Chrome popups where DOMContentLoaded may fire before scripts attach the listener)
async function bootstrapPopup() {
    diag.log('[IH Popup] bootstrapPopup() called, readyState =', document.readyState);
    debug.log('[IH Popup] Initializing...');

    try {
        // Check if JSZip is available
        if (typeof JSZip === 'undefined') {
            debug.error('[IH Popup] JSZip not loaded');
            showStatus(i18n.t('statusJszipLoadFailed'), 'error');
            return;
        } else {
            debug.log('[IH Popup] JSZip loaded successfully, version:', JSZip.version || 'unknown');

            // Test JSZip functionality
            try {
                const testZip = new JSZip();
                testZip.file('test.txt', 'Hello World');
                const testBlob = await testZip.generateAsync({ type: 'blob' });
                debug.log('[IH Popup] JSZip test successful, blob size:', testBlob.size);
            } catch (zipError) {
                debug.error('[IH Popup] JSZip test failed:', zipError);
                showStatus(i18n.t('statusJszipNotFunctioning'), 'error');
                return;
            }
        }

        // Initialize popup and event listeners
        await initializePopup();
        diag.log('[IH Popup] initializePopup() complete');
        setupTabSwitching();
        diag.log('[IH Popup] setupTabSwitching() complete');
        setupEventListeners();
        diag.log('[IH Popup] setupEventListeners() complete');

        debug.log('[IH Popup] Initialization complete');
    } catch (error) {
        diag.error('[IH Popup] Initialization FAILED:', error.message, error.stack);
        showStatus(i18n.t('statusInitFailed'), 'error');
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapPopup);
} else {
    // DOM already parsed (scripts at end of body) — bootstrap immediately
    bootstrapPopup();
}

// Reset all settings to default values
async function resetAllSettings() {
    try {
        // Clear all extension settings
        await chrome.storage.sync.clear();
        // local 里的模板/分隔符副本一并清除（否则会被回读逻辑恢复），
        // 下载记录（ih_download_history）不属于设置，保留
        await chrome.storage.local.remove(['ih_filename_template', 'ih_active_separator']);
        // 主题恢复跟随系统
        applyTheme('auto');

        // Reinitialize popup with default values
        await initializePopup();
        
        // Notify content script of the reset settings
        await notifyContentScriptSettingsChanged();
        
        showStatus(i18n.t('statusResetDone'));
    } catch (error) {
        debug.error('Failed to reset settings:', error);
        showStatus(i18n.t('statusResetFailed'), 'error');
    }
}

// Notify content script of settings changes
async function notifyContentScriptSettingsChanged() {
    try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab && activeTab.id) {
            const settings = await getCurrentSettings();
            const minImageSize = await storage.get('ih_min_image_size');
            
            chrome.tabs.sendMessage(activeTab.id, {
                type: 'settings_updated',
                settings: {
                    ...settings,
                    minImageSize: minImageSize || CONFIG.MIN_IMAGE_SIZE
                }
            }).catch(error => {
                // Ignore errors - content script might not be ready or page might not support it
                debug.log('Could not notify content script:', error.message);
            });
        }
    } catch (error) {
        debug.log('Could not notify content script:', error.message);
    }
}

// ===== Current Site Domain =====

// 获取当前标签页域名并显示排除按钮
async function setupCurrentSite() {
    const domainSpan = document.getElementById('currentSiteDomain');
    const excludeBtn = document.getElementById('excludeSiteBtn');

    function disableDomainRow(tabUrl) {
        domainSpan.textContent = tabUrl || i18n.t('statusUnsupportedPage');
        domainSpan.title = i18n.t('statusUnsupportedPage');
        excludeBtn.disabled = true;
        excludeBtn.style.opacity = '0.45';
        excludeBtn.style.cursor = 'not-allowed';
    }

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.url) {
            disableDomainRow();
            return;
        }

        const url = new URL(tab.url);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            disableDomainRow(tab.url);
            return;
        }

        const domain = url.hostname;
        domainSpan.textContent = domain;

        excludeBtn.addEventListener('click', async () => {
            const currentExclusions = (await storage.get('ih_domain_exclusions')) || [];
            const idx = currentExclusions.indexOf(domain);
            let ok;
            if (idx !== -1) {
                currentExclusions.splice(idx, 1);
                ok = await storage.set('ih_domain_exclusions', currentExclusions);
                if (ok) {
                    excludeBtn.textContent = i18n.t('excludeSiteBtn');
                    excludeBtn.classList.remove('excluded');
                    showStatus(i18n.t('statusSaved'), 'success');
                }
            } else {
                currentExclusions.push(domain);
                ok = await storage.set('ih_domain_exclusions', currentExclusions);
                if (ok) {
                    markAsExcluded(excludeBtn);
                    showStatus(i18n.t('statusSaved'), 'success');
                }
            }
        });

        const exclusions = (await storage.get('ih_domain_exclusions')) || [];
        if (exclusions.includes(domain)) {
            markAsExcluded(excludeBtn);
        }
    } catch (error) {
        debug.error('Failed to get current domain:', error);
        disableDomainRow();
    }
}

function markAsExcluded(btn) {
    btn.textContent = i18n.t('excludeSiteDone');
    btn.classList.add('excluded');
}
