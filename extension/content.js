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
        detectVideo = videoDetect !== false; // Default: true
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
        borderHighlightColor = (await storage.get('ih_border_highlight_color')) || '#00ff00';
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
                    // Remove all existing border highlights with proper checks
                    document.querySelectorAll('[class*="ih-border-highlight-"]').forEach(el => {
                        if (el && el.classList) {
                            // Remove all classes that start with 'ih-border-highlight-'
                            const classesToRemove = Array.from(el.classList).filter(cls => cls.startsWith('ih-border-highlight-'));
                            el.classList.remove(...classesToRemove);
                        }
                    });
                }
            }

            // 交互设置：从 storage 重新读取以确保同步
            storage.get('ih_button_size').then(val => { buttonSize = val || 26; });
            storage.get('ih_toolbar_spacing').then(val => { toolbarSpacing = val || 7; });
            storage.get('ih_button_position').then(val => { buttonPosition = val || 'top-right'; });
            storage.get('ih_border_highlight_color').then(val => {
                borderHighlightColor = val || '#00ff00';
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

    // 下载完成通知（来自 background.js）
    if (message.type === 'download_complete') {
        showPageToast('toastDownloadComplete', 'done');
        return;
    }

    debug.log('Unknown message type:', message.type);
});

// Handle mouse events
function handleMouseEnter(e) {
    if (!isEnabled || isDomainExcluded) return;

    let element = e.target;

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

    // Set timer for download button
    hoverTimer = setTimeout(() => {
        showDownloadButton(element);
    }, hoverDelay);

    // Set separate timer for glow effect
    if (borderHighlightMode !== 'off') {
        clearTimeout(glowTimer);
        glowTimer = setTimeout(() => {
            toggleBorderHighlight(element, true);
        }, glowDelay);
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

// Initialize extension (includes checkDomainExclusion internally)
initializeExtension();
