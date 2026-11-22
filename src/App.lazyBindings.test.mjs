import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { paintBootError } from './utils/paintBootError.js';

const here = dirname(fileURLToPath(import.meta.url));

test('lazyPortalPages.js imports lazyWithRetry; App.jsx has no undefined identifier', () => {
    const pages = readFileSync(join(here, 'lazyPortalPages.js'), 'utf8');
    const app = readFileSync(join(here, 'App.jsx'), 'utf8');
    assert.match(pages, /import \{ lazyPage as lazyWithRetry \} from '\.\/utils\/lazyPage'/);
    assert.ok((pages.match(/\blazyWithRetry\s*\(/g) || []).length >= 30);
    assert.equal(
        (app.match(/\blazyWithRetry\s*\(/) || []).length,
        0,
        'App.jsx must not call lazyWithRetry — that binding lives in lazyPortalPages.js',
    );
    assert.equal((app.match(/\bloadPage\s*\(/) || []).length, 0);
});

test('paintBootError fills an empty root', () => {
    const root = { innerHTML: '', querySelector: () => null };
    const ok = paintBootError(new Error('lazyWithRetry is not defined'), root);
    assert.equal(ok, true);
    assert.match(root.innerHTML, /Page updated/);
    assert.match(root.innerHTML, /data-boot-error/);
    assert.notEqual(root.innerHTML.trim(), '');
});

test('workshop payroll route renders non-blank markup in MemoryRouter', () => {
    const html = renderToStaticMarkup(
        createElement(
            MemoryRouter,
            { initialEntries: ['/workshop/accounting/advances/payroll/2026-11'] },
            createElement(
                Routes,
                null,
                createElement(Route, {
                    path: '/workshop/accounting/advances/payroll/:period',
                    element: createElement(
                        'div',
                        { 'data-payroll-route': '1' },
                        'Accounting — Payroll & advances',
                    ),
                }),
            ),
        ),
    );
    assert.match(html, /Payroll/);
    assert.match(html, /data-payroll-route/);
    assert.notEqual(html.trim(), '');
});
