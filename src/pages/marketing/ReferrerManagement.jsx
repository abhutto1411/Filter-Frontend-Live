import React, { useMemo, useState } from 'react';
import {
    BarChart3,
    Users,
    ListChecks,
    SlidersHorizontal,
    CreditCard,
    BookOpen,
    UserRound,
    TrendingUp,
    DollarSign,
    CheckCircle2,
    Clock,
    AlertCircle,
    Timer,
    Search,
    Plus,
    Pencil,
    XCircle,
    Info,
    CalendarDays,
    NotebookTabs,
    Scale,
    X,
    ChevronDown,
} from 'lucide-react';
import './MarketingUniversal.css';

const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'referrers', label: 'Referrers', icon: Users },
    { id: 'tracker', label: 'Referral Tracker', icon: ListChecks },
    { id: 'rules', label: 'Commission Rules', icon: SlidersHorizontal },
    { id: 'payout', label: 'Payout Queue', icon: CreditCard },
    { id: 'journals', label: 'Journals & Ledger', icon: BookOpen },
];

const journalTabs = [
    { id: 'entries', label: 'Journal Entries', icon: NotebookTabs },
    { id: 'ledger', label: 'Referrer Ledger', icon: BookOpen },
    { id: 'pl', label: 'P&L Summary', icon: Scale },
];

/* Mock data removed */
const payableSummary = [];
const referrersData = [];
const journalEntries = [];

function formatSar(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 'SAR 0.00';
    return `SAR ${n.toFixed(2)}`;
}

const StatCard = ({ icon: Icon, title, value, sub, tone = 'blue' }) => {
    return (
        <div className="mk-ref-stat-card">
            <div className={`mk-ref-stat-icon mk-ref-icon-${tone}`}>
                <Icon size={18} strokeWidth={2.1} />
            </div>

            <div>
                <div className="mk-ref-stat-title">{title}</div>
                <div className="mk-ref-stat-value">{value}</div>
                <div className="mk-ref-stat-sub">{sub}</div>
            </div>
        </div>
    );
};

const MetricCard = ({ label, value, subtitle, tone }) => {
    return (
        <div className="mk-card mk-ref-metric-card">
            <div className="mk-ref-metric-label">{label}</div>
            <div className={`mk-ref-metric-value ${tone}`}>{value}</div>
            <div className="mk-ref-metric-sub">{subtitle}</div>
        </div>
    );
};

const TabButton = ({ item, active, onClick }) => {
    const Icon = item.icon;

    return (
        <button
            type="button"
            onClick={() => onClick(item.id)}
            className={active ? 'mk-ref-tab active' : 'mk-ref-tab'}
        >
            <Icon size={13} strokeWidth={2} />
            {item.label}
        </button>
    );
};

const JournalTabButton = ({ item, active, onClick }) => {
    const Icon = item.icon;

    return (
        <button
            type="button"
            onClick={() => onClick(item.id)}
            className={active ? 'mk-ref-subtab active' : 'mk-ref-subtab'}
        >
            <Icon size={13} strokeWidth={2} />
            {item.label}
        </button>
    );
};

const SelectField = ({ label, value, onChange, options = [], required = false }) => {
    return (
        <div className="mk-ref-form-group">
            <label className="mk-ref-form-label">
                {label}
                {required && <span> *</span>}
            </label>

            <div className="mk-ref-select-wrap">
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="mk-ref-input mk-ref-select"
                >
                    {options.map((option) => (
                        <option key={option.value || option.label || option} value={option.value || option}>
                            {option.label || option}
                        </option>
                    ))}
                </select>

                <ChevronDown size={15} strokeWidth={2} className="mk-ref-select-icon" />
            </div>
        </div>
    );
};

const InputField = ({
    label,
    value,
    onChange,
    placeholder = '',
    type = 'text',
    required = false,
}) => {
    return (
        <div className="mk-ref-form-group">
            <label className="mk-ref-form-label">
                {label}
                {required && <span> *</span>}
            </label>

            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="mk-ref-input"
            />
        </div>
    );
};

const TextAreaField = ({ label, value, onChange, placeholder = '' }) => {
    return (
        <div className="mk-ref-form-group mk-ref-form-group-full">
            <label className="mk-ref-form-label">{label}</label>

            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="mk-ref-textarea"
            />
        </div>
    );
};

const ModalShell = ({ title, children, onClose }) => {
    return (
        <div className="mk-ref-modal-overlay">
            <div className="mk-ref-modal">
                <div className="mk-ref-modal-header">
                    <h3>{title}</h3>

                    <button type="button" onClick={onClose} className="mk-ref-modal-close">
                        <X size={18} strokeWidth={2.2} />
                    </button>
                </div>

                {children}
            </div>
        </div>
    );
};

export const ReferrerManagement = () => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [journalTab, setJournalTab] = useState('entries');

    const [searchReferrer, setSearchReferrer] = useState('');
    const [trackerSearch, setTrackerSearch] = useState('');

    const [showReferrerModal, setShowReferrerModal] = useState(false);
    const [showRuleModal, setShowRuleModal] = useState(false);
    const [showPayoutModal, setShowPayoutModal] = useState(false);

    const [referrerForm, setReferrerForm] = useState({
        fullName: '',
        category: 'Individual',
        mobile: '',
        email: '',
        nationalId: '',
        status: 'Active',
        bankName: '',
        iban: '',
        notes: '',
    });

    const [ruleForm, setRuleForm] = useState({
        referrer: 'All Referrers',
        category: 'All Categories',
        customerType: 'All Customers',
        service: '',
        commissionType: 'Percentage (%)',
        value: '0',
        effectiveFrom: '',
        effectiveTo: '',
        notes: '',
    });

    const [payoutForm, setPayoutForm] = useState({
        referrer: '',
        amount: '',
        method: 'Bank Transfer',
        coa: '',
        notes: '',
    });

    const overview = useMemo(() => {
        const totalReferrers = referrersData.length;
        const activeReferrers = referrersData.filter((item) => item.status === 'active').length;

        const totalCommissionExpense = payableSummary.reduce(
            (sum, item) => sum + Number(item.totalEarned || 0),
            0,
        );

        const totalPayable = payableSummary.reduce(
            (sum, item) => sum + Number(item.available || 0),
            0,
        );

        const totalPaid = payableSummary.reduce(
            (sum, item) => sum + Number(item.paid || 0),
            0,
        );

        const pendingCommission = payableSummary.reduce(
            (sum, item) => sum + Number(item.pending || 0),
            0,
        );

        return {
            totalReferrers,
            activeReferrers,
            totalCommissionExpense,
            totalPayable,
            totalPaid,
            pendingCommission,
            pendingPayoutRequests: 0,
            referralsUnderReview: 0,
        };
    }, []);

    const filteredReferrers = useMemo(() => {
        const q = searchReferrer.trim().toLowerCase();
        if (!q) return referrersData;

        return referrersData.filter((item) =>
            [item.id, item.name, item.email, item.type, item.mobile, item.status]
                .join(' ')
                .toLowerCase()
                .includes(q),
        );
    }, [searchReferrer]);

    const renderDashboard = () => (
        <>
            <section className="mk-ref-section">
                <h2 className="mk-ref-section-title">Commission Overview</h2>
                <p className="mk-ref-section-subtitle">
                    Real-time summary of referrer commission accounting
                </p>

                <div className="mk-ref-grid-top">
                    <StatCard
                        icon={UserRound}
                        title="Total Referrers"
                        value={overview.totalReferrers}
                        sub={`${overview.activeReferrers} active`}
                        tone="blue"
                    />

                    <StatCard
                        icon={TrendingUp}
                        title="Total Commission Expense"
                        value={formatSar(overview.totalCommissionExpense)}
                        sub="All time accrued"
                        tone="yellow"
                    />

                    <StatCard
                        icon={DollarSign}
                        title="Total Payable (Liability)"
                        value={formatSar(overview.totalPayable)}
                        sub="Available balance"
                        tone="gold"
                    />

                    <StatCard
                        icon={CheckCircle2}
                        title="Total Paid"
                        value={formatSar(overview.totalPaid)}
                        sub="Settled commissions"
                        tone="green"
                    />
                </div>

                <div className="mk-ref-grid-bottom">
                    <StatCard
                        icon={Clock}
                        title="Pending Commission"
                        value={formatSar(overview.pendingCommission)}
                        sub="Awaiting approval"
                        tone="gray"
                    />

                    <StatCard
                        icon={AlertCircle}
                        title="Pending Payout Requests"
                        value={overview.pendingPayoutRequests}
                        sub="Awaiting your approval"
                        tone="red"
                    />

                    <StatCard
                        icon={Timer}
                        title="Referrals Under Review"
                        value={overview.referralsUnderReview}
                        sub="Need approval"
                        tone="purple"
                    />
                </div>
            </section>

            <section className="mk-card mk-ref-table-card">
                <div className="mk-ref-table-title">Referrer Payable Summary</div>

                <table className="mk-ref-table">
                    <thead>
                        <tr>
                            <th>Referrer</th>
                            <th>Type</th>
                            <th>Pending</th>
                            <th>Available</th>
                            <th>Paid</th>
                            <th>Total Earned</th>
                        </tr>
                    </thead>

                    <tbody>
                        {payableSummary.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="mk-ref-empty-table">
                                    No payable summary found
                                </td>
                            </tr>
                        ) : (
                            payableSummary.map((item) => (
                                <tr key={item.id}>
                                    <td className="mk-ref-td-strong">{item.name}</td>
                                    <td>{item.type}</td>
                                    <td className="mk-ref-text-yellow">{formatSar(item.pending)}</td>
                                    <td className="mk-ref-text-green">{formatSar(item.available)}</td>
                                    <td>{formatSar(item.paid)}</td>
                                    <td className="mk-ref-td-total">{formatSar(item.totalEarned)}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </section>
        </>
    );

    const renderReferrers = () => (
        <>
            <div className="mk-ref-toolbar">
                <label className="mk-ref-search">
                    <Search size={14} strokeWidth={2} />
                    <input
                        value={searchReferrer}
                        onChange={(e) => setSearchReferrer(e.target.value)}
                        placeholder="Search referrers..."
                    />
                </label>

                <button
                    type="button"
                    className="mk-ref-primary-btn"
                    onClick={() => setShowReferrerModal(true)}
                >
                    <Plus size={15} strokeWidth={2.4} />
                    Add Referrer
                </button>
            </div>

            <section className="mk-card mk-ref-table-card">
                <table className="mk-ref-table">
                    <thead>
                        <tr>
                            <th>Referrer ID</th>
                            <th>Name</th>
                            <th>Type</th>
                            <th>Mobile</th>
                            <th>Available</th>
                            <th>Pending</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>

                    <tbody>
                        {filteredReferrers.length === 0 ? (
                            <tr>
                                <td colSpan="8" className="mk-ref-empty-table">
                                    No referrers found
                                </td>
                            </tr>
                        ) : (
                            filteredReferrers.map((item) => (
                                <tr key={item.id}>
                                    <td className="mk-ref-id-text">{item.id}</td>

                                    <td>
                                        <div className="mk-ref-name-cell">
                                            <div className="mk-ref-td-strong">{item.name}</div>
                                            <div className="mk-ref-sub-cell">{item.email}</div>
                                        </div>
                                    </td>

                                    <td>{item.type}</td>
                                    <td>{item.mobile}</td>
                                    <td className="mk-ref-text-green">{formatSar(item.available)}</td>
                                    <td className="mk-ref-text-yellow">{formatSar(item.pending)}</td>

                                    <td>
                                        <span className="mk-ref-status-badge active">{item.status}</span>
                                    </td>

                                    <td>
                                        <div className="mk-ref-actions">
                                            <button type="button" className="mk-ref-icon-btn">
                                                <Pencil size={15} strokeWidth={2} />
                                            </button>

                                            <button
                                                type="button"
                                                className="mk-ref-icon-btn mk-ref-icon-btn-danger"
                                            >
                                                <XCircle size={15} strokeWidth={2} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </section>
        </>
    );

    const renderTracker = () => (
        <>
            <div className="mk-ref-toolbar mk-ref-tracker-toolbar">
                <label className="mk-ref-search">
                    <Search size={14} strokeWidth={2} />
                    <input
                        value={trackerSearch}
                        onChange={(e) => setTrackerSearch(e.target.value)}
                        placeholder="Order / Customer..."
                    />
                </label>

                <div className="mk-ref-filter-select">
                    <select defaultValue="All Status">
                        <option>All Status</option>
                        <option>Pending</option>
                        <option>Approved</option>
                        <option>Rejected</option>
                    </select>
                    <ChevronDown size={14} />
                </div>

                <div className="mk-ref-filter-select">
                    <select defaultValue="All Referrers">
                        <option>All Referrers</option>
                    </select>
                    <ChevronDown size={14} />
                </div>
            </div>

            <section className="mk-card mk-ref-table-card">
                <table className="mk-ref-table">
                    <thead>
                        <tr>
                            <th>Order #</th>
                            <th>Customer</th>
                            <th>Referrer</th>
                            <th>Invoice Value</th>
                            <th>Commission</th>
                            <th>Status</th>
                            <th>Date</th>
                            <th>Actions</th>
                        </tr>
                    </thead>

                    <tbody>
                        <tr>
                            <td colSpan="8" className="mk-ref-empty-table mk-ref-empty-large">
                                No referrals found
                            </td>
                        </tr>
                    </tbody>
                </table>
            </section>
        </>
    );

    const renderRules = () => (
        <>
            <div className="mk-ref-section-header">
                <div>
                    <h2 className="mk-ref-section-title">Commission Rules</h2>
                    <p className="mk-ref-section-subtitle">
                        Define how commissions are calculated per referrer, service, or customer type
                    </p>
                </div>

                <button
                    type="button"
                    className="mk-ref-primary-btn"
                    onClick={() => setShowRuleModal(true)}
                >
                    <Plus size={15} strokeWidth={2.4} />
                    Add Rule
                </button>
            </div>

            <div className="mk-ref-info-banner">
                <Info size={15} strokeWidth={2.2} />
                <span>
                    <strong>Rule Priority:</strong> Referrer-specific rules override category rules,
                    which override general rules. Commission is only accrued when a referral is{' '}
                    <strong>Approved.</strong>
                </span>
            </div>

            <section className="mk-card mk-ref-table-card">
                <table className="mk-ref-table">
                    <thead>
                        <tr>
                            <th>Referrer</th>
                            <th>Category</th>
                            <th>Customer Type</th>
                            <th>Service</th>
                            <th>Commission</th>
                            <th>Effective</th>
                            <th>Status</th>
                        </tr>
                    </thead>

                    <tbody>
                        <tr>
                            <td colSpan="7" className="mk-ref-empty-table">
                                No commission rules defined. Add one to start.
                            </td>
                        </tr>
                    </tbody>
                </table>
            </section>
        </>
    );

    const renderPayout = () => (
        <>
            <div className="mk-ref-section-header">
                <div>
                    <h2 className="mk-ref-section-title">Payout Queue</h2>
                    <p className="mk-ref-section-subtitle">
                        Approve and process commission payouts — automatically posts double-entry journal
                    </p>
                </div>

                <button
                    type="button"
                    className="mk-ref-primary-btn"
                    onClick={() => setShowPayoutModal(true)}
                >
                    <Plus size={15} strokeWidth={2.4} />
                    New Payout Request
                </button>
            </div>

            <section className="mk-card mk-ref-table-card">
                <table className="mk-ref-table">
                    <thead>
                        <tr>
                            <th>Payout #</th>
                            <th>Referrer</th>
                            <th>Amount</th>
                            <th>Method</th>
                            <th>Journal Entry</th>
                            <th>Status</th>
                            <th>Date</th>
                            <th>Actions</th>
                        </tr>
                    </thead>

                    <tbody>
                        <tr>
                            <td colSpan="8" className="mk-ref-empty-table">
                                No payout requests
                            </td>
                        </tr>
                    </tbody>
                </table>
            </section>
        </>
    );

    const renderJournals = () => (
        <>
            <div className="mk-ref-subtabs-wrap">
                {journalTabs.map((item) => (
                    <JournalTabButton
                        key={item.id}
                        item={item}
                        active={journalTab === item.id}
                        onClick={setJournalTab}
                    />
                ))}
            </div>

            {journalTab === 'entries' && (
                <>
                    <div className="mk-ref-journal-toolbar">
                        <div className="mk-ref-date-wrap">
                            <input type="text" placeholder="mm/dd/yyyy" className="mk-ref-input mk-ref-date-input" />
                            <CalendarDays size={15} strokeWidth={2} className="mk-ref-date-icon" />
                        </div>

                        <div className="mk-ref-date-wrap">
                            <input type="text" placeholder="mm/dd/yyyy" className="mk-ref-input mk-ref-date-input" />
                            <CalendarDays size={15} strokeWidth={2} className="mk-ref-date-icon" />
                        </div>

                        <div className="mk-ref-count-text">{journalEntries.length} entries</div>
                    </div>

                    {journalEntries.length === 0 ? (
                        <section className="mk-card mk-ref-empty-card">
                            <div className="mk-ref-empty-title">No journal entries found</div>
                            <div className="mk-ref-empty-sub">Commission journal entries will appear here</div>
                        </section>
                    ) : (
                        <div className="mk-ref-journal-list">
                            {journalEntries.map((entry, index) => (
                                <div key={`${entry.id}-${index}`} className="mk-card mk-ref-journal-card">
                                    <div className="mk-ref-journal-head">
                                        <div className="mk-ref-journal-head-left">
                                            <span className="mk-ref-journal-id">{entry.id}</span>
                                            <span className="mk-ref-journal-divider">|</span>
                                            <span className="mk-ref-journal-title">{entry.title}</span>
                                        </div>

                                        <div className="mk-ref-journal-head-right">
                                            <span className="mk-ref-journal-date">{entry.date}</span>
                                            <span className="mk-ref-journal-status">{entry.status}</span>
                                        </div>
                                    </div>

                                    <table className="mk-ref-journal-table">
                                        <thead>
                                            <tr>
                                                <th>Account</th>
                                                <th>Debit (SAR)</th>
                                                <th>Credit (SAR)</th>
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {entry.rows.map((row, rowIndex) => (
                                                <tr key={rowIndex}>
                                                    <td>{row.account}</td>
                                                    <td>{row.debit}</td>
                                                    <td>{row.credit}</td>
                                                </tr>
                                            ))}

                                            <tr className="mk-ref-journal-total-row">
                                                <td>Total</td>
                                                <td>{entry.totalDebit}</td>
                                                <td>{entry.totalCredit}</td>
                                            </tr>
                                        </tbody>
                                    </table>

                                    <div className="mk-ref-balanced-row">√ Balanced Entry</div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {journalTab === 'ledger' && (
                <section className="mk-card mk-ref-table-card">
                    <div className="mk-ref-table-title">Referrer Ledger</div>

                    <table className="mk-ref-table">
                        <thead>
                            <tr>
                                <th>Referrer</th>
                                <th>Date</th>
                                <th>Description</th>
                                <th>Debit</th>
                                <th>Credit</th>
                                <th>Balance</th>
                            </tr>
                        </thead>

                        <tbody>
                            <tr>
                                <td colSpan="6" className="mk-ref-empty-table">
                                    Ledger records will appear here
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </section>
            )}

            {journalTab === 'pl' && (
                <>
                    <div className="mk-ref-metric-grid">
                        <MetricCard
                            label="Commission Expense (P&L)"
                            value={formatSar(overview.totalCommissionExpense)}
                            subtitle="Debit to Referrer Commission Expense"
                            tone="danger"
                        />

                        <MetricCard
                            label="Total Payable (Balance Sheet)"
                            value={formatSar(overview.totalPayable)}
                            subtitle="Liability — Referrer Commission Payable"
                            tone="warning"
                        />

                        <MetricCard
                            label="Total Paid"
                            value={formatSar(overview.totalPaid)}
                            subtitle="Settled commission payments"
                            tone="success"
                        />
                    </div>

                    <section className="mk-card mk-ref-table-card mk-ref-pl-card">
                        <div className="mk-ref-table-title">Referrer-wise Payable Report</div>

                        <table className="mk-ref-table">
                            <thead>
                                <tr>
                                    <th>Referrer</th>
                                    <th>COA Account</th>
                                    <th>Pending</th>
                                    <th>Available (Payable)</th>
                                    <th>Paid</th>
                                    <th>Total Earned</th>
                                </tr>
                            </thead>

                            <tbody>
                                {payableSummary.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="mk-ref-empty-table">
                                            No referrer payable records found
                                        </td>
                                    </tr>
                                ) : (
                                    <>
                                        {payableSummary.map((item) => (
                                            <tr key={item.id}>
                                                <td className="mk-ref-td-strong">{item.name}</td>
                                                <td>{item.coaAccount || '(not set up yet)'}</td>
                                                <td className="mk-ref-text-yellow">{formatSar(item.pending)}</td>
                                                <td className="mk-ref-text-green">{formatSar(item.available)}</td>
                                                <td>{formatSar(item.paid)}</td>
                                                <td className="mk-ref-td-total">{formatSar(item.totalEarned)}</td>
                                            </tr>
                                        ))}

                                        <tr className="mk-ref-total-row">
                                            <td>Total</td>
                                            <td></td>
                                            <td className="mk-ref-text-yellow">{formatSar(overview.pendingCommission)}</td>
                                            <td className="mk-ref-text-green">{formatSar(overview.totalPayable)}</td>
                                            <td>{formatSar(overview.totalPaid)}</td>
                                            <td>{formatSar(overview.totalCommissionExpense)}</td>
                                        </tr>
                                    </>
                                )}
                            </tbody>
                        </table>
                    </section>
                </>
            )}
        </>
    );

    return (
        <div className="mk-page mk-ref-page">
            <div className="mk-ref-top-row">
                <div>
                    <h1 className="mk-ref-page-title">
                        Referrer Management &amp; Commission Accounting
                    </h1>

                    <p className="mk-ref-page-subtitle">
                        Full ERP module — manage referrers, track referrals, auto-post commission journal entries, and process payouts
                    </p>
                </div>

                <div className="mk-ref-accounting-badge">
                    <span />
                    Double-Entry Accounting Active
                </div>
            </div>

            <div className="mk-ref-tabs">
                {tabs.map((item) => (
                    <TabButton
                        key={item.id}
                        item={item}
                        active={activeTab === item.id}
                        onClick={setActiveTab}
                    />
                ))}
            </div>

            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'referrers' && renderReferrers()}
            {activeTab === 'tracker' && renderTracker()}
            {activeTab === 'rules' && renderRules()}
            {activeTab === 'payout' && renderPayout()}
            {activeTab === 'journals' && renderJournals()}

            {showReferrerModal && (
                <ModalShell title="Add New Referrer" onClose={() => setShowReferrerModal(false)}>
                    <div className="mk-ref-form-grid">
                        <InputField
                            label="Full Name"
                            required
                            value={referrerForm.fullName}
                            onChange={(value) => setReferrerForm((prev) => ({ ...prev, fullName: value }))}
                            placeholder="John Doe"
                        />

                        <SelectField
                            label="Category"
                            required
                            value={referrerForm.category}
                            onChange={(value) => setReferrerForm((prev) => ({ ...prev, category: value }))}
                            options={['Individual', 'Corporate', 'Technician', 'Employee']}
                        />

                        <InputField
                            label="Mobile"
                            value={referrerForm.mobile}
                            onChange={(value) => setReferrerForm((prev) => ({ ...prev, mobile: value }))}
                            placeholder="+966..."
                        />

                        <InputField
                            label="Email"
                            value={referrerForm.email}
                            onChange={(value) => setReferrerForm((prev) => ({ ...prev, email: value }))}
                        />

                        <InputField
                            label="National ID"
                            value={referrerForm.nationalId}
                            onChange={(value) => setReferrerForm((prev) => ({ ...prev, nationalId: value }))}
                        />

                        <SelectField
                            label="Status"
                            value={referrerForm.status}
                            onChange={(value) => setReferrerForm((prev) => ({ ...prev, status: value }))}
                            options={['Active', 'Inactive']}
                        />

                        <InputField
                            label="Bank Name"
                            value={referrerForm.bankName}
                            onChange={(value) => setReferrerForm((prev) => ({ ...prev, bankName: value }))}
                        />

                        <InputField
                            label="IBAN"
                            value={referrerForm.iban}
                            onChange={(value) => setReferrerForm((prev) => ({ ...prev, iban: value }))}
                            placeholder="SA..."
                        />

                        <TextAreaField
                            label="Notes"
                            value={referrerForm.notes}
                            onChange={(value) => setReferrerForm((prev) => ({ ...prev, notes: value }))}
                        />
                    </div>

                    <div className="mk-ref-modal-actions">
                        <button
                            type="button"
                            className="mk-ref-secondary-btn"
                            onClick={() => setShowReferrerModal(false)}
                        >
                            Cancel
                        </button>

                        <button
                            type="button"
                            className="mk-ref-primary-btn"
                            onClick={() => setShowReferrerModal(false)}
                        >
                            Save
                        </button>
                    </div>
                </ModalShell>
            )}

            {showRuleModal && (
                <ModalShell title="New Commission Rule" onClose={() => setShowRuleModal(false)}>
                    <div className="mk-ref-form-grid">
                        <SelectField
                            label="Specific Referrer (optional)"
                            value={ruleForm.referrer}
                            onChange={(value) => setRuleForm((prev) => ({ ...prev, referrer: value }))}
                            options={['All Referrers']}
                        />

                        <SelectField
                            label="Referrer Category"
                            value={ruleForm.category}
                            onChange={(value) => setRuleForm((prev) => ({ ...prev, category: value }))}
                            options={['All Categories']}
                        />

                        <SelectField
                            label="Customer Type"
                            value={ruleForm.customerType}
                            onChange={(value) => setRuleForm((prev) => ({ ...prev, customerType: value }))}
                            options={['All Customers']}
                        />

                        <InputField
                            label="Service (optional)"
                            value={ruleForm.service}
                            onChange={(value) => setRuleForm((prev) => ({ ...prev, service: value }))}
                            placeholder="Oil Change, Car Wash..."
                        />

                        <SelectField
                            label="Commission Type"
                            value={ruleForm.commissionType}
                            onChange={(value) => setRuleForm((prev) => ({ ...prev, commissionType: value }))}
                            options={['Percentage (%)']}
                        />

                        <InputField
                            label="Value (%)"
                            value={ruleForm.value}
                            onChange={(value) => setRuleForm((prev) => ({ ...prev, value }))}
                            placeholder="0"
                        />

                        <InputField
                            label="Effective From"
                            value={ruleForm.effectiveFrom}
                            onChange={(value) => setRuleForm((prev) => ({ ...prev, effectiveFrom: value }))}
                            placeholder="mm/dd/yyyy"
                        />

                        <InputField
                            label="Effective To"
                            value={ruleForm.effectiveTo}
                            onChange={(value) => setRuleForm((prev) => ({ ...prev, effectiveTo: value }))}
                            placeholder="mm/dd/yyyy"
                        />

                        <TextAreaField
                            label="Notes"
                            value={ruleForm.notes}
                            onChange={(value) => setRuleForm((prev) => ({ ...prev, notes: value }))}
                        />
                    </div>

                    <div className="mk-ref-modal-actions">
                        <button
                            type="button"
                            className="mk-ref-secondary-btn"
                            onClick={() => setShowRuleModal(false)}
                        >
                            Cancel
                        </button>

                        <button
                            type="button"
                            className="mk-ref-primary-btn"
                            onClick={() => setShowRuleModal(false)}
                        >
                            Save Rule
                        </button>
                    </div>
                </ModalShell>
            )}

            {showPayoutModal && (
                <ModalShell title="New Payout Request" onClose={() => setShowPayoutModal(false)}>
                    <div className="mk-ref-form-grid">
                        <SelectField
                            label="Referrer"
                            required
                            value={payoutForm.referrer}
                            onChange={(value) => setPayoutForm((prev) => ({ ...prev, referrer: value }))}
                            options={[
                                { label: 'Select referrer...', value: '' },
                            ]}
                        />

                        <InputField
                            label="Amount (SAR)"
                            required
                            value={payoutForm.amount}
                            onChange={(value) => setPayoutForm((prev) => ({ ...prev, amount: value }))}
                            placeholder="0.00"
                        />

                        <SelectField
                            label="Payment Method"
                            value={payoutForm.method}
                            onChange={(value) => setPayoutForm((prev) => ({ ...prev, method: value }))}
                            options={['Bank Transfer', 'Cash', 'Cheque']}
                        />

                        <SelectField
                            label="Payment Account (COA)"
                            value={payoutForm.coa}
                            onChange={(value) => setPayoutForm((prev) => ({ ...prev, coa: value }))}
                            options={[
                                { label: 'Select account...', value: '' },
                            ]}
                        />

                        <TextAreaField
                            label="Notes"
                            value={payoutForm.notes}
                            onChange={(value) => setPayoutForm((prev) => ({ ...prev, notes: value }))}
                        />
                    </div>

                    <div className="mk-ref-modal-actions">
                        <button
                            type="button"
                            className="mk-ref-secondary-btn"
                            onClick={() => setShowPayoutModal(false)}
                        >
                            Cancel
                        </button>

                        <button
                            type="button"
                            className="mk-ref-primary-btn"
                            onClick={() => setShowPayoutModal(false)}
                        >
                            Create Request
                        </button>
                    </div>
                </ModalShell>
            )}
        </div>
    );
};

export default ReferrerManagement;