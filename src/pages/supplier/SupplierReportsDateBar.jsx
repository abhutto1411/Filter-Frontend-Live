import React, { useEffect, useMemo, useState } from 'react';
import {
    detectReportsPreset,
    inclusiveYmdForPreset,
} from '../workshop/reportsAnalyticsScope.js';
import { srdT } from '../../utils/supplierReportsDateI18n';

const PRESETS = ['today', 'yesterday', 'last_7', 'mtd', 'custom'];

export default function SupplierReportsDateBar({
    dateFrom,
    dateTo,
    onApply,
    locale = 'en',
}) {
    const t = (key, vars) => srdT(locale, key, vars);
    const appliedPreset = useMemo(
        () => detectReportsPreset(dateFrom, dateTo, 'full_day'),
        [dateFrom, dateTo],
    );
    const [draftFrom, setDraftFrom] = useState(dateFrom);
    const [draftTo, setDraftTo] = useState(dateTo);
    const [preset, setPreset] = useState(appliedPreset);

    useEffect(() => {
        setDraftFrom(dateFrom);
        setDraftTo(dateTo);
        setPreset(appliedPreset);
    }, [dateFrom, dateTo, appliedPreset]);

    const applyPreset = (next) => {
        setPreset(next);
        if (next === 'custom') return;
        const range = inclusiveYmdForPreset(next);
        setDraftFrom(range.dateFrom);
        setDraftTo(range.dateTo);
        onApply(range.dateFrom, range.dateTo);
    };

    const applyCustom = () => {
        setPreset('custom');
        onApply(draftFrom, draftTo);
    };

    return (
        <div className="sp-reports-date-bar" data-time-mode="full_day">
            <div className="sp-reports-date-bar__presets" role="group" aria-label={t('date.range')}>
                {PRESETS.map((p) => (
                    <button
                        key={p}
                        type="button"
                        className={`sp-reports-date-bar__preset${preset === p ? ' is-active' : ''}`}
                        onClick={() => applyPreset(p)}
                    >
                        {t(`date.preset.${p}`)}
                    </button>
                ))}
            </div>
            <div className="sp-reports-date-bar__dates">
                <label className="sp-reports-date-bar__field">
                    <span>{t('date.from')}</span>
                    <input
                        type="date"
                        value={draftFrom || ''}
                        onChange={(e) => {
                            setPreset('custom');
                            setDraftFrom(e.target.value);
                        }}
                        aria-label={t('date.from')}
                    />
                </label>
                <label className="sp-reports-date-bar__field">
                    <span>{t('date.to')}</span>
                    <input
                        type="date"
                        value={draftTo || ''}
                        onChange={(e) => {
                            setPreset('custom');
                            setDraftTo(e.target.value);
                        }}
                        aria-label={t('date.to')}
                    />
                </label>
                {preset === 'custom' ? (
                    <button
                        type="button"
                        className="sp-reports-date-bar__apply"
                        onClick={applyCustom}
                    >
                        {t('date.apply')}
                    </button>
                ) : null}
            </div>
        </div>
    );
}
