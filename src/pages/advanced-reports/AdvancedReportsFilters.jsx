import React, { useMemo, useState } from 'react';
import SearchableEntityCombobox from '../../components/SearchableEntityCombobox';
import '../../styles/ui.css';

const COMPARISON_REPORT_IDS = ['sales_comparison', 'branch_comparison'];

/**
 * One searchable picker in a form grid.
 *
 * The search text is state here rather than in the parent: it is transient
 * (it exists only while the list is open), and six of these in the parent
 * made six states that every other filter change re-rendered.
 *
 * Important: pass raw search `displayText` only (never `text || selectedLabel`).
 * Empty string is valid while typing; the combobox shows the selected label
 * when closed.
 */
function ComboField({
    id,
    label,
    options,
    value,
    fallback = '',
    placeholder,
    entityLabel,
    maxInitial = 40,
    maxFiltered = 60,
    disabled,
    onPick,
    col = 'ui-col-3',
}) {
    const [text, setText] = useState('');
    return (
        <div className={`ui-field ${col}`}>
            <label htmlFor={id}>{label}</label>
            <SearchableEntityCombobox
                id={id}
                className="ui-combobox"
                options={options}
                value={value || fallback}
                displayText={text}
                onDisplayTextChange={setText}
                onSelect={(opt) => {
                    onPick(opt?.id || fallback);
                    setText('');
                }}
                placeholder={placeholder}
                entityLabel={entityLabel}
                maxInitial={maxInitial}
                maxFiltered={maxFiltered}
                disabled={disabled}
            />
        </div>
    );
}

/** A From/To pair, named, because two unnamed pairs read the same. */
function PeriodGroup({ t, title, idPrefix, from, to, onChange }) {
    return (
        <div className="ui-group">
            <div className="ui-group-title">{title}</div>
            <div className="ui-field ui-col-6">
                <label htmlFor={`${idPrefix}-from`}>{t('filter.from')}</label>
                <input
                    id={`${idPrefix}-from`}
                    type="datetime-local"
                    className="ui-input"
                    value={from || ''}
                    onChange={(e) => onChange('from', e.target.value)}
                />
            </div>
            <div className="ui-field ui-col-6">
                <label htmlFor={`${idPrefix}-to`}>{t('filter.to')}</label>
                <input
                    id={`${idPrefix}-to`}
                    type="datetime-local"
                    className="ui-input"
                    value={to || ''}
                    onChange={(e) => onChange('to', e.target.value)}
                />
            </div>
        </div>
    );
}

/**
 * Dual DateTime ranges + searchable workshop/branch/category/report-type
 * combos. Arrow keys work via SearchableEntityCombobox (↑↓ / Enter).
 */
export default function AdvancedReportsFilters({
    t,
    workshops = [],
    branches = [],
    categories = [],
    departments = [],
    comparisonReportTypes = [],
    values,
    onChange,
    onApply,
    loading,
    showWorkshop = false,
    showDepartments = false,
    showComparisonReportType = false,
    showPreviousPeriod = false,
    showItemTypes = true,
}) {
    const workshopOpts = useMemo(
        () =>
            (workshops || []).map((w) => ({
                id: String(w.id),
                label: w.name || `Workshop ${w.id}`,
                searchText: w.name || '',
            })),
        [workshops],
    );

    const branchOpts = useMemo(
        () => [
            { id: 'all', label: t('filter.allBranches'), searchText: t('filter.allBranches') },
            ...(branches || []).map((b) => ({
                id: String(b.id),
                label: b.name,
                searchText: b.name,
            })),
        ],
        [branches, t],
    );

    const categoryOpts = useMemo(
        () => [
            { id: 'all', label: t('filter.allCategories'), searchText: t('filter.allCategories') },
            ...(categories || []).map((c) => ({
                id: String(c.id),
                label: c.name,
                searchText: c.name,
            })),
        ],
        [categories, t],
    );

    const reportOpts = useMemo(
        () =>
            (comparisonReportTypes.length
                ? comparisonReportTypes
                : COMPARISON_REPORT_IDS.map((id) => ({ id }))
            ).map((r) => ({
                id: r.id,
                label: t(`type.${r.id}`),
                searchText: t(`type.${r.id}`),
            })),
        [comparisonReportTypes, t],
    );

    const deptOpts = useMemo(
        () => [
            { id: 'all', label: t('filter.allDepartments'), searchText: t('filter.allDepartments') },
            ...(departments || []).map((d) => ({
                id: String(d.id),
                label: d.name,
                searchText: d.name,
            })),
        ],
        [departments, t],
    );

    function setField(key, value) {
        onChange?.({ ...values, [key]: value });
    }

    function toggleType(key, checked) {
        const next = { ...values, [key]: checked };
        // Keep at least one type selected
        if (!next.includeProducts && !next.includeServices) {
            next[key] = true;
        }
        onChange?.(next);
    }

    const showDeptFields = showDepartments || values.reportType === 'sales_comparison';

    return (
        <section className="ui-panel ui-panel-pad">
            <div className="ui-form-grid">
                <PeriodGroup
                    t={t}
                    title={showPreviousPeriod ? t('filter.mainPeriod') : t('filter.dateRange')}
                    idPrefix="ar-main"
                    from={values.mainFrom}
                    to={values.mainTo}
                    onChange={(edge, v) => setField(edge === 'from' ? 'mainFrom' : 'mainTo', v)}
                />

                {showPreviousPeriod ? (
                    <PeriodGroup
                        t={t}
                        title={t('filter.prevPeriod')}
                        idPrefix="ar-prev"
                        from={values.prevFrom}
                        to={values.prevTo}
                        onChange={(edge, v) => setField(edge === 'from' ? 'prevFrom' : 'prevTo', v)}
                    />
                ) : null}

                {showWorkshop ? (
                    <ComboField
                        id="ar-workshop"
                        label={t('filter.workshop')}
                        options={workshopOpts}
                        value={values.workshopId}
                        placeholder={t('filter.selectWorkshop')}
                        entityLabel="workshop"
                        disabled={loading}
                        onPick={(id) => setField('workshopId', id)}
                    />
                ) : null}

                <ComboField
                    id="ar-branch"
                    label={t('filter.branch')}
                    options={branchOpts}
                    value={values.branchId}
                    fallback="all"
                    placeholder={t('filter.allBranches')}
                    entityLabel="branch"
                    disabled={loading}
                    onPick={(id) => setField('branchId', id)}
                />

                <ComboField
                    id="ar-category"
                    label={t('filter.category')}
                    options={categoryOpts}
                    value={values.categoryId}
                    fallback="all"
                    placeholder={t('filter.allCategories')}
                    entityLabel="category"
                    maxFiltered={80}
                    disabled={loading}
                    onPick={(id) => setField('categoryId', id)}
                />

                {showComparisonReportType ? (
                    <ComboField
                        id="ar-report-type"
                        label={t('filter.reportType')}
                        options={reportOpts}
                        value={
                            COMPARISON_REPORT_IDS.includes(values.reportType)
                                ? values.reportType
                                : 'sales_comparison'
                        }
                        fallback="sales_comparison"
                        placeholder={t('filter.reportType')}
                        entityLabel="report"
                        maxInitial={20}
                        maxFiltered={20}
                        disabled={loading}
                        onPick={(id) => setField('reportType', id)}
                    />
                ) : null}

                {showItemTypes ? (
                    <div className="ui-field ui-col-6">
                        <span className="ui-label">{t('filter.types')}</span>
                        <div className="ui-checks" role="group" aria-label={t('filter.types')}>
                            <label className="ui-check">
                                <input
                                    type="checkbox"
                                    checked={values.includeServices !== false}
                                    onChange={(e) => toggleType('includeServices', e.target.checked)}
                                    disabled={loading}
                                />
                                <span className="ui-check-main">{t('filter.typeServices')}</span>
                            </label>
                            <label className="ui-check">
                                <input
                                    type="checkbox"
                                    checked={values.includeProducts !== false}
                                    onChange={(e) => toggleType('includeProducts', e.target.checked)}
                                    disabled={loading}
                                />
                                <span className="ui-check-main">{t('filter.typeProducts')}</span>
                            </label>
                        </div>
                    </div>
                ) : null}

                {showDeptFields ? (
                    <>
                        <ComboField
                            id="ar-dept"
                            label={t('filter.department')}
                            options={deptOpts}
                            value={values.departmentId}
                            fallback="all"
                            placeholder={t('filter.allDepartments')}
                            entityLabel="department"
                            disabled={loading}
                            onPick={(id) => setField('departmentId', id)}
                        />
                        <ComboField
                            id="ar-compare-dept"
                            label={t('filter.compareDepartment')}
                            options={deptOpts}
                            value={values.compareDepartmentId}
                            fallback="all"
                            placeholder={t('filter.allDepartments')}
                            entityLabel="department"
                            disabled={loading}
                            onPick={(id) => setField('compareDepartmentId', id)}
                        />
                    </>
                ) : null}

                <div className="ui-col-12 ui-form-foot">
                    <button
                        type="button"
                        className="ui-btn ui-btn--default"
                        onClick={onApply}
                        disabled={loading}
                    >
                        {loading ? t('common.loading') : t('page.refresh')}
                    </button>
                    <button
                        type="button"
                        className="ui-btn ui-btn--primary"
                        onClick={onApply}
                        disabled={loading || (showWorkshop && !values.workshopId)}
                    >
                        {t('page.apply')}
                    </button>
                </div>
            </div>
        </section>
    );
}
