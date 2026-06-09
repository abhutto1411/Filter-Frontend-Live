import React, { useState } from 'react';
import {
    Award, Pencil, TrendingUp, ShieldCheck, Zap, Info, X,
    Plus, ChevronDown, ChevronUp, Trash2, CheckCircle2,
    Layout, Settings, BarChart3, Users, ArrowUp, ArrowDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
    CartesianGrid, Tooltip, PieChart, Pie, Cell,
    BarChart, Bar, Legend
} from 'recharts';
import Modal from '../../components/Modal';
import '../../styles/admin/TierManagementPage.css';

const INITIAL_TIERS = [
    {
        id: 'bronze',
        name: 'Bronze',
        icon: '🥉',
        color: '#cd7f32',
        minSales: 0,
        maxSales: 2000,
        discount: 0,
        status: 'active',
        priority: false,
        eligiblePromotions: true,
        benefits: ['Standard service', 'Email support']
    },
    {
        id: 'silver',
        name: 'Silver',
        icon: '🥈',
        color: '#94a3b8',
        minSales: 2001,
        maxSales: 5000,
        discount: 5,
        status: 'active',
        priority: false,
        eligiblePromotions: true,
        benefits: ['5% monthly billing discount', 'Priority booking', 'Dedicated account manager']
    },
    {
        id: 'gold',
        name: 'Gold',
        icon: '🥇',
        color: '#fbbf24',
        minSales: 5001,
        maxSales: 10000,
        discount: 10,
        status: 'active',
        priority: true,
        eligiblePromotions: true,
        benefits: ['10% monthly billing discount', 'Priority service lane', 'Free car wash (monthly)', 'Quarterly fleet report']
    },
    {
        id: 'platinum',
        name: 'Platinum',
        icon: '💎',
        color: '#0ea5e9',
        minSales: 10001,
        maxSales: 25000,
        discount: 15,
        status: 'active',
        priority: true,
        eligiblePromotions: true,
        benefits: ['15% monthly billing discount', 'Dedicated service manager', 'Free oil change (quarterly)', 'Priority emergency service', 'Custom billing terms']
    }
];

const INITIAL_EARN_RULES = [
    { id: 'er-1', name: 'Standard Earn Rate', description: 'Earn 1 loyalty point for every SAR spent on any invoice', rate: 1, status: 'active', priority: 10 }
];

const INITIAL_REDEMPTION_RULES = [
    { id: 'rr-1', name: 'Standard Redemption', description: 'Redeem 500 points for a SAR 25 discount on next invoice', threshold: 500, value: 25, status: 'active', priority: 10 }
];

const INITIAL_RULES = [
    {
        id: 'r-1',
        name: 'Gold Tier',
        description: 'Assign Gold tier for monthly spend 5001-10000 SAR',
        type: 'tier_assign',
        status: 'active',
        priority: 1,
        condition: { field: 'monthly_spend', operator: 'between', value: 5001, maxValue: 10000 },
        action: { type: 'assign_tier', tierId: 'gold' }
    },
    {
        id: 'r-2',
        name: 'Platinum Tier',
        description: 'Assign Platinum tier for monthly spend 10001-25000 SAR',
        type: 'tier_assign',
        status: 'active',
        priority: 2,
        condition: { field: 'monthly_spend', operator: 'between', value: 10001, maxValue: 25000 },
        action: { type: 'assign_tier', tierId: 'platinum' }
    },
    {
        id: 'r-3',
        name: 'Standard Earn Rate',
        description: 'Earn 1 loyalty point for every SAR spent on any invoice',
        type: 'earn',
        status: 'active',
        priority: 3,
        condition: { field: 'invoice_total', operator: '>=', value: 0 },
        action: { type: 'award_points', value: 1 }
    },
    {
        id: 'r-4',
        name: 'Standard Redemption',
        description: 'Redeem 500 points for a SAR 25 discount on next invoice',
        type: 'redeem',
        status: 'active',
        priority: 4,
        condition: { field: 'loyalty_points', operator: '>=', value: 500 },
        action: { type: 'apply_discount_val', value: 25, pointsCost: 500 }
    }
];

const LOYALTY_STATS = [
    { label: 'Total Points Issued', value: '45,280', icon: Award, color: '#fbbf24' },
    { label: 'Available Points', value: '12,450', icon: Zap, color: '#10b981' },
    { label: 'Points Redeemed', value: '32,830', icon: TrendingUp, color: '#6366f1' },
    { label: 'Loyalty Liability', value: 'SAR 1,641', icon: Users, color: '#f43f5e' }
];

const REPORT_STATS = [
    { label: 'Corporate Customers', value: '24', icon: ShieldCheck, color: '#0ea5e9' },
    { label: 'Walk-In Loyalty Accts', value: '156', icon: Users, color: '#10b981' },
    { label: 'Total Points Issued', value: '45,280', icon: Award, color: '#fbbf24' },
    { label: 'Loyalty Liability', value: 'SAR 1,641', icon: Settings, color: '#f43f5e' }
];

const TIER_DIST_DATA = [
    { name: 'Bronze', value: 45, color: '#cd7f32' },
    { name: 'Silver', value: 30, color: '#94a3b8' },
    { name: 'Gold', value: 15, color: '#fbbf24' },
    { name: 'Platinum', value: 10, color: '#0ea5e9' }
];

const LOYALTY_TREND_DATA = [
    { month: 'Jan', earned: 4000, redeemed: 2400 },
    { month: 'Feb', earned: 3000, redeemed: 1398 },
    { month: 'Mar', earned: 2000, redeemed: 9800 },
    { month: 'Apr', earned: 2780, redeemed: 3908 },
    { month: 'May', earned: 1890, redeemed: 4800 },
    { month: 'Jun', earned: 2390, redeemed: 3800 },
    { month: 'Jul', earned: 3490, redeemed: 4300 },
];

const TOP_ACCOUNTS_DATA = [
    { id: 1, customer: 'Ahmad Al-Sayed', type: 'Walk-In', tier: 'Platinum', pts: 4250, monthSpend: 12500, lifetime: 85000 },
    { id: 2, customer: 'Global Logistics co.', type: 'Corporate', tier: 'Gold', pts: 2100, monthSpend: 8200, lifetime: 142000 },
    { id: 3, customer: 'Sarah Johnson', type: 'Walk-In', tier: 'Silver', pts: 850, monthSpend: 3100, lifetime: 12400 },
    { id: 4, customer: 'Fast Delivery Ltd.', type: 'Corporate', tier: 'Bronze', pts: 450, monthSpend: 1850, lifetime: 22000 },
    { id: 5, customer: 'Omar Khalid', type: 'Walk-In', tier: 'Gold', pts: 1200, monthSpend: 6400, lifetime: 45000 }
];

export default function TierManagementPage() {
    const [tiers, setTiers] = useState(INITIAL_TIERS);
    const [activeTab, setActiveTab] = useState('corporate');
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingTier, setEditingTier] = useState(null);
    const [expandedTiers, setExpandedTiers] = useState({});

    // Loyalty Specific State
    const [earnRules, setEarnRules] = useState(INITIAL_EARN_RULES);
    const [redemptRules, setRedemptRules] = useState(INITIAL_REDEMPTION_RULES);
    const [loyaltyAccounts, setLoyaltyAccounts] = useState([]);
    const [earnModalOpen, setEarnModalOpen] = useState(false);
    const [redemptModalOpen, setRedemptModalOpen] = useState(false);
    const [ruleModalOpen, setRuleModalOpen] = useState(false);
    const [editingRule, setEditingRule] = useState(null);
    const [rules, setRules] = useState(INITIAL_RULES);

    const [formState, setFormState] = useState({
        name: '',
        icon: '🎁',
        color: '#fbbf24',
        minSales: 0,
        maxSales: 0,
        discount: 0,
        status: 'active',
        priority: 10,
        eligiblePromotions: true,
        benefits: [],
        // Loyalty rule fields
        description: '',
        rate: 1,
        threshold: 500,
        value: 25,
        // Rules Engine fields
        type: 'tier_assign',
        condition: { field: 'monthly_spend', operator: '>=', value: 0, maxValue: 0 },
        action: { type: 'assign_tier', tierId: '', value: 0 }
    });

    const [newBenefit, setNewBenefit] = useState('');

    const toggleExpand = (id) => {
        setExpandedTiers(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const openEdit = (tier) => {
        setEditingTier(tier);
        setFormState({
            ...tier,
            benefits: [...tier.benefits]
        });
        setEditModalOpen(true);
    };

    const openNewTier = () => {
        setEditingTier(null);
        setFormState({
            name: '',
            icon: '🎁',
            color: '#fbbf24',
            minSales: 0,
            maxSales: 0,
            discount: 0,
            status: 'active',
            priority: false,
            eligiblePromotions: true,
            benefits: []
        });
        setEditModalOpen(true);
    };

    const handleSave = () => {
        if (editingTier) {
            setTiers(prev => prev.map(t => t.id === editingTier.id ? { ...formState, id: t.id } : t));
        } else {
            const newId = formState.name.toLowerCase().replace(/\s+/g, '-');
            setTiers(prev => [...prev, { ...formState, id: newId }]);
        }
        setEditModalOpen(false);
    };

    const addBenefit = () => {
        if (newBenefit.trim()) {
            setFormState(prev => ({
                ...prev,
                benefits: [...prev.benefits, newBenefit.trim()]
            }));
            setNewBenefit('');
        }
    };

    const removeBenefit = (index) => {
        setFormState(prev => ({
            ...prev,
            benefits: prev.benefits.filter((_, i) => i !== index)
        }));
    };

    // Loyalty Helper Methods
    const openNewEarnRule = () => {
        setEditingRule(null);
        setFormState({ ...formState, name: '', description: '', rate: 1, priority: 10, status: 'active' });
        setEarnModalOpen(true);
    };

    const openEditEarnRule = (rule) => {
        setEditingRule(rule);
        setFormState({ ...formState, ...rule });
        setEarnModalOpen(true);
    };

    const openNewRedemptRule = () => {
        setEditingRule(null);
        setFormState({ ...formState, name: '', description: '', threshold: 500, value: 25, priority: 10, status: 'active' });
        setRedemptModalOpen(true);
    };

    const openEditRedemptRule = (rule) => {
        setEditingRule(rule);
        setFormState({ ...formState, ...rule });
        setRedemptModalOpen(true);
    };

    const saveLoyaltyRule = (type) => {
        if (type === 'earn') {
            if (editingRule) {
                setEarnRules(prev => prev.map(r => r.id === editingRule.id ? { ...formState, id: r.id } : r));
            } else {
                setEarnRules(prev => [...prev, { ...formState, id: `er-${Date.now()}` }]);
            }
            setEarnModalOpen(false);
        } else {
            if (editingRule) {
                setRedemptRules(prev => prev.map(r => r.id === editingRule.id ? { ...formState, id: r.id } : r));
            } else {
                setRedemptRules(prev => [...prev, { ...formState, id: `rr-${Date.now()}` }]);
            }
            setRedemptModalOpen(false);
        }
    };

    const openNewRule = () => {
        setEditingRule(null);
        setFormState({
            ...formState,
            name: '',
            description: '',
            type: 'tier_assign',
            priority: 10,
            status: 'active',
            condition: { field: 'monthly_spend', operator: '>=', value: 0, maxValue: 0 },
            action: { type: 'assign_tier', tierId: 'gold', value: 0 }
        });
        setRuleModalOpen(true);
    };

    const openEditRule = (rule) => {
        setEditingRule(rule);
        setFormState({ ...formState, ...rule });
        setRuleModalOpen(true);
    };

    const saveRule = () => {
        if (editingRule) {
            setRules(prev => prev.map(r => r.id === editingRule.id ? { ...formState, id: r.id } : r));
        } else {
            setRules(prev => [...prev, { ...formState, id: `r-${Date.now()}` }]);
        }
        setRuleModalOpen(false);
    };

    const deleteRule = (id) => {
        setRules(prev => prev.filter(r => r.id !== id));
    };

    const moveTier = (index, direction) => {
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= tiers.length) return;
        const newTiers = [...tiers];
        [newTiers[index], newTiers[newIndex]] = [newTiers[newIndex], newTiers[index]];
        setTiers(newTiers);
    };

    const TABS = [
        { id: 'corporate', label: 'Corporate Tiers', icon: ShieldCheck },
        { id: 'walkin', label: 'Walk-In Loyalty', icon: Users },
        { id: 'rules', label: 'Rules Engine', icon: Settings },
        { id: 'reports', label: 'Reports', icon: BarChart3 }
    ];

    return (
        <div className="tier-management-page module-container">
            {/* Main Header */}
            <header className="tier-main-header">
                <div className="header-icon">
                    <Award size={32} />
                </div>
                <div className="header-info">
                    <h1 className="header-title">Tier Management</h1>
                    <p className="header-subtitle">Corporate tiers, loyalty engine, rules configuration and reports</p>
                </div>
            </header>

            {/* Premium Tabs */}
            <nav className="tier-tabs-nav">
                {TABS.map(tab => {
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
                {activeTab === 'corporate' ? (
                    <>
                        <div className="section-header">
                            <div className="header-left">
                                <h2 className="section-title">Corporate Tier Configuration</h2>
                                <p className="section-desc">Define tiers, thresholds, discounts and benefits. Auto-upgrades on monthly spend.</p>
                            </div>
                            <button className="btn-new-tier" onClick={openNewTier}>
                                <Plus size={20} />
                                <span>New Tier</span>
                            </button>
                        </div>

                        {/* Tier List */}
                        <div className="tier-list-container">
                            {tiers.map((tier, index) => (
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
                                                    <span className="status-badge active">active</span>
                                                    {tier.discount > 0 && <span className="discount-badge">{tier.discount}% off</span>}
                                                    {tier.priority && <span className="priority-badge">Priority</span>}
                                                </div>
                                                <p className="tier-range">SAR {tier.minSales.toLocaleString()} – SAR {tier.maxSales.toLocaleString()} / month</p>
                                            </div>
                                            <div className="card-actions">
                                                <div className="move-actions">
                                                    <button
                                                        className="action-btn move-btn"
                                                        onClick={(e) => { e.stopPropagation(); moveTier(index, -1); }}
                                                        disabled={index === 0}
                                                        title="Move Up"
                                                    >
                                                        <ArrowUp size={16} />
                                                    </button>
                                                    <button
                                                        className="action-btn move-btn"
                                                        onClick={(e) => { e.stopPropagation(); moveTier(index, 1); }}
                                                        disabled={index === tiers.length - 1}
                                                        title="Move Down"
                                                    >
                                                        <ArrowDown size={16} />
                                                    </button>
                                                </div>

                                                <button className="action-btn edit-btn" onClick={(e) => { e.stopPropagation(); openEdit(tier); }}>
                                                    <Pencil size={18} />
                                                </button>
                                                <label className="toggle-switch small" onClick={(e) => e.stopPropagation()}>
                                                     <input
                                                         type="checkbox"
                                                         checked={tier.status === 'active'}
                                                         onChange={(e) => {
                                                             const updatedTiers = [...tiers];
                                                             updatedTiers[index].status = e.target.checked ? 'active' : 'inactive';
                                                             setTiers(updatedTiers);
                                                         }}
                                                     />
                                                     <span className="tier-toggle-handle"></span>
                                                 </label>

                                                <button className="action-btn delete-btn" onClick={(e) => { e.stopPropagation(); /* delete logic */ }}>
                                                    <Trash2 size={18} />
                                                </button>

                                                <button className="action-btn collapse-toggle" onClick={(e) => { e.stopPropagation(); toggleExpand(tier.id); }}>
                                                    {expandedTiers[tier.id] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                                </button>
                                            </div>
                                        </div>

                                        <AnimatePresence>
                                            {expandedTiers[tier.id] && (
                                                <motion.div
                                                    className="card-expanded-details"
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                >
                                                    <div className="benefits-grid">
                                                        {tier.benefits.map((benefit, idx) => (
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
                        {/* Loyalty Analytics */}
                        <div className="loyalty-stats-grid">
                            {LOYALTY_STATS.map((stat, i) => {
                                const Icon = stat.icon;
                                return (
                                    <div key={i} className="loyalty-stat-card">
                                        <div className="stat-icon" style={{ background: `${stat.color}10`, color: stat.color }}>
                                            <Icon size={20} />
                                        </div>
                                        <div className="stat-content">
                                            <p className="stat-label">{stat.label}</p>
                                            <h3 className="stat-value">{stat.value}</h3>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Rules Section */}
                        <div className="loyalty-rules-grid">
                            {/* Points Earn Rules */}
                            <div className="rules-column">
                                <div className="column-header">
                                    <h3 className="column-title">Points Earn Rules</h3>
                                    <button className="column-add-btn" onClick={openNewEarnRule}>
                                        <Plus size={16} /> <span>Add</span>
                                    </button>
                                </div>
                                <div className="rules-stack">
                                    {earnRules.map(rule => (
                                        <div key={rule.id} className="rule-card-modern">
                                            <div className="rule-info">
                                                <div className="rule-name-row">
                                                    <h4 className="rule-name">{rule.name}</h4>
                                                    <span className="rule-status">Active</span>
                                                </div>
                                                <p className="rule-description">{rule.description}</p>
                                                <div className="rule-detail-tag">{rule.rate} pt / SAR</div>
                                            </div>
                                            <div className="rule-actions">
                                                <label className="toggle-switch small" onClick={(e) => e.stopPropagation()}>
                                                     <input
                                                         type="checkbox"
                                                         checked={rule.status === 'active'}
                                                         onChange={(e) => {
                                                             setEarnRules(prev => prev.map(r => r.id === rule.id ? { ...r, status: e.target.checked ? 'active' : 'inactive' } : r));
                                                         }}
                                                     />
                                                     <span className="tier-toggle-handle"></span>
                                                 </label>
                                                <button className="rule-icon-btn" onClick={() => openEditEarnRule(rule)}><Pencil size={16} /></button>
                                                <button className="rule-icon-btn delete"><Trash2 size={16} /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Points Redemption Rules */}
                            <div className="rules-column">
                                <div className="column-header">
                                    <h3 className="column-title">Points Redemption Rules</h3>
                                    <button className="column-add-btn" onClick={openNewRedemptRule}>
                                        <Plus size={16} /> <span>Add</span>
                                    </button>
                                </div>
                                <div className="rules-stack">
                                    {redemptRules.map(rule => (
                                        <div key={rule.id} className="rule-card-modern">
                                            <div className="rule-info">
                                                <div className="rule-name-row">
                                                    <h4 className="rule-name">{rule.name}</h4>
                                                    <span className="rule-status">Active</span>
                                                </div>
                                                <p className="rule-description">{rule.description}</p>
                                                <div className="rule-detail-row">
                                                    <span className="value-tag gold">{rule.threshold} pts threshold</span>
                                                    <span className="arrow-sep">➔</span>
                                                    <span className="value-tag green">SAR {rule.value}</span>
                                                </div>
                                            </div>
                                            <div className="rule-actions">
                                                <label className="toggle-switch small" onClick={(e) => e.stopPropagation()}>
                                                     <input
                                                         type="checkbox"
                                                         checked={rule.status === 'active'}
                                                         onChange={(e) => {
                                                             setRedemptRules(prev => prev.map(r => r.id === rule.id ? { ...r, status: e.target.checked ? 'active' : 'inactive' } : r));
                                                         }}
                                                     />
                                                     <span className="tier-toggle-handle"></span>
                                                 </label>
                                                <button className="rule-icon-btn" onClick={() => openEditRedemptRule(rule)}><Pencil size={16} /></button>
                                                <button className="rule-icon-btn delete"><Trash2 size={16} /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Customer Table */}
                        <div className="loyalty-accounts-section">
                            <div className="accounts-header">
                                <h3 className="section-title">Customer Loyalty Accounts</h3>
                                <div className="table-search">
                                    <Layout size={16} />
                                    <input type="text" placeholder="Search..." />
                                </div>
                            </div>
                            <div className="loyalty-table-wrapper">
                                <table className="modern-tier-table">
                                    <thead>
                                        <tr>
                                            <th>Customer</th>
                                            <th>Type</th>
                                            <th>Available Pts</th>
                                            <th>Total Pts</th>
                                            <th>Month Spend</th>
                                            <th>Last Visit</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td colSpan="6" className="empty-state">
                                                No loyalty accounts yet
                                            </td>
                                        </tr>
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
                                <button className="btn-modern-outline">
                                    <TrendingUp size={18} />
                                    <span>Run Monthly Reset</span>
                                </button>
                                <button className="btn-new-tier" onClick={openNewRule}>
                                    <Plus size={20} />
                                    <span>Add Rule</span>
                                </button>
                            </div>
                        </div>

                        <div className="rules-stack-modern">
                            {rules.map((rule, idx) => (
                                <motion.div
                                    key={rule.id}
                                    className="rule-builder-card"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.1 }}
                                >
                                    <div className="rule-card-header">
                                        <div className="rule-meta">
                                            <span className="rule-id">#{idx + 1}</span>
                                            <div className={ `rule-type-badge ${rule.type}` }>
                                                {rule.type === 'tier_assign' && <ShieldCheck size={12} />}
                                                {rule.type === 'earn' && <Zap size={12} />}
                                                {rule.type === 'redeem' && <Award size={12} />}
                                                <span>{rule.type.replace('_', ' ')}</span>
                                            </div>
                                            <h3 className="rule-display-name">{rule.name}</h3>
                                            <span className={`status-pill ${rule.status}`}>{rule.status}</span>
                                        </div>
                                        <div className="rule-actions-top">
                                            <label className="toggle-v3 small" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={rule.status === 'active'}
                                                    onChange={(e) => {
                                                        const updatedRules = [...rules];
                                                        updatedRules[idx].status = e.target.checked ? 'active' : 'paused';
                                                        setRules(updatedRules);
                                                    }}
                                                />
                                                <span className="toggle-v3-track"></span>
                                            </label>
                                            <button className="icon-btn-ghost" onClick={() => openEditRule(rule)}>
                                                <Pencil size={16} />
                                            </button>
                                            <button className="icon-btn-ghost delete" onClick={() => deleteRule(rule.id)}>
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="rule-logic-display">
                                        <div className="logic-part if">
                                            <span className="logic-label">IF</span>
                                            <div className="logic-box">
                                                <span className="field">{rule.condition.field.replace('_', ' ')}</span>
                                                <span className="operator">{rule.condition.operator}</span>
                                                <span className="value">
                                                    {rule.condition.operator === 'between' 
                                                        ? `${rule.condition.value.toLocaleString()} — ${rule.condition.maxValue.toLocaleString()}`
                                                        : rule.condition.value.toLocaleString()
                                                    }
                                                </span>
                                            </div>
                                        </div>
                                        
                                        <div className="logic-arrow">
                                            <ArrowUp size={20} style={{ transform: 'rotate(90deg)' }} />
                                        </div>

                                        <div className="logic-part then">
                                            <span className="logic-label">THEN</span>
                                            <div className="logic-box">
                                                <span className="action-type">{rule.action.type.replace('_', ' ')}</span>
                                                <span className="operator">=</span>
                                                <span className="result">
                                                    {rule.action.tierId ? (
                                                        <span className="tier-tag">
                                                            {tiers.find(t => t.id === rule.action.tierId)?.name || rule.action.tierId}
                                                        </span>
                                                    ) : rule.action.value}
                                                </span>
                                            </div>
                                        </div>

                                        {rule.type === 'earn' && (
                                            <div className="rule-value-pill reward">
                                                {rule.action.value} pt per SAR
                                            </div>
                                        )}
                                        {rule.type === 'redeem' && (
                                            <div className="rule-value-pill cost">
                                                {rule.action.pointsCost} pts → SAR {rule.action.value}
                                            </div>
                                        )}
                                    </div>

                                    <p className="rule-card-desc">{rule.description}</p>
                                </motion.div>
                            ))}
                        </div>

                        <div className="rule-tester-section">
                            <div className="section-header-compact">
                                <TrendingUp size={20} className="tester-icon" />
                                <h3 className="tester-title">Rule Engine Tester</h3>
                            </div>
                            <p className="tester-desc">Test the engine against a real customer to see their loyalty state</p>
                            
                            <div className="tester-controls">
                                <div className="tester-input-group">
                                    <select className="tester-select">
                                        <option value="">Select customer to test...</option>
                                        <option value="1">John Doe (Gold)</option>
                                        <option value="2">Jane Smith (Platinum)</option>
                                    </select>
                                    <button className="btn-new-tier tester-btn">
                                        <Zap size={18} />
                                        <span>Run Test</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : activeTab === 'reports' ? (
                    <div className="reports-dashboard">
                        {/* 1. Header Stats Grid */}
                        <div className="loyalty-stats-grid">
                            {REPORT_STATS.map((stat, i) => {
                                const Icon = stat.icon;
                                return (
                                    <div key={i} className="loyalty-stat-card">
                                        <div className="stat-icon" style={{ background: `${stat.color}10`, color: stat.color }}>
                                            <Icon size={20} />
                                        </div>
                                        <div className="stat-content">
                                            <p className="stat-label">{stat.label}</p>
                                            <h3 className="stat-value">{stat.value}</h3>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* 2. Charts Row */}
                        <div className="reports-charts-grid">
                            {/* Distribution Chart */}
                            <div className="report-chart-card">
                                <div className="chart-header">
                                    <h3 className="chart-title">Corporate Customers by Tier</h3>
                                </div>
                                <div className="chart-body" style={{ height: 260 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={TIER_DIST_DATA}
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {TIER_DIST_DATA.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip 
                                                contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                                                itemStyle={{ color: '#fff' }}
                                            />
                                            <Legend verticalAlign="bottom" height={36}/>
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Lifecycle Chart */}
                            <div className="report-chart-card">
                                <div className="chart-header">
                                    <h3 className="chart-title">Loyalty Points Summary</h3>
                                </div>
                                <div className="chart-body" style={{ height: 180 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={LOYALTY_TREND_DATA}>
                                            <defs>
                                                <linearGradient id="colorEarned" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                                </linearGradient>
                                                <linearGradient id="colorRedeemed" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                                                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                                            <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                            <YAxis hide />
                                            <Tooltip 
                                                contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                                                itemStyle={{ color: '#fff' }}
                                            />
                                            <Area type="monotone" dataKey="earned" stroke="#10b981" fillOpacity={1} fill="url(#colorEarned)" />
                                            <Area type="monotone" dataKey="redeemed" stroke="#f43f5e" fillOpacity={1} fill="url(#colorRedeemed)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="chart-footer-metrics">
                                    <div className="footer-metric">
                                        <span className="metric-dot green"></span>
                                        <div className="metric-info">
                                            <p className="m-label">Earned</p>
                                            <p className="m-value">2,450</p>
                                        </div>
                                    </div>
                                    <div className="footer-metric">
                                        <span className="metric-dot red"></span>
                                        <div className="metric-info">
                                            <p className="m-label">Redeemed</p>
                                            <p className="m-value">1,280</p>
                                        </div>
                                    </div>
                                    <div className="footer-metric">
                                        <span className="metric-dot gold"></span>
                                        <div className="metric-info">
                                            <p className="m-label">Outstanding</p>
                                            <p className="m-value">12,450</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 3. Top Accounts Table */}
                        <div className="loyalty-accounts-section no-margin">
                            <div className="accounts-header">
                                <h3 className="section-title">Top Loyalty Accounts</h3>
                            </div>
                            <div className="loyalty-table-wrapper">
                                <table className="modern-tier-table">
                                    <thead>
                                        <tr>
                                            <th>Customer</th>
                                            <th>Type</th>
                                            <th>Tier</th>
                                            <th>Available Pts</th>
                                            <th>Month Spend</th>
                                            <th>Lifetime</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {TOP_ACCOUNTS_DATA.map(account => (
                                            <tr key={account.id}>
                                                <td className="font-semibold">{account.customer}</td>
                                                <td>{account.type}</td>
                                                <td>
                                                    <span className={`tier-badge-small ${account.tier.toLowerCase()}`}>
                                                        {account.tier}
                                                    </span>
                                                </td>
                                                <td className="pts-column">{account.pts.toLocaleString()}</td>
                                                <td>SAR {account.monthSpend.toLocaleString()}</td>
                                                <td className="text-slate-400">SAR {account.lifetime.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>

            {/* Redesigned Modal - Centered Card */}
            <AnimatePresence>
                {editModalOpen && (
                    <Modal
                        title={editingTier ? "Edit Tier Details" : "Create New Tier"}
                        onClose={() => setEditModalOpen(false)}
                        className="tier-form-modal"
                    >
                        <div className="modern-form-container">
                            {/* Section 1: Basic Info */}
                            <div className="form-section">
                                <h4 className="form-section-title">General Information</h4>
                                <div className="form-row">
                                    <div className="form-group flex-2">
                                        <label>Tier Name</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Gold"
                                            value={formState.name}
                                            onChange={e => setFormState({ ...formState, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group flex-1">
                                        <label>Icon</label>
                                        <input
                                            type="text"
                                            value={formState.icon}
                                            onChange={e => setFormState({ ...formState, icon: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group flex-1">
                                        <label>Accent Color</label>
                                        <div className="color-picker-simple">
                                            <input
                                                type="color"
                                                value={formState.color}
                                                onChange={e => setFormState({ ...formState, color: e.target.value })}
                                            />
                                            <div className="color-indicator" style={{ background: formState.color }}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Thresholds & Rewards */}
                            <div className="form-section">
                                <h4 className="form-section-title">Revenue & Rewards</h4>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Min Sales (SAR)</label>
                                        <input
                                            type="number"
                                            value={formState.minSales}
                                            onChange={e => setFormState({ ...formState, minSales: Number(e.target.value) })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Max Sales (SAR)</label>
                                        <input
                                            type="number"
                                            value={formState.maxSales}
                                            onChange={e => setFormState({ ...formState, maxSales: Number(e.target.value) })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Discount %</label>
                                        <input
                                            type="number"
                                            value={formState.discount}
                                            onChange={e => setFormState({ ...formState, discount: Number(e.target.value) })}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: Configuration */}
                            <div className="form-section">
                                <h4 className="form-section-title">Features & Visibility</h4>
                                <div className="modern-toggles-grid">
                                    <div className="modern-toggle-item small">
                                        <label className="toggle-v3 small" onClick={e => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={formState.priority}
                                                onChange={e => setFormState({ ...formState, priority: e.target.checked })}
                                            />
                                            <span className="toggle-v3-track"></span>
                                        </label>
                                        <div className="toggle-label">
                                            <p className="main-label">Priority Support</p>
                                            <p className="sub-label">Skip the queue for service tasks</p>
                                        </div>
                                    </div>

                                    <div className="modern-toggle-item small">
                                        <label className="toggle-v3 small" onClick={e => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={formState.status === 'active'}
                                                onChange={e => setFormState({ ...formState, status: e.target.checked ? 'active' : 'inactive' })}
                                            />
                                            <span className="toggle-v3-track"></span>
                                        </label>
                                        <div className="toggle-label">
                                            <p className="main-label">Tier Active</p>
                                            <p className="sub-label">Enable tier for accounts</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section 4: Benefits */}
                            <div className="form-section no-border">
                                <h4 className="form-section-title">Tier Benefits</h4>
                                <div className="benefit-input-modern">
                                    <input
                                        type="text"
                                        placeholder="Enter a benefit and press enter..."
                                        value={newBenefit}
                                        onChange={e => setNewBenefit(e.target.value)}
                                        onKeyPress={e => e.key === 'Enter' && addBenefit()}
                                    />
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
                                <button className="btn-new-tier" onClick={handleSave}>
                                    {editingTier ? 'Update Tier' : 'Create Tier'}
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
            {/* Loyalty Modals */}
            <AnimatePresence>
                {earnModalOpen && (
                    <Modal 
                        onClose={() => setEarnModalOpen(false)} 
                        title={editingRule ? "Edit Earn Rule" : "New Earn Rule"} 
                        className="tier-form-modal"
                    >
                        <div className="modern-form-container">
                            <div className="form-section no-border">
                                <div className="form-group">
                                    <label>Rule Name</label>
                                    <input
                                        type="text"
                                        value={formState.name}
                                        onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                                        placeholder="e.g. Standard Earn Rate"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Description</label>
                                    <input
                                        type="text"
                                        style={{ height: '80px' }}
                                        value={formState.description}
                                        onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                                        placeholder="Describe how customers earn points..."
                                    />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Points per SAR spent</label>
                                        <input
                                            type="number"
                                            value={formState.rate}
                                            onChange={(e) => setFormState({ ...formState, rate: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Priority</label>
                                        <input
                                            type="number"
                                            value={formState.priority}
                                            onChange={(e) => setFormState({ ...formState, priority: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="modal-footer-modern">
                                <button className="btn-modern-cancel" onClick={() => setEarnModalOpen(false)}>Cancel</button>
                                <button className="btn-new-tier" onClick={() => saveLoyaltyRule('earn')}>
                                    {editingRule ? 'Update Rule' : 'Create Rule'}
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {redemptModalOpen && (
                    <Modal 
                        onClose={() => setRedemptModalOpen(false)} 
                        title={editingRule ? "Edit Redemption Rule" : "New Redemption Rule"} 
                        className="tier-form-modal"
                    >
                        <div className="modern-form-container">
                            <div className="form-section no-border">
                                <div className="form-group">
                                    <label>Rule Name</label>
                                    <input
                                        type="text"
                                        value={formState.name}
                                        onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                                        placeholder="e.g. Standard Redemption"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Description</label>
                                    <input
                                        type="text"
                                        style={{ height: '80px' }}
                                        value={formState.description}
                                        onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                                        placeholder="Describe the redemption process..."
                                    />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Points Threshold</label>
                                        <input
                                            type="number"
                                            value={formState.threshold}
                                            onChange={(e) => setFormState({ ...formState, threshold: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>SAR Value</label>
                                        <input
                                            type="number"
                                            value={formState.value}
                                            onChange={(e) => setFormState({ ...formState, value: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Priority</label>
                                    <input
                                        type="number"
                                        value={formState.priority}
                                        onChange={(e) => setFormState({ ...formState, priority: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="modal-footer-modern">
                                <button className="btn-modern-cancel" onClick={() => setRedemptModalOpen(false)}>Cancel</button>
                                <button className="btn-new-tier" onClick={() => saveLoyaltyRule('redempt')}>
                                    {editingRule ? 'Update Rule' : 'Create Rule'}
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
            <AnimatePresence>
                {ruleModalOpen && (
                    <Modal 
                        onClose={() => setRuleModalOpen(false)} 
                        title={editingRule ? "Edit Rule" : "New Rule"} 
                        className="tier-form-modal"
                    >
                        <div className="modern-form-container">
                            {/* General Info */}
                            <div className="form-section">
                                <div className="form-group">
                                    <label>Rule Name *</label>
                                    <input
                                        type="text"
                                        value={formState.name}
                                        onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                                        placeholder="Enter rule name..."
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Description</label>
                                    <input
                                        type="text"
                                        value={formState.description}
                                        onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                                        placeholder="Describe what this rule does..."
                                    />
                                </div>
                                <div className="form-row">
                                    <div className="form-group flex-2">
                                        <label>Rule Type</label>
                                        <select 
                                            value={formState.type} 
                                            onChange={(e) => setFormState({ ...formState, type: e.target.value })}
                                            className="tester-select"
                                        >
                                            <option value="tier_assign">tier_assign</option>
                                            <option value="earn">earn</option>
                                            <option value="redeem">redeem</option>
                                        </select>
                                    </div>
                                    <div className="form-group flex-1">
                                        <label>Priority (lower = first)</label>
                                        <input
                                            type="number"
                                            value={formState.priority}
                                            onChange={(e) => setFormState({ ...formState, priority: parseInt(e.target.value) })}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* IF CONDITION - Blue Section */}
                            <div className="form-section rule-box if">
                                <h4 className="box-title">IF CONDITION</h4>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Field</label>
                                        <select 
                                            value={formState.condition.field}
                                            onChange={(e) => setFormState({ 
                                                ...formState, 
                                                condition: { ...formState.condition, field: e.target.value } 
                                            })}
                                            className="tester-select"
                                        >
                                            <option value="monthly_spend">Monthly Spend (SAR)</option>
                                            <option value="loyalty_points">Total Loyalty Points</option>
                                            <option value="invoice_total">Invoice Total (SAR)</option>
                                            <option value="lifetime_spend">Lifetime Spend</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Operator</label>
                                        <select 
                                            value={formState.condition.operator}
                                            onChange={(e) => setFormState({ 
                                                ...formState, 
                                                condition: { ...formState.condition, operator: e.target.value } 
                                            })}
                                            className="tester-select"
                                        >
                                            <option value=">=">{">= (Greater or Equal)"}</option>
                                            <option value="<=">{"<= (Less or Equal)"}</option>
                                            <option value="==">{"== (Equals)"}</option>
                                            <option value="between">Between</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Value</label>
                                        <input
                                            type="number"
                                            value={formState.condition.value}
                                            onChange={(e) => setFormState({ 
                                                ...formState, 
                                                condition: { ...formState.condition, value: parseInt(e.target.value) } 
                                            })}
                                        />
                                    </div>
                                    {formState.condition.operator === 'between' && (
                                        <div className="form-group">
                                            <label>Max Value</label>
                                            <input
                                                type="number"
                                                value={formState.condition.maxValue}
                                                onChange={(e) => setFormState({ 
                                                    ...formState, 
                                                    condition: { ...formState.condition, maxValue: parseInt(e.target.value) } 
                                                })}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* THEN ACTION - Green Section */}
                            <div className="form-section rule-box then">
                                <h4 className="box-title">THEN ACTION</h4>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Action</label>
                                        <select 
                                            value={formState.action.type}
                                            onChange={(e) => setFormState({ 
                                                ...formState, 
                                                action: { ...formState.action, type: e.target.value } 
                                            })}
                                            className="tester-select"
                                        >
                                            <option value="assign_tier">Assign Corporate Tier</option>
                                            <option value="award_points">Award Bonus Points</option>
                                            <option value="apply_discount">Apply Discount %</option>
                                            <option value="notify_customer">Notify Customer</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        {formState.action.type === 'assign_tier' ? (
                                            <>
                                                <label>Tier</label>
                                                <select 
                                                    value={formState.action.tierId}
                                                    onChange={(e) => setFormState({ 
                                                        ...formState, 
                                                        action: { ...formState.action, tierId: e.target.value } 
                                                    })}
                                                    className="tester-select"
                                                >
                                                    <option value="">Select tier...</option>
                                                    {tiers.map(t => (
                                                        <option key={t.id} value={t.id}>{t.icon} {t.name}</option>
                                                    ))}
                                                </select>
                                            </>
                                        ) : (
                                            <>
                                                <label>Value</label>
                                                <input
                                                    type="number"
                                                    value={formState.action.value}
                                                    onChange={(e) => setFormState({ 
                                                        ...formState, 
                                                        action: { ...formState.action, value: parseInt(e.target.value) } 
                                                    })}
                                                />
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="form-section no-border">
                                <div className="modern-toggle-item small">
                                    <label className="toggle-v3 small" onClick={(e) => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            checked={formState.status === 'active'}
                                            onChange={(e) => setFormState({ ...formState, status: e.target.checked ? 'active' : 'paused' })}
                                        />
                                        <span className="toggle-v3-track"></span>
                                    </label>
                                    <div className="toggle-label">
                                        <p className="main-label">Active</p>
                                    </div>
                                </div>
                            </div>

                            <div className="modal-footer-modern">
                                <button className="btn-modern-cancel" onClick={() => setRuleModalOpen(false)}>Cancel</button>
                                <button className="btn-new-tier" onClick={saveRule}>Save Rule</button>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}
