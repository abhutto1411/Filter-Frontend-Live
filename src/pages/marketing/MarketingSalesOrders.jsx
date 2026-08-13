import { useOutletContext } from 'react-router-dom';
import SalesOrders from '../admin/SalesOrders';

/** Thin marketing portal wrapper — SalesOrders handles EN/AR chrome via outlet/portal locale. */
export default function MarketingSalesOrders() {
  const outletCtx = useOutletContext() || {};
  const locale =
    outletCtx.locale ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('marketing-locale') : null) ||
    'en';

  return (
    <div className="mk-page" dir={locale === 'ar' ? 'rtl' : undefined}>
      <SalesOrders portal="marketing" />
    </div>
  );
}
