# Privacy Policy — Gemini Auto-Listen

**Last updated:** February 19, 2026

## Overview

Gemini Auto-Listen is a Chrome extension that automatically clicks the "Listen" button on Google Gemini responses. It operates entirely within your browser and does not collect personal data.

## Data Collection

This extension does not collect personal information, browsing history, website content, or set cookies.

## Error Tracking

To improve reliability, the extension uses [Sentry](https://sentry.io) for anonymous crash reporting. When a JavaScript error occurs within the extension, the following data is sent:

- **Error type and message** (e.g., "TypeError: Cannot read property...")
- **Stack trace** (file names and line numbers within the extension code only)
- **Browser name** (e.g., "Chrome")
- **Extension version** (e.g., "4.6")
- **Page URL** (anonymized — conversation IDs are stripped)

**What is NOT collected:**
- No conversation content or Gemini responses
- No personal information or account data
- No browsing history outside of error context
- No IP addresses are stored by Sentry (configured to discard)

Error reports are sent to Sentry's servers and are used solely for diagnosing and fixing bugs.

## Local Storage

The extension uses Chrome's `chrome.storage.sync` API solely to save your on/off toggle preference. This data:

- Stays on your device (synced via your Chrome profile if sync is enabled)
- Contains only a single boolean value (enabled: true/false)
- Is never transmitted to any third party

## Permissions

- **`storage`**: Used to remember your on/off toggle state between sessions.
- **Host access to `gemini.google.com`**: Required to inject the content script that detects and clicks the Listen button. The extension only runs on Gemini pages.
- **Host access to `*.sentry.io`**: Required for sending anonymous crash reports to the Sentry error tracking service.

## Open Source

The full source code is publicly available at [https://github.com/fred1433/gemini-auto-listen](https://github.com/fred1433/gemini-auto-listen). You can audit it yourself.

## Changes

If this privacy policy changes, the update will be reflected in this file on GitHub with an updated date.

## Contact

For questions about this privacy policy, open an issue at [https://github.com/fred1433/gemini-auto-listen/issues](https://github.com/fred1433/gemini-auto-listen/issues).
