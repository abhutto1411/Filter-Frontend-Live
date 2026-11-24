import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import MultiSelectSearchCombo from '../../components/MultiSelectSearchCombo';
import { useAuth } from '../../context/AuthContext';
import {
    getWorkshopStockCount,
    getWorkshopStockCountSheet,
    listWorkshopStockCounts,
    postWorkshopStockCount,
    unwrap,
} from '../../services/workshopStockApi';
import { exportRowsToExcel, exportRowsToPdf } from '../../utils/tableExport';
import '../../styles/theme-segmented.css';
import './workshopStock.css';

/**
 * Workshop physical count / "Make zero" — full pages inside Manage Inventory (no modals).
 *   ?view=counts                 saved counts (history, branch + Riyadh date filters)
 *   ?view=counts&count=new       pick products, count or zero, server review, post
 *   ?view=counts&count=<id>      one saved count — lines, totals, journal proof, PDF / Excel
 * Every post is ONE server transaction and ONE balanced journal at purchase cost.
 */

const round3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;
const money2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const qtyFmt = (n) => round3(n).toLocaleString('en-US', { maximumFractionDigits: 3 });
const fixed2 = (n) => money2(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const parseQty = (raw) => {
    const s = String(raw ?? '').replace(/,/g, '').trim();
    if (s === '') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
};
export const riyadhDateTime = (iso) => {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString('en-GB', {
            timeZone: 'Asia/Riyadh',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return String(iso);
    }
};

function Money({ value, t, signed = false }) {
    const v = money2(value);
    const cls = signed ? (v < 0 ? 'wsk-neg' : v > 0 ? 'wsk-pos' : '') : '';
    return <span className={cls}>{t('common.sar', { amount: fixed2(v) })}</span>;
}

export default function WorkshopStockCountScreen({ t, branchId, branchName, workshopId }) {
    const [params] = useSearchParams();
    const count = params.get('count');
    if (!count) return <CountList t={t} branchId={branchId} branchName={branchName} workshopId={workshopId} />;
    if (count === 'new') return <CountForm t={t} branchId={branchId} branchName={branchName} workshopId={workshopId} />;
    return <CountDetail key={count} id={count} t={t} workshopId={workshopId} />;
}

function useCountNav() {
    const [params, setParams] = useSearchParams();
    return useCallback(
        (count, state) => {
            const next = new URLSearchParams(params);
            next.set('view', 'counts');
            if (count) next.set('count', count);
            else next.delete('count');
            if (state?.justPosted) next.set('posted', '1');
            else next.delete('posted');
            setParams(next);
            window.scrollTo?.({ top: 0, behavior: 'smooth' });
        },
        [params, setParams],
    );
}

/* ═══════════════════════════════ HISTORY ═══════════════════════════════ */

function CountList({ t, branchId, branchName, workshopId }) {
    const go = useCountNav();
    const { hasPermission } = useAuth();
    const canPost = hasPermission('workshop.inventory.manual-adjust');
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [sums, setSums] = useState({ valueOut: 0, valueIn: 0, netChange: 0 });
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [page, setPage] = useState(1);
    const pageSize = 50;

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setErr('');
            try {
                const res = unwrap(
                    await listWorkshopStockCounts({
                        branchId,
                        dateFrom,
                        dateTo,
                        limit: pageSize,
                        offset: (page - 1) * pageSize,
                        workshopId,
                    }),
                );
                if (cancelled) return;
                setRows(Array.isArray(res?.counts) ? res.counts : []);
                setTotal(Number(res?.total) || 0);
                setSums(res?.totals || { valueOut: 0, valueIn: 0, netChange: 0 });
            } catch (e) {
                if (!cancelled) setErr(e?.message || t('common.err'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [branchId, dateFrom, dateTo, page, workshopId, t]);

    const pages = Math.max(1, Math.ceil(total / pageSize));
    const badRange = dateFrom && dateTo && dateFrom > dateTo;

    return (
        <>
            <div className="wsk-head">
                <div>
                    <h2 className="wsk-title">{t('count.listTitle')}</h2>
                    <p className="wsk-sub">
                        {t('count.listSub')} · {t('common.branch')}: <b>{branchName || '—'}</b>
                    </p>
                </div>
                <div className="wsk-actions">
                    <button
                        type="button"
                        className="wsk-btn"
                        disabled={!canPost || !branchId}
                        title={canPost ? undefined : t('count.permDenied')}
                        onClick={() => go('new')}
                    >
                        {t('count.new')}
                    </button>
                </div>
            </div>
            {!canPost ? <div className="wsk-note">{t('count.permDenied')}</div> : null}
            {err ? <div className="wsk-error">{err}</div> : null}
            <div className="wsk-filters">
                <label>
                    {t('common.from')}
                    <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
                </label>
                <label>
                    {t('common.to')}
                    <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
                </label>
                {dateFrom || dateTo ? (
                    <button type="button" className="wsk-btn-outline" onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); }}>
                        {t('common.clear')}
                    </button>
                ) : null}
                {badRange ? <span className="wsk-error" style={{ margin: 0 }}>{t('common.from')} &gt; {t('common.to')}</span> : null}
            </div>
            <div className="wsk-kpis">
                <div className="wsk-kpi">
                    <div className="wsk-kpi-label">{t('count.kpi.documents')}</div>
                    <div className="wsk-kpi-value">{loading ? '…' : total}</div>
                </div>
                <div className="wsk-kpi">
                    <div className="wsk-kpi-label">{t('count.kpi.writtenDown')}</div>
                    <div className="wsk-kpi-value">{loading ? '…' : <Money t={t} value={sums.valueOut} />}</div>
                </div>
                <div className="wsk-kpi">
                    <div className="wsk-kpi-label">{t('count.kpi.found')}</div>
                    <div className="wsk-kpi-value">{loading ? '…' : <Money t={t} value={sums.valueIn} />}</div>
                </div>
                <div className="wsk-kpi">
                    <div className="wsk-kpi-label">{t('count.kpi.net')}</div>
                    <div className="wsk-kpi-value">{loading ? '…' : <Money t={t} signed value={sums.netChange} />}</div>
                </div>
            </div>
            <div className="wsk-card">
                {loading ? (
                    <div className="wsk-muted">{t('common.loading')}</div>
                ) : rows.length === 0 ? (
                    <div className="wsk-muted">{t('count.empty')}</div>
                ) : (
                    <div className="wsk-table-wrap">
                        <table className="ws-table wsk-table">
                            <thead>
                                <tr>
                                    <th>{t('count.th.no')}</th>
                                    <th>{t('count.th.date')}</th>
                                    <th>{t('count.th.type')}</th>
                                    <th>{t('common.branch')}</th>
                                    <th className="num">{t('count.th.lines')}</th>
                                    <th className="num">{t('count.kpi.writtenDown')}</th>
                                    <th className="num">{t('count.kpi.found')}</th>
                                    <th className="num">{t('count.th.net')}</th>
                                    <th>{t('count.th.journal')}</th>
                                    <th>{t('count.th.by')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => (
                                    <tr
                                        key={r.id}
                                        className="wsk-row"
                                        tabIndex={0}
                                        onClick={() => go(r.id)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') go(r.id);
                                        }}
                                    >
                                        <td className="wsk-strong">{r.countNo}</td>
                                        <td>{riyadhDateTime(r.createdAt)}</td>
                                        <td>{t(`count.mode.${r.mode}`)}</td>
                                        <td>{r.branchName || '—'}</td>
                                        <td className="num">{r.linesChanged}</td>
                                        <td className="num"><Money t={t} value={r.valueOut} /></td>
                                        <td className="num"><Money t={t} value={r.valueIn} /></td>
                                        <td className="num"><Money t={t} signed value={r.netChange} /></td>
                                        <td>{r.journalEntryNumber || '—'}</td>
                                        <td>{r.createdByName || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {pages > 1 ? (
                    <div className="wsk-pager">
                        <button type="button" className="wsk-btn-outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                            {t('common.prev')}
                        </button>
                        <span>{t('common.pageOf', { page, pages })}</span>
                        <button type="button" className="wsk-btn-outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                            {t('common.next')}
                        </button>
                    </div>
                ) : null}
            </div>
        </>
    );
}

/* ═══════════════════════════════ DETAIL ═══════════════════════════════ */

function CountDetail({ id, t, workshopId }) {
    const go = useCountNav();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const justPosted = params.get('posted') === '1';
    const [count, setCount] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setErr('');
            try {
                const res = unwrap(await getWorkshopStockCount(id, { workshopId }));
                if (!cancelled) setCount(res?.count || null);
            } catch (e) {
                if (!cancelled) setErr(e?.message || t('common.err'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [id, workshopId, t]);

    const exportData = () => {
        const headers = [
            t('count.th.product'),
            t('count.th.sku'),
            t('count.th.unit'),
            t('count.th.system'),
            t('count.th.counted'),
            t('count.th.diff'),
            t('count.th.cost'),
            t('count.th.source'),
            t('count.th.diffValue'),
        ];
        const rows = (count?.lines || []).map((l) => [
            l.productName,
            l.sku || '',
            l.unit || '',
            round3(l.systemQty),
            round3(l.countedQty),
            round3(l.deltaQty),
            Number(l.unitCost || 0).toFixed(4),
            t(`count.src.${l.costSource}`),
            money2(l.value).toFixed(2),
        ]);
        rows.push([t('common.total'), '', '', '', '', '', '', '', money2(count?.netChange).toFixed(2)]);
        return { headers, rows };
    };
    const subtitle = count
        ? [
              `${t('count.th.date')}: ${riyadhDateTime(count.createdAt)} (Asia/Riyadh)`,
              `${t('count.th.type')}: ${t(`count.mode.${count.mode}`)}`,
              `${t('common.branch')}: ${count.branchName || '—'}`,
              `${t('count.kpi.writtenDown')}: SAR ${money2(count.valueOut).toFixed(2)}`,
              `${t('count.kpi.found')}: SAR ${money2(count.valueIn).toFixed(2)}`,
              `${t('count.th.net')}: SAR ${money2(count.netChange).toFixed(2)}`,
              `${t('count.th.journal')}: ${count.journalEntryNumber || '—'}`,
              count.notes ? `${t('count.notes')}: ${count.notes}` : '',
          ]
              .filter(Boolean)
              .join(' · ')
        : '';

    if (loading) return <div className="wsk-muted">{t('common.loading')}</div>;
    if (err || !count) {
        return (
            <>
                <button type="button" className="wsk-link-btn" onClick={() => go(null)}>
                    {t('count.backList')}
                </button>
                <div className="wsk-error">{err || t('common.err')}</div>
            </>
        );
    }
    const jeDr = (count.journalLines || []).reduce((s, l) => s + Number(l.debit || 0), 0);
    const jeCr = (count.journalLines || []).reduce((s, l) => s + Number(l.credit || 0), 0);

    return (
        <>
            <button type="button" className="wsk-link-btn" onClick={() => go(null)}>
                {t('count.backList')}
            </button>
            {justPosted ? <div className="wsk-ok">{t('count.postedOk', { no: count.countNo })}</div> : null}
            <div className="wsk-head">
                <div>
                    <h2 className="wsk-title">{count.countNo}</h2>
                    <p className="wsk-sub">
                        {t(`count.mode.${count.mode}`)} · {count.branchName || '—'} · {riyadhDateTime(count.createdAt)} ·{' '}
                        {count.createdByName || '—'}
                    </p>
                </div>
                <div className="wsk-actions">
                    <button
                        type="button"
                        className="wsk-btn-outline"
                        onClick={() => {
                            const { headers, rows } = exportData();
                            exportRowsToPdf({
                                title: `${t('count.listTitle')} — ${count.countNo}`,
                                subtitle,
                                headers,
                                rows,
                                filenameBase: `workshop-stock-count-${count.countNo}`,
                            });
                        }}
                    >
                        {t('common.pdf')}
                    </button>
                    <button
                        type="button"
                        className="wsk-btn-outline"
                        onClick={() => {
                            const { headers, rows } = exportData();
                            exportRowsToExcel({
                                sheetName: count.countNo,
                                headers,
                                rows,
                                filenameBase: `workshop-stock-count-${count.countNo}`,
                            });
                        }}
                    >
                        {t('common.excel')}
                    </button>
                    {count.journalId ? (
                        <button
                            type="button"
                            className="wsk-btn-outline"
                            onClick={() => navigate(`/workshop/accounting/journal-entries?journal=${encodeURIComponent(count.journalId)}`)}
                        >
                            {t('count.viewJe')} {count.journalEntryNumber ? `· ${count.journalEntryNumber}` : ''}
                        </button>
                    ) : null}
                </div>
            </div>
            {count.notes ? <div className="wsk-note">{count.notes}</div> : null}
            <div className="wsk-kpis">
                <div className="wsk-kpi">
                    <div className="wsk-kpi-label">{t('count.th.lines')}</div>
                    <div className="wsk-kpi-value">{count.linesChanged}</div>
                </div>
                <div className="wsk-kpi">
                    <div className="wsk-kpi-label">{t('count.kpi.writtenDown')}</div>
                    <div className="wsk-kpi-value"><Money t={t} value={count.valueOut} /></div>
                </div>
                <div className="wsk-kpi">
                    <div className="wsk-kpi-label">{t('count.kpi.found')}</div>
                    <div className="wsk-kpi-value"><Money t={t} value={count.valueIn} /></div>
                </div>
                <div className="wsk-kpi">
                    <div className="wsk-kpi-label">{t('count.th.net')}</div>
                    <div className="wsk-kpi-value"><Money t={t} signed value={count.netChange} /></div>
                </div>
            </div>
            <div className="wsk-card">
                <div className="wsk-table-wrap">
                    <table className="ws-table wsk-table">
                        <thead>
                            <tr>
                                <th>{t('count.th.product')}</th>
                                <th className="num">{t('count.th.system')}</th>
                                <th className="num">{t('count.th.counted')}</th>
                                <th className="num">{t('count.th.diff')}</th>
                                <th className="num">{t('count.th.cost')}</th>
                                <th>{t('count.th.source')}</th>
                                <th className="num">{t('count.th.diffValue')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(count.lines || []).map((l) => (
                                <tr key={l.id}>
                                    <td>
                                        <div className="wsk-strong">{l.productName}</div>
                                        {l.sku ? <div className="wsk-hint">{l.sku}</div> : null}
                                    </td>
                                    <td className="num">
                                        {qtyFmt(l.systemQty)} <span className="wsk-hint">{l.unit || ''}</span>
                                    </td>
                                    <td className="num">{qtyFmt(l.countedQty)}</td>
                                    <td className="num">{`${l.deltaQty > 0 ? '+' : ''}${qtyFmt(l.deltaQty)}`}</td>
                                    <td className="num"><Money t={t} value={l.unitCost} /></td>
                                    <td>
                                        <span className={`wsk-tag${l.costSource === 'none' ? ' wsk-tag--bad' : l.costSource !== 'average' ? ' wsk-tag--warn' : ''}`}>
                                            {t(`count.src.${l.costSource}`)}
                                        </span>
                                    </td>
                                    <td className="num"><Money t={t} signed value={l.value} /></td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={6}>{t('common.total')}</td>
                                <td className="num"><Money t={t} signed value={count.netChange} /></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
            {(count.journalLines || []).length ? (
                <div className="wsk-card">
                    <h3 className="wsk-h3">
                        {t('count.jeTitle')} · {count.journalEntryNumber}
                    </h3>
                    {count.glBalanceBefore != null ? (
                        <p className="wsk-hint" style={{ marginTop: 0 }}>
                            {t('count.glBefore', { amt: t('common.sar', { amount: fixed2(count.glBalanceBefore) }) })}
                        </p>
                    ) : null}
                    <div className="wsk-table-wrap">
                        <table className="ws-table wsk-table">
                            <thead>
                                <tr>
                                    <th>{t('count.jeAccount')}</th>
                                    <th>{t('count.jeDesc')}</th>
                                    <th className="num">{t('count.jeDr')}</th>
                                    <th className="num">{t('count.jeCr')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {count.journalLines.map((l) => (
                                    <tr key={l.id}>
                                        <td className="wsk-strong">
                                            {l.accountCode} · {l.accountName}
                                        </td>
                                        <td>{l.description}</td>
                                        <td className="num">{l.debit ? fixed2(l.debit) : ''}</td>
                                        <td className="num">{l.credit ? fixed2(l.credit) : ''}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={2}>{t('common.total')}</td>
                                    <td className="num">{fixed2(jeDr)}</td>
                                    <td className="num">{fixed2(jeCr)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            ) : null}
        </>
    );
}

/* ═══════════════════════════════ NEW COUNT ═══════════════════════════════ */

function CountForm({ t, branchId, branchName, workshopId }) {
    const go = useCountNav();
    const { hasPermission } = useAuth();
    const canPost = hasPermission('workshop.inventory.manual-adjust');

    const [loading, setLoading] = useState(true);
    const [loadErr, setLoadErr] = useState('');
    const [items, setItems] = useState([]);
    const [mode, setMode] = useState('zero_all');
    const [notes, setNotes] = useState('');
    const [picked, setPicked] = useState([]);
    const [counts, setCounts] = useState({});
    const [review, setReview] = useState(null);
    const [confirmText, setConfirmText] = useState('');
    const [busy, setBusy] = useState('');
    const [err, setErr] = useState('');

    useEffect(() => {
        let cancelled = false;
        if (!branchId) {
            setLoading(false);
            return undefined;
        }
        (async () => {
            setLoading(true);
            setLoadErr('');
            try {
                const res = unwrap(await getWorkshopStockCountSheet(branchId, { workshopId }));
                if (!cancelled) setItems(Array.isArray(res?.items) ? res.items : []);
            } catch (e) {
                if (!cancelled) setLoadErr(e?.message || t('common.err'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [branchId, workshopId, t]);

    const byId = useMemo(() => new Map(items.map((i) => [String(i.productId), i])), [items]);

    const productOptions = useMemo(
        () =>
            items.map((s) => ({
                id: String(s.productId),
                label: `${s.sku ? `${s.sku} · ` : ''}${s.name} — ${qtyFmt(s.systemQty)} ${s.unit || ''}`,
                searchText: [s.name, s.arabicName, s.sku, s.departmentName, s.categoryName].filter(Boolean).join(' '),
            })),
        [items],
    );

    const resetReview = () => {
        setReview(null);
        setConfirmText('');
        setErr('');
    };

    const lines = useMemo(() => {
        const out = [];
        const ids =
            mode === 'zero_all'
                ? picked.length
                    ? picked
                    : items.filter((i) => round3(i.systemQty) !== 0).map((i) => String(i.productId))
                : picked;
        for (const id of ids) {
            const s = byId.get(id);
            if (!s) continue;
            const systemQty = round3(s.systemQty);
            if (mode === 'zero_all') {
                if (systemQty === 0) continue;
                const diff = round3(-systemQty);
                out.push({ ...s, key: id, systemQty, target: 0, diff, diffValue: money2(diff * (s.unitCostRaw || 0)) });
            } else {
                const target = parseQty(counts[id]);
                const diff = target == null || Number.isNaN(target) ? null : round3(target - systemQty);
                out.push({
                    ...s,
                    key: id,
                    systemQty,
                    target,
                    diff,
                    diffValue: diff == null ? null : money2(diff * (s.unitCostRaw || 0)),
                });
            }
        }
        return out.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    }, [mode, picked, items, byId, counts]);

    const totals = useMemo(() => {
        let systemValue = 0;
        let changed = 0;
        let out = 0;
        let inn = 0;
        for (const r of lines) {
            systemValue += Number(r.value || 0);
            if (r.diff) {
                changed += 1;
                if (r.diffValue < 0) out += -r.diffValue;
                else inn += r.diffValue || 0;
            }
        }
        return { lines: lines.length, systemValue: money2(systemValue), changed, out: money2(out), in: money2(inn) };
    }, [lines]);

    const badInput = lines.some((r) => Number.isNaN(r.target) || (r.target != null && r.target < 0));
    const counted = lines.filter((r) => r.target != null && !Number.isNaN(r.target));

    const body = (dryRun) => {
        const b = { mode, dryRun, ...(notes.trim() ? { notes: notes.trim() } : {}) };
        if (mode === 'zero_all') {
            if (picked.length) b.productIds = picked;
        } else {
            b.lines = counted.map((r) => ({ productId: r.productId, countedQty: r.target }));
        }
        return b;
    };

    const validate = () => {
        if (!branchId) return t('common.noBranch');
        if (mode === 'counts') {
            if (!picked.length) return t('count.err.pick');
            if (badInput) return t('count.err.badQty');
            if (!counted.length) return t('count.err.noLines');
        } else if (!totals.changed) {
            return t('count.nothing');
        }
        return '';
    };

    const runReview = async () => {
        const v = validate();
        if (v) {
            setErr(v);
            return;
        }
        setBusy('review');
        setErr('');
        try {
            const res = unwrap(await postWorkshopStockCount(branchId, body(true), { workshopId }));
            setReview(res);
            setConfirmText('');
            setTimeout(() => document.getElementById('wsk-count-review')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
        } catch (e) {
            setErr(e?.message || t('common.err'));
        } finally {
            setBusy('');
        }
    };

    const zeroWord = t('count.zeroWord');
    const postReady =
        canPost &&
        review &&
        review.summary?.rowsChanged > 0 &&
        !(review.summary?.missingCostCount > 0) &&
        (mode !== 'zero_all' || confirmText.trim().toUpperCase() === zeroWord.toUpperCase());

    const post = async () => {
        if (!postReady) return;
        setBusy('post');
        setErr('');
        try {
            const res = unwrap(await postWorkshopStockCount(branchId, body(false), { workshopId }));
            if (res?.stockCountId) go(res.stockCountId, { justPosted: true });
            else go(null);
        } catch (e) {
            setErr(e?.message || t('common.err'));
        } finally {
            setBusy('');
        }
    };

    const actionLabel =
        mode === 'zero_all'
            ? t('count.actionZero', { n: totals.changed })
            : t('count.actionAdjust', { n: counted.filter((r) => r.diff).length });

    return (
        <>
            <button type="button" className="wsk-link-btn" onClick={() => go(null)}>
                {t('count.backList')}
            </button>
            <div className="wsk-head">
                <div>
                    <h2 className="wsk-title">{t('count.newTitle')}</h2>
                    <p className="wsk-sub">
                        {t('count.subtitle')} · {t('common.branch')}: <b>{branchName || '—'}</b>
                    </p>
                </div>
                <div className="wsk-actions">
                    <button type="button" className="wsk-btn-outline" disabled={Boolean(busy)} onClick={() => go(null)}>
                        {t('count.backList')}
                    </button>
                    <button
                        type="button"
                        className="wsk-btn"
                        disabled={Boolean(busy) || loading || !canPost}
                        title={canPost ? undefined : t('count.permDenied')}
                        onClick={runReview}
                    >
                        {busy === 'review' ? t('count.working') : actionLabel}
                    </button>
                </div>
            </div>

            <div className="wsk-banner">{t('count.intro')}</div>
            {!canPost ? <div className="wsk-error">{t('count.permDenied')}</div> : null}
            {!branchId ? <div className="wsk-error">{t('common.noBranch')}</div> : null}
            {loadErr ? <div className="wsk-error">{loadErr}</div> : null}
            {err ? <div className="wsk-error">{err}</div> : null}

            <div className="wsk-card">
                <h3 className="wsk-h3">{t('count.step1')}</h3>
                <div className="theme-segmented" style={{ marginBottom: 10 }}>
                    {['zero_all', 'counts'].map((m) => (
                        <button
                            key={m}
                            type="button"
                            className={`theme-segmented__btn${mode === m ? ' theme-segmented__btn--active' : ''}`}
                            onClick={() => {
                                setMode(m);
                                resetReview();
                            }}
                        >
                            {t(`count.mode.${m}`)}
                        </button>
                    ))}
                </div>
                <p className="wsk-hint" style={{ margin: '0 0 12px' }}>
                    {t(`count.modeHint.${mode}`)}
                </p>
                <div className="wsk-form-grid">
                    <label className="wsk-span2">
                        {t('count.notes')}
                        <input value={notes} maxLength={500} placeholder={t('count.notesPh')} onChange={(e) => setNotes(e.target.value)} />
                    </label>
                </div>
            </div>

            <div className="wsk-card">
                <h3 className="wsk-h3">{t('count.step2')}</h3>
                <p className="wsk-hint" style={{ margin: '0 0 8px' }}>
                    {mode === 'zero_all' ? t('count.pickHintZero') : t('count.pickHintCounts')}
                </p>
                <div className="wsk-filters">
                    <div style={{ flex: '1 1 320px', minWidth: 0 }}>
                        <MultiSelectSearchCombo
                            options={productOptions}
                            value={picked}
                            onChange={(next) => {
                                setPicked((next || []).map(String));
                                resetReview();
                            }}
                            placeholder={loading ? t('common.loading') : t('count.searchProducts')}
                            emptyHint={t('count.noProductMatch')}
                            disabled={loading || !branchId}
                            menuMinWidth={420}
                            maxInitial={60}
                            maxFiltered={80}
                            clearLabel={t('count.clearPicked')}
                            removeLabel={t('common.remove')}
                        />
                    </div>
                    <button
                        type="button"
                        className="wsk-btn-outline"
                        disabled={loading || !items.length}
                        onClick={() => {
                            const ids = items.filter((s) => round3(s.systemQty) !== 0).map((s) => String(s.productId));
                            setPicked((p) => Array.from(new Set([...p, ...ids])));
                            resetReview();
                        }}
                    >
                        {t('count.addAllStock')}
                    </button>
                    <span className="wsk-count">
                        {mode === 'zero_all' && !picked.length ? t('count.scopeAll') : t('count.pickedN', { n: picked.length })}
                    </span>
                </div>
            </div>

            <div className="wsk-card">
                <h3 className="wsk-h3">{mode === 'zero_all' ? t('count.zeroListTitle') : t('count.sheetTitle')}</h3>
                <div className="wsk-kpis">
                    <div className="wsk-kpi">
                        <div className="wsk-kpi-label">{t('count.kpi.lines')}</div>
                        <div className="wsk-kpi-value">{loading ? '…' : totals.lines}</div>
                    </div>
                    <div className="wsk-kpi">
                        <div className="wsk-kpi-label">{t('count.kpi.systemValue')}</div>
                        <div className="wsk-kpi-value">{loading ? '…' : <Money t={t} value={totals.systemValue} />}</div>
                    </div>
                    <div className="wsk-kpi">
                        <div className="wsk-kpi-label">{t('count.kpi.writtenDown')}</div>
                        <div className="wsk-kpi-value">{loading ? '…' : <Money t={t} value={totals.out} />}</div>
                    </div>
                    <div className="wsk-kpi">
                        <div className="wsk-kpi-label">{t('count.kpi.found')}</div>
                        <div className="wsk-kpi-value">{loading ? '…' : <Money t={t} value={totals.in} />}</div>
                    </div>
                </div>
                {loading ? (
                    <div className="wsk-muted">{t('common.loading')}</div>
                ) : lines.length === 0 ? (
                    <div className="wsk-muted">{mode === 'counts' ? t('count.err.pick') : t('count.nothing')}</div>
                ) : (
                    <div className="wsk-table-wrap">
                        <table className="ws-table wsk-table">
                            <thead>
                                <tr>
                                    <th>{t('count.th.product')}</th>
                                    <th>{t('count.th.dept')}</th>
                                    <th className="num">{t('count.th.system')}</th>
                                    <th className="num">{t('count.th.cost')}</th>
                                    <th className="num">{mode === 'zero_all' ? t('count.th.newQty') : t('count.th.counted')}</th>
                                    <th className="num">{t('count.th.diff')}</th>
                                    <th className="num">{t('count.th.diffValue')}</th>
                                    {mode === 'counts' ? <th /> : null}
                                </tr>
                            </thead>
                            <tbody>
                                {lines.map((r) => (
                                    <tr key={r.key}>
                                        <td>
                                            <div className="wsk-strong">{r.name}</div>
                                            {r.sku ? <div className="wsk-hint">{r.sku}</div> : null}
                                        </td>
                                        <td>
                                            <div>{r.departmentName || '—'}</div>
                                            <div className="wsk-hint">{r.categoryName || ''}</div>
                                        </td>
                                        <td className="num">
                                            {qtyFmt(r.systemQty)} <span className="wsk-hint">{r.unit || ''}</span>
                                        </td>
                                        <td className="num">
                                            {r.unitCost > 0 ? <Money t={t} value={r.unitCost} /> : null}{' '}
                                            <span className={`wsk-tag${r.costSource === 'none' ? ' wsk-tag--bad' : r.costSource !== 'average' ? ' wsk-tag--warn' : ''}`}>
                                                {t(`count.src.${r.costSource}`)}
                                            </span>
                                        </td>
                                        <td className="num">
                                            {mode === 'zero_all' ? (
                                                '0'
                                            ) : (
                                                <input
                                                    inputMode="decimal"
                                                    aria-label={t('count.th.counted')}
                                                    value={counts[r.key] ?? ''}
                                                    placeholder={t('count.notCounted')}
                                                    className={Number.isNaN(r.target) || (r.target != null && r.target < 0) ? 'wsk-invalid' : ''}
                                                    onChange={(e) => {
                                                        const v = e.target.value;
                                                        setCounts((c) => ({ ...c, [r.key]: v }));
                                                        resetReview();
                                                    }}
                                                />
                                            )}
                                        </td>
                                        <td className="num">
                                            {r.diff == null || Number.isNaN(r.diff) ? '—' : `${r.diff > 0 ? '+' : ''}${qtyFmt(r.diff)}`}
                                        </td>
                                        <td className="num">{r.diffValue == null ? '—' : <Money t={t} signed value={r.diffValue} />}</td>
                                        {mode === 'counts' ? (
                                            <td style={{ whiteSpace: 'nowrap' }}>
                                                <button
                                                    type="button"
                                                    className="wsk-link-btn"
                                                    onClick={() => {
                                                        setCounts((c) => ({ ...c, [r.key]: '0' }));
                                                        resetReview();
                                                    }}
                                                >
                                                    {t('count.setZero')}
                                                </button>{' '}
                                                <button
                                                    type="button"
                                                    className="wsk-link-btn"
                                                    onClick={() => {
                                                        setPicked((p) => p.filter((x) => x !== r.key));
                                                        resetReview();
                                                    }}
                                                >
                                                    {t('common.remove')}
                                                </button>
                                            </td>
                                        ) : null}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {mode === 'counts' && lines.length ? <p className="wsk-hint">{t('count.blankHint')}</p> : null}
                <div className="wsk-line-foot">
                    <button type="button" className="wsk-btn" disabled={Boolean(busy) || loading || !canPost} onClick={runReview}>
                        {busy === 'review' ? t('count.working') : actionLabel}
                    </button>
                    <span className="wsk-hint">{t('count.reviewHint')}</span>
                </div>
            </div>

            {review ? (
                <div className="wsk-card" id="wsk-count-review">
                    <h3 className="wsk-h3">{t('count.previewTitle')}</h3>
                    <div className="wsk-kpis">
                        <div className="wsk-kpi">
                            <div className="wsk-kpi-label">{t('count.kpi.changed')}</div>
                            <div className="wsk-kpi-value">
                                {review.summary.rowsChanged}{' '}
                                <span className="wsk-hint">({t('count.kpi.downUp', { out: review.summary.rowsOut, in: review.summary.rowsIn })})</span>
                            </div>
                        </div>
                        <div className="wsk-kpi">
                            <div className="wsk-kpi-label">{t('count.kpi.writtenDown')}</div>
                            <div className="wsk-kpi-value"><Money t={t} value={review.summary.valueOut} /></div>
                        </div>
                        <div className="wsk-kpi">
                            <div className="wsk-kpi-label">{t('count.kpi.found')}</div>
                            <div className="wsk-kpi-value"><Money t={t} value={review.summary.valueIn} /></div>
                        </div>
                        {review.gl ? (
                            <div className="wsk-kpi">
                                <div className="wsk-kpi-label">{t('count.kpi.glAfter')}</div>
                                <div className="wsk-kpi-value">
                                    <Money t={t} value={review.gl.inventory1200Before} /> → <Money t={t} value={review.gl.inventory1200After} />
                                </div>
                            </div>
                        ) : null}
                    </div>
                    <p className="wsk-hint">{t('count.previewJe')}</p>
                    {review.summary.zeroCostRows > 0 ? <div className="wsk-note">{t('count.zeroCost', { n: review.summary.zeroCostRows })}</div> : null}
                    {review.summary.missingCostCount > 0 ? (
                        <div className="wsk-error">
                            {t('count.missingCost', { n: review.summary.missingCostCount })}{' '}
                            {(review.missingCost || []).slice(0, 8).map((m) => m.productName).join(', ')}
                        </div>
                    ) : null}
                    {review.summary.rowsChanged === 0 ? <div className="wsk-muted">{t('count.nothing')}</div> : null}
                    {mode === 'zero_all' && review.summary.rowsChanged > 0 ? (
                        <div className="wsk-form-grid" style={{ marginTop: 10 }}>
                            <label>
                                {t('count.typeZero', { word: zeroWord })}
                                <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
                            </label>
                        </div>
                    ) : null}
                    <div className="wsk-line-foot">
                        <button
                            type="button"
                            className={`wsk-btn${mode === 'zero_all' ? ' wsk-btn-danger' : ''}`}
                            disabled={Boolean(busy) || !postReady}
                            onClick={post}
                        >
                            {busy === 'post' ? t('count.working') : t('count.confirmPost')}
                        </button>
                        <button type="button" className="wsk-btn-outline" disabled={Boolean(busy)} onClick={resetReview}>
                            {t('count.editAgain')}
                        </button>
                    </div>
                </div>
            ) : null}
        </>
    );
}
