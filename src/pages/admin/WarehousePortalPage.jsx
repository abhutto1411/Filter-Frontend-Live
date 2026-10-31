import React from 'react';
import { Warehouse } from 'lucide-react';
import '../../styles/admin/WarehousePortalPage.css';

export default function WarehousePortalPage() {
    return (
        <div className="warehouse-portal-page placeholder-page">
            <div className="placeholder-icon"><Warehouse size={48} /></div>
            <h2 className="placeholder-title">Warehouse Portal</h2>
            <p className="placeholder-desc">
                This module is currently being populated with data from the legacy system. Powering up precision for your automotive network.
            </p>
        </div>
    );
}
