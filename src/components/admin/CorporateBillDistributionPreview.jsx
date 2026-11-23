import { useEffect, useState } from 'react';
import { previewCorporateBillDistribution } from '../../services/superAdminApi';
import { cfx02T } from '../../utils/corporateFix02I18n';
import Money from '../Money';

/** Chip showing the bill VAT model (hq_principal / collection_agent / mixed). */
export function VatModelChip({ vatModel, locale }) {
    if (!vatModel) return null;
    const tone =
        vatModel === 'hq_principal' ? '#0f766e' : vatModel === 'mixed' ? '#b91c1c' : '#475569';
    return (
        <span
            data-testid="cfx02-vat-model"
            style={{
                display: 'inline-block',
                padding: '2px 10px',
                borderRadius: 999,
                border: `1px solid ${tone}`,
                color: tone,
                fontSize: 12,
                fontWeight: 600,
            }}
        >
            {cfx02T(locale, `vatModel.${vatModel}`)}
        </span>
    );
}

/**
 * CORPORATE-FIX-02 G1: read-only distribution per selling workshop for the bill
 * about to be generated (invoices, ex-VAT, VAT, total, share %) + VAT-model chip.
 */
export default function CorporateBillDistributionPreview({ corporateAccountId, invoices, lineOverrides, locale }) {
    const t = (k, v) => cfx02T(locale, k, v);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    // F5/R3: same amounts + edited excl/VAT as the bill save.
    const key = JSON.stringify({ invoices: invoices || [], lineOverrides: lineOverrides || [] });

    useEffect(() => {
        if (!corporateAccountId) return undefined;
        let alive = true;
        Promise.resolve()
            .then(() => {
                if (!alive) return null;
                setLoading(true);
                setError('');
                const payload = JSON.parse(key);
                return previewCorporateBillDistribution({
                    corporateAccountId,
                    invoices: payload.invoices,
                    lineOverrides: payload.lineOverrides,
                });
            })
            .then((res) => alive && setData(res || null))
            .catch((e) => alive && setError(e?.message || t('dist.error')))
            .finally(() => alive && setLoading(false));
        return () => {
            alive = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [corporateAccountId, key]);

    if (!corporateAccountId) return null;
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    const totals = data?.totals || {};
    return (
        <section className="cgb-card" data-testid="cfx02-distribution-preview" style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h2 className="cgb-card__title" style={{ margin: 0 }}>{t('dist.title')}</h2>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {data?.managedBy ? (
                        <span style={{ fontSize: 12, color: '#475569' }}>
                            {data.managedBy === 'hq' ? `${t('managed.hq')} · ${t('managed.hqHint')}` : t('managed.workshop')}
                        </span>
                    ) : null}
                    <VatModelChip vatModel={data?.vatModel} locale={locale} />
                </div>
            </div>
            {loading ? <p>{t('dist.loading')}</p> : null}
            {error ? <p role="alert" style={{ color: '#b91c1c' }}>{error}</p> : null}
            {data?.excludedAlreadyBilled?.length ? (
                <p style={{ color: '#b45309' }}>{t('dist.alreadyBilled', { n: data.excludedAlreadyBilled.length })}</p>
            ) : null}
            {rows.length ? (
                <div style={{ overflowX: 'auto' }}>
                    <table className="cgb-table" style={{ width: '100%' }}>
                        <thead>
                            <tr>
                                <th>{t('dist.workshop')}</th>
                                <th className="cgb-num">{t('dist.invoices')}</th>
                                <th className="cgb-num">{t('dist.exVat')}</th>
                                <th className="cgb-num">{t('dist.vat')}</th>
                                <th className="cgb-num">{t('dist.total')}</th>
                                <th className="cgb-num">{t('dist.share')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.workshopId}>
                                    <td>W{r.workshopId} · {r.workshopName || '—'}</td>
                                    <td className="cgb-num">{r.invoices}</td>
                                    <td className="cgb-num"><Money amount={r.exVat} /></td>
                                    <td className="cgb-num"><Money amount={r.vat} /></td>
                                    <td className="cgb-num"><Money amount={r.gross} /></td>
                                    <td className="cgb-num">{r.sharePct}%</td>
                                </tr>
                            ))}
                            <tr style={{ fontWeight: 700 }}>
                                <td>{t('dist.billTotal')}</td>
                                <td className="cgb-num">{totals.invoices}</td>
                                <td className="cgb-num"><Money amount={totals.exVat} /></td>
                                <td className="cgb-num"><Money amount={totals.vat} /></td>
                                <td className="cgb-num"><Money amount={totals.gross} /></td>
                                <td className="cgb-num">100%</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            ) : null}
            {data?.vatModel && data.vatModel !== 'mixed' ? (
                <p style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
                    {data.vatModel === 'hq_principal'
                        ? `${t('dist.onSaveHqPrincipal')} (${t('coa.5100')})`
                        : t('dist.onSaveCollector')}
                </p>
            ) : null}
        </section>
    );
}
