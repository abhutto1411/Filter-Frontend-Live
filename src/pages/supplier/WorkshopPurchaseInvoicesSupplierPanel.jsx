import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, FileText } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import {
    approveSupplierWorkshopPurchaseInvoice,
    getSupplierWorkshopPurchaseInvoice,
    getWorkshopPurchaseSalesInvoicePrefill,
    listSupplierWorkshopPurchaseInvoices,
    rejectSupplierWorkshopPurchaseInvoice,
} from '../../services/supplierApi';
import {
    normalizeWorkshopSupplierPurchaseInvoiceRow,
    unwrapWorkshopSupplierPurchaseInvoiceList,
} from '../../services/workshopSupplierPurchaseInvoices';
import SupplierWorkshopPurchaseInvoiceEditModal from './SupplierWorkshopPurchaseInvoiceEditModal';
import { ShimmerTable, ShimmerTextBlock } from '../../components/supplier/Shimmer';
import WorkshopPurchaseInvoiceView from '../../components/supplier/WorkshopPurchaseInvoiceView';
import RowActionsMenu from '../../components/RowActionsMenu';

/**
 * Workshop → supplier purchase invoices (list, view, workshop-style PI edit via PATCH, approve, reject).
 * Used on the dedicated nav page and embedded on Sales Invoices (AR).
 * @param {string|undefined} pipelineStatusFilter When set (including ""), list filter is controlled by parent (Order Queue pills). Omit on Finance pages.
 */
const FOCUS_SALES_INVOICE_ID_KEY = 'supplier_focus_sales_invoice_id';
export const WORKSHOP_PURCHASE_SI_PREFILL_KEY = 'supplier_workshop_purchase_sales_prefill';

export default function WorkshopPurchaseInvoicesSupplierPanel({
    variant = 'page',
    pipelineStatusFilter,
    onListMutated,
}) {
    const navigate = useNavigate();
    const embedded = variant === 'embedded';
    const parentControlsFilter = pipelineStatusFilter !== undefined;
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [actionId, setActionId] = useState(null);
    const [viewRow, setViewRow] = useState(null);
    const [viewDetail, setViewDetail] = useState(null);
    const [viewLoading, setViewLoading] = useState(false);
    const [rejectOpen, setRejectOpen] = useState(null);
    const [rejectReason, setRejectReason] = useState('');
    const [editOpen, setEditOpen] = useState(null);
    const [editLoading, setEditLoading] = useState(false);
    const [editFetchPayload, setEditFetchPayload] = useState(null);
    const [editError, setEditError] = useState('');

    const effectiveListStatus = parentControlsFilter ? pipelineStatusFilter : statusFilter;

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await listSupplierWorkshopPurchaseInvoices({
                limit: 100,
                offset: 0,
                ...(effectiveListStatus ? { status: effectiveListStatus } : {}),
            });
            const list = unwrapWorkshopSupplierPurchaseInvoiceList(res);
            setRows(list.map(normalizeWorkshopSupplierPurchaseInvoiceRow).filter(Boolean));
        } catch (e) {
            setRows([]);
            setError(e.message || 'Failed to load workshop purchase invoices.');
        } finally {
            setLoading(false);
        }
    }, [effectiveListStatus, parentControlsFilter]);

    useEffect(() => {
        load();
    }, [load]);

    const openView = async (r) => {
        setViewRow(r);
        setViewDetail(null);
        setViewLoading(true);
        try {
            const d = await getSupplierWorkshopPurchaseInvoice(r.id);
            setViewDetail(d?.purchaseInvoice ?? d?.invoice ?? d?.data ?? d);
        } catch {
            setViewDetail(r._raw || r);
        } finally {
            setViewLoading(false);
        }
    };

    const openEdit = async (r) => {
        setEditOpen(r);
        setEditError('');
        setEditFetchPayload(null);
        setEditLoading(true);
        try {
            const d = await getSupplierWorkshopPurchaseInvoice(r.id);
            setEditFetchPayload(d);
        } catch (e) {
            setEditFetchPayload(null);
            setEditError(e.message || 'Could not load invoice for editing.');
        } finally {
            setEditLoading(false);
        }
    };

    const openLinkedSalesInvoice = (salesInvoiceId) => {
        const sid = String(salesInvoiceId ?? '').trim();
        if (!sid) return;
        try {
            sessionStorage.setItem(FOCUS_SALES_INVOICE_ID_KEY, sid);
        } catch {
            /* ignore */
        }
        navigate('/supplier/sales_invoices');
    };

    const handleApprove = async (id) => {
        setActionId(`ap-${id}`);
        setError('');
        try {
            await approveSupplierWorkshopPurchaseInvoice(id);
            await load();
            onListMutated?.();
        } catch (e) {
            setError(e.message || 'Approve failed.');
        } finally {
            setActionId(null);
        }
    };

    const handlePrepareSalesInvoice = async (row) => {
        const id = row?.id;
        if (!id) return;
        setActionId(`psi-${id}`);
        setError('');
        try {
            const res = await getWorkshopPurchaseSalesInvoicePrefill(id);
            if (res?.alreadyInvoiced && res?.salesInvoiceId) {
                openLinkedSalesInvoice(res.salesInvoiceId);
                return;
            }
            const prefill = res?.prefill;
            if (!prefill || typeof prefill !== 'object') {
                throw new Error('Could not build sales invoice prefill.');
            }
            sessionStorage.setItem(WORKSHOP_PURCHASE_SI_PREFILL_KEY, JSON.stringify(prefill));
            navigate('/supplier/sales_invoices');
        } catch (e) {
            setError(e.message || 'Prepare sales invoice failed.');
        } finally {
            setActionId(null);
        }
    };

    const handleReject = async () => {
        if (!rejectOpen || !rejectReason.trim()) return;
        const id = rejectOpen.id;
        setActionId(`rj-${id}`);
        setError('');
        try {
            await rejectSupplierWorkshopPurchaseInvoice(id, { reason: rejectReason.trim() });
            setRejectOpen(null);
            setRejectReason('');
            await load();
            onListMutated?.();
        } catch (e) {
            setError(e.message || 'Reject failed.');
        } finally {
            setActionId(null);
        }
    };

    return (
        <div style={embedded ? { marginBottom: 24 } : undefined}>
            {error && (
                <div className="theme-alert">
                    {error}
                </div>
            )}
            <div className="ws-section" style={{ marginBottom: 16 }}>
                <div
                    style={{
                        padding: 16,
                        display: 'flex',
                        gap: 12,
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        justifyContent: 'space-between',
                    }}
                >
                    <div>
                        <h3
                            style={{
                                margin: 0,
                                fontSize: embedded ? '1rem' : '1.0625rem',
                                fontWeight: 700,
                                color: 'var(--color-text-dark)',
                            }}
                        >
                            {embedded ? 'Workshop purchase invoices' : 'Filters'}
                        </h3>
                        {embedded ? (
                            <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                                Approve or reject the order, then use Prepare sales invoice (same AR/stock/GL as Sales
                                Invoices).
                            </p>
                        ) : null}
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                        {!parentControlsFilter ? (
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            style={{
                                padding: '8px 14px',
                                borderRadius: 8,
                                border: '1px solid var(--color-border)',
                                fontSize: '0.875rem',
                                minWidth: 180,
                            }}
                        >
                            <option value="">All statuses</option>
                            <option value="pending">Pending approval</option>
                            <option value="approved">Approved — awaiting sales invoice</option>
                            <option value="rejected">Rejected</option>
                        </select>
                        ) : (
                            <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                                Filter: {effectiveListStatus ? effectiveListStatus.replace(/_/g, ' ') : 'All'}
                            </span>
                        )}
                        <button type="button" className="btn-portal" onClick={load} disabled={loading}>
                            <RefreshCw size={14} /> {loading ? 'Loading…' : 'Refresh'}
                        </button>
                    </div>
                </div>
            </div>
            <div className="ws-section">
                <div style={{ overflowX: 'auto' }}>
                    {loading && rows.length === 0 ? (
                        <ShimmerTable rows={10} columns={10} />
                    ) : (
                    <table className="ws-table">
                        <thead>
                            <tr>
                                <th>Invoice #</th>
                                <th>Vendor ref</th>
                                <th>Issue date</th>
                                <th>Product name</th>
                                <th>Quantity</th>
                                <th>Unit</th>
                                <th>Unit price</th>
                                <th>Total</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 ? (
                                <tr>
                                    <td colSpan={10} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                        No workshop purchase invoices
                                    </td>
                                </tr>
                            ) : (
                                rows.map((r) => {
                                    const approvedAwaitingSi =
                                        r.status === 'approved' && !r.supplier_invoice_id;
                                    return (
                                    <tr key={r.id}>
                                        <td>
                                            <strong className="theme-invoice-id">{r.invoice_number}</strong>
                                        </td>
                                        <td style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                                            {r.vendor_invoice_ref || '—'}
                                        </td>
                                        <td style={{ fontSize: '0.8125rem' }}>{r.date || '—'}</td>
                                        <td
                                            style={{
                                                fontSize: '0.8125rem',
                                                maxWidth: 240,
                                                color: 'var(--color-text-muted)',
                                                lineHeight: 1.35,
                                            }}
                                            title={r.product_label ?? '—'}
                                        >
                                            {r.product_label ?? '—'}
                                        </td>
                                        <td style={{ fontSize: '0.8125rem' }}>{r.quantity_label ?? '—'}</td>
                                        <td style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                                            {r.unit_label ?? '—'}
                                        </td>
                                        <td
                                            style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}
                                            title={
                                                Array.isArray(r.items) && r.items.length > 1
                                                    ? 'Unit price (ex VAT) — first line'
                                                    : 'Unit price (ex VAT)'
                                            }
                                        >
                                            {r.primary_unit_price != null &&
                                            Number.isFinite(Number(r.primary_unit_price)) ? (
                                                <>
                                                    SAR{' '}
                                                    {Number(r.primary_unit_price).toLocaleString(undefined, {
                                                        minimumFractionDigits: 2,
                                                        maximumFractionDigits: 2,
                                                    })}
                                                    {Array.isArray(r.items) && r.items.length > 1 ? (
                                                        <span
                                                            style={{
                                                                color: 'var(--color-text-muted)',
                                                                fontSize: '0.6875rem',
                                                                marginLeft: 4,
                                                            }}
                                                        >
                                                            (1st line)
                                                        </span>
                                                    ) : null}
                                                </>
                                            ) : (
                                                '—'
                                            )}
                                        </td>
                                        <td>
                                            <strong>SAR {(r.grand_total || 0).toLocaleString()}</strong>
                                        </td>
                                        <td>
                                            <span
                                                className={`ws-badge ws-badge--${
                                                    r.status === 'rejected'
                                                        ? 'gray'
                                                        : r.status === 'pending'
                                                          ? 'yellow'
                                                          : r.status === 'delivered' || r.status === 'approved'
                                                            ? 'green'
                                                            : 'yellow'
                                                }`}
                                            >
                                                {r.status === 'on_the_way' ? 'On the way' : (r.status || '').replace(/_/g, ' ')}
                                            </span>
                                        </td>
                                        <td>
                                            <RowActionsMenu
                                                disabled={actionId !== null}
                                                ariaLabel={`Actions for ${r.invoice_number || 'invoice'}`}
                                                items={[
                                                    { label: 'View', onClick: () => openView(r) },
                                                    ...(r.supplier_invoice_id
                                                        ? [
                                                              {
                                                                  label: 'Open sales invoice (AR)',
                                                                  onClick: () =>
                                                                      openLinkedSalesInvoice(
                                                                          r.supplier_invoice_id,
                                                                      ),
                                                              },
                                                          ]
                                                        : []),
                                                    ...(r.status === 'pending'
                                                        ? [
                                                              {
                                                                  label: 'Edit purchase invoice',
                                                                  onClick: () => openEdit(r),
                                                                  disabled: actionId !== null,
                                                              },
                                                              {
                                                                  label: 'Approve',
                                                                  onClick: () => handleApprove(r.id),
                                                                  disabled: actionId !== null,
                                                              },
                                                              {
                                                                  label: 'Reject',
                                                                  onClick: () => {
                                                                      setRejectOpen(r);
                                                                      setRejectReason('');
                                                                  },
                                                                  disabled: actionId !== null,
                                                              },
                                                          ]
                                                        : []),
                                                    ...(approvedAwaitingSi
                                                        ? [
                                                              {
                                                                  label: 'Prepare sales invoice',
                                                                  onClick: () =>
                                                                      handlePrepareSalesInvoice(r),
                                                                  disabled: actionId !== null,
                                                              },
                                                          ]
                                                        : []),
                                                ]}
                                            />
                                        </td>
                                    </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                    )}
                </div>
            </div>

            <AnimatePresence>
                {viewRow && (
                    <Modal
                        title="Workshop purchase invoice"
                        width="min(980px, 99vw)"
                        contentClassName="wpi-invoice-preview-modal"
                        onClose={() => {
                            setViewRow(null);
                            setViewDetail(null);
                        }}
                    >
                        {viewLoading ? (
                            <ShimmerTextBlock lines={8} />
                        ) : (
                            <>
                                {viewRow?.supplier_invoice_id ? (
                                    <div className="theme-callout" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                                        <span>
                                            Linked <strong>sales invoice (AR)</strong> — same accounting as Sales
                                            Invoices.
                                        </span>
                                        <button
                                            type="button"
                                            className="btn-portal-outline"
                                            onClick={() => openLinkedSalesInvoice(viewRow.supplier_invoice_id)}
                                        >
                                            <FileText size={14} /> Open sales invoice
                                        </button>
                                    </div>
                                ) : null}
                                <WorkshopPurchaseInvoiceView
                                    compact
                                    detail={viewDetail}
                                    listRow={viewRow}
                                />
                            </>
                        )}
                    </Modal>
                )}
                {editOpen && (
                    <SupplierWorkshopPurchaseInvoiceEditModal
                        open
                        listRow={editOpen}
                        fetchPayload={editFetchPayload}
                        loadingFetch={editLoading}
                        fetchErrorMessage={editError}
                        onClose={() => {
                            setEditOpen(null);
                            setEditFetchPayload(null);
                            setEditError('');
                        }}
                        onSaved={load}
                    />
                )}
                {rejectOpen && (
                    <Modal
                        title="Reject invoice"
                        onClose={() => {
                            setRejectOpen(null);
                            setRejectReason('');
                        }}
                        footer={
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => {
                                        setRejectOpen(null);
                                        setRejectReason('');
                                    }}
                                    disabled={actionId !== null}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="btn-submit theme-action-btn theme-action-btn--dark"
                                    disabled={!rejectReason.trim() || actionId !== null}
                                    onClick={handleReject}
                                >
                                    {actionId?.startsWith('rj-') ? 'Rejecting…' : 'Reject'}
                                </button>
                            </div>
                        }
                    >
                        <textarea
                            placeholder="Reason for rejection…"
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            rows={3}
                            style={{
                                width: '100%',
                                padding: 12,
                                borderRadius: 8,
                                border: '1px solid var(--color-border)',
                                fontSize: '0.875rem',
                            }}
                        />
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}
