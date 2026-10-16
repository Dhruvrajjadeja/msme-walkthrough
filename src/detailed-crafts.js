import * as THREE from 'three';
import { CraftBuilder, finishes as F, vessel, basket, shoe } from './craft-objects.js';

export async function prepareCraftMaterials() {
  const loader = new THREE.TextureLoader();
  const maps = await Promise.all(['diff','nor_gl','rough'].map(kind => loader.loadAsync(`${import.meta.env.BASE_URL}materials/wood_floor_${kind}_1k.jpg`)));
  maps.forEach(t => { t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(.115,.8);t.offset.set(.04,.08);t.anisotropy=8; });
  maps[0].colorSpace=THREE.SRGBColorSpace;
  for (const key of ['timber','endgrain']) {
    const m=F[key];m.map=maps[0];m.normalMap=maps[1];m.roughnessMap=maps[2];m.normalScale=new THREE.Vector2(.12,.12);
    m.color.set(key==='timber'?'#d1b38b':'#a88964');m.roughness=.65;m.needsUpdate=true;
  }
  F.iron.envMapIntensity=1.15;F.steel.envMapIntensity=1.25;
  F.clay.roughness=.72;F.paleClay.roughness=.65;
}

function screw(b,p,axis='z') {
  b.cyl(p,.006,.003,F.steel,axis==='z'?[Math.PI/2,0,0]:[0,0,0],.006,12);
  b.box([p[0],p[1],p[2]+.002],[.007,.0015,.001],F.iron,.0003);
}

export function bench(b,x=0,z=-.65,w=1.25,d=.55,h=.82) {
  for(let i=0;i<4;i++) b.box([x,h,z-d/2+d*(i+.5)/4],[w,.07,d/4-.002],F.timber,.005);
  for(const a of [-1,1])for(const c of [-1,1]){
    const xx=x+a*(w/2-.08),zz=z+c*(d/2-.07);
    b.box([xx,h/2,zz],[.075,h,.075]);
    screw(b,[xx,h-.09,zz+.039]);
  }
  for(const a of [-1,1]) b.box([x,.24,z+a*(d/2-.07)],[w-.12,.065,.045]);
  b.box([x,h-.11,z+d/2-.035],[w-.1,.15,.045]);
}

function hammer(b,x,y,z,s=1,angle=0) {
  const g=new THREE.Group(),c=new CraftBuilder(g);
  c.add(new THREE.LatheGeometry([new THREE.Vector2(.012*s,0),new THREE.Vector2(.016*s,.03*s),new THREE.Vector2(.012*s,.25*s),new THREE.Vector2(.009*s,.31*s)],16),F.timber);
  c.box([0,.30*s,0],[.14*s,.052*s,.05*s],F.iron,.008*s);
  c.box([-.071*s,.3*s,0],[.006*s,.044*s,.043*s],F.steel,.002*s);
  c.finish();g.position.set(x,y,z);g.rotation.z=angle;b.group.add(g);
}

function tongs(b,x,y,z,length=.42) {
  for(const side of [-1,1]) b.curve([[x+side*.035,y,z],[x+side*.02,y+length*.48,z],[x-side*.024,y+length*.73,z],[x-side*.035,y+length*.92,z],[x-side*.009,y+length,z]],.006,F.iron);
  b.cyl([x,y+length*.55,z+.003],.012,.012,F.steel,[Math.PI/2,0,0]);
}

export function anvil(b,x,y,z,s=1) {
  const profile=new THREE.Shape();
  profile.moveTo(-.22,0);profile.lineTo(.22,0);profile.lineTo(.21,.055);profile.bezierCurveTo(.08,.08,.07,.12,.075,.24);
  profile.lineTo(.235,.27);profile.lineTo(.235,.35);profile.lineTo(-.23,.35);profile.lineTo(-.23,.28);profile.bezierCurveTo(-.07,.25,-.08,.09,-.21,.055);profile.closePath();
  b.add(new THREE.ExtrudeGeometry(profile,{depth:.22,bevelEnabled:true,bevelSize:.009,bevelThickness:.007,bevelSegments:3,curveSegments:16}),F.iron,[x,y,z-.11*s],[0,0,0],[s,s,s]);
  b.box([x,y+.355*s,z],[.46*s,.017*s,.226*s],F.steel,.004*s);
  const horn=new THREE.LatheGeometry([[.0,0],[.052,.04],[.094,.15],[.11,.26]].map(p=>new THREE.Vector2(...p)),32);
  b.add(horn,F.steel,[x+.50*s,y+.31*s,z],[0,0,Math.PI/2],[s,s,s]);
  b.box([x-.14*s,y+.365*s,z-.025*s],[.026*s,.003*s,.027*s],F.sole,.002);
}

function stump(b,x,z,h=.64,r=.22) {
  b.cyl([x,h/2,z],r,h,F.endgrain,[0,0,0],r*.91,48);
  for(let i=0;i<34;i++){
    const a=i/34*Math.PI*2,rr=r*(.95+.03*Math.sin(i*17));
    b.curve([[x+rr*Math.cos(a),.02,z+rr*Math.sin(a)],[x+rr*.97*Math.cos(a+.018),h*.45,z+rr*.97*Math.sin(a+.018)],[x+rr*.94*Math.cos(a),h-.01,z+rr*.94*Math.sin(a)]],.004,F.timber);
  }
  for(let i=1;i<9;i++)b.ring([x,h+.001,z],r*i/10,.0009,F.leatherTan);
}

function armour(b,x,y,z) {
  const breast=new THREE.Shape();
  breast.moveTo(-.08,.47);breast.quadraticCurveTo(-.12,.40,-.22,.40);breast.lineTo(-.20,.21);breast.quadraticCurveTo(-.15,.12,-.14,0);
  breast.quadraticCurveTo(0,-.05,.14,0);breast.quadraticCurveTo(.15,.12,.20,.21);breast.lineTo(.22,.40);breast.quadraticCurveTo(.12,.40,.08,.47);breast.quadraticCurveTo(0,.39,-.08,.47);
  b.add(new THREE.ExtrudeGeometry(breast,{depth:.11,bevelEnabled:true,bevelSize:.032,bevelThickness:.05,bevelSegments:5,curveSegments:20}),F.steel,[x,y,z]);
  b.curve([[x,y-.02,z+.16],[x,y+.22,z+.19],[x,y+.39,z+.15]],.003,F.iron);
  for(const side of [-1,1]){
    for(let i=0;i<3;i++)b.ball([x+side*(.22+i*.025),y+.36-i*.047,z+.04],[.105,.065,.115],i%2?F.iron:F.steel);
    b.cyl([x+side*.285,y+.17,z+.04],.057,.21,F.iron,[0,0,side*.1],.071);
    for(let i=0;i<3;i++) b.box([x+side*.095,y-.035-i*.042,z+.08],[.18,.065,.07],F.steel,.012,[0,0,side*.07]);
    for(let i=0;i<5;i++) b.ball([x+side*(.145-.008*i),y+.025+i*.06,z+.16],[.004,.004,.003],F.iron);
  }
  b.cyl([x,y+.45,z+.06],.057,.09,F.iron);
  b.add(new THREE.SphereGeometry(.125,32,20,0,Math.PI*2,0,Math.PI*.7),F.steel,[x,y+.61,z+.055],[0,0,0],[.86,1.1,1]);
  b.box([x,y+.59,z+.164],[.17,.025,.009],F.sole,.004);
  b.box([x,y+.545,z+.173],[.025,.075,.018],F.steel,.004);
  for(const side of [-1,1])for(let i=0;i<4;i++) b.box([x+side*(.035+i*.017),y+.54,z+.165],[.005,.014,.004],F.sole,.001);
  b.rod([x,.4,z],[x,y+.35,z],.018,F.iron);
}

function shelf(b,x,z,w,h=1.9,rows=4,d=.34) {
  for(const side of [-1,1]) b.box([x+side*(w/2-.025),h/2,z],[.045,h,d]);
  b.box([x,h/2,z-d/2+.015],[w,h,.025],F.endgrain);
  for(let row=0;row<=rows;row++){
    const y=.12+row*(h-.15)/rows;b.box([x,y,z],[w,.035,d]);
    for(const side of [-1,1]) screw(b,[x+side*(w/2-.025),y,z+d/2+.002]);
  }
}

function foldedCloth(b,p,w=.27,d=.22,colour=F.textile) {
  const g=new THREE.PlaneGeometry(w,d,32,24),pos=g.attributes.position;
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),yy=pos.getY(i);pos.setZ(i,.006*Math.cos(x*92)+.003*Math.sin(yy*120+x*20));}
  g.computeVertexNormals();b.add(g,colour,[p[0],p[1]+.018,p[2]],[-Math.PI/2,0,0]);
  b.box(p,[w,.032,d],colour,.014);
  for(let i=0;i<4;i++)b.rod([p[0]-w/2+.012,p[1]-.007+i*.005,p[2]+d/2],[p[0]+w/2-.012,p[1]-.007+i*.005,p[2]+d/2],.0008,F.thread);
}

export function spokedWheel(b,x,y,z,r=.16,material=F.iron) {
  b.ring([x,y,z],r,r*.055,material,[0,0,0]);
  b.ring([x,y,z],r*.91,r*.018,material,[0,0,0]);
  b.cyl([x,y,z],r*.1,r*.18,material,[Math.PI/2,0,0]);
  for(let i=0;i<12;i++){const a=i*Math.PI/6;b.rod([x,y,z],[x+Math.cos(a)*r*.96,y+Math.sin(a)*r*.96,z],r*.023,material);}
}

export function sewingMachine(b,x,y,z,s=1) {
  const shape=new THREE.Shape();shape.moveTo(-.23,0);shape.lineTo(-.23,.045);shape.lineTo(.13,.045);shape.lineTo(.13,.26);
  shape.bezierCurveTo(.13,.30,-.12,.30,-.17,.27);shape.lineTo(-.17,.16);shape.lineTo(-.235,.16);shape.lineTo(-.235,.31);
  shape.bezierCurveTo(-.22,.39,.22,.40,.23,.27);shape.lineTo(.23,0);shape.closePath();
  b.box([x,y,z],[.58*s,.025*s,.29*s],F.enamel,.012*s);
  b.add(new THREE.ExtrudeGeometry(shape,{depth:.08,bevelEnabled:true,bevelSize:.012,bevelThickness:.012,bevelSegments:4,curveSegments:20}),F.enamel,[x,y+.02*s,z-.04*s],[0,0,0],[s,s,s]);
  b.cyl([x+.285*s,y+.25*s,z],.095*s,.025*s,F.iron,[0,0,Math.PI/2]);
  b.ring([x+.30*s,y+.25*s,z],.075*s,.009*s,F.steel,[0,Math.PI/2,0]);
  b.rod([x-.2*s,y+.22*s,z+.01*s],[x-.2*s,y+.035*s,z+.01*s],.003*s,F.steel);
  b.box([x-.2*s,y+.03*s,z+.025*s],[.025*s,.007*s,.052*s],F.steel,.002*s);
  b.box([x-.15*s,y+.016*s,z+.025*s],[.14*s,.003*s,.14*s],F.steel,.003*s);
  b.cyl([x+.13*s,y+.42*s,z],.018*s,.075*s,F.textileRust);
  b.curve([[x+.13*s,y+.46*s,z],[x-.1*s,y+.37*s,z+.05*s],[x-.2*s,y+.23*s,z+.05*s],[x-.2*s,y+.04*s,z+.01*s]],.0008*s,F.thread);
  for(let i=0;i<9;i++)b.ball([x+(-.13+i*.036)*s,y+.323*s,z+.055*s],[.005*s,.004*s,.001*s],F.wicker);
}

function spool(b,x,y,z,r=.025,h=.08,mat=F.thread) {
  b.cyl([x,y+h/2,z],r,h,mat);for(const yy of [y,y+h])b.cyl([x,yy,z],r*1.2,.006,F.timber);
  for(let j=0;j<8;j++)b.ring([x,y+j*h/8,z],r,.0009,mat);
}

function bambooShelf(b,x,z) {
  for(const a of [-1,1])for(const c of [-1,1]){
    const xx=x+a*.32,zz=z+c*.2;b.rod([xx,.03,zz],[xx,1.72,zz],.019,F.wickerDark);
    for(let j=0;j<7;j++)b.ring([xx,.08+j*.24,zz],.020,.002,F.wicker);
  }
  for(const y of [.25,.85,1.42]){
    for(let j=0;j<19;j++) b.rod([x-.3+j*.034,y,z-.22],[x-.3+j*.034,y,z+.22],.008,F.wicker);
    for(const a of [-1,1])b.rod([x-.34,y-.02,z+a*.21],[x+.34,y-.02,z+a*.21],.018,F.wickerDark);
  }
  b.rod([x-.3,.28,z-.2],[x+.3,1.4,z-.2],.01,F.wickerDark);
}

function stool(b,x,z) {
  b.cyl([x,.43,z],.17,.05,F.timber);
  for(let j=0;j<3;j++){const a=j*Math.PI*2/3;b.rod([x+Math.cos(a)*.15,.02,z+Math.sin(a)*.15],[x+Math.cos(a)*.1,.42,z+Math.sin(a)*.1],.025,F.timber);}
  b.ring([x,.2,z],.13,.011,F.timber);
}

function wallTools(b,key) {
  b.box([-.1,1.55,-1.28],[1.35,.72,.035],F.endgrain);
  for(let ix=0;ix<18;ix++)for(let iy=0;iy<8;iy++)b.cyl([-.72+ix*.072,1.26+iy*.081,-1.258],.003,.003,F.sole,[Math.PI/2,0,0],.003,6);
  hammer(b,-.57,1.28,-1.20,.85,-.12);hammer(b,-.34,1.26,-1.20,.7,.15);
  if(key==='blacksmith'){tongs(b,.08,1.25,-1.20,.47);tongs(b,.32,1.26,-1.20,.43);return;}
  b.box([.16,1.6,-1.20],[.21,.018,.018],F.steel,.002);
  b.box([.255,1.47,-1.20],[.024,.26,.035],F.timber,.002);
  for(let i=0;i<3;i++){const xx=-.11+i*.065;b.rod([xx,1.3,-1.2],[xx,1.45,-1.2],.013,F.timber);b.box([xx,1.55,-1.2],[.018,.20,.008],F.steel,.001);}
  b.curve([[.47,1.81,-1.2],[.47,1.70,-1.2],[.59,1.67,-1.2],[.59,1.48,-1.2],[.47,1.45,-1.2],[.47,1.30,-1.2]],.009,F.steel);
  b.cyl([.59,1.57,-1.20],.02,.09,F.timber);
}

export function populateDetailedCraft(b,key) {
  if(key==='blacksmith'){
    stump(b,-.36,-.57,.68,.24);anvil(b,-.39,.69,-.57,.95);
    stump(b,.47,-.93,.46,.19);armour(b,.47,.74,-.94);
    wallTools(b,key);hammer(b,-.55,.97,-.43,.75,-.92);
    for(let i=0;i<3;i++)tongs(b,-.15+i*.075,.18,-1.13,.52);
    b.box([-.66,.08,-1.11],[.26,.12,.28],F.iron,.008);
    for(let i=0;i<12;i++)b.ball([-.73+(i%3)*.06,.15+Math.floor(i/3)*.018,-1.2+Math.floor(i/3)*.045],[.035,.022,.028],F.iron);
  }else if(key==='potter'){
    bench(b,-.32,-.52,.75,.60,.68);
    b.cyl([-.32,.76,-.49],.27,.055,F.endgrain);b.ring([-.32,.79,-.49],.25,.006,F.iron);
    for(let i=1;i<8;i++)b.ring([-.32,.792,-.49],i*.03,.0009,F.paleClay);
    vessel(b,-.32,.79,-.49,.115,.29,0);
    shelf(b,.52,-1.03,.54,2.02,4,.42);
    for(let j=0;j<4;j++)for(let i=0;i<2;i++)vessel(b,.38+i*.25,.17+j*.467,-.95,.09,.2+(j%2)*.12,j+i);
    vessel(b,-.63,.03,-1.09,.17,.47,2);vessel(b,-.1,.04,-1.13,.15,.25,1);
    for(let j=0;j<5;j++)vessel(b,-.56,.73+j*.014,-.31,.082,.025,1);
    for(let j=0;j<3;j++)b.rod([-.14+j*.045,.725,-.35],[-.11+j*.045,.725,-.64],.005,F.timber);
    b.box([-.34,1.64,-1.28],[.8,.47,.025],F.endgrain);
    for(let i=0;i<6;i++){const x=-.66+i*.125;b.rod([x,1.49,-1.23],[x,1.68,-1.23],.008,F.timber);b.curve([[x-.02,1.68,-1.23],[x-.025,1.77,-1.23],[x+.025,1.77,-1.23],[x+.02,1.68,-1.23]],.002,F.steel);}
  }else if(key==='basket'){
    bambooShelf(b,.42,-.96);
    for(let j=0;j<3;j++)basket(b,.42,.27+j*.585,-.96,.19,.24,j!==1);
    bench(b,-.36,-.53,.72,.47,.73);
    basket(b,-.37,.77,-.52,.20,.23);basket(b,-.65,.03,-1.06,.17,.38);basket(b,.12,.03,-.37,.15,.21);
    for(let j=0;j<13;j++)b.rod([-.65+j*.02,.78,-.35],[-.65+j*.02,.78,-.65],.003,F.wicker);
    for(let j=0;j<14;j++)b.rod([-.68,.78,-.35-j*.022],[-.4,.78,-.35-j*.022],.0025,F.wickerDark);
    for(let j=0;j<11;j++)b.rod([-.79+j*.016,.03,-1.19],[-.77+j*.017,1.4+(j%3)*.07,-1.21],.007,F.wicker);
    for(let j=0;j<3;j++){const gg=new THREE.Group();gg.position.set(-.53+j*.30,1.63,-1.23);gg.rotation.x=Math.PI/2;b.group.add(gg);const bb=new CraftBuilder(gg);basket(bb,0,0,0,.12,.035,false);bb.finish();}
  }else if(key==='tailor'){
    b.box([.14,.84,-.50],[1.14,.055,.51],F.timber);
    for(const x of [-.29,.57]){
      for(const z of [-.69,-.32]) b.curve([[x,.04,z],[x,.13,z-.01],[x,.67,z+.02],[x,.81,z]],.013,F.iron);
      b.rod([x,.12,-.71],[x,.12,-.29],.012,F.iron);
      b.curve([[x,.22,-.66],[x,.57,-.61],[x,.64,-.44],[x,.25,-.35]],.008,F.iron);
    }
    spokedWheel(b,.46,.48,-.55,.20);b.box([.13,.21,-.48],[.37,.018,.25],F.iron,.003,[.18,0,0]);
    for(let i=0;i<9;i++)b.rod([-.02+i*.035,.228,-.59],[-.02+i*.035,.228,-.37],.003,F.steel);
    b.curve([[.45,.48,-.55],[.45,.8,-.55],[.45,1.12,-.55]],.002,F.leather);
    sewingMachine(b,.13,.88,-.50,.91);
    shelf(b,-.41,-1.10,.69,2.07,5,.31);
    for(let row=0;row<4;row++)for(let col=0;col<2;col++)for(let k=0;k<3;k++)foldedCloth(b,[-.58+col*.32,.16+row*.384+k*.038,-1.05],.28,.25,[F.textile,F.textileRust,F.thread][(row+col+k)%3]);
    for(let i=0;i<7;i++)spool(b,-.7+i*.09,2.09,-1.10,.027,.1,[F.thread,F.textileRust,F.textile][i%3]);
    foldedCloth(b,[-.24,.9,-.41],.22,.24,F.textileRust);stool(b,.38,-1.04);
  }else if(key==='carpenter'){
    bench(b,0,-.62,1.44,.65,.84);wallTools(b,key);
    b.box([-.44,.80,-.245],[.28,.18,.065]);b.box([-.44,.80,-.34],[.28,.16,.055]);
    b.rod([-.44,.80,-.45],[-.44,.80,-.16],.017,F.steel);b.rod([-.44,.69,-.16],[-.44,.93,-.16],.012,F.timber);
    for(let i=0;i<4;i++)b.box([.25,.89+i*.028,-.73],[.66,.025,.16],F.timber,.002);
    b.box([-.25,.9,-.55],[.12,.065,.30],F.iron,.009);b.box([-.25,.87,-.55],[.127,.012,.31],F.steel,.004);
    b.curve([[-.25,.93,-.66],[-.25,1.02,-.63],[-.25,1.0,-.48],[-.25,.91,-.45]],.015,F.timber);
    b.box([-.25,.945,-.54],[.07,.11,.006],F.steel,.001,[-.42,0,0]);
    for(let i=0;i<14;i++){const x=.03+i*.026;b.curve([[x,.88,-.4],[x+.012,.92,-.38],[x+.035,.91,-.39],[x+.025,.885,-.42]],.0018,F.wicker);}
    const saw=new THREE.Shape();saw.moveTo(-.23,0);for(let i=0;i<31;i++){saw.lineTo(-.23+i*.014,.02*(i%2));}saw.lineTo(.2,.11);saw.lineTo(-.23,.075);saw.closePath();
    b.add(new THREE.ExtrudeGeometry(saw,{depth:.002,bevelEnabled:false}),F.steel,[.15,1.23,-1.20]);b.ring([.43,1.29,-1.20],.06,.012,F.timber,[0,0,0]);
    b.box([-.25,.27,-.64],[.62,.16,.28],F.endgrain);b.curve([[-.45,.35,-.64],[-.45,.46,-.64],[-.05,.46,-.64],[-.05,.35,-.64]],.016,F.timber);stool(b,.51,-1.10);
  }else{
    bench(b,0,-.58,1.30,.60,.75);
    shelf(b,.53,-1.10,.56,2.02,4,.33);
    for(let row=0;row<4;row++)for(let j=0;j<2;j++)shoe(b,.39+j*.24,.16+row*.467,-1.06,.63,(row+j)%2===0);
    b.box([-.40,1.55,-1.27],[.75,.72,.025],F.endgrain);
    for(let i=0;i<7;i++){const x=-.71+i*.096;spool(b,x,1.77,-1.20,.024,.08,[F.thread,F.leatherTan,F.leather][i%3]);b.rod([x,1.27,-1.21],[x,1.47,-1.21],.009,F.timber);b.rod([x,1.47,-1.21],[x+.012,1.57,-1.21],.002,F.steel);}
    shoe(b,-.29,.79,-.48,1.05);shoe(b,.06,.79,-.51,1,true);
    for(let i=0;i<4;i++)spool(b,-.52+i*.1,.79,-.77,.026,.1);
    for(let row=0;row<4;row++){
      b.cyl([-.62,.16+row*.26,-1.06],.085,.34,row%2?F.leatherTan:F.leather,[0,0,Math.PI/2]);
      for(let j=0;j<4;j++)b.ring([-.445,.16+row*.26,-1.06],.025+j*.015,.0015,F.thread,[0,Math.PI/2,0]);
    }
    hammer(b,.42,.79,-.48,.6,.92);b.box([.37,.79,-.72],[.19,.004,.15],F.leatherTan,.004);
    for(let j=0;j<14;j++) b.ball([.29+j*.012,.794,-.65],[.0015,.0015,.0015],F.thread);
  }
  // Small construction hardware and a consistent shadowed skirting ground the displays.
  b.box([0,.055,-1.32],[1.65,.08,.045],F.enamel,.003);
}

export function workshopPendant(b,key) {
  b.rod([0,3.05,-.70],[0,2.36,-.70],.004,F.iron);
  const woven=['potter','basket','tailor'].includes(key);
  if(woven){
    for(let i=0;i<28;i++){
      const a=i*Math.PI*2/28;
      b.curve(Array.from({length:12},(_,j)=>{const t=j/11,r=.065+.13*Math.sin(t*Math.PI*.6);return [Math.cos(a)*r,2.37-t*.23,-.7+Math.sin(a)*r];}),.003,F.wickerDark);
    }
    for(let j=0;j<12;j++){const t=j/11;b.ring([0,2.37-t*.23,-.7],.065+.13*Math.sin(t*Math.PI*.6),.0025,F.wicker);}
  }else{
    b.cyl([0,2.32,-.70],.13,.075,F.enamel,[0,0,0],.035);
    for(let i=0;i<10;i++){const a=i*Math.PI/5;b.curve([[.13*Math.cos(a),2.29,-.7+.13*Math.sin(a)],[.13*Math.cos(a),2.14,-.7+.13*Math.sin(a)],[.07*Math.cos(a),2.11,-.7+.07*Math.sin(a)]],.002,F.iron);}
    b.ring([0,2.14,-.7],.13,.003,F.iron);
  }
}
