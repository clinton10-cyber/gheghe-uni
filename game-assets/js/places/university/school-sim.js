/* school-sim.js -- the class-session loop that makes the campus feel like a school sim.

   Flow of every classroom:
     waiting  -> students queue in the corridor outside the door, a lecturer stands at the board
     lesson   -> bell: students walk in through the door, sit at their desks, the lecturer teaches.
                 One desk is ALWAYS left empty for the player (marked with a green glow).
                 Sit there and stay for a couple of minutes to be marked present.
     break    -> bell: everyone stands up and walks back out to the corridor, then it repeats.
   Class seats are kept out of the NPCs' random-sit list so nobody steals the player's seat. */

const LESSON = 150;       // seconds a lesson lasts
const REQUIRED = 120;     // seconds the player must stay seated to be marked present
const BREAK = 40;         // seconds between lessons
const EXTEND_MAX = 90;    // lesson is extended (max) so a seated player can always finish

const fmt = (s) => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const TEACHER_LINES = [
  "Settle down, class is in session.",
  "Take notes. This will be in the exam.",
  "Good, you are on time. Stay for the whole lecture.",
  "Attendance counts toward your credits. Sit and listen.",
  "Questions at the end, please."
];

export function createSchoolSim({ THREE, scene, NPCs, world, router, toast, getCtl, spawn }) {
  const classes = [];
  let hud = null, hudBar = null, hudTxt = null, hudSub = null, clock = 0;

  function ensureHud() {
    if (hud || typeof document === "undefined") return;
    hud = document.createElement("div");
    hud.id = "classHud";
    hud.style.cssText = "position:fixed;left:50%;top:64px;transform:translateX(-50%);z-index:40;min-width:230px;max-width:86vw;" +
      "padding:8px 14px 10px;border-radius:12px;background:rgba(14,28,38,.86);color:#fff;font:600 13px/1.25 Inter,system-ui,sans-serif;" +
      "text-align:center;box-shadow:0 4px 18px rgba(0,0,0,.35);border:1px solid rgba(217,183,74,.55);pointer-events:none;display:none";
    hudTxt = document.createElement("div");
    hudSub = document.createElement("div"); hudSub.style.cssText = "font-weight:500;opacity:.8;font-size:11.5px;margin-top:2px";
    const track = document.createElement("div"); track.style.cssText = "height:6px;border-radius:4px;background:rgba(255,255,255,.18);margin-top:7px;overflow:hidden";
    hudBar = document.createElement("div"); hudBar.style.cssText = "height:100%;width:0;background:#5fd38d;transition:width .3s";
    track.appendChild(hudBar); hud.append(hudTxt, hudSub, track); document.body.appendChild(hud);
  }

  function addClass(def) {
    const cls = {
      ...def, phase: "waiting", t: 4 + Math.random() * 14, ext: 0, playerTime: 0, away: 0, credited: false,
      students: [], teacherNpc: null, glow: null, marker: null
    };
    for (const s of cls.seats) { s.classId = cls.id; }
    cls.playerSeat.reserved = true;
    // green glow disc on the seat reserved for the player
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.34, 24),
      new THREE.MeshBasicMaterial({ color: 0x4dff91, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }));
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(cls.playerSeat.x, cls.playerSeat.h + 0.02, cls.playerSeat.z);
    scene.add(disc); cls.glow = disc;
    // doorway prompt
    cls.marker = {
      x: cls.door.x, z: cls.door.z, r: 3.4, level: cls.level || 0, kind: "use",
      label: "CLASSROOM", onUse: () => {
        const ph = cls.phase;
        if (cls.credited) toast(`You are marked present for this lecture (${cls.name}).`);
        else if (ph === "lesson") toast(`Lecture in progress. Sit in the green-glowing desk (${cls.playerSeat.where}) and stay ${fmt(REQUIRED)}.`);
        else if (ph === "break") toast(`Class is out. The next lecture starts in ${fmt(cls.t)}.`);
        else toast(`Students are gathering. Lecture starts in ${fmt(cls.t)}.`);
      }
    };
    world.uses.push(cls.marker);
    classes.push(cls);
    return cls;
  }

  function populate(studentCap) {
    for (const cls of classes) {
      const free = cls.seats.filter(s => s !== cls.playerSeat);
      const n = Math.max(2, Math.min(studentCap, free.length - 2));   // always leaves several empty desks
      for (let i = 0; i < n; i++) {
        const w = cls.wait[i % cls.wait.length];
        const npc = spawn("student", w.x, w.z);
        if (npc) { npc._school = cls.id; cls.students.push({ npc, seat: null, walk: 0, cool: Math.random() * 2, spot: w }); }
      }
      const tnpc = spawn("clerk", cls.teacher.x, cls.teacher.z, {
        label: "TALK TO LECTURER",
        onUse: () => toast("Lecturer: " + TEACHER_LINES[Math.floor(Math.random() * TEACHER_LINES.length)])
      });
      if (tnpc) { tnpc._school = cls.id; tnpc._teacher = true; cls.teacherNpc = tnpc; }
    }
  }

  function startLesson(cls) {
    cls.phase = "lesson"; cls.t = LESSON; cls.ext = 0; cls.credited = false; cls.playerTime = 0; cls.away = 0;
    const seats = shuffle(cls.seats.filter(s => s !== cls.playerSeat));
    cls.students.forEach((st, i) => { st.seat = seats[i] || null; st.walk = 0; });
    cls.students.forEach(st => assign(st));
  }
  function assign(st) {
    const n = st.npc; if (!n || n.dead || !st.seat) return;
    if (n.seatTarget && n.seatTarget !== st.seat) n.seatTarget.taken = false;
    st.seat.taken = true; n.seatTarget = st.seat; n.state = "goSeat"; n.stateT = 40; n.moveSpeed = 0;
  }
  function endLesson(cls) {
    cls.phase = "break"; cls.t = BREAK;
    for (const st of cls.students) {
      const n = st.npc; if (!n) continue;
      if (st.seat) st.seat.taken = false;
      if (n.state === "sitting") n.stateT = 0;           // stands up on the next tick
      else if (n.state === "goSeat") { n.seatTarget = null; n.state = "idle"; n.stateT = 0.3; }
      st.cool = 0;
    }
    if (cls.credited) toast("Lecture over. You were marked present.");
    else if (cls.playerTime > 0) toast("Lecture over. You did not stay long enough to be marked present.");
  }

  function update(dt) {
    clock += dt;
    const ctl = getCtl();
    let hudShown = false;
    for (const cls of classes) {
      cls.t -= dt;
      const sit = ctl && ctl.sitTarget;
      const seatedHere = !!(sit && sit.classId === cls.id && ctl.state === "sitting");

      if (cls.phase === "waiting" && cls.t <= 0) startLesson(cls);
      else if (cls.phase === "lesson" && cls.t <= 0) {
        if (seatedHere && !cls.credited && cls.ext < EXTEND_MAX) { cls.ext += dt; cls.t = 0; }
        else endLesson(cls);
      } else if (cls.phase === "break" && cls.t <= 0) { cls.phase = "waiting"; cls.t = 8; }

      /* lecturer stays at the board, facing the class */
      const T = cls.teacherNpc;
      if (T && !T.dead && T.state !== "talk") {
        T.state = "idle"; T.stateT = 6; T.moveSpeed = 0;
        T.ctl.pos.x = cls.teacher.x; T.ctl.pos.z = cls.teacher.z; T.yawTarget = 0;
      }

      /* students */
      for (const st of cls.students) {
        const n = st.npc; if (!n || n.dead) continue;
        if (cls.phase === "lesson") {
          if (n.state === "goSeat" || n.state === "sitting") {
            n.stateT = Math.max(n.stateT, 6);
            if (n.state === "goSeat") {
              st.walk += dt;
              if (st.walk > 38 && st.seat) {               // stuck: snap into the seat
                n.ctl.pos.x = st.seat.x; n.ctl.pos.z = st.seat.z; n.ctl.yaw = n.yawTarget = st.seat.yaw;
                n.state = "sitting"; n.stateT = 30; n.seatTarget = st.seat; st.seat.taken = true;
              }
            } else st.walk = 0;
          } else if (n.state !== "talk" && n.state !== "downed" && !(typeof n.state === "string" && n.state.startsWith("life_"))) {
            assign(st);
          }
        } else {
          st.cool -= dt;
          if (st.cool <= 0 && (n.state === "idle" || n.state === "walk" || n.state === "stroll")) {
            const dx = st.spot.x - n.ctl.pos.x, dz = st.spot.z - n.ctl.pos.z;
            if (dx * dx + dz * dz > 2.2 * 2.2) {
              n.state = "stroll"; n.strollX = st.spot.x; n.strollZ = st.spot.z; n.strollSp = 1.5; n.stateT = 25;
            }
            st.cool = 3;
          }
        }
      }

      /* the player's attendance */
      if (cls.phase === "lesson" && !cls.credited) {
        if (seatedHere) {
          cls.playerTime += dt; cls.away = 0;
          if (cls.playerTime >= REQUIRED) {
            cls.credited = true;
            router.onCampusActivity?.(cls.activity, cls.title);
          }
        } else if (cls.playerTime > 0) {
          cls.away += dt;
          if (cls.away > 4) { cls.playerTime = 0; cls.away = 0; toast("You left class early. Sit down and stay to be marked present."); }
        }
      }

      /* labels, glow, hud */
      cls.marker.label = cls.phase === "lesson" ? (cls.credited ? "LECTURE · PRESENT ✓" : "LECTURE IN SESSION · SIT IN THE GREEN DESK")
        : cls.phase === "break" ? "CLASS OUT · NEXT LECTURE " + fmt(cls.t) : "LECTURE STARTS " + fmt(cls.t);
      cls.glow.visible = cls.phase !== "break" && !seatedHere && !cls.credited;
      if (cls.glow.visible) cls.glow.material.opacity = 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(clock * 4));

      if (seatedHere && !hudShown) {
        ensureHud(); hudShown = true;
        hud.style.display = "block";
        if (cls.phase === "lesson") {
          hudTxt.textContent = cls.credited ? `✔ Present · ${cls.name}` : `📚 ${cls.name} · stay seated ${fmt(Math.max(0, REQUIRED - cls.playerTime))}`;
          hudSub.textContent = cls.credited ? "Lecture credit recorded." : "Don't stand up or you'll be marked absent.";
          hudBar.style.width = Math.min(100, (cls.credited ? 1 : cls.playerTime / REQUIRED) * 100) + "%";
        } else {
          hudTxt.textContent = `${cls.name} · waiting for the lecturer`;
          hudSub.textContent = cls.phase === "break" ? `Next lecture in ${fmt(cls.t)}` : `Starts in ${fmt(cls.t)}`;
          hudBar.style.width = "0%";
        }
      }
    }
    if (!hudShown && hud) hud.style.display = "none";
  }

  function dispose() {
    for (const cls of classes) {
      scene.remove(cls.glow); cls.glow.geometry.dispose(); cls.glow.material.dispose();
      for (const s of cls.seats) s.taken = false;
    }
    if (hud) { hud.remove(); hud = null; }
    classes.length = 0;
  }
  return { addClass, populate, update, dispose, classes };
}
