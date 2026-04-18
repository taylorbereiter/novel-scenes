/*
 * book-ui.js
 *
 * The book-as-UI overlay. Injects all styles and DOM into the page and exposes
 * a small API that scenes use to show the title card, beat pages, examinable-
 * object cards, and the ending reflection prompt.
 *
 * Aesthetic matches Taylor's Teaching Voice & Design Profile:
 * warm, serif-heavy, terracotta/paper/ink palette. Based on the existing
 * stranger-guided-chapter-1.html styling.
 *
 * Usage:
 *
 *   import { BookUI } from '../../framework/book-ui.js';
 *   BookUI.mount();
 *   BookUI.showTitle({
 *     author: 'William Shakespeare',
 *     title: 'Hamlet',
 *     chapter: 'Act 5 · Scene 1',
 *     intro: 'A churchyard...',
 *     startLabel: 'Begin the walk'
 *   }).then(() => BeatEngine.start(beats));
 *
 *   BookUI.showBeat({ label, title, text, cite });
 *   BookUI.showCard({ type: 'quote', title, body, note });   // for examinables
 *   BookUI.showEnding({ finalLine, prompt, onRestart });
 */

const STYLES = `
:root {
  --ink: #2a201a;
  --paper: #f4ead3;
  --paper-edge: #d7c79c;
  --sun: #f7e3a4;
  --shadow: rgba(20, 14, 8, 0.6);
  --accent: #8a3a24;
}
html, body {
  margin: 0; padding: 0; height: 100%; overflow: hidden;
  background: #1a130c; color: var(--paper);
  font-family: 'Iowan Old Style', Georgia, serif;
  -webkit-font-smoothing: antialiased;
}
canvas { display: block; }

/* ---------- Title card ---------- */
#title-card {
  position: fixed; inset: 0; z-index: 300;
  background: radial-gradient(ellipse at center, #3a2818 0%, #0c0804 80%);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center; padding: 40px; box-sizing: border-box;
  transition: opacity 1s ease-out;
}
#title-card.hide { opacity: 0; pointer-events: none; }
#title-card .eyebrow {
  font-size: 12px; letter-spacing: 6px; color: var(--sun);
  text-transform: uppercase; margin-bottom: 18px;
}
#title-card h1 {
  font-size: 62px; letter-spacing: 8px; margin: 0;
  color: #f4ead3; font-weight: 300; font-style: italic;
}
#title-card h1::before, #title-card h1::after {
  content: '·'; color: var(--sun); margin: 0 24px; font-style: normal;
}
#title-card .chapter {
  font-size: 16px; letter-spacing: 8px; color: var(--paper-edge);
  margin: 18px 0 36px; text-transform: uppercase;
}
#title-card .intro {
  max-width: 520px; line-height: 1.85; font-size: 15px;
  color: #c9b894; font-style: italic; margin-bottom: 40px;
}
#title-card .intro em {
  color: #f4ead3; font-style: normal;
  border-bottom: 1px dotted var(--sun); padding-bottom: 1px;
}
#title-card button {
  background: transparent; color: var(--sun);
  border: 1px solid var(--sun); padding: 14px 40px;
  font-family: inherit; font-size: 13px; letter-spacing: 4px;
  cursor: pointer; text-transform: uppercase;
  transition: all 0.25s;
}
#title-card button:hover { background: var(--sun); color: #1a130c; }

/* ---------- Beat HUD ---------- */
#hud {
  position: fixed; top: 18px; left: 18px;
  pointer-events: none; user-select: none;
  color: rgba(244, 234, 211, 0.75); font-size: 11px;
  letter-spacing: 3px; text-transform: uppercase;
}
#hud .num { color: var(--sun); font-size: 14px; }
#controls {
  position: fixed; top: 18px; right: 18px;
  color: rgba(244, 234, 211, 0.5); font-size: 10px;
  letter-spacing: 2px; line-height: 1.8; text-align: right;
  pointer-events: none; user-select: none;
}
#controls kbd {
  background: rgba(244, 234, 211, 0.08);
  border: 1px solid rgba(244, 234, 211, 0.2);
  padding: 1px 6px; border-radius: 2px;
  font-family: inherit; font-size: 10px;
  color: var(--paper); margin: 0 1px;
}
#page-close {
  position: absolute; top: 8px; right: 10px;
  background: none; border: none; color: var(--accent);
  font-size: 14px; cursor: pointer; font-family: inherit;
  opacity: 0.5; padding: 4px 8px; line-height: 1;
  letter-spacing: 2px;
}
#page-close:hover { opacity: 1; }

/* ---------- The page panel (the book's open pages as UI) ---------- */
#page {
  position: fixed; left: 50%; bottom: 32px;
  transform: translateX(-50%) translateY(40px);
  width: min(860px, calc(100vw - 60px));
  background: linear-gradient(180deg, #f7eed8 0%, #efe3c5 100%);
  color: var(--ink); border-radius: 2px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(138, 58, 36, 0.15);
  padding: 0;
  opacity: 0; transition: all 0.7s cubic-bezier(0.22, 1, 0.36, 1);
  pointer-events: none;
  display: grid;
  grid-template-columns: 1fr 1px 1fr;
  min-height: 160px;
}
#page.show {
  opacity: 1; transform: translateX(-50%) translateY(0);
  pointer-events: auto;
}
#page.hidden {
  opacity: 0; transform: translateX(-50%) translateY(40px);
  pointer-events: none;
}
#book-toggle {
  position: fixed; right: 18px; bottom: 18px;
  z-index: 60;
  background: rgba(20, 14, 8, 0.82);
  border: 1px solid rgba(247, 227, 164, 0.35);
  color: var(--sun); font-family: inherit;
  font-size: 10px; letter-spacing: 3px; text-transform: uppercase;
  padding: 8px 14px; cursor: pointer; border-radius: 2px;
  transition: background 0.2s;
  display: none;
}
#book-toggle.show { display: inline-block; }
#book-toggle:hover { background: rgba(247, 227, 164, 0.15); }
#book-toggle kbd {
  background: rgba(244, 234, 211, 0.08);
  border: 1px solid rgba(244, 234, 211, 0.2);
  padding: 1px 5px; border-radius: 2px;
  font-family: inherit; font-size: 10px;
  color: var(--paper); margin-right: 6px;
}
#page::before {
  content: ''; position: absolute; inset: 6px;
  border: 1px solid rgba(138, 58, 36, 0.18);
  pointer-events: none; border-radius: 1px;
}
#page .spine {
  background: linear-gradient(90deg, rgba(138, 58, 36, 0), rgba(138, 58, 36, 0.35), rgba(138, 58, 36, 0));
  width: 1px; align-self: stretch;
}
#page .leaf { padding: 28px 34px 24px; }
#page .leaf.left .beat-label {
  font-size: 10px; letter-spacing: 5px; color: var(--accent);
  text-transform: uppercase; margin-bottom: 10px;
}
#page .leaf.left .beat-title {
  font-size: 22px; letter-spacing: 0.5px; line-height: 1.25;
  color: var(--ink); font-weight: 400; margin: 0 0 16px;
  font-style: italic;
}
#page .leaf.left .quote {
  font-size: 15px; line-height: 1.65; color: var(--ink);
  font-family: Georgia, serif;
  border-left: 2px solid var(--accent);
  padding: 4px 0 4px 14px;
  margin: 0;
}
#page .leaf.left .quote .hl {
  background: rgba(247, 227, 164, 0.75);
  padding: 0 2px; border-radius: 1px;
}
#page .leaf.right .gloss-label {
  font-size: 10px; letter-spacing: 5px; color: #7a6a4f;
  text-transform: uppercase; margin-bottom: 10px;
}
#page .leaf.right .gloss {
  font-size: 14px; line-height: 1.7; color: var(--ink);
  font-family: inherit;
}
#page .leaf.right .gloss em { font-style: italic; color: var(--accent); }
#page .footer {
  grid-column: 1 / -1;
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 24px 14px;
  border-top: 1px solid rgba(138, 58, 36, 0.18);
  font-size: 11px; color: #7a6a4f; letter-spacing: 1px;
}
#page .footer .advance {
  color: var(--accent); letter-spacing: 3px; text-transform: uppercase;
  font-weight: 600; font-size: 10px;
  animation: pulse 1.8s ease-in-out infinite;
}
@keyframes pulse { 0%,100% { opacity: 0.5 } 50% { opacity: 1 } }

/* ---------- Vignette overlay ---------- */
#vignette {
  position: fixed; inset: 0; pointer-events: none;
  background: radial-gradient(ellipse at center,
    transparent 40%, rgba(20, 14, 8, 0.35) 100%);
  z-index: 10;
}

/* ---------- Hotspot hover prompt ---------- */
#hotspot-prompt {
  position: fixed; top: 50%; left: 50%;
  transform: translate(-50%, 60px);
  padding: 6px 14px;
  background: rgba(20, 14, 8, 0.82);
  border: 1px solid rgba(247, 227, 164, 0.4);
  color: var(--sun); font-size: 11px; letter-spacing: 3px;
  text-transform: uppercase; border-radius: 2px;
  opacity: 0; transition: opacity 0.2s;
  pointer-events: none; z-index: 50;
}
#hotspot-prompt.show { opacity: 1; }

/* ---------- Card modal (for clicked hotspots) ---------- */
#card-modal {
  position: fixed; inset: 0; z-index: 180;
  background: rgba(12, 8, 4, 0.72);
  display: none; align-items: center; justify-content: center;
  padding: 40px; box-sizing: border-box;
  backdrop-filter: blur(2px);
}
#card-modal.show { display: flex; }
#card-modal .card {
  max-width: 520px; width: 100%;
  background: linear-gradient(180deg, #f7eed8 0%, #e8dab8 100%);
  color: var(--ink);
  border-radius: 3px;
  box-shadow: 0 30px 80px rgba(0,0,0,0.7);
  padding: 32px 36px 28px;
  position: relative;
  font-family: Georgia, serif;
}
#card-modal .card::before {
  content: ''; position: absolute; inset: 8px;
  border: 1px solid rgba(138, 58, 36, 0.22);
  pointer-events: none; border-radius: 2px;
}
#card-modal .card .close {
  position: absolute; top: 10px; right: 14px;
  background: none; border: none; color: var(--accent);
  font-size: 18px; cursor: pointer; font-family: inherit;
  opacity: 0.7;
}
#card-modal .card .close:hover { opacity: 1; }
#card-modal .card .title {
  font-size: 11px; letter-spacing: 4px; color: var(--accent);
  text-transform: uppercase; margin-bottom: 14px;
}
#card-modal .card .body {
  font-size: 16px; line-height: 1.7; color: var(--ink);
  border-left: 2px solid var(--accent); padding-left: 14px;
  font-style: italic; margin-bottom: 18px;
}
#card-modal .card .note {
  font-size: 13px; line-height: 1.65; color: #5a4430;
}
#card-modal .card .note::before { content: '✎ '; color: var(--accent); }

/* ---------- Ending card ---------- */
#ending {
  position: fixed; inset: 0; z-index: 250;
  background: radial-gradient(ellipse at center, #3a2818 0%, #0c0804 80%);
  display: none; flex-direction: column; align-items: center; justify-content: center;
  text-align: center; padding: 40px; box-sizing: border-box;
}
#ending.show { display: flex; }
#ending .eyebrow {
  font-size: 11px; letter-spacing: 6px; color: var(--sun);
  text-transform: uppercase; margin-bottom: 20px;
}
#ending .final {
  max-width: 640px; font-style: italic;
  font-size: 20px; line-height: 1.7; color: #f4ead3;
  margin-bottom: 36px;
}
#ending .reflect {
  max-width: 560px; color: #c9b894; line-height: 1.7;
  font-size: 14px; margin-bottom: 24px;
}
#ending textarea {
  width: min(520px, 90vw); min-height: 90px;
  background: rgba(244, 234, 211, 0.05);
  border: 1px solid rgba(247, 227, 164, 0.3);
  color: #f4ead3; padding: 12px 14px;
  font-family: inherit; font-size: 14px; line-height: 1.6;
  resize: vertical; border-radius: 2px;
  margin-bottom: 24px;
}
#ending .next-scene {
  display: none; margin-top: 18px;
  padding-top: 20px; border-top: 1px solid rgba(247, 227, 164, 0.18);
  color: #c9b894; font-size: 13px; line-height: 1.7;
  max-width: 520px;
}
#ending .next-scene.show { display: block; }
#ending .next-scene em { color: var(--sun); font-style: normal; }
#ending button {
  background: transparent; color: var(--sun);
  border: 1px solid var(--sun); padding: 12px 32px;
  font-family: inherit; font-size: 12px; letter-spacing: 4px;
  cursor: pointer; text-transform: uppercase; margin: 0 6px;
  transition: all 0.25s;
}
#ending button:hover { background: var(--sun); color: #1a130c; }
`;

const HTML = `
<div id="title-card">
  <div class="eyebrow" id="title-author"></div>
  <h1 id="title-h1"></h1>
  <div class="chapter" id="title-chapter"></div>
  <div class="intro" id="title-intro"></div>
  <button id="start-btn">Begin the walk</button>
</div>

<div id="vignette"></div>
<div id="hotspot-prompt">[Click] Examine</div>

<div id="hud" style="display:none">Beat <span class="num" id="beat-num">1</span> / <span id="beat-total">1</span></div>
<div id="controls" style="display:none">
  <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> walk &nbsp;·&nbsp;
  Arrows look<br>
  Walk up to the book to read &nbsp;·&nbsp;
  <kbd>Click</kbd> to examine<br>
  <kbd>Space</kbd> advance the book &nbsp;·&nbsp;
  <kbd>B</kbd> hide book
</div>

<div id="page">
  <button id="page-close" title="Hide book (B)">✕</button>
  <div class="leaf left">
    <div class="beat-label" id="beat-label"></div>
    <div class="beat-title" id="beat-title"></div>
    <blockquote class="quote" id="beat-quote"></blockquote>
  </div>
  <div class="spine"></div>
  <div class="leaf right">
    <div class="gloss-label">A note on what is happening</div>
    <div class="gloss" id="beat-gloss"></div>
  </div>
  <div class="footer">
    <span id="beat-cite"></span>
    <span class="advance">[Space] Continue ▸</span>
  </div>
</div>

<button id="book-toggle"><kbd>B</kbd>Open book</button>

<div id="card-modal">
  <div class="card">
    <button class="close" id="card-close">✕</button>
    <div class="title" id="card-title"></div>
    <div class="body" id="card-body"></div>
    <div class="note" id="card-note"></div>
  </div>
</div>

<div id="ending">
  <div class="eyebrow" id="ending-eyebrow">End of Scene</div>
  <div class="final" id="final-line"></div>
  <div class="reflect" id="ending-prompt"></div>
  <textarea id="final-reflection" placeholder="Write a few sentences…"></textarea>
  <div>
    <button id="save-btn">Save my response</button>
    <button id="restart-btn">Walk again</button>
  </div>
  <div class="next-scene" id="next-scene">
    <div id="next-scene-text">When you are ready, <em>continue to the next scene</em>.</div>
    <button id="next-scene-btn" style="margin-top: 14px;">Continue →</button>
  </div>
</div>
`;

let _mounted = false;
let _onRestart = null;
let _bookVisible = true;
// User explicitly hid the panel with B — overrides proximity reveal until next beat.
let _userDismissed = false;
// Proximity thresholds (meters, camera → guide book).
const NEAR = 2.6;
const FAR  = 3.6;

function $(id) { return document.getElementById(id); }

function hideBook() {
  const page = $('page');
  if (!page.classList.contains('show')) return; // nothing to hide
  page.classList.remove('show');
  _bookVisible = false;
  _userDismissed = true;
  $('book-toggle').classList.add('show');
}
function showBook() {
  const page = $('page');
  page.classList.add('show');
  page.classList.remove('hidden');
  _bookVisible = true;
  _userDismissed = false;
  $('book-toggle').classList.remove('show');
}
function toggleBook() { _bookVisible ? hideBook() : showBook(); }

export const BookUI = {
  /** Inject styles and DOM into the current page. Idempotent. */
  mount() {
    if (_mounted) return;
    const style = document.createElement('style');
    style.textContent = STYLES;
    document.head.appendChild(style);
    const wrap = document.createElement('div');
    wrap.innerHTML = HTML;
    document.body.appendChild(wrap);

    // Card close handlers
    $('card-close').addEventListener('click', () => BookUI.hideCard());
    $('card-modal').addEventListener('click', (e) => {
      if (e.target.id === 'card-modal') BookUI.hideCard();
    });

    // Book toggle — X button on the book, toggle button when hidden, B key
    $('page-close').addEventListener('click', hideBook);
    $('book-toggle').addEventListener('click', showBook);
    document.addEventListener('keydown', (e) => {
      if ((e.key === 'b' || e.key === 'B') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // Don't fire if the user is typing in the reflection textarea
        if (document.activeElement && document.activeElement.tagName === 'TEXTAREA') return;
        e.preventDefault();
        toggleBook();
      }
    });

    $('restart-btn').addEventListener('click', () => {
      // Always hide the ending overlay; scene-provided onRestart then replays
      // the beats. Fallback to location.reload() only when no handler is set
      // and the context allows it (some sandboxed iframes block reload).
      $('ending').classList.remove('show');
      $('final-reflection').value = '';
      if (_onRestart) {
        _onRestart();
      } else {
        try { location.reload(); } catch (e) { /* sandboxed iframe */ }
      }
    });

    $('save-btn').addEventListener('click', () => {
      const txt = $('final-reflection').value.trim();
      if (!txt) return;
      const blob = new Blob([txt], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'reflection.txt';
      a.click();
    });

    _mounted = true;
  },

  /**
   * Show the opening title card. Returns a promise that resolves when the
   * user clicks "Begin".
   *
   *   config: { author, title, chapter, intro, startLabel? }
   *   intro may contain HTML (em tags etc.)
   */
  showTitle(config) {
    $('title-author').textContent = config.author || '';
    $('title-h1').textContent = config.title || '';
    $('title-chapter').textContent = config.chapter || '';
    $('title-intro').innerHTML = config.intro || '';
    if (config.startLabel) $('start-btn').textContent = config.startLabel;
    return new Promise((resolve) => {
      $('start-btn').addEventListener('click', () => {
        $('title-card').classList.add('hide');
        $('hud').style.display = '';
        $('controls').style.display = '';
        setTimeout(() => { $('title-card').style.display = 'none'; resolve(); }, 1000);
      }, { once: true });
    });
  },

  /**
   * Set the content of the book panel for the current beat. Does NOT reveal
   * the panel — that's the job of updateProximity() (or showPanel() if the
   * scene wants to force it open).
   *
   *   beat: { label, title, text, gloss, cite? }
   */
  setBeat(beat, index = 0, total = 1) {
    $('ending').classList.remove('show');
    // On every beat change, clear the user-dismissed flag so proximity can
    // reveal the new content freely.
    _userDismissed = false;
    $('beat-num').textContent = (index + 1).toString();
    $('beat-total').textContent = total.toString();
    $('beat-label').textContent = beat.label || '';
    $('beat-title').textContent = beat.title || '';
    $('beat-quote').innerHTML = beat.text || beat.quote || '';
    $('beat-gloss').innerHTML = beat.gloss || '';
    $('beat-cite').textContent = beat.cite || '';
  },

  /**
   * Legacy: set content AND reveal panel immediately. Prefer setBeat + proximity
   * for the Stranger-style walk. Kept for scenes that want the sit-and-get flow.
   */
  showBeat(beat, index = 0, total = 1) {
    this.setBeat(beat, index, total);
    this.showPanel();
  },

  /** Explicitly reveal the panel (respects user-dismissed state). */
  showPanel() {
    if (_userDismissed) return;
    $('page').classList.add('show');
    $('page').classList.remove('hidden');
    _bookVisible = true;
  },

  /** Explicitly hide the panel (does NOT set the user-dismissed flag). */
  hidePanel() {
    $('page').classList.remove('show');
    _bookVisible = false;
  },

  /** Back-compat alias. */
  hideBeat() { this.hidePanel(); },

  /**
   * Per-frame proximity update. Call from the scene's render loop with:
   *   distance  — camera-to-guide-book distance in meters
   *   isSettled — true when the guide book is not currently tweening
   *
   * When the player is close (< NEAR) AND the book is settled, reveal the
   * panel. When the player walks away (> FAR), hide it. Debounced by the
   * two thresholds.
   */
  updateProximity(distance, isSettled) {
    if (_userDismissed) return;
    if (!isSettled) {
      // While the book is moving toward its next waypoint, keep the panel out
      // of the way so the student can see the book travel.
      if ($('page').classList.contains('show')) this.hidePanel();
      return;
    }
    const showing = $('page').classList.contains('show');
    if (!showing && distance < NEAR) this.showPanel();
    else if (showing && distance > FAR) this.hidePanel();
  },

  /**
   * Show an examinable-object card (called from a makeExaminable onClick).
   *
   *   card: { title, body, note? }
   *   body may contain HTML.
   */
  showCard(card) {
    $('card-title').textContent = card.title || '';
    $('card-body').innerHTML = card.body || '';
    const noteEl = $('card-note');
    if (card.note) {
      noteEl.innerHTML = card.note;
      noteEl.style.display = '';
    } else {
      noteEl.style.display = 'none';
    }
    $('card-modal').classList.add('show');
  },

  hideCard() { $('card-modal').classList.remove('show'); },

  /**
   * Show the ending reflection screen.
   *
   *   config: { finalLine, prompt, onRestart?, nextSceneUrl?, nextSceneLabel?, nextSceneText? }
   *   prompt may contain HTML.
   *   If nextSceneUrl is set, a "Continue →" button navigates there after the
   *   reflection block. nextSceneText (HTML) customizes the hint above the button.
   */
  showEnding(config) {
    $('final-line').textContent = config.finalLine || '';
    $('ending-prompt').innerHTML = config.prompt || '';
    if (config.eyebrow) $('ending-eyebrow').textContent = config.eyebrow;
    _onRestart = config.onRestart || null;

    const nextWrap = $('next-scene');
    if (config.nextSceneUrl) {
      if (config.nextSceneText) $('next-scene-text').innerHTML = config.nextSceneText;
      const btn = $('next-scene-btn');
      btn.textContent = config.nextSceneLabel || 'Continue →';
      btn.onclick = () => { window.location.href = config.nextSceneUrl; };
      nextWrap.classList.add('show');
    } else {
      nextWrap.classList.remove('show');
    }

    $('page').classList.remove('show');
    $('ending').classList.add('show');
  },
};
