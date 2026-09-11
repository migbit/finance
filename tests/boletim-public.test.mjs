import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { GUIDANCE } from '../js/boletim-public-copy.js';
import { PRIVACY_COPY } from '../js/boletim-privacy-copy.js';
import { PROPERTIES } from '../js/boletim-properties.js';
import { DATES_COPY } from '../js/boletim-dates-copy.js';

test('all five languages cover guidance, privacy and both apartment names', () => {
  for (const [lang, copy] of Object.entries(PRIVACY_COPY)) {
    assert.deepEqual(Object.keys(copy).sort(), Object.keys(PRIVACY_COPY.en).sort());
    assert.ok(GUIDANCE[lang]);
    assert.deepEqual(Object.keys(DATES_COPY[lang]).sort(), Object.keys(DATES_COPY.en).sort());
    for (const property of Object.values(PROPERTIES)) assert.ok(property.names[lang]);
  }
});

test('public form uses the checked server endpoint instead of direct Firestore access', async () => {
  const source = await readFile(new URL('../js/boletim-public.js', import.meta.url), 'utf8');
  assert.ok(source.includes('/api/guest-registration'));
  assert.ok(!source.includes('firebase-firestore.js'));
  assert.ok(!source.includes('getDocs('));
});
