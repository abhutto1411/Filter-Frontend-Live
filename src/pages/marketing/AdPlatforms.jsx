import React, { useMemo, useState } from 'react';
import {
    Zap,
    Link2,
    Settings,
    Search,
    Music2,
    Ghost,
} from 'lucide-react';

const FONT =
    'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const initialPlatforms = [
    {
        id: 'meta',
        name: 'Meta Ads',
        iconType: 'meta',
        connected: false,
        button: 'Connect Meta Ads',
    },
    {
        id: 'google',
        name: 'Google Ads',
        iconType: 'google',
        connected: false,
        button: 'Connect Google Ads',
    },
    {
        id: 'tiktok',
        name: 'TikTok Ads',
        iconType: 'tiktok',
        connected: false,
        button: 'Connect TikTok Ads',
    },
    {
        id: 'snapchat',
        name: 'Snapchat Ads',
        iconType: 'snapchat',
        connected: false,
        button: 'Connect Snapchat Ads',
    },
    {
        id: 'analytics',
        name: 'Google Analytics',
        iconType: 'analytics',
        connected: false,
        button: 'Connect Google Analytics',
    },
];

const PlatformIcon = ({ type }) => {
    if (type === 'meta') {
        return (
            <div style={iconWrapStyle}>
                <div
                    style={{
                        width: 17,
                        height: 22,
                        border: '2px solid #1D4ED8',
                        borderRadius: 2,
                        background: '#E0F2FE',
                        boxSizing: 'border-box',
                        position: 'relative',
                    }}
                >
                    <div
                        style={{
                            position: 'absolute',
                            left: 3,
                            right: 3,
                            bottom: 2,
                            height: 2,
                            borderRadius: 2,
                            background: '#111827',
                        }}
                    />
                </div>
            </div>
        );
    }

    if (type === 'google') {
        return (
            <div style={iconWrapStyle}>
                <Search size={24} color="#111827" strokeWidth={2.1} />
            </div>
        );
    }

    if (type === 'tiktok') {
        return (
            <div style={iconWrapStyle}>
                <Music2 size={25} color="#6D28D9" strokeWidth={2.6} />
            </div>
        );
    }

    if (type === 'snapchat') {
        return (
            <div style={iconWrapStyle}>
                <div style={{ position: 'relative', width: 25, height: 25 }}>
                    <Ghost
                        size={24}
                        color="#111827"
                        strokeWidth={2}
                        style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                        }}
                    />

                    <div
                        style={{
                            position: 'absolute',
                            width: 5,
                            height: 5,
                            borderRadius: '50%',
                            background: '#EF4444',
                            left: 7,
                            top: 13,
                        }}
                    />
                </div>
            </div>
        );
    }

    return (
        <div style={iconWrapStyle}>
            <svg width="24" height="24" viewBox="0 0 24 24">
                <rect
                    x="3"
                    y="4"
                    width="18"
                    height="17"
                    rx="1"
                    fill="#FFFFFF"
                    stroke="#111827"
                    strokeWidth="1.5"
                />
                <rect x="6" y="12" width="2.8" height="6" fill="#22C55E" />
                <rect x="10.5" y="8" width="2.8" height="10" fill="#3B82F6" />
                <rect x="15" y="10" width="2.8" height="8" fill="#EF4444" />
            </svg>
        </div>
    );
};

const PlatformCard = ({ platform, onConnect }) => {
    return (
        <div style={platformCardStyle}>
            <div style={platformTopStyle}>
                <div style={platformInfoStyle}>
                    <PlatformIcon type={platform.iconType} />

                    <div style={{ minWidth: 0 }}>
                        <div style={platformNameStyle}>{platform.name}</div>

                        <div
                            style={{
                                ...platformStatusStyle,
                                color: platform.connected ? '#059669' : '#9CA3AF',
                            }}
                        >
                            {platform.connected ? 'Connected' : 'Not connected'}
                        </div>
                    </div>
                </div>

                <button type="button" title="Settings" style={settingsBtnStyle}>
                    <Settings size={14} strokeWidth={2} />
                </button>
            </div>

            <div style={buttonWrapStyle}>
                <button
                    type="button"
                    onClick={() => onConnect(platform.id)}
                    style={connectBtnStyle}
                >
                    <Link2 size={12} strokeWidth={2.4} />
                    {platform.connected
                        ? `Disconnect ${platform.name}`
                        : platform.button}
                </button>
            </div>
        </div>
    );
};

export const AdPlatforms = () => {
    const [platforms, setPlatforms] = useState(initialPlatforms);
    const [autoSync, setAutoSync] = useState(false);

    const connectedCount = useMemo(
        () => platforms.filter((item) => item.connected).length,
        [platforms],
    );

    const handleConnect = (id) => {
        setPlatforms((prev) =>
            prev.map((item) =>
                item.id === id
                    ? {
                          ...item,
                          connected: !item.connected,
                      }
                    : item,
            ),
        );
    };

    return (
        <div style={pageStyle}>
            <section style={topCardStyle}>
                <div style={topHeaderStyle}>
                    <div>
                        <h3 style={topTitleStyle}>Ad Platform Integrations</h3>

                        <div style={topSubStyle}>
                            {connectedCount} of {platforms.length} platforms connected
                        </div>
                    </div>
                </div>

                <div style={dividerStyle} />

                <div style={autoSyncRowStyle}>
                    <Zap size={14} color="#D5AD27" strokeWidth={2.3} />

                    <span style={autoSyncTextStyle}>Auto-Sync</span>

                    <button
                        type="button"
                        onClick={() => setAutoSync((prev) => !prev)}
                        style={{
                            ...toggleStyle,
                            background: autoSync ? '#D5AD27' : '#E5E7EB',
                            justifyContent: autoSync ? 'flex-end' : 'flex-start',
                        }}
                    >
                        <span style={toggleDotStyle} />
                    </button>
                </div>
            </section>

            <div style={gridStyle}>
                {platforms.map((platform) => (
                    <PlatformCard
                        key={platform.id}
                        platform={platform}
                        onConnect={handleConnect}
                    />
                ))}
            </div>
        </div>
    );
};

export default AdPlatforms;

const pageStyle = {
    minHeight: 'calc(100vh - 54px)',
    background: '#F3F4F6',
    padding: '21px 20px',
    boxSizing: 'border-box',
    fontFamily: FONT,
};

const topCardStyle = {
    background: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: 8,
    minHeight: 101,
    padding: '20px 13px 16px',
    boxSizing: 'border-box',
    marginBottom: 17,
};

const topHeaderStyle = {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 17,
};

const topTitleStyle = {
    margin: 0,
    fontSize: 14,
    fontWeight: 900,
    color: '#111827',
    lineHeight: 1.1,
    marginBottom: 5,
};

const topSubStyle = {
    fontSize: 11,
    fontWeight: 500,
    color: '#475569',
    lineHeight: 1,
};

const dividerStyle = {
    height: 1,
    background: '#F1F5F9',
    marginBottom: 16,
};

const autoSyncRowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
};

const autoSyncTextStyle = {
    fontSize: 12,
    fontWeight: 800,
    color: '#111827',
};

const toggleStyle = {
    width: 31,
    height: 17,
    border: 'none',
    borderRadius: 999,
    padding: 2,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
};

const toggleDotStyle = {
    width: 13,
    height: 13,
    borderRadius: '50%',
    background: '#FFFFFF',
    display: 'block',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.15)',
};

const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 14,
};

const platformCardStyle = {
    height: 99,
    background: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: 8,
    overflow: 'hidden',
    boxSizing: 'border-box',
    fontFamily: FONT,
};

const platformTopStyle = {
    height: 59,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 13px',
    boxSizing: 'border-box',
};

const platformInfoStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
};

const iconWrapStyle = {
    width: 24,
    height: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
};

const platformNameStyle = {
    fontSize: 13,
    fontWeight: 800,
    color: '#111827',
    lineHeight: 1.1,
    marginBottom: 5,
};

const platformStatusStyle = {
    fontSize: 10,
    fontWeight: 500,
    lineHeight: 1,
};

const settingsBtnStyle = {
    border: 'none',
    background: 'transparent',
    padding: 0,
    color: '#64748B',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
};

const buttonWrapStyle = {
    padding: '0 13px',
    boxSizing: 'border-box',
};

const connectBtnStyle = {
    width: '100%',
    height: 24,
    border: 'none',
    borderRadius: 5,
    background: '#D5AD27',
    color: '#FFFFFF',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: 800,
    cursor: 'pointer',
};
