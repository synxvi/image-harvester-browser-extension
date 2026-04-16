# Image Harvester — Chrome Hover-to-Download Extension

**[中文文档](README_zh.md)**

A lightweight Chrome extension (Manifest V3) that lets you save images instantly — just hover and click. Zero build dependencies, pure JavaScript.

## Features

### Core

| Feature | Description |
|---|---|
| **Hover to Download** | A download button appears when you hover over an image |
| **Adjustable Delay** | Button appearance delay from 0.5s to 3s (default 1s) |
| **One-Click Save** | Save directly to your Downloads folder, no confirmation dialog |
| **Video Support** | Works with `<video>` elements too |
| **Toggle On/Off** | Enable or disable the extension with one click |
| **Domain Exclusions** | Exclude specific websites where the extension should not activate |

### Multi-Path Download

- Configure multiple download paths, each mapped to a separate subfolder
- Each path shows as an independent hover button
- Download to different destinations in a single hover
- Reorder paths with drag controls

### Bulk Download

- **Gallery View** — Open all page images in a new tab with filtering and preview
- **ZIP Archive** — Package all images into a ZIP file and download at once

### URL Transformation Strategies

Automatically convert thumbnail URLs to original image URLs on supported sites:

| Site | Behavior |
|---|---|
| **Wallhaven** | Strips thumbnail suffix, fetches full-resolution image |
| **Pixiv** | Converts thumbnail to original resolution (experimental) |
| **Twitter/X** | Upgrades `_thumb` / `_small` variants to full-size `orig` |
| **Custom** | Add your own regex-based rules for any site |

### Experimental Download Modes

For sites with hotlink protection or other restrictions:

| Mode | Description |
|---|---|
| **Normal** | Downloads via the background Service Worker; best compatibility |
| **Fetch** | Requests from the page context to bypass some hotlink checks |
| **Canvas Extraction** | Draws the image to a canvas and re-exports it |

### Advanced Detection

- **SVG Elements** — Detect and download inline SVG graphics
- **Background Images** — Detect CSS `background-image` and allow download

### Other Options

| Feature | Description |
|---|---|
| **Min Size Filter** | Ignore images smaller than a threshold (50–1000px) |
| **File Extension Filter** | Whitelist specific file extensions |
| **WebP → PNG** | Auto-convert WebP images to PNG for compatibility |
| **Long Hide Delay** | Extend button fade-out to 1.5s for problematic video players |
| **Visual Feedback** | Highlight hoverable images with a border (off / gray / green) |
| **Context Menu** | Right-click download for plain links (non-`<img>` elements) |

## Install

### Manual Load (Developer Mode)

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked**
5. Select the `extension/` folder from this project

## Usage

1. Browse any page with images
2. Hover over a target image (default 1.5s wait)
3. A download button appears at the top-right corner of the image
4. Click to save — the file goes straight to your Downloads folder
5. If multi-path is configured, multiple buttons appear for different destinations

Click the extension icon to open the settings panel, switch modes, or disable the extension.

## Permissions

| Permission | Purpose |
|---|---|
| `downloads` | Save files to the download directory |
| `storage` | Store user preferences via Chrome Sync |
| `tabs` | Cross-tab communication and badge status |
| `activeTab` | Interact with the current page |
| `declarativeNetRequest` | Modify request headers for cross-origin downloads |
| `declarativeNetRequestWithHostAccess` | Apply network rules dynamically |
| `<all_urls>` | Work on all websites |
| `contextMenus` | Add right-click menu entries |

## Privacy

- **No personal data collected** — ever
- **No outbound network requests** — everything stays local
- Settings are stored in Chrome Sync, tied to your own Google account

## Tech Stack

- **Manifest V3** — Latest Chrome extension standard
- **Service Worker** — Background download engine
- **Content Scripts** — In-page hover interaction
- **JSZip v3.10.1** (MIT) — ZIP archive creation

## License

[**zlib-acknowledgement**](LICENSE) — A permissive open-source license allowing commercial use, modification, and redistribution with original copyright attribution.

### Third-Party Libraries

| Library | Version | License | Purpose |
|---|---|---|---|
| [JSZip](https://github.com/Stuk/jszip) | v3.10.1 | MIT | Create ZIP archives for bulk downloads |

## Authors

**Current maintainer:** synxvi ([GitHub](https://github.com/synxvi))

**Original author:** Jaewoo Jeon ([@thejjw](https://github.com/thejjw)) — [Original project](https://github.com/thejjw/image-hover-save-chrome-extension)

This extension builds on thejjw's original work with significant feature enhancements and optimizations.

If the original extension helped you, consider supporting:

[![Buy Me A Coffee](https://cdn.buymeacoffee.com/buttons/default-yellow.png)](https://buymeacoffee.com/thejjw)
