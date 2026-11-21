/* university/interior.js -- GHEGEH UNIVERSITY campus as ONE walkable interior.
   World code is the standalone campus prototype; its controls, HUD, start
   screen and loop were removed and replaced by the game's ThirdPersonControls. */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ThirdPersonControls } from "../../core/thirdperson.js";
import { ZoneDrive } from "../../core/drive-zones.js";
import { addStreetLamp } from "../../core/scene-lamps.js";
import { addPoleLine } from "../../core/power-lines.js";
import { NPCs } from "../../core/npcs.js";
import { Quality } from "../../core/quality.js";
import { openWardrobeFor } from "../../core/thirdperson.js";
import { Wardrobe } from "../../core/wardrobe.js";
import { createDoorSystem } from "./campus-doors.js";
import { createSchoolSim } from "./school-sim.js";
import { createParkingTraffic } from "./campus-cars.js";

export async function buildInterior(router) {
  const scene = new THREE.Scene();
  const FOG_COLOR = 0xa8c6dd;
  scene.fog = new THREE.Fog(FOG_COLOR, Quality.current.tier === "low" ? 150 : 240, Quality.current.tier === "low" ? 470 : 720);
  scene.background = new THREE.Color(FOG_COLOR);

  const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.08, 3000);
  camera.rotation.order = "YXZ";

  /* ---------- SKY ---------- */
  {
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x2d6fa8) },
        bottomColor: { value: new THREE.Color(0xd6e6f2) },
        offset: { value: 150.0 }, exponent: { value: 0.65 }
      },
      vertexShader: `varying vec3 vWorld;
        void main(){ vWorld=(modelMatrix*vec4(position,1.0)).xyz;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `uniform vec3 topColor; uniform vec3 bottomColor;
        uniform float offset; uniform float exponent; varying vec3 vWorld;
        void main(){ float h=normalize(vWorld+vec3(0.0,offset,0.0)).y;
        float t=pow(max(h,0.0),exponent);
        gl_FragColor=vec4(mix(bottomColor,topColor,t),1.0);}`
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 32, 20), skyMat);
    sky.frustumCulled = false;
    scene.add(sky);
  }

  /* ---------- LIGHTS ---------- */
  scene.add(new THREE.HemisphereLight(0xbfe0ff, 0x3d5230, 1.25));
  const sun = new THREE.DirectionalLight(0xfff1d4, 2.2);
  sun.position.set(95, 165, 60);
  scene.add(sun);

  /* ---------- TEXTURES ---------- */
  function canvasTexture(w, h, draw, repX = 1, repY = 1) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repX, repY);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }
  const TEX = {};
  TEX.grass = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#4a7238"; ctx.fillRect(0, 0, w, h);
    for (let i = 0, n = Quality.current.tier === "low" ? 1800 : 4800; i < n; i++) {
      const g = 90 + Math.random() * 70;
      ctx.fillStyle = `rgba(${25 + Math.random() * 45},${g},${20 + Math.random() * 35},${0.25 + Math.random() * 0.5})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 2, 2 + Math.random() * 2);
    }
  }, 160, 160);
  TEX.asphalt = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#3a3d42"; ctx.fillRect(0, 0, w, h);
    for (let i = 0, n = Quality.current.tier === "low" ? 1500 : 4000; i < n; i++) {
      const v = 40 + Math.random() * 55;
      ctx.fillStyle = `rgba(${v},${v},${v + 4},${0.25 + Math.random() * 0.45})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
  TEX.tile = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#d9d4c8"; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#b7b1a3"; ctx.lineWidth = 3;
    for (let i = 0; i <= 4; i++) {
      const p = (i / 4) * w;
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(w, p); ctx.stroke();
    }
  });
  TEX.concrete = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = "#c9c4ba"; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) {
      const v = 170 + Math.random() * 50;
      ctx.fillStyle = `rgba(${v},${v - 4},${v - 10},${Math.random() * 0.35})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });

  function makeLabelTexture(title, subtitle) {
    const c = document.createElement("canvas");
    c.width = 1024; c.height = 256;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#14232f"; ctx.fillRect(0, 0, 1024, 256);
    ctx.strokeStyle = "#c9a227"; ctx.lineWidth = 9; ctx.strokeRect(16, 16, 992, 224);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.font = 'bold 62px Georgia, "Times New Roman", serif';
    ctx.fillText(title, 512, subtitle ? 104 : 128);
    if (subtitle) {
      ctx.fillStyle = "#d9b74a";
      ctx.font = "italic 32px Georgia, serif";
      ctx.fillText(subtitle, 512, 178);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }

  await new Promise(resolve => requestAnimationFrame(resolve));

  /* ---------- MATERIALS ---------- */
  const S = (o) => new THREE.MeshStandardMaterial(o);
  const MAT = {
    grass: S({ map: TEX.grass, roughness: 1 }),
    asphalt: S({ map: TEX.asphalt, roughness: 0.95 }),
    tile: S({ map: TEX.tile, roughness: 0.55 }),
    concrete: S({ map: TEX.concrete, color: 0xd8d3c8, roughness: 0.92 }),
    slab: S({ color: 0xbfb9ad, roughness: 0.95 }),
    trim: S({ color: 0xe4dfd2, roughness: 0.85 }),
    white: S({ color: 0xf2f2f0, roughness: 0.7 }),
    lineWhite: S({ color: 0xf0f0ea, roughness: 0.8 }),
    lineYellow: S({ color: 0xe0b93a, roughness: 0.8 }),
    glass: S({ color: 0x9cc9e8, roughness: 0.06, metalness: 0.4, transparent: true, opacity: 0.34, side: THREE.DoubleSide }),
    wood: S({ color: 0x8a6242, roughness: 0.82 }),
    woodDark: S({ color: 0x53402e, roughness: 0.85 }),
    metal: S({ color: 0x8b9099, roughness: 0.42, metalness: 0.75 }),
    darkMetal: S({ color: 0x3b4048, roughness: 0.55, metalness: 0.6 }),
    fabric: S({ color: 0x2e4d6d, roughness: 1 }),
    fabricRed: S({ color: 0x7a3038, roughness: 1 }),
    board: S({ color: 0xf4f6f4, roughness: 0.45 }),
    trunk: S({ color: 0x5b4530, roughness: 1 }),
    leafA: S({ color: 0x3f7a35, roughness: 1 }),
    leafB: S({ color: 0x4f8f3c, roughness: 1 }),
    leafC: S({ color: 0x2f6428, roughness: 1 }),
    gold: S({ color: 0xc9a227, roughness: 0.35, metalness: 0.9 })
  };

  /* ---------- BATCHING ---------- */
  class Batch {
    constructor() { this.groups = new Map(); }
    add(geometry, material, matrix) {
      const g = geometry.clone();
      if (matrix) g.applyMatrix4(matrix);
      if (!this.groups.has(material)) this.groups.set(material, []);
      this.groups.get(material).push(g);
    }
    flush(maxVerts = 40000) {
      for (const [mat, geos] of this.groups) {
        let chunk = [], verts = 0;
        const push = () => {
          if (!chunk.length) return;
          const merged = mergeGeometries(chunk, false);
          if (merged) {
            const mesh = new THREE.Mesh(merged, mat);
            mesh.matrixAutoUpdate = false;
            scene.add(mesh);
          }
          chunk.forEach(g => g.dispose());
          chunk = []; verts = 0;
        };
        for (const g of geos) {
          chunk.push(g);
          verts += g.attributes.position.count;
          if (verts > maxVerts) push();
        }
        push();
      }
      this.groups.clear();
    }
  }
  const B = { solid: new Batch(), detail: new Batch(), flat: new Batch() };

  const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
  const UNIT_CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
  const UNIT_CYL6 = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
  const UNIT_SPH = new THREE.SphereGeometry(0.5, 10, 7);
  const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(),
        _v = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler();

  function box(batch, mat, x, y, z, w, h, d, ry = 0) {
    _e.set(0, ry, 0); _q.setFromEuler(_e); _v.set(x, y, z); _s.set(w, h, d);
    _m4.compose(_v, _q, _s); batch.add(UNIT_BOX, mat, _m4);
  }
  function cyl(batch, mat, x, y, z, radius, height, ry = 0, geo = UNIT_CYL) {
    _e.set(0, ry, 0); _q.setFromEuler(_e); _v.set(x, y, z); _s.set(radius * 2, height, radius * 2);
    _m4.compose(_v, _q, _s); batch.add(geo, mat, _m4);
  }
  function sphere(batch, mat, x, y, z, rx, ry2, rz) {
    _e.set(0, 0, 0); _q.setFromEuler(_e); _v.set(x, y, z); _s.set(rx * 2, ry2 * 2, rz * 2);
    _m4.compose(_v, _q, _s); batch.add(UNIT_SPH, mat, _m4);
  }

  /* ---------- COLLISION WORLD (game format) ---------- */
  const LEVEL_H = 4.6;
  const colliders = [];
  const seats = [];
  const stairs = [];
  function addCollider(minX, maxX, minZ, maxZ, minY, maxY) {
    colliders.push({ minX, maxX, minZ, maxZ, y0: minY, y1: maxY, level: minY >= 4 ? 1 : 0 });
  }
  function addCollider2(minX, maxX, minZ, maxZ, minY, maxY, level) {
    colliders.push({ minX, maxX, minZ, maxZ, y0: minY, y1: maxY, level });
  }

  /* ---------- GROUND ---------- */
  {
    const g = new THREE.PlaneGeometry(1400, 1400, 1, 1);
    g.rotateX(-Math.PI / 2);
    B.detail.add(g, MAT.grass, new THREE.Matrix4());
  }

  /* ---------- CAMPUS GRID ----------
     Orthogonal layout: one grand boulevard (x=0) from the main gate to the northern avenue,
     five east-west avenues, two side streets and a roundabout with the campus monument.
     Every faculty is aligned to a row, FACES SOUTH onto the avenue in front of it, and has
     open lawn (and its back staircase) behind it. */
  const ROAD_W = 10, BLVD_W = 12;
  const AVENUES = [-190, -105, -20, 65, 150];
  const SIDE_X = [-93, 93];
  const COLS = [-138, -48, 48, 138];
  const EDGE_X = 238, EDGE_N = -282, EDGE_S = 252;
  const ROUND = { x: 0, z: AVENUES[2], r0: 9, r1: 18 };
  const rowZ1 = (row) => AVENUES[row] - 24;          // front wall of every building on that row
  const GATE_Z = 246;

  const subtract = (a, b, skips) => {                // [a,b] minus skip ranges -> list of [lo,hi]
    let segs = [[a, b]];
    for (const [s0, s1] of skips) {
      const out = [];
      for (const [lo, hi] of segs) {
        if (s1 <= lo || s0 >= hi) { out.push([lo, hi]); continue; }
        if (s0 > lo) out.push([lo, s0]);
        if (s1 < hi) out.push([s1, hi]);
      }
      segs = out;
    }
    return segs.filter(([lo, hi]) => hi - lo > 1.2);
  };
  /* axis "x": runs along x at z=fixed.  axis "z": runs along z at x=fixed. */
  function roadStrip(axis, fixed, a, b, w, y, skips = [], opts = {}) {
    const len = b - a, mid = (a + b) / 2;
    if (axis === "x") box(B.detail, MAT.asphalt, mid, y, fixed, len, 0.04, w);
    else box(B.detail, MAT.asphalt, fixed, y, mid, w, 0.04, len);
    for (const [lo, hi] of subtract(a, b, skips)) {
      const l = hi - lo, m = (lo + hi) / 2;
      for (const sg of [-1, 1]) {                    // white edge lines
        const o = sg * (w / 2 - 0.5);
        if (axis === "x") box(B.flat, MAT.lineWhite, m, y + 0.025, fixed + o, l, 0.02, 0.15);
        else box(B.flat, MAT.lineWhite, fixed + o, y + 0.025, m, 0.15, 0.02, l);
      }
      if (opts.dashed === false) continue;
      for (let t = lo + 2; t < hi - 2; t += 8) {      // yellow centre dashes
        if (axis === "x") box(B.flat, MAT.lineYellow, t + 1.5, y + 0.025, fixed, 3, 0.02, 0.2);
        else box(B.flat, MAT.lineYellow, fixed, y + 0.025, t + 1.5, 0.2, 0.02, 3);
      }
      if (opts.walk !== false) {                      // pavements either side
        for (const sg of [-1, 1]) {
          const o = sg * (w / 2 + 1.25);
          const parts = (opts.walkGap && opts.walkGap.side === sg) ? subtract(lo, hi, [opts.walkGap.range]) : [[lo, hi]];
          for (const [p0, p1] of parts) {
            const pl = p1 - p0, pm = (p0 + p1) / 2;
            if (axis === "x") box(B.detail, MAT.concrete, pm, 0.07, fixed + o, pl, 0.14, 2.5);
            else box(B.detail, MAT.concrete, fixed + o, 0.07, pm, 2.5, 0.14, pl);
          }
        }
      }
    }
  }
  const crossX = [-EDGE_X, ...SIDE_X, 0, EDGE_X].sort((p, q) => p - q);
  for (let i = 0; i < AVENUES.length; i++) {
    const A = AVENUES[i];
    const skips = [...SIDE_X.map(x => [x - 7, x + 7]), [-7.5, 7.5]];
    if (i === 2) skips.push([-ROUND.r1 - 1, ROUND.r1 + 1]);
    roadStrip("x", A, -EDGE_X, EDGE_X, ROAD_W, 0.02, skips);
  }
  for (const x of SIDE_X) {
    const skips = AVENUES.map(a => [a - 7, a + 7]);
    roadStrip("z", x, AVENUES[0] - 15, AVENUES[4], ROAD_W - 2, 0.024, skips);
  }
  {
    const skips = AVENUES.map(a => [a - 7.5, a + 7.5]);
    skips[2] = [AVENUES[2] - ROUND.r1 - 1, AVENUES[2] + ROUND.r1 + 1];
    roadStrip("z", 0, AVENUES[0] - 15, GATE_Z + 14, BLVD_W, 0.03, skips, { walkGap: { side: 1, range: [183, 193] } });
  }
  /* zebra crossings on the boulevard beside each avenue and at the gate */
  for (const zc of [AVENUES[0] + 9, AVENUES[1] + 9, AVENUES[3] + 9, AVENUES[4] + 9, GATE_Z - 14]) {
    for (let i = -4; i <= 4; i++) box(B.flat, MAT.lineWhite, i * 1.25, 0.06, zc, 0.65, 0.02, 3.2);
  }
  /* roundabout + monument island */
  {
    const ring = new THREE.RingGeometry(ROUND.r0, ROUND.r1, 72, 1);
    ring.rotateX(-Math.PI / 2);
    B.detail.add(ring, MAT.asphalt, new THREE.Matrix4().makeTranslation(ROUND.x, 0.045, ROUND.z));
    for (const r of [ROUND.r0 + 0.6, ROUND.r1 - 0.6]) {
      const eg = new THREE.RingGeometry(r - 0.08, r + 0.08, 72, 1);
      eg.rotateX(-Math.PI / 2);
      B.flat.add(eg, MAT.lineWhite, new THREE.Matrix4().makeTranslation(ROUND.x, 0.07, ROUND.z));
    }
    const isl = new THREE.CircleGeometry(ROUND.r0, 48);
    isl.rotateX(-Math.PI / 2);
    B.detail.add(isl, MAT.grass, new THREE.Matrix4().makeTranslation(ROUND.x, 0.14, ROUND.z));
    const kerb = new THREE.RingGeometry(ROUND.r0 - 0.5, ROUND.r0, 48, 1);
    kerb.rotateX(-Math.PI / 2);
    B.detail.add(kerb, MAT.slab, new THREE.Matrix4().makeTranslation(ROUND.x, 0.26, ROUND.z));
    const mx = ROUND.x, mz = ROUND.z;
    cyl(B.solid, MAT.concrete, mx, 0.6, mz, 3.4, 1.2, 0, UNIT_CYL);
    cyl(B.solid, MAT.trim, mx, 1.3, mz, 2.6, 0.3, 0, UNIT_CYL);
    box(B.solid, MAT.trim, mx, 6.0, mz, 1.6, 9.0, 1.6);
    box(B.solid, MAT.gold, mx, 10.6, mz, 1.9, 0.5, 1.9);
    cyl(B.solid, MAT.gold, mx, 11.9, mz, 0.5, 2.2, 0, new THREE.ConeGeometry(0.5, 1, 4));
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; box(B.solid, MAT.gold, mx + Math.cos(a) * 0.82, 5.2, mz + Math.sin(a) * 0.82, 0.9, 1.6, 0.06, -a); }
    addCollider2(mx - 3.5, mx + 3.5, mz - 3.5, mz + 3.5, 0, 11, 0);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.2, r = 6.6;
      sphere(B.detail, MAT.leafB, mx + Math.cos(a) * r, 0.6, mz + Math.sin(a) * r, 1.0, 0.55, 1.0);
    }
  }

  /* ---------- STUDENT PARKING (accurate bays, aisle and lane) ----------
     Cars arrive through the main gate, keep to the right-hand lane of the boulevard, turn
     into the lot aisle and reverse-free nose-in to a marked bay. North bays face north, south
     bays face south, exactly like a real lot. */
  const LOT = { x0: 14, x1: 82, z0: 177.5, z1: 198.5, aisle: 188, bayW: 3.3, bayX0: 17, bays: 19 };
  const parkingBays = [];
  {
    const w = LOT.x1 - LOT.x0, d = LOT.z1 - LOT.z0;
    box(B.detail, MAT.concrete, LOT.x0 + w / 2, 0.05, LOT.z0 + d / 2, w, 0.1, d);
    box(B.detail, MAT.asphalt, LOT.x0 - 4 + 2, 0.058, LOT.aisle, 8 + 4, 0.02, 7.2);        // apron from the boulevard
    box(B.detail, MAT.asphalt, (LOT.x0 + LOT.x1) / 2, 0.058, LOT.aisle, w, 0.02, 7.0);      // central aisle
    for (const zz of [LOT.z0 - 0.15, LOT.z1 + 0.15]) box(B.detail, MAT.slab, LOT.x0 + w / 2, 0.12, zz, w + 0.6, 0.2, 0.3);
    box(B.detail, MAT.slab, LOT.x1 + 0.15, 0.12, LOT.z0 + d / 2, 0.3, 0.2, d);
    for (let i = 0; i < 12; i++) box(B.flat, MAT.lineWhite, LOT.x0 + 2 + i * 5.2, 0.075, LOT.aisle, 2.2, 0.02, 0.14);   // aisle arrows
    for (let i = 0; i <= LOT.bays; i++) {
      const x = LOT.bayX0 + i * LOT.bayW;
      box(B.flat, MAT.lineWhite, x, 0.075, 181.75, 0.12, 0.02, 5.5);
      box(B.flat, MAT.lineWhite, x, 0.075, 194.25, 0.12, 0.02, 5.5);
    }
    for (let i = 0; i < LOT.bays; i++) {
      const bx = LOT.bayX0 + i * LOT.bayW + LOT.bayW / 2;
      box(B.detail, MAT.slab, bx, 0.15, 179.4, 1.5, 0.12, 0.2);                           // wheel stops
      box(B.detail, MAT.slab, bx, 0.15, 196.6, 1.5, 0.12, 0.2);
      parkingBays.push({ id: parkingBays.length, x: bx, z: 181.75, yaw: Math.PI, row: "n", taken: false });
      parkingBays.push({ id: parkingBays.length, x: bx, z: 194.25, yaw: 0, row: "s", taken: false });
    }
    for (const lx of [LOT.x0 + 8, LOT.x0 + 30, LOT.x0 + 52]) addStreetLamp(scene, lx, 0, LOT.aisle, 0);
    // entrance sign
    box(B.solid, MAT.darkMetal, 11.2, 1.3, 175.2, 0.2, 2.6, 0.2);
    const ptex = makeLabelTexture("STUDENT PARKING", "OPEN TO ALL STUDENTS");
    const face = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.1), new THREE.MeshBasicMaterial({ map: ptex }));
    face.position.set(11.2, 2.9, 175.2); scene.add(face);
    const back = face.clone(); back.rotation.y = Math.PI; back.position.z = 175.1; scene.add(back);
  }

  /* ---------- PERIMETER WALL ---------- */
  {
    const T = 1.2, H = 2.4;
    const wall = (cx, cz, w, d) => {
      box(B.solid, MAT.concrete, cx, H / 2, cz, w, H, d);
      box(B.solid, MAT.trim, cx, H + 0.1, cz, w + 0.2, 0.22, d + 0.2);
      addCollider2(cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2, 0, H + 0.3, 0);
    };
    const gap = 11;
    wall(0, EDGE_N, EDGE_X * 2, T);
    wall(-EDGE_X, (EDGE_N + GATE_Z) / 2, T, GATE_Z - EDGE_N);
    wall(EDGE_X, (EDGE_N + GATE_Z) / 2, T, GATE_Z - EDGE_N);
    wall(-(EDGE_X + gap) / 2, GATE_Z, EDGE_X - gap, T);
    wall((EDGE_X + gap) / 2, GATE_Z, EDGE_X - gap, T);
  }
  await new Promise(resolve => requestAnimationFrame(resolve));

  /* ---------- MAIN GATE ---------- */
  function buildMainGate(gx, gz) {
    for (const sx of [-9, 9]) {
      box(B.solid, MAT.concrete, gx + sx, 4.0, gz, 2.4, 8.0, 2.4);
      box(B.solid, MAT.trim, gx + sx, 8.2, gz, 3.1, 0.5, 3.1);
      box(B.solid, MAT.gold, gx + sx, 8.7, gz, 1.4, 0.6, 1.4);
      addCollider2(gx + sx - 1.2, gx + sx + 1.2, gz - 1.2, gz + 1.2, 0, 8.5, 0);
    }
    box(B.solid, MAT.trim, gx, 8.8, gz, 21.0, 1.4, 2.0);
    box(B.solid, MAT.concrete, gx, 9.7, gz, 18.0, 0.5, 1.6);
    const mat = S({ map: makeLabelTexture("UNIVERSITY OF PORT HARCOURT", "KNOWLEDGE · UNITY · SERVICE"), roughness: 0.6, emissive: 0x0a1218, emissiveIntensity: 0.5 });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(15.5, 3.9), mat);
    sign.position.set(gx, 8.8, gz + 1.05); scene.add(sign);
    const signBack = new THREE.Mesh(new THREE.PlaneGeometry(15.5, 3.9), mat);
    signBack.position.set(gx, 8.8, gz - 1.05); signBack.rotation.y = Math.PI; scene.add(signBack);
    // boom barrier + guard booths either side of the gate
    for (const sx of [-14.5, 14.5]) {
      box(B.solid, MAT.concrete, gx + sx, 1.6, gz - 2, 4.2, 3.2, 3.6);
      box(B.solid, MAT.darkMetal, gx + sx, 3.4, gz - 2, 4.8, 0.4, 4.2);
      box(B.detail, MAT.glass, gx + sx, 1.9, gz - 3.85, 3.0, 1.2, 0.08);
      addCollider2(gx + sx - 2.1, gx + sx + 2.1, gz - 3.8, gz - 0.2, 0, 3.4, 0);
    }
  }
  buildMainGate(0, GATE_Z);

  /* ---------- FURNITURE (every solid piece has a collider; chairs face their desk/table) ---------- */
  const levelOf = (fy) => Math.max(0, Math.round(fy / LEVEL_H));
  const solidBox = (cx, cz, hx, hz, fy, h) => addCollider2(cx - hx, cx + hx, cz - hz, cz + hz, fy, fy + h, levelOf(fy));
  const CLASS_DEFS = [];
  const ACC = {
    science: S({ color: 0x27a6a0, roughness: 0.48, metalness: 0.15 }), engineering: S({ color: 0xe09b32, roughness: 0.65 }),
    law: S({ color: 0x68452f, roughness: 0.8 }), health: S({ color: 0xd9eeee, roughness: 0.55 }),
    ict: S({ color: 0x277bb4, roughness: 0.38, metalness: 0.2 }), library: S({ color: 0x70472c, roughness: 0.85 }),
    hostel: S({ color: 0x6f8cbd, roughness: 0.82 }), agri: S({ color: 0x477d3b, roughness: 0.9 }),
    pharma: S({ color: 0x6ca7a0, roughness: 0.5 }), union: S({ color: 0xd58a35, roughness: 0.7 }),
    senate: S({ color: 0x9b7b3f, roughness: 0.5, metalness: 0.2 }), screen: S({ color: 0x0c1a26, roughness: 0.2, emissive: 0x16486a, emissiveIntensity: 0.6 }),
    red: S({ color: 0xc33f4c, roughness: 0.6 })
  };

  function chairFacing(x, fy, z, tx, tz, out) {
    const yaw = Math.atan2(tx - x, tz - z), s = Math.sin(yaw), c = Math.cos(yaw);
    box(B.detail, MAT.woodDark, x, fy + 0.45, z, 0.46, 0.07, 0.46, yaw);
    box(B.detail, MAT.woodDark, x - s * 0.2, fy + 0.72, z - c * 0.2, 0.46, 0.45, 0.06, yaw);
    for (const [dx, dz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) box(B.detail, MAT.metal, x + dx, fy + 0.22, z + dz, 0.05, 0.45, 0.05);
    const seat = { type: "sit", label: "SIT", x, z, yaw, h: fy + 0.485, level: levelOf(fy), taken: false };
    seats.push(seat); if (out) out.push(seat);
    return seat;
  }
  /* student desk facing NORTH (towards the board); the chair sits south of it */
  function deskN(x, fy, z, out) {
    box(B.detail, MAT.wood, x, fy + 0.75, z, 1.1, 0.05, 0.6);
    for (const [dx, dz] of [[-0.5, -0.24], [0.5, -0.24], [-0.5, 0.24], [0.5, 0.24]]) box(B.detail, MAT.metal, x + dx, fy + 0.37, z + dz, 0.05, 0.74, 0.05);
    box(B.detail, MAT.metal, x, fy + 0.5, z + 0.02, 1.0, 0.03, 0.5);
    solidBox(x, z, 0.55, 0.3, fy, 0.78);
    return chairFacing(x, fy, z + 0.78, x, z, out);
  }
  function table(x, z, w, d, fy, perSide, out, mat = MAT.wood) {
    box(B.detail, mat, x, fy + 0.75, z, w, 0.07, d);
    for (const [dx, dz] of [[-w / 2 + 0.1, -d / 2 + 0.1], [w / 2 - 0.1, -d / 2 + 0.1], [-w / 2 + 0.1, d / 2 - 0.1], [w / 2 - 0.1, d / 2 - 0.1]]) box(B.detail, MAT.metal, x + dx, fy + 0.37, z + dz, 0.07, 0.74, 0.07);
    solidBox(x, z, w / 2, d / 2, fy, 0.8);
    for (let i = 0; i < perSide; i++) {
      const px = x + (i - (perSide - 1) / 2) * (w / perSide);
      chairFacing(px, fy, z + d / 2 + 0.42, px, z, out);
      chairFacing(px, fy, z - d / 2 - 0.42, px, z, out);
    }
  }
  function shelfUnit(x, z, len, fy, alongX = true, h = 2.0) {
    const w = alongX ? len : 0.42, d = alongX ? 0.42 : len;
    box(B.detail, MAT.woodDark, x, fy + h / 2, z, w, h, d);
    for (let i = 0; i < 4; i++) {
      for (let b = 0; b < Math.floor(len / 0.14); b++) {
        const t = -len / 2 + 0.1 + b * 0.14, bh = 0.24 + ((b * 7 + i * 3) % 5) * 0.03;
        const m = (b + i) % 3 === 0 ? MAT.fabricRed : (b + i) % 3 === 1 ? MAT.fabric : MAT.wood;
        if (alongX) box(B.detail, m, x + t, fy + 0.3 + i * 0.46 + bh / 2, z + 0.02, 0.09, bh, 0.34);
        else box(B.detail, m, x + 0.02, fy + 0.3 + i * 0.46 + bh / 2, z + t, 0.34, bh, 0.09);
      }
    }
    solidBox(x, z, w / 2, d / 2, fy, h);
  }
  function cabinet(x, z, fy, alongX = true) {
    const w = alongX ? 1.1 : 0.5, d = alongX ? 0.5 : 1.1;
    box(B.detail, MAT.metal, x, fy + 0.45, z, w, 0.9, d); solidBox(x, z, w / 2, d / 2, fy, 0.9);
  }
  function planter(x, z, fy) {
    box(B.detail, MAT.slab, x, fy + 0.28, z, 0.7, 0.56, 0.7);
    sphere(B.detail, MAT.leafA, x, fy + 0.85, z, 0.4, 0.4, 0.4); sphere(B.detail, MAT.leafB, x + 0.12, fy + 1.0, z - 0.08, 0.26, 0.26, 0.26);
    solidBox(x, z, 0.35, 0.35, fy, 1.2);
  }
  function bed(x, z, fy, bunk = false) {
    box(B.detail, MAT.metal, x, fy + 0.3, z, 0.95, 0.12, 2.0);
    box(B.detail, MAT.fabric, x, fy + 0.42, z, 0.85, 0.14, 1.9);
    box(B.detail, MAT.white, x, fy + 0.54, z - 0.75, 0.5, 0.12, 0.34);
    for (const dx of [-0.46, 0.46]) for (const dz of [-0.98, 0.98]) box(B.detail, MAT.metal, x + dx, bunk ? fy + 1.0 : fy + 0.15, z + dz, 0.06, bunk ? 2.0 : 0.3, 0.06);
    if (bunk) { box(B.detail, MAT.metal, x, fy + 1.55, z, 0.95, 0.12, 2.0); box(B.detail, MAT.fabricRed, x, fy + 1.67, z, 0.85, 0.14, 1.9); }
    solidBox(x, z, 0.52, 1.02, fy, bunk ? 2.0 : 0.6);
  }
  function boardNorth(cx, z0, fy, bw) {
    box(B.detail, MAT.board, cx, fy + 1.65, z0 + 0.1, bw, 1.15, 0.06);
    box(B.detail, MAT.woodDark, cx, fy + 1.04, z0 + 0.13, bw + 0.14, 0.06, 0.12);
    box(B.detail, MAT.woodDark, cx, fy + 2.26, z0 + 0.13, bw + 0.14, 0.06, 0.12);
  }

  function furnishRoom(x0, z0, x1, z1, fy, type, side, title = "", ctx = {}) {
    const w = x1 - x0, d = z1 - z0;
    if (w < 2.4 || d < 2.4) return;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, west = side === "west", T = title.toUpperCase();
    const corrX = west ? x1 : x0;                         // the corridor-side wall of this room
    const gx0 = west ? x0 + 0.9 : x0 + 1.9, gx1 = west ? x1 - 1.9 : x1 - 0.9;   // desk grid (1.9m aisle by the door)

    if (type === "classroom" || type === "lecture") {
      boardNorth(cx, z0, fy, Math.min(5.2, w - 3));
      box(B.detail, MAT.wood, cx, fy + 0.78, z0 + 1.95, 1.8, 0.07, 0.8);
      box(B.detail, MAT.woodDark, cx, fy + 0.38, z0 + 1.95, 1.7, 0.74, 0.7);
      solidBox(cx, z0 + 1.95, 0.9, 0.4, fy, 0.85);
      box(B.detail, MAT.metal, cx + 0.5, fy + 0.98, z0 + 1.9, 0.4, 0.02, 0.3);         // lecturer's laptop
      const cols = Math.max(1, Math.floor((gx1 - gx0 - 1.1) / 2.2) + 1), startX = (gx0 + gx1) / 2 - ((cols - 1) * 2.2) / 2;
      const out = [], grid = [];
      for (let r = 0; ; r++) {
        const pz = z0 + 3.5 + r * 1.9;
        if (pz + 0.78 > z1 - 0.3 || r > 2) break;
        for (let c = 0; c < cols; c++) { const s = deskN(startX + c * 2.2, fy, pz, out); grid.push({ s, r, c }); }
      }
      cabinet(west ? x0 + 0.5 : x1 - 0.5, z1 - 1.0, fy, false);
      planter(west ? x1 - 0.5 : x0 + 0.5, z0 + 0.6, fy);
      if (ctx.registerClass && out.length >= 4) {
        const lastR = Math.max(...grid.map(g => g.r));
        const cand = grid.filter(g => g.r === lastR);
        cand.sort((a, b) => west ? b.c - a.c : a.c - b.c);        // desk nearest the door in the back row
        const ps = cand[0].s; ps.where = "back row, beside the door";
        const bx = ctx.bx, ww = ctx.corrW;
        CLASS_DEFS.push({
          id: ctx.id, title, name: ctx.shortName + " · Room " + (ctx.k + 1), activity: T.includes("SOCIAL") ? "seminar" : "lecture",
          level: levelOf(fy), seats: out, playerSeat: ps,
          teacher: { x: cx, z: z0 + 0.95 }, door: { x: bx + (west ? -1.1 : 1.1), z: cz },
          wait: Array.from({ length: 6 }, (_, i) => ({ x: bx + (west ? -0.75 : 0.75), z: cz + (i - 2.5) * 0.75 }))
        });
      }
      return;
    }

    if (type === "lab") {
      boardNorth(cx, z0, fy, Math.min(4.6, w - 3));
      const bl = Math.min(gx1 - gx0, 6.2), bxm = (gx0 + gx1) / 2;
      const acc = T.includes("SCIENCE") ? ACC.science : T.includes("ENGINEERING") ? ACC.engineering : T.includes("AGRICULTURE") ? ACC.agri
        : T.includes("PHARM") ? ACC.pharma : ACC.health;
      if (T.includes("HEALTH") || T.includes("DENTISTRY")) {
        for (let i = 0; i < 2; i++) bed(gx0 + 0.9 + i * 2.6, cz + 0.4, fy);
        for (let i = 0; i < 2; i++) { box(B.detail, MAT.metal, gx0 + 0.9 + i * 2.6, fy + 1.9, z0 + 0.5, 0.06, 2.4, 0.06); }
        cabinet(cx, z1 - 0.7, fy, true); box(B.detail, ACC.red, cx, fy + 1.6, z1 - 0.2, 0.7, 0.18, 0.05);
        return;
      }
      for (let r = 0; ; r++) {
        const zr = z0 + 3.4 + r * 2.4;
        if (zr + 1.5 > z1 - 0.2 || r > 1) break;
        box(B.detail, MAT.metal, bxm, fy + 0.9, zr, bl, 0.08, 0.95);
        box(B.detail, acc, bxm, fy + 0.95, zr, bl, 0.02, 0.9);
        for (const sx of [-1, 1]) box(B.detail, MAT.metal, bxm + sx * (bl / 2 - 0.12), fy + 0.45, zr, 0.08, 0.9, 0.85);
        solidBox(bxm, zr, bl / 2, 0.5, fy, 0.95);
        const n = Math.max(2, Math.floor(bl / 1.45));
        for (let i = 0; i < n; i++) {
          const px = bxm + (i - (n - 1) / 2) * (bl / n);
          chairFacing(px, fy, zr + 1.05, px, zr);
          if (T.includes("SCIENCE")) { cyl(B.detail, MAT.darkMetal, px, fy + 1.12, zr, 0.07, 0.3, 0, UNIT_CYL); box(B.detail, MAT.white, px, fy + 1.02, zr + 0.1, 0.22, 0.04, 0.22); }
          else if (T.includes("ENGINEERING")) box(B.detail, acc, px, fy + 1.1, zr, 0.4, 0.3, 0.4);
          else if (T.includes("AGRICULTURE")) { box(B.detail, MAT.slab, px, fy + 1.05, zr, 0.3, 0.16, 0.3); sphere(B.detail, MAT.leafB, px, fy + 1.25, zr, 0.2, 0.2, 0.2); }
          else { cyl(B.detail, MAT.white, px, fy + 1.1, zr, 0.07, 0.26, 0, UNIT_CYL); }
        }
      }
      shelfUnit(west ? x0 + 0.5 : x1 - 0.5, z1 - 1.6, 1.8, fy, false, 1.6);
      return;
    }

    if (type === "study") {                                   // library rooms
      for (let i = 0; i < Math.max(1, Math.floor((w - 2) / 1.5)); i++) shelfUnit(x0 + 1.0 + i * 1.5, z0 + 0.5, 1.3, fy, true, 2.2);
      if (d > 5) shelfUnit(cx, z1 - 0.5, Math.min(w - 2, 5), fy, true, 1.6);
      table(cx, cz - 0.1, Math.min(2.8, w - 3), 1.1, fy, 2);
      if (w > 9) table(cx + (west ? -3.4 : 3.4), cz - 0.1, 2.2, 1.1, fy, 2);
      return;
    }

    if (type === "cafeteria") {
      box(B.detail, ACC.union, cx, fy + 0.55, z0 + 0.6, Math.min(w - 2, 8), 1.1, 0.8); solidBox(cx, z0 + 0.6, Math.min(w - 2, 8) / 2, 0.4, fy, 1.1);
      for (let i = 0; i < 3; i++) box(B.detail, MAT.metal, cx - 2 + i * 2, fy + 1.2, z0 + 0.5, 0.75, 0.2, 0.55);
      const cols = Math.max(1, Math.floor((w - 1.5) / 3.2)), rows = Math.max(1, Math.floor((d - 3.2) / 2.8));
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) table(x0 + 1.6 + c * 3.2 + (w - 1.5 - cols * 3.2) / 2, z0 + 3.0 + r * 2.8, 1.7, 0.9, fy, 2);
      return;
    }

    /* offices (and the ICT centre / hostel / senate flavours) */
    if (T.includes("ICT")) {
      const rows = Math.max(1, Math.floor((d - 2.6) / 2.1)), bl = Math.min(gx1 - gx0, 5.2), bxm = (gx0 + gx1) / 2;
      for (let r = 0; r < rows; r++) {
        const zr = z0 + 1.6 + r * 2.1;
        box(B.detail, MAT.white, bxm, fy + 0.75, zr, bl, 0.06, 0.8); solidBox(bxm, zr, bl / 2, 0.4, fy, 0.8);
        const n = Math.max(2, Math.floor(bl / 1.3));
        for (let i = 0; i < n; i++) {
          const px = bxm + (i - (n - 1) / 2) * (bl / n);
          box(B.detail, MAT.darkMetal, px, fy + 1.1, zr - 0.2, 0.55, 0.36, 0.05); box(B.detail, ACC.screen, px, fy + 1.1, zr - 0.17, 0.5, 0.31, 0.02);
          box(B.detail, MAT.darkMetal, px, fy + 0.79, zr + 0.1, 0.4, 0.02, 0.15);
          chairFacing(px, fy, zr + 0.85, px, zr);
        }
      }
      return;
    }
    if (T.includes("HOSTEL")) {
      bed(x0 + 1.0, cz - 0.4, fy, true); bed(x0 + 2.2, cz - 0.4, fy, true);
      box(B.detail, ACC.hostel, x1 - 0.5, fy + 1.0, z0 + 0.9, 0.6, 2.0, 1.1); solidBox(x1 - 0.5, z0 + 0.9, 0.3, 0.55, fy, 2.0);
      box(B.detail, MAT.wood, cx + 0.6, fy + 0.75, z1 - 0.8, 1.3, 0.06, 0.65); solidBox(cx + 0.6, z1 - 0.8, 0.65, 0.33, fy, 0.78);
      chairFacing(cx + 0.6, fy, z1 - 1.5, cx + 0.6, z1 - 0.8);
      return;
    }
    {                                                           // generic staff office
      const dz = z0 + 1.7;
      box(B.detail, MAT.wood, cx, fy + 0.76, dz, 1.7, 0.07, 0.85); box(B.detail, MAT.woodDark, cx, fy + 0.38, dz, 1.6, 0.74, 0.75); solidBox(cx, dz, 0.85, 0.43, fy, 0.82);
      box(B.detail, MAT.darkMetal, cx - 0.4, fy + 1.0, dz - 0.15, 0.5, 0.34, 0.05); box(B.detail, ACC.screen, cx - 0.4, fy + 1.0, dz - 0.12, 0.45, 0.29, 0.02);
      chairFacing(cx, fy, dz - 0.95, cx, dz);                        // staff member's seat (north of the desk)
      chairFacing(cx - 0.6, fy, dz + 1.1, cx - 0.6, dz); chairFacing(cx + 0.6, fy, dz + 1.1, cx + 0.6, dz);   // visitors
      shelfUnit(west ? x0 + 0.5 : x1 - 0.5, cz + 1.2, 2.0, fy, false, 2.0);
      cabinet(cx + 2.2, z1 - 0.5, fy, true); planter(west ? x1 - 0.5 : x0 + 0.5, z1 - 0.6, fy);
    }
  }

  /* ---------- WALL BUILDER ---------- */
  function buildWall(o) {
    const { x, z, len, height, thick, axis, y0 = 0, mat, openings = [], cast = false } = o;
    const level = Math.max(0, Math.round(y0 / LEVEL_H));
    const half = len / 2;
    const ops = openings.map(op => ({
      a: op.at - half, b: op.at + op.width - half,
      bottom: op.bottom ?? 0, top: op.top ?? 2.5, glass: op.glass !== false
    })).sort((p, q) => p.a - q.a);

    const solids = [];
    let cur = -half;
    for (const op of ops) {
      if (op.a > cur + 0.001) solids.push({ u0: cur, u1: op.a, y0: 0, y1: height });
      if (op.bottom > 0.001) solids.push({ u0: op.a, u1: op.b, y0: 0, y1: op.bottom });
      if (op.top < height - 0.001) solids.push({ u0: op.a, u1: op.b, y0: op.top, y1: height });
      cur = Math.max(cur, op.b);
    }
    if (cur < half - 0.001) solids.push({ u0: cur, u1: half, y0: 0, y1: height });

    const batch = cast ? B.solid : B.detail;
    for (const s of solids) {
      const sl = s.u1 - s.u0, sh = s.y1 - s.y0;
      if (sl <= 0.01 || sh <= 0.01) continue;
      const cu = (s.u0 + s.u1) / 2, cy = y0 + s.y0 + sh / 2;
      if (axis === "x") {
        box(batch, mat, x + cu, cy, z, sl, sh, thick);
        addCollider2(x + cu - sl / 2, x + cu + sl / 2, z - thick / 2, z + thick / 2, y0 + s.y0, y0 + s.y1, level);
      } else {
        box(batch, mat, x, cy, z + cu, thick, sh, sl);
        addCollider2(x - thick / 2, x + thick / 2, z + cu - sl / 2, z + cu + sl / 2, y0 + s.y0, y0 + s.y1, level);
      }
    }
    for (const op of ops) {
      if (!op.glass) continue;
      const sl = op.b - op.a, sh = op.top - op.bottom;
      if (sl <= 0.02 || sh <= 0.02) continue;
      const cu = (op.a + op.b) / 2;
      if (axis === "x") box(B.flat, MAT.glass, x + cu, y0 + op.bottom + sh / 2, z, sl * 0.96, sh * 0.96, 0.06);
      else box(B.flat, MAT.glass, x, y0 + op.bottom + sh / 2, z + cu, 0.06, sh * 0.96, sl * 0.96);
    }
  }

  function makeWindows(len, winW, spacing, bottom, top, skip = []) {
    const out = [];
    const usable = len - 3.6 - winW;
    if (usable < 0) return out;
    const n = Math.max(1, Math.floor(usable / spacing) + 1);
    const total = (n - 1) * spacing + winW;
    const a0 = (len - total) / 2;
    for (let i = 0; i < n; i++) {
      const a = a0 + i * spacing;
      if (skip.some(r => a < r[1] + 0.6 && a + winW > r[0] - 0.6)) continue;
      out.push({ at: a, width: winW, bottom, top, glass: true });
    }
    return out;
  }

  /* ---------- EXTERIOR STAIRCASE ---------- */
  function addExteriorStair(sx, zWall, y0, y1, lvFrom) {
    const rise = y1 - y0;
    const run = rise / Math.tan(THREE.MathUtils.degToRad(26));
    const halfW = 1.7;
    // Stair now lands INSIDE the aligned north-wall doorway, not against a window.
    const zTop = zWall + 1.45;
    const zBot = zTop - run;

    stairs.push({ minX: sx - halfW, maxX: sx + halfW, minZ: zBot, maxZ: zTop,
                  y0, y1, axis: "z", level: lvFrom, toLevel: lvFrom + 1 });

    // Lower and upper landings connect the stair flight to the walkable floor.
    box(B.solid, MAT.concrete, sx, y0 - 0.12, zBot - 0.55, halfW * 2, 0.24, 1.1);
    box(B.solid, MAT.concrete, sx, y1 - 0.12, zTop + 0.45, halfW * 2, 0.24, 1.25);

    const steps = Math.max(8, Math.round(rise / 0.18));
    const stepRise = rise / steps, stepRun = run / steps;
    const treadH = Math.min(0.16, stepRise * 0.82);
    for (let i = 0; i < steps; i++) {
      const zc = zBot + stepRun * (i + 0.5);
      const topY = y0 + stepRise * (i + 1);
      box(B.solid, MAT.concrete, sx, topY - treadH / 2, zc, halfW * 2, treadH, stepRun + 0.04);
    }
    for (const side of [-1, 1]) {
      const rx = sx + side * halfW;
      const angle = Math.atan2(rise, run);
      const midZ = (zBot + zTop) / 2, midY = (y0 + y1) / 2 + 1.05;
      _e.set(-angle, 0, 0); _q.setFromEuler(_e); _v.set(rx, midY, midZ);
      _s.set(0.09, 0.09, run / Math.cos(angle));
      _m4.compose(_v, _q, _s); B.solid.add(UNIT_BOX, MAT.metal, _m4);
      for (let i = 0; i <= 6; i++) {
        const t = i / 6;
        cyl(B.solid, MAT.metal, rx, y0 + rise * t + 0.55, zBot + run * t, 0.05, 1.1, 0, UNIT_CYL6);
      }
      _e.set(-angle, 0, 0); _q.setFromEuler(_e); _v.set(rx, (y0 + y1) / 2 - 0.05, midZ);
      _s.set(0.2, 0.45, run / Math.cos(angle));
      _m4.compose(_v, _q, _s); B.solid.add(UNIT_BOX, MAT.concrete, _m4);
      /* side rails block (both levels, taller than step height) */
      const wx0 = rx + (side > 0 ? 0.0 : -0.25), wx1 = rx + (side > 0 ? 0.25 : 0.0);
      addCollider2(wx0, wx1, zBot, zWall, y0, y1 + 2.2, lvFrom);
      addCollider2(wx0, wx1, zBot, zWall, y0, y1 + 2.2, lvFrom + 1);
    }
  }

  /* ---------- DOORS: real frames + animated leaves ---------- */
  const DOOR = createDoorSystem(scene);
  function doorFrame(axis, cx, cz, width, h, y0, thick) {
    const t = 0.14, th = thick + 0.1;
    if (axis === "z") {
      for (const sg of [-1, 1]) box(B.solid, MAT.trim, cx, y0 + h / 2, cz + sg * (width / 2 + t / 2 - 0.02), th, h, t);
      box(B.solid, MAT.trim, cx, y0 + h + 0.05, cz, th, 0.12, width + t * 2);
    } else {
      for (const sg of [-1, 1]) box(B.solid, MAT.trim, cx + sg * (width / 2 + t / 2 - 0.02), y0 + h / 2, cz, t, h, th);
      box(B.solid, MAT.trim, cx, y0 + h + 0.05, cz, width + t * 2, 0.12, th);
    }
  }
  const prettyTitle = (t) => t.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/ Of /g, " of ").replace(/ And /g, " and ").replace(/&/g, "&");

  /* ---------- BUILDING FACTORY ---------- */
  const BUILDING_INFO = [];
  const campusActivityUses = [];
  function createBuilding(cfg) {
    const { x, z, w, d, floors = 1, floorH = 4.6, wallT = 0.42,
            wallColor = 0xe8e3d6, roofColor = 0x606770,
            roomType = "office", title = "BUILDING", subtitle = "" } = cfg;

    const wallMat = S({ color: wallColor, roughness: 0.9 });
    const roofMat = S({ color: roofColor, roughness: 0.94 });

    const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
    const inX0 = x0 + wallT, inX1 = x1 - wallT, inZ0 = z0 + wallT;
    const cw = 3.9, cxW = x - cw / 2, cxE = x + cw / 2;

    const lv = [0.1];
    for (let f = 1; f < floors; f++) lv[f] = lv[f - 1] + floorH;
    const wallH = floorH - 0.35;

    BUILDING_INFO.push({ x, z, w, d, x0, x1, z0, z1, title });
    const activityMap = [
      ["UNIVERSITY LIBRARY", "library-study", "STUDY IN THE LIBRARY", "read"],
      ["ICT & INNOVATION CENTRE", "coding-lab", "PRACTISE IN THE COMPUTER LAB", "use"],
      ["STUDENT UNION & CAFETERIA", "cafeteria", "BUY A MEAL AT THE CAFETERIA", "eat"],
      ["STUDENT HOSTELS", "hostel", "REST IN THE HOSTEL", "use"],
      ["SENATE BUILDING", "admin", "VISIT STUDENT AFFAIRS", "use"],
      ["FACULTY OF LAW", "moot-court", "PRACTISE IN THE MOOT COURT", "use"],
      ["COLLEGE OF HEALTH SCIENCES", "clinical", "ATTEND CLINICAL PRACTICAL", "use"],
      ["FACULTY OF ENGINEERING", "workshop", "USE THE ENGINEERING WORKSHOP", "use"],
      ["FACULTY OF SCIENCE", "science-lab", "ATTEND A SCIENCE PRACTICAL", "use"],
      ["FACULTY OF COMMUNICATION & MEDIA STUDIES", "media-studio", "USE THE MEDIA STUDIO", "use"],
      ["FACULTY OF ARTS", "arts-studio", "VISIT THE ARTS STUDIO", "use"],
      ["FACULTY OF AGRICULTURE", "field-practical", "ATTEND AN AGRICULTURE PRACTICAL", "use"],
      ["FACULTY OF PHARMACEUTICAL SCIENCES", "pharmacy-lab", "ENTER THE PHARMACY LAB", "use"],
      ["FACULTY OF DENTISTRY", "dental-clinic", "ENTER THE DENTAL CLINIC", "use"]
    ];
    const activity = activityMap.find(a => a[0] === title);
    if (activity) campusActivityUses.push({ x, z, r: 3.2, level: 0, label: activity[2], kind: activity[3], activityId: activity[1], buildingTitle: title, onUse: () => router.onCampusActivity?.(activity[1], title) });
    if (title === "STUDENT UNION & CAFETERIA") campusActivityUses.push({ x: x + 4.2, z: z + 1.2, r: 3.0, level: 0, label: "MEET CAMPUS GROUPS", kind: "use", activityId: "social-hub", buildingTitle: title, onUse: () => router.onCampusActivity?.("social-hub", title) });

    for (let f = 0; f < floors; f++) {
      const fy = lv[f];
      if (f === 0) {
        box(B.detail, MAT.slab, x, fy - 0.22, z, w, 0.44, d);
        box(B.detail, MAT.tile, x, fy - 0.02, z, w - wallT * 2, 0.05, d - wallT * 2);
      } else {
        box(B.solid, MAT.slab, x, fy - 0.19, z, w, 0.38, d);
        box(B.detail, MAT.tile, x, fy - 0.02, z, w - wallT * 2, 0.05, d - wallT * 2);
      }

      const nRooms = Math.max(2, Math.round((d - 2 * wallT) / 9));
      const roomD = (d - 2 * wallT) / nRooms;
      const doorsW = [], doorsE = [];
      for (let k = 0; k < nRooms; k++) {
        const at = (k + 0.5) * roomD - 0.85;
        doorsW.push({ at, width: 1.7, bottom: 0, top: 2.6, glass: false });
        doorsE.push({ at, width: 1.7, bottom: 0, top: 2.6, glass: false });
      }
      buildWall({ x: cxW, z, len: d - 2 * wallT, height: wallH, thick: 0.28, axis: "z", y0: fy, mat: wallMat, openings: doorsW });
      buildWall({ x: cxE, z, len: d - 2 * wallT, height: wallH, thick: 0.28, axis: "z", y0: fy, mat: wallMat, openings: doorsE });
      for (let k = 0; k < nRooms; k++) {
        const zc = z + (doorsW[k].at + 0.85 - (d - 2 * wallT) / 2);
        DOOR.add({ axis: "z", x: cxW, z: zc, width: 1.7, y0: fy, h: 2.6, swing: -1, glass: false });
        DOOR.add({ axis: "z", x: cxE, z: zc, width: 1.7, y0: fy, h: 2.6, swing: 1, glass: false });
        doorFrame("z", cxW, zc, 1.7, 2.6, fy, 0.28); doorFrame("z", cxE, zc, 1.7, 2.6, fy, 0.28);
      }

      for (let k = 1; k < nRooms; k++) {
        const bz = inZ0 + k * roomD;
        const wLen = cxW - inX0;
        if (wLen > 0.5) buildWall({ x: (inX0 + cxW) / 2, z: bz, len: wLen, height: wallH, thick: 0.24, axis: "x", y0: fy, mat: wallMat });
        const eLen = inX1 - cxE;
        if (eLen > 0.5) buildWall({ x: (cxE + inX1) / 2, z: bz, len: eLen, height: wallH, thick: 0.24, axis: "x", y0: fy, mat: wallMat });
      }
      for (let k = 0; k < nRooms; k++) {
        const rz0 = inZ0 + k * roomD + 0.2, rz1 = inZ0 + (k + 1) * roomD - 0.2;
        const canClass = f === 0 && k === 0 && (roomType === "classroom" || roomType === "lecture");
        const ctxW = { registerClass: canClass, id: title + "|" + k, bx: x, k, shortName: prettyTitle(title) };
        furnishRoom(inX0 + 0.2, rz0, cxW - 0.2, rz1, fy, roomType, "west", title, ctxW);
        furnishRoom(cxE + 0.2, rz0, inX1 - 0.2, rz1, fy, roomType, "east", title, { k, bx: x });
      }

      const southDoors = [];
      if (f === 0) {
        southDoors.push({ at: w / 2 - 2.0, width: 4.0, bottom: 0, top: 3.0, glass: false });
        DOOR.add({ axis: "x", x, z: z1, width: 4.0, y0: fy, h: 3.0, swing: -1, glass: true });
        doorFrame("x", x, z1, 4.0, 3.0, fy, wallT);
      }
      const southOps = makeWindows(w, 2.5, 5.2, 1.15, 3.0, southDoors.map(o => [o.at, o.at + o.width])).concat(southDoors);
      buildWall({ x, z: z1, len: w, height: wallH, thick: wallT, axis: "x", y0: fy, mat: wallMat, openings: southOps, cast: true });

      const northDoors = [];
      for (let s = 0; s < floors - 1; s++) {
        const sx = x + ((s % 2 === 0) ? -w / 4 : w / 4);
        // The stair crosses the lower-floor wall near its upper rise; make a
        // full-height stair doorway at that exact x position, not a window gap.
        if (f === s) northDoors.push({ at: (sx - x) + w / 2 - 1.15, width: 2.3, bottom: 0, top: wallH, glass: false });
      }
      const northOps = makeWindows(w, 2.5, 5.2, 1.15, 3.0, northDoors.map(o => [o.at, o.at + o.width])).concat(northDoors);
      buildWall({ x, z: z0, len: w, height: wallH, thick: wallT, axis: "x", y0: fy, mat: wallMat, openings: northOps, cast: true });

      buildWall({ x: x0, z, len: d, height: wallH, thick: wallT, axis: "z", y0: fy, mat: wallMat, openings: makeWindows(d, 2.5, 5.2, 1.15, 3.0), cast: true });
      buildWall({ x: x1, z, len: d, height: wallH, thick: wallT, axis: "z", y0: fy, mat: wallMat, openings: makeWindows(d, 2.5, 5.2, 1.15, 3.0), cast: true });

      const pilStep = 6.5;
      const nPil = Math.floor(w / pilStep);
      for (let i = 1; i < nPil; i++) {
        const px = x0 + i * (w / nPil);
        box(B.solid, MAT.trim, px, fy + wallH / 2, z1 + 0.12, 0.55, wallH, 0.35);
        box(B.solid, MAT.trim, px, fy + wallH / 2, z0 - 0.12, 0.55, wallH, 0.35);
      }
      const nPilD = Math.floor(d / pilStep);
      for (let i = 1; i < nPilD; i++) {
        const pz = z0 + i * (d / nPilD);
        box(B.solid, MAT.trim, x0 - 0.12, fy + wallH / 2, pz, 0.35, wallH, 0.55);
        box(B.solid, MAT.trim, x1 + 0.12, fy + wallH / 2, pz, 0.35, wallH, 0.55);
      }
      box(B.solid, MAT.trim, x, fy + wallH - 0.15, z, w + 0.9, 0.35, d + 0.9);

      if (f === 0) {
        box(B.solid, MAT.trim, x, fy + 3.5, z1 + 2.2, 8.4, 0.4, 4.8);
        for (const sx of [-3.6, 3.6]) {
          cyl(B.solid, MAT.trim, x + sx, fy + 1.75, z1 + 4.2, 0.35, 3.5, 0, UNIT_CYL);
          addCollider2(x + sx - 0.4, x + sx + 0.4, z1 + 3.8, z1 + 4.6, 0, fy + 3.5, 0);
        }
        for (let i = 0; i < 3; i++) {
          box(B.solid, MAT.slab, x, fy - 0.15 - i * 0.15, z1 + 0.55 + i * 0.5, 7.0, 0.16, 0.5);
        }
        const tex = makeLabelTexture(title, subtitle);
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 1.8), S({ map: tex, roughness: 0.65 }));
        sign.position.set(x, fy + 4.35, z1 + 0.24);
        scene.add(sign);
      }
    }

    for (let s = 0; s < floors - 1; s++) {
      const sx = x + ((s % 2 === 0) ? -w / 4 : w / 4);
      addExteriorStair(sx, z0, lv[s], lv[s + 1], s);
    }

    const topY = lv[floors - 1] + wallH;
    box(B.solid, roofMat, x, topY + 0.25, z, w + 0.7, 0.5, d + 0.7);
    const ph = 0.95;
    box(B.solid, MAT.trim, x, topY + 0.5 + ph / 2, z1 + 0.3, w + 0.7, ph, 0.35);
    box(B.solid, MAT.trim, x, topY + 0.5 + ph / 2, z0 - 0.3, w + 0.7, ph, 0.35);
    box(B.solid, MAT.trim, x1 + 0.3, topY + 0.5 + ph / 2, z, 0.35, ph, d + 0.7);
    box(B.solid, MAT.trim, x0 - 0.3, topY + 0.5 + ph / 2, z, 0.35, ph, d + 0.7);
    for (let i = 0; i < 3; i++) {
      const rx = x + (Math.random() - 0.5) * (w - 8), rz = z + (Math.random() - 0.5) * (d - 8);
      box(B.solid, MAT.metal, rx, topY + 1.1, rz, 2.2, 1.2, 1.6);
      cyl(B.solid, MAT.metal, rx, topY + 1.05, rz, 0.55, 0.1, 0, UNIT_CYL6);
    }
    if (floors > 1) {
      cyl(B.solid, MAT.metal, x + w * 0.28, topY + 2.0, z - d * 0.25, 1.5, 2.6, 0, UNIT_CYL);
      box(B.solid, MAT.metal, x + w * 0.28, topY + 0.8, z - d * 0.25, 3.2, 0.3, 3.2);
    }

    /* ---------- ARCHITECTURAL IDENTITY PASS ----------
       Every campus building receives a distinct, detailed entrance and
       facade treatment while keeping the shared walkable building shell. */
    const accentByType = {
      office: 0x244f70, lab: 0x168a8a, lecture: 0x8b593d,
      classroom: 0x557a4a, study: 0x9b713e, cafeteria: 0xc76b32
    };
    const accent = S({ color: accentByType[roomType] || 0x315f78, roughness: 0.72 });
    const glassBlue = S({ color: 0x8ec9e8, roughness: 0.22, metalness: 0.12, transparent: true, opacity: 0.72 });
    const darkGlass = S({ color: 0x28485c, roughness: 0.25, metalness: 0.18 });
    const trimGold = S({ color: 0xc49a4b, metalness: 0.35, roughness: 0.42 });
    const frontZ = z1 + 0.32;

    // A strong entrance portal, glazed doors, broad steps and accessible ramp.
    box(B.solid, accent, x, 3.25, frontZ + 0.45, Math.min(13,w*0.42), 0.42, 1.1);
    for (let step=0; step<4; step++) {
      box(B.solid, MAT.slab, x, 0.12 + (3 - step)*0.09, z1 + 1.1 + step*0.62, Math.min(11,w*0.5), 0.22, 0.9, 0);
    }
    box(B.solid, MAT.tile, x - w*0.24, 0.13, z1 + 3.1, 3.0, 0.22, 5.2);
    for (const sx of [-1,1]) {
      box(B.solid, accent, x + sx*Math.min(6.0,w*0.25), 2.3, frontZ + 0.45, 0.48, 4.6, 0.65);
      box(B.solid, trimGold, x + sx*Math.min(6.0,w*0.25), 4.65, frontZ + 0.45, 0.85, 0.24, 0.9);
    }

    // Deep window reveals, sill bands and a continuous floor-to-floor facade belt.
    for (let f=0; f<floors; f++) {
      const fy=lv[f];
      box(B.solid, accent, x, fy + 0.42, z1 + 0.24, w-1.0, 0.22, 0.22);
      for(let wx=x-w/2+2.2; wx<x+w/2-1.4; wx+=4.8) {
        if (Math.abs(wx-x)<3.1) continue;
        box(B.detail, darkGlass, wx, fy+2.05, z1+0.28, 2.45, 2.05, 0.12);
        box(B.detail, glassBlue, wx, fy+2.05, z1+0.36, 2.08, 1.65, 0.05);
        box(B.solid, trimGold, wx, fy+3.12, z1+0.34, 2.62, 0.12, 0.16);
        box(B.solid, trimGold, wx, fy+0.98, z1+0.34, 2.62, 0.12, 0.16);
      }
    }

    // Individual architectural signatures: each building reads differently at a distance.
    if (title.includes("SENATE")) {
      // Formal administration: portico, paired columns, pediment and flag mast.
      for (const sx of [-4.6,-1.55,1.55,4.6]) cyl(B.solid, MAT.trim, x+sx, 2.65, z1+3.2, 0.34, 5.2, 0, UNIT_CYL);
      box(B.solid, accent, x, 5.45, z1+3.2, 12.2, 0.48, 1.0);
      box(B.solid, MAT.slab, x, 6.15, z1+3.0, 13.4, 0.22, 2.4);
      cyl(B.solid, MAT.metal, x+w*0.34, topY+5.2, z, 0.08, 9.5, 0, UNIT_CYL);
      box(B.detail, S({color:0xc63c48,roughness:0.7}), x+w*0.34+0.75, topY+8.5, z, 1.5, 0.85, 0.05);
    } else if (title.includes("SCIENCE")) {
      // Science: glazed laboratory wing and rooftop ventilation stacks.
      box(B.detail, glassBlue, x-w*0.31, 5.1, z1+0.22, w*0.22, 5.8, 0.16);
      for(let i=0;i<4;i++) box(B.solid, MAT.metal, x-w*0.3+i*2.1, topY+1.0, z-d*0.25, 0.9, 1.8, 1.0);
      box(B.solid, accent, x, 0.45, z1+4.1, w*0.58, 0.34, 0.55);
    } else if (title.includes("ENGINEERING")) {
      // Engineering: exposed structural frames, steel braces and workshop bay.
      for(let i=0;i<4;i++){
        const px=x-w*0.34+i*(w*0.22);
        box(B.solid, MAT.metal, px, 5.1, z1+0.58, 0.24, 8.8, 0.28);
        box(B.solid, MAT.trim, px, 9.5, z1+0.58, 0.24, 0.24, 0.28);
      }
      box(B.solid, accent, x, 1.75, z1+4.0, 10.5, 3.4, 0.55);
      box(B.detail, MAT.yellow || trimGold, x, 3.45, z1+4.32, 7.4, 0.32, 0.12);
    } else if (title.includes("LAW")) {
      // Law: courthouse-like pediment and ceremonial columns.
      for(const sx of [-5,-2.5,0,2.5,5]) cyl(B.solid, MAT.trim, x+sx, 2.3, z1+2.7, 0.27, 4.6, 0, UNIT_CYL);
      box(B.solid, accent, x, 4.85, z1+2.7, 13.0, 0.5, 0.8);
      const ped=new THREE.Object3D();ped.position.set(x,6.1,z1+2.5);ped.rotation.y=Math.PI/4;ped.updateMatrix();B.solid.add(new THREE.ConeGeometry(7.2,2.4,4),accent,ped.matrix); /* Batch.add takes (geometry, material, matrix), not a Mesh */
    } else if (title.includes("ARTS")) {
      // Arts: colourful vertical fins and a shaded courtyard canopy.
      const colours=[0xc65b4b,0xe0a33c,0x4e8d83,0x6576b8];
      for(let i=0;i<8;i++) box(B.solid,S({color:colours[i%4],roughness:0.78}),x-w*0.38+i*w*0.105,5.0,z1+0.48,0.42,7.2,0.34);
      box(B.solid, accent, x, 7.3, z1+3.1, 15, 0.28, 5.0);
    } else if (title.includes("SOCIAL")) {
      // Social Sciences: broad ribbon balconies and shaded seminar frontage.
      for(let f=0;f<floors;f++){
        box(B.solid, MAT.slab, x, lv[f]+3.75, z1+1.05, w+1.6, 0.28, 1.8);
        box(B.solid, trimGold, x, lv[f]+4.15, z1+1.82, w+1.2, 0.12, 0.12);
      }
      for(let i=0;i<6;i++) box(B.solid, accent, x-w*0.4+i*w*0.16, 2.2, z1+2.1, 0.28, 4.4, 0.3);
    } else if (title.includes("HEALTH")) {
      // Health sciences: clean clinical facade, blue glass and a medical cross.
      box(B.solid, S({color:0xf7f8f3,roughness:0.7}), x, 5.4, z1+0.42, 8.8, 4.0, 0.4);
      box(B.solid, S({color:0xc63c48}), x, 5.5, z1+0.68, 0.7, 3.0, 0.12);
      box(B.solid, S({color:0xc63c48}), x, 5.5, z1+0.69, 2.6, 0.7, 0.12);
      for(let i=0;i<3;i++) box(B.detail, glassBlue, x-7+i*7, 7.1, z1+0.36, 4.2, 2.1, 0.1);
    } else if (title.includes("ICT")) {
      // ICT centre: modern curtain-wall grid, blue accent fins and rooftop mast.
      box(B.detail, darkGlass, x, 5.4, z1+0.32, w*0.64, 7.4, 0.16);
      for(let i=0;i<7;i++) box(B.solid, accent, x-w*0.31+i*w*0.103, 5.4, z1+0.46, 0.22, 7.5, 0.22);
      for(let i=0;i<4;i++) box(B.solid, MAT.trim, x-w*0.28+i*w*0.18, 1.8, z1+3.6, 1.2, 3.6, 0.4);
      cyl(B.solid, MAT.metal, x, topY+3.8, z, 0.12, 7.0, 0, UNIT_CYL);
    } else if (title.includes("LIBRARY")) {
      // Library: monumental entrance frame, long sunshades and reading terrace.
      box(B.solid, accent, x, 5.3, z1+1.5, w*0.72, 0.42, 3.8);
      box(B.solid, MAT.trim, x, 3.4, z1+3.1, 15.5, 6.8, 0.5);
      box(B.detail, darkGlass, x, 3.5, z1+3.4, 12.8, 5.8, 0.12);
      for(let i=0;i<6;i++) box(B.solid, trimGold, x-w*0.3+i*w*0.12, 6.9, z1+2.5, 0.18, 0.18, 4.0);
      box(B.solid, MAT.tile, x, 0.18, z1+8.5, w*0.72, 0.28, 7.0);
    } else if (title.includes("STUDENT UNION")) {
      // Student union: bright cafeteria frontage, awnings and outdoor dining.
      for(let i=0;i<4;i++){
        const awn=S({color:[0xe85a48,0xf2c34e,0x3d9e9a,0x537dc0][i],roughness:0.75});
        box(B.solid, awn, x-w*0.34+i*w*0.22, 3.7, z1+2.2, 8.2, 0.28, 3.4);
      }
      for(let i=0;i<5;i++){
        const tx=x-w*0.38+i*w*0.19;
        cyl(B.solid, MAT.trim, tx, 0.48, z1+8.0, 0.1, 0.95, 0, UNIT_CYL);
        cyl(B.solid, MAT.trim, tx, 0.48, z1+11.2, 0.1, 0.95, 0, UNIT_CYL);
        cyl(B.detail, MAT.wood, tx, 1.05, z1+9.6, 1.0, 0.16, 0, UNIT_CYL);
      }
    }

    // Raised planters and small wayfinding pylons at each main entrance.
    for(const sx of [-w*0.38,w*0.38]){
      box(B.solid, MAT.tile, x+sx, 0.35, z1+2.2, 3.0, 0.7, 1.8);
      for(let k=0;k<3;k++) sphere(B.detail, MAT.leafB, x+sx+(k-1)*0.7, 1.0, z1+2.2, 0.55, 0.48, 0.55);
    }
    box(B.solid, accent, x+w*0.39, 1.65, z1+5.0, 0.22, 3.3, 0.22);
    box(B.solid, trimGold, x+w*0.39, 3.4, z1+5.0, 2.6, 0.18, 0.24);
  }

  /* ---------- PLACE BUILDINGS (aligned rows, all facing south onto their avenue) ---------- */
  const BD = (row, col, o) => ({ row, col, ...o });
  const BUILDINGS = [
    BD(0, 0, { title: "FACULTY OF AGRICULTURE", subtitle: "Crop Science · Soil Science · Animal Science", w: 36, d: 28, floors: 2, wallColor: 0xe3e8d5, roofColor: 0x55734a, roomType: "lab" }),
    BD(0, 1, { title: "FACULTY OF PHARMACEUTICAL SCIENCES", subtitle: "Pharmacy · Pharmacology · Research", w: 36, d: 28, floors: 2, wallColor: 0xe7eeeb, roofColor: 0x4e6971, roomType: "lab" }),
    BD(0, 2, { title: "FACULTY OF DENTISTRY", subtitle: "Dental Sciences & Clinics", w: 32, d: 24, floors: 2, wallColor: 0xece8dc, roofColor: 0x5a6f75, roomType: "lab" }),
    BD(0, 3, { title: "STUDENT HOSTELS", subtitle: "Campus Residential Halls", w: 38, d: 30, floors: 3, wallColor: 0xe1e5df, roofColor: 0x52656b, roomType: "office" }),
    BD(1, 0, { title: "FACULTY OF ENGINEERING", subtitle: "Civil · Mechanical · Electrical", w: 34, d: 26, floors: 2, wallColor: 0xd9dde3, roofColor: 0x4f5a66, roomType: "lab" }),
    BD(1, 1, { title: "FACULTY OF SCIENCE", subtitle: "Physics · Chemistry · Biology", w: 32, d: 26, floors: 2, wallColor: 0xdfe5e0, roofColor: 0x566270, roomType: "lab" }),
    BD(1, 2, { title: "COLLEGE OF HEALTH SCIENCES", subtitle: "Medicine · Nursing · Pharmacy", w: 34, d: 26, floors: 2, wallColor: 0xeef2f0, roofColor: 0x52666d, roomType: "lab" }),
    BD(1, 3, { title: "ICT & INNOVATION CENTRE", subtitle: "Computing · Research Labs", w: 30, d: 24, floors: 2, wallColor: 0xdde8ee, roofColor: 0x4a5a66, roomType: "office" }),
    BD(2, 0, { title: "FACULTY OF ARTS", subtitle: "Humanities & Languages", w: 30, d: 24, floors: 2, wallColor: 0xe9dfd4, roofColor: 0x6b5c4e, roomType: "classroom" }),
    BD(2, 1, { title: "SENATE BUILDING", subtitle: "Administration & Council", w: 34, d: 26, floors: 2, wallColor: 0xece6d8, roofColor: 0x5b636c, roomType: "office" }),
    BD(2, 2, { title: "FACULTY OF MANAGEMENT SCIENCES", subtitle: "Accounting · Finance · Management", w: 34, d: 26, floors: 2, wallColor: 0xe5e9e2, roofColor: 0x536a70, roomType: "lecture" }),
    BD(2, 3, { title: "FACULTY OF SOCIAL SCIENCES", subtitle: "Economics · Sociology · Psychology", w: 32, d: 24, floors: 2, wallColor: 0xe3e6e8, roofColor: 0x5a6470, roomType: "classroom" }),
    BD(3, 0, { title: "FACULTY OF EDUCATION", subtitle: "Teacher Education & Learning", w: 34, d: 26, floors: 2, wallColor: 0xe9e2d5, roofColor: 0x79634c, roomType: "classroom" }),
    BD(3, 1, { title: "UNIVERSITY LIBRARY", subtitle: "Knowledge Resource Centre", w: 46, d: 36, floors: 2, wallColor: 0xf0e9dc, roofColor: 0x6d5646, roomType: "study" }),
    BD(3, 2, { title: "STUDENT UNION & CAFETERIA", subtitle: "Student Life Complex", w: 44, d: 32, floors: 1, wallColor: 0xe4ded0, roofColor: 0x7a5c46, roomType: "cafeteria" }),
    BD(3, 3, { title: "FACULTY OF LAW", subtitle: "Moot Court & Chambers", w: 30, d: 24, floors: 2, wallColor: 0xeee2d2, roofColor: 0x6a5548, roomType: "lecture" }),
    BD(4, 0, { title: "FACULTY OF COMMUNICATION & MEDIA STUDIES", subtitle: "Broadcast · Journalism · Media", w: 36, d: 26, floors: 2, wallColor: 0xe7e2eb, roofColor: 0x625b79, roomType: "classroom" })
  ].map(b => ({ ...b, x: COLS[b.col], z: rowZ1(b.row) - b.d / 2 }));
  for (const b of BUILDINGS) createBuilding(b);
  DOOR.finalize();
  await new Promise(resolve => requestAnimationFrame(resolve));

  /* ---------- CAMPUS DRESSING ---------- */
  const zones = BUILDING_INFO.map(b => ({ x0: b.x0 - 4, x1: b.x1 + 4, z0: b.z0 - 12, z1: b.z1 + 15 }));
  const inBuildingZone = (x, z, m = 0) => zones.some(r => x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m);
  const onRoadZone = (x, z, m = 0) => {
    for (const A of AVENUES) if (Math.abs(z - A) < 9 + m) return true;
    if (Math.abs(x) < 10 + m) return true;
    for (const sx of SIDE_X) if (Math.abs(x - sx) < 8 + m) return true;
    return false;
  };
  const inLot = (x, z, m = 0) => x > LOT.x0 - 6 - m && x < LOT.x1 + m && z > LOT.z0 - m && z < LOT.z1 + m;
  const inPavilion = (x, z, m = 0) => x > -60 - m && x < -30 + m && z > 175 - m && z < 197 + m;
  const nearRound = (x, z, m = 0) => Math.hypot(x - ROUND.x, z - ROUND.z) < ROUND.r1 + 6 + m;
  const nearGate = (x, z) => Math.abs(x) < 26 && z > 222;
  const addTree = (x, z, s) => {
    const th = 3.4 * s;
    cyl(B.solid, MAT.trunk, x, th / 2, z, 0.28 * s, th, 0, UNIT_CYL6);
    const leaf = Math.random() > 0.55 ? MAT.leafA : (Math.random() > 0.5 ? MAT.leafB : MAT.leafC);
    sphere(B.solid, leaf, x, th + 1.5 * s, z, 2.5 * s, 1.9 * s, 2.5 * s);
    sphere(B.solid, leaf, x + 0.9 * s, th + 2.6 * s, z - 0.6 * s, 1.7 * s, 1.4 * s, 1.7 * s);
    sphere(B.solid, leaf, x - 1.0 * s, th + 2.2 * s, z + 0.8 * s, 1.5 * s, 1.3 * s, 1.5 * s);
    addCollider2(x - 0.45, x + 0.45, z - 0.45, z + 0.45, 0, th, 0);
  };
  /* tree-lined avenues */
  for (const A of AVENUES) {
    for (let x = -222; x <= 222; x += 24) {
      for (const dz of [-10.6, 10.6]) {
        const tx = x + (dz > 0 ? 12 : 0), tz = A + dz;
        if (Math.abs(tx) < 22 || SIDE_X.some(sx => Math.abs(tx - sx) < 12) || inBuildingZone(tx, tz, 0) || nearRound(tx, tz) || inLot(tx, tz, 2) || inPavilion(tx, tz, 2)) continue;
        addTree(tx, tz, 0.85 + Math.random() * 0.3);
      }
    }
  }
  /* lawns */
  let treeCount = 0;
  for (let i = 0; i < 900 && treeCount < 170; i++) {
    const x = (Math.random() * 2 - 1) * 228, z = EDGE_N + 8 + Math.random() * (GATE_Z - 20 - EDGE_N - 8);
    if (onRoadZone(x, z, 3) || inBuildingZone(x, z, 3) || nearRound(x, z, 4) || inLot(x, z, 4) || inPavilion(x, z, 4) || nearGate(x, z)) continue;
    addTree(x, z, 0.75 + Math.random() * 0.6); treeCount++;
  }
  /* benches (NPCs and the player can sit on them) + flower beds */
  const bench = (x, z, face) => {
    box(B.detail, MAT.wood, x, 0.48, z, 0.6, 0.1, 2.2);
    box(B.detail, MAT.wood, x - face * 0.28, 0.82, z, 0.09, 0.55, 2.2);
    for (const dz of [-0.95, 0.95]) box(B.detail, MAT.metal, x, 0.24, z + dz, 0.5, 0.48, 0.1);
    addCollider2(x - 0.4, x + 0.4, z - 1.1, z + 1.1, 0, 0.85, 0);
    seats.push({ type: "sit", label: "SIT", x, z, yaw: face > 0 ? Math.PI / 2 : -Math.PI / 2, h: 0.5, level: 0, taken: false });
  };
  for (const k of [1, 3, 4]) {
    const zc = AVENUES[k] - 30;
    bench(10.8, zc, -1); bench(-10.8, zc, 1);
    for (const sx of [-1, 1]) {
      const bx = sx * 17, bz = AVENUES[k] - 17;
      box(B.detail, MAT.slab, bx, 0.12, bz, 5.2, 0.24, 5.2);
      for (let i = 0; i < 9; i++) sphere(B.detail, i % 3 === 0 ? MAT.leafB : MAT.leafA, bx - 2 + (i % 3) * 2, 0.5, bz - 2 + Math.floor(i / 3) * 2, 0.6, 0.4, 0.6);
      for (let i = 0; i < 6; i++) sphere(B.detail, S({ color: [0xe5a4c5, 0xf2d16b, 0xf0eee0][i % 3], roughness: 0.8 }), bx - 1.6 + (i % 3) * 1.6, 0.8, bz - 1 + Math.floor(i / 3) * 2, 0.22, 0.22, 0.22);
    }
  }
  for (const sx of [-1, 1]) for (const dz of [-26, 26]) bench(sx * 8.8 * 1.0 + sx * 7, ROUND.z + dz, -sx);
  /* perimeter hedge just inside the wall */
  for (let x = -EDGE_X + 6; x <= EDGE_X - 6; x += 6.5) {
    sphere(B.detail, MAT.leafC, x, 0.7, EDGE_N + 2.2, 2.4, 0.9, 1.2);
    if (Math.abs(x) > 14) sphere(B.detail, MAT.leafC, x, 0.7, GATE_Z - 2.2, 2.4, 0.9, 1.2);
  }
  for (let z = EDGE_N + 8; z <= GATE_Z - 8; z += 6.5) { sphere(B.detail, MAT.leafC, -EDGE_X + 2.2, 0.7, z, 1.2, 0.9, 2.4); sphere(B.detail, MAT.leafC, EDGE_X - 2.2, 0.7, z, 1.2, 0.9, 2.4); }

  B.solid.flush(40000);
  B.detail.flush(60000);
  B.flat.flush(60000);

  /* ---------- STREET LAMPS + UTILITY POLES ---------- */
  for (const A of AVENUES) for (let x = -216; x <= 216; x += 36) {
    if (Math.abs(x) < 14 || (A === AVENUES[2] && Math.abs(x) < ROUND.r1 + 8)) continue;
    addStreetLamp(scene, x, 0, A + 6.8, 0); addStreetLamp(scene, x + 18, 0, A - 6.8, Math.PI);
  }
  for (let z = AVENUES[0] + 30; z < GATE_Z - 10; z += 36) {
    if (Math.abs(z - AVENUES[2]) < ROUND.r1 + 8) continue;
    addStreetLamp(scene, 7.4, 0, z, -Math.PI / 2); addStreetLamp(scene, -7.4, 0, z + 18, Math.PI / 2);
  }
  for (const A of AVENUES) addPoleLine(scene, -EDGE_X + 8, A + 9.6, EDGE_X - 8, A + 9.6, 0, 44);

  /* ---------- GAME GLUE ---------- */
  const world = {
    colliders, seats, uses: campusActivityUses, stairs, platforms: [],
    levelHeight: (l) => (l > 0 ? 0.1 + l * LEVEL_H : 0),
    bounds: { minX: -245, maxX: 245, minZ: -279, maxZ: 262 },
  };

  /* ---------- CAMPUS CLOTHING MARKET + THIRD-PERSON FITTING STUDIO ---------- */
  const styleUses = [];
  {
    const pavilion = new THREE.Group(); pavilion.position.set(-45,0,186); scene.add(pavilion);
    const mat = (c,r=.8)=>new THREE.MeshStandardMaterial({color:c,roughness:r});
    const cream=mat(0xe8dfc9), dark=mat(0x263b4a), gold=mat(0xc6a35b), glass= new THREE.MeshStandardMaterial({color:0x8bd9e8,transparent:true,opacity:.28,roughness:.18});
    const box=(w,h,d,m,x,y,z)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);pavilion.add(o);return o;};
    // open-front boutique with a shaded roof, glass changing cubicles and display counter
    box(20,.45,13,cream,0,.25,0); box(20,.45,13,dark,0,5.4,0);
    box(.45,5.2,13,dark,-9.8,2.8,0);box(.45,5.2,13,dark,9.8,2.8,0);box(20,5.2,.45,dark,0,2.8,-6.3);
    box(5,.12,.12,gold,0,4.9,-6.05);box(4,1.2,.25,gold,0,1.1,-5.8);
    for(let i=0;i<3;i++){const x=-5.8+i*5.8;box(3.1,3.4,.12,glass,x,2.1,3.8);box(3.2,.15,3.1,dark,x,3.9,5.2);}
    // clothing rails and folded-stock display tables
    for(let i=0;i<3;i++){const x=-6+i*6;box(3.7,.12,.12,gold,x,3.5,-1.8);box(.12,2.6,.12,dark,x-1.7,2.2,-1.8);box(.12,2.6,.12,dark,x+1.7,2.2,-1.8);
      for(let j=0;j<5;j++){const hue=[0x1d5d83,0x9c3450,0xd4a83d,0x2c775b,0x603c83][(j+i)%5];box(.38,1.45,.08,mat(hue),x-1.35+j*.67,2.45,-1.8);}}
    const mirror=new THREE.Mesh(new THREE.BoxGeometry(1.4,2.8,.08),glass);mirror.position.set(7.8,2.3,2.1);pavilion.add(mirror);
    const signCanvas=document.createElement('canvas');signCanvas.width=1024;signCanvas.height=256;const cx=signCanvas.getContext('2d');cx.fillStyle='#102738';cx.fillRect(0,0,1024,256);cx.strokeStyle='#d6b96d';cx.lineWidth=12;cx.strokeRect(12,12,1000,232);cx.fillStyle='#f4e7c4';cx.font='bold 76px Arial';cx.textAlign='center';cx.fillText('GHEGEH CAMPUS STYLE',512,112);cx.font='38px Arial';cx.fillText('CLOTHING MARKET  •  FITTING STUDIO',512,178);
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(12,3),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(signCanvas)}));sign.position.set(0,5.7,-6.05);pavilion.add(sign);
    styleUses.push({x:-45,z:181,r:5,level:0,label:'BROWSE CLOTHING MARKET',kind:'buy',onUse:()=>router.onOpenMarket?.()});
    styleUses.push({x:-45,z:190,r:4,level:0,label:'ENTER 3D FITTING STUDIO',kind:'mirror',onUse:()=>openWardrobeFor(ctl)});
  }
  /* pavilion walls block the player (it is a shop, not a ghost) */
  addCollider2(-55, -35, 179.4, 180.2, 0, 5.4, 0);
  addCollider2(-55.3, -54.5, 179.4, 192.6, 0, 5.4, 0);
  addCollider2(-35.5, -34.7, 179.4, 192.6, 0, 5.4, 0);
  world.uses.push(...styleUses);

  const ctl = new ThirdPersonControls(camera, router.renderer.domElement, world, {
    scene, x: 0, z: 214, yaw: Math.PI, level: 0,
    onUse: (use) => {
      if (typeof use.onUse === "function") { use.onUse(); return; }
      const nearby = NPCs.nearest(ctl.pos.x, ctl.pos.z, 2.8);
      if (nearby) { NPCs.talk(nearby); return; }
      if (window.__ph3d_phone) window.__ph3d_phone._toast(use.label || "USE");
    },
  });
  const toast = (m) => { try { window.__ph3d_phone?._toast?.(m); } catch (e) {} };

  /* ---------- PEOPLE ---------- */
  const campusNpcUses = [];
  const spawnCampusNpc = (role, x, z, opts = {}) => {
    const npc = NPCs.spawnRole(scene, role, x, z);
    if (npc) {
      const marker = {
        x, z, r: 2.7, level: 0, kind: "npc", npc,
        label: opts.label || ("TALK TO " + (npc.roleDef?.label || "STUDENT")),
        onUse: opts.onUse || (() => { NPCs.talk(npc); router.onNpcInteract?.(npc); })
      };
      world.uses.push(marker); campusNpcUses.push({ npc, marker });
    }
    return npc;
  };
  const refreshNpcAabbs = () => {
    try {
      NPCs.setAABBs(colliders.filter(c => c && Number.isFinite(c.minX) && Number.isFinite(c.maxX) && (c.y1 - c.y0) > 0.3 && c.level === 0)
        .map(c => ({ x: (c.minX + c.maxX) / 2, z: (c.minZ + c.maxZ) / 2, hx: (c.maxX - c.minX) / 2, hz: (c.maxZ - c.minZ) / 2 })));
    } catch (e) {}
  };

  /* cars: pre-parked ones plus arrivals that drive in through the gate and park */
  const tier = Quality.current.tier;
  const parking = router.cinematic ? null : createParkingTraffic({
    scene, colliders, bays: parkingBays, lot: LOT, arrivals: tier === "low" ? 2 : 4,
    onCollidersChanged: () => refreshNpcAabbs(),
    onArrive: (car, pos) => {
      const npc = spawnCampusNpc("student", pos.x, pos.z, { label: "TALK TO ARRIVING STUDENT" });
      if (!npc) return;
      const b = BUILDINGS[Math.floor(Math.random() * BUILDINGS.length)];
      npc.state = "stroll"; npc.strollX = b.x + (Math.random() - 0.5) * 6; npc.strollZ = b.z + b.d / 2 + 7; npc.strollSp = 1.5; npc.stateT = 120;
    }
  });

  let schoolSim = null;
  if (!router.cinematic) {
    try {
      NPCs.despawn();
      NPCs.setScene(scene);
      NPCs.setSeats(seats.filter(s => s.level === 0 && !s.classId));        // class desks are managed by the school sim
      refreshNpcAabbs();
      NPCs.setTerrain(() => 0, world.bounds);
      const roles = { "SENATE BUILDING": "clerk", "COLLEGE OF HEALTH SCIENCES": "doctor", "FACULTY OF DENTISTRY": "doctor", "STUDENT UNION & CAFETERIA": "trader" };
      const skipHall = tier === "low" ? 6 : 0;
      BUILDINGS.forEach((b, i) => {
        if (i < skipHall) return;
        spawnCampusNpc(roles[b.title] || "student", b.x, b.z + 1.2);
        if (tier !== "low" && ["UNIVERSITY LIBRARY", "STUDENT UNION & CAFETERIA", "SENATE BUILDING"].includes(b.title)) spawnCampusNpc(b.title === "STUDENT UNION & CAFETERIA" ? "student" : "clerk", b.x + 0.9, b.z - 3.2);
      });
      /* foot traffic on the avenues, the boulevard and around the roundabout */
      const walkers = [[-14, 6, "student"], [14, 6, "student"], [-26, -34, "student"], [26, -34, "student"], [-60, 80, "student"], [60, 80, "clerk"], [8, 120, "student"], [-8, 170, "student"]];
      for (const [x, z, r] of walkers.slice(0, tier === "low" ? 4 : walkers.length)) spawnCampusNpc(r, x, z);

      /* the school-sim: classes closest to the gate run first */
      const defs = CLASS_DEFS.slice().sort((p, q) => q.door.z - p.door.z).slice(0, tier === "low" ? 2 : tier === "medium" ? 3 : 4);
      schoolSim = createSchoolSim({ THREE, scene, NPCs, world, router, toast, getCtl: () => ctl, spawn: spawnCampusNpc });
      for (const def of defs) schoolSim.addClass(def);
      schoolSim.populate(tier === "low" ? 3 : tier === "medium" ? 4 : 5);
      NPCs.setSeats(seats.filter(s => s.level === 0 && !s.classId));
    } catch (e) { console.warn("[university] NPC / school population skipped", e); }
  }

  const drv = router.cinematic ? null : ZoneDrive.attach({
    scene, camera, renderer: router.renderer, world,
    spawn: { x: 0, z: 214, y: 0 },
  });

  const _actors = [];
  return {
    three: scene,
    camera,
    controls: ctl,
    world,
    openWardrobe: () => openWardrobeFor(ctl),
    equipClothing: (look) => { for (const [key, value] of Object.entries(look || {})) Wardrobe.set(key, value); try { if (ctl._wardrobeUI) ctl._wardrobeUI.apply(Wardrobe.config, null); else openWardrobeFor(ctl); } catch {} },
    playEmote: (name) => ctl.playEmote(name),
    handshake: () => ctl._pairAction("handshake"),
    hug: () => ctl._pairAction("hug"),
    crumb: "GHEGEH UNIVERSITY",
    title: "",
    subtitle: "",
    hint: "",
    isInterior: true,
    sceneId: "university",
    update: (dt) => {
      if (!router.cinematic) {
        if (!drv.isDriving()) ctl.update(dt);
        drv.update(dt);
      }
      try {
        if (!router.cinematic) {
          parking?.update(dt);
          schoolSim?.update(dt);                       // before the NPC tick so seating orders apply this frame
          NPCs.tick(dt, ctl.pos.x, ctl.pos.z);
          _actors.length = 0;
          _actors.push({ x: ctl.pos.x, z: ctl.pos.z, y: ctl.floorY || 0 });
          for (const n of NPCs.list) if (n && !n.dead && n.ctl && n.ctl.pos) _actors.push({ x: n.ctl.pos.x, z: n.ctl.pos.z, y: n.ctl.pos.y || 0 });
          DOOR.update(dt, _actors);
        }
        for (const item of campusNpcUses) {
          if (item.npc && item.npc.ctl && item.npc.ctl.pos) { item.marker.x = item.npc.ctl.pos.x; item.marker.z = item.npc.ctl.pos.z; }
        }
      } catch (e) { if (!window.__uniWarned) { window.__uniWarned = true; console.warn("[university] update", e); } }
    },
    dispose: () => {
      if (!router.cinematic) { try { schoolSim?.dispose(); NPCs.despawn(); NPCs.setSeats([]); } catch (e) {} drv?.dispose(); parking?.dispose(); }
      DOOR.dispose(); ctl.dispose();
    },
  };
}
