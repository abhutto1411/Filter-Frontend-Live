import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Landmark, Loader, Plus, RotateCcw, Wallet } from 'lucide-react';
import Modal from '../../../../components/Modal';
import { useStorageFacilityAccountingApi } from '../StorageFacilityPortalContext';
import { useSfT } from '../useSfT';
import { sfMoney } from '../sfFormat';
import StorageBrandLedgerView from './StorageBrandLedgerView';
import '../../../../styles/ui.css';

const EMPTY_FORM = { name: '', code: '', accountCategory: 'Cash' };

export default function StorageBrandCashBankTab({ brandId }) {
    const t = useSfT();
    const accountingApi = useStorageFacilityAccountingApi();
    const [registers, setRegisters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [ledgerAccount, setLedgerAccount] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await accountingApi.getBrandCashBankRegisters(brandId);
            setRegisters(Array.isArray(res?.registers) ? res.registers : []);
            setLoadError(false);
        } catch {
            setRegisters([]);
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    }, [brandId, accountingApi]);

    useEffect(() => {
        load();
    }, [load, reloadKey]);

    const closeModal = () => {
        if (saving) return;
        setModalOpen(false);
    };

    const createRegister = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await accountingApi.createBrandAccount(brandId, {
                code: form.code.trim(),
                name: form.name.trim(),
                type: 'ASSET',
                accountCategory: form.accountCategory,
                isCashEquivalent: true,
                isRegister: true,
            });
            setModalOpen(false);
            setForm(EMPTY_FORM);
            setReloadKey((k) => k + 1);
        } catch (ex) {
            window.alert(ex?.message || t('cb.errCreate'));
        } finally {
            setSaving(false);
        }
    };

    if (ledgerAccount) {
        return (
            <StorageBrandLedgerView
                brandId={brandId}
                account={ledgerAccount}
                onBack={() => setLedgerAccount(null)}
            />
        );
    }

    return (
        <div className="ui-root ui-root--flush ui-stack">
            <div className="ui-row">
                <p className="ui-lead">{t('cb.lead')}</p>
                <div className="ui-toolbar-end">
                    <button
                        type="button"
                        className="ui-btn ui-btn--primary ui-btn--sm"
                        onClick={() => setModalOpen(true)}
                    >
                        <Plus size={14} /> {t('cb.new')}
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="ui-cards" aria-busy="true">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={`sk-${i}`} className="ui-rcard ui-sk-row">
                            <div className="ui-rcard-top">
                                <div className="ui-sk ui-sk--icon" />
                            </div>
                            <div className="ui-sk ui-sk--strong ui-sk--w70" />
                            <div className="ui-sk ui-sk--text ui-sk--w55" />
                        </div>
                    ))}
                </div>
            ) : loadError ? (
                <div className="ui-empty">
                    <div className="ui-empty-icon"><AlertTriangle size={18} /></div>
                    <div className="ui-empty-title">{t('cb.errLoad')}</div>
                    <div className="ui-empty-sub">{t('cb.errSub')}</div>
                    <button
                        type="button"
                        className="ui-btn ui-btn--default ui-btn--sm"
                        onClick={() => setReloadKey((k) => k + 1)}
                    >
                        <RotateCcw size={13} /> {t('cb.retry')}
                    </button>
                </div>
            ) : registers.length === 0 ? (
                <div className="ui-empty">
                    <div className="ui-empty-icon"><Wallet size={18} /></div>
                    <div className="ui-empty-title">{t('cb.emptyTitle')}</div>
                    <div className="ui-empty-sub">{t('cb.emptySub')}</div>
                </div>
            ) : (
                <div className="ui-cards">
                    {registers.map((r) => {
                        const bank = (r.accountCategory || 'Cash') === 'Bank';
                        return (
                            <button
                                key={r.id}
                                type="button"
                                className="ui-rcard ui-rcard--open"
                                onClick={() => setLedgerAccount(r)}
                            >
                                <div className="ui-rcard-top">
                                    <span className="ui-rcard-icon">
                                        {bank ? <Landmark size={16} /> : <Wallet size={16} />}
                                    </span>
                                    <span className="ui-pill ui-pill--neutral ui-rcard-end">
                                        {t(`cb.cat.${bank ? 'Bank' : 'Cash'}`)}
                                    </span>
                                </div>
                                <p className="ui-rcard-title">{r.name}</p>
                                <p className="ui-rcard-sub">
                                    <span className="ui-meta-ref">{r.code}</span>
                                </p>
                                <div className="ui-rcard-foot">
                                    <span className="ui-rcard-sub">{t('cb.balance')}</span>
                                    <span className="ui-rcard-figure ui-rcard-end">
                                        {sfMoney(t, r.balance)}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {modalOpen ? (
                <Modal
                    title={t('cb.modal.title')}
                    width="480px"
                    // Portalled to <body>, outside this page's `.ui-root`, so
                    // the modal has to carry the design tokens itself.
                    contentClassName="ui-tokens"
                    disableClose={saving}
                    onClose={closeModal}
                >
                    <form onSubmit={createRegister}>
                        <div className="ui-form-grid">
                            <div className="ui-field ui-col-12">
                                <label htmlFor="sf-cb-type">{t('cb.label.type')}</label>
                                <select
                                    id="sf-cb-type"
                                    className="ui-select"
                                    value={form.accountCategory}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, accountCategory: e.target.value }))
                                    }
                                >
                                    <option value="Cash">{t('cb.cat.Cash')}</option>
                                    <option value="Bank">{t('cb.cat.Bank')}</option>
                                </select>
                            </div>
                            <div className="ui-field ui-col-4">
                                <label htmlFor="sf-cb-code">{t('cb.label.code')}</label>
                                <input
                                    id="sf-cb-code"
                                    type="text"
                                    className="ui-input"
                                    value={form.code}
                                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                                    placeholder={t('cb.ph.code')}
                                    required
                                />
                            </div>
                            <div className="ui-field ui-col-8">
                                <label htmlFor="sf-cb-name">{t('cb.label.name')}</label>
                                <input
                                    id="sf-cb-name"
                                    type="text"
                                    className="ui-input"
                                    value={form.name}
                                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                    required
                                />
                            </div>
                        </div>

                        <div className="ui-form-foot">
                            <button
                                type="button"
                                className="ui-btn ui-btn--default"
                                disabled={saving}
                                onClick={closeModal}
                            >
                                {t('cb.btn.cancel')}
                            </button>
                            <button type="submit" className="ui-btn ui-btn--primary" disabled={saving}>
                                {saving ? (
                                    <><Loader size={14} className="ui-spin" /> {t('cb.btn.saving')}</>
                                ) : t('cb.btn.create')}
                            </button>
                        </div>
                    </form>
                </Modal>
            ) : null}
        </div>
    );
}
