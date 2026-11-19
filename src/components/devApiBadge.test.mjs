/**
 * Run: node --test src/components/devApiBadge.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { shouldShowDevApiBadge } from './devApiBadgeUtil.js';

describe('DevApiBadge', () => {
  it('shows in non-prod, hidden in prod', () => {
    assert.equal(shouldShowDevApiBadge(false), true);
    assert.equal(shouldShowDevApiBadge(true), false);
  });
});
