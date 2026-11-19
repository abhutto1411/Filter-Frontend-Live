import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AlertTriangle,
    FileSpreadsheet,
    FileText,
    History,
    Package,
    Pencil,
    Search,
    TrendingUp,
} from 'lucide-react';
import { ShimmerKpiGrid, ShimmerTable } from '../../components/supplier/Shimmer';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import RowActionsMenu from '../../components/RowActionsMenu';
import { useColumnSort, SortableTh } from '../../components/TableSort';
import {
    fetchAllSupplierProducts,
    fetchAllSupplierStockBalances,
    getSupplierProductInventoryTimeline,
    setSupplierStock,
    updateSupplierProduct,
} from '../../services/supplierApi';
import SupplierProductHistoryDrawer from './accounting/SupplierProductHistoryDrawer';
import StockProductPurchasePriceEditModal from './StockProductPurchasePriceEditModal';
import StockProductSalesPriceEditModal from './StockProductSalesPriceEditModal';
import StockProductCriticalLevelEditModal from './StockProductCriticalLevelEditModal';
import SupplierStockProductTimelineScreen from './SupplierStockProductTimelineScreen';

function stockRowMatchesSearch(row, searchText) {
    const q = String(searchText || '').trim().toLowerCase();
    if (!q) return true;
    const tokens = q.split(/\s+/).filter(Boolean);
    const hay = [
        row?.name,
        row?.sku,
        row?.masterProductName,
        row?.masterProductSku,
        row?.masterProductArabicName,
    ]
        .map((v) => String(v || '').toLowerCase())
        .join(' ');
    return tokens.every((t) => hay.includes(t));
}
import {
    mapSupplierHistoryToMovementRegister,
    mapSupplierHistoryToTimelineEntries,
    formatSupplierTimelineSourceRef,
    formatDualUomQty,
    warehouseStockLineValueSar,
} from './supplierInventoryTimelineUtils';
import {
    exportMovementsExcel,
    exportMovementsPdf,
    exportStockInventoryExcel,
    exportStockInventoryPdf,
} from './supplierInventoryExport';
import { sstockT } from '../../utils/supplierStockI18n';
import { validatedUnitCostString } from './supplierUnitCost';
import { SUPPLIER_PERM, useSupplierCan } from '../../utils/supplierPermissions';
import {
    getSupplierInventoryValuation,
    getSupplierProductStockLedger,
    getSupplierTrialBalance,
} from '../../services/supplierAccountingApi';
import SupplierReportsDateBar from './SupplierReportsDateBar';
import SupplierRiyalAmount from './SupplierRiyalAmount';
import {
    stockQtyTimesAvgSar,
    stockHasUnaveragedLines,
    inventoryGl1200Balance,
    stockGlTieOut,
    INVENTORY_GL_CODE,
} from './supplierStockGlTieOut';
import { inclusiveYmdForPreset } from '../workshop/reportsAnalyticsScope.js';
import { toRiyadhDateISO } from '../../utils/riyadhBusinessRange';

function fmtQty(n) {
    if (n == null || !Number.isFinite(Number(n))) return '—';
    const x = Number(n);
    if (Math.abs(x - Math.round(x)) < 1e-9) return String(Math.round(x));
    const s = x.toFixed(3).replace(/\.?0+$/, '');
    return s;
}

function fmtDelta(d) {
    if (d == null || !Number.isFinite(Number(d))) return '—';
    const n = Number(d);
    if (n > 0) return `+${fmtQty(n)}`;
    return fmtQty(n);
}

/** Purchase Invoices (AP) consumes this to open “New Purchase Invoice” with one line preset. */
const PI_PRESET_FROM_STOCK_FLAG = 'supplier_pi_open_from_stock';
const PI_PRESET_STOCK_LINE = 'supplier_pi_preset_stock_line';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 25;

function sliceClientPage(rows, page, pageSize) {
    const list = Array.isArray(rows) ? rows : [];
    const total = list.length;
    const size = Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE);
    const pages = Math.max(1, Math.ceil(total / size) || 1);
    const safePage = Math.min(Math.max(1, Number(page) || 1), pages);
    const start = (safePage - 1) * size;
    return {
        rows: list.slice(start, start + size),
        page: safePage,
        pages,
        from: total === 0 ? 0 : start + 1,
        to: Math.min(start + size, total),
        total,
    };
}

function StockTablePager({ t, page, pageSize, total, onPageChange, onPageSizeChange }) {
    const size = Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE);
    const pages = Math.max(1, Math.ceil((Number(total) || 0) / size) || 1);
    const safePage = Math.min(Math.max(1, Number(page) || 1), pages);
    const from = !total ? 0 : (safePage - 1) * size + 1;
    const to = Math.min(safePage * size, Number(total) || 0);
    return (
        <div
            style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                marginTop: 14,
            }}
        >
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                {t('pager.range', { from, to, total: Number(total) || 0 })}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                <label
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: '0.8125rem',
                        color: 'var(--color-text-muted)',
                    }}
                >
                    {t('pager.rows')}
                    <select
                        className="pi-row-input"
                        value={size}
                        onChange={(e) =>
                            onPageSizeChange(Number(e.target.value) || DEFAULT_PAGE_SIZE)
                        }
                        style={{ width: 'auto', minWidth: 72, padding: '6px 8px' }}
                    >
                        {PAGE_SIZE_OPTIONS.map((n) => (
                            <option key={n} value={n}>
                                {n}
                            </option>
                        ))}
                    </select>
                </label>
                <button
                    type="button"
                    className="btn-portal-outline"
                    disabled={safePage <= 1}
                    onClick={() => onPageChange(safePage - 1)}
                >
                    {t('btn.prev')}
                </button>
                <button
                    type="button"
                    className="btn-portal-outline"
                    disabled={safePage >= pages}
                    onClick={() => onPageChange(safePage + 1)}
                >
                    {t('btn.next')}
                </button>
            </div>
        </div>
    );
}

const exportToolbarBtnStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    borderRadius: 8,
    border: '1px solid var(--color-border)',
    background: '#fff',
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: 'pointer',
    color: 'var(--color-text-dark)',
};

/* ───────────── SP-15 — Inventory valuation vs GL 1200 + per-SKU stock ledger ───────────── */

const VAL_CARD = { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 16, marginBottom: 12 };
const VAL_BTN = {
    padding: '7px 12px',
    borderRadius: 8,
    border: '1px solid #CBD5E1',
    background: '#fff',
    color: '#0F172A',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
};
const valQty = (v) => {
    const n = Number(v || 0);
    return Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: 3 }) : '0';
};

/**
 * Per-SKU stock ledger: date, type, document, qty in / out, unit cost, running qty, running value
 * (moving average, as written by the live inventory writer). A row opens its journal voucher; the
 * document button opens the source document.
 */
function SupplierStockLedgerPanel({ productId, locale, t, navigate, onBack }) {
    const numAlign = locale === 'ar' ? 'left' : 'right';
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [exporting, setExporting] = useState('');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setErr('');
            try {
                const res = await getSupplierProductStockLedger(productId, { dateFrom, dateTo });
                if (!cancelled) setData(res?.data && res?.data?.rows ? res.data : res);
            } catch (e) {
                if (!cancelled) setErr(e?.message || t('val.err'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [productId, dateFrom, dateTo, t]);

    const canExport = useSupplierCan()(SUPPLIER_PERM.reportsExport); // SP-22
    const runExport = async (kind) => {
        if (!data || exporting) return;
        setExporting(kind);
        try {
            const mod = await import('../../utils/supplierLedgerExport');
            if (kind === 'pdf') await mod.exportStockLedgerPdf({ data });
            else mod.exportStockLedgerExcel({ data });
        } catch (e) {
            setErr(e?.message || t('val.err'));
        } finally {
            setExporting('');
        }
    };

    const rows = data?.rows || [];
    const open = (href) => href && navigate(href);
    return (
        <div style={VAL_CARD}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                    <button type="button" style={{ ...VAL_BTN, marginBottom: 6 }} onClick={onBack}>
                        ← {t('val.back')}
                    </button>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0F172A' }}>
                        {t('val.ledger.title')}: {data?.product?.name || ''}
                        {data?.product?.sku ? <span style={{ color: '#64748B', fontWeight: 600 }}> · {data.product.sku}</span> : null}
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748B' }}>{t('val.ledger.hint')}</p>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}>
                    <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 600 }}>
                        {t('val.from')}
                        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #CBD5E1' }} />
                    </label>
                    <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 600 }}>
                        {t('val.to')}
                        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #CBD5E1' }} />
                    </label>
                    <button type="button" style={VAL_BTN} disabled={!data || Boolean(exporting) || !canExport} onClick={() => runExport('pdf')}>
                        {exporting === 'pdf' ? t('val.exporting') : 'PDF'}
                    </button>
                    <button type="button" style={VAL_BTN} disabled={!data || Boolean(exporting) || !canExport} onClick={() => runExport('excel')}>
                        {exporting === 'excel' ? t('val.exporting') : 'Excel'}
                    </button>
                </div>
            </div>
            {err ? <div style={{ color: '#B91C1C', fontSize: 13, marginBottom: 8 }}>{err}</div> : null}
            {loading ? (
                <ShimmerTable rows={8} columns={9} />
            ) : (
                <>
                    {data?.live && data.live.qtyMatches === false ? (
                        <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: '#FFFBEB', color: '#92400E', fontSize: 12, fontWeight: 600 }}>
                            {t('val.ledger.liveMismatch', { live: valQty(data.live.qty), ledger: valQty(data.closing.qty) })}
                        </div>
                    ) : null}
                    {data?.truncated ? <div style={{ marginBottom: 8, fontSize: 12, color: '#92400E' }}>{t('val.ledger.truncated')}</div> : null}
                    <div style={{ width: '100%', overflowX: 'auto' }}>
                        <table className="ws-table" style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th>{t('val.th.date')}</th>
                                    <th>{t('val.th.type')}</th>
                                    <th>{t('val.th.document')}</th>
                                    <th style={{ textAlign: numAlign }}>{t('val.th.qtyIn')}</th>
                                    <th style={{ textAlign: numAlign }}>{t('val.th.qtyOut')}</th>
                                    <th style={{ textAlign: numAlign }}>{t('val.th.unitCost')}</th>
                                    <th style={{ textAlign: numAlign }}>{t('val.th.runningQty')}</th>
                                    <th style={{ textAlign: numAlign }}>{t('val.th.runningValue')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style={{ background: '#F8FAFC', fontWeight: 700 }}>
                                    <td colSpan={6}>{t('val.opening')}</td>
                                    <td style={{ textAlign: numAlign }}>{valQty(data?.opening?.qty)}</td>
                                    <td style={{ textAlign: numAlign }}><SupplierRiyalAmount amount={Number(data?.opening?.value || 0)} size={12} /></td>
                                </tr>
                                {rows.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} style={{ color: '#64748B' }}>{t('val.ledger.empty')}</td>
                                    </tr>
                                ) : (
                                    rows.map((r) => (
                                        <tr
                                            key={r.id}
                                            role={r.proof?.sourceHref ? 'button' : undefined}
                                            tabIndex={r.proof?.sourceHref ? 0 : undefined}
                                            style={{ cursor: r.proof?.sourceHref ? 'pointer' : 'default' }}
                                            onClick={() => open(r.proof?.sourceHref)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') open(r.proof?.sourceHref);
                                            }}
                                        >
                                            <td style={{ whiteSpace: 'nowrap' }}>{r.date}</td>
                                            <td>
                                                {r.movementType}
                                                {r.locationName ? <div style={{ fontSize: 11, color: '#94A3B8' }}>{r.locationName}</div> : null}
                                            </td>
                                            <td>
                                                {r.proof?.journalEntryNumber ? <span style={{ fontWeight: 700 }}>{r.proof.journalEntryNumber}</span> : '—'}
                                                {r.journalVoid ? <span style={{ color: '#B91C1C', fontSize: 11 }}> ({t('val.void')})</span> : null}
                                                {r.documentHref ? (
                                                    <button
                                                        type="button"
                                                        style={{ ...VAL_BTN, padding: '1px 6px', fontSize: 11, marginInlineStart: 6 }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigate(r.documentHref);
                                                        }}
                                                    >
                                                        {t('val.document')}
                                                    </button>
                                                ) : null}
                                            </td>
                                            <td style={{ textAlign: numAlign }}>{Number(r.qtyIn) ? valQty(r.qtyIn) : ''}</td>
                                            <td style={{ textAlign: numAlign }}>{Number(r.qtyOut) ? valQty(r.qtyOut) : ''}</td>
                                            <td style={{ textAlign: numAlign }}><SupplierRiyalAmount amount={Number(r.unitCost || 0)} size={12} /></td>
                                            <td style={{ textAlign: numAlign }}>{valQty(r.runningQty)}</td>
                                            <td style={{ textAlign: numAlign }}><SupplierRiyalAmount amount={Number(r.runningValue || 0)} size={12} /></td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            <tfoot>
                                <tr style={{ borderTop: '2px solid #0F172A', fontWeight: 800 }}>
                                    <td colSpan={3}>{t('val.closing')}</td>
                                    <td style={{ textAlign: numAlign }}>{valQty(data?.totals?.qtyIn)}</td>
                                    <td style={{ textAlign: numAlign }}>{valQty(data?.totals?.qtyOut)}</td>
                                    <td />
                                    <td style={{ textAlign: numAlign }}>{valQty(data?.closing?.qty)}</td>
                                    <td style={{ textAlign: numAlign }}><SupplierRiyalAmount amount={Number(data?.closing?.value || 0)} size={12} /></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}

/** Valuation report: Σ qty × moving average vs GL 1200, the documented gap (GL − stock), and the SKU list. */
function SupplierInventoryValuationPanel({ locale, t, navigate, initialProductId }) {
    const numAlign = locale === 'ar' ? 'left' : 'right';
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [query, setQuery] = useState('');
    const [productId, setProductId] = useState(initialProductId || null);
    const [exporting, setExporting] = useState('');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setErr('');
            try {
                const res = await getSupplierInventoryValuation();
                if (!cancelled) setData(res?.data && res?.data?.totals ? res.data : res);
            } catch (e) {
                if (!cancelled) setErr(e?.message || t('val.err'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [t]);

    const canExport = useSupplierCan()(SUPPLIER_PERM.reportsExport); // SP-22
    const runExport = async (kind) => {
        if (!data || exporting) return;
        setExporting(kind);
        try {
            const mod = await import('../../utils/supplierLedgerExport');
            if (kind === 'pdf') await mod.exportInventoryValuationPdf({ data });
            else mod.exportInventoryValuationExcel({ data });
        } catch (e) {
            setErr(e?.message || t('val.err'));
        } finally {
            setExporting('');
        }
    };

    if (productId) {
        return (
            <SupplierStockLedgerPanel productId={productId} locale={locale} t={t} navigate={navigate} onBack={() => setProductId(null)} />
        );
    }

    const tot = data?.totals;
    const q = query.trim().toLowerCase();
    const items = (data?.items || []).filter(
        (i) => !q || String(i.name || '').toLowerCase().includes(q) || String(i.sku || '').toLowerCase().includes(q),
    );
    const diff = tot?.difference != null ? Number(tot.difference) : null;
    const kpi = (label, value, color) => (
        <div style={{ flex: '1 1 200px', padding: 12, borderRadius: 10, border: '1px solid #E2E8F0', background: '#F8FAFC' }}>
            <div style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: color || '#0F172A', marginTop: 4 }}>
                {value == null ? '—' : <SupplierRiyalAmount amount={Number(value)} size={15} />}
            </div>
        </div>
    );

    return (
        <div>
            <div style={VAL_CARD}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0F172A' }}>{t('val.title')}</h3>
                        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748B' }}>
                            {t('val.hint', { asOf: data?.asOf || '' })}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" style={VAL_BTN} disabled={!data || Boolean(exporting) || !canExport} onClick={() => runExport('pdf')}>
                            {exporting === 'pdf' ? t('val.exporting') : 'PDF'}
                        </button>
                        <button type="button" style={VAL_BTN} disabled={!data || Boolean(exporting) || !canExport} onClick={() => runExport('excel')}>
                            {exporting === 'excel' ? t('val.exporting') : 'Excel'}
                        </button>
                    </div>
                </div>
                {err ? <div style={{ color: '#B91C1C', fontSize: 13, marginBottom: 8 }}>{err}</div> : null}
                {loading ? (
                    <ShimmerKpiGrid cards={3} />
                ) : tot ? (
                    <>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                            {kpi(t('val.kpi.stock'), tot.valuation)}
                            {kpi(t('val.kpi.gl'), tot.gl1200)}
                            {kpi(t('val.kpi.diff'), tot.difference, tot.tiesOut ? '#065F46' : '#B91C1C')}
                        </div>
                        <div
                            role="status"
                            style={{
                                marginTop: 10,
                                padding: '8px 12px',
                                borderRadius: 8,
                                fontSize: 12,
                                fontWeight: 600,
                                background: tot.tiesOut ? '#ECFDF5' : '#FEF2F2',
                                color: tot.tiesOut ? '#065F46' : '#B91C1C',
                                border: `1px solid ${tot.tiesOut ? '#A7F3D0' : '#FECACA'}`,
                            }}
                        >
                            {tot.gl1200 == null
                                ? t('val.noGl')
                                : tot.tiesOut
                                  ? t('val.ties')
                                  : t(diff > 0 ? 'val.gapGlAbove' : 'val.gapGlBelow', { diff: String(tot.difference).replace('-', '') })}
                        </div>
                        {data.checks?.unaveragedSkus?.length ? (
                            <div style={{ marginTop: 8, fontSize: 12, color: '#92400E' }}>
                                {t('val.unaveraged', { n: data.checks.unaveragedSkus.length })}
                            </div>
                        ) : null}
                        {data.checks?.qtyVsMovementMismatches?.length ? (
                            <div style={{ marginTop: 4, fontSize: 12, color: '#92400E' }}>
                                {t('val.qtyMismatch', { n: data.checks.qtyVsMovementMismatches.length })}
                            </div>
                        ) : null}
                        {data.inventoryAccount?.ledgerHref ? (
                            <button type="button" style={{ ...VAL_BTN, marginTop: 10 }} onClick={() => navigate(data.inventoryAccount.ledgerHref)}>
                                {t('val.openGl')}
                            </button>
                        ) : null}
                    </>
                ) : null}
            </div>

            {!loading && data?.glBySource?.length ? (
                <div style={VAL_CARD}>
                    <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 800 }}>{t('val.bySource.title')}</h4>
                    <p style={{ margin: '0 0 8px', fontSize: 12, color: '#64748B' }}>{t('val.bySource.hint')}</p>
                    <div style={{ width: '100%', overflowX: 'auto' }}>
                        <table className="ws-table" style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th>{t('val.th.source')}</th>
                                    <th style={{ textAlign: numAlign }}>{t('val.th.debit')}</th>
                                    <th style={{ textAlign: numAlign }}>{t('val.th.credit')}</th>
                                    <th style={{ textAlign: numAlign }}>{t('val.th.net')}</th>
                                    <th style={{ textAlign: numAlign }}>{t('val.th.lines')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.glBySource.map((s) => (
                                    <tr key={s.source || 'none'}>
                                        <td>{s.source || '—'}</td>
                                        <td style={{ textAlign: numAlign }}><SupplierRiyalAmount amount={Number(s.debit)} size={12} /></td>
                                        <td style={{ textAlign: numAlign }}><SupplierRiyalAmount amount={Number(s.credit)} size={12} /></td>
                                        <td style={{ textAlign: numAlign }}><SupplierRiyalAmount amount={Number(s.net)} size={12} /></td>
                                        <td style={{ textAlign: numAlign }}>{s.lines}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : null}

            {!loading ? (
                <div style={VAL_CARD}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>{t('val.items.title', { n: items.length })}</h4>
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={t('val.search')}
                            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #CBD5E1', minWidth: 200 }}
                        />
                    </div>
                    <div style={{ width: '100%', overflowX: 'auto' }}>
                        <table className="ws-table" style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th>{t('val.th.item')}</th>
                                    <th style={{ textAlign: numAlign }}>{t('val.th.qty')}</th>
                                    <th style={{ textAlign: numAlign }}>{t('val.th.avg')}</th>
                                    <th style={{ textAlign: numAlign }}>{t('val.th.value')}</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((i) => (
                                    <tr key={i.productId} style={{ cursor: 'pointer' }} onClick={() => setProductId(i.productId)}>
                                        <td>
                                            <span style={{ fontWeight: 700 }}>{i.name}</span>
                                            {i.sku ? <span style={{ color: '#64748B' }}> · {i.sku}</span> : null}
                                            {i.unaveraged ? <span style={{ color: '#B91C1C', fontSize: 11 }}> ({t('val.noAvg')})</span> : null}
                                            {!i.qtyMatchesMovements ? (
                                                <span style={{ color: '#92400E', fontSize: 11 }}> ({t('val.movementQty', { q: valQty(i.movementQty) })})</span>
                                            ) : null}
                                        </td>
                                        <td style={{ textAlign: numAlign }}>{valQty(i.qty)}</td>
                                        <td style={{ textAlign: numAlign }}><SupplierRiyalAmount amount={Number(i.averageCost)} size={12} /></td>
                                        <td style={{ textAlign: numAlign }}><SupplierRiyalAmount amount={Number(i.value)} size={12} /></td>
                                        <td>
                                            <button type="button" style={{ ...VAL_BTN, padding: '2px 8px', fontSize: 12 }} onClick={(e) => { e.stopPropagation(); setProductId(i.productId); }}>
                                                {t('val.openLedger')}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            {tot ? (
                                <tfoot>
                                    <tr style={{ borderTop: '2px solid #0F172A', fontWeight: 800 }}>
                                        <td colSpan={3}>{t('val.total')}</td>
                                        <td style={{ textAlign: numAlign }}><SupplierRiyalAmount amount={Number(tot.valuation)} size={12} /></td>
                                        <td />
                                    </tr>
                                </tfoot>
                            ) : null}
                        </table>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

export default function SupplierStockInventory({ locale: localeProp }) {
    const locale =
        localeProp ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => sstockT(locale, key, vars), [locale]);
    const navigate = useNavigate();
    const [stock, setStock] = useState([]);
    const [stockTotal, setStockTotal] = useState(0);
    /** SP-17: the walk ended before the API total — never hide that. */
    const [stockLoadIncomplete, setStockLoadIncomplete] = useState(false);
    const [movementHistory, setMovementHistory] = useState([]);
    const [productMovementEntries, setProductMovementEntries] = useState(null);
    const [warehouseQtyByProductId, setWarehouseQtyByProductId] = useState({});
    const [productUomByProductId, setProductUomByProductId] = useState({});
    const [movementProductId, setMovementProductId] = useState(null);
    const [movementProductSearch, setMovementProductSearch] = useState('');
    const [movementPickerOpen, setMovementPickerOpen] = useState(false);
    const [movementPickerIdx, setMovementPickerIdx] = useState(0);
    const movementSearchRef = useRef(null);
    const movementPickerListRef = useRef(null);
    // SP-15: `?tab=valuation[&product=<id>]` opens the valuation report / a SKU's stock ledger.
    const [activeTab, setActiveTab] = useState(() => {
        try {
            return new URLSearchParams(window.location.search).get('tab') === 'valuation' ? 'valuation' : 'inventory';
        } catch {
            return 'inventory';
        }
    });
    const [valuationProductId, setValuationProductId] = useState(() => {
        try {
            return new URLSearchParams(window.location.search).get('product') || null;
        } catch {
            return null;
        }
    });
    const [search, setSearch] = useState('');
    const [criticalOnly, setCriticalOnly] = useState(false);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
    const [inventoryPage, setInventoryPage] = useState(1);
    const [itemsPage, setItemsPage] = useState(1);
    const [movementsPage, setMovementsPage] = useState(1);
    const [movementDateFrom, setMovementDateFrom] = useState(
        () => inclusiveYmdForPreset('last_7').dateFrom,
    );
    const [movementDateTo, setMovementDateTo] = useState(
        () => inclusiveYmdForPreset('last_7').dateTo,
    );
    const [glTbAccounts, setGlTbAccounts] = useState([]);
    const [glTbError, setGlTbError] = useState('');

    const [inventoryItems, setInventoryItems] = useState([]);
    const [itemsLoading, setItemsLoading] = useState(false);
    const [itemsError, setItemsError] = useState('');
    const [removingId, setRemovingId] = useState(null);
    const [adjustModalOpen, setAdjustModalOpen] = useState(false);
    const [adjustItem, setAdjustItem] = useState(null);
    const [adjustmentType, setAdjustmentType] = useState('remove');
    const [adjustQty, setAdjustQty] = useState('');
    const [adjustUnitCost, setAdjustUnitCost] = useState('');
    const [adjustCostError, setAdjustCostError] = useState('');
    const [adjustNotes, setAdjustNotes] = useState('');
    /** SP-17: shown in the adjust modal (e.g. a decrease below on-hand is refused). */
    const [adjustError, setAdjustError] = useState('');
    const [adjustConfirming, setAdjustConfirming] = useState(false);
    const [loading, setLoading] = useState(true);
    const [apiError, setApiError] = useState('');

    const [timelineProduct, setTimelineProduct] = useState(null);
    const [timelineEntries, setTimelineEntries] = useState([]);
    const [timelineLoading, setTimelineLoading] = useState(false);
    const [timelineError, setTimelineError] = useState('');
    const [accountingHistoryProduct, setAccountingHistoryProduct] = useState(null);
    const [purchasePriceEditProduct, setPurchasePriceEditProduct] = useState(null);
    const [salesPriceEditProduct, setSalesPriceEditProduct] = useState(null);
    const [criticalLevelEditProduct, setCriticalLevelEditProduct] = useState(null);

    const filteredList = useMemo(() => {
        let list = stock || [];
        if (criticalOnly) {
            list = list.filter((s) => {
                if (s.stockStatus === 'low' || s.stockStatus === 'critical') return true;
                const crit = s.criticalLevel ?? 0;
                const reorder = s.reorder;
                if (s.qty <= crit) return true;
                if (reorder != null && s.qty <= reorder) return true;
                return false;
            });
        }
        if (!search.trim()) return list;
        return list.filter((s) => stockRowMatchesSearch(s, search));
    }, [stock, search, criticalOnly]);

    /** 3-state column sorting for the inventory / items / movements tables. */
    const stockSort = useColumnSort();
    const itemsSort = useColumnSort();
    const movementsSort = useColumnSort();

    const changePageSize = useCallback((nextSize) => {
        setPageSize(nextSize);
        setInventoryPage(1);
        setItemsPage(1);
        setMovementsPage(1);
    }, []);

    const filteredItemsList = useMemo(() => {
        return (inventoryItems || [])
            .filter((p) => {
                const q = search.trim().toLowerCase();
                if (!q) return true;
                return (
                    String(p?.name || p?.productName || '')
                        .toLowerCase()
                        .includes(q) || String(p?.sku || '').toLowerCase().includes(q)
                );
            })
            .filter((p) => {
                if (!criticalOnly) return true;
                const pid = String(p?.id);
                const wh = Number(warehouseQtyByProductId[pid] ?? 0);
                const crit = Number(p?.criticalStockAlert ?? 0);
                return crit > 0 && wh <= crit;
            });
    }, [inventoryItems, search, criticalOnly, warehouseQtyByProductId]);

    const sortedStockList = useMemo(
        () =>
            stockSort.sortRows(filteredList, {
                product: (s) => s.name,
                sku: (s) => s.sku,
                unit: (s) => s.warehouseUnit || s.unit,
                stockQty: (s) => Number(s.warehouseQty ?? s.qty ?? 0),
                awaiting: (s) => Number(s.pendingWorkshopReceive ?? 0),
                critical: (s) => Number(s.criticalLevel ?? 0),
                reorder: (s) => Number(s.reorder ?? 0),
                price: (s) => Number(s.price ?? 0),
                salePrice: (s) => Number(s.salePrice ?? 0),
                value: (s) => Number(warehouseStockLineValueSar(s) ?? 0),
                status: (s) => (s.qty <= (s.criticalLevel ?? 0) ? 'critical' : 'ok'),
            }),
        [filteredList, stockSort],
    );

    const sortedItemsList = useMemo(
        () =>
            itemsSort.sortRows(filteredItemsList, {
                product: (p) => p?.name || p?.productName || '',
                sku: (p) => p?.sku || '',
                qtyWh: (p) => Number(warehouseQtyByProductId[String(p?.id)] ?? 0),
                qtyWs: (p) => {
                    const pid = String(p?.id);
                    const uom = productUomByProductId[pid] || {};
                    const cf =
                        Number(uom.conversionFactor || p?.conversionFactor || 1) || 1;
                    return Number(warehouseQtyByProductId[pid] ?? 0) * cf;
                },
                critical: (p) => Number(p?.criticalStockAlert ?? 0),
            }),
        [filteredItemsList, itemsSort, warehouseQtyByProductId, productUomByProductId],
    );

    const inventoryPageSlice = useMemo(
        () => sliceClientPage(sortedStockList, inventoryPage, pageSize),
        [sortedStockList, inventoryPage, pageSize],
    );
    const itemsPageSlice = useMemo(
        () => sliceClientPage(sortedItemsList, itemsPage, pageSize),
        [sortedItemsList, itemsPage, pageSize],
    );

    const movementProductOptions = useMemo(() => {
        const list = stock || [];
        const q = movementProductSearch.trim().toLowerCase();
        if (!q) return list;
        return list.filter(
            (s) =>
                (s.name || '').toLowerCase().includes(q) ||
                (s.sku || '').toLowerCase().includes(q),
        );
    }, [stock, movementProductSearch]);

    const selectedMovementProduct = useMemo(() => {
        if (!movementProductId) return null;
        return stock.find((s) => String(s.id) === String(movementProductId)) || null;
    }, [stock, movementProductId]);

    const displayedMovementEntries = useMemo(() => {
        let rows = [];
        if (movementProductId && productMovementEntries) {
            rows = productMovementEntries;
        } else if (!movementHistory.length) {
            rows = [];
        } else if (movementProductId) {
            const filtered = movementHistory.filter(
                (h) => String(h.supplierProductId) === String(movementProductId),
            );
            const whQty = warehouseQtyByProductId[String(movementProductId)] ?? 0;
            const uom = productUomByProductId[String(movementProductId)] || {};
            rows = mapSupplierHistoryToTimelineEntries(filtered, whQty, uom);
        } else {
            rows = mapSupplierHistoryToMovementRegister(
                movementHistory,
                warehouseQtyByProductId,
                productUomByProductId,
            );
        }
        const from = String(movementDateFrom || '');
        const to = String(movementDateTo || '');
        if (!from && !to) return rows;
        return rows.filter((e) => {
            const ymd = e?.at ? toRiyadhDateISO(new Date(e.at)) : '';
            if (from && ymd && ymd < from) return false;
            if (to && ymd && ymd > to) return false;
            return true;
        });
    }, [
        movementHistory,
        warehouseQtyByProductId,
        productUomByProductId,
        movementProductId,
        productMovementEntries,
        movementDateFrom,
        movementDateTo,
    ]);

    const sortedMovementEntries = useMemo(
        () =>
            movementsSort.sortRows(displayedMovementEntries, {
                when: (e) => new Date(e.at).getTime() || 0,
                product: (e) => e.productLabel || '',
                fromWh: (e) => Number(e.previousQty ?? 0),
                toWh: (e) => Number(e.newQty ?? 0),
                deltaWh: (e) => Number(e.delta ?? 0),
                wsEquiv: (e) => Number(e.deltaWorkshop ?? e.previousQtyWorkshop ?? 0),
                reason: (e) => e.reason || '',
                sourceRef: (e) => formatSupplierTimelineSourceRef(e) || '',
                by: (e) => e.adjustedBy?.name || '',
            }),
        [displayedMovementEntries, movementsSort],
    );

    const movementsPageSlice = useMemo(
        () => sliceClientPage(sortedMovementEntries, movementsPage, pageSize),
        [sortedMovementEntries, movementsPage, pageSize],
    );

    const movementFinalBalance = useMemo(() => {
        if (!movementProductId) return null;
        return warehouseQtyByProductId[String(movementProductId)] ?? 0;
    }, [movementProductId, warehouseQtyByProductId]);

    useEffect(() => {
        setInventoryPage(1);
        setItemsPage(1);
    }, [search, criticalOnly]);

    useEffect(() => {
        setInventoryPage(1);
    }, [stockSort.sortKey, stockSort.sortDir]);

    useEffect(() => {
        setItemsPage(1);
    }, [itemsSort.sortKey, itemsSort.sortDir]);

    useEffect(() => {
        setMovementsPage(1);
    }, [
        movementsSort.sortKey,
        movementsSort.sortDir,
        movementProductId,
        movementDateFrom,
        movementDateTo,
    ]);

    const selectMovementProduct = useCallback((product) => {
        if (!product?.id) return;
        setMovementProductId(String(product.id));
        setMovementProductSearch(product.name || '');
        setMovementPickerOpen(false);
        setMovementPickerIdx(0);
    }, []);

    const clearMovementProductFilter = useCallback(() => {
        setMovementProductId(null);
        setMovementProductSearch('');
        setMovementPickerOpen(false);
        setMovementPickerIdx(0);
        movementSearchRef.current?.focus();
    }, []);

    const onMovementSearchKeyDown = useCallback(
        (e) => {
            const options = movementProductOptions;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setMovementPickerOpen(true);
                setMovementPickerIdx((i) =>
                    options.length === 0 ? 0 : Math.min(i + 1, options.length - 1),
                );
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setMovementPickerOpen(true);
                setMovementPickerIdx((i) => Math.max(i - 1, 0));
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                if (options.length === 0) return;
                const pick = options[movementPickerIdx] ?? options[0];
                selectMovementProduct(pick);
                return;
            }
            if (e.key === 'Escape') {
                setMovementPickerOpen(false);
            }
        },
        [movementProductOptions, movementPickerIdx, selectMovementProduct],
    );

    useEffect(() => {
        if (!movementPickerOpen || !movementPickerListRef.current) return;
        const el = movementPickerListRef.current.querySelector(
            `[data-movement-pick-idx="${movementPickerIdx}"]`,
        );
        el?.scrollIntoView({ block: 'nearest' });
    }, [movementPickerIdx, movementPickerOpen]);

    const totalSKUs = stockTotal || stock.length;
    const criticalCount = stock.filter((s) => s.qty <= (s.criticalLevel ?? 0)).length;
    const reorderNeededCount = stock.filter(
        (s) => s.reorder != null && s.qty <= s.reorder && s.qty > (s.criticalLevel ?? 0),
    ).length;
    const inventoryValue = stockQtyTimesAvgSar(stock);
    const glTie = stockGlTieOut({
        stockValue: inventoryValue,
        glBalance: inventoryGl1200Balance(glTbAccounts),
        unaveraged: stockHasUnaveragedLines(stock),
    });

    const locationSummary = (row) => {
        const locs = row?.byLocation || [];
        const whUom = row?.warehouseUnit || 'Box';
        const wsUom = row?.unit || 'Liter';
        if (!locs.length) return '—';
        return locs
            .map((l) =>
                `${l.locationName || '—'}: ${formatDualUomQty(
                    l.quantityWarehouseUnits,
                    whUom,
                    l.quantityWorkshopUnits,
                    wsUom,
                )}`,
            )
            .join(' · ');
    };

    const loadStock = useCallback(async (opts = {}) => {
        const silent = !!opts.silent;
        if (!silent) {
            setLoading(true);
        }
        setApiError('');
        try {
            // SP-17: walks every page until the API total is covered (no 2000-row stop).
            const res = await fetchAllSupplierStockBalances({ historyLimit: 2000 });
            const items = Array.isArray(res?.items)
                ? res.items.map((item) => ({
                      id: item.productId,
                      sku: item.sku || '-',
                      name: item.productName,
                      stockStatus: item.status || null,
                      unit: item.workshopUnit || 'pcs',
                      warehouseUnit: item.warehouseUnit || 'Box',
                      conversionFactor: Number(item.conversionFactor) || 1,
                      openingAdoption: item.openingAdoption != null ? Number(item.openingAdoption) : null,
                      qty: Number(item.currentBalanceWorkshop || 0),
                      warehouseQty: Number(item.currentBalanceWarehouse || 0),
                      pendingWorkshopReceive: Number(
                          item.pendingWorkshopReceiveWorkshop || 0,
                      ),
                      pendingWorkshopReceiveWarehouse: Number(
                          item.pendingWorkshopReceiveWarehouse || 0,
                      ),
                      // MZ-08: the API value is at COST (qty × moving average), not selling price.
                      valueWarehouseSar:
                          item.valueWarehouseSar != null
                              ? Number(item.valueWarehouseSar)
                              : null,
                      costMissing: Boolean(item.costMissing),
                      criticalLevel: item.criticalAt != null ? Number(item.criticalAt) : 0,
                      reorder: item.reorderAt != null ? Number(item.reorderAt) : 0,
                      price:
                          Number(item.valueWarehouseSar || 0) > 0 &&
                          Number(item.currentBalanceWarehouse || 0) > 0
                              ? Number(item.valueWarehouseSar) /
                                Number(item.currentBalanceWarehouse)
                              : 0,
                      averageCostWarehouse:
                          item.averageCostWarehouse != null &&
                          Number(item.averageCostWarehouse) > 0
                              ? Number(item.averageCostWarehouse)
                              : null,
                      salePrice: (() => {
                          const sp =
                              item.salePrice != null && Number(item.salePrice) > 0
                                  ? Number(item.salePrice)
                                  : null;
                          return sp;
                      })(),
                      salePriceWarehouse: (() => {
                          const sp =
                              item.salePrice != null && Number(item.salePrice) > 0
                                  ? Number(item.salePrice)
                                  : null;
                          if (sp == null) return null;
                          const cf = Number(item.conversionFactor) || 1;
                          return Math.round(sp * Math.max(0.0001, cf) * 100) / 100;
                      })(),
                      byLocation: item.byLocation || [],
                      locationId: item.byLocation?.[0]?.supplierLocationId,
                  }))
                : [];
            const hist = Array.isArray(res?.transactionHistory) ? res.transactionHistory : [];
            setStockTotal(Number(res?.total ?? items.length) || 0);
            setStockLoadIncomplete(res?.complete === false);
            const warehouseQtyByProductId = Object.fromEntries(
                items.map((i) => [String(i.id), i.warehouseQty]),
            );
            const uomByProductId = Object.fromEntries(
                items.map((i) => [
                    String(i.id),
                    {
                        warehouseUnit: i.warehouseUnit,
                        workshopUnit: i.unit,
                        conversionFactor: i.conversionFactor,
                    },
                ]),
            );
            setStock(items);
            setMovementHistory(hist);
            setWarehouseQtyByProductId(warehouseQtyByProductId);
            setProductUomByProductId(uomByProductId);
        } catch (err) {
            console.error('Supplier stock API failed:', err);
            if (!silent) {
                setStock([]);
                setMovementHistory([]);
                setWarehouseQtyByProductId({});
                setProductUomByProductId({});
                setApiError(err?.message || t('err.loadStock'));
            }
        } finally {
            if (!silent) {
                setLoading(false);
            }
        }
    }, [t]);

    useEffect(() => {
        loadStock();
    }, [loadStock]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setGlTbError('');
            try {
                const res = await getSupplierTrialBalance({ dateFrom: '', dateTo: '' });
                const accounts = Array.isArray(res?.accounts)
                    ? res.accounts
                    : Array.isArray(res?.data?.accounts)
                      ? res.data.accounts
                      : [];
                if (!cancelled) setGlTbAccounts(accounts);
            } catch (err) {
                if (!cancelled) {
                    setGlTbAccounts([]);
                    setGlTbError(err?.message || 'tb');
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (activeTab !== 'movements' || !movementProductId) {
            setProductMovementEntries(null);
            return undefined;
        }
        let cancelled = false;
        const pid = String(movementProductId);
        getSupplierProductInventoryTimeline(pid, { historyLimit: 2000 })
            .then((res) => {
                if (cancelled) return;
                const hist = Array.isArray(res?.transactionHistory)
                    ? res.transactionHistory
                    : [];
                const currentQty =
                    res?.currentBalanceWarehouse ??
                    warehouseQtyByProductId[pid] ??
                    0;
                const uom = productUomByProductId[pid] || {};
                setProductMovementEntries(
                    mapSupplierHistoryToTimelineEntries(hist, currentQty, uom),
                );
            })
            .catch(() => {
                if (!cancelled) setProductMovementEntries(null);
            });
        return () => {
            cancelled = true;
        };
    }, [activeTab, movementProductId, warehouseQtyByProductId, productUomByProductId]);

    const loadItems = useCallback(async () => {
        setItemsLoading(true);
        setItemsError('');
        try {
            const products = await fetchAllSupplierProducts({ status: 'all' });
            setInventoryItems(Array.isArray(products) ? products : []);
        } catch (e) {
            setInventoryItems([]);
            setItemsError(e?.message || t('err.loadItems'));
        } finally {
            setItemsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab !== 'items') return;
        if (inventoryItems.length > 0) return;
        loadItems();
    }, [activeTab, inventoryItems.length, loadItems]);

    const refreshTimelineForProduct = async (productId, currentQtyHint) => {
        if (!productId) return;
        setTimelineLoading(true);
        setTimelineError('');
        try {
            const res = await getSupplierProductInventoryTimeline(productId, {
                historyLimit: 2000,
            });
            const hist = Array.isArray(res?.transactionHistory) ? res.transactionHistory : [];
            const currentQty =
                res?.currentBalanceWarehouse ??
                currentQtyHint ??
                stock.find((p) => String(p.id) === String(productId))?.warehouseQty ??
                0;
            const uom = productUomByProductId[String(productId)] || {};
            setTimelineEntries(mapSupplierHistoryToTimelineEntries(hist, currentQty, uom));
        } catch (e) {
            setTimelineError(e?.message || t('err.loadTimeline'));
            setTimelineEntries([]);
        } finally {
            setTimelineLoading(false);
        }
    };

    const openTimeline = async (row) => {
        setTimelineProduct(row);
        setTimelineEntries([]);
        await refreshTimelineForProduct(row?.id, row?.warehouseQty ?? row?.qty);
    };

    const closeTimeline = () => {
        setTimelineProduct(null);
        setTimelineEntries([]);
        setTimelineError('');
    };

    const navigateToPurchaseWithProduct = (s) => {
        try {
            sessionStorage.setItem(PI_PRESET_FROM_STOCK_FLAG, '1');
            sessionStorage.setItem(
                PI_PRESET_STOCK_LINE,
                JSON.stringify({
                    supplierProductId: String(s.id),
                    masterProductId:
                        s.masterProductId != null && String(s.masterProductId).trim() !== ''
                            ? String(s.masterProductId).trim()
                            : String(s.id),
                    name: s.name || '',
                    sku: !s.sku || s.sku === '-' ? '' : String(s.sku),
                    unit: s.warehouseUnit || s.unit || 'Box',
                    warehouseUnit: s.warehouseUnit || 'Box',
                    workshopUnit: s.unit || 'pcs',
                    conversionFactor: s.conversionFactor || 1,
                    price: Number(s.price) || 0,
                }),
            );
        } catch {
            sessionStorage.removeItem(PI_PRESET_FROM_STOCK_FLAG);
            sessionStorage.removeItem(PI_PRESET_STOCK_LINE);
        }
        navigate('/supplier/purchase_invoices');
    };

    const openAdjust = (s) => {
        setAdjustItem(s);
        setAdjustmentType('remove');
        setAdjustQty('');
        setAdjustUnitCost(
            Number(s?.averageCostWarehouse) > 0
                ? String(Number(s.averageCostWarehouse).toFixed(2))
                : '',
        );
        setAdjustNotes('');
        setAdjustCostError('');
        setAdjustConfirming(false);
        setAdjustError('');
        setAdjustModalOpen(true);
    };

    const removeFromStock = async (row) => {
        if (!row?.id) return;
        const ok = window.confirm(
            `Remove "${row.name}" from your stock list?\n\nThis will deactivate the item in your inventory. You can re-add it later from Product Catalog.`,
        );
        if (!ok) return;
        setRemovingId(String(row.id));
        try {
            await updateSupplierProduct(String(row.id), { isActive: false });
            // Optimistic UI: drop from current list, then refresh.
            setStock((prev) => prev.filter((p) => String(p.id) !== String(row.id)));
            await loadStock({ silent: true });
        } catch (e) {
            window.alert(e?.message || t('err.remove'));
        } finally {
            setRemovingId(null);
        }
    };

    const handleConfirmAdjustment = async () => {
        if (!adjustItem || adjustConfirming) return;
        const qtyInput = Number.parseFloat(String(adjustQty).replace(/,/g, ''));
        if (!Number.isFinite(qtyInput)) return;
        if (adjustmentType !== 'set' && qtyInput <= 0) return;
        const cf = Number(adjustItem.conversionFactor) || 1;
        const currentWh = Number(adjustItem.warehouseQty) || 0;
        const newWarehouseQty =
            adjustmentType === 'set'
                ? qtyInput
                : adjustmentType === 'add'
                  ? currentWh + qtyInput
                  : currentWh - qtyInput;
        setAdjustError('');
        // SP-17 (F-16): never send a negative count — the API refuses it and rolls back.
        if (newWarehouseQty < 0) {
            setAdjustError(
                t('adjust.belowZero', {
                    qty: qtyInput,
                    have: currentWh,
                    unit: adjustItem.warehouseUnit || 'Box',
                }),
            );
            return;
        }
        const newWorkshopQty = Math.round(newWarehouseQty * cf * 1000) / 1000;
        const savedId = adjustItem.id;
        const cost = validatedUnitCostString(adjustUnitCost);
        if (!cost.ok) {
            setAdjustCostError(t('adjust.unitCostInvalid'));
            return;
        }
        setAdjustCostError('');
        setAdjustConfirming(true);
        try {
            const autoNote =
                adjustmentType === 'set' && newWarehouseQty === 0 && !adjustNotes.trim()
                    ? t('adjust.zeroNote')
                    : adjustmentType === 'set' && !adjustNotes.trim()
                      ? t('adjust.setNote', { qty: newWarehouseQty, unit: adjustItem.warehouseUnit || 'Box' })
                      : '';
            await setSupplierStock({
                supplierProductId: String(adjustItem.id),
                supplierLocationId: String(
                    adjustItem.locationId || adjustItem.byLocation?.[0]?.supplierLocationId || '',
                ),
                currentQuantity: newWarehouseQty,
                ...(cost.blank ? {} : { unitCost: cost.value }),
                ...(adjustNotes.trim() || autoNote ? { notes: adjustNotes.trim() || autoNote } : {}),
            });
            setStock((prev) =>
                prev.map((s) =>
                    s.id === adjustItem.id
                        ? { ...s, warehouseQty: newWarehouseQty, qty: newWorkshopQty }
                        : s,
                ),
            );
            setAdjustModalOpen(false);
            setAdjustItem(null);
            setAdjustQty('');
            setAdjustUnitCost('');
            setAdjustNotes('');
            await loadStock({ silent: true });
            if (timelineProduct && String(timelineProduct.id) === String(savedId)) {
                await refreshTimelineForProduct(
                    savedId,
                    timelineProduct?.warehouseQty ?? timelineProduct?.qty,
                );
            }
        } catch (err) {
            console.error('Set supplier stock failed:', err);
            setAdjustError(err?.message || t('adjust.failed'));
        } finally {
            setAdjustConfirming(false);
        }
    };

    if (timelineProduct) {
        const stockRow = stock.find((p) => String(p.id) === String(timelineProduct.id));
        return (
            <SupplierStockProductTimelineScreen
                product={timelineProduct}
                stockRow={stockRow}
                entries={timelineEntries}
                loading={timelineLoading}
                error={timelineError}
                locationSummary={locationSummary}
                onBack={closeTimeline}
                locale={locale}
            />
        );
    }

    return (
        <div className="sp-stock-page">
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">{t('page.title')}</h2>
                    <p className="ws-page-sub">{t('page.sub')}</p>
                </div>
            </div>

            {stockLoadIncomplete ? (
                <div role="alert" style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E', fontSize: 13, fontWeight: 600 }}>
                    {t('stock.incomplete', { loaded: stock.length, total: stockTotal })}
                </div>
            ) : null}
            {apiError ? (
                <div className="theme-alert">
                    <strong>{t('err.couldNotLoad')}</strong> {apiError}
                </div>
            ) : null}

            {loading ? (
                <ShimmerKpiGrid cards={4} />
            ) : (
                <div className="ws-kpi-grid">
                    {[
                        { key: 'skus', label: t('kpi.skus'), value: totalSKUs, Icon: Package },
                        { key: 'critical', label: t('kpi.critical'), value: criticalCount, Icon: AlertTriangle },
                        { key: 'reorder', label: t('kpi.reorder'), value: reorderNeededCount, Icon: TrendingUp },
                        {
                            key: 'value',
                            label: t('kpi.value'),
                            value: <SupplierRiyalAmount amount={inventoryValue} size={18} />,
                            Icon: FileSpreadsheet,
                        },
                    ].map((card) => {
                        // MZ-10: a capitalised const (not a param) so no-unused-vars sees the JSX use.
                        const KpiIcon = card.Icon;
                        return (
                            <div key={card.key} className="ws-kpi-card">
                                <div>
                                    <p className="ws-kpi-label">{card.label}</p>
                                    <p className="ws-kpi-value">{card.value}</p>
                                </div>
                                <div className="ws-kpi-icon ws-kpi-icon--dark">
                                    <KpiIcon size={22} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <div
                className={`sp-gl-tieout${glTie.ok ? ' is-ok' : ' is-break'}`}
                data-gl-tieout={glTie.ok ? 'ok' : 'break'}
            >
                <p className="sp-gl-tieout__title">
                    {t('gl.title', { code: INVENTORY_GL_CODE })}
                    {' — '}
                    {glTbError
                        ? t('gl.err', { code: INVENTORY_GL_CODE, error: glTbError })
                        : glTie.unaveraged
                          ? t('gl.unaveraged')
                          : glTie.missingGl
                          ? t('gl.missing', { code: INVENTORY_GL_CODE })
                          : glTie.ok
                            ? t('gl.ok')
                            : t('gl.break')}
                </p>
                <span className="sp-gl-tieout__metric">
                    {t('gl.stock')}: <SupplierRiyalAmount amount={glTie.stockValue} size={14} />
                </span>
                <span className="sp-gl-tieout__metric">
                    {t('gl.account', { code: INVENTORY_GL_CODE })}:{' '}
                    {glTie.glBalance == null ? (
                        t('emdash')
                    ) : (
                        <SupplierRiyalAmount amount={glTie.glBalance} size={14} />
                    )}
                </span>
                <span className="sp-gl-tieout__metric">
                    {t('gl.delta')}:{' '}
                    {glTie.delta == null ? (
                        t('emdash')
                    ) : (
                        <SupplierRiyalAmount amount={glTie.delta} size={14} />
                    )}
                </span>
            </div>

            <div className="theme-segmented" style={{ marginBottom: 16 }}>
                <button
                    type="button"
                    onClick={() => setActiveTab('inventory')}
                    className={`theme-segmented__btn${activeTab === 'inventory' ? ' theme-segmented__btn--active' : ''}`}
                >
                    {t('tab.inventory')}
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('items')}
                    className={`theme-segmented__btn${activeTab === 'items' ? ' theme-segmented__btn--active' : ''}`}
                >
                    {t('tab.items')}
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('movements')}
                    className={`theme-segmented__btn${activeTab === 'movements' ? ' theme-segmented__btn--active' : ''}`}
                >
                    {t('tab.movements')}
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('valuation')}
                    className={`theme-segmented__btn${activeTab === 'valuation' ? ' theme-segmented__btn--active' : ''}`}
                >
                    {t('tab.valuation')}
                </button>
                    </div>

            {activeTab === 'valuation' && (
                <SupplierInventoryValuationPanel
                    key={valuationProductId || 'all'}
                    locale={locale}
                    t={t}
                    navigate={navigate}
                    initialProductId={valuationProductId}
                />
            )}

            {activeTab === 'items' && (
                <div className="ws-section" style={{ padding: 16 }}>
                    <div
                        style={{
                                display: 'flex',
                            flexWrap: 'wrap',
                                alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 10,
                            marginBottom: 12,
                            }}
                        >
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1rem' }}>{t('items.title')}</h3>
                        <p
                            style={{
                                    margin: '4px 0 0',
                                    fontSize: '0.8125rem',
                                    color: 'var(--color-text-muted)',
                                }}
                            >
                                {t('items.sub')}
                        </p>
                    </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <button
                                type="button"
                                onClick={() => setCriticalOnly((v) => !v)}
                                className="btn-portal-outline"
                        style={{
                                    borderColor: criticalOnly ? '#DC2626' : undefined,
                                    color: criticalOnly ? '#DC2626' : undefined,
                                    fontWeight: 700,
                                }}
                            >
                                {criticalOnly ? t('btn.criticalOn') : t('btn.critical')}
                            </button>
                            <button
                                type="button"
                                className="btn-portal-outline"
                                onClick={loadItems}
                                disabled={itemsLoading}
                            >
                                {itemsLoading ? t('btn.refreshing') : t('btn.refresh')}
                            </button>
                    </div>
                    </div>

                    {itemsError ? (
                        <div className="mgr-si-error" style={{ marginBottom: 12 }}>
                            {itemsError}
                </div>
                    ) : null}

                    <div style={{ position: 'relative', width: '100%', marginBottom: 12 }}>
                        <Search
                            size={16}
                style={{
                                position: 'absolute',
                                left: 14,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: '#9CA3AF',
                                pointerEvents: 'none',
                            }}
                            aria-hidden
                        />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={t('search.items')}
                    style={{
                                width: '100%',
                                padding: '11px 14px 11px 42px',
                                borderRadius: 10,
                                border: '1px solid var(--color-border)',
                        fontSize: '0.875rem',
                            }}
                        />
            </div>

                    {itemsLoading && inventoryItems.length === 0 ? (
                        <ShimmerTable rows={8} columns={6} />
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="ws-table">
                                <thead>
                                    <tr>
                                        <SortableTh label={t('th.product')} columnKey="product" sortKey={itemsSort.sortKey} sortDir={itemsSort.sortDir} onSort={itemsSort.toggleSort} />
                                        <SortableTh label={t('th.sku')} columnKey="sku" sortKey={itemsSort.sortKey} sortDir={itemsSort.sortDir} onSort={itemsSort.toggleSort} />
                                        <SortableTh label={t('th.qtyWh')} columnKey="qtyWh" align="right" sortKey={itemsSort.sortKey} sortDir={itemsSort.sortDir} onSort={itemsSort.toggleSort} />
                                        <SortableTh label={t('th.qtyWs')} columnKey="qtyWs" align="right" sortKey={itemsSort.sortKey} sortDir={itemsSort.sortDir} onSort={itemsSort.toggleSort} />
                                        <SortableTh label={t('th.critical')} columnKey="critical" align="right" sortKey={itemsSort.sortKey} sortDir={itemsSort.sortDir} onSort={itemsSort.toggleSort} />
                                        <th>{t('th.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {itemsPageSlice.rows.map((p) => {
                                            const pid = String(p?.id);
                                            const uom = productUomByProductId[pid] || {};
                                            const cf =
                                                Number(
                                                    uom.conversionFactor ||
                                                        p?.conversionFactor ||
                                                        1,
                                                ) || 1;
                                            const wh = Number(warehouseQtyByProductId[pid] ?? 0);
                                            const ws = wh * cf;
                                            return (
                                                <tr key={pid}>
                                                    <td style={{ fontWeight: 600 }}>
                                                        {p?.name || p?.productName || '—'}
                                                    </td>
                                                    <td>{p?.sku || '—'}</td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        {fmtQty(wh)}
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        {fmtQty(ws)}
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        {p?.criticalStockAlert != null
                                                            ? fmtQty(Number(p.criticalStockAlert))
                                                            : '—'}
                                                    </td>
                                                    <td style={{ whiteSpace: 'nowrap' }}>
                                                        <RowActionsMenu
                                                            ariaLabel={t('action.aria', { name: p?.name || p?.productName || t('fallback.item') })}
                                                            items={[
                                                                {
                                                                    label: t('action.editCritical'),
                                                                    onClick: () =>
                                                                        setCriticalLevelEditProduct({
                                                                            id: p.id,
                                                                            name:
                                                                                p?.name ||
                                                                                p?.productName ||
                                                                                t('fallback.product'),
                                                                            sku: p?.sku || '',
                                                                            warehouseUnit:
                                                                                uom.warehouseUnit ||
                                                                                p?.warehouseUnit ||
                                                                                'Box',
                                                                            unit:
                                                                                uom.workshopUnit ||
                                                                                p?.workshopUnit ||
                                                                                'pcs',
                                                                            conversionFactor: cf,
                                                                            criticalLevel:
                                                                                p?.criticalStockAlert != null
                                                                                    ? Number(p.criticalStockAlert)
                                                                                    : null,
                                                                            criticalStockAlert:
                                                                                p?.criticalStockAlert != null
                                                                                    ? Number(p.criticalStockAlert)
                                                                                    : null,
                                                                        }),
                                                                },
                                                            ]}
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                            <StockTablePager
                                t={t}
                                page={itemsPageSlice.page}
                                pageSize={pageSize}
                                total={itemsPageSlice.total}
                                onPageChange={setItemsPage}
                                onPageSizeChange={changePageSize}
                            />
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'inventory' && (
                <>
                    <div style={{ marginBottom: 12 }}>
                        <div style={{ position: 'relative', width: '100%' }}>
                            <Search
                                size={16}
                                style={{
                                    position: 'absolute',
                                    left: 14,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: '#9CA3AF',
                                    pointerEvents: 'none',
                                }}
                                aria-hidden
                            />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder={t('search.products')}
                                style={{
                                    width: '100%',
                                    padding: '11px 14px 11px 42px',
                                    borderRadius: 10,
                                    border: '1px solid var(--color-border)',
                                    fontSize: '0.875rem',
                                }}
                            />
                        </div>
                        <p
                            style={{
                                margin: '8px 0 0',
                                fontSize: '0.8125rem',
                                color: 'var(--color-text-muted)',
                            }}
                        >
                            {t('hint.rowTimeline')}
                        </p>
                        {!loading ? (
                            <div
                                style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    alignItems: 'center',
                                    gap: 10,
                                    marginTop: 10,
                                }}
                            >
                                <button
                                    type="button"
                                    onClick={() => setCriticalOnly((v) => !v)}
                                    className="btn-portal-outline"
                                    style={{
                                        borderColor: criticalOnly ? '#DC2626' : undefined,
                                        color: criticalOnly ? '#DC2626' : undefined,
                                        fontWeight: 700,
                                    }}
                                    title={
                                        criticalOnly
                                            ? t('title.criticalOn')
                                            : t('title.criticalOff')
                                    }
                                >
                                    {criticalOnly ? t('btn.criticalOn') : t('btn.critical')}
                                </button>
                                <span
                                    style={{
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        color: 'var(--color-text-muted)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.04em',
                                    }}
                                >
                                    {t('export.label')}
                                </span>
                                <button
                                    type="button"
                                    disabled={filteredList.length === 0}
                                    title={
                                        filteredList.length === 0
                                            ? t('export.nothingFilters')
                                            : t('export.xlsx')
                                    }
                                    onClick={() => {
                                        exportStockInventoryExcel(sortedStockList, 'supplier-stock-inventory');
                                    }}
                                    style={{
                                        ...exportToolbarBtnStyle,
                                        opacity: filteredList.length === 0 ? 0.5 : 1,
                                        cursor:
                                            filteredList.length === 0 ? 'not-allowed' : 'pointer',
                                    }}
                                >
                                    <FileSpreadsheet size={14} aria-hidden /> {t('btn.excel')}
                                </button>
                                <button
                                    type="button"
                                    disabled={filteredList.length === 0}
                                    title={
                                        filteredList.length === 0
                                            ? t('export.nothing')
                                            : t('export.pdf')
                                    }
                                    onClick={() => {
                                        exportStockInventoryPdf(sortedStockList, 'supplier-stock-inventory');
                                    }}
                                    style={{
                                        ...exportToolbarBtnStyle,
                                        opacity: filteredList.length === 0 ? 0.5 : 1,
                                        cursor:
                                            filteredList.length === 0 ? 'not-allowed' : 'pointer',
                                    }}
                                >
                                    <FileText size={14} aria-hidden /> {t('btn.pdf')}
                                </button>
                                {search.trim() ? (
                                    <span
                                        style={{
                                            fontSize: '0.75rem',
                                            color: 'var(--color-text-muted)',
                                        }}
                                    >
                                        {filteredList.length === 1
                                            ? t('matchSearch', { n: filteredList.length })
                                            : t('matchSearchPlural', { n: filteredList.length })}
                                    </span>
                                ) : null}
                            </div>
                        ) : null}
                    </div>

                    {loading ? (
                        <div className="ws-section">
                            <ShimmerTable rows={10} columns={11} />
                        </div>
                    ) : (
                        <div className="ws-section">
                            <div style={{ overflowX: 'auto' }}>
                                <table className="ws-table">
                                    <thead>
                                        <tr>
                                            <SortableTh label={t('th.product')} columnKey="product" sortKey={stockSort.sortKey} sortDir={stockSort.sortDir} onSort={stockSort.toggleSort} />
                                            <SortableTh label={t('th.sku')} columnKey="sku" sortKey={stockSort.sortKey} sortDir={stockSort.sortDir} onSort={stockSort.toggleSort} />
                                            <SortableTh label={t('th.unit')} columnKey="unit" sortKey={stockSort.sortKey} sortDir={stockSort.sortDir} onSort={stockSort.toggleSort} />
                                            <SortableTh label={t('th.stockQty')} columnKey="stockQty" sortKey={stockSort.sortKey} sortDir={stockSort.sortDir} onSort={stockSort.toggleSort} />
                                            <SortableTh label={t('th.awaiting')} columnKey="awaiting" sortKey={stockSort.sortKey} sortDir={stockSort.sortDir} onSort={stockSort.toggleSort} />
                                            <SortableTh label={t('th.criticalLevel')} columnKey="critical" sortKey={stockSort.sortKey} sortDir={stockSort.sortDir} onSort={stockSort.toggleSort} />
                                            <SortableTh label={t('th.reorderLevel')} columnKey="reorder" sortKey={stockSort.sortKey} sortDir={stockSort.sortDir} onSort={stockSort.toggleSort} />
                                            <SortableTh label={t('th.purchasePrice')} columnKey="price" sortKey={stockSort.sortKey} sortDir={stockSort.sortDir} onSort={stockSort.toggleSort} />
                                            <SortableTh label={t('th.salesPrice')} columnKey="salePrice" sortKey={stockSort.sortKey} sortDir={stockSort.sortDir} onSort={stockSort.toggleSort} />
                                            <SortableTh label={t('th.value')} columnKey="value" sortKey={stockSort.sortKey} sortDir={stockSort.sortDir} onSort={stockSort.toggleSort} />
                                            <SortableTh label={t('th.status')} columnKey="status" sortKey={stockSort.sortKey} sortDir={stockSort.sortDir} onSort={stockSort.toggleSort} />
                                            <th>{t('th.actions')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {inventoryPageSlice.rows.map((s) => {
                                            const value = warehouseStockLineValueSar(s);
                                            const isCritical = s.qty <= (s.criticalLevel ?? 0);
                                            return (
                                                <tr
                                                    key={s.id}
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={() => openTimeline(s)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault();
                                                            openTimeline(s);
                                                        }
                                                    }}
                                                    style={{
                                                        cursor: 'pointer',
                                                    }}
                                                    className="ws-inv-row-clickable"
                                                >
                                                    <td>
                                                        <div
                                                            style={{
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                gap: 4,
                                                                alignItems: 'flex-start',
                                                            }}
                                                        >
                                                            <span style={{ fontWeight: 700 }}>{s.name}</span>
                                                            <span
                                                                style={{
                                                                    fontSize: '0.7rem',
                                                                    color: 'var(--color-text-muted)',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: 4,
                                                                }}
                                                            >
                                                                <History size={12} aria-hidden />
                                                                {t('row.timeline')}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                                        {s.sku || '-'}
                                                    </td>
                                                    <td>
                                                        <span style={{ fontWeight: 600 }}>
                                                            {s.warehouseUnit || 'Box'}
                                                        </span>
                                                        {s.unit &&
                                                        String(s.warehouseUnit || '')
                                                            .toLowerCase() !==
                                                            String(s.unit).toLowerCase() ? (
                                                            <span
                                                                style={{
                                                                    display: 'block',
                                                                    fontSize: '0.7rem',
                                                                    color: 'var(--color-text-muted)',
                                                                }}
                                                            >
                                                                → {s.unit} (×
                                                                {s.conversionFactor || 1})
                                                            </span>
                                                        ) : null}
                                                    </td>
                                                    <td>
                                                        <strong>
                                                            {formatDualUomQty(
                                                                s.warehouseQty,
                                                                s.warehouseUnit,
                                                                s.qty,
                                                                s.unit,
                                                            )}
                                                        </strong>
                                                    </td>
                                                    <td>
                                                        {(s.pendingWorkshopReceive || 0) > 0 ? (
                                                        <span
                                                                style={{
                                                                    display: 'inline-flex',
                                                                    flexDirection: 'column',
                                                                    gap: 2,
                                                                    fontSize: '0.8125rem',
                                                                    color: '#B45309',
                                                                    fontWeight: 600,
                                                                }}
                                                                title={t('row.awaitingTitle')}
                                                            >
                                                                {fmtQty(s.pendingWorkshopReceive)}{' '}
                                                                {s.unit}
                                                                <span
                                                                    style={{
                                                                        fontSize: '0.7rem',
                                                                        fontWeight: 500,
                                                                        color: 'var(--color-text-muted)',
                                                                    }}
                                                                >
                                                                    {t('row.notReceived')}
                                                        </span>
                                                            </span>
                                                        ) : (
                                                            '—'
                                                        )}
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                            <span>
                                                                {s.criticalLevel != null
                                                                    ? fmtQty(s.criticalLevel)
                                                                    : '-'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td>{s.reorder != null ? fmtQty(s.reorder) : '-'}</td>
                                                    <td>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                            <span>
                                                                {t('money.sarPer', { amount: Number(s.price).toLocaleString(), unit: s.warehouseUnit || t('fallback.unit') })}
                                                            </span>
                                                            {s.usesCatalogPrice ? (
                                                                <span
                                                            style={{
                                                                        fontSize: '0.68rem',
                                                                        color: '#64748b',
                                                                fontWeight: 600,
                                                                    }}
                                                                >
                                                                    {t('row.fromCatalog')}
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div
                                                            style={{
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                gap: 4,
                                                            }}
                                                        >
                                                            <span>
                                                                {s.salePrice != null &&
                                                                Number(s.salePrice) > 0
                                                                    ? t('money.sarPer', { amount: Number(s.salePrice).toLocaleString(), unit: s.unit || t('fallback.unit') })
                                                                    : '—'}
                                                            </span>
                                                            {s.salePrice != null &&
                                                            Number(s.salePrice) > 0 &&
                                                            s.salePriceWarehouse != null &&
                                                            Number(s.salePriceWarehouse) > 0 &&
                                                            String(s.warehouseUnit || '')
                                                                .trim()
                                                                .toLowerCase() !==
                                                                String(s.unit || '')
                                                                    .trim()
                                                                    .toLowerCase() ? (
                                                                <span
                                                            style={{
                                                                        fontSize: '0.68rem',
                                                                        color: '#64748b',
                                                                fontWeight: 600,
                                                                    }}
                                                                >
                                                                    {t('money.sarPer', { amount: Number(s.salePriceWarehouse).toLocaleString(), unit: s.warehouseUnit || t('fallback.unit') })}
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        {/* MZ-08: value at cost; opens this SKU in the Valuation tab. */}
                                                        <button
                                                            type="button"
                                                            className="sp-stock-value-link"
                                                            title={t('row.openValuation')}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setValuationProductId(String(s.id));
                                                                setActiveTab('valuation');
                                                            }}
                                                        >
                                                            <SupplierRiyalAmount amount={Number(value) || 0} size={12} />
                                                        </button>
                                                        {s.costMissing ? (
                                                            <span className="sp-stock-cost-missing">{t('row.costMissing')}</span>
                                                        ) : null}
                                                    </td>
                                                    <td>
                                                        <span
                                                            className={`ws-badge ${isCritical ? 'ws-badge--red' : 'ws-badge--green'}`}
                                                        >
                                                            {isCritical ? t('status.critical') : t('status.ok')}
                                                        </span>
                                                    </td>
                                                    <td style={{ whiteSpace: 'nowrap' }}>
                                                        <RowActionsMenu
                                                            ariaLabel={t('action.aria', { name: s.name || t('fallback.product') })}
                                                            items={[
                                                                {
                                                                    label: t('action.editPurchase'),
                                                                    onClick: () => setPurchasePriceEditProduct(s),
                                                                },
                                                                {
                                                                    label: t('action.editSales'),
                                                                    onClick: () => setSalesPriceEditProduct(s),
                                                                },
                                                                {
                                                                    label: t('action.editCritical'),
                                                                    onClick: () => setCriticalLevelEditProduct(s),
                                                                },
                                                                {
                                                                    label: t('action.adjust'),
                                                                    onClick: () => openAdjust(s),
                                                                },
                                                                {
                                                                    label: t('action.adjustPurchase'),
                                                                    onClick: () => navigateToPurchaseWithProduct(s),
                                                                },
                                                                {
                                                                    label: t('action.accounting'),
                                                                    onClick: () =>
                                                                        setAccountingHistoryProduct({
                                                                            id: s.id,
                                                                            name: s.name,
                                                                        }),
                                                                },
                                                                {
                                                                    label: t('action.remove'),
                                                                    onClick: () => removeFromStock(s),
                                                                    disabled: String(removingId) === String(s.id),
                                                                    danger: true,
                                                                },
                                                            ]}
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            {accountingHistoryProduct ? (
                                <SupplierProductHistoryDrawer
                                    supplierProductId={accountingHistoryProduct.id}
                                    productName={accountingHistoryProduct.name}
                                    onClose={() => setAccountingHistoryProduct(null)}
                                />
                            ) : null}
                            <StockTablePager
                                t={t}
                                page={inventoryPageSlice.page}
                                pageSize={pageSize}
                                total={inventoryPageSlice.total}
                                onPageChange={setInventoryPage}
                                onPageSizeChange={changePageSize}
                            />
                            {filteredList.length === 0 && (
                                <div style={{ textAlign: 'center', padding: 40 }}>
                                    <Package
                                        size={40}
                                        style={{ opacity: 0.3, margin: '0 auto 12px', display: 'block' }}
                                    />
                                    <p
                                        style={{
                                            margin: 0,
                                            fontSize: '0.875rem',
                                            color: 'var(--color-text-muted)',
                                        }}
                                    >
                                        {search
                                            ? t('empty.noMatch')
                                            : t('empty.noStock')}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {activeTab === 'movements' &&
                (loading ? (
                    <div className="ws-section">
                        <ShimmerTable rows={10} columns={8} />
                    </div>
                ) : (
                    <div className="ws-section">
                        <SupplierReportsDateBar
                            locale={locale}
                            dateFrom={movementDateFrom}
                            dateTo={movementDateTo}
                            onApply={(from, to) => {
                                setMovementDateFrom(from);
                                setMovementDateTo(to);
                            }}
                        />
                        <div
                            style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                alignItems: 'flex-end',
                                gap: 12,
                                marginBottom: 16,
                            }}
                        >
                            <div style={{ flex: '1 1 280px', maxWidth: 420, position: 'relative' }}>
                                <label
                                    htmlFor="movement-product-search"
                                style={{
                                        display: 'block',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    color: 'var(--color-text-muted)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em',
                                        marginBottom: 6,
                                    }}
                                >
                                    {t('movements.searchProduct')}
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <Search
                                        size={16}
                                        style={{
                                            position: 'absolute',
                                            left: 14,
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            color: '#9CA3AF',
                                            pointerEvents: 'none',
                                        }}
                                        aria-hidden
                                    />
                                    <input
                                        id="movement-product-search"
                                        ref={movementSearchRef}
                                        type="text"
                                        value={movementProductSearch}
                                        onChange={(e) => {
                                            setMovementProductSearch(e.target.value);
                                            setMovementProductId(null);
                                            setMovementPickerOpen(true);
                                            setMovementPickerIdx(0);
                                        }}
                                        onFocus={() => setMovementPickerOpen(true)}
                                        onBlur={() => {
                                            window.setTimeout(() => setMovementPickerOpen(false), 150);
                                        }}
                                        onKeyDown={onMovementSearchKeyDown}
                                        placeholder={t('movements.searchPh')}
                                        autoComplete="off"
                                        role="combobox"
                                        aria-expanded={movementPickerOpen}
                                        aria-controls="movement-product-picker-list"
                                        aria-autocomplete="list"
                                style={{
                                            width: '100%',
                                            padding: '10px 36px 10px 40px',
                                            borderRadius: 10,
                                            border: '1px solid var(--color-border)',
                                            fontSize: '0.875rem',
                                        }}
                                    />
                                    {movementProductId ? (
                            <button
                                type="button"
                                            title={t('movements.clearFilter')}
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={clearMovementProductFilter}
                                style={{
                                                position: 'absolute',
                                                right: 8,
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                border: 'none',
                                                background: '#F3F4F6',
                                                borderRadius: 6,
                                                padding: '4px 8px',
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                color: '#64748B',
                                            }}
                                        >
                                            ✕
                            </button>
                                    ) : null}
                        </div>
                                {movementPickerOpen && movementProductOptions.length > 0 ? (
                                    <ul
                                        id="movement-product-picker-list"
                                        ref={movementPickerListRef}
                                        role="listbox"
                                                style={{
                                            position: 'absolute',
                                            zIndex: 20,
                                            top: '100%',
                                            left: 0,
                                            right: 0,
                                            margin: '4px 0 0',
                                            padding: 4,
                                            listStyle: 'none',
                                            background: '#fff',
                                            border: '1px solid var(--color-border)',
                                            borderRadius: 10,
                                            boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
                                            maxHeight: 240,
                                            overflowY: 'auto',
                                        }}
                                    >
                                        {movementProductOptions.map((p, idx) => (
                                            <li
                                                key={String(p.id)}
                                                role="option"
                                                aria-selected={idx === movementPickerIdx}
                                                data-movement-pick-idx={idx}
                                                onMouseDown={(e) => e.preventDefault()}
                                                onMouseEnter={() => setMovementPickerIdx(idx)}
                                                onClick={() => selectMovementProduct(p)}
                                                style={{
                                                    padding: '10px 12px',
                                                    borderRadius: 8,
                                                    cursor: 'pointer',
                                                    background:
                                                        idx === movementPickerIdx
                                                            ? '#EFF6FF'
                                                            : 'transparent',
                                                }}
                                            >
                                                <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>
                                                    {p.name}
                        </div>
                                                <div
                                    style={{
                                                        fontSize: '0.75rem',
                                                        color: 'var(--color-text-muted)',
                                                        marginTop: 2,
                                                    }}
                                                >
                                                    {t('movements.skuOnHand', { sku: p.sku || t('emdash'), qty: fmtQty(p.warehouseQty), unit: p.unit || 'pcs' })}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                ) : null}
                                {movementPickerOpen &&
                                movementProductSearch.trim() &&
                                movementProductOptions.length === 0 ? (
                                    <div
                                    style={{
                                            position: 'absolute',
                                            zIndex: 20,
                                            top: '100%',
                                            left: 0,
                                            right: 0,
                                            marginTop: 4,
                                            padding: '12px 14px',
                                            background: '#fff',
                                            border: '1px solid var(--color-border)',
                                            borderRadius: 10,
                                            fontSize: '0.8125rem',
                                        color: 'var(--color-text-muted)',
                                    }}
                                >
                                        {t('movements.noMatch')}
                            </div>
                                ) : null}
                    </div>
                            {selectedMovementProduct ? (
                            <div
                                style={{
                                        flex: '1 1 240px',
                                        padding: '12px 16px',
                                        background: '#F0FDF4',
                                        border: '1px solid #BBF7D0',
                                    borderRadius: 12,
                                }}
                            >
                                    <div
                                    style={{
                                        fontSize: '0.7rem',
                                        fontWeight: 700,
                                            color: '#166534',
                                        textTransform: 'uppercase',
                                            letterSpacing: '0.04em',
                                        }}
                                    >
                                        {selectedMovementProduct.name}
                                    </div>
                                    <div style={{ fontSize: '0.8125rem', color: '#15803D', marginTop: 4 }}>
                                        {t('movements.skuCount', { sku: selectedMovementProduct.sku || t('emdash'), n: displayedMovementEntries.length })}
                                    </div>
                                    <div
                                    style={{
                                            fontSize: '1.125rem',
                                        fontWeight: 800,
                                            color: '#14532D',
                                            marginTop: 6,
                                        }}
                                    >
                                        {t('movements.finalBalance')}{' '}
                                        {formatDualUomQty(
                                            movementFinalBalance,
                                            selectedMovementProduct.warehouseUnit,
                                            (movementFinalBalance || 0) *
                                                (selectedMovementProduct.conversionFactor || 1),
                                            selectedMovementProduct.unit,
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <p
                                    style={{
                                        flex: '1 1 200px',
                                        margin: 0,
                                        fontSize: '0.8125rem',
                                        color: 'var(--color-text-muted)',
                                        alignSelf: 'center',
                                    }}
                                >
                                    {t('movements.hint')}
                                </p>
                            )}
                        </div>
                                <div
                                    style={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                alignItems: 'center',
                                gap: 10,
                                marginBottom: 14,
                            }}
                        >
                            <span
                                style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    color: 'var(--color-text-muted)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em',
                                }}
                            >{t('export.label')}</span>
                                    <button
                                        type="button"
                                disabled={displayedMovementEntries.length === 0}
                                        title={
                                    displayedMovementEntries.length === 0
                                        ? t('export.noMovements')
                                                    : t('export.xlsx')
                                        }
                                        onClick={() => {
                                    exportMovementsExcel(
                                        sortedMovementEntries,
                                        movementProductId
                                            ? `stock-movements-${String(selectedMovementProduct?.name || movementProductId).replace(/\s+/g, '-')}`
                                            : 'supplier-stock-movements',
                                            );
                                        }}
                                        style={{
                                            ...exportToolbarBtnStyle,
                                    opacity: displayedMovementEntries.length === 0 ? 0.5 : 1,
                                            cursor:
                                        displayedMovementEntries.length === 0
                                                    ? 'not-allowed'
                                                    : 'pointer',
                                        }}
                                    >
                                        <FileSpreadsheet size={14} aria-hidden /> {t('btn.excel')}
                                    </button>
                                    <button
                                        type="button"
                                disabled={displayedMovementEntries.length === 0}
                                        title={
                                    displayedMovementEntries.length === 0
                                        ? t('export.noMovementsShort')
                                                    : t('export.pdf')
                                        }
                                        onClick={() => {
                                    exportMovementsPdf(
                                        sortedMovementEntries,
                                        movementProductId
                                            ? `stock-movements-${String(selectedMovementProduct?.name || movementProductId).replace(/\s+/g, '-')}`
                                            : 'supplier-stock-movements',
                                            );
                                        }}
                                        style={{
                                            ...exportToolbarBtnStyle,
                                    opacity: displayedMovementEntries.length === 0 ? 0.5 : 1,
                                            cursor:
                                        displayedMovementEntries.length === 0
                                                    ? 'not-allowed'
                                                    : 'pointer',
                                        }}
                                    >
                                        <FileText size={14} aria-hidden /> {t('btn.pdf')}
                                    </button>
                                </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="ws-table">
                                        <thead>
                                    <tr>
                                        <SortableTh label={t('th.when')} columnKey="when" sortKey={movementsSort.sortKey} sortDir={movementsSort.sortDir} onSort={movementsSort.toggleSort} />
                                        {!movementProductId ? (
                                            <SortableTh label={t('th.product')} columnKey="product" sortKey={movementsSort.sortKey} sortDir={movementsSort.sortDir} onSort={movementsSort.toggleSort} />
                                        ) : null}
                                        <SortableTh label={t('th.fromWh')} columnKey="fromWh" sortKey={movementsSort.sortKey} sortDir={movementsSort.sortDir} onSort={movementsSort.toggleSort} />
                                        <SortableTh label={t('th.toWh')} columnKey="toWh" sortKey={movementsSort.sortKey} sortDir={movementsSort.sortDir} onSort={movementsSort.toggleSort} />
                                        <SortableTh label={t('th.deltaWh')} columnKey="deltaWh" sortKey={movementsSort.sortKey} sortDir={movementsSort.sortDir} onSort={movementsSort.toggleSort} />
                                        <SortableTh label={t('th.wsEquiv')} columnKey="wsEquiv" sortKey={movementsSort.sortKey} sortDir={movementsSort.sortDir} onSort={movementsSort.toggleSort} />
                                        <SortableTh label={t('th.reason')} columnKey="reason" sortKey={movementsSort.sortKey} sortDir={movementsSort.sortDir} onSort={movementsSort.toggleSort} />
                                        <SortableTh label={t('th.sourceRef')} columnKey="sourceRef" sortKey={movementsSort.sortKey} sortDir={movementsSort.sortDir} onSort={movementsSort.toggleSort} />
                                        <SortableTh label={t('th.by')} columnKey="by" sortKey={movementsSort.sortKey} sortDir={movementsSort.sortDir} onSort={movementsSort.toggleSort} />
                                            </tr>
                                        </thead>
                                        <tbody>
                                    {movementsPageSlice.rows.map((e) => (
                                        <tr key={e.id}>
                                            <td style={{ whiteSpace: 'nowrap', fontSize: '0.8125rem' }}>
                                                        {new Date(e.at).toLocaleString()}
                                                    </td>
                                            {!movementProductId ? (
                                                <td>{e.productLabel}</td>
                                            ) : null}
                                            <td style={{ textAlign: 'right', fontWeight: 600, fontSize: '0.8125rem' }}>
                                                {fmtQty(e.previousQty)} {e.warehouseUnit || 'Box'}
                                                    </td>
                                            <td style={{ textAlign: 'right', fontWeight: 600, fontSize: '0.8125rem' }}>
                                                {fmtQty(e.newQty)} {e.warehouseUnit || 'Box'}
                                                    </td>
                                                    <td
                                                        style={{
                                                            textAlign: 'right',
                                                            fontWeight: 700,
                                                            color:
                                                        e.delta == null || !Number.isFinite(Number(e.delta))
                                                                    ? 'var(--color-text-muted)'
                                                                    : Number(e.delta) >= 0
                                                                      ? '#047857'
                                                                      : '#B91C1C',
                                                        }}
                                                    >
                                                {fmtDelta(e.delta)} {e.warehouseUnit || 'Box'}
                                                    </td>
                                                        <td
                                                            style={{
                                                    textAlign: 'right',
                                                    fontSize: '0.8125rem',
                                                                color: 'var(--color-text-muted)',
                                                }}
                                            >
                                                {e.deltaWorkshop != null
                                                    ? `${fmtDelta(e.deltaWorkshop)} ${e.workshopUnit || 'Liter'}`
                                                    : e.conversionFactor > 1
                                                      ? `${fmtQty((e.previousQtyWorkshop ?? e.previousQty * e.conversionFactor))} → ${fmtQty((e.newQtyWorkshop ?? e.newQty * e.conversionFactor))} ${e.workshopUnit || 'Liter'}`
                                                      : '—'}
                                            </td>
                                            <td>{e.reason}</td>
                                            <td
                                                style={{
                                                    fontSize: '0.8125rem',
                                                    color: 'var(--color-text-muted)',
                                                    maxWidth: 280,
                                                            }}
                                                        >
                                                            {formatSupplierTimelineSourceRef(e)}
                                                        </td>
                                            <td style={{ fontSize: '0.8125rem' }}>
                                                            {e.adjustedBy?.name || '—'}
                                                        </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                        <StockTablePager
                            t={t}
                            page={movementsPageSlice.page}
                            pageSize={pageSize}
                            total={movementsPageSlice.total}
                            onPageChange={setMovementsPage}
                            onPageSizeChange={changePageSize}
                        />
                        {displayedMovementEntries.length === 0 && (
                            <div style={{ textAlign: 'center', padding: 48 }}>
                                <TrendingUp
                                    size={48}
                                    style={{
                                        opacity: 0.3,
                                        margin: '0 auto 16px',
                                        display: 'block',
                                    }}
                                />
                                <p
                                    style={{
                                        margin: 0,
                                        fontWeight: 600,
                                        color: 'var(--color-text-muted)',
                                    }}
                                >
                                    {movementProductId
                                        ? t('empty.noMovementsProduct')
                                        : t('empty.noMovements')}
                                </p>
                        </div>
                )}
                    </div>
                ))}

            <AnimatePresence>
                {adjustModalOpen && adjustItem && (
                    <Modal
                        title={t('adjust.title', { name: adjustItem.name })}
                        disableClose={adjustConfirming}
                        onClose={() => {
                            setAdjustModalOpen(false);
                            setAdjustItem(null);
                            setAdjustConfirming(false);
                        }}
                        footer={
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    className="btn-portal-outline"
                                    disabled={adjustConfirming}
                                    onClick={() => {
                                        setAdjustModalOpen(false);
                                        setAdjustItem(null);
                                        setAdjustConfirming(false);
                                    }}
                                >
                                    {t('btn.cancel')}
                                </button>
                                <button
                                    type="button"
                                    className="btn-portal"
                                    style={{ background: 'var(--color-text-dark)', color: '#fff', border: 'none' }}
                                    disabled={
                                        adjustConfirming ||
                                        adjustQty === '' ||
                                        !Number.isFinite(
                                            Number.parseFloat(String(adjustQty).replace(/,/g, '')),
                                        ) ||
                                        Number.parseFloat(String(adjustQty).replace(/,/g, '')) <
                                            0 ||
                                        (adjustmentType !== 'set' &&
                                            Number.parseFloat(String(adjustQty).replace(/,/g, '')) <=
                                                0)
                                    }
                                    onClick={handleConfirmAdjustment}
                                >
                                    {adjustConfirming ? t('adjust.confirming') : t('adjust.confirm')}
                                </button>
                            </div>
                        }
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {adjustError ? (
                                <div role="alert" style={{ padding: '8px 12px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', fontSize: 13, fontWeight: 600 }}>
                                    {adjustError}
                                </div>
                            ) : null}
                            <div>
                                <label
                                    style={{
                                        display: 'block',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        color: 'var(--color-text-muted)',
                                        marginBottom: 4,
                                    }}
                                >
                                    {t('adjust.current')}
                                </label>
                                <p
                                    style={{
                                        fontSize: '1.25rem',
                                        fontWeight: 700,
                                        color: 'var(--color-text-dark)',
                                        margin: 0,
                                    }}
                                >
                                    {formatDualUomQty(
                                        adjustItem.warehouseQty,
                                        adjustItem.warehouseUnit || 'Box',
                                        adjustItem.qty,
                                        adjustItem.unit,
                                    )}
                                </p>
                                {adjustItem.unit &&
                                adjustItem.warehouseUnit &&
                                String(adjustItem.warehouseUnit).toLowerCase() !==
                                    String(adjustItem.unit).toLowerCase() ? (
                                    <p
                                        style={{
                                            margin: '6px 0 0',
                                            fontSize: '0.75rem',
                                            color: 'var(--color-text-muted)',
                                        }}
                                    >
                                        {t('adjust.conv', {
                                            wh: adjustItem.warehouseUnit,
                                            cf: adjustItem.conversionFactor || 1,
                                            ws: adjustItem.unit,
                                        })}
                                    </p>
                                ) : null}
                            </div>
                            <div>
                                <label
                                    style={{
                                        display: 'block',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        color: 'var(--color-text-muted)',
                                        marginBottom: 8,
                                    }}
                                >
                                    {t('adjust.type')}
                                </label>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    <button
                                        type="button"
                                        onClick={() => setAdjustmentType('add')}
                                        style={{
                                            flex: 1,
                                            padding: '10px 14px',
                                            borderRadius: 8,
                                            border: '1px solid var(--color-border)',
                                            background:
                                                adjustmentType === 'add' ? 'var(--color-text-dark)' : 'var(--color-bg-muted)',
                                            color:
                                                adjustmentType === 'add' ? '#fff' : 'var(--color-text-body)',
                                            fontSize: '0.875rem',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {t('adjust.add')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAdjustmentType('remove')}
                                        style={{
                                            flex: 1,
                                            padding: '10px 14px',
                                            borderRadius: 8,
                                            border: 'none',
                                            background: adjustmentType === 'remove' ? '#DC2626' : '#FEE2E2',
                                            color: adjustmentType === 'remove' ? '#fff' : '#B91C1C',
                                            fontSize: '0.875rem',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {t('adjust.remove')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAdjustmentType('set')}
                                        style={{
                                            flex: 1,
                                            minWidth: 120,
                                            padding: '10px 14px',
                                            borderRadius: 8,
                                            border: '1px solid var(--color-border)',
                                            background:
                                                adjustmentType === 'set'
                                                    ? '#1D4ED8'
                                                    : '#EFF6FF',
                                            color:
                                                adjustmentType === 'set' ? '#fff' : '#1E40AF',
                                            fontSize: '0.875rem',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {t('adjust.set')}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label
                                    style={{
                                        display: 'block',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        color: 'var(--color-text-muted)',
                                        marginBottom: 6,
                                    }}
                                >
                                    {adjustmentType === 'set'
                                        ? t('adjust.newLevel', { unit: adjustItem.warehouseUnit || 'Box' })
                                        : t('adjust.qty', { unit: adjustItem.warehouseUnit || 'Box' })}
                                </label>
                                <input
                                    type="number"
                                    min={adjustmentType === 'set' ? undefined : '0.001'}
                                    step="any"
                                    value={adjustQty}
                                    onChange={(e) => setAdjustQty(e.target.value)}
                                    placeholder={
                                        adjustmentType === 'set'
                                            ? t('adjust.phSet', { unit: adjustItem.warehouseUnit || 'Box' })
                                            : t('adjust.phQty', { unit: adjustItem.warehouseUnit || 'Box' })
                                    }
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        borderRadius: 8,
                                        border: '1px solid var(--color-border)',
                                        fontSize: '0.875rem',
                                    }}
                                />
                                {(() => {
                                    const delta =
                                        Number.parseFloat(String(adjustQty).replace(/,/g, '')) ??
                                        NaN;
                                    if (!Number.isFinite(delta)) return null;
                                    if (adjustmentType !== 'set' && !(delta > 0)) return null;
                                    const cf = Number(adjustItem.conversionFactor) || 1;
                                    const curWh = Number(adjustItem.warehouseQty) || 0;
                                    const newWh =
                                        adjustmentType === 'set'
                                            ? delta
                                            : adjustmentType === 'add'
                                              ? curWh + delta
                                              : curWh - delta;
                                    const newWs = Math.round(newWh * cf * 1000) / 1000;
                                    const whUnit = adjustItem.warehouseUnit || 'Box';
                                    const wsUnit = adjustItem.unit || 'Liter';
                                    const hasSplit =
                                        cf > 1 &&
                                        wsUnit.toLowerCase() !== whUnit.toLowerCase();
                                    return (
                                        <p
                                            style={{
                                                margin: '8px 0 0',
                                                fontSize: '0.8125rem',
                                                color: 'var(--color-text-body)',
                                                fontWeight: 600,
                                            }}
                                        >
                                            {hasSplit
                                                ? t('adjust.afterSplit', {
                                                      qty: fmtQty(newWh),
                                                      unit: whUnit,
                                                      wsQty: fmtQty(newWs),
                                                      wsUnit,
                                                  })
                                                : t('adjust.after', {
                                                      qty: fmtQty(newWh),
                                                      unit: whUnit,
                                                  })}
                                        </p>
                                    );
                                })()}
                            </div>
                            <div>
                                <label
                                    style={{
                                        display: 'block',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        color: 'var(--color-text-muted)',
                                        marginBottom: 6,
                                    }}
                                >
                                    {t('adjust.unitCost')}
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={adjustUnitCost}
                                    onChange={(e) => {
                                        setAdjustUnitCost(e.target.value);
                                        setAdjustCostError('');
                                    }}
                                    placeholder={t('adjust.unitCostPh', {
                                        amount:
                                            Number(adjustItem.averageCostWarehouse) > 0
                                                ? Number(adjustItem.averageCostWarehouse).toFixed(2)
                                                : '—',
                                    })}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        borderRadius: 8,
                                        border: '1px solid var(--color-border)',
                                        fontSize: '0.875rem',
                                    }}
                                />
                                <p
                                    style={{
                                        margin: '6px 0 0',
                                        fontSize: '0.75rem',
                                        color: 'var(--color-text-muted)',
                                    }}
                                >
                                    {t('adjust.unitCostHint')}
                                </p>
                                {adjustCostError ? (
                                    <p role="alert" style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#B91C1C' }}>
                                        {adjustCostError}
                                    </p>
                                ) : null}
                            </div>
                            <div>
                                <label
                                    style={{
                                        display: 'block',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        color: 'var(--color-text-muted)',
                                        marginBottom: 6,
                                    }}
                                >
                                    {t('adjust.notes')}
                                </label>
                                <textarea
                                    value={adjustNotes}
                                    onChange={(e) => setAdjustNotes(e.target.value)}
                                    rows={3}
                                    placeholder={t('adjust.notesPh')}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        borderRadius: 8,
                                        border: '1px solid var(--color-border)',
                                        fontSize: '0.875rem',
                                        resize: 'vertical',
                                    }}
                                />
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>


            {purchasePriceEditProduct ? (
                <StockProductPurchasePriceEditModal
                    product={purchasePriceEditProduct}
                    onClose={() => setPurchasePriceEditProduct(null)}
                    onSaved={() => loadStock({ silent: true })}
                    locale={locale}
                />
            ) : null}

            {salesPriceEditProduct ? (
                <StockProductSalesPriceEditModal
                    product={salesPriceEditProduct}
                    onClose={() => setSalesPriceEditProduct(null)}
                    locale={locale}
                    onSaved={(saved) => {
                        const productId = salesPriceEditProduct?.id;
                        if (productId && saved?.salePrice != null) {
                            setStock((prev) =>
                                prev.map((row) =>
                                    String(row.id) === String(productId)
                                        ? {
                                              ...row,
                                              salePrice: Number(saved.salePrice),
                                              salePriceWarehouse:
                                                  saved.salePriceWarehouse != null
                                                      ? Number(saved.salePriceWarehouse)
                                                      : row.salePriceWarehouse,
                                          }
                                        : row,
                                ),
                            );
                        }
                        loadStock({ silent: true });
                    }}
                />
            ) : null}

            {criticalLevelEditProduct ? (
                <StockProductCriticalLevelEditModal
                    product={criticalLevelEditProduct}
                    onClose={() => setCriticalLevelEditProduct(null)}
                    locale={locale}
                    onSaved={() => {
                        loadStock({ silent: true });
                        if (activeTab === 'items') loadItems();
                    }}
                />
            ) : null}
        </div>
    );
}
