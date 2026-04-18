/*
 * beat-engine.js
 *
 * Drives beat-by-beat progression through a scene. Each beat is an object with
 * text for the book panel, an optional camera position/lookAt, and optional
 * onEnter / onExit hooks for things like lighting changes or spawning props.
 *
 * Space advances to the next beat. Arrow keys are not handled here — if a scene
 * wants WASD movement it should add that itself.
 *
 * Usage:
 *
 *   import { BeatEngine } from '../../framework/beat-engine.js';
 *
 *   BeatEngine.init({
 *     camera,
 *     onBeat: (beat) => BookUI.showBeat(beat),
 *     onEnd: () => BookUI.showEnding({ ... })
 *   });
 *   BeatEngine.start([
 *     {
 *       label: 'Beat I · "Alas, poor Yorick"',
 *       title: 'Hamlet at the grave',
 *       text: 'The gravedigger has tossed up a skull...',
 *       cameraPos: [0, 1.65, 4],
 *       cameraLookAt: [0, 1.2, 0],
 *       onEnter: () => { ... }
 *     },
 *     ...
 *   ]);
 */

const state = {
  beats: [],
  index: 0,
  camera: null,
  onBeat: null,
  onEnd: null,
  keydownBound: false,
};

function smoothMoveCamera(camera, targetPos, targetLook, duration = 1.2) {
  // Simple tween: lerps position and lookAt over `duration` seconds.
  if (!targetPos && !targetLook) return;
  const startPos = camera.position.clone();
  const startLook = new THREE.Vector3();
  camera.getWorldDirection(startLook);
  startLook.add(camera.position);

  const endPos = targetPos ? new THREE.Vector3(...targetPos) : startPos.clone();
  const endLook = targetLook ? new THREE.Vector3(...targetLook) : startLook.clone();

  const t0 = performance.now();
  function step() {
    const t = Math.min(1, (performance.now() - t0) / (duration * 1000));
    // easeInOutCubic
    const k = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    camera.position.lerpVectors(startPos, endPos, k);
    const look = new THREE.Vector3().lerpVectors(startLook, endLook, k);
    camera.lookAt(look);
    if (t < 1) requestAnimationFrame(step);
  }
  step();
}

// We import three lazily so scenes that already have THREE on globalThis can use it
let THREE;
async function ensureTHREE() {
  if (!THREE) THREE = await import('three');
  globalThis.THREE = THREE;
}

function applyBeat(beat) {
  if (state.camera && (beat.cameraPos || beat.cameraLookAt)) {
    smoothMoveCamera(state.camera, beat.cameraPos, beat.cameraLookAt, beat.cameraDuration ?? 1.2);
  }
  if (beat.onEnter) beat.onEnter();
  if (state.onBeat) state.onBeat(beat, state.index, state.beats.length);
}

export const BeatEngine = {
  /**
   * Initialize with a camera (required if any beat uses cameraPos/cameraLookAt)
   * and two callbacks:
   *   onBeat(beat, index, total)  — called on every beat change
   *   onEnd()                     — called after the last beat advances
   */
  async init({ camera, onBeat, onEnd }) {
    await ensureTHREE();
    state.camera = camera;
    state.onBeat = onBeat;
    state.onEnd = onEnd;
    if (!state.keydownBound) {
      document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' || e.key === ' ') {
          e.preventDefault();
          BeatEngine.next();
        }
      });
      state.keydownBound = true;
    }
  },

  /** Start at beat 0. */
  start(beats) {
    state.beats = beats;
    state.index = 0;
    if (beats.length === 0) return;
    applyBeat(beats[0]);
  },

  /** Advance to the next beat, or call onEnd() if we're past the last one. */
  next() {
    if (state.index >= state.beats.length) return;
    const current = state.beats[state.index];
    if (current && current.onExit) current.onExit();
    state.index++;
    if (state.index >= state.beats.length) {
      if (state.onEnd) state.onEnd();
      return;
    }
    applyBeat(state.beats[state.index]);
  },

  /** Current beat object (or null if not started / past end). */
  current() {
    return state.beats[state.index] ?? null;
  },

  /** Current 1-indexed beat number, 0 if not started. */
  index() {
    return state.index;
  },
};
