import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { 
    Plus, Search, Download, Upload, Filter, 
    CheckCircle2, AlertCircle, Copy, XCircle,
    MoreVertical, Edit3, Trash2, Package, Layers,
    ChevronDown, Info, RefreshCw, Box, ShieldCheck,
    ArrowUp, Settings, LayoutGrid, Tags, Barcode, Loader2
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import MasterCatalogShell from './MasterCatalogShell';
import UiPager from '../UiPager';
import { usePagedRows } from '../../hooks/usePagedRows';
import CatalogUomFields, {
    catalogUomFromProduct,
    emptyCatalogUom,
} from './CatalogUomFields';
import { formatUomRule } from '../../pages/workshop/workshopUomUtils';
import { useAuth } from '../../context/AuthContext';
import { catalogDisplayName } from '../../utils/catalogDisplayName';
import '../../styles/admin/MasterCatalog.css';
import '../../styles/ui.css';
import productsCsvTemplate from '../../../Products.csv?url';
import servicesCsvTemplate from '../../../Services.csv?url';
import {
    createCategory,
    createDepartment,
    createProduct,
    createService,
    deleteCategory,
    deleteDepartment,
    deleteProduct,
    deleteService,
    getCategories,
    getDepartments,
    getProducts,
    getProduct,
    getServices,
    getDepartmentProducts,
    getDepartmentServices,
    updateCategory,
    updateDepartment,
    updateProduct,
    updateService,
    importProductsFromCsv,
    importServicesFromCsv,
    downloadProductsCsv,
    getMasterCatalogKpis,
    getDuplicates,
    ignoreDuplicate,
    deleteDuplicateItem,
    getProductRequests,
    getProductRequest,
    getProductRequestKpis,
    approveProductRequest,
    rejectProductRequest,
} from '../../services/superAdminApi';
import {
    findFirstNegativeMoneyField,
    NON_NEGATIVE_MONEY_INPUT_ATTRS,
    parseNonNegativeNumberOr,
    sanitizeNonNegativeMoneyInput,
} from '../../utils/nonNegativeMoney';
import {
    parseMasterCatalogRoute,
    masterCatalogListUrl,
    mcRoutes,
    tabForMasterCatalogScreen,
} from '../../utils/masterCatalogRoutes';
import { mcT, MC_TAB_LABEL_KEYS } from '../../utils/masterCatalogI18n';
import MasterCatalogBarcodeTab from './MasterCatalogBarcodeTab';

/* The four counts the catalog is measured by. One tone for all of them:
 * a colour per card says nothing a label does not. */
const KPI_CARD_DEFS = [
    { key: 'products',    labelKey: 'kpi.products',    icon: Box },
    { key: 'services',    labelKey: 'kpi.services',    icon: Layers },
    { key: 'departments', labelKey: 'kpi.departments', icon: LayoutGrid },
    { key: 'categories',  labelKey: 'kpi.categories',  icon: Tags },
];

/** Coerce KPI numbers — backend may return null / strings. */
const kpiNum = (v) => {
    if (v == null || v === '') return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

function buildLocalCatalogKpis({ products = [], services = [], departments = [], categories = [] } = {}) {
    const countActive = (rows) => rows.filter((row) => toBoolActive(row)).length;
    const countInactive = (rows) => rows.length - countActive(rows);
    const byType = { product: 0, service: 0, expense: 0 };
    categories.forEach((category) => {
        const key = String(category?.type || '').toLowerCase();
        if (Object.prototype.hasOwnProperty.call(byType, key)) byType[key] += 1;
    });
    return {
        products: {
            total: products.length,
            active: countActive(products),
            inactive: countInactive(products),
        },
        services: {
            total: services.length,
            active: countActive(services),
            inactive: countInactive(services),
        },
        departments: {
            total: departments.length,
            active: countActive(departments),
            inactive: countInactive(departments),
        },
        categories: {
            total: categories.length,
            byType,
        },
    };
}

/** Build the 4 summary cards from API KPIs with local-list fallback. */
function buildKpiCards(kpis, fallbackKpis, t) {
    const translate = typeof t === 'function' ? t : (key) => key;
    const k = kpis || {};
    const fallback = fallbackKpis || {};
    const products = { ...(fallback.products || {}), ...(k.products || {}) };
    const services = { ...(fallback.services || {}), ...(k.services || {}) };
    const departments = { ...(fallback.departments || {}), ...(k.departments || {}) };
    const categories = { ...(fallback.categories || {}), ...(k.categories || {}) };
    const byType = { ...((fallback.categories || {}).byType || {}), ...(categories.byType || {}) };

    return [
        {
            ...KPI_CARD_DEFS[0],
            label: translate(KPI_CARD_DEFS[0].labelKey),
            value: kpiNum(products.total),
            sub: translate('kpi.activeInactive', { active: kpiNum(products.active), inactive: kpiNum(products.inactive) }),
        },
        {
            ...KPI_CARD_DEFS[1],
            label: translate(KPI_CARD_DEFS[1].labelKey),
            value: kpiNum(services.total),
            sub: translate('kpi.activeInactive', { active: kpiNum(services.active), inactive: kpiNum(services.inactive) }),
        },
        {
            ...KPI_CARD_DEFS[2],
            label: translate(KPI_CARD_DEFS[2].labelKey),
            value: kpiNum(departments.total),
            sub: translate('kpi.activeInactive', { active: kpiNum(departments.active), inactive: kpiNum(departments.inactive) }),
        },
        {
            ...KPI_CARD_DEFS[3],
            label: translate(KPI_CARD_DEFS[3].labelKey),
            value: kpiNum(categories.total),
            sub: translate('kpi.catBreakdown', {
                product: kpiNum(byType.product),
                service: kpiNum(byType.service),
                expense: kpiNum(byType.expense),
            }),
        },
    ];
}

const MASTER_TABS = [
    { id: 'master',       label: 'Master Catalog',         icon: CheckCircle2, permission: 'inventory.master-catalog.products.view' },
    { id: 'dept',         label: 'Master Department',      icon: LayoutGrid,   permission: 'inventory.master-catalog.departments.view' },
    { id: 'category',     label: 'Master Category',        icon: Tags,         permission: 'inventory.master-catalog.categories.view' },
    { id: 'requests',     label: 'Product Requests',       icon: Layers,       permission: 'inventory.master-catalog.requests.view' },
    { id: 'duplication',  label: 'Duplication Review',     icon: Copy,         permission: 'inventory.master-catalog.duplication.view' },
    { id: 'availability', label: 'Supplier Availability',  icon: Package,      permission: 'inventory.master-catalog.availability.view' },
    { id: 'services',     label: 'Services',               icon: Layers,       permission: 'inventory.master-catalog.services.view' },
    { id: 'barcodes',     label: 'Barcode generator',      icon: Barcode,      permission: 'inventory.master-catalog.barcodes.view' },
];

const parseNumberOr = parseNonNegativeNumberOr;

function validateCatalogProductPrices(form, { includePurchase = true } = {}) {
    const fields = [
        { label: 'Sale price', value: form.salePrice },
        { label: 'Min corporate price', value: form.minCorpPrice },
        { label: 'Max corporate price', value: form.maxCorpPrice },
        { label: 'Min editable price', value: form.minPriceEditable },
    ];
    if (includePurchase) {
        fields.unshift({ label: 'Purchase price', value: form.purchasePrice });
    }
    return findFirstNegativeMoneyField(fields);
}

function validateProductPriceEditableRules(form) {
    if (!toBoolPriceEditable(form)) return null;
    const raw = form.minPriceEditable;
    if (raw === '' || raw == null) {
        return 'Minimum editable price is required when price editing is enabled';
    }
    const min = parseNumberOr(raw, NaN);
    if (!Number.isFinite(min) || min < 0) {
        return 'Minimum editable price must be zero or greater';
    }
    return null;
}

function validateCatalogServicePrices(form) {
    return findFirstNegativeMoneyField([
        { label: 'Selling price', value: form.sellingPrice },
        { label: 'Service cost', value: form.serviceCost },
        { label: 'Min corporate price', value: form.minPriceCorporate },
        { label: 'Max corporate price', value: form.maxPriceCorporate },
    ]);
}

const toBoolPriceEditable = (obj) => {
    if (!obj || typeof obj !== 'object') return false;
    const raw = obj.isPriceEditable ?? obj.is_price_editable;
    if (raw === true || raw === 1) return true;
    if (raw === false || raw === 0) return false;
    if (typeof raw === 'string') {
        const s = raw.trim().toLowerCase();
        return s === 'true' || s === '1' || s === 'yes';
    }
    return false;
};

const catalogItemId = (item) =>
    item?.id != null ? String(item.id) : '';

const catalogIdsMatch = (a, b) => catalogItemId(a) !== '' && catalogItemId(a) === catalogItemId(b);

const toBoolActive = (obj) => {
    if (!obj || typeof obj !== 'object') return true;
    const raw = obj.isActive ?? obj.is_active;
    if (raw === true || raw === 1) return true;
    if (raw === false || raw === 0) return false;
    if (typeof raw === 'string') {
        const s = raw.trim().toLowerCase();
        if (s === 'true' || s === '1' || s === 'yes') return true;
        if (s === 'false' || s === '0' || s === 'no') return false;
    }
    return true;
};

/**
 * Super-admin product list and GET-by-id responses expose `allowDecimalQty` in camelCase JSON
 * (Nest DTOs). Prisma @map("allow_decimal_qty") only affects the DB column, not the HTTP body.
 */
const toBoolAllowDecimal = (obj) => {
    if (!obj || typeof obj !== 'object') return false;
    const raw = obj.allowDecimalQty ?? obj.allow_decimal_qty;
    if (raw === true || raw === 1) return true;
    if (raw === false || raw === 0) return false;
    if (typeof raw === 'string') {
        const s = raw.trim().toLowerCase();
        return s === 'true' || s === '1' || s === 'yes';
    }
    return false;
};

const toBoolAllowMinus = (obj) => {
    if (!obj || typeof obj !== 'object') return false;
    const raw = obj.allowMinusQty ?? obj.allow_minus_qty;
    if (raw === true || raw === 1) return true;
    if (raw === false || raw === 0) return false;
    if (typeof raw === 'string') {
        const s = raw.trim().toLowerCase();
        return s === 'true' || s === '1' || s === 'yes';
    }
    return false;
};

/** Service qty toggle: ON when serviceQty is a positive number (typically 1); OFF when null. */
const toBoolServiceQty = (obj) => {
    if (!obj || typeof obj !== 'object') return false;
    const raw = obj.serviceQty ?? obj.service_qty;
    if (raw === true || raw === 1) return true;
    if (raw === false || raw === 0 || raw == null || raw === '') return false;
    if (typeof raw === 'string') {
        const s = raw.trim().toLowerCase();
        if (s === 'true' || s === 'yes') return true;
        if (s === 'false' || s === 'no' || s === 'null') return false;
    }
    const n = Number(raw);
    return Number.isFinite(n) && n > 0;
};

/** ISO-8601 from catalog APIs → short local display; empty string if missing/invalid. */
const formatCatalogCreatedAt = (iso) => {
    if (iso == null || iso === '') return '';
    const d = new Date(typeof iso === 'string' || typeof iso === 'number' ? iso : String(iso));
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

/** For sorting: newest first. Invalid / missing dates sort last. */
const catalogCreatedAtSortMs = (iso) => {
    if (iso == null || iso === '') return 0;
    const t = new Date(typeof iso === 'string' || typeof iso === 'number' ? iso : String(iso)).getTime();
    return Number.isFinite(t) ? t : 0;
};

const PRODUCT_CSV_COLUMNS = [
    'id',
    'department_id',
    'department_name',
    'category_id',
    'category_name',
    'name',
    'arabic_name',
    'sku',
    'brand_name',
    'description',
    'unit',
    'warehouse_unit',
    'workshop_unit',
    'conversion_factor',
    'purchase_price',
    'sale_price',
    'sale_price_before_vat',
    'km_type_value',
    'allow_decimal_qty',
    'allow_minus_qty',
    'is_active',
    'min_price_corporate',
    'max_price_corporate',
    'is_price_editable',
    'min_price_editable',
];

/** Must match `Services.csv` header and backend `SERVICE_CSV_CANONICAL_HEADERS` (order + spelling). */
const SERVICE_CSV_COLUMNS = [
    'Service',
    'Arabic Name',
    'SKU',
    'Description',
    'Department',
    'Category',
    'UOM',
    'Service Cost',
    'Sale Price Inclusive VAT 15%',
    'Sale Price Enclusive VAT 15%',
    'Allow Price Change',
    'Min Corporate Price',
    'Max Corporate price',
    'Department ID',
    'Category ID',
];

/** ProductCsvImportResponseDto — top-level JSON or nested under `data`. */
function getCsvImportPayload(result) {
    if (!result || typeof result !== 'object') return null;
    return result.data && typeof result.data === 'object' ? result.data : result;
}

function formatCsvImportSummary(result, t) {
    const p = getCsvImportPayload(result);
    if (!p) return '';
    const translate = typeof t === 'function' ? t : (key, vars) => mcT('en', key, vars);
    const parts = [];
    if (typeof p.created === 'number') parts.push(translate('bulk.created', { n: p.created }));
    if (typeof p.skippedDuplicate === 'number')
        parts.push(translate('bulk.skippedSku', { n: p.skippedDuplicate }));
    if (typeof p.failed === 'number') parts.push(translate('bulk.failed', { n: p.failed }));
    if (typeof p.vatWarningsCount === 'number')
        parts.push(translate('bulk.vatRows', { n: p.vatWarningsCount }));
    return parts.join(' · ');
}

function isProductCsvImportShape(p) {
    return (
        p &&
        typeof p === 'object' &&
        (typeof p.created === 'number' ||
            typeof p.skippedDuplicate === 'number' ||
            typeof p.failed === 'number' ||
            typeof p.vatWarningsCount === 'number')
    );
}

function formatRowDetailItem(d) {
    if (d == null) return '';
    if (typeof d === 'string') return d;
    if (typeof d !== 'object') return String(d);
    const bits = [`Row ${d.rowNumber ?? '?'}`];
    if (d.outcome) bits.push(String(d.outcome).replace(/_/g, ' '));
    if (d.sku) bits.push(`SKU ${d.sku}`);
    if (d.message) bits.push(d.message);
    if (d.productId != null && d.productId !== '') bits.push(`productId ${d.productId}`);
    return bits.join(' — ');
}

function formatVatWarningItem(w) {
    if (w == null) return '';
    if (typeof w === 'string') return w;
    if (typeof w !== 'object') return String(w);
    return `Row ${w.rowNumber ?? '?'}: ${w.message || ''}`.trim();
}

export default function MasterCatalog() {
    const { hasPermission } = useAuth();
    const outletCtx = useOutletContext() || {};
    const locale =
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const displayName = useCallback((item) => catalogDisplayName(item, locale), [locale]);
    const t = useCallback((key, vars) => mcT(locale, key, vars), [locale]);
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const route = parseMasterCatalogRoute(location.pathname);
    const pageMode = Boolean(route);

    const goBack = useCallback(() => {
        const tab = tabForMasterCatalogScreen(route?.screen);
        navigate(masterCatalogListUrl(tab));
    }, [navigate, route?.screen]);

    const visibleMasterTabs = MASTER_TABS.filter((tab) => hasPermission(tab.permission));
    const [activeTab, setActiveTab] = useState(() => {
        const tabParam = typeof window !== 'undefined'
            ? new URLSearchParams(window.location.search).get('tab')
            : null;
        if (tabParam && MASTER_TABS.some((tab) => tab.id === tabParam)) return tabParam;
        return visibleMasterTabs[0]?.id ?? 'master';
    });

    // If the current activeTab is no longer visible (perms changed mid-session), snap to first allowed.
    useEffect(() => {
        if (visibleMasterTabs.length === 0) return;
        if (!visibleMasterTabs.some((tab) => tab.id === activeTab)) {
            setActiveTab(visibleMasterTabs[0].id);
        }
    }, [visibleMasterTabs, activeTab]);

    const [statusFilter, setStatusFilter] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [editingProduct, setEditingProduct] = useState(null);
    const [editingDept, setEditingDept] = useState(null);
    const [editingCat, setEditingCat] = useState(null);
    const [products, setProducts] = useState([]);
    const [services, setServices] = useState([]);
    const [departmentProducts, setDepartmentProducts] = useState([]);
    const [departmentServices, setDepartmentServices] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [categories, setCategories] = useState([]);
    const [kpis, setKpis] = useState(null);
    const [kpisLoading, setKpisLoading] = useState(true);
    const [kpisError, setKpisError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [selectedBulkFile, setSelectedBulkFile] = useState(null);
    const [bulkImporting, setBulkImporting] = useState(false);
    const [bulkImportResult, setBulkImportResult] = useState(null);
    const bulkFileInputRef = useRef(null);
    /** Sync guard: React state can lag one frame, so double-clicks could otherwise fire two imports. */
    const bulkImportInFlightRef = useRef(false);
    const bulkServiceFileInputRef = useRef(null);
    const bulkServiceImportInFlightRef = useRef(false);
    const [selectedBulkServiceFile, setSelectedBulkServiceFile] = useState(null);
    const [bulkServiceImporting, setBulkServiceImporting] = useState(false);
    const [bulkServiceImportResult, setBulkServiceImportResult] = useState(null);
    const [productsExporting, setProductsExporting] = useState(false);
    const [serviceToggleBusyKey, setServiceToggleBusyKey] = useState('');
    const [productToggleBusyKey, setProductToggleBusyKey] = useState('');

    // ── Duplication Review ────────────────────────────────────────
    const [dupGroups, setDupGroups] = useState([]);
    const [dupLoading, setDupLoading] = useState(false);
    const [dupError, setDupError] = useState(null);
    const [dupEntityFilter, setDupEntityFilter] = useState('');
    const [expandedDupKey, setExpandedDupKey] = useState(null);

    // ── Product Requests ──────────────────────────────────────────
    const [productRequests, setProductRequests] = useState([]);
    const [prKpis, setPrKpis] = useState(null);
    const [prTab, setPrTab] = useState('Pending');
    const [prLoading, setPrLoading] = useState(false);
    const [prError, setPrError] = useState(null);
    const [prApproveTarget, setPrApproveTarget] = useState(null);
    const [prRejectTarget, setPrRejectTarget] = useState(null);
    const [prRemarks, setPrRemarks] = useState('');
    const [prApproveForm, setPrApproveForm] = useState({
        name: '',
        sku: '',
        brandName: '',
        description: '',
        arabicName: '',
        unit: 'pcs',
        expectedPrice: '',
        departmentId: '',
        categoryId: '',
    });
    const [prRejectReason, setPrRejectReason] = useState('');
    const [prActionBusy, setPrActionBusy] = useState(false);
    /** Services tab status chips (separate from master product `statusFilter`). */
    const [serviceStatusFilter, setServiceStatusFilter] = useState('All');
    const [selectedProductDepartment, setSelectedProductDepartment] = useState('');
    const [selectedServiceDepartment, setSelectedServiceDepartment] = useState('');

    const [toast, setToast] = useState(null);
    const showToast = (message, kind = 'success') => {
        setToast({ message, kind, id: Date.now() });
        setTimeout(() => setToast((prev) => (prev && prev.message === message ? null : prev)), 3500);
    };

    const [newProduct, setNewProduct] = useState({
        name: '',
        arabicName: '',
        sku: '',
        departmentId: '',
        categoryId: '',
        brand: '',
        ...emptyCatalogUom(),
        type: 'Product',
        salePrice: '',
        purchasePrice: '',
        description: '',
        barcode: '',
        imageUrl: '',
        conversionRules: [],
        kmTypeValue: '',
        isPriceEditable: false,
        minPriceEditable: '',
        allowDecimalQty: false,
        allowMinusQty: false,
    });

    const [newDept, setNewDept] = useState({ name: '' });
    const [newCat, setNewCat] = useState({ type: 'product', name: '', departmentId: '' });
    const [newService, setNewService] = useState({
        name: '',
        arabicName: '',
        sku: '',
        description: '',
        unitOfMeasurement: 'ea',
        sellingPrice: '',
        serviceCost: '0',
        isPriceEditable: true,
        serviceQtyEnabled: false,
        minPriceCorporate: '',
        maxPriceCorporate: '',
        departmentId: '',
        categoryId: '',
    });
    const [editingService, setEditingService] = useState(null);
    const productCategories = categories.filter((c) => c.type === 'product' || !c.type);
    const serviceCategories = categories.filter((c) => c.type === 'service' || !c.type);
    const selectedProductCategories = productCategories.filter((c) => String(c.departmentId) === String(newProduct.departmentId));
    const selectedServiceCategories = serviceCategories.filter((c) => String(c.departmentId) === String(newService.departmentId));
    const approveProductCategories = productCategories.filter(
        (c) => String(c.departmentId) === String(prApproveForm.departmentId),
    );
    const editModalProductCategories = editingProduct
        ? productCategories.filter(
              (c) =>
                  !editingProduct.departmentId ||
                  String(c.departmentId) === String(editingProduct.departmentId),
          )
        : [];
    const productMatchesFilters = (p) => {
        const kmStr =
            p.kmTypeValue != null && p.kmTypeValue !== ''
                ? String(p.kmTypeValue)
                : '';
        const matchesSearch =
            !searchQuery ||
            [p.name, p.arabicName, p.sku, p.brandName, kmStr].some((v) =>
                (v || '').toLowerCase().includes(searchQuery.toLowerCase()),
            );
        const status = toBoolActive(p) ? 'Approved' : 'Rejected';
        const matchesStatus = statusFilter === 'All' || statusFilter === status;
        return matchesSearch && matchesStatus;
    };
    const serviceMatchesFilters = (s) => {
        const active = toBoolActive(s);
        const matchesSvcStatus =
            serviceStatusFilter === 'All' || serviceStatusFilter === 'Pending'
                ? true
                : serviceStatusFilter === 'Rejected'
                  ? !active
                  : active;
        if (!matchesSvcStatus) return false;
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        const createdFmt = formatCatalogCreatedAt(s.createdAt ?? s.created_at).toLowerCase();
        const createdRaw = String(s.createdAt ?? s.created_at ?? '').toLowerCase();
        const vatStr = String(s.vatMode ?? s.vat_mode ?? '').toLowerCase();
        const catIdStr = s.categoryId != null ? String(s.categoryId).toLowerCase() : '';
        return [s.name, s.arabicName, s.sku, s.categoryName, vatStr, catIdStr, createdFmt, createdRaw].some((v) =>
            (v || '').includes(q),
        );
    };
    const groupedFilteredProducts = departmentProducts
        .map((dept) => ({
            ...dept,
            products: (Array.isArray(dept.products) ? dept.products : []).filter(productMatchesFilters),
        }))
        .filter((dept) => dept.products.length > 0);
    const groupedFilteredServices = departmentServices
        .map((dept) => ({
            ...dept,
            services: (Array.isArray(dept.services) ? dept.services : [])
                .filter(serviceMatchesFilters)
                .sort((a, b) => {
                    const ta = catalogCreatedAtSortMs(a.createdAt ?? a.created_at);
                    const tb = catalogCreatedAtSortMs(b.createdAt ?? b.created_at);
                    const aMissing = !(ta > 0);
                    const bMissing = !(tb > 0);
                    if (aMissing && bMissing) return 0;
                    if (aMissing) return 1;
                    if (bMissing) return -1;
                    return tb - ta;
                }),
        }))
        .filter((dept) => dept.services.length > 0);
    const productDepartmentOptions = departmentProducts.map((dept) => ({
        id: String(dept.departmentId ?? ''),
        name: dept.departmentName || `Department ${dept.departmentId}`,
    }));
    const serviceDepartmentOptions = departmentServices.map((dept) => ({
        id: String(dept.departmentId ?? ''),
        name: dept.departmentName || `Department ${dept.departmentId}`,
    }));
    const displayedProducts = selectedProductDepartment
        ? (groupedFilteredProducts.find((d) => String(d.departmentId) === selectedProductDepartment)?.products ?? [])
        : groupedFilteredProducts.flatMap((d) => d.products);
    const displayedServices = selectedServiceDepartment
        ? (groupedFilteredServices.find((d) => String(d.departmentId) === selectedServiceDepartment)?.services ?? [])
        : groupedFilteredServices.flatMap((d) => d.services);
    const _q = searchQuery.trim().toLowerCase();
    const filteredDepartments = !_q
        ? departments
        : departments.filter((d) => (d.name || '').toLowerCase().includes(_q));
    const filteredCategories = !_q
        ? categories
        : categories.filter((c) => {
            const deptName = departments.find((d) => String(d.id) === String(c.departmentId))?.name || '';
            return [c.name, c.type, deptName].some((v) => (v || '').toLowerCase().includes(_q));
        });
    const filteredAvailability = !_q
        ? products
        : products.filter((p) => {
              const kmStr =
                  p.kmTypeValue != null && p.kmTypeValue !== ''
                      ? String(p.kmTypeValue)
                      : '';
              return [p.name, p.sku, p.brandName, p.categoryName, p.unit, kmStr].some((v) =>
                  (v || '').toLowerCase().includes(_q),
              );
          });
    const categoriesPaging = usePagedRows(filteredCategories, { resetKey: _q });
    const availabilityPaging = usePagedRows(filteredAvailability, { resetKey: _q });
    const fallbackKpis = buildLocalCatalogKpis({
        products,
        services,
        departments,
        categories,
    });
    const isDepartmentFormValid = !!newDept.name.trim();
    const isCategoryFormValid = !!newCat.name.trim() && !!newCat.departmentId;
    const isProductFormValid = !!newProduct.name.trim() && !!newProduct.departmentId && !!newProduct.categoryId;
    const isServiceFormValid = !!newService.name.trim() && !!newService.departmentId && !!newService.categoryId;

    const loadCatalog = async () => {
        setLoading(true);
        try {
            const [
                productsRes,
                servicesRes,
                departmentsRes,
                categoriesRes,
                departmentProductsRes,
                departmentServicesRes,
            ] = await Promise.all([
                getProducts().catch(() => ({ products: [] })),
                getServices().catch(() => ({ services: [] })),
                getDepartments().catch(() => ({ departments: [] })),
                getCategories().catch(() => ({ categories: [] })),
                getDepartmentProducts().catch(() => ({ departments: [] })),
                getDepartmentServices().catch(() => ({ departments: [] })),
            ]);
            const productsData = Array.isArray(productsRes) ? productsRes : (productsRes?.products ?? []);
            const servicesData = Array.isArray(servicesRes) ? servicesRes : (servicesRes?.services ?? []);
            const departmentsData = Array.isArray(departmentsRes) ? departmentsRes : (departmentsRes?.departments ?? []);
            const categoriesData = Array.isArray(categoriesRes) ? categoriesRes : (categoriesRes?.categories ?? []);
            setProducts(productsData);
            setServices(servicesData);
            setDepartments(departmentsData);
            setCategories(categoriesData);
            setDepartmentProducts(
                Array.isArray(departmentProductsRes?.departments) ? departmentProductsRes.departments : [],
            );
            setDepartmentServices(
                Array.isArray(departmentServicesRes?.departments) ? departmentServicesRes.departments : [],
            );
        } finally {
            setLoading(false);
        }
    };

    const loadKpis = async ({ silent = false } = {}) => {
        if (!silent) setKpisLoading(true);
        setKpisError(null);
        try {
            const res = await getMasterCatalogKpis();
            // Backend may wrap in `{ data: {...} }` or return flat — handle both.
            setKpis(res?.data && typeof res.data === 'object' ? res.data : res);
        } catch (e) {
            setKpisError(e?.message || 'Failed to load KPIs');
        } finally {
            if (!silent) setKpisLoading(false);
        }
    };

    /**
     * Refresh lists + KPIs together. KPIs refresh silently to avoid the
     * cards flickering to "—" between every CRUD action.
     */
    const refreshCatalog = async () => {
        await Promise.all([loadCatalog(), loadKpis({ silent: true })]);
    };

    // ── Duplication Review loaders ────────────────────────────────
    const loadDuplicates = async () => {
        setDupLoading(true);
        setDupError(null);
        try {
            const res = await getDuplicates({ entityType: dupEntityFilter || undefined });
            const groups = Array.isArray(res?.groups) ? res.groups : [];
            setDupGroups(groups);
        } catch (e) {
            setDupError(e?.message || 'Failed to load duplicates');
            setDupGroups([]);
        } finally {
            setDupLoading(false);
        }
    };

    const handleIgnoreDuplicate = async (group) => {
        if (!window.confirm(`Mark "${group.displayName || group.nameKey}" group as not a duplicate?`)) return;
        try {
            await ignoreDuplicate({ entityType: group.entityType, nameKey: group.nameKey });
            showToast('Group dismissed', 'success');
            await loadDuplicates();
        } catch (e) {
            showToast(e?.message || 'Failed to dismiss group', 'error');
        }
    };

    const handleDeleteDuplicateItem = async (entityType, item) => {
        if (!window.confirm(`Delete this ${entityType} "${displayName(item) || item.name}"? This cannot be undone.`)) return;
        try {
            await deleteDuplicateItem(entityType, item.id);
            showToast('Item deleted', 'success');
            await Promise.all([loadDuplicates(), refreshCatalog()]);
        } catch (e) {
            showToast(e?.message || 'Delete failed', 'error');
        }
    };

    // ── Product Request loaders ───────────────────────────────────
    const loadProductRequests = async () => {
        setPrLoading(true);
        setPrError(null);
        try {
            const status = prTab === 'All' ? undefined : prTab.toLowerCase();
            const [listRes, kpisRes] = await Promise.all([
                getProductRequests({ status }),
                getProductRequestKpis().catch(() => null),
            ]);
            const items = Array.isArray(listRes?.items)
                ? listRes.items
                : Array.isArray(listRes)
                    ? listRes
                    : [];
            setProductRequests(items);
            if (kpisRes) setPrKpis(kpisRes?.data && typeof kpisRes.data === 'object' ? kpisRes.data : kpisRes);
        } catch (e) {
            setPrError(e?.message || 'Failed to load product requests');
            setProductRequests([]);
        } finally {
            setPrLoading(false);
        }
    };

    const handlePrApproveConfirm = async () => {
        if (!prApproveTarget) return;
        if (!prApproveForm.name?.trim()) {
            showToast('Product name is required', 'error');
            return;
        }
        if (!prApproveForm.departmentId) {
            showToast('Department is required', 'error');
            return;
        }
        const prPriceErr = findFirstNegativeMoneyField([
            { label: 'Expected price', value: prApproveForm.expectedPrice },
        ]);
        if (prPriceErr) {
            showToast(`${prPriceErr} cannot be negative.`, 'error');
            return;
        }
        setPrActionBusy(true);
        try {
            const payload = {
                remarks: prRemarks?.trim() || undefined,
                name: prApproveForm.name.trim(),
                sku: prApproveForm.sku?.trim() || undefined,
                brandName: prApproveForm.brandName?.trim() || undefined,
                description: prApproveForm.description?.trim() || undefined,
                arabicName: prApproveForm.arabicName?.trim() || undefined,
                unit: prApproveForm.unit?.trim() || 'pcs',
                expectedPrice:
                    prApproveForm.expectedPrice === '' ? undefined : Number(prApproveForm.expectedPrice),
                departmentId: prApproveForm.departmentId,
                categoryId: prApproveForm.categoryId || null,
            };
            await approveProductRequest(prApproveTarget.id, payload);
            showToast('Request approved', 'success');
            goBack();
            setPrRemarks('');
            setPrApproveForm({
                name: '',
                sku: '',
                brandName: '',
                description: '',
                arabicName: '',
                unit: 'pcs',
                expectedPrice: '',
                departmentId: '',
                categoryId: '',
            });
            await loadProductRequests();
            await Promise.all([loadCatalog(), loadKpis({ silent: true })]);
        } catch (e) {
            showToast(e?.message || 'Approve failed', 'error');
        } finally {
            setPrActionBusy(false);
        }
    };

    const handlePrRejectConfirm = async () => {
        if (!prRejectTarget) return;
        const reason = prRejectReason?.trim();
        if (!reason) {
            showToast('Reason is required', 'error');
            return;
        }
        setPrActionBusy(true);
        try {
            await rejectProductRequest(prRejectTarget.id, reason);
            showToast('Request rejected', 'success');
            goBack();
            setPrRejectReason('');
            await loadProductRequests();
        } catch (e) {
            showToast(e?.message || 'Reject failed', 'error');
        } finally {
            setPrActionBusy(false);
        }
    };

    useEffect(() => {
        loadCatalog();
        loadKpis();
    }, []);

    useEffect(() => {
        if (activeTab === 'duplication') loadDuplicates();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, dupEntityFilter]);

    useEffect(() => {
        if (activeTab === 'requests') loadProductRequests();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, prTab]);

    useEffect(() => {
        if (pageMode) return;
        const tab = searchParams.get('tab');
        if (tab && visibleMasterTabs.some((mt) => mt.id === tab) && tab !== activeTab) {
            setActiveTab(tab);
        }
    }, [pageMode, searchParams, visibleMasterTabs, activeTab]);

    const buildEditingProductState = (product) => {
        if (!product?.id) return null;
        let departmentId =
            product.departmentId != null && product.departmentId !== ''
                ? String(product.departmentId)
                : product.department_id != null && product.department_id !== ''
                  ? String(product.department_id)
                  : '';
        let categoryId =
            product.categoryId != null && product.categoryId !== ''
                ? String(product.categoryId)
                : product.category_id != null && product.category_id !== ''
                  ? String(product.category_id)
                  : '';
        if (!departmentId && categoryId) {
            const byCat = productCategories.find((c) => String(c.id) === String(categoryId));
            if (byCat?.departmentId != null) departmentId = String(byCat.departmentId);
        }
        if (!categoryId) {
            const name = product.categoryName ?? product.category;
            if (name) {
                const candidates = productCategories.filter(
                    (c) =>
                        String(c.name || '').trim() === String(name).trim() &&
                        (!departmentId || String(c.departmentId) === String(departmentId)),
                );
                if (candidates.length === 1) categoryId = String(candidates[0].id);
                else if (candidates.length > 1 && departmentId) {
                    const exact = candidates.find((c) => String(c.departmentId) === String(departmentId));
                    if (exact) categoryId = String(exact.id);
                }
            }
        }
        return {
            ...product,
            departmentId,
            categoryId,
            arabicName: product.arabicName ?? product.arabic_name ?? '',
            salePrice: product.salePrice ?? '',
            purchasePrice: product.purchasePrice ?? '',
            brand: product.brandName ?? product.brand ?? '',
            minCorpPrice:
                product.minCorpPrice ??
                product.minPriceCorporate ??
                product.min_price_corporate ??
                '',
            maxCorpPrice:
                product.maxCorpPrice ??
                product.maxPriceCorporate ??
                product.max_price_corporate ??
                '',
            allowDecimalQty: toBoolAllowDecimal(product),
            allowMinusQty: toBoolAllowMinus(product),
            ...catalogUomFromProduct(product),
            conversionRules: [],
            kmTypeValue:
                product.kmTypeValue != null && product.kmTypeValue !== ''
                    ? String(product.kmTypeValue)
                    : '',
            isPriceEditable: toBoolPriceEditable(product),
            isActive: toBoolActive(product),
            minPriceEditable:
                product.minPriceEditable == null && product.min_price_editable == null
                    ? ''
                    : String(product.minPriceEditable ?? product.min_price_editable),
        };
    };

    const buildEditingServiceState = (service) => ({
        id: service.id,
        name: service.name || '',
        arabicName: service.arabicName ?? service.arabic_name ?? '',
        sku: service.sku || '',
        description: service.description || '',
        sellingPrice: service.sellingPrice == null ? '' : String(service.sellingPrice),
        serviceCost:
            service.serviceCost == null && service.service_cost == null
                ? '0'
                : String(service.serviceCost ?? service.service_cost ?? 0),
        isPriceEditable: toBoolPriceEditable(service),
        serviceQtyEnabled: toBoolServiceQty(service),
        minPriceCorporate:
            service.minPriceCorporate == null && service.min_price_corporate == null
                ? ''
                : String(service.minPriceCorporate ?? service.min_price_corporate),
        maxPriceCorporate:
            service.maxPriceCorporate == null && service.max_price_corporate == null
                ? ''
                : String(service.maxPriceCorporate ?? service.max_price_corporate),
        isActive: service.isActive !== false,
        categoryId: service.categoryId != null ? String(service.categoryId) : '',
        categoryName: service.categoryName ?? service.category?.name ?? '',
        vatMode: service.vatMode ?? service.vat_mode ?? '',
        createdAt: service.createdAt ?? service.created_at ?? '',
    });

    const populatePrApproveForm = (r) => {
        if (!r?.id) return;
        setPrApproveTarget(r);
        setPrRemarks('');
        setPrApproveForm({
            name: r?.name || '',
            sku: r?.sku || '',
            brandName: r?.brandName || '',
            description: r?.description || '',
            arabicName: r?.arabicName || '',
            unit: r?.unit || 'pcs',
            expectedPrice:
                r?.expectedPrice === null || r?.expectedPrice === undefined
                    ? ''
                    : String(r.expectedPrice),
            departmentId: r?.departmentId ? String(r.departmentId) : '',
            categoryId: r?.categoryId ? String(r.categoryId) : '',
        });
    };

    const openPrApprove = (r) => {
        populatePrApproveForm(r);
        navigate(mcRoutes.requestApprove(r.id), { state: { request: r } });
    };

    const populatePrRejectForm = (r) => {
        if (!r?.id) return;
        setPrRejectTarget(r);
        setPrRejectReason('');
    };

    const openPrReject = (r) => {
        populatePrRejectForm(r);
        navigate(mcRoutes.requestReject(r.id), { state: { request: r } });
    };

    useEffect(() => {
        if (route?.screen !== 'product-edit' || !route.id) return;
        if (editingProduct && String(editingProduct.id) === route.id) return;
        const fromState = location.state?.product;
        if (fromState) {
            const next = buildEditingProductState(fromState);
            if (next) setEditingProduct(next);
            return;
        }
        const fromList = products.find((p) => String(p.id) === route.id);
        if (fromList) {
            setEditingProduct(buildEditingProductState(fromList));
            return;
        }
        let cancelled = false;
        getProduct(route.id)
            .then((res) => {
                const p = res?.data ?? res;
                if (!cancelled && p?.id) setEditingProduct(buildEditingProductState(p));
            })
            .catch(() => showToast('Product not found', 'error'));
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [route?.screen, route?.id, location.state]);

    useEffect(() => {
        if (route?.screen !== 'service-edit' || !route.id) return;
        if (editingService && String(editingService.id) === route.id) return;
        const fromState = location.state?.service;
        if (fromState) {
            setEditingService(buildEditingServiceState(fromState));
            return;
        }
        const fromList = services.find((s) => String(s.id) === route.id);
        if (fromList) {
            setEditingService(buildEditingServiceState(fromList));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [route?.screen, route?.id, location.state, services]);

    useEffect(() => {
        if (route?.screen !== 'dept-edit' || !route.id) return;
        if (editingDept && String(editingDept.id) === route.id) return;
        const fromState = location.state?.department;
        if (fromState) {
            setEditingDept(fromState);
            return;
        }
        const fromList = departments.find((d) => String(d.id) === route.id);
        if (fromList) setEditingDept(fromList);
    }, [route?.screen, route?.id, location.state, departments, editingDept]);

    useEffect(() => {
        if (route?.screen !== 'cat-edit' || !route.id) return;
        if (editingCat && String(editingCat.id) === route.id) return;
        const fromState = location.state?.category;
        if (fromState) {
            setEditingCat({ ...fromState, departmentId: fromState.departmentId, type: fromState.type || 'product' });
            return;
        }
        const fromList = categories.find((c) => String(c.id) === route.id);
        if (fromList) {
            setEditingCat({ ...fromList, departmentId: fromList.departmentId, type: fromList.type || 'product' });
        }
    }, [route?.screen, route?.id, location.state, categories, editingCat]);

    useEffect(() => {
        if (route?.screen !== 'request-approve' || !route.id) return;
        if (prApproveTarget && String(prApproveTarget.id) === route.id) return;
        const fromState = location.state?.request;
        const fromList = productRequests.find((r) => String(r.id) === route.id);
        const r = fromState || fromList;
        if (r) {
            populatePrApproveForm(r);
            return;
        }
        let cancelled = false;
        getProductRequest(route.id)
            .then((res) => {
                const req = res?.data ?? res;
                if (!cancelled && req?.id) populatePrApproveForm(req);
            })
            .catch(() => showToast('Request not found', 'error'));
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [route?.screen, route?.id, location.state, productRequests]);

    useEffect(() => {
        if (route?.screen !== 'request-reject' || !route.id) return;
        if (prRejectTarget && String(prRejectTarget.id) === route.id) return;
        const fromState = location.state?.request;
        const fromList = productRequests.find((r) => String(r.id) === route.id);
        const r = fromState || fromList;
        if (r) {
            populatePrRejectForm(r);
            return;
        }
        let cancelled = false;
        getProductRequest(route.id)
            .then((res) => {
                const req = res?.data ?? res;
                if (!cancelled && req?.id) populatePrRejectForm(req);
            })
            .catch(() => showToast('Request not found', 'error'));
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [route?.screen, route?.id, location.state, productRequests]);

    const handleEditClick = (product) => {
        if (!product?.id) return;
        const next = buildEditingProductState(product);
        if (!next) return;
        setEditingProduct(next);
        navigate(mcRoutes.productEdit(product.id), { state: { product } });
    };

    const handleCreateProduct = async () => {
        const priceErr = validateCatalogProductPrices(newProduct);
        if (priceErr) {
            alert(`${priceErr} cannot be negative.`);
            return;
        }
        const editableErr = validateProductPriceEditableRules(newProduct);
        if (editableErr) {
            alert(editableErr);
            return;
        }
        setSaving(true);
        try {
            const kmRaw = newProduct.kmTypeValue;
            const kmTrimmed =
                kmRaw === '' || kmRaw == null ? '' : String(kmRaw).trim();
            const kmParsed = kmTrimmed === '' ? NaN : Number(kmTrimmed);
            const kmPayload =
                kmTrimmed !== '' && Number.isFinite(kmParsed) ? { kmTypeValue: kmParsed } : {};

            await createProduct({
                departmentId: newProduct.departmentId || undefined,
                categoryId: newProduct.categoryId || undefined,
                name: newProduct.name,
                arabicName: newProduct.arabicName?.trim() || undefined,
                sku: newProduct.sku || undefined,
                brandName: newProduct.brand || undefined,
                description: newProduct.description || undefined,
                warehouseUnit: newProduct.warehouseUnit || 'pcs',
                workshopUnit: newProduct.workshopUnit || 'pcs',
                conversionFactor: Math.max(
                    0.0001,
                    Number(newProduct.conversionFactor) || 1,
                ),
                purchasePrice: parseNumberOr(newProduct.purchasePrice, 0),
                salePrice: parseNumberOr(newProduct.salePrice, 0),
                allowDecimalQty: !!newProduct.allowDecimalQty,
                allowMinusQty: !!newProduct.allowMinusQty,
                minPriceCorporate: parseNumberOr(newProduct.minCorpPrice, 0),
                maxPriceCorporate: parseNumberOr(newProduct.maxCorpPrice, 0),
                isPriceEditable: !!newProduct.isPriceEditable,
                minPriceEditable:
                    newProduct.isPriceEditable && newProduct.minPriceEditable !== ''
                        ? parseNumberOr(newProduct.minPriceEditable, 0)
                        : null,
                ...kmPayload,
            });
            goBack();
            setNewProduct({
                name: '',
                arabicName: '',
                sku: '',
                departmentId: '',
                categoryId: '',
                brand: '',
                ...emptyCatalogUom(),
                type: 'Product',
                salePrice: '',
                purchasePrice: '',
                description: '',
                barcode: '',
                imageUrl: '',
                conversionRules: [],
                kmTypeValue: '',
                isPriceEditable: false,
                minPriceEditable: '',
                allowDecimalQty: false,
                allowMinusQty: false,
            });
            await refreshCatalog();
        } catch (e) {
            alert(e.message || 'Failed to create product');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateCatalogProduct = async () => {
        if (!editingProduct?.id) return;
        if (!String(editingProduct.categoryId || '').trim()) {
            alert('Please select a category.');
            return;
        }
        const priceErr = validateCatalogProductPrices(editingProduct);
        if (priceErr) {
            alert(`${priceErr} cannot be negative.`);
            return;
        }
        const editableErr = validateProductPriceEditableRules(editingProduct);
        if (editableErr) {
            alert(editableErr);
            return;
        }
        setSaving(true);
        try {
            // PATCH /super-admin/products/:id — never send departmentId (not supported; department fixed after create).
            // Send categoryId so category changes persist. 200 returns a flat product (same fields as list/get).
            const kmRaw = editingProduct.kmTypeValue;
            const kmTrimmed =
                kmRaw === '' || kmRaw == null ? '' : String(kmRaw).trim();
            const kmParsed = kmTrimmed === '' ? null : Number(kmTrimmed);
            const kmTypeValue =
                kmTrimmed === '' || !Number.isFinite(kmParsed) ? null : kmParsed;

            await updateProduct(editingProduct.id, {
                name: editingProduct.name?.trim() || undefined,
                arabicName: editingProduct.arabicName?.trim() || undefined,
                sku: editingProduct.sku?.trim() || undefined,
                brandName: editingProduct.brand?.trim() || undefined,
                categoryId: String(editingProduct.categoryId).trim(),
                description: editingProduct.description?.trim() || undefined,
                warehouseUnit: editingProduct.warehouseUnit || undefined,
                workshopUnit: editingProduct.workshopUnit || undefined,
                conversionFactor:
                    editingProduct.conversionFactor != null &&
                    String(editingProduct.conversionFactor).trim() !== ''
                        ? Math.max(
                              0.0001,
                              Number(editingProduct.conversionFactor) || 1,
                          )
                        : undefined,
                purchasePrice:
                    editingProduct.purchasePrice === '' || editingProduct.purchasePrice == null
                        ? undefined
                        : parseNumberOr(editingProduct.purchasePrice, 0),
                salePrice: editingProduct.salePrice === '' ? null : parseNumberOr(editingProduct.salePrice, 0),
                minPriceCorporate:
                    editingProduct.minCorpPrice === '' || editingProduct.minCorpPrice == null
                        ? undefined
                        : parseNumberOr(editingProduct.minCorpPrice, 0),
                maxPriceCorporate:
                    editingProduct.maxCorpPrice === '' || editingProduct.maxCorpPrice == null
                        ? undefined
                        : parseNumberOr(editingProduct.maxCorpPrice, 0),
                isActive: toBoolActive(editingProduct),
                allowDecimalQty: !!editingProduct.allowDecimalQty,
                allowMinusQty: !!editingProduct.allowMinusQty,
                isPriceEditable: !!editingProduct.isPriceEditable,
                minPriceEditable:
                    editingProduct.isPriceEditable &&
                    editingProduct.minPriceEditable !== '' &&
                    editingProduct.minPriceEditable != null
                        ? parseNumberOr(editingProduct.minPriceEditable, 0)
                        : null,
                kmTypeValue,
            });
            goBack();
            setEditingProduct(null);
            await refreshCatalog();
        } catch (e) {
            alert(e.message || 'Failed to update product');
        } finally {
            setSaving(false);
        }
    };

    const handleCreateCatalogService = async () => {
        const priceErr = validateCatalogServicePrices(newService);
        if (priceErr) {
            alert(`${priceErr} cannot be negative.`);
            return;
        }
        setSaving(true);
        try {
            await createService({
                departmentId: newService.departmentId || undefined,
                categoryId: newService.categoryId || undefined,
                name: newService.name,
                arabicName: newService.arabicName?.trim() || undefined,
                sku: newService.sku || undefined,
                description: newService.description || undefined,
                unitOfMeasurement: newService.unitOfMeasurement || 'ea',
                sellingPrice: newService.sellingPrice === '' ? null : parseNumberOr(newService.sellingPrice, 0),
                serviceCost: parseNumberOr(newService.serviceCost, 0),
                isPriceEditable: !!newService.isPriceEditable,
                serviceQty: newService.serviceQtyEnabled ? 1 : null,
                minPriceCorporate: parseNumberOr(newService.minPriceCorporate, 0),
                maxPriceCorporate: parseNumberOr(newService.maxPriceCorporate, 0),
            });
            goBack();
            setNewService({
                name: '',
                arabicName: '',
                sku: '',
                description: '',
                unitOfMeasurement: 'ea',
                sellingPrice: '',
                serviceCost: '0',
                isPriceEditable: true,
                serviceQtyEnabled: false,
                minPriceCorporate: '',
                maxPriceCorporate: '',
                departmentId: '',
                categoryId: '',
            });
            await refreshCatalog();
        } catch (e) {
            alert(e.message || 'Failed to create service');
        } finally {
            setSaving(false);
        }
    };

    const openEditService = (service) => {
        setEditingService(buildEditingServiceState(service));
        navigate(mcRoutes.serviceEdit(service.id), { state: { service } });
    };

    const handleUpdateCatalogService = async () => {
        if (!editingService?.id) return;
        const priceErr = validateCatalogServicePrices(editingService);
        if (priceErr) {
            alert(`${priceErr} cannot be negative.`);
            return;
        }
        setSaving(true);
        try {
            const payload = {
                name: (editingService.name ?? '').trim(),
                arabicName: (editingService.arabicName ?? '').trim(),
                sku: (editingService.sku ?? '').trim(),
                description: (editingService.description ?? '').trim(),
                sellingPrice:
                    editingService.sellingPrice === ''
                        ? null
                        : parseNumberOr(editingService.sellingPrice, 0),
                serviceCost: parseNumberOr(editingService.serviceCost, 0),
                minPriceCorporate:
                    editingService.minPriceCorporate === '' || editingService.minPriceCorporate == null
                        ? undefined
                        : parseNumberOr(editingService.minPriceCorporate, 0),
                maxPriceCorporate:
                    editingService.maxPriceCorporate === '' || editingService.maxPriceCorporate == null
                        ? undefined
                        : parseNumberOr(editingService.maxPriceCorporate, 0),
                isPriceEditable: !!editingService.isPriceEditable,
                serviceQty: editingService.serviceQtyEnabled ? 1 : null,
                isActive: !!editingService.isActive,
                categoryId:
                    editingService.categoryId == null || editingService.categoryId === ''
                        ? null
                        : String(editingService.categoryId),
                vatMode:
                    editingService.vatMode == null || editingService.vatMode === ''
                        ? null
                        : String(editingService.vatMode),
            };
            await updateService(editingService.id, payload);
            goBack();
            setEditingService(null);
            await refreshCatalog();
        } catch (e) {
            alert(e.message || 'Failed to update service');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleProductField = async (product, field, nextValue, extraPayload = {}) => {
        if (!product?.id) return;
        const busyKey = `${catalogItemId(product)}:${field}`;
        const patch = { [field]: nextValue, ...extraPayload };
        setProductToggleBusyKey(busyKey);
        try {
            const updated = await updateProduct(catalogItemId(product), patch);
            const merged = updated && typeof updated === 'object' ? { ...patch, ...updated } : patch;
            const applyPatch = (item) =>
                catalogIdsMatch(item, product) ? { ...item, ...merged } : item;
            setProducts((prev) => prev.map(applyPatch));
            setDepartmentProducts((prev) =>
                prev.map((dept) => ({
                    ...dept,
                    products: (dept.products || []).map(applyPatch),
                })),
            );
            setEditingProduct((prev) =>
                prev && catalogIdsMatch(prev, product) ? { ...prev, ...merged } : prev,
            );
            if (field === 'isActive') {
                if (nextValue === false && statusFilter === 'Approved') {
                    setStatusFilter('All');
                } else if (nextValue === true && statusFilter === 'Rejected') {
                    setStatusFilter('All');
                }
            }
            await refreshCatalog();
            await loadKpis({ silent: true });
        } catch (e) {
            alert(e?.message || 'Failed to update product');
        } finally {
            setProductToggleBusyKey((current) => (current === busyKey ? '' : current));
        }
    };

    const handleToggleProductPriceEditable = async (product, currentlyEditable) => {
        if (!product?.id) return;
        if (currentlyEditable) {
            await handleToggleProductField(product, 'isPriceEditable', false);
            return;
        }
        const raw = window.prompt(
            'Enter minimum price (SAR, VAT inclusive). Cashier cannot go below this amount:',
            product.minPriceEditable != null && product.minPriceEditable !== ''
                ? String(product.minPriceEditable ?? product.min_price_editable ?? '')
                : '',
        );
        if (raw == null) return;
        const min = parseNumberOr(raw, NaN);
        if (!Number.isFinite(min) || min < 0) {
            alert('Minimum price must be zero or greater.');
            return;
        }
        await handleToggleProductField(product, 'isPriceEditable', true, {
            minPriceEditable: min,
        });
    };

    const handleToggleServiceField = async (service, field, nextValue, extraPayload = {}) => {
        if (!service?.id) return;
        const busyKey = `${catalogItemId(service)}:${field}`;
        const patch = { [field]: nextValue, ...extraPayload };
        setServiceToggleBusyKey(busyKey);
        try {
            const updated = await updateService(catalogItemId(service), patch);
            const merged = updated && typeof updated === 'object' ? { ...patch, ...updated } : patch;
            const applyPatch = (item) =>
                catalogIdsMatch(item, service) ? { ...item, ...merged } : item;
            setServices((prev) => prev.map(applyPatch));
            setDepartmentServices((prev) =>
                prev.map((dept) => ({
                    ...dept,
                    services: (dept.services || []).map(applyPatch),
                })),
            );
            setEditingService((prev) =>
                prev && catalogIdsMatch(prev, service) ? { ...prev, ...merged } : prev,
            );
            if (field === 'isActive') {
                if (nextValue === false && serviceStatusFilter === 'Approved') {
                    setServiceStatusFilter('All');
                } else if (nextValue === true && serviceStatusFilter === 'Rejected') {
                    setServiceStatusFilter('All');
                }
            }
            await refreshCatalog();
            await loadKpis({ silent: true });
        } catch (e) {
            alert(e?.message || 'Failed to update service');
        } finally {
            setServiceToggleBusyKey((current) => (current === busyKey ? '' : current));
        }
    };

    const handleEditDeptClick = (dept) => {
        setEditingDept(dept);
        navigate(mcRoutes.deptEdit(dept.id), { state: { department: dept } });
    };

    const handleCreateDepartment = async () => {
        if (!newDept.name.trim()) return;
        setSaving(true);
        try {
            await createDepartment({ name: newDept.name.trim() });
            setNewDept({ name: '' });
            goBack();
            await refreshCatalog();
        } catch (e) {
            alert(e.message || 'Failed to create department');
        } finally {
            setSaving(false);
        }
    };

    const handleCreateCategory = async () => {
        if (!newCat.name.trim() || !newCat.departmentId) return;
        setSaving(true);
        try {
            await createCategory({
                type: newCat.type,
                name: newCat.name.trim(),
                departmentId: String(newCat.departmentId),
            });
            setNewCat({ type: 'product', name: '', departmentId: '' });
            goBack();
            await refreshCatalog();
        } catch (e) {
            alert(e.message || 'Failed to create category');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteDeptClick = (id) => {
        if (!window.confirm('Delete this department? This cannot be undone.')) return;
        setSaving(true);
        deleteDepartment(id)
            .then(async () => {
                await refreshCatalog();
            })
            .catch(async (e) => {
                if (window.confirm(`${e.message || 'Delete failed.'}\n\nIf this item is linked, disable it instead?`)) {
                    await updateDepartment(id, { isActive: false });
                    await refreshCatalog();
                } else {
                    alert(e.message || 'Delete failed');
                }
            })
            .finally(() => setSaving(false));
    };

    const handleEditCatClick = (cat) => {
        const next = {
            ...cat,
            departmentId: cat.departmentId,
            type: cat.type || 'product',
        };
        setEditingCat(next);
        navigate(mcRoutes.catEdit(cat.id), { state: { category: next } });
    };

    const handleDeleteCatClick = (id) => {
        if (!window.confirm('Delete this category? This cannot be undone.')) return;
        setSaving(true);
        deleteCategory(id)
            .then(async () => {
                await refreshCatalog();
            })
            .catch((e) => {
                alert(e?.message || 'Delete failed. The category may be in use by products or services.');
            })
            .finally(() => setSaving(false));
    };

    const handleUpdateDepartment = async () => {
        if (!editingDept?.id || !editingDept?.name?.trim()) return;
        setSaving(true);
        try {
            await updateDepartment(editingDept.id, {
                name: editingDept.name.trim(),
                isActive: editingDept.isActive ?? true,
            });
            goBack();
            setEditingDept(null);
            await refreshCatalog();
        } catch (e) {
            alert(e.message || 'Failed to update department');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateCategory = async () => {
        if (!editingCat?.id || !editingCat?.name?.trim() || !editingCat?.departmentId) return;
        setSaving(true);
        try {
            // Backend PATCH /categories/:id only accepts { type?, name?, departmentId? }.
            // Do NOT send isActive — categories don't expose it (will 400 with strict validation).
            await updateCategory(editingCat.id, {
                name: editingCat.name.trim(),
                type: editingCat.type || 'product',
                departmentId: String(editingCat.departmentId),
            });
            goBack();
            setEditingCat(null);
            await refreshCatalog();
        } catch (e) {
            alert(e.message || 'Failed to update category');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteCatalogProduct = async () => {
        if (!editingProduct?.id) return;
        if (!window.confirm('Delete this product? This cannot be undone.')) return;
        setSaving(true);
        try {
            await deleteProduct(editingProduct.id);
            goBack();
            setEditingProduct(null);
            await refreshCatalog();
        } catch (e) {
            if (window.confirm(`${e.message || 'Delete failed.'}\n\nIf this item is linked, disable it instead?`)) {
                await updateProduct(editingProduct.id, { isActive: false });
                goBack();
                setEditingProduct(null);
                await refreshCatalog();
            } else {
                alert(e.message || 'Delete failed');
            }
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteCatalogService = async () => {
        if (!editingService?.id) return;
        if (!window.confirm('Delete this service? This cannot be undone.')) return;
        setSaving(true);
        try {
            await deleteService(editingService.id);
            goBack();
            setEditingService(null);
            await refreshCatalog();
        } catch (e) {
            if (window.confirm(`${e.message || 'Delete failed.'}\n\nIf this item is linked, disable it instead?`)) {
                await updateService(editingService.id, { isActive: false });
                goBack();
                setEditingService(null);
                await refreshCatalog();
            } else {
                alert(e.message || 'Delete failed');
            }
        } finally {
            setSaving(false);
        }
    };

    const handleBulkFileChange = (event) => {
        const file = event.target.files?.[0] || null;
        setSelectedBulkFile(file);
        setBulkImportResult(null);
    };

    const closeBulkProductModal = () => {
        goBack();
        setSelectedBulkFile(null);
        setBulkImportResult(null);
        setBulkImporting(false);
        bulkImportInFlightRef.current = false;
        if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';
    };

    const closeBulkServiceModal = () => {
        goBack();
        setSelectedBulkServiceFile(null);
        setBulkServiceImportResult(null);
        setBulkServiceImporting(false);
        bulkServiceImportInFlightRef.current = false;
        if (bulkServiceFileInputRef.current) bulkServiceFileInputRef.current.value = '';
    };

    const handleBulkImport = async () => {
        if (!selectedBulkFile || bulkImporting || bulkImportInFlightRef.current) return;
        bulkImportInFlightRef.current = true;
        setBulkImporting(true);
        setBulkImportResult(null);
        try {
            const result = await importProductsFromCsv(selectedBulkFile);
            setBulkImportResult(result);
            await refreshCatalog();
        } catch (e) {
            console.error('[MasterCatalog] bulk import failed', e);
            alert(e.message || 'CSV import failed');
        } finally {
            bulkImportInFlightRef.current = false;
            setBulkImporting(false);
        }
    };

    const handleBulkServiceFileChange = (event) => {
        const file = event.target.files?.[0] || null;
        setSelectedBulkServiceFile(file);
        setBulkServiceImportResult(null);
    };

    const handleBulkServiceImport = async () => {
        if (!selectedBulkServiceFile || bulkServiceImporting || bulkServiceImportInFlightRef.current) return;
        bulkServiceImportInFlightRef.current = true;
        setBulkServiceImporting(true);
        setBulkServiceImportResult(null);
        try {
            const result = await importServicesFromCsv(selectedBulkServiceFile);
            setBulkServiceImportResult(result);
            await refreshCatalog();
        } catch (e) {
            console.error('[MasterCatalog] service CSV import failed', e);
            alert(e.message || 'Service CSV import failed');
        } finally {
            bulkServiceImportInFlightRef.current = false;
            setBulkServiceImporting(false);
        }
    };

    const handleExportProductsCsv = async () => {
        if (productsExporting) return;
        setProductsExporting(true);
        try {
            await downloadProductsCsv();
            showToast('Product catalog exported as CSV', 'success');
        } catch (e) {
            alert(e?.message || 'Failed to export products CSV');
        } finally {
            setProductsExporting(false);
        }
    };

    const renderMasterCatalog = () => (
        <div className="ui-stack" style={{ marginTop: 16 }}>
            <div className="ui-toolbar ui-toolbar--standalone">
                <div className="ui-chips">
                    {['Approved', 'Pending', 'Rejected', 'All'].map(s => (
                        <button
                            key={s}
                            className={`ui-chip${statusFilter === s ? ' ui-chip--on' : ''}`}
                            onClick={() => setStatusFilter(s)}
                        >
                            {t(`filter.${s.toLowerCase()}`)}
                        </button>
                    ))}
                </div>
                
                <div className="ui-search">
                    <Search size={15} />
                    <input
                        className="ui-input"
                        type="text"
                        placeholder={t('search.products')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <select
                    className="ui-select"
                    style={{ maxWidth: 200 }}
                    value={selectedProductDepartment}
                    onChange={(e) => setSelectedProductDepartment(e.target.value)}
                >
                    <option value="">{t('filter.allDepartments')}</option>
                    {productDepartmentOptions.map((dept) => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                </select>

                <div className="ui-toolbar-end" style={{ alignItems: 'center' }}>
                    <span className="ui-help">
                        {searchQuery
                            ? t('count.of', { n: displayedProducts.length, m: products.length })
                            : t('count.items', { n: displayedProducts.length })}
                    </span>
                    {hasPermission('inventory.master-catalog.products.view') && (
                        <button
                            type="button"
                            className="ui-btn ui-btn--default"
                            onClick={handleExportProductsCsv}
                            disabled={productsExporting || loading}
                            title={t('title.exportProductsCsv')}
                        >
                            <Download size={15} />
                            {productsExporting ? t('btn.exporting') : t('btn.exportCsv')}
                        </button>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="ui-empty">
                    <div className="ui-empty-icon"><RefreshCw size={28} className="ui-spin" /></div>
                    <p>{t('loading.products')}</p>
                </div>
            ) : displayedProducts.length === 0 ? (
                <div className="ui-empty">
                    <div className="ui-empty-icon"><Package size={44} opacity={0.18} /></div>
                    <p>{searchQuery ? `${t('empty.productsSearch')} "${searchQuery}"` : t('empty.products')}</p>
                </div>
            ) : (
                <div className="ui-cards ui-cards--wide">
                    {displayedProducts.map((p) => {
                        const canEditProducts = hasPermission('inventory.master-catalog.products.edit');
                        const createdRaw = p.createdAt ?? p.created_at;
                        const createdLabel = formatCatalogCreatedAt(createdRaw);
                        const isActive = toBoolActive(p);
                        const priceEditable = toBoolPriceEditable(p);
                        const activeBusy = productToggleBusyKey === `${catalogItemId(p)}:isActive`;
                        const priceBusy = productToggleBusyKey === `${catalogItemId(p)}:isPriceEditable`;
                        return (
                            <div
                                key={p.id}
                                className={`ui-rcard${canEditProducts ? ' ui-rcard--open' : ''}`}
                                onClick={() => { if (canEditProducts) handleEditClick(p); }}
                            >
                                <div className="ui-rcard-top">
                                    <span className="ui-rcard-icon"><Box size={16} /></span>
                                    <div className="ui-rcard-end">
                                        <span className={`ui-pill ui-pill--${isActive ? 'ok' : 'neutral'}`}>
                                            {isActive ? t('status.active') : t('status.inactive')}
                                        </span>
                                    </div>
                                </div>

                                <h3 className="ui-rcard-title" dir={locale === 'ar' && (p.arabicName || p.arabic_name) ? 'rtl' : undefined}>
                                    {displayName(p)}
                                </h3>
                                <p className="ui-rcard-sub">
                                    {p.sku || t('chip.noSku')}
                                    {createdLabel ? ` · ${t('chip.created')} ${createdLabel}` : ''}
                                </p>

                                <div className="ui-tags">
                                    <span className="ui-tag">{t('chip.product')}</span>
                                    <span className="ui-tag">
                                        {formatUomRule(
                                            p.warehouseUnit,
                                            p.workshopUnit ?? p.unit,
                                            p.conversionFactor ?? 1,
                                        )}
                                    </span>
                                    <span className="ui-tag">{p.categoryName || '—'}</span>
                                    {p.kmTypeValue != null && String(p.kmTypeValue).trim() !== '' && (
                                        <span className="ui-tag">{t('chip.km')} {p.kmTypeValue}</span>
                                    )}
                                    {toBoolAllowMinus(p) ? (
                                        <span className="ui-tag">{t('chip.minusQty')}</span>
                                    ) : null}
                                </div>

                                {canEditProducts && (
                                    <div className="ui-stack-sm" style={{ marginTop: 4 }} onClick={(e) => e.stopPropagation()}>
                                        <label className="ui-switch ui-switch--row">
                                            <span className="ui-switch-name">{t('toggle.status')}</span>
                                            <span className="ui-switch-text">
                                                {activeBusy ? t('toggle.updating') : isActive ? t('status.active') : t('status.inactive')}
                                            </span>
                                            <input
                                                type="checkbox"
                                                checked={isActive}
                                                disabled={activeBusy}
                                                aria-label={t('aria.toggleActive', { name: displayName(p) })}
                                                onChange={() => handleToggleProductField(p, 'isActive', !isActive)}
                                            />
                                            <span className="ui-switch-track" />
                                        </label>
                                        <label className="ui-switch ui-switch--row">
                                            <span className="ui-switch-name">{t('toggle.priceEditable')}</span>
                                            <span className="ui-switch-text">
                                                {priceBusy
                                                    ? t('toggle.updating')
                                                    : priceEditable
                                                      ? `${t('toggle.editable')} · min SAR ${Number(p.minPriceEditable ?? p.min_price_editable ?? 0).toFixed(2)}`
                                                      : t('toggle.fixedPrice')}
                                            </span>
                                            <input
                                                type="checkbox"
                                                checked={priceEditable}
                                                disabled={priceBusy}
                                                aria-label={t('aria.togglePriceEditable', { name: displayName(p) })}
                                                onChange={() => handleToggleProductPriceEditable(p, priceEditable)}
                                            />
                                            <span className="ui-switch-track" />
                                        </label>
                                    </div>
                                )}

                                <div className="ui-rcard-foot">
                                    <span className="ui-rcard-figure">SAR {p.salePrice ?? 0}</span>
                                    {canEditProducts && (
                                        <div className="ui-rcard-end">
                                            <button
                                                type="button"
                                                className="ui-btn ui-btn--icon ui-btn--subtle ui-btn--sm"
                                                onClick={(e) => { e.stopPropagation(); handleEditClick(p); }}
                                                title={t('btn.edit')}
                                            >
                                                <Edit3 size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );

    const renderMasterDepartment = () => (
        <div className="ui-stack" style={{ marginTop: 16 }}>
            <div className="ui-toolbar ui-toolbar--standalone">
                <div className="ui-search">
                    <Search size={16} />
                    <input
                        className="ui-input"
                        type="text"
                        placeholder={t('search.departments')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="ui-toolbar-end">
                    {hasPermission('inventory.master-catalog.departments.create') && (
                        <button
                            type="button"
                            className="ui-btn ui-btn--primary ui-btn--sm"
                            onClick={() => navigate(mcRoutes.deptNew())}
                        >
                            <Plus size={14} /> {t('btn.addDepartment')}
                        </button>
                    )}
                </div>
            </div>

            <div className="ui-cards">
                {filteredDepartments.map(dept => (
                    <div key={dept.id} className="ui-rcard">
                        <div className="ui-rcard-top">
                            <span className="ui-rcard-icon"><LayoutGrid size={16} /></span>
                        </div>
                        <h3 className="ui-rcard-title">{dept.name}</h3>
                        <p className="ui-rcard-sub">{t('chip.department')}</p>
                        <div className="ui-rcard-foot">
                            <div className="ui-rcard-end">
                                {hasPermission('inventory.master-catalog.departments.edit') && (
                                    <button
                                        type="button"
                                        className="ui-btn ui-btn--icon ui-btn--subtle ui-btn--sm"
                                        onClick={() => handleEditDeptClick(dept)}
                                        title={t('btn.edit')}
                                    >
                                        <Edit3 size={14} />
                                    </button>
                                )}
                                {hasPermission('inventory.master-catalog.departments.delete') && (
                                    <button
                                        type="button"
                                        className="ui-btn ui-btn--icon ui-btn--danger ui-btn--sm"
                                        onClick={() => handleDeleteDeptClick(dept.id)}
                                        title={t('btn.delete')}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderMasterCategory = () => (
        <div className="ui-stack" style={{ marginTop: 16 }}>
            <div className="ui-toolbar ui-toolbar--standalone">
                <div className="ui-search">
                    <Search size={16} />
                    <input
                        className="ui-input"
                        type="text"
                        placeholder={t('search.categories')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="ui-toolbar-end">
                    {hasPermission('inventory.master-catalog.categories.create') && (
                        <button
                            type="button"
                            className="ui-btn ui-btn--primary ui-btn--sm"
                            onClick={() => navigate(mcRoutes.catNew())}
                        >
                            <Plus size={14} /> {t('btn.addCategory')}
                        </button>
                    )}
                </div>
            </div>

            <div className="ui-table-wrap ui-table-wrap--scroll">
                <table className="ui-table">
                    <thead>
                        <tr>
                            <th>{t('th.categoryName')}</th>
                            <th>{t('th.department')}</th>
                            <th>{t('th.actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {categoriesPaging.pagedRows.map(cat => (
                            <tr key={cat.id}>
                                <td>
                                    <div className="ui-row" style={{ gap: 8 }}>
                                        <Tags size={16} opacity={0.3} />
                                        {cat.name}
                                    </div>
                                </td>
                                <td>
                                    <span className="ui-tag">
                                        {departments.find((d) => String(d.id) === String(cat.departmentId))?.name || '—'}
                                    </span>
                                </td>
                                <td>
                                    <div className="ui-row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                                        {hasPermission('inventory.master-catalog.categories.edit') && (
                                            <button className="ui-btn ui-btn--icon ui-btn--subtle ui-btn--sm" onClick={() => handleEditCatClick(cat)}><Edit3 size={14} /></button>
                                        )}
                                        {hasPermission('inventory.master-catalog.categories.delete') && (
                                            <button className="ui-btn ui-btn--icon ui-btn--danger ui-btn--sm" onClick={() => handleDeleteCatClick(cat.id)}><Trash2 size={14} /></button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <UiPager {...categoriesPaging.pagerProps} />
            </div>
        </div>
    );

    const renderProductRequests = () => {
        const statusBadge = (status) => {
            const raw = String(status || '').toLowerCase();
            const tone = raw === 'approved' ? 'ok' : raw === 'rejected' ? 'dang' : 'warn';
            return (
                <span className={`ui-pill ui-pill--${tone}`}>
                    {raw ? raw[0].toUpperCase() + raw.slice(1) : '—'}
                </span>
            );
        };
        const fmtDate = (iso) => {
            if (!iso) return '—';
            const d = new Date(iso);
            return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
        };
        const fmtMoney = (v) => {
            if (v == null || v === '') return '—';
            const n = Number(v);
            return Number.isFinite(n) ? `SAR ${n.toFixed(2)}` : '—';
        };

        return (
            <div className="ui-stack" style={{ marginTop: 16 }}>
                <div className="ui-stat-strip">
                    {[
                        { key: 'total', label: t('kpi.total'), value: prKpis?.total },
                        { key: 'pending', label: t('kpi.pending'), value: prKpis?.pending },
                        { key: 'approved', label: t('kpi.approved'), value: prKpis?.approved },
                        { key: 'rejected', label: t('kpi.rejected'), value: prKpis?.rejected },
                    ].map((c) => (
                        <div key={c.key} className="ui-stat">
                            <span className="ui-stat-label">{c.label}</span>
                            <span className="ui-stat-value">{kpiNum(c.value)}</span>
                        </div>
                    ))}
                </div>

                <div className="ui-toolbar ui-toolbar--standalone">
                    <div className="ui-chips">
                        {['Pending', 'Approved', 'Rejected', 'All'].map((s) => (
                            <button
                                key={s}
                                type="button"
                                className={`ui-chip${prTab === s ? ' ui-chip--on' : ''}`}
                                onClick={() => setPrTab(s)}
                            >
                                {t(`filter.${s.toLowerCase()}`)}
                            </button>
                        ))}
                    </div>
                    <button type="button" className="ui-btn ui-btn--default" onClick={loadProductRequests} disabled={prLoading}>
                        <RefreshCw size={14} /> {prLoading ? t('btn.refreshing') : t('btn.refresh')}
                    </button>
                </div>

                {prError && (
                    <div className="ui-banner ui-banner--dang">
                        <AlertCircle size={14} /> {prError}
                        <button type="button" className="ui-btn ui-btn--default ui-btn--sm" onClick={loadProductRequests}>
                            <RefreshCw size={12} /> {t('btn.retry')}
                        </button>
                    </div>
                )}

                {prLoading ? (
                    <div className="ui-state"><Loader2 size={20} className="ui-spin" /><div className="ui-state-title">{t('loading')}</div></div>
                ) : productRequests.length === 0 ? (
                    <div className="ui-empty">
                        <div className="ui-empty-icon"><CheckCircle2 size={48} opacity={0.15} /></div>
                        <p>{t('empty.requests', { status: t(`filter.${prTab.toLowerCase()}`).toLowerCase() })}</p>
                    </div>
                ) : (
                    <div className="ui-cards ui-cards--wide">
                        {productRequests.map((r) => {
                            const submitter = r.submittedByUser || {};
                            const pending = String(r.status || '').toLowerCase() === 'pending';
                            return (
                                <div key={r.id} className="ui-rcard">
                                    <div className="ui-rcard-top">
                                        <span className="ui-rcard-icon"><Package size={16} /></span>
                                        <div className="ui-rcard-end">{statusBadge(r.status)}</div>
                                    </div>

                                    <h3
                                        className="ui-rcard-title"
                                        dir={locale === 'ar' && (r.arabicName || r.arabic_name) ? 'rtl' : undefined}
                                    >
                                        {displayName(r) || '—'}
                                    </h3>

                                    {/* Each pair is its own cell: .ui-kv tiles them and the
                                        hairlines come from the gaps between them. */}
                                    <div className="ui-kv">
                                        <div>
                                            <span className="ui-kv-label">{t('pr.sku')}</span>
                                            <span className="ui-kv-value">{r.sku || '—'}</span>
                                        </div>
                                        <div>
                                            <span className="ui-kv-label">{t('pr.brand')}</span>
                                            <span className="ui-kv-value">{r.brandName || '—'}</span>
                                        </div>
                                        <div>
                                            <span className="ui-kv-label">{t('pr.expectedPrice')}</span>
                                            <span className="ui-kv-value">{fmtMoney(r.expectedPrice)}</span>
                                        </div>
                                        <div>
                                            <span className="ui-kv-label">{t('pr.submittedOn')}</span>
                                            <span className="ui-kv-value">{fmtDate(r.createdAt)}</span>
                                        </div>
                                        <div className="ui-kv-wide">
                                            <span className="ui-kv-label">{t('pr.fromSupplier')}</span>
                                            <span className="ui-kv-value">{submitter.name || submitter.email || '—'}</span>
                                        </div>
                                        {r.notes && (
                                            <div className="ui-kv-wide">
                                                <span className="ui-kv-label">{t('pr.notes')}</span>
                                                <span className="ui-kv-value">{r.notes}</span>
                                            </div>
                                        )}
                                    </div>
                                    {String(r.status).toLowerCase() === 'rejected' && r.rejectionReason && (
                                        <div className="ui-banner ui-banner--dang">
                                            <AlertCircle size={15} />
                                            <span><strong>{t('pr.rejectionReason')}</strong> {r.rejectionReason}</span>
                                        </div>
                                    )}

                                    {pending && (
                                        <div className="ui-rcard-foot">
                                            <div className="ui-rcard-end">
                                                <button
                                                    type="button"
                                                    className="ui-btn ui-btn--danger ui-btn--sm"
                                                    onClick={() => openPrReject(r)}
                                                >
                                                    <XCircle size={14} /> {t('btn.reject')}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="ui-btn ui-btn--brand ui-btn--sm"
                                                    onClick={() => openPrApprove(r)}
                                                >
                                                    <CheckCircle2 size={14} /> {t('btn.approve')}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    const renderDuplicationReview = () => {
        const totalAffected = dupGroups.reduce((sum, g) => sum + (g.items?.length || g.count || 0), 0);
        const entityIcon = {
            product: Package,
            service: Layers,
            department: LayoutGrid,
            category: Tags,
        };
        return (
            <div className="ui-stack" style={{ marginTop: 16 }}>
                <div className="ui-banner ui-banner--info">
                    <strong>{t('dup.engine')}</strong>
                    <p>Automatically detects similar records across products, services, departments and categories.</p>
                </div>

                <div className="ui-toolbar ui-toolbar--standalone">
                    <div className="ui-chips">
                        {[
                            { id: '', labelKey: 'filter.all' },
                            { id: 'product', labelKey: 'filter.products' },
                            { id: 'service', labelKey: 'filter.services' },
                            { id: 'department', labelKey: 'filter.departments' },
                            { id: 'category', labelKey: 'filter.categories' },
                        ].map((opt) => (
                            <button
                                key={opt.id || 'all'}
                                type="button"
                                className={`ui-chip${dupEntityFilter === opt.id ? ' ui-chip--on' : ''}`}
                                onClick={() => setDupEntityFilter(opt.id)}
                            >
                                {t(opt.labelKey)}
                            </button>
                        ))}
                    </div>
                    <button type="button" className="ui-btn ui-btn--default" onClick={loadDuplicates} disabled={dupLoading}>
                        <RefreshCw size={14} /> {dupLoading ? t('btn.refreshing') : t('btn.refresh')}
                    </button>
                </div>

                <div className={`ui-banner ui-banner--${dupGroups.length ? 'warn' : 'ok'}`}>
                    {dupGroups.length ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
                    <span>
                        <strong>{t('dup.detection')}</strong>{' '}
                        {dupLoading
                            ? t('dup.scanning')
                            : dupGroups.length
                                ? t('dup.groupsRecords', { groups: dupGroups.length, records: totalAffected })
                                : t('dup.noGroups')}
                    </span>
                    {dupGroups.length > 0 && (
                        <span className="ui-pill ui-pill--warn">{dupGroups.length} {t('dup.groups')}</span>
                    )}
                </div>

                {dupError && (
                    <div className="ui-banner ui-banner--dang">
                        <AlertCircle size={14} /> {dupError}
                        <button type="button" className="ui-btn ui-btn--default ui-btn--sm" onClick={loadDuplicates}>
                            <RefreshCw size={12} /> {t('btn.retry')}
                        </button>
                    </div>
                )}

                {!dupLoading && dupGroups.length === 0 && !dupError && (
                    <div className="ui-empty">
                        <div className="ui-empty-icon"><CheckCircle2 size={48} opacity={0.15} /></div>
                        <p>{t('empty.duplicates')}{dupEntityFilter ? ` (${dupEntityFilter}s)` : ''}</p>
                    </div>
                )}

                <div className="ui-stack-sm">
                    {dupGroups.map((group) => {
                        const key = `${group.entityType}::${group.nameKey}`;
                        const isOpen = expandedDupKey === key;
                        const Icon = entityIcon[group.entityType] || Package;
                        const items = Array.isArray(group.items) ? group.items : [];
                        return (
                            <div key={key} className="ui-panel">
                                <button
                                    type="button"
                                    className="ui-toolbar"
                                    aria-expanded={isOpen}
                                    onClick={() => setExpandedDupKey(isOpen ? null : key)}
                                >
                                    <Icon size={16} />
                                    <span className="ui-panel-title">
                                        {group.displayName || group.nameKey}
                                    </span>
                                    <span className="ui-tag">{group.entityType}</span>
                                    <span className="ui-pill ui-pill--neutral">
                                        {group.count ?? items.length}
                                    </span>
                                    <span className="ui-toolbar-end">
                                        <ChevronDown
                                            size={16}
                                            style={{
                                                transform: isOpen ? 'rotate(180deg)' : 'none',
                                                transition: 'transform 0.2s',
                                            }}
                                        />
                                    </span>
                                </button>
                                {isOpen && (
                                    <>
                                    <div className="ui-table-wrap ui-table-wrap--scroll ui-table-wrap--bare">
                                        <table className="ui-table">
                                            <thead>
                                                <tr>
                                                    <th>{t('th.name')}</th>
                                                    <th>{t('th.sku')}</th>
                                                    <th>{t('th.kmType')}</th>
                                                    <th>{t('th.vatMode')}</th>
                                                    <th>{t('th.created')}</th>
                                                    <th>{t('th.department')}</th>
                                                    <th>{t('th.category')}</th>
                                                    <th>{t('th.status')}</th>
                                                    <th>{t('th.actions')}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {items.map((item) => (
                                                    <tr key={item.id}>
                                                        <td dir={locale === 'ar' && (item.arabicName || item.arabic_name) ? 'rtl' : undefined}>
                                                            {displayName(item) || '—'}
                                                        </td>
                                                        <td className="mono">{item.sku || '—'}</td>
                                                        <td className="mono">
                                                            {group.entityType === 'product' &&
                                                            item.kmTypeValue != null &&
                                                            String(item.kmTypeValue).trim() !== ''
                                                                ? item.kmTypeValue
                                                                : '—'}
                                                        </td>
                                                        <td className="mono">
                                                            {group.entityType === 'service' &&
                                                            (item.vatMode != null || item.vat_mode != null) &&
                                                            String(item.vatMode ?? item.vat_mode).trim() !== ''
                                                                ? String(item.vatMode ?? item.vat_mode)
                                                                : '—'}
                                                        </td>
                                                        <td className="mono" style={{ whiteSpace: 'nowrap', fontSize: '0.8125rem' }}>
                                                            {formatCatalogCreatedAt(item.createdAt ?? item.created_at) || '—'}
                                                        </td>
                                                        <td>{item.department?.name || '—'}</td>
                                                        <td>{item.category?.name || '—'}</td>
                                                        <td>
                                                            <span className={`ui-pill ui-pill--${item.isActive === false ? 'neutral' : 'ok'}`}>
                                                                {item.isActive === false ? t('status.inactive') : t('status.active')}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            {hasPermission('inventory.master-catalog.duplication.edit') && (
                                                                <button
                                                                    type="button"
                                                                    className="ui-btn ui-btn--icon ui-btn--danger ui-btn--sm"
                                                                    title={t('btn.delete')}
                                                                    onClick={() => handleDeleteDuplicateItem(group.entityType, item)}
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="ui-panel-foot">
                                        <div className="ui-panel-end">
                                            <button
                                                type="button"
                                                className="ui-btn ui-btn--default ui-btn--sm"
                                                onClick={() => handleIgnoreDuplicate(group)}
                                            >
                                                <ShieldCheck size={14} /> {t('btn.markNotDuplicate')}
                                            </button>
                                        </div>
                                    </div>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderSupplierAvailability = () => (
        <div className="ui-stack" style={{ marginTop: 16 }}>
            <div className="ui-toolbar ui-toolbar--standalone">
                <div className="ui-search">
                    <Search size={18} />
                    <input
                        className="ui-input"
                        type="text"
                        placeholder={t('search.availability')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="ui-tags">
                    <span className="ui-pill ui-pill--ok">0 {t('avail.withStock')}</span>
                    <span className="ui-pill ui-pill--dang">{filteredAvailability.length} {t('avail.noSupplier')}</span>
                </div>
            </div>

            <div className="ui-table-wrap ui-table-wrap--scroll">
                <table className="ui-table">
                    <thead>
                        <tr>
                            <th>{t('th.product')}</th>
                            <th>{t('th.category')}</th>
                            <th>{t('th.unitConversion')}</th>
                            <th>{t('th.kmType')}</th>
                            <th>{t('th.suppliers')}</th>
                            <th>{t('th.availability')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(loading ? [] : availabilityPaging.pagedRows).map((p) => (
                            <tr key={p.id}>
                                <td>
                                    <div className="ui-row" style={{ gap: 8 }} dir={locale === 'ar' && (p.arabicName || p.arabic_name) ? 'rtl' : undefined}>
                                        <Package size={16} opacity={0.3} />
                                        {displayName(p)}
                                    </div>
                                </td>
                                <td>{p.categoryName || '—'}</td>
                                <td>
                                    {formatUomRule(
                                        p.warehouseUnit,
                                        p.workshopUnit ?? p.unit,
                                        p.conversionFactor ?? 1,
                                    )}
                                </td>
                                <td className="mono">
                                    {p.kmTypeValue != null && String(p.kmTypeValue).trim() !== ''
                                        ? p.kmTypeValue
                                        : '—'}
                                </td>
                                <td className="ui-help">{t('avail.noSuppliers')}</td>
                                <td><span className="ui-pill ui-pill--dang">{t('avail.noStock')}</span></td>
                            </tr>
                        ))}
                        {!loading && filteredAvailability.length === 0 && (
                            <tr>
                                <td colSpan={6} className="ui-help" style={{ textAlign: 'center', padding: '24px' }}>
                                    {searchQuery ? `${t('empty.productsSearch')} "${searchQuery}"` : t('empty.products')}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
                <UiPager {...availabilityPaging.pagerProps} />
            </div>
        </div>
    );

    const renderServices = () => (
        <div className="ui-stack" style={{ marginTop: 16 }}>
            <div className="ui-toolbar ui-toolbar--standalone">
                <div className="ui-chips">
                    {['Approved', 'Pending', 'Rejected', 'All'].map((s) => (
                        <button
                            key={s}
                            type="button"
                            className={`ui-chip${s === serviceStatusFilter ? ' ui-chip--on' : ''}`}
                            onClick={() => setServiceStatusFilter(s)}
                        >
                            {t(`filter.${s.toLowerCase()}`)}
                        </button>
                    ))}
                </div>
                <div className="ui-search">
                    <Search size={15} />
                    <input
                        className="ui-input"
                        type="text"
                        placeholder={t('search.services')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <select
                    className="ui-select"
                    style={{ maxWidth: 200 }}
                    value={selectedServiceDepartment}
                    onChange={(e) => setSelectedServiceDepartment(e.target.value)}
                >
                    <option value="">{t('filter.allDepartments')}</option>
                    {serviceDepartmentOptions.map((dept) => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                </select>
            </div>

            <div className="ui-stat-strip">
                <div className="ui-stat">
                    <span className="ui-stat-label">{t('kpi.totalServices')}</span>
                    <span className="ui-stat-value">{services.length}</span>
                </div>
                <div className="ui-stat">
                    <span className="ui-stat-label">{t('kpi.approved')}</span>
                    <span className="ui-stat-value">{services.filter((s) => s.isActive !== false).length}</span>
                </div>
                <div className="ui-stat">
                    <span className="ui-stat-label">{t('kpi.priceEditable')}</span>
                    <span className="ui-stat-value">{services.filter((s) => toBoolPriceEditable(s)).length}</span>
                </div>
            </div>

            {loading ? (
                <div className="ui-empty">
                    <div className="ui-empty-icon">
                        <RefreshCw size={28} className="ui-spin" />
                    </div>
                    <p>{t('loading.services')}</p>
                </div>
            ) : displayedServices.length === 0 ? (
                <div className="ui-empty">
                    <div className="ui-empty-icon">
                        <Layers size={44} opacity={0.18} />
                    </div>
                    <p>
                        {services.length === 0
                            ? t('empty.services')
                            : searchQuery
                              ? `${t('empty.servicesSearch')} "${searchQuery}"`
                              : 'No services match this filter'}
                    </p>
                </div>
            ) : (
                <div className="ui-cards ui-cards--wide">
                    {displayedServices.map((p) => {
                        const isActive = toBoolActive(p);
                        const priceEditable = toBoolPriceEditable(p);
                        const serviceQtyOn = toBoolServiceQty(p);
                        const createdRaw = p.createdAt ?? p.created_at;
                        const createdLabel = formatCatalogCreatedAt(createdRaw);
                        const activeBusy = serviceToggleBusyKey === `${catalogItemId(p)}:isActive`;
                        const priceBusy = serviceToggleBusyKey === `${catalogItemId(p)}:isPriceEditable`;
                        const qtyBusy = serviceToggleBusyKey === `${catalogItemId(p)}:serviceQty`;
                        const canEditServices = hasPermission('inventory.master-catalog.services.edit');
                        return (
                            <div
                                key={p.id}
                                className={`ui-rcard${canEditServices ? ' ui-rcard--open' : ''}`}
                                role={canEditServices ? 'button' : undefined}
                                tabIndex={canEditServices ? 0 : undefined}
                                onClick={() => { if (canEditServices) openEditService(p); }}
                                onKeyDown={(e) => {
                                    if ((e.key === 'Enter' || e.key === ' ') && canEditServices) {
                                        e.preventDefault();
                                        openEditService(p);
                                    }
                                }}
                            >
                                <div className="ui-rcard-top">
                                    <span className="ui-rcard-icon"><Layers size={16} /></span>
                                    <div className="ui-rcard-end">
                                        <span className={`ui-pill ui-pill--${isActive ? 'ok' : 'neutral'}`}>
                                            {isActive ? t('status.active') : t('status.inactive')}
                                        </span>
                                    </div>
                                </div>

                                <h3
                                    className="ui-rcard-title"
                                    dir={locale === 'ar' && (p.arabicName || p.arabic_name) ? 'rtl' : undefined}
                                >
                                    {displayName(p)}
                                </h3>
                                <p className="ui-rcard-sub">
                                    {p.sku || t('chip.noSku')}
                                    {createdLabel ? ` · ${t('chip.created')} ${createdLabel}` : ''}
                                </p>

                                <div className="ui-tags">
                                    <span className="ui-tag">{p.categoryName || '—'}</span>
                                    {(p.vatMode != null && String(p.vatMode).trim() !== '') ||
                                    (p.vat_mode != null && String(p.vat_mode).trim() !== '') ? (
                                        <span className="ui-tag">{String(p.vatMode ?? p.vat_mode)}</span>
                                    ) : null}
                                </div>

                                <p className="ui-rcard-sub">
                                    {t('label.serviceCost')}: {t('sale.sar', { price: p.serviceCost ?? p.service_cost ?? 0 })}
                                </p>

                                {canEditServices && (
                                    <div className="ui-stack-sm" style={{ marginTop: 4 }} onClick={(e) => e.stopPropagation()}>
                                        <label className="ui-switch ui-switch--row">
                                            <span className="ui-switch-name">{t('toggle.status')}</span>
                                            <span className="ui-switch-text">
                                                {activeBusy ? t('toggle.updating') : isActive ? t('status.active') : t('status.inactive')}
                                            </span>
                                            <input
                                                type="checkbox"
                                                checked={isActive}
                                                disabled={activeBusy}
                                                aria-label={t('aria.toggleActive', { name: displayName(p) })}
                                                onChange={() => handleToggleServiceField(p, 'isActive', !isActive)}
                                            />
                                            <span className="ui-switch-track" />
                                        </label>
                                        <label className="ui-switch ui-switch--row">
                                            <span className="ui-switch-name">{t('toggle.priceEditable')}</span>
                                            <span className="ui-switch-text">
                                                {priceBusy ? t('toggle.updating') : priceEditable ? t('toggle.editable') : t('toggle.fixedPrice')}
                                            </span>
                                            <input
                                                type="checkbox"
                                                checked={priceEditable}
                                                disabled={priceBusy}
                                                aria-label={t('aria.togglePriceEditable', { name: displayName(p) })}
                                                onChange={() => handleToggleServiceField(p, 'isPriceEditable', !priceEditable)}
                                            />
                                            <span className="ui-switch-track" />
                                        </label>
                                        <label className="ui-switch ui-switch--row">
                                            <span className="ui-switch-name">{t('toggle.serviceQty')}</span>
                                            <span className="ui-switch-text">
                                                {qtyBusy ? t('toggle.updating') : serviceQtyOn ? t('toggle.qtyOn') : t('toggle.qtyOff')}
                                            </span>
                                            <input
                                                type="checkbox"
                                                checked={serviceQtyOn}
                                                disabled={qtyBusy}
                                                aria-label={t('aria.toggleServiceQty', { name: displayName(p) })}
                                                onChange={() => handleToggleServiceField(p, 'serviceQty', serviceQtyOn ? null : 1)}
                                            />
                                            <span className="ui-switch-track" />
                                        </label>
                                    </div>
                                )}

                                <div className="ui-rcard-foot">
                                    <span className="ui-rcard-figure">
                                        {t('sale.sar', { price: p.sellingPrice ?? 0 })}
                                    </span>
                                    {canEditServices && (
                                        <div className="ui-rcard-end">
                                            <button
                                                type="button"
                                                className="ui-btn ui-btn--icon ui-btn--subtle ui-btn--sm"
                                                onClick={(e) => { e.stopPropagation(); openEditService(p); }}
                                                title={t('btn.edit')}
                                            >
                                                <Edit3 size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );

    return (
        <div className={`ui-root ui-root--flush${pageMode ? ' master-catalog-route-view' : ''}`}>
            {!pageMode && (
            <>
            {/* The tab row carries the page's actions at its trailing edge. */}
            <div className="ui-tabs" role="tablist">
                {visibleMasterTabs.map(tab => (
                    <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === tab.id}
                        className="ui-tab"
                        onClick={() => {
                            setActiveTab(tab.id);
                            setSearchQuery('');
                            navigate(masterCatalogListUrl(tab.id), { replace: true });
                        }}
                    >
                        {t(MC_TAB_LABEL_KEYS[tab.id] || tab.label)}
                    </button>
                ))}
                <div className="ui-tabs-end">
                    <button type="button" className="ui-btn ui-btn--default ui-btn--sm">
                        <RefreshCw size={14} /> {t('btn.syncDepts')}
                    </button>
                    {hasPermission('inventory.master-catalog.products.create') && (
                        <button type="button" className="ui-btn ui-btn--default ui-btn--sm" onClick={() => navigate(mcRoutes.productImport())}>
                            <Upload size={14} /> {t('btn.bulkProduct')}
                        </button>
                    )}
                    {hasPermission('inventory.master-catalog.services.create') && (
                        <button type="button" className="ui-btn ui-btn--default ui-btn--sm" onClick={() => navigate(mcRoutes.serviceImport())}>
                            <Upload size={14} /> {t('btn.bulkService')}
                        </button>
                    )}
                    {hasPermission('inventory.master-catalog.products.create') && (
                        <button type="button" className="ui-btn ui-btn--primary ui-btn--sm" onClick={() => navigate(mcRoutes.productNew())}>
                            <Plus size={14} /> {t('btn.addProduct')}
                        </button>
                    )}
                    {hasPermission('inventory.master-catalog.services.create') && (
                        <button type="button" className="ui-btn ui-btn--primary ui-btn--sm" onClick={() => navigate(mcRoutes.serviceNew())}>
                            <Plus size={14} /> {t('btn.addService')}
                        </button>
                    )}
                </div>
            </div>

            {visibleMasterTabs.length === 0 && (
                <div className="ui-panel" style={{ marginTop: 16 }}>
                    <div className="ui-empty">
                        <div className="ui-empty-title">{t('empty.noTabs')}</div>
                    </div>
                </div>
            )}

            {kpisError && (
                <div className="ui-banner ui-banner--dang" style={{ marginTop: 16 }}>
                    <AlertCircle size={15} />
                    <span>{kpisError}</span>
                    <button type="button" className="ui-btn ui-btn--default ui-btn--sm" onClick={loadKpis}>
                        <RefreshCw size={13} /> {t('btn.retry')}
                    </button>
                </div>
            )}

            {/* Summary cards (live KPIs) */}
            <div className="ui-kpis" style={{ marginTop: 16 }}>
                {buildKpiCards(kpis, fallbackKpis, t).map((card) => (
                    <div key={card.key} className="ui-metric">
                        <span className="ui-metric-icon"><card.icon size={62} strokeWidth={1.1} /></span>
                        <div className="ui-metric-label">{card.label}</div>
                        <div className="ui-metric-value">
                            {kpisLoading && !kpis ? '—' : card.value}
                        </div>
                        <div className="ui-metric-foot">
                            {kpisLoading && !kpis ? t('loading') : card.sub}
                        </div>
                    </div>
                ))}
            </div>

            <div className="ui-banner ui-banner--info" style={{ marginTop: 16 }}>
                <CheckCircle2 size={15} />
                <span><strong>{t('banner.title')}</strong> {t('banner.body')}</span>
            </div>

            {/* Render Active Tab Content — re-check permission as a defense-in-depth gate */}
            {activeTab === 'master'       && hasPermission('inventory.master-catalog.products.view')     && renderMasterCatalog()}
            {activeTab === 'dept'         && hasPermission('inventory.master-catalog.departments.view')  && renderMasterDepartment()}
            {activeTab === 'category'     && hasPermission('inventory.master-catalog.categories.view')   && renderMasterCategory()}
            {activeTab === 'requests'     && hasPermission('inventory.master-catalog.requests.view')     && renderProductRequests()}
            {activeTab === 'duplication'  && hasPermission('inventory.master-catalog.duplication.view')  && renderDuplicationReview()}
            {activeTab === 'availability' && hasPermission('inventory.master-catalog.availability.view') && renderSupplierAvailability()}
            {activeTab === 'services'     && hasPermission('inventory.master-catalog.services.view')     && renderServices()}
            {activeTab === 'barcodes'     && hasPermission('inventory.master-catalog.barcodes.view')     && (
                <MasterCatalogBarcodeTab
                    locale={locale}
                    canGenerate={hasPermission('inventory.master-catalog.barcodes.generate')}
                />
            )}

            </>
            )}

            {/* Add Department MasterCatalogShell */}
            <AnimatePresence>
                {pageMode && route?.screen === 'dept-new' && (
                    <MasterCatalogShell
                        title={<div className="ui-modal-title"><LayoutGrid size={18} /> {t('modal.addDept')}</div>}
                        onClose={goBack}
                    >
                        <div className="ui-stack">
                            <div className="ui-field ui-col-6">
                                <label>{t('label.deptName')}</label>
                                <input
                                    className="ui-input" 
                                    type="text" 
                                    placeholder={t('ph.deptExample')} 
                                    value={newDept.name}
                                    onChange={(e) => setNewDept({ name: e.target.value })}
                                />
                            </div>
                            <div className="ui-form-foot">
                                <button className="ui-btn ui-btn--primary ui-btn--lg" onClick={handleCreateDepartment} disabled={saving || !isDepartmentFormValid}>
                                    {saving ? t('btn.saving') : t('btn.addDepartment')}
                                </button>
                                <button className="ui-btn ui-btn--default ui-btn--lg" onClick={goBack}>{t('btn.cancel')}</button>
                            </div>
                            {!isDepartmentFormValid && (
                                <p className="ui-help ui-help--err">{t('val.deptRequired')}</p>
                            )}
                        </div>
                    </MasterCatalogShell>
                )}
            </AnimatePresence>

            {/* Edit Department MasterCatalogShell */}
            <AnimatePresence>
                {pageMode && route?.screen === 'dept-edit' && editingDept && (
                    <MasterCatalogShell
                        title={<div className="ui-modal-title"><LayoutGrid size={18} /> {t('modal.editDept')}</div>}
                        onClose={goBack}
                    >
                        <div className="ui-stack">
                            <div className="ui-field ui-col-6">
                                <label>{t('label.deptName')}</label>
                                <input
                                    className="ui-input" 
                                    type="text" 
                                    placeholder={t('ph.deptExample')} 
                                    value={editingDept.name}
                                    onChange={(e) => setEditingDept({ ...editingDept, name: e.target.value })}
                                />
                            </div>
                            <div className="ui-form-foot">
                                <button className="ui-btn ui-btn--primary ui-btn--lg" onClick={handleUpdateDepartment} disabled={saving || !editingDept.name?.trim()}>
                                    {saving ? t('btn.saving') : t('btn.updateDepartment')}
                                </button>
                                <button className="ui-btn ui-btn--default ui-btn--lg" onClick={goBack}>{t('btn.cancel')}</button>
                            </div>
                        </div>
                    </MasterCatalogShell>
                )}
            </AnimatePresence>

            {/* Add Category */}
            <AnimatePresence>
                {pageMode && route?.screen === 'cat-new' && (
                    <MasterCatalogShell
                        title={<div className="ui-modal-title"><Tags size={18} /> {t('modal.addCat')}</div>}
                        onClose={goBack}
                    >
                        <div className="ui-stack">
                            <div className="ui-field ui-col-6">
                                <label>{t('label.selectDept')}</label>
                                <select className="ui-select"
                                        value={newCat.departmentId}
                                        onChange={(e) => setNewCat({ ...newCat, departmentId: e.target.value })}
                                    >
                                        <option value="">{t('label.selectDeptOpt')}</option>
                                        {departments.map((dept) => (
                                            <option key={dept.id} value={String(dept.id)}>{dept.name}</option>
                                        ))}
                        </select>
                            </div>
                            <div className="ui-field ui-col-6">
                                <label>{t('label.catType')}</label>
                                    <select className="ui-select" value={newCat.type} onChange={(e) => setNewCat({ ...newCat, type: e.target.value })}>
                                        <option value="product">{t('opt.product')}</option>
                                        <option value="service">{t('opt.service')}</option>
                        </select>
                            </div>
                            <div className="ui-field ui-col-6">
                                <label>{t('label.catName')}</label>
                                <input
                                    className="ui-input" 
                                    type="text" 
                                    placeholder={t('ph.catExample')} 
                                    value={newCat.name}
                                    onChange={(e) => setNewCat({ ...newCat, name: e.target.value })}
                                />
                            </div>
                            <div className="ui-form-foot">
                                <button className="ui-btn ui-btn--primary ui-btn--lg" onClick={handleCreateCategory} disabled={saving || !isCategoryFormValid}>
                                    {saving ? t('btn.saving') : t('btn.addCategory')}
                                </button>
                                <button className="ui-btn ui-btn--default ui-btn--lg" onClick={goBack}>{t('btn.cancel')}</button>
                            </div>
                            {!isCategoryFormValid && (
                                <p className="ui-help ui-help--err">
                                    {t('val.deptCatRequired')}
                                </p>
                            )}
                        </div>
                    </MasterCatalogShell>
                )}
            </AnimatePresence>

            {/* Edit Category MasterCatalogShell */}
            <AnimatePresence>
                {pageMode && route?.screen === 'cat-edit' && editingCat && (
                    <MasterCatalogShell
                        title={<div className="ui-modal-title"><Tags size={18} /> {t('modal.editCat')}</div>}
                        onClose={goBack}
                    >
                        <div className="ui-stack">
                            <div className="ui-field ui-col-6">
                                <label>{t('label.selectDept')}</label>
                                <div className="ui-cards">
                                    {departments.map(dept => (
                                        <button 
                                            key={dept.id} 
                                            className="ui-tile" aria-pressed={String(editingCat.departmentId) === String(dept.id)}
                                            onClick={() => setEditingCat({ ...editingCat, departmentId: String(dept.id) })}
                                        >
                                            {dept.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="ui-field ui-col-6">
                                <label>{t('label.catName')}</label>
                                <input
                                    className="ui-input" 
                                    type="text" 
                                    placeholder={t('ph.catExample')} 
                                    value={editingCat.name}
                                    onChange={(e) => setEditingCat({ ...editingCat, name: e.target.value })}
                                />
                            </div>
                            <div className="ui-field ui-col-6">
                                <label>{t('label.catType')}</label>
                                <select className="ui-select"
                                        value={editingCat.type || 'product'}
                                        onChange={(e) => setEditingCat({ ...editingCat, type: e.target.value })}
                                    >
                                        <option value="product">{t('opt.product')}</option>
                                        <option value="service">{t('opt.service')}</option>
                        </select>
                            </div>
                            <div className="ui-form-foot">
                                <button
                                    className="ui-btn ui-btn--primary ui-btn--lg"
                                    onClick={handleUpdateCategory}
                                    disabled={saving || !editingCat.name?.trim() || !editingCat.departmentId}
                                >
                                    {saving ? t('btn.saving') : t('btn.updateCategory')}
                                </button>
                                <button className="ui-btn ui-btn--default ui-btn--lg" onClick={goBack}>{t('btn.cancel')}</button>
                            </div>
                        </div>
                    </MasterCatalogShell>
                )}
            </AnimatePresence>

            {/* Add Service */}
            <AnimatePresence>
                {pageMode && route?.screen === 'service-new' && (
                    <MasterCatalogShell
                        title={<div className="ui-modal-title"><Settings size={18} /> {t('modal.addService')}</div>}
                        onClose={goBack}
                    >
                        <div className="ui-stack">
                            <div className="ui-field ui-col-6">
                                <label>{t('label.serviceName')}</label>
                                <input
                                    className="ui-input"
                                    type="text"
                                    placeholder={t('ph.serviceExample')}
                                    value={newService.name}
                                    onChange={(e) => setNewService((prev) => ({ ...prev, name: e.target.value }))}
                                />
                            </div>

                            <div className="ui-field ui-col-6">
                                <label>{t('label.arabicName')}</label>
                                <input
                                    className="ui-input"
                                    type="text"
                                    dir="rtl"
                                    placeholder={t('ph.arabic')}
                                    value={newService.arabicName}
                                    onChange={(e) => setNewService((prev) => ({ ...prev, arabicName: e.target.value }))}
                                />
                            </div>

                            <div className="ui-form-grid">
                                <div className="ui-field ui-col-6">
                                    <label>{t('label.department')}</label>
                                    <select className="ui-select"
                                            value={newService.departmentId}
                                            onChange={(e) =>
                                                setNewService((prev) => ({ ...prev, departmentId: e.target.value, categoryId: '' }))
                                            }
                                        >
                                            <option value="">{t('label.selectDeptOpt')}</option>
                                            {departments.map((d) => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
                        </select>
                                </div>
                                <div className="ui-field ui-col-6">
                                    <label>{t('label.category')}</label>
                                    <select className="ui-select"
                                            value={newService.categoryId}
                                            onChange={(e) => setNewService((prev) => ({ ...prev, categoryId: e.target.value }))}
                                            disabled={!newService.departmentId}
                                        >
                                            <option value="">{t('label.selectCategory')}</option>
                                            {selectedServiceCategories.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                        </select>
                                    {newService.departmentId && selectedServiceCategories.length === 0 && (
                                        <p className="ui-help ui-help--err">
                                            {t('hint.noServiceCats')}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="ui-form-grid">
                                <div className="ui-field ui-col-6">
                                    <label>{t('label.sku')}</label>
                                    <input
                                        type="text"
                                        placeholder={t('ph.skuService')}
                                        className="ui-input"
                                        value={newService.sku}
                                        onChange={(e) => setNewService((prev) => ({ ...prev, sku: e.target.value }))}
                                    />
                                </div>
                                <div className="ui-field ui-col-6">
                                    <label>{t('label.unit')}</label>
                                    <select className="ui-select"
                                            value={newService.unitOfMeasurement}
                                            onChange={(e) => setNewService((prev) => ({ ...prev, unitOfMeasurement: e.target.value }))}
                                        >
                                            <option value="ea">{t('opt.each')}</option>
                                            <option value="pcs">{t('opt.pcs')}</option>
                                            <option value="service">{t('opt.serviceUnit')}</option>
                        </select>
                                </div>
                            </div>

                            <div className="ui-form-grid">
                                <div className="ui-field ui-col-6">
                                    <label>{t('label.salePrice')}</label>
                                    <input
                                        className="ui-input"
                                        {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                        placeholder={t('ph.price')}
                                        value={newService.sellingPrice}
                                        onChange={(e) =>
                                            setNewService((prev) => ({
                                                ...prev,
                                                sellingPrice: sanitizeNonNegativeMoneyInput(e.target.value),
                                            }))
                                        }
                                    />
                                </div>
                                <div className="ui-field ui-col-6">
                                    <label>{t('label.serviceCost')}</label>
                                    <input
                                        className="ui-input"
                                        {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                        placeholder="0"
                                        value={newService.serviceCost}
                                        onChange={(e) =>
                                            setNewService((prev) => ({
                                                ...prev,
                                                serviceCost: sanitizeNonNegativeMoneyInput(e.target.value),
                                            }))
                                        }
                                    />
                                </div>
                            </div>

                            <div className="ui-form-grid">
                                <div className="ui-field ui-col-6">
                                    <label>{t('label.minCorp')}</label>
                                    <input
                                        className="ui-input"
                                        {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                        placeholder={t('ph.price')}
                                        value={newService.minPriceCorporate}
                                        onChange={(e) =>
                                            setNewService((prev) => ({
                                                ...prev,
                                                minPriceCorporate: sanitizeNonNegativeMoneyInput(e.target.value),
                                            }))
                                        }
                                    />
                                </div>
                                <div className="ui-field ui-col-6">
                                    <label>{t('label.maxCorp')}</label>
                                    <input
                                        className="ui-input"
                                        {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                        placeholder={t('ph.price')}
                                        value={newService.maxPriceCorporate}
                                        onChange={(e) =>
                                            setNewService((prev) => ({
                                                ...prev,
                                                maxPriceCorporate: sanitizeNonNegativeMoneyInput(e.target.value),
                                            }))
                                        }
                                    />
                                </div>
                            </div>

                            <div className="ui-field ui-col-6">
                                <label>{t('label.description')}</label>
                                <input
                                    className="ui-input"
                                    type="text"
                                    placeholder={t('ph.description')}
                                    value={newService.description}
                                    onChange={(e) => setNewService((prev) => ({ ...prev, description: e.target.value }))}
                                />
                            </div>

                            <div className="ui-setting-head ui-setting-head--boxed ui-col-6">
                                <div className="ui-setting-text">
                                    <span className="ui-setting-name">{t('toggle.allowCashierPrice')}</span>
                                    <span className="ui-help">{t('toggle.allowCashierPriceHint')}</span>
                                </div>
                                <label className="ui-switch">
                                    <input
                                        type="checkbox"
                                        checked={newService.isPriceEditable}
                                        onChange={(e) => setNewService((prev) => ({ ...prev, isPriceEditable: e.target.checked }))}
                                    />
                                    <span className="ui-switch-track" />
                                </label>
                            </div>

                            <div className="ui-setting-head ui-setting-head--boxed ui-col-6">
                                <div className="ui-setting-text">
                                    <span className="ui-setting-name">{t('toggle.allowServiceQty')}</span>
                                    <span className="ui-help">{t('toggle.allowServiceQtyHint')}</span>
                                </div>
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={!!newService.serviceQtyEnabled}
                                        onChange={(e) =>
                                            setNewService((prev) => ({
                                                ...prev,
                                                serviceQtyEnabled: e.target.checked,
                                            }))
                                        }
                                    />
                                </label>
                            </div>

                            <div className="ui-setting-head ui-setting-head--boxed ui-col-6">
                                <div className="ui-setting-text">
                                    <span className="ui-setting-name">{t('toggle.activeStatus')}</span>
                                    <span className="ui-help">{t('toggle.activeStatusHint')}</span>
                                </div>
                                <span className="ui-switch-track" data-on={true} />
                            </div>

                            <div className="ui-banner ui-banner--info">
                                <ShieldCheck size={14} /> {t('banner.servicesApproved')}
                            </div>

                            <div className="ui-form-foot">
                                <button
                                    className="ui-btn ui-btn--primary ui-btn--lg"
                                    style={{ flex: 4 }}
                                    onClick={handleCreateCatalogService}
                                    disabled={saving || !isServiceFormValid}
                                >
                                    {saving ? t('btn.saving') : t('btn.addToMaster')}
                                </button>
                                <button className="ui-btn ui-btn--default ui-btn--lg" style={{ flex: 1 }} onClick={goBack}>{t('btn.cancel')}</button>
                            </div>
                            {!isServiceFormValid && (
                                <p className="ui-help ui-help--err">
                                    {t('val.serviceRequired')}
                                </p>
                            )}
                        </div>
                    </MasterCatalogShell>
                )}
            </AnimatePresence>

            {/* Edit Service MasterCatalogShell */}
            <AnimatePresence>
                {pageMode && route?.screen === 'service-edit' && editingService && (
                    <MasterCatalogShell
                        title={<div className="ui-modal-title"><Settings size={18} /> {t('modal.editService')}</div>}
                        onClose={() => {
                            if (saving) return;
                            goBack();
                            setEditingService(null);
                        }}
                    >
                        <div className="ui-stack">
                            <div className="ui-field ui-col-6">
                                <label>{t('label.serviceName')}</label>
                                <input
                                    className="ui-input"
                                    type="text"
                                    value={editingService.name}
                                    onChange={(e) => setEditingService((prev) => ({ ...prev, name: e.target.value }))}
                                />
                            </div>

                            <div className="ui-field ui-col-6">
                                <label>{t('label.arabicName')}</label>
                                <input
                                    className="ui-input"
                                    type="text"
                                    dir="rtl"
                                    placeholder={t('ph.arabic')}
                                    value={editingService.arabicName ?? ''}
                                    onChange={(e) => setEditingService((prev) => ({ ...prev, arabicName: e.target.value }))}
                                />
                            </div>

                            <div className="ui-form-grid">
                                <div className="ui-field ui-col-6">
                                    <label>{t('label.sku')}</label>
                                    <input
                                        className="ui-input"
                                        type="text"
                                        value={editingService.sku}
                                        onChange={(e) => setEditingService((prev) => ({ ...prev, sku: e.target.value }))}
                                    />
                                </div>
                                <div className="ui-field ui-col-6">
                                    <label>{t('label.sellingPrice')}</label>
                                    <input
                                        className="ui-input"
                                        {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                        placeholder={t('ph.priceNull')}
                                        value={editingService.sellingPrice}
                                        onChange={(e) =>
                                            setEditingService((prev) => ({
                                                ...prev,
                                                sellingPrice: sanitizeNonNegativeMoneyInput(e.target.value),
                                            }))
                                        }
                                    />
                                </div>
                            </div>

                            <div className="ui-form-grid">
                                <div className="ui-field ui-col-6">
                                    <label>{t('label.serviceCost')}</label>
                                    <input
                                        className="ui-input"
                                        {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                        placeholder="0"
                                        value={editingService.serviceCost ?? '0'}
                                        onChange={(e) =>
                                            setEditingService((prev) => ({
                                                ...prev,
                                                serviceCost: sanitizeNonNegativeMoneyInput(e.target.value),
                                            }))
                                        }
                                    />
                                </div>
                            </div>

                            <div className="ui-form-grid">
                                <div className="ui-field ui-col-6">
                                    <label>{t('label.minCorp')}</label>
                                    <input
                                        className="ui-input"
                                        {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                        placeholder={t('ph.price')}
                                        value={editingService.minPriceCorporate ?? ''}
                                        onChange={(e) =>
                                            setEditingService((prev) => ({
                                                ...prev,
                                                minPriceCorporate: sanitizeNonNegativeMoneyInput(e.target.value),
                                            }))
                                        }
                                    />
                                </div>
                                <div className="ui-field ui-col-6">
                                    <label>{t('label.maxCorp')}</label>
                                    <input
                                        className="ui-input"
                                        {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                        placeholder={t('ph.price')}
                                        value={editingService.maxPriceCorporate ?? ''}
                                        onChange={(e) =>
                                            setEditingService((prev) => ({
                                                ...prev,
                                                maxPriceCorporate: sanitizeNonNegativeMoneyInput(e.target.value),
                                            }))
                                        }
                                    />
                                </div>
                            </div>

                            <div className="ui-field ui-col-6">
                                <label>{t('label.description')}</label>
                                <input
                                    className="ui-input"
                                    type="text"
                                    value={editingService.description}
                                    onChange={(e) => setEditingService((prev) => ({ ...prev, description: e.target.value }))}
                                />
                            </div>

                            <div className="ui-field ui-col-6">
                                <label>{t('label.category')}</label>
                                <input
                                    className="ui-input"
                                    type="text"
                                    readOnly
                                    disabled
                                    value={
                                        editingService.categoryName?.trim()
                                            ? editingService.categoryName
                                            : editingService.categoryId
                                              ? t('catId.fallback', { id: editingService.categoryId })
                                              : '—'
                                    }
                                />
                            </div>

                            <div className="ui-form-grid">
                                <div className="ui-field ui-col-6">
                                    <label>{t('label.vatMode')}</label>
                                    <input
                                        className="ui-input"
                                        type="text"
                                        readOnly
                                        disabled
                                        value={String(editingService.vatMode ?? editingService.vat_mode ?? '') || '—'}
                                    />
                                </div>
                                <div className="ui-field ui-col-6">
                                    <label>{t('label.created')}</label>
                                    <input
                                        className="ui-input"
                                        type="text"
                                        readOnly
                                        disabled
                                        value={
                                            formatCatalogCreatedAt(
                                                editingService.createdAt ?? editingService.created_at,
                                            ) || '—'
                                        }
                                    />
                                </div>
                            </div>

                            <div className="ui-form-grid">
                                <div className="ui-setting-head ui-setting-head--boxed ui-col-6">
                                    <div className="ui-setting-text">
                                        <span className="ui-setting-name">{t('toggle.serviceStatus')}</span>
                                        <span className="ui-help">{editingService.isActive ? t('status.active') : t('status.inactive')}</span>
                                    </div>
                                    <div
                                        className="ui-switch-track" data-on={editingService.isActive}
                                        role="button"
                                        aria-label={t('toggle.ariaServiceActive')}
                                        aria-pressed={!!editingService.isActive}
                                        onClick={() =>
                                            setEditingService((prev) => ({ ...prev, isActive: !prev.isActive }))
                                        }
                                    />
                                </div>
                                <div className="ui-setting-head ui-setting-head--boxed ui-col-6">
                                    <div className="ui-setting-text">
                                        <span className="ui-setting-name">{t('toggle.priceEditable')}</span>
                                        <span className="ui-help">{editingService.isPriceEditable ? t('toggle.editableCashier') : t('toggle.fixedPrice')}</span>
                                    </div>
                                    <div
                                        className="ui-switch-track" data-on={editingService.isPriceEditable}
                                        role="button"
                                        aria-label={t('toggle.ariaPriceEditable')}
                                        aria-pressed={!!editingService.isPriceEditable}
                                        onClick={() =>
                                            setEditingService((prev) => ({
                                                ...prev,
                                                isPriceEditable: !prev.isPriceEditable,
                                            }))
                                        }
                                    />
                                </div>
                            </div>

                            <div className="ui-setting-head ui-setting-head--boxed" style={{ marginTop: 12 }}>
                                <div className="ui-setting-text">
                                    <span className="ui-setting-name">{t('toggle.allowServiceQty')}</span>
                                    <span className="ui-help">
                                        {editingService.serviceQtyEnabled
                                            ? t('toggle.qtyOnHint')
                                            : t('toggle.qtyOffHint')}
                                    </span>
                                </div>
                                <div
                                    className="ui-switch-track" data-on={editingService.serviceQtyEnabled}
                                    role="button"
                                    aria-label={t('toggle.ariaServiceQty')}
                                    aria-pressed={!!editingService.serviceQtyEnabled}
                                    onClick={() =>
                                        setEditingService((prev) => ({
                                            ...prev,
                                            serviceQtyEnabled: !prev.serviceQtyEnabled,
                                        }))
                                    }
                                />
                            </div>

                            <div className="ui-form-foot">
                                <button className="ui-btn ui-btn--default ui-btn--lg" onClick={handleDeleteCatalogService} disabled={saving}>
                                    {t('btn.delete')}
                                </button>
                                <button
                                    className="ui-btn ui-btn--default ui-btn--lg"
                                    onClick={() => {
                                        goBack();
                                        setEditingService(null);
                                    }}
                                >
                                    {t('btn.cancel')}
                                </button>
                                <button className="ui-btn ui-btn--primary ui-btn--lg" onClick={handleUpdateCatalogService} disabled={saving}>
                                    {saving ? t('btn.saving') : t('btn.updateService')}
                                </button>
                            </div>
                        </div>
                    </MasterCatalogShell>
                )}
            </AnimatePresence>

            {/* Edit Product MasterCatalogShell */}
            <AnimatePresence>
                {pageMode && route?.screen === 'product-edit' && editingProduct && (
                    <MasterCatalogShell
                        title={<div className="ui-modal-title"><ShieldCheck size={18} /> {t('modal.editProduct')}</div>}
                        onClose={goBack}
                    >
                        <div className="ui-banner ui-banner--info">
                            {t('banner.productsApproved')}
                        </div>
                        
                        <div className="ui-stack">
                            <div className="ui-field ui-col-6">
                                <label>{t('label.productName')}</label>
                                <input
                                    className="ui-input" 
                                    type="text" 
                                    value={editingProduct.name} 
                                    onChange={(e) => setEditingProduct({...editingProduct, name: e.target.value})}
                                />
                            </div>

                            <div className="ui-field ui-col-6">
                                <label>{t('label.arabicName')}</label>
                                <input
                                    className="ui-input"
                                    type="text"
                                    dir="rtl"
                                    placeholder={t('ph.arabic')}
                                    value={editingProduct.arabicName ?? ''}
                                    onChange={(e) => setEditingProduct({ ...editingProduct, arabicName: e.target.value })}
                                />
                            </div>

                            <div className="ui-form-grid">
                                <div className="ui-field ui-col-6">
                                    <label>{t('label.sku')}</label>
                                    <input
                                        className="ui-input" 
                                        type="text" 
                                        value={editingProduct.sku || editingProduct.name} 
                                        onChange={(e) => setEditingProduct({...editingProduct, sku: e.target.value})}
                                    />
                                </div>
                                <div className="ui-field ui-col-6">
                                    <label>{t('label.brand')}</label>
                                    <input
                                        className="ui-input" 
                                        type="text" 
                                        placeholder={t('ph.brand')}
                                        value={editingProduct.brand || ''} 
                                        onChange={(e) => setEditingProduct({...editingProduct, brand: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="ui-field ui-col-6">
                                <label>{t('label.department')}</label>
                                <input
                                    className="ui-input"
                                    type="text"
                                    readOnly
                                    disabled
                                    value={
                                        departments.find((d) => String(d.id) === String(editingProduct.departmentId))
                                            ?.name ||
                                        editingProduct.departmentName ||
                                        '—'
                                    }
                                />
                            </div>

                            <div className="ui-field ui-col-6">
                                <label>{t('label.categoryReq')}</label>
                                <select className="ui-select"
                                        value={editingProduct.categoryId ?? ''}
                                        onChange={(e) =>
                                            setEditingProduct({ ...editingProduct, categoryId: e.target.value })
                                        }
                                        disabled={editModalProductCategories.length === 0}
                                    >
                                        <option value="">{t('label.selectCategory')}</option>
                                        {editModalProductCategories.map((cat) => (
                                            <option key={cat.id} value={String(cat.id)}>
                                                {cat.name}
                                            </option>
                                        ))}
                        </select>
                                {editingProduct.departmentId && editModalProductCategories.length === 0 && (
                                    <p className="ui-help ui-help--err">
                                        {t('hint.noProductCats')}
                                    </p>
                                )}
                            </div>

                            <CatalogUomFields
                                idPrefix="mc-edit-uom"
                                t={t}
                                value={{
                                    warehouseUnit: editingProduct.warehouseUnit,
                                    workshopUnit: editingProduct.workshopUnit,
                                    conversionFactor: editingProduct.conversionFactor,
                                }}
                                onChange={(uom) =>
                                    setEditingProduct((prev) => ({ ...prev, ...uom }))
                                }
                            />

                            <div className="ui-form-grid">
                                <div className="ui-field ui-col-6">
                                    <label>{t('label.type')}</label>
                                        <select className="ui-select" 
                                            value={editingProduct.type} 
                                            onChange={(e) => setEditingProduct({...editingProduct, type: e.target.value})}
                                        >
                                            <option value="Product">{t('opt.product')}</option>
                                            <option value="Service">{t('opt.service')}</option>
                        </select>
                                </div>
                            </div>

                            <div className="ui-form-grid">
                                <div className="ui-field ui-col-6">
                                    <label>{t('label.salePrice')}</label>
                                    <input
                                        className="ui-input" 
                                        {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                        value={editingProduct.salePrice} 
                                        onChange={(e) => setEditingProduct({...editingProduct, salePrice: sanitizeNonNegativeMoneyInput(e.target.value)})}
                                    />
                                </div>
                                <div className="ui-field ui-col-6">
                                    <label>{t('label.purchasePrice')}</label>
                                    <input
                                        className="ui-input" 
                                        {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                        value={editingProduct.purchasePrice || ''} 
                                        onChange={(e) => setEditingProduct({...editingProduct, purchasePrice: sanitizeNonNegativeMoneyInput(e.target.value)})}
                                    />
                                </div>
                            </div>

                            <div className="ui-form-grid">
                                <div className="ui-field ui-col-6">
                                    <label>{t('label.minCorp')}</label>
                                    <input
                                        className="ui-input" 
                                        {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                        placeholder={t('ph.price')}
                                        value={editingProduct.minCorpPrice || ''} 
                                        onChange={(e) => setEditingProduct({...editingProduct, minCorpPrice: sanitizeNonNegativeMoneyInput(e.target.value)})}
                                    />
                                </div>
                                <div className="ui-field ui-col-6">
                                    <label>{t('label.maxCorp')}</label>
                                    <input
                                        className="ui-input" 
                                        {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                        placeholder={t('ph.price')}
                                        value={editingProduct.maxCorpPrice || ''} 
                                        onChange={(e) => setEditingProduct({...editingProduct, maxCorpPrice: sanitizeNonNegativeMoneyInput(e.target.value)})}
                                    />
                                </div>
                            </div>

                            <div className="ui-field ui-col-6">
                                <label>{t('label.kmType')}</label>
                                <input
                                    className="ui-input"
                                    type="number"
                                    placeholder={t('ph.kmEmpty')}
                                    value={editingProduct.kmTypeValue ?? ''}
                                    onChange={(e) =>
                                        setEditingProduct({ ...editingProduct, kmTypeValue: e.target.value })
                                    }
                                />
                            </div>

                            <div className="ui-field ui-col-6">
                                <label>{t('label.description')}</label>
                                <input
                                    className="ui-input" 
                                    type="text" 
                                    placeholder={t('ph.description')} 
                                    value={editingProduct.description || ''} 
                                    onChange={(e) => setEditingProduct({...editingProduct, description: e.target.value})}
                                />
                            </div>

                            <div className="ui-form-grid">
                                <div className="ui-setting-head ui-setting-head--boxed ui-col-6">
                                    <div className="ui-setting-text">
                                        <span className="ui-setting-name">{t('toggle.productStatus')}</span>
                                        <span className="ui-help">{editingProduct.isActive !== false ? t('status.active') : t('status.inactive')}</span>
                                    </div>
                                    <div
                                        className="ui-switch-track" data-on={editingProduct.isActive !== false}
                                        role="button"
                                        aria-label={t('toggle.ariaProductActive')}
                                        aria-pressed={editingProduct.isActive !== false}
                                        onClick={() =>
                                            setEditingProduct((prev) => ({
                                                ...prev,
                                                isActive: !toBoolActive(prev),
                                            }))
                                        }
                                    />
                                </div>
                            </div>

                            <div
                                className="ui-setting-head ui-setting-head--boxed"
                                role="button"
                                tabIndex={0}
                                onClick={() =>
                                    setEditingProduct((prev) => ({
                                        ...prev,
                                        isPriceEditable: !prev.isPriceEditable,
                                        minPriceEditable: !prev.isPriceEditable ? prev.minPriceEditable : '',
                                    }))
                                }
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setEditingProduct((prev) => ({
                                            ...prev,
                                            isPriceEditable: !prev.isPriceEditable,
                                            minPriceEditable: !prev.isPriceEditable ? prev.minPriceEditable : '',
                                        }));
                                    }
                                }}
                            >
                                <div>
                                    <strong>{t('toggle.priceEditablePos')}</strong>
                                    <span>{editingProduct.isPriceEditable ? t('toggle.customPrice') : t('toggle.fixedCatalog')}</span>
                                </div>
                                <div
                                    className="ui-switch-track" data-on={editingProduct.isPriceEditable}
                                    aria-hidden
                                />
                            </div>

                            {editingProduct.isPriceEditable && (
                                <div className="ui-field ui-col-6">
                                    <label>{t('label.minEditable')}</label>
                                    <input
                                        className="ui-input"
                                        {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                        placeholder={t('ph.price')}
                                        value={editingProduct.minPriceEditable ?? ''}
                                        onChange={(e) =>
                                            setEditingProduct({
                                                ...editingProduct,
                                                minPriceEditable: sanitizeNonNegativeMoneyInput(e.target.value),
                                            })
                                        }
                                    />
                                </div>
                            )}

                            <div
                                className="ui-setting-head ui-setting-head--boxed"
                                role="button"
                                tabIndex={0}
                                onClick={() =>
                                    setEditingProduct((prev) => ({
                                        ...prev,
                                        allowDecimalQty: !prev.allowDecimalQty,
                                    }))
                                }
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setEditingProduct((prev) => ({
                                            ...prev,
                                            allowDecimalQty: !prev.allowDecimalQty,
                                        }));
                                    }
                                }}
                            >
                                <div>
                                    <strong>{t('toggle.decimalQty')}</strong>
                                    <span>{t('toggle.decimalQtyHint')}</span>
                                </div>
                                <div
                                    className="ui-switch-track" data-on={editingProduct.allowDecimalQty}
                                    aria-hidden
                                />
                            </div>

                            <div
                                className="ui-setting-head ui-setting-head--boxed"
                                role="button"
                                tabIndex={0}
                                onClick={() =>
                                    setEditingProduct((prev) => ({
                                        ...prev,
                                        allowMinusQty: !prev.allowMinusQty,
                                    }))
                                }
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setEditingProduct((prev) => ({
                                            ...prev,
                                            allowMinusQty: !prev.allowMinusQty,
                                        }));
                                    }
                                }}
                            >
                                <div>
                                    <strong>{t('toggle.minusQty')}</strong>
                                    <span>{t('toggle.minusQtyHint')}</span>
                                </div>
                                <div
                                    className="ui-switch-track" data-on={editingProduct.allowMinusQty}
                                    aria-hidden
                                />
                            </div>

                            <div className="ui-form-foot">
                                <button className="ui-btn ui-btn--default ui-btn--lg" onClick={handleDeleteCatalogProduct} disabled={saving}>
                                    {t('btn.delete')}
                                </button>
                                <button className="ui-btn ui-btn--primary ui-btn--lg" onClick={handleUpdateCatalogProduct} disabled={saving}>
                                    {saving ? t('btn.saving') : t('btn.updateProduct')}
                                </button>
                                <button className="ui-btn ui-btn--default ui-btn--lg" onClick={goBack}>{t('btn.cancel')}</button>
                            </div>
                        </div>
                    </MasterCatalogShell>
                )}
            </AnimatePresence>

            {/* Add Product */}
            <AnimatePresence>
                {pageMode && route?.screen === 'product-new' && (
                    <MasterCatalogShell
                        title={<div className="ui-modal-title"><CheckCircle2 size={18} /> {t('modal.addProduct')}</div>}
                        onClose={goBack}
                    >
                        <div className="ui-banner ui-banner--info">
                            {t('banner.productsApproved')}
                        </div>
                        
                        <div className="ui-stack">
                            <div className="ui-field ui-col-6">
                                <label>{t('label.productName')}</label>
                                <input
                                    className="ui-input"
                                    type="text"
                                    placeholder={t('ph.productExample')}
                                    value={newProduct.name}
                                    onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                                />
                            </div>

                            <div className="ui-field ui-col-6">
                                <label>{t('label.arabicName')}</label>
                                <input
                                    className="ui-input"
                                    type="text"
                                    dir="rtl"
                                    placeholder={t('ph.arabic')}
                                    value={newProduct.arabicName}
                                    onChange={(e) => setNewProduct({ ...newProduct, arabicName: e.target.value })}
                                />
                            </div>

                            <div className="ui-form-grid">
                                <div className="ui-field ui-col-6">
                                    <label>{t('label.sku')}</label>
                                    <input
                                        className="ui-input" 
                                        type="text" 
                                        placeholder={t('ph.skuProduct')} 
                                        value={newProduct.sku}
                                        onChange={(e) => setNewProduct({...newProduct, sku: e.target.value})}
                                    />
                                </div>
                                <div className="ui-field ui-col-6">
                                    <label>{t('label.brand')}</label>
                                    <input
                                        className="ui-input" 
                                        type="text" 
                                        placeholder={t('ph.brand')} 
                                        value={newProduct.brand}
                                        onChange={(e) => setNewProduct({...newProduct, brand: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="ui-field ui-col-6">
                                <label>{t('label.department')}</label>
                                <select className="ui-select"
                                        value={newProduct.departmentId}
                                        onChange={(e) => setNewProduct({ ...newProduct, departmentId: e.target.value, categoryId: '' })}
                                    >
                                        <option value="">{t('label.selectDeptOpt')}</option>
                                        {departments.map((dept) => (
                                            <option key={dept.id} value={String(dept.id)}>{dept.name}</option>
                                        ))}
                        </select>
                            </div>

                            <div className="ui-field ui-col-6">
                                <label>{t('label.category')}</label>
                                    <select className="ui-select" 
                                        value={newProduct.categoryId}
                                        onChange={(e) => setNewProduct({...newProduct, categoryId: e.target.value})}
                                        disabled={!newProduct.departmentId}
                                    >
                                        <option value="">{t('label.selectCategory')}</option>
                                        {selectedProductCategories.map(cat => (
                                            <option key={cat.id} value={String(cat.id)}>{cat.name}</option>
                                        ))}
                        </select>
                                {newProduct.departmentId && selectedProductCategories.length === 0 && (
                                    <p className="ui-help ui-help--err">
                                        {t('hint.noProductCats')}
                                    </p>
                                )}
                            </div>

                            <CatalogUomFields
                                idPrefix="mc-new-uom"
                                t={t}
                                value={{
                                    warehouseUnit: newProduct.warehouseUnit,
                                    workshopUnit: newProduct.workshopUnit,
                                    conversionFactor: newProduct.conversionFactor,
                                }}
                                onChange={(uom) =>
                                    setNewProduct((prev) => ({ ...prev, ...uom }))
                                }
                            />

                            <div className="ui-form-grid">
                                <div className="ui-field ui-col-6">
                                    <label>{t('label.type')}</label>
                                        <select className="ui-select">
                                            <option value="Product">{t('opt.product')}</option>
                                            <option value="Service">{t('opt.service')}</option>
                        </select>
                                </div>
                            </div>

                            <div className="ui-form-grid">
                                <div className="ui-field ui-col-6">
                                    <label>{t('label.salePrice')}</label>
                                    <input
                                        className="ui-input"
                                        {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                        placeholder={t('ph.price')}
                                        value={newProduct.salePrice}
                                        onChange={(e) => setNewProduct({...newProduct, salePrice: sanitizeNonNegativeMoneyInput(e.target.value)})}
                                    />
                                </div>
                                <div className="ui-field ui-col-6">
                                    <label>{t('label.purchasePrice')}</label>
                                    <input
                                        className="ui-input"
                                        {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                        placeholder={t('ph.price')}
                                        value={newProduct.purchasePrice}
                                        onChange={(e) => setNewProduct({...newProduct, purchasePrice: sanitizeNonNegativeMoneyInput(e.target.value)})}
                                    />
                                </div>
                            </div>

                            <div className="ui-form-grid">
                                <div className="ui-field ui-col-6">
                                    <label>{t('label.minCorp')}</label>
                                    <input
                                        className="ui-input"
                                        {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                        placeholder={t('ph.price')}
                                        value={newProduct.minCorpPrice || ''}
                                        onChange={(e) => setNewProduct({...newProduct, minCorpPrice: sanitizeNonNegativeMoneyInput(e.target.value)})}
                                    />
                                </div>
                                <div className="ui-field ui-col-6">
                                    <label>{t('label.maxCorp')}</label>
                                    <input
                                        className="ui-input"
                                        {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                        placeholder={t('ph.price')}
                                        value={newProduct.maxCorpPrice || ''}
                                        onChange={(e) => setNewProduct({...newProduct, maxCorpPrice: sanitizeNonNegativeMoneyInput(e.target.value)})}
                                    />
                                </div>
                            </div>

                            <div className="ui-field ui-col-6">
                                <label>{t('label.kmType')}</label>
                                <input
                                    className="ui-input"
                                    type="number"
                                    placeholder={t('ph.kmEmpty')}
                                    value={newProduct.kmTypeValue ?? ''}
                                    onChange={(e) => setNewProduct({ ...newProduct, kmTypeValue: e.target.value })}
                                />
                            </div>

                            <div className="ui-field ui-col-6">
                                <label>{t('label.description')}</label>
                                <input
                                    className="ui-input"
                                    type="text"
                                    placeholder={t('ph.description')}
                                    value={newProduct.description}
                                    onChange={(e) => setNewProduct({...newProduct, description: e.target.value})}
                                />
                            </div>

                            <div className="ui-setting-head ui-setting-head--boxed ui-col-6">
                                <div className="ui-setting-text">
                                    <span className="ui-setting-name">{t('toggle.allowCashierPrice')}</span>
                                    <span className="ui-help">{t('toggle.allowCashierPriceHint')}</span>
                                </div>
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={!!newProduct.isPriceEditable}
                                        onChange={(e) =>
                                            setNewProduct((prev) => ({
                                                ...prev,
                                                isPriceEditable: e.target.checked,
                                                minPriceEditable: e.target.checked ? prev.minPriceEditable : '',
                                            }))
                                        }
                                    />
                                </label>
                            </div>

                            {newProduct.isPriceEditable && (
                                <div className="ui-field ui-col-6">
                                    <label>{t('label.minEditable')}</label>
                                    <input
                                        className="ui-input"
                                        {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                        placeholder={t('ph.price')}
                                        value={newProduct.minPriceEditable ?? ''}
                                        onChange={(e) =>
                                            setNewProduct({
                                                ...newProduct,
                                                minPriceEditable: sanitizeNonNegativeMoneyInput(e.target.value),
                                            })
                                        }
                                    />
                                </div>
                            )}

                            <div
                                className="ui-setting-head ui-setting-head--boxed"
                                role="button"
                                tabIndex={0}
                                onClick={() =>
                                    setNewProduct((prev) => ({
                                        ...prev,
                                        allowDecimalQty: !prev.allowDecimalQty,
                                    }))
                                }
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setNewProduct((prev) => ({
                                            ...prev,
                                            allowDecimalQty: !prev.allowDecimalQty,
                                        }));
                                    }
                                }}
                            >
                                <div>
                                    <strong>{t('toggle.decimalQty')}</strong>
                                    <span>{t('toggle.decimalQtyHint')}</span>
                                </div>
                                <div
                                    className="ui-switch-track" data-on={newProduct.allowDecimalQty}
                                    aria-hidden
                                />
                            </div>

                            <div
                                className="ui-setting-head ui-setting-head--boxed"
                                role="button"
                                tabIndex={0}
                                onClick={() =>
                                    setNewProduct((prev) => ({
                                        ...prev,
                                        allowMinusQty: !prev.allowMinusQty,
                                    }))
                                }
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setNewProduct((prev) => ({
                                            ...prev,
                                            allowMinusQty: !prev.allowMinusQty,
                                        }));
                                    }
                                }}
                            >
                                <div>
                                    <strong>{t('toggle.minusQty')}</strong>
                                    <span>{t('toggle.minusQtyHint')}</span>
                                </div>
                                <div
                                    className="ui-switch-track" data-on={newProduct.allowMinusQty}
                                    aria-hidden
                                />
                            </div>

                            <div className="ui-form-foot">
                                <button className="ui-btn ui-btn--primary ui-btn--lg" onClick={handleCreateProduct} disabled={saving || !isProductFormValid}>
                                    {saving ? t('btn.saving') : t('btn.addToMaster')}
                                </button>
                                <button className="ui-btn ui-btn--default ui-btn--lg" onClick={goBack}>{t('btn.cancel')}</button>
                            </div>
                            {!isProductFormValid && (
                                <p className="ui-help ui-help--err">
                                    {t('val.productRequired')}
                                </p>
                            )}
                        </div>
                    </MasterCatalogShell>
                )}
            </AnimatePresence>

            {/* Bulk Upload Products */}
            <AnimatePresence>
                {pageMode && route?.screen === 'product-import' && (
                    <MasterCatalogShell
                        title={<div className="ui-modal-title"><Upload size={18} /> {t('modal.bulkProducts')}</div>}
                        onClose={closeBulkProductModal}
                    >
                        <div className="ui-subgroup ui-subgroup--card">
                            <div className="ui-subsection-head">
                                <Box size={18} />
                                <strong>{t('bulk.uploadFormat')}</strong>
                            </div>
                            <p>{t('bulk.productIntro')}</p>
                            <div className="ui-bullets">
                                <span>{t('bulk.productCols', { cols: PRODUCT_CSV_COLUMNS.join(', ') })}</span>
                                <span>{t('bulk.productDeptHint')}</span>
                                <span>{t('bulk.productDupHint')}</span>
                            </div>
                        </div>

                        <a className="ui-btn ui-btn--default" href={productsCsvTemplate} download="master-catalog-products-template.csv">
                            <Download size={18} /> {t('btn.downloadTemplate')}
                        </a>

                        <label className="ui-dropzone" htmlFor="bulk-csv-upload-input">
                            <Layers size={24} />
                            <span>{selectedBulkFile ? selectedBulkFile.name : t('btn.chooseCsv')}</span>
                            <input
                                ref={bulkFileInputRef}
                                id="bulk-csv-upload-input"
                                type="file"
                                accept=".csv,text/csv"
                                onChange={handleBulkFileChange}
                                style={{ display: 'none' }}
                            />
                        </label>

                        {bulkImportResult && (() => {
                            const payload = getCsvImportPayload(bulkImportResult);
                            const summary = formatCsvImportSummary(bulkImportResult, t);
                            const vat = payload?.vatWarnings;
                            const rows = payload?.rowDetails;
                            const hasVat = Array.isArray(vat) && vat.length > 0;
                            const hasRows = Array.isArray(rows) && rows.length > 0;
                            const knownShape = isProductCsvImportShape(payload);
                            return (
                                <div className="ui-stack-sm">
                                    {summary ? <p className="ui-banner ui-banner--ok">{summary}</p> : null}
                                    {hasVat && (
                                        <details className="ui-bullets">
                                            <summary>{t('bulk.vatWarnings')}</summary>
                                            <ul>
                                                {vat.slice(0, 100).map((w, i) => (
                                                    <li key={i}>{formatVatWarningItem(w)}</li>
                                                ))}
                                            </ul>
                                        </details>
                                    )}
                                    {hasRows && (
                                        <details className="ui-bullets">
                                            <summary>{t('bulk.skippedRows')}</summary>
                                            <ul>
                                                {rows.slice(0, 500).map((row, i) => (
                                                    <li key={i}>{formatRowDetailItem(row)}</li>
                                                ))}
                                            </ul>
                                        </details>
                                    )}
                                    {!knownShape && !hasVat && !hasRows && (
                                        <pre className="ui-pre">{JSON.stringify(bulkImportResult, null, 2)}</pre>
                                    )}
                                </div>
                            );
                        })()}

                        <div className="ui-form-foot">
                            <button type="button" className="ui-btn ui-btn--default ui-btn--lg" onClick={closeBulkProductModal} disabled={bulkImporting}>
                                {t('btn.cancel')}
                            </button>
                            <button
                                className="ui-btn ui-btn--primary ui-btn--lg"
                                type="button"
                                disabled={!selectedBulkFile || bulkImporting}
                                onClick={handleBulkImport}
                            >
                                {bulkImporting ? t('btn.importing') : selectedBulkFile ? t('btn.importCsv') : t('btn.upload0Products')}
                            </button>
                        </div>
                    </MasterCatalogShell>
                )}
            </AnimatePresence>

            {/* Bulk Upload Services */}
            <AnimatePresence>
                {pageMode && route?.screen === 'service-import' && (
                    <MasterCatalogShell
                        title={<div className="ui-modal-title"><Upload size={18} /> {t('modal.bulkServices')}</div>}
                        onClose={closeBulkServiceModal}
                    >
                        <div className="ui-subgroup ui-subgroup--card">
                            <div className="ui-subsection-head">
                                <Box size={18} />
                                <strong>{t('bulk.uploadFormat')}</strong>
                            </div>
                            <p>{t('bulk.serviceIntro', { cols: SERVICE_CSV_COLUMNS.join(', ') })}</p>
                            <div className="ui-bullets">
                                <span>{t('bulk.serviceOrder')}</span>
                                <span>{t('bulk.serviceCase')}</span>
                                <span>{t('bulk.serviceHeader')}</span>
                                <span>{t('bulk.serviceRowHint')}</span>
                            </div>
                        </div>

                        <a className="ui-btn ui-btn--default" href={servicesCsvTemplate} download="Services.csv">
                            <Download size={18} /> {t('btn.downloadTemplate')}
                        </a>

                        <label className="ui-dropzone" htmlFor="bulk-service-csv-upload-input">
                            <Layers size={24} />
                            <span>{selectedBulkServiceFile ? selectedBulkServiceFile.name : t('btn.chooseCsv')}</span>
                            <input
                                ref={bulkServiceFileInputRef}
                                id="bulk-service-csv-upload-input"
                                type="file"
                                accept=".csv,text/csv"
                                onChange={handleBulkServiceFileChange}
                                style={{ display: 'none' }}
                            />
                        </label>

                        {bulkServiceImportResult && (() => {
                            const payload = getCsvImportPayload(bulkServiceImportResult);
                            const summary = formatCsvImportSummary(bulkServiceImportResult, t);
                            const vat = payload?.vatWarnings;
                            const rows = payload?.rowDetails;
                            const hasVat = Array.isArray(vat) && vat.length > 0;
                            const hasRows = Array.isArray(rows) && rows.length > 0;
                            const knownShape = isProductCsvImportShape(payload);
                            return (
                                <div className="ui-stack-sm">
                                    {summary ? <p className="ui-banner ui-banner--ok">{summary}</p> : null}
                                    {hasVat && (
                                        <details className="ui-bullets">
                                            <summary>{t('bulk.vatWarnings')}</summary>
                                            <ul>
                                                {vat.slice(0, 100).map((w, i) => (
                                                    <li key={i}>{formatVatWarningItem(w)}</li>
                                                ))}
                                            </ul>
                                        </details>
                                    )}
                                    {hasRows && (
                                        <details className="ui-bullets">
                                            <summary>{t('bulk.skippedRows')}</summary>
                                            <ul>
                                                {rows.slice(0, 500).map((row, i) => (
                                                    <li key={i}>{formatRowDetailItem(row)}</li>
                                                ))}
                                            </ul>
                                        </details>
                                    )}
                                    {!knownShape && !hasVat && !hasRows && (
                                        <pre className="ui-pre">{JSON.stringify(bulkServiceImportResult, null, 2)}</pre>
                                    )}
                                </div>
                            );
                        })()}

                        <div className="ui-form-foot">
                            <button type="button" className="ui-btn ui-btn--default ui-btn--lg" onClick={closeBulkServiceModal} disabled={bulkServiceImporting}>
                                {t('btn.cancel')}
                            </button>
                            <button
                                className="ui-btn ui-btn--primary ui-btn--lg"
                                type="button"
                                disabled={!selectedBulkServiceFile || bulkServiceImporting}
                                onClick={handleBulkServiceImport}
                            >
                                {bulkServiceImporting ? t('btn.importing') : selectedBulkServiceFile ? t('btn.importCsv') : t('btn.upload0Services')}
                            </button>
                        </div>
                    </MasterCatalogShell>
                )}
            </AnimatePresence>

            {/* Product Request — Approve MasterCatalogShell */}
            <AnimatePresence>
                {pageMode && route?.screen === 'request-approve' && prApproveTarget && (
                    <MasterCatalogShell
                        title={<div className="ui-modal-title"><CheckCircle2 size={18} /> {t('modal.approveRequest')}</div>}
                        onClose={() => !prActionBusy && goBack()}
                    >
                        <div className="ui-stack">
                            <p className="ui-lead">
                                {t('approve.review', { name: prApproveTarget.name })}
                            </p>
                            <div className="ui-form-grid">
                                <div className="ui-field ui-col-6">
                                    <label>{t('label.nameReq')}</label>
                                    <input
                                        className="ui-input"
                                        type="text"
                                        value={prApproveForm.name}
                                        onChange={(e) => setPrApproveForm((prev) => ({ ...prev, name: e.target.value }))}
                                        disabled={prActionBusy}
                                        placeholder={t('ph.productName')}
                                    />
                                </div>
                                <div className="ui-field ui-col-6">
                                    <label>{t('label.sku')}</label>
                                    <input
                                        className="ui-input"
                                        type="text"
                                        value={prApproveForm.sku}
                                        onChange={(e) => setPrApproveForm((prev) => ({ ...prev, sku: e.target.value }))}
                                        disabled={prActionBusy}
                                        placeholder={t('label.sku')}
                                    />
                                </div>
                                <div className="ui-field ui-col-6">
                                    <label>{t('pr.brand')}</label>
                                    <input
                                        className="ui-input"
                                        type="text"
                                        value={prApproveForm.brandName}
                                        onChange={(e) => setPrApproveForm((prev) => ({ ...prev, brandName: e.target.value }))}
                                        disabled={prActionBusy}
                                        placeholder={t('pr.brand')}
                                    />
                                </div>
                                <div className="ui-field ui-col-6">
                                    <label>{t('label.unit')}</label>
                                    <input
                                        className="ui-input"
                                        type="text"
                                        value={prApproveForm.unit}
                                        onChange={(e) => setPrApproveForm((prev) => ({ ...prev, unit: e.target.value }))}
                                        disabled={prActionBusy}
                                        placeholder={t('opt.pcs')}
                                    />
                                </div>
                                <div className="ui-field ui-col-6">
                                    <label>{t('label.expectedPrice')}</label>
                                    <input
                                        className="ui-input"
                                        {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                        value={prApproveForm.expectedPrice}
                                        onChange={(e) =>
                                            setPrApproveForm((prev) => ({
                                                ...prev,
                                                expectedPrice: sanitizeNonNegativeMoneyInput(e.target.value),
                                            }))
                                        }
                                        disabled={prActionBusy}
                                        placeholder={t('ph.price')}
                                    />
                                </div>
                                <div className="ui-field ui-col-6">
                                    <label>{t('label.selectDept')}</label>
                                    <select className="ui-select"
                                        value={prApproveForm.departmentId}
                                        onChange={(e) =>
                                            setPrApproveForm((prev) => ({
                                                ...prev,
                                                departmentId: e.target.value,
                                                categoryId: '',
                                            }))
                                        }
                                        disabled={prActionBusy}
                                    >
                                        <option value="">{t('label.selectDeptOptLower')}</option>
                                        {departments.map((d) => (
                                            <option key={d.id} value={String(d.id)}>{d.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="ui-field ui-col-6">
                                    <label>{t('label.category')}</label>
                                    <select className="ui-select"
                                        value={prApproveForm.categoryId}
                                        onChange={(e) => setPrApproveForm((prev) => ({ ...prev, categoryId: e.target.value }))}
                                        disabled={prActionBusy || !prApproveForm.departmentId}
                                    >
                                        <option value="">{t('label.noCategory')}</option>
                                        {approveProductCategories.map((c) => (
                                            <option key={c.id} value={String(c.id)}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="ui-field ui-col-6">
                                <label>{t('label.description')}</label>
                                <textarea
                                    className="ui-textarea"
                                    rows={3}
                                    placeholder={t('label.description')}
                                    value={prApproveForm.description}
                                    onChange={(e) => setPrApproveForm((prev) => ({ ...prev, description: e.target.value }))}
                                    disabled={prActionBusy}
                                />
                            </div>
                            <div className="ui-field ui-col-6">
                                <label>{t('label.arabicName')}</label>
                                <input
                                    className="ui-input"
                                    type="text"
                                    value={prApproveForm.arabicName}
                                    onChange={(e) => setPrApproveForm((prev) => ({ ...prev, arabicName: e.target.value }))}
                                    disabled={prActionBusy}
                                    placeholder={t('label.arabicName')}
                                />
                            </div>
                            <div className="ui-field ui-col-6">
                                <label>{t('label.remarks')}</label>
                                <textarea
                                    className="ui-textarea"
                                    rows={3}
                                    placeholder={t('ph.auditNote')}
                                    value={prRemarks}
                                    onChange={(e) => setPrRemarks(e.target.value)}
                                    disabled={prActionBusy}
                                />
                            </div>
                            <div className="ui-form-foot">
                                <button
                                    type="button"
                                    className="ui-btn ui-btn--primary ui-btn--lg"
                                    onClick={handlePrApproveConfirm}
                                    disabled={prActionBusy}
                                >
                                    {prActionBusy ? t('btn.approving') : t('btn.confirmApprove')}
                                </button>
                                <button
                                    type="button"
                                    className="ui-btn ui-btn--default ui-btn--lg"
                                    onClick={goBack}
                                    disabled={prActionBusy}
                                >
                                    {t('btn.cancel')}
                                </button>
                            </div>
                        </div>
                    </MasterCatalogShell>
                )}
            </AnimatePresence>

            {/* Product Request — Reject */}
            <AnimatePresence>
                {pageMode && route?.screen === 'request-reject' && prRejectTarget && (
                    <MasterCatalogShell
                        title={<div className="ui-modal-title"><XCircle size={18} /> {t('modal.rejectRequest')}</div>}
                        onClose={() => !prActionBusy && goBack()}
                    >
                        <div className="ui-stack">
                            <p className="ui-lead">
                                {t('reject.confirm', { name: prRejectTarget.name })}
                            </p>
                            <div className="ui-field ui-col-6">
                                <label>{t('label.reasonReq')}</label>
                                <textarea
                                    className="ui-textarea"
                                    rows={3}
                                    placeholder={t('ph.rejectReason')}
                                    value={prRejectReason}
                                    onChange={(e) => setPrRejectReason(e.target.value)}
                                    disabled={prActionBusy}
                                />
                                {!prRejectReason.trim() && (
                                    <p className="ui-help ui-help--err">{t('val.reasonRequired')}</p>
                                )}
                            </div>
                            <div className="ui-form-foot">
                                <button
                                    type="button"
                                    className="ui-btn ui-btn--danger ui-btn--lg"
                                    onClick={handlePrRejectConfirm}
                                    disabled={prActionBusy || !prRejectReason.trim()}
                                >
                                    {prActionBusy ? t('btn.rejecting') : t('btn.confirmReject')}
                                </button>
                                <button
                                    type="button"
                                    className="ui-btn ui-btn--default ui-btn--lg"
                                    onClick={goBack}
                                    disabled={prActionBusy}
                                >
                                    {t('btn.cancel')}
                                </button>
                            </div>
                        </div>
                    </MasterCatalogShell>
                )}
            </AnimatePresence>

            {toast && (
                <div className={`ui-toast ui-toast--${toast.kind === 'error' ? 'dang' : 'ok'} ui-toast--fixed`} role="status" aria-live="polite">
                    {toast.message}
                </div>
            )}
        </div>
    );
}
