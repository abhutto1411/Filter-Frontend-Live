import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import SupplierRiyalAmount from './SupplierRiyalAmount';
import MultiSelectSearchCombo from '../../components/MultiSelectSearchCombo';
import {
    bulkSupplierStockCount,
    fetchAllSupplierStockBalances,
    getSupplierLocations,
    getSupplierStockCount,
    listSupplierStockCounts,
} from '../../services/supplierApi';
import { exportRowsToExcel, exportRowsToPdf } from '../../utils/tableExport';
import { sstockT } from '../../utils/supplierStockI18n';
import { SUPPLIER_PERM, useSupplierCan } from '../../utils/supplierPermissions';
import '../../styles/theme-segmented.css';
import './supplierPortal.css';

/**
 * Physical stock count / "Make zero" — full-page feature (no modals).
 *
 *   /supplier/stock/count        saved counts (history) + "New count"
 *   /supplier/stock/count/new    pick products, count or zero, review, post
 *   /supplier/stock/count/:id    one saved count — lines, totals, PDF / Excel
 *
 * Every post is ONE server transaction and ONE balanced journal, valued at
 * moving-average PURCHASE cost (never a selling / catalogue price).
 */

const BASE = '/supplier/stock/count';
const STOCK = '/supplier/stock';

const round3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;
const money2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const qtyFmt = (n) => round3(n).toLocaleString(undefined, { maximumFractionDigits: 3 });
const fixed2 = (n) => money2(n).toFixed(2);
const parseQty = (raw) => {
    const s = String(raw ?? '').replace(/,/g, '').trim();
    if (s === '') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
};
const riyadhDateTime = (iso) => {
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

function Money({ value }) {
    return <SupplierRiyalAmount amount={money2(value)} size={13} />;
}

/* ═══════════════════════════════ ROUTER ═══════════════════════════════ */

export default function SupplierStockCountScreen({ locale = 'en' }) {
    const t = useCallback((key, vars) => sstockT(locale, key, vars), [locale]);
    const { pathname } = useLocation();
    const rest = pathname.replace(/^\/supplier\/stock\/count\/?/, '');
    const [first] = rest.split('/').filter(Boolean);
    let view;
    if (!first) view = <StockCountList t={t} />;
    else if (first === 'new') view = <StockCountForm t={t} />;
    else view = <StockCountDetail key={first} id={decodeURIComponent(first)} t={t} />;
    return (
        <div className="sp-gr-page" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
            {view}
        </div>
    );
}

/* ═══════════════════════════════ HISTORY ═══════════════════════════════ */

function StockCountList({ t }) {
    const navigate = useNavigate();
    const can = useSupplierCan();
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setErr('');
            try {
                const res = await listSupplierStockCounts({ limit: 200, offset: 0 });
                if (cancelled) return;
                setRows(Array.isArray(res?.counts) ? res.counts : []);
                setTotal(Number(res?.total) || 0);
            } catch (e) {
                if (!cancelled) setErr(e?.message || t('count.err.generic'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [t]);

    const sum = useMemo(
        () =>
            rows.reduce(
                (s, r) => ({ out: s.out + (r.valueOut || 0), in: s.in + (r.valueIn || 0) }),
                { out: 0, in: 0 },
            ),
        [rows],
    );

    return (
        <>
            <button type="button" className="sp-gr-link-btn" onClick={() => navigate(STOCK)}>
                {t('count.back')}
            </button>
            <div className="sp-gr-head">
                <div>
                    <h2 className="sp-gr-title">{t('count.listTitle')}</h2>
                    <p className="sp-gr-sub">{t('count.listSub')}</p>
                </div>
                <div className="sp-gr-actions">
                    <button
                        type="button"
                        className="btn-portal"
                        disabled={!can(SUPPLIER_PERM.journalPost)}
                        title={can(SUPPLIER_PERM.journalPost) ? undefined : t('count.permDenied')}
                        onClick={() => navigate(`${BASE}/new`)}
                    >
                        {t('count.new')}
                    </button>
                </div>
            </div>
            {err ? <div className="sp-gr-error">{err}</div> : null}
            <div className="sp-gr-kpis">
                <div className="sp-gr-kpi">
                    <div className="sp-gr-kpi-label">{t('count.kpi.documents')}</div>
                    <div className="sp-gr-kpi-value">{loading ? '…' : total}</div>
                </div>
                <div className="sp-gr-kpi">
                    <div className="sp-gr-kpi-label">{t('count.kpi.writtenDown')}</div>
                    <div className="sp-gr-kpi-value">{loading ? '…' : <Money value={sum.out} />}</div>
                </div>
                <div className="sp-gr-kpi">
                    <div className="sp-gr-kpi-label">{t('count.kpi.found')}</div>
                    <div className="sp-gr-kpi-value">{loading ? '…' : <Money value={sum.in} />}</div>
                </div>
            </div>
            <div className="sp-gr-card">
                {loading ? (
                    <div className="sp-gr-muted">{t('count.loading')}</div>
                ) : rows.length === 0 ? (
                    <div className="sp-gr-muted">{t('count.empty')}</div>
                ) : (
                    <div className="sp-gr-table-wrap">
                        <table className="ws-table sp-gr-table">
                            <thead>
                                <tr>
                                    <th>{t('count.th.no')}</th>
                                    <th>{t('count.th.date')}</th>
                                    <th>{t('count.th.type')}</th>
                                    <th>{t('count.location')}</th>
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
                                        className="sp-gr-row"
                                        tabIndex={0}
                                        onClick={() => navigate(`${BASE}/${encodeURIComponent(r.id)}`)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') navigate(`${BASE}/${encodeURIComponent(r.id)}`);
                                        }}
                                    >
                                        <td className="sp-gr-strong">{r.countNo}</td>
                                        <td>{riyadhDateTime(r.createdAt)}</td>
                                        <td>{t(`count.mode.${r.mode}`)}</td>
                                        <td>{r.locationName || t('count.allLocations')}</td>
                                        <td className="num">{r.linesChanged}</td>
                                        <td className="num"><Money value={r.valueOut} /></td>
                                        <td className="num"><Money value={r.valueIn} /></td>
                                        <td className="num"><Money value={r.netValue} /></td>
                                        <td>{r.journalEntryNumber || (r.journalId ? `#${r.journalId}` : '—')}</td>
                                        <td>{r.createdByName || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </>
    );
}

/* ═══════════════════════════════ DETAIL ═══════════════════════════════ */

function StockCountDetail({ id, t }) {
    const navigate = useNavigate();
    const { state } = useLocation();
    const [count, setCount] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setErr('');
            try {
                const res = await getSupplierStockCount(id);
                if (!cancelled) setCount(res?.count || null);
            } catch (e) {
                if (!cancelled) setErr(e?.message || t('count.err.generic'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [id, t]);

    const exportData = () => {
        const headers = [
            t('count.th.product'),
            t('count.th.sku'),
            t('count.location'),
            t('count.th.unit'),
            t('count.th.system'),
            t('count.th.counted'),
            t('count.th.diff'),
            t('count.th.avg'),
            t('count.th.diffValue'),
        ];
        const rows = (count?.lines || []).map((l) => [
            l.productName,
            l.sku || '',
            l.locationName,
            l.warehouseUnit || '',
            round3(l.systemQty),
            round3(l.countedQty),
            round3(l.deltaQty),
            Number(l.unitCost || 0).toFixed(4),
            fixed2(l.value),
        ]);
        rows.push([
            t('count.total'),
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            fixed2((count?.valueIn || 0) - (count?.valueOut || 0)),
        ]);
        return { headers, rows };
    };

    const subtitle = count
        ? [
              `${t('count.th.date')}: ${riyadhDateTime(count.createdAt)} (Asia/Riyadh)`,
              `${t('count.th.type')}: ${t(`count.mode.${count.mode}`)}`,
              `${t('count.location')}: ${count.locationName || t('count.allLocations')}`,
              `${t('count.kpi.writtenDown')}: SAR ${fixed2(count.valueOut)}`,
              `${t('count.kpi.found')}: SAR ${fixed2(count.valueIn)}`,
              `${t('count.th.journal')}: ${count.journalEntryNumber || '—'}`,
              count.notes ? `${t('count.notes')}: ${count.notes}` : '',
          ]
              .filter(Boolean)
              .join(' · ')
        : '';

    if (loading) return <div className="sp-gr-muted">{t('count.loading')}</div>;
    if (err || !count) {
        return (
            <>
                <button type="button" className="sp-gr-link-btn" onClick={() => navigate(BASE)}>
                    {t('count.backList')}
                </button>
                <div className="sp-gr-error">{err || t('count.err.generic')}</div>
            </>
        );
    }

    return (
        <>
            <button type="button" className="sp-gr-link-btn" onClick={() => navigate(BASE)}>
                {t('count.backList')}
            </button>
            {state?.justPosted ? <div className="sp-gr-ok">{t('count.postedOk', { no: count.countNo })}</div> : null}
            <div className="sp-gr-head">
                <div>
                    <h2 className="sp-gr-title">{count.countNo}</h2>
                    <p className="sp-gr-sub">
                        {t(`count.mode.${count.mode}`)} · {count.locationName || t('count.allLocations')} ·{' '}
                        {riyadhDateTime(count.createdAt)} · {count.createdByName || '—'}
                    </p>
                </div>
                <div className="sp-gr-actions">
                    <button
                        type="button"
                        className="btn-portal-outline"
                        onClick={() => {
                            const { headers, rows } = exportData();
                            exportRowsToPdf({
                                title: `${t('count.title')} — ${count.countNo}`,
                                subtitle,
                                headers,
                                rows,
                                filenameBase: `stock-count-${count.countNo}`,
                            });
                        }}
                    >
                        {t('count.pdf')}
                    </button>
                    <button
                        type="button"
                        className="btn-portal-outline"
                        onClick={() => {
                            const { headers, rows } = exportData();
                            exportRowsToExcel({
                                sheetName: count.countNo,
                                headers,
                                rows,
                                filenameBase: `stock-count-${count.countNo}`,
                            });
                        }}
                    >
                        {t('count.excel')}
                    </button>
                    {count.journalId ? (
                        <button
                            type="button"
                            className="btn-portal-outline"
                            onClick={() => navigate(`/supplier/accounting/journals/${encodeURIComponent(count.journalId)}`)}
                        >
                            {t('count.viewJe')} {count.journalEntryNumber ? `· ${count.journalEntryNumber}` : ''}
                        </button>
                    ) : null}
                    <button type="button" className="btn-portal" onClick={() => navigate(STOCK)}>
                        {t('count.backToStock')}
                    </button>
                </div>
            </div>
            {count.notes ? <div className="sp-gr-note">{count.notes}</div> : null}
            <div className="sp-gr-kpis">
                <div className="sp-gr-kpi">
                    <div className="sp-gr-kpi-label">{t('count.th.lines')}</div>
                    <div className="sp-gr-kpi-value">{count.linesChanged}</div>
                </div>
                <div className="sp-gr-kpi">
                    <div className="sp-gr-kpi-label">{t('count.kpi.writtenDown')}</div>
                    <div className="sp-gr-kpi-value"><Money value={count.valueOut} /></div>
                </div>
                <div className="sp-gr-kpi">
                    <div className="sp-gr-kpi-label">{t('count.kpi.found')}</div>
                    <div className="sp-gr-kpi-value"><Money value={count.valueIn} /></div>
                </div>
                <div className="sp-gr-kpi">
                    <div className="sp-gr-kpi-label">{t('count.th.net')}</div>
                    <div className="sp-gr-kpi-value"><Money value={count.netValue} /></div>
                </div>
            </div>
            <div className="sp-gr-card">
                <div className="sp-gr-table-wrap">
                    <table className="ws-table sp-gr-table">
                        <thead>
                            <tr>
                                <th>{t('count.th.product')}</th>
                                <th>{t('count.location')}</th>
                                <th className="num">{t('count.th.system')}</th>
                                <th className="num">{t('count.th.counted')}</th>
                                <th className="num">{t('count.th.diff')}</th>
                                <th className="num">{t('count.th.avg')}</th>
                                <th className="num">{t('count.th.diffValue')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(count.lines || []).map((l) => (
                                <tr key={l.id}>
                                    <td>
                                        <div className="sp-gr-strong">{l.productName}</div>
                                        {l.sku ? <div className="sp-gr-hint">{l.sku}</div> : null}
                                    </td>
                                    <td>{l.locationName}</td>
                                    <td className="num">
                                        {qtyFmt(l.systemQty)} <span className="sp-gr-hint">{l.warehouseUnit || ''}</span>
                                    </td>
                                    <td className="num">{qtyFmt(l.countedQty)}</td>
                                    <td className="num">{`${l.deltaQty > 0 ? '+' : ''}${qtyFmt(l.deltaQty)}`}</td>
                                    <td className="num"><Money value={l.unitCost} /></td>
                                    <td className="num"><Money value={l.value} /></td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={6} className="sp-gr-strong">{t('count.total')}</td>
                                <td className="num sp-gr-strong"><Money value={count.netValue} /></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </>
    );
}

/* ═══════════════════════════════ NEW COUNT ═══════════════════════════════ */

function StockCountForm({ t }) {
    const navigate = useNavigate();
    const can = useSupplierCan();
    const canPost = can(SUPPLIER_PERM.journalPost);

    const [loading, setLoading] = useState(true);
    const [loadErr, setLoadErr] = useState('');
    const [stockRows, setStockRows] = useState([]);
    const [apiLocations, setApiLocations] = useState([]);

    const [mode, setMode] = useState('zero_all');
    const [locationId, setLocationId] = useState('');
    const [notes, setNotes] = useState('');
    /** Picked product ids (supplier_products.id). Zero mode: empty = every product with stock. */
    const [picked, setPicked] = useState([]);
    const [counts, setCounts] = useState({});

    const [review, setReview] = useState(null);
    const [ackGl, setAckGl] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [busy, setBusy] = useState('');
    const [err, setErr] = useState('');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setLoadErr('');
            try {
                const [stockRes, locRes] = await Promise.all([
                    fetchAllSupplierStockBalances({ historyLimit: 1 }),
                    getSupplierLocations().catch(() => null),
                ]);
                if (cancelled) return;
                setStockRows(Array.isArray(stockRes?.items) ? stockRes.items : []);
                const locs = Array.isArray(locRes)
                    ? locRes
                    : Array.isArray(locRes?.locations)
                      ? locRes.locations
                      : Array.isArray(locRes?.data)
                        ? locRes.data
                        : [];
                setApiLocations(locs);
            } catch (e) {
                if (!cancelled) setLoadErr(e?.message || t('count.err.generic'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [t]);

    /** Warehouses = the API list ∪ every warehouse that already holds stock. */
    const locations = useMemo(() => {
        const map = new Map();
        for (const l of apiLocations) {
            const id = String(l?.id ?? '').trim();
            if (id) map.set(id, l.name || id);
        }
        for (const s of stockRows) {
            for (const l of s.byLocation || []) {
                const id = String(l.supplierLocationId ?? '').trim();
                if (id && !map.has(id)) map.set(id, l.locationName || id);
            }
        }
        return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
    }, [apiLocations, stockRows]);

    // One warehouse only → choose it for the user (counts need a warehouse).
    useEffect(() => {
        if (!locationId && locations.length === 1 && mode === 'counts') setLocationId(locations[0].id);
    }, [locations, locationId, mode]);

    const productById = useMemo(() => {
        const m = new Map();
        for (const s of stockRows) m.set(String(s.productId), s);
        return m;
    }, [stockRows]);

    const qtyAt = useCallback((s, lid) => {
        const loc = (s?.byLocation || []).find((l) => String(l.supplierLocationId) === String(lid));
        return { qty: round3(loc?.quantityWarehouseUnits ?? 0), avg: Number(loc?.averageCost ?? 0) || 0, name: loc?.locationName };
    }, []);

    const productOptions = useMemo(
        () =>
            stockRows
                .map((s) => {
                    const total = (s.byLocation || []).reduce((a, l) => a + (Number(l.quantityWarehouseUnits) || 0), 0);
                    return {
                        id: String(s.productId),
                        label: `${s.sku ? `${s.sku} · ` : ''}${s.productName || '—'} — ${qtyFmt(total)} ${s.warehouseUnit || ''}`,
                        searchText: [s.productName, s.sku, s.masterProductId].filter(Boolean).join(' '),
                    };
                })
                .sort((a, b) => a.label.localeCompare(b.label)),
        [stockRows],
    );

    /** Rows the post will touch, one per product × warehouse. */
    const lines = useMemo(() => {
        const out = [];
        if (mode === 'zero_all') {
            const ids = picked.length ? picked : stockRows.map((s) => String(s.productId));
            for (const id of ids) {
                const s = productById.get(id);
                if (!s) continue;
                for (const l of s.byLocation || []) {
                    const lid = String(l.supplierLocationId);
                    if (locationId && lid !== locationId) continue;
                    const q = round3(l.quantityWarehouseUnits);
                    if (q === 0) continue;
                    const avg = Number(l.averageCost ?? 0) || 0;
                    out.push({
                        key: `${id}:${lid}`,
                        productId: id,
                        name: s.productName,
                        sku: s.sku,
                        unit: s.warehouseUnit || 'pcs',
                        locationId: lid,
                        locationName: l.locationName || '',
                        systemQty: q,
                        avgCost: avg,
                        target: 0,
                        diff: round3(-q),
                        diffValue: money2(-q * money2(avg)),
                    });
                }
            }
        } else if (locationId) {
            for (const id of picked) {
                const s = productById.get(id);
                if (!s) continue;
                const at = qtyAt(s, locationId);
                const target = parseQty(counts[id]);
                const diff = target == null || Number.isNaN(target) ? null : round3(target - at.qty);
                out.push({
                    key: `${id}:${locationId}`,
                    productId: id,
                    name: s.productName,
                    sku: s.sku,
                    unit: s.warehouseUnit || 'pcs',
                    locationId,
                    locationName: at.name || '',
                    systemQty: at.qty,
                    avgCost: at.avg,
                    target,
                    diff,
                    diffValue: diff == null ? null : money2(diff * money2(at.avg)),
                });
            }
        }
        return out.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    }, [mode, picked, stockRows, productById, locationId, counts, qtyAt]);

    const totals = useMemo(() => {
        let systemValue = 0;
        let changed = 0;
        let out = 0;
        let inn = 0;
        for (const r of lines) {
            systemValue += money2(r.systemQty * money2(r.avgCost));
            if (r.diff) {
                changed += 1;
                if (r.diffValue < 0) out += -r.diffValue;
                else inn += r.diffValue || 0;
            }
        }
        return { lines: lines.length, systemValue, changed, out, in: inn };
    }, [lines]);

    const badInput = lines.some((r) => Number.isNaN(r.target) || (r.target != null && r.target < 0));
    const counted = lines.filter((r) => r.target != null && !Number.isNaN(r.target));

    const resetReview = () => {
        setReview(null);
        setAckGl(false);
        setConfirmText('');
        setErr('');
    };

    const body = (dryRun) => {
        const b = { mode, dryRun, ...(notes.trim() ? { notes: notes.trim() } : {}) };
        if (mode === 'zero_all') {
            if (locationId) b.supplierLocationId = locationId;
            if (picked.length) b.supplierProductIds = picked;
        } else {
            b.lines = counted.map((r) => ({
                supplierProductId: r.productId,
                supplierLocationId: r.locationId,
                countedQty: r.target,
            }));
        }
        if (!dryRun && ackGl) b.acknowledgeGlMismatch = true;
        return b;
    };

    const validate = () => {
        if (mode === 'counts') {
            if (!locationId) return t('count.err.location');
            if (!picked.length) return t('count.err.pick');
            if (badInput) return t('count.err.badQty');
            if (!counted.length) return t('count.err.noLines');
        } else if (!totals.changed) {
            return t('count.nothing');
        }
        return '';
    };

    /** Step 1 of the action: the server computes exactly what will post. */
    const runReview = async () => {
        const v = validate();
        if (v) {
            setErr(v);
            return;
        }
        setBusy('review');
        setErr('');
        try {
            const res = await bulkSupplierStockCount(body(true));
            setReview(res);
            setAckGl(false);
            setConfirmText('');
            setTimeout(() => document.getElementById('sp-count-review')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
        } catch (e) {
            setErr(e?.message || t('count.err.generic'));
        } finally {
            setBusy('');
        }
    };

    const gl = review?.glTieOut;
    const zeroWord = t('count.zeroWord');
    const postReady =
        canPost &&
        review &&
        review.summary?.rowsChanged > 0 &&
        !(review.summary?.missingCostCount > 0) &&
        (!gl || gl.tied || gl.withinRounding || ackGl) &&
        (mode !== 'zero_all' || confirmText.trim().toUpperCase() === zeroWord.toUpperCase());

    /** Step 2: post + save the document, then open it. */
    const post = async () => {
        if (!postReady) return;
        setBusy('post');
        setErr('');
        try {
            const res = await bulkSupplierStockCount(body(false));
            if (res?.stockCountId) {
                navigate(`${BASE}/${encodeURIComponent(res.stockCountId)}`, { state: { justPosted: true } });
            } else {
                navigate(BASE);
            }
        } catch (e) {
            setErr(e?.message || t('count.err.generic'));
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
            <button type="button" className="sp-gr-link-btn" onClick={() => navigate(BASE)}>
                {t('count.backList')}
            </button>
            <div className="sp-gr-head">
                <div>
                    <h2 className="sp-gr-title">{t('count.newTitle')}</h2>
                    <p className="sp-gr-sub">{t('count.subtitle')}</p>
                </div>
                <div className="sp-gr-actions">
                    <button type="button" className="btn-portal-outline" disabled={Boolean(busy)} onClick={() => navigate(BASE)}>
                        {t('btn.cancel')}
                    </button>
                    <button
                        type="button"
                        className="btn-portal"
                        disabled={Boolean(busy) || loading || !canPost}
                        title={canPost ? undefined : t('count.permDenied')}
                        onClick={runReview}
                    >
                        {busy === 'review' ? t('count.working') : actionLabel}
                    </button>
                </div>
            </div>

            <div className="sp-gr-banner">{t('count.intro')}</div>
            {!canPost ? <div className="sp-gr-error">{t('count.permDenied')}</div> : null}
            {loadErr ? <div className="sp-gr-error">{loadErr}</div> : null}
            {err ? <div className="sp-gr-error">{err}</div> : null}

            {/* Step 1 — what to do, where */}
            <div className="sp-gr-card">
                <h3 className="sp-gr-h3">{t('count.step1')}</h3>
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
                <p className="sp-gr-hint" style={{ margin: '0 0 12px' }}>
                    {t(`count.modeHint.${mode}`)}
                </p>
                <div className="sp-gr-form-grid">
                    <label>
                        {t('count.location')}
                        <select
                            value={locationId}
                            disabled={loading}
                            onChange={(e) => {
                                setLocationId(e.target.value);
                                resetReview();
                            }}
                        >
                            <option value="">{mode === 'zero_all' ? t('count.allLocations') : t('count.pickLocation')}</option>
                            {locations.map((l) => (
                                <option key={l.id} value={l.id}>
                                    {l.name}
                                </option>
                            ))}
                        </select>
                        {!loading && locations.length === 0 ? <span className="sp-gr-hint">{t('count.noLocations')}</span> : null}
                    </label>
                    <label className="sp-gr-span2">
                        {t('count.notes')}
                        <input value={notes} maxLength={500} placeholder={t('count.notesPh')} onChange={(e) => setNotes(e.target.value)} />
                    </label>
                </div>
            </div>

            {/* Step 2 — which products */}
            <div className="sp-gr-card">
                <h3 className="sp-gr-h3">{t('count.step2')}</h3>
                <p className="sp-gr-hint" style={{ margin: '0 0 8px' }}>
                    {mode === 'zero_all' ? t('count.pickHintZero') : t('count.pickHintCounts')}
                </p>
                <div className="sp-gr-filters">
                    <div style={{ flex: '1 1 320px', minWidth: 0 }}>
                        <MultiSelectSearchCombo
                            options={productOptions}
                            value={picked}
                            onChange={(next) => {
                                setPicked((next || []).map(String));
                                resetReview();
                            }}
                            placeholder={loading ? t('count.loading') : t('count.searchProducts')}
                            emptyHint={t('count.noProductMatch')}
                            disabled={loading}
                            menuMinWidth={420}
                            maxInitial={60}
                            maxFiltered={80}
                            clearLabel={t('count.clearPicked')}
                            removeLabel={t('count.remove')}
                        />
                    </div>
                    {mode === 'counts' ? (
                        <button
                            type="button"
                            className="btn-portal-outline"
                            disabled={loading || !locationId}
                            onClick={() => {
                                const ids = stockRows
                                    .filter((s) => (s.byLocation || []).some((l) => String(l.supplierLocationId) === locationId))
                                    .map((s) => String(s.productId));
                                setPicked((p) => Array.from(new Set([...p, ...ids])));
                                resetReview();
                            }}
                        >
                            {t('count.addAllInWh')}
                        </button>
                    ) : null}
                    <span className="sp-gr-count">
                        {mode === 'zero_all' && !picked.length ? t('count.scopeAll') : t('count.pickedN', { n: picked.length })}
                    </span>
                </div>
            </div>

            {/* Step 3 — the sheet */}
            <div className="sp-gr-card">
                <h3 className="sp-gr-h3">{mode === 'zero_all' ? t('count.zeroListTitle') : t('count.sheetTitle')}</h3>
                <div className="sp-gr-kpis">
                    <div className="sp-gr-kpi">
                        <div className="sp-gr-kpi-label">{t('count.kpi.lines')}</div>
                        <div className="sp-gr-kpi-value">{loading ? '…' : totals.lines}</div>
                    </div>
                    <div className="sp-gr-kpi">
                        <div className="sp-gr-kpi-label">{t('count.kpi.systemValue')}</div>
                        <div className="sp-gr-kpi-value">{loading ? '…' : <Money value={totals.systemValue} />}</div>
                    </div>
                    <div className="sp-gr-kpi">
                        <div className="sp-gr-kpi-label">{t('count.kpi.writtenDown')}</div>
                        <div className="sp-gr-kpi-value">{loading ? '…' : <Money value={totals.out} />}</div>
                    </div>
                    <div className="sp-gr-kpi">
                        <div className="sp-gr-kpi-label">{t('count.kpi.found')}</div>
                        <div className="sp-gr-kpi-value">{loading ? '…' : <Money value={totals.in} />}</div>
                    </div>
                </div>
                {loading ? (
                    <div className="sp-gr-muted">{t('count.loading')}</div>
                ) : mode === 'counts' && !locationId ? (
                    <div className="sp-gr-muted">{t('count.err.location')}</div>
                ) : lines.length === 0 ? (
                    <div className="sp-gr-muted">{mode === 'counts' ? t('count.err.pick') : t('count.nothing')}</div>
                ) : (
                    <div className="sp-gr-table-wrap">
                        <table className="ws-table sp-gr-table">
                            <thead>
                                <tr>
                                    <th>{t('count.th.product')}</th>
                                    {mode === 'zero_all' ? <th>{t('count.location')}</th> : null}
                                    <th className="num">{t('count.th.system')}</th>
                                    <th className="num">{t('count.th.avg')}</th>
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
                                            <div className="sp-gr-strong">{r.name}</div>
                                            {r.sku ? <div className="sp-gr-hint">{r.sku}</div> : null}
                                        </td>
                                        {mode === 'zero_all' ? <td>{r.locationName || '—'}</td> : null}
                                        <td className="num">
                                            {qtyFmt(r.systemQty)} <span className="sp-gr-hint">{r.unit}</span>
                                        </td>
                                        <td className="num">
                                            {r.avgCost > 0 ? <Money value={r.avgCost} /> : <span className="sp-gr-hint">{t('count.noAvg')}</span>}
                                        </td>
                                        <td className="num">
                                            {mode === 'zero_all' ? (
                                                '0'
                                            ) : (
                                                <input
                                                    inputMode="decimal"
                                                    aria-label={t('count.th.counted')}
                                                    value={counts[r.productId] ?? ''}
                                                    placeholder={t('count.notCounted')}
                                                    className={Number.isNaN(r.target) || (r.target != null && r.target < 0) ? 'sp-gr-invalid' : ''}
                                                    onChange={(e) => {
                                                        const v = e.target.value;
                                                        setCounts((c) => ({ ...c, [r.productId]: v }));
                                                        resetReview();
                                                    }}
                                                />
                                            )}
                                        </td>
                                        <td className="num">{r.diff == null || Number.isNaN(r.diff) ? '—' : `${r.diff > 0 ? '+' : ''}${qtyFmt(r.diff)}`}</td>
                                        <td className="num">{r.diffValue == null ? '—' : <Money value={r.diffValue} />}</td>
                                        {mode === 'counts' ? (
                                            <td style={{ whiteSpace: 'nowrap' }}>
                                                <button
                                                    type="button"
                                                    className="sp-gr-link-btn"
                                                    onClick={() => {
                                                        setCounts((c) => ({ ...c, [r.productId]: '0' }));
                                                        resetReview();
                                                    }}
                                                >
                                                    {t('count.setZero')}
                                                </button>{' '}
                                                <button
                                                    type="button"
                                                    className="sp-gr-link-btn"
                                                    onClick={() => {
                                                        setPicked((p) => p.filter((x) => x !== r.productId));
                                                        resetReview();
                                                    }}
                                                >
                                                    {t('count.remove')}
                                                </button>
                                            </td>
                                        ) : null}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {mode === 'counts' && lines.length ? <p className="sp-gr-hint">{t('count.blankHint')}</p> : null}
                <div className="sp-gr-line-foot">
                    <button
                        type="button"
                        className="btn-portal"
                        disabled={Boolean(busy) || loading || !canPost}
                        onClick={runReview}
                    >
                        {busy === 'review' ? t('count.working') : actionLabel}
                    </button>
                    <span className="sp-gr-hint">{t('count.reviewHint')}</span>
                </div>
            </div>

            {/* Step 4 — server review + confirm */}
            {review ? (
                <div className="sp-gr-card" id="sp-count-review">
                    <h3 className="sp-gr-h3">{t('count.previewTitle')}</h3>
                    <div className="sp-gr-kpis">
                        <div className="sp-gr-kpi">
                            <div className="sp-gr-kpi-label">{t('count.kpi.changed')}</div>
                            <div className="sp-gr-kpi-value">
                                {review.summary.rowsChanged}{' '}
                                <span className="sp-gr-hint">
                                    ({t('count.kpi.downUp', { out: review.summary.rowsOut, in: review.summary.rowsIn })})
                                </span>
                            </div>
                        </div>
                        <div className="sp-gr-kpi">
                            <div className="sp-gr-kpi-label">{t('count.kpi.writtenDown')}</div>
                            <div className="sp-gr-kpi-value"><Money value={review.summary.valueOut} /></div>
                        </div>
                        <div className="sp-gr-kpi">
                            <div className="sp-gr-kpi-label">{t('count.kpi.found')}</div>
                            <div className="sp-gr-kpi-value"><Money value={review.summary.valueIn} /></div>
                        </div>
                        {gl ? (
                            <div className="sp-gr-kpi">
                                <div className="sp-gr-kpi-label">{t('count.kpi.glAfter')}</div>
                                <div className="sp-gr-kpi-value">
                                    <Money value={gl.glBalance} /> → <Money value={gl.glBalanceAfter} />
                                </div>
                            </div>
                        ) : null}
                    </div>
                    <p className="sp-gr-hint">{t('count.previewJe')}</p>

                    {gl ? (
                        gl.tied || gl.withinRounding ? (
                            <div className="sp-gr-ok">
                                {t('count.glTied', { gl: fixed2(gl.glBalance) })}
                                {!gl.tied ? ` ${t('count.glRounding', { diff: fixed2(gl.difference) })}` : ''}
                                {gl.roundingClear ? ` ${t('count.glRoundingClear', { amt: fixed2(Math.abs(gl.roundingClear)) })}` : ''}
                            </div>
                        ) : (
                            <div className="sp-gr-error" style={{ fontWeight: 500 }}>
                                <div style={{ fontWeight: 700 }}>
                                    {t('count.glLine', {
                                        stock: fixed2(gl.stockValue),
                                        gl: fixed2(gl.glBalance),
                                        diff: fixed2(gl.difference),
                                        after: fixed2(gl.glBalanceAfter),
                                    })}
                                </div>
                                <p style={{ margin: '6px 0' }}>{t('count.glWarn')}</p>
                                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                    <input type="checkbox" checked={ackGl} onChange={(e) => setAckGl(e.target.checked)} />
                                    <span>{t('count.glAck', { diff: fixed2(gl.difference) })}</span>
                                </label>
                            </div>
                        )
                    ) : null}

                    {review.summary.missingCostCount > 0 ? (
                        <div className="sp-gr-error">
                            {t('count.missingCost', { n: review.summary.missingCostCount })}{' '}
                            {(review.missingCost || []).slice(0, 8).map((m) => m.productName).join(', ')}
                        </div>
                    ) : null}
                    {review.summary.rowsChanged === 0 ? <div className="sp-gr-muted">{t('count.nothing')}</div> : null}

                    {mode === 'zero_all' && review.summary.rowsChanged > 0 ? (
                        <div className="sp-gr-form-grid" style={{ marginTop: 10 }}>
                            <label>
                                {t('count.typeZero', { word: zeroWord })}
                                <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
                            </label>
                        </div>
                    ) : null}

                    <div className="sp-gr-line-foot">
                        <button type="button" className="btn-portal" disabled={Boolean(busy) || !postReady} onClick={post}>
                            {busy === 'post' ? t('count.working') : t('count.confirmPost')}
                        </button>
                        <button type="button" className="btn-portal-outline" disabled={Boolean(busy)} onClick={resetReview}>
                            {t('count.editAgain')}
                        </button>
                    </div>
                </div>
            ) : null}
        </>
    );
}
