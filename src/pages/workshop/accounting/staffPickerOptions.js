import { workshopStaffRoleLabel } from '../../../services/workshopStaffApi';

export const staffName = (e) => e?.name || 'Unnamed';

export const staffMeta = (e) =>
    [workshopStaffRoleLabel(e), e?.branch?.name, e?.phone].filter(Boolean).join(' · ');

export const staffSearchText = (e) =>
    [
        e?.name,
        e?.phone,
        e?.email,
        e?.iqama,
        workshopStaffRoleLabel(e),
        String(e?.employeeType || '').replace(/_/g, ' '),
        String(e?.technicianType || '').replace(/_/g, ' '),
        e?.branch?.name,
        ...(e?.departments ?? []).map((d) => d?.name),
    ]
        .filter(Boolean)
        .join(' ');
