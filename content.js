// Gemini Auto-Listen v3.0 - Double-clic sans debugger
// Bug Gemini : le premier clic initialise, le second joue
(function() {
    'use strict';

    const DEBUG = true;
    const log = (...args) => DEBUG && console.log('[Auto-Listen]', ...args);

    let isGenerating = false;

    const SELECTORS = {
        listen: 'button[aria-label="Écouter"], button[aria-label="Listen"], button[aria-label="Read aloud"]',
        stop: [
            'button[aria-label*="Interrompre"]',
            'button[aria-label*="Stop"]',
            'button[aria-label*="Arrêter"]',
            '[data-testid="stop-button"]'
        ]
    };

    function isStopButtonVisible() {
        return SELECTORS.stop.some(selector => document.querySelector(selector));
    }

    function simulateClick(btn) {
        btn.focus();
        btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
        btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    }

    function doubleClickLastListenButton() {
        const buttons = document.querySelectorAll(SELECTORS.listen);
        const visibleButtons = Array.from(buttons).filter(btn => btn.offsetParent !== null);

        if (visibleButtons.length === 0) {
            log('❌ Aucun bouton Écouter trouvé');
            return;
        }

        const btn = visibleButtons[visibleButtons.length - 1];
        const label = btn.getAttribute('aria-label');

        // Scroll pour s'assurer que le bouton est visible
        btn.scrollIntoView({ block: 'center', behavior: 'instant' });

        log(`🎯 PREMIER clic sur "${label}" (initialisation)...`);
        simulateClick(btn);

        // Attendre 400ms puis second clic (bug Gemini)
        setTimeout(() => {
            // Re-sélectionner le bouton au cas où le DOM a changé
            const freshButtons = document.querySelectorAll(SELECTORS.listen);
            const freshVisible = Array.from(freshButtons).filter(b => b.offsetParent !== null);

            if (freshVisible.length === 0) {
                log('✅ Bouton disparu = probablement en lecture');
                return;
            }

            const freshBtn = freshVisible[freshVisible.length - 1];
            const freshLabel = freshBtn.getAttribute('aria-label');

            // Si le bouton est devenu "Mettre en pause", c'est bon !
            if (freshLabel && (freshLabel.includes('pause') || freshLabel.includes('Pause'))) {
                log('✅ Audio déjà en lecture !');
                return;
            }

            log(`🎯 SECOND clic sur "${freshLabel}" (lecture)...`);
            simulateClick(freshBtn);
        }, 400);
    }

    function checkState() {
        const currentlyGenerating = isStopButtonVisible();

        if (currentlyGenerating && !isGenerating) {
            isGenerating = true;
            log('🚀 Génération en cours...');
        }
        else if (!currentlyGenerating && isGenerating) {
            isGenerating = false;

            if (document.visibilityState === 'visible') {
                log('⏳ Génération terminée ! Attente de 2.5 secondes...');
                setTimeout(() => {
                    doubleClickLastListenButton();
                }, 2500);
            } else {
                log('🙈 Onglet caché, pas de clic automatique.');
            }
        }
    }

    function init() {
        log('🎬 Extension Auto-Listen v3.0 (double-clic, sans debugger)');

        const observer = new MutationObserver(checkState);
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true
        });

        setInterval(checkState, 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
