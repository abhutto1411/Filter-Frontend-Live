export const BRANCHES_BASE = '/admin/branches';

/** @returns {{ screen: string, id?: string } | null} */
export function parseBranchesRoute(pathname) {
    if (!pathname.startsWith(BRANCHES_BASE)) return null;
    const rest = pathname.slice(BRANCHES_BASE.length).replace(/^\//, '');
    if (!rest) return null;

    const parts = rest.split('/').filter(Boolean);

    if (parts[0] === 'new') return { screen: 'create' };
    if (parts[1] === 'edit' && parts[0]) {
        return { screen: 'edit', id: decodeURIComponent(parts[0]) };
    }

    return null;
}

export const branchesRoutes = {
    create: () => `${BRANCHES_BASE}/new`,
    edit: (id) => `${BRANCHES_BASE}/${encodeURIComponent(id)}/edit`,
};
