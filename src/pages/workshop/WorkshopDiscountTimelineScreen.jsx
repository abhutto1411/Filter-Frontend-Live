import React, { useMemo } from 'react';
import { FileText } from 'lucide-react';
import WorkshopSubScreen from '../../components/workshop/WorkshopSubScreen';
import { exportDiscountTimelinePdf } from './workshopDiscountTimelineExport';

function fmtDt(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return '—';
    }
}

function fmtMoney(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return '0.00';
    return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatFilterRange(dateFrom, dateTo) {
    const from = dateFrom?.trim() ? fmtDt(dateFrom) : 'Beginning';
    const to = dateTo?.trim() ? fmtDt(dateTo) : 'Now';
    return `${from} → ${to}`;
}

const exportBtnStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    borderRadius: 8,
    border: '1px solid var(--color-border)',
    background: '#fff',
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: 'pointer',
    color: 'var(--color-text-dark)',
};

export default function WorkshopDiscountTimelineScreen({
    kind,
    title,
    rows = [],
    branchName,
    departmentName,
    dateFrom,
    dateTo,
    onBack,
}) {
    const totalAmount = useMemo(
        () => rows.reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0),
        [rows],
    );

    const uniqueInvoiceCount = useMemo(() => {
        const ids = new Set();
        rows.forEach((entry) => {
            if (entry.invoiceId != null) ids.add(String(entry.invoiceId));
            else if (entry.invoiceNo) ids.add(String(entry.invoiceNo));
        });
        return ids.size;
    }, [rows]);

    const exportDisabled = !rows.length;

    const handleExportPdf = () => {
        exportDiscountTimelinePdf({
            title,
            branchName,
            departmentName,
            dateFrom,
            dateTo,
            recordCount: rows.length,
            invoiceCount: uniqueInvoiceCount,
            totalAmount,
            rows,
        });
    };

    return (
        <WorkshopSubScreen
            title={title}
            subtitle={`${branchName} · ${departmentName}`}
            backLabel="Back to Discounts"
            onBack={onBack}
            size="xl"
        >
            <div className="ws-section" style={{ padding: 20 }}>
                <div
                    style={{
                        marginBottom: 20,
                        padding: '14px 16px',
                        background: '#F9FAFB',
                        borderRadius: 12,
                        border: '1px solid var(--color-border-light)',
                    }}
                >
                    <p style={{ margin: '0 0 8px', fontSize: '0.75rem', color: '#64748b' }}>
                        Period: <strong>{formatFilterRange(dateFrom, dateTo)}</strong>
                    </p>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                            gap: 12,
                            marginBottom: 12,
                        }}
                    >
                        <div
                            style={{
                                background: '#fff',
                                border: '1px solid #E5E7EB',
                                borderRadius: 10,
                                padding: '10px 14px',
                            }}
                        >
                            <div
                                style={{
                                    fontSize: '0.68rem',
                                    fontWeight: 800,
                                    letterSpacing: '0.04em',
                                    textTransform: 'uppercase',
                                    color: '#64748b',
                                }}
                            >
                                Records
                            </div>
                            <div style={{ marginTop: 4, fontSize: '1.05rem', fontWeight: 900 }}>
                                {rows.length}
                            </div>
                        </div>
                        <div
                            style={{
                                background: '#fff',
                                border: '1px solid #E5E7EB',
                                borderRadius: 10,
                                padding: '10px 14px',
                            }}
                        >
                            <div
                                style={{
                                    fontSize: '0.68rem',
                                    fontWeight: 800,
                                    letterSpacing: '0.04em',
                                    textTransform: 'uppercase',
                                    color: '#64748b',
                                }}
                            >
                                Invoices
                            </div>
                            <div style={{ marginTop: 4, fontSize: '1.05rem', fontWeight: 900 }}>
                                {uniqueInvoiceCount}
                            </div>
                        </div>
                        <div
                            style={{
                                background: '#fff',
                                border: '1px solid #E5E7EB',
                                borderRadius: 10,
                                padding: '10px 14px',
                            }}
                        >
                            <div
                                style={{
                                    fontSize: '0.68rem',
                                    fontWeight: 800,
                                    letterSpacing: '0.04em',
                                    textTransform: 'uppercase',
                                    color: '#64748b',
                                }}
                            >
                                Total ({kind})
                            </div>
                            <div style={{ marginTop: 4, fontSize: '1.05rem', fontWeight: 900 }}>
                                SAR {fmtMoney(totalAmount)}
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        disabled={exportDisabled}
                        title={exportDisabled ? 'No records to export' : 'Download PDF'}
                        onClick={handleExportPdf}
                        style={{
                            ...exportBtnStyle,
                            opacity: exportDisabled ? 0.5 : 1,
                            cursor: exportDisabled ? 'not-allowed' : 'pointer',
                        }}
                    >
                        <FileText size={14} aria-hidden /> Export PDF
                    </button>
                </div>

                {rows.length === 0 ? (
                    <p style={{ color: '#64748b', margin: 0 }}>No entries for the current filters.</p>
                ) : (
                    <div
                        style={{
                            overflowX: 'auto',
                            border: '1px solid var(--color-border-light)',
                            borderRadius: 12,
                        }}
                    >
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                            <thead>
                                <tr style={{ background: '#F9FAFB', textAlign: 'left' }}>
                                    <th style={{ padding: '10px 14px' }}>Date / time</th>
                                    <th style={{ padding: '10px 14px' }}>Invoice #</th>
                                    <th style={{ padding: '10px 14px' }}>Customer</th>
                                    <th style={{ padding: '10px 14px' }}>Branch</th>
                                    <th style={{ padding: '10px 14px' }}>Detail</th>
                                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((entry, idx) => (
                                    <tr
                                        key={`${entry.invoiceId}-${idx}`}
                                        style={{ borderTop: '1px solid #E5E7EB' }}
                                    >
                                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                                            {fmtDt(entry.at)}
                                        </td>
                                        <td style={{ padding: '10px 14px', fontWeight: 700 }}>
                                            {entry.invoiceNo}
                                        </td>
                                        <td style={{ padding: '10px 14px' }}>
                                            {entry.customerName || '—'}
                                        </td>
                                        <td style={{ padding: '10px 14px' }}>
                                            {entry.branchName || '—'}
                                        </td>
                                        <td style={{ padding: '10px 14px' }}>
                                            {entry.label}
                                            {entry.departmentName ? (
                                                <span style={{ color: '#64748b' }}>
                                                    {' '}
                                                    · {entry.departmentName}
                                                </span>
                                            ) : null}
                                        </td>
                                        <td
                                            style={{
                                                padding: '10px 14px',
                                                textAlign: 'right',
                                                fontWeight: 700,
                                            }}
                                        >
                                            SAR {fmtMoney(entry.amount)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </WorkshopSubScreen>
    );
}
