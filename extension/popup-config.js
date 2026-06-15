// Image Harvester - Popup Config (globals, storage, DOM helpers)
// Copyright (c) Jaewoo Jeon (@thejjw) and Image Harvester Contributors
// SPDX-License-Identifier: zlib-acknowledgement
//
// MUST load first (after jszip.min.js), before popup-i18n.js and popup.js.
// Loaded as classic <script> tags sharing global scope (project convention).

// Extension version - update this when releasing new versions
const EXTENSION_VERSION = '1.6.5';

// Debug flag - set to false to disable all console output
const DEBUG = false;

// Debug console wrapper
const debug = {
    log: (...args) => DEBUG && console.log('[IH]', ...args),
    error: (...args) => DEBUG && console.error('[IH]', ...args),
    warn: (...args) => DEBUG && console.warn('[IH]', ...args),
    info: (...args) => DEBUG && console.info('[IH]', ...args)
};

// Forced diagnostic logger - ALWAYS outputs regardless of DEBUG flag
// Use this only for critical i18n/language diagnostics
const diag = {
    log: (...args) => console.log('[IH-DIAG]', ...args),
    error: (...args) => console.error('[IH-DIAG]', ...args)
};

// Configuration
const CONFIG = {
    DEFAULT_EXTENSIONS: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'mp4', 'webm', 'mov'],
    DEFAULT_EXTENSIONS_STRING: 'jpg,jpeg,png,gif,webp,svg,bmp,mp4,webm,mov',
    DEFAULT_HOVER_DELAY: 1000,
    MIN_IMAGE_SIZE: 100,
    DEFAULT_BORDER_HIGHLIGHT: 'off'
};

// Storage helper
const storage = {
    async get(key) {
        try {
            const result = await chrome.storage.sync.get(key);
            return result[key];
        } catch (error) {
            debug.error('Storage get error:', error);
            return null;
        }
    },

    async set(key, value) {
        try {
            await chrome.storage.sync.set({ [key]: value });
            return true;
        } catch (error) {
            debug.error('Storage set error:', error);
            return false;
        }
    }
};

// Show status message
function showStatus(message, type = 'success') {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = `status ${type}`;

    setTimeout(() => {
        status.textContent = '';
        status.className = 'status';
    }, 2000);
}

// Update delay display
function updateDelayDisplay(value) {
    const delayValue = document.getElementById('delayValue');
    delayValue.textContent = (value / 1000).toFixed(1) + 's';
}

// Sanitize a filename: strip filesystem-unsafe chars, keep CJK
function sanitizeFilename(filename) {
    // Remove only filesystem-unsafe characters, keep CJK characters
    // Use a safe approach without problematic regex ranges
    let result = '';
    for (let i = 0; i < filename.length; i++) {
        const char = filename.charAt(i);
        const code = filename.charCodeAt(i);

        // Remove filesystem-unsafe characters
        if ('<>:"/\\|?*'.includes(char)) {
            result += '_';
        }
        // Remove control characters (0-31 and 127)
        else if (code >= 0 && code <= 31 || code === 127) {
            result += '_';
        }
        // Keep all other characters (including CJK)
        else {
            result += char;
        }
    }

    return result
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .replace(/_{2,}/g, '_') // Replace multiple underscores with single
        .replace(/^_|_$/g, ''); // Trim leading/trailing underscores
}
