import json, sys, soundfile as sf
from kokoro_onnx import Kokoro
V, K = sys.argv[1], sys.argv[2]
k = Kokoro(K + '/model/kokoro-v1.0.onnx', K + '/model/voices-v1.0.bin')
out = {}
for s in json.load(open(V + '/script.json')):
    samples, sr = k.create(s['text'], voice='af_heart', speed=1.0, lang='en-us')
    sf.write(f"{V}/vo/{s['id']}.wav", samples, sr)
    out[s['id']] = round(len(samples) / sr, 2)
    print(s['id'], out[s['id']], flush=True)
json.dump(out, open(V + '/durations.json', 'w'))
