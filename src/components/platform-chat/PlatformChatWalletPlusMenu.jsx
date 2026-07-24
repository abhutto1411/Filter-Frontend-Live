import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Plus, Banknote, History, Receipt } from 'lucide-react';
import Modal from '../Modal';
import SearchableEntityCombobox from '../SearchableEntityCombobox';
import ExpenseProofPicker from '../accounting/ExpenseProofPicker';
import { listMyWalletBranches, listMyWalletWorkshops, myWalletApiForUser } from '../../services/adminWalletApi';
import { useAuth } from '../../context/AuthContext';
import { adminWalletExpenseComboboxOptions } from '../../constants/adminWalletExpenseCategories';
import { formatSar } from './PlatformChatWalletMessage';
import '../../styles/admin/PlatformChatWallet.css';

function workshopIsPlatformHq(workshops, workshopId) {
    if (!workshopId) return false;
    const w = workshops.find((x) => String(x.id) === String(workshopId));
    return Boolean(w?.isPlatformHq ?? w?.is_platform_hq);
}

export default function PlatformChatWalletPlusMenu({
    api,
    conversationId,
    showRequestFunds,
    showRecordExpense,
    showTransactionHistory,
    disabled,
    onMessageSent,
    onError,
    walletApi: walletApiProp,
    skipWorkshopFields = false,
    expenseCategoryOptions: expenseCategoryOptionsProp,
}) {
    const { user } = useAuth();
    const walletApi = walletApiProp ?? myWalletApiForUser(user);
    const [menuOpen, setMenuOpen] = useState(false);
    const [fundOpen, setFundOpen] = useState(false);
    const [expenseOpen, setExpenseOpen] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [busy, setBusy] = useState(false);

    const [fundAmount, setFundAmount] = useState('');
    const [fundPurpose, setFundPurpose] = useState('');
    const [fundWorkshopId, setFundWorkshopId] = useState('');
    const [fundBranchId, setFundBranchId] = useState('');
    const [fundBranches, setFundBranches] = useState([]);

    const [expenseAmount, setExpenseAmount] = useState('');
    const [expenseCategory, setExpenseCategory] = useState('');
    const [expenseCategorySearch, setExpenseCategorySearch] = useState('');
    const [expenseDescription, setExpenseDescription] = useState('');
    const [expenseVendor, setExpenseVendor] = useState('');
    const [expenseProofPreview, setExpenseProofPreview] = useState(null);
    const [expenseWorkshopId, setExpenseWorkshopId] = useState('');
    const [expenseBranchId, setExpenseBranchId] = useState('');
    const [expenseBranches, setExpenseBranches] = useState([]);

    const [workshopOptions, setWorkshopOptions] = useState([]);
    const [workshopsLoading, setWorkshopsLoading] = useState(false);
    const [fundBranchesLoading, setFundBranchesLoading] = useState(false);
    const [expenseBranchesLoading, setExpenseBranchesLoading] = useState(false);

    const expenseCategoryOptions = useMemo(
        () => expenseCategoryOptionsProp ?? adminWalletExpenseComboboxOptions(),
        [expenseCategoryOptionsProp],
    );

    const [historyRows, setHistoryRows] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyDateFrom, setHistoryDateFrom] = useState('');
    const [historyDateTo, setHistoryDateTo] = useState('');

    const [fundModalError, setFundModalError] = useState('');
    const [expenseModalError, setExpenseModalError] = useState('');

    const menuRef = useRef(null);

    const hasAnyOption = showRequestFunds || showRecordExpense || showTransactionHistory;
    if (!hasAnyOption || !conversationId) return null;

    const loadWorkshops = useCallback(async () => {
        setWorkshopsLoading(true);
        try {
            const res = await walletApi.listMyWalletWorkshops();
            const rows = res?.workshops ?? res?.data?.workshops ?? [];
            setWorkshopOptions(Array.isArray(rows) ? rows : []);
        } catch {
            setWorkshopOptions([]);
        } finally {
            setWorkshopsLoading(false);
        }
    }, [walletApi]);

    useEffect(() => {
        if (!menuOpen) return undefined;
        const onDoc = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [menuOpen]);

    useEffect(() => {
        if (!menuOpen && !fundOpen && !expenseOpen) return;
        loadWorkshops();
    }, [menuOpen, fundOpen, expenseOpen, loadWorkshops]);

    useEffect(() => {
        if (workshopOptions.length === 1) {
            const onlyId = String(workshopOptions[0].id);
            if (fundOpen && !fundWorkshopId) setFundWorkshopId(onlyId);
            if (expenseOpen && !expenseWorkshopId) setExpenseWorkshopId(onlyId);
        }
    }, [workshopOptions, fundOpen, expenseOpen, fundWorkshopId, expenseWorkshopId]);

    useEffect(() => {
        if (!fundOpen) {
            setFundModalError('');
            return;
        }
        setFundModalError('');
    }, [fundOpen]);

    useEffect(() => {
        if (!expenseOpen) {
            setExpenseModalError('');
        }
    }, [expenseOpen]);

    useEffect(() => {
        if (!fundWorkshopId || workshopIsPlatformHq(workshopOptions, fundWorkshopId)) {
            setFundBranches([]);
            setFundBranchId('');
            return;
        }
        setFundBranchesLoading(true);
        walletApi.listMyWalletBranches({ workshopId: fundWorkshopId })
            .then((res) => setFundBranches(res?.branches ?? []))
            .catch(() => setFundBranches([]))
            .finally(() => setFundBranchesLoading(false));
    }, [fundWorkshopId, walletApi, workshopOptions]);

    useEffect(() => {
        if (!expenseWorkshopId || workshopIsPlatformHq(workshopOptions, expenseWorkshopId)) {
            setExpenseBranches([]);
            setExpenseBranchId('');
            return;
        }
        setExpenseBranchesLoading(true);
        walletApi.listMyWalletBranches({ workshopId: expenseWorkshopId })
            .then((res) => setExpenseBranches(res?.branches ?? []))
            .catch(() => setExpenseBranches([]))
            .finally(() => setExpenseBranchesLoading(false));
    }, [expenseWorkshopId, walletApi, workshopOptions]);

    const loadHistory = async (range = {}) => {
        setHistoryLoading(true);
        try {
            const params = {};
            const from = range.from ?? historyDateFrom;
            const to = range.to ?? historyDateTo;
            if (from) params.from = from;
            if (to) params.to = to;
            const res = await api.getWalletHistory(conversationId, params);
            setHistoryRows(Array.isArray(res?.rows) ? res.rows : []);
        } catch (err) {
            onError?.(err?.message || 'Failed to load wallet history');
            setHistoryRows([]);
        } finally {
            setHistoryLoading(false);
        }
    };

    const formatHistoryDate = (value) => {
        if (!value) return '—';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '—';
        return d.toLocaleString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const openHistory = () => {
        setMenuOpen(false);
        setHistoryOpen(true);
        loadHistory();
    };

    const fundIsHq = workshopIsPlatformHq(workshopOptions, fundWorkshopId);
    const expenseIsHq = workshopIsPlatformHq(workshopOptions, expenseWorkshopId);

    const submitFundRequest = async (e) => {
        e.preventDefault();
        const amount = Number(fundAmount);
        const purpose = fundPurpose.trim();
        if (!Number.isFinite(amount) || amount <= 0 || !purpose) return;
        if (!skipWorkshopFields && !fundWorkshopId) {
            setFundModalError('Select a workshop.');
            return;
        }
        if (!skipWorkshopFields && !fundIsHq && !fundBranchId) {
            setFundModalError('Select a branch.');
            return;
        }
        setFundModalError('');
        setBusy(true);
        try {
            const payload = {
                amount,
                purpose,
                workshopId: skipWorkshopFields ? '' : fundWorkshopId,
            };
            if (!skipWorkshopFields && !fundIsHq) payload.branchId = fundBranchId;
            const res = await api.sendWalletFundRequest(conversationId, payload);
            const msg = res?.message ?? res?.data?.message;
            if (msg) onMessageSent?.(msg);
            setFundOpen(false);
            setFundAmount('');
            setFundPurpose('');
            setFundWorkshopId('');
            setFundBranchId('');
            setMenuOpen(false);
        } catch (err) {
            const message = err?.message || 'Could not send fund request';
            setFundModalError(message);
            onError?.(message);
        } finally {
            setBusy(false);
        }
    };

    const submitExpense = async (e) => {
        e.preventDefault();
        const amount = Number(expenseAmount);
        const description = expenseDescription.trim();
        if (!Number.isFinite(amount) || amount <= 0 || !description) return;
        if (!expenseCategory) {
            setExpenseModalError('Select an account category.');
            return;
        }
        if (!expenseProofPreview) {
            setExpenseModalError('Expense proof image is required.');
            return;
        }
        if (!skipWorkshopFields && !expenseWorkshopId) {
            setExpenseModalError('Select a workshop.');
            return;
        }
        if (!skipWorkshopFields && !expenseIsHq && !expenseBranchId) {
            setExpenseModalError('Select a branch.');
            return;
        }
        setExpenseModalError('');
        setBusy(true);
        try {
            const payload = {
                amount,
                description,
                vendorName: expenseVendor.trim() || undefined,
                expenseCategory,
                proofUrl: expenseProofPreview,
                workshopId: skipWorkshopFields ? '' : expenseWorkshopId,
            };
            if (!skipWorkshopFields && !expenseIsHq) payload.branchId = expenseBranchId;
            const res = await api.recordWalletExpense(conversationId, payload);
            const msg = res?.message ?? res?.data?.message;
            if (msg) onMessageSent?.(msg);
            setExpenseOpen(false);
            setExpenseAmount('');
            setExpenseCategory('');
            setExpenseCategorySearch('');
            setExpenseDescription('');
            setExpenseVendor('');
            setExpenseProofPreview(null);
            setExpenseWorkshopId('');
            setExpenseBranchId('');
            setMenuOpen(false);
        } catch (err) {
            const message = err?.message || 'Could not record expense';
            setExpenseModalError(message);
            onError?.(message);
        } finally {
            setBusy(false);
        }
    };

    const sendTxReference = async (row) => {
        setBusy(true);
        try {
            const res = await api.sendWalletTxReference(conversationId, {
                rowType: row.rowType,
                rowId: row.rowId,
                reference: row.reference,
                amount: row.amount,
                description: row.description,
                status: row.status,
                date: row.date,
            });
            const msg = res?.message ?? res?.data?.message;
            if (msg) onMessageSent?.(msg);
            setHistoryOpen(false);
        } catch (err) {
            onError?.(err?.message || 'Could not send reference');
        } finally {
            setBusy(false);
        }
    };

    const workshopSelect = (id, value, onChange, onBranchReset) => (
        <>
            <label className="pc-wallet-field-label">Workshop *</label>
            <select
                className="pc-wallet-field"
                value={value}
                onChange={(e) => {
                    onChange(e.target.value);
                    onBranchReset('');
                }}
                disabled={busy || workshopsLoading}
                required
            >
                <option value="">
                    {workshopsLoading ? 'Loading workshops…' : 'Select workshop'}
                </option>
                {workshopOptions.map((w) => (
                    <option key={w.id} value={w.id}>
                        {w.name || w.label || `#${w.id}`}
                    </option>
                ))}
            </select>
        </>
    );

    const branchSelect = (workshopId, value, onChange, branches, loading) => (
        <>
            <label className="pc-wallet-field-label">Branch *</label>
            <select
                className="pc-wallet-field"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={busy || !workshopId || loading}
                required
            >
                <option value="">
                    {!workshopId
                        ? 'Select workshop first'
                        : loading
                            ? 'Loading branches…'
                            : 'Select branch'}
                </option>
                {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                ))}
            </select>
        </>
    );

    return (
        <>
            <div className="pc-wallet-plus-wrap" ref={menuRef}>
                <button
                    type="button"
                    className="pc-wallet-plus-btn"
                    disabled={disabled || busy}
                    onClick={() => setMenuOpen((v) => !v)}
                    title="Wallet actions"
                    aria-label="Wallet actions"
                >
                    <Plus size={20} />
                </button>
                {menuOpen && (
                    <div className="pc-wallet-dropup" role="menu">
                        {showRequestFunds && (
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                    setMenuOpen(false);
                                    setFundModalError('');
                                    onError?.('');
                                    setFundOpen(true);
                                }}
                            >
                                <Banknote size={16} /> Request Funds
                            </button>
                        )}
                        {showRecordExpense && (
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                    setMenuOpen(false);
                                    setExpenseOpen(true);
                                }}
                            >
                                <Receipt size={16} /> Record Expense
                            </button>
                        )}
                        {showTransactionHistory && (
                            <button type="button" role="menuitem" onClick={openHistory}>
                                <History size={16} /> Transaction History
                            </button>
                        )}
                    </div>
                )}
            </div>

            {fundOpen && (
                <Modal
                    title="Request Funds"
                    onClose={busy ? undefined : () => setFundOpen(false)}
                    width={480}
                    className="pc-wallet-modal"
                    disableClose={busy}
                    footer={(
                        <>
                            <button type="button" className="pc-wallet-modal-cancel" disabled={busy} onClick={() => setFundOpen(false)}>
                                Cancel
                            </button>
                            <button type="button" className="pc-wallet-modal-primary" disabled={busy} onClick={submitFundRequest}>
                                {busy ? <Loader2 size={14} className="spin" /> : 'Send to chat'}
                            </button>
                        </>
                    )}
                >
                    <form className="pc-wallet-modal-form" onSubmit={submitFundRequest}>
                        {fundModalError && (
                            <p className="pc-wallet-modal-error" role="alert">{fundModalError}</p>
                        )}
                        {!skipWorkshopFields && workshopSelect(
                            'fund',
                            fundWorkshopId,
                            setFundWorkshopId,
                            setFundBranchId,
                        )}
                        {!skipWorkshopFields && !fundIsHq ? branchSelect(
                            fundWorkshopId,
                            fundBranchId,
                            setFundBranchId,
                            fundBranches,
                            fundBranchesLoading,
                        ) : null}
                        {!skipWorkshopFields && fundIsHq ? (
                            <p className="pc-wallet-modal-hint" style={{ margin: '0 0 12px', fontSize: '0.8125rem', color: '#64748b' }}>
                                Platform HQ — posts to HQ My Books. Super Admin approval only.
                            </p>
                        ) : null}
                        <label className="pc-wallet-field-label">Amount (SAR) *</label>
                        <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            className="pc-wallet-field"
                            value={fundAmount}
                            onChange={(e) => setFundAmount(e.target.value)}
                            required
                        />
                        <label className="pc-wallet-field-label">Reason / Purpose *</label>
                        <textarea
                            className="pc-wallet-field"
                            rows={3}
                            value={fundPurpose}
                            onChange={(e) => setFundPurpose(e.target.value)}
                            placeholder="What do you need these funds for?"
                            required
                        />
                    </form>
                </Modal>
            )}

            {expenseOpen && (
                <Modal
                    title="Record Expense"
                    onClose={busy ? undefined : () => setExpenseOpen(false)}
                    width={480}
                    className="pc-wallet-modal"
                    disableClose={busy}
                    footer={(
                        <>
                            <button type="button" className="pc-wallet-modal-cancel" disabled={busy} onClick={() => setExpenseOpen(false)}>
                                Cancel
                            </button>
                            <button type="button" className="pc-wallet-modal-primary" disabled={busy} onClick={submitExpense}>
                                {busy ? <Loader2 size={14} className="spin" /> : 'Record & share in chat'}
                            </button>
                        </>
                    )}
                >
                    <form className="pc-wallet-modal-form" onSubmit={submitExpense}>
                        {expenseModalError && (
                            <p className="pc-wallet-modal-error" role="alert">{expenseModalError}</p>
                        )}
                        {!skipWorkshopFields && workshopSelect(
                            'expense',
                            expenseWorkshopId,
                            setExpenseWorkshopId,
                            setExpenseBranchId,
                        )}
                        {!skipWorkshopFields && !expenseIsHq ? branchSelect(
                            expenseWorkshopId,
                            expenseBranchId,
                            setExpenseBranchId,
                            expenseBranches,
                            expenseBranchesLoading,
                        ) : null}
                        {!skipWorkshopFields && expenseIsHq ? (
                            <p className="pc-wallet-modal-hint" style={{ margin: '0 0 12px', fontSize: '0.8125rem', color: '#64748b' }}>
                                Platform HQ — posts to HQ My Books. Super Admin approval only.
                            </p>
                        ) : null}
                        <label className="pc-wallet-field-label">Amount (SAR) *</label>
                        <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            className="pc-wallet-field"
                            value={expenseAmount}
                            onChange={(e) => setExpenseAmount(e.target.value)}
                            required
                        />
                        <label className="pc-wallet-field-label">Account category *</label>
                        <SearchableEntityCombobox
                            id="pc-wallet-expense-category"
                            required
                            options={expenseCategoryOptions}
                            value={expenseCategory}
                            displayText={expenseCategorySearch}
                            onDisplayTextChange={(text) => {
                                setExpenseCategorySearch(text);
                                if (!text.trim()) setExpenseCategory('');
                            }}
                            onSelect={(opt) => {
                                setExpenseCategory(opt?.id || '');
                                setExpenseCategorySearch(opt?.label || '');
                            }}
                            placeholder="Type to search — ↑↓ to navigate, Enter to select"
                            entityLabel="category"
                            maxInitial={30}
                            maxFiltered={30}
                            disabled={busy}
                        />
                        <label className="pc-wallet-field-label">Description *</label>
                        <input
                            type="text"
                            className="pc-wallet-field"
                            value={expenseDescription}
                            onChange={(e) => setExpenseDescription(e.target.value)}
                            placeholder="What was this expense for?"
                            required
                        />
                        <label className="pc-wallet-field-label">Vendor (optional)</label>
                        <input
                            type="text"
                            className="pc-wallet-field"
                            value={expenseVendor}
                            onChange={(e) => setExpenseVendor(e.target.value)}
                            placeholder="e.g. Careem, Jarir"
                        />
                        <ExpenseProofPicker
                            id="pc-wallet-expense-proof"
                            preview={expenseProofPreview}
                            onChange={setExpenseProofPreview}
                            disabled={busy}
                        />
                    </form>
                </Modal>
            )}

            {historyOpen && (
                <Modal
                    title="Wallet transaction history"
                    onClose={busy ? undefined : () => setHistoryOpen(false)}
                    width={560}
                    disableClose={busy}
                    footer={(
                        <button type="button" className="pc-wallet-modal-cancel" onClick={() => setHistoryOpen(false)}>
                            Close
                        </button>
                    )}
                >
                    <div className="pc-wallet-history-filters">
                        <label className="pc-wallet-field-label">From</label>
                        <input
                            type="datetime-local"
                            className="pc-wallet-field"
                            value={historyDateFrom}
                            onChange={(e) => setHistoryDateFrom(e.target.value)}
                        />
                        <label className="pc-wallet-field-label">To</label>
                        <input
                            type="datetime-local"
                            className="pc-wallet-field"
                            value={historyDateTo}
                            onChange={(e) => setHistoryDateTo(e.target.value)}
                        />
                        <button
                            type="button"
                            className="pc-wallet-modal-primary"
                            disabled={historyLoading}
                            onClick={() => loadHistory()}
                        >
                            {historyLoading ? <Loader2 size={14} className="spin" /> : 'Apply filter'}
                        </button>
                    </div>
                    {historyLoading ? (
                        <div className="pc-wallet-loading"><Loader2 className="spin" size={24} /></div>
                    ) : historyRows.length === 0 ? (
                        <p className="pc-wallet-empty">No wallet activity yet.</p>
                    ) : (
                        <ul className="pc-wallet-history-list">
                            {historyRows.map((row) => (
                                <li key={`${row.rowType}-${row.rowId}`}>
                                    <button
                                        type="button"
                                        className="pc-wallet-history-item"
                                        disabled={busy}
                                        onClick={() => sendTxReference(row)}
                                    >
                                        <div className="pc-wallet-history-main">
                                            <span className="pc-wallet-history-type">
                                                {String(row.rowType).replace(/_/g, ' ')}
                                            </span>
                                            <span className="pc-wallet-history-desc">
                                                {row.description || row.reference || '—'}
                                            </span>
                                        </div>
                                        <div className="pc-wallet-history-meta">
                                            <strong>SAR {formatSar(row.amount)}</strong>
                                            <span className="pc-wallet-history-date">{formatHistoryDate(row.date)}</span>
                                            <span className={`pc-wallet-status ${row.status === 'approved' || row.status === 'completed' ? 'pc-wallet-status--approved' : row.status === 'rejected' ? 'pc-wallet-status--rejected' : 'pc-wallet-status--pending'}`}>
                                                {row.status || '—'}
                                            </span>
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    <p className="pc-wallet-history-hint">Tap a row to quote it in the chat.</p>
                </Modal>
            )}
        </>
    );
}
