import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Plus,
    Calendar,
    RotateCcw,
    Trash2,
    Zap,
    Building2,
    Loader2,
    RefreshCw,
    FileText,
    Printer,
    Download,
    BookOpen,
    Landmark,
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import RowActionsMenu from '../../components/RowActionsMenu';
import InlineFormScreen from '../../components/InlineFormScreen';
import InvoiceRefField from '../../components/invoices/InvoiceRefField';
import WorkshopPurchaseInvoiceView from '../../components/supplier/WorkshopPurchaseInvoiceView';
import { getNextSupplierDebitNoteReference } from '../../services/invoiceReferenceApi';
import '../../styles/admin/AccountingPage.css';
import {
    createSupplierSuperSupplierDebitNote,
    getSupplierSuperSupplierDebitNote,
    getSupplierSuperSupplierPurchase,
    getSuperSupplierApLedger,
    fetchAllSupplierProducts,
    listSupplierMasterCatalogProducts,
    listSupplierSuperSupplierDebitNotes,
    listSupplierSuperSupplierPurchases,
    listSupplierSuperSuppliers,
    updateSupplierSuperSupplierDebitNote,
} from '../../services/supplierApi';
import {
    getSupplierAccounts,
    unwrapSupplierAccountingList,
} from '../../services/supplierAccountingApi';
import { ShimmerTable, ShimmerTextBlock } from '../../components/supplier/Shimmer';
import { sdnT } from '../../utils/supplierDebitNotesI18n';
import { activeLeafAccounts } from './accounting/SupplierAccountingShared';
import {
    resolveInvoiceLineProductName,
    isLikelyGlAccountLabel,
} from '../../utils/invoiceLineLabel';
import { navigateToSupplierCustomerLedger } from './openSupplierCustomerLedger';

const TAXES = [
    { id: 0, name: 'No tax', percent: 0, code: 'No tax', rate: 0 },
    { id: 1, name: 'VAT 15%', percent: 15, code: 'VAT 15%', rate: 0.15 },
    { id: 2, name: 'VAT 5%', percent: 5, code: 'VAT 5%', rate: 0.05 },
    { id: 3, name: 'VAT 0%', percent: 0, code: 'VAT 0%', rate: 0 },
    { id: 4, name: 'Exempt', percent: 0, code: 'Exempt', rate: 0 },
];

function roundMoney2(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
}

function computeLineFinancials(line, amountsTaxInclusive) {
    const qty = parseFloat(String(line.qty).replace(',', '.')) || 0;
    const unitInput = parseFloat(String(line.price).replace(',', '.')) || 0;
    const discRaw = parseFloat(String(line.discount ?? 0).replace(',', '.')) || 0;
    const discMode = line.discountMode === 'fixed_sar' ? 'fixed_sar' : 'percent';
    const rate =
        TAXES.find((t) => t.code === line.taxCode)?.rate ?? 0;

    let lineEx = 0;
    let taxAmt = 0;
    let grandIncl = 0;

    if (amountsTaxInclusive) {
        const grossInclBeforeDisc = roundMoney2(qty * unitInput);
        let netIncl = grossInclBeforeDisc;
        if (discMode === 'percent') {
            const pct = Math.min(100, Math.max(0, discRaw));
            netIncl = roundMoney2(grossInclBeforeDisc * (1 - pct / 100));
        } else {
            netIncl = roundMoney2(Math.max(0, grossInclBeforeDisc - discRaw));
        }
        lineEx =
            netIncl > 0 && rate > 0
                ? roundMoney2(netIncl / (1 + rate))
                : roundMoney2(netIncl);
        grandIncl = netIncl;
        taxAmt = roundMoney2(Math.max(0, grandIncl - lineEx));
    } else {
        const grossExBeforeDisc = roundMoney2(qty * unitInput);
        let lineExAdj = grossExBeforeDisc;
        if (discMode === 'percent') {
            const pct = Math.min(100, Math.max(0, discRaw));
            lineExAdj = roundMoney2(grossExBeforeDisc * (1 - pct / 100));
        } else {
            lineExAdj = roundMoney2(Math.max(0, grossExBeforeDisc - discRaw));
        }
        lineEx = lineExAdj;
        taxAmt = roundMoney2(lineEx * rate);
        grandIncl = roundMoney2(lineEx + taxAmt);
    }

    return {
        lineEx,
        taxAmt,
        grandIncl,
        taxAmtStr: taxAmt.toFixed(2),
        grandInclStr: grandIncl.toFixed(2),
        lineExStr: lineEx.toFixed(2),
    };
}

function applyLineTotals(line, amountsTaxInclusive) {
    const f = computeLineFinancials(line, amountsTaxInclusive);
    return {
        ...line,
        taxAmt: f.taxAmtStr,
        totalFinal: f.grandInclStr,
    };
}

function reconstructUnitPriceInput(it, amountsTaxInclusive, taxCode) {
    const rate = TAXES.find((t) => t.code === taxCode)?.rate ?? 0;
    const qty = Math.max(
        0.000001,
        parseFloat(String(it.qty ?? 1).replace(',', '.')) || 1,
    );
    const U_net = Number(it.unitPrice ?? 0);
    const discRaw = Number(it.lineDiscountValue ?? 0);
    const discMode =
        it.lineDiscountMode === 'fixed_sar' ? 'fixed_sar' : 'percent';

    if (!(discRaw > 0)) {
        if (!amountsTaxInclusive) return String(roundMoney2(U_net));
        return String(roundMoney2(U_net * (1 + rate)));
    }
    if (!amountsTaxInclusive) {
        if (discMode === 'percent') {
            const pct = Math.min(100, Math.max(0, discRaw));
            const denom = 1 - pct / 100;
            if (denom <= 0 || denom >= 1) return String(roundMoney2(U_net));
            return String(roundMoney2(U_net / denom));
        }
        const grossLineEx = roundMoney2(U_net * qty + discRaw);
        return String(roundMoney2(grossLineEx / qty));
    }
    const netIncl = roundMoney2(U_net * qty * (1 + rate));
    if (discMode === 'percent') {
        const pct = Math.min(100, Math.max(0, discRaw));
        const denom = 1 - pct / 100;
        const grossInclBeforeDisc =
            denom <= 0 ? netIncl : roundMoney2(netIncl / denom);
        return String(roundMoney2(grossInclBeforeDisc / qty));
    }
    return String(roundMoney2((netIncl + discRaw) / qty));
}

function nextLineId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function sarFmt(v) {
    return Number(v ?? 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function masterCatalogWarehouseUnit(raw, fallback = 'pcs') {
    const wu = String(raw?.warehouseUnit ?? '').trim();
    if (wu) return wu;
    const code = String(raw?.unitCode ?? '').trim();
    if (code) return code;
    return fallback;
}

function mapCatalogRow(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const mid =
        raw.id != null && raw.id !== ''
            ? String(raw.id)
            : raw.masterProductId != null
              ? String(raw.masterProductId)
              : '';
    if (!mid) return null;
    const warehouseUnit = masterCatalogWarehouseUnit(raw, 'pcs');
    const workshopUnit =
        String(raw.workshopUnit ?? '').trim() || warehouseUnit;
    const conversionFactor = Number(raw.conversionFactor) || 1;
    return {
        id: mid,
        masterProductId: mid,
        sku: String(raw.sku ?? raw.barcode ?? '').trim(),
        name: raw.name || raw.productName || 'Product',
        price: Math.max(0, Number(raw.purchasePrice ?? raw.salePrice ?? 0) || 0),
        unit: warehouseUnit,
        warehouseUnit,
        workshopUnit,
        conversionFactor,
    };
}

function mapSupplierProductRow(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const id = raw.id != null && String(raw.id).trim() !== '' ? String(raw.id) : '';
    if (!id) return null;
    const warehouseUnit = masterCatalogWarehouseUnit(raw, 'pcs');
    const workshopUnit = String(raw.workshopUnit ?? '').trim() || warehouseUnit;
    const conversionFactor = Number(raw.conversionFactor) || 1;
    const mid =
        raw.masterProductId != null && String(raw.masterProductId).trim() !== ''
            ? String(raw.masterProductId)
            : null;
    return {
        id,
        masterProductId: mid,
        sku: String(raw.sku ?? raw.barcode ?? '').trim(),
        name: raw.productName || raw.name || raw.product || 'Product',
        price: Math.max(
            0,
            Number(
                raw.pricePerWarehouseUnit ??
                    raw.basePrice ??
                    raw.purchasePrice ??
                    raw.salePrice ??
                    0,
            ) || 0,
        ),
        unit: warehouseUnit,
        warehouseUnit,
        workshopUnit,
        conversionFactor,
    };
}

function mergeCatalogForDebitNote(supplierRows, masterRows) {
    const supplier = (Array.isArray(supplierRows) ? supplierRows : [])
        .map(mapSupplierProductRow)
        .filter(Boolean);
    const seenMid = new Set(
        supplier.map((r) => r.masterProductId).filter(Boolean),
    );
    const seenSku = new Set(
        supplier.map((r) => String(r.sku || '').trim().toLowerCase()).filter(Boolean),
    );
    const extras = (Array.isArray(masterRows) ? masterRows : [])
        .map(mapCatalogRow)
        .filter(Boolean)
        .filter((m) => {
            if (m.masterProductId && seenMid.has(m.masterProductId)) return false;
            const sku = String(m.sku || '').trim().toLowerCase();
            if (sku && seenSku.has(sku)) return false;
            return true;
        });
    return [...supplier, ...extras];
}

function accountOptionLabel(opt) {
    if (!opt) return '';
    return `${opt.code} - ${opt.name}`;
}

function defaultDebitNoteAccountLabel(options) {
    const list = Array.isArray(options) ? options : [];
    const hit =
        list.find((a) => String(a.code) === '1410') ||
        list.find((a) => String(a.seedKey || '').toUpperCase() === 'INVENTORY') ||
        list.find((a) => /inventory/i.test(String(a.name || ''))) ||
        list[0];
    return hit ? accountOptionLabel(hit) : '1410 - Inventory Asset';
}

function findDnCapsRow(line, inventoryItems) {
    const pid = String(line?.supplierProductId ?? '').trim();
    const mid = String(line?.masterProductId ?? '').trim();
    if (!pid && !mid) return null;
    const items = Array.isArray(inventoryItems) ? inventoryItems : [];
    return (
        (mid
            ? items.find((inv) => String(inv.masterProductId ?? '') === mid) ||
              items.find((inv) => String(inv.id) === mid)
            : null) ??
        (pid
            ? items.find((inv) => String(inv.masterProductId ?? '') === pid) ||
              items.find((inv) => String(inv.id) === pid)
            : null) ??
        null
    );
}

function formatDnUomConversionPreview(line, inv, t) {
    if (!inv && !(Number(line?.conversionFactor) > 1)) return '';
    const cf =
        Number(inv?.conversionFactor ?? line?.conversionFactor) || 1;
    if (!(cf > 1)) return '';
    const wu =
        String(inv?.warehouseUnit ?? line?.warehouseUnit ?? line?.uom ?? '').trim() ||
        'Box';
    const wsu =
        String(
            inv?.workshopUnit ?? line?.workshopUnitCatalog ?? '',
        ).trim() || 'pcs';
    const qty = parseFloat(String(line.qty).replace(',', '.')) || 0;
    if (!(qty > 0)) return '';
    const wsQty = roundMoney2(qty * cf);
    if (t) {
        return t('uom.previewReturn', { qty, wu, wsQty, wsu });
    }
    return `${qty} ${wu} → −${wsQty} ${wsu} from warehouse`;
}

function mapDebitNoteToViewDetail(dn, superSuppliers) {
    if (!dn || typeof dn !== 'object') return {};
    const ss = Array.isArray(superSuppliers)
        ? superSuppliers.find((s) => String(s.id) === String(dn.superSupplierId))
        : null;
    return {
        id: dn.id,
        invoiceNo: dn.debitNoteNo,
        debitNoteNo: dn.debitNoteNo,
        issueDate: dn.issueDate,
        invoiceDate: dn.issueDate,
        status: dn.status,
        paymentStatus: String(dn.status || '').toLowerCase() === 'draft' ? 'draft' : 'posted',
        description: (() => {
            const raw = String(dn.description ?? '').trim();
            if (raw && !/^(purchase\s*invoice|tax\s*invoice|sales\s*invoice|invoice)$/i.test(raw)) {
                return raw;
            }
            return dn.purchaseInvoiceNo
                ? `Purchase return against ${dn.purchaseInvoiceNo}`
                : 'Purchase return — goods returned to vendor';
        })(),
        notes: dn.notes,
        superSupplierName: dn.superSupplierName,
        superSupplierVatNumber: ss?.vatNumber ?? dn.superSupplierVatNumber ?? '',
        superSupplierMobile: ss?.mobile ?? dn.superSupplierMobile ?? '',
        vendorRef: dn.purchaseInvoiceNo || dn.purchaseReferenceNo || dn.referenceNo,
        purchaseInvoiceNo: dn.purchaseInvoiceNo || null,
        purchaseReferenceNo: dn.purchaseReferenceNo || null,
        amount: dn.amount,
        subtotal: dn.subtotalLines ?? dn.amount,
        vatAmount: dn.vatAmount,
        total: dn.total,
        grandTotal: dn.total,
        items: (Array.isArray(dn.items) ? dn.items : []).map((it) => ({
            id: it.id,
            productName: it.productName,
            sku: it.sku,
            lineDescription: it.lineDescription,
            qty: it.qty,
            unit: it.unit || 'pcs',
            unitPrice: it.unitPrice,
            lineTotal: it.lineTotal,
        })),
    };
}

function mapDebitNoteToViewListRow(dn) {
    if (!dn || typeof dn !== 'object') return {};
    return {
        id: dn.id,
        invoice_number: dn.debitNoteNo,
        invoiceNo: dn.debitNoteNo,
        debitNoteNo: dn.debitNoteNo,
        date: dn.issueDate,
        status: dn.status,
        grand_total: dn.total,
        superSupplierName: dn.superSupplierName,
    };
}

function scoreItem(item, q) {
    const name = String(item.name || '').toLowerCase();
    const sku = String(item.sku || '').toLowerCase();
    if (!q) return 0;
    if (sku === q) return 100;
    if (name === q) return 95;
    if (sku.startsWith(q)) return 90;
    if (name.startsWith(q)) return 85;
    if (sku.includes(q)) return 70;
    if (name.includes(q)) return 60;
    return 0;
}

function evalMaybeMath(raw) {
    const s = String(raw ?? '').trim().replace(',', '.');
    if (!s) return 0;
    if (/^[\d.\s+\-*/()]+$/.test(s)) {
        try {
            const n = Function(`"use strict"; return (${s})`)();
            if (Number.isFinite(n)) return n;
        } catch {
            /* fall through */
        }
    }
    return parseFloat(s) || 0;
}

function emptyLine(defaultAccount) {
    const id = nextLineId();
    return applyLineTotals(
        {
            id,
            item: '',
            sku: '',
            supplierProductId: undefined,
            masterProductId: undefined,
            account: defaultAccount || '1410 - Inventory Asset',
            description: '',
            uom: 'pcs',
            warehouseUnit: 'pcs',
            workshopUnitCatalog: null,
            conversionFactor: 1,
            qty: 1,
            price: 0,
            discount: 0,
            discountMode: 'percent',
            taxCode: 'No tax',
            taxAmt: '0.00',
            totalFinal: '0.00',
        },
        false,
    );
}

export default function SupplierPurchaseDebitNotes({ locale: localeProp } = {}) {
    const locale =
        localeProp ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => sdnT(locale, key, vars), [locale]);
    const money = useCallback((amount) => t('money.sar', { amount }), [t]);
    const navigate = useNavigate();
    const location = useLocation();

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');

    const [modalOpen, setModalOpen] = useState(false);
    const [mode, setMode] = useState('create');
    const [editingId, setEditingId] = useState(null);
    const [editingStatus, setEditingStatus] = useState(null);
    const [editLoading, setEditLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [createError, setCreateError] = useState('');

    const [superSuppliers, setSuperSuppliers] = useState([]);
    const [ssLoading, setSsLoading] = useState(false);
    const [purchases, setPurchases] = useState([]);
    const [purchasesLoading, setPurchasesLoading] = useState(false);
    const [catalogItems, setCatalogItems] = useState([]);
    const [catalogLoading, setCatalogLoading] = useState(false);
    const [invoiceCoaAccounts, setInvoiceCoaAccounts] = useState([]);

    const [showLineNum, setShowLineNum] = useState(false);
    const [showDesc, setShowDesc] = useState(false);
    const [showDiscount, setShowDiscount] = useState(false);
    const [amountsTaxInclusive, setAmountsTaxInclusive] = useState(false);

    const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [refNo, setRefNo] = useState('');
    const [refAutoGenerate, setRefAutoGenerate] = useState(false);
    const [superSupplierId, setSuperSupplierId] = useState('');
    const [purchaseId, setPurchaseId] = useState('');
    const [description, setDescription] = useState('');
    const [lineItems, setLineItems] = useState([]);

    const [itemPickerLineId, setItemPickerLineId] = useState(null);
    const [itemPickerFilter, setItemPickerFilter] = useState('');
    const [itemPickerMenuOpen, setItemPickerMenuOpen] = useState(false);
    const [itemPickerSelectedIndex, setItemPickerSelectedIndex] = useState(-1);
    const lineItemPickerWrapRef = useRef(null);
    const lineItemPickerListRef = useRef(null);
    const lineFieldRefs = useRef({});
    const pendingFocusLineFieldRef = useRef(null);

    const [viewOpen, setViewOpen] = useState(false);
    const [viewLoading, setViewLoading] = useState(false);
    const [viewPayload, setViewPayload] = useState(null);
    const [viewError, setViewError] = useState('');
    const viewDocRef = useRef(null);
    const pdfExportRef = useRef(null);
    const [pdfExportDn, setPdfExportDn] = useState(null);
    const [pdfBusy, setPdfBusy] = useState(false);
    const [openingLedger, setOpeningLedger] = useState(false);

    const invoiceAccountOptions = useMemo(() => {
        const leaves = activeLeafAccounts(invoiceCoaAccounts)
            .map((a) => ({
                code: String(a.code || '').trim(),
                name: String(a.name || '').trim() || String(a.code || '').trim(),
                seedKey: a.seedKey ?? null,
            }))
            .filter((a) => a.code);
        leaves.sort((a, b) =>
            a.code.localeCompare(b.code, undefined, { numeric: true }),
        );
        return leaves;
    }, [invoiceCoaAccounts]);

    const defaultAccountLabel = useMemo(
        () => defaultDebitNoteAccountLabel(invoiceAccountOptions),
        [invoiceAccountOptions],
    );

    const loadList = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const res = await listSupplierSuperSupplierDebitNotes({ limit: 200, offset: 0 });
            setRows(Array.isArray(res?.debitNotes) ? res.debitNotes : []);
        } catch (e) {
            setRows([]);
            setErr(e?.message || t('err.load'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        loadList();
    }, [loadList]);

    useEffect(() => {
        let cancelled = false;
        setSsLoading(true);
        listSupplierSuperSuppliers()
            .then((res) => {
                if (cancelled) return;
                const list = res?.superSuppliers ?? [];
                setSuperSuppliers(Array.isArray(list) ? list : []);
            })
            .catch(() => {
                if (!cancelled) setSuperSuppliers([]);
            })
            .finally(() => {
                if (!cancelled) setSsLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        getSupplierAccounts()
            .then((res) => {
                if (!cancelled) setInvoiceCoaAccounts(unwrapSupplierAccountingList(res));
            })
            .catch(() => {
                if (!cancelled) setInvoiceCoaAccounts([]);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!modalOpen) return undefined;
        let cancelled = false;
        setCatalogLoading(true);
        Promise.allSettled([
            fetchAllSupplierProducts({ status: 'all', pageSize: 2000 }),
            listSupplierMasterCatalogProducts(),
        ])
            .then(([supplierRes, masterRes]) => {
                if (cancelled) return;
                const supplierList =
                    supplierRes.status === 'fulfilled' && Array.isArray(supplierRes.value)
                        ? supplierRes.value
                        : [];
                const rawMaster =
                    masterRes.status === 'fulfilled' ? masterRes.value : null;
                const masters = Array.isArray(rawMaster?.products)
                    ? rawMaster.products
                    : Array.isArray(rawMaster?.items)
                      ? rawMaster.items
                      : Array.isArray(rawMaster)
                        ? rawMaster
                        : [];
                const mapped = mergeCatalogForDebitNote(supplierList, masters);
                setCatalogItems(mapped);
                setLineItems((prev) =>
                    prev.map((line) => {
                        const inv = findDnCapsRow(line, mapped);
                        if (!inv) return line;
                        const whUom = masterCatalogWarehouseUnit(inv, line.warehouseUnit || line.uom || 'pcs');
                        return {
                            ...line,
                            warehouseUnit: whUom,
                            uom: line.supplierProductId ? whUom : line.uom || whUom,
                            workshopUnitCatalog:
                                String(inv.workshopUnit ?? '').trim() ||
                                line.workshopUnitCatalog,
                            conversionFactor:
                                inv.conversionFactor ?? line.conversionFactor ?? 1,
                        };
                    }),
                );
            })
            .catch(() => {
                if (!cancelled) setCatalogItems([]);
            })
            .finally(() => {
                if (!cancelled) setCatalogLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [modalOpen]);

    useEffect(() => {
        if (!modalOpen || !superSupplierId) {
            setPurchases([]);
            return undefined;
        }
        let cancelled = false;
        setPurchasesLoading(true);
        listSupplierSuperSupplierPurchases({
            superSupplierId: String(superSupplierId),
            limit: 200,
            offset: 0,
        })
            .then((res) => {
                if (cancelled) return;
                const list = Array.isArray(res?.purchases) ? res.purchases : [];
                setPurchases(
                    list.filter(
                        (p) => String(p.status || 'posted').toLowerCase() !== 'draft',
                    ),
                );
            })
            .catch(() => {
                if (!cancelled) setPurchases([]);
            })
            .finally(() => {
                if (!cancelled) setPurchasesLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [modalOpen, superSupplierId]);

    useEffect(() => {
        setLineItems((prev) =>
            prev.map((line) => applyLineTotals(line, amountsTaxInclusive)),
        );
    }, [amountsTaxInclusive]);

    useEffect(() => {
        if (!modalOpen || itemPickerLineId == null || !itemPickerMenuOpen) {
            return undefined;
        }
        const onDocMouseDown = (e) => {
            const el = lineItemPickerWrapRef.current;
            if (el && !el.contains(e.target)) {
                setItemPickerMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', onDocMouseDown);
        return () => document.removeEventListener('mousedown', onDocMouseDown);
    }, [modalOpen, itemPickerLineId, itemPickerMenuOpen]);

    const suggestions = useMemo(() => {
        const q = String(itemPickerFilter ?? '').trim().toLowerCase();
        const items = catalogItems;
        if (!q) {
            return [...items].sort((a, b) =>
                String(a.name || '').localeCompare(String(b.name || ''), undefined, {
                    sensitivity: 'base',
                }),
            );
        }
        return items
            .map((item) => ({ item, score: scoreItem(item, q) }))
            .filter((x) => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .map((x) => x.item);
    }, [catalogItems, itemPickerFilter]);

    useEffect(() => {
        setItemPickerSelectedIndex(String(itemPickerFilter ?? '').trim() ? 0 : -1);
    }, [itemPickerFilter, itemPickerLineId]);

    const getLineTabFields = useCallback(() => {
        const fields = ['item', 'account'];
        if (showDesc) fields.push('description');
        fields.push('uom', 'qty', 'price');
        if (showDiscount) {
            fields.push('discount', 'discountMode');
        }
        fields.push('taxCode');
        return fields;
    }, [showDesc, showDiscount]);

    const focusLineField = useCallback((lineId, fieldName) => {
        requestAnimationFrame(() => {
            lineFieldRefs.current[`${lineId}:${fieldName}`]?.focus?.();
        });
    }, []);

    useEffect(() => {
        const pending = pendingFocusLineFieldRef.current;
        if (!pending) return;
        pendingFocusLineFieldRef.current = null;
        focusLineField(pending.lineId, pending.fieldName);
    }, [lineItems.length, focusLineField]);

    useEffect(() => {
        if (
            !modalOpen ||
            itemPickerLineId == null ||
            !itemPickerMenuOpen ||
            !lineItemPickerListRef.current
        ) {
            return;
        }
        const el = lineItemPickerListRef.current.querySelector(
            `[data-pick-idx="${itemPickerSelectedIndex}"]`,
        );
        el?.scrollIntoView({ block: 'nearest' });
    }, [modalOpen, itemPickerLineId, itemPickerMenuOpen, itemPickerSelectedIndex]);

    const resetForm = () => {
        setLineItems([]);
        setRefNo('');
        setRefAutoGenerate(false);
        setSuperSupplierId('');
        setPurchaseId('');
        setDescription('');
        setIssueDate(new Date().toISOString().slice(0, 10));
        setCreateError('');
        setShowLineNum(false);
        setShowDesc(false);
        setShowDiscount(false);
        setAmountsTaxInclusive(false);
        setMode('create');
        setEditingId(null);
        setEditingStatus(null);
        setItemPickerLineId(null);
        setItemPickerMenuOpen(false);
        setItemPickerSelectedIndex(-1);
        setItemPickerFilter('');
    };

    const openCreate = () => {
        resetForm();
        setMode('create');
        setLineItems([emptyLine(defaultAccountLabel)]);
        setModalOpen(true);
    };

    const mapApiItemsToLines = (items, taxIncl, taxCodes) =>
        (Array.isArray(items) ? items : []).map((it, idx) => {
            const taxCode =
                (Array.isArray(taxCodes) && taxCodes[idx]) || 'No tax';
            const discVal = Number(it.lineDiscountValue ?? 0);
            const discMode =
                it.lineDiscountMode === 'fixed_sar' ? 'fixed_sar' : 'percent';
            return applyLineTotals(
                {
                    id: nextLineId(),
                    sku: String(it.sku ?? '').trim(),
                    item: it.productName || '',
                    supplierProductId:
                        it.supplierProductId != null && String(it.supplierProductId).trim() !== ''
                            ? String(it.supplierProductId).trim()
                            : undefined,
                    masterProductId:
                        it.supplierProductId != null
                            ? String(it.supplierProductId).trim()
                            : undefined,
                    account: defaultAccountLabel,
                    description: String(it.lineDescription ?? '').trim(),
                    uom: it.unit || 'pcs',
                    warehouseUnit: it.unit || 'pcs',
                    workshopUnitCatalog: null,
                    conversionFactor: 1,
                    qty: String(it.qty ?? 1),
                    price: reconstructUnitPriceInput(it, taxIncl, taxCode),
                    discount: discVal,
                    discountMode: discMode,
                    taxCode,
                    taxAmt: '0.00',
                    totalFinal: '0.00',
                },
                taxIncl,
            );
        });

    const openEdit = async (id) => {
        setCreateError('');
        setMode('edit');
        setEditingId(String(id));
        setEditLoading(true);
        setModalOpen(true);
        try {
            const res = await getSupplierSuperSupplierDebitNote(id);
            const p = res?.debitNote ?? res?.data ?? res;
            if (!p?.id) {
                setCreateError(t('err.loadEdit'));
                return;
            }
            setEditingStatus(String(p.status || 'posted').trim().toLowerCase());
            setIssueDate((p.issueDate || '').toString().slice(0, 10));
            setSuperSupplierId(String(p.superSupplierId ?? ''));
            setPurchaseId(p.purchaseId ? String(p.purchaseId) : '');
            setRefNo(String(p.referenceNo ?? '').trim());
            setDescription(String(p.description ?? '').trim());
            const m = p.formMeta != null && typeof p.formMeta === 'object' ? p.formMeta : {};
            const taxIncl = !!m.amountsTaxInclusive;
            setShowLineNum(!!m.showLineNum);
            setShowDesc(!!m.showDesc);
            setShowDiscount(!!m.showDiscount);
            setAmountsTaxInclusive(taxIncl);
            const lines = mapApiItemsToLines(p.items, taxIncl, m.lineTaxCodes);
            setLineItems(lines.length ? lines : [emptyLine(defaultAccountLabel)]);
        } catch (e) {
            setCreateError(e?.message || t('err.loadEdit'));
        } finally {
            setEditLoading(false);
        }
    };

    const applyPurchasePrefill = async (nextPurchaseId) => {
        setPurchaseId(nextPurchaseId);
        if (!nextPurchaseId) return;
        try {
            const res = await getSupplierSuperSupplierPurchase(nextPurchaseId);
            const p = res?.purchase ?? res?.data ?? res;
            const items = Array.isArray(p?.items) ? p.items : [];
            if (!items.length) return;
            const taxIncl = amountsTaxInclusive;
            const lines = mapApiItemsToLines(items, taxIncl);
            if (lines.length) setLineItems(lines);
            const piDesc = String(p.description ?? '').trim();
            if (
                !description &&
                piDesc &&
                !/^(purchase\s*invoice|tax\s*invoice|sales\s*invoice|invoice)$/i.test(piDesc)
            ) {
                setDescription(piDesc);
            }
        } catch {
            /* keep current lines */
        }
    };

    const updateLineItem = (id, field, value) => {
        setLineItems((prev) =>
            prev.map((line) => {
                if (line.id !== id) return line;
                if (field === 'uom' && line.supplierProductId) {
                    const inv = findDnCapsRow(line, catalogItems);
                    const locked = masterCatalogWarehouseUnit(
                        inv || { warehouseUnit: line.warehouseUnit },
                        line.warehouseUnit || line.uom || 'pcs',
                    );
                    if (String(value ?? '').trim() !== locked) {
                        return line;
                    }
                }
                const next = { ...line, [field]: value };
                const recalc = new Set(['qty', 'price', 'taxCode', 'discount', 'discountMode']);
                return recalc.has(field) ? applyLineTotals(next, amountsTaxInclusive) : next;
            }),
        );
    };

    const closeLineItemPicker = (lineId) => {
        if (lineId != null && itemPickerLineId !== lineId) return;
        setItemPickerMenuOpen(false);
        setItemPickerLineId(null);
        setItemPickerFilter('');
        setItemPickerSelectedIndex(-1);
    };

    const pickCatalogItem = (lineId, inv) => {
        const whUom = masterCatalogWarehouseUnit(inv, 'pcs');
        setLineItems((prev) =>
            prev.map((line) => {
                if (line.id !== lineId) return line;
                return applyLineTotals(
                    {
                        ...line,
                        item: inv.name,
                        sku: inv.sku,
                        supplierProductId: inv.id,
                        masterProductId: inv.masterProductId,
                        uom: whUom,
                        warehouseUnit: whUom,
                        workshopUnitCatalog:
                            String(inv.workshopUnit ?? '').trim() || null,
                        conversionFactor: inv.conversionFactor ?? 1,
                        price: inv.price || line.price,
                    },
                    amountsTaxInclusive,
                );
            }),
        );
        closeLineItemPicker(lineId);
        focusLineField(lineId, 'qty');
    };

    const addEmptyLine = () => {
        const raw = emptyLine(defaultAccountLabel);
        const lineId = raw.id;
        setLineItems((prev) => [...prev, applyLineTotals(raw, amountsTaxInclusive)]);
        pendingFocusLineFieldRef.current = { lineId, fieldName: 'item' };
        return lineId;
    };

    const handleLineFieldTab = (e, lineId, fieldName, lineIndex) => {
        if (e.key !== 'Tab' || e.shiftKey) return;
        const fields = getLineTabFields();
        const fieldIdx = fields.indexOf(fieldName);
        if (fieldIdx < 0 || fieldIdx !== fields.length - 1) return;
        if (lineIndex !== lineItems.length - 1) return;
        e.preventDefault();
        addEmptyLine();
    };

    const handleLineItemPickerKeyDown = (e, line) => {
        if (itemPickerLineId !== line.id && e.key !== 'Tab') return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            e.stopPropagation();
            if (!itemPickerMenuOpen) setItemPickerMenuOpen(true);
            setItemPickerSelectedIndex((i) => {
                const start = i < 0 ? 0 : i + 1;
                return Math.min(start, Math.max(0, suggestions.length - 1));
            });
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            e.stopPropagation();
            if (!itemPickerMenuOpen) setItemPickerMenuOpen(true);
            setItemPickerSelectedIndex((i) => Math.max(i - 1, 0));
            return;
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            if (
                itemPickerMenuOpen &&
                itemPickerLineId === line.id &&
                itemPickerSelectedIndex >= 0 &&
                suggestions[itemPickerSelectedIndex]
            ) {
                pickCatalogItem(line.id, suggestions[itemPickerSelectedIndex]);
                return;
            }
            closeLineItemPicker(line.id);
            focusLineField(line.id, 'account');
            return;
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            closeLineItemPicker(line.id);
            return;
        }
        if (e.key === 'Tab') {
            closeLineItemPicker(line.id);
        }
    };

    const removeLine = (id) => {
        setLineItems((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.id !== id)));
    };

    const getGridColumns = () => {
        const cols = [];
        if (showLineNum) cols.push('40px');
        cols.push('2fr', '1.5fr');
        if (showDesc) cols.push('2fr');
        cols.push('0.8fr', '0.8fr', '1fr');
        if (showDiscount) cols.push('minmax(140px, 1.35fr)');
        cols.push('1fr', '1fr', '1fr', '1fr');
        cols.push('48px');
        return cols.join(' ');
    };

    const summary = useMemo(() => {
        let subtotalEx = 0;
        let totalTax = 0;
        let grandTotal = 0;
        for (const line of lineItems) {
            const f = computeLineFinancials(line, amountsTaxInclusive);
            subtotalEx += f.lineEx;
            totalTax += f.taxAmt;
            grandTotal += f.grandIncl;
        }
        return {
            subtotal: sarFmt(subtotalEx),
            totalTax: sarFmt(totalTax),
            grandTotal: sarFmt(grandTotal),
            rawSubtotal: roundMoney2(subtotalEx),
            rawTotalTax: roundMoney2(totalTax),
            rawGrandTotal: roundMoney2(grandTotal),
        };
    }, [lineItems, amountsTaxInclusive]);

    const handleSave = async (saveMode = 'finalize') => {
        const isDraftSave = saveMode === 'draft';
        setCreateError('');
        if (!superSupplierId) {
            setCreateError(t('err.selectSs'));
            return;
        }
        if (lineItems.length === 0) {
            setCreateError(t('err.needLine'));
            return;
        }
        const supplierRow = superSuppliers.find((s) => String(s.id) === String(superSupplierId));
        if (!supplierRow) {
            setCreateError(t('err.invalidSs'));
            return;
        }
        if (supplierRow.isActive === false) {
            setCreateError(t('err.inactiveSs'));
            return;
        }

        const normalizedLines = lineItems.map((line, idx) => {
            const fin = computeLineFinancials(line, amountsTaxInclusive);
            const qtyNum = parseFloat(String(line.qty).replace(',', '.')) || 0;
            const unitPriceExForApi =
                qtyNum > 0 ? roundMoney2(fin.lineEx / qtyNum) : 0;
            let productName = resolveInvoiceLineProductName(line, {
                inventoryItems: catalogItems,
            });
            if (
                line.supplierProductId &&
                (!productName || isLikelyGlAccountLabel(productName))
            ) {
                productName = String(line.item || '').trim() || productName;
            }
            return {
                idx,
                productName,
                sku: String(line.sku || '').trim() || undefined,
                supplierProductId:
                    line.supplierProductId != null && String(line.supplierProductId).trim() !== ''
                        ? String(line.supplierProductId).trim()
                        : undefined,
                qty: qtyNum,
                unit: String(line.uom || line.warehouseUnit || 'pcs').trim() || 'pcs',
                unitPrice: unitPriceExForApi,
                vatLine: fin.taxAmt,
            };
        });

        if (isDraftSave) {
            const namedLine = normalizedLines.find(
                (l) => l.productName && !isLikelyGlAccountLabel(l.productName),
            );
            if (!namedLine) {
                setCreateError(t('err.draftNeedProduct'));
                return;
            }
        } else {
            const bad = normalizedLines.find(
                (l) =>
                    !l.productName ||
                    isLikelyGlAccountLabel(l.productName) ||
                    !(l.qty > 0) ||
                    l.unitPrice < 0,
            );
            if (bad) {
                setCreateError(t('err.lineBad', { n: bad.idx + 1 }));
                return;
            }
        }

        const vatAmount = roundMoney2(summary.rawTotalTax);
        const subtotalExVat = roundMoney2(summary.rawSubtotal);
        if (!isDraftSave && !(subtotalExVat + vatAmount > 0)) {
            setCreateError(t('err.totalZero'));
            return;
        }

        const items = normalizedLines.map((l, idx) => {
            const row = lineItems[idx];
            const discRaw =
                parseFloat(String(row?.discount ?? 0).replace(',', '.')) || 0;
            const desc = String(row?.description ?? '').trim();
            const body = {
                ...(l.sku ? { sku: l.sku } : {}),
                ...(l.supplierProductId ? { supplierProductId: l.supplierProductId } : {}),
                productName: l.productName,
                qty: l.qty,
                unit: l.unit,
                unitPrice: Math.round(l.unitPrice * 1e6) / 1e6,
                lineDiscount: discRaw,
                lineDiscountMode:
                    row?.discountMode === 'fixed_sar' ? 'fixed_sar' : 'percent',
            };
            if (desc) body.lineDescription = desc;
            return body;
        });

        const payload = {
            superSupplierId: String(superSupplierId),
            issueDate,
            purchaseId: purchaseId ? String(purchaseId) : '',
            referenceNo: refNo.trim() || undefined,
            description: description.trim() || undefined,
            vatAmount: Math.round(vatAmount * 100) / 100,
            items,
            formMeta: {
                showLineNum,
                showDesc,
                showDiscount,
                amountsTaxInclusive,
                lineTaxCodes: lineItems.map((l) => l.taxCode),
            },
            status: isDraftSave ? 'draft' : 'posted',
        };

        setSaving(true);
        try {
            if (mode === 'edit' && editingId) {
                await updateSupplierSuperSupplierDebitNote(editingId, payload);
                if (isDraftSave) {
                    setEditingStatus('draft');
                    await loadList();
                    return;
                }
            } else {
                const res = await createSupplierSuperSupplierDebitNote(payload);
                if (isDraftSave) {
                    const newId = res?.debitNote?.id ?? res?.data?.id ?? null;
                    if (newId) {
                        setMode('edit');
                        setEditingId(String(newId));
                        setEditingStatus('draft');
                    }
                    await loadList();
                    return;
                }
            }
            setModalOpen(false);
            resetForm();
            await loadList();
        } catch (e) {
            setCreateError(e?.message || t('err.save'));
        } finally {
            setSaving(false);
        }
    };

    const pendingViewActionRef = useRef(null);

    const closeView = () => {
        setViewOpen(false);
        setViewPayload(null);
        setViewError('');
        setViewLoading(false);
        pendingViewActionRef.current = null;
    };

    const openView = async (id, action = null) => {
        pendingViewActionRef.current = action;
        setViewError('');
        setViewPayload(null);
        setViewOpen(true);
        setViewLoading(true);
        try {
            const res = await getSupplierSuperSupplierDebitNote(id);
            const p = res?.debitNote ?? res?.data ?? res;
            if (!p?.id) {
                setViewError(t('err.loadView'));
                pendingViewActionRef.current = null;
                return;
            }
            setViewPayload(p);
        } catch (e) {
            setViewError(e?.message || t('err.loadView'));
            pendingViewActionRef.current = null;
        } finally {
            setViewLoading(false);
        }
    };

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const viewId = String(params.get('view') || '').trim();
        if (!viewId) return undefined;
        navigate('/supplier/debit_notes', { replace: true });
        openView(viewId);
        return undefined;
        // Open once when landing from a journal voucher link.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.search]);

    useEffect(() => {
        if (!viewOpen || viewLoading || !viewPayload) return undefined;
        const action = pendingViewActionRef.current;
        if (!action) return undefined;
        pendingViewActionRef.current = null;
        const timer = window.setTimeout(() => {
            if (action === 'print') viewDocRef.current?.print?.();
            if (action === 'pdf') viewDocRef.current?.downloadPdf?.();
        }, 220);
        return () => window.clearTimeout(timer);
    }, [viewOpen, viewLoading, viewPayload]);

    const runOffscreenPdfDownload = async (id) => {
        if (pdfBusy) return;
        setPdfBusy(true);
        setErr('');
        try {
            const res = await getSupplierSuperSupplierDebitNote(id);
            const p = res?.debitNote ?? res?.data ?? res;
            if (!p?.id) {
                throw new Error(t('err.loadView'));
            }
            flushSync(() => setPdfExportDn(p));
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            await new Promise((r) => setTimeout(r, 180));
            const api = pdfExportRef.current;
            if (!api?.downloadPdf) throw new Error(t('err.pdf'));
            await api.downloadPdf();
        } catch (e) {
            setErr(e?.message || t('err.pdf'));
        } finally {
            flushSync(() => setPdfExportDn(null));
            setPdfBusy(false);
        }
    };

    const openJournal = (journalId) => {
        if (!journalId) {
            setErr(t('err.noJournal'));
            return;
        }
        navigate(`/supplier/accounting/journals/${encodeURIComponent(String(journalId))}`);
    };

    const openCoaLedger = async ({
        seedKey,
        partyType,
        partyId,
        partyLabel,
    } = {}) => {
        if (openingLedger) return;
        setErr('');
        setOpeningLedger(true);
        try {
            if (seedKey === 'AP_SUPER_SUPPLIER' && partyId) {
                await getSuperSupplierApLedger(String(partyId)).catch(() => {});
            }
            await navigateToSupplierCustomerLedger(navigate, {
                seedKey,
                from: 'debit_notes',
                partyType,
                partyId,
                partyLabel,
                missingAccountMessage: t('err.ledgerAccount'),
            });
        } catch (e) {
            setErr(e?.message || t('err.openLedger'));
        } finally {
            setOpeningLedger(false);
        }
    };

    const postedLedgerActions = (row) => {
        const posted = String(row?.status || '').toLowerCase() !== 'draft';
        if (!posted) return [];
        return [
            {
                label: t('btn.viewJournal'),
                onClick: () => openJournal(row.journalId),
                disabled: !row.journalId,
            },
            {
                label: t('btn.apLedger'),
                onClick: () =>
                    openCoaLedger({
                        seedKey: 'AP_SUPER_SUPPLIER',
                        partyType: 'super_supplier',
                        partyId: String(row.superSupplierId || ''),
                        partyLabel: row.superSupplierName || '',
                    }),
                disabled: openingLedger || !row.superSupplierId,
            },
            {
                label: t('btn.inventoryLedger'),
                onClick: () => openCoaLedger({ seedKey: 'INVENTORY' }),
                disabled: openingLedger,
            },
            {
                label: t('btn.vatLedger'),
                onClick: () => openCoaLedger({ seedKey: 'VAT_INPUT' }),
                disabled: openingLedger,
            },
        ];
    };

    const em = t('emdash');

    return (
        <div className="purchases-view">
            {!modalOpen && !viewOpen && (
                <>
                    <div
                        className="ws-section"
                        style={{
                            padding: '16px 20px',
                            display: 'flex',
                            flexWrap: 'wrap',
                            justifyContent: 'space-between',
                            gap: 12,
                            alignItems: 'center',
                            marginBottom: 16,
                        }}
                    >
                        <div>
                            <h2
                                style={{
                                    margin: 0,
                                    fontSize: '1.25rem',
                                    fontWeight: 800,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                }}
                            >
                                <RotateCcw size={20} /> {t('page.title')}
                            </h2>
                            <p
                                style={{
                                    margin: '6px 0 0',
                                    fontSize: '0.8125rem',
                                    color: 'var(--color-text-muted)',
                                    maxWidth: 720,
                                }}
                            >
                                {t('page.sub')}
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button type="button" className="btn-portal" onClick={() => loadList()} disabled={loading}>
                                <RefreshCw size={14} /> {loading ? t('loading') : t('btn.refresh')}
                            </button>
                            <button type="button" className="btn-pi-create" onClick={openCreate}>
                                <Plus size={16} /> {t('btn.new')}
                            </button>
                        </div>
                    </div>

                    {err ? (
                        <div
                            style={{
                                marginBottom: 16,
                                padding: 12,
                                background: '#FEF2F2',
                                border: '1px solid #FECACA',
                                borderRadius: 10,
                                color: '#B91C1C',
                                fontSize: '0.875rem',
                            }}
                        >
                            {err}
                        </div>
                    ) : null}

                    <div className="ws-section" style={{ overflow: 'hidden' }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="ws-table">
                                <thead>
                                    <tr>
                                        <th>{t('th.number')}</th>
                                        <th>{t('th.vendor')}</th>
                                        <th>{t('th.invoice')}</th>
                                        <th>{t('th.date')}</th>
                                        <th>{t('th.ref')}</th>
                                        <th>{t('th.product')}</th>
                                        <th>{t('th.total')}</th>
                                        <th>{t('th.status')}</th>
                                        <th>{t('th.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading && rows.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} style={{ padding: 16 }}>
                                                <ShimmerTable rows={8} columns={9} />
                                            </td>
                                        </tr>
                                    ) : rows.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={9}
                                                style={{
                                                    textAlign: 'center',
                                                    padding: 36,
                                                    color: 'var(--color-text-muted)',
                                                }}
                                            >
                                                <strong>{t('empty.title')}</strong>
                                                <div style={{ marginTop: 6 }}>{t('empty.body')}</div>
                                            </td>
                                        </tr>
                                    ) : (
                                        rows.map((r) => (
                                            <tr
                                                key={r.id}
                                                onClick={() => openView(r.id)}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                <td style={{ fontWeight: 800, color: '#EA580C' }}>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            openView(r.id);
                                                        }}
                                                        style={{
                                                            background: 'none',
                                                            border: 0,
                                                            padding: 0,
                                                            font: 'inherit',
                                                            fontWeight: 800,
                                                            color: '#EA580C',
                                                            cursor: 'pointer',
                                                            textDecoration: 'underline',
                                                        }}
                                                    >
                                                        {r.debitNoteNo ?? `DN-${r.id}`}
                                                    </button>
                                                </td>
                                                <td>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <Building2 size={14} style={{ opacity: 0.5 }} />
                                                        {r.superSupplierName ?? em}
                                                    </span>
                                                </td>
                                                <td>
                                                    {r.purchaseInvoiceNo || r.purchaseReferenceNo || t('opt.automatic')}
                                                </td>
                                                <td>{r.issueDate || em}</td>
                                                <td>{r.referenceNo || em}</td>
                                                <td>
                                                    {r.primaryProductName ?? em}
                                                    {r.primaryQty != null && r.primaryUnit ? (
                                                        <div
                                                            style={{
                                                                fontSize: '0.75rem',
                                                                color: 'var(--color-text-muted)',
                                                            }}
                                                        >
                                                            {r.primaryQty} {r.primaryUnit}
                                                        </div>
                                                    ) : null}
                                                    {r.moreLines > 0 ? (
                                                        <div
                                                            style={{
                                                                fontSize: '0.6875rem',
                                                                color: 'var(--color-text-muted)',
                                                            }}
                                                        >
                                                            +{r.moreLines}
                                                        </div>
                                                    ) : null}
                                                </td>
                                                <td>{money(sarFmt(r.total))}</td>
                                                <td>
                                                    {String(r.status || '').toLowerCase() === 'draft'
                                                        ? t('status.draft')
                                                        : t('status.posted')}
                                                </td>
                                                <td onClick={(e) => e.stopPropagation()}>
                                                    <RowActionsMenu
                                                        items={[
                                                            {
                                                                label: t('btn.view'),
                                                                onClick: () => openView(r.id),
                                                            },
                                                            {
                                                                label: t('btn.print'),
                                                                onClick: () => openView(r.id, 'print'),
                                                            },
                                                            {
                                                                label: t('btn.downloadPdf'),
                                                                onClick: () => runOffscreenPdfDownload(r.id),
                                                                disabled: pdfBusy,
                                                            },
                                                            ...postedLedgerActions(r),
                                                            {
                                                                label: t('btn.edit'),
                                                                onClick: () => openEdit(r.id),
                                                            },
                                                        ]}
                                                    />
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            <AnimatePresence>
                {modalOpen && (
                    <InlineFormScreen
                        title={
                            <div className="pi-modal-title">
                                <span className="pi-breadcrumb">
                                    {t('page.title')} ›{' '}
                                    <span className="pi-b-active">
                                        {mode === 'edit' ? t('crumb.edit') : t('crumb.new')}
                                    </span>
                                </span>
                                <div className="pi-title-main">
                                    <RotateCcw className="pi-icon-orange" size={24} />
                                    <span>{t('form.title')}</span>
                                </div>
                            </div>
                        }
                        onBack={() => {
                            if (!saving && !editLoading) {
                                setModalOpen(false);
                                resetForm();
                            }
                        }}
                        backLabel={t('btn.back')}
                        footer={
                            <div className="pi-modal-footer">
                                <div className="pi-footer-left">
                                    <button
                                        type="button"
                                        className="btn-pi-cancel"
                                        disabled={saving || editLoading}
                                        onClick={() => {
                                            setModalOpen(false);
                                            resetForm();
                                        }}
                                    >
                                        {t('btn.cancel')}
                                    </button>
                                </div>
                                <div className="pi-footer-right">
                                    {(mode === 'create' || editingStatus === 'draft') && (
                                        <button
                                            type="button"
                                            className="btn-pi-draft"
                                            disabled={
                                                saving ||
                                                editLoading ||
                                                lineItems.length === 0 ||
                                                !superSupplierId
                                            }
                                            onClick={() => handleSave('draft')}
                                        >
                                            {saving ? t('saving') : t('btn.saveDraft')}
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        className="btn-pi-create"
                                        disabled={
                                            saving ||
                                            editLoading ||
                                            lineItems.length === 0 ||
                                            !superSupplierId
                                        }
                                        onClick={() => handleSave('finalize')}
                                    >
                                        {saving
                                            ? mode === 'edit'
                                                ? t('saving')
                                                : t('creating')
                                            : editingStatus === 'draft'
                                              ? t('btn.finalize')
                                              : mode === 'edit'
                                                ? t('btn.saveChanges')
                                                : t('btn.create')}
                                    </button>
                                </div>
                            </div>
                        }
                    >
                        {editLoading ? (
                            <p style={{ padding: 24, color: 'var(--color-text-muted)' }}>
                                <Loader2 size={16} className="spin" /> {t('loading')}
                            </p>
                        ) : (
                            <div className="pi-form-container">
                                {createError ? (
                                    <div
                                        style={{
                                            marginBottom: 12,
                                            padding: 12,
                                            background: '#FEF2F2',
                                            border: '1px solid #FECACA',
                                            borderRadius: 10,
                                            color: '#B91C1C',
                                            fontSize: '0.875rem',
                                        }}
                                    >
                                        {createError}
                                    </div>
                                ) : null}

                                <div className="pi-header-grid">
                                    <div className="pi-field">
                                        <label>{t('label.issueDate')}</label>
                                        <div className="pi-input-with-icon">
                                            <input
                                                type="date"
                                                value={issueDate}
                                                onChange={(e) => setIssueDate(e.target.value)}
                                            />
                                            <Calendar size={16} />
                                        </div>
                                    </div>
                                    <InvoiceRefField
                                        label={t('label.reference')}
                                        placeholder={t('ph.ref')}
                                        value={refNo}
                                        onChange={setRefNo}
                                        readOnly={mode === 'edit' && editingStatus !== 'draft'}
                                        autoGenerate={refAutoGenerate}
                                        onAutoGenerateChange={setRefAutoGenerate}
                                        fetchNextReference={getNextSupplierDebitNoteReference}
                                    />
                                </div>

                                <div className="pi-field pi-full-width">
                                    <label>{t('label.supplier')}</label>
                                    <select
                                        value={superSupplierId}
                                        disabled={mode === 'edit'}
                                        onChange={(e) => {
                                            setSuperSupplierId(e.target.value);
                                            setPurchaseId('');
                                        }}
                                        style={{
                                            width: '100%',
                                            padding: '10px 14px',
                                            borderRadius: 10,
                                            border: '1px solid #e2e8f0',
                                            fontSize: '0.9375rem',
                                            fontWeight: 600,
                                            background: '#f8fafc',
                                            color: '#1e293b',
                                        }}
                                    >
                                        <option value="">
                                            {ssLoading ? t('opt.loadingVendors') : t('opt.selectSupplier')}
                                        </option>
                                        {superSuppliers.map((ss) => (
                                            <option
                                                key={String(ss.id)}
                                                value={String(ss.id)}
                                                disabled={ss.isActive === false}
                                            >
                                                {ss.name}
                                                {ss.isActive === false ? ' (inactive)' : ''}
                                                {ss.vatNumber ? ` — VAT ${ss.vatNumber}` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    {!ssLoading && superSuppliers.length === 0 ? (
                                        <span className="pi-sub-label" style={{ color: '#B45309' }}>
                                            {t('hint.noVendors')}
                                        </span>
                                    ) : null}
                                </div>

                                <div className="pi-field pi-full-width">
                                    <label>{t('label.purchaseInvoice')}</label>
                                    <select
                                        value={purchaseId}
                                        onChange={(e) => applyPurchasePrefill(e.target.value)}
                                        disabled={!superSupplierId || purchasesLoading}
                                        style={{
                                            width: '100%',
                                            padding: '10px 14px',
                                            borderRadius: 10,
                                            border: '1px solid #e2e8f0',
                                            fontSize: '0.9375rem',
                                            background: '#fff',
                                        }}
                                    >
                                        <option value="">
                                            {purchasesLoading
                                                ? t('opt.loadingInvoices')
                                                : t('opt.automatic')}
                                        </option>
                                        {purchases.map((p) => (
                                            <option key={String(p.id)} value={String(p.id)}>
                                                {p.invoiceNo || `SSP-${p.id}`}
                                                {p.referenceNo || p.vendorRef
                                                    ? ` — ${p.referenceNo || p.vendorRef}`
                                                    : ''}
                                                {` · ${sarFmt(p.total)} SAR`}
                                            </option>
                                        ))}
                                    </select>
                                    <span className="pi-sub-label">
                                        {purchaseId ? t('hint.linked') : t('hint.automatic')}
                                    </span>
                                </div>

                                <div className="pi-field pi-full-width">
                                    <label>{t('label.description')}</label>
                                    <input
                                        type="text"
                                        placeholder={t('ph.description')}
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                    />
                                </div>

                                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '0 0 8px' }}>
                                    {catalogLoading ? t('loading') : t('hint.catalog')}
                                </p>

                                <div className="pi-lines-section">
                                    <div
                                        className="pi-lines-header"
                                        style={{ gridTemplateColumns: getGridColumns() }}
                                    >
                                        {showLineNum && <div className="pi-col-hash">#</div>}
                                        <div className="pi-col-item">{t('col.item')}</div>
                                        <div className="pi-col-acc">{t('col.account')}</div>
                                        {showDesc && <div className="pi-col-desc">{t('col.description')}</div>}
                                        <div className="pi-col-uom">{t('col.uom')}</div>
                                        <div className="pi-col-qty">{t('col.qty')}</div>
                                        <div className="pi-col-price">
                                            {t('col.unitPrice')}
                                            {amountsTaxInclusive ? (
                                                <span style={{ display: 'block', fontWeight: 400, fontSize: 11, color: '#64748b' }}>
                                                    {t('incl.vat')}
                                                </span>
                                            ) : null}
                                        </div>
                                        {showDiscount && <div className="pi-col-disc">{t('col.discount')}</div>}
                                        <div className="pi-col-total">{t('col.total')}</div>
                                        <div className="pi-col-tax">{t('col.taxCode')}</div>
                                        <div className="pi-col-tamt">{t('col.taxAmt')}</div>
                                        <div className="pi-col-total">{t('col.grand')}</div>
                                        <div aria-hidden />
                                    </div>

                                    {lineItems.map((line, idx) => {
                                        const fin = computeLineFinancials(line, amountsTaxInclusive);
                                        const capsRow = findDnCapsRow(line, catalogItems);
                                        const conversionPreview = formatDnUomConversionPreview(
                                            line,
                                            capsRow,
                                            t,
                                        );
                                        return (
                                            <div
                                                key={line.id}
                                                className={`pi-lines-header pi-line-data-row${
                                                    itemPickerLineId === line.id && itemPickerMenuOpen
                                                        ? ' pi-line-row-picker-open'
                                                        : ''
                                                }`}
                                                style={{ gridTemplateColumns: getGridColumns() }}
                                            >
                                                {showLineNum && <div className="pi-col-hash">{idx + 1}</div>}
                                                <div className="pi-col-item" style={{ position: 'relative', minWidth: 0 }}>
                                                    <div
                                                        ref={
                                                            itemPickerLineId === line.id
                                                                ? lineItemPickerWrapRef
                                                                : null
                                                        }
                                                        style={{ position: 'relative', width: '100%' }}
                                                    >
                                                        <input
                                                            className="pi-row-input"
                                                            value={
                                                                itemPickerLineId === line.id
                                                                    ? itemPickerFilter
                                                                    : line.item
                                                            }
                                                            placeholder={t('item.placeholder')}
                                                            ref={(el) => {
                                                                lineFieldRefs.current[`${line.id}:item`] = el;
                                                            }}
                                                            onFocus={() => {
                                                                setItemPickerLineId(line.id);
                                                                setItemPickerFilter(String(line.item ?? ''));
                                                                setItemPickerMenuOpen(true);
                                                                setItemPickerSelectedIndex(
                                                                    String(line.item ?? '').trim() ? 0 : -1,
                                                                );
                                                            }}
                                                            onChange={(e) => {
                                                                setItemPickerLineId(line.id);
                                                                setItemPickerFilter(e.target.value);
                                                                setItemPickerMenuOpen(true);
                                                                setItemPickerSelectedIndex(
                                                                    String(e.target.value).trim() ? 0 : -1,
                                                                );
                                                                updateLineItem(line.id, 'item', e.target.value);
                                                            }}
                                                            onKeyDown={(e) =>
                                                                handleLineItemPickerKeyDown(e, line)
                                                            }
                                                        />
                                                        {itemPickerLineId === line.id && itemPickerMenuOpen ? (
                                                            <div
                                                                ref={lineItemPickerListRef}
                                                                className="pi-item-dropdown"
                                                                style={{
                                                                    position: 'absolute',
                                                                    zIndex: 20,
                                                                    left: 0,
                                                                    right: 0,
                                                                    background: '#fff',
                                                                    border: '1px solid #e2e8f0',
                                                                    borderRadius: 10,
                                                                    maxHeight: 260,
                                                                    overflow: 'auto',
                                                                    boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
                                                                }}
                                                            >
                                                                {suggestions.length ? (
                                                                    suggestions.map((inv, i) => (
                                                                        <button
                                                                            key={`${inv.id}-${i}`}
                                                                            type="button"
                                                                            tabIndex={-1}
                                                                            data-pick-idx={i}
                                                                            className="pi-item-option"
                                                                            style={{
                                                                                display: 'flex',
                                                                                width: '100%',
                                                                                textAlign: 'left',
                                                                                padding: '8px 12px',
                                                                                border: 0,
                                                                                background:
                                                                                    itemPickerSelectedIndex === i
                                                                                        ? '#f1f5f9'
                                                                                        : 'transparent',
                                                                                cursor: 'pointer',
                                                                            }}
                                                                            onMouseDown={(e) => e.preventDefault()}
                                                                            onMouseEnter={() =>
                                                                                setItemPickerSelectedIndex(i)
                                                                            }
                                                                            onClick={() => pickCatalogItem(line.id, inv)}
                                                                        >
                                                                            <span style={{ flex: 1 }}>
                                                                                <strong>{inv.name}</strong>
                                                                                {inv.sku ? (
                                                                                    <span style={{ color: '#64748b', marginLeft: 8 }}>
                                                                                        SKU {inv.sku}
                                                                                    </span>
                                                                                ) : null}
                                                                                {inv.warehouseUnit ? (
                                                                                    <span style={{ color: '#64748b', marginLeft: 8 }}>
                                                                                        · {inv.warehouseUnit}
                                                                                    </span>
                                                                                ) : null}
                                                                            </span>
                                                                            <span style={{ color: '#64748b', fontSize: 12 }}>
                                                                                {sarFmt(inv.price)} SAR
                                                                            </span>
                                                                        </button>
                                                                    ))
                                                                ) : (
                                                                    <div style={{ padding: 12, fontSize: 13, color: '#64748b' }}>
                                                                        {catalogItems.length === 0
                                                                            ? t('item.emptyCatalog')
                                                                            : t('item.noMatch')}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </div>
                                                <div className="pi-col-acc">
                                                    <select
                                                        className="pi-row-input"
                                                        value={line.account}
                                                        ref={(el) => {
                                                            lineFieldRefs.current[`${line.id}:account`] = el;
                                                        }}
                                                        onChange={(e) =>
                                                            updateLineItem(line.id, 'account', e.target.value)
                                                        }
                                                        onKeyDown={(e) =>
                                                            handleLineFieldTab(e, line.id, 'account', idx)
                                                        }
                                                    >
                                                        {invoiceAccountOptions.map((opt) => (
                                                            <option
                                                                key={opt.code}
                                                                value={`${opt.code} - ${opt.name}`}
                                                            >
                                                                {opt.code} - {opt.name}
                                                            </option>
                                                        ))}
                                                        {line.account &&
                                                        !invoiceAccountOptions.some(
                                                            (opt) =>
                                                                `${opt.code} - ${opt.name}` ===
                                                                line.account,
                                                        ) ? (
                                                            <option value={line.account}>
                                                                {line.account}
                                                            </option>
                                                        ) : null}
                                                    </select>
                                                </div>
                                                {showDesc && (
                                                    <div className="pi-col-desc">
                                                        <input
                                                            className="pi-row-input"
                                                            value={line.description}
                                                            ref={(el) => {
                                                                lineFieldRefs.current[`${line.id}:description`] = el;
                                                            }}
                                                            onChange={(e) =>
                                                                updateLineItem(line.id, 'description', e.target.value)
                                                            }
                                                            onKeyDown={(e) =>
                                                                handleLineFieldTab(
                                                                    e,
                                                                    line.id,
                                                                    'description',
                                                                    idx,
                                                                )
                                                            }
                                                        />
                                                    </div>
                                                )}
                                                <div className="pi-col-uom">
                                                    {capsRow || line.supplierProductId ? (
                                                        <input
                                                            type="text"
                                                            className="pi-row-input"
                                                            readOnly
                                                            autoComplete="off"
                                                            data-1p-ignore="true"
                                                            data-lpignore="true"
                                                            name={`dn-uom-locked-${line.id}`}
                                                            title={t('uom.titleLocked')}
                                                            value={
                                                                (capsRow
                                                                    ? masterCatalogWarehouseUnit(capsRow, '')
                                                                    : '') ||
                                                                String(line.warehouseUnit || line.uom || 'pcs').trim() ||
                                                                'pcs'
                                                            }
                                                            ref={(el) => {
                                                                lineFieldRefs.current[`${line.id}:uom`] = el;
                                                            }}
                                                            onKeyDown={(e) =>
                                                                handleLineFieldTab(e, line.id, 'uom', idx)
                                                            }
                                                        />
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            className="pi-row-input"
                                                            autoComplete="off"
                                                            data-1p-ignore="true"
                                                            data-lpignore="true"
                                                            name={`dn-uom-${line.id}`}
                                                            value={line.uom ?? ''}
                                                            ref={(el) => {
                                                                lineFieldRefs.current[`${line.id}:uom`] = el;
                                                            }}
                                                            onChange={(e) =>
                                                                updateLineItem(line.id, 'uom', e.target.value)
                                                            }
                                                            onKeyDown={(e) =>
                                                                handleLineFieldTab(e, line.id, 'uom', idx)
                                                            }
                                                        />
                                                    )}
                                                </div>
                                                <div className="pi-col-qty">
                                                    <input
                                                        className="pi-row-input"
                                                        inputMode="decimal"
                                                        value={line.qty}
                                                        ref={(el) => {
                                                            lineFieldRefs.current[`${line.id}:qty`] = el;
                                                        }}
                                                        onChange={(e) =>
                                                            updateLineItem(line.id, 'qty', e.target.value)
                                                        }
                                                        onKeyDown={(e) =>
                                                            handleLineFieldTab(e, line.id, 'qty', idx)
                                                        }
                                                    />
                                                    {conversionPreview ? (
                                                        <div
                                                            style={{
                                                                fontSize: '0.65rem',
                                                                color: '#64748b',
                                                                lineHeight: 1.3,
                                                                marginTop: 2,
                                                                whiteSpace: 'normal',
                                                            }}
                                                        >
                                                            {conversionPreview}
                                                        </div>
                                                    ) : null}
                                                </div>
                                                <div className="pi-col-price">
                                                    <input
                                                        className="pi-row-input"
                                                        inputMode="decimal"
                                                        value={line.price}
                                                        ref={(el) => {
                                                            lineFieldRefs.current[`${line.id}:price`] = el;
                                                        }}
                                                        onBlur={(e) =>
                                                            updateLineItem(
                                                                line.id,
                                                                'price',
                                                                String(evalMaybeMath(e.target.value)),
                                                            )
                                                        }
                                                        onChange={(e) =>
                                                            updateLineItem(line.id, 'price', e.target.value)
                                                        }
                                                        onKeyDown={(e) =>
                                                            handleLineFieldTab(e, line.id, 'price', idx)
                                                        }
                                                    />
                                                    <span style={{ fontSize: 11, color: '#64748b' }}>SAR</span>
                                                </div>
                                                {showDiscount && (
                                                    <div className="pi-col-disc" style={{ display: 'flex', gap: 4 }}>
                                                        <input
                                                            className="pi-row-input"
                                                            value={line.discount}
                                                            ref={(el) => {
                                                                lineFieldRefs.current[`${line.id}:discount`] = el;
                                                            }}
                                                            onChange={(e) =>
                                                                updateLineItem(line.id, 'discount', e.target.value)
                                                            }
                                                            onKeyDown={(e) =>
                                                                handleLineFieldTab(
                                                                    e,
                                                                    line.id,
                                                                    'discount',
                                                                    idx,
                                                                )
                                                            }
                                                        />
                                                        <select
                                                            className="pi-row-input"
                                                            value={line.discountMode}
                                                            ref={(el) => {
                                                                lineFieldRefs.current[`${line.id}:discountMode`] = el;
                                                            }}
                                                            onChange={(e) =>
                                                                updateLineItem(
                                                                    line.id,
                                                                    'discountMode',
                                                                    e.target.value,
                                                                )
                                                            }
                                                            onKeyDown={(e) =>
                                                                handleLineFieldTab(
                                                                    e,
                                                                    line.id,
                                                                    'discountMode',
                                                                    idx,
                                                                )
                                                            }
                                                        >
                                                            <option value="percent">%</option>
                                                            <option value="fixed_sar">SAR</option>
                                                        </select>
                                                    </div>
                                                )}
                                                <div className="pi-col-total">
                                                    {sarFmt(fin.lineEx)} SAR
                                                </div>
                                                <div className="pi-col-tax">
                                                    <select
                                                        className="pi-row-input"
                                                        value={line.taxCode}
                                                        ref={(el) => {
                                                            lineFieldRefs.current[`${line.id}:taxCode`] = el;
                                                        }}
                                                        onChange={(e) =>
                                                            updateLineItem(line.id, 'taxCode', e.target.value)
                                                        }
                                                        onKeyDown={(e) =>
                                                            handleLineFieldTab(e, line.id, 'taxCode', idx)
                                                        }
                                                    >
                                                        {TAXES.map((tax) => (
                                                            <option key={tax.code} value={tax.code}>
                                                                {tax.code === 'No tax' ? t('tax.none') : tax.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="pi-col-tamt">{fin.taxAmtStr}</div>
                                                <div className="pi-col-total">{fin.grandInclStr} SAR</div>
                                                <button
                                                    type="button"
                                                    className="pi-line-delete"
                                                    onClick={() => removeLine(line.id)}
                                                    aria-label="Delete line"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        );
                                    })}

                                    <button type="button" className="btn-add-line" onClick={addEmptyLine}>
                                        <Plus size={16} /> {t('btn.addLine')}
                                    </button>
                                    <div className="pi-hint">
                                        <Zap size={14} /> {t('hint.tip')}
                                    </div>
                                </div>

                                <div className="pi-config-row">
                                    <label className="pi-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={amountsTaxInclusive}
                                            onChange={(e) => setAmountsTaxInclusive(e.target.checked)}
                                        />{' '}
                                        <span>{t('toggle.taxIncl')}</span>
                                    </label>
                                    <label className="pi-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={showLineNum}
                                            onChange={(e) => setShowLineNum(e.target.checked)}
                                        />{' '}
                                        <span>{t('toggle.lineNum')}</span>
                                    </label>
                                    <label className="pi-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={showDesc}
                                            onChange={(e) => setShowDesc(e.target.checked)}
                                        />{' '}
                                        <span>{t('toggle.desc')}</span>
                                    </label>
                                    <label className="pi-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={showDiscount}
                                            onChange={(e) => setShowDiscount(e.target.checked)}
                                        />{' '}
                                        <span>{t('toggle.discount')}</span>
                                    </label>
                                </div>

                                <div className="pi-footer-grid">
                                    <div />
                                    <div className="pi-summary">
                                        <div className="pi-summary-row">
                                            <span>{t('summary.subtotal')}:</span>
                                            <span>SAR {summary.subtotal}</span>
                                        </div>
                                        <div className="pi-summary-row">
                                            <span>{t('summary.tax')}:</span>
                                            <span>SAR {summary.totalTax}</span>
                                        </div>
                                        <div className="pi-summary-row pi-grand-total">
                                            <span>{t('summary.grand')}:</span>
                                            <span>SAR {summary.grandTotal}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </InlineFormScreen>
                )}
            </AnimatePresence>
            {viewOpen ? (
                <InlineFormScreen
                    title={
                        <div className="pi-modal-title">
                            <span className="pi-breadcrumb">
                                {t('page.title')} ›{' '}
                                <span className="pi-b-active">
                                    {viewPayload?.debitNoteNo || t('view.crumb')}
                                </span>
                            </span>
                            <div className="pi-title-main">
                                <FileText className="pi-icon-orange" size={24} />
                                <span>{t('form.title')}</span>
                            </div>
                        </div>
                    }
                    onBack={closeView}
                    backLabel={t('view.back')}
                    bodyClassName="wpi-invoice-preview-modal"
                >
                    {viewPayload && String(viewPayload.status || '').toLowerCase() !== 'draft' ? (
                        <div
                            style={{
                                marginBottom: 12,
                                padding: '10px 12px',
                                borderRadius: 10,
                                border: '1px solid #e2e8f0',
                                background: '#f8fafc',
                                fontSize: '0.8125rem',
                            }}
                        >
                            <div style={{ fontWeight: 700, marginBottom: 6 }}>{t('coa.related')}</div>
                            <div style={{ color: '#475569', lineHeight: 1.5 }}>
                                {t('coa.ap')}
                                <br />
                                {t('coa.inventory')}
                                <br />
                                {t('coa.vat')}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                                <button
                                    type="button"
                                    className="btn-pi-cancel"
                                    onClick={() => openJournal(viewPayload.journalId)}
                                    disabled={!viewPayload.journalId}
                                >
                                    <BookOpen size={14} /> {t('btn.viewJournal')}
                                    {viewPayload.journalEntryNumber
                                        ? ` · ${viewPayload.journalEntryNumber}`
                                        : ''}
                                </button>
                                <button
                                    type="button"
                                    className="btn-pi-cancel"
                                    disabled={openingLedger || !viewPayload.superSupplierId}
                                    onClick={() =>
                                        openCoaLedger({
                                            seedKey: 'AP_SUPER_SUPPLIER',
                                            partyType: 'super_supplier',
                                            partyId: String(viewPayload.superSupplierId || ''),
                                            partyLabel: viewPayload.superSupplierName || '',
                                        })
                                    }
                                >
                                    <Landmark size={14} /> {t('btn.apLedger')}
                                </button>
                                <button
                                    type="button"
                                    className="btn-pi-cancel"
                                    disabled={openingLedger}
                                    onClick={() => openCoaLedger({ seedKey: 'INVENTORY' })}
                                >
                                    {t('btn.inventoryLedger')}
                                </button>
                                <button
                                    type="button"
                                    className="btn-pi-cancel"
                                    disabled={openingLedger}
                                    onClick={() => openCoaLedger({ seedKey: 'VAT_INPUT' })}
                                >
                                    {t('btn.vatLedger')}
                                </button>
                            </div>
                        </div>
                    ) : null}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
                        <button
                            type="button"
                            className="btn-pi-cancel"
                            onClick={() => viewDocRef.current?.print?.()}
                            disabled={viewLoading || !viewPayload}
                        >
                            <Printer size={14} /> {t('btn.print')}
                        </button>
                        <button
                            type="button"
                            className="btn-pi-cancel"
                            onClick={() => viewDocRef.current?.downloadPdf?.()}
                            disabled={viewLoading || !viewPayload}
                        >
                            <Download size={14} /> {t('btn.downloadPdf')}
                        </button>
                    </div>
                    {viewLoading ? (
                        <ShimmerTextBlock lines={8} />
                    ) : viewError ? (
                        <p style={{ margin: 0, color: '#B91C1C' }}>{viewError}</p>
                    ) : viewPayload ? (
                        <WorkshopPurchaseInvoiceView
                            ref={viewDocRef}
                            compact
                            variant="ssp_debit_note"
                            detail={mapDebitNoteToViewDetail(viewPayload, superSuppliers)}
                            listRow={mapDebitNoteToViewListRow(viewPayload)}
                        />
                    ) : (
                        <p style={{ margin: 0 }}>{t('empty.title')}</p>
                    )}
                </InlineFormScreen>
            ) : null}
            {pdfExportDn ? (
                <div aria-hidden className="sales-invoice-pdf-export-mount">
                    <WorkshopPurchaseInvoiceView
                        ref={pdfExportRef}
                        compact
                        variant="ssp_debit_note"
                        detail={mapDebitNoteToViewDetail(pdfExportDn, superSuppliers)}
                        listRow={mapDebitNoteToViewListRow(pdfExportDn)}
                    />
                </div>
            ) : null}
        </div>
    );
}
