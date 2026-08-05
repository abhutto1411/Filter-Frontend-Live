import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  marketingCreateReferrer,
  marketingGetReferrer,
  marketingUpdateReferrer,
} from '../../services/superAdminMarketingApi';
import { MarketingFormShell } from './MarketingFormShell';
import { marketingSectionPath } from './marketingRouteUtils';
import {
  buildReferrerPayload,
  humanize,
  InputField,
  initialReferrerForm,
  SelectField,
  TextAreaField,
} from './referrerFormShared';
import './MarketingUniversal.css';

export default function ReferrerFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const location = useLocation();
  const listPath = `${marketingSectionPath(location.pathname, 'referrer-management')}?tab=referrers`;

  const [form, setForm] = useState(initialReferrerForm);
  const [loadingPage, setLoadingPage] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState('');

  const goBack = () => navigate(listPath);

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;

    (async () => {
      try {
        setLoadingPage(true);
        const res = await marketingGetReferrer(id);
        const item = res?.referrer || res?.data || res?.item || res;
        if (!item?.id) throw new Error('Referrer not found.');
        if (!cancelled) {
          setForm({
            id: String(item.id),
            fullName: item.name || item.fullName || '',
            category: humanize(item.type || item.category || 'Individual'),
            mobile: item.mobile || item.phone || '',
            email: item.email || '',
            nationalId: item.nationalId || item.national_id || '',
            status: humanize(item.status || 'Active'),
            bankName: item.bankName || item.bank_name || '',
            iban: item.iban || '',
            notes: item.notes || '',
          });
        }
      } catch (err) {
        if (!cancelled) setPageError(err?.message || 'Failed to load referrer.');
      } finally {
        if (!cancelled) setLoadingPage(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, isEdit]);

  const saveReferrer = async () => {
    if (!form.fullName.trim()) {
      alert('Full name is required.');
      return;
    }

    try {
      setSaving(true);
      const payload = buildReferrerPayload(form);
      if (form.id) {
        await marketingUpdateReferrer(form.id, payload);
      } else {
        await marketingCreateReferrer(payload);
      }
      goBack();
    } catch (err) {
      alert(err?.message || 'Failed to save referrer.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <MarketingFormShell
      title={isEdit ? 'Edit Referrer' : 'Add New Referrer'}
      subtitle="Manage referrer profile and payout details."
      backLabel="Back to Referrer Management"
      onBack={goBack}
      className="mk-page mkp-form-page"
    >
      {pageError ? <div className="mk-error-text">{pageError}</div> : null}

      {loadingPage ? (
        <div className="mk-panel-empty">Loading...</div>
      ) : (
        <div className="mkp-form-page-body">
          <div className="mk-ref-form-grid">
            <InputField
              label="Full Name"
              required
              value={form.fullName}
              onChange={(value) => setForm((prev) => ({ ...prev, fullName: value }))}
              placeholder="John Doe"
            />
            <SelectField
              label="Category"
              required
              value={form.category}
              onChange={(value) => setForm((prev) => ({ ...prev, category: value }))}
              options={['Individual', 'Corporate', 'Technician', 'Employee']}
            />
            <InputField
              label="Mobile"
              value={form.mobile}
              onChange={(value) => setForm((prev) => ({ ...prev, mobile: value }))}
              placeholder="+966..."
            />
            <InputField
              label="Email"
              value={form.email}
              onChange={(value) => setForm((prev) => ({ ...prev, email: value }))}
            />
            <InputField
              label="National ID"
              value={form.nationalId}
              onChange={(value) => setForm((prev) => ({ ...prev, nationalId: value }))}
            />
            <SelectField
              label="Status"
              value={form.status}
              onChange={(value) => setForm((prev) => ({ ...prev, status: value }))}
              options={['Active', 'Inactive']}
            />
            <InputField
              label="Bank Name"
              value={form.bankName}
              onChange={(value) => setForm((prev) => ({ ...prev, bankName: value }))}
            />
            <InputField
              label="IBAN"
              value={form.iban}
              onChange={(value) => setForm((prev) => ({ ...prev, iban: value }))}
              placeholder="SA..."
            />
            <TextAreaField
              label="Notes"
              value={form.notes}
              onChange={(value) => setForm((prev) => ({ ...prev, notes: value }))}
            />
          </div>

          <div className="mkp-form-page-footer">
            <button type="button" className="mk-ref-secondary-btn" onClick={goBack} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="mk-ref-primary-btn" onClick={saveReferrer} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </MarketingFormShell>
  );
}
