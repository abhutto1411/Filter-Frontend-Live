import React, { useEffect } from 'react';
import { X, Mail, Phone, Building2, Truck, Users, Briefcase, User } from 'lucide-react';

const CATEGORY_META = {
    supplier: { label: 'Supplier', icon: Truck, accent: '#B45309', soft: '#FFF7ED' },
    workshop: { label: 'Workshop', icon: Building2, accent: '#23262D', soft: '#F3F4F6' },
    corporate: { label: 'Corporate', icon: Briefcase, accent: '#1D4ED8', soft: '#EFF6FF' },
    platform: { label: 'Platform', icon: Users, accent: '#6B7280', soft: '#F9FAFB' },
};

function getInitials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    return String(name || '?').slice(0, 2).toUpperCase();
}

function DrawerAvatar({ name, category, isGroup = false, size = 'lg' }) {
    const meta = CATEGORY_META[category] || CATEGORY_META.platform;
    const dim = size === 'lg' ? 96 : 48;
    return (
        <div
            className={`pc-drawer-avatar${isGroup ? ' pc-drawer-avatar--group' : ''}`}
            style={
                isGroup
                    ? { width: dim, height: dim }
                    : { width: dim, height: dim, background: meta.accent }
            }
        >
            {isGroup ? <Users size={40} /> : getInitials(name)}
        </div>
    );
}

function InfoCard({ icon: Icon, label, value, href }) {
    if (!value) return null;
    const inner = (
        <>
            <span className="pc-drawer-card__icon">
                <Icon size={18} />
            </span>
            <div className="pc-drawer-card__text">
                <span className="pc-drawer-card__label">{label}</span>
                <span className="pc-drawer-card__value">{value}</span>
            </div>
        </>
    );
    if (href) {
        return (
            <a className="pc-drawer-card" href={href}>
                {inner}
            </a>
        );
    }
    return <div className="pc-drawer-card">{inner}</div>;
}

function MemberRow({ person }) {
    const meta = CATEGORY_META[person.category] || CATEGORY_META.platform;
    const Icon = meta.icon;
    return (
        <div className="pc-drawer-member">
            <DrawerAvatar name={person.name} category={person.category} size="sm" />
            <div className="pc-drawer-member__body">
                <div className="pc-drawer-member__name">{person.name}</div>
                <div className="pc-drawer-member__sub">
                    {person.role}
                    {person.entityName ? ` · ${person.entityName}` : ''}
                </div>
                {(person.email || person.mobile) && (
                    <div className="pc-drawer-member__contact">
                        {[person.email, person.mobile].filter(Boolean).join(' · ')}
                    </div>
                )}
            </div>
            <span className="pc-drawer-member__badge" style={{ color: meta.accent, background: meta.soft }}>
                <Icon size={12} />
                {meta.label}
            </span>
        </div>
    );
}

export default function PlatformChatContactProfile({ conversation, onClose }) {
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') onClose?.();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    if (!conversation) return null;

    const isGroup = conversation.type === 'group';
    const others =
        conversation.participants?.filter((p) => !p.isSelf) ??
        conversation.otherParticipants ??
        [];
    const direct = others[0];
    const meta = direct
        ? CATEGORY_META[direct.category] || CATEGORY_META.platform
        : CATEGORY_META.platform;

    return (
        <div className="pc-drawer-root" role="presentation">
            <button
                type="button"
                className="pc-drawer-backdrop"
                onClick={onClose}
                aria-label="Close contact info"
            />
            <aside className="pc-drawer" role="dialog" aria-label="Contact information">
                <div className="pc-drawer__hero">
                    <button
                        type="button"
                        className="pc-drawer__close"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        <X size={22} />
                    </button>
                    <DrawerAvatar
                        name={isGroup ? conversation.title : direct?.name}
                        category={direct?.category || 'platform'}
                        isGroup={isGroup}
                    />
                    <h2 className="pc-drawer__name">
                        {isGroup ? conversation.title : direct?.name || conversation.title}
                    </h2>
                    {!isGroup && direct && (
                        <span
                            className="pc-drawer__pill"
                            style={{ color: meta.accent, background: meta.soft }}
                        >
                            <meta.icon size={14} />
                            {direct.role}
                        </span>
                    )}
                    {isGroup && (
                        <p className="pc-drawer__meta">
                            Group · {conversation.participants?.length ?? 0} members
                        </p>
                    )}
                    {!isGroup && direct?.entityName && (
                        <p className="pc-drawer__meta">{direct.entityName}</p>
                    )}
                </div>

                <div className="pc-drawer__scroll">
                    {isGroup ? (
                        <section className="pc-drawer__section">
                            <h3>Members</h3>
                            <div className="pc-drawer-members">
                                {conversation.participants
                                    ?.filter((p) => !p.isSelf)
                                    .map((p) => (
                                        <MemberRow key={p.userId} person={p} />
                                    ))}
                            </div>
                        </section>
                    ) : direct ? (
                        <>
                            <section className="pc-drawer__section">
                                <h3>About</h3>
                                <InfoCard icon={meta.icon} label={meta.label} value={direct.entityName} />
                                {direct.branchName && (
                                    <InfoCard icon={Building2} label="Branch" value={direct.branchName} />
                                )}
                                <InfoCard icon={User} label="Portal role" value={direct.role} />
                            </section>
                            <section className="pc-drawer__section">
                                <h3>Contact</h3>
                                <InfoCard
                                    icon={Mail}
                                    label="Email"
                                    value={direct.email}
                                    href={direct.email ? `mailto:${direct.email}` : undefined}
                                />
                                <InfoCard
                                    icon={Phone}
                                    label="Mobile"
                                    value={direct.mobile}
                                    href={direct.mobile ? `tel:${direct.mobile}` : undefined}
                                />
                            </section>
                        </>
                    ) : (
                        <p className="pc-drawer-empty">No contact details available.</p>
                    )}
                </div>
            </aside>
        </div>
    );
}
