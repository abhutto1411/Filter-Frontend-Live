import React, { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import { connectScopeParams, getConnectBudget } from '../../services/connectApi';
import ConnectBudgetCategoryBars from './ConnectBudgetCategoryBars';
import '../../styles/connect/ConnectHome.css';

function sar(n) {
    return `SAR ${Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusLabel(status) {
    if (status === 'over') return 'Over';
    if (status === 'warning') return 'Warning';
    if (status === 'within') return 'Within';
    if (status === 'no_budget') return 'No budget';
    return status || '—';
}

export default function ConnectBudgetPage() {
    const navigate = useNavigate();
    const { workshopId, branchId } = useOutletContext() ?? {};
    const params = connectScopeParams({ workshopId, branchId });
    const [data, setData] = useState(null);
    const [error, setError] = useState('');

    const load = () => {
        getConnectBudget(params)
            .then((res) => setData(res?.rows ? res : res?.data || res))
            .catch((e) => setError(e?.message || 'Could not load budget vs actual.'));
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workshopId, branchId]);

    const totals = data?.totals;
    const rows = data?.rows || [];

    return (
        <div className="cn-home">
            <div className="cn-home-head">
                <h1>
                    <Wallet size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                    Budget vs Actual
                </h1>
                <p>
                    {data?.period || 'This month'}. Only assigned workshop tasks. Budget is set on
                    the task. Spent is approved expenses linked to that task. Pending is logged and
                    not posted to the ledger.
                </p>
            </div>
            {error && <div className="cn-home-error">{error}</div>}

            {totals && (
                <div className="cn-tiles">
                    <div className="cn-tile">
                        <span className="cn-tile-label">Budget</span>
                        <strong className="cn-tile-value">{sar(totals.budget)}</strong>
                    </div>
                    <div className="cn-tile">
                        <span className="cn-tile-label">Approved spend</span>
                        <strong className="cn-tile-value">{sar(totals.spent)}</strong>
                    </div>
                    <div className="cn-tile">
                        <span className="cn-tile-label">Used</span>
                        <strong className="cn-tile-value">
                            {totals.usedPct != null ? `${Math.round(totals.usedPct)}%` : '—'}
                        </strong>
                        <span className="cn-tile-sub">{sar(totals.pending)} pending</span>
                    </div>
                    <div className={`cn-tile${totals.over ? ' cn-tile--warn' : ''}`}>
                        <span className="cn-tile-label">Over budget</span>
                        <strong className="cn-tile-value">{totals.over}</strong>
                        <span className="cn-tile-sub">{totals.warning} in warning</span>
                    </div>
                </div>
            )}

            <section className="cn-card cn-card--pad">
                <h2 className="cn-panel-title" style={{ marginBottom: 14 }}>
                    By task
                </h2>
                <ConnectBudgetCategoryBars categories={data?.byCategory} />
            </section>

            <div className="cn-card" style={{ padding: 0, overflow: 'hidden' }}>
                <table className="cn-work-table">
                    <thead>
                        <tr>
                            <th>Task</th>
                            <th>Budget</th>
                            <th>Spent</th>
                            <th>Pending</th>
                            <th>Remaining</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr
                                key={r.id}
                                className="cn-work-row"
                                onClick={() => navigate(`/connect/tasks/${r.id}`)}
                            >
                                <td>
                                    <strong>{r.title}</strong>
                                    <div className="cn-work-meta">
                                        {[r.assignedToName, r.branchName || r.workshopName]
                                            .filter(Boolean)
                                            .join(' · ') || '—'}
                                    </div>
                                </td>
                                <td>{r.budget ? sar(r.budget) : 'Not set'}</td>
                                <td>{sar(r.spent)}</td>
                                <td>{sar(r.pending)}</td>
                                <td>{r.remaining == null ? '—' : sar(r.remaining)}</td>
                                <td className={r.status === 'over' ? 'cn-work-over' : ''}>
                                    {statusLabel(r.status)}
                                </td>
                            </tr>
                        ))}
                        {!rows.length && (
                            <tr>
                                <td colSpan={6} className="cn-panel-empty">
                                    No assigned workshop tasks yet. Create a task and set its
                                    budget — this page compares that budget to approved spend.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
