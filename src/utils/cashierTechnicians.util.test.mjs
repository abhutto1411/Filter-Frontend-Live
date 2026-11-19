import {
    normalizeCashierTechniciansList,
    parseTechnicianStatus,
    unwrapCashierTechniciansResponse,
} from './cashierTechnicians.util.js';

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

const apiPayload = {
    success: true,
    technicians: [
        {
            id: '55',
            name: 'Test Tech',
            onlineStatus: 'online',
            assignmentStatus: 'active',
            slots: { used: 1, total: 3 },
            commissionPercent: 12,
            departments: [{ id: '9', name: 'Oil Change' }],
        },
    ],
};

const rows = normalizeCashierTechniciansList(unwrapCashierTechniciansResponse(apiPayload));
assert(rows.length === 1, 'expected one technician');
assert(rows[0].name === 'Test Tech', 'name mapped');
assert(rows[0].status === 'online', 'status mapped from onlineStatus');
assert(rows[0].usedSlots === 1, 'slots used mapped');
assert(rows[0].totalSlots === 3, 'slots total mapped');
assert(rows[0].departmentName === 'Oil Change', 'department mapped');
assert(parseTechnicianStatus({ status: 'offline' }) === 'offline', 'offline status');
assert(parseTechnicianStatus({ onlineStatus: 'online' }) === 'online', 'online status');
assert(unwrapCashierTechniciansResponse({ data: [{ id: '1' }] }).length === 1, 'data unwrap');
assert(unwrapCashierTechniciansResponse({ success: false }).length === 0, 'bad payload → empty array');

console.log('cashierTechnicians.util tests passed');
