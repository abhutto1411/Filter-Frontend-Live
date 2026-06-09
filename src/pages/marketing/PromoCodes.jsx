import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  Search,
  X,
  Tag,
  Copy,
  ChevronDown,
  Hourglass,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import './MarketingUniversal.css';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const ROOT = '/super-admin-marketing-protal';

const ENDPOINTS = {
  promoCodes: `${ROOT}/promo-codes`,
  promoCodeOptions: `${ROOT}/promo-code-options`,
};
const statusOptions = ['Active', 'Inactive', 'Expired'];

const discountTypeOptions = [
  { label: 'Percentage (%)', value: 'Percentage (%)' },
  { label: 'Fixed Amount (SAR)', value: 'Fixed Amount (SAR)' },
];

const getHeaders = () => {
  const token =
    localStorage.getItem('access_token') ||
    localStorage.getItem('token') ||
    localStorage.getItem('filter_auth_token') ||
    localStorage.getItem('base44_token');

  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const buildUrl = (endpoint) => `${API_BASE_URL}${endpoint}`;

const safeArray = (response, keys = []) => {
  if (Array.isArray(response)) return response;

  for (const key of keys) {
    if (Array.isArray(response?.[key])) return response[key];
    if (Array.isArray(response?.data?.[key])) return response.data[key];
  }

  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.records)) return response.records;
  if (Array.isArray(response?.results)) return response.results;

  return [];
};

const apiGet = async (endpoint, query = {}) => {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, value);
    }
  });

  const url = `${buildUrl(endpoint)}${params.toString() ? `?${params}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
    credentials: 'include',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `GET ${endpoint} failed`);
  }

  return response.json();
};

const apiPost = async (endpoint, body = {}) => {
  const response = await fetch(buildUrl(endpoint), {
    method: 'POST',
    headers: getHeaders(),
    credentials: 'include',
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `POST ${endpoint} failed`);
  }

  return response.json();
};

const apiDelete = async (endpoint) => {
  const response = await fetch(buildUrl(endpoint), {
    method: 'DELETE',
    headers: getHeaders(),
    credentials: 'include',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `DELETE ${endpoint} failed`);
  }

  return response.json();
};

const randomCode = () => {
  return Math.random().toString(36).slice(2, 9).toUpperCase();
};

const toDateTimeLocal = (value) => {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);

  return localDate.toISOString().slice(0, 16);
};

const normalizeOption = (item, fallbackPrefix) => {
  const id =
    item?.id ||
    item?._id ||
    item?.value ||
    `${fallbackPrefix}-${Math.random().toString(36).slice(2)}`;

  const label =
    item?.label ||
    item?.name ||
    item?.title ||
    item?.code ||
    item?.sku ||
    item?.branchName ||
    item?.zoneName ||
    `${fallbackPrefix} ${id}`;

  return {
    ...item,
    id: String(id),
    value: String(item?.value || id),
    label,
    realId: String(item?.realId || id),
  };
};

const normalizePromoCode = (item) => {
  const statusRaw = String(item?.status || 'active').toLowerCase();

  const statusMap = {
    active: 'Active',
    inactive: 'Inactive',
    expired: 'Expired',
  };

  return {
    ...item,
    id: String(item?.id || item?._id || Date.now()),
    code: item?.code || '-',
    promotion:
      item?.promotion_name ||
      item?.promotionName ||
      item?.promotion ||
      '',
    promotionId: item?.promotion_id || item?.promotionId || '',
    discountType: item?.discount_type || item?.discountType || 'percentage',
    discountValue: item?.discount_value ?? item?.discountValue ?? 0,
    minPurchase: item?.min_purchase_amount ?? item?.minPurchaseAmount ?? 0,
    maxUsage: item?.max_usage_count ?? item?.maxUsageCount ?? 0,
    currentUsage:
      item?.current_usage_count ?? item?.currentUsageCount ?? 0,
    validFrom: item?.valid_from || item?.validFrom || '',
    validUntil: item?.valid_until || item?.validTo || '',
    showSavings: Boolean(item?.show_on_invoice ?? item?.showOnInvoice ?? false),
    notes: item?.notes || '',
    status: statusMap[statusRaw] || 'Active',
  };
};

const mapDiscountTypeToBackend = (value) => {
  const raw = String(value || '').toLowerCase();

  if (raw.includes('fixed') || raw.includes('sar')) return 'fixed_amount';

  return 'percentage';
};

const mapDiscountTypeToUi = (value) => {
  const raw = String(value || '').toLowerCase();

  if (raw.includes('fixed')) return 'Fixed Amount (SAR)';

  return 'Percentage (%)';
};

const mapStatusToBackend = (value) => {
  const raw = String(value || '').toLowerCase();

  if (raw === 'inactive') return 'inactive';
  if (raw === 'expired') return 'expired';

  return 'active';
};

const SelectField = ({ value, onChange, options }) => {
  return (
    <div className="mk-code-select-wrap">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mk-code-input mk-code-select"
      >
        {options.map((option) => (
          <option key={option.value || option} value={option.value || option}>
            {option.label || option}
          </option>
        ))}
      </select>

      <ChevronDown size={14} strokeWidth={2} className="mk-code-select-icon" />
    </div>
  );
};

const PromotionSelect = ({
  value,
  onChange,
  options,
  loading,
  error,
}) => {
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleOutside = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutside);

    return () => {
      document.removeEventListener('mousedown', handleOutside);
    };
  }, []);

  const selected = useMemo(() => {
    return options.find((item) => item.id === value) || null;
  }, [options, value]);

  return (
    <div className="mk-code-form-group mk-code-dd-wrap" ref={wrapRef}>
      <label className="mk-code-label">Link to Promotion (optional)</label>

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`mk-code-dd-btn ${open ? 'open' : ''}`}
      >
        <span>{loading ? 'Loading...' : selected?.label || 'Select promotion...'}</span>
        <ChevronDown size={14} />
      </button>

      {open ? (
        <div className="mk-code-dd-menu">
          <div className="mk-code-dd-list no-search">
            {loading ? (
              <div className="mk-code-dd-empty">
                <Loader2 size={14} className="mk-code-spin" />
                Loading promotions...
              </div>
            ) : error ? (
              <div className="mk-code-dd-empty error">
                <AlertCircle size={14} />
                {error}
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className={`mk-code-dd-option ${value === '' ? 'selected' : ''}`}
                  onClick={() => {
                    onChange('');
                    setOpen(false);
                  }}
                >
                  Select promotion...
                </button>

                {options.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={`mk-code-dd-option ${
                      value === item.id ? 'selected' : ''
                    }`}
                    onClick={() => {
                      onChange(item.id);
                      setOpen(false);
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const Toggle = ({ checked, onChange, label }) => {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="mk-code-toggle-btn"
    >
      <span className={checked ? 'mk-code-toggle active' : 'mk-code-toggle'}>
        <span />
      </span>

      {label}
    </button>
  );
};

const GenerateCodeModal = ({
  open,
  onClose,
  onSubmit,
  form,
  setForm,
  promotions,
  loadingOptions,
  optionsError,
  submitting,
}) => {
  if (!open) return null;

  const update = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handlePromotionChange = (promotionId) => {
    const selected = promotions.find((item) => item.id === promotionId);

    setForm((prev) => ({
      ...prev,
      promotionId,
      promotionName: selected?.label || '',
      discountType: selected?.discountType
        ? mapDiscountTypeToUi(selected.discountType)
        : prev.discountType,
      discountValue:
        selected?.discountValue !== undefined && selected?.discountValue !== null
          ? String(selected.discountValue)
          : prev.discountValue,
      validFrom: selected?.validFrom
        ? toDateTimeLocal(selected.validFrom)
        : prev.validFrom,
      validUntil: selected?.validTo
        ? toDateTimeLocal(selected.validTo)
        : prev.validUntil,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!form.code.trim()) {
      alert('Promo code is required.');
      return;
    }

    if (!form.discountValue) {
      alert('Discount value is required.');
      return;
    }

    onSubmit();
  };

  return (
    <div className="mk-code-modal-overlay">
      <div className="mk-code-modal">
        <div className="mk-code-modal-header">
          <h2>Generate Promo Code</h2>

          <button type="button" onClick={onClose} className="mk-code-close-btn">
            <X size={17} strokeWidth={2} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mk-code-modal-form">
          <div className="mk-code-form-group">
            <label className="mk-code-label">Promo Code *</label>

            <div className="mk-code-row">
              <input
                autoFocus
                value={form.code}
                onChange={(e) => update('code', e.target.value.toUpperCase())}
                placeholder="e.g. RAMADAN50"
                className="mk-code-input mk-code-focus-input mk-code-flex-input"
              />

              <button
                type="button"
                onClick={() => update('code', randomCode())}
                className="mk-code-auto-btn"
              >
                Auto
              </button>
            </div>
          </div>

          <PromotionSelect
            value={form.promotionId}
            onChange={handlePromotionChange}
            options={promotions}
            loading={loadingOptions}
            error={optionsError}
          />

          <div className="mk-code-two-col">
            <div className="mk-code-form-group">
              <label className="mk-code-label">Discount Type</label>

              <SelectField
                value={form.discountType}
                onChange={(value) => update('discountType', value)}
                options={discountTypeOptions}
              />
            </div>

            <div className="mk-code-form-group">
              <label className="mk-code-label">Discount Value</label>

              <input
                value={form.discountValue}
                onChange={(e) => update('discountValue', e.target.value)}
                className="mk-code-input"
              />
            </div>
          </div>

          <div className="mk-code-two-col">
            <div className="mk-code-form-group">
              <label className="mk-code-label">Min. Purchase (SAR)</label>

              <input
                type="number"
                value={form.minPurchase}
                onChange={(e) => update('minPurchase', e.target.value)}
                className="mk-code-input"
              />
            </div>

            <div className="mk-code-form-group">
              <label className="mk-code-label">Max Usage (0=unlimited)</label>

              <input
                type="number"
                value={form.maxUsage}
                onChange={(e) => update('maxUsage', e.target.value)}
                className="mk-code-input"
              />
            </div>
          </div>

          <div className="mk-code-two-col">
            <div className="mk-code-form-group">
              <label className="mk-code-label">Valid From</label>

              <input
                type="datetime-local"
                value={form.validFrom}
                onChange={(e) => update('validFrom', e.target.value)}
                className="mk-code-input"
              />
            </div>

            <div className="mk-code-form-group">
              <label className="mk-code-label">Valid Until</label>

              <input
                type="datetime-local"
                value={form.validUntil}
                onChange={(e) => update('validUntil', e.target.value)}
                className="mk-code-input"
              />
            </div>
          </div>

          <div className="mk-code-form-group">
            <label className="mk-code-label">Status</label>

            <SelectField
              value={form.status}
              onChange={(value) => update('status', value)}
              options={statusOptions}
            />
          </div>

          <div className="mk-code-form-group">
            <Toggle
              checked={form.showSavings}
              onChange={(value) => update('showSavings', value)}
              label="Show code savings on invoice"
            />
          </div>

          <div className="mk-code-form-group">
            <label className="mk-code-label">Notes</label>

            <textarea
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              placeholder="Internal notes..."
              className="mk-code-textarea"
            />
          </div>

          <div className="mk-code-approval-note">
            <Hourglass size={14} strokeWidth={2} />
            <span>
              This code will be sent to <b>Super Admin for approval</b> before activation.
            </span>
          </div>

          <div className="mk-code-modal-footer">
            <button type="button" onClick={onClose} className="mk-code-cancel-btn">
              Cancel
            </button>

            <button type="submit" className="mk-code-submit-btn" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 size={14} className="mk-code-spin" />
                  Submitting...
                </>
              ) : (
                'Submit for Approval'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const PromoCodes = () => {
  const [codes, setCodes] = useState([]);
  const [promotions, setPromotions] = useState([]);

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  const [loadingCodes, setLoadingCodes] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [pageError, setPageError] = useState('');
  const [optionsError, setOptionsError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const emptyForm = {
    code: '',
    promotionId: '',
    promotionName: '',
    discountType: 'Percentage (%)',
    discountValue: '',
    minPurchase: '0',
    maxUsage: '0',
    validFrom: '',
    validUntil: '',
    status: 'Active',
    showSavings: true,
    notes: '',
  };

  const [form, setForm] = useState(emptyForm);

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

  const resetForm = () => {
    setForm(emptyForm);
  };

  const loadCodes = async () => {
    try {
      setLoadingCodes(true);
      setPageError('');

      const data = await apiGet(ENDPOINTS.promoCodes, {
        limit: 200,
        offset: 0,
        status: 'all',
      });

      setCodes(
        safeArray(data, ['promoCodes', 'items', 'data']).map(normalizePromoCode)
      );
    } catch (error) {
      console.error('Promo codes load error:', error);
      setPageError('Promo codes API load nahi hui.');
      setCodes([]);
    } finally {
      setLoadingCodes(false);
    }
  };

  const loadOptions = async () => {
    try {
      setLoadingOptions(true);
      setOptionsError('');

      const data = await apiGet(ENDPOINTS.promoCodeOptions);

      const promotionOptions = safeArray(data, ['promotions']).map((item) => {
        const option = normalizeOption(item, 'Promotion');

        return {
          ...option,
          discountType: item.discountType || item.discount_type || '',
          discountValue: item.discountValue ?? item.discount_value ?? '',
          validFrom: item.validFrom || item.valid_from || '',
          validTo: item.validTo || item.valid_until || '',
        };
      });

      setPromotions(promotionOptions);
    } catch (error) {
      console.error('Promo code options error:', error);
      setOptionsError('Options load nahi huay.');
      setPromotions([]);
    } finally {
      setLoadingOptions(false);
    }
  };

  useEffect(() => {
    loadCodes();
    loadOptions();
  }, []);

  const openModal = () => {
    resetForm();
    setSuccessMessage('');
    setShowModal(true);
    loadOptions();
  };

  const closeModal = () => {
    if (submitting) return;

    setShowModal(false);
    resetForm();
  };

  const createPayload = () => {
    return {
      code: form.code.trim().toUpperCase(),

      promotion_id: form.promotionId || null,
      promotionId: form.promotionId || null,
      promotion_name: form.promotionName || null,
      promotionName: form.promotionName || null,

      discount_type: mapDiscountTypeToBackend(form.discountType),
      discountType: mapDiscountTypeToBackend(form.discountType),

      discount_value: Number(form.discountValue || 0),
      discountValue: Number(form.discountValue || 0),

      min_purchase_amount: Number(form.minPurchase || 0),
      minPurchaseAmount: Number(form.minPurchase || 0),

      max_usage_count: Number(form.maxUsage || 0),
      maxUsageCount: Number(form.maxUsage || 0),

      current_usage_count: 0,
      currentUsageCount: 0,

      valid_from: form.validFrom || null,
      validFrom: form.validFrom || null,

      valid_until: form.validUntil || null,
      validTo: form.validUntil || null,

      show_on_invoice: form.showSavings,
      showOnInvoice: form.showSavings,

      notes: form.notes,
      status: mapStatusToBackend(form.status),
    };
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setSuccessMessage('');

      await apiPost(ENDPOINTS.promoCodes, createPayload());

      await loadCodes();

      closeModal();

      setSuccessMessage('Promo code create ho gaya.');
    } catch (error) {
      console.error('Promo code create error:', error);
      alert('Promo code save nahi hua. Console aur Network tab check karo.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      alert('Code copied');
    } catch {
      alert('Could not copy code');
    }
  };

  const handleDelete = async (id) => {
    const ok = window.confirm('Are you sure you want to delete this promo code?');

    if (!ok) return;

    try {
      await apiDelete(`${ENDPOINTS.promoCodes}/${id}`);
      await loadCodes();
      setSuccessMessage('Promo code delete ho gaya.');
    } catch (error) {
      console.error('Promo code delete error:', error);
      alert('Promo code delete nahi hua.');
    }
  };

  return (
    <div className="mk-page mk-code-page">
      <div className="mk-code-header">
        <div>
          <h1 className="mk-code-title">Promo Codes</h1>
          <p className="mk-code-subtitle">
            Generate and validate promo codes — codes appear on POS and invoices
          </p>
        </div>

        <button type="button" onClick={openModal} className="mk-code-new-btn">
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

      <div className="mk-code-content-area">
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
          <div className="mk-code-table-wrap">
            <table className="mk-code-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Promotion</th>
                  <th>Type</th>
                  <th>Value</th>
                  <th>Usage</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredCodes.map((item) => (
                  <tr key={item.id}>
                    <td className="mk-code-td-strong">{item.code}</td>
                    <td>{item.promotion || '-'}</td>
                    <td>{mapDiscountTypeToUi(item.discountType)}</td>
                    <td>{item.discountValue || '-'}</td>
                    <td>
                      {item.currentUsage || 0}
                      {item.maxUsage ? ` / ${item.maxUsage}` : ''}
                    </td>
                    <td>
                      <span
                        className={`mk-code-status-badge status-${String(
                          item.status
                        )
                          .toLowerCase()
                          .replace(/\s+/g, '-')}`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td>
                      <div className="mk-code-actions">
                        <button
                          type="button"
                          onClick={() => handleCopy(item.code)}
                          className="mk-code-copy-btn"
                        >
                          <Copy size={13} strokeWidth={2} />
                          Copy
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="mk-code-delete-btn"
                        >
                          <Trash2 size={13} strokeWidth={2} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <GenerateCodeModal
        open={showModal}
        onClose={closeModal}
        onSubmit={handleSubmit}
        form={form}
        setForm={setForm}
        promotions={promotions}
        loadingOptions={loadingOptions}
        optionsError={optionsError}
        submitting={submitting}
      />
    </div>
  );
};

export default PromoCodes;