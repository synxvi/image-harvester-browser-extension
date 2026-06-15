// Image Harvester - Filename Template Module
// Copyright (c) Jaewoo Jeon (@thejjw) and Image Harvester Contributors
// SPDX-License-Identifier: zlib-acknowledgement
//
// Shared by content.js (via manifest content_scripts js array) and popup pages
// (via <script src>). Loaded as a classic script — exposes `window.IHNaming`.

// Debug flag - mirrors other modules
const IH_NAMING_DEBUG = false;
const namingDebug = {
    log: (...args) => IH_NAMING_DEBUG && console.log('[IH Naming]', ...args),
    warn: (...args) => IH_NAMING_DEBUG && console.warn('[IH Naming]', ...args)
};

// Sanitize a filename: strip filesystem-illegal chars + collapse whitespace.
// Handles control chars and CJK correctly. Truncates basename to a safe length.
function sanitizeFilenameSafe(name, maxLen = 100) {
    if (!name || typeof name !== 'string') return '';
    let cleaned = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
    // Collapse whitespace runs
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    // Trim leading dots (avoid hidden files / path confusion)
    cleaned = cleaned.replace(/^\.+/, '');
    if (!cleaned) return '';
    if (cleaned.length > maxLen) {
        const extIdx = cleaned.lastIndexOf('.');
        if (extIdx > 0 && extIdx > cleaned.length - 10) {
            const ext = cleaned.substring(extIdx);
            cleaned = cleaned.substring(0, maxLen - ext.length) + ext;
        } else {
            cleaned = cleaned.substring(0, maxLen);
        }
    }
    return cleaned;
}

// Pad a number with leading zeros.
function pad2(n) {
    return n < 10 ? '0' + n : String(n);
}

// Build the template context from page + media info.
// All fields are best-effort; missing values resolve to empty strings so
// templates degrade gracefully instead of erroring.
function buildNamingContext({ pageUrl, pageTitle, mediaUrl, defaultExtension, originalUrl, strategy, index }) {
    let site = '';
    let title = '';
    let pathnameFile = 'media';
    let ext = defaultExtension ? '.' + defaultExtension.replace(/^\./, '') : '';

    try {
        const u = new URL(pageUrl || (typeof window !== 'undefined' ? window.location.href : ''));
        site = u.hostname.replace(/^www\./, '');
    } catch (e) {
        if (typeof window !== 'undefined') site = (window.location.hostname || '').replace(/^www\./, '');
    }

    if (pageTitle != null) {
        title = pageTitle;
    } else if (typeof document !== 'undefined') {
        title = document.title || '';
    }
    // Clean + truncate title (50 chars, filesystem-safe)
    title = sanitizeFilenameSafe(title, 50);

    // Pull basename + extension from the (post-transform) media URL
    try {
        const mUrl = new URL(mediaUrl, typeof window !== 'undefined' ? window.location.href : undefined);
        pathnameFile = mUrl.pathname.split('/').pop() || 'media';
        const dot = pathnameFile.lastIndexOf('.');
        if (dot > 0 && dot < pathnameFile.length - 1) {
            ext = pathnameFile.substring(dot).toLowerCase();
            pathnameFile = pathnameFile.substring(0, dot);
        }
    } catch (e) {
        // data: URL or invalid — keep defaults
    }

    const now = new Date();
    const date = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
    const datetime = `${date}_${pad2(now.getHours())}-${pad2(now.getMinutes())}-${pad2(now.getSeconds())}`;

    const filename = sanitizeFilenameSafe(pathnameFile, 80) || 'media';

    // {index}: only filled when explicitly provided (multi-image scenarios)
    const indexStr = (index != null && index >= 0) ? pad2(index) : '';

    return {
        site,
        title,
        date,
        datetime,
        index: indexStr,
        ext,
        filename,
        pageUrl: pageUrl || (typeof window !== 'undefined' ? window.location.href : ''),
        originalUrl: originalUrl || mediaUrl || '',
        strategy: strategy || ''
    };
}

// Replace placeholders {key} in template with ctx values.
// Unknown placeholders are left untouched (so users see their typo).
// Returns '' if template is empty or yields nothing meaningful.
function renderTemplate(template, ctx) {
    if (!template || typeof template !== 'string' || !template.trim()) return '';
    let rendered = template.replace(/\{(\w+)\}/g, (match, key) => {
        if (Object.prototype.hasOwnProperty.call(ctx, key)) {
            return ctx[key] != null ? String(ctx[key]) : '';
        }
        return match;
    });
    // If template didn't include {ext} explicitly, append it to keep files valid
    if (!/\{ext\}/.test(template) && ctx.ext) {
        rendered += ctx.ext;
    }
    rendered = sanitizeFilenameSafe(rendered, 100);
    return rendered;
}

// Expose public API. Use `var`-free modern globals; attach to window when
// available (content + popup contexts).
const IHNaming = {
    sanitizeFilename: sanitizeFilenameSafe,
    buildContext: buildNamingContext,
    renderTemplate
};

if (typeof window !== 'undefined') {
    window.IHNaming = IHNaming;
}
