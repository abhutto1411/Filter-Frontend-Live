import React, { useEffect, useState } from 'react';
import { AlertTriangle, DollarSign, Plus, Pencil, Trash2 } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import RowActionsMenu from '../../components/RowActionsMenu';
import {
    createSupplierExpense,
    createSupplierExpenseCategory,
    deleteSupplierExpense,
    getSupplierExpenseCategories,
    getSupplierExpensesStats,
    listSupplierExpenses,
    updateSupplierExpense,
} from '../../services/supplierApi';
import { ShimmerTable } from '../../components/supplier/Shimmer';
const STATUS_BADGE = {
    approved: 'ws-badge--green',
    paid: 'ws-badge--green',
    pending: 'ws-badge--yellow',
    rejected: 'ws-badge--red',
};

export default function SupplierExpenses() {
    const [list, setList] = useState([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [editExpense, setEditExpense] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [apiError, setApiError] = useState('');
    const [saveError, setSaveError] = useState('');
    const [stats, setStats] = useState({
        totalRecords: 0,
        totalExpenses: 0,
        paid: 0,
        pendingApproval: 0,
        currencyCode: 'SAR',
    });
    const [form, setForm] = useState({
        categoryId: '',
        amount: '',
        vatAmount: '',
        date: new Date().toISOString().slice(0, 10),
        description: '',
        proofUrl: '',
    });
    const [categories, setCategories] = useState([]);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleteBusy, setDeleteBusy] = useState(false);

    const resetForm = () =>
        setForm({
            categoryId: '',
            amount: '',
            vatAmount: '',
            date: new Date().toISOString().slice(0, 10),
            description: '',
            proofUrl: '',
        });

    const mapExpense = (e) => ({
        id: e.id,
        date: e.expenseDate?.slice(0, 10) || e.createdAt?.slice(0, 10) || '-',
        description: e.description || e.categoryName || 'Expense',
        category: e.categoryName || '-',
        categoryId: e.categoryId || '',
        amount: Number(e.amount || 0),
        vatAmount: Number(e.vatAmount || 0),
        totalAmount: Number(e.totalAmount || 0),
        proofUrl: e.proofUrl || '',
        status: e.status || 'pending',
    });

    const loadData = async () => {
        setLoading(true);
        setApiError('');
        try {
            const [expenseRes, categoriesRes, statsRes] = await Promise.all([
                listSupplierExpenses({ limit: 200, status: 'all' }),
                getSupplierExpenseCategories(),
                getSupplierExpensesStats(),
            ]);
            const expenses = Array.isArray(expenseRes?.items)
                ? expenseRes.items.map(mapExpense)
                : [];
            const cats = Array.isArray(categoriesRes?.categories) ? categoriesRes.categories : [];
            setList(expenses);
            setCategories(cats);
            if (statsRes?.stats) {
                setStats({
                    totalRecords: Number(statsRes.stats.totalRecords || 0),
                    totalExpenses: Number(statsRes.stats.totalExpenses || 0),
                    paid: Number(statsRes.stats.paid || 0),
                    pendingApproval: Number(statsRes.stats.pendingApproval || 0),
                    currencyCode: statsRes.stats.currencyCode || 'SAR',
                });
            } else {
                const total = expenses.reduce((s, x) => s + Number(x.amount || 0), 0);
                const paid = expenses
                    .filter((x) => x.status === 'paid')
                    .reduce((s, x) => s + Number(x.amount || 0), 0);
                const pending = expenses
                    .filter((x) => x.status === 'pending')
                    .reduce((s, x) => s + Number(x.amount || 0), 0);
                setStats({
                    totalRecords: expenses.length,
                    totalExpenses: total,
                    paid,
                    pendingApproval: pending,
                    currencyCode: 'SAR',
                });
            }
        } catch (err) {
            console.error('Supplier expenses API failed:', err);
            setApiError(err?.message || 'Failed to load expenses data.');
        } finally {
            setLoading(false);
        }
    };

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

    const handleSubmit = async () => {
        if (!form.amount) return;
        setSaving(true);
        setSaveError('');
        let categoryId = form.categoryId;
        if (!categoryId) {
            categoryId = await resolveCategoryId();
        }
        if (!categoryId) {
            setSaveError('Category is required.');
            setSaving(false);
            return;
        }
        const payload = {
            categoryId: String(categoryId),
            amount: Number(form.amount) || 0,
            vatAmount: Number(form.vatAmount) || 0,
            totalAmount: (Number(form.amount) || 0) + (Number(form.vatAmount) || 0),
            expenseDate: form.date,
            description: form.description || null,
            proofUrl: form.proofUrl || null,
        };
        try {
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
            setSaveError(err?.message || 'Failed to save expense.');
        } finally {
            setSaving(false);
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
            date: expense.date || new Date().toISOString().slice(0, 10),
            description: expense.description || '',
            proofUrl: expense.proofUrl || '',
        });
        setModalOpen(true);
    };

    const openDeleteModal = (expense) => {
        setApiError('');
        setDeleteTarget(expense);
    };

    const closeDeleteModal = () => {
        if (deleteBusy) return;
        setDeleteTarget(null);
    };

    const confirmDeleteExpense = async () => {
        if (!deleteTarget?.id) return;
        setDeleteBusy(true);
        setApiError('');
        try {
            await deleteSupplierExpense(deleteTarget.id);
            setDeleteTarget(null);
            await loadData();
        } catch (err) {
            console.error('Delete expense failed:', err);
            setApiError(err?.message || 'Failed to delete expense.');
        } finally {
            setDeleteBusy(false);
        }
    };

    useEffect(() => {
        loadData().catch(() => undefined);
    }, []);

    const currency = stats.currencyCode || 'SAR';

    const StatCard = ({ label, value }) => (
        <div
            className="ws-section"
            style={{ marginBottom: 0, padding: 14, borderRadius: 10 }}
        >
            <p style={{ margin: 0, fontSize: '0.6875rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</p>
            <p style={{ margin: '6px 0 0 0', fontSize: '1rem', fontWeight: 800 }}>
                {typeof value === 'number' ? `${currency} ${value.toLocaleString()}` : value}
            </p>
        </div>
    );

    const isReadOnly = editExpense && editExpense.status !== 'pending';

    const handleAdd = async () => {
        if (!form.categoryId && !form.description?.trim()) {
            setSaveError('Category is required.');
            return;
        }
            try {
            await handleSubmit();
        } catch {
            // handled in handleSubmit
        }
    };

    return (
        <div>
            <div className="ws-page-header">
                <div><h2 className="ws-page-title">Expenses ({list.length})</h2><p className="ws-page-sub">Operational expenses</p></div>
                <button className="btn-portal" style={{ background: '#2563EB', color: '#fff', border: 'none' }} onClick={openAdd}><Plus size={15}/> Add Expense</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10, marginBottom: 12 }}>
                <StatCard label="Records" value={String(stats.totalRecords || 0)} />
                <StatCard label="Total Expenses" value={stats.totalExpenses || 0} />
                <StatCard label="Paid" value={stats.paid || 0} />
                <StatCard label="Pending Approval" value={stats.pendingApproval || 0} />
            </div>
            {loading ? (
                <div className="ws-section" style={{ marginBottom: 12, padding: 16 }}>
                    <ShimmerTable rows={8} columns={6} />
                </div>
            ) : null}
            {apiError ? (
                <div className="ws-section" style={{ marginBottom: 12, padding: 12, fontSize: '0.8125rem', color: '#B91C1C', border: '1px solid #FECACA', background: '#FEF2F2' }}>
                    API error: {apiError}
                </div>
            ) : null}
            {!loading && list.length === 0 ? (
                <div className="ws-section" style={{ textAlign: 'center', padding: 48 }}>
                    <DollarSign size={48} style={{ opacity: 0.3, margin: '0 auto 16px', display: 'block' }}/>
                    <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text-muted)' }}>No expenses yet</p>
                    <button className="btn-portal" style={{ marginTop: 16, background: '#2563EB', color: '#fff', border: 'none' }} onClick={openAdd}><Plus size={15}/> Add First Expense</button>
                </div>
            ) : (
                <div className="ws-section">
                    <table className="ws-table">
                        <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead>
                        <tbody>
                            {list.map(e => (
                                <tr key={e.id}>
                                    <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{e.date}</td>
                                    <td><strong>{e.description}</strong></td>
                                    <td>{e.category}</td>
                                    <td>SAR {(e.amount || 0).toLocaleString()}</td>
                                    <td><span className={`ws-badge ${STATUS_BADGE[e.status] || STATUS_BADGE.pending}`}>{e.status}</span></td>
                                    <td>
                                        <RowActionsMenu
                                            ariaLabel={`Actions for ${e.description || 'expense'}`}
                                            items={[
                                                {
                                                    label: 'Edit',
                                                    onClick: () => openEdit(e),
                                                },
                                                {
                                                    label: 'Delete',
                                                    onClick: () => openDeleteModal(e),
                                                    disabled: e.status !== 'pending',
                                                    danger: true,
                                                    title:
                                                        e.status !== 'pending'
                                                            ? 'Only pending expenses can be deleted'
                                                            : undefined,
                                                },
                                            ]}
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
                        title={editExpense ? 'Edit Expense' : 'Add Expense'}
                        onClose={() => { setModalOpen(false); setEditExpense(null); }}
                        footer={
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                <button className="btn-portal-outline" onClick={() => setModalOpen(false)}>
                                    Cancel
                                </button>
                                <button
                                    className="btn-portal"
                                    style={{ background: '#2563EB', color: '#fff', border: 'none' }}
                                    disabled={!form.amount || saving || isReadOnly}
                                    onClick={handleAdd}
                                >
                                    {saving ? 'Saving...' : editExpense ? 'Update Expense' : 'Submit Expense'}
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
                                Only pending expenses can be updated or deleted.
                            </div>
                        ) : null}
                        <div className="ws-form-grid">
                            <div className="ws-field" style={{ gridColumn: '1 / -1' }}>
                                <label>Category *</label>
                                <select
                                    value={form.categoryId}
                                    onChange={e =>
                                        setForm(f => ({
                                            ...f,
                                            categoryId: e.target.value,
                                        }))
                                    }
                                    disabled={isReadOnly}
                                >
                                    <option value="">Select category</option>
                                    {categories.map((cat) => (
                                        <option key={cat.id} value={String(cat.id)}>
                                            {cat.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="ws-field">
                                <label>Amount (SAR) *</label>
                                <input
                                    type="number"
                                    value={form.amount}
                                    onChange={e =>
                                        setForm(f => ({
                                            ...f,
                                            amount: e.target.value,
                                        }))
                                    }
                                    disabled={isReadOnly}
                                />
                            </div>
                            <div className="ws-field">
                                <label>VAT Amount</label>
                                <input
                                    type="number"
                                    value={form.vatAmount}
                                    onChange={e =>
                                        setForm(f => ({
                                            ...f,
                                            vatAmount: e.target.value,
                                        }))
                                    }
                                    disabled={isReadOnly}
                                />
                            </div>
                            <div className="ws-field">
                                <label>Date</label>
                                <input
                                    type="date"
                                    value={form.date}
                                    onChange={e =>
                                        setForm(f => ({
                                            ...f,
                                            date: e.target.value,
                                        }))
                                    }
                                    disabled={isReadOnly}
                                />
                            </div>
                            <div className="ws-field">
                                <label>Proof URL</label>
                                <input
                                    type="url"
                                    placeholder="https://example.com/receipt.jpg"
                                    value={form.proofUrl}
                                    onChange={e =>
                                        setForm(f => ({
                                            ...f,
                                            proofUrl: e.target.value,
                                        }))
                                    }
                                    disabled={isReadOnly}
                                />
                            </div>
                            <div className="ws-field" style={{ gridColumn: '1 / -1' }}>
                                <label>Description</label>
                                <textarea
                                    rows={3}
                                    value={form.description}
                                    onChange={e =>
                                        setForm(f => ({
                                            ...f,
                                            description: e.target.value,
                                        }))
                                    }
                                    disabled={isReadOnly}
                                />
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
            <AnimatePresence>
                {deleteTarget ? (
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
                                Delete expense?
                            </span>
                        }
                        width="440px"
                        onClose={closeDeleteModal}
                        footer={
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                <button type="button" className="btn-portal-outline" disabled={deleteBusy} onClick={closeDeleteModal}>
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="btn-portal"
                                    style={{ background: '#B91C1C', color: '#fff', border: 'none' }}
                                    disabled={deleteBusy}
                                    onClick={confirmDeleteExpense}
                                >
                                    {deleteBusy ? 'Deleting…' : 'Delete expense'}
                                </button>
                            </div>
                        }
                    >
                        <p style={{ margin: '0 0 12px', fontSize: '0.875rem', lineHeight: 1.5, color: 'var(--color-text)' }}>
                            This will permanently remove this expense request. This action cannot be undone.
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
                                <strong>Description:</strong> {deleteTarget.description || '—'}
                            </div>
                            <div style={{ marginTop: 6 }}>
                                <strong>Category:</strong> {deleteTarget.category || '—'}
                            </div>
                            <div style={{ marginTop: 6 }}>
                                <strong>Date:</strong> {deleteTarget.date}
                            </div>
                            <div style={{ marginTop: 6 }}>
                                <strong>Amount:</strong> SAR {(deleteTarget.amount || 0).toLocaleString()}
                            </div>
                        </div>
                    </Modal>
                ) : null}
            </AnimatePresence>
        </div>
    );
}
