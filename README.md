# Gemini Auto-Listen

A Chrome extension that automatically reads Gemini responses aloud. No more clicking the "Listen" button every time.

## Demo

https://github.com/fred1433/gemini-auto-listen/raw/master/demo.mp4

> Send a message, and the response is read aloud automatically — no clicks needed.

## Why?

Gemini has a "Listen" button on every response, but you have to click it manually each time. If you use Gemini as a voice assistant with its smartest model (not the real-time voice mode which uses a less capable model), this gets tedious fast.

**The problem with Gemini's built-in voice input:**
- The speech-to-text quality isn't great
- It auto-sends your message the moment you pause to think (~1.5s)
- No "hold" button to take your time

**With Auto-Listen**, you can use your OS's built-in dictation (which is better), press Enter, and the response is read aloud automatically. It turns Gemini's text chat into a hands-free voice conversation with the smartest model.

## Install

1. Download or clone this repo
2. Open `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked" and select this folder
5. Pin the extension to your toolbar for easy access to the on/off toggle

## How it works

- Monitors the number of "Listen" buttons on the page
- When a new one appears (= new response), clicks it automatically
- Tracks both Listen and Pause buttons together to avoid infinite loops
- Handles Gemini's SPA navigation between conversations
- Toggle on/off anytime via the popup

## Supported languages

Works with Gemini in English, French, Spanish, Portuguese, German, Italian, and Japanese.

## Limitations

- Relies on Gemini's UI structure (aria-labels). May break if Google changes their interface.
- Only works on `gemini.google.com`.
- After toggling off/on, you may need to refresh the Gemini tab.

## License

MIT
