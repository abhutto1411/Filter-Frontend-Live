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
    dateOnly,
    emptyPromoForm as emptyForm,
    promoToForm,
    strTrim,
    toNumber,
    validatePromoForm,
} from '../../components/promo/promoCodeFormUtils';
import { useAuth } from '../../context/AuthContext';
import { ShimmerTableBodyRows } from '../../components/supplier/Shimmer';

const inferScope = (explicit, ids) => {
    const s = String(explicit ?? '').trim().toLowerCase();
    if (s === 'all' || s === 'selected' || s === 'none') return s;
    return ids.length > 0 ? 'selected' : 'all';
};

function scopeLabel(scope, count, kind) {
    if (scope === 'none') return `No ${kind}`;
    if (scope === 'selected') return `${count} ${kind}`;
    return `All ${kind}`;
}

function scopeSummary(promo, branches) {
    const branchIds = promo.branchIds ?? [];
    const productIds = promo.productIds ?? [];
    const serviceIds = promo.serviceIds ?? [];
    const productScope = inferScope(promo.productScope, productIds);
    const serviceScope = inferScope(promo.serviceScope, serviceIds);
    const branchText = branchIds.length === 0
        ? 'All branches'
        : branchIds.length === 1
            ? (branches.find((b) => String(b.id) === String(branchIds[0]))?.name ?? '1 branch')
            : `${branchIds.length} branches`;
    const productText = scopeLabel(productScope, productIds.length, 'products');
    const serviceText = scopeLabel(serviceScope, serviceIds.length, 'services');
    return { branchText, productText, serviceText };
}

export default function WorkshopPromoCodes({ selectedBranchId = 'all', branches = [] }) {
    const { hasPermission } = useAuth();
    const canCreatePromo = hasPermission('workshop.promo-codes.create');
    const canEditPromo   = hasPermission('workshop.promo-codes.edit');
    const branchLabel = useMemo(() => {
        if (!selectedBranchId || selectedBranchId === 'all') return 'All branches';
        return branches.find((b) => String(b.id) === String(selectedBranchId))?.name || 'Branch';
    }, [branches, selectedBranchId]);

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
                throw new Error('Invalid promo codes response.');
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
            setError(err.message || 'Failed to load promo codes.');
        } finally {
            setIsLoading(false);
        }
    }, [selectedBranchId]);

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
            setModalError(validationMsg);
            return;
        }

        if (!editingPromo?.id && !strTrim(form.code)) {
            setModalError('Promo code is required.');
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
                    throw new Error(response.message || 'Failed to update promo code.');
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
            setModalError(err.message || (editingPromo ? 'Failed to update promo code.' : 'Failed to create promo code.'));
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

    if (showCreateModal) {
        return (
            <WorkshopSubScreen
                title={editingPromo ? `Edit Promo — ${editingPromo.code}` : 'Create Promo Code'}
                subtitle="Discount rules, branch scope, and catalog eligibility."
                backLabel="Back to Promo Codes"
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
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="ws-promo-code-form"
                                className="btn-submit"
                                disabled={isSaving || saveBlockedByCatalog}
                            >
                                {isSaving ? 'Saving...' : saveBlockedByCatalog ? 'Loading catalog...' : editingPromo ? 'Update Promo' : 'Create Promo'}
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
                    <h2 className="ws-page-title">Promo Codes</h2>
                    <p className="ws-page-sub">
                        Create and manage promotional codes · <strong>{branchLabel}</strong>
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" className="btn-portal" onClick={loadPromoCodes} disabled={isLoading}>
                        <RefreshCw size={14} /> {isLoading ? 'Refreshing...' : 'Refresh'}
                    </button>
                    {canCreatePromo && (
                        <button type="button" className="btn-portal" onClick={openCreate}>
                            <Plus size={14} /> Create Promo
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
                        <p className="ws-kpi-label">Total Promo Codes</p>
                        <p className="ws-kpi-value">{total}</p>
                    </div>
                    <div className="ws-kpi-icon ws-kpi-icon--purple">PC</div>
                </div>
                <div className="ws-kpi-card">
                    <div>
                        <p className="ws-kpi-label">Active</p>
                        <p className="ws-kpi-value">{activeCount}</p>
                    </div>
                    <div className="ws-kpi-icon ws-kpi-icon--green">ON</div>
                </div>
            </div>

            <div className="ws-section" style={{ marginTop: 16 }}>
                <WsTableScroll style={{ padding: 16 }}>
                    <table className="ws-table">
                        <thead>
                            <tr>
                                <th>Code</th>
                                <th>Discount</th>
                                <th>Branches</th>
                                <th>Products</th>
                                <th>Services</th>
                                <th>Validity</th>
                                <th>Usage</th>
                                <th>Min Order</th>
                                <th>Status</th>
                                <th style={{ width: 100 }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading && promoCodes.length === 0 ? (
                                <ShimmerTableBodyRows rows={6} columns={10} />
                            ) : promoCodes.length === 0 ? (
                                <tr>
                                    <td colSpan={10} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                        No promo codes found
                                    </td>
                                </tr>
                            ) : (
                                promoCodes.map((promo) => {
                                    const scope = scopeSummary(promo, branches);
                                    return (
                                        <tr key={promo.id}>
                                            <td><strong>{promo.code}</strong></td>
                                            <td>
                                                {promo.discountType === 'percent'
                                                    ? `${toNumber(promo.discountValue)}%`
                                                    : `SAR ${toNumber(promo.discountValue).toLocaleString()}`}
                                            </td>
                                            <td>{scope.branchText}</td>
                                            <td>{scope.productText}</td>
                                            <td>{scope.serviceText}</td>
                                            <td>
                                                {promo.validFrom || '—'} to {promo.validTo || '—'}
                                            </td>
                                            <td>
                                                {promo.usageLimit != null && promo.usageLimit !== ''
                                                    ? `${toNumber(promo.usageCount)} / ${toNumber(promo.usageLimit)}`
                                                    : `${toNumber(promo.usageCount)} / ∞`}
                                            </td>
                                            <td>SAR {toNumber(promo.minOrderAmount).toLocaleString()}</td>
                                            <td>
                                                <span className={`ws-badge ${promo.isActive ? 'ws-badge--green' : 'ws-badge--gray'}`}>
                                                    {promo.isActive ? 'active' : 'inactive'}
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
                                                        <Pencil size={12} /> Edit
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
