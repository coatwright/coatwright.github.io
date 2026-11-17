"""Builds the final MP4: frames (with real timing) + narration placed at each scene's start."""
import json, subprocess, sys
import numpy as np, soundfile as sf

V = sys.argv[1]
OUT = sys.argv[2]
tl = json.load(open(V + '/timeline.json'))
frames, scenes, endT = tl['frames'], tl['scenes'], tl['endT']
t0 = scenes[0]['start']
frames = [f for f in frames if f['t'] <= endT]
# frames before t0: keep the last one as the opening frame
before = [f for f in frames if f['t'] < t0]
frames = ([dict(before[-1], t=t0)] if before else []) + [f for f in frames if f['t'] >= t0]

with open(V + '/frames.ffconcat', 'w') as fh:
    fh.write('ffconcat version 1.0\n')
    for i, f in enumerate(frames):
        nxt = frames[i + 1]['t'] if i + 1 < len(frames) else endT
        fh.write(f"file 'frames/{f['name']}'\nduration {max(0.001, nxt - f['t']):.4f}\n")
    fh.write(f"file 'frames/{frames[-1]['name']}'\n")

total = endT - t0
sr = 24000
track = np.zeros(int((total + 0.5) * sr), dtype=np.float32)
for s in scenes:
    data, rate = sf.read(f"{V}/vo/{s['id']}.wav", dtype='float32')
    assert rate == sr
    off = int((s['start'] - t0 + 0.45) * sr)
    track[off:off + len(data)] += data[: max(0, len(track) - off)]
peak = np.max(np.abs(track)) or 1
track = track / peak * 0.89
sf.write(V + '/narration.wav', track, sr)

subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', V + '/frames.ffconcat', '-i', V + '/narration.wav',
                '-vf', 'fps=30,scale=1080:1920:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20',
                '-c:a', 'aac', '-b:a', '160k', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-shortest', '-movflags', '+faststart', OUT], check=True)
print('video', OUT, 'length', round(total, 1), 's', 'frames', len(frames))
