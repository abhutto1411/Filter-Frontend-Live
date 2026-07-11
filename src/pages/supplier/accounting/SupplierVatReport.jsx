import React, { useCallback, useEffect, useState } from 'react';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { getSupplierVatReport } from '../../../services/supplierAccountingApi';
import {
    exportVatReportExcel,
    exportVatReportPdf,
} from '../../../utils/supplierLedgerExport';
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

export default function SupplierVatReport() {
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
            setErr(e?.message || 'Failed to load VAT report');
        } finally {
            setLoading(false);
        }
    }, [dateFrom, dateTo]);

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
                    VAT Report
                </h2>
                <p style={{ margin: '6px 0 0', color: '#64748B', fontSize: '0.875rem' }}>
                    Transaction-wise VAT input, output, and net payable to ZATCA
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
                    <div style={summaryLabelStyle}>Ledger account</div>
                    <div style={{ ...summaryValueStyle, fontSize: '1.2rem', marginTop: 6 }}>
                        {accountLabel}
                    </div>
                    {periodLabel ? (
                        <div style={{ marginTop: 8, fontSize: '0.875rem', color: '#64748B' }}>
                            Period: {periodLabel}
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
                            <div style={summaryLabelStyle}>Opening balance</div>
                            <div style={{ ...summaryValueStyle, fontSize: '1rem' }}>
                                {money(data?.openingPayable ?? 0)}
                            </div>
                        </div>
                        <div>
                            <div style={summaryLabelStyle}>Net change (period)</div>
                            <div style={{ ...summaryValueStyle, fontSize: '1rem' }}>
                                {money(periodNetChange)}
                            </div>
                        </div>
                        <div>
                            <div style={summaryLabelStyle}>Closing payable to ZATCA</div>
                            <div
                                style={{
                                    ...summaryValueStyle,
                                    fontSize: '1.25rem',
                                    color: '#0F172A',
                                }}
                            >
                                {money(closingPayable)}
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
                <Field label="From">
                    <input
                        type="date"
                        style={inputStyle}
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                    />
                </Field>
                <Field label="To">
                    <input
                        type="date"
                        style={inputStyle}
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                    />
                </Field>
                <button type="button" style={primaryBtnStyle} onClick={() => void load()} disabled={loading}>
                    {loading ? 'Loading…' : 'Apply filters'}
                </button>
                <button type="button" style={outlineBtnStyle} onClick={clearRange} disabled={loading}>
                    Clear filters
                </button>
                <div style={{ flex: 1, minWidth: 12 }} />
                <button
                    type="button"
                    className="btn-portal-outline"
                    onClick={onExportPdf}
                    disabled={!data || loading}
                >
                    <FileText size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                    Download PDF
                </button>
                <button
                    type="button"
                    className="btn-portal-outline"
                    onClick={onExportExcel}
                    disabled={!data || loading}
                >
                    <FileSpreadsheet size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                    Download Excel
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
                        <div style={summaryLabelStyle}>Total Sales (incl VAT)</div>
                        <div style={summaryValueStyle}>{money(totals.totalSaleInclVat)}</div>
                    </div>
                    <div style={summaryCardStyle}>
                        <div style={summaryLabelStyle}>Total Purchases (incl VAT)</div>
                        <div style={summaryValueStyle}>{money(totals.totalPurchaseInclVat)}</div>
                    </div>
                    <div style={summaryCardStyle}>
                        <div style={summaryLabelStyle}>Total VAT Output</div>
                        <div style={{ ...summaryValueStyle, color: '#0F766E' }}>
                            {money(totals.totalVatOutput)}
                        </div>
                    </div>
                    <div style={summaryCardStyle}>
                        <div style={summaryLabelStyle}>Total VAT Input</div>
                        <div style={{ ...summaryValueStyle, color: '#B91C1C' }}>
                            {money(totals.totalVatInput)}
                        </div>
                    </div>
                    <div style={summaryCardStyle}>
                        <div style={summaryLabelStyle}>Net change (period)</div>
                        <div style={summaryValueStyle}>{money(periodNetChange)}</div>
                    </div>
                    <div style={{ ...summaryCardStyle, borderColor: '#FED7AA', background: '#FFF7ED' }}>
                        <div style={summaryLabelStyle}>Closing payable to ZATCA</div>
                        <div style={{ ...summaryValueStyle, color: '#9A3412' }}>
                            {money(closingPayable)}
                        </div>
                    </div>
                </div>
            ) : null}

            {loading ? (
                <AcctLoading />
            ) : !rows.length && !data?.openingPayable ? (
                <AcctEmpty message="No VAT transactions in this period." />
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
                                <th style={{ width: 110 }}>Date</th>
                                <th style={{ width: 120 }}>Reference</th>
                                <th>Description</th>
                                <th style={{ width: 110, textAlign: 'right' }}>Sale incl VAT</th>
                                <th style={{ width: 110, textAlign: 'right' }}>Purchase incl VAT</th>
                                <th style={{ width: 100, textAlign: 'right' }}>VAT Output</th>
                                <th style={{ width: 100, textAlign: 'right' }}>VAT Input</th>
                                <th style={{ width: 120, textAlign: 'right' }}>Payable to ZATCA</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr style={{ background: '#F8FAFC', fontWeight: 700 }}>
                                <td>—</td>
                                <td>—</td>
                                <td>Opening balance</td>
                                <td style={{ textAlign: 'right' }}>—</td>
                                <td style={{ textAlign: 'right' }}>—</td>
                                <td style={{ textAlign: 'right' }}>—</td>
                                <td style={{ textAlign: 'right' }}>—</td>
                                <td style={{ textAlign: 'right' }}>
                                    {money(data?.openingPayable ?? 0)}
                                </td>
                            </tr>
                            {rows.map((r) => (
                                <tr key={r.id}>
                                    <td style={{ whiteSpace: 'nowrap' }}>{r.date}</td>
                                    <td>{r.reference || '—'}</td>
                                    <td>{r.description || '—'}</td>
                                    <td style={{ textAlign: 'right' }}>
                                        {r.saleInclVat > 0 ? money(r.saleInclVat) : ''}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        {r.purchaseInclVat > 0 ? money(r.purchaseInclVat) : ''}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        {r.vatOutput !== 0 ? money(r.vatOutput) : ''}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        {r.vatInput !== 0 ? money(r.vatInput) : ''}
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                        {money(r.payableToZatca)}
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
                                    <td>Closing summary</td>
                                    <td style={{ textAlign: 'right' }}>
                                        {money(totals.totalSaleInclVat)}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        {money(totals.totalPurchaseInclVat)}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>{money(totals.totalVatOutput)}</td>
                                    <td style={{ textAlign: 'right' }}>{money(totals.totalVatInput)}</td>
                                    <td style={{ textAlign: 'right' }}>
                                        {money(closingPayable)}
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
