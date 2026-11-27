import * as T from 'three';

export function prepareAsset(root, renderer, profile) {
  if (!profile) return; // New inventory keeps its authored PBR materials by default.
  root.traverse(node => { if (node.isMesh) prepareMesh(node, renderer, profile); });
}

function prepareMesh(mesh, renderer, profile) {
  const geometry = mesh.geometry;
  const normals = geometry.getAttribute('normal');
  // Preserve authored seam normals; repair invalid values without faceting UV islands.
  if (!normals) geometry.computeVertexNormals();
  else {
    const fallback = geometry.clone();
    fallback.computeVertexNormals();
    const repaired = fallback.getAttribute('normal');
    const n = new T.Vector3();
    for (let i = 0; i < normals.count; i++) {
      n.fromBufferAttribute(normals, i);
      if (n.lengthSq() < 0.01) {
        n.fromBufferAttribute(repaired, i);
        if (n.lengthSq() < 0.01) n.set(0, 1, 0);
      }
      n.normalize();
      normals.setXYZ(i, n.x, n.y, n.z);
    }
    normals.needsUpdate = true;
    fallback.dispose();
  }
  for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
    material.flatShading = false;
    material.normalScale?.setScalar(profile.normalScale ?? 1);
    material.metalness = profile.metalness ?? material.metalness;
    material.roughness = profile.roughness ?? material.roughness;
    if (material.isMeshPhysicalMaterial) {
      material.ior = profile.ior ?? material.ior;
      material.specularIntensity = profile.specularIntensity ?? material.specularIntensity;
      material.clearcoat = profile.clearcoat ?? material.clearcoat;
    }
    // Keep the atlas and roughness variation; avoid oily highlights where the
    // generated map is near zero. Applies uniformly: no guessed skin masks.
    if (profile.roughnessRange) material.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor, ${Number(profile.roughnessRange[0]).toFixed(4)}, ${Number(profile.roughnessRange[1]).toFixed(4)});`);
    };
    material.customProgramCacheKey = () => JSON.stringify(profile);
    for (const texture of [material.map, material.normalMap, material.roughnessMap, material.metalnessMap]) {
      if (!texture) continue;
      texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      // GLTFLoader already sets base colour to sRGB and data maps to linear.
      texture.needsUpdate = true;
    }
    material.needsUpdate = true;
  }
}
