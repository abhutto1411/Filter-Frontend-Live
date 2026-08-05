import React from 'react';
import { useSearchParams } from 'react-router-dom';
import SupplierStorageFacilityBrands from './SupplierStorageFacilityBrands';
import SupplierStorageFacilityBrandHub from './SupplierStorageFacilityBrandHub';

export default function SupplierStorageFacility() {
    const [searchParams] = useSearchParams();
    const brandId = searchParams.get('brand');
    if (brandId) {
        return <SupplierStorageFacilityBrandHub brandId={brandId} />;
    }
    return <SupplierStorageFacilityBrands />;
}
