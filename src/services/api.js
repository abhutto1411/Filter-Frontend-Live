// staging url
//export const BASE_URL = 'https://filterbackend-production.up.railway.app';
// staging url (production default when VITE_API_BASE_URL is unset)
//export const BASE_URL  = 'https://filterbackend-production.up.railway.app';

// production url
export const BASE_URL  = 'https://api.filtercarservices.com';

// development url
//export const BASE_URL = 'http://localhost:3000';


const API_LOADING_EVENT = 'filter-api-loading';

/** Device UTC offset in minutes (e.g. 300 Pakistan, 240 UAE) for cashier order timestamps. */
export function clientUtcOffsetMinutes() {
  return -new Date().getTimezoneOffset();
}

let activeApiRequests = 0;

function notifyApiLoading() {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent(API_LOADING_EVENT, {
      detail: {
        pending: activeApiRequests,
        loading: activeApiRequests > 0,
      },
    })
  );
}

export function getAuthToken() {
  if (typeof localStorage === "undefined") return "";

  return (
    localStorage.getItem("filter_auth_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("adminToken") ||
    ""
  );
}

export function clearAuthSession() {
  if (typeof localStorage === "undefined") return;

  localStorage.removeItem("filter_auth_token");
  localStorage.removeItem("filter_auth_user");
  localStorage.removeItem("filter_auth_workshop");
  localStorage.removeItem("token");
  localStorage.removeItem("accessToken");
  localStorage.removeItem("access_token");
  localStorage.removeItem("adminToken");
}

function buildUrl(path) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_URL}${normalized}`;
}

function shouldRedirectToLogin() {
  if (typeof window === "undefined") return false;

  const pathname = window.location.pathname.toLowerCase();

  return !(
    pathname.includes("login") ||
    pathname.includes("signin") ||
    pathname === "/"
  );
}

function getErrorMessage(errorBody, status, statusText, method, path) {
  const rawMessage = errorBody?.message;

  if (Array.isArray(rawMessage)) {
    const message = rawMessage.filter(Boolean).map(String).join(" ");
    if (message.trim()) return message;
  }

  if (typeof rawMessage === "string" && rawMessage.trim()) {
    return rawMessage.trim();
  }

  if (typeof errorBody?.error === "string" && errorBody.error.trim()) {
    return errorBody.error.trim();
  }

  return `Request failed: ${status} ${statusText} (${method} ${path})`;
}

/**
 * Central secure API client.
 * - Uses VITE_API_BASE_URL
 * - Adds Bearer token automatically
 * - Supports JSON and FormData
 * - Handles 401 globally
 */
export async function apiFetch(path, options = {}) {
  activeApiRequests += 1;
  notifyApiLoading();

  const method = options.method || "GET";
  const token = getAuthToken();
  const customHeaders = options.headers || {};
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  const headers = {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token.trim()}` } : {}),
    ...(!isFormData ? { "Content-Type": "application/json" } : {}),
    ...customHeaders,
  };

  const url = buildUrl(path);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const contentType = response.headers.get("content-type") || "";

    const responseBody = contentType.includes("application/json")
      ? await response.json().catch(() => null)
      : await response.text().catch(() => "");

    if (!response.ok) {
      if (response.status === 401) {
        clearAuthSession();

        if (shouldRedirectToLogin()) {
          window.location.replace("/signin");
        }
      }

      const detail = {
        path,
        method,
        status: response.status,
        statusText: response.statusText,
        response: responseBody,
        requestBody:
          options.body instanceof FormData
            ? "[FormData]"
            : options.body
              ? safeJsonParse(options.body)
              : undefined,
      };

      console.error("[apiFetch] Request failed", detail);

      throw new Error(
        getErrorMessage(
          responseBody,
          response.status,
          response.statusText,
          method,
          path
        )
      );
    }

    return responseBody;
  } finally {
    activeApiRequests = Math.max(0, activeApiRequests - 1);
    notifyApiLoading();
  }
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export default apiFetch;
