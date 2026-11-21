import * as THREE from "three";
import { buildInterior } from "../game-assets/js/places/university/interior.js";
import { CampusProgress } from "./progress.js";
import { CampusLife, StudentProfile } from "./life.js";
import { GameQuality } from "./quality.js";

const canvas = document.getElementById("game-canvas");
let renderer = null, rendererError = null;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: GameQuality.settings.antialias, powerPreference: "high-performance", alpha: false });
  renderer.setPixelRatio(GameQuality.settings.pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = GameQuality.settings.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
} catch (e) { rendererError = e; }
let campus = null, hiddenTab = false, previous = performance.now(), paused = false, toastTimer = null, activeNpc = null, conversation = null;
const $ = id => document.getElementById(id);
const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const portal = $("portal"), lifePanel = $("life-panel");

const modalOpen=()=>!portal.classList.contains("hidden")||!lifePanel.classList.contains("hidden");
function renderStatus(){
  const s=CampusLife.snapshot();
  const set=(id,v,low)=>{const el=$(id);if(!el)return;el.textContent=v;el.parentElement.classList.toggle("low",!!low);};
  set("st-energy",`${s.energy}%`,s.energy<=20);set("st-mood",`${s.mood}%`,s.mood<=20);
  set("st-wallet",`₦${s.wallet.toLocaleString("en-NG")}`,false);set("st-rep",String(s.reputation),false);
  $("suspension-banner").classList.toggle("hidden",!s.suspended);
}
function fail(message){$("loading").classList.remove("hidden");$("loading").classList.add("failed");$("loading-title").textContent="THE CAMPUS COULD NOT LOAD";$("loading-copy").textContent=message;$("loading-actions").classList.remove("hidden");$("loader").classList.add("hidden");}
function toast(message){const el=$("toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2800);}
function renderPortal(){
  const s=CampusProgress.snapshot();
  const profile=StudentProfile.get();
  $("profile-summary").textContent=profile?`${profile.name} · Age ${profile.age} · ${profile.course} · Aim: ${profile.aim} · JAMB ${profile.jamb} · IQ ${profile.iq}`:"Create your student profile to begin.";
  $("programme-name").textContent=s.programme?.name||"Not enrolled";
  $("cgpa").textContent=s.cgpa;
  $("credits").textContent=`${s.credits} / 12`;
  $("enrolment").classList.toggle("hidden",!!s.programme);
  $("student-actions").classList.toggle("hidden",!s.programme);
  $("progress-label").textContent=`${s.percent}%`;
  $("progress-bar").style.width=`${s.percent}%`;
  $("graduate-btn").disabled=!s.canGraduate;
  const jamb=Number(profile?.jamb??-1);
  $("programme-list").innerHTML=CampusProgress.programmes.map(p=>{const ok=jamb>=p.minJamb;return `<article class="programme${ok?"":" locked"}"><b>${escapeHTML(p.name)}</b><small>${escapeHTML(p.faculty)}<br>${p.courses.map(escapeHTML).join(" · ")}<br><em>JAMB cut-off: ${p.minJamb}</em></small><button data-enrol="${escapeHTML(p.id)}"${ok?"":" disabled"}>${ok?"APPLY FOR ADMISSION":"JAMB TOO LOW"}</button></article>`}).join("");
  $("objectives").innerHTML=[`Study sessions completed: ${s.study}/5`,`Lectures attended: ${s.lectures}/5`,`Examinations passed: ${s.passed}/3 (attempts: ${s.exams})`,`Exam prep banked: study ${s.studyBank}/2 · lectures ${s.lectureBank}/1`,`Credits earned: ${s.credits}/12`,`Scholarship: ${s.scholarship?"Awarded":"Not yet awarded"}`].concat((s.graduations||[]).map(g=>`Graduated: ${g.name} · CGPA ${g.cgpa}`)).map(x=>`<li>${escapeHTML(x)}</li>`).join("");
  renderStatus();
}
function renderLife(){
  const s=CampusLife.snapshot();renderStatus();
  const stat=(label,value)=>`<div class="life-stat"><small>${label}</small><b>${value}</b></div>`;
  $("life-stats").innerHTML=stat("ENERGY",`${s.energy}%`)+stat("MOOD",`${s.mood}%`)+stat("REPUTATION",s.reputation)+stat("DISCIPLINE",s.discipline)+stat("WALLET",`₦${s.wallet.toLocaleString("en-NG")}`)+stat("BESTIES",s.bestieCount);
  $("faction-list").innerHTML=CampusLife.factions.map(f=>`<button class="faction-card ${s.faction===f.id?"selected":""}" data-faction="${f.id}"><b>${f.name}${s.faction===f.id?" ✓":""}</b><small>${f.desc}</small></button>`).join("");
  $("leave-faction").disabled=!s.faction;
  if(activeNpc){const r=CampusLife.person(activeNpc);$("npc-social").hidden=false;$("npc-name").textContent=r.name+(r.bestie?" · BESTIE":"");$("npc-copy").textContent=`${r.talks} conversations · ${r.rapport}% friendship. Ask questions, follow up and build trust over time.`;renderConversation();}else{$("npc-social").hidden=true;}
}
function renderConversation(){
  const log=$("conversation-log"),topics=$("conversation-topics");
  if(!conversation){log.innerHTML="<div class=\"chat-line\">Start a conversation with this student.</div>";topics.innerHTML="";return;}
  log.innerHTML=conversation.lines.map(x=>`<div class="chat-line ${x.who}"><b>${x.who==="player"?"YOU":escapeHTML(conversation.name)}:</b> ${escapeHTML(x.text)}</div>`).join("");
  log.scrollTop=log.scrollHeight;
  topics.innerHTML=conversation.options.map((label,i)=>`<button data-topic="${i}">${escapeHTML(label)}</button>`).join("");
}
function startConversation(npc,topic="intro"){
  activeNpc=npc;const r=CampusLife.chat(npc,topic);conversation=conversation&&conversation.key===r.relationship.key?conversation:{key:r.relationship.key,name:r.name,lines:[]};
  conversation.name=r.name;conversation.lines.push({who:"npc",text:r.line});conversation.options=r.options;renderLife();
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
function openLife(npc=null){if(npc){activeNpc=npc;conversation=null;startConversation(npc,"intro");}renderLife();lifePanel.classList.remove("hidden");portal.classList.add("hidden");}
function closeLife(){lifePanel.classList.add("hidden");activeNpc=null;}
const ACADEMIC_IDS=new Set(["library-study","lecture","seminar","coding-lab","science-lab","workshop","clinical","pharmacy-lab","dental-clinic","field-practical","media-studio","arts-studio","moot-court"]);
function doCampusActivity(id,title){
  let r;
  const enrolled=!!CampusProgress.snapshot().programme;
  if(ACADEMIC_IDS.has(id)&&CampusLife.suspended()){r={ok:false,message:"You are on disciplinary suspension. Attend a student conduct meeting to continue."};}
  else if(id==="library-study"){
    if(!enrolled)r={ok:false,message:"Apply for admission before using the academic study facilities."};
    else {r=CampusLife.activity("study");if(r.ok)CampusProgress.activity("study");}
  }
  else if(id==="lecture"||id==="seminar"){
    if(!enrolled)r={ok:false,message:"You need to enrol before attending a recorded lecture."};
    else {r=CampusLife.activity("lecture");if(r.ok)CampusProgress.activity("lecture");}
  }
  else if(["coding-lab","science-lab","workshop","clinical","pharmacy-lab","dental-clinic","field-practical","media-studio","arts-studio"].includes(id)){
    if(!enrolled)r={ok:false,message:"Enrol first to record this practical towards your degree."};
    else {r=CampusLife.activity("practical");if(r.ok)CampusProgress.activity("study");}
  }
  else if(id==="cafeteria")r=CampusLife.activity("meal");
  else if(id==="hostel")r=CampusLife.activity("rest");
  else if(id==="admin"){toast("Student Affairs: registration, course advice and student support.");openLife();return;}
  else if(id==="social-hub"){toast("You found the campus social hub. Choose your circle and meet new people.");openLife();return;}
  else if(id==="moot-court"){if(!enrolled)r={ok:false,message:"Enrol first to take part in the moot court."};else r=CampusLife.activity("practical");}
  else r={ok:false,message:`${title} is not available yet.`};
  toast(r?.message||"Activity completed.");renderLife();renderPortal();
}
const CLOTHING_KEY="ghegeh_clothing_owned_v1";
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
function renderMarket(){const owned=ownedClothes(),wallet=CampusLife.snapshot().wallet;$("market-wallet").textContent=`YOUR WALLET  ·  ₦${wallet.toLocaleString("en-NG")}`;$("market-items").innerHTML=CLOTHING_STOCK.map(item=>{const has=owned.includes(item.id);return `<article class="market-item"><div class="swatch" style="background:linear-gradient(135deg,${item.color},#0b1826 88%)"></div><b>${item.name}</b><small>${item.category} · ₦${item.price.toLocaleString("en-NG")}</small><button class="${has?"owned":""}" data-clothing="${item.id}" data-owned="${has}">${has?"WEAR ITEM":"BUY ITEM"}</button></article>`}).join("")}
function openMarket(){renderMarket();$("market-panel").classList.remove("hidden");$("emote-panel").classList.add("hidden")}
function bindActionHud(){
  $("hud-style").addEventListener("click",()=>{if(campus?.openWardrobe)campus.openWardrobe();else toast("The fitting studio is loading.")});
  $("hud-market").addEventListener("click",openMarket);
  $("hud-emotes").addEventListener("click",()=>$("emote-panel").classList.toggle("hidden"));
  $("close-emotes").addEventListener("click",()=>$("emote-panel").classList.add("hidden"));
  $("hud-handshake").addEventListener("click",()=>{if(campus?.handshake)campus.handshake();else toast("Find a student nearby first.")});
  $("emote-panel").addEventListener("click",e=>{const b=e.target.closest("[data-emote]");if(!b)return;if(campus?.playEmote)campus.playEmote(b.dataset.emote);else toast("Your character is getting ready.")});
  $("close-market").addEventListener("click",()=>$("market-panel").classList.add("hidden"));
  $("market-done").addEventListener("click",()=>$("market-panel").classList.add("hidden"));
  $("market-items").addEventListener("click",e=>{const b=e.target.closest("[data-clothing]");if(!b)return;const item=CLOTHING_STOCK.find(x=>x.id===b.dataset.clothing);if(!item)return;let owned=ownedClothes();
    if(owned.includes(item.id)){campus?.equipClothing(item.look);toast(`Now wearing ${item.name}.`);return;}
    const r=CampusLife.purchase(item.price,item.name);if(!r.ok){toast(r.message);return;}owned.push(item.id);saveOwned(owned);renderMarket();renderLife();toast(r.message+" You can wear it now.");campus?.equipClothing(item.look);
  });
}

function bindPortal(){
  bindActionHud();
  $("profile-form").addEventListener("submit",e=>{e.preventDefault();const f=new FormData(e.currentTarget);const data=Object.fromEntries(f.entries());
    data.age=Number(data.age);data.iq=Number(data.iq);data.jamb=Number(data.jamb);
    const bad=(v,a,b)=>!Number.isFinite(v)||v<a||v>b;
    if(!String(data.name||"").trim()){toast("Please enter your character name.");return;}
    if(bad(data.age,15,60)||bad(data.iq,50,200)||bad(data.jamb,0,400)){toast("Please check your age (15–60), IQ (50–200) and JAMB score (0–400).");return;}
    const profile=StudentProfile.save(data);$("start-screen").classList.add("hidden");$("mission-title").textContent=`Welcome, ${profile.name}`;const jambPath=profile.jamb>=200?"strong JAMB profile":profile.jamb>=160?"developing JAMB profile":"foundation-focused JAMB profile";$("mission-copy").textContent=`${profile.course} · ${profile.aim} · ${jambPath} (${profile.jamb}). Your university story begins now.`;toast(`Welcome to Ghegeh University, ${profile.name}.`);
  });
  const savedProfile=StudentProfile.get();if(savedProfile){for(const [k,v] of Object.entries(savedProfile)){const field=$("profile-form").elements.namedItem(k);if(field&&k!=="createdAt")field.value=v;}$("profile-form").querySelector(".start-button").innerHTML="CONTINUE MY GHEGEH UNIVERSITY LIFE <span>→</span>";}
  $("portal-btn").addEventListener("click",()=>{renderPortal();portal.classList.remove("hidden");lifePanel.classList.add("hidden");});
  $("close-portal").addEventListener("click",()=>portal.classList.add("hidden"));
  $("programme-list").addEventListener("click",e=>{const b=e.target.closest("[data-enrol]");if(!b)return;const r=CampusProgress.enrol(b.dataset.enrol);toast(r.message);renderPortal();});
  $("student-actions").addEventListener("click",e=>{
    const b=e.target.closest("[data-action]");if(!b)return;const act=b.dataset.action;
    if(act==="study"){toast("Study sessions are earned in person: walk to the University Library and use the study spot.");return;}
    if(act==="lecture"){toast("Lectures are earned in person: visit a faculty building and use the lecture spot.");return;}
    if(act==="exam"){
      if(CampusLife.suspended()){toast("You are on disciplinary suspension. Attend a student conduct meeting first.");return;}
      const pre=CampusProgress.snapshot();
      if(!pre.examReady){toast(CampusProgress.activity("exam").message);return;}
      const gate=CampusLife.activity("exam");if(!gate.ok){toast(gate.message);return;}
      const r=CampusProgress.activity("exam");toast(r.message);renderLife();renderPortal();return;
    }
    const r=CampusProgress.activity(act);if(r.ok&&r.award)CampusLife.award(r.award,"Scholarship");toast(r.message);renderLife();renderPortal();
  });
  $("reset-btn").addEventListener("click",()=>{
    if(!window.confirm("Start a brand-new student? This erases your profile, grades, wallet, friendships and purchases on this device."))return;
    CampusProgress.reset();CampusLife.reset();StudentProfile.clear();
    try{localStorage.removeItem(CLOTHING_KEY);}catch{}
    location.reload();
  });
  $("graduate-btn").addEventListener("click",()=>{const r=CampusProgress.graduate();toast(r.message);renderPortal();});
  $("pause-btn").addEventListener("click",()=>{paused=!paused;$("pause-btn").textContent=paused?"▶":"Ⅱ";toast(paused?"Game paused":"Welcome back");});
  $("quality-select").value=GameQuality.level;
  $("quality-select").addEventListener("change",e=>{GameQuality.set(e.target.value,renderer);toast(`Graphics quality: ${GameQuality.level.toUpperCase()}. Reload to apply scene-wide settings.`);});
  $("life-btn").addEventListener("click",()=>openLife());
  window.addEventListener("keydown",e=>{if(e.key!=="Escape")return;if(!$("market-panel").classList.contains("hidden"))$("market-panel").classList.add("hidden");else if(!lifePanel.classList.contains("hidden"))closeLife();else if(!portal.classList.contains("hidden"))portal.classList.add("hidden");else if(!$("emote-panel").classList.contains("hidden"))$("emote-panel").classList.add("hidden");});
  document.addEventListener("visibilitychange",()=>{hiddenTab=document.hidden;previous=performance.now();});
  const coarse=window.matchMedia?.("(pointer:coarse)").matches;
  $("hint-text").textContent=coarse?"LEFT STICK: MOVE · DRAG RIGHT: LOOK · TAP ACTION BUTTON TO INTERACT":"WASD / ARROWS: MOVE · DRAG MOUSE: LOOK · E: INTERACT · ESC: CLOSE MENUS";
  $("close-life").addEventListener("click",closeLife);
  lifePanel.addEventListener("click",e=>{
    const f=e.target.closest("[data-faction]");if(f){const r=CampusLife.joinFaction(f.dataset.faction);toast(r.message);renderLife();return;}
    const topic=e.target.closest("[data-topic]");if(topic&&conversation){chooseTopic(conversation.options[Number(topic.dataset.topic)]);return;}
    const social=e.target.closest("[data-social]");if(social&&activeNpc){let r;if(social.dataset.social==="chat"){CampusLife.talk(activeNpc);startConversation(activeNpc,"intro");try{window.__ph3d_walkCtrl?.playEmote("wave");}catch{}toast(`You continued your conversation with ${CampusLife.person(activeNpc).name}.`);}else if(social.dataset.social==="study"){r=CampusLife.inviteStudy(activeNpc);if(r.ok&&r.study&&CampusProgress.snapshot().programme)CampusProgress.activity("study");toast(r.message);}else{r=CampusLife.bestie(activeNpc);toast(r.message);}renderLife();return;}
    const action=e.target.closest("[data-life]");if(action){const r=CampusLife.activity(action.dataset.life);toast(r.message);renderLife();}
  });
  $("chat-form").addEventListener("submit",e=>{e.preventDefault();if(!activeNpc||!conversation)return;const input=$("chat-input"),message=input.value.trim();if(!message)return;conversation.lines.push({who:"player",text:message});const r=CampusLife.respond(activeNpc,message);conversation.lines.push({who:"npc",text:r.line});conversation.options=r.options;input.value="";renderConversation();});
  $("leave-faction").addEventListener("click",()=>{const r=CampusLife.leaveFaction();toast(r.message);renderLife();});
}

const router={renderer,cinematic:false,go:()=>{},back:()=>{},
  onNpcInteract(npc){const r=CampusLife.talk(npc);toast(`You greeted ${r.name}. Friendship: ${r.rapport}%`);openLife(npc);},
  onCampusActivity(id,title){doCampusActivity(id,title);},
  onOpenMarket(){openMarket();}
};
async function start(){
  bindPortal();renderStatus();
  if(!renderer){
    console.error("WebGL unavailable",rendererError);
    fail("Your browser or device could not start WebGL graphics. Update Chrome/Safari, turn on hardware acceleration, or try another device.");
    return;
  }
  const slow=setTimeout(()=>{if(!campus)$("loading-copy").textContent="Still building the campus. First load on a phone can take up to a minute…";},12000);
  try {
    $("loading-copy").textContent = "Preparing Ghegeh University roads, faculties and student life…";
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    campus = await buildInterior(router);
    clearTimeout(slow);
    $("loading").classList.add("hidden");
    $("mission-title").textContent="Welcome to Ghegeh University";
    $("mission-copy").textContent="Explore the real campus, enter named faculties, attend practicals, meet students, build friendships and choose your own path.";
    const tick = now => {
      requestAnimationFrame(tick);
      const dt=Math.min(.05,(now-previous)/1000||0); previous=now;
      // The world freezes while a menu is open or the tab is hidden, so NPCs and cars cannot move on without you.
      if(!paused&&!hiddenTab&&!modalOpen()&&campus){try{campus.update(dt);}catch(e){console.warn("Campus update:",e);}}
      if(campus&&!hiddenTab)renderer.render(campus.three,campus.camera);
    };
    requestAnimationFrame(tick);
  } catch(err) {
    clearTimeout(slow);
    console.error("University Life failed to start",err);
    fail(String(err?.message||err).slice(0,240));
  }
}
$("reload-btn")?.addEventListener("click",()=>location.reload());
window.addEventListener("error",e=>{if(!campus&&$("loading")&&!$("loading").classList.contains("hidden"))fail(String(e.message||"Unexpected error").slice(0,240));});
window.addEventListener("unhandledrejection",e=>{if(!campus&&!$("loading").classList.contains("hidden"))fail(String(e.reason?.message||e.reason||"Unexpected error").slice(0,240));});
window.addEventListener("resize",()=>{renderer?.setSize(window.innerWidth,window.innerHeight);if(campus?.camera){campus.camera.aspect=window.innerWidth/window.innerHeight;campus.camera.updateProjectionMatrix();}});
window.addEventListener("pagehide",e=>{if(e.persisted)return;try{campus?.dispose();renderer?.dispose();}catch{}});
if("serviceWorker" in navigator && location.protocol.startsWith("http")){
  window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").then(reg=>{
    reg.addEventListener("updatefound",()=>{const w=reg.installing;w?.addEventListener("statechange",()=>{if(w.state==="installed"&&navigator.serviceWorker.controller)toast("A new version is ready. Reload to update.");});});
  }).catch(()=>{}));
}
start();
