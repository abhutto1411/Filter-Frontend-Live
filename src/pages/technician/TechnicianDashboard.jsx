import React from 'react';
import TechnicianHome from './TechnicianHome';
import TechnicianOverview from './TechnicianOverview';
import TechnicianActiveOrders from './TechnicianActiveOrders';
import TechnicianCommission from './TechnicianCommission';
import TechnicianProfile from './TechnicianProfile';
import './TechnicianDashboard.css';

export default function TechnicianDashboard({
    activeSection = 'home',
    workshopDuty, setWorkshopDuty, onCallAvailable, setOnCallAvailable,
    showToast,
    onAssignedOrdersListChanged,
}) {
    return (
        <div>
            {activeSection === 'home' && (
                <TechnicianHome
                    workshopDuty={workshopDuty}
                    setWorkshopDuty={setWorkshopDuty}
                    onCallAvailable={onCallAvailable}
                    setOnCallAvailable={setOnCallAvailable}
                    showToast={showToast}
                />
            )}

            {activeSection === 'overview' && <TechnicianOverview />}

            {activeSection === 'active' && (
                <TechnicianActiveOrders onListChanged={onAssignedOrdersListChanged} />
            )}

            {activeSection === 'commission' && <TechnicianCommission />}

            {activeSection === 'profile' && <TechnicianProfile />}
        </div>
    );
}
