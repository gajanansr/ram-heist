#!/usr/bin/env python3
"""Import a generated sound into the game.

  python3 tools/import-audio.py sfx footstep_walk  ~/Downloads/steps.mp3 --split   # one clip with several steps -> footstep_walk_1..n
  python3 tools/import-audio.py sfx chip_pickup    ~/Downloads/pickup.mp3            # a single sound
  python3 tools/import-audio.py music music_stealth ~/Downloads/stealth.mp3           # a music loop

--split cuts a recording at its silences, so you can generate several variations in one go."""
import argparse, glob, os, re, subprocess, sys
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def run(*a): return subprocess.run(a, check=True, capture_output=True, text=True)
p = argparse.ArgumentParser(); p.add_argument('kind', choices=['sfx', 'music']); p.add_argument('id'); p.add_argument('file'); p.add_argument('--split', action='store_true'); p.add_argument('--thresh', type=float, default=-38, help='silence threshold in dB for --split (use -50 for very quiet sounds)'); p.add_argument('--drop-edges', action='store_true', help='drop sounds touching the start/end of the file (often clipped)'); p.add_argument('--drop-long', type=float, default=0, help='drop sounds longer than N times the median length (skids, tails)'); a = p.parse_args()
trim = 'silenceremove=start_periods=1:start_silence=0.03:start_threshold=-48dB,areverse,silenceremove=start_periods=1:start_silence=0.08:start_threshold=-48dB,areverse'
if a.kind == 'music':
    out = os.path.join(root, 'public/music'); os.makedirs(out, exist_ok=True)
    run('ffmpeg', '-y', '-v', 'error', '-i', a.file, '-af', 'loudnorm=I=-20:TP=-2:LRA=11', '-ar', '44100', '-b:a', '128k', os.path.join(out, a.id + '.mp3'))
else:
    out = os.path.join(root, 'public/sfx'); os.makedirs(out, exist_ok=True)
    for old in glob.glob(os.path.join(out, a.id + '.mp3')) + glob.glob(os.path.join(out, a.id + '_[0-9]*.mp3')): os.remove(old)
    norm = 'loudnorm=I=-18:TP=-2:LRA=9'
    if not a.split:
        run('ffmpeg', '-y', '-v', 'error', '-i', a.file, '-af', trim + ',' + norm, '-ar', '44100', '-ac', '1', '-b:a', '96k', os.path.join(out, a.id + '.mp3')); print('wrote', a.id + '.mp3')
    else:
        log = subprocess.run(['ffmpeg', '-v', 'info', '-i', a.file, '-af', f'silencedetect=n={a.thresh}dB:d=0.18', '-f', 'null', '-'], capture_output=True, text=True).stderr
        dur = float(re.search(r'Duration: (\d+):(\d+):([\d.]+)', log).expand(r'\1:\2:\3').split(':')[0]) * 3600 + float(re.search(r'Duration: (\d+):(\d+):([\d.]+)', log).group(2)) * 60 + float(re.search(r'Duration: (\d+):(\d+):([\d.]+)', log).group(3))
        starts = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', log)]; ends = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', log)]
        segs = []; cur = 0.0
        for i, s in enumerate(starts):
            if s - cur > 0.04: segs.append((cur, s))
            cur = ends[i] if i < len(ends) else dur
        if dur - cur > 0.04: segs.append((cur, dur))
        if a.drop_edges: segs = [(x, y) for x, y in segs if x > 0.02 and y < dur - 0.02]
        if a.drop_long and segs:
            lens = sorted(y - x for x, y in segs); med = lens[len(lens) // 2]; segs = [(x, y) for x, y in segs if (y - x) <= med * a.drop_long]
        vd = subprocess.run(['ffmpeg', '-v', 'info', '-i', a.file, '-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True).stderr
        peak = float(re.search(r'max_volume: ([-\d.]+) dB', vd).group(1)); gain = -3.0 - peak  # one shared gain for the whole recording keeps the variants' relative levels
        norm = f'volume={gain:.2f}dB,alimiter=limit=0.9'
        for n, (s, e) in enumerate(segs, 1):
            run('ffmpeg', '-y', '-v', 'error', '-ss', f'{max(0, s - 0.04):.3f}', '-to', f'{min(dur, e + 0.12):.3f}', '-i', a.file, '-af', trim + ',' + norm, '-ar', '44100', '-ac', '1', '-b:a', '96k', os.path.join(out, f'{a.id}_{n}.mp3'))
        print(f'wrote {len(segs)} variants: {a.id}_1 .. {a.id}_{len(segs)}')
subprocess.run([sys.executable, os.path.join(root, 'tools/sync-audio.py')])
