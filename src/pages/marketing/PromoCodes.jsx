import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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

function formatEndDate(validUntil) {
  if (!validUntil) return 'No end date';
  const date = new Date(validUntil);
  if (Number.isNaN(date.getTime())) return 'No end date';

  const diffMs = date.getTime() - Date.now();
  const diffDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

  return `Ends ${date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: '2-digit',
  })} (${diffDays}d)`;
}

export const PromoCodes = () => {
  const navigate = useNavigate();
  const location = useLocation();
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
      setCodes(safeArray(data, ['promoCodes', 'items', 'data']).map(normalizePromoCode));
    } catch (error) {
      setPageError(error?.message || 'Promo codes API load nahi hui.');
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
  }, []);

  const openNewPage = () => navigate(`${listPath}/new`);
  const openEditPage = (id) => navigate(`${listPath}/${id}/edit`);
  const openViewPage = (id) => navigate(`${listPath}/${id}/view`);
  const openAutoReportPage = (id) => navigate(`${listPath}/${id}/auto-report`);

  const handleCopy = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      setSuccessMessage(`Code "${value}" copied.`);
    } catch {
      alert('Could not copy code');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this promo code?')) return;
    try {
      await marketingDeletePromoCode(id);
      await loadCodes();
      setSuccessMessage('Promo code delete ho gaya.');
    } catch (error) {
      alert(error?.message || 'Promo code delete nahi hua.');
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
        const normalized = normalizePromoCode(updated);
        setCodes((prev) =>
          prev.map((row) => (row.id === normalized.id ? normalized : row))
        );
      } else {
        await loadCodes();
      }

      setSuccessMessage(
        nextActive
          ? 'Promo code is active and available on POS.'
          : 'Promo code is inactive and will not apply on POS.'
      );
    } catch (error) {
      alert(error?.message || 'Could not update promo code activation.');
    } finally {
      setTogglingActivationId(null);
    }
  };

  return (
    <div className="mk-page mk-code-page mkp-page">
      <div className="mk-code-header">
        <div>
          <h1 className="mk-code-title">Promo Codes</h1>
          <p className="mk-code-subtitle">
            Generate and validate promo codes — codes appear on POS and invoices
          </p>
        </div>

        <button type="button" onClick={openNewPage} className="mk-code-new-btn">
          <Plus size={15} strokeWidth={2.5} />
          Generate Code
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
            placeholder="Search by code or promotion..."
          />
        </label>
      </div>

      <div className={`mk-code-content-area${filteredCodes.length > 0 && !loadingCodes ? ' mk-code-content-area--grid' : ''}`}>
        {loadingCodes ? (
          <div className="mk-code-empty-state">
            <Loader2 size={34} className="mk-code-spin" />
            <div>Loading promo codes...</div>
          </div>
        ) : filteredCodes.length === 0 ? (
          <div className="mk-code-empty-state">
            <Tag size={41} strokeWidth={1.8} />
            <div>No promo codes yet</div>
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
                  onClick={() => openViewPage(item.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openViewPage(item.id);
                    }
                  }}
                >
                  <div className="mkp-card-icon">
                    <Tag size={15} />
                  </div>

                  <div className="mkp-card-body">
                    <div className="mkp-card-title">{item.code}</div>
                    <div className="mkp-card-sub">
                      {item.promotion || 'Standalone code'} •{' '}
                      {mapDiscountTypeToUi(item.discountType)} • Value:{' '}
                      {item.discountValue ?? '-'}
                    </div>
                    <div className="mkp-card-sub" style={{ marginTop: 4 }}>
                      {item.workshopScope || 'All workshops'} •{' '}
                      {item.branchScopeLabel || 'All branches'}
                    </div>
                  </div>

                  <div className="mkp-card-badges">
                    <span
                      className={`mk-code-status-badge status-${String(item.status)
                        .toLowerCase()
                        .replace(/\s+/g, '-')}`}
                    >
                      {item.status}
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
                    Auto Report
                  </button>
                </div>

                <div className="mkp-card-date">
                  <Clock3 size={13} />
                  {formatEndDate(item.validUntil)}
                </div>

                <div className="mkp-card-stats">
                  <div className="mkp-card-stat">
                    <span className="mkp-card-stat-label">Usage</span>
                    <strong>{formatPromoCodeUsageLabel(item)}</strong>
                  </div>
                  <div className="mkp-card-stat">
                    <span className="mkp-card-stat-label">Discount given</span>
                    <strong>{formatPromoCodeSar(item.totalDiscountProvided)}</strong>
                  </div>
                  <div className="mkp-card-stat">
                    <span className="mkp-card-stat-label">Revenue</span>
                    <strong>{formatPromoCodeSar(item.totalRevenue)}</strong>
                  </div>
                </div>

                <div className="mkp-card-activation">
                  <div className="mkp-card-activation-label">
                    <span className="mkp-card-activation-title">POS status</span>
                    <span className="mkp-card-activation-hint">
                      {activationToggleHint(item)}
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
                    title={activationToggleHint(item)}
                  >
                    {togglingActivationId === item.id ? (
                      <Loader2 size={14} className="mkp-spin" />
                    ) : (
                      <span className="mkp-card-activation-track">
                        <span />
                      </span>
                    )}
                    <span>{item.isActive ? 'Active' : 'Inactive'}</span>
                  </button>
                </div>

                <div className="mkp-card-footer">
                  <button type="button" onClick={() => openViewPage(item.id)}>
                    <Eye size={14} />
                    View Report
                  </button>

                  <button type="button" onClick={() => openEditPage(item.id)}>
                    <Edit3 size={14} />
                    Edit
                  </button>

                  <button type="button" onClick={() => handleCopy(item.code)}>
                    <Copy size={14} />
                    Copy
                  </button>

                  <button
                    type="button"
                    className="danger"
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2 size={14} />
                    Delete
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
