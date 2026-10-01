export const EMPLOYEES_BASE = '/admin/employees';

/** @returns {{ screen: string, id?: string } | null} */
export function parseEmployeesRoute(pathname) {
    if (!pathname.startsWith(EMPLOYEES_BASE)) return null;
    const rest = pathname.slice(EMPLOYEES_BASE.length).replace(/^\//, '');
    if (!rest) return null;

    const parts = rest.split('/').filter(Boolean);

    if (parts[0] === 'new') return { screen: 'create' };
    if (parts[1] === 'edit' && parts[0]) {
        return { screen: 'edit', id: decodeURIComponent(parts[0]) };
    }

    return null;
}

export const employeesRoutes = {
    create: () => `${EMPLOYEES_BASE}/new`,
    edit: (id) => `${EMPLOYEES_BASE}/${encodeURIComponent(id)}/edit`,
};
