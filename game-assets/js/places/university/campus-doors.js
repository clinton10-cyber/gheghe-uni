/* campus-doors.js -- real, animated doors for every doorway on campus.
   Doors stay CLOSED until a person (the player or any NPC) walks up to them, swing open
   while someone is in the doorway, then close again. All leaves are drawn with two
   InstancedMeshes so ~300 doors cost 2 draw calls. Doors have no collider: they are
   automatic, so they can never trap the player or an NPC. */
import * as THREE from "three";

const MAX_ANGLE = 1.55;          // ~89 degrees
const OPEN_SPEED = 2.6;          // full swing in ~0.4s
const TRIGGER = 2.3;             // metres from the door centre

export function createDoorSystem(scene) {
  const recs = [];
  let woodMesh = null, glassMesh = null;
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(),
        _s = new THREE.Vector3(), _e = new THREE.Euler();

  /* d: { axis:'x'|'z' (axis the WALL runs along), x, z (doorway centre), width, y0, h,
          swing: +1|-1 (side of the wall the leaves swing into), glass:boolean } */
  function add(d) { recs.push({ ...d, open: 0, leaves: [] }); }

  function finalize() {
    let nWood = 0, nGlass = 0;
    for (const r of recs) {
      const n = r.width >= 1.4 ? 2 : 1;
      const lw = r.width / n - 0.04;
      for (let i = 0; i < n; i++) {
        const s = n === 2 ? (i === 0 ? 1 : -1) : 1;            // direction the leaf extends from its hinge
        const hu = n === 2 ? (i === 0 ? -r.width / 2 + 0.02 : r.width / 2 - 0.02) : -r.width / 2 + 0.02;
        const idx = r.glass ? nGlass++ : nWood++;
        r.leaves.push({ s, hu, lw, idx });
      }
    }
    const geo = new THREE.BoxGeometry(1, 1, 1);
    if (nWood) {
      woodMesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0x7a4a2b, roughness: 0.6, metalness: 0.05 }), nWood);
      woodMesh.frustumCulled = false; scene.add(woodMesh);
    }
    if (nGlass) {
      glassMesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({
        color: 0x9fd6ea, roughness: 0.12, metalness: 0.35, transparent: true, opacity: 0.55, depthWrite: false }), nGlass);
      glassMesh.frustumCulled = false; scene.add(glassMesh);
    }
    for (const r of recs) place(r);
    if (woodMesh) woodMesh.instanceMatrix.needsUpdate = true;
    if (glassMesh) glassMesh.instanceMatrix.needsUpdate = true;
  }

  function place(r) {
    const inst = r.glass ? glassMesh : woodMesh;
    if (!inst) return;
    const T = r.open * MAX_ANGLE;
    for (const L of r.leaves) {
      let px, pz, th, sx, sz;
      if (r.axis === "z") {                       // wall runs along z, leaves swing toward +/-x
        th = r.swing * L.s * T;
        const hx = r.x, hz = r.z + L.hu;
        px = hx + L.s * Math.sin(th) * L.lw / 2;
        pz = hz + L.s * Math.cos(th) * L.lw / 2;
        sx = 0.07; sz = L.lw;
      } else {                                    // wall runs along x, leaves swing toward +/-z
        th = -r.swing * L.s * T;
        const hx = r.x + L.hu, hz = r.z;
        px = hx + L.s * Math.cos(th) * L.lw / 2;
        pz = hz - L.s * Math.sin(th) * L.lw / 2;
        sx = L.lw; sz = 0.07;
      }
      _p.set(px, r.y0 + (r.h - 0.04) / 2, pz);
      _e.set(0, th, 0); _q.setFromEuler(_e);
      _s.set(sx, r.h - 0.04, sz);
      _m.compose(_p, _q, _s);
      inst.setMatrixAt(L.idx, _m);
    }
  }

  /* actors: [{x,z,y}]  (player first). */
  function update(dt, actors) {
    let dirtyW = false, dirtyG = false;
    for (const r of recs) {
      let near = false;
      for (let i = 0; i < actors.length; i++) {
        const a = actors[i];
        const dx = a.x - r.x, dz = a.z - r.z;
        if (dx * dx + dz * dz < TRIGGER * TRIGGER && Math.abs((a.y || 0) - r.y0) < 3.2) { near = true; break; }
      }
      const target = near ? 1 : 0;
      if (r.open === target) continue;
      const step = OPEN_SPEED * dt;
      r.open = r.open < target ? Math.min(target, r.open + step) : Math.max(target, r.open - step);
      place(r);
      if (r.glass) dirtyG = true; else dirtyW = true;
    }
    if (dirtyW && woodMesh) woodMesh.instanceMatrix.needsUpdate = true;
    if (dirtyG && glassMesh) glassMesh.instanceMatrix.needsUpdate = true;
  }

  function dispose() {
    for (const m of [woodMesh, glassMesh]) if (m) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
  }
  return { add, finalize, update, dispose, count: () => recs.length };
}
