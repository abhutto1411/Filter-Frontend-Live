/**
 * SP-18 — Goods Receipts (Operations › Inbound). ONE feature with three views routed by URL:
 *   /supplier/goods_receipts            list (filters, KPIs, journal chip)
 *   /supplier/goods_receipts/new        receive goods (no vendor invoice needed)
 *   /supplier/goods_receipts/:id        detail (lines, links, chips, reverse, link invoice)
 *   /supplier/goods_receipts/:id/edit   edit a draft
 * Backend: SP-03 `/supplier/goods-receipts*` (journals Dr 1200 / Cr 2010 on post; the bill link
 * books Dr 2010 + Dr 1300 ± 6110 / Cr 2000). This page never computes or posts journals itself.
 *
 * `GoodsReceiptLinkDialog` is shared with the purchase-invoice panel ("Link GRs") so both sides
 * use the same dialog — there is no second link flow.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Modal from '../../components/Modal';
import SupplierJournalChip from './SupplierJournalChip';
import SearchableEntityCombobox from '../../components/SearchableEntityCombobox';
import SupplierRiyalAmount from './SupplierRiyalAmount';
import { grApiErrorMessage, grT } from '../../utils/supplierGoodsReceiptI18n';
import { SUPPLIER_PERM, useSupplierCan } from '../../utils/supplierPermissions';
import { toRiyadhDateISO } from '../../utils/riyadhBusinessRange';
import {
    createSupplierGoodsReceipt,
    fetchAllSupplierProducts,
    getSupplierInventoryStockBalances,
    getSupplierGoodsReceipt,
    getSupplierLocations,
    getSupplierPurchaseGoodsReceiptLinks,
    linkSupplierGoodsReceiptsToPurchase,
    listSupplierGoodsReceipts,
    listSupplierSuperSupplierPurchases,
    listSupplierSuperSuppliers,
    postSupplierGoodsReceipt,
    reverseSupplierGoodsReceipt,
    updateSupplierGoodsReceipt,
} from '../../services/supplierApi';
import './supplierPortal.css';

const BASE = '/supplier/goods_receipts';

/* ───────────── exact money helpers (BigInt, HALF_UP to 2 dp — no Math.round) ───────────── */

function toScaled(value, scale) {
    const s = String(value ?? '').trim();
    if (!s || !/^-?\d*(\.\d*)?$/.test(s)) return 0n;
    const neg = s.startsWith('-');
    const [i = '0', f = ''] = s.replace('-', '').split('.');
    const frac = (f + '0'.repeat(scale)).slice(0, scale);
    const extra = f.length > scale ? Number(f[scale]) : 0; // HALF_UP on the cut digit
    let n = BigInt(i || '0') * 10n ** BigInt(scale) + BigInt(frac || '0');
    if (extra >= 5) n += 1n;
    return neg ? -n : n;
}
function centsToStr(c) {
    const neg = c < 0n;
    const a = neg ? -c : c;
    return `${neg ? '-' : ''}${a / 100n}.${String(a % 100n).padStart(2, '0')}`;
}
/** money2(a × b) — qty (≤ 4 dp) × unit cost (≤ 4 dp), HALF_UP to 2 dp. */
function mulMoney(qty, cost) {
    const p = toScaled(qty, 4) * toScaled(cost, 4); // scale 8
    const neg = p < 0n;
    const a = neg ? -p : p;
    let cents = a / 1000000n;
    if (a % 1000000n >= 500000n) cents += 1n;
    return centsToStr(neg ? -cents : cents);
}
/**
 * MZ-03: the exact decimal string sent to the API for a qty (scale 3) or unit cost (scale 4).
 * A value that fits the scale is canonicalised through `toScaled` (no rounding happens);
 * anything else (too many decimals, '-1', 'abc') is sent as typed so the server rejects it
 * with a clear 400 instead of the client rounding it silently. Empty → '0'.
 */
function exactDec(value, scale) {
    const s = String(value ?? '').trim();
    if (s === '') return '0';
    const m = /^(\d*)(?:\.(\d*))?$/.exec(s);
    if (!m || (m[1] === '' && !m[2]) || (m[2] || '').length > scale) return s;
    const n = toScaled(s, scale);
    const unit = 10n ** BigInt(scale);
    return `${n / unit}.${String(n % unit).padStart(scale, '0')}`;
}
const addMoney = (...xs) => centsToStr(xs.reduce((s, x) => s + toScaled(x, 2), 0n));
const subMoney = (a, b) => centsToStr(toScaled(a, 2) - toScaled(b, 2));
const cmpQty = (a, b) => {
    const d = toScaled(a, 4) - toScaled(b, 4);
    return d > 0n ? 1 : d < 0n ? -1 : 0;
};
const fmtQty = (v) => {
    const n = Number(v || 0);
    return Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: 3 }) : '0';
};

/* ───────────── dates (persist UTC, show Asia/Riyadh) ───────────── */

function fmtRiyadh(iso, locale) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return `${d.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-GB', {
        timeZone: 'Asia/Riyadh',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })} Asia/Riyadh`;
}
/** `YYYY-MM-DDTHH:mm` for a datetime-local input, in Asia/Riyadh. */
function riyadhLocalInput(date = new Date()) {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Riyadh',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
        })
            .formatToParts(date)
            .map((p) => [p.type, p.value]),
    );
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
/** datetime-local (Riyadh wall clock) → ISO with +03:00 so the server stores the right UTC instant. */
const riyadhInputToIso = (v) => (v ? `${v}:00+03:00` : undefined);

/* ───────────── small pieces ───────────── */

const STATUS_STYLE = {
    draft: { bg: '#F1F5F9', fg: '#475569' },
    posted: { bg: '#FFFBEB', fg: '#92400E' },
    partially_invoiced: { bg: '#EFF6FF', fg: '#1E40AF' },
    invoiced: { bg: '#ECFDF5', fg: '#065F46' },
    reversed: { bg: '#FEF2F2', fg: '#B91C1C' },
};
function StatusPill({ status, t }) {
    const s = STATUS_STYLE[status] || STATUS_STYLE.draft;
    return (
        <span className="sp-gr-pill" style={{ background: s.bg, color: s.fg }}>
            {t(`status.${status}`)}
        </span>
    );
}

/** Reuses the Phase 5 `SupplierJournalChip`; the wrapper only makes it open the existing voucher. */
function JournalChipLink({ journalId, journalEntryNumber, caption, locale }) {
    const navigate = useNavigate();
    const chip = <SupplierJournalChip journalId={journalId} journalEntryNumber={journalEntryNumber} locale={locale} />;
    if (!journalId) return chip;
    return (
        <button
            type="button"
            className="sp-gr-chip-btn"
            onClick={(e) => {
                e.stopPropagation();
                navigate(`/supplier/accounting/journals/${encodeURIComponent(journalId)}`);
            }}
        >
            {caption ? <span className="sp-gr-chip-caption">{caption}</span> : null}
            {chip}
        </button>
    );
}

function Kpi({ label, children }) {
    return (
        <div className="sp-gr-kpi">
            <div className="sp-gr-kpi-label">{label}</div>
            <div className="sp-gr-kpi-value">{children}</div>
        </div>
    );
}

const money = (v, size = 13) => <SupplierRiyalAmount amount={Number(v || 0)} size={size} />;

/** Walk every page of the GR list (limit 200 per page) — never stop silently at one page. */
async function fetchAllGoodsReceipts(params = {}) {
    const out = [];
    let total = 0;
    for (let page = 0; page < 1000; page += 1) {
        const res = await listSupplierGoodsReceipts({ ...params, limit: 200, offset: out.length });
        const batch = Array.isArray(res?.goodsReceipts) ? res.goodsReceipts : [];
        total = Number(res?.total ?? 0) || 0;
        out.push(...batch);
        if (!batch.length || (total && out.length >= total) || (!total && batch.length < 200)) break;
    }
    return { items: out, total: total || out.length };
}

/* ═════════════════════════════ LIST ═════════════════════════════ */

function GoodsReceiptList({ locale, t }) {
    const can = useSupplierCan(); // SP-22 (API 403s the same actions)
    const navigate = useNavigate();
    const [status, setStatus] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [unmatched, setUnmatched] = useState(false);
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [all, setAll] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setErr('');
            try {
                const res = await fetchAllGoodsReceipts({
                    ...(unmatched ? { unmatchedOnly: 'true' } : status ? { status } : {}),
                    ...(dateFrom ? { dateFrom } : {}),
                    ...(dateTo ? { dateTo } : {}),
                });
                if (!cancelled) {
                    setRows(res.items);
                    setTotal(res.total);
                }
            } catch (e) {
                if (!cancelled) setErr(e?.message || t('list.err'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [status, dateFrom, dateTo, unmatched, t]);

    // KPIs come from the unfiltered list so they do not change with the table filters.
    useEffect(() => {
        let cancelled = false;
        fetchAllGoodsReceipts({})
            .then((res) => !cancelled && setAll(res.items))
            .catch(() => !cancelled && setAll([]));
        return () => {
            cancelled = true;
        };
    }, []);

    const kpis = useMemo(() => {
        const month = String(toRiyadhDateISO(new Date()) || '').slice(0, 7);
        const inMonth = (r) => String(r.businessDate || '').startsWith(month);
        return {
            openGrni: addMoney(...all.map((r) => r.grniOpen || 0)),
            postedThisMonth: all.filter((r) => inMonth(r) && !['draft', 'reversed'].includes(r.status)).length,
            waiting: all.filter((r) => ['posted', 'partially_invoiced'].includes(r.status)).length,
            linkedThisMonth: all.filter((r) => inMonth(r) && ['partially_invoiced', 'invoiced'].includes(r.status)).length,
        };
    }, [all]);

    return (
        <div>
            <div className="sp-gr-head">
                <div>
                    <h2 className="sp-gr-title">{t('list.title')}</h2>
                    <p className="sp-gr-sub">{t('list.subtitle')}</p>
                </div>
                <button type="button" className="btn-portal" disabled={!can(SUPPLIER_PERM.grPost)} title={can(SUPPLIER_PERM.grPost) ? undefined : t('perm.denied')} onClick={() => navigate(`${BASE}/new`)}>
                    {t('list.receive')}
                </button>
            </div>

            <div className="sp-gr-kpis">
                <Kpi label={t('list.kpi.openGrni')}>{money(kpis.openGrni, 15)}</Kpi>
                <Kpi label={t('list.kpi.postedThisMonth')}>{kpis.postedThisMonth}</Kpi>
                <Kpi label={t('list.kpi.waiting')}>{kpis.waiting}</Kpi>
                <Kpi label={t('list.kpi.linkedThisMonth')}>{kpis.linkedThisMonth}</Kpi>
            </div>

            <div className="sp-gr-card">
                <div className="sp-gr-filters">
                    <label>
                        {t('list.filter.status')}
                        <select value={status} disabled={unmatched} onChange={(e) => setStatus(e.target.value)}>
                            <option value="">{t('list.filter.all')}</option>
                            {['draft', 'posted', 'partially_invoiced', 'invoiced', 'reversed'].map((s) => (
                                <option key={s} value={s}>
                                    {t(`status.${s}`)}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        {t('list.filter.from')}
                        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                    </label>
                    <label>
                        {t('list.filter.to')}
                        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                    </label>
                    <label className="sp-gr-check">
                        <input type="checkbox" checked={unmatched} onChange={(e) => setUnmatched(e.target.checked)} />
                        {t('list.filter.unmatched')}
                    </label>
                    <span className="sp-gr-count">{t('list.count', { shown: rows.length, total })}</span>
                </div>

                {err ? <div className="sp-gr-error">{err}</div> : null}
                {loading ? (
                    <div className="sp-gr-muted">…</div>
                ) : rows.length === 0 ? (
                    <div className="sp-gr-muted">{t('list.empty')}</div>
                ) : (
                    <div className="sp-gr-table-wrap">
                        <table className="ws-table sp-gr-table">
                            <thead>
                                <tr>
                                    <th>{t('list.th.gr')}</th>
                                    <th>{t('list.th.received')}</th>
                                    <th>{t('list.th.warehouse')}</th>
                                    <th>{t('list.th.source')}</th>
                                    <th className="num">{t('list.th.lines')}</th>
                                    <th className="num">{t('list.th.accepted')}</th>
                                    <th className="num">{t('list.th.value')}</th>
                                    <th>{t('list.th.status')}</th>
                                    <th>{t('list.th.journal')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => (
                                    <tr
                                        key={r.id}
                                        className="sp-gr-row"
                                        tabIndex={0}
                                        onClick={() => navigate(`${BASE}/${encodeURIComponent(r.id)}`)}
                                        onKeyDown={(e) => e.key === 'Enter' && navigate(`${BASE}/${encodeURIComponent(r.id)}`)}
                                    >
                                        <td className="sp-gr-strong">{r.grNumber}</td>
                                        <td>{fmtRiyadh(r.receivedAt, locale)}</td>
                                        <td>{r.warehouseName || '—'}</td>
                                        <td>{r.sourceType === 'purchase_order' ? r.sourceRef || t('source.purchase_order') : t('source.manual')}</td>
                                        <td className="num">{r.lineCount}</td>
                                        <td className="num">{fmtQty(r.qtyAccepted)}</td>
                                        <td className="num">{money(r.totalValue)}</td>
                                        <td>
                                            <StatusPill status={r.status} t={t} />
                                        </td>
                                        <td>
                                            {r.journalId ? (
                                                <JournalChipLink
                                                    journalId={r.journalId}
                                                    journalEntryNumber={r.journalEntryNumber}
                                                    caption="Dr 1200 / Cr 2010"
                                                    locale={locale}
                                                />
                                            ) : (
                                                <SupplierJournalChip locale={locale} />
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ═════════════════════════════ CREATE / EDIT DRAFT ═════════════════════════════ */

const emptyLine = () => ({
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    supplierProductId: '',
    productLabel: '',
    qtyOrdered: '',
    qtyReceived: '',
    qtyAccepted: '',
    qtyRejected: '0',
    unitCost: '',
});

function GoodsReceiptForm({ t, editId }) {
    const can = useSupplierCan(); // SP-22 (API 403s the same actions)
    const navigate = useNavigate();
    const [locations, setLocations] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [products, setProducts] = useState([]);
    const [grNumber, setGrNumber] = useState('');
    const [warehouseId, setWarehouseId] = useState('');
    const [receivedAt, setReceivedAt] = useState(() => riyadhLocalInput());
    const [sourceType, setSourceType] = useState('manual');
    const [sourceRef, setSourceRef] = useState('');
    const [vendorId, setVendorId] = useState('');
    const [notes, setNotes] = useState('');
    const [lines, setLines] = useState([emptyLine()]);
    const [busy, setBusy] = useState('');
    const [err, setErr] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [locRes, venRes, prods, gr] = await Promise.all([
                    getSupplierLocations(),
                    listSupplierSuperSuppliers().catch(() => null),
                    fetchAllSupplierProducts({ status: 'active' }),
                    editId ? getSupplierGoodsReceipt(editId) : Promise.resolve(null),
                ]);
                if (cancelled) return;
                const locs = Array.isArray(locRes?.locations) ? locRes.locations : Array.isArray(locRes) ? locRes : [];
                setLocations(locs);
                const vens = Array.isArray(venRes?.superSuppliers) ? venRes.superSuppliers : Array.isArray(venRes) ? venRes : [];
                setVendors(vens);
                setProducts(Array.isArray(prods) ? prods : []);
                const g = gr?.goodsReceipt;
                if (g) {
                    if (g.status !== 'draft') {
                        navigate(`${BASE}/${encodeURIComponent(g.id)}`, { replace: true });
                        return;
                    }
                    setGrNumber(g.grNumber);
                    setWarehouseId(g.supplierLocationId || '');
                    setReceivedAt(riyadhLocalInput(new Date(g.receivedAt)));
                    setSourceType(g.sourceType || 'manual');
                    setSourceRef(g.sourceRef || '');
                    setVendorId(g.superSupplierId || '');
                    setNotes(g.notes || '');
                    setLines(
                        (g.lines || []).map((l) => ({
                            ...emptyLine(),
                            supplierProductId: l.supplierProductId,
                            productLabel: `${l.sku ? `${l.sku} · ` : ''}${l.productName}`,
                            qtyOrdered: l.qtyOrdered != null ? String(l.qtyOrdered) : '',
                            qtyReceived: String(l.qtyReceived),
                            qtyAccepted: String(l.qtyAccepted),
                            qtyRejected: String(l.qtyRejected),
                            unitCost: String(l.unitCost),
                        })),
                    );
                } else if (locs.length === 1) {
                    setWarehouseId(String(locs[0].id));
                }
            } catch (e) {
                if (!cancelled) setErr(e?.message || t('create.loadErr'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [editId, navigate, t]);

    const productLabel = (p) => `${p.sku ? `${p.sku} · ` : ''}${p.productName || p.product || p.name || p.id}`;
    const productById = useMemo(() => new Map(products.map((p) => [String(p.id), p])), [products]);

    /**
     * UoM comes from the Super Admin master catalog (backend resolves it on every product).
     * GRN quantities are in the warehouse unit; the rule shows what that equals in workshop units.
     */
    const productUom = useCallback(
        (p) => {
            if (!p) return null;
            const wh = String(p.warehouseUnit || p.unit || '').trim() || 'pcs';
            const ws = String(p.workshopUnit || '').trim() || wh;
            const cf = Number(p.conversionFactor) || 1;
            const rule =
                cf !== 1 || ws.toLowerCase() !== wh.toLowerCase()
                    ? t('create.uomRule', { wh, cf, ws })
                    : '';
            return { wh, ws, cf, rule };
        },
        [t],
    );

    const productOptions = useMemo(
        () =>
            products.map((p) => {
                const u = productUom(p);
                return {
                    id: String(p.id),
                    label: productLabel(p),
                    subtitle: [u?.wh, u?.rule].filter(Boolean).join(' · ') || null,
                    searchTokens: [p.sku, p.productName, p.name, p.categoryName].filter(Boolean),
                };
            }),
        [products, productUom],
    );

    const setLine = (key, patch) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
    const onProductText = (key, text) => setLine(key, { productLabel: text, supplierProductId: '' });
    /**
     * Unit cost is a PURCHASE cost per warehouse unit:
     *   1. last purchase price from the selected vendor (super supplier),
     *   2. else this product's moving-average cost,
     *   3. else blank — the user must type the vendor's cost.
     * Never the master-catalog / selling price (`basePrice` / `pricePerWarehouseUnit`).
     */
    const prefillUnitCost = async (key, p) => {
        try {
            const res = await getSupplierInventoryStockBalances({
                productId: String(p.id),
                limit: 1,
                offset: 0,
                historyLimit: 1,
                ...(vendorId ? { superSupplierId: String(vendorId) } : {}),
            });
            const row = Array.isArray(res?.items) ? res.items[0] : null;
            const u = productUom(p);
            let cost = null;
            let source = '';
            const lp = row?.lastPurchase;
            if (lp && Number(lp.unitPrice) > 0) {
                const unit = String(lp.unit || '').trim().toLowerCase();
                if (!unit || unit === u.wh.toLowerCase()) cost = Number(lp.unitPrice);
                else if (unit === u.ws.toLowerCase() && u.cf > 0) cost = Number(lp.unitPrice) * u.cf;
                if (cost != null) source = t('create.costFromLast', { date: lp.purchaseDate || '' });
            }
            if (cost == null && Number(row?.averageCostWarehouse) > 0) {
                cost = Number(row.averageCostWarehouse);
                source = t('create.costFromAvg');
            }
            setLines((ls) =>
                ls.map((l) =>
                    l.key === key && l.supplierProductId === String(p.id) && String(l.unitCost ?? '') === ''
                        ? {
                              ...l,
                              unitCost: cost != null ? String(Math.round(cost * 10000) / 10000) : '',
                              costHint: cost != null ? source : t('create.costEnter'),
                          }
                        : l,
                ),
            );
        } catch {
            setLines((ls) => ls.map((l) => (l.key === key ? { ...l, costHint: t('create.costEnter') } : l)));
        }
    };

    const onProductSelect = (key, opt) => {
        const p = opt ? productById.get(String(opt.id)) : null;
        setLine(key, {
            productLabel: p ? productLabel(p) : '',
            supplierProductId: p ? String(p.id) : '',
            unitCost: '',
            costHint: '',
        });
        if (p) void prefillUnitCost(key, p);
    };
    const onReceived = (key, v) =>
        setLines((ls) =>
            ls.map((l) => {
                if (l.key !== key) return l;
                // keep accepted = received − rejected until the user types an accepted figure
                const autoAccepted = l.qtyAccepted === '' || cmpQty(l.qtyAccepted, subQty(l.qtyReceived, l.qtyRejected)) === 0;
                return { ...l, qtyReceived: v, ...(autoAccepted ? { qtyAccepted: subQty(v, l.qtyRejected) } : {}) };
            }),
        );
    const onRejected = (key, v) =>
        setLines((ls) => ls.map((l) => (l.key === key ? { ...l, qtyRejected: v, qtyAccepted: subQty(l.qtyReceived, v) } : l)));

    const lineValue = (l) => mulMoney(l.qtyAccepted || 0, l.unitCost || 0);
    const totalValue = addMoney(...lines.map(lineValue));

    const validate = (forPost) => {
        if (!lines.length) return t('create.err.lines');
        for (let i = 0; i < lines.length; i += 1) {
            const l = lines[i];
            if (!l.supplierProductId) return t('create.err.product', { n: i + 1 });
            if (cmpQty(addQty(l.qtyAccepted, l.qtyRejected), l.qtyReceived || 0) > 0) return t('create.err.split', { n: i + 1 });
        }
        if (forPost) {
            if (!warehouseId) return t('create.err.warehouse');
            if (!lines.some((l) => cmpQty(l.qtyAccepted || 0, 0) > 0)) return t('create.err.accepted');
        }
        return '';
    };

    const payload = () => ({
        supplierLocationId: warehouseId || undefined,
        receivedAt: riyadhInputToIso(receivedAt),
        sourceType,
        sourceRef: sourceType === 'purchase_order' ? sourceRef.trim() || undefined : undefined,
        superSupplierId: vendorId || undefined,
        notes: notes.trim() || undefined,
        lines: lines.map((l) => ({
            supplierProductId: l.supplierProductId,
            ...(l.qtyOrdered !== '' ? { qtyOrdered: exactDec(l.qtyOrdered, 3) } : {}),
            qtyReceived: exactDec(l.qtyReceived, 3),
            qtyAccepted: exactDec(l.qtyAccepted, 3),
            qtyRejected: exactDec(l.qtyRejected, 3),
            unitCost: exactDec(l.unitCost, 4),
        })),
    });

    const save = async (post) => {
        const v = validate(post);
        if (v) {
            setErr(v);
            return;
        }
        if (post && !window.confirm(t('create.confirmPost', { gr: grNumber || t('create.title') }))) return;
        setBusy(post ? 'post' : 'draft');
        setErr('');
        try {
            let id = editId;
            if (editId) {
                await updateSupplierGoodsReceipt(editId, payload());
                if (post) await postSupplierGoodsReceipt(editId);
            } else {
                const res = await createSupplierGoodsReceipt({ ...payload(), post });
                id = res?.goodsReceipt?.id ?? res?.id;
            }
            navigate(id ? `${BASE}/${encodeURIComponent(id)}` : BASE);
        } catch (e) {
            setErr(e?.message || 'Error');
        } finally {
            setBusy('');
        }
    };

    if (loading) return <div className="sp-gr-muted">…</div>;
    return (
        <div>
            <div className="sp-gr-head">
                <div>
                    <h2 className="sp-gr-title">{editId ? t('create.editTitle', { gr: grNumber }) : t('create.title')}</h2>
                    <p className="sp-gr-sub">{t('create.subtitle')}</p>
                </div>
                <div className="sp-gr-actions">
                    <button type="button" className="btn-portal-outline" disabled={Boolean(busy)} onClick={() => navigate(editId ? `${BASE}/${encodeURIComponent(editId)}` : BASE)}>
                        {t('create.cancel')}
                    </button>
                    <button type="button" className="btn-portal-outline" disabled={Boolean(busy) || !can(SUPPLIER_PERM.grPost)} title={can(SUPPLIER_PERM.grPost) ? undefined : t('perm.denied')} onClick={() => save(false)}>
                        {busy === 'draft' ? t('create.saving') : t('create.saveDraft')}
                    </button>
                    <button type="button" className="btn-portal" disabled={Boolean(busy) || !can(SUPPLIER_PERM.grPost)} title={can(SUPPLIER_PERM.grPost) ? undefined : t('perm.denied')} onClick={() => save(true)}>
                        {busy === 'post' ? t('create.saving') : t('create.post')}
                    </button>
                </div>
            </div>

            <div className="sp-gr-banner">{t('create.banner')}</div>
            {err ? <div className="sp-gr-error">{err}</div> : null}

            <div className="sp-gr-card sp-gr-form-grid">
                <label>
                    {t('create.warehouse')}
                    <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                        <option value="">{t('create.warehousePick')}</option>
                        {locations.map((l) => (
                            <option key={l.id} value={String(l.id)}>
                                {l.name}
                            </option>
                        ))}
                    </select>
                </label>
                <label>
                    {t('create.receivedAt')}
                    <input type="datetime-local" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} />
                </label>
                <label>
                    {t('create.source')}
                    <select value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
                        <option value="manual">{t('create.sourceManual')}</option>
                        <option value="purchase_order">{t('create.sourcePo')}</option>
                    </select>
                </label>
                {sourceType === 'purchase_order' ? (
                    <label>
                        {t('create.sourceRef')}
                        <input value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} />
                    </label>
                ) : null}
                <label>
                    {t('create.vendor')}
                    <select value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
                        <option value="">{t('create.vendorNone')}</option>
                        {vendors.map((v) => (
                            <option key={v.id} value={String(v.id)}>
                                {v.name}
                            </option>
                        ))}
                    </select>
                    <span className="sp-gr-hint">{t('create.vendorHint')}</span>
                </label>
                <label className="sp-gr-span2">
                    {t('create.notes')}
                    <input value={notes} onChange={(e) => setNotes(e.target.value)} />
                </label>
            </div>

            <div className="sp-gr-card">
                <div className="sp-gr-table-wrap">
                    <table className="ws-table sp-gr-table sp-gr-lines">
                        <thead>
                            <tr>
                                <th>{t('create.th.product')}</th>
                                <th>{t('create.th.uom')}</th>
                                {sourceType === 'purchase_order' ? <th className="num">{t('create.th.ordered')}</th> : null}
                                <th className="num">{t('create.th.received')}</th>
                                <th className="num">{t('create.th.accepted')}</th>
                                <th className="num">{t('create.th.rejected')}</th>
                                <th className="num">{t('create.th.unitCost')}</th>
                                <th className="num">{t('create.th.lineValue')}</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {lines.map((l) => {
                                const u = productUom(productById.get(String(l.supplierProductId)));
                                const wsQty =
                                    u && u.cf !== 1 && String(l.qtyAccepted || '').trim() !== ''
                                        ? Math.round(Number(l.qtyAccepted) * u.cf * 1000) / 1000
                                        : null;
                                return (
                                <tr key={l.key}>
                                    <td className={l.productLabel && !l.supplierProductId ? 'sp-gr-invalid' : ''}>
                                        <SearchableEntityCombobox
                                            options={productOptions}
                                            value={l.supplierProductId}
                                            displayText={l.productLabel}
                                            onDisplayTextChange={(text) => onProductText(l.key, text)}
                                            onSelect={(opt) => onProductSelect(l.key, opt)}
                                            placeholder={t('create.productPick')}
                                            emptyHint={t('create.noProductMatches')}
                                            entityLabel="product"
                                            menuMinWidth={420}
                                            maxFiltered={80}
                                        />
                                    </td>
                                    <td>
                                        {u ? (
                                            <div>
                                                <strong>{u.wh}</strong>
                                                {u.rule ? <div className="sp-gr-hint">{u.rule}</div> : null}
                                                {wsQty != null && Number.isFinite(wsQty) ? (
                                                    <div className="sp-gr-hint">{t('create.uomEquals', { qty: wsQty, ws: u.ws })}</div>
                                                ) : null}
                                            </div>
                                        ) : (
                                            <span className="sp-gr-hint">—</span>
                                        )}
                                    </td>
                                    {sourceType === 'purchase_order' ? (
                                        <td className="num">
                                            <input inputMode="decimal" value={l.qtyOrdered} onChange={(e) => setLine(l.key, { qtyOrdered: e.target.value })} />
                                        </td>
                                    ) : null}
                                    <td className="num">
                                        <input inputMode="decimal" value={l.qtyReceived} onChange={(e) => onReceived(l.key, e.target.value)} />
                                    </td>
                                    <td className="num">
                                        <input inputMode="decimal" value={l.qtyAccepted} onChange={(e) => setLine(l.key, { qtyAccepted: e.target.value })} />
                                    </td>
                                    <td className="num">
                                        <input inputMode="decimal" value={l.qtyRejected} onChange={(e) => onRejected(l.key, e.target.value)} />
                                    </td>
                                    <td className="num">
                                        <input inputMode="decimal" value={l.unitCost} onChange={(e) => setLine(l.key, { unitCost: e.target.value, costHint: "" })} />
                                        {l.costHint ? <div className="sp-gr-hint">{l.costHint}</div> : null}
                                    </td>
                                    <td className="num">{money(lineValue(l))}</td>
                                    <td>
                                        {lines.length > 1 ? (
                                            <button type="button" className="sp-gr-link-btn" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
                                                {t('create.removeLine')}
                                            </button>
                                        ) : null}
                                    </td>
                                </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={sourceType === 'purchase_order' ? 7 : 6} className="sp-gr-strong">
                                    {t('create.total')}
                                </td>
                                <td className="num sp-gr-strong">{money(totalValue)}</td>
                                <td />
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <div className="sp-gr-line-foot">
                    <button type="button" className="btn-portal-outline" onClick={() => setLines((ls) => [...ls, emptyLine()])}>
                        {t('create.addLine')}
                    </button>
                    <span className="sp-gr-hint">{t('create.rejectedNote')}</span>
                </div>
            </div>
        </div>
    );
}

/** qty helpers on strings (3–4 dp) for the auto accepted = received − rejected split. */
function qtyStr(n) {
    const neg = n < 0n;
    const a = neg ? -n : n;
    const i = a / 10000n;
    const f = String(a % 10000n).padStart(4, '0').replace(/0+$/, '');
    return `${neg ? '-' : ''}${i}${f ? `.${f}` : ''}`;
}
function subQty(a, b) {
    if (String(a ?? '').trim() === '') return '';
    const d = toScaled(a, 4) - toScaled(b || 0, 4);
    return qtyStr(d < 0n ? 0n : d);
}
const addQty = (a, b) => qtyStr(toScaled(a || 0, 4) + toScaled(b || 0, 4));

/* ═════════════════════════════ DETAIL ═════════════════════════════ */

function GoodsReceiptDetail({ id, locale, t }) {
    const can = useSupplierCan(); // SP-22 (API 403s the same actions)
    const navigate = useNavigate();
    const [gr, setGr] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState('');
    const [linkOpen, setLinkOpen] = useState(false);
    const [flash, setFlash] = useState('');

    const load = useCallback(async () => {
        setErr('');
        try {
            const res = await getSupplierGoodsReceipt(id);
            setGr(res?.goodsReceipt || null);
        } catch (e) {
            setErr(e?.message || t('detail.err'));
        } finally {
            setLoading(false);
        }
    }, [id, t]);

    useEffect(() => {
        load();
    }, [load]);

    const reverse = async () => {
        const reason = window.prompt(t('detail.reverseReason', { gr: gr.grNumber }));
        if (reason == null) return;
        setBusy('reverse');
        setErr('');
        try {
            await reverseSupplierGoodsReceipt(gr.id, { reason: reason.trim() || undefined });
            await load();
        } catch (e) {
            setErr(e?.message || 'Error');
        } finally {
            setBusy('');
        }
    };
    const postDraft = async () => {
        if (!window.confirm(t('create.confirmPost', { gr: gr.grNumber }))) return;
        setBusy('post');
        setErr('');
        try {
            await postSupplierGoodsReceipt(gr.id);
            await load();
        } catch (e) {
            setErr(e?.message || 'Error');
        } finally {
            setBusy('');
        }
    };

    if (loading) return <div className="sp-gr-muted">…</div>;
    if (!gr) return <div className="sp-gr-error">{err || t('detail.err')}</div>;

    const acceptedQty = (gr.lines || []).reduce((s, l) => s + toScaled(l.qtyAccepted, 4), 0n);
    const clearing = [];
    const seen = new Set();
    for (const l of gr.links || []) {
        if (l.clearingJournalId && !seen.has(l.clearingJournalId)) {
            seen.add(l.clearingJournalId);
            clearing.push(l);
        }
    }

    return (
        <div>
            <button type="button" className="sp-gr-link-btn" onClick={() => navigate(BASE)}>
                {t('detail.back')}
            </button>
            <div className="sp-gr-head">
                <div>
                    <h2 className="sp-gr-title">{gr.grNumber}</h2>
                    <p className="sp-gr-sub">
                        {t('detail.meta', {
                            status: t(`status.${gr.status}`),
                            when: fmtRiyadh(gr.postedAt || gr.receivedAt, locale),
                            warehouse: gr.warehouseName || '—',
                        })}
                        {(gr.links || []).length === 0 ? ` · ${t('detail.noInvoice')}` : ''}
                        {gr.superSupplierName ? ` · ${t('detail.vendor', { name: gr.superSupplierName })}` : ''}
                        {gr.sourceType === 'purchase_order' && gr.sourceRef ? ` · ${gr.sourceRef}` : ''}
                    </p>
                </div>
                <div className="sp-gr-actions">
                    {gr.status === 'draft' ? (
                        <>
                            <button type="button" className="btn-portal-outline" disabled={Boolean(busy) || !can(SUPPLIER_PERM.grPost)} title={can(SUPPLIER_PERM.grPost) ? undefined : t('perm.denied')} onClick={() => navigate(`${BASE}/${encodeURIComponent(gr.id)}/edit`)}>
                                {t('detail.edit')}
                            </button>
                            <button type="button" className="btn-portal" disabled={Boolean(busy) || !can(SUPPLIER_PERM.grPost)} title={can(SUPPLIER_PERM.grPost) ? undefined : t('perm.denied')} onClick={postDraft}>
                                {t('detail.postDraft')}
                            </button>
                        </>
                    ) : null}
                    {gr.status === 'posted' ? (
                        <button
                            type="button"
                            className="btn-portal-outline"
                            disabled={Boolean(busy) || !gr.canReverse || !can(SUPPLIER_PERM.grReverse)}
                            title={!can(SUPPLIER_PERM.grReverse) ? t('perm.denied') : gr.canReverse ? undefined : t('detail.reverseHint')}
                            onClick={reverse}
                        >
                            {t('detail.reverse')}
                        </button>
                    ) : null}
                    {gr.canLink ? (
                        <button type="button" className="btn-portal" disabled={Boolean(busy) || !can(SUPPLIER_PERM.billPost)} title={can(SUPPLIER_PERM.billPost) ? undefined : t('perm.denied')} onClick={() => setLinkOpen(true)}>
                            {t('detail.link')}
                        </button>
                    ) : null}
                </div>
            </div>

            {err ? <div className="sp-gr-error">{err}</div> : null}
            {flash ? <div className="sp-gr-ok">{flash}</div> : null}
            {gr.status === 'reversed' ? (
                <div className="sp-gr-error">
                    {t('detail.reversed', { when: fmtRiyadh(gr.reversedAt, locale), reason: gr.reversalReason ? ` — ${gr.reversalReason}` : '' })}
                </div>
            ) : null}

            <div className="sp-gr-kpis">
                <Kpi label={t('detail.kpi.accepted')}>{fmtQty(qtyStr(acceptedQty))}</Kpi>
                <Kpi label={t('detail.kpi.value')}>{money(gr.totalValue, 15)}</Kpi>
                <Kpi label={t('detail.kpi.toInvoice')}>{money(gr.grniOpen, 15)}</Kpi>
                <Kpi label={t('detail.kpi.status')}>{t(`status.${gr.status}`)}</Kpi>
            </div>

            {gr.journalId || clearing.length ? (
                <>
                    <div className="sp-gr-note">{t('detail.chipHint')}</div>
                    <div className="sp-gr-chips">
                        {gr.journalId ? (
                            <JournalChipLink
                                journalId={gr.journalId}
                                journalEntryNumber={gr.journalEntryNumber}
                                caption={t('detail.grChip', { amt: addMoney(gr.totalValue) })}
                                locale={locale}
                            />
                        ) : null}
                        {clearing.map((l) => (
                            <JournalChipLink
                                key={l.clearingJournalId}
                                journalId={l.clearingJournalId}
                                journalEntryNumber={l.clearingJournalEntryNumber}
                                caption={`${t('detail.clearChip')} · ${l.invoiceNo}`}
                                locale={locale}
                            />
                        ))}
                    </div>
                </>
            ) : null}

            <div className="sp-gr-card">
                <div className="sp-gr-table-wrap">
                    <table className="ws-table sp-gr-table">
                        <thead>
                            <tr>
                                <th>{t('detail.th.product')}</th>
                                <th className="num">{t('detail.th.received')}</th>
                                <th className="num">{t('detail.th.accepted')}</th>
                                <th className="num">{t('detail.th.rejected')}</th>
                                <th className="num">{t('detail.th.unitCost')}</th>
                                <th className="num">{t('detail.th.value')}</th>
                                <th className="num">{t('detail.th.invoiced')}</th>
                                <th className="num">{t('detail.th.remaining')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(gr.lines || []).map((l) => (
                                <tr key={l.id}>
                                    <td>
                                        {l.productName}
                                        {l.sku ? <span className="sp-gr-hint"> · {l.sku}</span> : null}
                                    </td>
                                    <td className="num">{fmtQty(l.qtyReceived)}{l.unit ? <span className="sp-gr-hint"> {l.unit}</span> : null}</td>
                                    <td className="num">{fmtQty(l.qtyAccepted)}{l.unit ? <span className="sp-gr-hint"> {l.unit}</span> : null}</td>
                                    <td className="num">{fmtQty(l.qtyRejected)}</td>
                                    <td className="num">{money(l.unitCost)}</td>
                                    <td className="num">{money(l.lineValue)}</td>
                                    <td className="num">{fmtQty(l.qtyInvoiced)}</td>
                                    <td className="num">{fmtQty(l.qtyRemainingToInvoice)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {gr.notes ? (
                    <div className="sp-gr-hint" style={{ marginTop: 8 }}>
                        {t('detail.notesLabel')}: {gr.notes}
                    </div>
                ) : null}
            </div>

            {(gr.links || []).length ? (
                <div className="sp-gr-card">
                    <h3 className="sp-gr-h3">{t('detail.links')}</h3>
                    <div className="sp-gr-table-wrap">
                        <table className="ws-table sp-gr-table">
                            <thead>
                                <tr>
                                    <th>{t('detail.th.invoice')}</th>
                                    <th className="num">{t('detail.th.qty')}</th>
                                    <th className="num">{t('detail.th.grValue')}</th>
                                    <th>{t('detail.th.clearing')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {gr.links.map((l) => (
                                    <tr key={l.id}>
                                        <td>
                                            {l.invoiceNo}
                                            {l.purchaseReferenceNo ? <span className="sp-gr-hint"> · {l.purchaseReferenceNo}</span> : null}
                                        </td>
                                        <td className="num">{fmtQty(l.qtyInvoiced)}</td>
                                        <td className="num">{money(l.grValue)}</td>
                                        <td>
                                            <JournalChipLink journalId={l.clearingJournalId} journalEntryNumber={l.clearingJournalEntryNumber} locale={locale} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : null}

            {linkOpen ? (
                <GoodsReceiptLinkDialog
                    locale={locale}
                    goodsReceipt={gr}
                    onClose={() => setLinkOpen(false)}
                    onLinked={(summary) => {
                        setLinkOpen(false);
                        setFlash(
                            t('link.done', {
                                matched: addMoney(summary?.matchedGrValue ?? 0),
                                ppv: addMoney(summary?.purchasePriceVariance ?? 0),
                            }),
                        );
                        load();
                    }}
                />
            ) : null}
        </div>
    );
}

/* ═════════════════════════════ LINK DIALOG (shared with the bill panel) ═════════════════════════════ */

/**
 * Link goods-receipt lines to a vendor bill.
 *   - from a GR:   pass `goodsReceipt` (detail payload) → choose the bill.
 *   - from a bill: pass `purchase` ({ id, invoiceNo, superSupplierId }) → choose an open GR.
 * Preview (display only; the server is authoritative):
 *   new GR value per line = qty = remaining ? lineValue − already linked : money2(qty × unitCost)
 *   matched = bill's matched GR value before + Σ new
 *   PPV = bill ex-VAT − matched;  Cr 2000 = matched + VAT + PPV (= bill total)
 */
export function GoodsReceiptLinkDialog({ locale = 'en', goodsReceipt = null, purchase = null, onClose, onLinked }) {
    const can = useSupplierCan(); // SP-22 (API 403s the same actions)
    const t = useCallback((key, vars) => grT(locale, key, vars), [locale]);
    const navigate = useNavigate();
    const [gr, setGr] = useState(goodsReceipt);
    const [grOptions, setGrOptions] = useState([]);
    const [bills, setBills] = useState([]);
    const [billId, setBillId] = useState(purchase ? String(purchase.id) : '');
    const [billSummary, setSummary] = useState(null);
    const summary = billId ? billSummary : null;
    // default: link everything still open on the GR
    const defaultQty = (g) =>
        Object.fromEntries(
            (g?.lines || [])
                .filter((l) => cmpQty(l.qtyRemainingToInvoice, 0) > 0)
                .map((l) => [l.id, String(l.qtyRemainingToInvoice)]),
        );
    const [qty, setQty] = useState(() => defaultQty(goodsReceipt));
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');

    // bill mode: list open GRs (same vendor, or GRs with no vendor yet)
    useEffect(() => {
        if (!purchase) return undefined;
        let cancelled = false;
        fetchAllGoodsReceipts({ unmatchedOnly: 'true' })
            .then((res) => {
                if (cancelled) return;
                setGrOptions(
                    res.items.filter((g) => !g.superSupplierId || String(g.superSupplierId) === String(purchase.superSupplierId)),
                );
            })
            .catch((e) => !cancelled && setErr(e?.message || ''))
            .finally(() => !cancelled && setLoading(false));
        return () => {
            cancelled = true;
        };
    }, [purchase]);

    // GR mode: list the vendor's bills
    useEffect(() => {
        if (purchase) return undefined;
        let cancelled = false;
        listSupplierSuperSupplierPurchases({
            limit: 200,
            offset: 0,
            ...(goodsReceipt?.superSupplierId ? { superSupplierId: goodsReceipt.superSupplierId } : {}),
        })
            .then((res) => !cancelled && setBills(Array.isArray(res?.purchases) ? res.purchases : []))
            .catch((e) => !cancelled && setErr(e?.message || ''))
            .finally(() => !cancelled && setLoading(false));
        return () => {
            cancelled = true;
        };
    }, [purchase, goodsReceipt]);

    // bill summary (ex-VAT, VAT, already matched)
    useEffect(() => {
        if (!billId) return undefined;
        let cancelled = false;
        getSupplierPurchaseGoodsReceiptLinks(billId)
            .then((res) => !cancelled && setSummary(res))
            .catch((e) => !cancelled && setErr(e?.message || ''));
        return () => {
            cancelled = true;
        };
    }, [billId]);

    const pickGr = async (id) => {
        setGr(null);
        setQty({});
        if (!id) return;
        try {
            const res = await getSupplierGoodsReceipt(id);
            setGr(res?.goodsReceipt || null);
            setQty(defaultQty(res?.goodsReceipt));
        } catch (e) {
            setErr(e?.message || '');
        }
    };

    const openLines = (gr?.lines || []).filter((l) => cmpQty(l.qtyRemainingToInvoice, 0) > 0);
    const linkedByLine = useMemo(() => {
        const m = new Map();
        for (const l of gr?.links || []) m.set(l.goodsReceiptLineId, addMoney(m.get(l.goodsReceiptLineId) || 0, l.grValue));
        return m;
    }, [gr]);
    const lineNewValue = (l) => {
        const q = qty[l.id];
        if (!q || cmpQty(q, 0) <= 0) return '0.00';
        if (cmpQty(q, l.qtyRemainingToInvoice) === 0) return subMoney(l.lineValue, linkedByLine.get(l.id) || 0);
        return mulMoney(q, l.unitCost);
    };
    const newValue = addMoney(...openLines.map(lineNewValue));
    const exVat = summary ? addMoney(summary.invoiceExVat) : '0.00';
    const vat = summary ? addMoney(summary.vatAmount) : '0.00';
    const matched = addMoney(summary?.matchedGrValue ?? 0, newValue);
    const ppv = subMoney(exVat, matched);
    const ap = addMoney(matched, vat, ppv);
    const ppvNeg = toScaled(ppv, 2) < 0n;
    const ppvAbs = ppvNeg ? ppv.slice(1) : ppv;

    const confirm = async () => {
        const allocations = openLines
            .filter((l) => qty[l.id] && cmpQty(qty[l.id], 0) > 0)
            .map((l) => ({ goodsReceiptLineId: l.id, qty: exactDec(qty[l.id], 3) }));
        if (!allocations.length) {
            setErr(t('link.err.none'));
            return;
        }
        const over = openLines.find((l) => qty[l.id] && cmpQty(qty[l.id], l.qtyRemainingToInvoice) > 0);
        if (over) {
            setErr(t('link.err.over', { product: over.productName, remaining: fmtQty(over.qtyRemainingToInvoice) }));
            return;
        }
        setBusy(true);
        setErr('');
        try {
            const res = await linkSupplierGoodsReceiptsToPurchase({ purchaseId: billId, allocations });
            onLinked?.(res);
        } catch (e) {
            setErr(grApiErrorMessage(locale, e, 'Error'));
        } finally {
            setBusy(false);
        }
    };

    const title = purchase
        ? t('link.titleBill', { invoice: purchase.invoiceNo || `SSP-${purchase.id}` })
        : t('link.title', { gr: goodsReceipt?.grNumber || '' });

    return (
        <Modal
            title={title}
            width="min(860px, 98vw)"
            onClose={busy ? undefined : onClose}
            footer={
                <div className="sp-gr-actions">
                    <button type="button" className="btn-portal-outline" disabled={busy} onClick={onClose}>
                        {t('link.cancel')}
                    </button>
                    <button type="button" className="btn-portal" disabled={busy || !billId || !gr || !openLines.length || !can(SUPPLIER_PERM.billPost)} onClick={confirm}>
                        {busy ? t('link.confirming') : t('link.confirm')}
                    </button>
                </div>
            }
        >
            <div className="sp-gr-dialog" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
                <p className="sp-gr-sub">{t('link.subtitle')}</p>
                {err ? <div className="sp-gr-error">{err}</div> : null}

                <div className="sp-gr-form-grid">
                    {purchase ? (
                        <label className="sp-gr-span2">
                            {t('link.gr')}
                            <select value={gr?.id || ''} onChange={(e) => pickGr(e.target.value)} disabled={loading}>
                                <option value="">{t('link.grPick')}</option>
                                {grOptions.map((g) => (
                                    <option key={g.id} value={g.id}>
                                        {g.grNumber} · {g.businessDate} · {g.warehouseName || '—'} · {addMoney(g.grniOpen)}
                                    </option>
                                ))}
                            </select>
                            {!loading && !grOptions.length ? <span className="sp-gr-hint">{t('link.noGrs')}</span> : null}
                        </label>
                    ) : (
                        <label>
                            {t('link.invoice')}
                            <select value={billId} onChange={(e) => setBillId(e.target.value)} disabled={loading}>
                                <option value="">{t('link.invoicePick')}</option>
                                {bills.map((b) => (
                                    <option key={b.id} value={b.id}>
                                        {b.invoiceNo} · {b.superSupplierName || '—'} · {b.purchaseDate} · {b.status}
                                    </option>
                                ))}
                            </select>
                            {!loading && !bills.length ? <span className="sp-gr-hint">{t('link.noBills')}</span> : null}
                            <button type="button" className="sp-gr-link-btn" onClick={() => navigate('/supplier/purchase_invoices')}>
                                {t('link.createBill')}
                            </button>
                        </label>
                    )}
                    <div>
                        <div className="sp-gr-kpi-label">{t('link.invoiceEx')}</div>
                        <div className="sp-gr-strong">{summary ? money(exVat, 14) : '—'}</div>
                    </div>
                    <div>
                        <div className="sp-gr-kpi-label">{t('link.vat')}</div>
                        <div className="sp-gr-strong">{summary ? money(vat, 14) : '—'}</div>
                    </div>
                </div>
                <div className="sp-gr-hint">{t('link.draftOnly')}</div>
                {summary && Number(summary.matchedGrValue) ? (
                    <div className="sp-gr-hint">{t('link.existing', { amt: addMoney(summary.matchedGrValue) })}</div>
                ) : null}

                {gr && openLines.length ? (
                    <div className="sp-gr-table-wrap" style={{ marginTop: 10 }}>
                        <table className="ws-table sp-gr-table">
                            <thead>
                                <tr>
                                    <th>{t('link.th.product')}</th>
                                    <th className="num">{t('link.th.remaining')}</th>
                                    <th className="num">{t('link.th.unitCost')}</th>
                                    <th className="num">{t('link.th.qty')}</th>
                                    <th className="num">{t('link.th.grValue')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {openLines.map((l) => (
                                    <tr key={l.id}>
                                        <td>{l.productName}</td>
                                        <td className="num">{fmtQty(l.qtyRemainingToInvoice)}</td>
                                        <td className="num">{money(l.unitCost)}</td>
                                        <td className="num">
                                            <input inputMode="decimal" value={qty[l.id] ?? ''} onChange={(e) => setQty((q) => ({ ...q, [l.id]: e.target.value }))} />
                                        </td>
                                        <td className="num">{money(lineNewValue(l))}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : null}

                {summary && gr ? (
                    <div className="sp-gr-card" style={{ marginTop: 12 }}>
                        <h3 className="sp-gr-h3">{t('link.preview')}</h3>
                        <table className="ws-table sp-gr-table">
                            <thead>
                                <tr>
                                    <th />
                                    <th className="num">{t('link.amount')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>{t('link.drGrni')}</td>
                                    <td className="num">{money(matched)}</td>
                                </tr>
                                <tr>
                                    <td>{t('link.drVat')}</td>
                                    <td className="num">{money(vat)}</td>
                                </tr>
                                {toScaled(ppv, 2) !== 0n ? (
                                    <tr>
                                        <td>{ppvNeg ? t('link.ppvCr') : t('link.ppvDr')}</td>
                                        <td className="num">{money(ppvAbs)}</td>
                                    </tr>
                                ) : null}
                                <tr>
                                    <td>{t('link.crAp')}</td>
                                    <td className="num">{money(ap)}</td>
                                </tr>
                            </tbody>
                        </table>
                        <div className="sp-gr-hint" style={{ marginTop: 6 }}>
                            {t('link.identity', { grni: matched, vat, ppvSign: ppvNeg ? '−' : '+', ppv: ppvAbs, ap })}
                        </div>
                        <div className="sp-gr-hint">{t('link.previewNote')}</div>
                    </div>
                ) : null}
            </div>
        </Modal>
    );
}

/* ═════════════════════════════ ROUTER (one feature) ═════════════════════════════ */

export default function SupplierGoodsReceipts({ locale = 'en' }) {
    const t = useCallback((key, vars) => grT(locale, key, vars), [locale]);
    const { pathname } = useLocation();
    const rest = pathname.replace(/^\/supplier\/goods_receipts\/?/, '');
    const [first, second] = rest.split('/').filter(Boolean);
    let view;
    if (!first) view = <GoodsReceiptList locale={locale} t={t} />;
    else if (first === 'new') view = <GoodsReceiptForm t={t} />;
    else if (second === 'edit') view = <GoodsReceiptForm t={t} editId={decodeURIComponent(first)} />;
    else view = <GoodsReceiptDetail key={first} id={decodeURIComponent(first)} locale={locale} t={t} />;
    return (
        <div className="sp-gr-page" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
            {view}
        </div>
    );
}
