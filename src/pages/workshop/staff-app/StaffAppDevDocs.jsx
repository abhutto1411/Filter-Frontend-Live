import React from 'react';
import { useStaffAppI18n } from '../../../utils/staffAppI18n';

/**
 * Lightweight developer reference for the staff Flutter app integration.
 * Full DevDocs can be expanded here as the API stabilizes.
 */
export default function StaffAppDevDocs() {
    const { t } = useStaffAppI18n();
    return (
        <div className="staff-app-table-wrap" style={{ padding: 20, fontSize: '0.875rem', lineHeight: 1.6 }}>
            <h2 style={{ marginTop: 0 }}>{t('dev.title')}</h2>
            <p>{t('dev.intro')}</p>
            <h3>{t('dev.auth')}</h3>
            <ul>
                <li><code>POST /auth/workshop/login</code> — {t('dev.auth.login')}</li>
                <li><code>POST /employee-expense/expense</code> — {t('dev.auth.expense')}</li>
                <li><code>GET /employee-expense/my-petty-cash</code> — {t('dev.auth.wallet')}</li>
            </ul>
            <h3>{t('dev.ops')}</h3>
            <ul>
                <li><code>GET/POST /staff-app/demands</code> — {t('dev.ops.demands')}</li>
                <li><code>GET/POST /staff-app/leave-requests</code> — {t('dev.ops.leave')}</li>
                <li><code>GET/POST /staff-app/salary-advances</code> — {t('dev.ops.advances')}</li>
                <li><code>GET/POST /staff-app/tasks</code> — {t('dev.ops.tasks')}</li>
                <li><code>GET/POST /staff-app/chat/*</code> — {t('dev.ops.chat')}</li>
                <li><code>GET /staff-app/overview</code> — {t('dev.ops.overview')}</li>
            </ul>
            <h3>{t('dev.approval')}</h3>
            <p>{t('dev.approvalBody')}</p>
            <h3>{t('dev.currency')}</h3>
            <p>{t('dev.currencyBody')}</p>
        </div>
    );
}
