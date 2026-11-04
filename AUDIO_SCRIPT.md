# RAM Heist: sound effects and music to generate

ElevenLabs **Sound Effects** for the first table, **Music** for the second. Everything is optional: any sound you skip keeps a synthesized stand-in.

Import with `python3 tools/import-audio.py sfx <id> <file> [--split]` (or `music <id> <file>`), or send me the files and the ids.

## Sound effects

| id | seconds | import | prompt |
|---|---|---|---|
| `footstep_walk` | 12 | `--split` | Six separate footsteps of a person in sneakers walking slowly on a concrete floor in a quiet server room. Each step is clearly separate with about one second of silence between steps. Dry, close microphone, no background noise. |
| `footstep_run` | 10 | `--split` | Eight separate fast running footsteps in sneakers on a concrete floor. Each step is clearly separate with about half a second of silence between steps. Dry, close microphone, no background noise. |
| `footstep_crouch` | 10 | `--split` | Six very soft, quiet creeping footsteps in rubber-soled shoes on concrete. Each step is clearly separate with about one second of silence between steps. Subtle and gentle, no background noise. |
| `sam_step` | 12 | `--split` | Six separate slow confident footsteps of a man in leather shoes on a concrete floor in a large echoey room. Each step is clearly separate with about one second of silence between steps. |
| `chip_stash` | 6 | `--split` | Three separate short clicks of a computer memory stick being pushed into a socket: a crisp plastic and metal click. About one second of silence between each. No background noise. |
| `chip_take` | 6 | `--split` | Three separate sounds of a computer memory stick being pulled out of a slot: a quick plastic click and a short slide. About one second of silence between each. No background noise. |
| `chip_pickup` | 2 | single | A bright short digital sparkle pickup sound, like collecting an item in a video game. Clean and cheerful. |
| `upload_tick` | 5 | `--split` | Three separate soft digital data-transfer blips, each a very short single electronic beep, with one second of silence between them. |
| `upload_done` | 2 | single | A short rising three-note digital chime that signals success. Clean synth, bright and satisfying. |
| `chip_stolen` | 2 | single | A cartoonish villain grab: a quick swoosh followed by a low sad descending synth tone. Short and comedic. |
| `hide_in` | 2 | single | A metal locker door closing softly with a short echo in a quiet room. |
| `hide_out` | 2 | single | A metal locker door creaking open slowly. |
| `decoy_throw` | 1 | single | A short whoosh of a small object thrown through the air. |
| `decoy_land` | 8 | `--split` | Three separate sounds of a ceramic coffee mug smashing and clattering on a concrete floor, about two seconds of silence between each. |
| `trap_place` | 2 | single | A small splash of coffee spilled on a floor, a short liquid slap. |
| `trap_slip` | 3 | single | A cartoon slip: a sliding squeak, a big body thump on the floor, then a short comedic groan. |
| `breaker_pull` | 4 | single | A heavy electrical breaker switch flipped with a loud clunk, followed by a power-down whine as fans wind down and lights buzz off. |
| `power_back` | 3 | single | A power-up surge: lights buzzing on, a rising electrical hum and fans spinning up. |
| `spotted_sting` | 2 | single | A tense short horror stinger: a sudden low rising drone hit with a metallic scrape. |
| `caught_hit` | 2 | single | A heavy impact thud with a short metallic rattle, like a character being grabbed. |
| `ui_click` | 1 | single | A soft modern interface button click, subtle and clean. |
| `ui_confirm` | 1 | single | A soft positive two-tone interface confirmation beep, gentle. |
| `applause` | 5 | single | A crowd of a few hundred people applauding enthusiastically at a conference keynote, with a few cheers. Four seconds, fading out. |
| `title_slam` | 3 | single | A massive cinematic title hit: a deep sub boom with a metallic impact and a short reverb tail. |
| `win_sting` | 5 | single | A short triumphant hopeful electronic fanfare, bright synth and a small drum hit. Five seconds. |
| `lose_sting` | 4 | single | A short sad descending synth sting with a slightly comedic defeat feel. Four seconds. |

## Music

| id | seconds | prompt |
|---|---|---|
| `music_menu` | 90 | A moody but hopeful minimalist electronic instrumental for a stealth game title screen. Slow tempo around 80 BPM, warm analog synth pads, soft sub bass, a gentle arpeggio, subtle server room texture. No vocals. Loops seamlessly. |
| `music_intro` | 25 | An uplifting corporate tech-keynote instrumental that slowly turns slightly ominous. Soft piano, pulsing synth, building strings. No vocals. About 25 seconds. |
| `music_stealth` | 120 | A tense minimal ambient electronic stealth-game score. Low drones, a sparse heartbeat-like pulse, quiet metallic ticks, never melodic, uneasy but calm, around 70 BPM. No vocals. Loops seamlessly. |
| `music_chase` | 60 | An urgent driving electronic chase track at 140 BPM. Pounding bass pulse, tense percussion, rising synth stabs. No vocals. Loops seamlessly. Should work layered on top of a calm ambient track. |
| `music_ending` | 40 | A warm, hopeful and slightly funny community-victory instrumental. Acoustic guitar, soft synth and light percussion. No vocals. About 40 seconds. |
