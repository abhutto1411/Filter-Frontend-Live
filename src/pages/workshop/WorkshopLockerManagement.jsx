import React, { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ExternalLink, MapPin, ShieldCheck, Crown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { wlockT } from '../../utils/workshopLockerI18n';
import { lockerT } from '../../utils/lockerPortalI18n';
import { LockerPortalProvider } from '../locker/LockerPortalContext';
import LockerDashboard from '../locker/LockerDashboard';
import PendingRequests from '../locker/PendingRequests';
import RecordCollection from '../locker/RecordCollection';
import ApprovalsScreen from '../locker/ApprovalsScreen';
import DepositToBank from '../locker/DepositToBank';
import IssuePettyCash from '../locker/IssuePettyCash';
import PettyCashIssueLog from '../locker/PettyCashIssueLog';
import LockerExpenses from '../locker/LockerExpenses';
import VaultVouchers from '../locker/VaultVouchers';
import TransactionLog from '../locker/TransactionLog';
import CollectionsHistory from '../locker/CollectionsHistory';
import DifferencesReport from '../locker/DifferencesReport';
import LockerAdminDashboard from './LockerAdminDashboard';
import LockerTeamTab from './LockerTeamTab';
import {
    LOCKER_WORKSPACE_TABS,
    buildLockerCan,
    buildLockerCanOpenTab,
    isWorkshopOwner,
} from './lockerAccess';
import './Workshop.css';

/**
 * Workshop Admin → Locker Management: a KPI / notification / chart dashboard,
 * every locker supervisor tab operated in place, and the locker team. The owner
 * can do everything; other staff are gated by the granular
 * `workshop.locker-management.*` codes (enforced again by the API).
 */
export default function WorkshopLockerManagement({
    locale: localeProp,
    selectedBranchId = 'all',
    branches = null,
    branchLockedId = null,
    allowAllBranches = true,
}) {
    const locale = localeProp || (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) || 'en';
    const isRtl = locale === 'ar';
    const t = useCallback((key, vars) => wlockT(locale, key, vars), [locale]);
    const tabLabel = useCallback(
        (id) => {
            const own = wlockT(locale, `tab.${id}`);
            return own === `tab.${id}` ? lockerT(locale, `nav.${id}`) : own;
        },
        [locale],
    );
    const { user, hasPermission } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();

    const isOwner = isWorkshopOwner(user);
    const can = useMemo(() => buildLockerCan(user, hasPermission), [user, hasPermission]);
    const canOpenTab = useMemo(() => buildLockerCanOpenTab(can), [can]);
    const visibleTabs = useMemo(
        () => LOCKER_WORKSPACE_TABS.filter((tab) => canOpenTab(tab.id)),
        [canOpenTab],
    );

    const requestedTab = searchParams.get('tab') || 'overview';
    const activeTab = visibleTabs.some((tab) => tab.id === requestedTab) ? requestedTab : 'overview';

    const openTab = useCallback(
        (target) => {
            const [id, query = ''] = String(target || 'overview').split('?');
            const next = new URLSearchParams(query);
            if (id && id !== 'overview') next.set('tab', id);
            setSearchParams(next);
        },
        [setSearchParams],
    );

    const branchName = useMemo(() => {
        const scoped = branchLockedId || (selectedBranchId !== 'all' ? selectedBranchId : null);
        if (!scoped) return t('shell.branchAll');
        const b =
            (branches || []).find((x) => String(x.id) === String(scoped)) ||
            (user?.role?.branches || []).find((x) => String(x.id) === String(scoped));
        if (b?.name) return b.name;
        if (branchLockedId && user?.branchName) return user.branchName;
        return `#${scoped}`;
    }, [branchLockedId, selectedBranchId, branches, user?.role?.branches, user?.branchName, t]);

    const branchProps = {
        selectedBranchId: branchLockedId || selectedBranchId || 'all',
        branches: Array.isArray(branches) && branches.length ? branches : null,
        branchLockedId: branchLockedId || null,
    };

    const renderTab = () => {
        switch (activeTab) {
            case 'dashboard':
                return <LockerDashboard onTabChange={openTab} portalRole="supervisor" {...branchProps} />;
            case 'pending':
                return <PendingRequests onTabChange={openTab} {...branchProps} />;
            case 'record':
                return <RecordCollection portalRole="supervisor" {...branchProps} />;
            case 'approvals':
                return <ApprovalsScreen {...branchProps} />;
            case 'deposit_to_bank':
                return <DepositToBank />;
            case 'issue_petty_cash':
                return <IssuePettyCash {...branchProps} />;
            case 'petty_cash_issue_log':
                return <PettyCashIssueLog {...branchProps} />;
            case 'expenses':
                return <LockerExpenses {...branchProps} />;
            case 'vault_vouchers':
                return <VaultVouchers {...branchProps} />;
            case 'transaction_log':
                return <TransactionLog {...branchProps} allowHq={allowAllBranches} />;
            case 'history':
                return <CollectionsHistory {...branchProps} />;
            case 'differences':
                return <DifferencesReport {...branchProps} />;
            case 'team':
                return <LockerTeamTab locale={locale} t={t} />;
            default:
                return (
                    <LockerAdminDashboard
                        locale={locale}
                        t={t}
                        branchId={branchProps.selectedBranchId}
                        onOpenTab={openTab}
                        canOpenTab={canOpenTab}
                    />
                );
        }
    };

    return (
        <div className="wlk-workspace" dir={isRtl ? 'rtl' : 'ltr'}>
            <header className="wlk-shell-header">
                <div className="wlk-shell-header__text">
                    <h2 className="wlk-title">{t('page.title')}</h2>
                    <p className="wlk-subtitle">{t('shell.subtitle')}</p>
                    <div className="wlk-chips">
                        <span className="wlk-chip">
                            <MapPin size={13} />
                            {t('shell.branchLabel')}: <strong>{branchName}</strong>
                        </span>
                        <span className={`wlk-chip ${isOwner ? 'wlk-chip--gold' : 'wlk-chip--blue'}`}>
                            {isOwner ? <Crown size={13} /> : <ShieldCheck size={13} />}
                            {isOwner ? t('shell.roleOwner') : t('shell.roleStaff')}
                        </span>
                    </div>
                </div>
                <a
                    href="/locker"
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary wlk-icon-btn"
                >
                    <ExternalLink size={16} /> {t('shell.portalLink')}
                </a>
            </header>

            <nav className="wlk-tabs" role="tablist" aria-label={t('shell.tabsAria')}>
                {visibleTabs.map((tab) => {
                    const Icon = tab.icon;
                    const active = tab.id === activeTab;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            className={`wlk-tab${active ? ' wlk-tab--active' : ''}`}
                            onClick={() => openTab(tab.id)}
                        >
                            <Icon size={15} />
                            <span>{tabLabel(tab.id)}</span>
                        </button>
                    );
                })}
            </nav>

            <LockerPortalProvider locale={locale} can={can} canOpenTab={canOpenTab} embedded>
                <div className="wlk-workspace-body" key={activeTab}>
                    {renderTab()}
                </div>
            </LockerPortalProvider>
        </div>
    );
}
