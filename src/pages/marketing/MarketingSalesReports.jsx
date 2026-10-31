import { useOutletContext } from 'react-router-dom';
import SalesReports from '../admin/SalesReports';

/** Thin marketing portal wrapper — SalesReports handles EN/AR chrome via outlet/portal locale. */
export default function MarketingSalesReports() {
  const outletCtx = useOutletContext() || {};
  const locale =
    outletCtx.locale ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('marketing-locale') : null) ||
    'en';

  return (
    <div className="mk-page" dir={locale === 'ar' ? 'rtl' : undefined}>
      <SalesReports portal="marketing" />
    </div>
  );
}
