import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { createLoaders } from '../src/assets/loaders.js';
import { bindGarment } from '../src/assets/rigs.js';
function rig() {
  const root = new T.Group(), bone = new T.Bone(); bone.name = 'Hips';
  const geometry = new T.BoxGeometry(1, 2, 1), count = geometry.attributes.position.count;
  geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(new Uint16Array(count * 4), 4));
  const weights = new Float32Array(count * 4); for (let i = 0; i < count; i++) weights[i * 4] = 1;
  geometry.setAttribute('skinWeight', new T.Float32BufferAttribute(weights, 4));
  const mesh = new T.SkinnedMesh(geometry, new T.MeshStandardMaterial());
  root.add(bone, mesh); root.updateMatrixWorld(true); mesh.bind(new T.Skeleton([bone]));
  return { scene: root, animations: [new T.AnimationClip('idle', 1, [new T.NumberKeyframeTrack('Hips.position[x]', [0, 1], [0, 1])])] };
}
const actor = { id: 'actor', name: 'Actor', availability: 'available', path: '../assets/actor.glb', displayHeight: 2, rig: { id: 'rig-v1' }, attachments: { hand: { bone: 'Hips', position: [1, 0, 0] } } };
test('character instances isolate bones, preserve materials, normalize and attach accessories', async () => {
  let loads = 0;
  const bag = { id: 'bag', path: '../assets/bag.glb', availability: 'available', type: 'accessory', attachment: 'hand', transform: { scale: [0.1, 0.1, 0.1] } };
  const catalog = { baseURL: 'https://example.org/game/config/catalog.json', characters: [actor], products: [bag], environments: [], performance: { maxIdleAssets: 0 } };
  const loaders = createLoaders(catalog, {}, { loadAsync: async () => { loads++; return rig(); } });
  const [a, b] = await Promise.all([loaders.loadCharacter(actor), loaders.loadCharacter(actor)]);
  assert.equal(loads, 1); assert.notEqual(a.model.getObjectByName('Hips'), b.model.getObjectByName('Hips'));
  assert.equal(a.anchors.get('hand').parent.name, 'Hips');
  a.root.updateMatrixWorld(true); assert.equal(new T.Box3().setFromObject(a.root).getSize(new T.Vector3()).y, 2);
  a.play('idle'); a.update(0.5); assert.equal(a.model.getObjectByName('Hips').position.x, 0.5); assert.equal(b.model.getObjectByName('Hips').position.x, 0);
  const accessory = await loaders.loadAccessory(bag, a); accessory.parent.add(accessory.root);
  assert.equal(accessory.root.parent, a.anchors.get('hand')); assert.equal(accessory.root.scale.x, 0.1);
  accessory.dispose(); a.dispose(); b.dispose(); assert.equal(loaders.cache.entries.size, 0);
});
test('skinned clothing binds to matching character bones and rejects mismatched bind poses', () => {
  const character = { model: rig().scene }, garment = rig().scene;
  bindGarment(garment, character);
  const mesh = garment.children.find(x => x.isSkinnedMesh);
  assert.equal(mesh.skeleton.bones[0], character.model.getObjectByName('Hips'));
  const bad = rig().scene; bad.children.find(x => x.isSkinnedMesh).skeleton.boneInverses[0].elements[12] = 10;
  assert.throws(() => bindGarment(bad, character), /Incompatible/);
});
