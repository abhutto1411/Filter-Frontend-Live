import React from 'react';
import Modal from '../Modal';

const toNum = (v) => Number(v) || 0;

const formatOpenedAt = (counter) => {
    const epoch = counter?.openedAtEpochMs;
    if (epoch != null && Number.isFinite(Number(epoch))) {
        return new Date(Number(epoch)).toLocaleString();
    }
    return counter?.openedAt ?? counter?.startTime ?? '—';
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

export default function PosMonitoringKpiProofModal({
    kpiId,
    data,
    liveCounters,
    branchLabel,
    onClose,
}) {
    if (!kpiId) return null;

    const proof = data?.kpiProof ?? {};
    const tz = data?.businessCalendarTimeZone ?? data?.displayTimeZone ?? '—';
    const scopeLine = `Scope: ${branchLabel}`;

    let title = 'KPI breakdown';
    let body = null;

    if (kpiId === 'live_counters') {
        title = 'Live counters — breakdown';
        const rows = (liveCounters || []).map((c) => [
            c.cashierName || '—',
            c.branchName || '—',
            formatOpenedAt(c),
            c.shiftStatus || 'OPEN',
            `SAR ${toNum(c.shiftSales).toLocaleString()}`,
            String(toNum(c.shiftOpenOrders)),
            c.shiftElapsedTime || '—',
        ]);
        body = (
            <>
                <p className="ws-kpi-proof-methodology">
                    Active open POS sessions (status = open). One row per cashier currently logged in on a counter.
                </p>
                <p className="ws-kpi-proof-methodology">{scopeLine}</p>
                <KpiProofSummaryGrid
                    items={[
                        { label: 'Total live counters', value: String(liveCounters?.length ?? 0) },
                    ]}
                />
                <KpiProofTable
                    headers={['Cashier', 'Branch', 'Opened at', 'Status', 'Shift sales', 'Open orders', 'Elapsed']}
                    rows={rows}
                    emptyMessage="No live counters right now."
                />
            </>
        );
    }

    if (kpiId === 'open_orders') {
        title = 'Open orders — breakdown';
        const orders = proof.openOrders ?? [];
        if (!data?.kpiProof && !orders.length) {
            body = (
                <p className="ws-kpi-proof-methodology">
                    Proof list requires an updated backend. Refresh after deploying the latest API, or use the Live Counters table for per-cashier open order counts.
                </p>
            );
        } else {
        const statuses = (proof.openOrderStatuses ?? ['draft', 'in progress', 'ready_for_invoice']).join(', ');
        const rows = orders.map((o) => [
            `#${o.salesOrderId}`,
            o.branchName || '—',
            o.cashierName || '—',
            o.status || '—',
            o.createdAt || '—',
        ]);
        const listedSum = orders.length;
        const headline = toNum(proof.openOrdersCount ?? data?.openOrdersCount);
        body = (
            <>
                <p className="ws-kpi-proof-methodology">
                    Count of sales orders in status: {statuses}. Not yet invoiced / still in progress on the workshop floor.
                </p>
                <p className="ws-kpi-proof-methodology">{scopeLine}</p>
                <KpiProofSummaryGrid
                    items={[
                        { label: 'KPI total', value: String(headline) },
                        { label: 'Rows listed', value: `${listedSum}${listedSum >= 200 ? ' (max 200)' : ''}` },
                    ]}
                />
                <KpiProofTable
                    headers={['Order', 'Branch', 'Created by', 'Status', 'Created at']}
                    rows={rows}
                    emptyMessage="No open orders match this scope."
                />
            </>
        );
        }
    }

    if (kpiId === 'today_sales') {
        title = 'Today sales — breakdown';
        const invoices = proof.todayInvoices ?? [];
        if (!data?.kpiProof && !invoices.length) {
            body = (
                <p className="ws-kpi-proof-methodology">
                    Proof list requires an updated backend. KPI total uses sum of today&apos;s invoice amounts for this scope.
                </p>
            );
        } else {
        const todayDate = proof.todayCalendarDate ?? 'today';
        const rows = invoices.map((inv) => [
            inv.invoiceNo || `#${inv.invoiceId}`,
            inv.branchName || '—',
            inv.cashierName || '—',
            inv.invoiceDate || '—',
            `SAR ${toNum(inv.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        ]);
        const listedTotal = invoices.reduce((s, inv) => s + toNum(inv.totalAmount), 0);
        const headline = toNum(proof.todayInvoicesTotal ?? data?.todaySales);
        body = (
            <>
                <p className="ws-kpi-proof-methodology">
                    Sum of invoice <strong>totalAmount</strong> where invoice date is {todayDate} (calendar: {tz}).
                </p>
                <p className="ws-kpi-proof-methodology">{scopeLine}</p>
                <KpiProofSummaryGrid
                    items={[
                        { label: 'KPI total', value: `SAR ${headline.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
                        { label: 'Listed invoices sum', value: `SAR ${listedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
                        { label: 'Invoices listed', value: `${invoices.length}${invoices.length >= 200 ? ' (max 200)' : ''}` },
                    ]}
                />
                <KpiProofTable
                    headers={['Invoice', 'Branch', 'Cashier', 'Date', 'Amount']}
                    rows={rows}
                    emptyMessage="No invoices for today in this scope."
                />
            </>
        );
        }
    }

    return (
        <Modal
            title={title}
            onClose={onClose}
            width={800}
            contentClassName="ws-modal-kpi-proof"
            footer={(
                <button type="button" className="btn-portal" onClick={onClose}>
                    Close
                </button>
            )}
        >
            {body ?? <p className="ws-kpi-proof-methodology">No breakdown available.</p>}
        </Modal>
    );
}
