import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, BookOpen, RotateCcw } from 'lucide-react';
import { useStorageFacilityAccountingApi } from '../StorageFacilityPortalContext';
import { todayISO } from '../../accounting/SupplierAccountingShared';
import { useSfT } from '../useSfT';
import { sfMoney, sfDate } from '../sfFormat';
import UiPager from '../../../../components/UiPager';
import { usePagedRows } from '../../../../hooks/usePagedRows';
import '../../../../styles/ui.css';

const CATEGORIES = ['Cash', 'Bank', 'AR', 'AP', 'Revenue', 'Expense', 'Equity', 'Other'];

export default function StorageBrandLedgerView({ brandId, account, onBack }) {
    const t = useSfT();
    const accountingApi = useStorageFacilityAccountingApi();
    const [from, setFrom] = useState('');
    const [to, setTo] = useState(todayISO());
    const [category, setCategory] = useState(account?.accountCategory || '');
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [data, setData] = useState(null);
    const [reloadKey, setReloadKey] = useState(0);

    const load = useCallback(async () => {
        if (!account?.id) return;
        setLoading(true);
        try {
            const res = await accountingApi.getBrandAccountLedger(brandId, account.id, {
                from: from || undefined,
                to: to || undefined,
                accountCategory: category || undefined,
            });
            setData(res);
            setLoadError(false);
        } catch {
            setData(null);
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    }, [brandId, account?.id, from, to, category, accountingApi]);

    useEffect(() => {
        load();
    }, [load, reloadKey]);

    const entries = data?.entries ?? [];
    // The whole period arrives in one response, and the running balance is
    // computed across it, so the pager slices rather than refetches.
    const paging = usePagedRows(entries, {
        resetKey: `${account?.id}|${from}|${to}|${category}`,
    });

    return (
        <div className="ui-root ui-root--flush ui-stack">
            <div>
                <button type="button" className="ui-btn ui-btn--subtle ui-btn--sm" onClick={onBack}>
                    <ArrowLeft size={14} /> {t('ldg.back')}
                </button>
            </div>

            <div className="ui-head">
                <h1>
                    <span className="ui-meta-ref">{account?.code}</span> {account?.name}
                </h1>
                <p>{t('ldg.lead')}</p>
            </div>

            <div className="ui-row ui-row--fields">
                <div className="ui-field">
                    <label htmlFor="sf-ldg-from">{t('ldg.from')}</label>
                    <input
                        id="sf-ldg-from"
                        type="date"
                        className="ui-input"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                    />
                </div>
                <div className="ui-field">
                    <label htmlFor="sf-ldg-to">{t('ldg.to')}</label>
                    <input
                        id="sf-ldg-to"
                        type="date"
                        className="ui-input"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                    />
                </div>
                <div className="ui-field">
                    <label htmlFor="sf-ldg-cat">{t('ldg.category')}</label>
                    <select
                        id="sf-ldg-cat"
                        className="ui-select"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                    >
                        <option value="">{t('ldg.allCategories')}</option>
                        {CATEGORIES.map((c) => (
                            <option key={c} value={c}>{t(`ldg.cat.${c}`)}</option>
                        ))}
                    </select>
                </div>
                <div className="ui-toolbar-end">
                    <button
                        type="button"
                        className="ui-btn ui-btn--default"
                        onClick={() => setReloadKey((k) => k + 1)}
                    >
                        {t('ldg.apply')}
                    </button>
                </div>
            </div>

            <div className="ui-table-wrap ui-table-wrap--scroll">
                <div className="ui-toolbar">
                    <span>{t('ldg.count', { n: entries.length })}</span>
                </div>

                {!loading && loadError ? (
                    <div className="ui-empty">
                        <div className="ui-empty-icon"><AlertTriangle size={18} /></div>
                        <div className="ui-empty-title">{t('ldg.errLoad')}</div>
                        <div className="ui-empty-sub">{t('ldg.errSub')}</div>
                        <button
                            type="button"
                            className="ui-btn ui-btn--default ui-btn--sm"
                            onClick={() => setReloadKey((k) => k + 1)}
                        >
                            <RotateCcw size={13} /> {t('ldg.retry')}
                        </button>
                    </div>
                ) : !loading && entries.length === 0 ? (
                    <div className="ui-empty">
                        <div className="ui-empty-icon"><BookOpen size={18} /></div>
                        <div className="ui-empty-title">{t('ldg.emptyTitle')}</div>
                        <div className="ui-empty-sub">{t('ldg.emptySub')}</div>
                    </div>
                ) : (
                    <table className="ui-table">
                        <thead>
                            <tr>
                                <th>{t('ldg.th.date')}</th>
                                <th>{t('ldg.th.voucher')}</th>
                                <th>{t('ldg.th.type')}</th>
                                <th>{t('ldg.th.description')}</th>
                                <th className="ui-num">{t('ldg.th.debit')}</th>
                                <th className="ui-num">{t('ldg.th.credit')}</th>
                                <th className="ui-num">{t('ldg.th.balance')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 8 }).map((_, i) => (
                                    <tr key={`sk-${i}`} className="ui-sk-row">
                                        <td><div className="ui-sk ui-sk--text ui-sk--w70" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w40" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w90" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                                    </tr>
                                ))
                            ) : paging.pagedRows.map((e) => (
                                <tr key={e.id}>
                                    <td data-label={t('ldg.th.date')} className="ui-nowrap">
                                        {sfDate(e.date)}
                                    </td>
                                    <td data-label={t('ldg.th.voucher')} className="ui-mono ui-nowrap">
                                        {e.entryNumber}
                                    </td>
                                    <td data-label={t('ldg.th.type')}>{e.entryType}</td>
                                    <td data-label={t('ldg.th.description')}>{e.description || '—'}</td>
                                    <td data-label={t('ldg.th.debit')} className="ui-num">
                                        {sfMoney(t, e.debit)}
                                    </td>
                                    <td data-label={t('ldg.th.credit')} className="ui-num">
                                        {sfMoney(t, e.credit)}
                                    </td>
                                    <td data-label={t('ldg.th.balance')} className="ui-num ui-strong">
                                        {sfMoney(t, e.balance)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        {!loading && entries.length > 0 ? (
                            <tfoot>
                                <tr className="ui-row-sum ui-row-sum--close">
                                    <td colSpan={6} className="ui-num">{t('ldg.closing')}</td>
                                    <td className="ui-num">{sfMoney(t, data.closingBalance)}</td>
                                </tr>
                            </tfoot>
                        ) : null}
                    </table>
                )}
                <UiPager {...paging.pagerProps} />
            </div>
        </div>
    );
}
