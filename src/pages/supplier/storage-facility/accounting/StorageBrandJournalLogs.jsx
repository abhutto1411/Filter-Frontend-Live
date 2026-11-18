import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, BookOpen, RotateCcw, X } from 'lucide-react';
import { useStorageFacilityAccountingApi } from '../StorageFacilityPortalContext';
import { useSfT } from '../useSfT';
import { sfMoney, sfDate } from '../sfFormat';
import UiPager from '../../../../components/UiPager';
import { useServerPaging } from '../../../../hooks/usePagedRows';
import '../../../../styles/ui.css';

export default function StorageBrandJournalLogs({ brandId, kind }) {
    const t = useSfT();
    const accountingApi = useStorageFacilityAccountingApi();
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [detailId, setDetailId] = useState(null);
    const [detail, setDetail] = useState(null);
    const [detailError, setDetailError] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    const paging = useServerPaging({ resetKey: `${brandId}|${kind}` });
    const { page, pageSize } = paging;

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const fetcher =
                kind === 'payments'
                    ? accountingApi.listBrandPayments
                    : kind === 'receipts'
                      ? accountingApi.listBrandReceipts
                      : accountingApi.listBrandGeneralJournals;
            // The log pages on the server. It used to ask for a flat 100 with
            // no offset, so the 101st entry was unreachable.
            const res = await fetcher(brandId, {
                limit: pageSize,
                offset: (page - 1) * pageSize,
            });
            const journals = Array.isArray(res?.journals) ? res.journals : [];
            setRows(journals);
            setTotal(Number(res?.total ?? journals.length) || 0);
            setLoadError(false);
        } catch {
            setRows([]);
            setTotal(0);
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    }, [brandId, kind, pageSize, page, accountingApi]);

    useEffect(() => {
        load();
    }, [load, reloadKey]);

    useEffect(() => {
        if (!detailId) {
            setDetail(null);
            setDetailError(false);
            return undefined;
        }
        let cancelled = false;
        (async () => {
            try {
                const res = await accountingApi.getBrandJournalById(brandId, detailId);
                if (cancelled) return;
                setDetail(res?.journal ?? res);
                setDetailError(false);
            } catch {
                if (cancelled) return;
                setDetail(null);
                setDetailError(true);
            }
        })();
        return () => { cancelled = true; };
    }, [brandId, detailId, accountingApi]);

    return (
        <div className="ui-root ui-root--flush ui-stack">
            <p className="ui-lead">{t(`log.lead.${kind}`)}</p>

            <div className="ui-table-wrap">
                <div className="ui-toolbar">
                    <span>{t('log.count', { n: total })}</span>
                </div>

                {!loading && loadError ? (
                    <div className="ui-empty">
                        <div className="ui-empty-icon"><AlertTriangle size={18} /></div>
                        <div className="ui-empty-title">{t('log.errLoad')}</div>
                        <div className="ui-empty-sub">{t('log.errSub')}</div>
                        <button
                            type="button"
                            className="ui-btn ui-btn--default ui-btn--sm"
                            onClick={() => setReloadKey((k) => k + 1)}
                        >
                            <RotateCcw size={13} /> {t('log.retry')}
                        </button>
                    </div>
                ) : !loading && rows.length === 0 ? (
                    <div className="ui-empty">
                        <div className="ui-empty-icon"><BookOpen size={18} /></div>
                        <div className="ui-empty-title">{t('log.emptyTitle')}</div>
                        <div className="ui-empty-sub">{t(`log.emptySub.${kind}`)}</div>
                    </div>
                ) : (
                    <table className="ui-table">
                        <thead>
                            <tr>
                                <th>{t('log.th.voucher')}</th>
                                <th>{t('log.th.date')}</th>
                                <th>{t('log.th.reference')}</th>
                                <th className="ui-num">{t('log.th.amount')}</th>
                                <th aria-label={t('log.th.actions')} />
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 8 }).map((_, i) => (
                                    <tr key={`sk-${i}`} className="ui-sk-row">
                                        <td><div className="ui-sk ui-sk--strong ui-sk--w55" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w70" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                                        <td><div className="ui-sk ui-sk--btn" /></td>
                                    </tr>
                                ))
                            ) : rows.map((j) => (
                                <tr key={j.id} aria-selected={String(j.id) === String(detailId)}>
                                    <td data-label={t('log.th.voucher')} className="ui-mono ui-nowrap">
                                        {j.entryNumber}
                                    </td>
                                    <td data-label={t('log.th.date')} className="ui-nowrap">
                                        {sfDate(j.date)}
                                    </td>
                                    <td data-label={t('log.th.reference')}>{j.reference || '—'}</td>
                                    <td data-label={t('log.th.amount')} className="ui-num">
                                        {sfMoney(t, j.totalDebit || j.totalCredit)}
                                    </td>
                                    <td>
                                        <div className="ui-rowacts">
                                            <button
                                                type="button"
                                                className="ui-btn ui-btn--default ui-btn--sm"
                                                onClick={() => setDetailId(j.id)}
                                            >
                                                {t('log.view')}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                <UiPager {...paging.pagerFor(total)} />
            </div>

            {detailId && detailError ? (
                <div className="ui-banner ui-banner--dang">
                    <AlertTriangle size={14} />
                    <span>{t('log.detail.errLoad')}</span>
                </div>
            ) : null}

            {detail ? (
                <section className="ui-panel">
                    <div className="ui-panel-head">
                        <span className="ui-panel-title">
                            {t('log.detail.title', { no: detail.entryNumber })}
                        </span>
                        <div className="ui-panel-end">
                            <button
                                type="button"
                                className="ui-btn ui-btn--subtle ui-btn--sm"
                                onClick={() => setDetailId(null)}
                            >
                                <X size={13} /> {t('log.detail.close')}
                            </button>
                        </div>
                    </div>
                    <div className="ui-panel-pad">
                        <p className="ui-meta">
                            {detail.description || t('log.detail.noDescription')}
                        </p>
                    </div>
                    <table className="ui-table">
                        <thead>
                            <tr>
                                <th>{t('log.detail.th.account')}</th>
                                <th className="ui-num">{t('log.detail.th.debit')}</th>
                                <th className="ui-num">{t('log.detail.th.credit')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(detail.lines || []).map((ln) => (
                                <tr key={ln.id}>
                                    <td data-label={t('log.detail.th.account')}>
                                        <span className="ui-meta-ref">{ln.accountCode}</span>{' '}
                                        {ln.accountName}
                                    </td>
                                    <td data-label={t('log.detail.th.debit')} className="ui-num">
                                        {sfMoney(t, ln.debit)}
                                    </td>
                                    <td data-label={t('log.detail.th.credit')} className="ui-num">
                                        {sfMoney(t, ln.credit)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            ) : null}
        </div>
    );
}
