/**
 * Pure helpers for the Chart of Accounts tree (mockup 03).
 * No React / API imports so they can be unit-tested with `node --test`.
 */

/** Page size for the single COA table. */
export const COA_PAGE_SIZE = 25;

/** Status filter value → "" means All. */
export const COA_DEFAULT_STATUS = 'active';

/** Heading = has children (folder / non-postable). Leaf = postable account. */
export function isCoaHeadingRow(row) {
  if (!row) return false;
  return Boolean(row.isHeading || row.hasChildren || row._hasChildren);
}

/** 'heading' | 'leaf' — drives the Kind badge. */
export function coaRowKind(row) {
  return isCoaHeadingRow(row) ? 'heading' : 'leaf';
}

/** Search by account code or name (case-insensitive). Keeps ancestors of matches. */
export function filterTreeForSearch(nodes = [], q = '') {
  const needle = String(q || '').trim().toLowerCase();
  if (!needle) return nodes;
  return (nodes || [])
    .map((node) => {
      const children = filterTreeForSearch(node.children || [], needle);
      const hay = `${node.code || ''} ${node.name || ''}`.toLowerCase();
      if (hay.includes(needle) || children.length) {
        return { ...node, children };
      }
      return null;
    })
    .filter(Boolean);
}

/**
 * Keep nodes whose own type/status match, plus ancestors of any kept descendant.
 * `byId` is the flat account map (carries `status`; tree rows often lack it).
 * Empty `type` / `status` mean "All".
 */
export function filterTreeByTypeStatus(
  nodes = [],
  { type = '', status = '', byId = new Map() } = {},
) {
  const wantType = String(type || '').toUpperCase();
  const wantStatus = String(status || '').toLowerCase();
  if (!wantType && !wantStatus) return nodes;
  return (nodes || [])
    .map((node) => {
      const children = filterTreeByTypeStatus(node.children || [], {
        type,
        status,
        byId,
      });
      const flat = byId.get(String(node.id)) || {};
      const nodeType = String(flat.type || node.type || '').toUpperCase();
      const nodeStatus = String(flat.status || node.status || 'active').toLowerCase();
      const self =
        (!wantType || nodeType === wantType) && (!wantStatus || nodeStatus === wantStatus);
      if (self || children.length) {
        return { ...node, children };
      }
      return null;
    })
    .filter(Boolean);
}

/** Depth-first rows; children only when expanded (or `forceExpand`). */
export function flattenVisibleTree(
  nodes = [],
  expandedIds = new Set(),
  forceExpand = false,
  depth = 0,
  acc = [],
) {
  (nodes || []).forEach((node) => {
    const children = Array.isArray(node.children) ? node.children : [];
    const hasChildren = children.length > 0;
    acc.push({ ...node, _depth: depth, _hasChildren: hasChildren });
    if (hasChildren && (forceExpand || expandedIds.has(String(node.id)))) {
      flattenVisibleTree(children, expandedIds, forceExpand, depth + 1, acc);
    }
  });
  return acc;
}

/**
 * Merge a tree row with its flat account (balances, status, type, heading flag).
 * Heading stays a heading even if a filter removed all of its children.
 */
export function mergeCoaRow(row, flat = {}) {
  const heading = Boolean(
    flat.isHeading || flat.hasChildren || row.isHeading || row._hasChildren,
  );
  return {
    ...flat,
    ...row,
    closingDebit: Number(flat.closingDebit ?? row.closingDebit ?? 0),
    closingCredit: Number(flat.closingCredit ?? row.closingCredit ?? 0),
    hasChildren: heading,
    isHeading: heading,
  };
}

/** Flat list of every account in a (filtered) tree, merged with flat data. */
export function collectMergedAccounts(nodes = [], byId = new Map()) {
  return flattenVisibleTree(nodes, new Set(), true).map((row) =>
    mergeCoaRow(row, byId.get(String(row.id)) || {}),
  );
}

/**
 * True when this node itself matches Search / Type / Status
 * (ancestors kept only to show the tree path do not match).
 */
export function accountSelfMatchesFilters(
  node,
  { search = '', type = '', status = '', byId = new Map() } = {},
) {
  if (!node) return false;
  const flat = byId.get(String(node.id)) || {};
  const needle = String(search || '').trim().toLowerCase();
  if (needle) {
    const hay = `${flat.code || node.code || ''} ${flat.name || node.name || ''}`.toLowerCase();
    if (!hay.includes(needle)) return false;
  }
  const wantType = String(type || '').toUpperCase();
  if (wantType) {
    const nodeType = String(flat.type || node.type || '').toUpperCase();
    if (nodeType !== wantType) return false;
  }
  const wantStatus = String(status || '').toLowerCase();
  if (wantStatus) {
    const nodeStatus = String(flat.status || node.status || 'active').toLowerCase();
    if (nodeStatus !== wantStatus) return false;
  }
  return true;
}

/**
 * Accounts that really match the filters (not path-only parent headings).
 * Walk the full tree so counts stay correct for summary cards.
 */
export function collectSelfMatchingAccounts(
  nodes = [],
  { search = '', type = '', status = '', byId = new Map() } = {},
) {
  const out = [];
  const walk = (list) => {
    (list || []).forEach((node) => {
      if (accountSelfMatchesFilters(node, { search, type, status, byId })) {
        out.push(mergeCoaRow(node, byId.get(String(node.id)) || {}));
      }
      if (Array.isArray(node.children) && node.children.length) {
        walk(node.children);
      }
    });
  };
  walk(nodes);
  return out;
}

/** Clamp a page offset so it never points past the last page. */
export function clampPageOffset(offset, total, pageSize = COA_PAGE_SIZE) {
  const size = Math.max(1, Number(pageSize) || COA_PAGE_SIZE);
  const count = Math.max(0, Number(total) || 0);
  if (count === 0) return 0;
  const maxOffset = Math.floor((count - 1) / size) * size;
  return Math.min(Math.max(0, Number(offset) || 0), maxOffset);
}
