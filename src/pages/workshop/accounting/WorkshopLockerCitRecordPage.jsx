import React, { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { LockerPortalProvider } from '../../locker/LockerPortalContext';
import RecordCollection from '../../locker/RecordCollection';
import {
    buildLockerCan,
    buildLockerCanOpenTab,
} from '../lockerAccess';

/**
 * Accounting → Locker CIT → Record collection (mockup 33).
 * Wraps locker RecordCollection with portal can()/i18n.
 */
export default function WorkshopLockerCitRecordPage({
    locale: localeProp,
    selectedBranchId = 'all',
    branches = null,
    branchLockedId = null,
}) {
    const outletCtx = useOutletContext() || {};
    const locale =
        localeProp ||
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const { user, hasPermission } = useAuth();
    const can = useMemo(() => buildLockerCan(user, hasPermission), [user, hasPermission]);
    const canOpenTab = useMemo(() => buildLockerCanOpenTab(can), [can]);

    return (
        <LockerPortalProvider locale={locale} can={can} canOpenTab={canOpenTab} embedded>
            <RecordCollection
                portalRole="supervisor"
                selectedBranchId={
                    branchLockedId ||
                    selectedBranchId ||
                    outletCtx.selectedBranchId ||
                    'all'
                }
                branches={branches}
                branchLockedId={branchLockedId}
                showBreadcrumb
            />
        </LockerPortalProvider>
    );
}
