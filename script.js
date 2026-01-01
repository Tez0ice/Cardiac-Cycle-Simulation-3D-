if (window.location.protocol === 'file:') { document.getElementById('server-notice').classList.add('show'); }
const MODEL_UID = 'a3f0ea2030214a6bbaa97e7357eebd58';

function normalizeName(name) {
    return name.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
}

// ✅ CORRECTED: Using only anatomical structures that exist in the model
const storyChapters = [
    {
        chapter: "Chapter 1",
        title: "Venous Return",
        narrative: "You drift through the Superior Vena Cava, exhausted and depleted of oxygen. Ahead lies the heart's receiving chamber — the first stop in your journey to find oxygen.",
        displayName: "Right Atrium",
        keywords: ["right atrium"],
        points: 150,
        oxygenDrain: 1.0
    },
    {
        chapter: "Chapter 2",
        title: "The Right Chamber",
        narrative: "You've entered the Right Atrium. Blood swirls around you as the chamber fills. The walls begin to contract, pushing you toward the pumping chamber below.",
        displayName: "Right Ventricle",
        keywords: ["right ventricle"],
        points: 150,
        oxygenDrain: 1.25
    },
    {
        chapter: "Chapter 3",
        title: "The Pulmonary Path",
        narrative: "The Right Ventricle contracts with tremendous force! You're launched upward into the great vessel that will carry you to the lungs. Find the pulmonary pathway!",
        displayName: "Pulmonary Trunk",
        keywords: ["pulmonary trunk", "pulmonary"],
        points: 200,
        oxygenDrain: 1.5
    },
    {
        chapter: "Chapter 4",
        title: "Return from the Lungs",
        narrative: "Fresh oxygen floods your hemoglobin! You glow bright red with renewed life. The pulmonary veins carry you back to the heart's left side — find the receiving chamber.",
        displayName: "Left Atrium",
        keywords: ["left atrium"],
        points: 200,
        oxygenDrain: 1.0
    },
    {
        chapter: "Chapter 5",
        title: "The Power Chamber",
        narrative: "You enter the Left Atrium and are quickly pushed into the heart's most powerful chamber. Its thick muscular walls prepare to launch you throughout the entire body.",
        displayName: "Left Ventricle",
        keywords: ["left ventricle"],
        points: 150,
        oxygenDrain: 0.75
    },
    {
        chapter: "Chapter 6",
        title: "The Great Artery",
        narrative: "BOOM! The Left Ventricle contracts with enormous force. You're propelled into the body's largest artery — the vessel that will carry oxygen-rich blood to every tissue. Find it!",
        displayName: "Ascending Aorta",
        keywords: ["ascending aorta", "aorta"],
        points: 250,
        oxygenDrain: 1.5
    }
];

let api = null, apiDiscovery = null, annotationData = [], currentStep = 0, score = 0, streak = 0, timerInterval = null, oxygenInterval = null, elapsedSeconds = 0, oxygen = 100;
let gameStarted = false, gameComplete = false, hintUsed = false, audioEnabled = true, modelLoaded = false;
let isProcessingInput = false;
let audioContext = null, heartbeatInterval = null;
let leaderboard = JSON.parse(localStorage.getItem('cardiacLeaderboard')) || [
    { name: "Dr. Heart", score: 950, time: "1:32" }, { name: "CardioKing", score: 820, time: "1:58" }, { name: "BloodCell", score: 780, time: "2:15" }, { name: "Anatomist", score: 720, time: "2:40" }, { name: "MedStudent", score: 650, time: "3:05" }
];

function initAudio() { const AudioContext = window.AudioContext || window.webkitAudioContext; audioContext = new AudioContext(); }
function playHeartbeat() { if (!audioContext || !audioEnabled) return; if (audioContext.state === 'suspended') audioContext.resume(); const now = audioContext.currentTime; const osc1 = audioContext.createOscillator(); const gain1 = audioContext.createGain(); osc1.connect(gain1); gain1.connect(audioContext.destination); osc1.frequency.setValueAtTime(60, now); gain1.gain.setValueAtTime(0.3, now); gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15); osc1.start(now); osc1.stop(now + 0.15); const osc2 = audioContext.createOscillator(); const gain2 = audioContext.createGain(); osc2.connect(gain2); gain2.connect(audioContext.destination); osc2.frequency.setValueAtTime(50, now + 0.15); gain2.gain.setValueAtTime(0.2, now + 0.15); gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.3); osc2.start(now + 0.15); osc2.stop(now + 0.3); }
function startHeartbeat(bpm = 70) { stopHeartbeat(); const interval = 60000 / bpm; playHeartbeat(); heartbeatInterval = setInterval(playHeartbeat, interval); }
function stopHeartbeat() { if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; } }
document.getElementById('audio-toggle').addEventListener('click', () => { audioEnabled = !audioEnabled; const btn = document.getElementById('audio-toggle'); btn.textContent = audioEnabled ? '🔊' : '🔇'; btn.classList.toggle('muted', !audioEnabled); if (audioEnabled && gameStarted && !gameComplete) { startHeartbeat(); } else { stopHeartbeat(); } });

document.querySelectorAll('.nav-tab').forEach(tab => { tab.addEventListener('click', () => { document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active')); document.querySelectorAll('.page').forEach(p => p.classList.remove('active')); tab.classList.add('active'); document.getElementById(`page-${tab.dataset.page}`).classList.add('active'); if (tab.dataset.page === 'leaderboard') renderLeaderboard(); if (tab.dataset.page === 'discovery' && !apiDiscovery) initDiscoveryViewer(); }); });
document.getElementById('start-btn').addEventListener('click', () => { document.getElementById('start-overlay').classList.add('hidden'); initAudio(); initSketchfab(); });
document.getElementById('start-quiz-btn').addEventListener('click', () => { if (modelLoaded && !gameStarted) { document.getElementById('ready-overlay').classList.add('hidden'); startGame(); } });

function initSketchfab() { const iframe = document.getElementById('api-frame'); const client = new Sketchfab(iframe); client.init(MODEL_UID, { success: function (apiInstance) { api = apiInstance; api.start(); api.addEventListener('viewerready', function () { document.getElementById('loading').classList.add('hidden'); api.getAnnotationList(function (err, annotations) { if (!err && annotations.length > 0) { annotationData = annotations; } modelLoaded = true; document.getElementById('ready-overlay').classList.add('show'); }); api.addEventListener('annotationSelect', onAnnotationSelected); }); }, error: function () { console.error('Viewer error'); }, autostart: 0, annotations_visible: 1, ui_annotations: 1, ui_watermark: 0, ui_hint: 0 }); }

function onAnnotationSelected(index) {
    if (index === -1) return;
    if (!gameStarted || gameComplete || isProcessingInput) return;
    checkAnnotationAnswer(index);
}

function startGame() { gameStarted = true; gameComplete = false; currentStep = 0; score = 0; streak = 0; elapsedSeconds = 0; oxygen = 100; updateStats(); updateOxygenUI(); clearInterval(timerInterval); clearInterval(oxygenInterval); timerInterval = setInterval(() => { elapsedSeconds++; document.getElementById('timer').textContent = formatTime(elapsedSeconds); }, 1000); oxygenInterval = setInterval(drainOxygen, 1000); if (audioEnabled) startHeartbeat(70); playChapter(0); }

function playChapter(index) {
    isProcessingInput = false;
    const chapter = storyChapters[index];

    document.getElementById('story-phase').textContent = chapter.chapter;

    hintUsed = false;
    const hintBtn = document.getElementById('hint-btn');
    hintBtn.classList.remove('used');
    hintBtn.textContent = '💡 Hint (-50 pts)';

    resetFeedback();

    const progress = (index / storyChapters.length) * 100;
    document.getElementById('progress-fill').style.width = `${progress}%`;
    document.getElementById('progress-text').textContent = `${index} / ${storyChapters.length}`;

    document.getElementById('target-name').textContent = chapter.displayName;

    const titleEl = document.getElementById('story-title');
    const narrativeEl = document.getElementById('story-narrative');

    titleEl.innerHTML = '';
    narrativeEl.innerHTML = '';

    typeWriter(chapter.title, 'story-title', 40, () => {
        typeWriter(chapter.narrative, 'story-narrative', 20);
    });

    if (api) { api.deselectAnnotation(); }
}

function checkAnnotationAnswer(selectedIndex) {
    isProcessingInput = true;
    const chapter = storyChapters[currentStep];
    const selectedAnn = annotationData[selectedIndex];

    if (!selectedAnn) {
        isProcessingInput = false;
        return;
    }

    const selectedNorm = normalizeName(selectedAnn.name);

    const isCorrect = chapter.keywords.some(kw => {
        const kwNorm = normalizeName(kw);
        return selectedNorm.includes(kwNorm) || kwNorm.includes(selectedNorm);
    });

    if (isCorrect) {
        handleCorrectAnswer(chapter);
    } else {
        handleWrongAnswer(selectedAnn.name);
    }
}

function handleCorrectAnswer(chapter) { streak++; const streakBonus = Math.min(streak - 1, 5) * 30; const oxygenBonus = Math.round(oxygen / 2); const earned = chapter.points + streakBonus + oxygenBonus; score += earned; oxygen = Math.min(100, oxygen + 15); updateStats(); updateOxygenUI(); showFeedback(true, `Correct! +${earned} pts`); currentStep++; if (currentStep >= storyChapters.length) { setTimeout(completeGame, 1500); } else { setTimeout(() => { playChapter(currentStep); }, 2000); } }
function handleWrongAnswer(clickedName) { streak = 0; oxygen -= 5; updateOxygenUI(); updateStats(); showFeedback(false, `"${clickedName}" is incorrect. -5% Oxygen`); isProcessingInput = false; }

function typeWriter(text, elementId, speed, callback) { const element = document.getElementById(elementId); let i = 0; function type() { if (i < text.length) { element.innerHTML += text.charAt(i); i++; setTimeout(type, speed); } else { if (callback) callback(); } } type(); }
function drainOxygen() { if (!gameStarted || gameComplete) return; const chapter = storyChapters[currentStep]; oxygen -= chapter.oxygenDrain; if (oxygen <= 0) { oxygen = 0; gameOver(); } updateOxygenUI(); }
function updateOxygenUI() { const fill = document.getElementById('oxygen-fill'); const percent = document.getElementById('oxygen-percent'); const vital = document.getElementById('vital-signs'); const status = document.getElementById('status-text'); const vignette = document.getElementById('vignette'); fill.style.width = `${Math.max(0, oxygen)}%`; percent.textContent = `${Math.round(oxygen)}%`; if (oxygen < 30) { fill.style.background = '#ef4444'; vital.classList.add('critical'); vignette.classList.add('critical'); status.textContent = '⚠️ CRITICAL CONDITION'; status.classList.add('urgent'); if (audioEnabled && gameStarted) startHeartbeat(130); } else { fill.style.background = 'linear-gradient(90deg, #ef4444, #3b82f6)'; vital.classList.remove('critical'); vignette.classList.remove('critical'); status.textContent = 'Stable condition'; status.classList.remove('urgent'); if (audioEnabled && gameStarted) startHeartbeat(70); } }
function formatTime(sec) { const m = Math.floor(sec / 60); const s = sec % 60; return `${m}:${s.toString().padStart(2, '0')}`; }
function showFeedback(isCorrect, text) { const box = document.getElementById('feedback'); box.className = `feedback-box ${isCorrect ? 'correct' : 'wrong'}`; box.querySelector('.feedback-text').textContent = text; box.querySelector('.feedback-icon').textContent = isCorrect ? '✓' : '✗'; }
function resetFeedback() { const box = document.getElementById('feedback'); box.className = 'feedback-box'; box.querySelector('.feedback-text').textContent = 'Click an annotation on the 3D heart'; box.querySelector('.feedback-icon').textContent = ''; }
function updateStats() { document.getElementById('score').textContent = score; document.getElementById('streak').textContent = `${streak}🔥`; }

document.getElementById('hint-btn').addEventListener('click', () => {
    if (hintUsed || !api || isProcessingInput) return;

    const chapter = storyChapters[currentStep];

    const targetIndex = annotationData.findIndex(ann => {
        const annNorm = normalizeName(ann.name);
        return chapter.keywords.some(kw => {
            const kwNorm = normalizeName(kw);
            return annNorm.includes(kwNorm) || kwNorm.includes(annNorm);
        });
    });

    if (targetIndex === -1) {
        showFeedback(false, "Target not found in model.");
        return;
    }

    hintUsed = true;
    score = Math.max(0, score - 50);
    updateStats();

    const btn = document.getElementById('hint-btn');
    btn.textContent = 'Hint Used';
    btn.classList.add('used');

    api.gotoAnnotation(targetIndex, { preventCameraAnimation: false });
    showFeedback(false, "Camera moved to target area. (-50 pts)");
});

document.getElementById('skip-btn').addEventListener('click', () => { if (isProcessingInput) return; score = Math.max(0, score - 100); streak = 0; updateStats(); isProcessingInput = true; showFeedback(false, "Skipped (-100 pts)"); currentStep++; if (currentStep >= storyChapters.length) { completeGame(); } else { setTimeout(() => playChapter(currentStep), 1000); } });

function gameOver() { gameComplete = true; clearInterval(timerInterval); clearInterval(oxygenInterval); stopHeartbeat(); document.getElementById('gameover-overlay').classList.add('show'); }

function completeGame() { gameComplete = true; clearInterval(timerInterval); clearInterval(oxygenInterval); stopHeartbeat(); document.getElementById('final-score').textContent = score; document.getElementById('final-time').textContent = formatTime(elapsedSeconds); document.getElementById('final-oxygen').textContent = `${Math.round(oxygen)}%`; document.getElementById('completion-overlay').classList.add('show'); document.getElementById('score-entry').classList.add('show'); }

document.getElementById('retry-btn').addEventListener('click', () => {
    document.getElementById('gameover-overlay').classList.remove('show');
    gameStarted = false;
    gameComplete = false;
    document.getElementById('ready-overlay').classList.add('show');
});

document.getElementById('replay-btn').addEventListener('click', () => {
    document.getElementById('completion-overlay').classList.remove('show');
    document.getElementById('score-entry').classList.remove('show');
    gameStarted = false;
    gameComplete = false;
    document.getElementById('ready-overlay').classList.add('show');
});

document.getElementById('save-btn').addEventListener('click', () => { document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active')); document.querySelectorAll('.page').forEach(p => p.classList.remove('active')); document.querySelector('[data-page="leaderboard"]').classList.add('active'); document.getElementById('page-leaderboard').classList.add('active'); document.getElementById('completion-overlay').classList.remove('show'); renderLeaderboard(); });

function renderLeaderboard() { leaderboard.sort((a, b) => b.score - a.score); if (leaderboard[0]) { document.getElementById('p1-name').textContent = leaderboard[0].name; document.getElementById('p1-score').textContent = leaderboard[0].score; } if (leaderboard[1]) { document.getElementById('p2-name').textContent = leaderboard[1].name; document.getElementById('p2-score').textContent = leaderboard[1].score; } if (leaderboard[2]) { document.getElementById('p3-name').textContent = leaderboard[2].name; document.getElementById('p3-score').textContent = leaderboard[2].score; } const table = document.getElementById('leaderboard-table'); table.innerHTML = leaderboard.slice(3).map((p, i) => `<div class="leaderboard-row"><span class="rank">${i + 4}</span><div class="player-info"><span class="player-name">${p.name}</span></div><span class="player-score">${p.score}</span><span class="player-time">${p.time}</span></div>`).join(''); }
document.getElementById('submit-btn').addEventListener('click', () => { const name = document.getElementById('player-name').value || 'Anonymous'; leaderboard.push({ name, score, time: formatTime(elapsedSeconds) }); localStorage.setItem('cardiacLeaderboard', JSON.stringify(leaderboard)); document.getElementById('score-entry').classList.remove('show'); renderLeaderboard(); });

function initDiscoveryViewer() { const iframe = document.getElementById('discovery-frame'); const client = new Sketchfab(iframe); client.init(MODEL_UID, { success: function (inst) { apiDiscovery = inst; apiDiscovery.start(); apiDiscovery.addEventListener('viewerready', () => { apiDiscovery.getAnnotationList((err, anns) => { if (!err) displayAnnotations(anns); }); }); }, autostart: 1, ui_watermark: 0 }); }
function displayAnnotations(anns) { const list = document.getElementById('annotation-list'); list.innerHTML = anns.map((a, i) => `<div class="annotation-item" onclick="moveDiscoveryCam(${i})"><div class="index">${i + 1}</div><div class="title">${a.name}</div></div>`).join(''); }
window.moveDiscoveryCam = function (index) { if (apiDiscovery) apiDiscovery.gotoAnnotation(index); }
