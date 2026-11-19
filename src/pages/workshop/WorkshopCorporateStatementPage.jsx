import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { parseWorkshopCorporateAccountId } from '../../utils/workshopCorporatePath';
import { ArrowLeft, Download, Eye, FileText, Printer, RefreshCw } from 'lucide-react';
import RiyalIcon from '../../components/RiyalIcon';
import { wcorpT } from '../../utils/workshopCorporateI18n';
import { splitBilingualName } from '../../utils/bilingualName';
import { toRiyadhDateISO } from '../../utils/riyadhBusinessRange';
import {
    getWorkshopCorporateMonthlyBill,
    getWorkshopCorporateMonthlyBills,
    getWorkshopCorporateStatement,
    postWorkshopCorporateReceipt,
} from '../../services/workshopStaffApi';
import {
    exportWorkshopCorporateStatementExcel,
    exportWorkshopCorporateStatementPdf,
} from '../../utils/corporateWorkshopStatementExport';
import { exportCorporateGeneratedBillPdf, resolveBillSeller } from '../../utils/corporateArLedgerExport';

/** CORPORATE-FIX-02 F: the workshop identity for a self-billed print. */
function billWorkshopFromDetail(bill) {
    const corp = bill?.statement?.corporateAccount || {};
    return { name: corp.workshopName || '', taxId: corp.workshopTaxId || '' };
}
import CorporateDateRangeBar from './CorporateDateRangeBar';

function money2(value) {
    return Number(value || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function Money({ amount }) {
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
            <RiyalIcon size={14} />
            {money2(amount)}
        </span>
    );
}

function billStatusLabel(status, t, owner) {
    if (status === 'paid') return t('status.paid');
    if (status === 'partially_paid') return t('status.partiallyPaid');
    if (status === 'overpaid') return t('status.overPaid');
    if (status === 'awaiting_approval') return t('status.awaiting');
    if (status === 'pending_deletion') return t('status.pendingDeletion');
    if (status === 'rejected') return t('status.rejected');
    if (owner === 'hq' && (status === 'pending' || !status)) return t('status.assignedHq');
    return t('status.generated');
}

function billOwnerLabel(owner, t) {
    return owner === 'workshop' ? t('owner.workshop') : t('owner.hq');
}

function formatBillCreated(iso, locale) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString(String(locale).startsWith('ar') ? 'ar-SA' : 'en-GB', {
        timeZone: 'Asia/Riyadh',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

function mismatchCode(err) {
    return String(err?.code || err?.body?.code || err?.error?.code || '');
}

function BilingualName({ en, ar, name }) {
    const split = en || ar ? { en, ar } : splitBilingualName(name);
    return (
        <span className="wcorp-bilingual">
            {split.en ? <span className="wcorp-bilingual__en">{split.en}</span> : null}
            {split.ar ? <span className="wcorp-bilingual__ar" dir="rtl">{split.ar}</span> : null}
            {!split.en && !split.ar ? '—' : null}
        </span>
    );
}

export default function WorkshopCorporateStatementPage({
    locale: localeProp,
    selectedBranchId = 'all',
}) {
    const locale = localeProp || (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) || 'en';
    const t = useCallback((key, vars) => wcorpT(locale, key, vars), [locale]);
    const location = useLocation();
    const params = useParams();
    const corporateAccountId =
        parseWorkshopCorporateAccountId(location.pathname) || params.corporateAccountId || null;
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const today = toRiyadhDateISO(new Date()) || '';
    const dateFrom = searchParams.get('dateFrom') || (today ? `${today.slice(0, 8)}01` : '');
    const dateTo = searchParams.get('dateTo') || today;

    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [amount, setAmount] = useState('');
    const [receiptDate, setReceiptDate] = useState(today);
    const [cashBankId, setCashBankId] = useState('');
    const [fifo, setFifo] = useState(true);
    const [picked, setPicked] = useState([]);
    const [posting, setPosting] = useState(false);
    const [postError, setPostError] = useState('');
    const [bills, setBills] = useState([]);
    const [billsLoading, setBillsLoading] = useState(false);
    const [billsError, setBillsError] = useState('');
    const [billDetail, setBillDetail] = useState(null);
    const [billDetailLoading, setBillDetailLoading] = useState(false);
    const [billPdfExporting, setBillPdfExporting] = useState(false);
    const [printBill, setPrintBill] = useState(null);
    const printPending = useRef(false);

    useEffect(() => {
        if (!printBill || !printPending.current) return undefined;
        printPending.current = false;
        const id = window.requestAnimationFrame(() => window.print());
        return () => window.cancelAnimationFrame(id);
    }, [printBill]);

    useEffect(() => {
        const clear = () => setPrintBill(null);
        window.addEventListener('afterprint', clear);
        return () => window.removeEventListener('afterprint', clear);
    }, []);

    const printSelectedBill = (bill) => {
        if (!bill) return;
        printPending.current = true;
        setPrintBill(bill);
    };

    const viewMode = searchParams.get('tab') === 'generated-bills' ? 'generated-bills' : 'statement';
    const selectedBillId = searchParams.get('billId') || '';

    const applyRange = (from, to) => {
        const next = new URLSearchParams(searchParams);
        next.set('dateFrom', from);
        next.set('dateTo', to);
        setSearchParams(next, { replace: true });
    };

    const setViewMode = (mode) => {
        const next = new URLSearchParams(searchParams);
        if (mode === 'generated-bills') next.set('tab', 'generated-bills');
        else next.delete('tab');
        if (mode !== 'generated-bills') next.delete('billId');
        setSearchParams(next, { replace: true });
        if (mode !== 'generated-bills') setBillDetail(null);
    };

    const setSelectedBillId = (billId) => {
        const next = new URLSearchParams(searchParams);
        next.set('tab', 'generated-bills');
        if (billId) next.set('billId', String(billId));
        else next.delete('billId');
        setSearchParams(next, { replace: true });
    };

    const load = useCallback(async () => {
        if (!corporateAccountId) {
            setLoading(false);
            setError(t('err.missingAccount'));
            setData(null);
            return;
        }
        setLoading(true);
        setError('');
        try {
            const res = await getWorkshopCorporateStatement(corporateAccountId, {
                dateFrom,
                dateTo,
                startDate: dateFrom,
                endDate: dateTo,
            });
            setData(res);
            if (res?.mismatch?.message) setError(res.mismatch.message);
            const banks = Array.isArray(res?.operatingCashBanks) ? res.operatingCashBanks : [];
            if (banks.length && !cashBankId) setCashBankId(banks[0].id);
        } catch (e) {
            setError(e.message || t('err.statement'));
            const code = mismatchCode(e);
            if (code !== 'STATEMENT_CLOSE_MISMATCH' && code !== 'STATEMENT_RUNNING_MISMATCH') {
                setData(null);
            } else if (e?.corporate || e?.data?.corporate) {
                setData(e.data || e);
            }
        } finally {
            setLoading(false);
        }
    }, [corporateAccountId, dateFrom, dateTo, t]);

    const loadBills = useCallback(async () => {
        if (!corporateAccountId) return;
        setBillsLoading(true);
        setBillsError('');
        try {
            const res = await getWorkshopCorporateMonthlyBills(corporateAccountId);
            setBills(Array.isArray(res?.bills) ? res.bills : []);
        } catch (e) {
            setBillsError(e.message || t('err.bills'));
            setBills([]);
        } finally {
            setBillsLoading(false);
        }
    }, [corporateAccountId, t]);

    const downloadBillPdf = async (bill) => {
        const detail = bill?.statement ? bill : billDetail?.id === bill?.id ? billDetail : null;
        let payload = detail;
        if (!payload?.statement && corporateAccountId && bill?.id) {
            try {
                const res = await getWorkshopCorporateMonthlyBill(corporateAccountId, bill.id);
                payload = res?.bill || null;
                if (payload) setBillDetail(payload);
            } catch (e) {
                setBillsError(e.message || t('err.billPdf'));
                return;
            }
        }
        if (!payload) return;
        setBillPdfExporting(true);
        try {
            await exportCorporateGeneratedBillPdf({
                bill: payload,
                statement: payload.statement || {},
                ledgerStatement: payload.ledgerStatement || null,
                workshop: billWorkshopFromDetail(payload),
            });
        } catch (e) {
            setBillsError(e.message || t('err.billPdf'));
        } finally {
            setBillPdfExporting(false);
        }
    };

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        if (viewMode === 'generated-bills') loadBills();
    }, [viewMode, loadBills]);

    useEffect(() => {
        if (viewMode !== 'generated-bills' || !selectedBillId || !corporateAccountId) return;
        let cancelled = false;
        setBillDetailLoading(true);
        getWorkshopCorporateMonthlyBill(corporateAccountId, selectedBillId)
            .then((res) => {
                if (!cancelled) setBillDetail(res?.bill || null);
            })
            .catch((e) => {
                if (!cancelled) {
                    setBillsError(e.message || t('err.bills'));
                    setBillDetail(null);
                }
            })
            .finally(() => {
                if (!cancelled) setBillDetailLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [viewMode, selectedBillId, corporateAccountId, t]);

    const backToList = () => {
        navigate(`/workshop/corporate-management?dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}`);
    };

    const openDocs = useMemo(() => {
        const invoices = data?.openDocuments?.invoices || [];
        const bills = data?.openDocuments?.bills || [];
        return [...invoices, ...bills];
    }, [data]);

    const overpayPreview = useMemo(() => {
        const want = Number(amount || 0);
        if (!(want > 0)) return 0;
        const pool = fifo
            ? openDocs
            : openDocs.filter((d) => picked.includes(d.id));
        const remaining = pool.reduce((s, d) => s + Number(d.remaining || 0), 0);
        return Math.max(0, want - remaining);
    }, [amount, fifo, openDocs, picked]);

    const postReceipt = async () => {
        setPosting(true);
        setPostError('');
        try {
            await postWorkshopCorporateReceipt(corporateAccountId, {
                amount: Number(amount || 0).toFixed(2),
                date: receiptDate,
                cashBankAccountId: cashBankId,
                allocationIds: fifo ? undefined : picked,
            });
            setAmount('');
            await load();
        } catch (e) {
            setPostError(e.message || t('err.receipt'));
        } finally {
            setPosting(false);
        }
    };

    const download = async (format) => {
        try {
            if (format === 'xlsx') exportWorkshopCorporateStatementExcel(data);
            else await exportWorkshopCorporateStatementPdf(data);
        } catch (e) {
            setError(e.message || t('err.export'));
        }
    };

    const corp = data?.corporate || {};
    const summary = data?.summary || {};
    const lines = Array.isArray(data?.lines) ? data.lines : [];
    const dir = String(locale).startsWith('ar') ? 'rtl' : 'ltr';

    return (
        <div className="wcorp-print-root" dir={dir}>
            <BillPrintSheet bill={printBill} t={t} locale={locale} />
            <div className="wcorp-screen">
            <div className="ws-page-header">
                <div>
                    <button type="button" className="btn-portal-outline" onClick={backToList} data-testid="wcorp-stmt-back">
                        <ArrowLeft size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                        {t('stmt.back')}
                    </button>
                    <h2 className="ws-page-title" style={{ marginTop: 10 }}>
                        <BilingualName en={corp.companyNameEn} ar={corp.companyNameAr} name={corp.companyName} />
                    </h2>
                    <p className="ws-page-sub">
                        {t('th.vat')} {corp.vatNumber || t('emdash')} · {t('th.status')} {corp.status || t('emdash')} · {t('th.creditLimit')} <Money amount={corp.creditLimit} />
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        className="btn-portal-outline"
                        data-testid="wcorp-generate"
                        onClick={() => navigate(`/workshop/corporate-management/${encodeURIComponent(corporateAccountId)}/generate-bill?dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}`)}
                    >
                        {t('btn.generateBill')}
                    </button>
                    <button type="button" className="btn-portal-outline" onClick={() => download('pdf')} disabled={!data}>
                        <Download size={14} /> {t('stmt.pdf')}
                    </button>
                    <button type="button" className="btn-portal-outline" onClick={() => download('xlsx')} disabled={!data}>
                        <Download size={14} /> {t('stmt.xlsx')}
                    </button>
                    <button
                        type="button"
                        className="btn-portal"
                        onClick={() => {
                            load();
                            if (viewMode === 'generated-bills') loadBills();
                        }}
                        disabled={loading || billsLoading}
                    >
                        <RefreshCw size={14} /> {loading || billsLoading ? t('btn.refreshing') : t('btn.refresh')}
                    </button>
                </div>
            </div>

            <CorporateDateRangeBar dateFrom={dateFrom} dateTo={dateTo} onApply={applyRange} t={t} />

            <div className="wcorp-tabs" role="tablist" data-testid="wcorp-stmt-tabs" style={{ marginTop: 12 }}>
                <button
                    type="button"
                    role="tab"
                    aria-selected={viewMode === 'statement'}
                    className={`ws-tab-btn${viewMode === 'statement' ? ' active' : ''}`}
                    data-testid="wcorp-tab-statement"
                    onClick={() => setViewMode('statement')}
                >
                    {t('btn.statement')}
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={viewMode === 'generated-bills'}
                    className={`ws-tab-btn${viewMode === 'generated-bills' ? ' active' : ''}`}
                    data-testid="wcorp-tab-bills"
                    onClick={() => setViewMode('generated-bills')}
                >
                    {t('btn.generatedBills')}
                </button>
            </div>

            {error ? (
                <div
                    className="ws-section"
                    style={{ margin: '12px 0', color: '#B91C1C' }}
                    data-testid={data?.mismatch ? 'wcorp-stmt-mismatch' : undefined}
                >
                    {error}
                </div>
            ) : null}

            {viewMode === 'generated-bills' ? (
                <GeneratedBillsPanel
                    t={t}
                    locale={locale}
                    bills={bills}
                    billsLoading={billsLoading}
                    billsError={billsError}
                    selectedBillId={selectedBillId}
                    billDetail={billDetail}
                    billDetailLoading={billDetailLoading}
                    billPdfExporting={billPdfExporting}
                    onView={(id) => setSelectedBillId(id)}
                    onPdf={downloadBillPdf}
                    onPrint={printSelectedBill}
                />
            ) : (
            <>
            <div className="ws-kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginTop: 12 }}>
                {[
                    { id: 'open', label: t('stmt.opening'), value: summary.openingBalance },
                    { id: 'inv', label: t('stmt.invoices'), value: summary.totalInvoiceAmount },
                    { id: 'rec', label: t('stmt.receipts'), value: summary.totalReceipts },
                    { id: 'ret', label: t('stmt.returns'), value: summary.totalSalesReturns },
                    { id: 'close', label: t('stmt.closing'), value: data?.statementClosing ?? summary.closingBalance },
                    { id: 'gl', label: t('stmt.gl'), value: summary.glChild },
                    { id: 'hq', label: t('kpi.dueFromHq'), value: data?.dueFromHq },
                ].map((card) => (
                    <div className="ws-kpi-card" key={card.id}>
                        <p className="ws-kpi-label">{card.label}</p>
                        <p className="ws-kpi-value"><Money amount={card.value} /></p>
                    </div>
                ))}
            </div>

            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 8 }}>{t('stmt.creditNotesNone')}</p>

            <div className="ws-section" style={{ marginTop: 16 }} data-testid="wcorp-receive">
                <h3 className="heading" style={{ fontFamily: 'Cairo, sans-serif', marginTop: 0 }}>{t('stmt.receive')}</h3>
                {(data?.hqOwnedAssigned || []).length ? (
                    <p data-testid="wcorp-hq-owned" style={{ fontSize: '0.8125rem', color: '#B45309' }}>
                        {t('stmt.hqOwned')}
                    </p>
                ) : null}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
                    <label className="ws-reports-field">
                        <span className="ws-reports-field__label">{t('stmt.amount')}</span>
                        <input className="ws-reports-field__control" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
                    </label>
                    <label className="ws-reports-field">
                        <span className="ws-reports-field__label">{t('date.from')}</span>
                        <input className="ws-reports-field__control" type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} />
                    </label>
                    <label className="ws-reports-field">
                        <span className="ws-reports-field__label">{t('stmt.cashBank')}</span>
                        <select className="ws-reports-field__control" value={cashBankId} onChange={(e) => setCashBankId(e.target.value)}>
                            {(data?.operatingCashBanks || []).map((b) => (
                                <option key={b.id} value={b.id}>{b.code} — {b.name}</option>
                            ))}
                        </select>
                    </label>
                    <label style={{ fontSize: '0.8125rem' }}>
                        <input type="checkbox" checked={fifo} onChange={(e) => setFifo(e.target.checked)} /> {t('stmt.fifo')}
                    </label>
                    <button type="button" className="btn-portal" onClick={postReceipt} disabled={posting || !amount || !cashBankId}>
                        {posting ? t('stmt.posting') : t('stmt.post')}
                    </button>
                </div>
                {overpayPreview > 0.005 ? (
                    <p style={{ marginTop: 8, fontSize: '0.8125rem' }}>{t('stmt.overpay')}: <Money amount={overpayPreview} /></p>
                ) : null}
                {!fifo ? (
                    <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {openDocs.map((d) => (
                            <label key={d.id} style={{ fontSize: '0.75rem' }}>
                                <input
                                    type="checkbox"
                                    checked={picked.includes(d.id)}
                                    onChange={(e) => {
                                        setPicked((prev) => e.target.checked ? [...prev, d.id] : prev.filter((x) => x !== d.id));
                                    }}
                                /> {d.kind} {d.id} ({money2(d.remaining)})
                            </label>
                        ))}
                    </div>
                ) : null}
                {postError ? <p style={{ color: '#B91C1C' }}>{postError}</p> : null}
            </div>

            <div className="wcorp-table-wrap" style={{ marginTop: 16 }}>
                <table className="ws-table wcorp-table">
                    <thead>
                        <tr>
                            <th>{t('th.date')}</th>
                            <th>{t('th.type')}</th>
                            <th>{t('th.ref')}</th>
                            <th>{t('th.debit')}</th>
                            <th>{t('th.credit')}</th>
                            <th>{t('th.running')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && lines.length === 0 ? (
                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24 }}>{t('btn.refreshing')}</td></tr>
                        ) : lines.length === 0 ? (
                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24 }}>{t('stmt.empty')}</td></tr>
                        ) : lines.map((line) => (
                            <tr key={line.id}>
                                <td>{line.date}</td>
                                <td>{line.type}</td>
                                <td>{line.ref}</td>
                                <td><Money amount={line.debit} /></td>
                                <td><Money amount={line.credit} /></td>
                                <td><Money amount={line.running} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            </>
            )}
            </div>
        </div>
    );
}

function BillPrintSheet({ bill, t, locale }) {
    if (!bill) return null;
    const dir = String(locale).startsWith('ar') ? 'rtl' : 'ltr';
    return (
        <article className="wcorp-print-sheet" dir={dir} lang={dir === 'rtl' ? 'ar' : 'en'} data-testid="wcorp-bill-print">
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@600;700&family=Noto+Naskh+Arabic:wght@400;700&display=swap');
.wcorp-print-sheet { font-family: "Noto Naskh Arabic", serif; }
.wcorp-print-sheet .heading { font-family: Cairo, sans-serif; font-weight: 700; }`}</style>
            <h1 className="heading">{bill.billNo}</h1>
            <p>
                {billStatusLabel(bill.status, t, bill.collectionOwner)}
                {' · '}
                {billOwnerLabel(bill.collectionOwner, t)}
            </p>
            {(() => {
                const seller = resolveBillSeller(bill, bill.statement?.corporateAccount, billWorkshopFromDetail(bill));
                return (
                    <p data-testid="wcorp-bill-seller">
                        {t('th.seller')} <strong>{dir === 'rtl' ? seller.nameAr || seller.nameEn : seller.nameEn || seller.nameAr}</strong>
                        {seller.vatNumber ? ` · ${t('th.sellerVat')} ${seller.vatNumber}` : ''}
                    </p>
                );
            })()}
            <p>{t('th.period')} {bill.periodStartDate} — {bill.periodEndDate}</p>
            <p>{t('th.dueDate')} <strong>{bill.dueDate}</strong></p>
            <p>{t('th.dueBalance')} <Money amount={bill.kpis?.balance ?? bill.balance} /></p>
            <p>{t('th.created')} {formatBillCreated(bill.createdAt, locale)}</p>
        </article>
    );
}

function GeneratedBillsPanel({
    t,
    locale,
    bills,
    billsLoading,
    billsError,
    selectedBillId,
    billDetail,
    billDetailLoading,
    billPdfExporting,
    onView,
    onPdf,
    onPrint,
}) {
    return (
        <div className="ws-section" style={{ marginTop: 16 }} data-testid="wcorp-bills">
            {billsError ? <p style={{ color: '#B91C1C' }}>{billsError}</p> : null}
            <div className="wcorp-table-wrap">
                {!billsLoading && bills.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 24 }}>
                        <div style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}>{t('empty.bills')}</div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{t('empty.billsHint')}</div>
                    </div>
                ) : (
                    <table className="ws-table wcorp-table">
                        <thead>
                            <tr>
                                <th>{t('th.billNo')}</th>
                                <th>{t('th.period')}</th>
                                <th>{t('th.dueDate')}</th>
                                <th>{t('th.status')}</th>
                                <th>{t('th.dueBalance')}</th>
                                <th>{t('th.created')}</th>
                                <th>{t('th.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {billsLoading ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: 24 }}>{t('btn.refreshing')}</td>
                                </tr>
                            ) : bills.map((b) => (
                                <tr
                                    key={b.id}
                                    aria-selected={selectedBillId === String(b.id)}
                                    onClick={() => onView(b.id)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <td style={{ fontWeight: 700, fontFamily: 'Cairo, sans-serif' }}>{b.billNo}</td>
                                    <td>{b.periodStartDate} — {b.periodEndDate}</td>
                                    <td>{b.dueDate}</td>
                                    <td>
                                        <span className="ui-pill ui-pill--neutral">
                                            {billStatusLabel(b.status, t, b.collectionOwner)}
                                        </span>
                                        <span
                                            className="ui-pill ui-pill--neutral"
                                            data-testid="wcorp-owner-chip"
                                            style={{ marginInlineStart: 6 }}
                                        >
                                            {billOwnerLabel(b.collectionOwner, t)}
                                        </span>
                                    </td>
                                    <td><Money amount={b.kpis?.balance} /></td>
                                    <td>{formatBillCreated(b.createdAt, locale)}</td>
                                    <td onClick={(e) => e.stopPropagation()}>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                            <button type="button" className="btn-portal-outline" onClick={() => onView(b.id)}>
                                                <Eye size={14} /> {t('btn.view')}
                                            </button>
                                            <button
                                                type="button"
                                                className="btn-portal-outline"
                                                disabled={billPdfExporting}
                                                onClick={() => onPdf(b)}
                                            >
                                                <FileText size={14} /> {t('btn.downloadPdf')}
                                            </button>
                                            <button type="button" className="btn-portal-outline" onClick={() => onPrint(b)}>
                                                <Printer size={14} /> {t('btn.print')}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {selectedBillId ? (
                <div className="ws-section" style={{ marginTop: 16 }} data-testid="wcorp-bill-view">
                    {billDetailLoading ? (
                        <p>{t('btn.refreshing')}</p>
                    ) : billDetail ? (
                        <>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                                <h3 className="heading" style={{ fontFamily: 'Cairo, sans-serif', margin: 0 }}>
                                    {billDetail.billNo}
                                </h3>
                                <span className="ui-pill ui-pill--neutral">
                                    {billStatusLabel(billDetail.status, t, billDetail.collectionOwner)}
                                </span>
                                <span className="ui-pill ui-pill--neutral" data-testid="wcorp-owner-chip">
                                    {billOwnerLabel(billDetail.collectionOwner, t)}
                                </span>
                                <span style={{ fontSize: '0.8125rem' }}>
                                    {t('th.dueDate')} <strong>{billDetail.dueDate}</strong>
                                </span>
                                <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    <button
                                        type="button"
                                        className="btn-portal-outline"
                                        disabled={billPdfExporting}
                                        onClick={() => onPdf(billDetail)}
                                    >
                                        <FileText size={14} /> {t('btn.downloadPdf')}
                                    </button>
                                    <button type="button" className="btn-portal-outline" onClick={() => onPrint(billDetail)}>
                                        <Printer size={14} /> {t('btn.print')}
                                    </button>
                                </div>
                            </div>
                            <div
                                className="ws-kpi-grid"
                                style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginTop: 12 }}
                            >
                                <div className="ws-kpi-card">
                                    <p className="ws-kpi-label">{t('th.period')}</p>
                                    <p className="ws-kpi-value" style={{ fontSize: '1rem' }}>
                                        {billDetail.periodStartDate} — {billDetail.periodEndDate}
                                    </p>
                                </div>
                                <div className="ws-kpi-card">
                                    <p className="ws-kpi-label">{t('th.dueBalance')}</p>
                                    <p className="ws-kpi-value"><Money amount={billDetail.kpis?.balance} /></p>
                                </div>
                                <div className="ws-kpi-card">
                                    <p className="ws-kpi-label">{t('th.created')}</p>
                                    <p className="ws-kpi-value" style={{ fontSize: '1rem' }}>
                                        {formatBillCreated(billDetail.createdAt, locale)}
                                    </p>
                                </div>
                            </div>
                        </>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
