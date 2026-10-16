import './style.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { Octree } from 'three/addons/math/Octree.js';
import { Capsule } from 'three/addons/math/Capsule.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { loadAtlas, drawAtlas, selectAtlasAt, CRAFTS } from './atlas.js';
import { rebuildEntrance } from './entrance.js';
import { applyFloorMaterials } from './floor-materials.js';
import { createFloorReflections } from './floor-reflections.js';
import { createRenderPipeline } from './render-quality.js';
import { refinePavilion } from './pavilion-refinement.js';
import { createIcons, Orbit, Footprints, Scan, RotateCcw, Maximize, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Map, X } from 'lucide';

createIcons({ icons: { Orbit, Footprints, Scan, RotateCcw, Maximize, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Map, X } });
const $ = (id) => document.getElementById(id);
const touch = matchMedia('(pointer: coarse)').matches;
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
} catch (error) { showError('This browser could not start 3D rendering. Try opening the link in Chrome or Edge.'); throw error; }
renderer.setPixelRatio(Math.min(devicePixelRatio, touch ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = .72;
renderer.localClippingEnabled = true;
RectAreaLightUniformsLib.init();
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('viewport').appendChild(renderer.domElement);
renderer.domElement.setAttribute('aria-label', 'Pavilion 3D view');
renderer.domElement.tabIndex = 0;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#252b30');
const camera = new THREE.PerspectiveCamera(touch ? 75 : 50, innerWidth / innerHeight, 0.08, 160);
const planCamera = new THREE.OrthographicCamera(-20,20,20,-20,0.1,100);
let activeCamera = camera;
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.dampingFactor = 0.1;
orbit.minDistance = 2;
orbit.maxDistance = 28;
orbit.maxPolarAngle = Math.PI * 0.51;
const planOrbit = new OrbitControls(planCamera, renderer.domElement);
planOrbit.enableRotate = false;
planOrbit.enableDamping = true;
planOrbit.minZoom = 0.6;
planOrbit.maxZoom = 4;
planOrbit.enabled = false;
const pointer = new PointerLockControls(camera, renderer.domElement);
const hemi = new THREE.HemisphereLight(0xeff2ff, 0x77716b, .27);
scene.add(hemi);
const pmrem = new THREE.PMREMGenerator(renderer);
const room = new RoomEnvironment();
const env = pmrem.fromScene(room, 0.04);
scene.environment = env.texture;
scene.environmentIntensity = 0.42;
room.dispose(); pmrem.dispose();
const fill = new THREE.DirectionalLight(0xfff7eb, 0.17);
fill.position.set(4,8,3);
scene.add(fill);
const pipeline = createRenderPipeline(renderer, scene, camera, { mobile: touch });
let reflections, entranceLighting, displayLighting;
const world = new Octree();
const collider = new Capsule(new THREE.Vector3(9,0.55,19), new THREE.Vector3(9,1.4,19), 0.3);
const forward = new THREE.Vector3(), right = new THREE.Vector3(), delta = new THREE.Vector3();
const keys = new Set();
const modeButtons = [...document.querySelectorAll('[data-mode]')];
let mode = 'orbit', model, ready = false, dragging = false, dragX = 0, dragY = 0, lightGroup;
const euler = new THREE.Euler(0,0,0,'YXZ');
const home = new THREE.Vector3(-.427,2.2,touch ? 32 : 26.1);
const homeTarget = new THREE.Vector3(-.427,1.85,14.5);
const labels = {orbit:'Pavilion interior',walk:'Pavilion walkthrough',plan:'Sectional floor plan'};
const sectionPlane=new THREE.Plane(new THREE.Vector3(0,-1,0),1.3);
const sectionEdges=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0x182d39,depthTest:false}));sectionEdges.renderOrder=20;sectionEdges.visible=false;scene.add(sectionEdges);
function updateSection(){
  const points=[],height=sectionPlane.constant;
  model.traverse(o=>{
    if(!o.isMesh||!isPavilion(o)||o.userData.sectionSkip||o.isInstancedMesh)return;
    const p=o.geometry.attributes.position,index=o.geometry.index;
    const v=[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()];
    const count=index?index.count:p.count;
    for(let i=0;i<count;i+=3){
      for(let k=0;k<3;k++)v[k].fromBufferAttribute(p,index?index.getX(i+k):i+k).applyMatrix4(o.matrixWorld);
      const hits=[];
      for(let k=0;k<3;k++){const a=v[k],b=v[(k+1)%3],da=a.y-height,db=b.y-height;if(da*db<0){const t=da/(da-db);hits.push([a.x+(b.x-a.x)*t,height+.006,a.z+(b.z-a.z)*t]);}}
      if(hits.length===2)points.push(...hits[0],...hits[1]);
    }
  });
  sectionEdges.geometry.dispose();sectionEdges.geometry=new THREE.BufferGeometry();sectionEdges.geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
}
const treeClock={value:0};
let animationTimeOverride=null;
let atlas,atlasTexture;
let updateExhibits=()=>{};
const screens=[];
const groundRay = new THREE.Raycaster();
let walkGround = 0;
const floorMeshes = [];
modeButtons.forEach(b => b.disabled = true);

function showError(message) {
  $('loading').hidden = true; $('error').hidden = false; $('error-text').textContent = message;
}
$('retry').onclick = () => location.reload();

function reset() {
  keys.clear(); walkGround = 0;
  if (mode === 'plan') {
    const size = new THREE.Box3();
    model.traverse(o => { if (o.isMesh && isPavilion(o)) size.expandByObject(o); });
    const center = size.getCenter(new THREE.Vector3());
    planCamera.position.set(center.x,40,center.z);
    planCamera.up.set(0,0,-1);
    planCamera.lookAt(center.x,0,center.z);
    planCamera.zoom = 1;
    planOrbit.target.set(center.x,0,center.z);
    planCamera.updateProjectionMatrix();
    planOrbit.update();
  } else if (mode === 'walk') {
    walkGround=.203;camera.position.set(-.4,1.903,12.1);
    camera.lookAt(-.4,1.8,.7);
    collider.start.set(-.4,walkGround+.55,12.1); collider.end.set(-.4,walkGround+1.4,12.1);
  } else {
    camera.position.copy(home); orbit.target.copy(homeTarget); orbit.update();
  }
}
function category(o) { for(let p=o;p;p=p.parent)if(p.userData.category)return p.userData.category;return ''; }
function isPavilion(o) { return /^(01|09|10|11)/.test(category(o)) || o.name.startsWith('Geom3D'); }
function setMode(next) {
  if (!ready) return;
  if (pointer.isLocked) pointer.unlock();
  keys.clear(); dragging = false; mode = next;
  orbit.enabled = next === 'orbit'; planOrbit.enabled = next === 'plan';
  activeCamera = next === 'plan' ? planCamera : camera;
  model.traverse(o => { if(o.isMesh) {o.visible = next !== 'plan' || isPavilion(o);for(const m of Array.isArray(o.material)?o.material:[o.material])m.clippingPlanes=next==='plan'?[sectionPlane]:[];} });
  lightGroup.visible = next !== 'plan';
  if(entranceLighting)entranceLighting.visible=next!=='plan';
  if(displayLighting)displayLighting.visible=next!=='plan';
  reflections?.setEnabled(next!=='plan');
  hemi.intensity = next === 'plan' ? 2.2 : .27;
  camera.fov=touch?75:next==='walk'?60:50;camera.updateProjectionMatrix();
  sectionEdges.visible=next==='plan';if(next==='plan')updateSection();
  $('section-control').hidden=next!=='plan';$('viewpoint').hidden=next==='plan';
  scene.background.set(next === 'plan' ? '#e8eceb' : '#252b30');
  $('view-label').textContent = labels[next];
  $('resume').hidden = next !== 'walk' || touch;
  $('touch-controls').hidden = next !== 'walk' || !touch;
  $('crosshair').hidden = true;
  modeButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===next)));
  reset(); resize();
  if (next === 'walk') renderer.domElement.focus();
  if (next === 'walk' && !touch) lockPointer();
}
function lockPointer() {
  try { const result = pointer.lock(); result?.catch?.(() => { $('resume').hidden = true; }); }
  catch { $('resume').hidden = true; }
}
modeButtons.forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
$('reset').onclick=reset;
$('resume').onclick=lockPointer;
$('section-height').oninput=e=>{sectionPlane.constant=Number(e.target.value);$('section-value').textContent=sectionPlane.constant.toFixed(2)+' m';updateSection();};
$('viewpoint').onchange=e=>{
  if(mode!=='orbit')setMode('orbit');
  const views={entry:[[1.35,1.85,12.9],[-.427,2.35,6]],front:[home.toArray(),homeTarget.toArray()],back:[[2.5,2.1,8.6],[-.427,1.8,12.45]],craft:[[-1.3,1.65,8.7],[-4.62,1.55,8.07]],map:[touch?[2.7,2.6,3.3]:[3.1,2.1,1.2],[-.427,1.15,-1.65]],end:[[-.427,1.85,-5.55],[-.427,1.7,-11]]};
  const [p,t]=views[e.target.value];camera.position.fromArray(p);orbit.target.fromArray(t);orbit.update();
  $('view-label').textContent=e.target.selectedOptions[0].textContent;
};
function openAtlas(){if(!atlas)return;if(pointer.isLocked)pointer.unlock();keys.clear();$('atlas-dialog').showModal();$('atlas-close').focus();}
$('atlas-open').onclick=openAtlas;$('atlas-close').onclick=()=>$('atlas-dialog').close();
$('atlas-dialog').addEventListener('close',()=>renderer.domElement.focus());
document.addEventListener('pointerlockerror',()=>{ $('resume').hidden=true; });
pointer.addEventListener('lock',()=>{ renderer.domElement.focus(); $('resume').hidden=true; $('crosshair').hidden=false; });
pointer.addEventListener('unlock',()=>{ keys.clear(); $('resume').hidden=mode!=='walk'||touch; $('crosshair').hidden=true; });
$('fullscreen').onclick = async () => {
  try { if(document.fullscreenElement) await document.exitFullscreen(); else await $('app').requestFullscreen(); } catch { /* The embedded browser may disallow fullscreen. */ }
};
document.addEventListener('fullscreenchange',()=>{ $('fullscreen').setAttribute('aria-label',document.fullscreenElement?'Exit fullscreen':'Fullscreen'); });

function resize() {
  const w=innerWidth,h=innerHeight;
  renderer.setSize(w,h); camera.aspect=w/h;camera.updateProjectionMatrix();
  pipeline.resize(w,h);
  const halfH=Math.max(18,10.5/(w/h));
  planCamera.left=-halfH*w/h;planCamera.right=halfH*w/h;planCamera.top=halfH;planCamera.bottom=-halfH;planCamera.updateProjectionMatrix();
}
addEventListener('resize',resize);
addEventListener('keydown',e=>{
  if(e.code==='Escape'&&pointer.isLocked){pointer.unlock();return;}
  if($('atlas-dialog').open)return;
  if(mode==='walk'&&e.code==='KeyE'){openAtlas();return;}
  if(mode!=='walk'||e.target.closest('button,input,select')) return;
  if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) { keys.add(e.code);e.preventDefault(); }
});
addEventListener('keyup',e=>keys.delete(e.code));
addEventListener('blur',()=>{keys.clear();dragging=false;});
document.addEventListener('visibilitychange',()=>{if(document.hidden)keys.clear();});
const moveKeys={forward:'KeyW',back:'KeyS',left:'KeyA',right:'KeyD'};
document.querySelectorAll('[data-move]').forEach(b=>{
  b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(moveKeys[b.dataset.move]);};
  b.onpointerup=b.onpointercancel=b.onlostpointercapture=()=>keys.delete(moveKeys[b.dataset.move]);
});
renderer.domElement.addEventListener('pointerdown',e=>{
  if(mode!=='walk'||pointer.isLocked)return;
  dragging=true;dragX=e.clientX;dragY=e.clientY;renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener('pointermove',e=>{
  if(!dragging||mode!=='walk'||pointer.isLocked)return;
  euler.setFromQuaternion(camera.quaternion);euler.y-=(e.clientX-dragX)*.004;euler.x=THREE.MathUtils.clamp(euler.x-(e.clientY-dragY)*.004,-1.25,1.25);camera.quaternion.setFromEuler(euler);dragX=e.clientX;dragY=e.clientY;
});
renderer.domElement.addEventListener('pointerup',()=>dragging=false);
renderer.domElement.addEventListener('pointercancel',()=>dragging=false);

function updateWalk(dt) {
  const moveZ=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown'));
  const moveX=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));
  if(!moveZ&&!moveX)return;
  camera.getWorldDirection(forward);forward.y=0;forward.normalize();right.crossVectors(forward,camera.up).normalize();
  delta.copy(forward).multiplyScalar(moveZ).addScaledVector(right,moveX).normalize().multiplyScalar(2.6*dt);
  collider.translate(delta);
  for(let i=0;i<4;i++) {
    const hit=world.capsuleIntersect(collider);
    if(!hit)break;
    collider.translate(hit.normal.multiplyScalar(hit.depth+0.0001));
  }
  const x=THREE.MathUtils.clamp(collider.end.x,-14.65,14.65);
  const z=THREE.MathUtils.clamp(collider.end.z,-32.95,32.95);
  groundRay.set(new THREE.Vector3(x,walkGround+0.35,z),new THREE.Vector3(0,-1,0));groundRay.far=.6;
  const floor=groundRay.intersectObjects(floorMeshes,false)[0];
  if(floor)walkGround=floor.point.y;
  collider.start.set(x,walkGround+.55,z);collider.end.set(x,walkGround+1.4,z);
  camera.position.set(x,walkGround+1.7,z);
}

async function load() {
  atlas=await loadAtlas();atlasTexture=new THREE.CanvasTexture(atlas.canvas);atlasTexture.colorSpace=THREE.SRGBColorSpace;atlasTexture.flipY=false;
  $('atlas-surface').append(atlas.canvas);
  function refreshAtlas(){atlasTexture.needsUpdate=true;[...$('atlas-options').children].forEach((b,i)=>b.setAttribute('aria-selected',String(i===atlas.selected)));}
  CRAFTS.forEach((craft,i)=>{const b=document.createElement('button');b.role='tab';b.textContent=craft.name;b.setAttribute('aria-selected',String(i===0));b.onclick=()=>{atlas.selected=i;drawAtlas(atlas);refreshAtlas();};$('atlas-options').append(b);});
  atlas.canvas.onclick=e=>{const r=atlas.canvas.getBoundingClientRect();if(selectAtlasAt(atlas,(e.clientX-r.left)*1600/r.width,(e.clientY-r.top)*800/r.height))refreshAtlas();};
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync('/models/pavilion.glb',p=>{if(p.total)$('progress').value=p.loaded/p.total*100;});
  model=gltf.scene;
  model.updateMatrixWorld(true);
  model.traverse(o=>{
    if(!o.isMesh)return;
    o.castShadow=true;o.receiveShadow=true;
    const materials=Array.isArray(o.material)?o.material:[o.material];
    materials.forEach(m=>{
      m.envMapIntensity=.25;
      if(m.name.includes('backlit')){m.emissiveIntensity=1.05;m.side=THREE.FrontSide;}
      if(m.name.includes('interactive craft atlas')){m.map=atlasTexture;m.emissiveMap=atlasTexture;m.emissive.set(0xffffff);m.emissiveIntensity=.5;o.userData.atlas=true;}
      if(m.name.includes('screen visual'))screens.push(m);
      if(m.name.includes('animated LED tree')){
        m.roughness=.75;m.emissiveIntensity=.8;
        m.onBeforeCompile=shader=>{
          shader.uniforms.uTime=treeClock;
          shader.vertexShader='varying vec3 vTreeWorld;\n'+shader.vertexShader;
          shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvTreeWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
          shader.fragmentShader=`uniform float uTime; varying vec3 vTreeWorld;
            float ledHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
            float ledNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(ledHash(i),ledHash(i+vec3(1,0,0)),f.x),mix(ledHash(i+vec3(0,1,0)),ledHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(ledHash(i+vec3(0,0,1)),ledHash(i+vec3(1,0,1)),f.x),mix(ledHash(i+vec3(0,1,1)),ledHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
          `+shader.fragmentShader;
          shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
            vec3 p=vTreeWorld;float a=atan(-(p.z-2.895),p.x+.377);
            vec3 q=p*vec3(6.0,1.0,6.0)+vec3(0,-uTime*.6,uTime*.09);
            float energy=ledNoise(q)*.65+ledNoise(q*2.0)*.25+ledNoise(q*4.0)*.1;
            vec3 glow=mix(vec3(.002,.025,.09),vec3(.12,.75,1.0),smoothstep(.32,.72,energy));
            float radial=p.y>2.32?mix(.045,1.0,step(.12,sin(a*38.0))):1.0;
            totalEmissiveRadiance=glow*radial*.9;diffuseColor.rgb=glow*.15;
          `);
        };
      }
    });
  });
  const entrance=rebuildEntrance(model,{mobile:touch});entranceLighting=entrance.lightGroup;
  const refinement=await refinePavilion(model,{atlasTexture,clock:treeClock,onCraftSelect:key=>{
    atlas.selected=CRAFTS.findIndex(c=>c.id===key);drawAtlas(atlas);refreshAtlas();openAtlas();
  }});displayLighting=refinement.lights;scene.add(displayLighting);updateExhibits=refinement.update;
  const floorStatus=await applyFloorMaterials(model,renderer);
  model.traverse(o=>{if(o.isMesh&&(isPavilion(o)||category(o).startsWith('02'))&&!o.userData.noCollision)floorMeshes.push(o);});
  scene.add(model);model.updateMatrixWorld(true);
  const collisionRoot=new THREE.Group();
  model.traverse(o=>{
    if(!o.isMesh||o.userData.noCollision)return;
    const cat=category(o);
    if(cat.startsWith('03')||cat.startsWith('04')||cat.startsWith('06')||cat.startsWith('11'))return;
    const mesh=new THREE.Mesh(o.userData.collisionGeometry||o.geometry);mesh.matrix.copy(o.matrixWorld);mesh.matrixAutoUpdate=false;collisionRoot.add(mesh);
  });
  world.fromGraphNode(collisionRoot);
  reflections=createFloorReflections(model,renderer,{oak:true});
  const response=await fetch('/models/lighting.json');
  if(!response.ok)throw new Error('Lighting file could not load.');
  const specs=await response.json();
  lightGroup=new THREE.Group();
  specs.forEach((s,i)=>{
    if(s.name.includes('pocket spotlight')||s.name.startsWith('Warm lightbox'))return;
    if(s.type==='AREA'){
      const lamp=new THREE.RectAreaLight(new THREE.Color(...s.color),s.energy*(s.name.startsWith('Soft indirect')?.0007:.0018),5,4);lamp.position.fromArray(s.position);lamp.lookAt(lamp.position.clone().add(new THREE.Vector3(...s.direction)));lightGroup.add(lamp);return;
    }
    if(s.type==='POINT')return;
    const lamp=new THREE.SpotLight(new THREE.Color(...s.color),s.energy*.085,32,s.angle,.7,2);
    lamp.position.fromArray(s.position);lamp.target.position.copy(lamp.position).add(new THREE.Vector3(...s.direction));
    // Keep the seven exhibit shadow maps within WebGL's 16-sampler minimum.
    // Hall lights remain fill; GTAO supplies their contact occlusion.
    lamp.castShadow=false;
    lamp.shadow.mapSize.set(1024,1024);lamp.shadow.bias=-.0004;lamp.shadow.normalBias=.025;
    lightGroup.add(lamp,lamp.target);
  });
  scene.add(lightGroup);ready=true;
  modeButtons.forEach(b=>b.disabled=false);reset();resize();
  $('viewpoint').value='front';$('view-label').textContent='Pavilion entrance';
  const initialView=new URLSearchParams(location.search).get('view');
  if(initialView&&[...$('viewpoint').options].some(o=>o.value===initialView)){$('viewpoint').value=initialView;$('viewpoint').dispatchEvent(new Event('change'));}
  pipeline.render(camera);renderer.shadowMap.autoUpdate=false;$('loading').hidden=true;
  window.pavilion={ get ready(){return ready;},get mode(){return mode;},get position(){return camera.position.toArray();},get atlasSelection(){return atlas.selected;},get statistics(){return {...renderer.info.render};},floorStatus,refinement:refinement.report,entrance:{removed:entrance.removed} };
  if(import.meta.env.DEV) window.pavilion.setWalkPose=(position,target)=>{
    if(mode!=='walk')throw new Error('Select Walk before setting a test position.');
    camera.position.fromArray(position);camera.lookAt(...target);walkGround=position[1]-1.7;
    collider.start.set(position[0],walkGround+.55,position[2]);collider.end.set(position[0],walkGround+1.4,position[2]);
    renderer.domElement.focus();keys.clear();
  };
  if(import.meta.env.DEV)window.pavilion.setViewPose=(position,target)=>{if(mode!=='orbit')setMode('orbit');camera.position.fromArray(position);orbit.target.fromArray(target);orbit.update();};
  if(import.meta.env.DEV)window.pavilion.setAnimationTime=value=>{animationTimeOverride=value;};
}
load().catch(e=>{console.error(e);showError('The model could not be loaded. Check the local server and try again.');});
let last=performance.now();
renderer.setAnimationLoop(now=>{
  const dt=Math.min((now-last)/1000,.05);last=now;
  if(!ready||document.hidden)return;
  treeClock.value=animationTimeOverride??now*.001;
  updateExhibits(treeClock.value);
  if(mode==='orbit') {
    orbit.update();camera.position.x=THREE.MathUtils.clamp(camera.position.x,-14.5,14.5);camera.position.y=THREE.MathUtils.clamp(camera.position.y,.5,5.3);camera.position.z=THREE.MathUtils.clamp(camera.position.z,-32.5,32.5);
  } else if(mode==='plan')planOrbit.update();else for(let i=0;i<3;i++)updateWalk(dt/3);
  pipeline.render(activeCamera,{plan:mode==='plan'});
});
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();showError('The 3D view was interrupted. Reload to reopen the pavilion.');});
const interactionRay=new THREE.Raycaster();let downPoint;
renderer.domElement.addEventListener('pointerdown',e=>downPoint=[e.clientX,e.clientY]);
renderer.domElement.addEventListener('pointerup',e=>{
  if(!ready||!downPoint||Math.hypot(e.clientX-downPoint[0],e.clientY-downPoint[1])>6)return;
  const p=pointer.isLocked?new THREE.Vector2():new THREE.Vector2(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);
  interactionRay.setFromCamera(p,activeCamera);const hit=interactionRay.intersectObject(model,true).find(h=>h.object.visible);
  if(hit?.object.userData.atlas)openAtlas();
  else hit?.object.userData.activate?.();
});
