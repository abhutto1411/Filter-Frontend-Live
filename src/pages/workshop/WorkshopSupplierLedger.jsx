import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { getSupplierLedger } from '../../services/workshopSuppliersApi';
import {
    exportSupplierLedgerPdf,
    exportSupplierLedgerExcel,
} from '../../utils/supplierLedgerExport';

const fmtMoney = (v) =>
    Number(v ?? 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

const firstOfMonthIso = () => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
};
const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Per-supplier ledger statement.
 *
 * Props:
 *   - tabState: { type: 'affiliated' | 'local', id: string, name?: string }
 *   - onTabChange: (tabId, state?) => void  (called to navigate back to list pages)
 */
export default function WorkshopSupplierLedger({ tabState, onTabChange }) {
    const type = tabState?.type;
    const supplierId = tabState?.id;
    const initialName = tabState?.name;

    const [from, setFrom] = useState(firstOfMonthIso());
    const [to, setTo] = useState(todayIso());
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const reload = useCallback(async () => {
        if (!type || !supplierId) return;
        setLoading(true);
        try {
            const res = await getSupplierLedger(type, supplierId, { from, to });
            setData(res);
            setError('');
        } catch (e) {
            console.error(e);
            setError(e?.message || 'Failed to load ledger');
        } finally {
            setLoading(false);
        }
    }, [type, supplierId, from, to]);

    useEffect(() => {
        reload();
    }, [reload]);

    const goBack = () => {
        if (type === 'affiliated') {
            onTabChange?.('affiliated-suppliers');
        } else {
            onTabChange?.('non-affiliated-suppliers');
        }
    };

    if (!type || !supplierId) {
        return (
            <div style={{ padding: 30 }}>
                <p>No supplier selected.</p>
                <button className="btn-portal-outline" onClick={() => onTabChange?.('affiliated-suppliers')}>
                    Back to suppliers
                </button>
            </div>
        );
    }

    const header = data?.header;
    const rows = data?.rows ?? [];
    const totals = data?.totals;
    const openingBalance = data?.openingBalance ?? 0;

    const onExportPdf = () => {
        if (!data) return;
        exportSupplierLedgerPdf({
            header,
            openingBalance,
            rows,
            totals,
        });
    };

    const onExportExcel = () => {
        if (!data) return;
        exportSupplierLedgerExcel({
            header,
            openingBalance,
            rows,
            totals,
        });
    };

    return (
        <div className="ws-page" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <button className="btn-portal-outline" onClick={goBack}>
                    <ArrowLeft size={14} style={{ marginRight: 6 }} />
                    Back
                </button>
                <h2 style={{ margin: 0, flex: 1 }}>
                    Supplier Ledger — {header?.supplierName || initialName || '—'}
                    <span style={{ marginLeft: 10, fontSize: 13, color: '#64748B', fontWeight: 400 }}>
                        ({type === 'affiliated' ? 'Affiliated' : 'Non-Affiliated'})
                    </span>
                </h2>
                <button className="btn-portal-outline" onClick={reload} disabled={loading}>
                    <RefreshCw size={14} style={{ marginRight: 6 }} />
                    Refresh
                </button>
            </div>

            <div
                style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: 12,
                    background: '#fff',
                    border: '1px solid var(--color-border)',
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 14,
                }}
            >
                <div>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: 12 }}>From</label>
                    <input
                        type="date"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                        style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border)' }}
                    />
                </div>
                <div>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: 12 }}>To</label>
                    <input
                        type="date"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                        style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border)' }}
                    />
                </div>
                <button className="btn-portal" onClick={reload} disabled={loading}>
                    Apply
                </button>
                <div style={{ flex: 1 }} />
                <button className="btn-portal-outline" onClick={onExportPdf} disabled={!data || loading}>
                    <FileText size={14} style={{ marginRight: 6 }} />
                    Export PDF
                </button>
                <button className="btn-portal-outline" onClick={onExportExcel} disabled={!data || loading}>
                    <FileSpreadsheet size={14} style={{ marginRight: 6 }} />
                    Export Excel
                </button>
            </div>

            {header && (
                <div
                    style={{
                        background: '#fff',
                        border: '1px solid var(--color-border)',
                        borderRadius: 12,
                        padding: 14,
                        marginBottom: 14,
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: 12,
                        fontSize: 13,
                    }}
                >
                    <div>
                        <div style={{ color: '#64748B', fontSize: 12 }}>Workshop</div>
                        <div style={{ fontWeight: 600 }}>{header.workshopName || '—'}</div>
                    </div>
                    <div>
                        <div style={{ color: '#64748B', fontSize: 12 }}>Branch</div>
                        <div style={{ fontWeight: 600 }}>{header.branchName || '—'}</div>
                    </div>
                    <div>
                        <div style={{ color: '#64748B', fontSize: 12 }}>Period</div>
                        <div style={{ fontWeight: 600 }}>
                            {header.from || '—'} — {header.to || '—'}
                        </div>
                    </div>
                    <div>
                        <div style={{ color: '#64748B', fontSize: 12 }}>Currency</div>
                        <div style={{ fontWeight: 600 }}>{header.currencyCode || 'SAR'}</div>
                    </div>
                </div>
            )}

            <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                        <tr style={{ background: '#F8FAFC', textAlign: 'left' }}>
                            <th style={{ padding: 12, width: 110 }}>Date</th>
                            <th style={{ padding: 12 }}>Description</th>
                            <th style={{ padding: 12, width: 130, textAlign: 'right' }}>Debit</th>
                            <th style={{ padding: 12, width: 130, textAlign: 'right' }}>Credit</th>
                            <th style={{ padding: 12, width: 150, textAlign: 'right' }}>Balance</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style={{ background: '#F8FAFC', borderTop: '1px solid #E2E8F0', fontWeight: 600 }}>
                            <td style={{ padding: 12 }}>—</td>
                            <td style={{ padding: 12 }}>Opening balance</td>
                            <td style={{ padding: 12, textAlign: 'right' }}>—</td>
                            <td style={{ padding: 12, textAlign: 'right' }}>—</td>
                            <td style={{ padding: 12, textAlign: 'right' }}>{fmtMoney(openingBalance)}</td>
                        </tr>
                        {loading ? (
                            <tr>
                                <td colSpan={5} style={{ padding: 30, textAlign: 'center', color: '#64748B' }}>
                                    Loading...
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={5} style={{ padding: 30, textAlign: 'center', color: '#64748B' }}>
                                    No transactions in this period.
                                </td>
                            </tr>
                        ) : (
                            rows.map((r) => (
                                <tr key={r.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                                    <td style={{ padding: 12 }}>{r.date}</td>
                                    <td style={{ padding: 12 }}>{r.description || '—'}</td>
                                    <td style={{ padding: 12, textAlign: 'right' }}>
                                        {r.debit > 0 ? fmtMoney(r.debit) : ''}
                                    </td>
                                    <td style={{ padding: 12, textAlign: 'right' }}>
                                        {r.credit > 0 ? fmtMoney(r.credit) : ''}
                                    </td>
                                    <td style={{ padding: 12, textAlign: 'right' }}>{fmtMoney(r.runningBalance)}</td>
                                </tr>
                            ))
                        )}
                        {totals && (
                            <tr style={{ background: '#FFF7ED', borderTop: '1px solid #FED7AA', fontWeight: 700 }}>
                                <td style={{ padding: 12 }}></td>
                                <td style={{ padding: 12 }}>Totals</td>
                                <td style={{ padding: 12, textAlign: 'right' }}>{fmtMoney(totals.totalDebit)}</td>
                                <td style={{ padding: 12, textAlign: 'right' }}>{fmtMoney(totals.totalCredit)}</td>
                                <td style={{ padding: 12, textAlign: 'right' }}>{fmtMoney(totals.closingBalance)}</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {error && (
                <p style={{ marginTop: 12, color: '#B91C1C', fontSize: 13 }}>{error}</p>
            )}
        </div>
    );
}
