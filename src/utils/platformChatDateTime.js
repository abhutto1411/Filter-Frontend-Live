/** Shared date/time formatting for platform chat (WhatsApp-style). */
import { pcT } from './platformChatI18n';

function localeTag(locale) {
    return locale === 'ar' ? 'ar-SA' : undefined;
}

export function formatTime(iso, locale = 'en') {
    if (!iso) return '';
    try {
        return new Date(iso).toLocaleTimeString(localeTag(locale), { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '';
    }
}

export function formatDateSeparator(iso, locale = 'en') {
    if (!iso) return '';
    try {
        const d = new Date(iso);
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        if (d.toDateString() === now.toDateString()) return pcT(locale, 'date.today');
        if (d.toDateString() === yesterday.toDateString()) return pcT(locale, 'date.yesterday');
        return d.toLocaleDateString(localeTag(locale), {
            day: 'numeric',
            month: 'long',
            year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
        });
    } catch {
        return '';
    }
}

/** Full date + time for message bubbles and chat list previews. */
export function formatMessageDateTime(iso, locale = 'en') {
    if (!iso) return '';
    try {
        const d = new Date(iso);
        const now = new Date();
        const time = formatTime(iso, locale);
        if (d.toDateString() === now.toDateString()) return pcT(locale, 'date.todayTime', { time });
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        if (d.toDateString() === yesterday.toDateString()) return pcT(locale, 'date.yesterdayTime', { time });
        const date = d.toLocaleDateString(localeTag(locale), {
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
export function formatListDateTime(iso, locale = 'en') {
    return formatMessageDateTime(iso, locale);
}

/** Transaction / wallet cards — explicit weekday + date + time. */
export function formatCardDateTime(iso, locale = 'en') {
    if (!iso) return '';
    try {
        const d = new Date(iso);
        const now = new Date();
        const date = d.toLocaleDateString(localeTag(locale), {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
        });
        return `${date} · ${formatTime(iso, locale)}`;
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
