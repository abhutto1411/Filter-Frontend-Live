import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Wallet, Plus, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import {
    listWorkshopPettyCashWallets,
    listWorkshopExpenseRequests,
    listExpenseIssuanceTargets,
    issuePettyCash,
    approveExpenseRequest,
    rejectExpenseRequest,
} from '../../services/employeeExpenseApi';
import { listCashBankAccounts } from '../../services/workshopAccountingApi';
import { getWorkshopBranches, unwrapWorkshopBranchesResponse } from '../../services/workshopStaffApi';
import { StatusBadge, MessageThread, formatSar } from './WorkshopMyPettyCash.shared';
import '../../styles/admin/AccountingPage.css';

export default function WorkshopPettyCashManagement({ selectedBranchId = 'all' }) {
    const [branchFilter, setBranchFilter] = useState('');
    const [wallets, setWallets] = useState([]);
    const [requests, setRequests] = useState([]);
    const [targets, setTargets] = useState([]);
    const [cashAccounts, setCashAccounts] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [openThread, setOpenThread] = useState(null);

    const [issueOpen, setIssueOpen] = useState(false);
    const [issueUserId, setIssueUserId] = useState('');
    const [issueBranchId, setIssueBranchId] = useState('');
    const [issueAmount, setIssueAmount] = useState('');
    const [issuePayFrom, setIssuePayFrom] = useState('');
    const [issueNote, setIssueNote] = useState('');
    const [issueSubmitting, setIssueSubmitting] = useState(false);
    const [issueMsg, setIssueMsg] = useState('');

    const [actionBusyId, setActionBusyId] = useState(null);
    const [approvePayFromByRequest, setApprovePayFromByRequest] = useState({});

    const effectiveBranch = branchFilter || undefined;

    const loadAll = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [walletRes, reqRes, targetRes, cashRes, brRes] = await Promise.all([
                listWorkshopPettyCashWallets({ branchId: effectiveBranch }),
                listWorkshopExpenseRequests({ limit: 100 }),
                listExpenseIssuanceTargets(),
                listCashBankAccounts({}).catch(() => ({ accounts: [] })),
                getWorkshopBranches().catch(() => ({ branches: [] })),
            ]);
            setWallets(walletRes?.wallets ?? []);
            setRequests(reqRes?.items ?? []);
            setTargets(targetRes?.users ?? []);
            setCashAccounts(cashRes?.accounts ?? cashRes?.items ?? []);
            setBranches(unwrapWorkshopBranchesResponse(brRes));
        } catch (e) {
            setError(e?.message || 'Could not load petty cash management data.');
        } finally {
            setLoading(false);
        }
    }, [effectiveBranch]);

    useEffect(() => {
        const next =
            selectedBranchId && selectedBranchId !== 'all'
                ? String(selectedBranchId)
                : '';
        setBranchFilter(next);
    }, [selectedBranchId]);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    const summary = useMemo(() => {
        const totalFloat = wallets.reduce((s, w) => s + Number(w.currentBalance ?? 0), 0);
        const pending = requests.filter((r) => r.status === 'pending');
        return {
            totalFloat,
            walletCount: wallets.length,
            pendingCount: pending.length,
            pendingAmount: pending.reduce((s, r) => s + Number(r.amount ?? 0), 0),
        };
    }, [wallets, requests]);

    const handleIssue = async () => {
        setIssueMsg('');
        const amt = Number(issueAmount);
        if (!issueUserId) {
            setIssueMsg('Select a staff member.');
            return;
        }
        if (!issueBranchId) {
            setIssueMsg('Select a branch.');
            return;
        }
        if (!Number.isFinite(amt) || amt <= 0) {
            setIssueMsg('Enter a valid amount.');
            return;
        }
        if (!issuePayFrom) {
            setIssueMsg('Select the cash/bank account to pay from.');
            return;
        }
        setIssueSubmitting(true);
        try {
            await issuePettyCash({
                userId: issueUserId,
                branchId: issueBranchId,
                amount: amt,
                payFromAccountId: issuePayFrom,
                description: issueNote.trim() || undefined,
            });
            setIssueOpen(false);
            setIssueUserId('');
            setIssueBranchId('');
            setIssueAmount('');
            setIssuePayFrom('');
            setIssueNote('');
            await loadAll();
        } catch (e) {
            setIssueMsg(e?.message || 'Could not issue petty cash.');
        } finally {
            setIssueSubmitting(false);
        }
    };

    const handleApprove = async (row) => {
        const payFrom =
            approvePayFromByRequest[row.id] ||
            row.payFromAccountId ||
            '';
        if (row.kind === 'fund_request' && !payFrom) {
            setError('Select a pay-from cash/bank account before approving a fund top-up.');
            return;
        }
        setActionBusyId(row.id);
        setError('');
        try {
            await approveExpenseRequest(row.id, {
                ...(payFrom ? { payFromAccountId: payFrom } : {}),
            });
            await loadAll();
        } catch (e) {
            setError(e?.message || 'Approve failed.');
        } finally {
            setActionBusyId(null);
        }
    };

    const handleReject = async (row) => {
        const reason = window.prompt('Rejection reason (required):');
        if (!reason?.trim()) return;
        setActionBusyId(row.id);
        setError('');
        try {
            await rejectExpenseRequest(row.id, { reason: reason.trim() });
            await loadAll();
        } catch (e) {
            setError(e?.message || 'Reject failed.');
        } finally {
            setActionBusyId(null);
        }
    };

    const onIssueUserChange = (userId) => {
        setIssueUserId(userId);
        const t = targets.find((u) => String(u.id) === String(userId));
        if (t?.branchId) setIssueBranchId(String(t.branchId));
    };

    return (
        <div className="accounting-page module-container">
            <header className="cash-bank-header">
                <h2 className="cash-bank-title">Petty Cash Management</h2>
                <p className="cash-bank-desc">
                    Manage petty-cash floats for all workshop staff — issue cash, review requests, and monitor balances.
                </p>
            </header>

            {error ? (
                <p className="form-help-text" style={{ color: '#B45309', marginBottom: 12 }}>{error}</p>
            ) : null}

            <div className="cash-bank-stats">
                <div className="cash-bank-stat-card">
                    <div className="cash-bank-stat-icon"><Wallet size={24} /></div>
                    <div>
                        <p className="cash-bank-stat-label">Total Staff Float</p>
                        <p className="cash-bank-stat-value">SAR {formatSar(summary.totalFloat)}</p>
                        <p className="cash-bank-stat-meta">{summary.walletCount} staff wallets</p>
                    </div>
                </div>
                <div className="cash-bank-stat-card">
                    <div className="cash-bank-stat-icon"><RefreshCw size={24} /></div>
                    <div>
                        <p className="cash-bank-stat-label">Pending Requests</p>
                        <p className="cash-bank-stat-value">SAR {formatSar(summary.pendingAmount)}</p>
                        <p className="cash-bank-stat-meta">{summary.pendingCount} awaiting action</p>
                    </div>
                </div>
            </div>

            <section style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 12,
                marginBottom: 16,
                padding: 12,
                background: '#fafafa',
                borderRadius: 12,
                border: '1px solid #E2E8F0',
            }}>
                <div>
                    <label className="form-label">Branch</label>
                    <select
                        className="form-input-field"
                        value={branchFilter}
                        onChange={(e) => setBranchFilter(e.target.value)}
                    >
                        <option value="">All branches</option>
                        {branches.map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                    <button type="button" className="btn-portal" onClick={() => setIssueOpen(true)}>
                        <Plus size={16} /> Issue Petty Cash
                    </button>
                    <button type="button" className="btn-portal-outline" onClick={loadAll} disabled={loading}>
                        <RefreshCw size={16} /> Refresh
                    </button>
                </div>
            </section>

            {issueOpen ? (
                <section style={{ padding: 18, background: '#fafafa', borderRadius: 12, marginBottom: 16, border: '1px solid #E2E8F0' }}>
                    <h3 style={{ margin: '0 0 12px' }}>Issue Petty Cash to Staff</h3>
                    {issueMsg ? <p className="form-help-text" style={{ color: '#B45309' }}>{issueMsg}</p> : null}
                    <div className="modal-form-grid">
                        <div className="form-group">
                            <label className="form-label">Staff member *</label>
                            <select className="form-input-field" value={issueUserId} onChange={(e) => onIssueUserChange(e.target.value)}>
                                <option value="">Select staff</option>
                                {targets.map((u) => (
                                    <option key={u.id} value={u.id}>
                                        {u.name}{u.role ? ` (${String(u.role).replace(/_/g, ' ')})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Branch *</label>
                            <select className="form-input-field" value={issueBranchId} onChange={(e) => setIssueBranchId(e.target.value)}>
                                <option value="">Select branch</option>
                                {branches.map((b) => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Amount (SAR) *</label>
                            <input type="number" min="0" step="0.01" className="form-input-field" value={issueAmount} onChange={(e) => setIssueAmount(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Pay from (cash/bank) *</label>
                            <select className="form-input-field" value={issuePayFrom} onChange={(e) => setIssuePayFrom(e.target.value)}>
                                <option value="">Select account</option>
                                {cashAccounts.map((a) => (
                                    <option key={a.id} value={a.id}>{a.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group form-group-full">
                            <label className="form-label">Note</label>
                            <input type="text" className="form-input-field" value={issueNote} onChange={(e) => setIssueNote(e.target.value)} />
                        </div>
                        <div className="form-group form-group-full" style={{ display: 'flex', gap: 8 }}>
                            <button type="button" className="btn-portal" disabled={issueSubmitting} onClick={handleIssue}>
                                {issueSubmitting ? 'Issuing…' : 'Issue Now'}
                            </button>
                            <button type="button" className="btn-portal-outline" onClick={() => setIssueOpen(false)}>Cancel</button>
                        </div>
                    </div>
                </section>
            ) : null}

            {openThread ? (
                <MessageThread requestId={openThread} onClose={() => setOpenThread(null)} />
            ) : null}

            <section className="premium-table cash-bank-table">
                <header style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0' }}>
                    <strong>Staff Wallets</strong>
                </header>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">Staff</th>
                            <th className="table-th">Role</th>
                            <th className="table-th">Branch</th>
                            <th className="table-th">Balance</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={4} className="table-cell table-empty">Loading…</td></tr>
                        ) : wallets.length === 0 ? (
                            <tr><td colSpan={4} className="table-cell table-empty">No staff wallets yet. Issue petty cash to create one.</td></tr>
                        ) : wallets.map((w) => (
                            <tr key={w.user?.id ?? w.walletId}>
                                <td className="table-cell">{w.user?.name ?? '—'}</td>
                                <td className="table-cell">{w.user?.role ? String(w.user.role).replace(/_/g, ' ') : '—'}</td>
                                <td className="table-cell">{w.branch?.name ?? '—'}</td>
                                <td className="table-cell"><strong>SAR {formatSar(w.currentBalance)}</strong></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>

            <section className="premium-table cash-bank-table" style={{ marginTop: 16 }}>
                <header style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0' }}>
                    <strong>All Staff Requests</strong>
                </header>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">Date</th>
                            <th className="table-th">Staff</th>
                            <th className="table-th">Type</th>
                            <th className="table-th">Branch</th>
                            <th className="table-th">Amount</th>
                            <th className="table-th">Status</th>
                            <th className="table-th">Pay from</th>
                            <th className="table-th">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {requests.length === 0 ? (
                            <tr><td colSpan={8} className="table-cell table-empty">No requests.</td></tr>
                        ) : requests.map((r) => (
                            <tr key={r.id}>
                                <td className="table-cell">{new Date(r.createdAt).toLocaleDateString()}</td>
                                <td className="table-cell">{r.requestedBy?.name ?? '—'}</td>
                                <td className="table-cell">{r.kind === 'fund_request' ? 'Fund top-up' : 'Expense'}</td>
                                <td className="table-cell">{r.branch?.name ?? '—'}</td>
                                <td className="table-cell">SAR {formatSar(r.amount)}</td>
                                <td className="table-cell"><StatusBadge status={r.status} /></td>
                                <td className="table-cell">
                                    {r.status === 'pending' && r.kind === 'fund_request' ? (
                                        <select
                                            className="form-input-field"
                                            style={{ minWidth: 140 }}
                                            value={approvePayFromByRequest[r.id] ?? r.payFromAccountId ?? ''}
                                            onChange={(e) => setApprovePayFromByRequest((prev) => ({
                                                ...prev,
                                                [r.id]: e.target.value,
                                            }))}
                                        >
                                            <option value="">Select account</option>
                                            {cashAccounts.map((a) => (
                                                <option key={a.id} value={a.id}>{a.name}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        r.payFromAccountName ?? '—'
                                    )}
                                </td>
                                <td className="table-cell">
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                        {r.status === 'pending' ? (
                                            <>
                                                <button
                                                    type="button"
                                                    className="btn-portal"
                                                    disabled={actionBusyId === r.id}
                                                    onClick={() => handleApprove(r)}
                                                >
                                                    <CheckCircle size={14} /> Approve
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn-portal-outline"
                                                    disabled={actionBusyId === r.id}
                                                    onClick={() => handleReject(r)}
                                                >
                                                    <XCircle size={14} /> Reject
                                                </button>
                                            </>
                                        ) : null}
                                        <button type="button" className="btn-edit-zone" onClick={() => setOpenThread(r.id)}>
                                            Messages{r.messageCount > 0 ? ` (${r.messageCount})` : ''}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
        </div>
    );
}
