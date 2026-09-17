import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Wallet } from 'lucide-react';
import Modal from '../../../../components/Modal';
import { useStorageFacilityAccountingApi } from '../StorageFacilityPortalContext';
import {
    AcctCard,
    AcctEmpty,
    AcctError,
    AcctLoading,
    money,
    primaryBtnStyle,
} from '../../accounting/SupplierAccountingShared';
import StorageBrandLedgerView from './StorageBrandLedgerView';

export default function StorageBrandCashBankTab({ brandId }) {
    const accountingApi = useStorageFacilityAccountingApi();
    const [registers, setRegisters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [ledgerAccount, setLedgerAccount] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [form, setForm] = useState({
        name: '',
        code: '',
        accountCategory: 'Cash',
    });
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const res = await accountingApi.getBrandCashBankRegisters(brandId);
            setRegisters(Array.isArray(res?.registers) ? res.registers : []);
        } catch (e) {
            setErr(e?.message || 'Failed to load registers');
            setRegisters([]);
        } finally {
            setLoading(false);
        }
    }, [brandId, accountingApi]);

    useEffect(() => {
        load();
    }, [load]);

    if (ledgerAccount) {
        return (
            <StorageBrandLedgerView
                brandId={brandId}
                account={ledgerAccount}
                onBack={() => setLedgerAccount(null)}
            />
        );
    }

    async function createRegister(e) {
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
            setForm({ name: '', code: '', accountCategory: 'Cash' });
            await load();
        } catch (ex) {
            window.alert(ex?.message || 'Failed to create register');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>
                    Cash &amp; bank registers used on the Transaction Hub for payments and receipts.
                </p>
                <button type="button" className="mgr-si-btn-new" onClick={() => setModalOpen(true)}>
                    <Plus size={14} /> New register
                </button>
            </div>
            <AcctError message={err} />
            {loading ? (
                <AcctLoading />
            ) : registers.length === 0 ? (
                <AcctEmpty message="No cash or bank registers yet. Create one to start recording payments." />
            ) : (
                <div className="sf-register-grid">
                    {registers.map((r) => (
                        <button
                            key={r.id}
                            type="button"
                            className="sf-register-card"
                            onClick={() => setLedgerAccount(r)}
                        >
                            <Wallet size={22} />
                            <div>
                                <strong>
                                    [{r.code}] {r.name}
                                </strong>
                                <span className="sf-register-card-meta">
                                    {r.accountCategory || 'Cash'} · Balance {money(r.balance)}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            )}
            {modalOpen ? (
                <Modal
                    title="New cash / bank register"
                    width="480px"
                    contentClassName="sf-simple-modal"
                    onClose={() => !saving && setModalOpen(false)}
                >
                    <form className="sf-simple-form" onSubmit={createRegister}>
                        <div className="sf-form-field">
                            <label>Register type</label>
                            <select
                                value={form.accountCategory}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, accountCategory: e.target.value }))
                                }
                            >
                                <option value="Cash">Cash</option>
                                <option value="Bank">Bank</option>
                            </select>
                        </div>
                        <div className="sf-form-row-2">
                            <div className="sf-form-field">
                                <label>Code *</label>
                                <input
                                    value={form.code}
                                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                                    placeholder="e.g. 1020"
                                    required
                                />
                            </div>
                            <div className="sf-form-field">
                                <label>Name *</label>
                                <input
                                    value={form.name}
                                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                    required
                                />
                            </div>
                        </div>
                        <div className="sf-form-actions">
                            <button
                                type="button"
                                className="btn-portal-outline"
                                disabled={saving}
                                onClick={() => setModalOpen(false)}
                            >
                                Cancel
                            </button>
                            <button type="submit" style={primaryBtnStyle} disabled={saving}>
                                {saving ? 'Saving…' : 'Create register'}
                            </button>
                        </div>
                    </form>
                </Modal>
            ) : null}
        </div>
    );
}
