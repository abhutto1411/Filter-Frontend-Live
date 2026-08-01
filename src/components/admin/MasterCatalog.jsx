import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { 
    Plus, Search, Download, Upload, Filter, 
    CheckCircle2, AlertCircle, Copy, XCircle,
    MoreVertical, Edit3, Trash2, Package, Layers,
    ChevronDown, Info, RefreshCw, Box, ShieldCheck,
    ArrowUp, Settings, LayoutGrid, Tags
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MasterCatalogShell from './MasterCatalogShell';
import CatalogUomFields, {
    catalogUomFromProduct,
    emptyCatalogUom,
} from './CatalogUomFields';
import { formatUomRule } from '../../pages/workshop/workshopUomUtils';
import { useAuth } from '../../context/AuthContext';
import { catalogDisplayName } from '../../utils/catalogDisplayName';
import '../../styles/admin/MasterCatalog.css';
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

const KPI_CARD_DEFS = [
    {
        key: 'products',
        labelKey: 'kpi.products',
        icon: Box,
        color: '#111827',
        textColor: '#FFFFFF',
        subColor: 'rgba(255,255,255,0.7)',
    },
    {
        key: 'services',
        labelKey: 'kpi.services',
        icon: Layers,
        color: '#F0FDF4',
        textColor: '#166534',
        subColor: '#15803D',
    },
    {
        key: 'departments',
        labelKey: 'kpi.departments',
        icon: LayoutGrid,
        color: '#FFFBEB',
        textColor: '#92400E',
        subColor: '#B45309',
    },
    {
        key: 'categories',
        labelKey: 'kpi.categories',
        icon: Tags,
        color: '#F5F3FF',
        textColor: '#5B21B6',
        subColor: '#6D28D9',
    },
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
    const filteredProducts = products.filter(productMatchesFilters);
    const filteredServices = services.filter(serviceMatchesFilters);
    /** Newest created first (descending by `createdAt`); rows with no date sort last. */
    const sortedFilteredServices = [...filteredServices].sort((a, b) => {
        const ta = catalogCreatedAtSortMs(a.createdAt ?? a.created_at);
        const tb = catalogCreatedAtSortMs(b.createdAt ?? b.created_at);
        const aMissing = !(ta > 0);
        const bMissing = !(tb > 0);
        if (aMissing && bMissing) return 0;
        if (aMissing) return 1;
        if (bMissing) return -1;
        return tb - ta;
    });
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
        <div className="mc-content-area">
            <div className="mc-filter-bar">
                <div className="mc-status-filters">
                    {['Approved', 'Pending', 'Rejected', 'All'].map(s => (
                        <button
                            key={s}
                            className={`mc-status-btn ${statusFilter === s ? 'active' : ''}`}
                            onClick={() => setStatusFilter(s)}
                        >
                            {t(`filter.${s.toLowerCase()}`)}
                        </button>
                    ))}
                </div>
                
                <div className="mc-search-box">
                    <Search size={18} className="mc-search-icon" />
                    <input 
                        type="text" 
                        placeholder={t('search.products')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="mc-filter-selects">
                    <div className="mc-select-wrapper">
                        <select
                            value={selectedProductDepartment}
                            onChange={(e) => setSelectedProductDepartment(e.target.value)}
                        >
                            <option value="">{t('filter.allDepartments')}</option>
                            {productDepartmentOptions.map((dept) => (
                                <option key={dept.id} value={dept.id}>{dept.name}</option>
                            ))}
                        </select>
                        <ChevronDown size={14} />
                    </div>
                    <span className="mc-items-count">
                        {searchQuery
                            ? t('count.of', { n: displayedProducts.length, m: products.length })
                            : t('count.items', { n: displayedProducts.length })}
                    </span>
                    {hasPermission('inventory.master-catalog.products.view') && (
                        <button
                            type="button"
                            className="mc-btn-ghost"
                            onClick={handleExportProductsCsv}
                            disabled={productsExporting || loading}
                            title="Export all products in the database as CSV"
                        >
                            <Download size={16} />
                            {productsExporting ? t('btn.exporting') : t('btn.exportCsv')}
                        </button>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="mc-empty-state">
                    <div className="mc-empty-icon"><RefreshCw size={28} className="spin" /></div>
                    <p>{t('loading.products')}</p>
                </div>
            ) : displayedProducts.length === 0 ? (
                <div className="mc-empty-state">
                    <div className="mc-empty-icon"><Package size={44} opacity={0.18} /></div>
                    <p>{searchQuery ? `${t('empty.productsSearch')} "${searchQuery}"` : t('empty.products')}</p>
                </div>
            ) : (
                <div className="mc-products-grid">
                    {displayedProducts.map((p) => {
                        const createdRaw = p.createdAt ?? p.created_at;
                        const createdLabel = formatCatalogCreatedAt(createdRaw);
                        const isActive = toBoolActive(p);
                        const priceEditable = toBoolPriceEditable(p);
                        const activeBusy = productToggleBusyKey === `${catalogItemId(p)}:isActive`;
                        const priceBusy = productToggleBusyKey === `${catalogItemId(p)}:isPriceEditable`;
                        return (
                            <div
                                key={p.id}
                                className="mc-product-card"
                                onClick={() => { if (hasPermission('inventory.master-catalog.products.edit')) handleEditClick(p); }}
                                style={{ cursor: hasPermission('inventory.master-catalog.products.edit') ? 'pointer' : 'default' }}
                            >
                                <div className="mc-pc-header">
                                    <div className="mc-pc-icon"><Edit3 size={18} /></div>
                                    <span className={`mc-pc-status ${isActive ? 'approved' : 'rejected'}`}>
                                        {isActive ? t('status.active') : t('status.inactive')}
                                    </span>
                                </div>
                                <div className="mc-pc-body">
                                    <h3 className="mc-pc-name" dir={locale === 'ar' && (p.arabicName || p.arabic_name) ? 'rtl' : undefined}>
                                        {displayName(p)}
                                    </h3>
                                    <p className="mc-pc-sku">{p.sku || t('chip.noSku')}</p>
                                    {createdLabel ? (
                                        <p className="mc-pc-created" title={String(createdRaw)}>
                                            {t('chip.created')} {createdLabel}
                                        </p>
                                    ) : null}
                                    <div className="mc-pc-tags">
                                        <span className="mc-pc-tag">{t('chip.product')}</span>
                                        <span className="mc-pc-tag">
                                            {formatUomRule(
                                                p.warehouseUnit,
                                                p.workshopUnit ?? p.unit,
                                                p.conversionFactor ?? 1,
                                            )}
                                        </span>
                                        <span className="mc-pc-tag">{p.categoryName || '—'}</span>
                                        {p.kmTypeValue != null && String(p.kmTypeValue).trim() !== '' && (
                                            <span className="mc-pc-tag" title="KM type value">
                                                {t('chip.km')} {p.kmTypeValue}
                                            </span>
                                        )}
                                        {toBoolAllowMinus(p) ? (
                                            <span className="mc-pc-tag" title="May go below zero at workshop/POS">
                                                {t('chip.minusQty')}
                                            </span>
                                        ) : null}
                                    </div>
                                    <div className="mc-pc-footer">
                                        <span className="mc-pc-price">SAR {p.salePrice ?? 0}</span>
                                        {hasPermission('inventory.master-catalog.products.edit') && (
                                            <button className="mc-pc-edit-btn" onClick={(e) => { e.stopPropagation(); handleEditClick(p); }}>
                                                <Edit3 size={14} />
                                            </button>
                                        )}
                                    </div>
                                    {hasPermission('inventory.master-catalog.products.edit') && (
                                        <div
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'max-content max-content',
                                                columnGap: 8,
                                                width: '100%',
                                                justifyContent: 'start',
                                                marginTop: 10,
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <div
                                                className="mc-sc-toggle-group"
                                                style={{ justifyContent: 'flex-start', gap: 8, width: '100%', minWidth: 0 }}
                                            >
                                                <div className="mc-toggle-label">
                                                    <strong>{t('toggle.status')}</strong>
                                                    <span className={isActive ? 'mc-toggle-state--on' : ''}>
                                                        {activeBusy ? t('toggle.updating') : isActive ? t('status.active') : t('status.inactive')}
                                                    </span>
                                                </div>
                                                <div
                                                    className={`mc-toggle-switch${isActive ? ' active' : ''}`}
                                                    role="button"
                                                    aria-label={`Toggle ${displayName(p)} active status`}
                                                    aria-pressed={isActive}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (activeBusy) return;
                                                        handleToggleProductField(p, 'isActive', !isActive);
                                                    }}
                                                    style={{ opacity: activeBusy ? 0.65 : 1, pointerEvents: activeBusy ? 'none' : 'auto' }}
                                                />
                                            </div>
                                            <div
                                                className="mc-sc-toggle-group"
                                                style={{ justifyContent: 'flex-start', gap: 8, width: '100%', minWidth: 0 }}
                                            >
                                                <div className="mc-toggle-label">
                                                    <strong>{t('toggle.priceEditable')}</strong>
                                                    <span className={priceEditable ? 'mc-toggle-state--on' : ''}>
                                                        {priceBusy
                                                            ? t('toggle.updating')
                                                            : priceEditable
                                                              ? `${t('toggle.editable')} · min SAR ${Number(p.minPriceEditable ?? p.min_price_editable ?? 0).toFixed(2)}`
                                                              : t('toggle.fixedPrice')}
                                                    </span>
                                                </div>
                                                <div
                                                    className={`mc-toggle-switch${priceEditable ? ' active' : ''}`}
                                                    role="button"
                                                    aria-label={`Toggle ${displayName(p)} price editable`}
                                                    aria-pressed={priceEditable}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (priceBusy) return;
                                                        handleToggleProductPriceEditable(p, priceEditable);
                                                    }}
                                                    style={{ opacity: priceBusy ? 0.65 : 1, pointerEvents: priceBusy ? 'none' : 'auto' }}
                                                />
                                            </div>
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
        <div className="mc-content-area">
            <div className="mc-services-header">
                <div className="mc-services-actions">
                    <div className="mc-search-box small">
                        <Search size={16} className="mc-search-icon" />
                        <input
                            type="text"
                            placeholder={t('search.departments')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    {hasPermission('inventory.master-catalog.departments.create') && (
                        <button className="mc-btn-primary small" onClick={() => navigate(mcRoutes.deptNew())}><Plus size={14} /> {t('btn.addDepartment')}</button>
                    )}
                </div>
            </div>

            <div className="mc-dept-grid">
                {filteredDepartments.map(dept => (
                    <div key={dept.id} className="mc-dept-card">
                        <div className="mc-dept-icon"><LayoutGrid size={24} color="#D4A017" /></div>
                        <h3 className="mc-dept-name">{dept.name}</h3>
                        <p className="mc-dept-meta">{t('chip.department')}</p>
                        <div className="mc-dept-actions">
                            {hasPermission('inventory.master-catalog.departments.edit') && (
                                <button className="mc-btn-icon" onClick={() => handleEditDeptClick(dept)}><Edit3 size={14} /></button>
                            )}
                            {hasPermission('inventory.master-catalog.departments.delete') && (
                                <button className="mc-btn-icon delete" onClick={() => handleDeleteDeptClick(dept.id)}><Trash2 size={14} /></button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderMasterCategory = () => (
        <div className="mc-content-area">
            <div className="mc-services-header">
                <div className="mc-services-actions">
                    <div className="mc-search-box small">
                        <Search size={16} className="mc-search-icon" />
                        <input
                            type="text"
                            placeholder={t('search.categories')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    {hasPermission('inventory.master-catalog.categories.create') && (
                        <button className="mc-btn-primary small" onClick={() => navigate(mcRoutes.catNew())}><Plus size={14} /> {t('btn.addCategory')}</button>
                    )}
                </div>
            </div>

            <div className="mc-availability-table-container">
                <table className="mc-availability-table">
                    <thead>
                        <tr>
                            <th>{t('th.categoryName')}</th>
                            <th>{t('th.department')}</th>
                            <th>{t('th.actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredCategories.map(cat => (
                            <tr key={cat.id}>
                                <td>
                                    <div className="mc-table-product">
                                        <Tags size={16} opacity={0.3} />
                                        {cat.name}
                                    </div>
                                </td>
                                <td>
                                    <span className="mc-pc-tag">
                                        {departments.find((d) => String(d.id) === String(cat.departmentId))?.name || '—'}
                                    </span>
                                </td>
                                <td>
                                    <div className="mc-table-actions">
                                        {hasPermission('inventory.master-catalog.categories.edit') && (
                                            <button className="mc-btn-icon" onClick={() => handleEditCatClick(cat)}><Edit3 size={14} /></button>
                                        )}
                                        {hasPermission('inventory.master-catalog.categories.delete') && (
                                            <button className="mc-btn-icon delete" onClick={() => handleDeleteCatClick(cat.id)}><Trash2 size={14} /></button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderProductRequests = () => {
        const statusBadge = (status) => {
            const s = String(status || '').toLowerCase();
            const cls = s === 'approved' ? 'approved' : s === 'rejected' ? 'rejected' : 'pending';
            return <span className={`mc-status-badge ${cls}`}>{s ? s[0].toUpperCase() + s.slice(1) : '—'}</span>;
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
            <div className="mc-content-area">
                <div className="mc-pr-kpis">
                    {[
                        { key: 'total', label: t('kpi.total'), color: '#111827', value: prKpis?.total },
                        { key: 'pending', label: t('kpi.pending'), color: '#D97706', value: prKpis?.pending },
                        { key: 'approved', label: t('kpi.approved'), color: '#15803D', value: prKpis?.approved },
                        { key: 'rejected', label: t('kpi.rejected'), color: '#B91C1C', value: prKpis?.rejected },
                    ].map((c) => (
                        <div key={c.key} className="mc-pr-kpi" style={{ borderColor: c.color }}>
                            <span className="mc-pr-kpi-value" style={{ color: c.color }}>{kpiNum(c.value)}</span>
                            <span className="mc-pr-kpi-label">{c.label}</span>
                        </div>
                    ))}
                </div>

                <div className="mc-services-header">
                    <div className="mc-services-tabs">
                        {['Pending', 'Approved', 'Rejected', 'All'].map((s) => (
                            <button
                                key={s}
                                type="button"
                                className={`mc-service-tab ${prTab === s ? 'active' : ''}`}
                                onClick={() => setPrTab(s)}
                            >
                                {t(`filter.${s.toLowerCase()}`)}
                            </button>
                        ))}
                    </div>
                    <button type="button" className="mc-btn-ghost" onClick={loadProductRequests} disabled={prLoading}>
                        <RefreshCw size={14} /> {prLoading ? t('btn.refreshing') : t('btn.refresh')}
                    </button>
                </div>

                {prError && (
                    <div className="mc-kpi-error">
                        <AlertCircle size={14} /> {prError}
                        <button type="button" className="mc-kpi-retry" onClick={loadProductRequests}>
                            <RefreshCw size={12} /> {t('btn.retry')}
                        </button>
                    </div>
                )}

                {prLoading ? (
                    <div className="mc-empty-state"><p>{t('loading')}</p></div>
                ) : productRequests.length === 0 ? (
                    <div className="mc-empty-state">
                        <div className="mc-empty-icon"><CheckCircle2 size={48} opacity={0.15} /></div>
                        <p>{t('empty.requests', { status: t(`filter.${prTab.toLowerCase()}`).toLowerCase() })}</p>
                    </div>
                ) : (
                    <div className="mc-pr-grid">
                        {productRequests.map((r) => {
                            const submitter = r.submittedByUser || {};
                            const workshop = r.workshop || {};
                            const branch = r.branch || {};
                            const pending = String(r.status || '').toLowerCase() === 'pending';
                            return (
                                <div key={r.id} className="mc-pr-card">
                                    <div className="mc-pr-card-head">
                                        <div className="mc-pr-card-title">
                                            <Package size={16} color="#6B7280" />
                                            <strong dir={locale === 'ar' && (r.arabicName || r.arabic_name) ? 'rtl' : undefined}>
                                                {displayName(r) || '—'}
                                            </strong>
                                        </div>
                                        {statusBadge(r.status)}
                                    </div>
                                    <div className="mc-pr-card-body">
                                        <div className="mc-pr-row">
                                            <span className="mc-pr-label">{t('pr.sku')}</span>
                                            <span className="mc-pr-value">{r.sku || '—'}</span>
                                        </div>
                                        <div className="mc-pr-row">
                                            <span className="mc-pr-label">{t('pr.brand')}</span>
                                            <span className="mc-pr-value">{r.brandName || '—'}</span>
                                        </div>
                                        <div className="mc-pr-row">
                                            <span className="mc-pr-label">{t('pr.fromSupplier')}</span>
                                            <span className="mc-pr-value">
                                                {submitter.name || submitter.email || '—'}
                                            </span>
                                        </div>
                                        <div className="mc-pr-row">
                                            <span className="mc-pr-label">{t('pr.expectedPrice')}</span>
                                            <span className="mc-pr-value">{fmtMoney(r.expectedPrice)}</span>
                                        </div>
                                        <div className="mc-pr-row">
                                            <span className="mc-pr-label">{t('pr.submittedOn')}</span>
                                            <span className="mc-pr-value">{fmtDate(r.createdAt)}</span>
                                        </div>
                                        {r.notes && (
                                            <div className="mc-pr-notes">
                                                <span className="mc-pr-label">{t('pr.notes')}</span>
                                                <p>{r.notes}</p>
                                            </div>
                                        )}
                                        {String(r.status).toLowerCase() === 'rejected' && r.rejectionReason && (
                                            <div className="mc-pr-rejection">
                                                <strong>{t('pr.rejectionReason')}</strong> {r.rejectionReason}
                                            </div>
                                        )}
                                    </div>
                                    {pending && (
                                        <div className="mc-pr-card-actions">
                                            <button
                                                type="button"
                                                className="mc-btn-ghost"
                                                onClick={() => openPrReject(r)}
                                            >
                                                <XCircle size={14} /> {t('btn.reject')}
                                            </button>
                                            <button
                                                type="button"
                                                className="mc-btn-primary"
                                                onClick={() => openPrApprove(r)}
                                            >
                                                <CheckCircle2 size={14} /> {t('btn.approve')}
                                            </button>
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
            <div className="mc-content-area">
                <div className="mc-engine-banner">
                    <strong>{t('dup.engine')}</strong>
                    <p>Automatically detects similar records across products, services, departments and categories.</p>
                </div>

                <div className="mc-services-header">
                    <div className="mc-services-tabs">
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
                                className={`mc-service-tab ${dupEntityFilter === opt.id ? 'active' : ''}`}
                                onClick={() => setDupEntityFilter(opt.id)}
                            >
                                {t(opt.labelKey)}
                            </button>
                        ))}
                    </div>
                    <button type="button" className="mc-btn-ghost" onClick={loadDuplicates} disabled={dupLoading}>
                        <RefreshCw size={14} /> {dupLoading ? t('btn.refreshing') : t('btn.refresh')}
                    </button>
                </div>

                <div className={`mc-alert-banner ${dupGroups.length ? 'warning' : 'success'}`}>
                    <div className="mc-alert-icon">
                        {dupGroups.length ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
                    </div>
                    <div className="mc-alert-content">
                        <strong>{t('dup.detection')}</strong>
                        <p>
                            {dupLoading
                                ? t('dup.scanning')
                                : dupGroups.length
                                    ? t('dup.groupsRecords', { groups: dupGroups.length, records: totalAffected })
                                    : t('dup.noGroups')}
                        </p>
                    </div>
                    {dupGroups.length > 0 && (
                        <span className="mc-alert-badge">{dupGroups.length} {t('dup.groups')}</span>
                    )}
                </div>

                {dupError && (
                    <div className="mc-kpi-error">
                        <AlertCircle size={14} /> {dupError}
                        <button type="button" className="mc-kpi-retry" onClick={loadDuplicates}>
                            <RefreshCw size={12} /> {t('btn.retry')}
                        </button>
                    </div>
                )}

                {!dupLoading && dupGroups.length === 0 && !dupError && (
                    <div className="mc-empty-state">
                        <div className="mc-empty-icon"><CheckCircle2 size={48} opacity={0.15} /></div>
                        <p>{t('empty.duplicates')}{dupEntityFilter ? ` (${dupEntityFilter}s)` : ''}</p>
                    </div>
                )}

                <div className="mc-duplicates-list">
                    {dupGroups.map((group) => {
                        const key = `${group.entityType}::${group.nameKey}`;
                        const isOpen = expandedDupKey === key;
                        const Icon = entityIcon[group.entityType] || Package;
                        const items = Array.isArray(group.items) ? group.items : [];
                        return (
                            <div key={key} className="mc-dup-group">
                                <button
                                    type="button"
                                    className="mc-dup-group-head"
                                    onClick={() => setExpandedDupKey(isOpen ? null : key)}
                                >
                                    <div className="mc-dup-group-title">
                                        <Icon size={16} color="#991B1B" />
                                        <strong>{group.displayName || group.nameKey}</strong>
                                        <span className={`mc-pc-tag mc-dup-entity-tag ${group.entityType}`}>
                                            {group.entityType}
                                        </span>
                                        <span className="mc-dup-count-badge">{group.count ?? items.length}</span>
                                    </div>
                                    <ChevronDown
                                        size={16}
                                        style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                                    />
                                </button>
                                {isOpen && (
                                    <div className="mc-dup-group-body">
                                        <table className="mc-availability-table">
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
                                                            <span className={`mc-pc-status ${item.isActive === false ? 'rejected' : 'approved'}`}>
                                                                {item.isActive === false ? t('status.inactive') : t('status.active')}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            {hasPermission('inventory.master-catalog.duplication.edit') && (
                                                                <button
                                                                    type="button"
                                                                    className="mc-btn-icon delete"
                                                                    title="Delete this record"
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
                                        <div className="mc-dup-group-actions">
                                            <button
                                                type="button"
                                                className="mc-btn-ghost"
                                                onClick={() => handleIgnoreDuplicate(group)}
                                            >
                                                <ShieldCheck size={14} /> {t('btn.markNotDuplicate')}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderSupplierAvailability = () => (
        <div className="mc-content-area">
            <div className="mc-filter-bar compact">
                <div className="mc-search-box">
                    <Search size={18} className="mc-search-icon" />
                    <input
                        type="text"
                        placeholder={t('search.availability')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="mc-availability-badges">
                    <span className="mc-av-badge green">0 {t('avail.withStock')}</span>
                    <span className="mc-av-badge red">{filteredAvailability.length} {t('avail.noSupplier')}</span>
                </div>
            </div>

            <div className="mc-availability-table-container">
                <table className="mc-availability-table">
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
                        {(loading ? [] : filteredAvailability).map((p) => (
                            <tr key={p.id}>
                                <td>
                                    <div className="mc-table-product" dir={locale === 'ar' && (p.arabicName || p.arabic_name) ? 'rtl' : undefined}>
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
                                <td className="mc-muted">{t('avail.noSuppliers')}</td>
                                <td><span className="mc-av-status red">{t('avail.noStock')}</span></td>
                            </tr>
                        ))}
                        {!loading && filteredAvailability.length === 0 && (
                            <tr>
                                <td colSpan={6} className="mc-muted" style={{ textAlign: 'center', padding: '24px' }}>
                                    {searchQuery ? `${t('empty.productsSearch')} "${searchQuery}"` : t('empty.products')}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderServices = () => (
        <div className="mc-content-area">
            <div className="mc-services-header">
                <div className="mc-services-tabs">
                    {['Approved', 'Pending', 'Rejected', 'All'].map((s) => (
                        <button
                            key={s}
                            type="button"
                            className={`mc-service-tab ${s === serviceStatusFilter ? 'active' : ''}`}
                            onClick={() => setServiceStatusFilter(s)}
                        >
                            {t(`filter.${s.toLowerCase()}`)}
                        </button>
                    ))}
                </div>
                <div className="mc-services-actions">
                    <div className="mc-search-box small">
                        <Search size={16} className="mc-search-icon" />
                        <input
                            type="text"
                            placeholder={t('search.services')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="mc-select-wrapper">
                        <select
                            value={selectedServiceDepartment}
                            onChange={(e) => setSelectedServiceDepartment(e.target.value)}
                        >
                            <option value="">{t('filter.allDepartments')}</option>
                            {serviceDepartmentOptions.map((dept) => (
                                <option key={dept.id} value={dept.id}>{dept.name}</option>
                            ))}
                        </select>
                        <ChevronDown size={14} />
                    </div>
                </div>
            </div>

            <div className="mc-services-summary">
                <div className="mc-ss-card purple">
                    <div className="mc-ss-value">{services.length}</div>
                    <div className="mc-ss-label">{t('kpi.totalServices')}</div>
                </div>
                <div className="mc-ss-card green">
                    <div className="mc-ss-value">{services.filter((s) => s.isActive !== false).length}</div>
                    <div className="mc-ss-label">{t('kpi.approved')}</div>
                </div>
                <div className="mc-ss-card blue">
                    <div className="mc-ss-value">{services.filter((s) => toBoolPriceEditable(s)).length}</div>
                    <div className="mc-ss-label">{t('kpi.priceEditable')}</div>
                </div>
            </div>

            {loading ? (
                <div className="mc-empty-state">
                    <div className="mc-empty-icon">
                        <RefreshCw size={28} className="spin" />
                    </div>
                    <p>{t('loading.services')}</p>
                </div>
            ) : displayedServices.length === 0 ? (
                <div className="mc-empty-state">
                    <div className="mc-empty-icon">
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
                <div className="mc-services-grid">
                    {displayedServices.map((p) => {
                        const isActive = toBoolActive(p);
                        const priceEditable = toBoolPriceEditable(p);
                        const serviceQtyOn = toBoolServiceQty(p);
                        const createdRaw = p.createdAt ?? p.created_at;
                        const createdLabel = formatCatalogCreatedAt(createdRaw);
                        const activeBusy = serviceToggleBusyKey === `${catalogItemId(p)}:isActive`;
                        const priceBusy = serviceToggleBusyKey === `${catalogItemId(p)}:isPriceEditable`;
                        const qtyBusy = serviceToggleBusyKey === `${catalogItemId(p)}:serviceQty`;
                        return (
                            <div
                                key={p.id}
                                className="mc-service-card"
                                role="button"
                                tabIndex={0}
                                onClick={() => { if (hasPermission('inventory.master-catalog.services.edit')) openEditService(p); }}
                                onKeyDown={(e) => {
                                    if ((e.key === 'Enter' || e.key === ' ') && hasPermission('inventory.master-catalog.services.edit')) {
                                        e.preventDefault();
                                        openEditService(p);
                                    }
                                }}
                                style={{ cursor: hasPermission('inventory.master-catalog.services.edit') ? 'pointer' : 'default' }}
                            >
                                <div className="mc-sc-header">
                                    <div className="mc-sc-icon">
                                        <Edit3 size={16} />
                                    </div>
                                    <span className={`mc-pc-status ${isActive ? 'approved' : 'rejected'}`}>
                                        {isActive ? t('status.active') : t('status.inactive')}
                                    </span>
                                </div>
                                <div className="mc-sc-body">
                                    <h4 className="mc-sc-name" dir={locale === 'ar' && (p.arabicName || p.arabic_name) ? 'rtl' : undefined}>
                                        {displayName(p)}
                                    </h4>
                                    <p className="mc-sc-sub">{p.sku || t('chip.noSku')}</p>
                                    {createdLabel ? (
                                        <p className="mc-pc-created" title={String(createdRaw)}>
                                            {t('chip.created')} {createdLabel}
                                        </p>
                                    ) : null}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                                        <span className="mc-pc-tag">{p.categoryName || '—'}</span>
                                        {(p.vatMode != null && String(p.vatMode).trim() !== '') ||
                                        (p.vat_mode != null && String(p.vat_mode).trim() !== '') ? (
                                            <span className="mc-pc-tag" title="VAT mode">
                                                {String(p.vatMode ?? p.vat_mode)}
                                            </span>
                                        ) : null}
                                    </div>
                                    <div className="mc-sc-price">{t('sale.sar', { price: p.sellingPrice ?? 0 })}</div>
                                </div>
                                <div className="mc-sc-footer">
                                    <div
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'max-content max-content',
                                            columnGap: 8,
                                            width: '100%',
                                            justifyContent: 'start',
                                        }}
                                    >
                                        <div className="mc-sc-toggle-group" style={{ justifyContent: 'flex-start', gap: 8, width: '100%', minWidth: 0 }}>
                                            <div className="mc-toggle-label">
                                                <strong>{t('toggle.status')}</strong>
                                                <span className={isActive ? 'mc-toggle-state--on' : ''}>
                                                    {activeBusy ? t('toggle.updating') : isActive ? t('status.active') : t('status.inactive')}
                                                </span>
                                            </div>
                                            <div
                                                className={`mc-toggle-switch${isActive ? ' active' : ''}`}
                                                role="button"
                                                aria-label={`Toggle ${displayName(p)} active status`}
                                                aria-pressed={isActive}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (activeBusy) return;
                                                    handleToggleServiceField(p, 'isActive', !isActive);
                                                }}
                                                style={{ opacity: activeBusy ? 0.65 : 1, pointerEvents: activeBusy ? 'none' : 'auto' }}
                                            />
                                        </div>
                                        <div className="mc-sc-toggle-group" style={{ justifyContent: 'flex-start', gap: 8, width: '100%', minWidth: 0 }}>
                                            <div className="mc-toggle-label">
                                                <strong>{t('toggle.priceEditable')}</strong>
                                                <span className={priceEditable ? 'mc-toggle-state--on' : ''}>
                                                    {priceBusy ? t('toggle.updating') : priceEditable ? t('toggle.editable') : t('toggle.fixedPrice')}
                                                </span>
                                            </div>
                                            <div
                                                className={`mc-toggle-switch${priceEditable ? ' active' : ''}`}
                                                role="button"
                                                aria-label={`Toggle ${displayName(p)} price editable`}
                                                aria-pressed={priceEditable}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (priceBusy) return;
                                                    handleToggleServiceField(p, 'isPriceEditable', !priceEditable);
                                                }}
                                                style={{ opacity: priceBusy ? 0.65 : 1, pointerEvents: priceBusy ? 'none' : 'auto' }}
                                            />
                                        </div>
                                        <div className="mc-sc-toggle-group" style={{ justifyContent: 'flex-start', gap: 8, width: '100%', minWidth: 0 }}>
                                            <div className="mc-toggle-label">
                                                <strong>{t('toggle.serviceQty')}</strong>
                                                <span className={serviceQtyOn ? 'mc-toggle-state--on' : ''}>
                                                    {qtyBusy ? t('toggle.updating') : serviceQtyOn ? t('toggle.qtyOn') : t('toggle.qtyOff')}
                                                </span>
                                            </div>
                                            <div
                                                className={`mc-toggle-switch${serviceQtyOn ? ' active' : ''}`}
                                                role="button"
                                                aria-label={`Toggle ${displayName(p)} service quantity`}
                                                aria-pressed={serviceQtyOn}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (qtyBusy) return;
                                                    handleToggleServiceField(p, 'serviceQty', serviceQtyOn ? null : 1);
                                                }}
                                                style={{ opacity: qtyBusy ? 0.65 : 1, pointerEvents: qtyBusy ? 'none' : 'auto' }}
                                            />
                                        </div>
                                    </div>
                                    {hasPermission('inventory.master-catalog.services.edit') && (
                                        <Edit3
                                            size={14}
                                            className="mc-sc-edit-icon"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openEditService(p);
                                            }}
                                        />
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
        <div className={`master-catalog-container${pageMode ? ' master-catalog-route-view' : ''}`}>
            {!pageMode && (
            <>
            {/* Header Area */}
            <div className="mc-header">
                <div className="mc-header-info">
                    <h1 className="mc-title">{t('page.title')}</h1>
                    <p className="mc-subtitle">{t('page.subtitle')}</p>
                </div>
                <div className="mc-header-actions">
                    <button type="button" className="mc-btn-ghost"><RefreshCw size={16} /> {t('btn.syncDepts')}</button>
                    {hasPermission('inventory.master-catalog.products.create') && (
                        <button type="button" className="mc-btn-ghost" onClick={() => navigate(mcRoutes.productImport())}>
                            <Upload size={16} /> {t('btn.bulkProduct')}
                        </button>
                    )}
                    {hasPermission('inventory.master-catalog.services.create') && (
                        <button type="button" className="mc-btn-ghost" onClick={() => navigate(mcRoutes.serviceImport())}>
                            <Upload size={16} /> {t('btn.bulkService')}
                        </button>
                    )}
                    {hasPermission('inventory.master-catalog.products.create') && (
                        <button type="button" className="mc-btn-primary" onClick={() => navigate(mcRoutes.productNew())}>
                            <Plus size={16} /> {t('btn.addProduct')}
                        </button>
                    )}
                    {hasPermission('inventory.master-catalog.services.create') && (
                        <button type="button" className="mc-btn-primary purple-btn" onClick={() => navigate(mcRoutes.serviceNew())}>
                            <Plus size={16} /> {t('btn.addService')}
                        </button>
                    )}
                </div>
            </div>

            {/* Summary Cards (live KPIs) */}
            <div className="mc-summary-grid">
                {kpisError && (
                    <div className="mc-kpi-error">
                        <AlertCircle size={14} /> {kpisError}
                        <button type="button" className="mc-kpi-retry" onClick={loadKpis}>
                            <RefreshCw size={12} /> {t('btn.retry')}
                        </button>
                    </div>
                )}
                {buildKpiCards(kpis, fallbackKpis, t).map((card) => (
                    <div
                        key={card.key}
                        className="mc-summary-card"
                        style={{ backgroundColor: card.color, color: card.textColor }}
                    >
                        <div className="mc-card-top">
                            <span className="mc-card-label">{card.label}</span>
                            <card.icon size={18} opacity={0.6} />
                        </div>
                        <div className="mc-card-value">
                            {kpisLoading && !kpis ? '—' : card.value}
                        </div>
                        <div className="mc-card-sub" style={{ color: card.subColor }}>
                            {kpisLoading && !kpis ? t('loading') : card.sub}
                        </div>
                    </div>
                ))}
            </div>

            {/* Inner Navigation Tabs */}
            <div className="mc-tabs-container">
                {visibleMasterTabs.map(tab => (
                    <button
                        key={tab.id}
                        className={`mc-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => {
                            setActiveTab(tab.id);
                            setSearchQuery('');
                            navigate(masterCatalogListUrl(tab.id), { replace: true });
                        }}
                    >
                        <tab.icon size={16} />
                        {t(MC_TAB_LABEL_KEYS[tab.id] || tab.label)}
                    </button>
                ))}
                {visibleMasterTabs.length === 0 && (
                    <div style={{ padding: 20, color: '#94a3b8', fontSize: '0.875rem' }}>
                        {t('empty.noTabs')}
                    </div>
                )}
            </div>

            {/* Banner Notification */}
            <div className="mc-governance-banner">
                <div className="mc-banner-icon"><CheckCircle2 size={18} /></div>
                <div className="mc-banner-content">
                    <strong>{t('banner.title')}</strong>
                    <p>{t('banner.body')}</p>
                </div>
            </div>

            {/* Render Active Tab Content — re-check permission as a defense-in-depth gate */}
            {activeTab === 'master'       && hasPermission('inventory.master-catalog.products.view')     && renderMasterCatalog()}
            {activeTab === 'dept'         && hasPermission('inventory.master-catalog.departments.view')  && renderMasterDepartment()}
            {activeTab === 'category'     && hasPermission('inventory.master-catalog.categories.view')   && renderMasterCategory()}
            {activeTab === 'requests'     && hasPermission('inventory.master-catalog.requests.view')     && renderProductRequests()}
            {activeTab === 'duplication'  && hasPermission('inventory.master-catalog.duplication.view')  && renderDuplicationReview()}
            {activeTab === 'availability' && hasPermission('inventory.master-catalog.availability.view') && renderSupplierAvailability()}
            {activeTab === 'services'     && hasPermission('inventory.master-catalog.services.view')     && renderServices()}

            </>
            )}

            {/* Add Department MasterCatalogShell */}
            <AnimatePresence>
                {pageMode && route?.screen === 'dept-new' && (
                    <MasterCatalogShell
                        title={<div className="mc-modal-title"><LayoutGrid size={18} color="#D4A017" /> {t('modal.addDept')}</div>}
                        onClose={goBack}
                        className="sa-mc-modal sa-mc-modal-narrow"
                    >
                        <div className="mc-modal-form">
                            <div className="mc-form-group">
                                <label>{t('label.deptName')}</label>
                                <input 
                                    type="text" 
                                    placeholder={t('ph.deptExample')} 
                                    value={newDept.name}
                                    onChange={(e) => setNewDept({ name: e.target.value })}
                                />
                            </div>
                            <div className="mc-modal-footer">
                                <button className="mc-btn-primary mc-btn-large" onClick={handleCreateDepartment} disabled={saving || !isDepartmentFormValid}>
                                    {saving ? t('btn.saving') : t('btn.addDepartment')}
                                </button>
                                <button className="mc-btn-ghost mc-btn-large" onClick={goBack}>{t('btn.cancel')}</button>
                            </div>
                            {!isDepartmentFormValid && (
                                <p style={{ marginTop: 8, color: '#B91C1C', fontSize: 12 }}>{t('val.deptRequired')}</p>
                            )}
                        </div>
                    </MasterCatalogShell>
                )}
            </AnimatePresence>

            {/* Edit Department MasterCatalogShell */}
            <AnimatePresence>
                {pageMode && route?.screen === 'dept-edit' && editingDept && (
                    <MasterCatalogShell
                        title={<div className="mc-modal-title"><LayoutGrid size={18} color="#D4A017" /> {t('modal.editDept')}</div>}
                        onClose={goBack}
                        className="sa-mc-modal sa-mc-modal-narrow"
                    >
                        <div className="mc-modal-form">
                            <div className="mc-form-group">
                                <label>{t('label.deptName')}</label>
                                <input 
                                    type="text" 
                                    placeholder={t('ph.deptExample')} 
                                    value={editingDept.name}
                                    onChange={(e) => setEditingDept({ ...editingDept, name: e.target.value })}
                                />
                            </div>
                            <div className="mc-modal-footer">
                                <button className="mc-btn-primary mc-btn-large" onClick={handleUpdateDepartment} disabled={saving || !editingDept.name?.trim()}>
                                    {saving ? t('btn.saving') : t('btn.updateDepartment')}
                                </button>
                                <button className="mc-btn-ghost mc-btn-large" onClick={goBack}>{t('btn.cancel')}</button>
                            </div>
                        </div>
                    </MasterCatalogShell>
                )}
            </AnimatePresence>

            {/* Add Category */}
            <AnimatePresence>
                {pageMode && route?.screen === 'cat-new' && (
                    <MasterCatalogShell
                        title={<div className="mc-modal-title"><Tags size={18} color="#D4A017" /> {t('modal.addCat')}</div>}
                        onClose={goBack}
                        className="sa-mc-modal sa-mc-modal-narrow"
                    >
                        <div className="mc-modal-form">
                            <div className="mc-form-group">
                                <label>{t('label.selectDept')}</label>
                                <div className="mc-select-wrapper">
                                    <select
                                        value={newCat.departmentId}
                                        onChange={(e) => setNewCat({ ...newCat, departmentId: e.target.value })}
                                    >
                                        <option value="">{t('label.selectDeptOpt')}</option>
                                        {departments.map((dept) => (
                                            <option key={dept.id} value={String(dept.id)}>{dept.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={14} />
                                </div>
                            </div>
                            <div className="mc-form-group">
                                <label>{t('label.catType')}</label>
                                <div className="mc-select-wrapper">
                                    <select value={newCat.type} onChange={(e) => setNewCat({ ...newCat, type: e.target.value })}>
                                        <option value="product">{t('opt.product')}</option>
                                        <option value="service">{t('opt.service')}</option>
                                    </select>
                                    <ChevronDown size={14} />
                                </div>
                            </div>
                            <div className="mc-form-group">
                                <label>{t('label.catName')}</label>
                                <input 
                                    type="text" 
                                    placeholder={t('ph.catExample')} 
                                    value={newCat.name}
                                    onChange={(e) => setNewCat({ ...newCat, name: e.target.value })}
                                />
                            </div>
                            <div className="mc-modal-footer">
                                <button className="mc-btn-primary mc-btn-large" onClick={handleCreateCategory} disabled={saving || !isCategoryFormValid}>
                                    {saving ? t('btn.saving') : t('btn.addCategory')}
                                </button>
                                <button className="mc-btn-ghost mc-btn-large" onClick={goBack}>{t('btn.cancel')}</button>
                            </div>
                            {!isCategoryFormValid && (
                                <p style={{ marginTop: 8, color: '#B91C1C', fontSize: 12 }}>
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
                        title={<div className="mc-modal-title"><Tags size={18} color="#D4A017" /> {t('modal.editCat')}</div>}
                        onClose={goBack}
                        className="sa-mc-modal sa-mc-modal-narrow"
                    >
                        <div className="mc-modal-form">
                            <div className="mc-form-group">
                                <label>{t('label.selectDept')}</label>
                                <div className="mc-dept-selector">
                                    {departments.map(dept => (
                                        <button 
                                            key={dept.id} 
                                            className={`mc-dept-mini-card ${String(editingCat.departmentId) === String(dept.id) ? 'active' : ''}`}
                                            onClick={() => setEditingCat({ ...editingCat, departmentId: String(dept.id) })}
                                        >
                                            {dept.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="mc-form-group">
                                <label>{t('label.catName')}</label>
                                <input 
                                    type="text" 
                                    placeholder={t('ph.catExample')} 
                                    value={editingCat.name}
                                    onChange={(e) => setEditingCat({ ...editingCat, name: e.target.value })}
                                />
                            </div>
                            <div className="mc-form-group">
                                <label>{t('label.catType')}</label>
                                <div className="mc-select-wrapper">
                                    <select
                                        value={editingCat.type || 'product'}
                                        onChange={(e) => setEditingCat({ ...editingCat, type: e.target.value })}
                                    >
                                        <option value="product">{t('opt.product')}</option>
                                        <option value="service">{t('opt.service')}</option>
                                    </select>
                                    <ChevronDown size={14} />
                                </div>
                            </div>
                            <div className="mc-modal-footer">
                                <button
                                    className="mc-btn-primary mc-btn-large"
                                    onClick={handleUpdateCategory}
                                    disabled={saving || !editingCat.name?.trim() || !editingCat.departmentId}
                                >
                                    {saving ? t('btn.saving') : t('btn.updateCategory')}
                                </button>
                                <button className="mc-btn-ghost mc-btn-large" onClick={goBack}>{t('btn.cancel')}</button>
                            </div>
                        </div>
                    </MasterCatalogShell>
                )}
            </AnimatePresence>

            {/* Add Service */}
            <AnimatePresence>
                {pageMode && route?.screen === 'service-new' && (
                    <MasterCatalogShell
                        title={<div className="mc-modal-title"><Settings size={18} color="#9333EA" /> {t('modal.addService')}</div>}
                        onClose={goBack}
                        className="sa-mc-modal"
                    >
                        <div className="mc-modal-form">
                            <div className="mc-form-group">
                                <label>{t('label.serviceName')}</label>
                                <input
                                    type="text"
                                    placeholder={t('ph.serviceExample')}
                                    value={newService.name}
                                    onChange={(e) => setNewService((prev) => ({ ...prev, name: e.target.value }))}
                                />
                            </div>

                            <div className="mc-form-group">
                                <label>{t('label.arabicName')}</label>
                                <input
                                    type="text"
                                    dir="rtl"
                                    placeholder={t('ph.arabic')}
                                    value={newService.arabicName}
                                    onChange={(e) => setNewService((prev) => ({ ...prev, arabicName: e.target.value }))}
                                />
                            </div>

                            <div className="mc-form-row">
                                <div className="mc-form-group">
                                    <label>{t('label.department')}</label>
                                    <div className="mc-select-wrapper">
                                        <select
                                            value={newService.departmentId}
                                            onChange={(e) =>
                                                setNewService((prev) => ({ ...prev, departmentId: e.target.value, categoryId: '' }))
                                            }
                                        >
                                            <option value="">{t('label.selectDeptOpt')}</option>
                                            {departments.map((d) => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
                                        </select>
                                        <ChevronDown size={14} />
                                    </div>
                                </div>
                                <div className="mc-form-group">
                                    <label>{t('label.category')}</label>
                                    <div className="mc-select-wrapper">
                                        <select
                                            value={newService.categoryId}
                                            onChange={(e) => setNewService((prev) => ({ ...prev, categoryId: e.target.value }))}
                                            disabled={!newService.departmentId}
                                        >
                                            <option value="">{t('label.selectCategory')}</option>
                                            {selectedServiceCategories.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                                        </select>
                                        <ChevronDown size={14} />
                                    </div>
                                    {newService.departmentId && selectedServiceCategories.length === 0 && (
                                        <p style={{ marginTop: 6, color: '#B91C1C', fontSize: 12 }}>
                                            {t('hint.noServiceCats')}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="mc-form-row">
                                <div className="mc-form-group">
                                    <label>{t('label.sku')}</label>
                                    <input
                                        type="text"
                                        placeholder={t('ph.skuService')}
                                        className="mc-input-faded"
                                        value={newService.sku}
                                        onChange={(e) => setNewService((prev) => ({ ...prev, sku: e.target.value }))}
                                    />
                                </div>
                                <div className="mc-form-group">
                                    <label>{t('label.unit')}</label>
                                    <div className="mc-select-wrapper">
                                        <select
                                            value={newService.unitOfMeasurement}
                                            onChange={(e) => setNewService((prev) => ({ ...prev, unitOfMeasurement: e.target.value }))}
                                        >
                                            <option value="ea">{t('opt.each')}</option>
                                            <option value="pcs">{t('opt.pcs')}</option>
                                            <option value="service">{t('opt.serviceUnit')}</option>
                                        </select>
                                        <ChevronDown size={14} />
                                    </div>
                                </div>
                            </div>

                            <div className="mc-form-row">
                                <div className="mc-form-group">
                                    <label>{t('label.salePrice')}</label>
                                    <input
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
                            </div>

                            <div className="mc-form-row">
                                <div className="mc-form-group">
                                    <label>{t('label.minCorp')}</label>
                                    <input
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
                                <div className="mc-form-group">
                                    <label>{t('label.maxCorp')}</label>
                                    <input
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

                            <div className="mc-form-group">
                                <label>{t('label.description')}</label>
                                <input
                                    type="text"
                                    placeholder={t('ph.description')}
                                    value={newService.description}
                                    onChange={(e) => setNewService((prev) => ({ ...prev, description: e.target.value }))}
                                />
                            </div>

                            <div className="mc-toggle-box yellow">
                                <div className="mc-toggle-info">
                                    <strong>{t('toggle.allowCashierPrice')}</strong>
                                    <span>{t('toggle.allowCashierPriceHint')}</span>
                                </div>
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={newService.isPriceEditable}
                                        onChange={(e) => setNewService((prev) => ({ ...prev, isPriceEditable: e.target.checked }))}
                                    />
                                </label>
                            </div>

                            <div className="mc-toggle-box blue-toggle">
                                <div className="mc-toggle-info">
                                    <strong>{t('toggle.allowServiceQty')}</strong>
                                    <span>{t('toggle.allowServiceQtyHint')}</span>
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

                            <div className="mc-toggle-box blue-toggle">
                                <div className="mc-toggle-info">
                                    <strong>{t('toggle.activeStatus')}</strong>
                                    <span>{t('toggle.activeStatusHint')}</span>
                                </div>
                                <div className="mc-toggle-switch small active"></div>
                            </div>

                            <div className="mc-modal-banner purple-banner">
                                <ShieldCheck size={14} /> {t('banner.servicesApproved')}
                            </div>

                            <div className="mc-modal-footer row">
                                <button
                                    className="mc-btn-primary mc-btn-large purple-btn"
                                    style={{ flex: 4 }}
                                    onClick={handleCreateCatalogService}
                                    disabled={saving || !isServiceFormValid}
                                >
                                    {saving ? t('btn.saving') : t('btn.addToMaster')}
                                </button>
                                <button className="mc-btn-ghost mc-btn-large" style={{ flex: 1 }} onClick={goBack}>{t('btn.cancel')}</button>
                            </div>
                            {!isServiceFormValid && (
                                <p style={{ marginTop: 8, color: '#B91C1C', fontSize: 12 }}>
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
                        title={<div className="mc-modal-title"><Settings size={18} color="#9333EA" /> {t('modal.editService')}</div>}
                        onClose={() => {
                            if (saving) return;
                            goBack();
                            setEditingService(null);
                        }}
                        className="sa-mc-modal"
                    >
                        <div className="mc-modal-form">
                            <div className="mc-form-group">
                                <label>{t('label.serviceName')}</label>
                                <input
                                    type="text"
                                    value={editingService.name}
                                    onChange={(e) => setEditingService((prev) => ({ ...prev, name: e.target.value }))}
                                />
                            </div>

                            <div className="mc-form-group">
                                <label>{t('label.arabicName')}</label>
                                <input
                                    type="text"
                                    dir="rtl"
                                    placeholder={t('ph.arabic')}
                                    value={editingService.arabicName ?? ''}
                                    onChange={(e) => setEditingService((prev) => ({ ...prev, arabicName: e.target.value }))}
                                />
                            </div>

                            <div className="mc-form-row">
                                <div className="mc-form-group">
                                    <label>{t('label.sku')}</label>
                                    <input
                                        type="text"
                                        value={editingService.sku}
                                        onChange={(e) => setEditingService((prev) => ({ ...prev, sku: e.target.value }))}
                                    />
                                </div>
                                <div className="mc-form-group">
                                    <label>{t('label.sellingPrice')}</label>
                                    <input
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

                            <div className="mc-form-row">
                                <div className="mc-form-group">
                                    <label>{t('label.minCorp')}</label>
                                    <input
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
                                <div className="mc-form-group">
                                    <label>{t('label.maxCorp')}</label>
                                    <input
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

                            <div className="mc-form-group">
                                <label>{t('label.description')}</label>
                                <input
                                    type="text"
                                    value={editingService.description}
                                    onChange={(e) => setEditingService((prev) => ({ ...prev, description: e.target.value }))}
                                />
                            </div>

                            <div className="mc-form-group">
                                <label>{t('label.category')}</label>
                                <input
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

                            <div className="mc-form-row">
                                <div className="mc-form-group">
                                    <label>{t('label.vatMode')}</label>
                                    <input
                                        type="text"
                                        readOnly
                                        disabled
                                        value={String(editingService.vatMode ?? editingService.vat_mode ?? '') || '—'}
                                    />
                                </div>
                                <div className="mc-form-group">
                                    <label>{t('label.created')}</label>
                                    <input
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

                            <div className="mc-form-row">
                                <div className="mc-toggle-box yellow">
                                    <div className="mc-toggle-info">
                                        <strong>{t('toggle.serviceStatus')}</strong>
                                        <span>{editingService.isActive ? t('status.active') : t('status.inactive')}</span>
                                    </div>
                                    <div
                                        className={`mc-toggle-switch small${editingService.isActive ? ' active' : ''}`}
                                        role="button"
                                        aria-label={t('toggle.ariaServiceActive')}
                                        aria-pressed={!!editingService.isActive}
                                        onClick={() =>
                                            setEditingService((prev) => ({ ...prev, isActive: !prev.isActive }))
                                        }
                                    />
                                </div>
                                <div className="mc-toggle-box yellow">
                                    <div className="mc-toggle-info">
                                        <strong>{t('toggle.priceEditable')}</strong>
                                        <span>{editingService.isPriceEditable ? t('toggle.editableCashier') : t('toggle.fixedPrice')}</span>
                                    </div>
                                    <div
                                        className={`mc-toggle-switch small${editingService.isPriceEditable ? ' active' : ''}`}
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

                            <div className="mc-toggle-box blue-toggle" style={{ marginTop: 12 }}>
                                <div className="mc-toggle-info">
                                    <strong>{t('toggle.allowServiceQty')}</strong>
                                    <span>
                                        {editingService.serviceQtyEnabled
                                            ? t('toggle.qtyOnHint')
                                            : t('toggle.qtyOffHint')}
                                    </span>
                                </div>
                                <div
                                    className={`mc-toggle-switch small${editingService.serviceQtyEnabled ? ' active' : ''}`}
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

                            <div className="mc-modal-footer row">
                                <button className="mc-btn-ghost mc-btn-large" onClick={handleDeleteCatalogService} disabled={saving}>
                                    {t('btn.delete')}
                                </button>
                                <button
                                    className="mc-btn-ghost mc-btn-large"
                                    onClick={() => {
                                        goBack();
                                        setEditingService(null);
                                    }}
                                >
                                    {t('btn.cancel')}
                                </button>
                                <button className="mc-btn-primary mc-btn-large purple-btn" onClick={handleUpdateCatalogService} disabled={saving}>
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
                        title={<div className="mc-modal-title"><ShieldCheck size={18} color="#D4A017" /> {t('modal.editProduct')}</div>}
                        onClose={goBack}
                        className="sa-mc-modal"
                    >
                        <div className="mc-modal-banner">
                            {t('banner.productsApproved')}
                        </div>
                        
                        <div className="mc-modal-form">
                            <div className="mc-form-group">
                                <label>{t('label.productName')}</label>
                                <input 
                                    type="text" 
                                    value={editingProduct.name} 
                                    onChange={(e) => setEditingProduct({...editingProduct, name: e.target.value})}
                                />
                            </div>

                            <div className="mc-form-group">
                                <label>{t('label.arabicName')}</label>
                                <input
                                    type="text"
                                    dir="rtl"
                                    placeholder={t('ph.arabic')}
                                    value={editingProduct.arabicName ?? ''}
                                    onChange={(e) => setEditingProduct({ ...editingProduct, arabicName: e.target.value })}
                                />
                            </div>

                            <div className="mc-form-row">
                                <div className="mc-form-group">
                                    <label>{t('label.sku')}</label>
                                    <input 
                                        type="text" 
                                        value={editingProduct.sku || editingProduct.name} 
                                        onChange={(e) => setEditingProduct({...editingProduct, sku: e.target.value})}
                                    />
                                </div>
                                <div className="mc-form-group">
                                    <label>{t('label.brand')}</label>
                                    <input 
                                        type="text" 
                                        placeholder={t('ph.brand')}
                                        value={editingProduct.brand || ''} 
                                        onChange={(e) => setEditingProduct({...editingProduct, brand: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="mc-form-group">
                                <label>{t('label.department')}</label>
                                <input
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

                            <div className="mc-form-group">
                                <label>{t('label.categoryReq')}</label>
                                <div className="mc-select-wrapper">
                                    <select
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
                                    <ChevronDown size={14} />
                                </div>
                                {editingProduct.departmentId && editModalProductCategories.length === 0 && (
                                    <p style={{ marginTop: 6, color: '#B91C1C', fontSize: 12 }}>
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

                            <div className="mc-form-row">
                                <div className="mc-form-group">
                                    <label>{t('label.type')}</label>
                                    <div className="mc-select-wrapper">
                                        <select 
                                            value={editingProduct.type} 
                                            onChange={(e) => setEditingProduct({...editingProduct, type: e.target.value})}
                                        >
                                            <option value="Product">{t('opt.product')}</option>
                                            <option value="Service">{t('opt.service')}</option>
                                        </select>
                                        <ChevronDown size={14} />
                                    </div>
                                </div>
                            </div>

                            <div className="mc-form-row">
                                <div className="mc-form-group">
                                    <label>{t('label.salePrice')}</label>
                                    <input 
                                        {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                        value={editingProduct.salePrice} 
                                        onChange={(e) => setEditingProduct({...editingProduct, salePrice: sanitizeNonNegativeMoneyInput(e.target.value)})}
                                    />
                                </div>
                                <div className="mc-form-group">
                                    <label>{t('label.purchasePrice')}</label>
                                    <input 
                                        {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                        value={editingProduct.purchasePrice || ''} 
                                        onChange={(e) => setEditingProduct({...editingProduct, purchasePrice: sanitizeNonNegativeMoneyInput(e.target.value)})}
                                    />
                                </div>
                            </div>

                            <div className="mc-form-row">
                                <div className="mc-form-group">
                                    <label>{t('label.minCorp')}</label>
                                    <input 
                                        {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                        placeholder={t('ph.price')}
                                        value={editingProduct.minCorpPrice || ''} 
                                        onChange={(e) => setEditingProduct({...editingProduct, minCorpPrice: sanitizeNonNegativeMoneyInput(e.target.value)})}
                                    />
                                </div>
                                <div className="mc-form-group">
                                    <label>{t('label.maxCorp')}</label>
                                    <input 
                                        {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                        placeholder={t('ph.price')}
                                        value={editingProduct.maxCorpPrice || ''} 
                                        onChange={(e) => setEditingProduct({...editingProduct, maxCorpPrice: sanitizeNonNegativeMoneyInput(e.target.value)})}
                                    />
                                </div>
                            </div>

                            <div className="mc-form-group">
                                <label>{t('label.kmType')}</label>
                                <input
                                    type="number"
                                    placeholder={t('ph.kmEmpty')}
                                    value={editingProduct.kmTypeValue ?? ''}
                                    onChange={(e) =>
                                        setEditingProduct({ ...editingProduct, kmTypeValue: e.target.value })
                                    }
                                />
                            </div>

                            <div className="mc-form-group">
                                <label>{t('label.description')}</label>
                                <input 
                                    type="text" 
                                    placeholder={t('ph.description')} 
                                    value={editingProduct.description || ''} 
                                    onChange={(e) => setEditingProduct({...editingProduct, description: e.target.value})}
                                />
                            </div>

                            <div className="mc-form-row">
                                <div className="mc-toggle-box yellow">
                                    <div className="mc-toggle-info">
                                        <strong>{t('toggle.productStatus')}</strong>
                                        <span>{editingProduct.isActive !== false ? t('status.active') : t('status.inactive')}</span>
                                    </div>
                                    <div
                                        className={`mc-toggle-switch small${editingProduct.isActive !== false ? ' active' : ''}`}
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
                                className="mc-toggle-box yellow"
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
                                <div className="mc-toggle-info">
                                    <strong>{t('toggle.priceEditablePos')}</strong>
                                    <span>{editingProduct.isPriceEditable ? t('toggle.customPrice') : t('toggle.fixedCatalog')}</span>
                                </div>
                                <div
                                    className={`mc-toggle-switch small${editingProduct.isPriceEditable ? ' active' : ''}`}
                                    aria-hidden
                                />
                            </div>

                            {editingProduct.isPriceEditable && (
                                <div className="mc-form-group">
                                    <label>{t('label.minEditable')}</label>
                                    <input
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
                                className="mc-toggle-box blue-toggle"
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
                                <div className="mc-toggle-info">
                                    <strong>{t('toggle.decimalQty')}</strong>
                                    <span>{t('toggle.decimalQtyHint')}</span>
                                </div>
                                <div
                                    className={`mc-toggle-switch small${editingProduct.allowDecimalQty ? ' active' : ''}`}
                                    aria-hidden
                                />
                            </div>

                            <div
                                className="mc-toggle-box blue-toggle"
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
                                <div className="mc-toggle-info">
                                    <strong>{t('toggle.minusQty')}</strong>
                                    <span>{t('toggle.minusQtyHint')}</span>
                                </div>
                                <div
                                    className={`mc-toggle-switch small${editingProduct.allowMinusQty ? ' active' : ''}`}
                                    aria-hidden
                                />
                            </div>

                            <div className="mc-modal-footer">
                                <button className="mc-btn-ghost mc-btn-large" onClick={handleDeleteCatalogProduct} disabled={saving}>
                                    {t('btn.delete')}
                                </button>
                                <button className="mc-btn-primary mc-btn-large" onClick={handleUpdateCatalogProduct} disabled={saving}>
                                    {saving ? t('btn.saving') : t('btn.updateProduct')}
                                </button>
                                <button className="mc-btn-ghost mc-btn-large" onClick={goBack}>{t('btn.cancel')}</button>
                            </div>
                        </div>
                    </MasterCatalogShell>
                )}
            </AnimatePresence>

            {/* Add Product */}
            <AnimatePresence>
                {pageMode && route?.screen === 'product-new' && (
                    <MasterCatalogShell
                        title={<div className="mc-modal-title"><CheckCircle2 size={18} color="#D4A017" /> {t('modal.addProduct')}</div>}
                        onClose={goBack}
                        className="sa-mc-modal"
                    >
                        <div className="mc-modal-banner">
                            {t('banner.productsApproved')}
                        </div>
                        
                        <div className="mc-modal-form">
                            <div className="mc-form-group">
                                <label>{t('label.productName')}</label>
                                <input
                                    type="text"
                                    placeholder={t('ph.productExample')}
                                    value={newProduct.name}
                                    onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                                />
                            </div>

                            <div className="mc-form-group">
                                <label>{t('label.arabicName')}</label>
                                <input
                                    type="text"
                                    dir="rtl"
                                    placeholder={t('ph.arabic')}
                                    value={newProduct.arabicName}
                                    onChange={(e) => setNewProduct({ ...newProduct, arabicName: e.target.value })}
                                />
                            </div>

                            <div className="mc-form-row">
                                <div className="mc-form-group">
                                    <label>{t('label.sku')}</label>
                                    <input 
                                        type="text" 
                                        placeholder={t('ph.skuProduct')} 
                                        value={newProduct.sku}
                                        onChange={(e) => setNewProduct({...newProduct, sku: e.target.value})}
                                    />
                                </div>
                                <div className="mc-form-group">
                                    <label>{t('label.brand')}</label>
                                    <input 
                                        type="text" 
                                        placeholder={t('ph.brand')} 
                                        value={newProduct.brand}
                                        onChange={(e) => setNewProduct({...newProduct, brand: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="mc-form-group">
                                <label>{t('label.department')}</label>
                                <div className="mc-select-wrapper">
                                    <select
                                        value={newProduct.departmentId}
                                        onChange={(e) => setNewProduct({ ...newProduct, departmentId: e.target.value, categoryId: '' })}
                                    >
                                        <option value="">{t('label.selectDeptOpt')}</option>
                                        {departments.map((dept) => (
                                            <option key={dept.id} value={String(dept.id)}>{dept.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={14} />
                                </div>
                            </div>

                            <div className="mc-form-group">
                                <label>{t('label.category')}</label>
                                <div className="mc-select-wrapper">
                                    <select 
                                        value={newProduct.categoryId}
                                        onChange={(e) => setNewProduct({...newProduct, categoryId: e.target.value})}
                                        disabled={!newProduct.departmentId}
                                    >
                                        <option value="">{t('label.selectCategory')}</option>
                                        {selectedProductCategories.map(cat => (
                                            <option key={cat.id} value={String(cat.id)}>{cat.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={14} />
                                </div>
                                {newProduct.departmentId && selectedProductCategories.length === 0 && (
                                    <p style={{ marginTop: 6, color: '#B91C1C', fontSize: 12 }}>
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

                            <div className="mc-form-row">
                                <div className="mc-form-group">
                                    <label>{t('label.type')}</label>
                                    <div className="mc-select-wrapper">
                                        <select>
                                            <option value="Product">{t('opt.product')}</option>
                                            <option value="Service">{t('opt.service')}</option>
                                        </select>
                                        <ChevronDown size={14} />
                                    </div>
                                </div>
                            </div>

                            <div className="mc-form-row">
                                <div className="mc-form-group">
                                    <label>{t('label.salePrice')}</label>
                                    <input
                                        {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                        placeholder={t('ph.price')}
                                        value={newProduct.salePrice}
                                        onChange={(e) => setNewProduct({...newProduct, salePrice: sanitizeNonNegativeMoneyInput(e.target.value)})}
                                    />
                                </div>
                                <div className="mc-form-group">
                                    <label>{t('label.purchasePrice')}</label>
                                    <input
                                        {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                        placeholder={t('ph.price')}
                                        value={newProduct.purchasePrice}
                                        onChange={(e) => setNewProduct({...newProduct, purchasePrice: sanitizeNonNegativeMoneyInput(e.target.value)})}
                                    />
                                </div>
                            </div>

                            <div className="mc-form-row">
                                <div className="mc-form-group">
                                    <label>{t('label.minCorp')}</label>
                                    <input
                                        {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                        placeholder={t('ph.price')}
                                        value={newProduct.minCorpPrice || ''}
                                        onChange={(e) => setNewProduct({...newProduct, minCorpPrice: sanitizeNonNegativeMoneyInput(e.target.value)})}
                                    />
                                </div>
                                <div className="mc-form-group">
                                    <label>{t('label.maxCorp')}</label>
                                    <input
                                        {...NON_NEGATIVE_MONEY_INPUT_ATTRS}
                                        placeholder={t('ph.price')}
                                        value={newProduct.maxCorpPrice || ''}
                                        onChange={(e) => setNewProduct({...newProduct, maxCorpPrice: sanitizeNonNegativeMoneyInput(e.target.value)})}
                                    />
                                </div>
                            </div>

                            <div className="mc-form-group">
                                <label>{t('label.kmType')}</label>
                                <input
                                    type="number"
                                    placeholder={t('ph.kmEmpty')}
                                    value={newProduct.kmTypeValue ?? ''}
                                    onChange={(e) => setNewProduct({ ...newProduct, kmTypeValue: e.target.value })}
                                />
                            </div>

                            <div className="mc-form-group">
                                <label>{t('label.description')}</label>
                                <input
                                    type="text"
                                    placeholder={t('ph.description')}
                                    value={newProduct.description}
                                    onChange={(e) => setNewProduct({...newProduct, description: e.target.value})}
                                />
                            </div>

                            <div className="mc-toggle-box yellow">
                                <div className="mc-toggle-info">
                                    <strong>{t('toggle.allowCashierPrice')}</strong>
                                    <span>{t('toggle.allowCashierPriceHint')}</span>
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
                                <div className="mc-form-group">
                                    <label>{t('label.minEditable')}</label>
                                    <input
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
                                className="mc-toggle-box blue-toggle"
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
                                <div className="mc-toggle-info">
                                    <strong>{t('toggle.decimalQty')}</strong>
                                    <span>{t('toggle.decimalQtyHint')}</span>
                                </div>
                                <div
                                    className={`mc-toggle-switch small${newProduct.allowDecimalQty ? ' active' : ''}`}
                                    aria-hidden
                                />
                            </div>

                            <div
                                className="mc-toggle-box blue-toggle"
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
                                <div className="mc-toggle-info">
                                    <strong>{t('toggle.minusQty')}</strong>
                                    <span>{t('toggle.minusQtyHint')}</span>
                                </div>
                                <div
                                    className={`mc-toggle-switch small${newProduct.allowMinusQty ? ' active' : ''}`}
                                    aria-hidden
                                />
                            </div>

                            <div className="mc-modal-footer">
                                <button className="mc-btn-primary mc-btn-large" onClick={handleCreateProduct} disabled={saving || !isProductFormValid}>
                                    {saving ? t('btn.saving') : t('btn.addToMaster')}
                                </button>
                                <button className="mc-btn-ghost mc-btn-large" onClick={goBack}>{t('btn.cancel')}</button>
                            </div>
                            {!isProductFormValid && (
                                <p style={{ marginTop: 8, color: '#B91C1C', fontSize: 12 }}>
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
                        title={<div className="mc-modal-title"><Upload size={18} color="#2563EB" /> {t('modal.bulkProducts')}</div>}
                        onClose={closeBulkProductModal}
                        className="sa-mc-modal"
                    >
                        <div className="mc-bulk-format-card redesigned">
                            <div className="mc-bulk-header">
                                <Box size={18} />
                                <strong>{t('bulk.uploadFormat')}</strong>
                            </div>
                            <p>{t('bulk.productIntro')}</p>
                            <div className="mc-bulk-bullets">
                                <span>{t('bulk.productCols', { cols: PRODUCT_CSV_COLUMNS.join(', ') })}</span>
                                <span>{t('bulk.productDeptHint')}</span>
                                <span>{t('bulk.productDupHint')}</span>
                            </div>
                        </div>

                        <a className="mc-template-btn dashed" href={productsCsvTemplate} download="master-catalog-products-template.csv">
                            <Download size={18} /> {t('btn.downloadTemplate')}
                        </a>

                        <label className="mc-upload-dropzone blue-dashed" htmlFor="bulk-csv-upload-input">
                            <Layers size={24} color="#3B82F6" />
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
                                <div className="mc-bulk-import-result">
                                    {summary ? <p className="mc-bulk-import-summary">{summary}</p> : null}
                                    {hasVat && (
                                        <details className="mc-bulk-import-details">
                                            <summary>{t('bulk.vatWarnings')}</summary>
                                            <ul>
                                                {vat.slice(0, 100).map((w, i) => (
                                                    <li key={i}>{formatVatWarningItem(w)}</li>
                                                ))}
                                            </ul>
                                        </details>
                                    )}
                                    {hasRows && (
                                        <details className="mc-bulk-import-details">
                                            <summary>{t('bulk.skippedRows')}</summary>
                                            <ul>
                                                {rows.slice(0, 500).map((row, i) => (
                                                    <li key={i}>{formatRowDetailItem(row)}</li>
                                                ))}
                                            </ul>
                                        </details>
                                    )}
                                    {!knownShape && !hasVat && !hasRows && (
                                        <pre className="mc-bulk-import-raw">{JSON.stringify(bulkImportResult, null, 2)}</pre>
                                    )}
                                </div>
                            );
                        })()}

                        <div className="mc-modal-footer row">
                            <button type="button" className="mc-btn-ghost mc-btn-large" onClick={closeBulkProductModal} disabled={bulkImporting}>
                                {t('btn.cancel')}
                            </button>
                            <button
                                className={`mc-btn-primary mc-btn-large ${!selectedBulkFile || bulkImporting ? 'disabled-blue' : ''}`}
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
                        title={<div className="mc-modal-title"><Upload size={18} color="#9333EA" /> {t('modal.bulkServices')}</div>}
                        onClose={closeBulkServiceModal}
                        className="sa-mc-modal"
                    >
                        <div className="mc-bulk-format-card redesigned">
                            <div className="mc-bulk-header">
                                <Box size={18} />
                                <strong>{t('bulk.uploadFormat')}</strong>
                            </div>
                            <p>{t('bulk.serviceIntro', { cols: SERVICE_CSV_COLUMNS.join(', ') })}</p>
                            <div className="mc-bulk-bullets">
                                <span>{t('bulk.serviceOrder')}</span>
                                <span>{t('bulk.serviceCase')}</span>
                                <span>{t('bulk.serviceHeader')}</span>
                                <span>{t('bulk.serviceRowHint')}</span>
                            </div>
                        </div>

                        <a className="mc-template-btn dashed" href={servicesCsvTemplate} download="Services.csv">
                            <Download size={18} /> {t('btn.downloadTemplate')}
                        </a>

                        <label className="mc-upload-dropzone blue-dashed" htmlFor="bulk-service-csv-upload-input">
                            <Layers size={24} color="#9333EA" />
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
                                <div className="mc-bulk-import-result">
                                    {summary ? <p className="mc-bulk-import-summary">{summary}</p> : null}
                                    {hasVat && (
                                        <details className="mc-bulk-import-details">
                                            <summary>{t('bulk.vatWarnings')}</summary>
                                            <ul>
                                                {vat.slice(0, 100).map((w, i) => (
                                                    <li key={i}>{formatVatWarningItem(w)}</li>
                                                ))}
                                            </ul>
                                        </details>
                                    )}
                                    {hasRows && (
                                        <details className="mc-bulk-import-details">
                                            <summary>{t('bulk.skippedRows')}</summary>
                                            <ul>
                                                {rows.slice(0, 500).map((row, i) => (
                                                    <li key={i}>{formatRowDetailItem(row)}</li>
                                                ))}
                                            </ul>
                                        </details>
                                    )}
                                    {!knownShape && !hasVat && !hasRows && (
                                        <pre className="mc-bulk-import-raw">{JSON.stringify(bulkServiceImportResult, null, 2)}</pre>
                                    )}
                                </div>
                            );
                        })()}

                        <div className="mc-modal-footer row">
                            <button type="button" className="mc-btn-ghost mc-btn-large" onClick={closeBulkServiceModal} disabled={bulkServiceImporting}>
                                {t('btn.cancel')}
                            </button>
                            <button
                                className={`mc-btn-primary mc-btn-large purple-btn ${!selectedBulkServiceFile || bulkServiceImporting ? 'disabled-blue' : ''}`}
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
                        title={<div className="mc-modal-title"><CheckCircle2 size={18} color="#15803D" /> {t('modal.approveRequest')}</div>}
                        onClose={() => !prActionBusy && goBack()}
                        className="sa-mc-modal sa-mc-modal-narrow"
                    >
                        <div className="mc-modal-form">
                            <p className="mc-pr-modal-lead">
                                {t('approve.review', { name: prApproveTarget.name })}
                            </p>
                            <div className="mc-form-grid two">
                                <div className="mc-form-group">
                                    <label>{t('label.nameReq')}</label>
                                    <input
                                        type="text"
                                        value={prApproveForm.name}
                                        onChange={(e) => setPrApproveForm((prev) => ({ ...prev, name: e.target.value }))}
                                        disabled={prActionBusy}
                                        placeholder={t('ph.productName')}
                                    />
                                </div>
                                <div className="mc-form-group">
                                    <label>{t('label.sku')}</label>
                                    <input
                                        type="text"
                                        value={prApproveForm.sku}
                                        onChange={(e) => setPrApproveForm((prev) => ({ ...prev, sku: e.target.value }))}
                                        disabled={prActionBusy}
                                        placeholder={t('label.sku')}
                                    />
                                </div>
                                <div className="mc-form-group">
                                    <label>{t('pr.brand')}</label>
                                    <input
                                        type="text"
                                        value={prApproveForm.brandName}
                                        onChange={(e) => setPrApproveForm((prev) => ({ ...prev, brandName: e.target.value }))}
                                        disabled={prActionBusy}
                                        placeholder={t('pr.brand')}
                                    />
                                </div>
                                <div className="mc-form-group">
                                    <label>{t('label.unit')}</label>
                                    <input
                                        type="text"
                                        value={prApproveForm.unit}
                                        onChange={(e) => setPrApproveForm((prev) => ({ ...prev, unit: e.target.value }))}
                                        disabled={prActionBusy}
                                        placeholder={t('opt.pcs')}
                                    />
                                </div>
                                <div className="mc-form-group">
                                    <label>{t('label.expectedPrice')}</label>
                                    <input
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
                                <div className="mc-form-group">
                                    <label>{t('label.selectDept')}</label>
                                    <select
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
                                <div className="mc-form-group">
                                    <label>{t('label.category')}</label>
                                    <select
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
                            <div className="mc-form-group">
                                <label>{t('label.description')}</label>
                                <textarea
                                    rows={3}
                                    placeholder={t('label.description')}
                                    value={prApproveForm.description}
                                    onChange={(e) => setPrApproveForm((prev) => ({ ...prev, description: e.target.value }))}
                                    disabled={prActionBusy}
                                />
                            </div>
                            <div className="mc-form-group">
                                <label>{t('label.arabicName')}</label>
                                <input
                                    type="text"
                                    value={prApproveForm.arabicName}
                                    onChange={(e) => setPrApproveForm((prev) => ({ ...prev, arabicName: e.target.value }))}
                                    disabled={prActionBusy}
                                    placeholder={t('label.arabicName')}
                                />
                            </div>
                            <div className="mc-form-group">
                                <label>{t('label.remarks')}</label>
                                <textarea
                                    rows={3}
                                    placeholder={t('ph.auditNote')}
                                    value={prRemarks}
                                    onChange={(e) => setPrRemarks(e.target.value)}
                                    disabled={prActionBusy}
                                />
                            </div>
                            <div className="mc-modal-footer">
                                <button
                                    type="button"
                                    className="mc-btn-primary mc-btn-large"
                                    onClick={handlePrApproveConfirm}
                                    disabled={prActionBusy}
                                >
                                    {prActionBusy ? t('btn.approving') : t('btn.confirmApprove')}
                                </button>
                                <button
                                    type="button"
                                    className="mc-btn-ghost mc-btn-large"
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
                        title={<div className="mc-modal-title"><XCircle size={18} color="#B91C1C" /> {t('modal.rejectRequest')}</div>}
                        onClose={() => !prActionBusy && goBack()}
                        className="sa-mc-modal sa-mc-modal-narrow"
                    >
                        <div className="mc-modal-form">
                            <p className="mc-pr-modal-lead">
                                {t('reject.confirm', { name: prRejectTarget.name })}
                            </p>
                            <div className="mc-form-group">
                                <label>{t('label.reasonReq')}</label>
                                <textarea
                                    rows={3}
                                    placeholder={t('ph.rejectReason')}
                                    value={prRejectReason}
                                    onChange={(e) => setPrRejectReason(e.target.value)}
                                    disabled={prActionBusy}
                                />
                                {!prRejectReason.trim() && (
                                    <p className="mc-pr-modal-hint">{t('val.reasonRequired')}</p>
                                )}
                            </div>
                            <div className="mc-modal-footer">
                                <button
                                    type="button"
                                    className="mc-btn-primary mc-btn-large"
                                    style={{ background: '#B91C1C' }}
                                    onClick={handlePrRejectConfirm}
                                    disabled={prActionBusy || !prRejectReason.trim()}
                                >
                                    {prActionBusy ? t('btn.rejecting') : t('btn.confirmReject')}
                                </button>
                                <button
                                    type="button"
                                    className="mc-btn-ghost mc-btn-large"
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
                <div className={`mc-toast mc-toast-${toast.kind}`} role="status" aria-live="polite">
                    {toast.message}
                </div>
            )}
        </div>
    );
}
