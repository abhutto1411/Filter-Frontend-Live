import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
    Download,
    Loader,
    Package,
    Pencil,
    Search,
    TrendingDown,
    TrendingUp,
    LayoutGrid,
    ListTree,
    X,
} from 'lucide-react';
import Modal from '../Modal';
import UniversalTabs from '../UniversalTabs';
import {
    getBranches,
    getSuperAdminInventoryLedger,
    getSuperAdminInventoryProductMovements,
    getSuperAdminInventoryProducts,
    patchSuperAdminInventoryProductStartingStock,
    getWorkshopOptions,
} from '../../services/superAdminApi';

const GRID_LIMIT = 50;
const MOVEMENT_LIMIT = 100;
const LEDGER_LIMIT = 50;
/** Same cap as workshop Manage Inventory search suggestions. */
const INV_SEARCH_SUGGEST_LIMIT = 12;
/** Backend max page size for super-admin branch inventory list. */
const CATALOG_PAGE_LIMIT = 200;

/** Plain-language note: summary vs paginated table. */
const SUMMARY_VS_ENTRIES_HINT =
    'The totals in the boxes above count every movement that matches your dates and this branch—not only the rows you see in the table. The table shows one page at a time; use Next / Previous to see more.';

function unwrapData(res) {
    if (res && typeof res === 'object' && res.data != null && res.success !== false) return res.data;
    return res;
}

/** Same shape handling as EmployeesPage — options often live under `data.options`. */
function pickArray(res, keys = []) {
    if (Array.isArray(res)) return res;
    for (const key of keys) {
        if (Array.isArray(res?.[key])) return res[key];
        if (Array.isArray(res?.data?.[key])) return res.data[key];
    }
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray(res?.items)) return res.items;
    if (Array.isArray(res?.data?.items)) return res.data.items;
    return [];
}

function normalizeWorkshop(w) {
    return {
        id: String(w?.id ?? w?.value ?? w?.workshopId ?? ''),
        name: w?.name ?? w?.label ?? w?.workshopName ?? `Workshop ${w?.id ?? w?.workshopId ?? ''}`,
        status: String(w?.status ?? '').toLowerCase(),
    };
}

function normalizeBranch(b) {
    return {
        id: String(b?.id ?? b?._id ?? ''),
        name: b?.name ?? '—',
    };
}

function formatNum(n) {
    if (n == null || Number.isNaN(Number(n))) return '—';
    return Number(n).toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function formatRef(ref) {
    if (ref == null) return '—';
    if (typeof ref === 'object') {
        const t = ref.type != null ? String(ref.type) : '';
        const id = ref.id != null ? String(ref.id) : '';
        if (t && id) return `${t} #${id}`;
        return JSON.stringify(ref);
    }
    return String(ref);
}

/** Reference column: keep type + id on one horizontal line (no stacked/overlapping pills). */
function ReferencePills({ value }) {
    if (value == null) return '—';
    if (typeof value === 'object' && !Array.isArray(value)) {
        const t = value.type != null ? String(value.type) : '';
        const id = value.id != null ? String(value.id) : '';
        if (t && id) {
            return (
                <span className="reference-pill-group">
                    <span className="reference-pill">{t}</span>
                    <span className="reference-pill reference-pill-id">#{id}</span>
                </span>
            );
        }
        return <span className="reference-pill reference-pill-single">{formatRef(value)}</span>;
    }
    return <span className="reference-pill reference-pill-single">{String(value)}</span>;
}

function formatDt(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return iso;
    }
}

/** Ledger row time — backend may send ISO fields or sortAt (number/ms or numeric string). */
function formatLedgerWhen(ev) {
    if (!ev || typeof ev !== 'object') return '—';
    const iso = ev.createdAt ?? ev.occurredAt ?? ev.at;
    if (iso) return formatDt(iso);
    const s = ev.sortAt;
    if (typeof s === 'number' && !Number.isNaN(s)) return formatDt(new Date(s).toISOString());
    if (typeof s === 'string' && /^\d+$/.test(s)) return formatDt(new Date(Number(s)).toISOString());
    return '—';
}

function ledgerKindBadgeClass(kind) {
    const k = String(kind || '').toLowerCase();
    if (k === 'sale') return 'movement-badge badge-sale';
    if (k === 'purchase') return 'movement-badge badge-purchase';
    if (k === 'transfer') return 'movement-badge badge-transfer';
    if (k === 'adjustment') return 'movement-badge badge-adjustment';
    return 'movement-badge badge-other';
}

/** Avoid React "objects are not valid as a child" when API returns nested entities (e.g. actor: { id, name }). */
function displayCell(v) {
    if (v == null || v === '') return '—';
    const t = typeof v;
    if (t === 'string' || t === 'number' || t === 'bigint' || t === 'boolean') return String(v);
    if (t === 'object') {
        if (Array.isArray(v)) return v.length ? v.map(displayCell).join(', ') : '—';
        if (typeof v.name === 'string' && v.name) return v.name;
        if (typeof v.label === 'string' && v.label) return v.label;
        if (v.name != null && typeof v.name !== 'object') return String(v.name);
        if (v.id != null) return String(v.id);
        const full = [v.firstName, v.lastName].filter(Boolean).join(' ');
        if (full) return full;
        try {
            const s = JSON.stringify(v);
            return s.length > 120 ? `${s.slice(0, 117)}…` : s;
        } catch {
            return '—';
        }
    }
    return String(v);
}

/** Same token search as workshop Manage Inventory (`WorkshopInventory.jsx`). */
function normalizeInventorySearchValue(value) {
    if (value == null) return '';
    let s = String(value);
    try {
        if (typeof s.normalize === 'function') {
            s = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
        }
    } catch {
        /* ignore */
    }
    return s.toLowerCase().trim();
}

function buildRawInventorySearchText(...sources) {
    const fields = [];
    for (const source of sources) {
        if (!source || typeof source !== 'object') continue;
        fields.push(
            source.name,
            source.productName,
            source.product_name,
            source.itemName,
            source.item_name,
            source.title,
            source.sku,
            source.code,
            source.barcode,
            source.partNumber,
            source.part_number,
            source.brand,
            source.brandName,
            source.departmentName,
            source.department_name,
            source.department?.name,
            source.categoryName,
            source.category_name,
            source.category?.name,
            source.id,
            source.productId,
            source.product_id,
        );
    }
    return fields.map(normalizeInventorySearchValue).filter(Boolean).join(' ');
}

function buildInventorySearchText(row) {
    const fields = [
        row?._searchText,
        row?.name,
        row?.productName,
        row?.product_name,
        row?.itemName,
        row?.item_name,
        row?.sku,
        row?.code,
        row?.barcode,
        row?.partNumber,
        row?.part_number,
        row?.brand,
        row?.brandName,
        row?.departmentName,
        row?.department_name,
        row?.categoryName,
        row?.category_name,
        row?.id,
        row?.productId,
    ];
    return fields
        .map(normalizeInventorySearchValue)
        .filter(Boolean)
        .join(' ');
}

function matchesProductNameSearch(row, query) {
    const q = normalizeInventorySearchValue(query);
    if (!q) return true;
    const hay = normalizeInventorySearchValue(buildInventorySearchText(row));
    if (!hay) return false;
    return q
        .split(/\s+/)
        .filter(Boolean)
        .every((term) => hay.includes(term));
}

/** Value written into the search field when a suggestion is chosen (matches token search). */
function inventorySearchValueFromRow(row) {
    const name = String(row?.name ?? '').trim();
    const sku = String(row?.sku ?? '').trim();
    return [name, sku].filter(Boolean).join(' ').trim() || name || sku || '';
}

function toInventorySearchRow(p) {
    if (!p || typeof p !== 'object') return p;
    return {
        ...p,
        brand: p.brandName ?? p.brand ?? '',
        _searchText: buildRawInventorySearchText(p),
    };
}

/** API movement codes → short labels for the history modal. Hover shows the raw code. */
const MOVEMENT_KIND_LABELS = {
    invoice_sale: 'Sale on invoice',
    manual_adjustment: 'Manual stock change',
    transfer_out: 'Sent out (transfer)',
    transfer_in: 'Received (transfer)',
    consumption: 'Used in workshop',
    wastage: 'Wastage',
    damage_out: 'Damage / write-off',
    adjustment_out: 'Stock down (adjustment)',
    adjustment_in: 'Stock up (adjustment)',
    grn: 'Goods received',
    purchase: 'Purchase / receipt',
    invoice_return: 'Return on invoice',
};

const MOVEMENT_SOURCE_LABELS = {
    inventory_movement: 'Sales & stock system',
    manual: 'Entered by staff',
    manual_adjustment: 'Manual entry',
    super_admin_starting_stock: 'Super admin (starting / opening stock)',
};

function humanizeMovementKind(raw) {
    let s = '';
    if (raw == null || raw === '') return '—';
    if (typeof raw === 'string' || typeof raw === 'number') s = String(raw).trim();
    else s = displayCell(raw).trim();
    if (!s || s === '—') return '—';
    const k = s.toLowerCase();
    if (MOVEMENT_KIND_LABELS[k]) return MOVEMENT_KIND_LABELS[k];
    return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function humanizeMovementSource(raw) {
    let s = '';
    if (raw == null || raw === '') return '—';
    if (typeof raw === 'string' || typeof raw === 'number') s = String(raw).trim();
    else s = displayCell(raw).trim();
    if (!s || s === '—') return '—';
    const k = s.toLowerCase();
    if (MOVEMENT_SOURCE_LABELS[k]) return MOVEMENT_SOURCE_LABELS[k];
    return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Prefer human reason for manual rows (e.g. super-admin opening change); else movement kind label. */
function movementWhatHappenedLabel(e) {
    if (!e || typeof e !== 'object') return '—';
    const mt = String(e.movementType || '').toLowerCase();
    const r = e.reason != null && String(e.reason).trim() !== '' ? String(e.reason).trim() : '';
    if (mt === 'manual_adjustment' && r) return r;
    return humanizeMovementKind(e.movementType);
}

function downloadCsv(filename, rows, headers) {
    const esc = (v) => {
        const s = v == null ? '' : String(v);
        if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
    };
    const lines = [headers.map(esc).join(',')];
    for (const row of rows) lines.push(row.map(esc).join(','));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

/** Main label is easy to read; technical field name only in tooltip for support. */
function GridQtyTh({ label, apiField }) {
    return (
        <th className="table-th" title={apiField ? `System field: ${apiField}` : undefined}>
            {label}
        </th>
    );
}

function MovementModalBody({
    title,
    scopeLine,
    product,
    loading,
    error,
    summary,
    entries,
    total,
    limit,
    offset,
    onOffsetChange,
    from,
    to,
    onFromChange,
    onToChange,
    onApplyDates,
}) {
    const [movementTab, setMovementTab] = useState('rows');
    const totalPages = Math.max(1, Math.ceil((total || 0) / limit));
    const page = Math.floor(offset / limit) + 1;

    const summaryPanel = (
        <div>
            {loading && !summary ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 16 }}>
                    <Loader className="animate-spin" size={20} />
                    Loading totals…
                </div>
            ) : summary ? (
                <div className="stock-movements-summary" style={{ marginBottom: 0 }}>
                    <div className="movement-summary-card">
                        <div className="summary-main">
                            <div className="summary-info">
                                <span className="summary-label">All stock added (this period)</span>
                                <span className="summary-value">{formatNum(summary.totalIn)}</span>
                            </div>
                            <div className="summary-icon-box in">
                                <TrendingUp size={20} />
                            </div>
                        </div>
                    </div>
                    <div className="movement-summary-card">
                        <div className="summary-main">
                            <div className="summary-info">
                                <span className="summary-label">All stock removed (this period)</span>
                                <span className="summary-value">{formatNum(summary.totalOut)}</span>
                            </div>
                            <div className="summary-icon-box out">
                                <TrendingDown size={20} />
                            </div>
                        </div>
                    </div>
                    <div className="movement-summary-card">
                        <div className="summary-main">
                            <div className="summary-info">
                                <span className="summary-label">Net change · how many lines</span>
                                <span className="summary-value">
                                    {formatNum(summary.net)}
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginLeft: 8 }}>
                                        {summary.totalEntries ?? total} lines total (all pages)
                                    </span>
                                </span>
                            </div>
                            <div className="summary-icon-box net">
                                <LayoutGrid size={20} />
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
                    Totals will show here after the list loads. Pick dates and press Apply dates if you want a range.
                </p>
            )}
        </div>
    );

    const rowsPanel = (
        <>
            {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 24 }}>
                    <Loader className="animate-spin" size={22} />
                    Loading rows…
                </div>
            ) : (
                <>
                    <section className="premium-table stock-movements-table" style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
                            <thead>
                                <tr className="table-header-row">
                                    <th className="table-th">When</th>
                                    <th className="table-th">What happened</th>
                                    <th className="table-th">Qty change</th>
                                    <th className="table-th">Stock before → after</th>
                                    <th className="table-th">How it was recorded</th>
                                    <th className="table-th">Invoice or link</th>
                                    <th className="table-th">Note</th>
                                    <th className="table-th">Staff</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(entries || []).length === 0 ? (
                                    <tr>
                                        <td className="table-cell" colSpan={8} style={{ textAlign: 'center', padding: 24 }}>
                                            No stock changes for these dates.
                                        </td>
                                    </tr>
                                ) : (
                                    entries.map((e) => (
                                        <tr key={e.id} className="table-row">
                                            <td className="table-cell" style={{ fontSize: '0.8125rem' }}>
                                                {formatDt(e.createdAt)}
                                            </td>
                                            <td className="table-cell">
                                                <span
                                                    className="movement-badge badge-transfer"
                                                    style={{ textTransform: 'none' }}
                                                    title={(() => {
                                                        const code =
                                                            typeof e.movementType === 'string'
                                                                ? e.movementType
                                                                : displayCell(e.movementType);
                                                        return code && code !== '—' ? `System code: ${code}` : undefined;
                                                    })()}
                                                >
                                                    {movementWhatHappenedLabel(e)}
                                                </span>
                                            </td>
                                            <td className="table-cell font-bold">{formatNum(e.delta)}</td>
                                            <td className="table-cell" style={{ fontSize: '0.8125rem' }}>
                                                {`${formatNum(e.previousQty)} → ${formatNum(e.newQty)}`}
                                            </td>
                                            <td
                                                className="table-cell"
                                                style={{ fontSize: '0.8125rem' }}
                                                title={(() => {
                                                    const code =
                                                        typeof e.source === 'string' ? e.source : displayCell(e.source);
                                                    return code && code !== '—' ? `System code: ${code}` : undefined;
                                                })()}
                                            >
                                                {humanizeMovementSource(e.source)}
                                            </td>
                                            <td className="table-cell reference-col">
                                                <ReferencePills value={e.reference} />
                                            </td>
                                            <td className="table-cell text-muted" style={{ fontSize: '0.8125rem' }}>
                                                {displayCell(e.note)}
                                            </td>
                                            <td className="table-cell" style={{ fontSize: '0.8125rem' }}>
                                                {displayCell(e.actor)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </section>
                    {total > limit ? (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                            <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                                Page {page} of {totalPages} · {total} rows on this page. Open &quot;Period totals&quot; for full-period numbers (not only this page).
                            </span>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    disabled={offset <= 0}
                                    onClick={() => onOffsetChange(Math.max(0, offset - limit))}
                                >
                                    Previous
                                </button>
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    disabled={offset + limit >= total}
                                    onClick={() => onOffsetChange(offset + limit)}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    ) : null}
                </>
            )}
        </>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            {title ? (
                <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--color-text-muted, #64748b)' }}>{title}</p>
            ) : null}
            {scopeLine ? (
                <p style={{ margin: 0, fontSize: '0.8125rem', color: '#64748b' }}>{scopeLine}</p>
            ) : null}
            <p className="stock-movements-summary-scope-hint" role="note">
                <strong>Heads up:</strong> {SUMMARY_VS_ENTRIES_HINT}
            </p>
            {product && (
                <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>
                    {displayCell(product.name)}{' '}
                    <span style={{ fontWeight: 500, color: '#64748b' }}>
                        · Code {displayCell(product.sku)} · Unit: {displayCell(product.unit)}
                    </span>
                </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
                <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">From date</label>
                    <input type="date" className="form-input-field" value={from} onChange={(e) => onFromChange(e.target.value)} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">To date</label>
                    <input type="date" className="form-input-field" value={to} onChange={(e) => onToChange(e.target.value)} />
                </div>
                <button type="button" className="btn-portal" style={{ padding: '10px 16px', marginBottom: 2 }} onClick={onApplyDates}>
                    Apply dates
                </button>
            </div>
            {error && (
                <div style={{ padding: 12, background: '#FEF2F2', color: '#B91C1C', borderRadius: 8, fontSize: '0.875rem' }}>{error}</div>
            )}
            <UniversalTabs
                idPrefix="stock-movement"
                className="universal-tabs--embed"
                value={movementTab}
                onChange={setMovementTab}
                tabs={[
                    { id: 'totals', label: 'Period totals', panel: summaryPanel },
                    { id: 'rows', label: 'Each change', panel: rowsPanel },
                ]}
            />
        </div>
    );
}

export default function StockMovementsSuperAdmin() {
    const [workshops, setWorkshops] = useState([]);
    const [selectedWorkshopId, setSelectedWorkshopId] = useState('');
    const [branches, setBranches] = useState([]);
    const [selectedBranchId, setSelectedBranchId] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [invSuggestOpen, setInvSuggestOpen] = useState(false);
    const [invSuggestIndex, setInvSuggestIndex] = useState(-1);
    const invSearchBlurTimerRef = useRef(null);
    const invSuggestDropdownRef = useRef(null);

    const [branchProductCatalog, setBranchProductCatalog] = useState([]);
    const [branchScopeMeta, setBranchScopeMeta] = useState({ workshop: null, branch: null });
    const [gridOffset, setGridOffset] = useState(0);
    const [loadingWorkshops, setLoadingWorkshops] = useState(true);
    const [loadingBranches, setLoadingBranches] = useState(false);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [productsError, setProductsError] = useState('');
    const [pageTab, setPageTab] = useState('branch-stock');

    const [ledgerOffset, setLedgerOffset] = useState(0);
    const [ledgerEntries, setLedgerEntries] = useState([]);
    const [ledgerMeta, setLedgerMeta] = useState({ total: 0, limit: LEDGER_LIMIT, offset: 0 });
    const [loadingLedger, setLoadingLedger] = useState(false);
    const [ledgerError, setLedgerError] = useState('');

    const [branchMovementProduct, setBranchMovementProduct] = useState(null);

    /** One row at a time: Edit in Actions → edit value in Starting stock column → Save. */
    const [openingEditProductId, setOpeningEditProductId] = useState(null);
    const [openingDraft, setOpeningDraft] = useState('');
    const [openingSaving, setOpeningSaving] = useState(false);
    const [openingHint, setOpeningHint] = useState('');
    const openingInputRef = useRef(null);

    /** Match BranchesPage / Employees: prefer approved; also allow active or missing status (backend variants). */
    const workshopDropdown = useMemo(
        () =>
            workshops.filter((w) => {
                const s = w.status;
                if (!s) return true;
                return s === 'approved' || s === 'active';
            }),
        [workshops],
    );

    useEffect(() => {
        if (pageTab !== 'movement-ledger') return undefined;
        let cancelled = false;
        (async () => {
            setLoadingLedger(true);
            setLedgerError('');
            try {
                const res = await getSuperAdminInventoryLedger({
                    limit: LEDGER_LIMIT,
                    offset: ledgerOffset,
                });
                if (cancelled) return;
                const data = unwrapData(res);
                const list = data?.entries ?? [];
                setLedgerEntries(Array.isArray(list) ? list : []);
                setLedgerMeta({
                    total: Number(data?.total ?? list.length) || 0,
                    limit: Number(data?.limit ?? LEDGER_LIMIT) || LEDGER_LIMIT,
                    offset: Number(data?.offset ?? ledgerOffset) || 0,
                });
            } catch (e) {
                if (!cancelled) {
                    setLedgerEntries([]);
                    setLedgerError(e?.message || 'Could not load the movement ledger.');
                }
            } finally {
                if (!cancelled) setLoadingLedger(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [pageTab, ledgerOffset]);

    useEffect(() => {
        setLoadingWorkshops(true);
        getWorkshopOptions()
            .then((workshopData) => {
                const workshopRows = pickArray(workshopData, ['options', 'workshops']);
                setWorkshops(workshopRows.map(normalizeWorkshop).filter((w) => w.id));
            })
            .catch(() => setWorkshops([]))
            .finally(() => setLoadingWorkshops(false));
    }, []);

    useEffect(() => {
        if (!selectedWorkshopId) {
            setBranches([]);
            setSelectedBranchId('');
            return;
        }
        setLoadingBranches(true);
        getBranches({ workshopId: selectedWorkshopId })
            .then((d) => {
                const rows = pickArray(d, ['branches']);
                setBranches(rows.map(normalizeBranch).filter((b) => b.id));
            })
            .catch(() => setBranches([]))
            .finally(() => setLoadingBranches(false));
    }, [selectedWorkshopId]);

    useEffect(() => {
        setSearchQuery('');
        setInvSuggestOpen(false);
        setInvSuggestIndex(-1);
    }, [selectedWorkshopId, selectedBranchId]);

    const loadBranchProductCatalog = useCallback(async () => {
        if (!selectedWorkshopId || !selectedBranchId) {
            setBranchProductCatalog([]);
            setBranchScopeMeta({ workshop: null, branch: null });
            setProductsError('');
            return;
        }
        setLoadingProducts(true);
        setProductsError('');
        const all = [];
        let workshop = null;
        let branch = null;
        try {
            let offset = 0;
            for (;;) {
                const res = await getSuperAdminInventoryProducts({
                    workshopId: selectedWorkshopId,
                    branchId: selectedBranchId,
                    limit: CATALOG_PAGE_LIMIT,
                    offset,
                });
                const data = unwrapData(res);
                const list = data?.products ?? [];
                if (!workshop && data?.workshop) workshop = data.workshop;
                if (!branch && data?.branch) branch = data.branch;
                if (Array.isArray(list)) all.push(...list);
                const total = Number(data?.total ?? 0) || 0;
                if (list.length < CATALOG_PAGE_LIMIT || all.length >= total) break;
                offset += CATALOG_PAGE_LIMIT;
            }
            setBranchProductCatalog(all);
            setBranchScopeMeta({ workshop, branch });
        } catch (e) {
            setBranchProductCatalog([]);
            setProductsError(e?.message || 'Could not load the product list.');
        } finally {
            setLoadingProducts(false);
        }
    }, [selectedWorkshopId, selectedBranchId]);

    useEffect(() => {
        void loadBranchProductCatalog();
    }, [loadBranchProductCatalog]);

    useEffect(() => {
        setGridOffset(0);
    }, [selectedWorkshopId, selectedBranchId, searchQuery]);

    const filteredBranchProducts = useMemo(() => {
        if (!normalizeInventorySearchValue(searchQuery)) return branchProductCatalog;
        return branchProductCatalog.filter((p) => matchesProductNameSearch(toInventorySearchRow(p), searchQuery));
    }, [branchProductCatalog, searchQuery]);

    const invSearchSuggestions = useMemo(() => {
        if (!normalizeInventorySearchValue(searchQuery)) return [];
        return branchProductCatalog
            .filter((p) => matchesProductNameSearch(toInventorySearchRow(p), searchQuery))
            .slice(0, INV_SEARCH_SUGGEST_LIMIT);
    }, [branchProductCatalog, searchQuery]);

    const products = useMemo(
        () => filteredBranchProducts.slice(gridOffset, gridOffset + GRID_LIMIT),
        [filteredBranchProducts, gridOffset],
    );

    const gridMeta = useMemo(
        () => ({
            workshop: branchScopeMeta.workshop,
            branch: branchScopeMeta.branch,
            total: filteredBranchProducts.length,
            limit: GRID_LIMIT,
            offset: gridOffset,
        }),
        [branchScopeMeta, filteredBranchProducts.length, gridOffset],
    );

    const applyProductStockPatch = useCallback((productId, patch) => {
        setBranchProductCatalog((prev) =>
            prev.map((row) => {
                if (String(row.productId) !== String(productId)) return row;
                const next = { ...row };
                for (const [k, v] of Object.entries(patch)) {
                    if (v !== undefined) next[k] = v;
                }
                return next;
            }),
        );
    }, []);

    const cancelOpeningEdit = useCallback(() => {
        setOpeningEditProductId(null);
        setOpeningDraft('');
        setOpeningHint('');
        setOpeningSaving(false);
    }, []);

    const beginOpeningEdit = useCallback((product) => {
        setOpeningHint('');
        setOpeningEditProductId(String(product.productId));
        setOpeningDraft(String(product.openingQty ?? ''));
    }, []);

    const saveOpeningEdit = useCallback(
        async (product) => {
            const trimmed = String(openingDraft).trim();
            const parsed = Number(trimmed);
            if (trimmed === '' || Number.isNaN(parsed)) {
                setOpeningHint('Enter a valid number');
                return;
            }
            const prevRaw = product.openingQty;
            const prevNum = Number(prevRaw);
            const hadPrev = prevRaw != null && prevRaw !== '' && !Number.isNaN(prevNum);
            if (hadPrev && parsed === prevNum) {
                cancelOpeningEdit();
                return;
            }
            setOpeningSaving(true);
            setOpeningHint('');
            try {
                const res = await patchSuperAdminInventoryProductStartingStock(product.productId, {
                    workshopId: selectedWorkshopId,
                    branchId: selectedBranchId,
                    openingQty: parsed,
                    previousOpeningQty: hadPrev ? prevNum : undefined,
                });
                const data = unwrapData(res);
                applyProductStockPatch(product.productId, {
                    openingQty: data?.openingQty,
                    currentQty: data?.currentQty,
                    reservedQty: data?.reservedQty,
                    availableQty: data?.availableQty,
                    criticalStockPoint: data?.criticalStockPoint,
                });
                cancelOpeningEdit();
            } catch (e) {
                setOpeningHint(e?.message || 'Could not save');
            } finally {
                setOpeningSaving(false);
            }
        },
        [
            openingDraft,
            selectedWorkshopId,
            selectedBranchId,
            applyProductStockPatch,
            cancelOpeningEdit,
        ],
    );

    useEffect(() => {
        cancelOpeningEdit();
    }, [selectedWorkshopId, selectedBranchId, gridOffset, searchQuery, cancelOpeningEdit]);

    useEffect(() => {
        if (!openingHint) return undefined;
        const t = setTimeout(() => setOpeningHint(''), 4500);
        return () => clearTimeout(t);
    }, [openingHint]);

    useEffect(() => {
        if (!openingEditProductId) return;
        const el = openingInputRef.current;
        if (el) {
            el.focus();
            el.select();
        }
    }, [openingEditProductId]);

    const applyInventorySearchSuggestion = useCallback((row) => {
        setSearchQuery(inventorySearchValueFromRow(toInventorySearchRow(row)));
        setInvSuggestOpen(false);
        setInvSuggestIndex(-1);
    }, []);

    const clearInvSearchBlurTimer = useCallback(() => {
        if (invSearchBlurTimerRef.current != null) {
            clearTimeout(invSearchBlurTimerRef.current);
            invSearchBlurTimerRef.current = null;
        }
    }, []);

    useEffect(() => () => clearInvSearchBlurTimer(), [clearInvSearchBlurTimer]);

    const onInvSearchKeyDown = useCallback(
        (e) => {
            if (e.key === 'ArrowDown') {
                if (!invSearchSuggestions.length) return;
                e.preventDefault();
                setInvSuggestOpen(true);
                setInvSuggestIndex((i) => {
                    if (i < 0) return 0;
                    return Math.min(i + 1, invSearchSuggestions.length - 1);
                });
                return;
            }
            if (e.key === 'ArrowUp') {
                if (!invSearchSuggestions.length) return;
                e.preventDefault();
                setInvSuggestOpen(true);
                setInvSuggestIndex((i) => (i <= 0 ? -1 : i - 1));
                return;
            }
            if (e.key === 'Enter') {
                if (invSuggestOpen && invSuggestIndex >= 0 && invSearchSuggestions[invSuggestIndex]) {
                    e.preventDefault();
                    applyInventorySearchSuggestion(invSearchSuggestions[invSuggestIndex]);
                }
                return;
            }
            if (e.key === 'Escape') {
                setInvSuggestOpen(false);
                setInvSuggestIndex(-1);
            }
        },
        [invSearchSuggestions, invSuggestOpen, invSuggestIndex, applyInventorySearchSuggestion],
    );

    useLayoutEffect(() => {
        if (!invSuggestOpen || invSuggestIndex < 0) return;
        const list = invSuggestDropdownRef.current;
        const item = list?.querySelector(`#sm-admin-inv-suggest-${invSuggestIndex}`);
        if (!list || !item) return;
        const padding = 6;
        const listRect = list.getBoundingClientRect();
        const itemRect = item.getBoundingClientRect();
        if (itemRect.bottom > listRect.bottom - padding) {
            list.scrollTop += itemRect.bottom - listRect.bottom + padding;
        } else if (itemRect.top < listRect.top + padding) {
            list.scrollTop -= listRect.top - itemRect.top + padding;
        }
    }, [invSuggestIndex, invSuggestOpen, invSearchSuggestions]);

    const gridTotalPages = Math.max(1, Math.ceil((gridMeta.total || 0) / GRID_LIMIT));
    const gridPage = Math.floor(gridOffset / GRID_LIMIT) + 1;
    const ledgerTotalPages = Math.max(1, Math.ceil((ledgerMeta.total || 0) / LEDGER_LIMIT));
    const ledgerPage = Math.floor(ledgerOffset / LEDGER_LIMIT) + 1;

    const exportGridCsv = () => {
        if (!filteredBranchProducts.length) return;
        const workshopLabel = displayCell(gridMeta.workshop);
        const branchLabel = displayCell(gridMeta.branch);
        const slug = (v) =>
            String(v ?? '')
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '') || 'unknown';
        const headers = [
            'workshop',
            'branch',
            'productId',
            'name',
            'sku',
            'brandName',
            'unit',
            'departmentName',
            'categoryName',
            'openingQty',
            'criticalStockPoint',
            'currentQty',
            'reservedQty',
            'availableQty',
            'stockUpdatedAt',
            'isActive',
        ];
        const rows = filteredBranchProducts.map((p) =>
            headers.map((h) => {
                if (h === 'workshop') return workshopLabel;
                if (h === 'branch') return branchLabel;
                if (h === 'isActive') return p.isActive ? 'yes' : 'no';
                return p[h];
            }),
        );
        downloadCsv(`inventory-stock-${slug(workshopLabel)}-${slug(branchLabel)}.csv`, rows, headers);
    };

    return (
        <>
            <header className="stock-movements-header">
                <div>
                    <h1 className="stock-movements-title">Stock movements</h1>
                    <p className="stock-movements-subtitle">
                        <strong>Branch stock</strong>: pick a workshop and branch for on-hand quantities and per-product history.{' '}
                        <strong>Movement ledger</strong>: optional filters and a global movement list (workshop + branch on each row) from the super-admin ledger API.
                    </p>
                </div>
                <button
                    type="button"
                    className="btn-export"
                    disabled={pageTab !== 'branch-stock' || !filteredBranchProducts.length}
                    onClick={exportGridCsv}
                >
                    <Download size={16} /> Download table (CSV)
                </button>
            </header>

            <UniversalTabs
                idPrefix="sm-page"
                className="stock-movements-page-tabs"
                value={pageTab}
                onChange={setPageTab}
                tabs={[
                    {
                        id: 'branch-stock',
                        label: 'Branch stock',
                        panel: (
                            <>
            <div className="stock-movements-context-bar">
                <div className="stock-movements-context-field">
                    <label className="log-filter-label">Workshop (center)</label>
                    <select
                        className="movements-filter-select"
                        style={{ minWidth: 200 }}
                        value={selectedWorkshopId}
                        onChange={(e) => {
                            setSelectedWorkshopId(e.target.value);
                            setSelectedBranchId('');
                        }}
                        disabled={loadingWorkshops}
                    >
                        <option value="">{loadingWorkshops ? 'Loading…' : 'Choose workshop'}</option>
                        {workshopDropdown.map((w) => (
                            <option key={w.id} value={w.id}>
                                {displayCell(w.name)}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="stock-movements-context-field">
                    <label className="log-filter-label">Branch (location)</label>
                    <select
                        className="movements-filter-select"
                        style={{ minWidth: 200 }}
                        value={selectedBranchId}
                        onChange={(e) => setSelectedBranchId(e.target.value)}
                        disabled={!selectedWorkshopId || loadingBranches}
                    >
                        <option value="">{!selectedWorkshopId ? 'Choose workshop first' : loadingBranches ? 'Loading…' : 'Choose branch'}</option>
                        {branches.map((b) => (
                            <option key={b.id} value={b.id}>
                                {displayCell(b.name)}
                            </option>
                        ))}
                    </select>
                </div>
                {gridMeta.workshop && gridMeta.branch ? (
                    <p className="stock-movements-context-hint">
                        Now viewing: <strong>{displayCell(gridMeta.workshop)}</strong> — <strong>{displayCell(gridMeta.branch)}</strong>
                    </p>
                ) : null}
            </div>

            <div className="stock-movements-filter-bar">
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                        className="mc-filter-select-wrapper mc-inv-search-combo"
                        style={{ position: 'relative', width: '100%' }}
                    >
                        <Search className="mc-filter-icon" size={16} />
                        <input
                            type="text"
                            placeholder="Search by product name or SKU…"
                            className="mc-filter-select"
                            style={{
                                paddingLeft: '40px',
                                paddingRight: searchQuery ? '70px' : '14px',
                                width: '100%',
                                minHeight: 46,
                                fontSize: '0.95rem',
                                backgroundImage: 'none',
                                cursor: 'text',
                            }}
                            value={searchQuery}
                            onChange={(e) => {
                                const v = e.target.value;
                                setSearchQuery(v);
                                setInvSuggestIndex(-1);
                                if (!normalizeInventorySearchValue(v)) {
                                    setInvSuggestOpen(false);
                                } else {
                                    setInvSuggestOpen(true);
                                }
                            }}
                            onKeyDown={onInvSearchKeyDown}
                            onFocus={() => {
                                clearInvSearchBlurTimer();
                                if (normalizeInventorySearchValue(searchQuery)) {
                                    setInvSuggestOpen(true);
                                }
                            }}
                            onBlur={() => {
                                clearInvSearchBlurTimer();
                                invSearchBlurTimerRef.current = setTimeout(() => {
                                    invSearchBlurTimerRef.current = null;
                                    setInvSuggestOpen(false);
                                    setInvSuggestIndex(-1);
                                }, 200);
                            }}
                            disabled={!selectedBranchId || loadingProducts}
                            role="combobox"
                            aria-autocomplete="list"
                            aria-expanded={invSuggestOpen}
                            aria-controls="sm-admin-inv-search-suggest-list"
                            aria-activedescendant={
                                invSuggestOpen && invSuggestIndex >= 0
                                    ? `sm-admin-inv-suggest-${invSuggestIndex}`
                                    : undefined
                            }
                        />
                        {searchQuery ? (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchQuery('');
                                    setInvSuggestOpen(false);
                                    setInvSuggestIndex(-1);
                                }}
                                aria-label="Clear search"
                                title="Clear search"
                                style={{
                                    position: 'absolute',
                                    right: 8,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    border: 'none',
                                    background: '#F3F4F6',
                                    color: '#374151',
                                    borderRadius: 8,
                                    width: 26,
                                    height: 26,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                }}
                            >
                                <X size={14} />
                            </button>
                        ) : null}
                        {invSuggestOpen && normalizeInventorySearchValue(searchQuery) ? (
                            <div
                                ref={invSuggestDropdownRef}
                                id="sm-admin-inv-search-suggest-list"
                                className="mc-inv-search-dropdown"
                                role="listbox"
                                aria-label="Matching products"
                                onMouseDown={(ev) => ev.preventDefault()}
                            >
                                {invSearchSuggestions.length === 0 ? (
                                    <div className="mc-inv-search-dropdown-empty">No matching products</div>
                                ) : (
                                    invSearchSuggestions.map((row, idx) => (
                                        <button
                                            key={String(row.productId ?? idx)}
                                            type="button"
                                            id={`sm-admin-inv-suggest-${idx}`}
                                            role="option"
                                            aria-selected={invSuggestIndex === idx}
                                            className={`mc-inv-search-suggest${invSuggestIndex === idx ? ' is-active' : ''}`}
                                            onMouseEnter={() => setInvSuggestIndex(idx)}
                                            onClick={() => applyInventorySearchSuggestion(row)}
                                        >
                                            <span className="mc-inv-search-suggest-name">{displayCell(row.name)}</span>
                                            {row.sku ? (
                                                <span className="mc-inv-search-suggest-sku">{displayCell(row.sku)}</span>
                                            ) : null}
                                        </button>
                                    ))
                                )}
                            </div>
                        ) : null}
                    </div>
                    <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                        Showing <strong>{filteredBranchProducts.length}</strong> of <strong>{branchProductCatalog.length}</strong>{' '}
                        products
                        {searchQuery ? ` for "${searchQuery}"` : ''}.
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#64748b' }}>
                        Use <strong>↑</strong> <strong>↓</strong> and <strong>Enter</strong> to pick a suggestion — same as workshop Manage Inventory.
                    </p>
                </div>
            </div>

            {productsError ? (
                <div style={{ padding: 12, marginBottom: 16, background: '#FEF2F2', color: '#B91C1C', borderRadius: 8, fontSize: '0.875rem' }}>
                    {productsError}
                </div>
            ) : null}

            <section className="premium-table stock-movements-table">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">Product</th>
                            <th className="table-th">Code (SKU)</th>
                            <th className="table-th">Brand</th>
                            <th className="table-th">Unit</th>
                            <GridQtyTh label="Stock now" apiField="currentQty" />
                            <GridQtyTh label="Reserved" apiField="reservedQty" />
                            <GridQtyTh label="Free to use" apiField="availableQty" />
                            <GridQtyTh label="Low-stock level" apiField="criticalStockPoint" />
                            <GridQtyTh label="Starting stock" apiField="openingQty" />
                            <GridQtyTh label="In use" apiField="isActive" />
                            <th className="table-th">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loadingProducts ? (
                            <tr>
                                <td className="table-cell" colSpan={11} style={{ textAlign: 'center', padding: 32 }}>
                                    <Loader className="animate-spin" size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                                    Loading list…
                                </td>
                            </tr>
                        ) : !selectedWorkshopId || !selectedBranchId ? (
                            <tr>
                                <td className="table-cell" colSpan={11} style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>
                                    Choose a workshop and a branch above to load products and stock for that place.
                                </td>
                            </tr>
                        ) : filteredBranchProducts.length === 0 ? (
                            <tr>
                                <td className="table-cell" colSpan={11} style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>
                                    {branchProductCatalog.length === 0
                                        ? 'No products in this branch yet.'
                                        : 'No products match your search—clear or change the search box.'}
                                </td>
                            </tr>
                        ) : (
                            products.map((p) => (
                                <tr key={p.productId} className="table-row">
                                    <td className="table-cell">
                                        <div className="product-cell-with-icon">
                                            <div className="product-mini-icon">
                                                <Package size={14} />
                                            </div>
                                            <span className="cell-main-text">{displayCell(p.name)}</span>
                                        </div>
                                        <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: 2 }}>
                                            {displayCell(p.departmentName)}
                                            {p.categoryName != null && p.categoryName !== ''
                                                ? ` · ${displayCell(p.categoryName)}`
                                                : ''}
                                        </div>
                                    </td>
                                    <td className="table-cell" style={{ fontSize: '0.8125rem' }}>
                                        {displayCell(p.sku)}
                                    </td>
                                    <td className="table-cell" style={{ fontSize: '0.8125rem' }}>
                                        {displayCell(p.brandName)}
                                    </td>
                                    <td className="table-cell">{displayCell(p.unit)}</td>
                                    <td className="table-cell font-bold">{formatNum(p.currentQty)}</td>
                                    <td className="table-cell">{formatNum(p.reservedQty)}</td>
                                    <td className="table-cell">{formatNum(p.availableQty)}</td>
                                    <td className="table-cell">{formatNum(p.criticalStockPoint)}</td>
                                    <td className="table-cell opening-qty-cell">
                                        {String(openingEditProductId) === String(p.productId) ? (
                                            <div className="opening-qty-editor">
                                                <input
                                                    ref={openingInputRef}
                                                    type="number"
                                                    step="any"
                                                    className="opening-qty-input"
                                                    value={openingDraft}
                                                    disabled={openingSaving}
                                                    onChange={(e) => setOpeningDraft(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            void saveOpeningEdit(p);
                                                        } else if (e.key === 'Escape') {
                                                            e.preventDefault();
                                                            cancelOpeningEdit();
                                                        }
                                                    }}
                                                    aria-label="Starting stock"
                                                />
                                                {openingSaving ? (
                                                    <Loader className="animate-spin opening-qty-spinner" size={14} />
                                                ) : null}
                                                {openingHint ? (
                                                    <span className="opening-qty-hint">{openingHint}</span>
                                                ) : null}
                                            </div>
                                        ) : (
                                            <span className="opening-qty-readonly">{formatNum(p.openingQty)}</span>
                                        )}
                                    </td>
                                    <td className="table-cell">
                                        <span className={`status-badge ${p.isActive ? 'status-completed' : 'status-warning'}`}>
                                            {p.isActive ? 'On' : 'Off'}
                                        </span>
                                    </td>
                                    <td className="table-cell">
                                        <div className="stock-row-actions">
                                            {String(openingEditProductId) === String(p.productId) ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        className="btn-edit"
                                                        onClick={() => void saveOpeningEdit(p)}
                                                        disabled={
                                                            openingSaving ||
                                                            loadingProducts ||
                                                            !selectedWorkshopId ||
                                                            !selectedBranchId
                                                        }
                                                        title="Save starting stock"
                                                    >
                                                        Save
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn-secondary"
                                                        onClick={cancelOpeningEdit}
                                                        disabled={openingSaving}
                                                    >
                                                        Cancel
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="btn-edit"
                                                    onClick={() => beginOpeningEdit(p)}
                                                    disabled={
                                                        loadingProducts ||
                                                        !selectedWorkshopId ||
                                                        !selectedBranchId ||
                                                        openingSaving
                                                    }
                                                    title="Edit starting stock for this product"
                                                >
                                                    <Pencil size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                                                    Edit
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                className="btn-edit"
                                                onClick={() => setBranchMovementProduct(p)}
                                                disabled={
                                                    String(openingEditProductId) === String(p.productId) &&
                                                    openingSaving
                                                }
                                                title="See how stock went up and down for this product at this branch"
                                            >
                                                <ListTree size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                                                View history
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </section>

            {selectedWorkshopId && selectedBranchId && gridMeta.total > GRID_LIMIT ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, flexWrap: 'wrap', gap: 8 }}>
                    <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                        Products: page {gridPage} of {gridTotalPages} ({gridMeta.total} in total)
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            type="button"
                            className="btn-secondary"
                            disabled={gridOffset <= 0}
                            onClick={() => setGridOffset((o) => Math.max(0, o - GRID_LIMIT))}
                        >
                            Previous
                        </button>
                        <button
                            type="button"
                            className="btn-secondary"
                            disabled={gridOffset + GRID_LIMIT >= gridMeta.total}
                            onClick={() => setGridOffset((o) => o + GRID_LIMIT)}
                        >
                            Next
                        </button>
                    </div>
                </div>
            ) : null}
                            </>
                        ),
                    },
                    {
                        id: 'movement-ledger',
                        label: 'Movement ledger',
                        panel: (
                            <>
                                {ledgerError ? (
                                    <div
                                        style={{
                                            padding: 12,
                                            marginBottom: 16,
                                            background: '#FEF2F2',
                                            color: '#B91C1C',
                                            borderRadius: 8,
                                            fontSize: '0.875rem',
                                        }}
                                    >
                                        {ledgerError}
                                    </div>
                                ) : null}
                                <section className="premium-table stock-movements-table" style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 960 }}>
                                        <thead>
                                            <tr className="table-header-row">
                                                <th className="table-th">When</th>
                                                <th className="table-th">Workshop</th>
                                                <th className="table-th">Branch</th>
                                                <th className="table-th">Product</th>
                                                <th className="table-th">Kind</th>
                                                <th className="table-th">IN</th>
                                                <th className="table-th">OUT</th>
                                                <th className="table-th">Balance after</th>
                                                <th className="table-th">Reference</th>
                                                <th className="table-th">Note</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {loadingLedger ? (
                                                <tr>
                                                    <td className="table-cell" colSpan={10} style={{ textAlign: 'center', padding: 32 }}>
                                                        <Loader className="animate-spin" size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                                                        Loading ledger…
                                                    </td>
                                                </tr>
                                            ) : ledgerEntries.length === 0 ? (
                                                <tr>
                                                    <td className="table-cell" colSpan={10} style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>
                                                        No ledger rows yet.
                                                    </td>
                                                </tr>
                                            ) : (
                                                ledgerEntries.map((row, idx) => {
                                                    const pr = row.product ?? {};
                                                    const ref = row.reference;
                                                    const brandRaw = pr.brandName ?? pr.brand;
                                                    const brandSub =
                                                        brandRaw != null && String(brandRaw).trim() !== ''
                                                            ? displayCell(brandRaw)
                                                            : null;
                                                    return (
                                                        <tr key={row.id != null ? String(row.id) : `ledger-${idx}`} className="table-row">
                                                            <td className="table-cell" style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                                                                {formatLedgerWhen(row)}
                                                            </td>
                                                            <td className="table-cell" style={{ fontSize: '0.8125rem' }}>
                                                                {displayCell(row.workshop)}
                                                            </td>
                                                            <td className="table-cell" style={{ fontSize: '0.8125rem' }}>
                                                                {displayCell(row.branch)}
                                                            </td>
                                                            <td className="table-cell">
                                                                <span className="cell-main-text">{displayCell(pr.name)}</span>
                                                                {brandSub ? (
                                                                    <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: 2 }}>
                                                                        {brandSub}
                                                                    </div>
                                                                ) : null}
                                                            </td>
                                                            <td className="table-cell">
                                                                <span className={ledgerKindBadgeClass(row.kind)} style={{ textTransform: 'capitalize' }}>
                                                                    {displayCell(row.kind)}
                                                                </span>
                                                            </td>
                                                            <td className="table-cell font-bold" style={{ color: '#059669' }}>
                                                                {formatNum(row.inQty)}
                                                            </td>
                                                            <td className="table-cell font-bold" style={{ color: '#b91c1c' }}>
                                                                {formatNum(row.outQty)}
                                                            </td>
                                                            <td className="table-cell font-bold">{formatNum(row.balanceAfter)}</td>
                                                            <td className="table-cell reference-col">
                                                                {ref != null && ref !== '' && typeof ref === 'object' && !Array.isArray(ref) ? (
                                                                    <ReferencePills value={ref} />
                                                                ) : (
                                                                    <span className="reference-pill reference-pill-single">{ref != null && ref !== '' ? String(ref) : '—'}</span>
                                                                )}
                                                            </td>
                                                            <td className="table-cell text-muted" style={{ fontSize: '0.8125rem' }}>
                                                                {displayCell(row.note)}
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </section>
                                {ledgerMeta.total > LEDGER_LIMIT ? (
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            marginTop: 16,
                                            flexWrap: 'wrap',
                                            gap: 8,
                                        }}
                                    >
                                        <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                                            Ledger: page {ledgerPage} of {ledgerTotalPages} ({ledgerMeta.total} rows)
                                        </span>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button
                                                type="button"
                                                className="btn-secondary"
                                                disabled={ledgerOffset <= 0}
                                                onClick={() => setLedgerOffset((o) => Math.max(0, o - LEDGER_LIMIT))}
                                            >
                                                Previous
                                            </button>
                                            <button
                                                type="button"
                                                className="btn-secondary"
                                                disabled={ledgerOffset + LEDGER_LIMIT >= ledgerMeta.total}
                                                onClick={() => setLedgerOffset((o) => o + LEDGER_LIMIT)}
                                            >
                                                Next
                                            </button>
                                        </div>
                                    </div>
                                ) : null}
                            </>
                        ),
                    },
                ]}
            />

            {branchMovementProduct ? (
                <BranchMovementModal
                    product={branchMovementProduct}
                    workshopId={selectedWorkshopId}
                    branchId={selectedBranchId}
                    onClose={() => setBranchMovementProduct(null)}
                />
            ) : null}
        </>
    );
}

function BranchMovementModal({ product, workshopId, branchId, onClose }) {
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [appliedFrom, setAppliedFrom] = useState('');
    const [appliedTo, setAppliedTo] = useState('');
    const [offset, setOffset] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [payload, setPayload] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await getSuperAdminInventoryProductMovements(product.productId, {
                workshopId,
                branchId,
                from: appliedFrom || undefined,
                to: appliedTo || undefined,
                limit: MOVEMENT_LIMIT,
                offset,
            });
            setPayload(unwrapData(res));
        } catch (e) {
            setPayload(null);
            setError(e?.message || 'Could not load stock history.');
        } finally {
            setLoading(false);
        }
    }, [product?.productId, workshopId, branchId, appliedFrom, appliedTo, offset]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const applyDates = () => {
        setAppliedFrom(from);
        setAppliedTo(to);
        setOffset(0);
    };

    return (
        <Modal
            title="Stock changes for this product"
            onClose={onClose}
            width="min(1280px, 98vw)"
            footer={
                <button type="button" className="btn-secondary" onClick={onClose}>
                    Close
                </button>
            }
        >
            <MovementModalBody
                key={String(product.productId)}
                title=""
                scopeLine="This list is only for the workshop and branch you picked on the main screen."
                product={payload?.product ?? { name: product.name, sku: product.sku, unit: product.unit }}
                loading={loading}
                error={error}
                summary={payload?.summary}
                entries={payload?.entries}
                total={payload?.total ?? 0}
                limit={payload?.limit ?? MOVEMENT_LIMIT}
                offset={offset}
                onOffsetChange={setOffset}
                from={from}
                to={to}
                onFromChange={setFrom}
                onToChange={setTo}
                onApplyDates={applyDates}
            />
        </Modal>
    );
}
