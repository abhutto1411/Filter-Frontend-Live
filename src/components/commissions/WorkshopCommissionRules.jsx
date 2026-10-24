import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, Info, Lock, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import {
    deleteWorkshopCommissionRule,
    getWorkshopCommissionRules,
} from '../../services/workshopCommissionsApi';
import { wcomT } from '../../utils/workshopCommissionsI18n';
import { useAuth } from '../../context/AuthContext';
import { COMMISSION_RULE_ROLES } from './commissionRuleConstants';
import '../../pages/workshop/Workshop.css';

const FILTERS = ['all', 'active', 'inactive', 'platform'];
const SEARCH_DEBOUNCE_MS = 300;

/** Up to two named chips, then one "+N" chip whose tooltip lists the rest. */
function pushNamedChips(chips, names, cls) {
    const list = names.filter(Boolean);
    list.slice(0, 2).forEach((text) => chips.push({ cls, text }));
    if (list.length > 2) {
        chips.push({ cls, text: `+${list.length - 2}`, title: list.slice(2).join(', ') });
    }
}

function ScopeChips({ rule, t }) {
    const chips = [];
    pushNamedChips(chips, (rule.branches || []).map((b) => b.name), 'dept');
    pushNamedChips(chips, (rule.departments || []).map((d) => d.name), 'dept');
    pushNamedChips(chips, (rule.categories || []).map((c) => c.name), 'cat');
    for (const km of rule.kmValues || []) {
        chips.push({ cls: 'km', text: t('rules.scope.km', { km: Number(km).toLocaleString('en-US') }) });
    }
    const productCount = (rule.productIds || []).length;
    const serviceCount = (rule.serviceIds || []).length;
    if (productCount) {
        const names = (rule.products || []).map((p) => p.name).filter(Boolean);
        chips.push({
            cls: 'items',
            text: productCount === 1 && names[0] ? names[0] : t('rules.scope.productsCount', { count: productCount }),
            title: names.join(', '),
        });
    }
    if (serviceCount) {
        const names = (rule.services || []).map((s) => s.name).filter(Boolean);
        chips.push({
            cls: 'items',
            text: serviceCount === 1 && names[0] ? names[0] : t('rules.scope.servicesCount', { count: serviceCount }),
            title: names.join(', '),
        });
    }
    if (!productCount && !serviceCount && rule.appliesTo && rule.appliesTo !== 'all') {
        chips.push({ cls: 'items', text: t(`rules.scope.${rule.appliesTo}`) });
    }
    if (!chips.length) chips.push({ cls: '', text: t('rules.scope.allLines') });
    return (
        <div className="wcr-scope">
            {chips.map((c, i) => (
                <span
                    key={`${c.cls}-${i}`}
                    className={`wcr-scope__chip${c.cls ? ` wcr-scope__chip--${c.cls}` : ''}`}
                    title={c.title || c.text}
                >
                    {c.text}
                </span>
            ))}
        </div>
    );
}

/** Workshop commission rules: searchable list; create / edit / view open the full-page editor via `onOpenRule`. */
export default function WorkshopCommissionRules({
    locale: localeProp,
    t: tProp,
    adminMode = false,
    workshopId = '',
    reloadKey = 0,
    onOpenRule,
} = {}) {
    const locale =
        localeProp || (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) || 'en';
    const tLocal = useCallback((key, vars) => wcomT(locale, key, vars), [locale]);
    const t = tProp || tLocal;
    const { hasPermission } = useAuth();
    const can = useCallback(
        (action) => adminMode || hasPermission(`workshop.commissions.rules.${action}`),
        [adminMode, hasPermission],
    );

    const [rules, setRules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [reloadTick, setReloadTick] = useState(0);
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');
    const [pendingDeleteId, setPendingDeleteId] = useState('');
    const [deleteLoadingId, setDeleteLoadingId] = useState('');

    useEffect(() => {
        const id = window.setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
        return () => window.clearTimeout(id);
    }, [searchInput]);

    useEffect(() => {
        const controller = new AbortController();
        (async () => {
            setLoading(true);
            setError('');
            try {
                const res = await getWorkshopCommissionRules(
                    { search: search || undefined, workshopId: workshopId || undefined },
                    { signal: controller.signal },
                );
                setRules(Array.isArray(res?.rules) ? res.rules : []);
            } catch (err) {
                if (controller.signal.aborted || err?.name === 'AbortError') return;
                setError(err?.message || t('rules.err.generic'));
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        })();
        return () => controller.abort();
    }, [search, workshopId, reloadTick, reloadKey, t]);

    const onDelete = async (id) => {
        setDeleteLoadingId(id);
        setError('');
        try {
            await deleteWorkshopCommissionRule(id, workshopId ? { workshopId } : {});
            setPendingDeleteId('');
            setReloadTick((x) => x + 1);
        } catch (err) {
            setPendingDeleteId('');
            setError(err?.status === 409 ? t('rules.err.inUse') : err?.message || t('rules.err.generic'));
        } finally {
            setDeleteLoadingId('');
        }
    };

    const visibleRules = useMemo(() => {
        const rows = rules.filter((r) => {
            if (filter === 'active') return r.status !== 'inactive';
            if (filter === 'inactive') return r.status === 'inactive';
            if (filter === 'platform') return r.scope === 'platform';
            return true;
        });
        return rows.sort((a, b) => {
            const activeDiff = (a.status === 'inactive') - (b.status === 'inactive');
            if (activeDiff) return activeDiff;
            const pri = Number(a.priority || 0) - Number(b.priority || 0);
            if (pri) return pri;
            return String(a.name || '').localeCompare(String(b.name || ''));
        });
    }, [rules, filter]);

    const hasPlatformRules = rules.some((r) => r.scope === 'platform');
    const filters = FILTERS.filter((f) => f !== 'platform' || hasPlatformRules);
    const roleLabel = (role) => (COMMISSION_RULE_ROLES.includes(role) ? t(`rules.role.${role}`) : role || '—');

    const headers = [
        t('rules.th.rule'),
        t('rules.th.scope'),
        t('rules.th.role'),
        t('rules.th.rate'),
        t('rules.th.priority'),
        t('rules.th.status'),
        t('rules.th.actions'),
    ];

    return (
        <div className="wcr-list">
            <div className="wcr-list__head">
                <div>
                    <h3 className="wcr-list__title">{t('rules.title')}</h3>
                    <p className="wcr-list__sub">{t('rules.subtitle')}</p>
                </div>
                <div className="wcr-list__actions">
                    <label className="wcr-search">
                        <Search size={15} aria-hidden />
                        <input
                            className="wcr-input"
                            type="search"
                            value={searchInput}
                            aria-label={t('rules.searchPlaceholder')}
                            placeholder={t('rules.searchPlaceholder')}
                            onChange={(e) => setSearchInput(e.target.value)}
                        />
                    </label>
                    {can('create') ? (
                        <button type="button" className="wcr-new-btn" onClick={() => onOpenRule?.(null, false)}>
                            <Plus size={16} aria-hidden /> {t('rules.newRule')}
                        </button>
                    ) : null}
                </div>
            </div>

            <div className="wcr-howto">
                <Info size={16} aria-hidden />
                <span>{t('rules.howItWorks')}</span>
            </div>

            <div className="wcr-filters" role="tablist">
                {filters.map((f) => (
                    <button
                        key={f}
                        type="button"
                        role="tab"
                        aria-selected={filter === f}
                        className={`wcr-filter${filter === f ? ' is-on' : ''}`}
                        onClick={() => setFilter(f)}
                    >
                        {t(`rules.filter.${f}`)}
                    </button>
                ))}
                {!loading ? (
                    <span className="wcr-filters__count">{t('rules.count', { count: visibleRules.length })}</span>
                ) : null}
            </div>

            {error ? <div className="wcr-error">{error}</div> : null}

            <div className="wcr-table-wrap">
                <table className="ws-table wcr-table">
                    <thead>
                        <tr>
                            {headers.map((h) => (
                                <th key={h}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={headers.length} className="wcr-empty">
                                    {t('rules.loading')}
                                </td>
                            </tr>
                        ) : visibleRules.length === 0 ? (
                            <tr>
                                <td colSpan={headers.length} className="wcr-empty">
                                    {search || filter !== 'all' ? t('rules.emptySearch') : t('rules.empty')}
                                </td>
                            </tr>
                        ) : (
                            visibleRules.map((r) => {
                                const id = String(r.id);
                                const isPlatform = r.scope === 'platform' || r.readOnly;
                                const inactive = r.status === 'inactive';
                                const canEdit = !isPlatform && can('edit');
                                const canDelete = !isPlatform && can('delete');
                                return (
                                    <tr key={id} className={inactive ? 'is-inactive' : undefined}>
                                        <td>
                                            <div className="wcr-rule-name">
                                                {r.name || '—'}
                                                {isPlatform ? (
                                                    <span className="wcr-platform-tag" title={t('rules.badge.platformHint')}>
                                                        <Lock size={11} aria-hidden />
                                                        {t('rules.badge.platform')}
                                                    </span>
                                                ) : null}
                                            </div>
                                            {r.notes ? (
                                                <div className="wcr-rule-notes" title={r.notes}>
                                                    {r.notes}
                                                </div>
                                            ) : null}
                                        </td>
                                        <td>
                                            <ScopeChips rule={r} t={t} />
                                        </td>
                                        <td>
                                            <div className="wcr-role-cell">{roleLabel(r.employeeRole)}</div>
                                            {(r.people || []).length ? (
                                                <div className="wcr-scope">
                                                    {(r.people.length > 2 ? r.people.slice(0, 2) : r.people).map((p) => (
                                                        <span key={p.id} className="wcr-scope__chip wcr-scope__chip--person" title={p.name}>
                                                            {p.name}
                                                        </span>
                                                    ))}
                                                    {r.people.length > 2 ? (
                                                        <span
                                                            className="wcr-scope__chip wcr-scope__chip--person"
                                                            title={r.people.slice(2).map((p) => p.name).join(', ')}
                                                        >
                                                            +{r.people.length - 2}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            ) : null}
                                        </td>
                                        <td className="wcr-rate-cell">
                                            <bdi>{r.useProfilePercent ? t('rules.rate.profile') : `${Number(r.value || 0)}%`}</bdi>
                                        </td>
                                        <td>{r.priority || 1}</td>
                                        <td>
                                            <span className={`ws-badge ws-badge--${inactive ? 'gray' : 'green'}`}>
                                                {t(inactive ? 'rules.status.inactive' : 'rules.status.active')}
                                            </span>
                                        </td>
                                        <td>
                                            {pendingDeleteId === id ? (
                                                <span className="wcr-confirm">
                                                    <span>{t('rules.deleteConfirm')}</span>
                                                    <button
                                                        type="button"
                                                        className="is-danger"
                                                        onClick={() => onDelete(id)}
                                                        disabled={deleteLoadingId === id}
                                                    >
                                                        {deleteLoadingId === id ? t('rules.deleting') : t('rules.yes')}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setPendingDeleteId('')}
                                                        disabled={deleteLoadingId === id}
                                                    >
                                                        {t('btn.cancel')}
                                                    </button>
                                                </span>
                                            ) : (
                                                <span className="wcr-actions">
                                                    {canEdit ? (
                                                        <button
                                                            type="button"
                                                            className="wcr-icon-btn"
                                                            title={t('rules.editTitle')}
                                                            aria-label={t('rules.editTitle')}
                                                            onClick={() => onOpenRule?.(r, false)}
                                                        >
                                                            <Pencil size={15} />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            className="wcr-icon-btn"
                                                            title={t('rules.viewTitle')}
                                                            aria-label={t('rules.viewTitle')}
                                                            onClick={() => onOpenRule?.(r, true)}
                                                        >
                                                            <Eye size={15} />
                                                        </button>
                                                    )}
                                                    {canDelete ? (
                                                        <button
                                                            type="button"
                                                            className="wcr-icon-btn wcr-icon-btn--danger"
                                                            title={t('rules.deleteTitle')}
                                                            aria-label={t('rules.deleteTitle')}
                                                            onClick={() => setPendingDeleteId(id)}
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    ) : null}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
