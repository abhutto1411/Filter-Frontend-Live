import React, { useState, useEffect, useMemo } from 'react';
import { Search, X, Check, RefreshCw, Users } from 'lucide-react';
import { apiFetch } from '../../../services/api';
import {
    normalizeCashierTechniciansList,
    unwrapCashierTechniciansResponse,
    parseTechnicianStatus,
    parseTechnicianSlotsUsed,
    parseTechnicianTotalSlots,
} from '../../../utils/cashierTechnicians.util';

const parseAssignable = (t, statusLower) => {
    const raw = t?.assignable;
    if (typeof raw === 'boolean') return raw;
    if (typeof raw === 'string') {
        const l = raw.toLowerCase();
        if (l === 'true') return true;
        if (l === 'false') return false;
    }
    // Backend didn't tell us → default to "online = assignable" (reference fallback)
    return statusLower === 'online';
};

const formatLastSeen = (raw) => {
    if (!raw) return 'Never';
    try {
        const d = new Date(raw);
        if (isNaN(d.getTime())) return String(raw);
        const diffMs = Date.now() - d.getTime();
        const mins = Math.floor(diffMs / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        if (days < 7) return `${days}d ago`;
        return d.toISOString().split('T')[0];
    } catch {
        return '';
    }
};

export default function TechnicianAssignmentModal({
    job,
    selectedTechs,
    onConfirm,
    onClose,
    loading: parentLoading
}) {
    const [search, setSearch] = useState('');
    const [technicians, setTechnicians] = useState([]);
    const [localSelected, setLocalSelected] = useState(selectedTechs || []);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [onlineOnly, setOnlineOnly] = useState(false);

    const deptId = job.departmentId || job.deptId || job.department?.id || job.department_id;
    const deptName = job.departmentName || job.department?.name || job.department || 'Workshop';

    useEffect(() => {
        const fetchTechs = async () => {
            setLoading(true);
            setError(null);
            try {
                const query = deptId ? `?departmentId=${deptId}` : '';
                const url = `/cashier/technicians${query}`;
                const res = await apiFetch(url);
                setTechnicians(normalizeCashierTechniciansList(unwrapCashierTechniciansResponse(res)));
            } catch (err) {
                console.error('Fetch Techs Error:', err);
                if (err.message?.includes('supplier_id')) {
                    setError('Backend database error: missing supplier_id column. Please contact support.');
                } else {
                    setError('Could not load technicians');
                }
            } finally {
                setLoading(false);
            }
        };

        fetchTechs();
    }, [deptId]);

    // Normalize once — consistent shape for the rest of the component.
    const normalizedTechs = useMemo(() => technicians.map(t => {
        const id = t.employeeId || t.id || t.userId || t.employee?.id || t.user?.id || t.technician?.id || '';
        const statusLower = parseTechnicianStatus(t);
        const slotsUsed = parseTechnicianSlotsUsed(t);
        const totalSlots = parseTechnicianTotalSlots(t);
        return {
            ...t,
            _id: String(id),
            _name: t.name || t.employeeName || t.employee?.name || 'Technician',
            _role: t.specialization || t.role || t.technicianType || 'Technician',
            _statusLower: statusLower,
            _isOnline: statusLower === 'online',
            _lastSeenAt: t.lastSeenAt || t.technicianStatus?.lastSeenAt || t.status?.lastSeenAt || '',
            _slotsUsed: slotsUsed,
            _totalSlots: totalSlots,
            _assignable: parseAssignable(t, statusLower),
            _departmentIds: [
                t.departmentId, t.deptId, t.department_id, t.department?.id,
                ...(Array.isArray(t.departmentIds) ? t.departmentIds : []),
                ...(Array.isArray(t.departments) ? t.departments.map(d => d?.id ?? d) : []),
            ].filter(v => v !== undefined && v !== null).map(v => String(v).trim().toLowerCase()).filter(Boolean),
        };
    }), [technicians]);

    const getTechId = (tech) => tech?._id || tech?.employeeId || tech?.id || tech?.userId ||
        tech?.employee?.id || tech?.user?.id || tech?.technician?.id || '';

    // Reference canPickNew logic (pos_technician_assignment_view.dart):
    //   tech.assignable && tech.slotsUsed < tech.totalSlots
    // Already-selected techs are always allowed to be deselected even if slots are full.
    const isPickableForNewSelection = (t) => t._assignable && t._slotsUsed < t._totalSlots;

    const handleToggleTech = (tech) => {
        const techId = getTechId(tech);
        if (!techId) return;
        const isSel = localSelected.some(st => getTechId(st) === techId);
        if (!isSel && !isPickableForNewSelection(tech)) {
            // Blocked — full slots or not assignable. Deselecting would still be allowed.
            return;
        }
        setLocalSelected(prev => {
            const exists = prev.find(t => getTechId(t) === techId);
            if (exists) {
                return prev.filter(t => getTechId(t) !== techId);
            }
            return [...prev, { ...tech, id: techId, name: tech._name }];
        });
    };

    const handleConfirm = () => onConfirm(localSelected);

    // Reference trusts backend's ?departmentId=<id> filter. We only re-filter here
    // as a defensive safety net, plus apply the search box + online-only toggle.
    const wantedDept = (v => v === undefined || v === null ? '' : String(v).trim().toLowerCase())(deptId);

    const filteredTechs = normalizedTechs.filter(t => {
        // Search
        const q = search.trim().toLowerCase();
        if (q) {
            const matchesSearch = t._name.toLowerCase().includes(q) || t._role.toLowerCase().includes(q);
            if (!matchesSearch) return false;
        }
        // Online-only toggle
        if (onlineOnly && !t._isOnline) return false;
        // Dept safety net (only when backend reveals dept info on the tech record)
        if (wantedDept && t._departmentIds.length > 0 && !t._departmentIds.includes(wantedDept)) return false;
        return true;
    });

    return (
        <div className="modal-overlay-modern" onClick={onClose}>
            <div className="modal-container-compact" onClick={e => e.stopPropagation()}>
                {/* Header: Slim and Simple */}
                <div className="modal-header-slim">
                    <div className="header-info-compact">
                        <Users size={20} color="var(--pos-gold)" />
                        <div>
                            <h3 className="modal-title-small">Assign Staff</h3>
                            <p className="modal-subtitle-small">{deptName}</p>
                        </div>
                    </div>
                    <button className="close-btn-minimal" onClick={onClose}><X size={18} /></button>
                </div>

                <div className="modal-body-compact">
                    {/* Search + Online filter */}
                    <div className="search-row-with-filter">
                        <div className="search-box-minimal" style={{ flex: 1, marginBottom: 0 }}>
                            <Search size={16} />
                            <input
                                type="text"
                                placeholder="Search name or role..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <button
                            type="button"
                            className={`online-toggle-btn ${onlineOnly ? 'active' : ''}`}
                            onClick={() => setOnlineOnly(v => !v)}
                            title="Only show technicians currently online"
                        >
                            <span className={`online-dot ${onlineOnly ? 'on' : ''}`} />
                            Online only
                        </button>
                    </div>

                    <div className="tech-list-slim custom-scrollbar" style={{ marginTop: 12 }}>
                        {loading ? (
                            <div className="compact-loading">
                                <RefreshCw size={24} className="animate-spin" color="var(--pos-gold)" />
                            </div>
                        ) : error ? (
                            <div className="compact-error">{error}</div>
                        ) : filteredTechs.length === 0 ? (
                            <div className="compact-empty">No personnel found</div>
                        ) : (
                            filteredTechs.map(t => {
                                const empId = t._id;
                                const isSel = localSelected.some(st => getTechId(st) === empId);

                                // Optimistic slot display: if the cashier is about to add
                                // this tech to a job where they weren't before, bump +1. If
                                // removing a tech that was on the job before, show −1.
                                const wasInBackend = (job.technicians || []).some(bt => getTechId(bt) === empId);
                                let displayUsedSlots = t._slotsUsed;
                                if (isSel && !wasInBackend) displayUsedSlots += 1;
                                if (!isSel && wasInBackend) displayUsedSlots = Math.max(0, displayUsedSlots - 1);

                                const isFull = displayUsedSlots >= t._totalSlots;
                                const canPick = isPickableForNewSelection(t);
                                // Blocked = can't start a new selection. Already-selected always interactive (to allow deselect).
                                const blocked = !isSel && !canPick;

                                const statusDotClass = !t._isOnline
                                    ? 'offline'
                                    : (isFull ? 'busy' : 'online');

                                return (
                                    <div
                                        key={empId || Math.random()}
                                        className={`tech-row-slim ${isSel ? 'selected' : ''} ${blocked ? 'blocked' : ''}`}
                                        onClick={() => empId && handleToggleTech(t)}
                                        title={blocked
                                            ? (!t._assignable
                                                ? 'Technician is offline / unavailable'
                                                : `All ${t._totalSlots} slots in use`)
                                            : undefined}
                                    >
                                        <div className="tech-avatar-slim">
                                            <div className="avatar-initial">
                                                {t._name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className={`tech-status-dot-minimal ${statusDotClass}`} />
                                        </div>

                                        <div className="tech-details-slim">
                                            <span className="tech-name-slim">{t._name}</span>
                                            <span className="tech-role-slim">
                                                {t._isOnline
                                                    ? (t._role || 'Online')
                                                    : `Last seen: ${formatLastSeen(t._lastSeenAt)}`}
                                            </span>
                                        </div>

                                        <div className="tech-meta-slim">
                                            <div className={`slot-badge ${isFull ? 'full' : ''}`}>
                                                {displayUsedSlots}/{t._totalSlots}
                                            </div>
                                            {isSel && <div className="check-box-minimal"><Check size={14} /></div>}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Footer: Compact and functional */}
                <div className="modal-footer-compact">
                    <div className="selection-stats-minimal">
                        <span className="count-label">{localSelected.length} Selected</span>
                        {localSelected.length > 0 && (
                            <button className="btn-reset-minimal" onClick={() => setLocalSelected([])}>Clear</button>
                        )}
                    </div>
                    <div className="footer-btns-compact">
                        <button className="btn-cancel-minimal" onClick={onClose}>Cancel</button>
                        <button 
                            className="btn-save-minimal" 
                            onClick={handleConfirm} 
                            disabled={parentLoading}
                        >
                            {parentLoading ? '...' : 'Assign'}
                        </button>
                    </div>
                </div>
            </div>
            
            <style>{`
                .search-row-with-filter {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .online-toggle-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 12px;
                    border-radius: 12px;
                    border: 1.5px solid #e2e8f0;
                    background: #fff;
                    font-size: 0.75rem;
                    font-weight: 800;
                    color: #64748b;
                    cursor: pointer;
                    transition: all 0.15s;
                    white-space: nowrap;
                    font-family: inherit;
                }
                .online-toggle-btn:hover { border-color: #cbd5e1; }
                .online-toggle-btn.active {
                    background: #ecfdf5;
                    border-color: #10b981;
                    color: #047857;
                }
                .online-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: #94a3b8;
                    box-shadow: 0 0 0 2px #fff, 0 0 0 3px #e2e8f0;
                }
                .online-dot.on {
                    background: #10b981;
                    box-shadow: 0 0 0 2px #fff, 0 0 0 3px #10b981, 0 0 8px #10b981;
                }

                .search-box-minimal {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    background: #f1f5f9;
                    border-radius: 12px;
                    padding: 8px 14px;
                    margin-bottom: 12px;
                    color: #94a3b8;
                }
                .search-box-minimal input {
                    background: none;
                    border: none;
                    outline: none;
                    width: 100%;
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: #1e293b;
                }

                .tech-list-slim {
                    max-height: 380px;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .tech-row-slim {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 10px 12px;
                    border-radius: 14px;
                    cursor: pointer;
                    transition: all 0.15s;
                    border: 1.5px solid transparent;
                }
                .tech-row-slim:hover {
                    background: #f8fafc;
                }
                .tech-row-slim.selected {
                    background: #fff9ec;
                    border-color: #fcc247;
                }
                .tech-row-slim.blocked {
                    opacity: 0.45;
                    cursor: not-allowed;
                    filter: grayscale(0.3);
                }
                .tech-row-slim.blocked:hover {
                    background: transparent;
                }

                .tech-avatar-slim {
                    position: relative;
                    flex-shrink: 0;
                    width: 36px;
                    height: 36px;
                }
                .avatar-initial {
                    width: 36px;
                    height: 36px;
                    border-radius: 10px;
                    background: #f1f5f9;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 900;
                    font-size: 0.9rem;
                    color: #64748b;
                }
                .selected .avatar-initial {
                    background: #fcc247;
                    color: #1e293b;
                }
                .tech-status-dot-minimal {
                    position: absolute;
                    bottom: -1px;
                    right: -1px;
                    width: 11px;
                    height: 11px;
                    border-radius: 50%;
                    border: 2px solid #fff;
                    z-index: 2;
                }
                .tech-status-dot-minimal.online { background: #10b981; }
                .tech-status-dot-minimal.busy { background: #f97316; }
                .tech-status-dot-minimal.offline { background: #94a3b8; }

                .tech-details-slim {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                }
                .tech-name-slim {
                    font-size: 0.85rem;
                    font-weight: 800;
                    color: #1e293b;
                }
                .tech-role-slim {
                    font-size: 0.7rem;
                    font-weight: 600;
                    color: #94a3b8;
                }

                .tech-meta-slim {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .slot-badge {
                    font-size: 0.7rem;
                    font-weight: 800;
                    color: #047857;
                    background: #dcfce7;
                    padding: 2px 6px;
                    border-radius: 6px;
                }
                .slot-badge.full {
                    color: #b91c1c;
                    background: #fee2e2;
                }
                .check-box-minimal {
                    width: 20px;
                    height: 20px;
                    border-radius: 6px;
                    background: #fcc247;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #1e293b;
                }

                .selection-stats-minimal {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .count-label {
                    font-size: 0.75rem;
                    font-weight: 800;
                    color: #64748b;
                }
                .btn-reset-minimal {
                    background: none;
                    border: none;
                    color: #ef4444;
                    font-size: 0.7rem;
                    font-weight: 800;
                    cursor: pointer;
                    padding: 2px 4px;
                }

                .footer-btns-compact {
                    display: flex;
                    gap: 8px;
                }

                .compact-loading, .compact-error, .compact-empty {
                    padding: 40px 0;
                    text-align: center;
                    font-size: 0.8rem;
                    font-weight: 700;
                    color: #94a3b8;
                }
            `}</style>
        </div>
    );
}


