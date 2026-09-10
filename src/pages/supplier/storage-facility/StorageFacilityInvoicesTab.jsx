import React, { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useStorageFacilityApi } from './StorageFacilityPortalContext';

import RowActionsMenu from '../../../components/RowActionsMenu';
import StorageFacilityInvoicePrint from './StorageFacilityInvoicePrint';
import StorageFacilityNewInvoiceModal from './StorageFacilityNewInvoiceModal';
import { sfInvoiceTypeLabel } from './storageInvoiceScopes';

export default function StorageFacilityInvoicesTab({
    brandId,
    brandName,
    scope,
    products,
    customers,
    suppliers,
    uomProfiles = [],
    onReload,
}) {
    const sfApi = useStorageFacilityApi();
    const isPurchase = scope === 'purchase';
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [invoiceModal, setInvoiceModal] = useState(false);
    const [printInvoice, setPrintInvoice] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const res = await sfApi.listStorageInvoices(brandId, { scope });
            setInvoices(res?.invoices ?? []);
        } catch (e) {
            setErr(e?.message || 'Failed to load invoices');
            setInvoices([]);
        } finally {
            setLoading(false);
        }
    }, [brandId, scope, sfApi]);

    useEffect(() => {
        load();
    }, [load]);

    const handleReload = async () => {
        await load();
        onReload?.();
    };

    const paymentLabel = isPurchase ? 'Pay supplier' : 'Record receipt';

    return (
        <>
            <p className="sf-doc-hint" style={{ marginBottom: 12 }}>
                {isPurchase
                    ? 'Purchase invoices increase storage stock and post to Accounts Payable (Suppliers). Pay from Cash & Bank or Transaction Hub — payments appear in Payments log and financial reports.'
                    : 'Sales invoices (stock sale, storage fee, withdrawal) post to Accounts Receivable and revenue. Receipts clear AR in Cash & Bank, Receipts log, and reports.'}
            </p>
            <button
                type="button"
                className="mgr-si-btn-new"
                style={{ marginBottom: 12 }}
                onClick={() => setInvoiceModal(true)}
            >
                <Plus size={14} /> {isPurchase ? 'New purchase invoice' : 'New sales invoice'}
            </button>
            {err ? (
                <p style={{ color: '#dc2626', fontSize: '0.875rem' }}>{err}</p>
            ) : null}
            {loading && invoices.length === 0 ? (
                <p style={{ color: '#64748b' }}>Loading…</p>
            ) : (
                <div className="premium-table mgr-si-table-wrap">
                    <table className="mgr-si-table">
                        <thead>
                            <tr className="table-header-row">
                                <th className="table-th">Invoice #</th>
                                <th className="table-th">Type</th>
                                <th className="table-th">Date</th>
                                <th className="table-th">Total</th>
                                <th className="table-th">Balance</th>
                                <th className="table-th">Status</th>
                                <th className="table-th">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoices.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="table-cell" style={{ color: '#64748b' }}>
                                        No invoices yet.
                                    </td>
                                </tr>
                            ) : (
                                invoices.map((inv) => (
                                    <tr key={inv.id} className="table-row">
                                        <td className="table-cell">{inv.invoiceNo}</td>
                                        <td className="table-cell">
                                            {sfInvoiceTypeLabel(inv.invoiceType)}
                                        </td>
                                        <td className="table-cell">{inv.issueDate}</td>
                                        <td className="table-cell">
                                            SAR {Number(inv.grandTotal).toLocaleString()}
                                        </td>
                                        <td className="table-cell mgr-si-cell-balance">
                                            SAR {Number(inv.balance).toLocaleString()}
                                        </td>
                                        <td className="table-cell">{inv.status}</td>
                                        <td className="table-cell">
                                            <RowActionsMenu
                                                ariaLabel={`Actions for invoice ${inv.invoiceNo || inv.id}`}
                                                items={[
                                                    {
                                                        label: 'Print',
                                                        onClick: () => setPrintInvoice(inv),
                                                    },
                                                    {
                                                        label: 'Sync accounting',
                                                        hidden: !(
                                                            inv.status === 'posted' &&
                                                            inv.invoiceType === 'withdrawal_to_owner' &&
                                                            inv.needsWarehouseSync
                                                        ),
                                                        onClick: async () => {
                                                            try {
                                                                await sfApi.postStorageInvoice(brandId, inv.id);
                                                                await handleReload();
                                                                window.alert(
                                                                    'Warehouse quantities, stock timeline, and brand accounting synced.',
                                                                );
                                                            } catch (ex) {
                                                                window.alert(ex?.message || 'Sync failed');
                                                            }
                                                        },
                                                    },
                                                    {
                                                        label: 'Sync GL',
                                                        hidden: !(
                                                            inv.status === 'posted' && inv.needsGlSync
                                                        ),
                                                        onClick: async () => {
                                                            try {
                                                                await sfApi.postStorageInvoice(brandId, inv.id);
                                                                await handleReload();
                                                                window.alert(
                                                                    'Brand GL journal posted for this invoice.',
                                                                );
                                                            } catch (ex) {
                                                                window.alert(ex?.message || 'Sync failed');
                                                            }
                                                        },
                                                    },
                                                    {
                                                        label: 'Post',
                                                        hidden: inv.status !== 'draft',
                                                        onClick: async () => {
                                                            await sfApi.postStorageInvoice(brandId, inv.id);
                                                            await handleReload();
                                                        },
                                                    },
                                                    {
                                                        label: paymentLabel,
                                                        hidden: !(inv.status === 'posted' && inv.balance > 0),
                                                        onClick: async () => {
                                                            const amt = prompt(
                                                                `${paymentLabel} amount (SAR)`,
                                                                String(inv.balance),
                                                            );
                                                            if (!amt) return;
                                                            await sfApi.recordStorageInvoicePayment(
                                                                brandId,
                                                                inv.id,
                                                                { amount: Number(amt), method: 'cash' },
                                                            );
                                                            await handleReload();
                                                        },
                                                    },
                                                ]}
                                            />
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
            {invoiceModal ? (
                <StorageFacilityNewInvoiceModal
                    brandId={brandId}
                    brandName={brandName}
                    products={products}
                    customers={customers}
                    suppliers={suppliers}
                    uomProfiles={uomProfiles}
                    mode={isPurchase ? 'purchase' : 'sales'}
                    onClose={() => setInvoiceModal(false)}
                    onSaved={handleReload}
                />
            ) : null}
            {printInvoice ? (
                <StorageFacilityInvoicePrint
                    brandId={brandId}
                    invoice={printInvoice}
                    onClose={() => setPrintInvoice(null)}
                />
            ) : null}
        </>
    );
}
