import React, { useState, useEffect } from 'react';
import { ChevronDown, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/** Legacy demo seeds — admin marketing loads from `super-admin-marketing-protal` APIs. */
export const INITIAL_PROMOTIONS = [];

export const INITIAL_PROMO_CODES = [];

export const INITIAL_REFERRERS = [];

export const INITIAL_REFERRAL_CODES = [];

export const INITIAL_LOYALTY_TIERS = [
    { id: 1, tier: 'Bronze', color: 'bronze', points: '0 - 1,000', perks: '3% Points back, 1 Free Wash/yr', minPoints: 0, discount: 3 },
    { id: 2, tier: 'Silver', color: 'silver', points: '1,001 - 5,000', perks: '5% Points back, 2 Free Washes/yr', minPoints: 1001, discount: 5 },
    { id: 3, tier: 'Gold', color: 'gold', points: '5,001 - 15,000', perks: '10% Points back, Priority Service', minPoints: 5001, discount: 10 },
    { id: 4, tier: 'Platinum', color: 'platinum', points: '15,000+', perks: '15% Points back, Concierge pickup', minPoints: 15001, discount: 15 }
];

export const INITIAL_LOYALTY_PROGRAM = {
    name: 'FILTER Rewards',
    pointsPerSpent: 1,
    pointsPerDiscount: 100,
    minRedeem: 500,
    desc: 'Reward your most loyal customers with points and exclusive perks.',
    isActive: true,
};

export const MarketingContext = React.createContext();

export const MarketingProvider = ({ children }) => {
    const [promotions, setPromotions] = useState(INITIAL_PROMOTIONS);
    const [promoCodes, setPromoCodes] = useState(INITIAL_PROMO_CODES);
    const [referrers, setReferrers] = useState(INITIAL_REFERRERS);
    const [referralCodes, setReferralCodes] = useState(INITIAL_REFERRAL_CODES);
    const [loyaltyTiers, setLoyaltyTiers] = useState(INITIAL_LOYALTY_TIERS);
    const [loyaltyProgram, setLoyaltyProgram] = useState(INITIAL_LOYALTY_PROGRAM);

    const value = {
        promotions, setPromotions,
        promoCodes, setPromoCodes,
        referrers, setReferrers,
        referralCodes, setReferralCodes,
        loyaltyTiers, setLoyaltyTiers,
        loyaltyProgram, setLoyaltyProgram
    };

    return (
        <MarketingContext.Provider value={value}>
            {children}
        </MarketingContext.Provider>
    );
};

export const useMarketingState = () => {
    const context = React.useContext(MarketingContext);
    if (!context) {
        throw new Error('useMarketingState must be used within a MarketingProvider');
    }
    return context;
};


export const StatCardMini = ({ title, value, icon: Icon, trend, trendSuffix = 'this month' }) => (
    <div className="dashboard-stat-card">
        <div className="dashboard-stat-content">
            <p className="dashboard-stat-label">{title}</p>
            <h3 className="dashboard-stat-value">{value}</h3>
            {trend != null && trend !== '' && (
                <p className="dashboard-stat-subtitle" style={{ color: String(trend).startsWith('+') ? '#10B981' : '#6B7280' }}>
                    {trend}
                    {trendSuffix ? <span style={{ color: '#6B7280' }}> {trendSuffix}</span> : null}
                </p>
            )}
        </div>
        <div className="icon-wrapper">
            <Icon size={20} />
        </div>
    </div>
);

export const MultiSelectDropdown = ({ label, options, selected, onChange, placeholder = "Select options..." }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="form-group" style={{ position: 'relative' }}>
            <label className="form-label">{label}</label>
            <div
                className="form-input-field"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    minHeight: '44px',
                    height: 'auto',
                    padding: '8px 16px'
                }}
                onClick={() => setIsOpen(!isOpen)}
            >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {selected.length === 0 ? (
                        <span style={{ color: '#9CA3AF' }}>{placeholder}</span>
                    ) : (
                        selected.map(opt => (
                            <span
                                key={opt}
                                style={{
                                    background: 'rgba(255, 215, 0, 0.1)',
                                    color: 'var(--color-primary)',
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    border: '1px solid rgba(255, 215, 0, 0.2)'
                                }}
                            >
                                {opt}
                            </span>
                        ))
                    )}
                </div>
                <ChevronDown size={16} style={{ transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : '' }} />
            </div>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <div
                            style={{ position: 'fixed', inset: 0, zIndex: 998 }}
                            onClick={() => setIsOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                zIndex: 999,
                                background: 'white',
                                borderRadius: '12px',
                                marginTop: '8px',
                                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                                border: '1px solid #F3F4F6',
                                padding: '8px',
                                maxHeight: '200px',
                                overflowY: 'auto'
                            }}
                        >
                            {options.map(opt => (
                                <div
                                    key={opt}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '10px 12px',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        transition: 'background 0.2s'
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const next = selected.includes(opt)
                                            ? selected.filter(s => s !== opt)
                                            : [...selected, opt];
                                        onChange(next);
                                    }}
                                    onMouseEnter={(e) => e.target.style.background = '#F9FAFB'}
                                    onMouseLeave={(e) => e.target.style.background = 'transparent'}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selected.includes(opt)}
                                        readOnly
                                        style={{ accentColor: 'var(--color-primary)', width: '16px', height: '16px' }}
                                    />
                                    <span style={{ fontSize: '13px', fontWeight: 500 }}>{opt}</span>
                                </div>
                            ))}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export const generateCode = (prefix = '', length = 8) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const random = Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    return prefix ? `${prefix}-${random}` : random;
};
