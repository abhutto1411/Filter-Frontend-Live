import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, DollarSign, Plus } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import Modal from '../../components/Modal';
import RowActionsMenu from '../../components/RowActionsMenu';
import {
    createSupplierExpense,
    createSupplierExpenseCategory,
    deleteSupplierExpense,
    getSupplierExpenseCategories,
    getSupplierExpensesStats,
    listSupplierExpenses,
    listSupplierSuperSuppliers,
    postSupplierExpense,
    updateSupplierExpense,
    voidSupplierExpense,
} from '../../services/supplierApi';
import { listSupplierCashAccounts } from '../../services/supplierAccountingApi';
import { ShimmerTable } from '../../components/supplier/Shimmer';
import { sexpT } from '../../utils/supplierExpensesI18n';
import { SUPPLIER_PERM, useSupplierCan } from '../../utils/supplierPermissions';
import { toRiyadhDateISO } from '../../utils/riyadhBusinessRange';
import SupplierJournalChip from './SupplierJournalChip';
import SupplierRiyalAmount from './SupplierRiyalAmount';
import './supplierPortal.css';

/**
 * SP-04 — supplier-owned expenses (supplier_expenses), posted to the supplier ledger:
 *   Dr 6000 (or the category's account) + Dr 1300 VAT / Cr cash · bank · AP 2000.
 * Draft = no journal. "Post expense" creates/updates AND posts in one transaction.
 */

const STATUS_BADGE = {
    draft: 'ws-badge--yellow',
    posted: 'ws-badge--green',
    void: 'ws-badge--red',
};

const PAGE_SIZE = 500;

/** Exact 2-dp sum in halalas (no float drift for the preview total). */
function addMoney(a, b) {
    const toHalalas = (v) => {
        const n = Number(v);
        if (!Number.isFinite(n)) return 0;
        return Number((n * 100).toFixed(0));
    };
    return (toHalalas(a) + toHalalas(b)) / 100;
}

const emptyForm = () => ({
    categoryId: '',
    amount: '',
    vatAmount: '',
    date: toRiyadhDateISO(),
    payFrom: 'cash',
    paidFromAccountId: '',
    superSupplierId: '',
    payeeName: '',
    reference: '',
    description: '',
    proofUrl: '',
});

export default function SupplierExpenses({ locale: localeProp }) {
    const locale =
        localeProp ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => sexpT(locale, key, vars), [locale]);
    // SP-22: post / edit / void / delete need supplier.expenses.post (the API 403s otherwise).
    const canExpense = useSupplierCan()(SUPPLIER_PERM.expensePost);
    const gateItems = (items) =>
        canExpense ? items : items.map((it) => ({ ...it, disabled: true, title: t('perm.denied') }));
    const navigate = useNavigate();
    // SP-19: /supplier/expenses?highlight=<id> (journal "Open source document") marks that row.
    const highlightId = new URLSearchParams(useLocation().search).get('highlight') || '';
    const scrolledToRef = useRef('');

    const [list, setList] = useState([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [editExpense, setEditExpense] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(''); // '' | 'draft' | 'post'
    const [apiError, setApiError] = useState('');
    const [saveError, setSaveError] = useState('');
    const [stats, setStats] = useState({
        totalRecords: 0,
        totalExpenses: 0,
        paid: 0,
        pendingApproval: 0,
    });
    const [form, setForm] = useState(emptyForm);
    const [categories, setCategories] = useState([]);
    const [cashAccounts, setCashAccounts] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [vendorsLoaded, setVendorsLoaded] = useState(false);
    const [confirm, setConfirm] = useState(null); // { mode: 'delete' | 'void', expense }
    const [confirmBusy, setConfirmBusy] = useState(false);
    const [voidReason, setVoidReason] = useState('');

    const statusLabel = (status) => {
        const key = `status.${status}`;
        const translated = t(key);
        return translated !== key ? translated : status;
    };

    const mapExpense = useCallback(
        (e) => ({
            id: e.id,
            expenseNumber: e.expenseNumber || '',
            date: e.expenseDate?.slice(0, 10) || e.createdAt?.slice(0, 10) || t('emdash'),
            description: e.description || e.payeeName || e.categoryName || t('fallback.expense'),
            category:
                (locale === 'ar' && e.categoryNameAr) || e.categoryName || t('emdash'),
            categoryId: e.categoryId || '',
            amount: Number(e.amount || 0),
            vatAmount: Number(e.vatAmount || 0),
            totalAmount: Number(e.totalAmount || 0),
            payFrom: e.payFrom || 'cash',
            paidFromAccountId: e.paidFromAccountId || '',
            superSupplierId: e.superSupplierId || '',
            payeeName: e.payeeName || '',
            reference: e.reference || '',
            rawDescription: e.description || '',
            proofUrl: e.proofUrl || '',
            status: e.status || 'draft',
            journalId: e.journalId || null,
            journalEntryNumber: e.journalEntryNumber || null,
        }),
        [locale, t],
    );

    /** Every expense of this supplier — walk pages until `total` is covered. */
    const loadAllExpenses = useCallback(async () => {
        const rows = [];
        let offset = 0;
        for (;;) {
            const res = await listSupplierExpenses({ limit: PAGE_SIZE, offset, status: 'all' });
            const items = Array.isArray(res?.items) ? res.items : [];
            rows.push(...items);
            const total = Number(res?.total ?? rows.length);
            offset += items.length;
            if (!items.length || offset >= total) break;
        }
        return rows;
    }, []);

    const loadData = useCallback(async () => {
        setLoading(true);
        setApiError('');
        try {
            const [expenseRows, categoriesRes, statsRes, cashRes] = await Promise.all([
                loadAllExpenses(),
                getSupplierExpenseCategories(),
                getSupplierExpensesStats(),
                listSupplierCashAccounts().catch(() => null),
            ]);
            setList(expenseRows.map(mapExpense));
            setCategories(Array.isArray(categoriesRes?.categories) ? categoriesRes.categories : []);
            const cashItems = cashRes?.items || cashRes?.data?.items || [];
            setCashAccounts(Array.isArray(cashItems) ? cashItems : []);
            const s = statsRes?.stats || {};
            setStats({
                totalRecords: Number(s.totalRecords || 0),
                totalExpenses: Number(s.totalExpenses || 0),
                paid: Number(s.paid || 0),
                pendingApproval: Number(s.pendingApproval || 0),
            });
        } catch (err) {
            console.error('Supplier expenses API failed:', err);
            setApiError(err?.message || t('error.load'));
        } finally {
            setLoading(false);
        }
    }, [loadAllExpenses, mapExpense, t]);

    useEffect(() => {
        loadData().catch(() => undefined);
    }, [loadData]);

    // Vendors are only needed for "on account" expenses — load on demand.
    useEffect(() => {
        if (!modalOpen || form.payFrom !== 'payable' || vendorsLoaded) return;
        let alive = true;
        listSupplierSuperSuppliers()
            .then((res) => {
                if (!alive) return;
                setVendors(Array.isArray(res?.superSuppliers) ? res.superSuppliers : []);
                setVendorsLoaded(true);
            })
            .catch(() => alive && setVendorsLoaded(true));
        return () => {
            alive = false;
        };
    }, [modalOpen, form.payFrom, vendorsLoaded]);

    const cashChoices = useMemo(
        () =>
            cashAccounts.filter((a) => {
                const kind = String(a.cashKind || '').toLowerCase();
                return form.payFrom === 'bank' ? kind === 'bank' : kind !== 'bank';
            }),
        [cashAccounts, form.payFrom],
    );

    const totalPreview = addMoney(form.amount, form.vatAmount);
    const selectedCategory = categories.find((c) => String(c.id) === String(form.categoryId));
    const debitLabel = selectedCategory?.defaultAccountName || '6000';
    const creditLabel =
        form.payFrom === 'payable' ? '2000' : form.payFrom === 'bank' ? '1010' : '1000';

    const resetForm = () => setForm(emptyForm());

    const resolveCategoryId = async () => {
        if (form.categoryId) return String(form.categoryId);
        if (!form.description?.trim()) return '';
        const guessedName = form.description.trim().slice(0, 40);
        const existing = categories.find(
            (c) => c.name.toLowerCase() === guessedName.toLowerCase(),
        );
        if (existing?.id) return String(existing.id);
        try {
            const created = await createSupplierExpenseCategory({ name: guessedName });
            const createdId = created?.category?.id;
            if (createdId) {
                setCategories((prev) => [
                    ...prev,
                    { id: createdId, name: created?.category?.name || guessedName },
                ]);
                return String(createdId);
            }
        } catch (err) {
            console.error('Create expense category failed:', err);
        }
        return '';
    };

    /** mode: 'draft' saves without a journal; 'post' saves and posts in one transaction. */
    const handleSave = async (mode) => {
        if (!(Number(form.amount) > 0)) {
            setSaveError(t('error.amountRequired'));
            return;
        }
        if (form.payFrom === 'payable' && !form.superSupplierId) {
            setSaveError(t('error.vendorRequired'));
            return;
        }
        setSaving(mode);
        setSaveError('');
        try {
            let categoryId = form.categoryId;
            if (!categoryId) categoryId = await resolveCategoryId();
            if (!categoryId) {
                setSaveError(t('error.categoryRequired'));
                return;
            }
            const payload = {
                categoryId: String(categoryId),
                amount: Number(form.amount) || 0,
                vatAmount: Number(form.vatAmount) || 0,
                totalAmount: totalPreview,
                expenseDate: form.date,
                payFrom: form.payFrom,
                paidFromAccountId:
                    form.payFrom === 'payable' ? null : form.paidFromAccountId || null,
                superSupplierId: form.payFrom === 'payable' ? form.superSupplierId : null,
                payeeName: form.payeeName || null,
                reference: form.reference || null,
                description: form.description || null,
                proofUrl: form.proofUrl || null,
                post: mode === 'post',
            };
            if (editExpense) {
                await updateSupplierExpense(editExpense.id, payload);
            } else {
                await createSupplierExpense(payload);
            }
            setModalOpen(false);
            setEditExpense(null);
            resetForm();
            await loadData();
        } catch (err) {
            console.error('Expense save failed:', err);
            setSaveError(err?.message || (mode === 'post' ? t('error.post') : t('error.save')));
        } finally {
            setSaving('');
        }
    };

    const openAdd = () => {
        setEditExpense(null);
        setSaveError('');
        resetForm();
        setModalOpen(true);
    };

    const openEdit = (expense) => {
        setEditExpense(expense);
        setSaveError('');
        setForm({
            categoryId: expense.categoryId || '',
            amount: String(expense.amount || ''),
            vatAmount: String(expense.vatAmount || ''),
            date: expense.date || toRiyadhDateISO(),
            payFrom: expense.payFrom || 'cash',
            paidFromAccountId: expense.paidFromAccountId || '',
            superSupplierId: expense.superSupplierId || '',
            payeeName: expense.payeeName || '',
            reference: expense.reference || '',
            description: expense.rawDescription || '',
            proofUrl: expense.proofUrl || '',
        });
        setModalOpen(true);
    };

    const postRow = async (expense) => {
        setApiError('');
        try {
            await postSupplierExpense(expense.id);
            await loadData();
        } catch (err) {
            console.error('Post expense failed:', err);
            setApiError(err?.message || t('error.post'));
        }
    };

    const openJournal = (journalId) => {
        if (!journalId) return;
        navigate(`/supplier/accounting/journals/${encodeURIComponent(String(journalId))}`);
    };

    const closeConfirm = () => {
        if (confirmBusy) return;
        setConfirm(null);
        setVoidReason('');
    };

    const runConfirm = async () => {
        if (!confirm?.expense?.id) return;
        setConfirmBusy(true);
        setApiError('');
        try {
            if (confirm.mode === 'void') {
                await voidSupplierExpense(confirm.expense.id, voidReason.trim());
            } else {
                await deleteSupplierExpense(confirm.expense.id);
            }
            setConfirm(null);
            setVoidReason('');
            await loadData();
        } catch (err) {
            console.error('Expense delete/void failed:', err);
            setApiError(
                err?.message || (confirm.mode === 'void' ? t('error.void') : t('error.delete')),
            );
        } finally {
            setConfirmBusy(false);
        }
    };

    const StatCard = ({ label, value, isMoney = true }) => (
        <div className="ws-section" style={{ marginBottom: 0, padding: 14, borderRadius: 10 }}>
            <p
                style={{
                    margin: 0,
                    fontSize: '0.6875rem',
                    color: 'var(--color-text-muted)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                }}
            >
                {label}
            </p>
            <p style={{ margin: '6px 0 0 0', fontSize: '1rem', fontWeight: 800 }}>
                {isMoney ? <SupplierRiyalAmount amount={value} size={14} /> : value}
            </p>
        </div>
    );

    const isReadOnly = Boolean(editExpense && editExpense.status !== 'draft');
    const busy = Boolean(saving);

    return (
        <div style={{ overflowX: 'hidden' }}>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">{t('title', { count: list.length })}</h2>
                    <p className="ws-page-sub">{t('subtitle.ledger')}</p>
                </div>
                <button
                    className="btn-portal"
                    style={{ background: '#2563EB', color: '#fff', border: 'none' }}
                    onClick={openAdd}
                    disabled={!canExpense}
                    title={canExpense ? undefined : t('perm.denied')}
                >
                    <Plus size={15} /> {t('btn.add')}
                </button>
            </div>
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
                    gap: 10,
                    marginBottom: 12,
                }}
            >
                <StatCard label={t('stat.records')} value={String(stats.totalRecords || 0)} isMoney={false} />
                <StatCard label={t('stat.posted')} value={stats.totalExpenses || 0} />
                <StatCard label={t('stat.paidCashBank')} value={stats.paid || 0} />
                <StatCard label={t('stat.drafts')} value={stats.pendingApproval || 0} />
            </div>
            {loading ? (
                <div className="ws-section" style={{ marginBottom: 12, padding: 16 }}>
                    <ShimmerTable rows={8} columns={8} />
                </div>
            ) : null}
            {apiError ? (
                <div
                    className="ws-section"
                    style={{
                        marginBottom: 12,
                        padding: 12,
                        fontSize: '0.8125rem',
                        color: '#B91C1C',
                        border: '1px solid #FECACA',
                        background: '#FEF2F2',
                    }}
                >
                    {t('error.api', { error: apiError })}
                </div>
            ) : null}
            {!loading && list.length === 0 ? (
                <div className="ws-section" style={{ textAlign: 'center', padding: 48 }}>
                    <DollarSign size={48} style={{ opacity: 0.3, margin: '0 auto 16px', display: 'block' }} />
                    <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text-muted)' }}>
                        {t('empty')}
                    </p>
                    <button
                        className="btn-portal"
                        style={{ marginTop: 16, background: '#2563EB', color: '#fff', border: 'none' }}
                        onClick={openAdd}
                        disabled={!canExpense}
                        title={canExpense ? undefined : t('perm.denied')}
                    >
                        <Plus size={15} /> {t('btn.addFirst')}
                    </button>
                </div>
            ) : (
                <div className="ws-section" style={{ overflowX: 'auto' }}>
                    <table className="ws-table">
                        <thead>
                            <tr>
                                <th>{t('th.number')}</th>
                                <th>{t('th.date')}</th>
                                <th>{t('th.description')}</th>
                                <th>{t('th.category')}</th>
                                <th>{t('th.payFrom')}</th>
                                <th>{t('th.total')}</th>
                                <th>{t('th.status')}</th>
                                <th>{t('th.journal')}</th>
                                <th>{t('th.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {list.map((e) => (
                                <tr
                                    key={e.id}
                                    id={`sp-expense-${e.id}`}
                                    className={String(e.id) === highlightId ? 'sp-row-highlight' : undefined}
                                    ref={
                                        String(e.id) === highlightId
                                            ? (el) => {
                                                  if (el && scrolledToRef.current !== highlightId) {
                                                      scrolledToRef.current = highlightId;
                                                      el.scrollIntoView({ block: 'center' });
                                                  }
                                              }
                                            : undefined
                                    }
                                >
                                    <td style={{ fontSize: '0.8rem', fontWeight: 700 }}>{e.expenseNumber}</td>
                                    <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                        {e.date}
                                    </td>
                                    <td>
                                        <strong>{e.description}</strong>
                                    </td>
                                    <td>{e.category}</td>
                                    <td>{t(`payFrom.${e.payFrom}`)}</td>
                                    <td>
                                        <SupplierRiyalAmount amount={e.totalAmount} size={13} />
                                    </td>
                                    <td>
                                        <span className={`ws-badge ${STATUS_BADGE[e.status] || STATUS_BADGE.draft}`}>
                                            {statusLabel(e.status)}
                                        </span>
                                    </td>
                                    <td>
                                        {e.status === 'posted' ? (
                                            <button
                                                type="button"
                                                onClick={() => openJournal(e.journalId)}
                                                disabled={!e.journalId}
                                                title={t('btn.openJournal', {
                                                    number: e.journalEntryNumber || '',
                                                })}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    padding: 0,
                                                    cursor: e.journalId ? 'pointer' : 'default',
                                                }}
                                            >
                                                <SupplierJournalChip
                                                    journalEntryNumber={e.journalEntryNumber}
                                                    journalId={e.journalId}
                                                    locale={locale}
                                                />
                                            </button>
                                        ) : (
                                            t('emdash')
                                        )}
                                    </td>
                                    <td>
                                        <RowActionsMenu
                                            ariaLabel={t('action.aria', {
                                                name: e.description || t('fallback.expense'),
                                            })}
                                            items={gateItems([
                                                {
                                                    label: t('btn.edit'),
                                                    onClick: () => openEdit(e),
                                                    disabled: e.status !== 'draft',
                                                    title:
                                                        e.status !== 'draft'
                                                            ? t('modal.draftOnly')
                                                            : undefined,
                                                },
                                                ...(e.status === 'draft'
                                                    ? [
                                                          {
                                                              label: t('btn.post'),
                                                              onClick: () => postRow(e),
                                                          },
                                                          {
                                                              label: t('btn.delete'),
                                                              onClick: () =>
                                                                  setConfirm({ mode: 'delete', expense: e }),
                                                              danger: true,
                                                          },
                                                      ]
                                                    : []),
                                                ...(e.status === 'posted'
                                                    ? [
                                                          {
                                                              label: t('btn.void'),
                                                              onClick: () =>
                                                                  setConfirm({ mode: 'void', expense: e }),
                                                              danger: true,
                                                          },
                                                      ]
                                                    : []),
                                            ])}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <AnimatePresence>
                {modalOpen && (
                    <Modal
                        title={editExpense ? t('modal.editTitle') : t('modal.addTitle')}
                        onClose={() => {
                            if (busy) return;
                            setModalOpen(false);
                            setEditExpense(null);
                        }}
                        footer={
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                <button
                                    className="btn-portal-outline"
                                    disabled={busy}
                                    onClick={() => {
                                        setModalOpen(false);
                                        setEditExpense(null);
                                    }}
                                >
                                    {t('btn.cancel')}
                                </button>
                                <button
                                    className="btn-portal-outline"
                                    disabled={!form.amount || busy || isReadOnly || !canExpense}
                                    onClick={() => handleSave('draft')}
                                >
                                    {saving === 'draft' ? t('btn.saving') : t('btn.saveDraft')}
                                </button>
                                <button
                                    className="btn-portal"
                                    style={{ background: '#2563EB', color: '#fff', border: 'none' }}
                                    disabled={!form.amount || busy || isReadOnly || !canExpense}
                                    onClick={() => handleSave('post')}
                                >
                                    {saving === 'post' ? t('btn.posting') : t('btn.post')}
                                </button>
                            </div>
                        }
                    >
                        {saveError ? (
                            <div style={{ marginBottom: 10, fontSize: '0.75rem', color: '#B91C1C' }}>
                                {saveError}
                            </div>
                        ) : null}
                        {isReadOnly ? (
                            <div style={{ marginBottom: 10, fontSize: '0.75rem', color: '#B45309' }}>
                                {t('modal.draftOnly')}
                            </div>
                        ) : null}
                        <div className="ws-form-grid">
                            <div className="ws-field" style={{ gridColumn: '1 / -1' }}>
                                <label>{t('modal.category')}</label>
                                <select
                                    value={form.categoryId}
                                    onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                                    disabled={isReadOnly}
                                >
                                    <option value="">{t('modal.selectCategory')}</option>
                                    {categories.map((cat) => (
                                        <option key={cat.id} value={String(cat.id)}>
                                            {(locale === 'ar' && cat.nameAr) || cat.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="ws-field">
                                <label>{t('modal.amount')}</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={form.amount}
                                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                                    disabled={isReadOnly}
                                />
                            </div>
                            <div className="ws-field">
                                <label>{t('modal.vat')}</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={form.vatAmount}
                                    onChange={(e) => setForm((f) => ({ ...f, vatAmount: e.target.value }))}
                                    disabled={isReadOnly}
                                />
                            </div>
                            <div className="ws-field">
                                <label>{t('modal.total')}</label>
                                <div style={{ padding: '8px 0', fontWeight: 700 }}>
                                    <SupplierRiyalAmount amount={totalPreview} size={14} />
                                </div>
                            </div>
                            <div className="ws-field">
                                <label>{t('modal.date')}</label>
                                <input
                                    type="date"
                                    value={form.date}
                                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                                    disabled={isReadOnly}
                                />
                            </div>
                            <div className="ws-field">
                                <label>{t('modal.payFrom')}</label>
                                <select
                                    value={form.payFrom}
                                    onChange={(e) =>
                                        setForm((f) => ({
                                            ...f,
                                            payFrom: e.target.value,
                                            paidFromAccountId: '',
                                        }))
                                    }
                                    disabled={isReadOnly}
                                >
                                    <option value="cash">{t('payFrom.cash')}</option>
                                    <option value="bank">{t('payFrom.bank')}</option>
                                    <option value="payable">{t('payFrom.payable')}</option>
                                </select>
                            </div>
                            {form.payFrom === 'payable' ? (
                                <div className="ws-field">
                                    <label>{t('modal.vendor')}</label>
                                    <select
                                        value={form.superSupplierId}
                                        onChange={(e) =>
                                            setForm((f) => ({ ...f, superSupplierId: e.target.value }))
                                        }
                                        disabled={isReadOnly}
                                    >
                                        <option value="">{t('modal.selectVendor')}</option>
                                        {vendors.map((v) => (
                                            <option key={v.id} value={String(v.id)}>
                                                {v.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                <div className="ws-field">
                                    <label>{t('modal.paidFromAccount')}</label>
                                    <select
                                        value={form.paidFromAccountId}
                                        onChange={(e) =>
                                            setForm((f) => ({ ...f, paidFromAccountId: e.target.value }))
                                        }
                                        disabled={isReadOnly}
                                    >
                                        <option value="">
                                            {t('modal.defaultAccount', {
                                                code: form.payFrom === 'bank' ? '1010' : '1000',
                                            })}
                                        </option>
                                        {cashChoices.map((a) => (
                                            <option key={a.id} value={String(a.id)}>
                                                {[a.code, a.name].filter(Boolean).join(' — ')}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div className="ws-field">
                                <label>{t('modal.payee')}</label>
                                <input
                                    type="text"
                                    value={form.payeeName}
                                    onChange={(e) => setForm((f) => ({ ...f, payeeName: e.target.value }))}
                                    disabled={isReadOnly}
                                />
                            </div>
                            <div className="ws-field">
                                <label>{t('modal.reference')}</label>
                                <input
                                    type="text"
                                    value={form.reference}
                                    onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
                                    disabled={isReadOnly}
                                />
                            </div>
                            <div className="ws-field" style={{ gridColumn: '1 / -1' }}>
                                <label>{t('modal.proofUrl')}</label>
                                <input
                                    type="url"
                                    placeholder={t('modal.proofPlaceholder')}
                                    value={form.proofUrl}
                                    onChange={(e) => setForm((f) => ({ ...f, proofUrl: e.target.value }))}
                                    disabled={isReadOnly}
                                />
                            </div>
                            <div className="ws-field" style={{ gridColumn: '1 / -1' }}>
                                <label>{t('modal.description')}</label>
                                <textarea
                                    rows={3}
                                    value={form.description}
                                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                                    disabled={isReadOnly}
                                />
                            </div>
                            <div
                                className="ws-field"
                                style={{
                                    gridColumn: '1 / -1',
                                    fontSize: '0.75rem',
                                    color: 'var(--color-text-muted)',
                                }}
                            >
                                {t('modal.postingPreview', { debit: debitLabel, credit: creditLabel })}
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
            <AnimatePresence>
                {confirm ? (
                    <Modal
                        title={
                            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: 40,
                                        height: 40,
                                        borderRadius: 10,
                                        background: '#FEF2F2',
                                        color: '#B91C1C',
                                    }}
                                    aria-hidden
                                >
                                    <AlertTriangle size={22} strokeWidth={2.25} />
                                </span>
                                {confirm.mode === 'void' ? t('void.title') : t('delete.title')}
                            </span>
                        }
                        width="440px"
                        onClose={closeConfirm}
                        footer={
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                <button
                                    type="button"
                                    className="btn-portal-outline"
                                    disabled={confirmBusy}
                                    onClick={closeConfirm}
                                >
                                    {t('btn.cancel')}
                                </button>
                                <button
                                    type="button"
                                    className="btn-portal"
                                    style={{ background: '#B91C1C', color: '#fff', border: 'none' }}
                                    disabled={confirmBusy || !canExpense}
                                    onClick={runConfirm}
                                >
                                    {confirm.mode === 'void'
                                        ? confirmBusy
                                            ? t('btn.voiding')
                                            : t('btn.voidConfirm')
                                        : confirmBusy
                                          ? t('btn.deleting')
                                          : t('btn.deleteConfirm')}
                                </button>
                            </div>
                        }
                    >
                        <p style={{ margin: '0 0 12px', fontSize: '0.875rem', lineHeight: 1.5, color: 'var(--color-text)' }}>
                            {confirm.mode === 'void' ? t('void.body') : t('delete.body.draft')}
                        </p>
                        <div
                            style={{
                                padding: 12,
                                borderRadius: 10,
                                background: '#F8FAFC',
                                border: '1px solid var(--color-border)',
                                fontSize: '0.8125rem',
                                lineHeight: 1.5,
                            }}
                        >
                            <div>
                                <strong>{t('delete.description')}</strong>{' '}
                                {confirm.expense.expenseNumber} · {confirm.expense.description || t('emdash')}
                            </div>
                            <div style={{ marginTop: 6 }}>
                                <strong>{t('delete.category')}</strong> {confirm.expense.category || t('emdash')}
                            </div>
                            <div style={{ marginTop: 6 }}>
                                <strong>{t('delete.date')}</strong> {confirm.expense.date}
                            </div>
                            <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
                                <strong>{t('delete.amount')}</strong>
                                <SupplierRiyalAmount amount={confirm.expense.totalAmount} size={13} />
                            </div>
                        </div>
                        {confirm.mode === 'void' ? (
                            <div className="ws-field" style={{ marginTop: 12 }}>
                                <label>{t('void.reason')}</label>
                                <input
                                    type="text"
                                    value={voidReason}
                                    onChange={(e) => setVoidReason(e.target.value)}
                                    disabled={confirmBusy}
                                />
                            </div>
                        ) : null}
                    </Modal>
                ) : null}
            </AnimatePresence>
        </div>
    );
}
