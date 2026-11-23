import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, Loader, Package, Plus, RotateCcw, Search, Users } from 'lucide-react';
import Modal from '../../../components/Modal';
import RowActionsMenu from '../../../components/RowActionsMenu';
import UiPager from '../../../components/UiPager';
import { usePagedRows } from '../../../hooks/usePagedRows';
import { useStorageFacilityApi } from './StorageFacilityPortalContext';
import { useSfT } from './useSfT';
import { money2, sfMoney, sfDate } from './sfFormat';
import '../../../styles/ui.css';

const EMPTY_FORM = { name: '', code: '', contactPerson: '', email: '', mobile: '' };

/** A receivable is owed to the brand; a negative one is the customer in credit. */
function arTone(amount) {
    const v = Number(amount || 0);
    if (v < -0.005) return 'in';
    if (v > 0.005) return 'out';
    return '';
}

function statusTone(status) {
    if (status === 'overpaid') return 'info';
    if (status === 'unpaid') return 'warn';
    return 'ok';
}

function CustomerForm({ initial, saving, onSubmit, onCancel }) {
    const t = useSfT();
    const [form, setForm] = useState(() => ({ ...EMPTY_FORM, ...(initial || {}) }));
    const setField = (field) => (e) => {
        const { value } = e.target;
        setForm((f) => ({ ...f, [field]: value }));
    };

    return (
        <form onSubmit={(e) => onSubmit(e, form)}>
            <div className="ui-form-grid">
                <div className="ui-field ui-col-12">
                    <label htmlFor="sf-cust-name">{t('ar.label.name')}</label>
                    <input
                        id="sf-cust-name"
                        type="text"
                        className="ui-input"
                        value={form.name}
                        onChange={setField('name')}
                        required
                    />
                </div>
                <div className="ui-field ui-col-6">
                    <label htmlFor="sf-cust-code">
                        {t('ar.label.code')}{' '}
                        <span className="ui-field-opt">{t('ar.optional')}</span>
                    </label>
                    <input
                        id="sf-cust-code"
                        type="text"
                        className="ui-input"
                        value={form.code}
                        onChange={setField('code')}
                    />
                </div>
                <div className="ui-field ui-col-6">
                    <label htmlFor="sf-cust-mobile">
                        {t('ar.label.mobile')}{' '}
                        <span className="ui-field-opt">{t('ar.optional')}</span>
                    </label>
                    <input
                        id="sf-cust-mobile"
                        type="text"
                        className="ui-input"
                        value={form.mobile}
                        onChange={setField('mobile')}
                    />
                </div>
                <div className="ui-field ui-col-6">
                    <label htmlFor="sf-cust-contact">
                        {t('ar.label.contact')}{' '}
                        <span className="ui-field-opt">{t('ar.optional')}</span>
                    </label>
                    <input
                        id="sf-cust-contact"
                        type="text"
                        className="ui-input"
                        value={form.contactPerson}
                        onChange={setField('contactPerson')}
                    />
                </div>
                <div className="ui-field ui-col-6">
                    <label htmlFor="sf-cust-email">
                        {t('ar.label.email')}{' '}
                        <span className="ui-field-opt">{t('ar.optional')}</span>
                    </label>
                    <input
                        id="sf-cust-email"
                        type="email"
                        className="ui-input"
                        autoComplete="off"
                        value={form.email}
                        onChange={setField('email')}
                    />
                </div>
            </div>

            <div className="ui-form-foot">
                <button
                    type="button"
                    className="ui-btn ui-btn--default"
                    disabled={saving}
                    onClick={onCancel}
                >
                    {t('ar.btn.cancel')}
                </button>
                <button type="submit" className="ui-btn ui-btn--primary" disabled={saving}>
                    {saving ? (
                        <><Loader size={14} className="ui-spin" /> {t('ar.btn.saving')}</>
                    ) : t('ar.btn.save')}
                </button>
            </div>
        </form>
    );
}

export default function StorageFacilityCustomersTab({ brandId }) {
    const t = useSfT();
    const sfApi = useStorageFacilityApi();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [search, setSearch] = useState('');
    const [searchDebounced, setSearchDebounced] = useState('');
    const [reloadKey, setReloadKey] = useState(0);

    const [addOpen, setAddOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [saving, setSaving] = useState(false);

    const [detailId, setDetailId] = useState(null);
    const [detail, setDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setSearchDebounced(search.trim()), 300);
        return () => clearTimeout(timer);
    }, [search]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            // One search, server-side. The old screen ran two at once: `q` on the
            // request and a second filter over the rows it came back with, so
            // typing hid rows the server had already matched.
            const res = await sfApi.listStorageCustomers(brandId, {
                q: searchDebounced || undefined,
            });
            setRows(Array.isArray(res?.customers) ? res.customers : []);
            setLoadError(false);
        } catch {
            setRows([]);
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    }, [brandId, searchDebounced, sfApi]);

    useEffect(() => {
        load();
    }, [load, reloadKey]);

    const paging = usePagedRows(rows, { resetKey: `${brandId}|${searchDebounced}` });

    const openDetail = useCallback(async (customerId) => {
        setDetailId(customerId);
        setDetail(null);
        setDetailError(false);
        setDetailLoading(true);
        try {
            const res = await sfApi.getStorageCustomer(brandId, customerId);
            setDetail(res);
        } catch {
            setDetailError(true);
        } finally {
            setDetailLoading(false);
        }
    }, [brandId, sfApi]);

    const handleCreate = async (e, form) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        setSaving(true);
        try {
            await sfApi.createStorageCustomer(brandId, form);
            setAddOpen(false);
            setReloadKey((k) => k + 1);
        } catch (ex) {
            window.alert(ex?.message || t('ar.errCreate'));
        } finally {
            setSaving(false);
        }
    };

    const handleUpdate = async (e, form) => {
        e.preventDefault();
        if (!editing?.id || !form.name.trim()) return;
        setSaving(true);
        try {
            await sfApi.updateStorageCustomer(brandId, editing.id, {
                name: form.name.trim(),
                code: form.code?.trim() || undefined,
                contactPerson: form.contactPerson?.trim() || undefined,
                email: form.email?.trim() || undefined,
                mobile: form.mobile?.trim() || undefined,
            });
            setEditing(null);
            setReloadKey((k) => k + 1);
        } catch (ex) {
            window.alert(ex?.message || t('ar.errUpdate'));
        } finally {
            setSaving(false);
        }
    };

    /** The amount used to go straight to the API, so an empty prompt posted NaN. */
    const recordPayment = async (invoiceId, balance) => {
        const typed = window.prompt(
            t('ar.pay.prompt', { balance: sfMoney(t, balance) }),
            money2(balance),
        );
        if (typed === null) return;
        const amount = Number(String(typed).replace(/,/g, '').trim());
        if (!Number.isFinite(amount) || amount <= 0) {
            window.alert(t('ar.pay.invalid'));
            return;
        }
        if (amount > Number(balance) + 0.005) {
            window.alert(t('ar.pay.overBalance', { balance: sfMoney(t, balance) }));
            return;
        }
        try {
            await sfApi.recordStorageInvoicePayment(brandId, invoiceId, {
                amount,
                method: 'cash',
            });
            await openDetail(detailId);
            setReloadKey((k) => k + 1);
        } catch (ex) {
            window.alert(ex?.message || t('ar.pay.err'));
        }
    };

    if (detailId) {
        const c = detail?.customer;
        const invoices = detail?.invoices ?? [];
        const stockSold = detail?.stockSold ?? [];
        return (
            <div className="ui-root ui-root--flush ui-stack">
                <div>
                    <button
                        type="button"
                        className="ui-btn ui-btn--subtle ui-btn--sm"
                        onClick={() => {
                            setDetailId(null);
                            setDetail(null);
                        }}
                    >
                        <ArrowLeft size={14} /> {t('ar.back')}
                    </button>
                </div>

                {detailLoading ? (
                    <div className="ui-stack" aria-busy="true">
                        <div className="ui-sk ui-sk--title ui-sk--w40" />
                        <div className="ui-sk ui-sk--text ui-sk--w70" />
                        <div className="ui-table-wrap">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={`sk-${i}`} className="ui-list-row ui-sk-row">
                                    <div className="ui-list-main">
                                        <div className="ui-sk ui-sk--strong ui-sk--w55" />
                                    </div>
                                    <div className="ui-sk ui-sk--text ui-sk--w25" />
                                </div>
                            ))}
                        </div>
                    </div>
                ) : detailError || !c ? (
                    <div className="ui-empty">
                        <div className="ui-empty-icon"><AlertTriangle size={18} /></div>
                        <div className="ui-empty-title">{t('ar.errDetail')}</div>
                        <button
                            type="button"
                            className="ui-btn ui-btn--default ui-btn--sm"
                            onClick={() => openDetail(detailId)}
                        >
                            <RotateCcw size={13} /> {t('ar.retry')}
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="ui-row">
                            <div className="ui-head">
                                <h1>{c.name}</h1>
                                <p>
                                    {[c.email, c.mobile, c.contactPerson].filter(Boolean).join(' · ') ||
                                        t('ar.noContact')}
                                </p>
                            </div>
                            <div className="ui-toolbar-end">
                                <div className="ui-figure">
                                    <p className="ui-figure-label">{t('ar.receivable')}</p>
                                    <p className="ui-figure-value">{sfMoney(t, c.accountsReceivable)}</p>
                                    <span className={`ui-pill ui-pill--${statusTone(c.status)}`}>
                                        {t(`ar.status.${c.status || 'paid'}`)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="ui-stack-sm">
                            <div className="ui-label">{t('ar.invoices')}</div>
                            <div className="ui-table-wrap">
                                {invoices.length === 0 ? (
                                    <div className="ui-empty">
                                        <div className="ui-empty-title">{t('ar.inv.emptyTitle')}</div>
                                        <div className="ui-empty-sub">{t('ar.inv.emptySub')}</div>
                                    </div>
                                ) : (
                                    <table className="ui-table">
                                        <thead>
                                            <tr>
                                                <th>{t('ar.inv.th.no')}</th>
                                                <th>{t('ar.inv.th.type')}</th>
                                                <th>{t('ar.inv.th.date')}</th>
                                                <th className="ui-num">{t('ar.inv.th.total')}</th>
                                                <th className="ui-num">{t('ar.inv.th.balance')}</th>
                                                <th>{t('ar.inv.th.status')}</th>
                                                <th aria-label={t('ar.th.actions')} />
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {invoices.map((inv) => (
                                                <tr key={inv.id}>
                                                    <td data-label={t('ar.inv.th.no')} className="ui-mono ui-nowrap">
                                                        {inv.invoiceNo}
                                                    </td>
                                                    <td data-label={t('ar.inv.th.type')}>
                                                        {t(`inv.type.${inv.invoiceType}`)}
                                                    </td>
                                                    <td data-label={t('ar.inv.th.date')} className="ui-nowrap">
                                                        {sfDate(inv.issueDate)}
                                                    </td>
                                                    <td data-label={t('ar.inv.th.total')} className="ui-num">
                                                        {sfMoney(t, inv.grandTotal)}
                                                    </td>
                                                    <td
                                                        data-label={t('ar.inv.th.balance')}
                                                        className={`ui-num ui-money${inv.isOverdue ? ' ui-money--out' : ''}`}
                                                    >
                                                        {sfMoney(t, inv.netBalance)}
                                                    </td>
                                                    <td data-label={t('ar.inv.th.status')}>
                                                        <span className={`ui-pill ui-pill--${inv.isOverdue ? 'dang' : 'neutral'}`}>
                                                            {inv.isOverdue
                                                                ? t('ar.inv.overdue')
                                                                : t(`inv.status.${inv.status}`)}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {inv.status === 'posted' && Number(inv.balance) > 0 ? (
                                                            <div className="ui-rowacts">
                                                                <button
                                                                    type="button"
                                                                    className="ui-btn ui-btn--default ui-btn--sm"
                                                                    onClick={() => recordPayment(inv.id, inv.balance)}
                                                                >
                                                                    {t('ar.recordPayment')}
                                                                </button>
                                                            </div>
                                                        ) : null}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>

                        <div className="ui-stack-sm">
                            <div className="ui-label">{t('ar.stock')}</div>
                            <div className="ui-table-wrap">
                                {stockSold.length === 0 ? (
                                    <div className="ui-empty">
                                        <div className="ui-empty-icon"><Package size={18} /></div>
                                        <div className="ui-empty-title">{t('ar.stock.emptyTitle')}</div>
                                        <div className="ui-empty-sub">{t('ar.stock.emptySub')}</div>
                                    </div>
                                ) : (
                                    <table className="ui-table">
                                        <thead>
                                            <tr>
                                                <th>{t('ar.stock.th.product')}</th>
                                                <th>{t('ar.stock.th.sku')}</th>
                                                <th className="ui-num">{t('ar.stock.th.qty')}</th>
                                                <th className="ui-num">{t('ar.stock.th.amount')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {stockSold.map((s) => (
                                                <React.Fragment key={s.productId}>
                                                    <tr className="ui-row-sum ui-row-sum--open">
                                                        <td data-label={t('ar.stock.th.product')}>
                                                            {s.productName}
                                                        </td>
                                                        <td data-label={t('ar.stock.th.sku')} className="ui-mono">
                                                            {s.sku || '—'}
                                                        </td>
                                                        <td data-label={t('ar.stock.th.qty')} className="ui-num">
                                                            {s.totalQty} {s.unit}
                                                        </td>
                                                        <td data-label={t('ar.stock.th.amount')} className="ui-num">
                                                            {sfMoney(t, s.totalAmount)}
                                                        </td>
                                                    </tr>
                                                    {s.lines.map((ln, idx) => (
                                                        <tr key={`${s.productId}-${idx}`}>
                                                            <td colSpan={2} data-label={t('ar.inv.th.no')}>
                                                                <span className="ui-mono">{ln.invoiceNo}</span>
                                                                <span className="ui-meta"> · {sfDate(ln.issueDate)}</span>
                                                            </td>
                                                            <td data-label={t('ar.stock.th.qty')} className="ui-num">
                                                                {ln.qty}
                                                            </td>
                                                            <td data-label={t('ar.stock.th.amount')} className="ui-num">
                                                                {sfMoney(t, ln.lineTotal)}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </React.Fragment>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        );
    }

    return (
        <div className="ui-root ui-root--flush ui-stack">
            <p className="ui-lead">{t('ar.lead')}</p>

            <div className="ui-table-wrap">
                <div className="ui-toolbar">
                    <div className="ui-search">
                        <Search size={14} />
                        <input
                            type="text"
                            className="ui-input"
                            placeholder={t('ar.search')}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <span>
                        {searchDebounced
                            ? t('ar.matches', { n: rows.length })
                            : t('ar.count', { n: rows.length })}
                    </span>
                    <div className="ui-toolbar-end">
                        <button
                            type="button"
                            className="ui-btn ui-btn--primary ui-btn--sm"
                            onClick={() => setAddOpen(true)}
                        >
                            <Plus size={14} /> {t('ar.new')}
                        </button>
                    </div>
                </div>

                {!loading && loadError ? (
                    <div className="ui-empty">
                        <div className="ui-empty-icon"><AlertTriangle size={18} /></div>
                        <div className="ui-empty-title">{t('ar.errLoad')}</div>
                        <div className="ui-empty-sub">{t('ar.errSub')}</div>
                        <button
                            type="button"
                            className="ui-btn ui-btn--default ui-btn--sm"
                            onClick={() => setReloadKey((k) => k + 1)}
                        >
                            <RotateCcw size={13} /> {t('ar.retry')}
                        </button>
                    </div>
                ) : !loading && rows.length === 0 ? (
                    <div className="ui-empty">
                        <div className="ui-empty-icon">
                            {searchDebounced ? <Search size={18} /> : <Users size={18} />}
                        </div>
                        <div className="ui-empty-title">
                            {searchDebounced ? t('ar.noMatchTitle') : t('ar.emptyTitle')}
                        </div>
                        <div className="ui-empty-sub">
                            {searchDebounced ? t('ar.noMatchSub') : t('ar.emptySub')}
                        </div>
                    </div>
                ) : (
                    <table className="ui-table ui-table--pick">
                        <thead>
                            <tr>
                                <th>{t('ar.th.name')}</th>
                                <th className="ui-num">{t('ar.th.receivable')}</th>
                                <th>{t('ar.th.status')}</th>
                                <th aria-label={t('ar.th.actions')} />
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 8 }).map((_, i) => (
                                    <tr key={`sk-${i}`} className="ui-sk-row">
                                        <td><div className="ui-sk ui-sk--strong ui-sk--w70" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                                        <td><div className="ui-sk ui-sk--pill" /></td>
                                        <td><div className="ui-sk ui-sk--btn ui-sk--w25" /></td>
                                    </tr>
                                ))
                            ) : paging.pagedRows.map((row) => {
                                const tone = arTone(row.accountsReceivable);
                                return (
                                    <tr key={row.id} onClick={() => openDetail(row.id)}>
                                        <td data-label={t('ar.th.name')}>
                                            {/* The name opens the customer, so a keyboard
                                                reaches every row the pointer can. */}
                                            <button
                                                type="button"
                                                className="ui-link"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openDetail(row.id);
                                                }}
                                            >
                                                {row.name}
                                            </button>
                                        </td>
                                        <td
                                            data-label={t('ar.th.receivable')}
                                            className={`ui-num ui-money${tone ? ` ui-money--${tone}` : ''}`}
                                        >
                                            {sfMoney(t, row.accountsReceivable)}
                                        </td>
                                        <td data-label={t('ar.th.status')}>
                                            <span className={`ui-pill ui-pill--${statusTone(row.status)}`}>
                                                {t(`ar.status.${row.status || 'paid'}`)}
                                            </span>
                                        </td>
                                        <td onClick={(e) => e.stopPropagation()}>
                                            <div className="ui-rowacts">
                                                <RowActionsMenu
                                                    ariaLabel={t('ar.act.menu', { name: row.name })}
                                                    items={[
                                                        {
                                                            label: t('ar.act.open'),
                                                            onClick: () => openDetail(row.id),
                                                        },
                                                        {
                                                            // Editing used to be a bare
                                                            // prompt() for the name, and a
                                                            // failed save said nothing.
                                                            label: t('ar.act.edit'),
                                                            onClick: () => setEditing(row),
                                                        },
                                                    ]}
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
                <UiPager {...paging.pagerProps} />
            </div>

            {addOpen ? (
                <Modal
                    title={t('ar.modal.add')}
                    width="560px"
                    // Portalled to <body>, outside this page's `.ui-root`, so
                    // the modal has to carry the design tokens itself.
                    contentClassName="ui-tokens"
                    disableClose={saving}
                    onClose={() => setAddOpen(false)}
                >
                    <CustomerForm
                        saving={saving}
                        onSubmit={handleCreate}
                        onCancel={() => !saving && setAddOpen(false)}
                    />
                </Modal>
            ) : null}

            {editing ? (
                <Modal
                    title={t('ar.modal.edit')}
                    width="560px"
                    contentClassName="ui-tokens"
                    disableClose={saving}
                    onClose={() => setEditing(null)}
                >
                    <CustomerForm
                        initial={{
                            name: editing.name || '',
                            code: editing.code || '',
                            contactPerson: editing.contactPerson || '',
                            email: editing.email || '',
                            mobile: editing.mobile || '',
                        }}
                        saving={saving}
                        onSubmit={handleUpdate}
                        onCancel={() => !saving && setEditing(null)}
                    />
                </Modal>
            ) : null}
        </div>
    );
}
