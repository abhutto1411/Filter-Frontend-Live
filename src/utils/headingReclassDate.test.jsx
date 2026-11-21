import { describe, it, expect } from 'vitest';
import { defaultHeadingReclassDate } from './headingReclassDate';

describe('defaultHeadingReclassDate', () => {
  it('start 2026-11-16, no lock → 2026-11-15', () => {
    expect(
      defaultHeadingReclassDate({
        startDate: '2026-11-16',
        lockedUpTo: null,
        todayYmd: '2026-11-20',
      }),
    ).toBe('2026-11-15');
  });

  it('start 2026-11-14, lockedUpTo 2026-11-13 → today', () => {
    expect(
      defaultHeadingReclassDate({
        startDate: '2026-11-14',
        lockedUpTo: '2026-11-13',
        todayYmd: '2026-11-20',
      }),
    ).toBe('2026-11-20');
  });

  it('no start → today', () => {
    expect(
      defaultHeadingReclassDate({
        startDate: null,
        lockedUpTo: null,
        todayYmd: '2026-11-20',
      }),
    ).toBe('2026-11-20');
  });
});
