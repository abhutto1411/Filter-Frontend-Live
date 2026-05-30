import React, { useState } from 'react';
import { 
    BarChart2, Building2, Wrench, Package, Users, 
    Calendar, Filter, Download, ArrowUpRight, ArrowDownRight,
    TrendingUp, CalendarDays, Search, BadgeDollarSign, ShoppingCart, X, FileText
} from 'lucide-react';
import '../../styles/admin/ReportingPage.css';

// MOCK DATA GENERATION
const MOCK_WORKSHOPS = [
    { id: 'WS01', name: 'Jeddah Main Branch', revenue: 145000, orders: 420, growth: 12.5 },
    { id: 'WS02', name: 'Riyadh Express Service', revenue: 98000, orders: 310, growth: -2.4 },
    { id: 'WS03', name: 'Dammam Heavy Duty', revenue: 112000, orders: 185, growth: 5.8 },
    { id: 'WS04', name: 'Mecca Quick Lube', revenue: 67000, orders: 290, growth: 18.2 },
];

const MOCK_DEPARTMENTS = [
    { name: 'Mechanical & Workshop', revenue: 215000, orders: 380, avgTicket: 565 },
    { name: 'Lube & Quick Service', revenue: 125000, orders: 620, avgTicket: 201 },
    { name: 'Tire & Wheel Center', revenue: 184000, orders: 210, avgTicket: 876 },
    { name: 'Electrical & Diagnostics', revenue: 95000, orders: 145, avgTicket: 655 },
];

const MOCK_CATEGORIES = [
    { name: 'Synthetic Oils', volume: 1250, revenue: 87500, stockStatus: 'Healthy' },
    { name: 'Brake Pads', volume: 430, revenue: 51600, stockStatus: 'Low' },
    { name: 'Tires (All Season)', volume: 180, revenue: 108000, stockStatus: 'Healthy' },
    { name: 'Batteries', volume: 95, revenue: 33250, stockStatus: 'Critical' },
    { name: 'Filters (Oil/Air)', volume: 890, revenue: 26700, stockStatus: 'Healthy' },
];

const MOCK_TECHNICIANS = [
    { name: 'Ahmed Hassan', dept: 'Mechanical', completedOrders: 145, generatedRevenue: 58000, rating: 4.8 },
    { name: 'Omar Khalid', dept: 'Lube & Quick', completedOrders: 210, generatedRevenue: 42000, rating: 4.6 },
    { name: 'Salem Ali', dept: 'Tires', completedOrders: 95, generatedRevenue: 57000, rating: 4.9 },
    { name: 'Yousef Saad', dept: 'Electrical', completedOrders: 82, generatedRevenue: 49200, rating: 4.7 },
];

const StatCard = ({ title, value, icon: Icon, trend, prefix = '' }) => (
    <div className="rep-stat-card">
        <div className="rep-stat-header">
            <span className="rep-stat-title">{title}</span>
            <div className="rep-stat-icon-wrap">
                <Icon size={20} />
            </div>
        </div>
        <div className="rep-stat-value">{prefix}{value.toLocaleString()}</div>
        {trend && (
            <div className={`rep-stat-trend ${trend > 0 ? 'positive' : 'negative'}`}>
                {trend > 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                <span>{Math.abs(trend)}% vs last period</span>
            </div>
        )}
    </div>
);

export default function ReportingPage() {
    const [activeTab, setActiveTab] = useState('workshops');
    const [dateRange, setDateRange] = useState('month'); // today, week, month, year
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDetails, setSelectedDetails] = useState(null); // { type, data }

    const renderWorkshopsReport = () => (
        <div className="rep-table-container">
            <table className="rep-data-table">
                <thead>
                    <tr>
                        <th>Workshop Name</th>
                        <th>Total Orders</th>
                        <th>Total Revenue</th>
                        <th>Growth</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {MOCK_WORKSHOPS.map(ws => (
                        <tr key={ws.id} onClick={() => setSelectedDetails({ type: 'workshop', data: ws })} style={{ cursor: 'pointer' }}>
                            <td style={{ fontWeight: 600 }}>{ws.name}</td>
                            <td>{ws.orders}</td>
                            <td style={{ fontWeight: 700, color: 'var(--color-primary-dark)' }}>SAR {ws.revenue.toLocaleString()}</td>
                            <td>
                                <span className={`rep-badge ${ws.growth > 0 ? 'success' : 'danger'}`}>
                                    {ws.growth > 0 ? '+' : ''}{ws.growth}%
                                </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                                <button className="rep-btn-text" onClick={(e) => { e.stopPropagation(); setSelectedDetails({ type: 'workshop', data: ws }); }}>View Details</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderDepartmentsReport = () => (
        <div className="rep-table-container">
            <table className="rep-data-table">
                <thead>
                    <tr>
                        <th>Department</th>
                        <th>Volume (Orders)</th>
                        <th>Avg. Ticket Size</th>
                        <th>Gross Revenue</th>
                    </tr>
                </thead>
                <tbody>
                    {MOCK_DEPARTMENTS.map(dept => (
                        <tr key={dept.name} onClick={() => setSelectedDetails({ type: 'department', data: dept })} style={{ cursor: 'pointer' }}>
                            <td style={{ fontWeight: 600 }}>{dept.name}</td>
                            <td>{dept.orders}</td>
                            <td>SAR {dept.avgTicket.toLocaleString()}</td>
                            <td style={{ fontWeight: 700, color: '#10B981' }}>SAR {dept.revenue.toLocaleString()}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderCategoriesReport = () => (
        <div className="rep-table-container">
            <table className="rep-data-table">
                <thead>
                    <tr>
                        <th>Category / Product Group</th>
                        <th>Units Sold</th>
                        <th>Gross Revenue</th>
                        <th>Stock Status</th>
                    </tr>
                </thead>
                <tbody>
                    {MOCK_CATEGORIES.map(cat => (
                        <tr key={cat.name} onClick={() => setSelectedDetails({ type: 'category', data: cat })} style={{ cursor: 'pointer' }}>
                            <td style={{ fontWeight: 600 }}>{cat.name}</td>
                            <td>{cat.volume} units</td>
                            <td style={{ fontWeight: 700, color: 'var(--color-primary-dark)' }}>SAR {cat.revenue.toLocaleString()}</td>
                            <td>
                                <span className={`rep-badge ${cat.stockStatus === 'Healthy' ? 'success' : cat.stockStatus === 'Low' ? 'warning' : 'danger'}`}>
                                    {cat.stockStatus}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderTechniciansReport = () => (
        <div className="rep-table-container">
            <table className="rep-data-table">
                <thead>
                    <tr>
                        <th>Technician Name</th>
                        <th>Department</th>
                        <th>Jobs Completed</th>
                        <th>Revenue Generated</th>
                        <th>Avg. Rating</th>
                    </tr>
                </thead>
                <tbody>
                    {MOCK_TECHNICIANS.map(tech => (
                        <tr key={tech.name} onClick={() => setSelectedDetails({ type: 'technician', data: tech })} style={{ cursor: 'pointer' }}>
                            <td style={{ fontWeight: 600 }}>{tech.name}</td>
                            <td><span className="rep-badge neutral">{tech.dept}</span></td>
                            <td>{tech.completedOrders}</td>
                            <td style={{ fontWeight: 700, color: 'var(--color-primary-dark)' }}>SAR {tech.generatedRevenue.toLocaleString()}</td>
                            <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ color: '#F59E0B' }}>★</span> {tech.rating}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    return (
        <div className="reporting-page module-container">
            <div className="rep-header">
                <div>
                    <h1 className="rep-title">Super Admin Reports</h1>
                    <p className="rep-subtitle">Comprehensive analytics and performance metrics across all operations.</p>
                </div>
                <div className="rep-header-actions">
                    <div className="rep-date-filter">
                        <CalendarDays size={18} />
                        <select value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
                            <option value="today">Today</option>
                            <option value="week">This Week</option>
                            <option value="month">This Month</option>
                            <option value="year">This Year</option>
                        </select>
                    </div>
                    <button className="rep-btn-primary">
                        <Download size={18} /> Export CSV
                    </button>
                </div>
            </div>

            <div className="rep-stats-grid">
                <StatCard title="Total Revenue" value={422000} prefix="SAR " icon={BadgeDollarSign} trend={8.4} />
                <StatCard title="Total Orders" value={1205} icon={ShoppingCart} trend={12.1} />
                <StatCard title="Active Workshops" value={14} icon={Building2} trend={0} />
                <StatCard title="Active Technicians" value={142} icon={Wrench} trend={5.2} />
            </div>

            <div className="rep-content-card">
                <div className="rep-tabs-header">
                    <div className="rep-tabs">
                        <button className={`rep-tab ${activeTab === 'workshops' ? 'active' : ''}`} onClick={() => setActiveTab('workshops')}>
                            <Building2 size={16} /> Workshops
                        </button>
                        <button className={`rep-tab ${activeTab === 'departments' ? 'active' : ''}`} onClick={() => setActiveTab('departments')}>
                            <TrendingUp size={16} /> Departments
                        </button>
                        <button className={`rep-tab ${activeTab === 'categories' ? 'active' : ''}`} onClick={() => setActiveTab('categories')}>
                            <Package size={16} /> Categories / Products
                        </button>
                        <button className={`rep-tab ${activeTab === 'technicians' ? 'active' : ''}`} onClick={() => setActiveTab('technicians')}>
                            <Users size={16} /> Technicians
                        </button>
                    </div>
                    <div className="rep-search-bar">
                        <Search size={16} />
                        <input 
                            type="text" 
                            placeholder="Search within report..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="rep-tab-content">
                    {activeTab === 'workshops' && renderWorkshopsReport()}
                    {activeTab === 'departments' && renderDepartmentsReport()}
                    {activeTab === 'categories' && renderCategoriesReport()}
                    {activeTab === 'technicians' && renderTechniciansReport()}
                </div>
            </div>

            {/* Slide-over Details Panel */}
            {selectedDetails && (
                <div className="rep-modal-overlay" onClick={() => setSelectedDetails(null)}>
                    <div className="rep-details-panel" onClick={(e) => e.stopPropagation()}>
                        <div className="rep-details-header">
                            <div>
                                <h2>{selectedDetails.data.name}</h2>
                                <span>{selectedDetails.type.toUpperCase()} DETAILS</span>
                            </div>
                            <button className="rep-close-btn" onClick={() => setSelectedDetails(null)}>
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="rep-details-body">
                            {/* Generic Details View */}
                            <div className="rep-details-grid">
                                {Object.entries(selectedDetails.data).map(([key, value]) => {
                                    if (key === 'id') return null;
                                    return (
                                        <div key={key} className="rep-detail-item">
                                            <span className="rep-detail-label">{key.replace(/([A-Z])/g, ' $1').toUpperCase()}</span>
                                            <span className="rep-detail-value">
                                                {typeof value === 'number' && key.toLowerCase().includes('revenue') 
                                                    ? `SAR ${value.toLocaleString()}` 
                                                    : value}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="rep-details-section">
                                <h3>Recent Activity</h3>
                                <div className="rep-activity-list">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="rep-activity-card">
                                            <FileText size={16} style={{ color: '#64748B' }} />
                                            <div style={{ flex: 1 }}>
                                                <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0F172A', marginBottom: '4px' }}>
                                                    {selectedDetails.type === 'technician' ? `Completed Order #ORD-2026-0${140+i}` : `System Event / Transaction`}
                                                </p>
                                                <p style={{ fontSize: '0.75rem', color: '#64748B' }}>{i} hour{i>1?'s':''} ago</p>
                                            </div>
                                            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#10B981' }}>SAR {(Math.random() * 500 + 100).toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            <button className="rep-btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 'auto', padding: '12px' }}>
                                <Download size={18} /> Download Full Report
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
