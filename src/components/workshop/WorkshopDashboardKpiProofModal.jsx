import React, { useCallback, useEffect, useState } from 'react';
import Modal from '../Modal';
import InvoiceDetailsModal from '../pos/modern/InvoiceDetailsModal';
import { apiFetch } from '../../services/api';
import { getWorkshopRecentOrderPdf, qs } from '../../services/workshopStaffApi';
import { riyadhRangeToApiIso, workshopAdminRangeQueryParams } from '../../utils/riyadhBusinessRange';
import WsTableScroll from './WsTableScroll';

function SummaryGrid({ items }) {
    return (
        <div className="ws-kpi-proof-summary-grid">
            {items.map((item) => {
                const clickable = typeof item.onClick === 'function';
                const Tag = clickable ? 'button' : 'div';
                return (
                    <Tag
                        key={item.label}
                        type={clickable ? 'button' : undefined}
                        className={`ws-kpi-proof-stat${clickable ? ' ws-kpi-proof-stat--clickable' : ''}${item.active ? ' is-active' : ''}`}
                        onClick={clickable ? item.onClick : undefined}
                        title={item.title || undefined}
                    >
                        <span className="ws-kpi-proof-stat-label">{item.label}</span>
                        <span className="ws-kpi-proof-stat-value">{item.value}</span>
                        {item.hint ? (
                            <span className="ws-kpi-proof-stat-hint">{item.hint}</span>
                        ) : null}
                    </Tag>
                );
            })}
        </div>
    );
}

function mapRecentPdfToInvoice(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const payload = raw.invoice || raw.data || raw;
    if (!payload || typeof payload !== 'object') return null;
    return payload;
}

function costSourceLabel(source, t) {
    const key = `kpi.proof.costSource.${source || 'none'}`;
    const translated = t(key);
    return translated === key ? (source || '—') : translated;
}

/**
 * Dashboard KPI proof: sales / gross margin / pending invoices (API),
 * or low-stock products (local list).
 */
export default function WorkshopDashboardKpiProofModal({
    kpiId,
    title,
    selectedBranchId = 'all',
    appliedRangeFrom = '',
    appliedRangeTo = '',
    lowStockProducts = [],
    onClose,
    onGoInventory,
    t,
}) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [proof, setProof] = useState(null);
    const [invoicePreview, setInvoicePreview] = useState(null);
    const [invoiceBusyId, setInvoiceBusyId] = useState('');
    const [showCogsLines, setShowCogsLines] = useState(false);

    const money = useCallback(
        (n) => t('money.sar', { amount: Number(n || 0).toLocaleString() }),
        [t],
    );

    useEffect(() => {
        setShowCogsLines(false);
        if (!kpiId || kpiId === 'low_stock' || kpiId === 'pending_approvals') {
            setProof(null);
            setError('');
            setLoading(false);
            return undefined;
        }
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError('');
            setProof(null);
            try {
                const params = { kpi: kpiId };
                if (selectedBranchId && selectedBranchId !== 'all') {
                    params.branchId = String(selectedBranchId);
                }
                if (appliedRangeFrom && appliedRangeTo) {
                    Object.assign(
                        params,
                        workshopAdminRangeQueryParams(appliedRangeFrom, appliedRangeTo),
                    );
                }
                const res = await apiFetch(`/workshop-staff/dashboard/kpi-proof${qs(params)}`);
                if (cancelled) return;
                if (!res?.success && !res?.kpi) {
                    throw new Error(t('kpi.proof.errLoad'));
                }
                setProof(res);
            } catch (e) {
                if (!cancelled) {
                    setError(e?.message || t('kpi.proof.errLoad'));
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [kpiId, selectedBranchId, appliedRangeFrom, appliedRangeTo, t]);

    const openInvoice = useCallback(
        async (invoiceId) => {
            if (!invoiceId) return;
            setInvoiceBusyId(String(invoiceId));
            try {
                const params = {};
                if (selectedBranchId && selectedBranchId !== 'all') {
                    params.branchId = String(selectedBranchId);
                } else {
                    params.allBranches = 'true';
                }
                if (appliedRangeFrom && appliedRangeTo) {
                    const iso = riyadhRangeToApiIso(appliedRangeFrom, appliedRangeTo);
                    params.startDate = iso.startDate;
                    params.endDate = iso.endDate;
                }
                const res = await getWorkshopRecentOrderPdf(invoiceId, params);
                const invoiceObj = mapRecentPdfToInvoice(res);
                if (!invoiceObj) throw new Error(t('kpi.proof.errInvoice'));
                setInvoicePreview(invoiceObj);
            } catch (e) {
                setError(e?.message || t('kpi.proof.errInvoice'));
            } finally {
                setInvoiceBusyId('');
            }
        },
        [selectedBranchId, appliedRangeFrom, appliedRangeTo, t],
    );

    if (!kpiId) return null;

    const scopeLine = t('kpi.proof.scope', {
        scope: proof?.dataScopeLabel || t('layout.allBranches'),
    });

    let body = null;

    if (kpiId === 'low_stock') {
        const rows = (lowStockProducts || []).map((p) => [
            p.name || t('lowStock.unnamed'),
            String(p.stock_qty ?? '—'),
            String(p.critical_level ?? '—'),
        ]);
        body = (
            <>
                <p className="ws-kpi-proof-methodology">{t('kpi.proof.lowStockFormula')}</p>
                <SummaryGrid
                    items={[
                        { label: t('kpi.proof.alertCount'), value: String(lowStockProducts.length) },
                    ]}
                />
                {rows.length === 0 ? (
                    <p className="ws-kpi-proof-note">{t('lowStock.healthy')}</p>
                ) : (
                    <WsTableScroll bodyClassName="ws-kpi-proof-scroll">
                        <table className="ws-table ws-kpi-proof-table">
                            <thead>
                                <tr>
                                    <th>{t('kpi.proof.th.product')}</th>
                                    <th>{t('kpi.proof.th.onHand')}</th>
                                    <th>{t('kpi.proof.th.critical')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, i) => (
                                    <tr key={i}>
                                        {row.map((cell, j) => (
                                            <td key={j}>{cell}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </WsTableScroll>
                )}
                {typeof onGoInventory === 'function' ? (
                    <div style={{ marginTop: 12 }}>
                        <button type="button" className="btn-portal" onClick={onGoInventory}>
                            {t('kpi.proof.goInventory')}
                        </button>
                    </div>
                ) : null}
            </>
        );
    } else if (loading) {
        body = <p className="ws-kpi-proof-note">{t('kpi.proof.loading')}</p>;
    } else if (error && !proof) {
        body = <p style={{ color: '#B91C1C' }}>{error}</p>;
    } else if (proof) {
        const invoices = Array.isArray(proof.invoices) ? proof.invoices : [];
        const cogsLines = Array.isArray(proof.cogs_lines) ? proof.cogs_lines : [];
        const summaryItems =
            kpiId === 'gross_margin'
                ? [
                    { label: t('kpi.proof.salesTotal'), value: money(proof.sales_total) },
                    {
                        label: t('kpi.proof.cogs'),
                        value: money(proof.purchase_cost),
                        hint: t('kpi.proof.cogsClickHint'),
                        title: t('kpi.proof.cogsClickHint'),
                        active: showCogsLines,
                        onClick: () => setShowCogsLines((v) => !v),
                    },
                    { label: t('kpi.proof.margin'), value: money(proof.gross_margin_profit) },
                    { label: t('kpi.proof.invoiceCount'), value: String(proof.invoice_count ?? 0) },
                ]
                : [
                    { label: t('kpi.proof.invoiceCount'), value: String(proof.invoice_count ?? 0) },
                    {
                        label: t('kpi.proof.reportedTotal'),
                        value: money(proof.total_amount ?? proof.sales_total),
                    },
                    { label: t('kpi.proof.sumShown'), value: money(proof.line_sum_check) },
                ];

        body = (
            <>
                <p className="ws-kpi-proof-methodology">{proof.formula || '—'}</p>
                <p className="ws-kpi-proof-methodology">{scopeLine}</p>
                <SummaryGrid items={summaryItems} />
                {error ? <p style={{ color: '#B91C1C', marginBottom: 8 }}>{error}</p> : null}

                {kpiId === 'gross_margin' && showCogsLines ? (
                    <>
                        <div className="ws-kpi-proof-section-head">
                            <strong>{t('kpi.proof.cogsLinesTitle')}</strong>
                            <button
                                type="button"
                                className="btn-portal-outline"
                                style={{ padding: '4px 10px', fontSize: 12 }}
                                onClick={() => setShowCogsLines(false)}
                            >
                                {t('kpi.proof.showInvoices')}
                            </button>
                        </div>
                        {proof.cogs_lines_truncated ? (
                            <p className="ws-kpi-proof-note">
                                {t('kpi.proof.showingCogsLines', { shown: cogsLines.length })}
                            </p>
                        ) : null}
                        <p className="ws-kpi-proof-note">
                            {t('kpi.proof.cogsLinesSum', {
                                sum: money(proof.cogs_lines_sum ?? proof.purchase_cost),
                                total: money(proof.purchase_cost),
                            })}
                        </p>
                        {cogsLines.length === 0 ? (
                            <p className="ws-kpi-proof-note">{t('kpi.proof.emptyCogsLines')}</p>
                        ) : (
                            <WsTableScroll bodyClassName="ws-kpi-proof-scroll">
                                <table className="ws-table ws-kpi-proof-table">
                                    <thead>
                                        <tr>
                                            <th>{t('kpi.proof.th.invoice')}</th>
                                            <th>{t('kpi.proof.th.type')}</th>
                                            <th>{t('kpi.proof.th.item')}</th>
                                            <th>{t('kpi.proof.th.qty')}</th>
                                            <th>{t('kpi.proof.th.catalogCost')}</th>
                                            <th>{t('kpi.proof.th.unitCost')}</th>
                                            <th>{t('kpi.proof.th.costSource')}</th>
                                            <th>{t('kpi.proof.th.lineCost')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {cogsLines.map((line, idx) => {
                                            const isService = line.item_type === 'service';
                                            const catalogCost = isService
                                                ? line.service_cost
                                                : line.catalog_purchase_price;
                                            return (
                                                <tr key={`${line.invoice_id}-${idx}`}>
                                                    <td>{line.invoice_no || '—'}</td>
                                                    <td>
                                                        {isService
                                                            ? t('kpi.proof.type.service')
                                                            : t('kpi.proof.type.product')}
                                                    </td>
                                                    <td>{line.item_name || '—'}</td>
                                                    <td>{line.qty ?? '—'}</td>
                                                    <td>
                                                        {catalogCost == null
                                                            ? '—'
                                                            : money(catalogCost)}
                                                        <div className="ws-kpi-proof-cell-sub">
                                                            {isService
                                                                ? t('kpi.proof.th.serviceCost')
                                                                : t('kpi.proof.th.purchasePrice')}
                                                        </div>
                                                    </td>
                                                    <td>{money(line.unit_cost)}</td>
                                                    <td>{costSourceLabel(line.cost_source, t)}</td>
                                                    <td>{money(line.line_cost)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </WsTableScroll>
                        )}
                    </>
                ) : (
                    <>
                        {proof.invoices_truncated ? (
                            <p className="ws-kpi-proof-note">
                                {t('kpi.proof.showingInvoices', {
                                    shown: invoices.length,
                                    total: proof.invoices_total_count,
                                })}
                            </p>
                        ) : null}
                        {invoices.length === 0 ? (
                            <p className="ws-kpi-proof-note">{t('kpi.proof.emptyInvoices')}</p>
                        ) : (
                            <WsTableScroll bodyClassName="ws-kpi-proof-scroll">
                                <table className="ws-table ws-kpi-proof-table">
                                    <thead>
                                        <tr>
                                            <th>{t('kpi.proof.th.invoice')}</th>
                                            <th>{t('kpi.proof.th.date')}</th>
                                            {kpiId === 'pending_invoices' ? (
                                                <th>{t('kpi.proof.th.status')}</th>
                                            ) : null}
                                            <th>{t('kpi.proof.th.amount')}</th>
                                            <th style={{ width: 88 }}>{t('kpi.proof.th.action')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {invoices.map((inv) => {
                                            const id = inv.invoice_id || inv.invoiceId;
                                            const busy = String(invoiceBusyId) === String(id);
                                            return (
                                                <tr key={String(id)}>
                                                    <td>{inv.invoice_no || inv.invoiceNo || '—'}</td>
                                                    <td>
                                                        {inv.issued_at
                                                            ? new Date(inv.issued_at).toLocaleString()
                                                            : inv.invoice_date || inv.invoiceDate || '—'}
                                                    </td>
                                                    {kpiId === 'pending_invoices' ? (
                                                        <td>{inv.payment_status || inv.paymentStatus || '—'}</td>
                                                    ) : null}
                                                    <td>{money(inv.amount)}</td>
                                                    <td>
                                                        <button
                                                            type="button"
                                                            className="btn-portal"
                                                            style={{ padding: '4px 8px', fontSize: 12 }}
                                                            disabled={busy || !id}
                                                            onClick={() => void openInvoice(id)}
                                                        >
                                                            {busy ? t('kpi.proof.opening') : t('kpi.proof.view')}
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </WsTableScroll>
                        )}
                    </>
                )}
            </>
        );
    } else {
        body = <p className="ws-kpi-proof-note">{t('kpi.proof.errLoad')}</p>;
    }

    return (
        <>
            <Modal title={title} contentClassName="ws-modal-kpi-proof" onClose={onClose}>
                {body}
            </Modal>
            <InvoiceDetailsModal
                invoice={invoicePreview}
                isOpen={!!invoicePreview}
                footerVariant="corporate"
                onClose={() => setInvoicePreview(null)}
            />
        </>
    );
}
