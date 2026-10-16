import * as THREE from 'three';

const SURFACES = {
  oak: { asset: 'wood_floor', tileSize: 1.7, normalStrength: 0.19 },
  concrete: { asset: 'smooth_concrete_floor', tileSize: 2.8, normalStrength: 0.1 },
};

function floorKind(material) {
  const name = material?.name?.toLowerCase() || '';
  if (name.includes('oak plank flooring')) return 'oak';
  if (name.includes('grey concrete')) return 'concrete';
  return null;
}

function assignWorldUVs(mesh, tileSize) {
  const geometry = mesh.geometry.clone();
  const position = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const uv = new Float32Array(position.count * 2);
  const point = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
  for (let i = 0; i < position.count; i++) {
    point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
    if (normals) normal.fromBufferAttribute(normals, i).applyMatrix3(normalMatrix).normalize();
    else normal.set(0, 1, 0);
    if (Math.abs(normal.y) >= Math.max(Math.abs(normal.x), Math.abs(normal.z))) {
      uv[i * 2] = point.x / tileSize;
      uv[i * 2 + 1] = -point.z / tileSize;
    } else if (Math.abs(normal.x) > Math.abs(normal.z)) {
      uv[i * 2] = point.z / tileSize;
      uv[i * 2 + 1] = point.y / tileSize;
    } else {
      uv[i * 2] = point.x / tileSize;
      uv[i * 2 + 1] = point.y / tileSize;
    }
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  // Imported tangents no longer describe the new, metre-scaled UV coordinates.
  geometry.deleteAttribute('tangent');
  mesh.geometry = geometry;
}

function finishShader(material, kind) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = `varying vec3 vFloorWorld;\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      '#include <worldpos_vertex>\nvFloorWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
    );
    shader.fragmentShader = `varying vec3 vFloorWorld;\n${shader.fragmentShader}`;
    const grading = kind === 'oak'
      ? `float floorLuma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
         diffuseColor.rgb = mix(vec3(floorLuma), diffuseColor.rgb, 0.86);
         diffuseColor.rgb = mix(vec3(0.18, 0.13, 0.075), diffuseColor.rgb, 0.91);`
      : `float floorLuma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
         diffuseColor.rgb = vec3(0.228, 0.235, 0.242) + vec3((floorLuma - 0.12) * 0.62);
         vec2 jointDistance = abs(mod(vFloorWorld.xz + 3.0, 6.0) - 3.0);
         float seamDistance = min(jointDistance.x, jointDistance.y);
         float seamAA = max(fwidth(seamDistance), 0.0015);
         float seam = 1.0 - smoothstep(0.003, 0.003 + seamAA, seamDistance);
         seam *= 1.0 - smoothstep(0.04, 0.1, abs(vFloorWorld.y));
         diffuseColor.rgb *= 1.0 - seam * 0.34;`;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>', `#include <map_fragment>\n${grading}`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `#include <roughnessmap_fragment>\nroughnessFactor = ${kind === 'oak' ? '0.16 + roughnessFactor * 0.16' : '0.24 + roughnessFactor * 0.31'};`,
    );
  };
  material.customProgramCacheKey = () => `msme-pbr-floor-${kind}-v1`;
}

export async function applyFloorMaterials(model, renderer) {
  if (model.userData.floorMaterialStatus) return model.userData.floorMaterialStatus;
  const status = { woodMeshes: 0, concreteMeshes: 0, explicitOakSurface: false, loadedTextures: 0, missingTextures: [] };
  const loader = new THREE.TextureLoader();
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const materialCache = new Map();

  for (const [kind, surface] of Object.entries(SURFACES)) {
    const textures = {};
    for (const [slot, suffix] of Object.entries({ map: 'diff', normalMap: 'nor_gl', roughnessMap: 'rough' })) {
      const path = `${import.meta.env.BASE_URL}materials/${surface.asset}_${suffix}_1k.jpg`;
      try {
        const texture = await loader.loadAsync(path);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.colorSpace = slot === 'map' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        texture.anisotropy = anisotropy;
        textures[slot] = texture;
        status.loadedTextures++;
      } catch {
        status.missingTextures.push(path);
      }
    }
    const material = new THREE.MeshPhysicalMaterial({
      name: kind === 'oak' ? 'MSME | oak plank flooring' : 'MSME | grey concrete',
      color: 0xffffff,
      ...textures,
      roughness: 1,
      metalness: 0,
      normalScale: new THREE.Vector2(surface.normalStrength, surface.normalStrength),
      clearcoat: kind === 'oak' ? 0.65 : 0.2,
      clearcoatRoughness: kind === 'oak' ? 0.19 : 0.3,
      envMapIntensity: kind === 'oak' ? 0.65 : 0.85,
      side: THREE.DoubleSide,
    });
    finishShader(material, kind);
    materialCache.set(kind, material);
  }

  model.updateMatrixWorld(true);
  model.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const previous = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const kinds = previous.map(floorKind);
    const kind = kinds.find(Boolean);
    if (!kind) return;
    assignWorldUVs(mesh, SURFACES[kind].tileSize);
    const materials = previous.map((material, i) => {
      if (!kinds[i]) return material;
      const replacement = materialCache.get(kinds[i]);
      if (material.clippingPlanes?.length) replacement.clippingPlanes = material.clippingPlanes;
      return replacement;
    });
    mesh.material = Array.isArray(mesh.material) ? materials : materials[0];
    mesh.receiveShadow = true;
    mesh.userData.floorFinish = kind;
    if (kind === 'oak') status.woodMeshes++;
    else status.concreteMeshes++;
    const source = `${mesh.name} ${mesh.userData.source_name || ''}`.replaceAll('_', ' ');
    if (source.includes('Oak floor finish above imported slab')) status.explicitOakSurface = true;
  });
  model.userData.floorMaterialStatus = status;
  return status;
}
