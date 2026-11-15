# Croppy demo video

`croppy-demo.webm`: 29 seconds, 1920x1080, VP9, silent. A screen capture of the app with text cards, in the Space Apps pitch order: who we are, the challenge and why, Croppy, how it works, what it could do next.

It was assembled with an AI coding assistant (Claude Code, by Anthropic), so, as the Space Apps rules ask, every frame carries a visible watermark ("AI-assisted: app code and this video made with Claude Code (Anthropic)") and the file's title and comment metadata say the same. The watermark is the `.ai` element in `render/film.html`.

## How it is made

`render/` holds everything needed to make it again.

- `film.html`: the film as one page. `render(t)` draws the frame at second `t`; scenes and timings are in `SCENES`. Text is edited here.
- `shots/` and `passes/`: screenshots of the app (Kostanay demo field) that the film shows.
- `capture.mjs` and `passes.mjs`: take those screenshots from a running app.
- `render.mjs`: draws every frame (30 per second) and encodes them with ffmpeg.

```bash
cd docs/demo/render
npm install                                  # playwright-core
npx playwright-core install chromium         # a browser to draw with
# fonts come from the frontend: run `npm install` in frontend/ once

node render.mjs "$PWD" x 4,13                # check two stills: still-4.png, still-13.png
FFMPEG=ffmpeg node render.mjs "$PWD" ../croppy-demo.webm
```

`FFMPEG` must be an ffmpeg with the VP9 encoder (libvpx-vp9). `CHROME` can point to another Chromium build.

New screenshots, with the app served on port 4179 (`cd frontend && npm run build && npx vite preview --port 4179`):

```bash
node capture.mjs http://localhost:4179 shots '{}'
node passes.mjs http://localhost:4179 passes '["2021-06-05","2024-06-02"]'
```

The film uses the passes listed in `PAIRS` in `film.html`.
