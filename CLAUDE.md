# Gemini Auto-Listen - Chrome Extension

## Extension Info
- Chrome extension ID: `hjeclfohlocjoboebdjmabnippilaolg`
- Duplicate OFF extension (eofpb...) exists, should be manually removed by user

## Extension Paths
- Chrome loads from: `/Users/frederic/Documents/gemini-auto-listen/`
- Dev copy: `/Users/frederic/Documents/Projetsdev/gemini-auto-listen/`
- Always edit the Chrome-loaded path, then sync to Projetsdev

## Reloading Extensions via MCP
1. Navigate to `chrome://extensions/?id=hjeclfohlocjoboebdjmabnippilaolg`
2. Click the "Reload" button
3. Navigate back to the target page
- Chrome doesn't support symlinked extension directories (reload gets stuck)

## Content Script Debugging
- `window.__variable` set in content scripts is NOT visible from page context (isolated worlds)
- Use `document.documentElement.dataset.xxx` to expose data from content script to page context
- This allows reading diagnostics via `evaluate_script` in MCP

## Common Pitfalls
- **Wildcard aria-label selectors are dangerous**: `button[aria-label*="Cancel"]` can match sidebar conversation titles containing "Cancel" (e.g., "Tinder Date Cancellation Strategy"). Use exact match selectors instead.
- **Button count detection loop**: Clicking "Écouter" changes button to "Pause" (count -1), when audio ends it reverts (count +1), triggering re-detection. Fix: add cooldown after successful click + baseline recalibration.
- **Moving extension directory breaks Chrome**: Chrome references the original load path. Don't move extension folders after loading.
