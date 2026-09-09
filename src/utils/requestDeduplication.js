/**
 * Request deduplication service
 * Prevents duplicate API calls for identical requests
 * Caches in-flight requests and returns the same promise
 */

const pendingRequests = new Map();

/**
 * Generate cache key from path and options
 */
function getCacheKey(path, options = {}) {
    const method = options.method || 'GET';
    const body = options.body ? JSON.stringify(options.body) : '';
    return `${method}:${path}:${body}`;
}

/**
 * Wrap an API call with deduplication
 * If the same request is in-flight, return the existing promise
 * Otherwise, make the request and cache it
 */
export function withDeduplication(path, apiFetchFn, options = {}) {
    const key = getCacheKey(path, options);

    // Return cached promise if request is still in-flight
    if (pendingRequests.has(key)) {
        return pendingRequests.get(key);
    }

    // Make the request and cache the promise
    const promise = apiFetchFn(path, options)
        .then((result) => {
            // Remove from cache on success
            pendingRequests.delete(key);
            return result;
        })
        .catch((error) => {
            // Remove from cache on error
            pendingRequests.delete(key);
            throw error;
        });

    pendingRequests.set(key, promise);
    return promise;
}

/**
 * Clear all pending requests (useful for testing or force refresh)
 */
export function clearPendingRequests() {
    pendingRequests.clear();
}

/**
 * Clear specific pending request
 */
export function clearPendingRequest(path, options = {}) {
    const key = getCacheKey(path, options);
    pendingRequests.delete(key);
}

/**
 * Get count of pending requests (for debugging)
 */
export function getPendingRequestCount() {
    return pendingRequests.size;
}
