import React from 'react';
import { Car } from 'lucide-react';
import '../../styles/admin/FleetManagementPage.css';

export default function FleetManagementPage() {
    return (
        <div className="fleet-management-page placeholder-page">
            <div className="placeholder-icon"><Car size={48} /></div>
            <h2 className="placeholder-title">Fleet Management</h2>
            <p className="placeholder-desc">
                This module is currently being populated with data from the legacy system. Powering up precision for your automotive network.
            </p>
        </div>
    );
}
