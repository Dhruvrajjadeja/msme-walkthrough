import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

const floorReflectionShader = {
  name: 'MSME restrained floor reflection',
  uniforms: {
    color: { value: new THREE.Color(0xffffff) },
    tDiffuse: { value: null },
    textureMatrix: { value: new THREE.Matrix4() },
    tNormal: { value: null },
    hasNormal: { value: 0 },
    texel: { value: new THREE.Vector2(1 / 768, 1 / 512) },
    strength: { value: 0.17 },
    blurRadius: { value: 2.3 },
  },
  vertexShader: `
    uniform mat4 textureMatrix;
    varying vec4 vReflection;
    varying vec3 vFloorWorld;
    varying vec2 vSurfaceUV;
    #include <common>
    #include <logdepthbuf_pars_vertex>
    void main() {
      vReflection = textureMatrix * vec4(position, 1.0);
      vFloorWorld = (modelMatrix * vec4(position, 1.0)).xyz;
      vSurfaceUV = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      #include <logdepthbuf_vertex>
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform sampler2D tNormal;
    uniform float hasNormal;
    uniform vec2 texel;
    uniform float strength;
    uniform float blurRadius;
    varying vec4 vReflection;
    varying vec3 vFloorWorld;
    varying vec2 vSurfaceUV;
    #include <common>
    #include <logdepthbuf_pars_fragment>
    void main() {
      #include <logdepthbuf_fragment>
      vec2 uv = vReflection.xy / vReflection.w;
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;
      if (hasNormal > 0.5) {
        vec2 microNormal = texture2D(tNormal, vFloorWorld.xz / 2.8).rg * 2.0 - 1.0;
        uv += microNormal * 0.0007;
      }
      vec2 radius = texel * blurRadius;
      vec3 reflection = texture2D(tDiffuse, uv).rgb * 0.22;
      reflection += texture2D(tDiffuse, uv + vec2(radius.x, 0.0)).rgb * 0.12;
      reflection += texture2D(tDiffuse, uv - vec2(radius.x, 0.0)).rgb * 0.12;
      reflection += texture2D(tDiffuse, uv + vec2(0.0, radius.y)).rgb * 0.12;
      reflection += texture2D(tDiffuse, uv - vec2(0.0, radius.y)).rgb * 0.12;
      reflection += texture2D(tDiffuse, uv + radius).rgb * 0.075;
      reflection += texture2D(tDiffuse, uv - radius).rgb * 0.075;
      reflection += texture2D(tDiffuse, uv + vec2(radius.x, -radius.y)).rgb * 0.075;
      reflection += texture2D(tDiffuse, uv + vec2(-radius.x, radius.y)).rgb * 0.075;
      float grazing = 1.0 - abs(normalize(cameraPosition - vFloorWorld).y);
      float fresnel = 0.4 + 0.6 * pow(grazing, 2.0);
      vec2 border = min(vSurfaceUV, vec2(1.0) - vSurfaceUV);
      float edgeFade = smoothstep(0.0, 0.025, min(border.x, border.y));
      gl_FragColor = vec4(reflection, strength * fresnel * edgeFade);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
};

export function createFloorReflections(model, renderer, { oak = false } = {}) {
  const group = new THREE.Group();
  group.name = 'Subtle real floor reflections';
  group.userData = { category: '12 Floor reflections', skipCollision: true, excludeFromSection: true };
  const objects = [];
  let renderingReflection = false;
  let concreteNormal = null;
  let oakTop = 0.203;
  model.updateMatrixWorld(true);
  model.traverse((mesh) => {
    if (!mesh.isMesh) return;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (material.name.includes('grey concrete')) concreteNormal = material.normalMap;
    }
    if (`${mesh.name} ${mesh.userData.source_name || ''}`.replaceAll('_', ' ').includes('Oak floor finish above imported slab')) {
      oakTop = new THREE.Box3().setFromObject(mesh).max.y;
    }
  });

  const width = Math.min(768, renderer.capabilities.maxTextureSize);
  const height = Math.min(512, renderer.capabilities.maxTextureSize);
  function addSurface(name, size, position, strength) {
    const surface = new Reflector(new THREE.PlaneGeometry(...size), {
      textureWidth: width, textureHeight: height, multisample: 0,
      clipBias: 0.001, shader: floorReflectionShader,
    });
    surface.name = name;
    surface.rotation.x = -Math.PI / 2;
    surface.position.fromArray(position);
    surface.userData = { category: '12 Floor reflections', skipCollision: true, excludeFromSection: true };
    surface.renderOrder = 1;
    surface.raycast = () => {};
    surface.material.transparent = true;
    surface.material.depthWrite = false;
    surface.material.uniforms.strength.value = strength;
    surface.material.uniforms.texel.value.set(1 / width, 1 / height);
    surface.material.uniforms.tNormal.value = concreteNormal;
    surface.material.uniforms.hasNormal.value = concreteNormal ? 1 : 0;
    const renderReflection = surface.onBeforeRender;
    let lastUpdate = -Infinity;
    surface.onBeforeRender = function (activeRenderer, scene, camera) {
      if (renderingReflection || scene.overrideMaterial || !camera.isPerspectiveCamera) return;
      const now = performance.now();
      if (now - lastUpdate < 33) return;
      lastUpdate = now;
      renderingReflection = true;
      // Each reflection sees the actual pavilion, never another reflection plane.
      const visibility = objects.map((object) => object.visible);
      for (const object of objects) if (object !== surface) object.visible = false;
      try {
        renderReflection.call(this, activeRenderer, scene, camera);
      } finally {
        objects.forEach((object, index) => { object.visible = visibility[index]; });
        renderingReflection = false;
      }
    };
    group.add(surface);
    objects.push(surface);
  }

  // The hall slab is centred at -0.13 m with a thickness of 0.26 m.
  addSurface('Polished concrete entrance reflection', [29.6, 17], [0, 0.006, 24.5], 0.19);
  if (oak) addSurface('Polished oak reflection', [11.98, 28.98], [-0.427, oakTop + 0.003, 1.06], 0.48);
  (model.parent || model).add(group);
  group.updateMatrixWorld(true);
  return {
    objects,
    group,
    setEnabled(enabled) { group.visible = Boolean(enabled); },
    dispose() {
      group.removeFromParent();
      for (const object of objects) { object.dispose(); object.geometry.dispose(); }
    },
  };
}
