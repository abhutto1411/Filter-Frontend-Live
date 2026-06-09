import { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, Search, Plus, Receipt, X, AlertCircle } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { resolvePlateDisplay } from '../../utils/formatPlate';
import { usePOS } from '../../context/POSContext';
import { useAuth } from '../../context/AuthContext';

// New Modern Components
import OrderList from './modern/OrderList';
import JobCard from './modern/JobCard';
import SummaryPanel from './modern/SummaryPanel';
import ProductSelectionModal from './modern/ProductSelectionModal';
import TechnicianAssignmentModal from './modern/TechnicianAssignmentModal';
import DepartmentSelectionModal from './modern/DepartmentSelectionModal';
import WalkInOrderModal from './modern/WalkInOrderModal';
import CancelReasonModal from './modern/CancelReasonModal';
import CustomerDetailsModal from './modern/CustomerDetailsModal';
import PaymentSelectionModal from './modern/PaymentSelectionModal';
import InvoiceDetailsModal from './modern/InvoiceDetailsModal';

import './OrdersScreen.css';
import './modern/ModernPOS.css';

const PAYMENT_METHODS = ['Cash', 'Card', 'Bank Transfer', 'Tamara', 'Tabby', 'Monthly billing'];

export default function OrdersScreen({ onNewOrder, autoSelectOrderId, onAutoSelectConsumed }) {
    const { user } = useAuth();
    const { orders, refreshOrders, socket, loading: contextLoading, catalog, refreshCatalog, catalogLoading } = usePOS();
    const [refreshing, setRefreshing] = useState(false);
    const [tab, setTab] = useState('All');
    const [search, setSearch] = useState('');
    const [selectedId, setSelectedId] = useState(null);
    const [actionLoading, setActionLoading] = useState(null);
    const [activeModal, setActiveModal] = useState(null); // 'product' | 'technician' | 'department'
    const [editingJob, setEditingJob] = useState(null);
    const [jobData, setJobData] = useState({}); // { jobKey: { products: [], techs: [] } }
    const [availableTechs, setAvailableTechs] = useState([]);
    const [confirmEditJob, setConfirmEditJob] = useState(null); // { job, type }
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelJobTarget, setCancelJobTarget] = useState(null); // { id, departmentName, status }
    const [invoiceDetails, setInvoiceDetails] = useState(null); // populated after successful invoice
    const [workshopDepts, setWorkshopDepts] = useState([]);
    const [localPayments, setLocalPayments] = useState(null);

    // Initial fetch
    useEffect(() => {
        if (orders.length === 0) refreshOrders();
        if (catalog.length === 0) refreshCatalog();

        const fetchMeta = async () => {
            try {
                // Fetch Technicians
                try {
                    const techRes = await apiFetch('/cashier/technicians');
                    const techs = Array.isArray(techRes) ? techRes : (techRes.data || techRes.technicians || []);
                    setAvailableTechs(techs);
                } catch (techErr) {
                    if (techErr.message?.includes('supplier_id')) {
                        console.warn('Technician list unavailable: Backend migration pending for supplier_id.');
                    } else {
                        console.error('Failed to fetch technicians:', techErr);
                    }
                }

                // Fetch Departments
                try {
                    const posBranchId = user?.branchId || user?.branch_id;
                    const deptPath =
                        posBranchId != null && posBranchId !== ''
                            ? `/workshop-staff/departments?branchId=${encodeURIComponent(String(posBranchId))}`
                            : '/workshop-staff/departments';
                    const deptRes = await apiFetch(deptPath);
                    const depts = Array.isArray(deptRes) ? deptRes : (deptRes.departments || []);
                    setWorkshopDepts(depts);
                } catch (deptErr) {
                    console.error('Failed to fetch departments:', deptErr);
                }
            } catch (e) { 
                console.error('Failed to fetch meta overall:', e);
            }
        };
        fetchMeta();
    }, [refreshOrders, refreshCatalog, orders.length, catalog.length, user?.branchId, user?.branch_id]);

    // Match Flutter reference pattern (PosOrder.draftPosOrderTotalDisplay + _parseJobTotalAmount):
    // prefer backend's authoritative VAT-inclusive totals; recompute locally ONLY when the user
    // has unsaved edits in jobData for a given job, or when backend hasn't stored any total yet.
    // This keeps the UI value and the /invoice/create validation target in sync — backend rejects
    // payments that don't match ITS total, so the UI must reflect that exact figure.
    const pickJobBackendTotal = (job) => {
        for (const k of ['totalAmount', 'total_amount', 'grandTotal', 'grand_total', 'finalTotal', 'final_total']) {
            const v = parseFloat(job?.[k]);
            if (!isNaN(v) && v > 0) return v;
        }
        return 0;
    };

    const calculateOrderTotal = useCallback((order) => {
        if (!order) return 0;
        const jobs = order.jobs || [];

        // Preferred: use backend's authoritative values for jobs without pending local edits.
        // Any job currently being edited (jobData[jobId] present) is recomputed from cart items.
        let total = 0;
        let hasAnyLocalEdit = false;
        jobs.forEach(job => {
            const jobKey = job.id;
            const local = jobData[jobKey];
            if (local) {
                // User is actively editing this job — compute from their cart (incl. VAT on top).
                hasAnyLocalEdit = true;
                const items = local.products || [];
                const totalDiscType = local.totalDiscountType || 'amount';
                const totalDiscVal = parseFloat(local.totalDiscountValue || 0) || 0;
                const vatRate = parseFloat(local.VAT !== undefined && local.VAT !== null ? local.VAT : 15);
                let sub = 0;
                let itemDiscs = 0;
                items.forEach(item => {
                    const price = parseFloat(item.unitPrice || item.price || 0);
                    const qty = parseFloat(item.qty || 1);
                    const row = price * qty;
                    const disc = item.discountType === 'percentage' || item.discountType === 'percent'
                        ? (row * (item.discountValue || 0) / 100)
                        : (item.discountValue || 0);
                    sub += row;
                    itemDiscs += disc;
                });
                const afterItems = sub - itemDiscs;
                const globalDisc = (totalDiscType === 'percentage' || totalDiscType === 'percent')
                    ? (afterItems * totalDiscVal / 100)
                    : totalDiscVal;
                const taxable = Math.max(0, afterItems - globalDisc);
                total += taxable + (taxable * (vatRate / 100));
            } else {
                // No local edit — trust backend's stored job total (reference: _parseJobTotalAmount).
                total += pickJobBackendTotal(job);
            }
        });

        // If no jobs had local edits and backend has a rollup total, prefer that (reference: order.totalAmount path).
        if (!hasAnyLocalEdit) {
            const orderTotal = parseFloat(order.totalAmount ?? order.total_amount ?? order.grandTotal ?? order.grand_total ?? 0) || 0;
            if (orderTotal > 0) return orderTotal;
        }
        return total;
    }, [jobData]);


    const processJobCompletion = async (job) => {
        const jobId = job.id;
        const jobKey = job.id || job.jobKey;
        
        // Robust selection: If jobData is missing (auto-completing draft), fallback to backend items
        let selections = jobData[jobKey];
        if (!selections) {
            selections = {
                products: (job.items || []).map(item => ({
                    ...item,
                    id: String(item.productId || item.serviceId || item.id),
                    isService: !!item.serviceId,
                    price: parseFloat(item.unitPrice || item.price || 0),
                    qty: item.qty || 1,
                    discountType: item.discountType || 'amount',
                    discountValue: parseFloat(item.discountValue || item.discount || 0)
                })),
                techs: (job.assignments || job.technicians || []).map(t => ({
                    id: t.employeeId || t.id,
                    name: t.employeeName || t.name || 'Technician'
                })),
                VAT: job.VAT !== undefined && job.VAT !== null ? job.VAT : 15,
                totalDiscountType: job.totalDiscountType || 'amount',
                totalDiscountValue: job.totalDiscountValue || 0,
                promoCode: job.promoCode || '',
                promoCodeId: job.promoCodeId || ''
            };
        }
        
        // 1. Assign technicians (Wrap in try/catch to avoid blocking completion on backend migration issues)
        if (selections.techs?.length > 0) {
            const techIds = selections.techs
                .map(t => t.id || t.employeeId)
                .filter(id => id && id !== 'undefined');
            if (techIds.length > 0) {
                try {
                    await apiFetch(`/cashier/job/${jobId}/assign`, {
                        method: 'POST',
                        body: JSON.stringify({ employeeIds: techIds, sync: true })
                    });
                } catch (assignErr) {
                    console.error('Technician Assignment Failed (Proceeding anyway):', assignErr);
                    // Don't throw, just warn the user but continue with pricing/completion
                    if (assignErr.message?.includes('employees.supplier_id')) {
                        console.warn('Backend database migration pending for supplier_id. Skipping assignment.');
                    }
                }
            }
        }

        // 2. Build and save pricing
        const pricingPayload = {
            products: (selections.products || []).filter(p => !p.isService).map(p => {
                const beforePrice = (p.price || 0) * (p.qty || 1);
                const afterPrice = p.discountType === 'percentage' 
                    ? beforePrice * (1 - (p.discountValue || 0) / 100)
                    : Math.max(0, beforePrice - (p.discountValue || 0));
                return {
                    productId: p.id,
                    departmentId: String(p.deptId || job.departmentId || '0'),
                    qty: p.qty || 1,
                    discountType: p.discountType || 'amount',
                    discountValue: p.discountValue || 0,
                    beforeDiscountPrice: beforePrice,
                    afterDiscountPrice: afterPrice
                };
            }),
            services: (selections.products || []).filter(p => p.isService).map(s => {
                const beforePrice = (s.price || 0) * (s.qty || 1);
                const afterPrice = s.discountType === 'percentage' 
                    ? beforePrice * (1 - (s.discountValue || 0) / 100)
                    : Math.max(0, beforePrice - (s.discountValue || 0));
                return {
                    serviceId: s.id,
                    departmentId: String(s.deptId || job.departmentId || '0'),
                    qty: s.qty || 1,
                    discountType: s.discountType || 'amount',
                    discountValue: s.discountValue || 0,
                    unitPrice: s.price || 0,
                    beforeDiscountPrice: beforePrice,
                    afterDiscountPrice: afterPrice
                };
            }),
            totalDiscountType: selections.totalDiscountType || 'amount',
            totalDiscountValue: selections.totalDiscountValue || 0,
            promoCode: selections.promoCode || '',
            promoCodeId: selections.promoCodeId || '',
            VAT: selections.VAT !== undefined && selections.VAT !== null ? selections.VAT : 15
        };

        // Unified mark-complete: pricing + readiness + completion in one request.
        console.log(`[OrdersScreen] Complete Job ${jobId} (unified)`, pricingPayload);
        await apiFetch(`/cashier/job/${jobId}/complete-cashier`, {
            method: 'POST',
            body: JSON.stringify(pricingPayload),
        });
    };


    const handleGenerateInvoiceByOrder = async () => {
        if (!selected) return;
        if (!localPayments) {
            setActiveModal('payment');
            return;
        }
        try {
            setActionLoading('generating-invoice');

            const uiTotal = calculateOrderTotal(selected);
            const backendTotal = parseFloat(selected.grandTotal ?? selected.totalAmount ?? selected.total ?? 0);

            // Sync Logic: If it's a draft OR if the backend total differs from our UI calculation (VAT missing)
            if (selected.status === 'draft' || Math.abs(uiTotal - backendTotal) > 0.1) {
                console.log(`[OrdersScreen] Syncing prices before invoice: UI(${uiTotal.toFixed(2)}) vs Backend(${backendTotal.toFixed(2)})`);
                const jobs = selected.jobs || [];
                for (const job of jobs) {
                    try {
                        await processJobCompletion(job);
                    } catch (completeErr) {
                        console.warn(`Failed to sync job ${job.id}:`, completeErr);
                    }
                }
                await refreshOrders();
                // Do NOT compare UI total against order.grandTotal here — that field is pre-VAT on
                // the backend, while UI total is VAT-inclusive. Reference Flutter app trusts the
                // invoice endpoint to reconcile payments; we do the same. If payments truly don't
                // match, the catch block below self-heals by re-opening the payment modal.
            }

            const estimatedTotal = calculateOrderTotal(selected)
                || parseFloat(selected.grandTotal ?? selected.totalAmount ?? selected.total ?? 0)
                || 0;

            let paymentsOut = (localPayments.payments || [])
                .map(p => ({ method: p.method, amount: parseFloat(p.amount) || 0 }))
                .filter(p => p.method && p.amount > 0);

            if (paymentsOut.length === 0 && localPayments.method) {
                paymentsOut = [{ method: localPayments.method, amount: estimatedTotal }];
            } else if (paymentsOut.length === 1 && estimatedTotal > 0) {
                paymentsOut = [{ method: paymentsOut[0].method, amount: estimatedTotal }];
            } else if (paymentsOut.length > 1 && estimatedTotal > 0) {
                const userSum = paymentsOut.reduce((s, p) => s + p.amount, 0);
                if (userSum > 0 && Math.abs(userSum - estimatedTotal) > 0.01) {
                    const ratio = estimatedTotal / userSum;
                    let allocated = 0;
                    paymentsOut = paymentsOut.map((p, i) => {
                        if (i === paymentsOut.length - 1) {
                            return { method: p.method, amount: Math.round((estimatedTotal - allocated) * 100) / 100 };
                        }
                        const scaled = Math.round(p.amount * ratio * 100) / 100;
                        allocated += scaled;
                        return { method: p.method, amount: scaled };
                    });
                }
            }

            if (paymentsOut.length === 0) {
                throw new Error('Payment method is required before generating invoice.');
            }

            // Single call: create invoice with payment snapshot (backend returns full invoice).
            const createRes = await apiFetch('/cashier/invoice/create', {
                method: 'POST',
                body: JSON.stringify({
                    orderId: selected.id,
                    discountAmount: 0,
                    invoiceDate: new Date().toISOString(),
                    ...(localPayments.method ? { paymentMethod: localPayments.method } : {}),
                    payments: paymentsOut,
                })
            });

            setLocalPayments(null);

            const resolvedInvoice =
                createRes?.invoice
                || createRes?.data?.invoice
                || createRes?.data
                || createRes
                || null;
            if (resolvedInvoice) {
                // Backend invoice response typically only carries totals — line items
                // live in the order's jobs. Merge them so the modal can display details.
                const enriched = {
                    ...resolvedInvoice,
                    // Inject order jobs if invoice doesn't already carry items
                    jobs: resolvedInvoice.jobs || resolvedInvoice.order?.jobs || selected.jobs || [],
                    // Customer & vehicle fallback from the selected order
                    customerName: resolvedInvoice.customerName || selected.customerName,
                    customerMobile: resolvedInvoice.customerMobile || selected.customerMobile,
                    customerTaxId: resolvedInvoice.customerTaxId || selected.customerTaxId,
                    plateNo: resolvedInvoice.plateNo || selected.plateNumber,
                    vehicleModel: resolvedInvoice.vehicleModel || (selected.vehicleInfo || '').split(' ')[1] || '',
                    vehicleMake: resolvedInvoice.vehicleMake || (selected.vehicleInfo || '').split(' ')[0] || '',
                    odometerReading: resolvedInvoice.odometerReading || selected.odometer,
                };
                console.log('[InvoiceDebug] enriched keys:', Object.keys(enriched), 'jobs:', enriched.jobs?.length, 'job items:', enriched.jobs?.flatMap(j => j.items || []).length);
                setInvoiceDetails(enriched);
            }

            await refreshOrders();
        } catch (e) {
            console.error('Failed to generate invoice by order:', e);
            // Self-heal: if backend rejected due to payment/total mismatch, clear stale payments
            // and re-open the payment modal so the user can enter fresh amounts against the new total.
            if (/do not match invoice total|exceeds remaining amount|payment amount.*exceeds/i.test(e.message || '')) {
                setLocalPayments(null);
                await refreshOrders();
                alert('Invoice total was updated after sync. Please re-enter payment details for the new total.');
                setActiveModal('payment');
            } else {
                alert('Failed to generate invoice: ' + (e.message || 'Please try again.'));
            }
        } finally {
            setActionLoading(null);
        }
    };

    const toggleProductSelection = (jobKey, product) => {
        setJobData(prev => {
            const current = prev[jobKey] || { 
                products: [], 
                techs: [], 
                totalDiscountType: 'amount', 
                totalDiscountValue: 0,
                promoCode: '',
                promoCodeId: '',
                VAT: 15
            };
            const existingIndex = current.products.findIndex(p => String(p.id) === String(product.id));
            
            let nextProducts;
            if (existingIndex > -1) {
                nextProducts = current.products.map((p, idx) => 
                    idx === existingIndex ? { ...p, qty: (p.qty || 1) + 1 } : p
                );
            } else {
                nextProducts = [...current.products, { 
                    ...product, 
                    qty: 1,
                    discountType: 'amount',
                    discountValue: 0
                }];
            }
            return { ...prev, [jobKey]: { ...current, products: nextProducts } };
        });
    };

    const updateProductQty = (jobKey, productId, delta) => {
        setJobData(prev => {
            const current = prev[jobKey] || { products: [], techs: [] };
            const nextProducts = current.products.map(p => {
                if (p.id === productId) {
                    const newQty = (p.qty || 1) + delta;
                    return newQty > 0 ? { ...p, qty: newQty } : null;
                }
                return p;
            }).filter(Boolean);
            return { ...prev, [jobKey]: { ...current, products: nextProducts } };
        });
    };

    const toggleTechSelection = (jobKey, tech) => {
        setJobData(prev => {
            const current = prev[jobKey] || { products: [], techs: [] };
            const exists = current.techs.find(t => t.id === tech.id);
            const nextTechs = exists 
                ? current.techs.filter(t => t.id !== tech.id)
                : [...current.techs, tech];
            return { ...prev, [jobKey]: { ...current, techs: nextTechs } };
        });
    };

    const mappedOrders = useMemo(() => {
        return orders.map(o => ({
            id: o.id,
            orderNumber: o.orderNumber || o.order_number || o.id?.slice?.(-6) || o.id,
            customerName: o.customerName || o.customer?.name || o.guestName || 'Walk-in Customer',
            plateNumber: resolvePlateDisplay(o) || o.vehiclePlate || '',
            status: o.status || 'active',
            total: parseFloat(o.grandTotal ?? o.totalAmount ?? o.total ?? 0) || 0,
            jobs: o.jobs || [],
            pendingDepartments: o.pendingDepartments || [],
            jobsCount: o.jobsCount || (o.jobs || []).length || 1,
            createdAt: o.createdAt,
            odometer: o.odometerReading || o.odometer || '',
            vehicleInfo: o.vehicle ? `${o.vehicle.make || ''} ${o.vehicle.model || ''} ${o.vehicle.year || ''}`.trim() : '',
            customerMobile: o.customer?.mobile || '',
            customerTaxId: o.customer?.taxId || '',
        }));
    }, [orders]);

    // Match reference PosOrder.jsobsAggregateBadgeLabel — completion is derived from the aggregate
    // state of non-cancelled jobs, NOT the order-level status field. 'edited' counts as COMPLETED
    // so a completed-then-edited job doesn't jump back to the Pending tab while the cashier is
    // still working through re-invoicing.
    const jobsAggregateBadge = (order) => {
        const jobs = order.jobs || [];
        if (jobs.length === 0) return 'DRAFT';
        const active = jobs.filter(j => !['cancelled', 'rejected_by_technician'].includes((j.status || '').toLowerCase()));
        if (active.length === 0) return 'PENDING';
        const allDone = active.every(j => {
            const s = (j.status || '').toLowerCase();
            return s === 'completed' || s === 'invoiced' || s === 'edited' || s === 'finished';
        });
        return allDone ? 'COMPLETED' : 'PENDING';
    };

    const filtered = useMemo(() => {
        let list = mappedOrders.filter(o => (o.status || '').toLowerCase() !== 'cancelled');
        if (tab === 'Pending') {
            list = list.filter(o => jobsAggregateBadge(o) !== 'COMPLETED');
        } else if (tab === 'Completed') {
            list = list.filter(o => jobsAggregateBadge(o) === 'COMPLETED');
        }
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter(o => (o.orderNumber + ' ' + o.customerName + ' ' + o.plateNumber).toLowerCase().includes(q));
        }
        list.sort((a, b) => {
            try {
                const ai = BigInt(String(a.id ?? '0'));
                const bi = BigInt(String(b.id ?? '0'));
                if (ai < bi) return -1;
                if (ai > bi) return 1;
                return 0;
            } catch {
                return String(a.id ?? '').localeCompare(String(b.id ?? ''));
            }
        });
        return list;
    }, [mappedOrders, tab, search]);

    const selected = useMemo(() => filtered.find(o => o.id === selectedId) || filtered[0], [filtered, selectedId]);

    const handleUpdateSummaryItem = (jobId, itemId, field, value) => {
        setJobData(prev => {
            const jobKey = jobId;
            const currentJob = prev[jobKey] || { products: [], techs: [] };
            
            // If we don't have local draft yet, initialize from the order object
            let products = [...currentJob.products];
            if (products.length === 0) {
                const jobObj = selected.jobs.find(j => j.id === jobId);
                if (jobObj) {
                    products = (jobObj.items || []).map(item => ({
                        ...item,
                        id: String(item.productId || item.serviceId || item.id),
                        name: item.productName || item.product?.name || item.service?.name || item.name || 'Item',
                        price: parseFloat(item.unitPrice || item.price || 0),
                        qty: item.qty || 1,
                        discount: parseFloat(item.discount || 0),
                        isService: !!item.serviceId,
                        allowDecimalQty: !!item.allowDecimalQty
                    }));
                }
            }

            const nextProducts = products.map(p => {
                if (p.id === itemId) {
                    if (field === 'qty') return { ...p, qty: Math.max(1, p.qty + value) };
                    if (field === 'discount') return { ...p, discountValue: value };
                    if (field === 'discountType') return { ...p, discountType: value };
                }
                return p;
            });

            return {
                ...prev,
                [jobKey]: { ...currentJob, products: nextProducts }
            };
        });
    };

    const handleUpdateGlobalPricing = (jobId, field, value) => {
        setJobData(prev => ({
            ...prev,
            [jobId]: { ...(prev[jobId] || {}), [field]: value }
        }));
    };

    const markJobComplete = async (job, isAlreadyDone) => {
        const jobId = job?.id || job?.jobId;
        console.log('Marking Job Complete:', { jobId, jobStatus: job?.status, isAlreadyDone });

        if (!jobId || jobId === 'undefined') {
            console.error('Missing Job ID:', job);
            alert('Cannot complete job: Missing Job ID.');
            return;
        }

        setActionLoading(jobId);
        try {
            if (isAlreadyDone) {
                // Reference: PATCH /cashier/job/:id/mark-edited with empty body transitions
                // completed → edited on the backend. Sending { status: 'pending' } is wrong —
                // the backend decides the target state (edited) from this endpoint alone.
                console.log('Reverting job via /mark-edited (backend → edited)...');
                await apiFetch(`/cashier/job/${jobId}/mark-edited`, {
                    method: 'PATCH',
                    body: JSON.stringify({})
                });
            } else {
                await processJobCompletion(job);
            }

            refreshOrders();
            // Clear local jobData
            setJobData(prev => {
                const next = { ...prev };
                const key = job.id || job.jobKey;
                delete next[key];
                return next;
            });
        } catch (e) {
            console.error('Job Completion Error:', e);
            alert(`Completion Error: ${e.message || 'Check console for details'}`);
        } finally {
            setActionLoading(null);
        }
    };

    // Reference: PATCH /cashier/job/:jobId/cancel  body: { reason }
    // Cancels a single department/job before invoicing. Backend rejects invoiced jobs.
    // UI flow: clicking the X on a JobCard opens the CancelReasonModal (via cancelJobTarget state),
    // and the modal's onConfirm invokes performCancelJob with the reason.
    const handleCancelJob = (job) => {
        const jobId = job?.id || job?.jobId;
        if (!jobId || jobId === 'undefined') {
            alert('Cannot cancel: Missing Job ID.');
            return;
        }
        const statusLower = (job.status || '').toLowerCase();
        if (statusLower === 'invoiced') {
            alert('Invoiced jobs cannot be cancelled.');
            return;
        }
        if (['cancelled', 'rejected_by_technician'].includes(statusLower)) {
            alert('This job is already cancelled.');
            return;
        }
        setCancelJobTarget({
            id: jobId,
            jobKey: job.jobKey,
            departmentName: job.departmentName || job.department?.name || job.department || 'this department',
        });
    };

    const performCancelJob = async (reason) => {
        if (!cancelJobTarget) return;
        const { id: jobId, jobKey } = cancelJobTarget;
        setActionLoading(`cancel-${jobId}`);
        try {
            await apiFetch(`/cashier/job/${jobId}/cancel`, {
                method: 'PATCH',
                body: JSON.stringify({ reason: reason || 'Cancelled by cashier' })
            });
            // Drop any local draft for this job so the fresh server status takes effect
            setJobData(prev => {
                const next = { ...prev };
                delete next[jobId];
                if (jobKey) delete next[jobKey];
                return next;
            });
            setCancelJobTarget(null);
            await refreshOrders();
        } catch (e) {
            console.error('Cancel Job Error:', e);
            alert(`Could not cancel job: ${e.message || 'Please try again.'}`);
        } finally {
            setActionLoading(null);
        }
    };



    const handleCancelOrder = async (reason) => {
        if (!selected?.id) return;
        
        setActionLoading('cancelling-order');
        try {
            await apiFetch(`/cashier/order/${selected.id}/cancel`, {
                method: 'POST',
                body: JSON.stringify({ reason: reason || 'Cancelled by cashier' })
            });
            refreshOrders();
            setSelectedId(null);
            setShowCancelModal(false);
            alert("Order cancelled successfully.");
        } catch (err) {
            alert("Failed to cancel order: " + err.message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleAddJob = async (dept) => {
        if (!selected?.id) return;
        setActionLoading('adding-job');
        try {
            await apiFetch(`/cashier/order/${selected.id}/jobs`, {
                method: 'POST',
                body: JSON.stringify({ departmentIds: [String(dept.id)] })
            });
            setActiveModal(null);
            await refreshOrders();
        } catch (err) {
            alert("Failed to add job: " + err.message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleWalkInSubmit = async (data) => {
        setActionLoading('creating-walkin');
        try {
            await apiFetch('/cashier/walk-in-order', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            setActiveModal(null);
            await refreshOrders();
        } catch (err) {
            alert("Failed to create walk-in order: " + err.message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleSaveProducts = async (jobId) => {
        setActionLoading('saving-products');
        try {
            const data = jobData[jobId] || {};
            const payload = {
                products: (data.products || []).filter(p => !p.isService).map(p => {
                    const beforePrice = p.price * p.qty;
                    const afterPrice = p.discountType === 'percentage' 
                        ? beforePrice * (1 - (p.discountValue || 0) / 100)
                        : Math.max(0, beforePrice - (p.discountValue || 0));
                    
                    return {
                        productId: p.id,
                        departmentId: String(p.deptId || editingJob?.departmentId),
                        qty: p.qty,
                        discountType: p.discountType || 'amount',
                        discountValue: p.discountValue || 0,
                        beforeDiscountPrice: beforePrice,
                        afterDiscountPrice: afterPrice
                    };
                }),
                services: (data.products || []).filter(p => p.isService).map(s => {
                    const beforePrice = s.price * s.qty;
                    const afterPrice = s.discountType === 'percentage' 
                        ? beforePrice * (1 - (s.discountValue || 0) / 100)
                        : Math.max(0, beforePrice - (s.discountValue || 0));

                    return {
                        serviceId: s.id,
                        departmentId: String(s.deptId || editingJob?.departmentId),
                        qty: s.qty,
                        discountType: s.discountType || 'amount',
                        discountValue: s.discountValue || 0,
                        unitPrice: s.price,
                        beforeDiscountPrice: beforePrice,
                        afterDiscountPrice: afterPrice
                    };
                }),
                totalDiscountType: data.totalDiscountType || 'amount',
                totalDiscountValue: data.totalDiscountValue || 0,
                promoCode: data.promoCode || '',
                promoCodeId: data.promoCodeId || '',
                VAT: data.VAT !== undefined && data.VAT !== null ? data.VAT : 15
            };
            await apiFetch(`/cashier/job/${jobId}/pricing`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            await refreshOrders();
            setActiveModal(null);
        } catch (err) {
            alert("Failed to save products: " + err.message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleSaveTechs = async (jobId, techs) => {
        setActionLoading('saving-techs');
        try {
            await apiFetch(`/cashier/job/${jobId}/assign`, {
                method: 'POST',
                body: JSON.stringify({ employeeIds: techs.map(t => String(t.employeeId || t.id || t.userId)) })
            });
            await refreshOrders();
            setActiveModal(null);
        } catch (err) {
            alert("Failed to assign technicians: " + err.message);
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="orders-container modern-pos-wrapper">
            {/* Top Layout Grid */}
            <div className="orders-layout-grid">
                
                {/* Left: Order List */}
                <aside className="orders-sidebar">
                    <div className="sidebar-header-actions">
                        <button onClick={async () => { setRefreshing(true); await refreshOrders(); setRefreshing(false); }} disabled={refreshing} className="refresh-btn">
                            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
                        </button>
                        <button onClick={() => setActiveModal('walkin')} className="btn-new-order">
                            <Plus size={18} /> New Order
                        </button>
                    </div>
                    <OrderList 
                        orders={filtered}
                        tab={tab}
                        setTab={setTab}
                        search={search}
                        setSearch={setSearch}
                        selectedId={selected?.id}
                        setSelectedId={setSelectedId}
                        loading={contextLoading}
                    />
                </aside>

                {/* Center: Job Detail View */}
                <main className="orders-main-content">
                    {!selected ? (
                        <div className="empty-selection-placeholder">
                            <div className="placeholder-icon">
                                <Receipt size={64} />
                            </div>
                            <h2>Select an order to view details</h2>
                            <p>Choose an active job from the list to start processing</p>
                        </div>
                    ) : (
                        <div className="order-modern-detail">
                            <header className="detail-header">
                                <div className="header-info">
                                    <h1 className="header-title">Order #{String(selected.orderNumber).toUpperCase()}</h1>
                                    <div className="header-meta">
                                        <span className="customer-name">{selected.customerName}</span>
                                        {selected.customerMobile && (
                                            <>
                                                <span className="dot" />
                                                <span className="meta-detail">{selected.customerMobile}</span>
                                            </>
                                        )}
                                        <span className="dot" />
                                        <span className="plate-number">{selected.plateNumber || 'No Plate'}</span>
                                        {selected.vehicleInfo && (
                                            <>
                                                <span className="dot" />
                                                <span className="meta-detail">{selected.vehicleInfo}</span>
                                            </>
                                        )}
                                        {selected.odometer && (
                                            <>
                                                <span className="dot" />
                                                <span className="meta-detail">KM: {selected.odometer}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                
                                {selected.jobs?.length > 0 && (
                                    <div className="incomplete-alert">
                                        <AlertCircle size={18} />
                                        <span>
                                            {(() => {
                                                const total = selected.jobs.length;
                                                const complete = selected.jobs.filter(j => ['finished', 'completed'].includes((j.status || '').toLowerCase())).length;
                                                const incomplete = total - complete;
                                                return `${incomplete} incomplete ${incomplete === 1 ? 'job' : 'jobs'} of ${total}`;
                                            })()}
                                        </span>
                                    </div>
                                )}
                            </header>

                            <div className="jobs-scroll-grid">
                                {selected.jobs?.map((job, idx) => {
                                    const jobKey = job.id || `${selected.id}-${idx}`;
                                    return (
                                        <JobCard 
                                            key={jobKey}
                                            job={{ ...job, jobKey }}
                                            jobData={jobData[jobKey]}
                                            onOpenModal={(type, clickedJob) => {
                                                const targetJob = clickedJob || job;
                                                const isDone = ['finished', 'completed'].includes((targetJob.status || '').toLowerCase());
                                                if (isDone) {
                                                    setConfirmEditJob({ job: targetJob, type });
                                                    return;
                                                }
                                                const resolvedDeptId = targetJob.departmentId || targetJob.deptId || targetJob.department?.id || targetJob.department_id;
                                                const jobKey = targetJob.id || `${selected.id}-${idx}`;
                                                
                                                console.log(`[OrdersScreen] Opening ${type} modal for job: ${jobKey}`, { targetJob, resolvedDeptId });
                                                
                                                setEditingJob({ ...targetJob, jobKey, departmentId: resolvedDeptId });
                                                
                                                // Initialize jobData from backend if empty
                                                if (!jobData[jobKey]) {
                                                    const initialProducts = (job.items || []).map(item => ({
                                                        ...item,
                                                        id: String(item.productId || item.serviceId || item.id),
                                                        name: item.productName || item.product?.name || item.service?.name || item.name || 'Item',
                                                        price: parseFloat(item.unitPrice || item.price || 0),
                                                        qty: item.qty || 1,
                                                        isService: !!item.serviceId,
                                                        allowDecimalQty: !!item.allowDecimalQty
                                                    }));

                                                    const initialTechs = (job.assignments || job.technicians || []).map(t => ({
                                                        ...t,
                                                        id: String(t.employeeId || t.id),
                                                        name: t.employeeName || t.employee?.name || t.name || 'Technician'
                                                    }));

                                                    setJobData(prev => ({
                                                        ...prev,
                                                        [jobKey]: { products: initialProducts, techs: initialTechs }
                                                    }));
                                                }
                                                
                                                setActiveModal(type);
                                            }}
                                            onMarkComplete={markJobComplete}
                                            onCancelJob={handleCancelJob}
                                            actionLoading={actionLoading}
                                        />
                                    );
                                })}
                                
                                <button 
                                    className="add-job-button"
                                    onClick={() => setActiveModal('department')}
                                    disabled={actionLoading === 'adding-job'}
                                >
                                    <div className="add-job-icon">
                                        <Plus size={32} />
                                    </div>
                                    <span>{actionLoading === 'adding-job' ? 'Adding...' : 'Add Department / Job'}</span>
                                </button>
                            </div>
                        </div>
                    )}
                </main>

                <DepartmentSelectionModal 
                    isOpen={activeModal === 'department'}
                    onClose={() => setActiveModal(null)}
                    departments={catalog}
                    onSelect={handleAddJob}
                    loading={catalogLoading}
                />

                {/* Right: Summary Panel */}
                <div className="summary-section">
                    <SummaryPanel 
                        order={selected} 
                        jobData={jobData}
                        onUpdateItem={handleUpdateSummaryItem}
                        onMarkComplete={markJobComplete}
                        onCancelOrder={() => setShowCancelModal(true)}
                        onOpenCustomer={() => setActiveModal('customer')}
                        onOpenPayment={() => setActiveModal('payment')}
                        onGenerateInvoice={handleGenerateInvoiceByOrder}
                        onGenerateInvoiceByOrder={handleGenerateInvoiceByOrder}
                        localPayments={localPayments}
                        actionLoading={actionLoading}
                    />
                </div>
            </div>

            {/* Modals */}
            {activeModal === 'product' && editingJob && (
                <ProductSelectionModal 
                    job={editingJob}
                    catalog={catalog}
                    jobData={jobData[editingJob.jobKey] || {}}
                    onToggleProduct={(p) => toggleProductSelection(editingJob.jobKey, p)}
                    onUpdateQty={(pid, delta) => updateProductQty(editingJob.jobKey, pid, delta)}
                    onUpdateItemField={(itemId, field, value) => handleUpdateSummaryItem(editingJob.jobKey, itemId, field, value)}
                    onUpdateGlobalField={(field, value) => handleUpdateGlobalPricing(editingJob.jobKey, field, value)}
                    onConfirm={() => handleSaveProducts(editingJob.id)}
                    onClose={() => setActiveModal(null)}
                    loading={catalogLoading || actionLoading === 'saving-products'}
                />
            )}

            {activeModal === 'technician' && editingJob && (
                <TechnicianAssignmentModal 
                    job={editingJob}
                    selectedTechs={jobData[editingJob.jobKey]?.techs || editingJob.technicians || []}
                    onConfirm={(techs) => handleSaveTechs(editingJob.id, techs)}
                    onClose={() => setActiveModal(null)}
                    loading={actionLoading === 'saving-techs'}
                />
            )}

            {showCancelModal && (
                <CancelReasonModal
                    isOpen={showCancelModal}
                    onClose={() => setShowCancelModal(false)}
                    onConfirm={handleCancelOrder}
                    loading={actionLoading === 'cancelling-order'}
                />
            )}

            {cancelJobTarget && (
                <CancelReasonModal
                    isOpen={true}
                    onClose={() => setCancelJobTarget(null)}
                    onConfirm={performCancelJob}
                    loading={actionLoading === `cancel-${cancelJobTarget.id}`}
                    title={`Cancel ${cancelJobTarget.departmentName}`}
                    subtitle="This department/job will be cancelled."
                    warningMessage="Only this job is voided — other departments on this order remain."
                    placeholder="Why are you cancelling this job? (e.g., wrong department, customer removed this service...)"
                    confirmLabel="Cancel Job"
                    loadingLabel="Cancelling..."
                />
            )}

            <InvoiceDetailsModal
                isOpen={!!invoiceDetails}
                invoice={invoiceDetails}
                onClose={() => setInvoiceDetails(null)}
            />
            
            <WalkInOrderModal 
                isOpen={activeModal === 'walkin'}
                onClose={() => setActiveModal(null)}
                onSubmit={handleWalkInSubmit}
                departments={workshopDepts}
                loading={actionLoading === 'creating-walkin'}
            />

            <CustomerDetailsModal 
                isOpen={activeModal === 'customer'}
                onClose={() => setActiveModal(null)}
                loading={actionLoading === 'saving-customer'}
                initialData={{
                    name: selected?.customerName === 'Walk-in Customer' ? '' : selected?.customerName,
                    phone: selected?.customerMobile,
                    email: selected?.customerEmail,
                    vatNumber: selected?.vatNumber,
                    odometerReading: selected?.odometerReading,
                    vin: selected?.vin,
                    vehicleNumber: selected?.plateNumber,
                    make: selected?.make,
                    model: selected?.vehicleInfo || selected?.model,
                    year: selected?.year,
                    color: selected?.color
                }}
                vehicleInfo={{
                    vehicleNumber: selected?.plateNumber,
                    model: selected?.vehicleInfo
                }}
                onSave={async (data) => {
                    try {
                        setActionLoading('saving-customer');
                        await apiFetch(`/cashier/order/${selected.id}/billing`, {
                            method: 'PATCH',
                            body: JSON.stringify({
                                customerName: data.name,
                                mobile: data.phone,
                                vatNumber: data.vatNumber,
                                vehicleNumber: data.vehicleNumber,
                                make: data.make,
                                model: data.model,
                                year: data.year ? parseInt(data.year) : undefined,
                                color: data.color,
                                vin: data.vin,
                                odometerReading: data.odometerReading ? parseFloat(data.odometerReading) : undefined
                            })
                        });
                        await refreshOrders();
                        setActiveModal(null);
                    } catch (e) {
                        console.error('Failed to save billing info:', e);
                        alert('Failed to save billing info. Please try again.');
                    } finally {
                        setActionLoading(null);
                    }
                }}
            />

            <PaymentSelectionModal 
                isOpen={activeModal === 'payment'}
                onClose={() => setActiveModal(null)}
                loading={actionLoading === 'saving-payment'}
                totalAmount={calculateOrderTotal(selected)}
                onSave={async (payments) => {
                    setLocalPayments({
                        method: payments[0]?.method || 'Cash',
                        payments: payments.map(p => ({
                            method: p.method,
                            amount: p.amount
                        }))
                    });
                    setActiveModal(null);
                }}
            />


            {/* Confirmation for Editing Completed Job */}
            {confirmEditJob && (
                <div className="modal-overlay-modern" onClick={() => setConfirmEditJob(null)}>
                    <div className="modal-container-medium" style={{ maxWidth: 380, padding: 28, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <div style={{ width: 56, height: 56, background: '#fee2e2', color: '#ef4444', borderRadius: '50%', display: 'flex', alignItems: 'center', margin: '0 auto 20px' }}>
                            <AlertCircle size={32} style={{ margin: 'auto' }} />
                        </div>
                        <h3 style={{ margin: '0 0 12px', fontWeight: 900, color: '#1e293b', fontSize: '1.25rem' }}>Job is Completed</h3>
                        <p style={{ margin: '0 0 24px', color: '#64748b', fontSize: '0.9rem', lineHeight: 1.5 }}>
                            This job is already marked as completed. Would you like to set it back to <strong>Pending</strong> to make changes?
                        </p>
                        <div style={{ display: 'flex', gap: 12 }}>
                             <button onClick={() => setConfirmEditJob(null)} className="btn-modal btn-clear" style={{ flex: 1 }}>Cancel</button>
                             <button onClick={async () => {
                                 const { job, type } = confirmEditJob;
                                 setConfirmEditJob(null);
                                 try {
                                     setActionLoading(job.id);
                                     // Reference: empty body → backend transitions completed → edited
                                     await apiFetch(`/cashier/job/${job.id}/mark-edited`, {
                                         method: 'PATCH',
                                         body: JSON.stringify({})
                                     });
                                     await refreshOrders();
                                     
                                     // Manually trigger the edit modal opening after status change
                                     const jobKey = job.id; 
                                     setEditingJob({ ...job, jobKey });
                                     
                                     // Initialize data
                                     const initialProducts = (job.items || []).map(item => ({
                                         ...item,
                                         id: item.productId || item.serviceId || item.id,
                                         name: item.product?.name || item.service?.name || item.name || 'Item',
                                         price: parseFloat(item.unitPrice || item.price || 0),
                                         qty: item.qty || 1,
                                         isService: !!item.serviceId
                                     }));
                                     const initialTechs = (job.technicians || []).map(t => ({
                                         ...t,
                                         id: t.employeeId || t.id,
                                         name: t.employee?.name || t.name || 'Technician'
                                     }));
                                     setJobData(prev => ({ ...prev, [jobKey]: { products: initialProducts, techs: initialTechs } }));
                                     setActiveModal(type);
                                 } catch (e) {
                                     console.error('Failed to mark job as edited:', e);
                                     alert('Could not revert status. Please try manually.');
                                 } finally {
                                     setActionLoading(null);
                                 }
                             }} className="btn-modal btn-confirm" style={{ flex: 1.5 }}>Confirm & Edit</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


function InfoLine({ icon, label, value }) {
    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: '#94a3b8' }}>
                {icon}
                <span style={{ fontSize: '0.68rem', fontWeight: 600 }}>{label}</span>
            </div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem', color: '#1E2124' }}>{value}</p>
        </div>
    );
}
