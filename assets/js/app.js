const STATE_VERSION = 2;
        const APP_KEY = 'lumina_v1_data';

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

        function getDefaultStateV2() {
            return {
                meta: { version: STATE_VERSION, updatedAt: Date.now() },
                profile: { 
                    goal: "fat loss + energy", streak: 0, langPref: "auto", lastLang: "en", strictness: 3,
                    wakeTime: "", sleepTime: "", avoidFoods: [], favoriteFoods: [], notes: "",
                    voiceReplies: false
                },
                today: { fasting: { active: false, start: null, duration: 16, note: "" }, meals: [], hunger: 3, energy: 3 },
                history: { fastingSessions: [], mealLogs: [], hungerEpisodes: [] },
                chat: [{ role: 'assistant', content: "Hello, I'm Lumina. How are you feeling right now?", ts: Date.now() }]
            };
        }

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
    const ids = ['dashboard', 'coach', 'exercise', 'profile'];
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
  showScreen(saved || 'dashboard');
}

// Call this inside window.onload after loadState()

        function normalizeState(saved) {
            const base = getDefaultStateV2();
            if (!saved) return base;
            
            const merged = { ...base, ...saved };
            merged.profile = { ...base.profile, ...saved.profile };
            merged.today = { ...base.today, ...saved.today };
            merged.today.fasting = { ...base.today.fasting, ...(saved.today ? saved.today.fasting : {}) };
            merged.history = { ...base.history, ...saved.history };

            merged.chat = Array.isArray(saved.chat) ? saved.chat : base.chat;
            merged.today.meals = Array.isArray(merged.today.meals) ? merged.today.meals : [];
            merged.history.fastingSessions = Array.isArray(merged.history.fastingSessions) ? merged.history.fastingSessions : [];
            merged.history.mealLogs = Array.isArray(merged.history.mealLogs) ? merged.history.mealLogs : [];
            merged.history.hungerEpisodes = Array.isArray(merged.history.hungerEpisodes) ? merged.history.hungerEpisodes : [];
            merged.profile.avoidFoods = Array.isArray(merged.profile.avoidFoods) ? merged.profile.avoidFoods : [];
            merged.profile.favoriteFoods = Array.isArray(merged.profile.favoriteFoods) ? merged.profile.favoriteFoods : [];

            merged.today.hunger = Number(merged.today.hunger) || 3;
            merged.today.energy = Number(merged.today.energy) || 3;
            merged.profile.strictness = Number(merged.profile.strictness) || 3;

            return merged;
        }

        function loadState() {
            try {
                const savedRaw = localStorage.getItem(APP_KEY);
                state = normalizeState(savedRaw ? JSON.parse(savedRaw) : null);
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
            const start = hoursOverride ? new Date().toISOString() : document.getElementById('fast-start').value;
            const dur = hoursOverride || parseInt(document.getElementById('fast-duration').value);
            state.today.fasting = { active: true, start: new Date(start).getTime(), duration: dur, note: "" };
            if (!hoursOverride) toggleModal('fast-modal');
            saveState(); updateUI();
        }

        function endFast() {
            state.history.fastingSessions.push({ ...state.today.fasting, end: Date.now() });
            state.today.fasting.active = false;
            saveState(); updateUI();
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
            
            document.getElementById('chip-hunger').innerText = `Hunger: ${state.today.hunger}`;
            document.getElementById('chip-energy').innerText = `Energy: ${state.today.energy}`;
            updateDerivedStats();
            updateDashboardCard();
            updateFastingScreen();
        }

        // ===============================
// FASTING TAB SCREEN (placeholder)
// ===============================
function updateFastingScreen() {
  // Later we’ll build the full fasting control center here.
  // For now this prevents the app from crashing.
}

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

function updateDashboardCard() {
  const f = state.today.fasting;

  const dashMain = document.getElementById("dash-main");
  const dashSub = document.getElementById("dash-sub");
  const dashBar = document.getElementById("dash-bar");
  const dashMeta = document.getElementById("dash-meta");

  const dashStage = document.getElementById("dash-stage");
  const dashNext = document.getElementById("dash-next");
  const dashMilestones = document.getElementById("dash-milestones");

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

        function initTabs() {
  const tabs = document.querySelectorAll('.bottom-nav .tab');
  if (!tabs.length) {
    console.warn('No tabs found: .bottom-nav .tab');
    return;
  }

  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      console.log('Tab clicked:', target);
      showScreen(target);
    });
  });

  // Load last tab (optional)
  const saved = localStorage.getItem('lumina_active_tab') || 'dashboard';
  showScreen(saved);
}

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
});

        window.onload = () => {
  loadState();
  initBottomNav();
  setInterval(updateLoop, 1000);
};

        // expose functions used by inline HTML onclick=""
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

// ===== EXPOSE GLOBALS (for inline onclick) =====
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

// ===============================
// GLOBAL HOOKS (for onclick="...")
// ===============================
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