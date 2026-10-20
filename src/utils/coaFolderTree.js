/** Folder COA: one node per id/code, children only under their parent. */

function corporateArTag(row) {
    const m = /(?:^|\b)corporate-ar:(\d+)(?!\d)/i.exec(String(row?.description || ''));
    return m ? m[1] : '';
}

function mergeCoaNumeric(keep, extra, key) {
    return (Number(keep?.[key]) || 0) + (Number(extra?.[key]) || 0);
}

function mergeCoaRow(prev, row) {
    const mergedBalances = {
        closingDebit: mergeCoaNumeric(prev, row, 'closingDebit'),
        closingCredit: mergeCoaNumeric(prev, row, 'closingCredit'),
    };
    const prevParent = prev.parentId != null && String(prev.parentId) !== '';
    const nextParent = row.parentId != null && String(row.parentId) !== '';
    if (nextParent && !prevParent) return { ...row, ...mergedBalances };
    if (!nextParent && prevParent) return { ...prev, ...mergedBalances };
    if (Number(row.id) < Number(prev.id)) return { ...row, ...mergedBalances };
    return { ...prev, ...mergedBalances };
}

export function dedupeCoaFlatList(accounts = []) {
    const byId = new Map();
    for (const row of accounts) {
        const id = String(row?.id ?? '').trim();
        if (!id) continue;
        if (byId.has(id)) {
            byId.set(id, mergeCoaRow(byId.get(id), row));
            continue;
        }
        byId.set(id, row);
    }

    const byCode = new Map();
    for (const row of byId.values()) {
        const code = String(row.code || '').trim();
        const key = code || `id:${row.id}`;
        const prev = byCode.get(key);
        if (!prev) {
            byCode.set(key, row);
            continue;
        }
        byCode.set(key, mergeCoaRow(prev, row));
    }

    const byTag = new Map();
    const untagged = [];
    for (const row of byCode.values()) {
        const tag = corporateArTag(row);
        if (!tag) {
            untagged.push(row);
            continue;
        }
        const prev = byTag.get(tag);
        if (!prev) {
            byTag.set(tag, row);
            continue;
        }
        byTag.set(tag, mergeCoaRow(prev, row));
    }
    return [...untagged, ...byTag.values()];
}

function sortCoaNodes(nodes = []) {
    nodes.sort((a, b) =>
        String(a.code || '').localeCompare(String(b.code || ''), undefined, { numeric: true }),
    );
    for (const node of nodes) sortCoaNodes(node.children || []);
}

export function buildCoaTreeFromFlat(accounts = []) {
    const list = dedupeCoaFlatList(accounts);
    const byId = new Map();
    for (const row of list) {
        byId.set(String(row.id), { ...row, children: [] });
    }

    for (const row of list) {
        const node = byId.get(String(row.id));
        const pid = row.parentId != null && String(row.parentId) !== ''
            ? String(row.parentId)
            : '';
        if (!pid || pid === String(row.id) || !byId.has(pid)) continue;
        const parent = byId.get(pid);
        if (parent.children.some((child) => String(child.id) === String(node.id))) continue;
        node.parentCode = parent.code;
        parent.children.push(node);
        parent.hasChildren = true;
        parent.isHeading = true;
    }

    const roots = [];
    for (const row of list) {
        const node = byId.get(String(row.id));
        const pid = row.parentId != null && String(row.parentId) !== ''
            ? String(row.parentId)
            : '';
        const attached = Boolean(pid && byId.has(pid) && pid !== String(row.id));
        if (!attached) roots.push(node);
    }

    sortCoaNodes(roots);
    return roots;
}

export function filterCoaTreeForSearch(nodes = [], q = '') {
    const needle = String(q || '').trim().toLowerCase();
    if (!needle) return nodes;
    return nodes
        .map((node) => {
            const children = filterCoaTreeForSearch(node.children || [], needle);
            const hay = `${node.code || ''} ${node.name || ''} ${node.description || ''}`.toLowerCase();
            if (hay.includes(needle) || children.length) {
                return { ...node, children };
            }
            return null;
        })
        .filter(Boolean);
}

export function flattenVisibleCoaTree(
    nodes = [],
    expandedIds = new Set(),
    forceExpand = false,
    depth = 0,
    acc = [],
    seenIds = new Set(),
) {
    for (const node of nodes) {
        const id = String(node.id);
        if (seenIds.has(id)) continue;
        seenIds.add(id);
        const children = Array.isArray(node.children) ? node.children : [];
        const hasChildren = children.length > 0;
        acc.push({ ...node, _depth: depth, _hasChildren: hasChildren });
        if (hasChildren && (forceExpand || expandedIds.has(id))) {
            flattenVisibleCoaTree(children, expandedIds, forceExpand, depth + 1, acc, seenIds);
        }
    }
    return acc;
}

export function collectExpandableCoaIds(nodes = [], acc = []) {
    for (const node of nodes) {
        const children = node.children || [];
        if (children.length) {
            acc.push(String(node.id));
            collectExpandableCoaIds(children, acc);
        }
    }
    return acc;
}
