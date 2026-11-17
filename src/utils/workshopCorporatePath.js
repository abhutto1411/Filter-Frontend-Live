/**
 * App.jsx is `path="/workshop/*"`, so `useParams().corporateAccountId` is always
 * undefined. Parse the id from the workshop corporate-management pathname.
 */

export function parseWorkshopCorporateAccountId(pathname) {
    const pathOnly = String(pathname || '').split(/[?#]/)[0];
    const parts = pathOnly
        .split('/')
        .filter(Boolean);
    if (parts[0] !== 'workshop' || parts[1] !== 'corporate-management') return null;
    const id = String(parts[2] || '').trim();
    if (!id || id === 'generate-bill') return null;
    return id;
}
