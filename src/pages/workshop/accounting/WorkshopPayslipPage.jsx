import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Printer, RefreshCw } from 'lucide-react';
import { getPayrollSlip } from '../../../services/advancesApi';
import { accT } from '../../../utils/accountingI18n';
import {
  arabicMonthLabel,
  formatSarLatn,
  payslipDeductionRows,
  payslipEarningsRows,
} from '../../../utils/payrollRunDisplay';
import { escapeHtml, printReportHtml } from '../../../utils/accountingReportDisplay';

const panelStyle = {
  background: '#fff',
  border: '1px solid #E2E8F0',
  borderRadius: 10,
  padding: 16,
  flex: '1 1 280px',
  minWidth: 260,
};

export default function WorkshopPayslipPage({
  slipId,
  locale: localeProp,
}) {
  const outletCtx = useOutletContext() || {};
  const locale =
    localeProp ||
    outletCtx.locale ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
    'en';
  const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);
  const isRtl = String(locale).toLowerCase().startsWith('ar');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [slip, setSlip] = useState(null);

  const load = useCallback(async () => {
    if (!slipId) {
      setLoading(false);
      setError(t('pr.err.slip'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await getPayrollSlip(slipId);
      setSlip(res);
    } catch (e) {
      const st = e?.status || e?.response?.status;
      if (st === 404 || st === 403) {
        setError(t('pr.err.apiMissing'));
      } else {
        setError(e?.message || t('pr.err.loadSlip'));
      }
      setSlip(null);
    } finally {
      setLoading(false);
    }
  }, [slipId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const earnings = useMemo(() => payslipEarningsRows(slip), [slip]);
  const deductions = useMemo(() => payslipDeductionRows(slip), [slip]);
  const period = slip?.period || '';
  const ref = slip?.ref || slip?.payslipNo || (slip?.id ? `PS-${slip.id}` : '');
  const after =
    slip?.advanceOutstandingAfter ??
    slip?.outstandingAfterRecovery ??
    null;

  const earnLabel = (key) => {
    const map = {
      basic: t('pr.slip.basic'),
      allowances: t('pr.slip.allowances'),
      bonus: t('pr.slip.bonus'),
      commission: t('pr.slip.commission'),
      gross: t('pr.slip.gross'),
    };
    return map[key] || key;
  };
  const dedLabel = (row) => {
    if (row.label) return row.label;
    const map = {
      recovery: t('pr.slip.recovery'),
      penalties: t('pr.slip.penalties'),
      net: t('pr.slip.net'),
      paid: t('pr.slip.paid'),
      balance: t('pr.slip.balance'),
    };
    return map[row.key] || row.key;
  };

  const buildPrintBody = (lang) => {
    const ar = lang === 'ar';
    const title = ar
      ? `قسيمة راتب — ${escapeHtml(arabicMonthLabel(period))}`
      : escapeHtml(
          t('pr.slip.printTitle', {
            name: slip?.employeeName || '',
            period,
          }),
        );
    const earnRows = earnings
      .map(
        (r) =>
          `<tr><td>${escapeHtml(earnLabel(r.key))}</td><td style="text-align:right">${escapeHtml(formatSarLatn(r.value))}</td></tr>`,
      )
      .join('');
    const dedRows = deductions
      .map(
        (r) =>
          `<tr><td>${escapeHtml(dedLabel(r))}</td><td style="text-align:right">${escapeHtml(formatSarLatn(r.value))}</td></tr>`,
      )
      .join('');
    const afterLine =
      after != null
        ? `<p>${ar ? 'السلفة المتبقية بعد الاسترداد' : escapeHtml(t('pr.slip.after'))}: <strong>${escapeHtml(formatSarLatn(after))}</strong></p>`
        : '';
    const arCard = ar
      ? `<div dir="rtl" style="margin-top:16px;padding:12px;border:1px solid #e5e7eb;border-radius:8px">
          <strong>قسيمة راتب — ${escapeHtml(arabicMonthLabel(period))}</strong>
          <p>الإجمالي ${escapeHtml(formatSarLatn(slip?.gross))} · خصم السلفة ${escapeHtml(formatSarLatn(slip?.advanceRecovery))} · الصافي ${escapeHtml(formatSarLatn(slip?.net))}</p>
        </div>`
      : `<div dir="rtl" style="margin-top:16px;padding:12px;border:1px solid #e5e7eb;border-radius:8px">
          <strong>قسيمة راتب — ${escapeHtml(arabicMonthLabel(period))}</strong>
          <p>الإجمالي ${escapeHtml(formatSarLatn(slip?.gross))} · خصم السلفة ${escapeHtml(formatSarLatn(slip?.advanceRecovery))} · الصافي ${escapeHtml(formatSarLatn(slip?.net))}</p>
        </div>`;
    return `<h1>${title}</h1>
      <p>${escapeHtml(slip?.employeeName || '')} · ${escapeHtml(ref)}</p>
      <h2>${ar ? 'الأرباح' : escapeHtml(t('pr.slip.earnings'))}</h2>
      <table><thead><tr><th>Item</th><th>SAR</th></tr></thead><tbody>${earnRows}</tbody></table>
      <h2>${ar ? 'الخصومات والدفع' : escapeHtml(t('pr.slip.deductions'))}</h2>
      <table><thead><tr><th>Item</th><th>SAR</th></tr></thead><tbody>${dedRows}</tbody></table>
      ${afterLine}
      ${slip?.remarks || slip?.notes ? `<p><strong>${ar ? 'ملاحظات' : escapeHtml(t('pr.slip.remarks'))}:</strong> ${escapeHtml(slip.remarks || slip.notes)}</p>` : ''}
      ${arCard}`;
  };

  const printEn = () => {
    if (!slip) return;
    printReportHtml(
      t('pr.slip.printTitle', { name: slip.employeeName || '', period }),
      buildPrintBody('en'),
    );
  };
  const printAr = () => {
    if (!slip) return;
    printReportHtml(`قسيمة راتب — ${arabicMonthLabel(period)}`, buildPrintBody('ar'));
  };

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'}>
      <div style={{ fontSize: 12, color: '#64748B', marginBottom: 6 }}>
        <Link to="/workshop/accounting/advances?tab=payroll" style={{ color: '#0284C7' }}>
          {t('pr.crumbBase')}
        </Link>
        {' / '}
        {t('pr.slip.crumb', { ref: ref || slipId })}
      </div>
      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 16,
          alignItems: 'center',
        }}
      >
        <h2 style={{ margin: 0, fontSize: 22 }}>
          {t('pr.slip.title', {
            name: slip?.employeeName || t('adv.emdash'),
            period: period || t('adv.emdash'),
          })}
        </h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn-submit btn-dark" disabled={!slip} onClick={printEn}>
            <Printer size={14} style={{ marginInlineEnd: 6 }} />
            {t('pr.slip.printEn')}
          </button>
          <button type="button" className="btn-portal-outline" disabled={!slip} onClick={printAr}>
            <Printer size={14} style={{ marginInlineEnd: 6 }} />
            {t('pr.slip.printAr')}
          </button>
          <button type="button" className="btn-portal-outline" onClick={load} disabled={loading}>
            <RefreshCw size={14} style={{ marginInlineEnd: 6 }} />
            {t('btn.refresh')}
          </button>
        </div>
      </header>

      {error ? (
        <div
          role="alert"
          style={{
            padding: 12,
            marginBottom: 12,
            color: '#B45309',
            background: '#FFFBEB',
            borderRadius: 8,
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <span>{error}</span>
          <button type="button" className="btn-portal-outline" onClick={load}>
            {t('adv.err.retry')}
          </button>
        </div>
      ) : null}

      {loading ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>{t('loading')}</div>
      ) : slip ? (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
            <div style={panelStyle}>
              <h3 style={{ marginTop: 0 }}>{t('pr.slip.earnings')}</h3>
              <table className="ws-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr className="table-header-row">
                    <th className="table-th">{t('pr.slip.item')}</th>
                    <th className="table-th" style={{ textAlign: 'end' }}>
                      {t('pr.slip.sar')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {earnings.map((r) => (
                    <tr key={r.key} className="table-row">
                      <td className="table-cell" style={{ fontWeight: r.bold ? 700 : 400 }}>
                        {earnLabel(r.key)}
                      </td>
                      <td
                        className="table-cell"
                        style={{ textAlign: 'end', fontWeight: r.bold ? 700 : 400 }}
                      >
                        {formatSarLatn(r.value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={panelStyle}>
              <h3 style={{ marginTop: 0 }}>{t('pr.slip.deductions')}</h3>
              <table className="ws-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr className="table-header-row">
                    <th className="table-th">{t('pr.slip.item')}</th>
                    <th className="table-th" style={{ textAlign: 'end' }}>
                      {t('pr.slip.sar')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {deductions.map((r) => (
                    <tr key={r.key + String(r.label || '')} className="table-row">
                      <td className="table-cell" style={{ fontWeight: r.bold ? 700 : 400 }}>
                        {dedLabel(r)}
                      </td>
                      <td
                        className="table-cell"
                        style={{ textAlign: 'end', fontWeight: r.bold ? 700 : 400 }}
                      >
                        {formatSarLatn(r.value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ marginTop: 12, fontSize: 13 }}>
                {t('pr.slip.after')}
                <br />
                <strong>
                  {after != null ? formatSarLatn(after) : t('adv.emdash')}
                </strong>
              </p>
              {slip.remarks || slip.notes ? (
                <p style={{ marginTop: 12, fontSize: 13 }}>
                  {t('pr.slip.remarks')}
                  <br />
                  <strong>{slip.remarks || slip.notes}</strong>
                </p>
              ) : null}
            </div>
          </div>
          <div
            dir="rtl"
            style={{
              ...panelStyle,
              maxWidth: 480,
              background: '#F8FAFC',
            }}
          >
            <strong>
              {t('pr.slip.arTitle', { month: arabicMonthLabel(period) })}
            </strong>
            <p style={{ marginBottom: 0, fontSize: 14 }}>
              {t('pr.slip.arLine', {
                gross: formatSarLatn(slip.gross),
                recovery: formatSarLatn(slip.advanceRecovery),
                net: formatSarLatn(slip.net),
              })}
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
