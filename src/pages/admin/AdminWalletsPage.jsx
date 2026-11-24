import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
    Wallet, Search, Loader2, User, Mail, Shield, ChevronLeft, Users, Banknote,
    Check, X, MessageCircle, Receipt, ArrowLeftRight, HandCoins, Pencil, Trash2,
    AlertCircle,
} from 'lucide-react';
import AdminModalAsScreen from '../../components/admin/AdminModalAsScreen';
import { useAuth } from '../../context/AuthContext';
import {
    getAdminWallet,
    getRequesterWalletBalance,
    listAdminWalletTransactions,
    listAdminWallets,
    editAdminWalletTransaction,
    deleteAdminWalletTransaction,
} from '../../services/adminWalletApi';
import { approve as approveApproval, reject as rejectApproval } from '../../services/approvalsApi';
import {
    coerceWalletFieldText,
    formatWalletTxDate,
} from '../../utils/walletHistory';
import { awT } from '../../utils/adminWalletsI18n';
import ExpenseProofThumbnail from '../../components/accounting/ExpenseProofThumbnail';
import BudgetWalletSection from '../../components/admin/BudgetWalletSection';
import WalletApprovalAccountFields from '../../components/admin/WalletApprovalAccountFields';
import LockerPayFromFields from '../../components/admin/LockerPayFromFields';
import UiPager from '../../components/UiPager';
import WalletBooksPanel from '../../components/admin/WalletBooksPanel';
import { usePagedRows } from '../../hooks/usePagedRows';
import '../../styles/ui.css';

function formatSar(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '0.00';
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function WalletRequestApprovalDateCells({ requestedAt, approvedAt, emptyLabel, t }) {
    return (
        <>
            <td data-label={t('th.requested')} className="ui-nowrap">
                {requestedAt ? formatWalletTxDate({ createdAt: requestedAt }) : emptyLabel}
            </td>
            <td data-label={t('th.approved')} className="ui-nowrap">
                {approvedAt ? formatWalletTxDate({ createdAt: approvedAt }) : emptyLabel}
            </td>
        </>
    );
}

function runningBalanceCell(value, emptyLabel) {
    if (value == null || value === '') {
        return { text: emptyLabel, negative: false };
    }
    const n = Number(value);
    if (!Number.isFinite(n)) return { text: emptyLabel, negative: false };
    return { text: `SAR ${formatSar(n)}`, negative: n < 0 };
}

function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return parts.slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

/** Fund-request status → the system's one pill vocabulary. */
function fundStatusTone(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'approved') return 'ok';
    if (s === 'rejected') return 'dang';
    return 'warn';
}

function statusLabel(t, status) {
    const s = String(status || 'pending').toLowerCase();
    if (s === 'approved') return t('status.approved');
    if (s === 'rejected') return t('status.rejected');
    if (s === 'pending') return t('status.pending');
    return status;
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

function TxActionButtons({ row, busy, onEdit, onDelete, t }) {
    return (
        <div className="ui-row" style={{ gap: 6, justifyContent: 'flex-end' }}>
            <button
                type="button"
                className="ui-btn ui-btn--default ui-btn--sm"
                disabled={busy}
                onClick={() => onEdit(row)}
            >
                <Pencil size={13} />
                {t('btn.edit')}
            </button>
            <button
                type="button"
                className="ui-btn ui-btn--icon ui-btn--danger ui-btn--sm"
                disabled={busy}
                onClick={() => onDelete(row)}
                title={t('btn.delete')}
            >
                <Trash2 size={13} />
            </button>
        </div>
    );
}

/** A table's own busy state, in the shape the surrounding panel expects. */
function TableLoading() {
    return (
        <div className="ui-state">
            <Loader2 size={20} className="ui-spin" />
        </div>
    );
}

function TableEmpty({ label }) {
    return (
        <div className="ui-empty">
            <div className="ui-empty-title">{label}</div>
        </div>
    );
}

function ExpensesTable({ rows, loading, t, canMutate, actionBusyId, onEdit, onDelete }) {
    const list = Array.isArray(rows) ? rows : [];
    const paged = usePagedRows(list);
    if (loading) return <TableLoading />;
    if (!list.length) return <TableEmpty label={t('empty.expenses')} />;
    return (
        <div className="ui-table-wrap ui-table-wrap--scroll">
            <table className="ui-table">
                <thead>
                    <tr>
                        <th>{t('th.requested')}</th>
                        <th>{t('th.approved')}</th>
                        <th>{t('th.reference')}</th>
                        <th>{t('th.description')}</th>
                        <th>{t('th.vendor')}</th>
                        <th>{t('th.proof')}</th>
                        <th>{t('th.amount')}</th>
                        <th>{t('th.from')}</th>
                        <th>{t('th.to')}</th>
                        {canMutate ? <th aria-label={t('th.actions')} /> : null}
                    </tr>
                </thead>
                <tbody>
                    {paged.pagedRows.map((row) => {
                        const parsed = parseExpenseDescription(row.description);
                        const amount = Number(row.amount ?? 0);
                        const from = runningBalanceCell(row.previousBalance, t('empty.emDash'));
                        const to = runningBalanceCell(row.newBalance, t('empty.emDash'));
                        return (
                            <tr key={row.id}>
                                <WalletRequestApprovalDateCells
                                    requestedAt={row.requestedAt}
                                    approvedAt={row.approvedAt || row.createdAt}
                                    emptyLabel={t('empty.emDash')}
                                    t={t}
                                />
                                <td data-label={t('th.reference')} className="ui-mono">{row.referenceId || t('empty.emDash')}</td>
                                <td data-label={t('th.description')}>{parsed.description}</td>
                                <td data-label={t('th.vendor')}>{parsed.vendor || t('empty.emDash')}</td>
                                <td data-label={t('th.proof')}><ExpenseProofThumbnail proofUrl={row.proofUrl} size={36} /></td>
                                <td data-label={t('th.amount')} className="ui-num ui-money ui-money--out">
                                    − SAR {formatSar(Math.abs(amount))}
                                </td>
                                <td data-label={t('th.from')} className={`ui-num${from.negative ? ' ui-money ui-money--out' : ''}`}>
                                    {from.text}
                                </td>
                                <td data-label={t('th.to')} className={`ui-num${to.negative ? ' ui-money ui-money--out' : ''}`}>
                                    {to.text}
                                </td>
                                {canMutate ? (
                                    <td>
                                        <TxActionButtons
                                            row={row}
                                            busy={actionBusyId === row.id}
                                            onEdit={onEdit}
                                            onDelete={onDelete}
                                            t={t}
                                        />
                                    </td>
                                ) : null}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            <UiPager {...paged.pagerProps} id="aw-expenses-per-page" />
        </div>
    );
}

function TransactionTable({ rows, loading, t, canMutate, actionBusyId, onEdit, onDelete }) {
    const list = Array.isArray(rows) ? rows : [];
    const paged = usePagedRows(list);
    if (loading) return <TableLoading />;
    if (!list.length) return <TableEmpty label={t('empty.transactions')} />;
    return (
        <div className="ui-table-wrap ui-table-wrap--scroll">
            <table className="ui-table">
                <thead>
                    <tr>
                        <th>{t('th.requested')}</th>
                        <th>{t('th.approved')}</th>
                        <th>{t('th.reference')}</th>
                        <th>{t('th.description')}</th>
                        <th>{t('th.type')}</th>
                        <th>{t('th.amount')}</th>
                        <th>{t('th.from')}</th>
                        <th>{t('th.to')}</th>
                        {canMutate ? <th aria-label={t('th.actions')} /> : null}
                    </tr>
                </thead>
                <tbody>
                    {paged.pagedRows.map((row) => {
                        const typeRaw = String(row.type || '').toLowerCase();
                        const amount = Number(row.amount ?? 0);
                        const isCredit = typeRaw === 'credit' || (typeRaw !== 'debit' && amount > 0);
                        const typeLabel = typeRaw === 'credit'
                            ? t('type.credit')
                            : typeRaw === 'debit'
                                ? t('type.debit')
                                : (row.type || (isCredit ? t('type.credit') : t('type.debit')));
                        const from = runningBalanceCell(row.previousBalance, t('empty.emDash'));
                        const to = runningBalanceCell(row.newBalance, t('empty.emDash'));
                        return (
                            <tr key={row.id}>
                                <WalletRequestApprovalDateCells
                                    requestedAt={row.requestedAt}
                                    approvedAt={row.approvedAt || row.createdAt}
                                    emptyLabel={t('empty.emDash')}
                                    t={t}
                                />
                                <td data-label={t('th.reference')} className="ui-mono">{row.referenceId || t('empty.emDash')}</td>
                                <td data-label={t('th.description')}>{coerceWalletFieldText(row.description)}</td>
                                <td data-label={t('th.type')}>
                                    <span className={`ui-pill ui-pill--${isCredit ? 'ok' : 'neutral'}`}>
                                        {typeLabel}
                                    </span>
                                </td>
                                <td data-label={t('th.amount')} className={`ui-num ui-money ui-money--${isCredit ? 'in' : 'out'}`}>
                                    {isCredit ? '+' : '−'} SAR {formatSar(Math.abs(amount))}
                                </td>
                                <td data-label={t('th.from')} className={`ui-num${from.negative ? ' ui-money ui-money--out' : ''}`}>
                                    {from.text}
                                </td>
                                <td data-label={t('th.to')} className={`ui-num${to.negative ? ' ui-money ui-money--out' : ''}`}>
                                    {to.text}
                                </td>
                                {canMutate ? (
                                    <td>
                                        <TxActionButtons
                                            row={row}
                                            busy={actionBusyId === row.id}
                                            onEdit={onEdit}
                                            onDelete={onDelete}
                                            t={t}
                                        />
                                    </td>
                                ) : null}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            <UiPager {...paged.pagerProps} id="aw-transactions-per-page" />
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
    t,
}) {
    const list = Array.isArray(rows) ? rows : [];
    const paged = usePagedRows(list);
    if (loading) return <TableLoading />;
    if (!list.length) return <TableEmpty label={t('empty.fundRequests')} />;
    return (
        <div className="ui-table-wrap ui-table-wrap--scroll">
            <table className="ui-table">
                <thead>
                    <tr>
                        <th>{t('th.requested')}</th>
                        <th>{t('th.approved')}</th>
                        <th>{t('th.reference')}</th>
                        <th>{t('th.purpose')}</th>
                        <th>{t('th.amount')}</th>
                        <th>{t('th.status')}</th>
                        <th aria-label={t('th.actions')} />
                    </tr>
                </thead>
                <tbody>
                    {paged.pagedRows.map((r) => {
                        const status = String(r.status || 'pending').toLowerCase();
                        const isPending = status === 'pending';
                        const busy = actionBusyId === r.id;
                        return (
                            <tr key={r.id}>
                                <WalletRequestApprovalDateCells
                                    requestedAt={r.createdAt}
                                    approvedAt={r.approvedAt}
                                    emptyLabel={t('empty.emDash')}
                                    t={t}
                                />
                                <td data-label={t('th.reference')} className="ui-mono">{r.requestNumber}</td>
                                <td data-label={t('th.purpose')}>
                                    {r.purpose}
                                    {status === 'approved' && r.sourceAccountName && (
                                        <div className="ui-list-meta">
                                            {t('fund.fundedFrom', { name: r.sourceAccountName })}
                                        </div>
                                    )}
                                    {status === 'rejected' && r.rejectionReason && (
                                        <div className="ui-list-meta">
                                            {r.rejectionReason}
                                        </div>
                                    )}
                                </td>
                                <td data-label={t('th.amount')} className="ui-num ui-money">
                                    SAR {formatSar(r.amount)}
                                </td>
                                <td data-label={t('th.status')}>
                                    <span className={`ui-pill ui-pill--${fundStatusTone(status)}`}>
                                        {statusLabel(t, status)}
                                    </span>
                                </td>
                                <td>
                                    {isPending && (canApprove || canReject) ? (
                                        <div className="ui-row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                                            {canApprove && (
                                                <button
                                                    type="button"
                                                    className="ui-btn ui-btn--brand ui-btn--sm"
                                                    disabled={busy}
                                                    onClick={() => onApprove(r)}
                                                >
                                                    {busy ? <Loader2 size={13} className="ui-spin" /> : <Check size={13} />}
                                                    {t('btn.approve')}
                                                </button>
                                            )}
                                            {canReject && (
                                                <button
                                                    type="button"
                                                    className="ui-btn ui-btn--danger ui-btn--sm"
                                                    disabled={busy}
                                                    onClick={() => onReject(r)}
                                                >
                                                    <X size={13} /> {t('btn.reject')}
                                                </button>
                                            )}
                                        </div>
                                    ) : null}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            <UiPager {...paged.pagerProps} id="aw-fund-per-page" />
        </div>
    );
}

function ApproveFundModal({ request, requesterName, busy, onCancel, onConfirm, error, t }) {
    const [remarks, setRemarks] = useState('');
    const [fundSourceType, setFundSourceType] = useState(
        () => (request?.fundSourceType === 'wallet' ? 'wallet' : 'external'),
    );
    const [walletUsers, setWalletUsers] = useState([]);
    const [walletUsersLoading, setWalletUsersLoading] = useState(false);
    const [sourceUserId, setSourceUserId] = useState(request?.sourceUserId ?? '');
    const [sourceUserBalance, setSourceUserBalance] = useState(null);
    const [acct, setAcct] = useState({ blocked: true, loading: true });
    const [locker, setLocker] = useState({ blocked: true, blockReason: '' });

    const requesterUserId = request?.userId ?? '';
    const recipientName = requesterName || request?.requestedByName || t('approve.requester');
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
            ? t('approve.loadingUsers')
            : !(lockedWalletPeer ? request?.sourceUserId : sourceUserId)
                ? t('approve.selectSource')
                : (sourceUserBalance != null && amt > 0 && sourceUserBalance < amt)
                    ? t('approve.insufficient', { balance: formatSar(sourceUserBalance) })
                    : '')
        : '';

    const displayError = error || walletBlockReason || (
        fundSourceType === 'wallet'
            ? ''
            : fundSourceType === 'locker'
                ? locker.blockReason
                : acct.blockReason
    ) || '';
    const confirmBlocked = busy || (
        fundSourceType === 'wallet'
            ? walletBlocked
            : fundSourceType === 'locker'
                ? locker.blocked
                : acct.blocked
    );

    return (
        <AdminModalAsScreen
            title={t('approve.title')}
            onClose={onCancel}
            backDisabled={busy}
            footer={(
                <div className="ui-panel-end">
                    <button type="button" className="ui-btn ui-btn--default" disabled={busy} onClick={onCancel}>
                        {t('btn.cancel')}
                    </button>
                    <button
                        type="button"
                        className="ui-btn ui-btn--primary"
                        disabled={confirmBlocked}
                        onClick={() => onConfirm({
                            remarks: remarks.trim() || undefined,
                            fundSourceType,
                            sourceUserId: fundSourceType === 'wallet'
                                ? (lockedWalletPeer ? request?.sourceUserId : sourceUserId)
                                : undefined,
                            sourceAccountId: fundSourceType === 'wallet'
                                ? undefined
                                : fundSourceType === 'locker'
                                    ? locker.sourceAccountId
                                    : acct.sourceAccountId,
                            sourceAccountName: fundSourceType === 'wallet'
                                ? undefined
                                : fundSourceType === 'locker'
                                    ? locker.sourceAccountName
                                    : acct.sourceAccountName,
                            budgetAccountId: fundSourceType === 'external' ? acct.budgetAccountId : undefined,
                            budgetAccountName: fundSourceType === 'external' ? acct.budgetAccountName : undefined,
                        })}
                    >
                        {busy ? <Loader2 size={14} className="ui-spin" /> : <Check size={16} />}
                        {t('approve.confirmFund')}
                    </button>
                </div>
            )}
        >
            {displayError ? (
                <div className="ui-banner ui-banner--dang" role="alert">
                    <AlertCircle size={15} />
                    <span>{displayError}</span>
                </div>
            ) : null}
            <p className="ui-lead">
                {t('approve.leadPrefix')} <strong>{request.requestNumber}</strong> {t('approve.leadCredit', { name: recipientName })}
                {' '}{t('approve.leadAmount')} <strong>SAR {formatSar(request.amount)}</strong>
                {' '}
                {fundSourceType === 'wallet'
                    ? t('approve.leadWallet')
                    : fundSourceType === 'locker'
                        ? t('approve.leadLocker')
                        : t('approve.leadExternal')}
            </p>

            {!lockedWalletPeer ? (
                <div style={{ marginBottom: 18 }}>
                    <span className="ui-fieldlabel">{t('approve.fundingSource')}</span>
                    <div className="ui-row">
                        <button
                            type="button"
                            className={`ui-btn ui-btn--${fundSourceType === 'external' ? 'primary' : 'default'}`}
                            disabled={busy}
                            onClick={() => setFundSourceType('external')}
                        >
                            {t('approve.cashBank')}
                        </button>
                        <button
                            type="button"
                            className={`ui-btn ui-btn--${fundSourceType === 'wallet' ? 'primary' : 'default'}`}
                            disabled={busy}
                            onClick={() => setFundSourceType('wallet')}
                        >
                            {t('approve.deductWallet')}
                        </button>
                        <button
                            type="button"
                            className={`ui-btn ui-btn--${fundSourceType === 'locker' ? 'primary' : 'default'}`}
                            disabled={busy}
                            onClick={() => setFundSourceType('locker')}
                        >
                            {t('approve.lockerWallet')}
                        </button>
                    </div>
                </div>
            ) : null}

            {fundSourceType === 'wallet' ? (
                <section className="ui-subgroup ui-subgroup--card">
                    <h4 className="ui-subgroup-title">{t('approve.walletTransfer')}</h4>
                    {lockedWalletPeer ? (
                        <div className="ui-fields">
                            <div className="ui-fieldro">
                                <span className="ui-fieldro-label">{t('approve.fromWallet')}</span>
                                <span className="ui-fieldro-value">
                                    {request?.sourceUserName || t('approve.sourceUser')}
                                    {sourceUserBalance != null ? ` — SAR ${formatSar(sourceUserBalance)}` : ''}
                                </span>
                            </div>
                            <div className="ui-fieldro">
                                <span className="ui-fieldro-label">{t('approve.toWallet')}</span>
                                <span className="ui-fieldro-value">{recipientName}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="ui-form-grid">
                            <div className="ui-field ui-col-6">
                                <label htmlFor="aw-source-wallet">{t('approve.fromWallet')}</label>
                                <select
                                    id="aw-source-wallet"
                                    className="ui-select"
                                    value={sourceUserId}
                                    onChange={(e) => setSourceUserId(e.target.value)}
                                    disabled={busy || walletUsersLoading}
                                >
                                    <option value="">
                                        {walletUsersLoading ? t('approve.loading') : t('approve.selectSourceOpt')}
                                    </option>
                                    {walletUsers.map((u) => (
                                        <option key={u.id} value={u.id}>
                                            {u.name || u.email || t('approve.userFallback', { id: u.id })}
                                            {u.wallet?.balance != null
                                                ? ` — SAR ${formatSar(u.wallet.balance)}`
                                                : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="ui-field ui-col-6">
                                <span className="ui-fieldro-label">{t('approve.toWallet')}</span>
                                <span className="ui-fieldro-value">{recipientName}</span>
                            </div>
                        </div>
                    )}
                    {sourceUserBalance != null ? (
                        <p className="ui-help" style={{ marginTop: 10 }}>
                            {t('approve.sourceAfter', { amount: formatSar(Math.max(0, sourceUserBalance - amt)) })}
                        </p>
                    ) : null}
                </section>
            ) : fundSourceType === 'locker' ? (
                <LockerPayFromFields
                    amount={request?.amount}
                    busy={busy}
                    onChange={setLocker}
                />
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

            <label className="ui-fieldlabel" htmlFor="aw-remarks">
                {t('approve.remarks')}
            </label>
            <textarea
                id="aw-remarks"
                className="ui-textarea"
                rows={3}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                disabled={busy}
                placeholder={t('approve.remarksPh')}
            />
        </AdminModalAsScreen>
    );
}

function RejectFundModal({ request, busy, onCancel, onConfirm, error, t }) {
    const [reason, setReason] = useState('');
    const valid = reason.trim().length > 0;

    return (
        <AdminModalAsScreen
            title={t('reject.title')}
            onClose={onCancel}
            backDisabled={busy}
            footer={(
                <div className="ui-panel-end">
                    <button type="button" className="ui-btn ui-btn--default" disabled={busy} onClick={onCancel}>
                        {t('btn.cancel')}
                    </button>
                    <button
                        type="button"
                        className="ui-btn ui-btn--danger"
                        disabled={busy || !valid}
                        onClick={() => onConfirm(reason.trim())}
                    >
                        {busy ? <Loader2 size={14} className="ui-spin" /> : <X size={16} />}
                        {t('btn.reject')}
                    </button>
                </div>
            )}
        >
            {error ? (
                <div className="ui-banner ui-banner--dang" role="alert">
                    <AlertCircle size={15} />
                    <span>{error}</span>
                </div>
            ) : null}
            <p className="ui-lead">
                {t('reject.lead', { num: request.requestNumber })}
            </p>
            <label className="ui-fieldlabel" htmlFor="aw-reject-reason">
                {t('reject.reason')}
            </label>
            <textarea
                id="aw-reject-reason"
                className="ui-textarea"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={busy}
                placeholder={t('reject.reasonPh')}
            />
        </AdminModalAsScreen>
    );
}

function EditTxModal({ row, busy, onCancel, onConfirm, error, t }) {
    const [amount, setAmount] = useState(String(Number(row?.amount ?? 0)));
    const [description, setDescription] = useState(coerceWalletFieldText(row?.description) || '');

    return (
        <AdminModalAsScreen
            title={t('tx.editTitle')}
            onClose={busy ? undefined : onCancel}
            footer={(
                <div className="ui-panel-end">
                    <button type="button" className="ui-btn ui-btn--danger" disabled={busy} onClick={onCancel}>
                        {t('btn.cancel')}
                    </button>
                    <button
                        type="button"
                        className="ui-btn ui-btn--brand"
                        disabled={busy || !(Number(amount) > 0)}
                        onClick={() => onConfirm({
                            amount: Number(amount),
                            description: description.trim() || undefined,
                        })}
                    >
                        {busy ? <Loader2 size={14} className="ui-spin" /> : <Check size={16} />}
                        {t('btn.saveChanges')}
                    </button>
                </div>
            )}
        >
            {error ? (
                <div className="ui-banner ui-banner--dang" role="alert">
                    <AlertCircle size={15} />
                    <span>{error}</span>
                </div>
            ) : null}
            <p className="ui-lead">{t('tx.editLead')}</p>
            <p className="ui-lead" style={{ marginTop: -6 }}>
                {row?.referenceId || t('empty.emDash')}
            </p>
            <label className="ui-fieldlabel" htmlFor="aw-tx-amount">
                {t('tx.amount')}
            </label>
            <input
                id="aw-tx-amount"
                className="ui-input"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={busy}
            />
            <label className="ui-fieldlabel" htmlFor="aw-tx-desc" style={{ marginTop: 14 }}>
                {t('tx.description')}
            </label>
            <textarea
                id="aw-tx-desc"
                className="ui-textarea"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={busy}
            />
        </AdminModalAsScreen>
    );
}

function DeleteTxModal({ row, busy, onCancel, onConfirm, error, t }) {
    return (
        <AdminModalAsScreen
            title={t('tx.deleteTitle')}
            onClose={busy ? undefined : onCancel}
            footer={(
                <div className="ui-panel-end">
                    <button type="button" className="ui-btn ui-btn--default" disabled={busy} onClick={onCancel}>
                        {t('btn.cancel')}
                    </button>
                    <button
                        type="button"
                        className="ui-btn ui-btn--danger"
                        disabled={busy}
                        onClick={onConfirm}
                    >
                        {busy ? <Loader2 size={14} className="ui-spin" /> : <Trash2 size={16} />}
                        {t('tx.confirmDelete')}
                    </button>
                </div>
            )}
        >
            {error ? (
                <div className="ui-banner ui-banner--dang" role="alert">
                    <AlertCircle size={15} />
                    <span>{error}</span>
                </div>
            ) : null}
            <p className="ui-lead">
                {t('tx.deleteLead', { ref: row?.referenceId || t('empty.emDash') })}
            </p>
        </AdminModalAsScreen>
    );
}

export default function AdminWalletsPage() {
    const navigate = useNavigate();
    const outletCtx = useOutletContext() || {};
    const locale =
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => awT(locale, key, vars), [locale]);

    const { user, hasPermission } = useAuth();
    const canView = hasPermission('admin-wallets.view');
    const canApproveFund = hasPermission('approvals.admin-wallet-fund-request.approve');
    const canRejectFund = hasPermission('approvals.admin-wallet-fund-request.reject');
    const canOpenChat = hasPermission('chat.view');
    const canViewBudget = hasPermission('budget-wallets.view');
    const canCreateBudget = hasPermission('budget-wallets.create');
    const canEditBudget = hasPermission('budget-wallets.edit');
    const canMutateTx = user?.userType === 'platform_admin' && (!user?.role || user.role?.isSystem);

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
    const [editTxTarget, setEditTxTarget] = useState(null);
    const [deleteTxTarget, setDeleteTxTarget] = useState(null);
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
            setListError(err?.message || t('err.loadList'));
            setItems([]);
        } finally {
            setListLoading(false);
        }
    }, [search, walletOnly, walletNone, t]);

    useEffect(() => {
        if (!canView) return;
        const timer = setTimeout(() => { loadList(); }, search ? 300 : 0);
        return () => clearTimeout(timer);
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
            setListError(err?.message || t('err.loadDetail'));
        } finally {
            setDetailLoading(false);
            setTxLoading(false);
        }
    }, [t]);

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
            label: t('tab.fundRequests'),
            icon: HandCoins,
            count: fundRequests.length,
            badge: pendingFundCount > 0 ? pendingFundCount : null,
        },
        {
            id: TAB_EXPENSES,
            label: t('tab.expenseRecords'),
            icon: Receipt,
            count: expenseRecords.length,
        },
        {
            id: TAB_TRANSACTIONS,
            label: t('tab.transactions'),
            icon: ArrowLeftRight,
            count: detail?.transactionCount ?? transactions.length,
        },
    ], [t, fundRequests.length, pendingFundCount, expenseRecords.length, detail?.transactionCount, transactions.length]);

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
            setActionError(err?.message || t('err.approve'));
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
            setActionError(err?.message || t('err.reject'));
        } finally {
            setActionBusyId(null);
        }
    };

    const handleEditTxConfirm = async (body) => {
        if (!editTxTarget || !selectedId) return;
        setActionBusyId(editTxTarget.id);
        setActionError('');
        try {
            await editAdminWalletTransaction(selectedId, editTxTarget.id, body);
            setEditTxTarget(null);
            await loadDetail(selectedId);
            await loadList();
        } catch (err) {
            setActionError(err?.message || t('err.editTx'));
        } finally {
            setActionBusyId(null);
        }
    };

    const handleDeleteTxConfirm = async () => {
        if (!deleteTxTarget || !selectedId) return;
        setActionBusyId(deleteTxTarget.id);
        setActionError('');
        try {
            await deleteAdminWalletTransaction(selectedId, deleteTxTarget.id);
            setDeleteTxTarget(null);
            await loadDetail(selectedId);
            await loadList();
        } catch (err) {
            setActionError(err?.message || t('err.deleteTx'));
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
        setEditTxTarget(null);
        setDeleteTxTarget(null);
        setActionError('');
    };

    if (!canView) {
        return (
            <div className="ui-root ui-root--flush">
                <div className="ui-panel">
                    <div className="ui-state">
                        <Shield size={20} />
                        <div className="ui-state-title">{t('page.noPerm')}</div>
                    </div>
                </div>
            </div>
        );
    }

    const displayUser = detail ?? selectedFromList;
    const balance = detail?.wallet?.balance ?? selectedFromList?.wallet?.balance ?? 0;
    const hasWallet = detail?.walletEnabled ?? selectedFromList?.walletEnabled;

    if (approveTarget) {
        return (
            <ApproveFundModal
                request={approveTarget}
                requesterName={detail?.name}
                busy={actionBusyId === approveTarget.id}
                error={actionError}
                t={t}
                onCancel={() => {
                    setApproveTarget(null);
                    setActionError('');
                }}
                onConfirm={handleApproveConfirm}
            />
        );
    }

    if (rejectTarget) {
        return (
            <RejectFundModal
                request={rejectTarget}
                busy={actionBusyId === rejectTarget.id}
                error={actionError}
                t={t}
                onCancel={() => {
                    setRejectTarget(null);
                    setActionError('');
                }}
                onConfirm={handleRejectConfirm}
            />
        );
    }

    if (editTxTarget) {
        return (
            <EditTxModal
                row={editTxTarget}
                busy={actionBusyId === editTxTarget.id}
                error={actionError}
                t={t}
                onCancel={() => {
                    setEditTxTarget(null);
                    setActionError('');
                }}
                onConfirm={handleEditTxConfirm}
            />
        );
    }

    if (deleteTxTarget) {
        return (
            <DeleteTxModal
                row={deleteTxTarget}
                busy={actionBusyId === deleteTxTarget.id}
                error={actionError}
                t={t}
                onCancel={() => {
                    setDeleteTxTarget(null);
                    setActionError('');
                }}
                onConfirm={handleDeleteTxConfirm}
            />
        );
    }

    return (
        <div className="ui-root ui-root--flush">
            {canViewBudget ? (
                <div className="ui-tabs" role="tablist" aria-label={t('page.viewAria')}>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={view === 'wallets'}
                        className="ui-tab"
                        onClick={() => setView('wallets')}
                    >
                        {t('tab.adminWallets')}
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={view === 'budget'}
                        className="ui-tab"
                        onClick={() => setView('budget')}
                    >
                        {t('tab.budgetWallet')}
                    </button>
                </div>
            ) : null}

            {view === 'budget' && canViewBudget ? (
                <BudgetWalletSection canCreate={canCreateBudget} canEdit={canEditBudget} />
            ) : (
            <>

            {listError && (
                <div className="ui-banner ui-banner--dang" role="alert">
                    <AlertCircle size={15} />
                    <span>{listError}</span>
                </div>
            )}

            <div className="ui-kpis" style={{ marginTop: 16 }}>
                <div className="ui-metric">
                    <span className="ui-metric-icon"><Users size={62} strokeWidth={1.1} /></span>
                    <div className="ui-metric-label">{t('stat.adminsShown')}</div>
                    <div className="ui-metric-value">{stats.total}</div>
                </div>
                <div className="ui-metric">
                    <span className="ui-metric-icon"><Wallet size={62} strokeWidth={1.1} /></span>
                    <div className="ui-metric-label">{t('stat.withWallet')}</div>
                    <div className="ui-metric-value">{stats.withWallet}</div>
                    <div className="ui-metric-foot">{t('stat.ofTotal', { n: stats.total })}</div>
                </div>
                <div className="ui-metric">
                    <span className="ui-metric-icon"><Banknote size={62} strokeWidth={1.1} /></span>
                    <div className="ui-metric-label">{t('stat.combinedBalance')}</div>
                    <div className="ui-metric-value">SAR {formatSar(stats.totalBalance)}</div>
                </div>
                <div className="ui-metric">
                    <span className="ui-metric-icon"><HandCoins size={62} strokeWidth={1.1} /></span>
                    <div className="ui-metric-label">{t('stat.selectedBalance')}</div>
                    <div className="ui-metric-value">
                        {selectedId ? `SAR ${formatSar(balance)}` : t('empty.emDash')}
                    </div>
                </div>
            </div>

            <div className={`ui-split${selectedId ? ' ui-split--picked' : ''}`} style={{ marginTop: 14 }}>
                <aside className="ui-panel ui-split-aside">
                    <div className="ui-toolbar">
                        <div className="ui-search">
                            <Search size={14} />
                            <input
                                type="search"
                                className="ui-input"
                                placeholder={t('list.searchPlaceholder')}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="ui-toolbar">
                        {[
                            { id: FILTER_ALL, label: t('filter.all') },
                            { id: FILTER_WITH, label: t('filter.withWallet') },
                            { id: FILTER_WITHOUT, label: t('filter.noWallet') },
                        ].map((f) => (
                            <button
                                key={f.id}
                                type="button"
                                className={`ui-chip${walletFilter === f.id ? ' ui-chip--on' : ''}`}
                                aria-pressed={walletFilter === f.id}
                                onClick={() => setWalletFilter(f.id)}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    <div className="ui-split-scroll">
                        {listLoading ? (
                            <div className="ui-state">
                                <Loader2 className="ui-spin" size={20} />
                            </div>
                        ) : items.length === 0 ? (
                            <div className="ui-empty">
                                <div className="ui-empty-icon"><Users size={18} /></div>
                                <div className="ui-empty-title">{t('list.emptyTitle')}</div>
                                <div className="ui-empty-sub">{t('list.emptyBody')}</div>
                            </div>
                        ) : (
                            items.map((row) => {
                                const active = String(row.id) === String(selectedId);
                                const bal = Number(row.wallet?.balance ?? 0);
                                return (
                                    <button
                                        key={row.id}
                                        type="button"
                                        className="ui-pickrow"
                                        aria-current={active}
                                        onClick={() => setSelectedId(row.id)}
                                    >
                                        <span className="ui-avatar">{initials(row.name)}</span>
                                        <span className="ui-pickrow-main">
                                            <span className="ui-list-title">{row.name}</span>
                                            <span className="ui-list-meta">{row.email}</span>
                                            <span className="ui-row" style={{ gap: 6, marginTop: 6 }}>
                                                <span className={`ui-pill ui-pill--${row.walletEnabled ? 'ok' : 'neutral'}`}>
                                                    {row.walletEnabled ? t('badge.walletActive') : t('badge.noWallet')}
                                                </span>
                                                {row.walletEnabled && (
                                                    <span className="ui-pill ui-pill--neutral">
                                                        SAR {formatSar(bal)}
                                                    </span>
                                                )}
                                            </span>
                                        </span>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </aside>

                <section className="ui-panel">
                    {!selectedId ? (
                        <div className="ui-empty">
                            <div className="ui-empty-icon"><Wallet size={18} /></div>
                            <div className="ui-empty-title">{t('detail.selectTitle')}</div>
                            <div className="ui-empty-sub">{t('detail.selectBody')}</div>
                        </div>
                    ) : (
                        <>
                            <div className="ui-toolbar">
                                <button
                                    type="button"
                                    className="ui-btn ui-btn--subtle ui-btn--sm"
                                    onClick={clearSelection}
                                    aria-label={t('detail.backAria')}
                                >
                                    <ChevronLeft size={15} />
                                    {t('detail.back')}
                                </button>
                                <div style={{ minWidth: 0 }}>
                                    <div className="ui-list-title">
                                        {displayUser?.name ?? t('detail.fallbackTitle')}
                                    </div>
                                    <div className="ui-list-meta">{displayUser?.email}</div>
                                </div>
                                {hasWallet && selectedId && String(selectedId) !== String(user?.id) && canOpenChat && (
                                    <div className="ui-toolbar-end">
                                        <button
                                            type="button"
                                            className="ui-btn ui-btn--default ui-btn--sm"
                                            onClick={() => navigate('/admin/chat', { state: { openUserId: selectedId } })}
                                        >
                                            <MessageCircle size={14} />
                                            {t('detail.chat')}
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="ui-panel-pad">
                                {detailLoading && !detail ? (
                                    <div className="ui-state">
                                        <Loader2 className="ui-spin" size={22} />
                                    </div>
                                ) : (
                                    <div className="ui-stack">
                                        {actionError && (
                                            <div className="ui-banner ui-banner--dang" role="alert">
                                                <AlertCircle size={15} />
                                                <span>{actionError}</span>
                                            </div>
                                        )}

                                        <div className="ui-figure">
                                            <p className="ui-figure-label">{t('detail.balanceLabel')}</p>
                                            <p className={`ui-figure-value${Number(balance) < 0 ? ' ui-figure-value--dang' : ''}`}>
                                                SAR {formatSar(balance)}
                                            </p>
                                            <p className="ui-figure-foot">
                                                <Banknote size={14} />
                                                {hasWallet ? t('detail.walletActive') : t('detail.walletInactive')}
                                            </p>
                                        </div>

                                        {detail?.wallet ? (
                                            <WalletBooksPanel
                                                userId={selectedId}
                                                wallet={detail.wallet}
                                                onChanged={() => loadDetail(selectedId)}
                                                t={t}
                                            />
                                        ) : null}

                                        <div className="ui-fields">
                                            <div className="ui-fieldro">
                                                <span className="ui-fieldro-label">
                                                    <User size={12} /> {t('detail.labelName')}
                                                </span>
                                                <span className="ui-fieldro-value">{displayUser?.name ?? t('empty.emDash')}</span>
                                            </div>
                                            <div className="ui-fieldro">
                                                <span className="ui-fieldro-label">
                                                    <Mail size={12} /> {t('detail.labelEmail')}
                                                </span>
                                                <span className="ui-fieldro-value">{displayUser?.email ?? t('empty.emDash')}</span>
                                            </div>
                                            <div className="ui-fieldro">
                                                <span className="ui-fieldro-label">
                                                    <Shield size={12} /> {t('detail.labelRole')}
                                                </span>
                                                <span className="ui-fieldro-value">
                                                    {displayUser?.role?.name ?? t('empty.emDash')}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="ui-tabs" role="tablist" aria-label={t('detail.tabsAria')}>
                                            {detailTabs.map((tab) => {
                                                const active = detailTab === tab.id;
                                                return (
                                                    <button
                                                        key={tab.id}
                                                        type="button"
                                                        role="tab"
                                                        aria-selected={active}
                                                        className="ui-tab"
                                                        onClick={() => setDetailTab(tab.id)}
                                                    >
                                                        {tab.label}
                                                        {tab.badge != null ? (
                                                            <span className="ui-tab-count">{tab.badge}</span>
                                                        ) : tab.count > 0 ? (
                                                            <span className="ui-tab-count">{tab.count}</span>
                                                        ) : null}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <div role="tabpanel">
                                            {detailTab === TAB_FUND && (
                                                <FundRequestsTable
                                                    rows={fundRequests}
                                                    loading={detailLoading}
                                                    canApprove={canApproveFund}
                                                    canReject={canRejectFund}
                                                    actionBusyId={actionBusyId}
                                                    onApprove={setApproveTarget}
                                                    onReject={setRejectTarget}
                                                    t={t}
                                                />
                                            )}
                                            {detailTab === TAB_EXPENSES && (
                                                <ExpensesTable
                                                    rows={expenseRecords}
                                                    loading={txLoading}
                                                    t={t}
                                                    canMutate={canMutateTx}
                                                    actionBusyId={actionBusyId}
                                                    onEdit={setEditTxTarget}
                                                    onDelete={setDeleteTxTarget}
                                                />
                                            )}
                                            {detailTab === TAB_TRANSACTIONS && (
                                                <TransactionTable
                                                    rows={transactions}
                                                    loading={txLoading}
                                                    t={t}
                                                    canMutate={canMutateTx}
                                                    actionBusyId={actionBusyId}
                                                    onEdit={setEditTxTarget}
                                                    onDelete={setDeleteTxTarget}
                                                />
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </section>
            </div>

            </>
            )}
        </div>
    );
}
