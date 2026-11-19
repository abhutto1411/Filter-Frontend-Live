import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, ExternalLink, Pencil, Printer, RotateCcw } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
    getSupplierJournalAudit,
    getSupplierJournalById,
    reverseSupplierJournal,
    voidSupplierJournal,
} from '../../../services/supplierAccountingApi';
import { getSupplierProfile } from '../../../services/supplierApi';
import SupplierRiyalAmount from '../SupplierRiyalAmount';
import { saccT } from '../../../utils/supplierAccountingI18n';
import { SUPPLIER_PERM, useSupplierCan } from '../../../utils/supplierPermissions';
import {
    AcctCard,
    AcctError,
    AcctLoading,
    fmtDate,
    money,
    outlineBtnStyle,
    primaryBtnStyle,
    todayISO,
} from './SupplierAccountingShared';
import {
    canEditManualJournal,
    journalBalance,
    unwrapPayload,
} from './SupplierManagerAccountingShared';

/** SP-13 — "Reverse this entry": posts an opposite journal linked to this one (never edits it). */
function ReverseJournalPanel({ journal, t, onDone }) {
    const [open, setOpen] = useState(false);
    const [date, setDate] = useState(todayISO());
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    if (!journal?.canReverse) return null;
    async function submit() {
        if (!window.confirm(t('je.reverse.confirm', { entry: journal.entryNumber }))) return;
        setBusy(true);
        setErr('');
        try {
            const res = unwrapPayload(await reverseSupplierJournal(journal.id, { date, reason: reason.trim() || undefined }));
            onDone(res?.id);
        } catch (e) {
            setErr(e?.message || t('je.reverse.err'));
        } finally {
            setBusy(false);
        }
    }
    return (
        <div style={{ marginTop: 16, padding: 12, borderRadius: 10, border: '1px solid #E2E8F0', background: '#F8FAFC' }}>
            {!open ? (
                <button type="button" style={outlineBtnStyle} onClick={() => setOpen(true)}>
                    <RotateCcw size={14} /> {t('je.reverse.btn')}
                </button>
            ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
                    <div style={{ flexBasis: '100%', fontSize: 12, color: '#475569' }}>{t('je.reverse.hint')}</div>
                    <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 600 }}>
                        {t('je.reverse.date')}
                        <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #CBD5E1' }} />
                    </label>
                    <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 600, flex: 1, minWidth: 200 }}>
                        {t('je.reverse.reason')}
                        <input value={reason} onChange={(e) => setReason(e.target.value)} style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #CBD5E1' }} />
                    </label>
                    <button type="button" style={primaryBtnStyle} disabled={busy} onClick={submit}>
                        {busy ? t('hub.btn.saving') : t('je.reverse.post')}
                    </button>
                    <button type="button" style={outlineBtnStyle} disabled={busy} onClick={() => setOpen(false)}>
                        {t('je.reverse.cancel')}
                    </button>
                    {err ? <div style={{ flexBasis: '100%', color: '#B91C1C', fontSize: 12 }}>{err}</div> : null}
                </div>
            )}
        </div>
    );
}

/** SP-13 — audit trail of this journal (read-only), from the existing accounting audit log. */
function JournalHistory({ journalId, t, locale }) {
    const [data, setData] = useState(null);
    const [err, setErr] = useState('');
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = unwrapPayload(await getSupplierJournalAudit(journalId));
                if (!cancelled) setData(res);
            } catch (e) {
                if (!cancelled) setErr(e?.message || '');
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [journalId]);
    if (err) return <p style={{ marginTop: 14, fontSize: 12, color: '#B91C1C' }}>{err}</p>;
    if (!data) return null;
    const totals = (snap) =>
        snap && snap.totalDebit != null
            ? `${t('logs.th.debit')} ${snap.totalDebit} / ${t('logs.th.credit')} ${snap.totalCredit} · ${(snap.lines || []).length} ${t('je.history.lines')}`
            : '';
    return (
        <div style={{ marginTop: 18 }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 800, color: '#0F172A' }}>{t('je.history.title')}</h4>
            <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 12, color: '#334155', display: 'grid', gap: 6 }}>
                {(data.events || []).map((ev) => (
                    <li key={ev.id}>
                        <strong>{t(`je.history.action.${ev.action}`)}</strong>
                        {' · '}
                        {new Date(ev.at).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-GB', { timeZone: 'Asia/Riyadh' })}
                        {ev.user ? ` · ${ev.user}` : ''}
                        {ev.action === 'update' ? (
                            <div style={{ color: '#64748B' }}>
                                {t('je.history.before')}: {totals(ev.before)} → {t('je.history.after')}: {totals(ev.after)}
                            </div>
                        ) : ev.action === 'reversed_by' && ev.after?.reversalEntryNumber ? (
                            <div style={{ color: '#64748B' }}>{t('je.history.reversedBy', { entry: ev.after.reversalEntryNumber })}</div>
                        ) : ev.action === 'reverse' && ev.after?.reversalOfEntryNumber ? (
                            <div style={{ color: '#64748B' }}>{t('je.history.reversalOf', { entry: ev.after.reversalOfEntryNumber })}</div>
                        ) : ev.after && ev.action === 'create' ? (
                            <div style={{ color: '#64748B' }}>{totals(ev.after)}</div>
                        ) : null}
                        {ev.reason ? <div style={{ color: '#64748B' }}>{t('je.reverse.reason')}: {ev.reason}</div> : null}
                    </li>
                ))}
                <li>
                    <strong>{t('je.history.created')}</strong>
                    {' · '}
                    {new Date(data.createdAt).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-GB', { timeZone: 'Asia/Riyadh' })}
                    {data.createdBy ? ` · ${data.createdBy}` : ''}
                </li>
            </ul>
            {(data.events || []).length === 0 ? (
                <p style={{ margin: '6px 0 0', fontSize: 11, color: '#94A3B8' }}>{t('je.history.noEvents')}</p>
            ) : null}
        </div>
    );
}

function voucherTitleKey(type) {
    if (type === 'Receipt') return 'mgr.je.voucherReceipt';
    if (type === 'Payment') return 'mgr.je.voucherPayment';
    return 'mgr.je.voucher';
}

export default function SupplierJournalVoucherPage({ locale = 'en' }) {
    const t = useCallback((key, vars) => saccT(locale, key, vars), [locale]);
    /** MZ-10b (SP-19) — EN/AR label for the journal source; unknown sources show the raw code. */
    const sourceLabel = useCallback(
        (source) => {
            const key = `je.source.${source}`;
            const label = t(key);
            return label === key ? String(source || '') : label;
        },
        [t],
    );
    // SP-22: edit / void / reverse need supplier.journals.post (the API 403s otherwise).
    const canJournal = useSupplierCan()(SUPPLIER_PERM.journalPost);
    const navigate = useNavigate();
    const location = useLocation();
    const journalId = useMemo(() => {
        const m = location.pathname.match(/^\/supplier\/accounting\/journals\/([^/]+)/);
        return m ? decodeURIComponent(m[1]) : '';
    }, [location.pathname]);
    // SP-19: shareable drill state — ?highlightLine=<line id>&back=<ledger url>&backLabel=<account>
    const drill = useMemo(() => {
        const q = new URLSearchParams(location.search);
        const back = q.get('back') || '';
        return {
            highlightLine: (q.get('highlightLine') || '').trim(),
            back: back.startsWith('/supplier/') ? back : '',
            backLabel: (q.get('backLabel') || '').trim(),
        };
    }, [location.search]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [data, setData] = useState(null);
    useEffect(() => {
        if (!data || !drill.highlightLine) return;
        document.getElementById(`je-line-${drill.highlightLine}`)?.scrollIntoView({ block: 'center' });
    }, [data, drill.highlightLine]);
    const [companyName, setCompanyName] = useState('');
    const [voiding, setVoiding] = useState(false);
    const em = t('emdash');

    const load = useCallback(async () => {
        if (!journalId) return;
        setLoading(true);
        setErr('');
        try {
            const [raw, profile] = await Promise.all([
                getSupplierJournalById(journalId),
                getSupplierProfile().catch(() => null),
            ]);
            setData(unwrapPayload(raw));
            setCompanyName(
                profile?.supplier?.companyName ||
                    profile?.companyName ||
                    profile?.name ||
                    '',
            );
        } catch (e) {
            setErr(e?.message || t('logs.err.detail'));
        } finally {
            setLoading(false);
        }
    }, [journalId, t]);

    useEffect(() => {
        load();
    }, [load]);

    const bal = useMemo(
        () => journalBalance(data?.totalDebit, data?.totalCredit),
        [data],
    );
    const balanced = data?.isBalanced === true || bal.balanced;
    const heading = t(voucherTitleKey(data?.type));

    function downloadPdf() {
        if (!data) return;
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
        const margin = 40;
        let y = margin;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(16);
        pdf.text(companyName || heading, margin, y);
        y += 22;
        pdf.setFontSize(12);
        pdf.text(heading, margin, y);
        y += 20;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        const meta = [
            `${t('logs.th.entryNo')}: ${data.entryNumber || ''}`,
            `${t('logs.detail.date')}: ${fmtDate(data.date)}`,
            `${t('logs.th.type')}: ${data.type || ''}`,
            `${t('logs.detail.ref')}: ${data.reference || '—'}`,
            `${t('logs.th.status')}: ${balanced ? t('mgr.je.balanced') : t('mgr.je.unbalanced')}`,
        ];
        meta.forEach((line) => {
            pdf.text(line, margin, y);
            y += 14;
        });
        if (data.description) {
            y += 4;
            const desc = pdf.splitTextToSize(`${t('mgr.je.narration')}: ${data.description}`, 515);
            pdf.text(desc, margin, y);
            y += desc.length * 13 + 8;
        }
        autoTable(pdf, {
            startY: y,
            head: [[
                t('logs.th.account'),
                t('logs.th.party'),
                t('logs.th.description'),
                t('logs.th.debit'),
                t('logs.th.credit'),
            ]],
            body: (data.lines || []).map((l) => [
                l.accountCode ? `[${l.accountCode}] ${l.accountName || ''}` : (l.accountName || '—'),
                l.partyDisplayName || l.externalPartyName || '—',
                l.description || '—',
                Number(l.debit) > 0 ? Number(l.debit).toFixed(2) : '',
                Number(l.credit) > 0 ? Number(l.credit).toFixed(2) : '',
            ]),
            foot: [[
                t('logs.totals'),
                '',
                '',
                Number(data.totalDebit || 0).toFixed(2),
                Number(data.totalCredit || 0).toFixed(2),
            ]],
            styles: { fontSize: 8, cellPadding: 4 },
            headStyles: { fillColor: [15, 23, 42] },
            footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
            columnStyles: {
                3: { halign: 'right' },
                4: { halign: 'right' },
            },
        });
        const endY = pdf.lastAutoTable?.finalY || y;
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(balanced ? 6 : 180, balanced ? 95 : 83, balanced ? 70 : 9);
        pdf.text(
            `${t('mgr.je.difference')}: ${Math.abs(bal.difference).toFixed(2)} · ${balanced ? t('mgr.je.balanced') : t('mgr.je.unbalanced')}`,
            margin,
            endY + 22,
        );
        pdf.save(`${data.entryNumber || 'journal'}.pdf`);
    }

    async function handleVoid() {
        if (!canEditManualJournal(data)) return;
        if (!window.confirm(t('logs.confirm.void'))) return;
        setVoiding(true);
        try {
            await voidSupplierJournal(data.id);
            navigate('/supplier/accounting/journals');
        } catch (e) {
            setErr(e?.message || t('logs.err.void'));
        } finally {
            setVoiding(false);
        }
    }

    return (
        <div className="module-container je-voucher-page">
            <style>{`
                @media print {
                    .ws-sidebar, .ws-topbar, .ws-user-footer, .je-voucher-actions, .platform-chat-fab { display: none !important; }
                    .ws-main, .ws-content, .module-container { padding: 0 !important; margin: 0 !important; width: 100% !important; }
                    .je-voucher-sheet { box-shadow: none !important; border: none !important; }
                }
            `}</style>
            <div className="je-voucher-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                {drill.back ? (
                    <button type="button" style={outlineBtnStyle} onClick={() => navigate(drill.back)}>
                        <ArrowLeft size={14} /> {t('je.backToLedger', { account: drill.backLabel })}
                    </button>
                ) : null}
                <button type="button" style={outlineBtnStyle} onClick={() => navigate('/supplier/accounting/journals')}>
                    <ArrowLeft size={14} /> {t('mgr.je.back')}
                </button>
                {data?.source === 'super_supplier_debit_note' && data?.sourceId ? (
                    <button
                        type="button"
                        style={outlineBtnStyle}
                        onClick={() =>
                            navigate(
                                `/supplier/debit_notes?view=${encodeURIComponent(String(data.sourceId))}`,
                            )
                        }
                    >
                        {t('mgr.je.openDebitNote')}
                    </button>
                ) : data?.documentHref ? (
                    <button type="button" style={outlineBtnStyle} onClick={() => navigate(data.documentHref)}>
                        <ExternalLink size={14} /> {t('je.openDocument')}{data.reference ? ` ${data.reference}` : ''}
                    </button>
                ) : null}
                {data && canJournal && canEditManualJournal(data) && !data.reversedBy ? (
                    <button
                        type="button"
                        style={outlineBtnStyle}
                        onClick={() => navigate(`/supplier/accounting/journals?edit=${encodeURIComponent(data.id)}`)}
                    >
                        <Pencil size={14} /> {t('mgr.je.edit')}
                    </button>
                ) : null}
                <button type="button" style={outlineBtnStyle} disabled={!data} onClick={() => window.print()}>
                    <Printer size={14} /> {t('mgr.je.print')}
                </button>
                <button type="button" style={primaryBtnStyle} disabled={!data} onClick={downloadPdf}>
                    <Download size={14} /> {t('mgr.je.download')}
                </button>
            </div>

            {loading ? <AcctLoading locale={locale} /> : err && !data ? <AcctError message={err} /> : null}
            {data ? (
                <AcctCard title={`${heading} · ${data.entryNumber || ''}`}>
                    <AcctError message={err} />
                    <div className="je-voucher-sheet">
                        {companyName ? (
                            <p style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: '#0F172A' }}>{companyName}</p>
                        ) : null}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
                            <div>
                                <div style={{ fontSize: 11, color: '#64748B' }}>{t('logs.detail.date')}</div>
                                <div style={{ fontWeight: 700 }}>{fmtDate(data.date)}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 11, color: '#64748B' }}>{t('logs.th.type')}</div>
                                <div style={{ fontWeight: 700 }}>{data.type || em}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 11, color: '#64748B' }}>{t('logs.detail.ref')}</div>
                                <div style={{ fontWeight: 700 }}>{data.reference || em}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 11, color: '#64748B' }}>{t('logs.th.status')}</div>
                                <div style={{ fontWeight: 800, color: String(data.status) === 'void' ? '#B91C1C' : balanced ? '#065F46' : '#B45309' }}>
                                    {String(data.status) === 'void'
                                        ? data.status
                                        : `${balanced ? t('mgr.je.balanced') : t('mgr.je.unbalanced')}${balanced ? '' : ` · ${money(Math.abs(bal.difference), 'SAR', { locale })}`}`}
                                </div>
                            </div>
                        </div>
                        {data.reversedBy ? (
                            <div style={{ margin: '0 0 12px', padding: '8px 12px', borderRadius: 8, background: '#FFFBEB', color: '#92400E', fontSize: 13, fontWeight: 600 }}>
                                {t('je.reversedBy', { entry: data.reversedBy.entryNumber })}{' '}
                                <button type="button" style={{ ...outlineBtnStyle, padding: '2px 8px', fontSize: 12 }} onClick={() => navigate(`/supplier/accounting/journals/${encodeURIComponent(data.reversedBy.id)}`)}>
                                    {t('je.openEntry')}
                                </button>
                            </div>
                        ) : null}
                        {data.reversalOf ? (
                            <div style={{ margin: '0 0 12px', padding: '8px 12px', borderRadius: 8, background: '#EFF6FF', color: '#1E40AF', fontSize: 13, fontWeight: 600 }}>
                                {t('je.reversalOf', { entry: data.reversalOf.entryNumber })}{' '}
                                <button type="button" style={{ ...outlineBtnStyle, padding: '2px 8px', fontSize: 12 }} onClick={() => navigate(`/supplier/accounting/journals/${encodeURIComponent(data.reversalOf.id)}`)}>
                                    {t('je.openEntry')}
                                </button>
                            </div>
                        ) : null}
                        {data.description ? (
                            <p style={{ margin: '0 0 14px', fontSize: 13, color: '#334155' }}>{data.description}</p>
                        ) : null}
                        <div style={{ overflowX: 'auto' }}>
                            <table className="ws-table" style={{ width: '100%' }}>
                                <thead>
                                    <tr>
                                        <th>{t('logs.th.account')}</th>
                                        <th>{t('logs.th.party')}</th>
                                        <th>{t('logs.th.description')}</th>
                                        <th style={{ textAlign: 'right' }}>{t('logs.th.debit')}</th>
                                        <th style={{ textAlign: 'right' }}>{t('logs.th.credit')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(data.lines || []).map((l) => (
                                        <tr
                                            key={l.id}
                                            id={`je-line-${l.id}`}
                                            className={String(l.id) === drill.highlightLine ? 'je-line-highlight' : undefined}
                                            aria-current={String(l.id) === drill.highlightLine ? 'true' : undefined}
                                        >
                                            <td>[{l.accountCode}] {l.accountName}</td>
                                            <td>{l.partyDisplayName || l.externalPartyName || em}</td>
                                            <td>{l.description || em}</td>
                                            <td style={{ textAlign: 'right' }}>{Number(l.debit) > 0 ? <SupplierRiyalAmount amount={l.debit} size={13} /> : em}</td>
                                            <td style={{ textAlign: 'right' }}>{Number(l.credit) > 0 ? <SupplierRiyalAmount amount={l.credit} size={13} /> : em}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colSpan={3} style={{ textAlign: 'right', fontWeight: 800 }}>{t('logs.totals')}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 800 }}><SupplierRiyalAmount amount={data.totalDebit} size={13} /></td>
                                        <td style={{ textAlign: 'right', fontWeight: 800 }}><SupplierRiyalAmount amount={data.totalCredit} size={13} /></td>
                                    </tr>
                                    <tr>
                                        <td colSpan={3} style={{ textAlign: 'right', fontWeight: 800, color: balanced ? '#065F46' : '#B45309' }}>
                                            {t('mgr.je.difference')}
                                        </td>
                                        <td colSpan={2} style={{ textAlign: 'right', fontWeight: 800, color: balanced ? '#065F46' : '#B45309' }}>
                                            <SupplierRiyalAmount amount={Math.abs(bal.difference)} size={13} /> · {balanced ? t('mgr.je.balanced') : t('mgr.je.unbalanced')}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        {data.documentHref ? (
                            <button
                                type="button"
                                className="sp-source-chip"
                                onClick={() => navigate(data.documentHref)}
                            >
                                {t('je.sourceChip', { source: sourceLabel(data.source), ref: data.reference || '' })} →
                            </button>
                        ) : null}
                        {canJournal ? (
                        <ReverseJournalPanel
                            journal={data}
                            t={t}
                            onDone={(newId) =>
                                newId
                                    ? navigate(`/supplier/accounting/journals/${encodeURIComponent(newId)}`)
                                    : load()
                            }
                        />
                        ) : (
                            <p style={{ marginTop: 14, fontSize: 12, color: '#64748B' }}>{t('perm.denied')}</p>
                        )}
                        {canEditManualJournal(data) && !data.reversedBy ? (
                            <div style={{ marginTop: 16 }}>
                                <button type="button" style={{ ...outlineBtnStyle, color: '#B91C1C' }} disabled={voiding || !canJournal} title={canJournal ? undefined : t('perm.denied')} onClick={handleVoid}>
                                    {voiding ? t('logs.voiding') : t('logs.voidEntry')}
                                </button>
                            </div>
                        ) : data.origin === 'system' || data.source !== 'manual_journal' ? (
                            <p style={{ marginTop: 14, fontSize: 12, color: '#64748B' }}>{t('mgr.je.readonly')}</p>
                        ) : null}
                        <JournalHistory journalId={data.id} t={t} locale={locale} />
                    </div>
                </AcctCard>
            ) : null}
        </div>
    );
}
