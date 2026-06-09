import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, RefreshCw, Eye, Printer, ExternalLink, Search, FileText } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import { ShimmerTableBodyRows } from '../../components/supplier/Shimmer';
import CreditNotePrintView from '../../components/workshop/CreditNotePrintView';
import { branchScopeParams } from '../../services/workshopStaffApi';
import {
    getWorkshopSalesReturns,
    getWorkshopSalesReturn,
} from '../../services/workshopStaffApi';
import { useAuth } from '../../context/AuthContext';
import './Workshop.css';

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

    if (!canView) {
        return (
            <div style={{ padding: 32 }}>
                <p>You do not have permission to view sales returns.</p>
            </div>
        );
    }

    return (
        <div className="ws-page" style={{ padding: '24px 32px' }}>
            <style>{`
              .ws-sr-kpi {
                background: #fff;
                border: 1px solid var(--color-border-light);
                border-radius: 12px;
                padding: 14px 16px;
                box-shadow: 0 1px 4px rgba(0,0,0,0.04);
                min-width: 220px;
              }
              .ws-sr-kpi-label {
                font-size: 0.72rem;
                font-weight: 800;
                color: var(--color-text-muted);
                text-transform: uppercase;
                letter-spacing: 0.04em;
              }
              .ws-sr-kpi-value {
                margin-top: 4px;
                font-size: 1.25rem;
                font-weight: 900;
                color: #111827;
              }
              .ws-sr-table thead th {
                position: sticky;
                top: 0;
                background: #F9FAFB;
                z-index: 1;
              }
              .ws-sr-row:hover {
                background: #FFFBEB;
              }
              .ws-sr-pill {
                padding: 4px 10px;
                border-radius: 999px;
                font-size: 0.72rem;
                font-weight: 900;
                display: inline-flex;
                align-items: center;
                gap: 6px;
                white-space: nowrap;
              }
            `}</style>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 320px' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FFF7ED', border: '1px solid #FED7AA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <RotateCcw size={18} color="#9A3412" />
                    </div>
                    <div style={{ flex: 1 }}>
                        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: '#111827' }}>Sales Returns</h1>
                        <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                            {selectedBranchName} · filter by date, invoice, branch, and cashier.
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <div className="ws-sr-kpi">
                        <div className="ws-sr-kpi-label">Shown returns</div>
                        <div className="ws-sr-kpi-value">{loading ? '—' : shownCount.toLocaleString()}</div>
                    </div>
                    <div className="ws-sr-kpi">
                        <div className="ws-sr-kpi-label">Shown amount</div>
                        <div className="ws-sr-kpi-value">SAR {loading ? '—' : fmtMoney(shownAmount)}</div>
                    </div>
                    <button type="button" className="mc-btn-ghost" onClick={load} disabled={loading} style={{ height: 40, alignSelf: 'stretch' }}>
                        <RefreshCw size={16} style={{ opacity: loading ? 0.5 : 1 }} /> Refresh
                    </button>
                </div>
            </div>

            <div className="ws-section" style={{ marginBottom: 18 }}>
                <div style={{ padding: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 12, alignItems: 'end' }}>
                        <div style={{ gridColumn: 'span 3', minWidth: 200 }}>
                            <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-text-muted)', display: 'block', marginBottom: 6 }}>From</label>
                            <input
                                type="datetime-local"
                                className="mc-filter-select"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                style={{ width: '100%' }}
                            />
                        </div>
                        <div style={{ gridColumn: 'span 3', minWidth: 200 }}>
                            <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-text-muted)', display: 'block', marginBottom: 6 }}>To</label>
                            <input
                                type="datetime-local"
                                className="mc-filter-select"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                style={{ width: '100%' }}
                            />
                        </div>
                        <div style={{ gridColumn: 'span 2', minWidth: 160 }}>
                            <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-text-muted)', display: 'block', marginBottom: 6 }}>Status</label>
                            <select className="mc-filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: '100%' }}>
                                <option value="completed">Approved</option>
                                <option value="pending">Pending</option>
                                <option value="rejected">Rejected</option>
                                <option value="">All</option>
                            </select>
                        </div>
                        <div style={{ gridColumn: 'span 3', minWidth: 240 }}>
                            <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-text-muted)', display: 'block', marginBottom: 6 }}>Invoice #</label>
                            <div style={{ position: 'relative' }}>
                                <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                <input
                                    type="text"
                                    className="mc-filter-select"
                                    style={{ paddingLeft: 36, width: '100%' }}
                                    placeholder="Search invoice number…"
                                    value={invoiceNo}
                                    onChange={(e) => setInvoiceNo(e.target.value)}
                                />
                            </div>
                        </div>
                        <div style={{ gridColumn: 'span 1', minWidth: 150, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button type="button" className="mc-btn-primary" onClick={load} disabled={loading} style={{ width: '100%', height: 40 }}>
                                {loading ? 'Loading…' : 'Apply'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {error ? <p style={{ color: '#B91C1C', marginBottom: 16 }}>{error}</p> : null}

            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--color-border-light)', overflow: 'hidden' }}>
                <table className="ws-sr-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
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
            </div>
            {!loading && total > rows.length ? (
                <p style={{ marginTop: 12, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Showing {rows.length} of {total}</p>
            ) : null}

            <AnimatePresence>
                {detail ? (
                    <Modal onClose={() => { setDetail(null); setPrintOpen(false); }} title="Sales return detail" width="860px">
                        {detailLoading ? (
                            <p style={{ padding: 24, textAlign: 'center' }}>Loading…</p>
                        ) : (
                            <div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16, fontSize: '0.875rem' }}>
                                    <div><strong>Credit note:</strong> {detail.creditNoteNo || detail.returnNo}</div>
                                    <div><strong>Invoice:</strong> {detail.invoiceNo}</div>
                                    <div><strong>Customer:</strong> {detail.customerName} · {detail.customerPhone || '—'}</div>
                                    <div><strong>Vehicle:</strong> {detail.vehicleNumber || '—'}</div>
                                    <div><strong>Cashier:</strong> {detail.cashier?.name || '—'}</div>
                                    <div><strong>Branch:</strong> {detail.branchName}</div>
                                    <div><strong>Return type:</strong> {detail.returnScope === 'full' ? 'Full return' : 'Partial return'}</div>
                                    <div><strong>Date:</strong> {fmtDt(detail.returnDate || detail.createdAt)}</div>
                                </div>

                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', marginBottom: 16 }}>
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

                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                                    {digitalInvoiceUrl ? (
                                        <a href={digitalInvoiceUrl} target="_blank" rel="noopener noreferrer" className="mc-btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
                                            <ExternalLink size={16} /> View digital invoice
                                        </a>
                                    ) : null}
                                    <button type="button" className="mc-btn-primary" onClick={() => setPrintOpen(true)}>
                                        <Printer size={16} /> View credit note / Print
                                    </button>
                                </div>
                            </div>
                        )}
                    </Modal>
                ) : null}
            </AnimatePresence>

            <AnimatePresence>
                {printOpen && detail ? (
                    <Modal onClose={() => setPrintOpen(false)} title="Credit note" width="900px">
                        <div style={{ maxHeight: '70vh', overflow: 'auto' }}>
                            <CreditNotePrintView ref={printRef} data={detail} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                            <button type="button" className="mc-btn-ghost" onClick={() => setPrintOpen(false)}>Close</button>
                            <button type="button" className="mc-btn-primary" onClick={handlePrint}>
                                <Printer size={16} /> Print
                            </button>
                        </div>
                    </Modal>
                ) : null}
            </AnimatePresence>
        </div>
    );
}
