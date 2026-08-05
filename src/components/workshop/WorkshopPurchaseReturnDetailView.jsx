import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import './WorkshopPurchaseReturnDetailView.css';

function fmtDate(value) {
    if (!value) return '—';
    try {
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return String(value);
        return d.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
    } catch {
        return '—';
    }
}

function fmtMoney(value, currency = 'SAR') {
    const n = Number(value);
    const safe = Number.isFinite(n) ? n : 0;
    return `${currency} ${safe.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function lineWorkshopConversionNote(item) {
    const wsQty = item?.qtyWorkshop ?? item?.qty_workshop;
    const wsUnit = item?.workshopUnit ?? item?.workshop_unit;
    if (wsQty == null || wsUnit == null || String(wsUnit).trim() === '') return '';
    const n = Number(wsQty);
    if (!Number.isFinite(n) || n <= 0) return '';
    return `= ${n} ${String(wsUnit).trim()} at workshop`;
}

function lineUom(item) {
    const u = item?.uom ?? item?.unit;
    return u != null && String(u).trim() !== '' ? String(u).trim() : '';
}

function lineAmountExVat(item) {
    const total = Number(item?.total ?? 0);
    const tax = Number(item?.taxAmount ?? 0);
    if (total > 0 && tax >= 0) return Math.max(0, total - tax);
    return Number(item?.qty ?? 0) * Number(item?.unitPrice ?? 0);
}

function logoLetter(name) {
    const ch = String(name || '').trim().charAt(0);
    return ch ? ch.toUpperCase() : 'F';
}

function customerLabel(workshopName, branchName) {
    const w = String(workshopName || '').trim();
    const b = String(branchName || '').trim();
    if (w && b && w !== '—' && b !== '—') return `${w} — ${b}`;
    if (w && w !== '—') return w;
    if (b && b !== '—') return b;
    return '—';
}

const VARIANT_COPY = {
    workshop: {
        titleEn: 'Debit Note',
        titleAr: 'إشعار مدين',
        scanCaption: 'Scan to verify purchase return',
        counterpartyEn: 'Supplier',
        counterpartyAr: 'المورّد',
    },
    supplier: {
        titleEn: 'Credit Note',
        titleAr: 'إشعار دائن',
        scanCaption: 'Scan to verify sales return',
        counterpartyEn: 'Customer',
        counterpartyAr: 'العميل',
    },
};

function MetaField({ labelEn, labelAr, value, dir }) {
    return (
        <div className="wpr-view__field">
            <div className="wpr-view__field-label-bi">
                <span className="wpr-view__field-label-bi-en">{labelEn}</span>
                {labelAr ? (
                    <span className="wpr-view__field-label-bi-ar" dir="rtl">
                        {labelAr}
                    </span>
                ) : null}
            </div>
            <div className="wpr-view__field-value" dir={dir || 'auto'}>
                {value ?? '—'}
            </div>
        </div>
    );
}

/**
 * Affiliated return document — Debit Note (workshop) or Credit Note (supplier).
 */
export default function WorkshopPurchaseReturnDetailView({
    detail,
    currency = 'SAR',
    variant = 'workshop',
    compact = true,
}) {
    const d = detail || {};
    const copy = VARIANT_COPY[variant] || VARIANT_COPY.workshop;
    const isSupplier = variant === 'supplier';
    const items = Array.isArray(d.items) ? d.items : [];
    const ccy = d.workshop?.currencyCode || currency || 'SAR';
    const subtotal = Number(d.subtotal ?? items.reduce((sum, item) => sum + lineAmountExVat(item), 0));
    const taxAmount = Number(d.taxAmount ?? items.reduce((sum, item) => sum + Number(item.taxAmount ?? 0), 0));
    const grandTotal = Number(d.grandTotal ?? subtotal + taxAmount);

    const workshopName = d.workshop?.name || '—';
    const branchName = d.branch?.name || '—';
    const supplierName = d.supplier?.name || '—';
    const workshopVat = d.branch?.vatId || d.workshop?.vatId || null;
    const supplierVat = d.supplier?.vatId || null;

    const issuer = isSupplier
        ? {
              name: supplierName,
              tagline: d.supplier?.address || 'Automotive parts & lubricants',
              vat: supplierVat,
              mobile: d.supplier?.mobile,
          }
        : {
              name: workshopName,
              tagline: branchName !== '—' ? branchName : '',
              vat: workshopVat,
              mobile: null,
          };

    const counterparty = isSupplier
        ? {
              name: customerLabel(workshopName, branchName),
              vat: workshopVat,
          }
        : {
              name: supplierName,
              vat: supplierVat,
          };

    const verifyUrl = useMemo(() => {
        const token = String(d.qrToken || '').trim();
        if (!token || typeof window === 'undefined') return '';
        return `${window.location.origin}/verify/apr/${encodeURIComponent(token)}`;
    }, [d.qrToken]);

    const [verifyQrDataUrl, setVerifyQrDataUrl] = useState('');

    useEffect(() => {
        let cancelled = false;
        if (!verifyUrl) {
            setVerifyQrDataUrl('');
            return undefined;
        }
        QRCode.toDataURL(verifyUrl, { width: 132, margin: 1, errorCorrectionLevel: 'M' })
            .then((url) => {
                if (!cancelled) setVerifyQrDataUrl(url);
            })
            .catch(() => {
                if (!cancelled) setVerifyQrDataUrl('');
            });
        return () => {
            cancelled = true;
        };
    }, [verifyUrl]);

    const statusClass = `wpr-view__status-pill wpr-view__status-pill--${String(d.status || 'pending').toLowerCase()}`;

    return (
        <div className={`wpr-view${compact ? ' wpr-view--compact' : ''}`}>
            <div className="wpr-view__sheet">
                <div className="wpr-view__surface">
                    <header
                        className={`wpr-view__corp-header${verifyUrl ? ' wpr-view__corp-header--with-qr' : ''}`}
                    >
                        <div className="wpr-view__corp-left">
                            <h1 className="wpr-view__corp-name">{issuer.name}</h1>
                            {issuer.tagline ? (
                                <p className="wpr-view__corp-tagline">{issuer.tagline}</p>
                            ) : null}
                            <p className="wpr-view__corp-vat">
                                VAT No. {issuer.vat || '—'}
                            </p>
                        </div>

                        <div className="wpr-view__corp-logo">
                            <div className="wpr-view__corp-logo-ring" aria-hidden>
                                <span className="wpr-view__corp-logo-letter">
                                    {logoLetter(issuer.name)}
                                </span>
                            </div>
                        </div>

                        {verifyUrl ? (
                            <div className="wpr-view__header-qr">
                                <div className="wpr-view__qr-block">
                                    {verifyQrDataUrl ? (
                                        <img src={verifyQrDataUrl} alt="Scan to verify return" />
                                    ) : (
                                        <div className="wpr-view__qr-fallback">Generating QR…</div>
                                    )}
                                    <p className="wpr-view__qr-caption">{copy.scanCaption}</p>
                                </div>
                            </div>
                        ) : null}

                        <div className="wpr-view__corp-right">
                            <h2 className="wpr-view__corp-name-ar" dir="rtl">
                                {issuer.name}
                            </h2>
                            {issuer.tagline ? (
                                <p className="wpr-view__corp-tagline-ar" dir="rtl">
                                    {issuer.tagline}
                                </p>
                            ) : null}
                            <p className="wpr-view__corp-vat-ar" dir="rtl">
                                الرقم الضريبي: {issuer.vat || '—'}
                            </p>
                        </div>
                    </header>

                    <div className="wpr-view__title-ribbon">
                        <span className="wpr-view__title-ribbon-ar" dir="rtl">
                            {copy.titleAr}
                        </span>
                        <span className="wpr-view__title-ribbon-en">{copy.titleEn}</span>
                    </div>

                    <div className="wpr-view__meta-split wpr-view__meta-split--dual">
                        <div className="wpr-view__panel">
                            <h3 className="wpr-view__panel-title">
                                {copy.counterpartyEn} · {copy.counterpartyAr}
                            </h3>
                            <div className="wpr-view__details-grid">
                                <MetaField
                                    labelEn={`${copy.counterpartyEn} name`}
                                    labelAr={
                                        isSupplier ? 'اسم العميل' : 'اسم المورّد'
                                    }
                                    value={counterparty.name}
                                    dir="auto"
                                />
                                <MetaField
                                    labelEn={`${copy.counterpartyEn} VAT no.`}
                                    labelAr={
                                        isSupplier
                                            ? 'الرقم الضريبي للعميل'
                                            : 'الرقم الضريبي للمورّد'
                                    }
                                    value={counterparty.vat || '—'}
                                />
                                {isSupplier && branchName !== '—' ? (
                                    <MetaField
                                        labelEn="Branch"
                                        labelAr="الفرع"
                                        value={branchName}
                                        dir="auto"
                                    />
                                ) : null}
                            </div>
                        </div>

                        <div className="wpr-view__panel">
                            <h3 className="wpr-view__panel-title">
                                Document · تفاصيل المستند
                            </h3>
                            <div className="wpr-view__details-grid">
                                <MetaField
                                    labelEn="Issue date"
                                    labelAr="تاريخ الإصدار"
                                    value={fmtDate(d.issueDate)}
                                />
                                <MetaField
                                    labelEn="Return no."
                                    labelAr="رقم الإشعار"
                                    value={d.returnNumber || '—'}
                                />
                                <MetaField
                                    labelEn="Source invoice"
                                    labelAr="فاتورة المصدر"
                                    value={d.sourcePurchaseInvoiceNumber || d.reference || '—'}
                                />
                                <MetaField
                                    labelEn={
                                        isSupplier
                                            ? 'Workshop purchase return'
                                            : 'Supplier sales return'
                                    }
                                    labelAr={
                                        isSupplier
                                            ? 'مرتجع مشتريات الورشة'
                                            : 'مرتجع مبيعات المورد'
                                    }
                                    value={
                                        isSupplier
                                            ? d.linkedPurchaseReturnNo || '—'
                                            : d.supplierSalesReturnNo || '—'
                                    }
                                />
                                <MetaField
                                    labelEn="Status"
                                    labelAr="الحالة"
                                    value={
                                        <span className={statusClass}>
                                            {d.status || 'pending'}
                                        </span>
                                    }
                                />
                            </div>
                        </div>
                    </div>

                    {d.description ? (
                        <p className="wpr-view__description">
                            <strong>Notes:</strong> {d.description}
                        </p>
                    ) : null}

                    <div className="wpr-view__table-wrap">
                        <table className="wpr-view__table">
                            <thead>
                                <tr>
                                    <th style={{ width: 40, textAlign: 'center' }}>#</th>
                                    <th>Description · البيان</th>
                                    <th className="wpr-view__th-num">Qty</th>
                                    <th className="wpr-view__th-num">Unit price</th>
                                    <th className="wpr-view__th-num">Amount</th>
                                    <th className="wpr-view__th-num">Tax</th>
                                    <th className="wpr-view__th-num">Tax amt</th>
                                    <th className="wpr-view__th-num">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="wpr-view__table-empty">
                                            No return line items.
                                        </td>
                                    </tr>
                                ) : (
                                    items.map((item, index) => {
                                        const amount = lineAmountExVat(item);
                                        return (
                                            <tr key={item.id || `${item.itemName}-${index}`}>
                                                <td style={{ textAlign: 'center' }}>{index + 1}</td>
                                                <td>
                                                    <div className="wpr-view__item-name">
                                                        {item.itemName || '—'}
                                                    </div>
                                                    {item.reason ? (
                                                        <div className="wpr-view__item-sub">
                                                            Reason: {item.reason}
                                                        </div>
                                                    ) : null}
                                                </td>
                                                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                    {Number(item.qty ?? 0).toLocaleString()}
                                                    {lineUom(item) ? ` ${lineUom(item)}` : ''}
                                                    {lineWorkshopConversionNote(item) ? (
                                                        <div
                                                            className="wpr-view__item-sub"
                                                            style={{ marginTop: 2 }}
                                                        >
                                                            {lineWorkshopConversionNote(item)}
                                                        </div>
                                                    ) : null}
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    {fmtMoney(item.unitPrice, ccy)}
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    {fmtMoney(amount, ccy)}
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    {item.taxCode || 'VAT 15%'}
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    {fmtMoney(item.taxAmount, ccy)}
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                                    {fmtMoney(item.total, ccy)}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="wpr-view__totals">
                        <div className="wpr-view__totals-box">
                            <div className="wpr-view__sum-row">
                                <span>Sub-total</span>
                                <strong>{fmtMoney(subtotal, ccy)}</strong>
                            </div>
                            <div className="wpr-view__sum-row">
                                <span>VAT (15%)</span>
                                <strong>{fmtMoney(taxAmount, ccy)}</strong>
                            </div>
                            <div className="wpr-view__sum-row wpr-view__sum-row--total">
                                <span>Total credit</span>
                                <strong>{fmtMoney(grandTotal, ccy)}</strong>
                            </div>
                        </div>
                    </div>

                    {(d.approvedAt || d.qrConfirmedAt || d.finalizedAt) && (
                        <div className="wpr-view__status-bar">
                            {d.approvedAt ? (
                                <span>Approved: {fmtDate(d.approvedAt)}</span>
                            ) : null}
                            {d.qrConfirmedAt ? (
                                <span>QR confirmed: {fmtDate(d.qrConfirmedAt)}</span>
                            ) : null}
                            {d.finalizedAt ? (
                                <span>Finalized: {fmtDate(d.finalizedAt)}</span>
                            ) : null}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
