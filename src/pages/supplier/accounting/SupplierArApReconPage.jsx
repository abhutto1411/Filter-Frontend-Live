import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RiyalIcon from '../../../components/RiyalIcon';
import { navigateToSupplierCustomerLedger } from '../openSupplierCustomerLedger';
import { getSupplierArApRecon } from '../../../services/supplierAccountingApi';
import { reconT } from '../../../utils/supplierArApReconI18n';

function money2(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '0.00';
    return n.toFixed(2);
}

function MoneyCell({ value, dir }) {
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontVariantNumeric: 'tabular-nums' }}>
            <RiyalIcon size={14} />
            <span>{money2(value)}</span>
        </span>
    );
}

export default function SupplierArApReconPage({ locale: localeProp }) {
    const locale =
        localeProp ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => reconT(locale, key, vars), [locale]);
    const dir = locale === 'ar' ? 'rtl' : 'ltr';
    const [rows, setRows] = useState([]);
    const navigate = useNavigate();
    /** SP-19: a workshop row opens that workshop's AR statement (1100 ledger, party-filtered). */
    const openWorkshopLedger = (row) =>
        navigateToSupplierCustomerLedger(navigate, {
            seedKey: 'AR_AFFILIATED',
            from: 'affiliated_workshops',
            partyType: 'workshop',
            partyId: String(row.workshopId),
            partyLabel: row.workshopName,
        }).catch(() => {});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError('');
            try {
                const res = await getSupplierArApRecon();
                const list = Array.isArray(res?.rows)
                    ? res.rows
                    : Array.isArray(res?.data?.rows)
                      ? res.data.rows
                      : Array.isArray(res?.data)
                        ? res.data
                        : [];
                if (!cancelled) setRows(list);
            } catch (err) {
                if (!cancelled) setError(err?.message || t('err.load'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [t]);

    return (
        <div className="module-container" dir={dir} data-ar-ap-recon="1">
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 6px' }}>{t('title')}</h1>
            <p style={{ margin: '0 0 16px', color: 'var(--color-text-muted)' }}>{t('sub')}</p>
            <p style={{ margin: '0 0 12px', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                {t('readonly')} · {t('hint')}
            </p>
            {loading ? <p>{t('loading')}</p> : null}
            {error ? <p style={{ color: '#B91C1C' }}>{error}</p> : null}
            {!loading && !error && rows.length === 0 ? <p>{t('empty')}</p> : null}
            {!loading && rows.length > 0 ? (
                <div style={{ overflowX: 'hidden', width: '100%' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'start', padding: 8 }}>{t('th.workshop')}</th>
                                <th style={{ textAlign: 'end', padding: 8 }}>{t('th.ar')}</th>
                                <th style={{ textAlign: 'end', padding: 8 }}>{t('th.ap')}</th>
                                <th style={{ textAlign: 'end', padding: 8 }}>{t('th.diff')}</th>
                                <th style={{ textAlign: 'end', padding: 8 }}>{t('th.linkedSi')}</th>
                                <th style={{ textAlign: 'end', padding: 8 }}>{t('th.unlinkedSi')}</th>
                                <th style={{ textAlign: 'end', padding: 8 }}>{t('th.linkedWpi')}</th>
                                <th style={{ textAlign: 'end', padding: 8 }}>{t('th.unlinkedWpi')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr
                                    key={row.workshopId}
                                    className="sp-drill-row"
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => openWorkshopLedger(row)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            openWorkshopLedger(row);
                                        }
                                    }}
                                >
                                    <td style={{ padding: 8 }}>{row.workshopName}</td>
                                    <td style={{ padding: 8, textAlign: 'end' }}>
                                        <MoneyCell value={row.ar} dir={dir} />
                                    </td>
                                    <td style={{ padding: 8, textAlign: 'end' }}>
                                        <MoneyCell value={row.ap} dir={dir} />
                                    </td>
                                    <td style={{ padding: 8, textAlign: 'end' }}>
                                        <MoneyCell value={row.difference} dir={dir} />
                                    </td>
                                    <td style={{ padding: 8, textAlign: 'end' }}>{row.linkedSiCount}</td>
                                    <td style={{ padding: 8, textAlign: 'end' }}>{row.unlinkedSiCount}</td>
                                    <td style={{ padding: 8, textAlign: 'end' }}>{row.linkedWpiCount}</td>
                                    <td style={{ padding: 8, textAlign: 'end' }}>{row.unlinkedWpiCount}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : null}
        </div>
    );
}
