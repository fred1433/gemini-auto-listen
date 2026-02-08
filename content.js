// Gemini Auto-Listen v4.4
// Auto-plays Gemini responses using the built-in "Listen" button.
// Tracks Listen+Pause button count to detect new responses without loops.
// Verifies the clicked button itself (not the last in the list) to prevent misfires.
// Freezes baseline during click processing to avoid re-triggers.
// Marks clicked buttons to prevent re-clicking paused responses.
(function() {
    'use strict';

    const VERSION = '4.4';

    // === DIAGNOSTICS ===
    // Exposed via DOM data-attribute for debugging
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
            'button[aria-label="Listen"]',
            'button[aria-label="Read aloud"]',
            'button[aria-label="\u00C9couter"]',        // French
            'button[aria-label="Escuchar"]',             // Spanish
            'button[aria-label="Ouvir"]',                // Portuguese
            'button[aria-label="Anh\u00F6ren"]',        // German
            'button[aria-label="Ascolta"]',              // Italian
            'button[aria-label="\u8074\u304F"]',         // Japanese
        ].join(', '),
        stop: [
            'button[aria-label="Stop responding"]',
            'button[aria-label="Stop"]',
            'button[aria-label="Interrompre la r\u00E9ponse"]',
            'button[aria-label="Interrompre"]',
            'button[aria-label="Arr\u00EAter la r\u00E9ponse"]',
            'button[aria-label="Arr\u00EAter"]',
            '[data-testid="stop-button"]',
        ].join(', '),
        pause: [
            'button[aria-label*="pause"]',
            'button[aria-label*="Pause"]',
            'button[aria-label*="Mettre en pause"]',
        ].join(', ')
    };

    const TIMING = {
        POLL_INTERVAL: 300,
        STABLE_DURATION: 800,
        POST_CLICK_WAIT: 1000,
        RETRY_DELAY: 800,
        MAX_RETRIES: 2,
        URL_CHECK_INTERVAL: 1000,
    };

    // === STATE ===
    let lastStableCount = 0;
    let currentCount = 0;
    let countChangedAt = Date.now();
    let isGenerating = false;
    let isProcessing = false;
    let processingEndedAt = 0;
    const GRACE_PERIOD_MS = 5000;
    let currentUrl = location.href;

    // === CHROME STORAGE ===
    function loadState() {
        try {
            chrome.storage.local.get(['autoListenEnabled'], (result) => {
                isEnabled = result.autoListenEnabled !== false;
                diag.enabled = isEnabled;
                log(isEnabled ? 'Auto-listen ENABLED' : 'Auto-listen DISABLED');
            });
        } catch (e) {
            log('chrome.storage unavailable:', e.message);
        }
    }

    try {
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local' && changes.autoListenEnabled) {
                isEnabled = changes.autoListenEnabled.newValue !== false;
                diag.enabled = isEnabled;
                log(isEnabled ? 'Auto-listen ENABLED' : 'Auto-listen DISABLED');
            }
        });
    } catch (e) { /* ignore */ }

    // === BUTTON HELPERS ===
    // Count Listen + Pause together — total stays stable during audio playback
    function getVisibleResponseButtons() {
        const listenBtns = document.querySelectorAll(SELECTORS.listen);
        const pauseBtns = document.querySelectorAll(SELECTORS.pause);
        const all = [...listenBtns, ...pauseBtns];
        return all.filter(btn => btn.offsetParent !== null);
    }

    function getVisibleListenButtons() {
        const buttons = document.querySelectorAll(SELECTORS.listen);
        return Array.from(buttons).filter(btn => btn.offsetParent !== null);
    }

    function getLastVisibleListenButton() {
        const buttons = getVisibleListenButtons();
        // Filter out buttons that were already auto-clicked to avoid re-clicking old paused responses
        const unprocessed = buttons.filter(btn => !btn.dataset.autoListenProcessed);
        return unprocessed.length > 0 ? unprocessed[unprocessed.length - 1] : null;
    }

    function isStopButtonVisible() {
        return !!document.querySelector(SELECTORS.stop);
    }

    function isAudioPlaying() {
        const pauseBtn = document.querySelector(SELECTORS.pause);
        if (pauseBtn && pauseBtn.offsetParent !== null) return true;

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

    async function smartClick(btn) {
        const label = btn.getAttribute('aria-label');
        log(`Clicking "${label}"`);
        diag.clickAttempts++;
        updateDiag();

        btn.scrollIntoView({ block: 'center', behavior: 'instant' });
        simulateClick(btn);

        await sleep(TIMING.POST_CLICK_WAIT);

        if (isAudioPlaying()) {
            log('SUCCESS: Audio playing (pause button detected)');
            btn.dataset.autoListenProcessed = 'true';
            diag.clickSuccesses++;
            updateDiag();
            return true;
        }

        const currentLabel = btn.getAttribute('aria-label');
        if (currentLabel !== label) {
            log(`SUCCESS: Clicked button label changed "${label}" -> "${currentLabel}"`);
            btn.dataset.autoListenProcessed = 'true';
            diag.clickSuccesses++;
            updateDiag();
            return true;
        }
        if (btn.offsetParent === null) {
            log('SUCCESS: Clicked button became invisible (likely playing)');
            btn.dataset.autoListenProcessed = 'true';
            diag.clickSuccesses++;
            updateDiag();
            return true;
        }

        log('No visible effect yet, waiting longer...');
        await sleep(TIMING.RETRY_DELAY);

        if (isAudioPlaying()) {
            log('SUCCESS: Audio detected after extra wait');
            btn.dataset.autoListenProcessed = 'true';
            diag.clickSuccesses++;
            updateDiag();
            return true;
        }

        if (btn.getAttribute('aria-label') !== label || btn.offsetParent === null) {
            log('SUCCESS: Button changed after extra wait');
            btn.dataset.autoListenProcessed = 'true';
            diag.clickSuccesses++;
            updateDiag();
            return true;
        }

        log('Re-clicking same button...');
        simulateClick(btn);
        await sleep(TIMING.POST_CLICK_WAIT);

        if (isAudioPlaying() || btn.getAttribute('aria-label') !== label || btn.offsetParent === null) {
            log('SUCCESS: Audio detected after re-click');
            btn.dataset.autoListenProcessed = 'true';
            diag.clickSuccesses++;
            updateDiag();
            return true;
        }

        log('FAILED: No audio after 2 attempts on same button');
        diag.clickFailures++;
        updateDiag();
        return false;
    }

    // === TRIGGER: New response detected ===
    async function onNewResponse() {
        if (isProcessing) {
            log('Already processing, skipped');
            return;
        }
        if (!isEnabled) {
            log('Auto-listen disabled, skipped');
            return;
        }
        if (document.visibilityState !== 'visible') {
            log('Tab hidden, skipped');
            return;
        }

        isProcessing = true;
        diag.isProcessing = true;
        log('New response detected! Looking for Listen button...');

        await sleep(300);

        const btn = getLastVisibleListenButton();
        if (!btn) {
            log('No Listen button found');
            isProcessing = false;
            diag.isProcessing = false;
            updateDiag();
            return;
        }

        await smartClick(btn);

        isProcessing = false;
        processingEndedAt = Date.now();
        diag.isProcessing = false;

        // Recalibrate baseline after processing to absorb fluctuations
        await sleep(2000);
        const freshButtons = getVisibleResponseButtons();
        lastStableCount = freshButtons.length;
        currentCount = lastStableCount;
        countChangedAt = Date.now();
        diag.listenButtonCount = lastStableCount;
        log(`Baseline recalibrated to ${lastStableCount} after processing`);
        updateDiag();
    }

    // === MAIN DETECTION: Button count tracking (Listen + Pause) ===
    function pollState() {
        const buttons = getVisibleResponseButtons();
        const count = buttons.length;
        const generating = isStopButtonVisible();

        if (generating && !isGenerating) {
            isGenerating = true;
            diag.isGenerating = true;
            log('Generation in progress (Stop button detected)');
        }
        if (!generating && isGenerating) {
            isGenerating = false;
            diag.isGenerating = false;
            log('Generation finished (Stop button gone)');
        }

        if (count !== currentCount) {
            log(`Button count: ${currentCount} -> ${count}`);
            currentCount = count;
            countChangedAt = Date.now();
        }

        const stableFor = Date.now() - countChangedAt;
        const inGracePeriod = (Date.now() - processingEndedAt) < GRACE_PERIOD_MS;
        if (count > lastStableCount && stableFor >= TIMING.STABLE_DURATION && !generating && !isProcessing && !inGracePeriod) {
            const increase = count - lastStableCount;
            log(`+${increase} new button(s), stable for ${stableFor}ms, not generating`);

            if (increase <= 3) {
                lastStableCount = count;
                diag.listenButtonCount = count;
                onNewResponse();
            } else {
                log(`Large increase (${increase}), likely conversation switch - reset`);
                lastStableCount = count;
                diag.listenButtonCount = count;
            }
        }

        // Update baseline if count decreased (navigation, deletion)
        // But NOT during click processing (baseline freeze)
        if (count < lastStableCount && stableFor >= TIMING.STABLE_DURATION && !isProcessing && !inGracePeriod) {
            log(`Buttons decreased: ${lastStableCount} -> ${count} (baseline reset)`);
            lastStableCount = count;
            diag.listenButtonCount = count;
        }

        updateDiag();
    }

    // === SPA URL CHANGE DETECTION ===
    function checkUrlChange() {
        if (location.href !== currentUrl) {
            log(`URL changed: ${currentUrl} -> ${location.href}`);
            currentUrl = location.href;
            lastStableCount = 0;
            currentCount = 0;
            countChangedAt = Date.now();
            isGenerating = false;
            isProcessing = false;
        }
    }

    // === INIT ===
    function init() {
        log(`Auto-Listen v${VERSION} started`);
        log(`URL: ${location.href}`);
        log(`Tab visible: ${document.visibilityState === 'visible'}`);

        diag.initialized = true;
        loadState();

        const initialButtons = getVisibleResponseButtons();
        lastStableCount = initialButtons.length;
        currentCount = lastStableCount;
        countChangedAt = Date.now();
        diag.listenButtonCount = lastStableCount;

        log(`Initial buttons: ${lastStableCount}`);
        updateDiag();

        setInterval(pollState, TIMING.POLL_INTERVAL);
        setInterval(checkUrlChange, TIMING.URL_CHECK_INTERVAL);

        const observer = new MutationObserver(() => {
            pollState();
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });

        log('Observers installed, waiting for new responses...');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
