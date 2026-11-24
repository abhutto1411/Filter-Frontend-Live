import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { ArrowRightLeft, Building2, KeyRound, Link2, Pencil, Search, Unlink, UserPlus, Users, Wallet } from 'lucide-react';
import { getBranches, getWorkshopOptions } from '../../services/superAdminApi';
import {
    assignHqStaff,
    createHqEmployee,
    disableHqLogin,
    endHqStaffLink,
    getHqStaffPerson,
    getHqStaffRecharges,
    listHqStaff,
    setHqLogin,
    transferHqStaff,
    updateHqEmployee,
} from '../../services/hqStaffApi';
import { hqT } from '../../utils/hqStaffI18n';
import { toRiyadhDateISO } from '../../utils/riyadhBusinessRange';
import { useAdminPageMeta } from '../../context/AdminPageMetaContext';
import '../../styles/ui.css';
import './adminHqStaffLinks.css';

/**
 * Super Admin → Employees → Platform-HQ links (full pages, no modals).
 *   /admin/employees/hq-links              people + current link
 *   /admin/employees/hq-links/new          new HQ employee (HR record, optional login)
 *   /admin/employees/hq-links/recharges    HQ-cost salary recharged by workshops
 *   /admin/employees/hq-links/:userId      one person: link / transfer / end, history
 */
const BASE = '/admin/employees/hq-links';
const money = (n) => (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dmy = (ymd) => (ymd ? String(ymd).slice(0, 10).split('-').reverse().join('/') : '—');
const pickArray = (res, keys) => {
    if (Array.isArray(res)) return res;
    for (const k of keys) {
        if (Array.isArray(res?.[k])) return res[k];
        if (Array.isArray(res?.data?.[k])) return res.data[k];
    }
    if (Array.isArray(res?.data)) return res.data;
    return [];
};
const body = (res) => (res && res.success !== undefined && res.data && !Array.isArray(res.data) ? res.data : res);

const JOB_TITLES = ['technician', 'cashier', 'supervisor', 'accountant', 'driver', 'admin', 'other'];
const jobLabel = (t, key) => {
    const k = String(key || '').toLowerCase();
    if (JOB_TITLES.includes(k)) return t(`job.${k}`);
    return k ? k.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) : '—';
};

function BearerPill({ bearer, t }) {
    return (
        <span className={`ui-pill ${bearer === 'hq' ? 'ui-pill--warn' : 'ui-pill--info'}`}>
            {bearer === 'hq' ? t('bearer.hq') : t('bearer.workshop')}
        </span>
    );
}

export default function AdminHqStaffLinks() {
    const outletCtx = useOutletContext() || {};
    const locale = outletCtx.locale || (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) || 'en';
    const t = useCallback((k, v) => hqT(locale, k, v), [locale]);
    const { pathname } = useLocation();
    const { setPageTitle } = useAdminPageMeta();
    useEffect(() => {
        // AdminLayout leaves /admin/employees/hq-links titles alone; clear ours on unmount.
        setPageTitle(t('title.short'));
        return () => setPageTitle(null);
    }, [setPageTitle, t]);
    const rest = pathname.replace(/^\/admin\/employees\/hq-links\/?/, '');
    const [first] = rest.split('/').filter(Boolean);
    let view;
    if (!first) view = <PeopleList t={t} />;
    else if (first === 'recharges') view = <RechargeReport t={t} />;
    else if (first === 'new') view = <NewEmployee t={t} />;
    else view = <PersonDetail key={first} userId={decodeURIComponent(first)} t={t} />;
    return (
        <div className="ui-root ui-root--flush ui-stack hqs-page" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
            {view}
        </div>
    );
}

/* ─────────────────────────────── List ─────────────────────────────── */

function PeopleList({ t }) {
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [err, setErr] = useState('');
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [linked, setLinked] = useState('');

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setErr('');
        listHqStaff({ linked: linked || undefined })
            .then((res) => !cancelled && setData(body(res)))
            .catch((e) => !cancelled && setErr(e?.message || t('err')))
            .finally(() => !cancelled && setLoading(false));
        return () => {
            cancelled = true;
        };
    }, [linked, t]);

    const people = useMemo(() => {
        const rows = Array.isArray(data?.people) ? data.people : [];
        const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
        if (!words.length) return rows;
        return rows.filter((p) => {
            const hay = [p.name, p.mobile, p.email, p.jobTitle, p.jobTitle ? t(`job.${p.jobTitle}`) : '', p.current?.workshopName, p.current?.branchName, ...(p.roles || [])].join(' ').toLowerCase();
            return words.every((w) => hay.includes(w));
        });
    }, [data, search, t]);

    return (
        <>
            <button type="button" className="ui-link hqs-back" onClick={() => navigate('/admin/employees')}>
                {t('back.employees')}
            </button>
            <div className="hqs-head">
                <div>
                    <h1 className="hqs-title">{t('title')}</h1>
                    <p className="hqs-sub">{t('sub')}</p>
                </div>
                <div className="hqs-actions">
                    <button type="button" className="ui-btn ui-btn--default ui-btn--sm" onClick={() => navigate(`${BASE}/recharges`)}>
                        <Wallet size={14} /> {t('btn.report')}
                    </button>
                    <button type="button" className="ui-btn ui-btn--primary ui-btn--sm" onClick={() => navigate(`${BASE}/new`)}>
                        <UserPlus size={14} /> {t('emp.add')}
                    </button>
                </div>
            </div>
            {err ? <div className="ui-banner ui-banner--dang">{err}</div> : null}
            <div className="ui-kpis">
                <div className="ui-metric">
                    <span className="ui-metric-icon"><Users size={62} strokeWidth={1.1} /></span>
                    <div className="ui-metric-label">{t('kpi.people')}</div>
                    <div className="ui-metric-value">{loading ? '…' : data?.total ?? 0}</div>
                </div>
                <div className="ui-metric ui-metric--ok">
                    <span className="ui-metric-icon"><Link2 size={62} strokeWidth={1.1} /></span>
                    <div className="ui-metric-label">{t('kpi.linked')}</div>
                    <div className="ui-metric-value">{loading ? '…' : data?.linkedCount ?? 0}</div>
                </div>
                <div className="ui-metric ui-metric--warn">
                    <span className="ui-metric-icon"><Building2 size={62} strokeWidth={1.1} /></span>
                    <div className="ui-metric-label">{t('kpi.hq')}</div>
                    <div className="ui-metric-value">{loading ? '…' : data?.hqBearerCount ?? 0}</div>
                </div>
            </div>
            <div className="ui-table-wrap">
                <div className="ui-toolbar ui-toolbar--standalone">
                    <div className="ui-search">
                        <Search size={14} />
                        <input type="text" className="ui-input" placeholder={t('search')} value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                    <div className="ui-chips" role="tablist">
                        {[
                            ['', 'chip.all'],
                            ['yes', 'chip.linked'],
                            ['no', 'chip.unlinked'],
                        ].map(([id, k]) => (
                            <button key={k} type="button" role="tab" aria-selected={linked === id} className={`ui-chip${linked === id ? ' ui-chip--on' : ''}`} onClick={() => setLinked(id)}>
                                {t(k)}
                            </button>
                        ))}
                    </div>
                </div>
                {loading ? (
                    <div className="hqs-muted">{t('loading')}</div>
                ) : !people.length ? (
                    <div className="ui-empty">
                        <div className="ui-empty-title">{t('empty')}</div>
                    </div>
                ) : (
                    <table className="ui-table">
                        <thead>
                            <tr>
                                <th>{t('th.person')}</th>
                                <th>{t('th.contact')}</th>
                                <th>{t('th.login')}</th>
                                <th>{t('th.link')}</th>
                                <th>{t('th.bearer')}</th>
                                <th>{t('th.since')}</th>
                                <th className="num">{t('th.links')}</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {people.map((p) => (
                                <tr key={p.userId} className="hqs-row" tabIndex={0} onClick={() => navigate(`${BASE}/${encodeURIComponent(p.userId)}`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`${BASE}/${encodeURIComponent(p.userId)}`)}>
                                    <td>
                                        <div className="hqs-strong">
                                            {p.name}
                                            {p.isActive === false ? <span className="ui-pill ui-pill--neutral hqs-ml">{t('st.inactive')}</span> : null}
                                        </div>
                                        <div className="hqs-muted-sm">
                                            {p.employeeId ? jobLabel(t, p.jobTitle || (p.roles || [])[0]) : <span className="ui-pill ui-pill--warn">{t('chip.noRecord')}</span>}
                                        </div>
                                    </td>
                                    <td>
                                        <div>{p.mobile || '—'}</div>
                                        <div className="hqs-muted-sm">{p.email || ''}</div>
                                    </td>
                                    <td>
                                        <span className={`ui-pill ${p.loginEnabled ? 'ui-pill--ok' : 'ui-pill--neutral'}`}>
                                            {p.loginEnabled ? t('login.on') : t('login.off')}
                                        </span>
                                    </td>
                                    <td>
                                        {p.current ? (
                                            <>
                                                <div className="hqs-strong">{p.current.workshopName}</div>
                                                <div className="hqs-muted-sm">{p.current.branchName || t('f.anyBranch')}</div>
                                            </>
                                        ) : (
                                            <span className="ui-pill ui-pill--neutral">{t('none')}</span>
                                        )}
                                    </td>
                                    <td>{p.current ? <BearerPill bearer={p.current.costBearer} t={t} /> : '—'}</td>
                                    <td>{p.current ? dmy(p.current.startDate) : '—'}</td>
                                    <td className="num">{p.links}</td>
                                    <td>
                                        <button type="button" className="ui-btn ui-btn--subtle ui-btn--sm">{t('btn.open')}</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </>
    );
}

/* ─────────────────────────────── Link form ─────────────────────────────── */

function useWorkshopsAndBranches(workshopId) {
    const [workshops, setWorkshops] = useState([]);
    const [branches, setBranches] = useState([]);
    useEffect(() => {
        getWorkshopOptions()
            .then((res) =>
                setWorkshops(
                    pickArray(res, ['options', 'workshops'])
                        .map((w) => ({ id: String(w.id ?? w.value ?? w.workshopId ?? ''), name: w.name ?? w.label ?? w.workshopName ?? '', isHq: Boolean(w.isPlatformHq) }))
                        .filter((w) => w.id && !/^platform hq$/i.test(w.name) && !w.isHq),
                ),
            )
            .catch(() => setWorkshops([]));
    }, []);
    useEffect(() => {
        if (!workshopId) {
            setBranches([]);
            return;
        }
        getBranches({ workshopId, limit: 200 })
            .then((res) => setBranches(pickArray(res, ['branches']).map((b) => ({ id: String(b.id), name: b.name }))))
            .catch(() => setBranches([]));
    }, [workshopId]);
    return { workshops, branches };
}

function LinkForm({ t, mode, initial, onDone, onCancel, userId }) {
    const [f, setF] = useState(() => ({
        workshopId: initial?.workshopId || '',
        branchId: initial?.branchId || '',
        costBearer: initial?.costBearer || 'workshop',
        startDate: toRiyadhDateISO(),
        note: '',
    }));
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const { workshops, branches } = useWorkshopsAndBranches(f.workshopId);
    const set = (patch) => setF((x) => ({ ...x, ...patch }));
    const submit = async () => {
        if (!f.workshopId) return setErr(t('f.pickWorkshop'));
        setBusy(true);
        setErr('');
        try {
            const payload = { workshopId: f.workshopId, branchId: f.branchId || null, costBearer: f.costBearer, startDate: f.startDate, note: f.note || undefined };
            if (mode === 'transfer') await transferHqStaff(userId, payload);
            else await assignHqStaff(userId, payload);
            onDone(mode === 'transfer' ? t('ok.transfer') : t('ok.assign'));
        } catch (e) {
            setErr(e?.message || t('err'));
        } finally {
            setBusy(false);
        }
    };
    return (
        <div className="hqs-form">
            {mode === 'transfer' ? <div className="ui-banner ui-banner--info">{t('transfer.note')}</div> : null}
            {err ? <div className="ui-banner ui-banner--dang">{err}</div> : null}
            <div className="ui-form-grid hqs-grid">
                <label className="ui-field">
                    <span className="ui-fieldlabel">{t('f.workshop')} <span className="ui-field-req">*</span></span>
                    <select className="ui-select" value={f.workshopId} onChange={(e) => set({ workshopId: e.target.value, branchId: '' })}>
                        <option value="">{t('f.pickWorkshop')}</option>
                        {workshops.map((w) => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                    </select>
                </label>
                <label className="ui-field">
                    <span className="ui-fieldlabel">{t('f.branch')}</span>
                    <select className="ui-select" value={f.branchId} disabled={!f.workshopId} onChange={(e) => set({ branchId: e.target.value })}>
                        <option value="">{t('f.anyBranch')}</option>
                        {branches.map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </label>
                <label className="ui-field">
                    <span className="ui-fieldlabel">{t('f.start')}</span>
                    <input type="date" className="ui-input" value={f.startDate} onChange={(e) => set({ startDate: e.target.value })} />
                </label>
                <label className="ui-field">
                    <span className="ui-fieldlabel">{t('f.note')}</span>
                    <input className="ui-input" maxLength={500} value={f.note} onChange={(e) => set({ note: e.target.value })} />
                </label>
            </div>
            <div className="ui-fieldlabel hqs-mt">{t('f.bearer')}</div>
            <div className="hqs-bearers" role="radiogroup">
                {['workshop', 'hq'].map((b) => (
                    <button key={b} type="button" role="radio" aria-checked={f.costBearer === b} className={`hqs-bearer${f.costBearer === b ? ' is-on' : ''}`} onClick={() => set({ costBearer: b })}>
                        <span className="hqs-bearer-title">{t(`bearer.${b}.long`)}</span>
                        <span className="hqs-bearer-help">{t(`bearer.${b}.help`)}</span>
                    </button>
                ))}
            </div>
            <div className="ui-form-foot">
                <button type="button" className="ui-btn ui-btn--default" disabled={busy} onClick={onCancel}>{t('btn.cancel')}</button>
                <button type="button" className="ui-btn ui-btn--primary" disabled={busy || !f.workshopId} onClick={submit}>
                    {busy ? t('btn.working') : mode === 'transfer' ? t('btn.transfer') : t('btn.assign')}
                </button>
            </div>
        </div>
    );
}

/* ─────────────────────────────── Person ─────────────────────────────── */

function PersonDetail({ userId, t }) {
    const navigate = useNavigate();
    const location = useLocation();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [ok, setOk] = useState(() => location.state?.ok || '');
    const [mode, setMode] = useState(''); // '' | 'transfer' | 'end'
    const [endF, setEndF] = useState({ endDate: toRiyadhDateISO(), reason: '' });
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            setData(body(await getHqStaffPerson(userId)));
        } catch (e) {
            setErr(e?.message || t('err'));
        } finally {
            setLoading(false);
        }
    }, [userId, t]);
    useEffect(() => {
        load();
    }, [load]);

    const done = (msg) => {
        setOk(msg);
        setMode('');
        load();
        window.scrollTo?.({ top: 0, behavior: 'smooth' });
    };
    const endLink = async () => {
        setBusy(true);
        setErr('');
        try {
            await endHqStaffLink(data.current.id, endF);
            done(t('ok.end'));
        } catch (e) {
            setErr(e?.message || t('err'));
        } finally {
            setBusy(false);
        }
    };

    if (loading && !data) return <div className="hqs-muted">{t('loading')}</div>;
    if (!data) {
        return (
            <>
                <button type="button" className="ui-link hqs-back" onClick={() => navigate(BASE)}>{t('back.list')}</button>
                <div className="ui-banner ui-banner--dang">{err || t('err')}</div>
            </>
        );
    }
    const { person, current, open, history = [], recharges = [] } = data;
    const blocked = open && (Math.abs(open.advanceOutstanding) > 0.005 || open.draftSlips > 0);

    return (
        <>
            <button type="button" className="ui-link hqs-back" onClick={() => navigate(BASE)}>{t('back.list')}</button>
            {ok ? <div className="ui-banner ui-banner--ok">{ok}</div> : null}
            {err ? <div className="ui-banner ui-banner--dang">{err}</div> : null}
            <div className="hqs-head">
                <div>
                    <h1 className="hqs-title">
                        {person.name} <span className="ui-pill ui-pill--neutral">Platform-HQ</span>
                        {person.isActive === false ? <span className="ui-pill ui-pill--warn">{t('st.inactive')}</span> : null}
                    </h1>
                    <p className="hqs-sub">
                        {jobLabel(t, person.jobTitle || (person.roles || [])[0])} · {t('person.salary')}: SAR {money(person.basicSalary)}
                        {person.mobile ? ` · ${person.mobile}` : ''}
                    </p>
                </div>
            </div>

            <ProfileCard t={t} person={person} userId={userId} onDone={done} onError={setErr} />
            {person.employeeId ? <LoginCard t={t} person={person} userId={userId} onDone={done} onError={setErr} /> : null}

            <section className="ui-panel">
                <div className="ui-panel-head">
                    <div className="ui-panel-title">{current ? t('card.current') : t('card.assign')}</div>
                </div>
                <div className="ui-panel-body">
                    {current ? (
                        <>
                            <div className="hqs-facts">
                                <div><span>{t('h.workshop')}</span><strong>{current.workshopName}</strong></div>
                                <div><span>{t('h.branch')}</span><strong>{current.branchName || t('f.anyBranch')}</strong></div>
                                <div><span>{t('h.bearer')}</span><strong><BearerPill bearer={current.costBearer} t={t} /></strong></div>
                                <div><span>{t('h.from')}</span><strong>{dmy(current.startDate)}</strong></div>
                                {current.note ? <div className="hqs-span2"><span>{t('h.note')}</span><strong>{current.note}</strong></div> : null}
                            </div>
                            <div className="hqs-help">{t(`bearer.${current.costBearer}.help`)}</div>
                            {open ? (
                                <div className={`ui-banner ${blocked ? 'ui-banner--warn' : 'ui-banner--info'} hqs-mt`}>
                                    <strong>{t('open.title')}:</strong> {t('open.advance')} SAR {money(open.advanceOutstanding)} · {t('open.draft')} {open.draftSlips}
                                    {blocked ? <div>{t('open.blocked')}</div> : null}
                                </div>
                            ) : null}
                            {mode === '' ? (
                                <div className="ui-form-foot">
                                    <button type="button" className="ui-btn ui-btn--default" onClick={() => setMode('end')}>
                                        <Unlink size={14} /> {t('btn.end')}
                                    </button>
                                    <button type="button" className="ui-btn ui-btn--primary" onClick={() => setMode('transfer')}>
                                        <ArrowRightLeft size={14} /> {t('btn.transfer')}
                                    </button>
                                </div>
                            ) : null}
                        </>
                    ) : (
                        !person.employeeId ? (
                            <div className="hqs-muted">{t('link.needRecord')}</div>
                        ) : person.isActive === false ? (
                            <div className="hqs-muted">{t('link.inactive')}</div>
                        ) : (
                            <LinkForm t={t} mode="assign" userId={userId} onDone={done} onCancel={() => navigate(BASE)} />
                        )
                    )}
                </div>
            </section>

            {current && mode === 'transfer' ? (
                <section className="ui-panel">
                    <div className="ui-panel-head"><div className="ui-panel-title">{t('card.transfer')}</div></div>
                    <div className="ui-panel-body">
                        <LinkForm t={t} mode="transfer" userId={userId} initial={current} onDone={done} onCancel={() => setMode('')} />
                    </div>
                </section>
            ) : null}

            {current && mode === 'end' ? (
                <section className="ui-panel">
                    <div className="ui-panel-head"><div className="ui-panel-title">{t('card.end')}</div></div>
                    <div className="ui-panel-body">
                        <div className="ui-form-grid hqs-grid">
                            <label className="ui-field">
                                <span className="ui-fieldlabel">{t('f.end')}</span>
                                <input type="date" className="ui-input" value={endF.endDate} min={current.startDate} onChange={(e) => setEndF((x) => ({ ...x, endDate: e.target.value }))} />
                            </label>
                            <label className="ui-field">
                                <span className="ui-fieldlabel">{t('f.reason')}</span>
                                <input className="ui-input" maxLength={500} value={endF.reason} onChange={(e) => setEndF((x) => ({ ...x, reason: e.target.value }))} />
                            </label>
                        </div>
                        <div className="ui-form-foot">
                            <button type="button" className="ui-btn ui-btn--default" disabled={busy} onClick={() => setMode('')}>{t('btn.cancel')}</button>
                            <button type="button" className="ui-btn ui-btn--danger" disabled={busy} onClick={endLink}>
                                {busy ? t('btn.working') : t('btn.end')}
                            </button>
                        </div>
                    </div>
                </section>
            ) : null}

            <section className="ui-panel">
                <div className="ui-panel-head"><div className="ui-panel-title">{t('card.history')}</div></div>
                <div className="ui-panel-body">
                    {!history.length ? (
                        <div className="hqs-muted">{t('none')}</div>
                    ) : (
                        <table className="ui-table">
                            <thead>
                                <tr>
                                    <th>{t('h.workshop')}</th>
                                    <th>{t('h.branch')}</th>
                                    <th>{t('h.bearer')}</th>
                                    <th>{t('h.from')}</th>
                                    <th>{t('h.to')}</th>
                                    <th>{t('h.status')}</th>
                                    <th>{t('h.note')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((h) => (
                                    <tr key={h.id}>
                                        <td className="hqs-strong">{h.workshopName}</td>
                                        <td>{h.branchName || t('f.anyBranch')}</td>
                                        <td><BearerPill bearer={h.costBearer} t={t} /></td>
                                        <td>{dmy(h.startDate)}</td>
                                        <td>{h.endDate ? dmy(h.endDate) : '—'}</td>
                                        <td>
                                            <span className={`ui-pill ${h.status === 'active' ? 'ui-pill--ok' : 'ui-pill--neutral'}`}>{t(`st.${h.status}`)}</span>
                                        </td>
                                        <td className="hqs-muted-sm">{[h.note, h.endReason].filter(Boolean).join(' · ') || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </section>

            <section className="ui-panel">
                <div className="ui-panel-head"><div className="ui-panel-title">{t('card.recharges')}</div></div>
                <div className="ui-panel-body">
                    {!recharges.length ? (
                        <div className="hqs-muted">{t('r.none')}</div>
                    ) : (
                        <table className="ui-table">
                            <thead>
                                <tr>
                                    <th>{t('r.ref')}</th>
                                    <th>{t('r.date')}</th>
                                    <th>{t('r.workshop')}</th>
                                    <th className="num">{t('r.amount')}</th>
                                    <th className="num">{t('r.settled')}</th>
                                    <th className="num">{t('r.balance')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recharges.map((r) => (
                                    <tr key={r.ref}>
                                        <td className="hqs-strong">{r.ref}</td>
                                        <td>{dmy(r.date)}</td>
                                        <td>{r.workshopName}</td>
                                        <td className="num">SAR {money(r.amount)}</td>
                                        <td className="num">SAR {money(r.settled)}</td>
                                        <td className="num hqs-strong">SAR {money(r.amount - r.settled)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </section>
        </>
    );
}

/* ─────────────────────────────── Employee record ─────────────────────────────── */

const emptyProfile = () => ({
    name: '',
    mobile: '',
    email: '',
    iqama: '',
    jobTitle: '',
    joiningDate: toRiyadhDateISO(),
    basicSalary: '',
    commissionPercent: '0',
    isActive: true,
});

const profileFrom = (p) => ({
    name: p?.name || '',
    mobile: p?.mobile || '',
    email: p?.email || '',
    iqama: p?.iqama || '',
    jobTitle: JOB_TITLES.includes(String(p?.jobTitle || '')) ? p.jobTitle : '',
    joiningDate: p?.joiningDate || toRiyadhDateISO(),
    basicSalary: p?.basicSalary != null ? String(p.basicSalary) : '',
    commissionPercent: p?.commissionPercent != null ? String(p.commissionPercent) : '0',
    isActive: p?.isActive !== false,
});

const profilePayload = (f) => ({
    name: f.name.trim(),
    mobile: f.mobile.trim(),
    email: f.email.trim() || null,
    iqama: f.iqama.trim() || null,
    jobTitle: f.jobTitle,
    joiningDate: f.joiningDate || null,
    basicSalary: Number(f.basicSalary || 0),
    commissionPercent: Number(f.commissionPercent || 0),
    isActive: f.isActive,
});

function profileProblem(t, f) {
    if (f.name.trim().length < 2) return t('f.name');
    if (!/^\+?[0-9][0-9 ]{6,19}$/.test(f.mobile.trim())) return t('f.mobile');
    if (!f.jobTitle) return t('f.jobTitle');
    if (!(Number(f.basicSalary) >= 0) || String(f.basicSalary).trim() === '') return t('f.salary');
    const c = Number(f.commissionPercent);
    if (!(c >= 0 && c <= 100)) return t('f.commission');
    return '';
}

function EmployeeFields({ t, f, set, showStatus }) {
    return (
        <>
            <div className="hqs-sec">{t('emp.secProfile')}</div>
            <div className="ui-form-grid hqs-grid">
                <label className="ui-field">
                    <span className="ui-fieldlabel">{t('f.name')} <span className="ui-field-req">*</span></span>
                    <input className="ui-input" maxLength={120} value={f.name} onChange={(e) => set({ name: e.target.value })} autoComplete="off" />
                </label>
                <label className="ui-field">
                    <span className="ui-fieldlabel">{t('f.jobTitle')} <span className="ui-field-req">*</span></span>
                    <select className="ui-select" value={f.jobTitle} onChange={(e) => set({ jobTitle: e.target.value })}>
                        <option value="">—</option>
                        {JOB_TITLES.map((j) => (
                            <option key={j} value={j}>{t(`job.${j}`)}</option>
                        ))}
                    </select>
                </label>
                <label className="ui-field">
                    <span className="ui-fieldlabel">{t('f.mobile')} <span className="ui-field-req">*</span></span>
                    <input className="ui-input" inputMode="tel" maxLength={20} value={f.mobile} onChange={(e) => set({ mobile: e.target.value })} placeholder="05XXXXXXXX" autoComplete="off" />
                </label>
                <label className="ui-field">
                    <span className="ui-fieldlabel">{t('f.email')}</span>
                    <input className="ui-input" type="email" maxLength={160} value={f.email} onChange={(e) => set({ email: e.target.value })} autoComplete="off" />
                </label>
                <label className="ui-field">
                    <span className="ui-fieldlabel">{t('f.iqama')}</span>
                    <input className="ui-input" maxLength={40} value={f.iqama} onChange={(e) => set({ iqama: e.target.value })} autoComplete="off" />
                </label>
                <label className="ui-field">
                    <span className="ui-fieldlabel">{t('f.joining')}</span>
                    <input className="ui-input" type="date" value={f.joiningDate} onChange={(e) => set({ joiningDate: e.target.value })} />
                </label>
            </div>
            <div className="hqs-sec">{t('emp.secPay')}</div>
            <div className="ui-form-grid hqs-grid">
                <label className="ui-field">
                    <span className="ui-fieldlabel">{t('f.salary')} <span className="ui-field-req">*</span></span>
                    <input className="ui-input ui-input--figure" type="number" min="0" step="0.01" value={f.basicSalary} onChange={(e) => set({ basicSalary: e.target.value })} />
                </label>
                <label className="ui-field">
                    <span className="ui-fieldlabel">{t('f.commission')}</span>
                    <input className="ui-input ui-input--figure" type="number" min="0" max="100" step="0.1" value={f.commissionPercent} onChange={(e) => set({ commissionPercent: e.target.value })} />
                </label>
                {showStatus ? (
                    <label className="ui-field">
                        <span className="ui-fieldlabel">{t('f.status')}</span>
                        <select className="ui-select" value={f.isActive ? 'active' : 'inactive'} onChange={(e) => set({ isActive: e.target.value === 'active' })}>
                            <option value="active">{t('st.active')}</option>
                            <option value="inactive">{t('st.inactive')}</option>
                        </select>
                    </label>
                ) : null}
            </div>
        </>
    );
}

function NewEmployee({ t }) {
    const navigate = useNavigate();
    const [f, setF] = useState(emptyProfile);
    const [withLogin, setWithLogin] = useState(false);
    const [login, setLogin] = useState({ email: '', password: '' });
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const set = (patch) => setF((x) => ({ ...x, ...patch }));
    const submit = async () => {
        const bad = profileProblem(t, f);
        if (bad) return setErr(`${t('err.check')}: ${bad}`);
        if (withLogin && (!login.email.trim() || login.password.length < 8)) return setErr(`${t('err.check')}: ${t('emp.secLogin')}`);
        setBusy(true);
        setErr('');
        try {
            const res = body(await createHqEmployee({ ...profilePayload(f), login: withLogin ? { email: login.email.trim(), password: login.password } : null }));
            navigate(`${BASE}/${encodeURIComponent(res.userId)}`, { state: { ok: t('ok.created') } });
        } catch (e) {
            setErr(e?.message || t('err'));
            setBusy(false);
        }
    };
    return (
        <>
            <button type="button" className="ui-link hqs-back" onClick={() => navigate(BASE)}>{t('back.list')}</button>
            <div className="hqs-head">
                <div>
                    <h1 className="hqs-title">{t('emp.newTitle')}</h1>
                    <p className="hqs-sub">{t('emp.newSub')}</p>
                </div>
            </div>
            <section className="ui-panel">
                <div className="ui-panel-body hqs-form">
                    {err ? <div className="ui-banner ui-banner--dang">{err}</div> : null}
                    <EmployeeFields t={t} f={f} set={set} showStatus={false} />
                    <div className="hqs-sec">{t('emp.secLogin')}</div>
                    <label className="hqs-check">
                        <input type="checkbox" checked={withLogin} onChange={(e) => setWithLogin(e.target.checked)} />
                        <span>
                            <strong>{t('emp.giveLogin')}</strong>
                            <span className="hqs-muted-sm">{t('emp.loginHelp')}</span>
                        </span>
                    </label>
                    {withLogin ? (
                        <div className="ui-form-grid hqs-grid">
                            <label className="ui-field">
                                <span className="ui-fieldlabel">{t('f.loginEmail')} <span className="ui-field-req">*</span></span>
                                <input className="ui-input" type="email" maxLength={160} value={login.email} onChange={(e) => setLogin((x) => ({ ...x, email: e.target.value }))} autoComplete="off" />
                            </label>
                            <label className="ui-field">
                                <span className="ui-fieldlabel">{t('f.password')} <span className="ui-field-req">*</span></span>
                                <input className="ui-input" type="password" value={login.password} onChange={(e) => setLogin((x) => ({ ...x, password: e.target.value }))} autoComplete="new-password" />
                            </label>
                        </div>
                    ) : null}
                    <div className="ui-form-foot">
                        <button type="button" className="ui-btn ui-btn--default" disabled={busy} onClick={() => navigate(BASE)}>{t('btn.cancel')}</button>
                        <button type="button" className="ui-btn ui-btn--primary" disabled={busy} onClick={submit}>
                            <UserPlus size={14} /> {busy ? t('btn.working') : t('btn.create')}
                        </button>
                    </div>
                </div>
            </section>
        </>
    );
}

function ProfileCard({ t, person, userId, onDone }) {
    const hasRecord = !!person.employeeId;
    const [editing, setEditing] = useState(!hasRecord);
    const [f, setF] = useState(() => profileFrom(person));
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    useEffect(() => {
        setF(profileFrom(person));
        setEditing(!person.employeeId);
    }, [person]);
    const set = (patch) => setF((x) => ({ ...x, ...patch }));
    const save = async () => {
        const bad = profileProblem(t, f);
        if (bad) return setErr(`${t('err.check')}: ${bad}`);
        setBusy(true);
        setErr('');
        try {
            await updateHqEmployee(userId, profilePayload(f));
            onDone(t('ok.saved'));
        } catch (e) {
            setErr(e?.message || t('err'));
        } finally {
            setBusy(false);
        }
    };
    return (
        <section className="ui-panel">
            <div className="ui-panel-head">
                <div className="ui-panel-title">{t('card.profile')}</div>
                {hasRecord && !editing ? (
                    <button type="button" className="ui-btn ui-btn--default ui-btn--sm" onClick={() => setEditing(true)}>
                        <Pencil size={13} /> {t('btn.edit')}
                    </button>
                ) : null}
            </div>
            <div className="ui-panel-body hqs-form">
                {!hasRecord ? (
                    <div className="ui-banner ui-banner--warn">
                        <strong>{t('noRecord.title')}.</strong> {t('noRecord.body')}
                    </div>
                ) : null}
                {err ? <div className="ui-banner ui-banner--dang">{err}</div> : null}
                {editing ? (
                    <>
                        <EmployeeFields t={t} f={f} set={set} showStatus={hasRecord} />
                        <div className="ui-form-foot">
                            {hasRecord ? (
                                <button type="button" className="ui-btn ui-btn--default" disabled={busy} onClick={() => { setEditing(false); setF(profileFrom(person)); setErr(''); }}>
                                    {t('btn.cancel')}
                                </button>
                            ) : null}
                            <button type="button" className="ui-btn ui-btn--primary" disabled={busy} onClick={save}>
                                {busy ? t('btn.working') : hasRecord ? t('btn.save') : t('btn.makeEmp')}
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="hqs-facts">
                        <div><span>{t('f.jobTitle')}</span><strong>{jobLabel(t, person.jobTitle)}</strong></div>
                        <div><span>{t('f.mobile')}</span><strong>{person.mobile || '—'}</strong></div>
                        <div><span>{t('f.email')}</span><strong>{person.email || '—'}</strong></div>
                        <div><span>{t('f.iqama')}</span><strong>{person.iqama || '—'}</strong></div>
                        <div><span>{t('f.joining')}</span><strong>{dmy(person.joiningDate)}</strong></div>
                        <div><span>{t('f.salary')}</span><strong>SAR {money(person.basicSalary)}</strong></div>
                        <div><span>{t('f.commission')}</span><strong>{Number(person.commissionPercent || 0)}%</strong></div>
                        <div>
                            <span>{t('f.status')}</span>
                            <strong>
                                <span className={`ui-pill ${person.isActive !== false ? 'ui-pill--ok' : 'ui-pill--neutral'}`}>
                                    {person.isActive !== false ? t('st.active') : t('st.inactive')}
                                </span>
                            </strong>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}

function LoginCard({ t, person, userId, onDone }) {
    const [mode, setMode] = useState(''); // '' | 'set' | 'remove'
    const [f, setF] = useState({ email: person.loginEmail || person.email || '', password: '' });
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    useEffect(() => {
        setMode('');
        setF({ email: person.loginEmail || person.email || '', password: '' });
    }, [person]);
    const run = async (fn, msg) => {
        setBusy(true);
        setErr('');
        try {
            await fn();
            onDone(msg);
        } catch (e) {
            setErr(e?.message || t('err'));
        } finally {
            setBusy(false);
        }
    };
    const save = () => {
        if (!f.email.trim() || f.password.length < 8) return setErr(`${t('err.check')}: ${t('f.loginEmail')} / ${t('f.newPassword')}`);
        return run(() => setHqLogin(userId, { email: f.email.trim(), password: f.password }), t('ok.login'));
    };
    const inactive = person.isActive === false;
    return (
        <section className="ui-panel">
            <div className="ui-panel-head">
                <div className="ui-panel-title">{t('card.login')}</div>
                <span className={`ui-pill ${person.loginEnabled ? 'ui-pill--ok' : 'ui-pill--neutral'}`}>
                    {person.loginEnabled ? t('login.on') : t('login.off')}
                </span>
            </div>
            <div className="ui-panel-body hqs-form">
                {err ? <div className="ui-banner ui-banner--dang">{err}</div> : null}
                {person.loginEnabled ? (
                    <div className="hqs-facts">
                        <div><span>{t('f.loginEmail')}</span><strong>{person.loginEmail}</strong></div>
                    </div>
                ) : (
                    <div className="hqs-muted-sm">{t('login.offHelp')}</div>
                )}
                {mode === 'set' ? (
                    <>
                        <div className="ui-form-grid hqs-grid">
                            <label className="ui-field">
                                <span className="ui-fieldlabel">{t('f.loginEmail')}</span>
                                <input className="ui-input" type="email" maxLength={160} value={f.email} onChange={(e) => setF((x) => ({ ...x, email: e.target.value }))} autoComplete="off" />
                            </label>
                            <label className="ui-field">
                                <span className="ui-fieldlabel">{t('f.newPassword')}</span>
                                <input className="ui-input" type="password" value={f.password} onChange={(e) => setF((x) => ({ ...x, password: e.target.value }))} autoComplete="new-password" />
                            </label>
                        </div>
                        <div className="ui-form-foot">
                            <button type="button" className="ui-btn ui-btn--default" disabled={busy} onClick={() => setMode('')}>{t('btn.cancel')}</button>
                            <button type="button" className="ui-btn ui-btn--primary" disabled={busy} onClick={save}>
                                <KeyRound size={14} /> {busy ? t('btn.working') : t('btn.save')}
                            </button>
                        </div>
                    </>
                ) : mode === 'remove' ? (
                    <>
                        <div className="ui-banner ui-banner--warn">{t('login.removeConfirm')}</div>
                        <div className="ui-form-foot">
                            <button type="button" className="ui-btn ui-btn--default" disabled={busy} onClick={() => setMode('')}>{t('btn.cancel')}</button>
                            <button type="button" className="ui-btn ui-btn--danger" disabled={busy} onClick={() => run(() => disableHqLogin(userId), t('ok.loginOff'))}>
                                {busy ? t('btn.working') : t('btn.removeLogin')}
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="ui-form-foot">
                        {person.loginEnabled ? (
                            <button type="button" className="ui-btn ui-btn--default" onClick={() => setMode('remove')}>{t('btn.removeLogin')}</button>
                        ) : null}
                        <button type="button" className="ui-btn ui-btn--primary" disabled={inactive} title={inactive ? t('link.inactive') : undefined} onClick={() => setMode('set')}>
                            <KeyRound size={14} /> {person.loginEnabled ? t('btn.changeLogin') : t('btn.setLogin')}
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
}

/* ─────────────────────────────── Report ─────────────────────────────── */

function RechargeReport({ t }) {
    const navigate = useNavigate();
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const bad = from && to && from > to;
    useEffect(() => {
        if (bad) return undefined;
        let cancelled = false;
        setLoading(true);
        setErr('');
        getHqStaffRecharges({ dateFrom: from || undefined, dateTo: to || undefined })
            .then((res) => !cancelled && setData(body(res)))
            .catch((e) => !cancelled && setErr(e?.message || t('err')))
            .finally(() => !cancelled && setLoading(false));
        return () => {
            cancelled = true;
        };
    }, [from, to, bad, t]);
    const tot = data?.totals || { amount: 0, settled: 0, balance: 0 };
    return (
        <>
            <button type="button" className="ui-link hqs-back" onClick={() => navigate(BASE)}>{t('back.list')}</button>
            <div className="hqs-head">
                <div>
                    <h1 className="hqs-title">{t('rep.title')}</h1>
                    <p className="hqs-sub">{t('rep.sub')}</p>
                </div>
            </div>
            <div className="ui-toolbar ui-toolbar--standalone">
                <label className="ui-field">
                    <span className="ui-fieldlabel">{t('rep.from')}</span>
                    <input type="date" className="ui-input" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
                </label>
                <label className="ui-field">
                    <span className="ui-fieldlabel">{t('rep.to')}</span>
                    <input type="date" className="ui-input" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
                </label>
            </div>
            {err ? <div className="ui-banner ui-banner--dang">{err}</div> : null}
            <div className="ui-kpis">
                <div className="ui-metric"><div className="ui-metric-label">{t('rep.total')}</div><div className="ui-metric-value">{loading ? '…' : `SAR ${money(tot.amount)}`}</div></div>
                <div className="ui-metric ui-metric--ok"><div className="ui-metric-label">{t('rep.settled')}</div><div className="ui-metric-value">{loading ? '…' : `SAR ${money(tot.settled)}`}</div></div>
                <div className="ui-metric ui-metric--warn"><div className="ui-metric-label">{t('rep.balance')}</div><div className="ui-metric-value">{loading ? '…' : `SAR ${money(tot.balance)}`}</div></div>
            </div>
            <section className="ui-panel">
                <div className="ui-panel-head"><div className="ui-panel-title">{t('rep.byWorkshop')}</div></div>
                <div className="ui-panel-body">
                    {!(data?.workshops || []).length ? (
                        <div className="hqs-muted">{loading ? t('loading') : t('r.none')}</div>
                    ) : (
                        <table className="ui-table">
                            <thead>
                                <tr>
                                    <th>{t('r.workshop')}</th>
                                    <th className="num">{t('rep.entries')}</th>
                                    <th className="num">{t('r.amount')}</th>
                                    <th className="num">{t('r.settled')}</th>
                                    <th className="num">{t('r.balance')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.workshops.map((w) => (
                                    <tr key={w.workshopId}>
                                        <td className="hqs-strong">{w.workshopName}</td>
                                        <td className="num">{w.entries}</td>
                                        <td className="num">SAR {money(w.amount)}</td>
                                        <td className="num">SAR {money(w.settled)}</td>
                                        <td className="num hqs-strong">SAR {money(w.balance)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </section>
            <section className="ui-panel">
                <div className="ui-panel-head">
                    <div className="ui-panel-title">{t('rep.entries')}</div>
                    <span className="hqs-muted-sm">{t('rep.entriesN', { n: (data?.entries || []).length })}</span>
                </div>
                <div className="ui-panel-body">
                    {!(data?.entries || []).length ? (
                        <div className="hqs-muted">{loading ? t('loading') : t('r.none')}</div>
                    ) : (
                        <table className="ui-table">
                            <thead>
                                <tr>
                                    <th>{t('r.ref')}</th>
                                    <th>{t('r.date')}</th>
                                    <th>{t('r.workshop')}</th>
                                    <th>{t('r.person')}</th>
                                    <th className="num">{t('r.amount')}</th>
                                    <th className="num">{t('r.settled')}</th>
                                    <th className="num">{t('r.balance')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.entries.map((e) => (
                                    <tr key={e.ref} className="hqs-row" onClick={() => navigate(`${BASE}/${encodeURIComponent(e.userId)}`)}>
                                        <td className="hqs-strong">{e.ref}</td>
                                        <td>{dmy(e.date)}</td>
                                        <td>{e.workshopName}</td>
                                        <td>{e.employeeName}</td>
                                        <td className="num">SAR {money(e.amount)}</td>
                                        <td className="num">SAR {money(e.settled)}</td>
                                        <td className="num hqs-strong">SAR {money(e.balance)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </section>
        </>
    );
}
