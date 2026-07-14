import React from 'react';
import { Filter, RotateCcw } from 'lucide-react';

export default function LockerFilterBar({
    filters,
    onChange,
    onApply,
    onReset,
    branches = [],
    cashiers = [],
    officers = [],
    showOfficer = false,
    showExpectedRange = false,
    loading = false,
}) {
    const set = (key, value) => onChange({ ...filters, [key]: value });

    return (
        <div className="wlk-filter-bar">
            <div className="wlk-filter-bar__head">
                <span className="wlk-filter-bar__title">
                    <Filter size={14} /> Filters
                </span>
                <div className="wlk-filter-bar__actions">
                    <button type="button" className="btn-secondary" onClick={onReset} disabled={loading}>
                        <RotateCcw size={13} /> Reset
                    </button>
                    <button type="button" className="btn-submit" onClick={onApply} disabled={loading}>
                        Apply
                    </button>
                </div>
            </div>
            <div className="wlk-filter-grid">
                <div className="ws-field">
                    <label>From date</label>
                    <input
                        type="date"
                        value={filters.from || ''}
                        onChange={(e) => set('from', e.target.value)}
                    />
                </div>
                <div className="ws-field">
                    <label>To date</label>
                    <input
                        type="date"
                        value={filters.to || ''}
                        onChange={(e) => set('to', e.target.value)}
                    />
                </div>
                <div className="ws-field">
                    <label>Branch</label>
                    <select
                        value={filters.branchId || 'all'}
                        onChange={(e) => set('branchId', e.target.value)}
                    >
                        <option value="all">All branches</option>
                        {branches.map((b) => (
                            <option key={b.id} value={String(b.id)}>
                                {b.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="ws-field">
                    <label>Cashier</label>
                    <select
                        value={filters.cashierId || 'all'}
                        onChange={(e) => set('cashierId', e.target.value)}
                    >
                        <option value="all">All cashiers</option>
                        {cashiers.map((c) => {
                            const id = String(c.id || c.userId);
                            return (
                                <option key={id} value={id}>
                                    {c.name || c.email}
                                </option>
                            );
                        })}
                    </select>
                </div>
                {showOfficer ? (
                    <div className="ws-field">
                        <label>Officer</label>
                        <select
                            value={filters.officerId || 'all'}
                            onChange={(e) => set('officerId', e.target.value)}
                        >
                            <option value="all">All officers</option>
                            {officers.map((o) => (
                                <option key={o.id} value={String(o.id)}>
                                    {o.name}
                                </option>
                            ))}
                        </select>
                    </div>
                ) : null}
                {showExpectedRange ? (
                    <>
                        <div className="ws-field">
                            <label>Min expected (SAR)</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0"
                                value={filters.minExpected ?? ''}
                                onChange={(e) => set('minExpected', e.target.value)}
                            />
                        </div>
                        <div className="ws-field">
                            <label>Max expected (SAR)</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Any"
                                value={filters.maxExpected ?? ''}
                                onChange={(e) => set('maxExpected', e.target.value)}
                            />
                        </div>
                    </>
                ) : null}
            </div>
        </div>
    );
}
