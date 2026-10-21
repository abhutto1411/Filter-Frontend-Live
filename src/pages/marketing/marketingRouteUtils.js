export function marketingPortalBase(pathname) {
  if (pathname.includes('/admin/marketing')) return '/admin/marketing';
  return '/marketing';
}

export function marketingSectionPath(pathname, section) {
  return `${marketingPortalBase(pathname)}/${section}`;
}
