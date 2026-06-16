// Project Ascension — game engine
// Pure-ish state module. Everything derives from per-day logs so XP/levels are
// always recomputable and can never silently drift. Persisted to localStorage.

const STORAGE_KEY = "ascension.save.v1";
const DAILY_CAP = 100;
const XP_PER_LEVEL = 500;

export const TITLES = [
  "Initiate", "Controlled", "Consistent", "Reliable", "Disciplined",
  "Focused", "Formidable", "Elite", "Unshakeable", "Ascendant",
];

// Main quests: id, label, requirement, xp, attribute it feeds.
export const MAIN_QUESTS = [
  { id: "fuel",     name: "Fuel the Character",  req: "Eat home-cooked or deliberately healthy food", xp: 10, attr: "strength" },
  { id: "impulse",  name: "Control the Impulse", req: "Follow your masturbation / porn rule for the day", xp: 10, attr: "discipline" },
  { id: "mind",     name: "Train the Mind",      req: "At least 25 minutes of focused study", xp: 10, attr: "intelligence" },
  { id: "body",     name: "Train the Body",      req: "20-30 minutes of walking or exercise", xp: 10, attr: "strength" },
  { id: "recovery", name: "Protect Recovery",    req: "Follow your defined sleep cutoff", xp: 10, attr: "stability" },
];

export const BONUS_QUESTS = [
  { id: "python",   name: "Python / interview practice", req: "30 minutes", xp: 10, attr: "career" },
  { id: "aiproj",   name: "AI project / AI Council work", req: "45 minutes", xp: 15, attr: "career" },
  { id: "expenses", name: "Track all expenses",          req: "Full day logged", xp: 5,  attr: "wealth" },
  { id: "nobuy",    name: "No unnecessary purchase",     req: "Held the line", xp: 5,  attr: "wealth" },
  { id: "family",   name: "Meaningful connection",       req: "Family, partner or friend", xp: 5,  attr: "stability" },
  { id: "prep",     name: "Prepare tomorrow's food",     req: "Cook ahead", xp: 10, attr: "strength" },
  { id: "work",     name: "Hard work task cleared",      req: "Unusually difficult task", xp: 10, attr: "career" },
  { id: "commute",  name: "Read / revise on commute",    req: "Instead of mindless scrolling", xp: 5,  attr: "intelligence" },
];

export const BOSSES = [
  { id: "delivery",   name: "The Delivery Demon",     desc: "Tired, hungry, tempted to order. Eat something at home and wait twenty minutes.", xp: 10, attr: "wealth", fund: true },
  { id: "midnight",   name: "The Midnight Trigger",   desc: "Alone with your phone late at night. Phone outside the room, lights off, fifteen minutes clear.", xp: 15, attr: "discipline" },
  { id: "hydra",      name: "The Procrastination Hydra", desc: "Everything feels too large. Pick one task, work twenty-five minutes.", xp: 10, attr: "career" },
  { id: "comparison", name: "The Comparison Phantom", desc: "Comparing salary, body, life with someone. Do one controllable action now.", xp: 10, attr: "stability" },
];

export const ATTRIBUTES = [
  { id: "intelligence", name: "Intelligence", desc: "MTech, PGDM, mathematics, ML and technical study" },
  { id: "career",       name: "Career",       desc: "Interviews, coding, work performance and leadership" },
  { id: "strength",     name: "Strength",     desc: "Exercise, nutrition, sleep and physical health" },
  { id: "discipline",   name: "Discipline",   desc: "Controlling impulses and doing difficult tasks" },
  { id: "wealth",       name: "Wealth",       desc: "Saving, avoiding waste and monitoring expenses" },
  { id: "stability",    name: "Stability",    desc: "Mental calm, relationships, family and recovery" },
];

const STREAK_BONUS = { 3: 20, 7: 50, 14: 100, 30: 250 };

// ---------- date helpers ----------
export function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function shiftKey(key, deltaDays) {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  return todayKey(dt);
}

// ---------- persistence ----------
function blankDay() {
  return {
    main: {},          // questId -> true
    bonus: {},         // bonusId -> true
    bosses: {},        // bossId -> count
    fundSaved: 0,      // money moved to Freedom Fund today
    trigger: "",       // one-line trigger note
  };
}

function emptyState() {
  return { startedAt: todayKey(), days: {}, settings: { sleepCutoff: "23:30" } };
}

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    if (!parsed.days) return emptyState();
    return parsed;
  } catch {
    return emptyState();
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getDay(key) {
  if (!state.days[key]) state.days[key] = blankDay();
  return state.days[key];
}

// ---------- per-day computation ----------
export function mainDoneCount(key) {
  const day = state.days[key];
  if (!day) return 0;
  return MAIN_QUESTS.reduce((n, q) => n + (day.main[q.id] ? 1 : 0), 0);
}

// Minimum Viable Victory: 3 of 5 main quests = a successful day.
export function isSuccessful(key) {
  return mainDoneCount(key) >= 3;
}

// Consecutive successful days ending on (and including) `key`.
function runLength(key) {
  let n = 0;
  let cur = key;
  while (isSuccessful(cur)) {
    n++;
    cur = shiftKey(cur, -1);
  }
  return n;
}

// Streak bonus credited specifically on this day (when a threshold is hit).
function streakBonusFor(key) {
  if (!isSuccessful(key)) return 0;
  return STREAK_BONUS[runLength(key)] || 0;
}

function questXp(key) {
  const day = state.days[key];
  if (!day) return 0;
  let xp = 0;
  for (const q of MAIN_QUESTS) if (day.main[q.id]) xp += q.xp;
  for (const b of BONUS_QUESTS) if (day.bonus[b.id]) xp += b.xp;
  return xp;
}

function bossXp(key) {
  const day = state.days[key];
  if (!day) return 0;
  let xp = 0;
  for (const b of BOSSES) xp += (day.bosses[b.id] || 0) * b.xp;
  return xp;
}

// Raw earned for the day before the daily cap.
export function rawDayXp(key) {
  return questXp(key) + bossXp(key) + streakBonusFor(key);
}

// Daily cap of 100 — guards against burnout farming.
export function dayXp(key) {
  return Math.min(DAILY_CAP, rawDayXp(key));
}

// ---------- aggregate / derived ----------
export function totalXp() {
  return Object.keys(state.days).reduce((sum, k) => sum + dayXp(k), 0);
}

export function levelInfo() {
  const total = totalXp();
  const levelIndex = Math.floor(total / XP_PER_LEVEL); // 0-based
  const level = levelIndex + 1;
  const into = total % XP_PER_LEVEL;
  return {
    total,
    level,
    title: TITLES[Math.min(levelIndex, TITLES.length - 1)],
    nextTitle: TITLES[Math.min(levelIndex + 1, TITLES.length - 1)],
    into,
    need: XP_PER_LEVEL,
    pct: into / XP_PER_LEVEL,
    max: levelIndex >= TITLES.length - 1,
  };
}

// Attribute totals (uncapped flavour score) feeding the radar.
export function attributeTotals() {
  const totals = Object.fromEntries(ATTRIBUTES.map((a) => [a.id, 0]));
  for (const key of Object.keys(state.days)) {
    const day = state.days[key];
    for (const q of MAIN_QUESTS) if (day.main[q.id]) totals[q.attr] += q.xp;
    for (const b of BONUS_QUESTS) if (day.bonus[b.id]) totals[b.attr] += b.xp;
    for (const b of BOSSES) totals[b.attr] += (day.bosses[b.id] || 0) * b.xp;
  }
  return totals;
}

// Current live streak: consecutive successful days ending today or yesterday.
export function currentStreak() {
  const today = todayKey();
  if (isSuccessful(today)) return runLength(today);
  const y = shiftKey(today, -1);
  return isSuccessful(y) ? runLength(y) : 0;
}

export function nextStreakMilestone(streak) {
  const ms = [3, 7, 14, 30];
  return ms.find((m) => m > streak) || null;
}

export function freedomFund() {
  return Object.keys(state.days).reduce((s, k) => s + (state.days[k].fundSaved || 0), 0);
}

export function bossTotals() {
  const totals = Object.fromEntries(BOSSES.map((b) => [b.id, 0]));
  for (const key of Object.keys(state.days)) {
    const day = state.days[key];
    for (const b of BOSSES) totals[b.id] += day.bosses[b.id] || 0;
  }
  return totals;
}

// ---------- mutations ----------
export function getToday() {
  return getDay(todayKey());
}

export function toggleMain(id) {
  const day = getToday();
  day.main[id] = !day.main[id];
  if (!day.main[id]) delete day.main[id];
  save();
}

export function toggleBonus(id) {
  const day = getToday();
  day.bonus[id] = !day.bonus[id];
  if (!day.bonus[id]) delete day.bonus[id];
  save();
}

// Returns { capped: bool } so UI can warn when the daily cap swallowed the reward.
export function defeatBoss(id, fundAmount = 0) {
  const day = getToday();
  const before = dayXp(todayKey());
  day.bosses[id] = (day.bosses[id] || 0) + 1;
  if (fundAmount > 0) day.fundSaved = (day.fundSaved || 0) + fundAmount;
  save();
  const after = dayXp(todayKey());
  const boss = BOSSES.find((b) => b.id === id);
  return { gained: after - before, capped: after - before < boss.xp };
}

export function setTrigger(text) {
  getToday().trigger = text;
  save();
}

export function getTrigger() {
  return getToday().trigger || "";
}

export function setSetting(key, val) {
  state.settings[key] = val;
  save();
}
export function getSetting(key) {
  return state.settings[key];
}

// ---------- weekly scorecard ----------
export function weekNumber() {
  const start = state.startedAt;
  const [sy, sm, sd] = start.split("-").map(Number);
  const startDate = new Date(sy, sm - 1, sd);
  const now = new Date();
  const days = Math.floor((now - startDate) / 86400000);
  return Math.max(1, Math.floor(days / 7) + 1);
}

export function weeklyScorecard() {
  const today = todayKey();
  const keys = [];
  for (let i = 6; i >= 0; i--) keys.push(shiftKey(today, -i));

  const tally = (fn) => keys.reduce((n, k) => n + (fn(k) ? 1 : 0), 0);
  const sumDays = (pick) => keys.reduce((n, k) => n + (state.days[k] ? pick(state.days[k]) : 0), 0);

  const has = (cat, id) => (k) => state.days[k] && state.days[k][cat][id];

  const info = levelInfo();
  return {
    week: weekNumber(),
    level: info.level,
    title: info.title,
    xp: info.total,
    main: {
      fuel: tally(has("main", "fuel")),
      impulse: tally(has("main", "impulse")),
      mind: tally(has("main", "mind")),
      body: tally(has("main", "body")),
      recovery: tally(has("main", "recovery")),
    },
    bonus: {
      python: tally(has("bonus", "python")),
      aiproj: tally(has("bonus", "aiproj")),
      expenses: tally(has("bonus", "expenses")),
      fund: sumDays((d) => d.fundSaved || 0),
      family: tally(has("bonus", "family")),
    },
    bosses: {
      delivery: sumDays((d) => d.bosses.delivery || 0),
      midnight: sumDays((d) => d.bosses.midnight || 0),
      hydra: sumDays((d) => d.bosses.hydra || 0),
      comparison: sumDays((d) => d.bosses.comparison || 0),
    },
    trigger: state.days[today]?.trigger || "",
  };
}

export function scorecardText() {
  const s = weeklyScorecard();
  return `PROJECT ASCENSION - WEEK ${s.week}

Current Level: ${s.level} (${s.title})
Current XP: ${s.xp}

MAIN QUESTS
Home/healthy food: ${s.main.fuel} / 7
Impulse rule followed: ${s.main.impulse} / 7
Focused study: ${s.main.mind} / 7
Movement/exercise: ${s.main.body} / 7
Sleep cutoff followed: ${s.main.recovery} / 7

BONUS
Python/interview sessions: ${s.bonus.python}
AI project sessions: ${s.bonus.aiproj}
Expenses tracked: ${s.bonus.expenses}
Money moved to Freedom Fund: ${s.bonus.fund}
Meaningful relationship/family time: ${s.bonus.family}

BOSSES DEFEATED
Delivery Demon: ${s.bosses.delivery}
Midnight Trigger: ${s.bosses.midnight}
Procrastination Hydra: ${s.bosses.hydra}
Comparison Phantom: ${s.bosses.comparison}

Biggest trigger this week: ${s.trigger || "-"}
One rule I will modify next week: `;
}

// ---------- data management ----------
export function exportSave() {
  return JSON.stringify(state, null, 2);
}
export function importSave(json) {
  const parsed = JSON.parse(json);
  if (!parsed.days) throw new Error("Invalid save file");
  state = parsed;
  if (!state.settings) state.settings = { sleepCutoff: "23:30" };
  save();
}
export function resetSave() {
  state = emptyState();
  save();
}

export const constants = { DAILY_CAP, XP_PER_LEVEL };
