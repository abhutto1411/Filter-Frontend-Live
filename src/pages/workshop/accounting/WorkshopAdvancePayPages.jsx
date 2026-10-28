import React, { useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, ArrowLeftRight, Calendar, Plus, Users, X } from 'lucide-react';
import WsStaffPicker from '../../../components/workshop/WsStaffPicker';
import { workshopStaffSelectValue } from '../../../services/workshopStaffApi';
import { staffMeta, staffName, staffSearchText } from './staffPickerOptions';
import './WorkshopAdvancePayPages.css';

const fmt = (n) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return '0.00';
    return x.toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const accountKey = (a) => String(a.id);
const accountName = (a) => a?.name || '—';
const accountMeta = (a) =>
    [a?.type, a?.branchName || 'Workshop-wide', `SAR ${fmt(a?.currentBalance)}`].filter(Boolean).join(' · ');
const accountSearchText = (a) => [a?.name, a?.type, a?.kind, a?.branchName].filter(Boolean).join(' ');

/** Shared combobox props for the employee and pay-from fields. */
function usePickerProps(t) {
    return useMemo(() => {
        const hint = t('adv.pick.hint');
        return {
            employee: {
                getKey: workshopStaffSelectValue,
                getLabel: staffName,
                getMeta: staffMeta,
                getSearchText: staffSearchText,
                placeholder: t('adv.pick.employeePh'),
                emptyText: t('adv.pick.noEmployee'),
                disabledHint: t('adv.pick.alreadyAdded'),
                hint,
                countText: (n, total, searching) =>
                    searching ? t('adv.pick.matchCount', { n, total }) : t('adv.pick.staffCount', { n: total }),
            },
            account: {
                getKey: accountKey,
                getLabel: accountName,
                getMeta: accountMeta,
                getSearchText: accountSearchText,
                placeholder: t('adv.pick.accountPh'),
                emptyText: t('adv.pick.noAccount'),
                hint,
                countText: (n, total, searching) =>
                    searching ? t('adv.pick.matchCount', { n, total }) : t('adv.pick.accountCount', { n: total }),
            },
        };
    }, [t]);
}

function PageShell({ t, icon, title, description, error, wide, onBack, footer, children }) {
    return (
        <div className={`adv-fullpage${wide ? ' adv-fullpage--wide' : ''}`}>
            <button type="button" className="adv-fullpage__back" onClick={onBack}>
                <ArrowLeft size={16} /> {t('adv.page.back')}
            </button>
            <div className="adv-fullpage__card">
                <header className="adv-fullpage__head">
                    <span className="adv-fullpage__icon">{icon}</span>
                    <div>
                        <h2 className="adv-fullpage__title">{title}</h2>
                        <p className="adv-fullpage__desc">{description}</p>
                    </div>
                </header>
                {error ? <div className="adv-fullpage__error">{error}</div> : null}
                {children}
                <footer className="adv-fullpage__footer">{footer}</footer>
            </div>
        </div>
    );
}

export function AdvancePayPage({
    t,
    controlCode,
    employees,
    accounts,
    form,
    setForm,
    pickEmployee,
    submitting,
    error,
    onBack,
    onSubmit,
}) {
    const picker = usePickerProps(t);
    return (
        <PageShell
            t={t}
            icon={<ArrowLeftRight size={20} />}
            title={t('adv.modal.payTitle')}
            description={t('adv.page.payDesc', { code: controlCode })}
            error={error}
            onBack={onBack}
            footer={
                <>
                    <button type="button" className="btn-ps-cancel" onClick={onBack}>
                        {t('adv.modal.cancel')}
                    </button>
                    <button type="button" className="btn-ps-pay" disabled={submitting} onClick={onSubmit}>
                        {t('adv.modal.payPost', { code: controlCode })}
                    </button>
                </>
            }
        >
            <div className="ps-form">
                <div className="ps-field">
                    <label>{t('adv.field.employee')}</label>
                    <WsStaffPicker
                        {...picker.employee}
                        options={employees}
                        value={form.employeeSelectKey}
                        onChange={(key) =>
                            setForm((p) => ({
                                ...p,
                                ...(key
                                    ? pickEmployee(key)
                                    : { employeeSelectKey: '', employeeRecordId: '', recordType: '', userId: '', employeeName: '' }),
                            }))
                        }
                    />
                </div>
                <div className="ps-row">
                    <div className="ps-field">
                        <label>{t('adv.field.amount')}</label>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.amount}
                            onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                            placeholder="0.00"
                        />
                    </div>
                    <div className="ps-field">
                        <label>{t('adv.field.date')}</label>
                        <div className="ps-date-input">
                            <input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
                            <Calendar size={16} />
                        </div>
                    </div>
                </div>
                <div className="ps-field">
                    <label>{t('adv.field.payFrom')}</label>
                    <WsStaffPicker
                        {...picker.account}
                        options={accounts}
                        value={form.payFromAccountId}
                        onChange={(key) => setForm((p) => ({ ...p, payFromAccountId: key }))}
                    />
                </div>
                <div className="ps-field">
                    <label>{t('adv.field.reason')}</label>
                    <textarea
                        value={form.reason}
                        onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
                        placeholder={t('adv.field.reasonPh')}
                        rows={3}
                    />
                </div>
                <p className="form-help-text" style={{ fontSize: 12, color: '#64748B', margin: 0 }}>
                    {t('adv.help.post', { code: controlCode })}
                </p>
            </div>
        </PageShell>
    );
}

const isBulkRowReady = (r) => Boolean(r.userId && Number(r.amount) > 0 && r.payFromAccountId);

export function AdvanceBulkPage({
    t,
    controlCode,
    employees,
    accounts,
    rows,
    setRows,
    makeRow,
    pickEmployee,
    submitting,
    error,
    onBack,
    onSubmit,
}) {
    const picker = usePickerProps(t);
    const readyCount = rows.filter(isBulkRowReady).length;

    const updateRow = (id, patch) => setRows((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));

    const rowsRef = useRef(null);
    const focusRowId = useRef(null);

    useEffect(() => {
        const id = focusRowId.current;
        if (id == null || !rowsRef.current) return;
        focusRowId.current = null;
        const rowEl = rowsRef.current.querySelector(`[data-row-id="${id}"]`);
        if (!rowEl) return;
        rowEl.scrollIntoView({ block: 'nearest' });
        rowEl.querySelector('.bulk-col-emp input')?.focus();
    }, [rows]);

    const addRow = () => {
        const row = makeRow();
        focusRowId.current = row.id;
        setRows((list) => [...list, row]);
    };

    const removeRow = (id) => {
        if (rows.length <= 1) return;
        const at = rows.findIndex((r) => r.id === id);
        const rest = rows.filter((r) => r.id !== id);
        focusRowId.current = rest[Math.min(at, rest.length - 1)]?.id ?? null;
        setRows(rest);
    };

    return (
        <PageShell
            t={t}
            wide
            icon={<Users size={20} />}
            title={t('adv.modal.bulkTitle')}
            description={t('adv.page.bulkDesc')}
            error={error}
            onBack={onBack}
            footer={
                <>
                    <span className="adv-fullpage__ready">
                        {t('adv.page.rowsReady', { n: readyCount, total: rows.length })}
                    </span>
                    <button type="button" className="btn-ps-cancel" onClick={onBack}>
                        {t('adv.modal.cancel')}
                    </button>
                    <button
                        type="button"
                        className="btn-ps-pay btn-gold"
                        disabled={submitting || readyCount === 0}
                        onClick={onSubmit}
                    >
                        {t('adv.modal.payN', { n: readyCount })}
                    </button>
                </>
            }
        >
            <div className="bulk-form adv-fullpage__bulk">
                <div className="bulk-table-header">
                    <div className="bulk-col-emp">{t('adv.bulk.employee')}</div>
                    <div className="bulk-col-amt">{t('adv.bulk.amount')}</div>
                    <div className="bulk-col-date">{t('adv.bulk.date')}</div>
                    <div className="bulk-col-from">{t('adv.bulk.payFrom')}</div>
                    <div className="bulk-col-reason">{t('adv.bulk.reason')}</div>
                    <div className="bulk-col-actions" />
                </div>
                <div className="bulk-table-rows" ref={rowsRef}>
                    {rows.map((row) => {
                        const takenKeys = new Set(
                            rows.filter((r) => r.id !== row.id && r.employeeSelectKey).map((r) => r.employeeSelectKey),
                        );
                        return (
                            <div className="bulk-row" key={row.id} data-row-id={row.id}>
                                <div className="bulk-col-emp">
                                    <WsStaffPicker
                                        {...picker.employee}
                                        options={employees}
                                        value={row.employeeSelectKey}
                                        disabledKeys={takenKeys}
                                        onChange={(key) =>
                                            updateRow(
                                                row.id,
                                                key
                                                    ? pickEmployee(key)
                                                    : { employeeSelectKey: '', employeeRecordId: '', recordType: '', userId: '', employeeName: '' },
                                            )
                                        }
                                    />
                                </div>
                                <div className="bulk-col-amt">
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={row.amount}
                                        onChange={(e) => updateRow(row.id, { amount: e.target.value })}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="bulk-col-date">
                                    <div className="ps-date-input">
                                        <input type="date" value={row.date} onChange={(e) => updateRow(row.id, { date: e.target.value })} />
                                        <Calendar size={14} />
                                    </div>
                                </div>
                                <div className="bulk-col-from">
                                    <WsStaffPicker
                                        {...picker.account}
                                        options={accounts}
                                        value={row.payFromAccountId}
                                        onChange={(key) => updateRow(row.id, { payFromAccountId: key })}
                                    />
                                </div>
                                <div className="bulk-col-reason">
                                    <input
                                        type="text"
                                        value={row.reason}
                                        onChange={(e) => updateRow(row.id, { reason: e.target.value })}
                                        placeholder={t('adv.field.reasonShortPh')}
                                    />
                                </div>
                                <div className="bulk-col-actions">
                                    <button
                                        type="button"
                                        className="btn-row-remove"
                                        disabled={rows.length <= 1}
                                        onClick={() => removeRow(row.id)}
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <button type="button" className="btn-add-row" onClick={addRow}>
                    <Plus size={14} /> {t('adv.bulk.addRow')}
                </button>
                <p className="form-help-text" style={{ fontSize: 12, color: '#64748B', marginTop: 12 }}>
                    {t('adv.help.post', { code: controlCode })}
                </p>
            </div>
        </PageShell>
    );
}
