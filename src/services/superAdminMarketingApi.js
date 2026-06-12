import { apiFetch } from './api';

function qs(params = {}) {
  const p = new URLSearchParams();

  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '' && String(v) !== 'undefined') {
      p.set(k, String(v));
    }
  }

  const s = p.toString();
  return s ? `?${s}` : '';
}

const ROOT = '/super-admin-marketing-protal';

/* =========================
   Marketing Targeting APIs
========================= */

export const marketingListBranches = (params = {}) =>
  apiFetch(`${ROOT}/branches${qs(params)}`);

export const marketingListTargetZones = (params = {}) =>
  apiFetch(`${ROOT}/target-zones${qs(params)}`);

export const marketingListTargetProducts = (params = {}) =>
  apiFetch(`${ROOT}/target-products${qs(params)}`);

export const marketingListRewardItems = (params = {}) =>
  apiFetch(`${ROOT}/reward-items${qs(params)}`);

/* =========================
   Promo Codes APIs
========================= */

export const marketingCreatePromoCode = (body) =>
  apiFetch(`${ROOT}/promo-codes`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const marketingListPromoCodes = (params = {}) =>
  apiFetch(`${ROOT}/promo-codes${qs(params)}`);

export const marketingGetPromoCode = (id) =>
  apiFetch(`${ROOT}/promo-codes/${encodeURIComponent(String(id))}`);

export const marketingUpdatePromoCode = (id, body) =>
  apiFetch(`${ROOT}/promo-codes/${encodeURIComponent(String(id))}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

export const marketingDeletePromoCode = (id) =>
  apiFetch(`${ROOT}/promo-codes/${encodeURIComponent(String(id))}`, {
    method: 'DELETE',
  });

export const marketingGeneratePromoAutoCode = (params) =>
  apiFetch(`${ROOT}/promo-codes/auto-code/generate${qs(params)}`);

/* =========================
   Promotions APIs
========================= */

export const marketingGetPromotionOptions = () =>
  apiFetch(`${ROOT}/promotions/options`);

export const marketingCreatePromotion = (body) =>
  apiFetch(`${ROOT}/promotions`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
export const marketingSubmitPromotionApproval = (id, body = {}) =>
  apiFetch(`${ROOT}/promotions/${encodeURIComponent(String(id))}/submit-approval`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
export const marketingListPromotions = (params = {}) =>
  apiFetch(`${ROOT}/promotions${qs(params)}`);

export const marketingGetPromotion = (id) =>
  apiFetch(`${ROOT}/promotions/${encodeURIComponent(String(id))}`);

export const marketingUpdatePromotion = (id, body) =>
  apiFetch(`${ROOT}/promotions/${encodeURIComponent(String(id))}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

export const marketingDeletePromotion = (id) =>
  apiFetch(`${ROOT}/promotions/${encodeURIComponent(String(id))}`, {
    method: 'DELETE',
  });

/* =========================
   Campaigns APIs
========================= */

export const marketingCreateCampaign = (body) =>
  apiFetch(`${ROOT}/campaigns`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const marketingListCampaigns = (params = {}) =>
  apiFetch(`${ROOT}/campaigns${qs(params)}`);

export const marketingGetCampaign = (id) =>
  apiFetch(`${ROOT}/campaigns/${encodeURIComponent(String(id))}`);

export const marketingUpdateCampaign = (id, body) =>
  apiFetch(`${ROOT}/campaigns/${encodeURIComponent(String(id))}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

export const marketingDeleteCampaign = (id) =>
  apiFetch(`${ROOT}/campaigns/${encodeURIComponent(String(id))}`, {
    method: 'DELETE',
  });

export const marketingApproveCampaign = (id) =>
  apiFetch(`${ROOT}/campaigns/${encodeURIComponent(String(id))}/approve`, {
    method: 'PATCH',
  });

export const marketingRejectCampaign = (id, body) =>
  apiFetch(`${ROOT}/campaigns/${encodeURIComponent(String(id))}/reject`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

export const marketingChangeCampaignStatus = (id, body) =>
  apiFetch(`${ROOT}/campaigns/${encodeURIComponent(String(id))}/status`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

export const marketingUpdateCampaignMetrics = (id, body) =>
  apiFetch(`${ROOT}/campaigns/${encodeURIComponent(String(id))}/metrics`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

/* =========================
   Referrers APIs
========================= */

export const marketingCreateReferrer = (body) =>
  apiFetch(`${ROOT}/referrers`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const marketingListReferrers = (params = {}) =>
  apiFetch(`${ROOT}/referrers${qs(params)}`);

export const marketingGetReferrer = (id) =>
  apiFetch(`${ROOT}/referrers/${encodeURIComponent(String(id))}`);

export const marketingUpdateReferrer = (id, body) =>
  apiFetch(`${ROOT}/referrers/${encodeURIComponent(String(id))}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

export const marketingDeleteReferrer = (id) =>
  apiFetch(`${ROOT}/referrers/${encodeURIComponent(String(id))}`, {
    method: 'DELETE',
  });

/* =========================
   Loyalty APIs
========================= */

export const marketingCreateLoyaltyProgram = (body) =>
  apiFetch(`${ROOT}/loyalty-programs`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const marketingListLoyaltyPrograms = (params = {}) =>
  apiFetch(`${ROOT}/loyalty-programs${qs(params)}`);

export const marketingGetLoyaltyProgram = (id) =>
  apiFetch(`${ROOT}/loyalty-programs/${encodeURIComponent(String(id))}`);

export const marketingUpdateLoyaltyProgram = (id, body) =>
  apiFetch(`${ROOT}/loyalty-programs/${encodeURIComponent(String(id))}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

export const marketingDeleteLoyaltyProgram = (id) =>
  apiFetch(`${ROOT}/loyalty-programs/${encodeURIComponent(String(id))}`, {
    method: 'DELETE',
  });

/* =========================
   Dashboard / Insights APIs
========================= */

export const marketingGetCustomerInsights = (params = {}) =>
  apiFetch(`${ROOT}/customer-insights${qs(params)}`);

export const marketingGetDashboard = (params = {}) =>
  apiFetch(`${ROOT}/dashboard${qs(params)}`);

/* =========================
   Referral Management APIs
========================= */

export const marketingGetReferralManagementDashboard = (params = {}) =>
  apiFetch(`${ROOT}/referral_management_dashboard${qs(params)}`);

export const marketingGetReferralCommissionsDashboard = (params) =>
  apiFetch(`${ROOT}/referral-commissions/dashboard${qs(params)}`);

export const marketingLookupReferralCommissionsDashboard = (body) =>
  apiFetch(`${ROOT}/referral-commissions/dashboard/lookup`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const marketingListReferralLedgerAccounts = (params) =>
  apiFetch(`${ROOT}/referral-marketing/ledger-accounts${qs(params)}`);

export const marketingLookupReferralLedgerAccounts = (body) =>
  apiFetch(`${ROOT}/referral-marketing/ledger-accounts/lookup`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const marketingGetReferralMarketingSettings = (params) =>
  apiFetch(`${ROOT}/referral-marketing/settings${qs(params)}`);

export const marketingLookupReferralMarketingSettings = (body) =>
  apiFetch(`${ROOT}/referral-marketing/settings/lookup`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const marketingUpsertReferralMarketingSettings = (body) =>
  apiFetch(`${ROOT}/referral-marketing/settings`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });

/* =========================
   Campaign Requests APIs
========================= */

export const marketingListCampaignRequests = (params = {}) =>
  apiFetch(`${ROOT}/campaign-requests${qs(params)}`);

export const marketingGetCampaignRequest = (id) =>
  apiFetch(`${ROOT}/campaign-requests/${encodeURIComponent(String(id))}`);

export const marketingApproveCampaignRequest = (id, body = {}) =>
  apiFetch(`${ROOT}/campaign-requests/${encodeURIComponent(String(id))}/approve`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

export const marketingRejectCampaignRequest = (id, body = {}) =>
  apiFetch(`${ROOT}/campaign-requests/${encodeURIComponent(String(id))}/reject`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

/* =========================
   Marketing Wallet APIs
========================= */

export const marketingGetWallet = () =>
  apiFetch(`${ROOT}/wallet`);

export const marketingListWalletCashAccounts = () =>
  apiFetch(`${ROOT}/wallet/cash-accounts`);

export const marketingListBudgetRequests = (params = {}) =>
  apiFetch(`${ROOT}/wallet/budget-requests${qs(params)}`);

export const marketingCreateBudgetRequest = (body) =>
  apiFetch(`${ROOT}/wallet/budget-requests`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const marketingApproveBudgetRequest = (id, body = {}) =>
  apiFetch(`${ROOT}/wallet/budget-requests/${encodeURIComponent(String(id))}/approve`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

export const marketingRejectBudgetRequest = (id, body) =>
  apiFetch(`${ROOT}/wallet/budget-requests/${encodeURIComponent(String(id))}/reject`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

export const marketingListWalletTransactions = (params = {}) =>
  apiFetch(`${ROOT}/wallet/transactions${qs(params)}`);

/* =========================
   Marketing Expenses APIs
========================= */

export const marketingListExpenses = (params = {}) =>
  apiFetch(`${ROOT}/expenses${qs(params)}`);

export const marketingCreateExpense = (body) =>
  apiFetch(`${ROOT}/expenses`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const marketingGetExpense = (id) =>
  apiFetch(`${ROOT}/expenses/${encodeURIComponent(String(id))}`);

export const marketingUpdateExpense = (id, body) =>
  apiFetch(`${ROOT}/expenses/${encodeURIComponent(String(id))}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

export const marketingApproveExpense = (id, body = {}) =>
  apiFetch(`${ROOT}/expenses/${encodeURIComponent(String(id))}/approve`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

export const marketingRejectExpense = (id, body) =>
  apiFetch(`${ROOT}/expenses/${encodeURIComponent(String(id))}/reject`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

export const marketingPayExpense = (id, body = {}) =>
  apiFetch(`${ROOT}/expenses/${encodeURIComponent(String(id))}/pay`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

export const marketingDeleteExpense = (id) =>
  apiFetch(`${ROOT}/expenses/${encodeURIComponent(String(id))}`, {
    method: 'DELETE',
  });

/* =========================
   Marketing Analytics APIs
========================= */

export const marketingGetAnalyticsRoi = (params = {}) =>
  apiFetch(`${ROOT}/analytics/roi${qs(params)}`);

/* =========================
   Marketing Reports APIs
========================= */

export const marketingGetCampaignReport = (params = {}) =>
  apiFetch(`${ROOT}/reports/campaigns${qs(params)}`);

/* =========================
   Marketing Ad Platforms APIs
========================= */

export const marketingListAdPlatforms = (params = {}) =>
  apiFetch(`${ROOT}/ad-platforms${qs(params)}`);

export const marketingCreateAdPlatform = (body) =>
  apiFetch(`${ROOT}/ad-platforms`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const marketingGetAdPlatform = (id) =>
  apiFetch(`${ROOT}/ad-platforms/${encodeURIComponent(String(id))}`);

export const marketingUpdateAdPlatform = (id, body) =>
  apiFetch(`${ROOT}/ad-platforms/${encodeURIComponent(String(id))}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

export const marketingChangeAdPlatformStatus = (id, body) =>
  apiFetch(`${ROOT}/ad-platforms/${encodeURIComponent(String(id))}/status`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

export const marketingSyncAdPlatform = (id, body = {}) =>
  apiFetch(`${ROOT}/ad-platforms/${encodeURIComponent(String(id))}/sync`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

export const marketingDeleteAdPlatform = (id) =>
  apiFetch(`${ROOT}/ad-platforms/${encodeURIComponent(String(id))}`, {
    method: 'DELETE',
  });

/* =========================
   Marketing Budget Optimizer APIs
========================= */

export const marketingGetBudgetOptimizer = (params = {}) =>
  apiFetch(`${ROOT}/budget-optimizer${qs(params)}`);

export const marketingOptimizeBudget = (body) =>
  apiFetch(`${ROOT}/budget-optimizer/optimize`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

/* =========================
   Backward-compatible aliases
========================= */

export const marketingGetMarketingWallet = marketingGetWallet;
export const marketingListMarketingWalletCashAccounts = marketingListWalletCashAccounts;
export const marketingListMarketingBudgetRequests = marketingListBudgetRequests;
export const marketingCreateMarketingBudgetRequest = marketingCreateBudgetRequest;
export const marketingListMarketingWalletTransactions = marketingListWalletTransactions;

export const marketingListMarketingAdPlatforms = marketingListAdPlatforms;
export const marketingCreateMarketingAdPlatform = marketingCreateAdPlatform;
export const marketingGetMarketingAdPlatform = marketingGetAdPlatform;
export const marketingUpdateMarketingAdPlatform = marketingUpdateAdPlatform;
export const marketingChangeMarketingAdPlatformStatus = marketingChangeAdPlatformStatus;
export const marketingSyncMarketingAdPlatform = marketingSyncAdPlatform;
export const marketingDeleteMarketingAdPlatform = marketingDeleteAdPlatform;
