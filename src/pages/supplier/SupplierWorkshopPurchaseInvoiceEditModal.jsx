import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, ShoppingCart, Zap } from 'lucide-react';
import Modal from '../../components/Modal';
import { listSupplierMasterCatalogProducts, updateSupplierWorkshopPurchaseInvoice } from '../../services/supplierApi';
import { PI_ACCOUNT_OPTIONS } from '../workshop/constants';
import {
    PURCHASE_INVOICE_TAX_LABEL as TAX_LABEL,
    PURCHASE_INVOICE_VAT_RATE as PI_VAT,
    computeLineAmounts,
    computePurchaseInvoiceTotals,
} from '../workshop/purchaseInvoicePayload';
import {
    buildSupplierWorkshopPurchaseInvoicePatchDto,
    calculateWorkshopPurchaseDueDateISO,
    createBlankSupplierWsPiLine,
    hydrateSupplierWorkshopPurchaseForm,
    masterCatalogRowToPurchaseOption,
    unwrapPurchaseInvoiceFromSupplierGet,
} from './supplierWorkshopPurchaseInvoiceHelpers';
import { ShimmerTextBlock } from '../../components/supplier/Shimmer';

/** Full purchase-invoice style editor for pending workshop→supplier invoices (PATCH). */

function evalMath(expr) {
    const str = String(expr).trim();
    if (!str) return '';
    if (!/^[\d\s+\-*/.()]+$/.test(str)) return str;
    if (/^\d+(\.\d+)?$/.test(str)) return str;
    try {
        const result = Function(`return (${str})`)();
        if (typeof result === 'number' && isFinite(result)) return parseFloat(result.toFixed(6)).toString();
    } catch {
        /* ignore */
    }
    return str;
}

export default function SupplierWorkshopPurchaseInvoiceEditModal({
    open,
    listRow,
    fetchPayload,
    loadingFetch,
    fetchErrorMessage,
    onClose,
    onSaved,
}) {
    const [branchProductOpts, setBranchProductOpts] = useState([]);
    const [branchProductsLoading, setBranchProductsLoading] = useState(false);

    const [issueDate, setIssueDate] = useState('');
    const [dueDateType, setDueDateType] = useState('Net');
    const [netDays, setNetDays] = useState(30);
    const [customDueDate, setCustomDueDate] = useState('');
    const [vendorInvoiceRef, setVendorInvoiceRef] = useState('');
    const [invoiceDescription, setInvoiceDescription] = useState('');
    const [invoiceNotes, setInvoiceNotes] = useState('');
    const [showDesc, setShowDesc] = useState(true);
    const [showDiscount, setShowDiscount] = useState(false);
    const [discountIsPercent, setDiscountIsPercent] = useState(false);
    const [invoiceDiscountValue, setInvoiceDiscountValue] = useState('0');
    const [invoiceDiscountMode, setInvoiceDiscountMode] = useState('fixed_sar');
    const [lineItems, setLineItems] = useState([]);
    const [persistedPaidAmount, setPersistedPaidAmount] = useState(0);
    const [workshopName, setWorkshopName] = useState('');
    const [branchName, setBranchName] = useState('');
    const [branchId, setBranchId] = useState('');

    const [saveError, setSaveError] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setSaveError('');
    }, [open]);

    /** Hydrate from GET response */
    useEffect(() => {
        if (!open || loadingFetch) return;
        if (fetchErrorMessage) return;
        const raw = unwrapPurchaseInvoiceFromSupplierGet(fetchPayload);
        if (!raw || String(raw.id ?? '').trim() === '') return;
        const h = hydrateSupplierWorkshopPurchaseForm(raw);
        setIssueDate(h.issueDate);
        setDueDateType(h.dueDateType);
        setNetDays(h.netDays);
        setCustomDueDate(h.customDueDate);
        setVendorInvoiceRef(h.vendorInvoiceRef);
        setInvoiceDescription(h.description);
        setInvoiceNotes(h.invoiceNotes);
        setShowDesc(h.showDesc);
        setShowDiscount(h.showDiscount);
        setDiscountIsPercent(h.discountIsPercent);
        setInvoiceDiscountValue(h.invoiceDiscountValue);
        setInvoiceDiscountMode(h.invoiceDiscountMode);
        setLineItems(h.lineItems);
        setPersistedPaidAmount(h.persistedPaidAmount);
        setWorkshopName(h.workshopName);
        setBranchName(h.branchName);
        setBranchId(h.branchId);
    }, [open, fetchPayload, loadingFetch, fetchErrorMessage]);

    /** Branch scoped master catalog → product dropdown options */
    useEffect(() => {
        if (!open || !branchId) {
            setBranchProductOpts([]);
            return;
        }
        let cancelled = false;
        setBranchProductsLoading(true);
        listSupplierMasterCatalogProducts({ branchId })
            .then((res) => {
                const rows = Array.isArray(res?.products) ? res.products : [];
                const opts = rows.map(masterCatalogRowToPurchaseOption).filter(Boolean);
                if (!cancelled) setBranchProductOpts(opts);
            })
            .catch(() => {
                if (!cancelled) setBranchProductOpts([]);
            })
            .finally(() => {
                if (!cancelled) setBranchProductsLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [open, branchId]);

    const applyDiscountForCalc = showDiscount;

    const recalcStoredLineTotals = (line) => {
        const { taxAmt, totalIncl } = computeLineAmounts(line, applyDiscountForCalc, discountIsPercent);
        return {
            ...line,
            taxCode: TAX_LABEL,
            taxAmt: taxAmt.toFixed(2),
            totalFinal: totalIncl.toFixed(2),
        };
    };

    useEffect(() => {
        setLineItems((prev) =>
            prev.map((line) => recalcStoredLineTotals(line)),
        );
    }, [showDiscount, discountIsPercent]); // eslint-disable-line react-hooks/exhaustive-deps

    const updateLineItem = (clientRowKey, field, value) => {
        setLineItems((prev) =>
            prev.map((line) => {
                if (line.clientRowKey !== clientRowKey) return line;
                const updatedLine = { ...line, [field]: value };
                return recalcStoredLineTotals(updatedLine);
            }),
        );
    };

    const handleLineProductChange = (clientRowKey, productId) => {
        if (!productId) {
            setLineItems((prev) =>
                prev.map((line) => {
                    if (line.clientRowKey !== clientRowKey) return line;
                    const cleared = {
                        ...line,
                        productId: '',
                        item: '',
                        price: 0,
                        uom: 'piece',
                        account: '1410 - Inventory Asset',
                    };
                    return recalcStoredLineTotals(cleared);
                }),
            );
            return;
        }
        const opt = branchProductOpts.find((o) => o.id === productId);
        if (!opt) return;
        setLineItems((prev) =>
            prev.map((line) => {
                if (line.clientRowKey !== clientRowKey) return line;
                const next = {
                    ...line,
                    productId: opt.id,
                    item: opt.name,
                    uom: opt.unit,
                    account: '1410 - Inventory Asset',
                    price: opt.priceExcl,
                };
                return recalcStoredLineTotals(next);
            }),
        );
    };

    /** masterCatalogRowToPurchaseOption lacks type — inventory default */
    const addEmptyLine = () => setLineItems((prev) => [...prev, createBlankSupplierWsPiLine()]);

    const removeLineAt = useCallback((clientRowKey) => {
        setLineItems((prev) => {
            const next = prev.filter((l) => l.clientRowKey !== clientRowKey);
            return next.length > 0 ? next : [createBlankSupplierWsPiLine()];
        });
    }, []);

    const invoiceTotals = useMemo(
        () =>
            computePurchaseInvoiceTotals({
                lineItems,
                applyLineDiscount: applyDiscountForCalc,
                lineDiscountIsPercent: discountIsPercent,
                invoiceDiscountMode,
                invoiceDiscountValue,
                vatRate: PI_VAT,
            }),
        [
            lineItems,
            applyDiscountForCalc,
            discountIsPercent,
            invoiceDiscountMode,
            invoiceDiscountValue,
        ],
    );

    const summary = useMemo(
        () => ({
            subtotal: invoiceTotals.subtotal_ex_vat.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }),
            totalTax: invoiceTotals.total_vat.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }),
            grandTotal: invoiceTotals.grand_total.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }),
        }),
        [invoiceTotals],
    );

    const computedDueISO = calculateWorkshopPurchaseDueDateISO(issueDate, dueDateType, netDays, customDueDate);

    const hasStockLine = lineItems.some((l) => l.productId && String(l.productId).trim());

    const handleMathKeyDown = (e, lineId, field) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const v = evalMath(e.target.value);
            updateLineItem(lineId, field, v);
            e.target.value = v;
        }
    };

    const handleMathBlur = (e, clientRowKey, field) => {
        const v = evalMath(e.target.value);
        if (v !== e.target.value) updateLineItem(clientRowKey, field, v);
    };

    const handleSave = async () => {
        setSaveError('');
        if (!listRow?.id) return;
        if (!computedDueISO) {
            setSaveError('Issue date / due terms are incomplete.');
            return;
        }
        if (!branchId) {
            setSaveError('Missing workshop branch scope on invoice — reload and try again.');
            return;
        }
        try {
            const dto = buildSupplierWorkshopPurchaseInvoicePatchDto({
                lineItems,
                showDiscount,
                discountIsPercent,
                invoiceDiscountMode,
                invoiceDiscountValue,
                issueDate,
                dueDateType,
                netDays,
                customDueDate,
                vendorInvoiceRef,
                description: invoiceDescription,
                notes: invoiceNotes,
                persistedPaidAmount,
            });
            setSaving(true);
            await updateSupplierWorkshopPurchaseInvoice(listRow.id, dto);
            if (onSaved) await onSaved();
            onClose();
        } catch (e) {
            setSaveError(e.message || 'Update failed.');
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;

    const modalTitleEl = (
        <div className="pi-modal-title">
            <span className="pi-breadcrumb">
                Workshop purchases › <span className="pi-b-active">Edit</span>
            </span>
            <div className="pi-title-main">
                <ShoppingCart className="pi-icon-orange" size={24} />
                <span>Purchase Invoice</span>
            </div>
            {listRow?.invoice_number ? (
                <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', fontWeight: 600, color: '#EA580C' }}>
                    {listRow.invoice_number}
                </p>
            ) : null}
        </div>
    );

    const workshopBranchLabel =
        branchName || workshopName
            ? `${branchName || 'Branch'}${workshopName ? ` · ${workshopName}` : ''}`
            : '—';

    return (
        <Modal
            title={modalTitleEl}
            onClose={onClose}
            width="1350px"
            contentClassName="modal-content-purchase"
            footer={
                <div className="pi-modal-footer">
                    <div className="pi-footer-left">
                        <button type="button" className="btn-pi-cancel" onClick={onClose}>
                            Cancel
                        </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                        {saveError ? (
                            <p style={{ margin: 0, fontSize: '0.8125rem', color: '#B91C1C', maxWidth: 420, textAlign: 'right' }}>
                                {saveError}
                            </p>
                        ) : null}
                        <button
                            type="button"
                            className="btn-pi-create"
                            onClick={() => void handleSave()}
                            disabled={
                                saving ||
                                loadingFetch ||
                                Boolean(fetchErrorMessage) ||
                                lineItems.length === 0
                            }
                        >
                            {saving ? 'Saving…' : 'Save changes'}
                        </button>
                    </div>
                </div>
            }
        >
            <div className="pi-form-container">
                {fetchErrorMessage ? (
                    <p style={{ margin: 0, color: '#B91C1C' }}>{fetchErrorMessage}</p>
                ) : loadingFetch && lineItems.length === 0 ? (
                    <div style={{ padding: '8px 0' }}>
                        <ShimmerTextBlock lines={6} />
                    </div>
                ) : (
                    <>
                        <div className="pi-header-grid">
                            <div className="pi-field">
                                <label>Issue Date</label>
                                <input
                                    type="date"
                                    value={issueDate}
                                    onChange={(e) => setIssueDate(e.target.value)}
                                    style={{
                                        padding: '10px 14px',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: 10,
                                        fontSize: '0.9375rem',
                                        width: '100%',
                                    }}
                                />
                            </div>
                            <div className="pi-field">
                                <label>Due</label>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                    <select
                                        value={dueDateType}
                                        onChange={(e) => setDueDateType(e.target.value)}
                                        style={{
                                            padding: '10px 12px',
                                            borderRadius: 10,
                                            border: '1px solid #e2e8f0',
                                        }}
                                    >
                                        <option value="Net">Net</option>
                                        <option value="Custom">Custom</option>
                                        <option value="EOM">End of Month</option>
                                    </select>
                                    {dueDateType === 'Net' && (
                                        <>
                                            <input
                                                type="number"
                                                min={0}
                                                max={366}
                                                value={netDays}
                                                onChange={(e) => setNetDays(Number(e.target.value))}
                                                style={{ width: 72, padding: '8px 10px', borderRadius: 8 }}
                                            />
                                            <span style={{ fontSize: '0.8125rem' }}>days</span>
                                        </>
                                    )}
                                    {dueDateType === 'Custom' && (
                                        <input
                                            type="date"
                                            value={customDueDate}
                                            onChange={(e) => setCustomDueDate(e.target.value)}
                                            style={{
                                                padding: '8px 12px',
                                                borderRadius: 8,
                                                border: '1px solid #e2e8f0',
                                            }}
                                        />
                                    )}
                                    <span className="pi-sub-label" style={{ width: '100%' }}>
                                        Due: {computedDueISO || '—'}
                                    </span>
                                </div>
                            </div>
                            <div className="pi-field">
                                <label>Ref # (optional)</label>
                                <input
                                    placeholder="Vendor inv #"
                                    value={vendorInvoiceRef}
                                    onChange={(e) => setVendorInvoiceRef(e.target.value)}
                                />
                            </div>
                            <div className="pi-field pi-full-width">
                                <label>Workshop · Branch</label>
                                <div
                                    style={{
                                        padding: '10px 14px',
                                        background: '#f8fafc',
                                        borderRadius: 10,
                                        border: '1px solid #e2e8f0',
                                        fontWeight: 600,
                                        color: '#334155',
                                    }}
                                >
                                    {workshopBranchLabel}
                                </div>
                                <span className="pi-sub-label" style={{ marginTop: 4 }}>
                                    Sending branch is assigned by the workshop; you edit lines and totals here.
                                </span>
                                {!hasStockLine ? (
                                    <span className="pi-sub-label" style={{ marginTop: 4, display: 'block', color: '#B45309' }}>
                                        Tip: approve stock only applies to lines linked to an active catalog product.
                                    </span>
                                ) : null}
                            </div>
                            <div className="pi-field pi-full-width">
                                <label>Description</label>
                                <input
                                    type="text"
                                    placeholder="Invoice description (optional)"
                                    value={invoiceDescription}
                                    onChange={(e) => setInvoiceDescription(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="pi-lines-section ws-pi-lines-section">
                            <div className="ws-pi-lines-scroll">
                                <table className="ws-pi-lines-table">
                                    <colgroup>
                                        <col style={{ width: 44 }} />
                                        <col style={{ width: showDesc ? '20%' : '26%' }} />
                                        <col style={{ width: showDesc ? '16%' : '20%' }} />
                                        {showDesc ? <col style={{ width: '14%' }} /> : null}
                                        <col style={{ width: 72 }} />
                                        <col style={{ width: 72 }} />
                                        <col style={{ width: 96 }} />
                                        {showDiscount ? <col style={{ width: 88 }} /> : null}
                                        <col style={{ width: showDiscount ? '9%' : '11%' }} />
                                        <col style={{ width: 88 }} />
                                        <col style={{ width: 88 }} />
                                        <col style={{ width: showDiscount ? '9%' : '11%' }} />
                                        <col style={{ width: 56 }} />
                                    </colgroup>
                                    <thead>
                                        <tr>
                                            <th className="ws-pi-th-hash">#</th>
                                            <th scope="col">Item</th>
                                            <th scope="col">Account</th>
                                            {showDesc ? <th scope="col">Description</th> : null}
                                            <th scope="col">UOM</th>
                                            <th className="ws-pi-th-num">Qty</th>
                                            <th className="ws-pi-th-num">Unit price</th>
                                            {showDiscount ? (
                                                <th className="ws-pi-th-num">Discount{discountIsPercent ? ' %' : ' (SAR)'}</th>
                                            ) : null}
                                            <th className="ws-pi-th-num">Total</th>
                                            <th scope="col">Tax Code</th>
                                            <th className="ws-pi-th-num">Tax Amt</th>
                                            <th className="ws-pi-th-num">Total</th>
                                            <th className="ws-pi-th-num" aria-label="Remove line" />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lineItems.map((line, idx) => {
                                            const amounts = computeLineAmounts(
                                                line,
                                                applyDiscountForCalc,
                                                discountIsPercent,
                                            );
                                            return (
                                                <tr key={line.clientRowKey}>
                                                    <td className="ws-pi-td-hash">{idx + 1}</td>
                                                    <td>
                                                        <select
                                                            className="pi-row-input ws-pi-select"
                                                            value={line.productId}
                                                            disabled={branchProductsLoading || !branchId}
                                                            onChange={(e) =>
                                                                handleLineProductChange(line.clientRowKey, e.target.value)
                                                            }
                                                        >
                                                            <option value="">
                                                                {branchProductsLoading ? 'Loading products…' : '— Catalog product —'}
                                                            </option>
                                                            {branchProductOpts.map((p) => (
                                                                <option key={p.id} value={p.id}>
                                                                    {p.name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <input
                                                            type="text"
                                                            className="pi-row-input"
                                                            placeholder="Displayed name…"
                                                            value={line.item}
                                                            onChange={(e) =>
                                                                updateLineItem(line.clientRowKey, 'item', e.target.value)
                                                            }
                                                            style={{ marginTop: 6, fontSize: '0.8rem', width: '100%' }}
                                                        />
                                                    </td>
                                                    <td>
                                                        <select
                                                            className="pi-row-input ws-pi-select"
                                                            value={line.account}
                                                            onChange={(e) =>
                                                                updateLineItem(line.clientRowKey, 'account', e.target.value)
                                                            }
                                                        >
                                                            {PI_ACCOUNT_OPTIONS.map((opt) => (
                                                                <option key={opt.code} value={`${opt.code} - ${opt.name}`}>
                                                                    {opt.code} - {opt.name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    {showDesc ? (
                                                        <td>
                                                            <input
                                                                type="text"
                                                                value={line.description}
                                                                className="pi-row-input"
                                                                onChange={(e) =>
                                                                    updateLineItem(
                                                                        line.clientRowKey,
                                                                        'description',
                                                                        e.target.value,
                                                                    )
                                                                }
                                                            />
                                                        </td>
                                                    ) : null}
                                                    <td>
                                                        <input
                                                            type="text"
                                                            value={line.uom}
                                                            className="pi-row-input"
                                                            style={{ minWidth: 64 }}
                                                            onChange={(e) =>
                                                                updateLineItem(line.clientRowKey, 'uom', e.target.value)
                                                            }
                                                        />
                                                    </td>
                                                    <td className="ws-pi-td-num">
                                                        <input
                                                            type="text"
                                                            defaultValue={line.qty}
                                                            key={`qty-${line.clientRowKey}-${line.qty}`}
                                                            className="pi-row-input-num pi-math-input"
                                                            onChange={(e) =>
                                                                updateLineItem(line.clientRowKey, 'qty', e.target.value)
                                                            }
                                                            onKeyDown={(e) => handleMathKeyDown(e, line.clientRowKey, 'qty')}
                                                            onBlur={(e) => handleMathBlur(e, line.clientRowKey, 'qty')}
                                                        />
                                                    </td>
                                                    <td className="ws-pi-td-num ws-pi-price-cell" title="Ex-VAT unit">
                                                        <input
                                                            type="text"
                                                            value={
                                                                line.price === '' || line.price == null ? '' : line.price
                                                            }
                                                            className="pi-row-input-num pi-math-input"
                                                            placeholder="0"
                                                            onChange={(e) =>
                                                                updateLineItem(line.clientRowKey, 'price', e.target.value)
                                                            }
                                                            onKeyDown={(e) => handleMathKeyDown(e, line.clientRowKey, 'price')}
                                                            onBlur={(e) => handleMathBlur(e, line.clientRowKey, 'price')}
                                                        />
                                                    </td>
                                                    {showDiscount ? (
                                                        <td className="ws-pi-td-num">
                                                            <input
                                                                type="text"
                                                                className="pi-row-input-num pi-math-input"
                                                                defaultValue={line.discount}
                                                                key={`disc-${line.clientRowKey}-${line.discount}`}
                                                                onChange={(e) =>
                                                                    updateLineItem(line.clientRowKey, 'discount', e.target.value)
                                                                }
                                                                onKeyDown={(e) => handleMathKeyDown(e, line.clientRowKey, 'discount')}
                                                                onBlur={(e) => handleMathBlur(e, line.clientRowKey, 'discount')}
                                                            />
                                                        </td>
                                                    ) : null}
                                                    <td className="ws-pi-td-num">SAR {amounts.taxableExcl.toFixed(2)}</td>
                                                    <td className="ws-pi-td-tax">{TAX_LABEL}</td>
                                                    <td className="ws-pi-td-num">SAR {amounts.taxAmt.toFixed(2)}</td>
                                                    <td className="ws-pi-td-num ws-pi-td-strong">SAR {amounts.totalIncl.toFixed(2)}</td>
                                                    <td className="ws-pi-td-num">
                                                        <button
                                                            type="button"
                                                            aria-label="Remove line"
                                                            onClick={() => removeLineAt(line.clientRowKey)}
                                                            style={{
                                                                border: 'none',
                                                                borderRadius: 6,
                                                                background: '#FEE2E2',
                                                                color: '#B91C1C',
                                                                cursor: 'pointer',
                                                                padding: '4px 8px',
                                                                fontSize: '0.7rem',
                                                            }}
                                                        >
                                                            ✕
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div className="pi-line-row">
                                <div style={{ flex: 1 }} />
                                <button type="button" className="btn-add-line" onClick={addEmptyLine}>
                                    <Plus size={16} /> Add line
                                </button>
                            </div>
                            <div className="pi-hint">
                                <Zap size={14} /> VAT applies at 15% after line discounts. Pick a catalog product tied to this
                                branch so approved invoices can refresh branch stock automatically.
                            </div>
                        </div>

                        <div className="pi-config-row">
                            <label className="pi-checkbox">
                                <input type="checkbox" checked={showDesc} onChange={(e) => setShowDesc(e.target.checked)} />
                                <span>Column — Description</span>
                            </label>
                            <label className="pi-checkbox">
                                <input type="checkbox" checked={showDiscount} onChange={(e) => setShowDiscount(e.target.checked)} />
                                <span>Column — Discount</span>
                            </label>
                            {showDiscount && (
                                <span className="pi-discount-kind" style={{ display: 'inline-flex', alignItems: 'center', gap: 12, marginLeft: 8 }}>
                                    <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Discount type:</span>
                                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                        <input type="radio" name="supplier-pi-disc" checked={!discountIsPercent} onChange={() => setDiscountIsPercent(false)} />
                                        SAR
                                    </label>
                                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                        <input type="radio" name="supplier-pi-disc" checked={discountIsPercent} onChange={() => setDiscountIsPercent(true)} />
                                        %
                                    </label>
                                </span>
                            )}
                        </div>

                        <div className="pi-footer-grid">
                            <div className="pi-footer-column">
                                <div className="pi-field-inline">
                                    <label>Invoice Discount</label>
                                    <div className="pi-discount-group">
                                        <input
                                            type="text"
                                            value={invoiceDiscountValue}
                                            onChange={(e) => setInvoiceDiscountValue(e.target.value)}
                                        />
                                        <select
                                            value={invoiceDiscountMode}
                                            onChange={(e) => setInvoiceDiscountMode(e.target.value)}
                                        >
                                            <option value="fixed_sar">Fixed (SAR)</option>
                                            <option value="percent">Percent (%)</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="pi-field pi-full-width">
                                    <label>Notes</label>
                                    <textarea
                                        placeholder="Internal notes"
                                        rows={4}
                                        value={invoiceNotes}
                                        onChange={(e) => setInvoiceNotes(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="pi-footer-column pi-summary-column">
                                <div style={{ padding: '8px 0', fontWeight: 600 }}>Totals</div>
                                <table className="pi-summary-mini">
                                    <tbody>
                                        <tr>
                                            <td>Subtotal</td>
                                            <td style={{ fontWeight: 700 }}>
                                                SAR{' '}{summary.subtotal}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>Total VAT</td>
                                            <td>SAR{' '}{summary.totalTax}</td>
                                        </tr>
                                        <tr>
                                            <td>Grand total</td>
                                            <td className="pi-grand-total">SAR{' '}{summary.grandTotal}</td>
                                        </tr>
                                        {persistedPaidAmount > 0 ? (
                                            <tr>
                                                <td>Recorded paid</td>
                                                <td style={{ fontWeight: 600 }}>
                                                    SAR {persistedPaidAmount.toLocaleString()}
                                                </td>
                                            </tr>
                                        ) : null}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
}
