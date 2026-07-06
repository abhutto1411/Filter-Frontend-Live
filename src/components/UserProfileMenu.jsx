import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, User, LogOut } from 'lucide-react';

const UserProfileMenu = ({ isOpen, onClose, onLogout, locale = 'en' }) => {
    const t = {
        en: { settings: 'Settings', profile: 'Profile', logout: 'Logout' },
        ar: { settings: 'الإعدادات', profile: 'الملف الشخصي', logout: 'تسجيل الخروج' }
    };

    const currentT = t[locale] || t.en;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="user-profile-menu"
                >
                    <button className="user-menu-item" onClick={(e) => { e.stopPropagation(); console.log('Settings clicked'); onClose(); }}>
                        <Settings size={16} />
                        <span>{currentT.settings}</span>
                    </button>
                    <button className="user-menu-item" onClick={(e) => { e.stopPropagation(); console.log('Profile clicked'); onClose(); }}>
                        <User size={16} />
                        <span>{currentT.profile}</span>
                    </button>
                    <div className="user-menu-divider" />
                    <button className="user-menu-item logout" onClick={(e) => { e.stopPropagation(); onLogout(); onClose(); }}>
                        <LogOut size={16} />
                        <span>{currentT.logout}</span>
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default UserProfileMenu;
