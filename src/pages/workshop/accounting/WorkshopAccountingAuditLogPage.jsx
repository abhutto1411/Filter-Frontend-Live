import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Book, RefreshCw } from 'lucide-react';
import { PaginationControls } from '../../../components/PaginationControls';
import SupplierAccountingCombobox from '../../supplier/accounting/SupplierAccountingCombobox';
import WsTableScroll from '../../../components/workshop/WsTableScroll';
import { useAuth } from '../../../context/AuthContext';
import { listAccountingAuditLog } from '../../../services/workshopAccountingApi';
import {
    getAllWorkshopEmployees,
    unwrapWorkshopEmployeesList,
} from '../../../services/workshopStaffApi';
import { accT } from '../../../utils/accountingI18n';
import {
    AUDIT_ENTITY_OPTIONS,
    AUDIT_PAGE_SIZE,
    auditActionCounts,
    auditDiffRows,
    formatDiffValue,
    formatWesternInt,
    fmtBusinessYmd,
    isAccountingAdminActor,
    isForbiddenError,
    showingRange,
} from '../../../utils/journalAuditDisplay';
import '../../../styles/admin/AccountingPage.css';

const ALL = '';

function userLabel(row, usersById) {
    const id = row?.userId != null ? String(row.userId) : '';
    if (id && usersById.get(id)) return usersById.get(id);
    if (row?.userType) return `${row.userType}${id ? ` · ${id}` : ''}`;
    return id || '—';
}

export default function WorkshopAccountingAuditLogPage({ locale: localeProp }) {
    const { user, hasPermission } = useAuth();
    const outletCtx = useOutletContext() || {};
    const locale =
        localeProp ||
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);

    const canView = isAccountingAdminActor(user)
        || hasPermission('workshop.accounting.journal-entries.approve');

    const empty = { userId: ALL, entity: ALL, from: '', to: '' };
    const [draft, setDraft] = useState(empty);
    const [applied, setApplied] = useState(empty);
    const [page, setPage] = useState(1);
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [forbidden, setForbidden] = useState(false);
    const [openId, setOpenId] = useState('');
    const [users, setUsers] = useState([]);
    const reloadSeq = useRef(0);

    useEffect(() => {
        let cancelled = false;
        getAllWorkshopEmployees()
            .then((res) => {
                if (cancelled) return;
                const list = unwrapWorkshopEmployeesList(res);
                const seen = new Map();
                for (const e of list) {
                    const id = String(e.userId || (e.recordType === 'portal_user' ? e.id : '') || '').trim();
                    if (!id || seen.has(id)) continue;
                    seen.set(id, e.name || e.fullName || id);
                }
                setUsers([...seen.entries()].map(([id, label]) => ({ id, label })));
            })
            .catch(() => {
                if (!cancelled) setUsers([]);
            });
        return () => { cancelled = true; };
    }, []);

    const usersById = useMemo(() => new Map(users.map((u) => [u.id, u.label])), [users]);
    const userOptions = useMemo(
        () => [{ id: ALL, label: t('audit.allUsers') }, ...users],
        [t, users],
    );
    const entityOptions = useMemo(
        () => AUDIT_ENTITY_OPTIONS.map((o) => ({ id: o.id, label: t(o.labelKey) })),
        [t],
    );

    const reload = useCallback(async () => {
        if (!canView) return;
        const seq = ++reloadSeq.current;
        setLoading(true);
        setError('');
        setForbidden(false);
        try {
            const params = { page, pageSize: AUDIT_PAGE_SIZE };
            if (applied.userId) params.userId = applied.userId;
            if (applied.entity) params.entity = applied.entity;
            if (applied.from) params.from = applied.from;
            if (applied.to) params.to = applied.to;
            const res = await listAccountingAuditLog(params);
            if (seq !== reloadSeq.current) return;
            setRows(Array.isArray(res?.rows) ? res.rows : []);
            setTotal(Number(res?.total ?? 0));
        } catch (e) {
            if (seq !== reloadSeq.current) return;
            if (isForbiddenError(e)) {
                setForbidden(true);
                setError(t('audit.noPermission'));
            } else {
                setError(e?.message || t('audit.loadFailed'));
            }
            setRows([]);
            setTotal(0);
        } finally {
            if (seq === reloadSeq.current) setLoading(false);
        }
    }, [applied, canView, page, t]);

    useEffect(() => { reload(); }, [reload]);

    const offset = (page - 1) * AUDIT_PAGE_SIZE;
    const range = showingRange(total, AUDIT_PAGE_SIZE, offset);
    const actionCards = useMemo(() => auditActionCounts(rows), [rows]);

    const applyFilters = (e) => {
        e?.preventDefault?.();
        setPage(1);
        setApplied({ ...draft });
    };
    const showAll = () => {
        setDraft(empty);
        setApplied(empty);
        setPage(1);
    };

    if (!canView) {
        return (
            <div className="general-journal-view" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
                <header className="journal-header">
                    <p className="gj-crumb">{t('audit.crumb')}</p>
                    <h2 className="journal-title">{t('audit.title')}</h2>
                </header>
                <div className="gj-alert" role="alert">{t('audit.noPermission')}</div>
            </div>
        );
    }

    return (
        <div className="general-journal-view" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
            <header className="journal-header">
                <p className="gj-crumb">{t('audit.crumb')}</p>
                <h2 className="journal-title">{t('audit.title')}</h2>
            </header>

            <form className="gj-filter-bar acct-filter-bar" onSubmit={applyFilters}>
                <label className="gj-field gj-field--combo">
                    <span>{t('audit.filter.user')}</span>
                    <SupplierAccountingCombobox
                        className="acct-table-combobox acct-filter-combobox"
                        options={userOptions}
                        value={draft.userId}
                        onChange={(id) => setDraft((d) => ({ ...d, userId: String(id || '') }))}
                        placeholder={t('audit.allUsers')}
                        entityLabel="user"
                        emptyHint={t('audit.empty')}
                        menuMinWidth={280}
                    />
                </label>
                <label className="gj-field gj-field--combo">
                    <span>{t('audit.filter.entity')}</span>
                    <SupplierAccountingCombobox
                        className="acct-table-combobox acct-filter-combobox"
                        options={entityOptions}
                        value={draft.entity}
                        onChange={(id) => setDraft((d) => ({ ...d, entity: String(id || '') }))}
                        placeholder={t('audit.entity.all')}
                        entityLabel="entity"
                        emptyHint={t('audit.empty')}
                        menuMinWidth={220}
                    />
                </label>
                <label className="gj-field">
                    <span>{t('audit.filter.from')}</span>
                    <input
                        type="date"
                        value={draft.from}
                        onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
                    />
                </label>
                <label className="gj-field">
                    <span>{t('audit.filter.to')}</span>
                    <input
                        type="date"
                        value={draft.to}
                        onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
                    />
                </label>
                <div className="gj-filter-bar__actions">
                    <button type="submit" className="btn-submit btn-dark">{t('gj.filter.apply')}</button>
                    <button type="button" className="btn-portal-outline" onClick={showAll}>{t('gj.filter.showAll')}</button>
                </div>
            </form>

            {actionCards.length > 0 ? (
                <div className="journal-stats" style={{ gridTemplateColumns: `repeat(${Math.min(actionCards.length, 4)}, minmax(0, 1fr))` }}>
                    {actionCards.map((c) => (
                        <div key={c.action} className="acct-kpi-card acct-kpi-card--with-icon">
                            <div className="jr-stat-icon-wrapper">
                                <div className="jr-stat-icon icon-purple"><Book size={18} /></div>
                            </div>
                            <div className="jr-stat-info">
                                <span className="acct-kpi-label">{c.action}</span>
                                <span className="acct-kpi-value">{formatWesternInt(c.count)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            ) : null}

            {error ? (
                <div className="gj-alert" role="alert">
                    <span>{error}</span>
                    {!forbidden ? (
                        <button type="button" className="btn-portal-outline" onClick={reload}>
                            <RefreshCw size={14} /> {t('gj.retry')}
                        </button>
                    ) : null}
                </div>
            ) : null}

            <section className="premium-table journal-table">
                <WsTableScroll>
                    <table className="ws-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr className="table-header-row">
                                <th className="table-th">{t('audit.th.time')}</th>
                                <th className="table-th">{t('audit.th.user')}</th>
                                <th className="table-th">{t('audit.th.action')}</th>
                                <th className="table-th">{t('audit.th.entity')}</th>
                                <th className="table-th">{t('audit.th.entityId')}</th>
                                <th className="table-th">{t('audit.th.reason')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={6} className="table-cell table-empty">{t('audit.loading')}</td></tr>
                            ) : rows.length === 0 ? (
                                <tr><td colSpan={6} className="table-cell table-empty">{t('audit.empty')}</td></tr>
                            ) : (
                                rows.map((r) => {
                                    const id = String(r.id);
                                    const open = openId === id;
                                    const diffs = open ? auditDiffRows(r.before, r.after) : [];
                                    return (
                                        <React.Fragment key={id}>
                                            <tr
                                                className="table-row"
                                                style={{ cursor: 'pointer' }}
                                                onClick={() => setOpenId(open ? '' : id)}
                                            >
                                                <td className="table-cell">{fmtBusinessYmd(r.createdAt)}{r.createdAt && String(r.createdAt).includes('T') ? ` ${String(r.createdAt).slice(11, 16)}` : ''}</td>
                                                <td className="table-cell">{userLabel(r, usersById)}</td>
                                                <td className="table-cell">{r.action || '—'}</td>
                                                <td className="table-cell">{r.entity || '—'}</td>
                                                <td className="table-cell">{r.entityId || '—'}</td>
                                                <td className="table-cell color-muted truncate-text">{r.reason || '—'}</td>
                                            </tr>
                                            {open ? (
                                                <tr>
                                                    <td colSpan={6} className="table-cell">
                                                        {diffs.length === 0 ? (
                                                            t('audit.diff.empty')
                                                        ) : (
                                                            <table className="ws-table" style={{ width: '100%', margin: 0 }}>
                                                                <thead>
                                                                    <tr>
                                                                        <th>{t('audit.diff.key')}</th>
                                                                        <th>{t('audit.diff.before')}</th>
                                                                        <th>{t('audit.diff.after')}</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {diffs.map((d) => (
                                                                        <tr key={d.key} className={d.changed ? 'gj-row--selected' : undefined}>
                                                                            <td>{d.key}</td>
                                                                            <td>{formatDiffValue(d.before)}</td>
                                                                            <td>{formatDiffValue(d.after)}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        )}
                                                    </td>
                                                </tr>
                                            ) : null}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </WsTableScroll>
                {!loading && total > 0 ? (
                    <div className="gj-pager">
                        <p className="gj-showing">{t('gj.showing', { from: range.from, to: range.to, total: range.total })}</p>
                        <p className="gj-per-page">{t('gj.perPage', { n: AUDIT_PAGE_SIZE })}</p>
                        <PaginationControls
                            total={total}
                            limit={AUDIT_PAGE_SIZE}
                            offset={offset}
                            onPageChange={(nextOffset) => setPage(Math.floor(nextOffset / AUDIT_PAGE_SIZE) + 1)}
                            loading={loading}
                        />
                    </div>
                ) : null}
            </section>
        </div>
    );
}
