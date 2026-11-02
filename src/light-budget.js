import { Vector3 } from 'three';

// Keep shader light counts stable while swapping in the closest exhibit lights.
export function createLightBudget(scene, renderer, mobile) {
  const pools=[[],[],[],[]],limits=mobile?[2,3,4,3]:[3,5,6,3];
  const point=new Vector3();
  scene.updateMatrixWorld(true);
  scene.traverse(light=>{
    const slot=light.isSpotLight?(light.castShadow?0:1):light.isRectAreaLight?2:light.isPointLight?3:-1;
    if(slot>=0)pools[slot].push({light,position:light.getWorldPosition(new Vector3())});
  });
  let last=-Infinity;
  return (camera,now=performance.now())=>{
    if(now-last<1000)return;
    last=now;camera.getWorldPosition(point);
    let changed=false;
    pools.forEach((pool,index)=>{
      pool.sort((a,b)=>a.position.distanceToSquared(point)-b.position.distanceToSquared(point));
      pool.forEach(({light},i)=>{
        const visible=i<limits[index];
        if(light.visible!==visible)changed=true;
        light.visible=visible;
      });
    });
    if(changed)renderer.shadowMap.needsUpdate=true;
  };
}
