import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Edit3,
  Loader2,
  Plus,
  Send,
  Smartphone,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import {
  riderAppApprovePromotion,
  riderAppListPromotions,
  riderAppRejectPromotion,
  riderAppSetPromotionActivation,
  riderAppSubmitPromotion,
} from '../../services/riderAppMarketingApi';
import { resolveMarketingLocale } from '../../utils/marketingPromotionsI18n';
import { riderAppT } from '../../utils/riderAppPromotionsI18n';
import { MarketingFormShell } from './MarketingFormShell';
import { resolvePromotionBasePath } from './marketingPromotionShared';
import './MarketingUniversal.css';
import './RiderAppPromotions.css';
import { listFrom, syncBadgeClass } from './riderAppPromotionUtils';

const formatDate = (value, locale) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

/**
 * Rider app promotions created in the ERP. Approval works like ERP promotions:
 * draft → submit → approve (platform admin) → activate. The Rider backend picks
 * changes up within ~30 seconds and reports the result in `syncStatus`.
 */
export const RiderAppPromotions = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const outletCtx = useOutletContext() || {};
  const locale = resolveMarketingLocale(outletCtx);
  const t = useCallback((key, vars) => riderAppT(locale, key, vars), [locale]);
  const listPath = resolvePromotionBasePath(location.pathname);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(listFrom(await riderAppListPromotions()));
    } catch (err) {
      setError(err?.message || t('err.load'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (id, action, message) => {
    setBusyId(id);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(message || t('msg.updated'));
      await load();
    } catch (err) {
      setError(err?.message || t('err.action'));
    } finally {
      setBusyId(null);
    }
  };

  const reject = (item) => {
    const reason = window.prompt(t('prompt.reject')) ?? null;
    if (reason === null) return;
    run(item.id, () => riderAppRejectPromotion(item.id, reason));
  };

  return (
    <MarketingFormShell
      title={t('list.title')}
      subtitle={t('list.subtitle')}
      onBack={() => navigate(listPath)}
      className="mkp-page"
    >
      <div className="rap-toolbar">
        <button
          type="button"
          className="mkp-new-btn"
          onClick={() => navigate(`${listPath}/rider-app/new`)}
        >
          <Plus size={15} strokeWidth={2.5} />
          {t('btn.newRiderPromotion')}
        </button>
      </div>

      {notice ? (
        <div className="mkp-success">
          <CheckCircle2 size={16} />
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="mkp-error">
          <AlertCircle size={16} />
          {error}
        </div>
      ) : null}

      <div className="mkp-content">
        {loading ? (
          <div className="mkp-empty">
            <Loader2 size={30} className="mkp-spin" />
            <div>{t('list.loading')}</div>
          </div>
        ) : items.length === 0 ? (
          <div className="mkp-empty">
            <Smartphone size={38} />
            <div>{t('list.empty')}</div>
          </div>
        ) : (
          <div className="mkp-card-list">
            {items.map((item) => {
              const busy = busyId === item.id;
              const services = Array.isArray(item.serviceIds) ? item.serviceIds : [];
              const canSubmit = ['draft', 'rejected'].includes(item.approvalStatus);
              const pending = item.approvalStatus === 'pending_approval';
              const approved = item.approvalStatus === 'approved';
              return (
                <div key={item.id} className={`mkp-card ${item.syncStatus === 'LIVE' ? 'mkp-card-live' : ''}`}>
                  <div className="mkp-card-top">
                    <div className="mkp-card-icon">
                      <Smartphone size={15} />
                    </div>
                    <div className="mkp-card-body">
                      <div className="mkp-card-title">
                        {item.title || item.code} <span className="rap-code">{item.code}</span>
                      </div>
                      <div className="mkp-card-sub">
                        {t('col.discount')}:{' '}
                        {item.discountType === 'FIXED'
                          ? `${item.discountValue} SAR`
                          : `${Number(item.discountValue)}%`}
                        {item.maxDiscount ? ` (max ${item.maxDiscount} SAR)` : ''} •{' '}
                        {services.length ? `${services.length} ${t('col.services')}` : t('col.allServices')}
                      </div>
                    </div>
                    <div className="mkp-card-badges">
                      <span className={`mkp-status status-${String(item.approvalStatus).replace(/_/g, '-')}`}>
                        {t(`approval.${item.approvalStatus}`)}
                      </span>
                    </div>
                  </div>

                  <div className="mkp-card-date">
                    <Clock3 size={13} />
                    {formatDate(item.validFrom, locale)} – {formatDate(item.validTo, locale)}
                  </div>

                  <div className="rap-sync-row">
                    <span className={syncBadgeClass(item.syncStatus)}>
                      {t(`sync.${item.syncStatus}`)}
                    </span>
                    {item.syncStatus === 'ERROR' && item.syncError ? (
                      <span className="rap-sync-error">{item.syncError}</span>
                    ) : null}
                    {item.approvalStatus === 'rejected' && item.rejectionReason ? (
                      <span className="rap-sync-error">{item.rejectionReason}</span>
                    ) : null}
                  </div>

                  <div className="mkp-card-activation">
                    <div className="mkp-card-activation-label">
                      <span className="mkp-card-activation-title">{t('offer.label')}</span>
                      <span className="mkp-card-activation-hint">
                        {approved ? '' : t('hint.approveFirst')}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={`mkp-card-activation-toggle ${item.enabled ? 'on' : 'off'} ${!approved ? 'disabled' : ''}`}
                      disabled={!approved || busy}
                      onClick={() =>
                        run(item.id, () => riderAppSetPromotionActivation(item.id, !item.enabled), t('sync.waiting'))
                      }
                      aria-pressed={item.enabled}
                    >
                      {busy ? (
                        <Loader2 size={14} className="mkp-spin" />
                      ) : (
                        <span className="mkp-card-activation-track">
                          <span />
                        </span>
                      )}
                      <span>{item.enabled ? t('btn.deactivate') : t('btn.activate')}</span>
                    </button>
                  </div>

                  <div className="mkp-card-footer">
                    <button type="button" onClick={() => navigate(`${listPath}/rider-app/${item.id}/edit`)}>
                      <Edit3 size={14} />
                      {t('btn.edit')}
                    </button>
                    {canSubmit ? (
                      <button type="button" disabled={busy} onClick={() => run(item.id, () => riderAppSubmitPromotion(item.id))}>
                        <Send size={14} />
                        {t('btn.submit')}
                      </button>
                    ) : null}
                    {pending ? (
                      <>
                        <button type="button" disabled={busy} onClick={() => run(item.id, () => riderAppApprovePromotion(item.id))}>
                          <ThumbsUp size={14} />
                          {t('btn.approve')}
                        </button>
                        <button type="button" className="danger" disabled={busy} onClick={() => reject(item)}>
                          <ThumbsDown size={14} />
                          {t('btn.reject')}
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </MarketingFormShell>
  );
};

export default RiderAppPromotions;
