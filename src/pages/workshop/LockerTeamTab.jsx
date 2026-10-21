import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Info, ShieldCheck, Truck } from 'lucide-react';
import { apiFetch } from '../../services/api';
import WsTableScroll from '../../components/workshop/WsTableScroll';
import { usePagedRows } from '../../hooks/usePagedRows';
import LockerTablePager from '../locker/LockerTablePager';

function TeamTable({ title, icon, users, emptyLabel, t, dateLocale }) {
    const Icon = icon;
    const dash = t('emdash');
    const topRef = useRef(null);
    const { pagedRows, pagerProps } = usePagedRows(users, { scrollRef: topRef });
    return (
        <section className="wlk-panel" ref={topRef}>
            <header className="wlk-panel__head">
                <span className="wlk-panel__icon">
                    <Icon size={16} />
                </span>
                <div className="wlk-panel__titles">
                    <h4>
                        {title}
                        <span className="wlk-panel__badge">{users.length}</span>
                    </h4>
                </div>
            </header>
            <div className="wlk-panel__body wlk-panel__body--flush">
                <WsTableScroll>
                    <table className="wlk-table">
                        <thead>
                            <tr>
                                <th>{t('th.name')}</th>
                                <th>{t('th.email')}</th>
                                <th>{t('th.mobile')}</th>
                                <th>{t('th.account')}</th>
                                <th>{t('th.approval')}</th>
                                <th>{t('th.created')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="wlk-empty">
                                        {emptyLabel}
                                    </td>
                                </tr>
                            ) : (
                                pagedRows.map((u) => {
                                    const approval = String(u.approvalStatus || '').toLowerCase();
                                    const approvalCls =
                                        approval === 'approved'
                                            ? 'wlk-pill wlk-pill--success'
                                            : approval === 'rejected'
                                              ? 'wlk-pill wlk-pill--danger'
                                              : 'wlk-pill wlk-pill--warn';
                                    const approvalLabel =
                                        approval === 'approved'
                                            ? t('status.approved')
                                            : approval === 'rejected'
                                              ? t('status.rejected')
                                              : t('status.pending');
                                    return (
                                        <tr key={u.id}>
                                            <td>{u.name || dash}</td>
                                            <td>{u.email || dash}</td>
                                            <td>{u.mobile || dash}</td>
                                            <td>
                                                <span className={u.isActive ? 'wlk-pill wlk-pill--success' : 'wlk-pill'}>
                                                    {u.isActive ? t('team.active') : t('team.inactive')}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={approvalCls}>{approvalLabel}</span>
                                            </td>
                                            <td>
                                                {u.createdAt
                                                    ? new Date(u.createdAt).toLocaleDateString(dateLocale)
                                                    : dash}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </WsTableScroll>
                <LockerTablePager {...pagerProps} />
            </div>
        </section>
    );
}

/** Locker portal accounts (supervisors + collectors), moved off the dashboard into its own tab. */
export default function LockerTeamTab({ locale, t }) {
    const dateLocale = locale === 'ar' ? 'ar-SA' : 'en-US';
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await apiFetch('/locker/team');
            if (res?.success === false) throw new Error(res?.message || t('err.team'));
            setUsers(Array.isArray(res?.users) ? res.users : []);
        } catch (e) {
            setError(e?.message || t('err.team'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        void load();
    }, [load]);

    const supervisors = useMemo(() => users.filter((u) => u.role === 'supervisor'), [users]);
    const collectors = useMemo(() => users.filter((u) => u.role === 'collector'), [users]);

    return (
        <div className="wlk-page wlk-dash">
            <div className="wlk-dash__toolbar">
                <div>
                    <h3 className="wlk-dash__title">{t('team.title')}</h3>
                    <p className="wlk-dash__sub">{t('team.subtitle')}</p>
                </div>
                <div className="wlk-dash__controls">
                    <button type="button" className="btn-secondary wlk-icon-btn" onClick={() => void load()} disabled={loading}>
                        <RefreshCw size={15} className={loading ? 'spin' : ''} />
                        {t('btn.refresh')}
                    </button>
                </div>
            </div>

            {error ? <div className="wlk-error">{error}</div> : null}

            <div className="wlk-info">
                <Info size={16} />
                <span>
                    {t('info.before')} <strong>{t('info.employees')}</strong> {t('info.mid')}{' '}
                    <code>locker_supervisor</code> {t('info.or')} <code>locker_collector</code>
                    {t('info.afterRoles')} <code>/locker/login</code>.
                </span>
            </div>

            <TeamTable
                title={t('section.supervisors')}
                icon={ShieldCheck}
                users={supervisors}
                emptyLabel={t('empty.supervisors')}
                t={t}
                dateLocale={dateLocale}
            />
            <TeamTable
                title={t('section.collectors')}
                icon={Truck}
                users={collectors}
                emptyLabel={t('empty.collectors')}
                t={t}
                dateLocale={dateLocale}
            />
        </div>
    );
}
