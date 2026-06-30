import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Check, X, Tag, User, Calendar, DollarSign, Package, ShoppingCart,
    RefreshCcw, ArrowRightLeft, FileText, Eye, Users, Settings, CreditCard,
    Loader, AlertCircle, Building2,
} from 'lucide-react';
import '../../styles/admin/ApprovalsPage.css';
import WalletApprovalAccountFields from '../../components/admin/WalletApprovalAccountFields';
import {
    list as listApprovals,
    approve as approveApi,
    reject as rejectApi,
    details as fetchApprovalDetails,
    getWalkInSettings,
    updateWalkInSettings,
} from '../../services/approvalsApi';
import {
    approveSuperAdminCorporatePriceQuotation,
    rejectSuperAdminCorporatePriceQuotation,
    getBranches,
    listCorporatePaymentApprovals,
    getCorporatePaymentApproval,
    approveCorporatePaymentApproval,
    rejectCorporatePaymentApproval,
    getSuperAdminInvoiceView,
    getSuperAdminSalesReturns,
    getSuperAdminSalesReturn,
    approveSuperAdminSalesReturn,
    rejectSuperAdminSalesReturn,
} from '../../services/superAdminApi';
import {
    marketingApproveBudgetRequest,
    marketingApprovePromotion,
    marketingApprovePromoCode,
    marketingApproveExpense,
    marketingGetPromotion,
    marketingListBudgetRequests,
    marketingListPromoCodes,
    marketingListPromotions,
    marketingRejectBudgetRequest,
    marketingRejectPromotion,
    marketingRejectPromoCode,
    marketingRejectExpense,
    marketingPayExpense,
    marketingListWalletCashAccounts,
} from '../../services/superAdminMarketingApi';
import Modal from '../../components/Modal';
import ApprovalDetailsModal from './ApprovalDetailsModal';
import InvoiceDetailsModal from '../../components/pos/modern/InvoiceDetailsModal';
import { useAuth } from '../../context/AuthContext';
import ExpenseProofThumbnail from '../../components/accounting/ExpenseProofThumbnail';

/**
 * Map backend entity-type string (snake_case) → permission code suffix (kebab-case).
 * Used to build per-type permission keys: `approvals.<suffix>.{view,approve,reject}`
 */
const APPROVAL_TYPE_TO_PERMISSION_SUFFIX = {
    workshop_registration: 'workshop-registration',
    branch_creation: 'branch-creation',
    cashier_registration: 'cashier-registration',
    workshop_portal_staff_registration: 'workshop-portal-staff',
    technician_registration: 'technician-registration',
    supplier_registration: 'supplier-registration',
    corporate_registration: 'corporate-registration',
    corporate_price_quotation: 'corporate-price-quotation',
    corporate_walk_in_booking: 'corporate-walk-in-booking',
    corporate_payment_approval: 'corporate-payment-proof',
    sales_return: 'sales-return',
    marketing_budget_request: 'marketing-budget-request',
    admin_wallet_fund_request: 'admin-wallet-fund-request',
    admin_wallet_expense_request: 'admin-wallet-expense-request',
    marketing_promotion: 'marketing-promotion',
    marketing_campaign: 'marketing-campaign',
    marketing_expense: 'marketing-expense',
};

function approvalPermission(entityType, action) {
    const suffix = APPROVAL_TYPE_TO_PERMISSION_SUFFIX[entityType];
    if (!suffix) return null; // unknown type → no gate (open)
    return `approvals.${suffix}.${action}`;
}

function hasAnyGranularApprovalTypePermission(hasPermission, action = 'view') {
    return Object.values(APPROVAL_TYPE_TO_PERMISSION_SUFFIX).some((suffix) =>
        hasPermission(`approvals.${suffix}.${action}`),
    );
}

function approvalTypeAllowed(hasPermission, entityType, action) {
    const code = approvalPermission(entityType, action);
    if (!code) return true;
    const parentCode = action === 'view' ? 'approvals.view' : `approvals.${action}`;
    if (hasPermission(parentCode) && !hasAnyGranularApprovalTypePermission(hasPermission, action)) {
        return true;
    }
    return hasPermission(code);
}

function unwrapMarketingBudgetRequests(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.budgetRequests)) return payload.budgetRequests;
    if (Array.isArray(payload?.requests)) return payload.requests;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.data?.budgetRequests)) return payload.data.budgetRequests;
    if (Array.isArray(payload?.data?.requests)) return payload.data.requests;
    return [];
}

function unwrapMarketingPromoCodes(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.promoCodes)) return payload.promoCodes;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.data?.promoCodes)) return payload.data.promoCodes;
    if (Array.isArray(payload?.data?.items)) return payload.data.items;
    return [];
}

function promoCodeMatchesApprovalTab(promoCode, tabStatus) {
    const workflowStatus = normalizePromotionWorkflowStatus(promoCode?.status);

    if (tabStatus === 'pending') {
        return workflowStatus === 'pending_approval';
    }

    if (tabStatus === 'rejected') {
        return workflowStatus === 'rejected';
    }

    if (tabStatus === 'approved') {
        return ['active', 'inactive'].includes(workflowStatus);
    }

    return ['pending_approval', 'active', 'inactive', 'rejected'].includes(workflowStatus);
}

function mapMarketingPromoCodeRow(r) {
    const discountValue = Number(r.discountValue ?? r.discount_value ?? 0);
    const discountType = String(r.discountType ?? r.discount_type ?? '').toLowerCase();
    const discountLabel =
        discountType.includes('fixed') || discountType.includes('amount')
            ? `SAR ${discountValue}`
            : `${discountValue}%`;

    const promoStatus = normalizePromotionWorkflowStatus(r.status);
    const approvalStatus =
        promoStatus === 'pending_approval'
            ? 'pending'
            : promoStatus === 'rejected'
              ? 'rejected'
              : 'approved';

    return {
        id: String(r.id),
        entityType: 'marketing_promo_code',
        type: 'marketing_promo_code',
        typeLabel: 'Marketing promo code',
        status: approvalStatus,
        title: `Marketing promo code · ${r.code ?? r.id}`,
        meta: {
            code: r.code,
            promotionName: r.promotionName ?? r.promotion_name ?? r.promotion,
            discountType: r.discountType ?? r.discount_type,
            discountValue,
            discountLabel,
            validFrom: r.validFrom ?? r.valid_from,
            validTo: r.validTo ?? r.valid_to ?? r.valid_until,
            usageLimit: r.usageLimit ?? r.maxUsageCount ?? r.max_usage_count,
            usageCount: r.usageCount ?? r.currentUsageCount ?? r.current_usage_count,
            promoCodeStatus: promoStatus,
        },
        submittedBy: r.createdByName ?? r.createdBy ?? null,
        reviewer: null,
        date: r.createdAt ?? r.created_at ?? '',
        reference: r.code ?? '',
        raw: r,
    };
}

function unwrapMarketingPromotions(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.promotions)) return payload.promotions;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.data?.promotions)) return payload.data.promotions;
    if (Array.isArray(payload?.data?.items)) return payload.data.items;
    return [];
}

function normalizePromotionWorkflowStatus(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_');
}

function promotionMatchesApprovalTab(promotion, tabStatus) {
    const workflowStatus = normalizePromotionWorkflowStatus(promotion?.status);

    if (tabStatus === 'pending') {
        return workflowStatus === 'pending_approval';
    }

    if (tabStatus === 'rejected') {
        return workflowStatus === 'rejected';
    }

    if (tabStatus === 'approved') {
        return ['approved', 'active', 'inactive', 'scheduled'].includes(workflowStatus);
    }

    // All tab — only promotions that entered the approval workflow (not private drafts).
    return workflowStatus !== 'draft';
}

function mapMarketingPromotionRow(r) {
    const discountValue = Number(r.discountValue ?? r.value ?? 0);
    const discountType = String(r.discountType ?? '').toLowerCase();
    const discountLabel =
        discountType === 'percentage'
            ? `${discountValue}%`
            : `SAR ${discountValue.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
            })}`;

    const promoStatus = normalizePromotionWorkflowStatus(r.status);
    const approvalStatus =
        promoStatus === 'pending_approval'
            ? 'pending'
            : promoStatus === 'rejected'
              ? 'rejected'
              : 'approved';

    return {
        id: String(r.id),
        entityType: 'marketing_promotion',
        type: 'marketing_promotion',
        typeLabel: 'Marketing promotion',
        status: approvalStatus,
        title: `Marketing promotion · ${r.name ?? r.promotionName ?? r.id}`,
        meta: {
            promotionName: r.name ?? r.promotionName,
            promoType: r.promoType ?? r.promotionType,
            marketingStrategy: r.marketingStrategy,
            discountType: r.discountType,
            discountValue,
            discountLabel,
            code: r.code,
            startAt: r.startAt ?? r.startDate,
            endAt: r.endAt ?? r.endDate,
            promotionStatus: promoStatus,
        },
        submittedBy:
            r.createdByName ??
            r.createdBy ??
            r.submittedBy ??
            r.submitted_by ??
            null,
        reviewer: r.approvedByName ?? r.rejectedByName ?? null,
        date: r.createdAt ?? r.created_at ?? '',
        reference: r.code ?? '',
        raw: r,
    };
}

function approvalItemKey(item) {
    if (!item) return '';
    return `${item.entityType ?? 'unknown'}:${item.id}`;
}

function mapMarketingBudgetRequestRow(r) {
    const amount = Number(r.amount ?? 0);
    const currency = r.currencyCode ?? r.currency_code ?? 'SAR';
    return {
        id: String(r.id),
        entityType: 'marketing_budget_request',
        type: 'marketing_budget_request',
        typeLabel: 'Marketing wallet top-up',
        status: r.status ?? 'pending',
        title: `Marketing wallet top-up · ${r.requestNumber ?? r.request_number ?? r.id}`,
        meta: {
            requestNumber: r.requestNumber ?? r.request_number,
            amount,
            currencyCode: currency,
            purpose: r.purpose,
            sourceAccountId: r.sourceAccountId ?? r.source_account_id,
            sourceAccountName: r.sourceAccountName ?? r.source_account_name,
            rejectionReason: r.rejectionReason ?? r.rejection_reason,
            amountLabel: `${amount.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            })} ${currency}`,
        },
        submittedBy: r.requestedByName ?? r.requested_by_name ?? r.requestedBy ?? r.requested_by,
        reviewer: r.approvedByName ?? r.approved_by_name ?? r.rejectedByName ?? r.rejected_by_name,
        date: r.createdAt ?? r.created_at ?? '',
        reference: r.requestNumber ?? r.request_number ?? '',
        raw: r,
    };
}

const ENTITY_TYPES = [
    { value: '', label: 'All Types' },
    { value: 'workshop_registration', label: 'Workshop (public signup)' },
    { value: 'branch_creation', label: 'Branch (workshop)' },
    { value: 'cashier_registration', label: 'Cashier' },
    { value: 'workshop_portal_staff_registration', label: 'Portal staff (workshop)' },
    { value: 'supplier_registration', label: 'Supplier' },
    { value: 'corporate_registration', label: 'Corporate' },
    { value: 'corporate_price_quotation', label: 'Corporate price quotation' },
    { value: 'corporate_walk_in_booking', label: 'Corporate walk-in booking' },
    { value: 'corporate_payment_approval', label: 'Corporate payment proof' },
    { value: 'sales_return', label: 'POS sales return' },
    { value: 'marketing_budget_request', label: 'Marketing wallet top-up' },
    { value: 'admin_wallet_fund_request', label: 'Admin wallet fund request' },
    { value: 'admin_wallet_expense_request', label: 'Admin wallet expense request' },
    { value: 'marketing_promotion', label: 'Marketing promotion' },
    { value: 'marketing_campaign', label: 'Marketing campaign' },
    { value: 'marketing_expense', label: 'Marketing expense' },
    { value: 'marketing_promo_code', label: 'Marketing promo code' },
    { value: 'technician_registration', label: 'Technician' },
];

const TAB_TO_STATUS = {
    Pending: 'pending',
    Approved: 'approved',
    Rejected: 'rejected',
    All: undefined,
};

function fmtPerson(p) {
    if (!p) return '—';
    if (typeof p === 'string') return p;
    return p.name || p.fullName || p.email || p.mobile || '—';
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleString('en-US', {
        month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
}

// Keep IDs as strings — backend uses BigInt.
function toStringId(v) {
    return v == null ? '' : String(v);
}

function normalizeItem(raw) {
    const entityType = raw.entityType ?? raw.entity_type ?? '';
    const meta = raw.meta ?? {};
    const id = toStringId(raw.requestId ?? raw.id ?? raw._id);

    const title = raw.title
        ?? meta.companyName
        ?? meta.branchName
        ?? (meta.name && meta.workshopStaffRole
            ? `${meta.name} (${String(meta.workshopStaffRole).replace(/_/g, ' ')})`
            : null)
        ?? meta.name
        ?? meta.workshopCode
        ?? meta.cashierName
        ?? meta.fullName
        ?? raw.businessName
        ?? raw.business_name
        ?? `${entityType || 'Request'} #${id}`;

    const type = entityType.replace('_registration', '') || 'registration';
    const typeLabel = ENTITY_TYPES.find((e) => e.value === entityType)?.label
        ?? entityType.replace(/_/g, ' ');

    return {
        id,
        entityType,
        type,
        typeLabel,
        status: raw.status ?? 'pending',
        title,
        meta,
        submittedBy: raw.submittedBy ?? raw.submitted_by ?? null,
        reviewer: raw.reviewer ?? raw.reviewed_by ?? null,
        date: raw.submittedAt ?? raw.createdAt ?? raw.created_at ?? raw.date ?? '',
        reference: raw.reference ?? raw.referenceNo ?? '',
        raw,
    };
}

/** Accept all known list shapes from /super-admin/approvals*. */
function unwrapApprovalsListResponse(payload) {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== 'object') return [];

    const candidates = [
        payload.items,
        payload.data,
        payload.results,
        payload.rows,
        payload.list,
        payload?.data?.items,
        payload?.data?.rows,
        payload?.data?.results,
        payload?.data?.list,
    ];
    for (const c of candidates) {
        if (Array.isArray(c)) return c;
    }

    // Legacy numeric-key object fallback.
    return Object.entries(payload || {})
        .filter(([k]) => !Number.isNaN(Number(k)))
        .map(([, v]) => v);
}

/** Entity-specific compact "meta chips" shown on the card. */
function buildMetaChips(item) {
    const m = item.meta || {};
    const chips = [];
    const push = (label, value) => {
        if (value === undefined || value === null || value === '') return;
        chips.push({ label, value: String(value) });
    };

    switch (item.entityType) {
        case 'workshop_registration':
            push('Code', m.workshopCode);
            push('Owner', m.ownerName);
            push('Mobile', m.mobile);
            push('Email', m.email);
            push('CR', m.crNumber);
            break;
        case 'supplier_registration':
            push('Contact', m.contactPerson);
            push('Mobile', m.mobile);
            push('Email', m.email);
            push('License', m.tradeLicenseNo);
            push('VAT', m.vatId);
            push('City', m.cityDistrict);
            if (typeof m.isInternalWarehouse === 'boolean') {
                push('Internal WH', m.isInternalWarehouse ? 'Yes' : 'No');
            }
            break;
        case 'corporate_registration':
            push('Contact', m.contactPerson);
            push('Mobile', m.mobile);
            push('Email', m.email);
            push('VAT', m.vatNumber);
            if (Array.isArray(m.selectedBranchIds) && m.selectedBranchIds.length > 0) {
                push('Branches', `${m.selectedBranchIds.length}`);
            }
            if (m.referral?.fullName) push('Referral', m.referral.fullName);
            break;
        case 'technician_registration':
            push('Mobile', m.mobile);
            push('Email', m.email);
            push('Workshop', m.workshop?.name);
            push('Branch', m.branch?.name);
            push('Type', m.employeeType);
            push('Tech Type', m.technicianType);
            if (Array.isArray(m.departments) && m.departments.length > 0) {
                push('Depts', m.departments.map((d) => d?.name).filter(Boolean).join(', '));
            }
            break;
        case 'branch_creation':
            push('Branch', m.name ?? m.branchName);
            push('Workshop', m.workshop?.name);
            push('Code', m.branchCode ?? m.code);
            push('Address', m.address);
            push('Requested', m.approvalRequestedAt ?? m.approval_requested_at);
            break;
        case 'cashier_registration':
            push('Name', m.name ?? m.cashierName);
            push('Email', m.email);
            push('Mobile', m.mobile);
            push('Workshop', m.workshop?.name);
            push('Branch', m.branch?.name);
            break;
        case 'workshop_portal_staff_registration':
            push('Role', m.workshopStaffRole ?? m.workshop_staff_role);
            push('Name', m.name ?? m.fullName);
            push('Email', m.email);
            push('Mobile', m.mobile);
            push('Workshop', m.workshop?.name);
            push('Branch', m.branch?.name);
            push(
                'Team leader dept',
                m.teamLeaderDepartment?.name ?? m.team_leader_department?.name,
            );
            break;
        case 'corporate_price_quotation':
        case 'corporate_price_quotations':
            push('Item', m.name ?? m.itemName ?? m.item_name);
            push('SKU', m.sku);
            push('Department', m.departmentName ?? m.department_name);
            push('Quote incl. VAT', m.quotationPrice != null ? `SAR ${m.quotationPrice}` : null);
            push('Status', m.status ?? item.status);
            break;
        case 'corporate_walk_in_booking':
            push('Branch', m.branchName);
            push('Vehicle', m.vehiclePlate);
            push('Company', m.companyName);
            push('Order', m.salesOrderId);
            if (m.approvalStatusLabel) push('Approval', m.approvalStatusLabel);
            break;
        case 'corporate_payment_approval':
            push('Company', m.companyName);
            if (m.allocationsCount && m.allocationsCount > 1) {
                push('Invoices', `${m.allocationsCount} (first: ${m.invoiceNo ?? '—'})`);
            } else {
                push('Invoice', m.invoiceNo);
            }
            push('Workshop', m.workshopName);
            push('Branch', m.branchName);
            push('Method', m.paymentMethod);
            push('Total', m.amount != null ? `SAR ${Number(m.amount).toFixed(2)}` : null);
            if (m.rejectionReason) push('Reason', m.rejectionReason);
            break;
        case 'marketing_budget_request':
            push('Amount', m.amountLabel ?? (m.amount != null ? `SAR ${m.amount}` : null));
            push('Purpose', m.purpose);
            push('Source', m.sourceAccountName);
            push('Request', m.requestNumber);
            break;
        case 'admin_wallet_fund_request':
            push('Admin', m.adminUserName ?? m.adminUserEmail);
            push('Workshop', m.workshopName);
            push('Branch', m.branchName);
            push('Amount', m.amountLabel ?? (m.amount != null ? `SAR ${m.amount}` : null));
            push('Purpose', m.purpose);
            push('Request', m.requestNumber);
            break;
        case 'admin_wallet_expense_request':
            push('Admin', m.adminUserName ?? m.adminUserEmail);
            push('Workshop', m.workshopName);
            push('Branch', m.branchName);
            push('Category', m.expenseCategory);
            push('Amount', m.amountLabel ?? (m.amount != null ? `SAR ${m.amount}` : null));
            push('Request', m.requestNumber);
            break;
        case 'marketing_promotion':
            push('Discount', m.discountLabel);
            push('Type', m.promoType);
            push('Strategy', m.marketingStrategy);
            push('Code', m.code);
            break;
        case 'marketing_campaign':
            push('Workshop', m.workshopName);
            push('Platform', m.platform);
            push('Type', m.campaignType);
            push('Budget', m.budgetLabel);
            push('Dates', m.startDate && m.endDate ? `${m.startDate} → ${m.endDate}` : null);
            break;
        case 'marketing_expense':
            push('Category', m.expenseCategory);
            push('Vendor', m.vendorName);
            push('Amount', m.amountLabel);
            push('Campaign', m.campaignName);
            push('Date', m.expenseDate);
            break;
        case 'marketing_promo_code':
            push('Code', m.code);
            push('Discount', m.discountLabel);
            push('Promotion', m.promotionName);
            push('Valid', m.validFrom && m.validTo ? `${m.validFrom} → ${m.validTo}` : null);
            push('Usage', m.usageLimit != null ? `${m.usageCount ?? 0} / ${m.usageLimit}` : null);
            break;
        default:
            break;
    }
    return chips;
}

/* ------------------------------------------------------------------ */
/*  Approve / Reject confirmation modals                              */
/* ------------------------------------------------------------------ */

function ApproveModal({ item, busy, onCancel, onConfirm }) {
    const [remarks, setRemarks] = useState('');
    return (
        <Modal
            title="Approve Request"
            onClose={busy ? undefined : onCancel}
            width={460}
            footer={(
                <>
                    <button type="button" className="btn-view-details" disabled={busy} onClick={onCancel}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="btn-approve"
                        disabled={busy}
                        onClick={() => onConfirm(remarks)}
                    >
                        {busy ? <Loader size={14} className="spin" /> : <Check size={16} />}
                        Approve
                    </button>
                </>
            )}
        >
            <p className="approval-modal-lead">
                Approve <strong>{item.title}</strong>? You can add optional remarks for the audit log.
            </p>
            <label className="approval-modal-label" htmlFor="approve-remarks">
                Remarks <span className="approval-modal-optional">(optional)</span>
            </label>
            <textarea
                id="approve-remarks"
                className="approval-modal-textarea"
                rows={3}
                placeholder="e.g. Documents verified."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                disabled={busy}
            />
        </Modal>
    );
}

/** Approve admin wallet fund request — super admin picks source cash/bank account. */
function AdminWalletFundApproveModal({ item, busy, onCancel, onConfirm, error }) {
    const [remarks, setRemarks] = useState('');
    const [acct, setAcct] = useState({ blocked: true, loading: true });
    const workshopId = item?.meta?.workshopId ?? '';
    const branchId = item?.meta?.branchId ?? '';
    const amountLabel = item?.meta?.amountLabel
        ?? (item?.meta?.amount != null ? `SAR ${item.meta.amount}` : '—');
    const displayError = error || acct.blockReason;

    return (
        <Modal
            title="Approve Admin Wallet Fund Request"
            onClose={busy ? undefined : onCancel}
            width={520}
            footer={(
                <>
                    <button type="button" className="btn-view-details" disabled={busy} onClick={onCancel}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="btn-approve"
                        disabled={busy || acct.blocked}
                        onClick={() => onConfirm({
                            remarks: remarks.trim() || undefined,
                            sourceAccountId: acct.sourceAccountId,
                            sourceAccountName: acct.sourceAccountName,
                            budgetAccountId: acct.budgetAccountId,
                            budgetAccountName: acct.budgetAccountName,
                        })}
                    >
                        {busy ? <Loader size={14} className="spin" /> : <Check size={16} />}
                        Approve &amp; Fund Wallet
                    </button>
                </>
            )}
        >
            {displayError ? (
                <div
                    role="alert"
                    style={{
                        margin: '0 0 14px',
                        padding: '12px 14px',
                        borderRadius: 12,
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        color: '#b91c1c',
                        fontSize: '0.8125rem',
                    }}
                >
                    {displayError}
                </div>
            ) : null}
            <p className="approval-modal-lead">
                Approve <strong>{item.title}</strong> and credit the admin wallet.
                Amount <strong>{amountLabel}</strong> will be deducted from the selected payment account.
                {item?.meta?.workshopName ? (
                    <> Workshop: <strong>{item.meta.workshopName}</strong>
                    {item.meta.branchName ? <> · Branch: <strong>{item.meta.branchName}</strong></> : null}
                    </>
                ) : null}
            </p>

            <WalletApprovalAccountFields
                workshopId={workshopId}
                branchId={branchId}
                amount={item?.meta?.amount}
                mode="fund"
                busy={busy}
                onChange={setAcct}
            />

            <label className="approval-modal-label" htmlFor="admin-wallet-approve-remarks" style={{ marginTop: 14 }}>
                Remarks <span className="approval-modal-optional">(optional)</span>
            </label>
            <textarea
                id="admin-wallet-approve-remarks"
                className="approval-modal-textarea"
                rows={3}
                placeholder="e.g. Approved for travel petty cash."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                disabled={busy}
            />
        </Modal>
    );
}

function normalizeApprovalCashAccounts(res) {
    const list = Array.isArray(res?.accounts)
        ? res.accounts
        : Array.isArray(res?.cashAccounts)
            ? res.cashAccounts
            : [];
    return list.map((a) => ({
        id: String(a.id),
        name: a.name || a.accountName || a.account_name || `Account ${a.id}`,
        balance: Number(a.currentBalance ?? a.balance ?? 0),
        currencyCode: a.currencyCode || a.currency_code || 'SAR',
    }));
}

/** Super Admin: pick HQ cash/bank account for marketing wallet top-up or expense payment. */
function MarketingPaymentApproveModal({ item, busy, onCancel, onConfirm, mode = 'approve' }) {
    const [remarks, setRemarks] = useState('');
    const [accounts, setAccounts] = useState([]);
    const [accountsLoading, setAccountsLoading] = useState(true);
    const [accountsError, setAccountsError] = useState('');
    const [selectedId, setSelectedId] = useState('');

    const isBudget = item?.entityType === 'marketing_budget_request';
    const isExpense = item?.entityType === 'marketing_expense';
    const amount = Number(item?.meta?.amount ?? 0);
    const currency = item?.meta?.currencyCode ?? 'SAR';
    const amountLabel = `${currency} ${amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

    useEffect(() => {
        let cancelled = false;
        setRemarks('');
        setAccountsLoading(true);
        setAccountsError('');
        marketingListWalletCashAccounts()
            .then((res) => {
                if (cancelled) return;
                const normalized = normalizeApprovalCashAccounts(res);
                setAccounts(normalized);
                const preset = isBudget ? item?.meta?.sourceAccountId : null;
                if (preset && normalized.some((a) => a.id === String(preset))) {
                    setSelectedId(String(preset));
                } else if (normalized.length > 0) {
                    setSelectedId(normalized[0].id);
                } else {
                    setSelectedId('');
                }
            })
            .catch((e) => {
                if (!cancelled) {
                    setAccountsError(e?.message || 'Failed to load cash/bank accounts.');
                }
            })
            .finally(() => {
                if (!cancelled) setAccountsLoading(false);
            });
        return () => { cancelled = true; };
    }, [item, isBudget]);

    const selected = accounts.find((a) => a.id === selectedId);

    const title = mode === 'pay'
        ? 'Pay & Post to Chart of Accounts'
        : isBudget
            ? 'Approve wallet top-up'
            : 'Approve marketing expense';

    const lead = mode === 'pay'
        ? <>Post payment for <strong>{item.title}</strong> to HQ Chart of Accounts.</>
        : isBudget
            ? <>Fund the marketing wallet from an HQ cash/bank account. Amount: <strong>{amountLabel}</strong></>
            : <>Approve and pay <strong>{item.title}</strong> ({amountLabel}) from an HQ cash/bank account.</>;

    const accountingNote = isBudget
        ? 'Double-entry: Debit Marketing Budget Wallet (1330) · Credit selected payment account'
        : 'Double-entry: Debit Marketing Expense (6600) · Credit selected payment account';

    return (
        <Modal
            title={title}
            onClose={busy ? undefined : onCancel}
            width={520}
            footer={(
                <>
                    <button type="button" className="btn-view-details" disabled={busy} onClick={onCancel}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="btn-approve"
                        disabled={busy || accountsLoading || !selectedId}
                        onClick={() => {
                            const payload = {
                                notes: remarks.trim() || undefined,
                                remarks: remarks.trim() || undefined,
                            };
                            if (isBudget) {
                                payload.sourceAccountId = selectedId;
                                payload.sourceAccountName = selected?.name || '';
                            } else if (isExpense) {
                                payload.paymentAccountId = selectedId;
                                payload.paymentAccountName = selected?.name || '';
                            }
                            onConfirm(payload);
                        }}
                    >
                        {busy ? <Loader size={14} className="spin" /> : <Check size={16} />}
                        {mode === 'pay' ? 'Pay & Post' : 'Approve & Post'}
                    </button>
                </>
            )}
        >
            <p className="approval-modal-lead">{lead}</p>
            <p style={{ margin: '0 0 14px', fontSize: '0.8125rem', color: '#475569' }}>{accountingNote}</p>

            <label className="approval-modal-label" htmlFor="payment-account-select">
                Payment account <span style={{ color: '#b91c1c' }}>*</span>
            </label>
            {accountsLoading ? (
                <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
                    <Loader size={14} className="spin" /> Loading accounts…
                </p>
            ) : accountsError ? (
                <p style={{ color: '#b91c1c', fontSize: '0.875rem' }}>{accountsError}</p>
            ) : accounts.length === 0 ? (
                <p style={{ color: '#b91c1c', fontSize: '0.875rem' }}>
                    No HQ cash/bank accounts found. Add accounts under Cash &amp; Bank first.
                </p>
            ) : (
                <select
                    id="payment-account-select"
                    className="approval-modal-textarea"
                    style={{ minHeight: 'unset', padding: '10px 12px' }}
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value)}
                    disabled={busy}
                >
                    {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                            {account.name} — {account.currencyCode}{' '}
                            {account.balance.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                            })}
                        </option>
                    ))}
                </select>
            )}

            <label className="approval-modal-label" htmlFor="payment-approve-remarks" style={{ marginTop: 14 }}>
                Remarks <span className="approval-modal-optional">(optional)</span>
            </label>
            <textarea
                id="payment-approve-remarks"
                className="approval-modal-textarea"
                rows={3}
                placeholder="e.g. Approved for Q2 campaigns."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                disabled={busy}
            />
        </Modal>
    );
}

/** Super-admin: approve corporate_registration with final branch/store list (any workshop). */
function CorporateApproveModal({ item, busy, onCancel, onConfirm }) {
    const [remarks, setRemarks] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);
    const [branchSearch, setBranchSearch] = useState('');
    const [allBranches, setAllBranches] = useState([]);
    const [branchLoadErr, setBranchLoadErr] = useState('');

    const resetSelectionFromItem = useCallback(() => {
        const raw = item?.meta?.selectedBranchIds ?? item?.meta?.selected_branch_ids ?? [];
        const arr = Array.isArray(raw) ? raw : [];
        setSelectedIds(arr.map((x) => String(x)));
    }, [item]);

    useEffect(() => {
        resetSelectionFromItem();
        setRemarks('');
    }, [item, resetSelectionFromItem]);

    useEffect(() => {
        let cancelled = false;
        setBranchLoadErr('');
        getBranches({})
            .then((res) => {
                if (cancelled) return;
                const list = Array.isArray(res?.branches) ? res.branches : [];
                setAllBranches(list);
            })
            .catch((e) => {
                if (!cancelled) setBranchLoadErr(e.message || 'Failed to load branches');
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const filteredBranches = useMemo(() => {
        const q = branchSearch.trim().toLowerCase();
        const list = allBranches.filter((b) => {
            if (b?.approvalStatus && String(b.approvalStatus).toLowerCase() !== 'approved') return false;
            if (String(b?.isActive) === 'false' || b?.status === 'inactive') return false;
            if (!q) return true;
            const idStr = String(b.id ?? '');
            const nm = `${b.name || ''} ${b.workshopName || ''}`.toLowerCase();
            return nm.includes(q) || idStr.includes(q);
        });
        return list.sort((a, b) => {
            const wa = String(a.workshopName || '').localeCompare(String(b.workshopName || ''));
            if (wa !== 0) return wa;
            return String(a.name || '').localeCompare(String(b.name || ''));
        });
    }, [allBranches, branchSearch]);

    const toggleBranch = (id) => {
        const sid = String(id);
        setSelectedIds((prev) =>
            (prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid]),
        );
    };

    const canSubmit = selectedIds.length > 0 && !busy;

    return (
        <Modal
            title="Approve Corporate Registration"
            onClose={busy ? undefined : onCancel}
            width={560}
            footer={(
                <>
                    <button type="button" className="btn-view-details" disabled={busy} onClick={onCancel}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="btn-approve"
                        disabled={!canSubmit}
                        onClick={() =>
                            canSubmit &&
                            onConfirm({
                                remarks: remarks.trim(),
                                selectedStoreIds: selectedIds.map(String),
                            })}
                    >
                        {busy ? <Loader size={14} className="spin" /> : <Check size={16} />}
                        Approve &amp; activate
                    </button>
                </>
            )}
        >
            <p className="approval-modal-lead">
                Approve <strong>{item.title}</strong>. Adjust linked branches/stores across workshops if needed —
                these IDs are saved on the corporate account before activation.
            </p>
            {branchLoadErr && (
                <p style={{ color: '#B91C1C', fontSize: '0.875rem', marginBottom: 8 }}>{branchLoadErr}</p>
            )}
            <label className="approval-modal-label" htmlFor="corp-branch-filter">
                Search branches
            </label>
            <input
                id="corp-branch-filter"
                className="approval-modal-textarea"
                style={{ minHeight: 0 }}
                placeholder="Branch name, workshop, or ID"
                value={branchSearch}
                onChange={(e) => setBranchSearch(e.target.value)}
                disabled={busy}
            />

            <div
                style={{
                    maxHeight: 240,
                    overflowY: 'auto',
                    border: '1px solid #E5E7EB',
                    borderRadius: 8,
                    padding: 8,
                    marginTop: 10,
                    marginBottom: 12,
                    background: '#FAFAFA',
                }}
            >
                {filteredBranches.length === 0 ? (
                    <p className="empty-desc" style={{ margin: 8 }}>No matching branches.</p>
                ) : (
                    filteredBranches.map((b) => {
                        const idStr = String(b.id);
                        const checked = selectedIds.includes(idStr);
                        return (
                            <label
                                key={idStr}
                                style={{
                                    display: 'flex',
                                    gap: 10,
                                    padding: '8px 6px',
                                    cursor: busy ? 'not-allowed' : 'pointer',
                                    borderRadius: 6,
                                    background: checked ? 'rgba(220,252,231,0.6)' : 'transparent',
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={busy}
                                    onChange={() => toggleBranch(b.id)}
                                />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{b.name || idStr}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                                        {b.workshopName || 'Workshop'}{' '}
                                        <span style={{ fontFamily: 'monospace' }}>({idStr})</span>
                                    </div>
                                </div>
                            </label>
                        );
                    })
                )}
            </div>

            <p style={{ fontSize: '0.75rem', color: '#6B7280', marginBottom: 8 }}>
                {selectedIds.length} branch(es) selected. At least one is required.
            </p>

            <label className="approval-modal-label" htmlFor="approve-remarks-corporate">
                Remarks <span className="approval-modal-optional">(optional)</span>
            </label>
            <textarea
                id="approve-remarks-corporate"
                className="approval-modal-textarea"
                rows={3}
                placeholder="Audit note."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                disabled={busy}
            />
        </Modal>
    );
}

/** Flatten /super-admin/invoices/:id/view into the shape InvoiceDetailsModal/CashierTaxInvoiceView expects. */
function normalizeInvoiceForModal(invoice) {
    if (!invoice || typeof invoice !== 'object') return invoice;
    const srcOrder = invoice.salesOrder || invoice.sales_order || {};
    const srcCustomer = srcOrder.customer || invoice.customer || {};
    const srcVehicle = srcOrder.vehicle || invoice.vehicle || {};
    const srcJobs = Array.isArray(srcOrder.jobs)
        ? srcOrder.jobs
        : Array.isArray(invoice.jobs)
            ? invoice.jobs
            : [];
    return {
        ...invoice,
        order: { ...srcOrder, jobs: srcJobs },
        jobs: srcJobs,
        customer: srcCustomer,
        vehicle: srcVehicle,
        branch: invoice.branch || srcOrder.branch,
        workshop: invoice.workshop || srcOrder.workshop,
        paymentMethod: invoice.paymentMethod || invoice.payments?.[0]?.method,
    };
}

/** Marketing wallet top-up detail for Super Admin Approvals. */
function MarketingBudgetRequestDetailsModal({ id, item, onClose, onApprove, onReject }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setErr('');
        fetchApprovalDetails('marketing_budget_request', id)
            .then((res) => {
                if (!cancelled) setData(res);
            })
            .catch((e) => {
                if (!cancelled) setErr(e?.message || 'Could not load request details');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [id]);

    const row = data ?? item?.raw ?? item ?? {};
    const currency = row.currencyCode ?? row.currency_code ?? item?.meta?.currencyCode ?? 'SAR';
    const amount = Number(row.amount ?? item?.meta?.amount ?? 0);
    const requestNumber = row.requestNumber ?? row.request_number ?? item?.meta?.requestNumber ?? `#${id}`;
    const status = String(row.status ?? item?.status ?? 'pending').toLowerCase();

    const money = (v) =>
        `${currency} ${Number(v || 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;

    return (
        <Modal
            title={`Marketing wallet top-up · ${requestNumber}`}
            onClose={onClose}
            width={720}
            footer={(
                <>
                    <button type="button" className="btn-view-details" onClick={onClose}>Close</button>
                    {status === 'pending' && (
                        <>
                            {onReject && (
                                <button type="button" className="btn-reject" onClick={onReject}>
                                    <X size={16} /> Reject
                                </button>
                            )}
                            {onApprove && (
                                <button type="button" className="btn-approve" onClick={onApprove}>
                                    <Check size={16} /> Approve &amp; Post to CAO
                                </button>
                            )}
                        </>
                    )}
                </>
            )}
        >
            {loading ? (
                <div style={{ padding: 24, textAlign: 'center' }}>
                    <Loader size={20} className="spin" /> Loading…
                </div>
            ) : err ? (
                <p style={{ color: '#b91c1c' }}>{err}</p>
            ) : (
                <div>
                    <div style={{ marginBottom: 14 }}>
                        <span className={`status-badge status-${status}`}>{status}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                        <div style={{ padding: 12, background: '#f8fafc', borderRadius: 10 }}>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Amount</p>
                            <p style={{ margin: '4px 0 0', fontWeight: 700, fontSize: '1.125rem' }}>{money(amount)}</p>
                        </div>
                        <div style={{ padding: 12, background: '#f8fafc', borderRadius: 10 }}>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Source account</p>
                            <p style={{ margin: '4px 0 0', fontWeight: 700 }}>
                                {row.sourceAccountName ?? row.source_account_name ?? item?.meta?.sourceAccountName ?? '—'}
                            </p>
                            {(row.sourceAccountId ?? row.source_account_id ?? item?.meta?.sourceAccountId) && (
                                <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                                    Register #{row.sourceAccountId ?? row.source_account_id ?? item?.meta?.sourceAccountId}
                                </p>
                            )}
                        </div>
                    </div>
                    <div style={{ marginBottom: 14 }}>
                        <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Purpose</p>
                        <p style={{ margin: '6px 0 0', fontSize: '0.9375rem' }}>
                            {row.purpose ?? item?.meta?.purpose ?? '—'}
                        </p>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                        <div>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Requested by</p>
                            <p style={{ margin: '4px 0 0', fontWeight: 600 }}>
                                {row.requestedBy ?? row.requested_by ?? row.requestedByName ?? row.requested_by_name ?? item?.submittedBy ?? '—'}
                            </p>
                            <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#64748b' }}>
                                {formatDate(row.createdAt ?? row.created_at ?? item?.date)}
                            </p>
                        </div>
                        {(row.approvedBy ?? row.approved_by ?? row.approvedByName ?? row.rejectedBy ?? row.rejected_by) && (
                            <div>
                                <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                                    {row.rejectedBy ?? row.rejected_by ? 'Rejected by' : 'Approved by'}
                                </p>
                                <p style={{ margin: '4px 0 0', fontWeight: 600 }}>
                                    {row.approvedByName ?? row.approved_by_name ?? row.approvedBy ?? row.approved_by
                                        ?? row.rejectedByName ?? row.rejected_by_name ?? row.rejectedBy ?? row.rejected_by}
                                </p>
                                <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#64748b' }}>
                                    {formatDate(row.approvedAt ?? row.approved_at ?? row.rejectedAt ?? row.rejected_at)}
                                </p>
                            </div>
                        )}
                    </div>
                    {(row.rejectionReason ?? row.rejection_reason ?? item?.meta?.rejectionReason) && (
                        <div style={{ padding: 10, background: '#fef2f2', borderRadius: 10, fontSize: '0.875rem', color: '#991b1b' }}>
                            <strong>Rejection reason:</strong>{' '}
                            {row.rejectionReason ?? row.rejection_reason ?? item?.meta?.rejectionReason}
                        </div>
                    )}
                </div>
            )}
        </Modal>
    );
}

/** Admin personal wallet fund request detail for Super Admin Approvals. */
function AdminWalletFundRequestDetailsModal({ id, item, onClose, onApprove, onReject }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setErr('');
        fetchApprovalDetails('admin_wallet_fund_request', id)
            .then((res) => {
                if (!cancelled) setData(res);
            })
            .catch((e) => {
                if (!cancelled) setErr(e?.message || 'Could not load request details');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [id]);

    const row = data ?? item?.raw ?? item ?? {};
    const currency = row.currencyCode ?? row.currency_code ?? item?.meta?.currencyCode ?? 'SAR';
    const amount = Number(row.amount ?? item?.meta?.amount ?? 0);
    const requestNumber = row.requestNumber ?? row.request_number ?? item?.meta?.requestNumber ?? `#${id}`;
    const status = String(row.status ?? item?.status ?? 'pending').toLowerCase();
    const adminUser = row.adminUser ?? {};

    const money = (v) =>
        `${currency} ${Number(v || 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;

    return (
        <Modal
            title={`Admin wallet fund · ${requestNumber}`}
            onClose={onClose}
            width={720}
            footer={(
                <>
                    <button type="button" className="btn-view-details" onClick={onClose}>Close</button>
                    {status === 'pending' && (
                        <>
                            {onReject && (
                                <button type="button" className="btn-reject" onClick={onReject}>
                                    <X size={16} /> Reject
                                </button>
                            )}
                            {onApprove && (
                                <button type="button" className="btn-approve" onClick={onApprove}>
                                    <Check size={16} /> Approve
                                </button>
                            )}
                        </>
                    )}
                </>
            )}
        >
            {loading ? (
                <div style={{ padding: 24, textAlign: 'center' }}>
                    <Loader size={20} className="spin" /> Loading…
                </div>
            ) : err ? (
                <p style={{ color: '#b91c1c' }}>{err}</p>
            ) : (
                <div>
                    <div style={{ marginBottom: 14 }}>
                        <span className={`status-badge status-${status}`}>{status}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                        <div style={{ padding: 12, background: '#f8fafc', borderRadius: 10 }}>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Amount</p>
                            <p style={{ margin: '4px 0 0', fontWeight: 700, fontSize: '1.125rem' }}>{money(amount)}</p>
                        </div>
                        <div style={{ padding: 12, background: '#f8fafc', borderRadius: 10 }}>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Admin user</p>
                            <p style={{ margin: '4px 0 0', fontWeight: 700 }}>
                                {adminUser.name ?? row.adminUserName ?? item?.meta?.adminUserName ?? '—'}
                            </p>
                            <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#64748b' }}>
                                {adminUser.email ?? row.adminUserEmail ?? item?.meta?.adminUserEmail ?? '—'}
                            </p>
                        </div>
                    </div>
                    <div style={{ marginBottom: 14 }}>
                        <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Purpose</p>
                        <p style={{ margin: '6px 0 0', fontSize: '0.9375rem' }}>
                            {row.purpose ?? item?.meta?.purpose ?? '—'}
                        </p>
                    </div>
                    {(row.sourceAccountName ?? row.source_account_name ?? item?.meta?.sourceAccountName) && (
                        <div style={{ marginBottom: 14, padding: 12, background: '#f0fdf4', borderRadius: 10 }}>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#166534', textTransform: 'uppercase', fontWeight: 700 }}>Funded from</p>
                            <p style={{ margin: '6px 0 0', fontWeight: 700 }}>
                                {row.sourceAccountName ?? row.source_account_name ?? item?.meta?.sourceAccountName}
                            </p>
                        </div>
                    )}
                    {(row.superAdminApprovedByName ?? row.super_admin_approved_by_name ?? item?.meta?.superAdminApprovedByName) && (
                        <div style={{ marginBottom: 8 }}>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Super admin approval</p>
                            <p style={{ margin: '4px 0 0', fontWeight: 600 }}>
                                {row.superAdminApprovedByName ?? row.super_admin_approved_by_name ?? item?.meta?.superAdminApprovedByName}
                            </p>
                        </div>
                    )}
                    {(row.workshopAdminApprovedByName ?? row.workshop_admin_approved_by_name ?? item?.meta?.workshopAdminApprovedByName) && (
                        <div style={{ marginBottom: 14 }}>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Workshop admin approval</p>
                            <p style={{ margin: '4px 0 0', fontWeight: 600 }}>
                                {row.workshopAdminApprovedByName ?? row.workshop_admin_approved_by_name ?? item?.meta?.workshopAdminApprovedByName}
                            </p>
                        </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                        <div>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Requested by</p>
                            <p style={{ margin: '4px 0 0', fontWeight: 600 }}>
                                {row.requestedByName ?? row.requested_by_name ?? row.requestedBy ?? item?.submittedBy ?? '—'}
                            </p>
                            <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#64748b' }}>
                                {formatDate(row.createdAt ?? row.created_at ?? item?.date)}
                            </p>
                        </div>
                        {(row.approvedBy ?? row.approved_by ?? row.approvedByName ?? row.rejectedBy ?? row.rejected_by) && (
                            <div>
                                <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                                    {row.rejectedBy ?? row.rejected_by ? 'Rejected by' : 'Approved by'}
                                </p>
                                <p style={{ margin: '4px 0 0', fontWeight: 600 }}>
                                    {row.approvedByName ?? row.approved_by_name ?? row.approvedBy ?? row.approved_by
                                        ?? row.rejectedByName ?? row.rejected_by_name ?? row.rejectedBy ?? row.rejected_by}
                                </p>
                                <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#64748b' }}>
                                    {formatDate(row.approvedAt ?? row.approved_at ?? row.rejectedAt ?? row.rejected_at)}
                                </p>
                            </div>
                        )}
                    </div>
                    {(row.rejectionReason ?? row.rejection_reason ?? item?.meta?.rejectionReason) && (
                        <div style={{ padding: 10, background: '#fef2f2', borderRadius: 10, fontSize: '0.875rem', color: '#991b1b' }}>
                            <strong>Rejection reason:</strong>{' '}
                            {row.rejectionReason ?? row.rejection_reason ?? item?.meta?.rejectionReason}
                        </div>
                    )}
                </div>
            )}
        </Modal>
    );
}

function AdminWalletExpenseApproveModal({ item, busy, onCancel, onConfirm, error }) {
    const [remarks, setRemarks] = useState('');
    const [acct, setAcct] = useState({ blocked: true, loading: true });
    const proofUrl = item?.meta?.proofUrl ?? '';
    const category = item?.meta?.expenseCategory ?? '—';
    const workshopId = item?.meta?.workshopId ?? '';
    const branchId = item?.meta?.branchId ?? '';
    const amountLabel = item?.meta?.amountLabel
        ?? (item?.meta?.amount != null ? `SAR ${item.meta.amount}` : '—');
    const displayError = error || acct.blockReason;

    return (
        <Modal
            title="Approve Admin Wallet Expense"
            onClose={busy ? undefined : onCancel}
            width={520}
            footer={(
                <>
                    <button type="button" className="btn-view-details" disabled={busy} onClick={onCancel}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="btn-approve"
                        disabled={busy || acct.blocked}
                        onClick={() => onConfirm({
                            remarks: remarks.trim() || undefined,
                            ...(acct.paymentSource !== 'wallet' && acct.sourceAccountId
                                ? {
                                    sourceAccountId: acct.sourceAccountId,
                                    sourceAccountName: acct.sourceAccountName,
                                }
                                : {}),
                            budgetAccountId: acct.budgetAccountId,
                            budgetAccountName: acct.budgetAccountName,
                        })}
                    >
                        {busy ? <Loader size={14} className="spin" /> : <Check size={16} />}
                        Approve Expense
                    </button>
                </>
            )}
        >
            {displayError ? (
                <div role="alert" style={{ margin: '0 0 14px', padding: '12px 14px', borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '0.8125rem' }}>
                    {displayError}
                </div>
            ) : null}
            <p className="approval-modal-lead">
                Verify proof and category, then approve <strong>{item.title}</strong> for{' '}
                <strong>{amountLabel}</strong>.
                {item?.meta?.workshopName ? (
                    <> Posted to <strong>{item.meta.workshopName}</strong>
                    {item.meta.branchName ? <> · <strong>{item.meta.branchName}</strong></> : null} petty cash expense.</>
                ) : null}
            </p>
            <p style={{ margin: '0 0 8px', fontSize: '0.8125rem', color: '#64748b' }}>
                Category: <strong>{category}</strong>
            </p>
            {proofUrl ? (
                <div style={{ marginBottom: 14 }}>
                    <p style={{ margin: '0 0 8px', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Proof</p>
                    <ExpenseProofThumbnail proofUrl={proofUrl} alt="Expense proof" />
                </div>
            ) : (
                <p style={{ color: '#b45309', fontSize: '0.875rem' }}>No proof attached.</p>
            )}

            <WalletApprovalAccountFields
                workshopId={workshopId}
                branchId={branchId}
                amount={item?.meta?.amount}
                mode="expense"
                busy={busy}
                requesterUserId={item?.meta?.adminUserId ?? ''}
                requesterName={item?.meta?.adminUserName ?? item?.submittedBy ?? ''}
                currencyCode={item?.meta?.currencyCode ?? 'SAR'}
                onChange={setAcct}
            />

            <label className="approval-modal-label" htmlFor="admin-wallet-expense-approve-remarks" style={{ marginTop: 14 }}>
                Remarks <span className="approval-modal-optional">(optional)</span>
            </label>
            <textarea
                id="admin-wallet-expense-approve-remarks"
                className="approval-modal-textarea"
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                disabled={busy}
            />
        </Modal>
    );
}

function AdminWalletExpenseRequestDetailsModal({ id, item, onClose, onApprove, onReject }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setErr('');
        fetchApprovalDetails('admin_wallet_expense_request', id)
            .then((res) => { if (!cancelled) setData(res); })
            .catch((e) => { if (!cancelled) setErr(e?.message || 'Could not load request details'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [id]);

    const row = data ?? item?.raw ?? item ?? {};
    const currency = row.currencyCode ?? 'SAR';
    const amount = Number(row.amount ?? item?.meta?.amount ?? 0);
    const requestNumber = row.requestNumber ?? `#${id}`;
    const status = String(row.status ?? 'pending').toLowerCase();
    const money = (v) =>
        `${currency} ${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return (
        <Modal
            title={`Admin wallet expense · ${requestNumber}`}
            onClose={onClose}
            width={720}
            footer={(
                <>
                    <button type="button" className="btn-view-details" onClick={onClose}>Close</button>
                    {status === 'pending' && (
                        <>
                            {onReject && (
                                <button type="button" className="btn-reject" onClick={onReject}>
                                    <X size={16} /> Reject
                                </button>
                            )}
                            {onApprove && (
                                <button type="button" className="btn-approve" onClick={onApprove}>
                                    <Check size={16} /> Approve
                                </button>
                            )}
                        </>
                    )}
                </>
            )}
        >
            {loading ? (
                <div style={{ padding: 24, textAlign: 'center' }}><Loader size={20} className="spin" /> Loading…</div>
            ) : err ? (
                <p style={{ color: '#b91c1c' }}>{err}</p>
            ) : (
                <div>
                    <div style={{ marginBottom: 14 }}><span className={`status-badge status-${status}`}>{status}</span></div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                        <div style={{ padding: 12, background: '#f8fafc', borderRadius: 10 }}>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Amount</p>
                            <p style={{ margin: '4px 0 0', fontWeight: 700, fontSize: '1.125rem' }}>{money(amount)}</p>
                        </div>
                        <div style={{ padding: 12, background: '#f8fafc', borderRadius: 10 }}>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Category</p>
                            <p style={{ margin: '4px 0 0', fontWeight: 600 }}>{row.expenseCategory ?? '—'}</p>
                        </div>
                    </div>
                    {(row.workshopName || row.branchName) && (
                        <p style={{ margin: '0 0 14px', fontSize: '0.875rem' }}>
                            <strong>{row.workshopName ?? '—'}</strong>
                            {row.branchName ? ` · ${row.branchName}` : ''}
                        </p>
                    )}
                    <div style={{ marginBottom: 14 }}>
                        <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Description</p>
                        <p style={{ margin: '6px 0 0' }}>{row.description ?? '—'}</p>
                    </div>
                    {row.proofUrl && (
                        <div style={{ marginBottom: 14 }}>
                            <p style={{ margin: '0 0 8px', fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Proof</p>
                            <ExpenseProofThumbnail proofUrl={row.proofUrl} alt="Expense proof" />
                        </div>
                    )}
                </div>
            )}
        </Modal>
    );
}

/** Marketing expense detail — approve/reject + pay (posts HQ Chart of Accounts journal). */
function MarketingExpenseDetailsModal({ id, item, onClose, onApprove, onReject, onPay, payBusy }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setErr('');
        fetchApprovalDetails('marketing_expense', id)
            .then((res) => {
                if (!cancelled) setData(res);
            })
            .catch((e) => {
                if (!cancelled) setErr(e?.message || 'Could not load expense details');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [id]);

    const row = data?.expense ?? data ?? item?.raw ?? item ?? {};
    const amount = Number(row.amount ?? item?.meta?.amount ?? 0);
    const expenseNumber = row.expenseNumber ?? row.expense_number ?? item?.meta?.expenseNumber ?? `#${id}`;
    const status = String(row.status ?? data?.expenseStatus ?? item?.meta?.expenseStatus ?? item?.status ?? 'pending')
        .toLowerCase()
        .replace(/\s+/g, '_');

    const money = (v) =>
        `SAR ${Number(v || 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;

    const showApproveReject = status === 'pending_approval' || status === 'pending';
    const showPay = status === 'approved';

    return (
        <Modal
            title={`Marketing expense · ${expenseNumber}`}
            onClose={onClose}
            width={720}
            footer={(
                <>
                    <button type="button" className="btn-view-details" onClick={onClose}>Close</button>
                    {showPay && onPay && (
                        <button type="button" className="btn-approve" disabled={payBusy} onClick={onPay}>
                            {payBusy ? <Loader size={16} className="spin" /> : <DollarSign size={16} />}
                            Pay &amp; Post to CAO
                        </button>
                    )}
                    {showApproveReject && (
                        <>
                            {onReject && (
                                <button type="button" className="btn-reject" onClick={onReject}>
                                    <X size={16} /> Reject
                                </button>
                            )}
                            {onApprove && (
                                <button type="button" className="btn-approve" onClick={onApprove}>
                                    <Check size={16} /> Approve &amp; Post to CAO
                                </button>
                            )}
                        </>
                    )}
                </>
            )}
        >
            {loading ? (
                <div style={{ padding: 24, textAlign: 'center' }}>
                    <Loader size={20} className="spin" /> Loading…
                </div>
            ) : err ? (
                <p style={{ color: '#b91c1c' }}>{err}</p>
            ) : (
                <div>
                    <div style={{ marginBottom: 14 }}>
                        <span className={`status-badge status-${status === 'pending_approval' ? 'pending' : status}`}>
                            {status.replace(/_/g, ' ')}
                        </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                        <div style={{ padding: 12, background: '#f8fafc', borderRadius: 10 }}>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Amount</p>
                            <p style={{ margin: '4px 0 0', fontWeight: 700, fontSize: '1.125rem' }}>{money(amount)}</p>
                        </div>
                        <div style={{ padding: 12, background: '#f8fafc', borderRadius: 10 }}>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Category</p>
                            <p style={{ margin: '4px 0 0', fontWeight: 700 }}>
                                {row.expenseCategory ?? item?.meta?.expenseCategory ?? '—'}
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                        <div>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Vendor</p>
                            <p style={{ margin: '4px 0 0', fontWeight: 600 }}>{row.vendorName ?? item?.meta?.vendorName ?? '—'}</p>
                        </div>
                        <div>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Campaign</p>
                            <p style={{ margin: '4px 0 0', fontWeight: 600 }}>{row.campaignName ?? item?.meta?.campaignName ?? '—'}</p>
                        </div>
                    </div>
                    {(row.description ?? item?.meta?.description) && (
                        <div style={{ marginBottom: 14 }}>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Description</p>
                            <p style={{ margin: '6px 0 0', fontSize: '0.9375rem' }}>{row.description ?? item?.meta?.description}</p>
                        </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                        <div>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Submitted by</p>
                            <p style={{ margin: '4px 0 0', fontWeight: 600 }}>
                                {row.submittedByName ?? row.submittedBy ?? item?.submittedBy ?? '—'}
                            </p>
                            <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#64748b' }}>
                                {formatDate(row.expenseDate ?? row.expense_date ?? item?.meta?.expenseDate)}
                            </p>
                        </div>
                        {(row.approvedByName ?? row.approvedBy) && (
                            <div>
                                <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Reviewed by</p>
                                <p style={{ margin: '4px 0 0', fontWeight: 600 }}>{row.approvedByName ?? row.approvedBy}</p>
                                <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#64748b' }}>
                                    {formatDate(row.approvalDate ?? row.approval_date)}
                                </p>
                            </div>
                        )}
                    </div>
                    {status === 'approved' && (
                        <div style={{ padding: 10, background: '#eff6ff', borderRadius: 10, fontSize: '0.875rem', color: '#1e40af', marginBottom: 14 }}>
                            Approved — use <strong>Pay &amp; Post to CAO</strong> to debit the marketing wallet and book HQ journal (DR Marketing Expense / CR Marketing Wallet).
                        </div>
                    )}
                    {(row.rejectionReason ?? item?.meta?.rejectionReason) && (
                        <div style={{ padding: 10, background: '#fef2f2', borderRadius: 10, fontSize: '0.875rem', color: '#991b1b' }}>
                            <strong>Rejection reason:</strong> {row.rejectionReason ?? item?.meta?.rejectionReason}
                        </div>
                    )}
                </div>
            )}
        </Modal>
    );
}

/** Marketing promotion detail for Super Admin Approvals. */
function MarketingPromotionDetailsModal({ id, item, onClose, onApprove, onReject }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setErr('');
        fetchApprovalDetails('marketing_promotion', id)
            .catch(() => null)
            .then((res) => {
                if (cancelled) return;
                if (res) {
                    setData(res);
                    return;
                }
                return marketingGetPromotion(id).then((promoRes) => {
                    if (!cancelled) {
                        const promotion =
                            promoRes?.promotion ??
                            promoRes?.data ??
                            promoRes?.item ??
                            promoRes;
                        setData({
                            promotion,
                            name: promotion?.name,
                            promoType: promotion?.promoType ?? promotion?.promotionType,
                            marketingStrategy: promotion?.marketingStrategy,
                            discountValue: promotion?.discountValue ?? promotion?.value,
                            discountLabel: item?.meta?.discountLabel,
                            status:
                                normalizePromotionWorkflowStatus(promotion?.status) ===
                                'pending_approval'
                                    ? 'pending'
                                    : normalizePromotionWorkflowStatus(promotion?.status) ===
                                        'rejected'
                                      ? 'rejected'
                                      : 'approved',
                            startAt: promotion?.startAt ?? promotion?.startDate,
                            endAt: promotion?.endAt ?? promotion?.endDate,
                            code: promotion?.code,
                            description: promotion?.description,
                        });
                    }
                });
            })
            .catch((e) => {
                if (!cancelled) setErr(e?.message || 'Could not load promotion details');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [id]);

    const row = data ?? item?.raw ?? item ?? {};
    const promotion = row.promotion ?? row;
    const name = promotion.name ?? promotion.promotionName ?? item?.title ?? `Promotion #${id}`;
    const status = String(row.status ?? item?.status ?? 'pending').toLowerCase();
    const discountLabel =
        row.discountLabel ??
        item?.meta?.discountLabel ??
        (promotion.discountValue != null ? String(promotion.discountValue) : '—');

    return (
        <Modal
            title={`Marketing promotion · ${name}`}
            onClose={onClose}
            width={760}
            footer={(
                <>
                    <button type="button" className="btn-view-details" onClick={onClose}>Close</button>
                    {status === 'pending' && (
                        <>
                            {onReject && (
                                <button type="button" className="btn-reject" onClick={onReject}>
                                    <X size={16} /> Reject
                                </button>
                            )}
                            {onApprove && (
                                <button type="button" className="btn-approve" onClick={onApprove}>
                                    <Check size={16} /> Approve
                                </button>
                            )}
                        </>
                    )}
                </>
            )}
        >
            {loading ? (
                <div style={{ padding: 24, textAlign: 'center' }}>
                    <Loader size={20} className="spin" /> Loading…
                </div>
            ) : err ? (
                <p style={{ color: '#b91c1c' }}>{err}</p>
            ) : (
                <div>
                    <div style={{ marginBottom: 14 }}>
                        <span className={`status-badge status-${status}`}>{status}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                        <div style={{ padding: 12, background: '#f8fafc', borderRadius: 10 }}>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Discount</p>
                            <p style={{ margin: '4px 0 0', fontWeight: 700, fontSize: '1.125rem' }}>{discountLabel}</p>
                        </div>
                        <div style={{ padding: 12, background: '#f8fafc', borderRadius: 10 }}>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Promotion type</p>
                            <p style={{ margin: '4px 0 0', fontWeight: 700 }}>
                                {promotion.promoType ?? promotion.promotionType ?? row.promoType ?? '—'}
                            </p>
                        </div>
                    </div>
                    <div style={{ marginBottom: 14 }}>
                        <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Strategy</p>
                        <p style={{ margin: '6px 0 0', fontSize: '0.9375rem' }}>
                            {promotion.marketingStrategy ?? row.marketingStrategy ?? '—'}
                        </p>
                    </div>
                    {promotion.description && (
                        <div style={{ marginBottom: 14 }}>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Description</p>
                            <p style={{ margin: '6px 0 0', fontSize: '0.9375rem' }}>{promotion.description}</p>
                        </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                        <div>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Valid from</p>
                            <p style={{ margin: '4px 0 0', fontWeight: 600 }}>
                                {formatDate(promotion.startAt ?? promotion.startDate ?? row.startAt)}
                            </p>
                        </div>
                        <div>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Valid until</p>
                            <p style={{ margin: '4px 0 0', fontWeight: 600 }}>
                                {formatDate(promotion.endAt ?? promotion.endDate ?? row.endAt)}
                            </p>
                        </div>
                    </div>
                    <div style={{ marginBottom: 14 }}>
                        <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Promo code</p>
                        <p style={{ margin: '6px 0 0', fontSize: '0.9375rem', fontFamily: 'monospace' }}>
                            {promotion.code ?? row.code ?? '—'}
                        </p>
                    </div>
                </div>
            )}
        </Modal>
    );
}

/** Proof preview for a Corporate Payment Approval — fetches base64 image, shows full detail. */
function CorporatePaymentApprovalDetailsModal({ id, item, onClose, onApprove, onReject }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [invoice, setInvoice] = useState(null);
    const [invoiceLoading, setInvoiceLoading] = useState(false);
    const [invoiceErr, setInvoiceErr] = useState('');

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setErr('');
        getCorporatePaymentApproval(id)
            .then((res) => {
                if (!cancelled) setData(res);
            })
            .catch((e) => {
                if (!cancelled) setErr(e?.message || 'Could not load proof');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [id]);

    const [invoiceLoadingId, setInvoiceLoadingId] = useState(null);

    const openInvoice = async (invoiceIdArg) => {
        const invoiceId = invoiceIdArg ?? data?.invoice?.id ?? item?.meta?.invoiceId;
        if (!invoiceId) return;
        setInvoiceLoading(true);
        setInvoiceLoadingId(String(invoiceId));
        setInvoiceErr('');
        try {
            const raw = await getSuperAdminInvoiceView(invoiceId);
            const inv = raw?.invoice ?? raw?.data?.invoice ?? raw?.data ?? raw;
            setInvoice(normalizeInvoiceForModal(inv));
        } catch (e) {
            setInvoiceErr(e?.message || 'Could not load invoice');
        } finally {
            setInvoiceLoading(false);
            setInvoiceLoadingId(null);
        }
    };

    const num = (v) =>
        `SAR ${Number(v || 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;

    return (
        <Modal
            title={`Payment proof · ${data?.invoice?.invoiceNo ?? item?.meta?.invoiceNo ?? `#${id}`}`}
            onClose={onClose}
            width={760}
            footer={(
                <>
                    <button type="button" className="btn-view-details" onClick={onClose}>Close</button>
                    {data?.status === 'pending' && (
                        <>
                            {onReject && (
                                <button type="button" className="btn-reject" onClick={onReject}>
                                    <X size={16} /> Reject
                                </button>
                            )}
                            {onApprove && (
                                <button type="button" className="btn-approve" onClick={onApprove}>
                                    <Check size={16} /> Approve
                                </button>
                            )}
                        </>
                    )}
                </>
            )}
        >
            {loading ? (
                <div style={{ padding: 24, textAlign: 'center' }}>
                    <Loader size={20} className="spin" /> Loading…
                </div>
            ) : err ? (
                <p style={{ color: '#b91c1c' }}>{err}</p>
            ) : data ? (
                <div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                        <div>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Corporate</p>
                            <p style={{ margin: '4px 0 0', fontWeight: 700 }}>{data.corporate?.companyName ?? '—'}</p>
                            <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#64748b' }}>
                                {data.requestedByUser?.name ?? data.requestedByUser?.email ?? '—'}
                            </p>
                        </div>
                        <div>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Invoice</p>
                            <p style={{ margin: '4px 0 0', fontWeight: 700 }}>{data.invoice?.invoiceNo ?? '—'}</p>
                            <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#64748b' }}>
                                {data.invoice?.workshopName ?? '—'} · {data.invoice?.branchName ?? '—'}
                            </p>
                            <p style={{ margin: '4px 0 0', fontSize: '0.75rem' }}>
                                Total {num(data.invoice?.totalAmount)} · Paid {num(data.invoice?.paidSum)} · Balance <strong>{num(data.invoice?.balance)}</strong>
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                        <div style={{ padding: 12, background: '#f8fafc', borderRadius: 10 }}>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Method</p>
                            <p style={{ margin: '4px 0 0', fontWeight: 700, textTransform: 'capitalize' }}>{data.paymentMethod}</p>
                        </div>
                        <div style={{ padding: 12, background: '#f8fafc', borderRadius: 10 }}>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Amount requested</p>
                            <p style={{ margin: '4px 0 0', fontWeight: 700 }}>{num(data.amount)}</p>
                        </div>
                    </div>
                    {data.notes ? (
                        <div style={{ marginBottom: 12, padding: 10, background: '#fefce8', borderRadius: 10, fontSize: '0.875rem' }}>
                            <strong>Notes:</strong> {data.notes}
                        </div>
                    ) : null}

                    {/* Invoice allocations table — one row per invoice in this approval. */}
                    <p style={{ margin: '0 0 6px', fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                        Invoices covered ({Array.isArray(data.allocations) && data.allocations.length > 0 ? data.allocations.length : 1})
                    </p>
                    <div style={{ marginBottom: 14, border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                            <thead style={{ background: '#f8fafc' }}>
                                <tr>
                                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Invoice</th>
                                    <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: '0.7rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Invoice total</th>
                                    <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: '0.7rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Balance</th>
                                    <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: '0.7rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Allocated</th>
                                    <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: '0.7rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>View</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(Array.isArray(data.allocations) && data.allocations.length > 0
                                    ? data.allocations
                                    : [{
                                          invoiceId: data.invoice?.id,
                                          invoiceNo: data.invoice?.invoiceNo,
                                          invoiceTotal: data.invoice?.totalAmount,
                                          invoiceBalance: data.invoice?.balance,
                                          amount: data.amount,
                                      }]
                                ).map((alloc, idx) => (
                                    <tr key={`${alloc.invoiceId}-${idx}`} style={{ borderTop: idx === 0 ? 'none' : '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '10px', fontWeight: 700 }}>
                                            {alloc.invoiceNo ?? `#${alloc.invoiceId}`}
                                        </td>
                                        <td style={{ padding: '10px', textAlign: 'right' }}>
                                            {alloc.invoiceTotal != null ? num(alloc.invoiceTotal) : '—'}
                                        </td>
                                        <td style={{ padding: '10px', textAlign: 'right' }}>
                                            {alloc.invoiceBalance != null ? num(alloc.invoiceBalance) : '—'}
                                        </td>
                                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700 }}>
                                            {num(alloc.amount)}
                                        </td>
                                        <td style={{ padding: '10px', textAlign: 'right' }}>
                                            <button
                                                type="button"
                                                onClick={() => openInvoice(alloc.invoiceId)}
                                                disabled={invoiceLoadingId === String(alloc.invoiceId)}
                                                style={{
                                                    padding: '6px 10px',
                                                    borderRadius: 8,
                                                    border: '1px solid #bfdbfe',
                                                    background: '#eff6ff',
                                                    color: '#1d4ed8',
                                                    cursor: invoiceLoadingId === String(alloc.invoiceId) ? 'wait' : 'pointer',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700,
                                                }}
                                            >
                                                {invoiceLoadingId === String(alloc.invoiceId)
                                                    ? <Loader size={12} className="spin" />
                                                    : <FileText size={12} />}
                                                {' '}View
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <p style={{ margin: '0 0 6px', fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Proof</p>
                    {data.proofImage ? (
                        data.proofMimeType === 'application/pdf' ? (
                            <iframe title="proof-pdf" src={data.proofImage} style={{ width: '100%', height: 460, border: '1px solid #e2e8f0', borderRadius: 10 }} />
                        ) : (
                            <img alt="payment proof" src={data.proofImage} style={{ width: '100%', maxHeight: 540, objectFit: 'contain', borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc' }} />
                        )
                    ) : (
                        <p style={{ color: '#94a3b8' }}>No proof attached.</p>
                    )}
                    {data.status === 'rejected' && data.rejectionReason ? (
                        <div style={{ marginTop: 12, padding: 10, background: '#fef2f2', color: '#991b1b', borderRadius: 10, fontSize: '0.875rem' }}>
                            <strong>Rejection reason:</strong> {data.rejectionReason}
                        </div>
                    ) : null}
                    {invoiceErr ? (
                        <div style={{ marginTop: 12, padding: 10, background: '#fef2f2', color: '#991b1b', borderRadius: 10, fontSize: '0.8125rem' }}>
                            {invoiceErr}
                        </div>
                    ) : null}
                </div>
            ) : null}
            <InvoiceDetailsModal
                invoice={invoice}
                isOpen={!!invoice}
                footerVariant="corporate"
                onClose={() => setInvoice(null)}
            />
        </Modal>
    );
}

/** Sales return detail for Super Admin Approvals — uses dedicated sales-return API. */
function SalesReturnApprovalDetailsModal({ id, item, onClose, onApprove, onReject }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [invoice, setInvoice] = useState(null);
    const [invoiceLoadingId, setInvoiceLoadingId] = useState(null);
    const [invoiceErr, setInvoiceErr] = useState('');

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setErr('');
        getSuperAdminSalesReturn(id)
            .then((res) => {
                if (!cancelled) setData(res?.salesReturn ?? res?.data?.salesReturn ?? null);
            })
            .catch((e) => {
                if (!cancelled) setErr(e?.message || 'Could not load sales return');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [id]);

    const openInvoice = async (invoiceId) => {
        if (!invoiceId) return;
        setInvoiceLoadingId(String(invoiceId));
        setInvoiceErr('');
        try {
            const raw = await getSuperAdminInvoiceView(invoiceId);
            const inv = raw?.invoice ?? raw?.data?.invoice ?? raw?.data ?? raw;
            setInvoice(normalizeInvoiceForModal(inv));
        } catch (e) {
            setInvoiceErr(e?.message || 'Could not load invoice');
        } finally {
            setInvoiceLoadingId(null);
        }
    };

    const num = (v) =>
        `SAR ${Number(v || 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;

    const title = data?.returnNo ?? data?.creditNoteNo ?? item?.meta?.returnNo ?? `#${id}`;

    return (
        <Modal
            title={`Sales return · ${title}`}
            onClose={onClose}
            width={760}
            footer={(
                <>
                    <button type="button" className="btn-view-details" onClick={onClose}>Close</button>
                    {data?.status === 'pending' && (
                        <>
                            {onReject && (
                                <button type="button" className="btn-reject" onClick={onReject}>
                                    <X size={16} /> Reject
                                </button>
                            )}
                            {onApprove && (
                                <button type="button" className="btn-approve" onClick={onApprove}>
                                    <Check size={16} /> Approve
                                </button>
                            )}
                        </>
                    )}
                </>
            )}
        >
            {loading ? (
                <div style={{ padding: 24, textAlign: 'center' }}>
                    <Loader size={20} className="spin" /> Loading…
                </div>
            ) : err ? (
                <p style={{ color: '#b91c1c' }}>{err}</p>
            ) : data ? (
                <div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                        <div>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Return</p>
                            <p style={{ margin: '4px 0 0', fontWeight: 700 }}>{data.creditNoteNo || data.returnNo || '—'}</p>
                            <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#64748b' }}>
                                {formatDate(data.returnDate ?? data.createdAt)}
                            </p>
                        </div>
                        <div>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Invoice</p>
                            <p style={{ margin: '4px 0 0', fontWeight: 700 }}>{data.invoiceNo ?? '—'}</p>
                            <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#64748b' }}>
                                {data.workshopName ?? '—'} · {data.branchName ?? '—'}
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                        <div style={{ padding: 12, background: '#f8fafc', borderRadius: 10 }}>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Customer</p>
                            <p style={{ margin: '4px 0 0', fontWeight: 700 }}>{data.customerName ?? '—'}</p>
                            <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#64748b' }}>{data.customerPhone ?? ''}</p>
                        </div>
                        <div style={{ padding: 12, background: '#f8fafc', borderRadius: 10 }}>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Amount</p>
                            <p style={{ margin: '4px 0 0', fontWeight: 700, color: '#b91c1c' }}>{num(data.totalAmount)}</p>
                            <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#64748b' }}>
                                Subtotal {num(data.subtotal)} · VAT {num(data.vatAmount)}
                            </p>
                        </div>
                    </div>
                    {(data.reason || data.returnScope) && (
                        <div style={{ marginBottom: 12, padding: 10, background: '#fefce8', borderRadius: 10, fontSize: '0.875rem' }}>
                            {data.returnScope ? (
                                <p style={{ margin: '0 0 4px' }}>
                                    <strong>Type:</strong>{' '}
                                    {data.returnScope === 'full' ? 'Full return' : data.returnScope === 'partial' ? 'Partial return' : data.returnScope}
                                </p>
                            ) : null}
                            {data.reason ? <p style={{ margin: 0 }}><strong>Reason:</strong> {data.reason}</p> : null}
                        </div>
                    )}
                    <p style={{ margin: '0 0 6px', fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                        Line items ({(data.items || []).length})
                    </p>
                    <div style={{ marginBottom: 14, border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                            <thead style={{ background: '#f8fafc' }}>
                                <tr>
                                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Item</th>
                                    <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: '0.7rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Qty</th>
                                    <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: '0.7rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Unit</th>
                                    <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: '0.7rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Total</th>
                                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Reason</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(data.items || []).length === 0 ? (
                                    <tr>
                                        <td colSpan={5} style={{ padding: 12, textAlign: 'center', color: '#94a3b8' }}>No line items.</td>
                                    </tr>
                                ) : (data.items || []).map((it, idx) => (
                                    <tr key={it.id ?? idx} style={{ borderTop: idx === 0 ? 'none' : '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '10px' }}>{it.name ?? '—'}</td>
                                        <td style={{ padding: '10px', textAlign: 'right' }}>
                                            {it.qty}{it.originalQty != null ? ` / ${it.originalQty}` : ''}
                                        </td>
                                        <td style={{ padding: '10px', textAlign: 'right' }}>{num(it.unitPrice)}</td>
                                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700 }}>{num(it.lineTotal)}</td>
                                        <td style={{ padding: '10px' }}>{it.reason ?? '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {data.invoiceId ? (
                        <div style={{ marginBottom: 12 }}>
                            <button
                                type="button"
                                onClick={() => openInvoice(data.invoiceId)}
                                disabled={invoiceLoadingId === String(data.invoiceId)}
                                className="btn-view-details"
                            >
                                {invoiceLoadingId === String(data.invoiceId)
                                    ? <Loader size={12} className="spin" />
                                    : <FileText size={12} />}
                                {' '}View invoice
                            </button>
                        </div>
                    ) : null}
                    {data.status === 'rejected' && data.rejectionReason ? (
                        <div style={{ marginTop: 12, padding: 10, background: '#fef2f2', color: '#991b1b', borderRadius: 10, fontSize: '0.875rem' }}>
                            <strong>Rejection reason:</strong> {data.rejectionReason}
                        </div>
                    ) : null}
                    {invoiceErr ? (
                        <div style={{ marginTop: 12, padding: 10, background: '#fef2f2', color: '#991b1b', borderRadius: 10, fontSize: '0.8125rem' }}>
                            {invoiceErr}
                        </div>
                    ) : null}
                </div>
            ) : (
                <p style={{ color: '#94a3b8' }}>Sales return not found.</p>
            )}
            <InvoiceDetailsModal
                invoice={invoice}
                isOpen={!!invoice}
                footerVariant="corporate"
                onClose={() => setInvoice(null)}
            />
        </Modal>
    );
}

function RejectModal({ item, busy, onCancel, onConfirm }) {
    const [reason, setReason] = useState('');
    const [touched, setTouched] = useState(false);
    const trimmed = reason.trim();
    const valid = trimmed.length > 0;

    const handleConfirm = () => {
        if (!valid) {
            setTouched(true);
            return;
        }
        onConfirm(trimmed);
    };

    return (
        <Modal
            title="Reject Request"
            onClose={busy ? undefined : onCancel}
            width={460}
            footer={(
                <>
                    <button type="button" className="btn-view-details" disabled={busy} onClick={onCancel}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="btn-reject"
                        disabled={busy || !valid}
                        onClick={handleConfirm}
                    >
                        {busy ? <Loader size={14} className="spin" /> : <X size={16} />}
                        Reject
                    </button>
                </>
            )}
        >
            <p className="approval-modal-lead">
                Reject <strong>{item.title}</strong>? Provide a reason — it will be shown to the
                submitter.
            </p>
            <label className="approval-modal-label" htmlFor="reject-reason">
                Reason <span className="approval-modal-required">(required)</span>
            </label>
            <textarea
                id="reject-reason"
                className={`approval-modal-textarea ${touched && !valid ? 'invalid' : ''}`}
                rows={3}
                placeholder="e.g. Trade license expired."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                onBlur={() => setTouched(true)}
                disabled={busy}
            />
            {touched && !valid && (
                <p className="approval-modal-error">A reason is required to reject.</p>
            )}
        </Modal>
    );
}

/* ------------------------------------------------------------------ */
/*  Toast (matches the lightweight pattern used in TechnicianLayout)  */
/* ------------------------------------------------------------------ */

function Toast({ toast }) {
    if (!toast) return null;
    const isError = toast.type === 'error';
    return (
        <div
            className="approvals-toast"
            style={{
                background: isError ? '#FEE2E2' : '#DCFCE7',
                color: isError ? '#DC2626' : '#15803D',
                borderColor: isError ? '#FCA5A5' : '#BBF7D0',
            }}
            role="status"
        >
            {toast.msg}
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Global auto-approve toggle (corporate walk-ins)                    */
/* ------------------------------------------------------------------ */

/**
 * Platform-wide master switch. When ON, every cashier-submitted corporate
 * walk-in auto-approves on submission (bypasses this queue) regardless of each
 * corporate account's own per-account toggle. Optimistic flip; parent rolls
 * back on backend error.
 */
function GlobalAutoApproveToggle({ value, busy, disabled, onChange }) {
    return (
        <label
            style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                marginLeft: 'auto',
                padding: '8px 14px',
                borderRadius: 999,
                border: `1px solid ${value ? '#10b981' : '#cbd5e1'}`,
                background: value ? '#ecfdf5' : '#f8fafc',
                cursor: disabled ? 'not-allowed' : busy ? 'wait' : 'pointer',
                userSelect: 'none',
                fontSize: '0.8125rem',
                fontWeight: 700,
                color: value ? '#065f46' : '#475569',
                opacity: disabled ? 0.6 : busy ? 0.85 : 1,
                transition: 'background 0.15s, border-color 0.15s, opacity 0.15s',
            }}
            title={
                disabled
                    ? 'You do not have permission to change this.'
                    : busy
                        ? 'Saving…'
                        : value
                            ? 'Global auto-approve is ON — all corporate walk-ins skip this queue.'
                            : 'Global auto-approve is OFF — corporate walk-ins follow each account\'s own setting.'
            }
        >
            <input
                type="checkbox"
                checked={!!value}
                disabled={busy || disabled}
                onChange={(e) => { e.stopPropagation(); if (!disabled) onChange?.(); }}
                style={{ display: 'none' }}
            />
            <span style={{
                width: 36, height: 20, borderRadius: 999,
                background: value ? '#10b981' : '#cbd5e1',
                position: 'relative', transition: 'background 0.15s',
            }}>
                <span style={{
                    position: 'absolute', top: 2, left: value ? 18 : 2,
                    width: 16, height: 16, borderRadius: '50%', background: '#fff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.15)', transition: 'left 0.15s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    {busy ? (
                        <Loader size={11} className="spin" style={{ color: value ? '#10b981' : '#64748b' }} />
                    ) : null}
                </span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                Auto-approve corporate walk-ins
                <span style={{
                    fontSize: '0.65rem', fontWeight: 800, padding: '2px 8px', borderRadius: 999,
                    background: busy ? '#64748b' : value ? '#10b981' : '#94a3b8', color: '#fff',
                    minWidth: 36, textAlign: 'center',
                }}>
                    {busy ? 'Saving' : value ? 'ON' : 'OFF'}
                </span>
            </span>
        </label>
    );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                         */
/* ------------------------------------------------------------------ */

export default function ApprovalsPage({ isTab = false, onlySettings = false }) {
    const { hasPermission } = useAuth();

    /**
     * Per-entity-type access helpers.
     *
     * Backward compat: if the user has the parent `approvals.view/approve/reject`
     * permission but NO per-type permissions, we treat them as having all types
     * (so old roles keep working without re-editing). New roles that grant
     * specific per-type permissions enable fine-grained gating.
     */
    const canViewType = useCallback((entityType) => {
        return approvalTypeAllowed(hasPermission, entityType, 'view');
    }, [hasPermission]);
    const canApproveType = useCallback((entityType) => {
        const code = approvalPermission(entityType, 'approve');
        if (!code) return hasPermission('approvals.approve');
        if (hasPermission('approvals.approve') && !hasAnyGranularApprovalTypePermission(hasPermission, 'approve')) {
            return true;
        }
        return hasPermission(code);
    }, [hasPermission]);
    const canRejectType = useCallback((entityType) => {
        const code = approvalPermission(entityType, 'reject');
        if (!code) return hasPermission('approvals.reject');
        if (hasPermission('approvals.reject') && !hasAnyGranularApprovalTypePermission(hasPermission, 'reject')) {
            return true;
        }
        return hasPermission(code);
    }, [hasPermission]);

    const visibleEntityTypes = useMemo(
        () => ENTITY_TYPES.filter(
            (et) => et.value === '' || canViewType(et.value),
        ),
        [canViewType],
    );

    const [currentTab, setCurrentTab] = useState(onlySettings ? 'Settings' : 'Pending');
    const [entityTypeFilter, setEntityTypeFilter] = useState('');
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [actionLoading, setActionLoading] = useState(null);
    const [reloadTick, setReloadTick] = useState(0);

    // dialogs
    const [detailsTarget, setDetailsTarget] = useState(null); // { entityType, id }
    const [approveTarget, setApproveTarget] = useState(null); // item
    const [payTarget, setPayTarget] = useState(null); // marketing_expense awaiting pay
    const [rejectTarget, setRejectTarget] = useState(null);   // item
    const [approveModalError, setApproveModalError] = useState('');

    // toast
    const [toast, setToast] = useState(null);
    const showToast = useCallback((msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    // Global auto-approve master switch for corporate walk-ins. Visible to users
    // who can approve corporate_walk_in_booking; toggling it bypasses this queue
    // for ALL corporate accounts.
    const canManageWalkInToggle = canApproveType('corporate_walk_in_booking');
    const canSeeWalkInToggle = canViewType('corporate_walk_in_booking');
    const [autoApproveWalkIns, setAutoApproveWalkIns] = useState(false);
    const [walkInToggleBusy, setWalkInToggleBusy] = useState(false);

    useEffect(() => {
        if (!canSeeWalkInToggle) return;
        let cancelled = false;
        getWalkInSettings()
            .then((res) => {
                if (!cancelled) setAutoApproveWalkIns(Boolean(res?.autoApproveCorporateWalkIns));
            })
            .catch(() => { /* non-fatal — leave toggle at default OFF */ });
        return () => { cancelled = true; };
    }, [canSeeWalkInToggle]);

    const handleToggleAutoApproveWalkIns = useCallback(async () => {
        const next = !autoApproveWalkIns;
        setWalkInToggleBusy(true);
        setAutoApproveWalkIns(next); // optimistic
        try {
            await updateWalkInSettings({ autoApproveCorporateWalkIns: next });
            showToast(next
                ? 'Corporate walk-ins will now auto-approve globally.'
                : 'Global auto-approval of corporate walk-ins turned off.');
        } catch (err) {
            setAutoApproveWalkIns(!next); // rollback
            showToast(`Could not update setting: ${err.message}`, 'error');
        } finally {
            setWalkInToggleBusy(false);
        }
    }, [autoApproveWalkIns, showToast]);

    const [moduleSettings, setModuleSettings] = useState({
        inventory: { enabled: true, sub: { adjustments: true, transfers: true, uomChanges: false, priceOverrides: true, safetyStock: false } },
        sales: { enabled: true, sub: { invoiceDiscounts: true, salesRefunds: true, creditLimitChanges: false, customerTierUpgrades: true } },
        accounting: { enabled: true, sub: { expenseSubmission: true, paymentVouchers: true, purchaseOrders: true, bankAccountChanges: false } },
        hr: { enabled: true, sub: { newEmployeeEntry: true, salaryAdjustments: true, rolePermissionChanges: true } },
        system: { enabled: false, sub: { databaseBackups: true, thirdPartyIntegrations: false, apiKeyManagement: false } },
    });

    useEffect(() => {
        if (currentTab === 'Settings') return undefined;
        let cancelled = false;
        setLoading(true);
        setError(null);

        const status = TAB_TO_STATUS[currentTab];
        // Skip the corporate-payment-proof fetch when the user has narrowed the
        // entityType filter to something else.
        const wantPaymentApprovals =
            !entityTypeFilter || entityTypeFilter === 'corporate_payment_approval';
        const wantSalesReturns =
            !entityTypeFilter || entityTypeFilter === 'sales_return';
        const wantMarketingTopups =
            !entityTypeFilter || entityTypeFilter === 'marketing_budget_request';
        const wantMarketingPromotions =
            !entityTypeFilter || entityTypeFilter === 'marketing_promotion';
        const wantMarketingPromoCodes =
            !entityTypeFilter || entityTypeFilter === 'marketing_promo_code';

        // When the filter is narrowed to a type handled by a dedicated API, skip std approvals.
        const stdReq = entityTypeFilter === 'corporate_payment_approval' || entityTypeFilter === 'sales_return' || entityTypeFilter === 'marketing_budget_request' || entityTypeFilter === 'marketing_promotion' || entityTypeFilter === 'marketing_promo_code'
            ? Promise.resolve([])
            : listApprovals({ status, entityType: entityTypeFilter })
                .then((data) => unwrapApprovalsListResponse(data).map(normalizeItem))
                .catch((err) => {
                    console.error('Standard approvals load failed:', err);
                    return [];
                });
        const cpaReq = wantPaymentApprovals
            ? listCorporatePaymentApprovals({
                  status: status ?? 'all',
                  limit: 100,
              })
                  .then((res) => {
                      const list = Array.isArray(res?.approvals) ? res.approvals : [];
                      return list.map((r) => ({
                          id: String(r.id),
                          entityType: 'corporate_payment_approval',
                          type: 'corporate_payment_approval',
                          typeLabel: 'Corporate payment proof',
                          status: r.status,
                          title:
                              Array.isArray(r.allocations) && r.allocations.length > 1
                                  ? `Payment proof · ${r.allocations.length} invoices (${r.allocations
                                        .map((a) => a.invoiceNo)
                                        .filter(Boolean)
                                        .slice(0, 3)
                                        .join(', ')}${r.allocations.length > 3 ? '…' : ''})`
                                  : `Payment proof · ${r.invoice?.invoiceNo ?? '#' + r.invoice?.id}`,
                          meta: {
                              companyName: r.corporate?.companyName,
                              invoiceNo: r.invoice?.invoiceNo,
                              invoiceDate: r.invoice?.invoiceDate,
                              workshopName: r.invoice?.workshopName,
                              branchName: r.invoice?.branchName,
                              amount: r.amount,
                              paymentMethod: r.paymentMethod,
                              notes: r.notes,
                              rejectionReason: r.rejectionReason,
                              invoiceTotal: r.invoice?.totalAmount,
                              invoiceBalance: r.invoice?.balance,
                              proofMimeType: r.proofMimeType,
                              allocationsCount: Array.isArray(r.allocations) ? r.allocations.length : null,
                          },
                          submittedBy: r.requestedByUser,
                          reviewer: r.reviewedByUser,
                          date: r.createdAt,
                          reference: r.invoice?.invoiceNo ?? '',
                          raw: r,
                      }));
                  })
                  .catch(() => [])
            : Promise.resolve([]);

        const salesReturnStatus =
            status === 'approved' ? 'completed' : status;
        const srReq = wantSalesReturns && canViewType('sales_return')
            ? getSuperAdminSalesReturns({
                  status: salesReturnStatus ?? undefined,
                  limit: 100,
                  offset: 0,
              })
                  .then((res) => {
                      const list = Array.isArray(res?.items) ? res.items : [];
                      return list.map((sr) => ({
                          id: String(sr.id),
                          entityType: 'sales_return',
                          type: 'sales_return',
                          typeLabel: 'POS sales return',
                          status: sr.status === 'completed' ? 'approved' : sr.status,
                          title: `Sales return · ${sr.returnNo ?? sr.id}`,
                          meta: {
                              returnNo: sr.returnNo,
                              creditNoteNo: sr.creditNoteNo,
                              invoiceNo: sr.invoice?.invoiceNo,
                              workshopName: sr.workshop?.name,
                              branchName: sr.branch?.name,
                              amount: sr.totalAmount,
                              reason: sr.reason,
                              rejectionReason: sr.rejectionReason,
                          },
                          submittedBy: sr.createdBy,
                          date: sr.createdAt ?? sr.returnDate,
                          reference: sr.invoice?.invoiceNo ?? sr.returnNo ?? '',
                          raw: sr,
                      }));
                  })
                  .catch(() => [])
            : Promise.resolve([]);

        const mbrStatus = status ?? 'all';
        const mbrReq = wantMarketingTopups && canViewType('marketing_budget_request')
            ? marketingListBudgetRequests({
                  status: mbrStatus,
                  limit: 100,
                  offset: 0,
              })
                  .then((res) => unwrapMarketingBudgetRequests(res).map(mapMarketingBudgetRequestRow))
                  .catch(() => [])
            : Promise.resolve([]);

        const mprReq = wantMarketingPromotions && canViewType('marketing_promotion')
            ? marketingListPromotions({
                  status: 'all',
                  limit: 200,
                  offset: 0,
              })
                  .then((res) =>
                      unwrapMarketingPromotions(res)
                          .filter((row) => promotionMatchesApprovalTab(row, status))
                          .map(mapMarketingPromotionRow),
                  )
                  .catch((err) => {
                      console.error('Marketing promotions approval load failed:', err);
                      return [];
                  })
            : Promise.resolve([]);

        const mpcReq = wantMarketingPromoCodes && canViewType('marketing_promo_code')
            ? marketingListPromoCodes({
                  status: 'all',
                  limit: 200,
                  offset: 0,
              })
                  .then((res) =>
                      unwrapMarketingPromoCodes(res)
                          .filter((row) => promoCodeMatchesApprovalTab(row, status))
                          .map(mapMarketingPromoCodeRow),
                  )
                  .catch((err) => {
                      console.error('Marketing promo codes approval load failed:', err);
                      return [];
                  })
            : Promise.resolve([]);

        Promise.all([stdReq, cpaReq, srReq, mbrReq, mprReq, mpcReq])
            .then(([stdItems, cpaItems, srItems, mbrItems, mprItems, mpcItems]) => {
                if (cancelled) return;
                const seen = new Set();
                const merged = [...mpcItems, ...mprItems, ...mbrItems, ...srItems, ...cpaItems, ...stdItems].filter((item) => {
                    const key = `${item.entityType}:${item.id}`;
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });
                setItems(merged);
            })
            .catch((err) => {
                if (!cancelled) setError(err.message);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, [currentTab, entityTypeFilter, reloadTick, canViewType]);

    const removeFromList = useCallback((item) => {
        const key = approvalItemKey(item);
        setItems((prev) => prev.filter((i) => approvalItemKey(i) !== key));
    }, []);

    const isCorporatePriceQuotation = (et) =>
        et === 'corporate_price_quotation' || et === 'corporate_price_quotations';
    const isCorporatePaymentApproval = (et) => et === 'corporate_payment_approval';
    const isSalesReturnApproval = (et) => et === 'sales_return';
    const isMarketingBudgetRequest = (et) => et === 'marketing_budget_request';
    const isMarketingPromotion = (et) => et === 'marketing_promotion';
    const isMarketingPromoCode = (et) => et === 'marketing_promo_code';
    const isMarketingExpense = (et) => et === 'marketing_expense';

    useEffect(() => {
        if (approveTarget?.entityType === 'admin_wallet_fund_request' || approveTarget?.entityType === 'admin_wallet_expense_request') {
            setApproveModalError('');
        }
    }, [approveTarget?.entityType, approveTarget?.id]);

    const handleApproveConfirm = async (item, remarksOrPayload) => {
        setActionLoading(approvalItemKey(item));
        setApproveModalError('');
        try {
            const payload =
                typeof remarksOrPayload === 'string'
                    ? (remarksOrPayload.trim() ? { remarks: remarksOrPayload.trim() } : {})
                    : (remarksOrPayload && typeof remarksOrPayload === 'object' ? remarksOrPayload : {});
            if (isCorporatePaymentApproval(item.entityType)) {
                await approveCorporatePaymentApproval(item.id);
            } else if (isSalesReturnApproval(item.entityType)) {
                await approveSuperAdminSalesReturn(item.id);
            } else if (isMarketingBudgetRequest(item.entityType)) {
                await marketingApproveBudgetRequest(item.id, {
                    notes: payload.notes ?? payload.remarks,
                    sourceAccountId: payload.sourceAccountId,
                    sourceAccountName: payload.sourceAccountName,
                });
            } else if (isMarketingPromotion(item.entityType)) {
                await marketingApprovePromotion(item.id, {
                    notes: payload.remarks ?? payload.notes,
                });
            } else if (isMarketingPromoCode(item.entityType)) {
                await marketingApprovePromoCode(item.id, {
                    notes: payload.remarks ?? payload.notes,
                });
            } else if (isMarketingExpense(item.entityType)) {
                await marketingApproveExpense(item.id, {
                    notes: payload.notes ?? payload.remarks,
                    paymentAccountId: payload.paymentAccountId,
                    paymentAccountName: payload.paymentAccountName,
                });
            } else if (isCorporatePriceQuotation(item.entityType)) {
                await approveSuperAdminCorporatePriceQuotation(item.id);
            } else {
                const res = await approveApi(item.entityType, item.id, payload);
                if (res?.awaitingWorkshopAdmin || res?.awaitingSuperAdmin) {
                    showToast(res.message || 'Approval recorded — awaiting the other approver.');
                    setApproveTarget(null);
                    setApproveModalError('');
                    setReloadTick((t) => t + 1);
                    return;
                }
            }
            removeFromList(item);
            setApproveTarget(null);
            setApproveModalError('');
            setDetailsTarget(null);
            setReloadTick((t) => t + 1);
            const postedToCao =
                isMarketingBudgetRequest(item.entityType) || isMarketingExpense(item.entityType);
            showToast(
                postedToCao
                    ? 'Approved and posted to Chart of Accounts.'
                    : (item.entityType === 'admin_wallet_fund_request' || item.entityType === 'admin_wallet_expense_request')
                        ? 'Request approved and posted.'
                        : 'Request approved.',
            );
        } catch (err) {
            if (item.entityType === 'admin_wallet_fund_request' || item.entityType === 'admin_wallet_expense_request') {
                setApproveModalError(err?.message || 'Approve failed');
            } else {
                showToast(`Approve failed: ${err.message}`, 'error');
            }
        } finally {
            setActionLoading(null);
        }
    };

    const handleRejectConfirm = async (item, reason) => {
        setActionLoading(approvalItemKey(item));
        try {
            if (isCorporatePaymentApproval(item.entityType)) {
                await rejectCorporatePaymentApproval(item.id, reason);
            } else if (isSalesReturnApproval(item.entityType)) {
                await rejectSuperAdminSalesReturn(item.id, reason);
            } else if (isMarketingBudgetRequest(item.entityType)) {
                await marketingRejectBudgetRequest(item.id, { rejectionReason: reason });
            } else if (isMarketingPromotion(item.entityType)) {
                await marketingRejectPromotion(item.id, { reason: reason ?? '' });
            } else if (isMarketingPromoCode(item.entityType)) {
                await marketingRejectPromoCode(item.id, { reason: reason ?? '' });
            } else if (isMarketingExpense(item.entityType)) {
                await marketingRejectExpense(item.id, { rejectionReason: reason ?? '' });
            } else if (isCorporatePriceQuotation(item.entityType)) {
                await rejectSuperAdminCorporatePriceQuotation(item.id, { reason });
            } else {
                await rejectApi(item.entityType, item.id, reason);
            }
            removeFromList(item);
            setRejectTarget(null);
            setDetailsTarget(null);
            setReloadTick((t) => t + 1);
            showToast('Request rejected.');
        } catch (err) {
            showToast(`Reject failed: ${err.message}`, 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const handlePayConfirm = async (item, payload) => {
        if (!item || item.entityType !== 'marketing_expense') return;
        setActionLoading(approvalItemKey(item));
        try {
            await marketingPayExpense(item.id, {
                notes: payload.notes ?? payload.remarks,
                paymentAccountId: payload.paymentAccountId,
                paymentAccountName: payload.paymentAccountName,
            });
            removeFromList(item);
            setPayTarget(null);
            setDetailsTarget(null);
            setReloadTick((t) => t + 1);
            showToast('Expense paid and posted to Chart of Accounts.');
        } catch (err) {
            showToast(`Pay failed: ${err.message}`, 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const handlePayExpense = (item) => {
        if (!item || item.entityType !== 'marketing_expense') return;
        setPayTarget(item);
    };

    const toggleModule = (module) => {
        setModuleSettings((prev) => ({ ...prev, [module]: { ...prev[module], enabled: !prev[module].enabled } }));
    };

    const toggleSubModule = (module, sub) => {
        setModuleSettings((prev) => ({
            ...prev,
            [module]: { ...prev[module], sub: { ...prev[module].sub, [sub]: !prev[module].sub[sub] } },
        }));
    };

    const getTypeIcon = (type) => {
        switch (type) {
            case 'promotion': return <Tag size={14} />;
            case 'expense': return <DollarSign size={14} />;
            case 'purchase': return <ShoppingCart size={14} />;
            case 'inventory': return <Package size={14} />;
            case 'refund': return <RefreshCcw size={14} />;
            case 'transfer': return <ArrowRightLeft size={14} />;
            case 'sales': return <CreditCard size={14} />;
            case 'accounting': return <DollarSign size={14} />;
            case 'hr': return <Users size={14} />;
            case 'system': return <Settings size={14} />;
            case 'workshop':
            case 'supplier':
            case 'corporate':
            case 'corporate_price_quotation':
            case 'corporate_price_quotations':
            case 'technician':
            case 'branch_creation':
                return <Building2 size={14} />;
            case 'cashier':
                return <CreditCard size={14} />;
            case 'workshop_portal_staff':
                return <Users size={14} />;
            case 'corporate_payment_approval':
                return <DollarSign size={14} />;
            case 'sales_return':
                return <RefreshCcw size={14} />;
            case 'marketing_promotion':
            case 'marketing_campaign':
            case 'marketing_expense':
            case 'marketing_promo_code':
            case 'marketing_budget_request':
            case 'admin_wallet_fund_request':
            case 'admin_wallet_expense_request':
                return <Tag size={14} />;
            default:
                return <FileText size={14} />;
        }
    };

    // Pending is always available when the parent `approvals.view` is granted
    // (sidebar gate already enforces this). The 3 history tabs require their
    // own per-tab view permissions — admin can grant any subset.
    const tabs = [
        { key: 'Pending',  show: true },
        { key: 'Approved', show: hasPermission('approvals.approved-history.view') },
        { key: 'Rejected', show: hasPermission('approvals.rejected-history.view') },
        { key: 'All',      show: hasPermission('approvals.all-history.view') },
    ].filter((t) => t.show);

    // If user lands on a hidden tab (perms changed mid-session), snap back to Pending.
    useEffect(() => {
        if (currentTab === 'Settings') return;
        if (!tabs.some((t) => t.key === currentTab)) {
            setCurrentTab(tabs[0]?.key ?? 'Pending');
        }
    }, [tabs, currentTab]);

    const content = (
        <>
            <Toast toast={toast} />

            {!onlySettings && (
                <div className="tabs-container">
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            className={`tab-item ${currentTab === tab.key ? 'active' : ''}`}
                            onClick={() => setCurrentTab(tab.key)}
                        >
                            {tab.key}
                        </button>
                    ))}
                </div>
            )}

            {currentTab !== 'Settings' && (
                <div className="approvals-filter-bar">
                    <select
                        className="entity-type-filter"
                        value={entityTypeFilter}
                        onChange={(e) => setEntityTypeFilter(e.target.value)}
                    >
                        {visibleEntityTypes.map((et) => (
                            <option key={et.value} value={et.value}>{et.label}</option>
                        ))}
                    </select>
                    <button
                        type="button"
                        className="btn-view-details approvals-refresh-btn"
                        onClick={() => setReloadTick((t) => t + 1)}
                        disabled={loading}
                    >
                        <RefreshCcw size={14} className={loading ? 'spin' : ''} /> Refresh
                    </button>
                    {canSeeWalkInToggle && (
                        <GlobalAutoApproveToggle
                            value={autoApproveWalkIns}
                            busy={walkInToggleBusy}
                            disabled={!canManageWalkInToggle}
                            onChange={handleToggleAutoApproveWalkIns}
                        />
                    )}
                </div>
            )}

            {currentTab === 'Settings' && (
                <div className="approval-settings-grid hyper-detailed">
                    {Object.entries(moduleSettings).map(([module, data]) => (
                        <div key={module} className="settings-group-container secondary">
                            <div className="settings-card main-toggle-premium">
                                <div className="settings-info-premium">
                                    <div className={`settings-icon-wrapper-large type-${module}`}>
                                        {getTypeIcon(module)}
                                    </div>
                                    <div className="settings-text-block">
                                        <h4 className="settings-module-name-large">
                                            {module === 'hr' ? 'Human Resources' : module.charAt(0).toUpperCase() + module.slice(1)}
                                        </h4>
                                        <p className="settings-module-desc-premium">
                                            Manage granular approval requirements for {module} actions.
                                        </p>
                                    </div>
                                </div>
                                <div className="main-toggle-wrapper">
                                    <span className={`toggle-status-label ${data.enabled ? 'enabled' : 'disabled'}`}>
                                        {data.enabled ? 'ACTIVE' : 'DISABLED'}
                                    </span>
                                    <label className="switch premium">
                                        <input type="checkbox" checked={data.enabled} onChange={() => toggleModule(module)} />
                                        <span className="slider round"></span>
                                    </label>
                                </div>
                            </div>
                            {data.enabled && (
                                <div className="sub-settings-grid-premium">
                                    {Object.entries(data.sub).map(([subKey, subEnabled]) => (
                                        <div key={subKey} className="sub-setting-card-premium">
                                            <div className="sub-setting-header-premium">
                                                <span className="sub-setting-name-premium">
                                                    {subKey.charAt(0).toUpperCase() + subKey.slice(1).replace(/([A-Z])/g, ' $1')}
                                                </span>
                                                <label className="switch small-premium">
                                                    <input type="checkbox" checked={subEnabled} onChange={() => toggleSubModule(module, subKey)} />
                                                    <span className="slider round"></span>
                                                </label>
                                            </div>
                                            <p className="sub-setting-info-text">Requires manual admin review for this action.</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {currentTab !== 'Settings' && loading && (
                <div className="empty-state-card">
                    <Loader size={24} className="spin" />
                    <p className="empty-desc">Loading approvals…</p>
                </div>
            )}

            {currentTab !== 'Settings' && !loading && error && (
                <div className="empty-state-card">
                    <AlertCircle size={24} />
                    <p className="empty-status">Failed to load</p>
                    <p className="empty-desc">{error}</p>
                </div>
            )}

            {currentTab !== 'Settings' && !loading && !error && items.length > 0 && (
                <div className="approval-cards">
                    {items.filter((item) => canViewType(item.entityType)).map((item) => {
                        const chips = buildMetaChips(item);
                        const allowApprove = canApproveType(item.entityType);
                        const allowReject = canRejectType(item.entityType);
                        return (
                            <div key={item.id} className="approval-card">
                                <div className="approval-card-header">
                                    <span className={`approval-type-badge type-${item.type}`}>
                                        {getTypeIcon(item.type)} {item.typeLabel}
                                    </span>
                                    <div className="header-right">
                                        <span className={`approval-status-badge status-${item.status}`}>{item.status}</span>
                                    </div>
                                </div>
                                <h3 className="approval-card-title">{item.title}</h3>
                                <div className="approval-card-meta">
                                    <span><User size={14} /> {fmtPerson(item.submittedBy)}</span>
                                    <span><Calendar size={14} /> {formatDate(item.date)}</span>
                                    {item.reviewer && (
                                        <span className="approval-reviewer">
                                            Reviewer: {fmtPerson(item.reviewer)}
                                        </span>
                                    )}
                                    {item.reference && (
                                        <span className="reference-badge">Ref: {item.reference}</span>
                                    )}
                                </div>
                                {chips.length > 0 && (
                                    <div className="approval-card-chips">
                                        {chips.map((chip, idx) => (
                                            <span key={`${chip.label}-${idx}`} className="approval-chip">
                                                <span className="approval-chip-label">{chip.label}</span>
                                                <span className="approval-chip-value">{chip.value}</span>
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <div className="approval-card-actions">
                                    {item.status === 'pending' && (
                                        <>
                                            {allowApprove && (
                                                <button
                                                    type="button"
                                                    className="btn-approve"
                                                    disabled={actionLoading === approvalItemKey(item)}
                                                    onClick={() => setApproveTarget(item)}
                                                >
                                                    {actionLoading === approvalItemKey(item) ? <Loader size={14} className="spin" /> : <Check size={16} />} Approve
                                                </button>
                                            )}
                                            {allowReject && (
                                                <button
                                                    type="button"
                                                    className="btn-reject"
                                                    disabled={actionLoading === approvalItemKey(item)}
                                                    onClick={() => setRejectTarget(item)}
                                                >
                                                    {actionLoading === approvalItemKey(item) ? <Loader size={14} className="spin" /> : <X size={16} />} Reject
                                                </button>
                                            )}
                                        </>
                                    )}
                                    <button
                                        type="button"
                                        className="btn-view-details"
                                        onClick={() => setDetailsTarget({ entityType: item.entityType, id: item.id, item })}
                                    >
                                        <Eye size={16} /> Details
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {currentTab !== 'Settings' && !loading && !error && items.length === 0 && (
                <div className="empty-state-card">
                    <p className="empty-status">0 {currentTab.toLowerCase()} items</p>
                    <p className="empty-desc">
                        {currentTab === 'Pending'
                            ? 'Nothing is waiting for review right now.'
                            : 'Nothing to show in this tab.'}
                    </p>
                </div>
            )}

            {detailsTarget && detailsTarget.entityType === 'corporate_payment_approval' && (
                <CorporatePaymentApprovalDetailsModal
                    id={detailsTarget.id}
                    item={detailsTarget.item}
                    onClose={() => setDetailsTarget(null)}
                    onApprove={canApproveType(detailsTarget.entityType) ? () => setApproveTarget(detailsTarget.item) : undefined}
                    onReject={canRejectType(detailsTarget.entityType) ? () => setRejectTarget(detailsTarget.item) : undefined}
                />
            )}

            {detailsTarget && detailsTarget.entityType === 'sales_return' && (
                <SalesReturnApprovalDetailsModal
                    id={detailsTarget.id}
                    item={detailsTarget.item}
                    onClose={() => setDetailsTarget(null)}
                    onApprove={canApproveType(detailsTarget.entityType) ? () => setApproveTarget(detailsTarget.item) : undefined}
                    onReject={canRejectType(detailsTarget.entityType) ? () => setRejectTarget(detailsTarget.item) : undefined}
                />
            )}

            {detailsTarget && detailsTarget.entityType === 'marketing_budget_request' && (
                <MarketingBudgetRequestDetailsModal
                    id={detailsTarget.id}
                    item={detailsTarget.item}
                    onClose={() => setDetailsTarget(null)}
                    onApprove={canApproveType(detailsTarget.entityType) ? () => setApproveTarget(detailsTarget.item) : undefined}
                    onReject={canRejectType(detailsTarget.entityType) ? () => setRejectTarget(detailsTarget.item) : undefined}
                />
            )}

            {detailsTarget && detailsTarget.entityType === 'admin_wallet_fund_request' && (
                <AdminWalletFundRequestDetailsModal
                    id={detailsTarget.id}
                    item={detailsTarget.item}
                    onClose={() => setDetailsTarget(null)}
                    onApprove={canApproveType(detailsTarget.entityType) ? () => setApproveTarget(detailsTarget.item) : undefined}
                    onReject={canRejectType(detailsTarget.entityType) ? () => setRejectTarget(detailsTarget.item) : undefined}
                />
            )}

            {detailsTarget && detailsTarget.entityType === 'admin_wallet_expense_request' && (
                <AdminWalletExpenseRequestDetailsModal
                    id={detailsTarget.id}
                    item={detailsTarget.item}
                    onClose={() => setDetailsTarget(null)}
                    onApprove={canApproveType(detailsTarget.entityType) ? () => setApproveTarget(detailsTarget.item) : undefined}
                    onReject={canRejectType(detailsTarget.entityType) ? () => setRejectTarget(detailsTarget.item) : undefined}
                />
            )}

            {detailsTarget && detailsTarget.entityType === 'marketing_expense' && (
                <MarketingExpenseDetailsModal
                    id={detailsTarget.id}
                    item={detailsTarget.item}
                    onClose={() => setDetailsTarget(null)}
                    onApprove={canApproveType(detailsTarget.entityType) ? () => setApproveTarget(detailsTarget.item) : undefined}
                    onReject={canRejectType(detailsTarget.entityType) ? () => setRejectTarget(detailsTarget.item) : undefined}
                    onPay={canApproveType(detailsTarget.entityType) ? () => handlePayExpense(detailsTarget.item) : undefined}
                    payBusy={actionLoading === approvalItemKey(detailsTarget.item ?? { entityType: detailsTarget.entityType, id: detailsTarget.id })}
                />
            )}

            {detailsTarget && detailsTarget.entityType === 'marketing_promotion' && (
                <MarketingPromotionDetailsModal
                    id={detailsTarget.id}
                    item={detailsTarget.item}
                    onClose={() => setDetailsTarget(null)}
                    onApprove={canApproveType(detailsTarget.entityType) ? () => setApproveTarget(detailsTarget.item) : undefined}
                    onReject={canRejectType(detailsTarget.entityType) ? () => setRejectTarget(detailsTarget.item) : undefined}
                />
            )}

            {detailsTarget
                && detailsTarget.entityType !== 'corporate_payment_approval'
                && detailsTarget.entityType !== 'sales_return'
                && detailsTarget.entityType !== 'marketing_budget_request'
                && detailsTarget.entityType !== 'admin_wallet_fund_request'
                && detailsTarget.entityType !== 'admin_wallet_expense_request'
                && detailsTarget.entityType !== 'marketing_expense'
                && detailsTarget.entityType !== 'marketing_promotion' && (
                <ApprovalDetailsModal
                    entityType={detailsTarget.entityType}
                    id={detailsTarget.id}
                    onClose={() => setDetailsTarget(null)}
                    actionDisabled={actionLoading === approvalItemKey(detailsTarget.item ?? { entityType: detailsTarget.entityType, id: detailsTarget.id })}
                    canApprove={canApproveType(detailsTarget.entityType)}
                    canReject={canRejectType(detailsTarget.entityType)}
                    onApprove={(data) => {
                        const idStr = toStringId(
                            data?.requestId ?? data?.id ?? detailsTarget.id,
                        );
                        const existing = detailsTarget.item;
                        const title =
                            data?.corporateAccount?.companyName ??
                            data?.title ??
                            existing?.title ??
                            data?.meta?.companyName ??
                            'this request';
                        const branchesRaw =
                            data?.corporateAccount?.selectedBranchIds ??
                            existing?.meta?.selectedBranchIds ??
                            data?.meta?.selectedBranchIds ??
                            [];
                        const selectedBranchIds = Array.isArray(branchesRaw)
                            ? branchesRaw.map((x) => String(x))
                            : [];
                        setApproveTarget({
                            id: idStr,
                            entityType: detailsTarget.entityType,
                            title,
                            meta: {
                                ...(existing?.meta || {}),
                                ...(data?.meta || {}),
                                selectedBranchIds,
                            },
                        });
                    }}
                    onReject={(data) => {
                        const target = detailsTarget.item ?? {
                            id: toStringId(data?.requestId ?? data?.id),
                            entityType: detailsTarget.entityType,
                            title: data?.title ?? data?.meta?.companyName ?? data?.meta?.name ?? 'this request',
                        };
                        setRejectTarget(target);
                    }}
                />
            )}

            {approveTarget && approveTarget.entityType === 'corporate_registration' ? (
                <CorporateApproveModal
                    item={approveTarget}
                    busy={actionLoading === approvalItemKey(approveTarget)}
                    onCancel={() => setApproveTarget(null)}
                    onConfirm={(payload) => handleApproveConfirm(approveTarget, payload)}
                />
            ) : approveTarget && approveTarget.entityType === 'admin_wallet_fund_request' ? (
                <AdminWalletFundApproveModal
                    item={approveTarget}
                    busy={actionLoading === approvalItemKey(approveTarget)}
                    error={approveModalError}
                    onCancel={() => {
                        setApproveTarget(null);
                        setApproveModalError('');
                    }}
                    onConfirm={(payload) => handleApproveConfirm(approveTarget, payload)}
                />
            ) : approveTarget && approveTarget.entityType === 'admin_wallet_expense_request' ? (
                <AdminWalletExpenseApproveModal
                    item={approveTarget}
                    busy={actionLoading === approvalItemKey(approveTarget)}
                    error={approveModalError}
                    onCancel={() => {
                        setApproveTarget(null);
                        setApproveModalError('');
                    }}
                    onConfirm={(payload) => handleApproveConfirm(approveTarget, payload)}
                />
            ) : approveTarget
                && (isMarketingBudgetRequest(approveTarget.entityType)
                    || isMarketingExpense(approveTarget.entityType)) ? (
                <MarketingPaymentApproveModal
                    item={approveTarget}
                    busy={actionLoading === approvalItemKey(approveTarget)}
                    onCancel={() => setApproveTarget(null)}
                    onConfirm={(payload) => handleApproveConfirm(approveTarget, payload)}
                />
            ) : approveTarget ? (
                <ApproveModal
                    item={approveTarget}
                    busy={actionLoading === approvalItemKey(approveTarget)}
                    onCancel={() => setApproveTarget(null)}
                    onConfirm={(remarks) => handleApproveConfirm(approveTarget, remarks)}
                />
            ) : null}

            {payTarget && payTarget.entityType === 'marketing_expense' && (
                <MarketingPaymentApproveModal
                    item={payTarget}
                    mode="pay"
                    busy={actionLoading === approvalItemKey(payTarget)}
                    onCancel={() => setPayTarget(null)}
                    onConfirm={(payload) => handlePayConfirm(payTarget, payload)}
                />
            )}

            {rejectTarget && (
                <RejectModal
                    item={rejectTarget}
                    busy={actionLoading === approvalItemKey(rejectTarget)}
                    onCancel={() => setRejectTarget(null)}
                    onConfirm={(reason) => handleRejectConfirm(rejectTarget, reason)}
                />
            )}
        </>
    );

    if (isTab) return content;

    return (
        <div className="approvals-page module-container">
            {content}
        </div>
    );
}
