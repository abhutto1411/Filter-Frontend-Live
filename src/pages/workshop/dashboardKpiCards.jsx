import React from 'react';
import InventoryCostBasisSwitch from './inventoryCostBasisSwitch';
import { DASHBOARD_POINT_IN_TIME_KPI_IDS, formatDashKpiAmount } from './dashboardKpiMapper';

function money(amount, t) {
    const s = formatDashKpiAmount(amount);
    return s != null ? t('money.sar', { amount: s }) : t('emdash');
}

export function cardSubs(c, t) {
    const lines = [];
    if (c.id === 'sales') {
        if (c.salesClock === 'issued_at') {
            lines.push(t('kpi.salesClockIssuedAt'));
            if (c.calendarNetExVat != null && c.clockBridgeGapExVat != null) {
                lines.push(t('kpi.clockBridge', {
                    reports: formatDashKpiAmount(c.calendarNetExVat),
                    gap: formatDashKpiAmount(c.clockBridgeGapExVat),
                }));
            }
        } else if (c.salesClock === 'invoice_date') {
            lines.push(t('kpi.salesClockInvoiceDate'));
        }
        if (c.zatcaIncluded != null) {
            lines.push(t('kpi.zatcaIncluded', { n: c.zatcaIncluded }));
        }
    }
    if (c.id === 'income') {
        const income = t('kpi.sub.income');
        lines.push(c.branchName ? `${income} · ${c.branchName}` : income);
    }
    if (c.id === 'expenses') {
        lines.push(t('kpi.sub.expensesVatNa'));
    }
    if (c.id === 'netProfit' && c.marginPercent != null) {
        lines.push(t('kpi.sub.netProfitMargin', { x: Number(c.marginPercent).toFixed(2) }));
    }
    if (c.id === 'grossMargin' && c.grossMarginPercent != null) {
        lines.push(t('kpi.sub.grossMarginOfSales', { x: Number(c.grossMarginPercent).toFixed(2) }));
    }
    if (DASHBOARD_POINT_IN_TIME_KPI_IDS.includes(c.id) && (c.kpiAsOf || c.asOf)) {
        lines.push(t('kpi.sub.asOf', { date: c.kpiAsOf || c.asOf }));
    }
    if (c.id === 'accountsReceivable' && (c.arTrade != null || c.arDueFromHq != null)) {
        lines.push(t('kpi.sub.arBreakdown', {
            customers: formatDashKpiAmount(c.arTrade ?? 0),
            hq: formatDashKpiAmount(c.arDueFromHq ?? 0),
        }));
    }
    if (c.accountingBasis === 'cash') {
        lines.push(t('kpi.sub.cashBasis'));
    } else if (c.accountingBasis === 'snapshot') {
        lines.push(t('kpi.sub.bsSnapshot'));
    }
    if (c.id === 'pendingOrders') {
        const parts = [t('kpi.sub.pendingOrders')];
        if (c.unpaidInvoices != null) parts.push(t('kpi.sub.unpaidInvoices', { n: c.unpaidInvoices }));
        if (c.zatcaNotReported != null) parts.push(t('kpi.sub.zatcaNotReported', { n: c.zatcaNotReported }));
        lines.push(parts.join(' · '));
    }
    if (c.id === 'sales' && c.status === 'pending' && c.oldFigure != null) {
        lines.push(t('kpi.oldFigure', { amount: formatDashKpiAmount(c.oldFigure) }));
    }
    return lines;
}

export default function DashboardKpiCards({
    cards,
    onDrillDown,
    onRetry,
    t,
    inventoryCostBasis,
    onInventoryCostBasisChange,
    tInventoryCostBasis,
}) {
    return (
        <div>
            <div className="wsd-grid">
                {(cards || []).map((c) => {
                    const pending = c.status === 'pending';
                    const failed = c.status === 'error';
                    const up = c.changePercent != null && c.changePercent > 0;
                    const down = c.changePercent != null && c.changePercent < 0;
                    const absPct = c.changePercent != null ? Math.abs(c.changePercent).toFixed(2) : null;
                    const arrow = down ? '▼' : up ? '▲' : '';
                    const subs = (pending || failed) && !(c.id === 'sales' && c.oldFigure != null)
                        ? []
                        : cardSubs(c, t);
                    return (
                        <div
                            key={c.id}
                            className={`wsd-card${pending ? ' wsd-card--pending' : ''}${failed ? ' wsd-card--error' : ''}`}
                        >
                            <p className="wsd-card__label">
                                <span>{t(`kpi.card.${c.id}`)}</span>
                                {c.tooltip ? (
                                    <span className="wsd-card__i" title={c.tooltip} tabIndex={0} aria-label={c.tooltip}>i</span>
                                ) : null}
                            </p>
                            {c.id === 'inventoryValue' && onInventoryCostBasisChange && tInventoryCostBasis ? (
                                <div className="wsd-card__cost-basis">
                                    <InventoryCostBasisSwitch
                                        value={inventoryCostBasis}
                                        onChange={onInventoryCostBasisChange}
                                        t={tInventoryCostBasis}
                                    />
                                </div>
                            ) : null}
                            {failed ? (
                                <>
                                    <p className="wsd-card__value">{t('emdash')}</p>
                                    <p className="wsd-card__sub" role="alert">{c.errorMessage || t('kpi.loadFailed')}</p>
                                    {onRetry ? (
                                        <button type="button" className="wsd-card__link" onClick={() => onRetry(c)}>
                                            {t('btn.retry')}
                                        </button>
                                    ) : null}
                                </>
                            ) : c.status === 'notApplicable' ? (
                                <>
                                    <p className="wsd-card__value">{t('emdash')}</p>
                                    {c.warningKey ? (
                                        <p className="wsd-card__sub" role="status">{t(c.warningKey, c.warningVars)}</p>
                                    ) : null}
                                </>
                            ) : pending ? (
                                <>
                                    <p className="wsd-card__value">{t('emdash')}</p>
                                    <p className="wsd-card__sub">{t('kpi.availableAfterUpdate')}</p>
                                    {c.id === 'sales' && c.oldFigure != null ? (
                                        <p className="wsd-card__sub">{t('kpi.oldFigure', { amount: formatDashKpiAmount(c.oldFigure) })}</p>
                                    ) : null}
                                </>
                            ) : (
                                <>
                                    <p className="wsd-card__value">
                                        <span>{c.isCount ? c.value : money(c.value, t)}</span>
                                        {!c.isCount ? <span className="wsd-card__tag">{t('kpi.exVat')}</span> : null}
                                    </p>
                                    {c.warningKey ? (
                                        <p className="wsd-card__sub" role="status">{t(c.warningKey, c.warningVars)}</p>
                                    ) : null}
                                    {!c.hideIncVat && c.valueIncVat != null ? (
                                        <p className="wsd-card__inc">{t('kpi.incVatLine', { amount: money(c.valueIncVat, t) })}</p>
                                    ) : null}
                                    {absPct != null ? (
                                        <p className={`wsd-card__change${up ? ' wsd-card__change--up' : ''}${down ? ' wsd-card__change--down' : ''}`}>
                                            {t('kpi.changeVs', {
                                                arrow,
                                                pct: absPct,
                                                label: c.previousLabel || t('kpi.previousPeriod'),
                                            })}
                                        </p>
                                    ) : null}
                                    {subs.map((line) => (
                                        <p key={line} className="wsd-card__sub">{line}</p>
                                    ))}
                                    {c.drillDownTab ? (
                                        <button
                                            type="button"
                                            className="wsd-card__link"
                                            onClick={() => onDrillDown?.(c)}
                                        >
                                            {t('kpi.viewReport')}
                                        </button>
                                    ) : null}
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
            <p className="wsd-note">{t('dashboard.vatNote')}</p>
        </div>
    );
}
