const STATE_VERSION = 2;
        const APP_KEY = 'lumina_v1_data';

        // ===== PWA REGISTER START =====
        if ("serviceWorker" in navigator) {
          window.addEventListener("load", () => {
            navigator.serviceWorker.register("./sw.js").catch(()=>{});
          });
        }
        // ===== PWA REGISTER END =====

        const STRINGS = {
            HELP: { en: "How can I help you? Try: 'start fast 16', 'log meal: salad', or update your profile ('strictness 4', 'avoid sugar').", es: "¿Cómo puedo ayudarte? Prueba: 'empezar ayuno 16', 'comida: ensalada', o actualiza tu perfil ('severo 4', 'evitar azucar')." },
            STATUS_FASTING: { en: "You are currently fasting. Stay focused!", es: "Estás en medio de un ayuno. ¡Sigue así!" },
            STATUS_FEEDING: { en: "You are in your feeding window.", es: "Estás en tu ventana de alimentación." },
            TIMER_LEFT: { en: "You have {time} remaining.", es: "Te faltan {time}." },
            STARTED_FAST: { en: "Fast activated for {dur} hours. Good luck!", es: "Ayuno activado por {dur} horas. ¡Buena suerte!" },
            ENDED_FAST: { en: "Fast ended. Break your fast wisely!", es: "Ayuno terminado. ¡Rompe el ayuno con sabiduría!" },
            LOGGED_MEAL: { en: "Meal logged: {meal}.", es: "Comida registrada: {meal}." },
            ASK_SPECIFIC: { en: "Can you be more specific?", es: "¿Puedes ser más específico?" },
            HUNGER_FOLLOWUP: { en: "How are you coping? 1) Water 2) Salt 3) Walk 4) Breath 5) End fast", es: "¿Cómo lo llevas? 1) Agua 2) Sal 3) Caminar 4) Respirar 5) Terminar" },
            PROFILE_SAVED: { en: "Profile updated.", es: "Perfil actualizado." },
            REMEDY_CONFIRM: { en: "Logged your choice: {remedy}. Keep it up!", es: "Registré tu opción: {remedy}. ¡Sigue así!" }
        };

        const REMEDIES = {
            en: ["None", "Water", "Salt", "Walk", "Breath", "End Fast"],
            es: ["Ninguno", "Agua", "Sal", "Caminar", "Respirar", "Terminar"]
        };

        function localDateKey(ts) {
            const d = new Date(ts);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }

        // RED FLAG: COACH STATE START
        // RED FLAG: STATE DEFAULTS START
        function getDefaultStateV2() {
            return {
                meta: { version: STATE_VERSION, updatedAt: Date.now() },
                profile: { 
                    goal: "fat loss + energy", streak: 0, langPref: "auto", lastLang: "en", strictness: 3,
                    wakeTime: "", sleepTime: "", avoidFoods: [], favoriteFoods: [], notes: "",
                    voiceReplies: false
                },
                today: { 
                    fasting: { active: false, start: null, duration: 16, note: "" }, 
                    meals: [], 
                    hunger: 3, 
                    energy: 3,
                    checklist: { rap: false, exercise: false, fasting: false },
                    hydration: 3,
                    exerciseLogs: []
                },
                history: { fastingSessions: [], mealLogs: [], hungerEpisodes: [], exerciseLogs: [] },
                coach: {
                    meta: { version: 1, updatedAt: Date.now() },
                    focusHistory: { rap: [], exercise: [], fasting: [] },
                    rapDrafts: [],
                    rapLastPrompts: [],
                    exerciseLogs: []
                },
                chat: [{ role: 'assistant', content: "Hello, I'm Lumina. How are you feeling right now?", ts: Date.now() }]
            };
        }
        // RED FLAG: STATE DEFAULTS END

        let state = getDefaultStateV2();
        let recognition = null;

        // ------------------------------
// Bottom Nav: screen switching
// ------------------------------
function showScreen(screenName) {
  // Preferred: data-screen
  let screens = document.querySelectorAll('[data-screen]');

  // Fallback: if your HTML doesn't have data-screen yet, use IDs
  if (!screens || screens.length === 0) {
    const ids = ['dashboard', 'fasting', 'coach', 'exercise', 'profile'];
    screens = ids
      .map(id => document.getElementById(id))
      .filter(Boolean);
  }

  screens.forEach(el => {
    const key = el.getAttribute?.('data-screen') || el.id;
    const isTarget = key === screenName;
    el.classList.toggle('hidden', !isTarget);
  });

  // Active tab styling
  const tabs = document.querySelectorAll('.bottom-nav .tab');
  tabs.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === screenName);
  });

  try { localStorage.setItem('lumina_active_tab', screenName); } catch(e) {}
}

function initBottomNav() {
  const nav = document.querySelector('.bottom-nav');
  if (!nav) return;

  nav.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    const tab = btn.dataset.tab;
    if (!tab) return;
    showScreen(tab);
  });

  // Restore last tab (default dashboard)
  let saved = null;
  try { saved = localStorage.getItem('lumina_active_tab'); } catch(e) {}
  if (saved && !document.querySelector(`.bottom-nav .tab[data-tab="${saved}"]`)) {
    saved = null;
  }
  showScreen(saved || 'dashboard');
}

// Call this inside window.onload after loadState()

        // RED FLAG: STATE NORMALIZE START
        function normalizeState(saved) {
            const base = getDefaultStateV2();
            if (!saved) return base;
            
            const merged = { ...base, ...saved };
            merged.profile = { ...base.profile, ...saved.profile };
            merged.today = { ...base.today, ...saved.today };
            merged.today.fasting = { ...base.today.fasting, ...(saved.today ? saved.today.fasting : {}) };
            merged.history = { ...base.history, ...saved.history };
            merged.coach = { ...base.coach, ...(saved.coach || {}) };

            merged.chat = Array.isArray(saved.chat) ? saved.chat : base.chat;
            merged.today.meals = Array.isArray(merged.today.meals) ? merged.today.meals : [];
            merged.history.fastingSessions = Array.isArray(merged.history.fastingSessions) ? merged.history.fastingSessions : [];
            merged.history.mealLogs = Array.isArray(merged.history.mealLogs) ? merged.history.mealLogs : [];
            merged.history.hungerEpisodes = Array.isArray(merged.history.hungerEpisodes) ? merged.history.hungerEpisodes : [];
            merged.history.exerciseLogs = Array.isArray(merged.history.exerciseLogs) ? merged.history.exerciseLogs : [];
            merged.profile.avoidFoods = Array.isArray(merged.profile.avoidFoods) ? merged.profile.avoidFoods : [];
            merged.profile.favoriteFoods = Array.isArray(merged.profile.favoriteFoods) ? merged.profile.favoriteFoods : [];
            merged.coach.focusHistory = merged.coach.focusHistory || { rap: [], exercise: [], fasting: [] };
            merged.coach.focusHistory.rap = Array.isArray(merged.coach.focusHistory.rap) ? merged.coach.focusHistory.rap : [];
            merged.coach.focusHistory.exercise = Array.isArray(merged.coach.focusHistory.exercise) ? merged.coach.focusHistory.exercise : [];
            merged.coach.focusHistory.fasting = Array.isArray(merged.coach.focusHistory.fasting) ? merged.coach.focusHistory.fasting : [];
            merged.coach.rapDrafts = Array.isArray(merged.coach.rapDrafts) ? merged.coach.rapDrafts : [];
            merged.coach.rapLastPrompts = Array.isArray(merged.coach.rapLastPrompts) ? merged.coach.rapLastPrompts : [];
            merged.coach.exerciseLogs = Array.isArray(merged.coach.exerciseLogs) ? merged.coach.exerciseLogs : [];
            merged.today.checklist = merged.today.checklist || { rap: false, exercise: false, fasting: false };
            merged.today.exerciseLogs = Array.isArray(merged.today.exerciseLogs) ? merged.today.exerciseLogs : [];

            merged.today.hunger = Number(merged.today.hunger) || 3;
            merged.today.energy = Number(merged.today.energy) || 3;
            merged.today.hydration = Number(merged.today.hydration) || 3;
            merged.profile.strictness = Number(merged.profile.strictness) || 3;
            // ===== DAILY MISSIONS INTEGRATION START =====
            if (window.Missions) window.Missions.ensureMissionsState(merged);
            // ===== DAILY MISSIONS INTEGRATION END =====

            return merged;
        }
        // RED FLAG: STATE NORMALIZE END

        function loadState() {
            try {
                const savedRaw = localStorage.getItem(APP_KEY);
                state = normalizeState(savedRaw ? JSON.parse(savedRaw) : null);
                // ===== DAILY MISSIONS INTEGRATION START =====
                if (window.Missions) window.Missions.autoResetIfNewDay(state);
                // ===== DAILY MISSIONS INTEGRATION END =====
                updateDerivedStats();
                renderChat();
            } catch (e) { state = getDefaultStateV2(); }
            updateUI();
        }

        function saveState() {
            state.meta.updatedAt = Date.now();
            localStorage.setItem(APP_KEY, JSON.stringify(state));
        }

        function computeStreakFromSessions(sessions) {
            if (!sessions || sessions.length === 0) return 0;
            const dates = new Set(sessions.map(s => localDateKey(s.end || s.start)));
            let streak = 0; let current = new Date();
            while (true) {
                const dateStr = localDateKey(current.getTime());
                if (dates.has(dateStr)) { streak++; current.setDate(current.getDate() - 1); } 
                else {
                    if (streak === 0 && dateStr === localDateKey(Date.now())) { current.setDate(current.getDate() - 1); continue; }
                    break;
                }
            }
            return streak;
        }

        function updateDerivedStats() {
            state.profile.streak = computeStreakFromSessions(state.history.fastingSessions);
            const streakNodes = ['chip-streak', 'dash-streak'];
            streakNodes.forEach(id => {
                const node = document.getElementById(id);
                if (node) node.innerText = `🔥 Streak: ${state.profile.streak}`;
            });
        }

        function detectLang(text) {
            if (state.profile.langPref !== "auto") return state.profile.langPref;
            const esWords = ['hambre', 'ayuno', 'comida', 'falta', 'energia', 'comenzar', 'terminar', 'hola', 'idioma', 'perfil', 'evito', 'me gusta', 'severo', 'voz'];
            return esWords.some(w => text.toLowerCase().includes(w)) ? 'es' : 'en';
        }

        function t(key, lang, vars = {}) {
            let msg = STRINGS[key][lang] || STRINGS[key]['en'];
            for (let v in vars) msg = msg.replace(`{${v}}`, vars[v]);
            return msg;
        }

        function parseIntent(text) {
            const raw = text.toLowerCase().trim();
            if (raw.match(/(set )?(hunger|hambre) [1-5]/)) return { type: 'SET_HUNGER', data: parseInt(raw.match(/[1-5]/)[0]) };
            if (raw.match(/(set )?(energy|energia) [1-5]/)) return { type: 'SET_ENERGY', data: parseInt(raw.match(/[1-5]/)[0]) };
            if (raw.match(/(start|comenzar) (fast|ayuno) \d+/)) return { type: 'START_FAST', data: parseInt(raw.match(/\d+/)[0]) };
            if (raw.match(/(end|stop|terminar) (fast|ayuno)/)) return { type: 'END_FAST' };
            if (raw.match(/(log )?(meal|comida):/)) return { type: 'LOG_MEAL', data: text.split(':').slice(1).join(':').trim() };
            
            if (raw === "perfil" || raw === "show profile") return { type: 'SHOW_PROFILE' };
            if (raw.includes("language") || raw.includes("idioma")) {
                const lang = raw.includes("spanish") || raw.includes("español") ? "es" : raw.includes("english") || raw.includes("ingles") ? "en" : "auto";
                return { type: 'SET_LANG_PREF', data: lang };
            }
            if (raw.match(/(strict|severo) [1-5]/)) return { type: 'SET_STRICTNESS', data: parseInt(raw.match(/[1-5]/)[0]) };
            if (raw.match(/(wake|despierto) (\d{1,2}:\d{2})/)) return { type: 'SET_WAKE', data: raw.match(/\d{1,2}:\d{2}/)[0] };
            if (raw.match(/(sleep|duermo) (\d{1,2}:\d{2})/)) return { type: 'SET_SLEEP', data: raw.match(/\d{1,2}:\d{2}/)[0] };
            if (raw.startsWith("avoid") || raw.startsWith("evito") || raw.startsWith("evitar")) return { type: 'ADD_AVOID_FOODS', data: text.replace(/^(avoid|evito|evitar):?\s*/i, '').split(',').map(s=>s.trim()) };
            if (raw.startsWith("like") || raw.startsWith("me gusta") || raw.startsWith("gusta")) return { type: 'ADD_FAVORITE_FOODS', data: text.replace(/^(like|me gusta|gusta):?\s*/i, '').split(',').map(s=>s.trim()) };
            if (raw.startsWith("about me") || raw.startsWith("bio") || raw.startsWith("sobre mi")) return { type: 'SET_PROFILE_NOTES', data: text.replace(/^(about me|bio|sobre mi):?\s*/i, '').trim() };

            if (raw === "voice on" || raw === "voz activada") return { type: 'SET_VOICE', data: true };
            if (raw === "voice off" || raw === "voz desactivada") return { type: 'SET_VOICE', data: false };

            if (raw.includes("status") || raw.includes("estado") || raw.includes("time left") || raw.includes("cuanto falta")) return { type: 'STATUS' };
            if (raw.length === 1 && "12345".includes(raw)) return { type: 'HUNGER_REMEDY', data: parseInt(raw) };
            if (raw.includes("help") || raw.includes("ayuda")) return { type: 'HELP' };
            return null;
        }

        function toggleModal(id) {
            const m = document.getElementById(id);
            if (!m) return;
            const isOpen = m.style.display === 'flex';
            m.style.display = isOpen ? 'none' : 'flex';
            
            if (!isOpen) {
                if (id === 'fast-modal') document.getElementById('fast-start').value = toLocalDateTimeValue(new Date());
                if (id === 'meal-modal') document.getElementById('meal-time').value = toLocalDateTimeValue(new Date());
            }
        }

        function toLocalDateTimeValue(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

        function addMessage(role, content) {
            state.chat.push({ role, content, ts: Date.now() });
            renderChat();
            saveState();

            if (role === 'assistant' && state.profile.voiceReplies) {
                speakText(content);
            }
        }

        function speakText(text) {
            if (!window.speechSynthesis) return;
            window.speechSynthesis.cancel();
            // Split by double newline or period to get first few sentences
            const shortText = text.split(/\n\n|\. /)[0].substring(0, 180);
            const utterance = new SpeechSynthesisUtterance(shortText);
            utterance.lang = state.profile.lastLang === 'es' ? 'es-ES' : 'en-US';
            utterance.rate = 1.0;
            window.speechSynthesis.speak(utterance);
        }

        function renderChat() {
            const container = document.getElementById('chat-container');
            if (!container) return;
            container.innerHTML = '';
            state.chat.forEach(msg => {
                const div = document.createElement('div');
                div.className = `msg ${msg.role}`;
                div.innerText = msg.content;
                container.appendChild(div);
            });
            container.scrollTop = container.scrollHeight;
        }

        function getPersonalizedHungerTip(lang) {
            const tips = {
                en: ["Try black coffee or green tea.", "A pinch of salt under the tongue helps.", "Take a 10-minute walk.", "Deep breathing for 2 mins.", "Hydrate with sparkling water."],
                es: ["Prueba café negro o té verde.", "Una pizca de sal bajo la lengua ayuda.", "Camina 10 minutos.", "Respira profundo 2 minutos.", "Hidrátate con agua con gas."]
            };
            const list = tips[lang] || tips['en'];
            return list[Math.floor(Math.random() * list.length)];
        }

        function getCoachingAdvice(lang = 'en') {
            const elapsed = state.today.fasting.active ? (Date.now() - state.today.fasting.start) / 3600000 : 0;
            const episode = { ts: Date.now(), fastingActive: state.today.fasting.active, elapsedHours: elapsed, hungerLevel: state.today.hunger, energyLevel: state.today.energy, userAction: null };
            state.history.hungerEpisodes.push(episode);
            
            const isStrict = state.profile.strictness >= 4;
            let advice = "";
            
            if (state.today.fasting.active) {
                advice = isStrict ? 
                    (lang === 'en' ? "Stay focused. Drink water. You got this." : "Enfocado. Bebe agua. Tú puedes.") :
                    (lang === 'en' ? `Hunger is a wave. ${getPersonalizedHungerTip(lang)}` : `El hambre es una ola. ${getPersonalizedHungerTip(lang)}`);
            } else {
                advice = lang === 'en' ? "You're feeding. Aim for protein." : "Estás comiendo. Busca proteína.";
                if (state.profile.avoidFoods.length > 0) {
                    advice += lang === 'en' ? `\nAvoiding: ${state.profile.avoidFoods.join(', ')}` : `\nEvitando: ${state.profile.avoidFoods.join(', ')}`;
                }
            }

            addMessage('assistant', advice + "\n\n" + t('HUNGER_FOLLOWUP', lang) + "\n\n*Not medical advice.*");
            saveState();
        }

        function sendMessage() {
            const input = document.getElementById('chat-input');
            const raw = input.value.trim();
            if (!raw) return;
            addMessage('user', raw);
            const lang = detectLang(raw);
            state.profile.lastLang = lang;
            const intent = parseIntent(raw);
            input.value = '';

            setTimeout(() => {
                if (!intent) {
                    if (raw.toLowerCase().includes("hambre") || raw.toLowerCase().includes("hungry")) getCoachingAdvice(lang);
                    else addMessage('assistant', t('ASK_SPECIFIC', lang));
                    return;
                }
                switch(intent.type) {
                    case 'SET_HUNGER': state.today.hunger = intent.data; addMessage('assistant', `Hunger: ${intent.data}`); break;
                    case 'SET_ENERGY': state.today.energy = intent.data; addMessage('assistant', `Energy: ${intent.data}`); break;
                    case 'START_FAST': startFast(intent.data); addMessage('assistant', t('STARTED_FAST', lang, { dur: intent.data })); break;
                    case 'END_FAST': endFast(); addMessage('assistant', t('ENDED_FAST', lang)); break;
                    case 'LOG_MEAL': saveMeal(intent.data); addMessage('assistant', t('LOGGED_MEAL', lang, { meal: intent.data })); break;
                    case 'STATUS': addMessage('assistant', state.today.fasting.active ? t('STATUS_FASTING', lang) + " " + t('TIMER_LEFT', lang, { time: getRemainingTime() }) : t('STATUS_FEEDING', lang)); break;
                    
                    case 'SET_LANG_PREF': state.profile.langPref = intent.data; addMessage('assistant', t('PROFILE_SAVED', lang)); break;
                    case 'SET_STRICTNESS': state.profile.strictness = intent.data; addMessage('assistant', t('PROFILE_SAVED', lang)); break;
                    case 'SET_WAKE': state.profile.wakeTime = intent.data; addMessage('assistant', t('PROFILE_SAVED', lang)); break;
                    case 'SET_SLEEP': state.profile.sleepTime = intent.data; addMessage('assistant', t('PROFILE_SAVED', lang)); break;
                    case 'SET_VOICE': state.profile.voiceReplies = intent.data; addMessage('assistant', t('PROFILE_SAVED', lang)); break;
                    case 'ADD_AVOID_FOODS': 
                        state.profile.avoidFoods = [...new Set([...state.profile.avoidFoods, ...intent.data])];
                        addMessage('assistant', t('PROFILE_SAVED', lang)); 
                        break;
                    case 'ADD_FAVORITE_FOODS': 
                        state.profile.favoriteFoods = [...new Set([...state.profile.favoriteFoods, ...intent.data])];
                        addMessage('assistant', t('PROFILE_SAVED', lang)); 
                        break;
                    case 'SET_PROFILE_NOTES': 
                        state.profile.notes = (state.profile.notes + " " + intent.data).trim();
                        addMessage('assistant', t('PROFILE_SAVED', lang)); 
                        break;
                    
                    case 'SHOW_PROFILE':
                        const p = state.profile;
                        const summary = lang === 'en' ? 
                            `Goal: ${p.goal}\nStreak: ${p.streak}\nLang: ${p.langPref}\nStrict: ${p.strictness}/5\nWake: ${p.wakeTime}\nSleep: ${p.sleepTime}\nAvoids: ${p.avoidFoods.join(', ') || 'none'}\nLikes: ${p.favoriteFoods.join(', ') || 'none'}\nNotes: ${p.notes || 'none'}\nVoice: ${p.voiceReplies}` :
                            `Meta: ${p.goal}\nRacha: ${p.streak}\nIdioma: ${p.langPref}\nSevero: ${p.strictness}/5\nDespierto: ${p.wakeTime}\nDuermo: ${p.sleepTime}\nEvito: ${p.avoidFoods.join(', ') || 'nada'}\nGusta: ${p.favoriteFoods.join(', ') || 'nada'}\nNotas: ${p.notes || 'ninguna'}\nVoz: ${p.voiceReplies}`;
                        addMessage('assistant', summary);
                        break;

                    case 'HUNGER_REMEDY': 
                        const lastEp = state.history.hungerEpisodes[state.history.hungerEpisodes.length - 1];
                        if (lastEp) lastEp.userAction = intent.data;
                        const remedyName = REMEDIES[lang][intent.data] || "???";
                        addMessage('assistant', t('REMEDY_CONFIRM', lang, { remedy: remedyName }));
                        break;
                    case 'HELP': addMessage('assistant', t('HELP', lang)); break;
                }
                saveState();
                updateUI();
            }, 500);
        }

        function toggleVoiceCapture() {
            if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
                alert("Voice not supported in this browser.");
                return;
            }

            if (recognition) {
                recognition.stop();
                return;
            }

            const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognition = new SpeechRec();
            recognition.lang = state.profile.lastLang === 'es' ? 'es-ES' : 'en-US';
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;

            recognition.onstart = () => {
                document.getElementById('btn-voice').classList.add('active');
            };

            recognition.onresult = (event) => {
                const speechResult = event.results[0][0].transcript;
                document.getElementById('chat-input').value = speechResult;
                sendMessage();
            };

            recognition.onend = () => {
                document.getElementById('btn-voice').classList.remove('active');
                recognition = null;
            };

            recognition.onerror = (err) => {
                console.error("Speech Recognition Error", err);
                document.getElementById('btn-voice').classList.remove('active');
                recognition = null;
            };

            recognition.start();
        }

        function startFast(hoursOverride = null) {
            const startInput = document.getElementById('fast-start');
            const start = hoursOverride ? new Date().toISOString() : (startInput ? startInput.value : "");
            const dur = hoursOverride || parseInt(document.getElementById('fast-duration').value);
            const noteInput = document.getElementById('fast-note');
            const note = noteInput ? noteInput.value.trim() : "";
            if (fastEditMode && !hoursOverride && state.today.fasting.active) {
                state.today.fasting.duration = dur;
                if (note) state.today.fasting.note = note;
                fastEditMode = false;
                toggleModal('fast-modal');
                saveState(); updateUI();
                snapshotNow("fast_edit");
                if (window.UI) UI.toast("Fast goal updated", "info", 2000);
                return;
            }
            if (!start) {
                const fallback = new Date().toISOString();
                if (startInput) startInput.value = fallback.slice(0, 16);
                state.today.fasting = { active: true, start: new Date(fallback).getTime(), duration: dur, note: "" };
                if (!hoursOverride) toggleModal('fast-modal');
                saveState(); updateUI();
                snapshotNow("fast_start");
                if (window.UI) UI.toast("Fast started", "success", 2000);
                return;
            }
            state.today.fasting = { active: true, start: new Date(start).getTime(), duration: dur, note: note || "" };
            if (!hoursOverride) toggleModal('fast-modal');
            fastEditMode = false;
            saveState(); updateUI();
            snapshotNow("fast_start");
            if (window.UI) UI.toast("Fast started", "success", 2000);
        }

        function endFast() {
            state.history.fastingSessions.push({ ...state.today.fasting, end: Date.now() });
            state.today.fasting.active = false;
            saveState(); updateUI();
            snapshotNow("fast_end");
            if (window.UI) UI.toast("Fast ended", "info", 2000);
        }

        function saveMeal(textOverride = null) {
            const mealTextEl = document.getElementById('meal-text');
            const mealTimeEl = document.getElementById('meal-time');
            const mealHungerEl = document.getElementById('meal-hunger');

            let text, time, hunger;

            if (textOverride) {
                text = textOverride;
                time = new Date().toISOString();
                hunger = state.today.hunger;
            } else {
                text = mealTextEl.value.trim();
                time = mealTimeEl.value;
                hunger = parseInt(mealHungerEl.value);

                if (!text) {
                    alert("Please enter what you ate.");
                    return;
                }
            }

            const meal = { text, time, hunger, ts: Date.now() };
            state.today.meals.push(meal);
            state.history.mealLogs.push(meal);
            
            if (!textOverride) {
                mealTextEl.value = '';
                toggleModal('meal-modal');
            }
            saveState(); updateUI();
            snapshotNow("meal");
            if (window.UI) UI.toast("Meal logged", "success", 2000);
        }

        function handleAction(action) {
            if (action === 'fast-menu') state.today.fasting.active ? (confirm("End fast?") && endFast()) : toggleModal('fast-modal');
            else if (action === 'hunger') getCoachingAdvice(state.profile.lastLang);
            else if (action === 'meal-menu') toggleModal('meal-modal');
            else if (action === 'stats') {
                const lang = state.profile.lastLang;
                addMessage('assistant', lang === 'en' ? `Streak: ${state.profile.streak} days.` : `Racha: ${state.profile.streak} días.`);
            }
        }

        function getRemainingTime() {
            if (!state.today.fasting.active) return "0h 0m";
            const diff = (state.today.fasting.start + state.today.fasting.duration * 3600000) - Date.now();
            return diff <= 0 ? "0h 0m" : `${Math.floor(diff / 3600000)}h ${Math.floor((diff % 3600000) / 60000)}m`;
        }

        function updateUI() {
            const f = state.today.fasting;
            const pill = document.getElementById('pill-fast-toggle');
            const timerUi = document.getElementById('timer-ui');
            if (pill) pill.innerText = f.active ? "⚡ End Fast" : "⚡ Start Fast";
            if (timerUi) f.active ? timerUi.classList.remove('hidden') : timerUi.classList.add('hidden');
            
            const statusChip = document.getElementById('chip-status');
            if (statusChip) {
                statusChip.innerText = f.active ? "● Fasting" : "● Feeding";
                f.active ? statusChip.classList.add('active') : statusChip.classList.remove('active');
            }
            
            const chipHunger = document.getElementById('chip-hunger');
            const chipEnergy = document.getElementById('chip-energy');
            if (chipHunger) chipHunger.innerText = `Hunger: ${state.today.hunger}`;
            if (chipEnergy) chipEnergy.innerText = `Energy: ${state.today.energy}`;
            updateDerivedStats();
            updateDashboardCard();
            updateFastingScreen();
            // ===== DAILY MISSIONS INTEGRATION START =====
            if (window.Missions) {
                window.Missions.renderMissionsCard(state, () => {
                    saveState();
                    snapshotNow("missions", { silent: true });
                });
            }
            // ===== DAILY MISSIONS INTEGRATION END =====
            // ===== CALENDAR + FASTING EXPLORER INTEGRATION START =====
            if (window.CalendarUI) window.CalendarUI.renderCalendar(state);
            renderFastingStageExplorer();
            // ===== CALENDAR + FASTING EXPLORER INTEGRATION END =====
            // ===== PROFILE ACTIONS START =====
            updateProfileActions();
            // ===== PROFILE ACTIONS END =====
        }

        // RED FLAG: FASTING SCREEN START
let fastingControlsInit = false;
let fastEditMode = false;

function initFastingControls() {
  if (fastingControlsInit) return;
  const startBtn = document.getElementById("fasting-start-btn");
  const endBtn = document.getElementById("fasting-end-btn");
  const editBtn = document.getElementById("fasting-edit-btn");
  const logMealBtn = document.getElementById("fasting-log-meal-btn");
  const hungerInput = document.getElementById("fasting-hunger");
  const energyInput = document.getElementById("fasting-energy");
  const noteInput = document.getElementById("fasting-note");

  if (startBtn) startBtn.addEventListener("click", () => toggleModal("fast-modal"));
  if (endBtn) endBtn.addEventListener("click", () => confirm("End current fast?") && endFast());
  if (editBtn) {
    editBtn.addEventListener("click", () => {
      if (!state.today.fasting.active) {
        toggleModal("fast-modal");
        return;
      }
      fastEditMode = true;
      const durationEl = document.getElementById("fast-duration");
      if (durationEl) durationEl.value = String(state.today.fasting.duration || 16);
      toggleModal("fast-modal");
    });
  }
  if (logMealBtn) logMealBtn.addEventListener("click", () => toggleModal("meal-modal"));

  if (hungerInput) {
    hungerInput.addEventListener("input", () => {
      state.today.hunger = Number(hungerInput.value) || 3;
      saveState();
      updateUI();
    });
  }
  if (energyInput) {
    energyInput.addEventListener("input", () => {
      state.today.energy = Number(energyInput.value) || 3;
      saveState();
      updateUI();
    });
  }
  if (noteInput) {
    noteInput.addEventListener("input", () => {
      state.today.fasting.note = noteInput.value;
      saveState();
    });
  }

  fastingControlsInit = true;
}

function updateFastingScreen() {
  initFastingControls();
  const f = state.today.fasting;
  const statusPill = document.getElementById("fasting-status-pill");
  const main = document.getElementById("fasting-main");
  const sub = document.getElementById("fasting-sub");
  const stageEl = document.getElementById("fasting-stage");
  const nextEl = document.getElementById("fasting-next");
  const bar = document.getElementById("fasting-bar");
  const meta = document.getElementById("fasting-meta");
  const startLabel = document.getElementById("fasting-start-label");
  const goalLabel = document.getElementById("fasting-goal-label");
  const milestones = document.getElementById("fasting-milestones");
  const hungerInput = document.getElementById("fasting-hunger");
  const energyInput = document.getElementById("fasting-energy");
  const noteInput = document.getElementById("fasting-note");

  if (hungerInput) hungerInput.value = String(state.today.hunger || 3);
  if (energyInput) energyInput.value = String(state.today.energy || 3);
  if (noteInput) noteInput.value = state.today.fasting.note || "";

  if (!main || !sub || !bar || !meta) return;

  if (!f.active) {
    if (statusPill) statusPill.innerText = "⏳ Not fasting";
    main.innerText = "Not fasting";
    sub.innerText = "Start a fast to see progress + stages.";
    bar.style.width = "0%";
    if (stageEl) stageEl.innerText = "—";
    if (nextEl) nextEl.innerText = "—";
    if (startLabel) startLabel.innerText = "—";
    if (goalLabel) goalLabel.innerText = "—";
    meta.innerText = "—";
    setMilestonesUI(milestones, 0);
    renderFastingHistory();
    return;
  }

  const eMs = elapsedMs(f);
  const elapsedHours = eMs / 3600000;
  const targetMs = f.duration * 3600000;
  const percent = Math.min(100, (eMs / targetMs) * 100);

  if (statusPill) statusPill.innerText = "⏳ Fasting";
  bar.style.width = percent + "%";
  const h = Math.floor(eMs / 3600000);
  const m = Math.floor((eMs % 3600000) / 60000);
  main.innerText = `${h}h ${m}m elapsed`;
  sub.innerText = `Remaining: ${formatHM(getRemainingMs(f))} • Goal ${f.duration}h`;
  if (startLabel) startLabel.innerText = formatTime(f.start);
  if (goalLabel) goalLabel.innerText = formatTime(f.start + targetMs);
  meta.innerText = `Started ${formatTime(f.start)} • Goal ${formatTime(f.start + targetMs)}`;

  const stageInfo = getStageInfo(elapsedHours);
  if (stageEl) stageEl.innerText = stageInfo.stage;
  if (nextEl) {
    if (stageInfo.nextAt == null) nextEl.innerText = "Complete";
    else {
      const msToNext = Math.max(0, (stageInfo.nextAt * 3600000) - eMs);
      nextEl.innerText = `${formatHM(msToNext)} → ${stageInfo.nextLabel}`;
    }
  }
  setMilestonesUI(milestones, elapsedHours);
  renderFastingHistory();
}

function renderFastingHistory() {
  const list = document.getElementById("fasting-history-list");
  if (!list) return;
  list.innerHTML = "";
  const sessions = (state.history.fastingSessions || []).slice(-7).reverse();
  if (!sessions.length) {
    list.innerHTML = '<div class="fasting-history-item"><div class="fasting-history-title">No sessions yet</div></div>';
    return;
  }
  sessions.forEach(session => {
    const start = session.start ? new Date(session.start) : null;
    const end = session.end ? new Date(session.end) : null;
    const durationMs = end && start ? end.getTime() - start.getTime() : 0;
    const hoursReached = durationMs / 3600000;
    const stageReached = hoursReached >= 24 ? "24h" : hoursReached >= 16 ? "16h" : hoursReached >= 12 ? "12h" : `${Math.max(0, Math.floor(hoursReached))}h`;

    const item = document.createElement("div");
    item.className = "fasting-history-item";
    const title = document.createElement("div");
    title.className = "fasting-history-title";
    title.innerText = start ? start.toDateString() : "Session";
    const meta = document.createElement("div");
    meta.className = "fasting-history-meta";
    meta.innerText = `${formatHM(durationMs)} • Reached ${stageReached}`;
    item.appendChild(title);
    item.appendChild(meta);
    list.appendChild(item);
  });
}
        // RED FLAG: FASTING SCREEN END

// ===== PROFILE ACTIONS START =====
function updateProfileActions() {
  const profileScreen = document.getElementById("screen-profile");
  if (!profileScreen) return;
  const card = profileScreen.querySelector(".dash-card");
  if (!card) return;
  let actions = document.getElementById("profile-actions");
  if (!actions) {
    actions = document.createElement("div");
    actions.id = "profile-actions";
    actions.style.display = "flex";
    actions.style.flexWrap = "wrap";
    actions.style.gap = "10px";
    actions.style.marginTop = "12px";
    const installBtn = document.createElement("button");
    installBtn.className = "pill";
    installBtn.type = "button";
    installBtn.innerText = "Install App";
    installBtn.addEventListener("click", () => {
      if (window.UI) UI.promptInstall();
    });
    const restoreBtn = document.createElement("button");
    restoreBtn.className = "pill";
    restoreBtn.type = "button";
    restoreBtn.innerText = "Restore Last Backup";
    restoreBtn.addEventListener("click", () => restoreSnapshot(0));
    actions.appendChild(installBtn);
    actions.appendChild(restoreBtn);
    card.appendChild(actions);
  }
}
// ===== PROFILE ACTIONS END =====

        // --- DASHBOARD FASTING STAGE (new) ---
const DASH_MILESTONES_HOURS = [0, 12, 16, 24];

function fmtHmFromMs(ms) {
  const safe = Math.max(0, ms);
  const totalMin = Math.ceil(safe / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m}m`;
}

function getStageLabel(elapsedHours, lang = "en") {
  const labels = {
    en: [
      { at: 0,  name: "Blood Sugar Dropping" },
      { at: 12, name: "Ketosis Beginning" },
      { at: 16, name: "Autophagy Initiated" },
      { at: 24, name: "Deep Fast" }
    ],
    es: [
      { at: 0,  name: "Bajando azúcar en sangre" },
      { at: 12, name: "Comenzando cetosis" },
      { at: 16, name: "Autofagia iniciada" },
      { at: 24, name: "Ayuno profundo" }
    ]
  };

  const list = labels[lang] || labels.en;
  let current = list[0].name;
  for (const s of list) {
    if (elapsedHours >= s.at) current = s.name;
  }
  return current;
}

function updateDashboardStageUI(elapsedMs) {
  const dashStage = document.getElementById("dash-stage");
  const dashNext = document.getElementById("dash-next");
  const milestonesWrap = document.getElementById("dash-milestones");

  if (!dashStage || !dashNext || !milestonesWrap) return;

  const lang = (state && state.profile && state.profile.lastLang) ? state.profile.lastLang : "en";
  const elapsedHours = elapsedMs / 3600000;

  // Stage text
  dashStage.innerText = getStageLabel(elapsedHours, lang);

  // Next milestone
  const nextHour = DASH_MILESTONES_HOURS.find(h => h > elapsedHours);
  if (!nextHour) {
    dashNext.innerText = (lang === "es") ? "Completado ✓" : "Completed ✓";
  } else {
    const nextMs = (nextHour * 3600000) - elapsedMs;
    const prefix = (lang === "es") ? "En " : "In ";
    dashNext.innerText = `${prefix}${fmtHmFromMs(nextMs)} → ${nextHour}h`;
  }

  // Milestone chip states
  const chips = milestonesWrap.querySelectorAll(".milestone");
  chips.forEach(chip => {
    const h = Number(chip.getAttribute("data-ms"));
    chip.classList.remove("done", "active");

    if (elapsedHours >= h) chip.classList.add("done");
    if (nextHour !== undefined && h === nextHour) chip.classList.add("active");
  });
}

function resetDashboardStageUI() {
  const dashStage = document.getElementById("dash-stage");
  const dashNext = document.getElementById("dash-next");
  const milestonesWrap = document.getElementById("dash-milestones");

  if (dashStage) dashStage.innerText = "—";
  if (dashNext) dashNext.innerText = "—";

  if (milestonesWrap) {
    milestonesWrap.querySelectorAll(".milestone").forEach(chip => {
      chip.classList.remove("done", "active");
    });
  }
}

        function setMilestonesUI(containerEl, elapsedHours) {
  if (!containerEl) return;
  const nodes = Array.from(containerEl.querySelectorAll(".milestone"));
  nodes.forEach(n => {
    const h = Number(n.getAttribute("data-ms"));
    n.classList.toggle("reached", elapsedHours >= h);
    n.classList.remove("current");
  });

  // mark "current" as the next milestone not yet reached
  const next = nodes.find(n => elapsedHours < Number(n.getAttribute("data-ms")));
  if (next) next.classList.add("current");
}

// RED FLAG: DASHBOARD GOALS START
let dashboardControlsInit = false;

function initDashboardControls() {
  if (dashboardControlsInit) return;
  initOverviewGoals();
  initEnergyControls();
  dashboardControlsInit = true;
}

function initOverviewGoals() {
  const buttons = document.querySelectorAll(".overview-goal");
  if (!buttons.length) return;
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-goal");
      if (!key || !state.today.checklist) return;
      state.today.checklist[key] = !state.today.checklist[key];
      saveState();
      updateOverviewGoals();
    });
  });
}

function updateOverviewGoals() {
  const checklist = state.today.checklist || { rap: false, exercise: false, fasting: false };
  const goalMap = [
    { key: "rap", btn: "goal-rap", label: "goal-rap-state" },
    { key: "exercise", btn: "goal-exercise", label: "goal-exercise-state" },
    { key: "fasting", btn: "goal-fasting", label: "goal-fasting-state" }
  ];
  goalMap.forEach(({ key, btn, label }) => {
    const el = document.getElementById(btn);
    const labelEl = document.getElementById(label);
    if (!el || !labelEl) return;
    const done = !!checklist[key];
    el.classList.toggle("done", done);
    labelEl.innerText = done ? "Done" : "Not done";
  });
}
// RED FLAG: DASHBOARD GOALS END

// RED FLAG: ENERGY CARD START
function updateEnergyCard() {
  const hydrationEl = document.getElementById("energy-hydration");
  const hydrationInput = document.getElementById("energy-hydration-input");
  const sleepEl = document.getElementById("energy-sleep");
  const sleepFill = document.getElementById("energy-sleep-fill");
  const recoveryEl = document.getElementById("energy-recovery");
  const recoveryFill = document.getElementById("energy-recovery-fill");
  const scoreEl = document.getElementById("energy-score");

  if (!hydrationEl || !hydrationInput || !recoveryEl || !recoveryFill || !scoreEl) return;
  const hydration = Number(state.today.hydration) || 3;
  hydrationInput.value = String(hydration);
  hydrationEl.innerText = String(hydration);

  if (sleepEl && sleepFill) {
    sleepEl.innerText = "—";
    sleepFill.style.width = "0%";
  }

  const hydrationScore = hydration / 5;
  const fastingScore = state.today.fasting.active ? Math.min(1, elapsedMs(state.today.fasting) / (state.today.fasting.duration * 3600000)) : 0.4;
  const scores = [hydrationScore, fastingScore];
  const recovery = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100);

  recoveryEl.innerText = `${recovery}%`;
  recoveryFill.style.width = `${recovery}%`;
  scoreEl.innerText = `Score: ${recovery}%`;
}

function initEnergyControls() {
  const hydrationInput = document.getElementById("energy-hydration-input");
  if (!hydrationInput) return;
  hydrationInput.addEventListener("input", () => {
    state.today.hydration = Number(hydrationInput.value) || 3;
    saveState();
    updateEnergyCard();
  });
}
// RED FLAG: ENERGY CARD END

// RED FLAG: CALENDAR START
let calendarView = { year: new Date().getFullYear(), month: new Date().getMonth() };
let calendarSelectedDateKey = null;

function buildMonth(year, month) {
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const cells = [];

  for (let i = startDay - 1; i >= 0; i -= 1) {
    const day = daysInPrev - i;
    const date = new Date(year, month - 1, day);
    cells.push({ date, inMonth: false });
  }

  for (let d = 1; d <= daysInMonth; d += 1) {
    const date = new Date(year, month, d);
    cells.push({ date, inMonth: true });
  }

  while (cells.length % 7 !== 0) {
    const next = new Date(year, month + 1, cells.length - (startDay + daysInMonth) + 1);
    cells.push({ date: next, inMonth: false });
  }

  return cells;
}

function collectEventsForDate(dateKey) {
  const fasting = [];
  const meals = [];
  const exercise = [];

  state.history.fastingSessions.forEach(session => {
    if (!session.start) return;
    const endTs = session.end || session.start;
    const startKey = localDateKey(session.start);
    const endKey = localDateKey(endTs);
    if (dateKey >= startKey && dateKey <= endKey) {
      fasting.push(session);
    }
  });

  if (state.today.fasting.active && localDateKey(Date.now()) === dateKey) {
    fasting.push({ ...state.today.fasting, end: null });
  }

  state.history.mealLogs.forEach(meal => {
    const ts = meal.time ? new Date(meal.time).getTime() : meal.ts;
    if (!ts) return;
    if (localDateKey(ts) === dateKey) meals.push(meal);
  });

  state.history.exerciseLogs.forEach(log => {
    const ts = log.ts || (log.time ? new Date(log.time).getTime() : null);
    if (!ts) return;
    if (localDateKey(ts) === dateKey) exercise.push(log);
  });

  return { fasting, meals, exercise };
}

function renderCalendar() {
  const grid = document.getElementById("calendar-grid");
  const label = document.getElementById("calendar-month-label");
  if (!grid || !label) return;

  const monthName = new Date(calendarView.year, calendarView.month, 1).toLocaleString([], { month: "long", year: "numeric" });
  label.innerText = monthName;
  grid.innerHTML = "";

  const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  weekdayLabels.forEach(day => {
    const header = document.createElement("div");
    header.className = "calendar-day calendar-weekday";
    header.innerHTML = `<div class="calendar-day-number">${day}</div>`;
    grid.appendChild(header);
  });

  const days = buildMonth(calendarView.year, calendarView.month);
  days.forEach(({ date, inMonth }) => {
    const cell = document.createElement("div");
    const dateKey = localDateKey(date.getTime());
    cell.className = `calendar-day${inMonth ? "" : " muted"}`;
    if (dateKey === localDateKey(Date.now())) cell.classList.add("active");

    const number = document.createElement("div");
    number.className = "calendar-day-number";
    number.innerText = String(date.getDate());

    const dots = document.createElement("div");
    dots.className = "calendar-dots";
    const events = collectEventsForDate(dateKey);
    if (events.fasting.length) {
      const dot = document.createElement("span");
      dot.className = "calendar-dot fast";
      dots.appendChild(dot);
    }
    if (events.meals.length) {
      const dot = document.createElement("span");
      dot.className = "calendar-dot meal";
      dots.appendChild(dot);
    }
    if (events.exercise.length) {
      const dot = document.createElement("span");
      dot.className = "calendar-dot exercise";
      dots.appendChild(dot);
    }

    cell.appendChild(number);
    cell.appendChild(dots);
    cell.addEventListener("click", () => openDaySheet(dateKey));
    grid.appendChild(cell);
  });
}

function openDaySheet(dateKey) {
  const sheet = document.getElementById("calendar-sheet");
  const dateLabel = document.getElementById("calendar-sheet-date");
  if (!sheet || !dateLabel) return;
  calendarSelectedDateKey = dateKey;
  dateLabel.innerText = new Date(`${dateKey}T00:00:00`).toDateString();

  const fastList = document.getElementById("calendar-fast-list");
  const mealList = document.getElementById("calendar-meal-list");
  const exList = document.getElementById("calendar-ex-list");
  if (fastList) fastList.innerHTML = "";
  if (mealList) mealList.innerHTML = "";
  if (exList) exList.innerHTML = "";

  const events = collectEventsForDate(dateKey);

  if (fastList) {
    if (!events.fasting.length) {
      fastList.innerHTML = '<div class="calendar-entry">No fasting sessions.</div>';
    } else {
      events.fasting.forEach(session => {
        const endTs = session.end || Date.now();
        const duration = formatHM(endTs - session.start);
        const entry = document.createElement("div");
        entry.className = "calendar-entry";
        entry.innerText = `${formatTime(session.start)} → ${session.end ? formatTime(endTs) : "Active"} • ${duration}`;
        fastList.appendChild(entry);
      });
    }
  }

  if (mealList) {
    if (!events.meals.length) {
      mealList.innerHTML = '<div class="calendar-entry">No meals logged.</div>';
    } else {
      events.meals.forEach(meal => {
        const entry = document.createElement("div");
        entry.className = "calendar-entry";
        entry.innerText = meal.text || "Meal";
        mealList.appendChild(entry);
      });
    }
  }

  if (exList) {
    if (!events.exercise.length) {
      exList.innerHTML = '<div class="calendar-entry">No exercise logged.</div>';
    } else {
      events.exercise.forEach(log => {
        const entry = document.createElement("div");
        entry.className = "calendar-entry";
        entry.innerText = `${log.type || "Workout"} • ${log.minutes || 0} min`;
        exList.appendChild(entry);
      });
    }
  }

  const fastToggle = document.getElementById("calendar-fast-toggle");
  if (fastToggle) {
    fastToggle.innerText = state.today.fasting.active ? "End fast" : "Start fast";
    fastToggle.onclick = () => {
      if (state.today.fasting.active) endFast();
      else toggleModal("fast-modal");
      openDaySheet(dateKey);
    };
  }

  sheet.classList.remove("hidden");
  sheet.style.display = "flex";
}

function closeDaySheet() {
  const sheet = document.getElementById("calendar-sheet");
  if (!sheet) return;
  sheet.classList.add("hidden");
  sheet.style.display = "none";
}

function initCalendarControls() {
  const prev = document.getElementById("calendar-prev");
  const next = document.getElementById("calendar-next");
  const sheet = document.getElementById("calendar-sheet");

  if (prev) prev.addEventListener("click", () => {
    calendarView.month -= 1;
    if (calendarView.month < 0) {
      calendarView.month = 11;
      calendarView.year -= 1;
    }
    renderCalendar();
  });

  if (next) next.addEventListener("click", () => {
    calendarView.month += 1;
    if (calendarView.month > 11) {
      calendarView.month = 0;
      calendarView.year += 1;
    }
    renderCalendar();
  });

  if (sheet) {
    sheet.addEventListener("click", (e) => {
      if (e.target.id === "calendar-sheet") closeDaySheet();
    });
  }
}

function openExerciseModal(dateKey) {
  calendarSelectedDateKey = dateKey || calendarSelectedDateKey;
  const input = document.getElementById("exercise-time");
  const base = calendarSelectedDateKey ? new Date(`${calendarSelectedDateKey}T00:00:00`) : new Date();
  if (input) input.value = toLocalDateTimeValue(base);
  toggleModal("exercise-modal");
}

function saveExercise() {
  const typeEl = document.getElementById("exercise-type");
  const minutesEl = document.getElementById("exercise-minutes");
  const noteEl = document.getElementById("exercise-note");
  const timeEl = document.getElementById("exercise-time");
  if (!typeEl || !minutesEl || !timeEl) return;

  const type = typeEl.value.trim() || "Workout";
  const minutes = Number(minutesEl.value) || 0;
  const note = noteEl ? noteEl.value.trim() : "";
  const ts = timeEl.value ? new Date(timeEl.value).getTime() : Date.now();
  if (!minutes) return;

  const entry = { id: `ex_${Date.now()}`, ts, type, minutes, note };
  state.today.exerciseLogs.push(entry);
  state.history.exerciseLogs.push(entry);
  saveState();
  if (typeEl) typeEl.value = "";
  if (minutesEl) minutesEl.value = "30";
  if (noteEl) noteEl.value = "";
  toggleModal("exercise-modal");
  renderCalendar();
  if (calendarSelectedDateKey) openDaySheet(calendarSelectedDateKey);
}
// RED FLAG: CALENDAR END

// ===== CALENDAR + FASTING EXPLORER INTEGRATION START =====
window.__stagePreviewHours = null;

function getElapsedHoursForExplorer() {
  const f = state?.today?.fasting;
  if (window.__stagePreviewHours != null) return window.__stagePreviewHours;
  if (!f?.active) return 0;
  const ms = Date.now() - f.start;
  return ms / 3600000;
}

function renderFastingStageExplorer() {
  const titleEl = document.getElementById("fx-title");
  const bodyEl = document.getElementById("fx-body");
  const benefitsEl = document.getElementById("fx-benefits");
  const milestones = document.getElementById("fx-milestones");
  if (!titleEl || !bodyEl || !benefitsEl || !milestones) return;

  const h = getElapsedHoursForExplorer();
  const info = window.getStageByHours ? window.getStageByHours(h) : null;
  if (!info || !info.current) return;

  titleEl.innerText = info.current.title;
  bodyEl.innerText = info.current.body;

  // pills: benefits + tips
  const benefits = (info.current.benefits || []).map(t => `<div class="benefit-pill">✨ ${t}</div>`).join("");
  const tips = (info.current.tips || []).map(t => `<div class="tip-pill">⚡ ${t}</div>`).join("");
  benefitsEl.innerHTML = benefits + tips;

  const milestoneButtons = milestones.querySelectorAll(".ms-btn");
  milestoneButtons.forEach(b => b.classList.remove("active"));

  let currentAt = 0;
  if (window.STAGE_LIBRARY && window.STAGE_LIBRARY.length) {
    for (const s of window.STAGE_LIBRARY) if (h >= s.at) currentAt = s.at;
  }
  if (window.__stagePreviewHours != null) currentAt = window.__stagePreviewHours;

  milestoneButtons.forEach(b => {
    const bh = Number(b.getAttribute("data-h"));
    if (bh === currentAt) b.classList.add("active");
  });

  if (!milestones.__wired) {
    milestones.__wired = true;
    milestones.querySelectorAll(".ms-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const bh = Number(btn.getAttribute("data-h"));
        window.__stagePreviewHours = bh;
        renderFastingStageExplorer();
      });
    });
  }
}

window.openStageModal = function () {
  const modal = document.getElementById("stage-modal");
  const body = document.getElementById("stage-modal-body");
  if (!modal || !body) return;

  const h = getElapsedHoursForExplorer();
  const info = window.getStageByHours ? window.getStageByHours(h) : null;
  if (!info || !info.current) return;

  const nextLine = info.next ? `${info.next.title} at ${info.next.at}h` : "—";
  body.innerHTML = `
    <div class="cal-modal-title">${info.current.title}</div>
    <div class="cal-modal-row"><span>What’s happening</span><span>${info.current.body}</span></div>
    <div class="cal-modal-row"><span>Next</span><span>${nextLine}</span></div>
    <div class="cal-modal-title" style="margin-top:12px;">Benefits</div>
    ${(info.current.benefits||[]).map(x=>`<div class="cal-modal-hint">✨ ${x}</div>`).join("")}
    <div class="cal-modal-title" style="margin-top:12px;">Tips</div>
    ${(info.current.tips||[]).map(x=>`<div class="cal-modal-hint">⚡ ${x}</div>`).join("")}
    <div class="cal-modal-hint" style="margin-top:12px;">Not medical advice. If you feel unwell, stop and consult a professional.</div>
  `;
  modal.style.display = "flex";
};

window.closeStageModal = function () {
  const modal = document.getElementById("stage-modal");
  if (modal) modal.style.display = "none";
};
// ===== CALENDAR + FASTING EXPLORER INTEGRATION END =====

// ===== SNAPSHOT BACKUPS START =====
const SNAP_KEY = "lumina_snapshots_v1";

function snapshotNow(reason = "auto", opts = {}) {
  try {
    const snaps = JSON.parse(localStorage.getItem(SNAP_KEY) || "[]");
    const safeState = JSON.parse(JSON.stringify(state));
    snaps.unshift({ ts: Date.now(), reason, state: safeState });
    const trimmed = snaps.slice(0, 10);
    localStorage.setItem(SNAP_KEY, JSON.stringify(trimmed));
    if (!opts.silent && window.UI) UI.toast("✅ Backup snapshot saved", "success", 2000);
  } catch (e) {}
}

function listSnapshots() {
  try { return JSON.parse(localStorage.getItem(SNAP_KEY) || "[]"); } catch (e) { return []; }
}

function restoreSnapshot(index = 0) {
  const snaps = listSnapshots();
  const snap = snaps[index];
  if (!snap) {
    if (window.UI) UI.toast("No backup found", "warn", 2200);
    return;
  }
  if (!confirm("Restore backup? This will overwrite current data.")) return;
  state = normalizeState(snap.state);
  saveState();
  if (window.UI) UI.toast("♻️ Restored backup. Reloading…", "success", 2400);
  setTimeout(()=>location.reload(), 400);
}
// ===== SNAPSHOT BACKUPS END =====

function updateDashboardCard() {
  const f = state.today.fasting;

  const dashMain = document.getElementById("dash-main");
  const dashSub = document.getElementById("dash-sub");
  const dashBar = document.getElementById("dash-bar");
  const dashMeta = document.getElementById("dash-meta");

  const dashStage = document.getElementById("dash-stage");
  const dashNext = document.getElementById("dash-next");
  const dashMilestones = document.getElementById("dash-milestones");

  updateOverviewGoals();
  updateEnergyCard();

  if (!dashMain || !dashSub || !dashBar || !dashMeta) return;

  if (!f.active) {
    dashMain.innerText = "Not fasting";
    dashSub.innerText = "Tap ✦ to open Lumina";
    dashBar.style.width = "0%";
    dashMeta.innerText = "—";
    if (dashStage) dashStage.innerText = "—";
    if (dashNext) dashNext.innerText = "—";
    setMilestonesUI(dashMilestones, 0);
    return;
  }

  const eMs = elapsedMs(f);
  const elapsedHours = eMs / 3600000;
  const targetMs = f.duration * 3600000;

  const h = Math.floor(eMs / 3600000);
  const m = Math.floor((eMs % 3600000) / 60000);

  const percent = Math.min(100, (eMs / targetMs) * 100);
  dashBar.style.width = percent + "%";

  dashMain.innerText = `Fasting: ${h}h ${m}m elapsed`;

  const remaining = formatHM(getRemainingMs(f));
  dashSub.innerText = `Remaining: ${remaining} • Goal ${f.duration}h`;

  const startLabel = formatTime(f.start);
  const goalLabel = formatTime(f.start + targetMs);
  dashMeta.innerText = `Started ${startLabel} • Goal ${goalLabel}`;

  const stageInfo = getStageInfo(elapsedHours);
  if (dashStage) dashStage.innerText = stageInfo.stage;

  if (dashNext) {
    if (stageInfo.nextAt == null) {
      dashNext.innerText = "Complete";
    } else {
      const msToNext = Math.max(0, (stageInfo.nextAt * 3600000) - eMs);
      dashNext.innerText = `${formatHM(msToNext)} → ${stageInfo.nextLabel}`;
    }
  }

  setMilestonesUI(dashMilestones, elapsedHours);
}



        function updateLoop() {
            if (state.today.fasting.active) {
                const elapsedMs = Date.now() - state.today.fasting.start;
                const hours = Math.floor(elapsedMs / 3600000);
                const mins = Math.floor((elapsedMs % 3600000) / 60000);
                const secs = Math.floor((elapsedMs % 60000) / 1000);
                const timerDisplay = document.getElementById('main-timer-display');
                if (timerDisplay) timerDisplay.innerText = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
                const chipElapsed = document.getElementById('chip-elapsed');
                if (chipElapsed) chipElapsed.innerText = `${hours}h ${mins}m elapsed`;
                const fill = document.getElementById('progress-fill');
                if (fill) fill.style.width = Math.min(100, (elapsedMs / (state.today.fasting.duration * 3600000)) * 100) + '%';
                updateDashboardCard();
                updateFastingScreen();
                // ===== CALENDAR + FASTING EXPLORER INTEGRATION START =====
                renderFastingStageExplorer();
                // ===== CALENDAR + FASTING EXPLORER INTEGRATION END =====
            }
        }

        function openAssistant() {
            document.getElementById('assistant-overlay').classList.remove('hidden');
            setTimeout(() => document.getElementById('chat-input').focus(), 200);
        }
        function closeAssistant() { document.getElementById('assistant-overlay').classList.add('hidden'); }
        function overlayClickClose(event) { if (event.target.id === "assistant-overlay") closeAssistant(); }

        function resetDay() { if (confirm("Reset today?")) { state.today = getDefaultStateV2().today; saveState(); location.reload(); } }
        function exportData() {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
            const dl = document.createElement('a'); dl.setAttribute("href", dataStr); dl.setAttribute("download", `lumina.json`); dl.click();
        }
        function triggerImport() { document.getElementById('import-input').click(); }
        function importData(e) {
            const file = e.target.files[0]; if (!file) return;
            const r = new FileReader(); r.onload = (ev) => { try { state = normalizeState(JSON.parse(ev.target.result)); saveState(); location.reload(); } catch(err){alert("Error");} };
            r.readAsText(file);
        }

        // RED FLAG: COACH INIT START
        window.onload = () => {
  loadState();
  initBottomNav();
  initDashboardControls();
  if (window.Coach && window.Coach.init) window.Coach.init();
  setInterval(updateLoop, 1000);
};
        // RED FLAG: COACH INIT END

// ===============================
// GLOBAL HOOKS (for onclick="...")
// ===============================
// RED FLAG: COACH GLOBALS START
window.luminaState = {
  get: () => state,
  save: () => { saveState(); updateUI(); }
};
// RED FLAG: COACH GLOBALS END

window.openAssistant = openAssistant;
window.closeAssistant = closeAssistant;
window.overlayClickClose = overlayClickClose;
window.toggleModal = toggleModal;
window.sendMessage = sendMessage;
window.handleAction = handleAction;
window.startFast = startFast;
window.endFast = endFast;
window.saveMeal = saveMeal;
window.toggleVoiceCapture = toggleVoiceCapture;
window.openDaySheet = openDaySheet;
window.closeDaySheet = closeDaySheet;
window.openExerciseModal = openExerciseModal;
window.saveExercise = saveExercise;
