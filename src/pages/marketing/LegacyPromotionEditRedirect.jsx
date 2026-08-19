import { Navigate, useLocation, useParams } from 'react-router-dom';
import { marketingPortalBase } from './marketingRouteUtils';

export default function LegacyPromotionEditRedirect() {
  const { id } = useParams();
  const { pathname } = useLocation();
  const base = marketingPortalBase(pathname);
  return <Navigate to={`${base}/marketing-promotions/${id}/edit`} replace />;
}
