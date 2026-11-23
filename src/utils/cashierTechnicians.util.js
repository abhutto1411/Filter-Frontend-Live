/** Unwrap GET /cashier/technicians list payloads — always returns an array. */
export function unwrapCashierTechniciansResponse(res) {
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.technicians)) return res.technicians;
    if (Array.isArray(res?.data)) return res.data;
    return [];
}

function firstInt(obj, keys) {
    if (!obj || typeof obj !== 'object') return 0;
    for (const key of keys) {
        const v = obj[key];
        if (typeof v === 'number' && Number.isFinite(v)) return v;
        if (typeof v === 'string' && v.trim() !== '') {
            const n = Number(v);
            if (Number.isFinite(n)) return n;
        }
    }
    return 0;
}

/** Match backend: onlineStatus, assignmentStatus, technicianStatus.status, legacy status. */
export function parseTechnicianStatus(t) {
    const s =
        t?.technicianStatus?.status ??
        t?.status?.status ??
        t?.onlineStatus ??
        t?.assignmentStatus ??
        t?.status;
    if (typeof s !== 'string') return 'offline';
    const lower = s.toLowerCase();
    if (lower === 'offline') return 'offline';
    if (lower === 'busy' || lower === 'on_call' || lower === 'inactive') return lower;
    // available / online / active → treat as on-duty for POS UI
    return 'online';
}

export function parseTechnicianSlotsUsed(t) {
    const fromSlots = firstInt(t?.slots, ['used', 'active']);
    if (fromSlots > 0) return fromSlots;
    const direct = firstInt(t, ['slotsUsed', 'usedSlots', 'activeSlots']);
    if (direct > 0) return direct;
    return 0;
}

export function parseTechnicianTotalSlots(t) {
    const fromSlots = firstInt(t?.slots, ['total', 'max', 'capacity', 'limit', 'maxSlots']);
    if (fromSlots > 0) return fromSlots;
    const direct = firstInt(t, ['totalSlots', 'maxSlots']);
    if (direct > 0) return direct;
    return 3;
}

export function formatTechnicianDepartments(t) {
    if (t?.departmentName) return t.departmentName;
    if (t?.department?.name) return t.department.name;
    if (Array.isArray(t?.departments) && t.departments.length > 0) {
        const names = t.departments.map((d) => d?.name).filter(Boolean);
        if (names.length) return names.join(', ');
    }
    return 'General Workshop';
}

/** Normalize one cashier technician row for POS components. */
export function normalizeCashierTechnicianRow(t) {
    const empId = t?.employeeId ?? t?.id ?? t?.userId ?? '';
    const name = t?.employeeName || t?.name || t?.fullName || 'Technician';
    const status = parseTechnicianStatus(t);
    const usedSlots = parseTechnicianSlotsUsed(t);
    const totalSlots = parseTechnicianTotalSlots(t);
    const commission =
        t?.commissionPercentage ??
        t?.commissionPercent ??
        t?.commission ??
        0;

    return {
        ...t,
        id: empId,
        employeeId: empId,
        name,
        employeeName: name,
        status,
        onlineStatus: t?.onlineStatus ?? (status === 'offline' ? 'offline' : 'online'),
        usedSlots,
        totalSlots,
        commission,
        commissionPercent: commission,
        departmentName: formatTechnicianDepartments(t),
    };
}

export function normalizeCashierTechniciansList(list) {
    return (list ?? []).map(normalizeCashierTechnicianRow);
}
