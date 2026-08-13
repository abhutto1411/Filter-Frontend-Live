import { useEffect, useRef, useCallback } from 'react';
import {
    ACTIVITY_THROTTLE_MS,
    IDLE_TIMEOUT_MS,
    LAST_ACTIVITY_KEY,
    touchLastActivityTimestamp,
    USER_ACTIVITY_EVENT,
    clearLastActivityTimestamp,
} from '../utils/sessionIdle';

/**
 * Logs the user out after {@link IDLE_TIMEOUT_MS} with no activity.
 * Activity resets the timer; timestamps sync across browser tabs.
 */
export function useIdleLogout({ enabled, onIdle }) {
    const timerRef = useRef(null);
    const lastPingRef = useRef(0);
    const onIdleRef = useRef(onIdle);
    const scheduleLogoutRef = useRef(null);
    onIdleRef.current = onIdle;

    const clearTimer = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const scheduleLogout = useCallback(() => {
        clearTimer();
        if (!enabled) return;

        let lastActivity = Date.now();
        try {
            const stored = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || 0);
            if (stored > 0) lastActivity = stored;
        } catch {
            // ignore
        }

        const remaining = Math.max(0, IDLE_TIMEOUT_MS - (Date.now() - lastActivity));

        timerRef.current = setTimeout(() => {
            let latest = 0;
            try {
                latest = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || 0);
            } catch {
                // ignore
            }

            if (Date.now() - latest >= IDLE_TIMEOUT_MS) {
                onIdleRef.current?.();
            } else {
                scheduleLogoutRef.current?.();
            }
        }, remaining);
    }, [enabled, clearTimer]);

    useEffect(() => {
        scheduleLogoutRef.current = scheduleLogout;
    }, [scheduleLogout]);

    const recordActivity = useCallback(() => {
        if (!enabled) return;

        const now = Date.now();
        if (now - lastPingRef.current < ACTIVITY_THROTTLE_MS) return;
        lastPingRef.current = now;

        touchLastActivityTimestamp();
        scheduleLogout();
    }, [enabled, scheduleLogout]);

    useEffect(() => {
        if (!enabled) {
            clearTimer();
            clearLastActivityTimestamp();
            return undefined;
        }

        touchLastActivityTimestamp();
        scheduleLogout();

        const domEvents = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click', 'mousemove'];
        domEvents.forEach((ev) => {
            window.addEventListener(ev, recordActivity, { passive: true });
        });

        const onVisibility = () => {
            if (document.visibilityState === 'visible') {
                scheduleLogout();
            }
        };
        document.addEventListener('visibilitychange', onVisibility);

        const onStorage = (e) => {
            if (e.key === LAST_ACTIVITY_KEY && e.newValue) {
                scheduleLogout();
            }
        };
        window.addEventListener('storage', onStorage);

        const onApiActivity = () => recordActivity();
        window.addEventListener(USER_ACTIVITY_EVENT, onApiActivity);

        return () => {
            clearTimer();
            domEvents.forEach((ev) => {
                window.removeEventListener(ev, recordActivity);
            });
            document.removeEventListener('visibilitychange', onVisibility);
            window.removeEventListener('storage', onStorage);
            window.removeEventListener(USER_ACTIVITY_EVENT, onApiActivity);
        };
    }, [enabled, recordActivity, scheduleLogout, clearTimer]);

    return null;
}
