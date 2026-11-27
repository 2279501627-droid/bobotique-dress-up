const kinds = ['characters', 'products', 'environments'];
export function safeURL(value, base) {
  if (!value) return null;
  const url = new URL(value, base);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP(S) asset and shop URLs are supported.');
  return url.href;
}
function vector(value, length, name) {
  if (value !== undefined && (!Array.isArray(value) || value.length !== length || !value.every(Number.isFinite))) {
    throw new Error(`Invalid ${name}: expected ${length} finite numbers.`);
  }
}
export function validateCatalog(data, base) {
  if (data.schemaVersion !== 1) throw new Error('Unsupported catalogue version.');
  const ids = new Set();
  for (const kind of kinds) {
    if (!Array.isArray(data[kind])) throw new Error(`Missing ${kind} array.`);
    for (const item of data[kind]) {
      if (!item.id || !item.name || ids.has(item.id)) throw new Error(`Missing or duplicate asset ID: ${item.id}`);
      ids.add(item.id);
      if (!['available', 'coming-soon', 'sold-out', 'hidden'].includes(item.availability)) throw new Error(`Invalid availability: ${item.id}`);
      if (item.path) safeURL(item.path, base);
      if (item.shopifyUrl) safeURL(item.shopifyUrl, base);
      for (const [key, value] of Object.entries(item.transform || {})) {
        if (!['position', 'rotation', 'scale'].includes(key)) throw new Error(`Unknown transform: ${key}`);
        vector(value, 3, key);
        if (key === 'scale' && value.some(n => n <= 0)) throw new Error('Scale must be positive.');
      }
      if (item.materialProfile && !data.materialProfiles?.[item.materialProfile]) throw new Error(`Unknown material profile: ${item.materialProfile}`);
      if (kind === 'characters') {
        if (item.availability === 'available' && !item.path) throw new Error(`Character needs a GLB: ${item.id}`);
        if (!(item.displayHeight > 0)) throw new Error(`Character needs a positive displayHeight: ${item.id}`);
        for (const anchor of Object.values(item.attachments || {})) {
          vector(anchor.position, 3, 'attachment position'); vector(anchor.rotation, 3, 'attachment rotation');
        }
      }
      if (kind === 'products') {
        if (!['garment', 'accessory', 'furniture'].includes(item.type)) throw new Error(`Unknown product type: ${item.type}`);
        if (!item.slot) throw new Error(`Product needs a slot: ${item.id}`);
        if (item.availability === 'available' && !item.path) throw new Error(`Available product needs a GLB: ${item.id}`);
        if (item.price !== null && item.price !== undefined && (!Number.isFinite(item.price) || item.price < 0)) throw new Error(`Invalid price: ${item.id}`);
        if (item.price != null) new Intl.NumberFormat('en', { style: 'currency', currency: item.currency }).format(item.price);
        if (item.type === 'accessory' && !item.attachment) throw new Error(`Accessory needs an attachment: ${item.id}`);
        if (item.fit && !['rigid', 'skinned'].includes(item.fit)) throw new Error(`Unknown fit mode: ${item.fit}`);
        if (item.fit === 'skinned' && !item.compatibleRig) throw new Error(`Skinned garment needs compatibleRig: ${item.id}`);
      }
      if (kind === 'environments') {
        vector(item.spawn, 3, 'spawn');
        if (!item.path && !Array.isArray(item.primitives)) throw new Error(`Environment needs a path or primitives: ${item.id}`);
        for (const p of item.primitives || []) {
          if (!['box', 'cylinder'].includes(p.shape)) throw new Error(`Unsupported primitive: ${p.shape}`);
          vector(p.size, p.shape === 'box' ? 3 : 4, 'primitive size');
          vector(p.position, 3, 'primitive position');
        }
      }
    }
  }
  for (const [key, kind] of [['character', 'characters'], ['environment', 'environments']]) {
    if (!data[kind].some(x => x.id === data.defaults?.[key] && x.availability === 'available')) throw new Error(`Invalid default ${key}.`);
  }
  safeURL(data.store?.url, base);
  const maxIdle = data.performance?.maxIdleAssets;
  if (maxIdle !== undefined && (!Number.isInteger(maxIdle) || maxIdle < 0 || maxIdle > 8)) throw new Error('maxIdleAssets must be an integer from 0 to 8.');
  for (const profile of Object.values(data.materialProfiles || {})) {
    if (profile.roughnessRange) {
      vector(profile.roughnessRange, 2, 'roughness range');
      const [min, max] = profile.roughnessRange;
      if (min < 0 || max > 1 || min > max) throw new Error('Invalid roughness range.');
    }
  }
  return data;
}
export async function loadCatalog(url) {
  // Revalidate inventory on each visit; GLBs should use versioned filenames.
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Catalogue could not load (${response.status}).`);
  const data = validateCatalog(await response.json(), url);
  return { ...data, baseURL: url };
}
export function compatible(product, character) {
  if (!character) return product.type === 'furniture';
  if (product.compatibleCharacters && !product.compatibleCharacters.includes(character.id)) return false;
  if (product.compatibleRig && product.compatibleRig !== character.rig?.id) return false;
  if (product.attachment && !character.attachments?.[product.attachment]) return false;
  return true;
}
