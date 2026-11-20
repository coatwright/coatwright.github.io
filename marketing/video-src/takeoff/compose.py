import json, subprocess, sys
import numpy as np, soundfile as sf
V, OUT = sys.argv[1], sys.argv[2]
tl = json.load(open(V + '/timeline.json'))
frames, scenes, endT = tl['frames'], tl['scenes'], tl['endT']
t0 = frames[0]['t']
with open(V + '/frames.ffconcat', 'w') as fh:
    fh.write('ffconcat version 1.0\n')
    for i, f in enumerate(frames):
        nxt = frames[i + 1]['t'] if i + 1 < len(frames) else endT
        fh.write(f"file 'frames/{f['name']}'\nduration {max(0.001, nxt - f['t']):.4f}\n")
    fh.write(f"file 'frames/{frames[-1]['name']}'\n")
sr = 24000
total = endT - t0
track = np.zeros(int((total + 0.5) * sr), dtype=np.float32)
for s in scenes:
    data, rate = sf.read(f"{V}/vo/{s['id']}.wav", dtype='float32')
    off = int((s['start'] - t0 + 0.12) * sr)
    track[off:off + len(data)] += data[: max(0, len(track) - off)]
track = track / (np.max(np.abs(track)) or 1) * 0.89
sf.write(V + '/narration.wav', track, sr)
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', V + '/frames.ffconcat', '-i', V + '/narration.wav',
  '-vf', 'fps=30,scale=1920:1080:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '19',
  '-c:a', 'aac', '-b:a', '160k', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-shortest', '-movflags', '+faststart', OUT], check=True)
print('video', OUT, round(total, 1), 's')
