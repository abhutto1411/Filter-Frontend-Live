import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, LogOut, Check, Lock, AlertTriangle } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

function toNumber(v) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
}

function DepartmentSalesTable({ rows, search, onSearchChange }) {
    const q = (search || '').trim().toLowerCase();
    const filtered = useMemo(() => {
        if (!q) return rows;
        return rows.filter((r) => {
            const name = (r.departmentName ?? r.department_name ?? '').toString();
            const orders = String(r.ordersCount ?? r.orders_count ?? '');
            const rev = toNumber(r.revenueSar ?? r.revenue_sar).toFixed(2);
            return `${name} ${orders} ${rev}`.toLowerCase().includes(q);
        });
    }, [rows, q]);

    return (
        <div style={{ background: '#fff', borderRadius: 14, padding: '16px 20px', marginBottom: 16, border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ width: 3, height: 18, background: '#FCC247', borderRadius: 2 }} />
                <p style={{ margin: 0, fontWeight: 800, fontSize: '0.88rem', color: '#1E2124' }}>Department Sales</p>
            </div>
            <input
                type="search"
                placeholder="Search department, orders, revenue…"
                value={search}
                onChange={(e) => onSearchChange?.(e.target.value)}
                style={{
                    width: '100%',
                    padding: '10px 14px',
                    marginBottom: 12,
                    border: '1px solid #e5e7eb',
                    borderRadius: 10,
                    fontSize: '0.88rem',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                    background: '#F8FAFC',
                }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr', gap: 8, padding: '10px 12px', background: '#f1f5f9', borderRadius: '8px 8px 0 0', fontSize: '0.68rem', fontWeight: 800, color: '#64748b', letterSpacing: 0.4 }}>
                <span>DEPARTMENT</span>
                <span style={{ textAlign: 'center' }}>ORDERS</span>
                <span style={{ textAlign: 'right' }}>REVENUE (SAR)</span>
            </div>
            {filtered.length === 0 ? (
                <p style={{ margin: 0, padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                    {rows.length === 0 ? 'No department sales for this shift yet.' : 'No rows match your search.'}
                </p>
            ) : (
                filtered.map((row, i) => (
                    <div
                        key={row.departmentId ?? row.department_id ?? i}
                        style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr', gap: 8, padding: '12px', fontSize: '0.82rem', borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}
                    >
                        <strong style={{ color: '#1E2124' }}>{row.departmentName ?? row.department_name ?? '—'}</strong>
                        <span style={{ textAlign: 'center', fontWeight: 600 }}>{toNumber(row.ordersCount ?? row.orders_count)}</span>
                        <span style={{ textAlign: 'right', fontWeight: 900 }}>
                            SAR {toNumber(row.revenueSar ?? row.revenue_sar).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                ))
            )}
        </div>
    );
}

const CATEGORIES = [
    { key: 'cash', label: 'Cash', sysKey: 'totalCash' },
    { key: 'bank', label: 'Bank (Card/Transfer)', sysKey: 'totalCard' },
    { key: 'corporate', label: 'Corporate', sysKey: 'totalCorporate' },
    { key: 'tamara', label: 'Tamara', sysKey: 'totalTamara' },
    { key: 'tabby', label: 'Tabby', sysKey: 'totalTabby' },
];

export default function CounterClosingScreen({ onBack, onLogout }) {
    const { user } = useAuth();
    const [counts, setCounts] = useState({ cash: '', bank: '', corporate: '', tamara: '', tabby: '' });
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [summary, setSummary] = useState(null);
    const [loadingSummary, setLoadingSummary] = useState(true);
    const [departmentSearch, setDepartmentSearch] = useState('');
    const [closingResult, setClosingResult] = useState(null);

    useEffect(() => {
        setLoadingSummary(true);
        const workshopId = user?.workshopId || user?.workshop_id || '';
        const qs = new URLSearchParams(
            workshopId ? { workshopId: String(workshopId) } : {},
        ).toString();
        const path = qs ? `/cashier/store-closing?${qs}` : '/cashier/store-closing';
        apiFetch(path)
            .then((d) => setSummary(d.summary || d.data || d))
            .catch(() => setSummary(null))
            .finally(() => setLoadingSummary(false));
    }, [user]);

    const departmentRows = useMemo(() => {
        const raw = closingResult?.departmentBreakdown ?? summary?.departmentBreakdown;
        return Array.isArray(raw) ? raw : [];
    }, [closingResult, summary]);

    const sessionOpenedAt = closingResult?.openedAt ?? summary?.openedAt ?? null;
    const sessionClosedAt = closingResult?.closedAt ?? null;

    const formatSessionTime = (iso) => {
        if (!iso) return '—';
        try {
            return new Date(iso).toLocaleString('en-SA', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return '—';
        }
    };

    const setCount = (k, v) => setCounts(c => ({ ...c, [k]: v }));

    const { totalSystem, totalPhysical, rows } = useMemo(() => {
        const rows = CATEGORIES.map(c => {
            const sys = parseFloat(summary?.[c.sysKey] ?? 0) || 0;
            const phys = parseFloat(counts[c.key]) || 0;
            return { ...c, system: sys, physical: phys, diff: phys - sys };
        });
        return {
            rows,
            totalSystem: rows.reduce((s, r) => s + r.system, 0),
            totalPhysical: rows.reduce((s, r) => s + r.physical, 0),
        };
    }, [counts, summary]);

    const totalDiff = totalPhysical - totalSystem;

    const handleSubmit = async () => {
        const hasAny = Object.values(counts).some(v => v !== '');
        if (!hasAny) return alert('Please enter at least one physical count');
        if (!window.confirm('Submit store closing report? This will lock the shift.')) return;
        setSubmitting(true);
        try {
            const res = await apiFetch('/cashier/counter-closing', {
                method: 'POST',
                body: JSON.stringify({
                    physicalCash: parseFloat(counts.cash) || 0,
                    physicalBank: parseFloat(counts.bank) || 0,
                    physicalCorporate: parseFloat(counts.corporate) || 0,
                    physicalTamara: parseFloat(counts.tamara) || 0,
                    physicalTabby: parseFloat(counts.tabby) || 0,
                    totalPhysical,
                    totalSystem,
                    difference: totalDiff,
                    notes,
                    rows: rows.map(r => ({ category: r.key, system: r.system, physical: r.physical, diff: r.diff })),
                }),
            });
            setClosingResult(res?.data ?? res ?? null);
            setSubmitted(true);
        } catch (e) {
            alert('Error: ' + e.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center', paddingTop: 40 }}>
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, #34d399, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                    <Check size={40} color="#fff" />
                </div>
                <h2 style={{ margin: '0 0 8px', fontSize: '1.5rem', fontWeight: 900, color: '#1E2124' }}>Closing Submitted</h2>
                <p style={{ margin: '0 0 28px', color: '#64748b' }}>Your store closing report has been locked in.</p>

                <div style={{ background: '#fff', borderRadius: 16, padding: 22, marginBottom: 24, textAlign: 'left', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
                    <p style={{ margin: '0 0 14px', fontWeight: 800, fontSize: '0.95rem', color: '#1E2124' }}>Reconciliation Result</p>
                    <ReconTable rows={rows} totalSystem={totalSystem} totalPhysical={totalPhysical} totalDiff={totalDiff} />
                </div>

                {(sessionOpenedAt || sessionClosedAt) && (
                    <div style={{ background: '#fff', borderRadius: 14, padding: '16px 20px', marginBottom: 16, border: '1px solid #e5e7eb', textAlign: 'left' }}>
                        <p style={{ margin: '0 0 10px', fontWeight: 800, fontSize: '0.88rem', color: '#1E2124' }}>Session</p>
                        {sessionOpenedAt && (
                            <p style={{ margin: '0 0 6px', fontSize: '0.82rem', color: '#475569' }}>
                                <strong>Start:</strong> {formatSessionTime(sessionOpenedAt)}
                            </p>
                        )}
                        {sessionClosedAt && (
                            <p style={{ margin: 0, fontSize: '0.82rem', color: '#475569' }}>
                                <strong>End:</strong> {formatSessionTime(sessionClosedAt)}
                            </p>
                        )}
                    </div>
                )}

                <DepartmentSalesTable
                    rows={departmentRows}
                    search={departmentSearch}
                    onSearchChange={setDepartmentSearch}
                />

                <button onClick={onLogout}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 32px', background: '#23262D', color: '#FCC247', border: 'none', borderRadius: 14, fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                    <LogOut size={18} /> Logout / End Shift
                </button>
            </div>
        );
    }

    return (
        <div style={{ width: '100%', padding: 24, boxSizing: 'border-box' }}>
            <div style={{ maxWidth: 640, margin: '0 auto' }}>
                {/* Header card */}
                <div style={{ background: 'linear-gradient(135deg, #23262D, #2C3136)', borderRadius: 18, padding: '20px 22px', marginBottom: 20, color: '#fff', boxShadow: '0 8px 20px rgba(35,38,45,0.2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                        {onBack && (
                            <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 10, padding: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#FCC247' }}>
                                <ArrowLeft size={18} />
                            </button>
                        )}
                        <Lock size={20} color="#FCC247" />
                        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#FCC247' }}>Store Closing — Shift End</h2>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, fontSize: '0.82rem' }}>
                        <Stat label="Cashier" value={user?.name || 'Cashier'} />
                        <Stat label="Date" value={new Date().toLocaleDateString('en-SA')} />
                        <Stat label="Time" value={new Date().toLocaleTimeString('en-SA', { hour: '2-digit', minute: '2-digit' })} />
                    </div>
                </div>

                {/* System totals */}
                {!loadingSummary && summary && (
                    <div style={{ background: '#fff', borderRadius: 14, padding: '16px 20px', marginBottom: 16, border: '1px solid #e5e7eb' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <div style={{ width: 3, height: 18, background: '#FCC247', borderRadius: 2 }} />
                            <p style={{ margin: 0, fontWeight: 800, fontSize: '0.88rem', color: '#1E2124' }}>System Totals (Today)</p>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
                            {CATEGORIES.map(c => (
                                <div key={c.key} style={{ padding: '10px 12px', borderRadius: 10, background: '#FBFBFD', border: '1px solid #f1f5f9' }}>
                                    <p style={{ margin: '0 0 2px', fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>{c.label}</p>
                                    <p style={{ margin: 0, fontWeight: 800, fontSize: '0.95rem', color: '#1E2124' }}>SAR {(parseFloat(summary[c.sysKey] ?? 0) || 0).toFixed(2)}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Warning */}
                <div style={{ background: '#FFF9EC', borderRadius: 12, padding: '12px 16px', marginBottom: 16, border: '1px solid #FDE68A', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <AlertTriangle size={18} color="#92400E" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                        <p style={{ margin: '0 0 2px', fontWeight: 800, fontSize: '0.82rem', color: '#92400E' }}>Count First, Then Enter</p>
                        <p style={{ margin: 0, fontSize: '0.78rem', color: '#92400E' }}>Count physical amounts <strong>before</strong> comparing with system totals above. Enter what you actually have.</p>
                    </div>
                </div>

                {/* Physical counts form */}
                <div style={{ background: '#fff', borderRadius: 14, padding: 20, marginBottom: 16, border: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                        <div style={{ width: 3, height: 18, background: '#FCC247', borderRadius: 2 }} />
                        <p style={{ margin: 0, fontWeight: 800, fontSize: '0.88rem', color: '#1E2124' }}>Physical Counts</p>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                        {CATEGORIES.map(c => (
                            <div key={c.key}>
                                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: 6 }}>{c.label} (SAR)</label>
                                <input type="number" step="0.01" placeholder="0.00" value={counts[c.key]} onChange={e => setCount(c.key, e.target.value)}
                                    style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: '1rem', fontWeight: 700, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                            </div>
                        ))}
                    </div>
                    <div style={{ marginTop: 14 }}>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: 6 }}>Notes (Optional)</label>
                        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any issues, adjustments, or explanations..."
                            style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: '0.88rem', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical', minHeight: 70 }} />
                    </div>
                </div>

                {/* Reconciliation preview */}
                {summary && (
                    <div style={{ background: '#fff', borderRadius: 14, padding: 20, marginBottom: 20, border: '1px solid #e5e7eb' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                            <div style={{ width: 3, height: 18, background: '#FCC247', borderRadius: 2 }} />
                            <p style={{ margin: 0, fontWeight: 800, fontSize: '0.88rem', color: '#1E2124' }}>Reconciliation Preview</p>
                        </div>
                        <ReconTable rows={rows} totalSystem={totalSystem} totalPhysical={totalPhysical} totalDiff={totalDiff} />
                    </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 12 }}>
                    {onBack && (
                        <button onClick={onBack} disabled={submitting}
                            style={{ flex: 1, height: 48, border: '1.5px solid #e5e7eb', borderRadius: 12, background: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem', color: '#475569', fontFamily: 'inherit' }}>
                            Cancel / Back to POS
                        </button>
                    )}
                    <button onClick={handleSubmit} disabled={submitting}
                        style={{ flex: 2, height: 48, border: 'none', borderRadius: 12, background: submitting ? '#e5e7eb' : '#23262D', color: submitting ? '#94a3b8' : '#FCC247', cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 900, fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit' }}>
                        <Lock size={16} /> {submitting ? 'Submitting…' : 'Submit & Lock Shift'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function Stat({ label, value }) {
    return (
        <div>
            <p style={{ margin: '0 0 3px', color: '#94a3b8', fontSize: '0.72rem' }}>{label}</p>
            <p style={{ margin: 0, fontWeight: 700, color: '#fff' }}>{value}</p>
        </div>
    );
}

function ReconTable({ rows, totalSystem, totalPhysical, totalDiff }) {
    return (
        <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr 1fr', gap: 8, padding: '0 8px 8px', fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.3, borderBottom: '1px solid #e5e7eb' }}>
                <span>Category</span>
                <span style={{ textAlign: 'right' }}>System</span>
                <span style={{ textAlign: 'right' }}>Physical</span>
                <span style={{ textAlign: 'right' }}>Difference</span>
            </div>
            {rows.map(r => {
                const diffColor = Math.abs(r.diff) < 0.01 ? '#64748b' : r.diff > 0 ? '#15803D' : '#B91C1C';
                return (
                    <div key={r.key} style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr 1fr', gap: 8, padding: '10px 8px', fontSize: '0.82rem', borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, color: '#1E2124' }}>{r.label}</span>
                        <span style={{ textAlign: 'right', color: '#64748b' }}>{r.system.toFixed(2)}</span>
                        <span style={{ textAlign: 'right', color: '#1E2124', fontWeight: 700 }}>{r.physical.toFixed(2)}</span>
                        <span style={{ textAlign: 'right', color: diffColor, fontWeight: 800 }}>
                            {r.diff > 0 ? '+' : ''}{r.diff.toFixed(2)}
                        </span>
                    </div>
                );
            })}
            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr 1fr', gap: 8, padding: '12px 8px 4px', fontSize: '0.88rem', fontWeight: 900, color: '#1E2124' }}>
                <span>Total</span>
                <span style={{ textAlign: 'right', color: '#64748b' }}>{totalSystem.toFixed(2)}</span>
                <span style={{ textAlign: 'right' }}>{totalPhysical.toFixed(2)}</span>
                <span style={{ textAlign: 'right', color: Math.abs(totalDiff) < 0.01 ? '#15803D' : totalDiff > 0 ? '#15803D' : '#B91C1C' }}>
                    {totalDiff > 0 ? '+' : ''}{totalDiff.toFixed(2)}
                </span>
            </div>
            {Math.abs(totalDiff) >= 0.01 && (
                <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, background: totalDiff > 0 ? '#DCFCE7' : '#FEE2E2' }}>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: '0.82rem', color: totalDiff > 0 ? '#15803D' : '#B91C1C' }}>
                        {totalDiff > 0 ? 'Overage' : 'Shortage'}: SAR {Math.abs(totalDiff).toFixed(2)}
                    </p>
                </div>
            )}
        </div>
    );
}
