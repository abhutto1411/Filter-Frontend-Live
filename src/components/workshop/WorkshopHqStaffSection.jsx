import { useEffect, useState } from 'react';
import { listMyHqStaff } from '../../services/hqStaffApi';
import { hqT } from '../../utils/hqStaffI18n';

const money = (n) => (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dmy = (ymd) => (ymd ? String(ymd).slice(0, 10).split('-').reverse().join('/') : '');

/**
 * Workshop → Employees: Platform-HQ people Super Admin linked to this workshop.
 * Renders nothing when there are none, so ordinary workshops see no change.
 */
export default function WorkshopHqStaffSection({ locale = 'en', workshopId }) {
    const t = (k, v) => hqT(locale, k, v);
    const [rows, setRows] = useState([]);
    useEffect(() => {
        let cancelled = false;
        listMyHqStaff(workshopId ? { workshopId: String(workshopId) } : {})
            .then((res) => {
                const list = Array.isArray(res?.people) ? res.people : Array.isArray(res?.data?.people) ? res.data.people : [];
                if (!cancelled) setRows(list);
            })
            .catch(() => !cancelled && setRows([]));
        return () => {
            cancelled = true;
        };
    }, [workshopId]);
    if (!rows.length) return null;
    return (
        <div className="ws-section" style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 10 }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>{t('ws.title')}</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{t('ws.sub')}</p>
            </div>
            <div style={{ overflowX: 'auto' }}>
                <table className="ws-table">
                    <thead>
                        <tr>
                            <th>{t('th.person')}</th>
                            <th>{t('h.branch')}</th>
                            <th>{t('th.bearer')}</th>
                            <th>{t('ws.period')}</th>
                            <th>{t('h.status')}</th>
                            <th style={{ textAlign: 'end' }}>{t('ws.recharged')}</th>
                            <th style={{ textAlign: 'end' }}>{t('ws.owed')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={r.id}>
                                <td>
                                    <strong>{r.displayName}</strong>
                                    <div>
                                        <span className="ws-badge ws-badge--gray" style={{ marginTop: 4, fontSize: '0.6875rem' }}>{t('ws.badge')}</span>
                                    </div>
                                </td>
                                <td>{r.branchName || t('f.anyBranch')}</td>
                                <td>
                                    <span className={`ws-badge ${r.costBearer === 'hq' ? 'ws-badge--yellow' : 'ws-badge--gray'}`} title={t(`bearer.${r.costBearer}.help`)}>
                                        {r.costBearer === 'hq' ? t('bearer.hq') : t('bearer.workshop')}
                                    </span>
                                </td>
                                <td>
                                    {dmy(r.startDate)} → {r.endDate ? dmy(r.endDate) : t('ws.ongoing')}
                                </td>
                                <td>
                                    <span className={`ws-badge ${r.status === 'active' ? 'ws-badge--green' : 'ws-badge--gray'}`}>{t(`st.${r.status}`)}</span>
                                </td>
                                <td style={{ textAlign: 'end' }}>{r.costBearer === 'hq' || r.recharged ? `SAR ${money(r.recharged)}` : '—'}</td>
                                <td style={{ textAlign: 'end', fontWeight: 700 }}>
                                    {r.costBearer === 'hq' || r.recharged ? `SAR ${money((r.recharged || 0) - (r.rechargeSettled || 0))}` : '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
