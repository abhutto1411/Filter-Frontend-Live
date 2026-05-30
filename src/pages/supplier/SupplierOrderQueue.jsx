import React, { useCallback, useEffect, useState } from 'react';
import { Package, Eye, Truck, CheckCircle, XCircle, PackageCheck } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import { Shimmer, ShimmerOrderQueueCards, ShimmerTextBlock } from '../../components/supplier/Shimmer';
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
    { id: 'pending_acceptance', label: 'Pending Acceptance', bg: '#FEF3C7', color: '#B45309' },
    { id: 'accepted', label: 'Accepted', bg: '#DBEAFE', color: '#1D4ED8' },
    { id: 'processing', label: 'Processing', bg: '#CFFAFE', color: '#0E7490' },
    { id: 'ready_to_dispatch', label: 'Ready to Dispatch', bg: '#EDE9FE', color: '#6D28D9' },
    { id: 'dispatched', label: 'Dispatched / On Way', bg: '#FFEDD5', color: '#C2410C' },
    { id: 'delivered', label: 'Delivered', bg: '#D1FAE5', color: '#047857' },
];

const ORDER_STATUS_STYLES = Object.fromEntries(PIPELINE_STAGES.map(s => [s.id, { bg: s.bg, color: s.color }]));

const STATUS_LABEL = Object.fromEntries(PIPELINE_STAGES.map(s => [s.id, s.label]));

/** Maps workshop PI API status → Order Queue pipeline card id (aligned with branch PO stages). */
function wpiStatusToPipelineId(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'pending') return 'pending_acceptance';
    if (s === 'approved') return 'accepted';
    if (s === 'processing') return 'processing';
    if (s === 'ready_to_dispatch') return 'ready_to_dispatch';
    if (s === 'on_the_way') return 'dispatched';
    if (s === 'delivered') return 'delivered';
    return null;
}

const PIPELINE_STAGE_TO_WPI_API = {
    pending_acceptance: 'pending',
    accepted: 'approved',
    processing: 'processing',
    ready_to_dispatch: 'ready_to_dispatch',
    dispatched: 'on_the_way',
    delivered: 'delivered',
};

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
            [s.id]:
                orders.filter(o => o.status === s.id).length +
                wpiRowsForCounts.filter(r => wpiStatusToPipelineId(r?.status) === s.id).length,
        }),
        {},
    );

    return (
        <div>
            <div className="ws-page-header">
                <div><h2 className="ws-page-title">Order Queue</h2><p className="ws-page-sub">Workshop branch stock requests</p></div>
            </div>

            {apiError ? (
                <div className="ws-section" style={{ marginBottom: 16, padding: 14, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, color: '#B91C1C', fontSize: '0.875rem' }}>
                    <strong>Could not load orders:</strong> {apiError}
                </div>
            ) : null}

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                    gap: 10,
                    marginBottom: 20,
                }}
            >
                <button
                    type="button"
                    onClick={() => {
                        setSegment('wpi_all');
                        setWpiListStatusFilter('');
                    }}
                    style={{
                        padding: 12,
                        borderRadius: 12,
                        background:
                            segment === 'wpi_all' && wpiListStatusFilter === ''
                                ? '#FEF9C3'
                                : '#F8FAFC',
                        color: segment === 'wpi_all' && wpiListStatusFilter === '' ? '#854D0E' : '#475569',
                        textAlign: 'center',
                        boxShadow:
                            segment === 'wpi_all' && wpiListStatusFilter === ''
                                ? '0 0 0 2px #EAB308'
                                : '0 1px 3px rgba(0,0,0,0.04)',
                        border: 'none',
                        cursor: 'pointer',
                        font: 'inherit',
                    }}
                >
                    <p style={{ fontSize: '0.65rem', fontWeight: 600, margin: 0, lineHeight: 1.2 }}>All</p>
                    <p style={{ fontSize: '0.55rem', fontWeight: 600, margin: '4px 0 0 0', opacity: 0.85, lineHeight: 1.2 }}>
                        Workshop purchases
                    </p>
                    <p style={{ fontSize: '1.35rem', fontWeight: 800, margin: '6px 0 0 0', minHeight: 28 }}>
                        {wpiTotal != null ? (
                            wpiTotal
                        ) : (
                            <Shimmer style={{ display: 'inline-block', verticalAlign: 'middle', height: 22, width: 36, borderRadius: 6 }} />
                        )}
                    </p>
                </button>
                {PIPELINE_STAGES.map((s) => (
                    <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                            setSegment('wpi_all');
                            setWpiListStatusFilter(PIPELINE_STAGE_TO_WPI_API[s.id] ?? '');
                        }}
                        style={{
                            padding: 12,
                            borderRadius: 12,
                            background: s.bg,
                            color: s.color,
                            textAlign: 'center',
                            boxShadow:
                                segment === 'wpi_all' && wpiListStatusFilter === PIPELINE_STAGE_TO_WPI_API[s.id]
                                    ? '0 0 0 2px rgba(15, 23, 42, 0.22)'
                                    : '0 1px 3px rgba(0,0,0,0.04)',
                            border: 'none',
                            cursor: 'pointer',
                            font: 'inherit',
                            opacity: 1,
                        }}
                    >
                        <p style={{ fontSize: '0.65rem', fontWeight: 600, margin: 0, lineHeight: 1.2 }}>{s.label}</p>
                        <p style={{ fontSize: '1.35rem', fontWeight: 800, margin: '6px 0 0 0', minHeight: 28 }}>
                            {loading ? (
                                <Shimmer style={{ display: 'inline-block', verticalAlign: 'middle', height: 22, width: 32, borderRadius: 6 }} />
                            ) : (
                                pipelineCounts[s.id]
                            )}
                        </p>
                    </button>
                ))}
            </div>
            <p style={{ margin: '0 0 16px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                <button
                    type="button"
                    onClick={() => setSegment('po')}
                    style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        color: '#2563EB',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textDecoration: 'underline',
                    }}
                >
                    Classic branch purchase orders (PO queue)
                </button>{' '}
                — separate from workshop purchase invoices above.
            </p>

            {segment === 'wpi_all' ? (
                <div style={{ marginTop: 8 }}>
                    <p style={{ margin: '0 0 12px', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                        Cards filter the workshop purchase invoice table. Same data as{' '}
                        <strong>Finance → Workshop purchases</strong>.
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
                        const st = ORDER_STATUS_STYLES[o.status] || ORDER_STATUS_STYLES.pending_acceptance;
                        const label = STATUS_LABEL[o.status] || o.status;
                        return (
                            <div key={o.id} className="ws-section" style={{ marginBottom: 0, padding: 20 }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                    <div>
                                        <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-text-dark)', margin: 0 }}>{o.id}</p>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>{o.branch} · {o.requested}</p>
                                        <p style={{ fontSize: '0.875rem', fontWeight: 600, margin: '8px 0 0 0', color: 'var(--color-text-dark)' }}>{o.total} · {o.items} item{o.items !== 1 ? 's' : ''}</p>
                                    </div>
                                    <span style={{ background: st.bg, color: st.color, padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600 }}>{label}</span>
                                </div>
                                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                                    <button type="button" onClick={() => viewOrder(o)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: '#fff', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><Eye size={14} /> View</button>
                                    {o.status === 'pending_acceptance' && (
                                        <>
                                            <button type="button" onClick={() => accept(o.id)} style={{ padding: '6px 10px', borderRadius: 6, border: 'none', background: '#059669', color: '#fff', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle size={14} /> Accept</button>
                                            <button type="button" onClick={() => reject(o.id)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: '#fff', color: '#B91C1C', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><XCircle size={14} /> Reject</button>
                                        </>
                                    )}
                                    {o.status === 'accepted' && (
                                        <button type="button" onClick={() => startProcessing(o.id)} style={{ padding: '6px 10px', borderRadius: 6, border: 'none', background: '#0E7490', color: '#fff', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><PackageCheck size={14} /> Start Processing</button>
                                    )}
                                    {o.status === 'processing' && (
                                        <button type="button" onClick={() => markReadyToDispatch(o.id)} style={{ padding: '6px 10px', borderRadius: 6, border: 'none', background: '#6D28D9', color: '#fff', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>Ready to Dispatch</button>
                                    )}
                                    {o.status === 'ready_to_dispatch' && (
                                        <button type="button" onClick={() => dispatch(o.id)} style={{ padding: '6px 10px', borderRadius: 6, border: 'none', background: '#EA580C', color: '#fff', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><Truck size={14} /> Dispatch</button>
                                    )}
                                    {o.status === 'dispatched' && (
                                        <button type="button" onClick={() => markDelivered(o.id)} style={{ padding: '6px 10px', borderRadius: 6, border: 'none', background: '#047857', color: '#fff', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><PackageCheck size={14} /> Mark Delivered</button>
                                    )}
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
                                    {selectedOrder.rejectionReason ? <p style={{ margin: '6px 0 0 0', fontSize: '0.8125rem', color: '#B91C1C' }}><strong>Rejection:</strong> {selectedOrder.rejectionReason}</p> : null}
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
