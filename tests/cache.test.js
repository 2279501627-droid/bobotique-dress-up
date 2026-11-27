import test from 'node:test';
import assert from 'node:assert/strict';
import { AssetCache } from '../src/assets/cache.js';
test('deduplicates simultaneous loads and never evicts active assets', async () => {
  let loads = 0; const disposed = [];
  const cache = new AssetCache({ maxIdle: 0, load: async key => { loads++; return { key }; }, instantiate: t => ({ root: { ...t } }), dispose: t => disposed.push(t.key) });
  const [a, b] = await Promise.all([cache.acquire('one'), cache.acquire('one')]);
  assert.equal(loads, 1); assert.notEqual(a.root, b.root);
  a.release(); a.release(); assert.deepEqual(disposed, []);
  b.release(); assert.deepEqual(disposed, ['one']); assert.equal(cache.entries.size, 0);
});
test('failed loads can retry, and idle LRU cache stays bounded', async () => {
  let fail = true; const disposed = [];
  const cache = new AssetCache({ maxIdle: 1, load: async key => { if (fail) { fail = false; throw Error('network'); } return { key }; }, instantiate: t => ({ root: t }), dispose: t => disposed.push(t.key) });
  await assert.rejects(cache.acquire('one'));
  (await cache.acquire('one')).release(); (await cache.acquire('two')).release();
  assert.deepEqual(disposed, ['one']); assert.equal(cache.entries.size, 1);
});
