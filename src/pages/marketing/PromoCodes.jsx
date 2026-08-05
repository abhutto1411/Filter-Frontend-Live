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
import './MarketingUniversal.css';

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
      alert(t('err.copy'));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('confirm.delete'))) return;
    try {
      await marketingDeletePromoCode(id);
      await loadCodes();
      setSuccessMessage(t('msg.deleted'));
    } catch (error) {
      alert(error?.message || t('err.delete'));
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
      alert(error?.message || t('err.activation'));
    } finally {
      setTogglingActivationId(null);
    }
  };

  return (
    <div className="mk-page mk-code-page mkp-page">
      <div className="mk-code-header">
        <div>
          <h1 className="mk-code-title">{t('page.title')}</h1>
          <p className="mk-code-subtitle">{t('page.subtitle')}</p>
        </div>

        <button type="button" onClick={openNewPage} className="mk-code-new-btn">
          <Plus size={15} strokeWidth={2.5} />
          {t('btn.generate')}
        </button>
      </div>

      {successMessage ? (
        <div className="mk-code-success-banner">
          <CheckCircle2 size={16} />
          {successMessage}
        </div>
      ) : null}

      {pageError ? (
        <div className="mk-code-error-banner">
          <AlertCircle size={16} />
          {pageError}
        </div>
      ) : null}

      <div className="mk-code-filters">
        <label className="mk-code-search">
          <Search size={13} strokeWidth={2} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search.placeholder')}
          />
        </label>
      </div>

      <div className={`mk-code-content-area${filteredCodes.length > 0 && !loadingCodes ? ' mk-code-content-area--grid' : ''}`}>
        {loadingCodes ? (
          <div className="mk-code-empty-state">
            <Loader2 size={34} className="mk-code-spin" />
            <div>{t('empty.loading')}</div>
          </div>
        ) : filteredCodes.length === 0 ? (
          <div className="mk-code-empty-state">
            <Tag size={41} strokeWidth={1.8} />
            <div>{t('empty.none')}</div>
          </div>
        ) : (
          <div className="mkp-card-list mk-code-card-list">
            {filteredCodes.map((item) => (
              <div
                key={item.id}
                className={`mkp-card ${isPromoCodeLiveOnPos(item) ? 'mkp-card-live' : ''}`}
              >
                <div
                  className="mkp-card-top mkp-card-clickable"
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
                  <div className="mkp-card-icon">
                    <Tag size={15} />
                  </div>

                  <div className="mkp-card-body">
                    <div className="mkp-card-title">{item.code}</div>
                    <div className="mkp-card-sub">
                      {item.promotion || t('label.standalone')} •{' '}
                      {mapDiscountTypeToUi(item.discountType, locale)} •{' '}
                      {t('label.value')}{' '}
                      {item.discountValue ?? '-'}
                    </div>
                    <div className="mkp-card-sub" style={{ marginTop: 4 }}>
                      {item.workshopScope || t('label.allWorkshops')} •{' '}
                      {item.branchScopeLabel || t('label.allBranches')}
                    </div>
                  </div>

                  <div className="mkp-card-badges">
                    <span
                      className={`mk-code-status-badge status-${String(item.status)
                        .toLowerCase()
                        .replace(/\s+/g, '-')}`}
                    >
                      {promoStatusLabel(locale, item.status)}
                    </span>
                  </div>
                </div>

                <div className="mkp-card-auto-report-row">
                  <button
                    type="button"
                    className="mkp-auto-report-btn"
                    onClick={() => openAutoReportPage(item.id)}
                  >
                    <FileBarChart size={14} />
                    {t('btn.autoReport')}
                  </button>
                </div>

                <div className="mkp-card-date">
                  <Clock3 size={13} />
                  {formatEndDate(item.validUntil, locale)}
                </div>

                <div className="mkp-card-stats">
                  <div className="mkp-card-stat">
                    <span className="mkp-card-stat-label">{t('stat.usage')}</span>
                    <strong>{formatPromoCodeUsageLabel(item, locale)}</strong>
                  </div>
                  <div className="mkp-card-stat">
                    <span className="mkp-card-stat-label">{t('stat.discountGiven')}</span>
                    <strong>{formatPromoCodeSar(item.totalDiscountProvided, locale)}</strong>
                  </div>
                  <div className="mkp-card-stat">
                    <span className="mkp-card-stat-label">{t('stat.revenue')}</span>
                    <strong>{formatPromoCodeSar(item.totalRevenue, locale)}</strong>
                  </div>
                </div>

                <div className="mkp-card-activation">
                  <div className="mkp-card-activation-label">
                    <span className="mkp-card-activation-title">
                      {t('activation.posStatus')}
                    </span>
                    <span className="mkp-card-activation-hint">
                      {activationToggleHint(item, locale)}
                    </span>
                  </div>

                  <button
                    type="button"
                    className={`mkp-card-activation-toggle ${
                      item.isActive ? 'on' : 'off'
                    } ${!canTogglePromoCodeActivation(item) ? 'disabled' : ''}`}
                    onClick={() => handleToggleActivation(item)}
                    disabled={
                      !canTogglePromoCodeActivation(item) ||
                      togglingActivationId === item.id
                    }
                    aria-pressed={item.isActive}
                    title={activationToggleHint(item, locale)}
                  >
                    {togglingActivationId === item.id ? (
                      <Loader2 size={14} className="mkp-spin" />
                    ) : (
                      <span className="mkp-card-activation-track">
                        <span />
                      </span>
                    )}
                    <span>
                      {item.isActive ? t('status.active') : t('status.inactive')}
                    </span>
                  </button>
                </div>

                <div className="mkp-card-footer">
                  <button type="button" onClick={() => openDetailsPage(item.id)}>
                    <Eye size={14} />
                    {t('btn.view')}
                  </button>

                  <button type="button" onClick={() => openViewPage(item.id)}>
                    <FileBarChart size={14} />
                    {t('btn.report')}
                  </button>

                  <button type="button" onClick={() => openEditPage(item.id)}>
                    <Edit3 size={14} />
                    {t('btn.edit')}
                  </button>

                  <button type="button" onClick={() => handleCopy(item.code)}>
                    <Copy size={14} />
                    {t('btn.copy')}
                  </button>

                  <button
                    type="button"
                    className="danger"
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2 size={14} />
                    {t('btn.delete')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PromoCodes;
