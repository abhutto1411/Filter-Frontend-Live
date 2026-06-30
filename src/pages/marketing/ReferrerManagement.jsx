import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
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
  ChevronDown,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import {
  marketingDeleteReferrer,
  marketingGetReferralCommissionsDashboard,
  marketingGetReferralManagementDashboard,
  marketingListReferrers,
} from '../../services/superAdminMarketingApi';
import { marketingSectionPath } from './marketingRouteUtils';
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

function formatSar(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'SAR 0.00';
  return `SAR ${n.toFixed(2)}`;
}

function humanize(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function normalizeStatus(value) {
  const raw = String(value || 'active').toLowerCase();
  if (raw === 'active') return 'active';
  if (raw === 'inactive') return 'inactive';
  if (raw === 'pending') return 'pending';
  if (raw === 'suspended') return 'suspended';
  return raw;
}

function normalizeReferrer(row) {
  return {
    id: String(row.id ?? row._id ?? row.referrerId ?? ''),
    name:
      row.name ||
      row.fullName ||
      row.full_name ||
      row.referrerName ||
      row.referrer_name ||
      'Referrer',
    type:
      row.type ||
      row.category ||
      row.referrerType ||
      row.referrer_type ||
      'Individual',
    mobile:
      row.mobile ||
      row.phone ||
      row.phoneNumber ||
      row.phone_number ||
      '',
    email: row.email || '',
    nationalId: row.nationalId || row.national_id || '',
    bankName: row.bankName || row.bank_name || '',
    iban: row.iban || row.IBAN || '',
    notes: row.notes || '',
    status: normalizeStatus(row.status),
    available: Number(row.available ?? row.availableCommission ?? row.available_commission ?? 0),
    pending: Number(row.pending ?? row.pendingCommission ?? row.pending_commission ?? 0),
    paid: Number(row.paid ?? row.paidCommission ?? row.paid_commission ?? 0),
    totalEarned: Number(row.totalEarned ?? row.total_earned ?? row.totalCommission ?? 0),
  };
}

function extractReferrers(payload) {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.referrers)
      ? payload.referrers
      : Array.isArray(payload?.recentReferrers)
        ? payload.recentReferrers
        : Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload?.data?.referrers)
              ? payload.data.referrers
              : [];

  return rows.map(normalizeReferrer);
}

function normalizePayable(row) {
  const referrer = row.referrer || row.referrerPerson || {};

  return {
    id: String(row.id ?? row.referrerId ?? row.referrer_id ?? referrer.id ?? ''),
    name:
      row.name ||
      row.referrerName ||
      row.referrer_name ||
      referrer.name ||
      referrer.fullName ||
      'Referrer',
    type:
      row.type ||
      row.category ||
      row.referrerType ||
      row.referrer_type ||
      referrer.category ||
      'Individual',
    pending: Number(row.pending ?? row.pendingCommission ?? row.pending_commission ?? 0),
    available: Number(row.available ?? row.availableForPayout ?? row.available_for_payout ?? 0),
    paid: Number(row.paid ?? row.paidCommission ?? row.paid_commission ?? 0),
    totalEarned: Number(row.totalEarned ?? row.total_earned ?? row.totalCommission ?? 0),
    coaAccount: row.coaAccount || row.coa_account || row.payableAccount || '',
  };
}

function extractPayableRows(payload) {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.rows)
      ? payload.rows
      : Array.isArray(payload?.referrers)
        ? payload.referrers
        : Array.isArray(payload?.payableSummary)
          ? payload.payableSummary
          : Array.isArray(payload?.items)
            ? payload.items
            : Array.isArray(payload?.data?.rows)
              ? payload.data.rows
              : Array.isArray(payload?.data?.referrers)
                ? payload.data.referrers
                : [];

  return rows.map(normalizePayable);
}

function normalizeReferral(row) {
  return {
    id: String(row.id ?? row.referralId ?? row.referral_id ?? ''),
    orderNo: row.orderNo || row.order_no || row.invoiceNo || row.invoice_no || row.id || '—',
    customer: row.customerName || row.customer_name || row.customer || row.leadName || '—',
    referrer: row.referrerName || row.referrer_name || row.referrer || '—',
    invoiceValue: Number(row.invoiceValue ?? row.invoice_value ?? row.amount ?? 0),
    commission: Number(row.commission ?? row.commissionAmount ?? row.commission_amount ?? 0),
    status: row.status || 'pending',
    date: row.date || row.createdAt || row.created_at || '',
  };
}

function extractReferrals(payload) {
  const rows = Array.isArray(payload?.recentReferrals)
    ? payload.recentReferrals
    : Array.isArray(payload?.referrals)
      ? payload.referrals
      : Array.isArray(payload?.data?.recentReferrals)
        ? payload.data.recentReferrals
        : [];

  return rows.map(normalizeReferral);
}

const StatCard = ({ icon: Icon, title, value, sub, tone = 'blue' }) => (
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

const MetricCard = ({ label, value, subtitle, tone }) => (
  <div className="mk-card mk-ref-metric-card">
    <div className="mk-ref-metric-label">{label}</div>
    <div className={`mk-ref-metric-value ${tone}`}>{value}</div>
    <div className="mk-ref-metric-sub">{subtitle}</div>
  </div>
);

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

const SelectField = ({ label, value, onChange, options = [], required = false }) => (
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

const InputField = ({
  label,
  value,
  onChange,
  placeholder = '',
  type = 'text',
  required = false,
}) => (
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

const TextAreaField = ({ label, value, onChange, placeholder = '' }) => (
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

export const ReferrerManagement = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const basePath = marketingSectionPath(location.pathname, 'referrer-management');

  const [activeTab, setActiveTab] = useState('dashboard');
  const [journalTab, setJournalTab] = useState('entries');

  const [searchReferrer, setSearchReferrer] = useState('');
  const [trackerSearch, setTrackerSearch] = useState('');

  const [referrersData, setReferrersData] = useState([]);
  const [payableSummary, setPayableSummary] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [journalEntries] = useState([]);

  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && tabs.some((item) => item.id === tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const loadReferrerManagement = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [dashboardRes, referrersRes, commissionsRes] = await Promise.all([
        marketingGetReferralManagementDashboard({
          recentReferrals: 20,
          recentReferrers: 20,
        }).catch(() => null),

        marketingListReferrers({
          limit: 100,
          offset: 0,
          status: 'all',
        }).catch(() => null),

        marketingGetReferralCommissionsDashboard({
          tableLimit: 100,
        }).catch(() => null),
      ]);

      const referrers = extractReferrers(referrersRes);
      const recentReferrers = extractReferrers(dashboardRes);
      const payable = extractPayableRows(commissionsRes);
      const recentReferrals = extractReferrals(dashboardRes);

      setReferrersData(referrers.length ? referrers : recentReferrers);
      setPayableSummary(payable);
      setReferrals(recentReferrals);
    } catch (err) {
      setError(err?.message || 'Failed to load referrer management.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReferrerManagement();
  }, [loadReferrerManagement]);

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
      referralsUnderReview: referrals.filter((item) =>
        ['pending', 'under_review'].includes(String(item.status || '').toLowerCase()),
      ).length,
    };
  }, [referrersData, payableSummary, referrals]);

  const filteredReferrers = useMemo(() => {
    const q = searchReferrer.trim().toLowerCase();
    if (!q) return referrersData;

    return referrersData.filter((item) =>
      [item.id, item.name, item.email, item.type, item.mobile, item.status]
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [searchReferrer, referrersData]);

  const filteredReferrals = useMemo(() => {
    const q = trackerSearch.trim().toLowerCase();
    if (!q) return referrals;

    return referrals.filter((item) =>
      [item.orderNo, item.customer, item.referrer, item.status]
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [trackerSearch, referrals]);

  const openCreateReferrer = () => navigate(`${basePath}/referrers/new`);

  const openEditReferrer = (item) => navigate(`${basePath}/referrers/${item.id}/edit`);

  const deleteReferrer = async (item) => {
    if (!window.confirm(`Delete ${item.name}?`)) return;

    try {
      setActionLoadingId(item.id);
      await marketingDeleteReferrer(item.id);
      await loadReferrerManagement();
    } catch (err) {
      alert(err?.message || 'Failed to delete referrer.');
    } finally {
      setActionLoadingId('');
    }
  };

  const renderDashboard = () => (
    <>
      <section className="mk-ref-section">
        <h2 className="mk-ref-section-title">Commission Overview</h2>
        <p className="mk-ref-section-subtitle">
          Real-time summary of referrer commission accounting
        </p>

        <div className="mk-ref-grid-top">
          <StatCard icon={UserRound} title="Total Referrers" value={overview.totalReferrers} sub={`${overview.activeReferrers} active`} tone="blue" />
          <StatCard icon={TrendingUp} title="Total Commission Expense" value={formatSar(overview.totalCommissionExpense)} sub="All time accrued" tone="yellow" />
          <StatCard icon={DollarSign} title="Total Payable (Liability)" value={formatSar(overview.totalPayable)} sub="Available balance" tone="gold" />
          <StatCard icon={CheckCircle2} title="Total Paid" value={formatSar(overview.totalPaid)} sub="Settled commissions" tone="green" />
        </div>

        <div className="mk-ref-grid-bottom">
          <StatCard icon={Clock} title="Pending Commission" value={formatSar(overview.pendingCommission)} sub="Awaiting approval" tone="gray" />
          <StatCard icon={AlertCircle} title="Pending Payout Requests" value={overview.pendingPayoutRequests} sub="Awaiting your approval" tone="red" />
          <StatCard icon={Timer} title="Referrals Under Review" value={overview.referralsUnderReview} sub="Need approval" tone="purple" />
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
                <tr key={item.id || item.name}>
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

        <button type="button" className="mk-ref-primary-btn" onClick={openCreateReferrer}>
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
              filteredReferrers.map((item) => {
                const busy = actionLoadingId === item.id;

                return (
                  <tr key={item.id}>
                    <td className="mk-ref-id-text">{item.id}</td>

                    <td>
                      <div className="mk-ref-name-cell">
                        <div className="mk-ref-td-strong">{item.name}</div>
                        <div className="mk-ref-sub-cell">{item.email || '—'}</div>
                      </div>
                    </td>

                    <td>{item.type}</td>
                    <td>{item.mobile || '—'}</td>
                    <td className="mk-ref-text-green">{formatSar(item.available)}</td>
                    <td className="mk-ref-text-yellow">{formatSar(item.pending)}</td>

                    <td>
                      <span className={`mk-ref-status-badge ${item.status}`}>
                        {item.status}
                      </span>
                    </td>

                    <td>
                      <div className="mk-ref-actions">
                        <button
                          type="button"
                          className="mk-ref-icon-btn"
                          disabled={busy}
                          onClick={() => openEditReferrer(item)}
                        >
                          <Pencil size={15} strokeWidth={2} />
                        </button>

                        <button
                          type="button"
                          className="mk-ref-icon-btn mk-ref-icon-btn-danger"
                          disabled={busy}
                          onClick={() => deleteReferrer(item)}
                        >
                          <Trash2 size={15} strokeWidth={2} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
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
            {filteredReferrals.length === 0 ? (
              <tr>
                <td colSpan="8" className="mk-ref-empty-table mk-ref-empty-large">
                  No referrals found
                </td>
              </tr>
            ) : (
              filteredReferrals.map((item) => (
                <tr key={item.id || item.orderNo}>
                  <td>{item.orderNo}</td>
                  <td>{item.customer}</td>
                  <td>{item.referrer}</td>
                  <td>{formatSar(item.invoiceValue)}</td>
                  <td>{formatSar(item.commission)}</td>
                  <td>{item.status}</td>
                  <td>{item.date ? new Date(item.date).toLocaleDateString() : '—'}</td>
                  <td>—</td>
                </tr>
              ))
            )}
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

        <button type="button" className="mk-ref-primary-btn" onClick={() => navigate(`${basePath}/rules/new`)}>
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
                No commission rules defined. Settings endpoint exists, but rule CRUD is not connected yet.
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
            Approve and process commission payouts — payout API is not exposed yet
          </p>
        </div>

        <button type="button" className="mk-ref-primary-btn" onClick={() => navigate(`${basePath}/payouts/new`)}>
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
        <section className="mk-card mk-ref-empty-card">
          <div className="mk-ref-empty-title">No journal entries found</div>
          <div className="mk-ref-empty-sub">Commission journal entries will appear here</div>
        </section>
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
                  payableSummary.map((item) => (
                    <tr key={item.id || item.name}>
                      <td className="mk-ref-td-strong">{item.name}</td>
                      <td>{item.coaAccount || '(not set up yet)'}</td>
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

        <button
          type="button"
          className="mk-btn-secondary"
          onClick={loadReferrerManagement}
          disabled={loading}
        >
          <RefreshCw size={15} />
          {loading ? 'Loading...' : 'Refresh'}
        </button>

        <div className="mk-ref-accounting-badge">
          <span />
          Double-Entry Accounting Active
        </div>
      </div>

      {error ? <div className="mk-error-text">{error}</div> : null}

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

    </div>
  );
};

export default ReferrerManagement;