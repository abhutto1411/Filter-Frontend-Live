import { lazy } from 'react';

export const CHUNK_RELOAD_KEY = 'filter_chunk_reload';

export class ChunkLoadError extends Error {
    constructor(message, options) {
        super(message, options);
        this.name = 'ChunkLoadError';
    }
}

/** True when a lazy route chunk 404s after a new deployment (hash mismatch). */
export function isChunkLoadError(error) {
    if (error?.name === 'ChunkLoadError') return true;
    const msg = String(error?.message || error || '');
    return (
        msg.includes('Failed to fetch dynamically imported module')
        || msg.includes('Importing a module script failed')
        || msg.includes('error loading dynamically imported module')
        || msg.includes('Loading chunk')
        || msg.includes('Loading CSS chunk')
        || msg.includes('ChunkLoadError')
        || msg.includes("Unexpected token '<'")
        || msg.includes('not a valid JavaScript MIME type')
        || msg.includes('module script but the server responded with a MIME type')
    );
}

/** Vite HMR / incomplete edit: module evaluated with no `export default`. */
export function isMissingDefaultExportError(error) {
    const msg = String(error?.message || error || '');
    return (
        /does not provide an export named ['"]default['"]/.test(msg)
        || /does not provide an export named/.test(msg)
        || /reading ['"]default['"]/.test(msg)
        || msg.includes('lazyPage:')
    );
}

export function isLazyPageLoadError(error) {
    return isChunkLoadError(error) || isMissingDefaultExportError(error);
}

export function clearChunkReloadKey() {
    try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
            window.sessionStorage.removeItem(CHUNK_RELOAD_KEY);
        }
    } catch {
        /* ignore */
    }
}

/**
 * Reload once when a code-split chunk is missing (typical after deploy).
 * Loop-safe: a second call in the same tab clears the flag and returns false.
 */
export function reloadOnceForStaleChunk() {
    if (typeof window === 'undefined' || !window.sessionStorage) return false;
    const reloaded = window.sessionStorage.getItem(CHUNK_RELOAD_KEY);
    if (reloaded) {
        window.sessionStorage.removeItem(CHUNK_RELOAD_KEY);
        return false;
    }
    window.sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
    window.location.reload();
    return true;
}

export function inferLazyImportPath(importer) {
    const src = String(importer || '');
    const m = src.match(/import\(\s*['"]([^'"]+)['"]\s*\)/);
    return m ? m[1] : 'module';
}

export function resolveLazyPageModule(mod, { file = 'module', namedExport } = {}) {
    const page =
        mod?.default
        ?? (namedExport ? mod?.[namedExport] : undefined);
    if (typeof page === 'function' || (page && typeof page === 'object')) {
        return { ...mod, default: page };
    }
    const keys =
        mod && typeof mod === 'object'
            ? Object.keys(mod).filter((k) => k !== '__esModule')
            : [];
    const namedHint = namedExport ? ` (also missing ${namedExport})` : '';
    const exportHint = keys.length ? ` (exports: ${keys.join(', ')})` : '';
    throw new Error(`lazyPage: ${file} has no default export${namedHint}${exportHint}`);
}

function throwChunkLoadError(file, cause) {
    const message = `Failed to load page module ${file}: ${cause?.message || cause}`;
    throw new ChunkLoadError(message, { cause });
}

export async function importPageModule(importer, opts = {}) {
    const file = opts.file || inferLazyImportPath(importer);
    const namedExport = opts.namedExport;
    const retry = opts.retry !== false;
    const attempt = async () => {
        const mod = await importer();
        const resolved = resolveLazyPageModule(mod, { file, namedExport });
        clearChunkReloadKey();
        return resolved;
    };
    try {
        return await attempt();
    } catch (err) {
        if (!retry) throw err;
        try {
            return await attempt();
        } catch (err2) {
            if (isChunkLoadError(err2)) {
                const startedReload = reloadOnceForStaleChunk();
                if (!startedReload) {
                    clearChunkReloadKey();
                }
                // Never return a hanging Promise — throw so the error boundary can render.
                throwChunkLoadError(file, err2);
            }
            throw err2;
        }
    }
}

/**
 * React.lazy wrapper: default export, optional named fallback, one retry,
 * one guarded full reload on a stale deploy chunk (no loop).
 */
export function lazyPage(importer, namedExport) {
    const file = inferLazyImportPath(importer);
    return lazy(() => importPageModule(importer, { namedExport, file }));
}

/** Alias kept so Vite Fast Refresh cannot leave `lazyWithRetry` undefined after a rename. */
export { lazyPage as lazyWithRetry };
