/** Matches filter_backend `src/main.ts` JSON_BODY_LIMIT (`25mb`). */
export const RECORD_COLLECTION_JSON_BODY_LIMIT_BYTES = 25 * 1024 * 1024;

/** Max raw image file size before base64 (~4/3× in JSON). */
export const MAX_EXPENSE_PROOF_FILE_BYTES = 2 * 1024 * 1024;

/** Optional collection proof on RecordCollection uses the same file cap. */
export const MAX_COLLECTION_PROOF_FILE_BYTES = MAX_EXPENSE_PROOF_FILE_BYTES;

export function utf8ByteLength(str) {
    return new TextEncoder().encode(String(str ?? '')).length;
}

/**
 * Rough UTF-8 byte estimate for POST /locker/record-collection JSON
 * (dominated by base64 data URLs on expense lines and optional collection proof).
 */
export function estimateRecordCollectionPayloadBytes({ proofUrl, expenses } = {}) {
    let bytes = 8192;
    if (proofUrl) bytes += utf8ByteLength(proofUrl);
    if (Array.isArray(expenses)) {
        for (const ln of expenses) {
            const u = ln?.proofUrl;
            if (u) bytes += utf8ByteLength(u);
        }
    }
    return bytes;
}

export function recordCollectionPayloadWithinLimit(payload) {
    return estimateRecordCollectionPayloadBytes(payload) <= RECORD_COLLECTION_JSON_BODY_LIMIT_BYTES;
}