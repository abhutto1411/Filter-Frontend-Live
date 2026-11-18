import test from 'node:test';
import assert from 'node:assert/strict';
import {
    DEV_API_ORIGIN,
    DOCUMENTED_API_ORIGINS,
    isLocalhostApiOrigin,
    resolveApiBaseUrl,
} from './apiBaseUrl.js';

test('development without VITE_API_BASE_URL keeps localhost', () => {
    assert.equal(resolveApiBaseUrl({ prod: false, mode: 'development' }), DEV_API_ORIGIN);
    assert.equal(resolveApiBaseUrl({ raw: '  ', prod: false }), DEV_API_ORIGIN);
});

test('development may explicitly set localhost or a remote origin', () => {
    assert.equal(
        resolveApiBaseUrl({ raw: 'http://localhost:3000/', prod: false }),
        'http://localhost:3000',
    );
    assert.equal(
        resolveApiBaseUrl({
            raw: `${DOCUMENTED_API_ORIGINS.staging}/`,
            prod: false,
            mode: 'development',
        }),
        DOCUMENTED_API_ORIGINS.staging,
    );
});

test('production build missing VITE_API_BASE_URL fails closed', () => {
    assert.throws(
        () => resolveApiBaseUrl({ prod: true, mode: 'production' }),
        /required for production/,
    );
    assert.throws(
        () => resolveApiBaseUrl({ raw: '   ', prod: true }),
        /required for production/,
    );
});

test('production build rejects localhost even when set', () => {
    assert.throws(
        () => resolveApiBaseUrl({ raw: 'http://localhost:3000', prod: true }),
        /must not target localhost/,
    );
    assert.throws(
        () => resolveApiBaseUrl({ raw: 'http://127.0.0.1:3000', mode: 'production' }),
        /must not target localhost/,
    );
});

test('production build rejects invalid URLs', () => {
    assert.throws(
        () => resolveApiBaseUrl({ raw: 'not-a-url', prod: true }),
        /valid absolute URL/,
    );
    assert.throws(
        () => resolveApiBaseUrl({ raw: 'ftp://api.example.com', prod: true }),
        /http or https/,
    );
});

test('production build accepts a documented non-localhost origin', () => {
    assert.equal(
        resolveApiBaseUrl({ raw: DOCUMENTED_API_ORIGINS.staging, prod: true }),
        DOCUMENTED_API_ORIGINS.staging,
    );
    assert.equal(isLocalhostApiOrigin(DOCUMENTED_API_ORIGINS.staging), false);
    assert.equal(isLocalhostApiOrigin(DOCUMENTED_API_ORIGINS.production), false);
});
