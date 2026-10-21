import React, { useMemo } from 'react';
import WsTablePagination from '../../components/workshop/WsTablePagination';
import { useLockerPortal } from './useLockerPortal';

/** Centered pager under locker tables; renders nothing for an empty list. */
export default function LockerTablePager(pagerProps) {
    const { t } = useLockerPortal();
    const labels = useMemo(
        () => ({
            prev: t('pager.prev'),
            next: t('pager.next'),
            rowsPerPage: t('pager.rowsPerPage'),
            showing: (from, to, total) => t('pager.showing', { from, to, total }),
            page: (n) => t('pager.page', { page: n }),
        }),
        [t],
    );
    if (!pagerProps.total) return null;
    return <WsTablePagination {...pagerProps} labels={labels} />;
}
