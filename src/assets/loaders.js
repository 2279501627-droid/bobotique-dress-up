import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { AssetCache } from './cache.js';
import { prepareAsset } from './materials.js';
import { disposeTree, releaseInstance } from './resources.js';
import { safeURL, compatible } from './catalog.js';
import { transform } from './transforms.js';
import { uniqueBones, bindGarment } from './rigs.js';

export function createLoaders(catalog, renderer, loader = new GLTFLoader()) {
  const definitions = new Map([...catalog.characters, ...catalog.products, ...catalog.environments].map(x => [x.id, x]));
  const cache = new AssetCache({
    maxIdle: catalog.performance?.maxIdleAssets ?? 2,
    load: async id => {
      const config = definitions.get(id);
      const gltf = await loader.loadAsync(safeURL(config.path, catalog.baseURL));
      try { prepareAsset(gltf.scene, renderer, catalog.materialProfiles?.[config.materialProfile]); }
      catch (error) { disposeTree(gltf.scene); throw error; }
      return gltf;
    },
    instantiate: gltf => ({ root: clone(gltf.scene), animations: gltf.animations }),
    dispose: gltf => disposeTree(gltf.scene),
  });
  async function loadCharacter(config) {
    const asset = await cache.acquire(config.id);
    const root = transform(new T.Group(), config.transform);
    const normalized = new T.Group();
    root.add(normalized);
    normalized.add(asset.root);
    try {
      asset.root.updateMatrixWorld(true);
      const bounds = new T.Box3().setFromObject(asset.root);
      const height = bounds.getSize(new T.Vector3()).y;
      if (!Number.isFinite(height) || height <= 0) throw new Error('Character has empty bounds.');
      const factor = config.displayHeight / height;
      const center = bounds.getCenter(new T.Vector3());
      normalized.scale.setScalar(factor);
      normalized.position.set(-center.x * factor, -bounds.min.y * factor, -center.z * factor);
      const bones = config.rig ? uniqueBones(asset.root) : new Map();
      const anchors = new Map();
      for (const [name, definition] of Object.entries(config.attachments || {})) {
        const parent = definition.bone ? bones.get(definition.bone) : root;
        if (!parent) throw new Error(`Attachment bone not found: ${definition.bone}`);
        const anchor = transform(new T.Group(), definition);
        anchor.name = `attachment:${name}`;
        parent.add(anchor);
        anchors.set(name, anchor);
      }
      const mixer = new T.AnimationMixer(asset.root);
      const clips = new Map(asset.animations.map(clip => [clip.name, clip]));
      let action;
      const result = { config, root, normalized, model: asset.root, anchors, clips,
        play(name) {
          if (!name) { mixer.stopAllAction(); action = null; return; }
          if (!clips.has(name)) throw new Error(`Animation not found: ${name}`);
          const next = mixer.clipAction(clips.get(name));
          if (next === action) return;
          next.reset().fadeIn(0.2).play(); action?.fadeOut(0.2); action = next;
        },
        update: delta => mixer.update(delta),
        dispose() { mixer.stopAllAction(); mixer.uncacheRoot(asset.root); root.removeFromParent(); releaseInstance(asset); },
      };
      if (config.animation) result.play(config.animation);
      return result;
    } catch (error) { releaseInstance(asset); throw error; }
  }
  async function product(config, character, attachment = false) {
    if (config.availability !== 'available' || !compatible(config, character?.config)) throw new Error('This item is not available for the selected character.');
    const asset = await cache.acquire(config.id);
    try {
      const root = transform(new T.Group(), config.transform);
      root.add(asset.root);
      if (config.fit === 'skinned') bindGarment(asset.root, character);
      const parent = attachment ? character.anchors.get(config.attachment) : character.normalized;
      if (!parent) throw new Error(`Missing attachment: ${config.attachment}`);
      return { config, root, parent, dispose() { root.removeFromParent(); releaseInstance(asset); } };
    } catch (error) { releaseInstance(asset); throw error; }
  }
  async function loadFurniture(config) {
    if (config.availability !== 'available') throw new Error('This item is unavailable.');
    const asset = await cache.acquire(config.id);
    const root = transform(new T.Group(), config.transform); root.add(asset.root);
    return { config, root, dispose() { root.removeFromParent(); releaseInstance(asset); } };
  }
  async function loadEnvironment(config) {
    const root = transform(new T.Group(), config.transform);
    let asset;
    try {
      if (config.path) { asset = await cache.acquire(config.id); root.add(asset.root); }
      const procedural = new T.Group(); root.add(procedural);
      for (const p of config.primitives || []) {
        const geometry = p.shape === 'box' ? new T.BoxGeometry(...p.size) : new T.CylinderGeometry(...p.size);
        procedural.add(transform(new T.Mesh(geometry, new T.MeshStandardMaterial(p.material)), p));
      }
      if (config.contactShadow) {
        const p = config.contactShadow, canvas = document.createElement('canvas');
        canvas.width = canvas.height = 128;
        const ctx = canvas.getContext('2d'), gradient = ctx.createRadialGradient(64, 64, 5, 64, 64, 64);
        gradient.addColorStop(0, `rgba(0,0,0,${p.opacity})`); gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
        procedural.add(transform(new T.Mesh(new T.PlaneGeometry(...p.size), new T.MeshBasicMaterial({
          map: new T.CanvasTexture(canvas), transparent: true, depthWrite: false,
        })), { position: p.position, rotation: [-Math.PI / 2, 0, 0] }));
      }
      return { config, root, dispose() { root.removeFromParent(); if (asset) releaseInstance(asset); disposeTree(procedural); } };
    } catch (error) { if (asset) releaseInstance(asset); disposeTree(root); throw error; }
  }
  return { cache, loadCharacter, loadEnvironment, loadFurniture,
    loadGarment: (config, character) => product(config, character, !!config.attachment),
    loadAccessory: (config, character) => product(config, character, true),
  };
}
