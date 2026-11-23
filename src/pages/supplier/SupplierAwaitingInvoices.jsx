import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cancelSupplierInvoices, listAwaitingWorkshopInvoices } from '../../services/supplierApi';
import { sawT } from '../../utils/supplierAwaitingInvoicesI18n';
import { SUPPLIER_PERM, useSupplierCan } from '../../utils/supplierPermissions';
import './supplierPortal.css';

/**
 * /supplier/sales_invoices/awaiting — invoices the workshop has not accepted yet.
 * Full page (no modal): select one or many → server review (dry run) → confirm.
 * Each invoice is cancelled in its own server transaction; nothing is posted
 * because nothing was ever posted for it.
 */

const PAGE = 50;
const money = (n) =>
    (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dmy = (ymd) => {
    const [y, m, d] = String(ymd || '').slice(0, 10).split('-');
    return y && m && d ? `${d}/${m}/${y}` : '—';
};

export default function SupplierAwaitingInvoices({ locale = 'en' }) {
    const t = useCallback((k, v) => sawT(locale, k, v), [locale]);
    const navigate = useNavigate();
    const can = useSupplierCan();
    const canPost = can(SUPPLIER_PERM.salesPost);

    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [totalAmount, setTotalAmount] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [applied, setApplied] = useState('');
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    // id -> { invoiceNo, grandTotal } (kept across pages)
    const [picked, setPicked] = useState(() => {
        const pre = new URLSearchParams(window.location.search).get('select');
        return pre ? { [pre]: { invoiceNo: '', grandTotal: 0 } } : {};
    });
    const [reason, setReason] = useState('');
    const [review, setReview] = useState(null);
    const [done, setDone] = useState(null);
    const [busy, setBusy] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const res = await listAwaitingWorkshopInvoices({ limit: PAGE, offset: (page - 1) * PAGE, search: applied || undefined });
            const list = Array.isArray(res?.invoices) ? res.invoices : Array.isArray(res?.data?.invoices) ? res.data.invoices : [];
            setRows(list);
            setTotal(Number(res?.total ?? res?.data?.total ?? 0));
            setTotalAmount(Number(res?.totalAmount ?? res?.data?.totalAmount ?? 0));
            // Fill in details for a pre-selected id coming from the invoice list.
            setPicked((p) => {
                const next = { ...p };
                for (const r of list) if (next[r.id]) next[r.id] = { invoiceNo: r.invoiceNo, grandTotal: r.grandTotal };
                return next;
            });
        } catch (e) {
            setErr(e?.message || t('err.generic'));
        } finally {
            setLoading(false);
        }
    }, [page, applied, t]);

    useEffect(() => {
        load();
    }, [load]);

    const pickedIds = Object.keys(picked);
    const pages = Math.max(1, Math.ceil(total / PAGE));
    const pickedAmount = useMemo(() => pickedIds.reduce((s, id) => s + Number(picked[id]?.grandTotal || 0), 0), [picked, pickedIds]);

    const toggle = (r) => {
        setReview(null);
        setDone(null);
        setPicked((p) => {
            const next = { ...p };
            if (next[r.id]) delete next[r.id];
            else next[r.id] = { invoiceNo: r.invoiceNo, grandTotal: r.grandTotal };
            return next;
        });
    };

    const runReview = async () => {
        if (!pickedIds.length) return setErr(t('err.pick'));
        setBusy('review');
        setErr('');
        setDone(null);
        try {
            const res = await cancelSupplierInvoices({ invoiceIds: pickedIds, dryRun: true });
            setReview(res?.results ? res : res?.data || res);
            setTimeout(() => document.getElementById('saw-review')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
        } catch (e) {
            setErr(e?.message || t('err.generic'));
        } finally {
            setBusy('');
        }
    };

    const confirm = async () => {
        if (reason.trim().length < 3) return setErr(t('err.reason'));
        const okIds = (review?.results || []).filter((r) => r.ok).map((r) => r.invoiceId);
        if (!okIds.length) return;
        setBusy('post');
        setErr('');
        try {
            const res = await cancelSupplierInvoices({ invoiceIds: okIds, reason: reason.trim() });
            setDone(res?.results ? res : res?.data || res);
            setReview(null);
            setPicked({});
            setReason('');
            await load();
            window.scrollTo?.({ top: 0, behavior: 'smooth' });
        } catch (e) {
            setErr(e?.message || t('err.generic'));
        } finally {
            setBusy('');
        }
    };

    const blocked = (review?.results || []).filter((r) => !r.ok);
    const okCount = (review?.results || []).filter((r) => r.ok).length;

    return (
        <div className="sp-gr-page" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
            <button type="button" className="sp-gr-link-btn" onClick={() => navigate('/supplier/sales_invoices')}>
                {t('back')}
            </button>
            <div className="sp-gr-head">
                <div>
                    <h2 className="sp-gr-title">{t('title')}</h2>
                    <p className="sp-gr-sub" style={{ maxWidth: 980 }}>{t('sub')}</p>
                </div>
            </div>

            {done ? (
                <div className={done.failed ? 'sp-gr-error' : 'sp-gr-ok'}>
                    <div>{t('done.ok', { n: done.cancelled, r: done.returnsCancelled, amt: money(done.releasedAmount) })}</div>
                    {done.failed ? (
                        <div style={{ marginTop: 6 }}>
                            {t('done.failed', { n: done.failed })}{' '}
                            {(done.results || []).filter((r) => !r.ok).map((r) => `${r.invoiceNo || r.invoiceId}: ${r.message}`).join(' · ')}
                        </div>
                    ) : null}
                </div>
            ) : null}
            {err ? <div className="sp-gr-error">{err}</div> : null}

            <div className="sp-gr-kpis">
                <div className="sp-gr-kpi">
                    <div className="sp-gr-kpi-label">{t('kpi.count')}</div>
                    <div className="sp-gr-kpi-value">{loading ? '…' : total}</div>
                </div>
                <div className="sp-gr-kpi">
                    <div className="sp-gr-kpi-label">{t('kpi.amount')}</div>
                    <div className="sp-gr-kpi-value">{loading ? '…' : `SAR ${money(totalAmount)}`}</div>
                </div>
                <div className="sp-gr-kpi">
                    <div className="sp-gr-kpi-label">{t('kpi.selected')}</div>
                    <div className="sp-gr-kpi-value">
                        {pickedIds.length} · SAR {money(pickedAmount)}
                    </div>
                </div>
            </div>

            <div className="sp-gr-card">
                <div className="sp-gr-filters">
                    <label style={{ flex: '1 1 320px' }}>
                        <input
                            value={search}
                            placeholder={t('search')}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    setPage(1);
                                    setApplied(search.trim());
                                }
                            }}
                        />
                    </label>
                    <button type="button" className="btn-portal-outline" onClick={() => { setPage(1); setApplied(search.trim()); }}>
                        {t('btn.search')}
                    </button>
                    <button
                        type="button"
                        className="btn-portal-outline"
                        disabled={loading || !rows.some((r) => r.cancellable)}
                        onClick={() => {
                            setReview(null);
                            setPicked((p) => {
                                const next = { ...p };
                                for (const r of rows) if (r.cancellable) next[r.id] = { invoiceNo: r.invoiceNo, grandTotal: r.grandTotal };
                                return next;
                            });
                        }}
                    >
                        {t('btn.selectPage')}
                    </button>
                    {pickedIds.length ? (
                        <button type="button" className="btn-portal-outline" onClick={() => { setPicked({}); setReview(null); }}>
                            {t('btn.clear')}
                        </button>
                    ) : null}
                    <button
                        type="button"
                        className="btn-portal"
                        disabled={!canPost || !pickedIds.length || Boolean(busy)}
                        onClick={runReview}
                    >
                        {busy === 'review' ? t('loading') : t('btn.review', { n: pickedIds.length })}
                    </button>
                </div>

                {loading ? (
                    <div className="sp-gr-muted">{t('loading')}</div>
                ) : rows.length === 0 ? (
                    <div className="sp-gr-ok">{t('empty')}</div>
                ) : (
                    <div className="sp-gr-table-wrap">
                        <table className="ws-table sp-gr-table">
                            <thead>
                                <tr>
                                    <th>{t('th.select')}</th>
                                    <th>{t('th.invoice')}</th>
                                    <th>{t('th.date')}</th>
                                    <th>{t('th.customer')}</th>
                                    <th>{t('th.items')}</th>
                                    <th className="num">{t('th.amount')}</th>
                                    <th>{t('th.returns')}</th>
                                    <th>{t('th.state')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => (
                                    <tr key={r.id} style={picked[r.id] ? { background: '#FFFBEB' } : undefined}>
                                        <td>
                                            <input
                                                type="checkbox"
                                                aria-label={`${t('th.select')} ${r.invoiceNo}`}
                                                checked={Boolean(picked[r.id])}
                                                disabled={!r.cancellable || !canPost}
                                                onChange={() => toggle(r)}
                                            />
                                        </td>
                                        <td className="sp-gr-strong">
                                            {r.invoiceNo}
                                            {r.status && r.status !== 'pending_payment' && r.status !== 'overdue' ? (
                                                <div>
                                                    <span className="sp-gr-pill" style={{ background: '#F1F5F9', color: '#334155' }}>
                                                        {t(`status.${r.status}`)}
                                                    </span>
                                                </div>
                                            ) : null}
                                        </td>
                                        <td>{dmy(r.invoiceDate)}</td>
                                        <td>
                                            {r.workshopName || '—'}
                                            {r.branchName ? <div className="sp-gr-hint">{r.branchName}</div> : null}
                                        </td>
                                        <td>
                                            {r.firstItem || '—'}
                                            {r.itemsCount > 1 ? <span className="sp-gr-hint"> {t('more', { n: r.itemsCount - 1 })}</span> : null}
                                        </td>
                                        <td className="num sp-gr-strong">SAR {money(r.grandTotal)}</td>
                                        <td>
                                            {r.returns?.length
                                                ? r.returns.map((x) => (
                                                      <div key={x.id}>
                                                          {x.returnNo} · SAR {money(x.grandTotal)}{' '}
                                                          <span className={`sp-gr-pill`} style={{ background: x.posted ? '#FEE2E2' : String(x.status).toLowerCase() === 'cancelled' ? '#F1F5F9' : '#FEF3C7', color: x.posted ? '#B91C1C' : '#92400E' }}>
                                                              {x.posted ? t('returnPosted') : String(x.status).toLowerCase() === 'cancelled' ? x.status : t('returnPending')}
                                                          </span>
                                                      </div>
                                                  ))
                                                : t('noReturns')}
                                        </td>
                                        <td>
                                            {r.cancellable ? (
                                                <span className="sp-gr-pill" style={{ background: '#ECFDF5', color: '#065F46' }}>{t('yes')}</span>
                                            ) : (
                                                <span className="sp-gr-hint" style={{ color: '#B91C1C' }}>{r.blockerMessage}</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {pages > 1 ? (
                    <div className="sp-gr-line-foot" style={{ justifyContent: 'flex-end' }}>
                        <button type="button" className="btn-portal-outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                            {t('btn.prev')}
                        </button>
                        <span className="sp-gr-hint">{t('page', { page, pages, total })}</span>
                        <button type="button" className="btn-portal-outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                            {t('btn.next')}
                        </button>
                    </div>
                ) : null}
            </div>

            {review ? (
                <div className="sp-gr-card" id="saw-review">
                    <h3 className="sp-gr-h3">{t('review.title')}</h3>
                    {okCount ? (
                        <div className="sp-gr-ok">
                            {t('review.ok', { n: review.cancelled ?? okCount, r: review.returnsCancelled ?? 0, amt: money(review.releasedAmount) })}
                            <div className="sp-gr-hint" style={{ marginTop: 4 }}>{t('review.je')}</div>
                        </div>
                    ) : null}
                    {blocked.length ? (
                        <div className="sp-gr-error">
                            {t('review.blocked', { n: blocked.length })}
                            <ul style={{ margin: '6px 0 0', paddingInlineStart: 18 }}>
                                {blocked.map((b) => (
                                    <li key={b.invoiceId}>
                                        {b.invoiceNo || b.invoiceId}: {b.message}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : null}
                    {okCount ? (
                        <>
                            <div className="sp-gr-form-grid">
                                <label className="sp-gr-span2">
                                    {t('reason')}
                                    <input value={reason} maxLength={500} placeholder={t('reasonPh')} onChange={(e) => setReason(e.target.value)} />
                                </label>
                            </div>
                            <div className="sp-gr-line-foot">
                                <button
                                    type="button"
                                    className="btn-portal"
                                    style={{ background: '#DC2626', borderColor: '#DC2626', color: '#fff' }}
                                    disabled={Boolean(busy) || reason.trim().length < 3}
                                    onClick={confirm}
                                >
                                    {busy === 'post' ? t('loading') : t('btn.confirm', { n: okCount })}
                                </button>
                                <button type="button" className="btn-portal-outline" disabled={Boolean(busy)} onClick={() => setReview(null)}>
                                    {t('btn.edit')}
                                </button>
                            </div>
                        </>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
