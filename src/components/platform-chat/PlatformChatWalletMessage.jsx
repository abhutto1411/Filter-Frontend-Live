import { Wallet, Receipt, Link2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { formatCardDateTime } from '../../utils/platformChatDateTime';
import PlatformChatMessageStatus from '../../pages/admin/PlatformChatMessageStatus';
import { pcT } from '../../utils/platformChatI18n';
import '../../styles/admin/PlatformChatWallet.css';

function formatSar(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '0.00';
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parsePayload(m) {
    if (m?.payload && typeof m.payload === 'object') return m.payload;
    if (!m?.content) return null;
    try {
        return JSON.parse(m.content);
    } catch {
        return null;
    }
}

function statusClass(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'approved' || s === 'completed') return 'pc-wallet-status--approved';
    if (s === 'rejected') return 'pc-wallet-status--rejected';
    return 'pc-wallet-status--pending';
}

function statusLabel(status, t) {
    const s = String(status || 'pending').toLowerCase();
    const key = `wallet.status.${s}`;
    const translated = t(key);
    if (translated !== key) return translated;
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function StatusBadge({ status, t }) {
    const s = String(status || 'pending').toLowerCase();
    const Icon = s === 'approved' || s === 'completed'
        ? CheckCircle2
        : s === 'rejected'
            ? XCircle
            : Clock;
    return (
        <span className={`pc-wallet-status ${statusClass(status)}`}>
            <Icon size={12} strokeWidth={2.5} aria-hidden />
            {statusLabel(status, t)}
        </span>
    );
}

function WalletCardDateTime({ createdAt, isSelf, receiptStatus, locale }) {
    if (!createdAt) return null;
    return (
        <div className="pc-wallet-card-datetime">
            <span>{formatCardDateTime(createdAt, locale)}</span>
            {isSelf && (
                <PlatformChatMessageStatus status={receiptStatus || 'sent'} locale={locale} />
            )}
        </div>
    );
}

function isExpenseStatusEvent(p) {
    return p?.kind === 'expense' || Boolean(p?.expenseRequestId);
}

function statusEventTitle(p, approved, t) {
    const isExpense = isExpenseStatusEvent(p);
    if (approved) {
        return isExpense ? t('wallet.expenseApproved') : t('wallet.fundApproved');
    }
    return isExpense ? t('wallet.expenseRejected') : t('wallet.fundRejected');
}

export function isWalletChatMessage(m) {
    return ['wallet_fund_request', 'wallet_status_event', 'wallet_tx_reference', 'wallet_expense_event'].includes(m?.type);
}

export function walletMessagePreview(m, t) {
    const translate = t || ((key, vars) => pcT('en', key, vars));
    const p = parsePayload(m);
    if (m?.type === 'wallet_fund_request' && p) {
        return translate('wallet.preview.fund', {
            currency: p.currencyCode || 'SAR',
            amount: formatSar(p.amount),
        });
    }
    if (m?.type === 'wallet_expense_event' && p) {
        return translate('wallet.preview.expense', { amount: formatSar(p.amount) });
    }
    if (m?.type === 'wallet_status_event' && p) {
        const s = String(p.status || '').toLowerCase();
        const isExpense = isExpenseStatusEvent(p);
        if (s === 'approved') {
            return translate(isExpense ? 'wallet.preview.expenseApproved' : 'wallet.preview.fundApproved', {
                ref: p.requestNumber || '',
            });
        }
        if (s === 'rejected') {
            return translate(isExpense ? 'wallet.preview.expenseRejected' : 'wallet.preview.fundRejected', {
                ref: p.requestNumber || '',
            });
        }
    }
    if (m?.type === 'wallet_tx_reference' && p) {
        return translate('wallet.preview.ref', {
            ref: p.reference || translate('wallet.preview.item'),
        });
    }
    return m?.content || '';
}

export function PlatformChatWalletMessage({
    message,
    currentUserId = '',
    canApproveFund,
    canRejectFund,
    canApproveExpense,
    canRejectExpense,
    actionBusy,
    onApprove,
    onReject,
    locale = 'en',
    t: tProp,
}) {
    const t = tProp || ((key, vars) => pcT(locale, key, vars));
    const p = parsePayload(message);
    if (!p) {
        return <span className="platform-chat-bubble-text">{t('wallet.fallback')}</span>;
    }

    const isWalletPeerFund =
        message.type === 'wallet_fund_request'
        && p.fundSourceType === 'wallet'
        && p.sourceUserId;
    const isPeerApprover =
        isWalletPeerFund
        && currentUserId
        && String(p.sourceUserId) === String(currentUserId);
    const effectiveCanApproveFund = canApproveFund || isPeerApprover;
    const effectiveCanRejectFund = canRejectFund || isPeerApprover;

    if (message.type === 'wallet_fund_request') {
        const status = String(p.status || 'pending').toLowerCase();
        const isPending = status === 'pending';
        return (
            <div className={`pc-wallet-card pc-wallet-card--fund pc-wallet-card--${status}`}>
                <div className="pc-wallet-card-head">
                    <div className="pc-wallet-card-head-icon" aria-hidden>
                        <Wallet size={18} strokeWidth={2.25} />
                    </div>
                    <div className="pc-wallet-card-head-text">
                        <div className="pc-wallet-card-title">{t('wallet.fundRequest')}</div>
                        <div className="pc-wallet-card-ref">{p.requestNumber}</div>
                    </div>
                    <StatusBadge status={status} t={t} />
                </div>
                <div className="pc-wallet-card-body">
                    <div className="pc-wallet-card-amount">
                        <span className="pc-wallet-card-amount-label">{t('wallet.requestedAmount')}</span>
                        <span className="pc-wallet-card-amount-value">
                            <span className="pc-wallet-card-currency">{p.currencyCode || 'SAR'}</span>
                            {formatSar(p.amount)}
                        </span>
                    </div>
                    {p.purpose && (
                        <div className="pc-wallet-card-detail">
                            <span className="pc-wallet-card-detail-label">{t('wallet.purpose')}</span>
                            <p className="pc-wallet-card-detail-value">{p.purpose}</p>
                        </div>
                    )}
                    {(p.workshopName || p.branchName) && (
                        <div className="pc-wallet-card-detail">
                            <span className="pc-wallet-card-detail-label">{t('wallet.workshopBranch')}</span>
                            <p className="pc-wallet-card-detail-value">
                                {[p.workshopName, p.branchName].filter(Boolean).join(' · ')}
                            </p>
                        </div>
                    )}
                    {isWalletPeerFund && (
                        <div className="pc-wallet-card-detail">
                            <span className="pc-wallet-card-detail-label">{t('wallet.walletRequest')}</span>
                            <p className="pc-wallet-card-detail-value">
                                {p.requesterName
                                    ? t('wallet.requestedFromWallet', { name: p.requesterName })
                                    : t('wallet.intraTransfer')}
                            </p>
                        </div>
                    )}
                    {!isPending && p.balanceAfter != null && (
                        <div className="pc-wallet-card-meta">
                            {t('wallet.balanceAfter', { amount: formatSar(p.balanceAfter) })}
                        </div>
                    )}
                    <WalletCardDateTime
                        createdAt={message.createdAt}
                        isSelf={message.isSelf}
                        receiptStatus={message.receiptStatus}
                        locale={locale}
                    />
                </div>
                {isPending && !message.isSelf && (effectiveCanApproveFund || effectiveCanRejectFund) && (
                    <div className="pc-wallet-card-actions-bar">
                        {effectiveCanRejectFund && (
                            <button
                                type="button"
                                className="pc-wallet-btn pc-wallet-btn--reject"
                                disabled={actionBusy}
                                onClick={() => onReject?.(message, p)}
                            >
                                {t('wallet.reject')}
                            </button>
                        )}
                        {effectiveCanApproveFund && (
                            <button
                                type="button"
                                className="pc-wallet-btn pc-wallet-btn--approve"
                                disabled={actionBusy}
                                onClick={() => onApprove?.(message, p)}
                            >
                                {t('wallet.approve')}
                            </button>
                        )}
                    </div>
                )}
            </div>
        );
    }

    if (message.type === 'wallet_status_event') {
        const status = String(p.status || '').toLowerCase();
        const approved = status === 'approved';
        const isExpense = isExpenseStatusEvent(p);
        const isTransferOut = p.transferDirection === 'out';
        return (
            <div className={`pc-wallet-card pc-wallet-card--status ${approved ? 'is-approved' : 'is-rejected'}${isExpense ? ' pc-wallet-card--status-expense' : ''}`}>
                <div className="pc-wallet-card-status-banner">
                    {approved ? (
                        <CheckCircle2 size={18} strokeWidth={2.25} aria-hidden />
                    ) : (
                        <XCircle size={18} strokeWidth={2.25} aria-hidden />
                    )}
                    <span>
                        {isTransferOut
                            ? t('wallet.debitedTransfer')
                            : statusEventTitle(p, approved, t)}
                    </span>
                </div>
                <div className="pc-wallet-card-ref">{p.requestNumber}</div>
                <div className="pc-wallet-card-amount pc-wallet-card-amount--compact">
                    <span className="pc-wallet-card-amount-label">{isExpense ? t('wallet.amountDebited') : t('wallet.amount')}</span>
                    <span className="pc-wallet-card-amount-value">
                        <span className="pc-wallet-card-currency">{p.currencyCode || 'SAR'}</span>
                        {formatSar(p.amount)}
                    </span>
                </div>
                {approved && !isExpense && p.sourceAccountName && !isTransferOut && (
                    <div className="pc-wallet-card-meta">{t('wallet.fundedFrom', { name: p.sourceAccountName })}</div>
                )}
                {isTransferOut && (
                    <div className="pc-wallet-card-meta">
                        {t('wallet.transferredTo', {
                            amount: formatSar(p.amount),
                            name: p.requesterName || t('wallet.recipient'),
                        })}
                        {p.approvedByName ? t('wallet.approvedBy', { name: p.approvedByName }) : ''}
                    </div>
                )}
                {approved && p.balanceAfter != null && (
                    <div className="pc-wallet-card-meta">
                        {t('wallet.balanceAfter', { amount: formatSar(p.balanceAfter) })}
                    </div>
                )}
                {!approved && p.rejectionReason && (
                    <div className="pc-wallet-card-meta pc-wallet-card-meta--reason">{p.rejectionReason}</div>
                )}
                <WalletCardDateTime
                    createdAt={message.createdAt}
                    isSelf={message.isSelf}
                    receiptStatus={message.receiptStatus}
                    locale={locale}
                />
            </div>
        );
    }

    if (message.type === 'wallet_tx_reference') {
        const typeLabel = String(p.rowType || 'item').replace(/_/g, ' ');
        return (
            <div className="pc-wallet-card pc-wallet-card--ref">
                <div className="pc-wallet-card-head pc-wallet-card-head--ref">
                    <div className="pc-wallet-card-head-icon pc-wallet-card-head-icon--ref" aria-hidden>
                        <Link2 size={18} strokeWidth={2.25} />
                    </div>
                    <div className="pc-wallet-card-head-text">
                        <div className="pc-wallet-card-title">{typeLabel}</div>
                        {p.reference && <div className="pc-wallet-card-ref">{p.reference}</div>}
                    </div>
                    {p.status && <StatusBadge status={p.status} t={t} />}
                </div>
                <div className="pc-wallet-card-body">
                    {p.amount != null && (
                        <div className="pc-wallet-card-amount pc-wallet-card-amount--compact">
                            <span className="pc-wallet-card-amount-label">{t('wallet.amount')}</span>
                            <span className="pc-wallet-card-amount-value">
                                <span className="pc-wallet-card-currency">SAR</span>
                                {formatSar(p.amount)}
                            </span>
                        </div>
                    )}
                    {p.description && (
                        <div className="pc-wallet-card-detail">
                            <span className="pc-wallet-card-detail-label">{t('wallet.details')}</span>
                            <p className="pc-wallet-card-detail-value">{p.description}</p>
                        </div>
                    )}
                    <WalletCardDateTime
                        createdAt={message.createdAt}
                        isSelf={message.isSelf}
                        receiptStatus={message.receiptStatus}
                        locale={locale}
                    />
                </div>
            </div>
        );
    }

    if (message.type === 'wallet_expense_event') {
        const status = String(p.status || 'pending').toLowerCase();
        const isPending = status === 'pending';
        const canApprove = canApproveExpense;
        const canReject = canRejectExpense;
        return (
            <div className={`pc-wallet-card pc-wallet-card--expense pc-wallet-card--${status}`}>
                <div className="pc-wallet-card-head pc-wallet-card-head--expense">
                    <div className="pc-wallet-card-head-icon pc-wallet-card-head-icon--expense" aria-hidden>
                        <Receipt size={18} strokeWidth={2.25} />
                    </div>
                    <div className="pc-wallet-card-head-text">
                        <div className="pc-wallet-card-title">{isPending ? t('wallet.expenseRequest') : t('wallet.expenseRecorded')}</div>
                        {(p.requestNumber || p.referenceId) && (
                            <div className="pc-wallet-card-ref">{p.requestNumber || p.referenceId}</div>
                        )}
                    </div>
                    <StatusBadge status={status} t={t} />
                </div>
                <div className="pc-wallet-card-body">
                    <div className="pc-wallet-card-amount pc-wallet-card-amount--expense">
                        <span className="pc-wallet-card-amount-label">{isPending ? t('wallet.requestedAmount') : t('wallet.amountDebited')}</span>
                        <span className="pc-wallet-card-amount-value">
                            <span className="pc-wallet-card-currency">{p.currencyCode || 'SAR'}</span>
                            {formatSar(p.amount)}
                        </span>
                    </div>
                    {p.description && (
                        <div className="pc-wallet-card-detail">
                            <span className="pc-wallet-card-detail-label">{t('wallet.description')}</span>
                            <p className="pc-wallet-card-detail-value">{p.description}</p>
                        </div>
                    )}
                    {(p.workshopName || p.branchName) && (
                        <div className="pc-wallet-card-detail">
                            <span className="pc-wallet-card-detail-label">{t('wallet.workshopBranch')}</span>
                            <p className="pc-wallet-card-detail-value">
                                {[p.workshopName, p.branchName].filter(Boolean).join(' · ')}
                            </p>
                        </div>
                    )}
                    {!isPending && p.balanceAfter != null && (
                        <div className="pc-wallet-card-meta">
                            {t('wallet.balanceAfter', { amount: formatSar(p.balanceAfter) })}
                        </div>
                    )}
                    <WalletCardDateTime
                        createdAt={message.createdAt}
                        isSelf={message.isSelf}
                        receiptStatus={message.receiptStatus}
                        locale={locale}
                    />
                </div>
                {isPending && !message.isSelf && (canApprove || canReject) && (
                    <div className="pc-wallet-card-actions-bar">
                        {canReject && (
                            <button
                                type="button"
                                className="pc-wallet-btn pc-wallet-btn--reject"
                                disabled={actionBusy}
                                onClick={() => onReject?.(message, p)}
                            >
                                {t('wallet.reject')}
                            </button>
                        )}
                        {canApprove && (
                            <button
                                type="button"
                                className="pc-wallet-btn pc-wallet-btn--approve"
                                disabled={actionBusy}
                                onClick={() => onApprove?.(message, p)}
                            >
                                {t('wallet.approve')}
                            </button>
                        )}
                    </div>
                )}
            </div>
        );
    }

    return null;
}

export { formatSar, parsePayload };
