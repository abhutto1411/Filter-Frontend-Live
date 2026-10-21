import React from 'react';
import StorageFacilitySalesRepPerformancePanel from './StorageFacilitySalesRepPerformancePanel';

/** Same analytics as Sales reps tab — kept for direct "Sales" navigation. */
export default function StorageFacilitySalesTab({ brandId }) {
    return <StorageFacilitySalesRepPerformancePanel brandId={brandId} />;
}
