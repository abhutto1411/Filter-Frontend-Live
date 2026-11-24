import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Info, Layers, Lock, Percent, Sparkles } from 'lucide-react';
import WorkshopSubScreen from '../workshop/WorkshopSubScreen';
import MultiSelectSearchCombo from '../MultiSelectSearchCombo';
import { apiFetch } from '../../services/api';
import {
    createWorkshopCommissionRule,
    getCommissionRuleCategories,
    getCommissionRuleDepartments,
    getCommissionRuleKmValues,
    getCommissionRulePeople,
    getCommissionRuleProducts,
    getCommissionRuleServices,
    getWorkshopCommissionRule,
    updateWorkshopCommissionRule,
} from '../../services/workshopCommissionsApi';
import CommissionRuleApplyPanel from './CommissionRuleApplyPanel';
import CommissionRuleConflictDialog from './CommissionRuleConflictDialog';
import {
    commissionRuleSavePlan,
    normalizeRuleDate,
    ruleEffectiveDateError,
    ruleEffectivePayload,
    savedRuleIdentity,
} from './commissionRuleDates';
import {
    COMMISSION_RULE_APPLIES_TO as APPLIES_TO,
    COMMISSION_ROLE_GROUPS,
    COMMISSION_RULE_ROLES,
    COMMISSION_TECHNICIAN_ROLES,
    commissionPeopleKey,
    commissionRoleGroup,
} from './commissionRuleConstants';
import {
    bumpConflictEditSession,
    isConflictEditSessionCurrent,
    releaseConflictEditLock,
    resolveRuleForConflictEdit,
    tryAcquireConflictEditLock,
} from './openConflictRuleEditor';
import {
    applyCommissionTypeChange,
    commissionTypeFieldsFromRule,
    commissionTypePayload,
    commissionValueErrorKey,
    formatCommissionFormRate,
    isCommissionValueValid,
    normalizeCommissionType,
} from './commissionRuleType';
import '../../pages/workshop/Workshop.css';

const EMPTY_FORM = {
    name: '',
    priority: 1,
    status: 'active',
    employeeRole: 'Technician',
    people: [],
    appliesTo: 'all',
    branchIds: [],
    departmentIds: [],
    categoryIds: [],
    productIds: [],
    serviceIds: [],
    kmValues: [],
    commissionType: 'Percentage',
    value: '',
    useProfilePercent: false,
    notes: '',
    effectiveFrom: '',
    effectiveTo: '',
};

const ids = (list) => (Array.isArray(list) ? list.map(String) : []);

function formFromRule(rule) {
    if (!rule) return EMPTY_FORM;
    const employeeRole = COMMISSION_RULE_ROLES.includes(rule.employeeRole) ? rule.employeeRole : 'Technician';
    const { commissionType, useProfilePercent } = commissionTypeFieldsFromRule(rule);
    return {
        name: rule.name || '',
        priority: Number(rule.priority || 1),
        status: rule.status === 'inactive' ? 'inactive' : 'active',
        employeeRole,
        people: ids(rule[commissionPeopleKey(employeeRole)]),
        appliesTo: APPLIES_TO.includes(rule.appliesTo) ? rule.appliesTo : 'all',
        branchIds: ids(rule.branchIds),
        departmentIds: ids(rule.departmentIds),
        categoryIds: ids(rule.categoryIds),
        productIds: ids(rule.productIds),
        serviceIds: ids(rule.serviceIds),
        kmValues: (rule.kmValues || []).map(Number),
        commissionType,
        value: useProfilePercent ? '' : rule.value != null ? String(rule.value) : '',
        useProfilePercent,
        notes: rule.notes || '',
        effectiveFrom: normalizeRuleDate(rule.effectiveFrom ?? rule.effective_from),
        effectiveTo: normalizeRuleDate(rule.effectiveTo ?? rule.effective_to),
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
    canApply = false,
    onCancel,
    onSaved,
    onOpenExistingRule,
}) {
    const [savedRuleId, setSavedRuleId] = useState(() =>
        rule?.id != null && String(rule.id).trim() !== '' ? String(rule.id) : '',
    );
    /** Create returned no id. Further Save stays blocked so it cannot insert a second rule. */
    const [createdWithoutId, setCreatedWithoutId] = useState(false);
    const isEdit = Boolean(savedRuleId);
    const [form, setForm] = useState(() => formFromRule(rule));
    const [branches, setBranches] = useState([]);
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
    const [conflictErr, setConflictErr] = useState(null);
    const [conflictEditError, setConflictEditError] = useState('');
    const [conflictEditBusy, setConflictEditBusy] = useState(false);
    const conflictEditBusyRef = useRef(false);
    const conflictEditSessionRef = useRef(0);
    const [applyTarget, setApplyTarget] = useState(null);
    const [applyNonce, setApplyNonce] = useState(0);
    const nameRef = useRef(null);
    const applyRef = useRef(null);
    const saveBtnRef = useRef(null);
    /** Set for the whole request so a second click cannot create another rule. */
    const savingRef = useRef(false);
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
        if (applyTarget) applyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, [applyTarget, applyNonce]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoadingCatalog(true);
            try {
                const [d, c, b] = await Promise.all([
                    getCommissionRuleDepartments(scopeParams),
                    getCommissionRuleCategories(scopeParams),
                    apiFetch('/workshop-staff/branches'),
                ]);
                if (cancelled) return;
                const branchList = Array.isArray(b?.branches)
                    ? b.branches
                    : Array.isArray(b)
                        ? b
                        : [];
                setBranches(branchList.filter((row) => row?.id != null && row?.name));
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

    const commissionType = normalizeCommissionType(form.commissionType);
    const isFixed = commissionType === 'Fixed';
    const useProfile = !isFixed && Boolean(form.useProfilePercent);
    const rateNum = Number(form.value);
    const rateValid = isCommissionValueValid(commissionType, form.value, useProfile);
    const onCommissionType = (next) => {
        setForm((p) => applyCommissionTypeChange(p, next));
    };

    const summaryFacts = useMemo(() => {
        const facts = [];
        const labelsOf = (options, selected) =>
            options.filter((o) => selected.includes(o.id)).map((o) => o.label);
        const peopleNames = labelsOf(peopleOptions, form.people);
        if (peopleNames.length) facts.push({ k: t('rules.summary.people'), v: joinNames(peopleNames) });
        const branchNames = branches
            .filter((row) => form.branchIds.includes(String(row.id)))
            .map((row) => row.name)
            .filter(Boolean);
        if (branchNames.length) facts.push({ k: t('rules.branch'), v: joinNames(branchNames) });
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
        if (form.effectiveFrom) facts.push({ k: t('rules.effectiveFrom'), v: form.effectiveFrom });
        if (form.effectiveTo) facts.push({ k: t('rules.effectiveTo'), v: form.effectiveTo });
        return facts;
    }, [
        peopleOptions,
        branches,
        form.branchIds,
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
        form.effectiveFrom,
        form.effectiveTo,
        t,
    ]);

    const onSubmit = async () => {
        if (readOnly) return;
        const plan = commissionRuleSavePlan({
            ruleId: rule?.id,
            savedRuleId,
            inFlight: savingRef.current,
            createdWithoutId,
        });
        if (plan.action === 'skip') return;
        if (!form.name.trim()) {
            setSubmitError(t('rules.err.nameRequired'));
            nameRef.current?.focus();
            return;
        }
        if (!rateValid) {
            setSubmitError(t(commissionValueErrorKey(commissionType, form.value, useProfile)));
            return;
        }
        const priority = Number(form.priority);
        if (!Number.isInteger(priority) || priority < 1 || priority > 999) {
            setSubmitError(t('rules.err.priorityRange'));
            return;
        }
        const dateError = ruleEffectiveDateError(form.effectiveFrom, form.effectiveTo);
        if (dateError === 'order') {
            setSubmitError(t('rules.err.effectiveOrder'));
            return;
        }
        if (dateError) {
            setSubmitError(t('rules.err.effectiveInvalid'));
            return;
        }
        savingRef.current = true;
        setSubmitting(true);
        setSubmitError('');
        setConflictErr(null);
        const peopleKey = commissionPeopleKey(form.employeeRole);
        const payload = {
            name: form.name.trim(),
            employeeRole: form.employeeRole,
            ...commissionTypePayload(commissionType, form.value, useProfile),
            priority,
            status: form.status,
            appliesTo: form.appliesTo,
            branchIds: form.branchIds,
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
            ...ruleEffectivePayload(form.effectiveFrom, form.effectiveTo),
            ...(workshopId ? { workshopId: String(workshopId) } : {}),
        };
        try {
            const saved = plan.action === 'update'
                ? await updateWorkshopCommissionRule(plan.id, payload)
                : await createWorkshopCommissionRule(payload);
            const identity = savedRuleIdentity(saved, {
                id: plan.action === 'update' ? plan.id : undefined,
                name: payload.name,
            });
            if (!identity) {
                setCreatedWithoutId(true);
                setSubmitError(t('rules.err.savedNoId'));
            } else {
                setSavedRuleId(identity.id);
                setApplyTarget(identity);
                setApplyNonce((n) => n + 1);
            }
            onSaved?.();
        } catch (err) {
            const code = String(err?.code || '');
            if (code === 'COMMISSION_RULE_CONFLICT') {
                setConflictErr(err);
                setSubmitError('');
            } else if (code === 'COMMISSION_RULE_FIXED_WITH_PROFILE_PERCENT') {
                setSubmitError(t('rules.err.fixedWithProfile'));
            } else if (code === 'COMMISSION_RULE_INVALID_TYPE') {
                setSubmitError(t('rules.err.invalidType'));
            } else {
                setSubmitError(err?.message || t('rules.err.generic'));
            }
        } finally {
            savingRef.current = false;
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
    const solo = rateValid && !isFixed ? (115 * rateNum) / 100 : 0;
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
                        <button
                            ref={saveBtnRef}
                            type="button"
                            className="ws-btn-confirm"
                            onClick={onSubmit}
                            disabled={submitting || createdWithoutId}
                        >
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
                        <div className="wcr-grid wcr-grid--2">
                            <label className="wcr-field">
                                <span className="wcr-label">{t('rules.effectiveFrom')}</span>
                                <input
                                    className="wcr-input"
                                    type="date"
                                    value={form.effectiveFrom}
                                    disabled={readOnly}
                                    onChange={(e) => set('effectiveFrom', e.target.value)}
                                />
                            </label>
                            <label className="wcr-field">
                                <span className="wcr-label">{t('rules.effectiveTo')}</span>
                                <input
                                    className="wcr-input"
                                    type="date"
                                    value={form.effectiveTo}
                                    disabled={readOnly}
                                    onChange={(e) => set('effectiveTo', e.target.value)}
                                />
                            </label>
                        </div>
                        <p className="wcr-hint">{t('rules.effectiveHint')}</p>
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
                        <div className="wcr-field">
                            <span className="wcr-label">
                                {t('rules.branch')}
                                {form.branchIds.length ? <em className="wcr-count">{form.branchIds.length}</em> : null}
                            </span>
                            <MultiSelectSearchCombo
                                options={branches.map((row) => ({
                                    id: String(row.id),
                                    label: row.name,
                                }))}
                                value={form.branchIds}
                                disabled={readOnly}
                                onChange={(next) => !readOnly && set('branchIds', next.map(String))}
                                placeholder={loadingCatalog ? t('rules.loadingOptions') : t('rules.branchPh')}
                                emptyHint={loadingCatalog ? t('rules.loadingOptions') : t('rules.branchesEmpty')}
                                clearLabel={t('rules.clear')}
                                menuMinWidth={320}
                            />
                            <span className="wcr-hint">{t('rules.branchHint')}</span>
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
                        <div className="wcr-field" style={{ marginBottom: 12 }}>
                            <span className="wcr-label">{t('rules.commissionType')}</span>
                            <div className="wcr-segment" role="radiogroup" aria-label={t('rules.commissionType')}>
                                {['Percentage', 'Fixed'].map((type) => (
                                    <button
                                        key={type}
                                        type="button"
                                        role="radio"
                                        aria-checked={commissionType === type}
                                        disabled={readOnly}
                                        className={`wcr-segment__btn${commissionType === type ? ' is-on' : ''}`}
                                        onClick={() => onCommissionType(type)}
                                    >
                                        {t(`rules.commissionType.${type}`)}
                                    </button>
                                ))}
                            </div>
                            <span className="wcr-hint">{t('rules.commissionType.hint')}</span>
                        </div>
                        <label className="wcr-check">
                            <input
                                type="checkbox"
                                checked={useProfile}
                                disabled={readOnly || isFixed}
                                onChange={(e) => set('useProfilePercent', e.target.checked)}
                            />
                            <span>
                                <span className="wcr-label">{t('rules.useProfile')}</span>
                                <span className="wcr-hint">
                                    {isFixed ? t('rules.useProfileDisabledFixed') : t('rules.useProfileHint')}
                                </span>
                            </span>
                        </label>
                        <div className="wcr-grid wcr-grid--3">
                            <label className="wcr-field">
                                <span className="wcr-label">
                                    {isFixed ? t('rules.rate.fixed') : t('rules.rate')}
                                </span>
                                <div className="wcr-rate">
                                    <input
                                        className="wcr-input"
                                        type="number"
                                        inputMode="decimal"
                                        min={0}
                                        max={isFixed ? 100000 : 100}
                                        step={0.01}
                                        value={useProfile ? '' : form.value}
                                        disabled={readOnly || useProfile}
                                        placeholder={useProfile ? t('rules.rate.profile') : '0.00'}
                                        onChange={(e) => set('value', e.target.value)}
                                    />
                                    {isFixed ? (
                                        <span className="wcr-rate__icon wcr-rate__suffix" aria-hidden>
                                            {t('rules.rate.sarUnit')}
                                        </span>
                                    ) : (
                                        <Percent size={15} aria-hidden className="wcr-rate__icon" />
                                    )}
                                </div>
                            </label>
                            <p className="wcr-hint wcr-field--span2 wcr-rate__hint">
                                {isFixed ? t('rules.rateHint.fixed') : t('rules.rateHint')}
                            </p>
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
                        <bdi>{formatCommissionFormRate({ ...form, useProfilePercent: useProfile }, t)}</bdi>
                        <span className={`ws-badge ws-badge--${form.status === 'active' ? 'green' : 'gray'}`}>{t(`rules.status.${form.status}`)}</span>
                    </div>
                    {form.name.trim() ? <div className="wcr-summary__name">{form.name.trim()}</div> : null}
                    <p className="wcr-summary__sentence">
                        {useProfile
                            ? t('rules.summary.sentenceProfile', {
                                who: t(`rules.summary.who.${form.employeeRole}`),
                                what: t(`rules.summary.what.${form.appliesTo}`),
                            })
                            : isFixed
                              ? t('rules.summary.sentenceFixed', {
                                    who: t(`rules.summary.who.${form.employeeRole}`),
                                    money: rateValid
                                        ? t('money.sar', { amount: String(rateNum) })
                                        : '—',
                                    what: t(`rules.summary.what.${form.appliesTo}`),
                                })
                              : t('rules.summary.sentence', {
                                    who: t(`rules.summary.who.${form.employeeRole}`),
                                    rate: rateValid ? rateNum : '—',
                                    what: t(`rules.summary.what.${form.appliesTo}`),
                                })}
                    </p>
                    {isFixed && rateValid ? (
                        <p className="wcr-hint">{t('rules.summary.fixedHow')}</p>
                    ) : null}
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
                    {rateValid && !useProfile && !isFixed ? (
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
            {applyTarget ? (
                <div ref={applyRef}>
                    <p className="cx-comp__ok">{t('rules.savedApply')}</p>
                    <CommissionRuleApplyPanel
                        key={`${applyTarget.id}-${applyNonce}`}
                        ruleId={applyTarget.id}
                        ruleName={applyTarget.name}
                        t={t}
                        canApply={canApply}
                        workshopId={workshopId}
                    />
                </div>
            ) : null}
            {conflictErr ? (
                <CommissionRuleConflictDialog
                    err={conflictErr}
                    t={t}
                    returnFocusRef={saveBtnRef}
                    editBusy={conflictEditBusy}
                    editError={conflictEditError}
                    onClose={() => {
                        bumpConflictEditSession(conflictEditSessionRef);
                        setConflictErr(null);
                        setConflictEditError('');
                        setConflictEditBusy(false);
                        releaseConflictEditLock(conflictEditBusyRef);
                    }}
                    onEditRule={
                        typeof onOpenExistingRule === 'function'
                            ? async (id) => {
                                  if (!tryAcquireConflictEditLock(conflictEditBusyRef)) return;
                                  const startedAt = conflictEditSessionRef.current;
                                  setConflictEditBusy(true);
                                  setConflictEditError('');
                                  try {
                                      const result = await resolveRuleForConflictEdit({
                                          id,
                                          rules: [],
                                          fetchRule: (ruleId) =>
                                              getWorkshopCommissionRule(
                                                  ruleId,
                                                  workshopId ? { workshopId } : {},
                                              ),
                                      });
                                      if (!isConflictEditSessionCurrent(conflictEditSessionRef, startedAt)) {
                                          return;
                                      }
                                      if (result.ok) {
                                          setConflictErr(null);
                                          setConflictEditError('');
                                          onOpenExistingRule(result.rule, false);
                                          return;
                                      }
                                      setConflictEditError(t(result.errorKey));
                                  } finally {
                                      if (isConflictEditSessionCurrent(conflictEditSessionRef, startedAt)) {
                                          releaseConflictEditLock(conflictEditBusyRef);
                                          setConflictEditBusy(false);
                                      }
                                  }
                              }
                            : undefined
                    }
                />
            ) : null}
        </WorkshopSubScreen>
    );
}
