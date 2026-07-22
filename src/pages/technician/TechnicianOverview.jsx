import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    CheckCircle2, TrendingUp, BarChart3, RefreshCw,
} from 'lucide-react';
import { apiFetch } from '../../services/api';

export default function TechnicianOverview() {
    const [perf, setPerf] = useState(null);
    const [perfLoading, setPerfLoading] = useState(true);
    const [perfError, setPerfError] = useState('');

    const loadDailyPerformance = useCallback(async () => {
        setPerfLoading(true);
        setPerfError('');
        try {
            const res = await apiFetch('/technician/daily-performance');
            if (!res?.success) {
                throw new Error(res?.message || 'Invalid daily performance response');
            }
            setPerf(res);
        } catch (e) {
            setPerfError(e.message || 'Failed to load daily performance');
            setPerf(null);
        } finally {
            setPerfLoading(false);
        }
    }, []);

    useEffect(() => {
        loadDailyPerformance();
    }, [loadDailyPerformance]);

    const weeklyMax = useMemo(() => {
        const rows = perf?.weeklyOverview || [];
        return Math.max(1, ...rows.map((d) => Number(d.amount) || 0));
    }, [perf?.weeklyOverview]);

    const kpis = [
        {
            label: 'Jobs (period)',
            value: perfLoading ? '—' : (perf?.totalJobs ?? '—'),
            sub: 'Daily performance',
            Icon: CheckCircle2,
            c: 'ws-kpi-icon--green',
        },
        {
            label: 'Earned',
            value: perfLoading ? '—' : `SAR ${Number(perf?.earned ?? 0).toFixed(2)}`,
            sub: 'Commission earned',
            Icon: TrendingUp,
            c: 'ws-kpi-icon--yellow',
        },
    ];

    return (
        <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                <h2 className="ws-page-title" style={{ margin: 0 }}>Overview</h2>
                <button type="button" className="btn-portal-outline" style={{ padding: '8px 14px', fontSize: '0.8125rem' }} onClick={loadDailyPerformance} disabled={perfLoading}>
                    <RefreshCw size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
                    {perfLoading ? 'Loading…' : 'Refresh'}
                </button>
            </div>

            {perfError && (
                <div className="ws-section" style={{ marginBottom: 16, color: '#B91C1C', borderColor: '#FECACA' }}>
                    {perfError}
                </div>
            )}

            <div className="ws-kpi-grid" style={{ marginBottom: 20 }}>
                {kpis.map((k) => (
                    <div key={k.label} className="ws-kpi-card">
                        <div>
                            <p className="ws-kpi-label">{k.label}</p>
                            <p className="ws-kpi-value">{k.value}</p>
                            <p className="ws-kpi-sub">{k.sub}</p>
                        </div>
                        <div className={`ws-kpi-icon ${k.c}`}><k.Icon size={22} /></div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>Daily performance</h3>
            </div>

            <div className="ws-section" style={{ marginBottom: 20, padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <BarChart3 size={18} style={{ color: 'var(--color-text-muted)' }} />
                    <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>Weekly overview</span>
                </div>
                {perfLoading && !perf?.weeklyOverview?.length ? (
                    <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Loading chart…</p>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, minHeight: 120 }}>
                        {(perf?.weeklyOverview || []).map((d) => {
                            const amt = Number(d.amount) || 0;
                            const barPx = Math.round((amt / weeklyMax) * 72);
                            const fill = amt > 0 ? Math.max(barPx, 6) : 0;
                            return (
                                <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 0 }}>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>SAR {amt.toFixed(0)}</span>
                                    <div style={{ width: '100%', maxWidth: 40, height: 72, background: '#F3F4F6', borderRadius: 8, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', overflow: 'hidden' }}>
                                        <div style={{ height: fill, background: 'var(--color-primary, #FCC245)', borderRadius: '0 0 8px 8px' }} />
                                    </div>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{d.day}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="ws-section" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-border)', fontWeight: 800, fontSize: '0.9rem' }}>
                    Recent jobs
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table className="ws-table">
                        <thead>
                            <tr>
                                <th>Job</th>
                                <th>Vehicle</th>
                                <th>Completed</th>
                                <th style={{ textAlign: 'right' }}>Earned</th>
                            </tr>
                        </thead>
                        <tbody>
                            {perfLoading && !(perf?.recentJobs?.length) ? (
                                <tr>
                                    <td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-muted)' }}>Loading…</td>
                                </tr>
                            ) : !(perf?.recentJobs?.length) ? (
                                <tr>
                                    <td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-muted)' }}>No recent jobs</td>
                                </tr>
                            ) : (
                                perf.recentJobs.map((j) => (
                                    <tr key={j.jobId}>
                                        <td><strong>#{j.jobId}</strong></td>
                                        <td>{j.vehicle || '—'}</td>
                                        <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                            {j.completedAt ? new Date(j.completedAt).toLocaleString() : '—'}
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 800 }}>SAR {Number(j.earned || 0).toFixed(2)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
