export const ALL_CUSTOMERS_BASE = '/admin/customers/all-customers';

/** @returns {{ screen: string, id?: string } | null} */
export function parseAllCustomersRoute(pathname) {
    if (!pathname.startsWith(ALL_CUSTOMERS_BASE)) return null;
    const rest = pathname.slice(ALL_CUSTOMERS_BASE.length).replace(/^\//, '');
    if (!rest) return null;

    const parts = rest.split('/').filter(Boolean);

    if (parts[0] === 'new') return { screen: 'create' };
    if (parts[1] === 'edit' && parts[0]) {
        return { screen: 'edit', id: decodeURIComponent(parts[0]) };
    }
    if (parts[1] === 'view' && parts[0]) {
        return { screen: 'details', id: decodeURIComponent(parts[0]) };
    }

    return null;
}

export const customersRoutes = {
    create: () => `${ALL_CUSTOMERS_BASE}/new`,
    edit: (id) => `${ALL_CUSTOMERS_BASE}/${encodeURIComponent(id)}/edit`,
    details: (id) => `${ALL_CUSTOMERS_BASE}/${encodeURIComponent(id)}/view`,
};
