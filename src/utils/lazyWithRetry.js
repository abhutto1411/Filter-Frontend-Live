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
        // A stale chunk doesn't always 404 cleanly. When the SPA fallback serves
        // index.html for a removed *.js chunk, the import can resolve to an empty/
        // undefined module — React.lazy then throws while reading `.default`, or
        // the HTML gets parsed as a module (wrong MIME / "Unexpected token '<'").
        // These are thrown during render, so lazyWithRetry's import-catch never
        // sees them; the AppErrorBoundary uses this same check to recover.
        || msg.includes("reading 'default'")
        || msg.includes("Unexpected token '<'")
        || msg.includes('not a valid JavaScript MIME type')
        || msg.includes('module script but the server responded with a MIME type')
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
