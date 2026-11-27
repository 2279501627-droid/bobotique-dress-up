# BOBOTIQUE

A static, fully 3D fashion viewer with an asset-driven catalogue. Serve the
repository over HTTP, or run `npm run build` and publish `dist/` on GitHub Pages.
All application and catalogue paths support repository subpaths.

## Add inventory without editing the engine

Upload independent GLBs into `assets/`, then edit `config/catalog.json` for names,
prices, availability, storefront links, fit rules, attachments and transforms.
The game reads the catalogue at startup; no JavaScript rebuild is needed for an
inventory change. The new static files still need to be uploaded/published.

See [the asset authoring guide](docs/ASSETS.md) for complete examples, module
responsibilities, character rigs, clothing, accessories, furniture and showrooms.

## Development

- `npm ci` installs the pinned Three.js development dependency for tests.
- `npm test` runs behavioural tests for cache lifetime, selection races, fit
  rules, cloning, attachment parenting and skeletal garment binding.
- `npm run build` validates modules, JSON and asset paths, then builds static files.
- `python -m http.server 3000` serves the root for local preview.

Runtime Three.js remains pinned to 0.170.0 through the HTML import map. There is
no backend, live Shopify stock sync, upload dashboard or paid dependency.

## Preserved experience and limits

The purple showroom and metallic interface, orbit/zoom/reset/auto rotation,
English UI and camera-icon photo preview/PNG download/mobile share are preserved.
Soft studio lighting, ACES/sRGB rendering, bounded Retina resolution and
background-tab pausing remain in the engine. New inventory keeps its authored
PBR; the original avatar's satin material tuning is an opt-in JSON profile.

The original GLB is byte-identical to the original embedded asset: 19,088
triangles, one shared skin/hair/outfit material, 4K base-colour atlas and 2K
normal/metallic-roughness maps. Authored smooth normals are retained with invalid
normals repaired. Baked shading and the solid hair mesh limit visual refinement.
The scan has no skeleton or independently removable clothing. Future rigged
clothing must match the character's rig and bind pose; there is no automatic
retargeting, fit generation or cloth simulation.

Automated tests use real Three.js scene graphs and synthetic rigs. Cloud Chrome
previously could not create a WebGL context; these tests do not certify rendered
appearance, real iPhone Safari performance or future garment fit. Verify new
assets on actual devices before release.
