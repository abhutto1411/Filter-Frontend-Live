/**
 * Non-secret API origin resolution.
 * Localhost is allowed only for non-production Vite builds.
 * Deployed/production builds require VITE_API_BASE_URL and must not target localhost.
 * Staging host naming (Railway "production") is not a production identity.
 */

export const DEV_API_ORIGIN = 'http://localhost:3000';

/** Documented origins — never used as silent fallbacks. */
export const DOCUMENTED_API_ORIGINS = {
  staging: 'https://filterbackend-production.up.railway.app',
  production: 'https://api.filtercarservices.com',
};

export function isLocalhostApiOrigin(url) {
  try {
    const host = new URL(String(url)).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
  } catch {
    return false;
  }
}

export function normalizeApiBaseUrl(raw) {
  return String(raw ?? '').trim().replace(/\/+$/, '');
}

/**
 * @param {{ raw?: unknown, prod?: boolean, mode?: string }} env
 * @returns {string} origin with no trailing slash
 */
export function resolveApiBaseUrl(env = {}) {
  const trimmed = normalizeApiBaseUrl(env.raw);
  const mode = String(env.mode ?? '').trim().toLowerCase();
  const isProdBuild = env.prod === true || mode === 'production';

  if (trimmed) {
    let parsed;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new Error(
        'VITE_API_BASE_URL must be a valid absolute URL (http or https).',
      );
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(
        'VITE_API_BASE_URL must use http or https.',
      );
    }
    if (isProdBuild && isLocalhostApiOrigin(trimmed)) {
      throw new Error(
        'Deployed builds must not target localhost. Set VITE_API_BASE_URL to the intended API origin.',
      );
    }
    return trimmed;
  }

  if (isProdBuild) {
    throw new Error(
      'VITE_API_BASE_URL is required for production builds and must not be omitted or empty.',
    );
  }

  return DEV_API_ORIGIN;
}
