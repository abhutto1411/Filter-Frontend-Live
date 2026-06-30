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
import '../../styles/admin/AccountingPage.css';

function WorkshopMyPettyCashStaff({ workshopId: workshopIdProp = null, defaultBranchId = '' }) {
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
            setError(e?.message || 'Could not load petty cash data.');
        } finally {
            setLoading(false);
        }
    }, [scopeQuery]);

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
                <h2 className="cash-bank-title">My Petty Cash</h2>
                <p className="cash-bank-desc">
                    Request a fund top-up or submit an expense for approval. GL posts to branch-level{' '}
                    <strong>[1280]</strong> and <strong>[6100]</strong> under the workshop you select.
                </p>
            </header>

            {error ? (
                <p className="form-help-text" style={{ color: '#B45309', marginBottom: 12 }}>{error}</p>
            ) : null}

            <PettyCashRecordForms
                workshopId={workshopIdProp}
                defaultBranchId={defaultBranchId}
                onSubmitted={loadAll}
            />

            <div className="cash-bank-stats">
                <div className="cash-bank-stat-card">
                    <div className="cash-bank-stat-icon"><Wallet size={24} /></div>
                    <div>
                        <p className="cash-bank-stat-label">Wallet Balance</p>
                        <p className="cash-bank-stat-value">SAR {formatSar(wallet?.currentBalance ?? 0)}</p>
                        <p className="cash-bank-stat-meta">{wallet?.coaAccount?.code ?? '—'} · {wallet?.name ?? 'Petty Cash Wallet'}</p>
                    </div>
                </div>
                <div className="cash-bank-stat-card">
                    <div className="cash-bank-stat-icon"><Clock size={24} /></div>
                    <div>
                        <p className="cash-bank-stat-label">Pending Requests</p>
                        <p className="cash-bank-stat-value">SAR {formatSar(summary.pendingTotal)}</p>
                        <p className="cash-bank-stat-meta">{summary.pendingCount} awaiting approval</p>
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
                    <RefreshCw size={16} style={{ marginRight: 6 }} /> Refresh
                </button>
            </div>

            {openThread ? (
                <MessageThread requestId={openThread} onClose={() => setOpenThread(null)} />
            ) : null}

            <section className="premium-table cash-bank-table">
                <header style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0' }}>
                    <strong>My Requests</strong>
                </header>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">Date</th>
                            <th className="table-th">Type</th>
                            <th className="table-th">Category</th>
                            <th className="table-th">Branch</th>
                            <th className="table-th">Amount</th>
                            <th className="table-th">Status</th>
                            <th className="table-th">Proof</th>
                            <th className="table-th">Notes</th>
                            <th className="table-th">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={9} className="table-cell table-empty">Loading…</td></tr>
                        ) : requests.length === 0 ? (
                            <tr><td colSpan={9} className="table-cell table-empty">No requests yet.</td></tr>
                        ) : requests.map((r) => (
                            <tr key={r.id}>
                                <td className="table-cell">{new Date(r.createdAt).toLocaleDateString()}</td>
                                <td className="table-cell">{r.kind === 'fund_request' ? 'Fund top-up' : 'Expense'}</td>
                                <td className="table-cell">{r.category?.name ?? '—'}</td>
                                <td className="table-cell">{r.branch?.name ?? '—'}</td>
                                <td className="table-cell">SAR {formatSar(r.amount)}</td>
                                <td className="table-cell"><StatusBadge status={r.status} /></td>
                                <td className="table-cell">
                                    {r.kind === 'expense' ? (
                                        <ExpenseProofThumbnail proofUrl={r.proofUrl} size={36} />
                                    ) : '—'}
                                </td>
                                <td className="table-cell" style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {r.rejectionReason || r.description || '—'}
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
                    <strong>Wallet Transactions</strong>
                </header>
                <WalletTransactionsTable transactions={transactions} loading={loading} />
            </section>
        </div>
    );
}

export default function WorkshopMyPettyCash({ selectedBranchId = 'all', workshopId = null }) {
    const { user, hasPermission } = useAuth();
    if (user?.userType === 'workshop_owner' || hasPermission('workshop.my-petty-cash.view')) {
        return (
            <WorkshopPettyCashManagement
                selectedBranchId={selectedBranchId}
                workshopId={workshopId}
            />
        );
    }
    return (
        <WorkshopMyPettyCashStaff
            workshopId={workshopId}
            defaultBranchId={selectedBranchId}
        />
    );
}
