# Adding characters, inventory and showrooms

The application reads `config/catalog.json` at startup. Catalogue edits and new
GLB files do not require changing or compiling JavaScript. Upload the files to
the static host (or commit them to the GitHub Pages publishing branch) and reload.
For the packaged Sites demo, republish the static files after a catalogue edit.
This is not an in-game upload dashboard and does not write back to Shopify.

## Architecture

| Location | Responsibility |
| --- | --- |
| `src/app.js` | Bootstrap and connect modules; no character/product IDs or asset paths |
| `src/engine/engine.js` | Renderer, colour management, lights, frame timing, camera, resize |
| `src/engine/wardrobe.js` | Transactional selections, equipment slots, removal, cleanup |
| `src/assets/catalog.js` | Validate JSON, resolve URLs, check fit eligibility |
| `src/assets/loaders.js` | Reusable character, garment, accessory, furniture and environment loaders |
| `src/assets/cache.js` | Deduplicated asynchronous loads, reference counting, idle LRU eviction |
| `src/assets/rigs.js` | Bone lookup and strict compatible-skeleton garment binding |
| `src/assets/materials.js` | Opt-in material profiles; preserve authored PBR by default |
| `src/ui/` | Catalogue UI and existing visual styling |
| `src/interactions/` | Orbit/zoom/reset/auto controls and photo preview/export/share |
| `config/catalog.json` | Asset metadata, default selections, showroom and rendering configuration |
| `assets/` | External GLBs; arbitrary nested inventory folders are supported |

The initial visit loads only the default character and environment. Additional
assets load on selection. Pending requests for the same asset share one promise;
instances clone skeletons but share cached geometry/materials/textures. Different
catalogue IDs have distinct cache entries, so different material profiles cannot
contaminate each other. Active assets are pinned; by default only one unused
asset remains cached. Set `performance.maxIdleAssets` to 0 to release assets as
soon as they are removed, at the cost of repeat downloads/decoding.

Failed replacements keep the prior look. Newer requests supersede old requests.
An in-flight download is allowed to finish for cache reuse, but stale results are
released and cannot replace the current look. Clothing and accessories clear on
character changes; furniture stays until removed or replaced in its slot.

## Common rules

- IDs must be unique across every array. Names are plain text, never HTML.
- `path` is relative to **the catalogue file**, not the page. Thus
  `../assets/bags/mini-v1.glb` works at a GitHub Pages repository subpath.
- Self-contained `.glb` is recommended. External GLTF textures must keep their
  relative folder structure. Cross-origin models/textures require CORS headers
  so loading and photo exports work. Never put Shopify admin credentials in JSON.
- `availability`: `available`, `coming-soon`, `sold-out` or `hidden`. Available
  characters/products need a path. Unavailable items do not load; hidden ones do
  not appear. Selectors appear automatically when multiple choices are available.
- `transform.position`: `[x,y,z]`; `transform.rotation`: radians in XYZ order;
  `transform.scale`: positive `[x,y,z]`. Three.js uses Y-up.
- Product `price` is a major-unit number (e.g. `125.00`), or `null` when unknown.
  `currency` is an ISO currency code. `shopifyUrl` is a public storefront product
  URL. Price/stock are manually supplied metadata, not a live Shopify integration.
- `slot` determines replacement: e.g. `dress`, `handbag`, `eyewear`, `necklace`,
  `earring-left`, `shoes`, `sofa`. Different slots coexist. Select an equipped item
  again or use its Remove button to unequip it.
- Use versioned filenames (`bag-v2.glb`) when replacing a binary to avoid stale
  HTTP caches. The catalogue uses fetch revalidation on each page visit.
- Keep models centred, apply transforms in your DCC, export correct normals, and
  use a consistent scale/bind-space convention across a rig family. Test close-up,
  rear view, animation and photo exports on actual iPhone Safari before release.

## Add a character

Place a GLB in `assets/characters/` and append to `characters`:

```json
{
  "id": "model-b",
  "name": "Model B",
  "availability": "available",
  "path": "../assets/characters/model-b-v1.glb",
  "displayHeight": 1.7,
  "rig": { "id": "fashion-rig-v1" },
  "animation": "Idle",
  "outfitDescription": "Choose your look",
  "transform": { "position": [0,0,0], "rotation": [0,0,0], "scale": [1,1,1] },
  "attachments": {
    "rightHand": { "bone": "RightHand", "position": [0,0,0], "rotation": [0,0,0] },
    "eyewear": { "bone": "Head", "position": [0,0.08,0.09] },
    "neck": { "bone": "Neck", "position": [0,0,0.03] }
  }
}
```

Omit `animation` if there is no embedded clip of that name. Embedded GLB clips
populate the Pose selector and run through an AnimationMixer; no animation
retargeting is performed. Use `rig: null` for static characters.

The loader normalizes the character to `displayHeight` and centres its feet.
The selected environment's `spawn` is added to the character position. Bone
anchors use the bone's authored local units; they follow its animation and inherit
normalization. Anchors with no `bone` use normalized character-local units, with
the origin at the floor between its feet; these work for static scans. Adjust
positions in JSON after testing the matching accessory. Attachment names are
arbitrary reusable keys; product `attachment` selects a key.

The provided Founder is one static, unrigged mesh with its outfit already baked
in. Its fallback attachment coordinates are starting points, not validated fits
for future products. It cannot remove its baked dress or animate its limbs.

## Add a handbag, sunglasses, jewellery or rigid shoes

Append a product (the paths below are examples; supply the actual files):

```json
{
  "id": "silver-mini-bag",
  "type": "accessory",
  "slot": "handbag",
  "name": "Silver Mini Bag",
  "price": 125,
  "currency": "GBP",
  "availability": "available",
  "path": "../assets/bags/silver-mini-v1.glb",
  "shopifyUrl": "https://your-store.example/products/silver-mini-bag",
  "attachment": "rightHand",
  "compatibleCharacters": ["model-b"],
  "transform": { "position": [0,0,0], "rotation": [0,0,0], "scale": [1,1,1] }
}
```

The product transform is relative to its attachment. Its origin should be the
handle grip, bridge of sunglasses or jewellery attachment point. Use `eyewear`,
`neck`, separate earring or wrist keys as appropriate. Footwear can be a garment
or separate left/right foot accessories; add foot anchors in the character config.
Do not guess compatibility: explicitly list tested `compatibleCharacters`, or a
`compatibleRig` for a standardized family. Optional restrictions intersect.

## Independent clothing and shared rigs

```json
{
  "id": "black-dress",
  "type": "garment",
  "slot": "dress",
  "name": "Black Dress",
  "price": 240,
  "currency": "GBP",
  "availability": "available",
  "path": "../assets/clothing/black-dress-v1.glb",
  "shopifyUrl": "https://your-store.example/products/black-dress",
  "fit": "skinned",
  "compatibleRig": "fashion-rig-v1",
  "transform": { "position": [0,0,0], "rotation": [0,0,0], "scale": [1,1,1] }
}
```

Skinned garments must be exported in the character's **same scene origin, units,
bind pose and bind space**, with matching bone names and inverse bind matrices.
The loader checks names and matrices and binds garment meshes to the character's
bones; the character mixer then drives both. A matching rig ID alone is not enough.
This is not auto-fitting, cloth simulation, arbitrary rig retargeting or collision
correction. Skin weights, body shape, clipping and mesh layers must be authored
and verified. Use an unclothed or appropriately segmented character; the current
scan's baked outfit cannot be hidden independently. Different body shapes may
need separate garment variants even when their skeletons match.

For independent static clothing on a static character, use `fit: "rigid"`, omit
`attachment`, and export the garment in the character's original GLB coordinate
space. It inherits the character normalization. For a rigid piece attached to a
bone or anchor, supply `attachment` instead. Non-identity transforms on skinned
garments can break bind-space alignment; keep them at identity unless authored
and tested together.

## Furniture and showroom environments

Furniture is a product with `type: "furniture"` and a unique furniture `slot`.
Its transform uses showroom/world coordinates, not character-local coordinates.
It loads only when selected and can be removed like clothing.

Add an environment in `environments`:

```json
{
  "id": "loft",
  "name": "Night Loft",
  "availability": "available",
  "path": "../assets/environments/loft-v1.glb",
  "transform": { "position": [0,0,0], "rotation": [0,0,0], "scale": [1,1,1] },
  "spawn": [0,0,0],
  "background": "#21192c",
  "lighting": {
    "environmentIntensity": 0.65,
    "hemisphere": { "sky": "#f0edf7", "ground": "#695671", "intensity": 0.8 },
    "panels": [{ "position": [-2.5,3.4,3], "target": [0,0.95,0], "width": 3, "height": 4, "intensity": 3.5, "color": "#fff3e8" }]
  }
}
```

`spawn` is world-space, even if the environment GLB has a transform. The existing
purple showroom is preserved as JSON `primitives` (box/cylinder) plus a lightweight
contact shadow; it can be replaced by an external environment GLB. Neutral studio
IBL remains built-in. This version does not expose HDR file loading in the catalogue.

## Materials, memory and publication

New models use their authored materials. The original scanned character opts
into `materialProfile: "scan-satin"`; do not apply that profile to metallic bags
or jewellery. Named profiles can be edited in `materialProfiles` without changing
loaders. Assets sharing an ID cannot have per-instance material variations; use
separate catalogue IDs for variants.

The current 4K skin texture remains unchanged. Cache counts are not a byte budget:
large scenes or many simultaneously equipped products can still exhaust mobile
GPU memory. Prefer compact geometry and textures, inspect memory on target devices,
and unload unused slots. Draco/KTX2 decoder setup is not included; use standard
GLBs for this version or add and self-host appropriate decoders later.

Run `npm ci` then `npm test` for the synthetic cache, race, rig and catalogue tests.
`npm run build` validates the catalogue and every JS module, checks local paths,
and copies the static site into `dist/`. No runtime server, bundler, paid service
or npm package is needed on the host. Three.js uses the existing pinned CDN import
map; the pinned npm copy is only for automated tests.
