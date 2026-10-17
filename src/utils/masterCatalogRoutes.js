export const MASTER_CATALOG_BASE = '/admin/inventory/master-catalog';

/** @returns {{ screen: string, id?: string } | null} */
export function parseMasterCatalogRoute(pathname) {
    if (!pathname.startsWith(MASTER_CATALOG_BASE)) return null;
    const rest = pathname.slice(MASTER_CATALOG_BASE.length).replace(/^\//, '');
    if (!rest) return null;

    const parts = rest.split('/').filter(Boolean);

    if (parts[0] === 'products' && parts[1] === 'new') return { screen: 'product-new' };
    if (parts[0] === 'products' && parts[1] === 'import') return { screen: 'product-import' };
    if (parts[0] === 'products' && parts[2] === 'edit' && parts[1]) {
        return { screen: 'product-edit', id: decodeURIComponent(parts[1]) };
    }

    if (parts[0] === 'services' && parts[1] === 'new') return { screen: 'service-new' };
    if (parts[0] === 'services' && parts[1] === 'import') return { screen: 'service-import' };
    if (parts[0] === 'services' && parts[2] === 'edit' && parts[1]) {
        return { screen: 'service-edit', id: decodeURIComponent(parts[1]) };
    }

    if (parts[0] === 'departments' && parts[1] === 'new') return { screen: 'dept-new' };
    if (parts[0] === 'departments' && parts[2] === 'edit' && parts[1]) {
        return { screen: 'dept-edit', id: decodeURIComponent(parts[1]) };
    }

    if (parts[0] === 'categories' && parts[1] === 'new') return { screen: 'cat-new' };
    if (parts[0] === 'categories' && parts[2] === 'edit' && parts[1]) {
        return { screen: 'cat-edit', id: decodeURIComponent(parts[1]) };
    }

    if (parts[0] === 'requests' && parts[2] === 'approve' && parts[1]) {
        return { screen: 'request-approve', id: decodeURIComponent(parts[1]) };
    }
    if (parts[0] === 'requests' && parts[2] === 'reject' && parts[1]) {
        return { screen: 'request-reject', id: decodeURIComponent(parts[1]) };
    }

    return null;
}

export function masterCatalogListUrl(tabId) {
    if (!tabId) return MASTER_CATALOG_BASE;
    return `${MASTER_CATALOG_BASE}?tab=${encodeURIComponent(tabId)}`;
}

export const mcRoutes = {
    productNew: () => `${MASTER_CATALOG_BASE}/products/new`,
    productImport: () => `${MASTER_CATALOG_BASE}/products/import`,
    productEdit: (id) => `${MASTER_CATALOG_BASE}/products/${encodeURIComponent(id)}/edit`,
    serviceNew: () => `${MASTER_CATALOG_BASE}/services/new`,
    serviceImport: () => `${MASTER_CATALOG_BASE}/services/import`,
    serviceEdit: (id) => `${MASTER_CATALOG_BASE}/services/${encodeURIComponent(id)}/edit`,
    deptNew: () => `${MASTER_CATALOG_BASE}/departments/new`,
    deptEdit: (id) => `${MASTER_CATALOG_BASE}/departments/${encodeURIComponent(id)}/edit`,
    catNew: () => `${MASTER_CATALOG_BASE}/categories/new`,
    catEdit: (id) => `${MASTER_CATALOG_BASE}/categories/${encodeURIComponent(id)}/edit`,
    requestApprove: (id) => `${MASTER_CATALOG_BASE}/requests/${encodeURIComponent(id)}/approve`,
    requestReject: (id) => `${MASTER_CATALOG_BASE}/requests/${encodeURIComponent(id)}/reject`,
};

export function tabForMasterCatalogScreen(screen) {
    if (!screen) return 'master';
    if (screen.startsWith('service')) return 'services';
    if (screen.startsWith('dept')) return 'dept';
    if (screen.startsWith('cat')) return 'category';
    if (screen.startsWith('request')) return 'requests';
    return 'master';
}
