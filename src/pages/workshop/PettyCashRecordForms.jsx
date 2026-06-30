import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
    listExpenseCategories,
    listExpenseWorkshopBranches,
    submitExpense,
    submitFundRequest,
} from '../../services/employeeExpenseApi';
import { getWorkshopOptions } from '../../services/superAdminApi';
import ExpenseProofPicker from '../../components/accounting/ExpenseProofPicker';

function resolveInitialWorkshopId({ workshopIdProp, user, workshop }) {
    return String(workshopIdProp || user?.workshopId || workshop?.id || '');
}

export default function PettyCashRecordForms({
    workshopId: workshopIdProp = null,
    defaultBranchId = '',
    onSubmitted,
    compact = false,
}) {
    const { user, workshop } = useAuth();
    const isPlatformAdmin = user?.userType === 'platform_admin';

    const [workshops, setWorkshops] = useState([]);
    const [selectedWorkshopId, setSelectedWorkshopId] = useState(() =>
        resolveInitialWorkshopId({ workshopIdProp, user, workshop }),
    );
    const [branches, setBranches] = useState([]);
    const [categories, setCategories] = useState([]);

    const [fundOpen, setFundOpen] = useState(false);
    const [fundAmount, setFundAmount] = useState('');
    const [fundBranch, setFundBranch] = useState('');
    const [fundNote, setFundNote] = useState('');
    const [fundSubmitting, setFundSubmitting] = useState(false);
    const [fundMsg, setFundMsg] = useState('');

    const [expenseOpen, setExpenseOpen] = useState(false);
    const [expCategory, setExpCategory] = useState('');
    const [expBranch, setExpBranch] = useState('');
    const [expAmount, setExpAmount] = useState('');
    const [expNote, setExpNote] = useState('');
    const [expDate, setExpDate] = useState('');
    const [expProofPreview, setExpProofPreview] = useState(null);
    const [expSubmitting, setExpSubmitting] = useState(false);
    const [expMsg, setExpMsg] = useState('');

    const scopeQuery = useMemo(() => {
        const wid = selectedWorkshopId || resolveInitialWorkshopId({ workshopIdProp, user, workshop });
        return wid ? { workshopId: String(wid) } : {};
    }, [selectedWorkshopId, workshopIdProp, user, workshop]);

    const workshopLabel = useMemo(() => {
        if (isPlatformAdmin && workshops.length) {
            const match = workshops.find((w) => String(w.id) === String(selectedWorkshopId));
            if (match) return match.name || match.label || `#${match.id}`;
        }
        return workshop?.name || user?.workshopName || 'Current workshop';
    }, [isPlatformAdmin, workshops, selectedWorkshopId, workshop, user]);

    const defaultPettyCashExpenseId = useMemo(() => {
        const match = categories.find(
            (c) => c.code === '6100' || /employee petty cash expense/i.test(c.name || ''),
        );
        return match?.id ? String(match.id) : '';
    }, [categories]);

    const reloadScopeData = useCallback(async () => {
        if (!scopeQuery.workshopId) {
            setBranches([]);
            setCategories([]);
            return;
        }
        try {
            const [brRes, catRes] = await Promise.all([
                listExpenseWorkshopBranches(scopeQuery),
                listExpenseCategories(scopeQuery),
            ]);
            setBranches(brRes?.branches ?? []);
            if (brRes?.workshopId) {
                setSelectedWorkshopId(String(brRes.workshopId));
            }
            setCategories(catRes?.categories ?? []);
        } catch {
            setBranches([]);
            setCategories([]);
        }
    }, [scopeQuery]);

    useEffect(() => {
        if (!isPlatformAdmin) return;
        getWorkshopOptions()
            .then((res) => {
                const rows = res?.workshops ?? res?.items ?? res?.data ?? [];
                setWorkshops(Array.isArray(rows) ? rows : []);
            })
            .catch(() => setWorkshops([]));
    }, [isPlatformAdmin]);

    useEffect(() => {
        void reloadScopeData();
    }, [reloadScopeData]);

    useEffect(() => {
        if (!branches.length) return;
        const preferred =
            (defaultBranchId && defaultBranchId !== 'all' ? String(defaultBranchId) : '')
            || (user?.branchId ? String(user.branchId) : '')
            || String(branches[0]?.id || '');
        if (preferred && !fundBranch) setFundBranch(preferred);
        if (preferred && !expBranch) setExpBranch(preferred);
    }, [branches, defaultBranchId, user?.branchId, fundBranch, expBranch]);

    useEffect(() => {
        if (defaultPettyCashExpenseId && !expCategory) {
            setExpCategory(defaultPettyCashExpenseId);
        }
    }, [defaultPettyCashExpenseId, expCategory]);

    const handleWorkshopChange = (nextId) => {
        setSelectedWorkshopId(nextId);
        setFundBranch('');
        setExpBranch('');
        setFundOpen(false);
        setExpenseOpen(false);
    };

    const handleSubmitFund = async () => {
        setFundMsg('');
        if (!selectedWorkshopId) {
            setFundMsg('Select a workshop.');
            return;
        }
        const amt = Number(fundAmount);
        if (!Number.isFinite(amt) || amt <= 0) {
            setFundMsg('Enter a valid amount.');
            return;
        }
        if (!fundBranch) {
            setFundMsg('Select a branch.');
            return;
        }
        setFundSubmitting(true);
        try {
            await submitFundRequest(
                {
                    amount: amt,
                    branchId: fundBranch,
                    workshopId: selectedWorkshopId,
                    description: fundNote.trim() || undefined,
                },
                scopeQuery,
            );
            setFundOpen(false);
            setFundAmount('');
            setFundNote('');
            onSubmitted?.();
        } catch (e) {
            setFundMsg(e?.message || 'Submit failed.');
        } finally {
            setFundSubmitting(false);
        }
    };

    const handleSubmitExpense = async () => {
        setExpMsg('');
        if (!selectedWorkshopId) {
            setExpMsg('Select a workshop.');
            return;
        }
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
        if (!expProofPreview) {
            setExpMsg('Expense proof image is required.');
            return;
        }
        setExpSubmitting(true);
        try {
            await submitExpense(
                {
                    categoryId: expCategory,
                    amount: amt,
                    branchId: expBranch,
                    workshopId: selectedWorkshopId,
                    description: expNote.trim() || undefined,
                    expenseDate: expDate || undefined,
                    proofUrl: expProofPreview,
                },
                scopeQuery,
            );
            setExpenseOpen(false);
            setExpCategory(defaultPettyCashExpenseId);
            setExpAmount('');
            setExpNote('');
            setExpDate('');
            setExpProofPreview(null);
            onSubmitted?.();
        } catch (e) {
            setExpMsg(e?.message || 'Submit failed.');
        } finally {
            setExpSubmitting(false);
        }
    };

    const workshopField = isPlatformAdmin && workshops.length > 0 ? (
        <div className="form-group form-group-full">
            <label className="form-label">Workshop *</label>
            <select
                className="form-input-field"
                value={selectedWorkshopId}
                onChange={(e) => handleWorkshopChange(e.target.value)}
            >
                <option value="">Select workshop</option>
                {workshops.map((w) => (
                    <option key={w.id} value={w.id}>{w.name || w.label || `#${w.id}`}</option>
                ))}
            </select>
        </div>
    ) : (
        <div className="form-group form-group-full">
            <label className="form-label">Workshop</label>
            <input type="text" className="form-input-field" value={workshopLabel} readOnly disabled />
        </div>
    );

    return (
        <section style={{ marginBottom: compact ? 12 : 16 }}>
            {!compact ? (
                <p className="cash-bank-desc" style={{ marginBottom: 12 }}>
                    Fund top-ups post <strong>DR [1280] Employee Petty Cash Fund</strong> (branch account);
                    expenses post <strong>DR [6100] Employee Petty Cash Expense</strong> and{' '}
                    <strong>CR [1280]</strong> for the selected workshop and branch.
                </p>
            ) : null}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <button type="button" className="btn-portal" onClick={() => setFundOpen((v) => !v)}>
                    <Plus size={16} /> Request Fund Top-Up
                </button>
                <button type="button" className="btn-portal" onClick={() => setExpenseOpen((v) => !v)}>
                    <Plus size={16} /> Submit Expense
                </button>
            </div>

            {fundOpen ? (
                <section style={{ padding: 18, background: '#fafafa', borderRadius: 12, marginBottom: 12, border: '1px solid #E2E8F0' }}>
                    <h3 style={{ margin: '0 0 12px' }}>Request Fund Top-Up</h3>
                    {fundMsg ? <p className="form-help-text" style={{ color: '#B45309' }}>{fundMsg}</p> : null}
                    <div className="modal-form-grid">
                        {workshopField}
                        <div className="form-group">
                            <label className="form-label">Branch *</label>
                            <select className="form-input-field" value={fundBranch} onChange={(e) => setFundBranch(e.target.value)}>
                                <option value="">Select branch</option>
                                {branches.map((b) => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>
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
                <section style={{ padding: 18, background: '#fafafa', borderRadius: 12, marginBottom: 12, border: '1px solid #E2E8F0' }}>
                    <h3 style={{ margin: '0 0 12px' }}>Submit Expense</h3>
                    {expMsg ? <p className="form-help-text" style={{ color: '#B45309' }}>{expMsg}</p> : null}
                    <div className="modal-form-grid">
                        {workshopField}
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
                            <label className="form-label">Expense category *</label>
                            <select className="form-input-field" value={expCategory} onChange={(e) => setExpCategory(e.target.value)}>
                                <option value="">Select category</option>
                                {categories.map((c) => (
                                    <option key={c.id} value={c.id}>{c.code} · {c.name}</option>
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
                        <ExpenseProofPicker
                            id="petty-cash-record-expense-proof"
                            preview={expProofPreview}
                            onChange={setExpProofPreview}
                            disabled={expSubmitting}
                        />
                        <div className="form-group form-group-full" style={{ display: 'flex', gap: 8 }}>
                            <button type="button" className="btn-portal" disabled={expSubmitting} onClick={handleSubmitExpense}>
                                {expSubmitting ? 'Submitting…' : 'Submit Expense'}
                            </button>
                            <button type="button" className="btn-portal-outline" onClick={() => setExpenseOpen(false)}>Cancel</button>
                        </div>
                    </div>
                </section>
            ) : null}
        </section>
    );
}
