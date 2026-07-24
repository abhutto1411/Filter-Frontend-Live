import { useEffect, useState } from 'react';
import {
    Loader, AlertCircle, Check, X, FileText, Download, ExternalLink, MapPin,
} from 'lucide-react';
import ApprovalShell from '../../components/admin/ApprovalShell';
import { details } from '../../services/approvalsApi';

/* ---------------------------------------------------------------- */
/*  Formatters                                                       */
/* ---------------------------------------------------------------- */

const NA = '—';

function fmtDate(value) {
    if (value === null || value === undefined || value === '') {
        return { text: NA, iso: null };
    }
    const d = new Date(value);
    if (isNaN(d)) return { text: String(value), iso: null };
    return {
        text: d.toLocaleString('en-US', {
            month: 'short', day: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        }),
        iso: d.toISOString(),
    };
}

function fmtDecimal(value, digits = 2) {
    if (value === null || value === undefined || value === '') return NA;
    const n = Number(value);
    if (isNaN(n)) return String(value);
    return n.toFixed(digits);
}

function fmtMoney(value, currency = 'SAR') {
    if (value === null || value === undefined || value === '') return NA;
    const n = Number(value);
    if (isNaN(n)) return String(value);
    return `${currency} ${n.toFixed(2)}`;
}

function fmtPct(value) {
    if (value === null || value === undefined || value === '') return NA;
    const n = Number(value);
    if (isNaN(n)) return String(value);
    return `${n.toFixed(2)}%`;
}

function isImageUrl(url) {
    return /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(url);
}

/* ---------------------------------------------------------------- */
/*  Generic UI primitives                                            */
/* ---------------------------------------------------------------- */

function Field({ label, value, kind, span2 = false }) {
    const isEmpty = value === null || value === undefined || value === '';
    let display;
    let title;
    let mono = false;

    if (isEmpty) {
        display = NA;
    } else if (kind === 'date') {
        const { text, iso } = fmtDate(value);
        display = text;
        title = iso || undefined;
    } else if (kind === 'bool') {
        display = value ? 'Yes' : 'No';
    } else if (kind === 'money') {
        display = fmtMoney(value);
    } else if (kind === 'pct') {
        display = fmtPct(value);
    } else if (kind === 'decimal') {
        display = fmtDecimal(value);
    } else if (kind === 'id') {
        display = String(value);
        mono = true;
    } else {
        display = String(value);
    }

    return (
        <div className={`approval-field ${span2 ? 'span-2' : ''}`}>
            <span className="approval-field-label">{label}</span>
            <span
                className={
                    `approval-field-value${isEmpty ? ' muted' : ''}${mono ? ' mono' : ''}`
                }
                title={title}
            >
                {display}
            </span>
        </div>
    );
}

function Section({ title, count, children, empty }) {
    return (
        <div className="approval-section">
            <div className="approval-section-head">
                <h4 className="approval-section-title">
                    {title}
                    {typeof count === 'number' && (
                        <span className="approval-section-count"> ({count})</span>
                    )}
                </h4>
            </div>
            <div className="approval-section-body">
                {empty ? <p className="approval-empty-line">{empty}</p> : children}
            </div>
        </div>
    );
}

function Subgroup({ title, count, children, empty }) {
    return (
        <div className="approval-subgroup">
            <h5 className="approval-subgroup-title">
                {title}
                {typeof count === 'number' && (
                    <span className="approval-section-count"> ({count})</span>
                )}
            </h5>
            {empty ? <p className="approval-empty-line">{empty}</p> : children}
        </div>
    );
}

function KVGrid({ children }) {
    return <div className="approval-fields-grid">{children}</div>;
}

function GpsField({ lat, lng }) {
    const isEmpty = lat === null || lat === undefined || lng === null || lng === undefined;
    const coords = isEmpty ? NA : `${lat}, ${lng}`;
    const url = isEmpty
        ? null
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
    return (
        <div className="approval-field">
            <span className="approval-field-label">GPS</span>
            <span className={`approval-field-value${isEmpty ? ' muted' : ''}`}>
                {coords}
                {url && (
                    <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="approval-doc-link approval-gps-link"
                    >
                        <MapPin size={12} /> Open in Maps
                    </a>
                )}
            </span>
        </div>
    );
}

function DocumentCard({ label, url }) {
    const has = !!url;
    return (
        <div className="approval-doc-card">
            {has ? (
                isImageUrl(url) ? (
                    <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="approval-doc-thumb"
                    >
                        <img src={url} alt={label} className="approval-doc-image" />
                    </a>
                ) : (
                    <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="approval-doc-thumb file"
                    >
                        <FileText size={32} />
                    </a>
                )
            ) : (
                <div className="approval-doc-thumb file empty">
                    <FileText size={32} />
                </div>
            )}
            <div className="approval-doc-meta">
                <span className="approval-doc-label">{label}</span>
                {has ? (
                    <div className="approval-doc-actions">
                        <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="approval-doc-link"
                        >
                            <ExternalLink size={12} /> Open
                        </a>
                        <a href={url} download className="approval-doc-link subtle">
                            <Download size={12} /> Download
                        </a>
                    </div>
                ) : (
                    <span className="approval-doc-empty">Not provided</span>
                )}
            </div>
        </div>
    );
}

/* ---------------------------------------------------------------- */
/*  Reusable tables                                                  */
/* ---------------------------------------------------------------- */

function UsersTable({ rows }) {
    if (!rows || rows.length === 0) {
        return <p className="approval-empty-line">No users.</p>;
    }
    return (
        <div className="approval-table-wrapper">
            <table className="approval-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Mobile</th>
                        <th>Type</th>
                        <th>Active</th>
                        <th>Approval</th>
                        <th>Created</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((u, idx) => {
                        const created = fmtDate(u?.createdAt);
                        return (
                            <tr key={u?.id != null ? String(u.id) : `u-${idx}`}>
                                <td className="mono">{u?.id != null ? String(u.id) : NA}</td>
                                <td>{u?.name || NA}</td>
                                <td>{u?.email || NA}</td>
                                <td>{u?.mobile || NA}</td>
                                <td>{u?.userType || NA}</td>
                                <td>
                                    {u?.isActive == null
                                        ? NA
                                        : (u.isActive ? 'Yes' : 'No')}
                                </td>
                                <td>
                                    {u?.approvalStatus ? (
                                        <span className={`approval-status-badge status-${u.approvalStatus}`}>
                                            {u.approvalStatus}
                                        </span>
                                    ) : NA}
                                </td>
                                <td title={created.iso || undefined}>{created.text}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function ApprovalHistoryTable({ rows }) {
    if (!rows || rows.length === 0) {
        return <p className="approval-empty-line">No approval history.</p>;
    }
    return (
        <div className="approval-table-wrapper">
            <table className="approval-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Submitted At</th>
                        <th>Submitted By</th>
                        <th>Status</th>
                        <th>Reviewed At</th>
                        <th>Reviewer ID</th>
                        <th>Rejection Reason</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r, idx) => {
                        const sub = fmtDate(r?.submittedAt);
                        const rev = fmtDate(r?.reviewedAt);
                        const status = r?.status || 'pending';
                        return (
                            <tr key={r?.id != null ? String(r.id) : `h-${idx}`}>
                                <td className="mono">{r?.id != null ? String(r.id) : NA}</td>
                                <td title={sub.iso || undefined}>{sub.text}</td>
                                <td>{r?.submittedByName || NA}</td>
                                <td>
                                    <span className={`approval-status-badge status-${status}`}>
                                        {status}
                                    </span>
                                </td>
                                <td title={rev.iso || undefined}>{rev.text}</td>
                                <td className="mono">
                                    {r?.reviewedByUserId != null ? String(r.reviewedByUserId) : NA}
                                </td>
                                <td>{r?.rejectionReason || NA}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

/* ---------------------------------------------------------------- */
/*  Per-entity bodies                                                */
/* ---------------------------------------------------------------- */

function WorkshopBody({ data }) {
    const w = data || {};
    const users = Array.isArray(w.users) ? w.users : [];
    const signupUser = w.signupUser ?? users[0] ?? null;
    const history = Array.isArray(w.workshopApprovalRequests) ? w.workshopApprovalRequests : [];

    return (
        <>
            <Section title="Approve outcome (backend)">
                <p className="approval-empty-line" style={{ marginBottom: 0 }}>
                    When you approve this request, the signup user stays active and is linked to the workshop’s{' '}
                    <strong>workshop_admin</strong> role (created if missing; permissions copied from the workshop’s
                    manager role when possible). They sign in with <code>POST /auth/workshop/login</code> like other
                    workshop portal users — not a separate branch account. Branches remain data scope inside that
                    session.
                </p>
            </Section>
            <Section title="Workshop Information">
                <KVGrid>
                    <Field label="ID" kind="id" value={w.id} />
                    <Field label="Name" value={w.name} />
                    <Field label="Workshop Code" value={w.workshopCode} />
                    <Field label="Owner Name" value={w.ownerName} />
                    <Field label="Mobile" value={w.mobile} />
                    <Field label="Email" value={w.email} />
                    <Field label="Tax ID" value={w.taxId} />
                    <Field label="CR Number" value={w.crNumber} />
                    <Field label="Address" value={w.address} span2 />
                    <GpsField lat={w.gpsLat} lng={w.gpsLng} />
                    <Field label="Currency Code" value={w.currencyCode} />
                    <Field label="VAT Percent" kind="pct" value={w.vatPercent} />
                    <Field label="VAT Inclusive Default" kind="bool" value={w.vatInclusiveDefault} />
                    <Field label="Status" value={w.status} />
                    <Field label="Created At" kind="date" value={w.createdAt} />
                </KVGrid>
            </Section>

            <Section
                title="Signup User"
                empty={!signupUser ? 'No signup user.' : undefined}
            >
                {signupUser && (
                    <KVGrid>
                        <Field label="ID" kind="id" value={signupUser.id} />
                        <Field label="Name" value={signupUser.name} />
                        <Field label="Email" value={signupUser.email} />
                        <Field label="Mobile" value={signupUser.mobile} />
                        <Field label="User Type" value={signupUser.userType} />
                        <Field label="Active" kind="bool" value={signupUser.isActive} />
                        <Field label="Approval Status" value={signupUser.approvalStatus} />
                        <Field label="Approval Requested At" kind="date" value={signupUser.approvalRequestedAt} />
                        <Field label="Approval Reviewed At" kind="date" value={signupUser.approvalReviewedAt} />
                        <Field label="Rejection Reason" value={signupUser.approvalRejectedReason} span2 />
                        <Field label="Created At" kind="date" value={signupUser.createdAt} />
                    </KVGrid>
                )}
            </Section>

            <Section title="All Workshop Users" count={users.length}>
                <UsersTable rows={users} />
            </Section>

            <Section title="Approval History" count={history.length}>
                <ApprovalHistoryTable rows={history} />
            </Section>
        </>
    );
}

function SupplierBody({ data }) {
    const s = data || {};
    const reviewer = s.reviewedByUser || s.reviewer || null;
    return (
        <>
            <Section title="Company">
                <KVGrid>
                    <Field label="ID" kind="id" value={s.id} />
                    <Field label="Company Name" value={s.companyName} />
                    <Field label="Registration Type" value={s.registrationType} />
                    <Field label="Internal Warehouse" kind="bool" value={s.isInternalWarehouse} />
                    <Field label="Status" value={s.status} />
                    <Field label="Created At" kind="date" value={s.createdAt} />
                </KVGrid>
            </Section>

            <Section title="Legal / Tax">
                <KVGrid>
                    <Field label="Trade License No" value={s.tradeLicenseNo} />
                    <Field label="VAT ID" value={s.vatId} />
                </KVGrid>
            </Section>

            <Section title="Contact">
                <KVGrid>
                    <Field label="Contact Person" value={s.contactPerson} />
                    <Field label="Mobile" value={s.mobile} />
                    <Field label="Email" value={s.email} />
                </KVGrid>
            </Section>

            <Section title="Address">
                <KVGrid>
                    <Field label="Street" value={s.street} span2 />
                    <Field label="City / District" value={s.cityDistrict} />
                    <GpsField lat={s.gpsLat} lng={s.gpsLng} />
                </KVGrid>
            </Section>

            <Section title="Banking">
                <KVGrid>
                    <Field label="IBAN" value={s.iban} />
                    <Field label="Bank Name" value={s.bankName} />
                </KVGrid>
            </Section>

            <Section title="Documents">
                <div className="approval-docs-grid">
                    <DocumentCard label="Trade License" url={s.tradeLicenseUrl} />
                    <DocumentCard label="VAT Certificate" url={s.vatCertificateUrl} />
                    <DocumentCard label="Logo" url={s.logoUrl} />
                </div>
            </Section>

            <Section title="Review">
                <KVGrid>
                    <Field label="Rejection Reason" value={s.rejectionReason} span2 />
                    <Field label="Reviewed At" kind="date" value={s.reviewedAt} />
                </KVGrid>
                <Subgroup title="Reviewed By User" empty={!reviewer ? 'Not yet reviewed.' : undefined}>
                    {reviewer && (
                        <KVGrid>
                            <Field label="ID" kind="id" value={reviewer.id} />
                            <Field label="Name" value={reviewer.name} />
                            <Field label="Email" value={reviewer.email} />
                            <Field label="Mobile" value={reviewer.mobile} />
                        </KVGrid>
                    )}
                </Subgroup>
            </Section>
        </>
    );
}

function CorporateBody({ data }) {
    const r = data || {};
    const reviewer = r.reviewedByUser || null;
    const ca = r.corporateAccount || {};
    const customer = ca.customer || null;
    const referral = ca.referralModel || null;
    const profiles = Array.isArray(ca.corporateUserProfiles) ? ca.corporateUserProfiles : [];
    const linkedUsers = profiles.map((p) => p?.user).filter(Boolean);
    const branches = Array.isArray(ca.selectedBranchIds) ? ca.selectedBranchIds : [];

    return (
        <>
            <Section title="Request">
                <KVGrid>
                    <Field label="ID" kind="id" value={r.id} />
                    <Field label="Status" value={r.status} />
                    <Field label="Submitted At" kind="date" value={r.submittedAt} />
                    <Field label="Reviewed At" kind="date" value={r.reviewedAt} />
                    <Field label="Rejection Reason" value={r.rejectionReason} span2 />
                </KVGrid>
                <Subgroup title="Reviewed By User" empty={!reviewer ? 'Not yet reviewed.' : undefined}>
                    {reviewer && (
                        <KVGrid>
                            <Field label="ID" kind="id" value={reviewer.id} />
                            <Field label="Name" value={reviewer.name} />
                            <Field label="Email" value={reviewer.email} />
                            <Field label="Mobile" value={reviewer.mobile} />
                        </KVGrid>
                    )}
                </Subgroup>
            </Section>

            <Section title="Corporate Account">
                <KVGrid>
                    <Field label="ID" kind="id" value={ca.id} />
                    <Field label="Company Name" value={ca.companyName} />
                    <Field label="Contact Person" value={ca.contactPerson} />
                    <Field label="Address" value={ca.address} span2 />
                    <Field label="Credit Limit" kind="money" value={ca.creditLimit} />
                    <Field label="Due Balance" kind="money" value={ca.dueBalance} />
                    <Field label="Status" value={ca.status} />
                    <Field label="Referral ID" kind="id" value={ca.referralId} />
                    <Field label="Created At" kind="date" value={ca.createdAt} />
                </KVGrid>
                <Subgroup title="Workshop">
                    <KVGrid>
                        <Field label="ID" kind="id" value={ca.workshop?.id} />
                        <Field label="Name" value={ca.workshop?.name} />
                    </KVGrid>
                </Subgroup>
                <Subgroup
                    title="Selected Branches"
                    count={branches.length}
                    empty={branches.length === 0 ? 'No branches selected.' : undefined}
                >
                    {branches.length > 0 && (
                        <div className="approval-chip-list">
                            {branches.map((bid) => (
                                <span key={String(bid)} className="approval-chip">
                                    <span className="approval-chip-value mono">{String(bid)}</span>
                                </span>
                            ))}
                        </div>
                    )}
                </Subgroup>
            </Section>

            <Section title="Customer" empty={!customer ? 'No linked customer.' : undefined}>
                {customer && (
                    <KVGrid>
                        <Field label="ID" kind="id" value={customer.id} />
                        <Field label="Name" value={customer.name} />
                        <Field label="VAT (Tax ID)" value={customer.taxId} />
                        <Field label="Mobile" value={customer.mobile} />
                        <Field label="Customer Type" value={customer.customerType} />
                    </KVGrid>
                )}
            </Section>

            <Section title="Referral" empty={!referral ? 'No referral attached.' : undefined}>
                {referral && (
                    <KVGrid>
                        <Field label="ID" kind="id" value={referral.id} />
                        <Field label="Category" value={referral.category} />
                        <Field label="Full Name" value={referral.fullName} />
                        <Field label="Mobile" value={referral.mobile} />
                        <Field label="Email" value={referral.email} />
                        <Field label="Portal Email" value={referral.portalEmail} />
                        <Field label="National ID" value={referral.nationalId} />
                        <Field label="Bank Name" value={referral.bankName} />
                        <Field label="Bank IBAN" value={referral.bankIban} />
                        <Field label="Address" value={referral.address} span2 />
                        <Field label="Status" value={referral.status} />
                    </KVGrid>
                )}
            </Section>

            <Section title="Linked Users" count={linkedUsers.length}>
                {linkedUsers.length === 0 ? (
                    <p className="approval-empty-line">No linked users.</p>
                ) : (
                    <div className="approval-cards-stack">
                        {linkedUsers.map((u, idx) => (
                            <div
                                className="approval-subgroup approval-subgroup-card"
                                key={u?.id != null ? String(u.id) : `lu-${idx}`}
                            >
                                <KVGrid>
                                    <Field label="ID" kind="id" value={u.id} />
                                    <Field label="Name" value={u.name} />
                                    <Field label="Email" value={u.email} />
                                    <Field label="Mobile" value={u.mobile} />
                                    <Field label="User Type" value={u.userType} />
                                    <Field label="Active" kind="bool" value={u.isActive} />
                                    <Field label="Approval Status" value={u.approvalStatus} />
                                    <Field label="Approval Requested At" kind="date" value={u.approvalRequestedAt} />
                                    <Field label="Approval Reviewed At" kind="date" value={u.approvalReviewedAt} />
                                    <Field label="Rejection Reason" value={u.approvalRejectedReason} span2 />
                                    <Field label="Created At" kind="date" value={u.createdAt} />
                                </KVGrid>
                            </div>
                        ))}
                    </div>
                )}
            </Section>
        </>
    );
}

function BranchCreationBody({ data }) {
    const r = data || {};
    const b = r.branch ?? r;
    const w = r.workshop ?? b.workshop ?? null;
    const reviewer = r.approvalReviewedBy ?? r.reviewedByUser ?? null;

    return (
        <>
            <Section title="Branch">
                <KVGrid>
                    <Field label="ID" kind="id" value={b.id} />
                    <Field label="Name" value={b.name} />
                    <Field label="Branch Code" value={b.branchCode ?? b.code} />
                    <Field label="Address" value={b.address} span2 />
                    <Field label="Phone" value={b.phone} />
                    <Field label="Email" value={b.email} />
                    <Field label="Approval Status" value={b.approvalStatus ?? r.approvalStatus} />
                    <Field label="Approval Requested At" kind="date" value={b.approvalRequestedAt ?? r.approvalRequestedAt} />
                    <Field label="Active" kind="bool" value={b.isActive} />
                    <Field label="Created At" kind="date" value={b.createdAt} />
                </KVGrid>
            </Section>

            <Section title="Workshop" empty={!w ? 'No workshop linked.' : undefined}>
                {w && (
                    <KVGrid>
                        <Field label="ID" kind="id" value={w.id} />
                        <Field label="Name" value={w.name} />
                        <Field label="Status" value={w.status} />
                    </KVGrid>
                )}
            </Section>

            <Section title="Review">
                <KVGrid>
                    <Field label="Rejection Reason" value={r.rejectionReason ?? r.approvalRejectedReason} span2 />
                    <Field label="Reviewed At" kind="date" value={r.reviewedAt ?? r.approvalReviewedAt} />
                </KVGrid>
                <Subgroup title="Reviewed By User" empty={!reviewer ? 'Not yet reviewed.' : undefined}>
                    {reviewer && (
                        <KVGrid>
                            <Field label="ID" kind="id" value={reviewer.id} />
                            <Field label="Name" value={reviewer.name} />
                            <Field label="Email" value={reviewer.email} />
                            <Field label="Mobile" value={reviewer.mobile} />
                        </KVGrid>
                    )}
                </Subgroup>
            </Section>
        </>
    );
}

function CashierRegistrationBody({ data }) {
    const r = data || {};
    const u = r.user ?? r;
    const workshop = r.workshop ?? u.workshop ?? null;
    const branch = r.branch ?? u.branch ?? null;
    const employees = Array.isArray(u.employees) ? u.employees : [];
    const emp = employees[0] ?? r.employee ?? null;
    const reviewer = r.approvalReviewedBy ?? r.reviewedByUser ?? null;

    return (
        <>
            <Section title="User (cashier)">
                <KVGrid>
                    <Field label="ID" kind="id" value={u.id} />
                    <Field label="Name" value={u.name} />
                    <Field label="Email" value={u.email} />
                    <Field label="Mobile" value={u.mobile} />
                    <Field label="User Type" value={u.userType} />
                    <Field label="Active" kind="bool" value={u.isActive} />
                    <Field label="Approval Status" value={u.approvalStatus} />
                    <Field label="Approval Requested At" kind="date" value={u.approvalRequestedAt} />
                    <Field label="Approval Reviewed At" kind="date" value={u.approvalReviewedAt} />
                    <Field label="Rejection Reason" value={u.approvalRejectedReason} span2 />
                    <Field label="Created At" kind="date" value={u.createdAt} />
                </KVGrid>
            </Section>

            <Section title="Workshop" empty={!workshop ? 'No workshop linked.' : undefined}>
                {workshop && (
                    <KVGrid>
                        <Field label="ID" kind="id" value={workshop.id} />
                        <Field label="Name" value={workshop.name} />
                        <Field label="Status" value={workshop.status} />
                    </KVGrid>
                )}
            </Section>

            <Section title="Branch" empty={!branch ? 'No branch linked.' : undefined}>
                {branch && (
                    <KVGrid>
                        <Field label="ID" kind="id" value={branch.id} />
                        <Field label="Name" value={branch.name} />
                        <Field label="Branch Code" value={branch.branchCode} />
                        <Field label="Approval Status" value={branch.approvalStatus} />
                    </KVGrid>
                )}
            </Section>

            <Section title="Employee profile" empty={!emp ? 'No employee row attached.' : undefined}>
                {emp && (
                    <KVGrid>
                        <Field label="ID" kind="id" value={emp.id} />
                        <Field label="Employee Type" value={emp.employeeType} />
                        <Field label="Active" kind="bool" value={emp.isActive} />
                        <Field label="Branch ID" kind="id" value={emp.branchId} />
                    </KVGrid>
                )}
            </Section>

            <Section title="Reviewer" empty={!reviewer ? 'Not yet reviewed.' : undefined}>
                {reviewer && (
                    <KVGrid>
                        <Field label="ID" kind="id" value={reviewer.id} />
                        <Field label="Name" value={reviewer.name} />
                        <Field label="Email" value={reviewer.email} />
                        <Field label="Mobile" value={reviewer.mobile} />
                    </KVGrid>
                )}
            </Section>
        </>
    );
}

function WorkshopPortalStaffRegistrationBody({ data }) {
    const r = data || {};
    const u = r.user ?? r;
    const workshop = r.workshop ?? u.workshop ?? null;
    const branch = r.branch ?? u.branch ?? null;
    const employees = Array.isArray(u.employees) ? u.employees : [];
    const emp = employees[0] ?? r.employee ?? null;
    const reviewer = r.approvalReviewedBy ?? r.reviewedByUser ?? null;
    const tlDept =
        r.meta?.teamLeaderDepartment ??
        r.meta?.team_leader_department ??
        r.teamLeaderDepartment ??
        r.team_leader_department ??
        null;

    return (
        <>
            <Section title="Overview">
                <p className="approval-empty-line" style={{ marginBottom: 0 }}>
                    After approval, this user signs in with the same workshop portal login as owners/admins{' '}
                    (<code>POST /auth/workshop/login</code>), <code>userType: workshop_user</code>, with{' '}
                    <code>workshopStaffRole</code> set for UI permissions.
                </p>
            </Section>
            <Section title="User (portal staff)">
                <KVGrid>
                    <Field label="ID" kind="id" value={u.id} />
                    <Field label="Workshop staff role" value={u.workshopStaffRole ?? u.workshop_staff_role} />
                    <Field
                        label="Team leader department ID"
                        kind="id"
                        value={u.teamLeaderDepartmentId ?? u.team_leader_department_id}
                    />
                    <Field label="Name" value={u.name} />
                    <Field label="Email" value={u.email} />
                    <Field label="Mobile" value={u.mobile} />
                    <Field label="User Type" value={u.userType} />
                    <Field label="Active" kind="bool" value={u.isActive} />
                    <Field label="Approval Status" value={u.approvalStatus} />
                    <Field label="Approval Requested At" kind="date" value={u.approvalRequestedAt} />
                    <Field label="Approval Reviewed At" kind="date" value={u.approvalReviewedAt} />
                    <Field label="Rejection Reason" value={u.approvalRejectedReason} span2 />
                    <Field label="Created At" kind="date" value={u.createdAt} />
                </KVGrid>
            </Section>

            <Section title="Workshop" empty={!workshop ? 'No workshop linked.' : undefined}>
                {workshop && (
                    <KVGrid>
                        <Field label="ID" kind="id" value={workshop.id} />
                        <Field label="Name" value={workshop.name} />
                        <Field label="Status" value={workshop.status} />
                    </KVGrid>
                )}
            </Section>

            <Section title="Branch" empty={!branch ? 'No branch linked.' : undefined}>
                {branch && (
                    <KVGrid>
                        <Field label="ID" kind="id" value={branch.id} />
                        <Field label="Name" value={branch.name} />
                        <Field label="Branch Code" value={branch.branchCode} />
                        <Field label="Approval Status" value={branch.approvalStatus} />
                    </KVGrid>
                )}
            </Section>

            <Section
                title="Team leader department"
                empty={
                    tlDept && (tlDept.id != null || tlDept.name)
                        ? undefined
                        : 'Not set (only team leaders have a linked department on the user row).'
                }
            >
                {tlDept && (tlDept.id != null || tlDept.name) && (
                    <KVGrid>
                        <Field label="ID" kind="id" value={tlDept.id} />
                        <Field label="Name" value={tlDept.name} />
                    </KVGrid>
                )}
            </Section>

            <Section title="Employee profile" empty={!emp ? 'No employee row attached.' : undefined}>
                {emp && (
                    <KVGrid>
                        <Field label="ID" kind="id" value={emp.id} />
                        <Field label="Employee Type" value={emp.employeeType} />
                        <Field label="Active" kind="bool" value={emp.isActive} />
                        <Field label="Branch ID" kind="id" value={emp.branchId} />
                    </KVGrid>
                )}
            </Section>

            <Section title="Reviewer" empty={!reviewer ? 'Not yet reviewed.' : undefined}>
                {reviewer && (
                    <KVGrid>
                        <Field label="ID" kind="id" value={reviewer.id} />
                        <Field label="Name" value={reviewer.name} />
                        <Field label="Email" value={reviewer.email} />
                        <Field label="Mobile" value={reviewer.mobile} />
                    </KVGrid>
                )}
            </Section>
        </>
    );
}

function TechnicianBody({ data }) {
    const u = data || {};
    const employees = Array.isArray(u.employees) ? u.employees : [];
    const emp = employees[0] || null;
    const departments = Array.isArray(emp?.technicianDepartments)
        ? emp.technicianDepartments.map((td) => td?.department).filter(Boolean)
        : [];
    const liveStatus = emp?.technicianStatus || null;
    const reviewer = u.approvalReviewedBy || null;
    const workshop = u.workshop || null;
    const branch = u.branch || null;

    return (
        <>
            <Section title="User">
                <KVGrid>
                    <Field label="ID" kind="id" value={u.id} />
                    <Field label="Name" value={u.name} />
                    <Field label="Email" value={u.email} />
                    <Field label="Mobile" value={u.mobile} />
                    <Field label="User Type" value={u.userType} />
                    <Field label="Active" kind="bool" value={u.isActive} />
                    <Field label="Approval Status" value={u.approvalStatus} />
                    <Field label="Approval Requested At" kind="date" value={u.approvalRequestedAt} />
                    <Field label="Approval Reviewed At" kind="date" value={u.approvalReviewedAt} />
                    <Field label="Rejection Reason" value={u.approvalRejectedReason} span2 />
                    <Field label="Created At" kind="date" value={u.createdAt} />
                </KVGrid>
            </Section>

            <Section title="Workshop" empty={!workshop ? 'No workshop linked.' : undefined}>
                {workshop && (
                    <KVGrid>
                        <Field label="ID" kind="id" value={workshop.id} />
                        <Field label="Name" value={workshop.name} />
                        <Field label="Email" value={workshop.email} />
                        <Field label="Mobile" value={workshop.mobile} />
                        <Field label="Owner Name" value={workshop.ownerName} />
                        <Field label="Status" value={workshop.status} />
                    </KVGrid>
                )}
            </Section>

            <Section title="Branch" empty={!branch ? 'No branch linked.' : undefined}>
                {branch && (
                    <KVGrid>
                        <Field label="ID" kind="id" value={branch.id} />
                        <Field label="Name" value={branch.name} />
                        <Field label="Branch Code" value={branch.branchCode} />
                        <Field label="Address" value={branch.address} span2 />
                        <Field label="Phone" value={branch.phone} />
                        <Field label="Email" value={branch.email} />
                    </KVGrid>
                )}
            </Section>

            <Section title="Employee Profile" empty={!emp ? 'No employee profile.' : undefined}>
                {emp && (
                    <KVGrid>
                        <Field label="ID" kind="id" value={emp.id} />
                        <Field label="Employee Type" value={emp.employeeType} />
                        <Field label="Technician Type" value={emp.technicianType} />
                        <Field label="Basic Salary" kind="money" value={emp.basicSalary} />
                        <Field label="Commission %" kind="pct" value={emp.commissionPercent} />
                        <Field label="Mobile" value={emp.mobile} />
                        <Field label="Active" kind="bool" value={emp.isActive} />
                        <Field label="Supplier ID" kind="id" value={emp.supplierId} />
                        <Field label="Branch ID" kind="id" value={emp.branchId} />
                    </KVGrid>
                )}
            </Section>

            <Section title="Departments" count={departments.length}>
                {departments.length === 0 ? (
                    <p className="approval-empty-line">No departments.</p>
                ) : (
                    <div className="approval-chip-list">
                        {departments.map((d, idx) => (
                            <span
                                key={d?.id != null ? String(d.id) : `d-${idx}`}
                                className="approval-chip"
                            >
                                <span className="approval-chip-label mono">
                                    #{d?.id != null ? String(d.id) : '?'}
                                </span>
                                <span className="approval-chip-value">{d?.name || NA}</span>
                            </span>
                        ))}
                    </div>
                )}
            </Section>

            <Section title="Live Status" empty={!liveStatus ? 'No live status available.' : undefined}>
                {liveStatus && (
                    <KVGrid>
                        <Field label="Status" value={liveStatus.status} />
                        <Field label="Duty Mode" value={liveStatus.dutyMode} />
                        <Field label="Last Seen At" kind="date" value={liveStatus.lastSeenAt} />
                        <Field label="Branch ID" kind="id" value={liveStatus.branchId} />
                    </KVGrid>
                )}
            </Section>

            <Section title="Reviewer" empty={!reviewer ? 'Not yet reviewed.' : undefined}>
                {reviewer && (
                    <KVGrid>
                        <Field label="ID" kind="id" value={reviewer.id} />
                        <Field label="Name" value={reviewer.name} />
                        <Field label="Email" value={reviewer.email} />
                        <Field label="Mobile" value={reviewer.mobile} />
                    </KVGrid>
                )}
            </Section>
        </>
    );
}

function RawObjectBody({ data }) {
    return (
        <Section title="Raw Object">
            <pre className="approval-raw-json">{JSON.stringify(data, null, 2)}</pre>
        </Section>
    );
}

/** Human-readable status for cashier walk-in corporate quotes (matches backend constants). */
function walkInCorporateStatusLabel(status) {
    const s = String(status || '').toLowerCase().replace(/\s+/g, '_');
    const map = {
        waiting_for_corporate_approval: 'Waiting for corporate approval',
        corporate_approved: 'Corporate approved',
        rejected_by_corporate: 'Rejected by corporate',
        cancelled: 'Cancelled',
        draft: 'Draft',
    };
    return map[s] || String(status || '—').replace(/_/g, ' ');
}

/** Backend uses `waiting for corporate approval` (spaces), not `pending`. */
function isWalkInCorporatePendingDetail(data) {
    const raw = data?.status ?? data?.approvalStatus;
    const s = String(raw || '').toLowerCase().replace(/\s+/g, '_');
    return s === 'waiting_for_corporate_approval';
}

function fmtWalkInDiscount(discountType, discountValue) {
    const t = String(discountType || '').toLowerCase();
    const v = Number(discountValue);
    if (t === 'percentage' || t === 'percent') {
        return `${Number.isFinite(v) ? v : 0}%`;
    }
    return fmtMoney(Number.isFinite(v) ? v : 0);
}

/** Approvals + corporate APIs may use camelCase or snake_case. */
function pickWalkInQuoteTotals(o) {
    const raw = o?.quoteTotals ?? o?.quote_totals;
    if (!raw || typeof raw !== 'object') return null;
    return {
        totalAmount: raw.totalAmount ?? raw.total_amount,
        vatAmount: raw.vatAmount ?? raw.vat_amount,
        pendingDepartmentCount: raw.pendingDepartmentCount ?? raw.pending_department_count,
    };
}

/** Raw Prisma walk-in row (legacy); unified formatter uses `lineItems` + `jobs` + `quoteTotals`. */
function isLegacyWalkInSalesOrderPayload(o) {
    return (
        Array.isArray(o?.salesOrderItems)
        && o.salesOrderItems.length > 0
        && !Array.isArray(o?.lineItems)
    );
}

/** Super-admin queue: walk-in POS corporate quote — same payload shape as GET /corporate/walk-in-orders/:id */
function CorporateWalkInBookingBody({ data }) {
    const o = data || {};
    if (isLegacyWalkInSalesOrderPayload(o)) {
        return <CorporateWalkInBookingBodyLegacy data={o} />;
    }
    return <CorporateWalkInBookingBodyFormatted data={o} />;
}

function CorporateWalkInBookingBodyFormatted({ data: o }) {
    const branch = o.branch || {};
    const vehicle = o.vehicle || {};
    const corp = o.corporateAccount || {};
    const approver = o.corporateWalkInApprovedByUser || null;
    const lineItems = Array.isArray(o.lineItems) ? o.lineItems : [];
    const jobs = Array.isArray(o.jobs) ? o.jobs : [];
    const timeline = Array.isArray(o.timeline) ? o.timeline : [];
    const qt = pickWalkInQuoteTotals(o);
    const posPayments = Array.isArray(o.posPayments) ? o.posPayments : [];
    const inv = o.invoice && typeof o.invoice === 'object' ? o.invoice : null;

    return (
        <>
            <Section title="Walk-in corporate quote">
                <KVGrid>
                    <Field label="Sales order ID" kind="id" value={o.id} />
                    <Field label="Workshop ID" kind="id" value={o.workshopId} />
                    <Field label="Branch ID" kind="id" value={o.branchId} />
                    <Field label="Status" value={walkInCorporateStatusLabel(o.status)} />
                    {o.approvalStatusLabel ? (
                        <Field label="Approval label" value={o.approvalStatusLabel} />
                    ) : null}
                    <Field label="Source" value={o.source} />
                    <Field label="Created" kind="date" value={o.createdAt} />
                    <Field label="Created by (user)" kind="id" value={o.createdByUserId} />
                    <Field label="Order promo" value={o.orderPromoCodeName} />
                    <Field
                        label="Rejection / cancel reason"
                        value={o.corporateApprovalRejectionReason}
                        span2
                    />
                </KVGrid>
            </Section>

            <Section
                title="Payment draft (POS)"
                empty={
                    !o.posCustomerKind && posPayments.length === 0
                        ? 'No POS payment draft stored on this quote.'
                        : undefined
                }
            >
                {(o.posCustomerKind || posPayments.length > 0) && (
                    <>
                        <KVGrid>
                            <Field label="POS customer kind" value={o.posCustomerKind || NA} />
                        </KVGrid>
                        {posPayments.length > 0 ? (
                            <div className="approval-table-wrapper" style={{ marginTop: 10 }}>
                                <table className="approval-table">
                                    <thead>
                                        <tr>
                                            <th>Method</th>
                                            <th style={{ textAlign: 'right' }}>Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {posPayments.map((p, idx) => (
                                            <tr key={`${p.method}-${idx}`}>
                                                <td>{p.method || NA}</td>
                                                <td style={{ textAlign: 'right' }}>{fmtMoney(p.amount)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : null}
                    </>
                )}
            </Section>

            <Section title="Branch">
                <KVGrid>
                    <Field label="ID" kind="id" value={branch.id} />
                    <Field label="Name" value={branch.name ?? o.branchName} />
                    <Field label="Address" value={branch.address} span2 />
                </KVGrid>
            </Section>

            <Section title="Corporate account">
                <KVGrid>
                    <Field label="ID" kind="id" value={corp.id} />
                    <Field label="Company" value={corp.companyName} />
                    <Field label="Customer ID" kind="id" value={corp.customerId} />
                </KVGrid>
            </Section>

            <Section title="Vehicle">
                <KVGrid>
                    <Field label="Plate" value={vehicle.plateNo} />
                    <Field label="Make / model" value={[vehicle.make, vehicle.model].filter(Boolean).join(' ') || NA} />
                </KVGrid>
            </Section>

            <Section title="Corporate approver" empty={!approver ? 'Not approved yet (pending corporate or super admin).' : undefined}>
                {approver && (
                    <KVGrid>
                        <Field label="User ID" kind="id" value={approver.id} />
                        <Field label="Name" value={approver.name} />
                        <Field label="Email" value={approver.email} />
                        <Field label="User type" value={approver.userType} />
                    </KVGrid>
                )}
            </Section>

            <Section title="Line items (all)" count={lineItems.length}>
                {lineItems.length === 0 ? (
                    <p className="approval-empty-line">No line items on this order yet.</p>
                ) : (
                    <div className="approval-table-wrapper">
                        <table className="approval-table">
                            <thead>
                                <tr>
                                    <th>Type</th>
                                    <th>Item</th>
                                    <th>Department</th>
                                    <th>Job</th>
                                    <th>Qty</th>
                                    <th>Unit</th>
                                    <th>Discount</th>
                                    <th>VAT%</th>
                                    <th>Line total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {lineItems.map((line, idx) => (
                                    <tr key={line?.id != null ? String(line.id) : `li-${idx}`}>
                                        <td>{line.itemType || NA}</td>
                                        <td>{line.productName || NA}</td>
                                        <td>{line.departmentName || NA}</td>
                                        <td className="mono">{line.jobId || '—'}</td>
                                        <td>{fmtDecimal(line.qty, 3)}</td>
                                        <td>{fmtMoney(line.unitPrice)}</td>
                                        <td>{fmtWalkInDiscount(line.discountType, line.discountValue)}</td>
                                        <td>{fmtDecimal(line.vatPercent, 2)}</td>
                                        <td>{fmtMoney(line.lineTotal)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Section>

            <Section title="Jobs (per department)" count={jobs.length}>
                {jobs.length === 0 ? (
                    <p className="approval-empty-line">No job rows yet (quote-only flow).</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {jobs.map((j) => {
                            const fin = j.finance && typeof j.finance === 'object' ? j.finance : null;
                            const jItems = Array.isArray(j.items) ? j.items : [];
                            return (
                                <div
                                    key={j.id}
                                    style={{
                                        border: '1px solid var(--color-border-light, #e5e7eb)',
                                        borderRadius: 8,
                                        padding: 12,
                                        background: 'var(--color-bg-muted, #f9fafb)',
                                    }}
                                >
                                    <KVGrid>
                                        <Field label="Job ID" kind="id" value={j.id} />
                                        <Field label="Department" value={j.departmentName} />
                                        <Field label="Status" value={j.status} />
                                        <Field label="Job promo" value={j.promoCodeName} />
                                        <Field label="Job discount type" value={j.totalDiscountType} />
                                        <Field label="Job discount value" kind="money" value={j.totalDiscountValue} />
                                        <Field label="Persisted total" kind="money" value={j.totalAmount} />
                                    </KVGrid>
                                    {fin && (
                                        <Subgroup title="Computed finance (this job)">
                                            <KVGrid>
                                                <Field label="Gross subtotal" kind="money" value={fin.grossSubtotal} />
                                                <Field label="Line discounts" kind="money" value={fin.lineDiscountsTotal} />
                                                <Field label="After line discounts" kind="money" value={fin.afterLineDiscounts} />
                                                <Field label="Job discount" kind="money" value={fin.jobDiscountAmount} />
                                                <Field label="Promo discount" kind="money" value={fin.promoDiscountAmount} />
                                                <Field label="Net before VAT" kind="money" value={fin.netBeforeVat} />
                                                <Field label="VAT" kind="money" value={fin.vatAmount} />
                                                <Field label="Total incl. VAT" kind="money" value={fin.totalInclVat} />
                                            </KVGrid>
                                        </Subgroup>
                                    )}
                                    {jItems.length > 0 && (
                                        <Subgroup title="Lines on this job" count={jItems.length}>
                                            <div className="approval-table-wrapper">
                                                <table className="approval-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Item</th>
                                                            <th>Qty</th>
                                                            <th>Unit</th>
                                                            <th>Discount</th>
                                                            <th>Line total</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {jItems.map((line, idx) => (
                                                            <tr key={line?.id != null ? String(line.id) : `ji-${idx}`}>
                                                                <td>{line.productName || NA}</td>
                                                                <td>{fmtDecimal(line.qty, 3)}</td>
                                                                <td>{fmtMoney(line.unitPrice)}</td>
                                                                <td>{fmtWalkInDiscount(line.discountType, line.discountValue)}</td>
                                                                <td>{fmtMoney(line.lineTotal)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </Subgroup>
                                    )}
                                    <Subgroup
                                        title="Technicians"
                                        empty={
                                            !Array.isArray(j.technicians) || j.technicians.length === 0
                                                ? 'Not assigned'
                                                : undefined
                                        }
                                    >
                                        {Array.isArray(j.technicians) && j.technicians.length > 0 && (
                                            <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.875rem' }}>
                                                {j.technicians.map((t, idx) => (
                                                    <li key={`${t.name}-${idx}`}>
                                                        {t.name}
                                                        {t.assignmentStatus ? ` (${t.assignmentStatus})` : ''}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </Subgroup>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Section>

            <Section title="Invoice" empty={!inv ? 'Not invoiced yet.' : undefined}>
                {inv && (
                    <KVGrid>
                        <Field label="Invoice ID" kind="id" value={inv.id} />
                        <Field label="Invoice #" value={inv.invoiceNo} />
                        <Field label="Total" kind="money" value={inv.totalAmount} />
                        <Field label="Payment status" value={inv.paymentStatus} />
                        <Field label="Invoice date" kind="date" value={inv.invoiceDate} />
                    </KVGrid>
                )}
            </Section>

            <Section title="Timeline" count={timeline.length} empty={timeline.length === 0 ? 'No timeline.' : undefined}>
                {timeline.length > 0 && (
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.875rem' }}>
                        {timeline.map((t, idx) => (
                            <li key={`${t.status}-${idx}`} style={{ marginBottom: 6 }}>
                                <strong>{t.label || t.status || 'Update'}</strong>
                                {t.detail ? ` — ${t.detail}` : ''}
                            </li>
                        ))}
                    </ul>
                )}
            </Section>

            <Section title="Quote totals" empty={!qt ? 'No computed quote totals for this order.' : undefined}>
                {qt && (
                    <div
                        style={{
                            border: '1px solid var(--color-border-light, #e5e7eb)',
                            borderRadius: 10,
                            padding: '16px 18px',
                            background: 'var(--color-bg-muted, #f9fafb)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 12,
                            fontSize: '0.9375rem',
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16 }}>
                            <span style={{ fontWeight: 600, color: 'var(--color-text-muted, #6b7280)' }}>Total (incl. VAT)</span>
                            <span style={{ fontWeight: 800, fontSize: '1.0625rem', fontVariantNumeric: 'tabular-nums' }}>
                                {fmtMoney(qt.totalAmount)}
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16 }}>
                            <span style={{ fontWeight: 600, color: 'var(--color-text-muted, #6b7280)' }}>VAT</span>
                            <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(qt.vatAmount)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16 }}>
                            <span style={{ fontWeight: 600, color: 'var(--color-text-muted, #6b7280)' }}>Departments (pending)</span>
                            <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                                {qt.pendingDepartmentCount != null && qt.pendingDepartmentCount !== ''
                                    ? fmtDecimal(qt.pendingDepartmentCount, 2)
                                    : NA}
                            </span>
                        </div>
                    </div>
                )}
            </Section>
        </>
    );
}

function CorporateWalkInBookingBodyLegacy({ data: o }) {
    const branch = o.branch || {};
    const vehicle = o.vehicle || {};
    const corp = o.corporateAccount || {};
    const approver = o.corporateWalkInApprovedByUser || null;
    const items = Array.isArray(o.salesOrderItems) ? o.salesOrderItems : [];

    let linesTotal = 0;
    let hasNumericTotal = false;
    for (const line of items) {
        const lt = line?.lineTotal ?? line?.line_total;
        if (lt != null && lt !== '') {
            const n = Number(lt);
            if (!Number.isNaN(n)) {
                linesTotal += n;
                hasNumericTotal = true;
            }
        }
    }

    return (
        <>
            <Section title="Walk-in corporate quote (legacy shape)">
                <KVGrid>
                    <Field label="Sales order ID" kind="id" value={o.id} />
                    <Field label="Workshop ID" kind="id" value={o.workshopId} />
                    <Field label="Branch ID" kind="id" value={o.branchId} />
                    <Field label="Status" value={walkInCorporateStatusLabel(o.status)} />
                    <Field label="Source" value={o.source} />
                    <Field label="Created" kind="date" value={o.createdAt} />
                    <Field label="Created by (user)" kind="id" value={o.createdByUserId} />
                    <Field
                        label="Rejection / cancel reason"
                        value={o.corporateApprovalRejectionReason}
                        span2
                    />
                </KVGrid>
            </Section>

            <Section title="Branch">
                <KVGrid>
                    <Field label="ID" kind="id" value={branch.id} />
                    <Field label="Name" value={branch.name} />
                    <Field label="Address" value={branch.address} span2 />
                </KVGrid>
            </Section>

            <Section title="Corporate account">
                <KVGrid>
                    <Field label="ID" kind="id" value={corp.id} />
                    <Field label="Company" value={corp.companyName} />
                    <Field label="Customer ID" kind="id" value={corp.customerId ?? o.customerId} />
                </KVGrid>
            </Section>

            <Section title="Vehicle">
                <KVGrid>
                    <Field label="Vehicle ID" kind="id" value={o.vehicleId} />
                    <Field label="Plate" value={vehicle.plateNo} />
                    <Field label="Make / model" value={[vehicle.make, vehicle.model].filter(Boolean).join(' ') || NA} />
                    <Field label="Year" value={vehicle.year} />
                </KVGrid>
            </Section>

            <Section title="Corporate approver" empty={!approver ? 'Not approved yet (pending corporate or super admin).' : undefined}>
                {approver && (
                    <KVGrid>
                        <Field label="User ID" kind="id" value={approver.id} />
                        <Field label="Name" value={approver.name} />
                        <Field label="Email" value={approver.email} />
                        <Field label="User type" value={approver.userType} />
                    </KVGrid>
                )}
            </Section>

            <Section title="Line items" count={items.length}>
                {items.length === 0 ? (
                    <p className="approval-empty-line">No line items on this order yet.</p>
                ) : (
                    <div className="approval-table-wrapper">
                        <table className="approval-table">
                            <thead>
                                <tr>
                                    <th>Type</th>
                                    <th>Item</th>
                                    <th>Department</th>
                                    <th>Qty</th>
                                    <th>Unit price</th>
                                    <th>Line total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((line, idx) => {
                                    const dept = line.department || {};
                                    const name =
                                        line.product?.name
                                        || line.service?.name
                                        || line.itemType
                                        || NA;
                                    return (
                                        <tr key={line?.id != null ? String(line.id) : `li-${idx}`}>
                                            <td>{line.itemType || NA}</td>
                                            <td>{name}</td>
                                            <td>{dept.name || NA}</td>
                                            <td>{fmtDecimal(line.qty, 3)}</td>
                                            <td>{fmtMoney(line.unitPrice)}</td>
                                            <td>{fmtMoney(line.lineTotal ?? line.line_total)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            {hasNumericTotal && (
                                <tfoot>
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: 'right', fontWeight: 700 }}>Subtotal (lines)</td>
                                        <td style={{ fontWeight: 700 }}>{fmtMoney(linesTotal)}</td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                )}
            </Section>
        </>
    );
}

/** Super-admin approval queue: corporate master-catalog price quotation line (unified approvals detail). */
function CorporatePriceQuotationBody({ data }) {
    const row = data?.quotation && typeof data.quotation === 'object' ? { ...data, ...data.quotation } : data;
    const ca = row?.corporateAccount ?? data?.corporateAccount ?? {};
    const item =
        row?.product && typeof row.product === 'object'
            ? row.product
            : row?.service && typeof row.service === 'object'
              ? row.service
              : {};
    const itemName = row.name ?? row.itemName ?? row.item_name ?? item.name;
    const itemSku = row.sku ?? item.sku;
    const itemUnit = row.unit ?? item.unit ?? item.unitOfMeasurement ?? item.unit_of_measurement;
    const departmentName =
        row.departmentName ??
        row.department_name ??
        row.department?.name ??
        item.department?.name ??
        item.departmentName ??
        item.department_name;
    return (
        <>
            <Section title="Quotation line">
                <KVGrid>
                    <Field label="ID" kind="id" value={row.id} />
                    <Field label="Status" value={row.status} />
                    <Field label="Item type" value={row.itemType} />
                    <Field label="Name" value={itemName} />
                    <Field label="SKU" value={itemSku} />
                    <Field label="Unit" value={itemUnit} />
                    <Field label="Department" value={departmentName} />
                    <Field label="Qty" kind="decimal" value={row.qty} />
                    <Field label="Quotation price (incl. VAT)" kind="money" value={row.quotationPrice} />
                    <Field label="Product ID" kind="id" value={row.productId ?? row.product_id} />
                    <Field label="Service ID" kind="id" value={row.serviceId ?? row.service_id} />
                    <Field label="Submission batch" kind="id" value={row.submissionBatchId ?? row.submission_batch_id} />
                    <Field label="Submitted" kind="date" value={row.submittedAt ?? row.submitted_at} />
                    <Field label="Reviewed" kind="date" value={row.reviewedAt ?? row.reviewed_at} />
                    <Field label="Notes" value={row.notes} span2 />
                    <Field label="Rejection reason" value={row.rejectionReason ?? row.rejection_reason} span2 />
                </KVGrid>
            </Section>

            <Section title="Corporate account" empty={!ca || Object.keys(ca).length === 0 ? 'No corporate account block on this payload.' : undefined}>
                {ca && Object.keys(ca).length > 0 && (
                    <KVGrid>
                        <Field label="Company" value={ca.companyName ?? ca.company_name} />
                        <Field label="Contact person" value={ca.contactPerson ?? ca.contact_person} />
                        <Field label="Credit limit" kind="money" value={ca.creditLimit ?? ca.credit_limit} />
                        <Field label="Due balance" kind="money" value={ca.dueBalance ?? ca.due_balance} />
                        <Field label="Corporate account ID" kind="id" value={row.corporateAccountId ?? row.corporate_account_id ?? ca.id} />
                        <Field label="Workshop ID" kind="id" value={row.workshopId ?? row.workshop_id} />
                        <Field label="Submitted by (user)" kind="id" value={row.submittedByUserId ?? row.submitted_by_user_id} />
                    </KVGrid>
                )}
            </Section>
        </>
    );
}

function MarketingBudgetRequestBody({ data }) {
    const row = data ?? {};
    const currency = row.currencyCode ?? row.currency_code ?? 'SAR';
    const amount = Number(row.amount ?? 0);
    const money = (v) => fmtMoney(v, currency);

    return (
        <>
            <Section title="Top-up request">
                <KVGrid>
                    <Field label="Request number" kind="id" value={row.requestNumber ?? row.request_number} />
                    <Field label="Status" value={row.status} />
                    <Field label="Amount" value={money(amount)} />
                    <Field label="Source account" value={row.sourceAccountName ?? row.source_account_name} />
                    <Field label="Source register id" kind="id" value={row.sourceAccountId ?? row.source_account_id} />
                    <Field label="Purpose" value={row.purpose} span2 />
                    <Field label="Requested by" value={row.requestedBy ?? row.requested_by ?? row.requestedByName ?? row.requested_by_name} />
                    <Field label="Submitted" kind="date" value={row.createdAt ?? row.created_at} />
                    <Field label="Approved by" value={row.approvedByName ?? row.approved_by_name ?? row.approvedBy ?? row.approved_by} />
                    <Field label="Approved at" kind="date" value={row.approvedAt ?? row.approved_at} />
                    <Field label="Rejected by" value={row.rejectedByName ?? row.rejected_by_name ?? row.rejectedBy ?? row.rejected_by} />
                    <Field label="Rejected at" kind="date" value={row.rejectedAt ?? row.rejected_at} />
                    <Field label="Rejection reason" value={row.rejectionReason ?? row.rejection_reason} span2 />
                </KVGrid>
            </Section>
        </>
    );
}

function MarketingExpenseBody({ data }) {
    const row = data?.expense ?? data ?? {};
    const amount = Number(row.amount ?? 0);

    return (
        <>
            <Section title="Marketing expense">
                <KVGrid>
                    <Field label="Expense #" kind="id" value={row.expenseNumber ?? row.expense_number} />
                    <Field label="Status" value={row.status ?? data?.expenseStatus} />
                    <Field label="Category" value={row.expenseCategory ?? row.expense_category} />
                    <Field label="Vendor" value={row.vendorName ?? row.vendor_name} />
                    <Field label="Amount" value={`SAR ${amount.toLocaleString()}`} />
                    <Field label="Campaign" value={row.campaignName ?? row.campaign_name} />
                    <Field label="Expense date" kind="date" value={row.expenseDate ?? row.expense_date} />
                    <Field label="Submitted by" value={row.submittedByName ?? row.submittedBy ?? data?.submittedBy} />
                    <Field label="Description" value={row.description} span2 />
                    <Field label="Receipt URL" value={row.receiptUrl ?? row.receipt_url} span2 />
                    <Field label="Notes" value={row.notes} span2 />
                    <Field label="Rejection reason" value={row.rejectionReason ?? data?.rejectionReason} span2 />
                </KVGrid>
            </Section>
        </>
    );
}

function MarketingCampaignBody({ data }) {
    const row = data?.campaign ?? data ?? {};
    const budget = Number(row.budgetAllocated ?? row.budget ?? 0);

    return (
        <>
            <Section title="Campaign">
                <KVGrid>
                    <Field label="Campaign name" value={row.campaignName ?? row.name} />
                    <Field label="Status" value={row.status ?? data?.campaignStatus} />
                    <Field label="Workshop" value={row.workshopName ?? row.requestedByName} />
                    <Field label="Platform" value={row.platform} />
                    <Field label="Type" value={row.campaignType ?? row.type} />
                    <Field label="Budget" value={`SAR ${budget.toLocaleString()}`} />
                    <Field label="Start date" kind="date" value={row.startDate} />
                    <Field label="End date" kind="date" value={row.endDate} />
                    <Field label="Submitted by" value={row.createdByUserName ?? row.submittedByName ?? data?.submittedBy} />
                    <Field label="Submitted" kind="date" value={row.createdAt ?? data?.createdAt} />
                    <Field label="Description" value={row.description} span2 />
                    <Field label="Notes" value={row.notes} span2 />
                    <Field label="Rejection reason" value={row.rejectionReason ?? data?.rejectionReason} span2 />
                </KVGrid>
            </Section>
        </>
    );
}

function renderBody(entityType, data) {
    switch (entityType) {
        case 'workshop_registration':  return <WorkshopBody data={data} />;
        case 'supplier_registration':  return <SupplierBody data={data} />;
        case 'corporate_registration': return <CorporateBody data={data} />;
        case 'technician_registration':return <TechnicianBody data={data} />;
        case 'branch_creation':        return <BranchCreationBody data={data} />;
        case 'cashier_registration':   return <CashierRegistrationBody data={data} />;
        case 'workshop_portal_staff_registration':
            return <WorkshopPortalStaffRegistrationBody data={data} />;
        case 'corporate_price_quotation':
        case 'corporate_price_quotations':
            return <CorporatePriceQuotationBody data={data} />;
        case 'corporate_walk_in_booking':
            return <CorporateWalkInBookingBody data={data} />;
        case 'marketing_budget_request':
            return <MarketingBudgetRequestBody data={data} />;
        case 'marketing_expense':
            return <MarketingExpenseBody data={data} />;
        case 'marketing_campaign':
            return <MarketingCampaignBody data={data} />;
        default:                       return <RawObjectBody data={data} />;
    }
}

/* ---------------------------------------------------------------- */
/*  Main modal                                                       */
/* ---------------------------------------------------------------- */

export default function ApprovalDetailsModal({
    entityType, id, onClose, onApprove, onReject, actionDisabled = false,
    canApprove = true, canReject = true, asPage = false,
}) {
    // Modal is mounted fresh per (entityType, id) — start in the loading
    // state and let the effect's promise callbacks transition out. This
    // avoids any synchronous setState inside the effect body.
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!entityType || !id) return undefined;
        let cancelled = false;
        details(entityType, id)
            .then((res) => {
                if (cancelled) return;
                setData(res);
                setError(null);
                setLoading(false);
            })
            .catch((e) => {
                if (cancelled) return;
                setError(e.message || 'Failed to load');
                setLoading(false);
            });
        return () => { cancelled = true; };
    }, [entityType, id]);

    const rawStatus = data?.status ?? data?.approvalStatus ?? 'pending';
    const statusClass = String(rawStatus).toLowerCase().replace(/\s+/g, '_');
    const statusDisplay =
        entityType === 'corporate_walk_in_booking'
            ? walkInCorporateStatusLabel(rawStatus)
            : rawStatus;
    const showApproveReject =
        !!data &&
        (entityType === 'corporate_walk_in_booking'
            ? isWalkInCorporatePendingDetail(data)
            : String(rawStatus).toLowerCase() === 'pending');
    const titleSuffix = data
        ? data.title
            ?? data.companyName
            ?? data.name
            ?? data.workshopCode
            ?? data?.corporateAccount?.companyName
            ?? data?.branch?.name
            ?? data?.branchName
            ?? data?.vehicle?.plateNo
            ?? data?.user?.name
            ?? data?.workshopStaffRole
            ?? ''
        : '';

    return (
        <ApprovalShell
            asPage={asPage}
            title={titleSuffix ? `Approval Details — ${titleSuffix}` : 'Approval Details'}
            onClose={onClose}
            width={920}
            backDisabled={actionDisabled}
            footer={showApproveReject && (canApprove || canReject) ? (
                <div className="approval-details-actions">
                    {canReject && (
                        <button
                            type="button"
                            className="btn-reject"
                            disabled={actionDisabled}
                            onClick={() => onReject?.(data)}
                        >
                            <X size={16} /> Reject
                        </button>
                    )}
                    {canApprove && (
                        <button
                            type="button"
                            className="btn-approve"
                            disabled={actionDisabled}
                            onClick={() => onApprove?.(data)}
                        >
                            <Check size={16} /> Approve
                        </button>
                    )}
                </div>
            ) : null}
        >
            {loading && (
                <div className="empty-state-card approval-details-state">
                    <Loader size={20} className="spin" />
                    <p className="empty-desc">Loading details…</p>
                </div>
            )}

            {!loading && error && (
                <div className="empty-state-card approval-details-state">
                    <AlertCircle size={20} />
                    <p className="empty-status">Failed to load</p>
                    <p className="empty-desc">{error}</p>
                </div>
            )}

            {!loading && !error && data && (
                <div className="approval-details-body">
                    <div className="approval-details-status-row">
                        <span className={`approval-status-badge status-${statusClass}`}>{statusDisplay}</span>
                    </div>
                    {renderBody(entityType, data)}
                </div>
            )}
        </ApprovalShell>
    );
}
