import { apiFetch } from './api';
import { qs } from './workshopStaffApi';

export async function fetchLockerNotifications({ page = 1, limit = 20, unreadOnly = false } = {}) {
    const res = await apiFetch(
        `/locker/get_notifications/${encodeURIComponent(String(page))}/${encodeURIComponent(String(limit))}${qs({
            unreadOnly: unreadOnly ? 'true' : 'false',
        })}`,
    );
    const items = Array.isArray(res?.items)
        ? res.items
        : Array.isArray(res?.notifications)
          ? res.notifications
          : [];
    const unreadCount =
        res?.unreadCount != null && Number.isFinite(Number(res.unreadCount))
            ? Number(res.unreadCount)
            : items.filter((n) => !n.readAt).length;
    return { items, unreadCount, total: res?.total ?? items.length };
}

export function markLockerNotificationRead(id) {
    return apiFetch(`/locker/notifications/${encodeURIComponent(String(id))}/read`, {
        method: 'PATCH',
        body: JSON.stringify({}),
    });
}

export function markAllLockerNotificationsRead() {
    return apiFetch('/locker/notifications/read-all', {
        method: 'POST',
        body: JSON.stringify({}),
    });
}