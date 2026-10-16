import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const finishes = {
  blue: new THREE.MeshStandardMaterial({ name: 'Enclosed booth blue', color: '#123d70', roughness: .61, metalness: 0, envMapIntensity: .25 }),
  timber: new THREE.MeshStandardMaterial({ color: '#845b35', roughness: .58 }),
  endgrain: new THREE.MeshStandardMaterial({ color: '#593f2b', roughness: .83 }),
  iron: new THREE.MeshStandardMaterial({ color: '#343a3c', roughness: .42, metalness: .82 }),
  steel: new THREE.MeshStandardMaterial({ color: '#929b9d', roughness: .31, metalness: .9 }),
  clay: new THREE.MeshStandardMaterial({ color: '#ad613c', roughness: .78 }),
  paleClay: new THREE.MeshStandardMaterial({ color: '#c38c62', roughness: .73 }),
  wicker: new THREE.MeshStandardMaterial({ color: '#bb955f', roughness: .73 }),
  wickerDark: new THREE.MeshStandardMaterial({ color: '#8d6a40', roughness: .78 }),
  leather: new THREE.MeshStandardMaterial({ color: '#512b20', roughness: .48 }),
  leatherTan: new THREE.MeshStandardMaterial({ color: '#965d37', roughness: .62 }),
  sole: new THREE.MeshStandardMaterial({ color: '#30231c', roughness: .72 }),
  thread: new THREE.MeshStandardMaterial({ color: '#d6c7a1', roughness: .93 }),
  enamel: new THREE.MeshStandardMaterial({ color: '#111a20', roughness: .24, metalness: .3 }),
  textile: new THREE.MeshStandardMaterial({ color: '#27486a', roughness: .94 }),
  textileRust: new THREE.MeshStandardMaterial({ color: '#884836', roughness: .94 }),
};

for (const [key, material] of Object.entries(finishes)) {
  if (key === 'blue') continue;
  material.onBeforeCompile = shader => {
    shader.vertexShader = `varying vec3 vCraftP;\n${shader.vertexShader}`.replace('#include <begin_vertex>', '#include <begin_vertex>\nvCraftP=position;');
    shader.fragmentShader = `varying vec3 vCraftP;\n${shader.fragmentShader}`;
    const grain = ['timber','endgrain'].includes(key)
      ? `float grain=sin(vCraftP.x*260.0+sin(vCraftP.z*19.0)*3.0+sin(vCraftP.y*7.0))*0.045+sin(vCraftP.x*660.0+vCraftP.z*11.0)*0.025;`
      : `float grain=(fract(sin(dot(floor(vCraftP*1400.0),vec3(12.9898,78.233,37.719)))*43758.5453)-0.5)*0.07;`;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>\n${grain}\ndiffuseColor.rgb*=1.0+grain;`);
  };
  material.customProgramCacheKey = () => `craft-finish-${['timber','endgrain'].includes(key) ? 'wood' : 'micrograin'}`;
}

// The small parts are merged by material within each display, not individual draw calls.
export class CraftBuilder {
  constructor(group) { this.group = group; this.parts = new Map(); }
  add(geometry, material, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) {
    geometry.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(...scale)));
    if (geometry.index) { const indexed = geometry; geometry = geometry.toNonIndexed(); indexed.dispose(); }
    if (!geometry.getAttribute('uv')) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count * 2), 2));
    if (!this.parts.has(material)) this.parts.set(material, []);
    this.parts.get(material).push(geometry);
  }
  box(p, s, material = finishes.timber, radius = .006, rot = [0, 0, 0]) { this.add(new RoundedBoxGeometry(...s, 2, Math.min(radius, ...s.map(v => v / 3))), material, p, rot); }
  cyl(p, r, h, material = finishes.iron, rot = [0, 0, 0], top = r, segments = 32) { this.add(new THREE.CylinderGeometry(top, r, h, segments), material, p, rot); }
  ball(p, s, material) { this.add(new THREE.SphereGeometry(1, 24, 16), material, p, [0, 0, 0], s); }
  ring(p, r, tube, material, rotation = [Math.PI / 2, 0, 0]) { this.add(new THREE.TorusGeometry(r, tube, 6, 40), material, p, rotation); }
  rod(a, b, r, material = finishes.iron) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), d = end.clone().sub(start);
    const geometry = new THREE.CylinderGeometry(r, r, d.length(), 8);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
    this.add(geometry, material, start.add(end).multiplyScalar(.5).toArray());
  }
  curve(points, r, material) { this.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), Math.max(12, points.length), r, 5, false), material); }
  finish() {
    for (const [material, geometries] of this.parts) {
      const mesh = new THREE.Mesh(mergeGeometries(geometries), material);
      mesh.name = `${this.group.name} | detailed ${material.color.getHexString()} components`;
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.userData.noCollision = true;
      mesh.userData.sectionSkip = true;
      this.group.add(mesh);
      geometries.forEach(g => g.dispose());
    }
  }
}

export function vessel(b, x, y, z, r = .12, h = .28, variant = 0) {
  const m = variant % 2 ? finishes.paleClay : finishes.clay;
  const profiles = [
    [[0,0],[.55,0],[.64,.04],[.91,.2],[1,.42],[.94,.61],[.7,.78],[.48,.85],[.47,.96],[.52,1],[.41,1],[.39,.87],[.64,.76],[.85,.59],[.9,.4],[.8,.21],[.5,.11],[0,.11]],
    [[0,0],[.45,0],[.6,.06],[.8,.21],[.91,.5],[1,.9],[1,1],[.91,1],[.9,.9],[.81,.5],[.69,.23],[.48,.11],[0,.11]],
    [[0,0],[.5,0],[.6,.06],[.95,.25],[1,.4],[.82,.59],[.37,.7],[.25,.8],[.25,.96],[.32,1],[.22,1],[.17,.8],[.29,.69],[.72,.56],[.88,.4],[.8,.23],[.45,.1],[0,.1]],
    [[0,0],[.55,0],[.72,.05],[.88,.22],[.96,.64],[1,.95],[1,1],[.9,1],[.87,.65],[.78,.24],[.61,.13],[0,.13]],
  ];
  const profile = profiles[variant % profiles.length];
  b.add(new THREE.LatheGeometry(profile.map(([a, v]) => new THREE.Vector2(a * r, v * h)), 48), m, [x, y, z]);
  if (variant % 4 === 0) for (const t of [.35,.4,.45,.5]) b.ring([x,y+h*t,z],r*(.98+.02*Math.sin(t*5)),.0012,m);
  if (variant % 4 === 3) b.curve([[x+r*.9,y+h*.83,z],[x+r*1.55,y+h*.85,z],[x+r*1.58,y+h*.35,z],[x+r*.86,y+h*.25,z]],r*.085,m);
}

export function basket(b, x, y, z, r = .17, h = .23, handle = true) {
  for (let j = 0; j < 23; j++) {
    const yy = h * j / 22, rr = r * (.73 + .27 * j / 22);
    const points = Array.from({ length: 97 }, (_, i) => {
      const a = i / 96 * Math.PI * 2, radius = rr + Math.cos(a * 24) * .0025 * (j % 2 ? 1 : -1);
      return [x + Math.cos(a) * radius, y + yy, z + Math.sin(a) * radius];
    });
    b.curve(points, .0037, j % 3 ? finishes.wicker : finishes.wickerDark);
  }
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2;
    b.rod([x + Math.cos(a) * r * .73, y, z + Math.sin(a) * r * .73], [x + Math.cos(a) * r, y + h, z + Math.sin(a) * r], .004, finishes.wickerDark);
  }
  b.cyl([x, y + .004, z], r * .73, .008, finishes.wicker);
  b.ring([x, y + h, z], r, .008, finishes.wicker);
  if (handle) b.curve(Array.from({ length: 25 }, (_, i) => [x + r * Math.cos(i / 24 * Math.PI), y + h + r * 1.4 * Math.sin(i / 24 * Math.PI), z]), .008, finishes.wickerDark);
}

export function shoe(b, x, y, z, scale = 1, tan = false) {
  const m = tan ? finishes.leatherTan : finishes.leather;
  const shape = new THREE.Shape();
  shape.moveTo(-.065, -.16); shape.bezierCurveTo(-.11, -.11, -.1, .12, -.066, .18);
  shape.bezierCurveTo(-.035, .22, .045, .22, .075, .17); shape.bezierCurveTo(.1, .04, .065, -.09, .055, -.16); shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: .017, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .004, bevelThickness: .004, curveSegments: 12 });
  b.add(geometry, finishes.sole, [x, y + .018 * scale, z], [-Math.PI / 2, 0, Math.PI], [scale, scale, scale]);
  const sections=[[-.16,.04,.085],[-.13,.06,.115],[-.08,.071,.13],[-.025,.076,.105],[.04,.083,.068],[.11,.079,.044],[.17,.055,.032],[.2,.001,.02]],positions=[],indices=[];
  for(const [zz,width,height] of sections)for(let j=0;j<=20;j++){const a=j/20*Math.PI;positions.push(Math.cos(a)*width,.023+Math.sin(a)*height,zz);}
  for(let i=0;i<sections.length-1;i++)for(let j=0;j<20;j++){const a=i*21+j;indices.push(a,a+1,a+21,a+1,a+22,a+21);}
  const upper=new THREE.BufferGeometry();upper.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));upper.setIndex(indices);upper.computeVertexNormals();
  b.add(upper,m,[x,y,z],[0,0,0],[scale,scale,scale]);
  b.ball([x, y + .145 * scale, z - .1 * scale], [.037 * scale, .004 * scale, .036 * scale], finishes.sole);
  b.curve(Array.from({length:25},(_,i)=>{const a=i/24*Math.PI*2;return [x+Math.cos(a)*.039*scale,y+.145*scale,z-.1*scale+Math.sin(a)*.037*scale];}),.003*scale,m);
  for (let i = 0; i < 5; i++) {
    b.rod([x - .029 * scale, y + (.128 - i * .01) * scale, z - (.035 - i * .018) * scale], [x + .029 * scale, y + (.121 - i * .01) * scale, z - (.017 - i * .018) * scale], .0018 * scale, finishes.thread);
    for (const side of [-1, 1]) b.ball([x + side * .031 * scale, y + (.126 - i * .01) * scale, z - (.03 - i * .018) * scale], [.003 * scale, .003 * scale, .003 * scale], finishes.steel);
  }
  for (let i = 0; i < 42; i++) { const a = i * Math.PI * 2 / 42; b.ball([x + Math.cos(a) * .079 * scale, y + .023 * scale, z + Math.sin(a) * .175 * scale], [.0017 * scale, .0017 * scale, .003 * scale], finishes.thread); }
}

function table(b, x, z, width = 1.25, depth = .55, height = .78) {
  b.box([x, height, z], [width, .07, depth]);
  for (const a of [-1, 1]) for (const c of [-1, 1]) b.box([x + a * (width / 2 - .07), height / 2, z + c * (depth / 2 - .07)], [.065, height, .065]);
  b.box([x, .28, z], [width - .1, .055, depth - .1]);
}

function toolRack(b, x = 0, y = 1.48, z = -1.23) {
  b.box([x, y, z], [1.2, .72, .035], finishes.timber);
  for (let i = 0; i < 8; i++) {
    const xx = x - .49 + i * .14;
    b.rod([xx, y - .18, z + .055], [xx, y + .1, z + .055], .017, finishes.timber);
    if (i % 3 === 0) b.box([xx, y + .13, z + .055], [.16, .055, .065], finishes.iron);
    else b.box([xx, y + .18, z + .055], [.026, .19, .008], finishes.steel, .002);
    b.cyl([xx, y + .26, z + .04], .008, .028, finishes.steel, [Math.PI / 2, 0, 0]);
  }
}

export function populateCraft(b, key) {
  // Trade-specific working details complement the larger PDF-reference exhibits.
  if (key === 'tailor' || key === 'cobbler') {
    const y = key === 'tailor' ? .81 : .73;
    for (const side of [-1, 1]) {
      b.ring([-.43 + side * .025,y + .008,-.37],.023,.003,finishes.steel);
      b.rod([-.43 + side * .025,y + .008,-.39],[-.43 - side * .028,y + .008,-.52],.004,finishes.steel);
    }
    b.box([.38,y+.004,-.46],[.19,.004,.13],key==='tailor'?finishes.textileRust:finishes.leatherTan,.001);
    for(let i=0;i<12;i++)b.box([.36+i*.015,y+.009,-.36],[.004,.002,.018],finishes.iron,.0005);
    if(key==='cobbler')for(let i=0;i<3;i++)b.cyl([.55,.12+i*.17,-1.0],.075,.4,i%2?finishes.leather:finishes.leatherTan,[0,0,Math.PI/2]);
    else for(let i=0;i<4;i++)b.cyl([.55+i*.05,.98,-1.04],.024,1.55,[finishes.textile,finishes.thread,finishes.textileRust][i%3]);
  }
  if(key==='carpenter'){
    const blade=new THREE.Shape();blade.moveTo(-.22,0);blade.lineTo(.2,.07);blade.lineTo(.2,.12);blade.lineTo(-.22,.12);blade.closePath();
    b.add(new THREE.ExtrudeGeometry(blade,{depth:.003,bevelEnabled:false}),finishes.steel,[.12,1.05,-1.16]);
    for(let i=0;i<28;i++)b.rod([-.10+i*.015,1.05+i*.0025,-1.16],[-.095+i*.015,1.039+i*.0025,-1.16],.003,finishes.steel);
    b.ring([.39,1.12,-1.16],.065,.016,finishes.timber,[0,0,0]);
  }
  if(key==='blacksmith')for(let i=0;i<2;i++){
    b.cyl([.45,.08+i*.08,-.48],.17,.045,finishes.iron,[0,0,0],.19);
    for(const side of [-1,1])b.ring([.45+side*.19,.09+i*.08,-.48],.04,.008,finishes.iron,[0,0,0]);
  }
  if(key==='basket'){
    for(let i=0;i<15;i++)b.rod([-.5+i*.019,.757,-.35],[-.48+i*.019,.757,-.75],.003,finishes.wicker);
    for(let i=0;i<13;i++)b.rod([-.5,.762,-.36-i*.029],[-.21,.762,-.36-i*.029],.003,finishes.wickerDark);
  }
  if(key==='potter')for(let i=0;i<5;i++){
    b.cyl([-.55,.055+i*.022,-.66],.12,.02,finishes.paleClay,[0,0,0],.14);
    b.ring([-.55,.067+i*.022,-.66],.137,.005,finishes.clay);
  }
  if (key === 'blacksmith') {
    b.cyl([-.24, .28, -.56], .27, .56, finishes.endgrain, [0, 0, 0], .245, 48);
    for (let i = 0; i < 28; i++) { const a = i * Math.PI * 2 / 28; b.rod([-.24 + .252 * Math.cos(a), .03, -.56 + .252 * Math.sin(a)], [-.24 + .24 * Math.cos(a), .54, -.56 + .24 * Math.sin(a)], .005, finishes.timber); }
    b.box([-.24, .60, -.56], [.41, .08, .3], finishes.iron);
    b.box([-.24, .73, -.56], [.21, .22, .19], finishes.iron, .025);
    b.box([-.24, .875, -.56], [.55, .095, .24], finishes.steel, .009);
    b.cyl([.14, .87, -.56], .095, .3, finishes.iron, [0, 0, -Math.PI / 2], .006);
    toolRack(b);
    for (let i = 0; i < 3; i++) {
      const x = .35 + i * .12;
      b.curve([[x - .025, 1.85, -1.18], [x - .045, 1.58, -1.18], [x + .03, 1.40, -1.18], [x + .015, 1.25, -1.18]], .009, finishes.iron);
      b.curve([[x + .025, 1.85, -1.17], [x + .045, 1.58, -1.17], [x - .03, 1.40, -1.17], [x - .015, 1.25, -1.17]], .009, finishes.iron);
    }
    b.rod([-.52, .87, -.45], [-.30, .93, -.73], .022, finishes.timber);
    b.box([-.30, .94, -.73], [.14, .075, .075], finishes.iron);
    for (let i = 0; i < 4; i++) b.ring([-.64, 1.37 + i * .14, -1.18], .055, .008, finishes.iron, [0, 0, 0]);
  } else if (key === 'potter') {
    table(b, -.28, -.4, .68, .54, .65);
    b.cyl([-.28, .72, -.4], .26, .05, finishes.endgrain);
    b.cyl([-.28, .33, -.4], .05, .7, finishes.iron);
    vessel(b, -.28, .75, -.4, .115, .22);
    for (const x of [.35, .75]) for (const z of [-.65, -1.18]) b.box([x, 1.05, z], [.035, 2.08, .035], finishes.iron);
    for (let j = 0; j < 4; j++) {
      const y = .22 + j * .48;
      b.box([.55, y, -.92], [.48, .045, .61]);
      vessel(b, .48, y + .03, -.78, .095, .28 + (j % 2) * .08, j);
      vessel(b, .61, y + .03, -1.07, .09, .22 + (j % 2) * .08, j + 1);
    }
    vessel(b, -.55, .02, -1.04, .2, .55);
    b.box([-.2,1.55,-1.23],[1.15,.72,.035]);
    for(let i=0;i<5;i++){
      const x=-.65+i*.19;
      b.rod([x,1.28,-1.18],[x,1.61,-1.18],.011,finishes.timber);
      if(i%2===0)b.ball([x,1.72,-1.18],[.035,.1,.007],finishes.wicker);
      else b.curve([[x-.028,1.63,-1.18],[x-.038,1.78,-1.18],[x+.038,1.78,-1.18],[x+.028,1.63,-1.18]],.003,finishes.steel);
    }
  } else if (key === 'basket') {
    table(b, -.22, -.64, 1.05, .65, .7);
    for (let i = 0; i < 3; i++) basket(b, -.54 + i * .31, .75, -.65, .13, .16 + i * .055);
    basket(b, .56, .02, -.92, .23, .39);
    basket(b, -.58, .02, -.37, .19, .28);
    for (let j = 0; j < 7; j++) b.rod([.4 + j * .025, .04, -1.15], [.39 + j * .035, 1.48 + j * .04, -1.08], .006, finishes.wickerDark);
    for (let i = 0; i < 5; i++) {
      const x = -.62 + i * .31;
      b.ring([x, 1.6, -1.23], .13, .013, finishes.wicker, [0, 0, 0]);
      for (let j = -4; j <= 4; j++) b.rod([x - .1, 1.6 + j * .023, -1.23], [x + .1, 1.6 + j * .023, -1.23], .003, finishes.wicker);
    }
  } else if (key === 'tailor') {
    table(b, .12, -.55, 1.17, .6, .76);
    b.box([.1, .815, -.55], [.57, .025, .28], finishes.enamel);
    const shape = new THREE.Shape(); shape.moveTo(-.25, 0); shape.lineTo(-.25, .07); shape.lineTo(.14, .07); shape.lineTo(.14, .24); shape.quadraticCurveTo(.12, .3, -.16, .3); shape.lineTo(-.16, .19); shape.lineTo(-.24, .19); shape.lineTo(-.24, .36); shape.quadraticCurveTo(.25, .42, .25, .25); shape.lineTo(.25, 0); shape.closePath();
    b.add(new THREE.ExtrudeGeometry(shape, { depth: .105, bevelEnabled: true, bevelSize: .015, bevelThickness: .015, bevelSegments: 3, curveSegments: 12 }), finishes.enamel, [.1, .83, -.61]);
    b.ring([.40, 1.07, -.55], .1, .013, finishes.iron, [0, Math.PI / 2, 0]);
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; b.rod([.40, 1.07, -.55], [.40, 1.07 + .09 * Math.sin(a), -.55 + .09 * Math.cos(a)], .003, finishes.steel); }
    b.rod([-.10, 1.10, -.53], [-.10, .84, -.53], .004, finishes.steel);
    b.cyl([.21, 1.25, -.55], .019, .055, finishes.thread);
    b.box([.1, .24, -.55], [.38, .025, .25], finishes.iron, .005, [.2, 0, 0]);
    b.box([-.39, 1.07, -1.14], [.65, 2.1, .2]);
    for (let row = 0; row < 5; row++) for (let col = 0; col < 4; col++) for (let fold = 0; fold < 3; fold++) b.box([-.62 + col * .15, .31 + row * .35 + fold * .035, -1.0], [.13, .03, .2], [finishes.textile, finishes.thread, finishes.textileRust][(col + row) % 3], .008);
  } else if (key === 'carpenter') {
    table(b, 0, -.65, 1.4, .62, .8);
    toolRack(b, 0, 1.55);
    b.box([-.4, .74, -.28], [.25, .2, .06], finishes.timber);
    b.rod([-.4, .74, -.3], [-.4, .74, -.16], .014, finishes.steel);
    b.rod([-.4, .64, -.16], [-.4, .86, -.16], .013, finishes.timber);
    for (let i = 0; i < 3; i++) b.box([.23, .855 + i * .03, -.69], [.68, .026, .15]);
    b.box([-.25, .87, -.53], [.12, .065, .28], finishes.iron);
    b.curve([[-.25, .90, -.64], [-.25, 1.0, -.60], [-.25, .97, -.47]], .018, finishes.timber);
    b.box([-.25, .91, -.55], [.075, .1, .008], finishes.steel, .002, [-.5, 0, 0]);
    for (let i = 0; i < 8; i++) b.curve([[.3 + i * .025, .85, -.42], [.32 + i * .025, .9, -.39], [.37 + i * .025, .87, -.37], [.35 + i * .025, .85, -.34]], .002, finishes.wicker);
    for (let i = 0; i < 5; i++) b.box([-.32, .16 + i * .037, -1.05], [.8, .031, .16]);
  } else {
    table(b, 0, -.58, 1.3, .65, .68);
    shoe(b, -.26, .73, -.53, 1.1);
    shoe(b, .12, .73, -.53, 1.1, true);
    b.box([0, 1.08, -1.24], [1.44, 2.0, .075]);
    for (let row = 0; row < 3; row++) {
      const y = .49 + row * .47;
      b.box([0, y, -1.13], [1.4, .025, .29]);
      for (let i = 0; i < 4; i++) shoe(b, -.49 + i * .32, y + .02, -1.04, .74, i % 2 === 0);
    }
    for (let i = 0; i < 5; i++) { b.cyl([-.54 + i * .085, .77, -.81], .024, .13, finishes.thread); b.cyl([-.54 + i * .085, .84, -.81], .03, .008, finishes.timber); }
    b.rod([.43, .74, -.40], [.55, .74, -.67], .014, finishes.timber);
    b.box([.55, .755, -.67], [.1, .035, .035], finishes.steel);
  }
}
