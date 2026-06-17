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

function showPageToast(messageKey, type = 'start') {
    const container = getToastContainer();
    const toast = document.createElement('div');
    toast.className = `ih-toast ih-toast-${type}`;

    // 内置翻译表，支持 popup 中用户选择的语言
    const translations = {
        en: { toastDownloadStart: 'Downloading', toastDownloadComplete: 'Downloaded' },
        zh_CN: { toastDownloadStart: '开始下载', toastDownloadComplete: '下载完成' }
    };

    // 根据用户语言偏好获取文本
    const locale = contentLocale || 'en';
    const table = translations[locale] || translations.en;
    const text = table[messageKey] || translations.en[messageKey] || messageKey;

    toast.innerHTML = `<span class="ih-toast-text">${text}</span>`;
    container.appendChild(toast);

    // 2.5秒后自动消失
    setTimeout(() => {
        toast.classList.add('ih-toast-out');
        toast.addEventListener('animationend', () => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        });
    }, 2500);
}

// Download image or video
async function downloadElement(element, pathIndex = -1) {
    // 下载开始通知
    showPageToast('toastDownloadStart', 'start');

    // 快照当前按钮引用：异步回调只操作此快照，避免竞态条件
    // （用户可能在下载期间重新悬停图片，downloadButton 已指向新按钮）
    const activeButton = downloadButton;
    const activeButtonHtml = activeButton ? activeButton.innerHTML : '💾';

    try {
        let elementUrl;
        let defaultExtension = 'jpg';

        // Get element URL based on type
        if (element.tagName === 'IMG') {
            elementUrl = element.src;
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

        // Send download request to background script
        chrome.storage.sync.get(['ih_download_mode'], async (result) => {
            const downloadMode = result.ih_download_mode || 'normal';

            // Helper to download a blob locally
            // 通过 background 的 download_canvas_image 统一下载，而非 <a download>。
            // 原因：<a download> 只能写到浏览器下载根目录，无法携带 pathIndex，
            // 会导致基础保存目录/子保存目录对 WebP→PNG、canvas 提取的场景全部失效。
            // 走 background 才能让 buildDownloadPath() 拼接出正确的子目录路径。
            const downloadBlob = (blob, finalFilename) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    chrome.runtime.sendMessage({
                        type: 'download_canvas_image',
                        dataUrl: reader.result,
                        filename: finalFilename,
                        pathIndex: pathIndex
                    }).catch(() => {});
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
                reader.readAsDataURL(blob);
            };

            // === CANVAS 模式优先：canvas 模式意图是"强制 canvas 重编码"（绕过限制性站点、
            // 统一转 PNG、丢 EXIF），与 fast path 的"保留原始格式"目的相反。
            // 原实现把 canvas 提取放在 fast path 之后，导致 fast path 成功即 return，
            // canvas 模式被架空、名不副实（下载到的还是原图原样）。
            // 现将 canvas 提取提前：canvas 模式下先走提取，失败再回退到 fast path 等。
            if (downloadMode === 'canvas') {
                try {
                    const canvasBlob = await extractImageToCanvas(element);
                    if (canvasBlob) {
                        debug.log('Canvas extraction succeeded, downloading re-encoded blob');
                        downloadBlob(canvasBlob, filename);
                        return;
                    }
                    debug.warn('Canvas extraction returned empty, falling back to fast path');
                } catch (e) {
                    debug.warn('Canvas extraction failed, falling back to fast path', e);
                }
            }

            // === FAST PATH: Try fetch first to preserve original format ===
            // This gets the image in its original format (JPEG stays JPEG, GIF keeps animation, EXIF preserved)
            // Falls back gracefully to normal download on CORS/network errors
            if (!elementUrl.startsWith('data:')) {
                try {
                    debug.log('Fast path: attempting fetch for original format');
                    const fetchResponse = await fetch(elementUrl);
                    if (fetchResponse.ok) {
                        const fetchedBlob = await fetchResponse.blob();
                        if (fetchedBlob && fetchedBlob.size > 0) {
                            // Try to derive correct extension from Content-Type or URL
                            let fastFilename = filename;
                            const contentType = fetchResponse.headers.get('Content-Type') || '';
                            const typeMap = {
                                'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif',
                                'image/webp': '.webp', 'image/svg+xml': '.svg', 'image/bmp': '.bmp',
                                'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov'
                            };

                            // Use Content-Type extension if available and different from current filename extension
                            if (contentType && typeMap[contentType]) {
                                const correctExt = typeMap[contentType];
                                // Only replace extension if filename doesn't already end with an equivalent one
                                const currentExt = '.' + filename.split('.').pop().toLowerCase();
                                const equivExts = { '.jpg': ['.jpeg'], '.jpeg': ['.jpg'] };
                                const allowedEquivs = equivExts[currentExt] || [];
                                if (currentExt !== correctExt.toLowerCase() && !allowedEquivs.includes(correctExt.toLowerCase())) {
                                    fastFilename = filename.replace(/\.[^.]+$/, correctExt);
                                }
                            }

                            debug.log('Fast path success: got blob', fetchedBlob.type, 'size:', fetchedBlob.size, 'as', fastFilename);

                            // WebP→PNG 转换必须在此处拦截：fast path 成功后会 return，
                            // 若不在此拦截，下方第 258 行的转换逻辑永远到不了，开关形同虚设。
                            if (convertWebpToPng &&
                                (contentType === 'image/webp' ||
                                 elementUrl.toLowerCase().includes('.webp') ||
                                 elementUrl.toLowerCase().includes('webp'))) {
                                debug.log('WebP detected and conversion enabled (fast path)');
                                try {
                                    const pngBlob = await convertWebpImageToPng(element);
                                    if (pngBlob) {
                                        let pngFilename = fastFilename.replace(/\.(webp|WEBP)$/i, '.png');
                                        if (!pngFilename.endsWith('.png')) {
                                            pngFilename = pngFilename.replace(/\.[^.]+$/, '.png');
                                        }
                                        downloadBlob(pngBlob, pngFilename);
                                        return;
                                    }
                                } catch (e) {
                                    debug.warn('WebP conversion failed (fast path), falling back to original webp', e);
                                }
                            }

                            // Send blob to background script for download with correct path
                            // (background uses chrome.downloads.download which respects configured subfolder/pathIndex)
                            const reader = new FileReader();
                            reader.onloadend = () => {
                                chrome.runtime.sendMessage({
                                    type: 'download_canvas_image',
                                    dataUrl: reader.result,
                                    filename: fastFilename,
                                    pathIndex: pathIndex
                                });
                            };
                            reader.readAsDataURL(fetchedBlob);

                            if (activeButton && activeButton.parentNode) {
                                activeButton.innerHTML = '✅';
                                setTimeout(() => {
                                    if (activeButton && activeButton.parentNode) {
                                        activeButton.innerHTML = activeButtonHtml;
                                        activeButton.title = 'Save image';
                                    }
                                }, 2000);
                            }
                            return;
                        }
                    } else {
                        debug.log('Fast path: fetch returned status', fetchResponse.status, '- will fallback');
                    }
                } catch (fetchErr) {
                    // CORS error or network failure — silently fall back to normal download
                    debug.log('Fast path failed (likely CORS):', fetchErr.message || fetchErr, '- falling back');
                }
            }

            // Check if we should convert WebP to PNG
            if (convertWebpToPng && elementUrl &&
                (elementUrl.toLowerCase().includes('.webp') || elementUrl.toLowerCase().includes('webp'))) {
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

            // Final fallback: Normal background download
            chrome.runtime.sendMessage({
                type: 'download_image',
                url: elementUrl,
                filename: filename,
                downloadMode: downloadMode,
                pathIndex: pathIndex
            }).catch(() => {});
        });

    } catch (error) {
        debug.error('Error downloading element:', error);
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
            if (img.src && hasAllowedExtension(img.src)) {
                const rect = img.getBoundingClientRect();
                if (rect.width >= minImageSize && rect.height >= minImageSize) {
                    images.push({
                        url: img.src,
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
