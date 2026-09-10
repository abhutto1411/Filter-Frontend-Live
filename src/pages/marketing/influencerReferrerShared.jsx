export const EMPTY_INFLUENCER_FORM = {
  id: '',
  name: '',
  email: '',
  phone: '',
  platform: 'instagram',
  handle: '',
  commissionRate: '',
  activeCampaigns: '',
  status: 'active',
  notes: '',
};

export const platformOptions = [
  'instagram',
  'tiktok',
  'youtube',
  'snapchat',
  'facebook',
  'x',
  'blog',
  'offline',
  'other',
];

export function humanize(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
