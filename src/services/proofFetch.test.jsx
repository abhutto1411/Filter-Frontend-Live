import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./api', () => ({ BASE_URL: 'https://api.test', getAuthToken: () => ' tok ' }));

import { fetchProofObjectUrl } from './proofFetch';

function response({ ok = true, status = 200, type = 'image/png', json, blob } = {}) {
    return {
        ok,
        status,
        headers: { get: () => type },
        json: async () => json,
        blob: async () => blob ?? new Blob(['x'], { type }),
    };
}

describe('fetchProofObjectUrl', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('fetches with the bearer token and returns an object URL for files', async () => {
        const fetchMock = vi.fn().mockResolvedValue(response());
        vi.stubGlobal('fetch', fetchMock);
        const spy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:proof');
        expect(await fetchProofObjectUrl('/x/1/proof')).toBe('blob:proof');
        expect(fetchMock).toHaveBeenCalledWith('https://api.test/x/1/proof', {
            headers: { Accept: '*/*', Authorization: 'Bearer tok' },
        });
        expect(spy).toHaveBeenCalled();
    });

    it('returns the stored link for legacy {url} proofs', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(response({ type: 'application/json', json: { url: 'https://cdn/p.png' } })),
        );
        expect(await fetchProofObjectUrl('x/1/proof')).toBe('https://cdn/p.png');
    });

    it('throws on HTTP errors', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ok: false, status: 404 })));
        await expect(fetchProofObjectUrl('/x/1/proof')).rejects.toThrow('Proof 404');
    });
});
