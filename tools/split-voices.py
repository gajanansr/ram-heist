#!/usr/bin/env python3
"""Cut one long ElevenLabs recording (all of one character's lines, in script order) into per-line mp3s.

  python3 tools/split-voices.py prompt sam            # print the text to paste into ElevenLabs
  python3 tools/split-voices.py split sam path/to/sam_all.mp3

Lines still missing from public/audio are used, in the same order as the printed prompt. The recording is transcribed
locally (faster-whisper) with word timestamps and each line is aligned to its script text, so the gaps between lines
do not need to be perfect. Needs: ffmpeg, and  pip install faster-whisper  (a venv is fine)."""
import argparse, difflib, json, os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LINES = json.load(open(os.environ.get('RH_PROMPTS') or os.path.join(ROOT, 'tools/voice-prompts.json')))
AUDIO = os.path.join(ROOT, 'public/audio')
norm = lambda t: re.findall(r"[a-z0-9']+", t.lower().replace('’', "'"))

def wanted(who, ids=None):
    have = {f[:-4] for f in os.listdir(AUDIO) if f.endswith('.mp3')} if os.path.isdir(AUDIO) else set()
    return [l for l in LINES if l['who'] == who and (l['id'] in ids if ids else l['id'] not in have)]

def cmd_prompt(a):
    ls = wanted(a.who, a.ids.split(',') if a.ids else None)
    print('\n\n'.join(l['tagged'] for l in ls)); print(f'\n[{len(ls)} lines, {sum(len(l["tagged"]) for l in ls)} characters]', file=sys.stderr)

def cmd_split(a):
    from faster_whisper import WhisperModel
    ls = wanted(a.who, a.ids.split(',') if a.ids else None); out = a.out or AUDIO; os.makedirs(out, exist_ok=True)
    model = WhisperModel('base.en', device='cpu', compute_type='int8'); segs, _ = model.transcribe(a.audio, language='en', word_timestamps=True, beam_size=5)
    words = [(re.sub(r"[^a-z0-9']", '', w.word.lower().replace('’', "'")), w.start, w.end) for s in segs for w in s.words]; words = [w for w in words if w[0]]
    exp = []; owner = []
    for li, l in enumerate(ls):
        for t in norm(l['text']): exp.append(t); owner.append(li)
    got = [w[0] for w in words]; sm = difflib.SequenceMatcher(None, exp, got, autojunk=False); first = {}; last = {}; hit = {}
    for blk in sm.get_matching_blocks():
        for k in range(blk.size):
            li = owner[blk.a + k]; wi = blk.b + k; first.setdefault(li, wi); last[li] = wi; hit[li] = hit.get(li, 0) + 1
    spans = []; bad = []
    for li, l in enumerate(ls):
        n = len(norm(l['text'])); ratio = hit.get(li, 0) / max(1, n)
        if li not in first or ratio < 0.6: bad.append((l['id'], round(ratio, 2))); spans.append(None); continue
        spans.append((words[first[li]][1], words[last[li]][2]))
    dur = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', a.audio]).decode())
    ok = [i for i, s in enumerate(spans) if s]
    for pos, i in enumerate(ok):
        s, e = spans[i]; prev_e = spans[ok[pos - 1]][1] if pos else 0; next_s = spans[ok[pos + 1]][0] if pos + 1 < len(ok) else dur
        cs = (prev_e + s) / 2 if pos else max(0, s - 0.5); ce = (e + next_s) / 2 if pos + 1 < len(ok) else min(dur, e + 0.8)  # cut mid-gap so breaths and tags like [sighs] are kept
        dest = os.path.join(out, ls[i]['id'] + '.mp3')
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', f'{cs:.3f}', '-to', f'{ce:.3f}', '-i', a.audio, '-af', 'silenceremove=start_periods=1:start_silence=0.06:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_silence=0.14:start_threshold=-45dB,areverse,loudnorm=I=-16:TP=-1.5:LRA=9', '-ar', '44100', '-ac', '1', '-b:a', '96k', dest], check=True)
        d = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', dest]).decode()); print(f"{ls[i]['id']:<18} {d:4.1f}s")
    print(f'\n{len(ok)} of {len(ls)} lines written to {out}')
    if bad: print('could not align (check these lines in the recording):', bad)
    if not a.out and not a.no_sync: subprocess.run([sys.executable, os.path.join(ROOT, 'tools/sync-voices.py')])

p = argparse.ArgumentParser(); sp = p.add_subparsers(dest='cmd', required=True)
a1 = sp.add_parser('prompt'); a1.add_argument('who', choices=['sam', 'ravi']); a1.add_argument('--ids'); a1.set_defaults(fn=cmd_prompt)
a2 = sp.add_parser('split'); a2.add_argument('who', choices=['sam', 'ravi']); a2.add_argument('audio'); a2.add_argument('--ids'); a2.add_argument('--out'); a2.add_argument('--no-sync', action='store_true'); a2.set_defaults(fn=cmd_split)
a = p.parse_args(); a.fn(a)
