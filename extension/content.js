// Image Harvester - Content Script (entry + orchestration)
// Copyright (c) Jaewoo Jeon (@thejjw) and Image Harvester Contributors
// SPDX-License-Identifier: zlib-acknowledgement
//
// This file MUST load LAST in the manifest content_scripts js array, after:
//   naming.js, content-core.js, content-strategies.js, content-image-processing.js,
//   content-download.js, content-ui.js
// It contains: settings init, message routing, hover handlers, storage listener,
// global event wiring, and the init calls. All shared state lives in content-core.js.

// Initialize extension settings
async function initializeExtension() {
    try {
        const enabled = await storage.get('ih_enabled');
        const delay = await storage.get('ih_hover_delay');
        const glowDelaySetting = await storage.get('ih_glow_delay');
        const minSize = await storage.get('ih_min_image_size');
        const imgDetect = await storage.get('ih_detect_img');
        const videoDetect = await storage.get('ih_detect_video');
        const svgDetect = await storage.get('ih_detect_svg');
        const bgDetect = await storage.get('ih_detect_background');
        const webpToPngConvert = await storage.get('ih_convert_webp_to_png');
        const borderHighlight = await storage.get('ih_border_highlight_mode');
        const longHideDelaySetting = await storage.get('ih_long_hide_delay');
        const multiPathEnabledSetting = await storage.get('ih_multi_path_enabled');
        const multiPathsSetting = await storage.get('ih_multi_paths');
        const downloadModeSetting = await storage.get('ih_download_mode');

        // 交互设置
        const buttonSizeSetting = await storage.get('ih_button_size');
        const toolbarSpacingSetting = await storage.get('ih_toolbar_spacing');

        // 加载 URL 转换策略（合并内置预设，确保新预设自动补充）
        const strategiesSetting = await storage.get('ih_url_strategies');
        urlStrategies = mergeStrategiesWithPresets(strategiesSetting);
        // 如果合并后有新增预设，写回 storage 供策略管理页同步
        if (Array.isArray(strategiesSetting) && urlStrategies.length > strategiesSetting.length) {
            chrome.storage.sync.set({ ih_url_strategies: urlStrategies });
        }
        activeStrategy = findMatchingStrategy(window.location.hostname);

        // 加载用户语言偏好
        const savedLang = await storage.get('ih_ui_language');
        if (savedLang && savedLang !== 'auto') {
            contentLocale = savedLang;
        } else {
            try {
                const lang = navigator.language || 'en';
                contentLocale = lang.startsWith('zh') ? 'zh_CN' : 'en';
            } catch (e) {
                contentLocale = 'en';
            }
        }

        isEnabled = enabled !== false; // Default to true
        hoverDelay = delay || CONFIG.DEFAULT_HOVER_DELAY;
        glowDelay = glowDelaySetting != null ? glowDelaySetting : CONFIG.DEFAULT_GLOW_DELAY;
        minImageSize = minSize || CONFIG.MIN_IMAGE_SIZE;
        detectImg = imgDetect !== false; // Default: true
        detectVideo = videoDetect === true; // Default: false
        borderHighlightMode = borderHighlight || CONFIG.DEFAULT_BORDER_HIGHLIGHT;
        detectSvg = svgDetect === true; // Default: false
        detectBackground = bgDetect === true; // Default: false
        convertWebpToPng = webpToPngConvert === true; // Default: false
        longHideDelay = longHideDelaySetting === true; // Default: false
        multiPathEnabled = multiPathEnabledSetting === true; // Default: false
        multiPaths = (Array.isArray(multiPathsSetting) ? multiPathsSetting : []).filter(p => p.enabled !== false);
        currentDownloadMode = downloadModeSetting || 'normal';

        // 交互设置赋值
        buttonSize = buttonSizeSetting || 26;
        toolbarSpacing = toolbarSpacingSetting || 7;
        const buttonPositionSetting = await storage.get('ih_button_position');
        buttonPosition = buttonPositionSetting || 'top-right';

        // 视觉反馈自定义颜色
        borderHighlightColor = (await storage.get('ih_border_highlight_color')) || '#e6a100';
        // 兼容旧值 gray/green → 迁移到 custom
        if (borderHighlightMode === 'gray') {
            borderHighlightColor = '#888888';
            borderHighlightMode = 'custom';
        } else if (borderHighlightMode === 'green') {
            borderHighlightColor = '#00ff00';
            borderHighlightMode = 'custom';
        }

        // Check domain exclusions
        await checkDomainExclusion();

        // Inject border CSS if needed
        if (borderHighlightMode !== 'off') {
            injectBorderCSS();
        }

        // Send initial domain status to background script (top frame only)
        if (window === window.top) {
            chrome.runtime.sendMessage({
                type: 'ih:domain_status_changed',
                excluded: isDomainExcluded
            }).catch(() => {});
        }

        debug.log('Extension initialized:', {
            isEnabled, hoverDelay, minImageSize, isDomainExcluded,
            detectImg, detectVideo, detectSvg, detectBackground, convertWebpToPng
        });
    } catch (error) {
        debug.warn('Failed to load settings:', error);
    }
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    debug.log('Content script received message:', message);

    if (message.type === 'scan_images') {
        try {
            debug.log('Starting image scan with settings:', message.settings);
            const images = getAllImages(message.settings);
            debug.log('Image scan completed. Found:', images.length, 'images');
            debug.log('Scanned images:', images);
            sendResponse({ success: true, images });
        } catch (error) {
            debug.error('Error scanning images:', error);
            sendResponse({ success: false, error: error.message });
        }
        return true; // Keep message channel open for async response
    }

    if (message.type === 'settings_updated') {
        try {
            debug.log('Updating settings:', message.settings);

            // Update detection settings
            if (message.settings.detectImg !== undefined) {
                detectImg = message.settings.detectImg;
            }
            if (message.settings.detectVideo !== undefined) {
                detectVideo = message.settings.detectVideo;
            }
            if (message.settings.detectSvg !== undefined) {
                detectSvg = message.settings.detectSvg;
            }
            if (message.settings.detectBackground !== undefined) {
                detectBackground = message.settings.detectBackground;
            }
            if (message.settings.minImageSize !== undefined) {
                minImageSize = message.settings.minImageSize;
            }
            if (message.settings.convertWebpToPng !== undefined) {
                convertWebpToPng = message.settings.convertWebpToPng;
            }
            if (message.settings.hoverDelay !== undefined) {
                hoverDelay = message.settings.hoverDelay;
                debug.log('Hover delay updated:', hoverDelay);
            }
            if (message.settings.glowDelay !== undefined) {
                glowDelay = message.settings.glowDelay;
                debug.log('Glow delay updated:', glowDelay);
            }
            if (message.settings.borderHighlightMode !== undefined) {
                borderHighlightMode = message.settings.borderHighlightMode;

                // Inject or remove border CSS
                if (borderHighlightMode !== 'off') {
                    injectBorderCSS();
                } else {
                    // 关闭模式：销毁当前 halo 浮层（方案 B）
                    destroyHaloOverlay();
                }
            }

            // 交互设置：从 storage 重新读取以确保同步
            storage.get('ih_button_size').then(val => { buttonSize = val || 26; });
            storage.get('ih_toolbar_spacing').then(val => { toolbarSpacing = val || 7; });
            storage.get('ih_button_position').then(val => { buttonPosition = val || 'top-right'; });
            storage.get('ih_border_highlight_color').then(val => {
                borderHighlightColor = val || '#e6a100';
                // 重新注入 CSS 以应用新颜色
                if (borderHighlightMode !== 'off') {
                    const existingStyle = document.getElementById('ih-border-styles');
                    if (existingStyle) {
                        existingStyle.textContent = generateBorderCSS();
                    } else {
                        injectBorderCSS();
                    }
                }
            });

            debug.log('Settings updated:', {
                detectImg, detectVideo, detectSvg, detectBackground, minImageSize, convertWebpToPng, borderHighlightMode
            });

            sendResponse({ success: true });
        } catch (error) {
            debug.error('Error updating settings:', error);
            sendResponse({ success: false, error: error.message });
        }
        return true;
    }

    // 下载完成通知（来自 background.js，携带最终文件名）
    if (message.type === 'download_complete') {
        showPageToast('toastDownloadComplete', 'done', message.filename || '');
        return;
    }

    // 下载失败通知（来自 background.js：下载中断或下载请求本身失败）
    if (message.type === 'download_failed') {
        showPageToast('toastDownloadFailed', 'error', message.filename || '');
        return;
    }

    debug.log('Unknown message type:', message.type);
});

// Handle mouse events
function handleMouseEnter(e) {
    if (!isEnabled || isDomainExcluded) return;
    triggerHoverDetection(e.target);
}

// 核心：对给定元素执行悬停检测（按钮/高光的显示逻辑）。
// 既被 handleMouseEnter(mouseenter 事件) 调用，也被「页面加载时光标已在图片上」的
// 兜底检测调用——后者用于修复「新标签页打开大图、光标静止/移动中大图未触发 mouseenter」
// 导致悬浮按钮不显示的问题（如 Wallhaven 缩略图点进大图新标签页）。
function triggerHoverDetection(rawElement) {
    let element = rawElement;

    // 缩略图直链下载（实验性）：当悬停目标不是 IMG/VIDEO/SVG 时，
    // 检测是否为覆盖在 IMG 上的叠加层。仅当候选 IMG 匹配到已启用的 URL 转换策略时才激活，
    // 避免对无策略的普通网站产生副作用。
    if (detectImg && element.tagName !== 'IMG' && element.tagName !== 'VIDEO' && element.tagName !== 'svg') {
        const parent = element.parentElement;
        if (parent) {
            const candidateImg = parent.querySelector('img');
            if (candidateImg && candidateImg.src && !candidateImg.src.startsWith('data:')) {
                // 关键：仅当候选 IMG 的 URL 匹配到转换策略时才启用叠加层探测
                const matchedStrategy = findMatchingStrategy(window.location.hostname, candidateImg.src);
                if (matchedStrategy) {
                    const imgRect = candidateImg.getBoundingClientRect();
                    const elRect = element.getBoundingClientRect();
                    const overlaps = Math.abs(imgRect.left - elRect.left) < 20
                        && Math.abs(imgRect.top - elRect.top) < 20;
                    const isNavLink = element.tagName === 'A'
                        && element.textContent.trim().length > 0
                        && !element.querySelector('img');
                    if (overlaps && !isNavLink) {
                        element = candidateImg;
                    }
                }
            }
        }
    }

    // Check if this element type is enabled for detection
    let isValidType = false;
    if (element.tagName === 'IMG' && detectImg) {
        isValidType = true;
    } else if (element.tagName === 'VIDEO' && detectVideo) {
        isValidType = true;
    } else if (element.tagName === 'svg' && detectSvg) {
        isValidType = true;
    } else if (detectBackground) {
        // Check for background images - ensure element is an Element node
        if (element instanceof Element) {
            const computedStyle = window.getComputedStyle(element);
            const bgImage = computedStyle.backgroundImage;
            if (bgImage && bgImage !== 'none' && bgImage.includes('url(')) {
                isValidType = true;
            }
        }
    }

    if (!isValidType || !isDownloadableElement(element)) {
        return;
    }

    // Mark cursor as over image — used by hide timers to prevent flicker
    isMouseOverImage = true;

    // Trigger dynamic referer rule request for cross-origin media
    let mediaUrlToSpoof = null;
    if (element.tagName === 'IMG') mediaUrlToSpoof = element.src;
    else if (element.tagName === 'VIDEO') mediaUrlToSpoof = element.currentSrc || element.src;

    if (mediaUrlToSpoof) {
        requestRefererRule(mediaUrlToSpoof);
    }

    // Attempt to remove "nodownload" from video controlslist to allow native downloading
    if (element.tagName === 'VIDEO' && element.hasAttribute('controlslist')) {
        const controlsList = element.getAttribute('controlslist');
        if (controlsList.includes('nodownload')) {
            const newList = controlsList.replace('nodownload', '').trim();
            if (newList) {
                element.setAttribute('controlslist', newList);
            } else {
                element.removeAttribute('controlslist');
            }
        }
    }

    // Clear any existing timers (both show and pending hide)
    if (hoverTimer) {
        clearTimeout(hoverTimer);
    }
    if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
    }

    // 已激活快速跟随：若用户此前已在某图片上停留足够久、下载按钮已显示
    // （currentImage 指向旧图且按钮仍在 DOM），且光标仍位于旧图的矩形范围内，
    // 视为同一悬停的延续而非全新悬停——典型场景：点击缩略图后 lightbox 大图
    // 在光标下弹出（DOM 目标更替、光标未动）、快速移出后又立刻回到同一张图
    // （hide 延迟尚未结束）。此时不再重跑完整 hoverDelay，而是立即弹出按钮。
    // 反之若光标已移出旧图（如滑到相邻的下一张图片），则是一次真实的换图，
    // 必须重新走完整 hoverDelay，避免按钮在旧图隐藏前「跳变」到新图上立即出现。
    const oldRect = (downloadButton && currentImage && downloadButton.parentNode)
        ? currentImage.getBoundingClientRect()
        : null;
    const alreadyActive = !!oldRect
        && lastCursorX >= oldRect.left && lastCursorX <= oldRect.right
        && lastCursorY >= oldRect.top && lastCursorY <= oldRect.bottom;

    // 「点击后 DOM 重构」抑制：满足以下条件时禁用 0ms 快速跟随，强制走完整延迟，
    // 由 halo 的「矩形连续稳定才点亮」机制等查看器入场动画结束、图片放大定稿后再亮：
    //   ① 刚在当前图片上发生过左键点击（postClickContext 未过期）；
    //   ② 点击的不是悬浮按钮（click 处理器对按钮直接跳过，不会建立上下文）；
    //   ③ 点击确实引发了 DOM 改变（上下文窗口内 MutationObserver 置位；
    //      无变化的普通站点不受影响，快速跟随时机与 v1.7.0 行为一致）。
    // 背景：linux.do/Discourse 的 PhotoSwipe 查看器会复用帖子 <img>（reparent 或
    // clone + 换高清 src），点击后几毫秒内新图被送回光标下触发 mouseenter；若照常
    // 快速跟随，halo 会在动画启动前的静止间隙以原缩略图位置/尺寸点亮 = 闪烁。
    // 注意：这里刻意不比对目标节点与点击节点是否同一——查看器可能 clone 节点，
    // 节点同一性不可靠；窗口仅 1.5 秒，期间真实换图悬停最多多等一个完整延迟，无感。
    const suppressFastFollow = !!(postClickContext
        && postClickContext.domChanged
        && performance.now() - postClickContext.time < POST_CLICK_CONTEXT_MS);
    const fastFollow = alreadyActive && !suppressFastFollow;

    // Set timer for download button
    hoverTimer = setTimeout(() => {
        showDownloadButton(element);
    }, fastFollow ? 0 : hoverDelay);

    // Set separate timer for glow effect
    // 已激活时同样跳过 glowDelay，与按钮同步立即跟随到新图。
    if (borderHighlightMode !== 'off') {
        clearTimeout(glowTimer);
        glowTimer = setTimeout(() => {
            toggleBorderHighlight(element, true);
        }, fastFollow ? 0 : glowDelay);
    }
}

function handleMouseLeave(e) {
    let element = e.target;

    // 与 handleMouseEnter 一致的叠加层探测逻辑（仅策略匹配时激活）
    if (detectImg && element.tagName !== 'IMG' && element.tagName !== 'VIDEO' && element.tagName !== 'svg') {
        const parent = element.parentElement;
        if (parent) {
            const candidateImg = parent.querySelector('img');
            if (candidateImg && candidateImg.src && !candidateImg.src.startsWith('data:')) {
                const matchedStrategy = findMatchingStrategy(window.location.hostname, candidateImg.src);
                if (matchedStrategy) {
                    const imgRect = candidateImg.getBoundingClientRect();
                    const elRect = element.getBoundingClientRect();
                    const overlaps = Math.abs(imgRect.left - elRect.left) < 20
                        && Math.abs(imgRect.top - elRect.top) < 20;
                    const isNavLink = element.tagName === 'A'
                        && element.textContent.trim().length > 0
                        && !element.querySelector('img');
                    if (overlaps && !isNavLink) {
                        element = candidateImg;
                    }
                }
            }
        }
    }

    // Mark cursor as leaving image
    isMouseOverImage = false;

    // Remove border highlight
    toggleBorderHighlight(element, false);

    // Clear glow timer
    if (glowTimer) {
        clearTimeout(glowTimer);
        glowTimer = null;
    }

    // Clear show timer if mouse leaves before delay
    if (hoverTimer) {
        clearTimeout(hoverTimer);
        hoverTimer = null;
    }

    // Clear any previous hide timer to prevent orphans from rapid in/out sequences
    if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
    }

    const hideDelay = longHideDelay ? 1500 : 500;

    // Hide button after delay based on settings
    hideTimer = setTimeout(() => {
        hideTimer = null;

        // Guard 1: cursor is over button area
        if (isMouseOverButton) return;

        // Guard 2: cursor has returned to image (synchronous flag, no :hover timing issues)
        if (isMouseOverImage) return;

        // Both guards passed — truly away from both image and button, safe to hide
        hideDownloadButton();
    }, hideDelay);
}


// Request background script to spoof referer for specific media URL
function requestRefererRule(mediaUrl) {
    try {
        const mediaUrlObj = new URL(mediaUrl, window.location.href);
        const mediaHost = mediaUrlObj.hostname;
        const currentHost = window.location.hostname;

        // Only request if cross-origin and not a data URL
        if (mediaHost && mediaHost !== currentHost && !mediaUrl.startsWith('data:')) {
            debug.log('Requesting referer spoofing for:', mediaHost);
            chrome.runtime.sendMessage({
                type: 'ih:request_referer_rule',
                mediaHost: mediaHost,
                referer: window.location.origin + '/'
            }).catch(() => {});
        }
    } catch (e) {
        debug.warn('Error parsing URL for referer rule:', e);
    }
}

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync') {
        if (changes.ih_enabled) {
            isEnabled = changes.ih_enabled.newValue !== false;
            debug.log('Extension enabled status changed:', isEnabled);
            if (!isEnabled) {
                hideDownloadButton();
            }
        }

        if (changes.ih_hover_delay) {
            hoverDelay = changes.ih_hover_delay.newValue || CONFIG.DEFAULT_HOVER_DELAY;
            debug.log('Hover delay changed:', hoverDelay);
        }

        if (changes.ih_glow_delay) {
            glowDelay = changes.ih_glow_delay.newValue != null ? changes.ih_glow_delay.newValue : CONFIG.DEFAULT_GLOW_DELAY;
            debug.log('Glow delay changed:', glowDelay);
        }

        if (changes.ih_long_hide_delay) {
            longHideDelay = changes.ih_long_hide_delay.newValue === true;
            debug.log('Long hide delay changed:', longHideDelay);
        }

        if (changes.ih_convert_webp_to_png) {
            convertWebpToPng = changes.ih_convert_webp_to_png.newValue === true;
            debug.log('WebP to PNG conversion changed:', convertWebpToPng);
        }

        // 视觉反馈：颜色/模式变更即时生效。
        // 不依赖 popup → content 的 settings_updated 消息（该方法在某些 popup 打开方式下
        // currentWindow 解析不到内容标签页），storage.onChanged 是全局广播、最可靠。
        if (changes.ih_border_highlight_color) {
            borderHighlightColor = changes.ih_border_highlight_color.newValue || '#e6a100';
            if (borderHighlightMode !== 'off') {
                const existingStyle = document.getElementById('ih-border-styles');
                if (existingStyle) {
                    existingStyle.textContent = generateBorderCSS();
                } else {
                    injectBorderCSS();
                }
            }
            debug.log('Border highlight color changed:', borderHighlightColor);
        }

        if (changes.ih_border_highlight_mode) {
            borderHighlightMode = changes.ih_border_highlight_mode.newValue || CONFIG.DEFAULT_BORDER_HIGHLIGHT;
            if (borderHighlightMode !== 'off') {
                const existingStyle = document.getElementById('ih-border-styles');
                if (existingStyle) {
                    existingStyle.textContent = generateBorderCSS();
                } else {
                    injectBorderCSS();
                }
            } else {
                destroyHaloOverlay();
            }
            debug.log('Border highlight mode changed:', borderHighlightMode);
        }

        // 交互尺寸/位置变更即时生效（与 settings_updated 路径双保险）
        if (changes.ih_button_size !== undefined) {
            buttonSize = changes.ih_button_size.newValue || 26;
        }
        if (changes.ih_toolbar_spacing !== undefined) {
            toolbarSpacing = changes.ih_toolbar_spacing.newValue || 7;
        }
        if (changes.ih_button_position !== undefined) {
            buttonPosition = changes.ih_button_position.newValue || 'top-right';
        }

        if (changes.ih_ui_language) {
            const newLang = changes.ih_ui_language.newValue;
            if (newLang && newLang !== 'auto') {
                contentLocale = newLang;
            } else {
                try {
                    const lang = navigator.language || 'en';
                    contentLocale = lang.startsWith('zh') ? 'zh_CN' : 'en';
                } catch (e) {
                    contentLocale = 'en';
                }
            }
            debug.log('UI language changed:', contentLocale);
        }

        if (changes.ih_domain_exclusions) {
            checkDomainExclusion();
        }

        if (changes.ih_multi_path_enabled !== undefined) {
            multiPathEnabled = changes.ih_multi_path_enabled.newValue === true;
            debug.log('Multi-path enabled changed:', multiPathEnabled);
        }

        if (changes.ih_multi_paths) {
            const rawPaths = changes.ih_multi_paths.newValue;
            multiPaths = (Array.isArray(rawPaths) ? rawPaths : []).filter(p => p.enabled !== false);
            debug.log('Multi-paths updated, count:', multiPaths.length);
        }

        if (changes.ih_download_mode) {
            currentDownloadMode = changes.ih_download_mode.newValue || 'normal';
            debug.log('Download mode changed:', currentDownloadMode);
        }

        if (changes.ih_url_strategies) {
            const raw = changes.ih_url_strategies.newValue;
            urlStrategies = mergeStrategiesWithPresets(raw || []);
            activeStrategy = findMatchingStrategy(window.location.hostname);
            debug.log('URL 转换策略已更新, 活跃策略:', activeStrategy ? activeStrategy.name : '无');
        }
    }
});

// Set up event listeners
// 记录最新光标位置（视口坐标）。mouseenter 事件在「新标签页加载完成时光标
// 已静止/移动中大图区域内」时不会可靠触发，需要用光标位置主动命中检测；
// triggerHoverDetection 也用它判断光标是否仍在旧图矩形内（快速跟随条件）。
let lastCursorX = -1;
let lastCursorY = -1;
document.addEventListener('mousemove', (e) => {
    lastCursorX = e.clientX;
    lastCursorY = e.clientY;
}, true);

// ===== 点击上下文（识别「点击引发 DOM 重构」场景，消除查看器打开时的高亮闪烁）=====
// 满足以下三条时抑制 halo 的 0ms 快速跟随，等图片放大、视图稳定后再显示：
//   ① 在目标图片上产生过左键点击；
//   ② 点击的不是悬浮按钮/工具栏；
//   ③ 点击造成了 DOM 改变（窗口内 MutationObserver 置位）。
const POST_CLICK_CONTEXT_MS = 1500; // 上下文有效期：覆盖查看器打开/缩放动画的全程
let postClickMutObserver = null;

function discardPostClickContext() {
    if (postClickMutObserver) {
        postClickMutObserver.disconnect();
        postClickMutObserver = null;
    }
    postClickContext = null;
}

document.addEventListener('click', (e) => {
    if (e.button !== 0) return;

    // 条件②：点在悬浮按钮/工具栏上 → 完全不介入（下载按钮有自己的 click 处理器）
    let node = e.target;
    while (node && node !== document) {
        if (node.classList && (
            node.classList.contains('ih-download-btn') ||
            node.classList.contains('ih-download-toolbar') ||
            node.classList.contains('ih-toolbar-btn')
        )) {
            return;
        }
        node = node.parentNode;
    }

    // 条件①：点击发生在「目标图片」上。目标图片按反馈状态取：
    // 按钮已显示(悬停≥hoverDelay) → currentImage；仅高亮已亮(glowDelay~hoverDelay) →
    // haloTarget；两者都未出现(悬停不足 glowDelay 就点击) → 点击目标自身/祖先链的 IMG。
    // 不能只依赖 currentImage：悬停不足 1 秒时按钮尚未创建，currentImage 为空，
    // 此时点击放大同样会触发查看器重构，必须同样建立上下文。
    let rootImg = currentImage || haloTarget;
    if (!rootImg && e.target instanceof Element) {
        let n = e.target;
        while (n && n !== document) {
            if (n.tagName === 'IMG') { rootImg = n; break; }
            n = n.parentNode;
        }
    }
    const onCurrentImage = !!(rootImg && (
        rootImg === e.target ||
        rootImg.contains(e.target) ||
        e.target.contains(rootImg)
    ));
    discardPostClickContext();
    if (onCurrentImage) {
        postClickContext = { root: rootImg, time: performance.now(), domChanged: false };
        // 条件③：窗口内监测 DOM 是否真的因点击改变（查看器插入/reparent/换 src）
        postClickMutObserver = new MutationObserver(() => {
            if (postClickContext) postClickContext.domChanged = true;
        });
        postClickMutObserver.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['src']
        });
        setTimeout(() => {
            if (postClickContext
                && performance.now() - postClickContext.time >= POST_CLICK_CONTEXT_MS) {
                discardPostClickContext();
            }
        }, POST_CLICK_CONTEXT_MS + 50);
    }

    // 点击瞬间收掉挂起的反馈：Chrome 只在鼠标移动后才派发 mouseleave，
    // 若等它清理，旧图上的高光会以其最大 z-index 浮在查看器遮罩之上形成残影。
    // 判断依据是 halo/定时器自身的存活状态而非 currentImage —— glowDelay(500ms)
    // 小于 hoverDelay(1000ms)，hover 后半秒就点击时按钮尚未创建但 halo 已亮起。
    if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
    if (glowTimer) { clearTimeout(glowTimer); glowTimer = null; }
    if (haloTarget || haloOverlay) {
        toggleBorderHighlight(haloTarget, false);
    }
}, true);

document.addEventListener('mouseenter', handleMouseEnter, true);
document.addEventListener('mouseleave', handleMouseLeave, true);

// Button hover guard: prevent flicker when moving cursor from image to button
// Uses event delegation since buttons are dynamically created/destroyed
document.addEventListener('mouseenter', (e) => {
    let target = e.target;
    // Walk up to check if we entered the button or toolbar or any child within
    while (target && target !== document) {
        if (target.classList && (
            target.classList.contains('ih-download-btn') ||
            target.classList.contains('ih-download-toolbar') ||
            target.classList.contains('ih-toolbar-btn')
        )) {
            isMouseOverButton = true;
            return;
        }
        target = target.parentNode;
    }
}, true);

document.addEventListener('mouseleave', (e) => {
    let target = e.target;
    // Check if we're leaving the button/toolbar area
    while (target && target !== document) {
        if (target.classList && (
            target.classList.contains('ih-download-btn') ||
            target.classList.contains('ih-download-toolbar') ||
            target.classList.contains('ih-toolbar-btn')
        )) {
            // Check if cursor is moving to another element INSIDE the button area
            // (e.g., from one toolbar button to another) — if so, ignore this leave
            let related = e.relatedTarget;
            while (related && related !== document) {
                if (related.classList && (
                    related.classList.contains('ih-download-btn') ||
                    related.classList.contains('ih-download-toolbar') ||
                    related.classList.contains('ih-toolbar-btn')
                )) {
                    // Still inside button area — keep guard flag, no hide timer
                    return;
                }
                related = related.parentNode;
            }

            // Truly leaving the button area
            isMouseOverButton = false;

            // Clear any previous hide timer to prevent orphans from rapid in/out sequences
            if (hideTimer) {
                clearTimeout(hideTimer);
            }

            // After leaving button, start hide timer
            const hideDelay = longHideDelay ? 1500 : 500;
            hideTimer = setTimeout(() => {
                hideTimer = null;
                if (!isMouseOverButton) {
                    hideDownloadButton();
                }
            }, hideDelay);
            return;
        }
        target = target.parentNode;
    }
}, true);
window.addEventListener('scroll', () => {
    if (currentImage && downloadButton) {
        positionButton(currentImage, downloadButton);
    }
});
window.addEventListener('resize', () => {
    if (currentImage && downloadButton) {
        positionButton(currentImage, downloadButton);
    }
});

// ===== 页面加载时光标已在图片上的兜底检测 =====
// 在光标位置进行命中测试，找到最顶层可下载元素并触发悬停检测。
// 返回是否命中了可检测元素（供加载兜底判断是否需要继续重试）。
function detectHoverAtCursor() {
    if (!isEnabled || isDomainExcluded) return false;
    if (lastCursorX < 0 || lastCursorY < 0) return false;

    const el = document.elementFromPoint(lastCursorX, lastCursorY);
    if (!el) return false;

    triggerHoverDetection(el);
    return true;
}

// 页面加载完成后兜底：若光标此刻正好在一张可下载图片上，主动触发一次悬停检测。
// 用 setTimeout 给页面布局/图片渲染留出时间，避免 elementFromPoint 命中到占位骨架。
// 多次延迟重试覆盖图片懒加载/后续渲染的场景（如 Wallhaven 大图在 DOM 注入后才到位）。
// 仅当尚未进入任何图片（mouseenter 从未触发 / 已 mouseleave）时才兜底，
// 避免与正常 mouseenter 路径重复触发、重置 hover 定时器。
function checkHoverOnLoad() {
    if (!isEnabled || isDomainExcluded) return;
    const retries = [300, 900, 2000];
    retries.forEach(delay => {
        setTimeout(() => {
            if (!isMouseOverImage) {
                detectHoverAtCursor();
            }
        }, delay);
    });
}

if (document.readyState === 'complete') {
    checkHoverOnLoad();
} else {
    window.addEventListener('load', checkHoverOnLoad);
}

// Initialize extension (includes checkDomainExclusion internally)
initializeExtension();
