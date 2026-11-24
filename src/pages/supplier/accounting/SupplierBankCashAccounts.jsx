import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    createSupplierCashAccount,
    getSupplierCashBook,
    listSupplierCashAccounts,
} from '../../../services/supplierAccountingApi';
import { saccT } from '../../../utils/supplierAccountingI18n';
import { SUPPLIER_PERM, useSupplierCan } from '../../../utils/supplierPermissions';
import {
    AcctCard,
    AcctEmpty,
    AcctError,
    AcctLoading,
    Field,
    formatCoaBalance,
    inputStyle,
    outlineBtnStyle,
    primaryBtnStyle,
    todayISO,
} from './SupplierAccountingShared';
import { extractArray, unwrapPayload } from './SupplierManagerAccountingShared';
import SupplierRiyalAmount from '../SupplierRiyalAmount';

/**
 * SP-11 — Cash / bank book: per-account opening · receipts · payments · closing (each opens the
 * existing ledger statement titled "Cash book" / "Bank book"), the combined book with a running
 * cash position, and a tie-out to the Cash Flow closing cash. Export reuses the ledger statement.
 */
function CashBankBook({ locale, t }) {
    const navigate = useNavigate();
    const numAlign = locale === 'ar' ? 'left' : 'right';
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState(todayISO());
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [showLines, setShowLines] = useState(false);
    const [exporting, setExporting] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            setData(await getSupplierCashBook({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }));
        } catch (e) {
            setErr(e?.message || t('cashbook.err'));
        } finally {
            setLoading(false);
        }
    }, [dateFrom, dateTo, t]);

    useEffect(() => { load(); }, [load]);

    const canExport = useSupplierCan()(SUPPLIER_PERM.reportsExport); // SP-22
    const runExport = async (kind) => {
        if (!data || exporting) return;
        setExporting(kind);
        setErr('');
        try {
            const mod = await import('../../../utils/supplierLedgerExport');
            const codes = (data.books || []).map((b) => b.code).join(' + ');
            const header = {
                accountCode: codes,
                accountName: t('cashbook.combinedTitle'),
                accountType: 'ASSET',
                from: data.dateFrom || undefined,
                to: data.dateTo || undefined,
                currencyCode: 'SAR',
            };
            const rows = (data.lines || []).map((l) => ({
                id: l.id,
                date: l.date,
                description: `[${l.accountCode}] ${l.description}`,
                reference: l.entryNumber || l.reference || '',
                counterpartyLabel: '—',
                offsetAccountLabel: l.against,
                debit: l.debit,
                credit: l.credit,
                runningBalance: l.runningBalance,
            }));
            const args = {
                header,
                openingBalance: data.totals?.openingBalance ?? 0,
                rows,
                totals: {
                    totalDebit: data.totals?.receipts ?? 0,
                    totalCredit: data.totals?.payments ?? 0,
                    closingBalance: data.totals?.closingBalance ?? 0,
                },
                riyalSymbol: true,
            };
            if (kind === 'pdf') await mod.exportAccountLedgerPdf(args);
            else mod.exportAccountLedgerExcel(args);
        } catch (e) {
            setErr(e?.message || t('cashbook.err'));
        } finally {
            setExporting('');
        }
    };

    const amt = (v) => <SupplierRiyalAmount amount={v} size={12} />;
    const books = data?.books || [];
    const tot = data?.totals || {};
    const chk = data?.check;

    return (
        <AcctCard title={t('cashbook.title')}>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: '#64748B', lineHeight: 1.5 }}>{t('cashbook.hint')}</p>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                <Field label={t('cashbook.from')} hint={t('cashbook.fromHint')}>
                    <input type="date" style={inputStyle} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </Field>
                <Field label={t('cashbook.to')}>
                    <input type="date" style={inputStyle} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </Field>
                <button type="button" style={outlineBtnStyle} disabled={!data || Boolean(exporting) || !canExport} onClick={() => runExport('pdf')}>
                    {exporting === 'pdf' ? t('reports.export.busy') : t('reports.export.pdf')}
                </button>
                <button type="button" style={outlineBtnStyle} disabled={!data || Boolean(exporting) || !canExport} onClick={() => runExport('excel')}>
                    {exporting === 'excel' ? t('reports.export.busy') : t('reports.export.excel')}
                </button>
            </div>
            <AcctError message={err} />
            {!loading && chk ? (
                <div
                    role="status"
                    style={{
                        marginBottom: 12,
                        padding: '8px 12px',
                        borderRadius: 10,
                        fontSize: 12,
                        fontWeight: 600,
                        border: `1px solid ${chk.ties ? '#A7F3D0' : '#FECACA'}`,
                        background: chk.ties ? '#ECFDF5' : '#FEF2F2',
                        color: chk.ties ? '#065F46' : '#B91C1C',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 4,
                        alignItems: 'center',
                    }}
                >
                    {chk.ties ? (
                        <>{t('cashbook.ties')} {amt(chk.cashGlClosing)}</>
                    ) : (
                        <>{t('cashbook.notTies')} {amt(chk.difference)}</>
                    )}
                </div>
            ) : null}
            {loading ? <AcctLoading locale={locale} /> : !data ? <AcctEmpty message={t('reports.noData')} /> : (
                <>
                    <div style={{ width: '100%', overflowX: 'auto' }}>
                        <table className="ws-table" style={{ width: '100%', minWidth: 720 }}>
                            <thead>
                                <tr>
                                    <th>{t('cashbook.th.book')}</th>
                                    <th style={{ textAlign: numAlign }}>{t('cashbook.th.opening')}</th>
                                    <th style={{ textAlign: numAlign }}>{t('cashbook.th.in')}</th>
                                    <th style={{ textAlign: numAlign }}>{t('cashbook.th.out')}</th>
                                    <th style={{ textAlign: numAlign }}>{t('cashbook.th.closing')}</th>
                                    <th style={{ textAlign: numAlign }}>{t('cashbook.th.lines')}</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {books.length === 0 ? (
                                    <tr><td colSpan={7} style={{ color: '#64748B' }}>{t('mgr.cash.empty')}</td></tr>
                                ) : books.map((b) => (
                                    <tr key={b.accountId} data-account-id={b.accountId}>
                                        <td>
                                            <span style={{ fontSize: 11, fontWeight: 700, color: b.bookType === 'bank' ? '#1D4ED8' : '#047857', marginInlineEnd: 6 }}>
                                                {b.bookType === 'bank' ? t('cashbook.bankBook') : t('cashbook.cashBook')}
                                            </span>
                                            <strong>[{b.code}]</strong> {b.name}
                                        </td>
                                        <td style={{ textAlign: numAlign, whiteSpace: 'nowrap' }}>{amt(b.openingBalance)}</td>
                                        <td style={{ textAlign: numAlign, whiteSpace: 'nowrap', color: '#065F46' }}>{amt(b.receipts)}</td>
                                        <td style={{ textAlign: numAlign, whiteSpace: 'nowrap', color: '#B91C1C' }}>{amt(b.payments)}</td>
                                        <td style={{ textAlign: numAlign, whiteSpace: 'nowrap', fontWeight: 800 }}>{amt(b.closingBalance)}</td>
                                        <td style={{ textAlign: numAlign }}>{b.lineCount}</td>
                                        <td>
                                            <button type="button" style={{ ...outlineBtnStyle, padding: '4px 10px', fontSize: 12 }} onClick={() => navigate(b.proof.sourceHref)}>
                                                {t('cashbook.openBook')}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr style={{ borderTop: '2px solid #0F172A' }}>
                                    <td style={{ fontWeight: 800 }}>{t('cashbook.combined')}</td>
                                    <td style={{ textAlign: numAlign, whiteSpace: 'nowrap', fontWeight: 800 }}>{amt(tot.openingBalance ?? 0)}</td>
                                    <td style={{ textAlign: numAlign, whiteSpace: 'nowrap', fontWeight: 800 }}>{amt(tot.receipts ?? 0)}</td>
                                    <td style={{ textAlign: numAlign, whiteSpace: 'nowrap', fontWeight: 800 }}>{amt(tot.payments ?? 0)}</td>
                                    <td style={{ textAlign: numAlign, whiteSpace: 'nowrap', fontWeight: 800 }}>{amt(tot.closingBalance ?? 0)}</td>
                                    <td style={{ textAlign: numAlign, fontWeight: 800 }}>{tot.lineCount ?? 0}</td>
                                    <td />
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                    <div style={{ marginTop: 12 }}>
                        <button type="button" style={outlineBtnStyle} onClick={() => setShowLines((v) => !v)} disabled={!(data.lines || []).length}>
                            {showLines ? t('cashbook.hideLines') : t('cashbook.showLines', { n: (data.lines || []).length })}
                        </button>
                    </div>
                    {showLines ? (
                        <div style={{ width: '100%', overflowX: 'auto', marginTop: 10 }}>
                            <table className="ws-table" style={{ width: '100%', minWidth: 900 }}>
                                <thead>
                                    <tr>
                                        <th>{t('cashbook.th.date')}</th>
                                        <th>{t('cashbook.th.account')}</th>
                                        <th>{t('cashbook.th.entry')}</th>
                                        <th>{t('cashbook.th.description')}</th>
                                        <th>{t('cashbook.th.against')}</th>
                                        <th style={{ textAlign: numAlign }}>{t('cashbook.th.in')}</th>
                                        <th style={{ textAlign: numAlign }}>{t('cashbook.th.out')}</th>
                                        <th style={{ textAlign: numAlign }}>{t('cashbook.th.running')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td colSpan={7} style={{ fontWeight: 700, color: '#475569' }}>{t('cashbook.openingRow')}</td>
                                        <td style={{ textAlign: numAlign, whiteSpace: 'nowrap', fontWeight: 700 }}>{amt(tot.openingBalance ?? 0)}</td>
                                    </tr>
                                    {(data.lines || []).map((l) => (
                                        <tr
                                            key={l.id}
                                            data-journal-id={l.proof?.journalId}
                                            role="button"
                                            tabIndex={0}
                                            style={{ cursor: 'pointer' }}
                                            onClick={() => l.proof?.sourceHref && navigate(l.proof.sourceHref)}
                                            onKeyDown={(e) => {
                                                if ((e.key === 'Enter' || e.key === ' ') && l.proof?.sourceHref) {
                                                    e.preventDefault();
                                                    navigate(l.proof.sourceHref);
                                                }
                                            }}
                                        >
                                            <td style={{ whiteSpace: 'nowrap' }}>{l.date}</td>
                                            <td style={{ whiteSpace: 'nowrap' }}>[{l.accountCode}]</td>
                                            <td style={{ whiteSpace: 'nowrap' }}>{l.entryNumber || '—'}</td>
                                            <td>{l.description}</td>
                                            <td style={{ fontSize: 12, color: '#64748B' }}>{l.against}</td>
                                            <td style={{ textAlign: numAlign, whiteSpace: 'nowrap', color: '#065F46' }}>{l.debit ? amt(l.debit) : ''}</td>
                                            <td style={{ textAlign: numAlign, whiteSpace: 'nowrap', color: '#B91C1C' }}>{l.credit ? amt(l.credit) : ''}</td>
                                            <td style={{ textAlign: numAlign, whiteSpace: 'nowrap', fontWeight: 700 }}>{amt(l.runningBalance)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : null}
                </>
            )}
        </AcctCard>
    );
}


export default function SupplierBankCashAccounts({ locale = 'en' }) {
    const t = useCallback((key, vars) => saccT(locale, key, vars), [locale]);
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const [reading, setReading] = useState('');
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        name: '',
        code: '',
        cashKind: 'cash',
        openingBalance: '',
        openingBalanceDate: todayISO(),
        supportsPending: true,
    });

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const res = unwrapPayload(await listSupplierCashAccounts());
            setItems(extractArray(res, ['items']));
            setReading(res?.reading || t('mgr.cash.hint'));
        } catch (e) {
            setErr(e?.message || t('coa.err.load'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        load();
    }, [load]);

    async function save(e) {
        e.preventDefault();
        setSaving(true);
        setErr('');
        try {
            await createSupplierCashAccount({
                name: form.name.trim(),
                code: form.code.trim() || undefined,
                cashKind: form.cashKind,
                openingBalance: Number(form.openingBalance || 0),
                openingBalanceDate: form.openingBalanceDate || undefined,
                supportsPending: form.cashKind === 'bank' ? Boolean(form.supportsPending) : false,
            });
            setForm((f) => ({ ...f, name: '', code: '', openingBalance: '' }));
            await load();
        } catch (ex) {
            setErr(ex?.message || t('coa.err.save'));
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="module-container" style={{ overflowX: 'hidden' }}>
            <CashBankBook locale={locale} t={t} />
            <AcctCard title={t('mgr.cash.title')}>
                <p style={{ margin: '0 0 14px', fontSize: 13, color: '#64748B', lineHeight: 1.5 }}>
                    {reading || t('mgr.cash.hint')}
                </p>
                <AcctError message={err} />
                {loading ? (
                    <AcctLoading locale={locale} />
                ) : items.length === 0 ? (
                    <AcctEmpty message={t('mgr.cash.empty')} />
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="ws-table" style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th>{t('mgr.cash.th.account')}</th>
                                    <th>{t('mgr.cash.th.kind')}</th>
                                    <th>{t('mgr.cash.th.pending')}</th>
                                    <th style={{ textAlign: 'right' }}>{t('mgr.cash.th.balance')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((a) => (
                                    <tr
                                        key={a.id}
                                        style={{ cursor: 'pointer' }}
                                        onClick={() =>
                                            navigate(`/supplier/accounting/ledger/${encodeURIComponent(a.id)}`)
                                        }
                                    >
                                        <td>
                                            <strong>[{a.code}]</strong> {a.name}
                                        </td>
                                        <td>
                                            {a.cashKind === 'bank'
                                                ? t('mgr.cash.kind.bank')
                                                : t('mgr.cash.kind.cash')}
                                        </td>
                                        <td>{a.supportsPending ? t('mgr.cash.yes') : t('mgr.cash.no')}</td>
                                        <td style={{ textAlign: 'right' }}>
                                            {formatCoaBalance(
                                                a.type,
                                                a.closingDebit,
                                                a.closingCredit,
                                                'SAR',
                                                locale,
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </AcctCard>

            <AcctCard title={t('mgr.cash.new')}>
                <form
                    onSubmit={save}
                    style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}
                >
                    <Field label={t('mgr.cash.name')} required>
                        <input
                            style={inputStyle}
                            value={form.name}
                            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                            required
                        />
                    </Field>
                    <Field label={t('mgr.cash.code')}>
                        <input
                            style={inputStyle}
                            value={form.code}
                            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                        />
                    </Field>
                    <Field label={t('mgr.cash.kind')} required>
                        <select
                            style={inputStyle}
                            value={form.cashKind}
                            onChange={(e) => setForm((f) => ({ ...f, cashKind: e.target.value }))}
                        >
                            <option value="cash">{t('mgr.cash.kind.cash')}</option>
                            <option value="bank">{t('mgr.cash.kind.bank')}</option>
                        </select>
                    </Field>
                    <Field label={t('mgr.cash.opening')}>
                        <input
                            type="number"
                            step="0.01"
                            style={inputStyle}
                            value={form.openingBalance}
                            onChange={(e) => setForm((f) => ({ ...f, openingBalance: e.target.value }))}
                        />
                    </Field>
                    <Field label={t('mgr.cash.openingDate')}>
                        <input
                            type="date"
                            style={inputStyle}
                            value={form.openingBalanceDate}
                            onChange={(e) => setForm((f) => ({ ...f, openingBalanceDate: e.target.value }))}
                        />
                    </Field>
                    {form.cashKind === 'bank' ? (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
                            <input
                                type="checkbox"
                                checked={form.supportsPending}
                                onChange={(e) => setForm((f) => ({ ...f, supportsPending: e.target.checked }))}
                            />
                            {t('mgr.cash.pending')}
                        </label>
                    ) : null}
                    <div style={{ display: 'flex', alignItems: 'end' }}>
                        <button type="submit" style={primaryBtnStyle} disabled={saving || !form.name.trim()}>
                            {saving ? t('hub.btn.saving') : t('mgr.cash.save')}
                        </button>
                    </div>
                </form>
            </AcctCard>
        </div>
    );
}
