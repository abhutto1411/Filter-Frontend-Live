/** Normalize one row from GET /supplier/staff for the Employees UI. */

export const emptyStaffForm = {
    name: '',
    phone: '',
    email: '',
    role: '',
    basicSalary: '0',
    status: 'active',
};

/**
 * Merge PATCH/POST `staff` payload into list-row shape; keeps duty/plate when API omits them.
 */
export function listRowFromApiStaff(apiStaff, prevRow = null) {
    if (!apiStaff && !prevRow) return null;
    const merged = {
        id:
            apiStaff?.id != null
                ? String(apiStaff.id)
                : prevRow?.id != null
                  ? String(prevRow.id)
                  : null,
        name: apiStaff?.name ?? prevRow?.name,
        phone: apiStaff?.phone ?? apiStaff?.mobile ?? prevRow?.phone,
        email: apiStaff?.email ?? prevRow?.email ?? '',
        role: apiStaff?.role ?? prevRow?.role,
        department: apiStaff?.department ?? prevRow?.department ?? null,
        basicSalary:
            apiStaff?.basicSalary != null
                ? String(apiStaff.basicSalary)
                : prevRow?.basicSalary ?? '0',
        status: apiStaff?.status ?? prevRow?.status ?? 'active',
        dutyStatus: apiStaff?.dutyStatus ?? prevRow?.dutyStatus ?? null,
        vehiclePlate: apiStaff?.vehiclePlate ?? prevRow?.vehiclePlate ?? null,
        createdAt: apiStaff?.createdAt ?? prevRow?.createdAt ?? null,
    };
    return mapStaffRow(merged);
}

export function mapStaffRow(r) {
    const rawSalary = r.basicSalary ?? r.basic_salary;
    const salaryStr =
        rawSalary != null && rawSalary !== '' && Number.isFinite(Number(rawSalary))
            ? String(rawSalary)
            : '0';
    return {
        ...r,
        id: r.id ?? r.staffId ?? r.staff_id ?? r.employeeId ?? r.employee_id ?? null,
        name: r.name ?? r.fullName ?? r.full_name ?? r.n ?? '',
        phone: r.phone ?? r.mobile ?? r.m ?? '',
        email: r.email ?? '',
        role: r.role ?? '',
        department: r.department ?? r.dept ?? '',
        basicSalary: salaryStr,
        status: r.status ?? (r.isActive === false ? 'inactive' : 'active'),
        dutyStatus: r.dutyStatus ?? r.duty_status ?? null,
        vehiclePlate: r.vehiclePlate ?? r.vehicle_plate ?? null,
        createdAt: r.createdAt ?? r.created_at ?? null,
    };
}

/** ISO string → short local date/time for Staff table */
export function formatStaffCreatedAt(iso) {
    if (iso == null || String(iso).trim() === '') return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/** Maps employee role label → KPI bucket id (warehouse | order | driver | accountant | supervisor | other). */
export function roleKpiBucket(role) {
    const r = String(role || '')
        .trim()
        .toLowerCase();
    if (/(warehouse|incharge)/.test(r)) return 'warehouse';
    if (/order\s*processor/.test(r)) return 'order';
    if (/driver/.test(r)) return 'driver';
    if (/(accountant|accounting|finance)/.test(r)) return 'accountant';
    if (/supervisor/.test(r)) return 'supervisor';
    return 'other';
}

export function computeStaffRoleKpis(rows) {
    const counts = {
        warehouse: 0,
        order: 0,
        driver: 0,
        accountant: 0,
        supervisor: 0,
    };
    for (const row of rows || []) {
        const k = roleKpiBucket(row.role);
        if (k in counts) counts[k] += 1;
    }
    return counts;
}

export function staffAvailabilityUi(row) {
    if (row.status === 'inactive') {
        return { label: '—', tone: 'muted' };
    }
    const d = row.dutyStatus || row.duty_status;
    if (d === 'busy') return { label: 'Busy', tone: 'amber' };
    if (d === 'offline') return { label: 'Offline', tone: 'gray' };
    return { label: 'Available', tone: 'green' };
}

/** Visual variant for role pill (matches KPI palette). */
export function roleVisualVariant(role) {
    const k = roleKpiBucket(role);
    if (k === 'warehouse') return 'purple';
    if (k === 'order') return 'blue';
    if (k === 'driver') return 'orange';
    if (k === 'accountant') return 'green';
    if (k === 'supervisor') return 'slate';
    return 'slate';
}
