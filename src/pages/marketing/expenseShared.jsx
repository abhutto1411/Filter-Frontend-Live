import { ChevronDown } from 'lucide-react';

export const categoryOptions = [
  'social_media_ads',
  'influencer_payment',
  'seo',
  'content_creation',
  'offline_marketing',
  'events',
  'tools_software',
  'other',
];

export const initialForm = {
  id: '',
  campaignId: '',
  campaignName: '',
  expenseCategory: 'social_media_ads',
  vendorName: '',
  description: '',
  amount: '',
  expenseDate: new Date().toISOString().slice(0, 10),
  receiptUrl: '',
  notes: '',
  status: '',
};

export function humanizeLower(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .toLowerCase();
}

export function normalizeExpense(row) {
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

export function extractExpenses(payload) {
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

export function normalizeCampaign(row) {
  const id = String(row.id || row._id || '');
  const name =
    row.campaignName ||
    row.name ||
    row.title ||
    row.campaign_name ||
    'Untitled Campaign';
  return { id, name };
}

export function extractCampaigns(payload) {
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

export function humanize(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function formatSar(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0 SAR';
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} SAR`;
}

export function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase();
}

export function canEditExpense(status) {
  const value = normalizeStatus(status);
  return ['draft', 'pending_approval', 'rejected'].includes(value);
}

export const ExpenseStatus = ({ status }) => {
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

export const SelectField = ({ value, onChange, options, placeholder }) => (
  <div className="mkp-select-wrap">
    <select
      className="mkp-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((option) => {
        if (typeof option === 'string') {
          return (
            <option key={option} value={option}>
              {humanize(option)}
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
    <ChevronDown className="mkp-select-icon" size={15} strokeWidth={2} />
  </div>
);
