import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, FileText, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getSupplierWorkshopCriticalStockAlerts } from '../../services/supplierApi';
import { ShimmerTable } from '../../components/supplier/Shimmer';

function fmtQty(n) {
    if (n == null || !Number.isFinite(Number(n))) return '—';
    const x = Number(n);
    if (Math.abs(x - Math.round(x)) < 1e-9) return String(Math.round(x));
    return String(x).replace(/\.?0+$/, '');
}

export default function SupplierWorkshopAlerts() {
    const navigate = useNavigate();
    const [rows, setRows] = useState([]);
    const [summaryMessage, setSummaryMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [apiError, setApiError] = useState('');
    const [branchFilter, setBranchFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setApiError('');
            try {
                const data = await getSupplierWorkshopCriticalStockAlerts();
                const list = Array.isArray(data?.alerts) ? data.alerts : [];
                if (!cancelled) {
                    setRows(list);
                    setSummaryMessage(
                        typeof data?.message === 'string' ? data.message : '',
                    );
                }
            } catch (err) {
                console.error('Workshop critical stock alerts failed:', err);
                if (!cancelled) {
                    setRows([]);
                    setSummaryMessage('');
                    setApiError(err?.message || 'Failed to load alerts');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, []);

    const branchOptions = useMemo(() => {
        const byId = new Map();
        for (const r of rows) {
            const id = String(r.branchId ?? '');
            if (!id || byId.has(id)) continue;
            byId.set(id, {
                id,
                branchName: r.branchName || 'Branch',
                workshopName: r.workshopName || '',
            });
        }
        return [...byId.values()].sort((a, b) => {
            const ws = String(a.workshopName).localeCompare(String(b.workshopName));
            if (ws !== 0) return ws;
            return String(a.branchName).localeCompare(String(b.branchName));
        });
    }, [rows]);

    const filteredRows = useMemo(() => {
        let list = rows;
        if (branchFilter) {
            list = list.filter((r) => String(r.branchId ?? '') === String(branchFilter));
        }
        const q = searchQuery.trim().toLowerCase();
        if (q) {
            const tokens = q.split(/\s+/).filter(Boolean);
            list = list.filter((r) => {
                const haystack = [
                    r.workshopName,
                    r.branchName,
                    r.productName,
                    r.sku,
                    r.unit,
                    r.thresholdSource === 'workshop_branch' ? 'branch setting' : 'catalog',
                    fmtQty(r.currentQty),
                    fmtQty(r.criticalStockPoint),
                ]
                    .filter((x) => x != null && String(x).trim() !== '')
                    .join(' ')
                    .toLowerCase();
                return tokens.every((t) => haystack.includes(t));
            });
        }
        return list;
    }, [rows, branchFilter, searchQuery]);

    const groupedByWorkshop = useMemo(() => {
        const map = new Map();
        for (const r of filteredRows) {
            const wid = String(r.workshopId ?? '');
            if (!map.has(wid)) {
                map.set(wid, {
                    workshopId: wid,
                    workshopName: r.workshopName || 'Workshop',
                    items: [],
                });
            }
            map.get(wid).items.push(r);
        }
        return [...map.values()].sort((a, b) =>
            a.workshopName.localeCompare(b.workshopName),
        );
    }, [filteredRows]);

    const filtersActive = Boolean(branchFilter || searchQuery.trim());
    const totalAlertLines = rows.length;
    const filteredCount = filteredRows.length;

    /** Must match `SALES_INVOICE_FROM_ALERT_KEY` in SupplierSalesInvoices.jsx */
    const SALES_INVOICE_FROM_ALERT_KEY = 'salesInvoiceFromAlert';

    const openSalesInvoiceForAlert = (alert) => {
        const branchId = alert?.branchId;
        const supplierPid =
            alert?.supplierProductId != null && String(alert.supplierProductId).trim() !== ''
                ? String(alert.supplierProductId).trim()
                : '';
        const line = {
            productName: alert?.productName || '',
            sku: alert?.sku != null ? String(alert.sku) : '',
            unit: alert?.unit || '',
            ...(supplierPid ? { supplierProductId: supplierPid } : {}),
        };
        navigate('/supplier/sales_invoices', {
            state: {
                [SALES_INVOICE_FROM_ALERT_KEY]: {
                    branchId:
                        branchId != null && String(branchId) !== '' ? String(branchId) : '',
                    line,
                },
            },
        });
    };

    return (
        <div>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">Workshop Alerts</h2>
                    <p className="ws-page-sub">Low stock alerts from workshop branches</p>
                </div>
            </div>
            <div
                style={{
                    padding: 14,
                    background: '#FFFBEB',
                    border: '1px solid #FDE68A',
                    borderRadius: 12,
                    marginBottom: 20,
                    fontSize: '0.875rem',
                    color: '#92400E',
                }}
            >
                <strong>Workshop Stock Alerts</strong> — when a linked workshop branch’s on-hand
                quantity is at or below the critical threshold, it appears below. Issue a{' '}
                <strong>Sales Invoice</strong> to send them stock.
            </div>
            {apiError ? (
                <div
                    className="ws-section"
                    style={{
                        marginBottom: 16,
                        padding: 14,
                        background: '#FEF2F2',
                        border: '1px solid #FECACA',
                        borderRadius: 12,
                        color: '#B91C1C',
                        fontSize: '0.875rem',
                    }}
                >
                    <strong>Could not load alerts:</strong> {apiError}
                </div>
            ) : null}
            {!loading && summaryMessage ? (
                <p
                    style={{
                        margin: '0 0 14px',
                        fontSize: '0.875rem',
                        color: 'var(--color-text-muted)',
                    }}
                >
                    {summaryMessage}
                </p>
            ) : null}
            {!loading && rows.length > 0 ? (
                <div
                    className="ws-section"
                    style={{
                        marginBottom: 16,
                        padding: '12px 16px',
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: 12,
                    }}
                >
                    <label
                        style={{
                            flex: '1 1 220px',
                            minWidth: 200,
                            position: 'relative',
                            display: 'block',
                            margin: 0,
                        }}
                    >
                        <Search
                            size={16}
                            style={{
                                position: 'absolute',
                                left: 12,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: '#94a3b8',
                                pointerEvents: 'none',
                            }}
                        />
                        <input
                            type="search"
                            aria-label="Search alerts"
                            placeholder="Search workshop, branch, product, SKU…"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px 12px 10px 40px',
                                border: '1px solid #e2e8f0',
                                borderRadius: 10,
                                fontSize: '0.875rem',
                                background: '#fff',
                                boxSizing: 'border-box',
                            }}
                        />
                    </label>
                    <label
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                            minWidth: 220,
                            flex: '0 1 240px',
                            margin: 0,
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: '#64748b',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                        }}
                    >
                        Branch
                        <select
                            value={branchFilter}
                            onChange={(e) => setBranchFilter(e.target.value)}
                            style={{
                                padding: '10px 12px',
                                border: '1px solid #e2e8f0',
                                borderRadius: 10,
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                background: '#fff',
                                color: '#1e293b',
                            }}
                        >
                            <option value="">All branches</option>
                            {branchOptions.map((b) => (
                                <option key={b.id} value={b.id}>
                                    {b.workshopName
                                        ? `${b.workshopName} — ${b.branchName}`
                                        : b.branchName}
                                </option>
                            ))}
                        </select>
                    </label>
                    {filtersActive ? (
                        <button
                            type="button"
                            className="btn-portal-outline"
                            style={{ alignSelf: 'flex-end', whiteSpace: 'nowrap' }}
                            onClick={() => {
                                setBranchFilter('');
                                setSearchQuery('');
                            }}
                        >
                            Clear filters
                        </button>
                    ) : null}
                    <span
                        style={{
                            marginLeft: 'auto',
                            fontSize: '0.8125rem',
                            color: 'var(--color-text-muted)',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        Showing {filteredCount} of {totalAlertLines} line
                        {totalAlertLines === 1 ? '' : 's'}
                    </span>
                </div>
            ) : null}
            {loading ? (
                <div className="ws-section" style={{ padding: 0, overflow: 'hidden' }}>
                    <ShimmerTable rows={8} columns={7} />
                </div>
            ) : rows.length === 0 ? (
                <div className="ws-empty">
                    <AlertTriangle size={56} className="ws-empty-icon" />
                    <p className="ws-empty-text">No active alerts</p>
                </div>
            ) : filteredCount === 0 ? (
                <div className="ws-empty">
                    <AlertTriangle size={56} className="ws-empty-icon" />
                    <p className="ws-empty-text">No alerts match your filters</p>
                    <p
                        style={{
                            marginTop: 8,
                            fontSize: '0.875rem',
                            color: 'var(--color-text-muted)',
                            maxWidth: 420,
                            textAlign: 'center',
                        }}
                    >
                        Try another branch or clear the search. You still have{' '}
                        <strong>{totalAlertLines}</strong> active line
                        {totalAlertLines === 1 ? '' : 's'} in total.
                    </p>
                    <button
                        type="button"
                        className="btn-portal"
                        style={{ marginTop: 16 }}
                        onClick={() => {
                            setBranchFilter('');
                            setSearchQuery('');
                        }}
                    >
                        Clear filters
                    </button>
                </div>
            ) : (
                groupedByWorkshop.map((g) => (
                    <div key={g.workshopId} className="ws-section" style={{ marginBottom: 16 }}>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 12,
                                flexWrap: 'wrap',
                                marginBottom: 12,
                                padding: '16px 20px 0',
                                boxSizing: 'border-box',
                            }}
                        >
                            <h3
                                style={{
                                    margin: 0,
                                    fontSize: '1rem',
                                    fontWeight: 800,
                                    color: '#EA580C',
                                    flex: '1 1 200px',
                                    minWidth: 0,
                                    overflowWrap: 'anywhere',
                                    wordBreak: 'break-word',
                                    lineHeight: 1.35,
                                }}
                            >
                                {g.workshopName}
                            </h3>
                            <span
                                style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    color: 'var(--color-text-muted)',
                                    flexShrink: 0,
                                    whiteSpace: 'nowrap',
                                    paddingLeft: 4,
                                }}
                            >
                                {g.items.length} critical line{g.items.length === 1 ? '' : 's'}
                            </span>
                        </div>
                        <div style={{ overflowX: 'auto', padding: '0 20px 16px', boxSizing: 'border-box' }}>
                            <table className="ws-table ws-table--divided">
                                <colgroup>
                                    <col style={{ width: '14%' }} />
                                    <col style={{ width: '30%' }} />
                                    <col style={{ width: '10%' }} />
                                    <col style={{ width: '11%' }} />
                                    <col style={{ width: '11%' }} />
                                    <col style={{ width: '12%' }} />
                                    <col style={{ width: '12%' }} />
                                </colgroup>
                                <thead>
                                    <tr>
                                        <th>Branch</th>
                                        <th>Product</th>
                                        <th>SKU</th>
                                        <th style={{ textAlign: 'right' }}>Current</th>
                                        <th style={{ textAlign: 'right' }}>Critical</th>
                                        <th>Threshold</th>
                                        <th style={{ textAlign: 'right' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {g.items.map((a) => (
                                        <tr key={`${a.branchId}-${a.productId}`}>
                                            <td style={{ fontWeight: 600 }}>{a.branchName}</td>
                                            <td>
                                                <strong>{a.productName}</strong>
                                            </td>
                                            <td style={{ color: 'var(--color-text-muted)' }}>
                                                {a.sku || '—'}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                                {fmtQty(a.currentQty)} {a.unit}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                                {fmtQty(a.criticalStockPoint)} {a.unit}
                                            </td>
                                            <td>
                                                <span
                                                    className={`ws-badge ${a.thresholdSource === 'workshop_branch' ? 'ws-badge--orange' : 'ws-badge--cyan'}`}
                                                >
                                                    {a.thresholdSource === 'workshop_branch'
                                                        ? 'Branch setting'
                                                        : 'Catalog'}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <button
                                                    type="button"
                                                    className="mgr-si-btn-new"
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 6,
                                                        whiteSpace: 'nowrap',
                                                        padding: '8px 14px',
                                                        fontSize: '0.8125rem',
                                                    }}
                                                    onClick={() => openSalesInvoiceForAlert(a)}
                                                >
                                                    <FileText size={14} />
                                                    Sales invoice
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}
