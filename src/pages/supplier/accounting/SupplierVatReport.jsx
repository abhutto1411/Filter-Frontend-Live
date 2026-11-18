import React, { useCallback, useEffect, useState } from 'react';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getSupplierVatReport } from '../../../services/supplierAccountingApi';
import {
    exportVatReturnExcel,
    exportVatReturnPdf,
} from '../../../utils/supplierLedgerExport';
import SupplierRiyalAmount from '../SupplierRiyalAmount';
import { saccT } from '../../../utils/supplierAccountingI18n';
import { SUPPLIER_PERM, useSupplierCan } from '../../../utils/supplierPermissions';
import {
    AcctEmpty,
    AcctError,
    AcctLoading,
    Field,
    inputStyle,
    money,
    outlineBtnStyle,
    primaryBtnStyle,
    startOfMonthISO,
    todayISO,
} from './SupplierAccountingShared';

const summaryCardStyle = {
    padding: 14,
    borderRadius: 12,
    border: '1px solid #E2E8F0',
    background: '#FFFFFF',
};

const summaryLabelStyle = {
    fontSize: '0.72rem',
    fontWeight: 700,
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 6,
};

const summaryValueStyle = {
    fontSize: '1.125rem',
    fontWeight: 800,
    color: '#0F172A',
};


const AUDIT_STATUS_STYLE = {
    matched: { bg: '#ECFDF5', fg: '#065F46' },
    amount_mismatch: { bg: '#FEF2F2', fg: '#B91C1C' },
    no_journal: { bg: '#FEF2F2', fg: '#B91C1C' },
    no_document: { bg: '#FFFBEB', fg: '#92400E' },
};

/**
 * MZ-09 (SP-12), MZ-11 — the return in the official ZATCA VAT-return layout (boxes 1–10, 13, 15;
 * one extra section, same page). Untracked boxes show 0 with a note — the portal has no data for
 * them. Box 15 (GL) is checked against the document side of the VAT audit below
 * (`reconcilesToNetPayable` / `reconciliation`).
 */
function ZatcaBoxesTable({ zb, t, numAlign, amt }) {
    if (!zb?.rows?.length) return null;
    const cell = { padding: '6px 10px', borderBottom: '1px solid #E2E8F0', fontSize: 13 };
    const head = { ...cell, fontWeight: 700, color: '#475569', background: '#F8FAFC' };
    return (
        <div style={{ marginBottom: 16 }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 800, color: '#0F172A' }}>{t('vat.zatca.title')}</h4>
            <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: 10 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th style={{ ...head, textAlign: 'start' }}>{t('vat.zatca.th.box')}</th>
                            <th style={{ ...head, textAlign: 'start' }}>{t('vat.zatca.th.category')}</th>
                            <th style={{ ...head, textAlign: numAlign }}>{t('vat.zatca.th.amount')}</th>
                            <th style={{ ...head, textAlign: numAlign }}>{t('vat.zatca.th.vat')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {zb.rows.map((r) => (
                            <tr key={r.key} data-zatca-box={r.key}>
                                <td style={cell}>{r.box != null ? r.box : '—'}</td>
                                <td style={cell}>
                                    {t(`vat.zatca.${r.key}`)}
                                    {!r.tracked ? (
                                        <span style={{ display: 'block', fontSize: 11, color: '#94A3B8' }}>{t('vat.zatca.notTracked')}</span>
                                    ) : null}
                                </td>
                                <td style={{ ...cell, textAlign: numAlign }}>{amt(r.amount)}</td>
                                <td style={{ ...cell, textAlign: numAlign }}>{amt(r.vat)}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td style={head}>{zb.totals?.box ?? 15}</td>
                            <td style={{ ...head }} colSpan={2}>
                                {t('vat.zatca.net')}{' '}
                                <span
                                    data-zatca-reconciles={zb.reconcilesToNetPayable ? 'yes' : 'no'}
                                    style={{ fontWeight: 600, color: zb.reconcilesToNetPayable ? '#047857' : '#B91C1C' }}
                                >
                                    {zb.reconcilesToNetPayable ? t('vat.zatca.reconciles') : t('vat.zatca.mismatch')}
                                </span>
                                {zb.reconciliation && !zb.reconcilesToNetPayable ? (
                                    <span style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#B91C1C' }}>
                                        {t('vat.zatca.docSide')} {amt(zb.reconciliation.documentNetVat, 11)} ·{' '}
                                        {t('vat.zatca.difference')} {amt(zb.reconciliation.difference, 11)}
                                    </span>
                                ) : null}
                            </td>
                            <td style={{ ...head, textAlign: numAlign }}>{amt(zb.totals?.netVat ?? 0, 13)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}

/** SP-12 — ZATCA-style return boxes (GL), TB tie-out and the document-vs-journal VAT audit. */
function VatReturnPanel({ data, t, locale, onOpen }) {
    const [showMatched, setShowMatched] = useState(false);
    const numAlign = locale === 'ar' ? 'left' : 'right';
    const amt = (v, size = 12) => <SupplierRiyalAmount amount={v} size={size} />;
    const boxes = data?.boxes;
    const tie = data?.tbTie;
    const audit = data?.audit;
    if (!boxes) return null;
    const auditRows = (audit?.rows || []).filter((r) => showMatched || r.status !== 'matched');
    const box = (key, b, accent) => (
        <div
            key={key}
            role={b?.proof?.sourceHref ? 'button' : undefined}
            tabIndex={b?.proof?.sourceHref ? 0 : undefined}
            onClick={() => b?.proof?.sourceHref && onOpen(b.proof.sourceHref)}
            onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && b?.proof?.sourceHref) {
                    e.preventDefault();
                    onOpen(b.proof.sourceHref);
                }
            }}
            data-account-id={b?.proof?.accountId || undefined}
            style={{ ...summaryCardStyle, borderColor: accent || '#E2E8F0', cursor: b?.proof?.sourceHref ? 'pointer' : 'default' }}
        >
            <div style={summaryLabelStyle}>
                {b?.box ? t('vat.box.n', { n: b.box }) : t('vat.box.net')} · {t(`vat.box.${key}`)}
            </div>
            <div style={summaryValueStyle}>{amt(b?.amount ?? 0, 14)}</div>
            <div style={{ marginTop: 4, fontSize: 11, color: '#94A3B8' }}>
                {b?.basis === 'documents' ? t('vat.box.basisDocs') : b?.basis === 'gl' ? t('vat.box.basisGl') : t('vat.box.basisNet')}
            </div>
            {key === 'b1' && (b?.components || []).length ? (
                <div style={{ marginTop: 6, fontSize: 11, color: '#64748B', display: 'grid', gap: 2 }}>
                    {b.components.map((c) => (
                        <span
                            key={c.accountId}
                            role="button"
                            tabIndex={0}
                            style={{ cursor: 'pointer', display: 'inline-flex', gap: 4, alignItems: 'center' }}
                            onClick={(e) => {
                                e.stopPropagation();
                                onOpen(c.proof?.sourceHref);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onOpen(c.proof?.sourceHref);
                                }
                            }}
                        >
                            [{c.code}] {amt(c.amount, 10)}
                        </span>
                    ))}
                </div>
            ) : null}
        </div>
    );

    return (
        <div style={{ marginBottom: 20 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 800, color: '#0F172A' }}>{t('vat.return.title')}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
                {box('b1', boxes.box1StandardRatedSales)}
                {box('b6', boxes.box6OutputVat, '#99F6E4')}
                {box('b7', boxes.box7StandardRatedPurchases)}
                {box('b8', boxes.box8InputVat, '#FECACA')}
                {box('net_label', boxes.netPayable, '#FED7AA')}
            </div>
            <ZatcaBoxesTable zb={data?.zatcaBoxes} t={t} numAlign={numAlign} amt={amt} />
            {tie ? (
                <div style={{ marginBottom: 16, padding: '8px 12px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#F8FAFC', fontSize: 12, color: '#475569', display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
                    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                        {t('vat.tie.output', { code: tie.vatOutput?.code })} {amt(tie.vatOutput?.closing ?? 0)}
                    </span>
                    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                        {t('vat.tie.input', { code: tie.vatInput?.code })} {amt(tie.vatInput?.closing ?? 0)}
                    </span>
                    <span style={{ color: '#94A3B8' }}>{t('vat.tie.note')}</span>
                </div>
            ) : null}

            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800, color: '#0F172A' }}>{t('vat.audit.title')}</h3>
            {audit ? (
                <>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 8, fontSize: 12 }}>
                        {['output', 'input'].map((side) => {
                            const s = audit.summary?.[side] || {};
                            const ok = Number(s.difference || 0) === 0 && !s.unmatched;
                            return (
                                <div key={side} style={{ padding: '8px 12px', borderRadius: 10, border: `1px solid ${ok ? '#A7F3D0' : '#FECACA'}`, background: ok ? '#ECFDF5' : '#FEF2F2', color: ok ? '#065F46' : '#B91C1C', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontWeight: 600 }}>
                                    <span>{t(`vat.audit.side.${side}`)}:</span>
                                    <span>{t('vat.audit.docs')}</span> {amt(s.documentVat ?? 0)}
                                    <span>{t('vat.audit.journals')}</span> {amt(s.journalVat ?? 0)}
                                    <span>{t('vat.audit.diff')}</span> {amt(s.difference ?? 0)}
                                    <span>· {t('vat.audit.unmatchedN', { n: s.unmatched ?? 0 })}</span>
                                </div>
                            );
                        })}
                    </div>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#334155', marginBottom: 8, cursor: 'pointer' }}>
                        <input type="checkbox" checked={showMatched} onChange={(e) => setShowMatched(e.target.checked)} />
                        {t('vat.audit.showMatched')}
                    </label>
                    <div style={{ width: '100%', overflowX: 'auto' }}>
                        <table className="ws-table" style={{ width: '100%', minWidth: 820, margin: 0 }}>
                            <thead>
                                <tr>
                                    <th>{t('vat.audit.th.status')}</th>
                                    <th>{t('vat.audit.th.type')}</th>
                                    <th>{t('vat.audit.th.doc')}</th>
                                    <th>{t('vat.th.date')}</th>
                                    <th style={{ textAlign: numAlign }}>{t('vat.audit.th.docVat')}</th>
                                    <th style={{ textAlign: numAlign }}>{t('vat.audit.th.jeVat')}</th>
                                    <th style={{ textAlign: numAlign }}>{t('vat.audit.th.diff')}</th>
                                    <th>{t('vat.audit.th.entries')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {auditRows.length === 0 ? (
                                    <tr><td colSpan={8} style={{ color: '#065F46' }}>{t('vat.audit.allMatched')}</td></tr>
                                ) : auditRows.map((r) => {
                                    const st = AUDIT_STATUS_STYLE[r.status] || AUDIT_STATUS_STYLE.no_document;
                                    return (
                                        <tr
                                            key={r.key}
                                            data-journal-id={r.proof?.journalId || undefined}
                                            role="button"
                                            tabIndex={0}
                                            style={{ cursor: 'pointer' }}
                                            onClick={() => onOpen(r.proof?.sourceHref)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    onOpen(r.proof?.sourceHref);
                                                }
                                            }}
                                        >
                                            <td>
                                                <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: st.bg, color: st.fg }}>
                                                    {t(`vat.audit.status.${r.status}`)}
                                                </span>
                                                {r.journalOutsideWindow ? (
                                                    <span style={{ marginInlineStart: 6, fontSize: 11, color: '#92400E' }}>{t('vat.audit.outside')}</span>
                                                ) : null}
                                            </td>
                                            <td style={{ fontSize: 12 }}>{t(`vat.audit.type.${r.type}`)}</td>
                                            <td style={{ fontSize: 12 }}>{r.documentNo || '—'}</td>
                                            <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{r.date}</td>
                                            <td style={{ textAlign: numAlign, whiteSpace: 'nowrap' }}>{amt(r.documentVat)}</td>
                                            <td style={{ textAlign: numAlign, whiteSpace: 'nowrap' }}>{amt(r.journalVat)}</td>
                                            <td style={{ textAlign: numAlign, whiteSpace: 'nowrap', fontWeight: 700, color: Number(r.difference) === 0 ? '#065F46' : '#B91C1C' }}>{amt(r.difference)}</td>
                                            <td style={{ fontSize: 11, color: '#64748B' }}>{(r.journalEntryNumbers || []).join(', ') || '—'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            ) : null}
        </div>
    );
}

export default function SupplierVatReport({ locale: localeProp }) {
    const locale =
        localeProp ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => saccT(locale, key, vars), [locale]);
    const em = t('emdash');
    const m = (v) => money(v, 'SAR', { locale });
    const navigate = useNavigate();
    const openHref = useCallback((href) => { if (href) navigate(href); }, [navigate]);

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [dateFrom, setDateFrom] = useState(startOfMonthISO());
    const [dateTo, setDateTo] = useState(todayISO());

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const res = await getSupplierVatReport({
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined,
            });
            const root = res?.data && typeof res.data === 'object' ? res.data : res;
            setData(root);
        } catch (e) {
            setErr(e?.message || t('vat.err.load'));
        } finally {
            setLoading(false);
        }
    }, [dateFrom, dateTo, t]);

    useEffect(() => {
        void load();
    }, [load]);

    function clearRange() {
        setDateFrom(startOfMonthISO());
        setDateTo(todayISO());
    }

    // SP-12: the export carries the return boxes, TB tie-out, audit and journal lines.
    const canExport = useSupplierCan()(SUPPLIER_PERM.reportsExport); // SP-22
    async function onExportPdf() {
        if (!data) return;
        try {
            await exportVatReturnPdf({ data });
        } catch (e) {
            setErr(e?.message || t('vat.err.load'));
        }
    }

    function onExportExcel() {
        if (!data) return;
        exportVatReturnExcel({ data });
    }

    const rows = data?.rows ?? [];
    const totals = data?.totals;
    const accountLabel = data?.vatPayableAccount
        ? `[${data.vatPayableAccount.code}] ${data.vatPayableAccount.name}`
        : '';
    const closingPayable =
        totals?.closingPayable ??
        data?.vatPayableAccount?.closingBalance ??
        data?.vatPayableAccount?.netBalance ??
        0;
    const periodNetChange =
        totals?.periodNetChange ?? totals?.payableToZatca ?? 0;
    const periodLabel =
        data?.header?.from && data?.header?.to
            ? `${data.header.from} — ${data.header.to}`
            : null;

    return (
        <div style={{ overflowX: 'hidden' }}>
            <div style={{ marginBottom: 16 }}>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0F172A' }}>
                    {t('vat.title')}
                </h2>
                <p style={{ margin: '6px 0 0', color: '#64748B', fontSize: '0.875rem' }}>
                    {t('vat.sub')}
                </p>
            </div>

            {accountLabel ? (
                <div
                    style={{
                        marginBottom: 16,
                        padding: '14px 16px',
                        borderRadius: 12,
                        border: '1px solid #CBD5E1',
                        background: '#FFFFFF',
                    }}
                >
                    <div style={summaryLabelStyle}>{t('vat.ledgerAccount')}</div>
                    <div style={{ ...summaryValueStyle, fontSize: '1.2rem', marginTop: 6 }}>
                        {accountLabel}
                    </div>
                    {periodLabel ? (
                        <div style={{ marginTop: 8, fontSize: '0.875rem', color: '#64748B' }}>
                            {t('vat.period', { period: periodLabel })}
                        </div>
                    ) : null}
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                            gap: 12,
                            marginTop: 12,
                        }}
                    >
                        <div>
                            <div style={summaryLabelStyle}>{t('vat.openingBal')}</div>
                            <div style={{ ...summaryValueStyle, fontSize: '1rem' }}>
                                {m(data?.openingPayable ?? 0)}
                            </div>
                        </div>
                        <div>
                            <div style={summaryLabelStyle}>{t('vat.netChange')}</div>
                            <div style={{ ...summaryValueStyle, fontSize: '1rem' }}>
                                {m(periodNetChange)}
                            </div>
                        </div>
                        <div>
                            <div style={summaryLabelStyle}>{t('vat.closingPayable')}</div>
                            <div
                                style={{
                                    ...summaryValueStyle,
                                    fontSize: '1.25rem',
                                    color: '#0F172A',
                                }}
                            >
                                {m(closingPayable)}
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

            <div
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 10,
                    alignItems: 'flex-end',
                    marginBottom: 16,
                }}
            >
                <Field label={t('logs.from')}>
                    <input
                        type="date"
                        style={inputStyle}
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                    />
                </Field>
                <Field label={t('logs.to')}>
                    <input
                        type="date"
                        style={inputStyle}
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                    />
                </Field>
                <button type="button" style={primaryBtnStyle} onClick={() => void load()} disabled={loading}>
                    {loading ? t('loading') : t('vat.apply')}
                </button>
                <button type="button" style={outlineBtnStyle} onClick={clearRange} disabled={loading}>
                    {t('vat.clear')}
                </button>
                <div style={{ flex: 1, minWidth: 12 }} />
                <button
                    type="button"
                    className="btn-portal-outline"
                    onClick={onExportPdf}
                    disabled={!data || loading || !canExport}
                >
                    <FileText size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                    {t('vat.pdf')}
                </button>
                <button
                    type="button"
                    className="btn-portal-outline"
                    onClick={onExportExcel}
                    disabled={!data || loading || !canExport}
                >
                    <FileSpreadsheet size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                    {t('vat.excel')}
                </button>
            </div>

            {err ? <AcctError message={err} /> : null}

            {!loading && data ? <VatReturnPanel data={data} t={t} locale={locale} onOpen={openHref} /> : null}

            {loading ? (
                <AcctLoading locale={locale} />
            ) : !rows.length && !data?.openingPayable ? (
                <AcctEmpty message={t('vat.empty')} />
            ) : (
                <div
                    style={{
                        border: '1px solid var(--color-border, #e2e8f0)',
                        borderRadius: 12,
                        overflow: 'hidden',
                    }}
                >
                    <table className="ws-table" style={{ margin: 0 }}>
                        <thead>
                            <tr>
                                <th style={{ width: 110 }}>{t('vat.th.date')}</th>
                                <th style={{ width: 120 }}>{t('vat.th.ref')}</th>
                                <th>{t('vat.th.desc')}</th>
                                <th style={{ width: 110, textAlign: 'right' }}>{t('vat.th.sale')}</th>
                                <th style={{ width: 110, textAlign: 'right' }}>{t('vat.th.purchase')}</th>
                                <th style={{ width: 100, textAlign: 'right' }}>{t('vat.th.output')}</th>
                                <th style={{ width: 100, textAlign: 'right' }}>{t('vat.th.input')}</th>
                                <th style={{ width: 120, textAlign: 'right' }}>{t('vat.th.payable')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr style={{ background: '#F8FAFC', fontWeight: 700 }}>
                                <td>{em}</td>
                                <td>{em}</td>
                                <td>{t('vat.openingBal')}</td>
                                <td style={{ textAlign: 'right' }}>{em}</td>
                                <td style={{ textAlign: 'right' }}>{em}</td>
                                <td style={{ textAlign: 'right' }}>{em}</td>
                                <td style={{ textAlign: 'right' }}>{em}</td>
                                <td style={{ textAlign: 'right' }}>
                                    {m(data?.openingPayable ?? 0)}
                                </td>
                            </tr>
                            {rows.map((r) => (
                                <tr
                                    key={r.id}
                                    data-journal-id={r.journalId || undefined}
                                    style={r.proof?.sourceHref ? { cursor: 'pointer' } : undefined}
                                    onClick={() => openHref(r.proof?.sourceHref)}
                                >
                                    <td style={{ whiteSpace: 'nowrap' }}>{r.date}</td>
                                    <td>{r.reference || em}</td>
                                    <td>{r.description || em}</td>
                                    <td style={{ textAlign: 'right' }}>
                                        {r.saleInclVat > 0 ? m(r.saleInclVat) : ''}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        {r.purchaseInclVat > 0 ? m(r.purchaseInclVat) : ''}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        {r.vatOutput !== 0 ? m(r.vatOutput) : ''}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        {r.vatInput !== 0 ? m(r.vatInput) : ''}
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                        {m(r.payableToZatca)}
                                    </td>
                                </tr>
                            ))}
                            {totals ? (
                                <tr
                                    style={{
                                        background: '#FFF7ED',
                                        fontWeight: 800,
                                        borderTop: '1px solid #FED7AA',
                                    }}
                                >
                                    <td />
                                    <td />
                                    <td>{t('vat.closingSummary')}</td>
                                    <td style={{ textAlign: 'right' }}>
                                        {m(totals.totalSaleInclVat)}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        {m(totals.totalPurchaseInclVat)}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>{m(totals.totalVatOutput)}</td>
                                    <td style={{ textAlign: 'right' }}>{m(totals.totalVatInput)}</td>
                                    <td style={{ textAlign: 'right' }}>
                                        {m(closingPayable)}
                                    </td>
                                </tr>
                            ) : null}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
