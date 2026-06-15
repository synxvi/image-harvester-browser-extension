// Image Harvester - Content Core (globals, config, storage)
// Copyright (c) Jaewoo Jeon (@thejjw) and Image Harvester Contributors
// SPDX-License-Identifier: zlib-acknowledgement
//
// This file MUST load first in the manifest content_scripts js array.
// It declares all shared state + helpers consumed by the other content-*.js files.
// Loaded as a classic script in the content-script isolated world — all top-level
// `let`/`const`/`function` here are visible to subsequently-loaded content-*.js files.

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
    DEFAULT_GLOW_DELAY: 500,
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

// ===== Shared mutable state =====
// Hover / button lifecycle
let hoverTimer = null;
let currentImage = null;
let downloadButton = null;
let isEnabled = true;
let hoverDelay = CONFIG.DEFAULT_HOVER_DELAY; // 1.0 seconds default
let isDomainExcluded = false;
let minImageSize = CONFIG.MIN_IMAGE_SIZE;
let detectImg = true;
let borderHighlightMode = CONFIG.DEFAULT_BORDER_HIGHLIGHT;
let glowDelay = CONFIG.DEFAULT_GLOW_DELAY;
let detectVideo = true;
let detectSvg = false;
let detectBackground = false;
let convertWebpToPng = false;
let longHideDelay = false;
let isMouseOverButton = false; // Guard flag: prevents hiding while cursor is over the button
let isMouseOverImage = false; // Guard flag: prevents hiding while cursor is over the image
let glowTimer = null; // Tracks the pending glow timer
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
