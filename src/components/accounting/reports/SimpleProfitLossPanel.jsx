import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import RiyalIcon from '../../RiyalIcon';
import { splitBilingualName } from '../../../utils/bilingualName';
import { buildProofHref, proofColumnParam } from './reportProofLinks';
import { simplePlDeptAdjustment, simplePlStepsNet } from './profitLossRows';
import './ProfitLossSimple.css';

const MINUS = '\u2212';

function round2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Number((Math.round((x + Number.EPSILON) * 100) / 100).toFixed(2));
}

function fmt2(n) {
  return round2(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function Money({ value, color, signed = false, className = '' }) {
  const n = round2(value);
  const sign = n < 0 ? MINUS : signed && n > 0 ? '+' : '';
  return (
    <bdi dir="ltr">
      <span className={`pl-simple-money ${className}`} style={{ color, textAlign: 'end' }}>
        {sign}
        <RiyalIcon size={14} />
        {fmt2(Math.abs(n))}
      </span>
    </bdi>
  );
}

function OpenLink({ href, t }) {
  if (!href) return null;
  return (
    <Link className="pl-simple-open" to={href}>
      {t('report.pl.simple.open')}
    </Link>
  );
}

function groupOpex(lines) {
  const groups = {
    commissions: [],
    petty: [],
    salary: [],
    rent: [],
    other: [],
  };
  for (const line of lines || []) {
    const name = String(line.name || '');
    const code = String(line.code || '');
    if (/commission/i.test(name) || /^63/.test(code)) groups.commissions.push(line);
    else if (/petty/i.test(name)) groups.petty.push(line);
    else if ((/salary|wage|payroll/i.test(name) && !/advance/i.test(name)) || code === '6100') {
      groups.salary.push(line);
    } else if (/rent|utilit|electric|water|internet/i.test(name)) groups.rent.push(line);
    else groups.other.push(line);
  }
  return groups;
}

function unallocatedAllZero(u) {
  if (!u || typeof u !== 'object') return true;
  const keys = [
    'revenue',
    'costOfGoodsSold',
    'operatingExpenses',
    'otherIncome',
    'otherExpenses',
    'netIncome',
    'cashOverShortNet',
  ];
  return keys.every((k) => Math.abs(Number(u[k]) || 0) < 0.005);
}

export default function SimpleProfitLossPanel({
  pl,
  t,
  locale,
  proofFilters,
  backHref,
  appliedBranch,
  amountHref,
  onOpenMissingJournals,
}) {
  const ar = locale === 'ar';
  const profit = round2(pl?.netIncome);
  const isProfit = profit >= 0;
  const netSales = round2(pl?.netRevenue);
  const kept = netSales === 0 ? 0 : round2((profit / netSales) * 100);
  const stepsNet = simplePlStepsNet(pl);
  const stepsMismatch = Math.abs(Number(stepsNet ?? 0) - profit) >= 0.005;
  const depts = Array.isArray(pl?.revenueByDepartment) ? pl.revenueByDepartment : [];
  const returns = round2(pl?.salesReturns?.amount);
  const discounts = round2(pl?.discounts?.amount);
  const cogs = round2(pl?.totalCOGS);
  const gross = round2(pl?.grossProfit);
  const margin = netSales === 0 ? 0 : round2((gross / netSales) * 100);
  const opex = Array.isArray(pl?.operatingExpenses) ? pl.operatingExpenses : [];
  const groups = useMemo(() => groupOpex(opex), [opex]);
  const cash = pl?.cashOverShort && typeof pl.cashOverShort === 'object' ? pl.cashOverShort : null;
  const cashNet = round2(cash?.net);
  const cashDir =
    cash?.direction ||
    (Math.abs(cashNet) < 0.005 ? 'balanced' : cashNet > 0 ? 'over' : 'short');
  const cashAccts = Array.isArray(cash?.accounts) ? cash.accounts : [];
  const hideHq = unallocatedAllZero(pl?.unallocated);
  const [openCash, setOpenCash] = useState(false);
  const incVat = pl?.incVatView && typeof pl.incVatView === 'object' ? pl.incVatView : null;
  const salesIncl = round2(incVat?.netRevenueIncVat ?? incVat?.grossSalesIncVat);
  const vatCollected = round2(incVat?.netOutputVat ?? incVat?.outputVatOnSales);
  const accountantItems = Array.isArray(pl?.accountantItems) ? pl.accountantItems : [];
  const bridge = pl?.departmentBridge;
  const deptAdj = simplePlDeptAdjustment(pl);

  const col = appliedBranch ? 'branch' : 'total';

  function href(key) {
    if (typeof amountHref === 'function') return amountHref(key, col);
    return buildProofHref({
      report: 'pl',
      key,
      filters: proofFilters,
      column: proofColumnParam(col, { branchId: appliedBranch }),
      backHref,
    });
  }

  const groupedRows = [
    ['commissions', groups.commissions],
    ['petty', groups.petty],
    ['salary', groups.salary],
    ['rent', groups.rent],
    ['other', groups.other],
  ].filter(([, lines]) => lines.some((l) => Math.abs(Number(l.amount) || 0) >= 0.005));

  return (
    <div className={`pl-simple ${ar ? 'pl-simple--ar' : 'pl-simple--en'}`}>
      <div className="pl-simple-grid">
        <div>
          <div className={`pl-simple-card pl-simple-result ${isProfit ? 'is-profit' : 'is-loss'}`}>
            <div>
              <div
                className="pl-simple-result-amt"
                style={{ color: isProfit ? '#15803d' : '#b91c1c' }}
              >
                <RiyalIcon size={28} />
                {fmt2(Math.abs(profit))}
              </div>
              <p className="pl-simple-hint" style={{ margin: '6px 0 0' }}>
                {t('report.pl.simple.keptPer100.before')}{' '}
                <Money value={100} />{' '}
                {t(
                  isProfit
                    ? 'report.pl.simple.keptPer100.mid'
                    : 'report.pl.simple.keptPer100.midLoss',
                )}{' '}
                <Money value={Math.abs(kept)} />
              </p>
            </div>
            <span
              className="pl-simple-word"
              style={{
                background: isProfit ? '#15803d' : '#b91c1c',
                color: '#fff',
                fontSize: 13,
                padding: '8px 14px',
              }}
            >
              {isProfit ? t('report.pl.simple.profit') : t('report.pl.simple.loss')}
            </span>
          </div>

          <section className="pl-simple-card" style={{ marginTop: 12 }}>
            <div className="pl-simple-row" style={{ alignItems: 'flex-start' }}>
              <div>
                <h3 className="pl-simple-heading" style={{ margin: 0, fontSize: 15 }}>
                  <span className="pl-simple-step-num">1</span>{' '}
                  {t('report.pl.simple.step.sales')}
                </h3>
                <p className="pl-simple-hint">{t('report.pl.simple.hint.sales')}</p>
              </div>
            </div>
            {depts.map((d) => {
              const split = splitBilingualName(d.name);
              const label = ar ? split.ar || split.en : split.en || split.ar;
              return (
                <div key={d.departmentId || d.name} className="pl-simple-row">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{label || d.name}</div>
                    <div className="pl-simple-hint" style={{ margin: 0 }}>
                      {t('report.pl.simple.productsServices', {
                        products: fmt2(d.products),
                        services: fmt2(d.services),
                      })}
                    </div>
                    <div className="pl-simple-bar" />
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                    <Money value={d.amount} />
                  </span>
                </div>
              );
            })}
            {bridge ? (
              <div className="pl-simple-row" style={{ fontWeight: 700 }}>
                <span>{t('report.pl.simple.deptSubtotal')}</span>
                <Money value={bridge.deptLinesTotal} />
              </div>
            ) : null}
            {Math.abs(returns) >= 0.005 ? (
              <div className="pl-simple-row">
                <span>{t('report.pl.simple.lessReturns')}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', color: '#b91c1c' }}>
                  <Money value={-Math.abs(returns)} color="#b91c1c" />
                  <OpenLink href={href('pl.salesReturns')} t={t} />
                </span>
              </div>
            ) : (
              <div className="pl-simple-row" style={{ color: '#64748b' }}>
                <span>{t('report.pl.simple.lessReturns')}</span>
                <Money value={0} color="#b91c1c" />
              </div>
            )}
            <div className="pl-simple-row" style={{ color: '#64748b' }}>
              <span>{t('report.pl.simple.lessDiscounts')}</span>
              <Money value={-Math.abs(discounts)} color="#b91c1c" />
            </div>
            {bridge && Math.abs(Number(deptAdj) || 0) >= 0.005 ? (
              <div className="pl-simple-row" style={{ color: '#64748b' }}>
                <span>{t('report.pl.simple.lessAdjustmentsInfo')}</span>
                <Money value={deptAdj} color="#b91c1c" signed />
              </div>
            ) : null}
            <div
              className="pl-simple-row"
              style={{ background: '#f8fafc', margin: '6px -16px -14px', padding: '10px 16px', borderRadius: '0 0 14px 14px' }}
            >
              <b>{t('report.pl.simple.netSales')}</b>
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                <Money value={netSales} />
                <OpenLink href={href('pl.netRevenue')} t={t} />
              </span>
            </div>
          </section>

          <section className="pl-simple-card" style={{ marginTop: 12 }}>
            <h3 className="pl-simple-heading" style={{ margin: 0, fontSize: 15 }}>
              <span className="pl-simple-step-num">2</span> {t('report.pl.simple.step.cogs')}
            </h3>
            <p className="pl-simple-hint">{t('report.pl.simple.hint.cogs')}</p>
            <div className="pl-simple-row">
              <span>{t('report.pl.simple.cogs')}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                <Money value={-Math.abs(cogs)} color="#b91c1c" />
                <OpenLink href={href('pl.cogs')} t={t} />
              </span>
            </div>
            <div
              className="pl-simple-row"
              style={{ background: '#fffbeb', margin: '6px -16px -14px', padding: '10px 16px', borderRadius: '0 0 14px 14px' }}
            >
              <span>
                <b>{t('report.pl.simple.grossProfit')}</b>{' '}
                <span className="pl-simple-hint" style={{ display: 'inline' }}>
                  {t('report.pl.simple.marginPct', { pct: fmt2(margin) })}
                </span>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                <Money value={gross} />
                <OpenLink href={href('pl.grossProfit')} t={t} />
              </span>
            </div>
          </section>

          <section className="pl-simple-card" style={{ marginTop: 12 }}>
            <h3 className="pl-simple-heading" style={{ margin: 0, fontSize: 15 }}>
              <span className="pl-simple-step-num">3</span> {t('report.pl.simple.step.expenses')}
            </h3>
            <p className="pl-simple-hint">{t('report.pl.simple.hint.expenses')}</p>
            {groupedRows.map(([id, lines]) => {
              const sum = round2(lines.reduce((s, l) => s + Number(l.amount || 0), 0));
              return (
                <div key={id} className="pl-simple-row">
                  <span>{t(`report.pl.simple.exp.${id}`)}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                    <Money value={-Math.abs(sum)} color="#b91c1c" />
                    <OpenLink href={href('pl.opex')} t={t} />
                  </span>
                </div>
              );
            })}
            <div className="pl-simple-row" style={{ fontWeight: 800 }}>
              <span>{t('report.pl.simple.totalExpenses')}</span>
              <Money value={-Math.abs(round2(pl?.totalOperatingExpenses))} color="#b91c1c" />
            </div>
            {Math.abs(round2(pl?.totalOtherIncome)) >= 0.005 ? (
              <div className="pl-simple-row">
                <span>{t('report.pl.simple.otherIncome')}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <Money value={pl?.totalOtherIncome} signed color="#15803d" />
                  <OpenLink href={href('pl.otherIncome')} t={t} />
                </span>
              </div>
            ) : null}
            {Math.abs(round2(pl?.totalOtherExpenses)) >= 0.005 ? (
              <div className="pl-simple-row">
                <span>{t('report.pl.simple.otherExpenses')}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <Money value={-Math.abs(round2(pl?.totalOtherExpenses))} color="#b91c1c" />
                  <OpenLink href={href('pl.otherExpenses')} t={t} />
                </span>
              </div>
            ) : null}
          </section>

          <section className="pl-simple-card" style={{ marginTop: 12 }}>
            <h3 className="pl-simple-heading" style={{ margin: 0, fontSize: 15 }}>
              <span className="pl-simple-step-num">4</span> {t('report.pl.simple.step.cash')}{' '}
              <span title={t('report.pl.simple.tip.cash')} style={{ cursor: 'help' }}>
                ⓘ
              </span>
            </h3>
            <p className="pl-simple-hint">{t('report.pl.simple.hint.cash')}</p>
            <div className="pl-simple-row">
              <span>
                {t('report.pl.simple.cashDiff')}{' '}
                {cashDir !== 'balanced' ? (
                  <span className={`pl-simple-word ${cashDir}`}>
                    {t(`report.pl.simple.${cashDir}`)}
                  </span>
                ) : null}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                <Money
                  value={cashNet}
                  signed
                  color={cashNet < 0 ? '#b91c1c' : '#15803d'}
                />
                <button
                  type="button"
                  className="pl-simple-open"
                  style={{ background: 'none', border: 0, cursor: 'pointer' }}
                  onClick={() => setOpenCash((v) => !v)}
                >
                  {t('report.pl.simple.open')}
                </button>
              </span>
            </div>
            {openCash
              ? cashAccts.map((a) => (
                  <div key={a.accountId || a.code} className="pl-simple-row" style={{ paddingInlineStart: 12 }}>
                    <span>
                      {a.code} {a.name}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                      <Money value={a.net} signed color={a.net < 0 ? '#b91c1c' : '#15803d'} />
                      <OpenLink href={href('pl.cashOverShort')} t={t} />
                    </span>
                  </div>
                ))
              : null}
            {(() => {
              const cashLine = cashAccts.find((a) => String(a.code) === '1150');
              const cardLine = cashAccts.find((a) => String(a.code) === '1151');
              if (!cashLine || !cardLine) return null;
              const c = round2(cashLine.net);
              const k = round2(cardLine.net);
              if (c * k < 0 && Math.abs(c + k) < Math.min(Math.abs(c), Math.abs(k))) {
                return (
                  <div className="pl-simple-callout">{t('report.pl.simple.mixup')}</div>
                );
              }
              return null;
            })()}
          </section>

          <section
            className={`pl-simple-card pl-simple-net ${isProfit ? '' : 'is-loss'}`}
            style={{ marginTop: 12 }}
          >
            <div className="pl-simple-row">
              <h3 className="pl-simple-heading" style={{ margin: 0, fontSize: 15, color: '#fff' }}>
                <span className="pl-simple-step-num" style={{ background: '#fff', color: '#15803d' }}>
                  5
                </span>{' '}
                {t('report.pl.simple.step.net')}
              </h3>
            </div>
            <p className="pl-simple-hint" style={{ color: 'rgba(255,255,255,0.85)' }}>
              {t('report.pl.simple.hint.net')}
            </p>
            <div className="pl-simple-row" style={{ color: '#fff', fontWeight: 800 }}>
              <span>
                = {t('report.pl.simple.netProfit')} —{' '}
                {isProfit ? t('report.pl.simple.profit') : t('report.pl.simple.loss')}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                <Money value={profit} color="#fff" />
                <OpenLink href={href('pl.netIncome')} t={t} />
              </span>
            </div>
          </section>

          {pl?.unpostedInvoices?.count > 0 ? (
            <p className="pl-simple-foot">
              {t('report.pl.simple.unposted.before', {
                count: pl.unpostedInvoices.count,
              })}{' '}
              <Money value={pl.unpostedInvoices.exVat} />{' '}
              {t('report.pl.simple.unposted.after')}{' '}
              <button
                type="button"
                className="pl-simple-open"
                style={{ background: 'none', border: 0, cursor: 'pointer' }}
                onClick={() => onOpenMissingJournals?.()}
              >
                {t('pl.bridge.missingJournals')}
              </button>
            </p>
          ) : null}
          {!hideHq ? (
            <p className="pl-simple-foot">{t('report.pl.simple.hqNote')}</p>
          ) : (
            <p className="pl-simple-foot">{t('report.pl.simple.hqHidden')}</p>
          )}
          <p className="pl-simple-foot">
            {t('report.pl.simple.vatNote.text')}{' '}
            {t('report.pl.simple.vatNote.sales')} <Money value={salesIncl} />
            {' · '}
            {t('report.pl.simple.vatNote.vat')} <Money value={vatCollected} />
          </p>
          {stepsMismatch ? (
            <p className="pl-simple-foot" style={{ color: '#b45309' }}>
              {t('report.pl.simple.stepsMismatch')}
            </p>
          ) : null}
          {Array.isArray(pl?.basisWarnings) && pl.basisWarnings.length
            ? pl.basisWarnings.map((w) => {
                const vars = {
                  n: pl.unallocatedSettlementCount,
                  date: String(pl.booksStartDate || '')
                    .slice(0, 10)
                    .replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3/$2/$1'),
                };
                const text = t(w, vars);
                return (
                  <p key={w} className="pl-simple-foot" style={{ color: '#b45309' }}>
                    {text === w ? t('report.pl.warning.generic') : text}
                  </p>
                );
              })
            : null}
          {accountantItems.map((item) => (
            <p key={`${item.code}-${item.name}`} className="pl-simple-foot">
              {t('report.pl.simple.accountantItem.before', {
                code: item.code,
                name: item.name,
              })}{' '}
              <Money value={item.amount} />{' '}
              {t('report.pl.simple.accountantItem.after')}
            </p>
          ))}
        </div>

        <aside>
          <div className="pl-simple-card pl-simple-side">
            <h3 className="pl-simple-heading">{t('report.pl.simple.howto.title')}</h3>
            <ol>
              <li>{t('report.pl.simple.howto.1')}</li>
              <li>{t('report.pl.simple.howto.2')}</li>
              <li>{t('report.pl.simple.howto.3')}</li>
            </ol>
          </div>
          {openCash && cashAccts.length ? (
            <div className="pl-simple-card pl-simple-side" style={{ marginTop: 12 }}>
              <h3 className="pl-simple-heading">{t('report.pl.simple.drill.cash')}</h3>
              {cashAccts.map((a) => (
                <div key={a.accountId || a.code} className="pl-simple-row">
                  <span>
                    {a.code} {a.name}
                  </span>
                  <Money value={a.net} signed color={a.net < 0 ? '#b91c1c' : '#15803d'} />
                </div>
              ))}
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
