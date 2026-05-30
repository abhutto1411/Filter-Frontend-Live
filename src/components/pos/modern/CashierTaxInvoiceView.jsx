import { useEffect, useMemo, useState } from 'react';
import { User, MapPin } from 'lucide-react';
import QRCode from 'qrcode';
import filterBrandIcon from '../../../assets/images/filter-brand-icon.png';
import { formatPlateLettersFirst } from '../../../utils/formatPlate';
import {
  CHECKLIST_ROWS,
  GOODS_HEADERS,
  branchRibbonSegments,
  computeThermalInvoiceLineRows,
  computeThermalInvoiceTotals,
  formatInvoiceIssuedTime,
  formatInvoiceLegalDate,
  normalizeCashierInvoice,
  sar,
  sellerVatRegistration,
  thermalInvoiceQrPayload,
  thermalR2,
} from '../../../utils/thermalInvoiceTotals';
import './CashierTaxInvoiceView.css';

function dash(s) {
  const v = String(s ?? '').trim();
  return v || '—';
}

function MetaLabel({ en, ar, twoLine = false }) {
  if (twoLine) {
    return (
      <div className="cti-meta-label">
        <span className="ar" style={{ display: 'block', lineHeight: 1.15 }}>{ar}</span>
        <span style={{ display: 'block', lineHeight: 1.15 }}>{en}</span>
      </div>
    );
  }
  return (
    <div className="cti-meta-label">
      <span className="ar">{ar}</span>
      {' - '}
      <span>{en}</span>
    </div>
  );
}

function TotalsRow({ en, ar, amount, emphasis = false }) {
  return (
    <tr className={emphasis ? 'emphasis' : undefined}>
      <td className="label-en">{en}:</td>
      <td className="label-ar">{ar}</td>
      <td className="amount">{amount}</td>
    </tr>
  );
}

export default function CashierTaxInvoiceView({ invoice: rawInvoice }) {
  const invoice = useMemo(() => normalizeCashierInvoice(rawInvoice), [rawInvoice]);
  const totals = useMemo(() => computeThermalInvoiceTotals(invoice), [invoice]);
  const lineRows = useMemo(() => computeThermalInvoiceLineRows(invoice), [invoice]);
  const ribbon = useMemo(() => branchRibbonSegments(invoice), [invoice]);
  const [qrDataUrl, setQrDataUrl] = useState('');

  const checks = Array.isArray(invoice?.maintenanceChecklist?.checks)
    ? invoice.maintenanceChecklist.checks
    : [];

  useEffect(() => {
    let cancelled = false;
    const payload = thermalInvoiceQrPayload(invoice, totals.totalInvoiceAmount);
    QRCode.toDataURL(payload, { width: 112, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [invoice, totals.totalInvoiceAmount]);

  if (!invoice) return null;

  const invoiceNo = dash(invoice.invoiceNo);
  const vatReg = dash(sellerVatRegistration(invoice));
  const dateStr = formatInvoiceLegalDate(invoice.invoiceDate || invoice.issuedAt);
  const timeStr = formatInvoiceIssuedTime(invoice.issuedAt);
  const plate = formatPlateLettersFirst(invoice.plateNo) || '—';
  const mileage =
    invoice.odometerReading != null && Number(invoice.odometerReading) > 0
      ? String(invoice.odometerReading)
      : '—';
  const nextKm =
    invoice.nextOilChangeKm != null && Number(invoice.nextOilChangeKm) > 0
      ? String(invoice.nextOilChangeKm)
      : '—';

  const fmtQty = (q) => (q % 1 === 0 ? String(q) : q.toFixed(2));

  return (
    <div className="cti-root">
      <div className="cti-header">
        <div className="cti-header-main">
          <div className="cti-header-brand-row">
            <div>
              <img src={filterBrandIcon} alt="FILTER" className="cti-logo" />
              <div className="cti-brand-ar">فلتر</div>
              <div className="cti-car-services">Car Services</div>
            </div>
            <div className="cti-header-right">
              <div className="cti-doc-title">Simplified Tax Invoice</div>
              <div className="cti-doc-title-ar">فاتورة ضريبية مبسطة</div>
              <div className="cti-header-meta-ar">رقم الفاتورة : {invoiceNo}</div>
              <div className="cti-header-meta-ar">
                رقم تسجيل ضريبة القيمة المضافة : {vatReg}
              </div>
            </div>
          </div>
        </div>
        <div className="cti-qr-wrap">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="Invoice QR" />
          ) : (
            <div style={{ width: 112, height: 112, background: '#f1f5f9' }} />
          )}
        </div>
      </div>

      <div className="cti-ribbon">
        <div>
          {ribbon.length === 0 ? (
            <span>—</span>
          ) : (
            ribbon.map((seg, i) => (
              <div key={seg} className="cti-ribbon-seg" style={{ marginTop: i ? 9 : 0 }}>
                {i === 0 ? <User size={18} /> : <MapPin size={18} />}
                <span>{seg}</span>
              </div>
            ))
          )}
        </div>
        <div className="cti-ribbon-date">Date: {dateStr}</div>
      </div>

      <table className="cti-meta-table">
        <tbody>
          <tr>
            <td><MetaLabel en="Name" ar="الاسم" /></td>
            <td className="cti-meta-value">{dash(invoice.customerName)}</td>
            <td><MetaLabel en="Phone" ar="الهاتف" /></td>
            <td className="cti-meta-value">{dash(invoice.customerMobile)}</td>
            <td><MetaLabel en="Time" ar="الوقت" /></td>
            <td className="cti-meta-value">{timeStr}</td>
          </tr>
          <tr>
            <td><MetaLabel en="Model" ar="الموديل" /></td>
            <td className="cti-meta-value">{dash(invoice.vehicleModel)}</td>
            <td><MetaLabel en="Mileage" ar="عداد الكيلومترات" /></td>
            <td className="cti-meta-value">{mileage}</td>
            <td><MetaLabel en="Make" ar="الطراز" /></td>
            <td className="cti-meta-value">{dash(invoice.vehicleMake)}</td>
          </tr>
          <tr>
            <td><MetaLabel en="Plate" ar="رقم اللوحة" /></td>
            <td className="cti-meta-value">{plate}</td>
            <td><MetaLabel en="VIN" ar="رقم الهيكل" /></td>
            <td className="cti-meta-value">{dash(invoice.vehicleVin)}</td>
            <td><MetaLabel en="Next Change" ar="غيار الزيت القادم" twoLine /></td>
            <td className="cti-meta-value">{nextKm}</td>
          </tr>
          <tr>
            <td><MetaLabel en="Year" ar="سنة الصنع" /></td>
            <td className="cti-meta-value">{dash(invoice.vehicleYear)}</td>
            <td><MetaLabel en="Customer Type" ar="نوع العميل" twoLine /></td>
            <td className="cti-meta-value">{dash(invoice.customerType)}</td>
            <td><MetaLabel en="Customer Tax ID" ar="الرقم الضريبي للعميل" twoLine /></td>
            <td className="cti-meta-value">{dash(invoice.customerTaxId)}</td>
          </tr>
        </tbody>
      </table>

      <div className="cti-goods-wrap">
        {lineRows.length === 0 ? (
          <div className="cti-empty-goods">No line items on this invoice.</div>
        ) : (
          <table className="cti-goods-table">
            <thead>
              <tr>
                {GOODS_HEADERS.map(([en, ar]) => (
                  <th key={en}>
                    <span>{en}</span>
                    <span className="ar">{ar}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lineRows.map((row, i) => (
                <tr key={`${row.productName}-${i}`}>
                  <td className="cti-goods-name">
                    <span>{row.productName}</span>
                    {row.productNameArabic ? (
                      <span className="ar">{row.productNameArabic}</span>
                    ) : null}
                  </td>
                  <td>{sar(row.unitPriceExclVat)}</td>
                  <td>{fmtQty(row.qty)}</td>
                  <td>{sar(row.grossBeforeVat)}</td>
                  <td>{sar(row.discount)}</td>
                  <td>{sar(row.totalBeforeVat)}</td>
                  <td>{sar(row.lineVat)}</td>
                  <td>{sar(row.totalWithVat)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="cti-totals-banner">
        <span>Total Amount</span>
        <span>إجمالي المبالغ</span>
      </div>
      <table className="cti-totals-table">
        <tbody>
          <TotalsRow
            en="Total (Excluding VAT)"
            ar="الإجمالي (غير شاملة ضريبة القيمة المضافة)"
            amount={sar(totals.grossAmountExclVat)}
          />
          {thermalR2(totals.itemDiscountsTotal) > 0.001 ? (
            <TotalsRow
              en="Item Discount"
              ar="خصم الأصناف"
              amount={sar(totals.itemDiscountsTotal)}
            />
          ) : null}
          {thermalR2(totals.invoiceDiscount) > 0.001 ? (
            <TotalsRow
              en="Invoice Discount"
              ar="خصم الفاتورة"
              amount={sar(totals.invoiceDiscount)}
            />
          ) : null}
          {thermalR2(totals.promoDiscount) > 0.001 ? (
            <TotalsRow
              en="Promo Code Discount"
              ar="خصم الرمز الترويجي"
              amount={sar(totals.promoDiscount)}
            />
          ) : null}
          <TotalsRow
            en="Total Taxable Amount (Excluding VAT)"
            ar="إجمالي المبلغ الخاضع للضريبة"
            amount={sar(totals.totalTaxableAmount)}
          />
          <TotalsRow en="Total VAT" ar="مجموع ضريبة القيمة المضافة" amount={sar(totals.vatAmount)} />
          <TotalsRow
            en="Total Amount Due"
            ar="إجمالي المبلغ المستحق"
            amount={sar(totals.totalInvoiceAmount)}
            emphasis
          />
        </tbody>
      </table>

      <div className="cti-checklist-banner">
        <span>Check list</span>
        <span>قائمة الفحص</span>
      </div>
      <table className="cti-checklist-grid">
        <tbody>
          {[0, 1, 2].map((r) => (
            <tr key={r}>
              {[0, 1].map((col) => {
                const idx = r + col * 3;
                const [en, ar] = CHECKLIST_ROWS[idx] || ['', ''];
                const checked = !!checks[idx];
                return (
                  <td key={col}>
                    <div className="cti-check-item">
                      <div className="labels">
                        <span>{en}</span>
                        <span className="ar">{ar}</span>
                      </div>
                      <span className="cti-check-box">{checked ? '☑' : '☐'}</span>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="cti-thanks">Thank you.</div>
    </div>
  );
}
