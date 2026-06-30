import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Wallet, Plus, Receipt, Loader2, Send, MessageCircle, Banknote, Inbox, ArrowDownCircle, History } from 'lucide-react';
import SearchableEntityCombobox from '../../components/SearchableEntityCombobox';
import ExpenseProofPicker from '../../components/accounting/ExpenseProofPicker';
import ExpenseProofThumbnail from '../../components/accounting/ExpenseProofThumbnail';
import { useAuth } from '../../context/AuthContext';
import { myWalletApiForUser } from '../../services/adminWalletApi';
import { firstVisibleAdminPath, firstVisibleWorkshopPath } from '../../utils/permissions';
import {
    coerceWalletFieldText,
    formatWalletTxDate,
} from '../../utils/walletHistory';
import { adminWalletExpenseComboboxOptions } from '../../constants/adminWalletExpenseCategories';
import '../workshop/Workshop.css';
import '../../styles/admin/MyWalletPage.css';

const MOBILE_WALLET_MAX = 768;

function formatSar(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '0.00';
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function workshopIsPlatformHq(workshops, workshopId) {
    if (!workshopId) return false;
    const w = workshops.find((x) => String(x.id) === String(workshopId));
    return Boolean(w?.isPlatformHq ?? w?.is_platform_hq);
}

function renderStatusPill(status) {
    const s = String(status || '').toLowerCase();
    let mod = 'pending';
    if (s === 'approved' || s === 'completed') mod = 'approved';
    else if (s === 'rejected' || s === 'cancelled') mod = 'rejected';
    return (
        <span className={`my-wallet-status my-wallet-status--${mod}`}>
            {status || 'pending'}
        </span>
    );
}

function renderEmptyState({ icon: Icon, title, text }) {
    return (
        <div className="my-wallet-empty">
            <div className="my-wallet-empty-icon">
                <Icon size={24} strokeWidth={1.75} />
            </div>
            <p className="my-wallet-empty-title">{title}</p>
            <p className="my-wallet-empty-text">{text}</p>
        </div>
    );
}

function isDebitTransaction(t) {
    const typeRaw = String(t.type || '').toLowerCase();
    const amount = Number(t.amount ?? 0);
    return typeRaw === 'debit' || (typeRaw !== 'credit' && amount < 0);
}

function useMobileWalletLayout() {
    const [isMobile, setIsMobile] = useState(
        () => typeof window !== 'undefined'
            && window.matchMedia(`(max-width: ${MOBILE_WALLET_MAX}px)`).matches,
    );

    useEffect(() => {
        const mq = window.matchMedia(`(max-width: ${MOBILE_WALLET_MAX}px)`);
        const onChange = (e) => setIsMobile(e.matches);
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);

    return isMobile;
}

export default function MyWalletPage() {
    const navigate = useNavigate();
    const { user, hasPermission } = useAuth();
    const isWorkshopPortal = user?.userType !== 'platform_admin';
    const walletApi = useMemo(() => myWalletApiForUser(user), [user?.id, user?.userType]);
    const isMobile = useMobileWalletLayout();
    const walletEnabled = Boolean(user?.walletEnabled);
    const canViewChat = hasPermission(
        isWorkshopPortal ? 'workshop.platform-chat.view' : 'chat.view',
    );
    const canPostToChat = hasPermission(
        isWorkshopPortal ? 'workshop.platform-chat.create' : 'chat.create',
    );
    const chatPath = isWorkshopPortal ? '/workshop/platform-chat' : '/admin/chat';
    const fallbackPath = isWorkshopPortal
        ? (firstVisibleWorkshopPath(user) ?? '/workshop')
        : firstVisibleAdminPath(user);

    const [activeTab, setActiveTab] = useState('wallet');
    const [wallet, setWallet] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [fundRequests, setFundRequests] = useState([]);
    const [expenseRequests, setExpenseRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [fundOpen, setFundOpen] = useState(false);
    const [fundAmount, setFundAmount] = useState('');
    const [fundPurpose, setFundPurpose] = useState('');
    const [fundWorkshopId, setFundWorkshopId] = useState('');
    const [fundBranchId, setFundBranchId] = useState('');
    const [fundBranches, setFundBranches] = useState([]);
    const [fundSaving, setFundSaving] = useState(false);

    const [walletWorkshops, setWalletWorkshops] = useState([]);

    const expenseCategoryOptions = useMemo(() => adminWalletExpenseComboboxOptions(), []);

    const [expenseOpen, setExpenseOpen] = useState(false);
    const [expenseAmount, setExpenseAmount] = useState('');
    const [expenseCategory, setExpenseCategory] = useState('');
    const [expenseCategorySearch, setExpenseCategorySearch] = useState('');
    const [expenseDescription, setExpenseDescription] = useState('');
    const [expenseVendor, setExpenseVendor] = useState('');
    const [expenseProofPreview, setExpenseProofPreview] = useState(null);
    const [expenseWorkshopId, setExpenseWorkshopId] = useState('');
    const [expenseBranchId, setExpenseBranchId] = useState('');
    const [expenseBranches, setExpenseBranches] = useState([]);
    const [expenseSaving, setExpenseSaving] = useState(false);
    const [walletChatNotice, setWalletChatNotice] = useState('');
    const [lastChatConversationId, setLastChatConversationId] = useState('');

    const expenseTransactions = useMemo(
        () => transactions.filter(isDebitTransaction),
        [transactions],
    );

    const pendingFundCount = useMemo(
        () => fundRequests.filter((r) => String(r.status || '').toLowerCase() === 'pending').length,
        [fundRequests],
    );

    const totalExpenseAmount = useMemo(
        () => expenseTransactions.reduce(
            (sum, t) => sum + Math.abs(Number(t.amount ?? 0)),
            0,
        ),
        [expenseTransactions],
    );

    const applyChatResult = (chat, successMessage) => {
        if (!canPostToChat || !chat) return;
        if (chat.posted) {
            setWalletChatNotice(
                successMessage.replace('{name}', chat.contactName || 'super admin'),
            );
            if (chat.conversationId) {
                setLastChatConversationId(String(chat.conversationId));
            }
            return;
        }
        if (chat.alreadyInChat) {
            setWalletChatNotice('This request is already visible in your support chat.');
            if (chat.conversationId) {
                setLastChatConversationId(String(chat.conversationId));
            }
            return;
        }
        if (chat.error) {
            setWalletChatNotice(
                'Saved successfully, but could not notify super admin in chat. Use Open Chat to follow up.',
            );
        }
    };

    const loadData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [walletRes, txRes, fundRes, expenseRes] = await Promise.all([
                walletApi.getMyWallet(),
                walletApi.listMyWalletTransactions({ limit: 100 }),
                walletApi.listMyFundRequests(),
                walletApi.listMyExpenseRequests(),
            ]);
            setWallet(walletRes);
            const allFundRequests = Array.isArray(fundRes?.fundRequests)
                ? fundRes.fundRequests
                : [];
            setFundRequests(allFundRequests);
            setExpenseRequests(
                Array.isArray(expenseRes?.expenseRequests) ? expenseRes.expenseRequests : [],
            );
            setTransactions(
                Array.isArray(txRes?.transactions)
                    ? txRes.transactions
                    : Array.isArray(walletRes?.recentTransactions)
                        ? walletRes.recentTransactions
                        : [],
            );
        } catch (err) {
            setError(err?.message || 'Failed to load wallet');
        } finally {
            setLoading(false);
        }
    }, [walletApi]);

    useEffect(() => {
        if (walletEnabled) loadData();
    }, [walletEnabled, loadData]);

    useEffect(() => {
        walletApi.listMyWalletWorkshops()
            .then((res) => {
                const rows = res?.workshops ?? res?.data?.workshops ?? [];
                setWalletWorkshops(Array.isArray(rows) ? rows : []);
            })
    }, [walletApi]);

    useEffect(() => {
        if (!expenseWorkshopId || workshopIsPlatformHq(walletWorkshops, expenseWorkshopId)) {
            setExpenseBranches([]);
            setExpenseBranchId('');
            return;
        }
        walletApi.listMyWalletBranches({ workshopId: expenseWorkshopId })
            .then((res) => setExpenseBranches(res?.branches ?? []))
            .catch(() => setExpenseBranches([]));
    }, [expenseWorkshopId, walletApi, walletWorkshops]);

    useEffect(() => {
        if (!fundWorkshopId || workshopIsPlatformHq(walletWorkshops, fundWorkshopId)) {
            setFundBranches([]);
            setFundBranchId('');
            return;
        }
        walletApi.listMyWalletBranches({ workshopId: fundWorkshopId })
            .then((res) => setFundBranches(res?.branches ?? []))
            .catch(() => setFundBranches([]));
    }, [fundWorkshopId, walletApi, walletWorkshops]);

    useEffect(() => {
        if (walletWorkshops.length === 1 && !expenseWorkshopId) {
            setExpenseWorkshopId(String(walletWorkshops[0].id));
        }
    }, [walletWorkshops, expenseWorkshopId]);

    useEffect(() => {
        if (walletWorkshops.length === 1 && !fundWorkshopId) {
            setFundWorkshopId(String(walletWorkshops[0].id));
        }
    }, [walletWorkshops, fundWorkshopId]);

    const openFundsTab = (openForm = false) => {
        setActiveTab('funds');
        setExpenseOpen(false);
        setFundOpen(openForm);
    };

    const openExpenseTab = () => {
        setActiveTab('expense');
        setFundOpen(false);
        setExpenseOpen(true);
    };

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        if (tab === 'wallet') {
            setFundOpen(false);
            setExpenseOpen(false);
        } else if (tab === 'funds') {
            setExpenseOpen(false);
        } else if (tab === 'expense') {
            setFundOpen(false);
            setExpenseOpen(true);
        }
    };

    const handleFundSubmit = async (e) => {
        e.preventDefault();
        const amount = Number(fundAmount);
        if (!Number.isFinite(amount) || amount <= 0) {
            alert('Enter a valid amount.');
            return;
        }
        if (!fundPurpose.trim()) {
            alert('Purpose is required.');
            return;
        }
        if (!fundWorkshopId) {
            alert('Select a workshop.');
            return;
        }
        const fundIsHq = workshopIsPlatformHq(walletWorkshops, fundWorkshopId);
        if (!fundIsHq && !fundBranchId) {
            alert('Select a branch.');
            return;
        }
        setFundSaving(true);
        setWalletChatNotice('');
        try {
            const payload = {
                amount,
                purpose: fundPurpose.trim(),
                workshopId: fundWorkshopId,
            };
            if (!fundIsHq) payload.branchId = fundBranchId;
            const res = await walletApi.createMyFundRequest(payload);
            setFundOpen(false);
            setFundAmount('');
            setFundPurpose('');
            setFundBranchId('');
            setActiveTab('funds');
            if (canPostToChat) {
                applyChatResult(
                    res?.chat,
                    'Fund request sent to {name} in chat.',
                );
            } else {
                setWalletChatNotice('Fund request submitted for super-admin approval.');
            }
            await loadData();
        } catch (err) {
            alert(err?.message || 'Failed to submit fund request');
        } finally {
            setFundSaving(false);
        }
    };

    const handleExpenseSubmit = async (e) => {
        e.preventDefault();
        const amount = Number(expenseAmount);
        if (!Number.isFinite(amount) || amount <= 0) {
            alert('Enter a valid amount.');
            return;
        }
        if (!expenseDescription.trim()) {
            alert('Description is required.');
            return;
        }
        if (!expenseCategory) {
            alert('Select an account category.');
            return;
        }
        if (!expenseProofPreview) {
            alert('Expense proof image is required.');
            return;
        }
        if (!expenseWorkshopId) {
            alert('Select a workshop.');
            return;
        }
        const expenseIsHq = workshopIsPlatformHq(walletWorkshops, expenseWorkshopId);
        if (!expenseIsHq && !expenseBranchId) {
            alert('Select a branch.');
            return;
        }
        setExpenseSaving(true);
        setWalletChatNotice('');
        try {
            const payload = {
                amount,
                description: expenseDescription.trim(),
                vendorName: expenseVendor.trim() || undefined,
                expenseCategory,
                proofUrl: expenseProofPreview,
                workshopId: expenseWorkshopId,
            };
            if (!expenseIsHq) payload.branchId = expenseBranchId;
            const res = await walletApi.recordMyWalletExpense(payload);
            setExpenseAmount('');
            setExpenseCategory('');
            setExpenseCategorySearch('');
            setExpenseDescription('');
            setExpenseVendor('');
            setExpenseProofPreview(null);
            setExpenseBranchId('');
            setActiveTab('expense');
            setExpenseOpen(true);
            if (canPostToChat) {
                applyChatResult(
                    res?.chat,
                    'Expense request submitted and shared with {name} in chat.',
                );
            } else {
                setWalletChatNotice('Expense request submitted for approval.');
            }
            await loadData();
        } catch (err) {
            alert(err?.message || 'Failed to record expense');
        } finally {
            setExpenseSaving(false);
        }
    };

    const openWalletChat = async (conversationId) => {
        if (!canViewChat) return;
        try {
            if (conversationId) {
                navigate(chatPath, { state: { openConversationId: String(conversationId) } });
                return;
            }
            const res = await walletApi.getMyWalletChatContact();
            const contactId = res?.userId ?? res?.data?.userId;
            if (contactId) {
                navigate(chatPath, { state: { openUserId: String(contactId) } });
                return;
            }
        } catch {
            /* fall through */
        }
        navigate(chatPath);
    };

    const handleShareInChat = async (requestId) => {
        if (!canPostToChat) return;
        try {
            const res = await walletApi.shareFundRequestInChat(requestId);
            const chat = res?.chat;
            if (chat?.conversationId) {
                setWalletChatNotice('Fund request shared in chat.');
                setLastChatConversationId(String(chat.conversationId));
                await openWalletChat(chat.conversationId);
            }
        } catch (err) {
            alert(err?.message || 'Could not share in chat');
        }
    };

    if (!walletEnabled) {
        return <Navigate to={fallbackPath} replace />;
    }

    const balance = wallet?.balance ?? wallet?.wallet?.balance ?? 0;
    const fundIsHq = workshopIsPlatformHq(walletWorkshops, fundWorkshopId);
    const expenseIsHq = workshopIsPlatformHq(walletWorkshops, expenseWorkshopId);

    const renderBalanceCard = () => (
        <div className="my-wallet-balance">
            <div className="my-wallet-balance-inner">
                <div>
                    <p className="my-wallet-balance-label">
                        <span className="my-wallet-balance-label-dot" aria-hidden />
                        Available Balance
                    </p>
                    <p className="my-wallet-balance-amount">
                        {formatSar(balance)}
                    </p>
                    <span className="my-wallet-balance-currency">Saudi Riyal (SAR)</span>
                </div>
                <div className="my-wallet-balance-icon-wrap" aria-hidden>
                    <Wallet size={28} strokeWidth={1.75} />
                </div>
            </div>
        </div>
    );

    const renderQuickStats = () => (
        <div className="my-wallet-stats">
            <div className="my-wallet-stat">
                <div className="my-wallet-stat-label">Pending Funds</div>
                <div className={`my-wallet-stat-value${pendingFundCount > 0 ? ' my-wallet-stat-value--amber' : ''}`}>
                    {pendingFundCount}
                </div>
            </div>
            <div className="my-wallet-stat">
                <div className="my-wallet-stat-label">Expenses</div>
                <div className="my-wallet-stat-value">{expenseTransactions.length}</div>
            </div>
            <div className="my-wallet-stat">
                <div className="my-wallet-stat-label">Total Spent</div>
                <div className="my-wallet-stat-value my-wallet-stat-value--gold">
                    {formatSar(totalExpenseAmount)}
                </div>
            </div>
        </div>
    );

    const renderFundForm = (onCancel) => (
        <div className="my-wallet-card">
            <div className="my-wallet-card-head">
                <div className="my-wallet-card-head-main">
                    <div className="my-wallet-card-icon my-wallet-card-icon--form">
                        <Banknote size={20} strokeWidth={2} />
                    </div>
                    <div>
                        <h3 className="my-wallet-card-title">Request Funds</h3>
                        <p className="my-wallet-card-sub">Submit for super-admin approval</p>
                    </div>
                </div>
            </div>
            <div className="my-wallet-card-body">
            <form onSubmit={handleFundSubmit} className="my-wallet-form">
                <p className="my-wallet-form-lead">
                    {canPostToChat
                        ? 'Your request is sent for super-admin approval and posted to your support chat.'
                        : 'Your request is sent for super-admin approval.'}
                </p>
                <div className="ws-field">
                    <label>Workshop *</label>
                    <select
                        className="form-input-field"
                        value={fundWorkshopId}
                        onChange={(e) => {
                            setFundWorkshopId(e.target.value);
                            setFundBranchId('');
                        }}
                        disabled={fundSaving}
                    >
                        <option value="">Select workshop</option>
                        {walletWorkshops.map((w) => (
                            <option key={w.id} value={w.id}>
                                {w.name || w.label || `#${w.id}`}
                            </option>
                        ))}
                    </select>
                </div>
                {!fundIsHq ? (
                    <div className="ws-field">
                        <label>Branch *</label>
                        <select
                            className="form-input-field"
                            value={fundBranchId}
                            onChange={(e) => setFundBranchId(e.target.value)}
                            disabled={fundSaving || !fundWorkshopId}
                        >
                            <option value="">Select branch</option>
                            {fundBranches.map((b) => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>
                ) : (
                    <p className="my-wallet-form-hint" style={{ marginBottom: 12 }}>
                        Platform HQ — posts to HQ My Books. Super Admin approval only (no workshop admin).
                    </p>
                )}
                <div className="ws-field">
                    <label>Amount (SAR) *</label>
                    <input type="number" min="0.01" step="0.01" value={fundAmount} onChange={(e) => setFundAmount(e.target.value)} placeholder="e.g. 5000" />
                </div>
                <div className="ws-field">
                    <label>Purpose *</label>
                    <textarea rows={3} value={fundPurpose} onChange={(e) => setFundPurpose(e.target.value)} placeholder="Why do you need these funds?" />
                    <p className="my-wallet-form-hint">
                        GL on approval: DR [1335] admin wallet · CR payment account; franchise branch also DR [1280-BR] fund.
                    </p>
                </div>
                <div className="my-wallet-form-actions">
                    <button type="button" className="ws-btn-secondary" onClick={onCancel}>Cancel</button>
                    <button type="submit" className="ws-btn-primary" disabled={fundSaving}>
                        {fundSaving ? <Loader2 size={14} className="spin" /> : <><Send size={14} /> Submit Request</>}
                    </button>
                </div>
            </form>
            </div>
        </div>
    );

    const renderExpenseForm = (onCancel) => (
        <div className="my-wallet-card">
            <div className="my-wallet-card-head">
                <div className="my-wallet-card-head-main">
                    <div className="my-wallet-card-icon my-wallet-card-icon--expense">
                        <Receipt size={20} strokeWidth={2} />
                    </div>
                    <div>
                        <h3 className="my-wallet-card-title">Record Expense</h3>
                        <p className="my-wallet-card-sub">Deducted from your wallet immediately</p>
                    </div>
                </div>
            </div>
            <div className="my-wallet-card-body">
            <form onSubmit={handleExpenseSubmit} className="my-wallet-form">
                <p className="my-wallet-form-lead">
                    {canPostToChat
                        ? 'Amount is deducted immediately and a summary is posted to your support chat.'
                        : 'Amount is deducted from your wallet immediately.'}
                </p>
                <div className="ws-field">
                    <label>Workshop *</label>
                    <select
                        className="form-input-field"
                        value={expenseWorkshopId}
                        onChange={(e) => {
                            setExpenseWorkshopId(e.target.value);
                            setExpenseBranchId('');
                        }}
                        disabled={expenseSaving}
                    >
                        <option value="">Select workshop</option>
                        {walletWorkshops.map((w) => (
                            <option key={w.id} value={w.id}>
                                {w.name || w.label || `#${w.id}`}
                            </option>
                        ))}
                    </select>
                </div>
                {!expenseIsHq ? (
                    <div className="ws-field">
                        <label>Branch *</label>
                        <select
                            className="form-input-field"
                            value={expenseBranchId}
                            onChange={(e) => setExpenseBranchId(e.target.value)}
                            disabled={expenseSaving || !expenseWorkshopId}
                        >
                            <option value="">Select branch</option>
                            {expenseBranches.map((b) => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>
                ) : (
                    <p className="my-wallet-form-hint" style={{ marginBottom: 12 }}>
                        Platform HQ — posts to HQ My Books. Super Admin approval only (no workshop admin).
                    </p>
                )}
                <div className="ws-field">
                    <label>Amount (SAR) *</label>
                    <input type="number" min="0.01" step="0.01" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} />
                </div>
                <div className="ws-field">
                    <label>Account category *</label>
                    <SearchableEntityCombobox
                        id="admin-wallet-expense-category"
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
                        disabled={expenseSaving}
                    />
                    <p className="my-wallet-form-hint">
                        GL: DR branch [6100] Employee Petty Cash Expense · CR [1335] admin wallet (HQ) or branch [1280] fund (franchise).
                    </p>
                </div>
                <div className="ws-field">
                    <label>Description *</label>
                    <input type="text" value={expenseDescription} onChange={(e) => setExpenseDescription(e.target.value)} placeholder="What was this expense for?" />
                </div>
                <div className="ws-field">
                    <label>Vendor (optional)</label>
                    <input type="text" value={expenseVendor} onChange={(e) => setExpenseVendor(e.target.value)} placeholder="e.g. Careem, Jarir" />
                </div>
                <ExpenseProofPicker
                    id="admin-wallet-expense-proof"
                    preview={expenseProofPreview}
                    onChange={setExpenseProofPreview}
                    disabled={expenseSaving}
                />
                {onCancel && (
                    <div className="my-wallet-form-actions">
                        <button type="button" className="ws-btn-secondary" onClick={onCancel}>Cancel</button>
                        <button type="submit" className="ws-btn-primary" disabled={expenseSaving}>
                            {expenseSaving ? <Loader2 size={14} className="spin" /> : 'Submit Expense Request'}
                        </button>
                    </div>
                )}
                {!onCancel && (
                    <div className="my-wallet-form-actions my-wallet-form-actions--solo">
                        <button type="submit" className="ws-btn-primary" disabled={expenseSaving}>
                            {expenseSaving ? <Loader2 size={14} className="spin" /> : 'Submit Expense Request'}
                        </button>
                    </div>
                )}
            </form>
            </div>
        </div>
    );

    const renderFundRequestsSection = () => (
        <div className="my-wallet-card">
            <div className="my-wallet-card-head">
                <div className="my-wallet-card-head-main">
                    <div className="my-wallet-card-icon my-wallet-card-icon--fund">
                        <Banknote size={20} strokeWidth={2} />
                    </div>
                    <div>
                        <h3 className="my-wallet-card-title">Fund Requests</h3>
                        <p className="my-wallet-card-sub">Top-up requests & approval status</p>
                    </div>
                </div>
                {fundRequests.length > 0 && (
                    <span className="my-wallet-card-count">{fundRequests.length}</span>
                )}
            </div>
            <div className={`my-wallet-card-body${fundRequests.length ? ' my-wallet-card-body--list' : ''}`}>
            {fundRequests.length === 0 ? (
                renderEmptyState({
                    icon: Inbox,
                    title: 'No fund requests',
                    text: 'Submit a request to add funds to your wallet.',
                })
            ) : (
                fundRequests.map((r) => (
                    <article key={r.id} className="my-wallet-list-item">
                        <div className="my-wallet-list-item-top">
                            <span className="my-wallet-ref">{r.requestNumber}</span>
                            {renderStatusPill(r.status)}
                        </div>
                        <p className="my-wallet-list-item-title">{r.purpose}</p>
                        <div className="my-wallet-list-item-meta">
                            <span>{formatWalletTxDate({ createdAt: r.createdAt })}</span>
                            {(r.workshopName || r.branchName) && (
                                <span>{[r.workshopName, r.branchName].filter(Boolean).join(' · ')}</span>
                            )}
                        </div>
                        <div className="my-wallet-list-item-foot">
                            <span className="my-wallet-list-amount">SAR {formatSar(r.amount)}</span>
                            {canPostToChat
                                && String(r.status || '').toLowerCase() === 'pending' && (
                                <button
                                    type="button"
                                    className="ws-btn-secondary my-wallet-share-btn"
                                    onClick={() => handleShareInChat(r.id)}
                                >
                                    <MessageCircle size={13} /> Share in chat
                                </button>
                            )}
                        </div>
                    </article>
                ))
            )}
            </div>
        </div>
    );

    const renderExpenseListSection = (rows = expenseTransactions, pendingRows = expenseRequests) => {
        const pending = (pendingRows ?? []).filter((r) => String(r.status || '').toLowerCase() === 'pending');
        const totalCount = rows.length + pending.length;
        return (
        <div className="my-wallet-card">
            <div className="my-wallet-card-head">
                <div className="my-wallet-card-head-main">
                    <div className="my-wallet-card-icon my-wallet-card-icon--expense">
                        <Receipt size={20} strokeWidth={2} />
                    </div>
                    <div>
                        <h3 className="my-wallet-card-title">Expenses</h3>
                        <p className="my-wallet-card-sub">Submitted requests and approved debits</p>
                    </div>
                </div>
                {totalCount > 0 && (
                    <span className="my-wallet-card-count">{totalCount}</span>
                )}
            </div>
            <div className={`my-wallet-card-body${totalCount ? ' my-wallet-card-body--list' : ''}`}>
            {totalCount === 0 ? (
                renderEmptyState({
                    icon: ArrowDownCircle,
                    title: 'No expenses yet',
                    text: 'Submit an expense request using the form above.',
                })
            ) : (
                <>
                {pending.map((r) => (
                    <article key={`exp-req-${r.id}`} className="my-wallet-list-item">
                        <div className="my-wallet-list-item-top">
                            <span className="my-wallet-ref">{r.requestNumber || '—'}</span>
                            {renderStatusPill(r.status)}
                        </div>
                        <p className="my-wallet-list-item-title">{coerceWalletFieldText(r.description)}</p>
                        <div className="my-wallet-list-item-meta">
                            <span>{r.workshopName && r.branchName ? `${r.workshopName} · ${r.branchName}` : '—'}</span>
                        </div>
                        <div className="my-wallet-list-item-foot">
                            <span className="my-wallet-list-amount my-wallet-list-amount--debit">
                                − SAR {formatSar(Number(r.amount ?? 0))}
                            </span>
                            <div className="my-wallet-list-proof">
                                <ExpenseProofThumbnail proofUrl={r.proofUrl} size={36} />
                            </div>
                        </div>
                    </article>
                ))}
                {rows.map((t) => {
                    const amount = Number(t.amount ?? 0);
                    return (
                        <article key={t.id} className="my-wallet-list-item">
                            <div className="my-wallet-list-item-top">
                                <span className="my-wallet-ref">{t.referenceId || '—'}</span>
                                <span className="my-wallet-type-pill my-wallet-type-pill--debit">debit</span>
                            </div>
                            <p className="my-wallet-list-item-title">{coerceWalletFieldText(t.description)}</p>
                            <div className="my-wallet-list-item-meta">
                                <span>{formatWalletTxDate(t)}</span>
                            </div>
                            <div className="my-wallet-list-item-foot">
                                <span className="my-wallet-list-amount my-wallet-list-amount--debit">
                                    − SAR {formatSar(Math.abs(amount))}
                                </span>
                                <div className="my-wallet-list-proof">
                                    <ExpenseProofThumbnail proofUrl={t.proofUrl} size={36} />
                                </div>
                            </div>
                        </article>
                    );
                })}
                </>
            )}
            </div>
        </div>
        );
    };

    const renderTransactionHistorySection = () => (
        <div className="my-wallet-card">
            <div className="my-wallet-card-head">
                <div className="my-wallet-card-head-main">
                    <div className="my-wallet-card-icon my-wallet-card-icon--history">
                        <History size={20} strokeWidth={2} />
                    </div>
                    <div>
                        <h3 className="my-wallet-card-title">Transaction History</h3>
                        <p className="my-wallet-card-sub">All credits and debits</p>
                    </div>
                </div>
                {transactions.length > 0 && (
                    <span className="my-wallet-card-count">{transactions.length}</span>
                )}
            </div>
            <div className={`my-wallet-card-body${transactions.length ? ' my-wallet-card-body--flush' : ''}`}>
            {transactions.length === 0 ? (
                renderEmptyState({
                    icon: History,
                    title: 'No transactions yet',
                    text: 'Your wallet activity will appear here.',
                })
            ) : (
                <div className="my-wallet-table-wrap">
                    <table className="my-wallet-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Reference</th>
                                <th>Description</th>
                                <th>Proof</th>
                                <th>Type</th>
                                <th>Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.map((t) => {
                                const typeRaw = String(t.type || '').toLowerCase();
                                const amount = Number(t.amount ?? 0);
                                const isCredit = typeRaw === 'credit' || (typeRaw !== 'debit' && amount > 0);
                                return (
                                    <tr key={t.id}>
                                        <td className="my-wallet-td-muted">{formatWalletTxDate(t)}</td>
                                        <td className="my-wallet-td-ref">{t.referenceId || '—'}</td>
                                        <td>{coerceWalletFieldText(t.description)}</td>
                                        <td>
                                            {!isCredit ? (
                                                <ExpenseProofThumbnail proofUrl={t.proofUrl} size={32} />
                                            ) : '—'}
                                        </td>
                                        <td>
                                            <span className={`my-wallet-type-pill my-wallet-type-pill--${isCredit ? 'credit' : 'debit'}`}>
                                                {t.type || (isCredit ? 'credit' : 'debit')}
                                            </span>
                                        </td>
                                        <td className={isCredit ? 'my-wallet-amount--credit' : 'my-wallet-amount--debit'}>
                                            {isCredit ? '+' : '−'} SAR {formatSar(Math.abs(amount))}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
            </div>
        </div>
    );

    const renderAlerts = () => (
        <>
            {error && (
                <p className="my-wallet-alert my-wallet-alert--error" role="alert">
                    {error}
                </p>
            )}
            {walletChatNotice && (
                <div className="my-wallet-notice">
                    <span className="my-wallet-notice-text">{walletChatNotice}</span>
                    <div className="my-wallet-notice-actions">
                        {canViewChat && (lastChatConversationId || walletChatNotice.includes('follow up')) && (
                            <button
                                type="button"
                                className="ws-btn-secondary"
                                onClick={() => openWalletChat(lastChatConversationId || undefined)}
                            >
                                <MessageCircle size={14} /> Open chat
                            </button>
                        )}
                        <button
                            type="button"
                            className="ws-btn-secondary"
                            onClick={() => setWalletChatNotice('')}
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            )}
        </>
    );

    const tabSubtitle = {
        wallet: 'Your balance and wallet summary.',
        funds: 'Fund requests and approval status.',
        expense: 'Record and review expenses.',
    };

    const renderWalletTabContent = () => (
        <div className="my-wallet-tab-panel">
            {renderBalanceCard()}
            {renderQuickStats()}
            {!isMobile && renderTransactionHistorySection()}
        </div>
    );

    const renderFundsTabContent = () => (
        <div className="my-wallet-tab-panel">
            {!fundOpen && (
                <button
                    type="button"
                    className="ws-btn-primary my-wallet-tab-cta"
                    onClick={() => setFundOpen(true)}
                >
                    <Plus size={16} /> New Fund Request
                </button>
            )}
            {fundOpen && renderFundForm(() => setFundOpen(false))}
            {renderFundRequestsSection()}
        </div>
    );

    const renderExpenseTabContent = () => (
        <div className="my-wallet-tab-panel">
            {renderExpenseForm(null)}
            {renderExpenseListSection()}
        </div>
    );

    const renderDesktopTabs = () => (
        <div className="my-wallet-desktop-tabs" role="tablist" aria-label="Wallet sections">
            <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'wallet'}
                className={`my-wallet-desktop-tab${activeTab === 'wallet' ? ' is-active' : ''}`}
                onClick={() => handleTabChange('wallet')}
            >
                <Wallet size={16} strokeWidth={2} />
                Wallet
            </button>
            <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'funds'}
                className={`my-wallet-desktop-tab${activeTab === 'funds' ? ' is-active' : ''}`}
                onClick={() => handleTabChange('funds')}
            >
                <Banknote size={16} strokeWidth={2} />
                Funds
                {pendingFundCount > 0 && (
                    <span className="my-wallet-desktop-tab-badge">{pendingFundCount}</span>
                )}
            </button>
            <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'expense'}
                className={`my-wallet-desktop-tab${activeTab === 'expense' ? ' is-active' : ''}`}
                onClick={() => openExpenseTab()}
            >
                <Receipt size={16} strokeWidth={2} />
                Expense
            </button>
        </div>
    );

    return (
        <div className={`my-wallet-page${isMobile ? ' my-wallet-page--mobile-nav' : ''}`}>
            <div className="my-wallet-header">
                <div className="my-wallet-header-text">
                    <p className="my-wallet-eyebrow">Personal wallet</p>
                    <div className="my-wallet-title-row">
                        <h2 className="my-wallet-title">My Wallet</h2>
                        <button
                            type="button"
                            className="my-wallet-header-add-btn"
                            onClick={() => openFundsTab(true)}
                        >
                            <Plus size={14} strokeWidth={2.5} />
                            Add Funds
                        </button>
                    </div>
                    <p className="my-wallet-subtitle">
                        {tabSubtitle[activeTab] || tabSubtitle.wallet}
                    </p>
                </div>
            </div>

            {!isMobile && !loading && renderDesktopTabs()}

            {renderAlerts()}

            {loading ? (
                <div className="my-wallet-loading">
                    <Loader2 className="spin" size={36} />
                </div>
            ) : (
                <>
                    {activeTab === 'wallet' && renderWalletTabContent()}
                    {activeTab === 'funds' && renderFundsTabContent()}
                    {activeTab === 'expense' && renderExpenseTabContent()}
                </>
            )}

            {isMobile && (
                <nav className="my-wallet-mobile-nav" aria-label="Wallet sections">
                    <button
                        type="button"
                        className={`my-wallet-mobile-nav-item${activeTab === 'wallet' ? ' is-active' : ''}`}
                        onClick={() => handleTabChange('wallet')}
                    >
                        <Wallet size={22} strokeWidth={activeTab === 'wallet' ? 2.25 : 2} />
                        <span>Wallet</span>
                    </button>
                    <button
                        type="button"
                        className={`my-wallet-mobile-nav-item${activeTab === 'funds' ? ' is-active' : ''}`}
                        onClick={() => handleTabChange('funds')}
                    >
                        <span className="my-wallet-mobile-nav-icon-wrap">
                            <Banknote size={22} strokeWidth={activeTab === 'funds' ? 2.25 : 2} />
                            {pendingFundCount > 0 && (
                                <span className="my-wallet-mobile-nav-badge">{pendingFundCount}</span>
                            )}
                        </span>
                        <span>Funds</span>
                    </button>
                    <button
                        type="button"
                        className={`my-wallet-mobile-nav-item${activeTab === 'expense' ? ' is-active' : ''}`}
                        onClick={() => openExpenseTab()}
                    >
                        <Receipt size={22} strokeWidth={activeTab === 'expense' ? 2.25 : 2} />
                        <span>Expense</span>
                    </button>
                </nav>
            )}
        </div>
    );
}
