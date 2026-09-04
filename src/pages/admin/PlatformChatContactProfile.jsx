import React, { useEffect } from 'react';
import { Mail, Phone, Building2, Truck, Users, Briefcase, User } from 'lucide-react';
import AdminScreenShell from '../../components/admin/AdminScreenShell';
import { pcT } from '../../utils/platformChatI18n';

const CATEGORY_ICONS = {
    supplier: Truck,
    workshop: Building2,
    corporate: Briefcase,
    platform: Users,
};

const CATEGORY_COLORS = {
    supplier: { accent: '#B45309', soft: '#FFF7ED' },
    workshop: { accent: '#23262D', soft: '#F3F4F6' },
    corporate: { accent: '#1D4ED8', soft: '#EFF6FF' },
    platform: { accent: '#6B7280', soft: '#F9FAFB' },
};

function categoryMeta(category, t) {
    const id = CATEGORY_COLORS[category] ? category : 'platform';
    return {
        label: t(`profile.cat.${id}`),
        icon: CATEGORY_ICONS[id],
        ...CATEGORY_COLORS[id],
    };
}

function getInitials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    return String(name || '?').slice(0, 2).toUpperCase();
}

function DrawerAvatar({ name, category, isGroup = false, size = 'lg', t }) {
    const meta = categoryMeta(category, t);
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

function MemberRow({ person, t }) {
    const meta = categoryMeta(person.category, t);
    const Icon = meta.icon;
    return (
        <div className="pc-drawer-member">
            <DrawerAvatar name={person.name} category={person.category} size="sm" t={t} />
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

export default function PlatformChatContactProfile({ conversation, onClose, locale = 'en', t: tProp }) {
    const t = tProp || ((key, vars) => pcT(locale, key, vars));

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
    const meta = categoryMeta(direct?.category || 'platform', t);

    return (
        <AdminScreenShell
            title={isGroup ? conversation.title : direct?.name || conversation.title}
            onBack={onClose}
            backLabel={t('profile.closeInfo')}
            className="pc-contact-profile-screen"
        >
            <div className="pc-drawer__hero pc-drawer__hero--inline">
                <DrawerAvatar
                    name={isGroup ? conversation.title : direct?.name}
                    category={direct?.category || 'platform'}
                    isGroup={isGroup}
                    t={t}
                />
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
                        {t('profile.groupMeta', { count: conversation.participants?.length ?? 0 })}
                    </p>
                )}
                {!isGroup && direct?.entityName && (
                    <p className="pc-drawer__meta">{direct.entityName}</p>
                )}
            </div>

            <div className="pc-drawer__scroll pc-drawer__scroll--inline">
                {isGroup ? (
                    <section className="pc-drawer__section">
                        <h3>{t('profile.members')}</h3>
                        <div className="pc-drawer-members">
                            {conversation.participants
                                ?.filter((p) => !p.isSelf)
                                .map((p) => (
                                    <MemberRow key={p.userId} person={p} t={t} />
                                ))}
                        </div>
                    </section>
                ) : direct ? (
                    <>
                        <section className="pc-drawer__section">
                            <h3>{t('profile.about')}</h3>
                            <InfoCard icon={meta.icon} label={meta.label} value={direct.entityName} />
                            {direct.branchName && (
                                <InfoCard icon={Building2} label={t('profile.branch')} value={direct.branchName} />
                            )}
                            <InfoCard icon={User} label={t('profile.portalRole')} value={direct.role} />
                        </section>
                        <section className="pc-drawer__section">
                            <h3>{t('profile.contact')}</h3>
                            <InfoCard
                                icon={Mail}
                                label={t('profile.email')}
                                value={direct.email}
                                href={direct.email ? `mailto:${direct.email}` : undefined}
                            />
                            <InfoCard
                                icon={Phone}
                                label={t('profile.mobile')}
                                value={direct.mobile}
                                href={direct.mobile ? `tel:${direct.mobile}` : undefined}
                            />
                        </section>
                    </>
                ) : (
                    <p className="pc-drawer-empty">{t('profile.empty')}</p>
                )}
            </div>
        </AdminScreenShell>
    );
}
