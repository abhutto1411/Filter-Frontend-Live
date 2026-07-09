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
  EMPTY_INFLUENCER_FORM,
  humanize,
  platformOptions,
} from './influencerReferrerShared';
import './MarketingUniversal.css';

export default function InfluencerReferrerFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const location = useLocation();
  const listPath = marketingSectionPath(location.pathname, 'influencer-referrers');

  const [form, setForm] = useState(EMPTY_INFLUENCER_FORM);
  const [loadingPage, setLoadingPage] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState('');

  const goBack = () => navigate(listPath);

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;

    (async () => {
      try {
        setLoadingPage(true);
        const res = await marketingGetReferrer(id);
        const row = res?.referrer || res?.data || res?.item || res;
        if (!row?.id) throw new Error('Influencer not found.');
        if (!cancelled) {
          setForm({
            id: String(row.id),
            name: row.name || row.fullName || '',
            email: row.email || '',
            phone: row.phone || row.mobile || '',
            platform: row.platform || row.socialPlatform || 'instagram',
            handle: row.handle || row.socialHandle || '',
            commissionRate: String(
              row.commissionRate ?? row.commission_rate ?? row.rate ?? ''
            ),
            activeCampaigns: String(
              row.activeCampaigns ?? row.active_campaigns ?? ''
            ),
            status: row.status || 'active',
            notes: row.notes || '',
          });
        }
      } catch (err) {
        if (!cancelled) setPageError(err?.message || 'Failed to load influencer.');
      } finally {
        if (!cancelled) setLoadingPage(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, isEdit]);

  const buildPayload = () => ({
    name: form.name.trim(),
    fullName: form.name.trim(),
    email: form.email.trim() || undefined,
    phone: form.phone.trim() || undefined,
    platform: form.platform,
    socialPlatform: form.platform,
    handle: form.handle.trim() || undefined,
    socialHandle: form.handle.trim() || undefined,
    commissionRate: Number(form.commissionRate || 0),
    activeCampaigns: Number(form.activeCampaigns || 0),
    status: form.status,
    type: 'influencer',
    referrerType: 'influencer',
    category: 'influencer',
    notes: form.notes.trim() || undefined,
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      alert('Influencer name is required.');
      return;
    }

    try {
      setSaving(true);
      const payload = buildPayload();
      if (isEdit) {
        await marketingUpdateReferrer(form.id, payload);
      } else {
        await marketingCreateReferrer(payload);
      }
      goBack();
    } catch (err) {
      alert(err?.message || 'Failed to save influencer referrer.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <MarketingFormShell
      title={isEdit ? 'Edit Influencer' : 'Add Influencer'}
      subtitle="Manage influencer referrers and commission settings."
      backLabel="Back to Influencer Referrers"
      onBack={goBack}
      className="mk-page mkp-form-page"
    >
      {pageError ? <div className="mk-error-text">{pageError}</div> : null}

      {loadingPage ? (
        <div className="mk-panel-empty">Loading...</div>
      ) : (
        <form onSubmit={handleSubmit} className="mkp-form-page-body">
          <div className="mk-form-grid-2">
            <div className="mk-form-group">
              <label className="mk-label">Name</label>
              <input
                autoFocus
                className="mk-input"
                value={form.name}
                onChange={(e) => updateForm('name', e.target.value)}
              />
            </div>
            <div className="mk-form-group">
              <label className="mk-label">Status</label>
              <select
                className="mk-input"
                value={form.status}
                onChange={(e) => updateForm('status', e.target.value)}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="pending">Pending</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>

          <div className="mk-form-grid-2">
            <div className="mk-form-group">
              <label className="mk-label">Email</label>
              <input
                className="mk-input"
                value={form.email}
                onChange={(e) => updateForm('email', e.target.value)}
              />
            </div>
            <div className="mk-form-group">
              <label className="mk-label">Phone</label>
              <input
                className="mk-input"
                value={form.phone}
                onChange={(e) => updateForm('phone', e.target.value)}
              />
            </div>
          </div>

          <div className="mk-form-grid-2">
            <div className="mk-form-group">
              <label className="mk-label">Platform</label>
              <select
                className="mk-input"
                value={form.platform}
                onChange={(e) => updateForm('platform', e.target.value)}
              >
                {platformOptions.map((option) => (
                  <option key={option} value={option}>
                    {humanize(option)}
                  </option>
                ))}
              </select>
            </div>
            <div className="mk-form-group">
              <label className="mk-label">Handle / Username</label>
              <input
                className="mk-input"
                value={form.handle}
                onChange={(e) => updateForm('handle', e.target.value)}
                placeholder="@username"
              />
            </div>
          </div>

          <div className="mk-form-grid-2">
            <div className="mk-form-group">
              <label className="mk-label">Commission Rate (%)</label>
              <input
                type="number"
                min="0"
                className="mk-input"
                value={form.commissionRate}
                onChange={(e) => updateForm('commissionRate', e.target.value)}
              />
            </div>
            <div className="mk-form-group">
              <label className="mk-label">Active Campaigns</label>
              <input
                type="number"
                min="0"
                className="mk-input"
                value={form.activeCampaigns}
                onChange={(e) => updateForm('activeCampaigns', e.target.value)}
              />
            </div>
          </div>

          <div className="mk-form-group">
            <label className="mk-label">Notes</label>
            <input
              className="mk-input"
              value={form.notes}
              onChange={(e) => updateForm('notes', e.target.value)}
            />
          </div>

          <div className="mkp-form-page-footer">
            <button type="button" className="mk-btn-secondary" onClick={goBack} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="mk-btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Influencer'}
            </button>
          </div>
        </form>
      )}
    </MarketingFormShell>
  );
}
