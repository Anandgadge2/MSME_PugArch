/**
 * ParcelTracking - thin wrapper that defers to the role-aware DeliveryListPage.
 * Kept for compatibility with existing routes (`/seller/delivery`,
 * `/buyer/tracking`).
 */

import { useAuth } from '../hooks/useAuth';
import DeliveryListPage from '../features/delivery/pages/DeliveryListPage';

export default function ParcelTracking() {
  const { user } = useAuth();
  const scope = user?.role === 'admin' ? 'admin' : user?.role === 'seller' ? 'seller' : 'buyer';
  return <DeliveryListPage scope={scope} />;
}
