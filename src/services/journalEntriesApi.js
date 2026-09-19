import { apiFetch } from './api';

const parseArr = (res) => {
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.data)) return res.data;
    if (res && Array.isArray(res.list)) return res.list;
    if (res && Array.isArray(res.entries)) return res.entries;
    if (res && Array.isArray(res.items)) return res.items;
    if (res && typeof res === 'object') {
        return Object.values(res).filter(
            (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && v.id,
        );
    }
    return [];
};

void parseArr;

function withQuery(path, params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            query.set(key, String(value));
        }
    });
    const qs = query.toString();
    return qs ? `${path}?${qs}` : path;
}

export const getStats = () => apiFetch('/journal-entries/stats');

export const getJournalEntries = (params = {}) =>
    apiFetch(withQuery('/journal-entries', params));

export const getJournalEntryById = (id) =>
    apiFetch(`/journal-entries/${encodeURIComponent(id)}`);

export const createJournalEntry = (body) =>
    apiFetch('/journal-entries', { method: 'POST', body: JSON.stringify(body) });

export const deleteJournalEntry = (id) =>
    apiFetch(`/journal-entries/${encodeURIComponent(id)}`, { method: 'DELETE' });
