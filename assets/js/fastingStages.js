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
})();
// === FASTING STAGES HELPERS (GLOBAL) — END ===
