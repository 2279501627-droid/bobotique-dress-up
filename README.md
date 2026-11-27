# BOBOTIQUE

Static Three.js dress-up viewer. Serve the repository over HTTP, or run
`npm run build` and serve `dist/`. No npm installation is required. Three.js
0.170.0 loads from the existing pinned jsDelivr import map. GitHub Pages can
serve the repository root or the built directory; all app/asset paths are relative.

## Avatar rendering update

- Broad area lights, balanced hemisphere fill and a prefiltered studio environment.
- Explicit sRGB output, ACES tone mapping and native MSAA.
- Restrained dielectric specular response, bounded roughness and reduced normal-map
  intensity. No clearcoat, subdivision, geometry deformation or texture repainting.
- Authored smooth normals retained; only invalid normals repaired from geometry.
- Retained purple showroom, metallic interface, orbit, pinch/wheel zoom and auto rotation.
- Pixel ratio capped at 1.75 and framebuffer capped at 1.8 million pixels;
  animation pauses in background tabs. No dynamic shadow maps or postprocessing.
- Original embedded GLB extracted without changing its bytes. Loading a binary file
  avoids the large inline base64 string and its temporary decoding allocations.

## Asset inspection and limits

The Tripo GLB has one mesh/primitive/material, 20,322 vertices (9,517 unique
positions) and 19,088 triangles. It contains a 4096-square base-colour atlas,
a 2048-square metallic/roughness map and a 2048-square normal map. The normal
inspection found six zero-length normals; other normals were already smooth,
including matching normals across almost all duplicated UV-seam vertices.

Skin, hair, tattoos and clothing share that atlas. The base-colour atlas contains
shading and the hair is solid mesh geometry, not independent strands. Material
adjustments therefore apply conservatively to the whole avatar. Truly separate
skin/hair shading needs authored masks/material assignments and cleaner base-colour
textures. Lighting cannot remove baked shadows or improve the silhouette without
editing the source asset. The original 4K texture is retained to protect facial and
tattoo detail; texture memory remains a mobile constraint.

## Validation

`npm run build` checks JavaScript syntax and creates the static output. Asset
verification confirmed that the extracted GLB is byte-identical to the original,
and HTTP checks passed for the built page, module, model and pinned light/environment
addons. The Cloud Chrome session cannot create a WebGL context, so visual quality,
GPU performance, rotation/pinch rendering and real iPhone Safari remain unverified.
The browser fallback was checked; do not interpret the build check as visual QA.

Before release, check front/back/side views and close-up tattoos in Safari on an
iPhone, pinch and rotate through 360 degrees, reset after resizing/orientation changes,
and background/resume the page. Compare face, hair and dress with the original.
