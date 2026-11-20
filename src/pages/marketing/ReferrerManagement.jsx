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
  Gift,
  AlertTriangle,
} from 'lucide-react';
import {
  marketingDeleteReferrer,
  marketingDeleteCommissionRule,
  marketingDeleteBenefitRule,
  marketingGetReferralCommissionsDashboard,
  marketingGetReferralManagementDashboard,
  marketingListBenefitRules,
  marketingListCommissionRules,
  marketingListReferrerPayoutRequests,
  marketingListReferrers,
} from '../../services/superAdminMarketingApi';
import {
  mktRefCategoryLabel,
  mktRefFormatSar,
  mktRefStatusLabel,
  mktRefT,
} from '../../utils/marketingReferrersI18n';
import { marketingSectionPath } from './marketingRouteUtils';
import UiPager from '../../components/UiPager';
import { usePagedRows } from '../../hooks/usePagedRows';
import '../../styles/ui.css';

const TAB_IDS = [
  { id: 'dashboard', icon: BarChart3, labelKey: 'tab.dashboard' },
  { id: 'referrers', icon: Users, labelKey: 'tab.referrers' },
  { id: 'tracker', icon: ListChecks, labelKey: 'tab.tracker' },
  { id: 'rules', icon: SlidersHorizontal, labelKey: 'tab.rules' },
  { id: 'benefits', icon: Gift, labelKey: 'tab.benefits' },
  { id: 'payout', icon: CreditCard, labelKey: 'tab.payout' },
  { id: 'journals', icon: BookOpen, labelKey: 'tab.journals' },
];

const JOURNAL_TAB_IDS = [
  { id: 'entries', icon: NotebookTabs, labelKey: 'jtab.entries' },
  { id: 'ledger', icon: BookOpen, labelKey: 'jtab.ledger' },
  { id: 'pl', icon: Scale, labelKey: 'jtab.pl' },
];

const REF_STATUS_TONE = {
  active: 'ok',
  approved: 'ok',
  paid: 'ok',
  inactive: 'neutral',
  pending: 'warn',
  rejected: 'dang',
  suspended: 'dang',
};

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
    isCommunity: Boolean(row.isCommunity ?? row.is_community ?? row.community),
    referralCode: row.referralCode || row.referral_code || row.code || '',
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

function extractList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.rules)) return payload.rules;
  if (Array.isArray(payload?.payouts)) return payload.payouts;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function moneyKindLabel(locale, type, value) {
  const n = Number(value);
  const amount = Number.isFinite(n) ? n : 0;
  if (String(type || '').toLowerCase().includes('fix')) {
    return mktRefFormatSar(locale, amount);
  }
  return `${amount}%`;
}

const CARD_TONE = { blue: 'info', green: 'ok', yellow: 'warn', red: 'dang' };

const StatCard = (props) => {
  const { title, value, sub, tone = 'blue' } = props;
  // Assigned, not destructured as `icon: Icon`: this eslint config has no
  // React plugin, so JSX use is not a reference and the arg reads as unused.
  const Icon = props.icon;
  const mapped = CARD_TONE[tone] || 'info';
  return (
    <div className={`ui-metric ui-metric--${mapped}`}>
      <Icon className="ui-metric-icon" size={58} strokeWidth={1.5} aria-hidden />
      <div className="ui-metric-label">{title}</div>
      <div className="ui-metric-value">{value}</div>
      {sub ? <div className="ui-metric-foot">{sub}</div> : null}
    </div>
  );
};

const MetricCard = ({ label, value, subtitle, tone }) => (
  <div className={`ui-metric${CARD_TONE[tone] ? ` ui-metric--${CARD_TONE[tone]}` : ''}`}>
    <div className="ui-metric-label">{label}</div>
    <div className="ui-metric-value">{value}</div>
    {subtitle ? <div className="ui-metric-foot">{subtitle}</div> : null}
  </div>
);

/** One tab strip for both levels; `aria-selected` carries which is open. */
const TabButton = ({ item, active, onClick, label }) => {
  const Icon = item.icon;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => onClick(item.id)}
      className="ui-tab"
    >
      <Icon size={13} strokeWidth={2} />
      {label}
    </button>
  );
};

const JournalTabButton = TabButton;

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
  const [commissionRules, setCommissionRules] = useState([]);
  const [benefitRules, setBenefitRules] = useState([]);
  const [payoutRequests, setPayoutRequests] = useState([]);

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
      const [dashboardRes, referrersRes, commissionsRes, rulesRes, benefitsRes, payoutsRes] =
        await Promise.all([
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

          marketingListCommissionRules().catch(() => null),
          marketingListBenefitRules().catch(() => null),
          marketingListReferrerPayoutRequests().catch(() => null),
        ]);

      const referrers = extractReferrers(referrersRes, locale);
      const recentReferrers = extractReferrers(dashboardRes, locale);
      const payable = extractPayableRows(commissionsRes, locale);
      const recentReferrals = extractReferrals(dashboardRes, locale);

      setReferrersData(referrers.length ? referrers : recentReferrers);
      setPayableSummary(payable);
      setReferrals(recentReferrals);
      setCommissionRules(extractList(rulesRes));
      setBenefitRules(extractList(benefitsRes));
      setPayoutRequests(extractList(payoutsRes));
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
      pendingPayoutRequests: payoutRequests.filter((item) =>
        String(item.status || '').toLowerCase() === 'pending',
      ).length,
      referralsUnderReview: referrals.filter((item) =>
        ['pending', 'under_review'].includes(String(item.status || '').toLowerCase()),
      ).length,
    };
  }, [referrersData, payableSummary, referrals, payoutRequests]);

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
      setError(err?.message || t('err.delete'));
    } finally {
      setActionLoadingId('');
    }
  };

  const deleteCommissionRule = async (item) => {
    if (!window.confirm(t('confirm.deleteRule'))) return;
    try {
      setActionLoadingId(`c-${item.id}`);
      await marketingDeleteCommissionRule(item.id);
      await loadReferrerManagement();
    } catch (err) {
      setError(err?.message || t('err.deleteRule'));
    } finally {
      setActionLoadingId('');
    }
  };

  const deleteBenefitRule = async (item) => {
    if (!window.confirm(t('confirm.deleteRule'))) return;
    try {
      setActionLoadingId(`b-${item.id}`);
      await marketingDeleteBenefitRule(item.id);
      await loadReferrerManagement();
    } catch (err) {
      setError(err?.message || t('err.deleteRule'));
    } finally {
      setActionLoadingId('');
    }
  };

  const formatSar = (value) => mktRefFormatSar(locale, value);
  const dateLocale = locale === 'ar' ? 'ar-SA' : undefined;

  // One pager per table. They sit here, not in the render functions below,
  // because those run behind `activeTab === ...` and a hook inside one
  // would be called conditionally. The dashboard and the P&L report show
  // the same rows but page independently.
  const payableDash = usePagedRows(payableSummary, { resetKey: 'dash' });
  const payablePl = usePagedRows(payableSummary, { resetKey: 'pl' });
  const referrersPage = usePagedRows(filteredReferrers, { resetKey: searchReferrer });
  const referralsPage = usePagedRows(filteredReferrals, { resetKey: trackerSearch });
  const rulesPage = usePagedRows(commissionRules, { resetKey: 'rules' });
  const benefitsPage = usePagedRows(benefitRules, { resetKey: 'benefits' });
  const payoutsPage = usePagedRows(payoutRequests, { resetKey: 'payouts' });

  const renderDashboard = () => (
    <>
      <section className="ui-stack-sm">
        <div className="ui-head">
          <h1>{t('dash.overview')}</h1>
          <p>{t('dash.overviewSub')}</p>
        </div>

        <div className="ui-kpis">
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

        <div className="ui-panels">
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

      <section className="ui-table-wrap ui-table-wrap--scroll">
        <div className="ui-panel-head ui-panel-title">{t('dash.payableTitle')}</div>

        <table className="ui-table">
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
                <td colSpan="6" className="ui-td-empty">
                  {t('empty.payable')}
                </td>
              </tr>
            ) : (
              payableDash.pagedRows.map((item) => (
                <tr key={item.id || item.name}>
                  <td className="ui-strong">{item.name}</td>
                  <td>{mktRefCategoryLabel(locale, item.type)}</td>
                  <td className="ui-num ui-money ui-money--hold">{formatSar(item.pending)}</td>
                  <td className="ui-num ui-money ui-money--in">{formatSar(item.available)}</td>
                  <td>{formatSar(item.paid)}</td>
                  <td className="ui-num ui-strong">{formatSar(item.totalEarned)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
          <UiPager {...payableDash.pagerProps} />
      </section>
    </>
  );

  const renderReferrers = () => (
    <>
      <div className="ui-row ui-row--fields">
        <div className="ui-field ui-field--grow">
          <div className="ui-search">
          <Search size={15} />
          <input
            className="ui-input"
            value={searchReferrer}
            onChange={(e) => setSearchReferrer(e.target.value)}
            placeholder={t('search.referrers')}
          />
          </div>
        </div>

        <button type="button" className="ui-btn ui-btn--primary" onClick={openCreateReferrer}>
          <Plus size={15} strokeWidth={2.4} />
          {t('btn.addReferrer')}
        </button>
      </div>

      <section className="ui-table-wrap ui-table-wrap--scroll">
        <table className="ui-table">
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
                <td colSpan="8" className="ui-td-empty">
                  {t('empty.referrers')}
                </td>
              </tr>
            ) : (
              referrersPage.pagedRows.map((item) => {
                const busy = actionLoadingId === item.id;

                return (
                  <tr key={item.id}>
                    <td className="ui-meta-ref">{item.id}</td>

                    <td>
                      <div className="ui-list-main">
                        <div className="ui-strong">{item.name}</div>
                        <div className="ui-meta">{item.email || t('dash')}</div>
                        {item.isCommunity ? (
                          <span className="ui-pill ui-pill--neutral">{t('badge.community')}</span>
                        ) : null}
                      </div>
                    </td>

                    <td>{mktRefCategoryLabel(locale, item.type)}</td>
                    <td>{item.mobile || t('dash')}</td>
                    <td className="ui-num ui-money ui-money--in">
                      {item.isCommunity ? t('dash') : formatSar(item.available)}
                    </td>
                    <td className="ui-num ui-money ui-money--hold">
                      {item.isCommunity ? t('dash') : formatSar(item.pending)}
                    </td>

                    <td>
                      <span className={`ui-pill ui-pill--${REF_STATUS_TONE[item.status] || 'neutral'}`}>
                        {mktRefStatusLabel(locale, item.status)}
                      </span>
                    </td>

                    <td>
                      <div className="ui-rowacts">
                        <button
                          type="button"
                          className="ui-btn ui-btn--default ui-btn--sm ui-btn--icon"
                          disabled={busy}
                          onClick={() => openEditReferrer(item)}
                        >
                          <Pencil size={15} strokeWidth={2} />
                        </button>

                        <button
                          type="button"
                          className="ui-btn ui-btn--danger ui-btn--sm ui-btn--icon"
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
          <UiPager {...referrersPage.pagerProps} />
      </section>
    </>
  );

  const renderTracker = () => (
    <>
      <div className="ui-row ui-row--fields">
        <div className="ui-field ui-field--grow">
          <div className="ui-search">
          <Search size={15} />
          <input
            className="ui-input"
            value={trackerSearch}
            onChange={(e) => setTrackerSearch(e.target.value)}
            placeholder={t('search.tracker')}
          />
          </div>
        </div>
      </div>

      <section className="ui-table-wrap ui-table-wrap--scroll">
        <table className="ui-table">
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
                <td colSpan="8" className="ui-td-empty">
                  {t('empty.referrals')}
                </td>
              </tr>
            ) : (
              referralsPage.pagedRows.map((item) => (
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
          <UiPager {...referralsPage.pagerProps} />
      </section>
    </>
  );

  const renderRules = () => (
    <>
      <div className="ui-row">
        <div>
          <h2 className="ui-panel-title">{t('rules.title')}</h2>
        </div>

        <button
          type="button"
          className="ui-btn ui-btn--primary"
          onClick={() => navigate(`${basePath}/rules/new`)}
        >
          <Plus size={15} strokeWidth={2.4} />
          {t('btn.addRule')}
        </button>
      </div>

      <div className="ui-banner ui-banner--info">
        <Info size={15} strokeWidth={2.2} />
        <span>
          <strong>{t('rules.priority')}</strong>
          {t('rules.priorityBody')}
          <strong>{t('rules.approved')}</strong>
        </span>
      </div>

      <section className="ui-table-wrap ui-table-wrap--scroll">
        <table className="ui-table">
          <thead>
            <tr>
              <th>{t('th.referrer')}</th>
              <th>{t('th.category')}</th>
              <th>{t('th.customerType')}</th>
              <th>{t('th.service')}</th>
              <th>{t('th.commission')}</th>
              <th>{t('th.effective')}</th>
              <th>{t('th.status')}</th>
              <th>{t('th.actions')}</th>
            </tr>
          </thead>

          <tbody>
            {commissionRules.length === 0 ? (
              <tr>
                <td colSpan="8" className="ui-td-empty">
                  {t('empty.rules')}
                </td>
              </tr>
            ) : (
              rulesPage.pagedRows.map((item) => (
                <tr key={item.id}>
                  <td className="ui-strong">
                    {item.referrerName || t('scope.global')}
                  </td>
                  <td>{item.category || t('dash')}</td>
                  <td>{item.customerType || t('dash')}</td>
                  <td>{item.service || t('dash')}</td>
                  <td>{moneyKindLabel(locale, item.commissionType, item.value)}</td>
                  <td>
                    {item.effectiveFrom || item.effectiveTo
                      ? `${
                          item.effectiveFrom
                            ? new Date(item.effectiveFrom).toLocaleDateString(dateLocale)
                            : t('dash')
                        } – ${
                          item.effectiveTo
                            ? new Date(item.effectiveTo).toLocaleDateString(dateLocale)
                            : t('dash')
                        }`
                      : t('dash')}
                  </td>
                  <td>
                    <span className={`ui-pill ui-pill--${item.isActive ? 'ok' : 'neutral'}`}>
                      {mktRefStatusLabel(locale, item.isActive ? 'active' : 'inactive')}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="ui-btn ui-btn--danger ui-btn--sm ui-btn--icon"
                      disabled={actionLoadingId === `c-${item.id}`}
                      onClick={() => deleteCommissionRule(item)}
                    >
                      <Trash2 size={15} strokeWidth={2} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
          <UiPager {...rulesPage.pagerProps} />
      </section>
    </>
  );

  const renderBenefits = () => (
    <>
      <div className="ui-row">
        <div>
          <h2 className="ui-panel-title">{t('benefits.title')}</h2>
        </div>

        <button
          type="button"
          className="ui-btn ui-btn--primary"
          onClick={() => navigate(`${basePath}/benefit-rules/new`)}
        >
          <Plus size={15} strokeWidth={2.4} />
          {t('btn.addBenefit')}
        </button>
      </div>

      <div className="ui-banner ui-banner--info">
        <Info size={15} strokeWidth={2.2} />
        <span>
          <strong>{t('benefits.priority')}</strong>
          {t('benefits.priorityBody')}
        </span>
      </div>

      <section className="ui-table-wrap ui-table-wrap--scroll">
        <table className="ui-table">
          <thead>
            <tr>
              <th>{t('th.scope')}</th>
              <th>{t('th.discount')}</th>
              <th>{t('th.minOrder')}</th>
              <th>{t('th.newOnly')}</th>
              <th>{t('th.once')}</th>
              <th>{t('th.status')}</th>
              <th>{t('th.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {benefitRules.length === 0 ? (
              <tr>
                <td colSpan="7" className="ui-td-empty">
                  {t('empty.benefits')}
                </td>
              </tr>
            ) : (
              benefitsPage.pagedRows.map((item) => (
                <tr key={item.id}>
                  <td className="ui-strong">
                    {item.referrerName || t('scope.global')}
                  </td>
                  <td>{moneyKindLabel(locale, item.discountType, item.discountValue)}</td>
                  <td>{formatSar(item.minOrderValue)}</td>
                  <td>{t('yes')}</td>
                  <td>{item.oncePerCustomer ? t('yes') : t('no')}</td>
                  <td>
                    <span className={`ui-pill ui-pill--${item.isActive ? 'ok' : 'neutral'}`}>
                      {mktRefStatusLabel(locale, item.isActive ? 'active' : 'inactive')}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="ui-btn ui-btn--danger ui-btn--sm ui-btn--icon"
                      disabled={actionLoadingId === `b-${item.id}`}
                      onClick={() => deleteBenefitRule(item)}
                    >
                      <Trash2 size={15} strokeWidth={2} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
          <UiPager {...benefitsPage.pagerProps} />
      </section>
    </>
  );

  const renderPayout = () => (
    <>
      <div className="ui-row">
        <div>
          <h2 className="ui-panel-title">{t('payout.title')}</h2>
        </div>
      </div>

      <section className="ui-table-wrap ui-table-wrap--scroll">
        <table className="ui-table">
          <thead>
            <tr>
              <th>{t('th.payoutNo')}</th>
              <th>{t('th.referrer')}</th>
              <th>{t('th.amount')}</th>
              <th>{t('th.method')}</th>
              <th>{t('th.status')}</th>
              <th>{t('th.date')}</th>
              <th>{t('th.actions')}</th>
            </tr>
          </thead>

          <tbody>
            {payoutRequests.length === 0 ? (
              <tr>
                <td colSpan="7" className="ui-td-empty">
                  {t('empty.payouts')}
                </td>
              </tr>
            ) : (
              payoutsPage.pagedRows.map((item) => {
                const status = String(item.status || 'pending').toLowerCase();
                const pending = status === 'pending';
                return (
                  <tr key={item.id}>
                    <td className="ui-meta-ref">{item.id}</td>
                    <td className="ui-strong">{item.referrerName || t('dash')}</td>
                    <td>{formatSar(item.amount)}</td>
                    <td>{item.method || t('dash')}</td>
                    <td>
                      <span className={`ui-pill ui-pill--${REF_STATUS_TONE[status] || 'neutral'}`}>
                        {mktRefStatusLabel(locale, status)}
                      </span>
                    </td>
                    <td>
                      {item.createdAt
                        ? new Date(item.createdAt).toLocaleDateString(dateLocale)
                        : t('dash')}
                    </td>
                    <td>
                      {pending ? (
                        t('payout.awaitingAdmin')
                      ) : (
                        t('dash')
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
          <UiPager {...payoutsPage.pagerProps} />
      </section>
    </>
  );

  const renderJournals = () => (
    <>
      <div className="ui-tabs ui-tabs--scroll" role="tablist">
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
        <section className="ui-empty">
          <div className="ui-empty-title">{t('journals.emptyEntries')}</div>
          <div className="ui-empty-sub">{t('journals.emptyEntriesSub')}</div>
        </section>
      )}

      {journalTab === 'ledger' && (
        <section className="ui-table-wrap ui-table-wrap--scroll">
          <div className="ui-panel-head ui-panel-title">{t('journals.ledgerTitle')}</div>

          <table className="ui-table">
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
                <td colSpan="6" className="ui-td-empty">
                  {t('empty.ledger')}
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      )}

      {journalTab === 'pl' && (
        <>
          <div className="ui-kpis">
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

          <section className="ui-table-wrap ui-table-wrap--scroll">
            <div className="ui-panel-head ui-panel-title">{t('pl.reportTitle')}</div>

            <table className="ui-table">
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
                    <td colSpan="6" className="ui-td-empty">
                      {t('empty.pl')}
                    </td>
                  </tr>
                ) : (
                  payablePl.pagedRows.map((item) => (
                    <tr key={item.id || item.name}>
                      <td className="ui-strong">{item.name}</td>
                      <td>{item.coaAccount || t('coa.notSet')}</td>
                      <td className="ui-num ui-money ui-money--hold">{formatSar(item.pending)}</td>
                      <td className="ui-num ui-money ui-money--in">{formatSar(item.available)}</td>
                      <td>{formatSar(item.paid)}</td>
                      <td className="ui-num ui-strong">{formatSar(item.totalEarned)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          <UiPager {...payablePl.pagerProps} />
          </section>
        </>
      )}
    </>
  );

  return (
    <div className="ui-root ui-root--flush ui-stack" dir={locale === 'ar' ? 'rtl' : undefined}>
      <div className="ui-row">
        <div className="ui-head">
          <h1>{t('page.title')}</h1>
        </div>

        <button
          type="button"
          className="ui-btn ui-btn--default"
          onClick={loadReferrerManagement}
          disabled={loading}
        >
          <RefreshCw size={15} />
          {loading ? t('btn.loading') : t('btn.refresh')}
        </button>

        <span className="ui-pill ui-pill--info">{t('badge.accounting')}</span>
      </div>

      {error ? (
        <div className="ui-banner ui-banner--dang" role="alert">
          <AlertTriangle size={14} />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="ui-tabs ui-tabs--scroll" role="tablist">
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
      {activeTab === 'benefits' && renderBenefits()}
      {activeTab === 'payout' && renderPayout()}
      {activeTab === 'journals' && renderJournals()}
    </div>
  );
};

export default ReferrerManagement;
