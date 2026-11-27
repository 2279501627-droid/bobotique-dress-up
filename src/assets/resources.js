export function disposeTree(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set(), skeletons = new Set();
  root.traverse(node => {
    if (node.geometry) geometries.add(node.geometry);
    for (const mat of Array.isArray(node.material) ? node.material : [node.material]) {
      if (!mat) continue;
      materials.add(mat);
      for (const value of Object.values(mat)) if (value?.isTexture) textures.add(value);
    }
    if (node.skeleton) skeletons.add(node.skeleton);
  });
  skeletons.forEach(x => x.dispose());
  geometries.forEach(x => x.dispose());
  materials.forEach(x => x.dispose());
  textures.forEach(x => { x.dispose(); x.source?.data?.close?.(); });
}
export function releaseInstance(instance) {
  instance.root.removeFromParent();
  // Mesh resources belong to the cache. Only cloned skeleton GPU data is owned here.
  const skeletons = new Set();
  instance.root.traverse(node => { if (node.skeleton) skeletons.add(node.skeleton); });
  skeletons.forEach(s => s.dispose());
  instance.release();
}
