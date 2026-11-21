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

export function makeCar(modelIndex, colorIndex) {
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
  else group.userData.doors = [fitDriverDoor(group, def.colors[colorIndex % def.colors.length])];   // everyone else gets a fitted one
  return group;
}

export function createParkingTraffic({ scene, colliders, bays, lot, arrivals, onArrive, onCollidersChanged }) {
  const cars = [];
  const taken = new Set();
  const parkStatic = (bay, mi, ci) => {
    const g = makeCar(mi, ci);
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
