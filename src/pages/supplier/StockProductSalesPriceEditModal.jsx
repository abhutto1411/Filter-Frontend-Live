import React, { useEffect, useMemo, useState } from 'react';
import Modal from '../../components/Modal';
import { getSupplierProduct, updateSupplierProduct } from '../../services/supplierApi';
import { roundMoney2 } from './internal/supplierUomLineUtils';

function formatConversionRule(warehouseUnit, workshopUnit, cf) {
    const wu = String(warehouseUnit || '').trim();
    const ws = String(workshopUnit || '').trim();
    const n = Number(cf) || 1;
    if (!wu) return '—';
    if (!ws || wu.toLowerCase() === ws.toLowerCase()) return wu;
    return `1 ${wu} = ${n} ${ws}`;
}

export default function StockProductSalesPriceEditModal({
    product,
    onClose,
    onSaved,
}) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [priceWorkshop, setPriceWorkshop] = useState('');
    const [priceWarehouse, setPriceWarehouse] = useState('');
    const [warehouseUnit, setWarehouseUnit] = useState('Box');
    const [workshopUnit, setWorkshopUnit] = useState('pcs');
    const [conversionFactor, setConversionFactor] = useState(1);

    const cf = Math.max(0.0001, Number(conversionFactor) || 1);
    const splitUom = useMemo(() => {
        const wh = String(warehouseUnit || '').trim();
        const ws = String(workshopUnit || '').trim();
        return (
            !!wh &&
            !!ws &&
            wh.toLowerCase() !== ws.toLowerCase() &&
            Number.isFinite(cf) &&
            cf > 1
        );
    }, [warehouseUnit, workshopUnit, cf]);

    const rulePreview = useMemo(
        () => formatConversionRule(warehouseUnit, workshopUnit, conversionFactor),
        [warehouseUnit, workshopUnit, conversionFactor],
    );

    const syncFromWorkshop = (value) => {
        setPriceWorkshop(value);
        const n = Number(value);
        if (!splitUom) {
            setPriceWarehouse(value);
            return;
        }
        if (value === '' || !Number.isFinite(n)) {
            setPriceWarehouse('');
            return;
        }
        setPriceWarehouse(String(roundMoney2(n * cf)));
    };

    const syncFromWarehouse = (value) => {
        setPriceWarehouse(value);
        const n = Number(value);
        if (!splitUom) {
            setPriceWorkshop(value);
            return;
        }
        if (value === '' || !Number.isFinite(n)) {
            setPriceWorkshop('');
            return;
        }
        setPriceWorkshop(String(roundMoney2(n / cf)));
    };

    useEffect(() => {
        if (!product?.id) return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError('');
            try {
                const res = await getSupplierProduct(product.id);
                const p = res?.product ?? res;
                if (cancelled) return;
                const wh =
                    String(p?.warehouseUnit || product.warehouseUnit || 'Box').trim() || 'Box';
                const ws =
                    String(p?.workshopUnit || product.unit || 'pcs').trim() || 'pcs';
                const factor = Number(p?.conversionFactor ?? product.conversionFactor ?? 1) || 1;
                setWarehouseUnit(wh);
                setWorkshopUnit(ws);
                setConversionFactor(factor);
                const current =
                    product.salePrice != null && Number(product.salePrice) > 0
                        ? Number(product.salePrice)
                        : Number(p?.salePrice ?? 0);
                if (Number.isFinite(current) && current > 0) {
                    const wsPrice = roundMoney2(current);
                    setPriceWorkshop(String(wsPrice));
                    const sameUom = wh.toLowerCase() === ws.toLowerCase() || factor <= 1;
                    setPriceWarehouse(
                        sameUom
                            ? String(wsPrice)
                            : String(roundMoney2(wsPrice * Math.max(0.0001, factor))),
                    );
                } else {
                    setPriceWorkshop('');
                    setPriceWarehouse('');
                }
            } catch (ex) {
                if (!cancelled) {
                    setError(ex?.message || 'Could not load product');
                    const fallback =
                        product.salePrice != null && Number(product.salePrice) > 0
                            ? Number(product.salePrice)
                            : 0;
                    if (fallback > 0) {
                        const factor =
                            Number(product.conversionFactor ?? 1) || 1;
                        setPriceWorkshop(String(roundMoney2(fallback)));
                        setPriceWarehouse(
                            String(roundMoney2(fallback * Math.max(0.0001, factor))),
                        );
                    }
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [product]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const n = Number(priceWorkshop);
        if (!Number.isFinite(n) || n < 0) {
            setError('Enter a valid sales price.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            const saved = roundMoney2(n);
            await updateSupplierProduct(product.id, {
                salePrice: saved,
            });
            onSaved?.({
                salePrice: saved,
                salePriceWarehouse: splitUom ? roundMoney2(saved * cf) : saved,
            });
            onClose?.();
        } catch (ex) {
            setError(ex?.message || 'Failed to update sales price');
        } finally {
            setSaving(false);
        }
    };

    if (!product) return null;

    return (
        <Modal
            title="Edit sales price"
            width="520px"
            onClose={() => !saving && onClose?.()}
            disableClose={saving}
        >
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                    <strong>{product.name}</strong>
                    {product.sku ? ` · ${product.sku}` : ''}
                </p>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                    Enter the sales price per workshop or warehouse unit (includes VAT) — the other
                    field updates automatically. This price appears on sales invoices when
                    &ldquo;Amounts are tax inclusive&rdquo; is checked.
                </p>
                {splitUom ? (
                    <p
                        style={{
                            margin: 0,
                            padding: '8px 10px',
                            background: '#f8fafc',
                            borderRadius: 8,
                            fontSize: '0.8125rem',
                            color: '#475569',
                        }}
                    >
                        Conversion: <strong>{rulePreview}</strong>
                    </p>
                ) : null}

                {loading ? (
                    <p style={{ margin: 0 }}>Loading…</p>
                ) : (
                    <>
                        <div className="pi-field">
                            <label htmlFor="stock-sales-price-workshop">
                                Sales price (SAR / {workshopUnit})
                            </label>
                            <input
                                id="stock-sales-price-workshop"
                                type="number"
                                min="0"
                                step="0.01"
                                value={priceWorkshop}
                                onChange={(e) => syncFromWorkshop(e.target.value)}
                                placeholder="Enter price"
                            />
                        </div>
                        {splitUom ? (
                            <div className="pi-field">
                                <label htmlFor="stock-sales-price-warehouse">
                                    Sales price (SAR / {warehouseUnit})
                                </label>
                                <input
                                    id="stock-sales-price-warehouse"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={priceWarehouse}
                                    onChange={(e) => syncFromWarehouse(e.target.value)}
                                    placeholder="Enter price"
                                />
                            </div>
                        ) : null}
                    </>
                )}

                {error ? (
                    <p style={{ margin: 0, color: '#dc2626', fontSize: '0.8125rem' }}>{error}</p>
                ) : null}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button
                        type="button"
                        className="btn-portal-outline"
                        disabled={saving}
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                    <button type="submit" className="mgr-si-btn-new" disabled={saving || loading}>
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
