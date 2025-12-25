// src/renderer.js - Phase 3 (Transparent Overlay + Automation)
const { ipcRenderer } = require('electron');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- Configuration ---
const GEMINI_MODEL = "gemini-2.5-flash";
const ELEVEN_MODEL = "eleven_turbo_v2_5";
const MEOW_SOUNDS = ["meow1.mp3", "meow2.mp3", "meow3.mp3"];

// --- State ---
let isListening = false;
let mediaRecorder = null;
let audioChunks = [];
let voiceId = null;
let geminiKey = null;
let elevenKey = null;
let roamMode = 'FULL'; // FULL, BOTTOM, NONE

// Helper to log to screen
function logToScreen(msg) {
    console.log(msg);
    const overlay = document.getElementById('debug-overlay');
    if (overlay) {
        overlay.style.display = 'block'; // Ensure visible logic
        const div = document.createElement('div');
        div.textContent = `> ${msg}`;
        div.style.background = "rgba(0,0,0,0.7)"; // background only on text line
        div.style.marginBottom = "2px";
        div.style.padding = "2px 5px";
        div.style.borderRadius = "4px";
        overlay.prepend(div);

        // Auto-cleanup logging
        if (overlay.children.length > 10) overlay.lastElementChild.remove();
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    logToScreen('✨ Phase 3: Desktop Overlay Active');

    const micBtn = document.getElementById('btn-mic');
    const header = document.querySelector('header');

    // 1. Initialize Pixi Application
    try { initPixi(); } catch (e) { logToScreen("❌ Pixi Failed: " + e.message); }

    // 2. Load Keys
    try {
        geminiKey = await ipcRenderer.invoke('get-env', 'GEMINI_API_KEY');
        elevenKey = await ipcRenderer.invoke('get-env', 'ELEVENLABS_API_KEY');
        voiceId = await ipcRenderer.invoke('get-env', 'ELEVENLABS_VOICE_ID');
        logToScreen(`✅ Keys Loaded.`);
    } catch (e) {
        logToScreen("❌ Key Load Failed: " + e.message);
    }

    // 3. Setup Voice
    await setupAudioRecording();

    // 4. Setup Controls & Interactivity
    if (micBtn) {
        micBtn.addEventListener('click', () => toggleListening());
        // Hover: Capture Mouse
        micBtn.addEventListener('mouseenter', () => setIgnoreMouseEvents(false));
        micBtn.addEventListener('mouseleave', () => setIgnoreMouseEvents(true));

        // Add MODE Button
        const modeBtn = document.createElement('button');
        modeBtn.textContent = "MODE: FULL";
        modeBtn.style.padding = "5px 10px";
        modeBtn.style.marginLeft = "10px";
        modeBtn.style.fontSize = "12px";
        modeBtn.style.cursor = "pointer";
        modeBtn.style.background = "rgba(0,0,0,0.5)";
        modeBtn.style.color = "white";
        modeBtn.style.border = "1px solid rgba(255,255,255,0.3)";
        modeBtn.style.borderRadius = "5px";
        modeBtn.addEventListener('click', () => {
            cycleRoamMode(modeBtn);
        });
        modeBtn.addEventListener('mouseenter', () => setIgnoreMouseEvents(false));
        modeBtn.addEventListener('mouseleave', () => setIgnoreMouseEvents(true));
        micBtn.parentNode.appendChild(modeBtn);
    }

    if (header) {
        header.addEventListener('mouseenter', () => setIgnoreMouseEvents(false));
        header.addEventListener('mouseleave', () => setIgnoreMouseEvents(true));
        // Add Context Menu for Roam Mode (Right Click Header)
        header.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            cycleRoamMode();
        });
    }

    // Default: Ignore mouse (Pass-through)
    setIgnoreMouseEvents(true);

});

function cycleRoamMode(btn = null) {
    if (roamMode === 'FULL') { roamMode = 'BOTTOM'; showBubble("Mode: Bottom Only ⬇️"); if (btn) btn.textContent = "MODE: BTM"; }
    else if (roamMode === 'BOTTOM') { roamMode = 'NONE'; showBubble("Mode: Hidden 👻"); if (btn) btn.textContent = "MODE: OFF"; }
    else { roamMode = 'FULL'; showBubble("Mode: Full Screen 🌍"); if (btn) btn.textContent = "MODE: FULL"; }

    // Apply immediate visibility fix
    const catEl = document.getElementById('character');
    const humEl = document.getElementById('human-actor');

    // Teleport to valid positions to prevent 'getting stuck'
    if (roamMode === 'BOTTOM') {
        const floor = window.innerHeight - 50;
        if (actors.cat) actors.cat.y = floor;
        if (actors.human) actors.human.y = floor;
    }

    if (roamMode === 'NONE') {
        if (catEl) catEl.style.display = 'none';
        if (humEl) humEl.style.display = 'none';
    } else {
        if (catEl) catEl.style.display = 'block';
        if (humEl) humEl.style.display = 'block';
    }
}

// --- Window Transparency Logic ---
function setIgnoreMouseEvents(ignore) {
    if (ignore) {
        ipcRenderer.send('set-ignore-mouse-events', true, { forward: true });
    } else {
        ipcRenderer.send('set-ignore-mouse-events', false);
    }
}

// --- Character Engine (Human & Cat) ---

let charContainer;
let charCanvas;
let charCtx;
let lastTime = 0;
let catSpriteSheet;
let humanSpriteSheet;

// Actors State
let actors = {
    cat: {
        x: window.innerWidth / 2 + 50,
        y: window.innerHeight / 2,
        vx: 0, vy: 0,
        targetX: window.innerWidth / 2,
        targetY: window.innerHeight / 2,
        state: 'IDLE',
        frame: 0, timer: 0, facingRight: true, idleTime: 0, scale: 1.5,
        sleepTime: 0, sleepDuration: 10000
    },
    human: {
        x: window.innerWidth / 2 - 50,
        y: window.innerHeight / 2,
        vx: 0, vy: 0,
        targetX: window.innerWidth / 2,
        targetY: window.innerHeight / 2,
        state: 'IDLE',
        frame: 0, timer: 0, facingRight: true,
        scale: 2.5, isTalking: false,
        lastFaceChange: 0
    }
};

// Global Timers
let thoughtTimer = 0;
let nextThoughtTime = 2000;
let meowTimer = 0;
let nextMeowTime = 5000;
let humanTextTimer = 0;
let activeHumanThought = null;
let floatingEmojis = []; // Track active emojis for following

function initPixi() {
    charContainer = document.getElementById('character');
    charCanvas = document.getElementById('sprite-canvas');
    if (!charContainer || !charCanvas) return;

    charCtx = charCanvas.getContext('2d');
    generatePixelSprites();
    setupInteraction();

    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
    logToScreen("🧑‍🤝‍🐈 Duo Loaded: Kitty & Owner");
}

function setupInteraction() {
    let isDragging = false;
    let dragOffsetX = 0, dragOffsetY = 0, lastDragSound = 0;

    charContainer.addEventListener('mousedown', (e) => {
        const dx = e.clientX - actors.cat.x;
        const dy = e.clientY - actors.cat.y;
        if (Math.abs(dx) < 60 && Math.abs(dy) < 60) {
            isDragging = true;
            dragOffsetX = e.clientX - actors.cat.x;
            dragOffsetY = e.clientY - actors.cat.y;
            actors.cat.state = 'DRAGGED';
            playDragSound();
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        actors.cat.x = e.clientX - dragOffsetX;
        actors.cat.y = e.clientY - dragOffsetY;
        if (Date.now() - lastDragSound > 600) { playDragSound(); lastDragSound = Date.now(); }
    });

    window.addEventListener('mouseup', () => {
        if (isDragging) { isDragging = false; actors.cat.state = 'IDLE'; actors.cat.vy = 5; }
    });

    charContainer.addEventListener('mouseenter', () => setIgnoreMouseEvents(false));
    charContainer.addEventListener('mouseleave', () => { if (!isDragging) setIgnoreMouseEvents(true); });
}

function generatePixelSprites() {
    const rect = (ctx, x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };

    // CAT
    const cs = document.createElement('canvas'); cs.width = 128; cs.height = 160;
    const ctxC = cs.getContext('2d');
    // Row 0: IDLE
    for (let f = 0; f < 4; f++) {
        let ox = f * 32; rect(ctxC, ox + 10, 14, 12, 12, '#ecf0f1'); rect(ctxC, ox + 9, 8, 14, 10, '#ecf0f1'); rect(ctxC, ox + 9, 5, 3, 3, '#bdc3c7'); rect(ctxC, ox + 19, 5, 3, 3, '#bdc3c7');
        if (f !== 3) { rect(ctxC, ox + 11, 11, 2, 2, '#2c3e50'); rect(ctxC, ox + 18, 11, 2, 2, '#2c3e50'); } else { rect(ctxC, ox + 11, 12, 2, 1, '#2c3e50'); rect(ctxC, ox + 18, 12, 2, 1, '#2c3e50'); }
        let tx = (f % 2) * 2; rect(ctxC, ox + 22, 20, 2 + tx, 3, '#95a5a6');
    }
    // Row 1: WALK
    for (let f = 0; f < 4; f++) {
        let ox = f * 32; let oy = 32; let bob = (f % 2 === 0) ? -1 : 0; rect(ctxC, ox + 8, oy + 16 + bob, 16, 9, '#ecf0f1'); rect(ctxC, ox + 20, oy + 10 + bob, 10, 8, '#ecf0f1');
        rect(ctxC, ox + 21, oy + 7 + bob, 2, 3, '#bdc3c7'); rect(ctxC, ox + 27, oy + 7 + bob, 2, 3, '#bdc3c7'); let l1 = (f === 0 || f === 3) ? 3 : 0; rect(ctxC, ox + 10 + l1, oy + 25 + bob, 3, 4, '#bdc3c7'); rect(ctxC, ox + 18 - l1, oy + 25 + bob, 3, 4, '#bdc3c7');
    }
    // Row 2: SLEEP
    for (let f = 0; f < 4; f++) { let ox = f * 32; let oy = 64; rect(ctxC, ox + 8, oy + 18, 16, 10, '#ecf0f1'); rect(ctxC, ox + 10, oy + 16, 12, 4, '#bdc3c7'); if (f % 2 === 0) { ctxC.fillStyle = '#3498db'; ctxC.fillText("z", ox + 24, oy + 10); } }
    // Row 3: SURPRISE
    for (let f = 0; f < 4; f++) { let ox = f * 32; let oy = 96; rect(ctxC, ox + 10, oy + 10, 12, 18, '#ecf0f1'); rect(ctxC, ox + 11, oy + 12, 3, 3, '#2c3e50'); rect(ctxC, ox + 17, oy + 12, 3, 3, '#2c3e50'); rect(ctxC, ox + 14, oy + 6, 2, 4, '#bdc3c7'); }
    // Row 4: DRAGGED
    for (let f = 0; f < 4; f++) {
        let ox = f * 32; let oy = 128; rect(ctxC, ox + 10, oy + 10, 12, 16, '#ecf0f1'); rect(ctxC, ox + 9, oy + 4, 14, 10, '#ecf0f1'); rect(ctxC, ox + 11, oy + 7, 2, 2, '#2c3e50'); rect(ctxC, ox + 18, oy + 7, 2, 2, '#2c3e50');
        rect(ctxC, ox + 6, oy + 12, 4, 8, '#bdc3c7'); rect(ctxC, ox + 22, oy + 12, 4, 8, '#bdc3c7'); let k = (f % 2 === 0) ? -2 : 2; rect(ctxC, ox + 10, oy + 26 + k, 3, 5, '#bdc3c7'); rect(ctxC, ox + 19, oy + 26 - k, 3, 5, '#bdc3c7');
    }
    catSpriteSheet = cs;

    // HUMAN
    const hs = document.createElement('canvas'); hs.width = 128; hs.height = 128;
    const ctxH = hs.getContext('2d');
    // Row 0: IDLE
    for (let f = 0; f < 4; f++) {
        let ox = f * 32; rect(ctxH, ox + 12, 6, 8, 8, '#ffccaa'); rect(ctxH, ox + 12, 4, 8, 3, '#6d4c41'); if (f !== 3) { rect(ctxH, ox + 14, 9, 1, 1, '#000'); rect(ctxH, ox + 17, 9, 1, 1, '#000'); }
        rect(ctxH, ox + 11, 14, 10, 10, '#3498db'); rect(ctxH, ox + 9, 14, 2, 8, '#ffccaa'); rect(ctxH, ox + 21, 14, 2, 8, '#ffccaa'); rect(ctxH, ox + 11, 24, 4, 8, '#2c3e50'); rect(ctxH, ox + 17, 24, 4, 8, '#2c3e50');
    }
    // Row 1: WALK/RUN (SIDE)
    for (let f = 0; f < 4; f++) {
        let ox = f * 32; let oy = 32; let bob = (f % 2 !== 0) ? -2 : 0;
        rect(ctxH, ox + 12, oy + 6 + bob, 8, 8, '#ffccaa'); rect(ctxH, ox + 12, oy + 4 + bob, 8, 3, '#6d4c41');
        rect(ctxH, ox + 18, oy + 8 + bob, 2, 2, '#000'); rect(ctxH, ox + 13, oy + 14 + bob, 6, 10, '#3498db');
        if (f === 1) { rect(ctxH, ox + 16, oy + 16 + bob, 4, 3, '#ffccaa'); }
        else if (f === 3) { rect(ctxH, ox + 10, oy + 16 + bob, 4, 3, '#ffccaa'); }
        else { rect(ctxH, ox + 15, oy + 14 + bob, 2, 8, '#ffccaa'); }
        if (f === 0 || f === 2) { rect(ctxH, ox + 14, oy + 24 + bob, 4, 8, '#2c3e50'); }
        else if (f === 1) { rect(ctxH, ox + 10, oy + 24 + bob, 3, 6, '#2c3e50'); rect(ctxH, ox + 19, oy + 24 + bob, 3, 6, '#2c3e50'); }
        else if (f === 3) { rect(ctxH, ox + 12, oy + 24 + bob, 3, 6, '#2c3e50'); rect(ctxH, ox + 17, oy + 24 + bob, 3, 6, '#2c3e50'); }
    }
    // Row 2: TALK
    for (let f = 0; f < 4; f++) {
        let ox = f * 32; let oy = 64; rect(ctxH, ox + 12, oy + 6, 8, 8, '#ffccaa'); rect(ctxH, ox + 12, oy + 4, 8, 3, '#6d4c41'); rect(ctxH, ox + 11, oy + 14, 10, 10, '#3498db'); rect(ctxH, ox + 11, oy + 24, 4, 8, '#2c3e50'); rect(ctxH, ox + 17, oy + 24, 4, 8, '#2c3e50');
        if (f % 2 === 0) rect(ctxH, ox + 15, oy + 12, 2, 1, '#d35400'); else rect(ctxH, ox + 15, oy + 11, 2, 3, '#a04000'); if (f === 1 || f === 2) rect(ctxH, ox + 21, oy + 10, 4, 4, '#ffccaa');
    }
    humanSpriteSheet = hs;
}

function gameLoop(timestamp) {
    const dt = timestamp - lastTime;
    lastTime = timestamp;
    if (roamMode !== 'NONE') {
        updateCat(dt);
        updateHuman(dt);
        // Clean and update emojis
        updateFloatingEmojis(dt);

        charCtx.clearRect(0, 0, 128, 128);
        drawActorOnCtx(charCtx, actors.cat, catSpriteSheet);
        const catEl = document.getElementById('character');
        if (catEl) { catEl.style.left = actors.cat.x + 'px'; catEl.style.top = actors.cat.y + 'px'; }
        updateBubblePosition();
    }
    requestAnimationFrame(gameLoop);
}

function updateCat(dt) {
    let pet = actors.cat;
    // Roam Mode Constraints
    let minY = 0; let maxY = window.innerHeight;
    let fixedY = null;
    if (roamMode === 'BOTTOM') {
        fixedY = window.innerHeight - 50; // Extreme Bottom Floor (Lowered another 30px)
        minY = fixedY;
    }

    if (pet.state === 'IDLE') {
        pet.idleTime += dt;
        let r = Math.random();
        if (r < 0.05) { pet.state = 'SLEEP'; pet.sleepTime = 0; pet.sleepDuration = 5000 + Math.random() * 5000; }
        else if (r < 0.55) startZoomies(pet, minY);
        else pickRandomTarget(pet, minY);

        meowTimer += dt;
        if (meowTimer > nextMeowTime) { meowTimer = 0; nextMeowTime = 8000 + Math.random() * 10000; playRealMeow(); }
    } else if (pet.state === 'SLEEP') {
        pet.sleepTime += dt;
        if (Math.random() < 0.02) spawnFloatingEmoji("zzz", pet.x + 10, pet.y - 20, "24px", "#3498db");
        if (pet.sleepTime > pet.sleepDuration) {
            pet.state = 'SURPRISE';
            // In Bottom Mode, NO upward jump (vy) to keep linear
            if (roamMode !== 'BOTTOM') pet.vy = -3;
            playRealMeow();
            setTimeout(() => pickRandomTarget(pet, minY), 1000);
        }
    } else if (pet.state === 'WALK' || pet.state === 'RUN') {
        pet.idleTime = 0;
        const dx = pet.targetX - pet.x; const dy = pet.targetY - pet.y; const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 20) { pet.state = 'IDLE'; }
        else {
            let speed = (pet.state === 'RUN') ? 8 : 3;
            pet.vx = (dx / dist) * speed; pet.vy = (dy / dist) * speed;
            pet.x += pet.vx; pet.y += pet.vy; pet.facingRight = pet.vx > 0;
            if (pet.state === 'RUN' && Math.random() < 0.05) pickRandomTarget(pet, minY);
        }
    } else if (pet.state === 'DRAGGED') { pet.idleTime = 0; }

    // Bounds / Physics
    if (pet.state === 'SURPRISE') {
        if (roamMode !== 'BOTTOM') { pet.vy += 0.2; pet.y += pet.vy; }
    }

    // Force Floor in Bottom Mode
    if (roamMode === 'BOTTOM') {
        // Linear interpolation to floor if not there
        if (Math.abs(pet.y - fixedY) > 5) pet.y += (fixedY - pet.y) * 0.1;
        else pet.y = fixedY;
    } else {
        if (pet.y < minY) pet.y += 5; if (pet.y > maxY - 50) pet.y = maxY - 50;
    }
    if (pet.x < 0) pet.x = 0; if (pet.x > window.innerWidth - 50) pet.x = window.innerWidth - 50;

    pet.timer += dt;
    let speed = (pet.state === 'SLEEP') ? 500 : (pet.state === 'RUN' ? 30 : (pet.state === 'WALK' ? 80 : 200));
    if (pet.timer > speed) { pet.timer = 0; pet.frame = (pet.frame + 1) % 4; }

    // Thoughts
    if (pet.state !== 'SLEEP') {
        thoughtTimer += dt;
        if (thoughtTimer > nextThoughtTime) { thoughtTimer = 0; nextThoughtTime = 4000 + Math.random() * 4000; showRandomCuteThought(); }
    }
}

function updateHuman(dt) {
    let hum = actors.human;
    let cat = actors.cat;

    let floorY = null;
    if (roamMode === 'BOTTOM') floorY = window.innerHeight - 130;

    // 1. Chase logic
    let dist = Math.sqrt(Math.pow(cat.x - hum.x, 2) + Math.pow(cat.y - hum.y, 2));

    if (cat.state === 'RUN') {
        hum.state = 'CHASE';
        let angle = Math.atan2(cat.y - hum.y, cat.x - hum.x);
        hum.x += Math.cos(angle) * 5;

        // Locked Y in Bottom Mode
        if (roamMode === 'BOTTOM') {
            // No vertical movement
        } else {
            hum.y += Math.sin(angle) * 5;
        }

        let cosA = Math.cos(angle);
        // STABILIZER: Strict Turn Locking
        // 1. Must be moving fast enough to justify turn
        // 2. Must exceed hysteresis timer
        // 3. Must not be "on top" of target
        if (dist > 60 && Date.now() - hum.lastFaceChange > 1500) {
            if (cosA > 0.6 && !hum.facingRight) { hum.facingRight = true; hum.lastFaceChange = Date.now(); }
            else if (cosA < -0.6 && hum.facingRight) { hum.facingRight = false; hum.lastFaceChange = Date.now(); }
        }

        humanTextTimer += dt;
        if (humanTextTimer > 3000) {
            humanTextTimer = 0;
            const shouts = ["Stop!", "Wait!", "Food!", "Hey!!", "Zoomies!"];
            showHumanThought(shouts[Math.floor(Math.random() * shouts.length)]);
        }
    } else if (dist > 200) {
        hum.state = 'WALK';
        let angle = Math.atan2(cat.y - hum.y, cat.x - hum.x);
        hum.x += Math.cos(angle) * 2;
        if (roamMode !== 'BOTTOM') hum.y += Math.sin(angle) * 2;

        let cosA = Math.cos(angle);
        if (Date.now() - hum.lastFaceChange > 1500) {
            if (cosA > 0.6 && !hum.facingRight) { hum.facingRight = true; hum.lastFaceChange = Date.now(); }
            else if (cosA < -0.6 && hum.facingRight) { hum.facingRight = false; hum.lastFaceChange = Date.now(); }
        }
    } else {
        if (Math.random() < 0.05) {
            hum.state = 'WALK';
            hum.targetX = hum.x + (Math.random() * 200 - 100);
            if (roamMode === 'BOTTOM') hum.targetY = floorY;
            else hum.targetY = hum.y + (Math.random() * 100 - 50);
        } else {
            hum.state = hum.isTalking ? 'TALK' : 'IDLE';
            if (Math.random() < 0.005) {
                const musings = ["Hmm...", "Where is Kitty?", "Kitty?", "Work time."];
                showHumanThought(musings[Math.floor(Math.random() * musings.length)]);
            }
        }
    }

    // Bounds / Roam
    let minY = 0; let maxY = window.innerHeight;

    if (roamMode === 'BOTTOM') {
        // Force Floor
        if (Math.abs(hum.y - floorY) > 5) hum.y += (floorY - hum.y) * 0.1;
        else hum.y = floorY;
    } else {
        if (hum.y < minY) hum.y += 5; if (hum.y > maxY - 50) hum.y = maxY - 50;
    }

    if (hum.x < 0) hum.x = 0; if (hum.x > window.innerWidth - 50) hum.x = window.innerWidth - 50;

    // DOM Update
    let el = document.getElementById('human-actor');
    if (!el) {
        el = document.createElement('div'); el.id = 'human-actor';
        el.style.position = 'absolute'; el.style.width = '128px'; el.style.height = '128px';
        el.style.pointerEvents = 'auto'; el.style.zIndex = '45';
        const c = document.createElement('canvas'); c.width = 128; c.height = 128; el.appendChild(c);
        document.body.appendChild(el);
        el.addEventListener('mouseenter', () => setIgnoreMouseEvents(false));
        el.addEventListener('mouseleave', () => setIgnoreMouseEvents(true));
        // CLICK INTERACTION
        el.addEventListener('click', () => {
            speak("Hi there! Here's my playful kitty!");
            hum.isTalking = true; setTimeout(() => hum.isTalking = false, 3000);
        });

        el.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            cycleRoamMode();
        });
    }
    el.style.left = hum.x + 'px'; el.style.top = hum.y + 'px';

    const ctx = el.querySelector('canvas').getContext('2d');
    ctx.clearRect(0, 0, 128, 128);
    drawActorOnCtx(ctx, hum, humanSpriteSheet);

    hum.timer += dt;
    let speed = (hum.state === 'CHASE') ? 60 : 150;
    if (hum.timer > speed) { hum.timer = 0; hum.frame = (hum.frame + 1) % 4; }
}

function startZoomies(p, minY = 0) {
    p.state = 'RUN';
    p.targetX = Math.random() * window.innerWidth;

    if (roamMode === 'BOTTOM') {
        p.targetY = window.innerHeight - 50; // Fixed Floor (Cat)
    } else {
        p.targetY = minY + Math.random() * (window.innerHeight - minY);
    }
}

function drawActorOnCtx(ctx, actor, sheet) {
    if (!sheet) return;
    ctx.save();
    ctx.translate(64, 64);
    // Corrected Flipping: Positive Scale = Right (Default), Negative = Left
    ctx.scale(actor.facingRight ? actor.scale : -actor.scale, actor.scale);
    let row = 0;
    if (actor.state === 'WALK' || actor.state === 'RUN' || actor.state === 'CHASE') row = 1;
    if (actor.state === 'SLEEP' || actor.state === 'TALK') row = 2;
    if (actor.state === 'SURPRISE') row = 3;
    if (actor.state === 'DRAGGED') row = 4;
    ctx.drawImage(sheet, actor.frame * 32, row * 32, 32, 32, -16, -16, 32, 32);
    ctx.restore();
}

function pickRandomTarget(p, minY = 0) {
    p.targetX = Math.random() * window.innerWidth;

    if (roamMode === 'BOTTOM') {
        p.targetY = window.innerHeight - 50;  // Fixed Floor (Cat)
    } else {
        p.targetY = minY + Math.random() * (window.innerHeight - minY);
    }

    if (p.targetX < 20) p.targetX = 20; if (p.targetX > window.innerWidth - 50) p.targetX = window.innerWidth - 50;
    if (p.targetY < 20) p.targetY = 20; if (p.targetY > window.innerHeight - 50) p.targetY = window.innerHeight - 50;
    p.state = 'WALK';
}

// Single Bubble Logic
function showHumanThought(text) {
    if (activeHumanThought) activeHumanThought.remove();
    // Offset closer to head: y - 10 (Directly above sprite top)
    // Locked tracking
    activeHumanThought = spawnFloatingEmoji(text, actors.human.x, actors.human.y, "16px", "#FFF", actors.human);
}

function spawnFloatingEmoji(text, x, y, size = "24px", color = "#FFF", attachTo = null) {
    const h = document.createElement('div');
    h.textContent = text;
    h.style.position = "absolute";
    h.style.left = x + "px";
    h.style.top = y + "px";
    h.style.fontSize = size; h.style.color = color; h.style.pointerEvents = "none";
    h.style.zIndex = "9999"; h.style.fontWeight = "bold";
    h.style.textShadow = "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000";
    h.style.fontFamily = "Arial, sans-serif";
    h.style.transition = "opacity 0.5s"; // Only fade opacity
    document.body.appendChild(h);

    // Add to tracking array
    const bubble = {
        el: h,
        life: 2000,
        offsetY: 0,
        attachActor: attachTo,
        baseX: 0, // Relative offset if attached
        baseY: -50
    };

    if (attachTo) {
        // Calculate initial relative offset
        bubble.baseX = 20; // Slightly right of center
        bubble.baseY = -50; // Above head
    }

    floatingEmojis.push(bubble);
    return h;
}

function updateFloatingEmojis(dt) {
    for (let i = floatingEmojis.length - 1; i >= 0; i--) {
        const b = floatingEmojis[i];
        b.life -= dt;
        // Float Upward Animation (Faster = "Grow Upwards")
        b.offsetY += dt * 0.06; // Trigger faster rise
        
        if (b.life <= 0) {
            if (b.el.parentElement) b.el.remove();
            floatingEmojis.splice(i, 1);
            continue;
        }

        if (b.attachActor) {
            // Follow behavior with vertical growth
            b.el.style.left = (b.attachActor.x + b.baseX) + "px";
            // Combine strict tracking position with animating vertical offset
            b.el.style.top = (b.attachActor.y + b.baseY - b.offsetY) + "px";
        } else {
            // Static float
             let currentTop = parseFloat(b.el.style.top);
             b.el.style.top = (currentTop - 1.0) + "px"; // Faster static rise
        }
        
        // Fade out logic matching "faded right" (fading out at end)
        if(b.life < 1000) {
            b.el.style.opacity = b.life / 1000;
        }
    }
}

function spawnHeart() { spawnFloatingEmoji("💖", actors.cat.x, actors.cat.y); }

function updateBubblePosition() {
    const bubble = document.getElementById('speech-bubble');
    if (bubble && actors.human) {
        // Closer to human head (was -120)
        bubble.style.left = (actors.human.x - 70) + 'px';
        bubble.style.top = (actors.human.y - 85) + 'px';
    }
}

function showRandomCuteThought() {
    const thoughts = ["🐟", "🧶", "🥛", "🐭", "❤️", "🐾", "✨", "🦋"];
    spawnFloatingEmoji(thoughts[Math.floor(Math.random() * thoughts.length)], actors.cat.x, actors.cat.y, "24px", "#FFF", actors.cat);
}

// --- Audio Logic ---
let currentAudio = null;
function playRealMeow() {
    if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0; }
    const file = MEOW_SOUNDS[Math.floor(Math.random() * MEOW_SOUNDS.length)];
    const audio = new Audio(`assets/${file}`);
    audio.playbackRate = 0.9 + Math.random() * 0.3; audio.volume = 0.5;
    audio.play().catch(e => { console.warn("Audio failed", e); playSynthMeow(0.1); });
    currentAudio = audio;
}

function playDragSound() {
    if (currentAudio) currentAudio.pause();
    const audio = new Audio(`assets/meow1.mp3`);
    audio.playbackRate = 1.3 + Math.random() * 0.2; audio.volume = 0.4;
    audio.play().catch(e => playSynthMeow(0.15));
    currentAudio = audio;
}

function playSynthMeow(duration = 0.3) {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const os = audioCtx.createOscillator(); const g = audioCtx.createGain();
    os.connect(g); g.connect(audioCtx.destination);
    os.type = 'triangle'; os.frequency.setValueAtTime(900, audioCtx.currentTime);
    os.frequency.exponentialRampToValueAtTime(500, audioCtx.currentTime + duration);
    g.gain.setValueAtTime(0.1, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    os.start(); os.stop(audioCtx.currentTime + duration);
}

async function setupAudioRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunks.push(event.data); };
        mediaRecorder.onstop = async () => {
            logToScreen("🎤 Sending...");
            document.getElementById('btn-mic').classList.remove('listening');
            showBubble("Thinking... 🧠");
            setIgnoreMouseEvents(true);
            const audioBlob = new Blob(audioChunks, { type: 'audio/mp3' });
            audioChunks = [];
            const base64Audio = await blobToBase64(audioBlob);
            processAudioMessage(base64Audio);
        };
        logToScreen("✅ Mic Ready");
    } catch (err) { logToScreen("❌ Mic Failure: " + err.message); }
}

function toggleListening() {
    if (!mediaRecorder) { logToScreen("⚠️ Mic not ready"); return; }
    if (mediaRecorder.state === "inactive") {
        stopSpeaking(); audioChunks = []; mediaRecorder.start();
        document.getElementById('btn-mic').classList.add('listening');
        showBubble("Listening... 👂"); logToScreen("🔴 Recording...");
    } else { mediaRecorder.stop(); logToScreen("🛑 Processing..."); }
}

function blobToBase64(blob) {
    return new Promise((resolve, _) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
    });
}

function stopSpeaking() {
    const audio = document.getElementById('audio-player');
    if (audio) { audio.pause(); audio.currentTime = 0; }
}

async function processAudioMessage(base64Audio) {
    try {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const systemPrompt = `You are "Glitch", an AI desktop assistant.
        capabilities: [Voice Interaction, Browser Automation, Screen Vision]
        INSTRUCTIONS:
        1. "Open YouTube" -> {"type": "open", "url": "https://youtube.com"}
        2. "Search cats" -> {"type": "search", "query": "cats"}
        3. "Look at screen" -> {"type": "vision"}
        4. "Open Notepad" -> {"type": "app", "app": "notepad"}
        5. "Write Hello" -> {"type": "type", "text": "Hello"}
        6. Else: Short text response.`;

        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL, systemInstruction: systemPrompt });

        if (!window.chatSession) {
            window.chatSession = model.startChat({
                history: [
                    { role: "user", parts: [{ text: "Hello, I am ready to work." }] },
                    { role: "model", parts: [{ text: "Ready for orders! 🫡" }] },
                ],
            });
        }

        const audioPart = { inlineData: { data: base64Audio, mimeType: "audio/mp3" } };
        const result = await window.chatSession.sendMessage([audioPart]);
        const responseText = result.response.text();
        logToScreen("🤖 " + responseText);

        if (responseText.trim().startsWith('{')) {
            const action = JSON.parse(responseText.match(/\{.*\}/s)[0]);
            if (action.type === 'screenshot' || action.type === 'vision') {
                logToScreen("👁️ Capturing Screen...");
                const base64Image = await ipcRenderer.invoke('take-screenshot');
                const imagePart = { inlineData: { data: base64Image, mimeType: "image/png" } };
                const visionModel = genAI.getGenerativeModel({ model: GEMINI_MODEL });
                const visionResult = await visionModel.generateContent(["User asked to look at screen. Describe this:", imagePart]);
                const visionText = visionResult.response.text();
                showBubble("I see: " + visionText); speak(visionText);
                return;
            }
            if (action.type === 'open' || action.type === 'search' || action.type === 'app' || action.type === 'type') {
                logToScreen(`⚡ Action: ${action.type}`);
                showBubble("On it! ⚡"); speak("Right away!");
                await ipcRenderer.invoke('perform-action', action);
                return;
            }
        } else {
            showBubble(responseText);
            speak(responseText);
        }
    } catch (e) {
        logToScreen("❌ Error: " + e.message);
        showBubble("Error 😵");
    }
}

async function speak(text) {
    try {
        logToScreen("🗣️ " + text);
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'xi-api-key': elevenKey },
            body: JSON.stringify({ text: text, model_id: ELEVEN_MODEL, voice_settings: { stability: 0.5, similarity_boost: 0.8 } })
        });
        const blob = await response.blob();
        const audio = document.getElementById('audio-player');
        audio.src = URL.createObjectURL(blob);

        if (actors.human) {
            actors.human.isTalking = true;
            actors.human.state = 'TALK';
            audio.onended = () => { actors.human.isTalking = false; actors.human.state = 'IDLE'; };
        }
        logToScreen("🔊 Playing audio...");
        audio.play();
    } catch (e) { logToScreen("❌ TTS Error: " + e.message); }
}

function showBubble(text) {
    const bubble = document.getElementById('speech-bubble');
    if (bubble) {
        bubble.textContent = text;
        bubble.style.display = 'block';
        setTimeout(() => {
            const audio = document.getElementById('audio-player');
            if (audio.paused) bubble.style.display = 'none';
        }, 5000);
    }
}