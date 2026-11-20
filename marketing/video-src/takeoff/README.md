# Blueprint takeoff demo video

`marketing/videos/coatwright-blueprint-takeoff-demo.mp4` (about 80 s, 1920×1080, desktop).

1. `script.json`: chapters and narration. Make the voice with `../tts.py` (Kokoro, voice `af_heart`) → `vo/*.wav`, `durations.json`.
2. `record.js <folder>`: drives the real app at http://localhost:8765/app/ (serve the repository root), with a visible cursor and chapter labels,
   using the demo plan `app/demo/sample-office-plan.pdf` (copy it into the folder as `A-101 Level 2 Floor Plan.pdf`).
3. `compose.py <folder> <out.mp4>`: frames + narration placed at each scene's real start.

The demo plan and its pre-measured takeoff are made by `app/demo/make_demo.py` (a fictional office, 1/8" = 1'-0").
