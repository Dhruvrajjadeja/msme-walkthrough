import { HalfFloatType, Vector2, WebGLRenderTarget } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export function createRenderPipeline(renderer, scene, camera, { mobile = false } = {}) {
  const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType });
  target.samples = Math.min(mobile ? 0 : 2, renderer.capabilities.maxSamples);
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(1);
  const base = new RenderPass(scene, camera);
  composer.addPass(base);

  const ao = mobile ? null : new GTAOPass(scene, camera, 1, 1);
  if (ao) {
    ao.blendIntensity = 0.34;
    ao.updateGtaoMaterial({
      radius: 0.28,
      thickness: 0.18,
      distanceExponent: 1.3,
      distanceFallOff: 1,
      scale: 1,
      samples: 8,
      screenSpaceRadius: false,
    });
    ao.updatePdMaterial({ samples: 8, radius: 4, rings: 2, depthPhi: 2, normalPhi: 3 });
    composer.addPass(ao);
  }

  const bloom = new UnrealBloomPass(new Vector2(1, 1), mobile ? 0.13 : 0.20, 0.35, 1.0);
  composer.addPass(bloom);
  // Keep lighting and bloom linear; tone mapping and display conversion happen only here.
  const output = new OutputPass();
  composer.addPass(output);
  let bufferWidth = 0;
  let bufferHeight = 0;

  function resize(width, height) {
    const ratio = Math.min(renderer.getPixelRatio(), mobile ? 1 : 1.5);
    const longest = Math.max(1, width, height);
    const scale = Math.min(ratio, (mobile ? 1440 : 2200) / longest);
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    if (w === bufferWidth && h === bufferHeight) return;
    bufferWidth = w;
    bufferHeight = h;
    composer.setSize(w, h);
    // AO needs contact-scale detail, not the full display resolution.
    if (ao) ao.setSize(Math.max(1, Math.round(w * 0.7)), Math.max(1, Math.round(h * 0.7)));
  }

  const size = renderer.getSize(new Vector2());
  resize(size.x, size.y);

  return {
    resize,
    render(activeCamera, { plan = false } = {}) {
      if (plan) {
        renderer.setRenderTarget(null);
        renderer.render(scene, activeCamera);
        return;
      }
      base.camera = activeCamera;
      if (ao) {
        ao.camera = activeCamera;
        ao.enabled = activeCamera.isPerspectiveCamera;
      }
      composer.render();
    },
    dispose() {
      ao?.dispose();
      bloom.dispose();
      output.dispose();
      composer.dispose();
    },
  };
}
