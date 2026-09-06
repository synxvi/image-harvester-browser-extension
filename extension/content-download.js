// Image Harvester - Content Download (toast, downloadElement, scan, eligibility)
// Copyright (c) Jaewoo Jeon (@thejjw) and Image Harvester Contributors
// SPDX-License-Identifier: zlib-acknowledgement
//
// Depends on content-core.js, content-strategies.js, content-image-processing.js.
// Uses: debug, CONFIG, storage, minImageSize, convertWebpToPng, downloadButton,
//       findMatchingStrategy, transformUrl, strategyResolvers,
//       extractImageToCanvas, convertWebpImageToPng, contentLocale, activeStrategy.

// ====== Toast 通知系统 ======
let toastContainer = null;

function getToastContainer() {
    if (!toastContainer || !document.body.contains(toastContainer)) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'ih-toast-container';
        document.body.appendChild(toastContainer);
    }
    return toastContainer;
}

function showPageToast(messageKey, type = 'start', detail = '') {
    const container = getToastContainer();
    const toast = document.createElement('div');
    toast.className = `ih-toast ih-toast-${type}`;

    // 内置翻译表，支持 popup 中用户选择的语言
    const translations = {
        en: { toastDownloadStart: 'Downloading', toastDownloadComplete: 'Downloaded', toastDownloadFailed: 'Download failed', toastExtReloaded: 'Extension reloaded, refresh the page to download' },
        zh_CN: { toastDownloadStart: '开始下载', toastDownloadComplete: '下载完成', toastDownloadFailed: '下载失败', toastExtReloaded: '扩展已重新加载，请刷新页面后再下载' }
    };

    // 根据用户语言偏好获取文本
    const locale = contentLocale || 'en';
    const table = translations[locale] || translations.en;
    const text = table[messageKey] || translations.en[messageKey] || messageKey;

    // detail（文件名等）来自页面数据，用 textContent 避免 innerHTML 注入
    const span = document.createElement('span');
    span.className = 'ih-toast-text';
    span.textContent = detail ? `${text} - ${detail}` : text;
    toast.appendChild(span);
    container.appendChild(toast);

    // 2.5秒后自动消失
    setTimeout(() => {
        toast.classList.add('ih-toast-out');
        toast.addEventListener('animationend', () => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        });
    }, 2500);
}

// ====== srcset / 懒加载增强取 URL ======
// 现代站点常把高清档写在 srcset、把真实地址放在 data-* 属性（src 仅为低清占位
// 或 1px 占位图）。下载/扫描前优先取「宽度最大的候选」，避免存下缩略图。

// 常见懒加载库的真实图地址属性（按可信度排序）
const LAZY_SRC_ATTRIBUTES = ['data-src', 'data-original', 'data-lazy-src', 'data-actualsrc', 'data-echo', 'data-url'];

function isValidMediaUrl(url) {
    return !!url && /^(https?:|data:|blob:)/i.test(url.trim());
}

function absolutizeUrl(url, base) {
    try {
        return new URL(url.trim(), base).href;
    } catch {
        return null;
    }
}

// 解析 srcset（含懒加载库常写的 data-srcset），返回宽度/倍率最大的候选；
// 候选无描述符时无从比较，返回 null 交由后续回退处理。
function pickBestFromSrcset(el) {
    const raw = el.getAttribute('srcset') || el.getAttribute('data-srcset');
    if (!raw) return null;
    let best = null;
    for (const part of raw.split(',')) {
        const seg = part.trim().split(/\s+/);
        if (!seg[0]) continue;
        const desc = seg[1] || '';
        let score = -1;
        if (/^\d+w$/i.test(desc)) score = parseFloat(desc);
        else if (/^\d+(\.\d+)?x$/i.test(desc)) score = parseFloat(desc) * 1000; // DPR 档近似映射到宽度区间
        if (score < 0) continue;
        if (!best || score > best.score) best = { url: seg[0], score };
    }
    if (!best) return null;
    return absolutizeUrl(best.url, el.baseURI || window.location.href);
}

// 懒加载属性回退：属性值有效且与 src 不同时优先（src 是占位图）
function pickLazyLoadedUrl(el) {
    const currentSrc = (el.getAttribute('src') || '').trim();
    for (const attr of LAZY_SRC_ATTRIBUTES) {
        const v = el.getAttribute(attr);
        if (isValidMediaUrl(v) && v.trim() !== currentSrc) {
            const abs = absolutizeUrl(v, el.baseURI || window.location.href);
            if (abs) return abs;
        }
    }
    return null;
}

// IMG 的增强取 URL：srcset 最大档 > 懒加载属性 > currentSrc/src
function getEnhancedImageUrl(img) {
    return pickBestFromSrcset(img) || pickLazyLoadedUrl(img) || img.currentSrc || img.src || null;
}

// ====== 扩展上下文失效防护 ======
// 扩展重载/自动更新后，未刷新页面的旧 content script 与 background 的连接已断
// （runtime invalidated）：悬浮按钮等 UI 仍残留在页面上，但下载消息发不出去。
// 此状态下 chrome.runtime.sendMessage 会同步抛错，promise 的 .catch 捕获不到，
// 若不拦截用户只会看到「开始下载」toast 而后静默丢失。
function isExtensionContextValid() {
    return !!(chrome.runtime && chrome.runtime.id);
}

// sendMessage 的安全包装：失效预检 + 同步异常统一转 rejected promise，
// 让调用方的 .catch（红 toast、失败补记）能正常接住。
function sendMessageSafe(message) {
    try {
        if (!isExtensionContextValid()) {
            return Promise.reject(new Error('Extension context invalidated'));
        }
        return chrome.runtime.sendMessage(message);
    } catch (e) {
        return Promise.reject(e);
    }
}

// Download image or video
async function downloadElement(element, pathIndex = -1) {
    // 快照当前按钮引用：异步回调只操作此快照，避免竞态条件
    // （用户可能在下载期间重新悬停图片，downloadButton 已指向新按钮）
    const activeButton = downloadButton;
    const activeButtonHtml = activeButton ? activeButton.innerHTML : '💾';

    // 上下文已失效时明确提示刷新，而非伪装成一次正常下载
    if (!isExtensionContextValid()) {
        showPageToast('toastExtReloaded', 'error');
        return;
    }

    try {
        let elementUrl;
        let defaultExtension = 'jpg';

        // Get element URL based on type
        if (element.tagName === 'IMG') {
            // srcset 最大档 / 懒加载属性优先，避免下到低清占位图
            elementUrl = getEnhancedImageUrl(element);
            defaultExtension = 'jpg';
        } else if (element.tagName === 'VIDEO') {
            // For video elements, try src first, then currentSrc, then first source element
            elementUrl = element.src || element.currentSrc;
            defaultExtension = 'mp4';

            if (!elementUrl) {
                const sources = element.querySelectorAll('source');
                if (sources.length > 0) {
                    elementUrl = sources[0].src;
                }
            }
        }

        // 捕获转换前的原始 URL
        const originalElementUrl = elementUrl;
        let appliedStrategyName = '';

        // 应用 URL 转换策略（同时匹配页面域名和图片 URL 域名）
        if (elementUrl && !elementUrl.startsWith('data:')) {
            const strategy = findMatchingStrategy(window.location.hostname, elementUrl);
            if (strategy) {
                appliedStrategyName = strategy.id || strategy.name || '';
                if (strategy.resolver && strategyResolvers[strategy.resolver]) {
                    // 实验性策略：使用专属 resolver 从 DOM 元数据构造 URL
                    const resolved = await strategyResolvers[strategy.resolver](element);
                    if (resolved) {
                        debug.log('Resolver 构造 URL:', strategy.resolver, '->', resolved);
                        elementUrl = resolved;
                    }
                } else {
                    // 普通策略：使用正则引擎转换 URL
                    const result = transformUrl(elementUrl, strategy);
                    if (result.transformed) {
                        debug.log('URL 已转换:', result.ruleName, elementUrl, '->', result.url);
                        elementUrl = result.url;
                    }
                }
            }
        }

        if (!elementUrl || elementUrl.startsWith('data:')) {
            // Handle data URLs or missing src
            if (elementUrl && elementUrl.startsWith('data:')) {
                // Keep data URL as is
            } else {
                debug.warn('Cannot download element: no valid URL');
                return;
            }
        }

        // Generate filename
        const urlObj = new URL(elementUrl, window.location.href);
        let filename = urlObj.pathname.split('/').pop() || 'media';

        // Strip invalid extensions (like .php) to assign proper media extensions
        const validExtensions = /\.(jpg|jpeg|png|gif|webp|svg|mp4|webm|avi|mov|mkv)$/i;
        if (!validExtensions.test(filename)) {
            // Remove anything after the last dot if it looks like a fake extension
            if (filename.includes('.')) {
                filename = filename.substring(0, filename.lastIndexOf('.'));
            }
            if (!filename) filename = 'media';
            filename += '.' + defaultExtension;
        }

        // 应用命名模板（可选）
        // 模板为空时完全沿用上面构造的 filename，零行为变化
        try {
            // 优先读 sync，回退 local（双写策略）
            let tpl = null;
            try {
                const syncResult = await chrome.storage.sync.get(['ih_filename_template']);
                tpl = syncResult.ih_filename_template;
                if (!tpl) {
                    const localResult = await chrome.storage.local.get(['ih_filename_template']);
                    tpl = localResult.ih_filename_template || null;
                }
            } catch (e) {
                debug.warn('读取命名模板失败', e);
            }

            if (tpl && tpl.trim() && typeof window.IHNaming === 'object') {
                const ctx = window.IHNaming.buildContext({
                    pageUrl: window.location.href,
                    pageTitle: document.title,
                    mediaUrl: elementUrl,
                    defaultExtension,
                    originalUrl: originalElementUrl,
                    strategy: appliedStrategyName,
                    index: pathIndex >= 0 ? pathIndex : null
                });
                const rendered = window.IHNaming.renderTemplate(tpl, ctx);
                if (rendered) filename = rendered;
            }
        } catch (tplErr) {
            debug.warn('命名模板处理失败，降级到默认文件名', tplErr);
        }

        // 下载开始通知（待文件名确定后再提示，可附带原始文件名）
        showPageToast('toastDownloadStart', 'start', filename);

        // Send download request to background script
        chrome.storage.sync.get(['ih_download_mode'], async (result) => {
            const downloadMode = result.ih_download_mode || 'normal';

            // 触发成功反馈：按钮短暂显示 ✅（操作快照引用，防悬停切换竞态）
            const markTriggered = () => {
                if (activeButton && activeButton.parentNode) {
                    activeButton.innerHTML = '✅';
                    setTimeout(() => {
                        if (activeButton && activeButton.parentNode) {
                            activeButton.innerHTML = activeButtonHtml;
                            activeButton.title = 'Save image';
                        }
                    }, 2000);
                }
            };

            // 下载请求失败反馈：页面红色 toast + 通知 background 补记失败记录
            const reportFailure = (finalFilename, err) => {
                showPageToast('toastDownloadFailed', 'error', finalFilename || filename);
                // 上下文失效时此消息同样发不出去，sendMessageSafe 保证不在此处二次抛错
                sendMessageSafe({
                    type: 'record_download_failed',
                    filename: finalFilename || filename,
                    url: (elementUrl && elementUrl.length <= 500) ? elementUrl : '',
                    error: (err && err.message) || String(err || '')
                }).catch(() => {});
            };

            // Helper to download a blob locally
            // 通过 background 的 download_canvas_image 统一下载，而非 <a download>。
            // 原因：<a download> 只能写到浏览器下载根目录，无法携带 pathIndex，
            // 会导致基础保存目录/子保存目录对 WebP→PNG、canvas 提取的场景全部失效。
            // 走 background 才能让 buildDownloadPath() 拼接出正确的子目录路径。
            // canvas 提取/WebP→PNG 的 blob 只能在 content 生成，仍需经消息传输；
            // 大图可能超扩展消息上限，发送失败时明确反馈而非静默丢弃。
            const downloadBlob = (blob, finalFilename) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    // canvas/WebP 转换是异步的，到达此处时上下文可能已失效
                    // （转换期间扩展被重载），sendMessageSafe 统一转成可 catch 的失败
                    sendMessageSafe({
                        type: 'download_canvas_image',
                        dataUrl: reader.result,
                        filename: finalFilename,
                        pathIndex: pathIndex
                    }).then(markTriggered).catch((err) => {
                        debug.error('Blob 下载消息发送失败:', err);
                        if (!isExtensionContextValid()) {
                            showPageToast('toastExtReloaded', 'error');
                        } else {
                            reportFailure(finalFilename, err);
                        }
                    });
                };
                reader.readAsDataURL(blob);
            };

            // === CANVAS 模式优先：canvas 模式意图是"强制 canvas 重编码"（绕过限制性站点、
            // 统一转 PNG、丢 EXIF），与直接下载的"保留原始格式"目的相反。
            // canvas 模式下先走提取，失败再回退到 background 统一下载。
            if (downloadMode === 'canvas') {
                try {
                    const canvasBlob = await extractImageToCanvas(element);
                    if (canvasBlob) {
                        debug.log('Canvas extraction succeeded, downloading re-encoded blob');
                        downloadBlob(canvasBlob, filename);
                        return;
                    }
                    debug.warn('Canvas extraction returned empty, falling back to background download');
                } catch (e) {
                    debug.warn('Canvas extraction failed, falling back to background download', e);
                }
            }

            // === WebP→PNG 转换（在 content 完成，blob 经 downloadBlob 传输）
            // 注：仅按 URL 特征检测；URL 不含 webp 字样但响应实为 WebP 的图不再转换，
            // 由 background 按 Content-Type 将扩展名修正为 .webp 原样保存。
            if (convertWebpToPng && elementUrl && !elementUrl.startsWith('data:') &&
                elementUrl.toLowerCase().includes('webp')) {
                debug.log('WebP detected and conversion enabled');
                try {
                    const pngBlob = await convertWebpImageToPng(element);
                    if (pngBlob) {
                        let pngFilename = filename.replace(/\.(webp|WEBP)$/i, '.png');
                        if (!pngFilename.endsWith('.png')) {
                            pngFilename = pngFilename.replace(/\.[^.]+$/, '.png');
                        }
                        downloadBlob(pngBlob, pngFilename);
                        return;
                    }
                } catch (e) {
                    debug.warn('WebP conversion failed, falling back', e);
                }
            }

            // === 统一走 background 下载（SW fetch 无 CORS 限制、DNR referer 规则生效、
            // 按 Content-Type 修正扩展名）。原 content fast path（页面内 fetch →
            // FileReader base64 → sendMessage 巨型消息）已移除：大图消息易超扩展
            // 消息上限且失败静默，是"大图连续下载偶发丢失"的根因；大图内容现在
            // 全程留在 SW 内处理，不经过扩展消息通道。
            sendMessageSafe({
                type: 'download_image',
                url: elementUrl,
                filename: filename,
                downloadMode: downloadMode,
                pathIndex: pathIndex
            }).then(markTriggered).catch((err) => {
                debug.error('Download request failed:', err);
                if (!isExtensionContextValid()) {
                    showPageToast('toastExtReloaded', 'error');
                } else {
                    reportFailure(filename, err);
                }
            });
        });

    } catch (error) {
        debug.error('Error downloading element:', error);
        // 异步准备阶段（URL 转换/命名模板）期间扩展被重载：入口检查已错过，
        // 在此兜底提示，避免只留下「开始下载」toast 的静默丢失
        if (!isExtensionContextValid()) {
            showPageToast('toastExtReloaded', 'error');
        }
    }
}

// Check if element is suitable for download (image or video)
function isDownloadableElement(element) {
    // Skip very small elements (likely icons or decorative)
    const rect = element.getBoundingClientRect();
    if (rect.width < minImageSize || rect.height < minImageSize) {
        return false;
    }

    // For IMG elements
    if (element.tagName === 'IMG') {
        if (!element.src || element.src === '' || element.src === window.location.href) {
            return false;
        }
    }

    // For VIDEO elements
    if (element.tagName === 'VIDEO') {
        if (!element.src && !element.currentSrc) {
            // Check if there are source elements
            const sources = element.querySelectorAll('source');
            if (sources.length === 0) {
                return false;
            }
        }
    }

    return true;
}

// Get all images on the page based on settings
function getAllImages(settings = {}) {
    const images = [];
    const detectImgLocal = settings.detectImg !== false; // Default: true
    const detectSvgLocal = settings.detectSvg === true; // Default: false
    const detectBackgroundLocal = settings.detectBackground === true; // Default: false
    const detectVideoLocal = settings.detectVideo === true; // Default: false
    const allowedExtensions = settings.allowedExtensions || CONFIG.DEFAULT_EXTENSIONS;

    // Helper function to check if URL has allowed extension
    function hasAllowedExtension(url) {
        if (!url) return false;
        try {
            const pathname = new URL(url, window.location.href).pathname.toLowerCase();
            return allowedExtensions.some(ext => pathname.includes('.' + ext.toLowerCase()));
        } catch {
            return false;
        }
    }

    // 1. Regular IMG elements
    if (detectImgLocal) {
        const imgElements = document.querySelectorAll('img');
        imgElements.forEach(img => {
            // 与单图下载同源：srcset 最大档 / 懒加载属性优先
            const url = getEnhancedImageUrl(img);
            if (url && hasAllowedExtension(url)) {
                const rect = img.getBoundingClientRect();
                if (rect.width >= minImageSize && rect.height >= minImageSize) {
                    images.push({
                        url: url,
                        type: 'img',
                        alt: img.alt || '',
                        width: rect.width,
                        height: rect.height
                    });
                }
            }
        });
    }

    // 2. SVG elements
    if (detectSvgLocal) {
        const svgElements = document.querySelectorAll('svg');
        svgElements.forEach(svg => {
            const rect = svg.getBoundingClientRect();
            if (rect.width >= minImageSize && rect.height >= minImageSize) {
                // Convert SVG to data URL
                try {
                    const serializer = new XMLSerializer();
                    const svgStr = serializer.serializeToString(svg);
                    const svgBase64 = btoa(unescape(encodeURIComponent(svgStr)));
                    const dataUrl = 'data:image/svg+xml;base64,' + svgBase64;
                    images.push({
                        url: dataUrl,
                        type: 'svg',
                        alt: svg.getAttribute('title') || svg.getAttribute('aria-label') || '',
                        width: rect.width,
                        height: rect.height
                    });
                } catch (error) {
                    debug.warn('Failed to serialize SVG:', error);
                }
            }
        });
    }

    // 3. Background images
    if (detectBackgroundLocal) {
        const allElements = document.querySelectorAll('*');
        allElements.forEach(element => {
            const style = window.getComputedStyle(element);
            const bgImage = style.backgroundImage;

            if (bgImage && bgImage !== 'none') {
                const matches = bgImage.match(/url\(['"]?([^'"]+)['"]?\)/);
                if (matches && matches[1]) {
                    const url = matches[1];
                    if (hasAllowedExtension(url)) {
                        const rect = element.getBoundingClientRect();
                        if (rect.width >= minImageSize && rect.height >= minImageSize) {
                            images.push({
                                url: url,
                                type: 'background',
                                alt: element.getAttribute('title') || element.getAttribute('alt') || '',
                                width: rect.width,
                                height: rect.height
                            });
                        }
                    }
                }
            }
        });
    }

    // 4. Video elements
    if (detectVideoLocal) {
        const videoElements = document.querySelectorAll('video');
        videoElements.forEach(video => {
            let videoUrl = video.src || video.currentSrc;

            // If no direct src, check source elements
            if (!videoUrl) {
                const sources = video.querySelectorAll('source');
                if (sources.length > 0) {
                    videoUrl = sources[0].src;
                }
            }

            if (videoUrl && hasAllowedExtension(videoUrl)) {
                const rect = video.getBoundingClientRect();
                if (rect.width >= minImageSize && rect.height >= minImageSize) {
                    images.push({
                        url: videoUrl,
                        type: 'video',
                        alt: video.getAttribute('title') || video.getAttribute('alt') || '',
                        width: rect.width,
                        height: rect.height
                    });
                }
            }
        });
    }

    // Remove duplicates based on URL
    const uniqueImages = [];
    const seen = new Set();
    images.forEach(img => {
        if (!seen.has(img.url)) {
            seen.add(img.url);
            uniqueImages.push(img);
        }
    });

    return uniqueImages;
}
