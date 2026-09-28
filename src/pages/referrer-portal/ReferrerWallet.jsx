import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { CheckCircle2, CreditCard, Wallet, TrendingUp } from 'lucide-react';
import PayoutModal from '../../components/PayoutModal';
import { rfT, rfStatusKey } from '../../utils/referrerPortalI18n';
import { referrerWalletFromOverview, rfBadgeClass, useReferrerPortal } from './useReferrerPortal';
import { referrerPortalCreatePayout } from '../../services/referrerPortalApi';

export default function ReferrerWallet() {
    const { locale, overview, reloadOverview, isCommunity, overviewLoading } = useReferrerPortal();
    if (!overviewLoading && isCommunity) {
        return <Navigate to="/referrer-portal/dashboard" replace />;
    }
    const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
    const [payoutAmount, setPayoutAmount] = useState('');
    const [payoutError, setPayoutError] = useState('');
    const [payoutSubmitting, setPayoutSubmitting] = useState(false);
    const [payoutSuccess, setPayoutSuccess] = useState('');

    const payouts = Array.isArray(overview?.payouts) ? overview.payouts : [];
    const iban = overview?.profile?.iban || '';
    const { unpaid, pending: pendingTotal, paid: paidTotal, earned: earnedTotal } =
        referrerWalletFromOverview(overview);

    const submitPayout = async () => {
        const amount = Number(payoutAmount);
        if (!Number.isFinite(amount) || amount <= 0) {
            setPayoutError(rfT(locale, 'payout.amountRequired'));
            return;
        }
        if (amount > unpaid + 0.005) {
            setPayoutError(rfT(locale, 'payout.exceedsBalance', { amount: unpaid.toFixed(2) }));
            return;
        }
        setPayoutSubmitting(true);
        setPayoutError('');
        try {
            await referrerPortalCreatePayout({ amount, method: 'bank' });
            setIsPayoutModalOpen(false);
            setPayoutAmount('');
            setPayoutSuccess(rfT(locale, 'payout.success'));
            await reloadOverview?.();
        } catch (err) {
            setPayoutError(err?.message || rfT(locale, 'payout.error'));
        } finally {
            setPayoutSubmitting(false);
        }
    };

    return (
        <div className="rf-page">
            <PayoutModal
                isOpen={isPayoutModalOpen}
                onClose={() => setIsPayoutModalOpen(false)}
                balance={unpaid.toFixed(2)}
                iban={iban}
                locale={locale}
                amount={payoutAmount}
                onAmountChange={setPayoutAmount}
                onSubmit={submitPayout}
                submitting={payoutSubmitting}
                error={payoutError}
            />
            <p className="rf-page-lead">{rfT(locale, 'wallet.subtitle')}</p>
            {payoutSuccess ? <p className="rf-page-lead">{payoutSuccess}</p> : null}

            <div className="rf-wallet-grid rf-wallet-grid-4">
                <div className="rf-stat-card">
                    <div className="rf-stat-header">
                        <div className="rf-stat-icon is-green">
                            <Wallet size={20} />
                        </div>
                        <span className="rf-stat-unit">SAR</span>
                    </div>
                    <p className="rf-stat-value">{unpaid.toFixed(2)}</p>
                    <p className="rf-stat-label">{rfT(locale, 'wallet.unpaid')}</p>
                </div>
                <div className="rf-stat-card">
                    <div className="rf-stat-header">
                        <div className="rf-stat-icon is-amber">
                            <TrendingUp size={20} />
                        </div>
                        <span className="rf-stat-unit">SAR</span>
                    </div>
                    <p className="rf-stat-value">{pendingTotal.toFixed(2)}</p>
                    <p className="rf-stat-label">{rfT(locale, 'wallet.pending')}</p>
                </div>
                <div className="rf-stat-card">
                    <div className="rf-stat-header">
                        <div className="rf-stat-icon is-green">
                            <CheckCircle2 size={20} />
                        </div>
                        <span className="rf-stat-unit">SAR</span>
                    </div>
                    <p className="rf-stat-value">{paidTotal.toFixed(2)}</p>
                    <p className="rf-stat-label">{rfT(locale, 'wallet.paid')}</p>
                </div>
                <div className="rf-stat-card">
                    <div className="rf-stat-header">
                        <div className="rf-stat-icon">
                            <TrendingUp size={20} />
                        </div>
                        <span className="rf-stat-unit">SAR</span>
                    </div>
                    <p className="rf-stat-value">{earnedTotal.toFixed(2)}</p>
                    <p className="rf-stat-label">{rfT(locale, 'wallet.total')}</p>
                </div>
            </div>

            <div className="rf-actions-bar">
                <button
                    type="button"
                    className="rf-btn-primary"
                    disabled={unpaid <= 0}
                    onClick={() => {
                        setPayoutError('');
                        setIsPayoutModalOpen(true);
                    }}
                >
                    <CreditCard size={16} />
                    {rfT(locale, 'wallet.request')}
                </button>
            </div>

            <div className="rf-card">
                <div className="rf-card-header">
                    <h3 className="rf-card-title">{rfT(locale, 'wallet.payoutHistory')}</h3>
                </div>
                <div className="rf-table-container">
                    <table className="rf-table">
                        <thead>
                            <tr>
                                <th>{rfT(locale, 'table.date')}</th>
                                <th className="rf-num">{rfT(locale, 'table.amount')}</th>
                                <th>{rfT(locale, 'table.status')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payouts.length === 0 ? (
                                <tr>
                                    <td colSpan="3">{rfT(locale, 'wallet.emptyPayouts')}</td>
                                </tr>
                            ) : (
                                payouts.map((p) => (
                                    <tr key={p.id}>
                                        <td className="rf-muted">
                                            {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '—'}
                                        </td>
                                        <td className="rf-num">{Number(p.amount || 0).toFixed(2)}</td>
                                        <td>
                                            <span className={rfBadgeClass(p.status)}>
                                                {rfT(locale, rfStatusKey(p.status) || p.status)}
                                            </span>
                                            {String(p.status).toLowerCase() === 'rejected' && p.rejectionReason ? (
                                                <div className="rf-muted">{rfT(locale, 'wallet.rejectedReason', { reason: p.rejectionReason })}</div>
                                            ) : null}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
