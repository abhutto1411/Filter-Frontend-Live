import React, { useMemo } from 'react';
import { Filter, RotateCcw } from 'lucide-react';
import SearchSelect from '../../components/SearchSelect';
import { useLockerPortal } from './useLockerPortal';

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
    branchLockedId = null,
}) {
    const { t } = useLockerPortal();
    const set = (key, value) => onChange({ ...filters, [key]: value });
    const branchLocked = Boolean(branchLockedId);

    const branchOptions = useMemo(
        () => [
            ...(branchLocked ? [] : [{ value: 'all', label: t('common.allBranches') }]),
            ...branches.map((b) => ({ value: String(b.id), label: b.name })),
        ],
        [branches, branchLocked, t],
    );
    const cashierOptions = useMemo(
        () => [
            { value: 'all', label: t('common.allCashiers') },
            ...cashiers.map((c) => ({
                value: String(c.id || c.userId),
                label: c.name || c.email,
                hint: c.name && c.email ? c.email : undefined,
            })),
        ],
        [cashiers, t],
    );
    const officerOptions = useMemo(
        () => [
            { value: 'all', label: t('common.allOfficers') },
            ...officers.map((o) => ({ value: String(o.id), label: o.name })),
        ],
        [officers, t],
    );

    return (
        <div className="wlk-filter-bar">
            <div className="wlk-filter-bar__head">
                <span className="wlk-filter-bar__title">
                    <Filter size={14} /> {t('common.filters')}
                </span>
                <div className="wlk-filter-bar__actions">
                    <button type="button" className="btn-secondary" onClick={onReset} disabled={loading}>
                        <RotateCcw size={13} /> {t('common.reset')}
                    </button>
                    <button type="button" className="btn-submit" onClick={onApply} disabled={loading}>
                        {t('common.apply')}
                    </button>
                </div>
            </div>
            <div className="wlk-filter-grid">
                <div className="ws-field">
                    <label>{t('common.fromDate')}</label>
                    <input
                        type="date"
                        value={filters.from || ''}
                        onChange={(e) => set('from', e.target.value)}
                    />
                </div>
                <div className="ws-field">
                    <label>{t('common.toDate')}</label>
                    <input
                        type="date"
                        value={filters.to || ''}
                        onChange={(e) => set('to', e.target.value)}
                    />
                </div>
                <div className="ws-field">
                    <label>{t('common.branch')}</label>
                    <SearchSelect
                        size="sm"
                        options={branchOptions}
                        value={branchLockedId || filters.branchId || 'all'}
                        disabled={branchLocked}
                        title={branchLocked ? t('common.branchLocked') : undefined}
                        ariaLabel={t('common.branch')}
                        placeholder={t('common.typeToSearch')}
                        emptyHint={t('common.noMatches')}
                        onChange={(v) => set('branchId', v)}
                    />
                </div>
                <div className="ws-field">
                    <label>{t('common.cashier')}</label>
                    <SearchSelect
                        size="sm"
                        options={cashierOptions}
                        value={filters.cashierId || 'all'}
                        ariaLabel={t('common.cashier')}
                        placeholder={t('common.typeToSearch')}
                        emptyHint={t('common.noMatches')}
                        onChange={(v) => set('cashierId', v)}
                    />
                </div>
                {showOfficer ? (
                    <div className="ws-field">
                        <label>{t('common.officer')}</label>
                        <SearchSelect
                            size="sm"
                            options={officerOptions}
                            value={filters.officerId || 'all'}
                            ariaLabel={t('common.officer')}
                            placeholder={t('common.typeToSearch')}
                            emptyHint={t('common.noMatches')}
                            onChange={(v) => set('officerId', v)}
                        />
                    </div>
                ) : null}
                {showExpectedRange ? (
                    <>
                        <div className="ws-field">
                            <label>{t('common.minExpected')}</label>
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
                            <label>{t('common.maxExpected')}</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder={t('common.any')}
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
