// Image Harvester - Popup i18n (translation tables + locale handling)
// Copyright (c) Jaewoo Jeon (@thejjw) and Image Harvester Contributors
// SPDX-License-Identifier: zlib-acknowledgement
//
// MUST load after popup-config.js (uses `diag`, `storage` globals).
// Loaded before popup.js.

const i18n = {
    currentLocale: 'auto',

    translations: {
        en: {
            langAuto: '\uD83C\uDF10 Auto',
            langEnglish: 'EN',
            langChinese: 'CN',
            langLabel: 'Language:',
            headerTitle: 'Image Harvester',
            headerSubtitle: 'Quick image download on hover',
            enableExtension: 'On',
            enableOff: 'Off',
            mediaDetection: 'Media detection',
            hoverDelay: 'Delay:',
            interactionSettings: 'Interaction Settings:',
            buttonSize: 'Btn size:',
            toolbarSpacing: 'Btn gap:',
            buttonPosition: 'Btn position:',
            posTopRight: 'Top-right',
            posTopLeft: 'Top-left',
            basicDetection: 'Basic media detection:',
            imgTags: 'IMG',
            videoElements: 'Video',
            downloadModeLabel: 'Current download mode:',
            modeNormal: 'Normal (background)',
            modeCanvasExperimental: 'Canvas extraction (Experimental)',
            advancedSettings: '\u2699\uFE0F Advanced',
            experimentalHelp: 'Experimental modes for more restrictive sites. YMMV.',
            experimentalModes: 'Experimental download modes:',
            normalDownload: 'Normal background download',
            canvasExtraction: 'Canvas extraction',
            advancedDetection: 'Advanced detection types:',
            svgElements: 'SVG elements',
            backgroundImages: 'Background images',
            advancedDetectionHelp: 'Advanced detection modes (disabled by default)',
            visualFeedback: 'Visual feedback:',
            noBorder: 'No border highlighting',
            customBorderColor: 'Custom highlight color',
            subtleGrayBorder: 'Subtle gray border',
            brightGreenBorder: 'Bright green border',
            visualFeedbackHelp: 'Show border around images when hovering',
            glowDelayLabel: 'Glow delay:',
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
            baseSubfolderHelp: 'A parent folder inside Downloads. Sub save directories will be created under this directory.',
            currentSiteLabel: 'Current domain:',
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
            statusSaved: 'Settings saved',
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
            statusGlowDelaySet: 'Glow delay set to {value}s',
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
            galleryProgress: 'Fetched {n}/{total} images',
            galleryZipDownloaded: 'ZIP downloaded with {count} images',
            galleryZipFailed: 'Failed to create ZIP file',
            galleryImageAlt: 'Image {index}',

            // Multi-path download
            multiPathEnableLabel: 'Sub save directories',
            multiPathHelp: 'Each path shows as separate button.',
            addPathBtn: '+ Add Path',
            pathNamePlaceholder: 'e.g. Photos',
            pathFolderPlaceholder: 'folder-name',
            deletePathTooltip: 'Remove this path',
            moveUpTooltip: 'Move up',
            moveDownTooltip: 'Move down',
            maxPathsWarning: 'Maximum 10 paths allowed',
            statusMultiPathOn: 'Multi-path download enabled',
            statusMultiPathOff: 'Multi-path download disabled',
            statusPathAdded: 'Path added: {name} ({folder})',
            statusPathRemoved: 'Path removed',
            statusPathEmpty: 'Name and folder cannot be empty',
            tabBasic: 'General',
            tabAdvanced: 'Advanced',
            tabDownloads: 'Downloads',

            // Download history
            downloadHistoryTitle: 'Recent downloads',
            downloadHistoryHelp: 'Up to 300 records within the last 7 days',
            downloadHistoryEmpty: 'No downloads yet',
            clearDownloadHistory: 'Clear',
            downloadStatusPending: 'Downloading',
            downloadStatusSuccess: 'Saved',
            downloadStatusFailed: 'Failed',
            dlTimeJustNow: 'just now',
            dlTimeMinutesAgo: '{n}m ago',
            statusRetryQueued: 'Retrying: {name}',
            retryNotAvailable: 'Cannot retry (re-encoded in page)',
            retryHint: 'Click to retry',
            openFolderHint: 'Click to open folder',
            openFolderMissing: 'File not found (moved or deleted)',
            dlSourceTitle: 'Downloaded via',
            dlSourceHover: 'Hover',
            dlSourceContext: 'Right-click',
            dlSourceZip: 'ZIP',
            dlSourceGallery: 'Gallery',
            dlSourceOther: 'Other',
            dlRetryAllFailed: 'Retry failed',
            appearanceSection: 'Appearance:',
            themeLabel: 'Theme:',
            themeDark: 'Dark',
            themeLight: 'Light',
            themeSystem: 'System',
            hoverVisualFeedback: 'Hover visual feedback',
            statusDomainExcluded: 'Domain excluded — hover download disabled',
            templatePreviewLabel: 'Preview',
            templatePreviewEmpty: 'filename preview appears here…',
            gallerySelectVisible: 'Select visible',
            galleryClearSelection: 'Clear selection',
            galleryDownloadSelected: '⬇ Download selected',
            galleryZipSelected: '🗜 Zip selected',
            galleryStatsLine: 'Total {total} · Visible {visible} · Selected {selected}',
            galleryQueued: 'Queued {n} downloads',
            galleryEmptyData: 'No scan data found — reopen the gallery from the extension popup.',
            zipConfirm: 'Package {count} images into a ZIP and download?',
            zipCancel: 'Cancel',
            zipCancelling: 'Cancelling after current image...',
            zipAborted: 'ZIP download cancelled',
            zipPartialConfirm: 'Cancelled. Still package the {count} images already fetched?',
            zipDoneClean: 'ZIP saved ({ok} images)',
            zipDoneSummary: 'ZIP saved: {ok} images, {skip} skipped',
            zipRecordNote: '{ok} ok, {skip} skipped',

            // Filename template & provenance (task 2)
            namingProvenanceTitle: 'Filename template & provenance',
            filenameTemplateLabel: 'Image Rename:',
            filenameTemplateHelp: 'Empty = use default naming. Leave it blank to disable.',
            separatorLabel: 'Separators:',
            separatorSpace: 'space',
            statusTemplateSet: 'Filename template set to: {value}',
            statusTemplateCleared: 'Filename template cleared, using default naming',
        },

        zh_CN: {
            langAuto: '\uD83C\uDF10 Auto',
            langEnglish: 'EN',
            langChinese: 'CN',
            langLabel: '\u8BED\u8A00\uFF1A',
            headerTitle: 'Image Harvester',
            headerSubtitle: '\u9F20\u6807\u60AC\u505C\u5FEB\u901F\u4E0B\u8F7D\u56FE\u7247',
            enableExtension: '\u542F\u7528',
            enableOff: '\u7981\u7528',
            mediaDetection: '\u5A92\u4F53\u68C0\u6D4B',
            hoverDelay: '\u60AC\u505C\u5EF6\u8FDF\uFF1A',
            interactionSettings: '\u4EA4\u4E92\u8BBE\u7F6E\uFF1A',
            buttonSize: '\u6309\u94AE\u5927\u5C0F\uFF1A',
            toolbarSpacing: '\u6309\u94AE\u95F4\u8DDD\uFF1A',
            buttonPosition: '\u6309\u94AE\u4F4D\u7F6E\uFF1A',
            posTopRight: '\u53F3\u4E0A',
            posTopLeft: '\u5DE6\u4E0A',
            basicDetection: '\u57FA\u7840\u5A92\u4F53\u68C0\u6D4B\uFF1A',
            imgTags: '\u56FE\u7247',
            videoElements: '\u89C6\u9891',
            downloadModeLabel: '\u5F53\u524D\u4E0B\u8F7D\u6A21\u5F0F\uFF1A',
            modeNormal: '\u666E\u901A\u540E\u53F0\u4E0B\u8F7D',
            modeCanvasExperimental: 'Canvas \u63D0\u53D6\uFF08\u5B9E\u9A8C\u6027\uFF09',
            advancedSettings: '\u2699\uFE0F \u9AD8\u7EA7\u8BBE\u7F6E',
            experimentalHelp: '\u5BF9\u9650\u5236\u6027\u66F4\u5F3A\u7684\u7AD9\u70B9\u7684\u5B9E\u9A8C\u6A21\u5F0F\uFF0C\u6548\u679C\u56E0\u7AD9\u800C\u5F02\u3002',
            experimentalModes: '\u5B9E\u9A8C\u6027\u4E0B\u8F7D\u6A21\u5F0F\uFF1A',
            normalDownload: '\u666E\u901A\u540E\u53F0\u4E0B\u8F7D',
            canvasExtraction: 'Canvas 提取',
            advancedDetection: '\u9AD8\u7EA7\u68C0\u6D4B\u7C7B\u578B\uFF1A',
            svgElements: 'SVG \u5143\u7D20',
            backgroundImages: '\u80CC\u666F\u56FE\u7247',
            advancedDetectionHelp: '\u9AD8\u7EA7\u68C0\u6D4B\u6A21\u5F0F\uFF08\u9ED8\u8BA4\u5173\u95ED\uFF09',
            visualFeedback: '\u89C6\u89C9\u53CD\u9988\uFF1A',
            noBorder: '\u65E0\u8FB9\u6846\u9AD8\u4EAE',
            customBorderColor: '\u81EA\u5B9A\u4E49\u9AD8\u4EAE\u989C\u8272',
            subtleGrayBorder: '\u6D45\u7070\u8272\u8FB9\u6846',
            brightGreenBorder: '\u4EAE\u7EFF\u8272\u8FB9\u6846',
            visualFeedbackHelp: '\u60AC\u505C\u65F6\u5728\u56FE\u7247\u5468\u56F4\u663E\u793A\u8FB9\u6846',
            glowDelayLabel: '\u5149\u6655\u5EF6\u8FDF\uFF1A',
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
            baseSubfolderHelp: 'Downloads 下的父级文件夹，子保存目录在此创建。',
            currentSiteLabel: '\u5F53\u524D\u57DF\u540D\uFF1A',
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
            statusSaved: '\u8BBE\u7F6E\u5DF2\u4FDD\u5B58',
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
            statusGlowDelaySet: '\u5149\u6655\u5EF6\u8FDF\u5DF2\u8BBE\u7F6E\u4E3A {value}s',
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
            galleryProgress: '已获取 {n}/{total} 张图片',
            galleryZipDownloaded: 'ZIP \u5DF2\u4E0B\u8F7D\uFF0C\u5171 {count} \u5F20\u56FE\u7247',
            galleryZipFailed: '\u521B\u5EFA ZIP \u6587\u4EF6\u5931\u8D25',
            galleryImageAlt: '\u56FE\u7247 {index}',

            // Multi-path download
            multiPathEnableLabel: '子保存目录',
            multiPathHelp: '\u5404\u8DEF\u5F84\u5206\u522B\u663E\u793A\u4E3A\u72EC\u7ACB\u6309\u94AE\u3002',
            addPathBtn: '+ \u65B0\u589E\u8DEF\u5F84',
            pathNamePlaceholder: '\u5982\uFF1A\u7167\u7247',
            pathFolderPlaceholder: '\u76EE\u5F55\u540D',
            deletePathTooltip: '\u5220\u9664\u6B64\u8DEF\u5F84',
            moveUpTooltip: '\u4E0A\u79FB',
            moveDownTooltip: '\u4E0B\u79FB',
            maxPathsWarning: '\u6700\u591A\u652F\u6301 10 \u4E2A\u4FDD\u5B58\u8DEF\u5F84',
            statusMultiPathOn: '\u591A\u8DEF\u5F84\u4E0B\u8F7D\u5DF2\u542F\u7528',
            statusMultiPathOff: '\u591A\u8DEF\u5F84\u4E0B\u8F7D\u5DF2\u7981\u7528',
            statusPathAdded: '\u5DF2\u6DFB\u52A0\u8DEF\u5F84\uFF1A{name}\uFF08{folder}\uFF09',
            statusPathRemoved: '\u5DF2\u5220\u9664\u8DEF\u5F84',
            statusPathEmpty: '\u540D\u79F0\u548C\u76EE\u5F55\u4E0D\u80FD\u4E3A\u7A7A',
            tabBasic: '\u5E38\u89C4',
            tabAdvanced: '\u9AD8\u7EA7',
            tabDownloads: '\u4E0B\u8F7D\u8BB0\u5F55',

            // Download history
            downloadHistoryTitle: '\u8FD1\u671F\u4E0B\u8F7D',
            downloadHistoryHelp: '\u8FD17\u5929\u5185\u6700\u591A300\u6761\u8BB0\u5F55',
            downloadHistoryEmpty: '\u6682\u65E0\u4E0B\u8F7D\u8BB0\u5F55',
            clearDownloadHistory: '\u6E05\u7A7A',
            downloadStatusPending: '\u4E0B\u8F7D\u4E2D',
            downloadStatusSuccess: '\u6210\u529F',
            downloadStatusFailed: '\u5931\u8D25',
            dlTimeJustNow: '\u521A\u521A',
            dlTimeMinutesAgo: '{n} \u5206\u949F\u524D',
            statusRetryQueued: '\u6B63\u5728\u91CD\u8BD5\uFF1A{name}',
            retryNotAvailable: '\u65E0\u6CD5\u91CD\u8BD5\uFF08\u8BE5\u56FE\u7247\u9700\u5728\u9875\u9762\u5185\u91CD\u65B0\u8F6C\u6362\uFF09',
            retryHint: '\u70B9\u51FB\u91CD\u8BD5',
            openFolderHint: '点击打开所在目录',
            openFolderMissing: '文件已被移动或删除，无法打开所在目录',
            dlSourceTitle: '下载方式',
            dlSourceHover: '悬浮',
            dlSourceContext: '右键',
            dlSourceZip: 'ZIP',
            dlSourceGallery: '画廊',
            dlSourceOther: '其他',
            dlRetryAllFailed: '重试全部失败',
            appearanceSection: '外观：',
            themeLabel: '主题：',
            themeDark: '深色',
            themeLight: '浅色',
            themeSystem: '跟随系统',
            hoverVisualFeedback: '悬浮视觉反馈',
            statusDomainExcluded: '当前域名已排除，悬停下载不可用',
            templatePreviewLabel: '预览',
            templatePreviewEmpty: '文件名预览将显示在这里…',
            gallerySelectVisible: '全选可见',
            galleryClearSelection: '清除勾选',
            galleryDownloadSelected: '⬇ 下载选中',
            galleryZipSelected: '🗜 打包选中',
            galleryStatsLine: '共 {total} 张 · 可见 {visible} · 已选 {selected}',
            galleryQueued: '已加入下载队列 {n} 张',
            galleryEmptyData: '未找到扫描数据，请从扩展弹窗重新打开画廊。',
            zipConfirm: '将扫描到的 {count} 张图片打包为 ZIP 并下载？',
            zipCancel: '取消',
            zipCancelling: '将在当前图片后取消…',
            zipAborted: '已取消 ZIP 下载',
            zipPartialConfirm: '已取消。仍打包已获取的 {count} 张图片？',
            zipDoneClean: 'ZIP 已保存（共 {ok} 张）',
            zipDoneSummary: 'ZIP 已保存：成功 {ok} 张，跳过 {skip} 张',
            zipRecordNote: '成功 {ok} 张，跳过 {skip} 张',

            // Filename template & provenance (task 2)
            namingProvenanceTitle: '命名模板与溯源',
            filenameTemplateLabel: '图片重命名：',
            filenameTemplateHelp: '留空则使用默认命名，留空即为禁用。',
            separatorLabel: '分隔符：',
            separatorSpace: '空格',
            statusTemplateSet: '命名模板已设置为：{value}',
            statusTemplateCleared: '命名模板已清空，使用默认命名',
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

        diag.log('applyToDOM done');
    },

    /** Load saved preference and apply */
    async init() {
        try {
            diag.log('i18n.init() start');
            const saved = await storage.get('ih_ui_language');
            this.currentLocale = saved || 'auto';
            diag.log('i18n.init() saved language from storage:', saved, ', currentLocale set to:', this.currentLocale);

            // 旧版下拉选择器已由分段滑块替代（popup.js 的 setupLanguageSelectorListener
            // 负责 UI 初始化），此处找不到 #languageSelect 属正常，静默跳过
            const select = document.getElementById('languageSelect');
            if (select) {
                select.value = this.currentLocale;
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
