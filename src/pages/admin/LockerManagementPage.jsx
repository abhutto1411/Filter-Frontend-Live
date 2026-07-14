import React from 'react';
import { Box } from 'lucide-react';
import '../../styles/admin/LockerManagementPage.css';

export default function LockerManagementPage() {
    return (
        <div className="locker-management-page placeholder-page">
            <div className="placeholder-icon"><Box size={48} /></div>
            <h2 className="placeholder-title">Locker Management</h2>
            <p className="placeholder-desc">
                This module is currently being populated with data from the legacy system. Powering up precision for your automotive network.
            </p>
        </div>
    );
}
