#!/usr/bin/env node
/*
 * eval-guide-book.mjs
 *
 * Offline eval for the floating GuideBook. For each scene, we reproduce the
 * book's waypoint path and its registered collidables as AABB proxies, then
 * run the same multi-ray sweep that GuideBook.validatePath uses at runtime.
 *
 * If this passes, the in-browser ?eval=1 check will almost certainly pass too
 * (both use three.js Raycaster against static geometry).
 *
 * Run: node tools/eval-guide-book.mjs
 * Exits 0 on pass, 1 on fail.
 */
import * as THREE from 'three';

const BOOK_Y_OFFSET = 1.0;  // must match the scenes

// --- Scene definitions ------------------------------------------------------
// For each scene: the cameraLookAt per beat (used to compute book waypoints),
// and each collidable as a position + approximate size_m (matching the asset
// manifest) so we can build a representative bounding mesh.

const SCENES = {
  'hamlet-1-1': {
    beats: [
      { cameraLookAt: [0, 1.5, -1] },   // Beat I
      { cameraLookAt: [-3, 1.6, 1] },   // Beat II
      { cameraLookAt: [0, 1.6, -3] },   // Beat III
      { cameraLookAt: [0, 1.7, -3] },   // Beat IV
      { cameraLookAt: [0, 1, -2], bookPos: [0, 2.8, 0] },  // Beat V (explicit override)
    ],
    // Colliders: { name, position [x,y,z], rotationY (rad), size_m (for Y),
    //              widthApprox [xW, zW] = approximate post-fit X/Z extents in meters }
    colliders: [
      { name: 'wallL',    position: [-8, 0, -6],  rotationY: Math.PI / 2,  size_m: 2.5, widthApprox: [2.5, 0.4] },
      { name: 'wallR',    position: [8, 0, -6],   rotationY: -Math.PI / 2, size_m: 2.5, widthApprox: [2.5, 0.4] },
      { name: 'parapet',  position: [0, 0, -2],   rotationY: 0,            size_m: 2.0, widthApprox: [3.0, 1.0] },
      { name: 'tower',    position: [12, 0, -14], rotationY: 0,            size_m: 8.0, widthApprox: [4.0, 4.0] },
    ],
  },
  'hamlet-1-2': {
    beats: [
      { cameraLookAt: [0, 1.8, -4] },   // Beat I
      { cameraLookAt: [-3, 1.7, -1] },  // Beat II
      { cameraLookAt: [0, 2, -4] },     // Beat III
      { cameraLookAt: [4, 1.6, 1] },    // Beat IV
      { cameraLookAt: [-2, 1.7, 1] },   // Beat V
    ],
    colliders: [
      // backWall is a plane at z=-8, 30x10 — full hall-width rear barrier
      { name: 'backWall', position: [0, 5, -8],   rotationY: 0,            size_m: 10, widthApprox: [30.0, 0.2] },
      { name: 'tapestry', position: [0, 1.2, -7.5], rotationY: 0,          size_m: 2.0, widthApprox: [2.0, 0.2] },
      { name: 'arch',     position: [-9, 0, 2],   rotationY: Math.PI / 2,  size_m: 3.0, widthApprox: [2.5, 1.0] },
      { name: 'window1',  position: [-9, 2.5, -2], rotationY: Math.PI / 2, size_m: 1.8, widthApprox: [1.4, 0.2] },
      { name: 'portrait', position: [8, 2.8, 0],  rotationY: -Math.PI / 2, size_m: 0.8, widthApprox: [0.8, 0.1] },
      { name: 'armor',    position: [7.8, 0, 3],  rotationY: -Math.PI / 2.5, size_m: 1.8, widthApprox: [1.0, 1.0] },
    ],
  },
};

// --- Build scene graph ------------------------------------------------------

function buildCollidable({ name, position, rotationY, size_m, widthApprox }) {
  // Build a simple box that approximates the asset's post-fit bounding box.
  // Height = size_m. X/Z widths come from widthApprox (our estimate).
  // Book rays will be cast against this box.
  const geom = new THREE.BoxGeometry(widthApprox[0], size_m, widthApprox[1]);
  const mesh = new THREE.Mesh(geom);
  mesh.name = name;
  mesh.position.set(position[0], position[1] + size_m / 2, position[2]);
  mesh.rotation.y = rotationY;
  mesh.updateMatrixWorld(true);
  return mesh;
}

function waypointsFromBeats(beats) {
  return beats.map(b => b.bookPos || [b.cameraLookAt[0], b.cameraLookAt[1] + BOOK_Y_OFFSET, b.cameraLookAt[2]]);
}

// --- Path eval (same multi-ray sweep as GuideBook.validatePath) -------------

function evalPath(colliders, waypoints) {
  const halfExtent = 0.22;
  const raycaster = new THREE.Raycaster();
  const issues = [];

  for (let i = 0; i < waypoints.length - 1; i++) {
    const from = new THREE.Vector3(...waypoints[i]);
    const to = new THREE.Vector3(...waypoints[i + 1]);
    const segment = to.clone().sub(from);
    const dist = segment.length();
    if (dist < 0.01) continue;
    const dir = segment.clone().normalize();

    const up = new THREE.Vector3(0, 1, 0);
    const perp = new THREE.Vector3().crossVectors(dir, up);
    if (perp.lengthSq() < 1e-6) perp.set(1, 0, 0);
    perp.normalize();

    const offsets = [
      new THREE.Vector3(0, 0, 0),
      perp.clone().multiplyScalar(halfExtent),
      perp.clone().multiplyScalar(-halfExtent),
      new THREE.Vector3(0, halfExtent * 0.5, 0),
      new THREE.Vector3(0, -halfExtent * 0.5, 0),
    ];

    for (const offset of offsets) {
      const origin = from.clone().add(offset);
      raycaster.set(origin, dir);
      raycaster.far = dist;
      const hits = raycaster.intersectObjects(colliders, true);
      if (hits.length > 0) {
        const hit = hits[0];
        issues.push({
          from_beat: i + 1,
          to_beat: i + 2,
          distance: Number(hit.distance.toFixed(2)),
          hit_name: hit.object.name,
        });
        break;
      }
    }
  }
  return issues;
}

function runEvalForScene(sceneName, def) {
  console.log(`\n--- ${sceneName} ---`);
  const waypoints = waypointsFromBeats(def.beats);
  const colliders = def.colliders.map(buildCollidable);

  console.log(`  Waypoints (${waypoints.length}):`);
  waypoints.forEach((w, i) => console.log(`    ${i + 1}. [${w.join(', ')}]`));

  console.log(`  Colliders (${colliders.length}): ${colliders.map(c => c.name).join(', ')}`);

  const issues = evalPath(colliders, waypoints);
  if (issues.length === 0) {
    console.log(`  ✓ PASS — no path/collider intersections`);
    return { ok: true };
  } else {
    console.log(`  ✗ FAIL — ${issues.length} path collision(s):`);
    issues.forEach(iss => {
      console.log(`    • beat ${iss.from_beat} → ${iss.to_beat}: hits "${iss.hit_name}" at ${iss.distance}m`);
    });
    return { ok: false, issues };
  }
}

// --- Main ------------------------------------------------------------------

let anyFail = false;
for (const [name, def] of Object.entries(SCENES)) {
  const r = runEvalForScene(name, def);
  if (!r.ok) anyFail = true;
}

console.log('');
if (anyFail) {
  console.log('EVAL FAILED — fix collisions before committing.');
  process.exit(1);
} else {
  console.log('EVAL PASSED — all paths clear.');
  process.exit(0);
}
