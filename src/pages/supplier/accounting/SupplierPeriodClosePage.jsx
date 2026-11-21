import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock } from 'lucide-react';
import {
    getSupplierPeriodClose,
    postSupplierYearEndClose,
    previewSupplierYearEndClose,
    reopenSupplierFiscalYear,
    setSupplierLockDate,
} from '../../../services/supplierAccountingApi';
import { saccT } from '../../../utils/supplierAccountingI18n';
import { SUPPLIER_PERM, useSupplierCan } from '../../../utils/supplierPermissions';
import {
    AcctCard,
    AcctEmpty,
    AcctError,
    AcctLoading,
    Field,
    fmtDate,
    fmtDateTime,
    inputStyle,
    outlineBtnStyle,
    primaryBtnStyle,
} from './SupplierAccountingShared';
import { unwrapPayload } from './SupplierManagerAccountingShared';
import SupplierRiyalAmount from '../SupplierRiyalAmount';

/**
 * SP-14 — the ONE period-close screen (`/supplier/accounting/period-close`).
 * Lock date + year-end close preview (GET, writes nothing) + post / reopen + history.
 * Closing journal: Dr each income account its signed YTD, Cr each expense account, plug 3100.
 */
export default function SupplierPeriodClosePage({ locale = 'en' }) {
    const navigate = useNavigate();
    const t = useCallback((key, vars) => saccT(locale, key, vars), [locale]);
    const numAlign = locale === 'ar' ? 'left' : 'right';

    const [state, setState] = useState(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [preview, setPreview] = useState(null);
    const [showLines, setShowLines] = useState(false);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState('');
    const [err, setErr] = useState('');
    const [msg, setMsg] = useState('');
    const [lockInput, setLockInput] = useState('');
    const [lockReason, setLockReason] = useState('');

    const loadState = useCallback(async () => {
        const s = unwrapPayload(await getSupplierPeriodClose());
        setState(s);
        setLockInput(s?.lockDate || '');
        return s;
    }, []);

    const loadPreview = useCallback(async (from, to) => {
        if (!from || !to) return;
        setPreview(unwrapPayload(await previewSupplierYearEndClose({ startDate: from, endDate: to })));
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setErr('');
            try {
                const s = await loadState();
                if (cancelled) return;
                const from = s?.suggested?.startDate || '';
                const to = s?.suggested?.endDate || '';
                setStartDate(from);
                setEndDate(to);
                await loadPreview(from, to);
            } catch (e) {
                if (!cancelled) setErr(e?.message || t('pc.err'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [loadState, loadPreview, t]);

    const refreshPreview = async (from = startDate, to = endDate) => {
        setErr('');
        setMsg('');
        try {
            await loadPreview(from, to);
        } catch (e) {
            setErr(e?.message || t('pc.err'));
        }
    };

    const canExport = useSupplierCan()(SUPPLIER_PERM.reportsExport); // SP-22
    const canJournal = useSupplierCan()(SUPPLIER_PERM.journalPost); // SP-22: close / reopen / lock date
    const runExport = async (kind) => {
        if (!preview || busy) return;
        setBusy(kind);
        setErr('');
        try {
            const mod = await import('../../../utils/supplierLedgerExport');
            if (kind === 'pdf') await mod.exportYearEndClosePdf({ data: preview });
            else mod.exportYearEndCloseExcel({ data: preview });
        } catch (e) {
            setErr(e?.message || t('pc.err'));
        } finally {
            setBusy('');
        }
    };

    const closeYear = async () => {
        if (!preview?.canPost || busy) return;
        const ok = window.confirm(
            t('pc.confirm', { start: preview.startDate, end: preview.endDate, ni: preview.totals.netIncome }),
        );
        if (!ok) return;
        setBusy('close');
        setErr('');
        setMsg('');
        try {
            const res = unwrapPayload(
                await postSupplierYearEndClose({
                    startDate: preview.startDate,
                    endDate: preview.endDate,
                    confirmNetIncome: preview.totals.netIncome,
                }),
            );
            setMsg(t('pc.closed', { entry: res?.journal?.entryNumber || '', lock: res?.lockDate || '' }));
            await loadState();
            await loadPreview(preview.startDate, preview.endDate);
        } catch (e) {
            setErr(e?.message || t('pc.err'));
        } finally {
            setBusy('');
        }
    };

    const saveLock = async (value) => {
        setBusy('lock');
        setErr('');
        setMsg('');
        try {
            await setSupplierLockDate({ lockDate: value || null, reason: lockReason.trim() || undefined });
            setLockReason('');
            setMsg(t('pc.lock.saved'));
            await loadState();
            await loadPreview(startDate, endDate);
        } catch (e) {
            setErr(e?.message || t('pc.err'));
        } finally {
            setBusy('');
        }
    };

    const reopen = async (fy) => {
        const reason = window.prompt(t('pc.years.reopenReason', { start: fy.startDate, end: fy.endDate }));
        if (!reason || !reason.trim()) return;
        setBusy(`reopen-${fy.id}`);
        setErr('');
        setMsg('');
        try {
            await reopenSupplierFiscalYear(fy.id, { reason: reason.trim() });
            await loadState();
            await loadPreview(startDate, endDate);
        } catch (e) {
            setErr(e?.message || t('pc.err'));
        } finally {
            setBusy('');
        }
    };

    const tot = preview?.totals;
    const closedJournal = preview?.fiscalYear?.status === 'closed' ? preview.fiscalYear.closingJournal : null;
    const amt = (v, bold) => <SupplierRiyalAmount amount={Number(v || 0)} size={12} style={bold ? { fontWeight: 800 } : undefined} />;
    const summaryRow = (label, value, opts = {}) => (
        <div
            style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                padding: '10px 8px',
                borderBottom: '1px solid #E2E8F0',
                fontSize: opts.sub ? 12 : 13,
                color: opts.sub ? '#64748B' : '#0F172A',
                paddingInlineStart: opts.sub ? 22 : 8,
            }}
        >
            <span>{label}</span>
            <span style={{ fontWeight: opts.sub ? 600 : 800, whiteSpace: 'nowrap' }}>{amt(value)}</span>
        </div>
    );
    const accountCell = (row) => (
        <button
            type="button"
            onClick={() => navigate(row.ledgerHref)}
            style={{ background: 'none', border: 0, padding: 0, color: '#0F766E', cursor: 'pointer', textAlign: 'start', font: 'inherit' }}
        >
            [{row.accountCode}] {row.accountName}
        </button>
    );

    return (
        <div style={{ overflowX: 'hidden', maxWidth: '100%' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
                <div>
                    <button type="button" style={{ ...outlineBtnStyle, marginBottom: 8 }} onClick={() => navigate('/supplier/accounting_reports_tb')}>
                        <ArrowLeft size={14} /> {t('pc.back')}
                    </button>
                    <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0F172A' }}>{t('pc.title')}</h2>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748B' }}>{t('pc.subtitle')}</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" style={outlineBtnStyle} disabled={!preview || Boolean(busy) || !canExport} onClick={() => runExport('pdf')}>
                        {busy === 'pdf' ? t('reports.export.busy') : t('reports.export.pdf')}
                    </button>
                    <button type="button" style={outlineBtnStyle} disabled={!preview || Boolean(busy) || !canExport} onClick={() => runExport('excel')}>
                        {busy === 'excel' ? t('reports.export.busy') : t('reports.export.excel')}
                    </button>
                </div>
            </div>

            <AcctError message={err} />
            {msg ? (
                <div role="status" style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 10, background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', fontSize: 13, fontWeight: 600 }}>
                    {msg}
                </div>
            ) : null}

            {loading ? (
                <AcctLoading locale={locale} />
            ) : (
                <>
                    <AcctCard>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 8 }}>
                            <Field label={t('pc.fyStart')}>
                                <input type="date" style={inputStyle} value={startDate} onChange={(e) => setStartDate(e.target.value)} onBlur={() => refreshPreview()} />
                            </Field>
                            <Field label={t('pc.fyEnd')}>
                                <input type="date" style={inputStyle} value={endDate} onChange={(e) => setEndDate(e.target.value)} onBlur={() => refreshPreview()} />
                            </Field>
                            <Field label={t('pc.lockUpTo')}>
                                <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Lock size={14} /> {state?.lockDate ? fmtDate(state.lockDate) : t('pc.noLock')}
                                </div>
                            </Field>
                            <Field label={t('pc.status')}>
                                <div style={{ ...inputStyle, display: 'flex', alignItems: 'center' }}>
                                    {closedJournal ? t('pc.status.closed', { entry: closedJournal.entryNumber }) : t('pc.status.open')}
                                </div>
                            </Field>
                        </div>

                        {preview ? (
                            <>
                                {summaryRow(t('pc.ni'), tot.netIncome)}
                                {Number(preview.broughtForwardNetIncome) ? (
                                    <>
                                        {summaryRow(t('pc.yearNi'), preview.yearNetIncome, { sub: true })}
                                        {summaryRow(t('pc.broughtForward'), preview.broughtForwardNetIncome, { sub: true })}
                                    </>
                                ) : null}
                                {summaryRow(t('pc.drIncome'), tot.incomeToClose)}
                                {summaryRow(t('pc.crExpense'), tot.expenseToClose)}
                                {summaryRow(
                                    t('pc.re'),
                                    Number(preview.retainedEarnings?.credit || 0) - Number(preview.retainedEarnings?.debit || 0),
                                )}
                                <div style={{ margin: '8px 0', fontSize: 12, fontWeight: 700, color: tot.balanced ? '#065F46' : '#B91C1C' }}>
                                    {tot.balanced ? t('pc.balanced') : t('pc.unbalanced')}
                                </div>
                                {preview.draftJournalsInYear > 0 && !closedJournal ? (
                                    <div style={{ marginBottom: 8, fontSize: 12, color: '#92400E' }}>{t('pc.drafts', { n: preview.draftJournalsInYear })}</div>
                                ) : null}
                                {(preview.blockers || [])
                                    .filter((b) => b !== 'already_closed')
                                    .map((b) => (
                                        <div key={b} style={{ marginBottom: 6, fontSize: 12, color: '#B91C1C', fontWeight: 600 }}>
                                            ⚠ {t(`pc.blocker.${b}`, { date: preview.lastClosedEndDate || '' })}
                                        </div>
                                    ))}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                                    <button type="button" style={outlineBtnStyle} onClick={() => setShowLines((v) => !v)}>
                                        {showLines ? t('pc.hidePreview') : t('pc.previewBtn')}
                                    </button>
                                    {closedJournal ? (
                                        <button
                                            type="button"
                                            style={outlineBtnStyle}
                                            onClick={() => navigate(`/supplier/accounting/journals/${encodeURIComponent(closedJournal.id)}`)}
                                        >
                                            {closedJournal.entryNumber}
                                        </button>
                                    ) : (
                                        <button type="button" style={primaryBtnStyle} disabled={!preview.canPost || Boolean(busy) || !canJournal} title={canJournal ? undefined : t('perm.denied')} onClick={closeYear}>
                                            {busy === 'close' ? t('pc.closing') : t('pc.closeBtn')}
                                        </button>
                                    )}
                                </div>

                                {showLines ? (
                                    <div style={{ width: '100%', overflowX: 'auto', marginTop: 12 }}>
                                        <table className="ws-table" style={{ width: '100%' }}>
                                            <thead>
                                                <tr>
                                                    <th>{t('pc.th.account')}</th>
                                                    <th>{t('pc.th.type')}</th>
                                                    <th style={{ textAlign: numAlign }}>{t('pc.th.balance')}</th>
                                                    <th style={{ textAlign: numAlign }}>{t('pc.th.debit')}</th>
                                                    <th style={{ textAlign: numAlign }}>{t('pc.th.credit')}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {preview.lines.map((l) => (
                                                    <tr key={l.accountId}>
                                                        <td>
                                                            {accountCell(l)}
                                                            {l.inactive ? <span style={{ marginInlineStart: 6, fontSize: 11, color: '#B91C1C' }}>({t('pc.inactive')})</span> : null}
                                                        </td>
                                                        <td>{t(`pc.type.${l.type}`)}</td>
                                                        <td style={{ textAlign: numAlign, whiteSpace: 'nowrap' }}>{amt(l.signed)}</td>
                                                        <td style={{ textAlign: numAlign, whiteSpace: 'nowrap' }}>{Number(l.debit) ? amt(l.debit) : ''}</td>
                                                        <td style={{ textAlign: numAlign, whiteSpace: 'nowrap' }}>{Number(l.credit) ? amt(l.credit) : ''}</td>
                                                    </tr>
                                                ))}
                                                {preview.retainedEarnings ? (
                                                    <tr style={{ background: '#F8FAFC' }}>
                                                        <td>{accountCell(preview.retainedEarnings)}</td>
                                                        <td>{t('pc.type.EQUITY')}</td>
                                                        <td />
                                                        <td style={{ textAlign: numAlign, whiteSpace: 'nowrap' }}>{Number(preview.retainedEarnings.debit) ? amt(preview.retainedEarnings.debit) : ''}</td>
                                                        <td style={{ textAlign: numAlign, whiteSpace: 'nowrap' }}>{Number(preview.retainedEarnings.credit) ? amt(preview.retainedEarnings.credit) : ''}</td>
                                                    </tr>
                                                ) : null}
                                            </tbody>
                                            <tfoot>
                                                <tr style={{ borderTop: '2px solid #0F172A' }}>
                                                    <td colSpan={3} style={{ fontWeight: 800 }}>{t('pc.th.total')}</td>
                                                    <td style={{ textAlign: numAlign }}>{amt(tot.debit, true)}</td>
                                                    <td style={{ textAlign: numAlign }}>{amt(tot.credit, true)}</td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                ) : null}
                            </>
                        ) : null}
                    </AcctCard>

                    <div style={{ margin: '12px 0', padding: '10px 12px', borderRadius: 10, border: '1px dashed #93C5FD', background: '#EFF6FF', color: '#1E3A8A', fontSize: 13 }}>
                        {t('pc.note')}
                    </div>

                    <AcctCard title={t('pc.lock.title')}>
                        <p style={{ margin: '0 0 10px', fontSize: 12, color: '#64748B' }}>{t('pc.lock.hint')}</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}>
                            <Field label={t('pc.lock.date')}>
                                <input type="date" style={inputStyle} value={lockInput} max={state?.today || undefined} onChange={(e) => setLockInput(e.target.value)} />
                            </Field>
                            <div style={{ flex: 1, minWidth: 200 }}>
                                <Field label={t('pc.lock.reason')}>
                                    <input style={inputStyle} value={lockReason} onChange={(e) => setLockReason(e.target.value)} />
                                </Field>
                            </div>
                            <button type="button" style={primaryBtnStyle} disabled={Boolean(busy) || !lockInput || lockInput === state?.lockDate || !canJournal} title={canJournal ? undefined : t('perm.denied')} onClick={() => saveLock(lockInput)}>
                                {t('pc.lock.save')}
                            </button>
                            {state?.lockDate ? (
                                <button type="button" style={outlineBtnStyle} disabled={Boolean(busy) || !canJournal} onClick={() => saveLock('')}>
                                    {t('pc.lock.clear')}
                                </button>
                            ) : null}
                        </div>
                    </AcctCard>

                    <AcctCard title={t('pc.years.title')} style={{ marginTop: 12 }}>
                        {!state?.fiscalYears?.length ? (
                            <AcctEmpty message={t('pc.years.empty')} />
                        ) : (
                            <table className="ws-table" style={{ width: '100%' }}>
                                <thead>
                                    <tr>
                                        <th>{t('pc.years.period')}</th>
                                        <th>{t('pc.years.status')}</th>
                                        <th>{t('pc.years.journal')}</th>
                                        <th />
                                    </tr>
                                </thead>
                                <tbody>
                                    {state.fiscalYears.map((fy) => {
                                        const latestClosed = state.fiscalYears.find((y) => y.status === 'closed');
                                        return (
                                            <tr key={fy.id}>
                                                <td>
                                                    {fmtDate(fy.startDate)} – {fmtDate(fy.endDate)}
                                                </td>
                                                <td>{fy.status === 'closed' ? t('pc.years.closed') : t('pc.years.open')}</td>
                                                <td>
                                                    {fy.closingJournal && fy.status === 'closed' ? (
                                                        <button
                                                            type="button"
                                                            style={{ ...outlineBtnStyle, padding: '2px 8px', fontSize: 12 }}
                                                            onClick={() => navigate(`/supplier/accounting/journals/${encodeURIComponent(fy.closingJournal.id)}`)}
                                                        >
                                                            {fy.closingJournal.entryNumber}
                                                        </button>
                                                    ) : (
                                                        '—'
                                                    )}
                                                </td>
                                                <td>
                                                    {fy.status === 'closed' && latestClosed?.id === fy.id ? (
                                                        <button
                                                            type="button"
                                                            style={{ ...outlineBtnStyle, padding: '2px 8px', fontSize: 12 }}
                                                            disabled={Boolean(busy) || !canJournal}
                                                            title={canJournal ? undefined : t('perm.denied')}
                                                            onClick={() => reopen(fy)}
                                                        >
                                                            {t('pc.years.reopen')}
                                                        </button>
                                                    ) : null}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </AcctCard>

                    {state?.history?.length ? (
                        <AcctCard title={t('pc.history.title')} style={{ marginTop: 12 }}>
                            <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 12, color: '#334155', display: 'grid', gap: 6 }}>
                                {state.history.map((h) => (
                                    <li key={h.id}>
                                        <strong>{t(`pc.history.${h.action}`)}</strong>
                                        {' · '}
                                        {fmtDateTime(h.at, locale)}
                                        {h.user ? ` · ${h.user}` : ''}
                                        {' · '}
                                        {t('pc.lockUpTo')}: {h.before?.lockDate || t('pc.history.none')} → {h.after?.lockDate || t('pc.history.none')}
                                        {h.after?.closingEntryNumber ? ` · ${h.after.closingEntryNumber}` : ''}
                                        {h.reason ? <div style={{ color: '#64748B' }}>{t('pc.lock.reason')}: {h.reason}</div> : null}
                                    </li>
                                ))}
                            </ul>
                        </AcctCard>
                    ) : null}
                </>
            )}
        </div>
    );
}
