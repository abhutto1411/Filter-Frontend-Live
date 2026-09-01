/** 30 minutes of no user/API activity → auto logout */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export const LAST_ACTIVITY_KEY = 'filter_last_activity';

export const USER_ACTIVITY_EVENT = 'filter-user-activity';

export const ACTIVITY_THROTTLE_MS = 2000;

export function touchLastActivityTimestamp() {
    if (typeof localStorage === 'undefined') return;
    try {
        localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    } catch {
        // private browsing / quota
    }
}

export function clearLastActivityTimestamp() {
    if (typeof localStorage === 'undefined') return;
    try {
        localStorage.removeItem(LAST_ACTIVITY_KEY);
    } catch {
        // ignore
    }
}

export function notifyUserActivity() {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(USER_ACTIVITY_EVENT));
}
