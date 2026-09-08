import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Pencil, Printer } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getSupplierJournalById, voidSupplierJournal } from '../../../services/supplierAccountingApi';
import { getSupplierProfile } from '../../../services/supplierApi';
import { saccT } from '../../../utils/supplierAccountingI18n';
import {
    AcctCard,
    AcctError,
    AcctLoading,
    fmtDate,
    money,
    outlineBtnStyle,
    primaryBtnStyle,
} from './SupplierAccountingShared';
import {
    canEditManualJournal,
    journalBalance,
    unwrapPayload,
} from './SupplierManagerAccountingShared';

function voucherTitleKey(type) {
    if (type === 'Receipt') return 'mgr.je.voucherReceipt';
    if (type === 'Payment') return 'mgr.je.voucherPayment';
    return 'mgr.je.voucher';
}

export default function SupplierJournalVoucherPage({ locale = 'en' }) {
    const t = useCallback((key, vars) => saccT(locale, key, vars), [locale]);
    const navigate = useNavigate();
    const location = useLocation();
    const journalId = useMemo(() => {
        const m = location.pathname.match(/^\/supplier\/accounting\/journals\/([^/]+)/);
        return m ? decodeURIComponent(m[1]) : '';
    }, [location.pathname]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [data, setData] = useState(null);
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
                ) : null}
                {data && canEditManualJournal(data) ? (
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
                                        <tr key={l.id}>
                                            <td>[{l.accountCode}] {l.accountName}</td>
                                            <td>{l.partyDisplayName || l.externalPartyName || em}</td>
                                            <td>{l.description || em}</td>
                                            <td style={{ textAlign: 'right' }}>{Number(l.debit) > 0 ? money(l.debit, 'SAR', { locale }) : em}</td>
                                            <td style={{ textAlign: 'right' }}>{Number(l.credit) > 0 ? money(l.credit, 'SAR', { locale }) : em}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colSpan={3} style={{ textAlign: 'right', fontWeight: 800 }}>{t('logs.totals')}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 800 }}>{money(data.totalDebit, 'SAR', { locale })}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 800 }}>{money(data.totalCredit, 'SAR', { locale })}</td>
                                    </tr>
                                    <tr>
                                        <td colSpan={3} style={{ textAlign: 'right', fontWeight: 800, color: balanced ? '#065F46' : '#B45309' }}>
                                            {t('mgr.je.difference')}
                                        </td>
                                        <td colSpan={2} style={{ textAlign: 'right', fontWeight: 800, color: balanced ? '#065F46' : '#B45309' }}>
                                            {money(Math.abs(bal.difference), 'SAR', { locale })} · {balanced ? t('mgr.je.balanced') : t('mgr.je.unbalanced')}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        {canEditManualJournal(data) ? (
                            <div style={{ marginTop: 16 }}>
                                <button type="button" style={{ ...outlineBtnStyle, color: '#B91C1C' }} disabled={voiding} onClick={handleVoid}>
                                    {voiding ? t('logs.voiding') : t('logs.voidEntry')}
                                </button>
                            </div>
                        ) : data.origin === 'system' || data.source !== 'manual_journal' ? (
                            <p style={{ marginTop: 14, fontSize: 12, color: '#64748B' }}>{t('mgr.je.readonly')}</p>
                        ) : null}
                    </div>
                </AcctCard>
            ) : null}
        </div>
    );
}
