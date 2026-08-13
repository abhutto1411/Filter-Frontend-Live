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
            {items.map((item) => (
                <div key={item.label} className="ws-kpi-proof-stat">
                    <span className="ws-kpi-proof-stat-label">{item.label}</span>
                    <span className="ws-kpi-proof-stat-value">{item.value}</span>
                </div>
            ))}
        </div>
    );
}

function mapRecentPdfToInvoice(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const payload = raw.invoice || raw.data || raw;
    if (!payload || typeof payload !== 'object') return null;
    return payload;
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

    const money = useCallback(
        (n) => t('money.sar', { amount: Number(n || 0).toLocaleString() }),
        [t],
    );

    useEffect(() => {
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
        const summaryItems =
            kpiId === 'gross_margin'
                ? [
                    { label: t('kpi.proof.salesTotal'), value: money(proof.sales_total) },
                    { label: t('kpi.proof.cogs'), value: money(proof.purchase_cost) },
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
                {proof.invoices_truncated ? (
                    <p className="ws-kpi-proof-note">
                        {t('kpi.proof.showingInvoices', {
                            shown: invoices.length,
                            total: proof.invoices_total_count,
                        })}
                    </p>
                ) : null}
                {error ? <p style={{ color: '#B91C1C', marginBottom: 8 }}>{error}</p> : null}
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
