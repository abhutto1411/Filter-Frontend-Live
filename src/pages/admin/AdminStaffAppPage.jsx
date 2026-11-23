import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useOutletContext } from 'react-router-dom';
import { AlertTriangle, Building2, RotateCcw } from 'lucide-react';
import {
    getWorkshopOptions,
    getBranches,
    getPlatformHqInfo,
} from '../../services/superAdminApi';
import { STAFF_APP_SLUG_TO_TAB, STAFF_APP_TAB_SLUG } from '../workshop/staff-app/constants';
import StaffAppPage from '../workshop/staff-app/StaffAppPage';
import { StaffAppScopeProvider } from '../../context/StaffAppScopeContext';
import { resolveStaffAppLocale, staffAppT } from '../../utils/staffAppI18n';
import '../workshop/staff-app/StaffApp.css';
import '../../styles/ui.css';

/** The branch list is capped at 200 by the API; ask for all of it. */
const BRANCH_LIMIT = 200;

function pickRows(payload, keys) {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    for (const key of keys) {
        if (Array.isArray(payload[key])) return payload[key];
        if (Array.isArray(payload.data?.[key])) return payload.data[key];
    }
    if (Array.isArray(payload.data)) return payload.data;
    return [];
}

/** A workshop is pickable once it is approved; `active` is the older spelling. */
function isApproved(status) {
    const s = String(status ?? '').trim().toLowerCase();
    return s === '' || s === 'approved' || s === 'active';
}

/**
 * Super Admin — manage the outdoor staff app per workshop, with the same
 * screens the workshop portal uses. This page is only the scope picker; the
 * tools below it are the workshop portal's own.
 */
export default function AdminStaffAppPage() {
    const navigate = useNavigate();
    const { subTab } = useParams();
    const outletCtx = useOutletContext() || {};
    const locale = resolveStaffAppLocale(undefined, outletCtx.locale);
    const t = useCallback((key, vars) => staffAppT(locale, key, vars), [locale]);

    const [workshops, setWorkshops] = useState([]);
    const [hqWorkshopId, setHqWorkshopId] = useState('');
    const [workshopId, setWorkshopId] = useState('');
    const [branches, setBranches] = useState([]);
    const [branchId, setBranchId] = useState('all');
    const [loadingWorkshops, setLoadingWorkshops] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    const activeTab = STAFF_APP_SLUG_TO_TAB[subTab] || 'sap-overview';

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoadingWorkshops(true);
            try {
                // The options endpoint returns every workshop uncapped. The
                // picker used to call the paged list with limit 500, which the
                // API clamps to 100 — so past that, workshops were missing from
                // the dropdown with nothing to show it.
                const [res, hqRes] = await Promise.all([
                    getWorkshopOptions(),
                    getPlatformHqInfo().catch(() => ({ exists: false, workshopId: null })),
                ]);
                if (cancelled) return;
                const list = pickRows(res, ['options', 'workshops'])
                    .map((w) => ({
                        id: String(w.id ?? w.value ?? w.workshopId ?? ''),
                        name: w.name ?? w.label ?? w.workshopName ?? '',
                        status: w.status,
                    }))
                    .filter((w) => w.id && isApproved(w.status));
                setWorkshops(list);
                setLoadError(false);

                const hqId = hqRes?.workshopId ? String(hqRes.workshopId) : '';
                setHqWorkshopId(hqId);
                setWorkshopId((current) => {
                    if (current) return current;
                    if (hqId && list.some((w) => w.id === hqId)) return hqId;
                    return list[0]?.id ?? '';
                });
            } catch {
                if (cancelled) return;
                setWorkshops([]);
                setLoadError(true);
            } finally {
                if (!cancelled) setLoadingWorkshops(false);
            }
        })();
        return () => { cancelled = true; };
    }, [reloadKey]);

    useEffect(() => {
        if (!workshopId) {
            setBranches([]);
            return undefined;
        }
        let cancelled = false;
        (async () => {
            try {
                const res = await getBranches({ workshopId, limit: BRANCH_LIMIT });
                if (cancelled) return;
                setBranches(
                    pickRows(res, ['branches']).map((b) => ({
                        ...b,
                        id: b.id ?? b._id,
                        name: b.name ?? b.branchName ?? t('admin.branchFallback'),
                    })),
                );
            } catch {
                if (!cancelled) setBranches([]);
            }
        })();
        return () => { cancelled = true; };
    }, [workshopId, t]);

    const workshopName = useMemo(() => {
        const w = workshops.find((x) => x.id === String(workshopId));
        return w?.name || t('admin.workshopFallback');
    }, [workshops, workshopId, t]);

    const onNavigate = useCallback(
        (tabId) => {
            const slug = STAFF_APP_TAB_SLUG[tabId] || 'overview';
            navigate(`/admin/staff-app/${slug}`);
        },
        [navigate],
    );

    return (
        <div className="ui-root ui-root--flush ui-stack">
            <div className="ui-row ui-row--fields">
                <div className="ui-field">
                    <label htmlFor="sap-workshop">{t('admin.workshop')}</label>
                    <select
                        id="sap-workshop"
                        className="ui-select"
                        value={workshopId}
                        onChange={(e) => {
                            setWorkshopId(e.target.value);
                            setBranchId('all');
                        }}
                        disabled={loadingWorkshops}
                    >
                        <option value="">{t('admin.selectWorkshop')}</option>
                        {workshops.map((w) => (
                            <option key={w.id} value={w.id}>
                                {w.id === hqWorkshopId
                                    ? t('admin.platformHq', { name: w.name })
                                    : w.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="ui-field">
                    <label htmlFor="sap-branch">{t('admin.branch')}</label>
                    <select
                        id="sap-branch"
                        className="ui-select"
                        value={branchId}
                        onChange={(e) => setBranchId(e.target.value)}
                        disabled={!workshopId}
                    >
                        <option value="all">{t('admin.allBranches')}</option>
                        {branches.map((b) => (
                            <option key={String(b.id)} value={String(b.id)}>
                                {b.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {loadError ? (
                <div className="ui-empty">
                    <div className="ui-empty-icon"><AlertTriangle size={18} /></div>
                    <div className="ui-empty-title">{t('admin.errWorkshops')}</div>
                    <div className="ui-empty-sub">{t('admin.errWorkshopsHint')}</div>
                    <button
                        type="button"
                        className="ui-btn ui-btn--default ui-btn--sm"
                        onClick={() => setReloadKey((k) => k + 1)}
                    >
                        <RotateCcw size={13} /> {t('admin.retry')}
                    </button>
                </div>
            ) : loadingWorkshops ? (
                <div className="ui-stack" aria-label={t('admin.loadingWorkshops')} aria-busy="true">
                    <div className="ui-sk ui-sk--text ui-sk--w40" />
                    <div className="ui-kpis">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={`sk-${i}`} className="ui-metric ui-sk-row">
                                <div className="ui-sk ui-sk--label ui-sk--w55" />
                                <div className="ui-sk ui-sk--title ui-sk--w40" />
                            </div>
                        ))}
                    </div>
                </div>
            ) : workshops.length === 0 ? (
                <div className="ui-empty">
                    <div className="ui-empty-icon"><Building2 size={18} /></div>
                    <div className="ui-empty-title">{t('admin.noWorkshops')}</div>
                    <div className="ui-empty-sub">{t('admin.noWorkshopsHint')}</div>
                </div>
            ) : !workshopId ? (
                <div className="ui-empty">
                    <div className="ui-empty-icon"><Building2 size={18} /></div>
                    <div className="ui-empty-title">{t('admin.selectWorkshopHint')}</div>
                </div>
            ) : (
                <StaffAppScopeProvider workshopId={workshopId} locale={locale}>
                    <p className="ui-lead">{t('admin.managing', { name: workshopName })}</p>
                    <StaffAppPage
                        activeTab={activeTab}
                        selectedBranchId={branchId}
                        branches={branches}
                        workshopId={workshopId}
                        onNavigate={onNavigate}
                        locale={locale}
                    />
                </StaffAppScopeProvider>
            )}
        </div>
    );
}
