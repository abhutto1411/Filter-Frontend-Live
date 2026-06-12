import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  X,
  ChevronDown,
  Upload,
  Building2,
  MapPin,
  Package,
  Gift,
  Image,
  Hourglass,
  Search,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Tag,
  Edit3,
  Trash2,
  Clock3,
} from "lucide-react";
import {
  marketingCreatePromotion,
  marketingDeletePromotion,
  marketingGetPromotionOptions,
  marketingListPromotions,
  marketingUpdatePromotion,
} from "../../services/superAdminMarketingApi";
import "./MarketingUniversal.css";

const strategyOptions = [
  "Standard Promotion",
  "Cross-Platform Promotion",
  "Zone-Wise Offer",
  "Loyalty Reward",
  "Seasonal Campaign",
  "Cross-Branch Free Service",
];

const promotionTypeOptions = [
  "Percentage Discount",
  "Fixed Amount Discount",
  "Buy X Get Y Free",
  "Free Service",
  "Free Service At Another Branch",
  "Zone-Wide Offer",
];

const discountTypeOptions = ["Percentage (%)", "Fixed Amount (SAR)"];

const customerSegmentOptions = [
  "All Customers",
  "New Customers Only",
  "Returning Customers",
  "VIP Customers",
  "Corporate Customers",
];

const statusOptions = ["Draft", "Scheduled", "Active", "Inactive"];

const filterStatusOptions = [
  "All Statuses",
  "Draft",
  "Scheduled",
  "Active",
  "Inactive",
  "Expired",
  "Pending Approval",
  "Approved",
  "Rejected",
];

const safeArray = (response, keys = []) => {
  if (Array.isArray(response)) return response;

  for (const key of keys) {
    if (Array.isArray(response?.[key])) return response[key];
    if (Array.isArray(response?.data?.[key])) return response.data[key];
  }

  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.records)) return response.records;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.results)) return response.results;

  return [];
};

const normalizeOption = (item, fallbackPrefix) => {
  const id =
    item?.id ||
    item?._id ||
    item?.uuid ||
    item?.value ||
    `${fallbackPrefix}-${Math.random().toString(36).slice(2)}`;

  const label =
    item?.label ||
    item?.name ||
    item?.title ||
    item?.branchName ||
    item?.branch_name ||
    item?.zoneName ||
    item?.zone_name ||
    item?.productName ||
    item?.product_name ||
    item?.serviceName ||
    item?.service_name ||
    item?.code ||
    item?.sku ||
    `${fallbackPrefix} ${id}`;

  return {
    ...item,
    id: String(id),
    value: String(item?.value || id),
    label,
    realId: String(item?.realId || id),
    workshopId:
      item?.workshopId?.toString?.() ||
      item?.workshop_id?.toString?.() ||
      item?.workshop?.id?.toString?.() ||
      "",
  };
};

const mapBackendDiscountTypeToUi = (value) => {
  const normalized = String(value || "").toLowerCase();

  if (normalized.includes("fixed")) return "Fixed Amount (SAR)";
  return "Percentage (%)";
};

const normalizePromotion = (item) => {
  const statusRaw = item?.status || "draft";

  const statusMap = {
    active: "active",
    inactive: "inactive",
    expired: "expired",
    draft: "draft",
    scheduled: "scheduled",
    pending_approval: "pending approval",
    approved: "approved",
    rejected: "rejected",
  };

  const typeMap = {
    percent: "Percentage Discount",
    flat: "Fixed Amount Discount",
    bogo: "Buy X Get Y Free",
    bundle: "Free Service",
    percentage_discount: "Percentage Discount",
    fixed_discount: "Fixed Amount Discount",
    fixed_amount_discount: "Fixed Amount Discount",
    buy_x_get_y: "Buy X Get Y Free",
    free_service: "Free Service",
    zone_offer: "Zone-Wide Offer",
  };

  return {
    ...item,
    id: String(item?.id || item?._id || Date.now()),
    name:
      item?.name ||
      item?.title ||
      item?.promotionName ||
      "Untitled Promotion",
    strategy: item?.strategy || item?.marketingStrategy || "Standard Promotion",
    promotionType:
      item?.promotionType ||
      item?.promotion_type ||
      typeMap[item?.type] ||
      typeMap[item?.promoType] ||
      item?.type ||
      item?.promoType ||
      "Promotion",
    discountType: mapBackendDiscountTypeToUi(item?.discountType),
    discountValue:
      item?.value || item?.discountValue || item?.discount_value || 0,
    status: statusMap[String(statusRaw).toLowerCase()] || statusRaw,
    endDate:
      item?.endDate ||
      item?.end_date ||
      item?.endAt ||
      item?.validTo ||
      null,
    description: item?.description || "",
    sourceWorkshopId:
      item?.sourceWorkshopId?.toString?.() || item?.sourceWorkshopId || "",
    targetWorkshopId:
      item?.targetWorkshopId?.toString?.() || item?.targetWorkshopId || "",
    sourceBranchId:
      item?.sourceBranchId?.toString?.() || item?.sourceBranchId || "",
    targetBranchId:
      item?.targetBranchId?.toString?.() || item?.targetBranchId || "",
    targetBranchIds: Array.isArray(item?.targetBranchIds)
      ? item.targetBranchIds
      : [],
    targetZoneIds: item?.targetZoneIds || item?.targetZones || [],
    targetZones: item?.targetZones || item?.targetZoneIds || [],
    triggerProductIds: item?.triggerProductIds || [],
    rewardProductIds: item?.rewardProductIds || item?.rewardItemIds || [],
    rewardItemIds: item?.rewardItemIds || item?.rewardProductIds || [],
    invoiceBannerText: item?.invoiceBannerText || "",
    termsConditions: item?.termsConditions || "",
    autoCloseOnEndDate: item?.autoCloseOnEndDate,
    showOnPosInvoice: item?.showOnPosInvoice,
    showOnCustomerPortal: item?.showOnCustomerPortal,
  };
};

const mapPromotionTypeToBackendType = (promotionType) => {
  const value = String(promotionType || "").toLowerCase();

  if (value.includes("percentage")) return "percentage_discount";
  if (value.includes("fixed")) return "fixed_discount";
  if (value.includes("buy")) return "buy_x_get_y";
  if (value.includes("free")) return "free_service";
  if (value.includes("zone")) return "zone_offer";

  return "percentage_discount";
};

const mapDiscountTypeToBackend = (discountType) => {
  const value = String(discountType || "").toLowerCase();

  if (value.includes("fixed")) return "fixed_amount";
  return "percentage";
};

const mapCustomerSegmentToApplicableTo = (segment) => {
  const value = String(segment || "").toLowerCase();

  if (value.includes("corporate")) return "corporate";
  if (value.includes("all")) return "all";
  if (value.includes("new")) return "new_customers";
  if (value.includes("returning")) return "returning_customers";
  if (value.includes("vip")) return "high_value";

  return "all";
};

const mapStatusToBackendStatus = (status) => {
  const value = String(status || "").toLowerCase();

  if (value === "draft") return "draft";
  if (value === "scheduled") return "scheduled";
  if (value === "active") return "active";
  if (value === "inactive") return "inactive";
  if (value === "expired") return "expired";

  return "draft";
};

const toIsoDateTimeOrNull = (value) => {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
};

const formatEndDate = (value) => {
  if (!value) return "No end date";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "No end date";

  const diffMs = date.getTime() - Date.now();
  const diffDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

  return `Ends ${date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "2-digit",
  })} (${diffDays}d)`;
};

const SelectField = ({ value, onChange, options, small = false }) => {
  return (
    <div className={small ? "mkp-select-wrap small" : "mkp-select-wrap"}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mkp-input mkp-select"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      <ChevronDown size={14} strokeWidth={2} className="mkp-select-icon" />
    </div>
  );
};

const SingleSelectApiField = ({
  label,
  icon,
  options,
  value,
  onChange,
  loading,
  error,
  placeholder = "Select...",
}) => {
  const Icon = icon;
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const closeOnOutside = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutside);

    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
    };
  }, []);

  const selected = useMemo(() => {
    return options.find((item) => item.id === value) || null;
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return options;

    return options.filter((item) =>
      String(item.label || "").toLowerCase().includes(q)
    );
  }, [options, search]);

  return (
    <div className="mkp-form-group mkp-dd-wrap" ref={wrapRef}>
      <label className="mkp-label">
        {Icon ? <Icon size={13} strokeWidth={2} /> : null}
        {label}
      </label>

      <button
        type="button"
        className={`mkp-dd-button ${open ? "open" : ""}`}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span>{loading ? "Loading..." : selected?.label || placeholder}</span>
        <ChevronDown size={15} strokeWidth={2} />
      </button>

      {open ? (
        <div className="mkp-dd-menu">
          <div className="mkp-dd-search">
            <Search size={14} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search..."
              autoFocus
            />
          </div>

          <div className="mkp-dd-list">
            {loading ? (
              <div className="mkp-dd-empty">
                <Loader2 size={15} className="mkp-spin" />
                Loading options...
              </div>
            ) : error ? (
              <div className="mkp-dd-empty error">
                <AlertCircle size={15} />
                {error}
              </div>
            ) : filteredOptions.length === 0 ? (
              <div className="mkp-dd-empty">No options found</div>
            ) : (
              filteredOptions.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`mkp-dd-single-option ${
                    value === item.id ? "selected" : ""
                  }`}
                  onClick={() => {
                    onChange(item.id);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  {item.label}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const MultiSelectApiField = ({
  label,
  icon,
  options,
  selectedIds,
  onChange,
  loading,
  error,
  placeholder = "Select options...",
}) => {
  const Icon = icon;
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const closeOnOutside = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutside);

    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
    };
  }, []);

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return options;

    return options.filter((item) =>
      String(item.label || "").toLowerCase().includes(q)
    );
  }, [options, search]);

  const selectedLabels = useMemo(() => {
    return options
      .filter((item) => selectedIds.includes(item.id))
      .map((item) => item.label);
  }, [options, selectedIds]);

  const toggleOption = (id) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((itemId) => itemId !== id));
      return;
    }

    onChange([...selectedIds, id]);
  };

  const clearSelected = () => {
    onChange([]);
  };

  const displayText =
    selectedLabels.length === 0
      ? placeholder
      : selectedLabels.length <= 2
        ? selectedLabels.join(", ")
        : `${selectedLabels.length} selected`;

  return (
    <div className="mkp-form-group mkp-dd-wrap" ref={wrapRef}>
      <label className="mkp-label">
        {Icon ? <Icon size={13} strokeWidth={2} /> : null}
        {label}
      </label>

      <button
        type="button"
        className={`mkp-dd-button ${open ? "open" : ""}`}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span>{loading ? "Loading..." : displayText}</span>
        <ChevronDown size={15} strokeWidth={2} />
      </button>

      {selectedLabels.length > 0 ? (
        <div className="mkp-selected-chips">
          {selectedLabels.slice(0, 4).map((item) => (
            <span key={item}>{item}</span>
          ))}

          {selectedLabels.length > 4 ? (
            <span>+{selectedLabels.length - 4} more</span>
          ) : null}

          <button type="button" onClick={clearSelected}>
            Clear
          </button>
        </div>
      ) : null}

      {open ? (
        <div className="mkp-dd-menu">
          <div className="mkp-dd-search">
            <Search size={14} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search..."
              autoFocus
            />
          </div>

          <div className="mkp-dd-list">
            {loading ? (
              <div className="mkp-dd-empty">
                <Loader2 size={15} className="mkp-spin" />
                Loading options...
              </div>
            ) : error ? (
              <div className="mkp-dd-empty error">
                <AlertCircle size={15} />
                {error}
              </div>
            ) : filteredOptions.length === 0 ? (
              <div className="mkp-dd-empty">No options found</div>
            ) : (
              filteredOptions.map((item) => (
                <label key={item.id} className="mkp-dd-option">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(item.id)}
                    onChange={() => toggleOption(item.id)}
                  />
                  <span>{item.label}</span>
                </label>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const Toggle = ({ checked, onChange, label }) => {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="mkp-toggle-btn"
    >
      <span className={checked ? "mkp-toggle active" : "mkp-toggle"}>
        <span />
      </span>

      {label}
    </button>
  );
};

export const MarketingPromotions = () => {
  const [promotions, setPromotions] = useState([]);

  const [workshops, setWorkshops] = useState([]);
  const [branches, setBranches] = useState([]);
  const [zones, setZones] = useState([]);
  const [products, setProducts] = useState([]);
  const [rewardItems, setRewardItems] = useState([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [loadingPage, setLoadingPage] = useState(false);
  const [loadingDropdowns, setLoadingDropdowns] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [dropdownError, setDropdownError] = useState("");
  const [pageError, setPageError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const emptyForm = {
    name: "",
    strategy: "Standard Promotion",
    promotionType: "Percentage Discount",
    discountType: "Percentage (%)",
    discountValue: "",

    sourceWorkshopId: "",
    targetWorkshopId: "",

    sourceBranchIds: [],
    targetBranchIds: [],
    targetZoneIds: [],
    triggerProductIds: [],
    rewardProductIds: [],

    customerSegment: "All Customers",
    minPurchase: "0",
    maxUsage: "0",
    status: "Draft",
    startDate: "",
    endDate: "",
    bannerText: "",
    description: "",
    terms: "",
    autoClose: true,
    showPos: true,
    showCustomerPortal: true,
  };

  const [form, setForm] = useState(emptyForm);

  const filteredPromotions = useMemo(() => {
    const q = search.trim().toLowerCase();

    return promotions.filter((item) => {
      const matchesSearch = !q || item.name.toLowerCase().includes(q);
      const uiStatus =
        String(item.status || "").charAt(0).toUpperCase() +
        String(item.status || "").slice(1);

      const matchesStatus =
        statusFilter === "All Statuses" ||
        item.status === statusFilter ||
        uiStatus === statusFilter ||
        String(item.status || "").toLowerCase() ===
          statusFilter.toLowerCase().replace(/\s+/g, "_");

      return matchesSearch && matchesStatus;
    });
  }, [promotions, search, statusFilter]);

  const updateForm = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const loadPromotions = async () => {
    try {
      setLoadingPage(true);
      setPageError("");

      const data = await marketingListPromotions({
        limit: 200,
        offset: 0,
        status: "all",
      });

      setPromotions(
        safeArray(data, ["promotions", "items", "data"]).map(normalizePromotion)
      );
    } catch (error) {
      console.error("Promotion API error:", error);
      setPageError(
        error?.message || "Promotions API load nahi hui. Network/API check karo."
      );
      setPromotions([]);
    } finally {
      setLoadingPage(false);
    }
  };

  const loadDropdownData = async () => {
    try {
      setLoadingDropdowns(true);
      setDropdownError("");

      const data = await marketingGetPromotionOptions();

      const workshopOptions = safeArray(data, [
        "workshops",
        "sourceWorkshops",
        "targetWorkshops",
      ]).map((item) => normalizeOption(item, "workshop"));

      const branchOptions = safeArray(data, [
        "branches",
        "sourceBranches",
        "targetBranches",
      ]).map((item) => normalizeOption(item, "branch"));

      const zoneOptions = safeArray(data, ["zones", "targetZones"]).map((item) =>
        normalizeOption(item, "zone")
      );

      const productOptions = safeArray(data, [
        "products",
        "triggerProducts",
      ]).map((item) => normalizeOption(item, "product"));

      const rewardProductOptions = safeArray(data, [
        "rewardProducts",
        "rewardItems",
        "products",
      ]).map((item) => ({
        ...normalizeOption(item, "reward"),
        rewardKind: String(item?.type || item?.rewardKind || "product").toLowerCase(),
      }));

      const rewardServiceOptions = safeArray(data, [
        "rewardServices",
        "services",
      ]).map((item) => ({
        ...normalizeOption(item, "service"),
        id: `service-${item.id || item.value}`,
        realId: String(item.id || item.value),
        label: `${item.label || item.name || "Service"} — Service`,
        rewardKind: "service",
      }));

      const normalizedRewardProducts = rewardProductOptions.map((item) => {
        const isService = String(item.type || item.rewardKind || "")
          .toLowerCase()
          .includes("service");

        const realId = item.realId || item.id;

        return {
          ...item,
          id: isService ? `service-${realId}` : `product-${realId}`,
          realId,
          label: isService
            ? `${item.label} — Service`
            : `${item.label} — Product`,
          rewardKind: isService ? "service" : "product",
        };
      });

      setWorkshops(workshopOptions);
      setBranches(branchOptions);
      setZones(zoneOptions);
      setProducts(productOptions);
      setRewardItems([...normalizedRewardProducts, ...rewardServiceOptions]);
    } catch (error) {
      console.error("Dropdown API error:", error);
      setDropdownError(error?.message || "Dropdown data load nahi hua.");
      setWorkshops([]);
      setBranches([]);
      setZones([]);
      setProducts([]);
      setRewardItems([]);
    } finally {
      setLoadingDropdowns(false);
    }
  };

  useEffect(() => {
    loadPromotions();
    loadDropdownData();
  }, []);

  const openModal = () => {
    resetForm();
    setSuccessMessage("");
    setShowModal(true);
    loadDropdownData();
  };

  const openEditModal = (item) => {
    setEditingId(item.id);
    setSuccessMessage("");

    setForm({
      ...emptyForm,
      name: item.name || "",
      strategy: item.strategy || "Standard Promotion",
      promotionType: item.promotionType || "Percentage Discount",
      discountType: item.discountType || "Percentage (%)",
      discountValue: item.discountValue || "",
      status:
        String(item.status || "").charAt(0).toUpperCase() +
          String(item.status || "").slice(1) || "Draft",
      description: item.description || "",
      sourceWorkshopId: item.sourceWorkshopId || "",
      targetWorkshopId: item.targetWorkshopId || "",
      sourceBranchIds: item.sourceBranchId ? [item.sourceBranchId] : [],
      targetBranchIds: item.targetBranchIds || [],
      targetZoneIds: item.targetZoneIds || item.targetZones || [],
      triggerProductIds: item.triggerProductIds || [],
      rewardProductIds: item.rewardProductIds || item.rewardItemIds || [],
      bannerText: item.invoiceBannerText || "",
      terms: item.termsConditions || "",
      autoClose: Boolean(item.autoCloseOnEndDate ?? true),
      showPos: Boolean(item.showOnPosInvoice ?? true),
      showCustomerPortal: Boolean(item.showOnCustomerPortal ?? true),
    });

    setShowModal(true);
    loadDropdownData();
  };

  const closeModal = () => {
    if (submitting) return;
    setShowModal(false);
    resetForm();
  };

  const createPromotionPayload = () => {
    const selectedRewardIds = form.rewardProductIds.map((id) =>
      String(id).replace("product-", "").replace("service-", "")
    );

    const selectedSourceBranch = branches.find(
      (item) => item.id === form.sourceBranchIds[0]
    );

    const selectedTargetBranch = branches.find(
      (item) => item.id === form.targetBranchIds[0]
    );

    const sourceWorkshopId =
      form.sourceWorkshopId ||
      selectedSourceBranch?.workshopId ||
      workshops[0]?.id ||
      "";

    const targetWorkshopId =
      form.targetWorkshopId ||
      selectedTargetBranch?.workshopId ||
      sourceWorkshopId ||
      workshops[0]?.id ||
      "";

    const branchIds =
      form.targetBranchIds.length > 0
        ? form.targetBranchIds
        : form.sourceBranchIds;

    return {
      name: form.name.trim(),
      promotionName: form.name.trim(),

      sourceWorkshopId,
      targetWorkshopId,
      workshopId: sourceWorkshopId,

      sourceBranchId: form.sourceBranchIds[0] || null,
      targetBranchId: form.targetBranchIds[0] || null,

      marketingStrategy: form.strategy,
      promotionType: mapPromotionTypeToBackendType(form.promotionType),
      promoType: mapPromotionTypeToBackendType(form.promotionType),
      type: mapPromotionTypeToBackendType(form.promotionType),

      discountType: mapDiscountTypeToBackend(form.discountType),
      value: Number(form.discountValue || 0),
      discountValue: Number(form.discountValue || 0),

      minPurchaseAmount: Number(form.minPurchase || 0),
      minOrderAmount: Number(form.minPurchase || 0),
      min_order_amount: Number(form.minPurchase || 0),

      applicableTo: mapCustomerSegmentToApplicableTo(form.customerSegment),
      applicable_to: mapCustomerSegmentToApplicableTo(form.customerSegment),
      customerSegment: mapCustomerSegmentToApplicableTo(form.customerSegment),

      branchIds,
      branch_ids: branchIds,

      targetBranchIds: form.targetBranchIds,
      targetZoneIds: form.targetZoneIds,
      targetZones: form.targetZoneIds,

      triggerProductIds: form.triggerProductIds,
      rewardProductIds: selectedRewardIds,
      rewardItemIds: selectedRewardIds,

      startAt: toIsoDateTimeOrNull(form.startDate),
      startDate: toIsoDateTimeOrNull(form.startDate),
      start_date: toIsoDateTimeOrNull(form.startDate),
      validFrom: toIsoDateTimeOrNull(form.startDate),

      endAt: toIsoDateTimeOrNull(form.endDate),
      endDate: toIsoDateTimeOrNull(form.endDate),
      end_date: toIsoDateTimeOrNull(form.endDate),
      validTo: toIsoDateTimeOrNull(form.endDate),

      maxUsageCount: Number(form.maxUsage || 0),
      usageLimit: Number(form.maxUsage || 0),
      usage_limit: Number(form.maxUsage || 0),
      usageCount: 0,
      usage_count: 0,

      status: mapStatusToBackendStatus(form.status),

      invoiceBannerText: form.bannerText,
      description: form.description?.trim() || "",
      termsConditions: form.terms,
      termsAndConditions: form.terms,

      autoCloseOnEndDate: form.autoClose,
      showOnPosInvoice: form.showPos,
      showOnCustomerPortal: form.showCustomerPortal,
    };
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.name.trim()) {
      alert("Promotion name is required.");
      return;
    }

    if (!form.discountValue && form.promotionType !== "Free Service") {
      alert("Discount value is required.");
      return;
    }

    if (!form.startDate || !form.endDate) {
      alert("Start date and end date are required.");
      return;
    }

    if (new Date(form.endDate) < new Date(form.startDate)) {
      alert("End date must be after start date.");
      return;
    }

    try {
      setSubmitting(true);
      setSuccessMessage("");

      const promotionPayload = createPromotionPayload();

      if (editingId) {
        await marketingUpdatePromotion(editingId, promotionPayload);
      } else {
        await marketingCreatePromotion(promotionPayload);
      }

      await loadPromotions();
      closeModal();

      setSuccessMessage(
        editingId
          ? "Promotion update ho gai."
          : "Promotion approval ke liye submit ho gai."
      );
    } catch (error) {
      console.error("Create/Update promotion error:", error);
      alert(
        error?.message ||
          "Promotion save nahi hui. Console aur Network tab check karo."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    const ok = window.confirm("Are you sure you want to delete this promotion?");
    if (!ok) return;

    try {
      await marketingDeletePromotion(id);
      await loadPromotions();
      setSuccessMessage("Promotion delete ho gai.");
    } catch (error) {
      console.error("Delete promotion error:", error);
      alert(
        error?.message ||
          "Promotion delete nahi hui. Console aur Network tab check karo."
      );
    }
  };

  return (
    <div className="mkp-page">
      <div className="mkp-header">
        <div>
          <h1>Promotions</h1>
          <p>
            Create and manage marketing promotions with banners, multi-branch,
            multi-zone & multi-product support
          </p>
        </div>

        <button type="button" onClick={openModal} className="mkp-new-btn">
          <Plus size={15} strokeWidth={2.5} />
          New Promotion
        </button>
      </div>

      {successMessage ? (
        <div className="mkp-success">
          <CheckCircle2 size={16} />
          {successMessage}
        </div>
      ) : null}

      {pageError ? (
        <div className="mkp-error">
          <AlertCircle size={16} />
          {pageError}
        </div>
      ) : null}

      <div className="mkp-filters">
        <label className="mkp-search">
          <Search size={14} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search promotions..."
          />
        </label>

        <SelectField
          value={statusFilter}
          onChange={setStatusFilter}
          options={filterStatusOptions}
          small
        />
      </div>

      <div className="mkp-content">
        {loadingPage ? (
          <div className="mkp-empty">
            <Loader2 size={30} className="mkp-spin" />
            <div>Loading promotions...</div>
          </div>
        ) : filteredPromotions.length === 0 ? (
          <div className="mkp-empty">
            <Tag size={38} />
            <div>No promotions found</div>
          </div>
        ) : (
          <div className="mkp-card-list">
            {filteredPromotions.map((item) => (
              <div key={item.id} className="mkp-card">
                <div className="mkp-card-top">
                  <div className="mkp-card-icon">
                    <Tag size={15} />
                  </div>

                  <div className="mkp-card-body">
                    <div className="mkp-card-title">{item.name}</div>

                    <div className="mkp-card-sub">
                      {item.strategy} • {item.promotionType} • Value:{" "}
                      {item.discountValue || 0}
                    </div>
                  </div>

                  <div className="mkp-card-badges">
                    <span
                      className={`mkp-status status-${String(item.status)
                        .toLowerCase()
                        .replace(/\s+/g, "-")}`}
                    >
                      {item.status}
                    </span>

                    {String(item.status).toLowerCase() === "rejected" ? (
                      <span className="mkp-rejected-chip">✕ Rejected</span>
                    ) : null}
                  </div>
                </div>

                <div className="mkp-progress" />

                <div className="mkp-card-date">
                  <Clock3 size={13} />
                  {formatEndDate(item.endDate)}
                </div>

                <div className="mkp-card-footer">
                  <button type="button" onClick={() => openEditModal(item)}>
                    <Edit3 size={14} />
                    Edit
                  </button>

                  <button
                    type="button"
                    className="danger"
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal ? (
        <div className="mkp-modal-overlay">
          <div className="mkp-modal">
            <div className="mkp-modal-header">
              <div>
                <h2>{editingId ? "Edit Promotion" : "New Promotion"}</h2>
                <p>
                  Create campaign offer and submit it for Super Admin approval.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="mkp-close"
                disabled={submitting}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mkp-form">
              <div className="mkp-section">
                <div className="mkp-section-title">Basic Information</div>

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
                    <label className="mkp-label">Discount Value</label>
                    <input
                      value={form.discountValue}
                      onChange={(event) =>
                        updateForm("discountValue", event.target.value)
                      }
                      placeholder="e.g. 15"
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
                    onChange={(id) => updateForm("sourceWorkshopId", id)}
                    loading={loadingDropdowns}
                    error={dropdownError}
                    placeholder="Select source workshop"
                  />

                  <SingleSelectApiField
                    label="Target Workshop"
                    icon={Building2}
                    options={workshops}
                    value={form.targetWorkshopId}
                    onChange={(id) => updateForm("targetWorkshopId", id)}
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

                <MultiSelectApiField
                  label="Trigger Products — Customer Must Buy"
                  icon={Package}
                  options={products}
                  selectedIds={form.triggerProductIds}
                  onChange={(ids) => updateForm("triggerProductIds", ids)}
                  loading={loadingDropdowns}
                  error={dropdownError}
                />

                <MultiSelectApiField
                  label="Reward Products / Services — Customer Gets Free or Discounted"
                  icon={Gift}
                  options={rewardItems}
                  selectedIds={form.rewardProductIds}
                  onChange={(ids) => updateForm("rewardProductIds", ids)}
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
                    <label className="mkp-label">
                      Min. Purchase Amount (SAR)
                    </label>
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

                <div className="mkp-two-col">
                  <div className="mkp-form-group">
                    <label className="mkp-label">
                      Max Usage Count (0 = unlimited)
                    </label>
                    <input
                      type="number"
                      value={form.maxUsage}
                      onChange={(event) =>
                        updateForm("maxUsage", event.target.value)
                      }
                      className="mkp-input"
                    />
                  </div>

                  <div className="mkp-form-group">
                    <label className="mkp-label">Status</label>
                    <SelectField
                      value={form.status}
                      onChange={(value) => updateForm("status", value)}
                      options={statusOptions}
                    />
                  </div>
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
                    Upload PNG, JPG, or WebP. Banners will be displayed to
                    customers in the portal and POS.
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

              <div className="mkp-approval-note">
                <Hourglass size={14} />
                After creating, this will be sent to the{" "}
                <b>Super Admin for approval</b> before it goes live.
              </div>

              <div className="mkp-modal-footer">
                <button
                  type="button"
                  onClick={closeModal}
                  className="mkp-cancel-btn"
                  disabled={submitting}
                >
                  Cancel
                </button>

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
                  ) : editingId ? (
                    "Update Promotion"
                  ) : (
                    "Submit for Approval"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default MarketingPromotions;
