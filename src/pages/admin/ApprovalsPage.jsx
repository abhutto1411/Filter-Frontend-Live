import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Check, X, Tag, User, Calendar, DollarSign, Package, ShoppingCart,
    RefreshCcw, ArrowRightLeft, FileText, Eye, Users, Settings, CreditCard,
    Loader, AlertCircle, Building2,
} from 'lucide-react';
import '../../styles/admin/ApprovalsPage.css';
import {
    list as listApprovals,
    approve as approveApi,
    reject as rejectApi,
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
    approveSuperAdminSalesReturn,
    rejectSuperAdminSalesReturn,
} from '../../services/superAdminApi';
import Modal from '../../components/Modal';
import ApprovalDetailsModal from './ApprovalDetailsModal';
import InvoiceDetailsModal from '../../components/pos/modern/InvoiceDetailsModal';
import { useAuth } from '../../context/AuthContext';

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
};

function approvalPermission(entityType, action) {
    const suffix = APPROVAL_TYPE_TO_PERMISSION_SUFFIX[entityType];
    if (!suffix) return null; // unknown type → no gate (open)
    return `approvals.${suffix}.${action}`;
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
        const code = approvalPermission(entityType, 'view');
        return code ? hasPermission(code) : true;
    }, [hasPermission]);
    const canApproveType = useCallback((entityType) => {
        const code = approvalPermission(entityType, 'approve');
        return code ? hasPermission(code) : hasPermission('approvals.approve');
    }, [hasPermission]);
    const canRejectType = useCallback((entityType) => {
        const code = approvalPermission(entityType, 'reject');
        return code ? hasPermission(code) : hasPermission('approvals.reject');
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
    const [rejectTarget, setRejectTarget] = useState(null);   // item

    // toast
    const [toast, setToast] = useState(null);
    const showToast = useCallback((msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

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

        // When the filter is narrowed to corporate_payment_approval, skip the
        // standard approvals endpoint entirely (it doesn't know that entityType).
        const stdReq = entityTypeFilter === 'corporate_payment_approval' || entityTypeFilter === 'sales_return'
            ? Promise.resolve([])
            : listApprovals({ status, entityType: entityTypeFilter }).then(
                (data) => unwrapApprovalsListResponse(data).map(normalizeItem),
            );
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

        Promise.all([stdReq, cpaReq, srReq])
            .then(([stdItems, cpaItems, srItems]) => {
                if (cancelled) return;
                const merged = [...srItems, ...cpaItems, ...stdItems];
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

    const removeFromList = useCallback((id) => {
        setItems((prev) => prev.filter((i) => i.id !== id));
    }, []);

    const isCorporatePriceQuotation = (et) =>
        et === 'corporate_price_quotation' || et === 'corporate_price_quotations';
    const isCorporatePaymentApproval = (et) => et === 'corporate_payment_approval';
    const isSalesReturnApproval = (et) => et === 'sales_return';

    const handleApproveConfirm = async (item, remarksOrPayload) => {
        setActionLoading(item.id);
        try {
            const payload =
                typeof remarksOrPayload === 'string'
                    ? (remarksOrPayload.trim() ? { remarks: remarksOrPayload.trim() } : {})
                    : (remarksOrPayload && typeof remarksOrPayload === 'object' ? remarksOrPayload : {});
            if (isCorporatePaymentApproval(item.entityType)) {
                await approveCorporatePaymentApproval(item.id);
            } else if (isSalesReturnApproval(item.entityType)) {
                await approveSuperAdminSalesReturn(item.id);
            } else if (isCorporatePriceQuotation(item.entityType)) {
                await approveSuperAdminCorporatePriceQuotation(item.id);
            } else {
                await approveApi(item.entityType, item.id, payload);
            }
            removeFromList(item.id);
            setApproveTarget(null);
            setDetailsTarget(null);
            showToast('Request approved.');
        } catch (err) {
            showToast(`Approve failed: ${err.message}`, 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const handleRejectConfirm = async (item, reason) => {
        setActionLoading(item.id);
        try {
            if (isCorporatePaymentApproval(item.entityType)) {
                await rejectCorporatePaymentApproval(item.id, reason);
            } else if (isSalesReturnApproval(item.entityType)) {
                await rejectSuperAdminSalesReturn(item.id, reason);
            } else if (isCorporatePriceQuotation(item.entityType)) {
                await rejectSuperAdminCorporatePriceQuotation(item.id, { reason });
            } else {
                await rejectApi(item.entityType, item.id, reason);
            }
            removeFromList(item.id);
            setRejectTarget(null);
            setDetailsTarget(null);
            showToast('Request rejected.');
        } catch (err) {
            showToast(`Reject failed: ${err.message}`, 'error');
        } finally {
            setActionLoading(null);
        }
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
                                                    disabled={actionLoading === item.id}
                                                    onClick={() => setApproveTarget(item)}
                                                >
                                                    {actionLoading === item.id ? <Loader size={14} className="spin" /> : <Check size={16} />} Approve
                                                </button>
                                            )}
                                            {allowReject && (
                                                <button
                                                    type="button"
                                                    className="btn-reject"
                                                    disabled={actionLoading === item.id}
                                                    onClick={() => setRejectTarget(item)}
                                                >
                                                    {actionLoading === item.id ? <Loader size={14} className="spin" /> : <X size={16} />} Reject
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

            {detailsTarget && detailsTarget.entityType !== 'corporate_payment_approval' && (
                <ApprovalDetailsModal
                    entityType={detailsTarget.entityType}
                    id={detailsTarget.id}
                    onClose={() => setDetailsTarget(null)}
                    actionDisabled={actionLoading === detailsTarget.id}
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
                    busy={actionLoading === approveTarget.id}
                    onCancel={() => setApproveTarget(null)}
                    onConfirm={(payload) => handleApproveConfirm(approveTarget, payload)}
                />
            ) : approveTarget ? (
                <ApproveModal
                    item={approveTarget}
                    busy={actionLoading === approveTarget.id}
                    onCancel={() => setApproveTarget(null)}
                    onConfirm={(remarks) => handleApproveConfirm(approveTarget, remarks)}
                />
            ) : null}

            {rejectTarget && (
                <RejectModal
                    item={rejectTarget}
                    busy={actionLoading === rejectTarget.id}
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
