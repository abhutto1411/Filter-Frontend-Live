import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { AlertTriangle, Shield, Users, UserX } from 'lucide-react';
import { loadWorkshopEmployeesCombined } from '../../../services/workshopStaffApi';
import { listRoles } from '../../../services/workshopPermissionsApi';
import { apiFetch } from '../../../services/api';
import {
    ACC_ROLES_PAGE_SIZE,
    buildRolesAccessSummary,
    filterAccessRows,
    mapEmployeeToAccessRow,
    slicePage,
} from '../../../utils/accountingRolesAccessDisplay';
import { accT } from '../../../utils/accountingI18n';
import WsTableScroll from '../../../components/workshop/WsTableScroll';
import WsTablePagination from '../../../components/workshop/WsTablePagination';
import { useAuth } from '../../../context/AuthContext';
import { filterPortalVisibleBranches } from '../../../services/workshopStaffApi';

function CellMark({ cell, t }) {
    if (!cell || cell.kind === 'dash') return <span aria-label={t('accRoles.dash')}>—</span>;
    if (cell.kind === 'check') return <span aria-label={t('accRoles.check')}>✔</span>;
    return <span>{cell.text || '—'}</span>;
}

const cardStyle = {
    background: '#fff',
    border: '1px solid #E2E8F0',
    borderRadius: 10,
    padding: 14,
    flex: '1 1 160px',
    minWidth: 140,
};


export default function WorkshopAccountingRolesAccessPage({
    locale: localeProp,
    branches: branchesProp = [],
    selectedBranchId: selectedBranchIdProp = 'all',
}) {
    const outletCtx = useOutletContext() || {};
    const locale =
        localeProp ||
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);
    const { hasPermission } = useAuth();
    const canView =
        hasPermission('workshop.branches.view') ||
        hasPermission('workshop.branches.access-permissions.view');

    const layoutBranch =
        selectedBranchIdProp || outletCtx.selectedBranchId || 'all';

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [rows, setRows] = useState([]);
    const [roles, setRoles] = useState([]);
    const [branches, setBranches] = useState(branchesProp || []);
    const [draftUser, setDraftUser] = useState('all');
    const [draftRole, setDraftRole] = useState('all');
    const [draftBranch, setDraftBranch] = useState(
        layoutBranch && layoutBranch !== 'all' ? String(layoutBranch) : 'all',
    );
    const [applied, setApplied] = useState({
        userId: 'all',
        role: 'all',
        branchId: layoutBranch && layoutBranch !== 'all' ? String(layoutBranch) : 'all',
    });
    const [page, setPage] = useState(1);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [empRes, rolesRes, brRes] = await Promise.all([
                loadWorkshopEmployeesCombined({}),
                listRoles({ portal: 'workshop' }).catch((err) => {
                    if (Number(err?.status) === 404) return { roles: [] };
                    throw err;
                }),
                branchesProp?.length
                    ? Promise.resolve(null)
                    : apiFetch('/workshop-staff/branches').catch(() => null),
            ]);

            const roleList = Array.isArray(rolesRes?.roles)
                ? rolesRes.roles
                : Array.isArray(rolesRes)
                  ? rolesRes
                  : [];
            setRoles(roleList);

            const rolePermsById = new Map();
            for (const r of roleList) {
                if (r?.id != null) {
                    rolePermsById.set(
                        String(r.id),
                        Array.isArray(r.permissions) ? r.permissions : [],
                    );
                }
            }

            const employees = Array.isArray(empRes?.employees) ? empRes.employees : [];
            const mapped = employees.map((e) => mapEmployeeToAccessRow(e, rolePermsById));
            setRows(mapped);

            if (brRes) {
                const raw = Array.isArray(brRes?.branches)
                    ? brRes.branches
                    : Array.isArray(brRes)
                      ? brRes
                      : [];
                setBranches(filterPortalVisibleBranches(raw));
            } else if (branchesProp?.length) {
                setBranches(branchesProp);
            }
        } catch (err) {
            const status = Number(err?.status);
            if (status === 403) setError(t('accRoles.error.forbidden'));
            else if (status === 404) setError(t('accRoles.error.notDeployed'));
            else setError(err?.message || t('accRoles.error.load'));
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [branchesProp, t]);

    useEffect(() => {
        if (!canView) return undefined;
        void load();
        return undefined;
    }, [canView, load]);

    useEffect(() => {
        if (layoutBranch && layoutBranch !== 'all') {
            setDraftBranch(String(layoutBranch));
            setApplied((p) => ({ ...p, branchId: String(layoutBranch) }));
        }
    }, [layoutBranch]);

    const filtered = useMemo(
        () => filterAccessRows(rows, applied),
        [rows, applied],
    );
    const summary = useMemo(() => buildRolesAccessSummary(rows), [rows]);
    const paged = useMemo(
        () => slicePage(filtered, page, ACC_ROLES_PAGE_SIZE),
        [filtered, page],
    );

    const userOptions = useMemo(() => {
        const seen = new Map();
        for (const r of rows) {
            if (r.id && !seen.has(r.id)) seen.set(r.id, r.name);
        }
        return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
    }, [rows]);

    const roleOptions = useMemo(() => {
        const names = new Set();
        for (const r of rows) {
            if (r.roleName) names.add(r.roleName);
        }
        for (const r of roles) {
            if (r?.name) names.add(r.name);
        }
        return [...names].sort((a, b) => a.localeCompare(b));
    }, [rows, roles]);

    const applyFilters = () => {
        setApplied({
            userId: draftUser,
            role: draftRole,
            branchId: draftBranch,
        });
        setPage(1);
    };

    const showAll = () => {
        setDraftUser('all');
        setDraftRole('all');
        setDraftBranch('all');
        setApplied({ userId: 'all', role: 'all', branchId: 'all' });
        setPage(1);
        void load();
    };

    const scopeLabel = (row) => {
        if (row.workshopScopeKey === 'posOnly') return t('accRoles.scope.posOnly');
        if (row.workshopScopeKey === 'lockerOnly') return t('accRoles.scope.lockerOnly');
        if (row.workshopScopeKey === 'branches' && row.branchIds?.length) {
            const names = row.branchIds
                .map((id) => branches.find((b) => String(b.id) === String(id))?.name || id)
                .join(', ');
            return names || t('accRoles.scope.branches');
        }
        return t('accRoles.scope.thisWorkshop');
    };

    if (!canView) {
        return (
            <div className="module-container" role="alert">
                <p>{t('accRoles.error.forbidden')}</p>
            </div>
        );
    }

    const cards = [
        {
            key: 'users',
            icon: Users,
            label: t('accRoles.card.users'),
            value: String(summary.withAccounting),
            tone: 'ok',
        },
        {
            key: 'accountant',
            icon: Shield,
            label: t('accRoles.card.accountant'),
            value: String(summary.accountants),
            tone: 'info',
        },
        {
            key: 'cashier',
            icon: UserX,
            label: t('accRoles.card.cashier'),
            value: String(summary.cashierTech),
            tone: 'warn',
        },
        {
            key: 'blocked',
            icon: AlertTriangle,
            label: t('accRoles.card.blocked'),
            value: summary.blockedAttempts == null ? '—' : String(summary.blockedAttempts),
            tone: 'bad',
            hideValue: summary.blockedAttempts == null,
            hide: summary.blockedAttempts == null,
        },
    ];

    return (
        <div className="module-container" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
            <div style={{ fontSize: 13, color: '#64748B', marginBottom: 6 }}>
                {t('accRoles.breadcrumb')}
            </div>
            <h2 style={{ margin: '0 0 16px', fontSize: 22 }}>{t('accRoles.title')}</h2>

            <div
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 12,
                    marginBottom: 16,
                }}
            >
                {cards
                    .filter((c) => !c.hide)
                    .map((c) => {
                        const Icon = c.icon;
                        return (
                            <div key={c.key} className="acct-kpi-card" style={cardStyle}>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <Icon size={18} aria-hidden />
                                    <span style={{ fontSize: 12, color: '#64748B' }}>{c.label}</span>
                                </div>
                                <div style={{ fontSize: 22, fontWeight: 700, marginTop: 8 }}>
                                    {c.value}
                                </div>
                            </div>
                        );
                    })}
            </div>

            <div className="acct-filter-bar cash-bank-filter-bar">
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{t('accRoles.filter.user')}</span>
                    <select
                        className="form-input"
                        value={draftUser}
                        onChange={(e) => setDraftUser(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') applyFilters();
                        }}
                    >
                        <option value="all">{t('accRoles.filter.allUsers')}</option>
                        {userOptions.map(([id, name]) => (
                            <option key={id} value={id}>
                                {name}
                            </option>
                        ))}
                    </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 140 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{t('accRoles.filter.role')}</span>
                    <select
                        className="form-input"
                        value={draftRole}
                        onChange={(e) => setDraftRole(e.target.value)}
                    >
                        <option value="all">{t('accRoles.filter.allRoles')}</option>
                        {roleOptions.map((name) => (
                            <option key={name} value={name}>
                                {name}
                            </option>
                        ))}
                    </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 140 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{t('accRoles.filter.branch')}</span>
                    <select
                        className="form-input"
                        value={draftBranch}
                        onChange={(e) => setDraftBranch(e.target.value)}
                    >
                        <option value="all">{t('accRoles.filter.allBranches')}</option>
                        {branches.map((b) => (
                            <option key={String(b.id)} value={String(b.id)}>
                                {b.name || b.id}
                            </option>
                        ))}
                    </select>
                </label>
                <button type="button" className="btn-submit btn-dark" onClick={applyFilters}>
                    {t('accRoles.filter.apply')}
                </button>
                <button type="button" className="btn-portal-outline" onClick={showAll}>
                    {t('accRoles.filter.showAll')}
                </button>
            </div>

            {loading ? <p>{t('accRoles.loading')}</p> : null}
            {error ? (
                <div role="alert" style={{ marginBottom: 12 }}>
                    <p>{error}</p>
                    <button type="button" className="btn-portal-outline" onClick={() => void load()}>
                        {t('accRoles.retry')}
                    </button>
                </div>
            ) : null}

            {!loading && !error ? (
                <div style={{ ...cardStyle, marginBottom: 16 }}>
                    {filtered.length === 0 ? (
                        <p style={{ color: '#64748B' }}>{t('accRoles.empty')}</p>
                    ) : (
                        <>
                            <WsTableScroll>
                                <table className="ws-table" style={{ width: '100%' }}>
                                    <thead>
                                        <tr>
                                            <th className="table-th">{t('accRoles.th.user')}</th>
                                            <th className="table-th">{t('accRoles.th.role')}</th>
                                            <th className="table-th">{t('accRoles.th.scope')}</th>
                                            <th className="table-th">{t('accRoles.th.read')}</th>
                                            <th className="table-th">{t('accRoles.th.write')}</th>
                                            <th className="table-th">{t('accRoles.th.admin')}</th>
                                            <th className="table-th">{t('accRoles.th.payroll')}</th>
                                            <th className="table-th">{t('accRoles.th.action')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paged.rows.map((row) => (
                                            <tr key={row.id || row.name}>
                                                <td className="table-cell">{row.name}</td>
                                                <td className="table-cell">
                                                    <span
                                                        style={{
                                                            display: 'inline-block',
                                                            paddingBlock: 2,
                                                            paddingInline: 8,
                                                            borderRadius: 999,
                                                            fontSize: 12,
                                                            fontWeight: 600,
                                                            background: '#EFF6FF',
                                                            color: '#1E40AF',
                                                            border: '1px solid #BFDBFE',
                                                        }}
                                                    >
                                                        {row.roleName}
                                                    </span>
                                                </td>
                                                <td className="table-cell">{scopeLabel(row)}</td>
                                                <td className="table-cell">
                                                    <CellMark cell={row.read} t={t} />
                                                </td>
                                                <td className="table-cell">
                                                    <CellMark cell={row.write} t={t} />
                                                </td>
                                                <td className="table-cell">
                                                    <CellMark cell={row.admin} t={t} />
                                                </td>
                                                <td className="table-cell">
                                                    <CellMark cell={row.payroll} t={t} />
                                                </td>
                                                <td className="table-cell">
                                                    {row.actionKey === 'posOnly' ? (
                                                        <span style={{ color: '#64748B', fontSize: 13 }}>
                                                            {t('accRoles.action.posOnly')}
                                                        </span>
                                                    ) : (
                                                        <Link
                                                            to="/workshop/branches"
                                                            className="btn-portal-outline"
                                                            style={{
                                                                display: 'inline-block',
                                                                paddingBlock: 4,
                                                                paddingInline: 10,
                                                                fontSize: 13,
                                                                textDecoration: 'none',
                                                            }}
                                                        >
                                                            {t('accRoles.action.edit')}
                                                        </Link>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </WsTableScroll>
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    gap: 8,
                                    marginTop: 8,
                                }}
                            >
                                <span style={{ fontSize: 13, color: '#64748B' }}>
                                    {t('accRoles.showing', {
                                        a: String(paged.from),
                                        b: String(paged.to),
                                        n: String(paged.total),
                                    })}
                                </span>
                                <WsTablePagination
                                    page={paged.page}
                                    pageCount={paged.pageCount}
                                    onPageChange={setPage}
                                />
                            </div>
                        </>
                    )}
                </div>
            ) : null}

            <div
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 16,
                    alignItems: 'stretch',
                }}
            >
                <div style={{ ...cardStyle, flex: '1 1 280px' }}>
                    <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>{t('accRoles.rulesTitle')}</h3>
                    <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.5, margin: 0 }}>
                        {t('accRoles.rulesBody')}
                    </p>
                </div>
                {/* Blocked attempts: hide until API exists (summary.blockedAttempts == null) */}
            </div>
        </div>
    );
}
