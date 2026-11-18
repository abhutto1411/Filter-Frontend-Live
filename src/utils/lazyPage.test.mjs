import test from 'node:test';
import assert from 'node:assert/strict';
import {
    CHUNK_RELOAD_KEY,
    ChunkLoadError,
    clearChunkReloadKey,
    inferLazyImportPath,
    importPageModule,
    isChunkLoadError,
    isMissingDefaultExportError,
    reloadOnceForStaleChunk,
    resolveLazyPageModule,
} from './lazyPage.js';

function installWindow(store, reloads) {
    globalThis.window = {
        sessionStorage: {
            getItem: (k) => store[k] ?? null,
            setItem: (k, v) => {
                store[k] = v;
            },
            removeItem: (k) => {
                delete store[k];
            },
        },
        location: { reload: () => reloads.push(1) },
    };
}

test('resolveLazyPageModule uses default, then named fallback', () => {
    const Def = function DefaultPage() {};
    const Named = function NamedPage() {};
    assert.equal(resolveLazyPageModule({ default: Def }).default, Def);
    assert.equal(
        resolveLazyPageModule({ WorkshopAdvances: Named }, { namedExport: 'WorkshopAdvances' })
            .default,
        Named,
    );
});

test('missing export gives a clear lazyPage error naming the file', () => {
    assert.throws(
        () => resolveLazyPageModule({ foo: 1 }, { file: 'WorkshopAdvances.jsx' }),
        /lazyPage: WorkshopAdvances\.jsx has no default export \(exports: foo\)/,
    );
});

test('chunk failure retries once then one guarded reload (no loop)', async () => {
    const store = {};
    const reloads = [];
    installWindow(store, reloads);
    let calls = 0;
    const boom = async () => {
        calls += 1;
        throw new Error('Failed to fetch dynamically imported module');
    };
    await assert.rejects(
        () => importPageModule(boom, { file: 'chunk.js' }),
        (err) => {
            assert.equal(err.name, 'ChunkLoadError');
            assert.match(String(err.message), /Failed to load page module chunk\.js/);
            return true;
        },
    );
    assert.equal(calls, 2);
    assert.equal(reloads.length, 1);
    assert.equal(reloadOnceForStaleChunk(), false);
    assert.equal(reloads.length, 1);
    delete globalThis.window;
});

test('stale chunk + key already set throws, does not hang', async () => {
    const store = { [CHUNK_RELOAD_KEY]: '1' };
    const reloads = [];
    installWindow(store, reloads);
    const boom = async () => {
        throw new Error('Failed to fetch dynamically imported module');
    };
    let hung = false;
    const timeout = new Promise((_, reject) => {
        setTimeout(() => {
            hung = true;
            reject(new Error('hung'));
        }, 200);
    });
    await assert.rejects(
        () => Promise.race([importPageModule(boom, { file: 'stale.js' }), timeout]),
        (err) => {
            assert.equal(hung, false);
            assert.notEqual(err.message, 'hung');
            assert.equal(err.name, 'ChunkLoadError');
            return true;
        },
    );
    assert.equal(reloads.length, 0);
    assert.equal(store[CHUNK_RELOAD_KEY], undefined);
    delete globalThis.window;
});

test('successful load clears the chunk reload key', async () => {
    const store = { [CHUNK_RELOAD_KEY]: '1' };
    installWindow(store, []);
    const Page = function PayrollPage() {};
    const mod = await importPageModule(async () => ({ default: Page }), { file: 'ok.js' });
    assert.equal(mod.default, Page);
    assert.equal(store[CHUNK_RELOAD_KEY], undefined);
    clearChunkReloadKey();
    delete globalThis.window;
});

test('isChunkLoadError vs missing default', () => {
    assert.equal(
        isMissingDefaultExportError(
            new Error(
                "The requested module '/src/pages/workshop/accounting/WorkshopAdvances.jsx?t=1' does not provide an export named 'default'",
            ),
        ),
        true,
    );
    assert.equal(
        isChunkLoadError(
            new Error(
                "The requested module '/src/pages/workshop/accounting/WorkshopAdvances.jsx' does not provide an export named 'default'",
            ),
        ),
        false,
    );
    assert.equal(isChunkLoadError(new ChunkLoadError('Failed to load page module x')), true);
    const fakeImporter = { toString: () => "() => import('./WorkshopAdvances.jsx')" };
    assert.equal(inferLazyImportPath(fakeImporter), './WorkshopAdvances.jsx');
});
