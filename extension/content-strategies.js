// Image Harvester - Content Strategies (URL transform + border highlight)
// Copyright (c) Jaewoo Jeon (@thejjw) and Image Harvester Contributors
// SPDX-License-Identifier: zlib-acknowledgement
//
// Depends on content-core.js (uses CONFIG, debug, urlStrategies, borderHighlight*).
// Loaded after content-core.js.

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

// 将 hex 色值转为 RGB 分量
function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const num = parseInt(h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

// Generate CSS for border highlighting (pulsing glow animation)
function generateBorderCSS() {
    const { r, g, b } = hexToRgb(borderHighlightColor);
    return `
@keyframes ih-glow-pulse {
    0%, 100% { box-shadow: 0 0 3px 1px rgba(${r},${g},${b},0.15), 0 0 0 0 rgba(${r},${g},${b},0.3); }
    50%      { box-shadow: 0 0 8px 3px rgba(${r},${g},${b},0.6), 0 0 0 1px rgba(${r},${g},${b},0.4); }
}
.ih-border-highlight-custom {
    outline: none !important;
    animation: ih-glow-pulse 1.5s ease-in-out infinite;
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
