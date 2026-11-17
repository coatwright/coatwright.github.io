# Explainer video source

How `marketing/videos/coatwright-explainer.mp4` is made (about 88 s, 1080×1920):

1. `script.json`: scenes, on-screen titles and narration.
2. `tts.py`: narration with Kokoro (voice `af_heart`, Apache-2.0) → one WAV per scene and `durations.json`.
3. `seed.js`: demo business "Rivera Painting Co." (jobs, payments, expenses) → `seed.json`.
4. `stage.html` + `record.js`: plays each scene in the real app inside a phone frame and captures timed frames (Playwright + CDP screencast).
5. `compose.py`: frames + narration → MP4 (H.264/AAC, loudness normalized).

Paths in the scripts point to a scratch folder; adjust before re-running. Serve a folder containing `stage.html` and a link to `app/` on port 8766.
