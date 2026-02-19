// Gemini Auto-Listen — Background Service Worker
// Sends error reports to Sentry via HTTP envelope API.
// Service workers bypass page CSP; host_permissions grants access to sentry.io.

const SENTRY_DSN = 'https://aa8cb8aa38bb40f2f5f64dccd2e9a350@o4508253840146432.ingest.us.sentry.io/4510914065661952';
const VERSION = '4.6';

// Parse DSN
const dsnUrl = new URL(SENTRY_DSN);
const PROJECT_ID = dsnUrl.pathname.replace('/', '');
const PUBLIC_KEY = dsnUrl.username;
const ENVELOPE_URL = `${dsnUrl.protocol}//${dsnUrl.host}/api/${PROJECT_ID}/envelope/?sentry_key=${PUBLIC_KEY}&sentry_version=7`;

function generateEventId() {
    // 32 hex chars
    return Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
}

function buildEnvelope(report) {
    const eventId = generateEventId();
    const now = new Date().toISOString();

    const header = JSON.stringify({
        event_id: eventId,
        sent_at: now,
        dsn: SENTRY_DSN
    });

    const itemHeader = JSON.stringify({
        type: 'event',
        content_type: 'application/json'
    });

    const payload = {
        event_id: eventId,
        timestamp: now,
        platform: 'javascript',
        level: 'error',
        release: `gemini-auto-listen@${VERSION}`,
        environment: 'production',
        tags: { extension_version: VERSION },
        exception: {
            values: [{
                type: report.name || 'Error',
                value: report.message || 'Unknown error',
                stacktrace: report.stack ? { frames: parseStack(report.stack) } : undefined
            }]
        },
        breadcrumbs: { values: (report.breadcrumbs || []).map(bc => ({
            timestamp: bc.timestamp,
            message: bc.message,
            category: bc.category || 'auto-listen',
            level: 'info'
        })) },
        contexts: {
            browser: { name: 'Chrome' },
            runtime: { name: 'Gemini Auto-Listen' }
        },
        extra: report.extra || {}
    };

    return `${header}\n${itemHeader}\n${JSON.stringify(payload)}`;
}

function cleanFilename(filename) {
    // Strip chrome-extension://[id]/ prefix to avoid Sentry's browser extension filter
    return filename.replace(/^chrome-extension:\/\/[^/]+\//, '');
}

function parseStack(stack) {
    if (!stack) return [];
    const lines = stack.split('\n').slice(1);
    const frames = [];
    for (const line of lines) {
        const m = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/) ||
                  line.match(/at\s+(.+?):(\d+):(\d+)/);
        if (m && m.length === 5) {
            frames.push({ function: m[1], filename: cleanFilename(m[2]), lineno: +m[3], colno: +m[4] });
        } else if (m && m.length === 4) {
            frames.push({ filename: cleanFilename(m[1]), lineno: +m[2], colno: +m[3] });
        }
    }
    return frames.reverse(); // Sentry: caller-first
}

async function sendToSentry(report) {
    try {
        const body = buildEnvelope(report);
        const resp = await fetch(ENVELOPE_URL, { method: 'POST', body });
        const text = await resp.text();
        console.log(`[Auto-Listen BG] Sentry ${resp.status}: ${text}`);
        return { ok: resp.ok, status: resp.status, body: text.substring(0, 200) };
    } catch (e) {
        console.error('[Auto-Listen BG] Sentry fetch failed:', e.message);
        return { ok: false, error: e.message };
    }
}

// Listen for error reports from content script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'sentry-error') {
        sendToSentry(msg.payload).then((result) => sendResponse(result));
        return true; // Keep channel open for async sendResponse
    }
});

console.log('[Auto-Listen BG] Service worker ready, Sentry endpoint:', ENVELOPE_URL);
