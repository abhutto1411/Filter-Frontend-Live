import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { AlertTriangle, ChevronRight, Lock, RotateCcw, Search, Truck } from 'lucide-react';
import { getSupplier, getSuppliers } from '../../services/superAdminApi';
import { useAdminPageMeta } from '../../context/AdminPageMetaContext';
import { useAuth } from '../../context/AuthContext';
import UiPager from '../../components/UiPager';
import { useServerPaging } from '../../hooks/usePagedRows';
import SupplierStorageFacility from '../supplier/storage-facility/SupplierStorageFacility';
import { StorageFacilityPortalProvider } from '../supplier/storage-facility/StorageFacilityPortalContext';
import { sfT } from '../../utils/storageFacilityI18n';
import '../../styles/ui.css';

function useSfLocale() {
    const outletCtx = useOutletContext() || {};
    return (
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en'
    );
}

function normalizeCategory(value) {
    const v = String(value ?? '').trim().toLowerCase();
    if (v === 'warehouse') return 'warehouse';
    if (v === 'other') return 'other';
    return 'supplier';
}

function normalizeSupplierRow(s) {
    return {
        id: String(s.id ?? s._id ?? ''),
        name: s.name ?? '—',
        contactPerson: s.contactPerson ?? s.ownerName ?? '',
        phone: s.mobile ?? s.phone ?? '',
        email: s.email ?? '',
        category: normalizeCategory(s.registrationType ?? s.category),
    };
}

function AdminStorageFacilitySupplierList() {
    const navigate = useNavigate();
    const locale = useSfLocale();
    const t = useCallback((key, vars) => sfT(locale, key, vars), [locale]);
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [q, setQ] = useState('');
    const [qDebounced, setQDebounced] = useState('');
    const [reloadKey, setReloadKey] = useState(0);

    const paging = useServerPaging({ resetKey: qDebounced });
    const { page, pageSize } = paging;

    useEffect(() => {
        const timer = setTimeout(() => setQDebounced(q.trim()), 300);
        return () => clearTimeout(timer);
    }, [q]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            // Search and paging both run server-side. The old list asked for the
            // default page and filtered it in the browser, so only the first 50
            // suppliers were ever reachable from here.
            try {
                const res = await getSuppliers({
                    limit: pageSize,
                    offset: (page - 1) * pageSize,
                    search: qDebounced || undefined,
                });
                if (cancelled) return;
                const data = res?.data || res;
                const list = Array.isArray(data) ? data : (data?.suppliers ?? []);
                setRows(list.map(normalizeSupplierRow));
                setTotal(Number(data?.total ?? list.length) || 0);
                setLoadError(false);
            } catch {
                if (cancelled) return;
                setRows([]);
                setTotal(0);
                setLoadError(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [page, pageSize, qDebounced, reloadKey]);

    const open = (s) => {
        navigate(`/admin/storage-facility/${s.id}`, { state: { supplierName: s.name } });
    };

    return (
        <div className="ui-root ui-root--flush ui-stack">
            <p className="ui-lead">{t('admin.subtitle')}</p>

            <div className="ui-table-wrap">
                <div className="ui-toolbar">
                    <div className="ui-search">
                        <Search size={14} />
                        <input
                            type="text"
                            className="ui-input"
                            placeholder={t('admin.search')}
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                        />
                    </div>
                    <span>
                        {qDebounced ? t('admin.matches', { n: total }) : t('admin.count', { n: total })}
                    </span>
                </div>

                {!loading && loadError ? (
                    <div className="ui-empty">
                        <div className="ui-empty-icon"><AlertTriangle size={18} /></div>
                        <div className="ui-empty-title">{t('admin.errLoad')}</div>
                        <div className="ui-empty-sub">{t('admin.errSub')}</div>
                        <button
                            type="button"
                            className="ui-btn ui-btn--default ui-btn--sm"
                            onClick={() => setReloadKey((k) => k + 1)}
                        >
                            <RotateCcw size={13} /> {t('admin.retry')}
                        </button>
                    </div>
                ) : !loading && rows.length === 0 ? (
                    <div className="ui-empty">
                        <div className="ui-empty-icon">
                            {qDebounced ? <Search size={18} /> : <Truck size={18} />}
                        </div>
                        <div className="ui-empty-title">
                            {qDebounced ? t('admin.noMatchTitle') : t('admin.emptyTitle')}
                        </div>
                        <div className="ui-empty-sub">
                            {qDebounced ? t('admin.noMatchSub') : t('admin.emptySub')}
                        </div>
                    </div>
                ) : (
                    <table className="ui-table ui-table--pick">
                        <thead>
                            <tr>
                                <th>{t('th.supplier')}</th>
                                <th>{t('th.contact')}</th>
                                <th>{t('th.phone')}</th>
                                <th>{t('th.category')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 8 }).map((_, i) => (
                                    <tr key={`sk-${i}`} className="ui-sk-row">
                                        <td><div className="ui-sk ui-sk--strong ui-sk--w70" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                                        <td><div className="ui-sk ui-sk--pill" /></td>
                                    </tr>
                                ))
                            ) : rows.map((s) => (
                                <tr key={s.id} onClick={() => open(s)}>
                                    <td data-label={t('th.supplier')}>
                                        {/* The name carries the action, so a keyboard
                                            reaches every row the pointer can. */}
                                        <button
                                            type="button"
                                            className="ui-link"
                                            onClick={(e) => { e.stopPropagation(); open(s); }}
                                        >
                                            {s.name}
                                            <ChevronRight size={14} className="ui-chev" aria-hidden="true" />
                                        </button>
                                        {s.email ? <div className="ui-meta">{s.email}</div> : null}
                                    </td>
                                    <td data-label={t('th.contact')}>{s.contactPerson || '—'}</td>
                                    <td data-label={t('th.phone')} className="ui-mono ui-nowrap">
                                        {s.phone || '—'}
                                    </td>
                                    <td data-label={t('th.category')}>
                                        <span className={`ui-pill ui-pill--${s.category === 'warehouse' ? 'info' : 'neutral'}`}>
                                            {t(`cat.${s.category}`)}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                <UiPager {...paging.pagerFor(total)} />
            </div>
        </div>
    );
}

function AdminStorageFacilitySupplierView({ supplierId }) {
    const location = useLocation();
    const { setPageTitle } = useAdminPageMeta();
    // The list hands the name over when it navigates; only a pasted URL has to
    // look it up. Reading the handed-over name rather than copying it into state
    // keeps one source of truth when the admin jumps between suppliers.
    const fromNav = location.state?.supplierName ?? '';
    const [fetchedName, setFetchedName] = useState('');
    const supplierName = fromNav || fetchedName;

    useEffect(() => {
        if (fromNav) return undefined;

        let cancelled = false;
        (async () => {
            try {
                const res = await getSupplier(supplierId);
                const payload = res?.data && typeof res.data === 'object' ? res.data : res;
                if (!cancelled) setFetchedName(payload?.name ?? '');
            } catch {
                if (!cancelled) setFetchedName('');
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [supplierId, fromNav]);

    useEffect(() => {
        if (supplierName) setPageTitle(supplierName);
    }, [supplierName, setPageTitle]);

    const routeBase = `/admin/storage-facility/${supplierId}`;

    return (
        <StorageFacilityPortalProvider
            supplierId={supplierId}
            supplierName={supplierName || null}
            routeBase={routeBase}
            parentRoute="/admin/storage-facility"
            isOwner
        >
            <SupplierStorageFacility />
        </StorageFacilityPortalProvider>
    );
}

export default function AdminStorageFacilityPage() {
    const { supplierId } = useParams();
    const { hasPermission } = useAuth();
    const locale = useSfLocale();

    if (!hasPermission('storage-facility.view')) {
        return (
            <div className="ui-root ui-root--flush">
                <div className="ui-empty">
                    <div className="ui-empty-icon"><Lock size={18} /></div>
                    <div className="ui-empty-title">{sfT(locale, 'admin.denied')}</div>
                </div>
            </div>
        );
    }

    if (!supplierId) {
        return <AdminStorageFacilitySupplierList />;
    }

    return <AdminStorageFacilitySupplierView supplierId={supplierId} />;
}
