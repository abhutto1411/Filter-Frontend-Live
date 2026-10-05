import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { soqT } from '../../utils/supplierOrderQueueI18n';

const PIPELINE_STAGE_DEFS = [
    { id: 'pending_acceptance', labelKey: 'stage.pendingAcceptance', badge: 'yellow' },
    { id: 'accepted', labelKey: 'stage.accepted', badge: 'dark' },
    { id: 'processing', labelKey: 'stage.processing', badge: 'yellow' },
    { id: 'ready_to_dispatch', labelKey: 'stage.readyToDispatch', badge: 'dark' },
    { id: 'dispatched', labelKey: 'stage.dispatched', badge: 'yellow' },
    { id: 'delivered', labelKey: 'stage.delivered', badge: 'dark' },
];

const ORDER_STATUS_BADGE = Object.fromEntries(PIPELINE_STAGE_DEFS.map((s) => [s.id, s.badge]));

/** Workshop purchase requests: pending → approved → sales invoice (no fulfillment pipeline). */
const WPI_WORKSHOP_ORDER_STAGES = [
    { id: 'pending_acceptance', labelKey: 'seg.pendingApproval', api: 'pending' },
    { id: 'accepted', labelKey: 'seg.approved', api: 'approved' },
    { id: 'rejected', labelKey: 'seg.rejected', api: 'rejected' },
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

function formatMoney(t, amount) {
    return t('money.sar', { amount: Number(amount || 0).toLocaleString() });
}

export default function SupplierOrderQueue({ locale: localeProp }) {
    const locale =
        localeProp ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => soqT(locale, key, vars), [locale]);

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

    const statusLabelMap = useMemo(
        () =>
            Object.fromEntries(
                PIPELINE_STAGE_DEFS.map((s) => [s.id, t(s.labelKey)]),
            ),
        [t],
    );

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

    const reloadOrders = useCallback(async () => {
        setLoading(true);
        setApiError('');
        try {
            const res = await getSupplierPurchaseOrders();
            const rows = Array.isArray(res?.purchaseOrders)
                ? res.purchaseOrders
                : Array.isArray(res?.data?.purchaseOrders)
                  ? res.data.purchaseOrders
                  : [];
            const list = rows.map((po) => {
                const itemsTotal = Array.isArray(po.items)
                    ? po.items.reduce((sum, i) => sum + Number(i.lineTotal || 0), 0)
                    : 0;
                return {
                    ...po,
                    id: String(po.id ?? ''),
                    branch: po.branch?.name || t('emdash'),
                    requested: po.createdAt
                        ? po.createdAt.slice(0, 16).replace('T', ' ')
                        : t('emdash'),
                    items: Array.isArray(po.items) ? po.items.length : 0,
                    total: formatMoney(t, itemsTotal),
                    status: normalizeStatus(po.status),
                };
            });
            setOrders(list);
        } catch (err) {
            console.error('Supplier order queue API failed:', err);
            setOrders([]);
            setApiError(err?.message || t('error.load'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        reloadOrders();
    }, [reloadOrders]);

    const reloadWpiCounts = useCallback(async () => {
        try {
            const res = await listSupplierWorkshopPurchaseInvoices({ limit: 500, offset: 0 });
            const total = res?.total ?? res?.data?.total;
            setWpiTotal(total != null ? Number(total) : null);
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

    const setStatus = (id, status) =>
        setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
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
                notes: t('notes.processing'),
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
                notes: t('notes.ready'),
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
                notes: t('notes.dispatched'),
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
                notes: t('notes.delivered'),
            });
        } catch (err) {
            console.error('Update PO status failed:', err);
            reloadOrders();
        }
    };
    const reject = async (id) => {
        setOrders((prev) => prev.filter((o) => o.id !== id));
        try {
            await rejectSupplierPurchaseOrder(id, { reason: t('notes.rejectReason') });
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
                const itemsTotal = Array.isArray(po.items)
                    ? po.items.reduce((sum, i) => sum + Number(i.lineTotal || 0), 0)
                    : 0;
                setSelectedOrder({
                    ...order,
                    id: po.id || order.id,
                    branch: po.branch?.name || order.branch,
                    requested: po.createdAt
                        ? po.createdAt.slice(0, 16).replace('T', ' ')
                        : order.requested,
                    status: normalizeStatus(po.status || order.status),
                    items: Array.isArray(po.items) ? po.items : [],
                    total: formatMoney(t, itemsTotal),
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
                <div>
                    <h2 className="ws-page-title">{t('title')}</h2>
                    <p className="ws-page-sub">{t('subtitle')}</p>
                </div>
            </div>

            {apiError ? (
                <div className="theme-alert">
                    <strong>{t('error.couldNotLoad')}</strong> {apiError}
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
                        segment === 'wpi_all' && wpiListStatusFilter === ''
                            ? ' theme-segmented__btn--active'
                            : ''
                    }`}
                >
                    {wpiTotal != null ? t('seg.allCount', { count: wpiTotal }) : t('seg.all')}
                </button>
                {WPI_WORKSHOP_ORDER_STAGES.map((s) => {
                    const isActive = segment === 'wpi_all' && wpiListStatusFilter === s.api;
                    const label = t(s.labelKey);
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
                            {t('seg.stageCount', { label, count: wpiPipelineCounts[s.id] })}
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
                    {t('link.classicPo')}
                </button>{' '}
                {t('link.classicPoHint')}
            </p>

            {segment === 'wpi_all' ? (
                <div style={{ marginTop: 8 }}>
                    <p style={{ margin: '0 0 12px', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                        {t('wpi.hint')}
                    </p>
                    <WorkshopPurchaseInvoicesSupplierPanel
                        variant="embedded"
                        locale={locale}
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
                    <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text-muted)' }}>
                        {t('empty.title')}
                    </p>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                        {t('empty.body')}
                    </p>
                </div>
            ) : segment === 'po' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {orders.map((o) => {
                        const badge = ORDER_STATUS_BADGE[o.status] || 'yellow';
                        const label = statusLabelMap[o.status] || o.status;
                        const itemsLabel =
                            o.items === 1
                                ? t('items.one', { count: o.items })
                                : t('items.many', { count: o.items });
                        return (
                            <div key={o.id} className="ws-section" style={{ marginBottom: 0, padding: 20 }}>
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        justifyContent: 'space-between',
                                    }}
                                >
                                    <div>
                                        <p
                                            style={{
                                                fontWeight: 700,
                                                fontSize: '0.9375rem',
                                                color: 'var(--color-text-dark)',
                                                margin: 0,
                                            }}
                                        >
                                            {o.id}
                                        </p>
                                        <p
                                            style={{
                                                fontSize: '0.75rem',
                                                color: 'var(--color-text-muted)',
                                                margin: '2px 0 0 0',
                                            }}
                                        >
                                            {o.branch} · {o.requested}
                                        </p>
                                        <p
                                            style={{
                                                fontSize: '0.875rem',
                                                fontWeight: 600,
                                                margin: '8px 0 0 0',
                                                color: 'var(--color-text-dark)',
                                            }}
                                        >
                                            {t('card.totalItems', { total: o.total, items: itemsLabel })}
                                        </p>
                                    </div>
                                    <span className={`ws-badge ws-badge--${badge}`}>{label}</span>
                                </div>
                                <div
                                    style={{
                                        display: 'flex',
                                        gap: 8,
                                        marginTop: 12,
                                        flexWrap: 'wrap',
                                        alignItems: 'center',
                                    }}
                                >
                                    <RowActionsMenu
                                        ariaLabel={t('action.aria', { id: o.id })}
                                        items={[
                                            { label: t('action.view'), onClick: () => viewOrder(o) },
                                            ...(o.status === 'pending_acceptance'
                                                ? [
                                                      {
                                                          label: t('action.accept'),
                                                          onClick: () => accept(o.id),
                                                      },
                                                      {
                                                          label: t('action.reject'),
                                                          onClick: () => reject(o.id),
                                                          danger: true,
                                                      },
                                                  ]
                                                : []),
                                            ...(o.status === 'accepted'
                                                ? [
                                                      {
                                                          label: t('action.startProcessing'),
                                                          onClick: () => startProcessing(o.id),
                                                      },
                                                  ]
                                                : []),
                                            ...(o.status === 'processing'
                                                ? [
                                                      {
                                                          label: t('action.readyToDispatch'),
                                                          onClick: () => markReadyToDispatch(o.id),
                                                      },
                                                  ]
                                                : []),
                                            ...(o.status === 'ready_to_dispatch'
                                                ? [
                                                      {
                                                          label: t('action.dispatch'),
                                                          onClick: () => dispatch(o.id),
                                                      },
                                                  ]
                                                : []),
                                            ...(o.status === 'dispatched'
                                                ? [
                                                      {
                                                          label: t('action.markDelivered'),
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
                        title={t('modal.title', { id: selectedOrder.id })}
                        onClose={() => {
                            setViewModalOpen(false);
                            setSelectedOrder(null);
                        }}
                        width="700px"
                        footer={
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button
                                    className="btn-portal-outline"
                                    onClick={() => setViewModalOpen(false)}
                                >
                                    {t('modal.close')}
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
                                    <p style={{ margin: 0, fontSize: '0.8125rem' }}>
                                        <strong>{t('modal.branch')}</strong>{' '}
                                        {selectedOrder.branch || t('emdash')}
                                    </p>
                                    <p style={{ margin: '6px 0 0 0', fontSize: '0.8125rem' }}>
                                        <strong>{t('modal.requestedAt')}</strong>{' '}
                                        {selectedOrder.requested || t('emdash')}
                                    </p>
                                    <p style={{ margin: '6px 0 0 0', fontSize: '0.8125rem' }}>
                                        <strong>{t('modal.status')}</strong>{' '}
                                        {statusLabelMap[selectedOrder.status] ||
                                            selectedOrder.status ||
                                            t('emdash')}
                                    </p>
                                    <p style={{ margin: '6px 0 0 0', fontSize: '0.8125rem' }}>
                                        <strong>{t('modal.total')}</strong>{' '}
                                        {selectedOrder.total || t('emdash')}
                                    </p>
                                    {selectedOrder.notes ? (
                                        <p style={{ margin: '6px 0 0 0', fontSize: '0.8125rem' }}>
                                            <strong>{t('modal.notes')}</strong> {selectedOrder.notes}
                                        </p>
                                    ) : null}
                                    {selectedOrder.rejectionReason ? (
                                        <p
                                            style={{
                                                margin: '6px 0 0 0',
                                                fontSize: '0.8125rem',
                                                color: 'var(--color-text-muted)',
                                            }}
                                        >
                                            <strong>{t('modal.rejection')}</strong>{' '}
                                            {selectedOrder.rejectionReason}
                                        </p>
                                    ) : null}
                                </div>
                                <div className="ws-section" style={{ marginBottom: 0, padding: 12 }}>
                                    <p style={{ margin: '0 0 8px 0', fontWeight: 700, fontSize: '0.8125rem' }}>
                                        {t('modal.items')}
                                    </p>
                                    {Array.isArray(selectedOrder.items) &&
                                    selectedOrder.items.length > 0 ? (
                                        <table className="ws-table">
                                            <thead>
                                                <tr>
                                                    <th>{t('modal.th.product')}</th>
                                                    <th>{t('modal.th.qty')}</th>
                                                    <th>{t('modal.th.unitPrice')}</th>
                                                    <th>{t('modal.th.total')}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedOrder.items.map((it) => (
                                                    <tr key={it.id || `${it.supplierProductId}-${it.qty}`}>
                                                        <td>
                                                            {it.supplierProductName || t('emdash')}
                                                        </td>
                                                        <td>{it.qty || t('emdash')}</td>
                                                        <td>{it.unitPrice || t('emdash')}</td>
                                                        <td>{it.lineTotal || t('emdash')}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <p
                                            style={{
                                                margin: 0,
                                                fontSize: '0.8125rem',
                                                color: 'var(--color-text-muted)',
                                            }}
                                        >
                                            {t('modal.noItems')}
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
