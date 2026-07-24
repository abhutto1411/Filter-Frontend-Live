import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clock, CheckCircle, X, Eye, RefreshCw, FileText, Check, Loader } from 'lucide-react';
import WorkshopSubScreen from '../../components/workshop/WorkshopSubScreen';
import WsTableScroll from '../../components/workshop/WsTableScroll';
import { ShimmerTableBodyRows, ShimmerTextBlock } from '../../components/supplier/Shimmer';
import WorkshopPurchaseInvoiceView from '../../components/supplier/WorkshopPurchaseInvoiceView';
import WorkshopPurchaseReturnDetailView from '../../components/workshop/WorkshopPurchaseReturnDetailView';
import Modal from '../../components/Modal';
import WalletApprovalAccountFields from '../../components/admin/WalletApprovalAccountFields';
import { apiFetch } from '../../services/api';
import { buildReceivedQtyByInvoiceItemIdPayload } from '../../utils/receivedQtyPayload';
import { qs, branchScopeParams, getWorkshopSalesReturns, approveWorkshopSalesReturn, rejectWorkshopSalesReturn, listWorkshopCashBankAccounts, listAffiliatedPurchaseReturns, getAffiliatedPurchaseReturn, approveAffiliatedPurchaseReturn } from '../../services/workshopStaffApi';
import { approveExpenseRequest, rejectExpenseRequest } from '../../services/employeeExpenseApi';
import { useAuth } from '../../context/AuthContext';

function loadWorkshopRequesterWallet({ userId, currencyCode }) {
    return apiFetch(
        `/workshop-staff/admin-wallet-approvals/requester-wallet-balance${qs({
            userId,
            currencyCode: currencyCode || 'SAR',
        })}`,
    ).then((res) => ({ balance: Number(res?.balance ?? 0) }));
}

function cashBankRegisterKindLabel(row) {
    const kind = String(row?.kind || 'OPERATING');
    if (kind === 'SYSTEM_LOCKER_VAULT') return 'Locker vault';
    if (kind === 'SYSTEM_CASHIER_TILL') return 'Cashier till';
    if (kind === 'SYSTEM_PETTY_CASH_WALLET') return 'Petty cash wallet';
    const type = String(row?.type || row?.apiType || '').toUpperCase();
    if (type === 'BANK') return 'Bank';
    if (type === 'PETTY_CASH') return 'Petty cash';
    return 'Cash';
}

function normalizeWorkshopPayFromAccounts(res) {
    const list = Array.isArray(res?.accounts)
        ? res.accounts
        : Array.isArray(res?.data?.accounts)
            ? res.data.accounts
            : [];
    return list.map((row) => {
        const id = String(row.id);
        const name = row.name || 'Account';
        const kindLabel = cashBankRegisterKindLabel(row);
        const balance = Number(row.currentBalance ?? row.balance ?? 0);
        const formatted = balance.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
        return {
            id,
            name,
            kindLabel,
            kind: row.kind || '',
            type: row.type || '',
            branchId: row.branchId != null ? String(row.branchId) : '',
            branchName: row.branchName || row.branch?.name || '',
            label: `${name} (${kindLabel}) — SAR ${formatted}`,
            balance,
        };
    });
}

function loadWorkshopCashAccounts() {
    return listWorkshopCashBankAccounts({ status: 'active' }).then(normalizeWorkshopPayFromAccounts);
}

function loadWorkshopBudgetAccounts({ branchId }) {
    return apiFetch(
        `/workshop-staff/admin-wallet-approvals/budget-accounts${qs({ branchId })}`,
    ).then((res) => (Array.isArray(res?.accounts) ? res.accounts : []));
}

function AdminWalletWorkshopApproveModal({ row, mode, busy, error, onCancel, onConfirm }) {
    const [remarks, setRemarks] = useState('');
    const [acct, setAcct] = useState({ blocked: true, loading: true });
    const branchId = row?.branchId != null ? String(row.branchId) : '';
    const branchName = row?.branchName || 'this branch';
    const requesterName = row?.cashier?.name || row?.requestedBy || 'Platform admin';
    const amount = Number(row?.amount ?? 0);
    const isExpense = mode === 'expense';
    const displayError = error || acct.blockReason;

    return (
        <Modal
            title={isExpense ? 'Approve Platform Admin Expense' : 'Approve Platform Admin Fund Request'}
            onClose={busy ? undefined : onCancel}
            width={520}
            footer={(
                <>
                    <button type="button" className="btn-secondary" disabled={busy} onClick={onCancel}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="btn-submit btn-dark"
                        disabled={busy || acct.blocked}
                        onClick={() => onConfirm({
                            remarks: remarks.trim() || undefined,
                            ...(isExpense && acct.paymentSource === 'wallet'
                                ? {}
                                : {
                                    sourceAccountId: acct.sourceAccountId,
                                    sourceAccountName: acct.sourceAccountName,
                                }),
                            ...(isExpense
                                ? {
                                    budgetAccountId: acct.budgetAccountId,
                                    budgetAccountName: acct.budgetAccountName,
                                }
                                : {}),
                        })}
                    >
                        {busy ? <Loader size={14} className="spin" /> : <Check size={16} />}
                        {' '}
                        {isExpense ? 'Approve Expense' : 'Approve & Post Journal'}
                    </button>
                </>
            )}
        >
            {displayError ? (
                <p className="form-help-text" style={{ color: '#B45309', marginBottom: 12 }} role="alert">
                    {displayError}
                </p>
            ) : null}
            <p style={{ margin: '0 0 14px', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                Approve {isExpense ? 'expense' : 'fund request'} for <strong>{requesterName}</strong> at branch{' '}
                <strong>{branchName}</strong>. Amount{' '}
                <strong>SAR {amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>{' '}
                {isExpense
                    ? 'will be drawn from the selected budget account.'
                    : 'will be credited to their wallet from the selected payment account.'}
            </p>
            {row?.description ? (
                <p style={{ margin: '0 0 14px', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                    {isExpense ? 'Details' : 'Purpose'}: <strong>{row.description}</strong>
                </p>
            ) : null}

            <WalletApprovalAccountFields
                workshopId={row?.workshopId != null ? String(row.workshopId) : ''}
                branchId={branchId}
                amount={amount}
                mode={mode}
                busy={busy}
                requesterUserId={isExpense ? String(row?.adminUserId ?? '') : ''}
                requesterName={isExpense ? (row?.adminUserName || requesterName) : ''}
                currencyCode={row?.currencyCode ?? 'SAR'}
                loadCashAccounts={loadWorkshopCashAccounts}
                loadBudgetAccounts={loadWorkshopBudgetAccounts}
                loadRequesterWalletBalance={isExpense ? loadWorkshopRequesterWallet : undefined}
                onChange={setAcct}
            />

            <label className="form-label" htmlFor="ws-admin-wallet-approve-remarks" style={{ marginTop: 14 }}>
                Remarks <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span>
            </label>
            <textarea
                id="ws-admin-wallet-approve-remarks"
                className="form-input-field"
                rows={3}
                placeholder="e.g. Approved for branch petty cash float."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                disabled={busy}
            />
        </Modal>
    );
}

function isSalesReturnRow(row) {
    return row?._source === 'sales_return';
}

function isAffiliatedPurchaseReturnRow(row) {
    return row?._source === 'affiliated_purchase_return';
}

function formatAdminWalletApproverSummary(row) {
    if (String(row?.status || '').toLowerCase() !== 'approved') return null;
    const parts = [];
    if (row.superAdminApprovedByName?.trim()) {
        parts.push(`Super Admin: ${row.superAdminApprovedByName.trim()}`);
    }
    if (row.workshopAdminApprovedByName?.trim()) {
        parts.push(`Workshop Admin: ${row.workshopAdminApprovedByName.trim()}`);
    }
    if (parts.length > 0) return parts.join(' · ');
    return row.approvedByName?.trim() || null;
}

function isAdminWalletFundRow(row) {
    return row?.kind === 'admin_wallet_fund';
}

function isAdminWalletExpenseRow(row) {
    return row?.kind === 'admin_wallet_expense';
}

function approvalTypeKey(row) {
    if (isSupplierSalesInvoiceRow(row)) return 'supplier-invoice';
    if (isAffiliatedPurchaseReturnRow(row)) return 'supplier-invoice';
    if (isSalesReturnRow(row)) return 'sales-return';
    if (isAdminWalletFundRow(row)) return 'top-up';
    if (isAdminWalletExpenseRow(row)) return 'expense';
    if (isTopUpRequest(row)) return 'top-up';
    if (isExpenseRequest(row)) return 'expense';
    return null;
}

function resolveSupplierInvoiceLineUnit(it) {
    return (
        String(it?.unit ?? '').trim() ||
        String(it?.supplierProduct?.warehouseUnit ?? '').trim() ||
        String(it?.warehouseUnit ?? '').trim() ||
        'pcs'
    );
}

/**
 * Map a supplier sales invoice (as returned by GET
 * /workshop-staff/supplier-sales-invoices/:id) to the field shape consumed by
 * `WorkshopPurchaseInvoiceView` so we can render the same printable invoice
 * the workshop sees in Purchases. Field aliases are duplicated (snake + camel)
 * so the template's `pick(...)` helper finds them regardless of casing.
 */
function mapSupplierInvoiceToPrintableDetail(inv) {
    if (!inv || typeof inv !== 'object') return {};
    const items = Array.isArray(inv.items) ? inv.items : [];
    const branchName = inv.branch?.name ?? '';
    const supplierName = inv.supplier?.name ?? '';
    return {
        id: inv.id,
        invoiceNumber: inv.invoiceNo,
        invoiceNo: inv.invoiceNo,
        issueDate: inv.invoiceDate,
        invoiceDate: inv.invoiceDate,
        dueDate: inv.dueDate,
        status: inv.status,
        workshopName: branchName,
        branchName,
        branch: inv.branch,
        workshop: inv.workshop,
        supplierName,
        supplierLegalName: supplierName,
        vendorName: supplierName,
        vendor_name: supplierName,
        supplier: inv.supplier,
        vendorInvoiceRef: inv.deliveryNoteUrl ?? '',
        vendorRef: inv.deliveryNoteUrl ?? '',
        subtotalExVat: inv.subtotal,
        subtotal: inv.subtotal,
        vatAmount: inv.vatAmount,
        totalVat: inv.vatAmount,
        grandTotal: inv.grandTotal,
        total: inv.grandTotal,
        amountPaid: inv.paid,
        paidAmount: inv.paid,
        balanceDue: inv.outstanding,
        balance: inv.outstanding,
        paymentStatus:
            Number(inv.paid) >= Number(inv.grandTotal) && Number(inv.grandTotal) > 0
                ? 'paid'
                : 'unpaid',
        notes: inv.internalNotes ?? '',
        description: inv.deliveryNoteUrl ?? '',
        items: items.map((it) => {
            const lineUnit = resolveSupplierInvoiceLineUnit(it);
            return {
            id: it.id,
            productName: it.productName,
            product_name: it.productName,
            productNameArabic: it.productNameArabic ?? it.product?.arabicName ?? null,
            product_name_arabic: it.productNameArabic ?? it.product?.arabicName ?? null,
            product: it.product
                ? {
                      name: it.product.name,
                      arabicName: it.productNameArabic ?? it.product.arabicName ?? null,
                  }
                : null,
            qty: it.qty,
            quantity: it.qty,
            qtyReturned: Number(it.qtyReturned ?? 0),
            unit: lineUnit,
            uom: lineUnit,
            warehouseUnit: it.supplierProduct?.warehouseUnit ?? it.warehouseUnit ?? null,
            qtyWorkshop: it.qtyWorkshop ?? null,
            workshopUnit: it.workshopUnit ?? it.supplierProduct?.workshopUnit ?? null,
            unitPrice: it.unitPrice,
            unit_price: it.unitPrice,
            unitPriceExVat: it.unitPrice,
            vatRate: it.vatRate,
            vat_rate: it.vatRate,
            lineTotal: it.lineTotal,
            line_total: it.lineTotal,
        };
        }),
    };
}

/** Petty-cash / approval request kinds → fixed UI buckets */
function requestKindKey(row) {
    return String(row?.kind ?? row?.type ?? '')
        .trim()
        .toLowerCase();
}

function isSupplierSalesInvoiceRow(row) {
    return row?._source === 'supplier_sales_invoice';
}

function isTopUpRequest(row) {
    if (isSupplierSalesInvoiceRow(row)) return false;
    const k = requestKindKey(row);
    return k === 'fund_request' || k === 'fund' || k === 'top_up' || k === 'topup' || k === 'reload';
}

function isExpenseRequest(row) {
    if (isSupplierSalesInvoiceRow(row)) return false;
    const k = requestKindKey(row);
    return k === 'expense' || k === 'expenses';
}

function formatRequestKindLabel(row) {
    if (isSupplierSalesInvoiceRow(row)) return 'Supplier invoice';
    if (isAffiliatedPurchaseReturnRow(row)) return 'Purchase return';
    if (isSalesReturnRow(row)) return 'Sales return';
    if (isAdminWalletFundRow(row)) return 'Platform admin fund';
    if (isAdminWalletExpenseRow(row)) return 'Platform admin expense';
    const kind = row?.kind ?? row?.type;
    const k = String(kind || '')
        .trim()
        .toLowerCase();
    if (isTopUpRequest({ kind })) return 'Top up';
    if (isExpenseRequest({ kind })) return 'Expense';
    if (!kind) return '—';
    return String(kind).replace(/_/g, ' ');
}

function rowMatchesBranch(row, branchId, branchName = '') {
    if (branchId == null || branchId === '' || branchId === 'all') return true;
    const bid = String(branchId);
    const direct = row?.branchId ?? row?.branch_id;
    if (direct != null && String(direct) === bid) return true;
    const nested = row?.branch?.id;
    if (nested != null && String(nested) === bid) return true;
    if (branchName && String(row.branchName ?? row.branch_name ?? '').trim() === branchName) return true;
    return false;
}

/** Map UI queue filter → petty-cash API (queue + status). */
function pettyCashListQuery(queueFilter, branchSelected) {
    const branch = branchScopeParams(branchSelected);
    const base = { limit: 100, offset: 0, queue: 'all', ...branch };
    if (queueFilter === 'pending') return { ...base, status: 'pending' };
    if (queueFilter === 'approved') return { ...base, status: 'approved' };
    if (queueFilter === 'rejected') return { ...base, status: 'rejected' };
    return base;
}

export default function WorkshopApprovals({
    selectedBranchId = 'all',
    branches = [],
    /** When set, user is locked to one branch — supplier invoices are scoped to it. */
    branchLockedId = null,
    workshopId = null,
}) {
    const expenseScope = workshopId ? { workshopId: String(workshopId) } : {};
    const { hasPermission } = useAuth();
    /** Per-type approval helpers — fall back to parent codes for backward compat. */
    const canViewType = useCallback((row) => {
        const k = approvalTypeKey(row);
        if (!k) return true;
        return (
            hasPermission(`workshop.approvals.${k}.view`) ||
            hasPermission('workshop.approvals.view')
        );
    }, [hasPermission]);
    const canApproveType = useCallback((row) => {
        const k = approvalTypeKey(row);
        if (!k) return hasPermission('workshop.approvals.approve');
        return (
            hasPermission(`workshop.approvals.${k}.approve`) ||
            hasPermission('workshop.approvals.approve')
        );
    }, [hasPermission]);
    const canRejectType = useCallback((row) => {
        const k = approvalTypeKey(row);
        if (!k) return hasPermission('workshop.approvals.reject');
        return (
            hasPermission(`workshop.approvals.${k}.reject`) ||
            hasPermission('workshop.approvals.reject')
        );
    }, [hasPermission]);

    const scopeBranchName = useMemo(() => {
        if (!selectedBranchId || selectedBranchId === 'all') return '';
        return branches.find((b) => String(b.id) === String(selectedBranchId))?.name || '';
    }, [branches, selectedBranchId]);
    const [approvals, setApprovals] = useState([]);
    /** all | topup | expenses | supplier_invoices */
    const [requestTypeFilter, setRequestTypeFilter] = useState('all');
    const [queueFilter, setQueueFilter] = useState('all');
    const [rejectDialog, setRejectDialog] = useState(null);
    const [rejectReason, setRejectReason] = useState('');
    const [viewDialog, setViewDialog] = useState(null);
    const [viewInvoiceDetail, setViewInvoiceDetail] = useState(null);
    const [viewInvoiceLoading, setViewInvoiceLoading] = useState(false);
    const [viewPurchaseReturnDetail, setViewPurchaseReturnDetail] = useState(null);
    const [viewPurchaseReturnLoading, setViewPurchaseReturnLoading] = useState(false);
    /** Imperative handle for the printable invoice template (Download PDF). */
    const printableInvoiceRef = useRef(null);
    const [currency, setCurrency] = useState('SAR');
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [actionLoadingId, setActionLoadingId] = useState(null);
    /** Supplier invoice approve: preview showed new branch products — collect optional critical stock */
    const [siApproveModal, setSiApproveModal] = useState(null);
    const [siCriticalStock, setSiCriticalStock] = useState({});
    const [siReceivedQty, setSiReceivedQty] = useState({});
    const [fundApproveModal, setFundApproveModal] = useState(null);
    const [expenseApproveModal, setExpenseApproveModal] = useState(null);
    const [fundApproveError, setFundApproveError] = useState('');

    const loadApprovals = useCallback(async () => {
        setIsLoading(true);
        setLoadError('');
        try {
            const pettyQs = {
                ...pettyCashListQuery(queueFilter, selectedBranchId),
                ...expenseScope,
            };
            const loadSupplierInvoices =
                queueFilter === 'all' || queueFilter === 'pending';

            // Supplier invoices are workshop-wide unless the user is branch-locked.
            // Sidebar branch selection must not hide invoices for other branches.
            const supplierBranchScope = branchLockedId
                ? branchScopeParams(branchLockedId)
                : {};
            const [response, siRes, srRes, aprRes, adminWalletRes] = await Promise.all([
                apiFetch(`/workshop-staff/petty-cash/requests${qs(pettyQs)}`),
                loadSupplierInvoices
                    ? apiFetch(
                          `/workshop-staff/supplier-sales-invoices${qs({
                              limit: 100,
                              offset: 0,
                              ...supplierBranchScope,
                              ...expenseScope,
                          })}`,
                      ).catch(() => null)
                    : Promise.resolve(null),
                queueFilter === 'all' || queueFilter === 'pending'
                    ? getWorkshopSalesReturns({
                          status: 'pending',
                          limit: 100,
                          offset: 0,
                          ...branchScopeParams(selectedBranchId),
                          ...expenseScope,
                      }).catch(() => null)
                    : Promise.resolve(null),
                queueFilter === 'all' || queueFilter === 'pending'
                    ? listAffiliatedPurchaseReturns({
                          status: 'pending',
                          ...branchScopeParams(selectedBranchId),
                          ...expenseScope,
                      }).catch(() => null)
                    : Promise.resolve(null),
                apiFetch(`/workshop-staff/admin-wallet-approvals${qs({
                    status: queueFilter === 'all' ? 'pending' : queueFilter,
                    ...branchScopeParams(selectedBranchId),
                    ...expenseScope,
                })}`).catch(() => null),
            ]);

            if (!(response?.success && Array.isArray(response.requests))) {
                throw new Error('Invalid approvals response.');
            }
            let list = response.requests;
            if (selectedBranchId && selectedBranchId !== 'all') {
                const anyHasBranch = list.some(
                    (a) =>
                        a.branchId != null ||
                        a.branch_id != null ||
                        a.branch?.id != null ||
                        (a.branchName ?? a.branch_name ?? '').toString().trim() !== '',
                );
                if (anyHasBranch) {
                    list = list.filter((a) => rowMatchesBranch(a, selectedBranchId, scopeBranchName));
                }
            }

            const siList = Array.isArray(siRes?.invoices) ? siRes.invoices : [];
            const siCurrency = siRes?.currency || response.currency || 'SAR';
            const supplierRows = siList.map((inv) => ({
                id: `supplier-invoice-${inv.id}`,
                _source: 'supplier_sales_invoice',
                supplierInvoiceId: inv.id,
                workshopReviewStatus: inv.workshopReviewStatus ?? 'pending',
                kind: 'supplier_invoice',
                amount: Number(inv.outstanding ?? inv.grandTotal ?? 0),
                grandTotal: Number(inv.grandTotal ?? 0),
                paid: Number(inv.paid ?? 0),
                outstanding: Number(inv.outstanding ?? 0),
                invoiceNo: inv.invoiceNo,
                productLabel: inv.productLabel,
                status: inv.status,
                requestedAt: inv.createdAt || inv.invoiceDate,
                invoiceDate: inv.invoiceDate,
                dueDate: inv.dueDate,
                supplier: inv.supplier ? { name: inv.supplier.name, id: inv.supplier.id } : null,
                branch: inv.branch || null,
                branchId: inv.branch?.id,
                reason: inv.productLabel ? `Lines: ${inv.productLabel}` : null,
            }));

            const srList = Array.isArray(srRes?.salesReturns) ? srRes.salesReturns : [];
            const salesReturnRows = srList.map((sr) => ({
                id: `sales-return-${sr.id}`,
                _source: 'sales_return',
                salesReturnId: sr.id,
                kind: 'sales_return',
                status: sr.status || 'pending',
                amount: Number(sr.totalAmount ?? 0),
                invoiceNo: sr.invoiceNo,
                creditNoteNo: sr.creditNoteNo,
                returnScope: sr.returnScope,
                customerName: sr.customerName,
                customerPhone: sr.customerPhone,
                vehicleNumber: sr.vehicleNumber,
                cashierName: sr.cashier?.name,
                branchId: sr.branchId,
                branchName: sr.branchName,
                requestedAt: sr.createdAt || sr.returnDate,
                reason: sr.reason,
                items: sr.items,
            }));

            const aprList = Array.isArray(aprRes?.items) ? aprRes.items : [];
            const purchaseReturnRows = aprList.map((pr) => ({
                id: `purchase-return-${pr.id}`,
                _source: 'affiliated_purchase_return',
                purchaseReturnId: pr.id,
                kind: 'purchase_return',
                status: pr.status || 'pending',
                initiationMode: pr.mode ?? null,
                amount: Number(pr.grandTotal ?? 0),
                returnNumber: pr.returnNumber,
                invoiceNo: pr.sourcePurchaseInvoiceNumber,
                supplierName: pr.supplierName,
                supplierId: pr.supplierId,
                branchId: pr.branchId,
                branchName: pr.branchName,
                supplierSalesReturnNo: pr.supplierSalesReturnNo,
                requestedAt: pr.issueDate,
                reason: pr.supplierSalesReturnNo
                    ? `Linked supplier return ${pr.supplierSalesReturnNo}`
                    : null,
            }));

            const adminWalletRows = Array.isArray(adminWalletRes?.requests)
                ? adminWalletRes.requests.map((r) => ({
                    id: `admin-wallet-${r.kind}-${r.id}`,
                    kind: r.kind,
                    amount: Number(r.amount ?? 0),
                    status: r.status,
                    requestedAt: r.requestedAt,
                    cashier: { name: r.requestedBy ?? r.adminUserName ?? 'Platform admin' },
                    description: r.description,
                    requestNumber: r.requestNumber,
                    adminWalletRequestId: r.id,
                    branchId: r.branchId,
                    branchName: r.branchName,
                    expenseCategory: r.expenseCategory,
                    proofUrl: r.proofUrl,
                    superAdminApprovedByName: r.superAdminApprovedByName ?? null,
                    workshopAdminApprovedByName: r.workshopAdminApprovedByName ?? null,
                    approvedByName: r.approvedByName ?? null,
                    approvedAt: r.approvedAt ?? null,
                }))
                : [];

            const merged = [...supplierRows, ...purchaseReturnRows, ...salesReturnRows, ...adminWalletRows, ...list].sort((a, b) => {
                const ta = new Date(a.requestedAt || a.createdAt || 0).getTime();
                const tb = new Date(b.requestedAt || b.createdAt || 0).getTime();
                return tb - ta;
            });

            setApprovals(merged);
            setCurrency(siCurrency || response.currency || 'SAR');
        } catch (error) {
            setApprovals([]);
            setLoadError(error.message || 'Failed to load approvals queue.');
        } finally {
            setIsLoading(false);
        }
    }, [queueFilter, selectedBranchId, scopeBranchName, branchLockedId]);

    useEffect(() => {
        loadApprovals();
    }, [loadApprovals]);

    useEffect(() => {
        if (!viewDialog || !isSupplierSalesInvoiceRow(viewDialog)) {
            setViewInvoiceDetail(null);
            setViewInvoiceLoading(false);
            return;
        }
        const id = viewDialog.supplierInvoiceId;
        if (!id) return;
        let cancelled = false;
        setViewInvoiceLoading(true);
        setViewInvoiceDetail(null);
        (async () => {
            try {
                const res = await apiFetch(`/workshop-staff/supplier-sales-invoices/${encodeURIComponent(String(id))}`);
                if (!cancelled && res?.success && res.invoice) setViewInvoiceDetail(res.invoice);
            } catch {
                if (!cancelled) setViewInvoiceDetail(null);
            } finally {
                if (!cancelled) setViewInvoiceLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [viewDialog]);

    useEffect(() => {
        if (!viewDialog || !isAffiliatedPurchaseReturnRow(viewDialog)) {
            setViewPurchaseReturnDetail(null);
            setViewPurchaseReturnLoading(false);
            return;
        }
        const id = viewDialog.purchaseReturnId;
        if (!id) return;
        let cancelled = false;
        setViewPurchaseReturnLoading(true);
        setViewPurchaseReturnDetail(null);
        (async () => {
            try {
                const res = await getAffiliatedPurchaseReturn(id);
                if (!cancelled && res?.purchaseReturn) {
                    setViewPurchaseReturnDetail(res.purchaseReturn);
                }
            } catch {
                if (!cancelled) setViewPurchaseReturnDetail(null);
            } finally {
                if (!cancelled) setViewPurchaseReturnLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [viewDialog]);

    const closeRejectDialog = useCallback(() => {
        setRejectDialog(null);
        setRejectReason('');
    }, []);

    const closeSiApproveScreen = useCallback(() => {
        if (actionLoadingId) return;
        setSiApproveModal(null);
        setSiCriticalStock({});
        setSiReceivedQty({});
    }, [actionLoadingId]);

    const closeViewDialog = useCallback(() => {
        setViewDialog(null);
        setViewPurchaseReturnDetail(null);
        setViewPurchaseReturnLoading(false);
    }, []);

    const filtered = useMemo(() => {
        return approvals.filter((a) => {
            // Per-type view permission — hide rows the user can't view at all.
            if (!canViewType(a)) return false;
            if (requestTypeFilter === 'all') return true;
            if (requestTypeFilter === 'topup') return isTopUpRequest(a) || isAdminWalletFundRow(a);
            if (requestTypeFilter === 'expenses') return isExpenseRequest(a) || isAdminWalletExpenseRow(a);
            if (requestTypeFilter === 'supplier_invoices') return isSupplierSalesInvoiceRow(a);
            if (requestTypeFilter === 'purchase_returns') return isAffiliatedPurchaseReturnRow(a);
            if (requestTypeFilter === 'sales_returns') return isSalesReturnRow(a);
            return true;
        });
    }, [approvals, requestTypeFilter, canViewType]);
    const typeColors = {
        expense: 'ws-badge--yellow',
        fund_request: 'ws-badge--blue',
        payment: 'ws-badge--green',
        advance: 'ws-badge--purple',
        purchase: 'ws-badge--purple',
        purchase_return: 'ws-badge--purple',
        supplier_invoice: 'ws-badge--purple',
        sales_return: 'ws-badge--blue',
        admin_wallet_fund: 'ws-badge--blue',
        admin_wallet_expense: 'ws-badge--yellow',
    };
    const statusColors = { pending: 'ws-badge--yellow', approved: 'ws-badge--green', rejected: 'ws-badge--red' };

    const supplierRowCanAct = (row) =>
        isSupplierSalesInvoiceRow(row) &&
        (row.workshopReviewStatus === 'pending' || row.workshopReviewStatus == null);

    const handleApproveRow = async (row) => {
        setLoadError('');
        if (isSalesReturnRow(row)) {
            if (row.status !== 'pending') return;
            const rid = row.salesReturnId;
            setActionLoadingId(`approve-sr-${rid}`);
            try {
                await approveWorkshopSalesReturn(rid, branchScopeParams(selectedBranchId));
                await loadApprovals();
                window.dispatchEvent(new Event('workshop-approvals-updated'));
                window.dispatchEvent(new CustomEvent('workshop-inventory-updated', { detail: { branchId: row.branchId, source: 'approve_sales_return' } }));
            } catch (error) {
                setLoadError(error.message || 'Failed to approve sales return.');
            } finally {
                setActionLoadingId(null);
            }
            return;
        }
        if (isAffiliatedPurchaseReturnRow(row)) {
            if (row.status !== 'pending') return;
            if (row.initiationMode === 'workshop_initiated') return;
            const rid = row.purchaseReturnId;
            const ok = window.confirm(
                `Approve purchase return ${row.returnNumber || ''}?\n\n` +
                    `Branch stock will decrease and the linked supplier return will be finalized.\n\n` +
                    `This action cannot be undone.`,
            );
            if (!ok) return;
            setActionLoadingId(`approve-apr-${rid}`);
            try {
                await approveAffiliatedPurchaseReturn(rid);
                await loadApprovals();
                window.dispatchEvent(new Event('workshop-approvals-updated'));
                window.dispatchEvent(
                    new CustomEvent('workshop-inventory-updated', {
                        detail: { branchId: row.branchId, source: 'approve_purchase_return' },
                    }),
                );
            } catch (error) {
                setLoadError(error.message || 'Failed to approve purchase return.');
            } finally {
                setActionLoadingId(null);
            }
            return;
        }
        if (isSupplierSalesInvoiceRow(row)) {
            if (!supplierRowCanAct(row)) return;
            const sid = row.supplierInvoiceId;
            setActionLoadingId(`approve-si-${sid}`);
            try {
                const preview = await apiFetch(
                    `/workshop-staff/supplier-sales-invoices/${encodeURIComponent(String(sid))}/approval-preview`,
                );
                const init = {};
                (preview.newProducts || []).forEach((p) => {
                    init[String(p.productId)] = '0';
                });
                setSiCriticalStock(init);
                setSiReceivedQty({});
                setSiApproveModal({ row, preview });
            } catch (error) {
                setLoadError(error.message || 'Failed to approve supplier invoice.');
            } finally {
                setActionLoadingId(null);
            }
            return;
        }
        if (isAdminWalletFundRow(row)) {
            if (row.status !== 'pending') return;
            setFundApproveError('');
            setFundApproveModal(row);
            return;
        }
        if (isAdminWalletExpenseRow(row)) {
            if (row.status !== 'pending') return;
            setFundApproveError('');
            setExpenseApproveModal(row);
            return;
        }
        const id = row.id;
        if (row.status !== 'pending') return;
        setActionLoadingId(`approve-${id}`);
        try {
            if (isTopUpRequest(row) || isExpenseRequest(row)) {
                await approveExpenseRequest(id, {}, expenseScope);
            } else {
            await apiFetch(`/workshop-staff/petty-cash/${id}/approve`, { method: 'POST' });
            }
            await loadApprovals();
            window.dispatchEvent(new Event('workshop-approvals-updated'));
        } catch (error) {
            setLoadError(error.message || 'Failed to approve request.');
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleRejectSubmit = async () => {
        if (!rejectReason.trim() || !rejectDialog) return;
        setLoadError('');
        if (isSalesReturnRow(rejectDialog)) {
            if (rejectDialog.status !== 'pending') return;
            const rid = rejectDialog.salesReturnId;
            setActionLoadingId(`reject-sr-${rid}`);
            try {
                await rejectWorkshopSalesReturn(rid, { rejectionReason: rejectReason.trim() }, branchScopeParams(selectedBranchId));
                setRejectDialog(null);
                setRejectReason('');
                await loadApprovals();
                window.dispatchEvent(new Event('workshop-approvals-updated'));
            } catch (error) {
                setLoadError(error.message || 'Failed to reject sales return.');
            } finally {
                setActionLoadingId(null);
            }
            return;
        }
        if (isSupplierSalesInvoiceRow(rejectDialog)) {
            if (!supplierRowCanAct(rejectDialog)) return;
            const sid = rejectDialog.supplierInvoiceId;
            setActionLoadingId(`reject-si-${sid}`);
            try {
                await apiFetch(`/workshop-staff/supplier-sales-invoices/${encodeURIComponent(String(sid))}/reject`, {
                    method: 'POST',
                    body: JSON.stringify({ rejectionReason: rejectReason.trim() }),
                });
                setRejectDialog(null);
                setRejectReason('');
                await loadApprovals();
                window.dispatchEvent(new Event('workshop-approvals-updated'));
            } catch (error) {
                setLoadError(error.message || 'Failed to reject supplier invoice.');
            } finally {
                setActionLoadingId(null);
            }
            return;
        }
        if (isAdminWalletFundRow(rejectDialog) || isAdminWalletExpenseRow(rejectDialog)) {
            const rid = rejectDialog.adminWalletRequestId;
            const kind = rejectDialog.kind;
            setActionLoadingId(`reject-aw-${rid}`);
            try {
                await apiFetch(
                    `/workshop-staff/admin-wallet-approvals/${encodeURIComponent(kind)}/${encodeURIComponent(String(rid))}/reject`,
                    {
                        method: 'POST',
                        body: JSON.stringify({ rejectionReason: rejectReason.trim() }),
                    },
                );
                setRejectDialog(null);
                setRejectReason('');
                await loadApprovals();
                window.dispatchEvent(new Event('workshop-approvals-updated'));
            } catch (error) {
                setLoadError(error.message || 'Failed to reject platform admin wallet request.');
            } finally {
                setActionLoadingId(null);
            }
            return;
        }
        const id = rejectDialog.id;
        setActionLoadingId(`reject-${id}`);
        try {
            if (isTopUpRequest(rejectDialog) || isExpenseRequest(rejectDialog)) {
                await rejectExpenseRequest(id, { reason: rejectReason.trim() }, expenseScope);
            } else {
            await apiFetch(`/workshop-staff/petty-cash/${id}/reject`, {
                method: 'POST',
                body: JSON.stringify({ rejectionReason: rejectReason.trim() }),
            });
            }
            setRejectDialog(null);
            setRejectReason('');
            await loadApprovals();
            window.dispatchEvent(new Event('workshop-approvals-updated'));
        } catch (error) {
            setLoadError(error.message || 'Failed to reject request.');
        } finally {
            setActionLoadingId(null);
        }
    };

    const submitAdminWalletFundApprove = async (payload) => {
        if (!fundApproveModal) return;
        const rid = fundApproveModal.adminWalletRequestId;
        setActionLoadingId(`approve-aw-${rid}`);
        setFundApproveError('');
        try {
            await apiFetch(
                `/workshop-staff/admin-wallet-approvals/admin_wallet_fund/${encodeURIComponent(String(rid))}/approve${qs(expenseScope)}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                },
            );
            setFundApproveModal(null);
            await loadApprovals();
            window.dispatchEvent(new Event('workshop-approvals-updated'));
        } catch (error) {
            setFundApproveError(error.message || 'Failed to approve fund request.');
        } finally {
            setActionLoadingId(null);
        }
    };

    const submitAdminWalletExpenseApprove = async (payload) => {
        if (!expenseApproveModal) return;
        const rid = expenseApproveModal.adminWalletRequestId;
        setActionLoadingId(`approve-aw-${rid}`);
        setFundApproveError('');
        try {
            await apiFetch(
                `/workshop-staff/admin-wallet-approvals/admin_wallet_expense/${encodeURIComponent(String(rid))}/approve${qs(expenseScope)}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                },
            );
            setExpenseApproveModal(null);
            await loadApprovals();
            window.dispatchEvent(new Event('workshop-approvals-updated'));
        } catch (error) {
            setFundApproveError(error.message || 'Failed to approve expense request.');
        } finally {
            setActionLoadingId(null);
        }
    };

    const submitSupplierInvoiceApproveFromModal = async () => {
        if (!siApproveModal) return;
        const { row } = siApproveModal;
        const sid = row.supplierInvoiceId;
        const criticalStockByProductId = {};
        const newProds = Array.isArray(siApproveModal.preview?.newProducts)
            ? siApproveModal.preview.newProducts
            : [];
        const keys =
            newProds.length > 0
                ? newProds.map((p) => String(p.productId))
                : Object.keys(siCriticalStock);
        for (const pid of keys) {
            const raw = siCriticalStock[pid] ?? '0';
            const n = parseFloat(String(raw).replace(',', '.'));
            if (Number.isFinite(n) && n >= 0) {
                criticalStockByProductId[pid] = n;
            }
        }
        setActionLoadingId(`approve-si-${sid}`);
        setLoadError('');
        try {
            const receiveLines = Array.isArray(siApproveModal.preview?.receiveLines)
                ? siApproveModal.preview.receiveLines
                : [];
            await apiFetch(`/workshop-staff/supplier-sales-invoices/${encodeURIComponent(String(sid))}/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    criticalStockByProductId,
                    receivedQtyByInvoiceItemId: buildReceivedQtyByInvoiceItemIdPayload(
                        receiveLines,
                        siReceivedQty,
                    ),
                }),
            });
            setSiApproveModal(null);
            setSiCriticalStock({});
            setSiReceivedQty({});
            await loadApprovals();
            window.dispatchEvent(new Event('workshop-approvals-updated'));
            window.dispatchEvent(
                new CustomEvent('workshop-inventory-updated', {
                    detail: { branchId: row.branchId ?? row.branch_id ?? null, source: 'approve_supplier_invoice' },
                }),
            );
        } catch (error) {
            setLoadError(error.message || 'Failed to approve supplier invoice.');
        } finally {
            setActionLoadingId(null);
        }
    };

    const formatDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—');
    const formatDateFull = (d) =>
        d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

    if (rejectDialog) {
    return (
            <WorkshopSubScreen
                title={isSupplierSalesInvoiceRow(rejectDialog) ? 'Reject supplier invoice' : 'Reject approval'}
                subtitle="Provide a reason — this is stored on the request."
                backLabel="Back to Approvals"
                onBack={closeRejectDialog}
                backDisabled={actionLoadingId !== null}
                size="narrow"
                footer={(
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', width: '100%' }}>
                                <button
                                    className="btn-secondary"
                            onClick={closeRejectDialog}
                                    disabled={actionLoadingId !== null}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="btn-submit"
                                    style={{ background: '#DC2626' }}
                                    disabled={!rejectReason.trim() || actionLoadingId !== null}
                                    onClick={handleRejectSubmit}
                                >
                                    {actionLoadingId != null && String(actionLoadingId).startsWith('reject-')
                                        ? 'Rejecting...'
                                        : 'Reject'}
                                </button>
                            </div>
                )}
                    >
                <div className="ws-section" style={{ padding: 20 }}>
                        <textarea
                            placeholder="Reason for rejection..."
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            rows={3}
                            style={{
                                width: '100%',
                                padding: 12,
                                borderRadius: 8,
                                border: '1px solid var(--color-border)',
                                fontSize: '0.875rem',
                                resize: 'vertical',
                            }}
                        />
                </div>
            </WorkshopSubScreen>
        );
    }

    if (siApproveModal) {
        return (
            <WorkshopSubScreen
                title="Approve supplier invoice & receive stock"
                subtitle="Confirm received quantities, set critical stock for new branch products, then approve."
                backLabel="Back to Approvals"
                onBack={closeSiApproveScreen}
                backDisabled={actionLoadingId !== null}
                size="wide"
                footer={(
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap', width: '100%' }}>
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={closeSiApproveScreen}
                            disabled={actionLoadingId !== null}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="btn-submit"
                            onClick={submitSupplierInvoiceApproveFromModal}
                            disabled={actionLoadingId !== null}
                        >
                            {actionLoadingId != null && String(actionLoadingId).startsWith('approve-si-')
                                ? 'Approving…'
                                : 'OK — approve & update inventory'}
                        </button>
                    </div>
                )}
            >
                <div className="ws-section" style={{ padding: 20 }}>
                    <div style={{ fontSize: '0.875rem', color: '#334155', lineHeight: 1.5, marginBottom: 14 }}>
                        {(() => {
                            const newProds = Array.isArray(siApproveModal.preview?.newProducts)
                                ? siApproveModal.preview.newProducts
                                : [];
                            const unresolved = Array.isArray(siApproveModal.preview?.unresolvedLineNames)
                                ? siApproveModal.preview.unresolvedLineNames
                                : [];
                            const branchNm = siApproveModal.preview?.branchName || 'this branch';
                            if (newProds.length > 0) {
                                return (
                                    <p style={{ margin: '0 0 10px' }}>
                                        The following products are <strong>not on {branchNm}&apos;s inventory</strong>{' '}
                                        yet. If you approve, the system will <strong>add them to this branch</strong>{' '}
                                        and set <strong>opening stock</strong> to the <strong>quantities on this sales invoice</strong>{' '}
                                        (per product, summed across lines). Set <strong>critical stock</strong> (low-stock
                                        alert level) for each new branch product below, then confirm.
                                    </p>
                                );
                            }
                            if (unresolved.length > 0) {
                                return (
                                    <p style={{ margin: '0 0 10px' }}>
                                        Some invoice lines could not be matched to a product in your workshop catalog.
                                        You can still approve the invoice for accounting, but{' '}
                                        <strong>inventory may not update</strong> for those lines until they are linked
                                        to master products.
                                    </p>
                                );
                            }
                            return (
                                <p style={{ margin: '0 0 10px' }}>
                                    Review the details below before approving. Inventory will be updated for this branch
                                    according to the invoice lines.
                                </p>
                            );
                        })()}
                        {Array.isArray(siApproveModal.preview?.unresolvedLineNames) &&
                        siApproveModal.preview.unresolvedLineNames.length > 0 ? (
                            <div
                                style={{
                                    padding: 10,
                                    borderRadius: 8,
                                    background: '#FFFBEB',
                                    border: '1px solid #FDE68A',
                                    color: '#92400E',
                                    marginBottom: 12,
                                    fontSize: '0.8125rem',
                                }}
                            >
                                <strong>Could not match to catalog:</strong>{' '}
                                {siApproveModal.preview.unresolvedLineNames.join(', ')}. Stock may not apply for
                                these lines until they are linked to a master product.
                            </div>
                        ) : null}
                        {Array.isArray(siApproveModal.preview?.newProducts) &&
                        siApproveModal.preview.newProducts.length > 0 ? (
                            <div style={{ overflowX: 'auto' }}>
                                <table
                                    style={{
                                        width: '100%',
                                        borderCollapse: 'collapse',
                                        fontSize: '0.8125rem',
                                    }}
                                >
                                    <thead>
                                        <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                                            <th style={{ padding: '8px 6px' }}>Product</th>
                                            <th style={{ padding: '8px 6px', textAlign: 'right' }}>Qty (opening)</th>
                                            <th style={{ padding: '8px 6px', textAlign: 'right' }}>
                                                Critical stock
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {siApproveModal.preview.newProducts.map((p) => (
                                            <tr key={p.productId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '8px 6px' }}>
                                                    {p.name}
                                                    {p.sku ? (
                                                        <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
                                                            {' '}
                                                            ({p.sku})
                                                        </span>
                                                    ) : null}
                                                </td>
                                                <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                                                    {p.qty} {p.unit || ''}
                                                </td>
                                                <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                                                    <input
                                                        type="text"
                                                        inputMode="decimal"
                                                        value={siCriticalStock[p.productId] ?? '0'}
                                                        onChange={(e) =>
                                                            setSiCriticalStock((prev) => ({
                                                                ...prev,
                                                                [p.productId]: e.target.value,
                                                            }))
                                                        }
                                                        style={{
                                                            width: 88,
                                                            padding: '6px 8px',
                                                            borderRadius: 6,
                                                            border: '1px solid #cbd5e1',
                                                            textAlign: 'right',
                                                        }}
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p style={{ margin: 0, fontSize: '0.8125rem', color: '#64748b' }}>
                                {Array.isArray(siApproveModal.preview?.unresolvedLineNames) &&
                                siApproveModal.preview.unresolvedLineNames.length > 0
                                    ? 'No new branch catalog products will be created from this invoice; only matched lines can receive stock.'
                                    : 'No new branch products; approving will increase stock only for products you already carry on this branch.'}
                            </p>
                        )}
                        {Array.isArray(siApproveModal.preview?.receiveLines) &&
                        siApproveModal.preview.receiveLines.length > 0 ? (
                            <div style={{ marginTop: 16, overflowX: 'auto' }}>
                                <p
                                    style={{
                                        margin: '0 0 8px',
                                        fontSize: '0.8125rem',
                                        fontWeight: 700,
                                        color: '#0f172a',
                                    }}
                                >
                                    Invoice lines — received quantity
                                </p>
                                <p style={{ margin: '0 0 10px', fontSize: '0.75rem', color: '#64748b' }}>
                                    Leave <strong>Received qty</strong> empty when the physical count matches
                                    the invoiced branch amount. Enter a value in workshop UOM only when different.
                                </p>
                                <table
                                    style={{
                                        width: '100%',
                                        borderCollapse: 'collapse',
                                        fontSize: '0.8125rem',
                                    }}
                                >
                                    <thead>
                                        <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                                            <th style={{ padding: '8px 6px' }}>Product</th>
                                            <th style={{ padding: '8px 6px', textAlign: 'right' }}>Supplier shipped</th>
                                            <th style={{ padding: '8px 6px', textAlign: 'right' }}>Branch stock +</th>
                                            <th style={{ padding: '8px 6px', textAlign: 'right' }}>Received qty</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {siApproveModal.preview.receiveLines.map((ln) => {
                                            const itemId = String(ln.invoiceItemId ?? '');
                                            const wsUnit = ln.workshopReceiveUnit ?? 'Liter';
                                            return (
                                                <tr key={itemId || ln.itemName} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '8px 6px' }}>{ln.itemName}</td>
                                                    <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                                                        {ln.supplierQty} {ln.supplierUnit ?? 'Box'}
                                                    </td>
                                                    <td style={{ padding: '8px 6px', textAlign: 'right', color: '#047857', fontWeight: 600 }}>
                                                        +{ln.workshopReceiveQty} {wsUnit}
                                                    </td>
                                                    <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                                                        {itemId ? (
                                                            <input
                                                                type="text"
                                                                inputMode="decimal"
                                                                placeholder={`${ln.workshopReceiveQty} ${wsUnit}`}
                                                                value={siReceivedQty[itemId] ?? ''}
                                                                onChange={(e) =>
                                                                    setSiReceivedQty((prev) => ({
                                                                        ...prev,
                                                                        [itemId]: e.target.value,
                                                                    }))
                                                                }
                                                                style={{
                                                                    width: 100,
                                                                    padding: '6px 8px',
                                                                    borderRadius: 6,
                                                                    border: '1px solid #cbd5e1',
                                                                    textAlign: 'right',
                                                                }}
                                                                aria-label={`Received qty for ${ln.itemName}`}
                                                            />
                                                        ) : (
                                                            '—'
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : null}
                    </div>
                </div>
            </WorkshopSubScreen>
        );
    }

    if (viewDialog) {
        const isSupplierView = isSupplierSalesInvoiceRow(viewDialog);
        const isPurchaseReturnView = isAffiliatedPurchaseReturnRow(viewDialog);
        return (
            <WorkshopSubScreen
                title={
                    isSupplierView
                        ? `Supplier Invoice ${viewDialog.invoiceNo || ''}`.trim()
                        : isPurchaseReturnView
                          ? `Purchase Return ${viewDialog.returnNumber || viewPurchaseReturnDetail?.returnNumber || ''}`.trim()
                          : 'Approval Details'
                }
                subtitle={
                    isSupplierView
                        ? (viewDialog.supplier?.name || 'Supplier invoice')
                        : isPurchaseReturnView
                          ? (viewPurchaseReturnDetail?.supplier?.name || viewDialog.supplierName || 'Affiliated supplier return')
                          : formatRequestKindLabel(viewDialog)
                }
                backLabel="Back to Approvals"
                onBack={closeViewDialog}
                size={isSupplierView || isPurchaseReturnView ? 'xl' : 'form'}
                maxWidth={isSupplierView || isPurchaseReturnView ? '1100px' : undefined}
                className={isSupplierView ? 'ws-pi-sub-screen' : isPurchaseReturnView ? 'ws-pi-sub-screen' : ''}
            >
                <div className={isSupplierView || isPurchaseReturnView ? 'modal-content-purchase' : 'ws-section'} style={isSupplierView || isPurchaseReturnView ? undefined : { padding: 20 }}>
                        {isSupplierSalesInvoiceRow(viewDialog) ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0' }}>
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'flex-end',
                                        gap: 8,
                                    }}
                                >
                                    <button
                                        type="button"
                                        className="btn-pi-cancel"
                                        onClick={() => printableInvoiceRef.current?.downloadPdf?.()}
                                        disabled={viewInvoiceLoading || !viewInvoiceDetail}
                                    >
                                        Download PDF
                                    </button>
                                </div>
                                {viewInvoiceLoading ? (
                                    <ShimmerTextBlock lines={10} />
                                ) : viewInvoiceDetail ? (
                                    <WorkshopPurchaseInvoiceView
                                        ref={printableInvoiceRef}
                                        compact
                                        variant="supplier_sales"
                                        detail={mapSupplierInvoiceToPrintableDetail(viewInvoiceDetail)}
                                        listRow={{
                                            id: viewInvoiceDetail.id,
                                            invoice_number: viewInvoiceDetail.invoiceNo,
                                            invoiceNo: viewInvoiceDetail.invoiceNo,
                                            date: viewInvoiceDetail.invoiceDate,
                                            status: viewInvoiceDetail.status,
                                            grand_total: viewInvoiceDetail.grandTotal,
                                            vendor_name: viewInvoiceDetail.supplier?.name,
                                            branch_name: viewInvoiceDetail.branch?.name,
                                        }}
                                    />
                                ) : (
                                    <p style={{ color: 'var(--color-text-muted)' }}>Could not load invoice details.</p>
                                )}
                            </div>
                        ) : isAffiliatedPurchaseReturnRow(viewDialog) ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0' }}>
                                {viewPurchaseReturnLoading ? (
                                    <ShimmerTextBlock lines={12} />
                                ) : viewPurchaseReturnDetail ? (
                                    <WorkshopPurchaseReturnDetailView
                                        detail={viewPurchaseReturnDetail}
                                        currency={currency}
                                        variant="workshop"
                                        compact
                                    />
                                ) : (
                                    <p style={{ color: 'var(--color-text-muted)' }}>Could not load purchase return details.</p>
                                )}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--color-text-muted)' }}>Type</span>
                                    <span className="capitalize">{formatRequestKindLabel(viewDialog)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--color-text-muted)' }}>Amount</span>
                                    <strong>
                                        {currency} {(viewDialog.amount || 0).toLocaleString()}
                                    </strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--color-text-muted)' }}>Requested by</span>
                                    <span>{viewDialog.cashier?.name || viewDialog.employee?.name || '—'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--color-text-muted)' }}>Category</span>
                                    <span>{viewDialog.category?.name || '—'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--color-text-muted)' }}>Branch</span>
                                    <span>{viewDialog.branch?.name || viewDialog.branchName || '—'}</span>
                                </div>
                                {(isAdminWalletFundRow(viewDialog) || isAdminWalletExpenseRow(viewDialog)) && viewDialog.description ? (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                        <span style={{ color: 'var(--color-text-muted)' }}>Details</span>
                                        <span style={{ textAlign: 'right', maxWidth: 260 }}>{viewDialog.description}</span>
                                    </div>
                                ) : null}
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--color-text-muted)' }}>Reason</span>
                                    <span style={{ textAlign: 'right', maxWidth: 220 }}>{viewDialog.reason || '—'}</span>
                                </div>
                                {formatAdminWalletApproverSummary(viewDialog) ? (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                        <span style={{ color: 'var(--color-text-muted)' }}>Approved by</span>
                                        <span style={{ textAlign: 'right', maxWidth: 260, fontWeight: 600 }}>
                                            {formatAdminWalletApproverSummary(viewDialog)}
                                        </span>
                                    </div>
                                ) : null}
                                {viewDialog.requestedAt && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--color-text-muted)' }}>Requested at</span>
                                        <span>{formatDateFull(viewDialog.requestedAt)}</span>
                                    </div>
                                )}
                                {viewDialog.approvedAt && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--color-text-muted)' }}>Approved at</span>
                                        <span>{formatDateFull(viewDialog.approvedAt)}</span>
                                    </div>
                                )}
                                {viewDialog.rejectionReason && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--color-text-muted)' }}>Rejection Reason</span>
                                        <span style={{ textAlign: 'right', maxWidth: 220 }}>{viewDialog.rejectionReason}</span>
                                    </div>
                                )}
                            </div>
                        )}
                </div>
            </WorkshopSubScreen>
        );
    }

    return (
        <div>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">Approvals Queue</h2>
                    <p className="ws-page-sub">
                        Review and act on pending requests
                        {selectedBranchId && selectedBranchId !== 'all' ? (
                            <>
                                {' · '}
                                <strong>
                                    {branches.find((b) => String(b.id) === String(selectedBranchId))?.name ||
                                        `Branch ${selectedBranchId}`}
                                </strong>
                            </>
                        ) : (
                            ' · All branches'
                        )}
                    </p>
                </div>
            </div>
            {loadError && (
                <div
                    style={{
                        marginBottom: 16,
                        color: '#B91C1C',
                        background: '#FEF2F2',
                        border: '1px solid #FECACA',
                        borderRadius: 10,
                        padding: 12,
                        fontSize: '0.875rem',
                    }}
                >
                    {loadError}
                </div>
            )}
            <div className="ws-section" style={{ marginBottom: 16 }}>
                <div style={{ padding: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                        value={queueFilter}
                        onChange={(e) => setQueueFilter(e.target.value)}
                        style={{
                            padding: '8px 14px',
                            borderRadius: 8,
                            border: '1px solid var(--color-border)',
                            fontSize: '0.875rem',
                            minWidth: 160,
                        }}
                    >
                        <option value="all">All Queue</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                    </select>
                    <select
                        value={requestTypeFilter}
                        onChange={(e) => setRequestTypeFilter(e.target.value)}
                        style={{
                            padding: '8px 14px',
                            borderRadius: 8,
                            border: '1px solid var(--color-border)',
                            fontSize: '0.875rem',
                            minWidth: 180,
                        }}
                        aria-label="Request type"
                    >
                        <option value="all">All types</option>
                        {hasPermission('workshop.approvals.top-up.view') && (
                            <option value="topup">Top up</option>
                        )}
                        {hasPermission('workshop.approvals.expense.view') && (
                            <option value="expenses">Expenses</option>
                        )}
                        {hasPermission('workshop.approvals.supplier-invoice.view') ||
                        hasPermission('workshop.approvals.view') ? (
                            <option value="supplier_invoices">Supplier invoices</option>
                        ) : null}
                        {(hasPermission('workshop.approvals.supplier-invoice.view') || hasPermission('workshop.approvals.view')) && (
                            <option value="purchase_returns">Purchase returns</option>
                        )}
                        {(hasPermission('workshop.approvals.sales-return.view') || hasPermission('workshop.approvals.view')) && (
                            <option value="sales_returns">Sales returns</option>
                        )}
                    </select>
                    <button className="btn-portal" onClick={loadApprovals} disabled={isLoading}>
                        <RefreshCw size={14} /> {isLoading ? 'Refreshing...' : 'Refresh'}
                    </button>
                    <div
                        style={{
                            marginLeft: 'auto',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: '0.875rem',
                            color: 'var(--color-text-muted)',
                        }}
                    >
                        <Clock size={16} />
                        {filtered.length} requests
                    </div>
                </div>
            </div>
            <div className="ws-section">
                <WsTableScroll>
                <table className="ws-table">
                    <thead>
                        <tr>
                            <th>Type</th>
                            <th>Amount</th>
                            <th>Requested By</th>
                            <th>Date</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading && filtered.length === 0 ? (
                            <ShimmerTableBodyRows rows={6} columns={6} />
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                    No approvals found
                                </td>
                            </tr>
                        ) : (
                            filtered.map((a) => {
                                const isSupplier = isSupplierSalesInvoiceRow(a);
                                const isPurchaseReturn = isAffiliatedPurchaseReturnRow(a);
                                const isSalesReturn = isSalesReturnRow(a);
                                const kindKey = isSupplier
                                    ? 'supplier_invoice'
                                    : isPurchaseReturn
                                      ? 'purchase_return'
                                      : isSalesReturn
                                        ? 'sales_return'
                                        : requestKindKey(a);
                                const pettyPending = !isSupplier && !isPurchaseReturn && !isSalesReturn && a.status === 'pending';
                                const rowActionable =
                                    (isSupplier && supplierRowCanAct(a)) ||
                                    (isPurchaseReturn &&
                                        a.status === 'pending' &&
                                        a.initiationMode !== 'workshop_initiated') ||
                                    (isSalesReturn && a.status === 'pending') ||
                                    pettyPending;
                                const allowApprove = rowActionable && canApproveType(a);
                                const allowReject  = rowActionable && canRejectType(a);
                                // Legacy single flag — kept so disabled prop falls back if either is true.
                                const canApproveReject = allowApprove || allowReject;
                                return (
                                    <tr key={a.id}>
                                        <td>
                                            <span className={`ws-badge ${typeColors[kindKey] || 'ws-badge--gray'}`}>
                                                {formatRequestKindLabel(a)}
                                            </span>
                                            {isSupplier && a.invoiceNo ? (
                                                <div
                                                    style={{
                                                        fontSize: '0.75rem',
                                                        color: 'var(--color-text-muted)',
                                                        marginTop: 4,
                                                    }}
                                                >
                                                    {a.invoiceNo}
                                                </div>
                                            ) : null}
                                            {isPurchaseReturn && a.returnNumber ? (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                                                    {a.returnNumber}
                                                    {a.invoiceNo ? ` · PI ${a.invoiceNo}` : ''}
                                                </div>
                                            ) : null}
                                            {isSalesReturn && a.invoiceNo ? (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                                                    Inv {a.invoiceNo}{a.returnScope ? ` · ${a.returnScope}` : ''}
                                                </div>
                                            ) : null}
                                        </td>
                                        <td>
                                            <strong>
                                                {currency} {(a.amount || 0).toLocaleString()}
                                            </strong>
                                            {isSupplier && a.outstanding != null && a.grandTotal != null ? (
                                                <div
                                                    style={{
                                                        fontSize: '0.75rem',
                                                        color: 'var(--color-text-muted)',
                                                        marginTop: 2,
                                                    }}
                                                >
                                                    Outstanding · {currency} {Number(a.outstanding).toLocaleString()} of{' '}
                                                    {Number(a.grandTotal).toLocaleString()}
                                                </div>
                                            ) : null}
                                        </td>
                                        <td>
                                            {isSupplier
                                                ? a.supplier?.name || 'Supplier'
                                                : isPurchaseReturn
                                                  ? a.supplierName || 'Supplier'
                                                  : isSalesReturn
                                                    ? a.cashierName || 'Cashier'
                                                    : a.cashier?.name || a.employee?.name || '—'}
                                        </td>
                                        <td style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                                            {formatDate(a.requestedAt)}
                                        </td>
                                        <td>
                                            <span className={`ws-badge ${statusColors[a.status] || 'ws-badge--gray'}`}>
                                                {a.status || 'unknown'}
                                            </span>
                                            {formatAdminWalletApproverSummary(a) ? (
                                                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 4, maxWidth: 180 }}>
                                                    {formatAdminWalletApproverSummary(a)}
                                                </div>
                                            ) : null}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                                {allowApprove && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleApproveRow(a)}
                                                    disabled={actionLoadingId !== null}
                                                    style={{
                                                        padding: 6,
                                                        borderRadius: 6,
                                                        border: 'none',
                                                        background: '#D1FAE5',
                                                        color: '#059669',
                                                        cursor: actionLoadingId === null ? 'pointer' : 'not-allowed',
                                                        opacity: actionLoadingId === null ? 1 : 0.45,
                                                    }}
                                                    title={isSupplier ? 'Accept invoice (workshop)' : 'Approve'}
                                                >
                                                    <CheckCircle size={14} />
                                                </button>
                                                )}
                                                {allowReject && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setRejectDialog(a);
                                                        setRejectReason('');
                                                    }}
                                                    disabled={actionLoadingId !== null}
                                                    style={{
                                                        padding: 6,
                                                        borderRadius: 6,
                                                        border: 'none',
                                                        background: '#FEE2E2',
                                                        color: '#DC2626',
                                                        cursor: actionLoadingId === null ? 'pointer' : 'not-allowed',
                                                        opacity: actionLoadingId === null ? 1 : 0.45,
                                                    }}
                                                    title={isSupplier ? 'Reject supplier invoice' : 'Reject'}
                                                >
                                                    <X size={14} />
                                                </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => setViewDialog(a)}
                                                    style={{
                                                        padding: '6px 10px',
                                                        borderRadius: 6,
                                                        border: '1px solid var(--color-border)',
                                                        background: isSupplier ? '#EFF6FF' : '#F9FAFB',
                                                        color: isSupplier ? '#1D4ED8' : '#374151',
                                                        cursor: 'pointer',
                                                        fontSize: '0.8125rem',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 6,
                                                    }}
                                                    title={
                                                        isSupplier
                                                            ? 'Open the printable supplier invoice'
                                                            : 'View request details'
                                                    }
                                                >
                                                    {isSupplier ? (
                                                        <>
                                                            <FileText size={14} /> View Invoice
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Eye size={14} /> Details
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
                </WsTableScroll>
            </div>

            {fundApproveModal ? (
                <AdminWalletWorkshopApproveModal
                    row={fundApproveModal}
                    mode="fund"
                    busy={actionLoadingId != null && String(actionLoadingId).startsWith('approve-aw-')}
                    error={fundApproveError}
                    onCancel={() => {
                        if (actionLoadingId !== null) return;
                        setFundApproveModal(null);
                        setFundApproveError('');
                    }}
                    onConfirm={submitAdminWalletFundApprove}
                />
            ) : null}

            {expenseApproveModal ? (
                <AdminWalletWorkshopApproveModal
                    row={expenseApproveModal}
                    mode="expense"
                    busy={actionLoadingId != null && String(actionLoadingId).startsWith('approve-aw-')}
                    error={fundApproveError}
                    onCancel={() => {
                        if (actionLoadingId !== null) return;
                        setExpenseApproveModal(null);
                        setFundApproveError('');
                    }}
                    onConfirm={submitAdminWalletExpenseApprove}
                />
            ) : null}

        </div>
    );
}
