import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Loader, Plus, RotateCcw, UserCircle } from 'lucide-react';
import { useStorageFacilityApi } from './StorageFacilityPortalContext';
import { useSfT } from './useSfT';
import Modal from '../../../components/Modal';
import RowActionsMenu from '../../../components/RowActionsMenu';
import UiPager from '../../../components/UiPager';
import { usePagedRows } from '../../../hooks/usePagedRows';
import StorageFacilitySalesRepPerformancePanel from './StorageFacilitySalesRepPerformancePanel';
import '../../../styles/ui.css';

const EMPTY_FORM = { name: '', code: '', mobile: '', email: '' };

export default function StorageFacilitySalesRepsTab({ brandId }) {
    const t = useSfT();
    const sfApi = useStorageFacilityApi();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [busy, setBusy] = useState(false);
    const [filterRepId, setFilterRepId] = useState('');
    const [performanceKey, setPerformanceKey] = useState(0);
    const [reloadKey, setReloadKey] = useState(0);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await sfApi.listStorageSalesReps(brandId);
            setRows(res?.salesReps ?? []);
            setLoadError(false);
        } catch {
            setRows([]);
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    }, [brandId, sfApi]);

    useEffect(() => {
        load();
    }, [load, reloadKey]);

    const paging = usePagedRows(rows, { resetKey: brandId });

    const openAdd = () => {
        setEditing(null);
        setForm(EMPTY_FORM);
        setModalOpen(true);
    };

    const openEdit = (row) => {
        setEditing(row);
        setForm({
            name: row.name || '',
            code: row.code || '',
            mobile: row.mobile || '',
            email: row.email || '',
        });
        setModalOpen(true);
    };

    const closeModal = () => {
        if (busy) return;
        setModalOpen(false);
    };

    const save = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        setBusy(true);
        try {
            if (editing) {
                await sfApi.updateStorageSalesRep(brandId, editing.id, form);
            } else {
                await sfApi.createStorageSalesRep(brandId, form);
            }
            setModalOpen(false);
            setReloadKey((k) => k + 1);
            setPerformanceKey((k) => k + 1);
        } catch (ex) {
            window.alert(ex?.message || t('rep.errSave'));
        } finally {
            setBusy(false);
        }
    };

    const remove = async (row) => {
        if (!window.confirm(t('rep.confirmDelete', { name: row.name }))) return;
        try {
            await sfApi.deleteStorageSalesRep(brandId, row.id);
            if (filterRepId === row.id) setFilterRepId('');
            setReloadKey((k) => k + 1);
            setPerformanceKey((k) => k + 1);
        } catch (ex) {
            window.alert(ex?.message || t('rep.errDelete'));
        }
    };

    const viewPerformance = (repId) => {
        setFilterRepId(repId);
        setPerformanceKey((k) => k + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const setField = (field) => (e) => {
        const { value } = e.target;
        setForm((f) => ({ ...f, [field]: value }));
    };

    return (
        <div className="ui-root ui-root--flush ui-stack">
            <StorageFacilitySalesRepPerformancePanel
                key={`${performanceKey}-${filterRepId}`}
                brandId={brandId}
                initialSalesRepId={filterRepId}
                onSalesRepIdChange={setFilterRepId}
            />

            <div className="ui-table-wrap">
                <div className="ui-toolbar">
                    <UserCircle size={14} className="ui-glyph" />
                    <span className="ui-panel-title">{t('rep.manage')}</span>
                    <span className="ui-meta">{t('rep.count', { n: rows.length })}</span>
                    <div className="ui-toolbar-end">
                        <button
                            type="button"
                            className="ui-btn ui-btn--primary ui-btn--sm"
                            onClick={openAdd}
                        >
                            <Plus size={14} /> {t('rep.add')}
                        </button>
                    </div>
                </div>

                {!loading && loadError ? (
                    <div className="ui-empty">
                        <div className="ui-empty-icon"><AlertTriangle size={18} /></div>
                        <div className="ui-empty-title">{t('rep.errLoad')}</div>
                        <div className="ui-empty-sub">{t('rep.errSub')}</div>
                        <button
                            type="button"
                            className="ui-btn ui-btn--default ui-btn--sm"
                            onClick={() => setReloadKey((k) => k + 1)}
                        >
                            <RotateCcw size={13} /> {t('rep.retry')}
                        </button>
                    </div>
                ) : !loading && rows.length === 0 ? (
                    <div className="ui-empty">
                        <div className="ui-empty-icon"><UserCircle size={18} /></div>
                        <div className="ui-empty-title">{t('rep.emptyTitle')}</div>
                        <div className="ui-empty-sub">{t('rep.emptySub')}</div>
                    </div>
                ) : (
                    <table className="ui-table">
                        <thead>
                            <tr>
                                <th>{t('rep.th.name')}</th>
                                <th>{t('rep.th.code')}</th>
                                <th>{t('rep.th.mobile')}</th>
                                <th>{t('rep.th.email')}</th>
                                <th aria-label={t('rep.th.actions')} />
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <tr key={`sk-${i}`} className="ui-sk-row">
                                        <td><div className="ui-sk ui-sk--strong ui-sk--w70" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w25" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w70" /></td>
                                        <td><div className="ui-sk ui-sk--btn ui-sk--w25" /></td>
                                    </tr>
                                ))
                            ) : paging.pagedRows.map((r) => (
                                <tr key={r.id} aria-selected={String(r.id) === String(filterRepId)}>
                                    <td data-label={t('rep.th.name')}>
                                        <span className="ui-strong">{r.name}</span>
                                    </td>
                                    <td data-label={t('rep.th.code')} className="ui-mono">
                                        {r.code || '—'}
                                    </td>
                                    <td data-label={t('rep.th.mobile')} className="ui-mono ui-nowrap">
                                        {r.mobile || '—'}
                                    </td>
                                    <td data-label={t('rep.th.email')}>{r.email || '—'}</td>
                                    <td>
                                        <div className="ui-rowacts">
                                            <RowActionsMenu
                                                ariaLabel={t('rep.act.menu', { name: r.name })}
                                                items={[
                                                    {
                                                        label: t('rep.act.performance'),
                                                        onClick: () => viewPerformance(r.id),
                                                    },
                                                    {
                                                        label: t('rep.act.edit'),
                                                        onClick: () => openEdit(r),
                                                    },
                                                    {
                                                        label: t('rep.act.delete'),
                                                        onClick: () => remove(r),
                                                        danger: true,
                                                    },
                                                ]}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                <UiPager {...paging.pagerProps} />
            </div>

            {modalOpen ? (
                <Modal
                    title={editing ? t('rep.modal.edit') : t('rep.modal.add')}
                    width="520px"
                    // Portalled to <body>, outside this page's `.ui-root`, so
                    // the modal has to carry the design tokens itself.
                    contentClassName="ui-tokens"
                    disableClose={busy}
                    onClose={closeModal}
                >
                    <form onSubmit={save}>
                        <div className="ui-form-grid">
                            <div className="ui-field ui-col-8">
                                <label htmlFor="sf-rep-name">{t('rep.label.name')}</label>
                                <input
                                    id="sf-rep-name"
                                    type="text"
                                    className="ui-input"
                                    value={form.name}
                                    onChange={setField('name')}
                                    required
                                />
                            </div>
                            <div className="ui-field ui-col-4">
                                <label htmlFor="sf-rep-code">
                                    {t('rep.label.code')}{' '}
                                    <span className="ui-field-opt">{t('rep.optional')}</span>
                                </label>
                                <input
                                    id="sf-rep-code"
                                    type="text"
                                    className="ui-input"
                                    value={form.code}
                                    onChange={setField('code')}
                                />
                            </div>
                            <div className="ui-field ui-col-6">
                                <label htmlFor="sf-rep-mobile">
                                    {t('rep.label.mobile')}{' '}
                                    <span className="ui-field-opt">{t('rep.optional')}</span>
                                </label>
                                <input
                                    id="sf-rep-mobile"
                                    type="text"
                                    className="ui-input"
                                    value={form.mobile}
                                    onChange={setField('mobile')}
                                />
                            </div>
                            <div className="ui-field ui-col-6">
                                <label htmlFor="sf-rep-email">
                                    {t('rep.label.email')}{' '}
                                    <span className="ui-field-opt">{t('rep.optional')}</span>
                                </label>
                                <input
                                    id="sf-rep-email"
                                    type="email"
                                    className="ui-input"
                                    autoComplete="off"
                                    value={form.email}
                                    onChange={setField('email')}
                                />
                            </div>
                        </div>

                        <div className="ui-form-foot">
                            <button
                                type="button"
                                className="ui-btn ui-btn--default"
                                disabled={busy}
                                onClick={closeModal}
                            >
                                {t('rep.btn.cancel')}
                            </button>
                            <button type="submit" className="ui-btn ui-btn--primary" disabled={busy}>
                                {busy ? (
                                    <><Loader size={14} className="ui-spin" /> {t('rep.btn.saving')}</>
                                ) : t('rep.btn.save')}
                            </button>
                        </div>
                    </form>
                </Modal>
            ) : null}
        </div>
    );
}
