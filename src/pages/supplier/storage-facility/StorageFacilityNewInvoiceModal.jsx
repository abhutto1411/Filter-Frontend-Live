import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Plus, Trash2 } from 'lucide-react';
import Modal from '../../../components/Modal';
import { useStorageFacilityApi } from './StorageFacilityPortalContext';
import ProductLineCombobox from './ProductLineCombobox';
import SearchableEntityCombobox from './SearchableEntityCombobox';
import StorageFacilityVatTotals, { fmtSar } from './StorageFacilityVatTotals';
import { computeStorageTotals, unitAmountForApi } from './storageFacilityTotals';
import {
    defaultUomForWarehouseProduct,
    formatLineUomConversionPreview,
    maxSellableQtyForLine,
    storageProductsToInvCaps,
    findInventoryCapsRow,
} from '../internal/supplierUomLineUtils';
import StorageUomSelect from './StorageUomSelect';
import { lineInventoryCapsForInvoice } from './storageFacilityUomUtils';

function newLine() {
    return {
        key: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        storageProductId: '',
        supplierProductId: '',
        search: '',
        uom: 'pcs',
        uomProfileId: null,
        uomMode: 'warehouse',
        warehouseUnit: null,
        workshopUnit: null,
        conversionFactor: 1,
        qty: '1',
        unitPrice: '',
        description: '',
    };
}

export default function StorageFacilityNewInvoiceModal({
    brandId,
    brandName,
    products,
    customers,
    suppliers = [],
    uomProfiles = [],
    mode = 'sales',
    onClose,
    onSaved,
}) {
    const sfApi = useStorageFacilityApi();
    const isPurchase = mode === 'purchase';
    const [invoiceType, setInvoiceType] = useState(
        isPurchase ? 'stock_purchase' : 'storage_fee',
    );
    const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [dueDateType, setDueDateType] = useState('Net');
    const [netDays, setNetDays] = useState(30);
    const [customDueDate, setCustomDueDate] = useState('');
    const [reference, setReference] = useState('');
    const [storageCustomerId, setStorageCustomerId] = useState('');
    const [customerSearch, setCustomerSearch] = useState('');
    const [storageSupplierId, setStorageSupplierId] = useState('');
    const [supplierSearch, setSupplierSearch] = useState('');
    const [billingAddress, setBillingAddress] = useState('');
    const [description, setDescription] = useState('');
    const [lines, setLines] = useState(() => [newLine(), newLine()]);
    const [amountsTaxInclusive, setAmountsTaxInclusive] = useState(false);
    const [salesReps, setSalesReps] = useState([]);
    const [salesRepId, setSalesRepId] = useState('');
    const [metaLoading, setMetaLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await sfApi.listStorageSalesReps(brandId);
                if (!cancelled) setSalesReps(res?.salesReps ?? []);
            } catch {
                if (!cancelled) setSalesReps([]);
            } finally {
                if (!cancelled) setMetaLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [brandId, sfApi]);

    const productRefs = useRef([]);
    const uomRefs = useRef([]);
    const qtyRefs = useRef([]);
    const priceRefs = useRef([]);
    const descRefs = useRef([]);

    const inventoryCaps = useMemo(
        () => storageProductsToInvCaps(products),
        [products],
    );

    const customerOptions = useMemo(
        () =>
            (customers || []).map((c) => ({
                id: c.id,
                label: c.name,
                subtitle: [c.code, c.mobile].filter(Boolean).join(' · ') || undefined,
            })),
        [customers],
    );

    const calculatedDueDate = useMemo(() => {
        const issue = new Date(issueDate);
        if (Number.isNaN(issue.getTime())) return '—';
        if (dueDateType === 'Custom') return customDueDate || '—';
        if (dueDateType === 'EOM') {
            const eom = new Date(issue.getFullYear(), issue.getMonth() + 1, 0);
            return eom.toISOString().slice(0, 10);
        }
        const due = new Date(issue);
        due.setDate(issue.getDate() + parseInt(String(netDays || 0), 10));
        return due.toISOString().slice(0, 10);
    }, [issueDate, dueDateType, netDays, customDueDate]);

    const showProductLines =
        isPurchase ||
        invoiceType === 'stock_sale' ||
        invoiceType === 'withdrawal_to_owner' ||
        invoiceType === 'storage_fee';

    const supplierOptions = useMemo(
        () =>
            (suppliers || []).map((s) => ({
                id: s.id,
                label: s.name,
                subtitle: [s.code, s.mobile].filter(Boolean).join(' · ') || undefined,
            })),
        [suppliers],
    );

    const updateLine = useCallback((key, patch) => {
        setLines((prev) => prev.map((ln) => (ln.key === key ? { ...ln, ...patch } : ln)));
    }, []);

    const addLine = () => {
        setLines((prev) => [...prev, newLine()]);
    };

    const removeLine = (key) => {
        setLines((prev) => (prev.length <= 1 ? [newLine()] : prev.filter((ln) => ln.key !== key)));
    };

    const validLines = useMemo(() => {
        if (invoiceType === 'storage_fee' && !lines.some((l) => l.storageProductId)) {
            return [];
        }
        return lines.filter((ln) => {
            if (!ln.storageProductId || ln.qty === '' || Number(ln.qty) <= 0) {
                return false;
            }
            if (invoiceType !== 'storage_fee' && (ln.unitPrice === '' || Number(ln.unitPrice) < 0)) {
                return false;
            }
            if (invoiceType === 'withdrawal_to_owner') {
                const p = products.find((x) => String(x.id) === String(ln.storageProductId));
                const mapId = ln.supplierProductId || p?.warehouseProduct?.id;
                if (!mapId) return false;
            }
            if (isPurchase && !ln.storageProductId) return false;
            return true;
        });
    }, [lines, invoiceType, products, isPurchase]);

    const linesForTotals = useMemo(
        () =>
            lines
                .filter((ln) => ln.qty !== '' && ln.unitPrice !== '')
                .map((ln) => ({ qty: ln.qty, unitAmount: ln.unitPrice })),
        [lines],
    );

    const totals = useMemo(
        () => computeStorageTotals(linesForTotals, amountsTaxInclusive),
        [linesForTotals, amountsTaxInclusive],
    );

    const unitPriceColLabel = amountsTaxInclusive
        ? 'Unit price (incl. VAT)'
        : 'Unit price (excl. VAT)';

    const buildPayloadLines = () => {
        if (validLines.length > 0) {
            return validLines.map((ln) => {
                const p = products.find((x) => String(x.id) === String(ln.storageProductId));
                const unitEx =
                    unitAmountForApi(ln.unitPrice, amountsTaxInclusive) ?? 0;
                const row = {
                    description: ln.description.trim() || p?.name || 'Line',
                    qty: Number(ln.qty),
                    unit: String(ln.uom || p?.warehouseProduct?.warehouseUnit || p?.unit || 'pcs').trim(),
                    unitPrice: unitEx,
                    storageProductId: ln.storageProductId,
                };
                if (ln.uomProfileId) row.uomProfileId = ln.uomProfileId;
                if (invoiceType === 'withdrawal_to_owner') {
                    const mapId = ln.supplierProductId || p?.warehouseProduct?.id;
                    if (mapId) row.supplierProductId = mapId;
                }
                return row;
            });
        }
        const feeUnit = lines[0]?.unitPrice
            ? unitAmountForApi(lines[0].unitPrice, amountsTaxInclusive) ?? 0
            : 0;
        return [
            {
                description: description.trim() || 'Storage fee',
                qty: 1,
                unitPrice: feeUnit,
            },
        ];
    };

    const submit = async (e, postAfter) => {
        e.preventDefault();
        if (isPurchase && !storageSupplierId) {
            window.alert('Select a supplier for this purchase invoice.');
            return;
        }
        if (isPurchase && validLines.length === 0) {
            window.alert('Add at least one product line with quantity and price.');
            return;
        }
        if (invoiceType === 'stock_sale' && !storageCustomerId) {
            window.alert('Select a customer for stock sale.');
            return;
        }
        if (invoiceType === 'stock_sale' && validLines.length === 0) {
            window.alert('Add at least one product line with quantity and price.');
            return;
        }
        if (invoiceType === 'withdrawal_to_owner' && validLines.length === 0) {
            window.alert(
                'Each withdrawal line needs a storage product linked to your warehouse catalog. Link products on the Products tab first.',
            );
            return;
        }
        setSaving(true);
        try {
            const noteParts = [
                reference.trim() ? `Ref: ${reference.trim()}` : null,
                billingAddress.trim() ? `Bill to: ${billingAddress.trim()}` : null,
                description.trim() || null,
            ].filter(Boolean);
            const res = await sfApi.createStorageInvoice(brandId, {
                invoiceType: isPurchase ? 'stock_purchase' : invoiceType,
                issueDate,
                dueDate: calculatedDueDate !== '—' ? calculatedDueDate : undefined,
                storageCustomerId: storageCustomerId || undefined,
                storageSupplierId: storageSupplierId || undefined,
                salesRepId: salesRepId || undefined,
                notes: noteParts.length ? noteParts.join('\n') : undefined,
                lines: buildPayloadLines(),
            });
            if (postAfter) {
                await sfApi.postStorageInvoice(brandId, res.invoice.id);
            }
            onSaved?.();
            onClose?.();
        } catch (ex) {
            window.alert(ex?.message || 'Failed to create invoice');
        } finally {
            setSaving(false);
        }
    };

    const lineGridCols =
        '40px minmax(220px, 2.2fr) minmax(96px, 0.85fr) minmax(96px, 0.7fr) minmax(120px, 0.85fr) minmax(140px, 1.1fr) 48px';

    return (
        <Modal
            title={isPurchase ? 'New purchase invoice' : 'New sales invoice'}
            size="large"
            onClose={() => !saving && onClose?.()}
            contentClassName="sf-doc-modal sf-doc-modal--invoice-ui"
            disableClose={saving}
        >
            <form className="pi-form-container sf-doc-modal-shell" onSubmit={(e) => submit(e, false)}>
                <div className="sf-doc-modal-top">
                <p className="sf-doc-modal-lead">
                    {brandName ? `${brandName} — ` : ''}
                    {isPurchase
                        ? 'Record stock purchased into storage (Dr Inventory, Cr Accounts Payable).'
                        : 'Create storage fee, stock sale, or withdrawal invoice (Accounts Receivable).'}
                </p>

                <div className="pi-header-grid sf-doc-header-row">
                    {!isPurchase ? (
                    <div className="pi-field sf-doc-type-row">
                        <label htmlFor="sf-inv-type">Invoice type</label>
                        <select
                            id="sf-inv-type"
                            value={invoiceType}
                            onChange={(e) => setInvoiceType(e.target.value)}
                        >
                            <option value="storage_fee">Storage fee</option>
                            <option value="stock_sale">Stock sale</option>
                            <option value="withdrawal_to_owner">Withdrawal to your warehouse</option>
                        </select>
                    </div>
                    ) : null}
                    <div className="pi-field">
                        <label>Issue date</label>
                        <div className="pi-input-with-icon">
                            <input
                                type="date"
                                value={issueDate}
                                onChange={(e) => setIssueDate(e.target.value)}
                            />
                            <Calendar size={16} />
                        </div>
                    </div>
                    <div className="pi-field">
                        <label>Due date</label>
                        <div
                            className={`pi-due-grid ${dueDateType === 'EOM' ? 'pi-due-eom' : ''}`}
                        >
                            <select
                                value={dueDateType}
                                onChange={(e) => setDueDateType(e.target.value)}
                            >
                                <option value="Net">Net</option>
                                <option value="Custom">Custom</option>
                                <option value="EOM">EOM</option>
                            </select>
                            {dueDateType === 'Net' ? (
                                <div className="pi-days-input">
                                    <input
                                        type="number"
                                        min="0"
                                        value={netDays}
                                        onChange={(e) => setNetDays(e.target.value)}
                                    />
                                    <span>days</span>
                                </div>
                            ) : null}
                            {dueDateType === 'Custom' ? (
                                <div className="pi-date-input-small">
                                    <input
                                        type="date"
                                        value={customDueDate}
                                        onChange={(e) => setCustomDueDate(e.target.value)}
                                    />
                                </div>
                            ) : null}
                        </div>
                        <span className="pi-sub-label">Due: {calculatedDueDate}</span>
                    </div>
                    <div className="pi-field">
                        <label>Reference (optional)</label>
                        <input
                            type="text"
                            placeholder="Ref #"
                            value={reference}
                            onChange={(e) => setReference(e.target.value)}
                        />
                    </div>
                </div>

                {isPurchase ? (
                    <div className="pi-header-grid sf-doc-header-row">
                        <div className="pi-field" style={{ gridColumn: 'span 2' }}>
                            <label>Supplier *</label>
                            <SearchableEntityCombobox
                                id="sf-inv-supplier"
                                options={supplierOptions}
                                value={storageSupplierId}
                                displayText={supplierSearch}
                                onDisplayTextChange={(t) => {
                                    setSupplierSearch(t);
                                    setStorageSupplierId('');
                                }}
                                onSelect={(s) => {
                                    setStorageSupplierId(String(s.id));
                                    setSupplierSearch(s.label);
                                }}
                                placeholder="Search supplier (AP)…"
                                required
                            />
                        </div>
                        <div className="pi-field">
                            <label htmlFor="sf-inv-sales-rep-p">Sales representative</label>
                            <select
                                id="sf-inv-sales-rep-p"
                                value={salesRepId}
                                disabled={metaLoading}
                                onChange={(e) => setSalesRepId(e.target.value)}
                            >
                                <option value="">Optional</option>
                                {salesReps.map((r) => (
                                    <option key={r.id} value={r.id}>
                                        {r.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                ) : null}

                {(invoiceType === 'stock_sale' ||
                    invoiceType === 'storage_fee' ||
                    invoiceType === 'withdrawal_to_owner') && (
                    <div className="pi-header-grid sf-doc-header-row">
                        {(invoiceType === 'stock_sale' || invoiceType === 'storage_fee') && (
                            <div className="pi-field" style={{ gridColumn: 'span 2' }}>
                                <label>
                                    Customer
                                    {invoiceType === 'stock_sale' ? ' *' : ' (optional)'}
                                </label>
                                <SearchableEntityCombobox
                                    id="sf-inv-customer"
                                    options={customerOptions}
                                    value={storageCustomerId}
                                    displayText={customerSearch}
                                    onDisplayTextChange={(t) => {
                                        setCustomerSearch(t);
                                        setStorageCustomerId('');
                                    }}
                                    onSelect={(c) => {
                                        setStorageCustomerId(String(c.id));
                                        setCustomerSearch(c.label);
                                    }}
                                    placeholder="Search customer…"
                                    required={invoiceType === 'stock_sale'}
                                />
                            </div>
                        )}
                        <div className="pi-field">
                            <label htmlFor="sf-inv-sales-rep">Sales representative</label>
                            <select
                                id="sf-inv-sales-rep"
                                value={salesRepId}
                                disabled={metaLoading}
                                onChange={(e) => setSalesRepId(e.target.value)}
                            >
                                <option value="">Optional</option>
                                {salesReps.map((r) => (
                                    <option key={r.id} value={r.id}>
                                        {r.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}

                {invoiceType === 'withdrawal_to_owner' ? (
                    <p className="sf-doc-hint" style={{ marginBottom: 12 }}>
                        Each line must use a storage product linked to your warehouse catalog (Products tab).
                        Posting creates stock in your warehouse, a super supplier &quot;Storage Facility — {brandName || 'brand'}&quot;, and AP in your chart of accounts.
                    </p>
                ) : null}

                <div className="sf-doc-meta-grid">
                    <div className="pi-field">
                        <label>Billing address (optional)</label>
                        <textarea
                            rows={1}
                            className="sf-compact-textarea"
                            placeholder="Billing address"
                            value={billingAddress}
                            onChange={(e) => setBillingAddress(e.target.value)}
                        />
                    </div>
                    <div className="pi-field">
                        <label>Description (optional)</label>
                        <input
                            type="text"
                            placeholder="Invoice description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>
                </div>
                </div>

                {showProductLines ? (
                    <div className="sf-doc-modal-scroll sf-doc-modal-scroll--lines">
                        <div className="sf-inv-lines-panel">
                            <div className="sf-inv-lines-panel-title">Line items</div>
                            <div
                                className="sf-inv-lines-head"
                                style={{ gridTemplateColumns: lineGridCols }}
                            >
                                <span className="sf-inv-col-label">#</span>
                                <span className="sf-inv-col-label">Product</span>
                                <span className="sf-inv-col-label">UOM</span>
                                <span className="sf-inv-col-label">Qty</span>
                                <span className="sf-inv-col-label">{unitPriceColLabel}</span>
                                <span className="sf-inv-col-label">Line note</span>
                                <span className="sf-inv-col-label sf-inv-col-label--action" />
                            </div>
                            <div className="sf-inv-lines-body">
                        {lines.map((ln, rowIndex) => {
                            const baseCaps = findInventoryCapsRow(ln, inventoryCaps);
                            const capsRow = lineInventoryCapsForInvoice(
                                baseCaps,
                                ln,
                                uomProfiles,
                            );
                            const conversionPreview = formatLineUomConversionPreview(
                                { ...ln, price: ln.unitPrice },
                                capsRow,
                            );
                            const capsForMax = inventoryCaps.map((c) =>
                                String(c.storageProductId) === String(ln.storageProductId)
                                    ? capsRow || c
                                    : c,
                            );
                            const maxQtyCap =
                                invoiceType === 'storage_fee' || isPurchase
                                    ? null
                                    : maxSellableQtyForLine(ln, lines, capsForMax);
                            return (
                            <div key={ln.key} className="sf-inv-line-block">
                            <div
                                className="sf-inv-line-grid"
                                style={{ gridTemplateColumns: lineGridCols }}
                            >
                                <span className="sf-inv-line-num">{rowIndex + 1}</span>
                                <ProductLineCombobox
                                    products={products}
                                    value={ln.storageProductId}
                                    searchText={ln.search}
                                    inputRef={(el) => {
                                        productRefs.current[rowIndex] = el;
                                    }}
                                    onSearchChange={(search) =>
                                        updateLine(ln.key, { search, storageProductId: '' })
                                    }
                                    onSelect={(p) => {
                                        const wh = p.warehouseProduct;
                                        const prof = p.uomProfile;
                                        const uomSource = wh
                                            ? wh
                                            : prof
                                              ? {
                                                    warehouseUnit: prof.warehouseUnit,
                                                    workshopUnit: prof.workshopUnit,
                                                    conversionFactor: prof.conversionFactor,
                                                }
                                              : null;
                                        const uom = defaultUomForWarehouseProduct(
                                            uomSource,
                                            p.unit || 'pcs',
                                        );
                                        updateLine(ln.key, {
                                            storageProductId: String(p.id),
                                            supplierProductId: wh?.id
                                                ? String(wh.id)
                                                : '',
                                            search: p.name || '',
                                            description: ln.description || p.name || '',
                                            uom,
                                            uomProfileId: p.uomProfileId || null,
                                            uomMode: 'warehouse',
                                            warehouseUnit:
                                                wh?.warehouseUnit ??
                                                prof?.warehouseUnit ??
                                                null,
                                            workshopUnit:
                                                wh?.workshopUnit ??
                                                prof?.workshopUnit ??
                                                null,
                                            conversionFactor:
                                                wh?.conversionFactor ??
                                                prof?.conversionFactor ??
                                                1,
                                        });
                                    }}
                                    onTabAdvance={() => uomRefs.current[rowIndex]?.focus()}
                                />
                                <div>
                                    <StorageUomSelect
                                        variant="invoice-line"
                                        profiles={uomProfiles}
                                        capsRow={capsRow}
                                        line={ln}
                                        inputRef={(el) => {
                                            uomRefs.current[rowIndex] = el;
                                        }}
                                        onChange={(parsed) =>
                                            updateLine(ln.key, {
                                                uom: parsed.unit,
                                                uomProfileId: parsed.uomProfileId,
                                                uomMode: parsed.uomMode || 'warehouse',
                                            })
                                        }
                                        onKeyDown={(e) => {
                                            if (e.key === 'Tab' && !e.shiftKey) {
                                                e.preventDefault();
                                                qtyRefs.current[rowIndex]?.focus();
                                            }
                                        }}
                                    />
                                </div>
                                <input
                                    ref={(el) => {
                                        qtyRefs.current[rowIndex] = el;
                                    }}
                                    type="number"
                                    min="0.001"
                                    step="any"
                                    className="pi-row-input pi-row-input-num"
                                    value={ln.qty}
                                    title={
                                        maxQtyCap != null
                                            ? `Maximum ${maxQtyCap} ${ln.uom || 'pcs'} (storage on hand)`
                                            : undefined
                                    }
                                    onChange={(e) =>
                                        updateLine(ln.key, { qty: e.target.value })
                                    }
                                    onKeyDown={(e) => {
                                        if (e.key === 'Tab' && !e.shiftKey) {
                                            e.preventDefault();
                                            priceRefs.current[rowIndex]?.focus();
                                        }
                                    }}
                                />
                                <input
                                    ref={(el) => {
                                        priceRefs.current[rowIndex] = el;
                                    }}
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="pi-row-input pi-row-input-num"
                                    placeholder="0.00"
                                    value={ln.unitPrice}
                                    onChange={(e) =>
                                        updateLine(ln.key, { unitPrice: e.target.value })
                                    }
                                    onKeyDown={(e) => {
                                        if (e.key === 'Tab' && !e.shiftKey) {
                                            e.preventDefault();
                                            descRefs.current[rowIndex]?.focus();
                                        }
                                    }}
                                />
                                <input
                                    ref={(el) => {
                                        descRefs.current[rowIndex] = el;
                                    }}
                                    type="text"
                                    className="pi-row-input"
                                    placeholder="Optional"
                                    value={ln.description}
                                    onChange={(e) =>
                                        updateLine(ln.key, { description: e.target.value })
                                    }
                                    onKeyDown={(e) => {
                                        if (e.key === 'Tab' && !e.shiftKey) {
                                            e.preventDefault();
                                            if (rowIndex === lines.length - 1) {
                                                addLine(true);
                                            } else {
                                                productRefs.current[rowIndex + 1]?.focus();
                                            }
                                        }
                                    }}
                                />
                                <button
                                    type="button"
                                    className="sf-inv-line-remove"
                                    onClick={() => removeLine(ln.key)}
                                    tabIndex={-1}
                                    aria-label="Remove line"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                            {(conversionPreview || maxQtyCap != null) && (
                                <div className="sf-inv-line-meta">
                                    {conversionPreview ? (
                                        <span className="sf-inv-line-meta-conv">
                                            {conversionPreview}
                                        </span>
                                    ) : null}
                                    {maxQtyCap != null ? (
                                        <span className="sf-inv-line-meta-cap">
                                            Max {maxQtyCap} {ln.uom || 'pcs'} — storage on hand
                                        </span>
                                    ) : null}
                                </div>
                            )}
                            </div>
                            );
                        })}
                            </div>
                            <div className="sf-inv-lines-footer">
                                <button type="button" className="btn-add-line sf-inv-add-line" onClick={addLine}>
                                    <Plus size={16} /> Add line
                                </button>
                                <p className="sf-inv-lines-tip">
                                    Stock is stored in workshop units (e.g. Liter). Pick UOM per line:
                                    <strong> Box — 1 Box = 12 Liter</strong> vs{' '}
                                    <strong> Box — 1 Box = 24 Liter</strong> are separate options.
                                    Qty in Box converts to Liters on post; qty in Liter uses liters
                                    directly.
                                </p>
                            </div>
                        </div>
                    </div>
                ) : null}

                <div className="sf-doc-modal-bottom">
                <StorageFacilityVatTotals
                    lines={linesForTotals}
                    amountsTaxInclusive={amountsTaxInclusive}
                    onAmountsTaxInclusiveChange={setAmountsTaxInclusive}
                    unitFieldLabel="Unit price"
                />

                <div className="sf-doc-modal-footer">
                    <button
                        type="button"
                        className="btn-portal-outline"
                        disabled={saving}
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                    <button type="submit" className="btn-portal-outline" disabled={saving}>
                        Save draft
                    </button>
                    <button
                        type="button"
                        className="mgr-si-btn-new"
                        disabled={saving}
                        onClick={(e) => submit(e, true)}
                    >
                        {saving ? 'Saving…' : 'Create & post'}
                    </button>
                </div>
                </div>
            </form>
        </Modal>
    );
}
