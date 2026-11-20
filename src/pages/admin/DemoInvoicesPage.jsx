import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useMatch, useOutletContext } from 'react-router-dom';
import {
    AlertCircle, Loader2, RefreshCw, Plus, Trash2, Edit2, Eye, X, FileText, Search, Printer,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ApprovalPageShell from '../../components/admin/ApprovalPageShell';
import CashierTaxInvoiceView from '../../components/pos/modern/CashierTaxInvoiceView';
import '../../components/pos/modern/CashierTaxInvoiceView.css';
import '../../styles/admin/ApprovalsPage.css';
import UiPager from '../../components/UiPager';
import { useServerPaging } from '../../hooks/usePagedRows';
import '../../styles/ui.css';
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
import { CHECKLIST_ROWS } from '../../utils/thermalInvoiceTotals';
import { diT } from '../../utils/demoInvoicesI18n';

const DEMO_INVOICES_LIST = '/admin/demo-invoices';

function useDemoLocale() {
    const outletCtx = useOutletContext() || {};
    const locale =
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => diT(locale, key, vars), [locale]);
    return { locale, t };
}

const num = (v, t) => {
    const amount = Number(v ?? 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    return t ? t('money.sar', { amount }) : `SAR ${amount}`;
};

function formatDate(raw, locale = 'en') {
    if (!raw) return '—';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw);
    return d.toLocaleDateString(locale === 'ar' ? 'ar-SA' : undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
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
    const { hasPermission } = useAuth();
    const { locale, t } = useDemoLocale();
    const navigate = useNavigate();
    const newRoute = useMatch('/admin/demo-invoices/new');
    const editRoute = useMatch('/admin/demo-invoices/:invoiceId/edit');
    const viewRoute = useMatch('/admin/demo-invoices/:invoiceId/view');
    const routeView = Boolean(newRoute || editRoute || viewRoute);

    const goToList = useCallback(() => {
        navigate(DEMO_INVOICES_LIST);
    }, [navigate]);

    const canView = hasPermission('demo-invoices.view');
    const canCreate = hasPermission('demo-invoices.create');
    const canEdit = hasPermission('demo-invoices.edit');
    const canDelete = hasPermission('demo-invoices.delete');

    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [workshopOptions, setWorkshopOptions] = useState([]);
    const [filterWorkshopId, setFilterWorkshopId] = useState('');
    const paging = useServerPaging({ resetKey: `${filterWorkshopId}|${search}` });
    const { page, pageSize } = paging;

    const load = useCallback(async () => {
        if (!canView || routeView) return;
        setLoading(true);
        setError('');
        try {
            const res = await listDemoInvoices({
                workshopId: filterWorkshopId || undefined,
                search: search.trim() || undefined,
                limit: pageSize,
                offset: (page - 1) * pageSize,
            });
            setRows(Array.isArray(res?.items) ? res.items : []);
            setTotal(Number(res?.total) || 0);
        } catch (e) {
            setError(e?.message || t('err.loadList'));
            setRows([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }, [canView, routeView, filterWorkshopId, search, page, pageSize, t]);

    useEffect(() => { void load(); }, [load]);

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
                        name: String(w.name || '').trim() || t('fallback.workshop'),
                    })));
                }
            } catch {
                if (!cancelled) setWorkshopOptions([]);
            }
        })();
        return () => { cancelled = true; };
    }, [t]);

    const handleDelete = async (row) => {
        if (!canDelete) return;
        if (!window.confirm(t('confirm.delete', { no: row.invoiceNo }))) return;
        try {
            await deleteDemoInvoice(row.id);
            await load();
        } catch (e) {
            alert(e?.message || t('err.delete'));
        }
    };

    const openView = (row) => {
        navigate(`${DEMO_INVOICES_LIST}/${encodeURIComponent(row.id)}/view`);
    };

    if (!canView) {
        return (
            <div className="ui-root ui-root--flush">
                <div className="ui-panel">
                    <div className="ui-state">
                        <div className="ui-state-title">{t('page.noPerm')}</div>
                    </div>
                </div>
            </div>
        );
    }

    if (newRoute) {
        return (
            <DemoInvoiceForm
                editId={null}
                workshopOptions={workshopOptions}
                onClose={goToList}
                onSaved={goToList}
                t={t}
                locale={locale}
            />
        );
    }

    if (editRoute) {
        return (
            <DemoInvoiceForm
                editId={editRoute.params.invoiceId}
                workshopOptions={workshopOptions}
                onClose={goToList}
                onSaved={goToList}
                t={t}
                locale={locale}
            />
        );
    }

    if (viewRoute) {
        return (
            <DemoInvoiceViewPage
                invoiceId={viewRoute.params.invoiceId}
                onClose={goToList}
                t={t}
            />
        );
    }

    return (
        <div className="ui-root ui-root--flush">
            <div className="ui-table-wrap">
                <div className="ui-toolbar">
                    <div className="ui-search">
                        <Search size={14} />
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={t('search.placeholder')}
                            className="ui-input"
                        />
                    </div>
                    <select
                        value={filterWorkshopId}
                        onChange={(e) => setFilterWorkshopId(e.target.value)}
                        className="ui-select"
                        style={{ maxWidth: 220 }}
                        aria-label={t('label.workshop')}
                    >
                        <option value="">{t('opt.allWorkshops')}</option>
                        {workshopOptions.map((w) => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                    </select>
                    <div className="ui-toolbar-end">
                        <button
                            type="button"
                            onClick={() => load()}
                            disabled={loading}
                            className="ui-btn ui-btn--default ui-btn--sm"
                        >
                            <RefreshCw size={14} className={loading ? 'ui-spin' : ''} /> {t('btn.refresh')}
                        </button>
                        {canCreate && (
                            <button
                                type="button"
                                onClick={() => navigate(`${DEMO_INVOICES_LIST}/new`)}
                                className="ui-btn ui-btn--primary ui-btn--sm"
                            >
                                <Plus size={14} /> {t('btn.new')}
                            </button>
                        )}
                    </div>
                </div>

                {error && (
                    <div className="ui-panel-pad">
                        <div className="ui-banner ui-banner--dang" role="alert">
                            <AlertCircle size={15} />
                            <span>{error}</span>
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="ui-state">
                        <Loader2 size={20} className="ui-spin" />
                        <div className="ui-state-title">{t('loading')}</div>
                    </div>
                ) : rows.length === 0 ? (
                    <div className="ui-empty">
                        <div className="ui-empty-icon"><FileText size={18} /></div>
                        <div className="ui-empty-title">
                            {t('empty.list', { action: t('empty.listAction') }).split(t('empty.listAction')).map((part, i, arr) => (
                                i < arr.length - 1
                                    ? <span key={i}>{part}<strong>{t('empty.listAction')}</strong></span>
                                    : <span key={i}>{part}</span>
                            ))}
                        </div>
                    </div>
                ) : (
                <table className="ui-table">
                    <thead>
                        <tr>
                            <th>{t('th.date')}</th>
                            <th>{t('th.invoiceNo')}</th>
                            <th>{t('th.customer')}</th>
                            <th>{t('th.workshopBranch')}</th>
                            <th className="ui-num">{t('th.items')}</th>
                            <th className="ui-num">{t('th.total')}</th>
                            <th aria-label={t('th.actions')} />
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={r.id}>
                                <td data-label={t('th.date')} className="ui-nowrap">
                                    {formatDate(r.invoiceDate ?? r.createdAt, locale)}
                                </td>
                                <td data-label={t('th.invoiceNo')} className="ui-strong ui-mono">{r.invoiceNo}</td>
                                <td data-label={t('th.customer')}>
                                    <div className="ui-list-title">{r.customerName ?? '—'}</div>
                                    {r.vehiclePlate ? (
                                        <div className="ui-list-meta">{r.vehiclePlate}</div>
                                    ) : null}
                                </td>
                                <td data-label={t('th.workshopBranch')}>
                                    <div>{r.workshop?.name ?? '—'}</div>
                                    <div className="ui-list-meta">{r.branch?.name ?? '—'}</div>
                                </td>
                                <td data-label={t('th.items')} className="ui-num">{r.itemsCount}</td>
                                <td data-label={t('th.total')} className="ui-num ui-money">
                                    {num(r.totalAmount, t)}
                                </td>
                                <td>
                                    <div className="ui-row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                                        <button type="button" onClick={() => openView(r)} className="ui-btn ui-btn--icon ui-btn--subtle ui-btn--sm" title={t('title.view')}>
                                            <Eye size={13} />
                                        </button>
                                        {canEdit && (
                                            <button type="button" onClick={() => navigate(`${DEMO_INVOICES_LIST}/${encodeURIComponent(r.id)}/edit`)} className="ui-btn ui-btn--icon ui-btn--subtle ui-btn--sm" title={t('title.edit')}>
                                                <Edit2 size={13} />
                                            </button>
                                        )}
                                        {canDelete && (
                                            <button type="button" onClick={() => handleDelete(r)} className="ui-btn ui-btn--icon ui-btn--danger ui-btn--sm" title={t('title.delete')}>
                                                <Trash2 size={13} />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                )}
                <UiPager {...paging.pagerFor(total)} id="demo-invoices-per-page" />
            </div>
        </div>
    );
}

/* ───────── Full-page invoice view ─────────────────────────────────────── */

function DemoInvoiceViewPage({ invoiceId, onClose, t }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [invoice, setInvoice] = useState(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError('');
        getDemoInvoice(invoiceId)
            .then((res) => {
                if (!cancelled) setInvoice(res?.invoice ?? res?.data ?? null);
            })
            .catch((e) => {
                if (!cancelled) setError(e?.message || t('err.loadInvoice'));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [invoiceId, t]);

    const mapped = invoice ? mapDemoToInvoice(invoice) : null;

    return (
        <ApprovalPageShell
            title={invoice?.invoiceNo ? t('view.titleNo', { no: invoice.invoiceNo }) : t('view.title')}
            onBack={onClose}
            backLabel={t('view.back')}
            footer={mapped && !loading && !error ? (
                <>
                    <button type="button" onClick={() => window.print()} className="ui-btn ui-btn--default">
                        <Printer size={14} /> {t('btn.print')}
                    </button>
                    <button type="button" onClick={onClose} className="ui-btn ui-btn--primary">
                        {t('btn.done')}
                    </button>
                </>
            ) : null}
        >
            {loading ? (
                <div className="ui-state">
                    <Loader2 size={20} className="ui-spin" />
                    <div className="ui-state-title">{t('loading')}</div>
                </div>
            ) : error ? (
                <div className="ui-banner ui-banner--dang" role="alert">
                    <AlertCircle size={15} />
                    <span>{error}</span>
                </div>
            ) : mapped ? (
                <div className="demo-invoice-view-body">
                    <div className="demo-invoice-view-scroll">
                        <div className="demo-invoice-print-root">
                            <CashierTaxInvoiceView invoice={mapped} />
                        </div>
                    </div>
                </div>
            ) : (
                <div className="ui-state">
                    <div className="ui-state-title">{t('view.notFound')}</div>
                </div>
            )}
        </ApprovalPageShell>
    );
}

/* ───────── Create / Edit form (full page) ─────────────────────────────── */

function DemoInvoiceForm({ editId, workshopOptions, onClose, onSaved, t, locale }) {
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
    /** `automatic` (default on create) | `manual` */
    const [invoiceNoMode, setInvoiceNoMode] = useState(editId ? 'manual' : 'automatic');
    const [invoiceNo, setInvoiceNo] = useState('');
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
                setInvoiceNo(inv.invoiceNo ?? '');
                setInvoiceNoMode('manual');
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
                if (!cancelled) setError(e?.message || t('err.loadDemo'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [editId, isEdit, t]);

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
                        name: String(b.name || '').trim() || t('fallback.branch'),
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
        setPickerOpen(true);
    };

    const handlePickItems = (picked) => {
        if (!picked?.length) return;
        setItems((prev) => [
            ...prev,
            ...picked.map((item) => ({
                tempId: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                itemType: item.itemType,
                departmentId: item.departmentId,
                productId: item.itemType === 'product' ? item.id : null,
                serviceId: item.itemType === 'service' ? item.id : null,
                name: item.name,
                arabicName: item.arabicName ?? '',
                qty: 1,
                unitPrice: Number(item.price ?? 0),
                vatMode: 'inclusive',
                vatPercent: 15,
                itemDiscount: 0,
            })),
        ]);
        setPickerOpen(false);
    };

    const handleSave = async () => {
        if (!workshopId) { setError(t('err.pickWorkshop')); return; }
        if (!branchId)   { setError(t('err.pickBranch')); return; }
        if (items.length === 0) { setError(t('err.addItem')); return; }
        if (invoiceNoMode === 'manual' && !invoiceNo.trim()) {
            setError(t('err.invoiceNo'));
            return;
        }
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
            if (invoiceNoMode === 'manual') {
                body.invoiceNo = invoiceNo.trim();
            }
            if (isEdit) await updateDemoInvoice(editId, body);
            else        await createDemoInvoice(body);
            onSaved?.();
        } catch (e) {
            setError(e?.message || t('err.save'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <ApprovalPageShell
                title={isEdit ? t('form.editTitle') : t('form.newTitle')}
                onBack={onClose}
                backLabel={t('form.back')}
                backDisabled={saving}
                footer={!loading ? (
                    <>
                        <button type="button" onClick={onClose} disabled={saving} className="ui-btn ui-btn--default">
                            {t('btn.cancel')}
                        </button>
                        <button type="button" onClick={handleSave} disabled={saving} className="ui-btn ui-btn--primary">
                            {saving ? <><Loader2 size={14} className="ui-spin" /> {t('btn.saving')}</> : <><FileText size={14} /> {isEdit ? t('btn.saveChanges') : t('btn.create')}</>}
                        </button>
                    </>
                ) : null}
            >
                {loading ? (
                    <div className="ui-state">
                        <Loader2 size={20} className="ui-spin" />
                        <div className="ui-state-title">{t('loading')}</div>
                    </div>
                ) : (
                    <div className="demo-invoice-form-body">
                        {error && (
                            <div className="ui-banner ui-banner--dang" role="alert" style={{ marginBottom: 16 }}>
                                <AlertCircle size={15} />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="ui-form-grid" style={{ marginBottom: 18 }}>
                            <FormField span={4} label={t('label.workshopReq')}>
                                <select value={workshopId} onChange={(e) => setWorkshopId(e.target.value)} className="ui-select">
                                    <option value="">{t('opt.selectWorkshop')}</option>
                                    {workshopOptions.map((w) => (
                                        <option key={w.id} value={w.id}>{w.name}</option>
                                    ))}
                                </select>
                            </FormField>
                            <FormField span={4} label={t('label.branchReq')}>
                                <select value={branchId} onChange={(e) => setBranchId(e.target.value)} disabled={!workshopId} className="ui-select">
                                    <option value="">{t('opt.selectBranch')}</option>
                                    {branches.map((b) => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </FormField>
                            <FormField span={4} label={t('label.invoiceDateTime')}>
                                <input
                                    type="datetime-local"
                                    value={invoiceDateTime}
                                    onChange={(e) => setInvoiceDateTime(e.target.value)}
                                    className="ui-input"
                                />
                            </FormField>
                        </div>

                        <div className="ui-form-grid" style={{ marginBottom: 18 }}>
                            <FormField span={4} label={t('label.invoiceNoMode')}>
                                <div className="ui-chips">
                                    <button
                                        type="button"
                                        className={`ui-chip${invoiceNoMode === 'automatic' ? ' ui-chip--on' : ''}`}
                                        aria-pressed={invoiceNoMode === 'automatic'}
                                        onClick={() => setInvoiceNoMode('automatic')}
                                    >
                                        {t('invoiceNo.automatic')}
                                    </button>
                                    <button
                                        type="button"
                                        className={`ui-chip${invoiceNoMode === 'manual' ? ' ui-chip--on' : ''}`}
                                        aria-pressed={invoiceNoMode === 'manual'}
                                        onClick={() => setInvoiceNoMode('manual')}
                                    >
                                        {t('invoiceNo.manual')}
                                    </button>
                                </div>
                                {invoiceNoMode === 'automatic' && (
                                    <span className="ui-help">
                                        {isEdit ? t('invoiceNo.autoHintEdit') : t('invoiceNo.autoHint')}
                                    </span>
                                )}
                            </FormField>
                            {invoiceNoMode === 'manual' && (
                                <FormField span={4} label={t('label.invoiceNoReq')}>
                                    <input
                                        value={invoiceNo}
                                        onChange={(e) => setInvoiceNo(e.target.value)}
                                        className="ui-input"
                                        placeholder={t('ph.invoiceNo')}
                                        autoComplete="off"
                                    />
                                </FormField>
                            )}
                        </div>

                        <SectionHeader>{t('section.customer')}</SectionHeader>
                        <div className="ui-form-grid" style={{ marginBottom: 18 }}>
                            <FormField span={4} label={t('label.customerName')}>
                                <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="ui-input" placeholder={t('ph.walkIn')} />
                            </FormField>
                            <FormField span={4} label={t('label.mobile')}>
                                <input value={customerMobile} onChange={(e) => setCustomerMobile(e.target.value)} className="ui-input" placeholder="—" />
                            </FormField>
                            <FormField span={4} label={t('label.customerType')}>
                                <select value={customerType} onChange={(e) => setCustomerType(e.target.value)} className="ui-select">
                                    <option value="Individual">{t('type.Individual')}</option>
                                    <option value="Corporate">{t('type.Corporate')}</option>
                                    <option value="Walk-in">{t('type.Walk-in')}</option>
                                </select>
                            </FormField>
                            <FormField span={4} label={t('label.customerTaxId')}>
                                <input value={customerTaxId} onChange={(e) => setCustomerTaxId(e.target.value)} className="ui-input" placeholder="—" />
                            </FormField>
                        </div>

                        <SectionHeader>{t('section.vehicle')}</SectionHeader>
                        <div className="ui-form-grid" style={{ marginBottom: 18 }}>
                            <FormField span={4} label={t('label.plate')}>
                                <input value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value)} className="ui-input" placeholder="ABC 1234" />
                            </FormField>
                            <FormField span={4} label={t('label.make')}>
                                <input value={vehicleMake} onChange={(e) => setVehicleMake(e.target.value)} className="ui-input" placeholder="Toyota" />
                            </FormField>
                            <FormField span={4} label={t('label.model')}>
                                <input value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)} className="ui-input" placeholder="Corolla" />
                            </FormField>
                            <FormField span={4} label={t('label.year')}>
                                <input value={vehicleYear} onChange={(e) => setVehicleYear(e.target.value)} className="ui-input" placeholder="2022" />
                            </FormField>
                            <FormField span={4} label={t('label.vin')}>
                                <input value={vehicleVin} onChange={(e) => setVehicleVin(e.target.value)} className="ui-input" placeholder="—" />
                            </FormField>
                            <FormField span={4} label={t('label.odometer')}>
                                <input type="number" min="0" value={odometerReading} onChange={(e) => setOdometerReading(e.target.value)} className="ui-input" placeholder="—" />
                            </FormField>
                            <FormField span={4} label={t('label.nextOil')}>
                                <input type="number" min="0" value={nextOilChangeKm} onChange={(e) => setNextOilChangeKm(e.target.value)} className="ui-input" placeholder="—" />
                            </FormField>
                        </div>

                        <SectionHeader>{t('section.items')}</SectionHeader>
                        {/* Items */}
                        <div className="ui-table-wrap ui-table-wrap--scroll" style={{ marginBottom: 18 }}>
                            <div className="ui-toolbar">
                                <span className="ui-panel-title">{t('items.lineItems')}</span>
                                <div className="ui-toolbar-end">
                                    <button
                                        type="button"
                                        onClick={() => handleAddItem('product')}
                                        className="ui-btn ui-btn--default ui-btn--sm"
                                    >
                                        <Plus size={13} /> {t('btn.product')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleAddItem('service')}
                                        className="ui-btn ui-btn--default ui-btn--sm"
                                    >
                                        <Plus size={13} /> {t('btn.service')}
                                    </button>
                                </div>
                            </div>
                            {items.length === 0 ? (
                                <div className="ui-empty">
                                    <div className="ui-empty-title">{t('items.empty')}</div>
                                </div>
                            ) : (
                                <table className="ui-table">
                                    <thead>
                                        <tr>
                                            <th>{t('items.th.type')}</th>
                                            <th>{t('items.th.item')}</th>
                                            <th style={{ width: 150 }}>{t('items.th.arabic')}</th>
                                            <th className="ui-num" style={{ width: 90 }}>{t('items.th.qty')}</th>
                                            <th className="ui-num" style={{ width: 120 }}>{t('items.th.unitPrice')}</th>
                                            <th className="ui-num" style={{ width: 110 }}>{t('items.th.discount')}</th>
                                            <th className="ui-num" style={{ width: 120 }}>{t('items.th.line')}</th>
                                            <th style={{ width: 48 }} aria-label={t('items.th.remove')} />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((it) => {
                                            const line = ((Number(it.qty) || 0) * (Number(it.unitPrice) || 0)) - Number(it.itemDiscount || 0);
                                            return (
                                                <tr key={it.tempId}>
                                                    <td data-label={t('items.th.type')}>
                                                        <span className="ui-pill ui-pill--neutral">
                                                            {it.itemType === 'product' ? t('btn.product') : it.itemType === 'service' ? t('btn.service') : it.itemType}
                                                        </span>
                                                    </td>
                                                    <td data-label={t('items.th.item')} className="ui-strong">{it.name}</td>
                                                    <td data-label={t('items.th.arabic')}>
                                                        <input
                                                            value={it.arabicName ?? ''}
                                                            onChange={(e) => setItems((prev) => prev.map((p) => p.tempId === it.tempId ? { ...p, arabicName: e.target.value } : p))}
                                                            className="ui-input ui-input--cell"
                                                            style={{ width: '100%' }}
                                                            placeholder="—"
                                                        />
                                                    </td>
                                                    <td className="ui-num">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={it.qty}
                                                            onChange={(e) => setItems((prev) => prev.map((p) => p.tempId === it.tempId ? { ...p, qty: e.target.value } : p))}
                                                            className="ui-input ui-input--cell ui-input--figure"
                                                            style={{ width: 70 }}
                                                        />
                                                    </td>
                                                    <td className="ui-num">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={it.unitPrice}
                                                            onChange={(e) => setItems((prev) => prev.map((p) => p.tempId === it.tempId ? { ...p, unitPrice: e.target.value } : p))}
                                                            className="ui-input ui-input--cell ui-input--figure"
                                                            style={{ width: 100 }}
                                                        />
                                                    </td>
                                                    <td className="ui-num">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={it.itemDiscount ?? 0}
                                                            onChange={(e) => setItems((prev) => prev.map((p) => p.tempId === it.tempId ? { ...p, itemDiscount: e.target.value } : p))}
                                                            className="ui-input ui-input--cell ui-input--figure"
                                                            style={{ width: 90 }}
                                                        />
                                                    </td>
                                                    <td data-label={t('items.th.line')} className="ui-num ui-money">
                                                        {num(line, t)}
                                                    </td>
                                                    <td>
                                                        <button type="button" onClick={() => setItems((prev) => prev.filter((p) => p.tempId !== it.tempId))} className="ui-btn ui-btn--icon ui-btn--danger ui-btn--sm">
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

                        <div className="ui-form-grid" style={{ marginBottom: 18 }}>
                            <FormField span={4} label={t('label.invoiceDiscount')}>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={discountAmount}
                                    onChange={(e) => setDiscountAmount(e.target.value)}
                                    className="ui-input"
                                />
                            </FormField>
                            <FormField span={4} label={t('label.promoDiscount')}>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={promoDiscount}
                                    onChange={(e) => setPromoDiscount(e.target.value)}
                                    className="ui-input"
                                />
                            </FormField>
                            <FormField span={4} label={t('label.notes')}>
                                <input value={notes} onChange={(e) => setNotes(e.target.value)} className="ui-input" />
                            </FormField>
                        </div>

                        <SectionHeader>{t('section.checklist')}</SectionHeader>
                        <div className="ui-checks" style={{ marginBottom: 18 }}>
                            {CHECKLIST_ROWS.map(([en, ar], idx) => (
                                <label key={idx} className="ui-check">
                                    <input
                                        type="checkbox"
                                        checked={!!checks[idx]}
                                        onChange={(e) => {
                                            const next = [...checks];
                                            next[idx] = e.target.checked;
                                            setChecks(next);
                                        }}
                                    />
                                    <span className="ui-check-main">{locale === 'ar' ? ar : en}</span>
                                    <span className="ui-check-alt">{locale === 'ar' ? en : ar}</span>
                                </label>
                            ))}
                        </div>

                        {/* Totals */}
                        <div className="ui-sum ui-subgroup--card" style={{ marginBottom: 14 }}>
                            <Row label={t('totals.subtotal')} value={num(totals.subtotal, t)} />
                            {totals.itemDiscountTotal > 0 && (
                                <Row label={t('totals.itemDiscounts')} value={num(totals.itemDiscountTotal, t)} />
                            )}
                            <Row label={t('totals.invoiceDiscount')} value={num(totals.discountAmount, t)} />
                            <Row label={t('totals.promoDiscount')} value={num(totals.promoDiscount, t)} />
                            <Row label={t('totals.vat')} value={num(totals.vatAmount, t)} />
                            <Row label={t('totals.due')} value={num(totals.totalAmount, t)} bold />
                        </div>
                    </div>
                )}
            </ApprovalPageShell>

            {pickerOpen && (
                <ItemPicker
                    kind={pickerKind}
                    items={pickerKind === 'product' ? catalogProducts : catalogServices}
                    departments={departments}
                    onAddItems={handlePickItems}
                    onClose={() => setPickerOpen(false)}
                    t={t}
                />
            )}
        </>
    );
}

/* ───────── Master catalog item picker ─────────────────────────────────── */

function catalogItemKey(it) {
    return `${it.itemType}-${it.id}`;
}

function ItemPicker({ kind, items, departments, onAddItems, onClose, t }) {
    const [query, setQuery] = useState('');
    const [deptId, setDeptId] = useState('');
    const [selected, setSelected] = useState(() => new Set());
    const [highlightIdx, setHighlightIdx] = useState(0);
    const searchRef = useRef(null);
    const rowRefs = useRef([]);

    useEffect(() => {
        setQuery('');
        setDeptId('');
        setSelected(new Set());
        setHighlightIdx(0);
        const focusTimer = setTimeout(() => searchRef.current?.focus(), 0);
        return () => clearTimeout(focusTimer);
    }, [kind]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return items.filter((it) => {
            if (deptId && String(it.departmentId) !== deptId) return false;
            if (!q) return true;
            const name = String(it.name ?? '').toLowerCase();
            const dept = String(it.departmentName ?? '').toLowerCase();
            const ar = String(it.arabicName ?? '').toLowerCase();
            return name.includes(q) || dept.includes(q) || ar.includes(q);
        });
    }, [items, query, deptId]);

    useEffect(() => {
        setHighlightIdx((i) => {
            if (filtered.length === 0) return 0;
            return Math.min(i, filtered.length - 1);
        });
    }, [filtered]);

    useEffect(() => {
        const el = rowRefs.current[highlightIdx];
        if (el?.scrollIntoView) {
            el.scrollIntoView({ block: 'nearest' });
        }
    }, [highlightIdx, filtered.length]);

    const toggleKey = (key) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const toggleAllVisible = () => {
        const keys = filtered.map(catalogItemKey);
        const allSelected = keys.length > 0 && keys.every((k) => selected.has(k));
        setSelected((prev) => {
            const next = new Set(prev);
            if (allSelected) keys.forEach((k) => next.delete(k));
            else keys.forEach((k) => next.add(k));
            return next;
        });
    };

    const addSelected = () => {
        const picked = filtered.filter((it) => selected.has(catalogItemKey(it)));
        if (picked.length) onAddItems(picked);
        else onClose();
    };

    const handleSearchKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightIdx((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightIdx((i) => Math.max(i - 1, 0));
        } else if (e.key === 'Enter' && filtered[highlightIdx]) {
            e.preventDefault();
            toggleKey(catalogItemKey(filtered[highlightIdx]));
        } else if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
        }
    };

    const visibleKeys = filtered.map(catalogItemKey);
    const allVisibleSelected =
        visibleKeys.length > 0 && visibleKeys.every((k) => selected.has(k));
    const someVisibleSelected = visibleKeys.some((k) => selected.has(k));

    return (
        <div className="ui-overlay" onClick={onClose}>
            <div
                onClick={(e) => e.stopPropagation()}
                className="ui-modal ui-modal--wide ui-modal--tall ui-tokens"
                role="dialog"
                aria-modal="true"
            >
                <div className="ui-modal-head">
                    <span className="ui-modal-title">
                        {kind === 'product' ? t('picker.titleProducts') : t('picker.titleServices')}
                    </span>
                    <div className="ui-modal-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="ui-btn ui-btn--icon ui-btn--subtle ui-btn--sm"
                            aria-label={t('btn.cancel')}
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                <div className="ui-toolbar">
                    <div className="ui-search">
                        <Search size={14} />
                        <input
                            ref={searchRef}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={handleSearchKeyDown}
                            placeholder={t('picker.search')}
                            className="ui-input"
                            aria-label={t('aria.searchCatalog')}
                        />
                    </div>
                    <span className="ui-help">{t('picker.hint')}</span>
                    <select
                        value={deptId}
                        onChange={(e) => setDeptId(e.target.value)}
                        className="ui-select"
                        style={{ maxWidth: 220 }}
                        aria-label={t('aria.filterDept')}
                    >
                        <option value="">{t('picker.allDepts')}</option>
                        {departments.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </select>
                </div>

                <div className="ui-modal-body" style={{ padding: 0 }}>
                    {filtered.length === 0 ? (
                        <div className="ui-empty">
                            <div className="ui-empty-title">{t('picker.empty')}</div>
                        </div>
                    ) : (
                        <table className="ui-table ui-table--sticky ui-table--pick">
                            <thead>
                                <tr>
                                    <th style={{ width: 40 }}>
                                        <input
                                            type="checkbox"
                                            checked={allVisibleSelected}
                                            ref={(el) => {
                                                if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected;
                                            }}
                                            onChange={toggleAllVisible}
                                            aria-label={t('aria.selectAll')}
                                        />
                                    </th>
                                    <th>{t('picker.th.name')}</th>
                                    <th>{t('picker.th.dept')}</th>
                                    <th className="ui-num">{t('picker.th.price')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((it, idx) => {
                                    const key = catalogItemKey(it);
                                    const isSelected = selected.has(key);
                                    const isHighlight = idx === highlightIdx;
                                    return (
                                        <tr
                                            key={key}
                                            ref={(el) => { rowRefs.current[idx] = el; }}
                                            aria-selected={isSelected}
                                            data-cursor={isHighlight}
                                            onClick={() => toggleKey(key)}
                                            onMouseEnter={() => setHighlightIdx(idx)}
                                        >
                                            <td onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleKey(key)}
                                                    aria-label={t('aria.selectItem', { name: it.name })}
                                                />
                                            </td>
                                            <td data-label={t('picker.th.name')} className="ui-strong">{it.name}</td>
                                            <td data-label={t('picker.th.dept')}>{it.departmentName ?? '—'}</td>
                                            <td data-label={t('picker.th.price')} className="ui-num">{num(it.price, t)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="ui-modal-foot ui-modal-foot--split">
                    <span className="ui-help">
                        {selected.size > 0
                            ? t('picker.selected', { n: selected.size })
                            : t('picker.shown', { n: filtered.length })}
                    </span>
                    <div className="ui-row" style={{ gap: 8 }}>
                        <button type="button" onClick={onClose} className="ui-btn ui-btn--default">{t('btn.cancel')}</button>
                        <button
                            type="button"
                            onClick={addSelected}
                            disabled={selected.size === 0}
                            className="ui-btn ui-btn--primary"
                        >
                            <Plus size={14} />
                            {t('btn.addSelected', { n: selected.size })}
                        </button>
                    </div>
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
    const invoiceDate = demo.invoiceDate ?? demo.issuedAt ?? null;
    const issuedAt = demo.issuedAt ?? demo.invoiceDate ?? null;
    return {
        isDemo: true,
        invoiceNo: demo.invoiceNo,
        invoiceDate,
        issuedAt,
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


function FormField({ label, children, span = 4 }) {
    return (
        <div className={`ui-field ui-col-${span}`}>
            <label>{label}</label>
            {children}
        </div>
    );
}

function SectionHeader({ children }) {
    return (
        <div className="ui-subsection-head">
            <h4>{children}</h4>
        </div>
    );
}

function Row({ label, value, bold }) {
    return (
        <div className={`ui-sum-row${bold ? ' ui-sum-row--total' : ''}`}>
            <span>{label}</span>
            <span>{value}</span>
        </div>
    );
}

