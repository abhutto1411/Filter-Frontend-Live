import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Banknote,
  Calendar,
  FileText,
  Link2,
  Loader2,
  Megaphone,
  Receipt,
  ShieldCheck,
  Store,
  Tag,
} from 'lucide-react';
import {
  marketingCreateExpense,
  marketingGetExpense,
  marketingListCampaigns,
  marketingUpdateExpense,
} from '../../services/superAdminMarketingApi';
import { MarketingFormShell } from './MarketingFormShell';
import { marketingSectionPath } from './marketingRouteUtils';
import {
  categoryOptions,
  extractCampaigns,
  extractExpenses,
  initialForm,
  SelectField,
} from './expenseShared';
import './MarketingUniversal.css';

export default function ExpenseFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const location = useLocation();
  const listPath = marketingSectionPath(location.pathname, 'expenses');

  const [form, setForm] = useState({
    ...initialForm,
    expenseDate: new Date().toISOString().slice(0, 10),
  });
  const [campaigns, setCampaigns] = useState([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [loadingPage, setLoadingPage] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState('');

  const goBack = () => navigate(listPath);

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateLinkedCampaign = (campaignId) => {
    const selected = campaigns.find((item) => item.id === campaignId);
    setForm((prev) => ({
      ...prev,
      campaignId,
      campaignName: selected?.name || '',
    }));
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setCampaignsLoading(true);
        const res = await marketingListCampaigns({ limit: 100, offset: 0, status: 'all' });
        if (!cancelled) setCampaigns(extractCampaigns(res));
      } catch {
        if (!cancelled) setCampaigns([]);
      } finally {
        if (!cancelled) setCampaignsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;

    (async () => {
      try {
        setLoadingPage(true);
        setPageError('');
        const res = await marketingGetExpense(id);
        const row =
          res?.expense ||
          res?.data ||
          res?.item ||
          extractExpenses(res)[0] ||
          res;
        if (!row?.id) throw new Error('Expense not found.');
        if (!cancelled) {
          setForm({
            id: String(row.id),
            campaignId: row.campaignId || '',
            campaignName: row.campaignName === '—' ? '' : row.campaignName || '',
            expenseCategory: row.expenseCategory || 'other',
            vendorName: row.vendorName === '—' ? '' : row.vendorName || '',
            description: row.description || '',
            amount: row.amount ? String(row.amount) : '',
            expenseDate: row.expenseDate ? String(row.expenseDate).slice(0, 10) : '',
            receiptUrl: row.receiptUrl || '',
            notes: row.notes || '',
            status: row.status || '',
          });
        }
      } catch (err) {
        if (!cancelled) setPageError(err?.message || 'Failed to load expense.');
      } finally {
        if (!cancelled) setLoadingPage(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, isEdit]);

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
    if (!isEdit) payload.status = 'pending_approval';
    return payload;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.expenseCategory) {
      setPageError('Please select an expense category.');
      return;
    }

    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPageError('Enter a valid amount greater than zero.');
      return;
    }

    if (!form.expenseDate) {
      setPageError('Expense date is required.');
      return;
    }

    try {
      setSaving(true);
      setPageError('');
      const payload = buildPayload();
      if (isEdit) {
        await marketingUpdateExpense(form.id, payload);
      } else {
        await marketingCreateExpense(payload);
      }
      goBack();
    } catch (err) {
      setPageError(err?.message || 'Failed to save expense.');
    } finally {
      setSaving(false);
    }
  };

  const campaignOptions = campaigns.map((c) => ({ value: c.id, label: c.name }));

  return (
    <MarketingFormShell
      title={isEdit ? 'Edit Marketing Expense' : 'New Marketing Expense'}
      subtitle="Record a marketing spend and send it through Super Admin approval."
      backLabel="Back to Expenses"
      onBack={goBack}
      className="mk-page mkp-form-page mk-expense-form-page"
    >
      {pageError ? <div className="mk-error-text mk-expense-form-error">{pageError}</div> : null}

      {loadingPage ? (
        <div className="mk-expense-form-loading">
          <Loader2 size={28} className="mk-expense-spin" />
          <span>Loading expense...</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mkp-form-page-body mk-expense-form-card">
          {!isEdit && (
            <div className="mk-expense-info-banner" role="note">
              <ShieldCheck size={22} strokeWidth={2} className="mk-expense-info-icon" />
              <div>
                <strong>Approval workflow</strong>
                Submitting sends this expense to Super Admin Approvals. After approval,
                finance can pay it from the same queue — that posts to HQ Chart of Accounts
                and debits the marketing wallet.
              </div>
            </div>
          )}

          <section className="mkp-section mk-expense-section">
            <div className="mkp-section-title">Expense details</div>

            <div className="mkp-form-group">
              <label className="mkp-label">
                <Tag size={13} strokeWidth={2} />
                Category <span className="mk-expense-required">*</span>
              </label>
              <SelectField
                value={form.expenseCategory}
                onChange={(value) => updateForm('expenseCategory', value)}
                options={categoryOptions}
              />
              <p className="mk-expense-field-hint">Type of marketing spend (ads, events, tools, etc.)</p>
            </div>

            <div className="mkp-form-group">
              <label className="mkp-label">
                <Store size={13} strokeWidth={2} />
                Vendor name
              </label>
              <input
                className="mkp-input"
                value={form.vendorName}
                onChange={(e) => updateForm('vendorName', e.target.value)}
                placeholder="e.g. Meta, Google Ads, agency name"
                maxLength={160}
              />
            </div>

            <div className="mkp-form-group">
              <label className="mkp-label">
                <FileText size={13} strokeWidth={2} />
                Description
              </label>
              <textarea
                className="mkp-textarea"
                value={form.description}
                onChange={(e) => updateForm('description', e.target.value)}
                placeholder="Briefly describe what this expense covers..."
                rows={3}
                maxLength={2000}
              />
            </div>
          </section>

          <section className="mkp-section mk-expense-section">
            <div className="mkp-section-title">Amount &amp; date</div>

            <div className="mkp-two-col">
              <div className="mkp-form-group">
                <label className="mkp-label">
                  <Banknote size={13} strokeWidth={2} />
                  Amount <span className="mk-expense-required">*</span>
                </label>
                <div className="mk-expense-amount-wrap">
                  <span className="mk-expense-amount-prefix">SAR</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    className="mkp-input"
                    value={form.amount}
                    onChange={(e) => updateForm('amount', e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="mkp-form-group">
                <label className="mkp-label">
                  <Calendar size={13} strokeWidth={2} />
                  Expense date <span className="mk-expense-required">*</span>
                </label>
                <input
                  type="date"
                  className="mkp-input"
                  value={form.expenseDate}
                  onChange={(e) => updateForm('expenseDate', e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="mkp-section mk-expense-section">
            <div className="mkp-section-title">Optional links</div>

            <div className="mkp-form-group">
              <label className="mkp-label">
                <Megaphone size={13} strokeWidth={2} />
                Linked campaign
              </label>
              <SelectField
                value={form.campaignId}
                onChange={updateLinkedCampaign}
                options={campaignOptions}
                placeholder={
                  campaignsLoading ? 'Loading campaigns...' : 'Select campaign (optional)'
                }
              />
              <p className="mk-expense-field-hint">
                Tie spend to a campaign for budget tracking and reports
              </p>
            </div>

            <div className="mkp-form-group">
              <label className="mkp-label">
                <Link2 size={13} strokeWidth={2} />
                Receipt URL
              </label>
              <input
                className="mkp-input"
                type="url"
                value={form.receiptUrl}
                onChange={(e) => updateForm('receiptUrl', e.target.value)}
                placeholder="https://drive.google.com/... or invoice link"
              />
            </div>

            <div className="mkp-form-group">
              <label className="mkp-label">
                <Receipt size={13} strokeWidth={2} />
                Notes for approvers
              </label>
              <textarea
                className="mkp-textarea"
                value={form.notes}
                onChange={(e) => updateForm('notes', e.target.value)}
                placeholder="Any context Super Admin should see when reviewing..."
                rows={2}
              />
            </div>
          </section>

          <div className="mkp-form-page-footer mk-expense-form-footer">
            <button
              type="button"
              className="mkp-cancel-btn"
              onClick={goBack}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" className="mk-expense-submit-btn" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 size={15} className="mk-expense-spin" />
                  Submitting...
                </>
              ) : isEdit ? (
                'Save changes'
              ) : (
                'Submit for approval'
              )}
            </button>
          </div>
        </form>
      )}
    </MarketingFormShell>
  );
}
