import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Plus, Bell, Wallet, TrendingDown } from 'lucide-react';
import { listSalaryAdvances, createSalaryAdvance, updateSalaryAdvance } from '../../../services/staffAppApi';
import { useStaffAppScope, staffAppQueryParams } from '../../../context/StaffAppScopeContext';
import { staffAppStatusLabel, useStaffAppI18n } from '../../../utils/staffAppI18n';

function StatusBadge({ status, locale }) {
    const s = String(status || '').toLowerCase();
    let cls = 'staff-app-badge--pending';
    if (['finance approved', 'credited', 'settled'].includes(s)) cls = 'staff-app-badge--approved';
    if (s === 'rejected') cls = 'staff-app-badge--rejected';
    return <span className={`staff-app-badge ${cls}`}>{staffAppStatusLabel(locale, status)}</span>;
}

const fmt = (n, locale) => Number(n || 0).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-SA', { minimumFractionDigits: 2 });

const ACTIVE_LOAN_STATUSES = new Set([
    'Pending',
    'Manager Approved',
    'Finance Approved',
    'Credited',
]);

export default function StaffAppSalaryAdvances() {
    const scope = useStaffAppScope();
    const { locale, t } = useStaffAppI18n();
    const [section, setSection] = useState('salary');
    const [rows, setRows] = useState([]);
    const [totalOutstanding, setTotalOutstanding] = useState(0);
    const [activeLoanCount, setActiveLoanCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [formOpen, setFormOpen] = useState(false);
    const [form, setForm] = useState({ requestedAmount: '', reason: '' });

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await listSalaryAdvances(staffAppQueryParams({ limit: 100 }, scope));
            setRows(res?.items ?? res?.data?.items ?? []);
            setTotalOutstanding(Number(res?.totalOutstanding ?? 0));
            setActiveLoanCount(Number(res?.activeLoanCount ?? 0));
        } catch (e) {
            setError(e?.message || t('salary.errLoad'));
            setRows([]);
            setTotalOutstanding(0);
            setActiveLoanCount(0);
        } finally {
            setLoading(false);
        }
    }, [scope, t]);

    useEffect(() => { load(); }, [load]);

    const activeLoans = useMemo(
        () => rows.filter((r) => ACTIVE_LOAN_STATUSES.has(r.status) && Number(r.remainingBalance) > 0),
        [rows],
    );

    const handleCreate = async () => {
        const amt = Number(form.requestedAmount);
        if (!Number.isFinite(amt) || amt <= 0) {
            setError(t('salary.errAmount'));
            return;
        }
        try {
            await createSalaryAdvance({
                requestedAmount: amt,
                reason: form.reason.trim() || t('salary.defaultReason'),
            }, scope.scopeParams());
            setFormOpen(false);
            setForm({ requestedAmount: '', reason: '' });
            setSection('advances');
            await load();
        } catch (e) {
            setError(e?.message || t('salary.errCreate'));
        }
    };

    const handleAction = async (id, action) => {
        try {
            await updateSalaryAdvance(id, { action }, scope.scopeParams());
            await load();
        } catch (e) {
            setError(e?.message || t('salary.errAction'));
        }
    };

    return (
        <div>
            <div className="staff-app-toolbar">
                <h2 style={{ margin: 0, fontSize: '1.125rem', flex: 1 }}>{t('salary.title')}</h2>
                {section === 'advances' && (
                    <button type="button" className="staff-app-btn staff-app-btn--primary" onClick={() => setFormOpen(true)}>
                        <Plus size={14} /> {t('salary.newAdvance')}
                    </button>
                )}
                <button type="button" className="staff-app-btn" onClick={load} disabled={loading}>
                    <RefreshCw size={14} />
                </button>
            </div>

            <div className="staff-app-inner-tabs" style={{ marginBottom: 16 }}>
                <button
                    type="button"
                    className={`staff-app-subnav__btn ${section === 'salary' ? 'active' : ''}`}
                    onClick={() => setSection('salary')}
                >
                    {t('salary.tabSalary')}
                </button>
                <button
                    type="button"
                    className={`staff-app-subnav__btn ${section === 'advances' ? 'active' : ''}`}
                    onClick={() => setSection('advances')}
                >
                    {t('salary.tabAdvances')}
                </button>
            </div>

            {error && <p style={{ color: '#b91c1c', marginBottom: 8 }}>{error}</p>}

            {section === 'salary' && (
                <div className="staff-app-info-panel">
                    <div className="staff-app-info-panel__icon">
                        <Bell size={28} />
                    </div>
                    <div>
                        <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>{t('salary.slipTitle')}</h3>
                        <p style={{ margin: 0, color: '#4b5563', lineHeight: 1.55, fontSize: '0.9rem' }}>
                            {t('salary.slipBody')}
                        </p>
                        <p style={{ margin: '12px 0 0', color: '#6b7280', fontSize: '0.8125rem' }}>
                            {t('salary.slipHint')}
                        </p>
                    </div>
                </div>
            )}

            {section === 'advances' && (
                <>
                    <div className="staff-app-card-grid" style={{ marginBottom: 16 }}>
                        <div className="staff-app-stat-card">
                            <h3><Wallet size={14} style={{ marginRight: 6 }} />{t('salary.outstanding')}</h3>
                            <p>{fmt(totalOutstanding, locale)} <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{t('common.sar')}</span></p>
                        </div>
                        <div className="staff-app-stat-card">
                            <h3><TrendingDown size={14} style={{ marginRight: 6 }} />{t('salary.activeAdvances')}</h3>
                            <p>{activeLoanCount}</p>
                        </div>
                    </div>

                    <div className="staff-app-info-panel staff-app-info-panel--compact" style={{ marginBottom: 16 }}>
                        <p style={{ margin: 0, fontSize: '0.875rem', color: '#4b5563', lineHeight: 1.5 }}>
                            <strong>{t('salary.howRepayTitle')}</strong> {t('salary.howRepayBody')}
                        </p>
                    </div>

                    {formOpen && (
                        <div className="staff-app-table-wrap" style={{ padding: 16, marginBottom: 12 }}>
                            <h3 style={{ marginTop: 0 }}>{t('salary.requestTitle')}</h3>
                            <input className="staff-app-btn" placeholder={t('salary.ph.amount')} value={form.requestedAmount} onChange={(e) => setForm((f) => ({ ...f, requestedAmount: e.target.value }))} />
                            <textarea className="staff-app-btn" rows={2} style={{ marginTop: 8, width: '100%' }} placeholder={t('salary.ph.reason')} value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
                            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                                <button type="button" className="staff-app-btn staff-app-btn--primary" onClick={handleCreate}>{t('salary.submitRequest')}</button>
                                <button type="button" className="staff-app-btn" onClick={() => setFormOpen(false)}>{t('common.cancel')}</button>
                            </div>
                        </div>
                    )}

                    <div className="staff-app-table-wrap">
                        {loading ? (
                            <p className="staff-app-empty">{t('common.loading')}</p>
                        ) : rows.length === 0 ? (
                            <p className="staff-app-empty">{t('salary.empty')}</p>
                        ) : (
                            <table className="staff-app-table">
                                <thead>
                                    <tr>
                                        <th>{t('salary.th.employee')}</th>
                                        <th>{t('salary.th.requested')}</th>
                                        <th>{t('salary.th.monthly')}</th>
                                        <th>{t('salary.th.remaining')}</th>
                                        <th>{t('salary.th.status')}</th>
                                        <th>{t('salary.th.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row) => (
                                        <tr key={row.id}>
                                            <td>{row.employeeName || t('common.emdash')}</td>
                                            <td>{fmt(row.requestedAmount, locale)}</td>
                                            <td>{Number(row.monthlyDeduction) > 0 ? fmt(row.monthlyDeduction, locale) : t('common.emdash')}</td>
                                            <td>
                                                <strong>{fmt(row.remainingBalance, locale)}</strong>
                                                {ACTIVE_LOAN_STATUSES.has(row.status) && Number(row.remainingBalance) > 0 && (
                                                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{t('salary.afterDeductions')}</div>
                                                )}
                                            </td>
                                            <td><StatusBadge status={row.status} locale={locale} /></td>
                                            <td>
                                                {row.status === 'Pending' && (
                                                    <button type="button" className="staff-app-btn" onClick={() => handleAction(row.id, 'manager_approve')}>{t('salary.managerOk')}</button>
                                                )}
                                                {row.status === 'Manager Approved' && (
                                                    <button type="button" className="staff-app-btn" onClick={() => handleAction(row.id, 'finance_approve')}>{t('salary.financeOk')}</button>
                                                )}
                                                {row.status === 'Finance Approved' && (
                                                    <button type="button" className="staff-app-btn staff-app-btn--primary" onClick={() => handleAction(row.id, 'credit')}>{t('salary.creditWallet')}</button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {!loading && activeLoans.length > 0 && (
                        <p style={{ marginTop: 12, fontSize: '0.8125rem', color: '#6b7280' }}>
                            {t('salary.activeSummary', { count: activeLoans.length, amount: fmt(totalOutstanding, locale) })}
                        </p>
                    )}
                </>
            )}
        </div>
    );
}
