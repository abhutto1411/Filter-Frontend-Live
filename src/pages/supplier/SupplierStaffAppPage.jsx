import React from 'react';
import StaffAppDevDocs from '../workshop/staff-app/StaffAppDevDocs';

/**
 * Supplier portal mirror — supplier outdoor staff will use the same Flutter app pattern.
 * Full supplier-scoped staff ops APIs can extend this section later.
 */
export default function SupplierStaffAppPage() {
    return (
        <div style={{ padding: 24 }}>
            <h1 style={{ marginTop: 0 }}>Staff App Management</h1>
            <p style={{ color: '#666', maxWidth: 720 }}>
                Manage supplier warehouse / outdoor staff app access from Staff &amp; Roles.
                Workshop-linked staff operations remain in the affiliated workshop&apos;s
                Staff App Management section.
            </p>
            <StaffAppDevDocs />
        </div>
    );
}
