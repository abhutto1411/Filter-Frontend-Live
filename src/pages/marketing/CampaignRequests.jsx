import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { CheckCircle, Eye, Search, XCircle, AlertCircle } from 'lucide-react';
import './MarketingUniversal.css';

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

const formatDate = (value, locale) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
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

const statusClass = (status) => {
  const s = String(status || '').toLowerCase();

  if (s.includes('approved')) return 'mk-status mk-status-success';
  if (s.includes('reject')) return 'mk-status mk-status-danger';
  if (s.includes('pending')) return 'mk-status mk-status-warning';

  return 'mk-status';
};

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
  const [requests, setRequests] = useState([]);
  const [selected, setSelected] = useState(null);

  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const [error, setError] = useState('');

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const res = await marketingListCampaignRequests({
        limit: 100,
        search: search.trim() || undefined,
      });

      setRequests(normalizeRequests(res, t('req.defaultTitle')));
    } catch (err) {
      console.error('Campaign requests error:', err);
      setError(err?.message || t('req.errLoad'));
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [search, t]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const filteredRequests = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return requests;

    return requests.filter((item) => {
      const haystack = [
        item.requestNumber,
        item.title,
        item.requestingPortal,
        item.requestingTenantName,
        item.requestingUserName,
        item.requestType,
        item.targetAudience,
        item.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [requests, search]);

  const openDetail = async (item) => {
    const id = getId(item);
    setSelected(item);

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
      console.error('Campaign request detail error:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const approveRequest = async (item) => {
    const id = getId(item);
    if (!id) return;

    const notes =
      window.prompt(t('req.prompt.approveNotes'), t('req.prompt.approveDefault')) ||
      t('req.prompt.approveDefault');

    try {
      setActionLoadingId(id);

      await marketingApproveCampaignRequest(id, {
        marketingNotes: notes,
        notes,
      });

      alert(t('req.alert.approved'));

      setSelected(null);
      await loadRequests();
    } catch (err) {
      console.error('Approve request error:', err);
      alert(err?.message || t('req.errApprove'));
    } finally {
      setActionLoadingId(null);
    }
  };

  const rejectRequest = async (item) => {
    const id = getId(item);
    if (!id) return;

    const reason = window.prompt(t('req.prompt.rejectReason'));
    if (!reason || !reason.trim()) return;

    try {
      setActionLoadingId(id);

      await marketingRejectCampaignRequest(id, {
        rejectionReason: reason.trim(),
        notes: reason.trim(),
        marketingNotes: reason.trim(),
      });

      setSelected(null);
      await loadRequests();
    } catch (err) {
      console.error('Reject request error:', err);
      alert(err?.message || t('req.errReject'));
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="mk-page mk-campaign-requests-page">
      <div className="mk-page-actions mk-page-actions-left">
        <label className="mk-search-field">
          <Search size={15} color="#94A3B8" strokeWidth={2} />

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('req.searchPlaceholder')}
          />
        </label>
      </div>

      {error ? <div className="mk-alert mk-alert-danger">{error}</div> : null}

      <div className="mk-camp-pending-banner" style={{ marginBottom: 14 }}>
        <AlertCircle size={15} />
        <span>
          {t('req.banner')}
          {isSuperAdmin ? t('req.bannerAdminExtra') : ''}
        </span>
      </div>

      <section className="mk-card mk-campaign-requests-card">
        {loading ? (
          <div className="mk-empty-card mk-empty-card-requests">
            <div className="mk-empty-card-text">{t('req.loading')}</div>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="mk-empty-card mk-empty-card-requests">
            <div className="mk-empty-card-text">{t('req.empty')}</div>
          </div>
        ) : (
          <div className="mk-table-wrap">
            <table className="mk-table mk-campaign-requests-table">
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
                {filteredRequests.map((item) => {
                  const id = getId(item);
                  const isPending = String(item.status || '')
                    .toLowerCase()
                    .includes('pending');

                  return (
                    <tr key={id || item.requestNumber}>
                      <td>{text(item.requestNumber)}</td>

                      <td>
                        <strong>{text(item.title)}</strong>
                        <small>{text(item.description, '-')}</small>
                      </td>

                      <td>{text(item.requestingPortal)}</td>
                      <td>{text(item.requestingTenantName)}</td>
                      <td>{text(item.requestingUserName)}</td>
                      <td>{text(item.requestType)}</td>
                      <td>{text(item.targetAudience)}</td>
                      <td>{formatBudget(item.budgetRequested)}</td>
                      <td>{formatDate(item.desiredStartDate, locale)}</td>
                      <td>{formatDate(item.desiredEndDate, locale)}</td>

                      <td>
                        <span className={statusClass(item.status)}>
                          {mktCampStatusLabel(locale, item.status)}
                        </span>
                      </td>

                      <td>
                        <div className="mk-action-group">
                          <button
                            type="button"
                            className="mk-icon-btn"
                            title={t('req.action.view')}
                            onClick={() => openDetail(item)}
                          >
                            <Eye size={15} />
                          </button>

                          {isPending ? (
                            <>
                              <button
                                type="button"
                                className="mk-icon-btn mk-icon-btn-success"
                                title={t('req.action.approve')}
                                disabled={actionLoadingId === id}
                                onClick={() => approveRequest(item)}
                              >
                                <CheckCircle size={15} />
                              </button>

                              <button
                                type="button"
                                className="mk-icon-btn mk-icon-btn-danger"
                                title={t('req.action.reject')}
                                disabled={actionLoadingId === id}
                                onClick={() => rejectRequest(item)}
                              >
                                <XCircle size={15} />
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected ? (
        <div className="mk-modal-backdrop" onClick={() => setSelected(null)}>
          <div
            className="mk-modal mk-modal-wide"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mk-modal-header">
              <div>
                <p className="mk-eyebrow">{text(selected.requestNumber)}</p>
                <h2>{text(selected.title)}</h2>
              </div>

              <button
                type="button"
                className="mk-icon-btn"
                onClick={() => setSelected(null)}
              >
                ×
              </button>
            </div>

            {detailLoading ? (
              <div className="mk-empty-card">
                <p>{t('req.detail.loading')}</p>
              </div>
            ) : (
              <>
                <div className="mk-detail-grid">
                  <div>
                    <span>{t('req.detail.requestNumber')}</span>
                    <strong>{text(selected.requestNumber)}</strong>
                  </div>

                  <div>
                    <span>{t('req.detail.portal')}</span>
                    <strong>{text(selected.requestingPortal)}</strong>
                  </div>

                  <div>
                    <span>{t('req.detail.tenantId')}</span>
                    <strong>{text(selected.requestingTenantId)}</strong>
                  </div>

                  <div>
                    <span>{t('req.detail.tenantName')}</span>
                    <strong>{text(selected.requestingTenantName)}</strong>
                  </div>

                  <div>
                    <span>{t('req.detail.userId')}</span>
                    <strong>{text(selected.requestingUserId)}</strong>
                  </div>

                  <div>
                    <span>{t('req.detail.userName')}</span>
                    <strong>{text(selected.requestingUserName)}</strong>
                  </div>

                  <div>
                    <span>{t('req.detail.requestType')}</span>
                    <strong>{text(selected.requestType)}</strong>
                  </div>

                  <div>
                    <span>{t('req.detail.targetAudience')}</span>
                    <strong>{text(selected.targetAudience)}</strong>
                  </div>

                  <div>
                    <span>{t('req.detail.budgetRequested')}</span>
                    <strong>{formatBudget(selected.budgetRequested)}</strong>
                  </div>

                  <div>
                    <span>{t('req.detail.linkedCampaignId')}</span>
                    <strong>{text(selected.linkedCampaignId)}</strong>
                  </div>

                  <div>
                    <span>{t('req.detail.desiredStart')}</span>
                    <strong>{formatDate(selected.desiredStartDate, locale)}</strong>
                  </div>

                  <div>
                    <span>{t('req.detail.desiredEnd')}</span>
                    <strong>{formatDate(selected.desiredEndDate, locale)}</strong>
                  </div>

                  <div>
                    <span>{t('req.detail.status')}</span>
                    <strong>{mktCampStatusLabel(locale, selected.status)}</strong>
                  </div>

                  <div>
                    <span>{t('req.detail.createdAt')}</span>
                    <strong>{formatDate(selected.createdAt, locale)}</strong>
                  </div>

                  <div>
                    <span>{t('req.detail.reviewedBy')}</span>
                    <strong>{text(selected.reviewedBy)}</strong>
                  </div>

                  <div>
                    <span>{t('req.detail.reviewDate')}</span>
                    <strong>{formatDate(selected.reviewDate, locale)}</strong>
                  </div>
                </div>

                <div className="mk-detail-section">
                  <h3>{t('req.detail.description')}</h3>
                  <p>{selected.description || t('req.detail.noDescription')}</p>
                </div>

                {selected.marketingNotes ? (
                  <div className="mk-detail-section">
                    <h3>{t('req.detail.marketingNotes')}</h3>
                    <p>{selected.marketingNotes}</p>
                  </div>
                ) : null}

                {selected.rejectionReason ? (
                  <div className="mk-detail-section">
                    <h3>{t('req.detail.rejectionReason')}</h3>
                    <p>{selected.rejectionReason}</p>
                  </div>
                ) : null}

                {String(selected.status || '').toLowerCase().includes('pending') ? (
                  <div className="mk-modal-actions">
                    <button
                      type="button"
                      className="mk-btn mk-btn-light"
                      onClick={() => setSelected(null)}
                    >
                      {t('req.detail.cancel')}
                    </button>

                    <button
                      type="button"
                      className="mk-btn mk-btn-danger"
                      onClick={() => rejectRequest(selected)}
                    >
                      {t('req.detail.reject')}
                    </button>

                    <button
                      type="button"
                      className="mk-btn mk-btn-primary"
                      onClick={() => approveRequest(selected)}
                    >
                      {t('req.detail.approve')}
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default CampaignRequests;
