/** Shared date/time formatting for platform chat (WhatsApp-style). */

export function formatTime(iso) {
    if (!iso) return '';
    try {
        return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '';
    }
}

export function formatDateSeparator(iso) {
    if (!iso) return '';
    try {
        const d = new Date(iso);
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        if (d.toDateString() === now.toDateString()) return 'Today';
        if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
        return d.toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'long',
            year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
        });
    } catch {
        return '';
    }
}

/** Full date + time for message bubbles and chat list previews. */
export function formatMessageDateTime(iso) {
    if (!iso) return '';
    try {
        const d = new Date(iso);
        const now = new Date();
        const time = formatTime(iso);
        if (d.toDateString() === now.toDateString()) return `Today, ${time}`;
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
        const date = d.toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'short',
            year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
        });
        return `${date}, ${time}`;
    } catch {
        return '';
    }
}

/** Sidebar conversation row — always includes date and time. */
export function formatListDateTime(iso) {
    return formatMessageDateTime(iso);
}

/** Transaction / wallet cards — explicit weekday + date + time. */
export function formatCardDateTime(iso) {
    if (!iso) return '';
    try {
        const d = new Date(iso);
        const now = new Date();
        const date = d.toLocaleDateString(undefined, {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
        });
        return `${date} · ${formatTime(iso)}`;
    } catch {
        return '';
    }
}

export function getDateKey(iso) {
    if (!iso) return '';
    try {
        return new Date(iso).toDateString();
    } catch {
        return '';
    }
}
