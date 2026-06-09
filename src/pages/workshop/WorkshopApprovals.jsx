import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clock, CheckCircle, X, Eye, RefreshCw, FileText } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import { ShimmerTableBodyRows, ShimmerTextBlock } from '../../components/supplier/Shimmer';
import WorkshopPurchaseInvoiceView from '../../components/supplier/WorkshopPurchaseInvoiceView';
import { apiFetch } from '../../services/api';
import { qs, branchScopeParams, getWorkshopSalesReturns, approveWorkshopSalesReturn, rejectWorkshopSalesReturn } from '../../services/workshopStaffApi';
import { useAuth } from '../../context/AuthContext';

function isSalesReturnRow(row) {
    return row?._source === 'sales_return';
}

/** Map a row kind → permission-code suffix. */
function approvalTypeKey(row) {
    if (isSupplierSalesInvoiceRow(row)) return 'supplier-invoice';
    if (isSalesReturnRow(row)) return 'sales-return';
    if (isTopUpRequest(row)) return 'top-up';
    if (isExpenseRequest(row)) return 'expense';
    return null;
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
        items: items.map((it) => ({
            id: it.id,
            productName: it.productName,
            product_name: it.productName,
            qty: it.qty,
            quantity: it.qty,
            unit: 'piece',
            uom: 'piece',
            unitPrice: it.unitPrice,
            unit_price: it.unitPrice,
            unitPriceExVat: it.unitPrice,
            vatRate: it.vatRate,
            vat_rate: it.vatRate,
            lineTotal: it.lineTotal,
            line_total: it.lineTotal,
        })),
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
    if (isSalesReturnRow(row)) return 'Sales return';
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
}) {
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
    /** Imperative handle for the printable invoice template (Download PDF). */
    const printableInvoiceRef = useRef(null);
    const [currency, setCurrency] = useState('SAR');
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [actionLoadingId, setActionLoadingId] = useState(null);
    /** Supplier invoice approve: preview showed new branch products — collect optional critical stock */
    const [siApproveModal, setSiApproveModal] = useState(null);
    const [siCriticalStock, setSiCriticalStock] = useState({});

    const loadApprovals = useCallback(async () => {
        setIsLoading(true);
        setLoadError('');
        try {
            const pettyQs = pettyCashListQuery(queueFilter, selectedBranchId);
            const loadSupplierInvoices =
                queueFilter === 'all' || queueFilter === 'pending';

            // Supplier invoices are workshop-wide unless the user is branch-locked.
            // Sidebar branch selection must not hide invoices for other branches.
            const supplierBranchScope = branchLockedId
                ? branchScopeParams(branchLockedId)
                : {};
            const [response, siRes, srRes] = await Promise.all([
                apiFetch(`/workshop-staff/petty-cash/requests${qs(pettyQs)}`),
                loadSupplierInvoices
                    ? apiFetch(
                          `/workshop-staff/supplier-sales-invoices${qs({
                              limit: 100,
                              offset: 0,
                              ...supplierBranchScope,
                          })}`,
                      ).catch(() => null)
                    : Promise.resolve(null),
                queueFilter === 'all' || queueFilter === 'pending'
                    ? getWorkshopSalesReturns({
                          status: 'pending',
                          limit: 100,
                          offset: 0,
                          ...branchScopeParams(selectedBranchId),
                      }).catch(() => null)
                    : Promise.resolve(null),
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

            const merged = [...supplierRows, ...salesReturnRows, ...list].sort((a, b) => {
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

    const filtered = useMemo(() => {
        return approvals.filter((a) => {
            // Per-type view permission — hide rows the user can't view at all.
            if (!canViewType(a)) return false;
            if (requestTypeFilter === 'all') return true;
            if (requestTypeFilter === 'topup') return isTopUpRequest(a);
            if (requestTypeFilter === 'expenses') return isExpenseRequest(a);
            if (requestTypeFilter === 'supplier_invoices') return isSupplierSalesInvoiceRow(a);
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
        supplier_invoice: 'ws-badge--purple',
        sales_return: 'ws-badge--blue',
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
        if (isSupplierSalesInvoiceRow(row)) {
            if (!supplierRowCanAct(row)) return;
            const sid = row.supplierInvoiceId;
            const branchLabel = row.branchName || row.branch_name || 'this branch';
            setActionLoadingId(`approve-si-${sid}`);
            try {
                const preview = await apiFetch(
                    `/workshop-staff/supplier-sales-invoices/${encodeURIComponent(String(sid))}/approval-preview`,
                );
                const needsSetupModal =
                    Boolean(preview?.hasNewProducts) ||
                    (Array.isArray(preview?.unresolvedLineNames) && preview.unresolvedLineNames.length > 0);
                if (needsSetupModal) {
                    const init = {};
                    (preview.newProducts || []).forEach((p) => {
                        init[String(p.productId)] = '0';
                    });
                    setSiCriticalStock(init);
                    setSiApproveModal({ row, preview });
                    return;
                }
                const ok = window.confirm(
                    `Approve supplier invoice ${row.invoiceNo || ''}?\n\n` +
                        `Preview: all invoice lines are already on "${branchLabel}" inventory (or only stock increases apply). ` +
                        `On-hand quantities will go up by the amounts on this invoice.\n\n` +
                        `This action cannot be undone.`,
                );
                if (!ok) {
                    setActionLoadingId(null);
                    return;
                }
                await apiFetch(`/workshop-staff/supplier-sales-invoices/${encodeURIComponent(String(sid))}/approve`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}),
                });
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
            return;
        }
        const id = row.id;
        if (row.status !== 'pending') return;
        setActionLoadingId(`approve-${id}`);
        try {
            await apiFetch(`/workshop-staff/petty-cash/${id}/approve`, { method: 'POST' });
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
        const id = rejectDialog.id;
        setActionLoadingId(`reject-${id}`);
        try {
            await apiFetch(`/workshop-staff/petty-cash/${id}/reject`, {
                method: 'POST',
                body: JSON.stringify({ rejectionReason: rejectReason.trim() }),
            });
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
            await apiFetch(`/workshop-staff/supplier-sales-invoices/${encodeURIComponent(String(sid))}/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ criticalStockByProductId }),
            });
            setSiApproveModal(null);
            setSiCriticalStock({});
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
                                const isSalesReturn = isSalesReturnRow(a);
                                const kindKey = isSupplier ? 'supplier_invoice' : isSalesReturn ? 'sales_return' : requestKindKey(a);
                                const pettyPending = !isSupplier && !isSalesReturn && a.status === 'pending';
                                const rowActionable =
                                    (isSupplier && supplierRowCanAct(a)) ||
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
            </div>

            <AnimatePresence>
                {rejectDialog && (
                    <Modal
                        title={
                            isSupplierSalesInvoiceRow(rejectDialog)
                                ? 'Reject supplier invoice'
                                : 'Reject approval'
                        }
                        onClose={() => {
                            setRejectDialog(null);
                            setRejectReason('');
                        }}
                        footer={
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                <button
                                    className="btn-secondary"
                                    onClick={() => {
                                        setRejectDialog(null);
                                        setRejectReason('');
                                    }}
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
                        }
                    >
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
                    </Modal>
                )}
                {siApproveModal && (
                    <Modal
                        title="Products will be added to branch inventory"
                        width="560px"
                        onClose={() => {
                            if (actionLoadingId) return;
                            setSiApproveModal(null);
                            setSiCriticalStock({});
                        }}
                        footer={
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => {
                                        setSiApproveModal(null);
                                        setSiCriticalStock({});
                                    }}
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
                        }
                    >
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
                        </div>
                    </Modal>
                )}
                {viewDialog && (
                    <Modal
                        title={isSupplierSalesInvoiceRow(viewDialog) ? 'Supplier invoice' : 'Approval Details'}
                        onClose={() => setViewDialog(null)}
                        width={isSupplierSalesInvoiceRow(viewDialog) ? '1100px' : undefined}
                    >
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
                                    <span>{viewDialog.branch?.name || '—'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--color-text-muted)' }}>Reason</span>
                                    <span style={{ textAlign: 'right', maxWidth: 220 }}>{viewDialog.reason || '—'}</span>
                                </div>
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
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}
