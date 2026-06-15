// Image Harvester - Content Image Processing (canvas extraction, WebP→PNG)
// Copyright (c) Jaewoo Jeon (@thejjw) and Image Harvester Contributors
// SPDX-License-Identifier: zlib-acknowledgement
//
// Depends on content-core.js (uses debug).
// Loaded after content-core.js.

// Extract image to canvas and return as blob
async function extractImageToCanvas(element) {
    try {
        debug.log('Attempting canvas extraction for element:', element.tagName);

        let imageElement = element;
        let sourceUrl = null;

        // Handle different element types
        if (element.tagName === 'IMG') {
            sourceUrl = element.src;
        } else if (element.tagName === 'VIDEO') {
            sourceUrl = element.currentSrc || element.src;
        } else {
            // For background images or other elements, try to extract the URL
            const computedStyle = window.getComputedStyle(element);
            const backgroundImage = computedStyle.backgroundImage;

            if (backgroundImage && backgroundImage !== 'none') {
                const urlMatch = backgroundImage.match(/url\(["']?([^"')]+)["']?\)/);
                if (urlMatch) {
                    sourceUrl = urlMatch[1];
                }
            }
        }

        if (!sourceUrl) {
            debug.warn('No source URL found for canvas extraction');
            return null;
        }

        debug.log('Canvas extraction source URL:', sourceUrl);

        // Create a new image element to load the source
        const img = new Image();

        // Set up cross-origin handling
        img.crossOrigin = 'anonymous';

        return new Promise((resolve, reject) => {
            img.onload = function() {
                try {
                    debug.log('Image loaded for canvas extraction, dimensions:', img.naturalWidth, 'x', img.naturalHeight);

                    // Create canvas
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    // Set canvas dimensions to match image
                    canvas.width = img.naturalWidth || img.width;
                    canvas.height = img.naturalHeight || img.height;

                    // Draw image to canvas
                    ctx.drawImage(img, 0, 0);

                    // Convert canvas to blob
                    canvas.toBlob((blob) => {
                        if (blob) {
                            debug.log('Canvas extraction successful, blob size:', blob.size);
                            resolve(blob);
                        } else {
                            debug.warn('Failed to create blob from canvas');
                            resolve(null);
                        }
                    }, 'image/png', 1.0);

                } catch (canvasError) {
                    debug.error('Canvas drawing error:', canvasError);
                    resolve(null);
                }
            };

            img.onerror = function() {
                debug.warn('Failed to load image for canvas extraction');
                resolve(null);
            };

            // Handle CORS errors gracefully
            img.onabort = function() {
                debug.warn('Image loading aborted for canvas extraction');
                resolve(null);
            };

            // Start loading the image
            img.src = sourceUrl;

            // Set a timeout to avoid hanging
            setTimeout(() => {
                debug.warn('Canvas extraction timeout');
                resolve(null);
            }, 10000);
        });

    } catch (error) {
        debug.error('Canvas extraction error:', error);
        return null;
    }
}

// Convert WebP image to PNG using canvas
async function convertWebpImageToPng(element) {
    try {
        debug.log('Attempting WebP to PNG conversion for element:', element.tagName);

        let sourceUrl = null;

        // Handle different element types
        if (element.tagName === 'IMG') {
            sourceUrl = element.src;
        } else {
            // For background images or other elements, try to extract the URL
            const computedStyle = window.getComputedStyle(element);
            const backgroundImage = computedStyle.backgroundImage;

            if (backgroundImage && backgroundImage !== 'none') {
                const urlMatch = backgroundImage.match(/url\(["']?([^"')]+)["']?\)/);
                if (urlMatch) {
                    sourceUrl = urlMatch[1];
                }
            }
        }

        if (!sourceUrl) {
            debug.warn('No source URL found for WebP conversion');
            return null;
        }

        // Check if the image is WebP
        if (!sourceUrl.toLowerCase().includes('.webp') && !sourceUrl.toLowerCase().includes('webp')) {
            debug.log('Image is not WebP, skipping conversion');
            return null;
        }

        // Check if the WebP is animated before converting (via background script to bypass CORS)
        let isAnimated = null;
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'check_webp_animated',
                url: sourceUrl
            });
            isAnimated = response.isAnimated;
        } catch (error) {
            debug.warn('Failed to check WebP animation status:', error);
            isAnimated = null;
        }

        if (isAnimated === true) {
            debug.log('WebP is animated, skipping PNG conversion to preserve animation');
            return null;
        } else if (isAnimated === null) {
            debug.warn('Could not determine if WebP is animated, skipping conversion for safety');
            return null;
        }

        debug.log('Converting static WebP to PNG, source URL:', sourceUrl);

        // Fetch the WebP image via background script (bypasses CORS)
        let imageDataUrl = null;
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'fetch_webp_for_conversion',
                url: sourceUrl
            });
            if (response.success) {
                imageDataUrl = response.dataUrl;
            }
        } catch (error) {
            debug.warn('Failed to fetch WebP image via background:', error);
            return null;
        }

        if (!imageDataUrl) {
            debug.warn('No data URL received for WebP conversion');
            return null;
        }

        // Create a new image element to load the WebP from data URL
        const img = new Image();

        return new Promise((resolve, reject) => {
            img.onload = function() {
                try {
                    debug.log('WebP image loaded for conversion, dimensions:', img.naturalWidth, 'x', img.naturalHeight);

                    // Create canvas
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    // Set canvas dimensions to match image
                    canvas.width = img.naturalWidth || img.width;
                    canvas.height = img.naturalHeight || img.height;

                    // Draw WebP image to canvas
                    ctx.drawImage(img, 0, 0);

                    // Convert canvas to PNG blob
                    canvas.toBlob((blob) => {
                        if (blob) {
                            debug.log('WebP to PNG conversion successful, blob size:', blob.size);
                            resolve(blob);
                        } else {
                            debug.warn('Failed to create PNG blob from WebP');
                            resolve(null);
                        }
                    }, 'image/png', 1.0);

                } catch (canvasError) {
                    debug.error('WebP to PNG conversion error:', canvasError);
                    resolve(null);
                }
            };

            img.onerror = function() {
                debug.warn('Failed to load WebP image for conversion');
                resolve(null);
            };

            // Handle CORS errors gracefully
            img.onabort = function() {
                debug.warn('WebP image loading aborted for conversion');
                resolve(null);
            };

            // Load the WebP image from data URL (no CORS issues)
            img.src = imageDataUrl;

            // Set a timeout to avoid hanging
            setTimeout(() => {
                debug.warn('WebP to PNG conversion timeout');
                resolve(null);
            }, 10000);
        });

    } catch (error) {
        debug.error('WebP to PNG conversion error:', error);
        return null;
    }
}
