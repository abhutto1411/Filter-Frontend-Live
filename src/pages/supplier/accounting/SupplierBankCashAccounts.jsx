import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    createSupplierCashAccount,
    listSupplierCashAccounts,
} from '../../../services/supplierAccountingApi';
import { saccT } from '../../../utils/supplierAccountingI18n';
import {
    AcctCard,
    AcctEmpty,
    AcctError,
    AcctLoading,
    Field,
    formatCoaBalance,
    inputStyle,
    primaryBtnStyle,
    todayISO,
} from './SupplierAccountingShared';
import { extractArray, unwrapPayload } from './SupplierManagerAccountingShared';

export default function SupplierBankCashAccounts({ locale = 'en' }) {
    const t = useCallback((key, vars) => saccT(locale, key, vars), [locale]);
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const [reading, setReading] = useState('');
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        name: '',
        code: '',
        cashKind: 'cash',
        openingBalance: '',
        openingBalanceDate: todayISO(),
        supportsPending: true,
    });

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const res = unwrapPayload(await listSupplierCashAccounts());
            setItems(extractArray(res, ['items']));
            setReading(res?.reading || t('mgr.cash.hint'));
        } catch (e) {
            setErr(e?.message || t('coa.err.load'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        load();
    }, [load]);

    async function save(e) {
        e.preventDefault();
        setSaving(true);
        setErr('');
        try {
            await createSupplierCashAccount({
                name: form.name.trim(),
                code: form.code.trim() || undefined,
                cashKind: form.cashKind,
                openingBalance: Number(form.openingBalance || 0),
                openingBalanceDate: form.openingBalanceDate || undefined,
                supportsPending: form.cashKind === 'bank' ? Boolean(form.supportsPending) : false,
            });
            setForm((f) => ({ ...f, name: '', code: '', openingBalance: '' }));
            await load();
        } catch (ex) {
            setErr(ex?.message || t('coa.err.save'));
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="module-container">
            <AcctCard title={t('mgr.cash.title')}>
                <p style={{ margin: '0 0 14px', fontSize: 13, color: '#64748B', lineHeight: 1.5 }}>
                    {reading || t('mgr.cash.hint')}
                </p>
                <AcctError message={err} />
                {loading ? (
                    <AcctLoading locale={locale} />
                ) : items.length === 0 ? (
                    <AcctEmpty message={t('mgr.cash.empty')} />
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="ws-table" style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th>{t('mgr.cash.th.account')}</th>
                                    <th>{t('mgr.cash.th.kind')}</th>
                                    <th>{t('mgr.cash.th.pending')}</th>
                                    <th style={{ textAlign: 'right' }}>{t('mgr.cash.th.balance')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((a) => (
                                    <tr
                                        key={a.id}
                                        style={{ cursor: 'pointer' }}
                                        onClick={() =>
                                            navigate(`/supplier/accounting/ledger/${encodeURIComponent(a.id)}`)
                                        }
                                    >
                                        <td>
                                            <strong>[{a.code}]</strong> {a.name}
                                        </td>
                                        <td>
                                            {a.cashKind === 'bank'
                                                ? t('mgr.cash.kind.bank')
                                                : t('mgr.cash.kind.cash')}
                                        </td>
                                        <td>{a.supportsPending ? t('mgr.cash.yes') : t('mgr.cash.no')}</td>
                                        <td style={{ textAlign: 'right' }}>
                                            {formatCoaBalance(
                                                a.type,
                                                a.closingDebit,
                                                a.closingCredit,
                                                'SAR',
                                                locale,
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </AcctCard>

            <AcctCard title={t('mgr.cash.new')}>
                <form
                    onSubmit={save}
                    style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}
                >
                    <Field label={t('mgr.cash.name')} required>
                        <input
                            style={inputStyle}
                            value={form.name}
                            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                            required
                        />
                    </Field>
                    <Field label={t('mgr.cash.code')}>
                        <input
                            style={inputStyle}
                            value={form.code}
                            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                        />
                    </Field>
                    <Field label={t('mgr.cash.kind')} required>
                        <select
                            style={inputStyle}
                            value={form.cashKind}
                            onChange={(e) => setForm((f) => ({ ...f, cashKind: e.target.value }))}
                        >
                            <option value="cash">{t('mgr.cash.kind.cash')}</option>
                            <option value="bank">{t('mgr.cash.kind.bank')}</option>
                        </select>
                    </Field>
                    <Field label={t('mgr.cash.opening')}>
                        <input
                            type="number"
                            step="0.01"
                            style={inputStyle}
                            value={form.openingBalance}
                            onChange={(e) => setForm((f) => ({ ...f, openingBalance: e.target.value }))}
                        />
                    </Field>
                    <Field label={t('mgr.cash.openingDate')}>
                        <input
                            type="date"
                            style={inputStyle}
                            value={form.openingBalanceDate}
                            onChange={(e) => setForm((f) => ({ ...f, openingBalanceDate: e.target.value }))}
                        />
                    </Field>
                    {form.cashKind === 'bank' ? (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
                            <input
                                type="checkbox"
                                checked={form.supportsPending}
                                onChange={(e) => setForm((f) => ({ ...f, supportsPending: e.target.checked }))}
                            />
                            {t('mgr.cash.pending')}
                        </label>
                    ) : null}
                    <div style={{ display: 'flex', alignItems: 'end' }}>
                        <button type="submit" style={primaryBtnStyle} disabled={saving || !form.name.trim()}>
                            {saving ? t('hub.btn.saving') : t('mgr.cash.save')}
                        </button>
                    </div>
                </form>
            </AcctCard>
        </div>
    );
}
