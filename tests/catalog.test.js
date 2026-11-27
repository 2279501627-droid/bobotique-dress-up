import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCatalog, compatible, safeURL } from '../src/assets/catalog.js';
const base = 'https://example.org/bobotique/config/catalog.json';
const catalog = JSON.parse(await readFile('config/catalog.json', 'utf8'));
test('catalogue supports GitHub Pages subpaths and independent external GLBs', () => {
  validateCatalog(catalog, base);
  assert.equal(safeURL(catalog.characters[0].path, base), 'https://example.org/bobotique/assets/founder.glb');
  assert.equal(safeURL(null, base), null);
});
test('rejects malformed data before loading expensive assets', () => {
  for (const change of [
    c => c.characters.push(c.characters[0]),
    c => c.products[0].availability = 'typo',
    c => c.characters[0].transform.scale = [0, 1, 1],
    c => c.products[0].shopifyUrl = 'javascript:alert(1)',
    c => c.defaults.character = 'missing',
    c => c.products[0].availability = 'available',
    c => c.materialProfiles['scan-satin'].roughnessRange = [0.8, 0.2],
  ]) { const copy = structuredClone(catalog); change(copy); assert.throws(() => validateCatalog(copy, base)); }
});
test('fit checks guard unrigged characters and unsupported anchors', () => {
  const character = catalog.characters[0];
  assert.equal(compatible({ compatibleRig: 'humanoid-v1' }, character), false);
  assert.equal(compatible({ attachment: 'eyewear' }, character), true);
  assert.equal(compatible({ attachment: 'missing' }, character), false);
  assert.equal(compatible({ compatibleCharacters: ['other'] }, character), false);
});
