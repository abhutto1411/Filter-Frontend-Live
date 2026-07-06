import { lazy } from 'react';

const CHUNK_RELOAD_KEY = 'filter_chunk_reload';

/** True when a lazy route chunk 404s after a new deployment (hash mismatch). */
export function isChunkLoadError(error) {
    const msg = String(error?.message || error || '');
    return (
        msg.includes('Failed to fetch dynamically imported module')
        || msg.includes('Importing a module script failed')
        || msg.includes('error loading dynamically imported module')
        || msg.includes('Loading chunk')
        || msg.includes('Loading CSS chunk')
        || msg.includes('ChunkLoadError')
    );
}

/**
 * Reload once when a code-split chunk is missing (typical after Vercel deploy).
 * Prevents the "Failed to fetch dynamically imported module" crash loop.
 */
export function reloadOnceForStaleChunk() {
    if (typeof window === 'undefined') return false;
    const reloaded = sessionStorage.getItem(CHUNK_RELOAD_KEY);
    if (reloaded) {
        sessionStorage.removeItem(CHUNK_RELOAD_KEY);
        return false;
    }
    sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
    window.location.reload();
    return true;
}

export function lazyWithRetry(importer) {
    return lazy(() =>
        importer().catch((error) => {
            if (isChunkLoadError(error) && reloadOnceForStaleChunk()) {
                return new Promise(() => {});
            }
            throw error;
        }),
    );
}
