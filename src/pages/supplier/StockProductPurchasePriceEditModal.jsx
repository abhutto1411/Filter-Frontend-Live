import React, { useEffect, useState } from 'react';
import Modal from '../../components/Modal';
import { getSupplierProduct, updateSupplierProduct } from '../../services/supplierApi';

export default function StockProductPurchasePriceEditModal({
    product,
    onClose,
    onSaved,
}) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [price, setPrice] = useState('');
    const [usesCatalogPrice, setUsesCatalogPrice] = useState(false);
    const [catalogPrice, setCatalogPrice] = useState(null);
    const [warehouseUnit, setWarehouseUnit] = useState('Box');

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
                setWarehouseUnit(
                    String(p?.warehouseUnit || product.warehouseUnit || 'Box').trim() || 'Box',
                );
                setUsesCatalogPrice(Boolean(p?.usesCatalogPrice ?? product.usesCatalogPrice));
                setCatalogPrice(
                    p?.catalogPurchasePrice != null
                        ? Number(p.catalogPurchasePrice)
                        : product.catalogPurchasePrice != null
                            ? Number(product.catalogPurchasePrice)
                            : null,
                );
                const current =
                    product.price != null && Number(product.price) > 0
                        ? Number(product.price)
                        : Number(p?.pricePerWarehouseUnit ?? 0);
                setPrice(Number.isFinite(current) && current > 0 ? String(current) : '');
            } catch (ex) {
                if (!cancelled) {
                    setError(ex?.message || 'Could not load product');
                    setPrice(
                        product.price != null && Number(product.price) > 0
                            ? String(product.price)
                            : '',
                    );
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [product]);

    const handleUseCatalog = async () => {
        setSaving(true);
        setError('');
        try {
            await updateSupplierProduct(product.id, { resetToCatalogPrice: true });
            onSaved?.();
            onClose?.();
        } catch (ex) {
            setError(ex?.message || 'Failed to reset to catalog price');
        } finally {
            setSaving(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const n = Number(price);
        if (!Number.isFinite(n) || n < 0) {
            setError('Enter a valid purchase price (SAR per warehouse unit).');
            return;
        }
        setSaving(true);
        setError('');
        try {
            await updateSupplierProduct(product.id, {
                pricePerWarehouseUnit: n,
            });
            onSaved?.();
            onClose?.();
        } catch (ex) {
            setError(ex?.message || 'Failed to update purchase price');
        } finally {
            setSaving(false);
        }
    };

    if (!product) return null;

    return (
        <Modal
            title="Edit purchase price"
            width="480px"
            onClose={() => !saving && onClose?.()}
            disableClose={saving}
        >
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                    <strong>{product.name}</strong>
                    {product.sku ? ` · ${product.sku}` : ''}
                </p>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                    Price is per <strong>{warehouseUnit}</strong> (warehouse unit).
                    {usesCatalogPrice
                        ? ' Currently following super-admin catalog price.'
                        : ' Custom supplier price.'}
                </p>

                {loading ? (
                    <p style={{ margin: 0 }}>Loading…</p>
                ) : (
                    <>
                        {catalogPrice != null ? (
                            <p
                                style={{
                                    margin: 0,
                                    padding: '8px 10px',
                                    background: '#f8fafc',
                                    borderRadius: 8,
                                    fontSize: '0.8125rem',
                                }}
                            >
                                Master catalog price:{' '}
                                <strong>SAR {Number(catalogPrice).toLocaleString()}</strong> per{' '}
                                {warehouseUnit}
                            </p>
                        ) : null}
                        <div className="pi-field">
                            <label htmlFor="stock-purchase-price">
                                Your purchase price (SAR / {warehouseUnit})
                            </label>
                            <input
                                id="stock-purchase-price"
                                type="number"
                                min="0"
                                step="0.01"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                placeholder={
                                    catalogPrice != null
                                        ? `Leave blank to use catalog (${catalogPrice})`
                                        : 'Enter price'
                                }
                            />
                        </div>
                    </>
                )}

                {error ? (
                    <p style={{ margin: 0, color: '#dc2626', fontSize: '0.8125rem' }}>{error}</p>
                ) : null}

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    {catalogPrice != null ? (
                        <button
                            type="button"
                            className="btn-portal-outline"
                            disabled={saving || loading}
                            onClick={handleUseCatalog}
                        >
                            Use catalog price
                        </button>
                    ) : (
                        <span />
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
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
                </div>
            </form>
        </Modal>
    );
}
