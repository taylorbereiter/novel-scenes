/*
 * scene-loader.js
 *
 * Three.js setup helpers for novel-scenes. Creates a standard rendering rig
 * (ACES tone mapping, soft shadows, hemi + directional lighting, fog) and
 * exposes helpers for loading GLB assets from the repo's manifest and making
 * meshes examinable (click-to-reveal card).
 *
 * Usage (inside a scene's index.html, as ES module):
 *
 *   import * as THREE from 'three';
 *   import { createScene, loadAsset, makeExaminable } from '../../framework/scene-loader.js';
 *
 *   const { scene, camera, renderer, composer } = createScene();
 *   const skull = await loadAsset('graveyard-skull-01');
 *   skull.position.set(0, 0.5, -2);
 *   scene.add(skull);
 *   makeExaminable(skull, 'graveyard-skull', () => BookUI.showCard({ ... }));
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const REPO_BASE = 'https://cdn.jsdelivr.net/gh/taylorbereiter/novel-scenes@main/';
const MANIFEST_URL = REPO_BASE + 'manifest.json';

let _manifest = null;
const _loader = new GLTFLoader();

/**
 * Create the standard render rig. Returns { scene, camera, renderer, composer, sun, hemi }.
 * Pass options to override defaults.
 *
 *   opts.canvas        - an existing <canvas> element (defaults to #c)
 *   opts.skyColor      - scene background + fog color (default pale Algerian haze)
 *   opts.fogDensity    - FogExp2 density (default 0.022; use 0 to disable)
 *   opts.cameraPos     - initial [x,y,z] (default [0, 1.65, 6])
 *   opts.exposure      - toneMappingExposure (default 1.15)
 *   opts.bloom         - enable UnrealBloomPass (default true)
 */
export function createScene(opts = {}) {
  const canvas = opts.canvas || document.getElementById('c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = opts.exposure ?? 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const sky = opts.skyColor ?? 0xd9cfb8;
  scene.background = new THREE.Color(sky);
  if ((opts.fogDensity ?? 0.022) > 0) {
    scene.fog = new THREE.FogExp2(sky, opts.fogDensity ?? 0.022);
  }

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.05, 200);
  const [cx, cy, cz] = opts.cameraPos ?? [0, 1.65, 6];
  camera.position.set(cx, cy, cz);

  // Post-processing — bloom gives the sunlight a bit of glow
  let composer = null;
  if (opts.bloom !== false) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.6, 0.7, 0.85));
    composer.addPass(new OutputPass());
  }

  // Lighting — hazy midday key + warm ground bounce
  const hemi = new THREE.HemisphereLight(0xe8dcc0, 0xc9a070, 0.7);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff0cc, 2.0);
  sun.position.set(8, 18, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -30; sun.shadow.camera.right = 30;
  sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -30;
  sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 80;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);

  window.addEventListener('resize', () => {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    if (composer) composer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  });

  return { scene, camera, renderer, composer, sun, hemi };
}

/**
 * Fetch manifest.json once and cache it. Returns the asset record by id.
 */
async function getAsset(id) {
  if (!_manifest) {
    const res = await fetch(MANIFEST_URL);
    _manifest = await res.json();
  }
  const entry = _manifest.assets.find(a => a.id === id);
  if (!entry) throw new Error(`Asset not found in manifest: ${id}`);
  return entry;
}

/**
 * Fit a group to a target height (meters), and settle it on the ground plane.
 * Works regardless of the asset's native scale.
 */
export function fitToHeight(group, targetHeight) {
  const box = new THREE.Box3().setFromObject(group);
  const size = new THREE.Vector3();
  box.getSize(size);
  if (size.y <= 0) return;
  const scale = targetHeight / size.y;
  group.scale.setScalar(scale);
  const box2 = new THREE.Box3().setFromObject(group);
  group.position.y -= box2.min.y;
}

/**
 * Load a GLB asset by its manifest id. Returns the top-level THREE.Group.
 * Enables shadows on all child meshes. By default, auto-fits the group to
 * the manifest's size_m value — scenes almost never need to set scale manually.
 *
 *   opts.autoFit   - default true; if false, returns the asset at native scale
 *   opts.height    - override the manifest's size_m with a custom height
 */
export async function loadAsset(id, opts = {}) {
  const entry = await getAsset(id);
  const url = REPO_BASE + entry.path;
  const gltf = await _loader.loadAsync(url);
  const group = gltf.scene;
  group.traverse(obj => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
  group.userData.manifestId = id;
  group.userData.manifest = entry;

  const autoFit = opts.autoFit !== false;
  const targetHeight = opts.height ?? entry.size_m;
  if (autoFit && typeof targetHeight === 'number' && targetHeight > 0) {
    fitToHeight(group, targetHeight);
  }
  return group;
}

/**
 * Load multiple assets in parallel. Returns an object keyed by id.
 *
 *   const assets = await loadAssets(['graveyard-skull-01', 'graveyard-shovel-01']);
 *   scene.add(assets['graveyard-skull-01']);
 *
 * Accepts the same options object as loadAsset (applied to every asset).
 * For per-asset options, pass an object of { id: options }:
 *
 *   const assets = await loadAssets({
 *     'graveyard-skull-01': { height: 0.3 },
 *     'graveyard-shovel-01': {}
 *   });
 */
export async function loadAssets(ids, sharedOpts = {}) {
  if (Array.isArray(ids)) {
    const results = await Promise.all(ids.map(id => loadAsset(id, sharedOpts).then(g => [id, g])));
    return Object.fromEntries(results);
  }
  // Object form: per-asset options
  const entries = Object.entries(ids);
  const results = await Promise.all(entries.map(([id, o]) => loadAsset(id, { ...sharedOpts, ...o }).then(g => [id, g])));
  return Object.fromEntries(results);
}

/**
 * Search the manifest by tags or keywords. Returns all asset entries whose
 * tags, name, description, category, or use_cases contain any of the terms.
 * Useful when Claude Code is picking assets for a new scene.
 *
 *   const results = await searchAssets(['skull', 'bone']);
 */
export async function searchAssets(terms) {
  if (!_manifest) {
    const res = await fetch(MANIFEST_URL);
    _manifest = await res.json();
  }
  const lowered = terms.map(t => t.toLowerCase());
  return _manifest.assets.filter(a => {
    const hay = [
      ...(a.tags || []),
      a.name || '',
      a.description || '',
      a.category || '',
      ...(a.use_cases || []),
    ].join(' ').toLowerCase();
    return lowered.some(t => hay.includes(t));
  });
}

// Internal: a flat list of examinable meshes for the raycaster
const _examinables = [];
let _raycaster = null;
let _mouseNDC = null;
let _hoverPrompt = null;
let _activeCamera = null;

/**
 * Mark a three.js object (mesh or group) as examinable. When the user clicks
 * it, onClick() is invoked. Hover shows the #hotspot-prompt overlay if present.
 *
 * The object can be a single mesh or a Group — all descendent meshes are
 * registered so the raycaster catches any sub-mesh.
 */
export function makeExaminable(object, label, onClick) {
  object.userData.examineLabel = label;
  object.userData.onExamine = onClick;
  // Register every descendent mesh so the raycaster catches them
  object.traverse(child => {
    if (child.isMesh) {
      child.userData.examineRoot = object;
      _examinables.push(child);
    }
  });
}

/**
 * Hook up pointer events for examining. Call once per scene after you have
 * registered examinables. Requires the #hotspot-prompt element (provided by
 * book-ui.js) to be present for hover feedback, but works without it.
 */
export function enableExamination(camera, canvas) {
  _activeCamera = camera;
  _raycaster = new THREE.Raycaster();
  _mouseNDC = new THREE.Vector2();
  _hoverPrompt = document.getElementById('hotspot-prompt');
  canvas = canvas || document.getElementById('c');

  const setNDC = (e) => {
    _mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
    _mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
  };

  canvas.addEventListener('pointermove', (e) => {
    setNDC(e);
    _raycaster.setFromCamera(_mouseNDC, _activeCamera);
    const hits = _raycaster.intersectObjects(_examinables, true);
    if (hits.length > 0) {
      canvas.style.cursor = 'pointer';
      if (_hoverPrompt) _hoverPrompt.classList.add('show');
    } else {
      canvas.style.cursor = '';
      if (_hoverPrompt) _hoverPrompt.classList.remove('show');
    }
  });

  canvas.addEventListener('click', (e) => {
    setNDC(e);
    _raycaster.setFromCamera(_mouseNDC, _activeCamera);
    const hits = _raycaster.intersectObjects(_examinables, true);
    if (hits.length === 0) return;
    // Walk up to find the registered root
    let root = hits[0].object;
    while (root && !root.userData.onExamine) root = root.parent;
    if (root && typeof root.userData.onExamine === 'function') {
      root.userData.onExamine();
    }
  });
}

/**
 * Convenience: start a render loop with the given scene/camera/(composer).
 * Optionally accepts an onFrame(deltaSeconds) callback for per-frame updates.
 */
export function startRenderLoop({ scene, camera, renderer, composer, onFrame }) {
  const clock = new THREE.Clock();
  function tick() {
    const dt = clock.getDelta();
    if (onFrame) onFrame(dt);
    if (composer) composer.render();
    else renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  tick();
}
