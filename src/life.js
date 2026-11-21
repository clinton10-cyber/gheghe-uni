// Campus social life, wallet and student standing.
// v2 hardening: sanitised saves, energy gating, cooldowns (no more infinite money /
// instant besties), reversible faction bonuses and a capped history log.
const KEY = "university_life_social_v2";
const OLD_KEY = "university_life_social_v1";
const FIRST = ["Ada", "Chika", "Tomi", "Zara", "Kelechi", "Mariam", "Favour", "David", "Amara", "Daniel", "Ife", "Samuel", "Nneka", "Dami", "Tari", "Precious"];
const LAST = ["Okoro", "Bello", "Eze", "James", "Udo", "Adebayo", "Nwosu", "Cole", "Ibrahim", "Mensah", "Obi", "George"];
const FACTIONS = [
  {id:"student-union",name:"Student Union",kind:"club",desc:"Represent students, organize events and build campus reputation."},
  {id:"campus-crew",name:"Campus Crew",kind:"crew",desc:"A streetwise social circle. Gain influence, but rivalries can affect your reputation."},
  {id:"secret-cult",name:"Secret Cult",kind:"secret",desc:"A fictional clandestine group. Membership brings pressure, disciplinary risk and difficult choices."},
  {id:"sports-club",name:"Sports Club",kind:"club",desc:"Train, compete and build teamwork and fitness."},
  {id:"tech-society",name:"Technology Society",kind:"club",desc:"Build projects, join coding sessions and meet future collaborators."}
];
export const LIFE_RULES = Object.freeze({
  suspensionAt: 20,       // discipline at or below this blocks academic activity
  maxWallet: 9999999,
  historyLimit: 60,
  talkGapMs: 15000        // minimum gap before a repeat chat raises friendship again
});
// energy cost + cooldown (ms) per activity
const COSTS = {
  study:{e:8,cd:6000}, lecture:{e:4,cd:6000}, practical:{e:9,cd:6000},
  hangout:{e:3,cd:20000}, party:{e:12,cd:60000}, work:{e:15,cd:45000},
  sports:{e:12,cd:30000}, exam:{e:10,cd:10000}, meal:{e:0,cd:8000}, rest:{e:0,cd:60000}, discipline:{e:0,cd:120000}
};
const clamp = (n, a = 0, b = 100) => Math.max(a, Math.min(b, Number.isFinite(+n) ? +n : a));
const int = (n, a, b, d = a) => Number.isFinite(+n) ? Math.round(clamp(n, a, b)) : d;
const fresh = () => ({v:2,wallet:45000,energy:82,mood:72,reputation:50,discipline:80,study:0,practical:0,hangouts:0,parties:0,faction:null,factionBonus:{rep:0},besties:[],relationships:{},history:[],cooldowns:{}});
function sanitise(raw) {
  const s = fresh(); if (!raw || typeof raw !== "object") return s;
  s.wallet = int(raw.wallet, 0, LIFE_RULES.maxWallet, 45000);
  s.energy = int(raw.energy, 0, 100, 82); s.mood = int(raw.mood, 0, 100, 72);
  s.reputation = int(raw.reputation, 0, 100, 50); s.discipline = int(raw.discipline, 0, 100, 80);
  for (const k of ["study", "practical", "hangouts", "parties"]) s[k] = int(raw[k], 0, 99999, 0);
  s.faction = FACTIONS.some(f => f.id === raw.faction) ? raw.faction : null;
  s.factionBonus = { rep: int(raw.factionBonus?.rep, 0, 20, 0) };
  s.besties = Array.isArray(raw.besties) ? raw.besties.filter(x => typeof x === "string").slice(0, 200) : [];
  if (raw.relationships && typeof raw.relationships === "object") {
    for (const [k, r] of Object.entries(raw.relationships).slice(0, 500)) {
      if (!r || typeof r !== "object") continue;
      s.relationships[String(k).slice(0, 40)] = { talks: int(r.talks, 0, 99999, 0), rapport: int(r.rapport, 0, 100, 0), bestie: r.bestie === true, lastTalk: int(r.lastTalk, 0, 9e15, 0) };
    }
  }
  s.history = Array.isArray(raw.history) ? raw.history.filter(h => h && typeof h === "object").slice(0, LIFE_RULES.historyLimit) : [];
  if (raw.cooldowns && typeof raw.cooldowns === "object") for (const [k, v] of Object.entries(raw.cooldowns)) if (COSTS[k] || k === "study-invite") s.cooldowns[k] = int(v, 0, 9e15, 0);
  return s;
}
const readJSON = k => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
const load = () => sanitise(readJSON(KEY) || readJSON(OLD_KEY));
const save = s => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} };
const log = (s, entry) => { s.history.unshift({ ...entry, at: Date.now() }); s.history.length = Math.min(s.history.length, LIFE_RULES.historyLimit); };
function personKey(npc){const x=Math.round(npc?.homeX??npc?.ctl?.pos?.x??0),z=Math.round(npc?.homeZ??npc?.ctl?.pos?.z??0);return `student-${x}-${z}`;}
function personName(key){let h=0;for(const c of key)h=(h*31+c.charCodeAt(0))>>>0;return `${FIRST[h%FIRST.length]} ${LAST[(h>>>5)%LAST.length]}`;}
const blankRel = () => ({ talks: 0, rapport: 0, bestie: false, lastTalk: 0 });
const wait = ms => { const s = Math.ceil(ms / 1000); return s >= 60 ? `${Math.ceil(s / 60)} min` : `${s}s`; };

export const CampusLife={
  factions:FACTIONS,
  rules:LIFE_RULES,
  person(npc){const key=personKey(npc),s=load();const r=s.relationships[key]||blankRel();return {key,name:personName(key),...r};},
  suspended(){return load().discipline<=LIFE_RULES.suspensionAt;},
  talk(npc){
    const key=personKey(npc),s=load(),r=s.relationships[key]||blankRel(),now=Date.now();
    const fresh_=now-(r.lastTalk||0)>=LIFE_RULES.talkGapMs;
    r.talks++;
    if(fresh_){r.rapport=clamp(r.rapport+Math.max(3,12-Math.floor(r.talks/6)));r.lastTalk=now;s.mood=clamp(s.mood+2);}
    s.relationships[key]=r;log(s,{type:"conversation",with:personName(key)});save(s);
    return {key,name:personName(key),...r};
  },
  bestie(npc){
    const key=personKey(npc),s=load(),r=s.relationships[key]||blankRel();
    if(r.bestie)return {ok:false,message:"You are already best friends."};
    if(r.talks<3||r.rapport<30)return {ok:false,message:"Spend more time together before asking to become besties."};
    r.bestie=true;s.relationships[key]=r;if(!s.besties.includes(key))s.besties.push(key);
    s.mood=clamp(s.mood+12);s.reputation=clamp(s.reputation+3);log(s,{type:"bestie",with:personName(key)});save(s);
    return {ok:true,message:`${personName(key)} is now your bestie.`};
  },
  inviteStudy(npc){
    const s=load(),now=Date.now(),until=(s.cooldowns["study-invite"]||0)+30000;
    if(now<until)return {ok:false,message:`You already studied together recently. Try again in ${wait(until-now)}.`};
    if(s.energy<7)return {ok:false,message:"You are too tired to study. Rest or grab a meal first."};
    if(s.discipline<=LIFE_RULES.suspensionAt)return {ok:false,message:"You are on disciplinary suspension. Attend a conduct meeting first."};
    s.cooldowns["study-invite"]=now;save(s);
    const r=this.talk(npc),t=load();t.study++;t.energy=clamp(t.energy-7);t.reputation=clamp(t.reputation+2);log(t,{type:"study-together",with:r.name});save(t);
    return {ok:true,study:true,message:`You and ${r.name} studied together. A study session was recorded.`};
  },
  joinFaction(id){
    const f=FACTIONS.find(x=>x.id===id),s=load();
    if(!f)return {ok:false,message:"That group is unavailable."};
    if(s.faction===id)return {ok:false,message:"You already belong to this group."};
    if(s.faction)return {ok:false,message:"Leave your current group before joining another."};
    const before=s.reputation;s.faction=id;
    if(id==="secret-cult"){s.discipline=clamp(s.discipline-18);s.reputation=clamp(s.reputation+7);log(s,{type:"secret-membership"});}
    else if(id==="campus-crew"){s.reputation=clamp(s.reputation+8);s.mood=clamp(s.mood+4);}
    else s.reputation=clamp(s.reputation+5);
    s.factionBonus={rep:s.reputation-before};save(s);
    const warn=id==="secret-cult"&&s.discipline<=LIFE_RULES.suspensionAt?" Your discipline is critically low: you are now on suspension.":"";
    return {ok:true,message:`You joined ${f.name}. Your campus life has changed.${warn}`};
  },
  leaveFaction(){
    const s=load();if(!s.faction)return {ok:false,message:"You do not belong to a group."};
    const f=FACTIONS.find(x=>x.id===s.faction);
    s.reputation=clamp(s.reputation-(s.factionBonus?.rep||0));   // the join bonus is not permanent
    s.faction=null;s.factionBonus={rep:0};save(s);
    return {ok:true,message:`You left ${f?.name||"the group"}. Its reputation bonus no longer applies.`};
  },
  activity(type){
    const c=COSTS[type],s=load(),now=Date.now();
    if(!c)return {ok:false,message:"Unknown activity."};
    const until=(s.cooldowns[type]||0)+c.cd;
    if(now<until)return {ok:false,message:`Not so fast. Try again in ${wait(until-now)}.`};
    if(s.energy<c.e)return {ok:false,message:"You are too tired. Rest in the hostel or buy a meal first."};
    let message="Activity completed.";
    if(type==="study"){s.study++;s.reputation=clamp(s.reputation+1);message="You completed a focused study session.";}
    else if(type==="lecture"){s.reputation=clamp(s.reputation+2);message="You attended your lecture.";}
    else if(type==="practical"){s.practical++;s.reputation=clamp(s.reputation+2);message="Practical work completed. Skills improved.";}
    else if(type==="meal"){if(s.wallet<350)return {ok:false,message:"You need ₦350 for a meal."};if(s.energy>=100)return {ok:false,message:"You are not hungry right now."};s.wallet-=350;s.energy=clamp(s.energy+24);s.mood=clamp(s.mood+5);message="You bought a meal and restored your energy.";}
    else if(type==="rest"){if(s.energy>=100)return {ok:false,message:"You are fully rested."};s.energy=clamp(s.energy+35);s.mood=clamp(s.mood+4);message="You rested in your hostel. Energy restored.";}
    else if(type==="hangout"){s.hangouts++;s.mood=clamp(s.mood+12);message="You spent time with friends around campus.";}
    else if(type==="party"){s.parties++;s.mood=clamp(s.mood+16);s.reputation=clamp(s.reputation-1);s.discipline=clamp(s.discipline-2);message="You attended a campus party. Your mood improved.";}
    else if(type==="work"){s.wallet=Math.min(LIFE_RULES.maxWallet,s.wallet+1800);s.reputation=clamp(s.reputation+1);message="You completed a student shift and earned ₦1,800.";}
    else if(type==="sports"){s.mood=clamp(s.mood+9);s.reputation=clamp(s.reputation+2);message="You trained with the sports club.";}
    else if(type==="discipline"){if(s.discipline>=100)return {ok:false,message:"Your conduct record is already spotless."};s.discipline=clamp(s.discipline+8);message="You attended a student conduct meeting and improved your standing.";}
    s.energy=clamp(s.energy-c.e);s.cooldowns[type]=now;log(s,{type});save(s);
    return {ok:true,message};
  },
  award(amount,label){const s=load();amount=int(amount,0,LIFE_RULES.maxWallet,0);s.wallet=Math.min(LIFE_RULES.maxWallet,s.wallet+amount);log(s,{type:"award",label:String(label||"award").slice(0,40),amount});save(s);return {ok:true,wallet:s.wallet};},
  purchase(amount,label){
    const s=load();amount=int(amount,0,LIFE_RULES.maxWallet,0);
    if(s.wallet<amount)return {ok:false,message:"Not enough money in your wallet."};
    s.wallet-=amount;log(s,{type:"clothing-purchase",label:String(label||"clothing").slice(0,40),amount});save(s);
    return {ok:true,message:`Purchased ${label} for ₦${amount.toLocaleString("en-NG")}.`};
  },
  reset(){try{localStorage.removeItem(KEY);localStorage.removeItem(OLD_KEY);localStorage.removeItem("university_life_npc_memory_v1");}catch{}},
  snapshot(){const s=load();return {...s,bestieCount:s.besties.length,suspended:s.discipline<=LIFE_RULES.suspensionAt,factionInfo:FACTIONS.find(f=>f.id===s.faction)||null};}
};

// Character profile and topic-based student conversations.
const PROFILE_KEY = "university_life_profile_v1";
const profileLoad = () => { try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || "null"); } catch { return null; } };
const profileSave = value => { try { localStorage.setItem(PROFILE_KEY, JSON.stringify(value)); } catch {} };
const CAMPUS_RUMOURS = [
  {id:"scholarship",title:"A new scholarship",text:"People are saying the faculty may announce a merit scholarship soon. Nobody has seen the official notice yet.",source:"a course representative",check:"Student Affairs or the faculty noticeboard"},
  {id:"hostel",title:"Hostel allocation",text:"There is a rumour that hostel allocation may be tight this semester. It is worth checking before paying anyone.",source:"someone who says they know a hostel porter",check:"the hostel office"},
  {id:"audition",title:"Campus auditions",text:"A student group may be planning auditions for the next campus show. The date has not been confirmed.",source:"a student in the arts circle",check:"the organisers or student noticeboard"},
  {id:"exam",title:"A changed test date",text:"Someone mentioned that one department could be adjusting a test date. Check the lecturer's notice before relying on it.",source:"a class group chat",check:"the lecturer or department office"},
  {id:"sports",title:"Inter-faculty match",text:"I heard that an inter-faculty match is being discussed, but nobody has posted a fixture yet.",source:"a player from the sports ground",check:"the sports coordinator"}
];
export const StudentProfile = {
  get(){ return profileLoad(); },
  save(data){
    const c=(v,a,b,d)=>Number.isFinite(Number(v))&&String(v).trim()!==""?Math.round(Math.max(a,Math.min(b,Number(v)))):d;
    const p={name:String(data.name||"").replace(/\s+/g," ").trim().slice(0,32)||"Student",age:c(data.age,15,60,18),aim:String(data.aim||"").slice(0,80),programme:String(data.programme||"").slice(0,40),course:String(data.course||"").replace(/\s+/g," ").trim().slice(0,60),iq:c(data.iq,50,200,100),jamb:c(data.jamb,0,400,0),createdAt:Date.now()};
    profileSave(p);return p;
  },
  clear(){try{localStorage.removeItem(PROFILE_KEY);}catch{}}
};
const topicOptions = {
  intro:["What course are you studying?","How is campus life?","Tell me the latest campus gist","What are your plans this semester?"],
  course:["Do you enjoy your department?","Which course is giving you trouble?","Want to study together?","Let's talk about campus life"],
  campus:["Where do students usually hang out?","Have you heard any rumours?","Are there any events coming up?","Let's talk about academics"],
  rumours:["What exactly did you hear?","Who told you about it?","How can we verify it?","Have you heard another story?"],
  academics:["Are you preparing for tests?","Any good study group?","What do you think of my course?","Let's change the topic"],
  events:["Are you going to the event?","Who is organising it?","Where will it happen?","Any other campus news?"],
  friendship:["What do you do for fun?","Would you like to hang out?","Can we become close friends?","Tell me about yourself"]
};
const NPC_MEMORY_KEY="university_life_npc_memory_v1";
const npcTopicMemory = new Map();
try { const saved=JSON.parse(localStorage.getItem(NPC_MEMORY_KEY)||"{}"); for(const [k,v] of Object.entries(saved))npcTopicMemory.set(k,v); } catch {}
function saveNpcMemory(){try{localStorage.setItem(NPC_MEMORY_KEY,JSON.stringify(Object.fromEntries(npcTopicMemory)));}catch{}}
function npcPersona(npc){
  const key=personKey(npc),seed=key.split("").reduce((a,c)=>a+c.charCodeAt(0),0);
  const styles=["easygoing","ambitious","curious","funny","careful"];
  const interests=[["music","football"],["business","career"],["technology","films"],["fashion","events"],["reading","campus news"]];
  return {style:styles[seed%styles.length],interests:interests[seed%interests.length],seed};
}
function topicReply(npc, topic, profile, relationship){
  const key=personKey(npc),persona=npcPersona(npc);
  const course=profile?.course||"your course",aim=profile?.aim||"your plans";
  const role=npc?.groupLabel||npc?.roleDef?.label||"student";
  const first=profile?.name?`${profile.name}, `:"";
  if(topic==="intro") return `Hey${profile?.name?` ${profile.name}`:""}, good to meet you. I'm usually around the ${String(role).toLowerCase()} crowd. How are you finding campus so far?`;
  if(topic==="course") return `${first}${course}? Nice. Every department has its pressure. I’m curious, what made you choose it — genuine interest, career opportunities, or something else?`;
  if(topic==="profile") return `I remember your profile: you're ${profile?.age||"a student"}, your JAMB score is ${profile?.jamb??"not entered"}, and your IQ entry is ${profile?.iq??"not entered"}. Those are part of your character record, but what matters most is how you use your time here. What would you like to improve first?`;
  if(topic==="campus") return `Campus has different sides. The cafeteria gets busy after lectures, the library is quieter, and the student centre is where plenty of gist starts. Are you looking for somewhere to relax or somewhere to get things done?`;
  if(topic==="rumours") return `Hmm, campus gist travels fast. I can tell you what reached me, but let's separate what somebody said from what we can actually prove. Do you want the story or the source first?`;
  if(topic==="academics") return `I'm trying to balance lectures and personal life too. Small, regular study sessions work better than waiting until the night before an exam. Which subject is taking most of your time?`;
  if(topic==="events") return `There are usually plans moving around — shows, sports and faculty activities. Dates can change, though. Are you interested in performing, watching, or helping organise something?`;
  if(topic==="friendship") return `Outside class, I'm into ${persona.interests.join(" and ")}. I like people who can gist without making every conversation serious. What do you enjoy doing when you're free?`;
  if(topic==="verify") return `Let's not spread it as fact yet. The sensible thing is to check ${CAMPUS_RUMOURS[persona.seed%CAMPUS_RUMOURS.length].check}. If there's no official confirmation, we call it unverified.`;
  if(topic==="aim") return `${aim}? That's a meaningful direction. What is one thing you can do this semester to move closer to it?`;
  return `I hear you. Tell me a little more — what happened, or what made you think about it?`;
}
CampusLife.profile = () => StudentProfile.get();
CampusLife.chat = function(npc, topic="intro"){
  const key=personKey(npc), rel=this.person(npc), profile=StudentProfile.get();
  const memory=npcTopicMemory.get(key)||{topics:[],rumours:[],facts:{}};
  let line=topicReply(npc,topic,profile,rel);
  const previous=memory.lastTopic;
  if(previous && previous!==topic && topic!=="intro"){
    const transitions={rumours:"That reminds me of what we were just discussing.",academics:"Speaking of that, let's connect it to school work.",friendship:"Anyway, enough serious talk for a moment.",events:"That actually connects with things happening around campus."};
    if(transitions[topic] && memory.topics.length>1) line=`${transitions[topic]} ${line}`;
  } else if(memory.topics.includes(topic) && topic!=="intro") line=`I remember we touched on this earlier. ${line}`;
  let options=(topicOptions[topic]||topicOptions.intro).slice();
  if(topic==="rumours") options=["Tell me the actual story","Who was the source?","How can we verify it?","Let's change topic"];
  if(topic==="verify") options=["Let's ask Student Affairs","Let's check the noticeboard","What else is happening?","Change topic"];
  memory.topics.push(topic);if(memory.topics.length>40)memory.topics.splice(0,memory.topics.length-40);memory.lastTopic=topic;memory.lastTalk=Date.now();npcTopicMemory.set(key,memory);saveNpcMemory();
  return {name:rel.name,line,options,topic,relationship:rel,profile};
};
CampusLife.rumour = function(npc, action="share"){
  const key=personKey(npc),persona=npcPersona(npc),rumour=CAMPUS_RUMOURS[persona.seed%CAMPUS_RUMOURS.length];
  const memory=npcTopicMemory.get(key)||{topics:[],rumours:[],facts:{}};
  if(action==="source") return {line:`It came from ${rumour.source}. I didn't hear it directly from an official, so take that for what it is.`,rumour,status:"unverified"};
  if(action==="verify"){
    memory.rumours.push({id:rumour.id,status:"checked-unconfirmed",at:Date.now()});npcTopicMemory.set(key,memory);saveNpcMemory();
    return {line:`I can't confirm it. The best place to check is ${rumour.check}. Until an official notice appears, it remains a rumour.`,rumour,status:"unconfirmed"};
  }
  if(memory.rumours.some(x=>x.id===rumour.id&&x.status==="heard")) return {line:`It's the same ${rumour.title.toLowerCase()} gist I mentioned earlier. Have you found out anything new?`,rumour,status:"unverified"};
  memory.rumours.push({id:rumour.id,status:"heard",at:Date.now()});if(memory.rumours.length>20)memory.rumours.splice(0,memory.rumours.length-20);npcTopicMemory.set(key,memory);saveNpcMemory();
  return {line:`Have you heard this one? ${rumour.text}`,rumour,status:"unverified"};
};
function classifyMessage(text){
  const rules=[
    ["greeting",/^(hi|hello|hey|how far|how you dey|good morning|good afternoon|good evening)\b/],
    ["profile",/\b(my name|how old|my age|jamb|utme|iq score|my score|my profile)\b/],
    ["thanks",/\b(thank|thanks|i appreciate)\b/],
    ["apology",/\b(sorry|my bad|forgive me)\b/],
    ["rumours",/\b(rumou?r|gossip|gist|heard|heared|whisper|who said|people say|is it true|true or not|confirm|source|who told)\b/],
    ["course",/\b(course|department|lecturer|faculty|computer|medicine|law|engineering|class|school)\b/],
    ["academics",/\b(exam|test|assignment|study|read|lecture|result|scholarship|grade|cgpa)\b/],
    ["events",/\b(party|event|show|audition|concert|football match|sports|match)\b/],
    ["friendship",/\b(friend|bestie|hang out|fun|music|food|relationship|dating|love)\b/],
    ["aim",/\b(aim|dream|future|ambition|goal|plan|career|business)\b/],
    ["campus",/\b(where|hostel|cafeteria|library|campus|place|meet|room|building)\b/]
  ];
  for(const [topic,re] of rules)if(re.test(text))return topic;
  return "general";
}
CampusLife.respond = function(npc, message){
  const raw=String(message||"").trim();
  const text=raw.toLowerCase().replace(/[^a-z0-9\s']/g," ").replace(/\s+/g," ").trim();
  const key=personKey(npc),memory=npcTopicMemory.get(key)||{topics:[],rumours:[],facts:{}};
  const topic=classifyMessage(text),profile=StudentProfile.get(),rel=this.person(npc);
  let line="",options=[];
  if(topic==="greeting") line=`How far! I'm good, thanks for asking. How your own day dey go?`;
  else if(topic==="thanks") line=`No wahala, you're welcome. That's what friends are for. So, what else is happening with you?`;
  else if(topic==="apology") line=`It's alright, no hard feelings. We move. What were you saying?`;
  else if(topic==="rumours"){
    if(/who told|source|where did|who did you hear/.test(text)){const r=this.rumour(npc,"source");line=r.line;}
    else if(/verify|confirm|is it true|true or not|really happened|real/.test(text)){const r=this.rumour(npc,"verify");line=r.line;}
    else {line=this.chat(npc,"rumours").line+" "+this.rumour(npc,"share").line;}
    options=["Who was the source?","How can we verify it?","Tell me another topic","Let's talk about academics"];
  } else if(topic==="general"){
    const previous=memory.lastTopic;
    if(previous==="course") line=`I get you. Choosing a course can involve family advice, personal interest and job prospects. Now that you're here, are you beginning to enjoy ${profile?.course||"your course"}?`;
    else if(previous==="academics") line=`That makes sense. School can be demanding. Maybe we can plan a study session together — which topic should we start with?`;
    else if(previous==="aim") line=`That's a fair point. Big plans take small steps. What is one practical thing you can do this week?`;
    else if(previous==="friendship") line=`I like that. People connect over different things. We should hang out sometime and get to know each other better.`;
    else if(/\b(wetin|what) (you|do) (think|mean)|what do you think/.test(text))line=`I think it depends on the full situation. What part matters most to you?`;
    else if(/\b(you good|are you okay|how are you)\b/.test(text))line=`I'm alright, just trying to balance school and everything else. How are you holding up?`;
    else if(/\b(wahala|problem|trouble|stressed|tired|sad|angry)\b/.test(text))line=`Ah, sorry about that. Do you want to tell me what happened? Sometimes talking it through helps.`;
    else if(/\b(yes|yeah|yep|sure|okay|ok)\b/.test(text))line=`Alright then. What would you like us to talk about next?`;
    else line=`I get what you're saying. Can you tell me a little more so I don't misunderstand you?`;
    options=["Let's talk about campus","Any campus gist?","How are your studies?","What do you do for fun?"];
  } else {
    const answer=this.chat(npc,topic);line=answer.line;options=answer.options;
    if(topic==="course"&&profile?.course)line+=` I remember you said you're doing ${profile.course}.`;
    if(topic==="aim"&&profile?.aim)line+=` You told me your aim is to ${profile.aim.toLowerCase()}.`;
  }
  // Keep a small conversational memory so the next exchange can refer back naturally.
  memory.lastMessage=raw.slice(0,180);memory.lastTopic=topic;memory.lastTalk=Date.now();
  memory.exchangeCount=(memory.exchangeCount||0)+1;
  if(profile?.name)memory.playerName=profile.name;
  npcTopicMemory.set(key,memory);saveNpcMemory();
  return {name:rel.name,line,options,topic,relationship:rel,profile};
};
