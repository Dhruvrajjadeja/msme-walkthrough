import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import boldTypeface from 'three/examples/fonts/helvetiker_bold.typeface.json';
import regularTypeface from 'three/examples/fonts/helvetiker_regular.typeface.json';

const CX = -.427;
const fonts = {
  bold: new FontLoader().parse(boldTypeface),
  regular: new FontLoader().parse(regularTypeface),
};

function wallSurface(side, offset, y0 = .28, y1 = 3.48) {
  const positions = [], uvs = [], indices = [];
  for (let i = 0; i <= 96; i++) {
    const t = i / 96;
    const x = CX + side * (2.18 + 3.72 * t);
    const z = 13.25 + 2.2 * t * t + offset;
    positions.push(x, y0, z, x, y1, z);
    uvs.push(t, 0, t, 1);
    if (i < 96) {
      const a = i * 2;
      if (side > 0) indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      else indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function surfacePoint(side, u, y, depth = 0) {
  return new THREE.Vector3(CX + side * (2.18 + 3.72 * u), y, 13.25 + 2.2 * u * u + depth);
}

function ribbon(points, width, horizontal = false) {
  const positions = [], indices = [];
  for (const point of points) {
    positions.push(point.x - (horizontal ? 0 : width / 2), point.y - (horizontal ? width / 2 : 0), point.z);
    positions.push(point.x + (horizontal ? 0 : width / 2), point.y + (horizontal ? width / 2 : 0), point.z);
  }
  for (let i = 0; i < points.length - 1; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function rebuildEntrance(model, { mobile = false } = {}) {
  const obsolete = [];
  model.traverse(object => {
    const name = object.userData.source_name || object.name.replaceAll('_', ' ');
    if (name === 'Geom3D.002' || name.startsWith('Entrance ')) obsolete.push(object);
  });
  obsolete.forEach(object => object.removeFromParent());

  const group = new THREE.Group();
  group.name = 'Entrance | recessed identity and woven lightboxes';
  group.userData.category = '09 Entrance';
  model.add(group);
  const navy = new THREE.MeshStandardMaterial({ color: '#243b72', roughness: .43, metalness: .08, envMapIntensity: .65 });
  const navyInner = new THREE.MeshStandardMaterial({ color: '#273e75', roughness: .5, metalness: .04, envMapIntensity: .5 });
  const brass = new THREE.MeshStandardMaterial({ color: '#b89a61', roughness: .34, metalness: .72, envMapIntensity: 1.2 });
  const bronze = new THREE.MeshStandardMaterial({ color: '#68513a', roughness: .4, metalness: .62, envMapIntensity: .85 });
  const weave = new THREE.MeshStandardMaterial({ color: '#a98a50', roughness: .49, metalness: .32, side: THREE.DoubleSide, envMapIntensity: .8 });
  const warm = new THREE.MeshStandardMaterial({ color: '#fff4d9', emissive: '#ffdeb0', emissiveIntensity: 2.15, roughness: .86, side: THREE.FrontSide });
  const dark = new THREE.MeshStandardMaterial({ color: '#121b27', roughness: .72 });
  const blueRear = navy.clone(); blueRear.side = THREE.DoubleSide;

  function mesh(geometry, material, name, noCollision = false) {
    const object = new THREE.Mesh(geometry, material);
    object.name = name;
    object.castShadow = true;
    object.receiveShadow = true;
    object.userData.noCollision = noCollision;
    group.add(object);
    return object;
  }
  function box(name, size, position, material = navy, radius = .008) {
    const object = mesh(new RoundedBoxGeometry(...size, 2, radius), material, name);
    object.position.set(...position);
    return object;
  }
  function frame(name, w, h, y, z, thickness, material, depth = .015) {
    box(`${name} left`, [thickness, h, depth], [CX - w / 2, y, z], material, .002);
    box(`${name} right`, [thickness, h, depth], [CX + w / 2, y, z], material, .002);
    box(`${name} top`, [w, thickness, depth], [CX, y + h / 2, z], material, .002);
    box(`${name} bottom`, [w, thickness, depth], [CX, y - h / 2, z], material, .002);
  }
  function text(label, y, width, { bold = false, depth = .006 } = {}) {
    const geometry = new TextGeometry(label, { font: bold ? fonts.bold : fonts.regular, size: .5, depth, curveSegments: 6, bevelEnabled: true, bevelThickness: .0015, bevelSize: .001, bevelSegments: 2 });
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox;
    const scale = width / (bounds.max.x - bounds.min.x);
    geometry.translate(-(bounds.max.x + bounds.min.x) / 2, -bounds.min.y, 0);
    geometry.scale(scale, scale, 1);
    const object = mesh(geometry, brass, `Identity lettering | ${label}`, true);
    object.position.set(CX, y, 15.115);
    return object;
  }

  // A real recessed wall: separate face, returns, shadow gaps and projecting letters.
  box('Identity blue backing', [4.55, 3.4, .16], [CX, 1.9, 15.015], navyInner);
  box('Identity left return', [.46, 3.4, .62], [CX - 2.045, 1.9, 15.25]);
  box('Identity right return', [.46, 3.4, .62], [CX + 2.045, 1.9, 15.25]);
  box('Identity top return', [3.64, .38, .62], [CX, 3.41, 15.25]);
  box('Identity bottom return', [3.64, .25, .62], [CX, .325, 15.25]);
  frame('Outer brass inlay', 4.38, 3.22, 1.9, 15.566, .011, brass);
  frame('Recess brass inlay', 3.66, 2.76, 1.835, 15.57, .012, brass);
  text('MSME', 2.01, 2.13, { bold: true, depth: .052 });
  text('IITF', 1.69, .56, { bold: true, depth: .018 });
  text('INDIA INTERNATIONAL TRADE FAIR', 1.38, 2.8);
  box('Entrance navy plinth edge', [12, .12, .16], [CX, .14, 15.55], navy, .004);

  // Drawing 01, inside elevation: 4 m portal, 2.5 m cheeks, 2.625 m returns.
  // Retain the existing pavilion width and outer woven entrance assembly.
  box('Inside entrance portal lintel', [9, 1.1, .16], [CX, 3.15, 12.45]);
  for (const side of [-1, 1]) {
    box(`Inside entrance solid cheek ${side}`, [2.5, 2.4, .16], [CX + side * 3.25, 1.4, 12.45]);
    // Overlap both adjoining solids; a butt joint left a visible 600 mm slit.
    box(`Sealed entrance wing-to-cheek connection ${side}`, [.18, 3.3, .91], [CX + side * 2.18, 1.85, 12.825], navy, .004);
    box(`Entrance perpendicular return wall ${side}`, [.16, 3.5, 2.625], [CX + side * 4.5, 1.95, 11.2175]);
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 1120;
    const ctx = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const topics = ['ENTERPRISE', 'CRAFT & SKILL', 'MARKETS & GROWTH'];
    let page = side < 0 ? 0 : 1;
    function draw() {
      ctx.fillStyle = '#09283f'; ctx.fillRect(0, 0, 640, 1120);
      ctx.fillStyle = '#85d9d9'; ctx.fillRect(42, 48, 46, 5);
      ctx.font = '24px sans-serif'; ctx.fillText('MSME / INDIA', 42, 100);
      ctx.fillStyle = '#f3f1e9'; ctx.font = 'bold 38px sans-serif'; ctx.fillText(topics[page], 42, 180);
      ctx.font = '22px sans-serif'; ctx.fillText('Micro, Small & Medium Enterprises', 42, 225);
      const labels = [['MICRO','SMALL','MEDIUM'],['TRADITION','MAKING','INNOVATION'],['LOCAL','NATIONAL','GLOBAL']][page];
      labels.forEach((label, i) => {
        const y = 320 + i * 200;
        ctx.strokeStyle = '#477c91'; ctx.lineWidth = 2; ctx.strokeRect(42, y, 556, 158);
        ctx.fillStyle = '#85d9d9'; ctx.font = 'bold 46px sans-serif'; ctx.fillText(`0${i + 1}`, 65, y + 61);
        ctx.fillStyle = '#f3f1e9'; ctx.font = '24px sans-serif'; ctx.fillText(label, 160, y + 56);
        for (let j = 0; j < 3; j++) { ctx.fillStyle = j === i ? '#d7ad63' : '#376377'; ctx.fillRect(160 + j * 130, y + 93, 110, 10); }
      });
      ctx.fillStyle = '#abc7d2'; ctx.font = '19px sans-serif'; ctx.fillText('INFORMATION PREVIEW', 42, 1018);
      for(let i=0;i<3;i++){ctx.fillStyle=i===page?'#85d9d9':'#376377';ctx.beginPath();ctx.arc(280+i*40,1068,6,0,Math.PI*2);ctx.fill();}
      texture.needsUpdate = true;
    }
    draw();
    box(`Portrait information screen housing ${side}`, [.91, 1.61, .045], [CX + side * 3.25, 1.72, 12.345], dark);
    const display = mesh(new THREE.PlaneGeometry(.86, 1.505), new THREE.MeshStandardMaterial({map:texture,emissiveMap:texture,emissive:0xffffff,emissiveIntensity:.8,roughness:.25}), `Portrait MSME touchscreen ${side}`, true);
    display.position.set(CX + side * 3.25, 1.72, 12.317); display.rotation.y = Math.PI;
    display.userData.activate = () => { page = (page + 1) % topics.length; draw(); };
  }

  const lightGroup = new THREE.Group();
  lightGroup.name = 'Entrance architectural lighting';
  group.add(lightGroup);
  for (const side of [-1, 1]) {
    mesh(wallSurface(side, -.12), blueRear, `Opaque curved housing ${side}`);
    for (const y of [.28, 3.48]) {
      const positions = [];
      for (let i = 0; i < 96; i++) {
        const a = surfacePoint(side, i / 96, y, -.12).toArray();
        const b = surfacePoint(side, (i + 1) / 96, y, -.12).toArray();
        const c = surfacePoint(side, (i + 1) / 96, y, -.015).toArray();
        const d = surfacePoint(side, i / 96, y, -.015).toArray();
        positions.push(...a, ...b, ...c, ...a, ...c, ...d);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.computeVertexNormals();
      mesh(geometry, blueRear, `Closed blue lightbox horizontal return ${side} ${y}`);
    }
    const diffuser = mesh(wallSurface(side, -.015), warm, `Warm curved diffuser ${side}`);
    diffuser.castShadow = false;
    const ribs = [];
    // Each woven strand has real relief. Grouping the ribbons keeps draw calls low.
    for (let column = 0; column <= 40; column++) {
      for (const thread of [-1, 0, 1]) {
        const points = [];
        for (let step = 0; step <= 112; step++) {
          const y = .3 + 3.16 * step / 112;
          const bow = Math.sin(y * Math.PI / .31 + column * Math.PI) * .0055;
          const u = THREE.MathUtils.clamp(column / 40 + thread * .004 + bow, .001, .999);
          points.push(surfacePoint(side, u, y, .035 + Math.cos(y * Math.PI / .155) * .009));
        }
        ribs.push(ribbon(points, .0115));
      }
    }
    for (let row = 0; row <= 24; row++) {
      for (const thread of [-1, 0, 1]) {
        const points = [];
        for (let step = 0; step <= 160; step++) {
          const u = step / 160;
          const y = .31 + row * .13 + thread * .014 + Math.sin(u * Math.PI * 80) * .006;
          points.push(surfacePoint(side, u, y, .047 + Math.cos(u * Math.PI * 80) * .012));
        }
        ribs.push(ribbon(points, .009, true));
      }
    }
    const lattice = mesh(mergeGeometries(ribs), weave, `Dimensional woven brass ${side}`, true);
    lattice.userData.sectionSkip = true;
    lattice.castShadow = false;
    ribs.forEach(geometry => geometry.dispose());
    for (const u of [0, 1]) {
      const p = surfacePoint(side, u, 1.89, -.045);
      const cap = box(`Bronze lightbox end cap ${side} ${u}`, [.12, 3.3, .25], p.toArray(), bronze, .01);
      cap.rotation.y = -side * Math.atan(4.4 * u / 3.72);
    }
    for (const y of [.29, 3.48]) {
      const points = Array.from({ length: 97 }, (_, i) => surfacePoint(side, i / 96, y, .025));
      mesh(ribbon(points, .045, true), bronze, `Curved perimeter trim ${side} ${y}`, true);
    }
    const spill = new THREE.RectAreaLight(0xffd49b, 2.2, 3.3, 2.8);
    spill.position.copy(surfacePoint(side, .53, 1.85, .15));
    spill.lookAt(spill.position.x, .1, spill.position.z + 3);
    lightGroup.add(spill);
  }
  for (const x of [-1.15, 0, 1.15]) {
    box('Recessed spotlight bezel', [.08, .018, .065], [CX + x, 3.213, 15.38], dark, .005);
    const lens = box('Recessed spotlight lens', [.05, .01, .045], [CX + x, 3.201, 15.38], new THREE.MeshBasicMaterial({ color: '#fff2d8' }), .003);
    lens.userData.noCollision = true;
    const spot = new THREE.SpotLight(0xffedcd, 7, 5, .64, .85, 2);
    spot.position.set(CX + x, 3.18, 15.42);
    spot.target.position.set(CX + x * .75, 1.75, 15.08);
    spot.castShadow = false;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.bias = -.0002;
    spot.shadow.normalBias = .006;
    lightGroup.add(spot, spot.target);
  }
  model.updateMatrixWorld(true);
  return { group, lightGroup, removed: obsolete.length };
}
