export function todayIsoDate() {
    return new Date().toISOString().slice(0, 10);
}

export function daysAgoIsoDate(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
}

export function defaultHistoryDateRange() {
    return { from: daysAgoIsoDate(30), to: todayIsoDate() };
}

export function buildLockerFilterQuery(filters, extra = {}) {
    const q = { ...extra };
    if (filters.from) q.from = filters.from;
    if (filters.to) q.to = filters.to;
    if (filters.branchId && filters.branchId !== 'all') q.branchId = filters.branchId;
    if (filters.cashierId && filters.cashierId !== 'all') q.cashierUserId = filters.cashierId;
    if (filters.officerId && filters.officerId !== 'all') q.officerUserId = filters.officerId;
    if (filters.minExpected !== '' && filters.minExpected != null) {
        q.minExpected = Number(filters.minExpected);
    }
    if (filters.maxExpected !== '' && filters.maxExpected != null) {
        q.maxExpected = Number(filters.maxExpected);
    }
    return q;
}

export const fmtSar = (n) =>
    `SAR ${Number(n || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

export const fmtSarWhole = (n) =>
    `SAR ${Number(n || 0).toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    })}`;
