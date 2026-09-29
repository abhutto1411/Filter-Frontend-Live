/**
 * Simple API response cache with TTL
 * Stores successful API responses for a configurable duration
 * Automatically expires stale entries
 */

class APICache {
    constructor() {
        this.cache = new Map();
    }

    getCacheKey(endpoint, params = {}) {
        const paramStr = Object.keys(params)
            .sort()
            .map((k) => `${k}=${JSON.stringify(params[k])}`)
            .join('&');
        return `${endpoint}:${paramStr}`;
    }

    get(endpoint, params = {}, ttlMs = 5 * 60 * 1000) {
        const key = this.getCacheKey(endpoint, params);
        const cached = this.cache.get(key);

        if (!cached) return null;

        const age = Date.now() - cached.timestamp;
        if (age > ttlMs) {
            this.cache.delete(key);
            return null;
        }

        return cached.data;
    }

    set(endpoint, params = {}, data) {
        const key = this.getCacheKey(endpoint, params);
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
        });
    }

    clear(endpoint = null) {
        if (endpoint) {
            for (const key of this.cache.keys()) {
                if (key.startsWith(`${endpoint}:`)) {
                    this.cache.delete(key);
                }
            }
        } else {
            this.cache.clear();
        }
    }

    getStats() {
        return {
            size: this.cache.size,
            entries: Array.from(this.cache.entries()).map(([key, val]) => ({
                key,
                age: Date.now() - val.timestamp,
            })),
        };
    }
}

export const apiCache = new APICache();

/**
 * Decorator: Cache API response
 * Usage: const data = await cacheableApiCall('/endpoint', params, () => apiFetch(...), ttlMs)
 */
export async function cacheableApiCall(endpoint, params, apiFn, ttlMs = 5 * 60 * 1000) {
    const cached = apiCache.get(endpoint, params, ttlMs);
    if (cached !== null) {
        return cached;
    }

    const data = await apiFn();
    apiCache.set(endpoint, params, data);
    return data;
}
