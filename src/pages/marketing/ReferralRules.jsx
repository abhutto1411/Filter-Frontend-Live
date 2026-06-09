import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Plus,
  X,
  ChevronDown,
  Pencil,
} from 'lucide-react';
import {
  marketingCreateExpense,
  marketingListCampaigns,
  marketingListExpenses,
  marketingUpdateExpense,
} from '../../services/superAdminMarketingApi';
import './MarketingUniversal.css';

const categoryOptions = [
  'social_media_ads',
  'influencer_payment',
  'seo',
  'content_creation',
  'offline_marketing',
  'events',
  'tools_software',
  'other',
];

const initialForm = {
  id: '',
  campaignId: '',
  campaignName: '',
  expenseCategory: 'social_media_ads',
  vendorName: '',
  description: '',
  amount: '0',
  expenseDate: new Date().toISOString().slice(0, 10),
  receiptUrl: '',
  notes: '',
  status: '',
};

function formatSar(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0 SAR';

  return `${n.toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })} SAR`;
}

function humanize(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function humanizeLower(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .toLowerCase();
}

function formatDate(value) {
  if (!value) return '—';

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';

  return d.toLocaleDateString();
}

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeExpense(row) {
  return {
    id: String(row.id || ''),
    expenseNumber: row.expenseNumber || row.expense_number || '',
    campaignId: row.campaignId || row.campaign_id || '',
    campaignName: row.campaignName || row.campaign_name || '—',
    expenseCategory: row.expenseCategory || row.expense_category || 'other',
    vendorName: row.vendorName || row.vendor_name || '—',
    description: row.description || '',
    amount: Number(row.amount || 0),
    receiptUrl: row.receiptUrl || row.receipt_url || '',
    expenseDate: row.expenseDate || row.expense_date || '',
    notes: row.notes || '',
    status: row.status || 'pending_approval',
    rejectionReason: row.rejectionReason || row.rejection_reason || '',
  };
}

function extractExpenses(payload) {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.expenses)
      ? payload.expenses
      : Array.isArray(payload?.marketingExpenses)
        ? payload.marketingExpenses
        : Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload?.data?.expenses)
              ? payload.data.expenses
              : Array.isArray(payload?.data?.items)
                ? payload.data.items
                : [];

  return rows.map(normalizeExpense);
}

function normalizeCampaign(row) {
  const id = String(row.id || row._id || '');

  const name =
    row.campaignName ||
    row.name ||
    row.title ||
    row.campaign_name ||
    'Untitled Campaign';

  return {
    id,
    name,
  };
}

function extractCampaigns(payload) {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.campaigns)
      ? payload.campaigns
      : Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.data?.campaigns)
            ? payload.data.campaigns
            : Array.isArray(payload?.data?.items)
              ? payload.data.items
              : [];

  return rows.map(normalizeCampaign).filter((item) => item.id);
}

const SelectField = ({ value, onChange, options, placeholder }) => (
  <div className="mk-expense-select-wrap">
    <select
      className="mk-expense-input mk-expense-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {placeholder ? <option value="">{placeholder}</option> : null}

      {options.map((option) => {
        if (typeof option === 'string') {
          return (
            <option key={option} value={option}>
              {humanizeLower(option)}
            </option>
          );
        }

        return (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        );
      })}
    </select>

    <ChevronDown className="mk-expense-select-icon" size={15} strokeWidth={2} />
  </div>
);

const ExpenseStatus = ({ status }) => {
  const value = normalizeStatus(status) || 'pending_approval';

  const classNameMap = {
    draft: 'mk-status-draft',
    pending_approval: 'mk-status-pending',
    approved: 'mk-status-approved-blue',
    rejected: 'mk-status-rejected',
    paid: 'mk-status-approved',
  };

  return (
    <span className={`mk-status ${classNameMap[value] || 'mk-status-pending'}`}>
      {humanize(value)}
    </span>
  );
};

function canEditExpense(status) {
  const value = normalizeStatus(status);
  return ['draft', 'pending_approval', 'rejected'].includes(value);
}

export const ReferralRules = () => {
  const [expenses, setExpenses] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(false);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(initialForm);

  const isEditing = Boolean(form.id);

  const loadExpenses = async () => {
    try {
      setLoading(true);
      setError('');

      const res = await marketingListExpenses({
        limit: 100,
        offset: 0,
        status: 'all',
        search: search.trim(),
      });

      setExpenses(extractExpenses(res));
    } catch (err) {
      setError(err?.message || 'Failed to load expenses.');
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCampaignOptions = async () => {
    try {
      setCampaignsLoading(true);

      const res = await marketingListCampaigns({
        limit: 100,
        offset: 0,
        status: 'all',
      });

      setCampaigns(extractCampaigns(res));
    } catch {
      setCampaigns([]);
    } finally {
      setCampaignsLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
    loadCampaignOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const campaignOptions = useMemo(
    () =>
      campaigns.map((campaign) => ({
        value: campaign.id,
        label: campaign.name,
      })),
    [campaigns],
  );

  const filteredExpenses = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return expenses;

    return expenses.filter((item) => {
      const text = [
        item.expenseNumber,
        item.campaignName,
        item.expenseCategory,
        item.vendorName,
        item.description,
        item.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return text.includes(q);
    });
  }, [expenses, search]);

  const updateForm = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const updateLinkedCampaign = (campaignId) => {
    const selected = campaigns.find((item) => item.id === campaignId);

    setForm((prev) => ({
      ...prev,
      campaignId,
      campaignName: selected?.name || '',
    }));
  };

  const openCreateModal = () => {
    setForm({
      ...initialForm,
      expenseDate: new Date().toISOString().slice(0, 10),
    });
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setForm({
      id: item.id,
      campaignId: item.campaignId || '',
      campaignName: item.campaignName === '—' ? '' : item.campaignName,
      expenseCategory: item.expenseCategory || 'other',
      vendorName: item.vendorName === '—' ? '' : item.vendorName,
      description: item.description || '',
      amount: String(item.amount || ''),
      expenseDate: item.expenseDate ? String(item.expenseDate).slice(0, 10) : '',
      receiptUrl: item.receiptUrl || '',
      notes: item.notes || '',
      status: item.status || '',
    });

    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;

    setForm(initialForm);
    setShowModal(false);
  };

  const buildPayload = () => {
    const payload = {
      campaignId: form.campaignId || undefined,
      campaignName: form.campaignName.trim() || undefined,
      expenseCategory: form.expenseCategory,
      vendorName: form.vendorName.trim() || undefined,
      description: form.description.trim() || undefined,
      amount: Number(form.amount || 0),
      expenseDate: form.expenseDate || undefined,
      receiptUrl: form.receiptUrl.trim() || undefined,
      notes: form.notes.trim() || undefined,
    };

    if (!isEditing) {
      payload.status = 'pending_approval';
    }

    return payload;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.expenseCategory) {
      alert('Expense category is required.');
      return;
    }

    const amount = Number(form.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      alert('Enter valid amount.');
      return;
    }

    try {
      setSaving(true);
      setError('');

      const payload = buildPayload();

      if (isEditing) {
        await marketingUpdateExpense(form.id, payload);
      } else {
        await marketingCreateExpense(payload);
        alert('Expense request has been sent to Admin Approvals.');
      }

      closeModal();
      await loadExpenses();
    } catch (err) {
      alert(err?.message || 'Failed to save expense.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mk-page">
      <div className="mk-page-actions">
        <label className="mk-search-field">
          <Search size={15} color="#94A3B8" strokeWidth={2} />

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') loadExpenses();
            }}
            placeholder="Search expenses..."
          />
        </label>

        <button type="button" className="mk-btn-primary" onClick={openCreateModal}>
          <Plus size={16} strokeWidth={2.5} />
          New Expense
        </button>
      </div>

      {error ? <div className="mk-error-text">{error}</div> : null}

      <section className="mk-table-card">
        <table className="mk-table mk-expenses-table">
          <thead>
            <tr>
              <th>Expense #</th>
              <th>Campaign</th>
              <th>Category</th>
              <th>Vendor</th>
              <th>Amount</th>
              <th>Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="mk-empty-table">
                  Loading expenses...
                </td>
              </tr>
            ) : filteredExpenses.length === 0 ? (
              <tr>
                <td colSpan={8} className="mk-empty-table">
                  No expenses found
                </td>
              </tr>
            ) : (
              filteredExpenses.map((item) => {
                const editable = canEditExpense(item.status);

                return (
                  <tr key={item.id}>
                    <td>
                      <div className="mk-table-title">
                        {item.expenseNumber || `#${item.id}`}
                      </div>
                    </td>

                    <td>{item.campaignName || '—'}</td>
                    <td>{humanize(item.expenseCategory)}</td>
                    <td>{item.vendorName || '—'}</td>
                    <td>{formatSar(item.amount)}</td>
                    <td>{formatDate(item.expenseDate)}</td>

                    <td>
                      <ExpenseStatus status={item.status} />
                    </td>

                    <td>
                      <div className="mk-icon-actions mk-expense-actions">
                        {editable ? (
                          <button
                            type="button"
                            title="Edit"
                            className="mk-action-edit"
                            onClick={() => openEditModal(item)}
                          >
                            <Pencil size={15} />
                          </button>
                        ) : (
                          <span className="mk-action-empty">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      {showModal ? (
        <div className="mk-expense-modal-overlay">
          <div className="mk-expense-modal-card">
            <div className="mk-expense-modal-header">
              <h2>{isEditing ? 'Edit Marketing Expense' : 'New Marketing Expense'}</h2>

              <button
                type="button"
                className="mk-expense-modal-close"
                onClick={closeModal}
              >
                <X size={17} strokeWidth={2} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mk-expense-form-group">
                <label className="mk-expense-label">Category</label>
                <SelectField
                  value={form.expenseCategory}
                  onChange={(value) => updateForm('expenseCategory', value)}
                  options={categoryOptions}
                />
              </div>

              <div className="mk-expense-form-group">
                <label className="mk-expense-label">Vendor Name</label>
                <input
                  className="mk-expense-input"
                  value={form.vendorName}
                  onChange={(e) => updateForm('vendorName', e.target.value)}
                  maxLength={160}
                />
              </div>

              <div className="mk-expense-form-group">
                <label className="mk-expense-label">Description</label>
                <input
                  className="mk-expense-input"
                  value={form.description}
                  onChange={(e) => updateForm('description', e.target.value)}
                  maxLength={2000}
                />
              </div>

              <div className="mk-expense-form-grid">
                <div className="mk-expense-form-group">
                  <label className="mk-expense-label">Amount (SAR)</label>
                  <input
                    type="number"
                    min="1"
                    className="mk-expense-input"
                    value={form.amount}
                    onChange={(e) => updateForm('amount', e.target.value)}
                  />
                </div>

                <div className="mk-expense-form-group">
                  <label className="mk-expense-label">Date</label>
                  <input
                    type="date"
                    className="mk-expense-input"
                    value={form.expenseDate}
                    onChange={(e) => updateForm('expenseDate', e.target.value)}
                  />
                </div>
              </div>

              <div className="mk-expense-form-group">
                <label className="mk-expense-label">Linked Campaign (optional)</label>
                <SelectField
                  value={form.campaignId}
                  onChange={updateLinkedCampaign}
                  options={campaignOptions}
                  placeholder={
                    campaignsLoading ? 'Loading campaigns...' : 'Select campaign...'
                  }
                />
              </div>

              <div className="mk-expense-modal-footer">
                <button
                  type="button"
                  className="mk-expense-cancel-btn"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="mk-expense-submit-btn"
                  disabled={saving}
                >
                  {saving
                    ? 'Submitting...'
                    : isEditing
                      ? 'Save Expense'
                      : 'Submit Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <style>
        {`
          .mk-action-empty {
            color: #94a3b8;
            font-size: 13px;
            font-weight: 700;
          }

          .mk-expense-modal-overlay {
            position: fixed;
            inset: 0;
            z-index: 3000;
            background: rgba(15, 23, 42, 0.36);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 18px;
          }

          .mk-expense-modal-card {
            width: 356px;
            max-width: calc(100vw - 28px);
            background: #ffffff;
            border-radius: 10px;
            box-shadow: 0 16px 45px rgba(15, 23, 42, 0.24);
            padding: 17px 18px 18px;
            box-sizing: border-box;
          }

          .mk-expense-modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 8px;
          }

          .mk-expense-modal-header h2 {
            margin: 0;
            font-size: 14px;
            line-height: 1.2;
            font-weight: 800;
            color: #111827;
          }

          .mk-expense-modal-close {
            width: 24px;
            height: 24px;
            border: 0;
            background: transparent;
            color: #94a3b8;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            padding: 0;
          }

          .mk-expense-modal-close:hover {
            color: #111827;
          }

          .mk-expense-form-group {
            margin-bottom: 10px;
          }

          .mk-expense-label {
            display: block;
            font-size: 10px;
            font-weight: 650;
            color: #334155;
            margin-bottom: 5px;
            line-height: 1.1;
          }

          .mk-expense-input {
            width: 100%;
            height: 28px;
            border: 1px solid #dbe1ea;
            background: #ffffff;
            border-radius: 7px;
            padding: 0 9px;
            box-sizing: border-box;
            font-size: 11px;
            font-weight: 500;
            color: #111827;
            outline: none;
            font-family: inherit;
          }

          .mk-expense-input:focus,
          .mk-expense-select-wrap:focus-within {
            border-color: #eab308;
            box-shadow: 0 0 0 1px rgba(234, 179, 8, 0.35);
          }

          .mk-expense-form-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }

          .mk-expense-select-wrap {
            position: relative;
            width: 100%;
            height: 28px;
            border: 1px solid #dbe1ea;
            border-radius: 7px;
            background: #ffffff;
            box-sizing: border-box;
          }

          .mk-expense-select {
            border: 0;
            box-shadow: none;
            appearance: none;
            padding-right: 28px;
            background: transparent;
            height: 26px;
          }

          .mk-expense-select:focus {
            box-shadow: none;
          }

          .mk-expense-select-icon {
            position: absolute;
            right: 8px;
            top: 50%;
            transform: translateY(-50%);
            color: #94a3b8;
            pointer-events: none;
          }

          .mk-expense-modal-footer {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 8px;
            padding-top: 6px;
          }

          .mk-expense-cancel-btn,
          .mk-expense-submit-btn {
            height: 28px;
            border-radius: 7px;
            padding: 0 14px;
            font-size: 10px;
            font-weight: 800;
            cursor: pointer;
          }

          .mk-expense-cancel-btn {
            background: #ffffff;
            border: 1px solid #dbe1ea;
            color: #334155;
          }

          .mk-expense-submit-btn {
            background: #eab308;
            border: 1px solid #eab308;
            color: #ffffff;
          }

          .mk-expense-submit-btn:hover {
            background: #d69e05;
            border-color: #d69e05;
          }

          .mk-expense-cancel-btn:disabled,
          .mk-expense-submit-btn:disabled {
            opacity: 0.65;
            cursor: not-allowed;
          }
        `}
      </style>
    </div>
  );
};

export default ReferralRules;