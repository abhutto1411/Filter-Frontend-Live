import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useOutletContext } from "react-router-dom";
import {
  Plus,
  Search,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Tag,
  Edit3,
  Trash2,
  Clock3,
  Eye,
  FileBarChart,
} from "lucide-react";
import {
  marketingDeletePromotion,
  marketingListPromotions,
  marketingSetPromotionActivation,
} from "../../services/superAdminMarketingApi";
import {
  activationToggleHint,
  canTogglePromotionActivation,
  filterStatusOptions,
  formatEndDate,
  formatPromotionSar,
  formatPromotionDiscountDisplay,
  formatPromotionUsageLabel,
  formatStatusLabel,
  isPromotionLiveOnPos,
  normalizePromotion,
  resolvePromotionBasePath,
  safeArray,
  SelectField,
} from "./marketingPromotionShared";
import "./MarketingUniversal.css";

export const MarketingPromotions = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const outletCtx = useOutletContext() || {};
  const embeddedInPortal = Boolean(outletCtx.setShowAddModal);
  const marketingWorkshopId = outletCtx.marketingWorkshopId ?? "";

  const [promotions, setPromotions] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [loadingPage, setLoadingPage] = useState(false);
  const [togglingActivationId, setTogglingActivationId] = useState(null);
  const [pageError, setPageError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const listPath = resolvePromotionBasePath(location.pathname);

  const filteredPromotions = useMemo(() => {
    const q = search.trim().toLowerCase();

    return promotions.filter((item) => {
      const matchesWorkshop =
        !marketingWorkshopId ||
        String(item.sourceWorkshopId || item.workshopId || "") ===
          String(marketingWorkshopId);

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

      return matchesWorkshop && matchesSearch && matchesStatus;
    });
  }, [promotions, search, statusFilter, marketingWorkshopId]);

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
        error?.message || "Could not load promotions. Check the network/API."
      );
      setPromotions([]);
    } finally {
      setLoadingPage(false);
    }
  };

  useEffect(() => {
    loadPromotions();
  }, [marketingWorkshopId]);

  const openNewPage = () => navigate(`${listPath}/new`);
  const openEditPage = (id) => navigate(`${listPath}/${id}/edit`);
  const openViewPage = (id) => navigate(`${listPath}/${id}/view`);
  const openDetailsPage = (id) => navigate(`${listPath}/${id}/details`);
  const openAutoReportPage = (id) => navigate(`${listPath}/${id}/auto-report`);

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
          "Could not delete promotion. Check the console and network tab."
      );
    }
  };

  const handleToggleActivation = async (item) => {
    if (!canTogglePromotionActivation(item)) return;

    const nextActive = !item.isActive;

    try {
      setTogglingActivationId(item.id);
      setPageError("");

      const response = await marketingSetPromotionActivation(item.id, nextActive);
      const updated =
        response?.promotion || response?.data || response?.item || response;

      if (updated && updated.id) {
        const normalized = normalizePromotion(updated);
        setPromotions((prev) =>
          prev.map((row) => (row.id === normalized.id ? normalized : row))
        );
      } else {
        await loadPromotions();
      }

      setSuccessMessage(
        nextActive
          ? "Promotion is active and will apply on POS invoices."
          : "Promotion is inactive and will not apply on POS invoices."
      );
    } catch (error) {
      console.error("Toggle promotion activation error:", error);
      alert(
        error?.message ||
          "Could not update promotion activation. Check console and network tab."
      );
    } finally {
      setTogglingActivationId(null);
    }
  };

  return (
    <div className={embeddedInPortal ? "mk-page" : "mkp-page"}>
      {embeddedInPortal ? (
        <div className="mk-page-actions">
          <label className="mk-search-field">
            <Search size={15} color="#94A3B8" strokeWidth={2} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search promotions..."
            />
          </label>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <SelectField
              value={statusFilter}
              onChange={setStatusFilter}
              options={filterStatusOptions}
              small
            />
            <button type="button" className="mk-btn-primary" onClick={openNewPage}>
              <Plus size={16} strokeWidth={2.5} />
              New Promotion
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mkp-header">
            <div>
              <h1>Promotions</h1>
              <p>
                Create and manage marketing promotions with banners, multi-branch,
                multi-zone & multi-product support
              </p>
            </div>

            <button type="button" onClick={openNewPage} className="mkp-new-btn">
              <Plus size={15} strokeWidth={2.5} />
              New Promotion
            </button>
          </div>

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
        </>
      )}

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
              <div
                key={item.id}
                className={`mkp-card ${isPromotionLiveOnPos(item) ? "mkp-card-live" : ""}`}
              >
                <div
                  className="mkp-card-top mkp-card-clickable"
                  onClick={() => openDetailsPage(item.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openDetailsPage(item.id);
                    }
                  }}
                >
                  <div className="mkp-card-icon">
                    <Tag size={15} />
                  </div>

                  <div className="mkp-card-body">
                    <div className="mkp-card-title">{item.name}</div>

                    <div className="mkp-card-sub">
                      {item.strategy} • {item.promotionType} • Value:{" "}
                      {formatPromotionDiscountDisplay(item)}
                    </div>
                  </div>

                  <div className="mkp-card-badges">
                    <span
                      className={`mkp-status status-${String(item.status)
                        .toLowerCase()
                        .replace(/\s+/g, "-")}`}
                    >
                      {formatStatusLabel(item.status)}
                    </span>

                    {String(item.status).toLowerCase() === "rejected" ? (
                      <span className="mkp-rejected-chip">✕ Rejected</span>
                    ) : null}
                  </div>
                </div>

                <div className="mkp-card-auto-report-row">
                  <button
                    type="button"
                    className="mkp-auto-report-btn"
                    onClick={() => openAutoReportPage(item.id)}
                  >
                    <FileBarChart size={14} />
                    Auto Report
                  </button>
                </div>

                <div className="mkp-progress" />

                <div className="mkp-card-date">
                  <Clock3 size={13} />
                  {formatEndDate(item.endDate)}
                </div>

                <div className="mkp-card-stats">
                  <div className="mkp-card-stat">
                    <span className="mkp-card-stat-label">Usage</span>
                    <strong>{formatPromotionUsageLabel(item)}</strong>
                  </div>
                  <div className="mkp-card-stat">
                    <span className="mkp-card-stat-label">Discount given</span>
                    <strong>{formatPromotionSar(item.totalDiscountProvided)}</strong>
                  </div>
                  <div className="mkp-card-stat">
                    <span className="mkp-card-stat-label">Revenue</span>
                    <strong>{formatPromotionSar(item.totalRevenue)}</strong>
                  </div>
                </div>

                <div className="mkp-card-activation">
                  <div className="mkp-card-activation-label">
                    <span className="mkp-card-activation-title">POS status</span>
                    <span className="mkp-card-activation-hint">
                      {activationToggleHint(item)}
                    </span>
                  </div>

                  <button
                    type="button"
                    className={`mkp-card-activation-toggle ${
                      item.isActive ? "on" : "off"
                    } ${!canTogglePromotionActivation(item) ? "disabled" : ""}`}
                    onClick={() => handleToggleActivation(item)}
                    disabled={
                      !canTogglePromotionActivation(item) ||
                      togglingActivationId === item.id
                    }
                    aria-pressed={item.isActive}
                    title={activationToggleHint(item)}
                  >
                    {togglingActivationId === item.id ? (
                      <Loader2 size={14} className="mkp-spin" />
                    ) : (
                      <span className="mkp-card-activation-track">
                        <span />
                      </span>
                    )}
                    <span>{item.isActive ? "Active" : "Inactive"}</span>
                  </button>
                </div>

                <div className="mkp-card-footer">
                  <button type="button" onClick={() => openDetailsPage(item.id)}>
                    <Eye size={14} />
                    View
                  </button>

                  <button type="button" onClick={() => openViewPage(item.id)}>
                    <FileBarChart size={14} />
                    Report
                  </button>

                  <button type="button" onClick={() => openEditPage(item.id)}>
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
    </div>
  );
};

export default MarketingPromotions;
