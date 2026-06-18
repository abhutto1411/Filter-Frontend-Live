import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Loader2, RefreshCw, Plus, Trash2, Edit2, Eye, X, FileText, Search,
} from 'lucide-react';
import {
    listDemoInvoices,
    getDemoInvoice,
    createDemoInvoice,
    updateDemoInvoice,
    deleteDemoInvoice,
    getWorkshopOptions,
    getBranches,
    getDepartmentProducts,
    getDepartmentServices,
} from '../../services/superAdminApi';
import InvoiceDetailsModal from '../../components/pos/modern/InvoiceDetailsModal';
import { CHECKLIST_ROWS } from '../../utils/thermalInvoiceTotals';

const PAGE_SIZE = 50;

const num = (v) =>
    `SAR ${Number(v ?? 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

function formatDate(raw) {
    if (!raw) return '—';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw);
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Format a date/ISO into a `datetime-local` input value (local time). */
function toLocalDateTimeInput(raw) {
    const d = raw instanceof Date ? raw : new Date(raw);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Sandbox / demo invoices. Looks identical to real invoices in the UI but
 * never affects journals, inventory, workflow, or notifications. Super
 * admin only.
 */
export default function DemoInvoicesPage() {
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [workshopOptions, setWorkshopOptions] = useState([]);
    const [filterWorkshopId, setFilterWorkshopId] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editId, setEditId] = useState(null);   // null = create
    const [viewRow, setViewRow] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await listDemoInvoices({
                workshopId: filterWorkshopId || undefined,
                search: search.trim() || undefined,
                limit: PAGE_SIZE,
                offset: (page - 1) * PAGE_SIZE,
            });
            setRows(Array.isArray(res?.items) ? res.items : []);
            setTotal(Number(res?.total) || 0);
        } catch (e) {
            setError(e?.message || 'Could not load demo invoices');
            setRows([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }, [filterWorkshopId, search, page]);

    useEffect(() => { void load(); }, [load]);
    useEffect(() => { setPage(1); }, [filterWorkshopId, search]);

    // Workshop options (once).
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await getWorkshopOptions();
                const list = Array.isArray(res?.workshops) ? res.workshops
                    : Array.isArray(res?.data?.workshops) ? res.data.workshops
                    : Array.isArray(res) ? res : [];
                if (!cancelled) {
                    setWorkshopOptions(list.map((w) => ({
                        id: String(w.id),
                        name: String(w.name || '').trim() || 'Workshop',
                    })));
                }
            } catch {
                if (!cancelled) setWorkshopOptions([]);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const handleDelete = async (row) => {
        if (!window.confirm(`Delete demo invoice ${row.invoiceNo}?`)) return;
        try {
            await deleteDemoInvoice(row.id);
            await load();
        } catch (e) {
            alert(e?.message || 'Delete failed');
        }
    };

    const openView = async (row) => {
        setViewRow({ id: row.id, loading: true });
        try {
            const res = await getDemoInvoice(row.id);
            setViewRow(res?.invoice ?? res?.data ?? null);
        } catch (e) {
            setViewRow({ id: row.id, error: e?.message || 'Could not load invoice' });
        }
    };

    const cellTh = {
        padding: '10px 12px', textAlign: 'left',
        fontSize: '0.7rem', fontWeight: 700, color: '#475569',
        textTransform: 'uppercase', background: '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
    };
    const cellTd = { padding: '12px', verticalAlign: 'middle', fontSize: '0.8125rem' };

    return (
        <div style={{ padding: 20 }}>
            <header style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>
                        Demo Invoices
                    </h1>
                    <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.875rem' }}>
                        Sandbox invoices for demos &amp; testing — no real impact on workshops, journals, or inventory.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        type="button"
                        onClick={() => load()}
                        disabled={loading}
                        style={btnSecondary}
                    >
                        <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
                    </button>
                    <button
                        type="button"
                        onClick={() => { setEditId(null); setModalOpen(true); }}
                        style={btnPrimary}
                    >
                        <Plus size={14} /> New Demo Invoice
                    </button>
                </div>
            </header>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 220 }}>
                    <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Workshop</label>
                    <select
                        value={filterWorkshopId}
                        onChange={(e) => setFilterWorkshopId(e.target.value)}
                        style={selectStyle}
                    >
                        <option value="">All workshops</option>
                        {workshopOptions.map((w) => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                    </select>
                </div>
                <div style={{ flex: 1, position: 'relative', minWidth: 240 }}>
                    <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search invoice no, customer, plate…"
                        style={{ ...inputStyle, paddingLeft: 34 }}
                    />
                </div>
            </div>

            {error && (
                <div style={{ padding: 12, background: '#fef2f2', color: '#b91c1c', borderRadius: 10, marginBottom: 12 }}>
                    {error}
                </div>
            )}

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                        <tr>
                            <th style={cellTh}>Date</th>
                            <th style={cellTh}>Invoice No</th>
                            <th style={cellTh}>Customer</th>
                            <th style={cellTh}>Workshop / Branch</th>
                            <th style={cellTh}>Items</th>
                            <th style={{ ...cellTh, textAlign: 'right' }}>Total</th>
                            <th style={{ ...cellTh, textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>
                                <Loader2 size={18} className="spin" /> Loading…
                            </td></tr>
                        ) : rows.length === 0 ? (
                            <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>
                                No demo invoices yet. Click <strong>New Demo Invoice</strong> to create one.
                            </td></tr>
                        ) : rows.map((r) => (
                            <tr key={r.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                                <td style={cellTd}>{formatDate(r.invoiceDate ?? r.createdAt)}</td>
                                <td style={cellTd}><span style={{ fontWeight: 700, color: '#2563eb' }}>{r.invoiceNo}</span></td>
                                <td style={cellTd}>
                                    <div style={{ fontWeight: 700 }}>{r.customerName ?? '—'}</div>
                                    {r.vehiclePlate ? (
                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{r.vehiclePlate}</div>
                                    ) : null}
                                </td>
                                <td style={cellTd}>
                                    <div>{r.workshop?.name ?? '—'}</div>
                                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{r.branch?.name ?? '—'}</div>
                                </td>
                                <td style={cellTd}>{r.itemsCount}</td>
                                <td style={{ ...cellTd, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                                    {num(r.totalAmount)}
                                </td>
                                <td style={{ ...cellTd, textAlign: 'right' }}>
                                    <div style={{ display: 'inline-flex', gap: 4 }}>
                                        <button type="button" onClick={() => openView(r)} style={iconBtn('#1d4ed8', '#eff6ff', '#bfdbfe')} title="View">
                                            <Eye size={13} />
                                        </button>
                                        <button type="button" onClick={() => { setEditId(r.id); setModalOpen(true); }} style={iconBtn('#92400e', '#fef3c7', '#fde68a')} title="Edit">
                                            <Edit2 size={13} />
                                        </button>
                                        <button type="button" onClick={() => handleDelete(r)} style={iconBtn('#991b1b', '#fef2f2', '#fecaca')} title="Delete">
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {total > 0 && (
                    <div style={{
                        padding: '12px 14px', borderTop: '1px solid #e2e8f0',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        flexWrap: 'wrap', gap: 12,
                    }}>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            Showing <strong>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}</strong> of <strong>{total}</strong>
                        </div>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                            <PgBtn onClick={() => setPage(1)} disabled={page === 1}>« First</PgBtn>
                            <PgBtn onClick={() => setPage(page - 1)} disabled={page === 1}>‹ Prev</PgBtn>
                            <PgBtn onClick={() => setPage(page + 1)} disabled={page >= totalPages}>Next ›</PgBtn>
                            <PgBtn onClick={() => setPage(totalPages)} disabled={page >= totalPages}>Last »</PgBtn>
                        </div>
                    </div>
                )}
            </div>

            {modalOpen && (
                <DemoInvoiceModal
                    editId={editId}
                    workshopOptions={workshopOptions}
                    onClose={() => { setModalOpen(false); setEditId(null); }}
                    onSaved={async () => { setModalOpen(false); setEditId(null); await load(); }}
                />
            )}

            {viewRow && (
                viewRow.loading ? (
                    <div style={modalBackdrop}>
                        <div style={{ ...modalCard, padding: 0, width: 'min(420px, 100%)' }}>
                            <div style={modalHeader}>
                                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Loading invoice</h3>
                                <button type="button" onClick={() => setViewRow(null)} style={modalCloseBtn} aria-label="Close">
                                    <X size={18} />
                                </button>
                            </div>
                            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                                <Loader2 size={20} className="spin" /> Loading…
                            </div>
                        </div>
                    </div>
                ) : viewRow.error ? (
                    <div style={modalBackdrop}>
                        <div style={{ ...modalCard, padding: 0, width: 'min(420px, 100%)' }}>
                            <div style={modalHeader}>
                                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Invoice error</h3>
                                <button type="button" onClick={() => setViewRow(null)} style={modalCloseBtn} aria-label="Close">
                                    <X size={18} />
                                </button>
                            </div>
                            <div style={{ padding: 22 }}>
                                <p style={{ color: '#b91c1c', margin: 0 }}>{viewRow.error}</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <InvoiceDetailsModal
                        invoice={mapDemoToInvoice(viewRow)}
                        isOpen={true}
                        footerVariant="pos"
                        onClose={() => setViewRow(null)}
                    />
                )
            )}
        </div>
    );
}

/* ───────── Create / Edit modal ────────────────────────────────────────── */

function DemoInvoiceModal({ editId, workshopOptions, onClose, onSaved }) {
    const isEdit = !!editId;
    const [loading, setLoading] = useState(isEdit);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const [workshopId, setWorkshopId] = useState('');
    const [branchId, setBranchId] = useState('');
    const [branches, setBranches] = useState([]);
    // Invoice date & time chosen by the admin — this becomes the date printed on
    // the invoice (not the row's creation timestamp). Defaults to now for new.
    const [invoiceDateTime, setInvoiceDateTime] = useState(() =>
        editId ? '' : toLocalDateTimeInput(new Date()),
    );
    const [customerName, setCustomerName] = useState('');
    const [customerMobile, setCustomerMobile] = useState('');
    const [customerType, setCustomerType] = useState('Individual');
    const [customerTaxId, setCustomerTaxId] = useState('');
    const [vehiclePlate, setVehiclePlate] = useState('');
    const [vehicleMake, setVehicleMake] = useState('');
    const [vehicleModel, setVehicleModel] = useState('');
    const [vehicleYear, setVehicleYear] = useState('');
    const [vehicleVin, setVehicleVin] = useState('');
    const [odometerReading, setOdometerReading] = useState('');
    const [nextOilChangeKm, setNextOilChangeKm] = useState('');
    const [notes, setNotes] = useState('');
    const [discountAmount, setDiscountAmount] = useState(0);
    const [promoDiscount, setPromoDiscount] = useState(0);
    // 6-item maintenance checklist mirroring CHECKLIST_ROWS in the real invoice.
    const [checks, setChecks] = useState([false, false, false, false, false, false]);

    const [items, setItems] = useState([]); // [{tempId, itemType, name, departmentId, productId, serviceId, qty, unitPrice, vatMode, vatPercent}]

    // Master catalog data
    const [catalogProducts, setCatalogProducts] = useState([]);
    const [catalogServices, setCatalogServices] = useState([]);

    // Picker state
    const [pickerOpen, setPickerOpen] = useState(false);
    const [pickerKind, setPickerKind] = useState('product'); // 'product' | 'service'
    const [pickerQuery, setPickerQuery] = useState('');
    const [pickerDeptId, setPickerDeptId] = useState('');

    // Load existing data if editing.
    useEffect(() => {
        if (!isEdit) return;
        let cancelled = false;
        (async () => {
            try {
                const res = await getDemoInvoice(editId);
                if (cancelled) return;
                const inv = res?.invoice ?? res;
                setWorkshopId(inv.workshop?.id ?? '');
                setBranchId(inv.branch?.id ?? '');
                setInvoiceDateTime(toLocalDateTimeInput(inv.invoiceDate ?? inv.issuedAt));
                setCustomerName(inv.customerName ?? '');
                setCustomerMobile(inv.customerMobile ?? '');
                setCustomerType(inv.customerType ?? 'Individual');
                setCustomerTaxId(inv.customerTaxId ?? '');
                setVehiclePlate(inv.vehiclePlate ?? '');
                setVehicleMake(inv.vehicleMake ?? '');
                setVehicleModel(inv.vehicleModel ?? '');
                setVehicleYear(inv.vehicleYear ?? '');
                setVehicleVin(inv.vehicleVin ?? '');
                setOdometerReading(inv.odometerReading != null ? String(inv.odometerReading) : '');
                setNextOilChangeKm(inv.nextOilChangeKm != null ? String(inv.nextOilChangeKm) : '');
                setNotes(inv.notes ?? '');
                setDiscountAmount(Number(inv.discountAmount ?? 0));
                setPromoDiscount(Number(inv.promoDiscount ?? 0));
                const cl = inv.maintenanceChecklist?.checks;
                if (Array.isArray(cl)) {
                    setChecks([0, 1, 2, 3, 4, 5].map((i) => Boolean(cl[i])));
                }
                setItems((inv.items ?? []).map((it, i) => ({
                    tempId: `e-${i}`,
                    itemType: it.itemType,
                    departmentId: it.departmentId ?? '',
                    productId: it.productId ?? null,
                    serviceId: it.serviceId ?? null,
                    name: it.name,
                    arabicName: it.arabicName ?? '',
                    qty: Number(it.qty),
                    unitPrice: Number(it.unitPrice),
                    vatMode: it.vatMode || 'inclusive',
                    vatPercent: Number(it.vatPercent ?? 15),
                    itemDiscount: Number(it.itemDiscount ?? 0),
                })));
            } catch (e) {
                if (!cancelled) setError(e?.message || 'Failed to load demo invoice');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [editId, isEdit]);

    // Load branches when workshop changes.
    useEffect(() => {
        if (!workshopId) {
            setBranches([]);
            if (!isEdit) setBranchId('');
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const res = await getBranches({ workshopId });
                const list = Array.isArray(res?.branches) ? res.branches
                    : Array.isArray(res?.data?.branches) ? res.data.branches : [];
                if (!cancelled) {
                    setBranches(list.map((b) => ({
                        id: String(b.id),
                        name: String(b.name || '').trim() || 'Branch',
                    })));
                }
            } catch {
                if (!cancelled) setBranches([]);
            }
        })();
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workshopId]);

    // Load master catalog once.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [prodRes, svcRes] = await Promise.all([
                    getDepartmentProducts().catch(() => null),
                    getDepartmentServices().catch(() => null),
                ]);
                if (cancelled) return;
                setCatalogProducts(flattenCatalog(prodRes, 'product'));
                setCatalogServices(flattenCatalog(svcRes, 'service'));
            } catch {
                if (!cancelled) { setCatalogProducts([]); setCatalogServices([]); }
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const departments = useMemo(() => {
        const map = new Map();
        for (const p of [...catalogProducts, ...catalogServices]) {
            if (p.departmentId && !map.has(p.departmentId)) {
                map.set(p.departmentId, { id: p.departmentId, name: p.departmentName });
            }
        }
        return Array.from(map.values());
    }, [catalogProducts, catalogServices]);

    const totals = useMemo(
        () => computeTotals(items, discountAmount, promoDiscount),
        [items, discountAmount, promoDiscount],
    );

    const handleAddItem = (kind) => {
        setPickerKind(kind);
        setPickerQuery('');
        setPickerDeptId('');
        setPickerOpen(true);
    };

    const handlePickItem = (item) => {
        setItems((prev) => [...prev, {
            tempId: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            itemType: item.itemType,
            departmentId: item.departmentId,
            productId: item.itemType === 'product' ? item.id : null,
            serviceId: item.itemType === 'service' ? item.id : null,
            name: item.name,
            qty: 1,
            unitPrice: Number(item.price ?? 0),
            vatMode: 'inclusive',
            vatPercent: 15,
        }]);
        setPickerOpen(false);
    };

    const handleSave = async () => {
        if (!workshopId) { setError('Pick a workshop'); return; }
        if (!branchId)   { setError('Pick a branch'); return; }
        if (items.length === 0) { setError('Add at least one item'); return; }
        setSaving(true);
        setError('');
        try {
            // Selected date+time → both the printed invoice date and the issued
            // timestamp. Local datetime-local value converted to an ISO instant.
            const invoiceIso = invoiceDateTime
                ? new Date(invoiceDateTime).toISOString()
                : undefined;
            const body = {
                workshopId,
                branchId,
                invoiceDate: invoiceIso,
                issuedAt:    invoiceIso,
                customerName:   customerName   || null,
                customerMobile: customerMobile || null,
                customerType:   customerType   || null,
                customerTaxId:  customerTaxId  || null,
                vehiclePlate:   vehiclePlate   || null,
                vehicleMake:    vehicleMake    || null,
                vehicleModel:   vehicleModel   || null,
                vehicleYear:    vehicleYear    || null,
                vehicleVin:     vehicleVin     || null,
                odometerReading: odometerReading ? Number(odometerReading) : null,
                nextOilChangeKm: nextOilChangeKm ? Number(nextOilChangeKm) : null,
                notes: notes || null,
                discountAmount: Number(discountAmount || 0),
                promoDiscount:  Number(promoDiscount  || 0),
                maintenanceChecklist: { checks },
                items: items.map((it) => ({
                    itemType: it.itemType,
                    productId: it.productId,
                    serviceId: it.serviceId,
                    departmentId: it.departmentId,
                    name: it.name,
                    arabicName: it.arabicName || null,
                    qty: Number(it.qty),
                    unitPrice: Number(it.unitPrice),
                    vatMode: it.vatMode,
                    vatPercent: Number(it.vatPercent),
                    itemDiscount: Number(it.itemDiscount || 0),
                })),
            };
            if (isEdit) await updateDemoInvoice(editId, body);
            else        await createDemoInvoice(body);
            onSaved?.();
        } catch (e) {
            setError(e?.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div role="dialog" aria-modal="true" style={modalBackdrop}>
            <div onClick={(e) => e.stopPropagation()} style={{ ...modalCard, width: 'min(1000px, 100%)' }}>
                <div style={modalHeader}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                        {isEdit ? 'Edit Demo Invoice' : 'New Demo Invoice'}
                    </h3>
                    <button type="button" onClick={onClose} style={modalCloseBtn}><X size={18} /></button>
                </div>
                {loading ? (
                    <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                        <Loader2 size={20} className="spin" /> Loading…
                    </div>
                ) : (
                    <div style={{ padding: 22, maxHeight: '80vh', overflow: 'auto' }}>
                        {error && (
                            <div style={{ padding: 10, background: '#fef2f2', color: '#991b1b', borderRadius: 8, marginBottom: 12, fontSize: '0.875rem' }}>
                                {error}
                            </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                            <FormField label="Workshop *">
                                <select value={workshopId} onChange={(e) => setWorkshopId(e.target.value)} style={selectStyle}>
                                    <option value="">Select workshop…</option>
                                    {workshopOptions.map((w) => (
                                        <option key={w.id} value={w.id}>{w.name}</option>
                                    ))}
                                </select>
                            </FormField>
                            <FormField label="Branch *">
                                <select value={branchId} onChange={(e) => setBranchId(e.target.value)} disabled={!workshopId} style={{ ...selectStyle, opacity: workshopId ? 1 : 0.6 }}>
                                    <option value="">Select branch…</option>
                                    {branches.map((b) => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </FormField>
                            <FormField label="Invoice date & time *">
                                <input
                                    type="datetime-local"
                                    value={invoiceDateTime}
                                    onChange={(e) => setInvoiceDateTime(e.target.value)}
                                    style={inputStyle}
                                />
                            </FormField>
                        </div>

                        <SectionHeader>Customer</SectionHeader>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                            <FormField label="Customer name">
                                <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} style={inputStyle} placeholder="Walk-in" />
                            </FormField>
                            <FormField label="Mobile">
                                <input value={customerMobile} onChange={(e) => setCustomerMobile(e.target.value)} style={inputStyle} placeholder="—" />
                            </FormField>
                            <FormField label="Customer type">
                                <select value={customerType} onChange={(e) => setCustomerType(e.target.value)} style={selectStyle}>
                                    <option value="Individual">Individual</option>
                                    <option value="Corporate">Corporate</option>
                                    <option value="Walk-in">Walk-in</option>
                                </select>
                            </FormField>
                            <FormField label="Customer Tax ID">
                                <input value={customerTaxId} onChange={(e) => setCustomerTaxId(e.target.value)} style={inputStyle} placeholder="—" />
                            </FormField>
                        </div>

                        <SectionHeader>Vehicle</SectionHeader>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                            <FormField label="Plate">
                                <input value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value)} style={inputStyle} placeholder="ABC 1234" />
                            </FormField>
                            <FormField label="Make">
                                <input value={vehicleMake} onChange={(e) => setVehicleMake(e.target.value)} style={inputStyle} placeholder="Toyota" />
                            </FormField>
                            <FormField label="Model">
                                <input value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)} style={inputStyle} placeholder="Corolla" />
                            </FormField>
                            <FormField label="Year">
                                <input value={vehicleYear} onChange={(e) => setVehicleYear(e.target.value)} style={inputStyle} placeholder="2022" />
                            </FormField>
                            <FormField label="VIN">
                                <input value={vehicleVin} onChange={(e) => setVehicleVin(e.target.value)} style={inputStyle} placeholder="—" />
                            </FormField>
                            <FormField label="Odometer (km)">
                                <input type="number" min="0" value={odometerReading} onChange={(e) => setOdometerReading(e.target.value)} style={inputStyle} placeholder="—" />
                            </FormField>
                            <FormField label="Next oil change (km)">
                                <input type="number" min="0" value={nextOilChangeKm} onChange={(e) => setNextOilChangeKm(e.target.value)} style={inputStyle} placeholder="—" />
                            </FormField>
                        </div>

                        <SectionHeader>Items</SectionHeader>
                        {/* Items */}
                        <div style={{ marginBottom: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 800 }}>Line Items</h4>
                                <div style={{ display: 'inline-flex', gap: 6 }}>
                                    <button type="button" onClick={() => handleAddItem('product')} style={btnSmall}>
                                        <Plus size={12} /> Product
                                    </button>
                                    <button type="button" onClick={() => handleAddItem('service')} style={btnSmall}>
                                        <Plus size={12} /> Service
                                    </button>
                                </div>
                            </div>
                            {items.length === 0 ? (
                                <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: 8, fontSize: '0.875rem' }}>
                                    No items yet — add a product or service from master catalog.
                                </div>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                                    <thead style={{ background: '#f8fafc' }}>
                                        <tr>
                                            <th style={{ padding: 8, textAlign: 'left' }}>Type</th>
                                            <th style={{ padding: 8, textAlign: 'left' }}>Item</th>
                                            <th style={{ padding: 8, textAlign: 'left', width: 130 }}>Arabic name</th>
                                            <th style={{ padding: 8, textAlign: 'right', width: 80 }}>Qty</th>
                                            <th style={{ padding: 8, textAlign: 'right', width: 110 }}>Unit Price</th>
                                            <th style={{ padding: 8, textAlign: 'right', width: 100 }}>Discount</th>
                                            <th style={{ padding: 8, textAlign: 'right', width: 110 }}>Line</th>
                                            <th style={{ padding: 8, width: 40 }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((it, idx) => {
                                            const line = ((Number(it.qty) || 0) * (Number(it.unitPrice) || 0)) - Number(it.itemDiscount || 0);
                                            return (
                                                <tr key={it.tempId} style={{ borderTop: idx === 0 ? 'none' : '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: 8, textTransform: 'capitalize', fontSize: '0.7rem', color: '#64748b' }}>{it.itemType}</td>
                                                    <td style={{ padding: 8, fontWeight: 600 }}>{it.name}</td>
                                                    <td style={{ padding: 8 }}>
                                                        <input
                                                            value={it.arabicName ?? ''}
                                                            onChange={(e) => setItems((prev) => prev.map((p) => p.tempId === it.tempId ? { ...p, arabicName: e.target.value } : p))}
                                                            style={{ ...inputStyle, padding: '4px 6px', width: '100%' }}
                                                            placeholder="—"
                                                        />
                                                    </td>
                                                    <td style={{ padding: 8, textAlign: 'right' }}>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={it.qty}
                                                            onChange={(e) => setItems((prev) => prev.map((p) => p.tempId === it.tempId ? { ...p, qty: e.target.value } : p))}
                                                            style={{ ...inputStyle, padding: '4px 6px', width: 70, textAlign: 'right' }}
                                                        />
                                                    </td>
                                                    <td style={{ padding: 8, textAlign: 'right' }}>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={it.unitPrice}
                                                            onChange={(e) => setItems((prev) => prev.map((p) => p.tempId === it.tempId ? { ...p, unitPrice: e.target.value } : p))}
                                                            style={{ ...inputStyle, padding: '4px 6px', width: 100, textAlign: 'right' }}
                                                        />
                                                    </td>
                                                    <td style={{ padding: 8, textAlign: 'right' }}>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={it.itemDiscount ?? 0}
                                                            onChange={(e) => setItems((prev) => prev.map((p) => p.tempId === it.tempId ? { ...p, itemDiscount: e.target.value } : p))}
                                                            style={{ ...inputStyle, padding: '4px 6px', width: 90, textAlign: 'right' }}
                                                        />
                                                    </td>
                                                    <td style={{ padding: 8, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                                                        {num(line)}
                                                    </td>
                                                    <td style={{ padding: 8 }}>
                                                        <button type="button" onClick={() => setItems((prev) => prev.filter((p) => p.tempId !== it.tempId))} style={iconBtn('#991b1b', '#fef2f2', '#fecaca')}>
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                            <FormField label="Invoice discount">
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={discountAmount}
                                    onChange={(e) => setDiscountAmount(e.target.value)}
                                    style={inputStyle}
                                />
                            </FormField>
                            <FormField label="Promo code discount">
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={promoDiscount}
                                    onChange={(e) => setPromoDiscount(e.target.value)}
                                    style={inputStyle}
                                />
                            </FormField>
                            <FormField label="Notes">
                                <input value={notes} onChange={(e) => setNotes(e.target.value)} style={inputStyle} />
                            </FormField>
                        </div>

                        <SectionHeader>Maintenance Checklist</SectionHeader>
                        <div style={{
                            display: 'grid', gridTemplateColumns: '1fr 1fr',
                            gap: 8, marginBottom: 14,
                            padding: 12, background: '#f8fafc', borderRadius: 10,
                        }}>
                            {CHECKLIST_ROWS.map(([en, ar], idx) => (
                                <label key={idx} style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    padding: '6px 8px', borderRadius: 6,
                                    cursor: 'pointer', userSelect: 'none',
                                    background: '#fff', border: '1px solid #e2e8f0',
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={!!checks[idx]}
                                        onChange={(e) => {
                                            const next = [...checks];
                                            next[idx] = e.target.checked;
                                            setChecks(next);
                                        }}
                                        style={{ cursor: 'pointer' }}
                                    />
                                    <span style={{ flex: 1, fontSize: '0.8125rem', fontWeight: 600 }}>
                                        {en}
                                    </span>
                                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                        {ar}
                                    </span>
                                </label>
                            ))}
                        </div>

                        {/* Totals */}
                        <div style={{ padding: 14, background: '#f8fafc', borderRadius: 10, marginBottom: 14 }}>
                            <Row label="Subtotal (excl VAT)" value={num(totals.subtotal)} />
                            {totals.itemDiscountTotal > 0 && (
                                <Row label="Item discounts" value={num(totals.itemDiscountTotal)} />
                            )}
                            <Row label="Invoice discount" value={num(totals.discountAmount)} />
                            <Row label="Promo discount" value={num(totals.promoDiscount)} />
                            <Row label="VAT" value={num(totals.vatAmount)} />
                            <Row label="Total amount due" value={num(totals.totalAmount)} bold />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <button type="button" onClick={onClose} disabled={saving} style={btnSecondary}>
                                Cancel
                            </button>
                            <button type="button" onClick={handleSave} disabled={saving} style={btnPrimary}>
                                {saving ? <><Loader2 size={14} className="spin" /> Saving…</> : <><FileText size={14} /> {isEdit ? 'Save Changes' : 'Create Demo Invoice'}</>}
                            </button>
                        </div>
                    </div>
                )}

                {/* Item picker — overlays modal */}
                {pickerOpen && (
                    <ItemPicker
                        kind={pickerKind}
                        items={pickerKind === 'product' ? catalogProducts : catalogServices}
                        departments={departments}
                        query={pickerQuery}
                        setQuery={setPickerQuery}
                        deptId={pickerDeptId}
                        setDeptId={setPickerDeptId}
                        onPick={handlePickItem}
                        onClose={() => setPickerOpen(false)}
                    />
                )}
            </div>
        </div>
    );
}

/* ───────── Master catalog item picker ─────────────────────────────────── */

function ItemPicker({ kind, items, departments, query, setQuery, deptId, setDeptId, onPick, onClose }) {
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return items.filter((it) => {
            if (deptId && String(it.departmentId) !== deptId) return false;
            if (!q) return true;
            return String(it.name ?? '').toLowerCase().includes(q);
        });
    }, [items, query, deptId]);

    return (
        <div style={{ ...modalBackdrop, zIndex: 200 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ ...modalCard, width: 'min(700px, 100%)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                <div style={modalHeader}>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, textTransform: 'capitalize' }}>
                        Pick {kind} from master catalog
                    </h3>
                    <button type="button" onClick={onClose} style={modalCloseBtn}><X size={18} /></button>
                </div>
                <div style={{ padding: 16, display: 'flex', gap: 10 }}>
                    <select value={deptId} onChange={(e) => setDeptId(e.target.value)} style={{ ...selectStyle, minWidth: 180 }}>
                        <option value="">All departments</option>
                        {departments.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </select>
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" style={{ ...inputStyle, flex: 1 }} />
                </div>
                <div style={{ overflow: 'auto', flex: 1, padding: '0 16px 16px' }}>
                    {filtered.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#94a3b8', padding: 30 }}>No items match.</div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                            <thead style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                                <tr>
                                    <th style={{ padding: 8, textAlign: 'left' }}>Name</th>
                                    <th style={{ padding: 8, textAlign: 'left' }}>Department</th>
                                    <th style={{ padding: 8, textAlign: 'right' }}>Price</th>
                                    <th style={{ padding: 8 }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((it) => (
                                    <tr key={`${it.itemType}-${it.id}`} style={{ borderTop: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: 8, fontWeight: 700 }}>{it.name}</td>
                                        <td style={{ padding: 8, color: '#64748b' }}>{it.departmentName ?? '—'}</td>
                                        <td style={{ padding: 8, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{num(it.price)}</td>
                                        <td style={{ padding: 8, textAlign: 'right' }}>
                                            <button type="button" onClick={() => onPick(it)} style={btnSmall}>
                                                <Plus size={12} /> Add
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ───────── Helpers ─────────────────────────────────────────────────────── */

/**
 * Map our stored demo invoice into the shape `CashierTaxInvoiceView` expects
 * (the same component used to render REAL invoices). Items use vatMode
 * 'inclusive' by default — unitPrice is treated as VAT-inclusive.
 */
function mapDemoToInvoice(demo) {
    return {
        invoiceNo: demo.invoiceNo,
        invoiceDate: demo.invoiceDate,
        issuedAt: demo.issuedAt ?? demo.invoiceDate,
        plateNo: demo.vehiclePlate ?? '',
        odometerReading: demo.odometerReading,
        nextOilChangeKm: demo.nextOilChangeKm,
        customerName: demo.customerName ?? '',
        customerMobile: demo.customerMobile ?? '',
        customerType: demo.customerType ?? '',
        customerTaxId: demo.customerTaxId ?? '',
        vehicleMake: demo.vehicleMake ?? '',
        vehicleModel: demo.vehicleModel ?? '',
        vehicleYear: demo.vehicleYear ?? '',
        vehicleVin: demo.vehicleVin ?? '',
        workshop: demo.workshop ?? null,
        branch: demo.branch ?? null,
        // Seller identity for the header VAT reg + ZATCA Phase-2 QR.
        workshopName: demo.workshop?.name ?? '',
        branchVatId: demo.branch?.vatId ?? '',
        workshopTaxId: demo.workshop?.taxId ?? '',
        vatAmount: demo.vatAmount,
        totalAmount: demo.totalAmount,
        maintenanceChecklist: demo.maintenanceChecklist ?? { checks: [] },
        items: (demo.items ?? []).map((it) => ({
            productName: it.name,
            productNameArabic: it.arabicName ?? '',
            unitPrice: Number(it.unitPrice),
            qty: Number(it.qty),
            discountType: 'amount',
            discountValue: Number(it.itemDiscount ?? 0),
        })),
    };
}

function computeTotals(items, discountAmount = 0, promoDiscount = 0) {
    let subtotal = 0;
    let vat = 0;
    let itemDiscountTotal = 0;
    for (const it of items) {
        const qty = Number(it.qty || 1);
        const price = Number(it.unitPrice || 0);
        const vp = Number(it.vatPercent ?? 15);
        const itemDisc = Number(it.itemDiscount || 0);
        const line = qty * price - itemDisc;
        itemDiscountTotal += itemDisc;
        if ((it.vatMode || 'inclusive') === 'inclusive') {
            const base = line / (1 + vp / 100);
            subtotal += base;
            vat += line - base;
        } else {
            subtotal += line;
            vat += line * (vp / 100);
        }
    }
    const disc = Number(discountAmount || 0);
    const promo = Number(promoDiscount || 0);
    const grand = Math.max(0, subtotal + vat - disc - promo);
    return {
        subtotal: round2(subtotal),
        vatAmount: round2(vat),
        discountAmount: round2(disc),
        promoDiscount: round2(promo),
        itemDiscountTotal: round2(itemDiscountTotal),
        totalAmount: round2(grand),
    };
}

function round2(n) { return Math.round(n * 100) / 100; }

/**
 * Master catalog API may return data nested by department. Flatten to a single
 * array shape: [{ id, name, departmentId, departmentName, price, itemType }]
 */
function flattenCatalog(res, kind) {
    if (!res) return [];
    // Accept multiple response shapes defensively.
    const list = Array.isArray(res?.data?.departments) ? res.data.departments
        : Array.isArray(res?.departments) ? res.departments
        : Array.isArray(res) ? res : [];
    const out = [];
    for (const d of list) {
        const deptName = d.name ?? d.departmentName ?? '—';
        // Backend returns `departmentId` (not `id`) at the department level.
        const deptId = d.departmentId ?? d.id;
        const children = Array.isArray(d.products) ? d.products
            : Array.isArray(d.services) ? d.services
            : Array.isArray(d.items) ? d.items : [];
        for (const it of children) {
            // Products → `salePrice` (or `salePriceBeforeVat`).
            // Services → `sellingPrice` (or `sellingPriceBeforeVat`).
            const price =
                kind === 'product'
                    ? Number(it.salePrice ?? it.salePriceBeforeVat ?? it.basePrice ?? it.price ?? 0)
                    : Number(it.sellingPrice ?? it.sellingPriceBeforeVat ?? it.price ?? 0);
            out.push({
                id: String(it.id),
                name: it.name ?? it.productName ?? it.serviceName ?? '—',
                price,
                departmentId: deptId ? String(deptId) : null,
                departmentName: deptName,
                itemType: kind,
            });
        }
    }
    return out;
}

/* ───────── Tiny shared style/element atoms ─────────────────────────────── */

const inputStyle = {
    width: '100%', padding: '8px 12px', borderRadius: 8,
    border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box',
};
const selectStyle = { ...inputStyle, background: '#fff' };
const btnPrimary = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 14px', borderRadius: 8,
    border: 'none', background: '#0f172a', color: '#fff',
    cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 700,
};
const btnSecondary = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 14px', borderRadius: 8,
    border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a',
    cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 700,
};
const btnSmall = {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '5px 10px', borderRadius: 6,
    border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a',
    cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700,
};
const iconBtn = (fg, bg, br) => ({
    padding: 6, borderRadius: 6,
    border: `1px solid ${br}`, background: bg, color: fg,
    cursor: 'pointer',
});
const modalBackdrop = {
    position: 'fixed', inset: 0,
    background: 'rgba(15,23,42,0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 100, padding: 16,
};
const modalCard = {
    background: '#fff', borderRadius: 16,
    maxHeight: '92vh', overflow: 'hidden',
    boxShadow: '0 24px 48px rgba(15,23,42,0.2)',
};
const modalHeader = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 22px', borderBottom: '1px solid #e2e8f0',
};
const modalCloseBtn = {
    border: 'none', background: '#f1f5f9', borderRadius: 8, padding: 8, cursor: 'pointer',
};

function FormField({ label, children }) {
    return (
        <div>
            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#475569', marginBottom: 4, textTransform: 'uppercase' }}>
                {label}
            </label>
            {children}
        </div>
    );
}

function SectionHeader({ children }) {
    return (
        <div style={{
            fontSize: '0.7rem', fontWeight: 800, color: '#64748b',
            textTransform: 'uppercase', letterSpacing: '0.05em',
            margin: '12px 0 8px', paddingBottom: 6,
            borderBottom: '1px solid #e2e8f0',
        }}>
            {children}
        </div>
    );
}

function Row({ label, value, bold }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: bold ? '0.9375rem' : '0.8125rem', fontWeight: bold ? 800 : 500, color: bold ? '#0f172a' : '#475569' }}>
            <span>{label}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        </div>
    );
}

function Lbl({ children }) {
    return (
        <p style={{ margin: 0, fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            {children}
        </p>
    );
}

function PgBtn({ children, disabled, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            style={{
                padding: '6px 10px', borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: disabled ? '#f8fafc' : '#fff',
                color: disabled ? '#94a3b8' : '#0f172a',
                cursor: disabled ? 'not-allowed' : 'pointer',
                fontSize: '0.75rem', fontWeight: 700,
            }}
        >
            {children}
        </button>
    );
}
