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
                        {data.isBalanced
                            ? '✓ Balanced'
                            : `⚠ Out of balance by ${money(Math.abs(data.difference ?? data.totalDebits - data.totalCredits))}`}
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

function CashFlowInsights({ insights }) {
    const list = Array.isArray(insights) ? insights : [];
    if (!list.length) return null;
    const tone = {
        success: { bg: '#ECFDF5', border: '#A7F3D0', title: '#065F46' },
        warning: { bg: '#FFFBEB', border: '#FDE68A', title: '#B45309' },
        info: { bg: '#EFF6FF', border: '#BFDBFE', title: '#1D4ED8' },
    };
    return (
        <div style={{ marginBottom: 16 }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 800, color: '#0F172A' }}>
                Performance insights
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {list.map((item, i) => {
                    const t = tone[item.severity] || tone.info;
                    return (
                        <div
                            key={i}
                            style={{
                                padding: '10px 12px',
                                borderRadius: 10,
                                border: `1px solid ${t.border}`,
                                background: t.bg,
                            }}
                        >
                            <div style={{ fontWeight: 800, fontSize: 12, color: t.title }}>
                                {item.title}
                            </div>
                            <div style={{ fontSize: 12, color: '#334155', marginTop: 4 }}>
                                {item.message}
                            </div>
                            {item.action ? (
                                <div style={{ fontSize: 11, color: '#64748B', marginTop: 6, fontStyle: 'italic' }}>
                                    Suggested action: {item.action}
                                </div>
                            ) : null}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function IndirectCashFlowSection({ indirect }) {
    if (!indirect) return null;
    const lineRow = (label, amount, bold = false) => (
        <div
            style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '4px 0',
                fontWeight: bold ? 800 : 500,
                fontSize: 13,
            }}
        >
            <span style={{ color: '#475569' }}>{label}</span>
            <span style={{ color: amount >= 0 ? '#065F46' : '#B91C1C' }}>
                {amount < 0 ? `(${money(Math.abs(amount))})` : money(amount)}
            </span>
        </div>
    );
    return (
        <div>
            <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 800 }}>Cash flows from operating activities</h4>
            {lineRow('Net income (from Profit & Loss)', indirect.netIncome)}
            {(indirect.adjustments ?? []).map((a, i) => (
                <div key={`adj-${i}`}>{lineRow(a.label, a.amount)}</div>
            ))}
            {(indirect.workingCapitalChanges ?? []).length > 0 ? (
                <>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', margin: '8px 0 4px' }}>
                        Changes in working capital
                    </div>
                    {indirect.workingCapitalChanges.map((w, i) => (
                        <div key={`wc-${i}`}>{lineRow(w.label, w.amount)}</div>
                    ))}
                </>
            ) : null}
            <div style={{ borderTop: '1px solid #E2E8F0', marginTop: 8, paddingTop: 6 }}>
                {lineRow('Net cash from operating activities', indirect.netCashFromOperating, true)}
            </div>
            {Math.abs(indirect.reconciliationDifference ?? 0) > 0.5 ? (
                <p style={{ fontSize: 11, color: '#64748B', margin: '6px 0 0' }}>
                    Reconciliation vs direct operating total: {money(indirect.directOperatingNet)} (difference{' '}
                    {money(indirect.reconciliationDifference)})
                </p>
            ) : null}

            <h4 style={{ margin: '16px 0 8px', fontSize: 13, fontWeight: 800 }}>Cash flows from investing activities</h4>
            {lineRow(indirect.investing?.description || 'Net investing', indirect.investing?.net ?? 0, true)}

            <h4 style={{ margin: '16px 0 8px', fontSize: 13, fontWeight: 800 }}>Cash flows from financing activities</h4>
            {lineRow(indirect.financing?.description || 'Net financing', indirect.financing?.net ?? 0, true)}
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
    const [method, setMethod] = useState('direct');
    const [{ dateFrom, dateTo }, setRange] = useState({
        dateFrom: startOfMonthISO(),
        dateTo: todayISO(),
    });

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const res = await getSupplierCashFlow({ dateFrom, dateTo, method });
            setData(res);
        } catch (e) {
            setErr(e?.message || 'Failed to load cash flow');
        } finally {
            setLoading(false);
        }
    }, [dateFrom, dateTo, method]);

    useEffect(() => {
        load();
    }, [load]);

    const isIndirect = data?.method === 'indirect';

    return (
        <div>
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-end',
                    marginBottom: 12,
                    flexWrap: 'wrap',
                    gap: 10,
                }}
            >
                <DateRangePicker dateFrom={dateFrom} dateTo={dateTo} onChange={setRange} />
                <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, marginBottom: 4 }}>
                        Cash flow method
                    </div>
                    <select
                        style={{ ...inputStyle, minWidth: 200 }}
                        value={method}
                        onChange={(e) => setMethod(e.target.value)}
                    >
                        <option value="direct">Direct method</option>
                        <option value="indirect">Indirect method</option>
                    </select>
                </div>
            </div>
            <p style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>
                {isIndirect
                    ? 'Indirect method — starts with net income, then adjusts for working capital (AR, inventory, AP, VAT) to explain cash from operations.'
                    : 'Direct method — lists actual cash receipts and payments on bank/cash accounts by activity.'}
            </p>
            <AcctError message={err} />
            {loading ? (
                <AcctLoading />
            ) : !data ? (
                <AcctEmpty message="No data" />
            ) : (
                <div>
                    <CashFlowInsights insights={data.insights} />
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px 0',
                            borderBottom: '1px solid #E2E8F0',
                            marginBottom: 12,
                        }}
                    >
                        <span style={{ fontSize: 13, color: '#475569' }}>Opening cash</span>
                        <span style={{ fontWeight: 700 }}>{money(data.openingCash)}</span>
                    </div>
                    {isIndirect ? (
                        <IndirectCashFlowSection indirect={data.indirect} />
                    ) : (
                        <>
                            <CashFlowBucket
                                title="Operating Activities"
                                bucket={data.operating}
                                onCashLineClick={openLedger}
                            />
                            <CashFlowBucket
                                title="Investing Activities"
                                bucket={data.investing}
                                onCashLineClick={openLedger}
                            />
                            <CashFlowBucket
                                title="Financing Activities"
                                bucket={data.financing}
                                onCashLineClick={openLedger}
                            />
                        </>
                    )}
                    <div
                        style={{
                            padding: '8px 0',
                            borderTop: '1px solid #E2E8F0',
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontWeight: 700,
                        }}
                    >
                        <span>Net change in cash</span>
                        <span
                            style={{
                                color: data.netChange >= 0 ? '#065F46' : '#B91C1C',
                            }}
                        >
                            {money(data.netChange)}
                        </span>
                    </div>
                    <div
                        style={{
                            padding: '10px 0',
                            borderTop: '2px solid #0F172A',
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontWeight: 800,
                            fontSize: 16,
                        }}
                    >
                        <span>Closing cash</span>
                        <span>{money(data.closingCash)}</span>
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
