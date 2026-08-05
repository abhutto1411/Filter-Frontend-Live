import React, { useCallback, useEffect, useState } from 'react';
import { Package } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import RowActionsMenu from '../../components/RowActionsMenu';
import { ShimmerOrderQueueCards, ShimmerTextBlock } from '../../components/supplier/Shimmer';
import {
    acceptSupplierPurchaseOrder,
    getSupplierPurchaseOrder,
    getSupplierPurchaseOrders,
    listSupplierWorkshopPurchaseInvoices,
    rejectSupplierPurchaseOrder,
    updateSupplierPurchaseOrderStatus,
} from '../../services/supplierApi';
import {
    normalizeWorkshopSupplierPurchaseInvoiceRow,
    unwrapWorkshopSupplierPurchaseInvoiceList,
} from '../../services/workshopSupplierPurchaseInvoices';
import WorkshopPurchaseInvoicesSupplierPanel from './WorkshopPurchaseInvoicesSupplierPanel';

const PIPELINE_STAGES = [
    { id: 'pending_acceptance', label: 'Pending Acceptance', badge: 'yellow' },
    { id: 'accepted', label: 'Accepted', badge: 'dark' },
    { id: 'processing', label: 'Processing', badge: 'yellow' },
    { id: 'ready_to_dispatch', label: 'Ready to Dispatch', badge: 'dark' },
    { id: 'dispatched', label: 'Dispatched / On Way', badge: 'yellow' },
    { id: 'delivered', label: 'Delivered', badge: 'dark' },
];

const ORDER_STATUS_BADGE = Object.fromEntries(PIPELINE_STAGES.map((s) => [s.id, s.badge]));

const STATUS_LABEL = Object.fromEntries(PIPELINE_STAGES.map(s => [s.id, s.label]));

/** Workshop purchase requests: pending → approved → sales invoice (no fulfillment pipeline). */
const WPI_WORKSHOP_ORDER_STAGES = [
    { id: 'pending_acceptance', label: 'Pending approval', api: 'pending' },
    { id: 'accepted', label: 'Approved', api: 'approved' },
    { id: 'rejected', label: 'Rejected', api: 'rejected' },
];

/** Maps workshop PI API status → simplified Order Queue bucket. */
function wpiStatusToPipelineId(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'pending') return 'pending_acceptance';
    if (s === 'rejected') return 'rejected';
    if (
        s === 'approved' ||
        s === 'processing' ||
        s === 'ready_to_dispatch' ||
        s === 'on_the_way' ||
        s === 'delivered'
    ) {
        return 'accepted';
    }
    return null;
}

export default function SupplierOrderQueue() {
    /** Purchase-order queue vs full workshop purchase invoice list (same APIs as Finance → Workshop purchases). */
    const [segment, setSegment] = useState('wpi_all');
    const [wpiTotal, setWpiTotal] = useState(null);
    /** Rows used only for pipeline card counts (WPI + PO). */
    const [wpiRowsForCounts, setWpiRowsForCounts] = useState([]);
    /** When embedded WPI table is parent-controlled: API list `status` query ("" = all). */
    const [wpiListStatusFilter, setWpiListStatusFilter] = useState('');

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [apiError, setApiError] = useState('');
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [viewLoading, setViewLoading] = useState(false);

    const normalizeStatus = (status) => {
        if (status === 'ready_to_deliver') return 'ready_to_dispatch';
        if (status === 'on_the_way') return 'dispatched';
        return status;
    };

    const mapToApiStatus = (status) => {
        if (status === 'ready_to_dispatch') return 'ready_to_deliver';
        if (status === 'dispatched') return 'on_the_way';
        if (status === 'pending_acceptance') return 'pending';
        return status;
    };

    const reloadOrders = async () => {
        setLoading(true);
        setApiError('');
        try {
            const res = await getSupplierPurchaseOrders();
            const rows = Array.isArray(res?.purchaseOrders)
                ? res.purchaseOrders
                : Array.isArray(res?.data?.purchaseOrders)
                  ? res.data.purchaseOrders
                  : [];
            const list = rows.map((po) => ({
                      ...po,
                      id: String(po.id ?? ''),
                      branch: po.branch?.name || '-',
                      requested: po.createdAt ? po.createdAt.slice(0, 16).replace('T', ' ') : '-',
                      items: Array.isArray(po.items) ? po.items.length : 0,
                      total: `SAR ${(Array.isArray(po.items) ? po.items.reduce((sum, i) => sum + Number(i.lineTotal || 0), 0) : 0).toLocaleString()}`,
                      status: normalizeStatus(po.status),
                  }));
            setOrders(list);
        } catch (err) {
            console.error('Supplier order queue API failed:', err);
            setOrders([]);
            setApiError(err?.message || 'Failed to load orders');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        reloadOrders();
    }, []);

    const reloadWpiCounts = useCallback(async () => {
        try {
            const res = await listSupplierWorkshopPurchaseInvoices({ limit: 500, offset: 0 });
            const t = res?.total ?? res?.data?.total;
            setWpiTotal(t != null ? Number(t) : null);
            const list = unwrapWorkshopSupplierPurchaseInvoiceList(res ?? {});
            setWpiRowsForCounts(list.map(normalizeWorkshopSupplierPurchaseInvoiceRow).filter(Boolean));
        } catch {
            setWpiTotal(null);
            setWpiRowsForCounts([]);
        }
    }, []);

    useEffect(() => {
        reloadWpiCounts();
    }, [reloadWpiCounts]);

    const setStatus = (id, status) => setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
    const accept = async (id) => {
        setStatus(id, 'accepted');
        try {
            await acceptSupplierPurchaseOrder(id);
        } catch (err) {
            console.error('Accept PO failed:', err);
            reloadOrders();
        }
    };
    const startProcessing = async (id) => {
        setStatus(id, 'processing');
        try {
            await updateSupplierPurchaseOrderStatus(id, {
                status: mapToApiStatus('processing'),
                notes: 'Processing started',
            });
        } catch (err) {
            console.error('Update PO status failed:', err);
            reloadOrders();
        }
    };
    const markReadyToDispatch = async (id) => {
        setStatus(id, 'ready_to_dispatch');
        try {
            await updateSupplierPurchaseOrderStatus(id, {
                status: mapToApiStatus('ready_to_dispatch'),
                notes: 'Packed and ready for dispatch',
            });
        } catch (err) {
            console.error('Update PO status failed:', err);
            reloadOrders();
        }
    };
    const dispatch = async (id) => {
        setStatus(id, 'dispatched');
        try {
            await updateSupplierPurchaseOrderStatus(id, {
                status: mapToApiStatus('dispatched'),
                notes: 'Order dispatched',
            });
        } catch (err) {
            console.error('Update PO status failed:', err);
            reloadOrders();
        }
    };
    const markDelivered = async (id) => {
        setStatus(id, 'delivered');
        try {
            await updateSupplierPurchaseOrderStatus(id, {
                status: mapToApiStatus('delivered'),
                notes: 'Order delivered successfully',
            });
        } catch (err) {
            console.error('Update PO status failed:', err);
            reloadOrders();
        }
    };
    const reject = async (id) => {
        setOrders(prev => prev.filter(o => o.id !== id));
        try {
            await rejectSupplierPurchaseOrder(id, { reason: 'Rejected by supplier' });
        } catch (err) {
            console.error('Reject PO failed:', err);
            reloadOrders();
        }
    };

    const viewOrder = async (order) => {
        setViewModalOpen(true);
        setSelectedOrder(order);
        setViewLoading(true);
        try {
            const res = await getSupplierPurchaseOrder(order.id);
            const po = res?.purchaseOrder;
            if (po) {
                setSelectedOrder({
                    ...order,
                    id: po.id || order.id,
                    branch: po.branch?.name || order.branch,
                    requested: po.createdAt ? po.createdAt.slice(0, 16).replace('T', ' ') : order.requested,
                    status: normalizeStatus(po.status || order.status),
                    items: Array.isArray(po.items) ? po.items : [],
                    total: `SAR ${(Array.isArray(po.items) ? po.items.reduce((sum, i) => sum + Number(i.lineTotal || 0), 0) : 0).toLocaleString()}`,
                    notes: po.notes || '',
                    rejectionReason: po.rejectionReason || '',
                });
            }
        } catch (err) {
            console.error('Fetch purchase order detail failed, showing local snapshot:', err);
        } finally {
            setViewLoading(false);
        }
    };

    const pipelineCounts = PIPELINE_STAGES.reduce(
        (acc, s) => ({
            ...acc,
            [s.id]: orders.filter((o) => o.status === s.id).length,
        }),
        {},
    );

    const wpiPipelineCounts = WPI_WORKSHOP_ORDER_STAGES.reduce(
        (acc, s) => ({
            ...acc,
            [s.id]: wpiRowsForCounts.filter((r) => wpiStatusToPipelineId(r?.status) === s.id).length,
        }),
        {},
    );

    return (
        <div>
            <div className="ws-page-header">
                <div><h2 className="ws-page-title">Order Queue</h2><p className="ws-page-sub">Workshop branch stock requests</p></div>
            </div>

            {apiError ? (
                <div className="theme-alert">
                    <strong>Could not load orders:</strong> {apiError}
                </div>
            ) : null}

            <div className="theme-segmented theme-segmented--full" style={{ marginBottom: 20 }}>
                <button
                    type="button"
                    onClick={() => {
                        setSegment('wpi_all');
                        setWpiListStatusFilter('');
                    }}
                    className={`theme-segmented__btn${
                        segment === 'wpi_all' && wpiListStatusFilter === '' ? ' theme-segmented__btn--active' : ''
                    }`}
                >
                    {wpiTotal != null ? `All (${wpiTotal})` : 'All'}
                </button>
                {WPI_WORKSHOP_ORDER_STAGES.map((s) => {
                    const isActive = segment === 'wpi_all' && wpiListStatusFilter === s.api;
                    return (
                        <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                                setSegment('wpi_all');
                                setWpiListStatusFilter(s.api ?? '');
                            }}
                            className={`theme-segmented__btn${isActive ? ' theme-segmented__btn--active' : ''}`}
                        >
                            {s.label} ({wpiPipelineCounts[s.id]})
                        </button>
                    );
                })}
            </div>
            <p style={{ margin: '0 0 16px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                <button
                    type="button"
                    onClick={() => setSegment('po')}
                    className="theme-link-btn"
                >
                    Classic branch purchase orders (PO queue)
                </button>{' '}
                — separate from workshop purchase invoices above.
            </p>

            {segment === 'wpi_all' ? (
                <div style={{ marginTop: 8 }}>
                    <p style={{ margin: '0 0 12px', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                        Approve or reject, then <strong>Prepare sales invoice</strong> (same AR/stock/GL as Sales
                        Invoices). Same data as <strong>Finance → Workshop purchases</strong>.
                    </p>
                    <WorkshopPurchaseInvoicesSupplierPanel
                        variant="embedded"
                        pipelineStatusFilter={wpiListStatusFilter}
                        onListMutated={reloadWpiCounts}
                    />
                </div>
            ) : null}

            {segment === 'po' && loading && orders.length === 0 ? (
                <ShimmerOrderQueueCards count={5} />
            ) : segment === 'po' && orders.length === 0 ? (
                <div className="ws-section" style={{ textAlign: 'center', padding: 48 }}>
                    <Package size={48} style={{ opacity: 0.3, margin: '0 auto 16px', display: 'block' }} />
                    <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text-muted)' }}>No orders in queue</p>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Workshop requests will appear here when the backend returns purchase orders.</p>
                </div>
            ) : segment === 'po' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {orders.map(o => {
                        const badge = ORDER_STATUS_BADGE[o.status] || 'yellow';
                        const label = STATUS_LABEL[o.status] || o.status;
                        return (
                            <div key={o.id} className="ws-section" style={{ marginBottom: 0, padding: 20 }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                    <div>
                                        <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-text-dark)', margin: 0 }}>{o.id}</p>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>{o.branch} · {o.requested}</p>
                                        <p style={{ fontSize: '0.875rem', fontWeight: 600, margin: '8px 0 0 0', color: 'var(--color-text-dark)' }}>{o.total} · {o.items} item{o.items !== 1 ? 's' : ''}</p>
                                    </div>
                                    <span className={`ws-badge ws-badge--${badge}`}>{label}</span>
                                </div>
                                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                                    <RowActionsMenu
                                        ariaLabel={`Actions for order ${o.id}`}
                                        items={[
                                            { label: 'View', onClick: () => viewOrder(o) },
                                            ...(o.status === 'pending_acceptance'
                                                ? [
                                                      {
                                                          label: 'Accept',
                                                          onClick: () => accept(o.id),
                                                      },
                                                      {
                                                          label: 'Reject',
                                                          onClick: () => reject(o.id),
                                                          danger: true,
                                                      },
                                                  ]
                                                : []),
                                            ...(o.status === 'accepted'
                                                ? [
                                                      {
                                                          label: 'Start processing',
                                                          onClick: () => startProcessing(o.id),
                                                      },
                                                  ]
                                                : []),
                                            ...(o.status === 'processing'
                                                ? [
                                                      {
                                                          label: 'Ready to dispatch',
                                                          onClick: () => markReadyToDispatch(o.id),
                                                      },
                                                  ]
                                                : []),
                                            ...(o.status === 'ready_to_dispatch'
                                                ? [
                                                      {
                                                          label: 'Dispatch',
                                                          onClick: () => dispatch(o.id),
                                                      },
                                                  ]
                                                : []),
                                            ...(o.status === 'dispatched'
                                                ? [
                                                      {
                                                          label: 'Mark delivered',
                                                          onClick: () => markDelivered(o.id),
                                                      },
                                                  ]
                                                : []),
                                        ]}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : null}
            <AnimatePresence>
                {viewModalOpen && selectedOrder && (
                    <Modal
                        title={`Order Detail — ${selectedOrder.id}`}
                        onClose={() => {
                            setViewModalOpen(false);
                            setSelectedOrder(null);
                        }}
                        width="700px"
                        footer={
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button className="btn-portal-outline" onClick={() => setViewModalOpen(false)}>
                                    Close
                                </button>
                            </div>
                        }
                    >
                        {viewLoading ? (
                            <div style={{ padding: '8px 0' }}>
                                <ShimmerTextBlock lines={6} />
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gap: 12 }}>
                                <div className="ws-section" style={{ marginBottom: 0, padding: 12 }}>
                                    <p style={{ margin: 0, fontSize: '0.8125rem' }}><strong>Branch:</strong> {selectedOrder.branch || '-'}</p>
                                    <p style={{ margin: '6px 0 0 0', fontSize: '0.8125rem' }}><strong>Requested At:</strong> {selectedOrder.requested || '-'}</p>
                                    <p style={{ margin: '6px 0 0 0', fontSize: '0.8125rem' }}><strong>Status:</strong> {selectedOrder.status || '-'}</p>
                                    <p style={{ margin: '6px 0 0 0', fontSize: '0.8125rem' }}><strong>Total:</strong> {selectedOrder.total || '-'}</p>
                                    {selectedOrder.notes ? <p style={{ margin: '6px 0 0 0', fontSize: '0.8125rem' }}><strong>Notes:</strong> {selectedOrder.notes}</p> : null}
                                    {selectedOrder.rejectionReason ? <p style={{ margin: '6px 0 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}><strong>Rejection:</strong> {selectedOrder.rejectionReason}</p> : null}
                                </div>
                                <div className="ws-section" style={{ marginBottom: 0, padding: 12 }}>
                                    <p style={{ margin: '0 0 8px 0', fontWeight: 700, fontSize: '0.8125rem' }}>Items</p>
                                    {Array.isArray(selectedOrder.items) && selectedOrder.items.length > 0 ? (
                                        <table className="ws-table">
                                            <thead>
                                                <tr>
                                                    <th>Product</th>
                                                    <th>Qty</th>
                                                    <th>Unit Price</th>
                                                    <th>Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedOrder.items.map((it) => (
                                                    <tr key={it.id || `${it.supplierProductId}-${it.qty}`}>
                                                        <td>{it.supplierProductName || '-'}</td>
                                                        <td>{it.qty || '-'}</td>
                                                        <td>{it.unitPrice || '-'}</td>
                                                        <td>{it.lineTotal || '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                                            No line items available for this order.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}
