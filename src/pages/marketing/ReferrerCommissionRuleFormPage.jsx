import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { marketingListReferrers } from '../../services/superAdminMarketingApi';
import { MarketingFormShell } from './MarketingFormShell';
import { marketingSectionPath } from './marketingRouteUtils';
import { InputField, SelectField, TextAreaField } from './referrerFormShared';
import './MarketingUniversal.css';

export default function ReferrerCommissionRuleFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const listPath = `${marketingSectionPath(location.pathname, 'referrer-management')}?tab=rules`;

  const [referrers, setReferrers] = useState([]);
  const [form, setForm] = useState({
    referrer: 'All Referrers',
    category: 'All Categories',
    customerType: 'All Customers',
    service: '',
    commissionType: 'Percentage (%)',
    value: '0',
    effectiveFrom: '',
    effectiveTo: '',
    notes: '',
  });

  const goBack = () => navigate(listPath);

  useEffect(() => {
    marketingListReferrers({ limit: 100, offset: 0, status: 'all' })
      .then((res) => {
        const rows = Array.isArray(res?.referrers)
          ? res.referrers
          : Array.isArray(res?.data)
            ? res.data
            : [];
        setReferrers(rows);
      })
      .catch(() => setReferrers([]));
  }, []);

  const referrerOptions = [
    { label: 'All Referrers', value: 'All Referrers' },
    ...referrers.map((item) => ({
      label: item.name || item.fullName || 'Referrer',
      value: String(item.id),
    })),
  ];

  return (
    <MarketingFormShell
      title="New Commission Rule"
      subtitle="Define commission rules for referrers."
      backLabel="Back to Commission Rules"
      onBack={goBack}
      className="mk-page mkp-form-page"
    >
      <div className="mkp-form-page-body">
        <div className="mk-ref-form-grid">
          <SelectField
            label="Specific Referrer (optional)"
            value={form.referrer}
            onChange={(value) => setForm((prev) => ({ ...prev, referrer: value }))}
            options={referrerOptions}
          />
          <SelectField
            label="Referrer Category"
            value={form.category}
            onChange={(value) => setForm((prev) => ({ ...prev, category: value }))}
            options={['All Categories', 'Individual', 'Corporate', 'Technician', 'Employee']}
          />
          <SelectField
            label="Customer Type"
            value={form.customerType}
            onChange={(value) => setForm((prev) => ({ ...prev, customerType: value }))}
            options={['All Customers']}
          />
          <InputField
            label="Service (optional)"
            value={form.service}
            onChange={(value) => setForm((prev) => ({ ...prev, service: value }))}
            placeholder="Oil Change, Car Wash..."
          />
          <SelectField
            label="Commission Type"
            value={form.commissionType}
            onChange={(value) => setForm((prev) => ({ ...prev, commissionType: value }))}
            options={['Percentage (%)']}
          />
          <InputField
            label="Value (%)"
            value={form.value}
            onChange={(value) => setForm((prev) => ({ ...prev, value: value }))}
            placeholder="0"
          />
          <InputField
            label="Effective From"
            value={form.effectiveFrom}
            onChange={(value) => setForm((prev) => ({ ...prev, effectiveFrom: value }))}
            placeholder="mm/dd/yyyy"
          />
          <InputField
            label="Effective To"
            value={form.effectiveTo}
            onChange={(value) => setForm((prev) => ({ ...prev, effectiveTo: value }))}
            placeholder="mm/dd/yyyy"
          />
          <TextAreaField
            label="Notes"
            value={form.notes}
            onChange={(value) => setForm((prev) => ({ ...prev, notes: value }))}
          />
        </div>

        <div className="mkp-form-page-footer">
          <button type="button" className="mk-ref-secondary-btn" onClick={goBack}>
            Cancel
          </button>
          <button
            type="button"
            className="mk-ref-primary-btn"
            onClick={() => {
              alert('Commission rule save endpoint is not exposed yet.');
              goBack();
            }}
          >
            Save Rule
          </button>
        </div>
      </div>
    </MarketingFormShell>
  );
}
