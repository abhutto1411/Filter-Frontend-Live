import React from 'react';
import ProofAmount from './ProofAmount';
import { buildProofHref } from './reportProofLinks';
import { incVatDisplayRows } from './profitLossRows';

function cell(value, href, t) {
  if (value == null || value === '') return '';
  return (
    <ProofAmount
      value={value}
      href={href}
      title={t('proof.view')}
      aria-label={t('proof.view')}
    />
  );
}

/**
 * K-2 Inc-VAT reference table. Values come from API `incVatView` + `pl`.
 */
export default function ProfitLossIncVatView({ incVatView, pl, t, filters, backHref }) {
  if (!incVatView || typeof incVatView !== 'object') return null;
  const rows = incVatDisplayRows(incVatView, pl);

  return (
    <section
      className="vb"
      aria-label={t('pl.incVatView.title')}
      style={{
        marginBlockStart: 8,
        background: '#F3F4F6',
        border: '1px dashed #9CA3AF',
        borderRadius: 8,
        padding: 16,
      }}
    >
      <h2 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 800, color: '#334155' }}>
        {t('pl.incVatView.title')}
      </h2>
      <table className="ws-table" style={{ width: '100%', background: 'transparent' }}>
        <thead>
          <tr>
            <th className="table-th">{t('pl.incVatView.col.line')}</th>
            <th className="table-th" style={{ textAlign: 'end' }}>
              {t('pl.incVatView.col.exVat')}
            </th>
            <th className="table-th" style={{ textAlign: 'end' }}>
              {t('pl.incVatView.col.vat')}
            </th>
            <th className="table-th" style={{ textAlign: 'end' }}>
              {t('pl.incVatView.col.incVat')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const keys = row.proofKeys || {};
            const hrefFor = (proofKey) =>
              proofKey
                ? buildProofHref({
                    report: 'pl',
                    key: proofKey,
                    filters,
                    column: 'total',
                    backHref,
                  })
                : '';
            return (
            <tr
              key={row.key}
              style={
                row.tot
                  ? { background: '#F8FAFC', fontWeight: 800 }
                  : undefined
              }
            >
              <td className="table-cell">
                {row.tot ? <b>{t(row.labelKey, { pct: row.pct })}</b> : t(row.labelKey, { pct: row.pct })}
              </td>
              <td className="table-cell" style={{ textAlign: 'end' }}>
                {cell(row.exVat, hrefFor(keys.exVat), t)}
              </td>
              <td className="table-cell" style={{ textAlign: 'end' }}>
                {cell(row.vat, hrefFor(keys.vat), t)}
                {row.vatNote ? (
                  <div style={{ fontSize: 11, fontWeight: 500, color: '#64748B' }}>
                    {t('pl.incVatView.netOutputVatNote')}
                  </div>
                ) : null}
              </td>
              <td className="table-cell" style={{ textAlign: 'end' }}>
                {cell(row.incVat, hrefFor(keys.incVat), t)}
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
      <p
        style={{
          margin: '10px 0 0',
          padding: '8px 12px',
          fontSize: 12,
          color: '#1D4ED8',
          background: '#EFF6FF',
          borderRadius: 8,
        }}
      >
        {t('pl.incVatView.note')}
      </p>
    </section>
  );
}
