import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import {
    createWorkshopCashBankAccount,
    listWorkshopCashBankAccounts,
    updateWorkshopCashBankAccount,
} from '../../services/workshopStaffApi';
import { getPlatformHqInfo } from '../../services/superAdminApi';
import {
    setAccountingHqBooksMode,
    setAccountingWorkshopScopeId,
} from '../../utils/accountingWorkshopScope';
import { loadSaAccountingScope } from './saAccountingScope';
import '../../styles/admin/AccountingPage.css';

function todayIsoDate() {
    return new Date().toISOString().slice(0, 10);
}

function uiCashBankTypeToApi(ui) {
    if (ui === 'Bank') return 'BANK';
    if (ui === 'Petty Cash') return 'PETTY_CASH';
    return 'CASH';
}

function apiCashBankTypeToUi(api) {
    const u = String(api || '').toUpperCase();
    if (u === 'BANK') return 'Bank';
    if (u === 'PETTY_CASH') return 'Petty Cash';
    return 'Cash';
}

/**
 * Full-page create / edit for Platform HQ cash & bank registers (no branch linkage).
 */
export default function HqCashBankAccountPage() {
    const { accountId } = useParams();
    const isEdit = Boolean(accountId);
    const navigate = useNavigate();
    const scope = loadSaAccountingScope();

    const [hqWorkshopId, setHqWorkshopId] = useState(scope.hqWorkshopId || '');
    const [loading, setLoading] = useState(isEdit);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    const [name, setName] = useState('');
    const [type, setType] = useState('Cash');
    const [openingBalance, setOpeningBalance] = useState('0');
    const [openingBalanceDate, setOpeningBalanceDate] = useState(() => todayIsoDate());
    const [status, setStatus] = useState('active');
    const [bankName, setBankName] = useState('');
    const [iban, setIban] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [coaLink, setCoaLink] = useState('');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await getPlatformHqInfo().catch(() => ({}));
                const id = res?.workshopId || scope.hqWorkshopId;
                if (!cancelled && id) {
                    const sid = String(id);
                    setHqWorkshopId(sid);
                    setAccountingWorkshopScopeId(sid);
                    setAccountingHqBooksMode(true);
                }
            } catch {
                /* optional */
            }
        })();
        return () => {
            cancelled = true;
            setAccountingWorkshopScopeId(null);
            setAccountingHqBooksMode(false);
        };
    }, [scope.hqWorkshopId]);

    const loadAccount = useCallback(async () => {
        if (!isEdit || !accountId) return;
        setLoading(true);
        setErr('');
        try {
            const res = await listWorkshopCashBankAccounts();
            const list = res?.accounts || res?.data || [];
            const row = list.find((a) => String(a.id) === String(accountId));
            if (!row) {
                setErr('Account not found in Platform HQ books.');
                return;
            }
            setName(row.name || '');
            setType(apiCashBankTypeToUi(row.type));
            setOpeningBalance(String(row.openingBalance ?? 0));
            setStatus(row.status || 'active');
            setBankName(row.bankName || '');
            setIban(row.iban || '');
            setAccountNumber(row.accountNumber || '');
            const coa = row.coaAccount;
            setCoaLink(coa ? `${coa.code} · ${coa.name}` : '—');
        } catch (e) {
            setErr(e?.message || 'Failed to load account');
        } finally {
            setLoading(false);
        }
    }, [accountId, isEdit]);

    useEffect(() => {
        if (hqWorkshopId) {
            setAccountingWorkshopScopeId(hqWorkshopId);
            setAccountingHqBooksMode(true);
        }
        if (isEdit) void loadAccount();
    }, [hqWorkshopId, isEdit, loadAccount]);

    const goBack = () => navigate('/admin/accounting/cash-bank');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErr('');
        const trimmed = name.trim();
        if (!trimmed) {
            setErr('Account name is required.');
            return;
        }
        setSaving(true);
        try {
            const body = {
                name: trimmed,
                type: uiCashBankTypeToApi(type),
                openingBalance: Number(openingBalance) || 0,
                status,
                workshopId: hqWorkshopId,
                hqBooks: 'true',
            };
            if (type === 'Bank') {
                body.bankName = bankName.trim() || undefined;
                body.iban = iban.trim() || undefined;
                body.accountNumber = accountNumber.trim() || undefined;
            }
            if (isEdit) {
                await updateWorkshopCashBankAccount(accountId, body);
            } else {
                await createWorkshopCashBankAccount(body);
            }
            goBack();
        } catch (ex) {
            setErr(ex?.message || 'Could not save account.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="accounting-page module-container">
            <div className="cash-bank-view" style={{ maxWidth: 720 }}>
                <button
                    type="button"
                    className="btn-portal-outline"
                    style={{ marginBottom: 16, display: 'inline-flex', alignItems: 'center', gap: 8 }}
                    onClick={goBack}
                >
                    <ArrowLeft size={16} />
                    Back to Cash & Bank
                </button>

                <header className="cash-bank-header">
                    <h2 className="cash-bank-title">
                        {isEdit ? 'Edit HQ Cash / Bank Account' : 'New HQ Cash / Bank Account'}
                    </h2>
                    <p className="cash-bank-desc">
                        Platform HQ books — registers are not linked to any workshop branch.
                    </p>
                </header>

                {loading ? (
                    <p className="form-help-text">Loading…</p>
                ) : (
                    <form onSubmit={handleSubmit} className="modal-form-grid" style={{ display: 'grid', gap: 16 }}>
                        {err ? (
                            <p className="form-help-text" style={{ color: '#B45309', gridColumn: '1 / -1' }} role="alert">
                                {err}
                            </p>
                        ) : null}

                        <div className="form-group">
                            <label className="form-label">Account Name *</label>
                            <input
                                type="text"
                                className="form-input-field"
                                placeholder="e.g. HQ Main Bank"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Type *</label>
                            <select
                                className="form-input-field"
                                value={type}
                                onChange={(e) => setType(e.target.value)}
                            >
                                <option value="Cash">Cash</option>
                                <option value="Bank">Bank</option>
                                <option value="Petty Cash">Petty Cash</option>
                            </select>
                        </div>

                        {type === 'Bank' ? (
                            <>
                                <div className="form-group">
                                    <label className="form-label">Bank name</label>
                                    <input
                                        type="text"
                                        className="form-input-field"
                                        value={bankName}
                                        onChange={(e) => setBankName(e.target.value)}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">IBAN</label>
                                    <input
                                        type="text"
                                        className="form-input-field"
                                        value={iban}
                                        onChange={(e) => setIban(e.target.value)}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Account number</label>
                                    <input
                                        type="text"
                                        className="form-input-field"
                                        value={accountNumber}
                                        onChange={(e) => setAccountNumber(e.target.value)}
                                    />
                                </div>
                            </>
                        ) : null}

                        {isEdit ? (
                            <div className="form-group">
                                <label className="form-label">COA link (read-only)</label>
                                <input type="text" className="form-input-field" readOnly value={coaLink} />
                            </div>
                        ) : null}

                        <div className="form-group">
                            <label className="form-label">Opening Balance (SAR)</label>
                            <input
                                type="number"
                                className="form-input-field"
                                value={openingBalance}
                                onChange={(e) => setOpeningBalance(e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Opening balance date</label>
                            <input
                                type="date"
                                className="form-input-field"
                                value={openingBalanceDate}
                                onChange={(e) => setOpeningBalanceDate(e.target.value)}
                            />
                            <p className="form-help-text">For your records only — not sent to the server yet.</p>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Status</label>
                            <select
                                className="form-input-field"
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>

                        <div
                            style={{
                                gridColumn: '1 / -1',
                                display: 'flex',
                                gap: 8,
                                justifyContent: 'flex-end',
                                marginTop: 8,
                            }}
                        >
                            <button type="button" className="btn-secondary" onClick={goBack} disabled={saving}>
                                Cancel
                            </button>
                            <button type="submit" className="btn-submit btn-dark" disabled={saving}>
                                {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create account'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
