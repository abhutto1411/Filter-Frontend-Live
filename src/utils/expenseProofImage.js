/** Max longest edge after resize — receipts stay readable without huge payloads. */
const MAX_EDGE_PX = 2048;

/** Target decoded JPEG size (base64 in JSON is ~4/3× this). */
const TARGET_DECODED_BYTES = 2 * 1024 * 1024;

const MIN_JPEG_QUALITY = 0.42;

export const EXPENSE_PROOF_MAX_OUTPUT_BYTES = 5 * 1024 * 1024;

function decodedDataUrlBytes(dataUrl) {
    const comma = dataUrl.indexOf(',');
    const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
    const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
    return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Could not read image.'));
        };
        img.src = url;
    });
}

function drawToCanvas(img) {
    const longest = Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height);
    const scale = longest > MAX_EDGE_PX ? MAX_EDGE_PX / longest : 1;
    const width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
    const height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not process image.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return canvas;
}

/**
 * Resize + recompress receipt photos so base64 proof fits server limits.
 * Accepts any reasonable camera photo; output is JPEG ≤ ~5 MB decoded.
 */
export async function compressExpenseProofFile(file) {
    if (!file) throw new Error('No file selected.');
    if (!String(file.type || '').startsWith('image/')) {
        throw new Error('Please choose an image file (JPEG, PNG, or WebP).');
    }

    const img = await loadImageFromFile(file);
    const canvas = drawToCanvas(img);

    let quality = 0.88;
    let dataUrl = canvas.toDataURL('image/jpeg', quality);

    while (decodedDataUrlBytes(dataUrl) > TARGET_DECODED_BYTES && quality > MIN_JPEG_QUALITY) {
        quality = Math.max(MIN_JPEG_QUALITY, quality - 0.07);
        dataUrl = canvas.toDataURL('image/jpeg', quality);
    }

    if (decodedDataUrlBytes(dataUrl) > EXPENSE_PROOF_MAX_OUTPUT_BYTES) {
        throw new Error('Image is too large even after compression. Try cropping the photo.');
    }

    return dataUrl;
}
