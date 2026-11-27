import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { Wardrobe } from '../src/engine/wardrobe.js';
function deferred() { let resolve, reject; const promise = new Promise((a,b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function item(id, type='garment') { return { config: { id, type }, root: new T.Group(), disposed: false, dispose() { this.disposed = true; this.root.removeFromParent(); }, update() {} }; }
test('late character loads are discarded and failed selection retains working character', async () => {
  const pending = new Map();
  const w = new Wardrobe({ loadCharacter: c => { const d = deferred(); pending.set(c.id, d); return d.promise; } }, new T.Scene());
  const a = w.selectCharacter({ id: 'a' }), b = w.selectCharacter({ id: 'b' });
  const newer = item('b'); pending.get('b').resolve(newer); await b;
  const older = item('a'); pending.get('a').resolve(older); assert.equal(await a, false); assert.equal(older.disposed, true); assert.equal(w.character, newer);
  const bad = w.selectCharacter({ id: 'bad' }); pending.get('bad').reject(Error('404')); await assert.rejects(bad); assert.equal(w.character, newer);
});
test('latest slot selection wins; removing slot cancels pending equipment', async () => {
  const pending = new Map();
  const w = new Wardrobe({ loadGarment: c => { const d = deferred(); pending.set(c.id, d); return d.promise; } }, new T.Scene());
  const a = w.equip({ id: 'a', type: 'garment', slot: 'dress' }), b = w.equip({ id: 'b', type: 'garment', slot: 'dress' });
  const newer = item('b'); pending.get('b').resolve(newer); await b;
  const older = item('a'); pending.get('a').resolve(older); await a;
  assert.equal(w.items.get('dress'), newer); assert.equal(older.disposed, true);
  const c = w.equip({ id: 'c', type: 'garment', slot: 'dress' }); w.remove('dress');
  const removed = item('c'); pending.get('c').resolve(removed); await c; assert.equal(removed.disposed, true); assert.equal(w.items.size, 0);
});
