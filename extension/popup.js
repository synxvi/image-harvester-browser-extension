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
        const downloadSubfolder = await storage.get('ih_download_subfolder');
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
        
        // Set download subfolder (kept for ZIP / non-multi-path usage)
        const subfolderInput = document.getElementById('downloadSubfolder');
        if (subfolderInput) {
            subfolderInput.value = downloadSubfolder || '';
        }

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

        const dot = document.createElement('span');
        dot.className = 'dl-dot';
        dot.title = i18n.t(statusKey);

        const name = document.createElement('span');
        name.className = 'dl-name';
        name.textContent = rec.filename || 'media';

        const time = document.createElement('span');
        time.className = 'dl-time';
        time.textContent = formatRelativeTime(rec.ts || Date.now());

        item.appendChild(dot);
        item.appendChild(name);
        item.appendChild(time);

        // 悬停可见完整信息：来源 URL + 失败原因（含重试提示）
        const errLine = rec.status === 'failed'
            ? `\n${i18n.t('downloadStatusFailed')}: ${rec.error || 'unknown'}\n${i18n.t('retryHint')}`
            : '';
        item.title = `${rec.filename || ''}\n${rec.url || ''}${errLine}`;

        // 点击重试：仅失败记录且 URL 为可再次下载的 http(s) 地址时可用
        // （data:/blob: 是页面内转换产物，脱离页面上下文无法重建）
        item.addEventListener('click', async () => {
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
                    pathIndex: (rec.pathIndex != null ? rec.pathIndex : -1)
                });
                showStatus(i18n.tf('statusRetryQueued', { name: rec.filename || '' }), 'success');
            } catch (e) {
                diag.error('发送重试请求失败:', e);
                showStatus(i18n.t('statusSaveFailed'), 'error');
            }
        });

        listEl.appendChild(item);
    });
}

function setupDownloadHistory() {
    renderDownloadHistory();

    // popup 打开期间后台持续更新记录（状态 pending→success/failed），实时刷新
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes[DL_HISTORY_KEY]) {
            renderDownloadHistory();
        }
    });

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
}

// Set up download mode UI
function setupDownloadModeUI(currentMode) {
    const downloadModeRadios = document.querySelectorAll('input[name="downloadMode"]');
    downloadModeRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            if (this.value !== 'normal') {
                switchToTab('advanced');
            }
        });
    });

    if (currentMode !== 'normal') {
        switchToTab('advanced');
    }
}

// Set up language selector event listener
function setupLanguageSelectorListener() {
    const languageSelect = document.getElementById('languageSelect');
    if (!languageSelect) {
        diag.error('setupLanguageSelectorListener: #languageSelect NOT FOUND!');
        return;
    }
    diag.log('setupLanguageSelectorListener: attached to #languageSelect');

    languageSelect.addEventListener('change', async (e) => {
        diag.log('languageSelect change event fired, new value:', e.target.value);
        await i18n.setLocale(e.target.value);
    });
}

// 检测当前页面是否支持 content script 通信，不支持则禁用批量下载按钮
async function checkPageAndDisableBulkButtons() {
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    const downloadZipBtn = document.getElementById('downloadZipBtn');
    if (!downloadAllBtn || !downloadZipBtn) return;

    try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const url = activeTab?.url || '';
        const supported = url.startsWith('http://') || url.startsWith('https://');

        if (!supported) {
            const tip = i18n.t('statusUnsupportedPage');
            downloadAllBtn.disabled = true;
            downloadAllBtn.title = tip;
            downloadZipBtn.disabled = true;
            downloadZipBtn.title = tip;
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

    // Download subfolder input (kept for ZIP / non-multi-path usage)
    const downloadSubfolderInputEl = document.getElementById('downloadSubfolder');
    if (downloadSubfolderInputEl) {
        downloadSubfolderInputEl.addEventListener('change', async (e) => {
            let rawValue = e.target.value.trim();
            let sanitized = rawValue.replace(/[<>:"\\|?*]/g, '').replace(/^[/\\]+|[/\\]+$/g, '');
            e.target.value = sanitized;
            const success = await storage.set('ih_download_subfolder', sanitized);
            if (success) {
                if (sanitized) {
                    showStatus(i18n.tf('statusSubfolderSet', { value: sanitized }));
                } else {
                    showStatus(i18n.t('statusSubfolderDirect'));
                }
                await notifyContentScriptSettingsChanged();
            } else {
                showStatus(i18n.t('statusSubfolderFailed'), 'error');
            }
        });
    }

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
        if (!newName && !newFolder) {
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
        
        // Create gallery HTML
        debug.log('Creating gallery HTML...');
        const galleryHtml = await createGalleryHtml(images, activeTab.title);
        debug.log('Gallery HTML length:', galleryHtml.length);
        
        // Open gallery in new tab
        debug.log('Opening gallery in new tab...');
        chrome.tabs.create({
            url: 'data:text/html;charset=utf-8,' + encodeURIComponent(galleryHtml)
        });
        
        showStatus(i18n.tf('statusGalleryOpened', { count: images.length }));
        debug.log('Gallery view completed successfully');
        
    } catch (error) {
        debug.error('Gallery view error:', error);
        showStatus(i18n.t('statusGalleryFailed'), 'error');
    }
}

// Handle ZIP download
async function handleDownloadZip() {
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
        
        // Prepend subfolder if configured
        const subfolder = await storage.get('ih_download_subfolder');
        const filename = (subfolder && subfolder.trim())
            ? `${subfolder.trim()}/${zipFilename}`
            : zipFilename;
        
        debug.log('Starting download with filename:', filename);
        
        // Use Chrome downloads API
        chrome.downloads.download({
            url: url,
            filename: filename,
            saveAs: false  // Download directly without prompting
        }, (downloadId) => {
            if (chrome.runtime.lastError) {
                debug.error('Download failed:', chrome.runtime.lastError.message);
                showStatus(i18n.tf('statusDownloadFailed', { error: chrome.runtime.lastError.message }), 'error');
            } else {
                debug.log('Download started with ID:', downloadId);
                showStatus(i18n.tf('statusZipCreated', { count: downloadedCount }));
            }
            
            // Clean up object URL
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        });
        
        debug.log('ZIP download completed successfully');
        
    } catch (error) {
        debug.error('ZIP download error:', error);
        showStatus(i18n.t('statusZipCreateFailed'), 'error');
    }
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

// Create gallery HTML (internationalized)
async function createGalleryHtml(images, pageTitle) {
    const title = pageTitle ? i18n.tf('galleryTitle', { title: pageTitle }) : i18n.t('galleryTitleFallback');
    const locale = i18n.getEffectiveLocale();
    const langAttr = locale === 'zh_CN' ? 'zh-CN' : 'en';
    
    // Get unique file extensions for filter
    const extensions = [...new Set(images.map(img => {
        try {
            const url = new URL(img.url);
            const ext = url.pathname.split('.').pop().toLowerCase();
            return ext && ext.length <= 4 ? ext : 'unknown';
        } catch {
            return 'unknown';
        }
    }))].sort();

    const openInNewTabText = i18n.t('galleryOpenInNewTab');

    const imageHtml = images.map((image, index) => {
        const alt = image.alt || i18n.tf('galleryImageAlt', { index: index + 1 });
        const dimensions = `${Math.round(image.width)}x${Math.round(image.height)}`;
        const fileExt = (() => {
            try {
                const url = new URL(image.url);
                const ext = url.pathname.split('.').pop().toLowerCase();
                return ext && ext.length <= 4 ? ext : 'unknown';
            } catch {
                return 'unknown';
            }
        })();
        
        return `
            <div class="gallery-item" data-width="${image.width}" data-height="${image.height}" data-ext="${fileExt}">
                <img src="${image.url}" alt="${alt}" loading="lazy">
                <div class="image-info">
                    <div class="image-title">${alt}</div>
                    <div class="image-meta">
                        <span class="image-type">${image.type.toUpperCase()}</span>
                        <span class="image-dimensions">${dimensions}</span>
                        <span class="image-ext">${fileExt.toUpperCase()}</span>
                    </div>
                    <a href="${image.url}" target="_blank" class="download-link">${openInNewTabText}</a>
                </div>
            </div>
        `;
    }).join('');
    
    const foundText = i18n.tf('galleryFound', { total: images.length, visible: `<span id="visibleCount">${images.length}</span>` });
    const tipText = i18n.t('galleryTip');
    const filterBySizeLabel = i18n.t('galleryFilterBySize');
    const widthLabel = i18n.t('galleryWidth');
    const heightLabel = i18n.t('galleryHeight');
    const filterByExtLabel = i18n.t('galleryFilterByExt');
    const resetFiltersText = i18n.t('galleryResetFilters');
    const zipDownloadText = i18n.t('galleryZipDownload');
    const corsWarningText = i18n.t('galleryCorsWarning');
    const footerLine1 = i18n.tf('galleryFooterLine1', { version: EXTENSION_VERSION });
    const footerLine2 = i18n.t('galleryFooterLine2');
    
    // Inline gallery script translations (serialized into the generated page)
    const gt = i18n.translations[locale] || i18n.translations.en;

    // 内联嵌入 JSZip（data URL 页面无法加载扩展资源）
    let jszipCode = '';
    try {
        const resp = await fetch(chrome.runtime.getURL('jszip.min.js'));
        jszipCode = await resp.text();
    } catch (e) {
        debug.warn('Failed to load JSZip for gallery:', e);
    }

    return `
        <!DOCTYPE html>
        <html lang="${langAttr}">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${title}</title>
            <script>${jszipCode}</script>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    margin: 0;
                    padding: 20px;
                    background-color: #f5f5f5;
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                }
                .header h1 {
                    color: #333;
                    margin: 0 0 10px 0;
                }
                .header p {
                    color: #666;
                    margin: 0;
                }
                .controls {
                    max-width: 1200px;
                    margin: 0 auto 20px auto;
                    background: white;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }
                .filter-section {
                    margin-bottom: 15px;
                }
                .filter-section label {
                    display: block;
                    font-weight: 600;
                    margin-bottom: 8px;
                    color: #333;
                }
                .size-filter {
                    display: flex;
                    gap: 10px;
                    align-items: center;
                    margin-bottom: 15px;
                }
                .size-filter input {
                    width: 80px;
                    padding: 4px 8px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                }
                .extension-filters {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                    margin-bottom: 15px;
                }
                .ext-checkbox {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }
                .ext-checkbox input {
                    margin: 0;
                }
                .action-buttons {
                    display: flex;
                    gap: 10px;
                }
                .btn {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: 500;
                    transition: background 0.2s;
                }
                .btn-primary {
                    background: #1976d2;
                    color: white;
                }
                .btn-primary:hover {
                    background: #1565c0;
                }
                .btn-secondary {
                    background: #e0e0e0;
                    color: #333;
                }
                .btn-secondary:hover {
                    background: #d0d0d0;
                }
                .gallery {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 20px;
                    max-width: 1200px;
                    margin: 0 auto;
                }
                .gallery-item {
                    background: white;
                    border-radius: 8px;
                    overflow: hidden;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    transition: transform 0.2s;
                }
                .gallery-item:hover {
                    transform: translateY(-2px);
                }
                .gallery-item.hidden {
                    display: none;
                }
                .gallery-item img {
                    width: 100%;
                    height: 200px;
                    object-fit: cover;
                    display: block;
                }
                .image-info {
                    padding: 15px;
                }
                .image-title {
                    font-weight: 600;
                    color: #333;
                    margin-bottom: 8px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .image-meta {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 10px;
                    font-size: 12px;
                    color: #666;
                    flex-wrap: wrap;
                }
                .image-type, .image-ext {
                    background: #e1f5fe;
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-weight: 500;
                }
                .download-link {
                    display: inline-block;
                    background: #1976d2;
                    color: white;
                    padding: 6px 12px;
                    text-decoration: none;
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: 500;
                    transition: background 0.2s;
                }
                .download-link:hover {
                    background: #1565c0;
                }
                .stats {
                    text-align: center;
                    margin-bottom: 20px;
                    color: #666;
                }
                .status {
                    padding: 10px;
                    border-radius: 4px;
                    margin-bottom: 15px;
                    text-align: center;
                    font-weight: 500;
                }
                .status.info {
                    background: #e3f2fd;
                    color: #1976d2;
                }
                .status.success {
                    background: #e8f5e8;
                    color: #2e7d32;
                }
                .status.error {
                    background: #ffebee;
                    color: #c62828;
                }
                .status.hidden {
                    display: none;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>${title}</h1>
                <p class="stats">${foundText}</p>
                <p style="color: #666; font-size: 14px; margin: 10px 0 0 0;">
                    ${tipText}
                </p>
            </div>
            
            <div class="controls">
                <div class="status hidden" id="status"></div>
                
                <div class="filter-section">
                    <label>${filterBySizeLabel}</label>
                    <div class="size-filter">
                        <span>${widthLabel}</span>
                        <input type="number" id="minWidth" placeholder="Min" min="0">
                        <span>-</span>
                        <input type="number" id="maxWidth" placeholder="Max" min="0">
                        <span>${heightLabel}</span>
                        <input type="number" id="minHeight" placeholder="Min" min="0">
                        <span>-</span>
                        <input type="number" id="maxHeight" placeholder="Max" min="0">
                    </div>
                </div>
                
                <div class="filter-section">
                    <label>${filterByExtLabel}</label>
                    <div class="extension-filters">
                        ${extensions.map(ext => `
                            <div class="ext-checkbox">
                                <input type="checkbox" id="ext-${ext}" value="${ext}" checked>
                                <label for="ext-${ext}">${ext.toUpperCase()}</label>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="action-buttons">
                    <button class="btn btn-primary" id="resetFiltersBtn">${resetFiltersText}</button>
                    <button class="btn btn-secondary" id="downloadZipBtn">${zipDownloadText}</button>
                </div>
                
                <div class="download-info" style="margin-top: 15px; padding: 10px; background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; font-size: 12px; color: #856404;">
                    ${corsWarningText}
                </div>
            </div>
            
            <div class="gallery" id="gallery">
                ${imageHtml}
            </div>
            
            <footer style="margin-top: 40px; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0; background-color: #f8f9fa; color: #6c757d; font-size: 11px;">
                <p style="margin: 0 0 5px 0;">
                    ${footerLine1}
                </p>
                <p style="margin: 0; font-style: italic;">
                    ${footerLine2}
                </p>
            </footer>
            
            <script>
                // Debug wrapper for gallery page
                const DEBUG = false;
                const debug = {
                    log: (...args) => DEBUG && console.log(...args),
                    error: (...args) => DEBUG && console.error(...args),
                    warn: (...args) => DEBUG && console.warn(...args),
                    info: (...args) => DEBUG && console.info(...args)
                };
                
                const allImages = ${JSON.stringify(images)};
                let filteredImages = [...allImages];
                
                // Gallery page translations (embedded from popup locale)
                const _gt = ${JSON.stringify(gt)};
                function gt(key) { return _gt[key] || key; }
                
                function showStatus(message, type = 'info') {
                    const status = document.getElementById('status');
                    status.textContent = message;
                    status.className = 'status ' + type;
                    status.classList.remove('hidden');
                    
                    setTimeout(() => {
                        status.classList.add('hidden');
                    }, 3000);
                }
                
                function updateVisibleCount() {
                    const visibleItems = document.querySelectorAll('.gallery-item:not(.hidden)');
                    document.getElementById('visibleCount').textContent = visibleItems.length;
                }
                
                function applyFilters() {
                    const minWidth = parseInt(document.getElementById('minWidth').value) || 0;
                    const maxWidth = parseInt(document.getElementById('maxWidth').value) || Infinity;
                    const minHeight = parseInt(document.getElementById('minHeight').value) || 0;
                    const maxHeight = parseInt(document.getElementById('maxHeight').value) || Infinity;
                    
                    const enabledExtensions = new Set();
                    document.querySelectorAll('.ext-checkbox input:checked').forEach(cb => {
                        enabledExtensions.add(cb.value);
                    });
                    
                    const items = document.querySelectorAll('.gallery-item');
                    filteredImages = [];
                    
                    items.forEach((item, index) => {
                        const width = parseInt(item.dataset.width);
                        const height = parseInt(item.dataset.height);
                        const ext = item.dataset.ext;
                        
                        const sizeMatch = width >= minWidth && width <= maxWidth && 
                                        height >= minHeight && height <= maxHeight;
                        const extMatch = enabledExtensions.has(ext);
                        
                        if (sizeMatch && extMatch) {
                            item.classList.remove('hidden');
                            filteredImages.push(allImages[index]);
                        } else {
                            item.classList.add('hidden');
                        }
                    });
                    
                    updateVisibleCount();
                }
                
                async function downloadZip() {
                    if (filteredImages.length === 0) {
                        showStatus(gt('galleryNoImagesToDownload'), 'error');
                        return;
                    }

                    if (typeof JSZip === 'undefined') {
                        showStatus(gt('galleryZipFailed'), 'error');
                        return;
                    }

                    try {
                        showStatus(gt('galleryCreatingZip'), 'info');

                        const zip = new JSZip();
                        const imageFolder = zip.folder('images');
                        let downloadedCount = 0;
                        
                        for (let i = 0; i < filteredImages.length; i++) {
                            const image = filteredImages[i];
                            
                            try {
                                const response = await fetch(image.url);
                                if (!response.ok) throw new Error('Failed to fetch');
                                
                                const blob = await response.blob();
                                const filename = generateFilename(image, i);
                                
                                imageFolder.file(filename, blob);
                                downloadedCount++;
                                
                                const progressMsg = gt('galleryDownloaded')
                                    .replace('{count}', downloadedCount)
                                    .replace(/Downloaded.*?images/, 'Downloaded ' + downloadedCount + '/' + filteredImages.length + ' images...')
                                    .replace(/\u4E0B\u8F7D.*/, '\u5DF2\u4E0B\u8F7D ' + downloadedCount + '/' + filteredImages.length + ' \u5F20\u56FE\u7247...');
                                // Fallback: just use simple progress
                                showStatus(
                                    downloadedCount + '/' + filteredImages.length +
                                    (gt('galleryLangHint') || '').includes('zh') ? ' \u5F20\u56FE\u7247...' : ' images...'
                                , 'info');
                                showStatus('Downloaded ' + downloadedCount + '/' + filteredImages.length + '...', 'info');
                            } catch (error) {
                                debug.warn('Failed to download image:', image.url, error);
                            }
                        }
                        
                        if (downloadedCount === 0) {
                            showStatus(gt('galleryNoImagesToDownload'), 'error');
                            return;
                        }
                        
                        showStatus(gt('galleryGeneratingZip'), 'info');
                        const zipBlob = await zip.generateAsync({ type: 'blob' });
                        
                        const url = URL.createObjectURL(zipBlob);
                        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                        const filename = 'ih_gallery_images_' + timestamp + '.zip';
                        
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = filename;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                        
                        showStatus(gt('galleryZipDownloaded').replace('{count}', downloadedCount), 'success');
                    } catch (error) {
                        debug.error('ZIP download failed:', error);
                        showStatus(gt('galleryZipFailed'), 'error');
                    }
                }
                
                // Sanitize filename while preserving CJK characters
                function sanitizeFilename(filename) {
                    let result = '';
                    for (let i = 0; i < filename.length; i++) {
                        const char = filename.charAt(i);
                        const code = filename.charCodeAt(i);
                        
                        if ('<>:"/\\\\|?*'.includes(char)) {
                            result += '_';
                        }
                        else if (code >= 0 && code <= 31 || code === 127) {
                            result += '_';
                        }
                        else {
                            result += char;
                        }
                    }
                    
                    return result
                        .replace(/\\s+/g, '_')
                        .replace(/_{2,}/g, '_')
                        .replace(/^_|_$/g, '');
                }
                
                function generateFilename(image, index) {
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                    
                    try {
                        const url = new URL(image.url);
                        let filename = url.pathname.split('/').pop();
                        
                        if (!filename || !filename.includes('.')) {
                            const extension = image.url.split('.').pop() || 'jpg';
                            filename = 'image_' + timestamp + '_' + (index + 1) + '.' + extension;
                        }
                        
                        return sanitizeFilename(filename);
                    } catch {
                        return 'image_' + timestamp + '_' + (index + 1) + '.jpg';
                    }
                }
                
                function resetFilters() {
                    document.getElementById('minWidth').value = '';
                    document.getElementById('maxWidth').value = '';
                    document.getElementById('minHeight').value = '';
                    document.getElementById('maxHeight').value = '';
                    
                    document.querySelectorAll('.ext-checkbox input').forEach(cb => {
                        cb.checked = true;
                    });
                    
                    applyFilters();
                }
                
                // Event listeners
                document.getElementById('downloadZipBtn').addEventListener('click', downloadZip);
                document.getElementById('resetFiltersBtn').addEventListener('click', resetFilters);
                
                // Filter inputs
                ['minWidth', 'maxWidth', 'minHeight', 'maxHeight'].forEach(id => {
                    document.getElementById(id).addEventListener('input', applyFilters);
                });
                
                document.querySelectorAll('.ext-checkbox input').forEach(cb => {
                    cb.addEventListener('change', applyFilters);
                });
                
                // Initial filter application
                applyFilters();
            </script>
        </body>
        </html>
    `;
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
