# Privacy Policy — Gemini Auto-Listen

**Last updated:** February 8, 2026

## Overview

Gemini Auto-Listen is a Chrome extension that automatically clicks the "Listen" button on Google Gemini responses. It operates entirely within your browser and does not collect, transmit, or store any personal data.

## Data Collection

**This extension does not collect any data.** Specifically:

- No personal information is collected
- No browsing history is tracked
- No website content is read or stored
- No data is sent to any external server
- No analytics or tracking tools are used
- No cookies are set

## Local Storage

The extension uses Chrome's `chrome.storage.sync` API solely to save your on/off toggle preference. This data:

- Stays on your device (synced via your Chrome profile if sync is enabled)
- Contains only a single boolean value (enabled: true/false)
- Is never transmitted to any third party

## Permissions

- **`storage`**: Used to remember your on/off toggle state between sessions.
- **Host access to `gemini.google.com`**: Required to inject the content script that detects and clicks the Listen button. The extension only runs on Gemini pages.

## Third-Party Services

This extension does not communicate with any third-party services, APIs, or servers. It has zero network activity.

## Open Source

The full source code is publicly available at [https://github.com/fred1433/gemini-auto-listen](https://github.com/fred1433/gemini-auto-listen). You can audit it yourself.

## Changes

If this privacy policy changes, the update will be reflected in this file on GitHub with an updated date.

## Contact

For questions about this privacy policy, open an issue at [https://github.com/fred1433/gemini-auto-listen/issues](https://github.com/fred1433/gemini-auto-listen/issues).
