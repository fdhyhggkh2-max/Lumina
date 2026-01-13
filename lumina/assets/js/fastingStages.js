// assets/js/fastingStages.js
// === FASTING STAGES HELPERS (GLOBAL) — START ===
(() => {
  window.MILESTONES_HOURS = [0, 12, 16, 24];

  window.getStageInfo = function (elapsedHours) {
    if (elapsedHours < 12) {
      return { stage: "Blood sugar dropping", nextAt: 12, nextLabel: "Ketosis beginning" };
    }
    if (elapsedHours < 16) {
      return { stage: "Ketosis beginning", nextAt: 16, nextLabel: "Autophagy ramping" };
    }
    if (elapsedHours < 24) {
      return { stage: "Autophagy ramping", nextAt: 24, nextLabel: "Extended fast" };
    }
    return { stage: "Extended fast", nextAt: null, nextLabel: "—" };
  };

  window.formatHM = function (ms) {
    if (ms <= 0) return "0h 0m";
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}h ${m}m`;
  };

  window.formatTime = function (ts) {
    if (!ts) return "—";
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  window.getRemainingMs = function (fasting) {
    if (!fasting || !fasting.active) return 0;
    const end = fasting.start + fasting.duration * 3600000;
    return end - Date.now();
  };

  // keep this name to match your current app.js calls
  window.elapsedMs = function (fasting) {
    if (!fasting || !fasting.active) return 0;
    return Date.now() - fasting.start;
  };

  window.getElapsedMs = function (fasting) {
    return window.elapsedMs(fasting);
  };
})();
// === FASTING STAGES HELPERS (GLOBAL) — END ===

// ===== FASTING STAGE EXPLORER DATA START =====
window.STAGE_LIBRARY = [
  {
    at: 0,
    title: "Fed → Fasting transition",
    body: "Insulin begins dropping. Body starts switching from recent meals to stored energy.",
    benefits: ["Cravings may spike early", "Hydration matters", "Light movement helps appetite"],
    tips: ["Water + salt", "Avoid sugar triggers", "Stay busy 20–30 min"]
  },
  {
    at: 12,
    title: "Ketosis beginning",
    body: "Glycogen is lower. Fat oxidation increases. Hunger can come in waves.",
    benefits: ["More stable energy for many people", "Reduced snacking urge", "Better mental clarity (often)"],
    tips: ["Walk 10 minutes", "Black coffee/tea", "Electrolytes if needed"]
  },
  {
    at: 16,
    title: "Autophagy ramping",
    body: "Cellular cleanup signals increase. Inflammation markers may improve (varies).",
    benefits: ["Discipline momentum", "Potential recovery support", "Sharper focus (often)"],
    tips: ["Keep training moderate", "Avoid binge when breaking fast", "Protein-first meal"]
  },
  {
    at: 24,
    title: "Extended fast zone",
    body: "Deep fasting state. Be careful: listen to your body and stay safe.",
    benefits: ["Strong habit reinforcement", "Simplicity: fewer meals", "Potential appetite reset"],
    tips: ["Prioritize electrolytes", "Break fast gently", "Don’t push max intensity workouts"]
  }
];

window.getStageByHours = function (elapsedHours) {
  const lib = window.STAGE_LIBRARY || [];
  if (!lib.length) return null;

  // if elapsedHours matches preview milestone, return exact; else choose nearest lower milestone
  let pick = lib[0];
  for (const s of lib) {
    if (elapsedHours >= s.at) pick = s;
  }
  // next milestone
  const next = lib.find(s => s.at > pick.at) || null;
  return { current: pick, next };
};
// ===== FASTING STAGE EXPLORER DATA END =====
