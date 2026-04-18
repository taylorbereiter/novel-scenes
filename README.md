# novel-scenes

Asset library and scene host for Taylor Bereiter's English classes at Kang Chiao International School.

Built with Claude Code. Each scene is a linear, browser-playable 3D walk through a moment in a novel or play — students click examinable objects to reveal passage text, then advance through beats with Space. The aesthetic matches Taylor's Teaching Voice & Design Profile: warm, serif-heavy, terracotta/paper/ink palette, classroom-appropriate.

## Structure

- `assets/` — shared GLB models, grouped by theme (graveyard, nature, props, characters)
- `manifest.json` — searchable index of every asset with tags, source, and license
- `framework/` — three reusable JS modules imported by every scene:
  - `scene-loader.js` — three.js setup, asset loading via jsDelivr CDN, raycaster-based object examination
  - `beat-engine.js` — beat progression with Space-to-advance, camera moves, lighting hooks
  - `book-ui.js` — the book-as-UI overlay (title card, beat HUD, two-page panel, ending card)
- `scenes/<slug>/index.html` — individual scene files, served via `raw.githack.com`

## Opening a scene in class

Every scene has a URL of the form:

```
https://raw.githack.com/taylorbereiter/novel-scenes/main/scenes/<slug>/index.html
```

Open it in any browser. No install, no server.

**Why two CDNs?** Scene HTML is served via `raw.githack.com` because jsDelivr serves `.html` files as `text/plain` (a security policy), so browsers show source code instead of rendering. Framework JS files imported inside scenes use `cdn.jsdelivr.net` — jsDelivr serves JS modules correctly and with better caching.

## Building a new scene

In a Claude Code session with this repo as the working directory, say something like:

> "Build a scene from Hamlet Act 5 Scene 1"

The `novel-scene-builder` skill will ask you for beats and examinable objects, then assemble the scene, push to GitHub, and give you the URL to share.
