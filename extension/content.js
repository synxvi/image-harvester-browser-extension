// Image Harvester - Content Script
// Copyright (c) Jaewoo Jeon (@thejjw) and Image Harvester Contributors
// SPDX-License-Identifier: zlib-acknowledgement

// Debug flag - set to false to disable all console output
const DEBUG = false;

// Debug console wrapper
const debug = {
    log: (...args) => DEBUG && console.log(...args),
    error: (...args) => DEBUG && console.error(...args),
    warn: (...args) => DEBUG && console.warn(...args),
    info: (...args) => DEBUG && console.info(...args)
};

// Configuration
const CONFIG = {
    DEFAULT_EXTENSIONS: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'mp4', 'webm', 'mov'],
    DEFAULT_HOVER_DELAY: 1000,
    MIN_IMAGE_SIZE: 100,
    DEFAULT_BORDER_HIGHLIGHT: 'off',
    BORDER_COLORS: {
        off: 'none',
        gray: '#888888',
        green: '#00ff00'
    },
    BORDER_WIDTH: '2px',
    BORDER_STYLE: 'solid'
};

let hoverTimer = null;
let currentImage = null;
let downloadButton = null;
let isEnabled = true;
let hoverDelay = CONFIG.DEFAULT_HOVER_DELAY; // 1.0 seconds default
let isDomainExcluded = false;
let minImageSize = CONFIG.MIN_IMAGE_SIZE;
let detectImg = true;
let borderHighlightMode = CONFIG.DEFAULT_BORDER_HIGHLIGHT;
let detectVideo = true;
let detectSvg = false;
let detectBackground = false;
let convertWebpToPng = false;
let longHideDelay = false;
let isMouseOverButton = false; // Guard flag: prevents hiding while cursor is over the button
let isMouseOverImage = false; // Guard flag: prevents hiding while cursor is over the image
let hideTimer = null; // Tracks the pending hide timer so re-enter can cancel it
let imageResizeObserver = null;   // ResizeObserver：跟踪当前图片尺寸变化
let imageMutationObserver = null; // MutationObserver：跟踪当前图片 src 属性变化

// Multi-path download settings
let multiPathEnabled = false;
let multiPaths = [];
let currentDownloadMode = 'normal'; // cached for sync decision in showDownloadButton
let contentLocale = 'en'; // 用户语言偏好，用于 toast 国际化

// 交互设置
let buttonSize = 26;        // 悬浮按钮大小（px）
let toolbarSpacing = 7;     // 多路径工具栏按钮间距（px）
let buttonPosition = 'top-right'; // 按钮弹出位置
let borderHighlightColor = '#00ff00'; // 自定义边框颜色

// URL 转换策略
let urlStrategies = [];
let activeStrategy = null;

// 内置预设策略定义（与 strategies.js 中的 PRESET_STRATEGIES 保持同步）
const BUILTIN_PRESET_STRATEGIES = [
    {
        id: 'wallhaven-original',
        name: 'Wallhaven 原图',
        domainPattern: 'th.wallhaven.cc',
        enabled: true,
        isPreset: true,
        experimental: true,
        resolver: 'wallhaven'
    },
    {
        id: 'pixiv-original',
        name: 'Pixiv 原图',
        domainPattern: 'pximg.net',
        enabled: false,
        isPreset: true,
        experimental: true,
        resolver: 'pixiv'
    },
    {
        id: 'twitter-x-orig',
        name: 'Twitter/X 原图',
        domainPattern: 'twimg.com',
        enabled: true,
        isPreset: true,
        rules: [
            { match: '^(https?://pbs\\.twimg\\.com/media/[^?]+)\\?format=(\\w+)&name=.*$', replace: '$1.$2:orig' }
        ]
    },
    {
        id: 'twitter-x-large',
        name: 'Twitter/X 大图',
        domainPattern: 'twimg.com',
        enabled: false,
        isPreset: true,
        rules: [
            { match: '^(https?://pbs\\.twimg\\.com/media/[^?]+)\\?format=(\\w+)&name=.*$', replace: '$1.$2:large' }
        ]
    },
    {
        id: 'reddit-preview',
        name: 'Reddit 原图',
        domainPattern: 'redd.it',
        enabled: true,
        isPreset: true,
        rules: [
            { match: '^(https?://preview\\.redd\\.it/[^?]+)\\?.*$', replace: '$1' },
            { match: '^(https?://external-preview\\.redd\\.it/[^?]+)\\?.*$', replace: '$1' }
        ]
    },
    {
        id: 'imgur-direct',
        name: 'Imgur 直链',
        domainPattern: 'imgur.com',
        enabled: false,
        isPreset: true,
        rules: [
            { match: '^https?://i\\.imgur\\.com/(\\w+)([tsmlbh])?\\.(\\w+)$', replace: 'https://i.imgur.com/$1.$3' }
        ]
    },
    {
        id: 'instagram-cdn',
        name: 'Instagram CDN',
        domainPattern: 'cdninstagram.com',
        enabled: false,
        isPreset: true,
        rules: [
            { match: '^(https?://[^/]+/v/[^?]+)\\??.*$', replace: '$1' }
        ]
    }
];

// 合并存储策略与内置预设（保留用户启用状态，补充缺失预设）
function mergeStrategiesWithPresets(saved) {
    if (!Array.isArray(saved) || saved.length === 0) {
        return JSON.parse(JSON.stringify(BUILTIN_PRESET_STRATEGIES));
    }
    const savedById = new Map(saved.map(s => [s.id, s]));
    const result = [];
    for (const preset of BUILTIN_PRESET_STRATEGIES) {
        const existing = savedById.get(preset.id);
        if (existing) {
            result.push({ ...JSON.parse(JSON.stringify(preset)), enabled: existing.enabled });
            savedById.delete(preset.id);
        } else {
            result.push(JSON.parse(JSON.stringify(preset)));
        }
    }
    for (const custom of savedById.values()) {
        result.push(custom);
    }
    return result;
}

// Storage helper
const storage = {
    async get(key) {
        try {
            const result = await chrome.storage.sync.get(key);
            return result[key];
        } catch (error) {
            debug.warn('Storage error:', error);
            return null;
        }
    }
};

// Generate CSS for border highlighting
function generateBorderCSS() {
    return `
.ih-border-highlight-custom {
    outline: ${CONFIG.BORDER_WIDTH} ${CONFIG.BORDER_STYLE} ${borderHighlightColor} !important;
    outline-offset: 1px !important;
    transition: outline 0.2s ease !important;
}
`;
}

// Inject border CSS
function injectBorderCSS() {
    if (!document.getElementById('ih-border-styles')) {
        const style = document.createElement('style');
        style.id = 'ih-border-styles';
        style.textContent = generateBorderCSS();
        document.head.appendChild(style);
    }
}

// Add/remove border highlight
function toggleBorderHighlight(element, show) {
    if (borderHighlightMode === 'off') return;

    // Check if element exists and has classList
    if (!element || !element.classList) return;

    // Remove any existing border classes
    const classesToRemove = Array.from(element.classList).filter(cls => cls.startsWith('ih-border-highlight-'));
    element.classList.remove(...classesToRemove);

    if (show) {
        element.classList.add('ih-border-highlight-custom');
    }
}

// 查找匹配指定域名或 URL 的转换策略
// 同时匹配页面域名和媒体 URL 域名
function findMatchingStrategy(hostname, mediaUrl) {
    const lowerHost = hostname.toLowerCase();
    let mediaHost = '';
    if (mediaUrl && !mediaUrl.startsWith('data:')) {
        try {
            mediaHost = new URL(mediaUrl, window.location.href).hostname.toLowerCase();
        } catch (e) {}
    }
    for (const strategy of urlStrategies) {
        if (!strategy.enabled) continue;
        const domain = strategy.domainPattern.toLowerCase();
        // 匹配页面域名或媒体 URL 域名
        const pageMatch = lowerHost === domain || lowerHost.endsWith('.' + domain);
        const mediaMatch = mediaHost && (mediaHost === domain || mediaHost.endsWith('.' + domain));
        if (pageMatch || mediaMatch) {
            return strategy;
        }
    }
    return null;
}

// 使用策略转换 URL（正则引擎，适用于普通策略）
function transformUrl(url, strategy) {
    if (!strategy || !strategy.rules) return { url, transformed: false, ruleName: null };
    for (const rule of strategy.rules) {
        try {
            const regex = new RegExp(rule.match);
            if (regex.test(url)) {
                const transformed = url.replace(regex, rule.replace);
                return { url: transformed, transformed: true, ruleName: strategy.name };
            }
        } catch (e) {
            debug.warn('策略规则正则无效:', rule.match, e);
        }
    }
    return { url, transformed: false, ruleName: null };
}

// Pixiv 原图 API 缓存（illustId -> { urls, timestamp }）
const pixivApiCache = new Map();
const PIXIV_CACHE_TTL = 10 * 60 * 1000; // 10 分钟

// 实验性策略的专属 resolver（从页面 DOM 元数据直接构造原图 URL）
const strategyResolvers = {
    wallhaven(element) {
        const container = element.closest('figure') || element.closest('.thumb');
        if (!container) return null;
        // 读取壁纸 ID
        const wallpaperId = container.getAttribute('data-wallpaper-id')
            || (element.src && element.src.match(/([a-z0-9]+)\.\w+$/)?.[1]);
        if (!wallpaperId) return null;
        // 读取格式标识
        const formatSpan = container.querySelector('.thumb-info span.png, .thumb-info span.jpg');
        const ext = formatSpan?.classList.contains('png') ? 'png' : 'jpg';
        const prefix = wallpaperId.substring(0, 2);
        const originalUrl = `https://w.wallhaven.cc/full/${prefix}/wallhaven-${wallpaperId}.${ext}`;
        debug.log('Wallhaven resolver:', wallpaperId, ext, '->', originalUrl);
        return originalUrl;
    },

    async pixiv(element) {
        // 从元素 src 提取 illust ID 和页码
        const src = element.src || element.getAttribute('src');
        if (!src) return null;

        // 匹配 pximg.net 的各种缩略图 URL 格式，提取 illust ID 和页码
        const urlMatch = src.match(/\/(\d+)_p(\d+)/);
        if (!urlMatch) return null;
        const illustId = urlMatch[1];
        const page = urlMatch[2];

        // 检查缓存
        const cached = pixivApiCache.get(illustId);
        if (cached && Date.now() - cached.timestamp < PIXIV_CACHE_TTL) {
            const originalUrl = cached.urls[page];
            if (originalUrl) {
                debug.log('Pixiv resolver (缓存):', illustId, 'p' + page, '->', originalUrl);
                return originalUrl;
            }
        }

        // 请求 Pixiv API 获取原图 URL
        try {
            const response = await fetch(`https://www.pixiv.net/ajax/illust/${illustId}`, {
                credentials: 'same-origin'
            });
            if (!response.ok) {
                debug.warn('Pixiv API 请求失败:', response.status);
                return null;
            }
            const data = await response.json();
            if (!data.body || !data.body.urls || !data.body.urls.original) {
                debug.warn('Pixiv API 返回数据缺少原图 URL');
                return null;
            }

            // API 返回的 original 模板包含 {p} 占位符或实际 URL
            // urls.original 可能是 "https://i.pximg.net/img-original/img/.../{id}_p0.png" 格式
            // 需要构造所有页面的 URL 映射
            const originalBase = data.body.urls.original;
            const pageCount = data.body.pageCount || 1;

            // 构造各页面的原图 URL
            const urls = {};
            for (let i = 0; i < pageCount; i++) {
                // 从第 0 页的 URL 推导其余页面
                if (i === 0) {
                    urls[i] = originalBase;
                } else {
                    urls[i] = originalBase.replace(/_p0\./, `_p${i}.`);
                }
            }

            // 写入缓存
            pixivApiCache.set(illustId, { urls, timestamp: Date.now() });

            const result = urls[page];
            debug.log('Pixiv resolver (API):', illustId, 'p' + page, '->', result);
            return result || null;
        } catch (e) {
            debug.warn('Pixiv resolver 请求异常:', e);
            return null;
        }
    }
};

// Initialize extension settings
async function initializeExtension() {
    try {
        const enabled = await storage.get('ih_enabled');
        const delay = await storage.get('ih_hover_delay');
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

// Create download button element
function createDownloadButton() {
    const button = document.createElement('div');
    button.className = 'ih-download-btn';
    button.innerHTML = '💾';
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
    
    // Destroy old button/toolbar only when switching to a different image or first show
    hideDownloadButton();
    
    const activePaths = multiPaths.filter(p => p.enabled !== false);
    
    // Decide: toolbar or single button?
    // Conditions: multi-path enabled + Normal mode + at least 2 active paths
    const useToolbar = (
        multiPathEnabled &&
        currentDownloadMode === 'normal' &&
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
function hideDownloadButton() {
    detachImageObservers();
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

        // 应用 URL 转换策略（同时匹配页面域名和图片 URL 域名）
        if (elementUrl && !elementUrl.startsWith('data:')) {
            const strategy = findMatchingStrategy(window.location.hostname, elementUrl);
            if (strategy) {
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
        
        // Send download request to background script
        chrome.storage.sync.get(['ih_download_mode'], async (result) => {
            const downloadMode = result.ih_download_mode || 'normal';

            // Helper to download a blob locally
            const downloadBlob = (blob, finalFilename) => {
                const objectUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = objectUrl;
                a.download = finalFilename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);

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
            
            // Handle canvas extraction mode
            if (downloadMode === 'canvas') {
                try {
                    const canvasBlob = await extractImageToCanvas(element);
                    if (canvasBlob) {
                        downloadBlob(canvasBlob, filename);
                        return;
                    }
                } catch (e) {
                    debug.warn('Canvas extraction failed, falling back', e);
                }
            }

            // Final fallback: Normal background download
            chrome.runtime.sendMessage({
                type: 'download_image',
                url: elementUrl,
                filename: filename,
                downloadMode: downloadMode,
                pathIndex: pathIndex
            });
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
    const detectImg = settings.detectImg !== false; // Default: true
    const detectSvg = settings.detectSvg === true; // Default: false
    const detectBackground = settings.detectBackground === true; // Default: false
    const detectVideo = settings.detectVideo !== false; // Default: true
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
    if (detectImg) {
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
    if (detectSvg) {
        const svgElements = document.querySelectorAll('svg');
        svgElements.forEach(svg => {
            const rect = svg.getBoundingClientRect();
            if (rect.width >= minImageSize && rect.height >= minImageSize) {
                // Convert SVG to data URL
                try {
                    const serializer = new XMLSerializer();
                    const svgStr = serializer.serializeToString(svg);
                    const dataUrl = 'data:image/svg+xml;base64,' + btoa(svgStr);
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
    if (detectBackground) {
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
    if (detectVideo) {
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
    
    // Set new timer for both border highlight and download button
    hoverTimer = setTimeout(() => {
        // Add border highlight and show download button together
        toggleBorderHighlight(element, true);
        showDownloadButton(element);
    }, hoverDelay);
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
            urlStrategies = changes.ih_url_strategies.newValue || [];
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

// Extract image to canvas and return as blob
async function extractImageToCanvas(element) {
    try {
        debug.log('Attempting canvas extraction for element:', element.tagName);
        
        let imageElement = element;
        let sourceUrl = null;
        
        // Handle different element types
        if (element.tagName === 'IMG') {
            sourceUrl = element.src;
        } else if (element.tagName === 'VIDEO') {
            sourceUrl = element.currentSrc || element.src;
        } else {
            // For background images or other elements, try to extract the URL
            const computedStyle = window.getComputedStyle(element);
            const backgroundImage = computedStyle.backgroundImage;
            
            if (backgroundImage && backgroundImage !== 'none') {
                const urlMatch = backgroundImage.match(/url\(["']?([^"')]+)["']?\)/);
                if (urlMatch) {
                    sourceUrl = urlMatch[1];
                }
            }
        }
        
        if (!sourceUrl) {
            debug.warn('No source URL found for canvas extraction');
            return null;
        }
        
        debug.log('Canvas extraction source URL:', sourceUrl);
        
        // Create a new image element to load the source
        const img = new Image();
        
        // Set up cross-origin handling
        img.crossOrigin = 'anonymous';
        
        return new Promise((resolve, reject) => {
            img.onload = function() {
                try {
                    debug.log('Image loaded for canvas extraction, dimensions:', img.naturalWidth, 'x', img.naturalHeight);
                    
                    // Create canvas
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // Set canvas dimensions to match image
                    canvas.width = img.naturalWidth || img.width;
                    canvas.height = img.naturalHeight || img.height;
                    
                    // Draw image to canvas
                    ctx.drawImage(img, 0, 0);
                    
                    // Convert canvas to blob
                    canvas.toBlob((blob) => {
                        if (blob) {
                            debug.log('Canvas extraction successful, blob size:', blob.size);
                            resolve(blob);
                        } else {
                            debug.warn('Failed to create blob from canvas');
                            resolve(null);
                        }
                    }, 'image/png', 1.0);
                    
                } catch (canvasError) {
                    debug.error('Canvas drawing error:', canvasError);
                    resolve(null);
                }
            };
            
            img.onerror = function() {
                debug.warn('Failed to load image for canvas extraction');
                resolve(null);
            };
            
            // Handle CORS errors gracefully
            img.onabort = function() {
                debug.warn('Image loading aborted for canvas extraction');
                resolve(null);
            };
            
            // Start loading the image
            img.src = sourceUrl;
            
            // Set a timeout to avoid hanging
            setTimeout(() => {
                debug.warn('Canvas extraction timeout');
                resolve(null);
            }, 10000);
        });
        
    } catch (error) {
        debug.error('Canvas extraction error:', error);
        return null;
    }
}

// Convert WebP image to PNG using canvas
async function convertWebpImageToPng(element) {
    try {
        debug.log('Attempting WebP to PNG conversion for element:', element.tagName);
        
        let sourceUrl = null;
        
        // Handle different element types
        if (element.tagName === 'IMG') {
            sourceUrl = element.src;
        } else {
            // For background images or other elements, try to extract the URL
            const computedStyle = window.getComputedStyle(element);
            const backgroundImage = computedStyle.backgroundImage;
            
            if (backgroundImage && backgroundImage !== 'none') {
                const urlMatch = backgroundImage.match(/url\(["']?([^"')]+)["']?\)/);
                if (urlMatch) {
                    sourceUrl = urlMatch[1];
                }
            }
        }
        
        if (!sourceUrl) {
            debug.warn('No source URL found for WebP conversion');
            return null;
        }
        
        // Check if the image is WebP
        if (!sourceUrl.toLowerCase().includes('.webp') && !sourceUrl.toLowerCase().includes('webp')) {
            debug.log('Image is not WebP, skipping conversion');
            return null;
        }
        
        // Check if the WebP is animated before converting (via background script to bypass CORS)
        let isAnimated = null;
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'check_webp_animated',
                url: sourceUrl
            });
            isAnimated = response.isAnimated;
        } catch (error) {
            debug.warn('Failed to check WebP animation status:', error);
            isAnimated = null;
        }
        
        if (isAnimated === true) {
            debug.log('WebP is animated, skipping PNG conversion to preserve animation');
            return null;
        } else if (isAnimated === null) {
            debug.warn('Could not determine if WebP is animated, skipping conversion for safety');
            return null;
        }
        
        debug.log('Converting static WebP to PNG, source URL:', sourceUrl);
        
        // Fetch the WebP image via background script (bypasses CORS)
        let imageDataUrl = null;
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'fetch_webp_for_conversion',
                url: sourceUrl
            });
            if (response.success) {
                imageDataUrl = response.dataUrl;
            }
        } catch (error) {
            debug.warn('Failed to fetch WebP image via background:', error);
            return null;
        }
        
        if (!imageDataUrl) {
            debug.warn('No data URL received for WebP conversion');
            return null;
        }
        
        // Create a new image element to load the WebP from data URL
        const img = new Image();
        
        return new Promise((resolve, reject) => {
            img.onload = function() {
                try {
                    debug.log('WebP image loaded for conversion, dimensions:', img.naturalWidth, 'x', img.naturalHeight);
                    
                    // Create canvas
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // Set canvas dimensions to match image
                    canvas.width = img.naturalWidth || img.width;
                    canvas.height = img.naturalHeight || img.height;
                    
                    // Draw WebP image to canvas
                    ctx.drawImage(img, 0, 0);
                    
                    // Convert canvas to PNG blob
                    canvas.toBlob((blob) => {
                        if (blob) {
                            debug.log('WebP to PNG conversion successful, blob size:', blob.size);
                            resolve(blob);
                        } else {
                            debug.warn('Failed to create PNG blob from WebP');
                            resolve(null);
                        }
                    }, 'image/png', 1.0);
                    
                } catch (canvasError) {
                    debug.error('WebP to PNG conversion error:', canvasError);
                    resolve(null);
                }
            };
            
            img.onerror = function() {
                debug.warn('Failed to load WebP image for conversion');
                resolve(null);
            };
            
            // Handle CORS errors gracefully
            img.onabort = function() {
                debug.warn('WebP image loading aborted for conversion');
                resolve(null);
            };
            
            // Load the WebP image from data URL (no CORS issues)
            img.src = imageDataUrl;
            
            // Set a timeout to avoid hanging
            setTimeout(() => {
                debug.warn('WebP to PNG conversion timeout');
                resolve(null);
            }, 10000);
        });
        
    } catch (error) {
        debug.error('WebP to PNG conversion error:', error);
        return null;
    }
}

// Check if a WebP image is animated by examining its file header
async function isAnimatedWebP(url) {
    try {
        debug.log('Checking if WebP is animated:', url);
        
        // Fetch only the first few KB to check the header
        const response = await fetch(url, {
            headers: {
                'Range': 'bytes=0-1024' // Only fetch first 1KB for header analysis
            }
        });
        
        if (!response.ok) {
            debug.warn('Failed to fetch WebP for animation check:', response.status);
            return null;
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        
        // Check WebP signature first: "RIFF" + 4 bytes + "WEBP"
        if (bytes.length < 12) {
            debug.warn('WebP file too small for header analysis');
            return null;
        }
        
        // Check RIFF signature
        const riffSig = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
        if (riffSig !== 'RIFF') {
            debug.warn('Not a valid RIFF file');
            return false;
        }
        
        // Check WEBP signature
        const webpSig = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
        if (webpSig !== 'WEBP') {
            debug.warn('Not a valid WebP file');
            return false;
        }
        
        // Look for animation indicators in the WebP chunks
        // WebP animated images contain either:
        // 1. "ANIM" chunk (VP8X with animation flag)
        // 2. Multiple "ANMF" chunks (animation frames)
        
        let offset = 12; // Start after RIFF header
        
        while (offset < bytes.length - 8) {
            // Read chunk fourCC
            if (offset + 4 >= bytes.length) break;
            
            const chunkType = String.fromCharCode(
                bytes[offset], 
                bytes[offset + 1], 
                bytes[offset + 2], 
                bytes[offset + 3]
            );
            
            debug.log('Found WebP chunk:', chunkType, 'at offset', offset);
            
            // Check for VP8X chunk (extended format)
            if (chunkType === 'VP8X') {
                // VP8X has flags at offset+8, animation flag is bit 1 (0x02)
                if (offset + 8 < bytes.length) {
                    const flags = bytes[offset + 8];
                    const hasAnimation = (flags & 0x02) !== 0;
                    debug.log('VP8X flags:', flags.toString(16), 'hasAnimation:', hasAnimation);
                    return hasAnimation;
                }
            }
            
            // Check for ANIM chunk (animation parameters)
            if (chunkType === 'ANIM') {
                debug.log('Found ANIM chunk - WebP is animated');
                return true;
            }
            
            // Check for ANMF chunk (animation frame)
            if (chunkType === 'ANMF') {
                debug.log('Found ANMF chunk - WebP is animated');
                return true;
            }
            
            // Move to next chunk
            if (offset + 7 >= bytes.length) break;
            
            // Read chunk size (little-endian)
            const chunkSize = bytes[offset + 4] | 
                            (bytes[offset + 5] << 8) | 
                            (bytes[offset + 6] << 16) | 
                            (bytes[offset + 7] << 24);
            
            // Move to next chunk (8 bytes header + chunk size, padded to even)
            offset += 8 + Math.ceil(chunkSize / 2) * 2;
            
            // Safety check to prevent infinite loop
            if (chunkSize === 0 || offset >= bytes.length) break;
        }
        
        // If we didn't find animation indicators, it's likely a static WebP
        debug.log('No animation chunks found - WebP appears to be static');
        return false;
        
    } catch (error) {
        debug.warn('Error checking WebP animation status:', error);
        // Return null to indicate we couldn't determine the status
        // This will cause the conversion to be skipped for safety
        return null;
    }
}

// Initialize extension
initializeExtension();
checkDomainExclusion();
