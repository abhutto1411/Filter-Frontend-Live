import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertCircle,
    AlertTriangle,
    BarChart3,
    FileText,
    Loader,
    Plus,
    RotateCcw,
    Target,
    Trash2,
    TrendingUp,
} from 'lucide-react';
import Modal from '../../../components/Modal';
import UiPager from '../../../components/UiPager';
import { usePagedRows } from '../../../hooks/usePagedRows';
import { useStorageFacilityApi } from './StorageFacilityPortalContext';
import { useSfT } from './useSfT';
import { sfMoney, sfDate } from './sfFormat';
import { toRiyadhDateISO } from '../../../utils/riyadhBusinessRange';
import '../../../styles/ui.css';

function firstDayOfMonthISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function todayISO() {
    return toRiyadhDateISO();
}

/** The tone that carries the verdict, for the pill and the progress fill. */
const STATUS_TONE = {
    exceeded: 'ok',
    on_track: 'info',
    at_risk: 'warn',
    critical: 'dang',
    no_activity: 'neutral',
    no_target: 'neutral',
};

function barTone(pct) {
    if (pct == null) return '';
    if (pct >= 100) return 'ok';
    if (pct >= 75) return 'info';
    if (pct >= 50) return 'warn';
    return 'dang';
}

export default function StorageFacilitySalesRepPerformancePanel({
    brandId,
    initialSalesRepId = '',
    onSalesRepIdChange,
}) {
    const t = useSfT();
    const sfApi = useStorageFacilityApi();
    const [salesReps, setSalesReps] = useState([]);
    const [products, setProducts] = useState([]);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    const [salesRepId, setSalesRepId] = useState(initialSalesRepId);

    useEffect(() => {
        setSalesRepId(initialSalesRepId || '');
    }, [initialSalesRepId]);

    const setRepFilter = (id) => {
        setSalesRepId(id);
        onSalesRepIdChange?.(id);
    };

    const [productId, setProductId] = useState('');
    const [from, setFrom] = useState(firstDayOfMonthISO());
    const [to, setTo] = useState(todayISO());

    const [targetModal, setTargetModal] = useState(false);
    const [targetForm, setTargetForm] = useState({
        salesRepId: '',
        periodStart: firstDayOfMonthISO(),
        periodEnd: todayISO(),
        targetAmount: '',
        label: '',
        notes: '',
    });
    const [targetBusy, setTargetBusy] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [repRes, prodRes] = await Promise.all([
                    sfApi.listStorageSalesReps(brandId),
                    sfApi.listStorageProducts(brandId),
                ]);
                if (cancelled) return;
                setSalesReps(repRes?.salesReps ?? []);
                setProducts(prodRes?.products ?? []);
            } catch {
                if (cancelled) return;
                // The filter lists are an aid, not the screen: an empty pair of
                // dropdowns still leaves the unfiltered figures readable.
                setSalesReps([]);
                setProducts([]);
            }
        })();
        return () => { cancelled = true; };
    }, [brandId, sfApi, reloadKey]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await sfApi.getStorageSalesRepPerformance(brandId, {
                salesRepId: salesRepId || undefined,
                productId: productId || undefined,
                from: from || undefined,
                to: to || undefined,
            });
            setData(res);
            setLoadError(false);
        } catch {
            setData(null);
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    }, [brandId, salesRepId, productId, from, to, sfApi]);

    useEffect(() => {
        load();
    }, [load, reloadKey]);

    const summary = data?.summary ?? {};
    const byProduct = data?.byProduct ?? [];
    const invoices = data?.invoices ?? [];
    const targets = data?.targets ?? [];
    const byRep = data?.byRep ?? [];
    const analysis = data?.analysis;
    const achievementPct = analysis?.achievementPct;
    const statusTone = STATUS_TONE[analysis?.status] ?? 'neutral';
    const showRepComparison = !salesRepId && byRep.length > 0;

    const invoicesPaging = usePagedRows(invoices, {
        resetKey: `${brandId}|${salesRepId}|${productId}|${from}|${to}`,
    });
    const productPaging = usePagedRows(byProduct, {
        resetKey: `${brandId}|${salesRepId}|${productId}|${from}|${to}`,
    });

    const progressWidth = useMemo(
        () => (achievementPct == null ? 0 : Math.min(100, achievementPct)),
        [achievementPct],
    );

    const openTargetModal = () => {
        setTargetForm({
            salesRepId: salesRepId || salesReps[0]?.id || '',
            periodStart: from || firstDayOfMonthISO(),
            periodEnd: to || todayISO(),
            targetAmount: '',
            label: '',
            notes: '',
        });
        setTargetModal(true);
    };

    const saveTarget = async (e) => {
        e.preventDefault();
        if (!targetForm.salesRepId || !targetForm.targetAmount) return;
        setTargetBusy(true);
        try {
            await sfApi.createStorageSalesRepTarget(brandId, {
                salesRepId: targetForm.salesRepId,
                periodStart: targetForm.periodStart,
                periodEnd: targetForm.periodEnd,
                targetAmount: Number(targetForm.targetAmount),
                label: targetForm.label || undefined,
                notes: targetForm.notes || undefined,
            });
            setTargetModal(false);
            setReloadKey((k) => k + 1);
        } catch (ex) {
            window.alert(ex?.message || t('perf.errSaveTarget'));
        } finally {
            setTargetBusy(false);
        }
    };

    const removeTarget = async (row) => {
        const name = row.label || sfDate(row.periodStart);
        if (!window.confirm(t('perf.targets.confirmRemove', { name }))) return;
        try {
            await sfApi.deleteStorageSalesRepTarget(brandId, row.id);
            setReloadKey((k) => k + 1);
        } catch (ex) {
            window.alert(ex?.message || t('perf.targets.errRemove'));
        }
    };

    if (loading && !data) {
        return (
            <div className="ui-stack ui-tokens" aria-busy="true">
                <div className="ui-sk ui-sk--title ui-sk--w40" />
                <div className="ui-kpis">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={`sk-${i}`} className="ui-metric ui-sk-row">
                            <div className="ui-sk ui-sk--label ui-sk--w55" />
                            <div className="ui-sk ui-sk--title ui-sk--w40" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        // It renders inside the Sales reps tab and as the Sales tab's whole
        // body, so it declares the tokens itself.
        <div className="ui-stack ui-tokens">
            <div className="ui-head">
                <h1>{t('perf.title')}</h1>
                <p>{t('perf.lead')}</p>
            </div>

            <div className="ui-form-grid">
                <div className="ui-field ui-col-3">
                    <label htmlFor="sf-sales-rep">{t('perf.filter.rep')}</label>
                    <select
                        id="sf-sales-rep"
                        className="ui-select"
                        value={salesRepId}
                        onChange={(e) => setRepFilter(e.target.value)}
                    >
                        <option value="">{t('perf.filter.allReps')}</option>
                        {salesReps.map((r) => (
                            <option key={r.id} value={r.id}>
                                {r.name}{r.code ? ` (${r.code})` : ''}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="ui-field ui-col-3">
                    <label htmlFor="sf-sales-product">{t('perf.filter.product')}</label>
                    <select
                        id="sf-sales-product"
                        className="ui-select"
                        value={productId}
                        onChange={(e) => setProductId(e.target.value)}
                    >
                        <option value="">{t('perf.filter.allProducts')}</option>
                        {products.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.name}{p.sku ? ` · ${p.sku}` : ''}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="ui-field ui-col-3">
                    <label htmlFor="sf-sales-from">{t('perf.filter.from')}</label>
                    <input
                        id="sf-sales-from"
                        type="date"
                        className="ui-input"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                    />
                </div>
                <div className="ui-field ui-col-3">
                    <label htmlFor="sf-sales-to">{t('perf.filter.to')}</label>
                    <input
                        id="sf-sales-to"
                        type="date"
                        className="ui-input"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                    />
                </div>
            </div>

            {loadError ? (
                <div className="ui-empty">
                    <div className="ui-empty-icon"><AlertTriangle size={18} /></div>
                    <div className="ui-empty-title">{t('perf.errLoad')}</div>
                    <div className="ui-empty-sub">{t('perf.errSub')}</div>
                    <button
                        type="button"
                        className="ui-btn ui-btn--default ui-btn--sm"
                        onClick={() => setReloadKey((k) => k + 1)}
                    >
                        <RotateCcw size={13} /> {t('perf.retry')}
                    </button>
                </div>
            ) : (
                <>
                    <div className="ui-kpis">
                        <div className="ui-metric">
                            <span className="ui-metric-icon"><TrendingUp size={62} strokeWidth={1.1} /></span>
                            <div className="ui-metric-label">{t('perf.kpi.sales')}</div>
                            <div className="ui-metric-value">{sfMoney(t, summary.totalSales)}</div>
                        </div>
                        <div className="ui-metric ui-metric--ok">
                            <span className="ui-metric-icon"><BarChart3 size={62} strokeWidth={1.1} /></span>
                            <div className="ui-metric-label">{t('perf.kpi.collected')}</div>
                            <div className="ui-metric-value">{sfMoney(t, summary.totalCollected)}</div>
                        </div>
                        <div className="ui-metric ui-metric--warn">
                            <span className="ui-metric-icon"><AlertCircle size={62} strokeWidth={1.1} /></span>
                            <div className="ui-metric-label">{t('perf.kpi.outstanding')}</div>
                            <div className="ui-metric-value">{sfMoney(t, summary.totalOutstanding)}</div>
                        </div>
                        <div className="ui-metric">
                            <span className="ui-metric-icon"><FileText size={62} strokeWidth={1.1} /></span>
                            <div className="ui-metric-label">{t('perf.kpi.invoices')}</div>
                            <div className="ui-metric-value">{summary.invoiceCount ?? 0}</div>
                        </div>
                    </div>

                    {analysis ? (
                        <section className="ui-panel">
                            <div className="ui-panel-head">
                                <span className="ui-panel-title">{t('perf.analysis')}</span>
                                <span className={`ui-pill ui-pill--${statusTone} ui-panel-end`}>
                                    {t(`perf.status.${analysis.status || 'no_target'}`)}
                                </span>
                            </div>
                            <div className="ui-panel-pad ui-stack-sm">
                                {/* The backend composes this sentence. */}
                                {analysis.statusLabel ? (
                                    <p className="ui-meta">{analysis.statusLabel}</p>
                                ) : null}

                                {data?.activeTarget ? (
                                    <>
                                        <div className="ui-sum-row">
                                            <span>
                                                {t('perf.target', {
                                                    amount: sfMoney(t, data.activeTarget.targetAmount),
                                                })}
                                                {data.activeTarget.label
                                                    ? ` · ${data.activeTarget.label}`
                                                    : ''}
                                            </span>
                                            {achievementPct != null ? (
                                                <strong>{achievementPct}%</strong>
                                            ) : null}
                                        </div>
                                        <div className="ui-bar">
                                            <div
                                                className={`ui-bar-fill ui-bar-fill--${barTone(achievementPct)}`}
                                                style={{ width: `${progressWidth}%` }}
                                            />
                                        </div>
                                        <p className="ui-meta">
                                            {analysis.gapToTarget != null && analysis.gapToTarget > 0
                                                ? t('perf.gap', {
                                                      amount: sfMoney(t, analysis.gapToTarget),
                                                      rate: analysis.collectionRate,
                                                  })
                                                : t('perf.collection', {
                                                      rate: analysis.collectionRate,
                                                  })}
                                        </p>
                                    </>
                                ) : (
                                    <p className="ui-meta">{t('perf.noTarget')}</p>
                                )}

                                {(analysis.recommendations ?? []).length > 0 ? (
                                    <>
                                        <div className="ui-label">{t('perf.recommend')}</div>
                                        <ul className="ui-bullets">
                                            {analysis.recommendations.map((r) => (
                                                <li key={r}>{r}</li>
                                            ))}
                                        </ul>
                                    </>
                                ) : null}
                            </div>
                        </section>
                    ) : null}

                    <div className="ui-row">
                        <div className="ui-toolbar-end">
                            <button
                                type="button"
                                className="ui-btn ui-btn--primary ui-btn--sm"
                                onClick={openTargetModal}
                            >
                                <Plus size={14} /> {t('perf.setTarget')}
                            </button>
                        </div>
                    </div>

                    {targets.length > 0 ? (
                        <div className="ui-table-wrap">
                            <div className="ui-toolbar">
                                <span className="ui-panel-title">{t('perf.targets')}</span>
                            </div>
                            <table className="ui-table">
                                <thead>
                                    <tr>
                                        <th>{t('perf.targets.th.rep')}</th>
                                        <th>{t('perf.targets.th.period')}</th>
                                        <th>{t('perf.targets.th.label')}</th>
                                        <th className="ui-num">{t('perf.targets.th.amount')}</th>
                                        <th aria-label={t('perf.targets.remove')} />
                                    </tr>
                                </thead>
                                <tbody>
                                    {targets.map((row) => (
                                        <tr key={row.id}>
                                            <td data-label={t('perf.targets.th.rep')}>
                                                <span className="ui-strong">{row.salesRepName}</span>
                                            </td>
                                            <td data-label={t('perf.targets.th.period')} className="ui-nowrap">
                                                {sfDate(row.periodStart)} → {sfDate(row.periodEnd)}
                                            </td>
                                            <td data-label={t('perf.targets.th.label')}>
                                                {row.label || '—'}
                                            </td>
                                            <td data-label={t('perf.targets.th.amount')} className="ui-num">
                                                {sfMoney(t, row.targetAmount)}
                                            </td>
                                            <td>
                                                <div className="ui-rowacts">
                                                    <button
                                                        type="button"
                                                        className="ui-btn ui-btn--danger ui-btn--sm ui-btn--icon"
                                                        onClick={() => removeTarget(row)}
                                                        aria-label={t('perf.targets.remove')}
                                                        title={t('perf.targets.remove')}
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : null}

                    {showRepComparison ? (
                        <div className="ui-table-wrap ui-table-wrap--scroll">
                            <div className="ui-toolbar">
                                <span className="ui-panel-title">{t('perf.byRep')}</span>
                            </div>
                            <table className="ui-table">
                                <thead>
                                    <tr>
                                        <th>{t('perf.byRep.th.rep')}</th>
                                        <th className="ui-num">{t('perf.byRep.th.sales')}</th>
                                        <th className="ui-num">{t('perf.byRep.th.collected')}</th>
                                        <th className="ui-num">{t('perf.byRep.th.outstanding')}</th>
                                        <th className="ui-num">{t('perf.byRep.th.invoices')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {byRep.map((r) => (
                                        <tr key={r.salesRepId || r.salesRepName}>
                                            <td data-label={t('perf.byRep.th.rep')}>
                                                <span className="ui-strong">{r.salesRepName}</span>
                                            </td>
                                            <td data-label={t('perf.byRep.th.sales')} className="ui-num">
                                                {sfMoney(t, r.totalSales)}
                                            </td>
                                            <td data-label={t('perf.byRep.th.collected')} className="ui-num">
                                                {sfMoney(t, r.collected)}
                                            </td>
                                            <td data-label={t('perf.byRep.th.outstanding')} className="ui-num">
                                                {sfMoney(t, r.outstanding)}
                                            </td>
                                            <td data-label={t('perf.byRep.th.invoices')} className="ui-num">
                                                {r.invoiceCount}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : null}

                    {byProduct.length > 0 ? (
                        <div className="ui-table-wrap">
                            <div className="ui-toolbar">
                                <span className="ui-panel-title">{t('perf.byProduct')}</span>
                            </div>
                            <table className="ui-table">
                                <thead>
                                    <tr>
                                        <th>{t('perf.byProduct.th.product')}</th>
                                        <th>{t('perf.byProduct.th.sku')}</th>
                                        <th className="ui-num">{t('perf.byProduct.th.qty')}</th>
                                        <th className="ui-num">{t('perf.byProduct.th.revenue')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {productPaging.pagedRows.map((p) => (
                                        <tr key={p.productId}>
                                            <td data-label={t('perf.byProduct.th.product')}>
                                                <span className="ui-strong">{p.productName}</span>
                                            </td>
                                            <td data-label={t('perf.byProduct.th.sku')} className="ui-mono">
                                                {p.sku || '—'}
                                            </td>
                                            <td data-label={t('perf.byProduct.th.qty')} className="ui-num">
                                                {p.qty}
                                            </td>
                                            <td data-label={t('perf.byProduct.th.revenue')} className="ui-num">
                                                {sfMoney(t, p.revenue)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <UiPager {...productPaging.pagerProps} />
                        </div>
                    ) : null}

                    <div className="ui-table-wrap ui-table-wrap--scroll">
                        <div className="ui-toolbar">
                            <span className="ui-panel-title">{t('perf.invoices')}</span>
                        </div>
                        {invoices.length === 0 ? (
                            <div className="ui-empty">
                                <div className="ui-empty-icon"><FileText size={18} /></div>
                                <div className="ui-empty-title">{t('perf.inv.emptyTitle')}</div>
                                <div className="ui-empty-sub">{t('perf.inv.emptySub')}</div>
                            </div>
                        ) : (
                            <table className="ui-table">
                                <thead>
                                    <tr>
                                        <th>{t('perf.inv.th.no')}</th>
                                        <th>{t('perf.inv.th.date')}</th>
                                        <th>{t('perf.inv.th.customer')}</th>
                                        <th>{t('perf.inv.th.rep')}</th>
                                        <th className="ui-num">{t('perf.inv.th.total')}</th>
                                        <th className="ui-num">{t('perf.inv.th.collected')}</th>
                                        <th className="ui-num">{t('perf.inv.th.balance')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoicesPaging.pagedRows.map((s) => (
                                        <tr key={s.id}>
                                            <td data-label={t('perf.inv.th.no')} className="ui-mono ui-nowrap">
                                                {s.invoiceNo}
                                            </td>
                                            <td data-label={t('perf.inv.th.date')} className="ui-nowrap">
                                                {sfDate(s.issueDate)}
                                            </td>
                                            <td data-label={t('perf.inv.th.customer')}>
                                                {s.customerName || '—'}
                                            </td>
                                            <td data-label={t('perf.inv.th.rep')}>
                                                {s.salesRepName || '—'}
                                            </td>
                                            <td data-label={t('perf.inv.th.total')} className="ui-num">
                                                {sfMoney(t, s.grandTotal)}
                                            </td>
                                            <td data-label={t('perf.inv.th.collected')} className="ui-num">
                                                {sfMoney(t, s.paidAmount)}
                                            </td>
                                            <td data-label={t('perf.inv.th.balance')} className="ui-num">
                                                {sfMoney(t, s.balance)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                        <UiPager {...invoicesPaging.pagerProps} />
                    </div>
                </>
            )}

            {targetModal ? (
                <Modal
                    title={t('perf.modal.title')}
                    width="560px"
                    // Portalled to <body>, outside any `.ui-root`, so the modal
                    // has to carry the design tokens itself.
                    contentClassName="ui-tokens"
                    disableClose={targetBusy}
                    onClose={() => setTargetModal(false)}
                >
                    <form onSubmit={saveTarget}>
                        <div className="ui-form-grid">
                            <div className="ui-field ui-col-12">
                                <label htmlFor="sf-target-rep">{t('perf.modal.rep')}</label>
                                <select
                                    id="sf-target-rep"
                                    className="ui-select"
                                    value={targetForm.salesRepId}
                                    onChange={(e) =>
                                        setTargetForm((f) => ({ ...f, salesRepId: e.target.value }))
                                    }
                                    required
                                >
                                    <option value="">{t('perf.modal.selectRep')}</option>
                                    {salesReps.map((r) => (
                                        <option key={r.id} value={r.id}>{r.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="ui-field ui-col-6">
                                <label htmlFor="sf-target-start">{t('perf.modal.start')}</label>
                                <input
                                    id="sf-target-start"
                                    type="date"
                                    className="ui-input"
                                    value={targetForm.periodStart}
                                    onChange={(e) =>
                                        setTargetForm((f) => ({ ...f, periodStart: e.target.value }))
                                    }
                                    required
                                />
                            </div>
                            <div className="ui-field ui-col-6">
                                <label htmlFor="sf-target-end">{t('perf.modal.end')}</label>
                                <input
                                    id="sf-target-end"
                                    type="date"
                                    className="ui-input"
                                    value={targetForm.periodEnd}
                                    onChange={(e) =>
                                        setTargetForm((f) => ({ ...f, periodEnd: e.target.value }))
                                    }
                                    required
                                />
                            </div>
                            <div className="ui-field ui-col-6">
                                <label htmlFor="sf-target-amt">{t('perf.modal.amount')}</label>
                                <input
                                    id="sf-target-amt"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="ui-input ui-input--figure"
                                    value={targetForm.targetAmount}
                                    onChange={(e) =>
                                        setTargetForm((f) => ({ ...f, targetAmount: e.target.value }))
                                    }
                                    required
                                />
                            </div>
                            <div className="ui-field ui-col-6">
                                <label htmlFor="sf-target-label">
                                    {t('perf.modal.label')}{' '}
                                    <span className="ui-field-opt">{t('perf.optional')}</span>
                                </label>
                                <input
                                    id="sf-target-label"
                                    type="text"
                                    className="ui-input"
                                    placeholder={t('perf.modal.phLabel')}
                                    value={targetForm.label}
                                    onChange={(e) =>
                                        setTargetForm((f) => ({ ...f, label: e.target.value }))
                                    }
                                />
                            </div>
                        </div>

                        <div className="ui-form-foot">
                            <button
                                type="button"
                                className="ui-btn ui-btn--default"
                                disabled={targetBusy}
                                onClick={() => setTargetModal(false)}
                            >
                                {t('perf.btn.cancel')}
                            </button>
                            <button
                                type="submit"
                                className="ui-btn ui-btn--primary"
                                disabled={targetBusy}
                            >
                                {targetBusy ? (
                                    <><Loader size={14} className="ui-spin" /> {t('perf.btn.saving')}</>
                                ) : t('perf.btn.save')}
                            </button>
                        </div>
                    </form>
                </Modal>
            ) : null}
        </div>
    );
}
