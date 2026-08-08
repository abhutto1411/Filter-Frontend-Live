function roundMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function safeNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function safeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function humanize(value) {
  const v = String(value || "").trim();
  if (!v) return "—";
  return v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildConfigurationFromPromotion(promotion) {
  if (!promotion) return null;

  return {
    sections: [
      {
        title: "Basic Details",
        fields: [
          { label: "Promotion Name", value: promotion.name || "—" },
          { label: "Marketing Strategy", value: promotion.strategy || "—" },
          { label: "Promotion Type", value: humanize(promotion.promotionType) },
          { label: "Status", value: humanize(promotion.status) },
          { label: "Description", value: promotion.description || "—" },
        ],
      },
      {
        title: "Discount & Rules",
        fields: [
          { label: "Discount Type", value: humanize(promotion.discountType) },
          {
            label: "Discount Value",
            value: `${roundMoney(promotion.discountValue)} SAR`,
          },
          {
            label: "Max Usage",
            value:
              promotion.maxUsageCount != null
                ? String(promotion.maxUsageCount)
                : "Unlimited",
          },
        ],
      },
      {
        title: "Schedule",
        fields: [
          { label: "Start", value: promotion.startDate || "—" },
          { label: "End", value: promotion.endDate || "—" },
        ],
      },
    ],
    targeting: {
      triggerItems: (promotion.triggerProductIds || []).map((id) => ({
        id,
        name: `Item ${id}`,
        type: "item",
      })),
      rewardItems: (promotion.rewardProductIds || []).map((id) => ({
        id,
        name: `Item ${id}`,
        type: "item",
      })),
      targetBranches: (promotion.targetBranchIds || []).map((id) => ({
        id,
        name: `Branch ${id}`,
      })),
      targetZones: promotion.targetZoneIds || promotion.targetZones || [],
    },
    performanceChecks: [],
  };
}

export function buildClientAutoReportAnalytics({
  promotion,
  summary,
  configuration,
  orders = [],
  branches = [],
  items = [],
  customers = [],
}) {
  const row = {
    name: promotion?.name,
    promoType: promotion?.promotionType,
    marketingStrategy: promotion?.strategy,
    usageCount: promotion?.usageCount ?? summary?.usageCount,
    maxUsageCount: promotion?.maxUsageCount ?? summary?.maxUsageCount,
    startAt: promotion?.startDate,
    endAt: promotion?.endDate,
    validFrom: promotion?.startDate,
    validTo: promotion?.endDate,
    minPurchaseAmount: promotion?.minPurchaseAmount ?? promotion?.minOrderAmount,
    customerSegment: promotion?.customerSegment ?? promotion?.applicableTo,
    showOnPosInvoice: promotion?.showOnPosInvoice,
    isActive: promotion?.isActive,
    targetBranchIds: promotion?.targetBranchIds,
  };

  const usageCount = safeNum(summary?.usageCount ?? row.usageCount);
  const maxUsage =
    summary?.maxUsageCount != null
      ? safeNum(summary.maxUsageCount)
      : row.maxUsageCount != null
        ? safeNum(row.maxUsageCount)
        : null;

  const redemptionCount = safeNum(summary?.redemptionCount, orders.length);
  const uniqueCustomers = safeNum(summary?.uniqueCustomers, customers.length);
  const totalDiscount = safeNum(summary?.totalDiscountProvided);
  const totalRevenue = safeNum(summary?.totalRevenue);
  const grossRevenue = safeNum(summary?.grossRevenue, totalRevenue + totalDiscount);
  const triggerSales = safeNum(summary?.triggerSalesTotal);
  const rewardValue = safeNum(summary?.rewardValueTotal);
  const payableTotal = safeNum(summary?.payableTotal, totalDiscount);
  const netDifference = safeNum(summary?.netDifference);

  const startDate = safeDate(row.startAt ?? row.validFrom);
  const endDate = safeDate(row.endAt ?? row.validTo);
  const now = new Date();

  let daysTotal = 0;
  let daysElapsed = 0;
  let daysRemaining = 0;
  let timeProgressPercent = 0;
  let periodStatus = "unknown";

  if (startDate && endDate) {
    daysTotal = Math.max(
      1,
      Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000)
    );
    daysElapsed = Math.max(
      0,
      Math.min(
        daysTotal,
        Math.ceil((now.getTime() - startDate.getTime()) / 86400000)
      )
    );
    daysRemaining = Math.max(0, daysTotal - daysElapsed);

    if (now < startDate) {
      periodStatus = "scheduled";
      timeProgressPercent = 0;
    } else if (now > endDate) {
      periodStatus = "expired";
      timeProgressPercent = 100;
      daysElapsed = daysTotal;
      daysRemaining = 0;
    } else {
      periodStatus = "active";
      timeProgressPercent = roundMoney((daysElapsed / daysTotal) * 100);
    }
  }

  const usageProgressPercent =
    maxUsage != null && maxUsage > 0
      ? roundMoney(Math.min(100, (usageCount / maxUsage) * 100))
      : redemptionCount > 0
        ? 100
        : 0;

  const expectedUsageByTime =
    maxUsage != null && maxUsage > 0 && daysTotal > 0
      ? roundMoney((maxUsage * daysElapsed) / daysTotal)
      : null;

  const paceRatio =
    expectedUsageByTime != null && expectedUsageByTime > 0
      ? roundMoney(usageCount / expectedUsageByTime)
      : null;

  const projectedUsageAtEnd =
    maxUsage != null &&
    maxUsage > 0 &&
    daysElapsed > 0 &&
    periodStatus === "active"
      ? Math.min(maxUsage, Math.round((usageCount / daysElapsed) * daysTotal))
      : usageCount;

  const avgOrderValue =
    redemptionCount > 0 ? roundMoney(totalRevenue / redemptionCount) : 0;
  const avgDiscountPerRedemption =
    redemptionCount > 0 ? roundMoney(totalDiscount / redemptionCount) : 0;
  const discountRate =
    grossRevenue > 0 ? roundMoney((totalDiscount / grossRevenue) * 100) : 0;
  const roi =
    totalDiscount > 0
      ? roundMoney((totalRevenue - totalDiscount) / totalDiscount)
      : null;
  const revenueMultiplier =
    totalDiscount > 0 ? roundMoney(totalRevenue / totalDiscount) : null;
  const costPerCustomer =
    uniqueCustomers > 0 ? roundMoney(totalDiscount / uniqueCustomers) : 0;

  const branchesConfigured =
    configuration?.targeting?.targetBranches?.length ??
    (Array.isArray(row.targetBranchIds) ? row.targetBranchIds.length : 0);
  const branchesWithActivity = branches.filter(
    (b) => safeNum(b.redemptionCount) > 0 || safeNum(b.orderCount) > 0
  ).length;
  const triggerConfigured =
    configuration?.targeting?.triggerItems?.length ?? 0;
  const rewardConfigured = configuration?.targeting?.rewardItems?.length ?? 0;
  const itemsWithActivity = items.filter(
    (i) => safeNum(i.lineCount) > 0 || safeNum(i.saleValue) > 0
  ).length;

  let healthScore = 55;
  const insights = [];
  const recommendations = [];
  const risks = [];

  if (periodStatus === "active") healthScore += 5;
  if (redemptionCount > 0) healthScore += 10;
  if (roi != null && roi >= 2) healthScore += 15;
  else if (roi != null && roi >= 1) healthScore += 8;
  else if (roi != null && roi < 0.5) healthScore -= 10;

  if (paceRatio != null) {
    if (paceRatio >= 0.8 && paceRatio <= 1.2) healthScore += 12;
    else if (paceRatio < 0.5) healthScore -= 12;
    else if (paceRatio > 1.2) healthScore += 5;
  }

  if (
    maxUsage != null &&
    maxUsage > 0 &&
    usageCount >= maxUsage * 0.8 &&
    periodStatus === "active"
  ) {
    healthScore -= 5;
  }

  if (periodStatus === "active" && redemptionCount === 0 && daysElapsed >= 3) {
    healthScore -= 20;
  }

  if (periodStatus === "expired" && redemptionCount === 0) {
    healthScore -= 15;
  }

  healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));

  let healthLabel = "Needs Review";
  if (healthScore >= 80) healthLabel = "Strong Performance";
  else if (healthScore >= 65) healthLabel = "On Track";
  else if (healthScore >= 45) healthLabel = "Underperforming";
  else healthLabel = "At Risk";

  const promoName = row.name || "This promotion";
  const promoType = humanize(row.promoType);
  const strategy = row.marketingStrategy || "Standard Promotion";

  let executiveSummary = `${promoName} is a ${promoType} campaign under the "${strategy}" strategy. `;

  if (periodStatus === "scheduled") {
    executiveSummary += `Scheduled to start ${startDate?.toLocaleDateString()}. Prepare POS and branch rollout before launch.`;
  } else if (periodStatus === "expired") {
    executiveSummary += `Campaign ended with ${redemptionCount} redemption(s), ${roundMoney(totalRevenue)} SAR revenue, and ${roundMoney(totalDiscount)} SAR promotional cost.`;
  } else if (periodStatus === "active") {
    executiveSummary += `Active with ${daysRemaining} day(s) left — ${redemptionCount} redemption(s), ${roundMoney(totalRevenue)} SAR revenue, ${roundMoney(totalDiscount)} SAR discount.`;
  } else {
    executiveSummary += `${redemptionCount} redemption(s), ${roundMoney(totalRevenue)} SAR revenue, ${roundMoney(totalDiscount)} SAR spend.`;
  }

  if (roi != null && redemptionCount > 0) {
    executiveSummary += ` ROI: ${roi.toFixed(2)}x net return on discount.`;
  }

  if (paceRatio != null && periodStatus === "active") {
    if (paceRatio < 0.5) {
      executiveSummary += " Adoption is behind time-adjusted targets — action needed.";
    } else if (paceRatio > 1.2) {
      executiveSummary += " Adoption is ahead of schedule.";
    } else {
      executiveSummary += " Usage pace aligns with timeline.";
    }
  }

  if (redemptionCount === 0 && periodStatus === "active") {
    insights.push({
      type: "negative",
      title: "Zero redemptions",
      detail:
        "No matching invoices yet. Check POS activation, branches, trigger/reward items, and min purchase.",
    });
    recommendations.push({
      priority: "high",
      action: "Audit POS activation and branch coverage",
      rationale: "Zero redemptions during active period suggests visibility or matching issues.",
    });
  }

  if (roi != null && roi < 0.5 && redemptionCount > 0) {
    insights.push({
      type: "warning",
      title: "Low ROI on promotional spend",
      detail: `Cost ${roundMoney(totalDiscount)} SAR vs revenue ${roundMoney(totalRevenue)} SAR (${roi.toFixed(2)}x).`,
    });
    recommendations.push({
      priority: "high",
      action: "Tighten offer mechanics",
      rationale: "Raise minimum purchase or narrow reward scope to improve ratio.",
    });
  }

  if (roi != null && roi >= 2 && redemptionCount > 0) {
    insights.push({
      type: "positive",
      title: "Strong promotional ROI",
      detail: `${roi.toFixed(2)}x return with ${discountRate.toFixed(1)}% effective discount rate.`,
    });
  }

  if (
    maxUsage != null &&
    maxUsage > 0 &&
    projectedUsageAtEnd >= maxUsage &&
    periodStatus === "active"
  ) {
    risks.push({
      severity: "medium",
      title: "Cap may exhaust early",
      detail: `Projected ${projectedUsageAtEnd} vs cap ${maxUsage}.`,
    });
  }

  if (daysRemaining <= 7 && periodStatus === "active" && usageProgressPercent < 50) {
    risks.push({
      severity: "high",
      title: "Low utilization near end",
      detail: `${usageProgressPercent}% cap used, ${daysRemaining} day(s) left.`,
    });
    recommendations.push({
      priority: "high",
      action: "End-of-campaign push",
      rationale: "Accelerate adoption before expiry.",
    });
  }

  if (!row.showOnPosInvoice) {
    recommendations.push({
      priority: "medium",
      action: "Enable POS invoice visibility",
      rationale: "Offer may not be visible to staff or customers on invoices.",
    });
  }

  const configVsActual = [
    {
      dimension: "Usage cap",
      configured:
        maxUsage != null && maxUsage > 0 ? `${maxUsage} redemptions` : "Unlimited",
      actual: `${usageCount} used`,
      variance:
        maxUsage != null && maxUsage > 0 ? `${usageProgressPercent}% utilized` : "—",
      status:
        maxUsage != null && maxUsage > 0 && usageCount >= maxUsage
          ? "exceeded"
          : usageProgressPercent >= 80
            ? "warning"
            : "ok",
    },
    {
      dimension: "Campaign period",
      configured:
        startDate && endDate
          ? `${startDate.toLocaleDateString()} – ${endDate.toLocaleDateString()}`
          : "—",
      actual: humanize(periodStatus),
      variance: daysTotal > 0 ? `${daysElapsed}/${daysTotal} days` : "—",
      status: periodStatus,
    },
    {
      dimension: "Min. purchase",
      configured: `${roundMoney(safeNum(row.minPurchaseAmount))} SAR`,
      actual:
        redemptionCount > 0
          ? `Avg ${roundMoney(avgOrderValue)} SAR`
          : "No orders",
      variance:
        redemptionCount > 0 && avgOrderValue >= safeNum(row.minPurchaseAmount)
          ? "Above minimum"
          : redemptionCount > 0
            ? "Below minimum"
            : "—",
      status:
        redemptionCount > 0 && avgOrderValue < safeNum(row.minPurchaseAmount)
          ? "warning"
          : "ok",
    },
    {
      dimension: "POS visibility",
      configured: row.showOnPosInvoice ? "Enabled" : "Disabled",
      actual: row.isActive ? "Toggle active" : "Toggle inactive",
      variance: row.showOnPosInvoice && row.isActive ? "Aligned" : "Check setup",
      status: row.showOnPosInvoice && row.isActive ? "ok" : "warning",
    },
    {
      dimension: "Trigger items",
      configured: triggerConfigured > 0 ? `${triggerConfigured} item(s)` : "Not set",
      actual: `${triggerSales} SAR sales`,
      variance: triggerSales > 0 ? "Matched" : "No activity",
      status: triggerConfigured > 0 && triggerSales === 0 ? "warning" : "ok",
    },
    {
      dimension: "Reward items",
      configured: rewardConfigured > 0 ? `${rewardConfigured} item(s)` : "Not set",
      actual: `${rewardValue} SAR value`,
      variance: `${payableTotal} SAR payable`,
      status: rewardConfigured > 0 && rewardValue === 0 ? "warning" : "ok",
    },
  ];

  const kpis = [
    {
      key: "revenue",
      label: "Net Revenue",
      value: totalRevenue,
      formatted: `${roundMoney(totalRevenue)} SAR`,
      context: "Post-promotion invoice total",
      benchmark:
        redemptionCount > 0 ? `AOV ${roundMoney(avgOrderValue)} SAR` : "No data",
    },
    {
      key: "discount",
      label: "Promotional Cost",
      value: totalDiscount,
      formatted: `${roundMoney(totalDiscount)} SAR`,
      context: "Total customer discount",
      benchmark: discountRate > 0 ? `${discountRate.toFixed(1)}% of gross` : "—",
    },
    {
      key: "roi",
      label: "Net ROI",
      value: roi ?? 0,
      formatted: roi != null ? `${roi.toFixed(2)}x` : "—",
      context: "(Revenue − Discount) ÷ Discount",
      benchmark:
        revenueMultiplier != null
          ? `${revenueMultiplier.toFixed(2)} SAR per 1 SAR`
          : "—",
    },
    {
      key: "redemptions",
      label: "Redemptions",
      value: redemptionCount,
      formatted: String(redemptionCount),
      context: `${uniqueCustomers} unique customers`,
      benchmark:
        maxUsage != null && maxUsage > 0
          ? `${usageProgressPercent}% of cap`
          : "No cap",
    },
    {
      key: "trigger",
      label: "Trigger Sales (A)",
      value: triggerSales,
      formatted: `${roundMoney(triggerSales)} SAR`,
      context: "Qualifying lines",
      benchmark: `Reward (B): ${roundMoney(rewardValue)} SAR`,
    },
    {
      key: "payable",
      label: "HQ Payable",
      value: payableTotal,
      formatted: `${roundMoney(payableTotal)} SAR`,
      context: "COA 2215 settlement",
      benchmark: `Net diff: ${roundMoney(netDifference)} SAR`,
    },
  ];

  return {
    executiveSummary,
    healthScore,
    healthLabel,
    periodStatus,
    timeline: {
      startDate: startDate?.toISOString() ?? null,
      endDate: endDate?.toISOString() ?? null,
      daysTotal,
      daysElapsed,
      daysRemaining,
      timeProgressPercent,
      usageProgressPercent,
      expectedUsageByTime,
      paceRatio,
      projectedUsageAtEnd,
      onPace: paceRatio != null ? paceRatio >= 0.8 && paceRatio <= 1.2 : null,
    },
    financial: {
      totalRevenue: roundMoney(totalRevenue),
      grossRevenue: roundMoney(grossRevenue),
      totalDiscount: roundMoney(totalDiscount),
      triggerSalesTotal: roundMoney(triggerSales),
      rewardValueTotal: roundMoney(rewardValue),
      payableTotal: roundMoney(payableTotal),
      netDifference: roundMoney(netDifference),
      avgOrderValue,
      avgDiscountPerRedemption,
      discountRate,
      roi,
      revenueMultiplier,
      costPerCustomer,
    },
    targetingCoverage: {
      branchesConfigured,
      branchesWithActivity,
      triggerItemsConfigured: triggerConfigured,
      rewardItemsConfigured: rewardConfigured,
      itemsWithActivity,
    },
    configVsActual,
    kpis,
    insights,
    recommendations,
    risks,
  };
}

export { buildConfigurationFromPromotion };
