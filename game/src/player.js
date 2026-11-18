// Solmar Heat — the player: Kai Moreno on foot, with a third-person orbit
// camera, sprint and jump, and getting in and out of cars.

import { PLAYER_TUNING } from './config.js';
import { makePersonMesh } from './pedestrians.js';

export class Player {
  constructor(scene, world, startX, startZ) {
    this.scene = scene;
    this.world = world;
    this.mesh = makePersonMesh(0x2e86c1, 0x1a252f, 0xe0ac69);
    this.mesh.scale.setScalar(1.08);
    scene.add(this.mesh);
    this.pos = new THREE.Vector3(startX, 0, startZ);
    this.velY = 0;
    this.grounded = true;
    this.heading = Math.PI;
    this.health = PLAYER_TUNING.maxHealth;
    this.lastHurtAt = -99;
    this.walkPhase = 0;
    this.moving = false;
    this.sprinting = false;
    this.vehicle = null;
    this.punchTimer = 0;
    this.punchAnim = 0;
    // Orbit camera state.
    this.camYaw = Math.PI;
    this.camPitch = 0.32;
    this.camDist = 8.5;
    this.camPos = new THREE.Vector3(startX, 4, startZ + 8);
    this.lastDragAt = -99;
    this.mesh.position.copy(this.pos);
  }

  get inCar() { return this.vehicle !== null; }
  get speed() { return this.inCar ? Math.abs(this.vehicle.speed) : (this.moving ? (this.sprinting ? PLAYER_TUNING.sprintSpeed : PLAYER_TUNING.walkSpeed) : 0); }

  damage(amount, time) {
    this.health = Math.max(0, this.health - amount);
    this.lastHurtAt = time;
  }

  heal(amount) {
    this.health = Math.min(PLAYER_TUNING.maxHealth, this.health + amount);
  }

  enterCar(vehicle, sound) {
    this.vehicle = vehicle;
    this.mesh.visible = false;
    this.camDist = 11.5;
    if (sound) sound.doorSlam();
  }

  exitCar(sound) {
    if (!this.vehicle) return;
    const v = this.vehicle;
    const side = new THREE.Vector3(Math.cos(v.heading), 0, -Math.sin(v.heading));
    this.pos.set(v.pos.x + side.x * 2.2, 0, v.pos.z + side.z * 2.2);
    this.world.collideCircle(this.pos, PLAYER_TUNING.radius);
    this.vehicle = null;
    this.mesh.visible = true;
    this.mesh.position.copy(this.pos);
    this.camDist = 8.5;
    if (sound) sound.doorSlam();
  }

  // On-foot movement, relative to the camera yaw.
  updateOnFoot(dt, input, time) {
    const axes = input.moveAxes();
    this.moving = axes.x !== 0 || axes.y !== 0;
    this.sprinting = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = this.sprinting ? PLAYER_TUNING.sprintSpeed : PLAYER_TUNING.walkSpeed;
    if (this.moving) {
      const fwd = new THREE.Vector3(Math.sin(this.camYaw), 0, Math.cos(this.camYaw));
      const right = new THREE.Vector3(fwd.z, 0, -fwd.x);
      const move = new THREE.Vector3()
        .addScaledVector(fwd, axes.y)
        .addScaledVector(right, axes.x)
        .normalize();
      this.pos.addScaledVector(move, speed * dt);
      const want = Math.atan2(move.x, move.z);
      let diff = want - this.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.heading += Math.max(-10 * dt, Math.min(10 * dt, diff));
      this.walkPhase += dt * speed * 1.9;
    }
    if (input.wasPressed('Space') && this.grounded) {
      this.velY = PLAYER_TUNING.jumpSpeed;
      this.grounded = false;
    }
    this.velY -= PLAYER_TUNING.gravity * dt;
    this.pos.y += this.velY * dt;
    if (this.pos.y <= 0) {
      this.pos.y = 0;
      this.velY = 0;
      this.grounded = true;
    }
    this.world.collideCircle(this.pos, PLAYER_TUNING.radius);
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
    // Walk cycle; a punch swings the right arm instead.
    this.punchAnim = Math.max(0, this.punchAnim - dt * 3);
    const swing = this.moving ? Math.sin(this.walkPhase) * 0.6 : 0;
    this.mesh.userData.legs[0].rotation.x = swing;
    this.mesh.userData.legs[1].rotation.x = -swing;
    this.mesh.userData.arms[0].rotation.x = -swing * 0.7;
    this.mesh.userData.arms[1].rotation.x = this.punchAnim > 0 ? -Math.sin(this.punchAnim * Math.PI) * 1.6 : swing * 0.7;
    // Slow health regen out of combat.
    if (time - this.lastHurtAt > PLAYER_TUNING.regenDelay && this.health > 0 && this.health < PLAYER_TUNING.maxHealth) {
      this.health = Math.min(PLAYER_TUNING.maxHealth, this.health + PLAYER_TUNING.regenRate * dt);
    }
  }

  punch() {
    if (this.punchTimer > 0) return false;
    this.punchTimer = PLAYER_TUNING.punchCooldown;
    this.punchAnim = 1;
    return true;
  }

  tickTimers(dt) {
    this.punchTimer = Math.max(0, this.punchTimer - dt);
  }

  // Orbit the camera with the mouse drag; wheel zooms.
  updateCameraInput(input, time) {
    const drag = input.takeDrag();
    if (drag.x !== 0 || drag.y !== 0) {
      this.camYaw -= drag.x * 0.0042;
      this.camPitch = Math.max(0.08, Math.min(1.15, this.camPitch + drag.y * 0.0032));
      this.lastDragAt = time;
    }
    const wheel = input.takeWheel();
    if (wheel !== 0) {
      const max = this.inCar ? 15 : 12;
      this.camDist = Math.max(5, Math.min(max, this.camDist + wheel * 0.8));
    }
  }

  // Place the camera behind the player or the car, smoothing every move.
  updateCamera(dt, time, camera) {
    if (this.inCar && time - this.lastDragAt > 2.5) {
      // Ease the camera behind the car's heading when the player is not dragging.
      let diff = this.vehicle.heading - this.camYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.camYaw += diff * Math.min(1, dt * 1.4);
    }
    const target = this.inCar ? this.vehicle.pos : this.pos;
    const eyeHeight = this.inCar ? 2.2 : 1.9;
    const dist = this.camDist;
    const cx = target.x - Math.sin(this.camYaw) * Math.cos(this.camPitch) * dist;
    const cz = target.z - Math.cos(this.camYaw) * Math.cos(this.camPitch) * dist;
    const cy = target.y + eyeHeight + Math.sin(this.camPitch) * dist;
    const k = Math.min(1, dt * 7);
    this.camPos.x += (cx - this.camPos.x) * k;
    this.camPos.y += (cy - this.camPos.y) * k;
    this.camPos.z += (cz - this.camPos.z) * k;
    if (this.camPos.y < 1.1) this.camPos.y = 1.1;
    camera.position.copy(this.camPos);
    camera.lookAt(target.x, target.y + 1.6, target.z);
  }

  // Where the pistol aims: straight ahead from the camera's view.
  aimDirection(camera) {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    return dir;
  }
}
