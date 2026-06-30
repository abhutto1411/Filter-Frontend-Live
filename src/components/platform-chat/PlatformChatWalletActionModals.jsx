import React, { useEffect, useState } from 'react';
import { Loader2, Check, X } from 'lucide-react';
import Modal from '../Modal';
import WalletApprovalAccountFields from '../admin/WalletApprovalAccountFields';
import { formatSar } from './PlatformChatWalletMessage';
import '../../styles/admin/PlatformChatWallet.css';

function isExpenseTarget(target) {
    return target?.message?.type === 'wallet_expense_event';
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

    const approveIsExpense = isExpenseTarget(approveTarget);
    const rejectIsExpense = isExpenseTarget(rejectTarget);

    useEffect(() => {
        if (!approveTarget) return;
        setApproveRemarks('');
        setApproveError('');
    }, [approveTarget]);

    useEffect(() => {
        if (!rejectTarget) return;
        setRejectReason('');
    }, [rejectTarget]);

    const confirmApprove = async () => {
        if (!approveTarget?.message?.id || acct.blocked) return;
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
            } else {
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

    const approveDisplayError = approveError || acct.blockReason || '';
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
                                disabled={busy || acct.blocked}
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
                        Approve <strong>{approveTarget.payload?.requestNumber}</strong> for{' '}
                        <strong>SAR {formatSar(approveTarget.payload?.amount)}</strong>
                    </p>

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

                    <WalletApprovalAccountFields
                        workshopId={approveTarget?.payload?.workshopId != null ? String(approveTarget.payload.workshopId) : ''}
                        branchId={approveTarget?.payload?.branchId != null ? String(approveTarget.payload.branchId) : ''}
                        amount={approveTarget?.payload?.amount}
                        mode={approveIsExpense ? 'expense' : 'fund'}
                        showBudget={approveIsExpense}
                        busy={busy}
                        requesterUserId={
                            approveIsExpense
                                ? String(approveTarget?.payload?.userId ?? '')
                                : ''
                        }
                        requesterName={approveTarget?.payload?.requesterName ?? ''}
                        expenseRequestId={
                            approveIsExpense
                                ? String(approveTarget?.payload?.expenseRequestId ?? '')
                                : ''
                        }
                        currencyCode={approveTarget?.payload?.currencyCode ?? 'SAR'}
                        onChange={setAcct}
                    />

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
