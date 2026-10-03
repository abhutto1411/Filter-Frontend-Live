import React, { useCallback, useMemo } from 'react';
import { FileSpreadsheet, FileText } from 'lucide-react';
import WorkshopSubScreen from '../../components/workshop/WorkshopSubScreen';
import {
    formatDualUomQty,
    formatSupplierTimelineSourceRef,
} from './supplierInventoryTimelineUtils';
import { exportTimelineExcel, exportTimelinePdf } from './supplierInventoryExport';
import { sstockT } from '../../utils/supplierStockI18n';

const exportToolbarBtnStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    borderRadius: 8,
    border: '1px solid var(--color-border)',
    background: '#fff',
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: 'pointer',
    color: 'var(--color-text-dark)',
};

function fmtQty(n) {
    if (n == null || !Number.isFinite(Number(n))) return '—';
    const x = Number(n);
    if (Math.abs(x - Math.round(x)) < 1e-9) return String(Math.round(x));
    return x.toFixed(3).replace(/\.?0+$/, '');
}

function fmtDelta(d) {
    if (d == null || !Number.isFinite(Number(d))) return '—';
    const n = Number(d);
    if (n > 0) return `+${fmtQty(n)}`;
    return fmtQty(n);
}

const thStyle = {
    textAlign: 'left',
    padding: '12px 14px',
    fontWeight: 800,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    fontSize: '0.7rem',
};

const thRight = { ...thStyle, textAlign: 'right' };

export default function SupplierStockProductTimelineScreen({
    product,
    stockRow,
    entries = [],
    loading = false,
    error = '',
    locationSummary = () => '—',
    onBack,
    locale: localeProp,
}) {
    const locale =
        localeProp ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => sstockT(locale, key, vars), [locale]);
    const showRefCol = useMemo(
        () => entries.some((e) => e.source !== 'manual' || e.reference?.id || e.invoiceNo),
        [entries],
    );
    const showByCol = useMemo(
        () => entries.some((e) => e.adjustedBy?.name || e.adjustedBy?.id),
        [entries],
    );

    const exportDisabled = loading || !!error || !entries.length;
    const exportFilename = `timeline-${String(product?.name || 'product').replace(/\s+/g, '-')}`;

    const currentStockDisplay = formatDualUomQty(
        stockRow?.warehouseQty ?? product?.warehouseQty ?? 0,
        product?.warehouseUnit || 'Box',
        stockRow?.qty ?? product?.qty ?? 0,
        product?.unit || 'Liter',
    );

    return (
        <WorkshopSubScreen
            title={t("timeline.title")}
            subtitle={product?.name || t('fallback.product')}
            backLabel={t("timeline.back")}
            onBack={onBack}
            size="xl"
        >
            <div className="ws-section" style={{ padding: 20 }}>
                <div
                    style={{
                        marginBottom: 20,
                        padding: '14px 16px',
                        background: '#F9FAFB',
                        borderRadius: 12,
                        border: '1px solid var(--color-border-light)',
                    }}
                >
                    <p
                        style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            color: 'var(--color-text-muted)',
                            textTransform: 'uppercase',
                            margin: '0 0 6px',
                        }}
                    >
                        {t("timeline.product")}
                    </p>
                    <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                        {product?.name || '—'}
                    </h4>
                    <p style={{ margin: '6px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                        {t('timeline.meta', {
                            sku: product?.sku || t('emdash'),
                            opening: fmtQty(product?.openingAdoption),
                            stock: currentStockDisplay,
                        })}
                    </p>
                    <p style={{ margin: '6px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                        {locationSummary(stockRow || product)}
                    </p>
                    <div
                        style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 8,
                            marginTop: 12,
                        }}
                    >
                        <button
                            type="button"
                            disabled={exportDisabled}
                            title={
                                loading
                                    ? t('timeline.loading')
                                    : error
                                      ? t('timeline.errExport')
                                      : !entries.length
                                        ? t('timeline.noRows')
                                        : t('export.xlsx')
                            }
                            onClick={() => exportTimelineExcel(product, entries, exportFilename)}
                            style={{
                                ...exportToolbarBtnStyle,
                                opacity: exportDisabled ? 0.5 : 1,
                                cursor: exportDisabled ? 'not-allowed' : 'pointer',
                            }}
                        >
                            <FileSpreadsheet size={14} aria-hidden /> {t("btn.excel")}
                        </button>
                        <button
                            type="button"
                            disabled={exportDisabled}
                            title={
                                loading
                                    ? t('timeline.loading')
                                    : error
                                      ? t('timeline.errExport')
                                      : !entries.length
                                        ? t('timeline.noRows')
                                        : t('export.pdf')
                            }
                            onClick={() => exportTimelinePdf(product, entries, exportFilename)}
                            style={{
                                ...exportToolbarBtnStyle,
                                opacity: exportDisabled ? 0.5 : 1,
                                cursor: exportDisabled ? 'not-allowed' : 'pointer',
                            }}
                        >
                            <FileText size={14} aria-hidden /> {t("btn.pdf")}
                        </button>
                    </div>
                </div>

                {error ? (
                    <p
                        style={{
                            margin: '0 0 12px',
                            padding: '10px 12px',
                            background: '#FEF3C7',
                            borderRadius: 8,
                            color: '#92400E',
                            fontSize: '0.8125rem',
                        }}
                    >
                        {error}
                    </p>
                ) : null}

                {loading ? (
                    <p
                        style={{
                            margin: 0,
                            padding: '40px 0',
                            textAlign: 'center',
                            color: 'var(--color-text-muted)',
                            fontSize: '0.875rem',
                        }}
                    >
                        {t("timeline.loadingHistory")}
                    </p>
                ) : !entries.length ? (
                    <p
                        style={{
                            margin: 0,
                            padding: '24px 0',
                            textAlign: 'center',
                            color: 'var(--color-text-muted)',
                            fontSize: '0.875rem',
                        }}
                    >
                        {t("timeline.empty")}
                    </p>
                ) : (
                    <div
                        style={{
                            overflowX: 'auto',
                            border: '1px solid var(--color-border-light)',
                            borderRadius: 12,
                        }}
                    >
                        <table
                            style={{
                                width: '100%',
                                borderCollapse: 'collapse',
                                fontSize: '0.8125rem',
                            }}
                        >
                            <thead>
                                <tr style={{ background: '#F9FAFB' }}>
                                    <th style={thStyle}>{t("th.when")}</th>
                                    <th style={thRight}>{t("th.fromWh")}</th>
                                    <th style={thRight}>{t("th.toWh")}</th>
                                    <th style={thRight}>{t("th.deltaWh")}</th>
                                    <th style={thRight}>{t("th.wsEquiv")}</th>
                                    <th style={thStyle}>{t("th.reason")}</th>
                                    {showRefCol ? <th style={thStyle}>{t("th.sourceRef")}</th> : null}
                                    {showByCol ? <th style={thStyle}>{t("th.by")}</th> : null}
                                </tr>
                            </thead>
                            <tbody>
                                {entries.map((e) => (
                                    <tr
                                        key={e.id}
                                        style={{ borderBottom: '1px solid var(--color-border-light)' }}
                                    >
                                        <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                                            {new Date(e.at).toLocaleString()}
                                        </td>
                                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700 }}>
                                            {formatDualUomQty(
                                                e.previousQty,
                                                e.warehouseUnit,
                                                e.previousQtyWorkshop,
                                                e.workshopUnit,
                                            )}
                                        </td>
                                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700 }}>
                                            {formatDualUomQty(
                                                e.newQty,
                                                e.warehouseUnit,
                                                e.newQtyWorkshop,
                                                e.workshopUnit,
                                            )}
                                        </td>
                                        <td
                                            style={{
                                                padding: '12px 14px',
                                                textAlign: 'right',
                                                fontWeight: 700,
                                                color:
                                                    e.delta == null ||
                                                    !Number.isFinite(Number(e.delta))
                                                        ? 'var(--color-text-muted)'
                                                        : Number(e.delta) >= 0
                                                          ? '#047857'
                                                          : '#B91C1C',
                                            }}
                                        >
                                            {fmtDelta(e.delta)} {e.warehouseUnit || 'Box'}
                                        </td>
                                        <td
                                            style={{
                                                padding: '12px 14px',
                                                textAlign: 'right',
                                                color: 'var(--color-text-muted)',
                                            }}
                                        >
                                            {e.deltaWorkshop != null
                                                ? `${fmtDelta(e.deltaWorkshop)} ${e.workshopUnit || 'Liter'}`
                                                : '—'}
                                        </td>
                                        <td style={{ padding: '12px 14px' }}>{e.reason}</td>
                                        {showRefCol ? (
                                            <td
                                                style={{
                                                    padding: '12px 14px',
                                                    color: 'var(--color-text-muted)',
                                                    maxWidth: 320,
                                                }}
                                            >
                                                {formatSupplierTimelineSourceRef(e)}
                                            </td>
                                        ) : null}
                                        {showByCol ? (
                                            <td
                                                style={{
                                                    padding: '12px 14px',
                                                    color: 'var(--color-text-muted)',
                                                }}
                                            >
                                                {e.adjustedBy?.name || '—'}
                                            </td>
                                        ) : null}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </WorkshopSubScreen>
    );
}
