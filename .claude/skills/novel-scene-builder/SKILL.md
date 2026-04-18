---
name: novel-scene-builder
description: Build a browser-playable 3D scene from a novel/play passage for Taylor's English classes. The skill reads a local PDF of the book, cross-references LitCharts/SparkNotes, drafts the beats itself (chapter-scoped — no spoilers), then assembles the scene using assets from the novel-scenes GitHub repo. Linear guided walk with examinable objects — not a branching game. Trigger on phrases like "build a scene from [title]", "new novel scene", "let's build [title] chapter X", "turn [passage] into a playable scene", or any request to make a 3D scene from literature.
---

# novel-scene-builder

Build a linear 3D walkthrough of a literary passage for Taylor's high school English classes. Scenes are single-file HTML pages that import the shared `framework/` modules from this repo and are served to students via jsDelivr.

## What a scene IS

- A **linear guided walk** through 2–5 beats, advanced with Space
- A few **examinable objects** — students click a skull, a candle, a hat, and get a card with a passage excerpt or analytical note
- A **book-as-UI** overlay (title card → beat pages → ending reflection) in Taylor's warm, serif, terracotta/paper/ink aesthetic
- **Browser-only.** No install. Students open a jsDelivr URL.
- **Chapter-scoped.** Beats and examinables reference only events from the target chapter or earlier — never later. Students will encounter this scene *before* they have read the rest of the book.

## What a scene is NOT

- Not a branching story. Not a dialogue system. Not a game with choices.
- Not open-world. Every scene is on rails — camera moves to fixed positions on each beat.
- Not voiced. Text only.
- Not a summary. Scenes *stage* a moment so students can read passages in place. The gloss points at what to notice, not what to conclude.

If Taylor asks for something that breaks these constraints, confirm before scope-creeping.

---

## The full workflow

The skill has six phases: **intake → research → draft → review → build → verify**. Do them in order. Do not skip the review step before building, and do not skip the verify step before pushing.

### Phase 1 — Intake

Ask Taylor (one message, all questions at once):

1. **Title and chapter/scene/act.** (e.g. "The Stranger, Part 1 Chapter 3" or "Hamlet Act 5 Scene 1")
2. **The PDF.** Either a file path on his Mac, or he drops the PDF into the chat. If he can't produce one, flag it — the skill needs a primary source. Ask whether to proceed with secondary sources only (LitCharts + SparkNotes) or wait.
3. **Class context.** Which class is this for (11 EH or 12 EL)? What did students just read? What is he hoping they'll *notice* in this scene? (One sentence from him is enough.)
4. **Visual mood.** Two or three adjectives (e.g. "overcast, oppressive, sun-bleached"). Skip if he's indifferent — pick from the text.
5. **How many beats.** 2–5. Default to 3 if he says "you pick."

Do not start researching until he answers.

### Phase 2 — Research

Use THREE sources of truth, in priority order:

1. **The PDF** — this is authoritative. Extract the full text of the target chapter. If the PDF is scanned/image-based, OCR it. Also note what came before (previous chapters) so you can judge spoiler risk.
2. **LitCharts chapter analysis** — web-fetch `https://www.litcharts.com/lit/<slug>/<chapter-slug>`. If the page is blocked or 404s, tell Taylor and ask whether to proceed without it.
3. **SparkNotes chapter summary and analysis** — web-fetch `https://www.sparknotes.com/lit/<slug>/section<N>/`. Same fallback.

**Scope hygiene (critical):**
- The scene exists *within* the student's current reading progress. Never reference plot points from later chapters — not in the beat text, not in the gloss, not in an examinable's note, not in the ending prompt.
- References to earlier chapters are fine and often desirable (e.g. "Remember the telegram in Chapter 1").
- When in doubt, cut the reference.

Write what you learned to a scratch file at `scenes/<slug>/NOTES.md` — this does not get committed, but you'll use it in the next phase. Include: key passages (with page numbers), LitCharts themes, SparkNotes summary, quoted passages you might use as examinables.

### Phase 3 — Draft the beats

From the research, draft a scene spec with this structure:

```
TITLE: <Book, Chapter/Scene/Act>

SETTING: 2–3 sentences describing the physical space students will walk through — weather, light, key objects.

BEATS (<N>):

  I. <Beat title — a short phrase, often a line from the text>
     Text (what appears on the left page of the book):
       1–3 sentences setting the scene for this beat. Quote the text where possible.
     Gloss (what appears on the right page):
       A note on what is happening — points at what to notice, does not lecture.
     Camera: <brief description of what the camera is looking at>

  II. ...

EXAMINABLES (2–4):
  - <object name> (asset id if known, or "need to find"):
    Passage: "<verbatim excerpt>"
    Note (optional): <one-sentence marginal observation>

ENDING: <the reflection prompt, one to two sentences>
```

Every quoted passage must be verifiable against the PDF. If you paraphrase, say so.

### Phase 4 — Review with Taylor

Show him the full draft spec. Ask:

> "Before I build this — any beats to cut, passages to swap, or examinables to add? And does this stay within what students have read?"

Wait for his answer. Edit the draft based on his feedback. Repeat until he says go. **Do not build the scene file until he approves the draft.**

### Phase 5 — Build

Once approved:

```bash
cd path/to/novel-scenes
git pull
```

**5a. Inventory assets.**

Read `manifest.json`. For each examinable or environment object in the draft, find the best matching asset (use the `tags` array). List:

- ✅ Found: <object> → <asset id>
- ❓ Missing: <object> — need to find

**5b. Source missing assets.**

For each missing asset, in order:

1. Search Poly Pizza: `https://poly.pizza/search/<term>`
2. Fall back to Quaternius: `https://quaternius.com/`
3. If still no match, stop and ask Taylor:

   > "I can't find a good match for <object>. Options: (A) use <nearest substitute> instead, (B) skip this examinable, (C) you find and link me a GLB. Which?"

**5c. Add new assets.**

For each asset downloaded:

1. Save to `assets/<category>/<slug>.glb`
2. Add a manifest entry with generous tags, source URL, license, attribution (if CC-BY)
3. **Commit the asset additions as a SEPARATE commit first:** `git add assets/ manifest.json && git commit -m "Add assets: <list>" && git push`

Separating the asset commit means that if the scene build step fails, the assets are still in the library for future scenes.

**5d. Write the scene file.**

Create `scenes/<slug>/index.html` using the framework modules. `<slug>` is kebab-case: `hamlet-5-1`, `stranger-part1-ch1`, `beloved-ch1`.

See the scene file template at the bottom of this file.

**Placement discipline — avoid the book-clipping-through-walls problem:**

- The book panel sits at the bottom center of the screen. The camera should be positioned and angled so that the key examinables are visible in the upper and middle portions of the frame, not behind the book.
- For outdoor scenes, use a slightly elevated camera (y ≈ 2.4+) looking down toward the ground plane.
- For indoor scenes, position the camera away from walls — at least 2 units of clearance on each side of the camera's travel path. If a beat's cameraPos is near a wall, move it.
- Every cameraPos should have a clear line of sight to every object referenced in that beat's text. If it doesn't, reposition the camera or the objects.
- If the camera moves between beats, ensure the *path* between positions is clear too (the book "travels" along this path). Avoid passing through meshes.

### Phase 6 — Verify (self-review)

Before you commit the scene file, do this verification pass. If any item fails, fix it before moving on.

**6a. Source fidelity.**

For each beat's quoted text and each examinable's passage:
- Open the PDF. Locate the passage.
- Confirm the quote is verbatim (or marked as paraphrase).
- Confirm the passage is from the target chapter or earlier.

**6b. Spoiler check.**

Read every beat's title, text, gloss, every examinable's note, and the ending prompt. Ask for each: *does this reference anything the student has not yet read?* If yes, rewrite.

**6c. Asset placement.**

Open the scene mentally:
- Is each examinable visible from its beat's cameraPos?
- Does the book panel occlude any examinable? (If yes, raise the camera.)
- Does the camera path between beats pass through any mesh? (If yes, reroute.)

**6d. If a preview tool is available, run the scene.**

If a browser preview is available in this session (e.g. Claude Preview MCP), open the scene file locally, click through all beats and all examinables, confirm nothing is hidden or clipped. If a preview tool is not available, say so in the final report — Taylor will verify manually.

### Phase 7 — Commit, push, report

```bash
git add scenes/<slug>/
git commit -m "Scene: <title>"
git push
```

Report to Taylor in this shape (keep under 12 lines):

```
Scene: <title>
URL:   https://cdn.jsdelivr.net/gh/taylorbereiter/novel-scenes@main/scenes/<slug>/index.html

Sources used: PDF (ch. <N>), LitCharts ✓/✗, SparkNotes ✓/✗
Assets added: <count> new, <count> reused
Spoiler check: clean / flagged <items>
Preview verified: yes / no — please test manually

Any passage I couldn't verify against the PDF:
  - <list, or "none">
```

Add the note: *"jsDelivr sometimes takes ~1 minute to pick up new commits. Append `?v=<timestamp>` if you see a stale version."*

---

## Scene file template

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
  cameraPos: [0, 2.4, 7]     // elevated so the book panel doesn't occlude
});

// 2. Ground + static environment (simple three primitives are fine)
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
]);
assets['graveyard-gravestone-01'].position.set(-2, 0, -3);
scene.add(assets['graveyard-gravestone-01']);

// 4. Wire up examinables
makeExaminable(assets['graveyard-skull-01'], "Yorick's skull", () => {
  BookUI.showCard({
    title: "Alas, poor Yorick",
    body: '"I knew him, Horatio..."',
    note: 'Hamlet pauses. Then holds the skull and makes a joke.'
  });
});
enableExamination(camera);

// 5. Define beats — every beat's cameraPos must have clear sight of its examinables
const BEATS = [
  {
    label: 'Beat I · The graveyard',
    title: '"Alas, poor Yorick"',
    text: 'Hamlet and Horatio arrive at a freshly-dug grave...',
    gloss: 'Click the skull. Click the spade. Then press Space.',
    cite: 'Hamlet · Act 5, Scene 1',
    cameraPos: [0, 2.4, 7],
    cameraLookAt: [0, 0.6, 0]
  },
];

// 6. Wire engine + UI
await BeatEngine.init({
  camera,
  onBeat: (beat, i, total) => BookUI.showBeat(beat, i, total),
  onEnd: () => BookUI.showEnding({
    eyebrow: 'End of Scene',
    finalLine: '"...we may return, Horatio..."',
    prompt: 'What does Hamlet <em>notice</em>? What does he refuse to notice?',
    onRestart: () => BeatEngine.start(BEATS)   // replay in place; do NOT use location.reload
  })
});

// 7. Title → beats → render
await BookUI.showTitle({
  author: 'William Shakespeare',
  title: 'Hamlet',
  chapter: 'Act 5 · Scene 1',
  intro: 'A churchyard. <em>Examine what Hamlet sees.</em>',
  startLabel: 'Enter the graveyard'
});
BeatEngine.start(BEATS);
startRenderLoop({ scene, camera, renderer, composer });
</script>
</body>
</html>
```

---

## Voice and aesthetic

Every scene should feel like Taylor's Teaching Voice & Design Profile:

- **Warm, serif-heavy, terracotta/paper/ink palette.** The framework already handles this — don't override CSS colors.
- **Classroom-appropriate.** A cemetery can be solemn; it is not horror. A prison can be bleak; it is not gore.
- **Passages over plot summary.** When in doubt, show a quote. Glosses point at what to notice, never tell students what to think.
- **Linear, meditative.** A walk through a moment. Not a puzzle. Not a game.

## Hard rules

1. **Never spoil.** If a reference touches a chapter the student has not read, cut it. This is the single most important rule.
2. **Every quote is verbatim unless marked as paraphrase.** Source: the PDF. If you cannot verify against the PDF, mark the passage as unverified in the final report.
3. **Ask before substituting assets.** "I couldn't find a cypress — shall I use a generic tall tree?" is always better than silently swapping.
4. **Review before build.** Always show Taylor the draft spec and wait for approval before writing the scene file.
5. **Self-review before push.** Always run the Phase 6 verify pass before committing the scene.
6. **Small, frequent commits.** Asset additions and the scene file are separate commits.
7. **Never edit framework files during a scene build** unless Taylor asks. If a framework bug comes up, flag it and ask whether to patch now or file it as a separate task.
8. **Never add features beyond what the spec asks for.** No branching. No audio. No multiplayer.
