import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Wallet, RefreshCw, Clock, MessageSquare } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
    getMyPettyCash,
    getMyExpenseRequests,
} from '../../services/employeeExpenseApi';
import WorkshopPettyCashManagement from './WorkshopPettyCashManagement';
import PettyCashRecordForms from './PettyCashRecordForms';
import { StatusBadge, MessageThread, formatSar, WalletTransactionsTable } from './WorkshopMyPettyCash.shared';
import ExpenseProofThumbnail from '../../components/accounting/ExpenseProofThumbnail';
import { wpcT } from '../../utils/workshopPettyCashI18n';
import '../../styles/admin/AccountingPage.css';

const EMPTY_BRANCHES = [];

function WorkshopMyPettyCashStaff({
    workshopId: workshopIdProp = null,
    defaultBranchId = '',
    locale: localeProp,
}) {
    const locale = localeProp || (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) || 'en';
    const t = useCallback((key, vars) => wpcT(locale, key, vars), [locale]);
    const { user, workshop } = useAuth();

    const scopeQuery = useMemo(() => {
        const wid = workshopIdProp || user?.workshopId || workshop?.id;
        return wid ? { workshopId: String(wid) } : {};
    }, [workshopIdProp, user?.workshopId, workshop?.id]);

    const [wallet, setWallet] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [openThread, setOpenThread] = useState(null);

    const loadAll = useCallback(async () => {
        if (!scopeQuery.workshopId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        setError('');
        try {
            const [walletRes, reqRes] = await Promise.all([
                getMyPettyCash({ limit: 50, ...scopeQuery }),
                getMyExpenseRequests({ limit: 50, ...scopeQuery }),
            ]);
            setWallet(walletRes?.wallet ?? null);
            setTransactions(walletRes?.transactions ?? []);
            setRequests(reqRes?.items ?? []);
        } catch (e) {
            setError(e?.message || t('err.load'));
        } finally {
            setLoading(false);
        }
    }, [scopeQuery, t]);

    useEffect(() => { void loadAll(); }, [loadAll]);

    const summary = useMemo(() => {
        const pendingTotal = requests.filter((r) => r.status === 'pending')
            .reduce((s, r) => s + Number(r.amount || 0), 0);
        return {
            pendingTotal,
            pendingCount: requests.filter((r) => r.status === 'pending').length,
        };
    }, [requests]);

    return (
        <div className="accounting-page module-container">
            <header className="cash-bank-header">
                <h2 className="cash-bank-title">{t('page.title')}</h2>
                <p className="cash-bank-desc">{t('page.desc')}</p>
            </header>

            {error ? (
                <p className="form-help-text" style={{ color: '#B45309', marginBottom: 12 }}>{error}</p>
            ) : null}

            <PettyCashRecordForms
                workshopId={workshopIdProp}
                defaultBranchId={defaultBranchId}
                onSubmitted={loadAll}
                locale={locale}
            />

            <div className="cash-bank-stats">
                <div className="cash-bank-stat-card">
                    <div className="cash-bank-stat-icon"><Wallet size={24} /></div>
                    <div>
                        <p className="cash-bank-stat-label">{t('stat.walletBalance')}</p>
                        <p className="cash-bank-stat-value">{t('money.sar', { amount: formatSar(wallet?.currentBalance ?? 0) })}</p>
                        <p className="cash-bank-stat-meta">
                            {t('stat.walletMeta', {
                                code: wallet?.coaAccount?.code ?? t('emDash'),
                                name: wallet?.name ?? t('stat.walletDefaultName'),
                            })}
                        </p>
                    </div>
                </div>
                <div className="cash-bank-stat-card">
                    <div className="cash-bank-stat-icon"><Clock size={24} /></div>
                    <div>
                        <p className="cash-bank-stat-label">{t('stat.pendingRequests')}</p>
                        <p className="cash-bank-stat-value">{t('money.sar', { amount: formatSar(summary.pendingTotal) })}</p>
                        <p className="cash-bank-stat-meta">{t('stat.awaitingApproval', { count: summary.pendingCount })}</p>
                    </div>
                </div>
            </div>

            <div style={{ marginBottom: 16 }}>
                <button
                    type="button"
                    className="btn-portal-outline"
                    onClick={loadAll}
                    disabled={loading}
                >
                    <RefreshCw size={16} style={{ marginRight: 6 }} /> {t('btn.refresh')}
                </button>
            </div>

            {openThread ? (
                <MessageThread requestId={openThread} onClose={() => setOpenThread(null)} t={t} locale={locale} />
            ) : null}

            <section className="premium-table cash-bank-table">
                <header style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0' }}>
                    <strong>{t('section.myRequests')}</strong>
                </header>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">{t('th.date')}</th>
                            <th className="table-th">{t('th.type')}</th>
                            <th className="table-th">{t('th.category')}</th>
                            <th className="table-th">{t('th.branch')}</th>
                            <th className="table-th">{t('th.amount')}</th>
                            <th className="table-th">{t('th.status')}</th>
                            <th className="table-th">{t('th.proof')}</th>
                            <th className="table-th">{t('th.notes')}</th>
                            <th className="table-th">{t('th.actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={9} className="table-cell table-empty">{t('loading')}</td></tr>
                        ) : requests.length === 0 ? (
                            <tr><td colSpan={9} className="table-cell table-empty">{t('empty.requests')}</td></tr>
                        ) : requests.map((r) => (
                            <tr key={r.id}>
                                <td className="table-cell">{new Date(r.createdAt).toLocaleDateString()}</td>
                                <td className="table-cell">{r.kind === 'fund_request' ? t('kind.fundTopUp') : t('kind.expense')}</td>
                                <td className="table-cell">{r.category?.name ?? t('emDash')}</td>
                                <td className="table-cell">{r.branch?.name ?? t('emDash')}</td>
                                <td className="table-cell">{t('money.sar', { amount: formatSar(r.amount) })}</td>
                                <td className="table-cell"><StatusBadge status={r.status} t={t} /></td>
                                <td className="table-cell">
                                    {r.kind === 'expense' ? (
                                        <ExpenseProofThumbnail proofUrl={r.proofUrl} size={36} />
                                    ) : t('emDash')}
                                </td>
                                <td className="table-cell" style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {r.rejectionReason || r.description || t('emDash')}
                                </td>
                                <td className="table-cell">
                                    <button type="button" className="btn-edit-zone" onClick={() => setOpenThread(r.id)}>
                                        <MessageSquare size={14} /> {r.messageCount > 0 ? `(${r.messageCount})` : ''}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>

            <section className="premium-table cash-bank-table" style={{ marginTop: 16 }}>
                <header style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0' }}>
                    <strong>{t('section.walletTransactions')}</strong>
                </header>
                <WalletTransactionsTable transactions={transactions} loading={loading} t={t} locale={locale} />
            </section>
        </div>
    );
}

export default function WorkshopMyPettyCash({
    selectedBranchId = 'all',
    branches = EMPTY_BRANCHES,
    workshopId = null,
    locale: localeProp,
}) {
    const locale = localeProp || (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) || 'en';
    const { user, hasPermission } = useAuth();
    if (user?.userType === 'workshop_owner' || hasPermission('workshop.my-petty-cash.view')) {
        return (
            <WorkshopPettyCashManagement
                selectedBranchId={selectedBranchId}
                branches={branches}
                workshopId={workshopId}
                locale={locale}
            />
        );
    }
    return (
        <WorkshopMyPettyCashStaff
            workshopId={workshopId}
            defaultBranchId={selectedBranchId}
            locale={locale}
        />
    );
}
