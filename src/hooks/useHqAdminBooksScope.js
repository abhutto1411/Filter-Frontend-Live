import { useLocation } from 'react-router-dom';
import { useAccountingWorkshopScope } from '../context/AccountingWorkshopScopeContext';
import { isAccountingHqBooksMode } from '../utils/accountingWorkshopScope';

/** True when Super Admin is on Accounting → HQ (My Books) under /admin/accounting. */
export function useHqAdminBooksScope() {
    const { hqBooks } = useAccountingWorkshopScope();
    const location = useLocation();
    const onAdminAccounting = location.pathname.startsWith('/admin/accounting');
    const hqMode = onAdminAccounting && (hqBooks || isAccountingHqBooksMode());
    return { hqBooks: hqMode, isAdminHqBooks: hqMode };
}
