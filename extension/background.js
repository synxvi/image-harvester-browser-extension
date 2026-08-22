// Image Harvester - Background Script
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
    DEFAULT_HOVER_DELAY: 1000
};

// Helper: update badge for specific tab
// 注意：MV3 下无回调调用返回 Promise；badge 更新是异步的，回调执行时
// tab 可能已关闭，reject 的 promise 不 catch 会成为 unhandled rejection
// （"No tab with id"），进而污染 chrome://extensions 错误面板。
function updateBadge(disabled, excluded = false, tabId = null) {
    const text = disabled ? 'OFF' : (excluded ? 'X' : '');
    const color = '#c08040';
    
    if (tabId) {
        chrome.action.setBadgeText({ text, tabId }).catch(() => {});
        if (text) {
            chrome.action.setBadgeBackgroundColor({ color, tabId }).catch(() => {});
        }
    } else {
        chrome.action.setBadgeText({ text }).catch(() => {});
        if (text) {
            chrome.action.setBadgeBackgroundColor({ color }).catch(() => {});
        }
    }
    debug.log(`Badge updated: text="${text}", color="${color}", tabId=${tabId || 'all'}`);
}

// Set default settings on install (仅在首次安装时设置，重新加载不覆盖用户设置)
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        chrome.storage.sync.set({
            ih_enabled: true,
            ih_hover_delay: CONFIG.DEFAULT_HOVER_DELAY
        });
    }
    
    // Set initial badge state
    updateBadge(false, false);
    
    // Create context menu item for links
    chrome.contextMenus.create({
        id: "ih-download-link",
        title: chrome.i18n.getMessage("contextMenuDownloadLink"),
        contexts: ["link"],
        documentUrlPatterns: ["http://*/*", "https://*/*"]
    });
    
    // Create context menu item for videos
    chrome.contextMenus.create({
        id: "ih-download-video",
        title: chrome.i18n.getMessage("contextMenuDownloadVideo"),
        contexts: ["video"],
        documentUrlPatterns: ["http://*/*", "https://*/*"]
    });
    
    // Create context menu item for images
    chrome.contextMenus.create({
        id: "ih-download-image",
        title: chrome.i18n.getMessage("contextMenuDownloadImage"),
        contexts: ["image"],
        documentUrlPatterns: ["http://*/*", "https://*/*"]
    });
    
    debug.log('Extension installed, default settings applied');

    // 清理历史版本的 dynamic referer 规则（referer 规则现已改为 session 规则，
    // 浏览器关闭自动消失；旧 dynamic 规则会持久残留，需一次性清除）
    chrome.declarativeNetRequest.getDynamicRules((rules) => {
        const ruleIds = rules.map(r => r.id);
        if (ruleIds.length > 0) {
            chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: ruleIds });
            debug.log('Stale dynamic rules cleared on install');
        }
    });
    chrome.declarativeNetRequest.getSessionRules((rules) => {
        const ruleIds = rules.map(r => r.id);
        if (ruleIds.length > 0) {
            chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: ruleIds });
        }
    });
    chrome.storage.session.remove(REFERER_RULE_MAP_KEY).catch(() => {});
});

// Helper: check if a tab's URL is excluded and update badge accordingly
function updateBadgeForTab(tabId, url) {
    if (!url || !url.startsWith('http')) return;
    chrome.storage.sync.get(['ih_enabled', 'ih_domain_exclusions'], (data) => {
        const disabled = !data.ih_enabled;
        if (disabled) {
            updateBadge(true, false, tabId);
            return;
        }
        const exclusions = data.ih_domain_exclusions || [];
        try {
            const hostname = new URL(url).hostname.toLowerCase();
            const excluded = exclusions.some(e => {
                const d = e.toLowerCase();
                return hostname === d || hostname.endsWith('.' + d);
            });
            updateBadge(false, excluded, tabId);
        } catch (e) {
            updateBadge(false, false, tabId);
        }
    });
}

// On startup, set badge state for all tabs
chrome.runtime.onStartup.addListener(() => {
    chrome.storage.sync.get('ih_enabled', (data) => {
        const disabled = !data.ih_enabled;
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                updateBadgeForTab(tab.id, tab.url);
            });
        });
        debug.log('Extension startup, badge state set for all tabs');
    });

    // 清理旧版本遗留的 dynamic 规则；session 规则随浏览器关闭已自动消失
    chrome.declarativeNetRequest.getDynamicRules((rules) => {
        const ruleIds = rules.map(r => r.id);
        if (ruleIds.length > 0) {
            chrome.declarativeNetRequest.updateDynamicRules({
                removeRuleIds: ruleIds
            });
            debug.log('Stale dynamic rules cleared on startup');
        }
    });
});

// Debounce badge updates per tab to prevent flicker
const badgeTimers = new Map();
function debouncedUpdateBadgeForTab(tabId, url) {
    if (badgeTimers.has(tabId)) {
        clearTimeout(badgeTimers.get(tabId));
    }
    badgeTimers.set(tabId, setTimeout(() => {
        badgeTimers.delete(tabId);
        updateBadgeForTab(tabId, url);
    }, 100));
}

// Re-check badge when user switches tabs
chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId).then((tab) => {
        updateBadgeForTab(tab.id, tab.url);
    }).catch(() => {
        // 标签页可能已被关闭
    });
});

// Re-check badge when a tab finishes loading
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        debouncedUpdateBadgeForTab(tabId, tab.url);
    }
});

// Listen for storage changes to update badges
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (changes.ih_enabled && areaName === 'sync') {
        const disabled = !changes.ih_enabled.newValue;
        debug.log('Extension enabled status changed:', !disabled);
        
        // Update badge for all tabs with proper exclusion check
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                updateBadgeForTab(tab.id, tab.url);
            });
        });
    }
    
    if (changes.ih_domain_exclusions && areaName === 'sync') {
        debug.log('Domain exclusions changed, content scripts will update automatically');
        // Content scripts will detect the storage change automatically
    }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "ih-download-link") {
        downloadLinkDirectly(info.linkUrl);
    } else if (info.menuItemId === "ih-download-video") {
        downloadVideoDirectly(info.srcUrl, tab);
    } else if (info.menuItemId === "ih-download-image") {
        downloadImageDirectly(info.srcUrl, tab);
    }
});

// ===== 近期下载记录（popup「下载记录」tab 的数据源）=====
// 记录生命周期：downloadImage/downloadCanvasImage 入口创建 pending 记录，
// downloads.onChanged 的 complete/interrupted 或各失败分支将其终结为 success/failed。
// 保留策略：近 7 天内最多 300 条（写入时统一裁剪，无需定时清理）。
const DOWNLOAD_HISTORY_KEY = 'ih_download_history';
const DOWNLOAD_HISTORY_MAX = 300;
const DOWNLOAD_HISTORY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// data:/blob: 这类超长 URL 不适合整段入 storage，仅保留截断标记
function safeUrlForRecord(url) {
    if (!url) return '';
    if (url.length > 500) return url.slice(0, 200) + '…(truncated)';
    return url;
}

async function recordDownloadStart(meta) {
    const record = {
        id: 'dl_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
        filename: meta.filename || 'media',
        url: safeUrlForRecord(meta.url),
        status: 'pending', // pending | success | failed
        error: null,
        ts: Date.now(),
        downloadId: null,
        mode: meta.mode || 'normal',      // 下载模式，重试时恢复
        pathIndex: meta.pathIndex ?? -1,  // 保存路径索引，重试时恢复
        // 下载来源：hover(悬浮按钮/多路径工具栏) | context(右键菜单) | zip(批量打包)，
        // 记录面板据此标注；老记录无此字段，渲染时按 hover 处理
        source: meta.source || 'hover',
        note: meta.note || null           // 批量下载的汇总信息（成功/跳过数）等
    };
    try {
        const data = await chrome.storage.local.get(DOWNLOAD_HISTORY_KEY);
        let list = Array.isArray(data[DOWNLOAD_HISTORY_KEY]) ? data[DOWNLOAD_HISTORY_KEY] : [];
        list.unshift(record);
        // 裁剪：只保留 7 天内的记录，且最多 300 条
        const cutoff = Date.now() - DOWNLOAD_HISTORY_TTL_MS;
        list = list.filter(r => (r.ts || 0) >= cutoff).slice(0, DOWNLOAD_HISTORY_MAX);
        await chrome.storage.local.set({ [DOWNLOAD_HISTORY_KEY]: list });
    } catch (e) {
        debug.warn('写入下载记录失败:', e);
    }
    // 开启心跳：无 downloadId 的 pending（如 fetch 阶段）由校正逻辑超时终结
    scheduleDownloadReconcile();
    return record;
}

// 按 record.id 更新状态；downloadId 产生后需先绑定再由 onChanged 驱动终结
async function patchDownloadRecord(recordId, patch) {
    if (!recordId) return;
    try {
        const data = await chrome.storage.local.get(DOWNLOAD_HISTORY_KEY);
        const list = Array.isArray(data[DOWNLOAD_HISTORY_KEY]) ? data[DOWNLOAD_HISTORY_KEY] : [];
        const rec = list.find(r => r.id === recordId);
        if (rec) {
            Object.assign(rec, patch);
            await chrome.storage.local.set({ [DOWNLOAD_HISTORY_KEY]: list });
        }
    } catch (e) {
        debug.warn('更新下载记录失败:', e);
    }
}

// downloadId → recordId 内存映射：downloads.download 对 dataUrl 的下载几乎瞬间
// 完成，onChanged(complete/interrupted) 可能先于「记录绑定 downloadId 落盘」触发，
// 此时按 storage 里的 downloadId 字段查不到记录。绑定时先写内存映射，
// onChanged 优先查内存，落盘字段仅作 SW 重启后的兜底。
const recordIdByDownloadId = new Map();

async function bindDownloadRecord(recordId, downloadId, extra = {}) {
    if (!recordId || downloadId === undefined) return;
    recordIdByDownloadId.set(downloadId, recordId);
    await patchDownloadRecord(recordId, { downloadId, ...extra });
    // onChanged 可能因 SW 休眠丢失，心跳校正兜底
    scheduleDownloadReconcile();
}

// 按 downloadId 更新状态（onChanged 回调只有 downloadId，没有 record.id）
async function patchDownloadRecordByDownloadId(downloadId, patch) {
    const recordId = recordIdByDownloadId.get(downloadId);
    if (recordId) {
        if (patch.status) recordIdByDownloadId.delete(downloadId); // 终态，解除映射
        await patchDownloadRecord(recordId, patch);
        return;
    }
    try {
        const data = await chrome.storage.local.get(DOWNLOAD_HISTORY_KEY);
        const list = Array.isArray(data[DOWNLOAD_HISTORY_KEY]) ? data[DOWNLOAD_HISTORY_KEY] : [];
        const rec = list.find(r => r.downloadId === downloadId);
        if (rec) {
            Object.assign(rec, patch);
            await chrome.storage.local.set({ [DOWNLOAD_HISTORY_KEY]: list });
        }
    } catch (e) {
        debug.warn('按 downloadId 更新下载记录失败:', e);
    }
}

// SW 冷启动时清理孤儿 pending：上次会话 SW 被杀导致终态无人写入
// （direct download 由浏览器进程继续，但 onChanged 已无人监听），
// 超过 30 分钟仍 pending 的记录标记为结果未知。
(async () => {
    try {
        const data = await chrome.storage.local.get(DOWNLOAD_HISTORY_KEY);
        const list = Array.isArray(data[DOWNLOAD_HISTORY_KEY]) ? data[DOWNLOAD_HISTORY_KEY] : [];
        let changed = false;
        list.forEach(r => {
            if (r.status === 'pending' && Date.now() - (r.ts || 0) > 30 * 60 * 1000) {
                r.status = 'failed';
                r.error = 'RESULT_UNKNOWN (service worker restarted)';
                changed = true;
            }
        });
        if (changed) await chrome.storage.local.set({ [DOWNLOAD_HISTORY_KEY]: list });
    } catch (e) { /* ignore */ }
})();

// 通知对应页面下载失败（content 弹红色 toast）
function notifyDownloadFailed(tabId, filename, error) {
    if (!tabId) return;
    chrome.tabs.sendMessage(tabId, {
        type: 'download_failed',
        filename: filename || '',
        error: error || ''
    }).catch(() => {});
}

// 下载完成/失败的 toast 发往用户当前所在的活动标签页：大图下载耗时较长，
// 期间用户常已切走，发回发起页的 toast 用户看不到。活动页无 content script
// （chrome:// 等受限页面）时 sendMessage 会失败，静默跳过即可。
async function notifyActiveTabToast(payload) {
    try {
        const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (tab && tab.id != null) {
            await chrome.tabs.sendMessage(tab.id, payload);
        }
    } catch (e) {
        debug.log('活动页 toast 发送失败（可能为受限页面）:', e.message);
    }
}

// 终态 toast 附带最终文件名：downloads.search 取浏览器落盘（含自动改名）的
// 真实文件名，查不到时无文件名照样提示
async function notifyDownloadResultToast(downloadId, payload) {
    try {
        const items = await chrome.downloads.search({ id: downloadId });
        if (items && items[0] && items[0].filename) {
            payload.filename = items[0].filename.split(/[\/]/).pop();
        }
    } catch (e) { /* 忽略 */ }
    notifyActiveTabToast(payload);
}

// ===== pending 记录心跳校正 =====
// MV3 的 SW 在无活动 30 秒后被终止；downloads.download 返回后大 dataUrl 的
// 写盘由浏览器进程完成（可能持续几十秒~分钟），期间 SW 已休眠，
// 死在休眠期的 onChanged(complete/interrupted) 事件不会重放 → 记录永远 pending。
// 通过 alarm 心跳让 SW 周期性唤醒，用 downloads.search 主动查询下载项真实状态
// 并校正记录（查询不依赖事件投递，跨 SW 会话可靠）。
const RECONCILE_ALARM = 'ih-dl-reconcile';
const RECONCILE_PERIOD_MIN = 0.5; // alarm 最小周期 30 秒

function scheduleDownloadReconcile() {
    chrome.alarms.create(RECONCILE_ALARM, {
        delayInMinutes: RECONCILE_PERIOD_MIN,
        periodInMinutes: RECONCILE_PERIOD_MIN
    }).catch(() => {});
}

async function reconcilePendingDownloads() {
    let list = [];
    try {
        const data = await chrome.storage.local.get(DOWNLOAD_HISTORY_KEY);
        list = Array.isArray(data[DOWNLOAD_HISTORY_KEY]) ? data[DOWNLOAD_HISTORY_KEY] : [];
    } catch (e) {
        return;
    }

    const pendings = list.filter(r => r.status === 'pending');
    if (pendings.length === 0) {
        chrome.alarms.clear(RECONCILE_ALARM).catch(() => {});
        return;
    }

    let changed = false;
    for (const rec of pendings) {
        if (rec.downloadId != null) {
            try {
                const items = await chrome.downloads.search({ id: rec.downloadId });
                if (items.length === 1) {
                    const state = items[0].state;
                    if (state === 'complete') {
                        rec.status = 'success';
                        changed = true;
                    } else if (state === 'interrupted') {
                        rec.status = 'failed';
                        rec.error = items[0].error || 'INTERRUPTED';
                        changed = true;
                    }
                    // in_progress → 保持 pending，下轮心跳再查
                } else {
                    // 下载项已不存在（被删除/浏览器重装），无法确认结果
                    rec.status = 'failed';
                    rec.error = 'DOWNLOAD_ITEM_NOT_FOUND';
                    changed = true;
                }
            } catch (e) {
                debug.warn('校正下载记录失败:', rec.id, e);
            }
        } else if (Date.now() - (rec.ts || 0) > 3 * 60 * 1000) {
            // 长时间未获得 downloadId：SW 在 fetch 阶段被终止、请求协程被丢弃
            rec.status = 'failed';
            rec.error = 'REQUEST_INTERRUPTED';
            changed = true;
        }
    }

    if (changed) {
        try {
            await chrome.storage.local.set({ [DOWNLOAD_HISTORY_KEY]: list });
        } catch (e) {
            debug.warn('保存校正后的下载记录失败:', e);
        }
    }

    if (!list.some(r => r.status === 'pending')) {
        chrome.alarms.clear(RECONCILE_ALARM).catch(() => {});
    }
}

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === RECONCILE_ALARM) {
        reconcilePendingDownloads();
    }
});

// Handle download requests from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const tabId = sender.tab?.id;

    if (message.type === 'download_image') {
        downloadImage(message.url, message.filename, message.downloadMode, message.pathIndex, tabId, message.source || 'hover');
    } else if (message.type === 'download_canvas_image') {
        downloadCanvasImage(message.dataUrl, message.filename, message.pathIndex, tabId, null, message.source || 'hover');
    } else if (message.type === 'check_webp_animated') {
        // Check if WebP is animated (runs in background to bypass CORS)
        checkWebPAnimated(message.url).then(result => {
            sendResponse({ isAnimated: result });
        }).catch(error => {
            debug.error('Error checking WebP animation:', error);
            sendResponse({ isAnimated: null });
        });
        return true; // Keep message channel open for async response
    } else if (message.type === 'fetch_webp_for_conversion') {
        // Fetch full WebP image and return as data URL (bypasses CORS)
        fetchImageAsDataUrl(message.url).then(dataUrl => {
            sendResponse({ success: !!dataUrl, dataUrl: dataUrl });
        }).catch(error => {
            debug.error('Error fetching WebP image:', error);
            sendResponse({ success: false, dataUrl: null });
        });
        return true; // Keep message channel open for async response
    } else if (message.type === 'record_download_failed') {
        // content 侧 canvas/WebP blob 的下载消息本身发送失败（如超消息上限），
        // background 侧无感知，由 content 主动补记一条失败记录
        recordDownloadStart({ filename: message.filename, url: message.url })
            .then(rec => patchDownloadRecord(rec.id, { status: 'failed', error: message.error || 'MESSAGE_SEND_FAILED' }))
            .catch(() => {});
    } else if (message.type === 'retry_download') {
        // popup「下载记录」失败条目的重试：按原记录恢复 URL/文件名/模式/路径/来源。
        // 无 tabId（发起页面可能已关闭），结果由下载记录/心跳校正呈现。
        if (message.mode === 'direct') {
            // 视频/链接右键直下模式：不走 fetch→dataUrl 管线（大文件 base64 会撑爆 SW）
            downloadDirectWithRecord(message.url, message.filename || 'media', message.source || 'context', 'direct');
        } else {
            downloadImage(message.url, message.filename, message.mode || 'normal', message.pathIndex ?? -1, null, message.source || 'hover');
        }
    } else if (message.type === 'record_batch_result') {
        // popup 批量 ZIP 的结果入记录：ZIP 由 popup 侧落盘，此处补建记录并绑定
        // downloadId，终态由 onChanged 驱动；若 onChanged 先于绑定到达（ZIP 落盘
        // 极快），由 30s 心跳校正兜底为最终一致。
        recordDownloadStart({
            filename: message.filename || 'images.zip',
            url: message.url || '',
            source: 'zip',
            mode: 'normal',
            pathIndex: -1,
            note: message.note || null
        }).then(rec => {
            if (message.downloadId != null) {
                return bindDownloadRecord(rec.id, message.downloadId);
            }
            if (message.status === 'failed') {
                return patchDownloadRecord(rec.id, { status: 'failed', error: message.error || 'DOWNLOAD_FAILED' });
            }
        }).catch(() => {});
    } else if (message.type === 'ih:domain_status_changed') {
        // Only handle from top-level frame
        if (sender.frameId !== undefined && sender.frameId !== 0) {
            return;
        }
        // Badge is managed by background via onActivated/onUpdated, ignore duplicate updates
    } else if (message.type === 'ih:request_referer_rule') {
        addRefererRule(message.mediaHost, message.referer).catch(e => {
            debug.error('Failed to update referer rule:', e);
        });
    }
});

// Referer 规则的 host→ruleId 映射持久化在 storage.session（浏览器生命周期内
// 有效），SW 重启后仍能防止同 host 重复注册；规则本身也用 session 规则，
// 浏览器关闭自动消失，无需启动清理。
const REFERER_RULE_MAP_KEY = 'ih_referer_rule_map';

// Dynamic rule management for referer spoofing
async function addRefererRule(mediaHost, referer) {
    try {
        const data = await chrome.storage.session.get(REFERER_RULE_MAP_KEY);
        const map = data[REFERER_RULE_MAP_KEY] || {};
        if (map[mediaHost] != null) return; // 已注册（含 SW 重启前的注册）

        // 规则 id 需避开现存 session 规则，取当前最大 id + 1
        const existing = await chrome.declarativeNetRequest.getSessionRules();
        const id = existing.reduce((max, r) => Math.max(max, r.id), 1000) + 1;

        const rule = {
            id: id,
            priority: 1,
            action: {
                type: 'modifyHeaders',
                requestHeaders: [
                    { header: 'referer', operation: 'set', value: referer },
                    { header: 'origin', operation: 'remove' }
                ],
                responseHeaders: [

                    { header: 'access-control-allow-origin', operation: 'set', value: '*' },
                    { header: 'access-control-allow-headers', operation: 'set', value: '*' }
                ]
            },
            condition: {
                // requestDomains 锚定域名（含子域），避免 urlFilter 子串误伤
                // URL 中恰好包含该字符串的其它请求
                requestDomains: [mediaHost],
                resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest', 'media', 'image', 'other']
            }
        };

        await chrome.declarativeNetRequest.updateSessionRules({ addRules: [rule] });
        map[mediaHost] = id;
        await chrome.storage.session.set({ [REFERER_RULE_MAP_KEY]: map });
        debug.log(`Session referer rule added for host: ${mediaHost} (ID: ${id}) with referer: ${referer}`);
    } catch (e) {
        debug.error(`Error adding referer rule for ${mediaHost}:`, e);
    }
}

// Content-Type → 扩展名映射（原 content fast path 的格式保留逻辑收口至此）
const CONTENT_TYPE_EXTS = {
    'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif',
    'image/webp': '.webp', 'image/svg+xml': '.svg', 'image/bmp': '.bmp',
    'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov'
};

// 若文件名扩展名与实际 Content-Type 不符，则修正为正确扩展名
function applyContentTypeExtension(filename, contentType) {
    const correctExt = CONTENT_TYPE_EXTS[(contentType || '').split(';')[0].trim()];
    if (!correctExt) return filename;
    const currentExt = '.' + (filename.split('.').pop() || '').toLowerCase();
    // jpg/jpeg 视为等价，避免无意义的重命名
    const equiv = { '.jpg': ['.jpeg'], '.jpeg': ['.jpg'] };
    const allowed = equiv[currentExt] || [];
    if (currentExt !== correctExt && !allowed.includes(correctExt)) {
        return filename.replace(/\.[^.]+$/, correctExt);
    }
    return filename;
}

function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => reader.result ? resolve(reader.result) : reject(new Error('FileReader empty'));
        reader.onerror = () => reject(reader.error || new Error('FileReader error'));
        reader.readAsDataURL(blob);
    });
}

// Download image function
async function downloadImage(url, filename, downloadMode = 'normal', pathIndex = -1, tabId = null, source = 'hover') {
    // Clean filename - remove any potentially problematic characters
    const cleanFilename = filename.replace(/[<>:"/\\|?*]/g, '_');
    const record = await recordDownloadStart({ filename: cleanFilename, url, mode: downloadMode || 'normal', pathIndex: pathIndex ?? -1, source });

    try {
        // 优先通过 background 的 fetch 下载（DNR 规则生效且无 CORS 限制）
        // 这对依赖 Referer 验证的站点（如 Pixiv）至关重要。
        // 大图内容全程留在 SW 内转 dataUrl，不经过扩展消息通道（无 64MB 消息上限、
        // 页面主线程不做 base64 编码），修复大图连续下载偶发丢失的问题。
        try {
            const response = await fetch(url);
            if (response.ok) {
                const blob = await response.blob();
                if (blob && blob.size > 0) {
                    const finalFilename = applyContentTypeExtension(cleanFilename, response.headers.get('Content-Type') || blob.type);
                    const dataUrl = await blobToDataUrl(blob);
                    await downloadCanvasImage(dataUrl, finalFilename, pathIndex, tabId, record);
                    debug.log(`Image fetched via background and downloaded: ${finalFilename}`);
                    return;
                }
                debug.warn('Background fetch returned empty blob, falling back to direct download');
            } else {
                debug.log('Background fetch failed with status', response.status, '- falling back to direct download');
            }
        } catch (fetchError) {
            debug.log('Background fetch failed, falling back to direct download:', fetchError.message);
        }

        // Fallback: direct chrome.downloads.download
        // （浏览器进程发起下载，不受 SW 生命周期影响）
        const downloadId = await chrome.downloads.download({
            url: url,
            filename: await buildDownloadPath(cleanFilename, pathIndex),
            saveAs: false
        });

        await bindDownloadRecord(record.id, downloadId, { filename: cleanFilename });

        debug.log(`Image download started: ${cleanFilename} (ID: ${downloadId}) - Mode: ${downloadMode} - PathIndex: ${pathIndex}`);
    } catch (error) {
        debug.error('Download failed:', error);

        // Fallback: try to download without custom filename
        try {
            const fallbackId = await chrome.downloads.download({
                url: url,
                saveAs: false
            });
            await bindDownloadRecord(record.id, fallbackId);
        } catch (fallbackError) {
            debug.error('Fallback download also failed:', fallbackError);
            const errMsg = fallbackError.message || String(fallbackError);
            await patchDownloadRecord(record.id, { status: 'failed', error: errMsg });
            notifyDownloadFailed(tabId, cleanFilename, errMsg);
        }
    }
}

// Download canvas-extracted image (or fast-path blob) from data URL
// record: 复用调用方已创建的下载记录（downloadImage fetch 成功路径），
//         不传则自建（content 的 canvas/WebP 转换 blob 直接调用）。
async function downloadCanvasImage(dataUrl, filename, pathIndex = -1, tabId = null, record = null, source = 'hover') {
    let rec = record;
    if (!rec) {
        rec = await recordDownloadStart({ filename, url: dataUrl, mode: 'converted', pathIndex: pathIndex ?? -1, source });
    }

    try {
        debug.log('Downloading canvas/fast-path image:', filename);

        // Clean filename - remove any potentially problematic characters
        const cleanFilename = filename.replace(/[<>:"/\\|?*]/g, '_');

        const downloadId = await chrome.downloads.download({
            url: dataUrl,
            filename: await buildDownloadPath(cleanFilename, pathIndex),
            saveAs: false // Save to default downloads folder without dialog
        });

        await bindDownloadRecord(rec.id, downloadId, { filename: cleanFilename });

        debug.log(`Canvas/Fast-path image download started: ${cleanFilename} (ID: ${downloadId})`);

    } catch (error) {
        debug.error('Canvas/Fast-path image download failed:', error);
        const errMsg = error.message || String(error);
        await patchDownloadRecord(rec.id, { status: 'failed', error: errMsg });
        notifyDownloadFailed(tabId, filename, errMsg);
    }
}

// ====== 浏览器原生图片下载入记录（source='browser'）======
// Chrome 原生「图片另存为」、网页 <a> 链接点下的图片等不经过扩展，靠
// downloads.onCreated 全局监听补录。判据：DownloadItem.byExtensionId ——
// 扩展（本扩展有各自记录管线，其他扩展不相关）发起的下载会带该字段，
// 原生下载不会，据此精确去重。
function isImageFilename(name) {
    return /\.(jpe?g|png|gif|webp|svg|bmp|tiff?|ico|avif|apng|heic)$/i.test(name || '');
}

chrome.downloads.onCreated.addListener((item) => {
    try {
        if (item.byExtensionId) return;

        // 创建时 filename/mime 可能尚未确定，任一信号命中图片即记录
        const mimeOk = !!(item.mime && item.mime.toLowerCase().startsWith('image/'));
        const filename = (item.filename || '').split(/[\\/]/).pop();
        let urlOk = false;
        const rawUrl = item.finalUrl || item.url || '';
        try { urlOk = isImageFilename(new URL(rawUrl).pathname); } catch { /* 非法 URL 忽略 */ }
        if (!mimeOk && !isImageFilename(filename) && !urlOk) return;

        let urlBasename = 'image';
        try { urlBasename = decodeURIComponent(new URL(rawUrl).pathname.split('/').pop()) || 'image'; } catch { /* 保底 */ }

        recordDownloadStart({
            filename: filename || urlBasename,
            url: rawUrl,
            source: 'browser',
            mode: 'normal',
            pathIndex: -1
        }).then(rec => bindDownloadRecord(rec.id, item.id)).catch(() => {});
    } catch (e) {
        debug.warn('记录浏览器原生图片下载失败:', e);
    }
});

// 监听下载状态变化：complete → 通知页面 + 记录置成功；
// interrupted（网络错误/被取消/被安全软件拦截等）→ 通知页面失败 + 记录置失败。
chrome.downloads.onChanged.addListener((delta) => {
    // 原生下载创建时 filename 可能为空（另存为对话框/重定向后才确定），
    // 文件名 delta 到达时补写记录（取 basename，扩展自身记录同样受益于最终名）
    if (delta.filename && delta.filename.current) {
        const finalName = delta.filename.current.split(/[\\/]/).pop();
        if (finalName) patchDownloadRecordByDownloadId(delta.id, { filename: finalName });
    }

    if (!delta.state) return;

    if (delta.state.current === 'complete') {
        notifyDownloadResultToast(delta.id, { type: 'download_complete' });
        patchDownloadRecordByDownloadId(delta.id, { status: 'success' });
    } else if (delta.state.current === 'interrupted') {
        const errCode = (delta.error && delta.error.current) || 'INTERRUPTED';
        notifyDownloadResultToast(delta.id, { type: 'download_failed', error: errCode });
        patchDownloadRecordByDownloadId(delta.id, { status: 'failed', error: errCode });
        debug.log('Download interrupted:', delta.id, errCode);
    }
});

// Build full download path by prepending base subfolder + configured subfolder or multi-path subfolder
async function getBaseSubfolder() {
    try {
        const data = await chrome.storage.sync.get('ih_base_subfolder');
        let baseSubfolder = data.ih_base_subfolder;
        if (baseSubfolder && typeof baseSubfolder === 'string') {
            // Sanitize: strip illegal characters, leading/trailing slashes
            baseSubfolder = baseSubfolder.replace(/[<>:"\\|?*]/g, '').replace(/^[/\\]+|[/\\]+$/g, '');
            if (baseSubfolder.length > 0 && baseSubfolder.length <= 200) {
                return baseSubfolder;
            }
        }
    } catch (error) {
        debug.error('Error getting base subfolder:', error);
    }
    return '';
}

async function buildDownloadPath(filename, pathIndex = -1) {
    const baseDir = await getBaseSubfolder();

    if (pathIndex >= 0) {
        // Multi-path mode: use the specific path at this index
        const paths = await getMultiPaths();
        if (paths && paths[pathIndex]) {
            let subfolder = paths[pathIndex].path;
            // Sanitize folder name
            subfolder = subfolder.replace(/[<>:"\\|?*]/g, '').replace(/^[/\\]+|[/\\]+$/g, '');
            if (subfolder.length > 0) {
                debug.log(`Multi-path download: using "${subfolder}" for index ${pathIndex}`);
                const fullPath = baseDir ? `${baseDir}/${subfolder}/${filename}` : `${subfolder}/${filename}`;
                return fullPath;
            }
        }
        // If pathIndex is out of range or invalid, fall through to base dir
        debug.log(`Multi-path index ${pathIndex} not found, falling back to base dir`);
    }

    if (baseDir) {
        return `${baseDir}/${filename}`;
    }
    return filename;
}

// Get configured multi-paths from storage
async function getMultiPaths() {
    try {
        const data = await chrome.storage.sync.get('ih_multi_paths');
        const paths = data.ih_multi_paths;
        if (Array.isArray(paths)) return paths;
    } catch (error) {
        debug.error('Error getting multi paths:', error);
    }
    return null;
}

// Shared function to generate and clean filenames
function generateCleanFilename(url, fallbackPrefix = 'download', fallbackExtension = '') {
    let filename;
    
    // Clean up URL - remove fragment identifiers like #t=0.01
    let cleanUrl = url;
    if (cleanUrl.includes('#')) {
        cleanUrl = cleanUrl.split('#')[0];
    }
    
    try {
        const urlObj = new URL(cleanUrl);
        filename = urlObj.pathname.split('/').pop();
        
        // Throw error if no filename from URL to use fallback logic
        if (!filename || filename === '') {
            throw new Error('No filename found in URL');
        }
    } catch (error) {
        debug.warn(`Using fallback filename for ${fallbackPrefix}:`, error.message);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        filename = `${fallbackPrefix}-${timestamp}${fallbackExtension}`;
    }
    
    // Clean filename - remove problematic characters and limit length
    let cleanFilename = filename.replace(/[<>:"/\\|?*]/g, '_');
    
    // Limit filename to 100 characters (conservative limit for most filesystems)
    if (cleanFilename.length > 100) {
        const ext = cleanFilename.lastIndexOf('.');
        if (ext > 0 && ext > cleanFilename.length - 10) {
            // Keep extension if it exists and is reasonable
            const extension = cleanFilename.substring(ext);
            const basename = cleanFilename.substring(0, ext);
            cleanFilename = basename.substring(0, 100 - extension.length) + extension;
        } else {
            cleanFilename = cleanFilename.substring(0, 100);
        }
    }
    
    return cleanFilename;
}

// Check if a WebP image is animated by examining its file header
// This runs in the background script context to bypass CORS restrictions
async function checkWebPAnimated(url) {
    try {
        debug.log('Checking if WebP is animated (background):', url);
        
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
        return null;
    }
}

// Fetch image and convert to data URL (bypasses CORS)
async function fetchImageAsDataUrl(url) {
    try {
        debug.log('Fetching image for conversion (background):', url);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            debug.warn('Failed to fetch image:', response.status);
            return null;
        }
        
        const blob = await response.blob();
        
        // Convert blob to data URL
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = () => {
                debug.error('Failed to convert blob to data URL');
                resolve(null);
            };
            reader.readAsDataURL(blob);
        });
        
    } catch (error) {
        debug.warn('Error fetching image as data URL:', error);
        return null;
    }
}

// 右键菜单等直链场景的统一落盘口：chrome.downloads.download 直下（不经
// fetch→dataUrl 管线，适合视频/大文件），创建下载记录并绑定 downloadId，
// 终态由 downloads.onChanged 驱动。失败时兜底为不带文件名的直下。
async function downloadDirectWithRecord(url, filename, source = 'context', mode = 'direct') {
    const record = await recordDownloadStart({ filename, url, source, mode, pathIndex: -1 });
    try {
        const downloadId = await chrome.downloads.download({
            url: url,
            filename: await buildDownloadPath(filename),
            saveAs: false
        });
        await bindDownloadRecord(record.id, downloadId, { filename });
        debug.log(`Direct download started: ${filename} (ID: ${downloadId})`);
        return true;
    } catch (error) {
        debug.error('Error downloading directly:', error);
        // Fallback: try to download without custom filename
        try {
            const fallbackId = await chrome.downloads.download({
                url: url,
                saveAs: false
            });
            await bindDownloadRecord(record.id, fallbackId, { filename });
            return true;
        } catch (fallbackError) {
            debug.error('Fallback direct download also failed:', fallbackError);
            await patchDownloadRecord(record.id, { status: 'failed', error: String(fallbackError?.message || error) });
            return false;
        }
    }
}

// Download link directly to default directory
async function downloadLinkDirectly(url) {
    debug.log('Downloading link directly:', url);
    const cleanFilename = generateCleanFilename(url, 'download', '-file');
    await downloadDirectWithRecord(url, cleanFilename, 'context', 'direct');
}

// Download video directly to default directory
async function downloadVideoDirectly(videoUrl, tab) {
    debug.log('Downloading video directly:', videoUrl);

    let cleanFilename = generateCleanFilename(videoUrl, 'video', '.mp4');

    // Ensure it has a video extension if none present
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.avi', '.mov', '.wmv', '.flv', '.mkv'];
    const hasVideoExtension = videoExtensions.some(ext =>
        cleanFilename.toLowerCase().endsWith(ext.toLowerCase())
    );

    if (!hasVideoExtension) {
        // Try to detect extension from URL or default to .mp4
        const urlLower = videoUrl.toLowerCase();
        const detectedExt = videoExtensions.find(ext => urlLower.includes(ext.toLowerCase()));
        cleanFilename += detectedExt || '.maybe.mp4';
    }

    // Clean up URL - remove fragment identifiers like #t=0.01
    let cleanUrl = videoUrl;
    if (cleanUrl.includes('#')) {
        cleanUrl = cleanUrl.split('#')[0];
    }

    await downloadDirectWithRecord(cleanUrl, cleanFilename, 'context', 'direct');
}

// Download image directly to default directory
async function downloadImageDirectly(imageUrl, tab) {
    debug.log('Downloading image directly:', imageUrl);

    let cleanFilename = generateCleanFilename(imageUrl, 'image', '.jpg');

    // Ensure it has an image extension if none present
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff', '.ico'];
    const hasImageExtension = imageExtensions.some(ext =>
        cleanFilename.toLowerCase().endsWith(ext.toLowerCase())
    );

    if (!hasImageExtension) {
        // Try to detect extension from URL or default to .jpg
        const urlLower = imageUrl.toLowerCase();
        const detectedExt = imageExtensions.find(ext => urlLower.includes(ext.toLowerCase()));
        cleanFilename += detectedExt || '.maybe.jpg';
    }

    // Clean up URL - remove fragment identifiers
    let cleanUrl = imageUrl;
    if (cleanUrl.includes('#')) {
        cleanUrl = cleanUrl.split('#')[0];
    }

    // 图片走统一下载管线：fetch 下载可按 Content-Type 修正扩展名，
    // 失败有完整回退链，并与其他来源共用下载记录/路径/通知逻辑
    await downloadImage(cleanUrl, cleanFilename, 'normal', -1, tab?.id ?? null, 'context');
}
