import React, { useCallback, useEffect, useState } from 'react';
import Modal from '../../components/Modal';
import { getSupplierProduct, updateSupplierProduct } from '../../services/supplierApi';
import { sstockT } from '../../utils/supplierStockI18n';

export default function StockProductCriticalLevelEditModal({
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
    const [criticalLevel, setCriticalLevel] = useState('');
    const [warehouseUnit, setWarehouseUnit] = useState('Box');
    const [workshopUnit, setWorkshopUnit] = useState('pcs');
    const [conversionFactor, setConversionFactor] = useState(1);

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
                setWorkshopUnit(
                    String(p?.workshopUnit || product.unit || 'pcs').trim() || 'pcs',
                );
                setConversionFactor(
                    Number(p?.conversionFactor ?? product.conversionFactor ?? 1) || 1,
                );
                const current =
                    product.criticalLevel != null
                        ? Number(product.criticalLevel)
                        : p?.criticalStockAlert != null
                          ? Number(p.criticalStockAlert)
                          : p?.criticalLevel != null
                            ? Number(p.criticalLevel)
                            : null;
                setCriticalLevel(
                    current != null && Number.isFinite(current) ? String(current) : '',
                );
            } catch (ex) {
                if (!cancelled) {
                    setError(ex?.message || t('cl.errLoad'));
                    setCriticalLevel(
                        product.criticalLevel != null
                            ? String(product.criticalLevel)
                            : product.criticalStockAlert != null
                              ? String(product.criticalStockAlert)
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

    const handleClear = async () => {
        setSaving(true);
        setError('');
        try {
            await updateSupplierProduct(product.id, { criticalStockAlert: null });
            onSaved?.();
            onClose?.();
        } catch (ex) {
            setError(ex?.message || t('cl.errClear'));
        } finally {
            setSaving(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const raw = String(criticalLevel ?? '').trim();
        if (raw === '') {
            setError(t('cl.errEmpty'));
            return;
        }
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 0) {
            setError(t('cl.errValid'));
            return;
        }
        setSaving(true);
        setError('');
        try {
            await updateSupplierProduct(product.id, {
                criticalStockAlert: n,
            });
            onSaved?.();
            onClose?.();
        } catch (ex) {
            setError(ex?.message || t('cl.errUpdate'));
        } finally {
            setSaving(false);
        }
    };

    if (!product) return null;

    const wh = warehouseUnit;
    const ws = workshopUnit;
    const cf = conversionFactor;
    const splitUom =
        wh &&
        ws &&
        wh.toLowerCase() !== ws.toLowerCase() &&
        Number.isFinite(cf) &&
        cf > 1;
    const previewWs =
        criticalLevel !== '' && Number.isFinite(Number(criticalLevel)) && splitUom
            ? Number(criticalLevel) * cf
            : null;

    return (
        <Modal
            title={t("cl.title")}
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
                    {t("cl.hint")}
                </p>

                {loading ? (
                    <p style={{ margin: 0 }}>{t("cl.loading")}</p>
                ) : (
                    <div className="pi-field">
                        <label htmlFor="stock-critical-level">
                            {t("cl.label", { unit: wh })}
                        </label>
                        <input
                            id="stock-critical-level"
                            type="number"
                            min="0"
                            step="any"
                            value={criticalLevel}
                            onChange={(e) => setCriticalLevel(e.target.value)}
                            placeholder={t("cl.ph")}
                        />
                        {previewWs != null ? (
                            <span className="pi-sub-label">
                                {t("cl.preview", { qty: previewWs, unit: ws })}
                            </span>
                        ) : null}
                    </div>
                )}

                {error ? (
                    <p style={{ margin: 0, color: '#dc2626', fontSize: '0.8125rem' }}>{error}</p>
                ) : null}

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        className="btn-portal-outline"
                        disabled={saving || loading}
                        onClick={handleClear}
                    >
                        {t("cl.clear")}
                    </button>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            type="button"
                            className="btn-portal-outline"
                            disabled={saving}
                            onClick={onClose}
                        >
                            {t('btn.cancel')}
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
