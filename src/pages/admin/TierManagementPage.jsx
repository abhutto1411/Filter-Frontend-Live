import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
    AlertTriangle, ArrowDown, ArrowRight, ArrowUp, Award, BarChart3, CheckCircle2, Pencil,
    Plus, Search, Settings, ShieldCheck, Trash2, TrendingUp, Users, Wallet, X, Zap,
} from 'lucide-react';
import {
    Area, AreaChart, CartesianGrid, Cell, Legend, Pie, PieChart,
    ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import AdminModalAsScreen from '../../components/admin/AdminModalAsScreen';
import UiPager from '../../components/UiPager';
import { usePagedRows, useServerPaging } from '../../hooks/usePagedRows';
import {
    marketingListLoyaltyTiers,
    marketingCreateLoyaltyTier,
    marketingUpdateLoyaltyTier,
    marketingDeleteLoyaltyTier,
    marketingReorderLoyaltyTiers,
    marketingListLoyaltyRules,
    marketingCreateLoyaltyRule,
    marketingUpdateLoyaltyRule,
    marketingDeleteLoyaltyRule,
    marketingRunLoyaltyMonthlyReset,
    marketingListLoyaltyAccounts,
    marketingGetLoyaltyReports,
} from '../../services/superAdminMarketingApi';
import { BUSINESS_TIMEZONE } from '../../utils/riyadhBusinessRange';
import { tierT } from '../../utils/tierManagementI18n';
import '../../styles/ui.css';

const EMPTY_TIER_FORM = {
    name: '',
    icon: '🎁',
    color: '#fbbf24',
    minSales: 0,
    maxSales: 0,
    discount: 0,
    status: 'active',
    priority: false,
    eligiblePromotions: true,
    benefits: [],
    description: '',
    rate: 1,
    threshold: 500,
    value: 25,
    type: 'tier_assign',
    condition: { field: 'monthly_spend', operator: '>=', value: 0, maxValue: 0 },
    action: { type: 'assign_tier', tierId: '', value: 0 },
};

/**
 * Recharts takes literal colour strings, not CSS variables, so the series
 * colours are ui.css token values written out: ok, dang, and the neutral the
 * gridlines use.
 */
const CHART = {
    ok: '#067647',
    dang: '#b42318',
    grid: '#e4e7ec',
};

/** The slice colour for a tier the server stored no colour for. */
const FALLBACK_SLICE = '#98a2b3';

/** Workflow status, named by what it means rather than by its colour. */
const STATUS_TONE = {
    active: 'ok',
    inactive: 'neutral',
    paused: 'warn',
};

/** Rule kind. Three kinds, three tones, so a list of them reads at a glance. */
const RULE_TYPE_TONE = {
    tier_assign: 'info',
    earn: 'ok',
    redeem: 'warn',
};

/** The icon that stands for each rule kind. */
const RULE_TYPE_ICON = {
    tier_assign: ShieldCheck,
    earn: Zap,
    redeem: Award,
};

/** The server labels an account by whether it has a corporate account. */
const ACCOUNT_TYPE_KEY = {
    Corporate: 'accType.corporate',
    'Walk-In': 'accType.walkin',
};

/**
 * One figure. The icon bleeds off the corner as a watermark rather than
 * sitting in a tinted disc, so a band of four still reads as one row.
 */
const Metric = (props) => {
    const { label, value, tone } = props;
    // Assigned rather than destructured as `icon: Icon`: this eslint config has
    // no React plugin, so JSX use is not a reference and a destructured arg is
    // reported unused. `varsIgnorePattern: '^[A-Z_]'` covers a variable.
    const Icon = props.icon;
    return (
        <div className={`ui-metric${tone ? ` ui-metric--${tone}` : ''}`}>
            <Icon className="ui-metric-icon" size={58} strokeWidth={1.5} aria-hidden />
            <div className="ui-metric-label">{label}</div>
            <div className="ui-metric-value">{value}</div>
        </div>
    );
};

/** Panel chrome for a chart. */
const ChartCard = ({ title, children }) => (
    <section className="ui-panel">
        <div className="ui-panel-head">
            <div className="ui-panel-title">{title}</div>
        </div>
        <div className="ui-panel-pad">{children}</div>
    </section>
);

/** The shape a band of figures is about to take. */
const KpiSkeleton = ({ count = 4 }) => (
    <div className="ui-kpis">
        {Array.from({ length: count }).map((_, i) => (
            <div key={`sk-kpi-${i}`} className="ui-metric ui-stack-sm">
                <div className="ui-sk ui-sk--label ui-sk--w55" />
                <div className="ui-sk ui-sk--title ui-sk--w70" />
            </div>
        ))}
    </div>
);

/** The shape a grid of cards is about to take. */
const PanelSkeleton = ({ count = 4 }) => (
    <div className="ui-panels">
        {Array.from({ length: count }).map((_, i) => (
            <section key={`sk-panel-${i}`} className="ui-panel ui-panel-pad ui-stack-sm">
                <div className="ui-sk ui-sk--strong ui-sk--w55" />
                <div className="ui-sk ui-sk--text ui-sk--w90" />
                <div className="ui-sk ui-sk--text ui-sk--w40" />
            </section>
        ))}
    </div>
);

/** The shape a table is about to take, so its columns do not jump. */
const TableSkeleton = ({ cols, rows = 6 }) => (
    <tbody aria-busy="true">
        {Array.from({ length: rows }).map((_, r) => (
            <tr key={`sk-row-${r}`}>
                {Array.from({ length: cols }).map((__, c) => (
                    <td key={`sk-cell-${r}-${c}`}>
                        <div className="ui-sk ui-sk--text ui-sk--w70" />
                    </td>
                ))}
            </tr>
        ))}
    </tbody>
);

export default function TierManagementPage() {
    const outletCtx = useOutletContext() || {};
    const locale =
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('marketing-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => tierT(locale, key, vars), [locale]);
    const numberLocale = locale === 'ar' ? 'ar-SA' : undefined;

    const fmt = useCallback((n) => Number(n || 0).toLocaleString(numberLocale), [numberLocale]);
    const sar = useCallback((n) => t('money.sar', { amount: fmt(n) }), [t, fmt]);
    // Stated in the business timezone. Without it a visit stored just after
    // Riyadh midnight reads as the previous day to a browser further west.
    const fmtDate = useCallback((iso) => {
        if (!iso) return t('common.emDash');
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return t('common.emDash');
        return d.toLocaleDateString(numberLocale, { timeZone: BUSINESS_TIMEZONE });
    }, [t, numberLocale]);

    const statusLabel = useCallback((status) => {
        const key = `status.${status}`;
        const translated = t(key);
        return translated === key ? status : translated;
    }, [t]);

    const typeLabel = useCallback((type) => {
        if (!type) return t('rules.na');
        const key = `type.${type}`;
        const translated = t(key);
        return translated === key ? String(type).replace('_', ' ') : translated;
    }, [t]);

    const fieldLabel = useCallback((field) => {
        if (!field) return t('rules.na');
        const key = `field.${field}`;
        const translated = t(key);
        return translated === key ? String(field).replace('_', ' ') : translated;
    }, [t]);

    const accountTypeLabel = useCallback((type) => {
        const key = ACCOUNT_TYPE_KEY[type];
        return key ? t(key) : type || t('common.emDash');
    }, [t]);

    const actionLabel = useCallback((actionType) => {
        if (!actionType) return t('rules.na');
        const key = `action.${actionType}`;
        const translated = t(key);
        return translated === key ? String(actionType).replace('_', ' ') : translated;
    }, [t]);

    const [activeTab, setActiveTab] = useState('corporate');

    // Live data
    const [tiers, setTiers] = useState([]);
    const [rules, setRules] = useState([]);
    const [loyaltyAccounts, setLoyaltyAccounts] = useState([]);
    const [accountsTotal, setAccountsTotal] = useState(0);
    const [reports, setReports] = useState(null);

    const [loading, setLoading] = useState(true);
    const [accountsLoading, setAccountsLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState(null);
    const [accountSearch, setAccountSearch] = useState('');
    const [debouncedAccountSearch, setDebouncedAccountSearch] = useState('');

    // Modals
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingTier, setEditingTier] = useState(null);
    const [earnModalOpen, setEarnModalOpen] = useState(false);
    const [redemptModalOpen, setRedemptModalOpen] = useState(false);
    const [ruleModalOpen, setRuleModalOpen] = useState(false);
    const [editingRule, setEditingRule] = useState(null);
    const [formState, setFormState] = useState(EMPTY_TIER_FORM);
    const [newBenefit, setNewBenefit] = useState('');

    const earnRules = useMemo(() => rules.filter((r) => r.type === 'earn'), [rules]);
    const redemptRules = useMemo(() => rules.filter((r) => r.type === 'redeem'), [rules]);

    const flash = useCallback((type, msg) => {
        setNotice({ type, msg });
        window.clearTimeout(flash._t);
        flash._t = window.setTimeout(() => setNotice(null), 4000);
    }, []);

    /* ---------------- Paging ---------------- */
    // Tiers, rules and the top-accounts table are whole lists in memory, so
    // they page in the browser. The loyalty accounts table is paged by the
    // server, which already took `offset` and returned `total` while this
    // screen asked for 200 rows and showed every one of them.
    const tiersPaging = usePagedRows(tiers);
    const rulesPaging = usePagedRows(rules);

    useEffect(() => {
        const timer = window.setTimeout(() => setDebouncedAccountSearch(accountSearch.trim()), 350);
        return () => window.clearTimeout(timer);
    }, [accountSearch]);

    const {
        page: accountsPage,
        pageSize: accountsPageSize,
        pagerFor: accountsPagerFor,
    } = useServerPaging({ resetKey: debouncedAccountSearch });

    /* ---------------- Data loading ---------------- */
    const loadTiers = useCallback(async () => {
        const res = await marketingListLoyaltyTiers();
        setTiers(res?.tiers || res?.data || []);
    }, []);

    const loadRules = useCallback(async () => {
        const res = await marketingListLoyaltyRules();
        setRules(res?.rules || res?.data || []);
    }, []);

    const loadAccounts = useCallback(async () => {
        const res = await marketingListLoyaltyAccounts({
            search: debouncedAccountSearch || undefined,
            limit: accountsPageSize,
            offset: (accountsPage - 1) * accountsPageSize,
        });
        const rows = res?.accounts || res?.data || [];
        setLoyaltyAccounts(rows);
        const count = Number(res?.total);
        setAccountsTotal(Number.isFinite(count) ? count : rows.length);
    }, [debouncedAccountSearch, accountsPage, accountsPageSize]);

    const loadReports = useCallback(async () => {
        const res = await marketingGetLoyaltyReports();
        setReports(res || null);
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                await Promise.all([loadTiers(), loadRules(), loadReports()]);
            } catch (err) {
                if (!cancelled) flash('error', err?.message || t('error.loadFailed'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [loadTiers, loadRules, loadReports, flash, t]);

    // Accounts load on their own so a search or a page turn does not pull the
    // tiers, rules and reports down with them.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setAccountsLoading(true);
            try {
                await loadAccounts();
            } catch (err) {
                if (!cancelled) flash('error', err?.message || t('error.loadFailed'));
            } finally {
                if (!cancelled) setAccountsLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [loadAccounts, flash, t]);

    /* ---------------- Tier helpers ---------------- */
    const openEdit = (tier) => {
        setEditingTier(tier);
        setFormState({ ...EMPTY_TIER_FORM, ...tier, benefits: [...(tier.benefits || [])] });
        setEditModalOpen(true);
    };

    const openNewTier = () => {
        setEditingTier(null);
        setFormState({ ...EMPTY_TIER_FORM });
        setEditModalOpen(true);
    };

    const handleSaveTier = async () => {
        const payload = {
            name: formState.name,
            icon: formState.icon,
            color: formState.color,
            minSales: Number(formState.minSales) || 0,
            maxSales: Number(formState.maxSales) || 0,
            discount: Number(formState.discount) || 0,
            status: formState.status,
            priority: Boolean(formState.priority),
            eligiblePromotions: formState.eligiblePromotions !== false,
            benefits: formState.benefits || [],
        };
        if (!payload.name.trim()) { flash('error', t('flash.tierNameRequired')); return; }
        setBusy(true);
        try {
            if (editingTier) {
                await marketingUpdateLoyaltyTier(editingTier.id, payload);
            } else {
                await marketingCreateLoyaltyTier(payload);
            }
            await Promise.all([loadTiers(), loadReports()]);
            setEditModalOpen(false);
            flash('success', editingTier ? t('flash.tierUpdated') : t('flash.tierCreated'));
        } catch (err) {
            flash('error', err?.message || t('flash.tierSaveFailed'));
        } finally {
            setBusy(false);
        }
    };

    const handleDeleteTier = async (tier) => {
        if (!window.confirm(t('flash.tierDeleteConfirm', { name: tier.name }))) return;
        setBusy(true);
        try {
            await marketingDeleteLoyaltyTier(tier.id);
            await Promise.all([loadTiers(), loadReports()]);
            flash('success', t('flash.tierDeleted'));
        } catch (err) {
            flash('error', err?.message || t('flash.tierDeleteFailed'));
        } finally {
            setBusy(false);
        }
    };

    const handleToggleTier = async (tier, active) => {
        setTiers((prev) => prev.map((row) => (row.id === tier.id ? { ...row, status: active ? 'active' : 'inactive' } : row)));
        try {
            await marketingUpdateLoyaltyTier(tier.id, { status: active ? 'active' : 'inactive' });
        } catch (err) {
            flash('error', err?.message || t('flash.tierUpdateFailed'));
            loadTiers();
        }
    };

    const moveTier = async (index, direction) => {
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= tiers.length) return;
        const next = [...tiers];
        [next[index], next[newIndex]] = [next[newIndex], next[index]];
        setTiers(next);
        try {
            await marketingReorderLoyaltyTiers(next.map((row) => row.id));
        } catch (err) {
            flash('error', err?.message || t('flash.reorderFailed'));
            loadTiers();
        }
    };

    const addBenefit = () => {
        if (newBenefit.trim()) {
            setFormState((p) => ({ ...p, benefits: [...(p.benefits || []), newBenefit.trim()] }));
            setNewBenefit('');
        }
    };
    const removeBenefit = (index) =>
        setFormState((p) => ({ ...p, benefits: p.benefits.filter((_, i) => i !== index) }));

    /* ---------------- Rule helpers ---------------- */
    const openNewEarnRule = () => {
        setEditingRule(null);
        setFormState({ ...EMPTY_TIER_FORM, name: '', description: '', rate: 1, priority: 10, status: 'active' });
        setEarnModalOpen(true);
    };
    const openEditEarnRule = (rule) => {
        setEditingRule(rule);
        setFormState({ ...EMPTY_TIER_FORM, ...rule });
        setEarnModalOpen(true);
    };
    const openNewRedemptRule = () => {
        setEditingRule(null);
        setFormState({ ...EMPTY_TIER_FORM, name: '', description: '', threshold: 500, value: 25, priority: 10, status: 'active' });
        setRedemptModalOpen(true);
    };
    const openEditRedemptRule = (rule) => {
        setEditingRule(rule);
        setFormState({ ...EMPTY_TIER_FORM, ...rule });
        setRedemptModalOpen(true);
    };

    const saveLoyaltyRule = async (kind) => {
        const type = kind === 'earn' ? 'earn' : 'redeem';
        const payload = {
            name: formState.name,
            description: formState.description,
            type,
            status: formState.status || 'active',
            priority: Number(formState.priority) || 10,
        };
        if (type === 'earn') {
            payload.rate = Number(formState.rate) || 1;
        } else {
            payload.threshold = Number(formState.threshold) || 0;
            payload.value = Number(formState.value) || 0;
        }
        if (!payload.name.trim()) { flash('error', t('flash.ruleNameRequired')); return; }
        setBusy(true);
        try {
            if (editingRule) {
                await marketingUpdateLoyaltyRule(editingRule.id, payload);
            } else {
                await marketingCreateLoyaltyRule(payload);
            }
            await Promise.all([loadRules(), loadReports()]);
            if (type === 'earn') setEarnModalOpen(false);
            else setRedemptModalOpen(false);
            flash('success', editingRule ? t('flash.ruleUpdated') : t('flash.ruleCreated'));
        } catch (err) {
            flash('error', err?.message || t('flash.ruleSaveFailed'));
        } finally {
            setBusy(false);
        }
    };

    const toggleRuleStatus = async (rule, status) => {
        setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, status } : r)));
        try {
            await marketingUpdateLoyaltyRule(rule.id, { status });
        } catch (err) {
            flash('error', err?.message || t('flash.ruleUpdateFailed'));
            loadRules();
        }
    };

    const openNewRule = () => {
        setEditingRule(null);
        setFormState({
            ...EMPTY_TIER_FORM,
            name: '',
            description: '',
            type: 'tier_assign',
            priority: 10,
            status: 'active',
            condition: { field: 'monthly_spend', operator: '>=', value: 0, maxValue: 0 },
            action: { type: 'assign_tier', tierId: tiers[0]?.id || '', value: 0 },
        });
        setRuleModalOpen(true);
    };

    const openEditRule = (rule) => {
        setEditingRule(rule);
        setFormState({
            ...EMPTY_TIER_FORM,
            ...rule,
            condition: {
                field: 'monthly_spend', operator: '>=', value: 0, maxValue: 0,
                ...(rule.condition || {}),
            },
            action: {
                type: 'assign_tier', tierId: '', value: 0,
                ...(rule.action || {}),
            },
        });
        setRuleModalOpen(true);
    };

    const saveRule = async () => {
        const payload = {
            name: formState.name,
            description: formState.description,
            type: formState.type,
            priority: Number(formState.priority) || 10,
            status: formState.status || 'active',
            condition: formState.condition,
            action: formState.action,
        };
        if (!payload.name.trim()) { flash('error', t('flash.ruleNameRequired')); return; }
        setBusy(true);
        try {
            if (editingRule) {
                await marketingUpdateLoyaltyRule(editingRule.id, payload);
            } else {
                await marketingCreateLoyaltyRule(payload);
            }
            await Promise.all([loadRules(), loadReports()]);
            setRuleModalOpen(false);
            flash('success', editingRule ? t('flash.ruleUpdated') : t('flash.ruleCreated'));
        } catch (err) {
            flash('error', err?.message || t('flash.ruleSaveFailed'));
        } finally {
            setBusy(false);
        }
    };

    const deleteRule = async (id) => {
        if (!window.confirm(t('flash.ruleDeleteConfirm'))) return;
        setBusy(true);
        try {
            await marketingDeleteLoyaltyRule(id);
            await Promise.all([loadRules(), loadReports()]);
            flash('success', t('flash.ruleDeleted'));
        } catch (err) {
            flash('error', err?.message || t('flash.ruleDeleteFailed'));
        } finally {
            setBusy(false);
        }
    };

    const runMonthlyReset = async () => {
        if (!window.confirm(t('flash.monthlyResetConfirm'))) return;
        setBusy(true);
        try {
            const res = await marketingRunLoyaltyMonthlyReset();
            await Promise.all([loadAccounts(), loadReports()]);
            flash('success', t('flash.monthlyResetDone', { count: res?.accountsReset ?? 0 }));
        } catch (err) {
            flash('error', err?.message || t('flash.monthlyResetFailed'));
        } finally {
            setBusy(false);
        }
    };

    /* ---------------- Derived report stats ---------------- */
    const stats = reports?.stats || {};
    const walkinStats = [
        { label: t('stat.totalPointsIssued'), value: fmt(stats.totalPointsIssued), icon: Award, tone: 'brand' },
        { label: t('stat.availablePoints'), value: fmt(stats.availablePoints), icon: Zap, tone: 'ok' },
        { label: t('stat.pointsRedeemed'), value: fmt(stats.pointsRedeemed), icon: TrendingUp, tone: 'info' },
        { label: t('stat.loyaltyLiability'), value: sar(stats.loyaltyLiability), icon: Wallet, tone: 'dang' },
    ];
    const reportStats = [
        { label: t('stat.corporateCustomers'), value: fmt(stats.corporateCustomers), icon: ShieldCheck, tone: 'info' },
        { label: t('stat.walkInLoyaltyAccts'), value: fmt(stats.walkInLoyaltyAccounts), icon: Users, tone: 'ok' },
        { label: t('stat.totalPointsIssued'), value: fmt(stats.totalPointsIssued), icon: Award, tone: 'brand' },
        { label: t('stat.loyaltyLiability'), value: sar(stats.loyaltyLiability), icon: Wallet, tone: 'dang' },
    ];
    const tierDist = reports?.tierDistribution || [];
    const trendData = reports?.pointsTrend || [];
    const trendTotals = reports?.pointsTrendTotals || { earned: 0, redeemed: 0, outstanding: 0 };
    const topAccounts = reports?.topAccounts || [];
    const topAccountsPaging = usePagedRows(topAccounts);

    const TABS = [
        { id: 'corporate', label: t('tab.corporate'), icon: ShieldCheck },
        { id: 'walkin', label: t('tab.walkin'), icon: Users },
        { id: 'rules', label: t('tab.rules'), icon: Settings },
        { id: 'reports', label: t('tab.reports'), icon: BarChart3 },
    ];

    const tierNameById = (id) => tiers.find((row) => String(row.id) === String(id))?.name || id || t('common.emDash');

    /** The status pill for a row, in the tone its state means. */
    const statusPill = (status) => (
        <span className={`ui-pill ui-pill--${STATUS_TONE[String(status).toLowerCase()] || 'neutral'}`}>
            {statusLabel(status)}
        </span>
    );

    /** The switch that turns a tier or a rule on and off. */
    const onOffSwitch = (checked, onChange, label) => (
        <label className="ui-switch" onClick={(e) => e.stopPropagation()} title={label}>
            <input
                type="checkbox"
                checked={checked}
                aria-label={label}
                onChange={(e) => onChange(e.target.checked)}
            />
            <span className="ui-switch-track" />
        </label>
    );

    /** The pair of buttons every one of these form screens closes with. */
    const formFoot = (onCancel, onSave, saveLabel) => (
        <div className="ui-form-foot">
            <button type="button" className="ui-btn ui-btn--default" onClick={onCancel} disabled={busy}>
                {t('modal.cancel')}
            </button>
            <button type="button" className="ui-btn ui-btn--primary" onClick={onSave} disabled={busy}>
                {saveLabel}
            </button>
        </div>
    );

    /** One switch with its name and the line that explains it. */
    const settingToggle = (icon, name, hint, checked, onChange) => {
        const Icon = icon;
        return (
            <div className="ui-setting-head ui-setting-head--boxed">
                <span className="ui-setting-icon"><Icon size={16} /></span>
                <div className="ui-setting-text">
                    <div className="ui-setting-name">{name}</div>
                    {hint ? <div className="ui-help">{hint}</div> : null}
                </div>
                <label className="ui-switch">
                    <input
                        type="checkbox"
                        checked={checked}
                        aria-label={name}
                        onChange={(e) => onChange(e.target.checked)}
                    />
                    <span className="ui-switch-track" />
                </label>
            </div>
        );
    };

    if (editModalOpen || earnModalOpen || redemptModalOpen || ruleModalOpen) {
        return (
            <>
                {editModalOpen && (
                    <AdminModalAsScreen
                        title={editingTier ? t('modal.editTier') : t('modal.createTier')}
                        onClose={() => setEditModalOpen(false)}
                    >
                        <div className="ui-stack">
                            <div className="ui-form-grid">
                                <div className="ui-group-title">{t('modal.generalInfo')}</div>
                                <div className="ui-field ui-col-6">
                                    <label htmlFor="tier-name">{t('modal.tierName')}</label>
                                    <input
                                        id="tier-name"
                                        type="text"
                                        className="ui-input"
                                        placeholder={t('modal.tierNamePlaceholder')}
                                        value={formState.name}
                                        onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                                    />
                                </div>
                                <div className="ui-field ui-col-3">
                                    <label htmlFor="tier-icon">{t('modal.icon')}</label>
                                    <input
                                        id="tier-icon"
                                        type="text"
                                        className="ui-input"
                                        value={formState.icon}
                                        onChange={(e) => setFormState({ ...formState, icon: e.target.value })}
                                    />
                                </div>
                                <div className="ui-field ui-col-3">
                                    <label htmlFor="tier-color">{t('modal.accentColor')}</label>
                                    <input
                                        id="tier-color"
                                        type="color"
                                        className="ui-color"
                                        value={formState.color}
                                        onChange={(e) => setFormState({ ...formState, color: e.target.value })}
                                    />
                                </div>

                                <div className="ui-group-title">{t('modal.revenueRewards')}</div>
                                <div className="ui-field ui-col-4">
                                    <label htmlFor="tier-min">{t('modal.minSales')}</label>
                                    <input
                                        id="tier-min"
                                        type="number"
                                        className="ui-input"
                                        value={formState.minSales}
                                        onChange={(e) => setFormState({ ...formState, minSales: Number(e.target.value) })}
                                    />
                                </div>
                                <div className="ui-field ui-col-4">
                                    <label htmlFor="tier-max">{t('modal.maxSales')}</label>
                                    <input
                                        id="tier-max"
                                        type="number"
                                        className="ui-input"
                                        value={formState.maxSales}
                                        onChange={(e) => setFormState({ ...formState, maxSales: Number(e.target.value) })}
                                    />
                                </div>
                                <div className="ui-field ui-col-4">
                                    <label htmlFor="tier-discount">{t('modal.discountPct')}</label>
                                    <input
                                        id="tier-discount"
                                        type="number"
                                        className="ui-input"
                                        value={formState.discount}
                                        onChange={(e) => setFormState({ ...formState, discount: Number(e.target.value) })}
                                    />
                                </div>
                            </div>

                            <div className="ui-stack-sm">
                                <div className="ui-subgroup-title">{t('modal.featuresVisibility')}</div>
                                {settingToggle(
                                    Zap,
                                    t('modal.prioritySupport'),
                                    t('modal.prioritySupportHint'),
                                    Boolean(formState.priority),
                                    (checked) => setFormState({ ...formState, priority: checked }),
                                )}
                                {settingToggle(
                                    Award,
                                    t('modal.eligiblePromotions'),
                                    t('modal.eligiblePromotionsHint'),
                                    formState.eligiblePromotions !== false,
                                    (checked) => setFormState({ ...formState, eligiblePromotions: checked }),
                                )}
                                {settingToggle(
                                    ShieldCheck,
                                    t('modal.tierActive'),
                                    t('modal.tierActiveHint'),
                                    formState.status === 'active',
                                    (checked) => setFormState({ ...formState, status: checked ? 'active' : 'inactive' }),
                                )}
                            </div>

                            <div className="ui-stack-sm">
                                <div className="ui-subgroup-title">{t('modal.tierBenefits')}</div>
                                <div className="ui-addrow">
                                    <input
                                        type="text"
                                        className="ui-input"
                                        placeholder={t('modal.benefitPlaceholder')}
                                        value={newBenefit}
                                        onChange={(e) => setNewBenefit(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                addBenefit();
                                            }
                                        }}
                                    />
                                    <button
                                        type="button"
                                        className="ui-btn ui-btn--default"
                                        onClick={addBenefit}
                                        disabled={!newBenefit.trim()}
                                    >
                                        <Plus size={14} /> {t('modal.add')}
                                    </button>
                                </div>
                                {formState.benefits.length === 0 ? (
                                    <p className="ui-help">{t('corporate.noBenefits')}</p>
                                ) : (
                                    <div className="ui-tags">
                                        {formState.benefits.map((benefit, i) => (
                                            <span key={i} className="ui-tag">
                                                {benefit}
                                                <button
                                                    type="button"
                                                    className="ui-tag-x"
                                                    onClick={() => removeBenefit(i)}
                                                    aria-label={t('btn.delete')}
                                                >
                                                    <X size={12} />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {formFoot(
                                () => setEditModalOpen(false),
                                handleSaveTier,
                                editingTier ? t('modal.updateTier') : t('modal.createTierBtn'),
                            )}
                        </div>
                    </AdminModalAsScreen>
                )}

                {earnModalOpen && (
                    <AdminModalAsScreen
                        onClose={() => setEarnModalOpen(false)}
                        title={editingRule ? t('modal.editEarnRule') : t('modal.newEarnRule')}
                    >
                        <div className="ui-stack">
                            <div className="ui-form-grid">
                                <div className="ui-field ui-col-12">
                                    <label htmlFor="earn-name">{t('modal.ruleName')}</label>
                                    <input
                                        id="earn-name"
                                        type="text"
                                        className="ui-input"
                                        value={formState.name}
                                        onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                                        placeholder={t('modal.earnNamePlaceholder')}
                                    />
                                </div>
                                <div className="ui-field ui-col-12">
                                    <label htmlFor="earn-desc">{t('modal.description')}</label>
                                    <textarea
                                        id="earn-desc"
                                        className="ui-textarea"
                                        value={formState.description}
                                        onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                                        placeholder={t('modal.earnDescPlaceholder')}
                                    />
                                </div>
                                <div className="ui-field ui-col-6">
                                    <label htmlFor="earn-rate">{t('modal.pointsPerSar')}</label>
                                    <input
                                        id="earn-rate"
                                        type="number"
                                        className="ui-input"
                                        value={formState.rate}
                                        onChange={(e) => setFormState({ ...formState, rate: e.target.value })}
                                    />
                                </div>
                                <div className="ui-field ui-col-6">
                                    <label htmlFor="earn-priority">{t('modal.priority')}</label>
                                    <input
                                        id="earn-priority"
                                        type="number"
                                        className="ui-input"
                                        value={formState.priority}
                                        onChange={(e) => setFormState({ ...formState, priority: e.target.value })}
                                    />
                                </div>
                            </div>

                            {formFoot(
                                () => setEarnModalOpen(false),
                                () => saveLoyaltyRule('earn'),
                                editingRule ? t('modal.updateRule') : t('modal.createRule'),
                            )}
                        </div>
                    </AdminModalAsScreen>
                )}

                {redemptModalOpen && (
                    <AdminModalAsScreen
                        onClose={() => setRedemptModalOpen(false)}
                        title={editingRule ? t('modal.editRedemptRule') : t('modal.newRedemptRule')}
                    >
                        <div className="ui-stack">
                            <div className="ui-form-grid">
                                <div className="ui-field ui-col-12">
                                    <label htmlFor="rdm-name">{t('modal.ruleName')}</label>
                                    <input
                                        id="rdm-name"
                                        type="text"
                                        className="ui-input"
                                        value={formState.name}
                                        onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                                        placeholder={t('modal.redemptNamePlaceholder')}
                                    />
                                </div>
                                <div className="ui-field ui-col-12">
                                    <label htmlFor="rdm-desc">{t('modal.description')}</label>
                                    <textarea
                                        id="rdm-desc"
                                        className="ui-textarea"
                                        value={formState.description}
                                        onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                                        placeholder={t('modal.redemptDescPlaceholder')}
                                    />
                                </div>
                                <div className="ui-field ui-col-4">
                                    <label htmlFor="rdm-threshold">{t('modal.pointsThreshold')}</label>
                                    <input
                                        id="rdm-threshold"
                                        type="number"
                                        className="ui-input"
                                        value={formState.threshold}
                                        onChange={(e) => setFormState({ ...formState, threshold: e.target.value })}
                                    />
                                </div>
                                <div className="ui-field ui-col-4">
                                    <label htmlFor="rdm-value">{t('modal.sarValue')}</label>
                                    <input
                                        id="rdm-value"
                                        type="number"
                                        className="ui-input"
                                        value={formState.value}
                                        onChange={(e) => setFormState({ ...formState, value: e.target.value })}
                                    />
                                </div>
                                <div className="ui-field ui-col-4">
                                    <label htmlFor="rdm-priority">{t('modal.priority')}</label>
                                    <input
                                        id="rdm-priority"
                                        type="number"
                                        className="ui-input"
                                        value={formState.priority}
                                        onChange={(e) => setFormState({ ...formState, priority: e.target.value })}
                                    />
                                </div>
                            </div>

                            {formFoot(
                                () => setRedemptModalOpen(false),
                                () => saveLoyaltyRule('redeem'),
                                editingRule ? t('modal.updateRule') : t('modal.createRule'),
                            )}
                        </div>
                    </AdminModalAsScreen>
                )}

                {ruleModalOpen && (
                    <AdminModalAsScreen
                        onClose={() => setRuleModalOpen(false)}
                        title={editingRule ? t('modal.editRule') : t('modal.newRule')}
                    >
                        <div className="ui-stack">
                            <div className="ui-form-grid">
                                <div className="ui-field ui-col-12">
                                    <label htmlFor="rule-name">
                                        {t('modal.ruleName')} <span className="ui-field-req">*</span>
                                    </label>
                                    <input
                                        id="rule-name"
                                        type="text"
                                        className="ui-input"
                                        value={formState.name}
                                        onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                                        placeholder={t('modal.ruleNamePlaceholder')}
                                    />
                                </div>
                                <div className="ui-field ui-col-12">
                                    <label htmlFor="rule-desc">{t('modal.description')}</label>
                                    <textarea
                                        id="rule-desc"
                                        className="ui-textarea"
                                        value={formState.description}
                                        onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                                        placeholder={t('modal.ruleDescPlaceholder')}
                                    />
                                </div>
                                <div className="ui-field ui-col-8">
                                    <label htmlFor="rule-type">{t('modal.ruleType')}</label>
                                    <select
                                        id="rule-type"
                                        className="ui-select"
                                        value={formState.type}
                                        onChange={(e) => setFormState({ ...formState, type: e.target.value })}
                                    >
                                        <option value="tier_assign">{t('modal.typeTierAssign')}</option>
                                        <option value="earn">{t('modal.typeEarn')}</option>
                                        <option value="redeem">{t('modal.typeRedeem')}</option>
                                    </select>
                                </div>
                                <div className="ui-field ui-col-4">
                                    <label htmlFor="rule-priority">{t('modal.priorityHint')}</label>
                                    <input
                                        id="rule-priority"
                                        type="number"
                                        className="ui-input"
                                        value={formState.priority}
                                        onChange={(e) => setFormState({
                                            ...formState,
                                            priority: parseInt(e.target.value, 10) || 0,
                                        })}
                                    />
                                </div>
                            </div>

                            <div className="ui-form-grid">
                                <div className="ui-group-title">{t('modal.ifCondition')}</div>
                                <div className="ui-field ui-col-4">
                                    <label htmlFor="cond-field">{t('modal.field')}</label>
                                    <select
                                        id="cond-field"
                                        className="ui-select"
                                        value={formState.condition.field}
                                        onChange={(e) => setFormState({
                                            ...formState,
                                            condition: { ...formState.condition, field: e.target.value },
                                        })}
                                    >
                                        <option value="monthly_spend">{t('modal.fieldMonthlySpend')}</option>
                                        <option value="loyalty_points">{t('modal.fieldLoyaltyPoints')}</option>
                                        <option value="invoice_total">{t('modal.fieldInvoiceTotal')}</option>
                                        <option value="lifetime_spend">{t('modal.fieldLifetimeSpend')}</option>
                                    </select>
                                </div>
                                <div className="ui-field ui-col-4">
                                    <label htmlFor="cond-op">{t('modal.operator')}</label>
                                    <select
                                        id="cond-op"
                                        className="ui-select"
                                        value={formState.condition.operator}
                                        onChange={(e) => setFormState({
                                            ...formState,
                                            condition: { ...formState.condition, operator: e.target.value },
                                        })}
                                    >
                                        <option value=">=">{t('modal.opGte')}</option>
                                        <option value="<=">{t('modal.opLte')}</option>
                                        <option value="==">{t('modal.opEq')}</option>
                                        <option value="between">{t('modal.opBetween')}</option>
                                    </select>
                                </div>
                                <div className="ui-field ui-col-4">
                                    <label htmlFor="cond-value">{t('modal.value')}</label>
                                    <input
                                        id="cond-value"
                                        type="number"
                                        className="ui-input"
                                        value={formState.condition.value}
                                        onChange={(e) => setFormState({
                                            ...formState,
                                            condition: {
                                                ...formState.condition,
                                                value: parseInt(e.target.value, 10) || 0,
                                            },
                                        })}
                                    />
                                </div>
                                {formState.condition.operator === 'between' ? (
                                    <div className="ui-field ui-col-4">
                                        <label htmlFor="cond-max">{t('modal.maxValue')}</label>
                                        <input
                                            id="cond-max"
                                            type="number"
                                            className="ui-input"
                                            value={formState.condition.maxValue}
                                            onChange={(e) => setFormState({
                                                ...formState,
                                                condition: {
                                                    ...formState.condition,
                                                    maxValue: parseInt(e.target.value, 10) || 0,
                                                },
                                            })}
                                        />
                                    </div>
                                ) : null}
                            </div>

                            <div className="ui-form-grid">
                                <div className="ui-group-title">{t('modal.thenAction')}</div>
                                <div className="ui-field ui-col-6">
                                    <label htmlFor="act-type">{t('modal.action')}</label>
                                    <select
                                        id="act-type"
                                        className="ui-select"
                                        value={formState.action.type}
                                        onChange={(e) => setFormState({
                                            ...formState,
                                            action: { ...formState.action, type: e.target.value },
                                        })}
                                    >
                                        <option value="assign_tier">{t('modal.actionAssignTier')}</option>
                                        <option value="award_points">{t('modal.actionAwardPoints')}</option>
                                        <option value="apply_discount">{t('modal.actionApplyDiscountPct')}</option>
                                        <option value="apply_discount_val">{t('modal.actionApplyDiscountSar')}</option>
                                    </select>
                                </div>
                                {formState.action.type === 'assign_tier' ? (
                                    <div className="ui-field ui-col-6">
                                        <label htmlFor="act-tier">{t('modal.tier')}</label>
                                        <select
                                            id="act-tier"
                                            className="ui-select"
                                            value={formState.action.tierId}
                                            onChange={(e) => setFormState({
                                                ...formState,
                                                action: { ...formState.action, tierId: e.target.value },
                                            })}
                                        >
                                            <option value="">{t('modal.selectTier')}</option>
                                            {tiers.map((row) => (
                                                <option key={row.id} value={row.id}>{row.icon} {row.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                ) : (
                                    <div className="ui-field ui-col-6">
                                        <label htmlFor="act-value">{t('modal.value')}</label>
                                        <input
                                            id="act-value"
                                            type="number"
                                            className="ui-input"
                                            value={formState.action.value}
                                            onChange={(e) => setFormState({
                                                ...formState,
                                                action: {
                                                    ...formState.action,
                                                    value: parseInt(e.target.value, 10) || 0,
                                                },
                                            })}
                                        />
                                    </div>
                                )}
                            </div>

                            {settingToggle(
                                ShieldCheck,
                                t('modal.active'),
                                null,
                                formState.status === 'active',
                                (checked) => setFormState({ ...formState, status: checked ? 'active' : 'paused' }),
                            )}

                            {formFoot(() => setRuleModalOpen(false), saveRule, t('modal.saveRule'))}
                        </div>
                    </AdminModalAsScreen>
                )}
            </>
        );
    }

    return (
        // The portal layout prints the page title in its own top bar and sets
        // `dir` on its root, so this screen repeats neither.
        <div className="ui-root ui-root--flush ui-stack">
            {notice ? (
                <div
                    className={`ui-banner ui-banner--${notice.type === 'error' ? 'dang' : 'ok'}`}
                    role={notice.type === 'error' ? 'alert' : 'status'}
                >
                    {notice.type === 'error' ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
                    <span>{notice.msg}</span>
                    <button
                        type="button"
                        className="ui-banner-x"
                        onClick={() => setNotice(null)}
                        aria-label={t('notice.dismiss')}
                    >
                        <X size={13} />
                    </button>
                </div>
            ) : null}

            <div className="ui-tabs" role="tablist">
                {TABS.map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={activeTab === tab.id}
                            className="ui-tab"
                            onClick={() => setActiveTab(tab.id)}
                        >
                            <Icon size={14} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {loading ? (
                <div className="ui-stack" role="status" aria-label={t('loading')}>
                    {activeTab === 'walkin' || activeTab === 'reports' ? <KpiSkeleton /> : null}
                    <PanelSkeleton count={activeTab === 'walkin' || activeTab === 'reports' ? 2 : 4} />
                </div>
            ) : activeTab === 'corporate' ? (
                <div className="ui-tabpanel ui-stack" role="tabpanel">
                    <div className="ui-row">
                        <div className="ui-field ui-field--grow">
                            <div className="ui-panel-title">{t('corporate.title')}</div>
                            <p className="ui-help">{t('corporate.desc')}</p>
                        </div>
                        <div className="ui-toolbar-end">
                            <button type="button" className="ui-btn ui-btn--primary" onClick={openNewTier}>
                                <Plus size={15} /> {t('corporate.newTier')}
                            </button>
                        </div>
                    </div>

                    {tiers.length === 0 ? (
                        <div className="ui-empty">
                            <div className="ui-empty-icon"><Award size={18} /></div>
                            <div className="ui-empty-title">{t('corporate.empty')}</div>
                            <button type="button" className="ui-btn ui-btn--primary" onClick={openNewTier}>
                                <Plus size={14} /> {t('corporate.newTier')}
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="ui-panels">
                                {tiersPaging.pagedRows.map((tier, index) => {
                                    // The order a tier sits in is the order it is
                                    // evaluated in, so a move is against the whole
                                    // list, not against the page being shown.
                                    const absoluteIndex = tiersPaging.rowOffset + index;
                                    const benefits = tier.benefits || [];
                                    return (
                                        <section key={tier.id} className="ui-panel">
                                            <div className="ui-panel-head">
                                                <span className="ui-avatar" aria-hidden>{tier.icon}</span>
                                                <div>
                                                    <div className="ui-panel-title">
                                                        <span
                                                            className="ui-swatch"
                                                            style={{ background: tier.color || FALLBACK_SLICE }}
                                                            aria-hidden
                                                        />{' '}
                                                        {tier.name}
                                                    </div>
                                                    <div className="ui-help">
                                                        {t('corporate.rangeMonth', {
                                                            min: sar(tier.minSales),
                                                            max: sar(tier.maxSales),
                                                        })}
                                                    </div>
                                                </div>
                                                <div className="ui-panel-end">{statusPill(tier.status)}</div>
                                            </div>

                                            <div className="ui-panel-pad ui-stack-sm">
                                                {tier.discount > 0 || tier.priority ? (
                                                    <div className="ui-tags">
                                                        {tier.discount > 0 ? (
                                                            <span className="ui-pill ui-pill--info">
                                                                {t('corporate.discountOff', { discount: tier.discount })}
                                                            </span>
                                                        ) : null}
                                                        {tier.priority ? (
                                                            <span className="ui-pill ui-pill--warn">
                                                                {t('corporate.priority')}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                ) : null}

                                                <div className="ui-subgroup-title">{t('modal.tierBenefits')}</div>
                                                {benefits.length === 0 ? (
                                                    <p className="ui-help">{t('corporate.noBenefits')}</p>
                                                ) : (
                                                    <div className="ui-tags">
                                                        {benefits.map((benefit, idx) => (
                                                            <span key={idx} className="ui-tag">
                                                                <CheckCircle2 size={12} />
                                                                {benefit}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="ui-panel-foot">
                                                <button
                                                    type="button"
                                                    className="ui-btn ui-btn--default ui-btn--sm ui-btn--icon"
                                                    onClick={() => moveTier(absoluteIndex, -1)}
                                                    disabled={absoluteIndex === 0}
                                                    title={t('corporate.moveUp')}
                                                    aria-label={t('corporate.moveUp')}
                                                >
                                                    <ArrowUp size={14} />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="ui-btn ui-btn--default ui-btn--sm ui-btn--icon"
                                                    onClick={() => moveTier(absoluteIndex, 1)}
                                                    disabled={absoluteIndex === tiers.length - 1}
                                                    title={t('corporate.moveDown')}
                                                    aria-label={t('corporate.moveDown')}
                                                >
                                                    <ArrowDown size={14} />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="ui-btn ui-btn--default ui-btn--sm"
                                                    onClick={() => openEdit(tier)}
                                                >
                                                    <Pencil size={14} /> {t('btn.edit')}
                                                </button>

                                                <div className="ui-panel-end ui-rowacts">
                                                    {onOffSwitch(
                                                        tier.status === 'active',
                                                        (checked) => handleToggleTier(tier, checked),
                                                        t('modal.tierActive'),
                                                    )}
                                                    <button
                                                        type="button"
                                                        className="ui-btn ui-btn--danger ui-btn--sm"
                                                        onClick={() => handleDeleteTier(tier)}
                                                    >
                                                        <Trash2 size={14} /> {t('btn.delete')}
                                                    </button>
                                                </div>
                                            </div>
                                        </section>
                                    );
                                })}
                            </div>
                            <UiPager {...tiersPaging.pagerProps} />
                        </>
                    )}
                </div>
            ) : activeTab === 'walkin' ? (
                <div className="ui-tabpanel ui-stack" role="tabpanel">
                    <div className="ui-kpis">
                        {walkinStats.map((stat) => (
                            <Metric
                                key={stat.label}
                                label={stat.label}
                                value={stat.value}
                                icon={stat.icon}
                                tone={stat.tone}
                            />
                        ))}
                    </div>

                    <div className="ui-panels">
                        <section className="ui-panel">
                            <div className="ui-panel-head">
                                <div className="ui-panel-title">{t('walkin.earnRules')}</div>
                                <div className="ui-panel-end">
                                    <button
                                        type="button"
                                        className="ui-btn ui-btn--default ui-btn--sm"
                                        onClick={openNewEarnRule}
                                    >
                                        <Plus size={14} /> {t('walkin.add')}
                                    </button>
                                </div>
                            </div>
                            {earnRules.length === 0 ? (
                                <div className="ui-panel-pad">
                                    <p className="ui-help">{t('walkin.noEarnRules')}</p>
                                </div>
                            ) : (
                                <div>
                                    {earnRules.map((rule) => (
                                        <div key={rule.id} className="ui-list-row">
                                            <div className="ui-list-main">
                                                <div className="ui-list-title">{rule.name}</div>
                                                {rule.description ? (
                                                    <div className="ui-help">{rule.description}</div>
                                                ) : null}
                                                <div className="ui-list-meta">
                                                    {t('walkin.ptPerSar', { rate: fmt(rule.rate) })}
                                                </div>
                                            </div>
                                            <div className="ui-list-end">
                                                {statusPill(rule.status)}
                                                {onOffSwitch(
                                                    rule.status === 'active',
                                                    (checked) => toggleRuleStatus(rule, checked ? 'active' : 'paused'),
                                                    rule.name,
                                                )}
                                                <button
                                                    type="button"
                                                    className="ui-btn ui-btn--default ui-btn--sm ui-btn--icon"
                                                    onClick={() => openEditEarnRule(rule)}
                                                    aria-label={t('btn.edit')}
                                                    title={t('btn.edit')}
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="ui-btn ui-btn--danger ui-btn--sm ui-btn--icon"
                                                    onClick={() => deleteRule(rule.id)}
                                                    aria-label={t('btn.delete')}
                                                    title={t('btn.delete')}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>

                        <section className="ui-panel">
                            <div className="ui-panel-head">
                                <div className="ui-panel-title">{t('walkin.redemptRules')}</div>
                                <div className="ui-panel-end">
                                    <button
                                        type="button"
                                        className="ui-btn ui-btn--default ui-btn--sm"
                                        onClick={openNewRedemptRule}
                                    >
                                        <Plus size={14} /> {t('walkin.add')}
                                    </button>
                                </div>
                            </div>
                            {redemptRules.length === 0 ? (
                                <div className="ui-panel-pad">
                                    <p className="ui-help">{t('walkin.noRedemptRules')}</p>
                                </div>
                            ) : (
                                <div>
                                    {redemptRules.map((rule) => (
                                        <div key={rule.id} className="ui-list-row">
                                            <div className="ui-list-main">
                                                <div className="ui-list-title">{rule.name}</div>
                                                {rule.description ? (
                                                    <div className="ui-help">{rule.description}</div>
                                                ) : null}
                                                <div className="ui-meta">
                                                    <span>
                                                        {t('walkin.ptsThreshold', { threshold: fmt(rule.threshold) })}
                                                        <ArrowRight size={12} aria-hidden />
                                                        {sar(rule.value)}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="ui-list-end">
                                                {statusPill(rule.status)}
                                                {onOffSwitch(
                                                    rule.status === 'active',
                                                    (checked) => toggleRuleStatus(rule, checked ? 'active' : 'paused'),
                                                    rule.name,
                                                )}
                                                <button
                                                    type="button"
                                                    className="ui-btn ui-btn--default ui-btn--sm ui-btn--icon"
                                                    onClick={() => openEditRedemptRule(rule)}
                                                    aria-label={t('btn.edit')}
                                                    title={t('btn.edit')}
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="ui-btn ui-btn--danger ui-btn--sm ui-btn--icon"
                                                    onClick={() => deleteRule(rule.id)}
                                                    aria-label={t('btn.delete')}
                                                    title={t('btn.delete')}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    </div>

                    <section className="ui-panel">
                        <div className="ui-panel-head">
                            <div className="ui-panel-title">{t('walkin.accountsTitle')}</div>
                        </div>
                        <div className="ui-panel-pad">
                            <div className="ui-field">
                                <label htmlFor="tier-acct-search">{t('walkin.searchLabel')}</label>
                                <div className="ui-search">
                                    <Search size={15} />
                                    <input
                                        id="tier-acct-search"
                                        className="ui-input"
                                        value={accountSearch}
                                        onChange={(e) => setAccountSearch(e.target.value)}
                                        placeholder={t('walkin.searchPlaceholder')}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="ui-table-wrap ui-table-wrap--bare">
                            <table className="ui-table">
                                <thead>
                                    <tr>
                                        <th>{t('col.customer')}</th>
                                        <th>{t('col.type')}</th>
                                        <th>{t('col.tier')}</th>
                                        <th className="ui-num">{t('col.availablePts')}</th>
                                        <th className="ui-num">{t('col.totalPts')}</th>
                                        <th className="ui-num">{t('col.monthSpend')}</th>
                                        <th>{t('col.lastVisit')}</th>
                                    </tr>
                                </thead>
                                {accountsLoading ? (
                                    <TableSkeleton cols={7} />
                                ) : (
                                    <tbody>
                                        {loyaltyAccounts.length === 0 ? (
                                            <tr>
                                                <td colSpan="7" className="ui-td-empty">{t('walkin.noAccounts')}</td>
                                            </tr>
                                        ) : loyaltyAccounts.map((acc) => (
                                            <tr key={acc.id}>
                                                <td className="ui-strong">{acc.customer}</td>
                                                <td>{accountTypeLabel(acc.type)}</td>
                                                <td>
                                                    {acc.tier
                                                        ? <span className="ui-tag">{acc.tier}</span>
                                                        : t('common.emDash')}
                                                </td>
                                                <td className="ui-num">{fmt(acc.availablePoints)}</td>
                                                <td className="ui-num">{fmt(acc.totalPoints)}</td>
                                                <td className="ui-num ui-money">{sar(acc.monthSpend)}</td>
                                                <td>{fmtDate(acc.lastVisit)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                )}
                            </table>
                            <UiPager {...accountsPagerFor(accountsTotal)} />
                        </div>
                    </section>
                </div>
            ) : activeTab === 'rules' ? (
                <div className="ui-tabpanel ui-stack" role="tabpanel">
                    <div className="ui-row">
                        <div className="ui-field ui-field--grow">
                            <div className="ui-panel-title">{t('rules.title')}</div>
                            <p className="ui-help">{t('rules.desc')}</p>
                        </div>
                        <div className="ui-toolbar-end">
                            <button
                                type="button"
                                className="ui-btn ui-btn--default"
                                onClick={runMonthlyReset}
                                disabled={busy}
                            >
                                <TrendingUp size={15} /> {t('rules.runMonthlyReset')}
                            </button>
                            <button type="button" className="ui-btn ui-btn--primary" onClick={openNewRule}>
                                <Plus size={15} /> {t('rules.addRule')}
                            </button>
                        </div>
                    </div>

                    {rules.length === 0 ? (
                        <div className="ui-empty">
                            <div className="ui-empty-icon"><Settings size={18} /></div>
                            <div className="ui-empty-title">{t('rules.empty')}</div>
                            <button type="button" className="ui-btn ui-btn--primary" onClick={openNewRule}>
                                <Plus size={14} /> {t('rules.addRule')}
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="ui-panels">
                                {rulesPaging.pagedRows.map((rule, idx) => {
                                    const cond = rule.condition || {};
                                    const act = rule.action || {};
                                    const TypeIcon = RULE_TYPE_ICON[rule.type] || Settings;
                                    return (
                                        <section key={rule.id} className="ui-panel">
                                            <div className="ui-panel-head">
                                                <span className="ui-avatar" aria-hidden>
                                                    <TypeIcon size={14} />
                                                </span>
                                                <div>
                                                    <div className="ui-panel-title">{rule.name}</div>
                                                    <div className="ui-help">
                                                        #{rulesPaging.rowOffset + idx + 1}
                                                    </div>
                                                </div>
                                                <span
                                                    className={`ui-pill ui-panel-end ui-pill--${RULE_TYPE_TONE[rule.type] || 'neutral'}`}
                                                >
                                                    {typeLabel(rule.type)}
                                                </span>
                                                {statusPill(rule.status)}
                                            </div>

                                            <div className="ui-panel-pad ui-stack-sm">
                                                <dl className="ui-kv">
                                                    <div>
                                                        <dt>{t('rules.if')}</dt>
                                                        <dd>
                                                            {fieldLabel(cond.field)} {cond.operator || ''}{' '}
                                                            {cond.operator === 'between'
                                                                ? `${fmt(cond.value)} ${String.fromCharCode(8212)} ${fmt(cond.maxValue)}`
                                                                : fmt(cond.value)}
                                                        </dd>
                                                    </div>
                                                    <div>
                                                        <dt>{t('rules.then')}</dt>
                                                        <dd>
                                                            {actionLabel(act.type)} ={' '}
                                                            {act.tierId ? tierNameById(act.tierId) : fmt(act.value)}
                                                        </dd>
                                                    </div>
                                                </dl>

                                                {/* The flattened helpers the server sends with every rule.
                                                    These read `action.value` / `action.pointsCost` directly
                                                    and printed "undefined" for any rule stored without
                                                    them. */}
                                                {rule.type === 'earn' ? (
                                                    <div className="ui-tags">
                                                        <span className="ui-pill ui-pill--ok">
                                                            {t('rules.ptPerSar', { value: fmt(rule.rate) })}
                                                        </span>
                                                    </div>
                                                ) : null}
                                                {rule.type === 'redeem' ? (
                                                    <div className="ui-tags">
                                                        <span className="ui-pill ui-pill--warn">
                                                            {t('rules.ptsToSar', {
                                                                points: fmt(rule.threshold),
                                                                value: fmt(rule.value),
                                                            })}
                                                        </span>
                                                    </div>
                                                ) : null}

                                                {rule.description ? (
                                                    <p className="ui-help">{rule.description}</p>
                                                ) : null}
                                            </div>

                                            <div className="ui-panel-foot">
                                                <button
                                                    type="button"
                                                    className="ui-btn ui-btn--default ui-btn--sm"
                                                    onClick={() => openEditRule(rule)}
                                                >
                                                    <Pencil size={14} /> {t('btn.edit')}
                                                </button>
                                                <div className="ui-panel-end ui-rowacts">
                                                    {onOffSwitch(
                                                        rule.status === 'active',
                                                        (checked) => toggleRuleStatus(rule, checked ? 'active' : 'paused'),
                                                        rule.name,
                                                    )}
                                                    <button
                                                        type="button"
                                                        className="ui-btn ui-btn--danger ui-btn--sm"
                                                        onClick={() => deleteRule(rule.id)}
                                                    >
                                                        <Trash2 size={14} /> {t('btn.delete')}
                                                    </button>
                                                </div>
                                            </div>
                                        </section>
                                    );
                                })}
                            </div>
                            <UiPager {...rulesPaging.pagerProps} />
                        </>
                    )}
                </div>
            ) : activeTab === 'reports' ? (
                <div className="ui-tabpanel ui-stack" role="tabpanel">
                    <div className="ui-kpis">
                        {reportStats.map((stat) => (
                            <Metric
                                key={stat.label}
                                label={stat.label}
                                value={stat.value}
                                icon={stat.icon}
                                tone={stat.tone}
                            />
                        ))}
                    </div>

                    <div className="ui-panels">
                        <ChartCard title={t('reports.customersByTier')}>
                            {tierDist.every((d) => !d.value) ? (
                                <div className="ui-empty">
                                    <div className="ui-empty-icon"><Users size={18} /></div>
                                    <div className="ui-empty-title">{t('reports.noTierAssignments')}</div>
                                </div>
                            ) : (
                                <div className="ui-chart">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={tierDist}
                                                dataKey="value"
                                                nameKey="name"
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={52}
                                                outerRadius={78}
                                                paddingAngle={4}
                                            >
                                                {tierDist.map((entry, index) => (
                                                    <Cell
                                                        key={entry.name || index}
                                                        fill={entry.color || FALLBACK_SLICE}
                                                    />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(v) => fmt(v)} />
                                            <Legend wrapperStyle={{ fontSize: 11 }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </ChartCard>

                        <ChartCard title={t('reports.pointsSummary')}>
                            <div className="ui-chart">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={trendData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                                        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                                        {/* The axis was hidden, so a month of 40 points and a month
                                            of 40,000 drew the same hill. */}
                                        <YAxis tick={{ fontSize: 10 }} />
                                        <Tooltip formatter={(v) => fmt(v)} />
                                        <Legend wrapperStyle={{ fontSize: 11 }} />
                                        <Area
                                            type="monotone"
                                            dataKey="earned"
                                            name={t('reports.earned')}
                                            stroke={CHART.ok}
                                            fill={`${CHART.ok}22`}
                                            strokeWidth={2}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="redeemed"
                                            name={t('reports.redeemed')}
                                            stroke={CHART.dang}
                                            fill={`${CHART.dang}22`}
                                            strokeWidth={2}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                            <dl className="ui-kv">
                                <div>
                                    <dt>{t('reports.earned')}</dt>
                                    <dd>{fmt(trendTotals.earned)}</dd>
                                </div>
                                <div>
                                    <dt>{t('reports.redeemed')}</dt>
                                    <dd>{fmt(trendTotals.redeemed)}</dd>
                                </div>
                                <div>
                                    <dt>{t('reports.outstanding')}</dt>
                                    <dd>{fmt(trendTotals.outstanding)}</dd>
                                </div>
                            </dl>
                        </ChartCard>
                    </div>

                    <section className="ui-panel">
                        <div className="ui-panel-head">
                            <div className="ui-panel-title">{t('reports.topAccounts')}</div>
                        </div>
                        <div className="ui-table-wrap ui-table-wrap--bare">
                            <table className="ui-table">
                                <thead>
                                    <tr>
                                        <th>{t('col.customer')}</th>
                                        <th>{t('col.type')}</th>
                                        <th>{t('col.tier')}</th>
                                        <th className="ui-num">{t('col.availablePts')}</th>
                                        <th className="ui-num">{t('col.monthSpend')}</th>
                                        <th className="ui-num">{t('col.lifetime')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {topAccounts.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="ui-td-empty">{t('walkin.noAccounts')}</td>
                                        </tr>
                                    ) : topAccountsPaging.pagedRows.map((account) => (
                                        <tr key={account.id}>
                                            <td className="ui-strong">{account.customer}</td>
                                            <td>{accountTypeLabel(account.type)}</td>
                                            <td>
                                                {account.tier
                                                    ? <span className="ui-tag">{account.tier}</span>
                                                    : t('common.emDash')}
                                            </td>
                                            <td className="ui-num">{fmt(account.pts)}</td>
                                            <td className="ui-num ui-money">{sar(account.monthSpend)}</td>
                                            <td className="ui-num ui-money">{sar(account.lifetime)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <UiPager {...topAccountsPaging.pagerProps} />
                        </div>
                    </section>
                </div>
            ) : null}
        </div>
    );
}
