// Gemini Auto-Listen v4.0 - Détection par comptage de boutons + diagnostics DOM
// Approche : compter les boutons "Écouter". Quand un nouveau apparaît = nouvelle réponse = auto-play
// Expose window.__autoListenStatus via data-attribute pour diagnostic externe (Chrome DevTools MCP)
(function() {
    'use strict';

    const VERSION = '4.1';

    // === DIAGNOSTICS ===
    // État exposé via le DOM pour être lu depuis la console / MCP DevTools
    const diag = {
        version: VERSION,
        initialized: false,
        enabled: true,
        listenButtonCount: 0,
        isGenerating: false,
        isProcessing: false,
        clickAttempts: 0,
        clickSuccesses: 0,
        clickFailures: 0,
        lastEvent: null,
        lastEventTime: null,
        logs: []
    };

    function updateDiag() {
        try {
            document.documentElement.dataset.autoListenStatus = JSON.stringify(diag);
        } catch (e) { /* ignore */ }
    }

    function log(...args) {
        const msg = args.join(' ');
        const time = new Date().toISOString();
        diag.logs.push({ time, msg });
        if (diag.logs.length > 100) diag.logs.shift();
        diag.lastEvent = msg;
        diag.lastEventTime = time;
        updateDiag();
        console.log('[Auto-Listen]', ...args);
    }

    // === CONFIG ===
    let isEnabled = true;

    const SELECTORS = {
        listen: [
            'button[aria-label="Écouter"]',
            'button[aria-label="Listen"]',
            'button[aria-label="Read aloud"]',
            'button[aria-label="Escuchar"]',         // Espagnol
            'button[aria-label="Ouvir"]',             // Portugais
        ].join(', '),
        stop: [
            'button[aria-label="Interrompre la réponse"]',
            'button[aria-label="Interrompre"]',
            'button[aria-label="Stop responding"]',
            'button[aria-label="Stop"]',
            'button[aria-label="Arrêter la réponse"]',
            'button[aria-label="Arrêter"]',
            '[data-testid="stop-button"]',
        ].join(', '),
        pause: [
            'button[aria-label*="pause"]',
            'button[aria-label*="Pause"]',
            'button[aria-label*="Mettre en pause"]',
        ].join(', ')
    };

    const TIMING = {
        POLL_INTERVAL: 300,         // Vérifier toutes les 300ms
        STABLE_DURATION: 1200,      // Bouton stable pendant 1.2s avant de cliquer
        POST_CLICK_WAIT: 600,       // Attendre après un clic pour vérifier
        RETRY_DELAY: 400,           // Délai avant retry
        MAX_RETRIES: 2,             // Max 2 tentatives de clic
        URL_CHECK_INTERVAL: 1000,   // Vérifier changement d'URL toutes les 1s
    };

    // === STATE ===
    let lastStableCount = 0;
    let currentCount = 0;
    let countChangedAt = Date.now();
    let isGenerating = false;
    let isProcessing = false;
    let currentUrl = location.href;
    let lastClickSuccessAt = 0;          // Timestamp du dernier clic réussi
    const COOLDOWN_MS = 30000;           // 30s de cooldown après un clic réussi

    // === CHROME STORAGE ===
    function loadState() {
        try {
            chrome.storage.local.get(['autoListenEnabled'], (result) => {
                isEnabled = result.autoListenEnabled !== false;
                diag.enabled = isEnabled;
                log(isEnabled ? '✅ Auto-lecture ACTIVÉE' : '❌ Auto-lecture DÉSACTIVÉE');
            });
        } catch (e) {
            log('⚠️ chrome.storage indisponible:', e.message);
        }
    }

    try {
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local' && changes.autoListenEnabled) {
                isEnabled = changes.autoListenEnabled.newValue !== false;
                diag.enabled = isEnabled;
                log(isEnabled ? '✅ Auto-lecture ACTIVÉE' : '❌ Auto-lecture DÉSACTIVÉE');
            }
        });
    } catch (e) { /* ignore */ }

    // === BUTTON HELPERS ===
    function getVisibleListenButtons() {
        const buttons = document.querySelectorAll(SELECTORS.listen);
        return Array.from(buttons).filter(btn => btn.offsetParent !== null);
    }

    function getLastVisibleListenButton() {
        const buttons = getVisibleListenButtons();
        return buttons.length > 0 ? buttons[buttons.length - 1] : null;
    }

    function isStopButtonVisible() {
        return !!document.querySelector(SELECTORS.stop);
    }

    function isAudioPlaying() {
        // Vérifier si un bouton pause est visible (= audio en cours)
        const pauseBtn = document.querySelector(SELECTORS.pause);
        if (pauseBtn && pauseBtn.offsetParent !== null) return true;

        // Vérifier les éléments <audio> HTML5
        const audios = document.querySelectorAll('audio');
        for (const audio of audios) {
            if (!audio.paused) return true;
        }
        return false;
    }

    // === CLICK LOGIC ===
    function simulateClick(btn) {
        btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
        btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    }

    function sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    async function smartClick(btn, attempt = 1) {
        const label = btn.getAttribute('aria-label');
        log(`🎯 Tentative ${attempt}/${TIMING.MAX_RETRIES} - clic sur "${label}"`);
        diag.clickAttempts++;
        updateDiag();

        btn.scrollIntoView({ block: 'center', behavior: 'instant' });
        simulateClick(btn);

        // Attendre et vérifier si ça a marché
        await sleep(TIMING.POST_CLICK_WAIT);

        // Cas 1: Audio joue (bouton pause visible)
        if (isAudioPlaying()) {
            log('✅ SUCCÈS: Audio en lecture (pause détecté)');
            diag.clickSuccesses++;
            updateDiag();
            return true;
        }

        // Cas 2: Le bouton "Écouter" a disparu ou changé
        const freshBtn = getLastVisibleListenButton();
        if (!freshBtn) {
            log('✅ SUCCÈS: Bouton Écouter disparu (probablement en lecture)');
            diag.clickSuccesses++;
            updateDiag();
            return true;
        }

        const freshLabel = freshBtn.getAttribute('aria-label');
        if (freshLabel !== label) {
            log(`✅ SUCCÈS: Label changé "${label}" → "${freshLabel}"`);
            diag.clickSuccesses++;
            updateDiag();
            return true;
        }

        // Le clic n'a pas eu d'effet visible
        if (attempt < TIMING.MAX_RETRIES) {
            log(`⚠️ Clic ${attempt} sans effet visible, retry...`);
            await sleep(TIMING.RETRY_DELAY);
            // Re-chercher le bouton frais (le DOM peut avoir changé)
            const retryBtn = getLastVisibleListenButton();
            if (retryBtn) {
                return smartClick(retryBtn, attempt + 1);
            }
            log('⚠️ Plus de bouton trouvé pour retry');
        }

        log(`❌ ÉCHEC après ${attempt} tentative(s)`);
        diag.clickFailures++;
        updateDiag();
        return false;
    }

    // === TRIGGER: Nouveau bouton détecté ===
    async function onNewResponse() {
        if (isProcessing) {
            log('⏳ Déjà en traitement, ignoré');
            return;
        }
        if (!isEnabled) {
            log('⏸️ Auto-lecture désactivée, ignoré');
            return;
        }
        if (document.visibilityState !== 'visible') {
            log('🙈 Onglet caché, ignoré');
            return;
        }

        // Cooldown : ignorer les fluctuations de boutons après un clic réussi
        const sinceLastClick = Date.now() - lastClickSuccessAt;
        if (sinceLastClick < COOLDOWN_MS) {
            log(`🧊 Cooldown actif (${Math.round(sinceLastClick/1000)}s/${COOLDOWN_MS/1000}s), ignoré`);
            // Recaler la baseline pour ne pas re-trigger après le cooldown
            const buttons = getVisibleListenButtons();
            lastStableCount = buttons.length;
            currentCount = lastStableCount;
            countChangedAt = Date.now();
            diag.listenButtonCount = lastStableCount;
            return;
        }

        isProcessing = true;
        diag.isProcessing = true;
        log('🆕 Nouvelle réponse détectée ! Recherche du bouton Écouter...');

        // Petit délai pour laisser le DOM se stabiliser
        await sleep(300);

        const btn = getLastVisibleListenButton();
        if (!btn) {
            log('❌ Pas de bouton Écouter trouvé');
            isProcessing = false;
            diag.isProcessing = false;
            updateDiag();
            return;
        }

        const success = await smartClick(btn);

        if (success) {
            lastClickSuccessAt = Date.now();
            // Recaler la baseline après un clic réussi pour éviter les rebonds
            await sleep(2000);
            const freshButtons = getVisibleListenButtons();
            lastStableCount = freshButtons.length;
            currentCount = lastStableCount;
            countChangedAt = Date.now();
            diag.listenButtonCount = lastStableCount;
            log(`🔄 Baseline recalée à ${lastStableCount} après clic réussi`);
        }

        isProcessing = false;
        diag.isProcessing = false;
        updateDiag();
    }

    // === DETECTION PRINCIPALE: Comptage de boutons ===
    function pollState() {
        const buttons = getVisibleListenButtons();
        const count = buttons.length;
        const generating = isStopButtonVisible();

        // Log changement d'état de génération
        if (generating && !isGenerating) {
            isGenerating = true;
            diag.isGenerating = true;
            log('🚀 Génération en cours (bouton Stop/Interrompre détecté)');
        }
        if (!generating && isGenerating) {
            isGenerating = false;
            diag.isGenerating = false;
            log('⏹️ Génération terminée (bouton Stop disparu)');
        }

        // Suivre le changement de nombre de boutons
        if (count !== currentCount) {
            log(`📊 Changement boutons: ${currentCount} → ${count}`);
            currentCount = count;
            countChangedAt = Date.now();
        }

        // TRIGGER: le compte a augmenté, est stable, et pas en train de générer
        const stableFor = Date.now() - countChangedAt;
        if (count > lastStableCount && stableFor >= TIMING.STABLE_DURATION && !generating && !isProcessing) {
            const increase = count - lastStableCount;
            log(`✨ +${increase} nouveau(x) bouton(s), stable depuis ${stableFor}ms, pas de génération`);

            // Seulement trigger si augmentation de 1 (nouvelle réponse unique)
            // Si augmentation > 3, c'est probablement un changement de page
            if (increase <= 3) {
                lastStableCount = count;
                diag.listenButtonCount = count;
                onNewResponse();
            } else {
                log(`📋 Grande augmentation (${increase}), probablement changement de conversation - reset`);
                lastStableCount = count;
                diag.listenButtonCount = count;
            }
        }

        // Mettre à jour si le compte a diminué (navigation, suppression)
        if (count < lastStableCount && stableFor >= TIMING.STABLE_DURATION) {
            log(`📉 Boutons diminués: ${lastStableCount} → ${count} (reset baseline)`);
            lastStableCount = count;
            diag.listenButtonCount = count;
        }

        updateDiag();
    }

    // === DÉTECTION CHANGEMENT D'URL (SPA) ===
    function checkUrlChange() {
        if (location.href !== currentUrl) {
            log(`🔗 URL changée: ${currentUrl} → ${location.href}`);
            currentUrl = location.href;
            // Reset: on ne connaît pas encore le nombre de boutons de cette page
            lastStableCount = 0;
            currentCount = 0;
            countChangedAt = Date.now();
            isGenerating = false;
            isProcessing = false;
        }
    }

    // === INIT ===
    function init() {
        log(`🎬 Auto-Listen v${VERSION} démarré`);
        log(`📍 URL: ${location.href}`);
        log(`👁️ Onglet visible: ${document.visibilityState === 'visible'}`);

        diag.initialized = true;
        loadState();

        // Compter les boutons initiaux
        const initialButtons = getVisibleListenButtons();
        lastStableCount = initialButtons.length;
        currentCount = lastStableCount;
        countChangedAt = Date.now();
        diag.listenButtonCount = lastStableCount;

        log(`📊 Boutons initiaux: ${lastStableCount}`);
        updateDiag();

        // Polling régulier
        setInterval(pollState, TIMING.POLL_INTERVAL);

        // Vérification URL (SPA navigation)
        setInterval(checkUrlChange, TIMING.URL_CHECK_INTERVAL);

        // MutationObserver pour détection plus rapide
        const observer = new MutationObserver(() => {
            pollState();
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });

        log('✅ Observateurs installés, en attente de nouvelles réponses...');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
