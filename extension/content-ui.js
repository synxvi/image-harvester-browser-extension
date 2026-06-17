// Image Harvester - Content UI (download button lifecycle + domain exclusion)
// Copyright (c) Jaewoo Jeon (@thejjw) and Image Harvester Contributors
// SPDX-License-Identifier: zlib-acknowledgement
//
// Depends on content-core.js, content-download.js.
// Uses: debug, storage, currentImage, downloadButton, isMouseOverButton,
//       imageResizeObserver, imageMutationObserver, multiPathEnabled, multiPaths,
//       currentDownloadMode, buttonSize, toolbarSpacing, buttonPosition,
//       isDomainExcluded, activeStrategy, downloadElement, hideDownloadButton.

// Create download button element
function createDownloadButton() {
    const button = document.createElement('div');
    button.className = 'ih-download-btn';
    button.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v12M5 12l7 7 7-7"/></svg>';
    button.title = activeStrategy ? `Save image (via ${activeStrategy.name})` : 'Save image';

    // 应用动态按钮大小
    button.style.width = buttonSize + 'px';
    button.style.height = buttonSize + 'px';
    button.style.fontSize = Math.round(buttonSize * 0.5) + 'px';

    button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (currentImage) {
            downloadElement(currentImage);
        }
        hideDownloadButton();
    });

    return button;
}

// Create multi-path download toolbar (vertical button strip)
function createDownloadToolbar(img) {
    const container = document.createElement('div');
    container.className = 'ih-download-toolbar';

    const activePaths = multiPaths.filter(p => p.enabled !== false);

    activePaths.forEach((pathConfig, displayIndex) => {
        const btn = document.createElement('div');
        btn.className = 'ih-toolbar-btn';

        // 应用动态按钮大小和间距
        const scale = buttonSize / 26; // 基准值 26px
        btn.style.padding = Math.round(5 * scale) + 'px ' + Math.round(10 * scale) + 'px';
        btn.style.fontSize = Math.round(11 * scale) + 'px';
        btn.style.borderRadius = Math.round(10 * scale) + 'px';
        if (displayIndex < activePaths.length - 1) {
            btn.style.marginBottom = toolbarSpacing + 'px';
        }

        // Use name (e.g. "📷 相册") or fallback to path folder
        const label = pathConfig.name || pathConfig.path || ('Path ' + (displayIndex + 1));
        btn.textContent = label;
        btn.title = `Save to ${pathConfig.path || 'downloads'}/`;

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (currentImage) {
                // Find the actual index in full multiPaths array (not filtered)
                const actualIndex = multiPaths.findIndex(p =>
                    p.name === pathConfig.name && p.path === pathConfig.path);
                downloadElement(currentImage, actualIndex >= 0 ? actualIndex : displayIndex);
            }
            hideDownloadButton();
        });

        container.appendChild(btn);
    });

    return container;
}

// Position download button/toolbar relative to image (fixed to viewport)
function positionButton(img, button) {
    const rect = img.getBoundingClientRect();

    // clientWidth 不含滚动条宽度，与 position:fixed 定位参考一致
    // window.innerWidth 包含滚动条，会导致按钮偏左（Windows 上约 17px）
    const vpRight = document.documentElement.clientWidth;

    button.style.position = 'fixed';
    const GAP = 8;

    if (buttonPosition === 'top-left') {
        button.style.left = (rect.left + GAP) + 'px';
        button.style.right = 'auto';
    } else {
        // 默认右上角
        button.style.right = (vpRight - rect.right + GAP) + 'px';
        button.style.left = 'auto';
    }
    button.style.top = (rect.top + GAP) + 'px';
}

// 图片 load 事件处理：src 变更后新图加载完成时重定位按钮
function handleImageLoad() {
    if (!currentImage) return;
    const rect = currentImage.getBoundingClientRect();
    // 图片不可见（被隐藏/折叠），直接隐藏按钮
    if (rect.width < 5 || rect.height < 5) {
        hideDownloadButton();
        return;
    }
    if (downloadButton && downloadButton.parentNode) {
        positionButton(currentImage, downloadButton);
    }
}

// 为当前悬停图片挂载尺寸/src 变化观察器
function attachImageObservers(img) {
    // 安全：先卸载可能残留的旧观察器
    detachImageObservers();

    // 通用守卫：检查图片是否仍然可见且足够大
    // 处理以下场景：元素被隐藏（display:none）、折叠为 0x0、或从 DOM 移除
    const checkImageStillVisible = () => {
        if (!document.contains(img)) return false;
        const rect = img.getBoundingClientRect();
        return rect.width >= 5 && rect.height >= 5;
    };

    // ResizeObserver：监听元素尺寸变化（缩略图↔大图切换、CSS 动画等）
    imageResizeObserver = new ResizeObserver(() => {
        if (!checkImageStillVisible()) {
            hideDownloadButton();
            return;
        }
        if (currentImage && downloadButton && downloadButton.parentNode) {
            positionButton(currentImage, downloadButton);
        }
    });
    imageResizeObserver.observe(img);

    // MutationObserver：监听 src 属性变化
    imageMutationObserver = new MutationObserver(() => {
        if (!checkImageStillVisible()) {
            hideDownloadButton();
            return;
        }
        if (currentImage && downloadButton && downloadButton.parentNode) {
            // 立即重定位
            positionButton(currentImage, downloadButton);
            // 下一帧再定位一次，捕获布局更新后的位置
            requestAnimationFrame(() => {
                if (currentImage && downloadButton && downloadButton.parentNode) {
                    positionButton(currentImage, downloadButton);
                }
            });
        }
    });
    imageMutationObserver.observe(img, { attributes: true, attributeFilter: ['src'] });

    // load 事件：新图数据加载完成后再次定位
    img.addEventListener('load', handleImageLoad);
}

// 卸载所有图片观察器
function detachImageObservers() {
    if (imageResizeObserver) {
        imageResizeObserver.disconnect();
        imageResizeObserver = null;
    }
    if (imageMutationObserver) {
        imageMutationObserver.disconnect();
        imageMutationObserver = null;
    }
    if (currentImage) {
        currentImage.removeEventListener('load', handleImageLoad);
    }
}

// Show download button (or multi-path toolbar if enabled)
function showDownloadButton(img) {
    // If button already exists for the same image, just reposition — skip costly destroy/recreate
    if (downloadButton && currentImage === img && downloadButton.parentNode) {
        positionButton(img, downloadButton);
        return;
    }

    // Destroy old button/toolbar only when switching to a different image or first show.
    // 传入新图作为 halo 保留目标：切图时 halo 可能已亮在新图上（glow 500ms < hover 1000ms），
    // 不能误清；其余调用方不传此参数，按钮销毁即同步清理 halo，避免浮层泄漏。
    hideDownloadButton(img);

    const activePaths = multiPaths.filter(p => p.enabled !== false);

    // Decide: toolbar or single button?
    // Conditions: multi-path enabled + at least 2 active paths.
    // 不再限制下载模式：canvas 提取已统一走 background 的 download_canvas_image，
    // 与 normal 模式共用 buildDownloadPath() 路径逻辑，多路径对两种模式同样生效。
    const useToolbar = (
        multiPathEnabled &&
        activePaths.length >= 2
    );

    if (useToolbar) {
        downloadButton = createDownloadToolbar(img);
    } else {
        downloadButton = createDownloadButton();
    }

    document.body.appendChild(downloadButton);
    positionButton(img, downloadButton);
    downloadButton.style.display = downloadButton.classList.contains('ih-download-toolbar') ? 'block' : 'flex';
    currentImage = img;

    // 挂载观察器：跟踪图片尺寸/src 变化，实现按钮平滑跟随
    attachImageObservers(img);
}

// Hide download button/toolbar
// preserveHaloTarget: 若 halo 当前正指向该目标则保留（用于 showDownloadButton 切图场景），
//                     其余场景不传 → 按钮销毁时同步清理 halo，防止浮层在图片被移除/隐藏后残留发光。
function hideDownloadButton(preserveHaloTarget) {
    detachImageObservers();
    if (!(preserveHaloTarget && haloTarget === preserveHaloTarget)) {
        destroyHaloOverlay();
    }
    if (downloadButton) {
        // Remove from DOM to prevent leaks when switching between button and toolbar
        if (downloadButton.parentNode) {
            downloadButton.parentNode.removeChild(downloadButton);
        }
        downloadButton = null;
    }
    currentImage = null;
    // 按钮被移除时 mouseleave 不会触发，必须重置守卫标志
    // 否则下次新按钮创建后，隐藏定时器会被残留的 isMouseOverButton=true 拦截
    isMouseOverButton = false;
}

// Domain exclusion checking
function isCurrentDomainExcluded(exclusions) {
    if (!exclusions || !Array.isArray(exclusions)) {
        return false;
    }

    const currentHostname = window.location.hostname.toLowerCase();

    for (const exclusion of exclusions) {
        const excludeDomain = exclusion.toLowerCase();

        // Exact match
        if (currentHostname === excludeDomain) {
            return true;
        }

        // Subdomain match - check if current domain ends with "." + exclude domain
        if (currentHostname.endsWith('.' + excludeDomain)) {
            return true;
        }
    }

    return false;
}

// Check if extension should run on current domain
async function checkDomainExclusion() {
    try {
        const exclusions = await storage.get('ih_domain_exclusions');
        const wasExcluded = isDomainExcluded;
        isDomainExcluded = isCurrentDomainExcluded(exclusions);
        debug.log('Domain exclusion check:', window.location.hostname, isDomainExcluded);

        // Notify background script if exclusion status changed (top frame only)
        if (wasExcluded !== isDomainExcluded && window === window.top) {
            chrome.runtime.sendMessage({
                type: 'ih:domain_status_changed',
                excluded: isDomainExcluded
            }).catch(() => {});
        }
    } catch (error) {
        debug.warn('Failed to check domain exclusions:', error);
        isDomainExcluded = false;
    }
}
