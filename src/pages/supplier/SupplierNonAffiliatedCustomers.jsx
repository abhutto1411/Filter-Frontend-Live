import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Plus } from 'lucide-react';
import Modal from '../../components/Modal';
import RowActionsMenu from '../../components/RowActionsMenu';
import {
    createSupplierExternalParty,
    deactivateSupplierExternalParty,
    listSupplierExternalParties,
    updateSupplierExternalParty,
} from '../../services/supplierApi';
import { snacT } from '../../utils/supplierNonAffiliatedCustomersI18n';
import { navigateToSupplierCustomerLedger } from './openSupplierCustomerLedger';

function fmtBalance(n, t) {
    const v = Number(n || 0);
    const abs = Math.abs(v).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    if (v > 0.005) return t('balance.theyOwe', { amount: abs });
    if (v < -0.005) return t('balance.youOwe', { amount: abs });
    return t('balance.settled');
}

const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid rgba(0,0,0,0.12)',
};

export default function SupplierNonAffiliatedCustomers({ locale: localeProp }) {
    const locale =
        localeProp ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => snacT(locale, key, vars), [locale]);
    const navigate = useNavigate();
    const [partyRows, setPartyRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [openingLedger, setOpeningLedger] = useState(false);

    const [addOpen, setAddOpen] = useState(false);
    const [savingParty, setSavingParty] = useState(false);
    const [partyForm, setPartyForm] = useState({
        displayName: '',
        phone: '',
        email: '',
        notes: '',
    });

    const [editParty, setEditParty] = useState(null);

    const loadParties = useCallback(async () => {
        setErr('');
        setLoading(true);
        try {
            const res = await listSupplierExternalParties();
            const payload = res?.parties || res?.coaParties ? res : (res?.data || {});
            const directory = Array.isArray(payload?.parties) ? payload.parties : [];
            const fromCoa = Array.isArray(payload?.coaParties) ? payload.coaParties : [];
            setPartyRows([...directory, ...fromCoa]);
        } catch (e) {
            console.error(e);
            setErr(e?.message || t('err.load'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        loadParties();
    }, [loadParties]);

    const openPartyLedger = async (row) => {
        if (!row?.id && !row?.partyId && !row?.externalPartyId) return;
        setErr('');
        setOpeningLedger(true);
        try {
            const partyType = row.partyType || 'external_party';
            const externalPartyId = row.externalPartyId || (
                partyType === 'external_party' && !row.fromCoa ? String(row.id) : ''
            );
            await navigateToSupplierCustomerLedger(navigate, {
                seedKey: 'AR_NON_AFFILIATED',
                from: 'nonaffiliated_customers',
                partyType,
                partyId: row.partyId || undefined,
                externalPartyId: externalPartyId || undefined,
                partyLabel: row.displayName || t('fallback.customer'),
                missingAccountMessage: t('err.ledgerAccount'),
            });
        } catch (e) {
            console.error(e);
            setErr(e?.message || t('err.openLedger'));
        } finally {
            setOpeningLedger(false);
        }
    };

    const submitParty = async (e) => {
        e.preventDefault();
        if (!partyForm.displayName.trim()) return;
        setSavingParty(true);
        try {
            await createSupplierExternalParty({
                displayName: partyForm.displayName.trim(),
                phone: partyForm.phone.trim() || undefined,
                email: partyForm.email.trim() || undefined,
                notes: partyForm.notes.trim() || undefined,
            });
            setAddOpen(false);
            setPartyForm({ displayName: '', phone: '', email: '', notes: '' });
            await loadParties();
        } catch (errSubmit) {
            console.error(errSubmit);
            setErr(errSubmit?.message || t('err.save'));
        } finally {
            setSavingParty(false);
        }
    };

    const submitEditParty = async (e) => {
        e.preventDefault();
        if (!editParty?.id || !partyForm.displayName.trim()) return;
        setSavingParty(true);
        try {
            await updateSupplierExternalParty(editParty.id, {
                displayName: partyForm.displayName.trim(),
                phone: partyForm.phone.trim() || undefined,
                email: partyForm.email.trim() || undefined,
                notes: partyForm.notes.trim() || undefined,
            });
            setEditParty(null);
            await loadParties();
        } catch (errSubmit) {
            console.error(errSubmit);
            setErr(errSubmit?.message || t('err.update'));
        } finally {
            setSavingParty(false);
        }
    };

    const onDeactivate = async (row) => {
        if (!window.confirm(t('confirm.deactivate'))) {
            return;
        }
        try {
            await deactivateSupplierExternalParty(row.id);
            await loadParties();
        } catch (e) {
            console.error(e);
            setErr(e?.message || t('err.remove'));
        }
    };

    const openEdit = (row) => {
        setPartyForm({
            displayName: row.displayName || '',
            phone: row.phone || '',
            email: row.email || '',
            notes: row.notes || '',
        });
        setEditParty(row);
    };

    return (
        <div>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">{t('page.title')}</h2>
                    <p className="ws-page-sub">{t('page.sub')}</p>
                </div>
                <button type="button" className="btn-portal" onClick={() => setAddOpen(true)}>
                    <Plus size={16} />
                    {t('btn.add')}
                </button>
            </div>

            {err ? (
                <div className="ws-section" style={{ color: '#b91c1c', fontWeight: 600 }}>
                    {err}
                </div>
            ) : null}

            <div className="ws-section">
                <table className="ws-table">
                    <thead>
                        <tr>
                            <th>{t('th.party')}</th>
                            <th>{t('th.balance')}</th>
                            <th style={{ width: 220 }}>{t('th.actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={3}>{t('loading')}</td>
                            </tr>
                        ) : partyRows.length === 0 ? (
                            <tr>
                                <td colSpan={3}>{t('empty')}</td>
                            </tr>
                        ) : (
                            partyRows.map((r) => (
                                <tr
                                    key={r.id}
                                    className="ws-inv-row-clickable"
                                    style={{ cursor: 'pointer' }}
                                    title={t('row.openStatement')}
                                    onClick={() => !openingLedger && openPartyLedger(r)}
                                >
                                    <td>
                                        <div style={{ fontWeight: 700 }}>{r.displayName}</div>
                                        <div style={{ fontSize: '0.76rem', opacity: 0.65 }}>
                                            {r.fromCoa
                                                ? t('hint.fromCoa')
                                                : ([r.phone, r.email].filter(Boolean).join(' · ') || t('emdash'))}
                                        </div>
                                    </td>
                                    <td>{fmtBalance(r.balance, t)}</td>
                                    <td onClick={(ev) => ev.stopPropagation()}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            {r.fromCoa ? null : (
                                            <RowActionsMenu
                                                ariaLabel={t('aria.actions', {
                                                    name: r.displayName || t('fallback.customer'),
                                                })}
                                                items={[
                                                    {
                                                        label: t('btn.edit'),
                                                        onClick: () => openEdit(r),
                                                    },
                                                    {
                                                        label: t('btn.deactivate'),
                                                        onClick: () => onDeactivate(r),
                                                        danger: true,
                                                    },
                                                ]}
                                            />
                                            )}
                                            <button
                                                type="button"
                                                className="btn-portal-outline"
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 4,
                                                    padding: '6px 10px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700,
                                                }}
                                                disabled={openingLedger}
                                                onClick={() => openPartyLedger(r)}
                                            >
                                                {t('btn.statement')}
                                                <ChevronRight size={14} aria-hidden />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {addOpen ? (
                <Modal
                    title={t('modal.addTitle')}
                    onClose={() => !savingParty && setAddOpen(false)}
                    disableClose={savingParty}
                    footer={
                        <>
                            <button
                                type="button"
                                className="btn-portal-outline"
                                onClick={() => setAddOpen(false)}
                                disabled={savingParty}
                            >
                                {t('btn.cancel')}
                            </button>
                            <button
                                type="submit"
                                className="btn-portal"
                                form="party-add-form"
                                disabled={savingParty}
                            >
                                {savingParty ? t('btn.saving') : t('btn.save')}
                            </button>
                        </>
                    }
                >
                    <form id="party-add-form" onSubmit={submitParty}>
                        <label className="ws-form-label-block">
                            {t('modal.displayName')}
                            <input
                                required
                                className="ws-input-like"
                                value={partyForm.displayName}
                                onChange={(e) =>
                                    setPartyForm((f) => ({ ...f, displayName: e.target.value }))
                                }
                                style={inputStyle}
                            />
                        </label>
                        <label className="ws-form-label-block">
                            {t('modal.phone')}
                            <input
                                className="ws-input-like"
                                value={partyForm.phone}
                                onChange={(e) =>
                                    setPartyForm((f) => ({ ...f, phone: e.target.value }))
                                }
                                style={inputStyle}
                            />
                        </label>
                        <label className="ws-form-label-block">
                            {t('modal.email')}
                            <input
                                className="ws-input-like"
                                type="email"
                                value={partyForm.email}
                                onChange={(e) =>
                                    setPartyForm((f) => ({ ...f, email: e.target.value }))
                                }
                                style={inputStyle}
                            />
                        </label>
                        <label className="ws-form-label-block">
                            {t('modal.notes')}
                            <textarea
                                className="ws-input-like"
                                rows={2}
                                value={partyForm.notes}
                                onChange={(e) =>
                                    setPartyForm((f) => ({ ...f, notes: e.target.value }))
                                }
                                style={{ ...inputStyle, resize: 'vertical' }}
                            />
                        </label>
                    </form>
                </Modal>
            ) : null}

            {editParty ? (
                <Modal
                    title={t('modal.editTitle', { name: editParty.displayName })}
                    onClose={() => !savingParty && setEditParty(null)}
                    disableClose={savingParty}
                    footer={
                        <>
                            <button
                                type="button"
                                className="btn-portal-outline"
                                onClick={() => setEditParty(null)}
                                disabled={savingParty}
                            >
                                {t('btn.cancel')}
                            </button>
                            <button
                                type="submit"
                                className="btn-portal"
                                form="party-edit-form"
                                disabled={savingParty}
                            >
                                {savingParty ? t('btn.saving') : t('btn.update')}
                            </button>
                        </>
                    }
                >
                    <form id="party-edit-form" onSubmit={submitEditParty}>
                        <label className="ws-form-label-block">
                            {t('modal.displayName')}
                            <input
                                required
                                className="ws-input-like"
                                value={partyForm.displayName}
                                onChange={(e) =>
                                    setPartyForm((f) => ({ ...f, displayName: e.target.value }))
                                }
                                style={inputStyle}
                            />
                        </label>
                        <label className="ws-form-label-block">
                            {t('modal.phone')}
                            <input
                                className="ws-input-like"
                                value={partyForm.phone}
                                onChange={(e) =>
                                    setPartyForm((f) => ({ ...f, phone: e.target.value }))
                                }
                                style={inputStyle}
                            />
                        </label>
                        <label className="ws-form-label-block">
                            {t('modal.email')}
                            <input
                                className="ws-input-like"
                                type="email"
                                value={partyForm.email}
                                onChange={(e) =>
                                    setPartyForm((f) => ({ ...f, email: e.target.value }))
                                }
                                style={inputStyle}
                            />
                        </label>
                        <label className="ws-form-label-block">
                            {t('modal.notes')}
                            <textarea
                                className="ws-input-like"
                                rows={2}
                                value={partyForm.notes}
                                onChange={(e) =>
                                    setPartyForm((f) => ({ ...f, notes: e.target.value }))
                                }
                                style={{ ...inputStyle, resize: 'vertical' }}
                            />
                        </label>
                    </form>
                </Modal>
            ) : null}
        </div>
    );
}
