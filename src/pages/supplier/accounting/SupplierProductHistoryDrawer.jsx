import React, { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { getSupplierProductMovements } from '../../../services/supplierAccountingApi';
import {
    AcctEmpty,
    AcctError,
    AcctLoading,
    Field,
    fmtDate,
    inputStyle,
    money,
    outlineBtnStyle,
} from './SupplierAccountingShared';

const MOVEMENT_LABELS = {
    PURCHASE_IN: 'Purchase In',
    PURCHASE_RETURN: 'Purchase Return',
    SALE_OUT: 'Sale Out',
    SALE_RETURN: 'Sale Return',
    ADJUSTMENT_IN: 'Adjustment In',
    ADJUSTMENT_OUT: 'Adjustment Out',
    TRANSFER_IN: 'Transfer In',
    TRANSFER_OUT: 'Transfer Out',
    OPENING: 'Opening',
};

function isPositiveMovement(t) {
    return t === 'PURCHASE_IN' || t === 'SALE_RETURN' || t === 'ADJUSTMENT_IN' || t === 'TRANSFER_IN' || t === 'OPENING';
}

export default function SupplierProductHistoryDrawer({ supplierProductId, productName, onClose }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const load = useCallback(async () => {
        if (!supplierProductId) return;
        setLoading(true);
        setErr('');
        try {
            const res = await getSupplierProductMovements(supplierProductId, { dateFrom, dateTo, limit: 300 });
            setData(res);
        } catch (e) {
            setErr(e?.message || 'Failed to load product history');
        } finally {
            setLoading(false);
        }
    }, [supplierProductId, dateFrom, dateTo]);

    useEffect(() => { load(); }, [load]);

    if (!supplierProductId) return null;

    const totalValuation = (data?.valuationByLocation || []).reduce((s, v) => s + (v.totalValue || 0), 0);
    const totalQty = (data?.valuationByLocation || []).reduce((s, v) => s + (v.quantity || 0), 0);

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                right: 0,
                bottom: 0,
                width: 'min(980px, 95vw)',
                background: '#F8FAFC',
                zIndex: 1000,
                boxShadow: '-12px 0 32px rgba(15, 23, 42, 0.2)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            }}
            role="dialog"
            aria-modal="true"
        >
            <header style={{ padding: '16px 20px', background: '#ffffff', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <p style={{ margin: 0, fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800 }}>
                        Inventory history
                    </p>
                    <h2 style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 800, color: '#0F172A' }}>
                        {data?.product?.name || productName || `Product #${supplierProductId}`}
                    </h2>
                    {data?.product?.sku ? (
                        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748B' }}>SKU {data.product.sku}</p>
                    ) : null}
                </div>
                <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }} aria-label="Close">
                    <X size={22} />
                </button>
            </header>

            <div style={{ padding: '12px 20px', background: '#ffffff', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                <div>
                    <p style={{ margin: 0, fontSize: 11, color: '#64748B' }}>Total quantity</p>
                    <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 800 }}>{totalQty.toLocaleString()} {data?.product?.unit || ''}</p>
                </div>
                <div>
                    <p style={{ margin: 0, fontSize: 11, color: '#64748B' }}>Inventory value</p>
                    <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 800 }}>{money(totalValuation)}</p>
                </div>
                {(data?.valuationByLocation || []).map((v) => (
                    <div key={v.locationId}>
                        <p style={{ margin: 0, fontSize: 11, color: '#64748B' }}>{v.locationName || `Loc #${v.locationId}`}</p>
                        <p style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 700 }}>
                            {Number(v.quantity).toLocaleString()} @ avg {money(v.averageCost)}
                        </p>
                    </div>
                ))}
            </div>

            <div style={{ padding: '12px 20px', background: '#ffffff', display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <Field label="From"><input type="date" style={inputStyle} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></Field>
                <Field label="To"><input type="date" style={inputStyle} value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></Field>
                <button type="button" style={outlineBtnStyle} onClick={() => { setDateFrom(''); setDateTo(''); }}>Clear</button>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
                {loading ? <AcctLoading /> : err ? <AcctError message={err} /> : !data?.movements?.length ? (
                    <AcctEmpty message="No inventory movements yet for this product." />
                ) : (
                    <table className="ws-table" style={{ width: '100%' }}>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Type</th>
                                <th>Location</th>
                                <th style={{ textAlign: 'right' }}>Qty Δ</th>
                                <th style={{ textAlign: 'right' }}>Unit Cost</th>
                                <th style={{ textAlign: 'right' }}>Balance Qty</th>
                                <th style={{ textAlign: 'right' }}>Running Avg</th>
                                <th>Source / Notes</th>
                                <th>Entry</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.movements.map((m) => {
                                const positive = isPositiveMovement(m.movementType);
                                return (
                                    <tr key={m.id}>
                                        <td>{fmtDate(m.createdAt)}</td>
                                        <td>
                                            <span style={{
                                                padding: '2px 8px',
                                                borderRadius: 999,
                                                fontSize: 11,
                                                fontWeight: 700,
                                                background: positive ? '#DCFCE7' : '#FEE2E2',
                                                color: positive ? '#065F46' : '#B91C1C',
                                            }}>
                                                {MOVEMENT_LABELS[m.movementType] || m.movementType}
                                            </span>
                                        </td>
                                        <td>{m.locationName || `#${m.locationId}`}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 700, color: positive ? '#065F46' : '#B91C1C' }}>
                                            {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>{money(m.unitCost)}</td>
                                        <td style={{ textAlign: 'right' }}>{m.balanceQty}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(m.runningAvgCost)}</td>
                                        <td style={{ maxWidth: 240 }}>
                                            <div style={{ fontSize: 12 }}>{m.sourceType || '—'}{m.sourceId ? ` #${m.sourceId}` : ''}</div>
                                            {m.notes ? <div style={{ fontSize: 11, color: '#64748B' }}>{m.notes}</div> : null}
                                        </td>
                                        <td>{m.journalEntryNumber || '—'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
