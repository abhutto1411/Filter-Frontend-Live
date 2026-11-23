import React, { useEffect, useMemo, useState } from 'react';
import {
    detectReportsPreset,
    inclusiveYmdForPreset,
} from './reportsAnalyticsScope.js';

const PRESETS = ['today', 'yesterday', 'last_7', 'mtd', 'custom'];

export default function CorporateDateRangeBar({
    dateFrom,
    dateTo,
    onApply,
    t,
    compact,
}) {
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
        <div className="ws-reports-filters ws-reports-filter-bar" data-time-mode="full_day" style={compact ? { margin: 0 } : undefined}>
            <div className="ws-reports-toolbar-row ws-reports-toolbar-row--primary">
                <div className="ws-reports-presets" role="group" aria-label={t('date.range')}>
                    {PRESETS.map((p) => (
                        <button
                            key={p}
                            type="button"
                            className={`ws-reports-preset${preset === p ? ' is-active' : ''}`}
                            onClick={() => applyPreset(p)}
                        >
                            {t(`date.preset.${p}`)}
                        </button>
                    ))}
                </div>
            </div>
            <div className="ws-reports-toolbar-row ws-reports-toolbar-row--dates">
                <label className="ws-reports-field">
                    <span className="ws-reports-field__label">{t('date.from')}</span>
                    <input
                        type="date"
                        className="ws-reports-field__control"
                        value={draftFrom}
                        onChange={(e) => {
                            setPreset('custom');
                            setDraftFrom(e.target.value);
                        }}
                        aria-label={t('date.from')}
                    />
                </label>
                <label className="ws-reports-field">
                    <span className="ws-reports-field__label">{t('date.to')}</span>
                    <input
                        type="date"
                        className="ws-reports-field__control"
                        value={draftTo}
                        onChange={(e) => {
                            setPreset('custom');
                            setDraftTo(e.target.value);
                        }}
                        aria-label={t('date.to')}
                    />
                </label>
                <div className="ws-reports-filter-actions">
                    <button
                        type="button"
                        className="ws-reports-action ws-reports-action--primary"
                        onClick={applyCustom}
                    >
                        {t('date.apply')}
                    </button>
                </div>
            </div>
        </div>
    );
}
