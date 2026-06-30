import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  Upload,
  Building2,
  MapPin,
  Package,
  Gift,
  Image,
  Search,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { marketingGetPromotionOptions } from '../../services/superAdminMarketingApi';
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

  if (
    normalized.includes("fixed") ||
    normalized.includes("flat") ||
    normalized.includes("sar") ||
    normalized === "amount"
  ) {
    return "Fixed Amount (SAR)";
  }

  return "Percentage (%)";
};

const PROMOTION_TYPE_UI_MAP = {
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

const mapBackendPromotionTypeToUi = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "Percentage Discount";

  const key = raw.toLowerCase().replace(/\s+/g, "_");
  if (PROMOTION_TYPE_UI_MAP[key]) return PROMOTION_TYPE_UI_MAP[key];
  if (PROMOTION_TYPE_UI_MAP[raw]) return PROMOTION_TYPE_UI_MAP[raw];

  return raw;
};

export function formatPromotionDiscountDisplay(item) {
  const uiType = String(item?.discountType || "").toLowerCase();
  const backendType = String(item?.discountTypeRaw || item?.discount_type || "")
    .toLowerCase();
  const combined = `${uiType} ${backendType}`;
  const value = item?.discountValue ?? item?.value ?? item?.discount_value ?? 0;

  if (
    combined.includes("fixed") ||
    combined.includes("sar") ||
    combined.includes("amount") ||
    combined.includes("flat")
  ) {
    return `${value} SAR`;
  }

  return `${value}%`;
}

const isPercentageDiscountUi = (discountType) => {
  const value = String(discountType || "").toLowerCase();
  if (
    value.includes("fixed") ||
    value.includes("sar") ||
    value.includes("amount") ||
    value.includes("flat")
  ) {
    return false;
  }
  return true;
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

  const normalizedStatus =
    statusMap[String(statusRaw).toLowerCase().replace(/\s+/g, "_")] ||
    String(statusRaw).toLowerCase();

  const derivePromotionIsActive = (status, isActive) => {
    if (String(status).toLowerCase().replace(/\s+/g, "_") === "active") {
      return isActive !== false;
    }
    return false;
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
    discountTypeRaw: item?.discountType ?? item?.discount_type ?? "",
    discountValue:
      item?.value || item?.discountValue || item?.discount_value || 0,
    status: normalizedStatus,
    isActive: derivePromotionIsActive(
      normalizedStatus,
      item?.isActive ?? item?.is_active
    ),
    startDate:
      item?.startDate ||
      item?.start_date ||
      item?.startAt ||
      item?.validFrom ||
      null,
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
    triggerServiceIds: item?.triggerServiceIds || [],
    productScope: item?.productScope || 'all',
    serviceScope: item?.serviceScope || 'all',
    selectedItemMatchMode: item?.selectedItemMatchMode || 'all_required',
    rewardProductIds: item?.rewardProductIds || item?.rewardItemIds || [],
    rewardItemIds: item?.rewardItemIds || item?.rewardProductIds || [],
    invoiceBannerText: item?.invoiceBannerText || "",
    termsConditions: item?.termsConditions || "",
    autoCloseOnEndDate: item?.autoCloseOnEndDate,
    showOnPosInvoice: item?.showOnPosInvoice,
    showOnCustomerPortal: item?.showOnCustomerPortal,
    usageCount: Number(
      item?.usageCount ?? item?.usageStats?.usageCount ?? item?.usage_count ?? 0
    ),
    maxUsageCount:
      item?.maxUsageCount ?? item?.usageStats?.maxUsageCount ?? item?.max_usage_count ?? null,
    remainingUsage:
      item?.remainingUsage ?? item?.usageStats?.remainingUsage ?? null,
    totalDiscountProvided: Number(
      item?.totalDiscountProvided ??
        item?.usageStats?.totalDiscountProvided ??
        0
    ),
    totalRevenue: Number(
      item?.totalRevenue ?? item?.usageStats?.totalRevenue ?? 0
    ),
    usageStats: item?.usageStats ?? null,
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

  if (
    value.includes("fixed") ||
    value.includes("sar") ||
    value.includes("amount") ||
    value.includes("flat")
  ) {
    return "fixed";
  }

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
  const value = String(status || "").toLowerCase().replace(/\s+/g, "_");

  if (value === "draft") return "draft";
  if (value === "scheduled") return "scheduled";
  if (value === "pending_approval") return "pending_approval";
  if (value === "approved") return "approved";
  if (value === "rejected") return "rejected";
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

const canTogglePromotionActivation = (item) => {
  const status = String(item?.status || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  const blocked = ["pending_approval", "rejected", "expired", "draft"];
  return !blocked.includes(status);
};

const activationToggleHint = (item) => {
  const status = String(item?.status || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  if (status === "draft") {
    return "Submit and approve this promotion before enabling on POS.";
  }

  if (status === "pending_approval") {
    return "Waiting for approval before it can go live on POS.";
  }

  if (status === "rejected") {
    return "Rejected promotions cannot be activated.";
  }

  if (status === "expired") {
    return "Expired promotions cannot be activated.";
  }

  if (status === "approved") {
    return "Approved — turn on POS status to apply on invoices.";
  }

  return item?.isActive
    ? "Applies on POS for matching branches and products."
    : "Visible but disabled — will not apply on POS invoices.";
};

const isPromotionLiveOnPos = (item) => {
  const status = String(item?.status || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  return (
    status === "active" &&
    item?.isActive !== false &&
    Boolean(item?.showOnPosInvoice)
  );
};

const formatStatusLabel = (status) => {
  const normalized = String(status || "draft")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  const labels = {
    draft: "Draft",
    scheduled: "Scheduled",
    pending_approval: "Pending Approval",
    approved: "Approved",
    rejected: "Rejected",
    active: "Active",
    inactive: "Inactive",
    expired: "Expired",
  };

  return labels[normalized] || String(status || "Draft");
};

const normalizeWorkflowStatus = (status) =>
  String(status || "draft")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

const isSuperAdminUser = (user) =>
  user?.userType === "platform_admin" &&
  (!user?.role || user?.role?.isSystem);

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

function useDropdownKeyboard({
  open,
  setOpen,
  optionCount,
  onPickIndex,
  resetKeys = [],
}) {
  const [highlightIndex, setHighlightIndex] = useState(0);
  const listRef = useRef(null);

  useEffect(() => {
    if (open) setHighlightIndex(0);
  }, [open, optionCount, ...resetKeys]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector(
      `[data-option-index="${highlightIndex}"]`
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex, open]);

  const handleListKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setHighlightIndex((index) =>
        Math.min(index + 1, Math.max(optionCount - 1, 0))
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setHighlightIndex((index) => Math.max(index - 1, 0));
      return;
    }

    if (event.key === "Enter" && open && optionCount > 0) {
      event.preventDefault();
      onPickIndex(highlightIndex);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  };

  const handleTriggerKeyDown = (event) => {
    if (
      event.key === "ArrowDown" ||
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      setOpen(true);
    }
  };

  return {
    highlightIndex,
    setHighlightIndex,
    listRef,
    handleListKeyDown,
    handleTriggerKeyDown,
  };
}

function normalizeStringOptions(options) {
  return options.map((option) => {
    if (typeof option === "string") {
      return { id: option, label: option };
    }
    const id = option?.value ?? option?.id ?? option?.label;
    const label = option?.label ?? option?.value ?? option?.id ?? String(id);
    return { id: String(id), label: String(label) };
  });
}

const SelectField = ({
  value,
  onChange,
  options,
  small = false,
  multiple = false,
  placeholder = "Select...",
}) => {
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const normalizedOptions = useMemo(
    () => normalizeStringOptions(options),
    [options]
  );

  const selectedIds = multiple
    ? Array.isArray(value)
      ? value.map(String)
      : value
        ? [String(value)]
        : []
    : value
      ? [String(value)]
      : [];

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return normalizedOptions;
    return normalizedOptions.filter((item) =>
      String(item.label || "").toLowerCase().includes(q)
    );
  }, [normalizedOptions, search]);

  const selectedLabels = normalizedOptions
    .filter((item) => selectedIds.includes(item.id))
    .map((item) => item.label);

  const displayText =
    selectedLabels.length === 0
      ? placeholder
      : multiple
        ? selectedLabels.length <= 2
          ? selectedLabels.join(", ")
          : `${selectedLabels.length} selected`
        : selectedLabels[0];

  const toggleValue = (id) => {
    if (multiple) {
      if (selectedIds.includes(id)) {
        onChange(selectedIds.filter((itemId) => itemId !== id));
      } else {
        onChange([...selectedIds, id]);
      }
      return;
    }
    onChange(id);
    setOpen(false);
    setSearch("");
  };

  const { highlightIndex, setHighlightIndex, listRef, handleListKeyDown, handleTriggerKeyDown } =
    useDropdownKeyboard({
      open,
      setOpen,
      optionCount: filteredOptions.length,
      onPickIndex: (index) => {
        const item = filteredOptions[index];
        if (item) toggleValue(item.id);
      },
      resetKeys: [search],
    });

  useEffect(() => {
    const closeOnOutside = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", closeOnOutside);
    return () => document.removeEventListener("mousedown", closeOnOutside);
  }, []);

  return (
    <div
      className={small ? "mkp-select-wrap small mkp-dd-wrap" : "mkp-select-wrap mkp-dd-wrap"}
      ref={wrapRef}
    >
      <button
        type="button"
        className={`mkp-dd-button ${open ? "open" : ""}`}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{displayText}</span>
        <ChevronDown size={14} strokeWidth={2} />
      </button>

      {selectedLabels.length > 0 && multiple ? (
        <div className="mkp-selected-chips">
          {selectedLabels.slice(0, 4).map((item) => (
            <span key={item}>{item}</span>
          ))}
          {selectedLabels.length > 4 ? (
            <span>+{selectedLabels.length - 4} more</span>
          ) : null}
          <button
            type="button"
            onClick={() => onChange([])}
          >
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
              onKeyDown={handleListKeyDown}
              placeholder="Search..."
              autoFocus
            />
          </div>

          <div className="mkp-dd-list" ref={listRef} role="listbox">
            {filteredOptions.length === 0 ? (
              <div className="mkp-dd-empty">No options found</div>
            ) : multiple ? (
              filteredOptions.map((item, index) => (
                <label
                  key={item.id}
                  data-option-index={index}
                  className={`mkp-dd-option ${
                    index === highlightIndex ? "active" : ""
                  } ${selectedIds.includes(item.id) ? "selected" : ""}`}
                  onMouseEnter={() => setHighlightIndex(index)}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(item.id)}
                    onChange={() => toggleValue(item.id)}
                  />
                  <span>{item.label}</span>
                </label>
              ))
            ) : (
              filteredOptions.map((item, index) => (
                <button
                  type="button"
                  key={item.id}
                  data-option-index={index}
                  className={`mkp-dd-single-option ${
                    value === item.id ? "selected" : ""
                  } ${index === highlightIndex ? "active" : ""}`}
                  onClick={() => toggleValue(item.id)}
                  onMouseEnter={() => setHighlightIndex(index)}
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

  const pickOption = (item) => {
    onChange(item.id);
    setOpen(false);
    setSearch("");
  };

  const { highlightIndex, setHighlightIndex, listRef, handleListKeyDown, handleTriggerKeyDown } =
    useDropdownKeyboard({
      open,
      setOpen,
      optionCount: filteredOptions.length,
      onPickIndex: (index) => {
        const item = filteredOptions[index];
        if (item) pickOption(item);
      },
      resetKeys: [search],
    });

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
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
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
              onKeyDown={handleListKeyDown}
              placeholder="Search..."
              autoFocus
            />
          </div>

          <div className="mkp-dd-list" ref={listRef} role="listbox">
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
              filteredOptions.map((item, index) => (
                <button
                  type="button"
                  key={item.id}
                  data-option-index={index}
                  className={`mkp-dd-single-option ${
                    value === item.id ? "selected" : ""
                  } ${index === highlightIndex ? "active" : ""}`}
                  onClick={() => pickOption(item)}
                  onMouseEnter={() => setHighlightIndex(index)}
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

  const { highlightIndex, setHighlightIndex, listRef, handleListKeyDown, handleTriggerKeyDown } =
    useDropdownKeyboard({
      open,
      setOpen,
      optionCount: filteredOptions.length,
      onPickIndex: (index) => {
        const item = filteredOptions[index];
        if (item) toggleOption(item.id);
      },
      resetKeys: [search],
    });

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
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
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
              onKeyDown={handleListKeyDown}
              placeholder="Search..."
              autoFocus
            />
          </div>

          <div className="mkp-dd-list" ref={listRef} role="listbox">
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
              filteredOptions.map((item, index) => (
                <label
                  key={item.id}
                  data-option-index={index}
                  className={`mkp-dd-option ${
                    index === highlightIndex ? "active" : ""
                  } ${selectedIds.includes(item.id) ? "selected" : ""}`}
                  onMouseEnter={() => setHighlightIndex(index)}
                >
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
const inferPromotionScope = (explicit, ids) => {
  const scope = String(explicit ?? '').trim().toLowerCase();
  if (scope === 'all' || scope === 'selected' || scope === 'none') return scope;
  return Array.isArray(ids) && ids.length > 0 ? 'selected' : 'all';
};

export const EMPTY_PROMOTION_FORM = {
  name: '',
  strategy: 'Standard Promotion',
  promotionType: 'Percentage Discount',
  discountType: 'Percentage (%)',
  discountValue: '',
  sourceWorkshopId: '',
  targetWorkshopId: '',
  sourceBranchIds: [],
  targetBranchIds: [],
  targetZoneIds: [],
  triggerProductIds: [],
  productScope: 'all',
  productTriggerIds: [],
  serviceScope: 'all',
  serviceTriggerIds: [],
  selectedItemMatchMode: 'all_required',
  rewardProductIds: [],
  rewardBenefitType: 'none',
  rewardDiscountValue: '',
  rewardMaxQuantity: '',
  customerSegment: 'All Customers',
  minPurchase: '0',
  maxUsage: '0',
  status: 'Draft',
  startDate: '',
  endDate: '',
  bannerText: '',
  description: '',
  terms: '',
  autoClose: true,
  showPos: true,
  showCustomerPortal: true,
};

export function formatPromotionUsageLabel(item) {
  const usageCount = Number(item?.usageCount ?? 0);
  const maxUsageCount = Number(item?.maxUsageCount ?? 0);
  const remaining = item?.remainingUsage;

  if (!maxUsageCount || maxUsageCount <= 0) {
    return `${usageCount} used · Unlimited`;
  }

  const left =
    remaining != null ? Number(remaining) : Math.max(0, maxUsageCount - usageCount);

  return `${usageCount} / ${maxUsageCount} used · ${left} left`;
}

export function formatPromotionSar(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0 SAR';

  return `${n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} SAR`;
}

export function resolvePromotionBasePath(pathname) {
  if (pathname.includes('/admin/marketing')) return '/admin/marketing/marketing-promotions';
  return '/marketing/marketing-promotions';
}

export function toDateTimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

export function promotionFormFromItem(item) {
  const legacyTriggerIds = (item.triggerProductIds || []).map((id) => String(id));
  const explicitProductIds = (item.productTriggerIds || item.triggerProductIdsOnly || []).map(
    String,
  );
  const explicitServiceIds = (item.triggerServiceIds || item.serviceTriggerIds || []).map(
    String,
  );

  const productTriggerIds =
    explicitProductIds.length > 0
      ? explicitProductIds
      : legacyTriggerIds.filter((id) => !id.startsWith('service-'));

  const serviceTriggerIds =
    explicitServiceIds.length > 0
      ? explicitServiceIds
      : legacyTriggerIds
          .filter((id) => id.startsWith('service-'))
          .map((id) => id.replace(/^service-/, ''));

  const productScope = inferPromotionScope(item.productScope, productTriggerIds);
  const serviceScope = inferPromotionScope(item.serviceScope, serviceTriggerIds);

  return {
    ...EMPTY_PROMOTION_FORM,
    name: item.name || '',
    strategy: item.strategy || 'Standard Promotion',
    promotionType: mapBackendPromotionTypeToUi(
      item.promotionType || item.promoType || item.type
    ),
    discountType: item.discountType || mapBackendDiscountTypeToUi(item.discountTypeRaw),
    discountValue: item.discountValue || '',
    status:
      String(item.status || '').charAt(0).toUpperCase() +
        String(item.status || '').slice(1) || 'Draft',
    description: item.description || '',
    sourceWorkshopId: item.sourceWorkshopId || '',
    targetWorkshopId: item.targetWorkshopId || '',
    sourceBranchIds: item.sourceBranchId ? [item.sourceBranchId] : [],
    targetBranchIds: item.targetBranchIds || [],
    targetZoneIds: item.targetZoneIds || item.targetZones || [],
    triggerProductIds: legacyTriggerIds,
    productScope,
    productTriggerIds,
    serviceScope,
    serviceTriggerIds,
    selectedItemMatchMode: item.selectedItemMatchMode || 'all_required',
    rewardProductIds: item.rewardProductIds || item.rewardItemIds || [],
    rewardBenefitType: item.rewardBenefitType || 'none',
    rewardDiscountValue:
      item.rewardDiscountValue != null && item.rewardDiscountValue !== ''
        ? String(item.rewardDiscountValue)
        : '',
    rewardMaxQuantity:
      item.rewardMaxQuantity != null && item.rewardMaxQuantity !== ''
        ? String(item.rewardMaxQuantity)
        : '',
    bannerText: item.invoiceBannerText || '',
    terms: item.termsConditions || '',
    autoClose: Boolean(item.autoCloseOnEndDate ?? true),
    showPos: Boolean(item.showOnPosInvoice ?? true),
    showCustomerPortal: Boolean(item.showOnCustomerPortal ?? true),
    startDate: toDateTimeLocal(item.startDate || item.startAt || item.validFrom),
    endDate: toDateTimeLocal(item.endDate || item.endAt || item.validTo),
    minPurchase: String(item.minPurchaseAmount ?? item.minOrderAmount ?? '0'),
    maxUsage: String(item.maxUsageCount ?? item.usageLimit ?? '0'),
  };
}

export function buildPromotionPayload(
  form,
  branches,
  workshops,
  { statusOverride } = {}
) {
  const selectedRewardIds = form.rewardProductIds.map((id) =>
    String(id).replace('product-', '').replace('service-', '')
  );
  const selectedProductTriggerIds =
    form.productScope === 'selected'
      ? (form.productTriggerIds || []).map((id) =>
          String(id).replace(/^product-/, ''),
        )
      : [];
  const selectedServiceTriggerIds =
    form.serviceScope === 'selected'
      ? (form.serviceTriggerIds || []).map((id) =>
          String(id).replace(/^service-/, ''),
        )
      : [];
  const selectedTriggerIds = [...selectedProductTriggerIds, ...selectedServiceTriggerIds];
  const selectedSourceBranch = branches.find((item) => item.id === form.sourceBranchIds[0]);
  const selectedTargetBranch = branches.find((item) => item.id === form.targetBranchIds[0]);
  const sourceWorkshopId =
    form.sourceWorkshopId || selectedSourceBranch?.workshopId || workshops[0]?.id || '';
  const targetWorkshopId =
    form.targetWorkshopId || selectedTargetBranch?.workshopId || sourceWorkshopId || workshops[0]?.id || '';
  const branchIds = form.targetBranchIds.length > 0 ? form.targetBranchIds : form.sourceBranchIds;

  const resolvedStatus = statusOverride
    ? mapStatusToBackendStatus(statusOverride)
    : null;

  const payload = {
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
    triggerProductIds: selectedProductTriggerIds,
    triggerServiceIds: selectedServiceTriggerIds,
    productScope: form.productScope || 'all',
    serviceScope: form.serviceScope || 'all',
    selectedItemMatchMode: form.selectedItemMatchMode || 'all_required',
    rewardProductIds: selectedRewardIds,
    rewardBenefitType: form.rewardBenefitType || 'none',
    rewardDiscountValue:
      form.rewardDiscountValue === '' || form.rewardDiscountValue == null
        ? 0
        : Number(form.rewardDiscountValue),
    rewardMaxQuantity:
      form.rewardMaxQuantity === '' || form.rewardMaxQuantity == null
        ? 0
        : Number(form.rewardMaxQuantity),
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
    invoiceBannerText: form.bannerText,
    description: form.description?.trim() || '',
    termsConditions: form.terms,
    termsAndConditions: form.terms,
    autoCloseOnEndDate: form.autoClose,
    showOnPosInvoice: form.showPos,
    showOnCustomerPortal: form.showCustomerPortal,
  };

  if (resolvedStatus) {
    payload.status = resolvedStatus;
    payload.isActive = resolvedStatus === "active";
  }

  return payload;
}

export function alignStoredIdsWithOptions(storedIds, options) {
  if (!Array.isArray(storedIds) || !Array.isArray(options)) return [];

  return storedIds.map((storedId) => {
    const raw = String(storedId)
      .replace(/^product-/, '')
      .replace(/^service-/, '');

    const match = options.find(
      (option) =>
        option.id === storedId ||
        option.realId === raw ||
        option.id === `product-${raw}` ||
        option.id === `service-${raw}`
    );

    return match?.id ?? storedId;
  });
}

function isCatalogServiceRow(item) {
  return String(
    item?.type || item?.itemType || item?.rewardKind || item?.item_kind || ''
  )
    .toLowerCase()
    .includes('service');
}

function buildCatalogItemOptions(data) {
  const buckets = [
    ...safeArray(data, ['products']),
    ...safeArray(data, ['triggerProducts']),
    ...safeArray(data, ['rewardProducts']),
    ...safeArray(data, ['services', 'rewardServices']),
  ];

  const seen = new Set();
  const merged = [];

  for (const item of buckets) {
    const isService = isCatalogServiceRow(item);
    const normalized = normalizeOption(item, isService ? 'service' : 'product');
    const realId = String(
      isService
        ? item?.serviceId ?? normalized.realId ?? normalized.id ?? normalized.value
        : item?.productId ?? normalized.realId ?? normalized.id ?? normalized.value
    );
    const key = `${isService ? 'service' : 'product'}-${realId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({
      ...normalized,
      type: isService ? 'service' : 'product',
      realId,
    });
  }

  return merged.map((item) => {
    const isService = isCatalogServiceRow(item);
    const realId = String(item.realId || item.id || item.value);
    const kind = isService ? 'service' : 'product';
    const baseLabel = String(item.label || item.name || `${kind} ${realId}`).replace(
      /\s+—\s+(Product|Service)$/i,
      ''
    );

    return {
      ...item,
      id: `${kind}-${realId}`,
      realId,
      label: `${baseLabel} — ${isService ? 'Service' : 'Product'}`,
      itemKind: kind,
    };
  });
}

export async function loadPromotionDropdownData() {
  const data = await marketingGetPromotionOptions();
  const workshopOptions = safeArray(data, ['workshops', 'sourceWorkshops', 'targetWorkshops']).map((item) => normalizeOption(item, 'workshop'));
  const branchOptions = safeArray(data, ['branches', 'sourceBranches', 'targetBranches']).map((item) => normalizeOption(item, 'branch'));
  const zoneOptions = safeArray(data, ['zones', 'targetZones']).map((item) => normalizeOption(item, 'zone'));
  const catalogItems = buildCatalogItemOptions(data);

  return {
    workshops: workshopOptions,
    branches: branchOptions,
    zones: zoneOptions,
    triggerItems: catalogItems,
    rewardItems: catalogItems,
  };
}

export {
  strategyOptions,
  promotionTypeOptions,
  discountTypeOptions,
  customerSegmentOptions,
  statusOptions,
  filterStatusOptions,
  safeArray,
  normalizeOption,
  normalizePromotion,
  mapPromotionTypeToBackendType,
  mapDiscountTypeToBackend,
  mapCustomerSegmentToApplicableTo,
  mapStatusToBackendStatus,
  toIsoDateTimeOrNull,
  canTogglePromotionActivation,
  activationToggleHint,
  isPromotionLiveOnPos,
  formatEndDate,
  formatStatusLabel,
  normalizeWorkflowStatus,
  isSuperAdminUser,
  SelectField,
  SingleSelectApiField,
  MultiSelectApiField,
  Toggle,
};
