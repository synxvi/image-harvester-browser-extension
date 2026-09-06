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
// 返回是否成功定位：目标矩形退化（宽高 <1px，display:none / 未布局 / scale(0)）
// 时拒绝更新并返回 false，按钮保持上一帧位置。此类退化矩形多出现在查看器
// reparent/clone 图片节点的空档帧，若照常应用，按钮会被甩到视口原点闪现。
// （halo 的 positionHaloOverlay 有同款守卫。）
function positionButton(img, button) {
    const rect = img.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) {
        return false;
    }

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
    return true;
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
    // 新图加载完成后尺寸才会最终确定（尤其无显式宽高、靠自然尺寸的图片），
    // 此时同步重定位 halo，避免高光框停留在加载前的小尺寸。
    if (haloTarget === currentImage) {
        positionHaloOverlay();
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
        // 视觉反馈浮层与按钮共享同一目标：按钮定位时同步重定位 halo，
        // 避免出现「按钮已跟随到大图、高光框仍停留在小图尺寸」的视觉不一致。
        // （halo 自身也有 ResizeObserver，但按钮的回调时机更早/更可靠。）
        if (haloTarget === img) {
            positionHaloOverlay();
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
        // src 变化（如缩略图 WebP → 大图 JPG）时同步重定位 halo
        if (haloTarget === img) {
            positionHaloOverlay();
            requestAnimationFrame(positionHaloOverlay);
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

    // 切图前快照：视觉反馈是否处于激活状态（用户此前 hover 已亮起 halo）。
    // glowDelay(500) < hoverDelay(1000)，切到新图时 halo 可能还停在旧图上，
    // 需在按钮切换到新图后立即把 halo 也迁移过去，避免「按钮跟随大图、高光框停在旧小图」。
    const haloWasActive = (borderHighlightMode !== 'off') && haloOverlay && haloTarget;

    // Destroy old button/toolbar only when switching to a different image or first show.
    // 传入新图作为 halo 保留目标：切图时 halo 可能已亮在新图上（glow 500ms < hover 1000ms），
    // 不能误清；其余调用方不传此参数，按钮销毁即同步清理 halo，避免浮层泄漏。
    // 第二参数 true = 重建场景立即移除旧按钮（无淡出）：新旧按钮位置相同时，
    // 「淡出 + 新建淡入」会造成按钮轻微闪烁（用户实测查看器落位后的残影感）。
    hideDownloadButton(img, true);

    const activePaths = multiPaths.filter(p => p.enabled !== false);

    // 是否为「重建」：之前已有按钮在显示（区别于隐藏后的首次出现）。
    // 重建场景新按钮跳过淡入动画：与刚被立即移除的旧按钮位置相同/接近时，
    // 视觉上无级替换，消除查看器落位后「轻微闪烁一下」的残影感。
    const wasShowing = !!(downloadButton && downloadButton.parentNode);

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

    // 先定位再入 DOM：目标矩形退化（尚未布局/刚被隐藏，罕见——事件命中的元素
    // 通常已有尺寸）时放弃本次显示。若先 append，按钮会以 CSS 默认位置
    // （视口右上角）闪现一帧；放弃后用户下一次鼠标动作会重新走完整流程。
    if (!positionButton(img, downloadButton)) {
        downloadButton = null;
        return;
    }
    document.body.appendChild(downloadButton);
    if (wasShowing) {
        downloadButton.style.animation = 'none';
    }
    downloadButton.style.display = downloadButton.classList.contains('ih-download-toolbar') ? 'block' : 'flex';
    currentImage = img;

    // 点击上下文窗口内的显示/重建（查看器 clone/替换了图片节点）：以新节点重启
    // rAF 逐帧跟随，按钮继续钉在图片左上角跟飞，不依赖 ResizeObserver（感知不到
    // transform 动画的每帧插值），也不再等下一次事件才「跳」到新位置。
    if (postClickContext
        && performance.now() - postClickContext.time < POST_CLICK_CONTEXT_MS) {
        startPostClickFollow();
    }

    // 切图同步迁移 halo：若切换前 halo 已激活（且尚未指向新图），
    // 立即在新图上重建，使其与下载按钮同目标、同尺寸。
    if (haloWasActive && haloTarget !== img) {
        toggleBorderHighlight(img, true);
    }

    // 挂载观察器：跟踪图片尺寸/src 变化，实现按钮平滑跟随
    attachImageObservers(img);
}

// ===== 点击后按钮逐帧跟随（rAF 循环） =====
// 查看器的打开/缩放动画是 transform 变换：ResizeObserver/MutationObserver 都
// 感知不到（监听的是 content-box 与属性，不含 transform 的每帧插值），按钮会
// 卡在旧位置、动画结束后才「跳」到新位置。点击后启动本循环，每帧把按钮钉在
// currentImage 的左上角，视觉上按钮随大图一起飞、动画结束即落位。
let postClickFollowRAF = null;

function stopPostClickFollow() {
    if (postClickFollowRAF) {
        cancelAnimationFrame(postClickFollowRAF);
        postClickFollowRAF = null;
    }
}

function startPostClickFollow() {
    stopPostClickFollow();
    const start = performance.now();
    // 帧间瞬跳守卫：查看器 reparent/clone 图片节点的一两帧空档里，目标矩形会
    // 瞬跳到过渡位置（常见特征：跳到视口原点 (0,0)，fixed 容器尚未应用 transform，
    // 或节点被隐藏后退化全 0）。若照常应用，按钮会被甩到网页左上角闪现一帧。
    // 判据（满足其一即跳过本帧应用，仅记录，动画恢复连续后自动回轨）：
    //   ① 中心点单帧位移超过视口对角线 1/8（1080p ≈275px，远大于常见查看器
    //      动画的单帧插值位移，小于跨屏瞬跳距离）；
    //   ② 矩形吸附到视口原点而上一帧不在原点（空档帧的典型形态；图片本身
    //      合法位于左上角时连续帧都在原点，不会被拦）。
    const maxFrameJump = Math.hypot(window.innerWidth, window.innerHeight) / 8;
    let lastRect = null;
    const tick = () => {
        // 按钮已销毁/目标已切换/上下文窗口结束 → 停止（之后由常规观察器接管）
        if (!currentImage || !downloadButton || !downloadButton.parentNode
            || performance.now() - start > POST_CLICK_CONTEXT_MS) {
            postClickFollowRAF = null;
            return;
        }
        const rect = currentImage.getBoundingClientRect();
        const atOrigin = rect.left < 1 && rect.top < 1;
        const jumped = !!lastRect && (
            Math.hypot(
                (rect.left + rect.width / 2) - (lastRect.left + lastRect.width / 2),
                (rect.top + rect.height / 2) - (lastRect.top + lastRect.height / 2)
            ) > maxFrameJump
            || (atOrigin && !(lastRect.left < 1 && lastRect.top < 1))
        );
        if (!jumped) {
            positionButton(currentImage, downloadButton);
            if (haloTarget === currentImage) {
                positionHaloOverlay();
            }
        }
        lastRect = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
        postClickFollowRAF = requestAnimationFrame(tick);
    };
    postClickFollowRAF = requestAnimationFrame(tick);
}

// Hide download button/toolbar
// preserveHaloTarget: 若 halo 当前正指向该目标则保留（用于 showDownloadButton 切图场景），
//                     其余场景不传 → 按钮销毁时同步清理 halo，防止浮层在图片被移除/隐藏后残留发光。
function hideDownloadButton(preserveHaloTarget, immediate) {
    stopPostClickFollow();
    detachImageObservers();
    if (!(preserveHaloTarget && haloTarget === preserveHaloTarget)) {
        destroyHaloOverlay();
    }
    if (downloadButton) {
        // 淡出后再移除（0.12s，与 content.css 的 ih-btn-fade-out 同步），显隐更柔和。
        // pointer-events 立即关闭：淡出期间不再响应 hover/点击（其引用已无效，
        // 且避免残影期误触 isMouseOverButton 守卫）。局部引用持有节点，
        // downloadButton 立即置 null，后续 show 不受淡出过程影响。
        // immediate=true（重建场景）跳过淡出直接移除，避免同位置淡出+淡入的闪烁。
        const fadingBtn = downloadButton;
        if (fadingBtn.parentNode) {
            if (immediate) {
                fadingBtn.parentNode.removeChild(fadingBtn);
            } else {
                fadingBtn.style.pointerEvents = 'none';
                // inline 指定动画：可能覆盖创建时设置的 animation='none'（重建场景）
                fadingBtn.style.animation = 'ih-btn-fade-out 0.12s ease-in forwards';
                setTimeout(() => {
                    if (fadingBtn.parentNode) {
                        fadingBtn.parentNode.removeChild(fadingBtn);
                    }
                }, 120);
            }
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
