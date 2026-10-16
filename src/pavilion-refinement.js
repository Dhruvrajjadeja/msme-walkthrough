import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CraftBuilder, finishes, vessel, basket, shoe } from './craft-objects.js';
import { prepareCraftMaterials, populateDetailedCraft, workshopPendant } from './detailed-crafts.js';
import { buildCircularDiorama } from './circular-diorama.js';
import { CRAFTS } from './atlas.js';

const CX = -.427;
const crafts = [
  { number: 7, key: 'blacksmith', side: -1, center: 8.07254, tv: 16 },
  { number: 8, key: 'potter', side: 1, center: 8.07254, tv: 19 },
  { number: 6, key: 'basket', side: -1, center: 2.97254, tv: 20 },
  { number: 5, key: 'tailor', side: 1, center: 2.97254, tv: 18 },
  { number: 4, key: 'carpenter', side: -1, center: -2.12746, tv: 21 },
  { number: 3, key: 'cobbler', side: 1, center: -2.12746, tv: 17 },
];
const nameOf = o => o.userData.source_name || o.name.replaceAll('_', ' ');

function addMesh(parent, name, geometry, material, position = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.fromArray(position);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function box(parent, name, size, position, material = finishes.blue) {
  return addMesh(parent, name, new RoundedBoxGeometry(...size, 2, Math.min(.008, ...size.map(v => v / 4))), material, position);
}
function removeBy(model, predicate) {
  const list = [];
  model.traverse(o => { if (predicate(o)) list.push(o); });
  list.forEach(o => o.removeFromParent());
  return list.length;
}

// A closed 150 mm shell with separate diffuser, opaque back and four opaque returns.
function curvedLightbox(parent, { name, point, length, height = 3, holes = [], texture, reverse = false, artworkUV }) {
  const group = new THREE.Group(); group.name = name; parent.add(group);
  const front = new THREE.MeshStandardMaterial({ name: `${name} front diffuser`, map: texture, emissiveMap: texture, color: '#fff5df', emissive: '#ffe3b0', emissiveIntensity: 1.8, roughness: .78, side: THREE.DoubleSide });
  const xs = Array.from({ length: 101 }, (_, i) => i / 100);
  for (const hole of holes) xs.push(hole.u0, hole.u1);
  xs.sort((a, b) => a - b);
  const us = [...new Set(xs)], ys = [...new Set([0, height, ...holes.flatMap(h => [h.y0, h.y1]), ...Array.from({length:31},(_,i)=>i*height/30)])].sort((a,b)=>a-b);
  const faces = [[], []], uv = [[], []];
  function quad(slot, corners, tex = [[0, 0], [1, 0], [1, 1], [0, 1]]) {
    for (const i of [0, 1, 2, 0, 2, 3]) { faces[slot].push(...corners[i]); uv[slot].push(...tex[i]); }
  }
  for (let i = 0; i < us.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) {
    const a = us[i], b = us[i + 1], c = ys[j], d = ys[j + 1];
    if (holes.some(hole => a >= hole.u0 - .00001 && b <= hole.u1 + .00001 && c >= hole.y0 - .00001 && d <= hole.y1 + .00001)) continue;
    const u0 = reverse ? 1 - a : a, u1 = reverse ? 1 - b : b;
    const coordinates = [[u0, c / height], [u1, c / height], [u1, d / height], [u0, d / height]];
    quad(0, [point(a, c, 0), point(b, c, 0), point(b, d, 0), point(a, d, 0)], artworkUV ? coordinates.map(artworkUV) : coordinates);
    quad(1, [point(b, c, .15), point(a, c, .15), point(a, d, .15), point(b, d, .15)]);
  }
  for (const y of [0, height]) for (let i = 0; i < us.length - 1; i++) quad(1, [point(us[i], y, 0), point(us[i], y, .15), point(us[i + 1], y, .15), point(us[i + 1], y, 0)]);
  for (const u of [0, 1]) quad(1, [point(u, 0, 0), point(u, height, 0), point(u, height, .15), point(u, 0, .15)]);
  for (const hole of holes) {
    for (const u of [hole.u0, hole.u1]) quad(1, [point(u, hole.y0, 0), point(u, hole.y1, 0), point(u, hole.y1, .15), point(u, hole.y0, .15)]);
    for (const y of [hole.y0, hole.y1]) quad(1, [point(hole.u0, y, 0), point(hole.u1, y, 0), point(hole.u1, y, .15), point(hole.u0, y, .15)]);
  }
  const blue = finishes.blue.clone(); blue.side = THREE.DoubleSide;
  for (const slot of [0, 1]) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(faces[slot], 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv[slot], 2));
    geometry.computeVertexNormals();
    const mesh = addMesh(group, slot ? `${name} opaque blue shell` : `${name} illuminated face only`, geometry, slot ? blue : front);
    if (!slot) {
      mesh.userData.frontOnlyArtwork = true;
      mesh.material.onBeforeCompile = shader => {
        shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          float rim = min(min(vMapUv.x, 1.0-vMapUv.x), min(vMapUv.y, 1.0-vMapUv.y));
          float edgeLight = 1.0-smoothstep(0.0, 0.025, rim);
          totalEmissiveRadiance += vec3(1.0, 0.72, 0.38)*edgeLight*0.25;`);
      };
    }
  }
  group.userData.dimensions = { length, height, depth: .15 };
  return group;
}

function craftPoint(side, center, length = 5, radius = 6.4) {
  return (u, y, depth = 0) => {
    const z = center + (u - .5) * length;
    const bulge = radius - Math.sqrt(radius * radius - (z - center) ** 2);
    return [CX + side * (4.358 - bulge + depth), y + .1, z];
  };
}

function makeBooth(model, craft, lights) {
  const { key, side, center } = craft;
  const windowZ = center + 1.13968;
  const point = craftPoint(side, center);
  const surface = point((windowZ - center) / 5 + .5, 0);
  const group = new THREE.Group(); group.name = `Enclosed ${key} workshop`;
  group.userData.category = '10 Detailed craft booths';
  group.position.set(surface[0], .203, windowZ);
  group.rotation.y = -side * Math.PI / 2;
  model.add(group);
  // Existing plan openings are retained; there is now a real room behind the aperture.
  box(group, 'Solid blue workshop rear', [1.8, 3.4, .08], [0, 1.7, -1.38]);
  box(group, 'Blue workshop left return', [.075, 3.4, 1.18], [-.88, 1.7, -.81]);
  box(group, 'Blue workshop right return', [.075, 3.4, 1.18], [.88, 1.7, -.81]);
  box(group, 'Blue workshop ceiling', [1.8, .07, 1.18], [0, 3.37, -.81]);
  box(group, 'Blue workshop floor', [1.8, .04, 1.18], [0, .02, -.81]);
  const revealVertices=[];
  const rear=(u,y)=>{const p=point(u,y,.15);p[0]=surface[0]+side*.32;return p;};
  const front=(u,y)=>point(u,y,.15);
  function revealQuad(a,b,c,d){revealVertices.push(...a,...b,...c,...a,...c,...d);}
  for(const y of [.75,1.95])revealQuad(front(.607936,y),front(.847936,y),rear(.847936,y),rear(.607936,y));
  for(const u of [.607936,.847936])revealQuad(front(u,.75),front(u,1.95),rear(u,1.95),rear(u,.75));
  const revealGeometry=new THREE.BufferGeometry();revealGeometry.setAttribute('position',new THREE.Float32BufferAttribute(revealVertices,3));revealGeometry.computeVertexNormals();
  const revealMat=finishes.blue.clone();revealMat.side=THREE.DoubleSide;
  const reveal=addMesh(model,`${key} seamless curved-to-flat blue reveals`,revealGeometry,revealMat);reveal.userData.category='09 Window reveals';
  // Keep the rear of the external opening enclosed without putting a photo plane in it.
  const builder = new CraftBuilder(group);
  populateDetailedCraft(builder, key);
  workshopPendant(builder,key);
  builder.finish();
  const lensMat = new THREE.MeshBasicMaterial({ color: '#ffe3ac' });
  addMesh(group, 'Workshop pendant diffuser', new THREE.SphereGeometry(.035,16,12), lensMat, [0, 2.21, -.70]);
  group.updateMatrixWorld(true);
  const lamp = new THREE.SpotLight(0xffe8c6, 20, 4, 1.02, .85, 2);
  lamp.position.copy(group.localToWorld(new THREE.Vector3(0, 2.17, -.62)));
  lamp.target.position.copy(group.localToWorld(new THREE.Vector3(0, .75, -.62)));
  lamp.castShadow=true;lamp.shadow.mapSize.set(512,512);lamp.shadow.bias=-.0004;lamp.shadow.normalBias=.012;
  lamp.shadow.camera.near=.1;lamp.shadow.camera.far=4;
  lights.add(lamp, lamp.target);
  return group;
}

function ledTree(model, lights, clock) {
  const group = new THREE.Group(); group.name = 'Open radial LED ribbon tree'; group.userData.category = '09 LED tree';
  group.position.set(CX, 0, 8.1); model.add(group);
  group.scale.set(1.06, 1.08, 1.06);
  group.position.y = -.203 * .08;
  const led = new THREE.MeshStandardMaterial({ color: '#073051', emissive: '#159ee5', emissiveIntensity: 1.8, roughness: .38, side: THREE.DoubleSide });
  led.onBeforeCompile = shader => {
    shader.uniforms.treeTime = clock;
    shader.vertexShader = `varying vec2 vRibbonUV;\n${shader.vertexShader}`.replace('#include <uv_vertex>', '#include <uv_vertex>\nvRibbonUV=uv;');
    shader.fragmentShader = `uniform float treeTime;varying vec2 vRibbonUV;\n${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      float phase=mod(treeTime,10.0)/10.0*6.2831853;
      vec2 p=vec2(vRibbonUV.x*6.2831853,vRibbonUV.y*12.0);
      float flow=sin(p.y*1.9-phase*2.0+sin(p.x*3.0+phase)*1.6);
      float fine=sin(p.y*5.7-phase*4.0+cos(p.x*5.0-phase*2.0))*0.5+0.5;
      float ribbons=pow(max(0.0,flow),8.0);
      float particles=pow(max(0.0,sin(p.x*23.0+p.y*11.0+phase*3.0)),24.0)*pow(fine,8.0);
      vec3 color=mix(vec3(.002,.014,.055),vec3(.025,.22,.48),fine);
      color+=vec3(.12,.70,1.0)*ribbons*1.65+vec3(.7,.9,1.0)*particles*2.0;
      totalEmissiveRadiance=color*1.5;diffuseColor.rgb=color*.12;`);
  };
  const backing = finishes.iron.clone(); backing.color.set('#0b1520');
  const faces = [[], []], uvs = [[], []];
  const path = [];
  for (let i = 0; i <= 24; i++) path.push([.46, .25 + i / 24 * 2.35]);
  for (let i = 1; i <= 48; i++) { const a = i / 48 * Math.PI / 2; path.push([.46 + 2.65 * (1 - Math.cos(a)), 2.6 + 1.7 * Math.sin(a)]); }
  function quad(slot, corners, texture) { for (const i of [0, 1, 2, 0, 2, 3]) { faces[slot].push(...corners[i]); uvs[slot].push(...texture[i]); } }
  for (let strip = 0; strip < 44; strip++) {
    const angle = strip / 44 * Math.PI * 2, radial = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)), tangent = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
    function vertex(i, sign, depth) { const [r, y] = path[i]; const width = .045 + .065 * Math.pow(i / (path.length - 1), 3); return radial.clone().multiplyScalar(r + depth).addScaledVector(tangent, sign * width / 2).add(new THREE.Vector3(0, y, 0)).toArray(); }
    for (let i = 0; i < path.length - 1; i++) {
      const v0=i/(path.length-1),v1=(i+1)/(path.length-1),u=strip/44;
      const tex=[[u,v0],[u+.012,v0],[u+.012,v1],[u,v1]];
      quad(0,[vertex(i,-1,0),vertex(i,1,0),vertex(i+1,1,0),vertex(i+1,-1,0)],tex);
      quad(1,[vertex(i,-1,-.022),vertex(i+1,-1,-.022),vertex(i+1,1,-.022),vertex(i,1,-.022)],tex);
      for(const s of [-1,1])quad(1,[vertex(i,s,0),vertex(i,s,-.022),vertex(i+1,s,-.022),vertex(i+1,s,0)],tex);
    }
  }
  for(const slot of [0,1]) {const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(faces[slot],3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs[slot],2));geometry.computeVertexNormals();const mesh=addMesh(group,slot?'LED ribbon opaque housings':'44 separate animated LED ribbons',geometry,slot?backing:led);mesh.userData.noCollision=true;mesh.userData.sectionSkip=true;}
  const base=addMesh(group,'Tree low blue foundation',new THREE.CylinderGeometry(.58,.63,.11,64),finishes.blue,[0,.255,0]);
  const trunkCollider=addMesh(group,'Tree central support',new THREE.CylinderGeometry(.17,.17,2.45,32),backing,[0,1.48,0]);
  trunkCollider.userData.collisionGeometry=new THREE.CylinderGeometry(.49,.49,2.45,32);
  for(const y of [1.1,2.3,3.2]){const lamp=new THREE.PointLight(0x36a7ef,y===3.2?7:3,5,2);lamp.position.set(CX,y,8.1);lights.add(lamp);}
  group.userData.loopSeconds=10;group.userData.stripCount=44;
  return {group,base,trunkCollider};
}

function interactiveInstallation(model, atlasTexture) {
  const group=new THREE.Group();group.name='Double-sided craft atlas';group.userData.category='09 Interactive installation';group.position.set(CX,.203,-1.65);model.add(group);
  box(group,'Central navy installation plinth',[1.12,.64,3.65],[0,.32,0]);
  const counterShape=new THREE.Shape();
  counterShape.moveTo(-1.175,-1.02);counterShape.lineTo(-1.175,1.02);
  counterShape.absarc(0,1.02,1.175,Math.PI,0,true);counterShape.lineTo(1.175,-1.02);
  counterShape.absarc(0,-1.02,1.175,0,-Math.PI,true);counterShape.closePath();
  const counterGeometry=new THREE.ExtrudeGeometry(counterShape,{depth:.075,bevelEnabled:true,bevelSize:.012,bevelThickness:.008,bevelSegments:3,curveSegments:48});
  counterGeometry.rotateX(-Math.PI/2);
  const counterFinish=new THREE.MeshStandardMaterial({color:'#d0cdc4',roughness:.38,metalness:0});
  addMesh(group,'Continuous curved craft display counter',counterGeometry,counterFinish,[0,.65,0]);
  const housingShape=new THREE.Shape();housingShape.moveTo(-1.07,.64);housingShape.lineTo(-.295,1.70);housingShape.lineTo(.295,1.70);housingShape.lineTo(1.07,.64);housingShape.closePath();
  addMesh(group,'Closed blue double-sided screen housing',new THREE.ExtrudeGeometry(housingShape,{depth:2.44,bevelEnabled:true,bevelThickness:.01,bevelSize:.01,bevelSegments:2,steps:1}),finishes.blue,[0,0,-1.22]);
  for(const side of [-1,1]){
    const face=new THREE.Group();face.position.set(side*.68,1.17,0);face.rotation.order='YXZ';face.rotation.y=side*Math.PI/2;face.rotation.x=-.62;group.add(face);
    box(face,'Angled blue screen enclosure',[2.48,1.3,.12],[0,0,0]);
    box(face,'Fine dark screen gasket',[2.35,1.17,.016],[0,0,.067],finishes.enamel);
    const material=new THREE.MeshPhysicalMaterial({map:atlasTexture,emissiveMap:atlasTexture,emissive:0xffffff,emissiveIntensity:.65,roughness:.24,metalness:0,clearcoat:.65});
    const screen=addMesh(face,`Interactive map screen ${side}`,new THREE.PlaneGeometry(2.29,1.11),material,[0,0,.078]);
    // glTF textures are flipped for the imported model; this new screen uses native UVs.
    const uv=screen.geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setY(i,1-uv.getY(i));
    screen.userData.atlas=true;screen.userData.noCollision=true;
  }
  const b=new CraftBuilder(group);
  vessel(b,-.72,.73,1.56,.15,.33);vessel(b,.0,.73,1.64,.1,.23,1);
  basket(b,.66,.73,1.56,.15,.2);
  shoe(b,-.55,.73,-1.57,.9);shoe(b,-.3,.73,-1.57,.9,true);
  for(let i=0;i<4;i++)b.box([.5,.76+i*.033,-1.62],[.45,.03,.3],i%2?finishes.thread:finishes.textile);
  for(let j=0;j<3;j++)b.curve(Array.from({length:65},(_,i)=>{const a=i/64*Math.PI*6;return [-.36+Math.cos(a)*(.08+j*.012),.741+i*.00018,1.83+Math.sin(a)*.13];}),.007,finishes.thread);
  for(let j=0;j<3;j++){
    b.rod([.28+j*.12,.75,1.6],[.28+j*.12,.75,1.95],.013,finishes.timber);
    b.box([.28+j*.12,.76,1.95],[.07,.03,.06],finishes.iron);
  }
  b.finish();
  return group;
}

export async function refinePavilion(model,{atlasTexture,clock,onCraftSelect}={}){
  await prepareCraftMaterials();
  const screenUpdates=[];
  const lights=new THREE.Group();lights.name='Refined display lighting';
  const panels=new THREE.Group();panels.name='Closed front-lit curved lightboxes';panels.userData.category='09 Curved lightboxes';model.add(panels);
  const removeNames=new Set([...crafts.flatMap(c=>[`Geom3D.${String(c.number).padStart(3,'0')}`,`Geom3D.${String(c.tv).padStart(3,'0')}`]),'Geom3D.010','Geom3D.013','Geom3D.014','Geom3D.015']);
  const removed=removeBy(model,o=>{
    const n=nameOf(o),category=o.userData.category||'';
    return removeNames.has(n)||category.startsWith('10 Workshop')||/curved brass trim|panel end trim|wall brass line|partition brass line|gold window reveal|window lightbox top|warm concealed LED|Touchscreen|Touch UI|Interactive desk|Interactive map display/.test(n);
  });
  model.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.name.includes('blue lacquered MDF')){m.color.set('#123d70');m.roughness=.61;m.metalness=0;m.envMapIntensity=.25;}});
  const loader=new THREE.TextureLoader();
  for(const craft of crafts){
    const texture=await loader.loadAsync(`${import.meta.env.BASE_URL}artwork/${craft.key}-composed-v2.png`);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
    const point=craftPoint(craft.side,craft.center);
    const windowHole={u0:.607936,u1:.847936,y0:.75,y1:1.95};
    const screenHole={u0:.065,u1:.355,y0:1.11,y1:1.95};
    // The new murals are composed around these exact apertures, with undistorted UVs.
    curvedLightbox(panels,{name:`${craft.key} lightbox`,point,length:5,holes:[windowHole,screenHole],texture,reverse:craft.side<0});
    makeBooth(model,craft,lights);
    // The existing workshop image remains on the television only, never in the physical window.
    const photo=await loader.loadAsync(`${import.meta.env.BASE_URL}backdrops/${craft.key}.jpg`);
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=576;
    const ctx=canvas.getContext('2d'),info=CRAFTS.find(c=>c.id===craft.key);
    const screenTexture=new THREE.CanvasTexture(canvas);screenTexture.colorSpace=THREE.SRGBColorSpace;
    const stages={blacksmith:['HEAT','FORGE','FINISH'],potter:['PREPARE','THROW','FIRE'],basket:['SPLIT','WEAVE','BIND'],tailor:['MEASURE','CUT','STITCH'],carpenter:['MARK','SHAPE','JOIN'],cobbler:['CUT','LAST','STITCH']}[craft.key];
    let lastStep=-1;
    const drawScreen=time=>{
      const step=Math.floor((time%10)/(10/3));if(step===lastStep)return;lastStep=step;
      ctx.fillStyle='#102a39';ctx.fillRect(0,0,1024,576);
      const im=photo.image,scale=Math.max(1024/im.width,430/im.height),w=im.width*scale,h=im.height*scale;
      ctx.save();ctx.beginPath();ctx.rect(0,0,1024,430);ctx.clip();ctx.drawImage(im,(1024-w)/2,(430-h)/2,w,h);ctx.restore();
      ctx.fillStyle='#f0dfb9';ctx.font='600 32px sans-serif';ctx.fillText(info.name.toUpperCase(),30,476);
      ctx.fillStyle='#a2c8c9';ctx.font='18px sans-serif';ctx.fillText(info.medium,30,509);
      stages.forEach((stage,i)=>{const x=34+i*330;ctx.fillStyle=i===step?'#e6c890':'#49717e';ctx.fillRect(x,538,285,3);ctx.font='17px sans-serif';ctx.fillText(`0${i+1}  ${stage}`,x,567);});
      screenTexture.needsUpdate=true;
    };drawScreen(0);screenUpdates.push(drawScreen);
    const screenGroup=new THREE.Group();screenGroup.name=`${craft.key} inset television`;screenGroup.userData.category='09 Craft screens';model.add(screenGroup);
    const z=craft.center-1.45,p=point(.21,1.53,-.07);screenGroup.position.set(p[0],1.63,z);screenGroup.rotation.y=-craft.side*Math.PI/2-Math.atan((z-craft.center)/6.2)*craft.side;
    box(screenGroup,'Recessed television housing',[1.53,.86,.055],[0,0,-.04]);
    const sm=new THREE.MeshStandardMaterial({map:screenTexture,emissiveMap:screenTexture,emissive:0xffffff,emissiveIntensity:.5,roughness:.3});
    const digital=addMesh(screenGroup,'Flush television image',new THREE.PlaneGeometry(1.51,.835),sm,[0,0,-.008]);
    digital.userData.activate=()=>onCraftSelect?.(craft.key);digital.userData.craftKey=craft.key;
    const spill=new THREE.RectAreaLight(0xffd49a,1.7,4.5,2.8);spill.position.set(CX+craft.side*3.85,1.65,craft.center);spill.lookAt(CX,.7,craft.center);lights.add(spill);
  }
  for(const [number,key,side,center,length] of [[13,'heritage',-1,-10.1382,4.0215],[14,'journey',0,-12.9,7.6937],[15,'future',1,-10.1382,4.0215]]){
    const texture=await loader.loadAsync(`${import.meta.env.BASE_URL}artwork/transition-${key}-bw.png`);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
    const point=side?craftPoint(side,center,length,4.5):(u,y,d)=>{const x=CX+(u-.5)*length;return [x,y+.1,-13.19+(x-CX)**2*.059-d];};
    curvedLightbox(panels,{name:`${key} transition lightbox`,point,length,texture,reverse:side<0});
    const spill=new THREE.RectAreaLight(0xffd49a,1.6,side?3.7:6.6,2.8);spill.position.set(side?CX+side*3.9:CX,1.65,side?center:-12.05);spill.lookAt(CX,.8,-9);lights.add(spill);
  }
  const tree=ledTree(model,lights,clock);
  const installation=interactiveInstallation(model,atlasTexture);
  await buildCircularDiorama(model,lights);
  model.updateMatrixWorld(true);
  return {lights,tree,installation,update:time=>screenUpdates.forEach(draw=>draw(time)),report:{removed,craftLightboxes:6,colourArtworks:6,apertureAwareArt:true,artworkWarp:false,transitionLightboxes:3,enclosedWorkshops:6,workshopShadows:6,interactiveCraftScreens:6,mapScreens:2,curvedCounter:true,dioramaMiniatures:6,dioramaRimPlates:24,treeStrips:44,treeHeight:4.628,treeCenter:[CX,8.1],loopSeconds:10}};
}
