import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Wallet, Plus, MessageSquare, RefreshCw, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
    getMyPettyCash,
    getMyExpenseRequests,
    submitFundRequest,
    submitExpense,
    listExpenseCategories,
} from '../../services/employeeExpenseApi';
import { getWorkshopBranches, unwrapWorkshopBranchesResponse } from '../../services/workshopStaffApi';
import WorkshopPettyCashManagement from './WorkshopPettyCashManagement';
import { StatusBadge, MessageThread, formatSar, WalletTransactionsTable } from './WorkshopMyPettyCash.shared';
import '../../styles/admin/AccountingPage.css';

function WorkshopMyPettyCashStaff() {
    const [wallet, setWallet] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [requests, setRequests] = useState([]);
    const [categories, setCategories] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [openThread, setOpenThread] = useState(null);

    const [fundOpen, setFundOpen] = useState(false);
    const [fundAmount, setFundAmount] = useState('');
    const [fundNote, setFundNote] = useState('');
    const [fundSubmitting, setFundSubmitting] = useState(false);
    const [fundMsg, setFundMsg] = useState('');

    const [expenseOpen, setExpenseOpen] = useState(false);
    const [expCategory, setExpCategory] = useState('');
    const [expBranch, setExpBranch] = useState('');
    const [expAmount, setExpAmount] = useState('');
    const [expNote, setExpNote] = useState('');
    const [expDate, setExpDate] = useState('');
    const [expSubmitting, setExpSubmitting] = useState(false);
    const [expMsg, setExpMsg] = useState('');

    const loadAll = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [walletRes, reqRes, catRes, brRes] = await Promise.all([
                getMyPettyCash({ limit: 50 }),
                getMyExpenseRequests({ limit: 50 }),
                listExpenseCategories(),
                getWorkshopBranches().catch(() => ({ branches: [] })),
            ]);
            setWallet(walletRes?.wallet ?? null);
            setTransactions(walletRes?.transactions ?? []);
            setRequests(reqRes?.items ?? []);
            setCategories(catRes?.categories ?? []);
            setBranches(unwrapWorkshopBranchesResponse(brRes));
        } catch (e) {
            setError(e?.message || 'Could not load petty cash data.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadAll(); }, [loadAll]);

    const handleSubmitFund = async () => {
        setFundMsg('');
        const amt = Number(fundAmount);
        if (!Number.isFinite(amt) || amt <= 0) {
            setFundMsg('Enter a valid amount.');
            return;
        }
        setFundSubmitting(true);
        try {
            await submitFundRequest({ amount: amt, description: fundNote.trim() || undefined });
            setFundOpen(false);
            setFundAmount('');
            setFundNote('');
            await loadAll();
        } catch (e) {
            setFundMsg(e?.message || 'Submit failed.');
        } finally {
            setFundSubmitting(false);
        }
    };

    const handleSubmitExpense = async () => {
        setExpMsg('');
        const amt = Number(expAmount);
        if (!Number.isFinite(amt) || amt <= 0) {
            setExpMsg('Enter a valid amount.');
            return;
        }
        if (!expCategory) {
            setExpMsg('Select an expense category.');
            return;
        }
        if (!expBranch) {
            setExpMsg('Select a branch.');
            return;
        }
        setExpSubmitting(true);
        try {
            await submitExpense({
                categoryId: expCategory,
                amount: amt,
                branchId: expBranch,
                description: expNote.trim() || undefined,
                expenseDate: expDate || undefined,
            });
            setExpenseOpen(false);
            setExpCategory('');
            setExpBranch('');
            setExpAmount('');
            setExpNote('');
            setExpDate('');
            await loadAll();
        } catch (e) {
            setExpMsg(e?.message || 'Submit failed.');
        } finally {
            setExpSubmitting(false);
        }
    };

    const summary = useMemo(() => {
        const pendingTotal = requests.filter((r) => r.status === 'pending')
            .reduce((s, r) => s + Number(r.amount || 0), 0);
        return {
            pendingTotal,
            pendingCount: requests.filter((r) => r.status === 'pending').length,
        };
    }, [requests]);

    return (
        <div className="accounting-page module-container">
            <header className="cash-bank-header">
                <h2 className="cash-bank-title">My Petty Cash</h2>
                <p className="cash-bank-desc">
                    View your petty-cash wallet balance, request a fund top-up, and submit expenses for approval.
                </p>
            </header>

            {error ? (
                <p className="form-help-text" style={{ color: '#B45309', marginBottom: 12 }}>{error}</p>
            ) : null}

            <div className="cash-bank-stats">
                <div className="cash-bank-stat-card">
                    <div className="cash-bank-stat-icon"><Wallet size={24} /></div>
                    <div>
                        <p className="cash-bank-stat-label">Wallet Balance</p>
                        <p className="cash-bank-stat-value">SAR {formatSar(wallet?.currentBalance ?? 0)}</p>
                        <p className="cash-bank-stat-meta">{wallet?.coaAccount?.code ?? '—'} · {wallet?.name ?? 'Petty Cash Wallet'}</p>
                    </div>
                </div>
                <div className="cash-bank-stat-card">
                    <div className="cash-bank-stat-icon"><Clock size={24} /></div>
                    <div>
                        <p className="cash-bank-stat-label">Pending Requests</p>
                        <p className="cash-bank-stat-value">SAR {formatSar(summary.pendingTotal)}</p>
                        <p className="cash-bank-stat-meta">{summary.pendingCount} awaiting approval</p>
                    </div>
                </div>
            </div>

            <div className="cash-bank-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                <button type="button" className="btn-portal" onClick={() => setFundOpen(true)}>
                    <Plus size={16} /> Request Fund Top-Up
                </button>
                <button type="button" className="btn-portal" onClick={() => setExpenseOpen(true)}>
                    <Plus size={16} /> Submit Expense
                </button>
                <button
                    type="button"
                    className="btn-portal-outline"
                    onClick={loadAll}
                    disabled={loading}
                >
                    <RefreshCw size={16} style={{ marginRight: 6 }} /> Refresh
                </button>
            </div>

            {fundOpen ? (
                <section style={{ padding: 18, background: '#fafafa', borderRadius: 12, marginBottom: 16, border: '1px solid #E2E8F0' }}>
                    <h3 style={{ margin: '0 0 12px' }}>Request Fund Top-Up</h3>
                    {fundMsg ? <p className="form-help-text" style={{ color: '#B45309' }}>{fundMsg}</p> : null}
                    <div className="modal-form-grid">
                        <div className="form-group">
                            <label className="form-label">Amount (SAR) *</label>
                            <input type="number" min="0" step="0.01" className="form-input-field" value={fundAmount} onChange={(e) => setFundAmount(e.target.value)} />
                        </div>
                        <div className="form-group form-group-full">
                            <label className="form-label">Reason / Note</label>
                            <input type="text" className="form-input-field" value={fundNote} onChange={(e) => setFundNote(e.target.value)} />
                        </div>
                        <div className="form-group form-group-full" style={{ display: 'flex', gap: 8 }}>
                            <button type="button" className="btn-portal" disabled={fundSubmitting} onClick={handleSubmitFund}>
                                {fundSubmitting ? 'Submitting…' : 'Submit Request'}
                            </button>
                            <button type="button" className="btn-portal-outline" onClick={() => setFundOpen(false)}>Cancel</button>
                        </div>
                    </div>
                </section>
            ) : null}

            {expenseOpen ? (
                <section style={{ padding: 18, background: '#fafafa', borderRadius: 12, marginBottom: 16, border: '1px solid #E2E8F0' }}>
                    <h3 style={{ margin: '0 0 12px' }}>Submit Expense</h3>
                    {expMsg ? <p className="form-help-text" style={{ color: '#B45309' }}>{expMsg}</p> : null}
                    <div className="modal-form-grid">
                        <div className="form-group">
                            <label className="form-label">Expense category *</label>
                            <select className="form-input-field" value={expCategory} onChange={(e) => setExpCategory(e.target.value)}>
                                <option value="">Select category</option>
                                {categories.map((c) => (
                                    <option key={c.id} value={c.id}>{c.code} · {c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Branch *</label>
                            <select className="form-input-field" value={expBranch} onChange={(e) => setExpBranch(e.target.value)}>
                                <option value="">Select branch</option>
                                {branches.map((b) => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Amount (SAR) *</label>
                            <input type="number" min="0" step="0.01" className="form-input-field" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Expense date</label>
                            <input type="date" className="form-input-field" value={expDate} onChange={(e) => setExpDate(e.target.value)} />
                        </div>
                        <div className="form-group form-group-full">
                            <label className="form-label">Description</label>
                            <input type="text" className="form-input-field" value={expNote} onChange={(e) => setExpNote(e.target.value)} />
                        </div>
                        <div className="form-group form-group-full" style={{ display: 'flex', gap: 8 }}>
                            <button type="button" className="btn-portal" disabled={expSubmitting} onClick={handleSubmitExpense}>
                                {expSubmitting ? 'Submitting…' : 'Submit Expense'}
                            </button>
                            <button type="button" className="btn-portal-outline" onClick={() => setExpenseOpen(false)}>Cancel</button>
                        </div>
                    </div>
                </section>
            ) : null}

            {openThread ? (
                <MessageThread requestId={openThread} onClose={() => setOpenThread(null)} />
            ) : null}

            <section className="premium-table cash-bank-table">
                <header style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0' }}>
                    <strong>My Requests</strong>
                </header>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">Date</th>
                            <th className="table-th">Type</th>
                            <th className="table-th">Category</th>
                            <th className="table-th">Branch</th>
                            <th className="table-th">Amount</th>
                            <th className="table-th">Status</th>
                            <th className="table-th">Notes</th>
                            <th className="table-th">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={8} className="table-cell table-empty">Loading…</td></tr>
                        ) : requests.length === 0 ? (
                            <tr><td colSpan={8} className="table-cell table-empty">No requests yet.</td></tr>
                        ) : requests.map((r) => (
                            <tr key={r.id}>
                                <td className="table-cell">{new Date(r.createdAt).toLocaleDateString()}</td>
                                <td className="table-cell">{r.kind === 'fund_request' ? 'Fund top-up' : 'Expense'}</td>
                                <td className="table-cell">{r.category?.name ?? '—'}</td>
                                <td className="table-cell">{r.branch?.name ?? '—'}</td>
                                <td className="table-cell">SAR {formatSar(r.amount)}</td>
                                <td className="table-cell"><StatusBadge status={r.status} /></td>
                                <td className="table-cell" style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {r.rejectionReason || r.description || '—'}
                                </td>
                                <td className="table-cell">
                                    <button type="button" className="btn-edit-zone" onClick={() => setOpenThread(r.id)}>
                                        <MessageSquare size={14} /> {r.messageCount > 0 ? `(${r.messageCount})` : ''}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>

            <section className="premium-table cash-bank-table" style={{ marginTop: 16 }}>
                <header style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0' }}>
                    <strong>Wallet Transactions</strong>
                </header>
                <WalletTransactionsTable transactions={transactions} loading={loading} />
            </section>
        </div>
    );
}

export default function WorkshopMyPettyCash({ selectedBranchId = 'all' }) {
    const { user, hasPermission } = useAuth();
    // Show the full management UI for anyone who can "view" petty cash —
    // workshop owners (legacy bypass), roleless workshop users (legacy bypass),
    // and custom-role users who were explicitly granted
    // `workshop.my-petty-cash.view`. Falls back to the personal staff view
    // only for users without the permission (which today is unreachable
    // anyway, because the sidebar item is gated by the same code).
    if (user?.userType === 'workshop_owner' || hasPermission('workshop.my-petty-cash.view')) {
        return <WorkshopPettyCashManagement selectedBranchId={selectedBranchId} />;
    }
    return <WorkshopMyPettyCashStaff />;
}
