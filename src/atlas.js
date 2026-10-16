export const CRAFTS = [
  {id:'blacksmith',name:'Blacksmith',medium:'IRON / FIRE / FORM',point:[74.8,27.8],description:'Forging everyday objects with heat, rhythm and skill.'},
  {id:'potter',name:'Pottery',medium:'EARTH / WATER / WHEEL',point:[76,23.6],description:'From raw clay to vessels shaped by hand.'},
  {id:'basket',name:'Basket weaving',medium:'CANE / FIBRE / PATTERN',point:[91.2,26.1],description:'Natural fibres woven into lasting, useful forms.'},
  {id:'tailor',name:'Tailoring',medium:'CLOTH / CUT / STITCH',point:[72.8,21.2],description:'Pattern, proportion and the precision of a stitch.'},
  {id:'carpenter',name:'Carpentry',medium:'WOOD / GRAIN / JOINERY',point:[78.2,29.2],description:'Working with the grain, from timber to furniture.'},
  {id:'cobbler',name:'Cobbler',medium:'LEATHER / THREAD / LAST',point:[80.1,18.3],description:'Crafting and repairing footwear, one stitch at a time.'},
];

export async function loadAtlas() {
  const geo=await (await fetch(`${import.meta.env.BASE_URL}india.json`)).json();
  const images=await Promise.all(CRAFTS.map(c=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=`${import.meta.env.BASE_URL}artwork/${c.id}-bw.png`;})));
  const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=800;
  const state={canvas,geo,images,selected:0};drawAtlas(state);return state;
}

export function drawAtlas(state) {
  const {canvas,geo,images,selected}=state,ctx=canvas.getContext('2d');
  const ink='#dfc38b',muted='#8ba6b5',paper='#eff1e8';
  ctx.fillStyle='#0c2639';ctx.fillRect(0,0,1600,800);
  ctx.strokeStyle='#1c3c4e';ctx.lineWidth=1;
  for(let x=0;x<1600;x+=40){ctx.beginPath();ctx.moveTo(x,90);ctx.lineTo(x,740);ctx.stroke();}
  for(let y=100;y<750;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(1600,y);ctx.stroke();}
  function label(t,x,y,size=20,color=paper){ctx.fillStyle=color;ctx.font=`${size}px "Segoe UI",Arial`;ctx.fillText(t,x,y);}
  label('INDIA',45,59,32,ink);label('CRAFT ATLAS',155,59,24);
  label('MSME  /  LIVING TRADITIONS',1140,57,17,muted);
  ctx.strokeStyle=ink;ctx.globalAlpha=.65;ctx.beginPath();ctx.moveTo(44,83);ctx.lineTo(1556,83);ctx.stroke();ctx.globalAlpha=1;
  label('SIX CRAFTS. ONE SHARED LEGACY.',45,126,15,muted);
  CRAFTS.forEach((c,i)=>{
    const y=180+i*79;
    ctx.fillStyle=i===selected?'#214255':'#102d40';ctx.fillRect(44,y-32,306,61);
    ctx.fillStyle=i===selected?ink:'#3b5968';ctx.fillRect(44,y-32,3,61);
    label(`0${i+1}`,65,y+5,18,ink);label(c.name,108,y+5,21,i===selected?paper:muted);
  });
  const project=([lon,lat])=>[390+(lon-67)*21.7,702-(lat-6)*19.6];
  const polygons=geo.type==='MultiPolygon'?geo.coordinates:[geo.coordinates];
  ctx.beginPath();polygons.forEach(poly=>poly.forEach(ring=>ring.forEach((p,i)=>{const [x,y]=project(p);i?ctx.lineTo(x,y):ctx.moveTo(x,y);})));ctx.closePath();
  ctx.fillStyle='#183a4e';ctx.fill('evenodd');ctx.strokeStyle=ink;ctx.lineWidth=1.9;ctx.stroke();
  const points=CRAFTS.map(c=>project(c.point));
  ctx.strokeStyle='#b39765';ctx.globalAlpha=.5;ctx.lineWidth=1;
  points.forEach((p,i)=>{const q=points[(i+1)%points.length];ctx.beginPath();ctx.moveTo(...p);ctx.quadraticCurveTo((p[0]+q[0])/2+35,(p[1]+q[1])/2-40,...q);ctx.stroke();});ctx.globalAlpha=1;
  points.forEach((p,i)=>{ctx.beginPath();ctx.arc(...p,i===selected?15:8,0,Math.PI*2);ctx.strokeStyle=ink;ctx.stroke();ctx.beginPath();ctx.arc(...p,i===selected?6:3,0,Math.PI*2);ctx.fillStyle=i===selected?'#fff2c9':ink;ctx.fill();});
  label('CRAFT CONNECTIONS',435,139,15,muted);
  const c=CRAFTS[selected];
  ctx.fillStyle='#102d40';ctx.fillRect(1110,132,446,551);
  ctx.drawImage(images[selected],1130,155,406,244);
  label(c.name.toUpperCase(),1133,454,28,ink);label(c.medium,1133,493,14,muted);
  const words=c.description.split(' ');let line='',y=544;
  ctx.font='20px "Segoe UI",Arial';
  for(const word of words){if(ctx.measureText(line+word).width>380){label(line,1133,y,20);line='';y+=31;}line+=word+' ';}label(line,1133,y,20);
  label('HERITAGE',1133,642,14,ink);label('SKILL',1277,642,14,ink);label('ENTERPRISE',1370,642,14,ink);
  ctx.strokeStyle='#506579';ctx.beginPath();ctx.moveTo(44,734);ctx.lineTo(1556,734);ctx.stroke();
  label('IITF  /  MSME PAVILION',45,772,16,muted);label(`0${selected+1} / 06`,1445,772,18,ink);
}

export function selectAtlasAt(state,x,y) {
  if(x>=44&&x<=350&&y>=148&&y<=638){state.selected=Math.min(5,Math.floor((y-148)/79));drawAtlas(state);return true;}
  let best=-1,dist=40;
  CRAFTS.forEach((c,i)=>{const d=Math.hypot(x-(390+(c.point[0]-67)*21.7),y-(702-(c.point[1]-6)*19.6));if(d<dist){dist=d;best=i;}});
  if(best<0)return false;state.selected=best;drawAtlas(state);return true;
}
