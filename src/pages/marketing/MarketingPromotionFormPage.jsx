import React, { useEffect, useMemo, useState } from "react";
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
  "Free Service At Another Branch",
];

function isBuyGetPromotionType(promotionType) {
  return BUY_GET_STRATEGIES.includes(String(promotionType || ""));
}

function validatePromotionForm(form) {
  if (!form.name.trim()) {
    alert("Promotion name is required.");
    return false;
  }

  if (!form.discountValue && form.promotionType !== "Free Service") {
    alert("Discount value is required.");
    return false;
  }

  const discountNum = Number(form.discountValue);
  if (
    form.discountValue &&
    String(form.discountType).toLowerCase().includes("percent") &&
    Number.isFinite(discountNum) &&
    discountNum > 100
  ) {
    alert("Percentage discount cannot exceed 100%.");
    return false;
  }

  if (!form.startDate || !form.endDate) {
    alert("Start date and end date are required.");
    return false;
  }

  if (new Date(form.endDate) < new Date(form.startDate)) {
    alert("End date must be after start date.");
    return false;
  }

  if (form.productScope === "selected" && !(form.productTriggerIds || []).length) {
    alert('Select at least one product when Products is set to "Specific only".');
    return false;
  }

  if (form.serviceScope === "selected" && !(form.serviceTriggerIds || []).length) {
    alert('Select at least one service when Services is set to "Specific only".');
    return false;
  }

  if (form.productScope === "none" && form.serviceScope === "none") {
    alert("At least one of Products or Services must apply.");
    return false;
  }

  if (form.rewardBenefitType && form.rewardBenefitType !== "none") {
    if (!(form.rewardProductIds || []).length) {
      alert("Select at least one reward product/service the customer will get.");
      return false;
    }
    if (form.rewardBenefitType !== "free" && !Number(form.rewardDiscountValue)) {
      alert("Enter a reward value for the percentage/fixed reward.");
      return false;
    }
  }

  return true;
}

export default function MarketingPromotionFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = resolvePromotionBasePath(location.pathname);
  const outletCtx = useOutletContext() || {};
  const embeddedInPortal = Boolean(outletCtx.setShowAddModal);

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
      })),
    [productTriggerOptions],
  );
  const serviceComboOptions = useMemo(
    () =>
      serviceTriggerOptions.map((item) => ({
        id: String(item.realId ?? item.id).replace(/^service-/, ""),
        label: item.label,
        name: item.label,
      })),
    [serviceTriggerOptions],
  );

  const rewardActive =
    Boolean(form.rewardBenefitType) && form.rewardBenefitType !== "none";

  const [loadingPage, setLoadingPage] = useState(isEdit);
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
          setDropdownError(error?.message || "Dropdown data load nahi hua.");
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
    if (!isEdit) return;

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
          throw new Error("Promotion not found.");
        }
        if (!cancelled) {
          const normalized = normalizePromotion(raw);
          setForm(promotionFormFromItem(normalized));
          setWorkflowStatus(normalized.status || "draft");
        }
      } catch (error) {
        if (!cancelled) {
          setPageError(error?.message || "Promotion load nahi hui.");
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
    if (!validatePromotionForm(form)) return;

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
        error?.message ||
          "Promotion save nahi hui. Console aur Network tab check karo."
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
        Back to Promotions
      </button>

      <header className="mkp-form-page-header">
        <h1>{isEdit ? "Edit Promotion" : "New Promotion"}</h1>
        <p>
          Save as draft, submit for approval, then activate on POS after
          approval.
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
          <div>Loading promotion...</div>
        </div>
      ) : (
        <form
          className="mkp-form-page-body"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmitForApproval) {
              runAction("submit");
            } else if (canUpdateFields) {
              runAction("update");
            }
          }}
        >
          <div className="mkp-section">
            <div className="mkp-section-title">Basic Information</div>

            {isEdit ? (
              <div className="mkp-form-group">
                <label className="mkp-label">Workflow Status</label>
                <div
                  className={`mkp-status-badge status-${normalizedWorkflowStatus.replace(
                    /_/g,
                    "-"
                  )}`}
                >
                  {formatStatusLabel(workflowStatus)}
                </div>
                <p className="mkp-field-hint">
                    {isDraft
                    ? "Save as draft or submit for Super Admin approval."
                    : isPendingApproval
                      ? "Waiting for approval on the Super Admin Approvals page."
                      : "Use the POS status toggle on the list to activate or deactivate."}
                </p>
              </div>
            ) : null}

            <div className="mkp-form-group">
              <label className="mkp-label">Promotion Name *</label>
              <input
                autoFocus
                value={form.name}
                onChange={(event) => updateForm("name", event.target.value)}
                placeholder="e.g. Ramadan Special Offer"
                className="mkp-input"
              />
            </div>

            <div className="mkp-two-col">
              <div className="mkp-form-group">
                <label className="mkp-label">Marketing Strategy</label>
                <SelectField
                  value={form.strategy}
                  onChange={(value) => updateForm("strategy", value)}
                  options={strategyOptions}
                />
              </div>

              <div className="mkp-form-group">
                <label className="mkp-label">Promotion Type</label>
                <SelectField
                  value={form.promotionType}
                  onChange={(value) => updateForm("promotionType", value)}
                  options={promotionTypeOptions}
                />
              </div>
            </div>

            <div className="mkp-two-col">
              <div className="mkp-form-group">
                <label className="mkp-label">Discount Type</label>
                <SelectField
                  value={form.discountType}
                  onChange={(value) => updateForm("discountType", value)}
                  options={discountTypeOptions}
                />
              </div>

              <div className="mkp-form-group">
                <label className="mkp-label">
                  Discount Value
                  {String(form.discountType).toLowerCase().includes("fixed")
                    ? " (SAR)"
                    : " (%)"}
                </label>
                <input
                  value={form.discountValue}
                  onChange={(event) =>
                    updateForm("discountValue", event.target.value)
                  }
                  placeholder={
                    String(form.discountType).toLowerCase().includes("fixed")
                      ? "e.g. 100"
                      : "e.g. 15"
                  }
                  className="mkp-input"
                />
              </div>
            </div>
          </div>

          <div className="mkp-section">
            <div className="mkp-section-title">Targeting</div>

            <div className="mkp-two-col">
              <SingleSelectApiField
                label="Source Workshop"
                icon={Building2}
                options={workshops}
                value={form.sourceWorkshopId}
                onChange={(value) => updateForm("sourceWorkshopId", value)}
                loading={loadingDropdowns}
                error={dropdownError}
                placeholder="Select source workshop"
              />

              <SingleSelectApiField
                label="Target Workshop"
                icon={Building2}
                options={workshops}
                value={form.targetWorkshopId}
                onChange={(value) => updateForm("targetWorkshopId", value)}
                loading={loadingDropdowns}
                error={dropdownError}
                placeholder="Select target workshop"
              />
            </div>

            <MultiSelectApiField
              label="Source Branch / Store — Created From (select multiple)"
              icon={Building2}
              options={branches}
              selectedIds={form.sourceBranchIds}
              onChange={(ids) => updateForm("sourceBranchIds", ids)}
              loading={loadingDropdowns}
              error={dropdownError}
            />

            <MultiSelectApiField
              label="Target Branches (Where Applicable — select multiple)"
              icon={Building2}
              options={branches}
              selectedIds={form.targetBranchIds}
              onChange={(ids) => updateForm("targetBranchIds", ids)}
              loading={loadingDropdowns}
              error={dropdownError}
            />

            <MultiSelectApiField
              label="Target Zones (select multiple)"
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
            <div className="mkp-section-title">Rules & Validity</div>

            <div className="mkp-two-col">
              <div className="mkp-form-group">
                <label className="mkp-label">Customer Segment</label>
                <SelectField
                  value={form.customerSegment}
                  onChange={(value) => updateForm("customerSegment", value)}
                  options={customerSegmentOptions}
                />
              </div>

              <div className="mkp-form-group">
                <label className="mkp-label">Min. Purchase Amount (SAR)</label>
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
                Max Usage Count (0 = unlimited)
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
                <label className="mkp-label">Start Date & Time</label>
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
                <label className="mkp-label">End Date & Time</label>
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
            <div className="mkp-section-title">Customer Display</div>

            <div className="mkp-form-group">
              <label className="mkp-label">Invoice Banner Text</label>
              <input
                value={form.bannerText}
                onChange={(event) =>
                  updateForm("bannerText", event.target.value)
                }
                placeholder="e.g. You saved SAR 50 with Ramadan Offer!"
                className="mkp-input"
              />
            </div>

            <div className="mkp-form-group">
              <label className="mkp-label">Description</label>
              <textarea
                value={form.description}
                onChange={(event) =>
                  updateForm("description", event.target.value)
                }
                className="mkp-textarea"
              />
            </div>

            <div className="mkp-form-group">
              <label className="mkp-label">Terms & Conditions</label>
              <textarea
                value={form.terms}
                onChange={(event) => updateForm("terms", event.target.value)}
                placeholder="T&Cs printed on invoice..."
                className="mkp-textarea"
              />
            </div>

            <div className="mkp-form-group">
              <label className="mkp-label">
                <Image size={13} strokeWidth={2} />
                Advertising / Marketing Banners
                <span>(displayed on Customer Portal & App)</span>
              </label>

              <div className="mkp-upload-row">
                <button type="button" className="mkp-upload-box">
                  <Upload size={15} />
                  <span>Upload</span>
                </button>
              </div>

              <div className="mkp-upload-hint">
                Upload PNG, JPG, or WebP. Banners will be displayed to customers
                in the portal and POS.
              </div>
            </div>

            <div className="mkp-toggles-row">
              <Toggle
                checked={form.autoClose}
                onChange={(value) => updateForm("autoClose", value)}
                label="Auto-close on end date"
              />

              <Toggle
                checked={form.showPos}
                onChange={(value) => updateForm("showPos", value)}
                label="Show on POS Invoice"
              />

              <Toggle
                checked={form.showCustomerPortal}
                onChange={(value) => updateForm("showCustomerPortal", value)}
                label="Show on Customer Portal"
              />
            </div>
          </div>

          {(canSaveDraft || canSubmitForApproval) && !isEdit ? (
            <div className="mkp-approval-note">
              <Hourglass size={14} />
              <b>Save Draft</b> keeps the promotion private.{" "}
              <b>Submit for Approval</b> sends it to Super Admin before it can go
              live on POS.
            </div>
          ) : null}

          <div className="mkp-form-page-footer">
            <button
              type="button"
              onClick={goBack}
              className="mkp-cancel-btn"
              disabled={submitting}
            >
              Cancel
            </button>

            {canSaveDraft ? (
              <button
                type="button"
                className="mkp-cancel-btn"
                disabled={submitting}
                onClick={() => runAction("draft")}
              >
                {submitting ? "Saving..." : "Save Draft"}
              </button>
            ) : null}

            {canSubmitForApproval ? (
              <button
                type="submit"
                className="mkp-submit-btn"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 size={15} className="mkp-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit for Approval"
                )}
              </button>
            ) : null}

            {canUpdateFields ? (
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
                  "Update Promotion"
                )}
              </button>
            ) : null}
          </div>
        </form>
      )}
        </div>
        {!isEdit ? <PromotionGuide /> : null}
      </div>
    </div>
  );
}
