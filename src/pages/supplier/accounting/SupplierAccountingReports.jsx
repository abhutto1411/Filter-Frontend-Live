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
    inputStyle,
    money,
    outlineBtnStyle,
    primaryBtnStyle,
    startOfMonthISO,
    todayISO,
} from './SupplierAccountingShared';
import { saccT } from '../../../utils/supplierAccountingI18n';

const REPORT_TAB_KEYS = [
    { id: 'tb', key: 'reports.tab.tb' },
    { id: 'pl', key: 'reports.tab.pl' },
    { id: 'bs', key: 'reports.tab.bs' },
    { id: 'cf', key: 'reports.tab.cf' },
];

function DateRangePicker({ dateFrom, dateTo, onChange, t }) {
    return (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <Field label={t('reports.from')}><input type="date" style={inputStyle} value={dateFrom} onChange={(e) => onChange({ dateFrom: e.target.value, dateTo })} /></Field>
            <Field label={t('reports.to')}><input type="date" style={inputStyle} value={dateTo} onChange={(e) => onChange({ dateFrom, dateTo: e.target.value })} /></Field>
            <button type="button" style={outlineBtnStyle} onClick={() => onChange({ dateFrom: '', dateTo: '' })}>{t('reports.allTime')}</button>
            <button type="button" style={outlineBtnStyle} onClick={() => onChange({ dateFrom: startOfMonthISO(), dateTo: todayISO() })}>{t('reports.thisMonth')}</button>
        </div>
    );
}

const CLICKABLE_ROW = {
    cursor: 'pointer',
};

function TrialBalance({ locale, t }) {
    const m = (v) => money(v, 'SAR', { locale });
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
            setErr(e?.message || t('reports.err.tb'));
        } finally {
            setLoading(false);
        }
    }, [dateFrom, dateTo, t]);

    useEffect(() => { load(); }, [load]);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                <DateRangePicker dateFrom={dateFrom} dateTo={dateTo} onChange={setRange} t={t} />
            </div>
            <AcctError message={err} />
            {loading ? <AcctLoading locale={locale} /> : !data ? <AcctEmpty message={t('reports.noData')} /> : (
                <div style={{ overflowX: 'auto' }}>
                    <table className="ws-table" style={{ width: '100%' }}>
                        <thead><tr><th>{t('reports.th.code')}</th><th>{t('reports.th.account')}</th><th>{t('reports.th.type')}</th><th style={{ textAlign: 'right' }}>{t('reports.th.debit')}</th><th style={{ textAlign: 'right' }}>{t('reports.th.credit')}</th></tr></thead>
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
                                    <td style={{ textAlign: 'right' }}>{a.debitBalance > 0 ? m(a.debitBalance) : t('emdash')}</td>
                                    <td style={{ textAlign: 'right' }}>{a.creditBalance > 0 ? m(a.creditBalance) : t('emdash')}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={3} style={{ textAlign: 'right', fontWeight: 800 }}>{t('reports.totals')}</td>
                                <td style={{ textAlign: 'right', fontWeight: 800 }}>{m(data.totalDebits)}</td>
                                <td style={{ textAlign: 'right', fontWeight: 800 }}>{m(data.totalCredits)}</td>
                            </tr>
                        </tfoot>
                    </table>
                    <p style={{ marginTop: 12, fontSize: 12, fontWeight: 700, color: data.isBalanced ? '#065F46' : '#B91C1C' }}>
                        {data.isBalanced
                            ? t('reports.balanced')
                            : t('reports.outOfBalance', { amount: m(Math.abs(data.difference ?? data.totalDebits - data.totalCredits)) })}
                    </p>
                </div>
            )}
        </div>
    );
}

function ReportSection({ title, rows, total, onAccountClick, locale, t, totalLabel }) {
    const m = (v) => money(v, 'SAR', { locale });
    return (
        <div style={{ marginBottom: 14 }}>
            <h4 style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 800, color: '#0F172A' }}>{title}</h4>
            {rows.length === 0 ? <div style={{ fontSize: 12, color: '#64748B' }}>{t('emdash')}</div> : (
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
                                <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600 }}>{m(r.amount)}</td>
                            </tr>
                        ))}
                    </tbody>
                    {total != null ? (
                        <tfoot>
                            <tr style={{ borderTop: '1px solid #E2E8F0' }}>
                                <td style={{ padding: '6px 0', fontWeight: 800 }}>{totalLabel || t('reports.totalOf', { title: title.toLowerCase() })}</td>
                                <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 800 }}>{m(total)}</td>
                            </tr>
                        </tfoot>
                    ) : null}
                </table>
            )}
        </div>
    );
}

function ProfitLoss({ locale, t }) {
    const m = (v) => money(v, 'SAR', { locale });
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
            setErr(e?.message || t('reports.err.pl'));
        } finally {
            setLoading(false);
        }
    }, [dateFrom, dateTo, t]);

    useEffect(() => { load(); }, [load]);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                <DateRangePicker dateFrom={dateFrom} dateTo={dateTo} onChange={setRange} t={t} />
            </div>
            <AcctError message={err} />
            {loading ? <AcctLoading locale={locale} /> : !data ? <AcctEmpty message={t('reports.noData')} /> : (
                <div>
                    <ReportSection title={t('reports.revenue')} rows={data.revenue} total={data.totalRevenue} onAccountClick={openLedger} locale={locale} t={t} />
                    <ReportSection title={t('reports.cogs')} rows={data.costOfGoodsSold} total={data.totalCOGS} onAccountClick={openLedger} locale={locale} t={t} />
                    <div style={{ padding: '8px 0', borderTop: '2px solid #0F172A', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                        <span>{t('reports.grossProfit')}</span><span>{m(data.grossProfit)}</span>
                    </div>
                    <div style={{ height: 12 }} />
                    <ReportSection title={t('reports.opEx')} rows={data.operatingExpenses} total={data.totalOperatingExpenses} onAccountClick={openLedger} locale={locale} t={t} />
                    {data.otherExpenses.length > 0 && <ReportSection title={t('reports.otherEx')} rows={data.otherExpenses} total={data.totalOtherExpenses} onAccountClick={openLedger} locale={locale} t={t} />}
                    <div style={{ padding: '12px 0', borderTop: '2px solid #0F172A', display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 16, color: data.netIncome >= 0 ? '#065F46' : '#B91C1C' }}>
                        <span>{t('reports.netIncome')}</span><span>{m(data.netIncome)}</span>
                    </div>
                </div>
            )}
        </div>
    );
}

function BalanceSheet({ locale, t }) {
    const m = (v) => money(v, 'SAR', { locale });
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
            setErr(e?.message || t('reports.err.bs'));
        } finally {
            setLoading(false);
        }
    }, [asOf, t]);

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
                                <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600 }}>{m(a.amount)}</td>
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
                <Field label={t('reports.asOf')}><input type="date" style={inputStyle} value={asOf} onChange={(e) => setAsOf(e.target.value)} /></Field>
            </div>
            <AcctError message={err} />
            {loading ? <AcctLoading locale={locale} /> : !data ? <AcctEmpty message={t('reports.noData')} /> : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
                    <div>
                        {renderBucket(t('reports.currentAssets'), data.assets.current)}
                        {renderBucket(t('reports.fixedAssets'), data.assets.fixed)}
                        {renderBucket(t('reports.otherAssets'), data.assets.other)}
                        <div style={{ padding: '10px 0', borderTop: '2px solid #0F172A', display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                            <span>{t('reports.totalAssets')}</span><span>{m(data.assets.total)}</span>
                        </div>
                    </div>
                    <div>
                        {renderBucket(t('reports.currentLiab'), data.liabilities.current)}
                        {renderBucket(t('reports.longTermLiab'), data.liabilities.longTerm)}
                        {renderBucket(t('reports.otherLiab'), data.liabilities.other)}
                        <div style={{ padding: '8px 0', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                            <span>{t('reports.totalLiab')}</span><span>{m(data.liabilities.total)}</span>
                        </div>
                        <div style={{ height: 12 }} />
                        <h4 style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 800, color: '#0F172A' }}>{t('reports.equity')}</h4>
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
                                        <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600 }}>{m(a.amount)}</td>
                                    </tr>
                                ))}
                                <tr>
                                    <td style={{ padding: '4px 0', color: '#475569' }}>{t('reports.cumNetIncome')}</td>
                                    <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600 }}>{m(data.equity.cumulativeNetIncome)}</td>
                                </tr>
                            </tbody>
                        </table>
                        <div style={{ padding: '8px 0', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                            <span>{t('reports.totalEquity')}</span><span>{m(data.equity.total)}</span>
                        </div>
                        <div style={{ padding: '10px 0', borderTop: '2px solid #0F172A', display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                            <span>{t('reports.totalLiabEquity')}</span><span>{m(data.totalLiabilitiesAndEquity)}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function CashFlowBucket({ title, bucket, onCashLineClick, locale, t }) {
    const m = (v) => money(v, 'SAR', { locale });
    if (!bucket) return null;
    return (
        <div style={{ marginBottom: 12 }}>
            <h4 style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 800, color: '#0F172A' }}>{title}</h4>
            {bucket.inflows.length === 0 && bucket.outflows.length === 0 ? (
                <div style={{ fontSize: 12, color: '#64748B' }}>{t('reports.noActivity')}</div>
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
                                <td style={{ padding: '3px 0', textAlign: 'right', fontWeight: 600 }}>{m(r.amount)}</td>
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
                                <td style={{ padding: '3px 0', textAlign: 'right', fontWeight: 600 }}>({m(r.amount)})</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr style={{ borderTop: '1px solid #E2E8F0' }}>
                            <td style={{ padding: '6px 0', fontWeight: 800 }}>{t('reports.netOf', { title: title.toLowerCase() })}</td>
                            <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 800, color: bucket.net >= 0 ? '#065F46' : '#B91C1C' }}>{m(bucket.net)}</td>
                        </tr>
                    </tfoot>
                </table>
            )}
        </div>
    );
}

function CashFlowInsights({ insights, t }) {
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
                {t('reports.insights')}
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
                                    {t('reports.suggestedAction', { action: item.action })}
                                </div>
                            ) : null}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function IndirectCashFlowSection({ indirect, locale, t }) {
    const m = (v) => money(v, 'SAR', { locale });
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
                {amount < 0 ? `(${m(Math.abs(amount))})` : m(amount)}
            </span>
        </div>
    );
    return (
        <div>
            <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 800 }}>{t('reports.cfOperating')}</h4>
            {lineRow(t('reports.netIncomeFromPl'), indirect.netIncome)}
            {(indirect.adjustments ?? []).map((a, i) => (
                <div key={`adj-${i}`}>{lineRow(a.label, a.amount)}</div>
            ))}
            {(indirect.workingCapitalChanges ?? []).length > 0 ? (
                <>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', margin: '8px 0 4px' }}>
                        {t('reports.wcChanges')}
                    </div>
                    {indirect.workingCapitalChanges.map((w, i) => (
                        <div key={`wc-${i}`}>{lineRow(w.label, w.amount)}</div>
                    ))}
                </>
            ) : null}
            <div style={{ borderTop: '1px solid #E2E8F0', marginTop: 8, paddingTop: 6 }}>
                {lineRow(t('reports.netCashOperating'), indirect.netCashFromOperating, true)}
            </div>
            {Math.abs(indirect.reconciliationDifference ?? 0) > 0.5 ? (
                <p style={{ fontSize: 11, color: '#64748B', margin: '6px 0 0' }}>
                    {t('reports.reconVsDirect', { direct: m(indirect.directOperatingNet), diff: m(indirect.reconciliationDifference) })}
                </p>
            ) : null}

            <h4 style={{ margin: '16px 0 8px', fontSize: 13, fontWeight: 800 }}>{t('reports.cfInvesting')}</h4>
            {lineRow(indirect.investing?.description || t('reports.netInvesting'), indirect.investing?.net ?? 0, true)}

            <h4 style={{ margin: '16px 0 8px', fontSize: 13, fontWeight: 800 }}>{t('reports.cfFinancing')}</h4>
            {lineRow(indirect.financing?.description || t('reports.netFinancing'), indirect.financing?.net ?? 0, true)}
        </div>
    );
}

function CashFlow({ locale, t }) {
    const m = (v) => money(v, 'SAR', { locale });
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
            setErr(e?.message || t('reports.err.cf'));
        } finally {
            setLoading(false);
        }
    }, [dateFrom, dateTo, method, t]);

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
                <DateRangePicker dateFrom={dateFrom} dateTo={dateTo} onChange={setRange} t={t} />
                <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, marginBottom: 4 }}>
                        {t('reports.cfMethod')}
                    </div>
                    <select
                        style={{ ...inputStyle, minWidth: 200 }}
                        value={method}
                        onChange={(e) => setMethod(e.target.value)}
                    >
                        <option value="direct">{t('reports.directMethod')}</option>
                        <option value="indirect">{t('reports.indirectMethod')}</option>
                    </select>
                </div>
            </div>
            <p style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>
                {isIndirect
                    ? t('reports.indirectHint')
                    : t('reports.directHint')}
            </p>
            <AcctError message={err} />
            {loading ? (
                <AcctLoading locale={locale} />
            ) : !data ? (
                <AcctEmpty message={t('reports.noData')} />
            ) : (
                <div>
                    <CashFlowInsights insights={data.insights} t={t} />
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
                        <span style={{ fontSize: 13, color: '#475569' }}>{t('reports.openingCash')}</span>
                        <span style={{ fontWeight: 700 }}>{m(data.openingCash)}</span>
                    </div>
                    {isIndirect ? (
                        <IndirectCashFlowSection indirect={data.indirect} locale={locale} t={t} />
                    ) : (
                        <>
                            <CashFlowBucket
                                title={t('reports.operatingAct')}
                                bucket={data.operating}
                                onCashLineClick={openLedger}
                                locale={locale}
                                t={t}
                            />
                            <CashFlowBucket
                                title={t('reports.investingAct')}
                                bucket={data.investing}
                                onCashLineClick={openLedger}
                                locale={locale}
                                t={t}
                            />
                            <CashFlowBucket
                                title={t('reports.financingAct')}
                                bucket={data.financing}
                                onCashLineClick={openLedger}
                                locale={locale}
                                t={t}
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
                        <span>{t('reports.netChangeCash')}</span>
                        <span
                            style={{
                                color: data.netChange >= 0 ? '#065F46' : '#B91C1C',
                            }}
                        >
                            {m(data.netChange)}
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
                        <span>{t('reports.closingCash')}</span>
                        <span>{m(data.closingCash)}</span>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function SupplierAccountingReports({ initialTab = 'tb', locale: localeProp }) {
    const locale =
        localeProp ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => saccT(locale, key, vars), [locale]);
    const [tab, setTab] = useState(initialTab);
    return (
        <div style={{ padding: 4 }}>
            <AcctCard
                title={t('reports.title')}
                action={(
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {REPORT_TAB_KEYS.map((item) => (
                            <button key={item.id} type="button" style={tab === item.id ? primaryBtnStyle : outlineBtnStyle} onClick={() => setTab(item.id)}>
                                {t(item.key)}
                            </button>
                        ))}
                    </div>
                )}
            >
                {tab === 'tb' && <TrialBalance locale={locale} t={t} />}
                {tab === 'pl' && <ProfitLoss locale={locale} t={t} />}
                {tab === 'bs' && <BalanceSheet locale={locale} t={t} />}
                {tab === 'cf' && <CashFlow locale={locale} t={t} />}
            </AcctCard>
        </div>
    );
}
