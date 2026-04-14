// Domain Exclusions Page JavaScript for Image Harvester
// Copyright (c) Jaewoo Jeon (@thejjw) and Image Harvester Contributors
// SPDX-License-Identifier: zlib-acknowledgement

// Extension version - should match popup.js
const EXTENSION_VERSION = '1.4.2';

// Debug flag
const DEBUG = false;

// Debug console wrapper
const debug = {
    log: (...args) => DEBUG && console.log('[IH Exclusions]', ...args),
    error: (...args) => DEBUG && console.error('[IH Exclusions]', ...args),
    warn: (...args) => DEBUG && console.warn('[IH Exclusions]', ...args),
    info: (...args) => DEBUG && console.info('[IH Exclusions]', ...args)
};

// ====== i18n Internationalization Module ======
const i18n = {
    currentLocale: 'auto',

    translations: {
        en: {
            exclusionsTitle: 'Domain Exclusions',
            exclusionsSubtitle: 'Configure domains where Image Harvester should not work',
            exclusionsHelp: 'Add domains where you don\'t want the extension to work. Use specific domains like "apps.domain.com" to exclude only that domain, or use "domain.com" to exclude all subdomains. When you visit an excluded domain, the extension will not show download buttons on images.',
            exclusionsAddLabel: 'Add domain:',
            exclusionsAddPlaceholder: 'example.com',
            exclusionsAddBtn: 'Add',
            exclusionsListTitle: 'Excluded Domains',
            exclusionsEmpty: 'No domains excluded',
            exclusionsExamplesTitle: 'Pattern Examples',
            exclusionsExample1: '<code>example.com</code> - Excludes example.com and all subdomains (a.example.com, b.example.com, etc.)',
            exclusionsExample2: '<code>app.example.com</code> - Excludes app.example.com and its subdomains, but won\'t exclude example.com',
            exclusionsExample3: '<code>google.com</code> - Good for avoiding conflicts with Google\'s own image features',
            exclusionsSync: '☁️ Settings will be synced across your devices',
            exclusionsBack: '← Back to Settings',
            exclusionsRemoveBtn: 'Remove',
            exclusionsSaveSuccess: 'Settings saved successfully',
            exclusionsSaveFailed: 'Failed to save settings',
            exclusionsLoadFailed: 'Failed to load exclusions',
            exclusionsErrorEmpty: 'Domain cannot be empty',
            exclusionsErrorInvalid: 'Invalid domain format',
            exclusionsErrorDuplicate: 'Domain already excluded',
            exclusionsSyncStatus: '☁️ Settings will be synced across your devices'
        },
        zh_CN: {
            exclusionsTitle: '域名排除',
            exclusionsSubtitle: '配置 Image Harvester 不生效的域名',
            exclusionsHelp: '添加不希望扩展生效的域名。使用具体域名如 "apps.domain.com" 仅排除该域名，或使用 "domain.com" 排除所有子域名。访问被排除的域名时，扩展不会在图片上显示下载按钮。',
            exclusionsAddLabel: '添加域名：',
            exclusionsAddPlaceholder: 'example.com',
            exclusionsAddBtn: '添加',
            exclusionsListTitle: '已排除的域名',
            exclusionsEmpty: '暂无排除域名',
            exclusionsExamplesTitle: '匹配示例',
            exclusionsExample1: '<code>example.com</code> - 排除 example.com 及其所有子域名（a.example.com、b.example.com 等）',
            exclusionsExample2: '<code>app.example.com</code> - 排除 app.example.com 及其子域名，但不会排除 example.com',
            exclusionsExample3: '<code>google.com</code> - 适用于避免与 Google 自身图片功能冲突',
            exclusionsSync: '☁️ 设置将同步到所有设备',
            exclusionsBack: '← 返回设置',
            exclusionsRemoveBtn: '删除',
            exclusionsSaveSuccess: '设置已保存',
            exclusionsSaveFailed: '保存设置失败',
            exclusionsLoadFailed: '加载排除列表失败',
            exclusionsErrorEmpty: '域名不能为空',
            exclusionsErrorInvalid: '域名格式无效',
            exclusionsErrorDuplicate: '该域名已在排除列表中',
            exclusionsSyncStatus: '☁️ 设置将同步到所有设备'
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

    applyToDOM() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translated = this.t(key);
            // 示例列表含 HTML code 标签
            if (key.startsWith('exclusionsExample')) {
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
            document.title = this.t('exclusionsTitle') + ' - Image Harvester';
        } catch (err) {
            debug.error('i18n init failed:', err.message);
        }
    }
};

// Storage helper functions
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

// Domain exclusion functionality
class DomainExclusions {
    constructor() {
        this.exclusions = [];
        this.init();
    }

    async init() {
        await i18n.init();
        await this.loadExclusions();
        this.setupEventListeners();
        this.renderExclusions();
        this.updateStorageStatus();
    }

    async loadExclusions() {
        try {
            this.exclusions = (await storage.get('ih_domain_exclusions')) || [];
            debug.log('Loaded exclusions:', this.exclusions);
        } catch (error) {
            debug.error('Failed to load exclusions:', error);
            this.showStatus(i18n.t('exclusionsLoadFailed'), 'error');
        }
    }

    async saveExclusions() {
        try {
            const success = await storage.set('ih_domain_exclusions', this.exclusions);
            if (success) {
                debug.log('Saved exclusions:', this.exclusions);
                this.showStatus(i18n.t('exclusionsSaveSuccess'), 'success');
                this.updateStorageStatus();
            } else {
                throw new Error('Storage operation failed');
            }
        } catch (error) {
            debug.error('Failed to save exclusions:', error);
            this.showStatus(i18n.t('exclusionsSaveFailed'), 'error');
        }
    }

    setupEventListeners() {
        const domainInput = document.getElementById('domain-input');
        const addBtn = document.getElementById('add-btn');
        const backBtn = document.getElementById('back-btn');

        // Add domain on button click
        addBtn.addEventListener('click', () => {
            this.addDomain(domainInput.value.trim());
        });

        // Add domain on Enter key
        domainInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.addDomain(domainInput.value.trim());
            }
        });

        // Enable/disable add button based on input
        domainInput.addEventListener('input', () => {
            const value = domainInput.value.trim();
            addBtn.disabled = !value || this.exclusions.includes(value);
        });

        // Back button
        backBtn.addEventListener('click', () => {
            window.close();
        });
    }

    validateDomain(domain) {
        if (!domain) {
            return { valid: false, error: i18n.t('exclusionsErrorEmpty') };
        }

        // Basic domain validation
        const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

        if (!domainRegex.test(domain)) {
            return { valid: false, error: i18n.t('exclusionsErrorInvalid') };
        }

        if (this.exclusions.includes(domain)) {
            return { valid: false, error: i18n.t('exclusionsErrorDuplicate') };
        }

        return { valid: true };
    }

    async addDomain(domain) {
        const validation = this.validateDomain(domain);

        if (!validation.valid) {
            this.showStatus(validation.error, 'error');
            return;
        }

        this.exclusions.push(domain);
        await this.saveExclusions();
        this.renderExclusions();

        // Clear input
        document.getElementById('domain-input').value = '';
        document.getElementById('add-btn').disabled = true;
    }

    async removeDomain(domain) {
        const index = this.exclusions.indexOf(domain);
        if (index > -1) {
            this.exclusions.splice(index, 1);
            await this.saveExclusions();
            this.renderExclusions();
        }
    }

    renderExclusions() {
        const container = document.getElementById('exclusions-container');
        const noExclusions = document.getElementById('no-exclusions');

        // Clear existing domain items
        const existingItems = container.querySelectorAll('.domain-item');
        existingItems.forEach(item => item.remove());

        if (this.exclusions.length === 0) {
            noExclusions.style.display = 'block';
        } else {
            noExclusions.style.display = 'none';

            const removeLabel = i18n.t('exclusionsRemoveBtn');
            this.exclusions.forEach(domain => {
                const domainItem = document.createElement('div');
                domainItem.className = 'domain-item';

                domainItem.innerHTML = `
                    <span class="domain-text">${this.escapeHtml(domain)}</span>
                    <button class="remove-btn" data-domain="${this.escapeHtml(domain)}">${this.escapeHtml(removeLabel)}</button>
                `;

                // Add remove functionality
                const removeBtn = domainItem.querySelector('.remove-btn');
                removeBtn.addEventListener('click', () => {
                    this.removeDomain(domain);
                });

                container.appendChild(domainItem);
            });
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    updateStorageStatus() {
        const storageElement = document.getElementById('storage-type');
        if (!storageElement) return;
        storageElement.textContent = i18n.t('exclusionsSyncStatus');
    }

    showStatus(message, type = 'info') {
        const status = document.getElementById('status');
        status.textContent = message;
        status.className = `status ${type}`;

        // Clear status after 3 seconds
        setTimeout(() => {
            status.textContent = '';
            status.className = 'status';
        }, 3000);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    debug.log('Initializing domain exclusions page...');

    // Populate version in footer
    const versionElement = document.getElementById('version');
    if (versionElement) {
        versionElement.textContent = `v${EXTENSION_VERSION}`;
    }

    // Initialize domain exclusions
    new DomainExclusions();
});
