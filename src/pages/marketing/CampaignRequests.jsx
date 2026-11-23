import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { AlertTriangle, CheckCircle, Eye, Inbox, Search, XCircle } from 'lucide-react';
import Modal from '../../components/Modal';
import UiPager from '../../components/UiPager';
import { useServerPaging } from '../../hooks/usePagedRows';
import { BUSINESS_TIMEZONE } from '../../utils/riyadhBusinessRange';
import '../../styles/ui.css';

import {
  marketingApproveCampaignRequest,
  marketingGetCampaignRequest,
  marketingListCampaignRequests,
  marketingRejectCampaignRequest,
} from '../../services/superAdminMarketingApi';
import { mktCampT, mktCampStatusLabel } from '../../utils/marketingCampaignsI18n';
import { useAuth } from '../../context/AuthContext';

const getId = (item) =>
  item?.id ||
  item?._id ||
  item?.requestId ||
  item?.marketingRequestId;

const text = (value, fallback = '-') => {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
};

/** Rendered in the business timezone, so a requested start date holds its day. */
const formatDate = (value, locale) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
    timeZone: BUSINESS_TIMEZONE,
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
};

const formatBudget = (value) => {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(amount);
};

const statusTone = (status) => {
  const s = String(status || '').toLowerCase();
  if (s.includes('approved')) return 'ok';
  if (s.includes('reject')) return 'dang';
  if (s.includes('pending')) return 'warn';
  return 'neutral';
};

const isPendingStatus = (status) =>
  String(status || '').toLowerCase().includes('pending');

const normalizeRequests = (payload, defaultTitle) => {
  const list =
    payload?.marketingRequests ||
    payload?.campaignRequests ||
    payload?.requests ||
    payload?.items ||
    payload?.data?.marketingRequests ||
    payload?.data?.campaignRequests ||
    payload?.data?.requests ||
    [];

  if (!Array.isArray(list)) return [];

  return list.map((item) => {
    const id = getId(item);

    return {
      id,

      requestNumber:
        item?.requestNumber ||
        item?.request_number ||
        `MR-${id || ''}`,

      title:
        item?.title ||
        item?.name ||
        item?.requestTitle ||
        defaultTitle,

      description:
        item?.description ||
        item?.details ||
        '',

      requestingPortal:
        item?.requestingPortal ||
        item?.requesting_portal ||
        item?.portal ||
        item?.requestedByPortal ||
        '-',

      requestingTenantId:
        item?.requestingTenantId ||
        item?.requesting_tenant_id ||
        '-',

      requestingTenantName:
        item?.requestingTenantName ||
        item?.requesting_tenant_name ||
        item?.tenantName ||
        item?.requestedByName ||
        '-',

      requestingUserId:
        item?.requestingUserId ||
        item?.requesting_user_id ||
        '-',

      requestingUserName:
        item?.requestingUserName ||
        item?.requesting_user_name ||
        item?.requestedBy ||
        '-',

      requestType:
        item?.requestType ||
        item?.request_type ||
        item?.type ||
        '-',

      targetAudience:
        item?.targetAudience ||
        item?.target_audience ||
        '-',

      desiredStartDate:
        item?.desiredStartDate ||
        item?.desired_start_date ||
        item?.startDate ||
        null,

      desiredEndDate:
        item?.desiredEndDate ||
        item?.desired_end_date ||
        item?.endDate ||
        null,

      budgetRequested:
        item?.budgetRequested ??
        item?.budget_requested ??
        item?.budget ??
        0,

      linkedCampaignId:
        item?.linkedCampaignId ||
        item?.linked_campaign_id ||
        '-',

      status: item?.status || 'pending',

      marketingNotes:
        item?.marketingNotes ||
        item?.marketing_notes ||
        '',

      reviewedBy:
        item?.reviewedBy ||
        item?.reviewed_by ||
        '-',

      reviewDate:
        item?.reviewDate ||
        item?.review_date ||
        null,

      rejectionReason:
        item?.rejectionReason ||
        item?.rejection_reason ||
        '',

      createdAt:
        item?.createdAt ||
        item?.created_date ||
        item?.created_at ||
        null,

      raw: item,
    };
  });
};

export const CampaignRequests = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.userType === 'platform_admin';
  const outletCtx = useOutletContext() || {};
  const locale =
    outletCtx.locale ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('marketing-locale') : null) ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
    'en';
  const t = useCallback((key, vars) => mktCampT(locale, key, vars), [locale]);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [requests, setRequests] = useState([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState(null);

  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // The decision pane inside the detail modal: 'approve' | 'reject' | null.
  const [decision, setDecision] = useState(null);
  const [decisionNote, setDecisionNote] = useState('');

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { page, pageSize, pagerFor } = useServerPaging({ resetKey: debouncedSearch });

  /**
   * One page at a time, searched by the server.
   *
   * This asked for `limit: 100, offset: 0` and then ran the *same* search again
   * in the browser over those 100 rows — so a request past the hundredth was
   * unreachable, and the endpoint had always supported `search` and `offset`
   * across every one of the fields the client predicate was re-checking.
   */
  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const res = await marketingListCampaignRequests({
        limit: pageSize,
        offset: (page - 1) * pageSize,
        search: debouncedSearch || undefined,
      });

      const rows = normalizeRequests(res, t('req.defaultTitle'));
      setRequests(rows);
      const count = Number(res?.total ?? res?.data?.total);
      setTotal(Number.isFinite(count) ? count : rows.length);
    } catch (err) {
      setError(err?.message || t('req.errLoad'));
      setRequests([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page, pageSize, t]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const closeDetail = () => {
    setSelected(null);
    setDecision(null);
    setDecisionNote('');
  };

  const openDetail = async (item) => {
    const id = getId(item);
    setSelected(item);
    setDecision(null);
    setDecisionNote('');

    if (!id) return;

    try {
      setDetailLoading(true);

      const res = await marketingGetCampaignRequest(id);

      const request =
        res?.marketingRequest ||
        res?.campaignRequest ||
        res?.request ||
        res?.data ||
        item;

      const normalized = normalizeRequests(
        { marketingRequests: [request] },
        t('req.defaultTitle'),
      );

      setSelected(normalized[0] || item);
    } catch (err) {
      setError(err?.message || t('req.errLoad'));
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * Approve with notes, or reject with a reason. Both used `window.prompt`,
   * which a browser can block; approval also fell back to a canned note when
   * the prompt was dismissed, so cancelling it approved the request anyway.
   */
  const submitDecision = async (item) => {
    const id = getId(item);
    if (!id || !decision) return;
    const note = decisionNote.trim();
    if (decision === 'reject' && !note) return;

    setError('');
    setNotice('');
    try {
      setActionLoadingId(id);

      if (decision === 'approve') {
        await marketingApproveCampaignRequest(id, {
          marketingNotes: note,
          notes: note,
        });
        setNotice(t('req.alert.approved'));
      } else {
        await marketingRejectCampaignRequest(id, {
          rejectionReason: note,
          notes: note,
          marketingNotes: note,
        });
      }

      closeDetail();
      await loadRequests();
    } catch (err) {
      setError(
        err?.message
        || (decision === 'approve' ? t('req.errApprove') : t('req.errReject')),
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  const detailFacts = selected
    ? [
      [t('req.detail.requestNumber'), text(selected.requestNumber)],
      [t('req.detail.portal'), text(selected.requestingPortal)],
      [t('req.detail.tenantId'), text(selected.requestingTenantId)],
      [t('req.detail.tenantName'), text(selected.requestingTenantName)],
      [t('req.detail.userId'), text(selected.requestingUserId)],
      [t('req.detail.userName'), text(selected.requestingUserName)],
      [t('req.detail.requestType'), text(selected.requestType)],
      [t('req.detail.targetAudience'), text(selected.targetAudience)],
      [t('req.detail.budgetRequested'), formatBudget(selected.budgetRequested)],
      [t('req.detail.linkedCampaignId'), text(selected.linkedCampaignId)],
      [t('req.detail.desiredStart'), formatDate(selected.desiredStartDate, locale)],
      [t('req.detail.desiredEnd'), formatDate(selected.desiredEndDate, locale)],
      [t('req.detail.status'), mktCampStatusLabel(locale, selected.status)],
      [t('req.detail.createdAt'), formatDate(selected.createdAt, locale)],
      [t('req.detail.reviewedBy'), text(selected.reviewedBy)],
      [t('req.detail.reviewDate'), formatDate(selected.reviewDate, locale)],
    ]
    : [];

  const selectedPending = selected ? isPendingStatus(selected.status) : false;
  const acting = selected ? actionLoadingId === getId(selected) : false;

  return (
    <div className="ui-root ui-root--flush ui-stack">
      <div className="ui-row ui-row--fields">
        <div className="ui-field ui-field--grow">
          <label htmlFor="cr-search">{t('list.searchLabel')}</label>
          <div className="ui-search">
            <Search size={15} />
            <input
              id="cr-search"
              className="ui-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('req.searchPlaceholder')}
            />
          </div>
        </div>
      </div>

      {error ? (
        <div className="ui-banner ui-banner--dang" role="alert">
          <AlertTriangle size={14} />
          <span>{error}</span>
        </div>
      ) : null}

      {notice ? (
        <div className="ui-banner ui-banner--ok" role="status">
          <CheckCircle size={14} />
          <span>{notice}</span>
        </div>
      ) : null}

      <div className="ui-banner ui-banner--info">
        <AlertTriangle size={14} />
        <span>
          {t('req.banner')}
          {isSuperAdmin ? t('req.bannerAdminExtra') : ''}
        </span>
      </div>

      <div className="ui-table-wrap ui-table-wrap--scroll">
        <table className="ui-table">
          <thead>
            <tr>
              <th>{t('req.th.requestNumber')}</th>
              <th>{t('req.th.title')}</th>
              <th>{t('req.th.portal')}</th>
              <th>{t('req.th.tenant')}</th>
              <th>{t('req.th.user')}</th>
              <th>{t('req.th.type')}</th>
              <th>{t('req.th.audience')}</th>
              <th>{t('req.th.budget')}</th>
              <th>{t('req.th.start')}</th>
              <th>{t('req.th.end')}</th>
              <th>{t('req.th.status')}</th>
              <th>{t('req.th.actions')}</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={`sk-${i}`} className="ui-sk-row">
                  <td><div className="ui-sk ui-sk--strong ui-sk--w70" /></td>
                  <td><div className="ui-sk ui-sk--strong ui-sk--w90" /></td>
                  <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                  <td><div className="ui-sk ui-sk--text ui-sk--w70" /></td>
                  <td><div className="ui-sk ui-sk--text ui-sk--w70" /></td>
                  <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                  <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                  <td><div className="ui-sk ui-sk--text ui-sk--w40" /></td>
                  <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                  <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                  <td><div className="ui-sk ui-sk--pill" /></td>
                  <td><div className="ui-sk ui-sk--btn" /></td>
                </tr>
              ))
            ) : requests.length === 0 ? (
              <tr>
                <td colSpan={12}>
                  <div className="ui-empty">
                    <div className="ui-empty-icon"><Inbox size={18} /></div>
                    <div className="ui-empty-title">{t('req.empty')}</div>
                  </div>
                </td>
              </tr>
            ) : (
              requests.map((item) => {
                const id = getId(item);
                const isPending = isPendingStatus(item.status);

                return (
                  <tr key={id || item.requestNumber}>
                    <td data-label={t('req.th.requestNumber')} className="ui-strong">
                      {text(item.requestNumber)}
                    </td>

                    <td data-label={t('req.th.title')}>
                      <div className="ui-strong">{text(item.title)}</div>
                      {item.description ? (
                        <div className="ui-meta">{item.description}</div>
                      ) : null}
                    </td>

                    <td data-label={t('req.th.portal')}>{text(item.requestingPortal)}</td>
                    <td data-label={t('req.th.tenant')}>{text(item.requestingTenantName)}</td>
                    <td data-label={t('req.th.user')}>{text(item.requestingUserName)}</td>
                    <td data-label={t('req.th.type')}>{text(item.requestType)}</td>
                    <td data-label={t('req.th.audience')}>{text(item.targetAudience)}</td>
                    <td data-label={t('req.th.budget')} className="ui-num">
                      {formatBudget(item.budgetRequested)}
                    </td>
                    <td data-label={t('req.th.start')} className="ui-nowrap">
                      {formatDate(item.desiredStartDate, locale)}
                    </td>
                    <td data-label={t('req.th.end')} className="ui-nowrap">
                      {formatDate(item.desiredEndDate, locale)}
                    </td>

                    <td data-label={t('req.th.status')}>
                      <span className={`ui-pill ui-pill--${statusTone(item.status)}`}>
                        {mktCampStatusLabel(locale, item.status)}
                      </span>
                    </td>

                    <td data-label={t('req.th.actions')}>
                      {/* One way in. The tick and cross opened no dialog of
                          their own — they fired a window.prompt — so the
                          decision now lives in the detail modal with the
                          facts it should be made against. */}
                      <button
                        type="button"
                        className="ui-btn ui-btn--default ui-btn--sm"
                        disabled={actionLoadingId === id}
                        onClick={() => openDetail(item)}
                      >
                        <Eye size={14} />
                        {isPending ? t('req.action.review') : t('req.action.view')}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <UiPager {...pagerFor(total)} />
      </div>

      {selected ? (
        <Modal
          title={`${text(selected.requestNumber)} · ${text(selected.title)}`}
          onClose={closeDetail}
          width="min(820px, 96vw)"
          contentClassName="ui-tokens"
          footer={selectedPending && !detailLoading ? (
            <>
              <button
                type="button"
                className="ui-btn ui-btn--default"
                onClick={decision ? () => { setDecision(null); setDecisionNote(''); } : closeDetail}
                disabled={acting}
              >
                {t('req.detail.cancel')}
              </button>
              {decision === 'reject' ? (
                <button
                  type="button"
                  className="ui-btn ui-btn--danger"
                  onClick={() => submitDecision(selected)}
                  disabled={acting || !decisionNote.trim()}
                >
                  <XCircle size={14} /> {t('req.detail.reject')}
                </button>
              ) : decision === 'approve' ? (
                <button
                  type="button"
                  className="ui-btn ui-btn--primary"
                  onClick={() => submitDecision(selected)}
                  disabled={acting}
                >
                  <CheckCircle size={14} /> {t('req.detail.approve')}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="ui-btn ui-btn--danger"
                    onClick={() => { setDecision('reject'); setDecisionNote(''); }}
                    disabled={acting}
                  >
                    <XCircle size={14} /> {t('req.detail.reject')}
                  </button>
                  <button
                    type="button"
                    className="ui-btn ui-btn--primary"
                    onClick={() => { setDecision('approve'); setDecisionNote(''); }}
                    disabled={acting}
                  >
                    <CheckCircle size={14} /> {t('req.detail.approve')}
                  </button>
                </>
              )}
            </>
          ) : (
            <button type="button" className="ui-btn ui-btn--default" onClick={closeDetail}>
              {t('req.detail.cancel')}
            </button>
          )}
        >
          {detailLoading ? (
            <div className="ui-stack-sm" aria-busy="true">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={`sk-${i}`} className="ui-sk-row">
                  <div className="ui-sk ui-sk--text ui-sk--w90" />
                </div>
              ))}
            </div>
          ) : (
            <div className="ui-stack">
              <div className="ui-fields">
                {detailFacts.map(([label, value]) => (
                  <div key={label} className="ui-fieldro">
                    <span className="ui-fieldro-label">{label}</span>
                    <span className="ui-fieldro-value">{value}</span>
                  </div>
                ))}
              </div>

              <section className="ui-subgroup">
                <div className="ui-subgroup-title">{t('req.detail.description')}</div>
                <p className="ui-help">
                  {selected.description || t('req.detail.noDescription')}
                </p>
              </section>

              {selected.marketingNotes ? (
                <section className="ui-subgroup">
                  <div className="ui-subgroup-title">{t('req.detail.marketingNotes')}</div>
                  <p className="ui-help">{selected.marketingNotes}</p>
                </section>
              ) : null}

              {selected.rejectionReason ? (
                <section className="ui-subgroup">
                  <div className="ui-subgroup-title">{t('req.detail.rejectionReason')}</div>
                  <p className="ui-help">{selected.rejectionReason}</p>
                </section>
              ) : null}

              {decision ? (
                <div className="ui-field">
                  <label htmlFor="cr-decision-note">
                    {decision === 'approve'
                      ? t('req.decision.notesLabel')
                      : t('req.decision.reasonLabel')}
                    {decision === 'approve' ? (
                      <span className="ui-field-opt"> ({t('req.decision.optional')})</span>
                    ) : null}
                  </label>
                  <textarea
                    id="cr-decision-note"
                    className="ui-textarea"
                    rows={3}
                    value={decisionNote}
                    onChange={(e) => setDecisionNote(e.target.value)}
                    placeholder={
                      decision === 'approve'
                        ? t('req.decision.notesPlaceholder')
                        : t('req.decision.reasonPlaceholder')
                    }
                  />
                  {decision === 'reject' ? (
                    <p className="ui-help">{t('req.decision.reasonRequired')}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </Modal>
      ) : null}
    </div>
  );
};

export default CampaignRequests;
