import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Plus, ShoppingCart, Building2 } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import RowActionsMenu from '../../components/RowActionsMenu';
import '../../styles/admin/AccountingPage.css';
import {
    listSupplierSuperSupplierPurchases,
    getSupplierSuperSupplierPurchase,
    createSupplierSuperSupplierPurchase,
    updateSupplierSuperSupplierPurchase,
    listSupplierMasterCatalogProducts,
} from '../../services/supplierApi';
import { ShimmerTable, ShimmerTextBlock } from '../../components/supplier/Shimmer';
import WorkshopPurchaseInvoiceView from '../../components/supplier/WorkshopPurchaseInvoiceView';

function unwrapProducts(res) {
    if (!res || typeof res !== 'object') return [];
    if (Array.isArray(res)) return res;
    const raw = res.products ?? res.items ?? res.list ?? [];
    return Array.isArray(raw) ? raw : [];
}

function newLineRow() {
    return {
        uid: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        productName: '',
        sku: '',
        supplierProductId: undefined,
        qty: '1',
        unit: 'pcs',
        unitPrice: '',
    };
}

function parseNum(v) {
    const n = parseFloat(String(v ?? '').replace(/,/g, ''));
    return Number.isFinite(n) ? n : 0;
}

function sarFmt(v) {
    const n = Number(v ?? 0);
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function purchaseMetaSummary(meta) {
    if (meta == null || typeof meta !== 'object') return '';
    const parts = [];
    if (meta.showLineNum) parts.push('Line #');
    if (meta.showDesc) parts.push('Desc');
    if (meta.showDiscount) parts.push('Disc');
    if (meta.amountsTaxInclusive) parts.push('Tax incl.');
    return parts.join(' · ');
}

/**
 * Supplier-side list + detail + full line-item composer for upstream (super supplier) purchases.
 */
export default function SupplierSuperSupplierPurchasesPanel({
    superSuppliers = [],
    createIntentSupplierId = null,
    onConsumeCreateIntent,
    onPurchasesMutated,
    /** Opens parent Purchase Invoices modal — same full form as &quot;New Purchase Invoice&quot; */
    onEditPurchase,
}) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');

    const [viewRow, setViewRow] = useState(null);
    const [viewDetail, setViewDetail] = useState(null);
    const [viewLoading, setViewLoading] = useState(false);

    const [composer, setComposer] = useState(null);
    /** { open, mode, purchaseId?, superSupplierId, purchaseDate, vendorRef, description, notes, vatAmount, lines } */

    const [catalog, setCatalog] = useState([]);
    const [catalogLoading, setCatalogLoading] = useState(false);

    const [saving, setSaving] = useState(false);
    const [composerErr, setComposerErr] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const res = await listSupplierSuperSupplierPurchases({ limit: 200, offset: 0 });
            setRows(Array.isArray(res?.purchases) ? res.purchases : []);
        } catch (e) {
            setRows([]);
            setErr(e?.message || 'Failed to load super supplier purchases.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        if (!createIntentSupplierId) return;
        const sid = String(createIntentSupplierId);
        setComposer({
            mode: 'create',
            purchaseId: null,
            superSupplierId: sid,
            purchaseDate: new Date().toISOString().slice(0, 10),
            vendorRef: '',
            description: '',
            notes: '',
            vatAmount: '0',
            updatePurchasePriceOnSave: true,
            lines: [newLineRow()],
        });
        setComposerErr('');
        onConsumeCreateIntent?.();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [createIntentSupplierId]);

    useEffect(() => {
        if (!composer) return undefined;
        let cancelled = false;
        setCatalogLoading(true);
        listSupplierMasterCatalogProducts()
            .then((res) => {
                if (cancelled) return;
                const masters = Array.isArray(res?.products)
                    ? res.products
                    : Array.isArray(res?.items)
                      ? res.items
                      : Array.isArray(res)
                        ? res
                        : [];
                setCatalog(
                    masters.map((p) => ({
                        id: String(p.id ?? ''),
                        name: p.name ?? p.productName ?? 'Item',
                        sku: (p.sku || '').trim(),
                        unit: (p.warehouseUnit || p.unit || p.uom || 'pcs').trim() || 'pcs',
                        price: Number(p.purchasePrice ?? p.salePrice ?? p.price ?? 0),
                    })),
                );
            })
            .catch(() => {
                if (!cancelled) setCatalog([]);
            })
            .finally(() => {
                if (!cancelled) setCatalogLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [composer]);

    const catalogOptions = useMemo(
        () => catalog.filter((c) => c.id && (c.name || '').trim()),
        [catalog],
    );

    const openView = async (r) => {
        setViewRow(r);
        setViewDetail(null);
        setViewLoading(true);
        try {
            const d = await getSupplierSuperSupplierPurchase(r.id);
            setViewDetail(d?.purchase ?? d?.data ?? d);
        } catch {
            setViewDetail(null);
            setErr('Could not load purchase detail.');
        } finally {
            setViewLoading(false);
        }
    };

    const openEdit = (r) => {
        setComposerErr('');
        if (onEditPurchase) {
            onEditPurchase(String(r.id));
            return;
        }
        setComposerErr('Edit is not wired.');
    };

    const summary = useMemo(() => {
        if (!composer?.lines?.length)
            return { subtotal: 0, vat: 0, grand: 0 };
        const subtotal = composer.lines.reduce((acc, ln) => {
            const qty = parseNum(ln.qty);
            const up = parseNum(ln.unitPrice);
            return acc + qty * up;
        }, 0);
        const vat = parseNum(composer.vatAmount);
        return {
            subtotal,
            vat,
            grand: subtotal + vat,
        };
    }, [composer]);

    const persistComposer = async () => {
        if (!composer?.superSupplierId) {
            setComposerErr('Select a super supplier.');
            return;
        }
        const items = composer.lines
            .filter((l) => (l.productName || '').trim())
            .map((l) => ({
                productName: (l.productName || '').trim(),
                sku: (l.sku || '').trim() || undefined,
                ...(l.supplierProductId != null &&
                String(l.supplierProductId).trim() !== ''
                    ? { supplierProductId: String(l.supplierProductId).trim() }
                    : {}),
                qty: parseNum(l.qty) || 0,
                unit: (l.unit || 'pcs').trim() || 'pcs',
                unitPrice: parseNum(l.unitPrice),
            }))
            .filter((l) => l.qty > 0 && l.unitPrice >= 0);
        if (!items.length) {
            setComposerErr('Add at least one product line with name, qty and unit price.');
            return;
        }
        setSaving(true);
        setComposerErr('');
        const payload = {
            superSupplierId: String(composer.superSupplierId),
            purchaseDate: composer.purchaseDate,
            vendorRef: (composer.vendorRef || '').trim() || undefined,
            referenceNo: (composer.vendorRef || '').trim() || undefined,
            description: (composer.description || '').trim() || undefined,
            notes: (composer.notes || '').trim() || undefined,
            vatAmount: parseNum(composer.vatAmount),
            updatePurchasePriceOnSave: composer.updatePurchasePriceOnSave !== false,
            items,
        };
        try {
            if (composer.mode === 'edit' && composer.purchaseId) {
                await updateSupplierSuperSupplierPurchase(composer.purchaseId, payload);
            } else {
                await createSupplierSuperSupplierPurchase(payload);
            }
            setComposer(null);
            await load();
            onPurchasesMutated?.();
        } catch (e) {
            setComposerErr(e?.message || 'Save failed.');
        } finally {
            setSaving(false);
        }
    };

    const addCatalogLine = (productId) => {
        if (!productId || !composer) return;
        const p = catalogOptions.find((c) => c.id === productId);
        if (!p) return;
        setComposer((prev) =>
            prev
                ? {
                      ...prev,
                      lines: [
                          ...prev.lines,
                          {
                              uid: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                              productName: p.name,
                              sku: p.sku || '',
                              supplierProductId: p.id,
                              qty: '1',
                              unit: p.unit || 'pcs',
                              unitPrice: String(p.price ?? ''),
                          },
                      ],
                  }
                : prev,
        );
    };

    const statusTone = (s) => {
        const x = (s || '').toLowerCase();
        if (x === 'cancelled') return 'ws-badge--red';
        if (x === 'draft') return 'ws-badge--yellow';
        return 'ws-badge--green';
    };

    return (
        <div className="ws-section" style={{ marginTop: 24, overflow: 'hidden' }}>
            <div
                style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--color-border-light)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    gap: 12,
                    alignItems: 'center',
                }}
            >
                <div>
                    <h3
                        style={{
                            margin: 0,
                            fontSize: '1rem',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                        }}
                    >
                        <ShoppingCart size={18} /> Super supplier purchase invoices
                    </h3>
                    <p style={{ margin: '6px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                        Bills from your upstream vendors — line items stored in database; edit anytime.
                    </p>
                    <p
                        style={{
                            margin: '8px 0 0',
                            fontSize: '0.75rem',
                            color: '#065F46',
                            fontWeight: 600,
                        }}
                    >
                        Auto-posted to the supplier <strong>General Ledger</strong>: Dr Inventory + VAT Input / Cr AP
                        Super Supplier, plus per-product moving-average updates.
                    </p>
                </div>
                <button type="button" className="btn-portal" onClick={() => load()} disabled={loading}>
                    <RefreshCw size={14} /> {loading ? 'Loading…' : 'Refresh'}
                </button>
            </div>

            {err ? (
                <div
                    style={{
                        margin: 12,
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

            <div style={{ overflowX: 'auto' }}>
                <table className="ws-table">
                    <thead>
                        <tr>
                            <th>Invoice #</th>
                            <th>Vendor</th>
                            <th>Vendor ref</th>
                            <th>Issue date</th>
                            <th>Product</th>
                            <th>Qty / Unit</th>
                            <th>Unit price</th>
                            <th>Lines</th>
                            <th>Freight</th>
                            <th>Discount</th>
                            <th>Form options</th>
                            <th>Total</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && rows.length === 0 ? (
                            <tr>
                                <td colSpan={14} style={{ padding: 16, verticalAlign: 'top' }}>
                                    <ShimmerTable rows={8} columns={14} />
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={14} style={{ textAlign: 'center', padding: 36, color: 'var(--color-text-muted)' }}>
                                    No purchases yet — use{' '}
                                    <strong>&quot;Record purchase&quot;</strong> beside a vendor.
                                </td>
                            </tr>
                        ) : (
                            rows.map((r) => (
                                <tr
                                    key={r.id}
                                    style={{ cursor: 'pointer' }}
                                    title={
                                        (r.moreLines ?? 0) > 0 || (r.itemCount ?? 0) > 1
                                            ? 'Click to view all products and line details'
                                            : 'Click to view invoice details'
                                    }
                                    onClick={() => openView(r)}
                                >
                                    <td>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openView(r);
                                            }}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                padding: 0,
                                                fontWeight: 800,
                                                color: '#EA580C',
                                                cursor: 'pointer',
                                                textDecoration: 'underline',
                                                fontSize: '0.9375rem',
                                            }}
                                            title="View invoice"
                                        >
                                            {r.invoiceNo ?? `SSP-${r.id}`}
                                        </button>
                                    </td>
                                    <td style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <Building2 size={14} style={{ opacity: 0.5 }} aria-hidden />{' '}
                                            {r.superSupplierName ?? '—'}
                                        </span>
                                    </td>
                                    <td style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                                        {r.vendorRef || '—'}
                                    </td>
                                    <td style={{ fontSize: '0.8125rem' }}>{r.purchaseDate || '—'}</td>
                                    <td style={{ fontSize: '0.8125rem', maxWidth: 220 }} title={r.primaryProductName}>
                                        {r.primaryProductName ?? '—'}
                                        {r.moreLines > 0 ? (
                                            <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                                                + {r.moreLines} more…
                                            </div>
                                        ) : null}
                                    </td>
                                    <td style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                                        {r.primaryQty != null && r.primaryQty !== ''
                                            ? `${r.primaryQty} ${r.primaryUnit || ''}`
                                            : '—'}
                                    </td>
                                    <td
                                        style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}
                                        title="Unit price for the first line (per quantity / per piece)"
                                    >
                                        {r.primaryUnitPrice != null && Number.isFinite(Number(r.primaryUnitPrice)) ? (
                                            <>
                                                SAR{' '}
                                                {Number(r.primaryUnitPrice).toLocaleString(undefined, {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                })}
                                                {r.primaryUnit ? (
                                                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                                                        {' '}
                                                        / {r.primaryUnit}
                                                    </span>
                                                ) : null}
                                            </>
                                        ) : (
                                            '—'
                                        )}
                                    </td>
                                    <td style={{ fontSize: '0.8125rem' }}>{r.itemCount ?? 0}</td>
                                    <td style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                                        SAR {sarFmt(r.freightIn)}
                                    </td>
                                    <td style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                                        SAR {sarFmt(r.invoiceDiscount)}
                                    </td>
                                    <td
                                        style={{
                                            fontSize: '0.6875rem',
                                            color: 'var(--color-text-muted)',
                                            maxWidth: 160,
                                            lineHeight: 1.35,
                                        }}
                                        title={purchaseMetaSummary(r.purchaseFormMeta) || undefined}
                                    >
                                        {purchaseMetaSummary(r.purchaseFormMeta) || '—'}
                                    </td>
                                    <td>
                                        <strong>SAR {(r.total ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                                    </td>
                                    <td>
                                        <span className={`ws-badge ${statusTone(r.status)}`}>{r.status ?? 'posted'}</span>
                                    </td>
                                    <td>
                                        <RowActionsMenu
                                            ariaLabel={`Actions for purchase ${r.invoice_number || r.id}`}
                                            disabled={saving}
                                            items={[
                                                {
                                                    label: 'View',
                                                    onClick: () => openView(r),
                                                },
                                                {
                                                    label: 'Edit purchase & lines',
                                                    onClick: () => openEdit(r),
                                                    disabled: saving,
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

            <AnimatePresence>
                {viewRow && (
                    <Modal
                        title="Super supplier purchase invoice"
                        width="min(980px, 99vw)"
                        contentClassName="wpi-invoice-preview-modal"
                        onClose={() => {
                            setViewRow(null);
                            setViewDetail(null);
                        }}
                    >
                        {viewLoading ? (
                            <ShimmerTextBlock lines={8} />
                        ) : (
                            <WorkshopPurchaseInvoiceView
                                compact
                                variant="super_supplier"
                                detail={viewDetail}
                                listRow={viewRow}
                            />
                        )}
                    </Modal>
                )}

                {composer && (
                    <Modal
                        title={
                            <div className="pi-modal-title">
                                <span className="pi-breadcrumb">
                                    Super supplier ›{' '}
                                    <span className="pi-b-active">{composer.mode === 'edit' ? 'Edit' : 'New'}</span>
                                </span>
                                <div className="pi-title-main">
                                    <ShoppingCart className="pi-icon-orange" size={22} /> Purchase Invoice
                                </div>
                            </div>
                        }
                        onClose={() => !saving && setComposer(null)}
                        width="1200px"
                        contentClassName="modal-content-purchase"
                        footer={
                            <div className="pi-modal-footer">
                                <button type="button" className="btn-pi-cancel" disabled={saving} onClick={() => setComposer(null)}>
                                    Cancel
                                </button>
                                <button type="button" className="btn-pi-create" disabled={saving} onClick={() => persistComposer()}>
                                    {saving ? 'Saving…' : composer.mode === 'edit' ? 'Save changes' : 'Create invoice'}
                                </button>
                            </div>
                        }
                    >
                        {composerErr ? (
                            <p
                                style={{
                                    margin: '0 0 12px',
                                    padding: 10,
                                    background: '#FEF2F2',
                                    borderRadius: 8,
                                    color: '#B91C1C',
                                    fontSize: '0.8125rem',
                                }}
                            >
                                {composerErr}
                            </p>
                        ) : null}
                        <div className="pi-form-container">
                            <div style={{ marginBottom: 12 }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Quick add line from catalog</label>
                                <select
                                    className=""
                                    disabled={catalogLoading || !catalogOptions.length}
                                    value=""
                                    onChange={(e) => addCatalogLine(e.target.value)}
                                    style={{
                                        width: '100%',
                                        marginTop: 6,
                                        padding: 10,
                                        borderRadius: 8,
                                        border: '1px solid var(--color-border)',
                                    }}
                                >
                                    <option value="">
                                        {catalogLoading ? 'Loading catalog…' : catalogOptions.length ? 'Select product…' : 'No catalog'}
                                    </option>
                                    {catalogOptions.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} — SAR {Number(p.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="pi-header-grid">
                                <div className="pi-field">
                                    <label>Issue date *</label>
                                    <input
                                        type="date"
                                        value={composer.purchaseDate}
                                        onChange={(e) =>
                                            setComposer((c) => (c ? { ...c, purchaseDate: e.target.value } : c))
                                        }
                                    />
                                </div>
                                <div className="pi-field">
                                    <label>Super supplier *</label>
                                    <select
                                        value={composer.superSupplierId}
                                        onChange={(e) =>
                                            setComposer((c) => (c ? { ...c, superSupplierId: e.target.value } : c))
                                        }
                                        style={{
                                            padding: 10,
                                            borderRadius: 8,
                                            border: '1px solid var(--color-border)',
                                            width: '100%',
                                        }}
                                    >
                                        <option value="">Select…</option>
                                        {(superSuppliers || []).filter((s) => s.isActive !== false).map((s) => (
                                            <option key={String(s.id)} value={String(s.id)}>
                                                {s.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="pi-field">
                                    <label>Vendor ref #</label>
                                    <input
                                        type="text"
                                        placeholder="Vendor invoice #"
                                        value={composer.vendorRef}
                                        onChange={(e) =>
                                            setComposer((c) => (c ? { ...c, vendorRef: e.target.value } : c))
                                        }
                                    />
                                </div>
                            </div>
                            <div className="pi-field pi-full-width">
                                <label>Description</label>
                                <input
                                    type="text"
                                    value={composer.description}
                                    onChange={(e) =>
                                        setComposer((c) => (c ? { ...c, description: e.target.value } : c))
                                    }
                                />
                            </div>
                            <div className="pi-field pi-full-width">
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={composer.updatePurchasePriceOnSave !== false}
                                        onChange={(e) =>
                                            setComposer((c) =>
                                                c
                                                    ? { ...c, updatePurchasePriceOnSave: e.target.checked }
                                                    : c,
                                            )
                                        }
                                    />
                                    Update stock inventory purchase price from this purchase
                                </label>
                            </div>
                            <div className="pi-field pi-full-width">
                                <label>Notes</label>
                                <textarea
                                    rows={2}
                                    value={composer.notes}
                                    onChange={(e) =>
                                        setComposer((c) => (c ? { ...c, notes: e.target.value } : c))
                                    }
                                />
                            </div>

                            <div style={{ marginTop: 16 }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ padding: '6px 8px', textAlign: 'left' }}>#</th>
                                            <th style={{ padding: '6px 8px', textAlign: 'left' }}>Product name</th>
                                            <th style={{ padding: '6px 8px', textAlign: 'left' }}>SKU</th>
                                            <th style={{ padding: '6px 8px', textAlign: 'left' }}>Qty</th>
                                            <th style={{ padding: '6px 8px', textAlign: 'left' }}>Unit</th>
                                            <th style={{ padding: '6px 8px', textAlign: 'left' }}>Unit price</th>
                                            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Line total</th>
                                            <th style={{ padding: '6px 8px', width: 48 }} aria-label="Actions" />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {composer.lines.map((ln, idx) => {
                                            const qty = parseNum(ln.qty);
                                            const up = parseNum(ln.unitPrice);
                                            const lt = qty * up;
                                            return (
                                                <tr key={ln.uid}>
                                                    <td style={{ padding: 6 }}>{idx + 1}</td>
                                                    <td style={{ padding: 6 }}>
                                                        <input
                                                            type="text"
                                                            placeholder="Product"
                                                            style={{ width: '100%', minWidth: 160 }}
                                                            value={ln.productName}
                                                            onChange={(e) => {
                                                                const v = e.target.value;
                                                                setComposer((c) =>
                                                                    c
                                                                        ? {
                                                                              ...c,
                                                                              lines: c.lines.map((x) =>
                                                                                  x.uid === ln.uid ? { ...x, productName: v } : x,
                                                                              ),
                                                                          }
                                                                        : c,
                                                                );
                                                            }}
                                                        />
                                                    </td>
                                                    <td style={{ padding: 6 }}>
                                                        <input
                                                            type="text"
                                                            placeholder="SKU"
                                                            style={{ width: 92 }}
                                                            value={ln.sku}
                                                            onChange={(e) => {
                                                                const v = e.target.value;
                                                                setComposer((c) =>
                                                                    c
                                                                        ? {
                                                                              ...c,
                                                                              lines: c.lines.map((x) =>
                                                                                  x.uid === ln.uid ? { ...x, sku: v } : x,
                                                                              ),
                                                                          }
                                                                        : c,
                                                                );
                                                            }}
                                                        />
                                                    </td>
                                                    <td style={{ padding: 6 }}>
                                                        <input
                                                            type="number"
                                                            step="any"
                                                            min="0"
                                                            style={{ width: 76 }}
                                                            value={ln.qty}
                                                            onChange={(e) => {
                                                                const v = e.target.value;
                                                                setComposer((c) =>
                                                                    c
                                                                        ? {
                                                                              ...c,
                                                                              lines: c.lines.map((x) =>
                                                                                  x.uid === ln.uid ? { ...x, qty: v } : x,
                                                                              ),
                                                                          }
                                                                        : c,
                                                                );
                                                            }}
                                                        />
                                                    </td>
                                                    <td style={{ padding: 6 }}>
                                                        <input
                                                            type="text"
                                                            placeholder="pcs"
                                                            style={{ width: 76 }}
                                                            value={ln.unit}
                                                            onChange={(e) => {
                                                                const v = e.target.value;
                                                                setComposer((c) =>
                                                                    c
                                                                        ? {
                                                                              ...c,
                                                                              lines: c.lines.map((x) =>
                                                                                  x.uid === ln.uid ? { ...x, unit: v } : x,
                                                                              ),
                                                                          }
                                                                        : c,
                                                                );
                                                            }}
                                                        />
                                                    </td>
                                                    <td style={{ padding: 6 }}>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            style={{ width: 100 }}
                                                            value={ln.unitPrice}
                                                            onChange={(e) => {
                                                                const v = e.target.value;
                                                                setComposer((c) =>
                                                                    c
                                                                        ? {
                                                                              ...c,
                                                                              lines: c.lines.map((x) =>
                                                                                  x.uid === ln.uid ? { ...x, unitPrice: v } : x,
                                                                              ),
                                                                          }
                                                                        : c,
                                                                );
                                                            }}
                                                        />
                                                    </td>
                                                    <td style={{ padding: 6, textAlign: 'right', fontWeight: 700 }}>
                                                        SAR{' '}
                                                        {lt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </td>
                                                    <td style={{ padding: 6 }}>
                                                        <button
                                                            type="button"
                                                            aria-label="Remove line"
                                                            className="btn-pi-cancel"
                                                            style={{ padding: '4px 8px' }}
                                                            onClick={() =>
                                                                setComposer((c) =>
                                                                    c?.lines?.length <= 1
                                                                        ? c
                                                                        : {
                                                                              ...c,
                                                                              lines: c.lines.filter((x) => x.uid !== ln.uid),
                                                                          },
                                                                )
                                                            }
                                                        >
                                                            ×
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                <button
                                    type="button"
                                    style={{
                                        marginTop: 12,
                                        width: '100%',
                                        padding: 12,
                                        borderRadius: 8,
                                        borderStyle: 'dashed',
                                        borderWidth: 1,
                                        borderColor: 'var(--color-border)',
                                        background: 'rgba(249,250,251,0.95)',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                    }}
                                    onClick={() =>
                                        setComposer((c) => (c ? { ...c, lines: [...c.lines, newLineRow()] } : c))
                                    }
                                >
                                    <Plus size={16} style={{ verticalAlign: 'middle', marginRight: 8 }} /> Add line
                                </button>
                            </div>

                            <div
                                style={{
                                    marginTop: 20,
                                    display: 'flex',
                                    gap: 20,
                                    flexWrap: 'wrap',
                                    justifyContent: 'flex-end',
                                    alignItems: 'flex-end',
                                }}
                            >
                                <div className="pi-field" style={{ minWidth: 140 }}>
                                    <label>VAT (SAR)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={composer.vatAmount}
                                        onChange={(e) =>
                                            setComposer((c) =>
                                                c ? { ...c, vatAmount: e.target.value } : c,
                                            )
                                        }
                                    />
                                </div>
                                <div className="pi-summary-card" style={{ minWidth: 240 }}>
                                    <div className="pi-summary-row">
                                        <span>Subtotal:</span>{' '}
                                        <span>
                                            SAR{' '}
                                            {summary.subtotal.toLocaleString(undefined, {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </span>
                                    </div>
                                    <div className="pi-summary-row">
                                        <span>Total Tax (VAT):</span>{' '}
                                        <span>
                                            SAR{' '}
                                            {summary.vat.toLocaleString(undefined, {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </span>
                                    </div>
                                    <div className="pi-summary-row pi-grand-total">
                                        <span>Grand Total:</span>{' '}
                                        <span>
                                            SAR{' '}
                                            {summary.grand.toLocaleString(undefined, {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </span>
                                    </div>
                                    <div className="pi-ap-alert" style={{ marginTop: 12 }}>
                                        <span>Line totals = Qty × unit price before VAT.</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}
