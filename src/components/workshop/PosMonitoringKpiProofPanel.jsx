import React, { useEffect } from 'react';
import { X } from 'lucide-react';

const toNum = (v) => Number(v) || 0;

const formatOpenedAt = (counter, emdash) => {
    const epoch = counter?.openedAtEpochMs;
    if (epoch != null && Number.isFinite(Number(epoch))) {
        return new Date(Number(epoch)).toLocaleString();
    }
    return counter?.openedAt ?? counter?.startTime ?? emdash;
};

function KpiProofSummaryGrid({ items }) {
    return (
        <div className="ws-kpi-proof-summary-grid">
            {items.map((item) => (
                <div key={item.label} className="ws-kpi-proof-stat">
                    <span className="ws-kpi-proof-stat-label">{item.label}</span>
                    <span className="ws-kpi-proof-stat-value">{item.value}</span>
                </div>
            ))}
        </div>
    );
}

function KpiProofTable({ headers, rows, emptyMessage }) {
    if (!rows.length) {
        return <p className="ws-kpi-proof-note">{emptyMessage}</p>;
    }
    return (
        <div className="ws-kpi-proof-scroll">
            <table className="ws-table ws-kpi-proof-table">
                <thead>
                    <tr>
                        {headers.map((h) => (
                            <th key={h}>{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, rowIdx) => (
                        <tr key={rowIdx}>
                            {row.map((cell, cellIdx) => (
                                <td key={cellIdx}>{cell}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/** Inline KPI breakdown panel. */
export default function PosMonitoringKpiProofPanel({
    kpiId,
    data,
    liveCounters,
    branchLabel,
    t,
    onClose,
}) {
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') onClose?.();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    if (!kpiId) return null;

    const proof = data?.kpiProof ?? {};
    const tz = data?.businessCalendarTimeZone ?? data?.displayTimeZone ?? t('emdash');
    const scopeLine = t('kpi.scope', { branch: branchLabel });
    const em = t('emdash');

    let title = t('kpi.breakdownTitle');
    let body = null;

    if (kpiId === 'live_counters') {
        title = t('kpi.liveTitle');
        const rows = (liveCounters || []).map((c) => [
            c.cashierName || em,
            c.branchName || em,
            formatOpenedAt(c, em),
            c.shiftStatus || 'OPEN',
            `SAR ${toNum(c.shiftSales).toLocaleString()}`,
            String(toNum(c.shiftOpenOrders)),
            c.shiftElapsedTime || em,
        ]);
        body = (
            <>
                <p className="ws-kpi-proof-methodology">{t('kpi.liveMethod')}</p>
                <p className="ws-kpi-proof-methodology">{scopeLine}</p>
                <KpiProofSummaryGrid
                    items={[
                        { label: t('kpi.liveTotal'), value: String(liveCounters?.length ?? 0) },
                    ]}
                />
                <KpiProofTable
                    headers={[
                        t('th.cashier'),
                        t('th.branch'),
                        t('th.openedAt'),
                        t('th.status'),
                        t('th.shiftSales'),
                        t('th.openOrders'),
                        t('th.elapsed'),
                    ]}
                    rows={rows}
                    emptyMessage={t('empty.liveCounters')}
                />
            </>
        );
    }

    if (kpiId === 'open_orders') {
        title = t('kpi.openTitle');
        const orders = proof.openOrders ?? [];
        if (!data?.kpiProof && !orders.length) {
            body = <p className="ws-kpi-proof-methodology">{t('kpi.proofNeedsBackend')}</p>;
        } else {
            const statuses = (proof.openOrderStatuses ?? ['draft', 'in progress', 'ready_for_invoice']).join(', ');
            const rows = orders.map((o) => [
                `#${o.salesOrderId}`,
                o.branchName || em,
                o.cashierName || em,
                o.status || em,
                o.createdAt || em,
            ]);
            const listedSum = orders.length;
            const headline = toNum(proof.openOrdersCount ?? data?.openOrdersCount);
            body = (
                <>
                    <p className="ws-kpi-proof-methodology">{t('kpi.openMethod', { statuses })}</p>
                    <p className="ws-kpi-proof-methodology">{scopeLine}</p>
                    <KpiProofSummaryGrid
                        items={[
                            { label: t('kpi.kpiTotal'), value: String(headline) },
                            {
                                label: t('kpi.rowsListed'),
                                value: `${listedSum}${listedSum >= 200 ? t('kpi.max200') : ''}`,
                            },
                        ]}
                    />
                    <KpiProofTable
                        headers={[
                            t('kpi.th.order'),
                            t('th.branch'),
                            t('kpi.th.createdBy'),
                            t('th.status'),
                            t('kpi.th.createdAt'),
                        ]}
                        rows={rows}
                        emptyMessage={t('kpi.openEmpty')}
                    />
                </>
            );
        }
    }

    if (kpiId === 'today_sales') {
        title = t('kpi.todayTitle');
        const invoices = proof.todayInvoices ?? [];
        if (!data?.kpiProof && !invoices.length) {
            body = <p className="ws-kpi-proof-methodology">{t('kpi.todayNeedsBackend')}</p>;
        } else {
            const todayDate = proof.todayCalendarDate ?? t('kpi.todayWord');
            const rows = invoices.map((inv) => [
                inv.invoiceNo || `#${inv.invoiceId}`,
                inv.branchName || em,
                inv.cashierName || em,
                inv.invoiceDate || em,
                `SAR ${toNum(inv.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            ]);
            const listedTotal = invoices.reduce((s, inv) => s + toNum(inv.totalAmount), 0);
            const headline = toNum(proof.todayInvoicesTotal ?? data?.todaySales);
            body = (
                <>
                    <p className="ws-kpi-proof-methodology">
                        {t('kpi.todayMethod', { date: todayDate, tz })}
                    </p>
                    <p className="ws-kpi-proof-methodology">{scopeLine}</p>
                    <KpiProofSummaryGrid
                        items={[
                            {
                                label: t('kpi.kpiTotal'),
                                value: `SAR ${headline.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                            },
                            {
                                label: t('kpi.listedSum'),
                                value: `SAR ${listedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                            },
                            {
                                label: t('kpi.invoicesListed'),
                                value: `${invoices.length}${invoices.length >= 200 ? t('kpi.max200') : ''}`,
                            },
                        ]}
                    />
                    <KpiProofTable
                        headers={[
                            t('kpi.th.invoice'),
                            t('th.branch'),
                            t('th.cashier'),
                            t('kpi.th.date'),
                            t('kpi.th.amount'),
                        ]}
                        rows={rows}
                        emptyMessage={t('kpi.todayEmpty')}
                    />
                </>
            );
        }
    }

    return (
        <div
            className="cash-bank-stat-card ws-kpi-proof-panel"
            style={{ marginTop: 12, padding: 16 }}
            data-testid="pos-kpi-proof-panel"
            role="region"
            aria-label={title}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>{title}</h3>
                <button
                    type="button"
                    className="btn-portal-outline"
                    onClick={onClose}
                    aria-label={t('btn.close')}
                    style={{ height: 32, padding: '0 10px' }}
                >
                    <X size={14} />
                </button>
            </div>
            {body ?? <p className="ws-kpi-proof-methodology">{t('kpi.noBreakdown')}</p>}
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-portal-outline" onClick={onClose}>
                    {t('btn.close')}
                </button>
            </div>
        </div>
    );
}
