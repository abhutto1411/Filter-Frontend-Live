import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    MAX_EXPENSE_PROOF_FILE_BYTES,
    RECORD_COLLECTION_JSON_BODY_LIMIT_BYTES,
    estimateRecordCollectionPayloadBytes,
    recordCollectionPayloadWithinLimit,
} from './recordCollectionLimits.js';

describe('recordCollectionLimits', () => {
    it('FE per-file cap and BE JSON limit constants', () => {
        assert.equal(MAX_EXPENSE_PROOF_FILE_BYTES, 2 * 1024 * 1024);
        assert.equal(RECORD_COLLECTION_JSON_BODY_LIMIT_BYTES, 25 * 1024 * 1024);
    });

    it('flags payloads over the BE limit', () => {
        const big = 'x'.repeat(RECORD_COLLECTION_JSON_BODY_LIMIT_BYTES);
        assert.equal(recordCollectionPayloadWithinLimit({ proofUrl: big }), false);
        assert.equal(recordCollectionPayloadWithinLimit({}), true);
        assert.ok(estimateRecordCollectionPayloadBytes({ proofUrl: 'a' }) > 8192);
    });
});