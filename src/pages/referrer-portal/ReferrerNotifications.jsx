import React, { useEffect, useMemo, useState } from 'react';
import { Bell, CreditCard, DollarSign, UserPlus, Inbox } from 'lucide-react';
import { rfT } from '../../utils/referrerPortalI18n';
import { useReferrerPortal } from './useReferrerPortal';
import { referrerPortalGetNotifications, referrerPortalMarkNotificationsRead } from '../../services/referrerPortalApi';

const ICONS = {
    commission: DollarSign,
    conversion: UserPlus,
    payout: CreditCard,
    payoutPending: CreditCard,
    payoutRejected: CreditCard,
    lead: UserPlus,
};

function typeClass(type) {
    if (type === 'commission') return 'is-gold';
    if (type === 'conversion') return 'is-green';
    if (type === 'payout') return 'is-green';
    if (type === 'payoutPending') return 'is-amber';
    if (type === 'payoutRejected') return 'is-red';
    return 'is-slate';
}

function dayLabel(locale, date) {
    const d = new Date(date);
    const today = new Date();
    const yday = new Date();
    yday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return rfT(locale, 'notif.today');
    if (d.toDateString() === yday.toDateString()) return rfT(locale, 'notif.yesterday');
    return d.toLocaleDateString(locale === 'ar' ? 'ar-SA' : undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
    });
}

export default function ReferrerNotifications() {
    const { locale, reloadOverview, isCommunity } = useReferrerPortal();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [marking, setMarking] = useState(false);

    const load = () => {
        setLoading(true);
        return referrerPortalGetNotifications()
            .then((res) => setItems(Array.isArray(res?.notifications) ? res.notifications : []))
            .catch(() => setItems([]))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        load();
    }, []);

    const unreadCount = items.filter((n) => n.unread).length;

    const markRead = async () => {
        setMarking(true);
        try {
            await referrerPortalMarkNotificationsRead();
            await load();
            await reloadOverview?.();
        } finally {
            setMarking(false);
        }
    };

    const groups = useMemo(() => {
        const map = new Map();
        for (const item of items) {
            const key = dayLabel(locale, item.createdAt);
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(item);
        }
        return [...map.entries()];
    }, [items, locale]);

    return (
        <div className="rf-page">
            <div className="rf-notif-head">
                <div>
                    <p className="rf-page-lead" style={{ margin: 0 }}>{rfT(locale, isCommunity ? 'notif.subtitleCommunity' : 'notif.subtitle')}</p>
                </div>
                <div className="rf-actions-bar">
                    {unreadCount > 0 ? (
                        <button type="button" className="rf-btn-outline" onClick={markRead} disabled={marking}>
                            {marking ? rfT(locale, 'list.loading') : rfT(locale, 'notif.markRead')}
                        </button>
                    ) : null}
                    <div className="rf-notif-count">
                        <Bell size={16} />
                        {unreadCount || items.length}
                    </div>
                </div>
            </div>

            {loading ? <div className="rf-card rf-empty">{rfT(locale, 'list.loading')}</div> : null}

            {!loading && items.length === 0 ? (
                <div className="rf-card rf-empty rf-notif-empty">
                    <Inbox size={36} />
                    <h3>{rfT(locale, 'notif.empty')}</h3>
                    <p>{rfT(locale, 'notif.emptyHint')}</p>
                </div>
            ) : null}

            {groups.map(([day, rows]) => (
                <section key={day} className="rf-notif-group">
                    <h4 className="rf-notif-day">{day}</h4>
                    <div className="rf-notif-list">
                        {rows.map((notif) => {
                            const Icon = ICONS[notif.type] || Bell;
                            return (
                                <article key={notif.id} className={`rf-card rf-notif-row ${typeClass(notif.type)} ${notif.unread ? 'is-unread' : ''}`}>
                                    <div className={`rf-notif-icon ${typeClass(notif.type)}`}>
                                        <Icon size={18} />
                                    </div>
                                    <div className="rf-notif-body">
                                        <div className="rf-notif-top">
                                            <h4 className="rf-notif-title">{rfT(locale, notif.titleKey)}</h4>
                                            <time className="rf-notif-time">
                                                {notif.createdAt
                                                    ? new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                    : ''}
                                            </time>
                                        </div>
                                        <p className="rf-notif-text">{rfT(locale, notif.textKey, notif.vars)}</p>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </section>
            ))}
        </div>
    );
}
