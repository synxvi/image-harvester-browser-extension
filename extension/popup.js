// Image Harvester - Popup Script
// Copyright (c) Jaewoo Jeon (@thejjw) and Image Harvester Contributors
// SPDX-License-Identifier: zlib-acknowledgement
//
// Third-party libraries:
// - JSZip v3.10.1 (MIT) - Copyright (c) 2009-2016 Stuart Knightley, David Duponchel, Franz Buchinger, António Afonso

// Extension version - update this when releasing new versions
const EXTENSION_VERSION = '1.6.1';

// Debug flag - set to false to disable all console output
const DEBUG = true; // TEMP: enable for i18n debugging

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

// ====== i18n Internationalization Module ======
const i18n = {
    currentLocale: 'auto',

    translations: {
        en: {
            langAuto: '\uD83C\uDF10 Auto (Browser)',
            langEnglish: 'English',
            langChinese: '\u4E2D\u6587',
            langLabel: 'Language:',
            headerTitle: 'Image Harvester',
            headerSubtitle: 'Quick image download on hover',
            enableExtension: 'Enable extension',
            mediaDetection: 'Media detection',
            hoverDelay: 'Delay:',
            interactionSettings: 'Interaction Settings:',
            buttonSize: 'Button size:',
            toolbarSpacing: 'Btn gap:',
            buttonPosition: 'Btn position:',
            posTopRight: 'Top-right',
            posTopLeft: 'Top-left',
            basicDetection: 'Basic media detection:',
            imgTags: 'IMG tags',
            videoElements: 'Video elements',
            downloadModeLabel: 'Current download mode:',
            modeNormal: 'Normal (background)',
            modeCanvasExperimental: 'Canvas extraction (Experimental)',
            advancedSettings: '\u2699\uFE0F Advanced',
            experimentalHelp: 'Experimental modes for more restrictive sites. YMMV.',
            experimentalModes: '\uD83E\uDDEA Experimental download modes:',
            normalDownload: 'Normal background download',
            canvasExtraction: 'Try canvas extraction',
            advancedDetection: 'Advanced detection types:',
            svgElements: 'SVG elements',
            backgroundImages: 'Background images',
            advancedDetectionHelp: 'Advanced detection modes (disabled by default)',
            visualFeedback: 'Visual feedback:',
            noBorder: 'No border highlighting',
            customBorderColor: 'Custom border color',
            subtleGrayBorder: 'Subtle gray border',
            brightGreenBorder: 'Bright green border',
            visualFeedbackHelp: 'Show border around images when hovering',
            allowedExtensions: 'Allowed file extensions:',
            allowedExtensionsHelp: 'Comma-separated list of allowed file extensions',
            minImageSize: 'Minimum image size (px):',
            minImageSizeHelp: 'Minimum width/height for images to be detected (50-1000px)',
            convertWebpToPng: 'Convert WebP to PNG',
            convertWebpToPngHelp: 'Automatically convert WebP images to PNG format for better compatibility',
            longHideDelay: 'Use long hide delay (1.5s)',
            longHideDelayHelp: 'Prevents button from disappearing instantly on problematic video players',
            saveSubfolder: 'Save subfolder:',
            saveSubfolderPlaceholder: 'MyImages (optional)',
            saveSubfolderHelp: 'Save images to a subfolder inside Downloads. Leave empty to save directly in Downloads.',
            baseSubfolderLabel: 'Base save directory:',
            baseSubfolderPlaceholder: 'image (optional)',
            baseSubfolderHelp: 'A parent folder inside Downloads. All paths will be created under this directory.',
            currentSiteLabel: 'Current site:',
            excludeSiteBtn: 'Block',
            excludeSiteDone: 'Blocked',
            manageExclusions: '\uD83D\uDEAB Manage Domain Exclusions',
            manageExclusionsHelp: 'Configure domains where the extension should not work',
            manageStrategies: '\uD83D\uDD17 Thumbnail Direct Download',
            manageStrategiesHelp: 'Configure regex rules to download original images directly from thumbnails on hover',
            resetAllSettings: '\uD83D\uDD04 Reset All Settings',
            resetAllSettingsHelp: 'Reset all settings to default values. This action cannot be undone.',
            bulkDownload: 'Bulk Download:',
            galleryViewBtn: '\uD83D\uDCE6 Gallery View',
            downloadZipBtn: '\uD83D\uDDC4\uFE0F Download ZIP',
            bulkDownloadHelp: 'Gallery opens images in a new tab. ZIP downloads all images as a compressed file.',
            statusEnabled: 'Extension enabled',
            statusDisabled: 'Extension disabled',
            statusSaveFailed: 'Failed to save setting',
            statusDelaySet: 'Delay set to {value}s',
            statusDelaySaveFailed: 'Failed to save delay',
            statusImgDetOn: 'IMG detection enabled',
            statusImgDetOff: 'IMG detection disabled',
            statusSvgDetOn: 'SVG detection enabled',
            statusSvgDetOff: 'SVG detection disabled',
            statusBgImgDetOn: 'Background image detection enabled',
            statusBgImgDetOff: 'Background image detection disabled',
            statusVideoDetOn: 'Video detection enabled',
            statusVideoDetOff: 'Video detection disabled',
            statusExtUpdated: 'File extensions updated',
            statusExtSaveFailed: 'Failed to save extensions',
            statusModeNormal: 'Download mode set to: Normal',
            statusModeCanvas: 'Download mode set to: Canvas extraction',
            statusBorderOff: 'Border highlighting disabled',
            statusBorderGray: 'Border highlighting enabled (gray)',
            statusBorderGreen: 'Border highlighting enabled (green)',
            statusBorderCustom: 'Border highlight enabled ({color})',
            statusBorderSaveFailed: 'Failed to save border highlight setting',
            statusButtonSizeSet: 'Button size set to {value}px',
            statusToolbarSpacingSet: 'Button spacing set to {value}px',
            statusMinSizeSet: 'Minimum image size set to {value}px',
            statusMinSizeFailed: 'Failed to save minimum size',
            statusMinSizeInvalid: 'Please enter a value between 50 and 1000 pixels',
            statusWebpPngOn: 'WebP to PNG conversion enabled',
            statusWebpPngOff: 'WebP to PNG conversion disabled',
            statusWebpPngFailed: 'Failed to save WebP conversion setting',
            statusLongHideOn: 'Long hide delay enabled',
            statusLongHideOff: 'Long hide delay disabled',
            statusDelaySettingFailed: 'Failed to save delay setting',
            statusSubfolderSet: 'Images will save to Downloads/{value}/',
            statusSubfolderDirect: 'Images will save directly to Downloads',
            statusSubfolderFailed: 'Failed to save subfolder setting',
            statusLoadFailed: 'Failed to load settings',
            statusScanning: 'Scanning for images...',
            statusScanFailed: 'Failed to scan images: {error}',
            statusNoImages: 'No images found on this page',
            statusGalleryOpened: 'Gallery opened with {count} images',
            statusGalleryFailed: 'Failed to create gallery',
            statusJszipNotAvailable: 'JSZip library not available',
            statusContentScriptError: 'Failed to communicate with page content script',
            statusUnsupportedPage: 'This page does not support image scanning',
            statusContentScriptNoResponse: 'Content script did not respond',
            statusDownloading: 'Downloading {count} images...',
            statusDownloadProgress: 'Downloaded {current}/{total} images...',
            statusNoDownloads: 'No images could be downloaded',
            statusCreatingZip: 'Creating ZIP file...',
            statusDownloadFailed: 'Download failed: {error}',
            statusZipCreated: 'ZIP created with {count} images',
            statusZipCreateFailed: 'Failed to create ZIP file',
            statusJszipLoadFailed: 'JSZip library failed to load',
            statusJszipNotFunctioning: 'JSZip library not functioning correctly',
            statusInitFailed: 'Extension failed to initialize',
            statusResetDone: 'All settings have been reset to default values',
            statusResetFailed: 'Failed to reset settings',
            confirmReset: 'Are you sure you want to reset all settings to default values? This action cannot be undone.',
            galleryTitle: 'Gallery - {title}',
            galleryTitleFallback: 'Image Gallery',
            galleryFound: 'Found {total} images ({visible} visible)',
            galleryTip: '\uD83D\uDCA1 <strong>Browse and open images.</strong> Use filters to find what you need, then click "Open in New Tab" to view/save images.',
            galleryOpenInNewTab: 'Open in New Tab',
            galleryFilterBySize: 'Filter by size:',
            galleryWidth: 'Width:',
            galleryHeight: 'Height:',
            galleryFilterByExt: 'Filter by file extension:',
            galleryResetFilters: 'Reset Filters',
            galleryZipDownload: '\uD83D\uDDC4\uFE0F (Advanced) ZIP Download',
            galleryCorsWarning: '\u26A0\uFE0F <strong>CORS Limitations:</strong> This gallery ZIP download uses the fetch method and faces CORS restrictions. For better download success rates, use the <strong>ZIP download button in the extension popup</strong> instead - it runs with extension permissions and may allow download more images.',
            galleryFooterLine1: '\uD83D\uDCC4 This is a temporary auto-generated gallery page created by the <strong>Image Harvester</strong> extension v{version}',
            galleryFooterLine2: 'This page will be lost when closed. Do all downloads you need before you close the page.',
            galleryNoImagesToDownload: 'No images to download',
            galleryCreatingZip: 'Creating ZIP file...',
            galleryGeneratingZip: 'Generating ZIP file...',
            galleryZipDownloaded: 'ZIP downloaded with {count} images',
            galleryZipFailed: 'Failed to create ZIP file',
            galleryImageAlt: 'Image {index}',

            // Multi-path download
            multiPathEnableLabel: 'Multi-path download',
            multiPathHelp: 'Each path shows as separate button. Normal mode only.',
            addPathBtn: '+ Add Path',
            pathNamePlaceholder: 'e.g. Photos',
            pathFolderPlaceholder: 'folder-name',
            deletePathTooltip: 'Remove this path',
            moveUpTooltip: 'Move up',
            moveDownTooltip: 'Move down',
            maxPathsWarning: 'Maximum 6 paths allowed',
            statusMultiPathOn: 'Multi-path download enabled',
            statusMultiPathOff: 'Multi-path download disabled',
            statusPathAdded: 'Path added: {name} ({folder})',
            statusPathRemoved: 'Path removed',
            statusPathEmpty: 'Name and folder cannot be empty'
        },

        zh_CN: {
            langAuto: '\uD83C\uDF10 \u81EA\u52A8\uFF08\u8DDF\u968F\u6D4F\u89C8\u5668\uFF09',
            langEnglish: 'English',
            langChinese: '\u4E2D\u6587',
            langLabel: '\u8BED\u8A00\uFF1A',
            headerTitle: 'Image Harvester',
            headerSubtitle: '\u9F20\u6807\u60AC\u505C\u5FEB\u901F\u4E0B\u8F7D\u56FE\u7247',
            enableExtension: '\u542F\u7528\u6269\u5C55',
            mediaDetection: '\u5A92\u4F53\u68C0\u6D4B',
            hoverDelay: '\u60AC\u505C\u5EF6\u8FDF\uFF1A',
            interactionSettings: '\u4EA4\u4E92\u8BBE\u7F6E\uFF1A',
            buttonSize: '\u6309\u94AE\u5927\u5C0F\uFF1A',
            toolbarSpacing: '\u6309\u94AE\u95F4\u8DDD\uFF1A',
            buttonPosition: '\u6309\u94AE\u4F4D\u7F6E\uFF1A',
            posTopRight: '\u53F3\u4E0A',
            posTopLeft: '\u5DE6\u4E0A',
            basicDetection: '\u57FA\u7840\u5A92\u4F53\u68C0\u6D4B\uFF1A',
            imgTags: 'IMG \u6807\u7B7E',
            videoElements: '\u89C6\u9891\u5143\u7D20',
            downloadModeLabel: '\u5F53\u524D\u4E0B\u8F7D\u6A21\u5F0F\uFF1A',
            modeNormal: '\u666E\u901A\u540E\u53F0\u4E0B\u8F7D',
            modeCanvasExperimental: 'Canvas \u63D0\u53D6\uFF08\u5B9E\u9A8C\u6027\uFF09',
            advancedSettings: '\u2699\uFE0F \u9AD8\u7EA7\u8BBE\u7F6E',
            experimentalHelp: '\u5BF9\u9650\u5236\u6027\u66F4\u5F3A\u7684\u7AD9\u70B9\u7684\u5B9E\u9A8C\u6A21\u5F0F\uFF0C\u6548\u679C\u56E0\u7AD9\u800C\u5F02\u3002',
            experimentalModes: '\uD83E\uDDEA \u5B9E\u9A8C\u6027\u4E0B\u8F7D\u6A21\u5F0F\uFF1A',
            normalDownload: '\u666E\u901A\u540E\u53F0\u4E0B\u8F7D',
            canvasExtraction: '\u5C1D\u8BD5 Canvas \u63D0\u53D6',
            advancedDetection: '\u9AD8\u7EA7\u68C0\u6D4B\u7C7B\u578B\uFF1A',
            svgElements: 'SVG \u5143\u7D20',
            backgroundImages: '\u80CC\u666F\u56FE\u7247',
            advancedDetectionHelp: '\u9AD8\u7EA7\u68C0\u6D4B\u6A21\u5F0F\uFF08\u9ED8\u8BA4\u5173\u95ED\uFF09',
            visualFeedback: '\u89C6\u89C9\u53CD\u9988\uFF1A',
            noBorder: '\u65E0\u8FB9\u6846\u9AD8\u4EAE',
            customBorderColor: '\u81EA\u5B9A\u4E49\u8FB9\u6846\u989C\u8272',
            subtleGrayBorder: '\u6D45\u7070\u8272\u8FB9\u6846',
            brightGreenBorder: '\u4EAE\u7EFF\u8272\u8FB9\u6846',
            visualFeedbackHelp: '\u60AC\u505C\u65F6\u5728\u56FE\u7247\u5468\u56F4\u663E\u793A\u8FB9\u6846',
            allowedExtensions: '\u5141\u8BB8\u7684\u6587\u4EF6\u6269\u5C55\u540D\uFF1A',
            allowedExtensionsHelp: '\u9017\u53F7\u5206\u9694\u7684\u5141\u8BB8\u6587\u4EF6\u6269\u5C55\u540D\u5217\u8868',
            minImageSize: '\u6700\u5C0F\u56FE\u7247\u5C3A\u5BF8\uFF08px\uFF09\uFF1A',
            minImageSizeHelp: '\u88AB\u68C0\u6D4B\u56FE\u7247\u7684\u6700\u5C0F\u5BBD/\u9AD8\uFF0850-1000px\uFF09',
            convertWebpToPng: '\u5C06 WebP \u8F6C\u6362\u4E3A PNG',
            convertWebpToPngHelp: '\u81EA\u52A8\u5C06 WebP \u56FE\u7247\u8F6C\u6362\u4E3A PNG \u683C\u5F0F\u4EE5\u63D0\u5347\u517C\u5BB9\u6027',
            longHideDelay: '\u4F7F\u7528\u957F\u9690\u85CF\u5EF6\u8FDF\uFF081.5s\uFF09',
            longHideDelayHelp: '\u9632\u6B62\u6309\u94AE\u5728\u6709\u95EE\u9898\u7684\u89C6\u9891\u64AD\u653E\u5668\u4E0A\u77AC\u95F4\u6D88\u5931',
            saveSubfolder: '\u4FDD\u5B58\u5B50\u6587\u4EF6\u5939\uFF1A',
            saveSubfolderPlaceholder: 'MyImages\uFF08\u53EF\u9009\uFF09',
            saveSubfolderHelp: '\u5C06\u56FE\u7247\u4FDD\u5B58\u5230 Downloads \u4E0B\u7684\u5B50\u6587\u4EF6\u5939\u3002\u7559\u7A7A\u5219\u76F4\u63A5\u4FDD\u5B58\u5230 Downloads\u3002',
            baseSubfolderLabel: '\u57FA\u7840\u4FDD\u5B58\u76EE\u5F55\uFF1A',
            baseSubfolderPlaceholder: 'image\uFF08\u53EF\u9009\uFF09',
            baseSubfolderHelp: 'Downloads \u4E0B\u7684\u7236\u7EA7\u6587\u4EF6\u5939\uFF0C\u6240\u6709\u8DEF\u5F84\uFF08\u5B50\u76EE\u5F55\u3001\u591A\u8DEF\u5F84\uFF09\u90FD\u5728\u6B64\u76EE\u5F55\u4E0B\u521B\u5EFA\u3002',
            currentSiteLabel: '\u5F53\u524D\u7AD9\u70B9\uFF1A',
            excludeSiteBtn: '\u6392\u9664',
            excludeSiteDone: '\u5DF2\u6392\u9664',
            manageExclusions: '\uD83D\uDEAB \u7BA1\u7406\u6392\u9664\u57DF\u540D',
            manageExclusionsHelp: '\u914D\u7F6E\u6269\u5C55\u4E0D\u751F\u6548\u7684\u57DF\u540D',
            manageStrategies: '\uD83D\uDD17 \u7F29\u7565\u56FE\u76F4\u94FE\u4E0B\u8F7D',
            manageStrategiesHelp: '\u901A\u8FC7\u914D\u7F6E\u6B63\u5219\uFF0C\u5728\u7F29\u7565\u56FE\u4E0A\u60AC\u505C\u5373\u53EF\u4E0B\u8F7D\u539F\u56FE',
            resetAllSettings: '\uD83D\uDD04 \u91CD\u7F6E\u6240\u6709\u8BBE\u7F6E',
            resetAllSettingsHelp: '\u5C06\u6240\u6709\u8BBE\u7F6E\u6062\u590D\u4E3A\u9ED8\u8BA4\u503C\uFF0C\u6B64\u64CD\u4F5C\u4E0D\u53EF\u64A4\u9500\u3002',
            bulkDownload: '\u6279\u91CF\u4E0B\u8F7D\uFF1A',
            galleryViewBtn: '\uD83D\uDCE6 \u56FE\u5E93\u89C6\u56FE',
            downloadZipBtn: '\uD83D\uDDC4\uFE0F \u4E0B\u8F7D ZIP',
            bulkDownloadHelp: '\u56FE\u5E93\u5728\u65B0\u6807\u7B7E\u9875\u4E2D\u6253\u5F00\u56FE\u7247\u3002ZIP \u5C06\u6240\u6709\u56FE\u7247\u6253\u5305\u4E3A\u538B\u7F29\u6587\u4EF6\u4E0B\u8F7D\u3002',
            statusEnabled: '\u6269\u5C55\u5DF2\u542F\u7528',
            statusDisabled: '\u6269\u5C55\u5DF2\u7981\u7528',
            statusSaveFailed: '\u4FDD\u5B58\u8BBE\u7F6E\u5931\u8D25',
            statusDelaySet: '\u5EF6\u8FDF\u5DF2\u8BBE\u7F6E\u4E3A {value}s',
            statusDelaySaveFailed: '\u4FDD\u5B58\u5EF6\u8FDF\u5931\u8D25',
            statusImgDetOn: 'IMG \u68C0\u6D4B\u5DF2\u542F\u7528',
            statusImgDetOff: 'IMG \u68C0\u6D4B\u5DF2\u7981\u7528',
            statusSvgDetOn: 'SVG \u68C0\u6D4B\u5DF2\u542F\u7528',
            statusSvgDetOff: 'SVG \u68C0\u6D4B\u5DF2\u7981\u7528',
            statusBgImgDetOn: '\u80CC\u666F\u56FE\u68C0\u6D4B\u5DF2\u542F\u7528',
            statusBgImgDetOff: '\u80CC\u666F\u56FE\u68C0\u6D4B\u5DF2\u7981\u7528',
            statusVideoDetOn: '\u89C6\u9891\u68C0\u6D4B\u5DF2\u542F\u7528',
            statusVideoDetOff: '\u89C6\u9891\u68C0\u6D4B\u5DF2\u7981\u7528',
            statusExtUpdated: '\u6587\u4EF6\u6269\u5C55\u540D\u5DF2\u66F4\u65B0',
            statusExtSaveFailed: '\u4FDD\u5B58\u6269\u5C55\u540D\u5931\u8D25',
            statusModeNormal: '\u4E0B\u8F7D\u6A21\u5F0F\u5DF2\u8BBE\u7F6E\u4E3A\uFF1A\u666E\u901A',
            statusModeCanvas: '\u4E0B\u8F7D\u6A21\u5F0F\u5DF2\u8BBE\u7F6E\u4E3A\uFF1ACanvas \u63D0\u53D6',
            statusBorderOff: '\u8FB9\u6846\u9AD8\u4EAE\u5DF2\u7981\u7528',
            statusBorderGray: '\u8FB9\u6846\u9AD8\u4EAE\u5DF2\u542F\u7528\uFF08\u7070\u8272\uFF09',
            statusBorderGreen: '\u8FB9\u6846\u9AD8\u4EAE\u5DF2\u542F\u7528\uFF08\u7EFF\u8272\uFF09',
            statusBorderCustom: '\u8FB9\u6846\u9AD8\u4EAE\u5DF2\u542F\u7528\uFF08{color}\uFF09',
            statusBorderSaveFailed: '\u4FDD\u5B58\u8FB9\u6846\u9AD8\u4EAE\u8BBE\u7F6E\u5931\u8D25',
            statusButtonSizeSet: '\u6309\u94AE\u5927\u5C0F\u5DF2\u8BBE\u7F6E\u4E3A {value}px',
            statusToolbarSpacingSet: '\u6309\u94AE\u95F4\u8DDD\u5DF2\u8BBE\u7F6E\u4E3A {value}px',
            statusMinSizeSet: '\u6700\u5C0F\u56FE\u7247\u5C3A\u5BF8\u5DF2\u8BBE\u7F6E\u4E3A {value}px',
            statusMinSizeFailed: '\u4FDD\u5B58\u6700\u5C0F\u5C3A\u5BF8\u5931\u8D25',
            statusMinSizeInvalid: '\u8F93\u5165 50 \u5230 1000 \u4E4B\u95F4\u7684\u6570\u503C',
            statusWebpPngOn: 'WebP \u8F6C PNG \u5DF2\u542F\u7528',
            statusWebpPngOff: 'WebP \u8F6C PNG \u5DF2\u7981\u7528',
            statusWebpPngFailed: '\u4FDD\u5B58 WebP \u8F6C\u6362\u8BBE\u7F6E\u5931\u8D25',
            statusLongHideOn: '\u957F\u9690\u85CF\u5EF6\u8FDF\u5DF2\u542F\u7528',
            statusLongHideOff: '\u957F\u9690\u85CF\u5EF6\u8FDF\u5DF2\u7981\u7528',
            statusDelaySettingFailed: '\u4FDD\u5B58\u5EF6\u8FDF\u8BBE\u7F6E\u5931\u8D25',
            statusSubfolderSet: '\u56FE\u7247\u5C06\u4FDD\u5B58\u5230 Downloads/{value}/',
            statusSubfolderDirect: '\u56FE\u7247\u5C06\u76F4\u63A5\u4FDD\u5B58\u5230 Downloads',
            statusSubfolderFailed: '\u4FDD\u5B58\u5B50\u6587\u4EF6\u5939\u8BBE\u7F6E\u5931\u8D25',
            statusLoadFailed: '\u52A0\u8F7D\u8BBE\u7F6E\u5931\u8D25',
            statusScanning: '\u6B63\u5728\u626B\u63CF\u56FE\u7247...',
            statusScanFailed: '\u626B\u63CF\u56FE\u7247\u5931\u8D25\uFF1A{error}',
            statusNoImages: '\u5F53\u524D\u9875\u9762\u672A\u627E\u5230\u56FE\u7247',
            statusGalleryOpened: '\u56FE\u5E93\u5DF2\u6253\u5F00\uFF0C\u5171 {count} \u5F20\u56FE\u7247',
            statusGalleryFailed: '\u521B\u5EFA\u56FE\u5E93\u5931\u8D25',
            statusJszipNotAvailable: 'JSZip \u5E93\u4E0D\u53EF\u7528',
            statusContentScriptError: '\u65E0\u6CD5\u4E0E\u9875\u9762\u5185\u5BB9\u811A\u672C\u901A\u4FE1',
            statusUnsupportedPage: '\u5F53\u524D\u9875\u9762\u4E0D\u652F\u6301\u56FE\u7247\u626B\u63CF',
            statusContentScriptNoResponse: '\u5185\u5BB9\u811A\u672C\u65E0\u54CD\u5E94',
            statusDownloading: '\u6B63\u5728\u4E0B\u8F7D {count} \u5F20\u56FE\u7247...',
            statusDownloadProgress: '\u5DF2\u4E0B\u8F7D {current}/{total} \u5F20\u56FE\u7247...',
            statusNoDownloads: '\u6CA1\u6709\u56FE\u7247\u53EF\u4EE5\u4E0B\u8F7D',
            statusCreatingZip: '\u6B63\u5728\u521B\u5EFA ZIP \u6587\u4EF6...',
            statusDownloadFailed: '\u4E0B\u8F7D\u5931\u8D25\uFF1A{error}',
            statusZipCreated: 'ZIP \u5DF2\u521B\u5EFA\uFF0C\u5171 {count} \u5F20\u56FE\u7247',
            statusZipCreateFailed: '\u521B\u5EFA ZIP \u6587\u4EF6\u5931\u8D25',
            statusJszipLoadFailed: 'JSZip \u5E93\u52A0\u8F7D\u5931\u8D25',
            statusJszipNotFunctioning: 'JSZip \u5E93\u8FD0\u884C\u5F02\u5E38',
            statusInitFailed: '\u6269\u5C55\u521D\u59CB\u5316\u5931\u8D25',
            statusResetDone: '\u6240\u6709\u8BBE\u7F6E\u5DF2\u6062\u590D\u4E3A\u9ED8\u8BA4\u503C',
            statusResetFailed: '\u91CD\u7F6E\u8BBE\u7F6E\u5931\u8D25',
            confirmReset: '\u786E\u5B9A\u8981\u5C06\u6240\u6709\u8BBE\u7F6E\u91CD\u7F6E\u4E3A\u9ED8\u8BA4\u503C\u5417\uFF1F\u6B64\u64CD\u4F5C\u4E0D\u53EF\u64A4\u9500\u3002',
            galleryTitle: '\u56FE\u5E93 - {title}',
            galleryTitleFallback: '\u56FE\u7247\u753B\u5EDC',
            galleryFound: '\u627E\u5230 {total} \u5F20\u56FE\u7247\uFF08{visible} \u5F20\u53EF\u89C1\uFF09',
            galleryTip: '\uD83D\uDCA1 <strong>\u6D4F\u89C8\u5E76\u6253\u5F00\u56FE\u7247</strong>\u3002\u4F7F\u7528\u7B5B\u9009\u529F\u80FD\u67E5\u627E\u9700\u8981\u7684\u56FE\u7247\uFF0C\u70B9\u51FB\u300C\u65B0\u6807\u7B7E\u9875\u6253\u5F00\u300D\u67E5\u770B/\u4FDD\u5B58\u56FE\u7247\u3002',
            galleryOpenInNewTab: '\u65B0\u6807\u7B7E\u9875\u6253\u5F00',
            galleryFilterBySize: '\u6309\u5C3A\u5BF8\u7B5B\u9009\uFF1A',
            galleryWidth: '\u5BBD\u5EA6\uFF1A',
            galleryHeight: '\u9AD8\u5EA6\uFF1A',
            galleryFilterByExt: '\u6309\u6587\u4EF6\u6269\u5C55\u540D\u7B5B\u9009\uFF1A',
            galleryResetFilters: '\u91CD\u7F6E\u7B5B\u9009',
            galleryZipDownload: '\uD83D\uDDC4\uFE0F\uFF08\u9AD8\u7EA7\uFF09ZIP \u4E0B\u8F7D',
            galleryCorsWarning: '\u26A0\uFE0F <strong>CORS \u9650\u5236\uFF1A</strong>\u6B64\u5904\u7684 ZIP \u4E0B\u8F7D\u4F7F\u7528 Fetch \u65B9\u6CD5\uFF0C\u53EC CORS \u9650\u5236\u3002\u4E3A\u63D0\u9AD8\u6210\u529F\u7387\uFF0C\u8BF7\u4F7F\u7528<strong>\u6269\u5C55\u5F39\u7A97\u4E2D\u7684 ZIP \u4E0B\u8F7D\u6309\u94AE</strong>\u2014\u2014\u5B83\u62E5\u6709\u6269\u5C55\u6743\u9650\uFF0C\u53EF\u80FD\u4E0B\u8F7D\u66F4\u591A\u56FE\u7247\u3002',
            galleryFooterLine1: '\uD83D\uDCC4 \u8FD9\u662F\u7531 <strong>\u56FE\u7247\u60AC\u505C\u4FDD\u5B58</strong> \u6265\u5C55 v{version} \u751F\u6210\u7684\u4E34\u65F6\u56FE\u5E93\u9875\u9762',
            galleryFooterLine2: '\u5173\u95ED\u9875\u9762\u540E\u6B64\u9875\u9762\u5C06\u4E22\u5931\u3002\u8BF7\u5728\u5173\u9875\u4E4B\u524B\u5B8C\u6210\u6240\u9700\u4E0B\u8F7D\u3002',
            galleryNoImagesToDownload: '\u6CA1\u6709\u9700\u8981\u4E0B\u8F7D\u7684\u56FE\u7247',
            galleryCreatingZip: '\u6B63\u5728\u521B\u5EFA ZIP \u6587\u4EF6...',
            galleryGeneratingZip: '\u6B63\u5728\u751F\u6210 ZIP \u6587\u4EF6...',
            galleryZipDownloaded: 'ZIP \u5DF2\u4E0B\u8F7D\uFF0C\u5171 {count} \u5F20\u56FE\u7247',
            galleryZipFailed: '\u521B\u5EFA ZIP \u6587\u4EF6\u5931\u8D25',
            galleryImageAlt: '\u56FE\u7247 {index}',

            // Multi-path download
            multiPathEnableLabel: '\u591A\u8DEF\u5F84\u4E0B\u8F7D',
            multiPathHelp: '\u5404\u8DEF\u5F84\u5206\u522B\u663E\u793A\u4E3A\u72EC\u7ACB\u6309\u94AE\uFF0C\u4EC5\u666E\u901A\u4E0B\u8F7D\u6A21\u5F0F\u751F\u6548\u3002',
            addPathBtn: '+ \u65B0\u589E\u8DEF\u5F84',
            pathNamePlaceholder: '\u5982\uFF1A\u7167\u7247',
            pathFolderPlaceholder: '\u76EE\u5F55\u540D',
            deletePathTooltip: '\u5220\u9664\u6B64\u8DEF\u5F84',
            moveUpTooltip: '\u4E0A\u79FB',
            moveDownTooltip: '\u4E0B\u79FB',
            maxPathsWarning: '\u6700\u591A\u652F\u6301 6 \u4E2A\u4FDD\u5B58\u8DEF\u5F84',
            statusMultiPathOn: '\u591A\u8DEF\u5F84\u4E0B\u8F7D\u5DF2\u542F\u7528',
            statusMultiPathOff: '\u591A\u8DEF\u5F84\u4E0B\u8F7D\u5DF2\u7981\u7528',
            statusPathAdded: '\u5DF2\u6DFB\u52A0\u8DEF\u5F84\uFF1A{name}\uFF08{folder}\uFF09',
            statusPathRemoved: '\u5DF2\u5220\u9664\u8DEF\u5F84',
            statusPathEmpty: '\u540D\u79F0\u548C\u76EE\u5F55\u4E0D\u80FD\u4E3A\u7A7A'
        }
    },

    getBrowserLocale() {
        try {
            const lang = chrome.i18n.getUILanguage();
            diag.log('getBrowserLocale -> raw:', lang);
            if (lang.startsWith('zh')) { diag.log('-> resolved: zh_CN'); return 'zh_CN'; }
            diag.log('-> resolved: en');
        } catch (e) {
            diag.error('Could not detect browser locale:', e.message);
        }
        return 'en';
    },

    getEffectiveLocale() {
        const result = this.currentLocale === 'auto' ? this.getBrowserLocale() : this.currentLocale;
        diag.log('getEffectiveLocale currentLocale=', this.currentLocale, '-> effective=', result);
        return result;
    },

    /** Simple translation lookup */
    t(key) {
        const locale = this.getEffectiveLocale();
        const table = this.translations[locale] || this.translations.en;
        return table[key] || key;
    },

    /** Translation with {placeholder} substitution */
    tf(key, params = {}) {
        let str = this.t(key);
        for (const [k, v] of Object.entries(params)) {
            str = str.replace(`{${k}}`, String(v));
        }
        return str;
    },

    /** Apply translations to all data-i18n elements in the DOM */
    applyToDOM() {
        const effective = this.getEffectiveLocale();
        diag.log('applyToDOM start, effective locale:', effective);

        const i18nEls = document.querySelectorAll('[data-i18n]');
        diag.log('applyToDOM: found', i18nEls.length, '[data-i18n] elements');
        i18nEls.forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translated = this.t(key);
            el.textContent = translated;
            if (key === 'headerTitle' || key === 'enableExtension') {
                diag.log('  applyToDOM [data-i18n] key=', key, '-> text=', translated);
            }
        });

        const placeholderEls = document.querySelectorAll('[data-i18n-placeholder]');
        placeholderEls.forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            el.placeholder = this.t(key);
        });

        // Update language selector option texts
        const optionEls = document.querySelectorAll('#languageSelect option[data-i18n]');
        optionEls.forEach(opt => {
            const key = opt.getAttribute('data-i18n');
            opt.textContent = this.t(key);
        });
        diag.log('applyToDOM done');
    },

    /** Load saved preference and apply */
    async init() {
        try {
            diag.log('i18n.init() start');
            const saved = await storage.get('ih_ui_language');
            this.currentLocale = saved || 'auto';
            diag.log('i18n.init() saved language from storage:', saved, ', currentLocale set to:', this.currentLocale);

            const select = document.getElementById('languageSelect');
            if (select) {
                select.value = this.currentLocale;
                diag.log('i18n.init() select element found, value set to:', this.currentLocale);
            } else {
                diag.error('i18n.init() #languageSelect NOT FOUND in DOM!');
            }

            this.applyToDOM();
            diag.log('i18n.init() complete, currentLocale=', this.currentLocale);
        } catch (err) {
            diag.error('i18n init failed:', err.message, err.stack);
        }
    },

    /** Switch language at runtime */
    async setLocale(locale) {
        diag.log('setLocale() called with:', locale, '(was:', this.currentLocale, ')');
        this.currentLocale = locale;
        try {
            await storage.set('ih_ui_language', locale);
            diag.log('setLocale() saved to storage OK');
        } catch (err) {
            diag.error('Failed to save language preference:', err.message);
        }
        this.applyToDOM();
        diag.log('setLocale() done, DOM updated for locale:', locale);
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

// Initialize popup
async function initializePopup() {
    try {
        // Initialize i18n first so DOM gets translated before we touch it
        await i18n.init();

        // Load current settings
        const enabled = await storage.get('ih_enabled');
        const delay = await storage.get('ih_hover_delay');
        const detectImg = await storage.get('ih_detect_img');
        const detectSvg = await storage.get('ih_detect_svg');
        const detectBackground = await storage.get('ih_detect_background');
        const detectVideo = await storage.get('ih_detect_video');
        const allowedExtensions = await storage.get('ih_allowed_extensions');
        const convertWebpToPng = await storage.get('ih_convert_webp_to_png');
        const borderHighlightMode = await storage.get('ih_border_highlight_mode');
        const longHideDelaySetting = await storage.get('ih_long_hide_delay');
        const downloadSubfolder = await storage.get('ih_download_subfolder');
        const baseSubfolder = await storage.get('ih_base_subfolder');
        
        // Multi-path settings
        const multiPathEnabled = await storage.get('ih_multi_path_enabled');
        const multiPaths = await storage.get('ih_multi_paths');
        
        // Set toggle state
        const enabledToggle = document.getElementById('enabledToggle');
        enabledToggle.checked = enabled !== false; // Default to true
        
        // Set delay slider
        const hoverDelay = document.getElementById('hoverDelay');
        const delayValue = delay || CONFIG.DEFAULT_HOVER_DELAY;
        hoverDelay.value = delayValue;
        updateDelayDisplay(delayValue);

        // Set button size slider
        const storedButtonSize = await storage.get('ih_button_size');
        const buttonSizeVal = storedButtonSize || 26;
        document.getElementById('buttonSize').value = buttonSizeVal;
        document.getElementById('buttonSizeValue').textContent = buttonSizeVal + 'px';

        // Set toolbar spacing slider
        const storedToolbarSpacing = await storage.get('ih_toolbar_spacing');
        const toolbarSpacingVal = storedToolbarSpacing || 7;
        document.getElementById('toolbarSpacing').value = toolbarSpacingVal;
        document.getElementById('toolbarSpacingValue').textContent = toolbarSpacingVal + 'px';

        // Set button position radio
        const storedPosition = await storage.get('ih_button_position') || 'top-right';
        const posRadio = document.querySelector(`input[name="buttonPosition"][value="${storedPosition}"]`);
        if (posRadio) posRadio.checked = true;

        // Set image detection checkboxes
        document.getElementById('detectImg').checked = detectImg !== false;
        document.getElementById('detectSvg').checked = detectSvg === true; // Disabled by default
        document.getElementById('detectBackground').checked = detectBackground === true; // Disabled by default
        document.getElementById('detectVideo').checked = detectVideo !== false;
        
        // Set border highlighting radio buttons
        const borderMode = borderHighlightMode || CONFIG.DEFAULT_BORDER_HIGHLIGHT;
        if (borderMode === 'custom') {
            document.getElementById('borderHighlightCustom').checked = true;
        } else if (borderMode === 'off') {
            document.getElementById('borderHighlightOff').checked = true;
        } else {
            // 兼容旧值 gray/green → 迁移到 custom
            const colorMap = { gray: '#888888', green: '#00ff00' };
            document.getElementById('borderHighlightCustom').checked = true;
            document.getElementById('borderHighlightColor').value = colorMap[borderMode] || '#00ff00';
            await storage.set('ih_border_highlight_mode', 'custom');
            await storage.set('ih_border_highlight_color', colorMap[borderMode] || '#00ff00');
        }
        // 加载已保存的自定义颜色
        const borderColor = await storage.get('ih_border_highlight_color');
        if (borderColor) {
            document.getElementById('borderHighlightColor').value = borderColor;
        }
        
        // Set experimental download mode
        const downloadMode = await storage.get('ih_download_mode') || 'normal';
        document.getElementById('downloadMode' + downloadMode.charAt(0).toUpperCase() + downloadMode.slice(1)).checked = true;
        
        // Set up download mode UI
        setupDownloadModeUI(downloadMode);
        
        // Lock/unlock multi-path based on current mode
        updateMultiPathAvailability(downloadMode);
        
        // Set allowed extensions
        const extensionsInput = document.getElementById('allowedExtensions');
        extensionsInput.placeholder = CONFIG.DEFAULT_EXTENSIONS_STRING;
        extensionsInput.value = allowedExtensions || CONFIG.DEFAULT_EXTENSIONS_STRING;
        
        // Set minimum image size
        const minImageSize = await storage.get('ih_min_image_size');
        const minImageSizeInput = document.getElementById('minImageSize');
        minImageSizeInput.value = minImageSize || CONFIG.MIN_IMAGE_SIZE;
        
        // Set WebP to PNG conversion option
        document.getElementById('convertWebpToPng').checked = convertWebpToPng === true; // Default: false
        
        // Set long hide delay option
        document.getElementById('longHideDelay').checked = longHideDelaySetting === true;
        
        // Set download subfolder (kept for ZIP / non-multi-path usage)
        const subfolderInput = document.getElementById('downloadSubfolder');
        if (subfolderInput) {
            subfolderInput.value = downloadSubfolder || '';
        }

        // Set base subfolder (parent for all download paths)
        const baseSubfolderInput = document.getElementById('baseSubfolder');
        if (baseSubfolderInput) {
            baseSubfolderInput.value = baseSubfolder || '';
        }
        
        // Set up multi-path UI
        const multiPathCheckbox = document.getElementById('multiPathEnabled');
        if (multiPathCheckbox) {
            multiPathCheckbox.checked = multiPathEnabled === true;
            document.getElementById('multiPathContainer').classList.toggle('hidden-container', !multiPathEnabled);
            renderPathList(multiPaths || []);
        }
        
        // Set up additional event listeners
        setupImageDetectionListeners();

        // Set up language selector listener
        setupLanguageSelectorListener();

        // Set up current site domain display
        setupCurrentSite();
        
        // Set version display
        const versionElement = document.getElementById('version');
        if (versionElement) {
            versionElement.textContent = `v${EXTENSION_VERSION}`;
        }
        
    } catch (error) {
        debug.error('Failed to initialize popup:', error);
        showStatus(i18n.t('statusLoadFailed'), 'error');
    }
}

// Set up download mode UI
function setupDownloadModeUI(currentMode) {
    const advancedSettings = document.getElementById('advancedSettings');

    // Set up auto-expand when experimental mode is selected
    const downloadModeRadios = document.querySelectorAll('input[name="downloadMode"]');
    downloadModeRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            if (this.value !== 'normal') {
                advancedSettings.open = true;
            }
        });
    });

    // Auto-expand if experimental mode is already selected
    if (currentMode !== 'normal') {
        advancedSettings.open = true;
    }
}

// Set up language selector event listener
function setupLanguageSelectorListener() {
    const languageSelect = document.getElementById('languageSelect');
    if (!languageSelect) {
        diag.error('setupLanguageSelectorListener: #languageSelect NOT FOUND!');
        return;
    }
    diag.log('setupLanguageSelectorListener: attached to #languageSelect');

    languageSelect.addEventListener('change', async (e) => {
        diag.log('languageSelect change event fired, new value:', e.target.value);
        await i18n.setLocale(e.target.value);
    });
}

// Set up event listeners
function setupEventListeners() {
    const enabledToggle = document.getElementById('enabledToggle');
    const hoverDelay = document.getElementById('hoverDelay');
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    const downloadZipBtn = document.getElementById('downloadZipBtn');
    const exclusionBtn = document.getElementById('exclusionBtn');
    
    // Toggle enabled/disabled
    enabledToggle.addEventListener('change', async (e) => {
        const success = await storage.set('ih_enabled', e.target.checked);
        if (success) {
            showStatus(e.target.checked ? i18n.t('statusEnabled') : i18n.t('statusDisabled'));
            await notifyContentScriptSettingsChanged();
        } else {
            showStatus(i18n.t('statusSaveFailed'), 'error');
            e.target.checked = !e.target.checked; // Revert
        }
    });
    
    // Update hover delay
    hoverDelay.addEventListener('input', (e) => {
        updateDelayDisplay(e.target.value);
    });

    hoverDelay.addEventListener('change', async (e) => {
        const value = parseInt(e.target.value);
        const success = await storage.set('ih_hover_delay', value);
        if (success) {
            showStatus(i18n.tf('statusDelaySet', { value: (value / 1000).toFixed(1) }));
            await notifyContentScriptSettingsChanged();
        } else {
            showStatus(i18n.t('statusDelaySaveFailed'), 'error');
        }
    });

    // 按钮大小滑块
    const buttonSizeSlider = document.getElementById('buttonSize');
    buttonSizeSlider.addEventListener('input', (e) => {
        document.getElementById('buttonSizeValue').textContent = e.target.value + 'px';
    });
    buttonSizeSlider.addEventListener('change', async (e) => {
        const value = parseInt(e.target.value);
        const success = await storage.set('ih_button_size', value);
        if (success) {
            showStatus(i18n.tf('statusButtonSizeSet', { value }));
            await notifyContentScriptSettingsChanged();
        } else {
            showStatus(i18n.t('statusSaveFailed'), 'error');
        }
    });

    // 多路径工具栏间距滑块
    const toolbarSpacingSlider = document.getElementById('toolbarSpacing');
    toolbarSpacingSlider.addEventListener('input', (e) => {
        document.getElementById('toolbarSpacingValue').textContent = e.target.value + 'px';
    });
    toolbarSpacingSlider.addEventListener('change', async (e) => {
        const value = parseInt(e.target.value);
        const success = await storage.set('ih_toolbar_spacing', value);
        if (success) {
            showStatus(i18n.tf('statusToolbarSpacingSet', { value }));
            await notifyContentScriptSettingsChanged();
        } else {
            showStatus(i18n.t('statusSaveFailed'), 'error');
        }
    });

    // 按钮位置 radio
    document.querySelectorAll('input[name="buttonPosition"]').forEach(radio => {
        radio.addEventListener('change', async (e) => {
            if (e.target.checked) {
                const success = await storage.set('ih_button_position', e.target.value);
                if (success) {
                    await notifyContentScriptSettingsChanged();
                }
            }
        });
    });

    // Bulk download buttons
    downloadAllBtn.addEventListener('click', handleGalleryView);
    downloadZipBtn.addEventListener('click', handleDownloadZip);
    
    // Exclusion button
    exclusionBtn.addEventListener('click', () => {
        chrome.tabs.create({
            url: chrome.runtime.getURL('exclusions.html')
        });
    });

    // URL 转换策略按钮
    const strategyBtn = document.getElementById('strategyBtn');
    strategyBtn.addEventListener('click', () => {
        chrome.tabs.create({
            url: chrome.runtime.getURL('strategies.html')
        });
    });
}

// Set up image detection event listeners
function setupImageDetectionListeners() {
    const detectImg = document.getElementById('detectImg');
    const detectSvg = document.getElementById('detectSvg');
    const detectBackground = document.getElementById('detectBackground');
    const detectVideo = document.getElementById('detectVideo');
    const allowedExtensions = document.getElementById('allowedExtensions');
    const downloadModeRadios = document.querySelectorAll('input[name="downloadMode"]');
    const borderHighlightRadios = document.querySelectorAll('input[name="borderHighlight"]');
    
    // Image type detection checkboxes
    detectImg.addEventListener('change', async (e) => {
        const success = await storage.set('ih_detect_img', e.target.checked);
        if (success) {
            showStatus(e.target.checked ? i18n.t('statusImgDetOn') : i18n.t('statusImgDetOff'));
            await notifyContentScriptSettingsChanged();
        } else {
            showStatus(i18n.t('statusSaveFailed'), 'error');
            e.target.checked = !e.target.checked;
        }
    });
    
    detectSvg.addEventListener('change', async (e) => {
        const success = await storage.set('ih_detect_svg', e.target.checked);
        if (success) {
            showStatus(e.target.checked ? i18n.t('statusSvgDetOn') : i18n.t('statusSvgDetOff'));
            await notifyContentScriptSettingsChanged();
        } else {
            showStatus(i18n.t('statusSaveFailed'), 'error');
            e.target.checked = !e.target.checked;
        }
    });
    
    detectBackground.addEventListener('change', async (e) => {
        const success = await storage.set('ih_detect_background', e.target.checked);
        if (success) {
            showStatus(e.target.checked ? i18n.t('statusBgImgDetOn') : i18n.t('statusBgImgDetOff'));
            await notifyContentScriptSettingsChanged();
        } else {
            showStatus(i18n.t('statusSaveFailed'), 'error');
            e.target.checked = !e.target.checked;
        }
    });
    
    detectVideo.addEventListener('change', async (e) => {
        const success = await storage.set('ih_detect_video', e.target.checked);
        if (success) {
            showStatus(e.target.checked ? i18n.t('statusVideoDetOn') : i18n.t('statusVideoDetOff'));
            await notifyContentScriptSettingsChanged();
        } else {
            showStatus(i18n.t('statusSaveFailed'), 'error');
            e.target.checked = !e.target.checked;
        }
    });
    
    // Allowed extensions input
    allowedExtensions.addEventListener('change', async (e) => {
        const value = e.target.value.trim();
        const success = await storage.set('ih_allowed_extensions', value);
        if (success) {
            showStatus(i18n.t('statusExtUpdated'));
        } else {
            showStatus(i18n.t('statusExtSaveFailed'), 'error');
        }
    });
    
    // Download mode radio buttons
    downloadModeRadios.forEach(radio => {
        radio.addEventListener('change', async (e) => {
            if (e.target.checked) {
                const success = await storage.set('ih_download_mode', e.target.value);
                if (success) {
                    const msgKey = e.target.value === 'normal' ? 'statusModeNormal' : 'statusModeCanvas';
                    showStatus(i18n.t(msgKey));

                    // Lock/unlock multi-path based on mode
                    updateMultiPathAvailability(e.target.value);
                } else {
                    showStatus(i18n.t('statusSaveFailed'), 'error');
                    // Revert to previous selection
                    const currentMode = await storage.get('ih_download_mode') || 'normal';
                    document.getElementById('downloadMode' + currentMode.charAt(0).toUpperCase() + currentMode.slice(1)).checked = true;
                }
            }
        });
    });
    
    // Border highlighting radio buttons
    borderHighlightRadios.forEach(radio => {
        radio.addEventListener('change', async (e) => {
            if (e.target.checked) {
                const mode = e.target.value;
                if (mode === 'custom') {
                    const color = document.getElementById('borderHighlightColor').value;
                    await storage.set('ih_border_highlight_mode', 'custom');
                    await storage.set('ih_border_highlight_color', color);
                    showStatus(i18n.tf('statusBorderCustom', { color }));
                } else {
                    await storage.set('ih_border_highlight_mode', 'off');
                    showStatus(i18n.t('statusBorderOff'));
                }
                await notifyContentScriptSettingsChanged();
            }
        });
    });

    // 颜色选择器变更：自动切换到 custom 模式
    document.getElementById('borderHighlightColor').addEventListener('input', async (e) => {
        document.getElementById('borderHighlightCustom').checked = true;
        await storage.set('ih_border_highlight_mode', 'custom');
        await storage.set('ih_border_highlight_color', e.target.value);
        await notifyContentScriptSettingsChanged();
    });
    
    // Minimum image size input
    const minImageSize = document.getElementById('minImageSize');
    minImageSize.addEventListener('change', async (e) => {
        const value = parseInt(e.target.value);
        if (e.target.validity.valid && value >= 50 && value <= 1000) {
            const success = await storage.set('ih_min_image_size', value);
            if (success) {
                showStatus(i18n.tf('statusMinSizeSet', { value }));
                await notifyContentScriptSettingsChanged();
            } else {
                showStatus(i18n.t('statusMinSizeFailed'), 'error');
            }
        } else {
            showStatus(i18n.t('statusMinSizeInvalid'), 'error');
            e.target.value = CONFIG.MIN_IMAGE_SIZE;
        }
    });
    
    // WebP to PNG conversion checkbox
    const convertWebpToPng = document.getElementById('convertWebpToPng');
    convertWebpToPng.addEventListener('change', async (e) => {
        const success = await storage.set('ih_convert_webp_to_png', e.target.checked);
        if (success) {
            showStatus(e.target.checked ? i18n.t('statusWebpPngOn') : i18n.t('statusWebpPngOff'));
            await notifyContentScriptSettingsChanged();
        } else {
            showStatus(i18n.t('statusWebpPngFailed'), 'error');
            e.target.checked = !e.target.checked;
        }
    });

    // Long hide delay checkbox
    const longHideDelay = document.getElementById('longHideDelay');
    longHideDelay.addEventListener('change', async (e) => {
        const success = await storage.set('ih_long_hide_delay', e.target.checked);
        if (success) {
            showStatus(e.target.checked ? i18n.t('statusLongHideOn') : i18n.t('statusLongHideOff'));
            await notifyContentScriptSettingsChanged();
        } else {
            showStatus(i18n.t('statusDelaySettingFailed'), 'error');
            e.target.checked = !e.target.checked;
        }
    });

    // Download subfolder input (kept for ZIP / non-multi-path usage)
    const downloadSubfolderInputEl = document.getElementById('downloadSubfolder');
    if (downloadSubfolderInputEl) {
        downloadSubfolderInputEl.addEventListener('change', async (e) => {
            let rawValue = e.target.value.trim();
            let sanitized = rawValue.replace(/[<>:"\\|?*]/g, '').replace(/^[/\\]+|[/\\]+$/g, '');
            e.target.value = sanitized;
            const success = await storage.set('ih_download_subfolder', sanitized);
            if (success) {
                if (sanitized) {
                    showStatus(i18n.tf('statusSubfolderSet', { value: sanitized }));
                } else {
                    showStatus(i18n.t('statusSubfolderDirect'));
                }
                await notifyContentScriptSettingsChanged();
            } else {
                showStatus(i18n.t('statusSubfolderFailed'), 'error');
            }
        });
    }

    // Base subfolder input (parent directory for all download paths)
    const baseSubfolderInputEl = document.getElementById('baseSubfolder');
    if (baseSubfolderInputEl) {
        baseSubfolderInputEl.addEventListener('change', async (e) => {
            let rawValue = e.target.value.trim();
            let sanitized = rawValue.replace(/[<>:"\\|?*]/g, '').replace(/^[/\\]+|[/\\]+$/g, '');
            e.target.value = sanitized;
            const success = await storage.set('ih_base_subfolder', sanitized);
            if (success) {
                if (sanitized) {
                    showStatus(`Base dir: Downloads/${sanitized}/`);
                } else {
                    showStatus('Base dir cleared, saving to Downloads/');
                }
                await notifyContentScriptSettingsChanged();
            } else {
                showStatus('Failed to save base directory setting', 'error');
            }
        });
    }
    
    // Reset button
    const resetBtn = document.getElementById('resetBtn');
    resetBtn.addEventListener('click', async () => {
        if (confirm(i18n.t('confirmReset'))) {
            await resetAllSettings();
        }
    });
    
    // Multi-path settings
    setupMultiPathListeners();
}

// ===== Multi-Path Save Functions =====
const MAX_MULTI_PATHS = 6;

// Render the path list from stored data
function renderPathList(paths) {
    const container = document.getElementById('pathList');
    if (!container) return;
    container.innerHTML = '';
    
    (paths || []).forEach((path, index) => {
        const item = document.createElement('div');
        item.className = 'path-item';
        item.dataset.index = index;
        
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'path-name';
        nameInput.placeholder = i18n.t('pathNamePlaceholder');
        nameInput.value = path.name || '';
        nameInput.dataset.index = index;
        nameInput.dataset.field = 'name';
        
        const folderInput = document.createElement('input');
        folderInput.type = 'text';
        folderInput.className = 'path-folder';
        folderInput.placeholder = i18n.t('pathFolderPlaceholder');
        folderInput.value = path.path || '';
        folderInput.dataset.index = index;
        folderInput.dataset.field = 'folder';
        
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'remove-path-btn';
        removeBtn.title = i18n.t('deletePathTooltip');
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', () => removePath(index));

        // Reorder buttons
        const reorderGroup = document.createElement('div');
        reorderGroup.className = 'path-reorder';

        const moveUpBtn = document.createElement('button');
        moveUpBtn.type = 'button';
        moveUpBtn.className = 'reorder-btn reorder-up';
        moveUpBtn.title = i18n.t('moveUpTooltip');
        moveUpBtn.disabled = index === 0;
        moveUpBtn.textContent = '↑';
        moveUpBtn.addEventListener('click', () => movePath(index, -1));

        const moveDownBtn = document.createElement('button');
        moveDownBtn.type = 'button';
        moveDownBtn.className = 'reorder-btn reorder-down';
        moveDownBtn.title = i18n.t('moveDownTooltip');
        moveDownBtn.disabled = index === paths.length - 1;
        moveDownBtn.textContent = '↓';
        moveDownBtn.addEventListener('click', () => movePath(index, 1));

        reorderGroup.appendChild(moveUpBtn);
        reorderGroup.appendChild(moveDownBtn);

        // Auto-save on blur (change)
        nameInput.addEventListener('change', () => updatePath(index));
        folderInput.addEventListener('change', () => updatePath(index));

        item.appendChild(nameInput);
        item.appendChild(folderInput);
        item.appendChild(reorderGroup);
        item.appendChild(removeBtn);
        container.appendChild(item);
    });
    
    updateAddPathButtonVisibility(paths);
}

// Add a new empty path entry
function addPath() {
    storage.get('ih_multi_paths').then((paths) => {
        if (!Array.isArray(paths)) paths = [];
        if (paths.length >= MAX_MULTI_PATHS) {
            showStatus(i18n.t('maxPathsWarning'), 'error');
            return;
        }
        paths.push({ name: '', path: '', enabled: true });
        storage.set('ih_multi_paths', paths).then(() => {
            renderPathList(paths);
        });
    });
}

// Remove a path at given index
function removePath(index) {
    storage.get('ih_multi_paths').then((paths) => {
        if (!Array.isArray(paths)) return;
        paths.splice(index, 1);
        storage.set('ih_multi_paths', paths).then(() => {
            renderPathList(paths);
            showStatus(i18n.t('statusPathRemoved'));
        });
    });
}

// Move a path up or down by one position
function movePath(index, direction) { // direction: -1 = up, +1 = down
    storage.get('ih_multi_paths').then((paths) => {
        if (!Array.isArray(paths)) return;
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= paths.length) return;

        // Swap elements in array
        [paths[index], paths[newIndex]] = [paths[newIndex], paths[index]];
        storage.set('ih_multi_paths', paths).then(() => {
            renderPathList(paths);
        });
    });
}

// Update a path's fields from input values
function updatePath(index) {
    storage.get('ih_multi_paths').then((paths) => {
        if (!Array.isArray(paths) || !paths[index]) return;
        
        const container = document.getElementById('pathList');
        if (!container) return;
        
        const items = container.querySelectorAll('.path-item');
        const targetItem = items[index];
        if (!targetItem) return;
        
        const nameInput = targetItem.querySelector('.path-name');
        const folderInput = targetItem.querySelector('.path-folder');
        
        const newName = (nameInput ? nameInput.value.trim() : '');
        const newFolder = (folderInput ? folderInput.value.trim() : '');
        
        // Validate: both fields required
        if (!newName && !newFolder) {
            showStatus(i18n.t('statusPathEmpty'), 'error');
            // Restore original values
            if (nameInput) nameInput.value = paths[index].name || '';
            if (folderInput) folderInput.value = paths[index].path || '';
            return;
        }
        
        // Sanitize folder name
        const sanitizedFolder = newFolder.replace(/[<>:"\\|?*]/g, '').replace(/^[/\\]+|[/\\]+$/g, '');
        
        paths[index].name = newName;
        paths[index].path = sanitizedFolder;
        
        // Update input with sanitized value
        if (folderInput) folderInput.value = sanitizedFolder;
        
        storage.set('ih_multi_paths', paths).then(() => {
            showStatus(i18n.tf('statusPathAdded', { name: newName || '(unnamed)', folder: sanitizedFolder }));
            
            // Notify content script of settings change
            notifyContentScriptSettingsChanged().catch(() => {});
        });
    });
}

// Show/hide Add Path button based on current count
function updateAddPathButtonVisibility(paths) {
    const btn = document.getElementById('addPathBtn');
    if (!btn) return;
    if ((paths || []).length >= MAX_MULTI_PATHS) {
        btn.style.display = 'none';
        showStatus(i18n.t('maxPathsWarning'), 'info');
    } else {
        btn.style.display = '';
    }
}

// Enable or disable multi-path settings based on download mode
// Multi-path only works in Normal mode
function updateMultiPathAvailability(downloadMode) {
    const isNormal = downloadMode === 'normal';
    const multiPathCheckbox = document.getElementById('multiPathEnabled');
    const multiPathContainer = document.getElementById('multiPathContainer');
    const multiPathSection = document.querySelector('.multi-path-section');

    if (!multiPathCheckbox) return;

    if (isNormal) {
        multiPathCheckbox.disabled = false;
        if (multiPathSection) {
            multiPathSection.style.opacity = '1';
            multiPathSection.style.pointerEvents = 'auto';
        }
        // 如果之前配置过多路径，切回 normal 时自动勾选
        if (!multiPathCheckbox.checked) {
            storage.get('ih_multi_paths').then(paths => {
                if (Array.isArray(paths) && paths.some(p => p.name && p.path)) {
                    multiPathCheckbox.checked = true;
                    multiPathContainer.classList.remove('hidden-container');
                    storage.set('ih_multi_path_enabled', true).catch(() => {});
                }
            });
        }
        multiPathContainer.classList.toggle('hidden-container', !multiPathCheckbox.checked);
    } else {
        // Disable: lock checkbox, hide container, show visual hint
        if (multiPathCheckbox.checked) {
            multiPathCheckbox.checked = false;
            storage.set('ih_multi_path_enabled', false).catch(() => {});
            multiPathContainer.classList.add('hidden-container');
        }
        multiPathCheckbox.disabled = true;
        if (multiPathContainer) {
            multiPathContainer.classList.add('hidden-container');
        }
        if (multiPathSection) {
            multiPathSection.style.opacity = '0.5';
            multiPathSection.style.pointerEvents = 'none';
        }
    }
}

// Set up all multi-path event listeners
function setupMultiPathListeners() {
    // Toggle multi-path container visibility
    const multiPathCheckbox = document.getElementById('multiPathEnabled');
    const multiPathContainer = document.getElementById('multiPathContainer');
    if (multiPathCheckbox && multiPathContainer) {
        multiPathCheckbox.addEventListener('change', async (e) => {
            const enabled = e.target.checked;
            multiPathContainer.classList.toggle('hidden-container', !enabled);
            const success = await storage.set('ih_multi_path_enabled', enabled);
            if (success) {
                showStatus(enabled ? i18n.t('statusMultiPathOn') : i18n.t('statusMultiPathOff'));
                await notifyContentScriptSettingsChanged();
            } else {
                showStatus(i18n.t('statusSaveFailed'), 'error');
                e.target.checked = !enabled;
                multiPathContainer.classList.toggle('hidden-container', enabled);
            }
        });
    }
    
    // Add new path button
    const addPathBtn = document.getElementById('addPathBtn');
    if (addPathBtn) {
        addPathBtn.addEventListener('click', addPath);
    }
}

// Get current settings for image detection
async function getCurrentSettings() {
    try {
        const detectImg = await storage.get('ih_detect_img');
        const detectSvg = await storage.get('ih_detect_svg');
        const detectBackground = await storage.get('ih_detect_background');
        const detectVideo = await storage.get('ih_detect_video');
        const allowedExtensions = await storage.get('ih_allowed_extensions');
        const convertWebpToPng = await storage.get('ih_convert_webp_to_png');
        const minImageSize = await storage.get('ih_min_image_size');
        const borderHighlightMode = await storage.get('ih_border_highlight_mode');
        const longHideDelay = await storage.get('ih_long_hide_delay');
        const hoverDelaySetting = await storage.get('ih_hover_delay');

        return {
            detectImg: detectImg !== false, // Default: true
            detectSvg: detectSvg === true, // Default: false
            detectBackground: detectBackground === true, // Default: false
            detectVideo: detectVideo !== false, // Default: true
            convertWebpToPng: convertWebpToPng === true, // Default: false
            longHideDelay: longHideDelay === true, // Default: false
            hoverDelay: hoverDelaySetting || CONFIG.DEFAULT_HOVER_DELAY,
            borderHighlightMode: borderHighlightMode || CONFIG.DEFAULT_BORDER_HIGHLIGHT, // Default: 'off'
            minImageSize: minImageSize || CONFIG.MIN_IMAGE_SIZE,
            allowedExtensions: (allowedExtensions || CONFIG.DEFAULT_EXTENSIONS_STRING)
                .split(',')
                .map(ext => ext.trim())
                .filter(ext => ext.length > 0)
        };
    } catch (error) {
        debug.error('Error getting settings:', error);
        // Return defaults if storage fails
        return {
            detectImg: true,
            detectSvg: false, // Changed default
            detectBackground: false, // Changed default
            detectVideo: true,
            convertWebpToPng: false, // Default: false
            minImageSize: CONFIG.MIN_IMAGE_SIZE,
            allowedExtensions: CONFIG.DEFAULT_EXTENSIONS
        };
    }
}

// Handle gallery view
async function handleGalleryView() {
    try {
        debug.log('Gallery view started');
        showStatus(i18n.t('statusScanning'), 'info');
        
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        debug.log('Active tab:', activeTab);

        // 检查是否为支持 content script 注入的页面
        const url = activeTab.url || '';
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            debug.warn('Unsupported page for gallery view:', url);
            showStatus(i18n.t('statusUnsupportedPage'), 'info');
            return;
        }

        const settings = await getCurrentSettings();
        debug.log('Current settings:', settings);

        debug.log('Sending message to content script...');
        let response;
        try {
            response = await chrome.tabs.sendMessage(activeTab.id, {
                type: 'scan_images',
                settings: settings
            });
        } catch (e) {
            debug.error('Content script not available:', e.message);
            showStatus(i18n.t('statusContentScriptError'), 'error');
            return;
        }
        
        debug.log('Response from content script:', response);
        
        if (!response.success) {
            debug.error('Scan failed:', response.error);
            showStatus(i18n.tf('statusScanFailed', { error: response.error }), 'error');
            return;
        }
        
        const images = response.images;
        debug.log('Found images:', images.length, images);
        
        if (images.length === 0) {
            showStatus(i18n.t('statusNoImages'), 'info');
            return;
        }
        
        // Create gallery HTML
        debug.log('Creating gallery HTML...');
        const galleryHtml = await createGalleryHtml(images, activeTab.title);
        debug.log('Gallery HTML length:', galleryHtml.length);
        
        // Open gallery in new tab
        debug.log('Opening gallery in new tab...');
        chrome.tabs.create({
            url: 'data:text/html;charset=utf-8,' + encodeURIComponent(galleryHtml)
        });
        
        showStatus(i18n.tf('statusGalleryOpened', { count: images.length }));
        debug.log('Gallery view completed successfully');
        
    } catch (error) {
        debug.error('Gallery view error:', error);
        showStatus(i18n.t('statusGalleryFailed'), 'error');
    }
}

// Handle ZIP download
async function handleDownloadZip() {
    debug.log('[IH Popup] ZIP download started');
    
    // First check if JSZip is available
    if (typeof JSZip === 'undefined') {
        debug.error('[IH Popup] JSZip not available during download');
        showStatus(i18n.t('statusJszipNotAvailable'), 'error');
        return;
    }
    
    try {
        showStatus(i18n.t('statusScanning'), 'info');
        
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        debug.log('[IH Popup] Active tab:', activeTab.url);

        // 检查是否为支持 content script 注入的页面
        if (!activeTab.url || (!activeTab.url.startsWith('http://') && !activeTab.url.startsWith('https://'))) {
            debug.warn('[IH Popup] Unsupported page for ZIP download:', activeTab.url);
            showStatus(i18n.t('statusUnsupportedPage'), 'info');
            return;
        }

        const settings = await getCurrentSettings();
        debug.log('[IH Popup] Current settings:', settings);
        
        debug.log('[IH Popup] Sending message to content script...');
        
        let response;
        try {
            response = await chrome.tabs.sendMessage(activeTab.id, {
                type: 'scan_images',
                settings: settings
            });
        } catch (messageError) {
            debug.error('[IH Popup] Failed to send message to content script:', messageError);
            showStatus(i18n.t('statusContentScriptError'), 'error');
            return;
        }
        
        debug.log('[IH Popup] Response from content script:', response);
        
        if (!response) {
            debug.error('[IH Popup] No response from content script');
            showStatus(i18n.t('statusContentScriptNoResponse'), 'error');
            return;
        }
        
        if (!response.success) {
            debug.error('Scan failed:', response.error);
            showStatus(i18n.tf('statusScanFailed', { error: response.error }), 'error');
            return;
        }
        
        const images = response.images;
        debug.log('Found images:', images.length, images);
        
        if (images.length === 0) {
            showStatus(i18n.t('statusNoImages'), 'info');
            return;
        }
        
        showStatus(i18n.tf('statusDownloading', { count: images.length }), 'info');
        
        // Create ZIP file
        debug.log('Creating ZIP file with JSZip...');
        const zip = new JSZip();
        const imageFolder = zip.folder('images');
        
        let downloadedCount = 0;
        const totalCount = images.length;
        
        // Download each image and add to ZIP
        let skippedCount = 0;
        for (let i = 0; i < images.length; i++) {
            const image = images[i];
            debug.log(`Processing image ${i + 1}/${totalCount}:`, image.url);
            
            try {
                debug.log('Fetching image data...');
                const imageData = await fetchImageAsBlob(image.url);
                debug.log('Image data received, size:', imageData.size);
                
                const filename = generateImageFilename(image, i);
                debug.log('Generated filename:', filename);
                
                imageFolder.file(filename, imageData);
                downloadedCount++;
                
                // Update progress
                showStatus(i18n.tf('statusDownloadProgress', { current: downloadedCount, total: totalCount }), 'info');
                debug.log(`Successfully added image ${downloadedCount}/${totalCount} to ZIP`);
                
            } catch (error) {
                skippedCount++;
                debug.warn(`Failed to download image ${i + 1}/${totalCount} (${image.url}):`, error.message);
                // Continue with other images - this handles CORS and other fetch errors gracefully
            }
        }
        
        debug.log(`ZIP creation completed. Downloaded: ${downloadedCount}/${totalCount}`);
        
        if (downloadedCount === 0) {
            showStatus(i18n.t('statusNoDownloads'), 'error');
            return;
        }
        
        // Generate ZIP file
        debug.log('Generating ZIP blob...');
        showStatus(i18n.t('statusCreatingZip'), 'info');
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        debug.log('ZIP blob created, size:', zipBlob.size);
        
        // Create download link
        const url = URL.createObjectURL(zipBlob);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const pageTitle = activeTab.title ? sanitizeFilename(activeTab.title).substring(0, 30) : 'page';
        const zipFilename = `ih_images_${pageTitle}_${timestamp}.zip`;
        
        // Prepend subfolder if configured
        const subfolder = await storage.get('ih_download_subfolder');
        const filename = (subfolder && subfolder.trim())
            ? `${subfolder.trim()}/${zipFilename}`
            : zipFilename;
        
        debug.log('Starting download with filename:', filename);
        
        // Use Chrome downloads API
        chrome.downloads.download({
            url: url,
            filename: filename,
            saveAs: false  // Download directly without prompting
        }, (downloadId) => {
            if (chrome.runtime.lastError) {
                debug.error('Download failed:', chrome.runtime.lastError.message);
                showStatus(i18n.tf('statusDownloadFailed', { error: chrome.runtime.lastError.message }), 'error');
            } else {
                debug.log('Download started with ID:', downloadId);
                showStatus(i18n.tf('statusZipCreated', { count: downloadedCount }));
            }
            
            // Clean up object URL
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        });
        
        debug.log('ZIP download completed successfully');
        
    } catch (error) {
        debug.error('ZIP download error:', error);
        showStatus(i18n.t('statusZipCreateFailed'), 'error');
    }
}

// Fetch image as blob
async function fetchImageAsBlob(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.blob();
}

// Generate filename for image
function generateImageFilename(image, index) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    
    try {
        const url = new URL(image.url, window.location.href);
        let filename = url.pathname.split('/').pop();
        
        // If no filename or no extension, generate one with timestamp
        if (!filename || !filename.includes('.')) {
            const extension = getExtensionFromType(image.type);
            filename = `image_${timestamp}_${index + 1}.${extension}`;
        } else {
            // If filename exists but might be generic, add timestamp for uniqueness
            const nameParts = filename.split('.');
            if (nameParts.length > 1) {
                const extension = nameParts.pop();
                const baseName = nameParts.join('.');
                // Add timestamp if filename is very generic or short
                if (baseName.length < 3 || ['image', 'img', 'pic', 'photo'].includes(baseName.toLowerCase())) {
                    filename = `${baseName}_${timestamp}.${extension}`;
                }
                // Otherwise use original filename as-is
            }
        }
        
        // Sanitize filename while preserving CJK characters
        filename = sanitizeFilename(filename);
        
        return filename;
    } catch {
        const extension = getExtensionFromType(image.type);
        return `image_${timestamp}_${index + 1}.${extension}`;
    }
}

// Get file extension based on image type
function getExtensionFromType(type) {
    switch (type) {
        case 'svg': return 'svg';
        case 'video': return 'mp4';
        case 'background': return 'jpg';
        default: return 'jpg';
    }
}

// Create gallery HTML (internationalized)
async function createGalleryHtml(images, pageTitle) {
    const title = pageTitle ? i18n.tf('galleryTitle', { title: pageTitle }) : i18n.t('galleryTitleFallback');
    const locale = i18n.getEffectiveLocale();
    const langAttr = locale === 'zh_CN' ? 'zh-CN' : 'en';
    
    // Get unique file extensions for filter
    const extensions = [...new Set(images.map(img => {
        try {
            const url = new URL(img.url);
            const ext = url.pathname.split('.').pop().toLowerCase();
            return ext && ext.length <= 4 ? ext : 'unknown';
        } catch {
            return 'unknown';
        }
    }))].sort();

    const openInNewTabText = i18n.t('galleryOpenInNewTab');

    const imageHtml = images.map((image, index) => {
        const alt = image.alt || i18n.tf('galleryImageAlt', { index: index + 1 });
        const dimensions = `${Math.round(image.width)}x${Math.round(image.height)}`;
        const fileExt = (() => {
            try {
                const url = new URL(image.url);
                const ext = url.pathname.split('.').pop().toLowerCase();
                return ext && ext.length <= 4 ? ext : 'unknown';
            } catch {
                return 'unknown';
            }
        })();
        
        return `
            <div class="gallery-item" data-width="${image.width}" data-height="${image.height}" data-ext="${fileExt}">
                <img src="${image.url}" alt="${alt}" loading="lazy">
                <div class="image-info">
                    <div class="image-title">${alt}</div>
                    <div class="image-meta">
                        <span class="image-type">${image.type.toUpperCase()}</span>
                        <span class="image-dimensions">${dimensions}</span>
                        <span class="image-ext">${fileExt.toUpperCase()}</span>
                    </div>
                    <a href="${image.url}" target="_blank" class="download-link">${openInNewTabText}</a>
                </div>
            </div>
        `;
    }).join('');
    
    const foundText = i18n.tf('galleryFound', { total: images.length, visible: `<span id="visibleCount">${images.length}</span>` });
    const tipText = i18n.t('galleryTip');
    const filterBySizeLabel = i18n.t('galleryFilterBySize');
    const widthLabel = i18n.t('galleryWidth');
    const heightLabel = i18n.t('galleryHeight');
    const filterByExtLabel = i18n.t('galleryFilterByExt');
    const resetFiltersText = i18n.t('galleryResetFilters');
    const zipDownloadText = i18n.t('galleryZipDownload');
    const corsWarningText = i18n.t('galleryCorsWarning');
    const footerLine1 = i18n.tf('galleryFooterLine1', { version: EXTENSION_VERSION });
    const footerLine2 = i18n.t('galleryFooterLine2');
    
    // Inline gallery script translations (serialized into the generated page)
    const gt = i18n.translations[locale] || i18n.translations.en;

    // 内联嵌入 JSZip（data URL 页面无法加载扩展资源）
    let jszipCode = '';
    try {
        const resp = await fetch(chrome.runtime.getURL('jszip.min.js'));
        jszipCode = await resp.text();
    } catch (e) {
        debug.warn('Failed to load JSZip for gallery:', e);
    }

    return `
        <!DOCTYPE html>
        <html lang="${langAttr}">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${title}</title>
            <script>${jszipCode}</script>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    margin: 0;
                    padding: 20px;
                    background-color: #f5f5f5;
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                }
                .header h1 {
                    color: #333;
                    margin: 0 0 10px 0;
                }
                .header p {
                    color: #666;
                    margin: 0;
                }
                .controls {
                    max-width: 1200px;
                    margin: 0 auto 20px auto;
                    background: white;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }
                .filter-section {
                    margin-bottom: 15px;
                }
                .filter-section label {
                    display: block;
                    font-weight: 600;
                    margin-bottom: 8px;
                    color: #333;
                }
                .size-filter {
                    display: flex;
                    gap: 10px;
                    align-items: center;
                    margin-bottom: 15px;
                }
                .size-filter input {
                    width: 80px;
                    padding: 4px 8px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                }
                .extension-filters {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                    margin-bottom: 15px;
                }
                .ext-checkbox {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }
                .ext-checkbox input {
                    margin: 0;
                }
                .action-buttons {
                    display: flex;
                    gap: 10px;
                }
                .btn {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: 500;
                    transition: background 0.2s;
                }
                .btn-primary {
                    background: #1976d2;
                    color: white;
                }
                .btn-primary:hover {
                    background: #1565c0;
                }
                .btn-secondary {
                    background: #e0e0e0;
                    color: #333;
                }
                .btn-secondary:hover {
                    background: #d0d0d0;
                }
                .gallery {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 20px;
                    max-width: 1200px;
                    margin: 0 auto;
                }
                .gallery-item {
                    background: white;
                    border-radius: 8px;
                    overflow: hidden;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    transition: transform 0.2s;
                }
                .gallery-item:hover {
                    transform: translateY(-2px);
                }
                .gallery-item.hidden {
                    display: none;
                }
                .gallery-item img {
                    width: 100%;
                    height: 200px;
                    object-fit: cover;
                    display: block;
                }
                .image-info {
                    padding: 15px;
                }
                .image-title {
                    font-weight: 600;
                    color: #333;
                    margin-bottom: 8px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .image-meta {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 10px;
                    font-size: 12px;
                    color: #666;
                    flex-wrap: wrap;
                }
                .image-type, .image-ext {
                    background: #e1f5fe;
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-weight: 500;
                }
                .download-link {
                    display: inline-block;
                    background: #1976d2;
                    color: white;
                    padding: 6px 12px;
                    text-decoration: none;
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: 500;
                    transition: background 0.2s;
                }
                .download-link:hover {
                    background: #1565c0;
                }
                .stats {
                    text-align: center;
                    margin-bottom: 20px;
                    color: #666;
                }
                .status {
                    padding: 10px;
                    border-radius: 4px;
                    margin-bottom: 15px;
                    text-align: center;
                    font-weight: 500;
                }
                .status.info {
                    background: #e3f2fd;
                    color: #1976d2;
                }
                .status.success {
                    background: #e8f5e8;
                    color: #2e7d32;
                }
                .status.error {
                    background: #ffebee;
                    color: #c62828;
                }
                .status.hidden {
                    display: none;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>${title}</h1>
                <p class="stats">${foundText}</p>
                <p style="color: #666; font-size: 14px; margin: 10px 0 0 0;">
                    ${tipText}
                </p>
            </div>
            
            <div class="controls">
                <div class="status hidden" id="status"></div>
                
                <div class="filter-section">
                    <label>${filterBySizeLabel}</label>
                    <div class="size-filter">
                        <span>${widthLabel}</span>
                        <input type="number" id="minWidth" placeholder="Min" min="0">
                        <span>-</span>
                        <input type="number" id="maxWidth" placeholder="Max" min="0">
                        <span>${heightLabel}</span>
                        <input type="number" id="minHeight" placeholder="Min" min="0">
                        <span>-</span>
                        <input type="number" id="maxHeight" placeholder="Max" min="0">
                    </div>
                </div>
                
                <div class="filter-section">
                    <label>${filterByExtLabel}</label>
                    <div class="extension-filters">
                        ${extensions.map(ext => `
                            <div class="ext-checkbox">
                                <input type="checkbox" id="ext-${ext}" value="${ext}" checked>
                                <label for="ext-${ext}">${ext.toUpperCase()}</label>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="action-buttons">
                    <button class="btn btn-primary" id="resetFiltersBtn">${resetFiltersText}</button>
                    <button class="btn btn-secondary" id="downloadZipBtn">${zipDownloadText}</button>
                </div>
                
                <div class="download-info" style="margin-top: 15px; padding: 10px; background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; font-size: 12px; color: #856404;">
                    ${corsWarningText}
                </div>
            </div>
            
            <div class="gallery" id="gallery">
                ${imageHtml}
            </div>
            
            <footer style="margin-top: 40px; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0; background-color: #f8f9fa; color: #6c757d; font-size: 11px;">
                <p style="margin: 0 0 5px 0;">
                    ${footerLine1}
                </p>
                <p style="margin: 0; font-style: italic;">
                    ${footerLine2}
                </p>
            </footer>
            
            <script>
                // Debug wrapper for gallery page
                const DEBUG = false;
                const debug = {
                    log: (...args) => DEBUG && console.log(...args),
                    error: (...args) => DEBUG && console.error(...args),
                    warn: (...args) => DEBUG && console.warn(...args),
                    info: (...args) => DEBUG && console.info(...args)
                };
                
                const allImages = ${JSON.stringify(images)};
                let filteredImages = [...allImages];
                
                // Gallery page translations (embedded from popup locale)
                const _gt = ${JSON.stringify(gt)};
                function gt(key) { return _gt[key] || key; }
                
                function showStatus(message, type = 'info') {
                    const status = document.getElementById('status');
                    status.textContent = message;
                    status.className = 'status ' + type;
                    status.classList.remove('hidden');
                    
                    setTimeout(() => {
                        status.classList.add('hidden');
                    }, 3000);
                }
                
                function updateVisibleCount() {
                    const visibleItems = document.querySelectorAll('.gallery-item:not(.hidden)');
                    document.getElementById('visibleCount').textContent = visibleItems.length;
                }
                
                function applyFilters() {
                    const minWidth = parseInt(document.getElementById('minWidth').value) || 0;
                    const maxWidth = parseInt(document.getElementById('maxWidth').value) || Infinity;
                    const minHeight = parseInt(document.getElementById('minHeight').value) || 0;
                    const maxHeight = parseInt(document.getElementById('maxHeight').value) || Infinity;
                    
                    const enabledExtensions = new Set();
                    document.querySelectorAll('.ext-checkbox input:checked').forEach(cb => {
                        enabledExtensions.add(cb.value);
                    });
                    
                    const items = document.querySelectorAll('.gallery-item');
                    filteredImages = [];
                    
                    items.forEach((item, index) => {
                        const width = parseInt(item.dataset.width);
                        const height = parseInt(item.dataset.height);
                        const ext = item.dataset.ext;
                        
                        const sizeMatch = width >= minWidth && width <= maxWidth && 
                                        height >= minHeight && height <= maxHeight;
                        const extMatch = enabledExtensions.has(ext);
                        
                        if (sizeMatch && extMatch) {
                            item.classList.remove('hidden');
                            filteredImages.push(allImages[index]);
                        } else {
                            item.classList.add('hidden');
                        }
                    });
                    
                    updateVisibleCount();
                }
                
                async function downloadZip() {
                    if (filteredImages.length === 0) {
                        showStatus(gt('galleryNoImagesToDownload'), 'error');
                        return;
                    }

                    if (typeof JSZip === 'undefined') {
                        showStatus(gt('galleryZipFailed'), 'error');
                        return;
                    }

                    try {
                        showStatus(gt('galleryCreatingZip'), 'info');

                        const zip = new JSZip();
                        const imageFolder = zip.folder('images');
                        let downloadedCount = 0;
                        
                        for (let i = 0; i < filteredImages.length; i++) {
                            const image = filteredImages[i];
                            
                            try {
                                const response = await fetch(image.url);
                                if (!response.ok) throw new Error('Failed to fetch');
                                
                                const blob = await response.blob();
                                const filename = generateFilename(image, i);
                                
                                imageFolder.file(filename, blob);
                                downloadedCount++;
                                
                                const progressMsg = gt('galleryDownloaded')
                                    .replace('{count}', downloadedCount)
                                    .replace(/Downloaded.*?images/, 'Downloaded ' + downloadedCount + '/' + filteredImages.length + ' images...')
                                    .replace(/\u4E0B\u8F7D.*/, '\u5DF2\u4E0B\u8F7D ' + downloadedCount + '/' + filteredImages.length + ' \u5F20\u56FE\u7247...');
                                // Fallback: just use simple progress
                                showStatus(
                                    downloadedCount + '/' + filteredImages.length +
                                    (gt('galleryLangHint') || '').includes('zh') ? ' \u5F20\u56FE\u7247...' : ' images...'
                                , 'info');
                                showStatus('Downloaded ' + downloadedCount + '/' + filteredImages.length + '...', 'info');
                            } catch (error) {
                                debug.warn('Failed to download image:', image.url, error);
                            }
                        }
                        
                        if (downloadedCount === 0) {
                            showStatus(gt('galleryNoImagesToDownload'), 'error');
                            return;
                        }
                        
                        showStatus(gt('galleryGeneratingZip'), 'info');
                        const zipBlob = await zip.generateAsync({ type: 'blob' });
                        
                        const url = URL.createObjectURL(zipBlob);
                        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                        const filename = 'ih_gallery_images_' + timestamp + '.zip';
                        
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = filename;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                        
                        showStatus(gt('galleryZipDownloaded').replace('{count}', downloadedCount), 'success');
                    } catch (error) {
                        debug.error('ZIP download failed:', error);
                        showStatus(gt('galleryZipFailed'), 'error');
                    }
                }
                
                // Sanitize filename while preserving CJK characters
                function sanitizeFilename(filename) {
                    let result = '';
                    for (let i = 0; i < filename.length; i++) {
                        const char = filename.charAt(i);
                        const code = filename.charCodeAt(i);
                        
                        if ('<>:"/\\\\|?*'.includes(char)) {
                            result += '_';
                        }
                        else if (code >= 0 && code <= 31 || code === 127) {
                            result += '_';
                        }
                        else {
                            result += char;
                        }
                    }
                    
                    return result
                        .replace(/\\s+/g, '_')
                        .replace(/_{2,}/g, '_')
                        .replace(/^_|_$/g, '');
                }
                
                function generateFilename(image, index) {
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                    
                    try {
                        const url = new URL(image.url);
                        let filename = url.pathname.split('/').pop();
                        
                        if (!filename || !filename.includes('.')) {
                            const extension = image.url.split('.').pop() || 'jpg';
                            filename = 'image_' + timestamp + '_' + (index + 1) + '.' + extension;
                        }
                        
                        return sanitizeFilename(filename);
                    } catch {
                        return 'image_' + timestamp + '_' + (index + 1) + '.jpg';
                    }
                }
                
                function resetFilters() {
                    document.getElementById('minWidth').value = '';
                    document.getElementById('maxWidth').value = '';
                    document.getElementById('minHeight').value = '';
                    document.getElementById('maxHeight').value = '';
                    
                    document.querySelectorAll('.ext-checkbox input').forEach(cb => {
                        cb.checked = true;
                    });
                    
                    applyFilters();
                }
                
                // Event listeners
                document.getElementById('downloadZipBtn').addEventListener('click', downloadZip);
                document.getElementById('resetFiltersBtn').addEventListener('click', resetFilters);
                
                // Filter inputs
                ['minWidth', 'maxWidth', 'minHeight', 'maxHeight'].forEach(id => {
                    document.getElementById(id).addEventListener('input', applyFilters);
                });
                
                document.querySelectorAll('.ext-checkbox input').forEach(cb => {
                    cb.addEventListener('change', applyFilters);
                });
                
                // Initial filter application
                applyFilters();
            </script>
        </body>
        </html>
    `;
}

// Sanitize filename while preserving CJK characters
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

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    diag.log('[IH Popup] DOMContentLoaded fired');
    debug.log('[IH Popup] Initializing...');
    
    try {
        // Check if JSZip is available
        if (typeof JSZip === 'undefined') {
            debug.error('[IH Popup] JSZip not loaded');
            showStatus(i18n.t('statusJszipLoadFailed'), 'error');
            return;
        } else {
            debug.log('[IH Popup] JSZip loaded successfully, version:', JSZip.version || 'unknown');
            
            // Test JSZip functionality
            try {
                const testZip = new JSZip();
                testZip.file('test.txt', 'Hello World');
                const testBlob = await testZip.generateAsync({ type: 'blob' });
                debug.log('[IH Popup] JSZip test successful, blob size:', testBlob.size);
            } catch (zipError) {
                debug.error('[IH Popup] JSZip test failed:', zipError);
                showStatus(i18n.t('statusJszipNotFunctioning'), 'error');
                return;
            }
        }
        
        // Initialize popup and event listeners
        await initializePopup();
        setupEventListeners();
        
        debug.log('[IH Popup] Initialization complete');
    } catch (error) {
        debug.error('[IH Popup] Initialization failed:', error);
        showStatus(i18n.t('statusInitFailed'), 'error');
    }
});

// Reset all settings to default values
async function resetAllSettings() {
    try {
        // Clear all extension settings
        await chrome.storage.sync.clear();
        
        // Reinitialize popup with default values
        await initializePopup();
        
        // Notify content script of the reset settings
        await notifyContentScriptSettingsChanged();
        
        showStatus(i18n.t('statusResetDone'));
    } catch (error) {
        debug.error('Failed to reset settings:', error);
        showStatus(i18n.t('statusResetFailed'), 'error');
    }
}

// Notify content script of settings changes
async function notifyContentScriptSettingsChanged() {
    try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab && activeTab.id) {
            const settings = await getCurrentSettings();
            const minImageSize = await storage.get('ih_min_image_size');
            
            chrome.tabs.sendMessage(activeTab.id, {
                type: 'settings_updated',
                settings: {
                    ...settings,
                    minImageSize: minImageSize || CONFIG.MIN_IMAGE_SIZE
                }
            }).catch(error => {
                // Ignore errors - content script might not be ready or page might not support it
                debug.log('Could not notify content script:', error.message);
            });
        }
    } catch (error) {
        debug.log('Could not notify content script:', error.message);
    }
}

// ===== Current Site Domain =====

// 获取当前标签页域名并显示排除按钮
async function setupCurrentSite() {
    const domainSpan = document.getElementById('currentSiteDomain');
    const excludeBtn = document.getElementById('excludeSiteBtn');
    const section = document.getElementById('currentSiteSection');

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.url) {
            section.style.display = 'none';
            return;
        }

        const url = new URL(tab.url);
        // 只对 http/https 页面显示
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            section.style.display = 'none';
            return;
        }

        const domain = url.hostname;
        domainSpan.textContent = domain;

        // 点击排除/恢复按钮
        excludeBtn.addEventListener('click', async () => {
            const currentExclusions = (await storage.get('ih_domain_exclusions')) || [];
            const idx = currentExclusions.indexOf(domain);
            let ok;
            if (idx !== -1) {
                // 已排除 → 恢复
                currentExclusions.splice(idx, 1);
                ok = await storage.set('ih_domain_exclusions', currentExclusions);
                if (ok) {
                    excludeBtn.textContent = i18n.t('excludeSiteBtn');
                    excludeBtn.classList.remove('excluded');
                    showStatus(i18n.t('statusSaved'), 'success');
                }
            } else {
                // 未排除 → 加入排除
                currentExclusions.push(domain);
                ok = await storage.set('ih_domain_exclusions', currentExclusions);
                if (ok) {
                    markAsExcluded(excludeBtn);
                    showStatus(i18n.t('statusSaved'), 'success');
                }
            }
        });

        // 检查初始状态
        const exclusions = (await storage.get('ih_domain_exclusions')) || [];
        if (exclusions.includes(domain)) {
            markAsExcluded(excludeBtn);
        }
    } catch (error) {
        debug.error('Failed to get current site:', error);
        section.style.display = 'none';
    }
}

function markAsExcluded(btn) {
    btn.textContent = i18n.t('excludeSiteDone');
    btn.classList.add('excluded');
}
