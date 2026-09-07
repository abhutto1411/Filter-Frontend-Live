import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, FileDown, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { getSuperSupplierPurchasePriceReport } from '../../services/supplierApi';
import MultiSelectSearchCombo from '../../components/MultiSelectSearchCombo';
import SupplierAccountingCombobox from './accounting/SupplierAccountingCombobox';
import { ShimmerTable } from '../../components/supplier/Shimmer';
import { spiT } from '../../utils/supplierPurchaseInvoicesI18n';
import {
    exportPurchasePriceReportExcel,
    exportPurchasePriceReportPdf,
} from './supplierPurchasePriceReportExport';

const ALL_VENDORS = '__all__';
const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];
const DEFAULT_PAGE_SIZE = 25;

function sliceReportPage(rows, page, pageSize) {
    const list = Array.isArray(rows) ? rows : [];
    const size = Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE);
    const total = list.length;
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

function money(n) {
    return Number(n || 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export default function SupplierPurchasePriceReport({
    locale = 'en',
    superSuppliers = [],
    active = true,
}) {
    const t = useCallback((key, vars) => spiT(locale, key, vars), [locale]);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [vendorId, setVendorId] = useState('');
    const [productKeys, setProductKeys] = useState([]);
    const [applied, setApplied] = useState({
        dateFrom: '',
        dateTo: '',
        vendorId: '',
        productKeys: [],
    });
    const [lines, setLines] = useState([]);
    const [products, setProducts] = useState([]);
    const [summary, setSummary] = useState({ lineCount: 0, totalQty: 0, totalAmount: 0 });
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
    const [exporting, setExporting] = useState('');

    const applyFilters = () => {
        if (dateFrom && dateTo && dateFrom > dateTo) {
            setErr(t('priceReport.err.dates'));
            return;
        }
        setErr('');
        setPage(1);
        setApplied({
            dateFrom,
            dateTo,
            vendorId,
            productKeys: [...productKeys],
        });
    };

    const clearFilters = () => {
        setDateFrom('');
        setDateTo('');
        setVendorId('');
        setProductKeys([]);
        setPage(1);
        setApplied({ dateFrom: '', dateTo: '', vendorId: '', productKeys: [] });
    };

    const load = useCallback(async () => {
        if (applied.dateFrom && applied.dateTo && applied.dateFrom > applied.dateTo) {
            setErr(t('priceReport.err.dates'));
            setLoading(false);
            return;
        }
        setLoading(true);
        setErr('');
        try {
            const res = await getSuperSupplierPurchasePriceReport({
                dateFrom: applied.dateFrom || undefined,
                dateTo: applied.dateTo || undefined,
                superSupplierId: applied.vendorId || undefined,
                limit: 20000,
            });
            setLines(Array.isArray(res?.lines) ? res.lines : []);
            if (Array.isArray(res?.products)) setProducts(res.products);
            setSummary(res?.summary || { lineCount: 0, totalQty: 0, totalAmount: 0 });
        } catch (e) {
            setLines([]);
            setErr(e?.message || t('priceReport.err.load'));
        } finally {
            setLoading(false);
        }
    }, [applied.dateFrom, applied.dateTo, applied.vendorId, t]);

    useEffect(() => {
        if (!active) return;
        load();
    }, [active, load]);

    const vendorOptions = useMemo(
        () => [
            { id: ALL_VENDORS, label: t('priceReport.allVendors') },
            ...(superSuppliers || []).map((ss) => ({
                id: String(ss.id),
                label: ss.name,
                searchText: ss.name,
            })),
        ],
        [superSuppliers, t],
    );

    const productOptions = useMemo(() => {
        const rows = (products || []).map((p) => ({
            id: p.key,
            label: p.label,
            searchText: p.label,
        }));
        const byId = new Map(rows.map((o) => [String(o.id), o]));
        for (const key of productKeys) {
            if (byId.has(String(key))) continue;
            const raw = String(key);
            byId.set(raw, {
                id: raw,
                label: raw.replace(/^id:|^name:/, ''),
                searchText: raw,
            });
        }
        return [...byId.values()];
    }, [products, productKeys]);

    const visible = useMemo(() => {
        if (!applied.productKeys.length) return lines;
        const set = new Set(applied.productKeys);
        return lines.filter((l) => set.has(String(l.productKey)));
    }, [lines, applied.productKeys]);

    const visibleSummary = useMemo(() => {
        if (!applied.productKeys.length) return summary;
        return {
            lineCount: visible.length,
            totalQty: Number(visible.reduce((s, l) => s + Number(l.qty || 0), 0).toFixed(3)),
            totalAmount: Number(
                visible.reduce((s, l) => s + Number(l.grandTotal || 0), 0).toFixed(2),
            ),
        };
    }, [applied.productKeys.length, summary, visible]);

    const paged = useMemo(
        () => sliceReportPage(visible, page, pageSize),
        [visible, page, pageSize],
    );

    useEffect(() => {
        if (page !== paged.page) setPage(paged.page);
    }, [page, paged.page]);

    const exportMeta = useMemo(() => {
        const vendor =
            (superSuppliers || []).find((ss) => String(ss.id) === String(applied.vendorId))
                ?.name || t('priceReport.allVendors');
        const productLabels = (applied.productKeys || [])
            .map((key) => productOptions.find((p) => String(p.id) === String(key))?.label || key)
            .filter(Boolean);
        return {
            dateFrom: applied.dateFrom,
            dateTo: applied.dateTo,
            vendor,
            products: productLabels.length ? productLabels.join(', ') : t('priceReport.allProducts'),
        };
    }, [applied, productOptions, superSuppliers, t]);

    const download = (kind) => {
        if (!visible.length || exporting) return;
        setExporting(kind);
        try {
            const payload = {
                lines: visible,
                filters: exportMeta,
                summary: visibleSummary,
            };
            if (kind === 'pdf') exportPurchasePriceReportPdf(payload);
            else exportPurchasePriceReportExcel(payload);
        } catch (e) {
            setErr(e?.message || t('priceReport.err.export'));
        } finally {
            setExporting('');
        }
    };

    return (
        <div className="ws-section">
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                    alignItems: 'flex-start',
                    marginBottom: 14,
                }}
            >
                <div>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <BarChart3 size={18} /> {t('priceReport.title')}
                    </h3>
                    <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748B', maxWidth: 640 }}>
                        {t('priceReport.sub')}
                    </p>
                </div>
                <div className="price-report-header-actions">
                    <button
                        type="button"
                        className="btn-portal-outline"
                        onClick={() => download('pdf')}
                        disabled={loading || !visible.length || Boolean(exporting)}
                    >
                        <FileDown size={14} />{' '}
                        {exporting === 'pdf' ? t('priceReport.exporting') : t('priceReport.btn.pdf')}
                    </button>
                    <button
                        type="button"
                        className="btn-portal-outline"
                        onClick={() => download('xlsx')}
                        disabled={loading || !visible.length || Boolean(exporting)}
                    >
                        <FileSpreadsheet size={14} />{' '}
                        {exporting === 'xlsx' ? t('priceReport.exporting') : t('priceReport.btn.excel')}
                    </button>
                    <button type="button" className="btn-portal-outline" onClick={load} disabled={loading}>
                        <RefreshCw size={14} /> {loading ? t('loading') : t('sspPanel.refresh')}
                    </button>
                </div>
            </div>

            <div className="price-report-filters">
                <label className="price-report-field">
                    <span>{t('priceReport.from')}</span>
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                    />
                </label>
                <label className="price-report-field">
                    <span>{t('priceReport.to')}</span>
                    <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                    />
                </label>
                <div className="price-report-field price-report-field--vendor">
                    <span>{t('priceReport.vendor')}</span>
                    <SupplierAccountingCombobox
                        className="price-report-vendor-combo"
                        options={vendorOptions}
                        value={vendorId || ALL_VENDORS}
                        onChange={(id) => {
                            const next = id === ALL_VENDORS ? '' : String(id || '');
                            setVendorId(next);
                        }}
                        placeholder={t('priceReport.allVendors')}
                        entityLabel="vendor"
                        emptyHint={t('priceReport.allVendors')}
                    />
                </div>
                <div className="price-report-field price-report-field--wide">
                    <span>{t('priceReport.products')}</span>
                    <MultiSelectSearchCombo
                        options={productOptions}
                        value={productKeys}
                        onChange={setProductKeys}
                        placeholder={t('priceReport.productsPh')}
                        emptyHint={t('priceReport.noProducts')}
                        maxInitial={1000}
                        maxFiltered={1000}
                    />
                </div>
                <div className="price-report-field price-report-field--actions">
                    <span aria-hidden="true">&nbsp;</span>
                    <div className="price-report-actions">
                        <button type="button" className="btn-portal" onClick={applyFilters}>
                            {t('btn.applyFilters')}
                        </button>
                        <button type="button" className="btn-portal-outline" onClick={clearFilters}>
                            {t('btn.clear')}
                        </button>
                    </div>
                </div>
            </div>

            <div className="price-report-kpis">
                <div>
                    {t('priceReport.lines')} <strong>{visibleSummary.lineCount}</strong>
                </div>
                <div>
                    {t('priceReport.qty')} <strong>{visibleSummary.totalQty}</strong>
                </div>
                <div>
                    {t('priceReport.spend')} <strong>SAR {money(visibleSummary.totalAmount)}</strong>
                </div>
            </div>

            {err ? (
                <div style={{ margin: '12px 0', padding: 12, background: '#FEF2F2', color: '#B91C1C', borderRadius: 10 }}>
                    {err}
                </div>
            ) : null}

            <div style={{ overflowX: 'auto' }}>
                <table className="ws-table">
                    <thead>
                        <tr>
                            <th>{t('priceReport.th.product')}</th>
                            <th>{t('priceReport.th.vendor')}</th>
                            <th>{t('priceReport.th.invoice')}</th>
                            <th>{t('priceReport.th.date')}</th>
                            <th>{t('priceReport.th.qty')}</th>
                            <th>{t('priceReport.th.unit')}</th>
                            <th>{t('priceReport.th.unitPrice')}</th>
                            <th>{t('priceReport.th.lineTotal')}</th>
                            <th>{t('priceReport.th.vat')}</th>
                            <th>{t('priceReport.th.grand')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && visible.length === 0 ? (
                            <tr>
                                <td colSpan={10}>
                                    <ShimmerTable rows={8} columns={10} />
                                </td>
                            </tr>
                        ) : paged.total === 0 ? (
                            <tr>
                                <td colSpan={10} style={{ textAlign: 'center', padding: 36, color: '#64748B' }}>
                                    {t('priceReport.empty')}
                                </td>
                            </tr>
                        ) : (
                            paged.rows.map((r) => (
                                <tr key={r.id}>
                                    <td>
                                        <strong>{r.productName}</strong>
                                        {r.sku ? (
                                            <div style={{ fontSize: 11, color: '#94A3B8' }}>{r.sku}</div>
                                        ) : null}
                                    </td>
                                    <td>{r.vendorName || '—'}</td>
                                    <td style={{ color: '#EA580C', fontWeight: 700 }}>{r.invoiceNo}</td>
                                    <td>{r.purchaseDate || '—'}</td>
                                    <td>{r.qty}</td>
                                    <td>{r.unit}</td>
                                    <td style={{ color: '#2563EB', fontWeight: 700 }}>
                                        SAR {money(r.unitPrice)}
                                    </td>
                                    <td>SAR {money(r.lineTotal)}</td>
                                    <td>SAR {money(r.vatAmount)}</td>
                                    <td style={{ color: '#2563EB', fontWeight: 800 }}>
                                        SAR {money(r.grandTotal)}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            {paged.total > 0 ? (
                <div className="price-report-pager">
                    <span>
                        {t('priceReport.pager.range', {
                            from: paged.from,
                            to: paged.to,
                            total: paged.total,
                        })}
                    </span>
                    <label>
                        {t('priceReport.pager.rows')}
                        <select
                            value={pageSize}
                            onChange={(e) => {
                                setPageSize(Number(e.target.value) || DEFAULT_PAGE_SIZE);
                                setPage(1);
                            }}
                        >
                            {PAGE_SIZE_OPTIONS.map((n) => (
                                <option key={n} value={n}>
                                    {n}
                                </option>
                            ))}
                        </select>
                    </label>
                    <span>
                        {t('priceReport.pager.page', {
                            page: paged.page,
                            pages: paged.pages,
                        })}
                    </span>
                    <button
                        type="button"
                        className="btn-portal-outline"
                        disabled={paged.page <= 1}
                        onClick={() => setPage(paged.page - 1)}
                    >
                        {t('priceReport.btn.prev')}
                    </button>
                    <button
                        type="button"
                        className="btn-portal-outline"
                        disabled={paged.page >= paged.pages}
                        onClick={() => setPage(paged.page + 1)}
                    >
                            {t('priceReport.btn.next')}
                        </button>
                </div>
            ) : null}
            <style>{`
                .price-report-header-actions {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    align-items: center;
                }
                .price-report-header-actions .btn-portal-outline {
                    height: 40px;
                    min-height: 40px;
                    padding: 0 12px;
                }
                .price-report-filters {
                    --pr-h: 44px;
                    display: flex;
                    flex-wrap: wrap;
                    gap: 12px;
                    align-items: flex-end;
                    padding: 14px 0 8px;
                }
                .price-report-field {
                    display: flex;
                    flex-direction: column;
                    justify-content: flex-end;
                    gap: 6px;
                    min-width: 150px;
                    font-size: 0.6875rem;
                    font-weight: 700;
                    color: #475569;
                }
                .price-report-field > span {
                    line-height: 1;
                    min-height: 12px;
                }
                .price-report-field--wide { min-width: min(420px, 100%); flex: 1; }
                .price-report-field--vendor { min-width: 240px; }
                .price-report-field--actions { min-width: 0; }
                .price-report-actions {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .price-report-filters input[type="date"],
                .price-report-filters .btn-portal,
                .price-report-filters .btn-portal-outline,
                .price-report-filters .price-report-vendor-combo .pi-search-box,
                .price-report-filters .ms-combo__field {
                    height: var(--pr-h);
                    min-height: var(--pr-h);
                    box-sizing: border-box;
                    border-radius: 10px;
                    border: 1px solid #e2e8f0;
                    font-size: 0.875rem;
                    font-weight: 600;
                    line-height: 1.2;
                }
                .price-report-filters input[type="date"] {
                    width: 100%;
                    padding: 0 12px;
                    background: #fff;
                    color: #0f172a;
                }
                .price-report-filters .btn-portal,
                .price-report-filters .btn-portal-outline {
                    margin: 0;
                    padding: 0 16px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    white-space: nowrap;
                    max-height: var(--pr-h);
                }
                .price-report-filters .price-report-vendor-combo,
                .price-report-filters .price-report-vendor-combo .pi-search-box-wrapper,
                .price-report-filters .ms-combo {
                    width: 100%;
                    min-width: 0;
                }
                .price-report-filters .price-report-vendor-combo .pi-search-box {
                    padding: 0 12px;
                    gap: 8px;
                    max-height: var(--pr-h);
                    background: #fff;
                }
                .price-report-filters .price-report-vendor-combo .pi-search-box svg {
                    position: static;
                    margin: 0;
                    flex-shrink: 0;
                }
                .price-report-filters .price-report-vendor-combo .pi-search-box input {
                    height: 100%;
                    min-height: 0;
                    padding: 0 !important;
                    border: none !important;
                    border-radius: 0;
                    background: transparent;
                    font-size: 0.875rem;
                    font-weight: 600;
                    color: #0f172a;
                }
                .price-report-filters .ms-combo__field {
                    height: auto;
                    align-items: center;
                    padding: 0 10px;
                    background: #fff;
                    max-height: none;
                }
                .price-report-filters .ms-combo__field svg {
                    margin-top: 0;
                }
                .price-report-filters .ms-combo__chips input {
                    padding: 0;
                    min-height: 0;
                    height: 28px;
                }
                .price-report-filters .ms-combo__clear {
                    margin-top: 0;
                }
                .price-report-kpis {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                    margin: 8px 0 14px;
                }
                .price-report-kpis > div {
                    background: #F8FAFC;
                    border: 1px solid #E2E8F0;
                    border-radius: 10px;
                    padding: 8px 12px;
                    font-size: 0.8125rem;
                    color: #475569;
                }
                .price-report-pager {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    justify-content: center;
                    gap: 12px 16px;
                    margin-top: 16px;
                    padding: 10px 12px 28px;
                    font-size: 0.8125rem;
                    color: #64748b;
                    text-align: center;
                }
                .price-report-pager label {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                }
                .price-report-pager select {
                    height: 36px;
                    min-width: 72px;
                    padding: 0 8px;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    background: #fff;
                    font-weight: 600;
                    color: #0f172a;
                }
                .price-report-pager .btn-portal-outline {
                    height: 36px;
                    min-height: 36px;
                    padding: 0 12px;
                }
            `}</style>
        </div>
    );
}
