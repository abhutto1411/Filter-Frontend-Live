import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import {
  Plus,
  Search,
  Tag,
  Copy,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Edit3,
  Eye,
  FileBarChart,
  Clock3,
} from 'lucide-react';
import {
  marketingDeletePromoCode,
  marketingListPromoCodes,
  marketingSetPromoCodeActivation,
} from '../../services/superAdminMarketingApi';
import { promoStatusLabel, promoT } from '../../utils/promoCodesI18n';
import { marketingSectionPath } from './marketingRouteUtils';
import {
  activationToggleHint,
  canTogglePromoCodeActivation,
  formatPromoCodeSar,
  formatPromoCodeUsageLabel,
  isPromoCodeLiveOnPos,
  mapDiscountTypeToUi,
  normalizePromoCode,
  safeArray,
} from './promoCodeShared';
import '../../styles/ui.css';

function formatEndDate(validUntil, locale = 'en') {
  if (!validUntil) return promoT(locale, 'date.noEnd');
  const date = new Date(validUntil);
  if (Number.isNaN(date.getTime())) return promoT(locale, 'date.noEnd');

  const diffMs = date.getTime() - Date.now();
  const diffDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

  return promoT(locale, 'date.ends', {
    date: date.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
      month: 'short',
      day: '2-digit',
      year: '2-digit',
    }),
    days: diffDays,
  });
}

/** Promo code workflow status, named by what it means. */
const CODE_STATUS_TONE = {
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

export const PromoCodes = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const outletCtx = useOutletContext() || {};
  const locale =
    outletCtx.locale ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('marketing-locale') : null) ||
    'en';
  const t = useCallback((key, vars) => promoT(locale, key, vars), [locale]);
  const listPath = marketingSectionPath(location.pathname, 'promo-codes');

  const [codes, setCodes] = useState([]);
  const [search, setSearch] = useState('');
  const [loadingCodes, setLoadingCodes] = useState(false);
  const [togglingActivationId, setTogglingActivationId] = useState(null);
  const [pageError, setPageError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const filteredCodes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return codes.filter((item) => {
      if (!q) return true;
      return (
        String(item.code || '').toLowerCase().includes(q) ||
        String(item.promotion || '').toLowerCase().includes(q)
      );
    });
  }, [codes, search]);

  const loadCodes = async () => {
    try {
      setLoadingCodes(true);
      setPageError('');
      const data = await marketingListPromoCodes({ limit: 200, offset: 0, status: 'all' });
      setCodes(
        safeArray(data, ['promoCodes', 'items', 'data']).map((item) =>
          normalizePromoCode(item, locale)
        )
      );
    } catch (error) {
      setPageError(error?.message || t('err.load'));
      setCodes([]);
    } finally {
      setLoadingCodes(false);
    }
  };

  useEffect(() => {
    if (location.state?.successMessage) {
      setSuccessMessage(location.state.successMessage);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    loadCodes();
  }, [locale]);

  const openNewPage = () => navigate(`${listPath}/new`);
  const openEditPage = (id) => navigate(`${listPath}/${id}/edit`);
  const openViewPage = (id) => navigate(`${listPath}/${id}/view`);
  const openDetailsPage = (id) => navigate(`${listPath}/${id}/details`);
  const openAutoReportPage = (id) => navigate(`${listPath}/${id}/auto-report`);

  const handleCopy = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      setSuccessMessage(t('msg.copied', { value }));
    } catch {
      setPageError(t('err.copy'));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('confirm.delete'))) return;
    try {
      await marketingDeletePromoCode(id);
      await loadCodes();
      setSuccessMessage(t('msg.deleted'));
    } catch (error) {
      setPageError(error?.message || t('err.delete'));
    }
  };

  const handleToggleActivation = async (item) => {
    if (!canTogglePromoCodeActivation(item)) return;

    const nextActive = !item.isActive;

    try {
      setTogglingActivationId(item.id);
      setPageError('');

      const response = await marketingSetPromoCodeActivation(item.id, nextActive);
      const updated =
        response?.promoCode || response?.data || response?.item || response;

      if (updated && updated.id) {
        const normalized = normalizePromoCode(updated, locale);
        setCodes((prev) =>
          prev.map((row) => (row.id === normalized.id ? normalized : row))
        );
      } else {
        await loadCodes();
      }

      setSuccessMessage(
        nextActive ? t('msg.activated') : t('msg.deactivated')
      );
    } catch (error) {
      setPageError(error?.message || t('err.activation'));
    } finally {
      setTogglingActivationId(null);
    }
  };

  return (
    // The layout prints the page title in its own top bar, so this screen
    // does not repeat it.
    <div className="ui-root ui-root--flush ui-stack">
      <div className="ui-row ui-row--fields">
        <div className="ui-field ui-field--grow">
          <label htmlFor="pc-search">{t('search.label')}</label>
          <div className="ui-search">
            <Search size={15} />
            <input
              id="pc-search"
              className="ui-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('search.placeholder')}
            />
          </div>
        </div>

        <div className="ui-toolbar-end">
          <button type="button" className="ui-btn ui-btn--primary" onClick={openNewPage}>
            <Plus size={15} />
            {t('btn.generate')}
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
        {loadingCodes ? (
          <div className="ui-panels">
            {Array.from({ length: 6 }).map((_, i) => (
              <section key={`sk-${i}`} className="ui-panel ui-panel-pad ui-stack-sm" aria-busy="true">
                <div className="ui-sk ui-sk--strong ui-sk--w55" />
                <div className="ui-sk ui-sk--text ui-sk--w90" />
                <div className="ui-sk ui-sk--text ui-sk--w70" />
              </section>
            ))}
          </div>
        ) : filteredCodes.length === 0 ? (
          <div className="ui-empty">
            <div className="ui-empty-icon"><Tag size={18} /></div>
            <div className="ui-empty-title">{t('empty.none')}</div>
            <button type="button" className="ui-btn ui-btn--primary" onClick={openNewPage}>
              <Plus size={14} /> {t('btn.generate')}
            </button>
          </div>
        ) : (
          <div className="ui-panels">
                {filteredCodes.map((item) => {
                  const canToggle = canTogglePromoCodeActivation(item);
                  return (
                  <section
                    key={item.id}
                    className={`ui-panel${isPromoCodeLiveOnPos(item) ? ' ui-panel--live' : ''}`}
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
                        <div className="ui-panel-title">{item.code}</div>
                        <div className="ui-help">
                          {item.promotion || t('label.standalone')} ·{' '}
                          {mapDiscountTypeToUi(item.discountType, locale)} ·{' '}
                          {t('label.value')} {item.discountValue ?? '-'}
                        </div>
                        <div className="ui-help">
                          {item.workshopScope || t('label.allWorkshops')} ·{' '}
                          {item.branchScopeLabel || t('label.allBranches')}
                        </div>
                      </div>

                      <div className="ui-panel-end">
                        <span className={`ui-pill ui-pill--${CODE_STATUS_TONE[String(item.status).toLowerCase()] || 'neutral'}`}>
                          {promoStatusLabel(locale, item.status)}
                        </span>
                      </div>
                    </div>

                    <div className="ui-panel-pad ui-stack-sm">
                      <div className="ui-meta">
                        <span>
                          <Clock3 size={13} /> {formatEndDate(item.validUntil, locale)}
                        </span>
                      </div>

                      <div className="ui-fields">
                        <div className="ui-fieldro">
                          <span className="ui-fieldro-label">{t('stat.usage')}</span>
                          <span className="ui-fieldro-value">
                            {formatPromoCodeUsageLabel(item, locale)}
                          </span>
                        </div>
                        <div className="ui-fieldro">
                          <span className="ui-fieldro-label">{t('stat.discountGiven')}</span>
                          <span className="ui-fieldro-value">
                            {formatPromoCodeSar(item.totalDiscountProvided, locale)}
                          </span>
                        </div>
                        <div className="ui-fieldro">
                          <span className="ui-fieldro-label">{t('stat.revenue')}</span>
                          <span className="ui-fieldro-value">
                            {formatPromoCodeSar(item.totalRevenue, locale)}
                          </span>
                        </div>
                      </div>

                      <div className="ui-row">
                        <div>
                          <div className="ui-label">{t('activation.posStatus')}</div>
                          <p className="ui-help">{activationToggleHint(item, locale)}</p>
                        </div>
                        <div className="ui-toolbar-end">
                          {togglingActivationId === item.id ? (
                            <Loader2 size={14} className="ui-spin" />
                          ) : null}
                          <label
                            className="ui-switch"
                            title={activationToggleHint(item, locale)}
                          >
                            <input
                              type="checkbox"
                              checked={item.isActive}
                              disabled={!canToggle || togglingActivationId === item.id}
                              onChange={() => handleToggleActivation(item)}
                            />
                            <span className="ui-switch-track" />
                            <span className="ui-switch-text">
                              {item.isActive ? t('status.active') : t('status.inactive')}
                            </span>
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

                      <button
                        type="button"
                        className="ui-btn ui-btn--default ui-btn--sm"
                        onClick={() => handleCopy(item.code)}
                      >
                        <Copy size={14} /> {t('btn.copy')}
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

export default PromoCodes;
