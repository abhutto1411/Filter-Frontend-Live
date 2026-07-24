import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, RefreshCw, Eye, Printer, ExternalLink, Search, FileText } from 'lucide-react';
import WorkshopSubScreen from '../../components/workshop/WorkshopSubScreen';
import { ShimmerTableBodyRows } from '../../components/supplier/Shimmer';
import CreditNotePrintView from '../../components/workshop/CreditNotePrintView';
import { branchScopeParams } from '../../services/workshopStaffApi';
import {
    getWorkshopSalesReturns,
    getWorkshopSalesReturn,
} from '../../services/workshopStaffApi';
import { useAuth } from '../../context/AuthContext';
import './Workshop.css';
import WsTableScroll from '../../components/workshop/WsTableScroll';

function statusTone(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'completed') return { label: 'Approved', bg: '#ECFDF5', fg: '#047857' };
    if (s === 'pending') return { label: 'Pending', bg: '#FEF3C7', fg: '#92400E' };
    if (s === 'rejected') return { label: 'Rejected', bg: '#FEE2E2', fg: '#B91C1C' };
    return { label: s || '—', bg: '#F3F4F6', fg: '#374151' };
}

function fmtDt(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return '—';
    }
}

function fmtMoney(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return '0.00';
    return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function WorkshopSalesReturns({ selectedBranchId = 'all', branches = [] }) {
    const { hasPermission } = useAuth();
    const canView = hasPermission('workshop.sales-returns.view') || hasPermission('workshop.approvals.view');

    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [invoiceNo, setInvoiceNo] = useState('');
    const [statusFilter, setStatusFilter] = useState('completed');

    const [detail, setDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [printOpen, setPrintOpen] = useState(false);
    const printRef = useRef(null);

    const branchParams = useMemo(
        () => branchScopeParams(selectedBranchId),
        [selectedBranchId],
    );

    const selectedBranchName = useMemo(() => {
        if (!selectedBranchId || selectedBranchId === 'all') return 'All branches';
        return branches.find((b) => String(b.id) === String(selectedBranchId))?.name || `Branch ${selectedBranchId}`;
    }, [branches, selectedBranchId]);

    const shownCount = rows.length;
    const shownAmount = useMemo(
        () => rows.reduce((s, r) => s + (Number(r.totalAmount) || 0), 0),
        [rows],
    );

    const load = useCallback(async () => {
        if (!canView) {
            setRows([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        setError('');
        try {
            const res = await getWorkshopSalesReturns({
                ...branchParams,
                status: statusFilter || undefined,
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined,
                invoiceNo: invoiceNo.trim() || undefined,
                limit: 100,
                offset: 0,
            });
            setRows(Array.isArray(res?.salesReturns) ? res.salesReturns : []);
            setTotal(Number(res?.total) || 0);
        } catch (e) {
            setRows([]);
            setError(e.message || 'Failed to load sales returns.');
        } finally {
            setLoading(false);
        }
    }, [canView, branchParams, statusFilter, dateFrom, dateTo, invoiceNo]);

    useEffect(() => {
        load();
    }, [load]);

    const openDetail = async (row) => {
        setDetail(row);
        setDetailLoading(true);
        try {
            const res = await getWorkshopSalesReturn(row.id, branchParams);
            if (res?.salesReturn) setDetail(res.salesReturn);
        } catch {
            /* keep list row */
        } finally {
            setDetailLoading(false);
        }
    };

    const handlePrint = () => {
        if (!printRef.current) return;
        const w = window.open('', '_blank');
        if (!w) return;
        w.document.write(`<!DOCTYPE html><html><head><title>Credit Note</title></head><body>${printRef.current.innerHTML}</body></html>`);
        w.document.close();
        w.focus();
        w.print();
    };

    const digitalInvoiceUrl = detail?.invoicePublicToken
        ? `${window.location.origin}/public/pos-invoices/${detail.invoicePublicToken}`
        : null;

    const closeDetail = () => {
        setDetail(null);
        setPrintOpen(false);
    };

    if (!canView) {
        return (
            <div style={{ padding: 32 }}>
                <p>You do not have permission to view sales returns.</p>
            </div>
        );
    }

    if (printOpen && detail) {
        return (
            <WorkshopSubScreen
                title={`Credit note ${detail.creditNoteNo || detail.returnNo || ''}`}
                subtitle={`Invoice ${detail.invoiceNo || '—'} · ${detail.customerName || 'Customer'}`}
                backLabel="Back to return detail"
                onBack={() => setPrintOpen(false)}
                size="xl"
                maxWidth="900px"
                footer={(
                    <div className="ws-sr-print-footer">
                        <button type="button" className="mc-btn-ghost" onClick={() => setPrintOpen(false)}>Close</button>
                        <button type="button" className="mc-btn-primary" onClick={handlePrint}>
                            <Printer size={16} /> Print
                        </button>
                    </div>
                )}
            >
                <div className="ws-section" style={{ padding: 20 }}>
                    <CreditNotePrintView ref={printRef} data={detail} />
                </div>
            </WorkshopSubScreen>
        );
    }

    if (detail) {
        return (
            <WorkshopSubScreen
                title={`Sales return ${detail.creditNoteNo || detail.returnNo || ''}`}
                subtitle={`Invoice ${detail.invoiceNo || '—'} · ${detail.customerName || 'Customer'}`}
                backLabel="Back to Sales Returns"
                onBack={closeDetail}
                size="xl"
                maxWidth="860px"
            >
                <div className="ws-section ws-sr-detail-panel">
                    {detailLoading ? (
                        <p className="ws-sr-detail-loading">Loading…</p>
                    ) : (
                        <>
                            <div className="ws-sr-detail-meta">
                                <div><strong>Credit note:</strong> {detail.creditNoteNo || detail.returnNo}</div>
                                <div><strong>Invoice:</strong> {detail.invoiceNo}</div>
                                <div><strong>Customer:</strong> {detail.customerName} · {detail.customerPhone || '—'}</div>
                                <div><strong>Vehicle:</strong> {detail.vehicleNumber || '—'}</div>
                                <div><strong>Cashier:</strong> {detail.cashier?.name || '—'}</div>
                                <div><strong>Branch:</strong> {detail.branchName}</div>
                                <div><strong>Return type:</strong> {detail.returnScope === 'full' ? 'Full return' : 'Partial return'}</div>
                                <div><strong>Date:</strong> {fmtDt(detail.returnDate || detail.createdAt)}</div>
                            </div>

                            <WsTableScroll className="ws-sr-detail-table-wrap">
                            <table className="ws-sr-detail-table">
                                <thead>
                                    <tr style={{ background: '#F9FAFB' }}>
                                        <th style={{ padding: 10, textAlign: 'left' }}>Product / service</th>
                                        <th style={{ padding: 10, textAlign: 'right' }}>Return qty</th>
                                        <th style={{ padding: 10, textAlign: 'right' }}>Line total</th>
                                        <th style={{ padding: 10, textAlign: 'left' }}>Reason</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(detail.items || []).map((it) => (
                                        <tr key={it.id} style={{ borderTop: '1px solid #eee' }}>
                                            <td style={{ padding: 10 }}>{it.name}</td>
                                            <td style={{ padding: 10, textAlign: 'right' }}>{it.qty}{it.originalQty != null ? ` / ${it.originalQty}` : ''}</td>
                                            <td style={{ padding: 10, textAlign: 'right' }}>SAR {Number(it.lineTotal || 0).toFixed(2)}</td>
                                            <td style={{ padding: 10 }}>{it.reason || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            </WsTableScroll>

                            <div className="ws-sr-detail-actions">
                                {digitalInvoiceUrl ? (
                                    <a href={digitalInvoiceUrl} target="_blank" rel="noopener noreferrer" className="mc-btn-ghost ws-sr-detail-link">
                                        <ExternalLink size={16} /> View digital invoice
                                    </a>
                                ) : null}
                                <button type="button" className="mc-btn-primary" onClick={() => setPrintOpen(true)}>
                                    <Printer size={16} /> View credit note / Print
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </WorkshopSubScreen>
        );
    }

    return (
        <div className="ws-sales-returns">
            <div className="ws-sr-header">
                <div className="ws-sr-header-main">
                    <div className="ws-sr-header-icon">
                        <RotateCcw size={18} color="#9A3412" />
                    </div>
                    <div>
                        <h1 className="ws-sr-title">Sales Returns</h1>
                        <p className="ws-sr-subtitle">
                            {selectedBranchName} · filter by date, invoice, branch, and cashier.
                        </p>
                    </div>
                </div>

                <div className="ws-sr-header-stats">
                    <div className="ws-sr-kpi">
                        <div className="ws-sr-kpi-label">Shown returns</div>
                        <div className="ws-sr-kpi-value">{loading ? '—' : shownCount.toLocaleString()}</div>
                    </div>
                    <div className="ws-sr-kpi">
                        <div className="ws-sr-kpi-label">Shown amount</div>
                        <div className="ws-sr-kpi-value">SAR {loading ? '—' : fmtMoney(shownAmount)}</div>
                    </div>
                    <button type="button" className="mc-btn-ghost ws-sr-refresh-btn" onClick={load} disabled={loading}>
                        <RefreshCw size={16} style={{ opacity: loading ? 0.5 : 1 }} /> Refresh
                    </button>
                </div>
            </div>

            <div className="ws-section ws-sr-filters">
                <div className="ws-sr-filters-inner">
                    <div className="ws-sr-filter-grid">
                        <div className="ws-sr-filter-field">
                            <label>From</label>
                            <input
                                type="datetime-local"
                                className="mc-filter-select"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                            />
                        </div>
                        <div className="ws-sr-filter-field">
                            <label>To</label>
                            <input
                                type="datetime-local"
                                className="mc-filter-select"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                            />
                        </div>
                        <div className="ws-sr-filter-field">
                            <label>Status</label>
                            <select className="mc-filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                                <option value="completed">Approved</option>
                                <option value="pending">Pending</option>
                                <option value="rejected">Rejected</option>
                                <option value="">All</option>
                            </select>
                        </div>
                        <div className="ws-sr-filter-field ws-sr-filter-field--invoice">
                            <label>Invoice #</label>
                            <div className="ws-sr-invoice-search">
                                <Search size={16} className="ws-sr-invoice-search-icon" />
                                <input
                                    type="text"
                                    className="mc-filter-select"
                                    placeholder="Search invoice number…"
                                    value={invoiceNo}
                                    onChange={(e) => setInvoiceNo(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="ws-sr-filter-field ws-sr-filter-field--apply">
                            <button type="button" className="mc-btn-primary ws-sr-apply-btn" onClick={load} disabled={loading}>
                                {loading ? 'Loading…' : 'Apply'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {error ? <p className="ws-sr-error">{error}</p> : null}

            <div className="ws-sr-table-wrap">
                <WsTableScroll>
                <table className="ws-sr-table">
                    <thead>
                        <tr style={{ background: '#F9FAFB', textAlign: 'left' }}>
                            <th style={{ padding: '12px 16px' }}>Date / time</th>
                            <th style={{ padding: '12px 16px' }}>Credit note #</th>
                            <th style={{ padding: '12px 16px' }}>Invoice #</th>
                            <th style={{ padding: '12px 16px' }}>Customer</th>
                            <th style={{ padding: '12px 16px' }}>Vehicle</th>
                            <th style={{ padding: '12px 16px' }}>Cashier</th>
                            <th style={{ padding: '12px 16px' }}>Branch</th>
                            <th style={{ padding: '12px 16px' }}>Type</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right' }}>Amount</th>
                            <th style={{ padding: '12px 16px' }}>Status</th>
                            <th style={{ padding: '12px 16px' }} />
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <ShimmerTableBodyRows cols={11} rows={8} />
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={11} style={{ padding: 44, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                                        <div style={{ width: 54, height: 54, borderRadius: 16, background: '#F9FAFB', border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <FileText size={22} color="#64748b" />
                                        </div>
                                        <div style={{ fontWeight: 800, color: '#111827' }}>No returns found</div>
                                        <div style={{ fontSize: '0.85rem' }}>
                                            Try widening the date range or switching status to <strong>All</strong>.
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            rows.map((r) => {
                                const st = statusTone(r.status);
                                return (
                                    <tr key={r.id} className="ws-sr-row" style={{ borderTop: '1px solid var(--color-border-light)' }}>
                                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>{fmtDt(r.returnDate || r.createdAt)}</td>
                                        <td style={{ padding: '12px 16px', fontWeight: 700 }}>{r.creditNoteNo || r.returnNo}</td>
                                        <td style={{ padding: '12px 16px' }}>{r.invoiceNo}</td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <div>{r.customerName || '—'}</div>
                                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{r.customerPhone || ''}</div>
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>{r.vehicleNumber || '—'}</td>
                                        <td style={{ padding: '12px 16px' }}>{r.cashier?.name || '—'}</td>
                                        <td style={{ padding: '12px 16px' }}>{r.branchName || '—'}</td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <span className="ws-sr-pill" style={{ background: '#EEF2FF', color: '#3730A3' }}>
                                                {(r.returnScope || '—').toString().toUpperCase()}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 900 }}>SAR {fmtMoney(r.totalAmount || 0)}</td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <span className="ws-sr-pill" style={{ background: st.bg, color: st.fg }}>
                                                {st.label}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <button type="button" className="mc-btn-ghost" style={{ padding: '6px 10px' }} onClick={() => openDetail(r)}>
                                                <Eye size={14} /> View
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
                </WsTableScroll>
            </div>
            {!loading && total > rows.length ? (
                <p className="ws-sr-pagination-note">Showing {rows.length} of {total}</p>
            ) : null}

        </div>
    );
}
