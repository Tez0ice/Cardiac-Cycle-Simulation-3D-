// =============================================
// CHECK FOR FILE:// PROTOCOL
// =============================================
if (window.location.protocol === 'file:') {
    document.getElementById('server-notice').classList.add('show');
}

// =============================================
// CONFIGURATION
// =============================================
const MODEL_UID = 'a3f0ea2030214a6bbaa97e7357eebd58';

// Story Data
const storyChapters = [
    {
        chapter: "Chapter 1",
        title: "The Arrival",
        narrative: "You drift through darkness, exhausted and oxygen-depleted. The walls of the Superior Vena Cava guide you downward. Ahead, you sense an opening — the doorway into the heart's first chamber.",
        target: "Right Atrium",
        keywords: ["right atrium", "atrium", "auricle"],
        points: 150,
        oxygenDrain: 2
    },
    {
        chapter: "Chapter 2",
        title: "The First Chamber",
        narrative: "You've entered the Right Atrium. Other blood cells swirl around you in this crowded holding chamber. The pressure is building. You must find the valve that leads deeper into the heart.",
        target: "Tricuspid Valve",
        keywords: ["tricuspid", "valve", "right atrioventricular"],
        points: 150,
        oxygenDrain: 2.5
    },
    {
        chapter: "Chapter 3",
        title: "The Descent",
        narrative: "The Tricuspid Valve opens! You're pushed through into the Right Ventricle. The walls here are thick and muscular. You can feel them preparing to contract. Find the exit before you're crushed!",
        target: "Pulmonary Valve",
        keywords: ["pulmonary valve", "pulmonic", "semilunar"],
        points: 200,
        oxygenDrain: 3
    },
    {
        chapter: "Chapter 4",
        title: "Escape to the Lungs",
        narrative: "CONTRACTION! The ventricle squeezes with tremendous force. You're launched upward through the Pulmonary Valve into the Pulmonary Artery. Freedom! The lungs await — find the artery that will carry you there.",
        target: "Pulmonary Artery",
        keywords: ["pulmonary artery", "pulmonary trunk", "pulmonary"],
        points: 200,
        oxygenDrain: 2
    },
    {
        chapter: "Chapter 5",
        title: "Rebirth",
        narrative: "You've reached the lungs and absorbed fresh oxygen. Your hemoglobin glows bright red with life! Now you must return to the heart through the Pulmonary Veins to complete your mission.",
        target: "Left Atrium",
        keywords: ["left atrium", "atrium", "pulmonary vein"],
        points: 150,
        oxygenDrain: 1.5
    },
    {
        chapter: "Chapter 6",
        title: "The Final Push",
        narrative: "The Left Ventricle — the most powerful chamber of all. Its thick walls will launch you into the Aorta with enough force to reach every corner of the body. Find the great artery. Complete your journey!",
        target: "Aorta",
        keywords: ["aorta", "ascending aorta", "aortic"],
        points: 250,
        oxygenDrain: 3
    }
];

// =============================================
// STATE VARIABLES
// =============================================
let api = null;
let apiDiscovery = null;
let annotationData = [];
let currentStep = 0;
let score = 0;
let streak = 0;
let timerInterval = null;
let oxygenInterval = null;
let elapsedSeconds = 0;
let oxygen = 100;

// Flags for Game Logic
let gameStarted = false;
let gameComplete = false;
let hintUsed = false;
let audioEnabled = true;

// BUG FIX: Prevent event spam
let isProcessingInput = false;
let ignoreNextSelection = false;

// Audio context
let audioContext = null;
let heartbeatInterval = null;

// Leaderboard Data
let leaderboard = JSON.parse(localStorage.getItem('cardiacLeaderboard')) || [
    { name: "Dr. Heart", score: 950, time: "1:32" },
    { name: "CardioKing", score: 820, time: "1:58" },
    { name: "BloodCell", score: 780, time: "2:15" },
    { name: "Anatomist", score: 720, time: "2:40" },
    { name: "MedStudent", score: 650, time: "3:05" }
];

// =============================================
// AUDIO ENGINE
// =============================================
function initAudio() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioContext();
}

function playHeartbeat() {
    if (!audioContext || !audioEnabled) return;
    if (audioContext.state === 'suspended') audioContext.resume();

    // Simple synthetic heartbeat
    const now = audioContext.currentTime;

    // "Lub"
    const osc1 = audioContext.createOscillator();
    const gain1 = audioContext.createGain();
    osc1.connect(gain1);
    gain1.connect(audioContext.destination);
    osc1.frequency.setValueAtTime(60, now);
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc1.start(now);
    osc1.stop(now + 0.15);

    // "Dub"
    const osc2 = audioContext.createOscillator();
    const gain2 = audioContext.createGain();
    osc2.connect(gain2);
    gain2.connect(audioContext.destination);
    osc2.frequency.setValueAtTime(50, now + 0.15);
    gain2.gain.setValueAtTime(0.2, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.3);
}

function startHeartbeat(bpm = 70) {
    stopHeartbeat();
    const interval = 60000 / bpm;
    playHeartbeat(); // Play immediately
    heartbeatInterval = setInterval(playHeartbeat, interval);
}

function stopHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
}

// Audio Toggle Listener
document.getElementById('audio-toggle').addEventListener('click', () => {
    audioEnabled = !audioEnabled;
    const btn = document.getElementById('audio-toggle');
    btn.textContent = audioEnabled ? '🔊' : '🔇';
    btn.classList.toggle('muted', !audioEnabled);

    if (audioEnabled && gameStarted && !gameComplete) {
        startHeartbeat();
    } else {
        stopHeartbeat();
    }
});

// =============================================
// NAVIGATION & SETUP
// =============================================
document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`page-${tab.dataset.page}`).classList.add('active');

        if (tab.dataset.page === 'leaderboard') renderLeaderboard();
        if (tab.dataset.page === 'discovery' && !apiDiscovery) initDiscoveryViewer();
    });
});

document.getElementById('start-btn').addEventListener('click', () => {
    document.getElementById('start-overlay').classList.add('hidden');
    initAudio();
    initSketchfab();
});

// =============================================
// SKETCHFAB INTEGRATION
// =============================================
function initSketchfab() {
    const iframe = document.getElementById('api-frame');
    const client = new Sketchfab(iframe);

    client.init(MODEL_UID, {
        success: function (apiInstance) {
            api = apiInstance;
            api.start();
            api.addEventListener('viewerready', function () {
                document.getElementById('loading').classList.add('hidden');

                api.getAnnotationList(function (err, annotations) {
                    if (!err && annotations.length > 0) {
                        annotationData = annotations;
                    }
                    startGame();
                });

                // EVENT LISTENER
                api.addEventListener('annotationSelect', function (index) {
                    // BUG FIX: Ignore invalid, programmatic, or locked selections
                    if (index === -1) return;
                    if (ignoreNextSelection) {
                        ignoreNextSelection = false;
                        return;
                    }
                    if (!gameStarted || gameComplete || isProcessingInput) return;

                    checkAnnotationAnswer(index);
                });
            });
        },
        error: function () { console.error('Viewer error'); },
        autostart: 0,
        annotations_visible: 1,
        ui_annotations: 1,
        ui_watermark: 0,
        ui_hint: 0 // Hide built-in hints
    });
}

// =============================================
// GAMEPLAY LOGIC
// =============================================
function startGame() {
    gameStarted = true;
    gameComplete = false;
    currentStep = 0;
    score = 0;
    streak = 0;
    elapsedSeconds = 0;
    oxygen = 100;

    updateStats();
    updateOxygenUI();

    // Timers
    clearInterval(timerInterval);
    clearInterval(oxygenInterval);
    timerInterval = setInterval(() => {
        elapsedSeconds++;
        document.getElementById('timer').textContent = formatTime(elapsedSeconds);
    }, 1000);

    oxygenInterval = setInterval(drainOxygen, 1000);

    if (audioEnabled) startHeartbeat(70);

    playChapter(0);
}

function playChapter(index) {
    // Unlock input
    isProcessingInput = false;

    const chapter = storyChapters[index];

    document.getElementById('story-phase').textContent = chapter.chapter;

    // Reset Hints
    hintUsed = false;
    const hintBtn = document.getElementById('hint-btn');
    hintBtn.classList.remove('used');
    hintBtn.textContent = '💡 Hint (-50 pts)';

    resetFeedback();

    // Update Progress
    const progress = (index / storyChapters.length) * 100;
    document.getElementById('progress-fill').style.width = `${progress}%`;
    document.getElementById('progress-text').textContent = `${index} / ${storyChapters.length}`;

    document.getElementById('target-name').textContent = chapter.target;

    // Typewriter Effect
    const titleEl = document.getElementById('story-title');
    const narrativeEl = document.getElementById('story-narrative');

    // Clear previous text immediately
    titleEl.innerHTML = '';
    narrativeEl.innerHTML = '';

    typeWriter(chapter.title, 'story-title', 40, () => {
        typeWriter(chapter.narrative, 'story-narrative', 20);
    });

    // BUG FIX: Removed moveCameraToTarget(chapter) call.
    // Moving the camera to the target immediately spoils the game AND causes the loop bug.
    // Instead, we deselect any active annotation to start fresh.
    if (api) {
        api.deselectAnnotation();
    }
}

function checkAnnotationAnswer(selectedIndex) {
    // Lock input to prevent spam
    isProcessingInput = true;

    const chapter = storyChapters[currentStep];
    const selectedAnn = annotationData[selectedIndex];

    // Safety check
    if (!selectedAnn) {
        isProcessingInput = false;
        return;
    }

    const selectedName = (selectedAnn.name || '').toLowerCase();

    // Check keywords
    const isCorrect = chapter.keywords.some(kw => selectedName.includes(kw.toLowerCase()));

    if (isCorrect) {
        handleCorrectAnswer(chapter);
    } else {
        handleWrongAnswer(selectedAnn.name);
    }
}

function handleCorrectAnswer(chapter) {
    streak++;
    const streakBonus = Math.min(streak - 1, 5) * 30;
    const oxygenBonus = Math.round(oxygen / 2);
    const earned = chapter.points + streakBonus + oxygenBonus;
    score += earned;
    oxygen = Math.min(100, oxygen + 15);

    updateStats();
    updateOxygenUI();
    showFeedback(true, `Correct! +${earned} pts`);

    // Delay before next chapter
    currentStep++;

    if (currentStep >= storyChapters.length) {
        setTimeout(completeGame, 1500);
    } else {
        setTimeout(() => {
            playChapter(currentStep);
        }, 2000);
    }
}

function handleWrongAnswer(clickedName) {
    streak = 0;
    oxygen -= 5;
    updateOxygenUI();
    updateStats();
    showFeedback(false, `"${clickedName}" is incorrect. -5% Oxygen`);

    // Unlock input immediately so they can try again
    isProcessingInput = false;
}

// =============================================
// UTILITIES
// =============================================
function typeWriter(text, elementId, speed, callback) {
    const element = document.getElementById(elementId);
    let i = 0;

    // Basic Typewriter
    function type() {
        if (i < text.length) {
            element.innerHTML += text.charAt(i);
            i++;
            setTimeout(type, speed);
        } else {
            if (callback) callback();
        }
    }
    type();
}

function drainOxygen() {
    if (!gameStarted || gameComplete) return;

    const chapter = storyChapters[currentStep];
    oxygen -= chapter.oxygenDrain;
    if (oxygen <= 0) {
        oxygen = 0;
        gameOver();
    }
    updateOxygenUI();
}

function updateOxygenUI() {
    const fill = document.getElementById('oxygen-fill');
    const percent = document.getElementById('oxygen-percent');
    const vital = document.getElementById('vital-signs');
    const status = document.getElementById('status-text');

    fill.style.width = `${Math.max(0, oxygen)}%`;
    percent.textContent = `${Math.round(oxygen)}%`;

    if (oxygen < 30) {
        fill.style.background = '#ef4444';
        vital.classList.add('critical');
        status.textContent = '⚠️ CRITICAL CONDITION';
        status.classList.add('urgent');
        startHeartbeat(130); // Fast heartbeat
    } else {
        fill.style.background = 'linear-gradient(90deg, #ef4444, #3b82f6)';
        vital.classList.remove('critical');
        status.textContent = 'Stable condition';
        status.classList.remove('urgent');
        startHeartbeat(70); // Normal heartbeat
    }
}

function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function showFeedback(isCorrect, text) {
    const box = document.getElementById('feedback');
    box.className = `feedback-box ${isCorrect ? 'correct' : 'wrong'}`;
    box.querySelector('.feedback-text').textContent = text;
    box.querySelector('.feedback-icon').textContent = isCorrect ? '✓' : '✗';
}

function resetFeedback() {
    const box = document.getElementById('feedback');
    box.className = 'feedback-box';
    box.querySelector('.feedback-text').textContent = 'Click an annotation on the 3D heart';
    box.querySelector('.feedback-icon').textContent = '';
}

function updateStats() {
    document.getElementById('score').textContent = score;
    document.getElementById('streak').textContent = `${streak}🔥`;
}

// =============================================
// HINT SYSTEM
// =============================================
document.getElementById('hint-btn').addEventListener('click', () => {
    if (hintUsed || !api || isProcessingInput) return;

    const chapter = storyChapters[currentStep];
    // Find index of target
    const targetIndex = annotationData.findIndex(ann =>
        chapter.keywords.some(kw => (ann.name || '').toLowerCase().includes(kw.toLowerCase()))
    );

    if (targetIndex >= 0) {
        hintUsed = true;
        score = Math.max(0, score - 50);
        updateStats();
        document.getElementById('hint-btn').classList.add('used');
        document.getElementById('hint-btn').textContent = 'Hint Used';

        // BUG FIX: Set flag to ignore the event generated by camera movement
        ignoreNextSelection = true;

        api.gotoAnnotation(targetIndex, { preventCameraAnimation: false }, () => {
            showFeedback(false, "Camera moved to target area. (-50 pts)");
        });
    }
});

// =============================================
// SKIP SYSTEM
// =============================================
document.getElementById('skip-btn').addEventListener('click', () => {
    if (isProcessingInput) return;
    score = Math.max(0, score - 100);
    streak = 0;
    updateStats();

    // Briefly lock input
    isProcessingInput = true;

    showFeedback(false, "Skipped (-100 pts)");

    currentStep++;
    if (currentStep >= storyChapters.length) {
        completeGame();
    } else {
        setTimeout(() => playChapter(currentStep), 1000);
    }
});

// =============================================
// END GAME LOGIC
// =============================================
function gameOver() {
    gameComplete = true;
    clearInterval(timerInterval);
    clearInterval(oxygenInterval);
    stopHeartbeat();
    document.getElementById('gameover-overlay').classList.add('show');
}

function completeGame() {
    gameComplete = true;
    clearInterval(timerInterval);
    clearInterval(oxygenInterval);
    stopHeartbeat();

    document.getElementById('final-score').textContent = score;
    document.getElementById('final-time').textContent = formatTime(elapsedSeconds);
    document.getElementById('final-oxygen').textContent = `${Math.round(oxygen)}%`;

    document.getElementById('completion-overlay').classList.add('show');
    document.getElementById('score-entry').classList.add('show');
}

document.getElementById('retry-btn').addEventListener('click', () => {
    document.getElementById('gameover-overlay').classList.remove('show');
    startGame();
});

document.getElementById('replay-btn').addEventListener('click', () => {
    document.getElementById('completion-overlay').classList.remove('show');
    startGame();
});

// =============================================
// LEADERBOARD & DISCOVERY
// =============================================
function renderLeaderboard() {
    leaderboard.sort((a, b) => b.score - a.score);
    // Fill top 3
    if (leaderboard[0]) {
        document.getElementById('p1-name').textContent = leaderboard[0].name;
        document.getElementById('p1-score').textContent = leaderboard[0].score;
    }
    if (leaderboard[1]) {
        document.getElementById('p2-name').textContent = leaderboard[1].name;
        document.getElementById('p2-score').textContent = leaderboard[1].score;
    }
    if (leaderboard[2]) {
        document.getElementById('p3-name').textContent = leaderboard[2].name;
        document.getElementById('p3-score').textContent = leaderboard[2].score;
    }

    // Fill Table
    const table = document.getElementById('leaderboard-table');
    table.innerHTML = leaderboard.slice(3).map((p, i) => `
            <div class="leaderboard-row">
                <span class="rank">${i + 4}</span>
                <div class="player-info">
                    <span class="player-name">${p.name}</span>
                </div>
                <span class="player-score">${p.score}</span>
                <span class="player-time">${p.time}</span>
            </div>
        `).join('');
}

document.getElementById('submit-btn').addEventListener('click', () => {
    const name = document.getElementById('player-name').value || 'Anonymous';
    leaderboard.push({ name, score, time: formatTime(elapsedSeconds) });
    localStorage.setItem('cardiacLeaderboard', JSON.stringify(leaderboard));
    document.getElementById('score-entry').classList.remove('show');
    renderLeaderboard();
});

function initDiscoveryViewer() {
    const iframe = document.getElementById('discovery-frame');
    const client = new Sketchfab(iframe);
    client.init(MODEL_UID, {
        success: function (inst) {
            apiDiscovery = inst;
            apiDiscovery.start();
            apiDiscovery.addEventListener('viewerready', () => {
                apiDiscovery.getAnnotationList((err, anns) => {
                    if (!err) displayAnnotations(anns);
                });
            });
        },
        autostart: 1,
        ui_watermark: 0
    });
}

function displayAnnotations(anns) {
    const list = document.getElementById('annotation-list');
    list.innerHTML = anns.map((a, i) => `
            <div class="annotation-item" onclick="moveDiscoveryCam(${i})">
                <div class="index">${i + 1}</div>
                <div class="title">${a.name}</div>
            </div>
        `).join('');
}

// Global scope for HTML onclick
window.moveDiscoveryCam = function (index) {
    if (apiDiscovery) apiDiscovery.gotoAnnotation(index);
}
