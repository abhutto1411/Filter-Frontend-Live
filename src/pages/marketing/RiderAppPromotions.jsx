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
import Modal from '../../components/Modal';
import { BUSINESS_TIMEZONE } from '../../utils/riyadhBusinessRange';
// The shell's own chrome (back button, heading) still comes from here.
import './MarketingUniversal.css';
import '../../styles/ui.css';
import { listFrom } from './riderAppPromotionUtils';

/** What the Rider sync last reported, and what the approval flow is up to. */
const SYNC_TONE = { LIVE: 'ok', ERROR: 'dang', INACTIVE: 'neutral', PENDING: 'warn' };
const APPROVAL_TONE = {
  approved: 'ok',
  pending_approval: 'warn',
  rejected: 'dang',
  draft: 'neutral',
};

/** Rendered in the business timezone, so a validity window keeps its days. */
const formatDate = (value, locale) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-GB', {
    timeZone: BUSINESS_TIMEZONE,
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

  const [rejectItem, setRejectItem] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const closeReject = () => {
    setRejectItem(null);
    setRejectReason('');
  };

  const confirmReject = () => {
    const reason = rejectReason.trim();
    if (!rejectItem || !reason) return;
    const target = rejectItem;
    closeReject();
    run(target.id, () => riderAppRejectPromotion(target.id, reason));
  };

  return (
    <MarketingFormShell
      title={t('list.title')}
      onBack={() => navigate(listPath)}
      className="mk-page ui-tokens"
    >
      <div className="ui-stack">
        <div className="ui-row">
          <div className="ui-toolbar-end">
            <button
              type="button"
              className="ui-btn ui-btn--primary"
              onClick={() => navigate(`${listPath}/rider-app/new`)}
            >
              <Plus size={15} />
              {t('btn.newRiderPromotion')}
            </button>
          </div>
        </div>

        {notice ? (
          <div className="ui-banner ui-banner--ok" role="status">
            <CheckCircle2 size={14} />
            <span>{notice}</span>
          </div>
        ) : null}

        {error ? (
          <div className="ui-banner ui-banner--dang" role="alert">
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        ) : null}

        {loading ? (
          <div className="ui-panels">
            {Array.from({ length: 4 }).map((_, i) => (
              <section key={`sk-${i}`} className="ui-panel ui-panel-pad ui-stack-sm" aria-busy="true">
                <div className="ui-sk ui-sk--strong ui-sk--w70" />
                <div className="ui-sk ui-sk--text ui-sk--w90" />
                <div className="ui-sk ui-sk--text ui-sk--w55" />
              </section>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="ui-empty">
            <div className="ui-empty-icon"><Smartphone size={18} /></div>
            <div className="ui-empty-title">{t('list.empty')}</div>
            <button
              type="button"
              className="ui-btn ui-btn--primary"
              onClick={() => navigate(`${listPath}/rider-app/new`)}
            >
              <Plus size={14} /> {t('btn.newRiderPromotion')}
            </button>
          </div>
        ) : (
          <div className="ui-panels">
            {items.map((item) => {
              const busy = busyId === item.id;
              const services = Array.isArray(item.serviceIds) ? item.serviceIds : [];
              const canSubmit = ['draft', 'rejected'].includes(item.approvalStatus);
              const pending = item.approvalStatus === 'pending_approval';
              const approved = item.approvalStatus === 'approved';
              return (
                <section
                  key={item.id}
                  className={`ui-panel${item.syncStatus === 'LIVE' ? ' ui-panel--live' : ''}`}
                >
                  <div className="ui-panel-head">
                    <span className="ui-avatar" aria-hidden>
                      <Smartphone size={15} />
                    </span>

                    <div>
                      <div className="ui-panel-title">
                        {item.title || item.code}{' '}
                        <span className="ui-meta-ref">{item.code}</span>
                      </div>
                      <div className="ui-help">
                        {t('col.discount')}:{' '}
                        {item.discountType === 'FIXED'
                          ? t('money.sar', { amount: Number(item.discountValue) })
                          : `${Number(item.discountValue)}%`}
                        {item.maxDiscount
                          ? ` (${t('col.max')} ${t('money.sar', { amount: Number(item.maxDiscount) })})`
                          : ''}{' '}
                        ·{' '}
                        {services.length
                          ? `${services.length} ${t('col.services')}`
                          : t('col.allServices')}
                      </div>
                    </div>

                    <div className="ui-panel-end">
                      <span className={`ui-pill ui-pill--${APPROVAL_TONE[item.approvalStatus] || 'neutral'}`}>
                        {t(`approval.${item.approvalStatus}`)}
                      </span>
                    </div>
                  </div>

                  <div className="ui-panel-pad ui-stack-sm">
                    <div className="ui-meta">
                      <span>
                        <Clock3 size={13} />
                        {formatDate(item.validFrom, locale)} – {formatDate(item.validTo, locale)}
                      </span>
                      <span>
                        <span className={`ui-pill ui-pill--${SYNC_TONE[item.syncStatus] || 'neutral'}`}>
                          {t(`sync.${item.syncStatus}`)}
                        </span>
                      </span>
                    </div>

                    {item.syncStatus === 'ERROR' && item.syncError ? (
                      <p className="ui-help ui-help--err">{item.syncError}</p>
                    ) : null}

                    {item.approvalStatus === 'rejected' && item.rejectionReason ? (
                      <p className="ui-help ui-help--err">{item.rejectionReason}</p>
                    ) : null}

                    <div className="ui-row">
                      <div>
                        <div className="ui-label">{t('offer.label')}</div>
                        {approved ? null : (
                          <p className="ui-help">{t('hint.approveFirst')}</p>
                        )}
                      </div>
                      <div className="ui-toolbar-end">
                        {busy ? <Loader2 size={14} className="ui-spin" /> : null}
                        <label className="ui-switch">
                          <input
                            type="checkbox"
                            checked={Boolean(item.enabled)}
                            disabled={!approved || busy}
                            onChange={() =>
                              run(
                                item.id,
                                () => riderAppSetPromotionActivation(item.id, !item.enabled),
                                t('sync.waiting'),
                              )
                            }
                          />
                          <span className="ui-switch-track" />
                          <span className="ui-switch-text">
                            {item.enabled ? t('btn.deactivate') : t('btn.activate')}
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="ui-panel-foot">
                    <button
                      type="button"
                      className="ui-btn ui-btn--default ui-btn--sm"
                      onClick={() => navigate(`${listPath}/rider-app/${item.id}/edit`)}
                    >
                      <Edit3 size={14} />
                      {t('btn.edit')}
                    </button>

                    {canSubmit ? (
                      <button
                        type="button"
                        className="ui-btn ui-btn--default ui-btn--sm"
                        disabled={busy}
                        onClick={() => run(item.id, () => riderAppSubmitPromotion(item.id))}
                      >
                        <Send size={14} />
                        {t('btn.submit')}
                      </button>
                    ) : null}

                    {pending ? (
                      <div className="ui-panel-end ui-rowacts">
                        <button
                          type="button"
                          className="ui-btn ui-btn--danger ui-btn--sm"
                          disabled={busy}
                          onClick={() => { setRejectItem(item); setRejectReason(''); }}
                        >
                          <ThumbsDown size={14} />
                          {t('btn.reject')}
                        </button>
                        <button
                          type="button"
                          className="ui-btn ui-btn--primary ui-btn--sm"
                          disabled={busy}
                          onClick={() => run(item.id, () => riderAppApprovePromotion(item.id))}
                        >
                          <ThumbsUp size={14} />
                          {t('btn.approve')}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {rejectItem ? (
        <Modal
          title={t('btn.reject')}
          onClose={closeReject}
          width="min(520px, 96vw)"
          contentClassName="ui-tokens"
          footer={(
            <>
              <button type="button" className="ui-btn ui-btn--default" onClick={closeReject}>
                {t('form.cancel')}
              </button>
              <button
                type="button"
                className="ui-btn ui-btn--danger"
                onClick={confirmReject}
                disabled={!rejectReason.trim()}
              >
                <ThumbsDown size={14} /> {t('btn.reject')}
              </button>
            </>
          )}
        >
          <div className="ui-stack-sm">
            <p className="ui-meta">{rejectItem.title || rejectItem.code}</p>
            <div className="ui-field">
              <label htmlFor="rap-reject-reason">{t('prompt.reject')}</label>
              <textarea
                id="rap-reject-reason"
                className="ui-textarea"
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={t('reject.placeholder')}
              />
              <p className="ui-help">{t('reject.required')}</p>
            </div>
          </div>
        </Modal>
      ) : null}
    </MarketingFormShell>
  );
};

export default RiderAppPromotions;
