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
import AdminModalAsScreen from '../admin/AdminModalAsScreen';
import UniversalTabs from '../UniversalTabs';
import UiPager from '../UiPager';
import { usePagedRows, TABLE_PAGE_SIZES } from '../../hooks/usePagedRows';
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
import '../../styles/ui.css';
import {
    adjustInputMin,
    isValidAdjustNewQty,
    parseInventoryQty,
    qtyEquals,
} from '../../utils/inventoryAdjustQty';

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
                <span className="ui-tags">
                    <span className="ui-tag">{t}</span>
                    <span className="ui-tag">#{id}</span>
                </span>
            );
        }
        return <span className="ui-tag">{formatRef(value)}</span>;
    }
    return <span className="ui-tag">{String(value)}</span>;
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

/** Stock in is an arrival, stock out a departure; the rest are categories
 *  and share the one neutral pill. */
function ledgerKindBadgeClass(kind) {
    const k = String(kind || '').toLowerCase();
    if (k === 'purchase') return 'ui-pill ui-pill--ok';
    if (k === 'sale') return 'ui-pill ui-pill--warn';
    return 'ui-pill ui-pill--neutral';
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
        <th title={title}>
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
    onLimitChange,
    from,
    to,
    onFromChange,
    onToChange,
    onApplyDates,
    t,
}) {
    const [movementTab, setMovementTab] = useState('rows');
    const pagerProps = {
        page: Math.floor((offset || 0) / limit) + 1,
        pageCount: Math.max(1, Math.ceil((total || 0) / limit)),
        pageSize: limit,
        pageSizes: TABLE_PAGE_SIZES,
        total: total || 0,
        onPageChange: (p) => onOffsetChange((p - 1) * limit),
        onPageSizeChange: (n) => {
            onLimitChange?.(n);
            onOffsetChange(0);
        },
    };

    const summaryPanel = (
        <div>
            {loading && !summary ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 16 }}>
                    <Loader className="ui-spin" size={20} />
                    {t('loading.totals')}
                </div>
            ) : summary ? (
                <div className="ui-kpis">
                    <div className="ui-metric">
                        <span className="ui-metric-icon"><TrendingUp size={62} strokeWidth={1.1} /></span>
                        <div className="ui-metric-label">{t('modal.stockAdded')}</div>
                        <div className="ui-metric-value">{formatNum(summary.totalIn)}</div>
                    </div>
                    <div className="ui-metric">
                        <span className="ui-metric-icon"><TrendingDown size={62} strokeWidth={1.1} /></span>
                        <div className="ui-metric-label">{t('modal.stockRemoved')}</div>
                        <div className="ui-metric-value">{formatNum(summary.totalOut)}</div>
                    </div>
                    <div className="ui-metric">
                        <span className="ui-metric-icon"><LayoutGrid size={62} strokeWidth={1.1} /></span>
                        <div className="ui-metric-label">{t('modal.netChange')}</div>
                        <div className="ui-metric-value">{formatNum(summary.net)}</div>
                        <div className="ui-metric-foot">
                            {t('modal.linesTotal', { n: summary.totalEntries ?? total })}
                        </div>
                    </div>
                </div>
            ) : (
                <p className="ui-help">
                    {t('modal.totalsEmpty')}
                </p>
            )}
        </div>
    );

    const rowsPanel = (
        <>
            {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 24 }}>
                    <Loader className="ui-spin" size={22} />
                    {t('loading.rows')}
                </div>
            ) : (
                <>
                    <section className="ui-table-wrap ui-table-wrap--scroll" style={{ overflowX: 'auto' }}>
                        <table className="ui-table">
                            <thead>
                                <tr>
                                    <th>{t('th.when')}</th>
                                    <th>{t('th.whatHappened')}</th>
                                    <th>{t('th.qtyChange')}</th>
                                    <th>{t('th.stockBeforeAfter')}</th>
                                    <th>{t('th.howRecorded')}</th>
                                    <th>{t('th.invoiceOrLink')}</th>
                                    <th>{t('th.note')}</th>
                                    <th>{t('th.staff')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(entries || []).length === 0 ? (
                                    <tr>
                                        <td colSpan={8} style={{ textAlign: 'center', padding: 24 }}>
                                            {t('empty.noStockChanges')}
                                        </td>
                                    </tr>
                                ) : (
                                    entries.map((e) => (
                                        <tr key={e.id}>
                                            <td data-label={t('th.when')} style={{ fontSize: '0.8125rem' }}>
                                                {formatDt(e.createdAt)}
                                            </td>
                                            <td data-label={t('th.whatHappened')}>
                                                <span
                                                    className="ui-pill ui-pill--neutral"
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
                                            <td data-label={t('th.qtyChange')} className="ui-num ui-strong">{formatNum(e.delta)}</td>
                                            <td data-label={t('th.stockBeforeAfter')} style={{ fontSize: '0.8125rem' }}>
                                                {`${formatNum(e.previousQty)} → ${formatNum(e.newQty)}`}
                                            </td>
                                            <td data-label={t('th.howRecorded')}
                                                style={{ fontSize: '0.8125rem' }}
                                                title={(() => {
                                                    const code =
                                                        typeof e.source === 'string' ? e.source : displayCell(e.source);
                                                    return code && code !== '—' ? t('modal.systemCode', { code }) : undefined;
                                                })()}
                                            >
                                                {humanizeMovementSource(e.source, t)}
                                            </td>
                                            <td data-label={t('th.invoiceOrLink')}>
                                                <ReferencePills value={e.reference} />
                                            </td>
                                            <td data-label={t('th.note')} className="ui-help">
                                                {displayCell(e.note)}
                                            </td>
                                            <td data-label={t('th.staff')} style={{ fontSize: '0.8125rem' }}>
                                                {displayCell(e.actor)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                        <UiPager {...pagerProps} />
                    </section>
                </>
            )}
        </>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            {title ? (
                <p className="ui-help">{title}</p>
            ) : null}
            {scopeLine ? (
                <p className="ui-help">{scopeLine}</p>
            ) : null}
            <p className="ui-help" role="note">
                <strong>{t('modal.headsUp')}</strong> {t('modal.summaryHint')}
            </p>
            {product && (
                <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>
                    {displayCell(product.name)}{' '}
                    <span className="ui-help">
                        {t('modal.codeUnit', { sku: displayCell(product.sku), unit: displayCell(product.unit) })}
                    </span>
                </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
                <div className="ui-field ui-col-6" style={{ margin: 0 }}>
                    <label>{t('label.fromDate')}</label>
                    <input type="date" className="ui-input" value={from} onChange={(e) => onFromChange(e.target.value)} />
                </div>
                <div className="ui-field ui-col-6" style={{ margin: 0 }}>
                    <label>{t('label.toDate')}</label>
                    <input type="date" className="ui-input" value={to} onChange={(e) => onToChange(e.target.value)} />
                </div>
                <button type="button" className="ui-btn ui-btn--primary" style={{ padding: '10px 16px', marginBottom: 2 }} onClick={onApplyDates}>
                    {t('btn.applyDates')}
                </button>
            </div>
            {error && (
                <div className="ui-banner ui-banner--dang" role="alert">{error}</div>
            )}
            <UniversalTabs
                idPrefix="stock-movement"
               
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
    const [loadingWorkshops, setLoadingWorkshops] = useState(true);
    const [loadingBranches, setLoadingBranches] = useState(false);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [productsError, setProductsError] = useState('');
    const [pageTab, setPageTab] = useState('branch-stock');

    const [ledgerOffset, setLedgerOffset] = useState(0);
    const [ledgerLimit, setLedgerLimit] = useState(LEDGER_LIMIT);
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
                    limit: ledgerLimit,
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
                    limit: Number(data?.limit ?? ledgerLimit) || ledgerLimit,
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
        ledgerLimit,
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

    const adjustmentsPaging = usePagedRows(enrichedBranchAdjustments, {
        resetKey: `${selectedWorkshopId}|${selectedBranchId}`,
    });
    const gridPaging = usePagedRows(filteredBranchProducts, {
        resetKey: `${selectedWorkshopId}|${selectedBranchId}|${searchQuery}`,
    });
    const products = gridPaging.pagedRows;

    const gridMeta = useMemo(
        () => ({
            workshop: branchScopeMeta.workshop,
            branch: branchScopeMeta.branch,
            total: filteredBranchProducts.length,
        }),
        [branchScopeMeta, filteredBranchProducts.length],
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
                const code = String(e?.code || e?.body?.code || '');
                if (code === 'INVENTORY_ADJUSTMENT_COST_REQUIRED') {
                    setOpeningHint(
                        'This product has no cost yet. Record a purchase or set its purchase price, then adjust stock.',
                    );
                } else if (code === 'TX_TIMEOUT' || Number(e?.status) === 503) {
                    setOpeningHint('Nothing was saved. Please try again.');
                } else {
                    setOpeningHint(e?.message || t('err.couldNotSave'));
                }
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
    }, [selectedWorkshopId, selectedBranchId, gridPaging.pagerProps.page, searchQuery, cancelOpeningEdit]);

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
        const current = parseInventoryQty(product.currentQty);
        setAdjustNewQty(current != null && current >= 0 ? String(current) : '');
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
            newQtyNum = parseInventoryQty(adjustNewQty);
            if (
                !isValidAdjustNewQty(newQtyNum, {
                    isOpening,
                    allowMinus: Boolean(adjustProduct.allowMinusQty) && !isOpening,
                })
            ) {
                setAdjustError(t('err.validQtyGte0'));
                return;
            }
            newQtyNum = Math.round(newQtyNum);
            const baseline = isOpening
                ? parseInventoryQty(adjustProduct.openingQty ?? adjustProduct.currentQty) ?? 0
                : parseInventoryQty(adjustProduct.currentQty) ?? 0;
            if (qtyEquals(newQtyNum, baseline)) {
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
                if (isOpening) {
                    const openingPrev = parseInventoryQty(adjustProduct.openingQty);
                    if (openingPrev != null) body.previousQty = openingPrev;
                } else {
                    const onHandPrev = parseInventoryQty(adjustProduct.currentQty);
                    if (onHandPrev != null) body.previousQty = onHandPrev;
                }
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


    const ledgerPagerProps = {
        page: Math.floor(ledgerOffset / ledgerLimit) + 1,
        pageCount: Math.max(1, Math.ceil((ledgerMeta.total || 0) / ledgerLimit)),
        pageSize: ledgerLimit,
        pageSizes: TABLE_PAGE_SIZES,
        total: ledgerMeta.total || 0,
        onPageChange: (p) => setLedgerOffset((p - 1) * ledgerLimit),
        onPageSizeChange: (n) => {
            setLedgerLimit(n);
            setLedgerOffset(0);
        },
    };

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

    if (branchMovementProduct) {
        return (
            <BranchMovementModal
                product={branchMovementProduct}
                workshopId={selectedWorkshopId}
                branchId={selectedBranchId}
                onClose={() => setBranchMovementProduct(null)}
                t={t}
            />
        );
    }

    if (adjustProduct) {
        return (
            <AdminModalAsScreen
                title={t('modal.adjustTitle', { name: displayCell(adjustProduct.name) })}
                onClose={closeAdjustModal}
                backDisabled={adjustSaving}
                footer={(
                    <div style={{ display: 'flex', gap: 12, width: '100%' }}>
                        <button type="button" className="ui-btn ui-btn--default" style={{ flex: 1 }} onClick={closeAdjustModal} disabled={adjustSaving}>
                            {t('btn.cancel')}
                        </button>
                        <button
                            type="button"
                            className="ui-btn ui-btn--primary"
                            style={{ flex: 2 }}
                            onClick={() => void submitAdjust()}
                            disabled={
                                adjustSaving ||
                                !adjustReason.trim() ||
                                (adjustReason !== INVENTORY_ADJUSTMENT_REASON_INFINITE_QTY &&
                                    !isValidAdjustNewQty(parseInventoryQty(adjustNewQty), {
                                        isOpening: adjustReason === INVENTORY_ADJUSTMENT_REASON_OPENING_QTY,
                                        allowMinus:
                                            Boolean(adjustProduct.allowMinusQty) &&
                                            adjustReason !== INVENTORY_ADJUSTMENT_REASON_OPENING_QTY,
                                    }))
                            }
                        >
                            {adjustSaving ? t('btn.saving') : t('btn.applyAdjustment')}
                        </button>
                    </div>
                )}
            >
                <div style={{ padding: '4px 0 0' }}>
                    <p className="ui-help">
                        {t('modal.adjustMeta', {
                            branch: displayCell(gridMeta.branch),
                            qty: formatNum(adjustProduct.currentQty),
                            unit: displayCell(adjustProduct.unit),
                        })}
                        {parseInventoryQty(adjustProduct.currentQty) < 0
                            ? ` ${t('modal.adjustFromMinus')}`
                            : ''}
                    </p>
                    <div className="ui-field ui-col-6">
                        <label>{t('modal.reason')}</label>
                        <select
                            className="ui-input"
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
                        <div className="ui-field ui-col-6">
                            <label>
                                {adjustReason === INVENTORY_ADJUSTMENT_REASON_OPENING_QTY
                                    ? t('modal.newOpeningQty')
                                    : t('modal.newQty')}
                            </label>
                            <input
                                type="number"
                                className="ui-input"
                                min={adjustInputMin({
                                    isOpening: adjustReason === INVENTORY_ADJUSTMENT_REASON_OPENING_QTY,
                                    allowMinus:
                                        Boolean(adjustProduct.allowMinusQty) &&
                                        adjustReason !== INVENTORY_ADJUSTMENT_REASON_OPENING_QTY,
                                    currentQty: adjustProduct.currentQty,
                                })}
                                step={1}
                                value={adjustNewQty}
                                onChange={(e) => setAdjustNewQty(e.target.value)}
                                disabled={adjustSaving}
                            />
                        </div>
                    ) : (
                        <p className="ui-help">
                            {t('modal.infiniteHint')}
                        </p>
                    )}
                    <div className="ui-field ui-col-6">
                        <label>{t('modal.noteOptional')}</label>
                        <textarea
                            className="ui-input"
                            rows={3}
                            value={adjustNote}
                            onChange={(e) => setAdjustNote(e.target.value)}
                            disabled={adjustSaving}
                            placeholder={t('modal.notePlaceholder')}
                        />
                    </div>
                    {adjustError ? (
                        <div className="ui-banner ui-banner--dang" role="alert">
                            {adjustError}
                        </div>
                    ) : null}
                </div>
            </AdminModalAsScreen>
        );
    }

    return (
        <div className="ui-root ui-root--flush ui-stack">
            <div className="ui-toolbar ui-toolbar--standalone">
                <div className="ui-field">
                    <label>{t('label.workshop')}</label>
                    <select
                        className="ui-select"
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
                <div className="ui-field">
                    <label>{t('label.branch')}</label>
                    <select
                        className="ui-select"
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
                    <p className="ui-help">
                        {t('hint.nowViewing')} <strong>{displayCell(gridMeta.workshop)}</strong> — <strong>{displayCell(gridMeta.branch)}</strong>
                    </p>
                ) : null}
                <div className="ui-toolbar-end" style={{ alignItems: 'flex-end' }}>
                    <button
                        type="button"
                        className="ui-btn ui-btn--default"
                        disabled={pageTab !== 'branch-stock' || !filteredBranchProducts.length}
                        onClick={exportGridCsv}
                    >
                        <Download size={15} /> {t('btn.downloadCsv')}
                    </button>
                </div>
            </div>

            <UniversalTabs
                idPrefix="sm-page"
                
                value={pageTab}
                onChange={setPageTab}
                tabs={[
                    {
                        id: 'branch-stock',
                        label: t('tab.branchStock'),
                        panel: (
                            <>
            <div className="ui-toolbar ui-toolbar--standalone">
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="ui-search" style={{ maxWidth: 'none' }}>
                        <Search size={15} />
                        <input
                            type="text"
                            placeholder={t('search.placeholder')}
                            className="ui-input"
                            style={{ paddingInlineEnd: searchQuery ? 64 : undefined }}
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
                                    border: 0,
                                    background: 'var(--ui-n-100)',
                                    color: 'var(--ui-n-700)',
                                    borderRadius: 'var(--ui-r-sm)',
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
                                className="ui-picklist ui-suggest"
                                role="listbox"
                                aria-label={t('search.matching')}
                                onMouseDown={(ev) => ev.preventDefault()}
                            >
                                {invSearchSuggestions.length === 0 ? (
                                    <div className="ui-noneline" style={{ padding: 12 }}>{t('search.noMatch')}</div>
                                ) : (
                                    invSearchSuggestions.map((row, idx) => (
                                        <button
                                            key={String(row.productId ?? idx)}
                                            type="button"
                                            id={`sm-admin-inv-suggest-${idx}`}
                                            role="option"
                                            aria-selected={invSuggestIndex === idx}
                                            className="ui-pick" aria-selected={invSuggestIndex === idx}
                                            onMouseEnter={() => setInvSuggestIndex(idx)}
                                            onClick={() => applyInventorySearchSuggestion(row)}
                                        >
                                            <span className="ui-pick-name">{displayCell(row.name)}</span>
                                            {row.sku ? (
                                                <span className="ui-pick-sub">{displayCell(row.sku)}</span>
                                            ) : null}
                                        </button>
                                    ))
                                )}
                            </div>
                        ) : null}
                    </div>
                    <p className="ui-help" style={{ marginTop: 6 }}>
                        {t('search.showing', { n: filteredBranchProducts.length, m: branchProductCatalog.length })}
                        {searchQuery ? t('search.forQuery', { q: searchQuery }) : ''}
                        {' · '}
                        {t('search.kbdHint')}
                    </p>
                </div>
            </div>

            {productsError ? (
                <div className="ui-banner ui-banner--dang" role="alert">
                    {productsError}
                </div>
            ) : null}

            <section className="ui-table-wrap ui-table-wrap--scroll">
                <table className="ui-table">
                    <thead>
                        <tr>
                            <th>{t('th.product')}</th>
                            <th>{t('th.sku')}</th>
                            <th>{t('th.brand')}</th>
                            <th>{t('th.unit')}</th>
                            <GridQtyTh label={t('th.stockNow')} apiField="currentQty" t={t} />
                            <GridQtyTh label={t('th.reserved')} apiField="reservedQty" t={t} />
                            <GridQtyTh label={t('th.freeToUse')} apiField="availableQty" t={t} />
                            <GridQtyTh label={t('th.critical')} apiField="criticalStockPoint" t={t} />
                            <GridQtyTh label={t('th.startingStock')} apiField="openingQty" t={t} />
                            <GridQtyTh label={t('th.inUse')} apiField="isActive" t={t} />
                            <th>{t('th.actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loadingProducts ? (
                            <tr>
                                <td colSpan={11} style={{ textAlign: 'center', padding: 32 }}>
                                    <Loader className="ui-spin" size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                                    {t('loading.list')}
                                </td>
                            </tr>
                        ) : !selectedWorkshopId || !selectedBranchId ? (
                            <tr>
                                <td colSpan={11} className="ui-help" style={{ textAlign: 'center', padding: 28 }}>
                                    {t('empty.pickWorkshopBranch')}
                                </td>
                            </tr>
                        ) : filteredBranchProducts.length === 0 ? (
                            <tr>
                                <td colSpan={11} className="ui-help" style={{ textAlign: 'center', padding: 28 }}>
                                    {branchProductCatalog.length === 0
                                        ? t('empty.noProductsBranch')
                                        : t('empty.noProductsSearch')}
                                </td>
                            </tr>
                        ) : (
                            products.map((p) => (
                                <tr key={p.productId}>
                                    <td data-label={t('th.product')}>
                                        <div className="ui-row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                                            <span className="ui-rcard-icon" style={{ width: 26, height: 26 }}>
                                                <Package size={14} />
                                            </span>
                                            <span className="ui-list-title">{displayCell(p.name)}</span>
                                        </div>
                                        <div className="ui-help" style={{ fontSize: '0.75rem', marginTop: 2 }}>
                                            {displayCell(p.departmentName)}
                                            {p.categoryName != null && p.categoryName !== ''
                                                ? ` · ${displayCell(p.categoryName)}`
                                                : ''}
                                        </div>
                                    </td>
                                    <td data-label={t('th.sku')} style={{ fontSize: '0.8125rem' }}>
                                        {displayCell(p.sku)}
                                    </td>
                                    <td data-label={t('th.brand')} style={{ fontSize: '0.8125rem' }}>
                                        {displayCell(p.brandName)}
                                    </td>
                                    <td data-label={t('th.unit')}>{displayCell(p.unit)}</td>
                                    <td data-label={t('th.stockNow')} className="ui-num ui-strong">{formatNum(p.currentQty)}</td>
                                    <td data-label={t('th.reserved')}>{formatNum(p.reservedQty)}</td>
                                    <td data-label={t('th.freeToUse')}>{formatNum(p.availableQty)}</td>
                                    <td data-label={t('th.critical')}>
                                        {String(criticalEditProductId) === String(p.productId) ? (
                                            <div className="ui-row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                                                <input
                                                    ref={criticalInputRef}
                                                    type="number"
                                                    step="any"
                                                    min={0}
                                                    className="ui-input ui-input--cell ui-input--figure"
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
                                                    <Loader className="ui-spin" size={14} />
                                                ) : null}
                                                {criticalHint ? (
                                                    <span className="ui-help">{criticalHint}</span>
                                                ) : null}
                                            </div>
                                        ) : (
                                            <span className="ui-num">{formatNum(p.criticalStockPoint)}</span>
                                        )}
                                    </td>
                                    <td data-label={t('th.startingStock')}>
                                        {String(openingEditProductId) === String(p.productId) ? (
                                            <div className="ui-row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                                                <input
                                                    ref={openingInputRef}
                                                    type="number"
                                                    step="any"
                                                    className="ui-input ui-input--cell ui-input--figure"
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
                                                    <Loader className="ui-spin" size={14} />
                                                ) : null}
                                                {openingHint ? (
                                                    <span className="ui-help">{openingHint}</span>
                                                ) : null}
                                            </div>
                                        ) : (
                                            <span className="ui-num">{formatNum(p.openingQty)}</span>
                                        )}
                                    </td>
                                    <td data-label={t('th.inUse')}>
                                        <span className={`ui-pill ui-pill--${p.isActive ? 'ok' : 'warn'}`}>
                                            {p.isActive ? t('status.on') : t('status.off')}
                                        </span>
                                    </td>
                                    <td data-label={t('th.actions')}>
                                        <div className="ui-row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                                            {String(criticalEditProductId) === String(p.productId) ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        className="ui-btn ui-btn--default ui-btn--sm"
                                                        onClick={() => void saveCriticalEdit(p)}
                                                        disabled={criticalSaving || loadingProducts}
                                                        title={t('title.saveCritical')}
                                                    >
                                                        {t('btn.save')}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="ui-btn ui-btn--default"
                                                        onClick={cancelCriticalEdit}
                                                        disabled={criticalSaving}
                                                    >
                                                        {t('btn.cancel')}
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="ui-btn ui-btn--default ui-btn--sm"
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
                                                        className="ui-btn ui-btn--default ui-btn--sm"
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
                                                        className="ui-btn ui-btn--default"
                                                        onClick={cancelOpeningEdit}
                                                        disabled={openingSaving}
                                                    >
                                                        {t('btn.cancel')}
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="ui-btn ui-btn--default ui-btn--sm"
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
                                                className="ui-btn ui-btn--default ui-btn--sm"
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
                                                className="ui-btn ui-btn--default ui-btn--sm"
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

                <UiPager {...gridPaging.pagerProps} />
                            </>
                        ),
                    },
                    {
                        id: 'adjustment-report',
                        label: t('tab.adjustments'),
                        panel: (
                            <>
                                {!selectedWorkshopId || !selectedBranchId ? (
                                    <p className="ui-help" style={{ padding: 32, textAlign: 'center' }}>
                                        {t('empty.pickForAdjustments')}
                                    </p>
                                ) : (
                                    <>
                                        <div className="ui-toolbar ui-toolbar--standalone" style={{ marginBottom: 16 }}>
                                            <div className="ui-field ui-col-6" style={{ margin: 0 }}>
                                                <label>{t('label.fromDate')}</label>
                                                <input type="date" className="ui-input" value={branchFrom} onChange={(e) => setBranchFrom(e.target.value)} />
                                            </div>
                                            <div className="ui-field ui-col-6" style={{ margin: 0 }}>
                                                <label>{t('label.toDate')}</label>
                                                <input type="date" className="ui-input" value={branchTo} onChange={(e) => setBranchTo(e.target.value)} />
                                            </div>
                                            <button type="button" className="ui-btn ui-btn--primary" style={{ padding: '10px 16px', marginBottom: 2 }} onClick={applyBranchDateFilters}>
                                                {t('btn.applyDates')}
                                            </button>
                                            {(appliedBranchFrom || appliedBranchTo) ? (
                                                <button type="button" className="ui-btn ui-btn--default" style={{ marginBottom: 2 }} onClick={clearBranchDateFilters}>
                                                    {t('btn.clearDates')}
                                                </button>
                                            ) : null}
                                            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                                <button
                                                    type="button"
                                                    className="ui-btn ui-btn--default"
                                                    disabled={loadingBranchAdjustments || !enrichedBranchAdjustments.length}
                                                    onClick={exportAdjustmentPdf}
                                                >
                                                    <Download size={16} /> {t('btn.downloadPdf')}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="ui-btn ui-btn--default"
                                                    disabled={loadingBranchAdjustments || !enrichedBranchAdjustments.length}
                                                    onClick={exportAdjustmentExcel}
                                                >
                                                    <Download size={16} /> {t('btn.downloadExcel')}
                                                </button>
                                            </div>
                                        </div>
                                        <p className="ui-help">
                                            {t('adj.intro')}{' '}
                                            <strong>{displayCell(gridMeta.branch)}</strong>
                                            {appliedBranchFrom || appliedBranchTo
                                                ? t('adj.fromTo', { from: appliedBranchFrom || '…', to: appliedBranchTo || '…' })
                                                : t('adj.allDates')}
                                            {t('adj.introTail')}
                                        </p>
                                        {branchAdjustmentsError ? (
                                            <div className="ui-banner ui-banner--dang" role="alert">
                                                {branchAdjustmentsError}
                                            </div>
                                        ) : null}
                                        {!loadingBranchAdjustments && enrichedBranchAdjustments.length > 0 ? (
                                            <div className="ui-kpis" style={{ marginBottom: 20 }}>
                                                <div className="ui-metric">
                                                    <span className="ui-metric-icon"><TrendingUp size={62} strokeWidth={1.1} /></span>
                                                    <div className="ui-metric-label">{t('adj.kpiValueBefore')}</div>
                                                    <div className="ui-metric-value">
                                                        {t('adj.sar', { amount: formatSar(adjustmentKpis.totalValueBefore) })}
                                                    </div>
                                                </div>
                                                <div className="ui-metric">
                                                    <span className="ui-metric-icon"><TrendingDown size={62} strokeWidth={1.1} /></span>
                                                    <div className="ui-metric-label">{t('adj.kpiValueAfter')}</div>
                                                    <div className="ui-metric-value">
                                                        {t('adj.sar', { amount: formatSar(adjustmentKpis.totalValueAfter) })}
                                                    </div>
                                                </div>
                                                {/* The only card whose sign matters: a write-up and a write-down
                                                    are opposite outcomes, so this one keeps a tone. */}
                                                <div
                                                    className={`ui-metric${
                                                        adjustmentKpis.totalDiffValue > 0
                                                            ? ' ui-metric--ok'
                                                            : adjustmentKpis.totalDiffValue < 0
                                                              ? ' ui-metric--dang'
                                                              : ''
                                                    }`}
                                                >
                                                    <span className="ui-metric-icon"><LayoutGrid size={62} strokeWidth={1.1} /></span>
                                                    <div className="ui-metric-label">
                                                        {adjustmentKpis.count !== 1
                                                            ? t('adj.kpiDiffPlural', { count: adjustmentKpis.count })
                                                            : t('adj.kpiDiff', { count: adjustmentKpis.count })}
                                                    </div>
                                                    <div className="ui-metric-value">
                                                        {formatSignedSar(adjustmentKpis.totalDiffValue)}
                                                    </div>
                                                    <div className="ui-metric-foot">
                                                        {t('adj.qty', { qty: formatSignedQty(adjustmentKpis.totalDiffQty) })}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : null}
                                        <section className="ui-table-wrap ui-table-wrap--scroll" style={{ overflowX: 'auto' }}>
                                            <table className="ui-table">
                                                <thead>
                                                    <tr>
                                                        <th>{t('th.when')}</th>
                                                        <th>{t('th.product')}</th>
                                                        <th>{t('th.reasonNote')}</th>
                                                        <th>{t('th.purchaseValue')}</th>
                                                        <th>{t('th.stockBefore')}</th>
                                                        <th>{t('th.stockAfter')}</th>
                                                        <th>{t('th.valueBefore')}</th>
                                                        <th>{t('th.valueAfter')}</th>
                                                        <th>{t('th.diffQty')}</th>
                                                        <th>{t('th.diffValue')}</th>
                                                        <th>{t('th.changedBy')}</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {loadingBranchAdjustments ? (
                                                        <tr>
                                                            <td colSpan={11} style={{ textAlign: 'center', padding: 24 }}>
                                                                <Loader className="ui-spin" size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                                                                {t('loading.adjustments')}
                                                            </td>
                                                        </tr>
                                                    ) : enrichedBranchAdjustments.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={11} className="ui-help" style={{ textAlign: 'center', padding: 28 }}>
                                                                {t('empty.noAdjustments')}{appliedBranchFrom || appliedBranchTo ? t('empty.inDateRange') : ''}.
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        adjustmentsPaging.pagedRows.map((row, idx) => {
                                                            const m = metricsForAdjustmentRow(row);
                                                            const pr = row.product ?? {};
                                                            const priceSource =
                                                                pr.purchasePriceSource === 'last_purchase'
                                                                    ? t('adj.priceLastPurchase')
                                                                    : pr.purchasePriceSource === 'profile'
                                                                      ? t('adj.priceProfile')
                                                                      : undefined;
                                                            const diffQtyColor =
                                                                m.diffQty > 0 ? 'ui-money--in' : m.diffQty < 0 ? 'ui-money--out' : '';
                                                            const diffValueColor =
                                                                m.diffValue > 0 ? 'ui-money--in' : m.diffValue < 0 ? 'ui-money--out' : '';
                                                            return (
                                                                <tr key={row.id != null ? String(row.id) : `adj-${idx}`}>
                                                                    <td data-label={t('th.when')} style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                                                                        {formatLedgerWhen(row)}
                                                                    </td>
                                                                    <td data-label={t('th.product')}>
                                                                        <span className="ui-list-title">{displayCell(pr.name)}</span>
                                                                        {pr.sku ? (
                                                                            <div className="ui-help" style={{ fontSize: '0.75rem', marginTop: 2 }}>
                                                                                {displayCell(pr.sku)}
                                                                            </div>
                                                                        ) : null}
                                                                    </td>
                                                                    <td data-label={t('th.reasonNote')} className="ui-help">
                                                                        {displayCell(row.note)}
                                                                    </td>
                                                                    <td data-label={t('th.purchaseValue')} style={{ fontSize: '0.8125rem' }} title={priceSource}>
                                                                        {t('adj.sar', { amount: formatSar(m.purchasePrice) })}
                                                                        {priceSource ? (
                                                                            <div className="ui-help" style={{ fontSize: '0.7rem', marginTop: 2 }}>
                                                                                {pr.purchasePriceSource === 'last_purchase' ? t('adj.priceLastShort') : t('adj.priceProfileShort')}
                                                                            </div>
                                                                        ) : null}
                                                                    </td>
                                                                    <td data-label={t('th.stockBefore')} className="ui-num ui-strong">{formatNum(m.beforeQty)}</td>
                                                                    <td data-label={t('th.stockAfter')} className="ui-num ui-strong">{formatNum(m.afterQty)}</td>
                                                                    <td data-label={t('th.valueBefore')} style={{ fontSize: '0.8125rem' }}>
                                                                        {t('adj.sar', { amount: formatSar(m.valueBefore) })}
                                                                    </td>
                                                                    <td data-label={t('th.valueAfter')} style={{ fontSize: '0.8125rem' }}>
                                                                        {t('adj.sar', { amount: formatSar(m.valueAfter) })}
                                                                    </td>
                                                                    <td data-label={t('th.diffQty')} className={`ui-num ui-money ${diffQtyColor}`}>
                                                                        {formatSignedQty(m.diffQty)}
                                                                    </td>
                                                                    <td data-label={t('th.diffValue')} className={`ui-num ui-money ${diffValueColor}`}>
                                                                        {formatSignedSar(m.diffValue)}
                                                                    </td>
                                                                    <td data-label={t('th.changedBy')} style={{ fontSize: '0.8125rem' }}>
                                                                        {displayCell(row.actor)}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })
                                                    )}
                                                </tbody>
                                            </table>
                                            <UiPager {...adjustmentsPaging.pagerProps} />
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
                                <div className="ui-toolbar ui-toolbar--standalone" style={{ marginBottom: 16 }}>
                                    <div className="ui-field ui-col-6" style={{ margin: 0 }}>
                                        <label>{t('label.fromDate')}</label>
                                        <input type="date" className="ui-input" value={ledgerFrom} onChange={(e) => setLedgerFrom(e.target.value)} />
                                    </div>
                                    <div className="ui-field ui-col-6" style={{ margin: 0 }}>
                                        <label>{t('label.toDate')}</label>
                                        <input type="date" className="ui-input" value={ledgerTo} onChange={(e) => setLedgerTo(e.target.value)} />
                                    </div>
                                    <button type="button" className="ui-btn ui-btn--primary" style={{ padding: '10px 16px', marginBottom: 2 }} onClick={applyLedgerFilters}>
                                        {t('btn.applyFilters')}
                                    </button>
                                    {(appliedLedgerFrom || appliedLedgerTo || appliedLedgerSearch || ledgerProductId) ? (
                                        <button type="button" className="ui-btn ui-btn--default" style={{ marginBottom: 2 }} onClick={clearLedgerFilters}>
                                            {t('btn.clearFilters')}
                                        </button>
                                    ) : null}
                                </div>
                                <div className="ui-toolbar ui-toolbar--standalone" style={{ marginBottom: 16 }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div className="ui-search" style={{ maxWidth: 'none' }}>
                        <Search size={15} />
                                            <input
                                                type="text"
                                                placeholder={t('search.ledgerPlaceholder')}
                                                className="ui-input"

                                                style={{ paddingInlineEnd: ledgerSearchQuery ? 64 : undefined }}
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
                                    border: 0,
                                    background: 'var(--ui-n-100)',
                                    color: 'var(--ui-n-700)',
                                    borderRadius: 'var(--ui-r-sm)',
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
                                                    className="ui-picklist ui-suggest"
                                                    role="listbox"
                                                    aria-label={t('search.matching')}
                                                    onMouseDown={(ev) => ev.preventDefault()}
                                                >
                                                    {ledgerSearchSuggestions.length === 0 ? (
                                                        <div className="ui-noneline" style={{ padding: 12 }}>
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
                                                                className="ui-pick" aria-selected={ledgerSuggestIndex === idx}
                                                                onMouseEnter={() => setLedgerSuggestIndex(idx)}
                                                                onClick={() => applyLedgerSearchSuggestion(row)}
                                                            >
                                                                <span className="ui-pick-name">{displayCell(row.name ?? row?.product?.name)}</span>
                                                                {(row.sku ?? row?.product?.sku) ? (
                                                                    <span className="ui-pick-sub">{displayCell(row.sku ?? row?.product?.sku)}</span>
                                                                ) : null}
                                                            </button>
                                                        ))
                                                    )}
                                                </div>
                                            ) : null}
                                        </div>
                                        <p className="ui-help">
                                            {t('search.ledgerKbd')}
                                            {ledgerProductId ? t('search.filteringProduct') : ledgerSearchQuery ? t('search.textOnApply') : ''}
                                        </p>
                                    </div>
                                </div>
                                {ledgerError ? (
                                    <div className="ui-banner ui-banner--dang" role="alert">
                                        {ledgerError}
                                    </div>
                                ) : null}
                                <section className="ui-table-wrap ui-table-wrap--scroll" style={{ overflowX: 'auto' }}>
                                    <table className="ui-table">
                                        <thead>
                                            <tr>
                                                <th>{t('th.when')}</th>
                                                <th>{t('th.workshop')}</th>
                                                <th>{t('th.branch')}</th>
                                                <th>{t('th.product')}</th>
                                                <th>{t('th.kind')}</th>
                                                <th>{t('th.in')}</th>
                                                <th>{t('th.out')}</th>
                                                <th>{t('th.stockBeforeAfter')}</th>
                                                <th>{t('th.balanceAfter')}</th>
                                                <th>{t('th.reference')}</th>
                                                <th>{t('th.note')}</th>
                                                <th>{t('th.staff')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {loadingLedger ? (
                                                <tr>
                                                    <td colSpan={12} style={{ textAlign: 'center', padding: 32 }}>
                                                        <Loader className="ui-spin" size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                                                        {t('loading.ledger')}
                                                    </td>
                                                </tr>
                                            ) : ledgerEntries.length === 0 ? (
                                                <tr>
                                                    <td colSpan={12} className="ui-help" style={{ textAlign: 'center', padding: 28 }}>
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
                                                        <tr key={row.id != null ? String(row.id) : `ledger-${idx}`}>
                                                            <td data-label={t('th.when')} style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                                                                {formatLedgerWhen(row)}
                                                            </td>
                                                            <td data-label={t('th.workshop')} style={{ fontSize: '0.8125rem' }}>
                                                                {displayCell(row.workshop)}
                                                            </td>
                                                            <td data-label={t('th.branch')} style={{ fontSize: '0.8125rem' }}>
                                                                {displayCell(row.branch)}
                                                            </td>
                                                            <td data-label={t('th.product')}>
                                                                <span className="ui-list-title">{displayCell(pr.name)}</span>
                                                                {brandSub ? (
                                                                    <div className="ui-help" style={{ fontSize: '0.75rem', marginTop: 2 }}>
                                                                        {brandSub}
                                                                    </div>
                                                                ) : null}
                                                            </td>
                                                            <td data-label={t('th.kind')}>
                                                                <span className={ledgerKindBadgeClass(row.kind)} style={{ textTransform: 'capitalize' }}>
                                                                    {displayCell(row.kind)}
                                                                </span>
                                                            </td>
                                                            <td data-label={t('th.in')} className="ui-num ui-money ui-money--in">
                                                                {formatNum(row.inQty)}
                                                            </td>
                                                            <td data-label={t('th.out')} className="ui-num ui-money ui-money--out">
                                                                {formatNum(row.outQty)}
                                                            </td>
                                                            <td data-label={t('th.stockBeforeAfter')} style={{ fontSize: '0.8125rem' }}>
                                                                {`${formatNum(before)} → ${formatNum(after)}`}
                                                            </td>
                                                            <td data-label={t('th.balanceAfter')} className="ui-num ui-strong">{formatNum(row.balanceAfter)}</td>
                                                            <td data-label={t('th.reference')}>
                                                                {ref != null && ref !== '' && typeof ref === 'object' && !Array.isArray(ref) ? (
                                                                    <ReferencePills value={ref} />
                                                                ) : (
                                                                    <span className="ui-tag">{ref != null && ref !== '' ? String(ref) : '—'}</span>
                                                                )}
                                                            </td>
                                                            <td data-label={t('th.note')} className="ui-help">
                                                                {displayCell(row.note)}
                                                            </td>
                                                            <td data-label={t('th.staff')} style={{ fontSize: '0.8125rem' }}>
                                                                {displayCell(row.actor)}
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                    <UiPager {...ledgerPagerProps} />
                                </section>
                            </>
                        ),
                    },
                ]}
            />

        </div>
    );
}

function BranchMovementModal({ product, workshopId, branchId, onClose, t }) {
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [appliedFrom, setAppliedFrom] = useState('');
    const [appliedTo, setAppliedTo] = useState('');
    const [offset, setOffset] = useState(0);
    const [movementLimit, setMovementLimit] = useState(MOVEMENT_LIMIT);
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
                limit: movementLimit,
                offset,
            });
            setPayload(unwrapData(res));
        } catch (e) {
            setPayload(null);
            setError(e?.message || t('err.loadHistory'));
        } finally {
            setLoading(false);
        }
    }, [product?.productId, workshopId, branchId, appliedFrom, appliedTo, offset, movementLimit, t]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const applyDates = () => {
        setAppliedFrom(from);
        setAppliedTo(to);
        setOffset(0);
    };

    return (
        <AdminModalAsScreen
            title={t('modal.historyTitle')}
            onClose={onClose}
            size="large"
            footer={
                <button type="button" className="ui-btn ui-btn--default" onClick={onClose}>
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
                limit={movementLimit}
                offset={offset}
                onOffsetChange={setOffset}
                onLimitChange={setMovementLimit}
                from={from}
                to={to}
                onFromChange={setFrom}
                onToChange={setTo}
                onApplyDates={applyDates}
                t={t}
            />
        </AdminModalAsScreen>
    );
}
