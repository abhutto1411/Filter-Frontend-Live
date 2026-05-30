import React, { useEffect, useState } from 'react';
import { FileText, Package, TrendingUp, DollarSign, Warehouse, Download, ArrowLeft, ChevronRight } from 'lucide-react';
import {
    getSupplierExpensesSummary,
    getSupplierInventoryStockBalances,
    getSupplierReceivables,
} from '../../services/supplierApi';
import { ShimmerTable } from '../../components/supplier/Shimmer';

const REPORT_CATEGORIES = [
    { id: 'ar', label: 'AR Summary', icon: FileText, color: '#DBEAFE', textColor: '#1D4ED8' },
    { id: 'stock', label: 'Stock Summary', icon: Package, color: '#D1FAE5', textColor: '#047857' },
    { id: 'movements', label: 'Stock Movements', icon: TrendingUp, color: '#FEF3C7', textColor: '#B45309' },
    { id: 'expenses', label: 'Expenses Summary', icon: DollarSign, color: '#FFEDD5', textColor: '#C2410C' },
    { id: 'inventory_value', label: 'Inventory Value', icon: Warehouse, color: '#E0E7FF', textColor: '#4F46E5' },
];

function formatInventoryRows(res) {
    const items = Array.isArray(res?.items)
        ? res.items.map((item) => ({
              id: item.productId,
              sku: item.sku || '-',
              name: item.productName,
              qty: Number(item.currentBalanceWorkshop || 0),
              criticalLevel: item.criticalAt != null ? Number(item.criticalAt) : 0,
              reorder: item.reorderAt != null ? Number(item.reorderAt) : 0,
              price:
                  Number(item.valueWarehouseSar || 0) > 0 && Number(item.currentBalanceWarehouse || 0) > 0
                      ? Number(item.valueWarehouseSar) / Number(item.currentBalanceWarehouse)
                      : 0,
          }))
        : [];
    const inventoryValue = items.reduce((s, i) => s + (i.qty || 0) * (i.price || 0), 0);
    const movements = Array.isArray(res?.transactionHistory)
        ? res.transactionHistory.map((h, idx) => ({
              id: h.id || idx,
              date: h.createdAt?.slice(0, 10) || '-',
              product: h.productName || '-',
              type: (h.transactionType || '').toLowerCase().includes('stock_out') ? 'stock out' : 'stock in',
              qty: Number(h.quantity || h.amount || 0),
              reference: h.referenceId || h.supplierInvoiceId || h.purchaseOrderId || '-',
          }))
        : [];
    const criticalCount = items.filter((s) => s.qty <= (s.criticalLevel ?? 0)).length;
    return { items, inventoryValue, movements, criticalCount };
}

export default function SupplierReports() {
    const [activeReport, setActiveReport] = useState(null);
    const [loading, setLoading] = useState(false);
    const [apiError, setApiError] = useState('');
    const [payload, setPayload] = useState(null);

    useEffect(() => {
        if (!activeReport) return undefined;
        let cancelled = false;
        setLoading(true);
        setApiError('');
        setPayload(null);

        const run = async () => {
            try {
                if (activeReport === 'ar') {
                    const data = await getSupplierReceivables();
                    if (!cancelled) setPayload({ kind: 'ar', data });
                    return;
                }
                if (activeReport === 'expenses') {
                    const data = await getSupplierExpensesSummary();
                    if (!cancelled) setPayload({ kind: 'expenses', data });
                    return;
                }
                if (activeReport === 'stock' || activeReport === 'movements' || activeReport === 'inventory_value') {
                    const res = await getSupplierInventoryStockBalances({ limit: 500, historyLimit: 200 });
                    const parsed = formatInventoryRows(res);
                    if (!cancelled) setPayload({ kind: activeReport, ...parsed });
                }
            } catch (err) {
                if (!cancelled) setApiError(err?.message || 'Failed to load report');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        run();
        return () => {
            cancelled = true;
        };
    }, [activeReport]);

    const arTotal =
        payload?.kind === 'ar'
            ? Array.isArray(payload.data?.list)
                ? payload.data.list.reduce((sum, item) => sum + Number(item.outstanding || 0), 0)
                : Number(payload.data?.totalOutstanding ?? payload.data?.total ?? 0)
            : null;

    if (activeReport) {
        return (
            <div>
                <button
                    type="button"
                    onClick={() => {
                        setActiveReport(null);
                        setPayload(null);
                        setApiError('');
                    }}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 16,
                        fontSize: '0.875rem',
                        color: '#2563EB',
                        fontWeight: 600,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                    }}
                >
                    <ArrowLeft size={16} /> Back to Reports
                </button>

                {loading ? (
                    <div className="ws-section" style={{ padding: 16 }}>
                        <ShimmerTable rows={12} columns={6} />
                    </div>
                ) : apiError ? (
                    <div className="ws-section" style={{ padding: 16, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, color: '#B91C1C', fontSize: '0.875rem' }}>
                        <strong>Could not load this report:</strong> {apiError}
                    </div>
                ) : null}
                {!loading && !apiError && activeReport === 'ar' && (
                    <div className="ws-section">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                            <h3 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text-dark)', margin: 0 }}>AR Summary</h3>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button type="button" className="btn-portal-outline" style={{ fontSize: '0.75rem', padding: '6px 12px' }}>
                                    <Download size={14} /> PDF
                                </button>
                                <button type="button" className="btn-portal-outline" style={{ fontSize: '0.75rem', padding: '6px 12px' }}>
                                    <Download size={14} /> Excel
                                </button>
                            </div>
                        </div>
                        <div style={{ padding: 16, background: '#EFF6FF', borderRadius: 12, marginBottom: 16 }}>
                            <p style={{ fontSize: '0.75rem', color: '#1D4ED8', margin: 0 }}>Total AR (outstanding)</p>
                            <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1D4ED8', margin: '4px 0 0 0' }}>
                                SAR {(arTotal ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>
                            Totals from receivables. Export for full detail when the backend supports it.
                        </p>
                    </div>
                )}
                {!loading && !apiError && activeReport === 'stock' && payload?.kind === 'stock' && (
                    <div className="ws-section">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                            <h3 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text-dark)', margin: 0 }}>Stock Summary</h3>
                            <button type="button" className="btn-portal-outline" style={{ fontSize: '0.75rem' }}>
                                <Download size={14} /> Export
                            </button>
                        </div>
                        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>
                            Total SKUs: {payload.items.length}. Critical: {payload.criticalCount}.
                        </p>
                    </div>
                )}
                {!loading && !apiError && activeReport === 'movements' && payload?.kind === 'movements' && (
                    <div className="ws-section">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                            <h3 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text-dark)', margin: 0 }}>Stock Movements</h3>
                            <button type="button" className="btn-portal-outline" style={{ fontSize: '0.75rem' }}>
                                <Download size={14} /> Export
                            </button>
                        </div>
                        {payload.movements.length === 0 ? (
                            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>No movement history returned by the API.</p>
                        ) : (
                            <table className="ws-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Product</th>
                                        <th>Type</th>
                                        <th>Qty</th>
                                        <th>Reference</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payload.movements.map((m) => (
                                        <tr key={m.id}>
                                            <td>{m.date}</td>
                                            <td>{m.product}</td>
                                            <td>
                                                <span className={`ws-badge ${m.type === 'stock out' ? 'ws-badge--red' : 'ws-badge--green'}`}>{m.type}</span>
                                            </td>
                                            <td>
                                                <strong>{m.qty}</strong>
                                            </td>
                                            <td>{m.reference}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
                {!loading && !apiError && activeReport === 'expenses' && payload?.kind === 'expenses' && (
                    <div className="ws-section">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                            <h3 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text-dark)', margin: 0 }}>Expenses Summary</h3>
                            <button type="button" className="btn-portal-outline" style={{ fontSize: '0.75rem' }}>
                                <Download size={14} /> Export
                            </button>
                        </div>
                        <pre
                            style={{
                                fontSize: '0.8125rem',
                                background: 'var(--color-bg-muted)',
                                padding: 12,
                                borderRadius: 8,
                                overflow: 'auto',
                                margin: 0,
                            }}
                        >
                            {JSON.stringify(payload.data, null, 2)}
                        </pre>
                    </div>
                )}
                {!loading && !apiError && activeReport === 'inventory_value' && payload?.kind === 'inventory_value' && (
                    <div className="ws-section">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                            <h3 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text-dark)', margin: 0 }}>Inventory Value</h3>
                            <button type="button" className="btn-portal-outline" style={{ fontSize: '0.75rem' }}>
                                <Download size={14} /> Export
                            </button>
                        </div>
                        <div style={{ padding: 16, background: '#E0E7FF', borderRadius: 12 }}>
                            <p style={{ fontSize: '0.75rem', color: '#4F46E5', margin: 0 }}>Total value (from stock balances)</p>
                            <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#4F46E5', margin: '4px 0 0 0' }}>
                                SAR {payload.inventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">Reports & Analytics</h2>
                    <p className="ws-page-sub">Supplier & warehouse reports</p>
                </div>
                <button type="button" className="btn-portal-outline">
                    <Download size={16} /> Export All
                </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                {REPORT_CATEGORIES.map((r) => (
                    <button
                        key={r.id}
                        type="button"
                        onClick={() => setActiveReport(r.id)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 14,
                            padding: 16,
                            borderRadius: 12,
                            border: '1px solid var(--color-border)',
                            background: '#fff',
                            cursor: 'pointer',
                            textAlign: 'left',
                            width: '100%',
                        }}
                    >
                        <div
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: 12,
                                background: r.color,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <r.icon size={20} style={{ color: r.textColor }} />
                        </div>
                        <span style={{ flex: 1, fontWeight: 600, fontSize: '0.9375rem', color: 'var(--color-text-dark)' }}>{r.label}</span>
                        <ChevronRight size={18} style={{ color: 'var(--color-text-muted)' }} />
                    </button>
                ))}
            </div>
        </div>
    );
}
