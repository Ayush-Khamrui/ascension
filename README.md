# Project Ascension

A gamified discipline system as an installable PWA, with a live 3D "Ascension Core"
that evolves as you level up. No build step, no backend — your progress lives on
your device.

## What's inside

- **Daily Main Quests** (5) and **Bonus Quests** (8) with a 100 XP/day cap.
- **Levels 1–10** (Initiate → Ascendant), 500 XP each. XP and levels are never lost.
- **Minimum Viable Victory**: three of five main quests still claims the day.
- **Streak bonuses** at 3 / 7 / 14 / 30 successful days.
- **Boss Battles** — Delivery Demon, Midnight Trigger, Procrastination Hydra,
  Comparison Phantom — with a **Freedom Fund** tracker for money saved.
- **Attribute radar** across the six character attributes.
- **Trigger log** and an auto-generated **Weekly Scorecard** (one-tap copy).
- Export / import your save as JSON.

## Run it

A service worker requires an `http://` origin (not `file://`), so serve the folder:

```bash
# Python (already installed)
cd /Users/ayushkhamrui/Personal/Project/lifeGame
python3 -m http.server 8080
```

Then open http://localhost:8080 and, in the browser menu, choose
**Install app / Add to Home Screen** to use it like a native app.

The 3D core loads Three.js from a CDN on first run; after that the service
worker keeps it cached for offline use.

## Files

- `index.html` — app shell
- `js/game.js` — game engine (XP, levels, streaks, bosses, persistence)
- `js/scene.js` — Three.js Ascension Core
- `js/ui.js` — UI controller
- `css/styles.css` — styling
- `sw.js` / `manifest.webmanifest` — PWA plumbing
- `assets/` — logo and app icon
