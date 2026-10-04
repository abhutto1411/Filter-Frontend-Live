import React, { useCallback, useEffect, useState } from 'react';
import {
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
} from 'react-router-dom';
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
import { mktExpT } from '../../utils/marketingExpensesI18n';
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
  const outletCtx = useOutletContext() || {};
  const locale =
    outletCtx.locale ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('marketing-locale') : null) ||
    'en';
  const t = useCallback((key, vars) => mktExpT(locale, key, vars), [locale]);
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
        if (!cancelled) setCampaigns(extractCampaigns(res, locale));
      } catch {
        if (!cancelled) setCampaigns([]);
      } finally {
        if (!cancelled) setCampaignsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locale]);

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
        if (!row?.id) throw new Error(t('err.notFound'));
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
        if (!cancelled) setPageError(err?.message || t('err.load'));
      } finally {
        if (!cancelled) setLoadingPage(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, isEdit, t]);

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
      setPageError(t('err.categoryRequired'));
      return;
    }

    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPageError(t('err.amountInvalid'));
      return;
    }

    if (!form.expenseDate) {
      setPageError(t('err.dateRequired'));
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
      setPageError(err?.message || t('err.save'));
    } finally {
      setSaving(false);
    }
  };

  const campaignOptions = campaigns.map((c) => ({ value: c.id, label: c.name }));

  return (
    <MarketingFormShell
      title={isEdit ? t('form.titleEdit') : t('form.titleNew')}
      subtitle={t('form.subtitle')}
      backLabel={t('form.back')}
      onBack={goBack}
      className="mk-page mkp-form-page mk-expense-form-page"
    >
      {pageError ? <div className="mk-error-text mk-expense-form-error">{pageError}</div> : null}

      {loadingPage ? (
        <div className="mk-expense-form-loading">
          <Loader2 size={28} className="mk-expense-spin" />
          <span>{t('loading.expense')}</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mkp-form-page-body mk-expense-form-card">
          {!isEdit && (
            <div className="mk-expense-info-banner" role="note">
              <ShieldCheck size={22} strokeWidth={2} className="mk-expense-info-icon" />
              <div>
                <strong>{t('banner.title')}</strong>
                {t('banner.body')}
              </div>
            </div>
          )}

          <section className="mkp-section mk-expense-section">
            <div className="mkp-section-title">{t('section.details')}</div>

            <div className="mkp-form-group">
              <label className="mkp-label">
                <Tag size={13} strokeWidth={2} />
                {t('label.category')} <span className="mk-expense-required">*</span>
              </label>
              <SelectField
                value={form.expenseCategory}
                onChange={(value) => updateForm('expenseCategory', value)}
                options={categoryOptions}
                locale={locale}
              />
              <p className="mk-expense-field-hint">{t('hint.category')}</p>
            </div>

            <div className="mkp-form-group">
              <label className="mkp-label">
                <Store size={13} strokeWidth={2} />
                {t('label.vendor')}
              </label>
              <input
                className="mkp-input"
                value={form.vendorName}
                onChange={(e) => updateForm('vendorName', e.target.value)}
                placeholder={t('placeholder.vendor')}
                maxLength={160}
              />
            </div>

            <div className="mkp-form-group">
              <label className="mkp-label">
                <FileText size={13} strokeWidth={2} />
                {t('label.description')}
              </label>
              <textarea
                className="mkp-textarea"
                value={form.description}
                onChange={(e) => updateForm('description', e.target.value)}
                placeholder={t('placeholder.description')}
                rows={3}
                maxLength={2000}
              />
            </div>
          </section>

          <section className="mkp-section mk-expense-section">
            <div className="mkp-section-title">{t('section.amountDate')}</div>

            <div className="mkp-two-col">
              <div className="mkp-form-group">
                <label className="mkp-label">
                  <Banknote size={13} strokeWidth={2} />
                  {t('label.amount')} <span className="mk-expense-required">*</span>
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
                  {t('label.date')} <span className="mk-expense-required">*</span>
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
            <div className="mkp-section-title">{t('section.optional')}</div>

            <div className="mkp-form-group">
              <label className="mkp-label">
                <Megaphone size={13} strokeWidth={2} />
                {t('label.campaign')}
              </label>
              <SelectField
                value={form.campaignId}
                onChange={updateLinkedCampaign}
                options={campaignOptions}
                locale={locale}
                placeholder={
                  campaignsLoading
                    ? t('placeholder.campaignLoading')
                    : t('placeholder.campaign')
                }
              />
              <p className="mk-expense-field-hint">{t('hint.campaign')}</p>
            </div>

            <div className="mkp-form-group">
              <label className="mkp-label">
                <Link2 size={13} strokeWidth={2} />
                {t('label.receiptUrl')}
              </label>
              <input
                className="mkp-input"
                type="url"
                value={form.receiptUrl}
                onChange={(e) => updateForm('receiptUrl', e.target.value)}
                placeholder={t('placeholder.receiptUrl')}
              />
            </div>

            <div className="mkp-form-group">
              <label className="mkp-label">
                <Receipt size={13} strokeWidth={2} />
                {t('label.notes')}
              </label>
              <textarea
                className="mkp-textarea"
                value={form.notes}
                onChange={(e) => updateForm('notes', e.target.value)}
                placeholder={t('placeholder.notes')}
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
              {t('btn.cancel')}
            </button>
            <button type="submit" className="mk-expense-submit-btn" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 size={15} className="mk-expense-spin" />
                  {t('btn.submitting')}
                </>
              ) : isEdit ? (
                t('btn.save')
              ) : (
                t('btn.submit')
              )}
            </button>
          </div>
        </form>
      )}
    </MarketingFormShell>
  );
}
