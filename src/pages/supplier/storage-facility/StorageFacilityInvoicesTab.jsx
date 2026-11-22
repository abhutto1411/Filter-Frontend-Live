import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, FileText, Plus, RotateCcw } from 'lucide-react';
import { useStorageFacilityApi } from './StorageFacilityPortalContext';
import { useSfT } from './useSfT';
import { useDocumentLang } from '../../../hooks/useDocumentLang';
import { money2, sfDate } from './sfFormat';
import SupplierRiyalAmount from '../SupplierRiyalAmount';
import SupplierJournalChip from '../SupplierJournalChip';
import UiPager from '../../../components/UiPager';
import { usePagedRows } from '../../../hooks/usePagedRows';
import RowActionsMenu from '../../../components/RowActionsMenu';
import StorageFacilityInvoicePrint from './StorageFacilityInvoicePrint';
import StorageFacilityNewInvoiceModal from './StorageFacilityNewInvoiceModal';
import '../../../styles/ui.css';

/** Posted is the settled state; a draft has not hit the ledger yet. */
function statusTone(status) {
    if (status === 'posted') return 'ok';
    if (status === 'draft') return 'warn';
    return 'neutral';
}

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
    const t = useSfT();
    const locale = useDocumentLang();
    const sfApi = useStorageFacilityApi();
    const isPurchase = scope === 'purchase';
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [invoiceModal, setInvoiceModal] = useState(false);
    const [printInvoice, setPrintInvoice] = useState(null);
    const [reloadKey, setReloadKey] = useState(0);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await sfApi.listStorageInvoices(brandId, { scope });
            setInvoices(res?.invoices ?? []);
            setLoadError(false);
        } catch {
            setInvoices([]);
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    }, [brandId, scope, sfApi]);

    useEffect(() => {
        load();
    }, [load, reloadKey]);

    // The endpoint returns the brand's whole invoice list for this scope.
    const paging = usePagedRows(invoices, { resetKey: `${brandId}|${scope}` });

    const handleReload = useCallback(async () => {
        await load();
        onReload?.();
    }, [load, onReload]);

    const paymentLabel = isPurchase ? t('inv.act.payNow') : t('inv.act.receiveNow');

    /** The amount prompt used to pass whatever was typed straight to the API,
     *  so an empty or non-numeric answer posted a payment of NaN. */
    const askPayment = async (inv) => {
        const typed = window.prompt(
            t('inv.pay.prompt', { action: paymentLabel, balance: money2(inv.balance) }),
            money2(inv.balance),
        );
        if (typed === null) return;
        const amount = Number(String(typed).replace(/,/g, '').trim());
        if (!Number.isFinite(amount) || amount <= 0) {
            window.alert(t('inv.pay.invalid'));
            return;
        }
        if (amount > Number(inv.balance) + 0.005) {
            window.alert(t('inv.pay.overBalance', { balance: money2(inv.balance) }));
            return;
        }
        try {
            await sfApi.recordStorageInvoicePayment(brandId, inv.id, { amount, method: 'cash' });
            await handleReload();
        } catch (ex) {
            window.alert(ex?.message || t('inv.err.payment'));
        }
    };

    const rowActions = (inv) => [
        {
            label: t('inv.act.print'),
            onClick: () => setPrintInvoice(inv),
        },
        {
            label: t('inv.act.syncStock'),
            hidden: !(
                inv.status === 'posted' &&
                inv.invoiceType === 'withdrawal_to_owner' &&
                inv.needsWarehouseSync
            ),
            onClick: async () => {
                try {
                    await sfApi.postStorageInvoice(brandId, inv.id);
                    await handleReload();
                    window.alert(t('inv.ok.syncStock'));
                } catch (ex) {
                    window.alert(ex?.message || t('inv.err.sync'));
                }
            },
        },
        {
            label: t('inv.act.syncGl'),
            hidden: !(inv.status === 'posted' && inv.needsGlSync),
            onClick: async () => {
                try {
                    await sfApi.postStorageInvoice(brandId, inv.id);
                    await handleReload();
                    window.alert(t('inv.ok.syncGl'));
                } catch (ex) {
                    window.alert(ex?.message || t('inv.err.sync'));
                }
            },
        },
        {
            label: t('inv.act.post'),
            hidden: inv.status !== 'draft',
            onClick: async () => {
                // Posting used to run unguarded: a rejection surfaced only as an
                // unhandled rejection in the console.
                try {
                    await sfApi.postStorageInvoice(brandId, inv.id);
                    await handleReload();
                } catch (ex) {
                    window.alert(ex?.message || t('inv.err.post'));
                }
            },
        },
        {
            label: paymentLabel,
            hidden: !(inv.status === 'posted' && Number(inv.balance) > 0),
            onClick: () => askPayment(inv),
        },
    ];

    return (
        <div className="ui-root ui-root--flush ui-stack">
            <p className="ui-lead">
                {isPurchase ? t('inv.lead.purchase') : t('inv.lead.sales')}
            </p>

            <div className="ui-table-wrap" style={{ overflowX: 'hidden', minWidth: 0 }}>
                <div className="ui-toolbar">
                    <span>{t('inv.count', { n: invoices.length })}</span>
                    <div className="ui-toolbar-end">
                        <button
                            type="button"
                            className="ui-btn ui-btn--primary ui-btn--sm"
                            onClick={() => setInvoiceModal(true)}
                        >
                            <Plus size={14} />{' '}
                            {isPurchase ? t('inv.new.purchase') : t('inv.new.sales')}
                        </button>
                    </div>
                </div>

                {!loading && loadError ? (
                    <div className="ui-empty">
                        <div className="ui-empty-icon"><AlertTriangle size={18} /></div>
                        <div className="ui-empty-title">{t('inv.errLoad')}</div>
                        <div className="ui-empty-sub">{t('inv.errSub')}</div>
                        <button
                            type="button"
                            className="ui-btn ui-btn--default ui-btn--sm"
                            onClick={() => setReloadKey((k) => k + 1)}
                        >
                            <RotateCcw size={13} /> {t('inv.retry')}
                        </button>
                    </div>
                ) : !loading && invoices.length === 0 ? (
                    <div className="ui-empty">
                        <div className="ui-empty-icon"><FileText size={18} /></div>
                        <div className="ui-empty-title">{t('inv.emptyTitle')}</div>
                        <div className="ui-empty-sub">
                            {isPurchase ? t('inv.emptySub.purchase') : t('inv.emptySub.sales')}
                        </div>
                    </div>
                ) : (
                    <table className="ui-table">
                        <thead>
                            <tr>
                                <th>{t('inv.th.no')}</th>
                                <th>{t('inv.th.type')}</th>
                                <th>{t('inv.th.date')}</th>
                                <th className="ui-num">{t('inv.th.total')}</th>
                                <th className="ui-num">{t('inv.th.balance')}</th>
                                <th>{t('inv.th.status')}</th>
                                <th>{t('inv.th.journal')}</th>
                                <th aria-label={t('inv.th.actions')} />
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 6 }).map((_, i) => (
                                    <tr key={`sk-${i}`} className="ui-sk-row">
                                        <td><div className="ui-sk ui-sk--strong ui-sk--w55" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w70" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                                        <td><div className="ui-sk ui-sk--pill" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                                        <td><div className="ui-sk ui-sk--btn ui-sk--w25" /></td>
                                    </tr>
                                ))
                            ) : paging.pagedRows.map((inv) => (
                                <tr key={inv.id}>
                                    <td data-label={t('inv.th.no')} className="ui-mono ui-nowrap">
                                        {inv.invoiceNo}
                                    </td>
                                    <td data-label={t('inv.th.type')}>
                                        {t(`inv.type.${inv.invoiceType}`)}
                                    </td>
                                    <td data-label={t('inv.th.date')} className="ui-nowrap">
                                        {sfDate(inv.issueDate)}
                                    </td>
                                    <td data-label={t('inv.th.total')} className="ui-num">
                                        <SupplierRiyalAmount amount={inv.grandTotal} size={14} />
                                    </td>
                                    <td data-label={t('inv.th.balance')} className="ui-num">
                                        <SupplierRiyalAmount amount={inv.balance} size={14} />
                                    </td>
                                    <td data-label={t('inv.th.status')}>
                                        <span className={`ui-pill ui-pill--${statusTone(inv.status)}`}>
                                            {t(`inv.status.${inv.status}`)}
                                        </span>
                                    </td>
                                    <td data-label={t('inv.th.journal')}>
                                        <SupplierJournalChip
                                            journalEntryNumber={inv.journalEntryNumber}
                                            journalId={inv.journalId}
                                            locale={locale}
                                        />
                                    </td>
                                    <td>
                                        <div className="ui-rowacts">
                                            <RowActionsMenu
                                                ariaLabel={t('inv.act.menu', {
                                                    no: inv.invoiceNo || inv.id,
                                                })}
                                                items={rowActions(inv)}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                <UiPager {...paging.pagerProps} />
            </div>

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
        </div>
    );
}
