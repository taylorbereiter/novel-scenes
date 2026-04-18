/*
 * player-controls.js
 *
 * Simple WASD + arrow-key movement for the student's camera. Students walk
 * at their own pace between beats, guided by the floating GuideBook. Includes
 * collision against registered colliders so walls don't get walked through.
 *
 * Usage:
 *
 *   import { PlayerControls } from '.../framework/player-controls.js';
 *
 *   const controls = new PlayerControls(camera, {
 *     colliders: [wallL, wallR, parapet, tower],
 *     bounds: { x: [-30, 30], z: [-30, 30] },
 *   });
 *
 *   startRenderLoop({
 *     scene, camera, renderer, composer,
 *     onFrame: (dt) => { controls.update(dt); guideBook.update(dt); }
 *   });
 *
 * Controls:
 *   W         — walk forward (direction camera is facing, horizontal only)
 *   S         — walk backward
 *   A         — strafe left
 *   D         — strafe right
 *   ↑ / ↓     — look up / down (pitch)
 *   ← / →     — look left / right (yaw)
 *   Shift     — run (1.8× speed)
 *   B         — (handled by book-ui) toggle the book panel
 *   Space     — (handled by beat-engine) advance beat
 */

import * as THREE from 'three';

const MOVEMENT_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ShiftLeft', 'ShiftRight',
]);
const LOOK_KEYS = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
]);

export class PlayerControls {
  constructor(camera, opts = {}) {
    this.camera = camera;
    this.walkSpeed = opts.walkSpeed ?? 3.5;       // m/s
    this.runSpeed  = opts.runSpeed  ?? 6.5;
    this.colliders = opts.colliders ?? [];
    this.bounds    = opts.bounds    ?? { x: [-30, 30], z: [-30, 30] };
    this.collisionBuffer = opts.collisionBuffer ?? 0.6;  // m — keep this far from walls
    this.enabled = true;
    this.lookSpeed = opts.lookSpeed ?? 1.6;       // rad/s
    this.pitchLimit = opts.pitchLimit ?? 1.1;      // ~63°, so you can't flip over

    this._keys = new Set();
    this._raycaster = new THREE.Raycaster();
    // Seed yaw/pitch from the camera's current orientation so an initial
    // lookAt() is preserved when arrow keys first fire.
    const e = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
    this._yaw = e.y;
    this._pitch = e.x;
    this._applyLook();
    this._bindKeys();
  }

  _bindKeys() {
    document.addEventListener('keydown', (e) => {
      if (MOVEMENT_KEYS.has(e.code)) {
        this._keys.add(e.code);
        return;
      }
      if (LOOK_KEYS.has(e.code)) {
        this._keys.add(e.code);
        e.preventDefault();  // stop the page from scrolling
      }
    });
    document.addEventListener('keyup', (e) => {
      this._keys.delete(e.code);
    });
    window.addEventListener('blur', () => this._keys.clear());
  }

  _applyLook() {
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this._yaw;
    this.camera.rotation.x = this._pitch;
    this.camera.rotation.z = 0;
  }

  addCollider(obj) {
    if (obj) this.colliders.push(obj);
  }

  /** Per-frame update. Call from the render loop with delta seconds. */
  update(dt) {
    if (!this.enabled || dt <= 0) return;

    // --- Look (arrow keys) ---
    const look = this.lookSpeed * Math.min(dt, 0.05);
    let lookChanged = false;
    if (this._keys.has('ArrowLeft'))  { this._yaw   += look;       lookChanged = true; }
    if (this._keys.has('ArrowRight')) { this._yaw   -= look;       lookChanged = true; }
    if (this._keys.has('ArrowUp'))    { this._pitch += look * 0.7; lookChanged = true; }
    if (this._keys.has('ArrowDown'))  { this._pitch -= look * 0.7; lookChanged = true; }
    if (lookChanged) {
      this._pitch = Math.max(-this.pitchLimit, Math.min(this.pitchLimit, this._pitch));
      this._applyLook();
    }

    const running = this._keys.has('ShiftLeft') || this._keys.has('ShiftRight');
    const speed = running ? this.runSpeed : this.walkSpeed;
    const stepLen = speed * Math.min(dt, 0.05);

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) return;
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    const move = new THREE.Vector3();
    if (this._keys.has('KeyW')) move.add(forward);
    if (this._keys.has('KeyS')) move.sub(forward);
    if (this._keys.has('KeyD')) move.add(right);
    if (this._keys.has('KeyA')) move.sub(right);
    if (move.lengthSq() === 0) return;

    move.normalize().multiplyScalar(stepLen);

    // Try moving X and Z independently so sliding along walls feels right.
    const origin = this.camera.position.clone();

    // --- X component ---
    if (Math.abs(move.x) > 1e-6) {
      const dirX = new THREE.Vector3(Math.sign(move.x), 0, 0);
      if (this._canMove(origin, dirX, Math.abs(move.x))) {
        origin.x += move.x;
      }
    }
    // --- Z component ---
    if (Math.abs(move.z) > 1e-6) {
      const dirZ = new THREE.Vector3(0, 0, Math.sign(move.z));
      if (this._canMove(origin, dirZ, Math.abs(move.z))) {
        origin.z += move.z;
      }
    }

    // World bounds
    origin.x = Math.max(this.bounds.x[0], Math.min(this.bounds.x[1], origin.x));
    origin.z = Math.max(this.bounds.z[0], Math.min(this.bounds.z[1], origin.z));

    this.camera.position.copy(origin);
  }

  _canMove(from, dir, dist) {
    if (this.colliders.length === 0) return true;
    this._raycaster.set(from, dir);
    this._raycaster.far = dist + this.collisionBuffer;
    const hits = this._raycaster.intersectObjects(this.colliders, true);
    return hits.length === 0 || hits[0].distance > dist + this.collisionBuffer;
  }
}
