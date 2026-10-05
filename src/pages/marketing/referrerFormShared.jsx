export const initialReferrerForm = {
  id: '',
  fullName: '',
  category: 'Individual',
  mobile: '',
  email: '',
  password: '',
  nationalId: '',
  status: 'Active',
  referralCode: '',
  isCommunity: false,
  bankName: '',
  iban: '',
  notes: '',
};

/** @deprecated Prefer mktRefFormatSar(locale, value) from marketingReferrersI18n. */
export function formatSar(value, locale = 'en') {
  const n = Number(value);
  const amount = Number.isFinite(n) ? n.toFixed(2) : '0.00';
  return locale === 'ar' ? `ر.س ${amount}` : `SAR ${amount}`;
}

export function humanize(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function normalizeStatus(value) {
  const raw = String(value || 'active').toLowerCase();
  if (raw === 'active') return 'active';
  if (raw === 'inactive') return 'inactive';
  if (raw === 'pending') return 'pending';
  if (raw === 'suspended') return 'suspended';
  return raw;
}

export function buildReferrerPayload(form) {
  const community = Boolean(form.isCommunity);
  const code = String(form.referralCode || '').trim().toUpperCase();
  return {
    name: form.fullName.trim(),
    fullName: form.fullName.trim(),
    category: form.category,
    type: form.category,
    mobile: form.mobile.trim() || undefined,
    phone: form.mobile.trim() || undefined,
    email: form.email.trim().toLowerCase() || undefined,
    nationalId: form.nationalId.trim() || undefined,
    national_id: form.nationalId.trim() || undefined,
    referralCode: code || undefined,
    referral_code: code || undefined,
    code: code || undefined,
    isCommunity: community,
    is_community: community,
    bankName: community ? undefined : form.bankName.trim() || undefined,
    bank_name: community ? undefined : form.bankName.trim() || undefined,
    iban: community ? undefined : form.iban.trim() || undefined,
    bankIban: community ? undefined : form.iban.trim() || undefined,
    status: normalizeStatus(form.status),
    notes: form.notes.trim() || undefined,
  };
}

export const InputField = ({
  label,
  value,
  onChange,
  placeholder = '',
  type = 'text',
  required = false,
  hint = '',
  disabled = false,
}) => (
  <div className="mk-ref-form-group">
    <label className="mk-ref-form-label">
      {label}
      {required && <span> *</span>}
    </label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      className="mk-ref-input"
      disabled={disabled}
      readOnly={disabled}
      autoComplete={type === 'password' ? 'new-password' : undefined}
    />
    {hint ? <span className="mk-ref-check-hint">{hint}</span> : null}
  </div>
);

export const SelectField = ({ label, value, onChange, options, required = false }) => (
  <div className="mk-ref-form-group">
    <label className="mk-ref-form-label">
      {label}
      {required && <span> *</span>}
    </label>
    <select
      className="mk-ref-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((option) => {
        if (typeof option === 'string') {
          return (
            <option key={option} value={option}>
              {option}
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
  </div>
);

export const TextAreaField = ({ label, value, onChange, placeholder = '' }) => (
  <div className="mk-ref-form-group mk-ref-form-group-full">
    <label className="mk-ref-form-label">{label}</label>
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="mk-ref-textarea"
    />
  </div>
);
