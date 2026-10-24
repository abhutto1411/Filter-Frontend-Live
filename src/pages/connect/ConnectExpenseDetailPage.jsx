import React, { useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { connectScopeParams, getConnectExpense } from '../../services/connectApi';
import '../../styles/connect/ConnectHome.css';

function sar(n) {
    return `SAR ${Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ConnectExpenseDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { workshopId, branchId } = useOutletContext() ?? {};
    const params = connectScopeParams({ workshopId, branchId });
    const [expense, setExpense] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        getConnectExpense(id, params)
            .then((res) => setExpense(res?.expense || res?.data?.expense || null))
            .catch((e) => setError(e?.message || 'Could not load the expense.'));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, workshopId, branchId]);

    return (
        <div className="cn-home">
            <button type="button" className="cn-work-back" onClick={() => navigate('/connect/expenses')}>
                <ArrowLeft size={16} /> Back to expenses
            </button>
            {error && <div className="cn-home-error">{error}</div>}
            {!expense && !error && <p className="cn-panel-empty">Loading…</p>}
            {expense && (
                <>
                    <div className="cn-home-head">
                        <p className="cn-kicker">Expense</p>
                        <h1>{expense.description || expense.category || 'Expense'}</h1>
                        <p>
                            {expense.status}
                            {expense.expenseDate ? ` · ${expense.expenseDate}` : ''}
                            {expense.branchName ? ` · ${expense.branchName}` : ''}
                        </p>
                    </div>

                    <div className="cn-tiles" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                        <div className="cn-tile">
                            <span className="cn-tile-label">Amount</span>
                            <strong className="cn-tile-value">{sar(expense.amount)}</strong>
                            {expense.vatAmount > 0 ? (
                                <span className="cn-tile-sub">
                                    {sar(expense.netAmount)} + VAT {sar(expense.vatAmount)}
                                </span>
                            ) : null}
                        </div>
                        <div className="cn-tile">
                            <span className="cn-tile-label">Status</span>
                            <strong className="cn-tile-value">{expense.status}</strong>
                            {expense.approvedByName ? (
                                <span className="cn-tile-sub">Approved by {expense.approvedByName}</span>
                            ) : null}
                        </div>
                        <div className="cn-tile">
                            <span className="cn-tile-label">Category</span>
                            <strong className="cn-tile-value">{expense.category || '—'}</strong>
                            <span className="cn-tile-sub">{expense.payFrom || '—'}</span>
                        </div>
                    </div>

                    <div className="cn-card cn-card--pad">
                        <dl className="cn-task-grid" style={{ marginBottom: 0 }}>
                            <div>
                                <dt>Workshop</dt>
                                <dd>{expense.workshopName || '—'}</dd>
                            </div>
                            <div>
                                <dt>Branch</dt>
                                <dd>{expense.branchName || '—'}</dd>
                            </div>
                            <div>
                                <dt>Requested by</dt>
                                <dd>{expense.requestedByName || '—'}</dd>
                            </div>
                            <div>
                                <dt>Date</dt>
                                <dd>{expense.expenseDate || expense.createdAt?.slice(0, 10) || '—'}</dd>
                            </div>
                            <div>
                                <dt>Pay to</dt>
                                <dd>{expense.payToType || '—'}</dd>
                            </div>
                            <div>
                                <dt>Linked task</dt>
                                <dd>
                                    {expense.taskId ? (
                                        <button
                                            type="button"
                                            className="cn-work-back"
                                            style={{ margin: 0 }}
                                            onClick={() => navigate(`/connect/tasks/${expense.taskId}`)}
                                        >
                                            {expense.taskTitle || `TSK-${expense.taskId}`}
                                        </button>
                                    ) : (
                                        'Not linked'
                                    )}
                                </dd>
                            </div>
                        </dl>
                        {expense.rejectionReason ? (
                            <p className="cn-home-error" style={{ marginTop: 14, marginBottom: 0 }}>
                                {expense.rejectionReason}
                            </p>
                        ) : null}
                        {expense.proofUrl ? (
                            <p className="cn-work-meta" style={{ marginTop: 14, marginBottom: 0 }}>
                                <a href={expense.proofUrl} target="_blank" rel="noreferrer">
                                    View proof
                                </a>
                            </p>
                        ) : null}
                        <p className="cn-work-meta" style={{ marginTop: 14, marginBottom: 0 }}>
                            Approval stays in workshop expenses. CONNECT does not post the ledger.
                        </p>
                    </div>
                </>
            )}
        </div>
    );
}
