/**
 * Recursively dispose all GPU resources (geometries, materials, textures) from an Object3D.
 */
export function disposeObject3D(obj) {
  if (!obj) return;

  obj.traverse((child) => {
    if (child.geometry) {
      child.geometry.dispose();
    }
    if (child.material) {
      _disposeMaterial(child.material);
    }
    // InstancedMesh instance matrix buffer
    if (child.instanceMatrix) {
      child.instanceMatrix = null;
    }
  });
}

function _disposeMaterial(material) {
  if (Array.isArray(material)) {
    for (const mat of material) _disposeMaterial(mat);
    return;
  }
  if (material.map) material.map.dispose();
  if (material.emissiveMap) material.emissiveMap.dispose();
  if (material.normalMap) material.normalMap.dispose();
  material.dispose();
}
