// URL 转换策略管理页面 JavaScript for Image Hover Save Extension
// Copyright (c) Jaewoo Jeon (@thejjw) and Image Hover Save Extension Contributors
// SPDX-License-Identifier: zlib-acknowledgement

const EXTENSION_VERSION = '1.4.2';

const DEBUG = false;

const debug = {
    log: (...args) => DEBUG && console.log('[IHS Strategies]', ...args),
    error: (...args) => DEBUG && console.error('[IHS Strategies]', ...args),
    warn: (...args) => DEBUG && console.warn('[IHS Strategies]', ...args),
    info: (...args) => DEBUG && console.info('[IHS Strategies]', ...args)
};

// 内置预设策略
const PRESET_STRATEGIES = [
    {
        id: 'twitter-x-orig',
        name: 'Twitter/X 原图',
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
        name: 'Twitter/X 大图',
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
        name: 'Reddit 原图',
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
        name: 'Imgur 直链',
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
        name: 'Instagram CDN',
        domainPattern: 'cdninstagram.com',
        enabled: false,
        isPreset: true,
        rules: [
            {
                match: '^(https?://[^/]+/v/[^?]+)\\??.*$',
                replace: '$1'
            }
        ]
    },
    {
        id: 'wallhaven-original',
        name: 'Wallhaven 原图',
        domainPattern: 'th.wallhaven.cc',
        enabled: false,
        isPreset: true,
        experimental: true,
        resolver: 'wallhaven'
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
            const saved = await storage.get('ihs_url_strategies');
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
            this.showStatus('加载策略失败', 'error');
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
            const success = await storage.set('ihs_url_strategies', this.strategies);
            if (success) {
                debug.log('策略已保存');
                if (!silent) this.showStatus('设置已保存', 'success');
            } else {
                throw new Error('Storage 操作失败');
            }
        } catch (error) {
            debug.error('保存策略失败:', error);
            this.showStatus('保存设置失败', 'error');
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
            container.innerHTML = '<p class="empty-state">无预设策略</p>';
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
            container.innerHTML = '<p class="empty-state">暂无自定义策略</p>';
            return;
        }

        customs.forEach(strategy => {
            container.appendChild(this.createStrategyCard(strategy, false));
        });
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
        const experimentalNote = strategy.experimental
            ? `<div class="experimental-note">
                <span class="experimental-badge">实验性</span>
                <span>启用后，在 Wallhaven 搜索页悬停缩略图时，扩展会穿透页面叠加层检测被遮挡的图片元素，并根据页面中的格式标识（PNG/JPG）自动选择对应的原图 URL。无匹配策略的网站不受影响。</span>
              </div>`
            : '';

        card.innerHTML = `
            <div class="strategy-header">
                <div class="strategy-info">
                    <span class="strategy-name">${this.escapeHtml(strategy.name)}${strategy.experimental ? ' <span class="experimental-tag">实验性</span>' : ''}</span>
                    <span class="strategy-domain">${this.escapeHtml(strategy.domainPattern)}</span>
                </div>
                <div class="strategy-actions">
                    <label class="toggle-label">
                        <input type="checkbox" class="toggle-enabled" data-id="${this.escapeHtml(strategy.id)}" ${strategy.enabled ? 'checked' : ''} />
                        <span class="toggle-switch"></span>
                    </label>
                    ${!isPreset ? `<button class="remove-btn" data-id="${this.escapeHtml(strategy.id)}">删除</button>` : ''}
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
        if (!domain) return { valid: false, error: '域名不能为空' };
        const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        if (!domainRegex.test(domain)) return { valid: false, error: '域名格式无效' };
        return { valid: true };
    }

    validateRegex(pattern) {
        if (!pattern) return { valid: false, error: '正则不能为空' };
        try {
            new RegExp(pattern);
            return { valid: true };
        } catch (e) {
            return { valid: false, error: '正则表达式无效: ' + e.message };
        }
    }

    runTest() {
        const url = document.getElementById('test-url').value.trim();
        const match = document.getElementById('test-match').value.trim();
        const replace = document.getElementById('test-replace').value.trim();
        const resultEl = document.getElementById('test-result');

        if (!url || !match || !replace) {
            resultEl.innerHTML = '<span class="test-error">请填写所有字段</span>';
            return;
        }

        try {
            const regex = new RegExp(match);
            if (regex.test(url)) {
                const transformed = url.replace(regex, replace);
                resultEl.innerHTML = `
                    <div class="test-success">
                        <div class="test-label">匹配成功</div>
                        <div class="test-url-original">原始: <code>${this.escapeHtml(url)}</code></div>
                        <div class="test-url-result">结果: <code>${this.escapeHtml(transformed)}</code></div>
                    </div>`;
            } else {
                resultEl.innerHTML = '<span class="test-error">不匹配 — 该正则不匹配输入的 URL</span>';
            }
        } catch (e) {
            resultEl.innerHTML = `<span class="test-error">正则错误: ${this.escapeHtml(e.message)}</span>`;
        }
    }

    async exportStrategies() {
        const json = JSON.stringify(this.strategies, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ihs-url-strategies.json';
        a.click();
        URL.revokeObjectURL(url);
        this.showStatus('策略已导出', 'success');
    }

    async importStrategies(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const imported = JSON.parse(text);

            if (!Array.isArray(imported)) {
                this.showStatus('无效的文件格式', 'error');
                return;
            }

            // 验证每条策略
            for (const s of imported) {
                if (!s.id || !s.name || !s.domainPattern || !Array.isArray(s.rules)) {
                    this.showStatus('文件包含无效的策略数据', 'error');
                    return;
                }
                for (const r of s.rules) {
                    const v = this.validateRegex(r.match);
                    if (!v.valid) {
                        this.showStatus(`策略 "${s.name}" 的正则无效: ${v.error}`, 'error');
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
            this.showStatus(`已导入 ${imported.length} 条策略`, 'success');
        } catch (error) {
            debug.error('导入失败:', error);
            this.showStatus('导入失败: ' + error.message, 'error');
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
document.addEventListener('DOMContentLoaded', () => {
    const versionElement = document.getElementById('version');
    if (versionElement) {
        versionElement.textContent = `v${EXTENSION_VERSION}`;
    }
    new UrlStrategies();
});
