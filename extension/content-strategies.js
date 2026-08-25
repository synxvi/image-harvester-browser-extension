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

// Generate CSS for halo overlay（方案 B：position:fixed 浮层）
// 关键：浮层挂在 document.body 顶层，光晕向外发散不受任何祖先 overflow:hidden 裁剪。
// 浮层自身 pointer-events:none，不挡鼠标事件；z-index 略低于下载按钮(2147483647)。
function generateBorderCSS() {
    const { r, g, b } = hexToRgb(borderHighlightColor);
    return `
@keyframes ih-glow-pulse {
    0%, 100% { box-shadow: 0 0 3px 1px rgba(${r},${g},${b},0.15), 0 0 0 0 rgba(${r},${g},${b},0.3); }
    50%      { box-shadow: 0 0 8px 3px rgba(${r},${g},${b},0.6), 0 0 0 1px rgba(${r},${g},${b},0.4); }
}
.ih-halo-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    pointer-events: none;        /* 不挡 hover/click 事件，让 handleMouseEnter 正常触发 */
    border-radius: 0;            /* 大小/圆角由 JS 跟随目标计算 */
    z-index: 2147483646;         /* 仅低于下载按钮(2147483647)，高于页面其他元素 */
    animation: ih-glow-pulse 1.5s ease-in-out infinite;
    box-sizing: border-box;
}
`;
}

// Inject border CSS（注入 <style> 节点，颜色变化时复用同一节点重写 textContent）
function injectBorderCSS() {
    let style = document.getElementById('ih-border-styles');
    if (!style) {
        style = document.createElement('style');
        style.id = 'ih-border-styles';
        document.head.appendChild(style);
    }
    style.textContent = generateBorderCSS();
}

// 将 halo 浮层对齐到目标元素的当前视口位置
function positionHaloOverlay() {
    if (!haloOverlay || !haloTarget) return;
    const rect = haloTarget.getBoundingClientRect();
    // 目标不可见/尺寸过小则隐藏 halo，避免空浮层发光
    if (rect.width < 2 || rect.height < 2) {
        haloOverlay.style.display = 'none';
        return;
    }
    haloOverlay.style.display = haloAwaitingStable ? 'none' : 'block';
    haloOverlay.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
    haloOverlay.style.width = rect.width + 'px';
    haloOverlay.style.height = rect.height + 'px';
    // 圆角跟随目标元素的 computed border-radius（含百分比/简写），
    // 保证方形图就是方形光晕、圆角图就是圆角光晕。
    // 注意：不能凭宽高算半径，否则方形小图会被误判为完整圆形（直径=边长）。
    try {
        const cs = window.getComputedStyle(haloTarget);
        haloOverlay.style.borderRadius = cs.borderRadius || '0px';
    } catch (e) {
        haloOverlay.style.borderRadius = '0px';
    }
}

// 取消「等待矩形稳定」循环并复位隐藏标志（halo 销毁/重建时调用）
function cancelHaloStabilizeWait() {
    if (haloStabilizeRAF != null) {
        cancelAnimationFrame(haloStabilizeRAF);
        haloStabilizeRAF = null;
    }
    haloAwaitingStable = false;
}

// halo 新建后的防闪烁点亮：逐帧比对目标矩形，连续稳定后才真正显示。
// 背景：点击缩略图弹出 lightbox/查看器时（如 Discourse 点图放大），新大图入场瞬间
// rect 是过渡态——入场 transform 动画中间值，或先按缩略图占位布局、原图加载完成后
// 才定稿。若立即点亮，高光会以「原先小图」的尺寸闪现一次再跳到大图尺寸。
// 正常悬停场景图片早已静止，首帧即判定稳定，仅增加约一帧延迟（glowDelay 本就 500ms，无感）。
const HALO_STABLE_FRAMES = 3;      // 需连续稳定的帧数
const HALO_STABLE_EPSILON = 0.25;  // 视为「不变」的坐标误差（px）
const HALO_STABLE_TIMEOUT = 1000;  // 稳定等待上限：超时按最新矩形显示，后续仍由观察器校准
// 点击重构场景（查看器入场/缩放动画）的最短观察期：ease-out 尾段每帧位移极小，
// 仅凭帧间差会被误判为已稳定；多观察一段时间确保动画真正结束、尺寸定稿。
const HALO_STABLE_MIN_OBSERVE_CLICK = 200;

function scheduleHaloWhenStable() {
    cancelHaloStabilizeWait();
    haloAwaitingStable = true;
    const start = performance.now();
    // 仅点击重构场景要求最短观察期；普通悬停场景图片早已静止，无需额外等待
    const minObserve = (postClickContext && postClickContext.domChanged)
        ? HALO_STABLE_MIN_OBSERVE_CLICK
        : 0;
    let last = null;
    let stableCount = 0;
    const tick = () => {
        if (!haloOverlay || !haloTarget) {
            // 等待期间被销毁/切换目标，放弃点亮
            haloStabilizeRAF = null;
            return;
        }
        const rect = haloTarget.getBoundingClientRect();
        if (
            last &&
            Math.abs(rect.left - last.left) < HALO_STABLE_EPSILON &&
            Math.abs(rect.top - last.top) < HALO_STABLE_EPSILON &&
            Math.abs(rect.width - last.width) < HALO_STABLE_EPSILON &&
            Math.abs(rect.height - last.height) < HALO_STABLE_EPSILON
        ) {
            stableCount++;
        } else {
            stableCount = 0;
            last = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
        }
        if ((stableCount >= HALO_STABLE_FRAMES && performance.now() - start >= minObserve)
            || performance.now() - start >= HALO_STABLE_TIMEOUT) {
            haloStabilizeRAF = null;
            haloAwaitingStable = false;
            positionHaloOverlay();
            return;
        }
        haloStabilizeRAF = requestAnimationFrame(tick);
    };
    haloStabilizeRAF = requestAnimationFrame(tick);
}

// 为 halo 目标挂载跟随观察器（尺寸/属性/滚动/缩放）
function attachHaloObservers(target) {
    detachHaloObservers();

    haloResizeObserver = new ResizeObserver(() => positionHaloOverlay());
    haloResizeObserver.observe(target);

    haloMutationObserver = new MutationObserver(() => {
        positionHaloOverlay();
        // 属性变更（如 src 切换）后下一帧再校准一次，捕获布局重排后的位置
        requestAnimationFrame(positionHaloOverlay);
    });
    haloMutationObserver.observe(target, { attributes: true, attributeFilter: ['src', 'class', 'style'] });

    // 滚动用 capture 阶段：任何嵌套滚动容器滚动都能同步重定位，无需逐个绑定
    haloScrollHandler = () => positionHaloOverlay();
    window.addEventListener('scroll', haloScrollHandler, true);
    haloResizeHandler = () => positionHaloOverlay();
    window.addEventListener('resize', haloResizeHandler);
}

// 卸载 halo 观察器（不销毁浮层本身）
function detachHaloObservers() {
    if (haloResizeObserver) {
        haloResizeObserver.disconnect();
        haloResizeObserver = null;
    }
    if (haloMutationObserver) {
        haloMutationObserver.disconnect();
        haloMutationObserver = null;
    }
    if (haloScrollHandler) {
        window.removeEventListener('scroll', haloScrollHandler, true);
        haloScrollHandler = null;
    }
    if (haloResizeHandler) {
        window.removeEventListener('resize', haloResizeHandler);
        haloResizeHandler = null;
    }
}

// 完全销毁 halo 浮层（DOM + 观察器 + 目标引用）
function destroyHaloOverlay() {
    cancelHaloStabilizeWait();
    detachHaloObservers();
    if (haloOverlay && haloOverlay.parentNode) {
        haloOverlay.parentNode.removeChild(haloOverlay);
    }
    haloOverlay = null;
    haloTarget = null;
}

// Add/remove halo overlay（替代旧的给元素加 class 方案）
// 接口签名与旧实现保持一致，content.js 调用点无需改动。
function toggleBorderHighlight(element, show) {
    if (borderHighlightMode === 'off') {
        destroyHaloOverlay();
        return;
    }
    if (!element || !element.getBoundingClientRect) return;

    if (!show) {
        destroyHaloOverlay();
        return;
    }

    // 同一目标：仅复定位即可，避免动画重启闪烁
    if (haloTarget === element && haloOverlay && haloOverlay.parentNode) {
        positionHaloOverlay();
        return;
    }

    // 切换到新目标：先销毁旧的，保证任意时刻至多一个 halo
    destroyHaloOverlay('switch-target');

    const overlay = document.createElement('div');
    overlay.className = 'ih-halo-overlay';
    // body 直接子节点 → 不受任何祖先 overflow 裁剪
    document.body.appendChild(overlay);

    haloOverlay = overlay;
    haloTarget = element;
    // 防闪烁：先隐藏挂载，等目标矩形稳定（lightbox 入场动画/原图加载结束）后再点亮
    scheduleHaloWhenStable();
    positionHaloOverlay(); // 仅预写几何，display 由 awaiting 标志压住保持隐藏
    attachHaloObservers(element);
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
