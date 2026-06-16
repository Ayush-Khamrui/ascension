// Project Ascension — UI controller. Wires the game engine to the DOM and the
// 3D core, and re-renders everything from derived state on each change.

import * as G from "./game.js";
import { createCore } from "./scene.js";

const $ = (sel) => document.querySelector(sel);
const RING_CIRC = 2 * Math.PI * 92;

let core = null;
let lastLevel = G.levelInfo().level;

// ---------- 3D core ----------
function initCore() {
  import("three")
    .then(() => {
      core = createCore($("#core"));
      syncCore();
    })
    .catch(() => {
      // No network / no WebGL: hide canvas, keep the SVG ring as the visual.
      $("#core").classList.add("core-hidden");
    });
}

function syncCore() {
  if (!core) return;
  const info = G.levelInfo();
  core.setLevel(info.level, info.pct);
}

// ---------- helpers ----------
function icon(kind) {
  // tiny inline SVG markers, no emojis
  const paths = {
    check: '<path d="M5 13l4 4L19 7" />',
    dot: '<circle cx="12" cy="12" r="4" />',
    sword: '<path d="M14 4l6 6-9 9-3 1 1-3 9-9-4-4z" />',
    spark: '<path d="M12 3v6M12 15v6M3 12h6M15 12h6" />',
  };
  return `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths[kind] || paths.dot}</svg>`;
}

function toast(msg, kind = "") {
  const el = $("#toast");
  el.textContent = msg;
  el.className = `toast show ${kind}`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (el.className = "toast"), 2600);
}

// ---------- quest lists ----------
function buildQuests() {
  const today = G.getToday();

  $("#mainQuests").innerHTML = G.MAIN_QUESTS.map((q) => questRow(q, today.main[q.id], "main")).join("");
  $("#bonusQuests").innerHTML = G.BONUS_QUESTS.map((q) => questRow(q, today.bonus[q.id], "bonus")).join("");

  $("#mainQuests").querySelectorAll("[data-id]").forEach((el) => {
    el.addEventListener("click", () => {
      G.toggleMain(el.dataset.id);
      renderAll();
      const done = G.getToday().main[el.dataset.id];
      if (done) toast(`+${questXp(el.dataset.id, "main")} XP`, "good");
    });
  });
  $("#bonusQuests").querySelectorAll("[data-id]").forEach((el) => {
    el.addEventListener("click", () => {
      G.toggleBonus(el.dataset.id);
      renderAll();
      const done = G.getToday().bonus[el.dataset.id];
      if (done) toast(`+${questXp(el.dataset.id, "bonus")} XP`, "good");
    });
  });
}

function questXp(id, kind) {
  const list = kind === "main" ? G.MAIN_QUESTS : G.BONUS_QUESTS;
  return list.find((q) => q.id === id).xp;
}

function questRow(q, done, kind) {
  return `
    <li class="quest ${done ? "done" : ""}" data-id="${q.id}" tabindex="0" role="button" aria-pressed="${!!done}">
      <span class="quest-check">${done ? icon("check") : ""}</span>
      <span class="quest-body">
        <span class="quest-name">${q.name}</span>
        <span class="quest-req">${q.req}</span>
      </span>
      <span class="quest-xp">+${q.xp}</span>
    </li>`;
}

// ---------- bosses ----------
function buildBosses() {
  const totals = G.bossTotals();
  $("#bosses").innerHTML = G.BOSSES.map((b) => `
    <article class="boss">
      <header class="boss-head">
        <span class="boss-icon">${icon("sword")}</span>
        <h3>${b.name}</h3>
        <span class="boss-count" title="Defeated this season">${totals[b.id]}</span>
      </header>
      <p class="boss-desc">${b.desc}</p>
      ${b.fund ? `<input type="number" min="0" class="fund-input" id="fund-${b.id}" placeholder="Amount saved" inputmode="numeric" />` : ""}
      <button class="btn primary boss-btn" data-boss="${b.id}">Defeat (+${b.xp} XP)</button>
    </article>`).join("");

  $("#bosses").querySelectorAll("[data-boss]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.boss;
      const fundEl = $(`#fund-${id}`);
      const amount = fundEl ? Math.max(0, Number(fundEl.value) || 0) : 0;
      const res = G.defeatBoss(id, amount);
      if (fundEl) fundEl.value = "";
      renderAll();
      if (amount > 0) toast(`Boss down. +${res.gained} XP and ${formatMoney(amount)} to the Freedom Fund.`, "good");
      else if (res.capped) toast("Boss down — daily 100 XP cap reached.", "");
      else toast(`Boss down. +${res.gained} XP.`, "good");
    });
  });
}

function formatMoney(n) {
  return "Rs " + Number(n).toLocaleString("en-IN");
}

// ---------- attributes radar ----------
function renderRadar() {
  const totals = G.attributeTotals();
  const attrs = G.ATTRIBUTES;
  const max = Math.max(50, ...Object.values(totals));
  const cx = 120, cy = 120, R = 92;
  const n = attrs.length;

  const point = (i, scale) => {
    const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + Math.cos(ang) * R * scale, cy + Math.sin(ang) * R * scale];
  };

  // grid rings
  let grid = "";
  for (let r = 1; r <= 4; r++) {
    const pts = attrs.map((_, i) => point(i, r / 4).join(",")).join(" ");
    grid += `<polygon points="${pts}" class="radar-grid" />`;
  }
  // spokes + labels
  let spokes = "", labels = "";
  attrs.forEach((a, i) => {
    const [x, y] = point(i, 1);
    spokes += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" class="radar-grid" />`;
    const [lx, ly] = point(i, 1.16);
    labels += `<text x="${lx}" y="${ly}" class="radar-label" text-anchor="middle" dominant-baseline="middle">${a.name.slice(0, 4)}</text>`;
  });
  // data polygon
  const dataPts = attrs.map((a, i) => point(i, Math.max(0.04, totals[a.id] / max)).join(",")).join(" ");

  $("#radar").innerHTML = `
    ${grid}${spokes}
    <polygon points="${dataPts}" class="radar-data" />
    ${attrs.map((a, i) => {
      const [x, y] = point(i, Math.max(0.04, totals[a.id] / max));
      return `<circle cx="${x}" cy="${y}" r="3" class="radar-node" />`;
    }).join("")}
    ${labels}`;

  $("#attrLegend").innerHTML = attrs.map((a) => `
    <li><span class="legend-name">${a.name}</span><span class="legend-val">${totals[a.id]}</span></li>
  `).join("");
}

// ---------- hero / header ----------
function renderHero() {
  const info = G.levelInfo();
  const streak = G.currentStreak();
  const todayXp = G.dayXp(G.todayKey());

  $("#topLevel").textContent = `Lv ${info.level}`;
  $("#topTitle").textContent = `The ${info.title}`;
  $("#heroLevel").textContent = info.level;
  $("#heroTitle").textContent = `The ${info.title}`;

  $("#xpFill").style.width = `${info.pct * 100}%`;
  $("#xpText").textContent = info.max
    ? `${info.total} XP — Ascendant`
    : `${info.into} / ${info.need} XP`;

  $("#ringFg").style.strokeDasharray = `${info.pct * RING_CIRC} ${RING_CIRC}`;

  $("#statTotalXp").textContent = info.total;
  $("#statStreak").textContent = streak;
  $("#statToday").innerHTML = `${todayXp}<small>/100</small>`;
  $("#statFund").textContent = formatMoney(G.freedomFund());

  const next = G.nextStreakMilestone(streak);
  $("#streakHint").textContent = next
    ? `${next - streak} more successful day(s) to the next streak bonus.`
    : "Maximum streak tier reached — hold the line.";

  const done = G.mainDoneCount(G.todayKey());
  const badge = $("#mvvBadge");
  badge.textContent = `${done} / 5`;
  badge.className = "badge " + (done >= 5 ? "gold" : done >= 3 ? "good" : "");
}

// ---------- ascension ladder ----------
function renderLadder() {
  const L = G.ladder();

  $("#ladderNext").textContent = L.max ? "Max rank" : `Next: Lv ${L.nextLevel}`;
  $("#ladderNext").className = "badge " + (L.max ? "gold" : "good");
  $("#ladderHint").textContent = L.max
    ? "You have reached the Ascendant — the highest rank of Season 1."
    : `${L.toNext} XP to Level ${L.nextLevel} — The ${L.nextTitle}. (${L.into} / ${L.need} this level)`;

  $("#ladder").innerHTML = L.levels.map((lv) => {
    const range = lv.level < 10 ? `${lv.threshold} XP` : `${lv.threshold} XP`;
    const sub =
      lv.state === "done" ? "Achieved" :
      lv.state === "current" ? "Current rank" :
      `Reach ${lv.threshold} XP`;
    const marker =
      lv.state === "done" ? icon("check") :
      lv.state === "current" ? icon("spark") :
      icon("dot");
    const pct = lv.state === "current" && !L.max ? Math.round(L.into / L.need * 100) : null;
    return `
      <li class="rung ${lv.state}">
        <span class="rung-mark">${marker}</span>
        <span class="rung-num">${lv.level}</span>
        <span class="rung-body">
          <span class="rung-title">The ${lv.title}</span>
          <span class="rung-sub">${sub}${pct !== null ? ` &middot; ${pct}%` : ""}</span>
        </span>
        <span class="rung-xp">${range}</span>
      </li>`;
  }).join("");
}

// ---------- scorecard ----------
function renderScorecard() {
  $("#scorecard").textContent = G.scorecardText();
}

// ---------- level-up detection ----------
function checkLevelUp() {
  const info = G.levelInfo();
  if (info.level > lastLevel) {
    if (core) core.pulse();
    toast(`Level ${info.level} reached — you are now The ${info.title}.`, "level");
  }
  lastLevel = info.level;
}

// ---------- master render ----------
function renderAll() {
  renderHero();
  renderLadder();
  buildQuests();
  buildBosses();
  renderRadar();
  renderScorecard();
  syncCore();
  checkLevelUp();
}

// ---------- system actions ----------
function wireSystem() {
  $("#triggerLog").value = G.getTrigger();
  $("#triggerLog").addEventListener("input", (e) => G.setTrigger(e.target.value));

  $("#sleepCutoff").value = G.getSetting("sleepCutoff") || "23:30";
  $("#sleepCutoff").addEventListener("change", (e) => G.setSetting("sleepCutoff", e.target.value));

  $("#copyScorecard").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(G.scorecardText());
      toast("Scorecard copied.", "good");
    } catch {
      toast("Copy failed — select the text manually.", "");
    }
  });

  $("#exportBtn").addEventListener("click", () => {
    const blob = new Blob([G.exportSave()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ascension-save-${G.todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Save exported.", "good");
  });

  $("#importBtn").addEventListener("click", () => $("#importFile").click());
  $("#importFile").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        G.importSave(reader.result);
        lastLevel = G.levelInfo().level;
        $("#triggerLog").value = G.getTrigger();
        $("#sleepCutoff").value = G.getSetting("sleepCutoff") || "23:30";
        renderAll();
        toast("Save imported.", "good");
      } catch {
        toast("Invalid save file.", "danger");
      }
    };
    reader.readAsText(file);
  });

  $("#resetBtn").addEventListener("click", () => {
    if (confirm("Reset the entire season? This cannot be undone. Consider exporting first.")) {
      G.resetSave();
      lastLevel = 1;
      $("#triggerLog").value = "";
      renderAll();
      toast("Season reset. Day one begins now.", "");
    }
  });
}

// keyboard activation for quest rows
document.addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && e.target.matches?.(".quest")) {
    e.preventDefault();
    e.target.click();
  }
});

// ---------- boot ----------
wireSystem();
renderAll();
initCore();

// PWA service worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
