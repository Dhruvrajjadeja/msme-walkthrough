import { BufferGeometry, BufferAttribute, Group, Mesh } from 'three';
import { Octree } from 'three/addons/math/Octree.js';

self.onmessage = ({ data }) => {
  try {
    const root = new Group();
    for (const item of data) {
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new BufferAttribute(item.positions, 3));
      if (item.index) geometry.setIndex(new BufferAttribute(item.index, 1));
      const mesh = new Mesh(geometry);
      mesh.matrix.fromArray(item.matrix); mesh.matrixAutoUpdate = false;
      root.add(mesh);
    }
    const tree = new Octree().fromGraphNode(root);
    const ids = new Map(), triangles = [], nodes = [];
    function pack(node) {
      const id = nodes.length;
      const entry = { box: [...node.box.min.toArray(), ...node.box.max.toArray()], triangles: [], children: [] };
      nodes.push(entry);
      for (const triangle of node.triangles) {
        if (!ids.has(triangle)) {
          ids.set(triangle, triangles.length / 9);
          triangles.push(...triangle.a.toArray(), ...triangle.b.toArray(), ...triangle.c.toArray());
        }
        entry.triangles.push(ids.get(triangle));
      }
      entry.children = node.subTrees.map(pack);
      return id;
    }
    pack(tree);
    const vertices = new Float32Array(triangles);
    self.postMessage({ nodes, vertices }, [vertices.buffer]);
  } catch (error) { self.postMessage({ error: error.message }); }
};
