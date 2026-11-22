import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getWorkshopInventoryValuation, unwrap } from '../../services/workshopStockApi';
import { exportRowsToExcel, exportRowsToPdf } from '../../utils/tableExport';
import '../../styles/theme-segmented.css';
import './workshopStock.css';

/**
 * Workshop Stock Valuation — qty × PURCHASE cost (average or last purchase price;
 * master-catalog purchase price when neither exists). Department → category filters
 * come from the master-catalog products the branch actually stocks. Riyadh date range.
 */

const round3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;
const money2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const qtyFmt = (n) => round3(n).toLocaleString('en-US', { maximumFractionDigits: 3 });
const fixed2 = (n) => money2(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFKD');

export default function WorkshopStockValuation({ t, branchId, branchName, locale }) {
    const navigate = useNavigate();
    const [method, setMethod] = useState('average');
    const [departmentId, setDepartmentId] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [q, setQ] = useState('');
    const [data, setData] = useState(null);
    const [facets, setFacets] = useState({ departments: [], categories: [] });
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [page, setPage] = useState(1);
    const pageSize = 50;

    const badRange = Boolean(dateFrom && dateTo && dateFrom > dateTo);

    useEffect(() => {
        if (badRange || !branchId) return undefined;
        let cancelled = false;
        (async () => {
            setLoading(true);
            setErr('');
            try {
                const res = unwrap(
                    await getWorkshopInventoryValuation({ branchId, method, departmentId, categoryId, dateFrom, dateTo }),
                );
                if (cancelled) return;
                setData(res);
                if (res?.facets) setFacets(res.facets);
            } catch (e) {
                if (!cancelled) setErr(e?.message || t('common.err'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [branchId, method, departmentId, categoryId, dateFrom, dateTo, badRange, t]);

    // A category must belong to the chosen department.
    const categoryOptions = useMemo(
        () => (facets.categories || []).filter((c) => !departmentId || String(c.departmentId) === String(departmentId)),
        [facets, departmentId],
    );
    useEffect(() => {
        if (categoryId && categoryId !== 'none' && !categoryOptions.some((c) => String(c.id) === String(categoryId))) {
            setCategoryId('');
        }
    }, [categoryOptions, categoryId]);

    const items = useMemo(() => {
        const list = Array.isArray(data?.items) ? data.items : [];
        const tokens = norm(q).split(/\s+/).filter(Boolean);
        if (!tokens.length) return list;
        return list.filter((i) => {
            const hay = norm([i.name, i.arabicName, i.sku, i.departmentName, i.categoryName].join(' '));
            return tokens.every((tk) => hay.includes(tk));
        });
    }, [data, q]);
    useEffect(() => setPage(1), [q, method, departmentId, categoryId, dateFrom, dateTo]);

    const shownTotals = useMemo(() => {
        let qty = 0;
        let value = 0;
        let opening = 0;
        let inQ = 0;
        let outQ = 0;
        for (const i of items) {
            qty += Number(i.qty || 0);
            value += Number(i.value || 0);
            opening += Number(i.openingQty || 0);
            inQ += Number(i.inQty || 0);
            outQ += Number(i.outQty || 0);
        }
        return { qty: round3(qty), value: money2(value), opening: round3(opening), in: round3(inQ), out: round3(outQ) };
    }, [items]);

    const totals = data?.totals || {};
    const gl = data?.gl || {};
    const dated = Boolean(data?.dateFrom);
    const pages = Math.max(1, Math.ceil(items.length / pageSize));
    const pageRows = items.slice((page - 1) * pageSize, page * pageSize);
    const nameOf = (i) => (locale === 'ar' && i.arabicName ? i.arabicName : i.name);
    const deptName = (facets.departments || []).find((d) => String(d.id) === String(departmentId))?.name;
    const catName = (facets.categories || []).find((c) => String(c.id) === String(categoryId))?.name;

    const exportData = () => {
        const headers = [
            t('val.th.product'),
            'SKU',
            t('val.th.dept'),
            t('val.th.cat'),
            ...(dated ? [t('val.th.opening'), t('val.th.in'), t('val.th.out')] : []),
            t('val.th.closing'),
            t('val.th.unitCost'),
            t('val.th.source'),
            t('val.th.value'),
        ];
        const rows = items.map((i) => [
            nameOf(i),
            i.sku || '',
            i.departmentName || '',
            i.categoryName || '',
            ...(dated ? [round3(i.openingQty), round3(i.inQty), round3(i.outQty)] : []),
            round3(i.qty),
            Number(i.unitCost || 0).toFixed(2),
            t(`val.src.${i.costSource}`),
            money2(i.value).toFixed(2),
        ]);
        rows.push([
            t('common.total'),
            '',
            '',
            '',
            ...(dated ? [shownTotals.opening, shownTotals.in, shownTotals.out] : []),
            shownTotals.qty,
            '',
            '',
            shownTotals.value.toFixed(2),
        ]);
        return { headers, rows };
    };
    const subtitle = [
        `${t('common.branch')}: ${branchName || '—'}`,
        `${t('val.method')}: ${t(`val.method.${method}`)}`,
        deptName ? `${t('val.department')}: ${deptName}` : '',
        catName ? `${t('val.category')}: ${catName}` : '',
        dated ? t('val.period', { from: data.dateFrom, to: data.dateTo }) : t('val.asOf', { date: data?.dateTo || '' }),
        q ? `"${q}"` : '',
    ]
        .filter(Boolean)
        .join(' · ');

    const diff = gl.difference;
    const tied = gl.comparable && diff != null && Math.abs(diff) < 0.005;

    return (
        <>
            <div className="wsk-head">
                <div>
                    <h2 className="wsk-title">{t('val.title')}</h2>
                    <p className="wsk-sub">
                        {t('val.sub')} · {t('common.branch')}: <b>{branchName || '—'}</b>
                    </p>
                </div>
                <div className="wsk-actions">
                    <button
                        type="button"
                        className="wsk-btn-outline"
                        disabled={loading || !items.length}
                        onClick={() => {
                            const { headers, rows } = exportData();
                            exportRowsToPdf({ title: t('val.title'), subtitle, headers, rows, filenameBase: 'workshop-stock-valuation' });
                        }}
                    >
                        {t('common.pdf')}
                    </button>
                    <button
                        type="button"
                        className="wsk-btn-outline"
                        disabled={loading || !items.length}
                        onClick={() => {
                            const { headers, rows } = exportData();
                            exportRowsToExcel({ sheetName: 'Valuation', headers, rows, filenameBase: 'workshop-stock-valuation' });
                        }}
                    >
                        {t('common.excel')}
                    </button>
                </div>
            </div>

            <div className="wsk-card">
                <div className="wsk-filters">
                    <label>
                        {t('val.method')}
                        <div className="theme-segmented" role="tablist">
                            {['average', 'latest'].map((m) => (
                                <button
                                    key={m}
                                    type="button"
                                    role="tab"
                                    aria-selected={method === m}
                                    className={`theme-segmented__btn${method === m ? ' theme-segmented__btn--active' : ''}`}
                                    onClick={() => setMethod(m)}
                                >
                                    {t(`val.method.${m}`)}
                                </button>
                            ))}
                        </div>
                    </label>
                    <label style={{ flex: '1 1 200px' }}>
                        {t('val.department')}
                        <select value={departmentId} onChange={(e) => { setDepartmentId(e.target.value); setCategoryId(''); }}>
                            <option value="">{t('val.allDepartments')}</option>
                            {(facets.departments || []).map((d) => (
                                <option key={d.id} value={d.id}>
                                    {d.name} ({d.products})
                                </option>
                            ))}
                        </select>
                    </label>
                    <label style={{ flex: '1 1 200px' }}>
                        {t('val.category')}
                        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                            <option value="">{t('val.allCategories')}</option>
                            {categoryOptions.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name} ({c.products})
                                </option>
                            ))}
                            <option value="none">{t('val.none')}</option>
                        </select>
                    </label>
                    <label>
                        {t('common.from')}
                        <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} />
                    </label>
                    <label>
                        {t('common.to')}
                        <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} />
                    </label>
                    {departmentId || categoryId || dateFrom || dateTo || q ? (
                        <button
                            type="button"
                            className="wsk-btn-outline"
                            onClick={() => {
                                setDepartmentId('');
                                setCategoryId('');
                                setDateFrom('');
                                setDateTo('');
                                setQ('');
                            }}
                        >
                            {t('val.reset')}
                        </button>
                    ) : null}
                </div>
                <div className="wsk-filters" style={{ marginBottom: 0 }}>
                    <label style={{ flex: '1 1 320px' }}>
                        <input value={q} placeholder={t('val.search')} onChange={(e) => setQ(e.target.value)} />
                    </label>
                </div>
                <p className="wsk-hint" style={{ margin: '8px 0 0' }}>{t(`val.basis.${method}`)}</p>
                {badRange ? <div className="wsk-error" style={{ marginTop: 8 }}>{t('common.from')} &gt; {t('common.to')}</div> : null}
            </div>

            {err ? <div className="wsk-error">{err}</div> : null}
            {data ? (
                <p className="wsk-hint" style={{ margin: '0 0 8px' }}>
                    {dated ? t('val.period', { from: data.dateFrom, to: data.dateTo }) : t('val.asOf', { date: data.dateTo })}
                </p>
            ) : null}

            <div className="wsk-kpis">
                <div className="wsk-kpi">
                    <div className="wsk-kpi-label">{t('val.kpi.value')}</div>
                    <div className="wsk-kpi-value">{loading ? '…' : t('common.sar', { amount: fixed2(q ? shownTotals.value : totals.value) })}</div>
                </div>
                <div className="wsk-kpi">
                    <div className="wsk-kpi-label">{t('val.kpi.qty')}</div>
                    <div className="wsk-kpi-value">{loading ? '…' : qtyFmt(q ? shownTotals.qty : totals.qty)}</div>
                </div>
                <div className="wsk-kpi">
                    <div className="wsk-kpi-label">{t('val.kpi.skus')}</div>
                    <div className="wsk-kpi-value">{loading ? '…' : items.length}</div>
                </div>
                {dated ? (
                    <div className="wsk-kpi">
                        <div className="wsk-kpi-label">
                            {t('val.kpi.opening')} · {t('val.kpi.in')} · {t('val.kpi.out')}
                        </div>
                        <div className="wsk-kpi-value">
                            {loading ? '…' : `${qtyFmt(shownTotals.opening)} · +${qtyFmt(shownTotals.in)} · −${qtyFmt(shownTotals.out)}`}
                        </div>
                    </div>
                ) : null}
                <div className="wsk-kpi">
                    <div className="wsk-kpi-label">{t('val.kpi.gl')}</div>
                    <div className="wsk-kpi-value">{loading || gl.inventory1200 == null ? '…' : t('common.sar', { amount: fixed2(gl.inventory1200) })}</div>
                </div>
                {gl.comparable ? (
                    <div className="wsk-kpi">
                        <div className="wsk-kpi-label">{t('val.kpi.diff')}</div>
                        <div className={`wsk-kpi-value ${tied ? 'wsk-pos' : 'wsk-neg'}`}>
                            {loading || diff == null ? '…' : t('common.sar', { amount: fixed2(diff) })}
                        </div>
                    </div>
                ) : null}
            </div>

            {!loading && data ? (
                <>
                    {gl.comparable ? (
                        tied ? (
                            <div className="wsk-ok">{t('val.tied')}</div>
                        ) : (
                            <div className="wsk-error">{t('val.notTied', { diff: t('common.sar', { amount: fixed2(diff) }) })}</div>
                        )
                    ) : gl.note ? (
                        <div className="wsk-note">{gl.note}</div>
                    ) : null}
                    {gl.account?.id ? (
                        <div style={{ marginBottom: 10 }}>
                            <button
                                type="button"
                                className="wsk-btn-outline"
                                onClick={() => {
                                    const p = new URLSearchParams({ code: gl.account.code || '', name: gl.account.name || '', type: 'ASSET' });
                                    if (data?.dateTo) p.set('dateTo', data.dateTo);
                                    if (branchId) p.set('branchId', String(branchId));
                                    navigate(`/workshop/accounting/ledger/${encodeURIComponent(gl.account.id)}?${p.toString()}`);
                                }}
                            >
                                GL {gl.account.code} · {gl.account.name}
                            </button>
                        </div>
                    ) : null}
                    {totals.fallbackLines ? <div className="wsk-note">{t('val.fallback', { n: totals.fallbackLines })}</div> : null}
                    {totals.missingCostLines ? <div className="wsk-error">{t('val.missingCost', { n: totals.missingCostLines })}</div> : null}
                    {totals.negativeLines ? (
                        <div className="wsk-note">
                            {t('val.negative', { n: totals.negativeLines, amt: t('common.sar', { amount: fixed2(totals.negativeValue) }) })}
                        </div>
                    ) : null}
                </>
            ) : null}

            <div className="wsk-grid2">
                {['byDepartment', 'byCategory'].map((k) => (
                    <div className="wsk-card" key={k}>
                        <h3 className="wsk-h3">{t(`val.${k}`)}</h3>
                        {loading ? (
                            <div className="wsk-muted">{t('common.loading')}</div>
                        ) : !(data?.[k] || []).length ? (
                            <div className="wsk-muted">{t('val.empty')}</div>
                        ) : (
                            <div className="wsk-table-wrap">
                                <table className="ws-table wsk-table">
                                    <thead>
                                        <tr>
                                            <th>{t('val.th.name')}</th>
                                            <th className="num">{t('val.th.skus')}</th>
                                            <th className="num">{t('val.th.qty')}</th>
                                            <th className="num">{t('val.th.value')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data[k].map((g) => (
                                            <tr
                                                key={g.id ?? 'none'}
                                                className="wsk-row"
                                                onClick={() => {
                                                    if (k === 'byDepartment') {
                                                        setDepartmentId(g.id ?? '');
                                                        setCategoryId('');
                                                    } else {
                                                        setCategoryId(g.id ?? 'none');
                                                    }
                                                }}
                                            >
                                                <td className="wsk-strong">{g.name || t('val.none')}</td>
                                                <td className="num">{g.skus}</td>
                                                <td className="num">{qtyFmt(g.qty)}</td>
                                                <td className="num">{t('common.sar', { amount: fixed2(g.value) })}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="wsk-card">
                {loading ? (
                    <div className="wsk-muted">{t('common.loading')}</div>
                ) : !items.length ? (
                    <div className="wsk-muted">{t('val.empty')}</div>
                ) : (
                    <div className="wsk-table-wrap">
                        <table className="ws-table wsk-table">
                            <thead>
                                <tr>
                                    <th>{t('val.th.product')}</th>
                                    <th>{t('val.th.dept')}</th>
                                    {dated ? <th className="num">{t('val.th.opening')}</th> : null}
                                    {dated ? <th className="num">{t('val.th.in')}</th> : null}
                                    {dated ? <th className="num">{t('val.th.out')}</th> : null}
                                    <th className="num">{t('val.th.closing')}</th>
                                    <th className="num">{t('val.th.unitCost')}</th>
                                    <th>{t('val.th.source')}</th>
                                    <th className="num">{t('val.th.value')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pageRows.map((i) => (
                                    <tr key={i.productId}>
                                        <td>
                                            <div className="wsk-strong">{nameOf(i)}</div>
                                            {i.sku ? <div className="wsk-hint">{i.sku}</div> : null}
                                        </td>
                                        <td>
                                            <div>{i.departmentName || '—'}</div>
                                            <div className="wsk-hint">{i.categoryName || ''}</div>
                                        </td>
                                        {dated ? <td className="num">{qtyFmt(i.openingQty)}</td> : null}
                                        {dated ? <td className="num wsk-pos">{i.inQty ? `+${qtyFmt(i.inQty)}` : '0'}</td> : null}
                                        {dated ? <td className="num wsk-neg">{i.outQty ? `−${qtyFmt(i.outQty)}` : '0'}</td> : null}
                                        <td className={`num${i.qty < 0 ? ' wsk-neg' : ''}`}>
                                            {qtyFmt(i.qty)} <span className="wsk-hint">{i.unit || ''}</span>
                                        </td>
                                        <td className="num">{t('common.sar', { amount: fixed2(i.unitCost) })}</td>
                                        <td>
                                            <span className={`wsk-tag${i.costSource === 'none' ? ' wsk-tag--bad' : i.costSource === 'catalog' || i.costSource === 'mixed' ? ' wsk-tag--warn' : ''}`}>
                                                {t(`val.src.${i.costSource}`)}
                                            </span>
                                        </td>
                                        <td className={`num wsk-strong${Number(i.value) < 0 ? ' wsk-neg' : ''}`}>{t('common.sar', { amount: fixed2(i.value) })}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={2}>{t('common.total')} ({items.length})</td>
                                    {dated ? <td className="num">{qtyFmt(shownTotals.opening)}</td> : null}
                                    {dated ? <td className="num">+{qtyFmt(shownTotals.in)}</td> : null}
                                    {dated ? <td className="num">−{qtyFmt(shownTotals.out)}</td> : null}
                                    <td className="num">{qtyFmt(shownTotals.qty)}</td>
                                    <td />
                                    <td />
                                    <td className="num">{t('common.sar', { amount: fixed2(shownTotals.value) })}</td>
                                </tr>
                            </tfoot>
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
