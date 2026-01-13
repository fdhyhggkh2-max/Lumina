(() => {
  const STORAGE_KEY = "lumina_rap_studio_v1";
  const els = {};

  function byId(id) {
    return document.getElementById(id);
  }

  function uid() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function getDefaultState() {
    return {
      mode: "Warmup",
      topic: "",
      vibe: "",
      prompts: [],
      autosaveText: "",
      drafts: []
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : null;
      if (!data || typeof data !== "object") return getDefaultState();
      return {
        mode: data.mode || "Warmup",
        topic: data.topic || "",
        vibe: data.vibe || "",
        prompts: Array.isArray(data.prompts) ? data.prompts : [],
        autosaveText: data.autosaveText || "",
        drafts: Array.isArray(data.drafts) ? data.drafts : []
      };
    } catch (e) {
      return getDefaultState();
    }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  // ===== RAP STUDIO START =====
  function getGenericTopic(topic) {
    if (topic) return topic;
    const pool = ["ambition", "city nights", "comeback", "discipline", "focus"];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function buildPrompts(mode, topic, vibe) {
    const pickedTopic = getGenericTopic(topic);
    const vibeText = vibe ? ` Vibe: ${vibe}.` : "";
    const templates = {
      Warmup: [
        `8 bars, internal rhymes every line. Topic: ${pickedTopic}.${vibeText}`,
        `Write 4 bars using only 8-10 syllables per line. Topic: ${pickedTopic}.${vibeText}`,
        `Alliteration drill: start each line with the same letter. Topic: ${pickedTopic}.${vibeText}`,
        `AABB rhyme scheme, 8 bars. Topic: ${pickedTopic}.${vibeText}`,
        `Slow flow at 80bpm, focus on clarity. Topic: ${pickedTopic}.${vibeText}`
      ],
      Storytelling: [
        `12–16 bars with a clear beginning, middle, end. Topic: ${pickedTopic}.${vibeText}`,
        `Start with a scene, add conflict by bar 8, resolve by bar 16.`,
        `Use 3 vivid images and one dialogue line. Topic: ${pickedTopic}.${vibeText}`,
        `Tell it in past tense, then flip to present in the last 4 bars.`,
        `Narrate from someone else's perspective. Topic: ${pickedTopic}.${vibeText}`
      ],
      Punchlines: [
        `Write 10 setup + punchline pairs. Topic: ${pickedTopic}.${vibeText}`,
        `Each punchline must use a double meaning word.`,
        `Use a sports metaphor in every other bar.`,
        `Keep punchlines under 7 words each.`,
        `End every punchline with a hard consonant.`
      ],
      Freestyle: [
        `60 seconds nonstop: ${pickedTopic}.${vibeText}`,
        `2 minutes: switch flow every 4 bars.`,
        `1 minute: rhyme the last 2 words each line.`,
        `90 seconds: no repeats, new images every line.`,
        `Freestyle off 3 random words: clock, glass, asphalt.`
      ],
      Hook: [
        `Create 3 hook ideas, 6–8 words each. Topic: ${pickedTopic}.${vibeText}`,
        `Write a call-and-response hook with a simple echo phrase.`,
        `Use a melodic cadence: long-short-short. Topic: ${pickedTopic}.${vibeText}`,
        `Build a hook around one strong keyword, repeat it 3 times.`,
        `Try a chant-style hook with crowd energy.`
      ]
    };
    return templates[mode] || templates.Warmup;
  }

  function renderPrompts(state) {
    if (!els.prompts) return;
    els.prompts.innerHTML = "";
    if (!state.prompts.length) {
      const empty = document.createElement("div");
      empty.className = "rap-empty";
      empty.textContent = "No prompts yet.";
      els.prompts.appendChild(empty);
      return;
    }
    state.prompts.forEach((prompt, index) => {
      const row = document.createElement("div");
      row.className = "rap-prompt-row";
      const text = document.createElement("div");
      text.className = "rap-prompt-text";
      text.textContent = prompt;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "rap-button small";
      btn.textContent = "Copy";
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        copyText(prompt);
      });
      row.appendChild(text);
      row.appendChild(btn);
      row.addEventListener("click", () => {
        if (!els.draft) return;
        const current = els.draft.value || "";
        els.draft.value = `${prompt}\n\n${current}`.trim();
        state.autosaveText = els.draft.value;
        saveState(state);
      });
      els.prompts.appendChild(row);
    });
  }

  function renderDrafts(state) {
    if (!els.draftsList) return;
    els.draftsList.innerHTML = "";
    if (!state.drafts.length) {
      const empty = document.createElement("div");
      empty.className = "rap-empty";
      empty.textContent = "No drafts saved yet.";
      els.draftsList.appendChild(empty);
      return;
    }
    state.drafts.forEach(draft => {
      const row = document.createElement("div");
      row.className = "rap-draft-row";
      const info = document.createElement("div");
      info.className = "rap-draft-info";
      const title = document.createElement("div");
      title.className = "rap-draft-title";
      title.textContent = draft.title || "Untitled draft";
      const meta = document.createElement("div");
      meta.className = "rap-draft-meta";
      meta.textContent = new Date(draft.ts).toLocaleString();
      info.appendChild(title);
      info.appendChild(meta);
      const del = document.createElement("button");
      del.type = "button";
      del.className = "rap-button small danger";
      del.textContent = "Delete";
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        state.drafts = state.drafts.filter(d => d.id !== draft.id);
        saveState(state);
        renderDrafts(state);
      });
      row.appendChild(info);
      row.appendChild(del);
      row.addEventListener("click", () => {
        if (!els.draft) return;
        els.draft.value = draft.text || "";
        state.autosaveText = els.draft.value;
        saveState(state);
      });
      els.draftsList.appendChild(row);
    });
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
      return;
    }
    const helper = document.createElement("textarea");
    helper.value = text;
    helper.setAttribute("readonly", "");
    helper.style.position = "absolute";
    helper.style.left = "-9999px";
    document.body.appendChild(helper);
    helper.select();
    document.execCommand("copy");
    document.body.removeChild(helper);
  }

  function bindEvents(state) {
    if (els.mode) {
      els.mode.addEventListener("change", () => {
        state.mode = els.mode.value;
        saveState(state);
      });
    }
    if (els.topic) {
      els.topic.addEventListener("input", () => {
        state.topic = els.topic.value;
        saveState(state);
      });
    }
    if (els.vibe) {
      els.vibe.addEventListener("input", () => {
        state.vibe = els.vibe.value;
        saveState(state);
      });
    }
    if (els.generate) {
      els.generate.addEventListener("click", () => {
        state.prompts = buildPrompts(state.mode, state.topic, state.vibe).slice(0, 5);
        saveState(state);
        renderPrompts(state);
      });
    }
    if (els.draft) {
      els.draft.addEventListener("input", () => {
        state.autosaveText = els.draft.value;
        saveState(state);
      });
    }
    if (els.save) {
      els.save.addEventListener("click", () => {
        const text = (els.draft && els.draft.value.trim()) || "";
        if (!text) return;
        const titleParts = [state.mode, state.topic].filter(Boolean);
        const title = titleParts.length ? titleParts.join(" - ") : "Rap Draft";
        state.drafts.unshift({ id: uid(), ts: Date.now(), title, text });
        state.drafts = state.drafts.slice(0, 50);
        saveState(state);
        renderDrafts(state);
      });
    }
    if (els.newDraft) {
      els.newDraft.addEventListener("click", () => {
        if (!els.draft) return;
        els.draft.value = "";
        state.autosaveText = "";
        saveState(state);
      });
    }
    if (els.exportDrafts) {
      els.exportDrafts.addEventListener("click", () => {
        const dataStr = JSON.stringify(state.drafts, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "rap-drafts.json";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      });
    }
  }

  function cacheElements() {
    els.mode = byId("rap-mode");
    els.topic = byId("rap-topic");
    els.vibe = byId("rap-vibe");
    els.generate = byId("rap-generate");
    els.prompts = byId("rap-prompts");
    els.draft = byId("rap-draft");
    els.save = byId("rap-save");
    els.newDraft = byId("rap-new");
    els.exportDrafts = byId("rap-export");
    els.draftsList = byId("rap-drafts-list");
  }

  function init() {
    if (!byId("screen-coach")) return;
    cacheElements();
    const state = loadState();
    if (els.mode) els.mode.value = state.mode;
    if (els.topic) els.topic.value = state.topic;
    if (els.vibe) els.vibe.value = state.vibe;
    if (els.draft) els.draft.value = state.autosaveText;
    renderPrompts(state);
    renderDrafts(state);
    bindEvents(state);
  }
  // ===== RAP STUDIO END =====

  window.Coach = { init };
})();
