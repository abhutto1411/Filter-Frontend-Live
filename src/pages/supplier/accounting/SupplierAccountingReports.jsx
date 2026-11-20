import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    getSupplierApAging,
    getSupplierArAging,
    getSupplierBalanceSheet,
    getSupplierCashFlow,
    getSupplierGeneralLedger,
    getSupplierPnl,
    getSupplierTrialBalance,
} from '../../../services/supplierAccountingApi';
import { listSupplierGoodsReceipts } from '../../../services/supplierApi';
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
import SupplierReportsDateBar from '../SupplierReportsDateBar';
import SupplierRiyalAmount from '../SupplierRiyalAmount';
import { SUPPLIER_PERM, useSupplierCan } from '../../../utils/supplierPermissions';

const REPORT_TAB_KEYS = [
    { id: 'tb', key: 'reports.tab.tb' },
    { id: 'pl', key: 'reports.tab.pl' },
    { id: 'bs', key: 'reports.tab.bs' },
    { id: 'cf', key: 'reports.tab.cf' },
    { id: 'gl', key: 'reports.tab.gl' },
    { id: 'aging', key: 'reports.tab.aging' },
    { id: 'grni', key: 'reports.tab.grni' },
];

function ReportDateBar({ dateFrom, dateTo, onChange, locale }) {
    return (
        <SupplierReportsDateBar
            locale={locale}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onApply={(from, to) => onChange({ dateFrom: from, dateTo: to })}
        />
    );
}

const CLICKABLE_ROW = {
    cursor: 'pointer',
};

const TB6_COLUMNS = [
    { key: 'openingDebit', th: 'reports.tb6.th.openDr' },
    { key: 'openingCredit', th: 'reports.tb6.th.openCr' },
    { key: 'periodDebit', th: 'reports.tb6.th.periodDr' },
    { key: 'periodCredit', th: 'reports.tb6.th.periodCr' },
    { key: 'closingDebit', th: 'reports.tb6.th.closeDr' },
    { key: 'closingCredit', th: 'reports.tb6.th.closeCr' },
];

/** SP-05 — six-column trial balance (Opening · Period · Closing, Dr/Cr each). */
/**
 * SP-19 — report line → the existing account ledger page, carrying the report's own date range
 * (`from` drives the ledger's back link to this tab). Rows without `proof` (totals, headings)
 * are never clickable.
 */
function reportLedgerHref(accountId, { from, dateFrom = '', dateTo = '' }) {
    const q = new URLSearchParams({ from });
    if (dateFrom) q.set('dateFrom', dateFrom);
    if (dateTo) q.set('dateTo', dateTo);
    return `/supplier/accounting/ledger/${encodeURIComponent(String(accountId))}?${q.toString()}`;
}

function TrialBalance({ locale, t }) {
    const navigate = useNavigate();
    const isAr = locale === 'ar';
    const numAlign = isAr ? 'left' : 'right';
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [exporting, setExporting] = useState('');
    const canExport = useSupplierCan()(SUPPLIER_PERM.reportsExport); // SP-22
    const [{ dateFrom, dateTo }, setRange] = useState({ dateFrom: '', dateTo: '' });
    const openLedger = (accountId) => {
        if (!accountId) return;
        navigate(reportLedgerHref(accountId, { from: 'trial_balance', dateFrom, dateTo }));
    };

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

    const runExport = async (kind) => {
        if (!data || exporting) return;
        setExporting(kind);
        setErr('');
        try {
            const mod = await import('../../../utils/supplierTrialBalanceExport');
            if (kind === 'pdf') await mod.exportSupplierTrialBalancePdf({ data });
            else mod.exportSupplierTrialBalanceExcel({ data });
        } catch (e) {
            setErr(t('reports.export.err', { error: e?.message || String(e) }));
        } finally {
            setExporting('');
        }
    };

    const cell = (v) => <SupplierRiyalAmount amount={v} size={12} />;
    const checks = data?.checks || {};
    const unbalanced = ['opening', 'period', 'closing'].filter((k) => checks[k] && !checks[k].balanced);
    const rangeText =
        data?.dateFrom || data?.dateTo
            ? t('reports.tb6.range', { from: data?.dateFrom || '…', to: data?.dateTo || '…' })
            : t('reports.tb6.allDates');

    return (
        <div style={{ overflowX: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0F172A' }}>{t('reports.tb6.title')}</h3>
                    <div style={{ marginTop: 4, fontSize: 12, color: '#64748B' }}>{rangeText}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" style={outlineBtnStyle} disabled={!data || Boolean(exporting) || !canExport} title={canExport ? undefined : t('perm.denied')} onClick={() => runExport('pdf')}>
                        {exporting === 'pdf' ? t('reports.export.busy') : t('reports.export.pdf')}
                    </button>
                    <button type="button" style={outlineBtnStyle} disabled={!data || Boolean(exporting) || !canExport} title={canExport ? undefined : t('perm.denied')} onClick={() => runExport('excel')}>
                        {exporting === 'excel' ? t('reports.export.busy') : t('reports.export.excel')}
                    </button>
                </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                <ReportDateBar locale={locale} dateFrom={dateFrom} dateTo={dateTo} onChange={setRange} />
            </div>
            <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 10, border: '1px solid #A7F3D0', background: '#ECFDF5', color: '#065F46', fontSize: 12 }}>
                {t('reports.tb6.note')}
            </div>
            <AcctError message={err} />
            {loading ? <AcctLoading locale={locale} /> : !data ? <AcctEmpty message={t('reports.noData')} /> : (
                <div>
                    <div style={{ width: '100%', overflowX: 'auto' }}>
                        <table className="ws-table" style={{ width: '100%', minWidth: 880 }}>
                            <thead>
                                <tr>
                                    <th>{t('reports.th.code')}</th>
                                    <th>{t('reports.th.account')}</th>
                                    {TB6_COLUMNS.map((c) => (
                                        <th key={c.key} style={{ textAlign: numAlign }}>{t(c.th)}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {(data.accounts || []).map((a) => {
                                    // SP-19: heading accounts / rows without proof are not clickable
                                    const drill = Boolean(a.proof?.accountId) && !a.isHeading;
                                    return (
                                    <tr
                                        key={a.accountId}
                                        data-account-id={a.accountId}
                                        data-account-code={a.code}
                                        className={drill ? 'sp-drill-row' : undefined}
                                        role={drill ? 'button' : undefined}
                                        tabIndex={drill ? 0 : undefined}
                                        title={drill ? t('reports.tb6.viewLedger') : undefined}
                                        style={a.isHeading ? { fontStyle: 'italic', color: '#64748B' } : undefined}
                                        onClick={drill ? () => openLedger(a.proof.accountId) : undefined}
                                        onKeyDown={
                                            drill
                                                ? (e) => {
                                                      if (e.key === 'Enter' || e.key === ' ') {
                                                          e.preventDefault();
                                                          openLedger(a.proof.accountId);
                                                      }
                                                  }
                                                : undefined
                                        }
                                    >
                                        <td style={{ fontWeight: 700 }}>{a.code}</td>
                                        <td>
                                            {a.name}
                                            {drill ? <span className="sp-drill-hint">{t('reports.viewLedger')}</span> : null}
                                        </td>
                                        {TB6_COLUMNS.map((c) => (
                                            <td key={c.key} style={{ textAlign: numAlign, whiteSpace: 'nowrap' }}>{cell(a[c.key])}</td>
                                        ))}
                                    </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={2} style={{ fontWeight: 800 }}>{t('reports.totals')}</td>
                                    {TB6_COLUMNS.map((c) => (
                                        <td key={c.key} style={{ textAlign: numAlign, fontWeight: 800, whiteSpace: 'nowrap' }}>
                                            {cell(data.totals?.[c.key])}
                                        </td>
                                    ))}
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                    {unbalanced.length ? (
                        unbalanced.map((k) => (
                            <p key={k} style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: '#B91C1C' }}>
                                {t('reports.tb6.unbalanced', {
                                    column: t(`reports.tb6.col.${k}`),
                                    amount: Number(checks[k].difference || 0).toFixed(2),
                                })}
                            </p>
                        ))
                    ) : (
                        <p style={{ marginTop: 12, fontSize: 12, fontWeight: 700, color: '#065F46' }}>{t('reports.tb6.balancedAll')}</p>
                    )}
                    {data.netZatcaPayable != null ? (
                        <p style={{ marginTop: 6, fontSize: 12, color: '#475569', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span>{t('reports.tb6.zatcaMemo')}</span>
                            {cell(data.netZatcaPayable)}
                        </p>
                    ) : null}
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

/** SP-06 — one P&L block: section header, account lines, total line (with compare/variance). */
function PlBlock({ title, lines, totalLabel, totalKey, data, hasCmp, onOpen, t, numAlign }) {
    const amt = (v) => (v == null ? t('emdash') : <SupplierRiyalAmount amount={v} size={12} />);
    const cmpTotals = data?.compare?.totals || {};
    const variance = data?.variance || {};
    return (
        <>
            {title ? (
                <tr>
                    <td colSpan={hasCmp ? 4 : 2} style={{ fontWeight: 800, color: '#0F172A', paddingTop: 14 }}>{title}</td>
                </tr>
            ) : null}
            {(lines || []).map((l) => (
                <tr
                    key={l.id}
                    data-account-id={l.id}
                    className={l.proof ? 'sp-drill-row' : undefined}
                    role={l.proof ? 'button' : undefined}
                    tabIndex={l.proof ? 0 : undefined}
                    onClick={l.proof ? () => onOpen(l.proof.accountId || l.id) : undefined}
                    onKeyDown={(e) => {
                        if (l.proof && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            onOpen(l.proof.accountId || l.id);
                        }
                    }}
                >
                    <td style={{ color: '#475569' }}>
                        [{l.code}] {l.name}
                        {l.proof ? <span className="sp-drill-hint">{t('reports.viewLedger')}</span> : null}
                        {l.isContra ? <span style={{ marginInlineStart: 6, fontSize: 11, color: '#94A3B8' }}>({t('reports.pl.contra')})</span> : null}
                    </td>
                    <td style={{ textAlign: numAlign, whiteSpace: 'nowrap' }}>{amt(l.amount)}</td>
                    {hasCmp ? (
                        <>
                            <td style={{ textAlign: numAlign, whiteSpace: 'nowrap' }}>{amt(l.compareAmount)}</td>
                            <td style={{ textAlign: numAlign, whiteSpace: 'nowrap', color: Number(l.variance) < 0 ? '#B91C1C' : '#065F46' }}>{amt(l.variance)}</td>
                        </>
                    ) : null}
                </tr>
            ))}
            {totalKey ? (
                <tr style={{ borderTop: '1px solid #E2E8F0' }}>
                    <td style={{ fontWeight: 800 }}>{totalLabel}</td>
                    <td style={{ textAlign: numAlign, fontWeight: 800, whiteSpace: 'nowrap' }}>{amt(data?.totals?.[totalKey])}</td>
                    {hasCmp ? (
                        <>
                            <td style={{ textAlign: numAlign, fontWeight: 800, whiteSpace: 'nowrap' }}>{amt(cmpTotals[totalKey])}</td>
                            <td style={{ textAlign: numAlign, fontWeight: 800, whiteSpace: 'nowrap' }}>{amt(variance[totalKey])}</td>
                        </>
                    ) : null}
                </tr>
            ) : null}
        </>
    );
}

/** SP-06 — Profit & Loss with an optional comparative period. */
function ProfitLoss({ locale, t }) {
    const navigate = useNavigate();
    const isAr = locale === 'ar';
    const numAlign = isAr ? 'left' : 'right';
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [exporting, setExporting] = useState('');
    const canExport = useSupplierCan()(SUPPLIER_PERM.reportsExport); // SP-22
    const [{ dateFrom, dateTo }, setRange] = useState({ dateFrom: startOfMonthISO(), dateTo: todayISO() });
    const openLedger = (accountId) => {
        if (!accountId) return;
        navigate(reportLedgerHref(accountId, { from: 'profit_loss', dateFrom, dateTo }));
    };
    const [compareMode, setCompareMode] = useState('previous'); // previous | custom | none
    const [cmpDraft, setCmpDraft] = useState({ from: '', to: '' });
    const [cmpApplied, setCmpApplied] = useState({ from: '', to: '' });

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const params = { dateFrom, dateTo };
            if (compareMode === 'none') params.compare = 'none';
            if (compareMode === 'custom' && cmpApplied.from && cmpApplied.to) {
                params.compareFrom = cmpApplied.from;
                params.compareTo = cmpApplied.to;
            }
            const res = await getSupplierPnl(params);
            setData(res);
        } catch (e) {
            setErr(e?.message || t('reports.err.pl'));
        } finally {
            setLoading(false);
        }
    }, [dateFrom, dateTo, compareMode, cmpApplied, t]);

    useEffect(() => { load(); }, [load]);

    const runExport = async (kind) => {
        if (!data || exporting) return;
        setExporting(kind);
        setErr('');
        try {
            const mod = await import('../../../utils/supplierProfitLossExport');
            if (kind === 'pdf') await mod.exportSupplierProfitLossPdf({ data });
            else mod.exportSupplierProfitLossExcel({ data });
        } catch (e) {
            setErr(t('reports.export.err', { error: e?.message || String(e) }));
        } finally {
            setExporting('');
        }
    };

    const hasCmp = Boolean(data?.compare);
    const net = Number(data?.totals?.netIncome ?? data?.netIncome ?? 0);
    const blockProps = { data, hasCmp, onOpen: openLedger, t, numAlign };

    return (
        <div style={{ overflowX: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0F172A' }}>{t('reports.pl.title')}</h3>
                    <div style={{ marginTop: 4, fontSize: 12, color: '#64748B' }}>
                        {data?.dateFrom || data?.dateTo
                            ? t('reports.tb6.range', { from: data?.dateFrom || '…', to: data?.dateTo || '…' })
                            : t('reports.tb6.allDates')}
                        {hasCmp ? ` · ${t('reports.pl.compare.range', { from: data.compare.dateFrom || '…', to: data.compare.dateTo || '…' })}` : ''}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" style={outlineBtnStyle} disabled={!data || Boolean(exporting) || !canExport} title={canExport ? undefined : t('perm.denied')} onClick={() => runExport('pdf')}>
                        {exporting === 'pdf' ? t('reports.export.busy') : t('reports.export.pdf')}
                    </button>
                    <button type="button" style={outlineBtnStyle} disabled={!data || Boolean(exporting) || !canExport} title={canExport ? undefined : t('perm.denied')} onClick={() => runExport('excel')}>
                        {exporting === 'excel' ? t('reports.export.busy') : t('reports.export.excel')}
                    </button>
                </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
                <ReportDateBar locale={locale} dateFrom={dateFrom} dateTo={dateTo} onChange={setRange} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                <Field label={t('reports.pl.compare.label')}>
                    <select style={inputStyle} value={compareMode} onChange={(e) => setCompareMode(e.target.value)}>
                        <option value="previous">{t('reports.pl.compare.previous')}</option>
                        <option value="custom">{t('reports.pl.compare.custom')}</option>
                        <option value="none">{t('reports.pl.compare.none')}</option>
                    </select>
                </Field>
                {compareMode === 'custom' ? (
                    <>
                        <Field label={t('reports.pl.compare.from')}>
                            <input type="date" style={inputStyle} value={cmpDraft.from} onChange={(e) => setCmpDraft((d) => ({ ...d, from: e.target.value }))} />
                        </Field>
                        <Field label={t('reports.pl.compare.to')}>
                            <input type="date" style={inputStyle} value={cmpDraft.to} onChange={(e) => setCmpDraft((d) => ({ ...d, to: e.target.value }))} />
                        </Field>
                        <button
                            type="button"
                            style={primaryBtnStyle}
                            disabled={!cmpDraft.from || !cmpDraft.to}
                            onClick={() => setCmpApplied({ ...cmpDraft })}
                        >
                            {t('reports.pl.compare.apply')}
                        </button>
                    </>
                ) : null}
            </div>
            <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 10, border: '1px solid #A7F3D0', background: '#ECFDF5', color: '#065F46', fontSize: 12 }}>
                {t('reports.pl.note')}
            </div>
            <AcctError message={err} />
            {loading ? <AcctLoading locale={locale} /> : !data ? <AcctEmpty message={t('reports.noData')} /> : (
                <div style={{ width: '100%', overflowX: 'auto' }}>
                    <table className="ws-table" style={{ width: '100%', minWidth: hasCmp ? 640 : 420 }}>
                        <thead>
                            <tr>
                                <th>{t('reports.pl.th.account')}</th>
                                <th style={{ textAlign: numAlign }}>{t('reports.pl.th.current')}</th>
                                {hasCmp ? (
                                    <>
                                        <th style={{ textAlign: numAlign }}>{t('reports.pl.th.compare')}</th>
                                        <th style={{ textAlign: numAlign }}>{t('reports.pl.th.variance')}</th>
                                    </>
                                ) : null}
                            </tr>
                        </thead>
                        <tbody>
                            <PlBlock {...blockProps} title={t('reports.pl.sales')} lines={data.sales || data.revenue} totalKey="totalSales" totalLabel={t('reports.totalOf', { title: t('reports.pl.sales') })} />
                            <PlBlock {...blockProps} title={t('reports.cogs')} lines={data.costOfGoodsSold} totalKey="totalCOGS" totalLabel={t('reports.totalOf', { title: t('reports.cogs') })} />
                            <PlBlock {...blockProps} lines={[]} totalKey="grossProfit" totalLabel={t('reports.grossProfit')} />
                            {(data.otherIncome || []).length ? (
                                <PlBlock {...blockProps} title={t('reports.pl.otherIncome')} lines={data.otherIncome} totalKey="totalOtherIncome" totalLabel={t('reports.totalOf', { title: t('reports.pl.otherIncome') })} />
                            ) : null}
                            <PlBlock {...blockProps} title={t('reports.opEx')} lines={data.operatingExpenses} totalKey="totalOperatingExpenses" totalLabel={t('reports.totalOf', { title: t('reports.opEx') })} />
                            <PlBlock {...blockProps} lines={[]} totalKey="totalIncome" totalLabel={t('reports.pl.totalIncome')} />
                            <PlBlock {...blockProps} lines={[]} totalKey="totalExpense" totalLabel={t('reports.pl.totalExpense')} />
                        </tbody>
                        <tfoot>
                            <tr style={{ borderTop: '2px solid #0F172A' }}>
                                <td style={{ fontWeight: 800, fontSize: 15 }}>{t('reports.netIncome')}</td>
                                <td style={{ textAlign: numAlign, fontWeight: 800, fontSize: 15, whiteSpace: 'nowrap', color: net >= 0 ? '#065F46' : '#B91C1C' }}>
                                    <SupplierRiyalAmount amount={net} size={13} />
                                </td>
                                {hasCmp ? (
                                    <>
                                        <td style={{ textAlign: numAlign, fontWeight: 800, whiteSpace: 'nowrap' }}>
                                            <SupplierRiyalAmount amount={data.compare?.totals?.netIncome ?? 0} size={13} />
                                        </td>
                                        <td style={{ textAlign: numAlign, fontWeight: 800, whiteSpace: 'nowrap' }}>
                                            <SupplierRiyalAmount amount={data.variance?.netIncome ?? 0} size={13} />
                                        </td>
                                    </>
                                ) : null}
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </div>
    );
}

/** SP-07 — one balance-sheet section (rows + subtotal), with optional compare/change columns. */
function BsSection({ title, lines, totalLabel, total, cmpTotal, varTotal, hasCmp, onOpen, t, numAlign, strong }) {
    const amt = (v) => (v == null ? t('emdash') : <SupplierRiyalAmount amount={v} size={12} />);
    const cols = hasCmp ? 4 : 2;
    const rows = lines || [];
    return (
        <>
            {title ? (
                <tr>
                    <td colSpan={cols} style={{ fontWeight: 800, color: '#0F172A', paddingTop: 12 }}>{title}</td>
                </tr>
            ) : null}
            {rows.map((l) => {
                const open = () => (l.isCurrentYearEarnings ? onOpen(null, l.proof?.sourceHref) : onOpen(l.proof?.accountId || l.id));
                return (
                    <tr
                        key={l.id}
                        data-account-id={l.accountId || undefined}
                        className={l.proof ? 'sp-drill-row' : undefined}
                        role={l.proof ? 'button' : undefined}
                        tabIndex={l.proof ? 0 : undefined}
                        onClick={l.proof ? open : undefined}
                        onKeyDown={(e) => {
                            if (l.proof && (e.key === 'Enter' || e.key === ' ')) {
                                e.preventDefault();
                                open();
                            }
                        }}
                    >
                        <td style={{ color: l.isCurrentYearEarnings ? '#0F172A' : '#475569', fontWeight: l.isCurrentYearEarnings ? 700 : 400 }}>
                            {l.isCurrentYearEarnings ? (
                                <span title={t('reports.bs.cyEarningsHint')}>{t('reports.bs.cyEarnings')}</span>
                            ) : (
                                <>[{l.code}] {l.name}</>
                            )}
                            {l.proof ? <span className="sp-drill-hint">{t('reports.viewLedger')}</span> : null}
                        </td>
                        <td style={{ textAlign: numAlign, whiteSpace: 'nowrap' }}>{amt(l.amount)}</td>
                        {hasCmp ? (
                            <>
                                <td style={{ textAlign: numAlign, whiteSpace: 'nowrap' }}>{amt(l.compareAmount)}</td>
                                <td style={{ textAlign: numAlign, whiteSpace: 'nowrap', color: Number(l.variance) < 0 ? '#B91C1C' : '#065F46' }}>{amt(l.variance)}</td>
                            </>
                        ) : null}
                    </tr>
                );
            })}
            {totalLabel ? (
                <tr style={{ borderTop: strong ? '2px solid #0F172A' : '1px solid #E2E8F0' }}>
                    <td style={{ fontWeight: 800 }}>{totalLabel}</td>
                    <td style={{ textAlign: numAlign, fontWeight: 800, whiteSpace: 'nowrap' }}>{amt(total)}</td>
                    {hasCmp ? (
                        <>
                            <td style={{ textAlign: numAlign, fontWeight: 800, whiteSpace: 'nowrap' }}>{amt(cmpTotal)}</td>
                            <td style={{ textAlign: numAlign, fontWeight: 800, whiteSpace: 'nowrap' }}>
                                {amt(varTotal)}
                            </td>
                        </>
                    ) : null}
                </tr>
            ) : null}
        </>
    );
}

/** SP-07 — Balance sheet as of a Riyadh date, optional comparative as-of. */
function BalanceSheet({ locale, t }) {
    const navigate = useNavigate();
    const isAr = locale === 'ar';
    const numAlign = isAr ? 'left' : 'right';
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [exporting, setExporting] = useState('');
    const canExport = useSupplierCan()(SUPPLIER_PERM.reportsExport); // SP-22
    const [asOf, setAsOf] = useState(todayISO());
    // SP-19: a BS line opens the account ledger up to the BS date (cumulative balance).
    const openLine = (accountId, href) => {
        if (href) {
            navigate(href);
            return;
        }
        if (!accountId) return;
        navigate(reportLedgerHref(accountId, { from: 'balance_sheet', dateTo: asOf }));
    };
    const [compareAsOf, setCompareAsOf] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const params = { asOf };
            if (compareAsOf) params.compareAsOf = compareAsOf;
            const res = await getSupplierBalanceSheet(params);
            setData(res);
        } catch (e) {
            setErr(e?.message || t('reports.err.bs'));
        } finally {
            setLoading(false);
        }
    }, [asOf, compareAsOf, t]);

    useEffect(() => { load(); }, [load]);

    const runExport = async (kind) => {
        if (!data || exporting) return;
        setExporting(kind);
        setErr('');
        try {
            const mod = await import('../../../utils/supplierBalanceSheetExport');
            if (kind === 'pdf') await mod.exportSupplierBalanceSheetPdf({ data });
            else mod.exportSupplierBalanceSheetExcel({ data });
        } catch (e) {
            setErr(t('reports.export.err', { error: e?.message || String(e) }));
        } finally {
            setExporting('');
        }
    };

    const hasCmp = Boolean(data?.compare);
    const ct = data?.compare?.totals || {};
    const cv = data?.compare?.variance || {};
    const props = { hasCmp, onOpen: openLine, t, numAlign };
    const check = data?.check;

    return (
        <div style={{ overflowX: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0F172A' }}>{t('reports.bs.title')}</h3>
                    <div style={{ marginTop: 4, fontSize: 12, color: '#64748B' }}>
                        {t('reports.bs.asOfLine', { date: data?.asOf || asOf })}
                        {hasCmp ? ` · ${t('reports.bs.compare.line', { date: data.compare.asOf })}` : ''}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" style={outlineBtnStyle} disabled={!data || Boolean(exporting) || !canExport} title={canExport ? undefined : t('perm.denied')} onClick={() => runExport('pdf')}>
                        {exporting === 'pdf' ? t('reports.export.busy') : t('reports.export.pdf')}
                    </button>
                    <button type="button" style={outlineBtnStyle} disabled={!data || Boolean(exporting) || !canExport} title={canExport ? undefined : t('perm.denied')} onClick={() => runExport('excel')}>
                        {exporting === 'excel' ? t('reports.export.busy') : t('reports.export.excel')}
                    </button>
                </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                <Field label={t('reports.asOf')}>
                    <input type="date" style={inputStyle} value={asOf} onChange={(e) => e.target.value && setAsOf(e.target.value)} />
                </Field>
                <Field label={t('reports.bs.compare.label')} hint={t('reports.bs.compare.hint')}>
                    <input type="date" style={inputStyle} value={compareAsOf} onChange={(e) => setCompareAsOf(e.target.value)} />
                </Field>
                {compareAsOf ? (
                    <button type="button" style={outlineBtnStyle} onClick={() => setCompareAsOf('')}>
                        {t('reports.bs.compare.clear')}
                    </button>
                ) : null}
            </div>
            <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 10, border: '1px solid #A7F3D0', background: '#ECFDF5', color: '#065F46', fontSize: 12 }}>
                {t('reports.bs.note')}
            </div>
            <AcctError message={err} />
            {!loading && check ? (
                <div
                    role="status"
                    style={{
                        marginBottom: 12,
                        padding: '10px 12px',
                        borderRadius: 10,
                        fontSize: 13,
                        fontWeight: 700,
                        border: `1px solid ${check.balanced ? '#A7F3D0' : '#FECACA'}`,
                        background: check.balanced ? '#ECFDF5' : '#FEF2F2',
                        color: check.balanced ? '#065F46' : '#B91C1C',
                    }}
                >
                    {check.balanced ? (
                        t('reports.bs.balanced')
                    ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                            {t('reports.bs.unbalanced')}
                            <SupplierRiyalAmount amount={check.difference} size={12} />
                            {t('reports.bs.noPlug')}
                        </span>
                    )}
                </div>
            ) : null}
            {loading ? <AcctLoading locale={locale} /> : !data ? <AcctEmpty message={t('reports.noData')} /> : (
                <div style={{ width: '100%', overflowX: 'auto' }}>
                    <table className="ws-table" style={{ width: '100%', minWidth: hasCmp ? 640 : 420 }}>
                        <thead>
                            <tr>
                                <th>{t('reports.bs.th.account')}</th>
                                <th style={{ textAlign: numAlign }}>{t('reports.bs.th.current', { date: data.asOf || asOf })}</th>
                                {hasCmp ? (
                                    <>
                                        <th style={{ textAlign: numAlign }}>{t('reports.bs.th.compare', { date: data.compare.asOf })}</th>
                                        <th style={{ textAlign: numAlign }}>{t('reports.bs.th.variance')}</th>
                                    </>
                                ) : null}
                            </tr>
                        </thead>
                        <tbody>
                            {data.assets.current?.length ? <BsSection {...props} title={t('reports.currentAssets')} lines={data.assets.current} /> : null}
                            {data.assets.fixed?.length ? <BsSection {...props} title={t('reports.fixedAssets')} lines={data.assets.fixed} /> : null}
                            {data.assets.other?.length ? <BsSection {...props} title={t('reports.otherAssets')} lines={data.assets.other} /> : null}
                            <BsSection {...props} lines={[]} strong totalLabel={t('reports.totalAssets')} total={data.assets.total} cmpTotal={ct.totalAssets} varTotal={cv.totalAssets} />

                            {data.liabilities.current?.length ? <BsSection {...props} title={t('reports.currentLiab')} lines={data.liabilities.current} /> : null}
                            {data.liabilities.longTerm?.length ? <BsSection {...props} title={t('reports.longTermLiab')} lines={data.liabilities.longTerm} /> : null}
                            {data.liabilities.other?.length ? <BsSection {...props} title={t('reports.otherLiab')} lines={data.liabilities.other} /> : null}
                            <BsSection {...props} lines={[]} totalLabel={t('reports.totalLiab')} total={data.liabilities.total} cmpTotal={ct.totalLiabilities} varTotal={cv.totalLiabilities} />

                            <BsSection
                                {...props}
                                title={t('reports.equity')}
                                lines={data.equity.accounts}
                                totalLabel={t('reports.totalEquity')}
                                total={data.equity.total}
                                cmpTotal={ct.totalEquity} varTotal={cv.totalEquity}
                            />
                        </tbody>
                        <tfoot>
                            <BsSection {...props} lines={[]} strong totalLabel={t('reports.totalLiabEquity')} total={data.totalLiabilitiesAndEquity} cmpTotal={ct.totalLiabilitiesAndEquity} varTotal={cv.totalLiabilitiesAndEquity} />
                        </tfoot>
                    </table>
                </div>
            )}
        </div>
    );
}

/** SP-08 — direct-method section: every cash line (click → journal voucher). */
function CashFlowBucket({ title, bucket, onOpenHref, t, numAlign }) {
    const amt = (v) => <SupplierRiyalAmount amount={v} size={12} />;
    if (!bucket) return null;
    const rows = [
        ...(bucket.inflows || []).map((r) => ({ ...r, dir: 1 })),
        ...(bucket.outflows || []).map((r) => ({ ...r, dir: -1 })),
    ].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    return (
        <>
            <tr>
                <td colSpan={4} style={{ fontWeight: 800, color: '#0F172A', paddingTop: 14 }}>{title}</td>
            </tr>
            {rows.length === 0 ? (
                <tr>
                    <td colSpan={4} style={{ fontSize: 12, color: '#64748B' }}>{t('reports.cf8.noLines')}</td>
                </tr>
            ) : (
                rows.map((r, i) => {
                    const href = r.proof?.sourceHref;
                    const open = () => href && onOpenHref(href);
                    return (
                        <tr
                            key={`${r.journalId}-${r.accountId}-${i}`}
                            data-journal-id={r.journalId}
                            role={href ? 'button' : undefined}
                            tabIndex={href ? 0 : undefined}
                            style={href ? CLICKABLE_ROW : undefined}
                            onClick={open}
                            onKeyDown={(e) => {
                                if (href && (e.key === 'Enter' || e.key === ' ')) {
                                    e.preventDefault();
                                    open();
                                }
                            }}
                        >
                            <td style={{ whiteSpace: 'nowrap', color: '#475569' }}>{String(r.date || '').slice(0, 10)}</td>
                            <td style={{ whiteSpace: 'nowrap', color: '#475569' }}>{r.journalEntryNumber || '—'}</td>
                            <td style={{ color: r.dir > 0 ? '#065F46' : '#B45309' }}>
                                {r.dir > 0 ? '↑' : '↓'} {r.description || r.source || r.journalType}
                                <span style={{ marginInlineStart: 6, fontSize: 11, color: '#94A3B8' }}>[{r.accountCode}]</span>
                            </td>
                            <td style={{ textAlign: numAlign, whiteSpace: 'nowrap', fontWeight: 600, color: r.dir > 0 ? '#065F46' : '#B91C1C' }}>
                                {amt(r.dir > 0 ? r.amount : -r.amount)}
                            </td>
                        </tr>
                    );
                })
            )}
            <tr style={{ borderTop: '1px solid #E2E8F0' }}>
                <td colSpan={3} style={{ fontWeight: 700, color: '#475569' }}>{t('reports.cf8.inflows')} / {t('reports.cf8.outflows')}</td>
                <td style={{ textAlign: numAlign, whiteSpace: 'nowrap', fontSize: 12 }}>
                    {amt(bucket.totalInflows ?? 0)} / {amt(-(bucket.totalOutflows ?? 0))}
                </td>
            </tr>
            <tr>
                <td colSpan={3} style={{ fontWeight: 800 }}>{t('reports.netOf', { title: title.toLowerCase() })}</td>
                <td style={{ textAlign: numAlign, whiteSpace: 'nowrap', fontWeight: 800, color: bucket.net >= 0 ? '#065F46' : '#B91C1C' }}>{amt(bucket.net)}</td>
            </tr>
        </>
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

/** SP-08 — indirect method: NI → non-cash add-backs → working capital → I / F. */
function IndirectCashFlowSection({ indirect, onOpenHref, t, numAlign }) {
    if (!indirect) return null;
    const amt = (v) => <SupplierRiyalAmount amount={v} size={12} />;
    const line = (key, label, amount, proof, opts = {}) => {
        const href = proof?.sourceHref;
        const open = () => href && onOpenHref(href);
        return (
            <tr
                key={key}
                data-account-id={proof?.accountId || undefined}
                role={href ? 'button' : undefined}
                tabIndex={href ? 0 : undefined}
                style={href ? CLICKABLE_ROW : undefined}
                onClick={open}
                onKeyDown={(e) => {
                    if (href && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        open();
                    }
                }}
            >
                <td style={{ color: opts.bold ? '#0F172A' : '#475569', fontWeight: opts.bold ? 800 : 400, paddingInlineStart: opts.indent ? 14 : undefined }}>{label}</td>
                <td style={{ textAlign: numAlign, whiteSpace: 'nowrap', fontWeight: opts.bold ? 800 : 600, color: Number(amount) < 0 ? '#B91C1C' : '#065F46' }}>{amt(amount)}</td>
            </tr>
        );
    };
    const head = (key, label) => (
        <tr key={key}>
            <td colSpan={2} style={{ fontWeight: 800, color: '#0F172A', paddingTop: 14 }}>{label}</td>
        </tr>
    );
    const sub = (key, label) => (
        <tr key={key}>
            <td colSpan={2} style={{ fontSize: 11, fontWeight: 700, color: '#64748B', paddingTop: 8 }}>{label}</td>
        </tr>
    );
    const adjLabel = (a) => t(`reports.cf8.adj.${a.kind || 'other'}`, { code: a.code ? `[${a.code}]` : '', name: a.name || '' });
    return (
        <>
            {head('h-op', t('reports.cfOperating'))}
            {line('ni', t('reports.netIncomeFromPl'), indirect.netIncome, null)}
            {(indirect.adjustments || []).length ? sub('s-adj', t('reports.cf8.adjustments')) : null}
            {(indirect.adjustments || []).map((a, i) => line(`adj-${i}`, adjLabel(a), a.amount, a.proof, { indent: true }))}
            {(indirect.workingCapitalChanges || []).length ? sub('s-wc', t('reports.wcChanges')) : null}
            {(indirect.workingCapitalChanges || []).map((w, i) => line(`wc-${i}`, w.label, w.amount, w.proof, { indent: true }))}
            {line('op', t('reports.netCashOperating'), indirect.netCashFromOperating, null, { bold: true })}

            {head('h-inv', t('reports.cfInvesting'))}
            {(indirect.investing?.lines || []).map((l, i) => line(`inv-${i}`, l.label, l.amount, l.proof, { indent: true }))}
            {line('inv', t('reports.netInvesting'), indirect.investing?.net ?? 0, null, { bold: true })}

            {head('h-fin', t('reports.cfFinancing'))}
            {(indirect.financing?.lines || []).map((l, i) => line(`fin-${i}`, l.label, l.amount, l.proof, { indent: true }))}
            {line('fin', t('reports.netFinancing'), indirect.financing?.net ?? 0, null, { bold: true })}
        </>
    );
}

/** SP-08 — Cash flow statement: Indirect / Direct tabs on the same report tab. */
function CashFlow({ locale, t }) {
    const navigate = useNavigate();
    const isAr = locale === 'ar';
    const numAlign = isAr ? 'left' : 'right';
    const onOpenHref = useCallback((href) => { if (href) navigate(href); }, [navigate]);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [exporting, setExporting] = useState('');
    const canExport = useSupplierCan()(SUPPLIER_PERM.reportsExport); // SP-22
    const [method, setMethod] = useState('indirect');
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

    const runExport = async (kind) => {
        if (!data || exporting) return;
        setExporting(kind);
        setErr('');
        try {
            const mod = await import('../../../utils/supplierCashFlowExport');
            if (kind === 'pdf') await mod.exportSupplierCashFlowPdf({ data, method });
            else mod.exportSupplierCashFlowExcel({ data, method });
        } catch (e) {
            setErr(t('reports.export.err', { error: e?.message || String(e) }));
        } finally {
            setExporting('');
        }
    };

    const isIndirect = method === 'indirect';
    const block = data ? (isIndirect ? data.indirect : data.direct) : null;
    const checks = data?.checks || {};
    const methodDiff = isIndirect ? checks.indirectDifference : checks.directDifference;
    const recon = isIndirect ? Number(data?.indirect?.reconciliationDifference ?? 0) : 0;
    const ok = Boolean(data) && Number(methodDiff ?? 0) === 0 && recon === 0 && checks.closingCashMatch !== false;
    const amt = (v, size = 12) => <SupplierRiyalAmount amount={v} size={size} />;
    const tabBtn = (id, label) => (
        <button key={id} type="button" style={method === id ? primaryBtnStyle : outlineBtnStyle} onClick={() => setMethod(id)}>
            {label}
        </button>
    );

    return (
        <div style={{ overflowX: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0F172A' }}>{t('reports.cf8.title')}</h3>
                    <div style={{ marginTop: 4, fontSize: 12, color: '#64748B' }}>
                        {data?.dateFrom || data?.dateTo
                            ? t('reports.tb6.range', { from: data?.dateFrom || '…', to: data?.dateTo || '…' })
                            : t('reports.tb6.allDates')}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" style={outlineBtnStyle} disabled={!data || Boolean(exporting) || !canExport} title={canExport ? undefined : t('perm.denied')} onClick={() => runExport('pdf')}>
                        {exporting === 'pdf' ? t('reports.export.busy') : t('reports.export.pdf')}
                    </button>
                    <button type="button" style={outlineBtnStyle} disabled={!data || Boolean(exporting) || !canExport} title={canExport ? undefined : t('perm.denied')} onClick={() => runExport('excel')}>
                        {exporting === 'excel' ? t('reports.export.busy') : t('reports.export.excel')}
                    </button>
                </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                <ReportDateBar locale={locale} dateFrom={dateFrom} dateTo={dateTo} onChange={setRange} />
                <div role="tablist" aria-label={t('reports.cfMethod')} style={{ display: 'flex', gap: 6 }}>
                    {tabBtn('indirect', t('reports.cf8.tab.indirect'))}
                    {tabBtn('direct', t('reports.cf8.tab.direct'))}
                </div>
            </div>
            <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 10, border: '1px solid #A7F3D0', background: '#ECFDF5', color: '#065F46', fontSize: 12 }}>
                {isIndirect ? t('reports.cf8.note.indirect') : t('reports.cf8.note.direct')}
            </div>
            <AcctError message={err} />
            {loading ? (
                <AcctLoading locale={locale} />
            ) : !data || !block ? (
                <AcctEmpty message={t('reports.noData')} />
            ) : (
                <div>
                    <div
                        role="status"
                        style={{
                            marginBottom: 12,
                            padding: '10px 12px',
                            borderRadius: 10,
                            fontSize: 13,
                            fontWeight: 700,
                            border: `1px solid ${ok ? '#A7F3D0' : '#FECACA'}`,
                            background: ok ? '#ECFDF5' : '#FEF2F2',
                            color: ok ? '#065F46' : '#B91C1C',
                        }}
                    >
                        {ok ? (
                            t('reports.cf8.reconciled')
                        ) : (
                            <>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                                    {t('reports.cf8.unreconciled')} {amt(Number(methodDiff ?? 0) || recon)}
                                </span>
                                <div style={{ fontWeight: 500, fontSize: 12, marginTop: 4 }}>{t('reports.cf8.unreconciledHint')}</div>
                            </>
                        )}
                    </div>
                    <CashFlowInsights insights={data.insights} t={t} />

                    <div style={{ width: '100%', overflowX: 'auto' }}>
                        <table className="ws-table" style={{ width: '100%', minWidth: 520 }}>
                            <thead>
                                {isIndirect ? (
                                    <tr>
                                        <th>{t('reports.cf8.th.account')}</th>
                                        <th style={{ textAlign: numAlign }}>{t('reports.cf8.th.amount')}</th>
                                    </tr>
                                ) : (
                                    <tr>
                                        <th>{t('reports.cf8.th.date')}</th>
                                        <th>{t('reports.cf8.th.entry')}</th>
                                        <th>{t('reports.cf8.th.description')}</th>
                                        <th style={{ textAlign: numAlign }}>{t('reports.cf8.th.amount')}</th>
                                    </tr>
                                )}
                            </thead>
                            <tbody>
                                {isIndirect ? (
                                    <IndirectCashFlowSection indirect={data.indirect} onOpenHref={onOpenHref} t={t} numAlign={numAlign} />
                                ) : (
                                    <>
                                        <CashFlowBucket title={t('reports.operatingAct')} bucket={data.direct?.operating} onOpenHref={onOpenHref} t={t} numAlign={numAlign} />
                                        <CashFlowBucket title={t('reports.investingAct')} bucket={data.direct?.investing} onOpenHref={onOpenHref} t={t} numAlign={numAlign} />
                                        <CashFlowBucket title={t('reports.financingAct')} bucket={data.direct?.financing} onOpenHref={onOpenHref} t={t} numAlign={numAlign} />
                                    </>
                                )}
                            </tbody>
                            <tfoot>
                                {[
                                    ['open', t('reports.openingCash'), block.openingCash, false],
                                    ['net', t('reports.netChangeCash'), block.netChange, false],
                                    ['close', t('reports.closingCash'), block.closingCash, true],
                                ].map(([k, label, v, strong]) => (
                                    <tr key={k} style={{ borderTop: strong ? '2px solid #0F172A' : '1px solid #E2E8F0' }}>
                                        <td colSpan={isIndirect ? 1 : 3} style={{ fontWeight: 800, fontSize: strong ? 15 : 13 }}>{label}</td>
                                        <td style={{ textAlign: numAlign, whiteSpace: 'nowrap', fontWeight: 800 }}>{amt(v, strong ? 13 : 12)}</td>
                                    </tr>
                                ))}
                                {isIndirect ? (
                                    <tr>
                                        <td style={{ fontSize: 12, color: '#64748B' }}>{t('reports.cf8.reconDebug')}</td>
                                        <td style={{ textAlign: numAlign, whiteSpace: 'nowrap', fontSize: 12, color: recon === 0 ? '#065F46' : '#B91C1C' }}>{amt(recon)}</td>
                                    </tr>
                                ) : null}
                            </tfoot>
                        </table>
                    </div>
                    {isIndirect && Number(checks.operatingMethodDifference ?? 0) !== 0 ? (
                        <p style={{ fontSize: 11, color: '#64748B', margin: '6px 0 0', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                            {t('reports.cf8.opMethodDiff')} {amt(checks.operatingMethodDifference, 10)}
                        </p>
                    ) : null}

                    <h4 style={{ margin: '18px 0 6px', fontSize: 13, fontWeight: 800, color: '#0F172A' }}>{t('reports.cf8.cashAccounts')}</h4>
                    <div style={{ width: '100%', overflowX: 'auto' }}>
                        <table className="ws-table" style={{ width: '100%', minWidth: 520 }}>
                            <thead>
                                <tr>
                                    <th>{t('reports.cf8.th.account')}</th>
                                    <th style={{ textAlign: numAlign }}>{t('reports.cf8.th.opening')}</th>
                                    <th style={{ textAlign: numAlign }}>{t('reports.cf8.th.movement')}</th>
                                    <th style={{ textAlign: numAlign }}>{t('reports.cf8.th.closing')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(data.cashAccounts || []).map((a) => (
                                    <tr
                                        key={a.accountId}
                                        data-account-id={a.accountId}
                                        role="button"
                                        tabIndex={0}
                                        style={CLICKABLE_ROW}
                                        onClick={() => onOpenHref(a.proof?.sourceHref)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                onOpenHref(a.proof?.sourceHref);
                                            }
                                        }}
                                    >
                                        <td style={{ color: '#475569' }}>[{a.code}] {a.name}</td>
                                        <td style={{ textAlign: numAlign, whiteSpace: 'nowrap' }}>{amt(a.openingBalance)}</td>
                                        <td style={{ textAlign: numAlign, whiteSpace: 'nowrap' }}>{amt(a.movement)}</td>
                                        <td style={{ textAlign: numAlign, whiteSpace: 'nowrap' }}>{amt(a.closingBalance)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr style={{ borderTop: '1px solid #E2E8F0' }}>
                                    <td style={{ fontWeight: 800 }}>{t('reports.cf8.cashAccounts')}</td>
                                    <td style={{ textAlign: numAlign, whiteSpace: 'nowrap', fontWeight: 800 }}>{amt(checks.openingCash ?? 0)}</td>
                                    <td style={{ textAlign: numAlign, whiteSpace: 'nowrap', fontWeight: 800 }}>{amt(checks.cashGlMovement ?? 0)}</td>
                                    <td style={{ textAlign: numAlign, whiteSpace: 'nowrap', fontWeight: 800 }}>{amt(checks.closingCash ?? 0)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

/** SP-09 — General Ledger: one row per posting account; a row opens the existing ledger statement. */
function GeneralLedger({ locale, t }) {
    const navigate = useNavigate();
    const isAr = locale === 'ar';
    const numAlign = isAr ? 'left' : 'right';
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [exporting, setExporting] = useState('');
    const canExport = useSupplierCan()(SUPPLIER_PERM.reportsExport); // SP-22
    const [showZeros, setShowZeros] = useState(false);
    const [{ dateFrom, dateTo }, setRange] = useState({ dateFrom: startOfMonthISO(), dateTo: todayISO() });

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const res = await getSupplierGeneralLedger({ dateFrom, dateTo, showZeros: showZeros ? '1' : undefined });
            setData(res);
        } catch (e) {
            setErr(e?.message || t('reports.gl.err'));
        } finally {
            setLoading(false);
        }
    }, [dateFrom, dateTo, showZeros, t]);

    useEffect(() => { load(); }, [load]);

    const runExport = async (kind) => {
        if (!data || exporting) return;
        setExporting(kind);
        setErr('');
        try {
            const mod = await import('../../../utils/supplierLedgerExport');
            if (kind === 'pdf') await mod.exportSupplierGeneralLedgerPdf({ data });
            else mod.exportSupplierGeneralLedgerExcel({ data });
        } catch (e) {
            setErr(t('reports.export.err', { error: e?.message || String(e) }));
        } finally {
            setExporting('');
        }
    };

    const rows = Array.isArray(data?.accounts) ? data.accounts : [];
    const showOpening = Boolean(data?.dateFrom);
    const checks = data?.checks || {};
    const ok = Boolean(data) && checks.periodBalanced && checks.matchesTrialBalance;
    const amt = (v) => <SupplierRiyalAmount amount={v} size={12} />;
    const open = (r) => r?.proof?.sourceHref && navigate(r.proof.sourceHref);
    const cols = showOpening ? 8 : 7;

    return (
        <div style={{ overflowX: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0F172A' }}>{t('reports.gl.title')}</h3>
                    <div style={{ marginTop: 4, fontSize: 12, color: '#64748B' }}>
                        {data?.dateFrom || data?.dateTo
                            ? t('reports.tb6.range', { from: data?.dateFrom || '…', to: data?.dateTo || '…' })
                            : t('reports.tb6.allDates')}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" style={outlineBtnStyle} disabled={!data || Boolean(exporting) || !canExport} title={canExport ? undefined : t('perm.denied')} onClick={() => runExport('pdf')}>
                        {exporting === 'pdf' ? t('reports.export.busy') : t('reports.export.pdf')}
                    </button>
                    <button type="button" style={outlineBtnStyle} disabled={!data || Boolean(exporting) || !canExport} title={canExport ? undefined : t('perm.denied')} onClick={() => runExport('excel')}>
                        {exporting === 'excel' ? t('reports.export.busy') : t('reports.export.excel')}
                    </button>
                </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
                <ReportDateBar locale={locale} dateFrom={dateFrom} dateTo={dateTo} onChange={setRange} />
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#334155', cursor: 'pointer' }}>
                    <input type="checkbox" checked={showZeros} onChange={(e) => setShowZeros(e.target.checked)} />
                    {t('reports.gl.showZeros')}
                </label>
            </div>
            <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 10, border: '1px solid #A7F3D0', background: '#ECFDF5', color: '#065F46', fontSize: 12 }}>
                {t('reports.gl.note')}
            </div>
            <AcctError message={err} />
            {!loading && data ? (
                <div
                    role="status"
                    style={{
                        marginBottom: 12,
                        padding: '10px 12px',
                        borderRadius: 10,
                        fontSize: 13,
                        fontWeight: 700,
                        border: `1px solid ${ok ? '#A7F3D0' : '#FECACA'}`,
                        background: ok ? '#ECFDF5' : '#FEF2F2',
                        color: ok ? '#065F46' : '#B91C1C',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        flexWrap: 'wrap',
                    }}
                >
                    {ok ? t('reports.gl.balanced') : (
                        <>
                            {t('reports.gl.unbalanced')} {amt(checks.periodDifference ?? 0)}
                        </>
                    )}
                </div>
            ) : null}
            {loading ? <AcctLoading locale={locale} /> : !data ? <AcctEmpty message={t('reports.noData')} /> : (
                <div style={{ width: '100%', overflowX: 'auto' }}>
                    <table className="ws-table" style={{ width: '100%', minWidth: 760 }}>
                        <thead>
                            <tr>
                                <th>{t('reports.gl.th.code')}</th>
                                <th>{t('reports.gl.th.account')}</th>
                                <th>{t('reports.gl.th.type')}</th>
                                {showOpening ? <th style={{ textAlign: numAlign }}>{t('reports.gl.th.opening')}</th> : null}
                                <th style={{ textAlign: numAlign }}>{t('reports.gl.th.debit')}</th>
                                <th style={{ textAlign: numAlign }}>{t('reports.gl.th.credit')}</th>
                                <th style={{ textAlign: numAlign }}>{t('reports.gl.th.closing')}</th>
                                <th style={{ textAlign: numAlign }}>{t('reports.gl.th.lines')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 ? (
                                <tr><td colSpan={cols} style={{ color: '#64748B' }}>{t('reports.noData')}</td></tr>
                            ) : rows.map((r) => (
                                <tr
                                    key={r.id}
                                    data-account-id={r.id}
                                    role="button"
                                    tabIndex={0}
                                    title={t('reports.gl.openStatement')}
                                    style={CLICKABLE_ROW}
                                    onClick={() => open(r)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            open(r);
                                        }
                                    }}
                                >
                                    <td style={{ whiteSpace: 'nowrap', color: '#475569' }}>{r.code}</td>
                                    <td style={{ color: '#0F172A' }}>{r.name}</td>
                                    <td style={{ fontSize: 11, color: '#64748B' }}>{t(`reports.gl.type.${r.type}`)}</td>
                                    {showOpening ? <td style={{ textAlign: numAlign, whiteSpace: 'nowrap' }}>{amt(r.openingBalance)}</td> : null}
                                    <td style={{ textAlign: numAlign, whiteSpace: 'nowrap' }}>{amt(r.periodDebit)}</td>
                                    <td style={{ textAlign: numAlign, whiteSpace: 'nowrap' }}>{amt(r.periodCredit)}</td>
                                    <td style={{ textAlign: numAlign, whiteSpace: 'nowrap', fontWeight: 700 }}>{amt(r.closingBalance)}</td>
                                    <td style={{ textAlign: numAlign, color: '#475569' }}>{r.lineCount}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr style={{ borderTop: '2px solid #0F172A' }}>
                                <td colSpan={showOpening ? 4 : 3} style={{ fontWeight: 800 }}>{t('reports.gl.totals')}</td>
                                <td style={{ textAlign: numAlign, whiteSpace: 'nowrap', fontWeight: 800 }}>{amt(data.totals?.periodDebit ?? 0)}</td>
                                <td style={{ textAlign: numAlign, whiteSpace: 'nowrap', fontWeight: 800 }}>{amt(data.totals?.periodCredit ?? 0)}</td>
                                <td />
                                <td style={{ textAlign: numAlign, fontWeight: 800 }}>{data.totals?.lineCount ?? 0}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </div>
    );
}

/** SP-10 — AR / AP aging with GL tie-out; a party row opens its statement (existing ledger). */
const AGING_BUCKETS = ['current', 'd1_30', 'd31_60', 'd61_90', 'd90_plus'];

function AgingReport({ locale, t, initialKind = 'ar' }) {
    const navigate = useNavigate();
    const isAr = locale === 'ar';
    const numAlign = isAr ? 'left' : 'right';
    const [kind, setKind] = useState(initialKind === 'ap' ? 'ap' : 'ar');
    const [asOf, setAsOf] = useState(todayISO());
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [exporting, setExporting] = useState('');
    const canExport = useSupplierCan()(SUPPLIER_PERM.reportsExport); // SP-22
    const [expanded, setExpanded] = useState(() => new Set());

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const fn = kind === 'ap' ? getSupplierApAging : getSupplierArAging;
            setData(await fn({ asOf }));
            setExpanded(new Set());
        } catch (e) {
            setErr(e?.message || t('reports.aging.err'));
        } finally {
            setLoading(false);
        }
    }, [kind, asOf, t]);

    useEffect(() => { load(); }, [load]);

    const runExport = async (type) => {
        if (!data || exporting) return;
        setExporting(type);
        setErr('');
        try {
            const mod = await import('../../../utils/supplierLedgerExport');
            if (type === 'pdf') await mod.exportSupplierAgingPdf({ data });
            else mod.exportSupplierAgingExcel({ data });
        } catch (e) {
            setErr(t('reports.export.err', { error: e?.message || String(e) }));
        } finally {
            setExporting('');
        }
    };

    const amt = (v) => <SupplierRiyalAmount amount={v} size={12} />;
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    const chk = data?.check || {};
    const toggle = (key) =>
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    const banner = (tone, children, key) => {
        const c = tone === 'ok'
            ? ['#A7F3D0', '#ECFDF5', '#065F46']
            : tone === 'warn'
              ? ['#FDE68A', '#FFFBEB', '#92400E']
              : ['#FECACA', '#FEF2F2', '#B91C1C'];
        return (
            <div key={key} role="status" style={{ marginBottom: 8, padding: '8px 12px', borderRadius: 10, border: `1px solid ${c[0]}`, background: c[1], color: c[2], fontSize: 12, fontWeight: 600, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
                {children}
            </div>
        );
    };

    return (
        <div style={{ overflowX: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0F172A' }}>
                        {kind === 'ap' ? t('reports.aging.titleAp') : t('reports.aging.titleAr')}
                    </h3>
                    <div style={{ marginTop: 4, fontSize: 12, color: '#64748B' }}>
                        {t('reports.aging.asOfLine', { date: data?.asOf || asOf })}
                        {data?.controlAccounts?.length ? ` · ${data.controlAccounts.map((a) => a.code).join(' + ')}` : ''}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" style={outlineBtnStyle} disabled={!data || Boolean(exporting) || !canExport} title={canExport ? undefined : t('perm.denied')} onClick={() => runExport('pdf')}>
                        {exporting === 'pdf' ? t('reports.export.busy') : t('reports.export.pdf')}
                    </button>
                    <button type="button" style={outlineBtnStyle} disabled={!data || Boolean(exporting) || !canExport} title={canExport ? undefined : t('perm.denied')} onClick={() => runExport('excel')}>
                        {exporting === 'excel' ? t('reports.export.busy') : t('reports.export.excel')}
                    </button>
                </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                <div role="tablist" style={{ display: 'flex', gap: 6 }}>
                    <button type="button" style={kind === 'ar' ? primaryBtnStyle : outlineBtnStyle} onClick={() => setKind('ar')}>{t('reports.aging.tabAr')}</button>
                    <button type="button" style={kind === 'ap' ? primaryBtnStyle : outlineBtnStyle} onClick={() => setKind('ap')}>{t('reports.aging.tabAp')}</button>
                </div>
                <Field label={t('reports.asOf')}>
                    <input type="date" style={inputStyle} value={asOf} onChange={(e) => e.target.value && setAsOf(e.target.value)} />
                </Field>
            </div>
            <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 10, border: '1px solid #A7F3D0', background: '#ECFDF5', color: '#065F46', fontSize: 12 }}>
                {t('reports.aging.note')}
            </div>
            <AcctError message={err} />
            {!loading && data ? (
                <>
                    {chk.tiesToGl
                        ? banner('ok', <>{t('reports.aging.tiesGl')} {amt(chk.glControl)}</>, 'gl')
                        : banner('bad', <>{t('reports.aging.notTiesGl')} {amt(chk.agingVsGl)}</>, 'gl')}
                    {Number(chk.untagged || 0) !== 0
                        ? banner('warn', <>{t('reports.aging.untagged')} {amt(chk.untagged)}</>, 'untagged')
                        : null}
                    {Number(chk.documentVsGl || 0) !== 0
                        ? banner(
                            'bad',
                            <>
                                {t('reports.aging.docGap', { basis: chk.documentBasis || '' })} {amt(chk.documentSubledger)}
                                <span>{t('reports.aging.vsGl')}</span> {amt(chk.glControl)}
                                <span>{t('reports.aging.gap')}</span> {amt(chk.documentVsGl)}
                            </>,
                            'docs',
                        )
                        : banner('ok', t('reports.aging.docsTie'), 'docs')}
                </>
            ) : null}
            {loading ? <AcctLoading locale={locale} /> : !data ? <AcctEmpty message={t('reports.noData')} /> : (
                <div style={{ width: '100%', overflowX: 'auto' }}>
                    <table className="ws-table" style={{ width: '100%', minWidth: 820 }}>
                        <thead>
                            <tr>
                                <th>{kind === 'ap' ? t('reports.aging.th.vendor') : t('reports.aging.th.customer')}</th>
                                {AGING_BUCKETS.map((b) => (
                                    <th key={b} style={{ textAlign: numAlign }}>{t(`reports.aging.b.${b}`)}</th>
                                ))}
                                <th style={{ textAlign: numAlign }}>{t('reports.aging.th.total')}</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 ? (
                                <tr><td colSpan={8} style={{ color: '#64748B' }}>{t('reports.noData')}</td></tr>
                            ) : rows.flatMap((r) => {
                                const open = expanded.has(r.key);
                                const main = (
                                    <tr key={r.key} data-party-key={r.key}>
                                        <td>
                                            <button
                                                type="button"
                                                onClick={() => toggle(r.key)}
                                                aria-expanded={open}
                                                style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: r.isUntagged ? '#92400E' : '#0F172A', fontWeight: 600, textAlign: 'start' }}
                                            >
                                                {open ? '▾' : '▸'} {r.name}
                                                {(r.documents || []).length ? (
                                                    <span style={{ marginInlineStart: 6, fontSize: 11, color: '#94A3B8' }}>({r.documents.length})</span>
                                                ) : null}
                                            </button>
                                        </td>
                                        {AGING_BUCKETS.map((b) => (
                                            <td key={b} style={{ textAlign: numAlign, whiteSpace: 'nowrap' }}>{amt(r.buckets?.[b] ?? 0)}</td>
                                        ))}
                                        <td style={{ textAlign: numAlign, whiteSpace: 'nowrap', fontWeight: 800 }}>{amt(r.total)}</td>
                                        <td style={{ whiteSpace: 'nowrap' }}>
                                            {r.proof?.sourceHref ? (
                                                <button type="button" style={{ ...outlineBtnStyle, padding: '4px 10px', fontSize: 12 }} onClick={() => navigate(r.proof.sourceHref)}>
                                                    {t('reports.aging.statement')}
                                                </button>
                                            ) : null}
                                        </td>
                                    </tr>
                                );
                                if (!open) return [main];
                                const docs = (r.documents || []).map((d) => (
                                    <tr
                                        key={`${r.key}-${d.journalId}-${d.date}`}
                                        data-journal-id={d.journalId}
                                        role="button"
                                        tabIndex={0}
                                        style={{ ...CLICKABLE_ROW, background: '#F8FAFC' }}
                                        onClick={() => d.proof?.sourceHref && navigate(d.proof.sourceHref)}
                                        onKeyDown={(e) => {
                                            if ((e.key === 'Enter' || e.key === ' ') && d.proof?.sourceHref) {
                                                e.preventDefault();
                                                navigate(d.proof.sourceHref);
                                            }
                                        }}
                                    >
                                        <td style={{ paddingInlineStart: 22, fontSize: 12, color: '#475569' }}>
                                            {d.entryNumber || '—'}{d.docNo ? ` · ${d.docNo}` : ''} · {d.date}
                                            <span style={{ marginInlineStart: 6, color: '#94A3B8' }}>
                                                {t('reports.aging.due', { date: d.dueDate, days: d.daysOverdue })}
                                            </span>
                                        </td>
                                        {AGING_BUCKETS.map((b) => (
                                            <td key={b} style={{ textAlign: numAlign, whiteSpace: 'nowrap', fontSize: 12 }}>
                                                {d.bucket === b ? amt(d.outstanding) : ''}
                                            </td>
                                        ))}
                                        <td style={{ textAlign: numAlign, whiteSpace: 'nowrap', fontSize: 12, color: '#64748B' }}>
                                            {t('reports.aging.ofOriginal')} {amt(d.original)}
                                        </td>
                                        <td />
                                    </tr>
                                ));
                                const credit = Number(r.unappliedCredit || 0) > 0 ? (
                                    <tr key={`${r.key}-credit`} style={{ background: '#F8FAFC' }}>
                                        <td style={{ paddingInlineStart: 22, fontSize: 12, color: '#92400E' }}>{t('reports.aging.unapplied')}</td>
                                        <td style={{ textAlign: numAlign, fontSize: 12 }}>{amt(-Number(r.unappliedCredit))}</td>
                                        <td colSpan={6} />
                                    </tr>
                                ) : null;
                                return [main, ...docs, credit].filter(Boolean);
                            })}
                        </tbody>
                        <tfoot>
                            <tr style={{ borderTop: '2px solid #0F172A' }}>
                                <td style={{ fontWeight: 800 }}>{t('reports.aging.th.total')}</td>
                                {AGING_BUCKETS.map((b) => (
                                    <td key={b} style={{ textAlign: numAlign, whiteSpace: 'nowrap', fontWeight: 800 }}>{amt(data.totals?.buckets?.[b] ?? 0)}</td>
                                ))}
                                <td style={{ textAlign: numAlign, whiteSpace: 'nowrap', fontWeight: 800 }}>{amt(data.totals?.total ?? 0)}</td>
                                <td />
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </div>
    );
}

/** Exact 2-dp sums for display totals (BigInt cents, no float drift, no Math.round). */
function centsOf(v) {
    const s = String(v ?? '0').trim();
    if (!/^-?\d*(\.\d*)?$/.test(s) || s === '' || s === '-') return 0n;
    const neg = s.startsWith('-');
    const [i = '0', f = ''] = s.replace('-', '').split('.');
    let c = BigInt(i || '0') * 100n + BigInt((f + '00').slice(0, 2));
    if (f.length > 2 && Number(f[2]) >= 5) c += 1n;
    return neg ? -c : c;
}
function centsStr(c) {
    const neg = c < 0n;
    const a = neg ? -c : c;
    return `${neg ? '-' : ''}${a / 100n}.${String(a % 100n).padStart(2, '0')}`;
}

/**
 * SP-19 — GRNI aging (tab inside the reports shell, not a new app). Open 2010 credit per goods
 * receipt (posted / partially invoiced), aged from the GR business date (Asia/Riyadh); GL 2010
 * from the trial balance as of today. Row → existing GR detail; the 2010 line → 2010 ledger.
 */
function GrniAging({ locale, t }) {
    const navigate = useNavigate();
    const numAlign = locale === 'ar' ? 'left' : 'right';
    const [rows, setRows] = useState([]);
    const [gl, setGl] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const today = todayISO();

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setErr('');
            try {
                const out = [];
                for (let page = 0; page < 1000; page += 1) {
                    const res = await listSupplierGoodsReceipts({ unmatchedOnly: 'true', limit: 200, offset: out.length });
                    const batch = Array.isArray(res?.goodsReceipts) ? res.goodsReceipts : [];
                    const total = Number(res?.total ?? 0) || 0;
                    out.push(...batch);
                    if (!batch.length || (total && out.length >= total)) break;
                }
                const tb = await getSupplierTrialBalance({ dateFrom: '', dateTo: today });
                const acc = (tb?.accounts || tb?.data?.accounts || []).find((a) => String(a.code) === '2010');
                if (cancelled) return;
                setRows(out.filter((r) => centsOf(r.grniOpen) !== 0n));
                setGl(
                    acc
                        ? {
                              accountId: acc.proof?.accountId || acc.accountId,
                              balance: centsStr(centsOf(acc.closingCredit) - centsOf(acc.closingDebit)),
                          }
                        : { accountId: null, balance: null },
                );
            } catch (e) {
                if (!cancelled) setErr(e?.message || t('grni.err'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [t, today]);

    const ageDays = (ymd) => {
        const a = Date.parse(`${ymd}T00:00:00Z`);
        const b = Date.parse(`${today}T00:00:00Z`);
        return Number.isFinite(a) && Number.isFinite(b) ? Math.max(0, Math.floor((b - a) / 86400000)) : '';
    };
    const total = centsStr(rows.reduce((s, r) => s + centsOf(r.grniOpen), 0n));
    const diff = gl?.balance != null ? centsStr(centsOf(gl.balance) - centsOf(total)) : null;
    const open = (r) => navigate(`/supplier/goods_receipts/${encodeURIComponent(r.id)}`);

    return (
        <div>
            <p style={{ margin: '0 0 10px', fontSize: 13, color: '#64748B' }}>{t('grni.hint')}</p>
            <AcctError message={err} />
            {loading ? (
                <AcctLoading locale={locale} />
            ) : (
                <>
                    {gl ? (
                        <div
                            role="status"
                            style={{
                                marginBottom: 10,
                                padding: '8px 12px',
                                borderRadius: 10,
                                fontSize: 12,
                                fontWeight: 700,
                                border: `1px solid ${diff === '0.00' ? '#A7F3D0' : '#FECACA'}`,
                                background: diff === '0.00' ? '#ECFDF5' : '#FEF2F2',
                                color: diff === '0.00' ? '#065F46' : '#B91C1C',
                            }}
                        >
                            {gl.balance == null
                                ? t('grni.noGl')
                                : diff === '0.00'
                                  ? t('grni.ties', { gl: gl.balance })
                                  : t('grni.gap', { gl: gl.balance, open: total, diff })}
                            {gl.accountId ? (
                                <button
                                    type="button"
                                    style={{ ...outlineBtnStyle, padding: '2px 8px', fontSize: 12, marginInlineStart: 8 }}
                                    onClick={() => navigate(reportLedgerHref(gl.accountId, { from: 'grni', dateTo: today }))}
                                >
                                    {t('grni.openGl')}
                                </button>
                            ) : null}
                        </div>
                    ) : null}
                    {rows.length === 0 ? (
                        <AcctEmpty message={t('grni.empty')} />
                    ) : (
                        <div style={{ width: '100%', overflowX: 'auto' }}>
                            <table className="ws-table" style={{ width: '100%' }}>
                                <thead>
                                    <tr>
                                        <th>{t('grni.th.gr')}</th>
                                        <th>{t('grni.th.received')}</th>
                                        <th>{t('grni.th.warehouse')}</th>
                                        <th style={{ textAlign: numAlign }}>{t('grni.th.age')}</th>
                                        <th style={{ textAlign: numAlign }}>{t('grni.th.open')}</th>
                                        <th />
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((r) => (
                                        <tr
                                            key={r.id}
                                            className="sp-drill-row"
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => open(r)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    open(r);
                                                }
                                            }}
                                        >
                                            <td style={{ fontWeight: 700 }}>{r.grNumber}</td>
                                            <td>{r.businessDate}</td>
                                            <td>{r.warehouseName || t('emdash')}</td>
                                            <td style={{ textAlign: numAlign }}>{t('grni.days', { n: ageDays(r.businessDate) })}</td>
                                            <td style={{ textAlign: numAlign, whiteSpace: 'nowrap' }}>
                                                <SupplierRiyalAmount amount={Number(r.grniOpen)} size={12} />
                                            </td>
                                            <td>
                                                <span className="sp-drill-link">{t('grni.openGr')}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr style={{ borderTop: '2px solid #0F172A' }}>
                                        <td colSpan={4} style={{ fontWeight: 800 }}>{t('reports.totals')}</td>
                                        <td style={{ textAlign: numAlign, fontWeight: 800, whiteSpace: 'nowrap' }}>
                                            <SupplierRiyalAmount amount={Number(total)} size={12} />
                                        </td>
                                        <td />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

/**
 * SP-20 — reports hub. Cards only: in-page reports switch the tab of THIS page; everything else
 * opens the surviving page (VAT, journals/day book, stock valuation, period close, …). No report
 * is cloned here.
 */
const HUB_CARDS = [
    { id: 'tb', tab: 'tb' },
    { id: 'pl', tab: 'pl' },
    { id: 'bs', tab: 'bs' },
    { id: 'cf', tab: 'cf' },
    { id: 'gl', tab: 'gl' },
    { id: 'acct', href: '/supplier/accounting/coa', page: 'coa' },
    { id: 'cust', href: '/supplier/accounting/reports_ar_ap', page: 'arap' },
    { id: 'vend', href: '/supplier/purchase_invoices?tab=super_suppliers', page: 'purchases' },
    { id: 'aging', tab: 'aging' },
    { id: 'cash', href: '/supplier/cash_accounts', page: 'cash' },
    // SP-11 Part B (bank-rec tables) still awaits Asif's approval — deep-link to the surviving cash page.
    { id: 'rec', href: '/supplier/cash_accounts', page: 'cash', soon: true },
    { id: 'vat', href: '/supplier/accounting/vat', page: 'vat' },
    { id: 'day', href: '/supplier/accounting/journals?view=daybook', page: 'journals' },
    { id: 'val', href: '/supplier/stock?tab=valuation', page: 'stock' },
    { id: 'sl', href: '/supplier/stock?tab=valuation', page: 'stock' },
    { id: 'grni', tab: 'grni' },
    { id: 'exp', href: '/supplier/expenses', page: 'expenses' },
    { id: 'pc', href: '/supplier/accounting/period-close', page: 'periodClose' },
];

function ReportsHub({ locale, t, onOpenTab }) {
    const navigate = useNavigate();
    const isAr = locale === 'ar';
    const asOf = new Intl.DateTimeFormat(isAr ? 'ar-SA-u-nu-latn-ca-gregory' : 'en-GB', {
        timeZone: 'Asia/Riyadh',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    }).format(new Date());
    const open = (c) => (c.tab ? onOpenTab(c.tab) : navigate(c.href));
    return (
        <div style={{ overflowX: 'hidden' }}>
            <p style={{ margin: '0 0 10px', fontSize: 13, color: '#64748B' }}>{t('rhub.sub', { date: asOf })}</p>
            <div
                style={{
                    marginBottom: 12,
                    padding: '10px 12px',
                    borderRadius: 10,
                    fontSize: 13,
                    border: '1px dashed #93C5FD',
                    background: '#EFF6FF',
                    color: '#1E3A8A',
                }}
            >
                {t('rhub.hint')}
            </div>
            <div className="sp-rhub-grid">
                {HUB_CARDS.map((c) => (
                    <button
                        key={c.id}
                        type="button"
                        className="sp-rhub-card"
                        data-hub-card={c.id}
                        onClick={() => open(c)}
                    >
                        <span className="sp-rhub-card__title">
                            {t(`rhub.${c.id}.t`)}
                            {c.soon ? <span className="sp-rhub-card__soon">{t('rhub.soon')}</span> : null}
                        </span>
                        <span className="sp-rhub-card__desc">{t(`rhub.${c.id}.d`)}</span>
                        <span className="sp-rhub-card__dest">
                            {c.tab ? t('rhub.opensHere') : t('rhub.opensPage', { page: t(`rhub.page.${c.page}`) })}
                            {isAr ? ' ←' : ' →'}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
}

const VALID_REPORT_TABS = new Set(['hub', ...REPORT_TAB_KEYS.map((k) => k.id)]);

export default function SupplierAccountingReports({ initialTab = 'tb', locale: localeProp }) {
    const reportsNavigate = useNavigate();
    const locale =
        localeProp ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => saccT(locale, key, vars), [locale]);
    const [searchParams, setSearchParams] = useSearchParams();
    // SP-20: the tab lives in `?tab=` (hub card / Back from a ledger / browser back all agree);
    // without it the route default applies (`/supplier/accounting/reports` → hub).
    const q = (searchParams.get('tab') || '').trim();
    const tab = VALID_REPORT_TABS.has(q) ? q : initialTab;
    const setTab = useCallback(
        (id) => {
            setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.set('tab', id);
                if (id !== 'aging') next.delete('aging');
                return next;
            });
        },
        [setSearchParams],
    );
    return (
        <div style={{ padding: 4, overflowX: 'hidden' }}>
            <AcctCard
                title={tab === 'hub' ? t('rhub.title') : t('reports.title')}
                action={(
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button type="button" style={tab === 'hub' ? primaryBtnStyle : outlineBtnStyle} onClick={() => setTab('hub')}>
                            {t('rhub.tab')}
                        </button>
                        {REPORT_TAB_KEYS.map((item) => (
                            <button key={item.id} type="button" style={tab === item.id ? primaryBtnStyle : outlineBtnStyle} onClick={() => setTab(item.id)}>
                                {t(item.key)}
                            </button>
                        ))}
                        {/* SP-15 — valuation lives on the existing stock page (Valuation tab) */}
                        <button type="button" style={outlineBtnStyle} onClick={() => reportsNavigate('/supplier/stock?tab=valuation')}>
                            {t('val.hubLink')}
                        </button>
                        {/* SP-14 — the single period-close screen */}
                        <button type="button" style={outlineBtnStyle} onClick={() => reportsNavigate('/supplier/accounting/period-close')}>
                            {t('pc.openLink')}
                        </button>
                    </div>
                )}
            >
                {tab === 'hub' && <ReportsHub locale={locale} t={t} onOpenTab={setTab} />}
                {tab === 'tb' && <TrialBalance locale={locale} t={t} />}
                {tab === 'pl' && <ProfitLoss locale={locale} t={t} />}
                {tab === 'bs' && <BalanceSheet locale={locale} t={t} />}
                {tab === 'cf' && <CashFlow locale={locale} t={t} />}
                {tab === 'gl' && <GeneralLedger locale={locale} t={t} />}
                {tab === 'grni' && <GrniAging locale={locale} t={t} />}
                {tab === 'aging' && (
                    <AgingReport locale={locale} t={t} initialKind={(searchParams.get('aging') || 'ar').trim()} />
                )}
            </AcctCard>
        </div>
    );
}
