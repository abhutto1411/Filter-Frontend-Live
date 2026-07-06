import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { marketingGetReferralCommissionsDashboard } from '../../services/superAdminMarketingApi';
import { MarketingFormShell } from './MarketingFormShell';
import { marketingSectionPath } from './marketingRouteUtils';
import { formatSar, InputField, SelectField, TextAreaField } from './referrerFormShared';
import './MarketingUniversal.css';

function extractPayableRows(payload) {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.payableSummary)
      ? payload.payableSummary
      : Array.isArray(payload?.data?.payableSummary)
        ? payload.data.payableSummary
        : [];

  return rows.map((row) => ({
    id: String(row.id || row.referrerId || ''),
    name: row.name || row.referrerName || 'Referrer',
    available: Number(row.available ?? row.availableCommission ?? 0),
  }));
}

export default function ReferrerPayoutFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const listPath = `${marketingSectionPath(location.pathname, 'referrer-management')}?tab=payout`;

  const [payableSummary, setPayableSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    referrer: '',
    amount: '',
    method: 'Bank Transfer',
    coa: '',
    notes: '',
  });

  const goBack = () => navigate(listPath);

  useEffect(() => {
    marketingGetReferralCommissionsDashboard({ tableLimit: 100 })
      .then((res) => setPayableSummary(extractPayableRows(res)))
      .catch(() => setPayableSummary([]))
      .finally(() => setLoading(false));
  }, []);

  const referrerOptions = [
    { label: 'Select referrer...', value: '' },
    ...payableSummary.map((item) => ({
      label: `${item.name} - ${formatSar(item.available)}`,
      value: item.id,
    })),
  ];

  return (
    <MarketingFormShell
      title="New Payout Request"
      subtitle="Create a payout request for a referrer."
      backLabel="Back to Payout Queue"
      onBack={goBack}
      className="mk-page mkp-form-page"
    >
      {loading ? (
        <div className="mk-panel-empty">Loading...</div>
      ) : (
        <div className="mkp-form-page-body">
          <div className="mk-ref-form-grid">
            <SelectField
              label="Referrer"
              required
              value={form.referrer}
              onChange={(value) => setForm((prev) => ({ ...prev, referrer: value }))}
              options={referrerOptions}
            />
            <InputField
              label="Amount (SAR)"
              required
              value={form.amount}
              onChange={(value) => setForm((prev) => ({ ...prev, amount: value }))}
              placeholder="0.00"
            />
            <SelectField
              label="Payment Method"
              value={form.method}
              onChange={(value) => setForm((prev) => ({ ...prev, method: value }))}
              options={['Bank Transfer', 'Cash', 'Cheque']}
            />
            <SelectField
              label="Payment Account (COA)"
              value={form.coa}
              onChange={(value) => setForm((prev) => ({ ...prev, coa: value }))}
              options={[{ label: 'Select account...', value: '' }]}
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
                alert('Payout create/process endpoint is not exposed yet.');
                goBack();
              }}
            >
              Create Request
            </button>
          </div>
        </div>
      )}
    </MarketingFormShell>
  );
}
