import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
    Package, Layers, Tags, Wrench, RefreshCw, ShieldCheck, Search, Plus,
    ChevronLeft, ChevronRight, X, AlertCircle, CheckCircle2, Filter, Gauge, Calendar, Percent,
} from 'lucide-react';
import WorkshopSubScreen from '../../components/workshop/WorkshopSubScreen';
import {
    getCatalogDepartments,
    getCatalogCategories,
    getCatalogProducts,
    getCatalogServices,
    getMyDepartments,
    getMyCategories,
    getMyProducts,
    getMyServices,
    adoptDepartmentsToBranches,
    adoptCategoriesToBranches,
    adoptProductsToBranches,
    adoptServicesToBranches,
    previewProductDeps,
    previewServiceDeps,
} from '../../services/workshopCatalogApi';
import { filterPortalVisibleBranches } from '../../services/workshopStaffApi';
import { wcnT } from '../../utils/workshopCatalogNewI18n';
import { catalogDisplayName } from '../../utils/catalogDisplayName';

const PAGE_SIZE = 50;

/** ISO-8601 from catalog list APIs → short local label for card meta. */
function formatCatalogListCreatedAt(iso, locale) {
    if (iso == null || iso === '') return '';
    const d = new Date(typeof iso === 'string' || typeof iso === 'number' ? iso : String(iso));
    if (Number.isNaN(d.getTime())) return '';
    const loc = locale === 'ar' ? 'ar-SA' : undefined;
    return d.toLocaleString(loc, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

const TABS = [
    { id: 'departments', labelKey: 'tab.departments', Icon: Layers,  permission: 'workshop.catalog.departments.view' },
    { id: 'categories',  labelKey: 'tab.categories',  Icon: Tags,    permission: 'workshop.catalog.categories.view' },
    { id: 'products',    labelKey: 'tab.products',    Icon: Package, permission: 'workshop.catalog.products.view' },
    { id: 'services',    labelKey: 'tab.services',    Icon: Wrench,  permission: 'workshop.catalog.services.view' },
];

const SUB_TABS = [
    { id: 'not_added', labelKey: 'subTab.not_added' },
    { id: 'added', labelKey: 'subTab.added' },
];

/** Pull an array out of a backend response, trying a few common shapes. */
function pickArray(res, keys) {
    const extended = [...keys, 'rows', 'results', 'list', 'records'];
    if (Array.isArray(res)) return res;
    if (!res || typeof res !== 'object') return [];
    for (const k of extended) {
        if (Array.isArray(res[k])) return res[k];
        if (Array.isArray(res?.data?.[k])) return res.data[k];
    }
    if (Array.isArray(res?.data)) return res.data;
    return [];
}

/** Pull pagination metadata out of a list response. */
function pickPagination(res, fallbackPageSize = PAGE_SIZE) {
    const r =
        res?.data != null && typeof res.data === 'object' && !Array.isArray(res.data) ? res.data : res || {};
    const nested = r.pagination || r.meta || {};
    const pageBlock =
        r.page != null && typeof r.page === 'object' && !Array.isArray(r.page)
            ? r.page
            : nested.page != null && typeof nested.page === 'object'
              ? nested.page
              : null;
    const rawTotal =
        r.total ??
        r.count ??
        r.totalCount ??
        r.totalElements ??
        r.recordsTotal ??
        r.itemCount ??
        nested.total ??
        nested.count ??
        nested.totalElements ??
        (pageBlock ? pageBlock.totalElements ?? pageBlock.total : undefined) ??
        (Array.isArray(res?.data) ? undefined : res?.total) ??
        res?.count;
    const n = rawTotal != null && rawTotal !== '' ? Number(rawTotal) : NaN;
    const total = Number.isFinite(n) && n >= 0 ? n : 0;

    let resolvedPage = 1;
    if (typeof r.page === 'number') resolvedPage = r.page;
    else if (typeof nested.page === 'number') resolvedPage = nested.page;
    else if (pageBlock != null && pageBlock.number != null) resolvedPage = Number(pageBlock.number) + 1;

    let resolvedSize = fallbackPageSize;
    if (typeof r.pageSize === 'number') resolvedSize = r.pageSize;
    else if (typeof nested.pageSize === 'number') resolvedSize = nested.pageSize;
    else if (pageBlock != null && pageBlock.size != null) resolvedSize = Number(pageBlock.size);

    /** true | false if server said so; null = unknown (do not treat as "no next page"). */
    let hasNext = null;
    if (
        r.hasNext === true ||
        r.has_next === true ||
        r.hasMore === true ||
        r.has_more === true ||
        nested.hasNext === true ||
        nested.hasMore === true ||
        (pageBlock && pageBlock.last === false)
    ) {
        hasNext = true;
    } else if (
        r.hasNext === false ||
        r.has_next === false ||
        r.hasMore === false ||
        r.has_more === false ||
        nested.hasNext === false ||
        nested.hasMore === false ||
        (pageBlock && pageBlock.last === true)
    ) {
        hasNext = false;
    }

    return {
        total,
        page: Number(resolvedPage) || 1,
        pageSize: Number(resolvedSize) || fallbackPageSize,
        hasNext,
    };
}

function isCatalogRowAdopted(row, catalogBranchId) {
    return catalogBranchId ? Boolean(row?.inBranch) : Boolean(row?.inWorkshop);
}

/** Merge workshop adoption flags (e.g. effective isActive) onto master-catalog browse rows. */
function enrichAdoptedCatalogRows(adoptedRows, myAddedRows) {
    const byId = new Map((myAddedRows || []).map((r) => [String(r.id), r]));
    return (adoptedRows || []).map((row) => {
        const mine = byId.get(String(row.id));
        if (!mine) return row;
        return {
            ...row,
            isActive: mine.isActive,
            workshopProductId: mine.workshopProductId,
            branches: mine.branches ?? row.branches,
            branchNames: mine.branchNames ?? row.branchNames,
        };
    });
}

/**
 * Walks catalog pages and returns rows already adopted for the current branch scope.
 * Uses the same `inBranch` / `inWorkshop` flags as the not-added browse list.
 */
async function fetchAdoptedCatalogRows({
    fetchPage,
    pickKeys,
    filter,
    branchId,
    pageSize = PAGE_SIZE,
    signal,
}) {
    const adopted = [];
    let page = 1;
    for (;;) {
        const params = {
            departmentId: filter.departmentId === 'all' ? undefined : filter.departmentId,
            categoryId: filter.categoryId === 'all' ? undefined : filter.categoryId,
            q: filter.q || undefined,
            page,
            pageSize,
            branchId,
            signal,
        };
        const res = await fetchPage(params);
        if (signal?.aborted) {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            throw err;
        }
        const rows = pickArray(res, pickKeys);
        const meta = pickPagination(res, pageSize);
        for (const r of rows) {
            if (isCatalogRowAdopted(r, branchId)) adopted.push(r);
        }

        if (rows.length === 0) break;
        if (meta.hasNext === false) break;
        if (meta.hasNext === true) {
            page += 1;
            continue;
        }
        const totalPagesKnown =
            meta.total > 0 ? Math.max(1, Math.ceil(meta.total / meta.pageSize)) : null;
        if (totalPagesKnown != null && page >= totalPagesKnown) break;
        if (rows.length < pageSize) break;
        page += 1;
        if (page > 5000) break;
    }
    return adopted;
}

/**
 * Walks catalog list pages with the same filters until the server has no more rows,
 * then returns every row `id` (for “select all” across pagination).
 */
async function fetchAllCatalogRowIds({
    fetchPage,
    pickKeys,
    filter,
    branchId,
    pageSize = PAGE_SIZE,
    signal,
}) {
    const idSet = new Set();
    let page = 1;
    for (;;) {
        const params = {
            departmentId: filter.departmentId === 'all' ? undefined : filter.departmentId,
            categoryId: filter.categoryId === 'all' ? undefined : filter.categoryId,
            q: filter.q || undefined,
            page,
            pageSize,
            branchId,
            signal,
        };
        const res = await fetchPage(params);
        if (signal?.aborted) {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            throw err;
        }
        const rows = pickArray(res, pickKeys);
        const meta = pickPagination(res, pageSize);
        for (const r of rows) {
            if (r?.id == null) continue;
            if (r.isActive === false) continue;
            if (isCatalogRowAdopted(r, branchId)) continue;
            idSet.add(String(r.id));
        }

        if (rows.length === 0) break;
        if (meta.hasNext === false) break;
        if (meta.hasNext === true) {
            page += 1;
            continue;
        }
        const totalPagesKnown =
            meta.total > 0 ? Math.max(1, Math.ceil(meta.total / meta.pageSize)) : null;
        if (totalPagesKnown != null && page >= totalPagesKnown) break;
        if (rows.length < pageSize) break;
        page += 1;
        if (page > 5000) break;
    }
    return idSet;
}

/**
 * Loads catalog pages until every `selectedIds` row is found (same filters as the list).
 * Used when opening adopt modals: selection can span pages but `prodRows` / `svcRows` only hold one page.
 */
async function resolveCatalogRowsForSelectedIds({
    selectedIds,
    seedRows,
    fetchPage,
    pickKeys,
    filter,
    branchId,
    pageSize = PAGE_SIZE,
    signal,
}) {
    const idOrder = [...selectedIds].map(String);
    const want = new Set(idOrder);
    const byId = new Map();
    for (const r of seedRows || []) {
        const id = String(r?.id ?? r?._id ?? '');
        if (id && want.has(id)) byId.set(id, r);
    }
    let page = 1;
    while (byId.size < want.size) {
        const params = {
            departmentId: filter.departmentId === 'all' ? undefined : filter.departmentId,
            categoryId: filter.categoryId === 'all' ? undefined : filter.categoryId,
            q: filter.q || undefined,
            page,
            pageSize,
            branchId,
            signal,
        };
        const res = await fetchPage(params);
        if (signal?.aborted) {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            throw err;
        }
        const rows = pickArray(res, pickKeys);
        const meta = pickPagination(res, pageSize);
        for (const r of rows) {
            const id = String(r?.id ?? r?._id ?? '');
            if (id && want.has(id) && !byId.has(id)) byId.set(id, r);
        }
        if (rows.length === 0) break;
        if (byId.size >= want.size) break;
        if (meta.hasNext === false) break;
        if (meta.hasNext === true) {
            page += 1;
            continue;
        }
        const totalPagesKnown =
            meta.total > 0 ? Math.max(1, Math.ceil(meta.total / meta.pageSize)) : null;
        if (totalPagesKnown != null && page >= totalPagesKnown) break;
        if (rows.length < pageSize) break;
        page += 1;
        if (page > 5000) break;
    }
    return idOrder.map((id) => byId.get(id)).filter(Boolean);
}

/** Group an array of `{ branchName, itemName }` adoption rows by branch. */
function groupByBranch(entries, t) {
    const map = new Map();
    for (const e of entries) {
        const key = e.branchName || (e.branchId != null ? t('branch.withId', { id: e.branchId }) : t('branch.fallback'));
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(e.itemName || e.name || e.itemId || '');
    }
    return [...map.entries()];
}

/**
 * Summarize the new per-branch adoption response.
 *   added: { departments: [{branchId, branchName, itemId, itemName, kind}], categories, products, services }
 *   skipped: [{ kind, branchId, itemId, reason }]
 */
function summarizeAdoptResponse(res, primaryKind, t) {
    const payload = res?.data && typeof res.data === 'object' ? res.data : res || {};
    const added = payload.added || {};
    const skipped = Array.isArray(payload.skipped) ? payload.skipped : [];

    const buckets = ['departments', 'categories', 'products', 'services'];
    const counts = Object.fromEntries(buckets.map((b) => [b, Array.isArray(added[b]) ? added[b].length : 0]));
    const primaryCount = counts[primaryKind] || 0;
    const extraBuckets = buckets.filter((b) => b !== primaryKind && counts[b] > 0);

    const extras = [];
    if (primaryCount > 0) {
        const groups = groupByBranch(added[primaryKind], t);
        for (const [branch, names] of groups) {
            extras.push(
                t('result.branchItems', {
                    branch,
                    count: names.length,
                    kind: t(`kind.${primaryKind}`),
                    names: names.slice(0, 4).join(', '),
                    ellipsis: names.length > 4 ? '…' : '',
                }),
            );
        }
    }
    for (const b of extraBuckets) {
        const groups = groupByBranch(added[b], t);
        const total = counts[b];
        const nounKey = total === 1 ? `kind.${b.replace(/s$/, '')}` : `kind.${b}`;
        const branchSummary = groups.map(([branch, names]) => `${branch} (${names.length})`).join(', ');
        extras.push(t('result.alsoAdded', { total, noun: t(nounKey), branchSummary }));
    }

    return {
        kind: 'success',
        summary: t('result.summary', {
            added: primaryCount,
            skipped: skipped.length,
            suffix: skipped.length ? t('result.alreadyInBranch') : '',
        }),
        addedExtras: extras,
    };
}

/** Top-of-tab dismissable banner showing the latest adopt result. */
function ResultBanner({ banner, onClose, t }) {
    if (!banner) return null;
    const isError = banner.kind === 'error';
    const Icon = isError ? AlertCircle : CheckCircle2;
    const color = isError ? '#B91C1C' : '#047857';
    const bg = isError ? '#FEE2E2' : '#ECFDF5';
    const border = isError ? '#FECACA' : '#A7F3D0';
    return (
        <div
            style={{
                margin: '0 0 12px',
                padding: '10px 14px',
                background: bg,
                border: `1px solid ${border}`,
                borderRadius: 10,
                color,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                fontSize: '0.875rem',
            }}
        >
            <Icon size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{banner.summary}</div>
                {Array.isArray(banner.addedExtras) && banner.addedExtras.length > 0 && (
                    <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                        {banner.addedExtras.map((line, i) => (
                            <li key={i}>{line}</li>
                        ))}
                    </ul>
                )}
            </div>
            <button
                type="button"
                onClick={onClose}
                aria-label={t('aria.dismiss')}
                style={{
                    background: 'transparent',
                    border: 'none',
                    color,
                    cursor: 'pointer',
                    padding: 2,
                    lineHeight: 0,
                }}
            >
                <X size={16} />
            </button>
        </div>
    );
}

/** Card used in every grid: checkbox + title + meta + adoption badge. */
function CatalogCard({ row, label, subtitle, meta, selected, disabled, disabledLabel, hint, onToggle, noAdd = false, t, locale = 'en' }) {
    // `disabled` = already in workshop's inventory (can't re-add).
    // `noAdd` = user lacks the `.add` permission for this tab (read-only mode).
    const inert = disabled || noAdd;
    const showInactive = row.isActive === false;
    const title = catalogDisplayName(row, locale) || row.name;
    return (
        <div
            className={`mc-product-card ${inert ? '' : 'clickable'} ${selected ? 'selected' : ''}`}
            onClick={() => !inert && onToggle?.()}
            style={inert ? { opacity: showInactive ? 0.65 : 0.7, cursor: 'default' } : undefined}
        >
            <div className="mc-card-type-label">{label}</div>
            <div className="mc-card-info-main">
                <h4 className="mc-card-title">{title}</h4>
                {subtitle && <span className="mc-card-subtitle">{subtitle}</span>}
                {meta?.length > 0 && (
                    <div className="mc-card-meta-list">
                        {meta.map((m, i) => (
                            <div key={i} className="mc-meta-item">
                                {m.Icon && <m.Icon size={14} />}
                                <span>{m.text}</span>
                            </div>
                        ))}
                    </div>
                )}
                {hint && (
                    <div style={{ marginTop: 6, fontSize: '0.75rem', color: '#0369A1', fontWeight: 600 }}>
                        {hint}
                    </div>
                )}
            </div>
            <div className="mc-card-footer-actions">
                {showInactive ? (
                    <span className="ws-badge ws-badge--gray" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {t('status.inactive')}
                    </span>
                ) : disabled ? (
                    <span className="ws-badge ws-badge--green" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <ShieldCheck size={14} /> {disabledLabel || t('badge.inWorkshop')}
                    </span>
                ) : noAdd ? (
                    // Read-only mode — no add permission. Show a muted lock-like
                    // indicator instead of the clickable plus so users don't
                    // wonder why the card doesn't respond.
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>
                        {t('badge.readOnly')}
                    </span>
                ) : (
                    <div className={`mc-card-selection-btn ${selected ? 'selected' : ''}`}>
                        {selected ? <ShieldCheck size={20} /> : <Plus size={20} />}
                    </div>
                )}
            </div>
        </div>
    );
}

function isInSelectedBranch(row, branchId) {
    if (!branchId || branchId === 'all') return true;
    const bid = String(branchId);
    const branches = row?.branches;
    if (Array.isArray(branches)) {
        return branches.some((b) => String(b?.id) === bid);
    }
    return false;
}

/** Pick the branch used for added / not-added lists (role scope + sidebar). */
function resolveCatalogBranchScope({
    branchLockedId,
    selectedBranchId,
    branchScopeId,
    branchList,
    allowAllBranches = false,
}) {
    if (branchLockedId) return String(branchLockedId);
    if (selectedBranchId && selectedBranchId !== 'all') return String(selectedBranchId);
    if (branchScopeId && branchScopeId !== 'all') return String(branchScopeId);
    if (allowAllBranches) return null;
    if (branchList.length === 1) return String(branchList[0].id);
    if (branchList.length > 1) return String(branchList[0].id);
    return null;
}

/** Never omit branchIds on adopt — empty means every workshop branch on the BE. */
function resolveAdoptBranchIds(targetBranchIds, catalogBranchId, branchList) {
    if (Array.isArray(targetBranchIds) && targetBranchIds.length > 0) {
        return targetBranchIds.map(String);
    }
    if (catalogBranchId) return [String(catalogBranchId)];
    if (branchList.length === 1) return [String(branchList[0].id)];
    if (branchList.length > 1) return branchList.map((b) => String(b.id));
    return [];
}

function CatalogBranchFilter({
    branchList,
    value,
    onChange,
    locked,
    labelId,
    allowAllBranches = false,
    t,
}) {
    const selectedName =
        value === 'all'
            ? t('branch.all')
            : branchList.find((b) => String(b.id) === String(value))?.name ?? t('branch.label');
    if (locked || (branchList.length <= 1 && !allowAllBranches)) {
        return (
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                {t('branch.prefix')} <strong>{selectedName}</strong>
            </div>
        );
    }
    return (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Filter size={14} />
            <select
                id={labelId}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                style={{
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: '1px solid var(--color-border)',
                    fontSize: '0.875rem',
                    minWidth: 200,
                }}
            >
                {allowAllBranches ? <option value="all">{t('branch.all')}</option> : null}
                {branchList.map((b) => (
                    <option key={String(b.id)} value={String(b.id)}>
                        {b.name}
                    </option>
                ))}
            </select>
        </div>
    );
}

function matchesCatalogSearch(row, q) {
    const query = String(q || '').trim().toLowerCase();
    if (!query) return true;
    const fields = [
        row?.name,
        row?.sku,
        row?.brandName,
        row?.departmentName,
        row?.categoryName,
    ]
        .filter((v) => v != null)
        .map((v) => String(v).toLowerCase());
    return fields.some((f) => f.includes(query));
}

function SubTabToggle({ value, counts, onChange, t }) {
    return (
        <div
            style={{
                display: 'inline-flex',
                border: '1px solid var(--color-border-light, #E5E7EB)',
                background: '#fff',
                borderRadius: 10,
                padding: 4,
                gap: 4,
            }}
        >
            {SUB_TABS.map((tab) => (
                <button
                    key={tab.id}
                    type="button"
                    onClick={() => onChange(tab.id)}
                    style={{
                        border: 'none',
                        cursor: 'pointer',
                        padding: '6px 10px',
                        borderRadius: 8,
                        fontSize: '0.8125rem',
                        fontWeight: 800,
                        background: value === tab.id ? '#23262D' : 'transparent',
                        color: value === tab.id ? '#FCC247' : 'var(--color-text-muted)',
                    }}
                >
                    {t(tab.labelKey)}
                    {counts && Number.isFinite(Number(counts[tab.id])) ? (
                        <span style={{ opacity: value === tab.id ? 1 : 0.7 }}>
                            {' '}
                            ({Number(counts[tab.id]).toLocaleString()})
                        </span>
                    ) : null}
                </button>
            ))}
        </div>
    );
}

export default function WorkshopCatalogNew({
    branches: branchesProp = [],
    selectedBranchId = 'all',
    branchLockedId = null,
    /** Workshop owner / admin with every branch — may browse catalog workshop-wide. */
    allowAllBranches = false,
    locale: localeProp,
}) {
    const locale = localeProp || (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) || 'en';
    const t = useCallback((key, vars) => wcnT(locale, key, vars), [locale]);
    const { hasPermission } = useAuth();
    const visibleTabs = TABS.filter((tab) => hasPermission(tab.permission));
    // Per-tab "add" permission gates the + icon on each card AND the
    // "Add Selected to branches…" bulk button. Users with only `.view` see
    // the catalog read-only; cards aren't clickable and Add buttons are hidden.
    const canAddDept = hasPermission('workshop.catalog.departments.add');
    const canAddCat  = hasPermission('workshop.catalog.categories.add');
    const canAddProd = hasPermission('workshop.catalog.products.add');
    const canAddSvc  = hasPermission('workshop.catalog.services.add');
    const [activeTab, setActiveTab] = useState(() => visibleTabs[0]?.id ?? 'departments');
    const [banner, setBanner] = useState(null);

    // Auto-snap to first visible tab if current becomes hidden.
    useEffect(() => {
        if (visibleTabs.length === 0) return;
        if (!visibleTabs.some((t) => t.id === activeTab)) {
            setActiveTab(visibleTabs[0].id);
        }
    }, [visibleTabs, activeTab]);

    const branchList = useMemo(
        () => filterPortalVisibleBranches(Array.isArray(branchesProp) ? branchesProp : []),
        [branchesProp],
    );

    const [branchScopeId, setBranchScopeId] = useState(() => {
        const resolved = resolveCatalogBranchScope({
            branchLockedId,
            selectedBranchId,
            branchScopeId: selectedBranchId,
            branchList,
            allowAllBranches,
        });
        if (resolved) return resolved;
        if (allowAllBranches) return 'all';
        return branchList[0] ? String(branchList[0].id) : 'all';
    });

    useEffect(() => {
        if (branchLockedId) {
            setBranchScopeId(String(branchLockedId));
            return;
        }
        if (selectedBranchId && selectedBranchId !== 'all') {
            setBranchScopeId(String(selectedBranchId));
            return;
        }
        if (allowAllBranches && (!selectedBranchId || selectedBranchId === 'all')) {
            setBranchScopeId('all');
            return;
        }
        // Role-scoped employee: pick first allowed branch once the list arrives.
        if (branchList.length > 0) {
            setBranchScopeId((prev) => {
                if (prev && prev !== 'all' && branchList.some((b) => String(b.id) === String(prev))) {
                    return prev;
                }
                return String(branchList[0].id);
            });
        }
    }, [branchLockedId, selectedBranchId, branchList, allowAllBranches]);

    const catalogBranchScopeId = useMemo(
        () =>
            resolveCatalogBranchScope({
                branchLockedId,
                selectedBranchId,
                branchScopeId,
                branchList,
                allowAllBranches,
            }),
        [branchLockedId, selectedBranchId, branchScopeId, branchList, allowAllBranches],
    );

    const catalogBranchId = catalogBranchScopeId ?? undefined;
    const effectiveBranchScopeId = catalogBranchScopeId ?? 'all';
    const branchPickerLocked =
        Boolean(branchLockedId) || (branchList.length <= 1 && !allowAllBranches);

    const defaultAdoptBranchIds = useMemo(
        () => resolveAdoptBranchIds([], catalogBranchId, branchList),
        [catalogBranchId, branchList],
    );

    /** Wait until branch scope is known before the first catalog fetch (avoids empty first paint for employees). */
    const isCatalogBranchReady = useMemo(() => {
        if (branchLockedId) return true;
        if (allowAllBranches) return true;
        if (branchList.length === 0) return false;
        return Boolean(catalogBranchScopeId);
    }, [branchLockedId, allowAllBranches, branchList.length, catalogBranchScopeId]);

    const [subTab, setSubTab] = useState({
        departments: 'not_added',
        categories: 'not_added',
        products: 'not_added',
        services: 'not_added',
    });
    const activeSubTab = subTab[activeTab] || 'not_added';

    const [deptCounts, setDeptCounts] = useState({ added: null, not_added: null });
    const [catCounts, setCatCounts] = useState({ added: null, not_added: null });
    const [prodCounts, setProdCounts] = useState({ added: null, not_added: null });
    const [svcCounts, setSvcCounts] = useState({ added: null, not_added: null });

    // ─── Departments tab ────────────────────────────────────────────────────
    const [deptRows, setDeptRows] = useState([]);
    const [deptLoading, setDeptLoading] = useState(false);
    const [deptError, setDeptError] = useState('');
    const [deptSelected, setDeptSelected] = useState(new Set());

    const loadDepartments = useCallback((signal) => {
        setDeptLoading(true);
        setDeptError('');
        const mode = subTab.departments;
        const branchIdForBadges = catalogBranchId;

        Promise.all([
            getCatalogDepartments({ signal, branchId: branchIdForBadges }),
            getMyDepartments({ signal }),
        ])
            .then(([masterRes, myRes]) => {
                const masterRows = pickArray(masterRes, ['departments', 'items']);
                const myRows = pickArray(myRes, ['departments', 'items']);
                const addedRows = myRows.filter((r) => isInSelectedBranch(r, effectiveBranchScopeId));
                const masterNotAdded = masterRows.filter((r) => {
                    const inScope = catalogBranchId ? Boolean(r?.inBranch) : Boolean(r?.inWorkshop);
                    return !inScope;
                });
                setDeptCounts({ added: addedRows.length, not_added: masterNotAdded.length });
                setDeptRows(mode === 'added' ? addedRows : masterNotAdded);
            })
            .catch((err) => {
                if (err.name !== 'AbortError') setDeptError(err.message || t('err.loadDepts'));
            })
            .finally(() => setDeptLoading(false));
    }, [catalogBranchId, effectiveBranchScopeId, subTab.departments, t]);

    // ─── Categories tab ─────────────────────────────────────────────────────
    const [catRows, setCatRows] = useState([]);
    const [catLoading, setCatLoading] = useState(false);
    const [catError, setCatError] = useState('');
    const [catSelected, setCatSelected] = useState(new Set());
    const [catFilter, setCatFilter] = useState({ departmentId: 'all', type: 'all' });

    const loadCategories = useCallback((signal) => {
        setCatLoading(true);
        setCatError('');
        const params = {
            departmentId: catFilter.departmentId === 'all' ? undefined : catFilter.departmentId,
            type: catFilter.type === 'all' ? undefined : catFilter.type,
            branchId: catalogBranchId,
            signal,
        };
        const mode = subTab.categories;

        Promise.all([
            getCatalogCategories(params),
            getMyCategories({
                departmentId: params.departmentId,
                type: params.type,
                signal,
            }),
        ])
            .then(([masterRes, myRes]) => {
                const masterRows = pickArray(masterRes, ['categories', 'items']);
                const myRows = pickArray(myRes, ['categories', 'items']);
                const addedRows = myRows.filter((r) => isInSelectedBranch(r, effectiveBranchScopeId));
                const masterNotAdded = masterRows.filter((r) => {
                    const inScope = catalogBranchId ? Boolean(r?.inBranch) : Boolean(r?.inWorkshop);
                    return !inScope;
                });
                setCatCounts({ added: addedRows.length, not_added: masterNotAdded.length });
                setCatRows(mode === 'added' ? addedRows : masterNotAdded);
            })
            .catch((err) => {
                if (err.name !== 'AbortError') setCatError(err.message || t('err.loadCats'));
            })
            .finally(() => setCatLoading(false));
    }, [catFilter.departmentId, catFilter.type, catalogBranchId, effectiveBranchScopeId, subTab.categories, t]);

    // ─── Products tab ───────────────────────────────────────────────────────
    const [prodRows, setProdRows] = useState([]);
    const [prodLoading, setProdLoading] = useState(false);
    const [prodError, setProdError] = useState('');
    const [prodSelected, setProdSelected] = useState(new Set());
    const [prodFilter, setProdFilter] = useState({ departmentId: 'all', categoryId: 'all', q: '' });
    const [prodQInput, setProdQInput] = useState('');
    const [prodPage, setProdPage] = useState(1);
    const [prodTotal, setProdTotal] = useState(0);
    const [prodHasNext, setProdHasNext] = useState(null);
    const [prodSelectAllBusy, setProdSelectAllBusy] = useState(false);

    const loadProducts = useCallback((signal) => {
        setProdLoading(true);
        setProdError('');
        const mode = subTab.products;
        const params = {
            departmentId: prodFilter.departmentId === 'all' ? undefined : prodFilter.departmentId,
            categoryId: prodFilter.categoryId === 'all' ? undefined : prodFilter.categoryId,
            q: prodFilter.q || undefined,
            page: prodPage,
            pageSize: PAGE_SIZE,
            branchId: catalogBranchId,
            signal,
        };
        Promise.all([
            // Total matching master rows (use pageSize=1 to keep payload tiny)
            getCatalogProducts({ ...params, page: 1, pageSize: 1 }),
            // Count products that are both in master catalog and already adopted.
            fetchAdoptedCatalogRows({
                fetchPage: getCatalogProducts,
                pickKeys: ['products', 'items'],
                filter: prodFilter,
                branchId: catalogBranchId,
                pageSize: PAGE_SIZE,
                signal,
            }),
            getMyProducts({
                departmentId: params.departmentId,
                categoryId: params.categoryId,
                signal,
            }),
            // Page rows for not-added browse (keeps pagination behavior)
            mode === 'added' ? Promise.resolve(null) : getCatalogProducts(params),
        ])
            .then(([masterRes, adoptedCatalogRows, myProductsRes, pageRes]) => {
                const masterMeta = pickPagination(masterRes);
                const masterTotal = masterMeta.total;
                const myRowsRaw = pickArray(myProductsRes, ['products', 'items']);
                const myAdded = myRowsRaw
                    .filter((r) => isInSelectedBranch(r, effectiveBranchScopeId))
                    .filter((r) => matchesCatalogSearch(r, prodFilter.q));
                const adoptedRows = Array.isArray(adoptedCatalogRows) ? adoptedCatalogRows : [];
                const adoptedRowsEnriched = enrichAdoptedCatalogRows(adoptedRows, myAdded);
                // Partition master catalog only — added + not_added must equal masterTotal.
                const addedCount = adoptedRows.length;
                const notAddedCount = Math.max(0, masterTotal - addedCount);

                if (mode === 'added') {
                    setProdCounts({ added: addedCount, not_added: notAddedCount });
                    const totalPages = Math.max(1, Math.ceil(addedCount / PAGE_SIZE));
                    const page = Math.min(Math.max(1, prodPage), totalPages);
                    const slice = adoptedRowsEnriched.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
                    setProdRows(slice);
                    setProdTotal(addedCount);
                    setProdHasNext(page < totalPages);
                    return;
                }

                setProdCounts({ added: addedCount, not_added: notAddedCount });

                const res = pageRes || masterRes;
                const rows = pickArray(res, ['products', 'items']);
                const filtered = rows.filter((r) => !isCatalogRowAdopted(r, catalogBranchId));
                const meta = pickPagination(res);
                setProdRows(filtered);
                setProdTotal(meta.total);
                setProdHasNext(meta.hasNext);
            })
            .catch((err) => {
                if (err.name !== 'AbortError') setProdError(err.message || t('err.loadProducts'));
            })
            .finally(() => setProdLoading(false));
    }, [prodFilter.departmentId, prodFilter.categoryId, prodFilter.q, prodPage, catalogBranchId, effectiveBranchScopeId, subTab.products, t]);

    // ─── Services tab ───────────────────────────────────────────────────────
    const [svcRows, setSvcRows] = useState([]);
    const [svcLoading, setSvcLoading] = useState(false);
    const [svcError, setSvcError] = useState('');
    const [svcSelected, setSvcSelected] = useState(new Set());
    const [svcFilter, setSvcFilter] = useState({ departmentId: 'all', categoryId: 'all', q: '' });
    const [svcQInput, setSvcQInput] = useState('');
    const [svcPage, setSvcPage] = useState(1);
    const [svcTotal, setSvcTotal] = useState(0);
    const [svcHasNext, setSvcHasNext] = useState(null);
    const [svcSelectAllBusy, setSvcSelectAllBusy] = useState(false);

    const loadServices = useCallback((signal) => {
        setSvcLoading(true);
        setSvcError('');
        const mode = subTab.services;
        const params = {
            departmentId: svcFilter.departmentId === 'all' ? undefined : svcFilter.departmentId,
            categoryId: svcFilter.categoryId === 'all' ? undefined : svcFilter.categoryId,
            q: svcFilter.q || undefined,
            page: svcPage,
            pageSize: PAGE_SIZE,
            branchId: catalogBranchId,
            signal,
        };
        Promise.all([
            getCatalogServices({ ...params, page: 1, pageSize: 1 }),
            fetchAdoptedCatalogRows({
                fetchPage: getCatalogServices,
                pickKeys: ['services', 'items'],
                filter: svcFilter,
                branchId: catalogBranchId,
                pageSize: PAGE_SIZE,
                signal,
            }),
            getMyServices({
                departmentId: params.departmentId,
                categoryId: params.categoryId,
                signal,
            }),
            mode === 'added' ? Promise.resolve(null) : getCatalogServices(params),
        ])
            .then(([masterRes, adoptedCatalogRows, myServicesRes, pageRes]) => {
                const masterMeta = pickPagination(masterRes);
                const masterTotal = masterMeta.total;
                const myRowsRaw = pickArray(myServicesRes, ['services', 'items']);
                const myAdded = myRowsRaw
                    .filter((r) => isInSelectedBranch(r, effectiveBranchScopeId))
                    .filter((r) => matchesCatalogSearch(r, svcFilter.q));
                const adoptedRows = Array.isArray(adoptedCatalogRows) ? adoptedCatalogRows : [];
                const adoptedRowsEnriched = enrichAdoptedCatalogRows(adoptedRows, myAdded);
                const addedCount = adoptedRows.length;
                const notAddedCount = Math.max(0, masterTotal - addedCount);

                if (mode === 'added') {
                    setSvcCounts({ added: addedCount, not_added: notAddedCount });
                    const totalPages = Math.max(1, Math.ceil(addedCount / PAGE_SIZE));
                    const page = Math.min(Math.max(1, svcPage), totalPages);
                    const slice = adoptedRowsEnriched.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
                    setSvcRows(slice);
                    setSvcTotal(addedCount);
                    setSvcHasNext(page < totalPages);
                    return;
                }

                setSvcCounts({ added: addedCount, not_added: notAddedCount });

                const res = pageRes || masterRes;
                const rows = pickArray(res, ['services', 'items']);
                const filtered = rows.filter((r) => !isCatalogRowAdopted(r, catalogBranchId));
                const meta = pickPagination(res);
                setSvcRows(filtered);
                setSvcTotal(meta.total);
                setSvcHasNext(meta.hasNext);
            })
            .catch((err) => {
                if (err.name !== 'AbortError') setSvcError(err.message || t('err.loadServices'));
            })
            .finally(() => setSvcLoading(false));
    }, [svcFilter.departmentId, svcFilter.categoryId, svcFilter.q, svcPage, catalogBranchId, effectiveBranchScopeId, subTab.services, t]);

    const handleSelectAllProducts = useCallback(async () => {
        setProdSelectAllBusy(true);
        setProdError('');
        try {
            const idSet = await fetchAllCatalogRowIds({
                fetchPage: getCatalogProducts,
                pickKeys: ['products', 'items'],
                filter: prodFilter,
                branchId: catalogBranchId,
                pageSize: PAGE_SIZE,
            });
            setProdSelected(idSet);
        } catch (e) {
            if (e.name !== 'AbortError') {
                setProdError(e?.message || t('err.loadAllProducts'));
            }
        } finally {
            setProdSelectAllBusy(false);
        }
    }, [prodFilter, catalogBranchId, t]);

    const handleSelectAllServices = useCallback(async () => {
        setSvcSelectAllBusy(true);
        setSvcError('');
        try {
            const idSet = await fetchAllCatalogRowIds({
                fetchPage: getCatalogServices,
                pickKeys: ['services', 'items'],
                filter: svcFilter,
                branchId: catalogBranchId,
                pageSize: PAGE_SIZE,
            });
            setSvcSelected(idSet);
        } catch (e) {
            if (e.name !== 'AbortError') {
                setSvcError(e?.message || t('err.loadAllServices'));
            }
        } finally {
            setSvcSelectAllBusy(false);
        }
    }, [svcFilter, catalogBranchId, t]);

    // ─── Effects: load when tab/filters change ──────────────────────────────
    useEffect(() => {
        if (!isCatalogBranchReady) return undefined;
        const ctrl = new AbortController();
        if (activeTab === 'departments') loadDepartments(ctrl.signal);
        if (activeTab === 'categories')  loadCategories(ctrl.signal);
        if (activeTab === 'products')    loadProducts(ctrl.signal);
        if (activeTab === 'services')    loadServices(ctrl.signal);
        return () => ctrl.abort();
    }, [
        activeTab,
        loadDepartments,
        loadCategories,
        loadProducts,
        loadServices,
        isCatalogBranchReady,
        catalogBranchId,
    ]);

    // Always have the department list ready for filter dropdowns and category modal.
    const deptWarmupRef = useRef(null);
    useEffect(() => {
        deptWarmupRef.current = null;
    }, [catalogBranchId, effectiveBranchScopeId]);

    useEffect(() => {
        if (!isCatalogBranchReady) return undefined;
        if (deptWarmupRef.current === loadDepartments) return undefined;
        if (deptLoading || deptRows.length > 0) {
            deptWarmupRef.current = loadDepartments;
            return undefined;
        }
        deptWarmupRef.current = loadDepartments;
        const ctrl = new AbortController();
        loadDepartments(ctrl.signal);
        return () => ctrl.abort();
    }, [loadDepartments, deptLoading, deptRows.length, isCatalogBranchReady]);

    // Reset to page 1 when filters or adoption branch context changes.
    useEffect(() => { setProdPage(1); }, [prodFilter.departmentId, prodFilter.categoryId, prodFilter.q]);
    useEffect(() => { setSvcPage(1); }, [svcFilter.departmentId, svcFilter.categoryId, svcFilter.q]);
    useEffect(() => { setProdPage(1); }, [subTab.products, effectiveBranchScopeId]);
    useEffect(() => { setSvcPage(1); }, [subTab.services, effectiveBranchScopeId]);
    useEffect(() => {
        // Clear selection when switching added/not-added modes.
        setDeptSelected(new Set());
        setCatSelected(new Set());
        setProdSelected(new Set());
        setSvcSelected(new Set());
    }, [subTab.departments, subTab.categories, subTab.products, subTab.services]);

    // Debounced search input → filter.
    const prodSearchRef = useRef();
    useEffect(() => {
        clearTimeout(prodSearchRef.current);
        prodSearchRef.current = setTimeout(() => {
            setProdFilter((f) => ({ ...f, q: prodQInput.trim() }));
        }, 350);
        return () => clearTimeout(prodSearchRef.current);
    }, [prodQInput]);

    const svcSearchRef = useRef();
    useEffect(() => {
        clearTimeout(svcSearchRef.current);
        svcSearchRef.current = setTimeout(() => {
            setSvcFilter((f) => ({ ...f, q: svcQInput.trim() }));
        }, 350);
        return () => clearTimeout(svcSearchRef.current);
    }, [svcQInput]);

    // ─── Modals ─────────────────────────────────────────────────────────────
    const [deptCatModal, setDeptCatModal] = useState(null);
    // { departments, selections, targetBranchIds, loading, error }
    const [productAdopt, setProductAdopt] = useState(null);
    // { rows, missing, items (critical only), targetBranchIds, loading, error }
    const [serviceAdopt, setServiceAdopt] = useState(null);
    // { rows, missing, targetBranchIds, loading, error }

    const idsToRows = (ids, rows) => rows.filter((r) => ids.has(String(r.id ?? r._id)));

    // ─── Adopt: Departments ─────────────────────────────────────────────────
    const openDeptCategoryModal = useCallback(async () => {
        const selectedRows = idsToRows(deptSelected, deptRows);
        if (selectedRows.length === 0) return;
        const selections = {};
        for (const d of selectedRows) {
            selections[String(d.id)] = { mode: 'all', pickedIds: new Set(), categories: [] };
        }
        setDeptCatModal({
            departments: selectedRows,
            selections,
            targetBranchIds: [...defaultAdoptBranchIds],
            loading: false,
            error: '',
        });
        // Fetch categories for each selected department (no branch context — we
        // need the full master list so the user can pick what to adopt).
        for (const d of selectedRows) {
            try {
                const res = await getCatalogCategories({ departmentId: d.id });
                const cats = pickArray(res, ['categories', 'items']);
                setDeptCatModal((prev) => {
                    if (!prev) return prev;
                    const next = { ...prev, selections: { ...prev.selections } };
                    next.selections[String(d.id)] = {
                        ...next.selections[String(d.id)],
                        categories: cats,
                    };
                    return next;
                });
            } catch {
                /* leave categories empty for this dept */
            }
        }
    }, [deptSelected, deptRows, defaultAdoptBranchIds]);

    const submitDepartmentsAdopt = async () => {
        if (!deptCatModal) return;
        setDeptCatModal((prev) => ({ ...prev, loading: true, error: '' }));
        const departmentIds = deptCatModal.departments.map((d) => String(d.id));
        const categorySelections = [];
        for (const d of deptCatModal.departments) {
            const sel = deptCatModal.selections[String(d.id)];
            if (!sel) continue;
            if (sel.mode === 'all') {
                categorySelections.push({ departmentId: String(d.id), categoryIds: 'all' });
            } else if (sel.mode === 'pick' && sel.pickedIds && sel.pickedIds.size > 0) {
                categorySelections.push({
                    departmentId: String(d.id),
                    categoryIds: [...sel.pickedIds].map(String),
                });
            }
            // mode === 'none' → omit, dept added without categories
        }
        try {
            const body = {
                departmentIds,
                ...(categorySelections.length ? { categorySelections } : {}),
                branchIds: resolveAdoptBranchIds(
                    deptCatModal.targetBranchIds,
                    catalogBranchId,
                    branchList,
                ),
            };
            const res = await adoptDepartmentsToBranches(body);
            setBanner(summarizeAdoptResponse(res, 'departments', t));
            setDeptSelected(new Set());
            setDeptCatModal(null);
            const ctrl = new AbortController();
            loadDepartments(ctrl.signal);
        } catch (err) {
            setDeptCatModal((prev) => prev && { ...prev, loading: false, error: err.message || t('err.failedAdd') });
        }
    };

    // ─── Adopt: Categories (small modal just to pick target branches) ───────
    const [categoryAdopt, setCategoryAdopt] = useState(null);
    // { ids: string[], targetBranchIds: string[], loading, error }

    const openCategoryAdopt = () => {
        if (catSelected.size === 0) return;
        setCategoryAdopt({
            ids: [...catSelected].map(String),
            targetBranchIds: [...defaultAdoptBranchIds],
            loading: false,
            error: '',
        });
    };

    const submitCategoriesAdopt = async () => {
        if (!categoryAdopt) return;
        setCategoryAdopt((prev) => prev && { ...prev, loading: true, error: '' });
        try {
            const body = {
                categoryIds: categoryAdopt.ids,
                branchIds: resolveAdoptBranchIds(
                    categoryAdopt.targetBranchIds,
                    catalogBranchId,
                    branchList,
                ),
            };
            const res = await adoptCategoriesToBranches(body);
            setBanner(summarizeAdoptResponse(res, 'categories', t));
            setCatSelected(new Set());
            setCategoryAdopt(null);
            const ctrl = new AbortController();
            loadCategories(ctrl.signal);
        } catch (err) {
            setCategoryAdopt((prev) => prev && { ...prev, loading: false, error: err.message || t('err.failedAddCats') });
        }
    };

    // ─── Adopt: Products ────────────────────────────────────────────────────
    const openProductAdopt = useCallback(async () => {
        if (prodSelected.size === 0) return;
        let selectedRows;
        try {
            selectedRows = await resolveCatalogRowsForSelectedIds({
                selectedIds: prodSelected,
                seedRows: prodRows,
                fetchPage: getCatalogProducts,
                pickKeys: ['products', 'items'],
                filter: prodFilter,
                branchId: catalogBranchId,
                pageSize: PAGE_SIZE,
            });
        } catch (err) {
            if (err.name !== 'AbortError') {
                setProdError(err?.message || t('err.loadSelectedProducts'));
            }
            return;
        }
        if (selectedRows.length === 0) {
            setProdError(t('err.couldNotLoadProducts'));
            return;
        }
        setProdError('');
        const resolveNote =
            selectedRows.length < prodSelected.size
                ? t('resolveNote.products', { shown: selectedRows.length, total: prodSelected.size })
                : '';
        setProductAdopt({
            rows: selectedRows,
            missing: { departments: [], categories: [] },
            resolveNote,
            items: selectedRows.map((r) => ({
                productId: String(r.id),
                name: r.name,
                criticalStockPoint: '',
            })),
            bulkCriticalStockPoint: '',
            targetBranchIds: [...defaultAdoptBranchIds],
            loading: true,
            error: '',
        });
        try {
            const res = await previewProductDeps({ productIds: selectedRows.map((r) => String(r.id)) });
            const payload = res?.data && typeof res.data === 'object' ? res.data : res || {};
            const missing = payload.missing || { departments: [], categories: [] };
            setProductAdopt((prev) => prev && {
                ...prev,
                missing: {
                    departments: Array.isArray(missing.departments) ? missing.departments : [],
                    categories: Array.isArray(missing.categories) ? missing.categories : [],
                },
                loading: false,
            });
        } catch (err) {
            setProductAdopt((prev) => prev && { ...prev, loading: false, error: err.message || t('err.checkDeps') });
        }
    }, [prodSelected, prodRows, prodFilter, catalogBranchId, defaultAdoptBranchIds, t]);

    const submitProductsAdopt = async () => {
        if (!productAdopt) return;
        setProductAdopt((prev) => prev && { ...prev, loading: true, error: '' });
        try {
            const items = productAdopt.items.map((it) => ({
                productId: String(it.productId),
                openingQty: 0,
                criticalStockPoint: it.criticalStockPoint === '' ? 0 : Number(it.criticalStockPoint) || 0,
            }));
            const body = {
                items,
                branchIds: resolveAdoptBranchIds(
                    productAdopt.targetBranchIds,
                    catalogBranchId,
                    branchList,
                ),
            };
            const res = await adoptProductsToBranches(body);
            setBanner(summarizeAdoptResponse(res, 'products', t));
            setProdSelected(new Set());
            setProductAdopt(null);
            const ctrl = new AbortController();
            loadProducts(ctrl.signal);
        } catch (err) {
            setProductAdopt((prev) => prev && { ...prev, loading: false, error: err.message || t('err.failedAddProducts') });
        }
    };

    // ─── Adopt: Services ────────────────────────────────────────────────────
    const openServiceAdopt = useCallback(async () => {
        if (svcSelected.size === 0) return;
        let selectedRows;
        try {
            selectedRows = await resolveCatalogRowsForSelectedIds({
                selectedIds: svcSelected,
                seedRows: svcRows,
                fetchPage: getCatalogServices,
                pickKeys: ['services', 'items'],
                filter: svcFilter,
                branchId: catalogBranchId,
                pageSize: PAGE_SIZE,
            });
        } catch (err) {
            if (err.name !== 'AbortError') {
                setSvcError(err?.message || t('err.loadSelectedServices'));
            }
            return;
        }
        if (selectedRows.length === 0) {
            setSvcError(t('err.couldNotLoadServices'));
            return;
        }
        setSvcError('');
        const resolveNote =
            selectedRows.length < svcSelected.size
                ? t('resolveNote.services', { shown: selectedRows.length, total: svcSelected.size })
                : '';
        setServiceAdopt({
            rows: selectedRows,
            missing: { departments: [], categories: [] },
            resolveNote,
            targetBranchIds: [...defaultAdoptBranchIds],
            loading: true,
            error: '',
        });
        try {
            const res = await previewServiceDeps({ serviceIds: selectedRows.map((r) => String(r.id)) });
            const payload = res?.data && typeof res.data === 'object' ? res.data : res || {};
            const missing = payload.missing || { departments: [], categories: [] };
            setServiceAdopt((prev) => prev && {
                ...prev,
                missing: {
                    departments: Array.isArray(missing.departments) ? missing.departments : [],
                    categories: Array.isArray(missing.categories) ? missing.categories : [],
                },
                loading: false,
            });
        } catch (err) {
            setServiceAdopt((prev) => prev && { ...prev, loading: false, error: err.message || t('err.checkDeps') });
        }
    }, [svcSelected, svcRows, svcFilter, catalogBranchId, defaultAdoptBranchIds, t]);

    const submitServicesAdopt = async () => {
        if (!serviceAdopt) return;
        setServiceAdopt((prev) => prev && { ...prev, loading: true, error: '' });
        try {
            const items = serviceAdopt.rows.map((r) => ({ serviceId: String(r.id) }));
            const body = {
                items,
                branchIds: resolveAdoptBranchIds(
                    serviceAdopt.targetBranchIds,
                    catalogBranchId,
                    branchList,
                ),
            };
            const res = await adoptServicesToBranches(body);
            setBanner(summarizeAdoptResponse(res, 'services', t));
            setSvcSelected(new Set());
            setServiceAdopt(null);
            const ctrl = new AbortController();
            loadServices(ctrl.signal);
        } catch (err) {
            setServiceAdopt((prev) => prev && { ...prev, loading: false, error: err.message || t('err.failedAddServices') });
        }
    };

    // ─── Helpers ────────────────────────────────────────────────────────────
    const toggleId = (set, setSet, id) => {
        const next = new Set(set);
        const key = String(id);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        setSet(next);
    };

    const departmentOptions = useMemo(
        () => deptRows.map((d) => ({ id: String(d.id), name: d.name })),
        [deptRows],
    );

    const refreshActive = () => {
        const ctrl = new AbortController();
        if (activeTab === 'departments') loadDepartments(ctrl.signal);
        if (activeTab === 'categories')  loadCategories(ctrl.signal);
        if (activeTab === 'products')    loadProducts(ctrl.signal);
        if (activeTab === 'services')    loadServices(ctrl.signal);
    };

    // ─── Render helpers ─────────────────────────────────────────────────────
    const renderToolbar = (count, onAdd, addLabel, onClear, listToolbarOpts, canAdd = true) => {
        const { onSelectAll, selectAllDisabled, selectAllBusy } = listToolbarOpts || {};
        return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                margin: '8px 0 16px',
                padding: '10px 14px',
                background: 'var(--color-bg-muted, #F8FAFC)',
                border: '1px solid var(--color-border-light, #E5E7EB)',
                borderRadius: 10,
                flexWrap: 'wrap',
            }}
        >
            <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>
                {t('selected')} <span style={{ color: count > 0 ? '#2563EB' : 'inherit' }}>{count}</span>
                {!canAdd && (
                    <span style={{ marginLeft: 10, color: '#94a3b8', fontWeight: 400, fontSize: '0.75rem' }}>
                        {t('readOnlyHint')}
                    </span>
                )}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {canAdd && typeof onSelectAll === 'function' && (
                    <button
                        type="button"
                        className="mc-btn-ghost"
                        disabled={selectAllDisabled || selectAllBusy}
                        onClick={onSelectAll}
                        title={t('tip.selectAll')}
                    >
                        {selectAllBusy ? t('btn.selecting') : t('btn.selectAll')}
                    </button>
                )}
                {canAdd && (
                    <button type="button" className="mc-btn-ghost" disabled={count === 0} onClick={onClear}>
                        {t('btn.clear')}
                    </button>
                )}
                {canAdd && (
                    <button type="button" className="mc-btn-primary blue-btn" disabled={count === 0} onClick={onAdd}>
                        {addLabel}
                    </button>
                )}
            </div>
        </div>
        );
    };

    const renderEmpty = (Icon, message) => (
        <div className="mc-grid-empty">
            <Icon size={48} />
            <p>{message}</p>
        </div>
    );

    const renderLoading = (message) => (
        <div className="mc-grid-loading">
            <RefreshCw className="spin" size={32} />
            <p>{message}</p>
        </div>
    );

    const renderError = (msg) => (
        <div className="mc-grid-empty" style={{ color: '#B91C1C' }}>
            <AlertCircle size={48} />
            <p>{msg}</p>
            <button type="button" className="mc-btn-primary blue-btn" onClick={refreshActive} style={{ marginTop: 8 }}>
                <RefreshCw size={14} /> {t('btn.retry')}
            </button>
        </div>
    );

    const renderDepartmentsTab = () => (
        <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', margin: '6px 0 10px' }}>
                <SubTabToggle
                    value={subTab.departments}
                    counts={deptCounts}
                    onChange={(v) => setSubTab((prev) => ({ ...prev, departments: v }))}
                    t={t}
                />
                <CatalogBranchFilter
                    branchList={branchList}
                    value={catalogBranchScopeId ?? branchScopeId ?? 'all'}
                    onChange={setBranchScopeId}
                    locked={branchPickerLocked}
                    allowAllBranches={allowAllBranches}
                    labelId="mc-catalog-branch-departments"
                    t={t}
                />
            </div>
            {subTab.departments === 'not_added' &&
                renderToolbar(
                    deptSelected.size,
                    openDeptCategoryModal,
                    t('btn.addSelected'),
                    () => setDeptSelected(new Set()),
                    undefined,
                    canAddDept,
                )}
            <div className="mc-product-grid">
                {deptError ? renderError(deptError)
                    : deptLoading ? renderLoading(t('loading.departments'))
                    : deptRows.length === 0 ? renderEmpty(Layers, subTab.departments === 'added' ? t('empty.noDeptsAdded') : t('empty.noDeptsMatch'))
                    : deptRows.map((d) => {
                        const id = String(d.id);
                        const adoptedLabel = subTab.departments === 'added';
                        return (
                            <CatalogCard
                                key={id}
                                row={d}
                                label={t('label.department')}
                                subtitle={d.description || t('subtitle.masterDept')}
                                meta={typeof d.categoriesCount === 'number' ? [{ Icon: Tags, text: t('meta.categoriesCount', { count: d.categoriesCount }) }] : []}
                                selected={deptSelected.has(id)}
                                disabled={adoptedLabel}
                                disabledLabel={t('badge.alreadyAdded')}
                                hint={null}
                                noAdd={!canAddDept}
                                onToggle={() => toggleId(deptSelected, setDeptSelected, id)}
                                t={t}
                                locale={locale}
                            />
                        );
                    })}
            </div>
        </>
    );

    const renderCategoriesTab = () => (
        <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', margin: '6px 0 10px' }}>
                <SubTabToggle
                    value={subTab.categories}
                    counts={catCounts}
                    onChange={(v) => setSubTab((prev) => ({ ...prev, categories: v }))}
                    t={t}
                />
                <CatalogBranchFilter
                    branchList={branchList}
                    value={catalogBranchScopeId ?? branchScopeId ?? 'all'}
                    onChange={setBranchScopeId}
                    locked={branchPickerLocked}
                    allowAllBranches={allowAllBranches}
                    labelId="mc-catalog-branch-categories"
                    t={t}
                />
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Filter size={14} />
                    <select
                        value={catFilter.departmentId}
                        onChange={(e) => setCatFilter((f) => ({ ...f, departmentId: e.target.value }))}
                        style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: '0.875rem' }}
                    >
                        <option value="all">{t('filter.allDepartments')}</option>
                        {departmentOptions.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </select>
                </div>
                <select
                    value={catFilter.type}
                    onChange={(e) => setCatFilter((f) => ({ ...f, type: e.target.value }))}
                    style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: '0.875rem' }}
                >
                    <option value="all">{t('filter.allTypes')}</option>
                    <option value="product">{t('type.product')}</option>
                    <option value="service">{t('type.service')}</option>
                </select>
            </div>
            {subTab.categories === 'not_added' &&
                renderToolbar(
                    catSelected.size,
                    openCategoryAdopt,
                    t('btn.addSelected'),
                    () => setCatSelected(new Set()),
                    undefined,
                    canAddCat,
                )}
            <div className="mc-product-grid">
                {catError ? renderError(catError)
                    : catLoading ? renderLoading(t('loading.categories'))
                    : catRows.length === 0 ? renderEmpty(Tags, subTab.categories === 'added' ? t('empty.noCatsAdded') : t('empty.noCatsMatch'))
                    : catRows.map((c) => {
                        const id = String(c.id);
                        const deptName = c.departmentName || c.department?.name || departmentOptions.find((d) => d.id === String(c.departmentId))?.name;
                        const adoptedLabel = subTab.categories === 'added';
                        return (
                            <CatalogCard
                                key={id}
                                row={c}
                                label={
                                    String(c.type || '').toLowerCase() === 'product' ? t('label.typeProduct')
                                    : String(c.type || '').toLowerCase() === 'service' ? t('label.typeService')
                                    : t('label.typeCategory')
                                }
                                subtitle={deptName ? t('subtitle.deptNamed', { name: deptName }) : t('label.category')}
                                meta={[]}
                                selected={catSelected.has(id)}
                                disabled={adoptedLabel}
                                disabledLabel={t('badge.alreadyAdded')}
                                hint={null}
                                noAdd={!canAddCat}
                                onToggle={() => toggleId(catSelected, setCatSelected, id)}
                                t={t}
                                locale={locale}
                            />
                        );
                    })}
            </div>
        </>
    );

    const renderListTab = ({
        rows, loading, error, selected, setSelected,
        filter, setFilter, qInput, setQInput,
        page, setPage, total,
        serverHasNext,
        kind,
        onSelectAllAllPages,
        selectAllBusy,
        canAdd = true,
    }) => {
        const totalPagesKnown = total > 0 ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : null;
        // Next: honor explicit hasNext; else known total pages; else if this page is full, allow probing
        // (APIs often omit hasNext / misreport total when it equals page size).
        const canGoNext =
            serverHasNext === false
                ? false
                : serverHasNext === true
                  ? true
                  : totalPagesKnown != null && page < totalPagesKnown
                    ? true
                    : rows.length === PAGE_SIZE;
        const canGoPrev = page > 1;
        const Icon = kind === 'product' ? Package : Wrench;
        const subtitleFn = (row) => {
            const dept = row.departmentName || row.department?.name;
            const cat = row.categoryName || row.category?.name;
            return [dept, cat].filter(Boolean).join(' · ') || t('subtitle.masterCatalog');
        };
        const metaFn = (row) => {
            const list = [];
            if (row.sku) list.push({ Icon: Tags, text: row.sku });
            if (kind === 'product' && row.brandName) list.push({ Icon: Layers, text: row.brandName });
            if (kind === 'product') {
                const kmRaw = row.kmTypeValue ?? row.km_type_value;
                if (kmRaw != null && String(kmRaw).trim() !== '') {
                    const kmNum = Number(kmRaw);
                    if (Number.isFinite(kmNum)) {
                        list.push({ Icon: Gauge, text: t('meta.kmType', { value: kmNum }) });
                    }
                }
            }
            const exRaw =
                kind === 'product'
                    ? row.salePriceBeforeVat ?? row.sale_price_before_vat
                    : row.sellingPriceBeforeVat ?? row.selling_price_before_vat;
            const exNum = exRaw != null && exRaw !== '' ? Number(exRaw) : 0;
            const fallback =
                kind === 'product'
                    ? Number(row.salePrice ?? row.basePrice ?? 0)
                    : Number(row.sellingPrice ?? 0);
            const priceLabel =
                exNum > 0
                    ? t('money.sarExVat', { amount: exNum.toLocaleString() })
                    : fallback > 0
                      ? t('money.sar', { amount: fallback.toLocaleString() })
                      : null;
            if (priceLabel) list.push({ Icon: undefined, text: priceLabel });
            const createdRaw = row.createdAt ?? row.created_at;
            const createdFmt = formatCatalogListCreatedAt(createdRaw, locale);
            if (createdFmt) list.push({ Icon: Calendar, text: t('meta.created', { date: createdFmt }) });
            const vatRaw = row.vatMode ?? row.vat_mode;
            if (vatRaw != null && String(vatRaw).trim() !== '') {
                list.push({ Icon: Percent, text: t('meta.vatMode', { mode: vatRaw }) });
            }
            return list;
        };
        return (
            <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', margin: '6px 0 10px' }}>
                    <SubTabToggle
                        value={kind === 'product' ? subTab.products : subTab.services}
                        counts={kind === 'product' ? prodCounts : svcCounts}
                        onChange={(v) => setSubTab((prev) => ({ ...prev, [kind === 'product' ? 'products' : 'services']: v }))}
                        t={t}
                    />
                    <CatalogBranchFilter
                        branchList={branchList}
                        value={catalogBranchScopeId ?? branchScopeId ?? 'all'}
                        onChange={setBranchScopeId}
                        locked={branchPickerLocked}
                        allowAllBranches={allowAllBranches}
                        labelId={`mc-catalog-branch-${kind}`}
                        t={t}
                    />
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
                        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.6 }} />
                        <input
                            type="text"
                            placeholder={kind === 'product' ? t('search.products') : t('search.services')}
                            value={qInput}
                            onChange={(e) => setQInput(e.target.value)}
                            style={{ width: '100%', padding: '8px 12px 8px 30px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: '0.875rem' }}
                        />
                    </div>
                    <select
                        value={filter.departmentId}
                        onChange={(e) => setFilter((f) => ({ ...f, departmentId: e.target.value, categoryId: 'all' }))}
                        style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: '0.875rem' }}
                    >
                        <option value="all">{t('filter.allDepartments')}</option>
                        {departmentOptions.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </select>
                </div>
                {(kind === 'product' ? subTab.products : subTab.services) === 'not_added' &&
                    renderToolbar(
                        selected.size,
                        kind === 'product' ? openProductAdopt : openServiceAdopt,
                        t('btn.addSelected'),
                        () => setSelected(new Set()),
                        typeof onSelectAllAllPages === 'function'
                            ? {
                                  onSelectAll: onSelectAllAllPages,
                                  selectAllBusy: !!selectAllBusy,
                                  selectAllDisabled: loading || !!error || rows.length === 0,
                              }
                            : undefined,
                        canAdd,
                    )}
                <div className="mc-product-grid">
                    {error ? renderError(error)
                        : loading ? renderLoading(kind === 'product' ? t('loading.products') : t('loading.services'))
                        : rows.length === 0 ? renderEmpty(
                            Icon,
                            (kind === 'product' ? subTab.products : subTab.services) === 'added'
                                ? (kind === 'product' ? t('empty.noProductsAdded') : t('empty.noServicesAdded'))
                                : (kind === 'product' ? t('empty.noProductsMatch') : t('empty.noServicesMatch')),
                        )
                        : rows.map((row) => {
                            const id = String(row.id);
                            const adoptedLabel =
                                (kind === 'product' ? subTab.products : subTab.services) === 'added';
                            const masterInactive = row.isActive === false;
                            return (
                                <CatalogCard
                                    key={id}
                                    row={row}
                                    label={kind === 'product' ? t('label.product') : t('label.service')}
                                    subtitle={subtitleFn(row)}
                                    meta={metaFn(row)}
                                    selected={selected.has(id)}
                                    disabled={adoptedLabel || masterInactive}
                                    disabledLabel={masterInactive ? t('status.inactive') : t('badge.alreadyAdded')}
                                    hint={null}
                                    noAdd={!canAdd}
                                    onToggle={() => toggleId(selected, setSelected, id)}
                                    t={t}
                                    locale={locale}
                                />
                            );
                        })}
                </div>
                {!loading && (rows.length > 0 || page > 1) && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 16 }}>
                        <button type="button" className="mc-btn-ghost" disabled={!canGoPrev} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                            <ChevronLeft size={14} /> {t('btn.previous')}
                        </button>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                            {totalPagesKnown != null ? (
                                <>{t('page.of', { page, totalPages: totalPagesKnown, total })}</>
                            ) : (
                                <>
                                    {t('page.simple', { page })}
                                    {rows.length === PAGE_SIZE ? t('page.fullPage') : ''}
                                    {t('page.mid', { loaded: (page - 1) * PAGE_SIZE + rows.length })}
                                    {rows.length === PAGE_SIZE ? t('page.loadedMore') : t('page.loaded')}
                                </>
                            )}
                        </span>
                        <button type="button" className="mc-btn-ghost" disabled={!canGoNext} onClick={() => setPage((p) => p + 1)}>
                            {t('btn.next')} <ChevronRight size={14} />
                        </button>
                    </div>
                )}
            </>
        );
    };

    if (deptCatModal) {
        return (
            <CategorySelectionScreen
                state={deptCatModal}
                onChange={setDeptCatModal}
                onClose={() => setDeptCatModal(null)}
                onSubmit={submitDepartmentsAdopt}
                branches={branchList}
                backLabel={t('back.departments')}
                t={t}
            />
        );
    }

    if (categoryAdopt) {
        return (
            <CategoryAdoptScreen
                state={categoryAdopt}
                onChange={setCategoryAdopt}
                onClose={() => setCategoryAdopt(null)}
                onSubmit={submitCategoriesAdopt}
                branches={branchList}
                backLabel={t('back.categories')}
                t={t}
            />
        );
    }

    if (productAdopt) {
        return (
            <ProductAdoptScreen
                state={productAdopt}
                onChange={setProductAdopt}
                onClose={() => setProductAdopt(null)}
                onSubmit={submitProductsAdopt}
                branches={branchList}
                backLabel={t('back.products')}
                t={t}
            />
        );
    }

    if (serviceAdopt) {
        return (
            <ServiceAdoptScreen
                state={serviceAdopt}
                onChange={setServiceAdopt}
                onClose={() => setServiceAdopt(null)}
                onSubmit={submitServicesAdopt}
                branches={branchList}
                backLabel={t('back.services')}
                t={t}
            />
        );
    }

    return (
        <div className="mc-container">
            <div className="mc-header">
                <div className="mc-title-group">
                    <h1>{t('page.title')}</h1>
                    <p style={{ marginBottom: 0 }}>
                        {t('page.subtitle')}
                    </p>
                </div>
                <div className="mc-header-actions">
                    <button type="button" className="mc-btn-ghost" onClick={refreshActive}>
                        <RefreshCw size={16} /> {t('btn.refresh')}
                    </button>
                </div>
            </div>

            <div className="mc-tabs">
                {visibleTabs.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        className={`mc-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        <tab.Icon size={16} />
                        {t(tab.labelKey)}
                    </button>
                ))}
                {visibleTabs.length === 0 && (
                    <div style={{ padding: 20, color: '#94a3b8', fontSize: '0.875rem' }}>
                        {t('page.noPermission')}
                    </div>
                )}
            </div>

            <ResultBanner banner={banner} onClose={() => setBanner(null)} t={t} />

            <div key={activeTab}>
                {!isCatalogBranchReady ? renderLoading(t('loading.catalog')) : null}
                {isCatalogBranchReady && activeTab === 'departments' && renderDepartmentsTab()}
                {isCatalogBranchReady && activeTab === 'categories' && renderCategoriesTab()}
                {isCatalogBranchReady && activeTab === 'products' && renderListTab({
                    rows: prodRows, loading: prodLoading, error: prodError,
                    selected: prodSelected, setSelected: setProdSelected,
                    filter: prodFilter, setFilter: setProdFilter,
                    qInput: prodQInput, setQInput: setProdQInput,
                    page: prodPage, setPage: setProdPage, total: prodTotal,
                    serverHasNext: prodHasNext,
                    kind: 'product',
                    onSelectAllAllPages: handleSelectAllProducts,
                    selectAllBusy: prodSelectAllBusy,
                    canAdd: canAddProd,
                })}
                {isCatalogBranchReady && activeTab === 'services' && renderListTab({
                    rows: svcRows, loading: svcLoading, error: svcError,
                    selected: svcSelected, setSelected: setSvcSelected,
                    filter: svcFilter, setFilter: setSvcFilter,
                    qInput: svcQInput, setQInput: setSvcQInput,
                    page: svcPage, setPage: setSvcPage, total: svcTotal,
                    serverHasNext: svcHasNext,
                    kind: 'service',
                    onSelectAllAllPages: handleSelectAllServices,
                    selectAllBusy: svcSelectAllBusy,
                    canAdd: canAddSvc,
                })}
            </div>
        </div>
    );
}

/* ─── Adopt sub-screens ─────────────────────────────────────────────────── */

/**
 * Reusable branch-target multi-select.
 * `scopeOnly` — only branches passed in `branches` (role / sidebar scope).
 * Empty value with scopeOnly=false lets the BE adopt to every workshop branch.
 */
function BranchTargetPicker({ branches, value, onChange, scopeOnly = false, t }) {
    const scopedIds = branches.map((b) => String(b.id));
    const allSelected = scopeOnly
        ? scopedIds.length > 0 && scopedIds.every((id) => value.includes(id))
        : !value || value.length === 0;
    const setAll = () => onChange(scopeOnly ? [...scopedIds] : []);
    const togglePick = (branchId) => {
        const id = String(branchId);
        if (allSelected) {
            onChange([id]);
            return;
        }
        const next = value.includes(id) ? value.filter((v) => v !== id) : [...value, id];
        onChange(next);
    };
    return (
        <div style={{ padding: 12, border: '1px solid var(--color-border-light, #E5E7EB)', borderRadius: 8 }}>
            <div style={{ fontWeight: 700, marginBottom: 8, fontSize: '0.875rem' }}>
                {t('branchTarget.title')}
            </div>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.875rem', fontWeight: allSelected ? 700 : 500 }}>
                <input type="radio" checked={allSelected} onChange={setAll} />
                {scopeOnly ? t('branchTarget.allAccessible') : t('branchTarget.allWorkshop')}
            </label>
            <div style={{ marginTop: 8 }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.875rem', fontWeight: !allSelected ? 700 : 500 }}>
                    <input
                        type="radio"
                        checked={!allSelected}
                        onChange={() => onChange(branches.length > 0 ? [String(branches[0].id)] : [])}
                    />
                    {t('branchTarget.specific')}
                </label>
            </div>
            {!allSelected && (
                <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6, paddingLeft: 24 }}>
                    {branches.length === 0 ? (
                        <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0 }}>
                            {t('branchTarget.noneFound')}
                        </p>
                    ) : (
                        branches.map((b) => {
                            const id = String(b.id);
                            return (
                                <label key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.875rem', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={value.includes(id)} onChange={() => togglePick(id)} />
                                    {b.name}
                                </label>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}

function CategoryAdoptScreen({ state, onChange, onClose, onSubmit, branches, backLabel, t }) {
    const count = state.ids.length;
    return (
        <WorkshopSubScreen
            title={count === 1 ? t('catAdopt.titleOne', { count }) : t('catAdopt.titleMany', { count })}
            subtitle={t('catAdopt.subtitle')}
            backLabel={backLabel}
            onBack={onClose}
            backDisabled={state.loading}
            size="form"
            footer={(
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', width: '100%' }}>
                    <button type="button" className="mc-btn-ghost mc-btn-large" onClick={onClose} disabled={state.loading}>
                        {t('btn.cancel')}
                    </button>
                    <button type="button" className="mc-btn-primary blue-btn mc-btn-large" onClick={onSubmit} disabled={state.loading}>
                        {state.loading ? t('btn.adding') : t('btn.add')}
                    </button>
                </div>
            )}
        >
            <div className="ws-section" style={{ padding: 20 }}>
                {state.error && (
                    <div style={{ padding: 10, background: '#FEE2E2', color: '#B91C1C', borderRadius: 8, fontSize: '0.875rem', marginBottom: 12 }}>
                        {state.error}
                    </div>
                )}
                <BranchTargetPicker
                    branches={branches}
                    value={state.targetBranchIds}
                    onChange={(v) => onChange((prev) => prev && { ...prev, targetBranchIds: v })}
                    scopeOnly
                    t={t}
                />
            </div>
        </WorkshopSubScreen>
    );
}

function CategorySelectionScreen({ state, onChange, onClose, onSubmit, branches, backLabel, t }) {
    return (
        <WorkshopSubScreen
            title={t('catSel.title')}
            subtitle={t('catSel.subtitle')}
            backLabel={backLabel}
            onBack={onClose}
            backDisabled={state.loading}
            size="full"
            footer={(
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', width: '100%' }}>
                    <button type="button" className="mc-btn-ghost mc-btn-large" onClick={onClose} disabled={state.loading}>
                        {t('btn.cancel')}
                    </button>
                    <button type="button" className="mc-btn-primary blue-btn mc-btn-large" onClick={onSubmit} disabled={state.loading}>
                        {state.loading ? t('btn.adding') : t('btn.addToWorkshop')}
                    </button>
                </div>
            )}
        >
            <div className="ws-section" style={{ padding: 20 }}>
                {state.error && (
                    <div style={{ padding: 10, background: '#FEE2E2', color: '#B91C1C', borderRadius: 8, fontSize: '0.875rem', marginBottom: 12 }}>
                        {state.error}
                    </div>
                )}
                <div style={{ marginBottom: 14 }}>
                    <BranchTargetPicker
                        branches={branches}
                        value={state.targetBranchIds}
                        onChange={(v) => onChange((prev) => prev && { ...prev, targetBranchIds: v })}
                        scopeOnly
                        t={t}
                    />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {state.departments.map((d) => {
                        const sel = state.selections[String(d.id)] || { mode: 'all', pickedIds: new Set(), categories: [] };
                        const setMode = (mode) =>
                            onChange((prev) => prev && {
                                ...prev,
                                selections: {
                                    ...prev.selections,
                                    [String(d.id)]: { ...prev.selections[String(d.id)], mode },
                                },
                            });
                        const togglePick = (catId) =>
                            onChange((prev) => {
                                if (!prev) return prev;
                                const cur = prev.selections[String(d.id)];
                                const next = new Set(cur.pickedIds);
                                const key = String(catId);
                                if (next.has(key)) next.delete(key);
                                else next.add(key);
                                return {
                                    ...prev,
                                    selections: {
                                        ...prev.selections,
                                        [String(d.id)]: { ...cur, pickedIds: next, mode: 'pick' },
                                    },
                                };
                            });
                        return (
                            <div key={String(d.id)} style={{ border: '1px solid var(--color-border-light, #E5E7EB)', borderRadius: 10, padding: 12 }}>
                                <div style={{ fontWeight: 700, marginBottom: 8 }}>{d.name}</div>
                                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 8 }}>
                                    {['all', 'pick', 'none'].map((m) => (
                                        <label key={m} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.875rem', cursor: 'pointer' }}>
                                            <input
                                                type="radio"
                                                name={`dept-${d.id}-mode`}
                                                checked={sel.mode === m}
                                                onChange={() => setMode(m)}
                                            />
                                            {m === 'all' ? t('catSel.allCats') : m === 'pick' ? t('catSel.pickCats') : t('catSel.noCats')}
                                        </label>
                                    ))}
                                </div>
                                {sel.mode === 'pick' && (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6 }}>
                                        {(sel.categories || []).length === 0 ? (
                                            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0 }}>{t('catSel.noCatsAvailable')}</p>
                                        ) : (
                                            sel.categories.map((c) => (
                                                <label key={String(c.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.875rem', cursor: 'pointer' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={sel.pickedIds.has(String(c.id))}
                                                        onChange={() => togglePick(c.id)}
                                                    />
                                                    {c.name}
                                                </label>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </WorkshopSubScreen>
    );
}

function MissingDependenciesList({ missing, t }) {
    const hasAny = (missing.departments?.length || 0) + (missing.categories?.length || 0) > 0;
    if (!hasAny) {
        return (
            <div style={{ padding: 10, background: '#ECFDF5', color: '#047857', borderRadius: 8, fontSize: '0.875rem' }}>
                {t('deps.ok')}
            </div>
        );
    }
    return (
        <div style={{ padding: 12, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, fontSize: '0.875rem' }}>
            <strong>{t('deps.willAlso')}</strong>
            {missing.departments?.length > 0 && (
                <div style={{ marginTop: 6 }}>
                    <div style={{ fontWeight: 700 }}>{t('deps.departments', { count: missing.departments.length })}</div>
                    <div>{missing.departments.map((d) => d.name).join(', ')}</div>
                </div>
            )}
            {missing.categories?.length > 0 && (
                <div style={{ marginTop: 6 }}>
                    <div style={{ fontWeight: 700 }}>{t('deps.categories', { count: missing.categories.length })}</div>
                    <div>{missing.categories.map((c) => c.name).join(', ')}</div>
                </div>
            )}
        </div>
    );
}

function ProductAdoptScreen({ state, onChange, onClose, onSubmit, branches, backLabel, t }) {
    const count = state.rows.length;
    return (
        <WorkshopSubScreen
            title={count === 1 ? t('prodAdopt.titleOne', { count }) : t('prodAdopt.titleMany', { count })}
            subtitle={t('prodAdopt.subtitle')}
            backLabel={backLabel}
            onBack={onClose}
            backDisabled={state.loading}
            size="xl"
            footer={(
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', width: '100%' }}>
                    <button type="button" className="mc-btn-ghost mc-btn-large" onClick={onClose} disabled={state.loading}>
                        {t('btn.cancel')}
                    </button>
                    <button type="button" className="mc-btn-primary blue-btn mc-btn-large" onClick={onSubmit} disabled={state.loading}>
                        {state.loading ? t('btn.adding') : t('btn.addToWorkshop')}
                    </button>
                </div>
            )}
        >
            <div className="ws-section" style={{ padding: 20 }}>
                {state.error && (
                    <div style={{ padding: 10, background: '#FEE2E2', color: '#B91C1C', borderRadius: 8, fontSize: '0.875rem', marginBottom: 12 }}>
                        {state.error}
                    </div>
                )}

                {state.resolveNote ? (
                    <div style={{ padding: 10, background: '#FFFBEB', color: '#92400E', borderRadius: 8, fontSize: '0.875rem', marginBottom: 12 }}>
                        {state.resolveNote}
                    </div>
                ) : null}

                {state.loading && (state.missing.departments.length === 0 && state.missing.categories.length === 0) ? (
                    <div className="mc-grid-loading"><RefreshCw className="spin" size={24} /> <p>{t('loading.deps')}</p></div>
                ) : (
                    <>
                        <MissingDependenciesList missing={state.missing} t={t} />

                        <div style={{ marginTop: 14 }}>
                            <BranchTargetPicker
                                branches={branches}
                                value={state.targetBranchIds}
                                onChange={(v) => onChange((prev) => prev && { ...prev, targetBranchIds: v })}
                                scopeOnly
                                t={t}
                            />
                        </div>

                        <div style={{ marginTop: 14, padding: 12, border: '1px solid var(--color-border-light, #E5E7EB)', borderRadius: 8 }}>
                            <div style={{ fontWeight: 700, marginBottom: 4, fontSize: '0.875rem' }}>
                                {t('prodAdopt.criticalTitle')}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: 10 }}>
                                {t('prodAdopt.criticalHint')}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'end', padding: '8px 10px', background: 'var(--color-bg-muted, #F9FAFB)', borderRadius: 6, marginBottom: 10 }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('prodAdopt.applyAll')}</div>
                                <input
                                    type="number"
                                    min="0"
                                    placeholder={t('prodAdopt.criticalPh')}
                                    value={state.bulkCriticalStockPoint ?? ''}
                                    onChange={(e) => onChange((prev) => prev && { ...prev, bulkCriticalStockPoint: e.target.value })}
                                    style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--color-border)', width: 90, fontSize: '0.8125rem' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => onChange((prev) => prev && {
                                        ...prev,
                                        items: prev.items.map((it) => ({
                                            ...it,
                                            criticalStockPoint: prev.bulkCriticalStockPoint !== '' && prev.bulkCriticalStockPoint != null ? prev.bulkCriticalStockPoint : it.criticalStockPoint,
                                        })),
                                    })}
                                    style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--color-border)', background: '#fff', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}
                                >
                                    {t('btn.apply')}
                                </button>
                            </div>

                            <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 6 }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                    <thead>
                                        <tr style={{ background: 'var(--color-bg-muted, #F9FAFB)', textAlign: 'left' }}>
                                            <th style={{ padding: '8px 10px', fontWeight: 700 }}>{t('th.product')}</th>
                                            <th style={{ padding: '8px 10px', fontWeight: 700, width: 130 }}>{t('th.criticalStock')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(state.items || []).map((it, idx) => (
                                            <tr key={it.productId} style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--color-border)' }}>
                                                <td style={{ padding: '8px 10px' }}>{it.name}</td>
                                                <td style={{ padding: '6px 10px' }}>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        placeholder="0"
                                                        value={it.criticalStockPoint}
                                                        onChange={(e) => {
                                                            const v = e.target.value;
                                                            onChange((prev) => prev && {
                                                                ...prev,
                                                                items: prev.items.map((row, i) => i === idx ? { ...row, criticalStockPoint: v } : row),
                                                            });
                                                        }}
                                                        style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--color-border)', width: '100%', fontSize: '0.8125rem' }}
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </WorkshopSubScreen>
    );
}

function ServiceAdoptScreen({ state, onChange, onClose, onSubmit, branches, backLabel, t }) {
    const count = state.rows.length;
    const names = state.rows.map((r) => r.name).slice(0, 5).join(', ');
    const more = state.rows.length > 5 ? t('svcAdopt.andMore', { n: state.rows.length - 5 }) : '';
    return (
        <WorkshopSubScreen
            title={count === 1 ? t('svcAdopt.titleOne', { count }) : t('svcAdopt.titleMany', { count })}
            subtitle={t('svcAdopt.subtitle')}
            backLabel={backLabel}
            onBack={onClose}
            backDisabled={state.loading}
            size="wide"
            footer={(
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', width: '100%' }}>
                    <button type="button" className="mc-btn-ghost mc-btn-large" onClick={onClose} disabled={state.loading}>
                        {t('btn.cancel')}
                    </button>
                    <button type="button" className="mc-btn-primary blue-btn mc-btn-large" onClick={onSubmit} disabled={state.loading}>
                        {state.loading ? t('btn.adding') : t('btn.addToWorkshop')}
                    </button>
                </div>
            )}
        >
            <div className="ws-section" style={{ padding: 20 }}>
                {state.error && (
                    <div style={{ padding: 10, background: '#FEE2E2', color: '#B91C1C', borderRadius: 8, fontSize: '0.875rem', marginBottom: 12 }}>
                        {state.error}
                    </div>
                )}

                {state.resolveNote ? (
                    <div style={{ padding: 10, background: '#FFFBEB', color: '#92400E', borderRadius: 8, fontSize: '0.875rem', marginBottom: 12 }}>
                        {state.resolveNote}
                    </div>
                ) : null}

                {state.loading && (state.missing.departments.length === 0 && state.missing.categories.length === 0) ? (
                    <div className="mc-grid-loading"><RefreshCw className="spin" size={24} /> <p>{t('loading.deps')}</p></div>
                ) : (
                    <>
                        <MissingDependenciesList missing={state.missing} t={t} />
                        <div style={{ marginTop: 14 }}>
                            <BranchTargetPicker
                                branches={branches}
                                value={state.targetBranchIds}
                                onChange={(v) => onChange((prev) => prev && { ...prev, targetBranchIds: v })}
                                scopeOnly
                                t={t}
                            />
                        </div>
                        <div style={{ marginTop: 14, fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                            {t('svcAdopt.beingAdded', { names, more })}
                        </div>
                    </>
                )}
            </div>
        </WorkshopSubScreen>
    );
}
