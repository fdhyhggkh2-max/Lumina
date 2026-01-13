// ===== DAY TIMELINE MODULE START =====
(function () {
  function pad2(n) { return String(n).padStart(2, "0"); }
  function keyFromTs(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  }
  function fmtTime(ts) {
    if (!ts) return "—";
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function mealsOnDay(state, key) {
    const logs = state?.history?.mealLogs || [];
    return logs.filter(m => {
      const t = m.time || m.ts;
      if (!t) return false;
      return keyFromTs(new Date(t).getTime()) === key;
    });
  }

  function hungerOnDay(state, key) {
    const logs = state?.history?.hungerEpisodes || [];
    return logs.filter(h => h?.ts && keyFromTs(h.ts) === key);
  }

  function fastingSessionsOnDay(state, key) {
    const logs = state?.history?.fastingSessions || [];
    return logs.filter(s => {
      const t = s.end || s.start;
      if (!t) return false;
      return keyFromTs(t) === key;
    });
  }

  function missionInfo(state, key) {
    // if missions.js already tracks missionDays, use it
    const md = state?.history?.missionDays || {};
    const day = md[key] || null;

    // fallback: if viewing today
    if (state?.today?.missions?.dateKey === key) {
      const items = state.today.missions.items || [];
      const total = items.reduce((a,x)=>a+(x.points||0),0);
      const done = items.filter(x=>x.done).reduce((a,x)=>a+(x.points||0),0);
      const completed = items.length > 0 && items.every(x=>x.done);
      return { completed, points: done, total };
    }
    return day;
  }

  function openTimeline(state, key) {
    const modal = document.getElementById("timeline-modal");
    const body = document.getElementById("timeline-modal-body");
    if (!modal || !body) return;

    const mi = missionInfo(state, key);
    const fast = fastingSessionsOnDay(state, key);
    const meals = mealsOnDay(state, key);
    const hunger = hungerOnDay(state, key);

    body.innerHTML = `
      <div class="tl-title">${key}</div>

      <div class="tl-section">
        <div class="tl-head">Daily Missions</div>
        <div class="tl-row">
          <span>Status</span>
          <span>${mi ? (mi.completed ? "✅ Completed" : "⏳ In progress") : "— No data"}</span>
        </div>
        <div class="tl-row">
          <span>Points</span>
          <span>${mi ? `${mi.points || 0}/${mi.total || 0}` : "—"}</span>
        </div>
      </div>

      <div class="tl-section">
        <div class="tl-head">Fasting</div>
        <div class="tl-row"><span>Sessions</span><span>${fast.length}</span></div>
        ${fast.map(s => `
          <div class="tl-item">
            ⏳ ${fmtTime(s.start)} → ${fmtTime(s.end)} • Goal ${s.duration || "—"}h
          </div>
        `).join("") || `<div class="tl-empty">No fasting sessions logged.</div>`}
      </div>

      <div class="tl-section">
        <div class="tl-head">Meals</div>
        ${meals.map(m => `
          <div class="tl-item">🥗 ${m.text || "Meal"} • ${fmtTime(new Date(m.time || m.ts).getTime())} • Hunger ${m.hunger ?? "—"}</div>
        `).join("") || `<div class="tl-empty">No meals logged.</div>`}
      </div>

      <div class="tl-section">
        <div class="tl-head">Hunger episodes</div>
        ${hunger.map(h => `
          <div class="tl-item">😫 Level ${h.hungerLevel ?? "—"} • ${fmtTime(h.ts)} • Action ${h.userAction ?? "—"}</div>
        `).join("") || `<div class="tl-empty">No hunger episodes logged.</div>`}
      </div>

      <div class="tl-hint">This is your “truth log” — it makes your habits real.</div>
    `;

    modal.style.display = "flex";
  }

  function closeTimeline() {
    const modal = document.getElementById("timeline-modal");
    if (modal) modal.style.display = "none";
  }

  window.TimelineUI = { openTimeline, closeTimeline };
})();
// ===== DAY TIMELINE MODULE END =====
