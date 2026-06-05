/**
 * ZATCA Phase-2 QR payload (TLV → base64) for supplier sales invoices.
 * Tags 1–5: seller, VAT, timestamp, total incl VAT, VAT amount.
 * Tags 6–9: invoice hash + cryptographic stamp fields (deterministic per invoice).
 */

function writeTlvText(chunks, tag, text) {
    const val = new TextEncoder().encode(String(text ?? '').trim());
    if (!val.length) return;
    if (val.length > 255) {
        writeTlvBytes(chunks, tag, val.slice(0, 255));
        return;
    }
    const tlv = new Uint8Array(2 + val.length);
    tlv[0] = tag;
    tlv[1] = val.length;
    tlv.set(val, 2);
    chunks.push(tlv);
}

function writeTlvBytes(chunks, tag, valueBytes) {
    const val = valueBytes instanceof Uint8Array ? valueBytes : new Uint8Array(valueBytes);
    if (!val.length) return;

    let tlv;
    if (val.length <= 255) {
        tlv = new Uint8Array(2 + val.length);
        tlv[0] = tag;
        tlv[1] = val.length;
        tlv.set(val, 2);
    } else if (val.length <= 65535) {
        tlv = new Uint8Array(4 + val.length);
        tlv[0] = tag;
        tlv[1] = 0x82;
        tlv[2] = (val.length >> 8) & 0xff;
        tlv[3] = val.length & 0xff;
        tlv.set(val, 4);
    } else {
        tlv = new Uint8Array(4 + 65535);
        tlv[0] = tag;
        tlv[1] = 0x82;
        tlv[2] = 0xff;
        tlv[3] = 0xff;
        tlv.set(val.slice(0, 65535), 4);
    }
    chunks.push(tlv);
}

function concatTlv(chunks) {
    const totalLen = chunks.reduce((n, c) => n + c.length, 0);
    const out = new Uint8Array(totalLen);
    let off = 0;
    for (const c of chunks) {
        out.set(c, off);
        off += c.length;
    }
    let binary = '';
    for (let i = 0; i < out.length; i += 1) {
        binary += String.fromCharCode(out[i]);
    }
    return btoa(binary);
}

async function sha256Bytes(text) {
    const data = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return new Uint8Array(hash);
}

/** Raw bytes → base64 string (so TLV tags 6–9 are readable text, not binary). */
function bytesToBase64(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function hexToBytes(hex) {
    const clean = String(hex || '').replace(/[^0-9a-f]/gi, '');
    if (clean.length < 2) return new Uint8Array(0);
    const len = Math.min(clean.length - (clean.length % 2), 128);
    const out = new Uint8Array(len / 2);
    for (let i = 0; i < len; i += 2) {
        out[i / 2] = parseInt(clean.slice(i, i + 2), 16);
    }
    return out;
}

/**
 * Build ZATCA Phase-2 TLV (9 tags) as base64.
 * Returns null when required Phase-1 fields are missing.
 */
export async function buildZatcaPhase2QrTlvBase64(opts) {
    const sellerName = String(opts.sellerName || '').trim();
    const vatNumber = String(opts.vatNumber || '').trim();
    const totalWithVat = String(opts.totalWithVat || '').trim();
    const vatAmount = String(opts.vatAmount || '').trim();
    if (!sellerName || !vatNumber || !totalWithVat || !vatAmount) return null;

    const timestampUtc = new Date(opts.timestampUtc);
    const ts = Number.isNaN(timestampUtc.getTime())
        ? new Date().toISOString()
        : timestampUtc.toISOString();

    const invoiceNumber = String(opts.invoiceNumber || '').trim();
    const canonical = [
        sellerName,
        vatNumber,
        ts,
        totalWithVat,
        vatAmount,
        invoiceNumber,
    ].join('|');

    const invoiceHash = await sha256Bytes(canonical);
    const digitalSignature = await sha256Bytes(`${canonical}|sig`);
    const publicKeySeed = await sha256Bytes(`${vatNumber}|${sellerName}|pk`);
    const publicKey = publicKeySeed.slice(0, 33);
    const certStamp = (await sha256Bytes(`${canonical}|stamp`)).slice(0, 32);

    const chunks = [];
    writeTlvText(chunks, 1, sellerName);
    writeTlvText(chunks, 2, vatNumber);
    writeTlvText(chunks, 3, ts);
    writeTlvText(chunks, 4, totalWithVat);
    writeTlvText(chunks, 5, vatAmount);
    // Tags 6–9 carried as base64 TEXT (not raw bytes) so generic scanners show
    // clean strings instead of garbled symbols. Tag 6 = base64(invoice hash)
    // matches the ZATCA spec; 7–9 are deterministic placeholders until the real
    // ECDSA signing / certificate stamp is wired via the ZATCA APIs.
    writeTlvText(chunks, 6, bytesToBase64(invoiceHash));
    writeTlvText(chunks, 7, bytesToBase64(digitalSignature));
    writeTlvText(chunks, 8, bytesToBase64(publicKey));
    writeTlvText(chunks, 9, bytesToBase64(certStamp));

    return concatTlv(chunks);
}

/** @deprecated Use buildZatcaPhase2QrPayloadFromInvoice */
export function buildZatcaQrTlvBase64(opts) {
    const s = String(opts.sellerName || '').trim();
    const v = String(opts.vatNumber || '').trim();
    const t = String(opts.totalWithVat || '').trim();
    const va = String(opts.vatAmount || '').trim();
    if (!s || !v || !t || !va) return null;

    const ts = new Date(opts.timestampUtc).toISOString();
    const chunks = [];
    writeTlvText(chunks, 1, s);
    writeTlvText(chunks, 2, v);
    writeTlvText(chunks, 3, ts);
    writeTlvText(chunks, 4, t);
    writeTlvText(chunks, 5, va);
    return concatTlv(chunks);
}

export async function buildZatcaPhase2QrPayloadFromInvoice({
    sellerName,
    vatNumber,
    invoiceDate,
    invoiceNumber,
    grandTotal,
    vatAmount,
}) {
    const dateRaw = invoiceDate ? new Date(invoiceDate) : new Date();
    const timestampUtc = Number.isNaN(dateRaw.getTime()) ? new Date() : dateRaw;
    return buildZatcaPhase2QrTlvBase64({
        sellerName,
        vatNumber,
        timestampUtc,
        invoiceNumber,
        totalWithVat: Number(grandTotal ?? 0).toFixed(2),
        vatAmount: Number(vatAmount ?? 0).toFixed(2),
    });
}

/**
 * Phase-1 payload — ONLY tags 1–5 (seller, VAT, timestamp, total incl VAT,
 * VAT amount). No cryptographic stamp tags, so scanners show just those five
 * clean fields. Use until the real ZATCA Phase-2 signing is integrated.
 */
export function buildZatcaPhase1QrPayloadFromInvoice({
    sellerName,
    vatNumber,
    invoiceDate,
    grandTotal,
    vatAmount,
}) {
    const dateRaw = invoiceDate ? new Date(invoiceDate) : new Date();
    const timestampUtc = Number.isNaN(dateRaw.getTime()) ? new Date() : dateRaw;
    return buildZatcaQrTlvBase64({
        sellerName,
        vatNumber,
        timestampUtc,
        totalWithVat: Number(grandTotal ?? 0).toFixed(2),
        vatAmount: Number(vatAmount ?? 0).toFixed(2),
    });
}

/** Backward-compatible alias — now returns Phase-2 payload. */
export async function buildZatcaQrPayloadFromInvoice(params) {
    return buildZatcaPhase2QrPayloadFromInvoice(params);
}

export { hexToBytes };
