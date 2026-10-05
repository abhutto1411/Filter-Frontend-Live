export const WORKSHOP_BASE = '/admin/workshop';

/** @returns {{ screen: string, id?: string } | null} */
export function parseWorkshopRoute(pathname) {
    if (!pathname.startsWith(WORKSHOP_BASE)) return null;
    const rest = pathname.slice(WORKSHOP_BASE.length).replace(/^\//, '');
    if (!rest) return null;

    const parts = rest.split('/').filter(Boolean);

    if (parts[0] === 'new') return { screen: 'create' };
    if (parts[0] === 'whatsapp-template') return { screen: 'whatsapp-template' };
    if (parts[1] === 'edit' && parts[0]) {
        return { screen: 'edit', id: decodeURIComponent(parts[0]) };
    }
    if (parts[1] === 'view' && parts[0]) {
        return { screen: 'view', id: decodeURIComponent(parts[0]) };
    }

    return null;
}

export const workshopRoutes = {
    create: () => `${WORKSHOP_BASE}/new`,
    edit: (id) => `${WORKSHOP_BASE}/${encodeURIComponent(id)}/edit`,
    view: (id) => `${WORKSHOP_BASE}/${encodeURIComponent(id)}/view`,
    whatsappTemplate: () => `${WORKSHOP_BASE}/whatsapp-template`,
};
