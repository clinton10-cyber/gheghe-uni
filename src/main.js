import * as THREE from "three";
import { buildInterior } from "../game-assets/js/places/university/interior.js";
import { ThirdPersonControls } from "../game-assets/js/core/thirdperson.js";
import { Weapons } from "../game-assets/js/core/guns.js";
import { CampusProgress, RULES } from "./progress.js";
import { CampusLife, StudentProfile } from "./life.js";
import { GameQuality } from "./quality.js";

const $ = id => document.getElementById(id);
const esc = v => String(v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
const money = n => `₦${Number(n).toLocaleString("en-NG")}`;
const SHORT = { "computer-science": "CSC", "medicine": "MBBS", "law": "LAW", "business": "BUS", "mass-communication": "MAC" };
const HOWTO_KEY = "ghegeh_howto_v1";

/* ---------- renderer (a missing WebGL context used to leave a blank page) ---------- */
const canvas = $("game-canvas");
let renderer = null, rendererError = null;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: GameQuality.settings.antialias, powerPreference: "high-performance", alpha: false });
  renderer.setPixelRatio(GameQuality.settings.pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = GameQuality.settings.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
} catch (e) { rendererError = e; }

let campus = null, previous = performance.now(), toastTimer = null, hiddenTab = false;
let activeNpc = null, conversation = null, started = false, guideClock = 0;

/* ---------- campus mode: this is a university game, not a combat game ---------- */
ThirdPersonControls.prototype.toggleJet = function () {};
const _selectWeapon = Weapons.prototype.select;
Weapons.prototype.select = function (name) { return name === "fists" ? _selectWeapon.call(this, name) : undefined; };
Weapons.prototype.attack = function () {};
Weapons.prototype.cycle = function () {};
(function trimMenu() {
  const hud = window.__ph3d_hud;
  if (!hud || hud.__campus) return;
  const original = hud.sheet;
  hud.sheet = cfg => {
    if (cfg && Array.isArray(cfg.sections)) {
      cfg = { ...cfg, sections: cfg.sections
        .filter(s => !/weapon|fight/i.test(s.label || ""))
        .map(s => ({ ...s, items: (s.items || []).filter(i => !/gear shop|jetpack/i.test(i.label || "")) })) };
    }
    return original.call(hud, cfg);
  };
  hud.__campus = true;
})();

/* ---------- toast ---------- */
function toast(message) {
  const el = $("toast"); el.textContent = message; el.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}

window.__ph3d_phone = window.__ph3d_phone || { _toast: m => toast(m) };
const setText = (el, v) => { if (el && el.textContent !== v) el.textContent = v; };

/* ---------- sheets ---------- */
const PANELS = ["portal", "life", "market", "emotes", "settings", "howto", "dialog"];
const sheetEl = id => $("sheet-" + id);
const isOpen = id => !sheetEl(id).classList.contains("hidden") && sheetEl(id).classList.contains("on");
const anyOpen = () => PANELS.some(isOpen);
const modalOpen = () => anyOpen() || !$("register").classList.contains("hidden");
const closeTimers = {};
let lastFocus = null;
function openPanel(id) {
  if (!document.body.classList.contains("sheet-open")) lastFocus = document.activeElement;
  closeAll(id);
  const el = sheetEl(id); clearTimeout(closeTimers[id]);
  if (id === "portal") renderPortal();
  if (id === "life") renderLife();
  if (id === "market") renderMarket();
  if (id === "settings") renderSettings();
  el.classList.remove("hidden"); void el.offsetWidth; el.classList.add("on");
  document.body.classList.add("sheet-open");
  setTimeout(() => { const f = el.querySelector("[data-autofocus]") || el.querySelector(".h-sheet"); try { f && f.focus({ preventScroll: true }); } catch {} }, 60);
}
function closePanel(id) {
  const el = sheetEl(id); el.classList.remove("on");
  closeTimers[id] = setTimeout(() => { el.classList.add("hidden"); if (!PANELS.some(p => !sheetEl(p).classList.contains("hidden"))) { document.body.classList.remove("sheet-open"); try { if (lastFocus && document.contains(lastFocus) && lastFocus !== document.body) lastFocus.focus({ preventScroll: true }); } catch {} } }, 230);
  if (id === "life") activeNpc = null;
}
function closeAll(except) { PANELS.forEach(p => { if (p !== except && !sheetEl(p).classList.contains("hidden")) closePanel(p); }); }

/* ---------- in-game dialog (replaces window.confirm and short-lived result toasts) ---------- */
function showDialog({ title, big = "", text = "", tone = "", actions = [] }) {
  setText($("dialog-title"), title); const b = $("dialog-big"); b.textContent = big; b.className = "dlg-big " + tone;
  setText($("dialog-text"), text);
  const box = $("dialog-actions"); box.innerHTML = "";
  actions.forEach(a => {
    const btn = document.createElement("button"); btn.type = "button";
    btn.className = a.primary ? "btn-primary" + (a.danger ? " danger" : "") : "btn-ghost"; btn.textContent = a.label;
    if (a.primary) btn.dataset.autofocus = "";
    btn.addEventListener("click", () => { closePanel("dialog"); if (a.fn) a.fn(); });
    box.appendChild(btn);
  });
  openPanel("dialog");
}

/* ---------- player card ---------- */
let faceName = null;
function drawFace(name) {
  if (faceName === name) return; faceName = name;
  const c = $("pp-face"), g = c.getContext("2d"); if (!g) return;
  const grad = g.createLinearGradient(0, 0, 128, 128); grad.addColorStop(0, "#1d4a3a"); grad.addColorStop(1, "#0b1018");
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  g.fillStyle = "#ffc62b"; g.font = "800 66px Archivo, system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText((name || "S").trim().charAt(0).toUpperCase(), 64, 70);
}
function setMeter(key, value) {
  $("m-" + key).style.width = value + "%"; $("n-" + key).textContent = value;
}
function renderStatus() {
  const L = CampusLife.snapshot(), S = CampusProgress.snapshot(), P = StudentProfile.get();
  $("pp-name").textContent = P?.name || "Student";
  $("pp-level").textContent = S.programme ? (SHORT[S.programme.id] || "STUDENT") : "NEW";
  $("pp-cash").textContent = money(L.wallet);
  setMeter("en", L.energy); setMeter("mood", L.mood); setMeter("rep", L.reputation); setMeter("disc", L.discipline);
  document.querySelector(".pp-m-en").classList.toggle("low", L.energy <= 20);
  document.querySelector(".pp-m-mood").classList.toggle("low", L.mood <= 20);
  document.querySelector(".pp-m-disc").classList.toggle("low", L.discipline <= 35);
  $("suspension-banner").classList.toggle("hidden", !(started && L.suspended));
  drawFace(P?.name);
  updateGuide();
}

/* ---------- next-step guide ---------- */
const nearest = (ids) => {
  const uses = campus?.world?.uses; const pos = campus?.controls?.pos; if (!uses || !pos) return null;
  let best = null, bd = Infinity;
  for (const u of uses) { if (!ids.includes(u.activityId)) continue; const d = Math.hypot(u.x - pos.x, u.z - pos.z); if (d < bd) { bd = d; best = u; } }
  return best ? { use: best, dist: bd } : null;
};
function currentStep() {
  const S = CampusProgress.snapshot(), L = CampusLife.snapshot();
  if (L.suspended) return { title: "Attend a conduct meeting", sub: "Open People, then Conduct meeting", open: "life" };
  if (L.energy <= 15) return L.wallet >= 350
    ? { title: "You are tired. Get a meal", sub: "Cafeteria in the Student Union", ids: ["cafeteria"] }
    : { title: "You are tired. Rest", sub: "Student hostels", ids: ["hostel"] };
  if (!S.programme) return { title: "Apply for admission", sub: "Tap here to open your Student Portal", open: "portal" };
  if (S.canGraduate) return { title: "You can graduate!", sub: "Tap here, then press Graduate", open: "portal" };
  if (S.studyBank < RULES.studyPerExam) return { title: `Study at the Library (${S.studyBank}/${RULES.studyPerExam})`, sub: "Stand on the glowing spot, then tap Action", ids: ["library-study"] };
  if (S.lectureBank < RULES.lecturesPerExam) return { title: "Attend a lecture", sub: "Go to any faculty building", ids: ["lecture", "seminar"] };
  return { title: "Take your exam", sub: "Tap here to open your Student Portal", open: "portal" };
}
let guideStep = null;
let lastAnnounced = "";
function updateGuide() {
  const g = $("guide");
  if (!started) { g.classList.add("hidden"); return; }
  g.classList.remove("hidden");
  const step = currentStep(); guideStep = step;
  setText($("guide-title"), step.title);
  const arrow = $("guide-arrow");
  const found = step.ids ? nearest(step.ids) : null;
  let label = "NEXT STEP", sub = step.sub;
  if (found && campus?.camera) {
    const d = Math.round(found.dist);
    const here = found.dist <= (found.use.r || 3) + 1;
    if (here) sub = "You are here. Press the action button."; else label = `NEXT STEP · ${d} m`;
    arrow.classList.toggle("none", here);
    if (!here) {
      const v = new THREE.Vector3(found.use.x, 0, found.use.z).applyMatrix4(campus.camera.matrixWorldInverse);
      arrow.firstElementChild.style.transform = `rotate(${Math.atan2(v.x, -v.z)}rad)`;
    }
  } else arrow.classList.add("none");
  setText($("guide-label"), label); setText($("guide-sub"), sub); setText($("guide-dist"), "");
  const said = step.title + ". " + sub;
  if (said !== lastAnnounced) { lastAnnounced = said; setText($("guide-sr"), said); }
  document.querySelector('[data-open="portal"]').classList.toggle("attn", step.open === "portal");
  document.querySelector('[data-open="life"]').classList.toggle("attn", step.open === "life");
}

/* ---------- Student Portal ---------- */
function renderPortal() {
  const s = CampusProgress.snapshot(), P = StudentProfile.get();
  $("profile-summary").textContent = P ? `${P.name} · JAMB ${P.jamb}${s.programme ? " · " + s.programme.name : ""}` : "";
  const body = $("portal-body");
  if (!s.programme) {
    const jamb = Number(P?.jamb ?? -1);
    body.innerHTML = `<div class="sheet-h">Step 1 · Choose your programme</div>` +
      CampusProgress.programmes.map(p => { const ok = jamb >= p.minJamb; return `<div class="prog${ok ? "" : " locked"}"><b>${esc(p.name)}</b><span>${esc(p.faculty)}</span><span class="cut">JAMB cut-off ${p.minJamb}${ok ? "" : ` · yours is ${jamb < 0 ? "not set" : jamb}`}</span><button class="btn-sm" data-enrol="${esc(p.id)}"${ok ? "" : " disabled"}>${ok ? "Apply for admission" : "Score too low"}</button></div>`; }).join("") +
      (s.graduations.length ? `<div class="sheet-h">Your records</div>` + s.graduations.map(g => `<div class="record">🎓 ${esc(g.name)} · CGPA ${esc(g.cgpa)}</div>`).join("") : "");
    return;
  }
  const done1 = s.studyBank >= RULES.studyPerExam, done2 = s.lectureBank >= RULES.lecturesPerExam;
  const avgPct = s.scores.length ? Math.round(s.scores.reduce((a, b) => a + b, 0) / s.scores.length) : 0;
  const nowStep = s.canGraduate ? 5 : !done1 ? 1 : !done2 ? 2 : 3;
  const st = (n, title, desc, btn) => `<div class="step${nowStep > n ? " done" : ""}${nowStep === n ? " now" : ""}"><span class="n">${nowStep > n ? "✓" : (n === 5 ? 4 : n)}</span><div class="t"><b>${title}</b><span>${desc}</span></div>${btn || ""}</div>`;
  body.innerHTML =
    `<div class="tiles"><div class="tile"><small>CGPA</small><b>${s.cgpa}</b></div><div class="tile"><small>Credits</small><b>${s.credits}/${RULES.creditsToGraduate}</b></div><div class="tile"><small>Exams passed</small><b>${s.passed}/${RULES.examsToGraduate}</b></div></div>` +
    `<div class="bar-l"><span>${esc(s.programme.name)}</span><span>${s.percent}%</span></div><div class="bar"><i style="width:${s.percent}%"></i></div>` +
    `<div class="sheet-h">${s.canGraduate ? "You are ready to graduate" : `Exam ${Math.min(s.passed + 1, RULES.examsToGraduate)} of ${RULES.examsToGraduate} · what to do next`}</div>` +
    st(1, "Study at the Library", `${Math.min(s.studyBank, RULES.studyPerExam)}/${RULES.studyPerExam} sessions ready. Walk to the library and use the study spot.`, !done1 ? `<button class="btn-sm alt" data-act="where">Show me</button>` : "") +
    st(2, "Attend a lecture", `${Math.min(s.lectureBank, RULES.lecturesPerExam)}/${RULES.lecturesPerExam} ready. Visit any faculty building.`, done1 && !done2 ? `<button class="btn-sm alt" data-act="where">Show me</button>` : "") +
    st(3, "Take an exam", `Uses ${RULES.studyPerExam} study + ${RULES.lecturesPerExam} lecture. Pass mark ${RULES.passMark}% for +${RULES.creditsPerPass} credits.`, `<button class="btn-sm" data-act="exam"${s.examReady && s.credits < RULES.creditsToGraduate ? "" : " disabled"}>Take exam</button>`) +
    st(5, "Graduate", `Needs ${RULES.creditsToGraduate} credits and ${RULES.examsToGraduate} passed exams.`, `<button class="btn-sm" data-act="graduate"${s.canGraduate ? "" : " disabled"}>Graduate</button>`) +
    `<div class="sheet-h">Extra</div><div class="step"><span class="n">★</span><div class="t"><b>Scholarship ${money(RULES.scholarshipAward)}</b><span>Needs ${RULES.scholarshipPasses} passed exams (you have ${s.passed}), ${RULES.scholarshipStudy} study sessions (you have ${s.study}) and a ${RULES.scholarshipAverage}% average (yours: ${avgPct}%).${s.scholarship ? " Awarded." : ""}</span></div><button class="btn-sm" data-act="scholarship"${s.scholarship ? " disabled" : ""}>Apply</button></div>` +
    (s.graduations.length ? `<div class="sheet-h">Your records</div>` + s.graduations.map(g => `<div class="record">🎓 ${esc(g.name)} · CGPA ${esc(g.cgpa)}</div>`).join("") : "");
}

/* ---------- Campus Life ---------- */
const LIFE_ACTS = [
  ["hangout", "Hang out", "Mood up · −3 energy"], ["sports", "Sports club", "Mood up · −12 energy"],
  ["work", "Student job", "+₦1,800 · −15 energy"], ["party", "Campus party", "Mood up · −12 energy"],
  ["discipline", "Conduct meeting", "+8 discipline"]
];
function refreshLifeButtons() {
  document.querySelectorAll("#life-body [data-life]").forEach(b => {
    const a = CampusLife.availability(b.dataset.life), sub = b.querySelector(".h-tile-s");
    b.disabled = !a.ok; b.setAttribute("aria-disabled", String(!a.ok));
    setText(sub, a.ok ? b.dataset.sub : a.reason);
  });
}
function renderLife() {
  const sheet = document.querySelector("#sheet-life .h-sheet"), keep = isOpen("life");
  const prevScroll = keep && sheet ? sheet.scrollTop : 0, prevDraft = keep ? ($("chat-input")?.value || "") : "";
  const s = CampusLife.snapshot(), body = $("life-body");
  const stat = (l, v) => `<div class="tile"><small>${l}</small><b>${v}</b></div>`;
  body.innerHTML =
    `<div id="chat-wrap"></div>` +
    `<div class="tiles">${stat("Energy", s.energy + "%")}${stat("Mood", s.mood + "%")}${stat("Reputation", s.reputation)}${stat("Discipline", s.discipline)}${stat("Wallet", money(s.wallet))}${stat("Besties", s.bestieCount)}</div>` +
    `<div class="sheet-h">Do something</div><div class="acts">${LIFE_ACTS.map(([id, label, sub]) => `<button class="h-tile" data-life="${id}" data-sub="${esc(sub)}"><span class="h-tile-l">${label}</span><span class="h-tile-s">${sub}</span></button>`).join("")}</div>` +
    `<p class="note">Studying and lectures happen at the library and faculty buildings. Eat at the cafeteria, rest at the hostel.</p>` +
    `<div class="sheet-h">Join a group</div>` + CampusLife.factions.map(f => `<button class="fac${s.faction === f.id ? " on" : ""}" data-faction="${f.id}"><b>${esc(f.name)}${s.faction === f.id ? " · member" : ""}</b><small>${esc(f.desc)}</small></button>`).join("") +
    (s.faction ? `<button class="btn-ghost" data-leave type="button">Leave ${esc(s.factionInfo?.name || "group")}</button>` : "") +
    `<p class="note">Groups are fictional. The Secret Cult can get you suspended.</p>`;
  if (activeNpc) {
    const r = CampusLife.person(activeNpc);
    $("chat-wrap").innerHTML =
      `<div class="sheet-h" style="margin-top:4px">${esc(r.name)}${r.bestie ? " · bestie" : ""} <span style="font-weight:600">· friendship ${r.rapport}%</span></div>` +
      `<div class="chat" id="chat-log"></div><div class="chat-opts" id="chat-opts"></div>` +
      `<form class="chat-compose" id="chat-form"><input id="chat-input" maxlength="180" autocomplete="off" placeholder="Type a message…"><button class="btn-sm" type="submit" id="chat-send" disabled>Send</button></form>` +
      `<div class="acts" style="margin-top:10px"><button class="h-tile" data-social="study"><span class="h-tile-l">Study together</span><span class="h-tile-s">Counts as a study session</span></button><button class="h-tile" data-social="bestie"><span class="h-tile-l">Ask to be besties</span><span class="h-tile-s">Needs 3 chats</span></button></div>`;
    renderConversation();
    if (prevDraft && $("chat-input")) { $("chat-input").value = prevDraft; $("chat-send").disabled = !prevDraft.trim(); }
  }
  if (sheet && prevScroll) sheet.scrollTop = prevScroll;
  refreshLifeButtons();
}
function renderConversation() {
  const log = $("chat-log"), opts = $("chat-opts"); if (!log || !opts) return;
  if (!conversation) { log.innerHTML = `<div class="chat-line">Say hello.</div>`; opts.innerHTML = ""; return; }
  log.innerHTML = conversation.lines.map(x => `<div class="chat-line ${x.who}"><b>${x.who === "player" ? "YOU" : esc(conversation.name)}</b>${esc(x.text)}</div>`).join("");
  log.scrollTop = log.scrollHeight;
  opts.innerHTML = conversation.options.map((label, i) => `<button class="chip" data-topic="${i}">${esc(label)}</button>`).join("");
}
function startConversation(npc, topic = "intro") {
  activeNpc = npc; const r = CampusLife.chat(npc, topic);
  conversation = conversation && conversation.key === r.relationship.key ? conversation : { key: r.relationship.key, name: r.name, lines: [] };
  conversation.name = r.name; conversation.lines.push({ who: "npc", text: r.line }); conversation.options = r.options;
}
function chooseTopic(label){
  if(!activeNpc||!conversation)return;
  conversation.lines.push({who:"player",text:label});
  const lower=label.toLowerCase();let topic="campus";
  if(lower.includes("course")||lower.includes("department"))topic="course";
  else if(lower.includes("rumour")||lower.includes("gist")||lower.includes("story")||lower.includes("hear"))topic="rumours";
  else if(lower.includes("source")||lower.includes("who told")){const r=CampusLife.rumour(activeNpc,"source");conversation.lines.push({who:"npc",text:r.line});conversation.options=["How can we verify it?","Tell me another topic","Let's talk about academics","Change topic"];renderConversation();return;}
  else if(lower.includes("verify")||lower.includes("official")||lower.includes("noticeboard")||lower.includes("student affairs")){const r=CampusLife.rumour(activeNpc,"verify");conversation.lines.push({who:"npc",text:r.line});conversation.options=["Who was the source?","Tell me about campus events","Let's talk about academics","Change topic"];renderConversation();return;}
  else if(lower.includes("study")||lower.includes("test")||lower.includes("academic"))topic="academics";
  else if(lower.includes("event")||lower.includes("audition"))topic="events";
  else if(lower.includes("fun")||lower.includes("friend")||lower.includes("relax")||lower.includes("hang out"))topic="friendship";
  else if(lower.includes("aim")||lower.includes("plans")||lower.includes("semester"))topic="aim";
  const r=CampusLife.chat(activeNpc,topic);conversation.lines.push({who:"npc",text:r.line});conversation.options=r.options;
  if(topic==="rumours"){const rumour=CampusLife.rumour(activeNpc,"share");conversation.lines.push({who:"npc",text:rumour.line});conversation.options=["How can we verify it?","Who told you about it?","Let's talk about academics","Change topic"];}
  renderConversation();
}

function openLife(npc = null) {
  if (npc) {
    const key = CampusLife.person(npc).key; activeNpc = npc;
    if (!conversation || conversation.key !== key) { conversation = null; startConversation(npc, "intro"); }
  }
  openPanel("life");
}

/* ---------- campus activities (from the 3D world) ---------- */
const ACADEMIC_IDS = new Set(["library-study", "lecture", "seminar", "coding-lab", "science-lab", "workshop", "clinical", "pharmacy-lab", "dental-clinic", "field-practical", "media-studio", "arts-studio", "moot-court"]);
const PRACTICAL_IDS = ["coding-lab", "science-lab", "workshop", "clinical", "pharmacy-lab", "dental-clinic", "field-practical", "media-studio", "arts-studio"];
function doCampusActivity(id, title) {
  let r; const enrolled = !!CampusProgress.snapshot().programme;
  if (ACADEMIC_IDS.has(id) && CampusLife.suspended()) r = { ok: false, message: "You are suspended. Attend a conduct meeting in People first." };
  else if (id === "library-study") {
    if (!enrolled) r = { ok: false, message: "Apply for admission first. Open the Student portal." };
    else { r = CampusLife.activity("study"); if (r.ok) CampusProgress.activity("study"); }
  } else if (id === "lecture" || id === "seminar") {
    if (!enrolled) r = { ok: false, message: "Apply for admission first. Open the Student portal." };
    else { r = CampusLife.activity("lecture"); if (r.ok) CampusProgress.activity("lecture"); }
  } else if (PRACTICAL_IDS.includes(id)) {
    if (!enrolled) r = { ok: false, message: "Apply for admission first to record practicals." };
    else { r = CampusLife.activity("practical"); if (r.ok) CampusProgress.activity("study"); }
  } else if (id === "moot-court") {
    r = enrolled ? CampusLife.activity("practical") : { ok: false, message: "Apply for admission first." };
  } else if (id === "cafeteria") r = CampusLife.activity("meal");
  else if (id === "hostel") r = CampusLife.activity("rest");
  else if (id === "admin") { toast("Student Affairs. Your registration and results are in the Student portal."); openPanel("portal"); return; }
  else if (id === "social-hub") { toast("Student Union. Pick a group and meet people."); openPanel("life"); return; }
  else r = { ok: false, message: `${title} is not open yet.` };
  toast(r?.message || "Done.");
  renderStatus();
}

/* ---------- clothing market ---------- */
const CLOTHING_KEY="ghegeh_clothing_owned_v1", WORN_KEY="ghegeh_clothing_worn_v1";
const getWorn=()=>{try{return localStorage.getItem(WORN_KEY)||""}catch{return ""}};
const setWorn=id=>{try{localStorage.setItem(WORN_KEY,id)}catch{}};
const CLOTHING_STOCK=[
  {id:"hoodie-blue",name:"Campus Signature Hoodie",category:"TOP",price:6800,color:"#176a9b",look:{topStyle:"hoodie",topColor:"#176a9b",topPattern:"solid",topAccent:"#e8f5ff"}},
  {id:"ankara-shirt",name:"Ankara Streetwear Shirt",category:"TOP",price:5400,color:"#a12e4b",look:{topStyle:"dashiki",topColor:"#a12e4b",topPattern:"ankara",topAccent:"#e7bf53"}},
  {id:"varsity-jacket",name:"Ghegeh Varsity Jacket",category:"TOP",price:9200,color:"#173c62",look:{topStyle:"jacket",topColor:"#173c62",topPattern:"solid",topAccent:"#d8b45c"}},
  {id:"cargo-pants",name:"Utility Cargo Trousers",category:"BOTTOM",price:4900,color:"#58634a",look:{bottomStyle:"cargo",bottomColor:"#58634a",bottomPattern:"solid"}},
  {id:"denim-jeans",name:"Premium Denim Jeans",category:"BOTTOM",price:6200,color:"#315a91",look:{bottomStyle:"jeans",bottomColor:"#315a91",bottomPattern:"solid"}},
  {id:"street-sneakers",name:"Street Sneakers",category:"SHOES",price:7500,color:"#e9edf0",look:{shoeStyle:"sneakers",shoeColor:"#e9edf0"}},
  {id:"campus-tracksuit",name:"Campus Tracksuit Set",category:"SET",price:12500,color:"#126c61",look:{topStyle:"hoodie",topColor:"#126c61",topPattern:"solid",bottomStyle:"tracksuit",bottomColor:"#126c61",bottomPattern:"solid",shoeStyle:"sneakers",shoeColor:"#f3f3f3"}},
  {id:"formal-fit",name:"Faculty Formal Outfit",category:"SET",price:15800,color:"#222d40",look:{topStyle:"suit",topColor:"#222d40",topPattern:"solid",bottomStyle:"jeans",bottomColor:"#222d40",bottomPattern:"solid",shoeStyle:"formal",shoeColor:"#111111",tie:"classic"}}
];
function ownedClothes(){try{const v=JSON.parse(localStorage.getItem(CLOTHING_KEY)||"[]");return Array.isArray(v)?v.filter(id=>CLOTHING_STOCK.some(x=>x.id===id)):[]}catch{return []}}
function saveOwned(items){try{localStorage.setItem(CLOTHING_KEY,JSON.stringify(items))}catch{}}

function renderMarket() {
  const owned = ownedClothes(), wallet = CampusLife.snapshot().wallet;
  $("market-wallet").textContent = `Wallet ${money(wallet)}`;
  $("market-items").innerHTML = CLOTHING_STOCK.map(item => {
    const has = owned.includes(item.id), worn = getWorn() === item.id, short = item.price - wallet;
    const btn = has
      ? (worn ? `<button class="btn-sm alt" disabled>Worn</button>` : `<button class="btn-sm alt" data-clothing="${esc(item.id)}">Wear</button>`)
      : (short > 0 ? `<button class="btn-sm" disabled>Need ${money(short)} more</button>` : `<button class="btn-sm" data-clothing="${esc(item.id)}">Buy</button>`);
    return `<div class="market-item"><div class="sw" style="background:linear-gradient(135deg,${item.color},#0b1018 90%)"></div><b>${esc(item.name)}</b><small>${esc(item.category)} · ${money(item.price)}</small>${btn}</div>`;
  }).join("");
}

/* ---------- settings ---------- */
function renderSettings() {
  document.querySelectorAll("[data-quality]").forEach(b => b.classList.toggle("is-on", b.dataset.quality === GameQuality.level));
}
function doReset() {
  CampusProgress.reset(); CampusLife.reset(); StudentProfile.clear();
  try { localStorage.removeItem(CLOTHING_KEY); localStorage.removeItem(WORN_KEY); localStorage.removeItem(HOWTO_KEY); } catch {}
  location.reload();
}
function resetEverything() {
  showDialog({ title: "Start a new student?", text: "This erases your profile, grades, wallet, friends and purchases on this device. It cannot be undone.",
    actions: [{ label: "Erase and start over", primary: true, danger: true, fn: doReset }, { label: "Cancel" }] });
}

/* ---------- registration ---------- */
const MIN_JAMB = Math.min(...CampusProgress.programmes.map(p => p.minJamb));
function setupRegister() {
  const sel = $("f-course"), saved = StudentProfile.get();
  sel.innerHTML = CampusProgress.programmes.map(p => `<option value="${esc(p.id)}">${esc(p.name)} (cut-off ${p.minJamb})</option>`).join("");
  if (saved) {
    $("f-name").value = saved.name || ""; $("f-age").value = saved.age || 18; $("f-jamb").value = saved.jamb ?? "";
    const prog = CampusProgress.programmes.find(p => p.id === saved.programme || p.name === saved.course);
    if (prog) sel.value = prog.id;
    $("reg-go").textContent = `Continue as ${saved.name}`; $("reg-new").classList.remove("hidden");
  }
  const note = $("reg-note");
  const mark = (el, bad) => { if (bad) el.setAttribute("aria-invalid", "true"); else el.removeAttribute("aria-invalid"); };
  function check(final = false) {
    const jEl = $("f-jamb"), raw = jEl.value.trim(), jamb = Number(raw);
    const partial = !final && raw !== "" && raw.length < 3 && jamb < MIN_JAMB;
    const prev = CampusProgress.programmes.find(x => x.id === sel.value);
    for (const o of sel.options) { const p = CampusProgress.programmes.find(x => x.id === o.value); o.disabled = !partial && raw !== "" && jamb < p.minJamb; }
    let swap = "";
    if (!partial && sel.selectedOptions[0]?.disabled) {
      const ok = [...sel.options].find(o => !o.disabled);
      if (ok) { sel.value = ok.value; const now = CampusProgress.programmes.find(x => x.id === ok.value); swap = `${prev.name} needs a higher score, so we picked ${now.name}. `; }
    }
    const p = CampusProgress.programmes.find(x => x.id === sel.value);
    mark(jEl, false);
    if (raw === "") { note.className = "reg-note"; note.textContent = "Enter your JAMB score to see the courses you can apply for."; return false; }
    if (partial) { note.className = "reg-note"; note.textContent = "Keep typing your 3-digit JAMB score…"; return false; }
    if (!Number.isFinite(jamb) || jamb < 0 || jamb > 400) { mark(jEl, true); note.className = "reg-note bad"; note.textContent = "JAMB score must be between 0 and 400."; return false; }
    if (jamb < MIN_JAMB) { mark(jEl, true); note.className = "reg-note bad"; note.textContent = `No course here accepts a score below ${MIN_JAMB}.`; return false; }
    note.className = "reg-note ok"; note.textContent = `${swap}Your score meets the cut-off for ${p.name} (${p.minJamb}).`; return true;
  }
  $("f-jamb").addEventListener("input", () => check()); $("f-jamb").addEventListener("blur", () => check(true)); sel.addEventListener("change", () => check()); check();
  $("reg-new").addEventListener("click", resetEverything);
  $("profile-form").addEventListener("submit", e => {
    e.preventDefault();
    const name = $("f-name").value.replace(/\s+/g, " ").trim(), age = Number($("f-age").value);
    $("f-name").removeAttribute("aria-invalid"); $("f-age").removeAttribute("aria-invalid");
    if (!name) { $("f-name").setAttribute("aria-invalid", "true"); note.className = "reg-note bad"; note.textContent = "Please enter your name."; $("f-name").focus(); return; }
    if (!Number.isFinite(age) || age < 15 || age > 60) { note.className = "reg-note bad"; note.textContent = "Age must be between 15 and 60."; $("f-age").setAttribute("aria-invalid", "true"); $("f-age").focus(); return; }
    if (!check(true)) { $("f-jamb").focus(); return; }
    const prog = CampusProgress.programmes.find(x => x.id === sel.value);
    const prev = StudentProfile.get();
    StudentProfile.save({ name, age, jamb: Number($("f-jamb").value), course: prog.name, programme: prog.id, aim: prev?.aim || "", iq: prev?.iq ?? 100 });
    const adm = CampusProgress.enrol(prog.id);
    $("register").classList.add("hidden");
    started = true;
    $("player-panel").classList.remove("hidden"); $("dock").classList.remove("hidden");
    renderStatus();
    toast(adm.ok ? adm.message : `Welcome back, ${name}.`);
    if (!campus && !$("loading").classList.contains("failed")) { $("loading").classList.remove("hidden"); }
    let seen = null; try { seen = localStorage.getItem(HOWTO_KEY); } catch {}
    if (!seen) { try { localStorage.setItem(HOWTO_KEY, "1"); } catch {} setTimeout(() => openPanel("howto"), 700); }
  });
}
function showRegister() { $("register").classList.remove("hidden"); }

/* ---------- failure screen ---------- */
function fail(message) {
  window.__ghegehFailed = true;
  const o = $("loading"); o.classList.remove("hidden"); o.classList.add("failed");
  $("loading-title").textContent = "The campus could not load"; $("loading-copy").textContent = message;
  $("loader").classList.add("hidden"); $("loading-actions").classList.remove("hidden");
}

/* ---------- events ---------- */
function bindUI() {
  document.addEventListener("click", e => {
    const open = e.target.closest("[data-open]"); if (open) { openPanel(open.dataset.open); return; }
    const closeBtn = e.target.closest("[data-close]"); if (closeBtn) { const s = closeBtn.closest("[data-sheet]"); if (s) closePanel(s.id.replace("sheet-", "")); return; }
    if (e.target.matches("[data-sheet]")) closePanel(e.target.id.replace("sheet-", ""));
  });
  $("guide").addEventListener("click", () => { if (guideStep?.open) openPanel(guideStep.open); else toast("Follow the yellow arrow to the glowing spot, then press the action button."); });

  $("portal-body").addEventListener("click", e => {
    const en = e.target.closest("[data-enrol]");
    if (en) { const r = CampusProgress.enrol(en.dataset.enrol); toast(r.message); renderPortal(); renderStatus(); return; }
    const b = e.target.closest("[data-act]"); if (!b) return;
    const act = b.dataset.act;
    if (act === "where") { closePanel("portal"); toast("Follow the yellow arrow at the top of the screen."); return; }
    if (act === "exam") {
      if (CampusLife.suspended()) { toast("You are suspended. Attend a conduct meeting first."); return; }
      if (!CampusProgress.snapshot().examReady) { toast(CampusProgress.activity("exam").message); return; }
      const gate = CampusLife.activity("exam"); if (!gate.ok) { toast(gate.message); return; }
      const r = CampusProgress.activity("exam"), snap = CampusProgress.snapshot(); renderStatus();
      showDialog({ title: r.passed ? "Exam passed" : "Exam failed", big: `${r.score}%`, tone: r.passed ? "ok" : "bad",
        text: r.passed ? `${r.message} You now have ${snap.credits}/${RULES.creditsToGraduate} credits and ${snap.passed}/${RULES.examsToGraduate} exams passed.` : r.message,
        actions: [{ label: "Back to portal", primary: true, fn: () => openPanel("portal") }] });
      return;
    }
    if (act === "graduate") {
      const sn = CampusProgress.snapshot(); if (!sn.canGraduate || !sn.programme) { toast("You are not ready to graduate yet."); return; }
      showDialog({ title: "Graduate now?", text: `You will complete ${sn.programme.name} with a CGPA of ${sn.cgpa}. Your study progress resets and you can enrol in a new programme.`,
        actions: [{ label: "Graduate", primary: true, fn: () => { const g = CampusProgress.graduate(); renderStatus();
          showDialog({ title: "Congratulations!", big: "🎓", tone: "ok", text: g.message, actions: [{ label: "Continue", primary: true, fn: () => openPanel("portal") }] }); } },
          { label: "Not yet", fn: () => openPanel("portal") }] });
      return;
    }
    const r = CampusProgress.activity(act);
    if (r.ok && r.award) CampusLife.award(r.award, "Scholarship");
    toast(r.message); renderPortal(); renderStatus();
  });

  $("life-body").addEventListener("click", e => {
    const f = e.target.closest("[data-faction]");
    if (f) {
      const id = f.dataset.faction;
      if (id === "secret-cult" && CampusLife.snapshot().faction !== id) {
        showDialog({ title: "Join the Secret Cult?", text: "This fictional group costs 18 conduct points straight away and can get you suspended from class.",
          actions: [{ label: "Join anyway", primary: true, danger: true, fn: () => { toast(CampusLife.joinFaction(id).message); openPanel("life"); renderStatus(); } }, { label: "Cancel", fn: () => openPanel("life") }] });
        return;
      }
      toast(CampusLife.joinFaction(id).message); renderLife(); renderStatus(); return;
    }
    if (e.target.closest("[data-leave]")) { toast(CampusLife.leaveFaction().message); renderLife(); renderStatus(); return; }
    const t = e.target.closest("[data-topic]"); if (t && conversation) { chooseTopic(conversation.options[Number(t.dataset.topic)]); return; }
    const so = e.target.closest("[data-social]");
    if (so && activeNpc) {
      let r;
      if (so.dataset.social === "study") { r = CampusLife.inviteStudy(activeNpc); if (r.ok && r.study && CampusProgress.snapshot().programme) CampusProgress.activity("study"); }
      else r = CampusLife.bestie(activeNpc);
      toast(r.message); renderLife(); renderStatus(); return;
    }
    const a = e.target.closest("[data-life]");
    if (a) { toast(CampusLife.activity(a.dataset.life).message); renderLife(); renderStatus(); }
  });
  $("life-body").addEventListener("input", e => { if (e.target.id === "chat-input") $("chat-send").disabled = !e.target.value.trim(); });
  setInterval(() => { if (isOpen("life")) refreshLifeButtons(); }, 1000);
  $("life-body").addEventListener("submit", e => {
    if (e.target.id !== "chat-form") return; e.preventDefault();
    const input = $("chat-input"), message = input.value.trim();
    if (!activeNpc || !conversation || !message) return;
    conversation.lines.push({ who: "player", text: message });
    const r = CampusLife.respond(activeNpc, message); conversation.lines.push({ who: "npc", text: r.line }); conversation.options = r.options;
    input.value = ""; $("chat-send").disabled = true; renderConversation(); input.focus();
  });

  $("market-items").addEventListener("click", e => {
    const b = e.target.closest("[data-clothing]"); if (!b) return;
    const item = CLOTHING_STOCK.find(x => x.id === b.dataset.clothing); if (!item) return;
    const owned = ownedClothes();
    if (owned.includes(item.id)) { campus?.equipClothing(item.look); setWorn(item.id); renderMarket(); toast(`Now wearing ${item.name}.`); return; }
    const r = CampusLife.purchase(item.price, item.name); if (!r.ok) { toast(r.message); return; }
    owned.push(item.id); saveOwned(owned); setWorn(item.id); campus?.equipClothing(item.look); renderMarket(); renderStatus(); toast(r.message + " You are now wearing it.");
  });
  $("open-fitting").addEventListener("click", () => { closePanel("market"); if (campus?.openWardrobe) campus.openWardrobe(); else toast("The fitting room is still loading."); });

  $("emote-grid").addEventListener("click", e => { const b = e.target.closest("[data-emote]"); if (!b) return; closePanel("emotes"); if (campus?.playEmote) campus.playEmote(b.dataset.emote); else toast("Your character is getting ready."); });
  $("do-hug").addEventListener("click", () => { closePanel("emotes"); if (campus?.hug) campus.hug(); else toast("Stand next to a student first."); });
  $("do-handshake").addEventListener("click", () => { closePanel("emotes"); if (campus?.handshake) campus.handshake(); else toast("Stand next to a student first."); });

  document.querySelectorAll("[data-quality]").forEach(b => b.addEventListener("click", () => { GameQuality.set(b.dataset.quality, renderer); renderSettings(); toast(`Graphics set to ${GameQuality.level}.`); $("reload-quality").classList.remove("hidden"); }));
  $("reload-quality").addEventListener("click", () => location.reload());
  $("update-reload").addEventListener("click", () => location.reload());
  $("open-howto").addEventListener("click", () => openPanel("howto"));
  $("reset-btn").addEventListener("click", resetEverything);
  $("reload-btn").addEventListener("click", () => location.reload());
  const syncRun = () => { const on = !!campus?.controls?.runHold; $("uni-run").classList.toggle("is-on", on); $("uni-run").setAttribute("aria-pressed", String(on)); $("run-label").textContent = on ? "Running" : "Run"; };
  $("uni-run").addEventListener("click", () => { const c = campus?.controls; if (!c) return; c.runHold = !c.runHold; try { c._syncQuickMenuRun?.(); } catch {} syncRun(); toast(c.runHold ? "Running on" : "Running off"); });
  window.addEventListener("keydown", e => { if (e.code === "ShiftLeft" || e.code === "ShiftRight") setTimeout(syncRun, 0); });

  window.addEventListener("keydown", e => {
    const top = [...PANELS].reverse().find(isOpen);
    if (e.key === "Escape") { if (top) closePanel(top); return; }
    if (e.key === "Tab" && top) {
      const f = [...sheetEl(top).querySelectorAll("button:not([disabled]),input:not([disabled]),select,[tabindex='0']")].filter(x => x.offsetParent !== null);
      if (!f.length) { e.preventDefault(); return; }
      const first = f[0], last = f[f.length - 1], a = document.activeElement;
      if (e.shiftKey && (a === first || !sheetEl(top).contains(a))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (a === last || !sheetEl(top).contains(a))) { e.preventDefault(); first.focus(); }
    }
  });
  /* swipe a sheet down by its handle or header to close it */
  document.querySelectorAll("[data-sheet] .h-sheet").forEach(sheet => {
    let y0 = null, dy = 0;
    sheet.addEventListener("pointerdown", e => { if (!e.target.closest(".h-grab,.h-head") || e.target.closest(".h-x")) return; y0 = e.clientY; dy = 0; sheet.style.transition = "none"; try { sheet.setPointerCapture(e.pointerId); } catch {} });
    sheet.addEventListener("pointermove", e => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); sheet.style.transform = `translateY(${dy}px)`; });
    const end = () => { if (y0 == null) return; y0 = null; sheet.style.transition = ""; sheet.style.transform = ""; if (dy > 90) closePanel(sheet.parentElement.id.replace("sheet-", "")); };
    sheet.addEventListener("pointerup", end); sheet.addEventListener("pointercancel", end);
  });
  document.addEventListener("visibilitychange", () => { hiddenTab = document.hidden; previous = performance.now(); });
  window.addEventListener("resize", () => { renderer?.setSize(window.innerWidth, window.innerHeight); if (campus?.camera) { campus.camera.aspect = window.innerWidth / window.innerHeight; campus.camera.updateProjectionMatrix(); } });
  window.addEventListener("pagehide", e => { if (e.persisted) return; try { campus?.dispose(); renderer?.dispose(); } catch {} });
  window.addEventListener("error", e => { if (!campus && !started) return; if (!campus && !$("loading").classList.contains("hidden")) fail(String(e.message || "Unexpected error").slice(0, 240)); });
}

const router = {
  renderer, cinematic: false, go: () => {}, back: () => {},
  onNpcInteract(npc) { CampusLife.talk(npc); openLife(npc); },
  onCampusActivity(id, title) { doCampusActivity(id, title); },
  onOpenMarket() { openPanel("market"); }
};

async function start() {
  bindUI(); setupRegister(); renderStatus();
  const reveal = () => showRegister();
  if (window.__ghegehSplashDone || !$("ct-splash")) reveal(); else document.addEventListener("ghegeh:splash-done", reveal, { once: true });
  if (!renderer) { console.error("WebGL unavailable", rendererError); fail("Your browser could not start WebGL graphics. Update Chrome or Safari, turn on hardware acceleration, or try another device."); return; }
  const slow = setTimeout(() => { if (!campus) $("loading-copy").textContent = "Still building. The first load on a phone can take up to a minute."; }, 12000);
  try {
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    campus = await buildInterior(router); clearTimeout(slow);
    window.__ghegehReady = true; $("loading").classList.add("hidden");
    const tick = now => {
      requestAnimationFrame(tick);
      const dt = Math.min(.05, (now - previous) / 1000 || 0); previous = now;
      if (!hiddenTab && !modalOpen() && campus) { try { campus.update(dt); } catch (e) { console.warn("Campus update:", e); } }
      if (campus && !hiddenTab) renderer.render(campus.three, campus.camera);
      guideClock += dt; if (guideClock > .25) { guideClock = 0; if (started) updateGuide(); }
    };
    requestAnimationFrame(tick);
  } catch (err) { clearTimeout(slow); console.error("University Life failed to start", err); fail(String(err?.message || err).slice(0, 240)); }
}
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").then(reg => {
    reg.addEventListener("updatefound", () => { const w = reg.installing; w?.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) $("update-bar").classList.remove("hidden"); }); });
  }).catch(() => {}));
}
start();
