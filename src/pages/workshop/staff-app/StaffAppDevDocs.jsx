import React from 'react';

/**
 * Lightweight developer reference for the staff Flutter app integration.
 * Full DevDocs can be expanded here as the API stabilizes.
 */
export default function StaffAppDevDocs() {
    return (
        <div className="staff-app-table-wrap" style={{ padding: 20, fontSize: '0.875rem', lineHeight: 1.6 }}>
            <h2 style={{ marginTop: 0 }}>Staff App — Developer Docs</h2>
            <p>
                Outdoor staff use the Flutter app; all management happens in this web section.
                APIs are served from the FILTER POS NestJS backend (not a separate /api stack).
            </p>
            <h3>Auth</h3>
            <ul>
                <li><code>POST /auth/workshop/login</code> — workshop staff JWT</li>
                <li><code>POST /employee-expense/expense</code> — submit expense</li>
                <li><code>GET /employee-expense/my-petty-cash</code> — wallet balance</li>
            </ul>
            <h3>Staff operations</h3>
            <ul>
                <li><code>GET/POST /staff-app/demands</code> — requests / demands</li>
                <li><code>GET/POST /staff-app/leave-requests</code> — leave</li>
                <li><code>GET/POST /staff-app/salary-advances</code> — advances</li>
                <li><code>GET/POST /staff-app/tasks</code> — tasks</li>
                <li><code>GET/POST /staff-app/chat/*</code> — channels &amp; messages</li>
                <li><code>GET /staff-app/overview</code> — dashboard counts (web)</li>
            </ul>
            <h3>Approval flow</h3>
            <p>
                Expenses: submit → pending → <code>POST /employee-expense/:id/approve</code> (GL + wallet in one step).
                Demands and leave use multi-step status updates via staff-app PATCH endpoints.
            </p>
            <h3>Currency</h3>
            <p>All monetary fields are SAR (﷼).</p>
        </div>
    );
}
