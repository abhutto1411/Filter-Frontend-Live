import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
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
  Info,
  NotebookTabs,
  Scale,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import {
  marketingDeleteReferrer,
  marketingGetReferralCommissionsDashboard,
  marketingGetReferralManagementDashboard,
  marketingListReferrers,
} from '../../services/superAdminMarketingApi';
import {
  mktRefCategoryLabel,
  mktRefFormatSar,
  mktRefStatusLabel,
  mktRefT,
} from '../../utils/marketingReferrersI18n';
import { marketingSectionPath } from './marketingRouteUtils';
import './MarketingUniversal.css';

const TAB_IDS = [
  { id: 'dashboard', icon: BarChart3, labelKey: 'tab.dashboard' },
  { id: 'referrers', icon: Users, labelKey: 'tab.referrers' },
  { id: 'tracker', icon: ListChecks, labelKey: 'tab.tracker' },
  { id: 'rules', icon: SlidersHorizontal, labelKey: 'tab.rules' },
  { id: 'payout', icon: CreditCard, labelKey: 'tab.payout' },
  { id: 'journals', icon: BookOpen, labelKey: 'tab.journals' },
];

const JOURNAL_TAB_IDS = [
  { id: 'entries', icon: NotebookTabs, labelKey: 'jtab.entries' },
  { id: 'ledger', icon: BookOpen, labelKey: 'jtab.ledger' },
  { id: 'pl', icon: Scale, labelKey: 'jtab.pl' },
];

function normalizeStatus(value) {
  const raw = String(value || 'active').toLowerCase();
  if (raw === 'active') return 'active';
  if (raw === 'inactive') return 'inactive';
  if (raw === 'pending') return 'pending';
  if (raw === 'suspended') return 'suspended';
  return raw;
}

function normalizeReferrer(row, locale) {
  return {
    id: String(row.id ?? row._id ?? row.referrerId ?? ''),
    name:
      row.name ||
      row.fullName ||
      row.full_name ||
      row.referrerName ||
      row.referrer_name ||
      mktRefT(locale, 'fallback.referrer'),
    type:
      row.type ||
      row.category ||
      row.referrerType ||
      row.referrer_type ||
      mktRefT(locale, 'fallback.individual'),
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

function extractReferrers(payload, locale) {
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

  return rows.map((row) => normalizeReferrer(row, locale));
}

function normalizePayable(row, locale) {
  const referrer = row.referrer || row.referrerPerson || {};

  return {
    id: String(row.id ?? row.referrerId ?? row.referrer_id ?? referrer.id ?? ''),
    name:
      row.name ||
      row.referrerName ||
      row.referrer_name ||
      referrer.name ||
      referrer.fullName ||
      mktRefT(locale, 'fallback.referrer'),
    type:
      row.type ||
      row.category ||
      row.referrerType ||
      row.referrer_type ||
      referrer.category ||
      mktRefT(locale, 'fallback.individual'),
    pending: Number(row.pending ?? row.pendingCommission ?? row.pending_commission ?? 0),
    available: Number(row.available ?? row.availableForPayout ?? row.available_for_payout ?? 0),
    paid: Number(row.paid ?? row.paidCommission ?? row.paid_commission ?? 0),
    totalEarned: Number(row.totalEarned ?? row.total_earned ?? row.totalCommission ?? 0),
    coaAccount: row.coaAccount || row.coa_account || row.payableAccount || '',
  };
}

function extractPayableRows(payload, locale) {
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

  return rows.map((row) => normalizePayable(row, locale));
}

function normalizeReferral(row, locale) {
  return {
    id: String(row.id ?? row.referralId ?? row.referral_id ?? ''),
    orderNo: row.orderNo || row.order_no || row.invoiceNo || row.invoice_no || row.id || mktRefT(locale, 'dash'),
    customer: row.customerName || row.customer_name || row.customer || row.leadName || mktRefT(locale, 'dash'),
    referrer: row.referrerName || row.referrer_name || row.referrer || mktRefT(locale, 'dash'),
    invoiceValue: Number(row.invoiceValue ?? row.invoice_value ?? row.amount ?? 0),
    commission: Number(row.commission ?? row.commissionAmount ?? row.commission_amount ?? 0),
    status: row.status || 'pending',
    date: row.date || row.createdAt || row.created_at || '',
  };
}

function extractReferrals(payload, locale) {
  const rows = Array.isArray(payload?.recentReferrals)
    ? payload.recentReferrals
    : Array.isArray(payload?.referrals)
      ? payload.referrals
      : Array.isArray(payload?.data?.recentReferrals)
        ? payload.data.recentReferrals
        : [];

  return rows.map((row) => normalizeReferral(row, locale));
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

const TabButton = ({ item, active, onClick, label }) => {
  const Icon = item.icon;

  return (
    <button
      type="button"
      onClick={() => onClick(item.id)}
      className={active ? 'mk-ref-tab active' : 'mk-ref-tab'}
    >
      <Icon size={13} strokeWidth={2} />
      {label}
    </button>
  );
};

const JournalTabButton = ({ item, active, onClick, label }) => {
  const Icon = item.icon;

  return (
    <button
      type="button"
      onClick={() => onClick(item.id)}
      className={active ? 'mk-ref-subtab active' : 'mk-ref-subtab'}
    >
      <Icon size={13} strokeWidth={2} />
      {label}
    </button>
  );
};

export const ReferrerManagement = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const outletCtx = useOutletContext() || {};
  const locale =
    outletCtx.locale ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('marketing-locale') : null) ||
    'en';
  const t = useCallback((key, vars) => mktRefT(locale, key, vars), [locale]);
  const [searchParams] = useSearchParams();
  const basePath = marketingSectionPath(location.pathname, 'referrer-management');

  const [activeTab, setActiveTab] = useState('dashboard');
  const [journalTab, setJournalTab] = useState('entries');

  const [searchReferrer, setSearchReferrer] = useState('');
  const [trackerSearch, setTrackerSearch] = useState('');

  const [referrersData, setReferrersData] = useState([]);
  const [payableSummary, setPayableSummary] = useState([]);
  const [referrals, setReferrals] = useState([]);

  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && TAB_IDS.some((item) => item.id === tab)) {
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

      const referrers = extractReferrers(referrersRes, locale);
      const recentReferrers = extractReferrers(dashboardRes, locale);
      const payable = extractPayableRows(commissionsRes, locale);
      const recentReferrals = extractReferrals(dashboardRes, locale);

      setReferrersData(referrers.length ? referrers : recentReferrers);
      setPayableSummary(payable);
      setReferrals(recentReferrals);
    } catch (err) {
      setError(err?.message || t('err.load'));
    } finally {
      setLoading(false);
    }
  }, [locale, t]);

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
    if (!window.confirm(t('confirm.delete', { name: item.name }))) return;

    try {
      setActionLoadingId(item.id);
      await marketingDeleteReferrer(item.id);
      await loadReferrerManagement();
    } catch (err) {
      alert(err?.message || t('err.delete'));
    } finally {
      setActionLoadingId('');
    }
  };

  const formatSar = (value) => mktRefFormatSar(locale, value);
  const dateLocale = locale === 'ar' ? 'ar-SA' : undefined;

  const renderDashboard = () => (
    <>
      <section className="mk-ref-section">
        <h2 className="mk-ref-section-title">{t('dash.overview')}</h2>
        <p className="mk-ref-section-subtitle">{t('dash.overviewSub')}</p>

        <div className="mk-ref-grid-top">
          <StatCard
            icon={UserRound}
            title={t('stat.totalReferrers')}
            value={overview.totalReferrers}
            sub={t('stat.activeSub', { n: overview.activeReferrers })}
            tone="blue"
          />
          <StatCard
            icon={TrendingUp}
            title={t('stat.commissionExpense')}
            value={formatSar(overview.totalCommissionExpense)}
            sub={t('stat.allTime')}
            tone="yellow"
          />
          <StatCard
            icon={DollarSign}
            title={t('stat.totalPayable')}
            value={formatSar(overview.totalPayable)}
            sub={t('stat.availableBal')}
            tone="gold"
          />
          <StatCard
            icon={CheckCircle2}
            title={t('stat.totalPaid')}
            value={formatSar(overview.totalPaid)}
            sub={t('stat.settled')}
            tone="green"
          />
        </div>

        <div className="mk-ref-grid-bottom">
          <StatCard
            icon={Clock}
            title={t('stat.pendingCommission')}
            value={formatSar(overview.pendingCommission)}
            sub={t('stat.awaitingApproval')}
            tone="gray"
          />
          <StatCard
            icon={AlertCircle}
            title={t('stat.pendingPayouts')}
            value={overview.pendingPayoutRequests}
            sub={t('stat.awaitingYourApproval')}
            tone="red"
          />
          <StatCard
            icon={Timer}
            title={t('stat.underReview')}
            value={overview.referralsUnderReview}
            sub={t('stat.needApproval')}
            tone="purple"
          />
        </div>
      </section>

      <section className="mk-card mk-ref-table-card">
        <div className="mk-ref-table-title">{t('dash.payableTitle')}</div>

        <table className="mk-ref-table">
          <thead>
            <tr>
              <th>{t('th.referrer')}</th>
              <th>{t('th.type')}</th>
              <th>{t('th.pending')}</th>
              <th>{t('th.available')}</th>
              <th>{t('th.paid')}</th>
              <th>{t('th.totalEarned')}</th>
            </tr>
          </thead>

          <tbody>
            {payableSummary.length === 0 ? (
              <tr>
                <td colSpan="6" className="mk-ref-empty-table">
                  {t('empty.payable')}
                </td>
              </tr>
            ) : (
              payableSummary.map((item) => (
                <tr key={item.id || item.name}>
                  <td className="mk-ref-td-strong">{item.name}</td>
                  <td>{mktRefCategoryLabel(locale, item.type)}</td>
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
            placeholder={t('search.referrers')}
          />
        </label>

        <button type="button" className="mk-ref-primary-btn" onClick={openCreateReferrer}>
          <Plus size={15} strokeWidth={2.4} />
          {t('btn.addReferrer')}
        </button>
      </div>

      <section className="mk-card mk-ref-table-card">
        <table className="mk-ref-table">
          <thead>
            <tr>
              <th>{t('th.referrerId')}</th>
              <th>{t('th.name')}</th>
              <th>{t('th.type')}</th>
              <th>{t('th.mobile')}</th>
              <th>{t('th.available')}</th>
              <th>{t('th.pending')}</th>
              <th>{t('th.status')}</th>
              <th>{t('th.actions')}</th>
            </tr>
          </thead>

          <tbody>
            {filteredReferrers.length === 0 ? (
              <tr>
                <td colSpan="8" className="mk-ref-empty-table">
                  {t('empty.referrers')}
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
                        <div className="mk-ref-sub-cell">{item.email || t('dash')}</div>
                      </div>
                    </td>

                    <td>{mktRefCategoryLabel(locale, item.type)}</td>
                    <td>{item.mobile || t('dash')}</td>
                    <td className="mk-ref-text-green">{formatSar(item.available)}</td>
                    <td className="mk-ref-text-yellow">{formatSar(item.pending)}</td>

                    <td>
                      <span className={`mk-ref-status-badge ${item.status}`}>
                        {mktRefStatusLabel(locale, item.status)}
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
            placeholder={t('search.tracker')}
          />
        </label>
      </div>

      <section className="mk-card mk-ref-table-card">
        <table className="mk-ref-table">
          <thead>
            <tr>
              <th>{t('th.orderNo')}</th>
              <th>{t('th.customer')}</th>
              <th>{t('th.referrer')}</th>
              <th>{t('th.invoiceValue')}</th>
              <th>{t('th.commission')}</th>
              <th>{t('th.status')}</th>
              <th>{t('th.date')}</th>
              <th>{t('th.actions')}</th>
            </tr>
          </thead>

          <tbody>
            {filteredReferrals.length === 0 ? (
              <tr>
                <td colSpan="8" className="mk-ref-empty-table mk-ref-empty-large">
                  {t('empty.referrals')}
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
                  <td>{mktRefStatusLabel(locale, item.status)}</td>
                  <td>
                    {item.date
                      ? new Date(item.date).toLocaleDateString(dateLocale)
                      : t('dash')}
                  </td>
                  <td>{t('dash')}</td>
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
          <h2 className="mk-ref-section-title">{t('rules.title')}</h2>
          <p className="mk-ref-section-subtitle">{t('rules.subtitle')}</p>
        </div>

        <button
          type="button"
          className="mk-ref-primary-btn"
          onClick={() => navigate(`${basePath}/rules/new`)}
        >
          <Plus size={15} strokeWidth={2.4} />
          {t('btn.addRule')}
        </button>
      </div>

      <div className="mk-ref-info-banner">
        <Info size={15} strokeWidth={2.2} />
        <span>
          <strong>{t('rules.priority')}</strong>
          {t('rules.priorityBody')}
          <strong>{t('rules.approved')}</strong>
        </span>
      </div>

      <section className="mk-card mk-ref-table-card">
        <table className="mk-ref-table">
          <thead>
            <tr>
              <th>{t('th.referrer')}</th>
              <th>{t('th.category')}</th>
              <th>{t('th.customerType')}</th>
              <th>{t('th.service')}</th>
              <th>{t('th.commission')}</th>
              <th>{t('th.effective')}</th>
              <th>{t('th.status')}</th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td colSpan="7" className="mk-ref-empty-table">
                {t('empty.rules')}
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
          <h2 className="mk-ref-section-title">{t('payout.title')}</h2>
          <p className="mk-ref-section-subtitle">{t('payout.subtitle')}</p>
        </div>

        <button
          type="button"
          className="mk-ref-primary-btn"
          onClick={() => navigate(`${basePath}/payouts/new`)}
        >
          <Plus size={15} strokeWidth={2.4} />
          {t('btn.newPayout')}
        </button>
      </div>

      <section className="mk-card mk-ref-table-card">
        <table className="mk-ref-table">
          <thead>
            <tr>
              <th>{t('th.payoutNo')}</th>
              <th>{t('th.referrer')}</th>
              <th>{t('th.amount')}</th>
              <th>{t('th.method')}</th>
              <th>{t('th.journalEntry')}</th>
              <th>{t('th.status')}</th>
              <th>{t('th.date')}</th>
              <th>{t('th.actions')}</th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td colSpan="8" className="mk-ref-empty-table">
                {t('empty.payouts')}
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
        {JOURNAL_TAB_IDS.map((item) => (
          <JournalTabButton
            key={item.id}
            item={item}
            label={t(item.labelKey)}
            active={journalTab === item.id}
            onClick={setJournalTab}
          />
        ))}
      </div>

      {journalTab === 'entries' && (
        <section className="mk-card mk-ref-empty-card">
          <div className="mk-ref-empty-title">{t('journals.emptyEntries')}</div>
          <div className="mk-ref-empty-sub">{t('journals.emptyEntriesSub')}</div>
        </section>
      )}

      {journalTab === 'ledger' && (
        <section className="mk-card mk-ref-table-card">
          <div className="mk-ref-table-title">{t('journals.ledgerTitle')}</div>

          <table className="mk-ref-table">
            <thead>
              <tr>
                <th>{t('th.referrer')}</th>
                <th>{t('th.date')}</th>
                <th>{t('th.description')}</th>
                <th>{t('th.debit')}</th>
                <th>{t('th.credit')}</th>
                <th>{t('th.balance')}</th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td colSpan="6" className="mk-ref-empty-table">
                  {t('empty.ledger')}
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
              label={t('pl.expense')}
              value={formatSar(overview.totalCommissionExpense)}
              subtitle={t('pl.expenseSub')}
              tone="danger"
            />

            <MetricCard
              label={t('pl.payable')}
              value={formatSar(overview.totalPayable)}
              subtitle={t('pl.payableSub')}
              tone="warning"
            />

            <MetricCard
              label={t('pl.paid')}
              value={formatSar(overview.totalPaid)}
              subtitle={t('pl.paidSub')}
              tone="success"
            />
          </div>

          <section className="mk-card mk-ref-table-card mk-ref-pl-card">
            <div className="mk-ref-table-title">{t('pl.reportTitle')}</div>

            <table className="mk-ref-table">
              <thead>
                <tr>
                  <th>{t('th.referrer')}</th>
                  <th>{t('th.coa')}</th>
                  <th>{t('th.pending')}</th>
                  <th>{t('th.availablePayable')}</th>
                  <th>{t('th.paid')}</th>
                  <th>{t('th.totalEarned')}</th>
                </tr>
              </thead>

              <tbody>
                {payableSummary.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="mk-ref-empty-table">
                      {t('empty.pl')}
                    </td>
                  </tr>
                ) : (
                  payableSummary.map((item) => (
                    <tr key={item.id || item.name}>
                      <td className="mk-ref-td-strong">{item.name}</td>
                      <td>{item.coaAccount || t('coa.notSet')}</td>
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
    <div className="mk-page mk-ref-page" dir={locale === 'ar' ? 'rtl' : undefined}>
      <div className="mk-ref-top-row">
        <div>
          <h1 className="mk-ref-page-title">{t('page.title')}</h1>

          <p className="mk-ref-page-subtitle">{t('page.subtitle')}</p>
        </div>

        <button
          type="button"
          className="mk-btn-secondary"
          onClick={loadReferrerManagement}
          disabled={loading}
        >
          <RefreshCw size={15} />
          {loading ? t('btn.loading') : t('btn.refresh')}
        </button>

        <div className="mk-ref-accounting-badge">
          <span />
          {t('badge.accounting')}
        </div>
      </div>

      {error ? <div className="mk-error-text">{error}</div> : null}

      <div className="mk-ref-tabs">
        {TAB_IDS.map((item) => (
          <TabButton
            key={item.id}
            item={item}
            label={t(item.labelKey)}
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
