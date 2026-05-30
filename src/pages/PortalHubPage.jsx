import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
    Building2, 
    Wrench, 
    Monitor, 
    UserCheck, 
    Package, 
    Share2, 
    Box, 
    ArrowRight,
    Lock,
} from 'lucide-react';
import '../styles/SignInPage.css'; // Reusing branding styles

const PORTALS = [
    {
        id: 'corporate',
        name: 'Filter Corporate Portal',
        description: 'Fleet management, billing, and company account controls for corporate clients.',
        icon: Building2,
        color: '#8B5CF6', // Purple
    },
    {
        id: 'workshop',
        name: 'Filter Admin Workshop Portal',
        description: 'Internal management for service centers, inventory, and technician assignment.',
        icon: Wrench,
        color: '#059669', // Emerald
    },
    {
        id: 'pos',
        name: 'Filter POS Portal',
        description: 'Point of Sale system for front-desk operations and instant invoicing.',
        icon: Monitor,
        color: '#3B82F6', // Blue
    },
    {
        id: 'technician',
        name: 'Filter Technician Portal',
        description: 'Real-time job tracking, service checklists, and quality assurance for our mechanics.',
        icon: UserCheck,
        color: '#D97706', // Amber
    },
    {
        id: 'locker',
        name: 'Filter Locker Portal',
        description: 'Secure terminal management for our contactless vehicle drop-off/pick-up points.',
        icon: Box,
        color: '#DC2626', // Red
    },
    {
        id: 'supplier',
        name: 'Filter Supplier Portal',
        description: 'Inventory supply chain management and warehouse procurement system.',
        icon: Package,
        color: '#4B5563', // Gray
    },
    {
        id: 'referrer-portal',
        name: 'Filter Referrer Portal',
        description: 'Track referrals, manage earnings, and see client conversion metrics.',
        icon: Share2,
        color: '#EC4899', // Pink
    }
];

export default function PortalHubPage() {
    const navigate = useNavigate();

    return (
        <div className="signin-container" style={{ overflowY: 'auto', padding: '40px 20px' }}>
            <div className="hub-content" style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
                
                {/* Header Section */}
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    style={{ textAlign: 'center', marginBottom: '60px' }}
                >
                    <h1 className="brand-main-title" style={{ fontSize: '3.5rem', marginBottom: '12px' }}>
                        FILTER <span>HUB</span>
                    </h1>
                    <p className="brand-subtitle" style={{ maxWidth: '700px', margin: '0 auto', fontSize: '1.1rem' }}>
                        Select your destination portal below. Secure access to the Filter Services management ecosystem. 
                        Professional tools for every part of the journey.
                    </p>
                </motion.div>

                {/* Portals Grid */}
                <div className="portals-grid" style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', 
                    gap: '24px',
                    paddingBottom: '40px'
                }}>
                    {PORTALS.map((portal, index) => (
                        <motion.div
                            key={portal.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.4, delay: index * 0.05 }}
                            whileHover={{ y: -8 }}
                            className="portal-card"
                            onClick={() => navigate(`/${portal.id}/login`)}
                            style={{
                                background: 'white',
                                borderRadius: '24px',
                                padding: '32px',
                                boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
                                cursor: 'pointer',
                                border: '1px solid rgba(0,0,0,0.05)',
                                display: 'flex',
                                flexDirection: 'column',
                                height: '100%',
                                position: 'relative',
                                overflow: 'hidden'
                            }}
                        >
                            {/* Accent Background */}
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                right: 0,
                                width: '120px',
                                height: '120px',
                                background: `${portal.color}08`,
                                borderRadius: '0 0 0 100%',
                                zIndex: 0
                            }} />

                            <div style={{ position: 'relative', zIndex: 1 }}>
                                <div style={{ 
                                    width: '56px', 
                                    height: '56px', 
                                    borderRadius: '16px', 
                                    background: `${portal.color}15`, 
                                    color: portal.color,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: '24px'
                                }}>
                                    <portal.icon size={28} />
                                </div>

                                <h3 style={{ 
                                    fontSize: '1.5rem', 
                                    fontWeight: '800', 
                                    color: '#111827', 
                                    marginBottom: '12px' 
                                }}>
                                    {portal.name}
                                </h3>
                                
                                <p style={{ 
                                    color: '#6B7280', 
                                    lineHeight: '1.6', 
                                    fontSize: '0.9375rem',
                                    marginBottom: '32px',
                                    flexGrow: 1
                                }}>
                                    {portal.description}
                                </p>

                                <div style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '8px',
                                    fontWeight: '700',
                                    color: portal.color,
                                    fontSize: '0.875rem',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                }}>
                                    <span>Access Portal</span>
                                    <ArrowRight size={16} />
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Admin Access Footer */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    style={{ 
                        textAlign: 'center', 
                        marginTop: '40px', 
                        padding: '30px',
                        borderTop: '1px solid rgba(0,0,0,0.08)'
                    }}
                >
                    <div style={{ display: 'inline-flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                        <button
                            onClick={() => navigate('/admin/login')}
                            style={{
                                background: 'transparent',
                                border: '1px solid #E5E7EB',
                                padding: '12px 24px',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '10px',
                                fontSize: '0.875rem',
                                fontWeight: '600',
                                color: '#6B7280',
                                transition: 'all 0.2s'
                            }}
                        >
                            <Lock size={14} />
                            Filter ERP Access
                        </button>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
