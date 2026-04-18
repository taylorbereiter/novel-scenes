---
name: novel-scene-builder
description: Build a browser-playable 3D scene from a novel/play passage for Taylor's English classes. Linear guided walk with examinable objects — not a branching game. Trigger on phrases like "build a scene from [title]", "new novel scene", "let's build [title] chapter X", "turn [passage] into a playable scene", or any request to make a 3D scene from literature.
---

# novel-scene-builder

Build a linear 3D walkthrough of a literary passage for Taylor's high school English classes. Scenes are single-file HTML pages that import the shared `framework/` modules from this repo and are served to students via jsDelivr.

## What a scene IS

- A **linear guided walk** through 2–5 beats, advanced with Space
- A few **examinable objects** — students click a skull, a candle, a hat, and get a card with a passage excerpt or analytical note
- A **book-as-UI** overlay (title card → beat pages → ending reflection) in Taylor's warm, serif, terracotta/paper/ink aesthetic
- **Browser-only.** No install. Students open a jsDelivr URL.

## What a scene is NOT

- Not a branching story. Not a dialogue system. Not a game with choices.
- Not open-world. Every scene is on rails — camera moves to fixed positions on each beat.
- Not voiced. Text only.

If Taylor asks for something that breaks these constraints, confirm before scope-creeping.

---

## Workflow

### 1. Gather the scene spec from Taylor

Ask (in one message, not one question at a time):

1. **Title + chapter/scene/act** (e.g. "Hamlet Act 5 Scene 1")
2. **Setting** — 1–2 sentences describing the physical space (weather, time of day, key objects, mood)
3. **Beat structure** — 2–5 beats. For each beat: a title, 1–3 sentences of book-panel text, and an optional gloss/note
4. **Examinable objects** — 2–4 clickable objects. For each: name, which asset it should use (or "find one"), and the passage text that appears when clicked
5. **Ending reflection** — the final prompt students answer in the textarea

Use the Hamlet example at the bottom of this file as a template to show him.

### 2. Prepare the repo

```bash
cd path/to/novel-scenes
git pull
```

Always `git pull` first — other sessions may have added assets.

### 3. Inventory assets

Read `manifest.json` and list which of Taylor's needed assets already exist. For missing assets:

- Search Poly Pizza (`https://poly.pizza/search/<term>`)
- Fall back to Quaternius if Poly Pizza has nothing
- **Ask Taylor before skipping or substituting** — don't silently swap a "cypress tree" for a "palm tree"

### 4. Add new assets (if any)

For each new asset:

1. Download the GLB to the appropriate `assets/<category>/` folder
2. Add an entry to `manifest.json` with generous tags, source URL, license, attribution (if CC-BY)
3. **Commit the asset additions as a SEPARATE commit first:** `git add -A && git commit -m "Add assets: <list>" && git push`

This matters because if the scene-build step fails, the assets are still useful for future scenes.

### 5. Build the scene file

Create `scenes/<slug>/index.html` where `<slug>` is kebab-case like `hamlet-5-1` or `stranger-part1-ch1`.

**Scene file template:**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title><!-- Scene title --></title>
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body>
<canvas id="c"></canvas>

<script type="importmap">
{
  "imports": {
    "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
    "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
  }
}
</script>

<script type="module">
import * as THREE from 'three';
import { createScene, loadAssets, makeExaminable, enableExamination, startRenderLoop }
  from 'https://cdn.jsdelivr.net/gh/taylorbereiter/novel-scenes@main/framework/scene-loader.js';
import { BeatEngine }
  from 'https://cdn.jsdelivr.net/gh/taylorbereiter/novel-scenes@main/framework/beat-engine.js';
import { BookUI }
  from 'https://cdn.jsdelivr.net/gh/taylorbereiter/novel-scenes@main/framework/book-ui.js';

BookUI.mount();

// 1. Create rig
const { scene, camera, renderer, composer } = createScene({
  skyColor: 0x8a8275,
  fogDensity: 0.025,
  cameraPos: [0, 1.65, 6]
});

// 2. Ground + static environment (build with simple three primitives —
//    THREE.PlaneGeometry for ground, maybe a couple walls or terrain mounds)
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(60, 60),
  new THREE.MeshStandardMaterial({ color: 0x7a6a4c, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// 3. Load and place assets
const assets = await loadAssets([
  'graveyard-gravestone-01',
  'graveyard-skull-01',
  // ...
]);
assets['graveyard-gravestone-01'].position.set(-2, 0, -3);
scene.add(assets['graveyard-gravestone-01']);
// ... etc

// 4. Wire up examinables
makeExaminable(assets['graveyard-skull-01'], 'Yorick\'s skull', () => {
  BookUI.showCard({
    title: "Alas, poor Yorick",
    body: '"I knew him, Horatio — a fellow of infinite jest..."',
    note: 'Hamlet pauses. Then holds the skull and makes a joke. The joke is the grief.'
  });
});
// ... repeat for each examinable

enableExamination(camera);

// 5. Define beats
const BEATS = [
  {
    label: 'Beat I · The graveyard',
    title: '"Alas, poor Yorick"',
    text: 'Hamlet and Horatio arrive at a freshly-dug grave...',
    gloss: 'This is not melancholy for melancholy\'s sake...',
    cite: 'Hamlet · Act 5, Scene 1',
    cameraPos: [0, 1.65, 4],
    cameraLookAt: [0, 1.2, 0]
  },
  // ...
];

// 6. Wire engine to UI
await BeatEngine.init({
  camera,
  onBeat: (beat, i, total) => BookUI.showBeat(beat, i, total),
  onEnd: () => BookUI.showEnding({
    eyebrow: 'End of Scene',
    finalLine: '"...we may return, Horatio..."',
    prompt: 'What does Hamlet <em>notice</em>? What does he refuse to notice?'
  })
});

// 7. Show title, then begin
await BookUI.showTitle({
  author: 'William Shakespeare',
  title: 'Hamlet',
  chapter: 'Act 5 · Scene 1',
  intro: 'A churchyard. A freshly-dug grave. <em>Examine what Hamlet sees.</em>',
  startLabel: 'Enter the graveyard'
});
BeatEngine.start(BEATS);

// 8. Start render loop
startRenderLoop({ scene, camera, renderer, composer });
</script>
</body>
</html>
```

### 6. Commit and push the scene

```bash
git add scenes/<slug>/
git commit -m "Scene: <title>"
git push
```

### 7. Give Taylor the URL

After push + ~1 minute of jsDelivr cache refresh, the scene is live at:

```
https://cdn.jsdelivr.net/gh/taylorbereiter/novel-scenes@main/scenes/<slug>/index.html
```

Tell Taylor this URL and remind him jsDelivr sometimes takes a minute to pick up new commits. If he opens it and sees an old version, he can append `?v=<timestamp>` to bust the cache.

---

## Example scene spec (Hamlet 5.1)

```
Title: Hamlet, Act 5, Scene 1
Setting: An overcast graveyard. A freshly-dug grave. A couple of gravestones,
  a bare tree, a bench in the background.

Beats:
  I. "Alas, poor Yorick"
     Text: "Hamlet and Horatio arrive at a freshly-dug grave. The gravedigger
     has tossed up a skull."
     Right-panel note: "Examine what he sees."

Examinables:
  - Skull → "Alas, poor Yorick! I knew him, Horatio — a fellow of infinite
    jest, of most excellent fancy..."
  - Spade → "a pickaxe and a spade, a spade, for and a shrouding sheet..."
  - Grave → "To what base uses we may return, Horatio. Why may not imagination
    trace the noble dust of Alexander till he find it stopping a bung-hole?"

Ending: "What does Hamlet notice? What does he refuse to notice?"
```

---

## Voice and aesthetic

Every scene should feel like Taylor's Teaching Voice & Design Profile:

- **Warm, serif-heavy, terracotta/paper/ink palette.** The framework already handles this — don't override CSS colors.
- **Classroom-appropriate.** No gore, no horror styling. This is a funeral scene or a cemetery, not a haunted house.
- **Passages over plot summary.** When in doubt, show a quote. Glosses should help students notice, not tell them what to think.
- **Linear, meditative.** A walk through a moment, not a puzzle.

## Rules

1. **Ask before substituting assets.** "I couldn't find a cypress — shall I use a generic tall tree?" is always better than silently swapping.
2. **Small, frequent commits.** Separate commits for asset additions vs. the scene file itself.
3. **Never edit framework files during a scene build** unless Taylor asks. If a framework bug comes up, flag it and ask whether to patch now or file it.
4. **Never add features beyond what the spec asks for.** No branching. No audio. No multiplayer.
