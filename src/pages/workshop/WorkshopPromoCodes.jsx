import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Plus, Pencil } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { qs, branchScopeParams, unwrapWorkshopBranchListResponse } from '../../services/workshopStaffApi';
import { getBranchProducts, getBranchServices } from '../../services/workshopCatalogApi';
import WorkshopSubScreen from '../../components/workshop/WorkshopSubScreen';
import WsTableScroll from '../../components/workshop/WsTableScroll';
import PromoCodeFormFields from '../../components/promo/PromoCodeFormFields';
import {
    buildPromoPayload,
    catalogItemId,
    emptyPromoForm as emptyForm,
    promoToForm,
    strTrim,
    toNumber,
    validatePromoForm,
} from '../../components/promo/promoCodeFormUtils';
import { useAuth } from '../../context/AuthContext';
import { ShimmerTableBodyRows } from '../../components/supplier/Shimmer';
import { wpromoLocalizeValidation, wpromoT } from '../../utils/workshopPromoCodesI18n';

const inferScope = (explicit, ids) => {
    const s = String(explicit ?? '').trim().toLowerCase();
    if (s === 'all' || s === 'selected' || s === 'none') return s;
    return ids.length > 0 ? 'selected' : 'all';
};

function scopeLabel(t, scope, count, kind) {
    if (scope === 'none') return t(`scope.${kind}.none`);
    if (scope === 'selected') return t(`scope.${kind}.selected`, { count });
    return t(`scope.${kind}.all`);
}

function scopeSummary(t, promo, branches) {
    const branchIds = promo.branchIds ?? [];
    const productIds = promo.productIds ?? [];
    const serviceIds = promo.serviceIds ?? [];
    const productScope = inferScope(promo.productScope, productIds);
    const serviceScope = inferScope(promo.serviceScope, serviceIds);
    const branchText = branchIds.length === 0
        ? t('branch.all')
        : branchIds.length === 1
            ? (branches.find((b) => String(b.id) === String(branchIds[0]))?.name ?? t('branch.one'))
            : t('branch.n', { count: branchIds.length });
    const productText = scopeLabel(t, productScope, productIds.length, 'products');
    const serviceText = scopeLabel(t, serviceScope, serviceIds.length, 'services');
    return { branchText, productText, serviceText };
}

export default function WorkshopPromoCodes({ selectedBranchId = 'all', branches = [], locale: localeProp }) {
    const locale = localeProp || (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) || 'en';
    const t = useCallback((key, vars) => wpromoT(locale, key, vars), [locale]);
    const { hasPermission } = useAuth();
    const canCreatePromo = hasPermission('workshop.promo-codes.create');
    const canEditPromo   = hasPermission('workshop.promo-codes.edit');
    const branchLabel = useMemo(() => {
        if (!selectedBranchId || selectedBranchId === 'all') return t('branch.all');
        return branches.find((b) => String(b.id) === String(selectedBranchId))?.name || t('branch.fallback');
    }, [branches, selectedBranchId, t]);

    const [promoCodes, setPromoCodes] = useState([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [modalError, setModalError] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingPromo, setEditingPromo] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [catalogProducts, setCatalogProducts] = useState([]);
    const [catalogServices, setCatalogServices] = useState([]);
    const [catalogLoading, setCatalogLoading] = useState(false);

    const branchIdsForCatalog = useMemo(() => {
        if (form.branchMode === 'all') {
            return branches.filter((b) => b.isActive !== false).map((b) => String(b.id));
        }
        return form.branchIds;
    }, [form.branchMode, form.branchIds, branches]);

    const loadPromoCodes = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await apiFetch(
                `/workshop-staff/promo-codes${qs({
                    limit: 100,
                    offset: 0,
                    ...branchScopeParams(selectedBranchId),
                })}`,
            );
            if (!(response?.success && Array.isArray(response.promoCodes))) {
                throw new Error(t('err.invalidResponse'));
            }
            let rows = response.promoCodes;
            if (selectedBranchId && selectedBranchId !== 'all') {
                const bid = String(selectedBranchId);
                rows = rows.filter((pc) => {
                    const ids = pc.branchIds ?? pc.branch_ids ?? pc.applicableBranchIds;
                    if (!Array.isArray(ids) || ids.length === 0) return true;
                    return ids.some((id) => String(id) === bid);
                });
            }
            setPromoCodes(rows);
            setTotal(response.total ?? rows.length);
        } catch (err) {
            setError(err.message || t('err.load'));
        } finally {
            setIsLoading(false);
        }
    }, [selectedBranchId, t]);

    useEffect(() => {
        loadPromoCodes();
    }, [loadPromoCodes]);

    useEffect(() => {
        if (!showCreateModal) return undefined;
        let cancelled = false;

        const loadCatalog = async () => {
            if (branchIdsForCatalog.length === 0) {
                setCatalogProducts([]);
                setCatalogServices([]);
                return;
            }
            setCatalogLoading(true);
            try {
                const productMap = new Map();
                const serviceMap = new Map();
                await Promise.all(branchIdsForCatalog.map(async (bid) => {
                    const [pRes, sRes] = await Promise.all([
                        getBranchProducts(bid).catch(() => null),
                        getBranchServices(bid).catch(() => null),
                    ]);
                    for (const p of unwrapWorkshopBranchListResponse(pRes, 'products')) {
                        const id = catalogItemId(p, 'products');
                        if (id) productMap.set(id, p);
                    }
                    for (const s of unwrapWorkshopBranchListResponse(sRes, 'services')) {
                        const id = catalogItemId(s, 'services');
                        if (id) serviceMap.set(id, s);
                    }
                }));
                if (!cancelled) {
                    setCatalogProducts([...productMap.values()]);
                    setCatalogServices([...serviceMap.values()]);
                }
            } finally {
                if (!cancelled) setCatalogLoading(false);
            }
        };

        loadCatalog();
        return () => { cancelled = true; };
    }, [showCreateModal, branchIdsForCatalog.join('|')]);

    useEffect(() => {
        if (!showCreateModal || catalogLoading) return undefined;
        // Wait until catalog has loaded for the selected branch scope before pruning ids.
        if (
            branchIdsForCatalog.length > 0
            && catalogProducts.length === 0
            && catalogServices.length === 0
        ) {
            return undefined;
        }
        setForm((prev) => {
            if (prev.productScope !== 'selected' && prev.serviceScope !== 'selected') return prev;
            const validProductIds = new Set(
                catalogProducts.map((p) => catalogItemId(p, 'products')).filter(Boolean),
            );
            const validServiceIds = new Set(
                catalogServices.map((s) => catalogItemId(s, 'services')).filter(Boolean),
            );
            const productIds = prev.productScope === 'selected'
                ? prev.productIds.filter((id) => validProductIds.has(id))
                : [];
            const serviceIds = prev.serviceScope === 'selected'
                ? prev.serviceIds.filter((id) => validServiceIds.has(id))
                : [];
            if (
                productIds.length === prev.productIds.length
                && serviceIds.length === prev.serviceIds.length
            ) {
                return prev;
            }
            return { ...prev, productIds, serviceIds };
        });
        return undefined;
    }, [showCreateModal, catalogLoading, catalogProducts, catalogServices, branchIdsForCatalog.join('|')]);

    const openCreate = () => {
        setEditingPromo(null);
        setForm(emptyForm());
        setModalError('');
        setShowCreateModal(true);
    };

    const openEdit = (promo) => {
        setEditingPromo(promo);
        setForm(promoToForm(promo));
        setModalError('');
        setShowCreateModal(true);
    };

    const closeModal = () => {
        setShowCreateModal(false);
        setEditingPromo(null);
        setForm(emptyForm());
        setModalError('');
        setCatalogProducts([]);
        setCatalogServices([]);
    };

    const validateForm = () =>
        validatePromoForm(form, { catalogLoading });

    const savePromoCode = async (event) => {
        event?.preventDefault?.();
        event?.stopPropagation?.();

        const validationMsg = validateForm();
        if (validationMsg) {
            setModalError(wpromoLocalizeValidation(locale, validationMsg));
            return;
        }

        if (!editingPromo?.id && !strTrim(form.code)) {
            setModalError(t('err.codeRequired'));
            return;
        }

        setIsSaving(true);
        setModalError('');
        setError('');
        try {
            const payload = buildPromoPayload(form, { includeIsActive: true });
            if (editingPromo?.id) {
                const response = await apiFetch(`/workshop-staff/promo-code/${encodeURIComponent(String(editingPromo.id))}`, {
                    method: 'PATCH',
                    body: JSON.stringify(payload),
                });
                if (response?.success === false) {
                    throw new Error(response.message || t('err.update'));
                }
            } else {
                await apiFetch('/workshop-staff/promo-code/create', {
                    method: 'POST',
                    body: JSON.stringify({
                        ...payload,
                        usageLimit: payload.usageLimit ?? undefined,
                        minOrderAmount: payload.minOrderAmount ?? undefined,
                        isActive: true,
                    }),
                });
            }
            closeModal();
            await loadPromoCodes();
        } catch (err) {
            setModalError(err.message || (editingPromo ? t('err.update') : t('err.create')));
        } finally {
            setIsSaving(false);
        }
    };

    const activeCount = promoCodes.filter((p) => p.isActive).length;

    const needsCatalogForSave =
        form.productScope === 'selected'
        || form.serviceScope === 'selected'
        || (form.branchMode === 'selected' && form.branchIds.length > 0);
    const saveBlockedByCatalog = catalogLoading && needsCatalogForSave;
    const dash = t('emdash');

    if (showCreateModal) {
        return (
            <WorkshopSubScreen
                title={editingPromo ? t('modal.editTitle', { code: editingPromo.code }) : t('modal.createTitle')}
                subtitle={t('modal.subtitle')}
                backLabel={t('modal.back')}
                onBack={closeModal}
                backDisabled={isSaving}
                size="xl"
                maxWidth="920px"
                className="ws-promo-sub-screen"
                footer={(
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
                        {modalError ? (
                            <p className="ws-promo-form-error" style={{ margin: 0 }}>{modalError}</p>
                        ) : null}
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', width: '100%' }}>
                            <button type="button" className="btn-secondary" onClick={closeModal} disabled={isSaving}>
                                {t('btn.cancel')}
                            </button>
                            <button
                                type="submit"
                                form="ws-promo-code-form"
                                className="btn-submit"
                                disabled={isSaving || saveBlockedByCatalog}
                            >
                                {isSaving
                                    ? t('btn.saving')
                                    : saveBlockedByCatalog
                                        ? t('btn.loadingCatalog')
                                        : editingPromo
                                            ? t('btn.updatePromo')
                                            : t('btn.createPromo')}
                            </button>
                        </div>
                    </div>
                )}
            >
                <div className="ws-section ws-promo-form-body" style={{ padding: 20 }}>
                    <form
                        id="ws-promo-code-form"
                        onSubmit={savePromoCode}
                        noValidate
                    >
                        <PromoCodeFormFields
                            form={form}
                            setForm={setForm}
                            branches={branches}
                            catalogProducts={catalogProducts}
                            catalogServices={catalogServices}
                            catalogLoading={catalogLoading}
                            codeReadOnly={Boolean(editingPromo)}
                            usageCount={editingPromo ? toNumber(editingPromo.usageCount) : undefined}
                            formError={modalError}
                        />
                    </form>
                </div>
            </WorkshopSubScreen>
        );
    }

    return (
        <div>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">{t('page.title')}</h2>
                    <p className="ws-page-sub">
                        {t('page.subtitleLead')} · <strong>{branchLabel}</strong>
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" className="btn-portal" onClick={loadPromoCodes} disabled={isLoading}>
                        <RefreshCw size={14} /> {isLoading ? t('btn.refreshing') : t('btn.refresh')}
                    </button>
                    {canCreatePromo && (
                        <button type="button" className="btn-portal" onClick={openCreate}>
                            <Plus size={14} /> {t('btn.create')}
                        </button>
                    )}
                </div>
            </div>

            {error && (
                <div className="ws-section" style={{ marginBottom: 16, color: '#B91C1C', borderColor: '#FECACA' }}>
                    {error}
                </div>
            )}

            <div className="ws-kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                <div className="ws-kpi-card">
                    <div>
                        <p className="ws-kpi-label">{t('kpi.total')}</p>
                        <p className="ws-kpi-value">{total}</p>
                    </div>
                    <div className="ws-kpi-icon ws-kpi-icon--purple">{t('kpi.icon.pc')}</div>
                </div>
                <div className="ws-kpi-card">
                    <div>
                        <p className="ws-kpi-label">{t('kpi.active')}</p>
                        <p className="ws-kpi-value">{activeCount}</p>
                    </div>
                    <div className="ws-kpi-icon ws-kpi-icon--green">{t('kpi.icon.on')}</div>
                </div>
            </div>

            <div className="ws-section" style={{ marginTop: 16 }}>
                <WsTableScroll style={{ padding: 16 }}>
                    <table className="ws-table">
                        <thead>
                            <tr>
                                <th>{t('th.code')}</th>
                                <th>{t('th.discount')}</th>
                                <th>{t('th.branches')}</th>
                                <th>{t('th.products')}</th>
                                <th>{t('th.services')}</th>
                                <th>{t('th.validity')}</th>
                                <th>{t('th.usage')}</th>
                                <th>{t('th.minOrder')}</th>
                                <th>{t('th.status')}</th>
                                <th style={{ width: 100 }}>{t('th.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading && promoCodes.length === 0 ? (
                                <ShimmerTableBodyRows rows={6} columns={10} />
                            ) : promoCodes.length === 0 ? (
                                <tr>
                                    <td colSpan={10} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                        {t('empty')}
                                    </td>
                                </tr>
                            ) : (
                                promoCodes.map((promo) => {
                                    const scope = scopeSummary(t, promo, branches);
                                    return (
                                        <tr key={promo.id}>
                                            <td><strong>{promo.code}</strong></td>
                                            <td>
                                                {promo.discountType === 'percent'
                                                    ? t('discount.percent', { value: toNumber(promo.discountValue) })
                                                    : t('money.sar', { amount: toNumber(promo.discountValue).toLocaleString() })}
                                            </td>
                                            <td>{scope.branchText}</td>
                                            <td>{scope.productText}</td>
                                            <td>{scope.serviceText}</td>
                                            <td>
                                                {t('validity.range', {
                                                    from: promo.validFrom || dash,
                                                    to: promo.validTo || dash,
                                                })}
                                            </td>
                                            <td>
                                                {promo.usageLimit != null && promo.usageLimit !== ''
                                                    ? t('usage.limited', {
                                                        used: toNumber(promo.usageCount),
                                                        limit: toNumber(promo.usageLimit),
                                                    })
                                                    : t('usage.unlimited', { used: toNumber(promo.usageCount) })}
                                            </td>
                                            <td>{t('money.sar', { amount: toNumber(promo.minOrderAmount).toLocaleString() })}</td>
                                            <td>
                                                <span className={`ws-badge ${promo.isActive ? 'ws-badge--green' : 'ws-badge--gray'}`}>
                                                    {promo.isActive ? t('status.active') : t('status.inactive')}
                                                </span>
                                            </td>
                                            <td>
                                                {canEditPromo && (
                                                    <button
                                                        type="button"
                                                        className="btn-portal"
                                                        style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                                                        onClick={() => openEdit(promo)}
                                                    >
                                                        <Pencil size={12} /> {t('btn.edit')}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </WsTableScroll>
            </div>

        </div>
    );
}
