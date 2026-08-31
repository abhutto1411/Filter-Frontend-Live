import React, { useCallback, useEffect, useState } from 'react';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { getSupplierVatReport } from '../../../services/supplierAccountingApi';
import {
    exportVatReportExcel,
    exportVatReportPdf,
} from '../../../utils/supplierLedgerExport';
import { saccT } from '../../../utils/supplierAccountingI18n';
import {
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

const summaryCardStyle = {
    padding: 14,
    borderRadius: 12,
    border: '1px solid #E2E8F0',
    background: '#FFFFFF',
};

const summaryLabelStyle = {
    fontSize: '0.72rem',
    fontWeight: 700,
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 6,
};

const summaryValueStyle = {
    fontSize: '1.125rem',
    fontWeight: 800,
    color: '#0F172A',
};

export default function SupplierVatReport({ locale: localeProp }) {
    const locale =
        localeProp ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => saccT(locale, key, vars), [locale]);
    const em = t('emdash');
    const m = (v) => money(v, 'SAR', { locale });

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [dateFrom, setDateFrom] = useState(startOfMonthISO());
    const [dateTo, setDateTo] = useState(todayISO());

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const res = await getSupplierVatReport({
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined,
            });
            const root = res?.data && typeof res.data === 'object' ? res.data : res;
            setData(root);
        } catch (e) {
            setErr(e?.message || t('vat.err.load'));
        } finally {
            setLoading(false);
        }
    }, [dateFrom, dateTo, t]);

    useEffect(() => {
        void load();
    }, [load]);

    function clearRange() {
        setDateFrom(startOfMonthISO());
        setDateTo(todayISO());
    }

    function onExportPdf() {
        if (!data) return;
        exportVatReportPdf({
            header: data.header,
            openingPayable: data.openingPayable,
            rows: data.rows ?? [],
            totals: data.totals,
            vatPayableAccount: data.vatPayableAccount,
        });
    }

    function onExportExcel() {
        if (!data) return;
        exportVatReportExcel({
            header: data.header,
            openingPayable: data.openingPayable,
            rows: data.rows ?? [],
            totals: data.totals,
            vatPayableAccount: data.vatPayableAccount,
        });
    }

    const rows = data?.rows ?? [];
    const totals = data?.totals;
    const accountLabel = data?.vatPayableAccount
        ? `[${data.vatPayableAccount.code}] ${data.vatPayableAccount.name}`
        : '';
    const closingPayable =
        totals?.closingPayable ??
        data?.vatPayableAccount?.closingBalance ??
        data?.vatPayableAccount?.netBalance ??
        0;
    const periodNetChange =
        totals?.periodNetChange ?? totals?.payableToZatca ?? 0;
    const periodLabel =
        data?.header?.from && data?.header?.to
            ? `${data.header.from} — ${data.header.to}`
            : null;

    return (
        <div>
            <div style={{ marginBottom: 16 }}>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0F172A' }}>
                    {t('vat.title')}
                </h2>
                <p style={{ margin: '6px 0 0', color: '#64748B', fontSize: '0.875rem' }}>
                    {t('vat.sub')}
                </p>
            </div>

            {accountLabel ? (
                <div
                    style={{
                        marginBottom: 16,
                        padding: '14px 16px',
                        borderRadius: 12,
                        border: '1px solid #CBD5E1',
                        background: '#FFFFFF',
                    }}
                >
                    <div style={summaryLabelStyle}>{t('vat.ledgerAccount')}</div>
                    <div style={{ ...summaryValueStyle, fontSize: '1.2rem', marginTop: 6 }}>
                        {accountLabel}
                    </div>
                    {periodLabel ? (
                        <div style={{ marginTop: 8, fontSize: '0.875rem', color: '#64748B' }}>
                            {t('vat.period', { period: periodLabel })}
                        </div>
                    ) : null}
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                            gap: 12,
                            marginTop: 12,
                        }}
                    >
                        <div>
                            <div style={summaryLabelStyle}>{t('vat.openingBal')}</div>
                            <div style={{ ...summaryValueStyle, fontSize: '1rem' }}>
                                {m(data?.openingPayable ?? 0)}
                            </div>
                        </div>
                        <div>
                            <div style={summaryLabelStyle}>{t('vat.netChange')}</div>
                            <div style={{ ...summaryValueStyle, fontSize: '1rem' }}>
                                {m(periodNetChange)}
                            </div>
                        </div>
                        <div>
                            <div style={summaryLabelStyle}>{t('vat.closingPayable')}</div>
                            <div
                                style={{
                                    ...summaryValueStyle,
                                    fontSize: '1.25rem',
                                    color: '#0F172A',
                                }}
                            >
                                {m(closingPayable)}
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

            <div
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 10,
                    alignItems: 'flex-end',
                    marginBottom: 16,
                }}
            >
                <Field label={t('logs.from')}>
                    <input
                        type="date"
                        style={inputStyle}
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                    />
                </Field>
                <Field label={t('logs.to')}>
                    <input
                        type="date"
                        style={inputStyle}
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                    />
                </Field>
                <button type="button" style={primaryBtnStyle} onClick={() => void load()} disabled={loading}>
                    {loading ? t('loading') : t('vat.apply')}
                </button>
                <button type="button" style={outlineBtnStyle} onClick={clearRange} disabled={loading}>
                    {t('vat.clear')}
                </button>
                <div style={{ flex: 1, minWidth: 12 }} />
                <button
                    type="button"
                    className="btn-portal-outline"
                    onClick={onExportPdf}
                    disabled={!data || loading}
                >
                    <FileText size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                    {t('vat.pdf')}
                </button>
                <button
                    type="button"
                    className="btn-portal-outline"
                    onClick={onExportExcel}
                    disabled={!data || loading}
                >
                    <FileSpreadsheet size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                    {t('vat.excel')}
                </button>
            </div>

            {err ? <AcctError message={err} /> : null}

            {totals ? (
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                        gap: 12,
                        marginBottom: 16,
                    }}
                >
                    <div style={summaryCardStyle}>
                        <div style={summaryLabelStyle}>{t('vat.totalSales')}</div>
                        <div style={summaryValueStyle}>{m(totals.totalSaleInclVat)}</div>
                    </div>
                    <div style={summaryCardStyle}>
                        <div style={summaryLabelStyle}>{t('vat.totalPurchases')}</div>
                        <div style={summaryValueStyle}>{m(totals.totalPurchaseInclVat)}</div>
                    </div>
                    <div style={summaryCardStyle}>
                        <div style={summaryLabelStyle}>{t('vat.totalOutput')}</div>
                        <div style={{ ...summaryValueStyle, color: '#0F766E' }}>
                            {m(totals.totalVatOutput)}
                        </div>
                    </div>
                    <div style={summaryCardStyle}>
                        <div style={summaryLabelStyle}>{t('vat.totalInput')}</div>
                        <div style={{ ...summaryValueStyle, color: '#B91C1C' }}>
                            {m(totals.totalVatInput)}
                        </div>
                    </div>
                    <div style={summaryCardStyle}>
                        <div style={summaryLabelStyle}>{t('vat.netChange')}</div>
                        <div style={summaryValueStyle}>{m(periodNetChange)}</div>
                    </div>
                    <div style={{ ...summaryCardStyle, borderColor: '#FED7AA', background: '#FFF7ED' }}>
                        <div style={summaryLabelStyle}>{t('vat.closingPayable')}</div>
                        <div style={{ ...summaryValueStyle, color: '#9A3412' }}>
                            {m(closingPayable)}
                        </div>
                    </div>
                </div>
            ) : null}

            {loading ? (
                <AcctLoading locale={locale} />
            ) : !rows.length && !data?.openingPayable ? (
                <AcctEmpty message={t('vat.empty')} />
            ) : (
                <div
                    style={{
                        border: '1px solid var(--color-border, #e2e8f0)',
                        borderRadius: 12,
                        overflow: 'hidden',
                    }}
                >
                    <table className="ws-table" style={{ margin: 0 }}>
                        <thead>
                            <tr>
                                <th style={{ width: 110 }}>{t('vat.th.date')}</th>
                                <th style={{ width: 120 }}>{t('vat.th.ref')}</th>
                                <th>{t('vat.th.desc')}</th>
                                <th style={{ width: 110, textAlign: 'right' }}>{t('vat.th.sale')}</th>
                                <th style={{ width: 110, textAlign: 'right' }}>{t('vat.th.purchase')}</th>
                                <th style={{ width: 100, textAlign: 'right' }}>{t('vat.th.output')}</th>
                                <th style={{ width: 100, textAlign: 'right' }}>{t('vat.th.input')}</th>
                                <th style={{ width: 120, textAlign: 'right' }}>{t('vat.th.payable')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr style={{ background: '#F8FAFC', fontWeight: 700 }}>
                                <td>{em}</td>
                                <td>{em}</td>
                                <td>{t('vat.openingBal')}</td>
                                <td style={{ textAlign: 'right' }}>{em}</td>
                                <td style={{ textAlign: 'right' }}>{em}</td>
                                <td style={{ textAlign: 'right' }}>{em}</td>
                                <td style={{ textAlign: 'right' }}>{em}</td>
                                <td style={{ textAlign: 'right' }}>
                                    {m(data?.openingPayable ?? 0)}
                                </td>
                            </tr>
                            {rows.map((r) => (
                                <tr key={r.id}>
                                    <td style={{ whiteSpace: 'nowrap' }}>{r.date}</td>
                                    <td>{r.reference || em}</td>
                                    <td>{r.description || em}</td>
                                    <td style={{ textAlign: 'right' }}>
                                        {r.saleInclVat > 0 ? m(r.saleInclVat) : ''}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        {r.purchaseInclVat > 0 ? m(r.purchaseInclVat) : ''}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        {r.vatOutput !== 0 ? m(r.vatOutput) : ''}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        {r.vatInput !== 0 ? m(r.vatInput) : ''}
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                        {m(r.payableToZatca)}
                                    </td>
                                </tr>
                            ))}
                            {totals ? (
                                <tr
                                    style={{
                                        background: '#FFF7ED',
                                        fontWeight: 800,
                                        borderTop: '1px solid #FED7AA',
                                    }}
                                >
                                    <td />
                                    <td />
                                    <td>{t('vat.closingSummary')}</td>
                                    <td style={{ textAlign: 'right' }}>
                                        {m(totals.totalSaleInclVat)}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        {m(totals.totalPurchaseInclVat)}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>{m(totals.totalVatOutput)}</td>
                                    <td style={{ textAlign: 'right' }}>{m(totals.totalVatInput)}</td>
                                    <td style={{ textAlign: 'right' }}>
                                        {m(closingPayable)}
                                    </td>
                                </tr>
                            ) : null}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
