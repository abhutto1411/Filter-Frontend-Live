import { formatRiyadhSessionStamp } from '../../utils/lockerCitDisplay';

export function rowPreviousAssignee(row) {
    return (
        row?.previousAssigneeName ||
        row?.assignedOfficerName ||
        row?.assignedOfficer?.name ||
        null
    );
}

export function rowPosSessionLabel(row, fallback = '—') {
    const id = row?.posSessionNo ?? row?.posSessionId ?? row?.posSession?.id;
    if (id == null || id === '') return fallback;
    return String(id);
}

export function formatSessionRange(row, stampLang, dash = '—') {
    const open = row?.sessionOpenedAt ?? row?.posSession?.openedAt;
    const close = row?.sessionClosedAt ?? row?.posSession?.closedAt;
    if (!open && !close) return dash;
    const a = open ? formatRiyadhSessionStamp(open, stampLang) : dash;
    const b = close ? formatRiyadhSessionStamp(close, stampLang) : dash;
    return `${a} → ${b}`;
}

export function formatAgeHours(ageHours, t) {
    if (ageHours == null || ageHours === '') return t('emdash');
    const h = Number(ageHours);
    if (!Number.isFinite(h)) return String(ageHours);
    if (h < 1) return t('collectible.ageMinutes', { n: Math.max(1, Math.round(h * 60)) });
    if (h < 48) return t('collectible.ageHours', { n: Math.round(h * 10) / 10 });
    const days = Math.floor(h / 24);
    return t('collectible.ageDays', { n: days });
}

export function rowCountedAmount(row) {
    return row?.countedAmount ?? row?.counterClosing?.physicalCash ?? null;
}