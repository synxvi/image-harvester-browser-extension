// Image Harvester - Gallery page (扩展页替代旧 data: URL 方案)
// Copyright (c) Jaewoo Jeon (@thejjw) and Image Harvester Contributors
// SPDX-License-Identifier: zlib-acknowledgement
//
// 数据来源：popup 扫描后写入 storage.session 的 ih_gallery_data（读后即删）。
// 因为本页是扩展页面，可直接使用 chrome.runtime/downloads API：
// 「下载选中」走 background 统一管线（入下载记录，source='gallery'），
// 「打包选中」在本页 fetch + JSZip，结果经 record_batch_result 入记录。

// ====== 基础设施（popup-i18n.js 的 init 依赖 diag/storage 全局） ======
const DEBUG = false;
const debug = {
    log: (...args) => DEBUG && console.log('[IH Gallery]', ...args),
    error: (...args) => DEBUG && console.error('[IH Gallery]', ...args),
    warn: (...args) => DEBUG && console.warn('[IH Gallery]', ...args)
};
const diag = {
    log: (...args) => console.log('[IH Gallery DIAG]', ...args),
    error: (...args) => console.error('[IH Gallery DIAG]', ...args)
};
const storage = {
    async get(key) {
        try {
            const result = await chrome.storage.sync.get(key);
            return result[key];
        } catch (e) {
            debug.error('Storage get error:', e);
            return null;
        }
    }
};

const GALLERY_DATA_KEY = 'ih_gallery_data';
const EXTENSION_VERSION_PLACEHOLDER = chrome.runtime.getManifest().version; // footer 展示用

// ====== 页面状态 ======
let allImages = [];       // {url, type, alt, width, height}
let visibleIndexes = [];  // 过滤后可见的索引
const selectedSet = new Set(); // 勾选的索引（独立于过滤状态保留）
let pageTitle = '';
let pageUrl = '';

// ====== 工具 ======
function escapeHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function showStatus(message, type = 'info') {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = 'g-status ' + type;
    // success/error 停留久一点，进度类信息不自动消失会被覆盖更新
    const ttl = type === 'info' ? 4000 : 5000;
    clearTimeout(showStatus._timer);
    showStatus._timer = setTimeout(() => {
        status.className = 'g-status hidden';
    }, ttl);
}

function fileExtOf(url) {
    try {
        const ext = new URL(url).pathname.split('.').pop().toLowerCase();
        return ext && ext.length <= 4 ? ext : 'unknown';
    } catch {
        return 'unknown';
    }
}

// ZIP/下载用的文件名：URL basename，兜底按索引编号
function generateFilename(image, index) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    try {
        let filename = new URL(image.url).pathname.split('/').pop();
        if (!filename || !filename.includes('.')) {
            filename = `image_${ts}_${index + 1}.jpg`;
        }
        return filename.replace(/[<>:"/\\|?*]/g, '_');
    } catch {
        return `image_${ts}_${index + 1}.jpg`;
    }
}

// 「下载选中」传给 background 的建议文件名
function nameFromUrl(url) {
    try {
        return decodeURIComponent(new URL(url).pathname.split('/').pop()) || 'image';
    } catch {
        return 'image';
    }
}

// ====== 渲染 ======
function renderCards() {
    const container = document.getElementById('gallery');
    container.textContent = '';

    const openText = i18n.t('galleryOpenInNewTab');
    allImages.forEach((image, index) => {
        const item = document.createElement('div');
        item.className = 'gallery-item' + (selectedSet.has(index) ? ' selected' : '');
        item.dataset.index = index;

        const check = document.createElement('input');
        check.type = 'checkbox';
        check.className = 'item-check';
        check.checked = selectedSet.has(index);
        check.setAttribute('aria-label', i18n.t('gallerySelectVisible'));
        check.addEventListener('change', () => {
            if (check.checked) selectedSet.add(index);
            else selectedSet.delete(index);
            item.classList.toggle('selected', check.checked);
            updateStats();
        });

        const img = document.createElement('img');
        img.src = image.url;
        img.alt = image.alt || i18n.tf('galleryImageAlt', { index: index + 1 });
        img.loading = 'lazy';

        const info = document.createElement('div');
        info.className = 'image-info';
        const title = document.createElement('div');
        title.className = 'image-title';
        title.textContent = image.alt || i18n.tf('galleryImageAlt', { index: index + 1 });
        const meta = document.createElement('div');
        meta.className = 'image-meta';
        const typeSpan = document.createElement('span');
        typeSpan.className = 'image-type';
        typeSpan.textContent = String(image.type || 'img').toUpperCase();
        const dimSpan = document.createElement('span');
        dimSpan.textContent = `${Math.round(image.width)}×${Math.round(image.height)}`;
        const extSpan = document.createElement('span');
        extSpan.className = 'image-ext';
        extSpan.textContent = fileExtOf(image.url).toUpperCase();
        meta.append(typeSpan, dimSpan, extSpan);

        const link = document.createElement('a');
        link.className = 'download-link';
        link.href = image.url;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = openText;

        info.append(title, meta, link);
        item.append(check, img, info);
        container.appendChild(item);
    });
}

function renderExtFilters() {
    const container = document.getElementById('extFilters');
    container.textContent = '';
    const exts = [...new Set(allImages.map(img => fileExtOf(img.url)))].sort();
    exts.forEach(ext => {
        const wrap = document.createElement('label');
        wrap.className = 'ext-checkbox';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = ext;
        cb.checked = true;
        cb.id = 'ext-' + ext;
        cb.addEventListener('change', applyFilters);
        const text = document.createElement('span');
        text.textContent = ext.toUpperCase();
        wrap.append(cb, text);
        container.appendChild(wrap);
    });
}

// 过滤：宽高区间 + 扩展名集合；过滤结果更新 visibleIndexes（不改变勾选）
function applyFilters() {
    const minWidth = parseInt(document.getElementById('minWidth').value) || 0;
    const maxWidth = parseInt(document.getElementById('maxWidth').value) || Infinity;
    const minHeight = parseInt(document.getElementById('minHeight').value) || 0;
    const maxHeight = parseInt(document.getElementById('maxHeight').value) || Infinity;

    const enabledExts = new Set(
        [...document.querySelectorAll('.ext-checkbox input:checked')].map(cb => cb.value)
    );

    visibleIndexes = [];
    document.querySelectorAll('.gallery-item').forEach(item => {
        const idx = parseInt(item.dataset.index);
        const image = allImages[idx];
        const sizeMatch = image.width >= minWidth && image.width <= maxWidth &&
            image.height >= minHeight && image.height <= maxHeight;
        const extMatch = enabledExts.has(fileExtOf(image.url));
        const match = sizeMatch && extMatch;
        item.classList.toggle('hidden', !match);
        if (match) visibleIndexes.push(idx);
    });
    updateStats();
}

function resetFilters() {
    ['minWidth', 'maxWidth', 'minHeight', 'maxHeight'].forEach(id => {
        document.getElementById(id).value = '';
    });
    document.querySelectorAll('.ext-checkbox input').forEach(cb => { cb.checked = true; });
    applyFilters();
}

function updateStats() {
    const el = document.getElementById('galleryStats');
    el.textContent = i18n.tf('galleryStatsLine', {
        total: allImages.length,
        visible: visibleIndexes.length,
        selected: selectedSet.size
    });
}

function selectedTargets() {
    return allImages.map((img, i) => selectedSet.has(i) ? img : null).filter(Boolean);
}

// ====== 批量操作 ======

// 逐张走 background 统一管线：入下载记录、遵循基础目录与命名清洗，source='gallery'
async function downloadSelected() {
    const targets = selectedTargets();
    if (!targets.length) {
        showStatus(i18n.t('galleryNoImagesToDownload'), 'error');
        return;
    }
    let queued = 0;
    for (const image of targets) {
        try {
            await chrome.runtime.sendMessage({
                type: 'download_image',
                url: image.url,
                filename: nameFromUrl(image.url),
                downloadMode: 'normal',
                pathIndex: -1,
                source: 'gallery'
            });
            queued++;
        } catch (e) {
            debug.warn('下载消息发送失败:', image.url, e);
        }
    }
    showStatus(i18n.tf('galleryQueued', { n: queued }), queued ? 'success' : 'error');
}

// 打包选中为 ZIP：本页 fetch（扩展页有 host 权限），进行中按钮复用为「取消」
let zipBusy = false;
let zipCancel = false;

async function zipSelected() {
    if (zipBusy) {
        zipCancel = true;
        showStatus(i18n.t('zipCancelling'), 'info');
        return;
    }
    const targets = selectedTargets();
    if (!targets.length) {
        showStatus(i18n.t('galleryNoImagesToDownload'), 'error');
        return;
    }
    if (typeof JSZip === 'undefined') {
        showStatus(i18n.t('galleryZipFailed'), 'error');
        return;
    }
    if (!window.confirm(i18n.tf('zipConfirm', { count: targets.length }))) return;

    const zipBtn = document.getElementById('zipSelectedBtn');
    const zipBtnOriginal = zipBtn.innerHTML;
    zipBusy = true;
    zipCancel = false;
    zipBtn.innerHTML = `🛑 ${i18n.t('zipCancel')}`;
    zipBtn.classList.add('cancel-mode');
    try {
        const zip = new JSZip();
        const folder = zip.folder('images');
        let ok = 0;
        for (let i = 0; i < targets.length; i++) {
            if (zipCancel) break;
            try {
                const resp = await fetch(targets[i].url);
                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                folder.file(generateFilename(targets[i], i), await resp.blob());
                ok++;
                showStatus(
                    i18n.t('galleryProgress').replace('{n}', ok).replace('{total}', targets.length),
                    'info');
            } catch (e) {
                debug.warn('Failed to fetch image:', targets[i].url, e);
            }
        }

        if (zipCancel) {
            if (ok === 0) { showStatus(i18n.t('zipAborted'), 'info'); return; }
            if (!window.confirm(i18n.tf('zipPartialConfirm', { count: ok }))) {
                showStatus(i18n.t('zipAborted'), 'info');
                return;
            }
        }
        if (ok === 0) {
            showStatus(i18n.t('galleryNoImagesToDownload'), 'error');
            return;
        }

        showStatus(i18n.t('galleryGeneratingZip'), 'info');
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const objUrl = URL.createObjectURL(zipBlob);
        const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const zipName = `ih_gallery_images_${ts}.zip`;
        const base = String(await storage.get('ih_base_subfolder') || '')
            .replace(/[<>:"\\|?*]/g, '').replace(/^[/\\]+|[/\\]+$/g, '').trim();
        const fullPath = base ? `${base}/${zipName}` : zipName;

        const skipped = targets.length - ok;
        chrome.downloads.download({ url: objUrl, filename: fullPath, saveAs: false }, (downloadId) => {
            if (chrome.runtime.lastError) {
                showStatus(i18n.t('galleryZipFailed'), 'error');
                chrome.runtime.sendMessage({
                    type: 'record_batch_result',
                    filename: zipName,
                    url: pageUrl,
                    status: 'failed',
                    error: chrome.runtime.lastError.message
                }).catch(() => {});
            } else {
                showStatus(
                    skipped > 0
                        ? i18n.tf('zipDoneSummary', { ok, skip: skipped })
                        : i18n.tf('zipDoneClean', { ok }),
                    'success');
                chrome.runtime.sendMessage({
                    type: 'record_batch_result',
                    filename: zipName,
                    url: pageUrl,
                    downloadId,
                    note: skipped > 0 ? i18n.tf('zipRecordNote', { ok, skip: skipped }) : null
                }).catch(() => {});
            }
            setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
        });
    } finally {
        zipBusy = false;
        zipCancel = false;
        zipBtn.innerHTML = zipBtnOriginal;
        zipBtn.classList.remove('cancel-mode');
    }
}

// ====== 入口 ======
async function main() {
    // 应用主题（ih_theme 手动覆盖 / 跟随系统由 CSS media 查询处理）
    try {
        const d = await chrome.storage.sync.get('ih_theme');
        if (d.ih_theme === 'light' || d.ih_theme === 'dark') {
            document.documentElement.dataset.theme = d.ih_theme;
        }
    } catch (e) { /* 忽略 */ }

    await i18n.init();
    i18n.applyToDOM();
    document.title = i18n.t('galleryTitleFallback');

    const data = await chrome.storage.session.get(GALLERY_DATA_KEY);
    const payload = data && data[GALLERY_DATA_KEY];
    if (!payload || !Array.isArray(payload.images) || !payload.images.length) {
        const empty = document.createElement('div');
        empty.className = 'gallery-empty';
        empty.textContent = i18n.t('galleryEmptyData');
        document.getElementById('gallery').replaceWith(empty);
        document.querySelector('.gallery-controls').style.display = 'none';
        return;
    }
    // 读后即删：再次打开画廊页（无扫描数据）时显示空态而非陈旧数据
    chrome.storage.session.remove(GALLERY_DATA_KEY).catch(() => {});

    allImages = payload.images;
    pageTitle = payload.pageTitle || '';
    pageUrl = payload.pageUrl || '';

    document.getElementById('galleryTitle').textContent = pageTitle
        ? i18n.tf('galleryTitle', { title: pageTitle })
        : i18n.t('galleryTitleFallback');
    document.getElementById('footerLine1').textContent =
        i18n.tf('galleryFooterLine1', { version: EXTENSION_VERSION_PLACEHOLDER });

    renderExtFilters();
    renderCards();
    applyFilters();

    // 事件绑定
    ['minWidth', 'maxWidth', 'minHeight', 'maxHeight'].forEach(id => {
        document.getElementById(id).addEventListener('input', applyFilters);
    });
    document.getElementById('resetFiltersBtn').addEventListener('click', resetFilters);
    document.getElementById('selectAllBtn').addEventListener('click', () => {
        visibleIndexes.forEach(i => selectedSet.add(i));
        document.querySelectorAll('.gallery-item').forEach(item => {
            const idx = parseInt(item.dataset.index);
            if (visibleIndexes.includes(idx)) {
                item.classList.add('selected');
                item.querySelector('.item-check').checked = true;
            }
        });
        updateStats();
    });
    document.getElementById('clearSelectionBtn').addEventListener('click', () => {
        selectedSet.clear();
        document.querySelectorAll('.gallery-item').forEach(item => {
            item.classList.remove('selected');
            const cb = item.querySelector('.item-check');
            if (cb) cb.checked = false;
        });
        updateStats();
    });
    document.getElementById('downloadSelectedBtn').addEventListener('click', downloadSelected);
    document.getElementById('zipSelectedBtn').addEventListener('click', zipSelected);
}

main().catch(e => {
    diag.error('Gallery init failed:', e);
});
