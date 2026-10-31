import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Eye, FileText, Loader2, Pencil, Plus, RotateCcw, Search } from 'lucide-react';
import InlineFormScreen from '../../components/InlineFormScreen';
import SearchableEntityCombobox from '../../components/SearchableEntityCombobox';
import WorkshopPurchaseReturnDetailView from '../../components/workshop/WorkshopPurchaseReturnDetailView';
import { ShimmerTable, ShimmerTextBlock } from '../../components/supplier/Shimmer';
import {
    approveSupplierAffiliatedSalesReturn,
    createSupplierAffiliatedSalesReturn,
    getSupplierAffiliatedSalesReturn,
    getSupplierInvoice,
    getSupplierProfile,
    getSupplierSalesInvoiceCustomerBranches,
    listSupplierAffiliatedSalesReturns,
    listSupplierInvoiceReturns,
    listSupplierInvoices,
    searchSupplierInvoicePickerProducts,
    updateSupplierAffiliatedSalesReturn,
} from '../../services/supplierApi';
import { mapSupplierAffiliatedReturnForView } from '../../utils/mapAffiliatedReturnDetail';
import { supplierProfileFromApi } from '../../utils/supplierProfile';
import { ssrT } from '../../utils/supplierSalesReturnsI18n';
import '../../styles/admin/AccountingPage.css';
import { toRiyadhDateISO } from '../../utils/riyadhBusinessRange';

function sarFmt(v) {
    return Number(v ?? 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

/** Same list-row mapping as SupplierSalesInvoices.jsx */
function mapSupplierInvoicesListFromResponse(invRes) {
    if (!invRes || !Array.isArray(invRes.invoices)) return [];
    return invRes.invoices.map((inv) => ({
        id: inv.id,
        invoiceNo: inv.invoiceNo,
        branch: inv.branch?.name || '—',
        branchId: inv.branch?.id,
        workshopId: inv.workshop?.id ?? null,
        workshopName: inv.workshop?.name || inv.branch?.workshopName || '',
        date: inv.invoiceDate,
        dueDate: inv.dueDate || '—',
        amount: Number(inv.grandTotal || 0),
        paid: Number(inv.paid || 0),
        balance: Number(inv.outstanding || 0),
        productLabel: inv.productLabel ?? '—',
        salesInvoiceMeta: inv.salesInvoiceMeta ?? null,
    }));
}

function salesInvoiceCustomerLabel(inv) {
    if (!inv || typeof inv !== 'object') return '—';
    if (inv.workshopName && inv.branch && inv.branch !== '—') {
        return `${inv.workshopName} — ${inv.branch}`;
    }
    if (inv.workshopName) return inv.workshopName;
    return inv.branch || 'Customer';
}

function normalizeReturnCustomers(branchesRes) {
    const raw = Array.isArray(branchesRes?.customers) ? branchesRes.customers : [];
    return raw.map((c) => ({
        key: String(c.key),
        group: c.group || 'Customers',
        label: c.label || 'Customer',
        subtitle: c.subtitle ?? null,
        customerType: c.customerType,
        branchId: c.branchId != null ? String(c.branchId) : null,
        workshopId: c.workshopId != null ? String(c.workshopId) : null,
        externalPartyId: c.externalPartyId != null ? String(c.externalPartyId) : null,
        inactive: Boolean(c.disabled),
    }));
}

function invoiceMatchesCustomer(inv, customer) {
    if (!inv || !customer) return false;
    if (customer.externalPartyId) {
        const meta = inv.salesInvoiceMeta;
        const ext =
            meta && typeof meta === 'object' && meta.externalPartyId != null
                ? String(meta.externalPartyId)
                : '';
        return ext === String(customer.externalPartyId);
    }
    if (customer.branchId) {
        return String(inv.branchId || '') === String(customer.branchId);
    }
    if (customer.workshopId) {
        return String(inv.workshopId || '') === String(customer.workshopId);
    }
    return false;
}

function emptyManualLine(id) {
    return {
        id,
        supplierProductId: '',
        productId: '',
        productName: '',
        unit: '',
        warehouseUnit: '',
        workshopUnit: '',
        conversionFactor: 1,
        qtyReturned: '',
        unitPrice: '',
        vatRate: '15',
        reason: '',
        searchDraft: '',
    };
}

function lineUomOptions(row) {
    const opts = [];
    const wu = String(row?.warehouseUnit || '').trim();
    const wsu = String(row?.workshopUnit || '').trim();
    if (wu) opts.push(wu);
    if (wsu && wsu.toLowerCase() !== wu.toLowerCase()) opts.push(wsu);
    const cur = String(row?.unit || '').trim();
    if (cur && !opts.some((o) => o.toLowerCase() === cur.toLowerCase())) opts.push(cur);
    return opts.length ? opts : ['pcs'];
}

function formatReturnUomConversionPreview(row, t) {
    const cf = Number(row?.conversionFactor) || 1;
    if (!(cf > 1)) return '';
    const wu = row.warehouseUnit || 'Box';
    const wsu = row.workshopUnit || 'pcs';
    const qty = Number(row.qtyReturned) || 0;
    if (!(qty > 0)) return '';
    const price = Number(row.unitPrice) || 0;
    const unit = String(row.unit || '').trim().toLowerCase();
    const isWh = unit === String(wu).toLowerCase();
    if (isWh) {
        const wsQty = Math.round(qty * cf * 100) / 100;
        const wsPrice = cf > 0 ? Math.round((price / cf) * 100) / 100 : price;
        return t('hint.uomWhToWs', {
            qty,
            wu,
            wsQty,
            wsu,
            price: t('money.sar', { amount: sarFmt(price) }),
            wsPrice: t('money.sar', { amount: sarFmt(wsPrice) }),
        });
    }
    const whQty = Math.round((qty / cf) * 100) / 100;
    const whPrice = Math.round(price * cf * 100) / 100;
    return t('hint.uomWsToWh', {
        qty,
        wsu,
        whQty,
        wu,
        price: t('money.sar', { amount: sarFmt(price) }),
        whPrice: t('money.sar', { amount: sarFmt(whPrice) }),
    });
}

function salesInvoiceSelectedDisplay(inv) {
    if (!inv) return '';
    const customer = salesInvoiceCustomerLabel(inv);
    return customer && customer !== '—' ? `${inv.invoiceNo} · ${customer}` : String(inv.invoiceNo || '');
}

function salesInvoiceComboboxSubtitle(inv) {
    const lines = [];
    const customer = salesInvoiceCustomerLabel(inv);
    if (customer && customer !== '—') lines.push(customer);
    const detail = [];
    if (inv.productLabel && inv.productLabel !== '—') detail.push(inv.productLabel);
    if (inv.date) detail.push(`Issued ${formatMgrDate(inv.date)}`);
    if (detail.length) lines.push(detail.join(' · '));
    return lines.join('\n');
}

async function fetchAllSupplierSalesInvoices() {
    const pageSize = 100;
    let offset = 0;
    let total = Number.POSITIVE_INFINITY;
    const all = [];
    while (offset < total) {
        const res = await listSupplierInvoices({ limit: pageSize, offset });
        const rows = mapSupplierInvoicesListFromResponse(res);
        total = Number(res?.total ?? rows.length);
        all.push(...rows);
        if (!rows.length) break;
        offset += pageSize;
        if (all.length >= total) break;
    }
    return all;
}

function formatMgrDate(iso) {
    if (!iso || iso === '—') return '—';
    const [y, m, d] = String(iso).slice(0, 10).split('-');
    if (!y || !m || !d) return String(iso).slice(0, 10);
    return `${d}/${m}/${y}`;
}

function aggregateReturnedQtyByInvoiceLine(returns) {
    const m = new Map();
    for (const r of returns || []) {
        for (const line of r.lines || []) {
            const id = String(line.invoiceItemId);
            m.set(id, (m.get(id) || 0) + Number(line.qtyReturned || 0));
        }
    }
    return m;
}

function returnStatusBadge(status, row, t) {
    const s = String(status || 'pending').toLowerCase();
    if (s === 'approved' || s === 'posted') {
        return {
            label: s === 'posted' ? t('status.posted') : t('status.approved'),
            cls: 'mgr-si-status mgr-si-status--paid',
        };
    }
    if (s === 'rejected') {
        return { label: t('status.rejected'), cls: 'mgr-si-status mgr-si-status--overdue' };
    }
    if (row?.mode === 'workshop_initiated' || row?.linkedPurchaseReturn?.mode === 'workshop_initiated') {
        return { label: t('status.pendingSupplier'), cls: 'mgr-si-status mgr-si-status--pending' };
    }
    return { label: t('status.pendingWorkshop'), cls: 'mgr-si-status mgr-si-status--pending' };
}

function isWorkshopInitiatedReturn(row) {
    return (
        row?.mode === 'workshop_initiated' ||
        row?.linkedPurchaseReturn?.mode === 'workshop_initiated'
    );
}

function linkedPurchaseStatus(row, t) {
    const st = row?.linkedPurchaseReturn?.status;
    if (!st) return t('emdash');
    const badge = returnStatusBadge(st, row, t);
    return badge.label;
}

export default function SupplierAffiliatedSalesReturns({ locale: localeProp }) {
    const locale =
        localeProp ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => ssrT(locale, key, vars), [locale]);
    const [formOpen, setFormOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [invoiceLoading, setInvoiceLoading] = useState(false);
    const [error, setError] = useState('');
    const [formError, setFormError] = useState('');
    const [success, setSuccess] = useState('');
    const [returns, setReturns] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [invoicesLoading, setInvoicesLoading] = useState(false);
    const [listSearch, setListSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [customers, setCustomers] = useState([]);
    const [customersLoading, setCustomersLoading] = useState(false);
    const [selectedCustomerKey, setSelectedCustomerKey] = useState('');
    const [customerSearchDraft, setCustomerSearchDraft] = useState('');
    const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
    const [invoiceSearchDraft, setInvoiceSearchDraft] = useState('');
    const [invoiceDetail, setInvoiceDetail] = useState(null);
    const [returnHistory, setReturnHistory] = useState([]);
    const [lineQty, setLineQty] = useState({});
    const [lineReason, setLineReason] = useState({});
    const [manualLines, setManualLines] = useState([emptyManualLine('m1')]);
    const [productOptions, setProductOptions] = useState([]);
    const [productSearchLoading, setProductSearchLoading] = useState(false);
    const [returnDate, setReturnDate] = useState(toRiyadhDateISO());
    const [reference, setReference] = useState('');
    const [description, setDescription] = useState('');
    const [notes, setNotes] = useState('');
    const [viewReturnId, setViewReturnId] = useState(null);
    const [viewReturnDetail, setViewReturnDetail] = useState(null);
    const [viewReturnLoading, setViewReturnLoading] = useState(false);
    const [approvingId, setApprovingId] = useState(null);
    const [editingReturnId, setEditingReturnId] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const returnsRes = await listSupplierAffiliatedSalesReturns();
            setReturns(Array.isArray(returnsRes?.items) ? returnsRes.items : []);
        } catch (err) {
            setError(err.message || t('err.load'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    const loadSalesInvoicesForPicker = useCallback(async () => {
        setInvoicesLoading(true);
        try {
            const rows = await fetchAllSupplierSalesInvoices();
            setInvoices(rows);
        } catch (err) {
            setFormError(err.message || t('err.loadInvoices'));
            setInvoices([]);
        } finally {
            setInvoicesLoading(false);
        }
    }, [t]);

    const loadCustomersForPicker = useCallback(async () => {
        setCustomersLoading(true);
        try {
            const res = await getSupplierSalesInvoiceCustomerBranches();
            setCustomers(normalizeReturnCustomers(res));
        } catch (err) {
            setFormError(err.message || t('err.loadCustomers'));
            setCustomers([]);
        } finally {
            setCustomersLoading(false);
        }
    }, [t]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        if (!formOpen || !selectedInvoiceId) {
            if (!editingReturnId) {
                setInvoiceDetail(null);
                setReturnHistory([]);
                setLineQty({});
                setLineReason({});
            }
            return;
        }
        let active = true;
        setInvoiceLoading(true);
        setFormError('');
        Promise.all([
            getSupplierInvoice(selectedInvoiceId),
            listSupplierInvoiceReturns(selectedInvoiceId).catch(() => ({ returns: [] })),
        ])
            .then(([invRes, histRes]) => {
                if (!active) return;
                const invoice = invRes?.invoice || invRes;
                setInvoiceDetail(invoice);
                const history = Array.isArray(histRes?.returns) ? histRes.returns : [];
                setReturnHistory(history);
                if (!editingReturnId) {
                    const nextQty = {};
                    (invoice?.items || []).forEach((item) => {
                        nextQty[String(item.id)] = '';
                    });
                    setLineQty(nextQty);
                    setLineReason({});
                }
            })
            .catch((err) => {
                if (active) setFormError(err.message || t('err.loadInvoice'));
            })
            .finally(() => {
                if (active) setInvoiceLoading(false);
            });
        return () => {
            active = false;
        };
    }, [formOpen, selectedInvoiceId, editingReturnId, t]);

    const filteredReturns = useMemo(() => {
        let rows = returns;
        if (statusFilter !== 'all') {
            rows = rows.filter((row) => String(row.status || '').toLowerCase() === statusFilter);
        }
        const q = listSearch.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter((row) => {
            const hay = [
                row.returnNo,
                row.invoiceNo,
                row.workshopName,
                row.branchName,
                row.linkedPurchaseReturn?.returnNumber,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return hay.includes(q);
        });
    }, [returns, listSearch, statusFilter]);

    const returnedSoFar = useMemo(
        () => aggregateReturnedQtyByInvoiceLine(returnHistory),
        [returnHistory],
    );

    const openForm = () => {
        setFormError('');
        setSuccess('');
        setEditingReturnId(null);
        setSelectedCustomerKey('');
        setCustomerSearchDraft('');
        setSelectedInvoiceId('');
        setInvoiceSearchDraft('');
        setManualLines([emptyManualLine(`m${Date.now()}`)]);
        setProductOptions([]);
        setReference('');
        setDescription('');
        setNotes('');
        setReturnDate(toRiyadhDateISO());
        setFormOpen(true);
        void loadCustomersForPicker();
        void loadSalesInvoicesForPicker();
    };

    const closeForm = () => {
        if (saving) return;
        setFormOpen(false);
        setFormError('');
        setEditingReturnId(null);
    };

    const closeViewReturn = useCallback(() => {
        setViewReturnId(null);
        setViewReturnDetail(null);
        setViewReturnLoading(false);
    }, []);

    const handleViewReturn = useCallback(async (row) => {
        if (!row?.id) return;
        setViewReturnId(String(row.id));
        setViewReturnLoading(true);
        setViewReturnDetail(null);
        try {
            const [profileRes, detailRes] = await Promise.all([
                getSupplierProfile().catch(() => null),
                getSupplierAffiliatedSalesReturn(row.id),
            ]);
            const detail = mapSupplierAffiliatedReturnForView(detailRes);
            const profile = supplierProfileFromApi(profileRes);
            if (detail && profile) {
                detail.supplier = profile;
            }
            setViewReturnDetail(detail);
        } catch (err) {
            setError(err?.message || t('err.loadDetail'));
            setViewReturnId(null);
        } finally {
            setViewReturnLoading(false);
        }
    }, [t]);

    const handleApproveReturn = useCallback(async (row) => {
        if (!row?.id || row.status !== 'pending' || !isWorkshopInitiatedReturn(row)) return;
        const ok = window.confirm(t('confirm.approve', { no: row.returnNo }));
        if (!ok) return;
        setApprovingId(String(row.id));
        setError('');
        try {
            await approveSupplierAffiliatedSalesReturn(row.id);
            setSuccess(t('success.approved', { no: row.returnNo }));
            await load();
        } catch (err) {
            setError(err?.message || t('err.approve'));
        } finally {
            setApprovingId(null);
        }
    }, [load, t]);

    const selectedCustomer = useMemo(
        () => customers.find((c) => c.key === selectedCustomerKey) || null,
        [customers, selectedCustomerKey],
    );

    const customerInvoices = useMemo(() => {
        if (!selectedCustomer) return [];
        return invoices.filter((inv) => invoiceMatchesCustomer(inv, selectedCustomer));
    }, [invoices, selectedCustomer]);

    useEffect(() => {
        if (editingReturnId) return;
        if (!selectedInvoiceId || !selectedCustomer) return;
        const stillValid = customerInvoices.some(
            (inv) => String(inv.id) === String(selectedInvoiceId),
        );
        if (!stillValid) {
            setSelectedInvoiceId('');
            setInvoiceSearchDraft('');
        }
    }, [selectedCustomer, customerInvoices, selectedInvoiceId, editingReturnId]);

    const searchProducts = useCallback(async (q) => {
        setProductSearchLoading(true);
        try {
            const res = await searchSupplierInvoicePickerProducts({ q: q || '', limit: 40 });
            const rows = Array.isArray(res?.products)
                ? res.products
                : Array.isArray(res?.items)
                  ? res.items
                  : Array.isArray(res)
                    ? res
                    : [];
            setProductOptions(
                rows.map((p, idx) => {
                    const warehouseUnit = String(
                        p.warehouseUnit || p.unit || '',
                    ).trim();
                    const workshopUnit = String(
                        p.workshopUnit || p.unit || warehouseUnit || '',
                    ).trim();
                    const conversionFactor = Number(p.conversionFactor) || 1;
                    const unit = warehouseUnit || workshopUnit || p.unit || 'pcs';
                    const price = Number(
                        p.salePrice ?? p.portalSalePriceAffiliated ?? p.basePrice ?? 0,
                    );
                    const uomHint =
                        conversionFactor > 1
                            ? `1 ${warehouseUnit || 'Box'} = ${conversionFactor} ${workshopUnit || 'pcs'}`
                            : unit;
                    return {
                        id: String(p.supplierProductId || p.id || `p${idx}`),
                        label: p.name || p.productName || p.sku || t('emdash'),
                        subtitle:
                            [p.sku, uomHint].filter(Boolean).join(' · ') || null,
                        trailing:
                            price
                                ? t('money.sar', { amount: sarFmt(price) })
                                : null,
                        supplierProductId:
                            p.supplierProductId != null
                                ? String(p.supplierProductId)
                                : String(p.id || ''),
                        productId:
                            p.masterProductId != null
                                ? String(p.masterProductId)
                                : p.productId != null
                                  ? String(p.productId)
                                  : '',
                        productName: p.name || p.productName || '',
                        unit,
                        warehouseUnit,
                        workshopUnit,
                        conversionFactor,
                        unitPrice: price,
                        searchTokens: [
                            p.name,
                            p.productName,
                            p.sku,
                            unit,
                            warehouseUnit,
                            workshopUnit,
                        ].filter(Boolean),
                    };
                }),
            );
        } catch {
            setProductOptions([]);
        } finally {
            setProductSearchLoading(false);
        }
    }, [t]);

    const handleEditReturn = useCallback(
        async (row) => {
            if (!row?.id) return;
            if (String(row.status || '').toLowerCase() === 'rejected') {
                setError(t('err.editRejected'));
                return;
            }
            setFormError('');
            setSuccess('');
            setError('');
            setSaving(true);
            try {
                await Promise.all([loadCustomersForPicker(), loadSalesInvoicesForPicker()]);
                const detailRes = await getSupplierAffiliatedSalesReturn(row.id);
                const sr = detailRes?.salesReturn || detailRes;
                if (!sr) throw new Error(t('err.loadDetail'));

                let customerKey = '';
                if (sr.externalPartyId) {
                    customerKey = `external:${sr.externalPartyId}`;
                } else if (sr.branchId) {
                    customerKey = `affiliated:branch:${sr.branchId}`;
                } else if (sr.workshopId) {
                    customerKey = `affiliated:workshop:${sr.workshopId}`;
                }
                const matchedCustomer =
                    (await getSupplierSalesInvoiceCustomerBranches()
                        .then(normalizeReturnCustomers)
                        .catch(() => customers)
                    ).find((c) => {
                        if (sr.externalPartyId) {
                            return String(c.externalPartyId) === String(sr.externalPartyId);
                        }
                        if (sr.branchId) return String(c.branchId) === String(sr.branchId);
                        if (sr.workshopId) return String(c.workshopId) === String(sr.workshopId);
                        return false;
                    }) || null;
                if (matchedCustomer) customerKey = matchedCustomer.key;

                setEditingReturnId(String(sr.id));
                setSelectedCustomerKey(customerKey);
                setCustomerSearchDraft(matchedCustomer?.label || row.workshopName || '');
                setReference(sr.reference || '');
                setDescription(sr.description || '');
                setNotes(sr.notes || '');
                setReturnDate(
                    String(sr.returnDate || '').slice(0, 10) || toRiyadhDateISO(),
                );

                if (sr.supplierInvoiceId) {
                    setSelectedInvoiceId(String(sr.supplierInvoiceId));
                    setInvoiceSearchDraft(sr.invoice?.invoiceNo || row.invoiceNo || '');
                    const nextQty = {};
                    const nextReason = {};
                    (sr.items || []).forEach((it) => {
                        if (it.invoiceItemId == null) return;
                        nextQty[String(it.invoiceItemId)] = String(
                            Number(it.qtyReturned || 0),
                        );
                        nextReason[String(it.invoiceItemId)] = it.reason || '';
                    });
                    setLineQty(nextQty);
                    setLineReason(nextReason);
                    setManualLines([emptyManualLine(`m${Date.now()}`)]);
                } else {
                    setSelectedInvoiceId('');
                    setInvoiceSearchDraft('');
                    setManualLines(
                        (sr.items || []).length
                            ? sr.items.map((it, idx) => ({
                                  id: `e${it.id || idx}`,
                                  supplierProductId:
                                      it.supplierProductId != null
                                          ? String(it.supplierProductId)
                                          : '',
                                  productId:
                                      it.productId != null ? String(it.productId) : '',
                                  productName: it.productName || '',
                                  unit: it.unit || '',
                                  warehouseUnit: it.unit || '',
                                  workshopUnit: it.unit || '',
                                  conversionFactor: 1,
                                  qtyReturned: String(Number(it.qtyReturned || 0)),
                                  unitPrice: String(Number(it.unitPrice || 0)),
                                  vatRate: String(Number(it.vatRate ?? 15)),
                                  reason: it.reason || '',
                                  searchDraft: it.productName || '',
                              }))
                            : [emptyManualLine(`m${Date.now()}`)],
                    );
                    void searchProducts('');
                }
                setFormOpen(true);
            } catch (err) {
                setError(err?.message || t('err.loadDetail'));
            } finally {
                setSaving(false);
            }
        },
        [customers, loadCustomersForPicker, loadSalesInvoicesForPicker, searchProducts, t],
    );

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!selectedCustomer) {
            setFormError(t('err.needCustomer'));
            return;
        }
        if (selectedCustomer.inactive && !editingReturnId) {
            setFormError(t('err.inactiveCustomer'));
            return;
        }

        let payload;
        if (selectedInvoiceId) {
            const lines = (invoiceDetail?.items || [])
                .map((item) => ({
                    invoiceItemId: String(item.id),
                    qtyReturned: Number(lineQty[String(item.id)] || 0),
                    reason: lineReason[String(item.id)] || '',
                }))
                .filter((item) => item.qtyReturned > 0);
            if (!lines.length) {
                setFormError(t('err.needQty'));
                return;
            }
            payload = {
                supplierInvoiceId: selectedInvoiceId,
                returnDate,
                reference,
                description,
                notes,
                lines,
            };
        } else {
            const lines = manualLines
                .map((row) => ({
                    supplierProductId: row.supplierProductId || undefined,
                    productId: row.productId || undefined,
                    productName: row.productName,
                    unit: row.unit || undefined,
                    qtyReturned: Number(row.qtyReturned || 0),
                    unitPrice: Number(row.unitPrice || 0),
                    vatRate: Number(row.vatRate || 15),
                    reason: row.reason || '',
                }))
                .filter((row) => row.qtyReturned > 0 && row.productName);
            if (!lines.length) {
                setFormError(t('err.needManualLines'));
                return;
            }
            payload = {
                workshopId: selectedCustomer.workshopId || undefined,
                branchId: selectedCustomer.branchId || undefined,
                externalPartyId: selectedCustomer.externalPartyId || undefined,
                returnDate,
                reference,
                description,
                notes,
                lines,
            };
        }

        setSaving(true);
        setFormError('');
        try {
            if (editingReturnId) {
                const res = await updateSupplierAffiliatedSalesReturn(
                    editingReturnId,
                    payload,
                );
                const no =
                    res?.salesReturn?.returnNo ||
                    res?.supplierReturnNo ||
                    editingReturnId;
                setSuccess(t('success.updated', { returnNo: no }));
                setEditingReturnId(null);
            } else {
                const res = await createSupplierAffiliatedSalesReturn(payload);
                setSuccess(
                    res?.purchaseReturnNo
                        ? t('success.created', {
                              returnNo: res?.supplierReturnNo || '',
                              purchaseReturnNo: res?.purchaseReturnNo || '',
                          }).trim()
                        : t('success.createdUnlinked', {
                              returnNo: res?.supplierReturnNo || '',
                          }).trim(),
                );
            }
            setFormOpen(false);
            await load();
        } catch (err) {
            setFormError(err.message || (editingReturnId ? t('err.update') : t('err.create')));
        } finally {
            setSaving(false);
        }
    };

    const selectedInvoiceMeta = useMemo(
        () => customerInvoices.find((row) => String(row.id) === String(selectedInvoiceId)) || null,
        [customerInvoices, selectedInvoiceId],
    );

    const customerComboboxOptions = useMemo(
        () =>
            customers.map((c) => ({
                id: c.key,
                label: c.label,
                subtitle: [c.group, c.subtitle].filter(Boolean).join('\n') || null,
                inactive: Boolean(c.inactive),
                searchTokens: [c.label, c.group, c.subtitle, c.branchId, c.workshopId].filter(Boolean),
            })),
        [customers],
    );

    const invoiceComboboxOptions = useMemo(
        () =>
            customerInvoices.map((inv) => ({
                id: String(inv.id),
                label: inv.invoiceNo || t('emdash'),
                subtitle: salesInvoiceComboboxSubtitle(inv),
                trailing: t('money.sar', { amount: sarFmt(inv.amount) }),
                searchTokens: [
                    inv.invoiceNo,
                    salesInvoiceCustomerLabel(inv),
                    inv.productLabel,
                    inv.branch,
                    inv.workshopName,
                    inv.date,
                ].filter((tok) => tok && tok !== '—'),
            })),
        [customerInvoices, t],
    );

    const totalSelected = useMemo(() => {
        if (selectedInvoiceId) {
            return (invoiceDetail?.items || []).reduce((sum, item) => {
                const qty = Number(lineQty[String(item.id)] || 0);
                if (!(qty > 0)) return sum;
                const unitPrice = Number(item.unitPrice || 0);
                const vatRate = Number(item.vatRate || 0) / 100;
                return sum + qty * unitPrice * (1 + vatRate);
            }, 0);
        }
        return manualLines.reduce((sum, row) => {
            const qty = Number(row.qtyReturned || 0);
            if (!(qty > 0) || !row.productName) return sum;
            const unitPrice = Number(row.unitPrice || 0);
            const vatRate = Number(row.vatRate || 15) / 100;
            return sum + qty * unitPrice * (1 + vatRate);
        }, 0);
    }, [selectedInvoiceId, invoiceDetail, lineQty, manualLines]);

    const lineGridCols = 'minmax(140px,2fr) 88px 104px 96px 112px minmax(120px,1fr)';
    const manualGridCols =
        'minmax(180px,2fr) 100px 88px 104px 72px minmax(110px,1fr) 40px';

    return (
        <div className="mgr-si-page">
            {!formOpen && !viewReturnId ? (
                <>
                    <header className="mgr-si-header">
                        <div className="mgr-si-header-top">
                            <div className="mgr-si-breadcrumb">{t('page.breadcrumb')}</div>
                            <div className="mgr-si-toolbar-actions">
                                <button type="button" className="mgr-si-btn-new" onClick={openForm}>
                                    <Plus size={16} /> {t('btn.newReturn')}
                                </button>
                            </div>
                        </div>
                        <h2 className="mgr-si-title">{t('page.title')}</h2>
                        <p className="mgr-si-subtitle">{t('page.subtitle')}</p>
                    </header>

                    <div className="mgr-si-toolbar">
                        <div className="mgr-si-filter-bar">
                            <span className="mgr-si-filter-label">{t('label.status')}</span>
                            <select
                                className="mgr-si-filter-select"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                aria-label={t('aria.filterStatus')}
                            >
                                <option value="all">{t('opt.allReturns')}</option>
                                <option value="pending">{t('opt.pendingWorkshop')}</option>
                                <option value="approved">{t('opt.approved')}</option>
                                <option value="posted">{t('opt.posted')}</option>
                            </select>
                        </div>
                        <div className="mgr-si-search-wrap">
                            <div className="mgr-si-search-input-wrap">
                                <Search size={16} className="mgr-si-search-icon" aria-hidden />
                                <input
                                    type="search"
                                    className="mgr-si-search-input"
                                    placeholder={t('search.placeholder')}
                                    value={listSearch}
                                    onChange={(e) => setListSearch(e.target.value)}
                                    aria-label={t('aria.searchReturns')}
                                />
                            </div>
                            <button type="button" className="mgr-si-search-btn">
                                {t('btn.search')}
                            </button>
                        </div>
                    </div>

                    {error ? <div className="mgr-si-error">{error}</div> : null}
                    {success ? (
                        <div
                            style={{
                                marginBottom: 16,
                                padding: '12px 14px',
                                borderRadius: 10,
                                background: '#ECFDF5',
                                border: '1px solid #A7F3D0',
                                color: '#047857',
                                fontSize: '0.875rem',
                            }}
                        >
                            {success}
                        </div>
                    ) : null}

                    <div className="premium-table mgr-si-table-wrap">
                        <div style={{ overflowX: 'auto' }}>
                            {loading && filteredReturns.length === 0 ? (
                                <div style={{ padding: 16 }}>
                                    <ShimmerTable rows={8} columns={8} />
                                </div>
                            ) : (
                                <table className="mgr-si-table">
                                    <thead>
                                        <tr className="table-header-row">
                                            <th className="table-th">{t('th.returnDate')}</th>
                                            <th className="table-th">{t('th.returnNo')}</th>
                                            <th className="table-th">{t('th.salesInvoice')}</th>
                                            <th className="table-th">{t('th.workshopBranch')}</th>
                                            <th className="table-th">{t('th.amount')}</th>
                                            <th className="table-th">{t('th.supplierStatus')}</th>
                                            <th className="table-th">{t('th.workshopReturn')}</th>
                                            <th className="table-th">{t('th.workshopStatus')}</th>
                                            <th className="table-th" style={{ width: 110 }} />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {!loading && filteredReturns.length === 0 ? (
                                            <tr>
                                                <td colSpan={9} className="table-cell table-empty">
                                                    <FileText
                                                        size={36}
                                                        style={{
                                                            opacity: 0.25,
                                                            margin: '0 auto 12px',
                                                            display: 'block',
                                                        }}
                                                    />
                                                    <div style={{ fontWeight: 700, marginBottom: 8 }}>
                                                        {t('empty.title')}
                                                    </div>
                                                    <p style={{ margin: 0, color: '#64748B', fontSize: '0.875rem' }}>
                                                        {t('empty.hint')}
                                                    </p>
                                                    <button
                                                        type="button"
                                                        className="mgr-si-btn-new"
                                                        style={{ marginTop: 16 }}
                                                        onClick={openForm}
                                                    >
                                                        <Plus size={16} /> {t('btn.newReturn')}
                                                    </button>
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredReturns.map((row) => {
                                                const badge = returnStatusBadge(row.status, row, t);
                                                const canApprove =
                                                    row.status === 'pending' &&
                                                    isWorkshopInitiatedReturn(row);
                                                return (
                                                    <tr key={row.id} className="table-row">
                                                        <td className="table-cell">
                                                            {formatMgrDate(row.returnDate)}
                                                        </td>
                                                        <td className="table-cell" style={{ fontWeight: 600 }}>
                                                            {row.returnNo}
                                                        </td>
                                                        <td className="table-cell">{row.invoiceNo || t('emdash')}</td>
                                                        <td className="table-cell">
                                                            {row.workshopName
                                                                ? `${row.workshopName}${row.branchName ? ` — ${row.branchName}` : ''}`
                                                                : row.branchName || t('emdash')}
                                                        </td>
                                                        <td className="table-cell mgr-si-cell-amount">
                                                            {t('money.sar', { amount: sarFmt(row.grandTotal) })}
                                                        </td>
                                                        <td className="table-cell">
                                                            <span className={badge.cls}>{badge.label}</span>
                                                        </td>
                                                        <td className="table-cell">
                                                            {row.linkedPurchaseReturn?.returnNumber || t('emdash')}
                                                        </td>
                                                        <td className="table-cell">
                                                            {row.linkedPurchaseReturn ? (
                                                                <span
                                                                    className={
                                                                        returnStatusBadge(
                                                                            row.linkedPurchaseReturn.status,
                                                                            row,
                                                                            t,
                                                                        ).cls
                                                                    }
                                                                >
                                                                    {linkedPurchaseStatus(row, t)}
                                                                </span>
                                                            ) : (
                                                                t('emdash')
                                                            )}
                                                        </td>
                                                        <td className="table-cell">
                                                            <div style={{ display: 'flex', gap: 6 }}>
                                                                {canApprove ? (
                                                                    <button
                                                                        type="button"
                                                                        className="btn-portal"
                                                                        style={{ padding: '6px 10px' }}
                                                                        onClick={() => handleApproveReturn(row)}
                                                                        disabled={approvingId !== null}
                                                                        title={t('btn.approveTitle')}
                                                                    >
                                                                        <Check size={15} />
                                                                    </button>
                                                                ) : null}
                                                                <button
                                                                    type="button"
                                                                    className="btn-portal-outline"
                                                                    style={{ padding: '6px 10px' }}
                                                                    onClick={() => handleViewReturn(row)}
                                                                    title={t('btn.viewTitle')}
                                                                >
                                                                    <Eye size={15} />
                                                                </button>
                                                                {String(row.status || '').toLowerCase() !==
                                                                'rejected' ? (
                                                                    <button
                                                                        type="button"
                                                                        className="btn-portal-outline"
                                                                        style={{ padding: '6px 10px' }}
                                                                        onClick={() => handleEditReturn(row)}
                                                                        disabled={saving}
                                                                        title={t('btn.editTitle')}
                                                                    >
                                                                        <Pencil size={15} />
                                                                    </button>
                                                                ) : null}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </>
            ) : null}

            {formOpen ? (
                <InlineFormScreen
                    title={
                        <div className="pi-modal-title">
                            <span className="pi-breadcrumb">
                                {t('form.breadcrumbParent')} ›{' '}
                                <span className="pi-b-active">
                                    {editingReturnId
                                        ? t('form.breadcrumbEditLeaf')
                                        : t('form.breadcrumbNewLeaf')}
                                </span>
                            </span>
                            <div className="pi-title-main">
                                <RotateCcw size={24} />
                                <span>
                                    {editingReturnId ? t('form.titleEdit') : t('form.title')}
                                </span>
                            </div>
                        </div>
                    }
                    onBack={closeForm}
                    backLabel={t('btn.backList')}
                    bodyClassName="supplier-affiliated-return-form-body"
                    footer={
                        <div className="pi-modal-footer">
                            <div className="pi-footer-left">
                                <button
                                    type="button"
                                    className="btn-pi-cancel"
                                    onClick={closeForm}
                                    disabled={saving}
                                >
                                    {t('btn.cancel')}
                                </button>
                            </div>
                            <div className="pi-footer-right">
                                {formError ? (
                                    <div
                                        style={{
                                            flex: '1 1 100%',
                                            marginBottom: 8,
                                            padding: '8px 12px',
                                            borderRadius: 8,
                                            fontSize: '0.8125rem',
                                            color: '#B91C1C',
                                            border: '1px solid #FECACA',
                                            background: '#FEF2F2',
                                        }}
                                    >
                                        {formError}
                                    </div>
                                ) : null}
                                <button
                                    type="button"
                                    className="btn-pi-create"
                                    onClick={handleSubmit}
                                    disabled={saving || invoiceLoading || !selectedCustomerKey}
                                >
                                    {saving ? (
                                        <span
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 8,
                                            }}
                                        >
                                            <Loader2
                                                size={16}
                                                className="supplier-sales-last-sale-spinner"
                                                aria-hidden
                                            />
                                            {editingReturnId
                                                ? t('btn.saving')
                                                : t('btn.creating')}
                                        </span>
                                    ) : editingReturnId ? (
                                        t('btn.saveUpdate')
                                    ) : selectedInvoiceId ? (
                                        t('btn.createLinked')
                                    ) : (
                                        t('btn.createUnlinked')
                                    )}
                                </button>
                            </div>
                        </div>
                    }
                >
                    <form className="pi-form-container" onSubmit={handleSubmit}>
                        {invoiceLoading ? (
                            <div style={{ padding: '12px 0 24px' }}>
                                <ShimmerTextBlock lines={5} />
                                <div style={{ marginTop: 18 }}>
                                    <ShimmerTable rows={5} columns={6} />
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="pi-ap-alert" style={{ marginBottom: 24 }}>
                                    <span>{t('form.alert')}</span>
                                </div>

                                <div className="pi-header-grid">
                                    <div className="pi-field pi-full-width">
                                        <label>
                                            {t('form.customerRequired')}{' '}
                                            <span style={{ color: '#DC2626' }}>*</span>
                                        </label>
                                        <SearchableEntityCombobox
                                            className="supplier-sales-return-customer-combobox"
                                            menuMinWidth={520}
                                            portalClassName="supplier-invoice-combobox-menu"
                                            options={customerComboboxOptions}
                                            value={selectedCustomerKey}
                                            displayText={customerSearchDraft}
                                            entityLabel="customer"
                                            loading={customersLoading}
                                            inactiveTagLabel={t('form.inactiveTag')}
                                            placeholder={t('form.customerPlaceholder')}
                                            emptyHint={
                                                customersLoading
                                                    ? t('form.loadingCustomers')
                                                    : customers.length === 0
                                                      ? t('form.noCustomers')
                                                      : t('form.noCustomerMatches')
                                            }
                                            disabled={saving}
                                            onDisplayTextChange={(text) => {
                                                setCustomerSearchDraft(text);
                                                if (!text.trim()) {
                                                    setSelectedCustomerKey('');
                                                    return;
                                                }
                                                if (selectedCustomer && text.trim() !== selectedCustomer.label.trim()) {
                                                    setSelectedCustomerKey('');
                                                }
                                            }}
                                            onSelect={(opt) => {
                                                const c = customers.find((row) => row.key === opt.id);
                                                setSelectedCustomerKey(String(opt.id));
                                                setCustomerSearchDraft(c?.label || opt.label || '');
                                                setSelectedInvoiceId('');
                                                setInvoiceSearchDraft('');
                                            }}
                                        />
                                        <span className="pi-hint" style={{ marginTop: 6, display: 'block' }}>
                                            {t('form.customerHint')}
                                        </span>
                                    </div>
                                </div>

                                <div className="pi-header-grid">
                                    <div className="pi-field pi-full-width">
                                        <label>
                                            {t('form.salesInvoice')}{' '}
                                            <span style={{ fontWeight: 400, color: '#94A3B8' }}>
                                                {t('form.optional')}
                                            </span>
                                        </label>
                                        <SearchableEntityCombobox
                                            className="supplier-sales-invoice-return-combobox"
                                            menuMinWidth={520}
                                            portalClassName="supplier-invoice-combobox-menu"
                                            options={invoiceComboboxOptions}
                                            value={selectedInvoiceId}
                                            displayText={invoiceSearchDraft}
                                            entityLabel="invoice"
                                            loading={invoicesLoading}
                                            placeholder={
                                                selectedCustomer
                                                    ? t('form.invoicePlaceholder')
                                                    : t('form.invoiceNeedCustomer')
                                            }
                                            emptyHint={
                                                !selectedCustomer
                                                    ? t('form.invoiceNeedCustomer')
                                                    : invoicesLoading
                                                      ? t('form.loadingInvoices')
                                                      : customerInvoices.length === 0
                                                        ? t('form.noInvoicesForCustomer')
                                                        : t('form.noMatches')
                                            }
                                            disabled={saving || !selectedCustomer}
                                            onDisplayTextChange={(text) => {
                                                setInvoiceSearchDraft(text);
                                                if (!text.trim()) {
                                                    setSelectedInvoiceId('');
                                                    return;
                                                }
                                                if (selectedInvoiceId && selectedInvoiceMeta) {
                                                    const selectedLabel = salesInvoiceSelectedDisplay(
                                                        selectedInvoiceMeta,
                                                    );
                                                    if (text.trim() !== selectedLabel.trim()) {
                                                        setSelectedInvoiceId('');
                                                    }
                                                }
                                            }}
                                            onSelect={(opt) => {
                                                const inv = customerInvoices.find(
                                                    (row) => String(row.id) === String(opt.id),
                                                );
                                                setSelectedInvoiceId(String(opt.id));
                                                setInvoiceSearchDraft(
                                                    inv ? salesInvoiceSelectedDisplay(inv) : opt.label || '',
                                                );
                                            }}
                                        />
                                        {selectedCustomer && !invoicesLoading ? (
                                            <span className="pi-hint" style={{ marginTop: 6, display: 'block' }}>
                                                {t('form.invoiceHintFiltered', {
                                                    n: customerInvoices.length,
                                                    s: customerInvoices.length === 1 ? '' : 's',
                                                })}
                                            </span>
                                        ) : null}
                                    </div>
                                </div>

                                {invoiceDetail ? (
                                    <>
                                        <div className="pi-header-grid">
                                            <div className="pi-field">
                                                <label>{t('form.invoiceNo')}</label>
                                                <input readOnly value={invoiceDetail.invoiceNo || t('emdash')} />
                                            </div>
                                            <div className="pi-field">
                                                <label>{t('form.issueDate')}</label>
                                                <input
                                                    readOnly
                                                    value={invoiceDetail.invoiceDate?.slice(0, 10) || t('emdash')}
                                                />
                                            </div>
                                            <div className="pi-field">
                                                <label>{t('form.dueDate')}</label>
                                                <input
                                                    readOnly
                                                    value={invoiceDetail.dueDate?.slice(0, 10) || t('emdash')}
                                                />
                                            </div>
                                        </div>
                                        <div className="pi-header-grid">
                                            <div className="pi-field pi-full-width">
                                                <label>{t('form.customer')}</label>
                                                <input
                                                    readOnly
                                                    value={
                                                        selectedInvoiceMeta?.workshopName &&
                                                        selectedInvoiceMeta?.branch
                                                            ? `${selectedInvoiceMeta.workshopName} — ${selectedInvoiceMeta.branch}`
                                                            : selectedInvoiceMeta?.branch ||
                                                              selectedInvoiceMeta?.workshopName ||
                                                              t('emdash')
                                                    }
                                                />
                                            </div>
                                        </div>
                                        <div className="pi-header-grid">
                                            <div className="pi-field">
                                                <label>{t('form.grandTotal')}</label>
                                                <input
                                                    readOnly
                                                    value={t('money.sar', {
                                                        amount: sarFmt(invoiceDetail.grandTotal),
                                                    })}
                                                />
                                            </div>
                                            <div className="pi-field">
                                                <label>{t('form.paid')}</label>
                                                <input
                                                    readOnly
                                                    value={t('money.sar', {
                                                        amount: sarFmt(invoiceDetail.paid),
                                                    })}
                                                />
                                            </div>
                                            <div className="pi-field">
                                                <label>{t('form.balanceDue')}</label>
                                                <input
                                                    readOnly
                                                    style={{ fontWeight: 700, color: '#b91c1c' }}
                                                    value={t('money.sar', {
                                                        amount: sarFmt(invoiceDetail.outstanding),
                                                    })}
                                                />
                                            </div>
                                        </div>
                                    </>
                                ) : null}

                                <div className="pi-header-grid">
                                    <div className="pi-field">
                                        <label>{t('form.returnDate')}</label>
                                        <input
                                            type="date"
                                            value={returnDate}
                                            onChange={(e) => setReturnDate(e.target.value)}
                                            disabled={saving}
                                        />
                                    </div>
                                    <div className="pi-field">
                                        <label>{t('form.reference')}</label>
                                        <input
                                            value={reference}
                                            onChange={(e) => setReference(e.target.value)}
                                            placeholder={t('form.referencePh')}
                                            disabled={saving}
                                        />
                                    </div>
                                    <div className="pi-field">
                                        <label>{t('form.description')}</label>
                                        <input
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            placeholder={t('form.descriptionPh')}
                                            disabled={saving}
                                        />
                                    </div>
                                </div>

                                {returnHistory.length > 0 ? (
                                    <div
                                        style={{
                                            marginBottom: 20,
                                            padding: '12px 14px',
                                            background: '#F8FAFC',
                                            borderRadius: 10,
                                            border: '1px solid #E2E8F0',
                                            fontSize: '0.8125rem',
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontSize: '0.75rem',
                                                fontWeight: 700,
                                                color: '#334155',
                                                marginBottom: 8,
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.04em',
                                            }}
                                        >
                                            {t('form.prevReturns', { n: returnHistory.length })}
                                        </div>
                                        <ul style={{ margin: 0, paddingLeft: 18, color: '#64748B' }}>
                                            {returnHistory.map((r) => (
                                                <li key={r.id} style={{ marginBottom: 6 }}>
                                                    <strong>{r.returnNo}</strong> ·{' '}
                                                    {r.returnDate?.slice(0, 10) || t('emdash')} ·{' '}
                                                    {t('money.sar', { amount: sarFmt(r.grandTotal) })}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ) : null}

                                <div className="pi-lines-section">
                                    {selectedInvoiceId ? (
                                        <>
                                            <div
                                                className="pi-lines-header"
                                                style={{ gridTemplateColumns: lineGridCols }}
                                            >
                                                <div className="pi-col-item">{t('form.col.item')}</div>
                                                <div className="pi-col-qty">{t('form.col.invoiced')}</div>
                                                <div className="pi-col-qty">{t('form.col.returned')}</div>
                                                <div className="pi-col-qty">{t('form.col.left')}</div>
                                                <div className="pi-col-qty">{t('form.col.returnQty')}</div>
                                                <div className="pi-col-item">{t('form.col.reason')}</div>
                                            </div>
                                            {(invoiceDetail?.items || []).length === 0 ? (
                                                <div
                                                    className="pi-line-row"
                                                    style={{
                                                        justifyContent: 'center',
                                                        color: '#64748B',
                                                        fontSize: '0.875rem',
                                                        margin: '8px',
                                                    }}
                                                >
                                                    {t('form.noLineItems')}
                                                </div>
                                            ) : (
                                                (invoiceDetail?.items || []).map((it) => {
                                                    const id = String(it.id);
                                                    const orig = Number(it.qty);
                                                    const already = returnedSoFar.get(id) || 0;
                                                    const remaining = Math.max(0, orig - already);
                                                    return (
                                                        <div
                                                            key={id}
                                                            className="pi-lines-header pi-line-data-row"
                                                            style={{
                                                                gridTemplateColumns: lineGridCols,
                                                                alignItems: 'center',
                                                            }}
                                                        >
                                                            <div className="pi-col-item" style={{ minWidth: 0 }}>
                                                                <span style={{ fontWeight: 600 }}>
                                                                    {it.productName || t('emdash')}
                                                                </span>
                                                                {it.unit ? (
                                                                    <span
                                                                        style={{
                                                                            display: 'block',
                                                                            fontSize: '0.75rem',
                                                                            color: '#94A3B8',
                                                                        }}
                                                                    >
                                                                        {it.unit}
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                            <div className="pi-col-qty">{orig}</div>
                                                            <div className="pi-col-qty">{already}</div>
                                                            <div
                                                                className="pi-col-qty"
                                                                style={{
                                                                    fontWeight: remaining <= 0 ? 600 : 500,
                                                                    color: remaining <= 0 ? '#94A3B8' : '#0f172a',
                                                                }}
                                                            >
                                                                {remaining}
                                                            </div>
                                                            <div className="pi-col-qty">
                                                                {remaining <= 0 ? (
                                                                    <span style={{ color: '#94A3B8' }}>
                                                                        {t('emdash')}
                                                                    </span>
                                                                ) : (
                                                                    <input
                                                                        type="text"
                                                                        inputMode="decimal"
                                                                        className="pi-row-input"
                                                                        value={lineQty[id] ?? ''}
                                                                        onChange={(e) =>
                                                                            setLineQty((prev) => ({
                                                                                ...prev,
                                                                                [id]: e.target.value,
                                                                            }))
                                                                        }
                                                                        placeholder="0"
                                                                        disabled={saving}
                                                                    />
                                                                )}
                                                            </div>
                                                            <div className="pi-col-item" style={{ minWidth: 0 }}>
                                                                <input
                                                                    type="text"
                                                                    className="pi-row-input"
                                                                    value={lineReason[id] ?? ''}
                                                                    onChange={(e) =>
                                                                        setLineReason((prev) => ({
                                                                            ...prev,
                                                                            [id]: e.target.value,
                                                                        }))
                                                                    }
                                                                    placeholder={t('form.reasonPh')}
                                                                    disabled={saving || remaining <= 0}
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <div
                                                className="pi-lines-header"
                                                style={{ gridTemplateColumns: manualGridCols }}
                                            >
                                                <div className="pi-col-item">{t('form.col.item')}</div>
                                                <div className="pi-col-uom">{t('form.col.uom')}</div>
                                                <div className="pi-col-qty">{t('form.col.returnQty')}</div>
                                                <div className="pi-col-qty">{t('form.col.unitPrice')}</div>
                                                <div className="pi-col-qty">{t('form.col.vat')}</div>
                                                <div className="pi-col-item">{t('form.col.reason')}</div>
                                                <div />
                                            </div>
                                            {!selectedCustomer ? (
                                                <div
                                                    className="pi-line-row"
                                                    style={{
                                                        justifyContent: 'center',
                                                        color: '#64748B',
                                                        fontSize: '0.875rem',
                                                        margin: '8px',
                                                        textAlign: 'center',
                                                        padding: '20px 16px',
                                                    }}
                                                >
                                                    {t('form.pickCustomerFirst')}
                                                </div>
                                            ) : (
                                                <>
                                                    <p
                                                        style={{
                                                            margin: '0 8px 12px',
                                                            color: '#64748B',
                                                            fontSize: '0.8125rem',
                                                        }}
                                                    >
                                                        {t('form.manualLinesHint')}
                                                    </p>
                                                    {manualLines.map((row) => (
                                                        <div
                                                            key={row.id}
                                                            className="pi-lines-header pi-line-data-row"
                                                            style={{
                                                                gridTemplateColumns: manualGridCols,
                                                                alignItems: 'center',
                                                                gap: 8,
                                                            }}
                                                        >
                                                            <div className="pi-col-item" style={{ minWidth: 0 }}>
                                                                <SearchableEntityCombobox
                                                                    className="supplier-return-product-combobox"
                                                                    menuMinWidth={420}
                                                                    portalClassName="supplier-invoice-combobox-menu"
                                                                    options={productOptions}
                                                                    value={row.supplierProductId}
                                                                    displayText={row.searchDraft}
                                                                    entityLabel="product"
                                                                    loading={productSearchLoading}
                                                                    placeholder={t('form.productPlaceholder')}
                                                                    emptyHint={t('form.noProductMatches')}
                                                                    disabled={saving}
                                                                    filterLocally={false}
                                                                    onDisplayTextChange={(text) => {
                                                                        setManualLines((prev) =>
                                                                            prev.map((ln) =>
                                                                                ln.id === row.id
                                                                                    ? {
                                                                                          ...ln,
                                                                                          searchDraft: text,
                                                                                          productName: text,
                                                                                      }
                                                                                    : ln,
                                                                            ),
                                                                        );
                                                                        void searchProducts(text);
                                                                    }}
                                                                    onSelect={(opt) => {
                                                                        setManualLines((prev) =>
                                                                            prev.map((ln) =>
                                                                                ln.id === row.id
                                                                                    ? {
                                                                                          ...ln,
                                                                                          supplierProductId:
                                                                                              opt.supplierProductId ||
                                                                                              String(opt.id),
                                                                                          productId: opt.productId || '',
                                                                                          productName:
                                                                                              opt.productName ||
                                                                                              opt.label,
                                                                                          unit: opt.unit || '',
                                                                                          warehouseUnit:
                                                                                              opt.warehouseUnit ||
                                                                                              opt.unit ||
                                                                                              '',
                                                                                          workshopUnit:
                                                                                              opt.workshopUnit ||
                                                                                              opt.unit ||
                                                                                              '',
                                                                                          conversionFactor:
                                                                                              Number(
                                                                                                  opt.conversionFactor,
                                                                                              ) || 1,
                                                                                          unitPrice:
                                                                                              opt.unitPrice != null
                                                                                                  ? String(opt.unitPrice)
                                                                                                  : ln.unitPrice,
                                                                                          searchDraft: opt.label || '',
                                                                                      }
                                                                                    : ln,
                                                                            ),
                                                                        );
                                                                    }}
                                                                />
                                                            </div>
                                                            <div className="pi-col-uom">
                                                                {lineUomOptions(row).length > 1 ? (
                                                                    <select
                                                                        className="pi-row-input"
                                                                        value={row.unit || lineUomOptions(row)[0]}
                                                                        disabled={saving}
                                                                        onChange={(e) =>
                                                                            setManualLines((prev) =>
                                                                                prev.map((ln) =>
                                                                                    ln.id === row.id
                                                                                        ? {
                                                                                              ...ln,
                                                                                              unit: e.target.value,
                                                                                          }
                                                                                        : ln,
                                                                                ),
                                                                            )
                                                                        }
                                                                    >
                                                                        {lineUomOptions(row).map((u) => (
                                                                            <option key={u} value={u}>
                                                                                {u}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                ) : (
                                                                    <input
                                                                        type="text"
                                                                        className="pi-row-input"
                                                                        value={row.unit || ''}
                                                                        disabled={saving}
                                                                        onChange={(e) =>
                                                                            setManualLines((prev) =>
                                                                                prev.map((ln) =>
                                                                                    ln.id === row.id
                                                                                        ? {
                                                                                              ...ln,
                                                                                              unit: e.target.value,
                                                                                          }
                                                                                        : ln,
                                                                                ),
                                                                            )
                                                                        }
                                                                        placeholder="pcs"
                                                                    />
                                                                )}
                                                            </div>
                                                            <div className="pi-col-qty">
                                                                <input
                                                                    type="text"
                                                                    inputMode="decimal"
                                                                    className="pi-row-input"
                                                                    value={row.qtyReturned}
                                                                    onChange={(e) =>
                                                                        setManualLines((prev) =>
                                                                            prev.map((ln) =>
                                                                                ln.id === row.id
                                                                                    ? {
                                                                                          ...ln,
                                                                                          qtyReturned: e.target.value,
                                                                                      }
                                                                                    : ln,
                                                                            ),
                                                                        )
                                                                    }
                                                                    placeholder="0"
                                                                    disabled={saving}
                                                                />
                                                                {formatReturnUomConversionPreview(row, t) ? (
                                                                    <div
                                                                        style={{
                                                                            fontSize: '0.65rem',
                                                                            color: '#64748b',
                                                                            lineHeight: 1.3,
                                                                            marginTop: 2,
                                                                            whiteSpace: 'normal',
                                                                        }}
                                                                    >
                                                                        {formatReturnUomConversionPreview(row, t)}
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                            <div className="pi-col-qty">
                                                                <input
                                                                    type="text"
                                                                    inputMode="decimal"
                                                                    className="pi-row-input"
                                                                    value={row.unitPrice}
                                                                    onChange={(e) =>
                                                                        setManualLines((prev) =>
                                                                            prev.map((ln) =>
                                                                                ln.id === row.id
                                                                                    ? { ...ln, unitPrice: e.target.value }
                                                                                    : ln,
                                                                            ),
                                                                        )
                                                                    }
                                                                    placeholder="0.00"
                                                                    disabled={saving}
                                                                />
                                                            </div>
                                                            <div className="pi-col-qty">
                                                                <input
                                                                    type="text"
                                                                    inputMode="decimal"
                                                                    className="pi-row-input"
                                                                    value={row.vatRate}
                                                                    onChange={(e) =>
                                                                        setManualLines((prev) =>
                                                                            prev.map((ln) =>
                                                                                ln.id === row.id
                                                                                    ? { ...ln, vatRate: e.target.value }
                                                                                    : ln,
                                                                            ),
                                                                        )
                                                                    }
                                                                    placeholder="15"
                                                                    disabled={saving}
                                                                />
                                                            </div>
                                                            <div className="pi-col-item" style={{ minWidth: 0 }}>
                                                                <input
                                                                    type="text"
                                                                    className="pi-row-input"
                                                                    value={row.reason}
                                                                    onChange={(e) =>
                                                                        setManualLines((prev) =>
                                                                            prev.map((ln) =>
                                                                                ln.id === row.id
                                                                                    ? { ...ln, reason: e.target.value }
                                                                                    : ln,
                                                                            ),
                                                                        )
                                                                    }
                                                                    placeholder={t('form.reasonPh')}
                                                                    disabled={saving}
                                                                />
                                                            </div>
                                                            <div>
                                                                <button
                                                                    type="button"
                                                                    className="btn-portal-outline"
                                                                    style={{ padding: '6px 8px' }}
                                                                    disabled={saving || manualLines.length <= 1}
                                                                    onClick={() =>
                                                                        setManualLines((prev) =>
                                                                            prev.filter((ln) => ln.id !== row.id),
                                                                        )
                                                                    }
                                                                    title={t('btn.removeLine')}
                                                                >
                                                                    ×
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    <button
                                                        type="button"
                                                        className="btn-add-line"
                                                        style={{ marginTop: 12 }}
                                                        disabled={saving}
                                                        onClick={() => {
                                                            setManualLines((prev) => [
                                                                ...prev,
                                                                emptyManualLine(`m${Date.now()}`),
                                                            ]);
                                                            void searchProducts('');
                                                        }}
                                                    >
                                                        <Plus size={16} /> {t('btn.addLine')}
                                                    </button>
                                                </>
                                            )}
                                        </>
                                    )}
                                </div>

                                <div className="pi-footer-grid" style={{ marginTop: 8 }}>
                                    <div>
                                        <div className="pi-field pi-full-width">
                                            <label>{t('form.notes')}</label>
                                            <textarea
                                                rows={4}
                                                value={notes}
                                                onChange={(e) => setNotes(e.target.value)}
                                                disabled={saving}
                                                placeholder={t('form.notesPh')}
                                            />
                                        </div>
                                    </div>
                                    <div className="pi-footer-column pi-summary-column">
                                        <div className="pi-summary-card">
                                            <div className="pi-summary-row pi-grand-total">
                                                <span>{t('form.returnTotal')}</span>
                                                <span>
                                                    {t('money.sar', { amount: sarFmt(totalSelected) })}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="pi-ap-alert">
                                            <span>{t('form.footerAlert')}</span>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </form>
                </InlineFormScreen>
            ) : null}

            {viewReturnId ? (
                <InlineFormScreen
                    title={
                        <div className="pi-modal-title">
                            <span className="pi-breadcrumb">
                                {t('page.breadcrumb')} ›{' '}
                                <span className="pi-b-active">
                                    {viewReturnDetail?.returnNumber || t('fallback.return')}
                                </span>
                            </span>
                            <div className="pi-title-main">
                                <RotateCcw size={24} />
                                <span>{t('view.creditNote')}</span>
                            </div>
                        </div>
                    }
                    onBack={closeViewReturn}
                    backLabel={t('btn.backReturns')}
                    bodyClassName="supplier-affiliated-return-view-body"
                >
                    {viewReturnLoading ? (
                        <ShimmerTextBlock lines={12} />
                    ) : viewReturnDetail ? (
                        <WorkshopPurchaseReturnDetailView
                            detail={viewReturnDetail}
                            variant="supplier"
                            compact
                        />
                    ) : (
                        <p style={{ margin: 0, color: '#64748b' }}>{t('view.loadFailed')}</p>
                    )}
                </InlineFormScreen>
            ) : null}
        </div>
    );
}
