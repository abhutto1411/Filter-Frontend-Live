import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Award, Pencil, TrendingUp, ShieldCheck, Zap, X,
    Plus, ChevronDown, ChevronUp, Trash2, CheckCircle2,
    Layout, Settings, BarChart3, Users, ArrowUp, ArrowDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
    CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend
} from 'recharts';
import Modal from '../../components/Modal';
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
import '../../styles/admin/TierManagementPage.css';

const fmt = (n) => Number(n || 0).toLocaleString();
const sar = (n) => `SAR ${fmt(n)}`;
const fmtDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
};

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

export default function TierManagementPage() {
    const [activeTab, setActiveTab] = useState('corporate');

    // Live data
    const [tiers, setTiers] = useState([]);
    const [rules, setRules] = useState([]);
    const [loyaltyAccounts, setLoyaltyAccounts] = useState([]);
    const [reports, setReports] = useState(null);

    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState(null);
    const [accountSearch, setAccountSearch] = useState('');

    // Modals
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingTier, setEditingTier] = useState(null);
    const [expandedTiers, setExpandedTiers] = useState({});
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

    /* ---------------- Data loading ---------------- */
    const loadTiers = useCallback(async () => {
        const res = await marketingListLoyaltyTiers();
        setTiers(res?.tiers || res?.data || []);
    }, []);

    const loadRules = useCallback(async () => {
        const res = await marketingListLoyaltyRules();
        setRules(res?.rules || res?.data || []);
    }, []);

    const loadAccounts = useCallback(async (search = '') => {
        const res = await marketingListLoyaltyAccounts({ search, limit: 200 });
        setLoyaltyAccounts(res?.accounts || res?.data || []);
    }, []);

    const loadReports = useCallback(async () => {
        const res = await marketingGetLoyaltyReports();
        setReports(res || null);
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                await Promise.all([loadTiers(), loadRules(), loadAccounts(), loadReports()]);
            } catch (err) {
                if (!cancelled) flash('error', err?.message || 'Failed to load tier data');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [loadTiers, loadRules, loadAccounts, loadReports, flash]);

    /* ---------------- Tier helpers ---------------- */
    const toggleExpand = (id) => setExpandedTiers((p) => ({ ...p, [id]: !p[id] }));

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
        if (!payload.name.trim()) { flash('error', 'Tier name is required'); return; }
        setBusy(true);
        try {
            if (editingTier) {
                await marketingUpdateLoyaltyTier(editingTier.id, payload);
            } else {
                await marketingCreateLoyaltyTier(payload);
            }
            await Promise.all([loadTiers(), loadReports()]);
            setEditModalOpen(false);
            flash('success', editingTier ? 'Tier updated' : 'Tier created');
        } catch (err) {
            flash('error', err?.message || 'Failed to save tier');
        } finally {
            setBusy(false);
        }
    };

    const handleDeleteTier = async (tier) => {
        if (!window.confirm(`Delete tier "${tier.name}"?`)) return;
        setBusy(true);
        try {
            await marketingDeleteLoyaltyTier(tier.id);
            await Promise.all([loadTiers(), loadReports()]);
            flash('success', 'Tier deleted');
        } catch (err) {
            flash('error', err?.message || 'Failed to delete tier');
        } finally {
            setBusy(false);
        }
    };

    const handleToggleTier = async (tier, active) => {
        setTiers((prev) => prev.map((t) => (t.id === tier.id ? { ...t, status: active ? 'active' : 'inactive' } : t)));
        try {
            await marketingUpdateLoyaltyTier(tier.id, { status: active ? 'active' : 'inactive' });
        } catch (err) {
            flash('error', err?.message || 'Failed to update tier');
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
            await marketingReorderLoyaltyTiers(next.map((t) => t.id));
        } catch (err) {
            flash('error', err?.message || 'Failed to reorder');
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
        if (!payload.name.trim()) { flash('error', 'Rule name is required'); return; }
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
            flash('success', editingRule ? 'Rule updated' : 'Rule created');
        } catch (err) {
            flash('error', err?.message || 'Failed to save rule');
        } finally {
            setBusy(false);
        }
    };

    const toggleRuleStatus = async (rule, status) => {
        setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, status } : r)));
        try {
            await marketingUpdateLoyaltyRule(rule.id, { status });
        } catch (err) {
            flash('error', err?.message || 'Failed to update rule');
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
        if (!payload.name.trim()) { flash('error', 'Rule name is required'); return; }
        setBusy(true);
        try {
            if (editingRule) {
                await marketingUpdateLoyaltyRule(editingRule.id, payload);
            } else {
                await marketingCreateLoyaltyRule(payload);
            }
            await Promise.all([loadRules(), loadReports()]);
            setRuleModalOpen(false);
            flash('success', editingRule ? 'Rule updated' : 'Rule created');
        } catch (err) {
            flash('error', err?.message || 'Failed to save rule');
        } finally {
            setBusy(false);
        }
    };

    const deleteRule = async (id) => {
        if (!window.confirm('Delete this rule?')) return;
        setBusy(true);
        try {
            await marketingDeleteLoyaltyRule(id);
            await Promise.all([loadRules(), loadReports()]);
            flash('success', 'Rule deleted');
        } catch (err) {
            flash('error', err?.message || 'Failed to delete rule');
        } finally {
            setBusy(false);
        }
    };

    const runMonthlyReset = async () => {
        if (!window.confirm('Reset all customers\u2019 monthly spend to zero and re-evaluate tiers?')) return;
        setBusy(true);
        try {
            const res = await marketingRunLoyaltyMonthlyReset();
            await Promise.all([loadAccounts(accountSearch), loadReports()]);
            flash('success', `Monthly reset complete (${res?.accountsReset ?? 0} accounts)`);
        } catch (err) {
            flash('error', err?.message || 'Monthly reset failed');
        } finally {
            setBusy(false);
        }
    };

    const onAccountSearch = (e) => {
        const v = e.target.value;
        setAccountSearch(v);
        window.clearTimeout(onAccountSearch._t);
        onAccountSearch._t = window.setTimeout(() => loadAccounts(v).catch(() => {}), 350);
    };

    /* ---------------- Derived report stats ---------------- */
    const stats = reports?.stats || {};
    const walkinStats = [
        { label: 'Total Points Issued', value: fmt(stats.totalPointsIssued), icon: Award, color: '#fbbf24' },
        { label: 'Available Points', value: fmt(stats.availablePoints), icon: Zap, color: '#10b981' },
        { label: 'Points Redeemed', value: fmt(stats.pointsRedeemed), icon: TrendingUp, color: '#6366f1' },
        { label: 'Loyalty Liability', value: sar(stats.loyaltyLiability), icon: Users, color: '#f43f5e' },
    ];
    const reportStats = [
        { label: 'Corporate Customers', value: fmt(stats.corporateCustomers), icon: ShieldCheck, color: '#0ea5e9' },
        { label: 'Walk-In Loyalty Accts', value: fmt(stats.walkInLoyaltyAccounts), icon: Users, color: '#10b981' },
        { label: 'Total Points Issued', value: fmt(stats.totalPointsIssued), icon: Award, color: '#fbbf24' },
        { label: 'Loyalty Liability', value: sar(stats.loyaltyLiability), icon: Settings, color: '#f43f5e' },
    ];
    const tierDist = reports?.tierDistribution || [];
    const trendData = reports?.pointsTrend || [];
    const trendTotals = reports?.pointsTrendTotals || { earned: 0, redeemed: 0, outstanding: 0 };
    const topAccounts = reports?.topAccounts || [];

    const TABS = [
        { id: 'corporate', label: 'Corporate Tiers', icon: ShieldCheck },
        { id: 'walkin', label: 'Walk-In Loyalty', icon: Users },
        { id: 'rules', label: 'Rules Engine', icon: Settings },
        { id: 'reports', label: 'Reports', icon: BarChart3 },
    ];

    const tierNameById = (id) => tiers.find((t) => String(t.id) === String(id))?.name || id || '—';

    return (
        <div className="tier-management-page module-container">
            <header className="tier-main-header">
                <div className="header-icon"><Award size={32} /></div>
                <div className="header-info">
                    <h1 className="header-title">Tier Management</h1>
                    <p className="header-subtitle">Corporate tiers, loyalty engine, rules configuration and reports</p>
                </div>
            </header>

            {notice && (
                <div className={`tier-notice ${notice.type}`} style={{
                    margin: '0 0 14px', padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                    background: notice.type === 'error' ? '#fef2f2' : '#ecfdf5',
                    color: notice.type === 'error' ? '#b91c1c' : '#047857',
                    border: `1px solid ${notice.type === 'error' ? '#fecaca' : '#a7f3d0'}`,
                }}>
                    {notice.msg}
                </div>
            )}

            <nav className="tier-tabs-nav">
                {TABS.map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            className={`tier-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            <Icon size={18} />
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </nav>

            <div className="tier-content-section">
                {loading ? (
                    <div className="empty-state" style={{ padding: 48, textAlign: 'center' }}>Loading tier data…</div>
                ) : activeTab === 'corporate' ? (
                    <>
                        <div className="section-header">
                            <div className="header-left">
                                <h2 className="section-title">Corporate Tier Configuration</h2>
                                <p className="section-desc">Define tiers, thresholds, discounts and benefits. Auto-upgrades on monthly spend.</p>
                            </div>
                            <button className="btn-new-tier" onClick={openNewTier}>
                                <Plus size={20} /><span>New Tier</span>
                            </button>
                        </div>

                        <div className="tier-list-container">
                            {tiers.length === 0 ? (
                                <div className="empty-state" style={{ padding: 32, textAlign: 'center' }}>
                                    No tiers configured yet. Click “New Tier” to create your first one.
                                </div>
                            ) : tiers.map((tier, index) => (
                                <motion.div
                                    key={tier.id}
                                    className={`tier-list-card ${expandedTiers[tier.id] ? 'expanded' : ''}`}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                >
                                    <div className="card-accent-strip" style={{ background: tier.color }}></div>
                                    <div className="card-main-content">
                                        <div className="card-header">
                                            <div className="tier-icon-box" style={{ background: `${tier.color}15`, color: tier.color }}>
                                                {tier.icon}
                                            </div>
                                            <div className="tier-basic-info">
                                                <div className="name-row">
                                                    <h3 className="tier-name">{tier.name}</h3>
                                                    <span className={`status-badge ${tier.status === 'active' ? 'active' : ''}`}>{tier.status}</span>
                                                    {tier.discount > 0 && <span className="discount-badge">{tier.discount}% off</span>}
                                                    {tier.priority && <span className="priority-badge">Priority</span>}
                                                </div>
                                                <p className="tier-range">{sar(tier.minSales)} – {sar(tier.maxSales)} / month</p>
                                            </div>
                                            <div className="card-actions">
                                                <div className="move-actions">
                                                    <button className="action-btn move-btn" onClick={(e) => { e.stopPropagation(); moveTier(index, -1); }} disabled={index === 0} title="Move Up">
                                                        <ArrowUp size={16} />
                                                    </button>
                                                    <button className="action-btn move-btn" onClick={(e) => { e.stopPropagation(); moveTier(index, 1); }} disabled={index === tiers.length - 1} title="Move Down">
                                                        <ArrowDown size={16} />
                                                    </button>
                                                </div>
                                                <button className="action-btn edit-btn" onClick={(e) => { e.stopPropagation(); openEdit(tier); }}>
                                                    <Pencil size={18} />
                                                </button>
                                                <label className="toggle-switch small" onClick={(e) => e.stopPropagation()}>
                                                    <input type="checkbox" checked={tier.status === 'active'} onChange={(e) => handleToggleTier(tier, e.target.checked)} />
                                                    <span className="tier-toggle-handle"></span>
                                                </label>
                                                <button className="action-btn delete-btn" onClick={(e) => { e.stopPropagation(); handleDeleteTier(tier); }}>
                                                    <Trash2 size={18} />
                                                </button>
                                                <button className="action-btn collapse-toggle" onClick={(e) => { e.stopPropagation(); toggleExpand(tier.id); }}>
                                                    {expandedTiers[tier.id] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                                </button>
                                            </div>
                                        </div>

                                        <AnimatePresence>
                                            {expandedTiers[tier.id] && (
                                                <motion.div className="card-expanded-details" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                                                    <div className="benefits-grid">
                                                        {(tier.benefits || []).length === 0 ? (
                                                            <span className="tier-range">No benefits configured</span>
                                                        ) : tier.benefits.map((benefit, idx) => (
                                                            <div key={idx} className="benefit-chip">
                                                                <CheckCircle2 size={14} className="check-icon" />
                                                                <span>{benefit}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </>
                ) : activeTab === 'walkin' ? (
                    <div className="loyalty-dashboard">
                        <div className="loyalty-stats-grid">
                            {walkinStats.map((stat, i) => {
                                const Icon = stat.icon;
                                return (
                                    <div key={i} className="loyalty-stat-card">
                                        <div className="stat-icon" style={{ background: `${stat.color}10`, color: stat.color }}><Icon size={20} /></div>
                                        <div className="stat-content">
                                            <p className="stat-label">{stat.label}</p>
                                            <h3 className="stat-value">{stat.value}</h3>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="loyalty-rules-grid">
                            <div className="rules-column">
                                <div className="column-header">
                                    <h3 className="column-title">Points Earn Rules</h3>
                                    <button className="column-add-btn" onClick={openNewEarnRule}><Plus size={16} /> <span>Add</span></button>
                                </div>
                                <div className="rules-stack">
                                    {earnRules.length === 0 ? (
                                        <div className="empty-state" style={{ padding: 16 }}>No earn rules yet</div>
                                    ) : earnRules.map((rule) => (
                                        <div key={rule.id} className="rule-card-modern">
                                            <div className="rule-info">
                                                <div className="rule-name-row">
                                                    <h4 className="rule-name">{rule.name}</h4>
                                                    <span className="rule-status">{rule.status}</span>
                                                </div>
                                                <p className="rule-description">{rule.description}</p>
                                                <div className="rule-detail-tag">{rule.rate} pt / SAR</div>
                                            </div>
                                            <div className="rule-actions">
                                                <label className="toggle-switch small" onClick={(e) => e.stopPropagation()}>
                                                    <input type="checkbox" checked={rule.status === 'active'} onChange={(e) => toggleRuleStatus(rule, e.target.checked ? 'active' : 'paused')} />
                                                    <span className="tier-toggle-handle"></span>
                                                </label>
                                                <button className="rule-icon-btn" onClick={() => openEditEarnRule(rule)}><Pencil size={16} /></button>
                                                <button className="rule-icon-btn delete" onClick={() => deleteRule(rule.id)}><Trash2 size={16} /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="rules-column">
                                <div className="column-header">
                                    <h3 className="column-title">Points Redemption Rules</h3>
                                    <button className="column-add-btn" onClick={openNewRedemptRule}><Plus size={16} /> <span>Add</span></button>
                                </div>
                                <div className="rules-stack">
                                    {redemptRules.length === 0 ? (
                                        <div className="empty-state" style={{ padding: 16 }}>No redemption rules yet</div>
                                    ) : redemptRules.map((rule) => (
                                        <div key={rule.id} className="rule-card-modern">
                                            <div className="rule-info">
                                                <div className="rule-name-row">
                                                    <h4 className="rule-name">{rule.name}</h4>
                                                    <span className="rule-status">{rule.status}</span>
                                                </div>
                                                <p className="rule-description">{rule.description}</p>
                                                <div className="rule-detail-row">
                                                    <span className="value-tag gold">{rule.threshold} pts threshold</span>
                                                    <span className="arrow-sep">➔</span>
                                                    <span className="value-tag green">{sar(rule.value)}</span>
                                                </div>
                                            </div>
                                            <div className="rule-actions">
                                                <label className="toggle-switch small" onClick={(e) => e.stopPropagation()}>
                                                    <input type="checkbox" checked={rule.status === 'active'} onChange={(e) => toggleRuleStatus(rule, e.target.checked ? 'active' : 'paused')} />
                                                    <span className="tier-toggle-handle"></span>
                                                </label>
                                                <button className="rule-icon-btn" onClick={() => openEditRedemptRule(rule)}><Pencil size={16} /></button>
                                                <button className="rule-icon-btn delete" onClick={() => deleteRule(rule.id)}><Trash2 size={16} /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="loyalty-accounts-section">
                            <div className="accounts-header">
                                <h3 className="section-title">Customer Loyalty Accounts</h3>
                                <div className="table-search">
                                    <Layout size={16} />
                                    <input type="text" placeholder="Search by name or mobile..." value={accountSearch} onChange={onAccountSearch} />
                                </div>
                            </div>
                            <div className="loyalty-table-wrapper">
                                <table className="modern-tier-table">
                                    <thead>
                                        <tr>
                                            <th>Customer</th><th>Type</th><th>Tier</th><th>Available Pts</th><th>Total Pts</th><th>Month Spend</th><th>Last Visit</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loyaltyAccounts.length === 0 ? (
                                            <tr><td colSpan="7" className="empty-state">No loyalty accounts yet</td></tr>
                                        ) : loyaltyAccounts.map((acc) => (
                                            <tr key={acc.id}>
                                                <td className="font-semibold">{acc.customer}</td>
                                                <td>{acc.type}</td>
                                                <td>{acc.tier ? <span className={`tier-badge-small ${String(acc.tier).toLowerCase()}`}>{acc.tier}</span> : '—'}</td>
                                                <td className="pts-column">{fmt(acc.availablePoints)}</td>
                                                <td>{fmt(acc.totalPoints)}</td>
                                                <td>{sar(acc.monthSpend)}</td>
                                                <td className="text-slate-400">{fmtDate(acc.lastVisit)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ) : activeTab === 'rules' ? (
                    <div className="rules-engine-dashboard">
                        <div className="section-header">
                            <div className="header-left">
                                <h2 className="section-title">Rules Engine Builder</h2>
                                <p className="section-desc">Visual IF/THEN rule definitions that drive all tier and loyalty logic</p>
                            </div>
                            <div className="tab-actions">
                                <button className="btn-modern-outline" onClick={runMonthlyReset} disabled={busy}>
                                    <TrendingUp size={18} /><span>Run Monthly Reset</span>
                                </button>
                                <button className="btn-new-tier" onClick={openNewRule}>
                                    <Plus size={20} /><span>Add Rule</span>
                                </button>
                            </div>
                        </div>

                        <div className="rules-stack-modern">
                            {rules.length === 0 ? (
                                <div className="empty-state" style={{ padding: 32, textAlign: 'center' }}>No rules defined yet</div>
                            ) : rules.map((rule, idx) => {
                                const cond = rule.condition || {};
                                const act = rule.action || {};
                                return (
                                    <motion.div key={rule.id} className="rule-builder-card" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }}>
                                        <div className="rule-card-header">
                                            <div className="rule-meta">
                                                <span className="rule-id">#{idx + 1}</span>
                                                <div className={`rule-type-badge ${rule.type}`}>
                                                    {rule.type === 'tier_assign' && <ShieldCheck size={12} />}
                                                    {rule.type === 'earn' && <Zap size={12} />}
                                                    {rule.type === 'redeem' && <Award size={12} />}
                                                    <span>{String(rule.type || '').replace('_', ' ')}</span>
                                                </div>
                                                <h3 className="rule-display-name">{rule.name}</h3>
                                                <span className={`status-pill ${rule.status}`}>{rule.status}</span>
                                            </div>
                                            <div className="rule-actions-top">
                                                <label className="toggle-v3 small" onClick={(e) => e.stopPropagation()}>
                                                    <input type="checkbox" checked={rule.status === 'active'} onChange={(e) => toggleRuleStatus(rule, e.target.checked ? 'active' : 'paused')} />
                                                    <span className="toggle-v3-track"></span>
                                                </label>
                                                <button className="icon-btn-ghost" onClick={() => openEditRule(rule)}><Pencil size={16} /></button>
                                                <button className="icon-btn-ghost delete" onClick={() => deleteRule(rule.id)}><Trash2 size={16} /></button>
                                            </div>
                                        </div>

                                        <div className="rule-logic-display">
                                            <div className="logic-part if">
                                                <span className="logic-label">IF</span>
                                                <div className="logic-box">
                                                    <span className="field">{String(cond.field || 'n/a').replace('_', ' ')}</span>
                                                    <span className="operator">{cond.operator || ''}</span>
                                                    <span className="value">
                                                        {cond.operator === 'between'
                                                            ? `${fmt(cond.value)} — ${fmt(cond.maxValue)}`
                                                            : fmt(cond.value)}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="logic-arrow"><ArrowUp size={20} style={{ transform: 'rotate(90deg)' }} /></div>
                                            <div className="logic-part then">
                                                <span className="logic-label">THEN</span>
                                                <div className="logic-box">
                                                    <span className="action-type">{String(act.type || 'n/a').replace('_', ' ')}</span>
                                                    <span className="operator">=</span>
                                                    <span className="result">
                                                        {act.tierId ? (<span className="tier-tag">{tierNameById(act.tierId)}</span>) : fmt(act.value)}
                                                    </span>
                                                </div>
                                            </div>
                                            {rule.type === 'earn' && (<div className="rule-value-pill reward">{act.value} pt per SAR</div>)}
                                            {rule.type === 'redeem' && (<div className="rule-value-pill cost">{act.pointsCost} pts → SAR {act.value}</div>)}
                                        </div>

                                        <p className="rule-card-desc">{rule.description}</p>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                ) : activeTab === 'reports' ? (
                    <div className="reports-dashboard">
                        <div className="loyalty-stats-grid">
                            {reportStats.map((stat, i) => {
                                const Icon = stat.icon;
                                return (
                                    <div key={i} className="loyalty-stat-card">
                                        <div className="stat-icon" style={{ background: `${stat.color}10`, color: stat.color }}><Icon size={20} /></div>
                                        <div className="stat-content">
                                            <p className="stat-label">{stat.label}</p>
                                            <h3 className="stat-value">{stat.value}</h3>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="reports-charts-grid">
                            <div className="report-chart-card">
                                <div className="chart-header"><h3 className="chart-title">Customers by Tier</h3></div>
                                <div className="chart-body" style={{ height: 260 }}>
                                    {tierDist.every((d) => !d.value) ? (
                                        <div className="empty-state" style={{ padding: 32, textAlign: 'center' }}>No tier assignments yet</div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={tierDist} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                                    {tierDist.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                                                </Pie>
                                                <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} itemStyle={{ color: '#fff' }} />
                                                <Legend verticalAlign="bottom" height={36} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </div>

                            <div className="report-chart-card">
                                <div className="chart-header"><h3 className="chart-title">Loyalty Points Summary</h3></div>
                                <div className="chart-body" style={{ height: 180 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={trendData}>
                                            <defs>
                                                <linearGradient id="colorEarned" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="colorRedeemed" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                                            <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                            <YAxis hide />
                                            <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} itemStyle={{ color: '#fff' }} />
                                            <Area type="monotone" dataKey="earned" stroke="#10b981" fillOpacity={1} fill="url(#colorEarned)" />
                                            <Area type="monotone" dataKey="redeemed" stroke="#f43f5e" fillOpacity={1} fill="url(#colorRedeemed)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="chart-footer-metrics">
                                    <div className="footer-metric">
                                        <span className="metric-dot green"></span>
                                        <div className="metric-info"><p className="m-label">Earned</p><p className="m-value">{fmt(trendTotals.earned)}</p></div>
                                    </div>
                                    <div className="footer-metric">
                                        <span className="metric-dot red"></span>
                                        <div className="metric-info"><p className="m-label">Redeemed</p><p className="m-value">{fmt(trendTotals.redeemed)}</p></div>
                                    </div>
                                    <div className="footer-metric">
                                        <span className="metric-dot gold"></span>
                                        <div className="metric-info"><p className="m-label">Outstanding</p><p className="m-value">{fmt(trendTotals.outstanding)}</p></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="loyalty-accounts-section no-margin">
                            <div className="accounts-header"><h3 className="section-title">Top Loyalty Accounts</h3></div>
                            <div className="loyalty-table-wrapper">
                                <table className="modern-tier-table">
                                    <thead>
                                        <tr><th>Customer</th><th>Type</th><th>Tier</th><th>Available Pts</th><th>Month Spend</th><th>Lifetime</th></tr>
                                    </thead>
                                    <tbody>
                                        {topAccounts.length === 0 ? (
                                            <tr><td colSpan="6" className="empty-state">No loyalty accounts yet</td></tr>
                                        ) : topAccounts.map((account) => (
                                            <tr key={account.id}>
                                                <td className="font-semibold">{account.customer}</td>
                                                <td>{account.type}</td>
                                                <td>{account.tier ? <span className={`tier-badge-small ${String(account.tier).toLowerCase()}`}>{account.tier}</span> : '—'}</td>
                                                <td className="pts-column">{fmt(account.pts)}</td>
                                                <td>{sar(account.monthSpend)}</td>
                                                <td className="text-slate-400">{sar(account.lifetime)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>

            {/* Tier Modal */}
            <AnimatePresence>
                {editModalOpen && (
                    <Modal title={editingTier ? 'Edit Tier Details' : 'Create New Tier'} onClose={() => setEditModalOpen(false)} className="tier-form-modal">
                        <div className="modern-form-container">
                            <div className="form-section">
                                <h4 className="form-section-title">General Information</h4>
                                <div className="form-row">
                                    <div className="form-group flex-2">
                                        <label>Tier Name</label>
                                        <input type="text" placeholder="e.g. Gold" value={formState.name} onChange={(e) => setFormState({ ...formState, name: e.target.value })} />
                                    </div>
                                    <div className="form-group flex-1">
                                        <label>Icon</label>
                                        <input type="text" value={formState.icon} onChange={(e) => setFormState({ ...formState, icon: e.target.value })} />
                                    </div>
                                    <div className="form-group flex-1">
                                        <label>Accent Color</label>
                                        <div className="color-picker-simple">
                                            <input type="color" value={formState.color} onChange={(e) => setFormState({ ...formState, color: e.target.value })} />
                                            <div className="color-indicator" style={{ background: formState.color }}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="form-section">
                                <h4 className="form-section-title">Revenue & Rewards</h4>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Min Sales (SAR)</label>
                                        <input type="number" value={formState.minSales} onChange={(e) => setFormState({ ...formState, minSales: Number(e.target.value) })} />
                                    </div>
                                    <div className="form-group">
                                        <label>Max Sales (SAR)</label>
                                        <input type="number" value={formState.maxSales} onChange={(e) => setFormState({ ...formState, maxSales: Number(e.target.value) })} />
                                    </div>
                                    <div className="form-group">
                                        <label>Discount %</label>
                                        <input type="number" value={formState.discount} onChange={(e) => setFormState({ ...formState, discount: Number(e.target.value) })} />
                                    </div>
                                </div>
                            </div>

                            <div className="form-section">
                                <h4 className="form-section-title">Features & Visibility</h4>
                                <div className="modern-toggles-grid">
                                    <div className="modern-toggle-item small">
                                        <label className="toggle-v3 small" onClick={(e) => e.stopPropagation()}>
                                            <input type="checkbox" checked={formState.priority} onChange={(e) => setFormState({ ...formState, priority: e.target.checked })} />
                                            <span className="toggle-v3-track"></span>
                                        </label>
                                        <div className="toggle-label">
                                            <p className="main-label">Priority Support</p>
                                            <p className="sub-label">Skip the queue for service tasks</p>
                                        </div>
                                    </div>
                                    <div className="modern-toggle-item small">
                                        <label className="toggle-v3 small" onClick={(e) => e.stopPropagation()}>
                                            <input type="checkbox" checked={formState.eligiblePromotions !== false} onChange={(e) => setFormState({ ...formState, eligiblePromotions: e.target.checked })} />
                                            <span className="toggle-v3-track"></span>
                                        </label>
                                        <div className="toggle-label">
                                            <p className="main-label">Eligible for Promotions</p>
                                            <p className="sub-label">Allow marketing promotions to stack</p>
                                        </div>
                                    </div>
                                    <div className="modern-toggle-item small">
                                        <label className="toggle-v3 small" onClick={(e) => e.stopPropagation()}>
                                            <input type="checkbox" checked={formState.status === 'active'} onChange={(e) => setFormState({ ...formState, status: e.target.checked ? 'active' : 'inactive' })} />
                                            <span className="toggle-v3-track"></span>
                                        </label>
                                        <div className="toggle-label">
                                            <p className="main-label">Tier Active</p>
                                            <p className="sub-label">Enable tier for accounts</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="form-section no-border">
                                <h4 className="form-section-title">Tier Benefits</h4>
                                <div className="benefit-input-modern">
                                    <input type="text" placeholder="Enter a benefit and press enter..." value={newBenefit} onChange={(e) => setNewBenefit(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && addBenefit()} />
                                    <button onClick={addBenefit}>Add</button>
                                </div>
                                <div className="modern-benefits-list">
                                    {formState.benefits.map((benefit, i) => (
                                        <div key={i} className="modern-benefit-tag">
                                            <span>{benefit}</span>
                                            <button onClick={() => removeBenefit(i)}><X size={12} /></button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="modal-footer-modern">
                                <button className="btn-modern-cancel" onClick={() => setEditModalOpen(false)}>Cancel</button>
                                <button className="btn-new-tier" onClick={handleSaveTier} disabled={busy}>
                                    {editingTier ? 'Update Tier' : 'Create Tier'}
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>

            {/* Earn Rule Modal */}
            <AnimatePresence>
                {earnModalOpen && (
                    <Modal onClose={() => setEarnModalOpen(false)} title={editingRule ? 'Edit Earn Rule' : 'New Earn Rule'} className="tier-form-modal">
                        <div className="modern-form-container">
                            <div className="form-section no-border">
                                <div className="form-group">
                                    <label>Rule Name</label>
                                    <input type="text" value={formState.name} onChange={(e) => setFormState({ ...formState, name: e.target.value })} placeholder="e.g. Standard Earn Rate" />
                                </div>
                                <div className="form-group">
                                    <label>Description</label>
                                    <input type="text" style={{ height: '80px' }} value={formState.description} onChange={(e) => setFormState({ ...formState, description: e.target.value })} placeholder="Describe how customers earn points..." />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Points per SAR spent</label>
                                        <input type="number" value={formState.rate} onChange={(e) => setFormState({ ...formState, rate: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label>Priority</label>
                                        <input type="number" value={formState.priority} onChange={(e) => setFormState({ ...formState, priority: e.target.value })} />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer-modern">
                                <button className="btn-modern-cancel" onClick={() => setEarnModalOpen(false)}>Cancel</button>
                                <button className="btn-new-tier" onClick={() => saveLoyaltyRule('earn')} disabled={busy}>{editingRule ? 'Update Rule' : 'Create Rule'}</button>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>

            {/* Redemption Rule Modal */}
            <AnimatePresence>
                {redemptModalOpen && (
                    <Modal onClose={() => setRedemptModalOpen(false)} title={editingRule ? 'Edit Redemption Rule' : 'New Redemption Rule'} className="tier-form-modal">
                        <div className="modern-form-container">
                            <div className="form-section no-border">
                                <div className="form-group">
                                    <label>Rule Name</label>
                                    <input type="text" value={formState.name} onChange={(e) => setFormState({ ...formState, name: e.target.value })} placeholder="e.g. Standard Redemption" />
                                </div>
                                <div className="form-group">
                                    <label>Description</label>
                                    <input type="text" style={{ height: '80px' }} value={formState.description} onChange={(e) => setFormState({ ...formState, description: e.target.value })} placeholder="Describe the redemption process..." />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Points Threshold</label>
                                        <input type="number" value={formState.threshold} onChange={(e) => setFormState({ ...formState, threshold: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label>SAR Value</label>
                                        <input type="number" value={formState.value} onChange={(e) => setFormState({ ...formState, value: e.target.value })} />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Priority</label>
                                    <input type="number" value={formState.priority} onChange={(e) => setFormState({ ...formState, priority: e.target.value })} />
                                </div>
                            </div>
                            <div className="modal-footer-modern">
                                <button className="btn-modern-cancel" onClick={() => setRedemptModalOpen(false)}>Cancel</button>
                                <button className="btn-new-tier" onClick={() => saveLoyaltyRule('redeem')} disabled={busy}>{editingRule ? 'Update Rule' : 'Create Rule'}</button>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>

            {/* Rules Engine Modal */}
            <AnimatePresence>
                {ruleModalOpen && (
                    <Modal onClose={() => setRuleModalOpen(false)} title={editingRule ? 'Edit Rule' : 'New Rule'} className="tier-form-modal">
                        <div className="modern-form-container">
                            <div className="form-section">
                                <div className="form-group">
                                    <label>Rule Name *</label>
                                    <input type="text" value={formState.name} onChange={(e) => setFormState({ ...formState, name: e.target.value })} placeholder="Enter rule name..." />
                                </div>
                                <div className="form-group">
                                    <label>Description</label>
                                    <input type="text" value={formState.description} onChange={(e) => setFormState({ ...formState, description: e.target.value })} placeholder="Describe what this rule does..." />
                                </div>
                                <div className="form-row">
                                    <div className="form-group flex-2">
                                        <label>Rule Type</label>
                                        <select value={formState.type} onChange={(e) => setFormState({ ...formState, type: e.target.value })} className="tester-select">
                                            <option value="tier_assign">tier_assign</option>
                                            <option value="earn">earn</option>
                                            <option value="redeem">redeem</option>
                                        </select>
                                    </div>
                                    <div className="form-group flex-1">
                                        <label>Priority (lower = first)</label>
                                        <input type="number" value={formState.priority} onChange={(e) => setFormState({ ...formState, priority: parseInt(e.target.value, 10) || 0 })} />
                                    </div>
                                </div>
                            </div>

                            <div className="form-section rule-box if">
                                <h4 className="box-title">IF CONDITION</h4>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Field</label>
                                        <select value={formState.condition.field} onChange={(e) => setFormState({ ...formState, condition: { ...formState.condition, field: e.target.value } })} className="tester-select">
                                            <option value="monthly_spend">Monthly Spend (SAR)</option>
                                            <option value="loyalty_points">Total Loyalty Points</option>
                                            <option value="invoice_total">Invoice Total (SAR)</option>
                                            <option value="lifetime_spend">Lifetime Spend</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Operator</label>
                                        <select value={formState.condition.operator} onChange={(e) => setFormState({ ...formState, condition: { ...formState.condition, operator: e.target.value } })} className="tester-select">
                                            <option value=">=">{'>= (Greater or Equal)'}</option>
                                            <option value="<=">{'<= (Less or Equal)'}</option>
                                            <option value="==">{'== (Equals)'}</option>
                                            <option value="between">Between</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Value</label>
                                        <input type="number" value={formState.condition.value} onChange={(e) => setFormState({ ...formState, condition: { ...formState.condition, value: parseInt(e.target.value, 10) || 0 } })} />
                                    </div>
                                    {formState.condition.operator === 'between' && (
                                        <div className="form-group">
                                            <label>Max Value</label>
                                            <input type="number" value={formState.condition.maxValue} onChange={(e) => setFormState({ ...formState, condition: { ...formState.condition, maxValue: parseInt(e.target.value, 10) || 0 } })} />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="form-section rule-box then">
                                <h4 className="box-title">THEN ACTION</h4>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Action</label>
                                        <select value={formState.action.type} onChange={(e) => setFormState({ ...formState, action: { ...formState.action, type: e.target.value } })} className="tester-select">
                                            <option value="assign_tier">Assign Corporate Tier</option>
                                            <option value="award_points">Award Bonus Points</option>
                                            <option value="apply_discount">Apply Discount %</option>
                                            <option value="apply_discount_val">Apply Discount (SAR)</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        {formState.action.type === 'assign_tier' ? (
                                            <>
                                                <label>Tier</label>
                                                <select value={formState.action.tierId} onChange={(e) => setFormState({ ...formState, action: { ...formState.action, tierId: e.target.value } })} className="tester-select">
                                                    <option value="">Select tier...</option>
                                                    {tiers.map((t) => (<option key={t.id} value={t.id}>{t.icon} {t.name}</option>))}
                                                </select>
                                            </>
                                        ) : (
                                            <>
                                                <label>Value</label>
                                                <input type="number" value={formState.action.value} onChange={(e) => setFormState({ ...formState, action: { ...formState.action, value: parseInt(e.target.value, 10) || 0 } })} />
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="form-section no-border">
                                <div className="modern-toggle-item small">
                                    <label className="toggle-v3 small" onClick={(e) => e.stopPropagation()}>
                                        <input type="checkbox" checked={formState.status === 'active'} onChange={(e) => setFormState({ ...formState, status: e.target.checked ? 'active' : 'paused' })} />
                                        <span className="toggle-v3-track"></span>
                                    </label>
                                    <div className="toggle-label"><p className="main-label">Active</p></div>
                                </div>
                            </div>

                            <div className="modal-footer-modern">
                                <button className="btn-modern-cancel" onClick={() => setRuleModalOpen(false)}>Cancel</button>
                                <button className="btn-new-tier" onClick={saveRule} disabled={busy}>Save Rule</button>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}
