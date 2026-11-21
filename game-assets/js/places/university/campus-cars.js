/* campus-cars.js -- the student car park.
   * every model is normalised: nose points +Z, wheels sit exactly on the ground (no sinking),
     real-world length (the source models have different forward axes and scales)
   * parked cars sit square in marked bays (north bays nose north, south bays nose south)
   * arriving cars drive in through the gate on the right-hand lane, turn into the aisle and
     steer into a free bay along a smooth curve, always facing the way they travel
   * parked cars get colliders so nobody walks through them; the driver steps out beside the car */
import * as THREE from "three";
import { buildBMW3D } from "../../vehicles/bmw3d.js";
import { buildChiron3D } from "../../vehicles/chiron3d.js";
import { buildMercedes3D } from "../../vehicles/mercedes3d.js";
import { buildCybertruck3D } from "../../vehicles/cybertruck3d.js";
import { buildRangeRover3D } from "../../vehicles/rangerover_compound.js";
import { buildGWagon3D } from "../../vehicles/gwagon3d.js";

/* fwd = the model's native forward axis (checked from the vehicle sources) */
const MODELS = [
  { build: c => buildBMW3D(c), fwd: "+x", len: 4.6, colors: ["#18232e", "#8d1724", "#d7dce1"] },
  { build: c => buildMercedes3D(c), fwd: "+x", len: 4.8, colors: ["#20242a", "#c5cbd1", "#173f68"] },
  { build: c => buildRangeRover3D(c), fwd: "+z", len: 4.9, colors: ["#263b32", "#d6d1c6", "#15191e"] },
  { build: c => buildGWagon3D(c), fwd: "-z", len: 4.7, colors: ["#171b20", "#6d2631", "#d4d8dc"] },
  { build: c => buildChiron3D(c), fwd: "+x", len: 4.5, colors: ["#102a43", "#7e1724", "#d2b15c"] },
  { build: c => buildCybertruck3D(c), fwd: "+z", len: 5.3, colors: ["#bfc5cc", "#30363d", "#777f88"] }
];
const ROT = { "+x": -Math.PI / 2, "+z": 0, "-z": Math.PI, "-x": Math.PI / 2 };


/* ---- carve a REAL hinged driver's door out of the car's own mesh ----
   Triangles of the driver-side door area (paint, window glass, mirror, handle...) are cut out of the model,
   large triangles are bisected first so the cut line follows the door region, and the pieces become a door
   that swings on a hinge at its front edge. A dark panel fills the opening so you never see through the car. */
const _v = new THREE.Vector3(), _n = new THREE.Vector3();
function carveDoor(group, color) {
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  const L = box.max.z - box.min.z, H = box.max.y - box.min.y;
  const zFront = box.min.z + L * 0.62, zBack = box.min.z + L * 0.28;
  const yBot = box.min.y + H * 0.24, yTop = box.min.y + H * 0.86;
  const ray = new THREE.Raycaster(); let surf = -Infinity;
  for (let z = zBack; z <= zFront + 1e-6; z += (zFront - zBack) / 4) for (const y of [yBot + 0.1, (yBot + yTop) / 2]) {
    ray.set(new THREE.Vector3(box.max.x + 1, y, z), new THREE.Vector3(-1, 0, 0)); ray.far = 8;
    const hit = ray.intersectObject(group, true).find(h => h.object.isMesh);
    if (hit) surf = Math.max(surf, hit.point.x);
  }
  if (!Number.isFinite(surf)) return null;
  const R = { x0: surf - 0.22, z0: zBack, z1: zFront, y0: yBot, y1: yTop };
  const pivot = new THREE.Group(); pivot.position.set(surf, 0, zFront);
  let doorTris = 0;
  const meshes = []; group.traverse(o => { if (o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh && o.geometry && o.geometry.attributes.position) meshes.push(o); });
  for (const mesh of meshes) {
    const geo0 = mesh.geometry; geo0.computeBoundingBox();
    const bb = geo0.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
    if (bb.max.x < R.x0 || bb.max.z < R.z0 || bb.min.z > R.z1 || bb.max.y < R.y0 || bb.min.y > R.y1) continue;
    const geo = geo0.index ? geo0.toNonIndexed() : geo0;
    const names = Object.keys(geo.attributes).filter(k => !geo.attributes[k].isInterleavedBufferAttribute);
    const m = mesh.matrixWorld;
    const toG = (p) => _v.set(p[0], p[1], p[2]).applyMatrix4(m);
    const vert = (i) => { const o = {}; for (const k of names) { const a = geo.attributes[k], arr = []; for (let c = 0; c < a.itemSize; c++) arr.push(a.array[i * a.itemSize + c]); o[k] = arr; } return o; };
    const mid = (a, b) => { const o = {}; for (const k of names) o[k] = a[k].map((v, c) => (v + b[k][c]) / 2); return o; };
    const gp = (v) => { toG(v.position); return [_v.x, _v.y, _v.z]; };
    const rest = [], door = [];
    const stack = [];
    for (let t = 0; t < geo.attributes.position.count; t += 3) stack.push([vert(t), vert(t + 1), vert(t + 2)]);
    let guard = 0;
    while (stack.length && guard++ < 60000) {
      const tri = stack.pop();
      const P = tri.map(gp);
      const mnx = Math.min(P[0][0], P[1][0], P[2][0]), mxx = Math.max(P[0][0], P[1][0], P[2][0]);
      const mnz = Math.min(P[0][2], P[1][2], P[2][2]), mxz = Math.max(P[0][2], P[1][2], P[2][2]);
      const mny = Math.min(P[0][1], P[1][1], P[2][1]), mxy = Math.max(P[0][1], P[1][1], P[2][1]);
      if (mxx < R.x0 || mxz < R.z0 || mnz > R.z1 || mxy < R.y0 || mny > R.y1) { rest.push(tri); continue; }
      let li = 0, ll = -1;
      for (let e = 0; e < 3; e++) { const a = P[e], b = P[(e + 1) % 3], l = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); if (l > ll) { ll = l; li = e; } }
      if (ll > 0.14 && stack.length < 40000) {
        const a = tri[li], b = tri[(li + 1) % 3], c = tri[(li + 2) % 3], mm = mid(a, b);
        stack.push([a, mm, c], [mm, b, c]); continue;
      }
      const cx = (P[0][0] + P[1][0] + P[2][0]) / 3, cy = (P[0][1] + P[1][1] + P[2][1]) / 3, cz = (P[0][2] + P[1][2] + P[2][2]) / 3;
      if (cx >= R.x0 && cz >= R.z0 && cz <= R.z1 && cy >= R.y0 && cy <= R.y1) door.push(tri); else rest.push(tri);
    }
    for (const t of stack) rest.push(t);
    if (!door.length) continue;
    const build = (tris, toGroup) => {
      const g = new THREE.BufferGeometry();
      for (const k of names) {
        const a = geo.attributes[k], arr = new Float32Array(tris.length * 3 * a.itemSize); let o = 0;
        for (const tri of tris) for (const v of tri) {
          if (toGroup && k === "position") { toG(v[k]); arr[o++] = _v.x - pivot.position.x; arr[o++] = _v.y - pivot.position.y; arr[o++] = _v.z - pivot.position.z; }
          else if (toGroup && k === "normal") { _n.set(v[k][0], v[k][1], v[k][2]).transformDirection(m); arr[o++] = _n.x; arr[o++] = _n.y; arr[o++] = _n.z; }
          else for (let c = 0; c < a.itemSize; c++) arr[o++] = v[k][c];
        }
        g.setAttribute(k, new THREE.BufferAttribute(arr, a.itemSize, a.normalized));
      }
      return g;
    };
    mesh.geometry = build(rest, false);
    const dm = new THREE.Mesh(build(door, true), mesh.material);
    pivot.add(dm); doorTris += door.length;
  }
  if (doorTris < 20) return null;
  /* dark door-jamb panel so the opening is never see-through */
  const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.03, R.y1 - R.y0, R.z1 - R.z0), new THREE.MeshStandardMaterial({ color: 0x15181c, roughness: 0.9 }));
  jamb.position.set(R.x0 + 0.02, (R.y0 + R.y1) / 2, (R.z0 + R.z1) / 2);
  group.add(jamb); group.add(pivot);
  pivot.userData.isFront = true; pivot.userData.sign = 1; pivot.userData.tris = doorTris;
  return pivot;
}

/* A hinged driver's-door panel fitted to a car that has none. The outermost body surface is found
   by ray-casting from the side, so the panel sits on the bodywork instead of floating or sinking. */
function fitDriverDoor(group, color) {
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  const L = box.max.z - box.min.z, H = box.max.y - box.min.y;
  const zFront = box.min.z + L * 0.60, zBack = box.min.z + L * 0.30;       // door spans 30% of the length, just ahead of centre
  const yBot = box.min.y + H * 0.26, yTop = box.min.y + H * 0.80, ray = new THREE.Raycaster();
  let surf = -Infinity;
  for (let z = zBack; z <= zFront + 1e-6; z += (zFront - zBack) / 4) {
    for (const y of [yBot + 0.05, (yBot + yTop) / 2, yTop - 0.05]) {
      ray.set(new THREE.Vector3(box.max.x + 1, y, z), new THREE.Vector3(-1, 0, 0)); ray.far = 8;
      const hit = ray.intersectObject(group, true).find(h => h.object.isMesh);
      if (hit) surf = Math.max(surf, hit.point.x);
    }
  }
  if (!Number.isFinite(surf)) surf = (box.max.x + box.min.x) / 2 + (box.max.x - box.min.x) * 0.4;
  const len = zFront - zBack, bodyH = (yTop - yBot) * 0.55;
  const pivot = new THREE.Group(); pivot.position.set(surf + 0.015, yBot, zFront);
  const paint = new THREE.Mesh(new THREE.BoxGeometry(0.05, bodyH, len), new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.3 }));
  paint.position.set(0, bodyH / 2, -len / 2);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.035, (yTop - yBot) - bodyH, len * 0.92),
    new THREE.MeshStandardMaterial({ color: 0x23343f, metalness: 0.4, roughness: 0.12, transparent: true, opacity: 0.78 }));
  glass.position.set(-0.005, bodyH + ((yTop - yBot) - bodyH) / 2, -len / 2);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.22), new THREE.MeshStandardMaterial({ color: 0xcfd6dc, metalness: 0.9, roughness: 0.2 }));
  handle.position.set(0.04, bodyH * 0.8, -len * 0.7);
  pivot.add(paint, glass, handle);
  pivot.userData.isFront = true; pivot.userData.sign = 1;
  group.add(pivot);
  return pivot;
}

export function makeCar(modelIndex, colorIndex, withDoor = true) {
  const def = MODELS[modelIndex % MODELS.length];
  const model = def.build(def.colors[colorIndex % def.colors.length]);
  const rot = new THREE.Group(); rot.add(model); rot.rotation.y = ROT[def.fwd];
  const scl = new THREE.Group(); scl.add(rot);
  rot.updateMatrixWorld(true);
  const b0 = new THREE.Box3().setFromObject(rot);
  const s = def.len / Math.max(0.01, b0.max.z - b0.min.z);
  scl.scale.setScalar(s); scl.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(scl);
  scl.position.set(-(b.min.x + b.max.x) / 2, -b.min.y + 0.02, -(b.min.z + b.max.z) / 2);   // centred, wheels on the ground
  const group = new THREE.Group(); group.add(scl);
  group.userData.size = { w: b.max.x - b.min.x, l: b.max.z - b.min.z };
  if (model.userData && model.userData.doors) group.userData.doors = model.userData.doors;        // the Range Rover ships real hinged doors
  else if (withDoor) {
    const col = def.colors[colorIndex % def.colors.length];
    group.userData.doors = [carveDoor(group, col) || fitDriverDoor(group, col)];   // real cut-out door, fitted panel only as a fallback
  }
  return group;
}

export function createParkingTraffic({ scene, colliders, bays, lot, arrivals, onArrive, onCollidersChanged }) {
  const cars = [];
  const taken = new Set();
  const parkStatic = (bay, mi, ci) => {
    const g = makeCar(mi, ci, false);
    g.position.set(bay.x, 0.06, bay.z); g.rotation.y = bay.yaw; scene.add(g);
    addCollider(g, bay); taken.add(bay.id); cars.push({ group: g, state: "parked" });
  };
  function addCollider(g, bay) {
    const sz = g.userData.size;
    colliders.push({ minX: bay.x - sz.w / 2, maxX: bay.x + sz.w / 2, minZ: bay.z - sz.l / 2, maxZ: bay.z + sz.l / 2, y0: 0, y1: 1.6, level: 0 });
  }

  /* pre-parked cars: a lived-in lot, never in the first bays (those are for arrivals) */
  const order = bays.filter(b => b.x > lot.x0 + 12).sort(() => Math.random() - 0.5);
  const nStatic = Math.min(order.length, 10);
  for (let i = 0; i < nStatic; i++) parkStatic(order[i], i + Math.floor(Math.random() * 3), i);

  /* arriving cars */
  const free = bays.filter(b => !taken.has(b.id)).sort((p, q) => p.x - q.x);
  const aisleZ = lot.aisle + 1.7;
  for (let i = 0; i < arrivals && i < free.length; i++) {
    const bay = free[i * 2 % free.length] && !taken.has(free[i * 2 % free.length].id) ? free[i * 2 % free.length] : free[i];
    taken.add(bay.id);
    const mi = (i + 2) % MODELS.length;
    const g = makeCar(mi, i);
    const bx = bay.x;
    const pts = [[3.2, 270], [3.2, 236], [3.2, 208], [3.4, 196], [5.6, 191.3], [10.5, aisleZ], [bx - 6.5, aisleZ]];
    if (bay.row === "n") pts.push([bx - 3.4, aisleZ - 0.5], [bx - 1.2, 186.4], [bx - 0.1, 184.6], [bx, 183.0], [bx, bay.z]);
    else pts.push([bx - 3.0, aisleZ + 0.3], [bx - 1.0, 191.6], [bx, 192.7], [bx, bay.z]);
    const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], 0.06, p[1])), false, "centripetal");
    g.visible = false; scene.add(g);
    cars.push({ group: g, state: "wait", delay: 2.5 + i * 15, dist: 0, curve, len: curve.getLength(), bay, spawned: false, hold: 0, doorV: 0, doorTarget: 0, closeIn: 0 });
  }

  const _t = new THREE.Vector3();
  function update(dt) {
    animateDoors(dt);
    for (const c of cars) {
      if (c.state === "wait") {
        c.delay -= dt;
        if (c.delay <= 0) { c.state = "drive"; c.group.visible = true; }
      } else if (c.state === "drive") {
        const remaining = c.len - c.dist;
        const v = Math.max(1.2, Math.min(7.2, 1.0 + remaining * 0.9));      // slows into the bay
        c.dist = Math.min(c.len, c.dist + v * dt);
        const u = c.dist / c.len;
        c.curve.getPointAt(u, c.group.position);
        c.curve.getTangentAt(Math.min(0.999, u), _t);
        c.group.position.y = 0.06;
        c.group.rotation.y = c.dist >= c.len - 0.01 ? c.bay.yaw : Math.atan2(_t.x, _t.z);
        if (c.dist >= c.len - 0.01) {
          c.group.position.set(c.bay.x, 0.06, c.bay.z); c.group.rotation.y = c.bay.yaw;
          c.state = "stopping"; c.hold = 1.6;
          addCollider(c.group, c.bay); onCollidersChanged?.();
        }
      } else if (c.state === "stopping") {
        c.hold -= dt;
        if (c.hold < 1.2) c.doorTarget = 1;                                   // driver's door swings open
        if (c.hold <= 0) {
          c.state = "parked"; c.closeIn = 2.2;
          const side = c.bay.row === "n" ? -1 : 1;                           // driver's side, between the cars
          onArrive?.(c, { x: c.bay.x + side * (lot.bayW / 2), z: c.bay.z + 0.4 });
        }
      }
    }
  }
  function animateDoors(dt) {
    for (const c of cars) {
      const doors = c.group.userData.doors;
      if (!doors) continue;
      if (c.closeIn > 0) { c.closeIn -= dt; if (c.closeIn <= 0) c.doorTarget = 0; }
      const d = c.doorTarget - c.doorV;
      if (Math.abs(d) < 0.001) continue;
      c.doorV += Math.sign(d) * Math.min(Math.abs(d), dt * 1.8);
      for (const door of doors) {
        if (door.userData.isFront && door.userData.sign === 1) door.rotation.y = -0.65 * c.doorV;   // hinge is the door's front edge
      }
    }
  }
  function dispose() { for (const c of cars) { scene.remove(c.group); } cars.length = 0; }
  return { update, dispose, cars };
}
