import { notifyUserActivity } from './sessionIdle.js';

/**
 * Runs `task` every `intervalMs`, skipping ticks while the tab is hidden. If a tick
 * was skipped, `task` runs once when the tab becomes visible again.
 *
 * Successful polls count as activity for the idle logout. `keepSessionAlive` keeps
 * that true for skipped ticks, so pausing a poll does not log out someone who left
 * the tab in the background. Pass false only for a poll that never ran while hidden.
 *
 * @returns {() => void} Stops the polling.
 */
export function startVisiblePolling(task, intervalMs, { keepSessionAlive = true } = {}) {
    let missedTick = false;

    const id = setInterval(() => {
        if (document.hidden) {
            missedTick = true;
            if (keepSessionAlive) notifyUserActivity();
            return;
        }
        task();
    }, intervalMs);

    const onVisibilityChange = () => {
        if (document.hidden || !missedTick) return;
        missedTick = false;
        task();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
        clearInterval(id);
        document.removeEventListener('visibilitychange', onVisibilityChange);
    };
}
