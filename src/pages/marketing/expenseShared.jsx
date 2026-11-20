import { ChevronDown } from 'lucide-react';
import {
  mktExpCategoryLabel,
  mktExpStatusLabel,
  mktExpT,
} from '../../utils/marketingExpensesI18n';
import { BUSINESS_TIMEZONE, toRiyadhDateISO } from '../../utils/riyadhBusinessRange';
import '../../styles/ui.css';

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
  expenseDate: toRiyadhDateISO(),
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

export function normalizeCampaign(row, locale = 'en') {
  const id = String(row.id || row._id || '');
  const name =
    row.campaignName ||
    row.name ||
    row.title ||
    row.campaign_name ||
    mktExpT(locale, 'campaign.untitled');
  return { id, name };
}

export function extractCampaigns(payload, locale = 'en') {
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

  return rows.map((row) => normalizeCampaign(row, locale)).filter((item) => item.id);
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

/** Localised: the Arabic view showed "SAR" where the rest of the app shows ر.س. */
export function formatSar(value, locale = 'en') {
  const n = Number.isFinite(Number(value)) ? Number(value) : 0;
  return mktExpT(locale, 'money.sar', {
    amount: n.toLocaleString(locale === 'ar' ? 'ar-SA' : undefined, {
      maximumFractionDigits: 0,
    }),
  });
}

/**
 * Rendered in the business timezone with an explicit format. A bare
 * toLocaleDateString() follows the viewer's zone, so an expense dated late on
 * the 1st in Riyadh read as the 31st on a machine set west of it.
 */
export function formatDate(value, locale = 'en') {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
    timeZone: BUSINESS_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase();
}

export function canEditExpense(status) {
  const value = normalizeStatus(status);
  return ['draft', 'pending_approval', 'rejected'].includes(value);
}

const EXPENSE_STATUS_TONE = {
  draft: 'neutral',
  pending_approval: 'warn',
  approved: 'info',
  rejected: 'dang',
  paid: 'ok',
};

export const ExpenseStatus = ({ status, locale = 'en' }) => {
  const value = normalizeStatus(status) || 'pending_approval';
  const tone = EXPENSE_STATUS_TONE[value] || 'warn';
  return (
    <span className={`ui-pill ui-pill--${tone}`}>
      {mktExpStatusLabel(locale, value)}
    </span>
  );
};

export const SelectField = ({ value, onChange, options, placeholder, locale = 'en' }) => (
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
              {mktExpCategoryLabel(locale, option)}
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
