import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
} from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  MapPin,
  Image,
  Hourglass,
  Upload,
  Loader2,
} from "lucide-react";
import {
  marketingCreatePromotion,
  marketingGetPromotion,
  marketingUpdatePromotion,
} from "../../services/superAdminMarketingApi";
import {
  mktPromoSelectOptions,
  mktPromoT,
  resolveMarketingLocale,
} from "../../utils/marketingPromotionsI18n";
import {
  alignStoredIdsWithOptions,
  buildPromotionPayload,
  customerSegmentOptions,
  discountTypeOptions,
  EMPTY_PROMOTION_FORM,
  formatStatusLabel,
  loadPromotionDropdownData,
  MultiSelectApiField,
  promotionFormFromItem,
  promotionTypeOptions,
  normalizePromotion,
  normalizeWorkflowStatus,
  resolvePromotionBasePath,
  SelectField,
  SingleSelectApiField,
  strategyOptions,
  Toggle,
} from "./marketingPromotionShared";
import PromotionApplicabilitySection from "../../components/promo/PromotionApplicabilitySection";
import PromotionRewardSection from "../../components/promo/PromotionRewardSection";
import PromotionGuide from "../../components/promo/PromotionGuide";
import "../workshop/Workshop.css";
import "./MarketingUniversal.css";

const BUY_GET_STRATEGIES = [
  "Buy X Get Y Free",
  "Free Service",
  "Free Service at another workshop / branch",
];

function isBuyGetPromotionType(promotionType) {
  return BUY_GET_STRATEGIES.includes(String(promotionType || ""));
}

function validatePromotionForm(form, t) {
  if (!form.name.trim()) {
    alert(t("err.nameRequired"));
    return false;
  }

  const isVoucherType =
    form.promotionType === "Free Service at another workshop / branch";

  if (!form.discountValue && form.promotionType !== "Free Service" && !isVoucherType) {
    alert(t("err.discountRequired"));
    return false;
  }

  const discountNum = Number(form.discountValue);
  if (
    form.discountValue &&
    String(form.discountType).toLowerCase().includes("percent") &&
    Number.isFinite(discountNum) &&
    discountNum > 100
  ) {
    alert(t("err.pctMax"));
    return false;
  }

  if (!form.startDate || !form.endDate) {
    alert(t("err.datesRequired"));
    return false;
  }

  if (new Date(form.endDate) < new Date(form.startDate)) {
    alert(t("err.endAfterStart"));
    return false;
  }

  if (
    form.productScope === "selected" &&
    !(form.productTriggerIds || []).length &&
    !(form.productCategoryTriggerIds || []).length
  ) {
    alert(t("err.productSelected"));
    return false;
  }

  if (
    form.serviceScope === "selected" &&
    !(form.serviceTriggerIds || []).length &&
    !(form.serviceCategoryTriggerIds || []).length
  ) {
    alert(t("err.serviceSelected"));
    return false;
  }

  if (form.productScope === "none" && form.serviceScope === "none") {
    alert(t("err.scopeNone"));
    return false;
  }

  if (form.rewardBenefitType && form.rewardBenefitType !== "none") {
    if (
      !(form.rewardProductIds || []).length &&
      !(form.rewardProductCategoryIds || []).length &&
      !(form.rewardServiceCategoryIds || []).length
    ) {
      alert(t("err.rewardItems"));
      return false;
    }
    if (form.rewardBenefitType !== "free" && !Number(form.rewardDiscountValue)) {
      alert(t("err.rewardValue"));
      return false;
    }
  }

  return true;
}

export default function MarketingPromotionFormPage({ readOnly = false }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isEdit = Boolean(id) && !readOnly && /\/edit$/.test(location.pathname);
  const basePath = resolvePromotionBasePath(location.pathname);
  const outletCtx = useOutletContext() || {};
  const locale = resolveMarketingLocale(outletCtx);
  const t = useCallback((key, vars) => mktPromoT(locale, key, vars), [locale]);
  const embeddedInPortal = Boolean(outletCtx.setShowAddModal);

  const strategySelectOptions = useMemo(
    () => mktPromoSelectOptions(locale, strategyOptions),
    [locale],
  );
  const typeSelectOptions = useMemo(
    () => mktPromoSelectOptions(locale, promotionTypeOptions),
    [locale],
  );
  const discountSelectOptions = useMemo(
    () => mktPromoSelectOptions(locale, discountTypeOptions),
    [locale],
  );
  const segmentSelectOptions = useMemo(
    () => mktPromoSelectOptions(locale, customerSegmentOptions),
    [locale],
  );

  const [form, setForm] = useState(EMPTY_PROMOTION_FORM);
  const [workflowStatus, setWorkflowStatus] = useState("draft");
  const [workshops, setWorkshops] = useState([]);
  const [branches, setBranches] = useState([]);
  const [zones, setZones] = useState([]);
  const [triggerItems, setTriggerItems] = useState([]);
  const [rewardItems, setRewardItems] = useState([]);

  const productTriggerOptions = useMemo(
    () => triggerItems.filter((item) => String(item.itemKind || item.type) !== "service"),
    [triggerItems],
  );
  const serviceTriggerOptions = useMemo(
    () => triggerItems.filter((item) => String(item.itemKind || item.type) === "service"),
    [triggerItems],
  );

  const productComboOptions = useMemo(
    () =>
      productTriggerOptions.map((item) => ({
        id: String(item.realId ?? item.id).replace(/^product-/, ""),
        label: item.label,
        name: item.label,
        categoryId: item.categoryId ?? null,
        categoryName: item.categoryName ?? null,
      })),
    [productTriggerOptions],
  );
  const serviceComboOptions = useMemo(
    () =>
      serviceTriggerOptions.map((item) => ({
        id: String(item.realId ?? item.id).replace(/^service-/, ""),
        label: item.label,
        name: item.label,
        categoryId: item.categoryId ?? null,
        categoryName: item.categoryName ?? null,
      })),
    [serviceTriggerOptions],
  );

  const rewardActive =
    Boolean(form.rewardBenefitType) && form.rewardBenefitType !== "none";

  const [loadingPage, setLoadingPage] = useState(isEdit || readOnly);
  const [loadingDropdowns, setLoadingDropdowns] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dropdownError, setDropdownError] = useState("");
  const [pageError, setPageError] = useState("");

  const normalizedWorkflowStatus = normalizeWorkflowStatus(workflowStatus);
  const isDraft = normalizedWorkflowStatus === "draft";
  const isPendingApproval = normalizedWorkflowStatus === "pending_approval";
  const isRejected = normalizedWorkflowStatus === "rejected";
  const canSaveDraft = !isEdit || isDraft;
  const canSubmitForApproval = !isEdit || isDraft || isRejected;
  const canUpdateFields =
    isEdit &&
    !isDraft &&
    !isPendingApproval &&
    !isRejected;

  const updateForm = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // Convenience: selecting a Buy-X-Get-Y style strategy pre-arms the reward as "free".
      if (
        field === "promotionType" &&
        isBuyGetPromotionType(value) &&
        (!prev.rewardBenefitType || prev.rewardBenefitType === "none")
      ) {
        next.rewardBenefitType = "free";
      }
      return next;
    });
  };

  const goBack = () => navigate(basePath);

  useEffect(() => {
    let cancelled = false;

    const loadDropdowns = async () => {
      try {
        setLoadingDropdowns(true);
        setDropdownError("");
        const data = await loadPromotionDropdownData();
        if (cancelled) return;
        setWorkshops(data.workshops);
        setBranches(data.branches);
        setZones(data.zones);
        setTriggerItems(data.triggerItems);
        setRewardItems(data.rewardItems);
      } catch (error) {
        if (!cancelled) {
          setDropdownError(error?.message || t('err.dropdown'));
        }
      } finally {
        if (!cancelled) setLoadingDropdowns(false);
      }
    };

    loadDropdowns();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!triggerItems.length) return;

    setForm((prev) => {
      const alignedProductTriggers = alignStoredIdsWithOptions(
        (prev.productTriggerIds || []).map((id) => `product-${String(id).replace(/^product-/, '')}`),
        productTriggerOptions,
      ).map((id) => String(id).replace(/^product-/, ''));
      const alignedServiceTriggers = alignStoredIdsWithOptions(
        (prev.serviceTriggerIds || []).map((id) => `service-${String(id).replace(/^service-/, '')}`),
        serviceTriggerOptions,
      ).map((id) => String(id).replace(/^service-/, ''));
      const alignedRewardIds = alignStoredIdsWithOptions(
        prev.rewardProductIds,
        rewardItems.length ? rewardItems : triggerItems
      );

      if (
        alignedProductTriggers.join('|') === (prev.productTriggerIds || []).join('|') &&
        alignedServiceTriggers.join('|') === (prev.serviceTriggerIds || []).join('|') &&
        alignedRewardIds.join('|') === prev.rewardProductIds.join('|')
      ) {
        return prev;
      }

      return {
        ...prev,
        productTriggerIds: alignedProductTriggers,
        serviceTriggerIds: alignedServiceTriggers,
        rewardProductIds: alignedRewardIds,
      };
    });
  }, [triggerItems, rewardItems, productTriggerOptions, serviceTriggerOptions]);

  useEffect(() => {
    if (!isEdit && !readOnly) return;

    let cancelled = false;

    const loadPromotion = async () => {
      try {
        setLoadingPage(true);
        setPageError("");
        const response = await marketingGetPromotion(id);
        const raw =
          response?.promotion ||
          response?.data ||
          response?.item ||
          response;
        if (!raw || !raw.id) {
          throw new Error(t('err.notFound'));
        }
        if (!cancelled) {
          const normalized = normalizePromotion(raw);
          setForm(promotionFormFromItem(normalized));
          setWorkflowStatus(normalized.status || "draft");
        }
      } catch (error) {
        if (!cancelled) {
          setPageError(error?.message || t('err.loadOne'));
        }
      } finally {
        if (!cancelled) setLoadingPage(false);
      }
    };

    loadPromotion();

    return () => {
      cancelled = true;
    };
  }, [id, isEdit]);

  const persistPromotion = async (statusOverride) => {
    const payload = buildPromotionPayload(form, branches, workshops, {
      statusOverride,
    });

    if (isEdit) {
      return marketingUpdatePromotion(id, payload);
    }

    return marketingCreatePromotion(payload);
  };

  const runAction = async (action) => {
    if (!validatePromotionForm(form, t)) return;

    try {
      setSubmitting(true);
      setPageError("");

      if (action === "draft") {
        await persistPromotion("draft");
        goBack();
        return;
      }

      if (action === "submit") {
        await persistPromotion("pending_approval");
        goBack();
        return;
      }

      if (action === "update") {
        await persistPromotion();
        goBack();
      }
    } catch (error) {
      console.error("Promotion action error:", error);
      alert(
        error?.message || t('err.save')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className={
        embeddedInPortal
          ? "mk-page mkp-form-page mkp-form-page-wide"
          : "mkp-page mkp-form-page mkp-form-page-wide"
      }
    >
      <button type="button" className="mkp-back-btn" onClick={goBack}>
        <ArrowLeft size={16} strokeWidth={2} />
        {t('form.back')}
      </button>

      <header className="mkp-form-page-header">
        <h1>{readOnly ? t('form.titleView') : isEdit ? t('form.titleEdit') : t('form.titleNew')}</h1>
        <p>
          {t('form.subtitle')}
        </p>
      </header>

      {pageError ? (
        <div className="mkp-error" role="alert">
          {pageError}
        </div>
      ) : null}

      <div className="mkp-form-layout">
        <div className="mkp-form-main">
      {loadingPage ? (
        <div className="mkp-empty">
          <Loader2 size={30} className="mkp-spin" />
          <div>{t('form.loading')}</div>
        </div>
      ) : (
        <form
          className="mkp-form-page-body"
          onSubmit={(event) => {
            if (readOnly) return;
            event.preventDefault();
            if (canSubmitForApproval) {
              runAction("submit");
            } else if (canUpdateFields) {
              runAction("update");
            }
          }}
        >
          <fieldset disabled={readOnly} style={{ border: 'none', margin: 0, padding: 0, minWidth: 0 }}>
          <div className="mkp-section">
            <div className="mkp-section-title">{t('form.section.basic')}</div>

            {isEdit ? (
              <div className="mkp-form-group">
                <label className="mkp-label">{t('form.label.workflowStatus')}</label>
                <div
                  className={`mkp-status-badge status-${normalizedWorkflowStatus.replace(
                    /_/g,
                    "-"
                  )}`}
                >
                  {formatStatusLabel(workflowStatus, locale)}
                </div>
                <p className="mkp-field-hint">
                    {isDraft
                    ? t('form.hint.draft')
                    : isPendingApproval
                      ? t('form.hint.pending')
                      : t('form.hint.other')}
                </p>
              </div>
            ) : null}

            <div className="mkp-form-group">
              <label className="mkp-label">{t('form.label.name')}</label>
              <input
                autoFocus
                value={form.name}
                onChange={(event) => updateForm("name", event.target.value)}
                placeholder={t('form.placeholder.name')}
                className="mkp-input"
              />
            </div>

            <div className="mkp-two-col">
              <div className="mkp-form-group">
                <label className="mkp-label">{t('form.label.strategy')}</label>
                <SelectField
                  value={form.strategy}
                  onChange={(value) => updateForm("strategy", value)}
                  options={strategySelectOptions}
                  locale={locale}
                />
              </div>

              <div className="mkp-form-group">
                <label className="mkp-label">{t('form.label.type')}</label>
                <SelectField
                  value={form.promotionType}
                  onChange={(value) => updateForm("promotionType", value)}
                  options={typeSelectOptions}
                  locale={locale}
                />
              </div>
            </div>

            <div className="mkp-two-col">
              <div className="mkp-form-group">
                <label className="mkp-label">{t('form.label.discountType')}</label>
                <SelectField
                  value={form.discountType}
                  onChange={(value) => updateForm("discountType", value)}
                  options={discountSelectOptions}
                  locale={locale}
                />
              </div>

              <div className="mkp-form-group">
                <label className="mkp-label">
                  {String(form.discountType).toLowerCase().includes("fixed")
                    ? t('form.label.discountValueSar')
                    : t('form.label.discountValuePct')}
                </label>
                <input
                  value={form.discountValue}
                  onChange={(event) =>
                    updateForm("discountValue", event.target.value)
                  }
                  placeholder={
                    String(form.discountType).toLowerCase().includes("fixed")
                      ? t('form.placeholder.discountFixed')
                      : t('form.placeholder.discountPct')
                  }
                  className="mkp-input"
                />
              </div>
            </div>
          </div>

          <div className="mkp-section">
            <div className="mkp-section-title">{t('form.section.targeting')}</div>

            <div className="mkp-two-col">
              <SingleSelectApiField
                label={t('form.label.sourceWorkshop')}
                icon={Building2}
                options={workshops}
                value={form.sourceWorkshopId}
                onChange={(value) => updateForm("sourceWorkshopId", value)}
                loading={loadingDropdowns}
                error={dropdownError}
                placeholder={t('form.placeholder.sourceWorkshop')}
                locale={locale}
              />

              <SingleSelectApiField
                label={t('form.label.targetWorkshop')}
                icon={Building2}
                options={workshops}
                value={form.targetWorkshopId}
                onChange={(value) => updateForm("targetWorkshopId", value)}
                loading={loadingDropdowns}
                error={dropdownError}
                placeholder={t('form.placeholder.targetWorkshop')}
                locale={locale}
              />
            </div>

            <MultiSelectApiField
              label={t('form.label.sourceBranches')}
              locale={locale}
              icon={Building2}
              options={branches}
              selectedIds={form.sourceBranchIds}
              onChange={(ids) => updateForm("sourceBranchIds", ids)}
              loading={loadingDropdowns}
              error={dropdownError}
            />

            <MultiSelectApiField
              label={t('form.label.targetBranches')}
              locale={locale}
              icon={Building2}
              options={branches}
              selectedIds={form.targetBranchIds}
              onChange={(ids) => updateForm("targetBranchIds", ids)}
              loading={loadingDropdowns}
              error={dropdownError}
            />

            <MultiSelectApiField
              label={t('form.label.targetZones')}
              locale={locale}
              icon={MapPin}
              options={zones}
              selectedIds={form.targetZoneIds}
              onChange={(ids) => updateForm("targetZoneIds", ids)}
              loading={loadingDropdowns}
              error={dropdownError}
            />

            <PromotionApplicabilitySection
              form={form}
              onChange={updateForm}
              productOptions={productComboOptions}
              serviceOptions={serviceComboOptions}
              loading={loadingDropdowns}
              error={dropdownError}
              variant={rewardActive ? "trigger" : "discount"}
            />

            <PromotionRewardSection
              form={form}
              onChange={updateForm}
              rewardOptions={rewardItems}
              loading={loadingDropdowns}
              error={dropdownError}
            />
          </div>

          <div className="mkp-section">
            <div className="mkp-section-title">{t('form.section.rules')}</div>

            <div className="mkp-two-col">
              <div className="mkp-form-group">
                <label className="mkp-label">{t('form.label.segment')}</label>
                <SelectField
                  value={form.customerSegment}
                  onChange={(value) => updateForm("customerSegment", value)}
                  options={segmentSelectOptions}
                  locale={locale}
                />
              </div>

              <div className="mkp-form-group">
                <label className="mkp-label">{t('form.label.minPurchase')}</label>
                <input
                  type="number"
                  value={form.minPurchase}
                  onChange={(event) =>
                    updateForm("minPurchase", event.target.value)
                  }
                  className="mkp-input"
                />
              </div>
            </div>

            <div className="mkp-form-group">
              <label className="mkp-label">
                {t('form.label.maxUsage')}
              </label>
              <input
                type="number"
                value={form.maxUsage}
                onChange={(event) => updateForm("maxUsage", event.target.value)}
                className="mkp-input"
              />
            </div>

            <div className="mkp-two-col">
              <div className="mkp-form-group">
                <label className="mkp-label">{t('form.label.start')}</label>
                <input
                  type="datetime-local"
                  value={form.startDate}
                  onChange={(event) =>
                    updateForm("startDate", event.target.value)
                  }
                  className="mkp-input"
                />
              </div>

              <div className="mkp-form-group">
                <label className="mkp-label">{t('form.label.end')}</label>
                <input
                  type="datetime-local"
                  value={form.endDate}
                  onChange={(event) =>
                    updateForm("endDate", event.target.value)
                  }
                  className="mkp-input"
                />
              </div>
            </div>
          </div>

          <div className="mkp-section">
            <div className="mkp-section-title">{t('form.section.display')}</div>

            <div className="mkp-form-group">
              <label className="mkp-label">{t('form.label.banner')}</label>
              <input
                value={form.bannerText}
                onChange={(event) =>
                  updateForm("bannerText", event.target.value)
                }
                placeholder={t('form.placeholder.banner')}
                className="mkp-input"
              />
            </div>

            <div className="mkp-form-group">
              <label className="mkp-label">{t('form.label.description')}</label>
              <textarea
                value={form.description}
                onChange={(event) =>
                  updateForm("description", event.target.value)
                }
                className="mkp-textarea"
              />
            </div>

            <div className="mkp-form-group">
              <label className="mkp-label">{t('form.label.terms')}</label>
              <textarea
                value={form.terms}
                onChange={(event) => updateForm("terms", event.target.value)}
                placeholder={t('form.placeholder.terms')}
                className="mkp-textarea"
              />
            </div>

            <div className="mkp-form-group">
              <label className="mkp-label">
                <Image size={13} strokeWidth={2} />
                {t('form.label.banners')}
                <span>{t('form.label.bannersHint')}</span>
              </label>

              <div className="mkp-upload-row">
                <button type="button" className="mkp-upload-box">
                  <Upload size={15} />
                  <span>{t('common.upload')}</span>
                </button>
              </div>

              <div className="mkp-upload-hint">
                {t('form.uploadHint')}
              </div>
            </div>

            <div className="mkp-toggles-row">
              <Toggle
                checked={form.autoClose}
                onChange={(value) => updateForm("autoClose", value)}
                label={t('form.toggle.autoClose')}
              />

              <Toggle
                checked={form.showPos}
                onChange={(value) => updateForm("showPos", value)}
                label={t('form.toggle.showPos')}
              />

              <Toggle
                checked={form.showCustomerPortal}
                onChange={(value) => updateForm("showCustomerPortal", value)}
                label={t('form.toggle.showPortal')}
              />
            </div>
          </div>

          {(canSaveDraft || canSubmitForApproval) && !isEdit ? (
            <div className="mkp-approval-note">
              <Hourglass size={14} />
              {t('form.approvalNote')}
            </div>
          ) : null}

          <div className="mkp-form-page-footer">
            <button
              type="button"
              onClick={goBack}
              className="mkp-cancel-btn"
              disabled={submitting}
            >
              {t('common.cancel')}
            </button>

            {readOnly ? (
              <button
                type="button"
                className="mkp-cancel-btn"
                onClick={() => navigate(`${basePath}/marketing-promotions`)}
              >
                {t('common.close')}
              </button>
            ) : null}

            {!readOnly && canSaveDraft ? (
              <button
                type="button"
                className="mkp-cancel-btn"
                disabled={submitting}
                onClick={() => runAction("draft")}
              >
                {submitting ? t('form.btn.saving') : t('form.btn.saveDraft')}
              </button>
            ) : null}

            {!readOnly && canSubmitForApproval ? (
              <button
                type="submit"
                className="mkp-submit-btn"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 size={15} className="mkp-spin" />
                    {t('form.btn.submitting')}
                  </>
                ) : (
                  t('form.btn.submit')
                )}
              </button>
            ) : null}

            {!readOnly && canUpdateFields ? (
              <button
                type="submit"
                className="mkp-submit-btn"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 size={15} className="mkp-spin" />
                    Saving...
                  </>
                ) : (
                  t('form.btn.update')
                )}
              </button>
            ) : null}
          </div>
          </fieldset>
        </form>
      )}
        </div>
        {!isEdit ? <PromotionGuide /> : null}
      </div>
    </div>
  );
}
