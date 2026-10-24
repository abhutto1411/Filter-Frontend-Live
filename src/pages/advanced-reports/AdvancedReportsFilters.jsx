import React, { useMemo, useState } from 'react';
import SearchableEntityCombobox from '../../components/SearchableEntityCombobox';

const COMPARISON_REPORT_IDS = ['sales_comparison', 'branch_comparison'];

/**
 * Dual DateTime ranges + searchable workshop/branch/category/report-type combos.
 * Arrow keys work via SearchableEntityCombobox (↑↓ / Enter).
 *
 * Important: pass raw search `displayText` only (never `text || selectedLabel`).
 * Empty string is valid while typing; the combobox shows the selected label when closed.
 */
export default function AdvancedReportsFilters({
    t,
    portal,
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
    const [workshopText, setWorkshopText] = useState('');
    const [branchText, setBranchText] = useState('');
    const [categoryText, setCategoryText] = useState('');
    const [reportText, setReportText] = useState('');
    const [deptText, setDeptText] = useState('');
    const [compareDeptText, setCompareDeptText] = useState('');

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

    const showDeptFields =
        showDepartments || values.reportType === 'sales_comparison';

    return (
        <div className="adv-reports__filters">
            <div className="adv-reports__filter-grid">
                <div className="adv-reports__period-block">
                    <div className="adv-reports__period-title">
                        {showPreviousPeriod ? t('filter.mainPeriod') : t('filter.dateRange')}
                    </div>
                    <div className="adv-reports__field adv-reports__field--wide">
                        <label htmlFor="ar-main-from">{t('filter.from')}</label>
                        <input
                            id="ar-main-from"
                            type="datetime-local"
                            value={values.mainFrom || ''}
                            onChange={(e) => setField('mainFrom', e.target.value)}
                        />
                    </div>
                    <div className="adv-reports__field adv-reports__field--wide">
                        <label htmlFor="ar-main-to">{t('filter.to')}</label>
                        <input
                            id="ar-main-to"
                            type="datetime-local"
                            value={values.mainTo || ''}
                            onChange={(e) => setField('mainTo', e.target.value)}
                        />
                    </div>
                </div>

                {showPreviousPeriod ? (
                    <div className="adv-reports__period-block">
                        <div className="adv-reports__period-title">{t('filter.prevPeriod')}</div>
                        <div className="adv-reports__field adv-reports__field--wide">
                            <label htmlFor="ar-prev-from">{t('filter.from')}</label>
                            <input
                                id="ar-prev-from"
                                type="datetime-local"
                                value={values.prevFrom || ''}
                                onChange={(e) => setField('prevFrom', e.target.value)}
                            />
                        </div>
                        <div className="adv-reports__field adv-reports__field--wide">
                            <label htmlFor="ar-prev-to">{t('filter.to')}</label>
                            <input
                                id="ar-prev-to"
                                type="datetime-local"
                                value={values.prevTo || ''}
                                onChange={(e) => setField('prevTo', e.target.value)}
                            />
                        </div>
                    </div>
                ) : null}

                {showWorkshop ? (
                    <div className="adv-reports__field">
                        <label htmlFor="ar-workshop">{t('filter.workshop')}</label>
                        <SearchableEntityCombobox
                            id="ar-workshop"
                            options={workshopOpts}
                            value={values.workshopId || ''}
                            displayText={workshopText}
                            onDisplayTextChange={setWorkshopText}
                            onSelect={(opt) => {
                                setField('workshopId', opt?.id || '');
                                setWorkshopText('');
                            }}
                            placeholder={t('filter.selectWorkshop')}
                            entityLabel="workshop"
                            maxInitial={40}
                            maxFiltered={60}
                            disabled={loading}
                        />
                    </div>
                ) : null}

                <div className="adv-reports__field">
                    <label htmlFor="ar-branch">{t('filter.branch')}</label>
                    <SearchableEntityCombobox
                        id="ar-branch"
                        options={branchOpts}
                        value={values.branchId || 'all'}
                        displayText={branchText}
                        onDisplayTextChange={setBranchText}
                        onSelect={(opt) => {
                            setField('branchId', opt?.id || 'all');
                            setBranchText('');
                        }}
                        placeholder={t('filter.allBranches')}
                        entityLabel="branch"
                        maxInitial={40}
                        maxFiltered={60}
                        disabled={loading}
                    />
                </div>

                <div className="adv-reports__field">
                    <label htmlFor="ar-category">{t('filter.category')}</label>
                    <SearchableEntityCombobox
                        id="ar-category"
                        options={categoryOpts}
                        value={values.categoryId || 'all'}
                        displayText={categoryText}
                        onDisplayTextChange={setCategoryText}
                        onSelect={(opt) => {
                            setField('categoryId', opt?.id || 'all');
                            setCategoryText('');
                        }}
                        placeholder={t('filter.allCategories')}
                        entityLabel="category"
                        maxInitial={40}
                        maxFiltered={80}
                        disabled={loading}
                    />
                </div>

                {showComparisonReportType ? (
                    <div className="adv-reports__field">
                        <label htmlFor="ar-report-type">{t('filter.reportType')}</label>
                        <SearchableEntityCombobox
                            id="ar-report-type"
                            options={reportOpts}
                            value={
                                COMPARISON_REPORT_IDS.includes(values.reportType)
                                    ? values.reportType
                                    : 'sales_comparison'
                            }
                            displayText={reportText}
                            onDisplayTextChange={setReportText}
                            onSelect={(opt) => {
                                setField('reportType', opt?.id || 'sales_comparison');
                                setReportText('');
                            }}
                            placeholder={t('filter.reportType')}
                            entityLabel="report"
                            maxInitial={20}
                            maxFiltered={20}
                            disabled={loading}
                        />
                    </div>
                ) : null}

                {showItemTypes ? (
                    <div className="adv-reports__field adv-reports__field--types">
                        <span className="adv-reports__types-label">{t('filter.types')}</span>
                        <div className="adv-reports__types" role="group" aria-label={t('filter.types')}>
                            <label className="adv-reports__check">
                                <input
                                    type="checkbox"
                                    checked={values.includeServices !== false}
                                    onChange={(e) => toggleType('includeServices', e.target.checked)}
                                    disabled={loading}
                                />
                                <span>{t('filter.typeServices')}</span>
                            </label>
                            <label className="adv-reports__check">
                                <input
                                    type="checkbox"
                                    checked={values.includeProducts !== false}
                                    onChange={(e) => toggleType('includeProducts', e.target.checked)}
                                    disabled={loading}
                                />
                                <span>{t('filter.typeProducts')}</span>
                            </label>
                        </div>
                    </div>
                ) : null}

                {showDeptFields ? (
                    <>
                        <div className="adv-reports__field">
                            <label htmlFor="ar-dept">{t('filter.department')}</label>
                            <SearchableEntityCombobox
                                id="ar-dept"
                                options={deptOpts}
                                value={values.departmentId || 'all'}
                                displayText={deptText}
                                onDisplayTextChange={setDeptText}
                                onSelect={(opt) => {
                                    setField('departmentId', opt?.id || 'all');
                                    setDeptText('');
                                }}
                                placeholder={t('filter.allDepartments')}
                                entityLabel="department"
                                maxInitial={40}
                                maxFiltered={60}
                                disabled={loading}
                            />
                        </div>
                        <div className="adv-reports__field">
                            <label htmlFor="ar-compare-dept">{t('filter.compareDepartment')}</label>
                            <SearchableEntityCombobox
                                id="ar-compare-dept"
                                options={deptOpts}
                                value={values.compareDepartmentId || 'all'}
                                displayText={compareDeptText}
                                onDisplayTextChange={setCompareDeptText}
                                onSelect={(opt) => {
                                    setField('compareDepartmentId', opt?.id || 'all');
                                    setCompareDeptText('');
                                }}
                                placeholder={t('filter.allDepartments')}
                                entityLabel="department"
                                maxInitial={40}
                                maxFiltered={60}
                                disabled={loading}
                            />
                        </div>
                    </>
                ) : null}

                <div className="adv-reports__filter-actions">
                    <button
                        type="button"
                        className="adv-reports__btn adv-reports__btn--ghost"
                        onClick={onApply}
                        disabled={loading}
                    >
                        {loading ? t('common.loading') : t('page.refresh')}
                    </button>
                    <button
                        type="button"
                        className="adv-reports__btn"
                        onClick={onApply}
                        disabled={loading || (showWorkshop && !values.workshopId)}
                    >
                        {t('page.apply')}
                    </button>
                </div>
            </div>
            {portal ? null : null}
        </div>
    );
}
