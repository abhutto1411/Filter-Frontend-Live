import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    auditLazyPages,
    hasDefaultExport,
} from './check-lazy-pages.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', 'src');
const fixture = join(here, 'fixtures', 'lazy-page-no-default.jsx');

test('hasDefaultExport detects export default', () => {
    assert.equal(hasDefaultExport('export default function Page() {}'), true);
    assert.equal(hasDefaultExport('export function NotAPage() {}'), false);
});

test('all lazy routes have a default export', () => {
    const result = auditLazyPages(src);
    assert.deepEqual(result.errors, []);
    assert.ok(result.targets.length > 10);
});

test('fixture without a default export fails the check', () => {
    const result = auditLazyPages(src, [fixture]);
    assert.ok(
        result.errors.some((e) => e.includes('no default export') && e.includes('lazy-page-no-default')),
    );
});
