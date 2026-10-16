import * as THREE from 'three';
import { CraftBuilder, finishes as F, vessel, basket, shoe } from './craft-objects.js';
import { anvil, bench, sewingMachine, spokedWheel } from './detailed-crafts.js';

const TRADES=['blacksmith','potter','basket','tailor','carpenter','cobbler'];
const LABELS=['FORGE & FORM','EARTH & WHEEL','FIBRE & WEAVE','CUT & STITCH','GRAIN & JOINERY','LEATHER & LAST'];

function carvedFigure(b,x,y,z,{seated=false,turn=0}={}) {
  const group=new THREE.Group();group.position.set(x,y,z);group.rotation.y=turn;b.group.add(group);
  const c=new CraftBuilder(group),m=F.timber,hip=seated?.40:.72;
  c.add(new THREE.LatheGeometry([[.10,0],[.14,.10],[.16,.24],[.19,.37],[.13,.43],[.065,.47]].map(p=>new THREE.Vector2(...p)),20),m,[0,hip,0]);
  c.cyl([0,hip+.48,0],.046,.08,m);
  c.ball([0,hip+.61,-.005],[.09,.12,.085],m);
  c.ball([0,hip+.60,.076],[.018,.027,.029],m);
  c.ball([0,hip+.67,-.025],[.092,.067,.074],F.endgrain);
  for(const s of [-1,1]){
    c.ball([s*.087,hip+.60,0],[.018,.03,.022],m);
    const knee=[s*.10,seated?.34:.37,seated?.30:.025],foot=[s*.12,.06,seated?.33:.075];
    c.rod([s*.09,hip+.03,0],knee,.065,m);c.ball(knee,[.067,.065,.065],m);c.rod(knee,foot,.045,m);c.ball([foot[0],.038,foot[2]+.055],[.052,.035,.10],m);
    const elbow=[s*.24,hip+.21,.16],hand=[s*.10,hip+.13,.35];
    c.ball([s*.15,hip+.36,0],[.065,.07,.065],m);c.rod([s*.15,hip+.36,0],elbow,.044,m);c.rod(elbow,hand,.034,m);c.ball(hand,[.04,.025,.06],m);
    for(let i=0;i<3;i++)c.rod([hand[0]+s*i*.012,hand[1],hand[2]],[hand[0]+s*i*.012,hand[1]-.015,hand[2]+.05],.006,m);
  }
  c.finish();
}

function miniature(parent,key,x,z,angle) {
  const group=new THREE.Group();group.name=`Carved ${key} miniature`;group.position.set(x,.985,z);group.rotation.y=angle;group.scale.setScalar(.19);parent.add(group);
  const b=new CraftBuilder(group);
  b.cyl([0,.015,0],.66,.055,F.endgrain,[0,0,0],.65,48);
  if(key==='blacksmith'){
    b.cyl([.03,.24,.08],.22,.43,F.endgrain);anvil(b,.03,.46,.08,.8);carvedFigure(b,-.23,.04,-.29,{seated:true});
    b.rod([.35,.05,-.3],[.35,.05,.35],.025,F.timber);b.box([.35,.07,.32],[.16,.08,.08],F.iron);
  }else if(key==='potter'){
    b.cyl([0,.30,.12],.23,.05,F.timber);b.cyl([0,.15,.12],.04,.28,F.timber);vessel(b,0,.33,.12,.11,.22);
    carvedFigure(b,0,.04,-.33,{seated:true});vessel(b,.36,.04,.2,.11,.2,2);vessel(b,-.32,.04,.21,.13,.18,1);
  }else if(key==='basket'){
    carvedFigure(b,0,.04,-.20,{seated:true});basket(b,0,.04,.25,.22,.22);basket(b,.38,.04,.02,.13,.18);
  }else if(key==='tailor'){
    bench(b,0,.16,.83,.40,.62);sewingMachine(b,0,.66,.13,.75);carvedFigure(b,0,.04,-.28,{seated:true});
  }else if(key==='carpenter'){
    bench(b,0,.12,.95,.42,.70);carvedFigure(b,0,.04,-.28);
    b.box([.1,.75,.12],[.56,.06,.17],F.timber);b.box([.05,.80,.15],[.09,.05,.16],F.iron);
    for(let i=0;i<5;i++)b.box([-.2,.10+i*.045,.25],[.57,.04,.08],F.timber);
  }else{
    bench(b,0,.20,.80,.38,.55);shoe(b,-.16,.60,.2,.8);shoe(b,.14,.60,.2,.8,true);carvedFigure(b,0,.04,-.25,{seated:true});
    b.cyl([.32,.12,-.18],.09,.2,F.leatherTan,[0,0,Math.PI/2]);
  }
  b.finish();
  // The reference is a carved wooden museum model, not life-size figures.
  group.traverse(o=>{if(o.isMesh){o.material=F.timber;o.userData.noCollision=true;o.userData.sectionSkip=true;}});
}

function craftPlate(texture,index) {
  const r0=1.23,r1=1.465,a0=index/24*Math.PI*2+.008,a1=(index+1)/24*Math.PI*2-.008;
  const p=[],uv=[],idx=[];
  for(let j=0;j<=8;j++){
    const a=THREE.MathUtils.lerp(a0,a1,j/8);
    for(const r of [r0,r1]){p.push(Math.sin(a)*r,.982,Math.cos(a)*r);uv.push(j/8,r===r0?1:0);}
    if(j<8){const k=j*2;idx.push(k,k+1,k+2,k+1,k+3,k+2);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();
  return new THREE.Mesh(g,new THREE.MeshStandardMaterial({map:texture,roughness:.49,side:THREE.DoubleSide}));
}

export async function buildCircularDiorama(model,lights) {
  const group=new THREE.Group();group.name='Craft India | carved circular diorama';group.userData.category='09 Circular diorama';group.position.set(-.427,0,-9.35);model.add(group);
  const b=new CraftBuilder(group);
  b.cyl([0,.57,0],1.5,.69,F.timber,[0,0,0],1.5,128);
  b.cyl([0,.238,0],1.445,.07,F.endgrain,[0,0,0],1.445,128);
  b.cyl([0,.935,0],1.51,.055,F.endgrain,[0,0,0],1.50,128);
  b.cyl([0,.964,0],1.485,.018,F.timber,[0,0,0],1.485,128);
  for(let i=0;i<96;i++){
    const a=i*Math.PI*2/96;b.rod([Math.sin(a)*1.501,.27,Math.cos(a)*1.501],[Math.sin(a)*1.501,.90,Math.cos(a)*1.501],.0009,F.endgrain);
  }
  for(const r of [1.19,1.215,1.478])b.ring([0,.980,0],r,.003,F.wicker);
  // Shallow contour engraving across the tabletop, interrupted by the raised map.
  for(let i=0;i<19;i++){
    const r=.22+i*.049;
    b.curve(Array.from({length:129},(_,j)=>{const a=j/128*Math.PI*2,rr=r+.013*Math.sin(a*7+i*.6)+.009*Math.sin(a*13);return [Math.cos(a)*rr,.976,Math.sin(a)*rr];}),.0008,F.endgrain);
  }
  b.finish();
  group.children[0].userData.noCollision=false;
  group.children[0].userData.collisionGeometry=new THREE.CylinderGeometry(1.52,1.52,.78,64).translate(0,.59,0);

  const geo=await(await fetch(`${import.meta.env.BASE_URL}india.json`)).json();
  const polygons=geo.type==='MultiPolygon'?geo.coordinates:[geo.coordinates];
  for(const polygon of polygons){
    const ring=polygon[0];if(ring.length<4)continue;
    const shape=new THREE.Shape();ring.forEach(([lon,lat],i)=>{const x=(lon-81.7)*.045,y=(lat-22.8)*.045;i?shape.lineTo(x,y):shape.moveTo(x,y);});shape.closePath();
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:.055,bevelEnabled:true,bevelSize:.006,bevelThickness:.004,bevelSegments:2,curveSegments:2});geometry.rotateX(-Math.PI/2);
    const map=new THREE.Mesh(geometry,new THREE.MeshPhysicalMaterial({color:'#d4ad65',roughness:.47,clearcoat:.18}));map.name='Raised geographic India relief';map.position.y=.982;map.castShadow=map.receiveShadow=true;map.userData.noCollision=true;map.userData.sectionSkip=true;group.add(map);
  }
  for(let i=0;i<6;i++){
    const a=i*Math.PI/3+.12;miniature(group,TRADES[i],Math.sin(a)*.91,Math.cos(a)*.91,a);
  }
  // Central spinning wheels, handloom and figures enrich the geographic relief.
  const center=new THREE.Group();center.position.y=1.044;center.scale.setScalar(.19);group.add(center);const c=new CraftBuilder(center);
  for(const [x,z] of [[-.9,.2],[.6,-1.3],[1.1,.7]]){
    c.box([x,.04,z],[.65,.07,.44],F.endgrain);spokedWheel(c,x,.55,z,.38,F.timber);
    for(const s of [-1,1])c.rod([x+s*.25,.06,z-.11],[x,.55,z],.028,F.timber);
  }
  for(const s of [-1,1])for(const zz of [-.58,.02])c.rod([-.8+s*.4,0,-2.1+zz],[-.8+s*.4,.9,-2.1+zz],.025,F.timber);
  for(const y of [.35,.86])for(const zz of [-.58,.02])c.rod([-1.2,y,-2.1+zz],[-.4,y,-2.1+zz],.022,F.timber);
  for(let i=0;i<24;i++)c.rod([-1.16+i*.031,.78,-2.65],[-1.16+i*.031,.38,-2.10],.003,F.thread);
  carvedFigure(c,-.6,0,1.7,{seated:true});carvedFigure(c,.7,0,-.6);carvedFigure(c,-1.1,0,-1.6,{seated:true});
  c.finish();center.traverse(o=>{if(o.isMesh)o.material=F.timber;});

  const details=new CraftBuilder(group);
  for(let i=0;i<12;i++){
    const a=i*Math.PI/6+.35,x=Math.sin(a)*1.10,z=Math.cos(a)*1.10;
    if(i%2)vessel(details,x,.98,z,.042,.055+(i%3)*.013,i%4);else basket(details,x,.98,z,.045,.045,false);
  }
  details.finish();
  const loader=new THREE.TextureLoader();
  for(let i=0;i<6;i++){
    const art=await loader.loadAsync(`${import.meta.env.BASE_URL}artwork/${TRADES[i]}-composed-v2.png`);art.colorSpace=THREE.SRGBColorSpace;
    const canvas=document.createElement('canvas');canvas.width=640;canvas.height=384;const ctx=canvas.getContext('2d');
    ctx.fillStyle='#ddc7a0';ctx.fillRect(0,0,640,384);ctx.drawImage(art.image,12,12,616,296);ctx.fillStyle='#3f2c1c';ctx.font='600 24px Georgia';ctx.textAlign='center';ctx.fillText(LABELS[i],320,354);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
    for(let j=0;j<4;j++){const plate=craftPlate(texture,i*4+j);plate.name=`Rim interpretation ${TRADES[i]} ${j}`;plate.userData.noCollision=true;plate.userData.sectionSkip=true;group.add(plate);}
    art.dispose();
  }
  const glow=new THREE.Mesh(new THREE.TorusGeometry(1.46,.012,8,128),new THREE.MeshBasicMaterial({color:new THREE.Color(3.5,1.9,.65)}));glow.rotation.x=Math.PI/2;glow.position.y=.232;glow.name='Recessed continuous warm diorama underlight';glow.userData.noCollision=true;group.add(glow);
  const spot=new THREE.SpotLight(0xffe2af,18,7,.65,.8,2);spot.position.set(-.427,3.7,-9.35);spot.target.position.set(-.427,.95,-9.35);spot.castShadow=true;spot.shadow.mapSize.set(1024,1024);spot.shadow.bias=-.0002;spot.shadow.normalBias=.003;lights.add(spot,spot.target);
  for(let i=0;i<4;i++){const a=i*Math.PI/2;const light=new THREE.PointLight(0xffca7d,.65,1.2,2);light.position.set(-.427+Math.sin(a)*1.42,.29,-9.35+Math.cos(a)*1.42);lights.add(light);}
  group.userData.miniatureScenes=6;group.userData.rimPlates=24;group.userData.diameter=3.02;
  return group;
}
