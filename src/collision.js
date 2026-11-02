import { Box3, Triangle, Vector3 } from 'three';
import { Octree } from 'three/addons/math/Octree.js';
import { yieldToBrowser } from './loading.js';

export async function buildCollision(root) {
  const meshes = [];
  root.updateMatrixWorld(true);
  root.traverse(mesh => { if (mesh.isMesh) meshes.push(mesh); });
  const data = [], transfer = [];
  for (const mesh of meshes) {
    const attribute = mesh.geometry.attributes.position;
    const positions = new Float32Array(attribute.count * 3);
    for (let i = 0; i < attribute.count; i++) {
      positions[i*3] = attribute.getX(i); positions[i*3+1] = attribute.getY(i); positions[i*3+2] = attribute.getZ(i);
      if (i && i % 30000 === 0) await yieldToBrowser();
    }
    const index = mesh.geometry.index?.array.slice();
    data.push({ positions, index, matrix: mesh.matrixWorld.toArray() });
    transfer.push(positions.buffer); if (index) transfer.push(index.buffer);
    await yieldToBrowser();
  }
  const worker = new Worker(new URL('./collision-worker.js', import.meta.url), { type: 'module' });
  try {
    const packed = await new Promise((resolve, reject) => {
      worker.onmessage = ({ data }) => data.error ? reject(new Error(data.error)) : resolve(data);
      worker.onerror = event => reject(new Error(event.message || 'Collision worker failed'));
      worker.postMessage(data, transfer);
    });
    const triangles = [], trees = [];
    for (let i = 0; i < packed.vertices.length; i += 9) {
      triangles.push(new Triangle(new Vector3().fromArray(packed.vertices, i), new Vector3().fromArray(packed.vertices, i+3), new Vector3().fromArray(packed.vertices, i+6)));
      if (i % 45000 === 0) await yieldToBrowser();
    }
    for (const node of packed.nodes) {
      const tree = new Octree(new Box3(new Vector3().fromArray(node.box), new Vector3().fromArray(node.box, 3)));
      tree.triangles = node.triangles.map(id => triangles[id]); trees.push(tree);
      if (trees.length % 500 === 0) await yieldToBrowser();
    }
    packed.nodes.forEach((node, i) => { trees[i].subTrees = node.children.map(id => trees[id]); });
    return trees[0];
  } finally { worker.terminate(); }
}
