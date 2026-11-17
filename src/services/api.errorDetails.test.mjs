import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const apiSrc = readFileSync(join(here, 'api.js'), 'utf8');

describe('api.js OB error details', () => {
  it('maps responseBody.details onto error.details', () => {
    assert.match(apiSrc, /error\.details = responseBody\.details/);
    assert.match(
      apiSrc,
      /responseBody\.details != null &&[\s\S]*typeof responseBody\.details === "object"/,
    );
  });
});
