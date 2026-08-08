import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, BarChart3, DollarSign, FileText, ShoppingCart } from 'lucide-react';
import { getSupplierAccountingScreen } from '../../services/supplierApi';
import { ShimmerKpiGrid, ShimmerTable } from '../../components/supplier/Shimmer';

export default function SupplierAccounting() {
    const [activeTab, setActiveTab] = useState('ar');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [currency, setCurrency] = useState('SAR');
    const [arRows, setArRows] = useState([]);
    const [apRows, setApRows] = useState([]);
    const [trialRows, setTrialRows] = useState([]);
    const [cashInBank, setCashInBank] = useState(0);
    const [expensesTotal, setExpensesTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [apiError, setApiError] = useState('');

    const totalAR = useMemo(() => arRows.reduce((s, r) => s + Number(r.balance || 0), 0), [arRows]);
    const totalAP = useMemo(() => apRows.reduce((s, r) => s + Number(r.balance || 0), 0), [apRows]);
    const netPL = totalAR - totalAP - expensesTotal;
    const trialDebitTotal = cashInBank + totalAR;
    const trialCreditTotal = totalAP + totalAR;
    const trialBalanceDifference = Math.abs(trialDebitTotal - trialCreditTotal);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setApiError('');
            try {
                const tabMap = {
                    ar: 'receivables',
                    ap: 'payables',
                    tb: 'trial_balance',
                };
                const res = await getSupplierAccountingScreen({
                    tab: tabMap[activeTab] || 'receivables',
                    dateFrom: dateFrom || undefined,
                    dateTo: dateTo || undefined,
                    limit: 200,
                    offset: 0,
                });
                if (cancelled) return;
                const cards = res?.cards || {};
                setCurrency(res?.currencyCode || 'SAR');
                setCashInBank(Number(cards?.cashInBankBalance || 0));
                const accountsReceivable = Number(cards?.accountsReceivable || 0);
                const accountsPayable = Number(cards?.accountsPayable || 0);
                const netPlFromApi = Number(cards?.netPL || 0);
                setExpensesTotal(Math.max(0, accountsReceivable - accountsPayable - netPlFromApi));

                const receivables = Array.isArray(res?.tabs?.receivables) ? res.tabs.receivables : [];
                const payables = Array.isArray(res?.tabs?.payables) ? res.tabs.payables : [];
                const trial = Array.isArray(res?.tabs?.trialBalance) ? res.tabs.trialBalance : [];
                setArRows(
                    receivables.map((r) => ({
                        id: r.invoiceNo || r.invoiceId,
                        workshop: r.workshopName || '-',
                        invoiceDate: r.invoiceDate || '-',
                        dueDate: r.dueDate || '-',
                        total: Number(r.total || 0),
                        paid: Number(r.paid || 0),
                        balance: Number(r.balance || 0),
                        status: r.status || 'unpaid',
                        days: Number.isFinite(Number(r.daysOutstanding)) ? Number(r.daysOutstanding) : '-',
                    })),
                );
                setApRows(
                    payables.map((p) => ({
                        id: p.id,
                        vendor: p.companyName || '-',
                        invoiceDate: p.createdAt ? String(p.createdAt).slice(0, 10) : '-',
                        dueDate: p.createdAt ? String(p.createdAt).slice(0, 10) : '-',
                        total: Number(p.openingBalance || 0),
                        paid: 0,
                        balance: Number(p.openingBalance || 0),
                        status: 'pending',
                        days: '-',
                    })),
                );
                setTrialRows(trial);
            } catch (err) {
                console.error('Supplier accounting report failed:', err);
                if (!cancelled) setApiError(err?.message || 'Failed to load accounting data');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [activeTab, dateFrom, dateTo]);

    return (
        <div>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">Accounting</h2>
                    <p className="ws-page-sub">Receivables, payables & basic reports</p>
                </div>
            </div>

            {apiError ? (
                <div
                    className="ws-section"
                    style={{
                        marginBottom: 12,
                        padding: 12,
                        background: '#FEF2F2',
                        border: '1px solid #FECACA',
                        color: '#B91C1C',
                        borderRadius: 12,
                        fontSize: '0.875rem',
                    }}
                >
                    <strong>Could not load accounting data:</strong> {apiError}
                </div>
            ) : null}

            {loading && !apiError ? (
                <>
                    <ShimmerKpiGrid cards={4} />
                    <ShimmerTable rows={12} columns={9} />
                </>
            ) : (
            <>
            <div className="ws-kpi-grid">
                {[
                    {
                        key: 'ar',
                        label: 'ACCOUNTS RECEIVABLE',
                        value: `${currency} ${totalAR.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                        Icon: FileText,
                    },
                    {
                        key: 'ap',
                        label: 'ACCOUNTS PAYABLE',
                        value: `${currency} ${totalAP.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                        Icon: ShoppingCart,
                    },
                    {
                        key: 'cash',
                        label: 'CASH IN BANK BALANCE',
                        value: `${currency} ${cashInBank.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                        Icon: DollarSign,
                    },
                    {
                        key: 'pl',
                        label: 'NET P&L (EST.)',
                        value: `${currency} ${netPL.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                        Icon: BarChart3,
                    },
                ].map(({ key, label, value, Icon }) => (
                    <div key={key} className="ws-kpi-card">
                        <div>
                            <p className="ws-kpi-label">{label}</p>
                            <p className="ws-kpi-value">{value}</p>
                        </div>
                        <div className="ws-kpi-icon ws-kpi-icon--dark">
                            <Icon size={22} />
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'inline-flex', gap: 4, padding: 4, borderRadius: 999, background: '#F3F4F6' }}>
                    {[
                        { id: 'ar', label: 'Receivables (AR)' },
                        { id: 'ap', label: 'Payables (AP)' },
                        { id: 'pl', label: 'P&L Statement' },
                        { id: 'tb', label: 'Trial Balance' },
                    ].map(t => (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => setActiveTab(t.id)}
                            style={{
                                padding: '8px 14px',
                                borderRadius: 999,
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '0.8125rem',
                                fontWeight: activeTab === t.id ? 700 : 500,
                                background: activeTab === t.id ? '#FFFFFF' : 'transparent',
                                color: activeTab === t.id ? '#111827' : '#6B7280',
                                boxShadow: activeTab === t.id ? '0 1px 2px rgba(15,23,42,0.08)' : 'none',
                            }}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Date From</label>
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={e => setDateFrom(e.target.value)}
                        style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: '0.8125rem' }}
                    />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Date To</label>
                    <input
                        type="date"
                        value={dateTo}
                        onChange={e => setDateTo(e.target.value)}
                        style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: '0.8125rem' }}
                    />
                </div>
            </div>

            {activeTab === 'ar' && (
                <div className="ws-section" style={{ paddingTop: 12 }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '0 0 8px 0' }}>Accounts Receivable (AR)</p>
                    <table className="ws-table">
                        <thead>
                            <tr>
                                <th>Invoice #</th>
                                <th>Workshop</th>
                                <th>Invoice Date</th>
                                <th>Due Date</th>
                                <th>Total</th>
                                <th>Paid</th>
                                <th>Balance</th>
                                <th>Status</th>
                                <th>Days Outstanding</th>
                            </tr>
                        </thead>
                        <tbody>
                            {arRows.map(row => (
                                <tr key={row.id}>
                                    <td><button type="button" style={{ border: 'none', background: 'none', color: '#2563EB', fontSize: '0.8125rem', cursor: 'pointer', textDecoration: 'underline' }}>{row.id}</button></td>
                                    <td>{row.workshop}</td>
                                    <td>{row.invoiceDate}</td>
                                    <td>{row.dueDate}</td>
                                    <td>{currency} {row.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                    <td>{currency} {row.paid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                    <td style={{ color: '#DC2626', fontWeight: 700 }}>{currency} {row.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                    <td><span className="ws-badge ws-badge--yellow">{row.status}</span></td>
                                    <td>{row.days}</td>
                                </tr>
                            ))}
                            <tr>
                                <td colSpan={4} style={{ fontWeight: 700, textAlign: 'right' }}>TOTALS</td>
                                <td>{currency} {arRows.reduce((s, r) => s + r.total, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                <td>{currency} 0.00</td>
                                <td style={{ color: '#DC2626', fontWeight: 700 }}>{currency} {totalAR.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                <td colSpan={2}></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'ap' && (
                <div className="ws-section">
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '0 0 8px 0' }}>Accounts Payable (AP)</p>
                    <table className="ws-table">
                        <thead>
                            <tr>
                                <th>Invoice #</th>
                                <th>Vendor</th>
                                <th>Invoice Date</th>
                                <th>Due Date</th>
                                <th>Total</th>
                                <th>Paid</th>
                                <th>Balance</th>
                                <th>Status</th>
                                <th>Days Outstanding</th>
                            </tr>
                        </thead>
                        <tbody>
                            {apRows.length === 0 ? (
                                <tr>
                                    <td colSpan={9} style={{ textAlign: 'center', padding: 32, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                                        No records found.
                                    </td>
                                </tr>
                            ) : (
                                apRows.map((row) => (
                                    <tr key={row.id}>
                                        <td>{row.id}</td>
                                        <td>{row.vendor}</td>
                                        <td>{row.invoiceDate}</td>
                                        <td>{row.dueDate}</td>
                                        <td>{currency} {row.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                        <td>{currency} {row.paid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                        <td style={{ color: '#DC2626', fontWeight: 700 }}>{currency} {row.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                        <td><span className="ws-badge ws-badge--yellow">{row.status}</span></td>
                                        <td>{row.days}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'pl' && (
                <div className="ws-section">
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '0 0 8px 0' }}>Profit &amp; Loss Statement</p>
                    <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid #E5E7EB' }}>
                        <div style={{ background: '#ECFDF3', padding: '16px 20px' }}>
                            <p style={{ fontWeight: 700, margin: 0 }}>Revenue</p>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                                <span style={{ fontSize: '0.875rem' }}>Total Sales (from Sales Invoices)</span>
                                <span style={{ fontWeight: 700 }}>{currency} {totalAR.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, borderTop: '1px solid #BBF7D0', paddingTop: 8 }}>
                                <span style={{ fontWeight: 700 }}>Total Revenue</span>
                                <span style={{ fontWeight: 800 }}>{currency} {totalAR.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                        <div style={{ background: '#FEF2F2', padding: '16px 20px' }}>
                            <p style={{ fontWeight: 700, margin: 0 }}>Expenses &amp; Cost</p>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                                <span style={{ fontSize: '0.875rem' }}>Total Purchases (Cost of Goods)</span>
                                <span>{currency} {totalAP.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                                <span style={{ fontSize: '0.875rem' }}>Operational Expenses</span>
                                <span>{currency} {expensesTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, borderTop: '1px solid #FECACA', paddingTop: 8 }}>
                                <span style={{ fontWeight: 700 }}>Total Expenses</span>
                                <span style={{ fontWeight: 800 }}>{currency} {(totalAP + expensesTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                        <div style={{ background: '#ECFEFF', padding: '16px 20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontWeight: 800 }}>Net Profit / Loss</span>
                                <span style={{ fontWeight: 900, color: '#16A34A' }}>{currency} {netPL.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'tb' && (
                <div className="ws-section">
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '0 0 8px 0' }}>Trial Balance</p>
                    <table className="ws-table">
                        <thead>
                            <tr>
                                <th>Account</th>
                                <th>Debit (SAR)</th>
                                <th>Credit (SAR)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(trialRows.length ? trialRows : [
                                { account: 'Cash & Bank Accounts', debit: cashInBank, credit: 0 },
                                { account: 'Accounts Receivable (AR)', debit: totalAR, credit: 0 },
                                { account: 'Accounts Payable (AP)', debit: 0, credit: totalAP },
                            ]).map((row) => (
                                <tr key={row.account}>
                                    <td>{row.account}</td>
                                    <td>{row.debit ? `${currency} ${Number(row.debit).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}</td>
                                    <td>{row.credit ? `${currency} ${Number(row.credit).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}</td>
                                </tr>
                            ))}
                            <tr>
                                <td style={{ fontWeight: 700 }}>Total</td>
                                <td style={{ fontWeight: 700 }}>{currency} {(cashInBank + totalAR).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                <td style={{ fontWeight: 700 }}>{currency} {(totalAP + totalAR).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            </tr>
                        </tbody>
                    </table>
                    {trialBalanceDifference > 0.005 ? (
                        <div style={{ marginTop: 8, fontSize: '0.75rem', color: '#DC2626', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>⚠</span>
                            <span>
                                Trial balance difference: {currency}{' '}
                                {trialBalanceDifference.toLocaleString(undefined, { minimumFractionDigits: 2 })} — debits and credits do not match this simplified view.
                            </span>
                        </div>
                    ) : null}
                </div>
            )}

            {activeTab !== 'ar' && activeTab !== 'ap' && activeTab !== 'pl' && activeTab !== 'tb' && (
                <div className="ws-section" style={{ textAlign: 'center', padding: 40 }}>
                    <BookOpen size={40} style={{ opacity: 0.3, margin: '0 auto 12px', display: 'block' }} />
                    <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Select a tab above to view details.</p>
                </div>
            )}
            </>
            )}
        </div>
    );
}
