// ===== PROGRESS CALENDAR MODULE START =====
(function () {
  function pad2(n) { return String(n).padStart(2, "0"); }
  function dateKeyFromYMD(y,m,d) { return `${y}-${pad2(m)}-${pad2(d)}`; }

  function monthMeta(date) {
    const y = date.getFullYear();
    const m = date.getMonth(); // 0-based
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    return { y, m, first, last, daysInMonth: last.getDate() };
  }

  function countFastingSessionsOnDay(state, key) {
    const sessions = state?.history?.fastingSessions || [];
    let c = 0;
    for (const s of sessions) {
      const ts = (s.end || s.start);
      if (!ts) continue;
      const d = new Date(ts);
      const k = `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
      if (k === key) c++;
    }
    return c;
  }

  function getMissionDay(state, key) {
    const md = state?.history?.missionDays || {};
    // If viewing today, we can also compute live completion
    if (state?.today?.missions?.dateKey === key) {
      const items = state.today.missions.items || [];
      const total = items.reduce((a,x)=>a+(x.points||0),0);
      const done = items.filter(x=>x.done).reduce((a,x)=>a+(x.points||0),0);
      const completed = items.length>0 && items.every(x=>x.done);
      return { completed, points: done, total, live: true };
    }
    return md[key] || null;
  }

  function renderCalendar(state) {
    const host = document.getElementById("calendar-card");
    if (!host) return;

    if (!window.__cal) {
      window.__cal = { current: new Date() };
    }

    const { y, m, first, daysInMonth } = monthMeta(window.__cal.current);
    const startDay = first.getDay(); // 0 Sun
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${pad2(today.getMonth()+1)}-${pad2(today.getDate())}`;

    const monthName = window.__cal.current.toLocaleString([], { month: "long", year: "numeric" });

    // Build 6 weeks x 7 = 42 cells
    const cells = [];
    let dayNum = 1 - startDay;
    for (let i=0;i<42;i++,dayNum++) {
      const inMonth = dayNum>=1 && dayNum<=daysInMonth;
      if (!inMonth) {
        cells.push({ inMonth:false, d:null, key:null });
      } else {
        const key = dateKeyFromYMD(y, m+1, dayNum);
        cells.push({ inMonth:true, d:dayNum, key });
      }
    }

    host.innerHTML = `
      <div class="dash-title-row">
        <div class="dash-title">Progress Calendar</div>
        <div class="cal-controls">
          <button class="mini-btn" id="cal-prev" type="button">‹</button>
          <div class="cal-month">${monthName}</div>
          <button class="mini-btn" id="cal-next" type="button">›</button>
        </div>
      </div>

      <div class="cal-weekdays">
        <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
      </div>

      <div class="cal-grid" id="cal-grid">
        ${cells.map(c=>{
          if (!c.inMonth) return `<button class="cal-cell empty" type="button" disabled></button>`;
          const md = getMissionDay(state, c.key);
          const fastCount = countFastingSessionsOnDay(state, c.key);
          const isToday = c.key === todayKey;

          const missionOk = md?.completed;
          const missionAny = md != null;
          const dots = `
            <div class="cal-dots">
              ${missionAny ? `<span class="dot ${missionOk ? "ok" : "partial"}" title="Missions"></span>` : `<span class="dot none"></span>`}
              ${fastCount>0 ? `<span class="dot fast" title="Fasting"></span>` : `<span class="dot none"></span>`}
            </div>
          `;

          return `
            <button class="cal-cell ${isToday ? "today":""} ${missionOk ? "mission-ok": missionAny ? "mission-any":""}" data-key="${c.key}" type="button">
              <div class="cal-day">${c.d}</div>
              ${dots}
            </button>
          `;
        }).join("")}
      </div>
    `;

    // Controls
    host.querySelector("#cal-prev").onclick = () => {
      const d = window.__cal.current;
      window.__cal.current = new Date(d.getFullYear(), d.getMonth()-1, 1);
      renderCalendar(state);
    };
    host.querySelector("#cal-next").onclick = () => {
      const d = window.__cal.current;
      window.__cal.current = new Date(d.getFullYear(), d.getMonth()+1, 1);
      renderCalendar(state);
    };

    // ===== CALENDAR → TIMELINE WIRE START =====
    host.querySelectorAll(".cal-cell[data-key]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const key = btn.getAttribute("data-key");
        if (window.TimelineUI) window.TimelineUI.openTimeline(state, key);
        else openDayModal(state, key);
      });
    });
    // ===== CALENDAR → TIMELINE WIRE END =====
  }

  function openDayModal(state, key) {
    const modal = document.getElementById("calendar-modal");
    const body = document.getElementById("calendar-modal-body");
    if (!modal || !body) return;

    const md = getMissionDay(state, key);
    const fastCount = countFastingSessionsOnDay(state, key);

    const missionsLine = md
      ? `${md.completed ? "✅ Completed" : "⏳ In progress"} — ${md.points || 0}/${md.total || 0} pts`
      : "— No missions data saved";

    body.innerHTML = `
      <div class="cal-modal-title">${key}</div>
      <div class="cal-modal-row"><span>Missions</span><span>${missionsLine}</span></div>
      <div class="cal-modal-row"><span>Fasting sessions</span><span>${fastCount}</span></div>
      <div class="cal-modal-hint">Tip: keep stacking small wins daily — streaks build momentum.</div>
    `;

    modal.style.display = "flex";
  }

  function closeDayModal() {
    const modal = document.getElementById("calendar-modal");
    if (modal) modal.style.display = "none";
  }

  window.CalendarUI = { renderCalendar, openDayModal, closeDayModal };
})();
// ===== PROGRESS CALENDAR MODULE END =====
