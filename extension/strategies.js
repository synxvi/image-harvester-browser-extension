// URL 转换策略管理页面 JavaScript for Image Harvester
// Copyright (c) Jaewoo Jeon (@thejjw) and Image Harvester Contributors
// SPDX-License-Identifier: zlib-acknowledgement

const EXTENSION_VERSION = '1.6.1';

const DEBUG = false;

const debug = {
    log: (...args) => DEBUG && console.log('[IH Strategies]', ...args),
    error: (...args) => DEBUG && console.error('[IH Strategies]', ...args),
    warn: (...args) => DEBUG && console.warn('[IH Strategies]', ...args),
    info: (...args) => DEBUG && console.info('[IH Strategies]', ...args)
};

// ====== i18n Internationalization Module ======
const i18n = {
    currentLocale: 'auto',

    translations: {
        en: {
            // 页面标题
            strategiesPageTitle: 'Image Harvester - URL Transform Strategies',
            strategiesTitle: '🔗 Thumbnail Direct Download',
            strategiesSubtitle: 'Configure regex rules to download original images directly from thumbnails on hover',

            // 预设区
            presetSection: 'Built-in Presets',
            presetHelp: 'Built-in strategies for common websites. Enable/disable as needed. When enabled, the extension automatically converts thumbnail URLs to original image URLs on the corresponding website. Strategies for the same domain are mutually exclusive — enabling one will disable others for that domain.',
            loading: 'Loading...',

            // 自定义区
            customSection: 'Custom Strategies',
            customHelp: 'Add custom URL transformation rules. Supports regex matching and replacement.',
            nameLabel: 'Name',
            domainLabel: 'Domain',
            matchLabel: 'Match Regex',
            replaceLabel: 'Replace String',
            namePlaceholder: 'e.g. Weibo Original',
            domainPlaceholder: 'e.g. weibo.com',
            matchPlaceholder: 'e.g. ^(https?://[^?]+)\\?.*$',
            replacePlaceholder: 'e.g. $1',
            addStrategyBtn: 'Add Strategy',
            emptyPresets: 'No preset strategies',
            emptyCustoms: 'No custom strategies',

            // 测试区
            testSection: 'Test Tool',
            testUrlLabel: 'Test URL',
            testMatchLabel: 'Match Regex',
            testReplaceLabel: 'Replace String',
            testUrlPlaceholder: 'Paste a thumbnail URL to test',
            testMatchPlaceholder: 'Match rule',
            testReplacePlaceholder: 'Replace rule',
            testBtn: 'Test',
            testFillAllFields: 'Please fill in all fields',
            testSuccess: 'Match successful',
            testUrlOriginal: 'Original:',
            testUrlResult: 'Result:',
            testNoMatch: 'No match — the regex does not match the input URL',
            testRegexError: 'Regex error: ',

            // 导入导出
            importExportSection: 'Import / Export',
            exportBtn: 'Export Strategies',
            importBtn: 'Import Strategies',

            // 示例
            examplesTitle: 'Rule Examples',
            exampleTwitter: '<code>Match: ^(https?://pbs\\.twimg\\.com/media/[^?]+)\\?format=(\\w+)&name=.*$</code><br><code>Replace: $1.$2:orig</code> — Twitter/X thumbnail to original',
            exampleReddit: '<code>Match: ^(https?://preview\\.redd\\.it/[^?]+)\\?.*$</code><br><code>Replace: $1</code> — Reddit remove query parameters',
            exampleImgur: '<code>Match: ^https?://i\\.imgur\\.com/(\\w+)([tsmlbh])?\\.(\\w+)$</code><br><code>Replace: https://i.imgur.com/$1.$3</code> — Imgur remove thumbnail suffix',

            // 底部
            storageSyncStatus: '☁️ Settings will be synced across your devices',
            backBtn: '← Back to Settings',

            // 验证
            errorDomainEmpty: 'Domain cannot be empty',
            errorDomainInvalid: 'Invalid domain format',
            errorRegexEmpty: 'Regex cannot be empty',
            errorRegexInvalid: 'Invalid regex: ',

            // 状态消息
            statusLoadFailed: 'Failed to load strategies',
            statusSaved: 'Settings saved',
            statusSaveFailed: 'Failed to save settings',
            statusExported: 'Strategies exported',
            statusInvalidFormat: 'Invalid file format',
            statusInvalidData: 'File contains invalid strategy data',
            statusImported: 'Imported {count} strategies',
            statusImportFailed: 'Import failed: ',
            statusRegexInvalidForStrategy: 'Invalid regex in strategy "{name}": {error}',

            // 预设策略名称
            presetWallhaven: 'Wallhaven Original',
            presetPixiv: 'Pixiv Original',
            presetTwitterOrig: 'Twitter/X Original',
            presetTwitterLarge: 'Twitter/X Large',
            presetReddit: 'Reddit Original',
            presetImgur: 'Imgur Direct',
            presetInstagram: 'Instagram CDN',

            // 实验性说明
            experimentalBadge: 'Experimental',
            experimentalTag: 'Experimental',
            experimentalNoteWallhaven: 'When enabled, hovering over thumbnails on Wallhaven search pages will detect images behind page overlays and automatically select the original image URL based on format indicators (PNG/JPG). Websites without a matching strategy are not affected.',
            experimentalNotePixiv: 'When enabled, hovering over thumbnails on Pixiv pages will query the Pixiv API for the original image\'s actual format (PNG/JPG) and download the original. Requires Pixiv login and must be used on Pixix pages. Results are cached for 10 minutes to reduce API requests.',
            experimentalNoteDefault: 'Experimental feature. When enabled, the extension will attempt to retrieve the original image URL.',

            // 策略卡片
            removeBtn: 'Remove'
        },

        zh_CN: {
            // 页面标题
            strategiesPageTitle: 'Image Harvester - URL 转换策略',
            strategiesTitle: '🔗 缩略图直链下载',
            strategiesSubtitle: '通过配置正则，在缩略图上悬停即可下载原图',

            // 预设区
            presetSection: '内置预设',
            presetHelp: '内置的常用网站策略，可启用/禁用。启用后，在对应网站悬浮下载时会自动将缩略图 URL 转换为原始图 URL。同域名策略互斥，启用一个将自动禁用同域名的其他策略。',
            loading: '加载中...',

            // 自定义区
            customSection: '自定义策略',
            customHelp: '添加自定义 URL 转换规则。支持正则表达式匹配和替换。',
            nameLabel: '名称',
            domainLabel: '域名',
            matchLabel: '匹配正则',
            replaceLabel: '替换字符串',
            namePlaceholder: '例如：微博原图',
            domainPlaceholder: '例如：weibo.com',
            matchPlaceholder: '例如：^(https?://[^?]+)\\?.*$',
            replacePlaceholder: '例如：$1',
            addStrategyBtn: '添加策略',
            emptyPresets: '无预设策略',
            emptyCustoms: '暂无自定义策略',

            // 测试区
            testSection: '测试工具',
            testUrlLabel: '输入测试 URL',
            testMatchLabel: '匹配正则',
            testReplaceLabel: '替换字符串',
            testUrlPlaceholder: '粘贴缩略图 URL 进行测试',
            testMatchPlaceholder: '匹配规则',
            testReplacePlaceholder: '替换规则',
            testBtn: '测试',
            testFillAllFields: '请填写所有字段',
            testSuccess: '匹配成功',
            testUrlOriginal: '原始:',
            testUrlResult: '结果:',
            testNoMatch: '不匹配 — 该正则不匹配输入的 URL',
            testRegexError: '正则错误: ',

            // 导入导出
            importExportSection: '导入/导出',
            exportBtn: '导出策略',
            importBtn: '导入策略',

            // 示例
            examplesTitle: '规则示例',
            exampleTwitter: '<code>匹配: ^(https?://pbs\\.twimg\\.com/media/[^?]+)\\?format=(\\w+)&name=.*$</code><br><code>替换: $1.$2:orig</code> — Twitter/X 缩略图转原图',
            exampleReddit: '<code>匹配: ^(https?://preview\\.redd\\.it/[^?]+)\\?.*$</code><br><code>替换: $1</code> — Reddit 去除查询参数',
            exampleImgur: '<code>匹配: ^https?://i\\.imgur\\.com/(\\w+)([tsmlbh])?\\.(\\w+)$</code><br><code>替换: https://i.imgur.com/$1.$3</code> — Imgur 去除缩略图后缀',

            // 底部
            storageSyncStatus: '☁️ 设置将同步到所有设备',
            backBtn: '← 返回设置',

            // 验证
            errorDomainEmpty: '域名不能为空',
            errorDomainInvalid: '域名格式无效',
            errorRegexEmpty: '正则不能为空',
            errorRegexInvalid: '正则表达式无效: ',

            // 状态消息
            statusLoadFailed: '加载策略失败',
            statusSaved: '设置已保存',
            statusSaveFailed: '保存设置失败',
            statusExported: '策略已导出',
            statusInvalidFormat: '无效的文件格式',
            statusInvalidData: '文件包含无效的策略数据',
            statusImported: '已导入 {count} 条策略',
            statusImportFailed: '导入失败: ',
            statusRegexInvalidForStrategy: '策略 "{name}" 的正则无效: {error}',

            // 预设策略名称
            presetWallhaven: 'Wallhaven 原图',
            presetPixiv: 'Pixiv 原图',
            presetTwitterOrig: 'Twitter/X 原图',
            presetTwitterLarge: 'Twitter/X 大图',
            presetReddit: 'Reddit 原图',
            presetImgur: 'Imgur 直链',
            presetInstagram: 'Instagram CDN',

            // 实验性说明
            experimentalBadge: '实验性',
            experimentalTag: '实验性',
            experimentalNoteWallhaven: '启用后，在 Wallhaven 搜索页悬停缩略图时，扩展会穿透页面叠加层检测被遮挡的图片元素，并根据页面中的格式标识（PNG/JPG）自动选择对应的原图 URL，无匹配策略的网站不受影响。',
            experimentalNotePixiv: '启用后，在 Pixiv 页面悬停缩略图时，扩展会通过 Pixiv API 查询原图的真实格式（PNG/JPG）并下载原图，需要登录 Pixiv 并在 Pixiv 页面上使用，结果会缓存 10 分钟以减少 API 请求。',
            experimentalNoteDefault: '实验性功能，启用后将尝试获取原图 URL。',

            // 策略卡片
            removeBtn: '删除'
        }
    },

    getBrowserLocale() {
        try {
            const lang = chrome.i18n.getUILanguage();
            if (lang.startsWith('zh')) return 'zh_CN';
        } catch (e) {
            debug.error('Could not detect browser locale:', e.message);
        }
        return 'en';
    },

    getEffectiveLocale() {
        return this.currentLocale === 'auto' ? this.getBrowserLocale() : this.currentLocale;
    },

    t(key) {
        const locale = this.getEffectiveLocale();
        const table = this.translations[locale] || this.translations.en;
        return table[key] || key;
    },

    tf(key, params = {}) {
        let str = this.t(key);
        for (const [k, v] of Object.entries(params)) {
            str = str.replace(`{${k}}`, String(v));
        }
        return str;
    },

    applyToDOM() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translated = this.t(key);
            // 示例列表含 HTML，使用 innerHTML
            if (key.startsWith('example')) {
                el.innerHTML = translated;
            } else {
                el.textContent = translated;
            }
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            el.placeholder = this.t(key);
        });
    },

    async init() {
        try {
            const saved = await storage.get('ih_ui_language');
            this.currentLocale = saved || 'auto';
            this.applyToDOM();
            // 设置页面标题
            document.title = this.t('strategiesPageTitle');
        } catch (err) {
            debug.error('i18n init failed:', err.message);
        }
    }
};

// 内置预设策略
const PRESET_STRATEGIES = [
    {
        id: 'wallhaven-original',
        name: 'presetWallhaven',
        domainPattern: 'th.wallhaven.cc',
        enabled: false,
        isPreset: true,
        experimental: true,
        resolver: 'wallhaven'
    },
    {
        id: 'pixiv-original',
        name: 'presetPixiv',
        domainPattern: 'pximg.net',
        enabled: false,
        isPreset: true,
        experimental: true,
        resolver: 'pixiv'
    },
    {
        id: 'twitter-x-orig',
        name: 'presetTwitterOrig',
        domainPattern: 'twimg.com',
        enabled: false,
        isPreset: true,
        rules: [
            {
                match: '^(https?://pbs\\.twimg\\.com/media/[^?]+)\\?format=(\\w+)&name=.*$',
                replace: '$1.$2:orig'
            }
        ]
    },
    {
        id: 'twitter-x-large',
        name: 'presetTwitterLarge',
        domainPattern: 'twimg.com',
        enabled: false,
        isPreset: true,
        rules: [
            {
                match: '^(https?://pbs\\.twimg\\.com/media/[^?]+)\\?format=(\\w+)&name=.*$',
                replace: '$1.$2:large'
            }
        ]
    },
    {
        id: 'reddit-preview',
        name: 'presetReddit',
        domainPattern: 'redd.it',
        enabled: false,
        isPreset: true,
        rules: [
            {
                match: '^(https?://preview\\.redd\\.it/[^?]+)\\?.*$',
                replace: '$1'
            },
            {
                match: '^(https?://external-preview\\.redd\\.it/[^?]+)\\?.*$',
                replace: '$1'
            }
        ]
    },
    {
        id: 'imgur-direct',
        name: 'presetImgur',
        domainPattern: 'imgur.com',
        enabled: false,
        isPreset: true,
        rules: [
            {
                match: '^https?://i\\.imgur\\.com/(\\w+)([tsmlbh])?\\.(\\w+)$',
                replace: 'https://i.imgur.com/$1.$3'
            }
        ]
    },
    {
        id: 'instagram-cdn',
        name: 'presetInstagram',
        domainPattern: 'cdninstagram.com',
        enabled: false,
        isPreset: true,
        rules: [
            {
                match: '^(https?://[^/]+/v/[^?]+)\\??.*$',
                replace: '$1'
            }
        ]
    }
];

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

class UrlStrategies {
    constructor() {
        this.strategies = [];
        this.init();
    }

    async init() {
        await this.loadStrategies();
        this.setupEventListeners();
        this.renderAll();
    }

    async loadStrategies() {
        try {
            const saved = await storage.get('ih_url_strategies');
            if (!saved || !Array.isArray(saved) || saved.length === 0) {
                // 首次使用，初始化预设
                this.strategies = JSON.parse(JSON.stringify(PRESET_STRATEGIES));
                await this.saveStrategies(true);
            } else {
                // 合并：保留用户的启用状态，添加新预设
                this.strategies = this.mergeWithPresets(saved);
            }
            debug.log('策略已加载:', this.strategies.length);
        } catch (error) {
            debug.error('加载策略失败:', error);
            this.showStatus(i18n.t('statusLoadFailed'), 'error');
        }
    }

    // 将存储的策略与预设合并，添加新预设但保留用户状态
    mergeWithPresets(saved) {
        const savedById = new Map(saved.map(s => [s.id, s]));
        const result = [];

        // 先添加所有预设（保持预设顺序）
        for (const preset of PRESET_STRATEGIES) {
            const existing = savedById.get(preset.id);
            if (existing) {
                // 保留用户的 enabled 状态，但更新 rules
                result.push({
                    ...JSON.parse(JSON.stringify(preset)),
                    enabled: existing.enabled
                });
                savedById.delete(preset.id);
            } else {
                // 新预设，使用默认值
                result.push(JSON.parse(JSON.stringify(preset)));
            }
        }

        // 再添加用户的自定义策略
        for (const custom of savedById.values()) {
            result.push(custom);
        }

        return result;
    }

    async saveStrategies(silent = false) {
        try {
            const success = await storage.set('ih_url_strategies', this.strategies);
            if (success) {
                debug.log('策略已保存');
                if (!silent) this.showStatus(i18n.t('statusSaved'), 'success');
            } else {
                throw new Error('Storage 操作失败');
            }
        } catch (error) {
            debug.error('保存策略失败:', error);
            this.showStatus(i18n.t('statusSaveFailed'), 'error');
        }
    }

    setupEventListeners() {
        // 自定义策略添加
        const addBtn = document.getElementById('add-custom-btn');
        const nameInput = document.getElementById('custom-name');
        const domainInput = document.getElementById('custom-domain');
        const matchInput = document.getElementById('custom-match');
        const replaceInput = document.getElementById('custom-replace');

        const validateForm = () => {
            const name = nameInput.value.trim();
            const domain = domainInput.value.trim();
            const match = matchInput.value.trim();
            const replace = replaceInput.value.trim();
            addBtn.disabled = !(name && domain && match && replace);
        };

        [nameInput, domainInput, matchInput, replaceInput].forEach(input => {
            input.addEventListener('input', validateForm);
        });

        addBtn.addEventListener('click', () => {
            this.addCustomStrategy(
                nameInput.value.trim(),
                domainInput.value.trim(),
                matchInput.value.trim(),
                replaceInput.value.trim()
            );
        });

        // 测试面板
        document.getElementById('test-btn').addEventListener('click', () => {
            this.runTest();
        });

        // 导入/导出
        document.getElementById('export-btn').addEventListener('click', () => {
            this.exportStrategies();
        });
        document.getElementById('import-btn').addEventListener('click', () => {
            document.getElementById('import-file').click();
        });
        document.getElementById('import-file').addEventListener('change', (e) => {
            this.importStrategies(e);
        });

        // 返回按钮
        document.getElementById('back-btn').addEventListener('click', () => {
            window.close();
        });
    }

    renderAll() {
        this.renderPresets();
        this.renderCustoms();
    }

    renderPresets() {
        const container = document.getElementById('presets-container');
        container.innerHTML = '';

        const presets = this.strategies.filter(s => s.isPreset);

        if (presets.length === 0) {
            container.innerHTML = `<p class="empty-state">${i18n.t('emptyPresets')}</p>`;
            return;
        }

        presets.forEach(strategy => {
            container.appendChild(this.createStrategyCard(strategy, true));
        });
    }

    renderCustoms() {
        const container = document.getElementById('customs-container');
        container.innerHTML = '';

        const customs = this.strategies.filter(s => !s.isPreset);

        if (customs.length === 0) {
            container.innerHTML = `<p class="empty-state">${i18n.t('emptyCustoms')}</p>`;
            return;
        }

        customs.forEach(strategy => {
            container.appendChild(this.createStrategyCard(strategy, false));
        });
    }

    /** 获取策略显示名称（预设策略走 i18n，自定义策略直接显示） */
    getStrategyDisplayName(strategy) {
        if (strategy.isPreset && strategy.name.startsWith('preset')) {
            return i18n.t(strategy.name);
        }
        return strategy.name;
    }

    createStrategyCard(strategy, isPreset) {
        const card = document.createElement('div');
        card.className = `strategy-card ${strategy.enabled ? 'enabled' : 'disabled'}${strategy.experimental ? ' experimental' : ''}`;

        // 实验性策略（resolver 模式）无 rules，跳过正则展示
        const hasRules = Array.isArray(strategy.rules) && strategy.rules.length > 0;
        const rulesHtml = hasRules ? strategy.rules.map(r =>
            `<div class="rule-item">
                <code class="rule-match">${this.escapeHtml(r.match)}</code>
                <span class="rule-arrow">→</span>
                <code class="rule-replace">${this.escapeHtml(r.replace)}</code>
            </div>`
        ).join('') : '';
        const rulesSection = hasRules ? `<div class="strategy-rules">${rulesHtml}</div>` : '';

        // 实验性功能说明文案
        const experimentalNotes = {
            wallhaven: i18n.t('experimentalNoteWallhaven'),
            pixiv: i18n.t('experimentalNotePixiv')
        };
        const experimentalNote = strategy.experimental
            ? `<div class="experimental-note">
                <span class="experimental-badge">${i18n.t('experimentalBadge')}</span>
                <span>${experimentalNotes[strategy.resolver] || i18n.t('experimentalNoteDefault')}</span>
              </div>`
            : '';

        card.innerHTML = `
            <div class="strategy-header">
                <div class="strategy-info">
                    <span class="strategy-name">${this.escapeHtml(this.getStrategyDisplayName(strategy))}${strategy.experimental ? ` <span class="experimental-tag">${i18n.t('experimentalTag')}</span>` : ''}</span>
                    <span class="strategy-domain">${this.escapeHtml(strategy.domainPattern)}</span>
                </div>
                <div class="strategy-actions">
                    <label class="toggle-label">
                        <input type="checkbox" class="toggle-enabled" data-id="${this.escapeHtml(strategy.id)}" ${strategy.enabled ? 'checked' : ''} />
                        <span class="toggle-switch"></span>
                    </label>
                    ${!isPreset ? `<button class="remove-btn" data-id="${this.escapeHtml(strategy.id)}">${i18n.t('removeBtn')}</button>` : ''}
                </div>
            </div>
            ${rulesSection}
            ${experimentalNote}
        `;

        // 启用/禁用
        card.querySelector('.toggle-enabled').addEventListener('change', (e) => {
            this.toggleStrategy(strategy.id, e.target.checked);
        });

        // 删除（仅自定义策略）
        const removeBtn = card.querySelector('.remove-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                this.removeStrategy(strategy.id);
            });
        }

        return card;
    }

    async toggleStrategy(id, enabled) {
        const strategy = this.strategies.find(s => s.id === id);
        if (strategy) {
            strategy.enabled = enabled;
            // 启用时，自动禁用同域名的其他策略
            if (enabled) {
                const domain = strategy.domainPattern.toLowerCase();
                for (const s of this.strategies) {
                    if (s.id !== id && s.domainPattern.toLowerCase() === domain && s.enabled) {
                        s.enabled = false;
                    }
                }
            }
            await this.saveStrategies();
            this.renderAll();
        }
    }

    async removeStrategy(id) {
        const index = this.strategies.findIndex(s => s.id === id);
        if (index > -1) {
            this.strategies.splice(index, 1);
            await this.saveStrategies();
            this.renderAll();
        }
    }

    async addCustomStrategy(name, domain, matchRegex, replace) {
        // 验证域名
        const domainValidation = this.validateDomain(domain);
        if (!domainValidation.valid) {
            this.showStatus(domainValidation.error, 'error');
            return;
        }

        // 验证正则
        const regexValidation = this.validateRegex(matchRegex);
        if (!regexValidation.valid) {
            this.showStatus(regexValidation.error, 'error');
            return;
        }

        // 生成唯一 ID
        const id = 'custom-' + Date.now();

        this.strategies.push({
            id,
            name,
            domainPattern: domain,
            enabled: true,
            isPreset: false,
            rules: [{ match: matchRegex, replace }]
        });

        await this.saveStrategies();
        this.renderAll();

        // 清空输入
        document.getElementById('custom-name').value = '';
        document.getElementById('custom-domain').value = '';
        document.getElementById('custom-match').value = '';
        document.getElementById('custom-replace').value = '';
        document.getElementById('add-custom-btn').disabled = true;
    }

    validateDomain(domain) {
        if (!domain) return { valid: false, error: i18n.t('errorDomainEmpty') };
        const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        if (!domainRegex.test(domain)) return { valid: false, error: i18n.t('errorDomainInvalid') };
        return { valid: true };
    }

    validateRegex(pattern) {
        if (!pattern) return { valid: false, error: i18n.t('errorRegexEmpty') };
        try {
            new RegExp(pattern);
            return { valid: true };
        } catch (e) {
            return { valid: false, error: i18n.t('errorRegexInvalid') + e.message };
        }
    }

    runTest() {
        const url = document.getElementById('test-url').value.trim();
        const match = document.getElementById('test-match').value.trim();
        const replace = document.getElementById('test-replace').value.trim();
        const resultEl = document.getElementById('test-result');

        if (!url || !match || !replace) {
            resultEl.innerHTML = `<span class="test-error">${i18n.t('testFillAllFields')}</span>`;
            return;
        }

        try {
            const regex = new RegExp(match);
            if (regex.test(url)) {
                const transformed = url.replace(regex, replace);
                resultEl.innerHTML = `
                    <div class="test-success">
                        <div class="test-label">${i18n.t('testSuccess')}</div>
                        <div class="test-url-original">${i18n.t('testUrlOriginal')} <code>${this.escapeHtml(url)}</code></div>
                        <div class="test-url-result">${i18n.t('testUrlResult')} <code>${this.escapeHtml(transformed)}</code></div>
                    </div>`;
            } else {
                resultEl.innerHTML = `<span class="test-error">${i18n.t('testNoMatch')}</span>`;
            }
        } catch (e) {
            resultEl.innerHTML = `<span class="test-error">${i18n.t('testRegexError')}${this.escapeHtml(e.message)}</span>`;
        }
    }

    async exportStrategies() {
        const json = JSON.stringify(this.strategies, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ih-url-strategies.json';
        a.click();
        URL.revokeObjectURL(url);
        this.showStatus(i18n.t('statusExported'), 'success');
    }

    async importStrategies(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const imported = JSON.parse(text);

            if (!Array.isArray(imported)) {
                this.showStatus(i18n.t('statusInvalidFormat'), 'error');
                return;
            }

            // 验证每条策略
            for (const s of imported) {
                if (!s.id || !s.name || !s.domainPattern || !Array.isArray(s.rules)) {
                    this.showStatus(i18n.t('statusInvalidData'), 'error');
                    return;
                }
                for (const r of s.rules) {
                    const v = this.validateRegex(r.match);
                    if (!v.valid) {
                        this.showStatus(i18n.tf('statusRegexInvalidForStrategy', { name: s.name, error: v.error }), 'error');
                        return;
                    }
                }
            }

            // 合并：预设按 ID 合并启用状态，自定义直接添加
            const existingIds = new Set(this.strategies.map(s => s.id));
            for (const s of imported) {
                if (existingIds.has(s.id)) {
                    // 更新已有策略的 enabled 状态
                    const existing = this.strategies.find(x => x.id === s.id);
                    if (existing) existing.enabled = s.enabled;
                } else {
                    // 新增
                    this.strategies.push({ ...s, isPreset: s.isPreset || false });
                }
            }

            await this.saveStrategies();
            this.renderAll();
            this.showStatus(i18n.tf('statusImported', { count: imported.length }), 'success');
        } catch (error) {
            debug.error('导入失败:', error);
            this.showStatus(i18n.t('statusImportFailed') + error.message, 'error');
        }

        // 重置 file input
        e.target.value = '';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showStatus(message, type = 'info') {
        const status = document.getElementById('status');
        status.textContent = message;
        status.className = `status ${type}`;
        setTimeout(() => {
            status.textContent = '';
            status.className = 'status';
        }, 3000);
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    const versionElement = document.getElementById('version');
    if (versionElement) {
        versionElement.textContent = `v${EXTENSION_VERSION}`;
    }
    await i18n.init();
    new UrlStrategies();
});
