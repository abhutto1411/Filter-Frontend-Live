import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertCircle,
    BarChart3,
    Plus,
    Target,
    Trash2,
    TrendingUp,
} from 'lucide-react';
import Modal from '../../../components/Modal';
import { ShimmerStatStrip, ShimmerTable } from '../../../components/supplier/Shimmer';
import {
    createStorageSalesRepTarget,
    deleteStorageSalesRepTarget,
    getStorageSalesRepPerformance,
    listStorageProducts,
    listStorageSalesReps,
} from '../../../services/storageFacilityApi';

function fmtSar(n) {
    return `SAR ${Number(n || 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function firstDayOfMonthISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function todayISO() {
    return new Date().toISOString().slice(0, 10);
}

const STATUS_STYLES = {
    exceeded: { bg: '#dcfce7', color: '#15803d', label: 'Target met' },
    on_track: { bg: '#dbeafe', color: '#1d4ed8', label: 'On track' },
    at_risk: { bg: '#fef3c7', color: '#b45309', label: 'At risk' },
    critical: { bg: '#fee2e2', color: '#b91c1c', label: 'Critical' },
    no_activity: { bg: '#f1f5f9', color: '#64748b', label: 'No sales' },
    no_target: { bg: '#f8fafc', color: '#475569', label: 'No target set' },
};

export default function StorageFacilitySalesRepPerformancePanel({
    brandId,
    initialSalesRepId = '',
    onSalesRepIdChange,
}) {
    const [salesReps, setSalesReps] = useState([]);
    const [products, setProducts] = useState([]);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');

    const [salesRepId, setSalesRepId] = useState(initialSalesRepId);

    useEffect(() => {
        setSalesRepId(initialSalesRepId || '');
    }, [initialSalesRepId]);

    const setRepFilter = (id) => {
        setSalesRepId(id);
        onSalesRepIdChange?.(id);
    };
    const [productId, setProductId] = useState('');
    const [from, setFrom] = useState(firstDayOfMonthISO());
    const [to, setTo] = useState(todayISO());

    const [targetModal, setTargetModal] = useState(false);
    const [targetForm, setTargetForm] = useState({
        salesRepId: '',
        periodStart: firstDayOfMonthISO(),
        periodEnd: todayISO(),
        targetAmount: '',
        label: '',
        notes: '',
    });
    const [targetBusy, setTargetBusy] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const [repRes, prodRes] = await Promise.all([
                    listStorageSalesReps(brandId),
                    listStorageProducts(brandId),
                ]);
                setSalesReps(repRes?.salesReps ?? []);
                setProducts(prodRes?.products ?? []);
            } catch {
                setSalesReps([]);
                setProducts([]);
            }
        })();
    }, [brandId]);

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const res = await getStorageSalesRepPerformance(brandId, {
                salesRepId: salesRepId || undefined,
                productId: productId || undefined,
                from: from || undefined,
                to: to || undefined,
            });
            setData(res);
        } catch (e) {
            setErr(e?.message || 'Failed to load sales performance');
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [brandId, salesRepId, productId, from, to]);

    useEffect(() => {
        load();
    }, [load]);

    const analysis = data?.analysis;
    const statusStyle = STATUS_STYLES[analysis?.status] ?? STATUS_STYLES.no_target;
    const achievementPct = analysis?.achievementPct;

    const openTargetModal = () => {
        setTargetForm({
            salesRepId: salesRepId || salesReps[0]?.id || '',
            periodStart: from || firstDayOfMonthISO(),
            periodEnd: to || todayISO(),
            targetAmount: '',
            label: '',
            notes: '',
        });
        setTargetModal(true);
    };

    const saveTarget = async (e) => {
        e.preventDefault();
        if (!targetForm.salesRepId || !targetForm.targetAmount) return;
        setTargetBusy(true);
        try {
            await createStorageSalesRepTarget(brandId, {
                salesRepId: targetForm.salesRepId,
                periodStart: targetForm.periodStart,
                periodEnd: targetForm.periodEnd,
                targetAmount: Number(targetForm.targetAmount),
                label: targetForm.label || undefined,
                notes: targetForm.notes || undefined,
            });
            setTargetModal(false);
            await load();
        } catch (ex) {
            window.alert(ex?.message || 'Could not save target');
        } finally {
            setTargetBusy(false);
        }
    };

    const removeTarget = async (t) => {
        if (!window.confirm(`Remove target "${t.label || t.periodStart}"?`)) return;
        try {
            await deleteStorageSalesRepTarget(brandId, t.id);
            await load();
        } catch (ex) {
            window.alert(ex?.message || 'Could not remove target');
        }
    };

    const showRepComparison = !salesRepId && (data?.byRep?.length ?? 0) > 0;

    const progressWidth = useMemo(() => {
        if (achievementPct == null) return 0;
        return Math.min(100, achievementPct);
    }, [achievementPct]);

    if (loading && !data) {
        return (
            <div className="ws-section">
                <ShimmerStatStrip cards={4} />
                <ShimmerTable rows={8} columns={6} />
            </div>
        );
    }

    const summary = data?.summary ?? {};
    const byProduct = data?.byProduct ?? [];
    const invoices = data?.invoices ?? [];
    const targets = data?.targets ?? [];

    return (
        <div className="sf-sales-performance">
            {err ? <div className="mgr-si-error" style={{ marginBottom: 12 }}>{err}</div> : null}

            <h3 style={{ margin: '0 0 8px', fontSize: '1.0625rem' }}>
                Sales performance & targets
            </h3>
            <p className="mgr-si-subtitle" style={{ marginBottom: 16 }}>
                Filter by representative, date range, and product. Compare actual sales vs
                targets, collections, and product mix. Data comes from posted stock-sale invoices
                (stock-out with customer + prices).
            </p>

            <div className="sf-sales-filters ws-section" style={{ padding: 16, marginBottom: 16 }}>
                <div className="sf-form-row-2" style={{ marginBottom: 12 }}>
                    <div className="sf-form-field">
                        <label htmlFor="sf-sales-rep">Sales representative</label>
                        <select
                            id="sf-sales-rep"
                            value={salesRepId}
                            onChange={(e) => setRepFilter(e.target.value)}
                        >
                            <option value="">All representatives</option>
                            {salesReps.map((r) => (
                                <option key={r.id} value={r.id}>
                                    {r.name}
                                    {r.code ? ` (${r.code})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="sf-form-field">
                        <label htmlFor="sf-sales-product">Product</label>
                        <select
                            id="sf-sales-product"
                            value={productId}
                            onChange={(e) => setProductId(e.target.value)}
                        >
                            <option value="">All products</option>
                            {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name}
                                    {p.sku ? ` · ${p.sku}` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="sf-form-row-2">
                    <div className="sf-form-field">
                        <label htmlFor="sf-sales-from">From</label>
                        <input
                            id="sf-sales-from"
                            type="date"
                            value={from}
                            onChange={(e) => setFrom(e.target.value)}
                        />
                    </div>
                    <div className="sf-form-field">
                        <label htmlFor="sf-sales-to">To</label>
                        <input
                            id="sf-sales-to"
                            type="date"
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div
                className="ws-kpi-grid"
                style={{
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    marginBottom: 16,
                    gap: 12,
                }}
            >
                <div className="ws-kpi-card">
                    <div>
                        <p className="ws-kpi-label">SALES (POSTED)</p>
                        <p className="ws-kpi-value" style={{ color: '#15803d' }}>
                            {fmtSar(summary.totalSales)}
                        </p>
                    </div>
                    <div className="ws-kpi-icon ws-kpi-icon--green">
                        <TrendingUp size={22} />
                    </div>
                </div>
                <div className="ws-kpi-card">
                    <div>
                        <p className="ws-kpi-label">COLLECTED</p>
                        <p className="ws-kpi-value">{fmtSar(summary.totalCollected)}</p>
                    </div>
                    <div className="ws-kpi-icon ws-kpi-icon--blue">
                        <BarChart3 size={22} />
                    </div>
                </div>
                <div className="ws-kpi-card">
                    <div>
                        <p className="ws-kpi-label">OUTSTANDING</p>
                        <p className="ws-kpi-value" style={{ color: '#2563eb' }}>
                            {fmtSar(summary.totalOutstanding)}
                        </p>
                    </div>
                    <div className="ws-kpi-icon ws-kpi-icon--purple">
                        <AlertCircle size={22} />
                    </div>
                </div>
                <div className="ws-kpi-card">
                    <div>
                        <p className="ws-kpi-label">INVOICES</p>
                        <p className="ws-kpi-value">{summary.invoiceCount ?? 0}</p>
                    </div>
                    <div className="ws-kpi-icon ws-kpi-icon--blue">
                        <Target size={22} />
                    </div>
                </div>
            </div>

            {analysis ? (
                <div
                    className="ws-section sf-sales-insight"
                    style={{ padding: 16, marginBottom: 16 }}
                >
                    <div
                        style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            justifyContent: 'space-between',
                            gap: 12,
                            marginBottom: 12,
                        }}
                    >
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1rem' }}>Performance analysis</h3>
                            <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#64748b' }}>
                                {analysis.statusLabel}
                            </p>
                        </div>
                        <span
                            style={{
                                padding: '6px 12px',
                                borderRadius: 8,
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                background: statusStyle.bg,
                                color: statusStyle.color,
                            }}
                        >
                            {statusStyle.label}
                        </span>
                    </div>

                    {data?.activeTarget ? (
                        <div style={{ marginBottom: 12 }}>
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    fontSize: '0.8125rem',
                                    marginBottom: 6,
                                }}
                            >
                                <span>
                                    Target: {fmtSar(data.activeTarget.targetAmount)}
                                    {data.activeTarget.label
                                        ? ` · ${data.activeTarget.label}`
                                        : ''}
                                </span>
                                {achievementPct != null ? (
                                    <strong>{achievementPct}%</strong>
                                ) : null}
                            </div>
                            <div
                                style={{
                                    height: 10,
                                    background: '#e2e8f0',
                                    borderRadius: 6,
                                    overflow: 'hidden',
                                }}
                            >
                                <div
                                    style={{
                                        width: `${progressWidth}%`,
                                        height: '100%',
                                        background:
                                            achievementPct >= 100
                                                ? '#16a34a'
                                                : achievementPct >= 75
                                                  ? '#2563eb'
                                                  : achievementPct >= 50
                                                    ? '#d97706'
                                                    : '#dc2626',
                                        transition: 'width 0.3s',
                                    }}
                                />
                            </div>
                            {analysis.gapToTarget != null && analysis.gapToTarget > 0 ? (
                                <p
                                    style={{
                                        margin: '8px 0 0',
                                        fontSize: '0.8125rem',
                                        color: '#64748b',
                                    }}
                                >
                                    Gap to target: {fmtSar(analysis.gapToTarget)} · Collection rate:{' '}
                                    {analysis.collectionRate}%
                                </p>
                            ) : (
                                <p
                                    style={{
                                        margin: '8px 0 0',
                                        fontSize: '0.8125rem',
                                        color: '#64748b',
                                    }}
                                >
                                    Collection rate: {analysis.collectionRate}%
                                </p>
                            )}
                        </div>
                    ) : (
                        <p style={{ fontSize: '0.8125rem', color: '#64748b', marginBottom: 12 }}>
                            No target overlaps this period — set one to enable target vs actual
                            tracking.
                        </p>
                    )}

                    <h4 style={{ margin: '0 0 8px', fontSize: '0.875rem' }}>
                        Recommended next steps
                    </h4>
                    <ul
                        style={{
                            margin: 0,
                            paddingLeft: 20,
                            fontSize: '0.8125rem',
                            color: '#334155',
                        }}
                    >
                        {(analysis.recommendations ?? []).map((r) => (
                            <li key={r} style={{ marginBottom: 6 }}>
                                {r}
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}

            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <button type="button" className="mgr-si-btn-new" onClick={openTargetModal}>
                    <Plus size={14} /> Set sales target
                </button>
            </div>

            {targets.length > 0 ? (
                <div className="ws-section" style={{ padding: 16, marginBottom: 16 }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: '0.9375rem' }}>
                        Targets in this period
                    </h3>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="ws-table">
                            <thead>
                                <tr>
                                    <th>Rep</th>
                                    <th>Period</th>
                                    <th>Label</th>
                                    <th style={{ textAlign: 'right' }}>Target</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {targets.map((t) => (
                                    <tr key={t.id}>
                                        <td>{t.salesRepName}</td>
                                        <td>
                                            {t.periodStart} → {t.periodEnd}
                                        </td>
                                        <td>{t.label || '—'}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                            {fmtSar(t.targetAmount)}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <button
                                                type="button"
                                                className="btn-portal-outline"
                                                style={{ padding: '4px 8px' }}
                                                onClick={() => removeTarget(t)}
                                                title="Remove target"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : null}

            {showRepComparison ? (
                <div className="ws-section" style={{ padding: 16, marginBottom: 16 }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: '0.9375rem' }}>
                        By sales representative
                    </h3>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="ws-table">
                            <thead>
                                <tr>
                                    <th>Representative</th>
                                    <th style={{ textAlign: 'right' }}>Sales</th>
                                    <th style={{ textAlign: 'right' }}>Collected</th>
                                    <th style={{ textAlign: 'right' }}>Outstanding</th>
                                    <th style={{ textAlign: 'center' }}>Invoices</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.byRep.map((r) => (
                                    <tr key={r.salesRepId || r.salesRepName}>
                                        <td style={{ fontWeight: 600 }}>{r.salesRepName}</td>
                                        <td style={{ textAlign: 'right' }}>{fmtSar(r.totalSales)}</td>
                                        <td style={{ textAlign: 'right' }}>{fmtSar(r.collected)}</td>
                                        <td style={{ textAlign: 'right' }}>{fmtSar(r.outstanding)}</td>
                                        <td style={{ textAlign: 'center' }}>{r.invoiceCount}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : null}

            {byProduct.length > 0 ? (
                <div className="ws-section" style={{ padding: 16, marginBottom: 16 }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: '0.9375rem' }}>Product breakdown</h3>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="ws-table">
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th>SKU</th>
                                    <th style={{ textAlign: 'right' }}>Qty sold</th>
                                    <th style={{ textAlign: 'right' }}>Revenue</th>
                                </tr>
                            </thead>
                            <tbody>
                                {byProduct.map((p) => (
                                    <tr key={p.productId}>
                                        <td style={{ fontWeight: 600 }}>{p.productName}</td>
                                        <td>{p.sku || '—'}</td>
                                        <td style={{ textAlign: 'right' }}>{p.qty}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                            {fmtSar(p.revenue)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : null}

            <div className="ws-section" style={{ padding: 16 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: '0.9375rem' }}>Sales invoices</h3>
                <div style={{ overflowX: 'auto' }}>
                    <table className="ws-table">
                        <thead>
                            <tr>
                                <th>Invoice #</th>
                                <th>Date</th>
                                <th>Customer</th>
                                <th>Rep</th>
                                <th style={{ textAlign: 'right' }}>Total</th>
                                <th style={{ textAlign: 'right' }}>Collected</th>
                                <th style={{ textAlign: 'right' }}>Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoices.map((s) => (
                                <tr key={s.id}>
                                    <td style={{ fontWeight: 600 }}>{s.invoiceNo}</td>
                                    <td>{s.issueDate}</td>
                                    <td>{s.customerName || '—'}</td>
                                    <td>{s.salesRepName || '—'}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                        {fmtSar(s.grandTotal)}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>{fmtSar(s.paidAmount)}</td>
                                    <td style={{ textAlign: 'right' }}>{fmtSar(s.balance)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {invoices.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#64748b', padding: 24 }}>
                        No posted stock sales match these filters. Record stock-out with customer
                        and prices from Stock movements.
                    </p>
                ) : null}
            </div>

            {targetModal ? (
                <Modal
                    title="Set sales target"
                    width="520px"
                    contentClassName="sf-simple-modal"
                    onClose={() => !targetBusy && setTargetModal(false)}
                >
                    <form className="sf-simple-form" onSubmit={saveTarget}>
                        <div className="sf-form-field">
                            <label htmlFor="sf-target-rep">Sales representative *</label>
                            <select
                                id="sf-target-rep"
                                value={targetForm.salesRepId}
                                onChange={(e) =>
                                    setTargetForm((f) => ({ ...f, salesRepId: e.target.value }))
                                }
                                required
                            >
                                <option value="">Select…</option>
                                {salesReps.map((r) => (
                                    <option key={r.id} value={r.id}>
                                        {r.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="sf-form-row-2">
                            <div className="sf-form-field">
                                <label htmlFor="sf-target-start">Period start *</label>
                                <input
                                    id="sf-target-start"
                                    type="date"
                                    value={targetForm.periodStart}
                                    onChange={(e) =>
                                        setTargetForm((f) => ({
                                            ...f,
                                            periodStart: e.target.value,
                                        }))
                                    }
                                    required
                                />
                            </div>
                            <div className="sf-form-field">
                                <label htmlFor="sf-target-end">Period end *</label>
                                <input
                                    id="sf-target-end"
                                    type="date"
                                    value={targetForm.periodEnd}
                                    onChange={(e) =>
                                        setTargetForm((f) => ({
                                            ...f,
                                            periodEnd: e.target.value,
                                        }))
                                    }
                                    required
                                />
                            </div>
                        </div>
                        <div className="sf-form-field">
                            <label htmlFor="sf-target-amt">Target amount (SAR) *</label>
                            <input
                                id="sf-target-amt"
                                type="number"
                                min="0"
                                step="0.01"
                                value={targetForm.targetAmount}
                                onChange={(e) =>
                                    setTargetForm((f) => ({
                                        ...f,
                                        targetAmount: e.target.value,
                                    }))
                                }
                                required
                            />
                        </div>
                        <div className="sf-form-field">
                            <label htmlFor="sf-target-label">Label (optional)</label>
                            <input
                                id="sf-target-label"
                                placeholder="e.g. Q2 2026"
                                value={targetForm.label}
                                onChange={(e) =>
                                    setTargetForm((f) => ({ ...f, label: e.target.value }))
                                }
                            />
                        </div>
                        <div className="sf-form-actions">
                            <button
                                type="button"
                                className="btn-portal-outline"
                                disabled={targetBusy}
                                onClick={() => setTargetModal(false)}
                            >
                                Cancel
                            </button>
                            <button type="submit" className="mgr-si-btn-new" disabled={targetBusy}>
                                {targetBusy ? 'Saving…' : 'Save target'}
                            </button>
                        </div>
                    </form>
                </Modal>
            ) : null}
        </div>
    );
}
