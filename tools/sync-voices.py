#!/usr/bin/env python3
"""Scan public/audio/*.mp3 and rewrite the DUR table in src/voice.js, so every recorded line is picked up by the game.
Usage:  python3 tools/sync-voices.py
Names must match the ids in VOICE_SCRIPT.md (for example sam_slip_1.mp3)."""
import glob, json, os, re, subprocess
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
dur = {}
for f in sorted(glob.glob(os.path.join(root, 'public/audio/*.mp3'))):
    d = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).decode())
    dur[os.path.basename(f)[:-4]] = round(d, 2)
p = os.path.join(root, 'src/voice.js'); s = open(p).read()
ids = set(re.findall(r"^  (\w+): \[['\"](?:sam|ravi)['\"]", s, re.M))
unknown = [k for k in dur if k not in ids]
s = re.sub(r"export const DUR = \{.*?\};", 'export const DUR = ' + json.dumps(dur) + ';', s, flags=re.S)
open(p, 'w').write(s)
missing = sorted(ids - set(dur))
print(f'{len(dur)} recorded, {len(missing)} still silent')
if unknown: print('files with unknown ids (renamed wrong?):', unknown)
if missing: print('silent:', ', '.join(missing))
