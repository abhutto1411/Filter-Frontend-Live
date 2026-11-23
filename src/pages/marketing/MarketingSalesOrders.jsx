import { useOutletContext } from 'react-router-dom';
import SalesOrders from '../admin/SalesOrders';
import '../../styles/ui.css';

/** Thin marketing portal wrapper — SalesOrders handles EN/AR chrome via outlet/portal locale. */
export default function MarketingSalesOrders() {
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
      <SalesOrders portal="marketing" />
    </div>
  );
}
