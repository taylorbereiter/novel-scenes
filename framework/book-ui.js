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
  <kbd>Click</kbd> examine &nbsp;·&nbsp;
  <kbd>Space</kbd> continue
</div>

<div id="page">
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
</div>
`;

let _mounted = false;
let _onRestart = null;

function $(id) { return document.getElementById(id); }

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

    $('restart-btn').addEventListener('click', () => {
      if (_onRestart) _onRestart();
      else location.reload();
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
   * Show a beat page. Called by BeatEngine.onBeat.
   *
   *   beat: { label, title, text, cite? }
   *   note: the book-ui treats beat.text as the LEFT-page quote and beat.gloss
   *   as the RIGHT-page note. If gloss is omitted, the right leaf gets the
   *   continuation prompt only.
   */
  showBeat(beat, index = 0, total = 1) {
    $('beat-num').textContent = (index + 1).toString();
    $('beat-total').textContent = total.toString();
    $('beat-label').textContent = beat.label || '';
    $('beat-title').textContent = beat.title || '';
    $('beat-quote').innerHTML = beat.text || beat.quote || '';
    $('beat-gloss').innerHTML = beat.gloss || '';
    $('beat-cite').textContent = beat.cite || '';
    $('page').classList.add('show');
  },

  hideBeat() { $('page').classList.remove('show'); },

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
   *   config: { finalLine, prompt, onRestart? }
   *   prompt may contain HTML.
   */
  showEnding(config) {
    $('final-line').textContent = config.finalLine || '';
    $('ending-prompt').innerHTML = config.prompt || '';
    if (config.eyebrow) $('ending-eyebrow').textContent = config.eyebrow;
    _onRestart = config.onRestart || null;
    $('page').classList.remove('show');
    $('ending').classList.add('show');
  },
};
