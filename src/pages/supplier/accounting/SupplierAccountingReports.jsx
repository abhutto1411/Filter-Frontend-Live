import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    getSupplierBalanceSheet,
    getSupplierCashFlow,
    getSupplierPnl,
    getSupplierTrialBalance,
} from '../../../services/supplierAccountingApi';
import {
    AcctCard,
    AcctEmpty,
    AcctError,
    AcctLoading,
    Field,
    fmtDate,
    inputStyle,
    money,
    outlineBtnStyle,
    primaryBtnStyle,
    startOfMonthISO,
    todayISO,
} from './SupplierAccountingShared';

const REPORT_TABS = [
    { id: 'tb', label: 'Trial Balance' },
    { id: 'pl', label: 'Profit & Loss' },
    { id: 'bs', label: 'Balance Sheet' },
    { id: 'cf', label: 'Cash Flow' },
];

function DateRangePicker({ dateFrom, dateTo, onChange }) {
    return (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <Field label="From"><input type="date" style={inputStyle} value={dateFrom} onChange={(e) => onChange({ dateFrom: e.target.value, dateTo })} /></Field>
            <Field label="To"><input type="date" style={inputStyle} value={dateTo} onChange={(e) => onChange({ dateFrom, dateTo: e.target.value })} /></Field>
            <button type="button" style={outlineBtnStyle} onClick={() => onChange({ dateFrom: '', dateTo: '' })}>All time</button>
            <button type="button" style={outlineBtnStyle} onClick={() => onChange({ dateFrom: startOfMonthISO(), dateTo: todayISO() })}>This month</button>
        </div>
    );
}

const CLICKABLE_ROW = {
    cursor: 'pointer',
};

function TrialBalance() {
    const navigate = useNavigate();
    const openLedger = useCallback(
        (accountId) => {
            if (!accountId) return;
            navigate(
                `/supplier/accounting/coa?openLedgerAccountId=${encodeURIComponent(String(accountId))}`,
            );
        },
        [navigate],
    );
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [{ dateFrom, dateTo }, setRange] = useState({ dateFrom: '', dateTo: '' });

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const res = await getSupplierTrialBalance({ dateFrom, dateTo });
            setData(res);
        } catch (e) {
            setErr(e?.message || 'Failed to load trial balance');
        } finally {
            setLoading(false);
        }
    }, [dateFrom, dateTo]);

    useEffect(() => { load(); }, [load]);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                <DateRangePicker dateFrom={dateFrom} dateTo={dateTo} onChange={setRange} />
            </div>
            <AcctError message={err} />
            {loading ? <AcctLoading /> : !data ? <AcctEmpty message="No data" /> : (
                <div style={{ overflowX: 'auto' }}>
                    <table className="ws-table" style={{ width: '100%' }}>
                        <thead><tr><th>Code</th><th>Account</th><th>Type</th><th style={{ textAlign: 'right' }}>Debit</th><th style={{ textAlign: 'right' }}>Credit</th></tr></thead>
                        <tbody>
                            {data.accounts.map((a) => (
                                <tr
                                    key={a.accountId}
                                    role="button"
                                    tabIndex={0}
                                    style={CLICKABLE_ROW}
                                    onClick={() => openLedger(a.accountId)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            openLedger(a.accountId);
                                        }
                                    }}
                                >
                                    <td style={{ fontWeight: 700 }}>{a.code}</td>
                                    <td>{a.name}</td>
                                    <td>{a.type}</td>
                                    <td style={{ textAlign: 'right' }}>{a.debitBalance > 0 ? money(a.debitBalance) : '—'}</td>
                                    <td style={{ textAlign: 'right' }}>{a.creditBalance > 0 ? money(a.creditBalance) : '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={3} style={{ textAlign: 'right', fontWeight: 800 }}>Totals</td>
                                <td style={{ textAlign: 'right', fontWeight: 800 }}>{money(data.totalDebits)}</td>
                                <td style={{ textAlign: 'right', fontWeight: 800 }}>{money(data.totalCredits)}</td>
                            </tr>
                        </tfoot>
                    </table>
                    <p style={{ marginTop: 12, fontSize: 12, fontWeight: 700, color: data.isBalanced ? '#065F46' : '#B91C1C' }}>
                        {data.isBalanced ? '✓ Balanced' : '⚠ Out of balance — check recent entries'}
                    </p>
                </div>
            )}
        </div>
    );
}

function ReportSection({ title, rows, total, onAccountClick }) {
    return (
        <div style={{ marginBottom: 14 }}>
            <h4 style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 800, color: '#0F172A' }}>{title}</h4>
            {rows.length === 0 ? <div style={{ fontSize: 12, color: '#64748B' }}>—</div> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <tbody>
                        {rows.map((r) => (
                            <tr
                                key={r.id}
                                role={onAccountClick ? 'button' : undefined}
                                tabIndex={onAccountClick ? 0 : undefined}
                                style={onAccountClick ? CLICKABLE_ROW : undefined}
                                onClick={() => onAccountClick?.(r.id)}
                                onKeyDown={
                                    onAccountClick
                                        ? (e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                onAccountClick(r.id);
                                            }
                                        }
                                        : undefined
                                }
                            >
                                <td style={{ padding: '4px 0', color: '#475569' }}>[{r.code}] {r.name}</td>
                                <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600 }}>{money(r.amount)}</td>
                            </tr>
                        ))}
                    </tbody>
                    {total != null ? (
                        <tfoot>
                            <tr style={{ borderTop: '1px solid #E2E8F0' }}>
                                <td style={{ padding: '6px 0', fontWeight: 800 }}>Total {title.toLowerCase()}</td>
                                <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 800 }}>{money(total)}</td>
                            </tr>
                        </tfoot>
                    ) : null}
                </table>
            )}
        </div>
    );
}

function ProfitLoss() {
    const navigate = useNavigate();
    const openLedger = useCallback(
        (accountId) => {
            if (!accountId) return;
            navigate(
                `/supplier/accounting/coa?openLedgerAccountId=${encodeURIComponent(String(accountId))}`,
            );
        },
        [navigate],
    );
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [{ dateFrom, dateTo }, setRange] = useState({ dateFrom: startOfMonthISO(), dateTo: todayISO() });

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const res = await getSupplierPnl({ dateFrom, dateTo });
            setData(res);
        } catch (e) {
            setErr(e?.message || 'Failed to load P&L');
        } finally {
            setLoading(false);
        }
    }, [dateFrom, dateTo]);

    useEffect(() => { load(); }, [load]);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                <DateRangePicker dateFrom={dateFrom} dateTo={dateTo} onChange={setRange} />
            </div>
            <AcctError message={err} />
            {loading ? <AcctLoading /> : !data ? <AcctEmpty message="No data" /> : (
                <div>
                    <ReportSection title="Revenue" rows={data.revenue} total={data.totalRevenue} onAccountClick={openLedger} />
                    <ReportSection title="Cost of Goods Sold" rows={data.costOfGoodsSold} total={data.totalCOGS} onAccountClick={openLedger} />
                    <div style={{ padding: '8px 0', borderTop: '2px solid #0F172A', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                        <span>Gross Profit</span><span>{money(data.grossProfit)}</span>
                    </div>
                    <div style={{ height: 12 }} />
                    <ReportSection title="Operating Expenses" rows={data.operatingExpenses} total={data.totalOperatingExpenses} onAccountClick={openLedger} />
                    {data.otherExpenses.length > 0 && <ReportSection title="Other Expenses" rows={data.otherExpenses} total={data.totalOtherExpenses} onAccountClick={openLedger} />}
                    <div style={{ padding: '12px 0', borderTop: '2px solid #0F172A', display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 16, color: data.netIncome >= 0 ? '#065F46' : '#B91C1C' }}>
                        <span>Net Income</span><span>{money(data.netIncome)}</span>
                    </div>
                </div>
            )}
        </div>
    );
}

function BalanceSheet() {
    const navigate = useNavigate();
    const openLedger = useCallback(
        (accountId) => {
            if (!accountId) return;
            navigate(
                `/supplier/accounting/coa?openLedgerAccountId=${encodeURIComponent(String(accountId))}`,
            );
        },
        [navigate],
    );
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [asOf, setAsOf] = useState(todayISO());

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const res = await getSupplierBalanceSheet({ asOf });
            setData(res);
        } catch (e) {
            setErr(e?.message || 'Failed to load balance sheet');
        } finally {
            setLoading(false);
        }
    }, [asOf]);

    useEffect(() => { load(); }, [load]);

    function renderBucket(title, current, fixed, other) {
        const all = [...(current || []), ...(fixed || []), ...(other || [])];
        if (all.length === 0) return null;
        return (
            <div style={{ marginBottom: 12 }}>
                <h4 style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 800, color: '#0F172A' }}>{title}</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <tbody>
                        {all.map((a) => (
                            <tr
                                key={a.id}
                                role="button"
                                tabIndex={0}
                                style={CLICKABLE_ROW}
                                onClick={() => openLedger(a.id)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        openLedger(a.id);
                                    }
                                }}
                            >
                                <td style={{ padding: '4px 0', color: '#475569' }}>[{a.code}] {a.name}</td>
                                <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600 }}>{money(a.amount)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                <Field label="As of date"><input type="date" style={inputStyle} value={asOf} onChange={(e) => setAsOf(e.target.value)} /></Field>
            </div>
            <AcctError message={err} />
            {loading ? <AcctLoading /> : !data ? <AcctEmpty message="No data" /> : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
                    <div>
                        {renderBucket('Current Assets', data.assets.current)}
                        {renderBucket('Fixed Assets', data.assets.fixed)}
                        {renderBucket('Other Assets', data.assets.other)}
                        <div style={{ padding: '10px 0', borderTop: '2px solid #0F172A', display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                            <span>Total Assets</span><span>{money(data.assets.total)}</span>
                        </div>
                    </div>
                    <div>
                        {renderBucket('Current Liabilities', data.liabilities.current)}
                        {renderBucket('Long Term Liabilities', data.liabilities.longTerm)}
                        {renderBucket('Other Liabilities', data.liabilities.other)}
                        <div style={{ padding: '8px 0', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                            <span>Total Liabilities</span><span>{money(data.liabilities.total)}</span>
                        </div>
                        <div style={{ height: 12 }} />
                        <h4 style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 800, color: '#0F172A' }}>Equity</h4>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <tbody>
                                {data.equity.accounts.map((a) => (
                                    <tr
                                        key={a.id}
                                        role="button"
                                        tabIndex={0}
                                        style={CLICKABLE_ROW}
                                        onClick={() => openLedger(a.id)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                openLedger(a.id);
                                            }
                                        }}
                                    >
                                        <td style={{ padding: '4px 0', color: '#475569' }}>[{a.code}] {a.name}</td>
                                        <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600 }}>{money(a.amount)}</td>
                                    </tr>
                                ))}
                                <tr>
                                    <td style={{ padding: '4px 0', color: '#475569' }}>Cumulative Net Income</td>
                                    <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600 }}>{money(data.equity.cumulativeNetIncome)}</td>
                                </tr>
                            </tbody>
                        </table>
                        <div style={{ padding: '8px 0', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                            <span>Total Equity</span><span>{money(data.equity.total)}</span>
                        </div>
                        <div style={{ padding: '10px 0', borderTop: '2px solid #0F172A', display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                            <span>Total Liab. + Equity</span><span>{money(data.totalLiabilitiesAndEquity)}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function CashFlowBucket({ title, bucket, onCashLineClick }) {
    if (!bucket) return null;
    return (
        <div style={{ marginBottom: 12 }}>
            <h4 style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 800, color: '#0F172A' }}>{title}</h4>
            {bucket.inflows.length === 0 && bucket.outflows.length === 0 ? (
                <div style={{ fontSize: 12, color: '#64748B' }}>No activity</div>
            ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <tbody>
                        {bucket.inflows.map((r, i) => (
                            <tr
                                key={`in-${i}`}
                                role={onCashLineClick && r.accountId ? 'button' : undefined}
                                tabIndex={onCashLineClick && r.accountId ? 0 : undefined}
                                style={onCashLineClick && r.accountId ? CLICKABLE_ROW : undefined}
                                onClick={() => onCashLineClick?.(r.accountId)}
                                onKeyDown={
                                    onCashLineClick && r.accountId
                                        ? (e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                onCashLineClick(r.accountId);
                                            }
                                        }
                                        : undefined
                                }
                            >
                                <td style={{ padding: '3px 0', color: '#065F46' }}>↑ {r.description || r.journalType}</td>
                                <td style={{ padding: '3px 0', textAlign: 'right', fontWeight: 600 }}>{money(r.amount)}</td>
                            </tr>
                        ))}
                        {bucket.outflows.map((r, i) => (
                            <tr
                                key={`out-${i}`}
                                role={onCashLineClick && r.accountId ? 'button' : undefined}
                                tabIndex={onCashLineClick && r.accountId ? 0 : undefined}
                                style={onCashLineClick && r.accountId ? CLICKABLE_ROW : undefined}
                                onClick={() => onCashLineClick?.(r.accountId)}
                                onKeyDown={
                                    onCashLineClick && r.accountId
                                        ? (e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                onCashLineClick(r.accountId);
                                            }
                                        }
                                        : undefined
                                }
                            >
                                <td style={{ padding: '3px 0', color: '#B45309' }}>↓ {r.description || r.journalType}</td>
                                <td style={{ padding: '3px 0', textAlign: 'right', fontWeight: 600 }}>({money(r.amount)})</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr style={{ borderTop: '1px solid #E2E8F0' }}>
                            <td style={{ padding: '6px 0', fontWeight: 800 }}>Net {title.toLowerCase()}</td>
                            <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 800, color: bucket.net >= 0 ? '#065F46' : '#B91C1C' }}>{money(bucket.net)}</td>
                        </tr>
                    </tfoot>
                </table>
            )}
        </div>
    );
}

function CashFlow() {
    const navigate = useNavigate();
    const openLedger = useCallback(
        (accountId) => {
            if (!accountId) return;
            navigate(
                `/supplier/accounting/coa?openLedgerAccountId=${encodeURIComponent(String(accountId))}`,
            );
        },
        [navigate],
    );
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [{ dateFrom, dateTo }, setRange] = useState({ dateFrom: startOfMonthISO(), dateTo: todayISO() });

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const res = await getSupplierCashFlow({ dateFrom, dateTo });
            setData(res);
        } catch (e) {
            setErr(e?.message || 'Failed to load cash flow');
        } finally {
            setLoading(false);
        }
    }, [dateFrom, dateTo]);

    useEffect(() => { load(); }, [load]);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                <DateRangePicker dateFrom={dateFrom} dateTo={dateTo} onChange={setRange} />
            </div>
            <p style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>
                Direct method — cash movements on cash-equivalent accounts categorised by activity.
            </p>
            <AcctError message={err} />
            {loading ? <AcctLoading /> : !data ? <AcctEmpty message="No data" /> : (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #E2E8F0', marginBottom: 12 }}>
                        <span style={{ fontSize: 13, color: '#475569' }}>Opening cash</span>
                        <span style={{ fontWeight: 700 }}>{money(data.openingCash)}</span>
                    </div>
                    <CashFlowBucket title="Operating Activities" bucket={data.operating} onCashLineClick={openLedger} />
                    <CashFlowBucket title="Investing Activities" bucket={data.investing} onCashLineClick={openLedger} />
                    <CashFlowBucket title="Financing Activities" bucket={data.financing} onCashLineClick={openLedger} />
                    <div style={{ padding: '8px 0', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                        <span>Net change in cash</span>
                        <span style={{ color: data.netChange >= 0 ? '#065F46' : '#B91C1C' }}>{money(data.netChange)}</span>
                    </div>
                    <div style={{ padding: '10px 0', borderTop: '2px solid #0F172A', display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 16 }}>
                        <span>Closing cash</span><span>{money(data.closingCash)}</span>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function SupplierAccountingReports({ initialTab = 'tb' }) {
    const [tab, setTab] = useState(initialTab);
    return (
        <div style={{ padding: 4 }}>
            <AcctCard
                title="Financial Statements"
                action={(
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {REPORT_TABS.map((t) => (
                            <button key={t.id} type="button" style={tab === t.id ? primaryBtnStyle : outlineBtnStyle} onClick={() => setTab(t.id)}>
                                {t.label}
                            </button>
                        ))}
                    </div>
                )}
            >
                {tab === 'tb' && <TrialBalance />}
                {tab === 'pl' && <ProfitLoss />}
                {tab === 'bs' && <BalanceSheet />}
                {tab === 'cf' && <CashFlow />}
            </AcctCard>
        </div>
    );
}
