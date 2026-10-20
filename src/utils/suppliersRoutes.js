export const SUPPLIERS_BASE = '/admin/suppliers';

/** @returns {{ screen: string, id?: string } | null} */
export function parseSuppliersRoute(pathname) {
    if (!pathname.startsWith(SUPPLIERS_BASE)) return null;
    const rest = pathname.slice(SUPPLIERS_BASE.length).replace(/^\//, '');
    if (!rest) return null;

    if (rest === 'new') return { screen: 'create' };

    const parts = rest.split('/').filter(Boolean);
    if (parts[1] === 'edit' && parts[0]) {
        return { screen: 'edit', id: decodeURIComponent(parts[0]) };
    }

    return null;
}

export const suppliersRoutes = {
    list: () => SUPPLIERS_BASE,
    create: () => `${SUPPLIERS_BASE}/new`,
    edit: (id) => `${SUPPLIERS_BASE}/${encodeURIComponent(id)}/edit`,
};
