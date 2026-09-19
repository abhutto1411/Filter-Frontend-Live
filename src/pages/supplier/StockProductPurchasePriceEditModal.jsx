import React, { useCallback, useEffect, useState } from 'react';
import Modal from '../../components/Modal';
import { getSupplierProduct, updateSupplierProduct } from '../../services/supplierApi';
import { sstockT } from '../../utils/supplierStockI18n';

export default function StockProductPurchasePriceEditModal({
    product,
    onClose,
    onSaved,
    locale: localeProp,
}) {
    const locale =
        localeProp ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => sstockT(locale, key, vars), [locale]);
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
                    setError(ex?.message || t('pp.errLoad'));
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
            setError(ex?.message || t('pp.errReset'));
        } finally {
            setSaving(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const n = Number(price);
        if (!Number.isFinite(n) || n < 0) {
            setError(t('pp.errValid'));
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
            setError(ex?.message || t('pp.errUpdate'));
        } finally {
            setSaving(false);
        }
    };

    if (!product) return null;

    return (
        <Modal
            title={t("pp.title")}
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
                    {t('pp.hintWh', { unit: warehouseUnit })}
                    {usesCatalogPrice ? t('pp.hintCatalog') : t('pp.hintCustom')}
                </p>

                {loading ? (
                    <p style={{ margin: 0 }}>{t("pp.loading")}</p>
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
                                {t('pp.catalogPrice')}{' '}
                                <strong>
                                    {t('pp.catalogPriceVal', {
                                        price: t('money.sar', {
                                            amount: Number(catalogPrice).toLocaleString(),
                                        }),
                                        unit: warehouseUnit,
                                    })}
                                </strong>
                            </p>
                        ) : null}
                        <div className="pi-field">
                            <label htmlFor="stock-purchase-price">
                                {t("pp.label", { unit: warehouseUnit })}
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
                                        ? t('pp.phCatalog', { price: catalogPrice })
                                        : t('pp.phEnter')
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
                            {t("pp.useCatalog")}
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
                            {t("btn.cancel")}
                        </button>
                        <button type="submit" className="mgr-si-btn-new" disabled={saving || loading}>
                            {saving ? t('btn.saving') : t('btn.save')}
                        </button>
                    </div>
                </div>
            </form>
        </Modal>
    );
}
