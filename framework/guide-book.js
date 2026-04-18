/*
 * guide-book.js
 *
 * The floating 3D guidebook — a small glowing book that hovers in the scene
 * and leads students from beat to beat. Students follow it visually, the way
 * they would follow a pilot light.
 *
 * Usage:
 *
 *   import { GuideBook, runGuideBookEval } from '.../framework/guide-book.js';
 *
 *   const guideBook = new GuideBook(scene);
 *   guideBook.addCollidable(leftWall);
 *   guideBook.addCollidable(rightWall);
 *
 *   // One waypoint per beat, in scene coordinates. Defaults to the beat's
 *   // cameraLookAt lifted by 0.4m if the beat has no explicit bookPos.
 *   const WAYPOINTS = BEATS.map(b => b.bookPos || [b.cameraLookAt[0], b.cameraLookAt[1] + 0.4, b.cameraLookAt[2]]);
 *   guideBook.placeAt(WAYPOINTS[0]);
 *
 *   BeatEngine.init({
 *     camera,
 *     onBeat: (b, i) => { BookUI.showBeat(b, i, BEATS.length); guideBook.moveTo(WAYPOINTS[i]); },
 *     ...
 *   });
 *
 *   startRenderLoop({ scene, camera, renderer, composer, onFrame: (dt) => guideBook.update(dt) });
 *
 *   // Self-eval: append ?eval=1 to the URL to check the book's path
 *   // doesn't clip through any registered collider.
 *   if (new URLSearchParams(location.search).has('eval')) {
 *     window.__EVAL_RESULT = runGuideBookEval(guideBook, WAYPOINTS);
 *     showEvalBanner(window.__EVAL_RESULT);
 *   }
 */

import * as THREE from 'three';

export class GuideBook {
  constructor(scene, opts = {}) {
    const group = new THREE.Group();

    // Book cover — terracotta/ink, slight emissive so it glows faintly in dark scenes
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.07, 0.26),
      new THREE.MeshStandardMaterial({
        color: 0x8a3a24,
        emissive: 0x4a1a10, emissiveIntensity: 0.35,
        roughness: 0.55, metalness: 0.1,
      })
    );
    body.castShadow = true;
    group.add(body);

    // Gold page edge — thin glowing plate just above the cover
    const pages = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.04, 0.24),
      new THREE.MeshStandardMaterial({
        color: 0xf7e3a4, emissive: 0xf7e3a4, emissiveIntensity: 0.6,
      })
    );
    pages.position.y = 0.05;
    group.add(pages);

    // Warm companion light so the book reads as "lit"
    const glow = new THREE.PointLight(0xfff0cc, 1.4, 4, 1.8);
    glow.position.set(0, 0.2, 0);
    group.add(glow);

    this.mesh = group;
    this.mesh.name = 'GuideBook';
    scene.add(group);

    this.collidables = [];
    this._bobPhase = Math.random() * Math.PI * 2;
    this._position = new THREE.Vector3(0, 2, 0);
    this._tween = null;

    // Book geometry bounds (for path-swept collision check)
    // Half-extents — the book is ~0.17m radius-ish on the horizontal.
    this.halfExtent = 0.22;
  }

  /** Register an object (mesh or group) the book must not pass through. */
  addCollidable(obj) {
    if (obj) this.collidables.push(obj);
  }

  /** Teleport the book to a position. Used for the opening waypoint. */
  placeAt(pos) {
    this._position.set(pos[0], pos[1], pos[2]);
    this._tween = null;
  }

  /** Smoothly move the book to a new position. */
  moveTo(pos, duration = 1.8) {
    const target = new THREE.Vector3(pos[0], pos[1], pos[2]);
    this._tween = {
      from: this._position.clone(),
      to: target,
      t0: performance.now(),
      duration: duration * 1000,
    };
  }

  /** Distance from the camera (the player) to the guide book, in meters. */
  distanceToCamera(camera) {
    // Use this._position (the tweened target), not this.mesh.position, so the
    // bob/spin offsets don't create micro-oscillations at the threshold.
    return camera.position.distanceTo(this._position);
  }

  /** True when the book has finished moving to its current waypoint. */
  isSettled() {
    return this._tween === null;
  }

  /** Per-frame update. Call from the scene's render loop. */
  update(dt) {
    // Tween between waypoints
    if (this._tween) {
      const t = Math.min(1, (performance.now() - this._tween.t0) / this._tween.duration);
      // easeInOutCubic
      const k = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      this._position.lerpVectors(this._tween.from, this._tween.to, k);
      if (t >= 1) { this._position.copy(this._tween.to); this._tween = null; }
    }
    // Hover bob
    this._bobPhase += dt * 1.5;
    const bob = Math.sin(this._bobPhase) * 0.08;
    this.mesh.position.copy(this._position);
    this.mesh.position.y += bob;
    // Slow rotation
    this.mesh.rotation.y += dt * 0.35;
  }

  /**
   * Check that each straight-line path segment between the given waypoints
   * does not intersect any registered collidable. Uses a three-ray sweep
   * (center, left-offset, right-offset) to approximate the book's width.
   *
   * Returns { issues: [...] }. Empty issues = clean path.
   */
  validatePath(waypoints) {
    const issues = [];
    const raycaster = new THREE.Raycaster();
    const halfW = this.halfExtent;

    for (let i = 0; i < waypoints.length - 1; i++) {
      const from = new THREE.Vector3(...waypoints[i]);
      const to = new THREE.Vector3(...waypoints[i + 1]);
      const segment = to.clone().sub(from);
      const dist = segment.length();
      if (dist < 0.01) continue;
      const dir = segment.clone().normalize();

      // Horizontal perpendicular for the left/right offset rays (swept volume approx)
      const up = new THREE.Vector3(0, 1, 0);
      const perp = new THREE.Vector3().crossVectors(dir, up);
      if (perp.lengthSq() < 1e-6) perp.set(1, 0, 0); // degenerate when dir is vertical
      perp.normalize();

      const offsets = [
        new THREE.Vector3(0, 0, 0),
        perp.clone().multiplyScalar(halfW),
        perp.clone().multiplyScalar(-halfW),
        new THREE.Vector3(0, halfW * 0.5, 0),
        new THREE.Vector3(0, -halfW * 0.5, 0),
      ];

      for (const offset of offsets) {
        const origin = from.clone().add(offset);
        raycaster.set(origin, dir);
        raycaster.far = dist;
        const hits = raycaster.intersectObjects(this.collidables, true);
        if (hits.length > 0) {
          const hit = hits[0];
          issues.push({
            from_beat: i + 1,
            to_beat: i + 2,
            distance: Number(hit.distance.toFixed(2)),
            hit_name: hit.object.name || (hit.object.userData && hit.object.userData.examineLabel) || 'unnamed',
            offset: [offset.x.toFixed(2), offset.y.toFixed(2), offset.z.toFixed(2)].join(','),
          });
          break; // One hit per segment is enough — stop sampling rays for this segment
        }
      }
    }
    return issues;
  }
}

/**
 * Run a set of checks on the guide book + waypoints. Returns a pass/fail
 * report. Suitable for an eval banner or a CI check.
 */
export function runGuideBookEval(guideBook, waypoints) {
  const report = { passes: [], failures: [] };

  if (!guideBook || !guideBook.mesh) {
    report.failures.push('guide book does not exist in scene');
    return report;
  }
  report.passes.push('guide book exists');

  if (!Array.isArray(waypoints) || waypoints.length < 2) {
    report.failures.push(`waypoints invalid: expected array of 2+, got ${waypoints && waypoints.length}`);
    return report;
  }
  report.passes.push(`${waypoints.length} waypoints provided`);

  // All waypoints should be at or above ~0.5m (book should float, not be on floor)
  const lowWaypoints = waypoints
    .map((w, i) => ({ i, y: w[1] }))
    .filter(x => x.y < 0.5);
  if (lowWaypoints.length > 0) {
    lowWaypoints.forEach(lw => report.failures.push(`waypoint ${lw.i + 1} y=${lw.y} below 0.5m`));
  } else {
    report.passes.push('all waypoints above 0.5m');
  }

  // Waypoints should be within a reasonable playable bounding region
  const BOUND = 30;
  const outside = waypoints
    .map((w, i) => ({ i, x: w[0], z: w[2] }))
    .filter(x => Math.abs(x.x) > BOUND || Math.abs(x.z) > BOUND);
  if (outside.length > 0) {
    outside.forEach(o => report.failures.push(`waypoint ${o.i + 1} outside ±${BOUND}m region: (${o.x}, ${o.z})`));
  } else {
    report.passes.push(`all waypoints within ±${BOUND}m region`);
  }

  // Path collision — the important one
  const pathIssues = guideBook.validatePath(waypoints);
  if (pathIssues.length === 0) {
    report.passes.push('no path-collider intersections');
  } else {
    pathIssues.forEach(pi => {
      report.failures.push(`path beat ${pi.from_beat} → ${pi.to_beat} intersects "${pi.hit_name}" at ${pi.distance}m (offset ${pi.offset})`);
    });
  }

  report.ok = report.failures.length === 0;
  return report;
}

/**
 * Show an on-screen banner with the eval result. Use in ?eval=1 mode.
 */
export function showEvalBanner(report) {
  const div = document.createElement('div');
  div.id = 'eval-banner';
  div.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0;
    z-index: 9999; padding: 14px 18px;
    font-family: Menlo, Consolas, monospace; font-size: 12px;
    color: #fff; white-space: pre-wrap; line-height: 1.5;
    max-height: 50vh; overflow: auto;
    border-bottom: 2px solid rgba(0,0,0,0.3);
  `;
  if (report.ok) {
    div.style.background = '#2e5a2e';
    div.textContent = 'EVAL PASS ✓\n  ' + report.passes.join('\n  ');
  } else {
    div.style.background = '#8a2e1a';
    div.textContent = 'EVAL FAIL ✗\n  PASSES:\n    ' + report.passes.join('\n    ')
      + '\n  FAILURES:\n    ' + report.failures.join('\n    ');
  }
  document.body.appendChild(div);
}
