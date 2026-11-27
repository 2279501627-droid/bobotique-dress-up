import * as T from 'three';
export function uniqueBones(root) {
  const bones = new Map();
  root.traverse(node => {
    if (!node.isBone) return;
    if (!node.name || bones.has(node.name)) throw new Error('Rigs need unique, nonempty bone names.');
    bones.set(node.name, node);
  });
  return bones;
}
export function bindGarment(root, character) {
  const bones = uniqueBones(character.model);
  const inverses = new Map();
  character.model.traverse(node => {
    if (node.isSkinnedMesh) node.skeleton.bones.forEach((bone, i) => inverses.set(bone.name, node.skeleton.boneInverses[i]));
  });
  const meshes = [];
  root.traverse(node => { if (node.isSkinnedMesh) meshes.push(node); });
  if (!meshes.length) throw new Error('This garment has no skinned mesh.');
  // Validate all meshes before mutating any skeleton. Never silently retarget.
  const plans = meshes.map(mesh => ({ mesh, bones: mesh.skeleton.bones.map((bone, i) => {
    const inverse = inverses.get(bone.name);
    if (!bones.has(bone.name) || !inverse || inverse.elements.some((n, j) => Math.abs(n - mesh.skeleton.boneInverses[i].elements[j]) > 0.0001)) {
      throw new Error(`Incompatible bind pose or missing bone: ${bone.name}`);
    }
    return bones.get(bone.name);
  }) }));
  const oldSkeletons = new Set();
  for (const { mesh, bones: mapped } of plans) {
    oldSkeletons.add(mesh.skeleton);
    mesh.bind(new T.Skeleton(mapped, mesh.skeleton.boneInverses.map(m => m.clone())), mesh.bindMatrix.clone());
  }
  oldSkeletons.forEach(s => s.dispose());
}
