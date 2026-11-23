import { useOutletContext } from 'react-router-dom';
import SalesReports from '../admin/SalesReports';
import '../../styles/ui.css';

/** Thin marketing portal wrapper — SalesReports handles EN/AR chrome via outlet/portal locale. */
export default function MarketingSalesReports() {
  const outletCtx = useOutletContext() || {};
  const locale =
    outletCtx.locale ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('marketing-locale') : null) ||
    'en';

  return (
    // `ui-root--flush` because the layout's <main> already supplies the canvas
    // and its padding. `mk-page` added a second 21/26px on top of that 40px,
    // so this screen sat further in than the same screen does in admin.
    <div className="ui-root ui-root--flush" dir={locale === 'ar' ? 'rtl' : undefined}>
      <SalesReports portal="marketing" />
    </div>
  );
}
