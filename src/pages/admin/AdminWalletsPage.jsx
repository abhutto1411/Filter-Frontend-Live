import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Wallet, Search, Loader2, User, Mail, Shield, ChevronLeft, Users, Banknote,
    Check, X, MessageCircle, Receipt, ArrowLeftRight, HandCoins,
} from 'lucide-react';
import Modal from '../../components/Modal';
import { useAuth } from '../../context/AuthContext';
import {
    getAdminWallet,
    getRequesterWalletBalance,
    listAdminWalletTransactions,
    listAdminWallets,
} from '../../services/adminWalletApi';
import { approve as approveApproval, reject as rejectApproval } from '../../services/approvalsApi';
import {
    coerceWalletFieldText,
    formatWalletTxDate,
} from '../../utils/walletHistory';
import ExpenseProofThumbnail from '../../components/accounting/ExpenseProofThumbnail';
import BudgetWalletSection from '../../components/admin/BudgetWalletSection';
import WalletApprovalAccountFields from '../../components/admin/WalletApprovalAccountFields';
import '../../styles/admin/AdminWalletsPage.css';

function formatSar(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '0.00';
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return parts.slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

function fundStatusClass(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'approved') return 'admin-wallets-status--approved';
    if (s === 'rejected') return 'admin-wallets-status--rejected';
    return 'admin-wallets-status--pending';
}

const FILTER_ALL = 'all';
const FILTER_WITH = 'with';
const FILTER_WITHOUT = 'without';

const TAB_FUND = 'fund-requests';
const TAB_EXPENSES = 'expenses';
const TAB_TRANSACTIONS = 'transactions';

function isExpenseTransaction(row) {
    const ref = String(row?.referenceId || '');
    if (ref.startsWith('AEXP-') || ref.startsWith('AWE-')) return true;
    return String(row?.type || '').toLowerCase() === 'debit' && Boolean(row?.expenseCategory);
}

function parseExpenseDescription(description) {
    const text = coerceWalletFieldText(description);
    const sep = ' — ';
    const idx = text.lastIndexOf(sep);
    if (idx === -1) {
        return { description: text, vendor: null };
    }
    return {
        description: text.slice(0, idx),
        vendor: text.slice(idx + sep.length) || null,
    };
}

function ExpensesTable({ rows, loading }) {
    if (loading) {
        return (
            <div className="admin-wallets-loading">
                <Loader2 className="spin" size={28} />
            </div>
        );
    }
    if (!rows.length) {
        return (
            <div className="admin-wallets-empty" style={{ minHeight: 180, padding: '32px 16px' }}>
                <p style={{ margin: 0, fontSize: '0.875rem' }}>No expense records for this admin yet.</p>
            </div>
        );
    }
    return (
        <div className="admin-wallets-tx-table-wrap">
            <table className="admin-wallets-tx-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Reference</th>
                        <th>Description</th>
                        <th>Vendor</th>
                        <th>Proof</th>
                        <th>Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((t) => {
                        const parsed = parseExpenseDescription(t.description);
                        const amount = Number(t.amount ?? 0);
                        return (
                            <tr key={t.id}>
                                <td style={{ color: '#64748b', whiteSpace: 'nowrap' }}>
                                    {formatWalletTxDate(t)}
                                </td>
                                <td className="admin-wallets-tx-ref">{t.referenceId || '—'}</td>
                                <td>{parsed.description}</td>
                                <td style={{ color: '#64748b' }}>{parsed.vendor || '—'}</td>
                                <td><ExpenseProofThumbnail proofUrl={t.proofUrl} size={36} /></td>
                                <td className="admin-wallets-tx-amount--debit">
                                    − SAR {formatSar(Math.abs(amount))}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function TransactionTable({ rows, loading }) {
    if (loading) {
        return (
            <div className="admin-wallets-loading">
                <Loader2 className="spin" size={28} />
            </div>
        );
    }
    if (!rows.length) {
        return (
            <div className="admin-wallets-empty" style={{ minHeight: 180, padding: '32px 16px' }}>
                <p style={{ margin: 0, fontSize: '0.875rem' }}>No transactions yet for this wallet.</p>
            </div>
        );
    }
    return (
        <div className="admin-wallets-tx-table-wrap">
            <table className="admin-wallets-tx-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Reference</th>
                        <th>Description</th>
                        <th>Type</th>
                        <th>Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((t) => {
                        const typeRaw = String(t.type || '').toLowerCase();
                        const amount = Number(t.amount ?? 0);
                        const isCredit = typeRaw === 'credit' || (typeRaw !== 'debit' && amount > 0);
                        return (
                            <tr key={t.id}>
                                <td style={{ color: '#64748b', whiteSpace: 'nowrap' }}>
                                    {formatWalletTxDate(t)}
                                </td>
                                <td className="admin-wallets-tx-ref">{t.referenceId || '—'}</td>
                                <td>{coerceWalletFieldText(t.description)}</td>
                                <td>
                                    <span className={`admin-wallets-type-pill ${isCredit ? 'admin-wallets-type-pill--credit' : 'admin-wallets-type-pill--debit'}`}>
                                        {t.type || (isCredit ? 'credit' : 'debit')}
                                    </span>
                                </td>
                                <td className={isCredit ? 'admin-wallets-tx-amount--credit' : 'admin-wallets-tx-amount--debit'}>
                                    {isCredit ? '+' : '−'} SAR {formatSar(Math.abs(amount))}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function FundRequestsTable({
    rows,
    loading,
    canApprove,
    canReject,
    actionBusyId,
    onApprove,
    onReject,
}) {
    if (loading) {
        return (
            <div className="admin-wallets-loading" style={{ minHeight: 120 }}>
                <Loader2 className="spin" size={24} />
            </div>
        );
    }
    if (!rows.length) {
        return (
            <div className="admin-wallets-empty" style={{ minHeight: 140, padding: '28px 16px' }}>
                <p style={{ margin: 0, fontSize: '0.875rem' }}>No fund requests for this admin yet.</p>
            </div>
        );
    }
    return (
        <div className="admin-wallets-tx-table-wrap">
            <table className="admin-wallets-tx-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Reference</th>
                        <th>Purpose</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r) => {
                        const status = String(r.status || 'pending').toLowerCase();
                        const isPending = status === 'pending';
                        const busy = actionBusyId === r.id;
                        return (
                            <tr key={r.id}>
                                <td style={{ color: '#64748b', whiteSpace: 'nowrap' }}>
                                    {formatWalletTxDate({ createdAt: r.createdAt })}
                                </td>
                                <td className="admin-wallets-tx-ref">{r.requestNumber}</td>
                                <td>
                                    {r.purpose}
                                    {status === 'approved' && r.sourceAccountName && (
                                        <div className="admin-wallets-fr-meta">
                                            Funded from {r.sourceAccountName}
                                        </div>
                                    )}
                                    {status === 'rejected' && r.rejectionReason && (
                                        <div className="admin-wallets-fr-meta">
                                            {r.rejectionReason}
                                        </div>
                                    )}
                                </td>
                                <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                                    SAR {formatSar(r.amount)}
                                </td>
                                <td>
                                    <span className={`admin-wallets-status ${fundStatusClass(status)}`}>
                                        {status}
                                    </span>
                                </td>
                                <td>
                                    {isPending && (canApprove || canReject) ? (
                                        <div className="admin-wallets-fr-actions">
                                            {canApprove && (
                                                <button
                                                    type="button"
                                                    className="admin-wallets-btn-approve"
                                                    disabled={busy}
                                                    onClick={() => onApprove(r)}
                                                >
                                                    {busy ? <Loader2 size={12} className="spin" /> : <Check size={12} />}
                                                    Approve
                                                </button>
                                            )}
                                            {canReject && (
                                                <button
                                                    type="button"
                                                    className="admin-wallets-btn-reject"
                                                    disabled={busy}
                                                    onClick={() => onReject(r)}
                                                >
                                                    <X size={12} /> Reject
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <span style={{ color: '#cbd5e1' }}>—</span>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function ApproveFundModal({ request, requesterName, busy, onCancel, onConfirm, error }) {
    const [remarks, setRemarks] = useState('');
    const [fundSourceType, setFundSourceType] = useState(
        () => (request?.fundSourceType === 'wallet' ? 'wallet' : 'external'),
    );
    const [walletUsers, setWalletUsers] = useState([]);
    const [walletUsersLoading, setWalletUsersLoading] = useState(false);
    const [sourceUserId, setSourceUserId] = useState(request?.sourceUserId ?? '');
    const [sourceUserBalance, setSourceUserBalance] = useState(null);
    const [acct, setAcct] = useState({ blocked: true, loading: true });

    const requesterUserId = request?.userId ?? '';
    const recipientName = requesterName || request?.requestedByName || 'Requester';
    const lockedWalletPeer = request?.fundSourceType === 'wallet' && request?.sourceUserId;
    const amt = Number(request?.amount ?? 0);

    useEffect(() => {
        if (fundSourceType !== 'wallet') return undefined;
        let cancelled = false;
        setWalletUsersLoading(true);
        listAdminWallets({ walletOnly: true, limit: 100 })
            .then((res) => {
                if (cancelled) return;
                const peers = (res?.items ?? [])
                    .filter((u) => String(u.id) !== String(requesterUserId));
                setWalletUsers(peers);
            })
            .catch(() => {
                if (!cancelled) setWalletUsers([]);
            })
            .finally(() => {
                if (!cancelled) setWalletUsersLoading(false);
            });
        return () => { cancelled = true; };
    }, [fundSourceType, requesterUserId]);

    useEffect(() => {
        const userId = lockedWalletPeer ? request?.sourceUserId : sourceUserId;
        if (fundSourceType !== 'wallet' || !userId) {
            setSourceUserBalance(null);
            return undefined;
        }
        let cancelled = false;
        getRequesterWalletBalance(userId)
            .then((res) => {
                if (!cancelled) setSourceUserBalance(Number(res?.balance ?? 0));
            })
            .catch(() => {
                if (!cancelled) setSourceUserBalance(null);
            });
        return () => { cancelled = true; };
    }, [fundSourceType, sourceUserId, lockedWalletPeer, request?.sourceUserId]);

    const walletBlocked = fundSourceType === 'wallet' && (
        walletUsersLoading
        || !(lockedWalletPeer ? request?.sourceUserId : sourceUserId)
        || (sourceUserBalance != null && amt > 0 && sourceUserBalance < amt)
    );
    const walletBlockReason = fundSourceType === 'wallet'
        ? (walletUsersLoading
            ? 'Loading wallet users…'
            : !(lockedWalletPeer ? request?.sourceUserId : sourceUserId)
                ? 'Select a source wallet user.'
                : (sourceUserBalance != null && amt > 0 && sourceUserBalance < amt)
                    ? `Insufficient balance in source wallet (SAR ${formatSar(sourceUserBalance)}).`
                    : '')
        : '';

    const displayError = error || walletBlockReason || (fundSourceType === 'wallet' ? '' : acct.blockReason) || '';
    const confirmBlocked = busy || (fundSourceType === 'wallet' ? walletBlocked : acct.blocked);

    return (
        <Modal
            title="Approve fund request"
            onClose={busy ? undefined : onCancel}
            width={520}
            disableClose={busy}
            footer={(
                <div className="admin-wallets-modal-footer">
                    <button type="button" className="admin-wallets-modal-btn-cancel" disabled={busy} onClick={onCancel}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="admin-wallets-modal-btn-primary"
                        disabled={confirmBlocked}
                        onClick={() => onConfirm({
                            remarks: remarks.trim() || undefined,
                            fundSourceType,
                            sourceUserId: fundSourceType === 'wallet'
                                ? (lockedWalletPeer ? request?.sourceUserId : sourceUserId)
                                : undefined,
                            sourceAccountId: fundSourceType === 'wallet' ? undefined : acct.sourceAccountId,
                            sourceAccountName: fundSourceType === 'wallet' ? undefined : acct.sourceAccountName,
                            budgetAccountId: fundSourceType === 'wallet' ? undefined : acct.budgetAccountId,
                            budgetAccountName: fundSourceType === 'wallet' ? undefined : acct.budgetAccountName,
                        })}
                    >
                        {busy ? <Loader2 size={14} className="spin" /> : <Check size={16} />}
                        Approve &amp; fund wallet
                    </button>
                </div>
            )}
        >
            {displayError ? (
                <div className="admin-wallets-alert" role="alert" style={{ marginTop: 0 }}>
                    {displayError}
                </div>
            ) : null}
            <p className="admin-wallets-modal-lead">
                Approve <strong>{request.requestNumber}</strong> and credit <strong>{recipientName}</strong>&apos;s wallet.
                Amount <strong>SAR {formatSar(request.amount)}</strong>
                {fundSourceType === 'wallet'
                    ? ' will be transferred from the selected admin wallet.'
                    : ' will be deducted from the selected payment account.'}
            </p>

            {!lockedWalletPeer ? (
                <div style={{ marginBottom: 14 }}>
                    <label className="admin-wallets-modal-label">Funding source</label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            className={fundSourceType === 'external' ? 'admin-wallets-modal-btn-primary' : 'admin-wallets-modal-btn-cancel'}
                            disabled={busy}
                            onClick={() => setFundSourceType('external')}
                        >
                            Cash / Bank
                        </button>
                        <button
                            type="button"
                            className={fundSourceType === 'wallet' ? 'admin-wallets-modal-btn-primary' : 'admin-wallets-modal-btn-cancel'}
                            disabled={busy}
                            onClick={() => setFundSourceType('wallet')}
                        >
                            Deduct from another wallet
                        </button>
                    </div>
                </div>
            ) : null}

            {fundSourceType === 'wallet' ? (
                <div
                    style={{
                        marginBottom: 14,
                        padding: '12px 14px',
                        borderRadius: 10,
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                    }}
                >
                    <p style={{ margin: '0 0 8px', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Wallet transfer
                    </p>
                    <p style={{ margin: '0 0 6px', fontSize: '0.875rem' }}>
                        <strong>From wallet:</strong>{' '}
                        {lockedWalletPeer ? (
                            <>{request?.sourceUserName || 'Source user'}
                            {sourceUserBalance != null ? ` — SAR ${formatSar(sourceUserBalance)}` : ''}</>
                        ) : (
                            <select
                                className="admin-wallets-modal-textarea"
                                style={{ marginTop: 6, width: '100%', minHeight: 0, padding: '8px 10px' }}
                                value={sourceUserId}
                                onChange={(e) => setSourceUserId(e.target.value)}
                                disabled={busy || walletUsersLoading}
                            >
                                <option value="">
                                    {walletUsersLoading ? 'Loading…' : 'Select source wallet user'}
                                </option>
                                {walletUsers.map((u) => (
                                    <option key={u.id} value={u.id}>
                                        {u.name || u.email || `User ${u.id}`}
                                        {u.wallet?.balance != null
                                            ? ` — SAR ${formatSar(u.wallet.balance)}`
                                            : ''}
                                    </option>
                                ))}
                            </select>
                        )}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.875rem' }}>
                        <strong>To wallet:</strong> {recipientName}
                    </p>
                    {sourceUserBalance != null ? (
                        <p style={{ margin: '8px 0 0', fontSize: '0.8125rem', color: '#64748b' }}>
                            Source balance after transfer: SAR {formatSar(Math.max(0, sourceUserBalance - amt))}
                        </p>
                    ) : null}
                </div>
            ) : (
                <WalletApprovalAccountFields
                    workshopId={request?.workshopId != null ? String(request.workshopId) : ''}
                    branchId={request?.branchId != null ? String(request.branchId) : ''}
                    amount={request?.amount}
                    mode="fund"
                    busy={busy}
                    onChange={setAcct}
                />
            )}

            <label className="admin-wallets-modal-label" htmlFor="aw-remarks">
                Remarks (optional)
            </label>
            <textarea
                id="aw-remarks"
                className="admin-wallets-modal-textarea"
                rows={3}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                disabled={busy}
                placeholder="e.g. Approved for field visit expenses"
            />
        </Modal>
    );
}

function RejectFundModal({ request, busy, onCancel, onConfirm, error }) {
    const [reason, setReason] = useState('');
    const valid = reason.trim().length > 0;

    return (
        <Modal
            title="Reject fund request"
            onClose={busy ? undefined : onCancel}
            width={460}
            disableClose={busy}
            footer={(
                <div className="admin-wallets-modal-footer">
                    <button type="button" className="admin-wallets-modal-btn-cancel" disabled={busy} onClick={onCancel}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="admin-wallets-modal-btn-danger"
                        disabled={busy || !valid}
                        onClick={() => onConfirm(reason.trim())}
                    >
                        {busy ? <Loader2 size={14} className="spin" /> : <X size={16} />}
                        Reject
                    </button>
                </div>
            )}
        >
            {error ? (
                <div className="admin-wallets-alert" role="alert" style={{ marginTop: 0 }}>
                    {error}
                </div>
            ) : null}
            <p className="admin-wallets-modal-lead">
                Reject <strong>{request.requestNumber}</strong>? The admin will see your reason.
            </p>
            <label className="admin-wallets-modal-label" htmlFor="aw-reject-reason">
                Reason *
            </label>
            <textarea
                id="aw-reject-reason"
                className="admin-wallets-modal-textarea"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={busy}
                placeholder="Why is this request being rejected?"
            />
        </Modal>
    );
}

export default function AdminWalletsPage() {
    const navigate = useNavigate();
    const { user, hasPermission } = useAuth();
    const canView = hasPermission('admin-wallets.view');
    const canApproveFund = hasPermission('approvals.admin-wallet-fund-request.approve');
    const canRejectFund = hasPermission('approvals.admin-wallet-fund-request.reject');
    const canOpenChat = hasPermission('chat.view');
    const canViewBudget = hasPermission('budget-wallets.view');
    const canCreateBudget = hasPermission('budget-wallets.create');
    const canEditBudget = hasPermission('budget-wallets.edit');

    const [view, setView] = useState('wallets');

    const [items, setItems] = useState([]);
    const [listLoading, setListLoading] = useState(true);
    const [listError, setListError] = useState('');
    const [search, setSearch] = useState('');
    const [walletFilter, setWalletFilter] = useState(FILTER_ALL);

    const [selectedId, setSelectedId] = useState(null);
    const [detail, setDetail] = useState(null);
    const [fundRequests, setFundRequests] = useState([]);
    const [pendingFundCount, setPendingFundCount] = useState(0);
    const [transactions, setTransactions] = useState([]);
    const [detailLoading, setDetailLoading] = useState(false);
    const [txLoading, setTxLoading] = useState(false);

    const [approveTarget, setApproveTarget] = useState(null);
    const [rejectTarget, setRejectTarget] = useState(null);
    const [actionBusyId, setActionBusyId] = useState(null);
    const [actionError, setActionError] = useState('');
    const [detailTab, setDetailTab] = useState(TAB_FUND);

    const walletOnly = walletFilter === FILTER_WITH;
    const walletNone = walletFilter === FILTER_WITHOUT;

    const loadList = useCallback(async () => {
        setListLoading(true);
        setListError('');
        try {
            const res = await listAdminWallets({
                search: search.trim() || undefined,
                walletOnly: walletOnly || undefined,
                limit: 100,
            });
            let rows = Array.isArray(res?.items) ? res.items : [];
            if (walletNone) {
                rows = rows.filter((r) => !r.walletEnabled);
            }
            setItems(rows);
        } catch (err) {
            setListError(err?.message || 'Failed to load admin wallets');
            setItems([]);
        } finally {
            setListLoading(false);
        }
    }, [search, walletOnly, walletNone]);

    useEffect(() => {
        if (!canView) return;
        const t = setTimeout(() => { loadList(); }, search ? 300 : 0);
        return () => clearTimeout(t);
    }, [canView, loadList, search, walletFilter]);

    const loadDetail = useCallback(async (userId) => {
        if (!userId) return;
        setDetailLoading(true);
        setTxLoading(true);
        setDetail(null);
        setFundRequests([]);
        setPendingFundCount(0);
        setTransactions([]);
        setActionError('');
        try {
            const [detailRes, txRes] = await Promise.all([
                getAdminWallet(userId),
                listAdminWalletTransactions(userId, { limit: 100 }),
            ]);
            setDetail(detailRes?.user ?? null);
            setFundRequests(Array.isArray(detailRes?.fundRequests) ? detailRes.fundRequests : []);
            setPendingFundCount(Number(detailRes?.pendingFundRequestCount ?? 0));
            setTransactions(Array.isArray(txRes?.transactions) ? txRes.transactions : []);
        } catch (err) {
            setDetail(null);
            setFundRequests([]);
            setTransactions([]);
            setListError(err?.message || 'Failed to load wallet detail');
        } finally {
            setDetailLoading(false);
            setTxLoading(false);
        }
    }, []);

    useEffect(() => {
        if (selectedId) {
            setDetailTab(TAB_FUND);
            loadDetail(selectedId);
        }
    }, [selectedId, loadDetail]);

    useEffect(() => {
        if (approveTarget?.id) setActionError('');
    }, [approveTarget?.id]);

    useEffect(() => {
        if (rejectTarget?.id) setActionError('');
    }, [rejectTarget?.id]);

    const expenseRecords = useMemo(
        () => transactions.filter(isExpenseTransaction),
        [transactions],
    );

    const detailTabs = useMemo(() => [
        {
            id: TAB_FUND,
            label: 'Fund Requests',
            icon: HandCoins,
            count: fundRequests.length,
            badge: pendingFundCount > 0 ? pendingFundCount : null,
        },
        {
            id: TAB_EXPENSES,
            label: 'Expense Records',
            icon: Receipt,
            count: expenseRecords.length,
        },
        {
            id: TAB_TRANSACTIONS,
            label: 'Transactions',
            icon: ArrowLeftRight,
            count: detail?.transactionCount ?? transactions.length,
        },
    ], [fundRequests.length, pendingFundCount, expenseRecords.length, detail?.transactionCount, transactions.length]);

    const handleApproveConfirm = async (body) => {
        if (!approveTarget) return;
        setActionBusyId(approveTarget.id);
        setActionError('');
        try {
            await approveApproval('admin_wallet_fund_request', approveTarget.id, body);
            setApproveTarget(null);
            await loadDetail(selectedId);
            await loadList();
        } catch (err) {
            setActionError(err?.message || 'Failed to approve fund request');
        } finally {
            setActionBusyId(null);
        }
    };

    const handleRejectConfirm = async (reason) => {
        if (!rejectTarget) return;
        setActionBusyId(rejectTarget.id);
        setActionError('');
        try {
            await rejectApproval('admin_wallet_fund_request', rejectTarget.id, reason);
            setRejectTarget(null);
            await loadDetail(selectedId);
        } catch (err) {
            setActionError(err?.message || 'Failed to reject fund request');
        } finally {
            setActionBusyId(null);
        }
    };

    const selectedFromList = items.find((i) => String(i.id) === String(selectedId));

    const stats = useMemo(() => {
        const withWallet = items.filter((i) => i.walletEnabled);
        const totalBalance = withWallet.reduce(
            (sum, i) => sum + Number(i.wallet?.balance ?? 0),
            0,
        );
        return {
            total: items.length,
            withWallet: withWallet.length,
            totalBalance,
        };
    }, [items]);

    const clearSelection = () => {
        setSelectedId(null);
        setDetail(null);
        setFundRequests([]);
        setTransactions([]);
        setDetailTab(TAB_FUND);
        setApproveTarget(null);
        setRejectTarget(null);
        setActionError('');
    };

    if (!canView) {
        return (
            <div className="admin-wallets-page ws-module-container">
                <p style={{ color: '#64748b' }}>You do not have permission to view Admin Wallets.</p>
            </div>
        );
    }

    const displayUser = detail ?? selectedFromList;
    const balance = detail?.wallet?.balance ?? selectedFromList?.wallet?.balance ?? 0;
    const hasWallet = detail?.walletEnabled ?? selectedFromList?.walletEnabled;

    return (
        <div className="admin-wallets-page ws-module-container">
            <header className="admin-wallets-header">
                <div>
                    <h1 className="admin-wallets-title">Admin Wallets</h1>
                    <p className="admin-wallets-subtitle">
                        Monitor platform admin petty-cash wallets. Select a user to review fund requests, balance, and transaction history.
                    </p>
                </div>
                {canViewBudget ? (
                    <div className="admin-wallets-filters" role="tablist" aria-label="Admin wallets view">
                        <button
                            type="button"
                            className={`admin-wallets-filter-btn${view === 'wallets' ? ' active' : ''}`}
                            onClick={() => setView('wallets')}
                        >
                            Admin Wallets
                        </button>
                        <button
                            type="button"
                            className={`admin-wallets-filter-btn${view === 'budget' ? ' active' : ''}`}
                            onClick={() => setView('budget')}
                        >
                            Budget Wallet
                        </button>
                    </div>
                ) : null}
            </header>

            {view === 'budget' && canViewBudget ? (
                <BudgetWalletSection canCreate={canCreateBudget} canEdit={canEditBudget} />
            ) : (
            <>
            

            {listError && (
                <div className="admin-wallets-alert" role="alert">{listError}</div>
            )}

            <div className="admin-wallets-stats">
                <div className="admin-wallets-stat">
                    <div className="admin-wallets-stat-label">Admins shown</div>
                    <div className="admin-wallets-stat-value">{stats.total}</div>
                </div>
                <div className="admin-wallets-stat">
                    <div className="admin-wallets-stat-label">With wallet</div>
                    <div className="admin-wallets-stat-value">{stats.withWallet}</div>
                </div>
                <div className="admin-wallets-stat">
                    <div className="admin-wallets-stat-label">Combined balance</div>
                    <div className="admin-wallets-stat-value admin-wallets-stat-value--gold">
                        SAR {formatSar(stats.totalBalance)}
                    </div>
                </div>
                <div className="admin-wallets-stat">
                    <div className="admin-wallets-stat-label">Selected balance</div>
                    <div className="admin-wallets-stat-value">
                        {selectedId ? `SAR ${formatSar(balance)}` : '—'}
                    </div>
                </div>
            </div>

            <div className={`admin-wallets-shell${selectedId ? ' admin-wallets-shell--detail-open' : ''}`}>
                <aside className="admin-wallets-panel admin-wallets-list-panel">
                    <div className="admin-wallets-panel-head">
                        <h2 className="admin-wallets-panel-title">Platform admins</h2>
                        <div className="admin-wallets-search-wrap">
                            <Search size={16} />
                            <input
                                type="search"
                                className="admin-wallets-search"
                                placeholder="Search by name or email…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="admin-wallets-filters">
                            {[
                                { id: FILTER_ALL, label: 'All' },
                                { id: FILTER_WITH, label: 'With wallet' },
                                { id: FILTER_WITHOUT, label: 'No wallet' },
                            ].map((f) => (
                                <button
                                    key={f.id}
                                    type="button"
                                    className={`admin-wallets-filter-btn${walletFilter === f.id ? ' active' : ''}`}
                                    onClick={() => setWalletFilter(f.id)}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="admin-wallets-list-body">
                        {listLoading ? (
                            <div className="admin-wallets-loading">
                                <Loader2 className="spin" size={28} />
                            </div>
                        ) : items.length === 0 ? (
                            <div className="admin-wallets-empty">
                                <div className="admin-wallets-empty-icon">
                                    <Users size={28} />
                                </div>
                                <h3>No admins found</h3>
                                <p>Try a different search or filter. Assign wallets from Permissions when creating users.</p>
                            </div>
                        ) : (
                            items.map((row) => {
                                const active = String(row.id) === String(selectedId);
                                const bal = Number(row.wallet?.balance ?? 0);
                                return (
                                    <button
                                        key={row.id}
                                        type="button"
                                        className={`admin-wallets-list-item${active ? ' active' : ''}`}
                                        onClick={() => setSelectedId(row.id)}
                                    >
                                        <div className={`admin-wallets-avatar${row.walletEnabled ? '' : ' admin-wallets-avatar--muted'}`}>
                                            {initials(row.name)}
                                        </div>
                                        <div className="admin-wallets-list-main">
                                            <div className="admin-wallets-list-name">{row.name}</div>
                                            <div className="admin-wallets-list-email">{row.email}</div>
                                            <div className="admin-wallets-list-meta">
                                                <span className={`admin-wallets-badge ${row.walletEnabled ? 'admin-wallets-badge--active' : 'admin-wallets-badge--inactive'}`}>
                                                    {row.walletEnabled ? 'Wallet active' : 'No wallet'}
                                                </span>
                                                {row.walletEnabled && (
                                                    <span className="admin-wallets-balance-pill">
                                                        SAR {formatSar(bal)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </aside>

                <section className="admin-wallets-panel admin-wallets-detail-panel">
                    {!selectedId ? (
                        <div className="admin-wallets-empty">
                            <div className="admin-wallets-empty-icon">
                                <Wallet size={30} />
                            </div>
                            <h3>Select an admin</h3>
                            <p>Choose someone from the list to view fund requests, wallet balance, role, and transaction history.</p>
                        </div>
                    ) : (
                        <>
                            <div className="admin-wallets-detail-head">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                                    <button
                                        type="button"
                                        className="admin-wallets-back-btn"
                                        onClick={clearSelection}
                                        aria-label="Back to list"
                                    >
                                        <ChevronLeft size={16} />
                                        <span className="admin-wallets-back-label">Back</span>
                                    </button>
                                    <div className="admin-wallets-detail-title-wrap">
                                        <h3>{displayUser?.name ?? 'Admin wallet'}</h3>
                                        <p>{displayUser?.email}</p>
                                    </div>
                                </div>
                                {hasWallet && selectedId && String(selectedId) !== String(user?.id) && canOpenChat && (
                                    <button
                                        type="button"
                                        className="admin-wallets-chat-btn"
                                        onClick={() => navigate('/admin/chat', { state: { openUserId: selectedId } })}
                                    >
                                        <MessageCircle size={16} />
                                        Message in chat
                                    </button>
                                )}
                            </div>

                            <div className="admin-wallets-detail-body">
                                {detailLoading && !detail ? (
                                    <div className="admin-wallets-loading">
                                        <Loader2 className="spin" size={32} />
                                    </div>
                                ) : (
                                    <>
                                        {actionError && (
                                            <div className="admin-wallets-alert" role="alert">{actionError}</div>
                                        )}

                                        <div className="admin-wallets-balance-card">
                                            <p className="admin-wallets-balance-label">Available balance</p>
                                            <p className="admin-wallets-balance-amount">
                                                SAR {formatSar(balance)}
                                            </p>
                                            <div className="admin-wallets-balance-foot">
                                                <Banknote size={16} />
                                                {hasWallet ? 'Wallet assigned & active' : 'Wallet not assigned to this user'}
                                            </div>
                                        </div>

                                        <div className="admin-wallets-info-grid">
                                            <div className="admin-wallets-info-card">
                                                <div className="admin-wallets-info-label">
                                                    <User size={13} /> Name
                                                </div>
                                                <div className="admin-wallets-info-value">{displayUser?.name ?? '—'}</div>
                                            </div>
                                            <div className="admin-wallets-info-card">
                                                <div className="admin-wallets-info-label">
                                                    <Mail size={13} /> Email
                                                </div>
                                                <div className="admin-wallets-info-value">{displayUser?.email ?? '—'}</div>
                                            </div>
                                            <div className="admin-wallets-info-card">
                                                <div className="admin-wallets-info-label">
                                                    <Shield size={13} /> Role
                                                </div>
                                                <div className="admin-wallets-info-value">
                                                    {displayUser?.role?.name ?? '—'}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="admin-wallets-tabs" role="tablist" aria-label="Wallet records">
                                            {detailTabs.map((tab) => {
                                                const Icon = tab.icon;
                                                const active = detailTab === tab.id;
                                                return (
                                                    <button
                                                        key={tab.id}
                                                        type="button"
                                                        role="tab"
                                                        aria-selected={active}
                                                        className={`admin-wallets-tab${active ? ' active' : ''}`}
                                                        onClick={() => setDetailTab(tab.id)}
                                                    >
                                                        <Icon size={15} />
                                                        <span>{tab.label}</span>
                                                        {tab.badge != null ? (
                                                            <span className="admin-wallets-tab-badge admin-wallets-tab-badge--pending">
                                                                {tab.badge} pending
                                                            </span>
                                                        ) : tab.count > 0 ? (
                                                            <span className="admin-wallets-tab-badge">{tab.count}</span>
                                                        ) : null}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <div className="admin-wallets-tab-panel" role="tabpanel">
                                            {detailTab === TAB_FUND && (
                                                <FundRequestsTable
                                                    rows={fundRequests}
                                                    loading={detailLoading}
                                                    canApprove={canApproveFund}
                                                    canReject={canRejectFund}
                                                    actionBusyId={actionBusyId}
                                                    onApprove={setApproveTarget}
                                                    onReject={setRejectTarget}
                                                />
                                            )}
                                            {detailTab === TAB_EXPENSES && (
                                                <ExpensesTable
                                                    rows={expenseRecords}
                                                    loading={txLoading}
                                                />
                                            )}
                                            {detailTab === TAB_TRANSACTIONS && (
                                                <TransactionTable
                                                    rows={transactions}
                                                    loading={txLoading}
                                                />
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        </>
                    )}
                </section>
            </div>

            {approveTarget && (
                <ApproveFundModal
                    request={approveTarget}
                    requesterName={detail?.name}
                    busy={actionBusyId === approveTarget.id}
                    error={actionError}
                    onCancel={() => {
                        setApproveTarget(null);
                        setActionError('');
                    }}
                    onConfirm={handleApproveConfirm}
                />
            )}

            {rejectTarget && (
                <RejectFundModal
                    request={rejectTarget}
                    busy={actionBusyId === rejectTarget.id}
                    error={actionError}
                    onCancel={() => {
                        setRejectTarget(null);
                        setActionError('');
                    }}
                    onConfirm={handleRejectConfirm}
                />
            )}
            </>
            )}
        </div>
    );
}
