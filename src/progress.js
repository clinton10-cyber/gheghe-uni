// Academic progression for Ghegeh University.
// v2 hardens the original save: sanitised loads, a real pass mark, study/lecture
// "banks" that exams consume (no more spamming exams), JAMB cut-offs and a
// proper graduation record. Old v1 saves are migrated automatically.
const KEY = "university_life_save_v2";
const OLD_KEY = "university_life_save_v1";
const PROFILE_KEY = "university_life_profile_v1";

export const RULES = Object.freeze({
  creditsToGraduate: 12,
  creditsPerPass: 4,
  passMark: 50,
  examsToGraduate: 3,
  studyPerExam: 2,
  lecturesPerExam: 1,
  scholarshipPasses: 2,
  scholarshipStudy: 5,
  scholarshipAverage: 60,
  scholarshipAward: 50000
});

const PROGRAMMES = [
  { id:"computer-science", name:"Computer Science", faculty:"Science & Technology", minJamb:200, courses:["Programming Fundamentals","Mathematics I","Computer Systems","Communication Skills"] },
  { id:"medicine", name:"Medicine & Surgery", faculty:"Health Sciences", minJamb:280, courses:["Human Anatomy","Biochemistry","Physiology","Medical Ethics"] },
  { id:"law", name:"Law", faculty:"Faculty of Law", minJamb:250, courses:["Nigerian Legal System","Constitutional Law","Contract Law","Legal Methods"] },
  { id:"business", name:"Business Administration", faculty:"Management Sciences", minJamb:180, courses:["Principles of Management","Accounting","Economics","Business Communication"] },
  { id:"mass-communication", name:"Mass Communication", faculty:"Communication & Media Studies", minJamb:200, courses:["News Writing","Broadcasting","Media Studies","Public Relations"] }
];

const num = (v, min, max, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
};

const fresh = () => ({
  v: 2, programme: null,
  study: 0, lectures: 0,            // lifetime counters for this programme
  studyBank: 0, lectureBank: 0,     // unspent prep that an exam consumes
  exams: 0, passed: 0, credits: 0, scores: [],
  scholarship: false, graduations: [], completedObjectives: []
});

function sanitise(raw) {
  const s = fresh();
  if (!raw || typeof raw !== "object") return s;
  s.programme = PROGRAMMES.some(p => p.id === raw.programme) ? raw.programme : null;
  s.study = num(raw.study, 0, 9999);
  s.lectures = num(raw.lectures, 0, 9999);
  s.studyBank = num(raw.studyBank ?? Math.min(raw.study, 4), 0, 50);
  s.lectureBank = num(raw.lectureBank ?? Math.min(raw.lectures, 2), 0, 50);
  s.exams = num(raw.exams, 0, 9999);
  s.passed = num(raw.passed ?? Math.min(raw.exams, Math.floor((raw.credits || 0) / RULES.creditsPerPass)), 0, 9999);
  s.credits = num(raw.credits, 0, RULES.creditsToGraduate);
  s.scores = Array.isArray(raw.scores) ? raw.scores.map(x => num(x, 0, 100, NaN)).filter(Number.isFinite).slice(-30) : [];
  s.scholarship = raw.scholarship === true;
  s.graduations = Array.isArray(raw.graduations)
    ? raw.graduations.filter(g => g && typeof g.name === "string").slice(-20).map(g => ({ name: g.name.slice(0, 60), cgpa: String(g.cgpa || "0.00").slice(0, 5), at: num(g.at, 0, 9e15) }))
    : [];
  s.completedObjectives = Array.isArray(raw.completedObjectives) ? raw.completedObjectives.filter(x => typeof x === "string").slice(-20) : [];
  return s;
}

const read = k => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
const load = () => sanitise(read(KEY) || read(OLD_KEY));
const save = s => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} };
const profile = () => read(PROFILE_KEY);
const average = s => s.scores.length ? s.scores.reduce((a, b) => a + b, 0) / s.scores.length : 0;

export const CampusProgress = {
  programmes: PROGRAMMES,
  rules: RULES,

  snapshot() {
    const s = load();
    const p = PROGRAMMES.find(x => x.id === s.programme) || null;
    const avg = average(s);
    return {
      ...s, programme: p, cgpa: (avg / 25).toFixed(2),
      canGraduate: !!p && s.credits >= RULES.creditsToGraduate && s.passed >= RULES.examsToGraduate,
      percent: Math.min(100, Math.round(s.credits / RULES.creditsToGraduate * 100)),
      examReady: s.studyBank >= RULES.studyPerExam && s.lectureBank >= RULES.lecturesPerExam
    };
  },

  enrol(id) {
    const s = load();
    if (s.programme) return { ok: false, message: "You are already enrolled." };
    const p = PROGRAMMES.find(x => x.id === id);
    if (!p) return { ok: false, message: "Programme unavailable." };
    const pr = profile();
    if (!pr) return { ok: false, message: "Create your student profile first." };
    if (Number(pr.jamb) < p.minJamb) return { ok: false, message: `${p.name} needs a JAMB score of ${p.minJamb}. Yours is ${pr.jamb}. Choose another programme.` };
    s.programme = id; save(s);
    return { ok: true, message: `Admission confirmed for ${p.name}. Welcome to Ghegeh University.` };
  },

  // Study and lectures only count when done at the matching campus location.
  activity(type) {
    const s = load();
    if (!s.programme) return { ok: false, message: "Enrol in a programme first." };

    if (type === "study") { s.study++; s.studyBank = Math.min(50, s.studyBank + 1); save(s); return { ok: true, message: "Study session completed at the library." }; }
    if (type === "lecture") { s.lectures++; s.lectureBank = Math.min(50, s.lectureBank + 1); save(s); return { ok: true, message: "Lecture attendance recorded." }; }

    if (type === "exam") {
      if (s.credits >= RULES.creditsToGraduate) return { ok: false, message: "You have all the credits you need. Head to the portal to graduate." };
      if (s.studyBank < RULES.studyPerExam) return { ok: false, message: `You need ${RULES.studyPerExam} unused study sessions before an exam (you have ${s.studyBank}). Study at the library.` };
      if (s.lectureBank < RULES.lecturesPerExam) return { ok: false, message: `Attend at least ${RULES.lecturesPerExam} lecture before sitting an exam. Visit a faculty building.` };
      const prepStudy = s.studyBank, prepLectures = s.lectureBank;
      s.studyBank -= RULES.studyPerExam; s.lectureBank -= RULES.lecturesPerExam;
      let iqBonus = 0; const pr = profile();
      if (pr?.iq) iqBonus = Math.max(-3, Math.min(5, Math.round((Number(pr.iq) - 100) / 10)));
      const score = Math.max(0, Math.min(100, Math.round(40 + Math.min(30, prepStudy * 4) + Math.min(10, prepLectures * 2) + iqBonus + Math.random() * 12)));
      s.exams++; s.scores.push(score); s.scores = s.scores.slice(-30);
      if (score >= RULES.passMark) {
        s.passed++; s.credits = Math.min(RULES.creditsToGraduate, s.credits + RULES.creditsPerPass); save(s);
        return { ok: true, passed: true, score, message: `Examination passed with ${score}%. +${RULES.creditsPerPass} credits.` };
      }
      save(s);
      return { ok: false, passed: false, score, message: `You scored ${score}%. The pass mark is ${RULES.passMark}%. Study more and resit.` };
    }

    if (type === "scholarship") {
      if (s.scholarship) return { ok: false, message: "Scholarship already awarded." };
      if (s.passed < RULES.scholarshipPasses || s.study < RULES.scholarshipStudy) return { ok: false, message: `You need ${RULES.scholarshipPasses} passed exams and ${RULES.scholarshipStudy} study sessions.` };
      if (average(s) < RULES.scholarshipAverage) return { ok: false, message: `Your average must be at least ${RULES.scholarshipAverage}%.` };
      s.scholarship = true; save(s);
      return { ok: true, award: RULES.scholarshipAward, message: `Scholarship approved! ₦${RULES.scholarshipAward.toLocaleString("en-NG")} has been paid to your wallet.` };
    }
    return { ok: false, message: "Unknown activity." };
  },

  graduate() {
    const s = load();
    if (!(s.programme && s.credits >= RULES.creditsToGraduate && s.passed >= RULES.examsToGraduate)) {
      return { ok: false, message: `Earn ${RULES.creditsToGraduate} credits and pass ${RULES.examsToGraduate} examinations first.` };
    }
    const p = PROGRAMMES.find(x => x.id === s.programme);
    const cgpa = (average(s) / 25).toFixed(2);
    s.graduations.push({ name: p.name, cgpa, at: Date.now() });
    s.completedObjectives.push(`Graduated: ${p.name}`);
    Object.assign(s, { programme: null, study: 0, lectures: 0, studyBank: 0, lectureBank: 0, exams: 0, passed: 0, credits: 0, scores: [], scholarship: false });
    save(s);
    return { ok: true, message: `Congratulations! You graduated in ${p.name} with a CGPA of ${cgpa}.` };
  },

  reset() { try { localStorage.removeItem(KEY); localStorage.removeItem(OLD_KEY); } catch {} }
};
