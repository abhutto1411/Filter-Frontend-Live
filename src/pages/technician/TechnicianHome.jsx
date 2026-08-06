import React, { useCallback, useEffect, useState } from 'react';
import {
    Wrench, Radio, AlertTriangle, RefreshCw, CheckCircle2, DollarSign, TrendingUp, CalendarDays,
} from 'lucide-react';
import { apiFetch } from '../../services/api';

function applyDutyFromOnlinePayload(res, setWorkshopDuty, setOnCallAvailable) {
    const ts = res?.technicianStatus;
    const mode = ts?.dutyMode;
    if (mode === 'workshop') {
        setWorkshopDuty(true);
        setOnCallAvailable(false);
    } else if (mode === 'on_call') {
        setWorkshopDuty(false);
        setOnCallAvailable(true);
    } else {
        setWorkshopDuty(false);
        setOnCallAvailable(false);
    }
}

export default function TechnicianHome({
    workshopDuty, setWorkshopDuty, onCallAvailable, setOnCallAvailable,
    showToast,
}) {
    const [today, setToday] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [onlineSnapshot, setOnlineSnapshot] = useState(null);
    const [statusError, setStatusError] = useState('');
    const [loadingOnline, setLoadingOnline] = useState(true);
    const [dutyPatching, setDutyPatching] = useState(false);

    const loadToday = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await apiFetch('/technician/today-performance');
            if (!res?.success) {
                throw new Error(res?.message || 'Invalid response');
            }
            setToday(res);
        } catch (e) {
            setError(e.message || 'Failed to load today’s performance');
            setToday(null);
        } finally {
            setLoading(false);
        }
    }, []);

    const loadOnlineStatus = useCallback(async () => {
        setLoadingOnline(true);
        setStatusError('');
        try {
            const res = await apiFetch('/technician/online-status');
            if (!res?.success) {
                throw new Error(res?.message || 'Invalid online status response');
            }
            setOnlineSnapshot(res);
            applyDutyFromOnlinePayload(res, setWorkshopDuty, setOnCallAvailable);
        } catch (e) {
            setStatusError(e.message || 'Failed to load online status');
        } finally {
            setLoadingOnline(false);
        }
    }, [setWorkshopDuty, setOnCallAvailable]);

    useEffect(() => {
        loadToday();
        loadOnlineStatus();
    }, [loadToday, loadOnlineStatus]);

    const refreshAll = useCallback(() => {
        loadToday();
        loadOnlineStatus();
    }, [loadToday, loadOnlineStatus]);

    const patchDutyMode = useCallback(async (dutyMode) => {
        setDutyPatching(true);
        try {
            const res = await apiFetch('/technician/duty-status', {
                method: 'PATCH',
                body: JSON.stringify({ dutyMode }),
            });
            if (!res?.success) {
                throw new Error(res?.message || 'Could not update duty status');
            }
            setWorkshopDuty(!!res.workshopDuty);
            setOnCallAvailable(!!res.onCallDuty);
            try {
                const online = await apiFetch('/technician/online-status');
                if (online?.success) {
                    setOnlineSnapshot(online);
                }
            } catch {
                /* duty already saved; online refresh is best-effort */
            }
            if (dutyMode === 'workshop') {
                showToast('✓ Workshop Duty activated — visible to POS');
            } else if (dutyMode === 'on_call') {
                showToast('✓ On-Call activated — can receive broadcast orders');
            } else {
                showToast('Duty status updated');
            }
        } catch (e) {
            showToast(e.message || 'Failed to update duty', 'error');
            await loadOnlineStatus();
        } finally {
            setDutyPatching(false);
        }
    }, [loadOnlineStatus, setOnCallAvailable, setWorkshopDuty, showToast]);

    const handleWorkshopToggle = (val) => {
        if (dutyPatching) return;
        if (val && onCallAvailable) {
            showToast('Cannot be On Workshop Duty and On-Call at the same time', 'error');
            return;
        }
        if (val) {
            patchDutyMode('workshop');
        } else {
            setWorkshopDuty(false);
            patchDutyMode('offline');
        }
    };

    const handleOnCallToggle = (val) => {
        if (dutyPatching) return;
        if (val && workshopDuty) {
            showToast('Cannot be On-Call while on Workshop Duty', 'error');
            return;
        }
        if (val) {
            patchDutyMode('on_call');
        } else {
            setOnCallAvailable(false);
            patchDutyMode('offline');
        }
    };

    const kpiCards = [
        {
            label: 'Completed jobs',
            value: loading ? '—' : String(today?.completedJobs ?? '—'),
            sub: 'Today',
            Icon: CheckCircle2,
            c: 'ws-kpi-icon--green',
        },
        {
            label: 'Daily revenue',
            value: loading ? '—' : `SAR ${Number(today?.dailyRevenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
            sub: 'Workshop value',
            Icon: DollarSign,
            c: 'ws-kpi-icon--blue',
        },
        {
            label: 'Today earned',
            value: loading ? '—' : `SAR ${Number(today?.todayEarned ?? 0).toFixed(2)}`,
            sub: 'Your commission',
            Icon: TrendingUp,
            c: 'ws-kpi-icon--yellow',
        },
        {
            label: 'Weekly earned',
            value: loading ? '—' : `SAR ${Number(today?.weeklyEarned ?? 0).toFixed(2)}`,
            sub: 'Last 7 days',
            Icon: CalendarDays,
            c: 'ws-kpi-icon--purple',
        },
    ];

    const ts = onlineSnapshot?.technicianStatus;
    const portalStatus = onlineSnapshot?.status;
    const techAvail = ts?.status;
    const lastSeen = ts?.lastSeenAt
        ? new Date(ts.lastSeenAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
        : null;

    return (
        <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                <h2 className="ws-page-title" style={{ margin: 0 }}>Home</h2>
                <button type="button" className="btn-portal-outline" style={{ padding: '8px 14px', fontSize: '0.8125rem' }} onClick={refreshAll} disabled={loading || loadingOnline}>
                    <RefreshCw size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
                    {loading || loadingOnline ? 'Loading…' : 'Refresh'}
                </button>
            </div>

            {error && (
                <div className="ws-section" style={{ marginBottom: 16, color: '#B91C1C', borderColor: '#FECACA' }}>
                    {error}
                </div>
            )}
            {statusError && (
                <div className="ws-section" style={{ marginBottom: 16, color: '#B91C1C', borderColor: '#FECACA' }}>
                    {statusError}
                </div>
            )}

            <div className="ws-kpi-grid" style={{ marginBottom: 20 }}>
                {kpiCards.map((k) => (
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

            <div className="ws-duty-grid">
                <div className={`ws-duty-card ${workshopDuty ? 'active-duty' : ''}`}>
                    <div className="ws-duty-card-top">
                        <div className={`ws-duty-icon ${workshopDuty ? 'ws-duty-icon--active' : ''}`}>
                            <Wrench size={24} />
                        </div>
                        <label className={`ws-duty-toggle ${dutyPatching ? 'ws-duty-toggle--disabled' : ''}`}>
                            <input type="checkbox" checked={workshopDuty} disabled={dutyPatching} onChange={(e) => handleWorkshopToggle(e.target.checked)} />
                            <span className="ws-toggle-slider" />
                        </label>
                    </div>
                    <p className="ws-duty-name">Workshop Duty</p>
                    <p className="ws-duty-desc">(In-house)</p>
                    <p className={`ws-duty-status ${workshopDuty ? 'on' : 'off'}`}>{workshopDuty ? '✓ Visible to POS for assignment' : 'Not available'}</p>
                </div>
                <div className={`ws-duty-card ${onCallAvailable ? 'active-duty' : ''}`}>
                    <div className="ws-duty-card-top">
                        <div className={`ws-duty-icon ${onCallAvailable ? 'ws-duty-icon--active' : ''}`}>
                            <Radio size={24} />
                        </div>
                        <label className={`ws-duty-toggle ${dutyPatching ? 'ws-duty-toggle--disabled' : ''}`}>
                            <input type="checkbox" checked={onCallAvailable} disabled={dutyPatching} onChange={(e) => handleOnCallToggle(e.target.checked)} />
                            <span className="ws-toggle-slider" />
                        </label>
                    </div>
                    <p className="ws-duty-name">On-Call Availability</p>
                    <p className="ws-duty-desc">Emergency / Broadcast orders</p>
                    <p className={`ws-duty-status ${onCallAvailable ? 'on' : 'off'}`}>{onCallAvailable ? '✓ Can receive broadcast' : 'Not available'}</p>
                </div>
            </div>

            {!workshopDuty && !onCallAvailable && (
                <div className="ws-offline-warn">
                    <AlertTriangle size={18} /> You are <strong>Offline</strong>. Toggle a status above to receive orders.
                </div>
            )}

            <div className="ws-section" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                        <span style={{ fontSize: '0.875rem', fontWeight: 600, display: 'block' }}>Current Status</span>
                        {(portalStatus || techAvail) && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, marginTop: 4, display: 'block' }}>
                                Portal: {portalStatus ?? '—'}
                                {techAvail != null && ` · ${techAvail}`}
                                {lastSeen && ` · Last seen ${lastSeen}`}
                            </span>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {workshopDuty && <span className="ws-badge ws-badge--duty-active">● Online (Workshop)</span>}
                        {onCallAvailable && <span className="ws-badge ws-badge--duty-active">● On-Call</span>}
                        {!workshopDuty && !onCallAvailable && <span className="ws-badge ws-badge--gray">Offline</span>}
                    </div>
                </div>
            </div>
        </>
    );
}
