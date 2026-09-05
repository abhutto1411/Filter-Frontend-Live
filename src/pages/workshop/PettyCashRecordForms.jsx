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
import { wpcT } from '../../utils/workshopPettyCashI18n';

function resolveInitialWorkshopId({ workshopIdProp, user, workshop }) {
    return String(workshopIdProp || user?.workshopId || workshop?.id || '');
}

export default function PettyCashRecordForms({
    workshopId: workshopIdProp = null,
    defaultBranchId = '',
    onSubmitted,
    compact = false,
    locale: localeProp,
}) {
    const locale = localeProp || (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) || 'en';
    const t = useCallback((key, vars) => wpcT(locale, key, vars), [locale]);
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
        return workshop?.name || user?.workshopName || t('workshop.current');
    }, [isPlatformAdmin, workshops, selectedWorkshopId, workshop, user, t]);

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
            setFundMsg(t('err.selectWorkshop'));
            return;
        }
        const amt = Number(fundAmount);
        if (!Number.isFinite(amt) || amt <= 0) {
            setFundMsg(t('err.validAmount'));
            return;
        }
        if (!fundBranch) {
            setFundMsg(t('err.selectBranch'));
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
            setFundMsg(e?.message || t('err.submitFailed'));
        } finally {
            setFundSubmitting(false);
        }
    };

    const handleSubmitExpense = async () => {
        setExpMsg('');
        if (!selectedWorkshopId) {
            setExpMsg(t('err.selectWorkshop'));
            return;
        }
        const amt = Number(expAmount);
        if (!Number.isFinite(amt) || amt <= 0) {
            setExpMsg(t('err.validAmount'));
            return;
        }
        if (!expCategory) {
            setExpMsg(t('err.selectCategory'));
            return;
        }
        if (!expBranch) {
            setExpMsg(t('err.selectBranch'));
            return;
        }
        if (!expProofPreview) {
            setExpMsg(t('err.proofRequired'));
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
            setExpMsg(e?.message || t('err.submitFailed'));
        } finally {
            setExpSubmitting(false);
        }
    };

    const workshopField = isPlatformAdmin && workshops.length > 0 ? (
        <div className="form-group form-group-full">
            <label className="form-label">{t('form.workshopRequired')}</label>
            <select
                className="form-input-field"
                value={selectedWorkshopId}
                onChange={(e) => handleWorkshopChange(e.target.value)}
            >
                <option value="">{t('form.selectWorkshop')}</option>
                {workshops.map((w) => (
                    <option key={w.id} value={w.id}>{w.name || w.label || `#${w.id}`}</option>
                ))}
            </select>
        </div>
    ) : (
        <div className="form-group form-group-full">
            <label className="form-label">{t('form.workshop')}</label>
            <input type="text" className="form-input-field" value={workshopLabel} readOnly disabled />
        </div>
    );

    return (
        <section style={{ marginBottom: compact ? 12 : 16 }}>
            {!compact ? (
                <p className="cash-bank-desc" style={{ marginBottom: 12 }}>
                    {t('forms.glHint')}
                </p>
            ) : null}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <button type="button" className="btn-portal" onClick={() => setFundOpen((v) => !v)}>
                    <Plus size={16} /> {t('btn.requestFund')}
                </button>
                <button type="button" className="btn-portal" onClick={() => setExpenseOpen((v) => !v)}>
                    <Plus size={16} /> {t('btn.submitExpense')}
                </button>
            </div>

            {fundOpen ? (
                <section style={{ padding: 18, background: '#fafafa', borderRadius: 12, marginBottom: 12, border: '1px solid #E2E8F0' }}>
                    <h3 style={{ margin: '0 0 12px' }}>{t('form.requestFundTitle')}</h3>
                    {fundMsg ? <p className="form-help-text" style={{ color: '#B45309' }}>{fundMsg}</p> : null}
                    <div className="modal-form-grid">
                        {workshopField}
                        <div className="form-group">
                            <label className="form-label">{t('form.branchRequired')}</label>
                            <select className="form-input-field" value={fundBranch} onChange={(e) => setFundBranch(e.target.value)}>
                                <option value="">{t('form.selectBranch')}</option>
                                {branches.map((b) => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('form.amountSar')}</label>
                            <input type="number" min="0" step="0.01" className="form-input-field" value={fundAmount} onChange={(e) => setFundAmount(e.target.value)} />
                        </div>
                        <div className="form-group form-group-full">
                            <label className="form-label">{t('form.reasonNote')}</label>
                            <input type="text" className="form-input-field" value={fundNote} onChange={(e) => setFundNote(e.target.value)} />
                        </div>
                        <div className="form-group form-group-full" style={{ display: 'flex', gap: 8 }}>
                            <button type="button" className="btn-portal" disabled={fundSubmitting} onClick={handleSubmitFund}>
                                {fundSubmitting ? t('btn.submitting') : t('btn.submitRequest')}
                            </button>
                            <button type="button" className="btn-portal-outline" onClick={() => setFundOpen(false)}>{t('btn.cancel')}</button>
                        </div>
                    </div>
                </section>
            ) : null}

            {expenseOpen ? (
                <section style={{ padding: 18, background: '#fafafa', borderRadius: 12, marginBottom: 12, border: '1px solid #E2E8F0' }}>
                    <h3 style={{ margin: '0 0 12px' }}>{t('form.submitExpenseTitle')}</h3>
                    {expMsg ? <p className="form-help-text" style={{ color: '#B45309' }}>{expMsg}</p> : null}
                    <div className="modal-form-grid">
                        {workshopField}
                        <div className="form-group">
                            <label className="form-label">{t('form.branchRequired')}</label>
                            <select className="form-input-field" value={expBranch} onChange={(e) => setExpBranch(e.target.value)}>
                                <option value="">{t('form.selectBranch')}</option>
                                {branches.map((b) => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('form.expenseCategory')}</label>
                            <select className="form-input-field" value={expCategory} onChange={(e) => setExpCategory(e.target.value)}>
                                <option value="">{t('form.selectCategory')}</option>
                                {categories.map((c) => (
                                    <option key={c.id} value={c.id}>{t('form.categoryOption', { code: c.code, name: c.name })}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('form.amountSar')}</label>
                            <input type="number" min="0" step="0.01" className="form-input-field" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('form.expenseDate')}</label>
                            <input type="date" className="form-input-field" value={expDate} onChange={(e) => setExpDate(e.target.value)} />
                        </div>
                        <div className="form-group form-group-full">
                            <label className="form-label">{t('form.description')}</label>
                            <input type="text" className="form-input-field" value={expNote} onChange={(e) => setExpNote(e.target.value)} />
                        </div>
                        <ExpenseProofPicker
                            id="petty-cash-record-expense-proof"
                            preview={expProofPreview}
                            onChange={setExpProofPreview}
                            disabled={expSubmitting}
                            label={t('form.expenseProof')}
                        />
                        <div className="form-group form-group-full" style={{ display: 'flex', gap: 8 }}>
                            <button type="button" className="btn-portal" disabled={expSubmitting} onClick={handleSubmitExpense}>
                                {expSubmitting ? t('btn.submitting') : t('btn.submitExpense')}
                            </button>
                            <button type="button" className="btn-portal-outline" onClick={() => setExpenseOpen(false)}>{t('btn.cancel')}</button>
                        </div>
                    </div>
                </section>
            ) : null}
        </section>
    );
}
