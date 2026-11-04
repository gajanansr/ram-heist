# RAM Heist

A parody stealth game in three.js. Hide your RAM from Sam for five nights, build the People's Cluster, and fight back with traps and breakers. All dialogue is fictional; not affiliated with any real person or company.

## Run

```
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

Deploys as a static Vite site (see `vercel.json`).

## Controls

WASD / arrows move, mouse looks (click to capture, Esc to release), E hide a chip / hold at the terminal to upload, H hide yourself, G decoy, T coffee trap, F flashlight, Shift sprint, C crouch, Tab first-person.
`?debug` in the URL skips the menus (test mode).

## Project layout

- `src/` game code (`main.js` loop and game flow, `sam.js` AI, `player.js`, `world.js`, `audio.js`, `ui.js`)
- `public/models/` converted characters (`aj.glb`, `sam.glb`) with generated animation clips
- `public/audio/` voice lines, `public/sfx/` and `public/music/` sound
- `tools/` converters and importers (`convert.html`, `convert-sam.html`, `import-audio.py`, `split-voices.py`, `sync-*.py`)
- `VOICE_SCRIPT.md`, `AUDIO_SCRIPT.md` scripts for the ElevenLabs lines, effects and music

## Regenerating the character models

The `.glb` files are built from the original sources by `tools/convert*.html` (run `npm run dev`, open the page with `?export`, with a small local save server). The original sources (`Aj.fbx`, `Sam_Altman.gltf`) are third-party files and are not included in this repo; put them in `assets-src/` to regenerate.
