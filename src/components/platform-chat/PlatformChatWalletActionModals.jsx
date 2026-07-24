import React, { useEffect, useState } from 'react';
import { Loader2, Check, X } from 'lucide-react';
import Modal from '../Modal';
import WalletApprovalAccountFields from '../admin/WalletApprovalAccountFields';
import { getRequesterWalletBalance, listAdminWallets } from '../../services/adminWalletApi';
import { formatSar } from './PlatformChatWalletMessage';
import '../../styles/admin/PlatformChatWallet.css';

function isExpenseTarget(target) {
    return target?.message?.type === 'wallet_expense_event';
}

function formatBalance(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '0.00';
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PlatformChatWalletActionModals({
    api,
    approveTarget,
    rejectTarget,
    onCloseApprove,
    onCloseReject,
    onApproveDone,
    onRejectDone,
    onError,
}) {
    const [busy, setBusy] = useState(false);
    const [acct, setAcct] = useState({ blocked: true, loading: true });
    const [approveRemarks, setApproveRemarks] = useState('');
    const [rejectReason, setRejectReason] = useState('');
    const [approveError, setApproveError] = useState('');
    const [fundSourceType, setFundSourceType] = useState('external');
    const [walletUsers, setWalletUsers] = useState([]);
    const [walletUsersLoading, setWalletUsersLoading] = useState(false);
    const [sourceUserId, setSourceUserId] = useState('');
    const [sourceUserBalance, setSourceUserBalance] = useState(null);

    const approveIsExpense = isExpenseTarget(approveTarget);
    const rejectIsExpense = isExpenseTarget(rejectTarget);
    const payload = approveTarget?.payload ?? {};
    const lockedWalletPeer =
        !approveIsExpense
        && payload.fundSourceType === 'wallet'
        && payload.sourceUserId;
    const requesterUserId = payload.requesterUserId ?? '';
    const requesterName = payload.requesterName || 'Requester';
    const amt = Number(payload.amount ?? 0);

    useEffect(() => {
        if (!approveTarget) return;
        setApproveRemarks('');
        setApproveError('');
        setFundSourceType(lockedWalletPeer ? 'wallet' : 'external');
        setSourceUserId(payload.sourceUserId ?? '');
        setSourceUserBalance(null);
    }, [approveTarget, lockedWalletPeer, payload.sourceUserId]);

    useEffect(() => {
        if (!rejectTarget) return;
        setRejectReason('');
    }, [rejectTarget]);

    useEffect(() => {
        if (!approveTarget || approveIsExpense || fundSourceType !== 'wallet' || lockedWalletPeer) {
            return undefined;
        }
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
    }, [approveTarget, approveIsExpense, fundSourceType, lockedWalletPeer, requesterUserId]);

    useEffect(() => {
        const userId = lockedWalletPeer ? payload.sourceUserId : sourceUserId;
        if (!approveTarget || approveIsExpense || fundSourceType !== 'wallet' || !userId) {
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
    }, [
        approveTarget,
        approveIsExpense,
        fundSourceType,
        sourceUserId,
        lockedWalletPeer,
        payload.sourceUserId,
    ]);

    const walletBlocked = !approveIsExpense && fundSourceType === 'wallet' && (
        walletUsersLoading
        || !(lockedWalletPeer ? payload.sourceUserId : sourceUserId)
        || (sourceUserBalance != null && amt > 0 && sourceUserBalance < amt)
    );
    const walletBlockReason = !approveIsExpense && fundSourceType === 'wallet'
        ? (walletUsersLoading
            ? 'Loading wallet users…'
            : !(lockedWalletPeer ? payload.sourceUserId : sourceUserId)
                ? 'Select a source wallet user.'
                : (sourceUserBalance != null && amt > 0 && sourceUserBalance < amt)
                    ? `Insufficient balance in source wallet (SAR ${formatBalance(sourceUserBalance)}).`
                    : '')
        : '';

    const confirmApprove = async () => {
        if (!approveTarget?.message?.id) return;
        if (approveIsExpense) {
            if (acct.blocked) return;
        } else if (fundSourceType === 'wallet') {
            if (walletBlocked) return;
        } else if (acct.blocked) {
            return;
        }
        setApproveError('');
        setBusy(true);
        try {
            const body = {
                remarks: approveRemarks.trim() || undefined,
            };
            if (approveIsExpense) {
                body.budgetAccountId = acct.budgetAccountId;
                body.budgetAccountName = acct.budgetAccountName;
                if (acct.paymentSource !== 'wallet' && acct.sourceAccountId) {
                    body.sourceAccountId = acct.sourceAccountId;
                    body.sourceAccountName = acct.sourceAccountName;
                }
            } else if (fundSourceType === 'wallet') {
                body.fundSourceType = 'wallet';
                body.sourceUserId = lockedWalletPeer
                    ? payload.sourceUserId
                    : sourceUserId;
            } else {
                body.fundSourceType = 'external';
                body.sourceAccountId = acct.sourceAccountId;
                body.sourceAccountName = acct.sourceAccountName;
            }
            const res = approveIsExpense
                ? await api.approveWalletExpenseRequestMessage(approveTarget.message.id, body)
                : await api.approveWalletFundRequestMessage(approveTarget.message.id, body);
            onApproveDone?.(res);
            onCloseApprove();
        } catch (err) {
            const message = err?.message || 'Could not approve request';
            setApproveError(message);
            onError?.(message);
        } finally {
            setBusy(false);
        }
    };

    const confirmReject = async () => {
        if (!rejectTarget?.message?.id || !rejectReason.trim()) return;
        setBusy(true);
        try {
            const body = { reason: rejectReason.trim() };
            const res = rejectIsExpense
                ? await api.rejectWalletExpenseRequestMessage(rejectTarget.message.id, body)
                : await api.rejectWalletFundRequestMessage(rejectTarget.message.id, body);
            onRejectDone?.(res);
            onCloseReject();
        } catch (err) {
            onError?.(err?.message || 'Could not reject request');
        } finally {
            setBusy(false);
        }
    };

    const approveDisplayError = approveError || walletBlockReason || (
        !approveIsExpense && fundSourceType === 'wallet' ? '' : acct.blockReason
    ) || '';
    const approveConfirmBlocked = busy || (
        approveIsExpense
            ? acct.blocked
            : fundSourceType === 'wallet'
                ? walletBlocked
                : acct.blocked
    );
    const proofUrl = approveTarget?.payload?.proofUrl ?? '';

    return (
        <>
            {approveTarget && (
                <Modal
                    title={approveIsExpense ? 'Approve expense request' : 'Approve fund request'}
                    onClose={busy ? undefined : onCloseApprove}
                    width={500}
                    disableClose={busy}
                    footer={(
                        <>
                            <button type="button" className="pc-wallet-modal-cancel" disabled={busy} onClick={onCloseApprove}>
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="pc-wallet-modal-primary"
                                disabled={approveConfirmBlocked}
                                onClick={confirmApprove}
                            >
                                {busy ? <Loader2 size={14} className="spin" /> : <Check size={16} />}
                                Approve
                            </button>
                        </>
                    )}
                >
                    {approveDisplayError ? (
                        <div className="pc-wallet-modal-error" role="alert">
                            {approveDisplayError}
                        </div>
                    ) : null}
                    <p className="pc-wallet-modal-lead">
                        Approve <strong>{payload.requestNumber}</strong> for{' '}
                        <strong>SAR {formatSar(payload.amount)}</strong>
                        {!approveIsExpense && fundSourceType === 'wallet'
                            ? <> — credit <strong>{requesterName}</strong>&apos;s wallet from another admin wallet.</>
                            : null}
                    </p>

                    {!approveIsExpense && !lockedWalletPeer ? (
                        <div style={{ marginBottom: 12 }}>
                            <span className="pc-wallet-field-label">Funding source</span>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                                <button
                                    type="button"
                                    className={fundSourceType === 'external' ? 'pc-wallet-modal-primary' : 'pc-wallet-modal-cancel'}
                                    disabled={busy}
                                    onClick={() => setFundSourceType('external')}
                                >
                                    Cash / Bank
                                </button>
                                <button
                                    type="button"
                                    className={fundSourceType === 'wallet' ? 'pc-wallet-modal-primary' : 'pc-wallet-modal-cancel'}
                                    disabled={busy}
                                    onClick={() => setFundSourceType('wallet')}
                                >
                                    Deduct from another wallet
                                </button>
                            </div>
                        </div>
                    ) : null}

                    {!approveIsExpense && fundSourceType === 'wallet' ? (
                        <div
                            style={{
                                marginBottom: 12,
                                padding: '12px 14px',
                                borderRadius: 10,
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                fontSize: '0.875rem',
                            }}
                        >
                            {lockedWalletPeer ? (
                                <>
                                    <p style={{ margin: '0 0 6px' }}>
                                        <strong>From your wallet</strong>
                                    </p>
                                    <p style={{ margin: '0 0 6px' }}>
                                        <strong>To:</strong> {requesterName}
                                    </p>
                                    <p style={{ margin: 0, color: '#64748b' }}>
                                        This will debit your wallet and credit the requester. GL posts between employee petty cash funds.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <p style={{ margin: '0 0 8px', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                                        Wallet transfer
                                    </p>
                                    <p style={{ margin: '0 0 6px' }}>
                                        <strong>From wallet:</strong>{' '}
                                        <select
                                            className="pc-wallet-field"
                                            style={{ marginTop: 6, width: '100%' }}
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
                                                        ? ` — SAR ${formatBalance(u.wallet.balance)}`
                                                        : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </p>
                                    <p style={{ margin: 0, fontSize: '0.875rem' }}>
                                        <strong>To wallet:</strong> {requesterName}
                                    </p>
                                    {sourceUserBalance != null ? (
                                        <p style={{ margin: '8px 0 0', fontSize: '0.8125rem', color: '#64748b' }}>
                                            Source balance after transfer: SAR {formatBalance(Math.max(0, sourceUserBalance - amt))}
                                        </p>
                                    ) : null}
                                </>
                            )}
                        </div>
                    ) : null}

                    {approveIsExpense && proofUrl ? (
                        <div style={{ marginBottom: 12 }}>
                            <span className="pc-wallet-field-label">Expense proof</span>
                            <a href={proofUrl} target="_blank" rel="noopener noreferrer">
                                <img
                                    src={proofUrl}
                                    alt="Expense proof"
                                    style={{ maxWidth: '100%', maxHeight: 160, borderRadius: 8, marginTop: 6 }}
                                />
                            </a>
                        </div>
                    ) : null}

                    {(approveIsExpense || fundSourceType === 'external') ? (
                        <WalletApprovalAccountFields
                            workshopId={payload.workshopId != null ? String(payload.workshopId) : ''}
                            branchId={payload.branchId != null ? String(payload.branchId) : ''}
                            amount={payload.amount}
                            mode={approveIsExpense ? 'expense' : 'fund'}
                            showBudget={approveIsExpense}
                            busy={busy}
                            requesterUserId={
                                approveIsExpense
                                    ? String(payload.userId ?? '')
                                    : ''
                            }
                            requesterName={payload.requesterName ?? ''}
                            expenseRequestId={
                                approveIsExpense
                                    ? String(payload.expenseRequestId ?? '')
                                    : ''
                            }
                            currencyCode={payload.currencyCode ?? 'SAR'}
                            onChange={setAcct}
                        />
                    ) : null}

                    <label className="pc-wallet-field-label">Remarks (optional)</label>
                    <textarea
                        className="pc-wallet-field"
                        rows={2}
                        value={approveRemarks}
                        onChange={(e) => setApproveRemarks(e.target.value)}
                    />
                </Modal>
            )}

            {rejectTarget && (
                <Modal
                    title={rejectIsExpense ? 'Reject expense request' : 'Reject fund request'}
                    onClose={busy ? undefined : onCloseReject}
                    width={440}
                    disableClose={busy}
                    footer={(
                        <>
                            <button type="button" className="pc-wallet-modal-cancel" disabled={busy} onClick={onCloseReject}>
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="pc-wallet-modal-danger"
                                disabled={busy || !rejectReason.trim()}
                                onClick={confirmReject}
                            >
                                {busy ? <Loader2 size={14} className="spin" /> : <X size={16} />}
                                Reject
                            </button>
                        </>
                    )}
                >
                    <label className="pc-wallet-field-label">Reason *</label>
                    <textarea
                        className="pc-wallet-field"
                        rows={3}
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Why is this being rejected?"
                    />
                </Modal>
            )}
        </>
    );
}
