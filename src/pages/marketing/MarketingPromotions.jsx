import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import {
  Plus,
  Search,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Tag,
  Edit3,
  Trash2,
  Clock3,
  Eye,
  FileBarChart,
  Smartphone,
} from 'lucide-react';
import {
  riderAppListWorkshopOffers,
  riderAppSetWorkshopOffer,
} from '../../services/riderAppMarketingApi';
import { riderAppT } from '../../utils/riderAppPromotionsI18n';
import { listFrom } from './riderAppPromotionUtils';
import {
  marketingDeletePromotion,
  marketingListPromotions,
  marketingSetPromotionActivation,
} from '../../services/superAdminMarketingApi';
import {
  mktPromoOptionLabel,
  mktPromoSelectOptions,
  mktPromoT,
  resolveMarketingLocale,
} from '../../utils/marketingPromotionsI18n';
import {
  activationToggleHint,
  canTogglePromotionActivation,
  filterStatusOptions,
  formatEndDate,
  formatPromotionSar,
  formatPromotionDiscountDisplay,
  formatPromotionUsageLabel,
  formatStatusLabel,
  isPromotionLiveOnPos,
  normalizePromotion,
  resolvePromotionBasePath,
  safeArray,
  SelectField,
} from './marketingPromotionShared';
import '../../styles/ui.css';

/** Promotion workflow status, named by what it means rather than by colour. */
const PROMO_STATUS_TONE = {
  active: 'ok',
  approved: 'ok',
  scheduled: 'info',
  inactive: 'neutral',
  draft: 'neutral',
  pending: 'warn',
  pending_approval: 'warn',
  expired: 'neutral',
  rejected: 'dang',
};

/** What the Rider sync last reported for an offer. */
const SYNC_TONE = { LIVE: 'ok', PENDING: 'warn', INACTIVE: 'neutral', ERROR: 'dang' };

export const MarketingPromotions = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const outletCtx = useOutletContext() || {};
  const locale = resolveMarketingLocale(outletCtx);
  const t = useCallback((key, vars) => mktPromoT(locale, key, vars), [locale]);
  const marketingWorkshopId = outletCtx.marketingWorkshopId ?? '';

  const [promotions, setPromotions] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [loadingPage, setLoadingPage] = useState(false);
  const [togglingActivationId, setTogglingActivationId] = useState(null);
  const [pageError, setPageError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  // "Show on Rider app" (workshop offer) settings, keyed by ERP promotion id.
  const [riderOffers, setRiderOffers] = useState({});
  const [togglingOfferId, setTogglingOfferId] = useState(null);
  const rt = useCallback((key, vars) => riderAppT(locale, key, vars), [locale]);

  const listPath = resolvePromotionBasePath(location.pathname);
  const statusSelectOptions = useMemo(
    () => mktPromoSelectOptions(locale, filterStatusOptions),
    [locale],
  );

  const filteredPromotions = useMemo(() => {
    const q = search.trim().toLowerCase();

    return promotions.filter((item) => {
      const matchesWorkshop =
        !marketingWorkshopId ||
        String(item.sourceWorkshopId || item.workshopId || '') ===
          String(marketingWorkshopId);

      const matchesSearch = !q || item.name.toLowerCase().includes(q);
      const uiStatus =
        String(item.status || '').charAt(0).toUpperCase() +
        String(item.status || '').slice(1);

      const matchesStatus =
        statusFilter === 'All Statuses' ||
        item.status === statusFilter ||
        uiStatus === statusFilter ||
        String(item.status || '').toLowerCase() ===
          statusFilter.toLowerCase().replace(/\s+/g, '_');

      return matchesWorkshop && matchesSearch && matchesStatus;
    });
  }, [promotions, search, statusFilter, marketingWorkshopId]);

  const loadPromotions = async () => {
    try {
      setLoadingPage(true);
      setPageError('');

      const data = await marketingListPromotions({
        limit: 200,
        offset: 0,
        status: 'all',
      });

      setPromotions(
        safeArray(data, ['promotions', 'items', 'data']).map(normalizePromotion),
      );
    } catch (error) {
      console.error('Promotion API error:', error);
      setPageError(error?.message || t('err.load'));
      setPromotions([]);
    } finally {
      setLoadingPage(false);
    }
  };

  // Separate from loadPromotions so a Rider-side problem never hides the ERP list.
  const loadRiderOffers = async () => {
    try {
      const rows = listFrom(await riderAppListWorkshopOffers());
      setRiderOffers(
        Object.fromEntries(rows.map((row) => [String(row.filterPromotionId), row])),
      );
    } catch (error) {
      console.error('Rider app offers API error:', error);
    }
  };

  useEffect(() => {
    loadPromotions();
    loadRiderOffers();
  }, [marketingWorkshopId]);

  const openRiderPromotions = () => navigate(`${listPath}/rider-app`);
  const openNewRiderPromotion = () => navigate(`${listPath}/rider-app/new`);

  /**
   * After a toggle, check every few seconds until the Rider sync has reported
   * the expected outcome (it runs about every 30 s), then say what happened.
   * The offer is only shown in the app while the ERP promotion itself is active.
   */
  const waitForRiderSync = async (promotionId, expectedStatus) => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      try {
        const rows = listFrom(await riderAppListWorkshopOffers());
        const map = Object.fromEntries(
          rows.map((row) => [String(row.filterPromotionId), row]),
        );
        setRiderOffers(map);
        const row = map[String(promotionId)];
        if (row?.syncStatus === 'ERROR') return row;
        if (row?.syncStatus === expectedStatus) return row;
      } catch (error) {
        console.error('Rider app offers poll error:', error);
      }
    }
    return null;
  };

  const handleToggleRiderOffer = async (item) => {
    const current = riderOffers[String(item.id)];
    const nextEnabled = !current?.enabled;
    // Same rule as the Rider sync: the Rider toggle decides (POS on/off does not),
    // but the ERP promotion must be approved (not draft / pending / rejected / expired).
    const promotionLive = ['approved', 'scheduled', 'active', 'inactive'].includes(
      String(item.status || '').trim().toLowerCase().replace(/\s+/g, '_'),
    );
    const expectedStatus = nextEnabled && promotionLive ? 'LIVE' : 'INACTIVE';
    try {
      setTogglingOfferId(item.id);
      setPageError('');
      const saved = await riderAppSetWorkshopOffer(item.id, { enabled: nextEnabled });
      setRiderOffers((prev) => ({ ...prev, [String(item.id)]: { ...current, ...saved } }));
      setSuccessMessage(rt('sync.waiting'));

      const result = await waitForRiderSync(item.id, expectedStatus);
      if (!result) {
        setSuccessMessage(rt('offer.slow'));
      } else if (result.syncStatus === 'ERROR') {
        setSuccessMessage('');
        setPageError(`${rt('sync.ERROR')}: ${result.syncError || ''}`);
      } else if (result.syncStatus === 'LIVE') {
        setSuccessMessage(rt('offer.liveNow'));
      } else if (nextEnabled && !promotionLive) {
        setSuccessMessage(rt('offer.savedNeedsActive'));
      } else {
        setSuccessMessage(rt('offer.hiddenNow'));
      }
    } catch (error) {
      console.error('Toggle Rider app offer error:', error);
      setPageError(error?.message || rt('err.action'));
    } finally {
      setTogglingOfferId(null);
    }
  };

  const openNewPage = () => navigate(`${listPath}/new`);
  const openEditPage = (id) => navigate(`${listPath}/${id}/edit`);
  const openViewPage = (id) => navigate(`${listPath}/${id}/view`);
  const openDetailsPage = (id) => navigate(`${listPath}/${id}/details`);
  const openAutoReportPage = (id) => navigate(`${listPath}/${id}/auto-report`);

  const handleDelete = async (id) => {
    const ok = window.confirm(t('confirm.delete'));
    if (!ok) return;

    try {
      await marketingDeletePromotion(id);
      await loadPromotions();
      setSuccessMessage(t('msg.deleted'));
    } catch (error) {
      console.error('Delete promotion error:', error);
      setPageError(error?.message || t('err.delete'));
    }
  };

  const handleToggleActivation = async (item) => {
    if (!canTogglePromotionActivation(item)) return;

    const nextActive = !item.isActive;

    try {
      setTogglingActivationId(item.id);
      setPageError('');

      const response = await marketingSetPromotionActivation(item.id, nextActive);
      const updated =
        response?.promotion || response?.data || response?.item || response;

      if (updated && updated.id) {
        const normalized = normalizePromotion(updated);
        setPromotions((prev) =>
          prev.map((row) => (row.id === normalized.id ? normalized : row)),
        );
      } else {
        await loadPromotions();
      }

      setSuccessMessage(
        nextActive ? t('msg.activated') : t('msg.deactivated'),
      );
    } catch (error) {
      console.error('Toggle promotion activation error:', error);
      setPageError(error?.message || t('err.activation'));
    } finally {
      setTogglingActivationId(null);
    }
  };

  return (
    <div className="ui-root ui-root--flush ui-stack">
      <div className="ui-row ui-row--fields">
        <div className="ui-field ui-field--grow">
          <label htmlFor="mkp-search">{t('search.label')}</label>
          <div className="ui-search">
            <Search size={15} />
            <input
              id="mkp-search"
              className="ui-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('search.placeholder')}
            />
          </div>
        </div>

        <div className="ui-field">
          <label>{t('filter.statusLabel')}</label>
          <SelectField
            value={statusFilter}
            onChange={setStatusFilter}
            options={statusSelectOptions}
            locale={locale}
            small
          />
        </div>

        <div className="ui-toolbar-end">
          <button type="button" className="ui-btn ui-btn--default" onClick={openRiderPromotions}>
            {rt('btn.riderPromotions')}
          </button>
          <button type="button" className="ui-btn ui-btn--default" onClick={openNewRiderPromotion}>
            <Smartphone size={15} />
            {rt('btn.newRiderPromotion')}
          </button>
          <button type="button" className="ui-btn ui-btn--primary" onClick={openNewPage}>
            <Plus size={15} />
            {t('btn.new')}
          </button>
        </div>
      </div>

      {successMessage ? (
        <div className="ui-banner ui-banner--ok" role="status">
          <CheckCircle2 size={14} />
          <span>{successMessage}</span>
        </div>
      ) : null}

      {pageError ? (
        <div className="ui-banner ui-banner--dang" role="alert">
          <AlertCircle size={14} />
          <span>{pageError}</span>
        </div>
      ) : null}

      <div>
        {loadingPage ? (
          <div className="ui-panels">
            {Array.from({ length: 6 }).map((_, i) => (
              <section key={`sk-${i}`} className="ui-panel ui-panel-pad ui-stack-sm" aria-busy="true">
                <div className="ui-sk ui-sk--strong ui-sk--w70" />
                <div className="ui-sk ui-sk--text ui-sk--w90" />
                <div className="ui-sk ui-sk--text ui-sk--w55" />
              </section>
            ))}
          </div>
        ) : filteredPromotions.length === 0 ? (
          <div className="ui-empty">
            <div className="ui-empty-icon"><Tag size={18} /></div>
            <div className="ui-empty-title">{t('empty.none')}</div>
            <button type="button" className="ui-btn ui-btn--primary" onClick={openNewPage}>
              <Plus size={14} /> {t('btn.new')}
            </button>
          </div>
        ) : (
          <div className="ui-panels">
            {filteredPromotions.map((item) => {
              const offer = riderOffers[String(item.id)];
              const canToggle = canTogglePromotionActivation(item);
              return (
              <section
                key={item.id}
                className={`ui-panel${isPromotionLiveOnPos(item) ? ' ui-panel--live' : ''}`}
              >
                <div
                  className="ui-panel-head ui-panel-head--click"
                  onClick={() => openDetailsPage(item.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openDetailsPage(item.id);
                    }
                  }}
                >
                  <span className="ui-avatar" aria-hidden>
                    <Tag size={15} />
                  </span>

                  <div>
                    <div className="ui-panel-title">{item.name}</div>
                    <div className="ui-help">
                      {mktPromoOptionLabel(locale, item.strategy)} ·{' '}
                      {mktPromoOptionLabel(locale, item.promotionType)} ·{' '}
                      {t('label.value')}{' '}
                      {formatPromotionDiscountDisplay(item, locale)}
                    </div>
                  </div>

                  <div className="ui-panel-end ui-rowacts">
                    <span className={`ui-pill ui-pill--${PROMO_STATUS_TONE[String(item.status).toLowerCase()] || 'neutral'}`}>
                      {formatStatusLabel(item.status, locale)}
                    </span>
                  </div>
                </div>

                <div className="ui-panel-pad ui-stack-sm">
                  <div className="ui-meta">
                    <span>
                      <Clock3 size={13} /> {formatEndDate(item.endDate, locale)}
                    </span>
                  </div>

                  <div className="ui-fields">
                    <div className="ui-fieldro">
                      <span className="ui-fieldro-label">{t('stat.usage')}</span>
                      <span className="ui-fieldro-value">
                        {formatPromotionUsageLabel(item, locale)}
                      </span>
                    </div>
                    <div className="ui-fieldro">
                      <span className="ui-fieldro-label">{t('stat.discountGiven')}</span>
                      <span className="ui-fieldro-value">
                        {formatPromotionSar(item.totalDiscountProvided, locale)}
                      </span>
                    </div>
                    <div className="ui-fieldro">
                      <span className="ui-fieldro-label">{t('stat.revenue')}</span>
                      <span className="ui-fieldro-value">
                        {formatPromotionSar(item.totalRevenue, locale)}
                      </span>
                    </div>
                  </div>

                  {/* POS activation */}
                  <div className="ui-row">
                    <div>
                      <div className="ui-label">{t('activation.posStatus')}</div>
                      <p className="ui-help">{activationToggleHint(item, locale)}</p>
                    </div>
                    <div className="ui-toolbar-end">
                      {togglingActivationId === item.id ? (
                        <Loader2 size={14} className="ui-spin" />
                      ) : null}
                      <label className="ui-switch" title={activationToggleHint(item, locale)}>
                        <input
                          type="checkbox"
                          checked={item.isActive}
                          disabled={!canToggle || togglingActivationId === item.id}
                          onChange={() => handleToggleActivation(item)}
                        />
                        <span className="ui-switch-track" />
                        <span className="ui-switch-text">
                          {item.isActive
                            ? t('activation.active')
                            : t('activation.inactive')}
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Show on the Rider app */}
                  <div className="ui-row">
                    <div>
                      <div className="ui-label">
                        <Smartphone size={13} /> {rt('offer.toggle')}
                      </div>
                      <p className="ui-help">{rt('offer.hint')}</p>
                    </div>
                    <div className="ui-toolbar-end">
                      {offer ? (
                        <span
                          className={`ui-pill ui-pill--${SYNC_TONE[offer.syncStatus] || 'neutral'}`}
                          title={offer.syncError || ''}
                        >
                          {rt(`sync.${offer.syncStatus}`)}
                        </span>
                      ) : null}
                      {togglingOfferId === item.id ? (
                        <Loader2 size={14} className="ui-spin" />
                      ) : null}
                      <label className="ui-switch" title={rt('offer.needsActive')}>
                        <input
                          type="checkbox"
                          checked={Boolean(offer?.enabled)}
                          disabled={togglingOfferId === item.id}
                          onChange={() => handleToggleRiderOffer(item)}
                        />
                        <span className="ui-switch-track" />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="ui-panel-foot">
                  <button
                    type="button"
                    className="ui-btn ui-btn--default ui-btn--sm"
                    onClick={() => openDetailsPage(item.id)}
                  >
                    <Eye size={14} /> {t('btn.view')}
                  </button>

                  <button
                    type="button"
                    className="ui-btn ui-btn--default ui-btn--sm"
                    onClick={() => openViewPage(item.id)}
                  >
                    <FileBarChart size={14} /> {t('btn.report')}
                  </button>

                  <button
                    type="button"
                    className="ui-btn ui-btn--default ui-btn--sm"
                    onClick={() => openAutoReportPage(item.id)}
                  >
                    <FileBarChart size={14} /> {t('btn.autoReport')}
                  </button>

                  <div className="ui-panel-end ui-rowacts">
                    <button
                      type="button"
                      className="ui-btn ui-btn--default ui-btn--sm"
                      onClick={() => openEditPage(item.id)}
                    >
                      <Edit3 size={14} /> {t('btn.edit')}
                    </button>

                    <button
                      type="button"
                      className="ui-btn ui-btn--danger ui-btn--sm"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 size={14} /> {t('btn.delete')}
                    </button>
                  </div>
                </div>
              </section>
              );
            })}
        </div>
        )}
      </div>
    </div>
  );
};

export default MarketingPromotions;
