import React from 'react';
import { outlineBtnStyle, startOfMonthISO, todayISO } from '../../accounting/SupplierAccountingShared';

/** Compact date filters used on trial balance / income statement. */
export function StorageBrandReportDateRange({ dateFrom, dateTo, onChange }) {
    return (
        <div className="sf-acct-report-toolbar">
            <label className="sf-acct-report-field">
                <span>From</span>
                <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => onChange({ dateFrom: e.target.value, dateTo })}
                />
            </label>
            <label className="sf-acct-report-field">
                <span>To</span>
                <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => onChange({ dateFrom, dateTo: e.target.value })}
                />
            </label>
            <button
                type="button"
                className="sf-acct-report-chip"
                style={outlineBtnStyle}
                onClick={() => onChange({ dateFrom: '', dateTo: '' })}
            >
                All time
            </button>
            <button
                type="button"
                className="sf-acct-report-chip"
                style={outlineBtnStyle}
                onClick={() => onChange({ dateFrom: startOfMonthISO(), dateTo: todayISO() })}
            >
                This month
            </button>
        </div>
    );
}

export function StorageBrandReportStatus({ ok, okLabel, badLabel }) {
    return (
        <p className={ok ? 'sf-acct-report-status sf-acct-report-status--ok' : 'sf-acct-report-status sf-acct-report-status--warn'}>
            {ok ? okLabel : badLabel}
        </p>
    );
}
