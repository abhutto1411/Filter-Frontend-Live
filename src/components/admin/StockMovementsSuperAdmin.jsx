import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
    Download,
    Loader,
    Package,
    Pencil,
    Search,
    SlidersHorizontal,
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
import { patchBranchProduct } from '../../services/workshopCatalogApi';
import { postBranchProductInventoryAdjustment } from '../../services/workshopInventoryApi';
import {
    INVENTORY_ADJUSTMENT_REASON_INFINITE_QTY,
    INVENTORY_ADJUSTMENT_REASON_OPENING_QTY,
    INVENTORY_ADJUST_REASON_OPTIONS,
} from '../../constants/inventoryAdjustmentReasons';
import {
    exportAdjustmentReportExcel,
    exportAdjustmentReportPdf,
} from '../../utils/inventoryAdjustmentReportExport';
import { smT } from '../../utils/stockMovementsI18n';

const GRID_LIMIT = 50;
const MOVEMENT_LIMIT = 100;
const LEDGER_LIMIT = 50;
const ADJUSTMENT_LEDGER_LIMIT = 200;
/** Same cap as workshop Manage Inventory search suggestions. */
const INV_SEARCH_SUGGEST_LIMIT = 12;
/** Backend max page size for super-admin branch inventory list. */
const CATALOG_PAGE_LIMIT = 200;

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

function ledgerStockBeforeAfter(row) {
    if (!row || typeof row !== 'object') return { before: null, after: null };
    if (row.previousQty != null && row.newQty != null) {
        return { before: row.previousQty, after: row.newQty };
    }
    const after = Number(row.balanceAfter);
    const delta = Number(row.delta) || 0;
    if (!Number.isNaN(after)) return { before: after - delta, after };
    return { before: null, after: null };
}

function rowPurchasePrice(row, catalogPriceByProductId) {
    const pr = row?.product ?? {};
    const fromApi = pr.purchasePrice ?? pr.purchase_price ?? row?.purchasePrice;
    const apiNum = Number(fromApi);
    const pid = String(pr.id ?? row?.productId ?? '');
    const catalog = pid ? Number(catalogPriceByProductId?.[pid]) : NaN;

    if (pr.purchasePriceSource === 'last_purchase' && Number.isFinite(apiNum) && apiNum > 0) {
        return apiNum;
    }
    if (Number.isFinite(apiNum) && apiNum > 0) return apiNum;
    if (Number.isFinite(catalog) && catalog > 0) return catalog;
    return Number.isFinite(apiNum) ? apiNum : 0;
}

function adjustmentRowMetrics(row, catalogPriceByProductId) {
    const { before, after } = ledgerStockBeforeAfter(row);
    const purchasePrice = rowPurchasePrice(row, catalogPriceByProductId);
    const beforeQty = Number(before) || 0;
    const afterQty = Number(after) || 0;
    const diffQty = afterQty - beforeQty;
    const valueBefore = beforeQty * purchasePrice;
    const valueAfter = afterQty * purchasePrice;
    return {
        purchasePrice,
        beforeQty,
        afterQty,
        diffQty,
        valueBefore,
        valueAfter,
        diffValue: valueAfter - valueBefore,
    };
}

function formatSar(amount, { decimals = 2 } = {}) {
    if (amount == null || amount === '' || Number.isNaN(Number(amount))) return '—';
    return Number(amount).toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

function formatSignedQty(n) {
    if (n == null || Number.isNaN(Number(n))) return '—';
    const v = Number(n);
    if (v === 0) return '0';
    return v > 0 ? `+${formatNum(v)}` : formatNum(v);
}

function formatSignedSar(n) {
    if (n == null || Number.isNaN(Number(n))) return '—';
    const v = Number(n);
    if (v === 0) return `SAR ${formatSar(0)}`;
    const sign = v > 0 ? '+' : '−';
    return `${sign} SAR ${formatSar(Math.abs(v))}`;
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

function humanizeMovementKind(raw, t) {
    let s = '';
    if (raw == null || raw === '') return '—';
    if (typeof raw === 'string' || typeof raw === 'number') s = String(raw).trim();
    else s = displayCell(raw).trim();
    if (!s || s === '—') return '—';
    const k = s.toLowerCase();
    if (t) {
        const key = `kind.${k}`;
        const translated = t(key);
        if (translated !== key) return translated;
    }
    if (MOVEMENT_KIND_LABELS[k]) return MOVEMENT_KIND_LABELS[k];
    return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function humanizeMovementSource(raw, t) {
    let s = '';
    if (raw == null || raw === '') return '—';
    if (typeof raw === 'string' || typeof raw === 'number') s = String(raw).trim();
    else s = displayCell(raw).trim();
    if (!s || s === '—') return '—';
    const k = s.toLowerCase();
    if (t) {
        const key = `source.${k}`;
        const translated = t(key);
        if (translated !== key) return translated;
    }
    if (MOVEMENT_SOURCE_LABELS[k]) return MOVEMENT_SOURCE_LABELS[k];
    return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Prefer human reason for manual rows (e.g. super-admin opening change); else movement kind label. */
function movementWhatHappenedLabel(e, t) {
    if (!e || typeof e !== 'object') return '—';
    const mt = String(e.movementType || '').toLowerCase();
    const r = e.reason != null && String(e.reason).trim() !== '' ? String(e.reason).trim() : '';
    if (mt === 'manual_adjustment' && r) return r;
    return humanizeMovementKind(e.movementType, t);
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
function GridQtyTh({ label, apiField, t, fieldTitle }) {
    const title = fieldTitle ?? (apiField ? (t ? t('title.systemField', { field: apiField }) : `System field: ${apiField}`) : undefined);
    return (
        <th className="table-th" title={title}>
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
    t,
}) {
    const [movementTab, setMovementTab] = useState('rows');
    const totalPages = Math.max(1, Math.ceil((total || 0) / limit));
    const page = Math.floor(offset / limit) + 1;

    const summaryPanel = (
        <div>
            {loading && !summary ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 16 }}>
                    <Loader className="animate-spin" size={20} />
                    {t('loading.totals')}
                </div>
            ) : summary ? (
                <div className="stock-movements-summary" style={{ marginBottom: 0 }}>
                    <div className="movement-summary-card">
                        <div className="summary-main">
                            <div className="summary-info">
                                <span className="summary-label">{t('modal.stockAdded')}</span>
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
                                <span className="summary-label">{t('modal.stockRemoved')}</span>
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
                                <span className="summary-label">{t('modal.netChange')}</span>
                                <span className="summary-value">
                                    {formatNum(summary.net)}
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginLeft: 8 }}>
                                        {t('modal.linesTotal', { n: summary.totalEntries ?? total })}
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
                    {t('modal.totalsEmpty')}
                </p>
            )}
        </div>
    );

    const rowsPanel = (
        <>
            {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 24 }}>
                    <Loader className="animate-spin" size={22} />
                    {t('loading.rows')}
                </div>
            ) : (
                <>
                    <section className="premium-table stock-movements-table" style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
                            <thead>
                                <tr className="table-header-row">
                                    <th className="table-th">{t('th.when')}</th>
                                    <th className="table-th">{t('th.whatHappened')}</th>
                                    <th className="table-th">{t('th.qtyChange')}</th>
                                    <th className="table-th">{t('th.stockBeforeAfter')}</th>
                                    <th className="table-th">{t('th.howRecorded')}</th>
                                    <th className="table-th">{t('th.invoiceOrLink')}</th>
                                    <th className="table-th">{t('th.note')}</th>
                                    <th className="table-th">{t('th.staff')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(entries || []).length === 0 ? (
                                    <tr>
                                        <td className="table-cell" colSpan={8} style={{ textAlign: 'center', padding: 24 }}>
                                            {t('empty.noStockChanges')}
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
                                                        return code && code !== '—' ? t('modal.systemCode', { code }) : undefined;
                                                    })()}
                                                >
                                                    {movementWhatHappenedLabel(e, t)}
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
                                                    return code && code !== '—' ? t('modal.systemCode', { code }) : undefined;
                                                })()}
                                            >
                                                {humanizeMovementSource(e.source, t)}
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
                                {t('modal.pageRows', { page, totalPages, total })}
                            </span>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    disabled={offset <= 0}
                                    onClick={() => onOffsetChange(Math.max(0, offset - limit))}
                                >
                                    {t('btn.previous')}
                                </button>
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    disabled={offset + limit >= total}
                                    onClick={() => onOffsetChange(offset + limit)}
                                >
                                    {t('btn.next')}
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
                <strong>{t('modal.headsUp')}</strong> {t('modal.summaryHint')}
            </p>
            {product && (
                <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>
                    {displayCell(product.name)}{' '}
                    <span style={{ fontWeight: 500, color: '#64748b' }}>
                        {t('modal.codeUnit', { sku: displayCell(product.sku), unit: displayCell(product.unit) })}
                    </span>
                </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
                <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">{t('label.fromDate')}</label>
                    <input type="date" className="form-input-field" value={from} onChange={(e) => onFromChange(e.target.value)} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">{t('label.toDate')}</label>
                    <input type="date" className="form-input-field" value={to} onChange={(e) => onToChange(e.target.value)} />
                </div>
                <button type="button" className="btn-portal" style={{ padding: '10px 16px', marginBottom: 2 }} onClick={onApplyDates}>
                    {t('btn.applyDates')}
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
                    { id: 'totals', label: t('modal.tabTotals'), panel: summaryPanel },
                    { id: 'rows', label: t('modal.tabRows'), panel: rowsPanel },
                ]}
            />
        </div>
    );
}

export default function StockMovementsSuperAdmin() {
    const outletCtx = useOutletContext() || {};
    const locale = outletCtx.locale || (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) || 'en';
    const t = useCallback((key, vars) => smT(locale, key, vars), [locale]);

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
    const [ledgerFrom, setLedgerFrom] = useState('');
    const [ledgerTo, setLedgerTo] = useState('');
    const [appliedLedgerFrom, setAppliedLedgerFrom] = useState('');
    const [appliedLedgerTo, setAppliedLedgerTo] = useState('');
    const [ledgerSearchQuery, setLedgerSearchQuery] = useState('');
    const [appliedLedgerSearch, setAppliedLedgerSearch] = useState('');
    const [ledgerProductId, setLedgerProductId] = useState('');
    const [ledgerSuggestOpen, setLedgerSuggestOpen] = useState(false);
    const [ledgerSuggestIndex, setLedgerSuggestIndex] = useState(-1);
    const ledgerSearchBlurTimerRef = useRef(null);
    const ledgerSuggestDropdownRef = useRef(null);

    const [branchFrom, setBranchFrom] = useState('');
    const [branchTo, setBranchTo] = useState('');
    const [appliedBranchFrom, setAppliedBranchFrom] = useState('');
    const [appliedBranchTo, setAppliedBranchTo] = useState('');
    const [branchAdjustments, setBranchAdjustments] = useState([]);
    const [branchAdjustmentSummary, setBranchAdjustmentSummary] = useState(null);
    const [loadingBranchAdjustments, setLoadingBranchAdjustments] = useState(false);
    const [branchAdjustmentsError, setBranchAdjustmentsError] = useState('');

    const [adjustProduct, setAdjustProduct] = useState(null);
    const [adjustReason, setAdjustReason] = useState('');
    const [adjustNote, setAdjustNote] = useState('');
    const [adjustNewQty, setAdjustNewQty] = useState('');
    const [adjustSaving, setAdjustSaving] = useState(false);
    const [adjustError, setAdjustError] = useState('');

    const [criticalEditProductId, setCriticalEditProductId] = useState(null);
    const [criticalDraft, setCriticalDraft] = useState('');
    const [criticalSaving, setCriticalSaving] = useState(false);
    const [criticalHint, setCriticalHint] = useState('');
    const criticalInputRef = useRef(null);

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
                const params = {
                    limit: LEDGER_LIMIT,
                    offset: ledgerOffset,
                    ...(selectedWorkshopId ? { workshopId: selectedWorkshopId } : {}),
                    ...(selectedBranchId ? { branchId: selectedBranchId } : {}),
                    ...(appliedLedgerFrom ? { from: appliedLedgerFrom } : {}),
                    ...(appliedLedgerTo ? { to: appliedLedgerTo } : {}),
                };
                if (ledgerProductId) {
                    params.productId = ledgerProductId;
                } else if (appliedLedgerSearch) {
                    params.search = appliedLedgerSearch;
                }
                const res = await getSuperAdminInventoryLedger(params);
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
                    setLedgerError(e?.message || t('err.loadLedger'));
                }
            } finally {
                if (!cancelled) setLoadingLedger(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [
        pageTab,
        ledgerOffset,
        selectedWorkshopId,
        selectedBranchId,
        appliedLedgerFrom,
        appliedLedgerTo,
        ledgerProductId,
        appliedLedgerSearch,
        t,
    ]);

    useEffect(() => {
        if (!selectedWorkshopId || !selectedBranchId) {
            setBranchAdjustments([]);
            setBranchAdjustmentSummary(null);
            setBranchAdjustmentsError('');
            return undefined;
        }
        let cancelled = false;
        (async () => {
            setLoadingBranchAdjustments(true);
            setBranchAdjustmentsError('');
            try {
                const all = [];
                let offset = 0;
                let summary = null;
                for (;;) {
                    const res = await getSuperAdminInventoryLedger({
                        workshopId: selectedWorkshopId,
                        branchId: selectedBranchId,
                        kind: 'adjustment',
                        ...(appliedBranchFrom ? { from: appliedBranchFrom } : {}),
                        ...(appliedBranchTo ? { to: appliedBranchTo } : {}),
                        limit: ADJUSTMENT_LEDGER_LIMIT,
                        offset,
                    });
                    if (cancelled) return;
                    const data = unwrapData(res);
                    if (offset === 0 && data?.summary) summary = data.summary;
                    const list = data?.entries ?? [];
                    if (Array.isArray(list)) all.push(...list);
                    const total = Number(data?.total ?? 0) || 0;
                    if (list.length < ADJUSTMENT_LEDGER_LIMIT || all.length >= total) break;
                    offset += ADJUSTMENT_LEDGER_LIMIT;
                }
                setBranchAdjustments(all);
                setBranchAdjustmentSummary(summary);
            } catch (e) {
                if (!cancelled) {
                    setBranchAdjustments([]);
                    setBranchAdjustmentSummary(null);
                    setBranchAdjustmentsError(e?.message || t('err.loadAdjustments'));
                }
            } finally {
                if (!cancelled) setLoadingBranchAdjustments(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [selectedWorkshopId, selectedBranchId, appliedBranchFrom, appliedBranchTo, t]);

    const catalogPurchasePriceByProductId = useMemo(() => {
        const map = {};
        for (const p of branchProductCatalog) {
            const id = String(p.productId ?? '');
            if (!id) continue;
            const n = Number(p.purchasePrice);
            if (Number.isFinite(n)) map[id] = n;
        }
        return map;
    }, [branchProductCatalog]);

    const enrichedBranchAdjustments = useMemo(() => {
        return branchAdjustments.map((row) => {
            const pid = String(row?.product?.id ?? '');
            const apiPrice = Number(row?.product?.purchasePrice);
            if (Number.isFinite(apiPrice) && apiPrice > 0) return row;
            const catalog = Number(catalogPurchasePriceByProductId[pid]);
            if (!Number.isFinite(catalog) || catalog <= 0) return row;
            return {
                ...row,
                product: {
                    ...row.product,
                    purchasePrice: catalog,
                    purchasePriceSource: row.product?.purchasePriceSource ?? 'profile',
                },
            };
        });
    }, [branchAdjustments, catalogPurchasePriceByProductId]);

    const metricsForAdjustmentRow = useCallback(
        (row) => adjustmentRowMetrics(row, catalogPurchasePriceByProductId),
        [catalogPurchasePriceByProductId],
    );

    const adjustmentKpis = useMemo(() => {
        if (branchAdjustmentSummary) {
            return {
                count: Number(branchAdjustmentSummary.count) || 0,
                totalValueBefore: Number(branchAdjustmentSummary.totalValueBefore) || 0,
                totalValueAfter: Number(branchAdjustmentSummary.totalValueAfter) || 0,
                totalDiffValue: Number(branchAdjustmentSummary.totalDiffValue) || 0,
                totalDiffQty: Number(branchAdjustmentSummary.totalDiffQty) || 0,
            };
        }
        let totalValueBefore = 0;
        let totalValueAfter = 0;
        let totalDiffQty = 0;
        for (const row of enrichedBranchAdjustments) {
            const m = adjustmentRowMetrics(row, catalogPurchasePriceByProductId);
            totalValueBefore += m.valueBefore;
            totalValueAfter += m.valueAfter;
            totalDiffQty += m.diffQty;
        }
        return {
            count: enrichedBranchAdjustments.length,
            totalValueBefore,
            totalValueAfter,
            totalDiffValue: totalValueAfter - totalValueBefore,
            totalDiffQty,
        };
    }, [
        enrichedBranchAdjustments,
        branchAdjustmentSummary,
        catalogPurchasePriceByProductId,
    ]);

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
            setProductsError(e?.message || t('err.loadProducts'));
        } finally {
            setLoadingProducts(false);
        }
    }, [selectedWorkshopId, selectedBranchId, t]);

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

    const ledgerSearchSuggestions = useMemo(() => {
        if (!normalizeInventorySearchValue(ledgerSearchQuery)) return [];
        const pool = branchProductCatalog.length
            ? branchProductCatalog
            : ledgerEntries.map((e) => ({
                  productId: e?.product?.id,
                  name: e?.product?.name,
                  sku: e?.product?.sku,
                  brandName: e?.product?.brandName,
              }));
        return pool
            .filter((p) => matchesProductNameSearch(toInventorySearchRow(p), ledgerSearchQuery))
            .slice(0, INV_SEARCH_SUGGEST_LIMIT);
    }, [branchProductCatalog, ledgerSearchQuery, ledgerEntries]);

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
                setOpeningHint(t('err.validNumber'));
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
                setOpeningHint(e?.message || t('err.couldNotSave'));
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
            t,
        ],
    );

    useEffect(() => {
        cancelOpeningEdit();
        setCriticalEditProductId(null);
        setCriticalDraft('');
        setCriticalHint('');
    }, [selectedWorkshopId, selectedBranchId, gridOffset, searchQuery, cancelOpeningEdit]);

    useEffect(() => {
        if (!criticalHint) return undefined;
        const t = setTimeout(() => setCriticalHint(''), 4500);
        return () => clearTimeout(t);
    }, [criticalHint]);

    useEffect(() => {
        if (!criticalEditProductId) return;
        const el = criticalInputRef.current;
        if (el) {
            el.focus();
            el.select();
        }
    }, [criticalEditProductId]);

    const cancelCriticalEdit = useCallback(() => {
        setCriticalEditProductId(null);
        setCriticalDraft('');
        setCriticalHint('');
        setCriticalSaving(false);
    }, []);

    const beginCriticalEdit = useCallback((product) => {
        setCriticalHint('');
        setCriticalEditProductId(String(product.productId));
        setCriticalDraft(String(product.criticalStockPoint ?? ''));
    }, []);

    const saveCriticalEdit = useCallback(
        async (product) => {
            const trimmed = String(criticalDraft).trim();
            const parsed = Number(trimmed);
            if (trimmed === '' || Number.isNaN(parsed) || parsed < 0) {
                setCriticalHint(t('err.validNumberGte0'));
                return;
            }
            const prevNum = Number(product.criticalStockPoint ?? 0);
            if (parsed === prevNum) {
                cancelCriticalEdit();
                return;
            }
            setCriticalSaving(true);
            setCriticalHint('');
            try {
                const res = await patchBranchProduct(
                    selectedBranchId,
                    product.productId,
                    { criticalStockPoint: parsed },
                    { workshopId: selectedWorkshopId },
                );
                const data = unwrapData(res);
                applyProductStockPatch(product.productId, {
                    criticalStockPoint: data?.criticalStockPoint ?? parsed,
                });
                cancelCriticalEdit();
            } catch (e) {
                setCriticalHint(e?.message || t('err.couldNotSave'));
            } finally {
                setCriticalSaving(false);
            }
        },
        [criticalDraft, selectedWorkshopId, selectedBranchId, applyProductStockPatch, cancelCriticalEdit, t],
    );

    const openAdjustModal = useCallback((product) => {
        setAdjustProduct(product);
        setAdjustReason('');
        setAdjustNote('');
        setAdjustNewQty(String(product.currentQty ?? ''));
        setAdjustError('');
        setAdjustSaving(false);
    }, []);

    const closeAdjustModal = useCallback(() => {
        if (adjustSaving) return;
        setAdjustProduct(null);
        setAdjustReason('');
        setAdjustNote('');
        setAdjustNewQty('');
        setAdjustError('');
    }, [adjustSaving]);

    const submitAdjust = useCallback(async () => {
        if (!adjustProduct || !selectedWorkshopId || !selectedBranchId) return;
        const reason = String(adjustReason || '').trim();
        if (!reason) {
            setAdjustError(t('err.selectReason'));
            return;
        }
        const isInfinite = reason === INVENTORY_ADJUSTMENT_REASON_INFINITE_QTY;
        const isOpening = reason === INVENTORY_ADJUSTMENT_REASON_OPENING_QTY;
        let newQtyNum;
        if (!isInfinite) {
            newQtyNum = Number.parseFloat(String(adjustNewQty).trim().replace(/,/g, ''));
            if (!Number.isFinite(newQtyNum) || newQtyNum < 0) {
                setAdjustError(t('err.validQtyGte0'));
                return;
            }
            newQtyNum = Math.round(newQtyNum);
            const baseline = isOpening
                ? Number(adjustProduct.openingQty ?? adjustProduct.currentQty) || 0
                : Number(adjustProduct.currentQty) || 0;
            if (newQtyNum === baseline) {
                setAdjustError(t('err.qtyUnchanged'));
                return;
            }
        }
        setAdjustSaving(true);
        setAdjustError('');
        try {
            const body = {
                reason,
                ...(adjustNote.trim() ? { note: adjustNote.trim() } : {}),
            };
            if (!isInfinite) {
                body.newQty = newQtyNum;
                body.previousQty = Number(adjustProduct.currentQty) || 0;
            } else {
                body.newQty = 0;
            }
            const res = await postBranchProductInventoryAdjustment(
                selectedBranchId,
                adjustProduct.productId,
                body,
                { workshopId: selectedWorkshopId },
            );
            const data = unwrapData(res);
            applyProductStockPatch(adjustProduct.productId, {
                currentQty: data?.qtyOnHand ?? data?.qty_on_hand ?? newQtyNum,
                openingQty: data?.openingQty ?? data?.opening_qty ?? adjustProduct.openingQty,
                reservedQty: data?.reservedQty ?? data?.reserved_qty,
                availableQty: data?.availableQty ?? data?.available_qty,
            });
            closeAdjustModal();
            void loadBranchProductCatalog();
            const all = [];
            let adjOffset = 0;
            let summary = null;
            for (;;) {
                const ledgerRes = await getSuperAdminInventoryLedger({
                    workshopId: selectedWorkshopId,
                    branchId: selectedBranchId,
                    kind: 'adjustment',
                    ...(appliedBranchFrom ? { from: appliedBranchFrom } : {}),
                    ...(appliedBranchTo ? { to: appliedBranchTo } : {}),
                    limit: ADJUSTMENT_LEDGER_LIMIT,
                    offset: adjOffset,
                });
                const ledgerData = unwrapData(ledgerRes);
                if (adjOffset === 0 && ledgerData?.summary) summary = ledgerData.summary;
                const list = ledgerData?.entries ?? [];
                if (Array.isArray(list)) all.push(...list);
                const total = Number(ledgerData?.total ?? 0) || 0;
                if (list.length < ADJUSTMENT_LEDGER_LIMIT || all.length >= total) break;
                adjOffset += ADJUSTMENT_LEDGER_LIMIT;
            }
            setBranchAdjustments(all);
            setBranchAdjustmentSummary(summary);
        } catch (e) {
            setAdjustError(e?.message || t('err.saveAdjustment'));
        } finally {
            setAdjustSaving(false);
        }
    }, [
        adjustProduct,
        adjustReason,
        adjustNote,
        adjustNewQty,
        selectedWorkshopId,
        selectedBranchId,
        applyProductStockPatch,
        closeAdjustModal,
        loadBranchProductCatalog,
        appliedBranchFrom,
        appliedBranchTo,
        t,
    ]);

    const applyLedgerFilters = useCallback(() => {
        setAppliedLedgerFrom(ledgerFrom);
        setAppliedLedgerTo(ledgerTo);
        if (!ledgerProductId) {
            setAppliedLedgerSearch(ledgerSearchQuery.trim());
        } else {
            setAppliedLedgerSearch('');
        }
        setLedgerOffset(0);
    }, [ledgerFrom, ledgerTo, ledgerSearchQuery, ledgerProductId]);

    const clearLedgerFilters = useCallback(() => {
        setLedgerFrom('');
        setLedgerTo('');
        setAppliedLedgerFrom('');
        setAppliedLedgerTo('');
        setLedgerSearchQuery('');
        setAppliedLedgerSearch('');
        setLedgerProductId('');
        setLedgerSuggestOpen(false);
        setLedgerSuggestIndex(-1);
        setLedgerOffset(0);
    }, []);

    const applyBranchDateFilters = useCallback(() => {
        setAppliedBranchFrom(branchFrom);
        setAppliedBranchTo(branchTo);
    }, [branchFrom, branchTo]);

    const clearBranchDateFilters = useCallback(() => {
        setBranchFrom('');
        setBranchTo('');
        setAppliedBranchFrom('');
        setAppliedBranchTo('');
    }, []);

    const applyLedgerSearchSuggestion = useCallback((row) => {
        setLedgerSearchQuery(inventorySearchValueFromRow(toInventorySearchRow(row)));
        setLedgerProductId(String(row.productId ?? row?.product?.id ?? ''));
        setAppliedLedgerSearch('');
        setLedgerSuggestOpen(false);
        setLedgerSuggestIndex(-1);
        setLedgerOffset(0);
    }, []);

    const clearLedgerSearchBlurTimer = useCallback(() => {
        if (ledgerSearchBlurTimerRef.current != null) {
            clearTimeout(ledgerSearchBlurTimerRef.current);
            ledgerSearchBlurTimerRef.current = null;
        }
    }, []);

    useEffect(() => () => clearLedgerSearchBlurTimer(), [clearLedgerSearchBlurTimer]);

    const onLedgerSearchKeyDown = useCallback(
        (e) => {
            if (e.key === 'ArrowDown') {
                if (!ledgerSearchSuggestions.length) return;
                e.preventDefault();
                setLedgerSuggestOpen(true);
                setLedgerSuggestIndex((i) => {
                    if (i < 0) return 0;
                    return Math.min(i + 1, ledgerSearchSuggestions.length - 1);
                });
                return;
            }
            if (e.key === 'ArrowUp') {
                if (!ledgerSearchSuggestions.length) return;
                e.preventDefault();
                setLedgerSuggestOpen(true);
                setLedgerSuggestIndex((i) => (i <= 0 ? -1 : i - 1));
                return;
            }
            if (e.key === 'Enter') {
                if (ledgerSuggestOpen && ledgerSuggestIndex >= 0 && ledgerSearchSuggestions[ledgerSuggestIndex]) {
                    e.preventDefault();
                    applyLedgerSearchSuggestion(ledgerSearchSuggestions[ledgerSuggestIndex]);
                }
                return;
            }
            if (e.key === 'Escape') {
                setLedgerSuggestOpen(false);
                setLedgerSuggestIndex(-1);
            }
        },
        [ledgerSearchSuggestions, ledgerSuggestOpen, ledgerSuggestIndex, applyLedgerSearchSuggestion],
    );

    useLayoutEffect(() => {
        if (!ledgerSuggestOpen || ledgerSuggestIndex < 0) return;
        const list = ledgerSuggestDropdownRef.current;
        const item = list?.querySelector(`#sm-ledger-inv-suggest-${ledgerSuggestIndex}`);
        if (!list || !item) return;
        const padding = 6;
        const listRect = list.getBoundingClientRect();
        const itemRect = item.getBoundingClientRect();
        if (itemRect.bottom > listRect.bottom - padding) {
            list.scrollTop += itemRect.bottom - listRect.bottom + padding;
        } else if (itemRect.top < listRect.top + padding) {
            list.scrollTop -= listRect.top - itemRect.top + padding;
        }
    }, [ledgerSuggestIndex, ledgerSuggestOpen, ledgerSearchSuggestions]);

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

    const exportAdjustmentPdf = useCallback(() => {
        if (!enrichedBranchAdjustments.length) return;
        exportAdjustmentReportPdf({
            adjustments: enrichedBranchAdjustments,
            metricsForRow: metricsForAdjustmentRow,
            formatWhen: formatLedgerWhen,
            displayCell,
            workshop: displayCell(gridMeta.workshop),
            branch: displayCell(gridMeta.branch),
            from: appliedBranchFrom,
            to: appliedBranchTo,
            kpis: adjustmentKpis,
        });
    }, [
        enrichedBranchAdjustments,
        metricsForAdjustmentRow,
        gridMeta.workshop,
        gridMeta.branch,
        appliedBranchFrom,
        appliedBranchTo,
        adjustmentKpis,
    ]);

    const exportAdjustmentExcel = useCallback(() => {
        if (!enrichedBranchAdjustments.length) return;
        exportAdjustmentReportExcel({
            adjustments: enrichedBranchAdjustments,
            metricsForRow: metricsForAdjustmentRow,
            formatWhen: formatLedgerWhen,
            displayCell,
            workshop: displayCell(gridMeta.workshop),
            branch: displayCell(gridMeta.branch),
        });
    }, [enrichedBranchAdjustments, metricsForAdjustmentRow, gridMeta.workshop, gridMeta.branch]);

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
                    <h1 className="stock-movements-title">{t('page.title')}</h1>
                    <p className="stock-movements-subtitle">
                        <strong>{t('page.subtitle.branch')}</strong>{t('page.subtitle.branchBody')}{' '}
                        <strong>{t('page.subtitle.adj')}</strong>{t('page.subtitle.adjBody')}{' '}
                        <strong>{t('page.subtitle.ledger')}</strong>{t('page.subtitle.ledgerBody')}
                    </p>
                </div>
                <button
                    type="button"
                    className="btn-export"
                    disabled={pageTab !== 'branch-stock' || !filteredBranchProducts.length}
                    onClick={exportGridCsv}
                >
                    <Download size={16} /> {t('btn.downloadCsv')}
                </button>
            </header>

            <div className="stock-movements-context-bar">
                <div className="stock-movements-context-field">
                    <label className="log-filter-label">{t('label.workshop')}</label>
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
                        <option value="">{loadingWorkshops ? t('opt.loading') : t('opt.chooseWorkshop')}</option>
                        {workshopDropdown.map((w) => (
                            <option key={w.id} value={w.id}>
                                {displayCell(w.name)}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="stock-movements-context-field">
                    <label className="log-filter-label">{t('label.branch')}</label>
                    <select
                        className="movements-filter-select"
                        style={{ minWidth: 200 }}
                        value={selectedBranchId}
                        onChange={(e) => setSelectedBranchId(e.target.value)}
                        disabled={!selectedWorkshopId || loadingBranches}
                    >
                        <option value="">{!selectedWorkshopId ? t('opt.chooseWorkshopFirst') : loadingBranches ? t('opt.loading') : t('opt.chooseBranch')}</option>
                        {branches.map((b) => (
                            <option key={b.id} value={b.id}>
                                {displayCell(b.name)}
                            </option>
                        ))}
                    </select>
                </div>
                {gridMeta.workshop && gridMeta.branch ? (
                    <p className="stock-movements-context-hint">
                        {t('hint.nowViewing')} <strong>{displayCell(gridMeta.workshop)}</strong> — <strong>{displayCell(gridMeta.branch)}</strong>
                    </p>
                ) : null}
            </div>

            <UniversalTabs
                idPrefix="sm-page"
                className="stock-movements-page-tabs"
                value={pageTab}
                onChange={setPageTab}
                tabs={[
                    {
                        id: 'branch-stock',
                        label: t('tab.branchStock'),
                        panel: (
                            <>
            <div className="stock-movements-filter-bar">
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                        className="mc-filter-select-wrapper mc-inv-search-combo"
                        style={{ position: 'relative', width: '100%' }}
                    >
                        <Search className="mc-filter-icon" size={16} />
                        <input
                            type="text"
                            placeholder={t('search.placeholder')}
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
                                aria-label={t('search.clear')}
                                title={t('search.clear')}
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
                                aria-label={t('search.matching')}
                                onMouseDown={(ev) => ev.preventDefault()}
                            >
                                {invSearchSuggestions.length === 0 ? (
                                    <div className="mc-inv-search-dropdown-empty">{t('search.noMatch')}</div>
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
                        {t('search.showing', { n: filteredBranchProducts.length, m: branchProductCatalog.length })}
                        {searchQuery ? t('search.forQuery', { q: searchQuery }) : ''}.
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#64748b' }}>
                        {t('search.kbdHint')}
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
                            <th className="table-th">{t('th.product')}</th>
                            <th className="table-th">{t('th.sku')}</th>
                            <th className="table-th">{t('th.brand')}</th>
                            <th className="table-th">{t('th.unit')}</th>
                            <GridQtyTh label={t('th.stockNow')} apiField="currentQty" t={t} />
                            <GridQtyTh label={t('th.reserved')} apiField="reservedQty" t={t} />
                            <GridQtyTh label={t('th.freeToUse')} apiField="availableQty" t={t} />
                            <GridQtyTh label={t('th.critical')} apiField="criticalStockPoint" t={t} />
                            <GridQtyTh label={t('th.startingStock')} apiField="openingQty" t={t} />
                            <GridQtyTh label={t('th.inUse')} apiField="isActive" t={t} />
                            <th className="table-th">{t('th.actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loadingProducts ? (
                            <tr>
                                <td className="table-cell" colSpan={11} style={{ textAlign: 'center', padding: 32 }}>
                                    <Loader className="animate-spin" size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                                    {t('loading.list')}
                                </td>
                            </tr>
                        ) : !selectedWorkshopId || !selectedBranchId ? (
                            <tr>
                                <td className="table-cell" colSpan={11} style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>
                                    {t('empty.pickWorkshopBranch')}
                                </td>
                            </tr>
                        ) : filteredBranchProducts.length === 0 ? (
                            <tr>
                                <td className="table-cell" colSpan={11} style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>
                                    {branchProductCatalog.length === 0
                                        ? t('empty.noProductsBranch')
                                        : t('empty.noProductsSearch')}
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
                                    <td className="table-cell critical-stock-cell">
                                        {String(criticalEditProductId) === String(p.productId) ? (
                                            <div className="opening-qty-editor">
                                                <input
                                                    ref={criticalInputRef}
                                                    type="number"
                                                    step="any"
                                                    min={0}
                                                    className="opening-qty-input"
                                                    value={criticalDraft}
                                                    disabled={criticalSaving}
                                                    onChange={(e) => setCriticalDraft(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            void saveCriticalEdit(p);
                                                        } else if (e.key === 'Escape') {
                                                            e.preventDefault();
                                                            cancelCriticalEdit();
                                                        }
                                                    }}
                                                    aria-label={t('aria.critical')}
                                                />
                                                {criticalSaving ? (
                                                    <Loader className="animate-spin opening-qty-spinner" size={14} />
                                                ) : null}
                                                {criticalHint ? (
                                                    <span className="opening-qty-hint">{criticalHint}</span>
                                                ) : null}
                                            </div>
                                        ) : (
                                            <span className="opening-qty-readonly">{formatNum(p.criticalStockPoint)}</span>
                                        )}
                                    </td>
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
                                                    aria-label={t('aria.starting')}
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
                                            {p.isActive ? t('status.on') : t('status.off')}
                                        </span>
                                    </td>
                                    <td className="table-cell">
                                        <div className="stock-row-actions">
                                            {String(criticalEditProductId) === String(p.productId) ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        className="btn-edit"
                                                        onClick={() => void saveCriticalEdit(p)}
                                                        disabled={criticalSaving || loadingProducts}
                                                        title={t('title.saveCritical')}
                                                    >
                                                        {t('btn.save')}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn-secondary"
                                                        onClick={cancelCriticalEdit}
                                                        disabled={criticalSaving}
                                                    >
                                                        {t('btn.cancel')}
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="btn-edit"
                                                    onClick={() => beginCriticalEdit(p)}
                                                    disabled={
                                                        loadingProducts ||
                                                        !selectedWorkshopId ||
                                                        !selectedBranchId ||
                                                        criticalSaving ||
                                                        String(openingEditProductId) === String(p.productId)
                                                    }
                                                    title={t('title.editCritical')}
                                                >
                                                    <Pencil size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                                                    {t('btn.critical')}
                                                </button>
                                            )}
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
                                                        title={t('title.saveStarting')}
                                                    >
                                                        {t('btn.save')}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn-secondary"
                                                        onClick={cancelOpeningEdit}
                                                        disabled={openingSaving}
                                                    >
                                                        {t('btn.cancel')}
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
                                                    title={t('title.editStarting')}
                                                >
                                                    <Pencil size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                                                    {t('btn.edit')}
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                className="btn-edit"
                                                onClick={() => openAdjustModal(p)}
                                                disabled={
                                                    loadingProducts ||
                                                    !selectedWorkshopId ||
                                                    !selectedBranchId ||
                                                    adjustSaving ||
                                                    (String(openingEditProductId) === String(p.productId) && openingSaving) ||
                                                    String(criticalEditProductId) === String(p.productId)
                                                }
                                                title={t('title.adjust')}
                                            >
                                                <SlidersHorizontal size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                                                {t('btn.adjust')}
                                            </button>
                                            <button
                                                type="button"
                                                className="btn-edit"
                                                onClick={() => setBranchMovementProduct(p)}
                                                disabled={
                                                    String(openingEditProductId) === String(p.productId) &&
                                                    openingSaving
                                                }
                                                title={t('title.viewHistory')}
                                            >
                                                <ListTree size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                                                {t('btn.viewHistory')}
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
                        {t('page.products', { page: gridPage, totalPages: gridTotalPages, total: gridMeta.total })}
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            type="button"
                            className="btn-secondary"
                            disabled={gridOffset <= 0}
                            onClick={() => setGridOffset((o) => Math.max(0, o - GRID_LIMIT))}
                        >
                            {t('btn.previous')}
                        </button>
                        <button
                            type="button"
                            className="btn-secondary"
                            disabled={gridOffset + GRID_LIMIT >= gridMeta.total}
                            onClick={() => setGridOffset((o) => o + GRID_LIMIT)}
                        >
                            {t('btn.next')}
                        </button>
                    </div>
                </div>
            ) : null}
                            </>
                        ),
                    },
                    {
                        id: 'adjustment-report',
                        label: t('tab.adjustments'),
                        panel: (
                            <>
                                {!selectedWorkshopId || !selectedBranchId ? (
                                    <p style={{ margin: 0, padding: 32, textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
                                        {t('empty.pickForAdjustments')}
                                    </p>
                                ) : (
                                    <>
                                        <div className="stock-movements-filter-bar" style={{ marginBottom: 16 }}>
                                            <div className="form-group" style={{ margin: 0 }}>
                                                <label className="form-label">{t('label.fromDate')}</label>
                                                <input type="date" className="form-input-field" value={branchFrom} onChange={(e) => setBranchFrom(e.target.value)} />
                                            </div>
                                            <div className="form-group" style={{ margin: 0 }}>
                                                <label className="form-label">{t('label.toDate')}</label>
                                                <input type="date" className="form-input-field" value={branchTo} onChange={(e) => setBranchTo(e.target.value)} />
                                            </div>
                                            <button type="button" className="btn-portal" style={{ padding: '10px 16px', marginBottom: 2 }} onClick={applyBranchDateFilters}>
                                                {t('btn.applyDates')}
                                            </button>
                                            {(appliedBranchFrom || appliedBranchTo) ? (
                                                <button type="button" className="btn-secondary" style={{ marginBottom: 2 }} onClick={clearBranchDateFilters}>
                                                    {t('btn.clearDates')}
                                                </button>
                                            ) : null}
                                            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                                <button
                                                    type="button"
                                                    className="btn-export"
                                                    disabled={loadingBranchAdjustments || !enrichedBranchAdjustments.length}
                                                    onClick={exportAdjustmentPdf}
                                                >
                                                    <Download size={16} /> {t('btn.downloadPdf')}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn-export"
                                                    disabled={loadingBranchAdjustments || !enrichedBranchAdjustments.length}
                                                    onClick={exportAdjustmentExcel}
                                                >
                                                    <Download size={16} /> {t('btn.downloadExcel')}
                                                </button>
                                            </div>
                                        </div>
                                        <p style={{ margin: '0 0 12px', fontSize: '0.8125rem', color: '#64748b' }}>
                                            {t('adj.intro')}{' '}
                                            <strong>{displayCell(gridMeta.branch)}</strong>
                                            {appliedBranchFrom || appliedBranchTo
                                                ? t('adj.fromTo', { from: appliedBranchFrom || '…', to: appliedBranchTo || '…' })
                                                : t('adj.allDates')}
                                            {t('adj.introTail')}
                                        </p>
                                        {branchAdjustmentsError ? (
                                            <div style={{ padding: 12, marginBottom: 12, background: '#FEF2F2', color: '#B91C1C', borderRadius: 8, fontSize: '0.875rem' }}>
                                                {branchAdjustmentsError}
                                            </div>
                                        ) : null}
                                        {!loadingBranchAdjustments && enrichedBranchAdjustments.length > 0 ? (
                                            <div className="stock-movements-summary" style={{ marginBottom: 20 }}>
                                                <div className="movement-summary-card">
                                                    <div className="summary-main">
                                                        <div className="summary-info">
                                                            <span className="summary-label">{t('adj.kpiValueBefore')}</span>
                                                            <span className="summary-value">{t('adj.sar', { amount: formatSar(adjustmentKpis.totalValueBefore) })}</span>
                                                        </div>
                                                        <div className="summary-icon-box in">
                                                            <TrendingUp size={20} />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="movement-summary-card">
                                                    <div className="summary-main">
                                                        <div className="summary-info">
                                                            <span className="summary-label">{t('adj.kpiValueAfter')}</span>
                                                            <span className="summary-value">{t('adj.sar', { amount: formatSar(adjustmentKpis.totalValueAfter) })}</span>
                                                        </div>
                                                        <div className="summary-icon-box out">
                                                            <TrendingDown size={20} />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="movement-summary-card">
                                                    <div className="summary-main">
                                                        <div className="summary-info">
                                                            <span className="summary-label">
                                                                {adjustmentKpis.count !== 1
                                                                    ? t('adj.kpiDiffPlural', { count: adjustmentKpis.count })
                                                                    : t('adj.kpiDiff', { count: adjustmentKpis.count })}
                                                            </span>
                                                            <span
                                                                className="summary-value"
                                                                style={{
                                                                    color:
                                                                        adjustmentKpis.totalDiffValue > 0
                                                                            ? '#059669'
                                                                            : adjustmentKpis.totalDiffValue < 0
                                                                              ? '#b91c1c'
                                                                              : undefined,
                                                                }}
                                                            >
                                                                {formatSignedSar(adjustmentKpis.totalDiffValue)}
                                                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginLeft: 8 }}>
                                                                    {t('adj.qty', { qty: formatSignedQty(adjustmentKpis.totalDiffQty) })}
                                                                </span>
                                                            </span>
                                                        </div>
                                                        <div className="summary-icon-box net">
                                                            <LayoutGrid size={20} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : null}
                                        <section className="premium-table stock-movements-table" style={{ overflowX: 'auto' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1180 }}>
                                                <thead>
                                                    <tr className="table-header-row">
                                                        <th className="table-th">{t('th.when')}</th>
                                                        <th className="table-th">{t('th.product')}</th>
                                                        <th className="table-th">{t('th.reasonNote')}</th>
                                                        <th className="table-th">{t('th.purchaseValue')}</th>
                                                        <th className="table-th">{t('th.stockBefore')}</th>
                                                        <th className="table-th">{t('th.stockAfter')}</th>
                                                        <th className="table-th">{t('th.valueBefore')}</th>
                                                        <th className="table-th">{t('th.valueAfter')}</th>
                                                        <th className="table-th">{t('th.diffQty')}</th>
                                                        <th className="table-th">{t('th.diffValue')}</th>
                                                        <th className="table-th">{t('th.changedBy')}</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {loadingBranchAdjustments ? (
                                                        <tr>
                                                            <td className="table-cell" colSpan={11} style={{ textAlign: 'center', padding: 24 }}>
                                                                <Loader className="animate-spin" size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                                                                {t('loading.adjustments')}
                                                            </td>
                                                        </tr>
                                                    ) : enrichedBranchAdjustments.length === 0 ? (
                                                        <tr>
                                                            <td className="table-cell" colSpan={11} style={{ textAlign: 'center', padding: 24, color: '#64748b' }}>
                                                                {t('empty.noAdjustments')}{appliedBranchFrom || appliedBranchTo ? t('empty.inDateRange') : ''}.
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        enrichedBranchAdjustments.map((row, idx) => {
                                                            const m = metricsForAdjustmentRow(row);
                                                            const pr = row.product ?? {};
                                                            const priceSource =
                                                                pr.purchasePriceSource === 'last_purchase'
                                                                    ? t('adj.priceLastPurchase')
                                                                    : pr.purchasePriceSource === 'profile'
                                                                      ? t('adj.priceProfile')
                                                                      : undefined;
                                                            const diffQtyColor =
                                                                m.diffQty > 0 ? '#059669' : m.diffQty < 0 ? '#b91c1c' : undefined;
                                                            const diffValueColor =
                                                                m.diffValue > 0 ? '#059669' : m.diffValue < 0 ? '#b91c1c' : undefined;
                                                            return (
                                                                <tr key={row.id != null ? String(row.id) : `adj-${idx}`} className="table-row">
                                                                    <td className="table-cell" style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                                                                        {formatLedgerWhen(row)}
                                                                    </td>
                                                                    <td className="table-cell">
                                                                        <span className="cell-main-text">{displayCell(pr.name)}</span>
                                                                        {pr.sku ? (
                                                                            <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: 2 }}>
                                                                                {displayCell(pr.sku)}
                                                                            </div>
                                                                        ) : null}
                                                                    </td>
                                                                    <td className="table-cell text-muted" style={{ fontSize: '0.8125rem' }}>
                                                                        {displayCell(row.note)}
                                                                    </td>
                                                                    <td className="table-cell" style={{ fontSize: '0.8125rem' }} title={priceSource}>
                                                                        {t('adj.sar', { amount: formatSar(m.purchasePrice) })}
                                                                        {priceSource ? (
                                                                            <div className="text-muted" style={{ fontSize: '0.7rem', marginTop: 2 }}>
                                                                                {pr.purchasePriceSource === 'last_purchase' ? t('adj.priceLastShort') : t('adj.priceProfileShort')}
                                                                            </div>
                                                                        ) : null}
                                                                    </td>
                                                                    <td className="table-cell font-bold">{formatNum(m.beforeQty)}</td>
                                                                    <td className="table-cell font-bold">{formatNum(m.afterQty)}</td>
                                                                    <td className="table-cell" style={{ fontSize: '0.8125rem' }}>
                                                                        {t('adj.sar', { amount: formatSar(m.valueBefore) })}
                                                                    </td>
                                                                    <td className="table-cell" style={{ fontSize: '0.8125rem' }}>
                                                                        {t('adj.sar', { amount: formatSar(m.valueAfter) })}
                                                                    </td>
                                                                    <td className="table-cell font-bold" style={{ color: diffQtyColor }}>
                                                                        {formatSignedQty(m.diffQty)}
                                                                    </td>
                                                                    <td className="table-cell font-bold" style={{ color: diffValueColor }}>
                                                                        {formatSignedSar(m.diffValue)}
                                                                    </td>
                                                                    <td className="table-cell" style={{ fontSize: '0.8125rem' }}>
                                                                        {displayCell(row.actor)}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })
                                                    )}
                                                </tbody>
                                            </table>
                                        </section>
                                    </>
                                )}
                            </>
                        ),
                    },
                    {
                        id: 'movement-ledger',
                        label: t('tab.ledger'),
                        panel: (
                            <>
                                <div className="stock-movements-filter-bar" style={{ marginBottom: 16 }}>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label">{t('label.fromDate')}</label>
                                        <input type="date" className="form-input-field" value={ledgerFrom} onChange={(e) => setLedgerFrom(e.target.value)} />
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label">{t('label.toDate')}</label>
                                        <input type="date" className="form-input-field" value={ledgerTo} onChange={(e) => setLedgerTo(e.target.value)} />
                                    </div>
                                    <button type="button" className="btn-portal" style={{ padding: '10px 16px', marginBottom: 2 }} onClick={applyLedgerFilters}>
                                        {t('btn.applyFilters')}
                                    </button>
                                    {(appliedLedgerFrom || appliedLedgerTo || appliedLedgerSearch || ledgerProductId) ? (
                                        <button type="button" className="btn-secondary" style={{ marginBottom: 2 }} onClick={clearLedgerFilters}>
                                            {t('btn.clearFilters')}
                                        </button>
                                    ) : null}
                                </div>
                                <div className="stock-movements-filter-bar" style={{ marginBottom: 16 }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div
                                            className="mc-filter-select-wrapper mc-inv-search-combo"
                                            style={{ position: 'relative', width: '100%' }}
                                        >
                                            <Search className="mc-filter-icon" size={16} />
                                            <input
                                                type="text"
                                                placeholder={t('search.ledgerPlaceholder')}
                                                className="mc-filter-select"
                                                style={{
                                                    paddingLeft: '40px',
                                                    paddingRight: ledgerSearchQuery ? '70px' : '14px',
                                                    width: '100%',
                                                    minHeight: 46,
                                                    fontSize: '0.95rem',
                                                    backgroundImage: 'none',
                                                    cursor: 'text',
                                                }}
                                                value={ledgerSearchQuery}
                                                onChange={(e) => {
                                                    const v = e.target.value;
                                                    setLedgerSearchQuery(v);
                                                    setLedgerProductId('');
                                                    setLedgerSuggestIndex(-1);
                                                    if (!normalizeInventorySearchValue(v)) {
                                                        setLedgerSuggestOpen(false);
                                                    } else {
                                                        setLedgerSuggestOpen(true);
                                                    }
                                                }}
                                                onKeyDown={onLedgerSearchKeyDown}
                                                onFocus={() => {
                                                    clearLedgerSearchBlurTimer();
                                                    if (normalizeInventorySearchValue(ledgerSearchQuery)) {
                                                        setLedgerSuggestOpen(true);
                                                    }
                                                }}
                                                onBlur={() => {
                                                    clearLedgerSearchBlurTimer();
                                                    ledgerSearchBlurTimerRef.current = setTimeout(() => {
                                                        ledgerSearchBlurTimerRef.current = null;
                                                        setLedgerSuggestOpen(false);
                                                        setLedgerSuggestIndex(-1);
                                                    }, 200);
                                                }}
                                                role="combobox"
                                                aria-autocomplete="list"
                                                aria-expanded={ledgerSuggestOpen}
                                                aria-controls="sm-ledger-inv-search-suggest-list"
                                                aria-activedescendant={
                                                    ledgerSuggestOpen && ledgerSuggestIndex >= 0
                                                        ? `sm-ledger-inv-suggest-${ledgerSuggestIndex}`
                                                        : undefined
                                                }
                                            />
                                            {ledgerSearchQuery ? (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setLedgerSearchQuery('');
                                                        setLedgerProductId('');
                                                        setLedgerSuggestOpen(false);
                                                        setLedgerSuggestIndex(-1);
                                                    }}
                                                    aria-label={t('search.clear')}
                                                    title={t('search.clear')}
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
                                            {ledgerSuggestOpen && normalizeInventorySearchValue(ledgerSearchQuery) ? (
                                                <div
                                                    ref={ledgerSuggestDropdownRef}
                                                    id="sm-ledger-inv-search-suggest-list"
                                                    className="mc-inv-search-dropdown"
                                                    role="listbox"
                                                    aria-label={t('search.matching')}
                                                    onMouseDown={(ev) => ev.preventDefault()}
                                                >
                                                    {ledgerSearchSuggestions.length === 0 ? (
                                                        <div className="mc-inv-search-dropdown-empty">
                                                            {selectedBranchId
                                                                ? t('search.noMatchLedgerBranch')
                                                                : t('search.noMatchLedgerGlobal')}
                                                        </div>
                                                    ) : (
                                                        ledgerSearchSuggestions.map((row, idx) => (
                                                            <button
                                                                key={String(row.productId ?? row?.product?.id ?? idx)}
                                                                type="button"
                                                                id={`sm-ledger-inv-suggest-${idx}`}
                                                                role="option"
                                                                aria-selected={ledgerSuggestIndex === idx}
                                                                className={`mc-inv-search-suggest${ledgerSuggestIndex === idx ? ' is-active' : ''}`}
                                                                onMouseEnter={() => setLedgerSuggestIndex(idx)}
                                                                onClick={() => applyLedgerSearchSuggestion(row)}
                                                            >
                                                                <span className="mc-inv-search-suggest-name">{displayCell(row.name ?? row?.product?.name)}</span>
                                                                {(row.sku ?? row?.product?.sku) ? (
                                                                    <span className="mc-inv-search-suggest-sku">{displayCell(row.sku ?? row?.product?.sku)}</span>
                                                                ) : null}
                                                            </button>
                                                        ))
                                                    )}
                                                </div>
                                            ) : null}
                                        </div>
                                        <p style={{ margin: '6px 0 0', fontSize: '0.8125rem', color: '#64748b' }}>
                                            {t('search.ledgerKbd')}
                                            {ledgerProductId ? t('search.filteringProduct') : ledgerSearchQuery ? t('search.textOnApply') : ''}
                                        </p>
                                    </div>
                                </div>
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
                                                <th className="table-th">{t('th.when')}</th>
                                                <th className="table-th">{t('th.workshop')}</th>
                                                <th className="table-th">{t('th.branch')}</th>
                                                <th className="table-th">{t('th.product')}</th>
                                                <th className="table-th">{t('th.kind')}</th>
                                                <th className="table-th">{t('th.in')}</th>
                                                <th className="table-th">{t('th.out')}</th>
                                                <th className="table-th">{t('th.stockBeforeAfter')}</th>
                                                <th className="table-th">{t('th.balanceAfter')}</th>
                                                <th className="table-th">{t('th.reference')}</th>
                                                <th className="table-th">{t('th.note')}</th>
                                                <th className="table-th">{t('th.staff')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {loadingLedger ? (
                                                <tr>
                                                    <td className="table-cell" colSpan={12} style={{ textAlign: 'center', padding: 32 }}>
                                                        <Loader className="animate-spin" size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                                                        {t('loading.ledger')}
                                                    </td>
                                                </tr>
                                            ) : ledgerEntries.length === 0 ? (
                                                <tr>
                                                    <td className="table-cell" colSpan={12} style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>
                                                        {t('empty.noLedger')}
                                                    </td>
                                                </tr>
                                            ) : (
                                                ledgerEntries.map((row, idx) => {
                                                    const pr = row.product ?? {};
                                                    const ref = row.reference;
                                                    const { before, after } = ledgerStockBeforeAfter(row);
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
                                                            <td className="table-cell" style={{ fontSize: '0.8125rem' }}>
                                                                {`${formatNum(before)} → ${formatNum(after)}`}
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
                                                            <td className="table-cell" style={{ fontSize: '0.8125rem' }}>
                                                                {displayCell(row.actor)}
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
                                            {t('page.ledger', { page: ledgerPage, totalPages: ledgerTotalPages, total: ledgerMeta.total })}
                                        </span>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button
                                                type="button"
                                                className="btn-secondary"
                                                disabled={ledgerOffset <= 0}
                                                onClick={() => setLedgerOffset((o) => Math.max(0, o - LEDGER_LIMIT))}
                                            >
                                                {t('btn.previous')}
                                            </button>
                                            <button
                                                type="button"
                                                className="btn-secondary"
                                                disabled={ledgerOffset + LEDGER_LIMIT >= ledgerMeta.total}
                                                onClick={() => setLedgerOffset((o) => o + LEDGER_LIMIT)}
                                            >
                                                {t('btn.next')}
                                            </button>
                                        </div>
                                    </div>
                                ) : null}
                            </>
                        ),
                    },
                ]}
            />

            {adjustProduct ? (
                <Modal
                    title={t('modal.adjustTitle', { name: displayCell(adjustProduct.name) })}
                    onClose={closeAdjustModal}
                    width="520px"
                >
                    <div style={{ padding: '4px 0 0' }}>
                        <p style={{ margin: '0 0 16px', fontSize: '0.8125rem', color: '#64748b', lineHeight: 1.5 }}>
                            {t('modal.adjustMeta', {
                                branch: displayCell(gridMeta.branch),
                                qty: formatNum(adjustProduct.currentQty),
                                unit: displayCell(adjustProduct.unit),
                            })}
                        </p>
                        <div className="form-group">
                            <label className="form-label">{t('modal.reason')}</label>
                            <select
                                className="form-input-field"
                                value={adjustReason}
                                onChange={(e) => setAdjustReason(e.target.value)}
                                disabled={adjustSaving}
                            >
                                <option value="">{t('modal.selectReason')}</option>
                                {INVENTORY_ADJUST_REASON_OPTIONS.map((opt) => {
                                    const reasonKey = `reason.${opt.value}`;
                                    const translatedReason = t(reasonKey);
                                    return (
                                        <option key={opt.value} value={opt.value}>
                                            {translatedReason !== reasonKey ? translatedReason : opt.label}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                        {adjustReason !== INVENTORY_ADJUSTMENT_REASON_INFINITE_QTY ? (
                            <div className="form-group">
                                <label className="form-label">
                                    {adjustReason === INVENTORY_ADJUSTMENT_REASON_OPENING_QTY
                                        ? t('modal.newOpeningQty')
                                        : t('modal.newQty')}
                                </label>
                                <input
                                    type="number"
                                    className="form-input-field"
                                    min={0}
                                    step={1}
                                    value={adjustNewQty}
                                    onChange={(e) => setAdjustNewQty(e.target.value)}
                                    disabled={adjustSaving}
                                />
                            </div>
                        ) : (
                            <p style={{ margin: '0 0 16px', fontSize: '0.8125rem', color: '#64748b' }}>
                                {t('modal.infiniteHint')}
                            </p>
                        )}
                        <div className="form-group">
                            <label className="form-label">{t('modal.noteOptional')}</label>
                            <textarea
                                className="form-input-field"
                                rows={3}
                                value={adjustNote}
                                onChange={(e) => setAdjustNote(e.target.value)}
                                disabled={adjustSaving}
                                placeholder={t('modal.notePlaceholder')}
                            />
                        </div>
                        {adjustError ? (
                            <div style={{ padding: 12, marginBottom: 16, background: '#FEF2F2', color: '#B91C1C', borderRadius: 8, fontSize: '0.875rem' }}>
                                {adjustError}
                            </div>
                        ) : null}
                        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                            <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={closeAdjustModal} disabled={adjustSaving}>
                                {t('btn.cancel')}
                            </button>
                            <button
                                type="button"
                                className="btn-portal"
                                style={{ flex: 2 }}
                                onClick={() => void submitAdjust()}
                                disabled={
                                    adjustSaving ||
                                    !adjustReason.trim() ||
                                    (adjustReason !== INVENTORY_ADJUSTMENT_REASON_INFINITE_QTY &&
                                        (!Number.isFinite(Number(adjustNewQty)) || Number(adjustNewQty) < 0))
                                }
                            >
                                {adjustSaving ? t('btn.saving') : t('btn.applyAdjustment')}
                            </button>
                        </div>
                    </div>
                </Modal>
            ) : null}

            {branchMovementProduct ? (
                <BranchMovementModal
                    product={branchMovementProduct}
                    workshopId={selectedWorkshopId}
                    branchId={selectedBranchId}
                    onClose={() => setBranchMovementProduct(null)}
                    t={t}
                />
            ) : null}
        </>
    );
}

function BranchMovementModal({ product, workshopId, branchId, onClose, t }) {
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
            setError(e?.message || t('err.loadHistory'));
        } finally {
            setLoading(false);
        }
    }, [product?.productId, workshopId, branchId, appliedFrom, appliedTo, offset, t]);

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
            title={t('modal.historyTitle')}
            onClose={onClose}
            width="min(1280px, 98vw)"
            footer={
                <button type="button" className="btn-secondary" onClick={onClose}>
                    {t('btn.close')}
                </button>
            }
        >
            <MovementModalBody
                key={String(product.productId)}
                title=""
                scopeLine={t('modal.historyScope')}
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
                t={t}
            />
        </Modal>
    );
}
