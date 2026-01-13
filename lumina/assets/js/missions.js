// ===== DAILY MISSIONS MODULE START =====
(function () {
  const DEFAULT_MISSIONS = () => ([
    { id: "rap_8bars",   area: "studio",   title: "Write 8 bars",           detail: "Use your real life story. Keep it raw.", points: 15, done: false },
    { id: "rap_freestyle", area: "studio", title: "Freestyle 5 minutes",    detail: "No stopping. Record if possible.",       points: 10, done: false },
    { id: "ex_move",    area: "exercise", title: "Move 20 minutes",         detail: "Walk / mobility / light workout",        points: 15, done: false },
    { id: "fast_plan",  area: "fasting",  title: "Plan your fast",          detail: "Pick 12/16/18/20/24 and commit.",        points: 10, done: false }
  ]);

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function ensureMissionsState(state) {
    // missionState lives under state.today.missions + state.history.missionDays
    if (!state.today) state.today = {};
    if (!state.history) state.history = {};
    if (!state.today.missions) {
      state.today.missions = { dateKey: todayKey(), items: [], difficulty: 2 }; // 1 easy, 2 normal, 3 hard
    }
    if (!state.history.missionDays) state.history.missionDays = {}; // { "YYYY-MM-DD": { completed: true/false, points: number } }
  }

  function autoResetIfNewDay(state) {
    ensureMissionsState(state);
    const tk = todayKey();
    if (state.today.missions.dateKey !== tk) {
      // roll yesterday into history
      finalizeDay(state);
      // reset
      state.today.missions = { dateKey: tk, items: [], difficulty: 2 };
    }
  }

  function buildPlan(state) {
    ensureMissionsState(state);
    const f = state.today?.fasting;
    const energy = Number(state.today?.energy || 3);

    // difficulty affects intensity/volume
    const diff = state.today.missions.difficulty || 2;

    // base set
    let plan = DEFAULT_MISSIONS();

    // Adjust fasting mission depending on active fast
    if (f?.active) {
      plan = plan.map(m => m.id === "fast_plan"
        ? { ...m, id: "fast_complete", title: "Complete your fast window", detail: `Stay consistent. Remaining: ${window.getRemainingMs ? window.formatHM(window.getRemainingMs(f)) : "—"}`, points: 20 }
        : m
      );
    } else {
      plan = plan.map(m => m.id === "fast_plan"
        ? { ...m, title: "Start a fast today", detail: "Use the assistant fast button or type: start fast 16", points: 15 }
        : m
      );
    }

    // Adjust exercise mission based on energy
    if (energy <= 2) {
      plan = plan.map(m => m.area === "exercise"
        ? { ...m, title: "Recovery move 10 minutes", detail: "Walk + stretch. Keep it easy.", points: 10 }
        : m
      );
    } else if (energy >= 4 && diff >= 2) {
      plan = plan.map(m => m.area === "exercise"
        ? { ...m, title: diff === 3 ? "Workout 45 minutes" : "Workout 30 minutes", detail: "Strength + short cardio finisher.", points: diff === 3 ? 30 : 25 }
        : m
      );
    }

    // Adjust rap mission based on difficulty
    plan = plan.map(m => {
      if (m.id === "rap_8bars") {
        if (diff === 1) return { ...m, title: "Write 4 bars", points: 10 };
        if (diff === 3) return { ...m, title: "Write 16 bars", points: 25 };
      }
      if (m.id === "rap_freestyle") {
        if (diff === 1) return { ...m, title: "Freestyle 2 minutes", points: 6 };
        if (diff === 3) return { ...m, title: "Freestyle 10 minutes", points: 18 };
      }
      return m;
    });

    // preserve completion if already exists (same day)
    const prev = state.today.missions.items || [];
    const prevById = Object.fromEntries(prev.map(x => [x.id, x]));
    plan = plan.map(m => prevById[m.id] ? { ...m, done: !!prevById[m.id].done } : m);

    state.today.missions.items = plan;
  }

  function pointsSummary(state) {
    ensureMissionsState(state);
    const items = state.today.missions.items || [];
    const total = items.reduce((a,x)=>a+(x.points||0),0);
    const done = items.filter(x=>x.done).reduce((a,x)=>a+(x.points||0),0);
    const completedAll = items.length > 0 && items.every(x=>x.done);
    return { total, done, completedAll };
  }

  function computeMissionStreak(state) {
    ensureMissionsState(state);
    const days = state.history.missionDays || {};
    let streak = 0;
    let cur = new Date();
    for (;;) {
      const k = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}-${String(cur.getDate()).padStart(2,'0')}`;
      if (days[k]?.completed) {
        streak++;
        cur.setDate(cur.getDate()-1);
      } else {
        // allow today incomplete without breaking streak display
        const tk = todayKey();
        if (streak === 0 && k === tk) {
          cur.setDate(cur.getDate()-1);
          continue;
        }
        break;
      }
    }
    return streak;
  }

  function finalizeDay(state) {
    ensureMissionsState(state);
    const key = state.today.missions.dateKey;
    const { done, total, completedAll } = pointsSummary(state);
    state.history.missionDays[key] = { completed: completedAll, points: done, total };
  }

  function renderMissionsCard(state, onSave) {
    ensureMissionsState(state);
    autoResetIfNewDay(state);
    if (!state.today.missions.items || state.today.missions.items.length === 0) buildPlan(state);

    const host = document.getElementById("missions-card");
    if (!host) return;

    const { total, done, completedAll } = pointsSummary(state);
    const streak = computeMissionStreak(state);

    host.innerHTML = `
      <div class="dash-title-row">
        <div class="dash-title">Today Plan</div>
        <div class="dash-streak">🔥 Streak: <span id="mission-streak">${streak}</span></div>
      </div>

      <div class="missions-meta">
        <div class="missions-points">
          <span class="mp-big">${done}</span><span class="mp-dim">/${total} pts</span>
          <span class="mp-badge">${completedAll ? "Complete ✅" : "In progress"}</span>
        </div>

        <div class="missions-actions">
          <button class="mini-btn" id="mission-easier" type="button">Easier</button>
          <button class="mini-btn" id="mission-harder" type="button">Harder</button>
          <button class="mini-btn" id="mission-regenerate" type="button">Regenerate</button>
        </div>
      </div>

      <div class="missions-list" id="missions-list">
        ${state.today.missions.items.map(m => `
          <button class="mission-item ${m.done ? "done":""}" data-id="${m.id}" type="button">
            <div class="mi-left">
              <div class="mi-title">${m.title}</div>
              <div class="mi-detail">${m.detail}</div>
            </div>
            <div class="mi-right">
              <div class="mi-points">+${m.points}</div>
              <div class="mi-check">${m.done ? "✓" : ""}</div>
            </div>
          </button>
        `).join("")}
      </div>
    `;

    // item toggle
    host.querySelectorAll(".mission-item").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const item = state.today.missions.items.find(x => x.id === id);
        if (!item) return;
        item.done = !item.done;
        if (onSave) onSave();
        renderMissionsCard(state, onSave);
      });
    });

    // difficulty controls
    const setDiff = (d) => {
      state.today.missions.difficulty = Math.max(1, Math.min(3, d));
      buildPlan(state);
      if (onSave) onSave();
      renderMissionsCard(state, onSave);
    };

    const easier = host.querySelector("#mission-easier");
    const harder = host.querySelector("#mission-harder");
    const regen = host.querySelector("#mission-regenerate");

    if (easier) easier.onclick = () => setDiff((state.today.missions.difficulty || 2) - 1);
    if (harder) harder.onclick = () => setDiff((state.today.missions.difficulty || 2) + 1);
    if (regen) regen.onclick = () => { buildPlan(state); if (onSave) onSave(); renderMissionsCard(state, onSave); };
  }

  // Expose minimal API
  window.Missions = {
    ensureMissionsState,
    autoResetIfNewDay,
    buildPlan,
    finalizeDay,
    renderMissionsCard,
    computeMissionStreak
  };
})();
// ===== DAILY MISSIONS MODULE END =====
