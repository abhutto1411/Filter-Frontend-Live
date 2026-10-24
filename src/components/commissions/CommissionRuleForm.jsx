import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Info, Layers, Lock, Percent, Sparkles } from 'lucide-react';
import WorkshopSubScreen from '../workshop/WorkshopSubScreen';
import MultiSelectSearchCombo from '../MultiSelectSearchCombo';
import {
    createWorkshopCommissionRule,
    getCommissionRuleCategories,
    getCommissionRuleDepartments,
    getCommissionRuleKmValues,
    getCommissionRulePeople,
    getCommissionRuleProducts,
    getCommissionRuleServices,
    updateWorkshopCommissionRule,
} from '../../services/workshopCommissionsApi';
import {
    COMMISSION_RULE_APPLIES_TO as APPLIES_TO,
    COMMISSION_ROLE_GROUPS,
    COMMISSION_RULE_ROLES,
    COMMISSION_TECHNICIAN_ROLES,
    commissionPeopleKey,
    commissionRoleGroup,
} from './commissionRuleConstants';
import '../../pages/workshop/Workshop.css';

const EMPTY_FORM = {
    name: '',
    priority: 1,
    status: 'active',
    employeeRole: 'Technician',
    people: [],
    appliesTo: 'all',
    departmentIds: [],
    categoryIds: [],
    productIds: [],
    serviceIds: [],
    kmValues: [],
    value: '',
    useProfilePercent: false,
    notes: '',
};

const ids = (list) => (Array.isArray(list) ? list.map(String) : []);

function formFromRule(rule) {
    if (!rule) return EMPTY_FORM;
    const employeeRole = COMMISSION_RULE_ROLES.includes(rule.employeeRole) ? rule.employeeRole : 'Technician';
    return {
        name: rule.name || '',
        priority: Number(rule.priority || 1),
        status: rule.status === 'inactive' ? 'inactive' : 'active',
        employeeRole,
        people: ids(rule[commissionPeopleKey(employeeRole)]),
        appliesTo: APPLIES_TO.includes(rule.appliesTo) ? rule.appliesTo : 'all',
        departmentIds: ids(rule.departmentIds),
        categoryIds: ids(rule.categoryIds),
        productIds: ids(rule.productIds),
        serviceIds: ids(rule.serviceIds),
        kmValues: (rule.kmValues || []).map(Number),
        value: rule.useProfilePercent ? '' : rule.value != null ? String(rule.value) : '',
        useProfilePercent: Boolean(rule.useProfilePercent),
        notes: rule.notes || '',
    };
}

const money2 = (n) => (Math.round(Number(n || 0) * 100) / 100).toFixed(2);

const joinNames = (names) =>
    names.length <= 3 ? names.join(', ') : `${names.slice(0, 3).join(', ')} +${names.length - 3}`;

/**
 * Full-page create / edit / view screen for one commission rule.
 * Role (technicians / cashiers / managers / supervisors / team leaders) with an
 * optional list of specific people; departments + categories are multi-select
 * and scope the product / service / oil KM pickers.
 */
export default function CommissionRuleForm({
    locale,
    t,
    rule = null,
    readOnly = false,
    workshopId = '',
    onCancel,
    onSaved,
}) {
    const isEdit = Boolean(rule?.id);
    const [form, setForm] = useState(() => formFromRule(rule));
    const [departments, setDepartments] = useState([]);
    const [categories, setCategories] = useState([]);
    const [products, setProducts] = useState([]);
    const [services, setServices] = useState([]);
    const [kmOptions, setKmOptions] = useState([]);
    const [people, setPeople] = useState([]);
    const [loadingCatalog, setLoadingCatalog] = useState(true);
    const [loadingItems, setLoadingItems] = useState(false);
    const [loadingPeople, setLoadingPeople] = useState(false);
    const [optionsError, setOptionsError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const nameRef = useRef(null);
    /** Set once the user edits the scope; loaded item lists then prune stale picks. */
    const scopeTouched = useRef(false);

    const scopeParams = useMemo(
        () => (workshopId ? { workshopId: String(workshopId) } : {}),
        [workshopId],
    );
    const set = (key, value) => setForm((p) => ({ ...p, [key]: value }));
    const roleGroup = commissionRoleGroup(form.employeeRole);

    useEffect(() => {
        if (!readOnly) nameRef.current?.focus();
    }, [readOnly]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoadingCatalog(true);
            try {
                const [d, c] = await Promise.all([
                    getCommissionRuleDepartments(scopeParams),
                    getCommissionRuleCategories(scopeParams),
                ]);
                if (cancelled) return;
                setDepartments(Array.isArray(d?.departments) ? d.departments : []);
                setCategories(Array.isArray(c?.categories) ? c.categories : []);
            } catch (err) {
                if (!cancelled) setOptionsError(err?.message || t('rules.err.loadOptions'));
            } finally {
                if (!cancelled) setLoadingCatalog(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [scopeParams, t]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoadingPeople(true);
            try {
                const res = await getCommissionRulePeople({ ...scopeParams, role: form.employeeRole });
                if (!cancelled) setPeople(Array.isArray(res?.people) ? res.people : []);
            } catch (err) {
                if (!cancelled) setOptionsError(err?.message || t('rules.err.loadOptions'));
            } finally {
                if (!cancelled) setLoadingPeople(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [form.employeeRole, scopeParams, t]);

    const deptKey = form.departmentIds.join(',');
    const catKey = form.categoryIds.join(',');

    // Products / services / KM values follow the department + category selection.
    useEffect(() => {
        let cancelled = false;
        const params = {
            ...scopeParams,
            departmentIds: deptKey ? deptKey.split(',') : undefined,
            categoryIds: catKey ? catKey.split(',') : undefined,
        };
        (async () => {
            setLoadingItems(true);
            try {
                const [p, s, k] = await Promise.all([
                    getCommissionRuleProducts(params),
                    getCommissionRuleServices(params),
                    getCommissionRuleKmValues(params),
                ]);
                if (cancelled) return;
                const nextProducts = Array.isArray(p?.products) ? p.products : [];
                const nextServices = Array.isArray(s?.services) ? s.services : [];
                const nextKm = Array.isArray(k?.kmValues) ? k.kmValues : [];
                setProducts(nextProducts);
                setServices(nextServices);
                setKmOptions(nextKm);
                if (scopeTouched.current) {
                    const productSet = new Set(nextProducts.map((x) => String(x.id)));
                    const serviceSet = new Set(nextServices.map((x) => String(x.id)));
                    const kmSet = new Set(nextKm.map((x) => Number(x.value)));
                    setForm((prev) => ({
                        ...prev,
                        productIds: prev.productIds.filter((id) => productSet.has(id)),
                        serviceIds: prev.serviceIds.filter((id) => serviceSet.has(id)),
                        kmValues: prev.kmValues.filter((v) => kmSet.has(Number(v))),
                    }));
                }
            } catch (err) {
                if (!cancelled) setOptionsError(err?.message || t('rules.err.loadOptions'));
            } finally {
                if (!cancelled) setLoadingItems(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [deptKey, catKey, scopeParams, t]);

    const localName = useCallback(
        (row) => (locale === 'ar' && row?.arabicName ? row.arabicName : row?.name || ''),
        [locale],
    );

    const departmentOptions = useMemo(() => {
        const rows = [...departments];
        for (const d of rule?.departments || []) {
            if (!rows.some((r) => String(r.id) === String(d.id))) rows.push(d);
        }
        return rows.map((d) => ({
            id: String(d.id),
            label: d.name,
            hint: d.isActive === false ? t('rules.inactiveTag') : '',
        }));
    }, [departments, rule, t]);

    const wantCategoryType =
        form.appliesTo === 'products' ? 'product' : form.appliesTo === 'services' ? 'service' : null;

    const categoryOptions = useMemo(() => {
        const deptSet = new Set(form.departmentIds);
        return categories
            .filter(
                (c) =>
                    (!deptSet.size || deptSet.has(String(c.departmentId))) &&
                    (!wantCategoryType || c.type === wantCategoryType),
            )
            .sort(
                (a, b) =>
                    String(a.departmentName || '').localeCompare(String(b.departmentName || '')) ||
                    a.name.localeCompare(b.name),
            )
            .map((c) => ({
                id: String(c.id),
                label: c.name,
                group: c.departmentName || '',
                hint: [c.type ? t(`rules.categoryType.${c.type}`) : '', c.isActive === false ? t('rules.inactiveTag') : '']
                    .filter(Boolean)
                    .join(' · '),
                searchText: `${c.departmentName || ''} ${c.type || ''}`,
            }));
    }, [categories, form.departmentIds, wantCategoryType, t]);

    const peopleOptions = useMemo(() => {
        const rows = people.map((p) => ({ ...p, id: String(p.id) }));
        for (const p of rule?.people || []) {
            if (!rows.some((r) => r.id === String(p.id)) && form.people.includes(String(p.id))) {
                rows.push({ ...p, id: String(p.id) });
            }
        }
        return rows.map((p) => ({
            id: p.id,
            label: p.name,
            hint: [
                p.branchName || (roleGroup !== 'technician' && roleGroup !== 'cashier' ? t('rules.peopleAllBranches') : ''),
                roleGroup === 'team_leader' ? p.detail : '',
                p.isActive === false ? t('rules.inactiveTag') : '',
            ]
                .filter(Boolean)
                .join(' · '),
            searchText: `${p.branchName || ''} ${p.detail || ''}`,
        }));
    }, [people, rule, form.people, roleGroup, t]);

    const productOptions = useMemo(() => {
        const rows = [...products];
        for (const p of rule?.products || []) {
            if (!rows.some((r) => String(r.id) === String(p.id)) && form.productIds.includes(String(p.id))) {
                rows.push(p);
            }
        }
        return rows.map((p) => ({
            id: String(p.id),
            label: localName(p),
            hint: [p.sku, p.kmTypeValue ? t('rules.kmChip', { km: p.kmTypeValue }) : '', p.categoryName]
                .filter(Boolean)
                .join(' · '),
            searchText: `${p.name || ''} ${p.arabicName || ''} ${p.sku || ''} ${p.brandName || ''} ${
                p.kmTypeValue ? `${p.kmTypeValue} km` : ''
            }`,
        }));
    }, [products, rule, form.productIds, localName, t]);

    const serviceOptions = useMemo(() => {
        const rows = [...services];
        for (const s of rule?.services || []) {
            if (!rows.some((r) => String(r.id) === String(s.id)) && form.serviceIds.includes(String(s.id))) {
                rows.push(s);
            }
        }
        return rows.map((s) => ({
            id: String(s.id),
            label: localName(s),
            hint: [s.sku, s.categoryName].filter(Boolean).join(' · '),
            searchText: `${s.name || ''} ${s.arabicName || ''} ${s.sku || ''}`,
        }));
    }, [services, rule, form.serviceIds, localName]);

    const kmChoices = useMemo(() => {
        const byValue = new Map(kmOptions.map((k) => [Number(k.value), k]));
        for (const v of form.kmValues) {
            if (!byValue.has(Number(v))) byValue.set(Number(v), { value: Number(v), productCount: 0 });
        }
        return [...byValue.values()].sort((a, b) => a.value - b.value);
    }, [kmOptions, form.kmValues]);

    const onRoleGroup = (group) => {
        if (group === roleGroup) return;
        const role = group === 'technician' ? 'Technician' : group;
        setForm((p) => ({ ...p, employeeRole: role, people: [] }));
    };

    const onTechnicianType = (role) => {
        if (role === form.employeeRole) return;
        setForm((p) => ({ ...p, employeeRole: role, people: [] }));
    };

    const onDepartmentsChange = (next) => {
        scopeTouched.current = true;
        const deptSet = new Set(next.map(String));
        setForm((p) => ({
            ...p,
            departmentIds: next.map(String),
            categoryIds: deptSet.size
                ? p.categoryIds.filter((id) => {
                      const cat = categories.find((c) => String(c.id) === id);
                      return cat && deptSet.has(String(cat.departmentId));
                  })
                : p.categoryIds,
        }));
    };

    const onCategoriesChange = (next) => {
        scopeTouched.current = true;
        set('categoryIds', next.map(String));
    };

    const onAppliesTo = (value) => {
        scopeTouched.current = true;
        const keepType = value === 'products' ? 'product' : value === 'services' ? 'service' : null;
        setForm((p) => ({
            ...p,
            appliesTo: value,
            categoryIds: keepType
                ? p.categoryIds.filter((id) => categories.find((c) => String(c.id) === id)?.type === keepType)
                : p.categoryIds,
            productIds: value === 'services' ? [] : p.productIds,
            kmValues: value === 'services' ? [] : p.kmValues,
            serviceIds: value === 'products' ? [] : p.serviceIds,
        }));
    };

    const toggleKm = (km) => {
        const v = Number(km);
        setForm((p) => ({
            ...p,
            kmValues: p.kmValues.includes(v) ? p.kmValues.filter((x) => x !== v) : [...p.kmValues, v].sort((a, b) => a - b),
        }));
    };

    const useProfile = Boolean(form.useProfilePercent);
    const rateNum = Number(form.value);
    const rateValid =
        useProfile ||
        (form.value !== '' && Number.isFinite(rateNum) && rateNum >= 0 && rateNum <= 100);

    const summaryFacts = useMemo(() => {
        const facts = [];
        const labelsOf = (options, selected) =>
            options.filter((o) => selected.includes(o.id)).map((o) => o.label);
        const peopleNames = labelsOf(peopleOptions, form.people);
        if (peopleNames.length) facts.push({ k: t('rules.summary.people'), v: joinNames(peopleNames) });
        const deptNames = labelsOf(departmentOptions, form.departmentIds);
        if (deptNames.length) facts.push({ k: t('rules.summary.department'), v: joinNames(deptNames) });
        const catNames = labelsOf(categoryOptions, form.categoryIds);
        if (catNames.length) facts.push({ k: t('rules.summary.category'), v: joinNames(catNames) });
        if (form.kmValues.length) {
            facts.push({
                k: t('rules.summary.km'),
                v: form.kmValues.map((km) => t('rules.kmChip', { km })).join(', '),
            });
        }
        const productNames = labelsOf(productOptions, form.productIds);
        if (productNames.length) facts.push({ k: t('rules.summary.products'), v: joinNames(productNames) });
        const serviceNames = labelsOf(serviceOptions, form.serviceIds);
        if (serviceNames.length) facts.push({ k: t('rules.summary.services'), v: joinNames(serviceNames) });
        return facts;
    }, [
        peopleOptions,
        departmentOptions,
        categoryOptions,
        productOptions,
        serviceOptions,
        form.people,
        form.departmentIds,
        form.categoryIds,
        form.kmValues,
        form.productIds,
        form.serviceIds,
        t,
    ]);

    const onSubmit = async () => {
        if (readOnly) return;
        if (!form.name.trim()) {
            setSubmitError(t('rules.err.nameRequired'));
            nameRef.current?.focus();
            return;
        }
        if (!rateValid) {
            setSubmitError(t('rules.err.rateRange'));
            return;
        }
        const priority = Number(form.priority);
        if (!Number.isInteger(priority) || priority < 1 || priority > 999) {
            setSubmitError(t('rules.err.priorityRange'));
            return;
        }
        setSubmitting(true);
        setSubmitError('');
        const peopleKey = commissionPeopleKey(form.employeeRole);
        const payload = {
            name: form.name.trim(),
            employeeRole: form.employeeRole,
            value: useProfile ? 0 : Math.round(rateNum * 10000) / 10000,
            useProfilePercent: useProfile,
            priority,
            status: form.status,
            appliesTo: form.appliesTo,
            departmentIds: form.departmentIds,
            categoryIds: form.categoryIds,
            productIds: form.appliesTo === 'services' ? [] : form.productIds,
            serviceIds: form.appliesTo === 'products' ? [] : form.serviceIds,
            kmValues: form.appliesTo === 'services' ? [] : form.kmValues,
            employeeRecordIds: [],
            cashierIds: [],
            staffUserIds: [],
            [peopleKey]: form.people,
            notes: form.notes.trim(),
            ...(workshopId ? { workshopId: String(workshopId) } : {}),
        };
        try {
            if (isEdit) {
                await updateWorkshopCommissionRule(rule.id, payload);
            } else {
                await createWorkshopCommissionRule(payload);
            }
            onSaved?.();
        } catch (err) {
            setSubmitError(err?.message || t('rules.err.generic'));
        } finally {
            setSubmitting(false);
        }
    };

    const title = readOnly
        ? t('rules.viewFormTitle')
        : isEdit
          ? t('rules.editFormTitle')
          : t('rules.newFormTitle');

    const showProducts = form.appliesTo !== 'services';
    const showServices = form.appliesTo !== 'products';
    const isTechnician = roleGroup === 'technician';
    const solo = rateValid ? (115 * rateNum) / 100 : 0;
    const roleNote = isTechnician
        ? t('rules.summary.zeroNote')
        : roleGroup === 'cashier'
          ? t('rules.summary.cashierNote')
          : t('rules.summary.zeroNoteStaff');

    return (
        <WorkshopSubScreen
            title={title}
            subtitle={t('rules.formSubtitle')}
            backLabel={t('rules.back')}
            onBack={onCancel}
            backDisabled={submitting}
            size="full"
            className="wcr-screen"
            footer={(
                <div className="wcr-footer">
                    <button type="button" className="ws-btn-secondary" onClick={onCancel} disabled={submitting}>
                        {readOnly ? t('rules.back') : t('btn.cancel')}
                    </button>
                    {!readOnly ? (
                        <button type="button" className="ws-btn-confirm" onClick={onSubmit} disabled={submitting}>
                            {submitting ? t('rules.saving') : isEdit ? t('rules.updateRule') : t('rules.createRule')}
                        </button>
                    ) : null}
                </div>
            )}
        >
            {readOnly ? (
                <div className="wcr-banner">
                    <Lock size={16} aria-hidden />
                    <span>{t('rules.readOnlyBanner')}</span>
                </div>
            ) : null}
            {optionsError ? <div className="wcr-error">{optionsError}</div> : null}

            <div className="wcr-layout">
                <div className="ws-section wcr-form">
                    <section className="wcr-section">
                        <div className="wcr-section__title">{t('rules.section.basics')}</div>
                        <div className="wcr-grid wcr-grid--3">
                            <label className="wcr-field wcr-field--span2">
                                <span className="wcr-label">{t('rules.name')}</span>
                                <input
                                    ref={nameRef}
                                    className="wcr-input"
                                    value={form.name}
                                    maxLength={255}
                                    disabled={readOnly}
                                    placeholder={t('rules.namePh')}
                                    onChange={(e) => set('name', e.target.value)}
                                />
                            </label>
                            <div className="wcr-field">
                                <span className="wcr-label">{t('rules.status')}</span>
                                <div className="wcr-segment" role="radiogroup" aria-label={t('rules.status')}>
                                    {['active', 'inactive'].map((s) => (
                                        <button
                                            key={s}
                                            type="button"
                                            role="radio"
                                            aria-checked={form.status === s}
                                            disabled={readOnly}
                                            className={`wcr-segment__btn${form.status === s ? ' is-on' : ''}`}
                                            onClick={() => set('status', s)}
                                        >
                                            {t(`rules.status.${s}`)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <label className="wcr-field">
                                <span className="wcr-label">{t('rules.priority')}</span>
                                <input
                                    className="wcr-input"
                                    type="number"
                                    min={1}
                                    max={999}
                                    step={1}
                                    value={form.priority}
                                    disabled={readOnly}
                                    onChange={(e) => set('priority', e.target.value)}
                                />
                                <span className="wcr-hint">{t('rules.priorityHint')}</span>
                            </label>
                        </div>
                    </section>

                    <section className="wcr-section">
                        <div className="wcr-section__title">{t('rules.section.who')}</div>
                        <div className="wcr-field">
                            <span className="wcr-label">{t('rules.employeeRole')}</span>
                            <div className="wcr-segment" role="radiogroup" aria-label={t('rules.employeeRole')}>
                                {COMMISSION_ROLE_GROUPS.map((g) => (
                                    <button
                                        key={g}
                                        type="button"
                                        role="radio"
                                        aria-checked={roleGroup === g}
                                        disabled={readOnly}
                                        className={`wcr-segment__btn${roleGroup === g ? ' is-on' : ''}`}
                                        onClick={() => onRoleGroup(g)}
                                    >
                                        {g === 'technician' ? t('rules.roleGroup.technician') : t(`rules.role.${g}`)}
                                    </button>
                                ))}
                            </div>
                            <span className="wcr-hint wcr-basis">
                                <Layers size={13} aria-hidden />
                                <span>{t(`rules.basis.${roleGroup}`)}</span>
                            </span>
                        </div>
                        {isTechnician ? (
                            <div className="wcr-field">
                                <span className="wcr-label">{t('rules.techType')}</span>
                                <div className="wcr-segment" role="radiogroup" aria-label={t('rules.techType')}>
                                    {COMMISSION_TECHNICIAN_ROLES.map((r) => (
                                        <button
                                            key={r}
                                            type="button"
                                            role="radio"
                                            aria-checked={form.employeeRole === r}
                                            disabled={readOnly}
                                            className={`wcr-segment__btn${form.employeeRole === r ? ' is-on' : ''}`}
                                            onClick={() => onTechnicianType(r)}
                                        >
                                            {t(`rules.role.${r}`)}
                                        </button>
                                    ))}
                                </div>
                                <span className="wcr-hint">{t('rules.roleHint')}</span>
                            </div>
                        ) : null}
                        <div className="wcr-field">
                            <span className="wcr-label">
                                {t('rules.people')}
                                {form.people.length ? <em className="wcr-count">{form.people.length}</em> : null}
                            </span>
                            <MultiSelectSearchCombo
                                options={peopleOptions}
                                value={form.people}
                                disabled={readOnly}
                                onChange={(next) => !readOnly && set('people', next.map(String))}
                                placeholder={loadingPeople ? t('rules.loadingOptions') : t('rules.peoplePh')}
                                emptyHint={loadingPeople ? t('rules.loadingOptions') : t('rules.peopleEmpty')}
                                clearLabel={t('rules.clear')}
                                menuMinWidth={360}
                            />
                            <span className="wcr-hint">{t('rules.peopleHint')}</span>
                        </div>
                    </section>

                    <section className="wcr-section">
                        <div className="wcr-section__title">{t('rules.section.what')}</div>
                        <div className="wcr-field">
                            <span className="wcr-label">{t('rules.appliesTo')}</span>
                            <div className="wcr-segment" role="radiogroup" aria-label={t('rules.appliesTo')}>
                                {APPLIES_TO.map((a) => (
                                    <button
                                        key={a}
                                        type="button"
                                        role="radio"
                                        aria-checked={form.appliesTo === a}
                                        disabled={readOnly}
                                        className={`wcr-segment__btn${form.appliesTo === a ? ' is-on' : ''}`}
                                        onClick={() => onAppliesTo(a)}
                                    >
                                        {t(`rules.appliesTo.${a}`)}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="wcr-grid wcr-grid--2">
                            <div className="wcr-field">
                                <span className="wcr-label">
                                    {t('rules.department')}
                                    {form.departmentIds.length ? <em className="wcr-count">{form.departmentIds.length}</em> : null}
                                </span>
                                <MultiSelectSearchCombo
                                    options={departmentOptions}
                                    value={form.departmentIds}
                                    disabled={readOnly}
                                    onChange={(next) => !readOnly && onDepartmentsChange(next)}
                                    placeholder={loadingCatalog ? t('rules.loadingOptions') : t('rules.departmentPh')}
                                    emptyHint={loadingCatalog ? t('rules.loadingOptions') : t('rules.departmentsEmpty')}
                                    clearLabel={t('rules.clear')}
                                    menuMinWidth={320}
                                />
                            </div>
                            <div className="wcr-field">
                                <span className="wcr-label">
                                    {t('rules.category')}
                                    {form.categoryIds.length ? <em className="wcr-count">{form.categoryIds.length}</em> : null}
                                </span>
                                <MultiSelectSearchCombo
                                    options={categoryOptions}
                                    value={form.categoryIds}
                                    disabled={readOnly}
                                    onChange={(next) => !readOnly && onCategoriesChange(next)}
                                    placeholder={loadingCatalog ? t('rules.loadingOptions') : t('rules.categoryPh')}
                                    emptyHint={loadingCatalog ? t('rules.loadingOptions') : t('rules.categoriesEmpty')}
                                    clearLabel={t('rules.clear')}
                                    menuMinWidth={360}
                                />
                                <span className="wcr-hint">{t('rules.categoryHint')}</span>
                            </div>
                        </div>

                        {showProducts ? (
                            <div className="wcr-field">
                                <span className="wcr-label">
                                    {t('rules.products')}
                                    {form.productIds.length ? <em className="wcr-count">{form.productIds.length}</em> : null}
                                </span>
                                <MultiSelectSearchCombo
                                    options={productOptions}
                                    value={form.productIds}
                                    disabled={readOnly}
                                    onChange={(next) => !readOnly && set('productIds', next.map(String))}
                                    placeholder={loadingItems ? t('rules.loadingOptions') : t('rules.productsPh')}
                                    emptyHint={t('rules.productsEmpty')}
                                    clearLabel={t('rules.clear')}
                                    menuMinWidth={420}
                                    maxInitial={200}
                                    maxFiltered={200}
                                />
                                <span className="wcr-hint">{t('rules.productsHint')}</span>
                            </div>
                        ) : null}

                        {showServices ? (
                            <div className="wcr-field">
                                <span className="wcr-label">
                                    {t('rules.services')}
                                    {form.serviceIds.length ? <em className="wcr-count">{form.serviceIds.length}</em> : null}
                                </span>
                                <MultiSelectSearchCombo
                                    options={serviceOptions}
                                    value={form.serviceIds}
                                    disabled={readOnly}
                                    onChange={(next) => !readOnly && set('serviceIds', next.map(String))}
                                    placeholder={loadingItems ? t('rules.loadingOptions') : t('rules.servicesPh')}
                                    emptyHint={t('rules.servicesEmpty')}
                                    clearLabel={t('rules.clear')}
                                    menuMinWidth={420}
                                    maxInitial={200}
                                    maxFiltered={200}
                                />
                                <span className="wcr-hint">{t('rules.servicesHint')}</span>
                            </div>
                        ) : null}

                        {showProducts ? (
                            <div className="wcr-field">
                                <span className="wcr-label">{t('rules.km')}</span>
                                {kmChoices.length ? (
                                    <div className="wcr-km" role="group" aria-label={t('rules.km')}>
                                        {kmChoices.map((k) => {
                                            const on = form.kmValues.includes(Number(k.value));
                                            return (
                                                <button
                                                    key={k.value}
                                                    type="button"
                                                    aria-pressed={on}
                                                    disabled={readOnly}
                                                    className={`wcr-km__chip${on ? ' is-on' : ''}`}
                                                    onClick={() => toggleKm(k.value)}
                                                >
                                                    {on ? <Check size={13} aria-hidden /> : null}
                                                    <bdi>{t('rules.kmChip', { km: Number(k.value).toLocaleString('en-US') })}</bdi>
                                                    {k.productCount ? (
                                                        <span className="wcr-km__count">
                                                            {t('rules.kmCount', { count: k.productCount })}
                                                        </span>
                                                    ) : null}
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="wcr-hint">{loadingItems ? t('rules.loadingOptions') : t('rules.kmNone')}</div>
                                )}
                                <span className="wcr-hint">{t('rules.kmHint')}</span>
                            </div>
                        ) : null}
                    </section>

                    <section className="wcr-section">
                        <div className="wcr-section__title">{t('rules.section.rate')}</div>
                        <label className="wcr-check">
                            <input
                                type="checkbox"
                                checked={useProfile}
                                disabled={readOnly}
                                onChange={(e) => set('useProfilePercent', e.target.checked)}
                            />
                            <span>
                                <span className="wcr-label">{t('rules.useProfile')}</span>
                                <span className="wcr-hint">{t('rules.useProfileHint')}</span>
                            </span>
                        </label>
                        <div className="wcr-grid wcr-grid--3">
                            <label className="wcr-field">
                                <span className="wcr-label">{t('rules.rate')}</span>
                                <div className="wcr-rate">
                                    <input
                                        className="wcr-input"
                                        type="number"
                                        inputMode="decimal"
                                        min={0}
                                        max={100}
                                        step={0.01}
                                        value={useProfile ? '' : form.value}
                                        disabled={readOnly || useProfile}
                                        placeholder={useProfile ? t('rules.rate.profile') : '0.00'}
                                        onChange={(e) => set('value', e.target.value)}
                                    />
                                    <Percent size={15} aria-hidden className="wcr-rate__icon" />
                                </div>
                            </label>
                            <p className="wcr-hint wcr-field--span2 wcr-rate__hint">{t('rules.rateHint')}</p>
                        </div>
                    </section>

                    <section className="wcr-section">
                        <div className="wcr-section__title">{t('rules.section.notes')}</div>
                        <label className="wcr-field">
                            <span className="wcr-label">{t('rules.notes')}</span>
                            <textarea
                                className="wcr-input wcr-textarea"
                                rows={3}
                                maxLength={1000}
                                value={form.notes}
                                disabled={readOnly}
                                placeholder={t('rules.notesPh')}
                                onChange={(e) => set('notes', e.target.value)}
                            />
                        </label>
                    </section>

                    {submitError ? <div className="wcr-error">{submitError}</div> : null}
                </div>

                <aside className="wcr-summary" aria-live="polite">
                    <div className="wcr-summary__head">
                        <Sparkles size={16} aria-hidden />
                        <span>{t('rules.summary.title')}</span>
                    </div>
                    <div className="wcr-summary__rate">
                        <bdi>{useProfile ? t('rules.rate.profile') : rateValid ? `${rateNum}%` : '—'}</bdi>
                        <span className={`ws-badge ws-badge--${form.status === 'active' ? 'green' : 'gray'}`}>{t(`rules.status.${form.status}`)}</span>
                    </div>
                    {form.name.trim() ? <div className="wcr-summary__name">{form.name.trim()}</div> : null}
                    <p className="wcr-summary__sentence">
                        {useProfile
                            ? t('rules.summary.sentenceProfile', {
                                who: t(`rules.summary.who.${form.employeeRole}`),
                                what: t(`rules.summary.what.${form.appliesTo}`),
                            })
                            : t('rules.summary.sentence', {
                                who: t(`rules.summary.who.${form.employeeRole}`),
                                rate: rateValid ? rateNum : '—',
                                what: t(`rules.summary.what.${form.appliesTo}`),
                            })}
                    </p>
                    {summaryFacts.length ? (
                        <dl className="wcr-summary__facts">
                            {summaryFacts.map((f) => (
                                <div key={f.k} className="wcr-summary__fact">
                                    <dt>{f.k}</dt>
                                    <dd>{f.v}</dd>
                                </div>
                            ))}
                        </dl>
                    ) : (
                        <p className="wcr-summary__muted">{t('rules.summary.anything')}</p>
                    )}
                    {rateValid && !useProfile ? (
                        <p className="wcr-summary__example">
                            {isTechnician
                                ? t('rules.summary.example', { solo: money2(solo), pair: money2(solo / 2) })
                                : t('rules.summary.exampleStaff', { solo: money2(solo) })}
                        </p>
                    ) : null}
                    <p className="wcr-summary__note">
                        <Layers size={14} aria-hidden />
                        <span>{t('rules.summary.priorityNote')}</span>
                    </p>
                    <p className="wcr-summary__note">
                        <Info size={14} aria-hidden />
                        <span>{roleNote}</span>
                    </p>
                </aside>
            </div>
        </WorkshopSubScreen>
    );
}
