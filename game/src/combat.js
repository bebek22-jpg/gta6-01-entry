// Solmar Heat — combat: the pistol (hitscan with tracer and muzzle flash),
// the punch, and the Coral Kings gang members who shoot back.

import { PLAYER_TUNING } from './config.js';
import { makePersonMesh } from './pedestrians.js';

export class CombatSystem {
  constructor(scene, world, player, sound) {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.sound = sound;
    this.enemies = [];
    this.tracers = [];
    this.extraTargets = []; // mission vehicles etc: {kind, ref, pos, radius}
    this.shootCooldown = 0;
    this.muzzle = this._makeMuzzleFlash();
    this.muzzleTimer = 0;
    this.onEnemyKilled = null;
    this.onPedShot = null;
    this.onCopShot = null;
  }

  _makeMuzzleFlash() {
    const flash = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 0.7),
      new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false }),
    );
    flash.visible = false;
    this.scene.add(flash);
    return flash;
  }

  spawnGang(x, z, count, spread = 6) {
    const spawned = [];
    for (let i = 0; i < count; i += 1) {
      const px = x + (Math.random() - 0.5) * spread * 2;
      const pz = z + (Math.random() - 0.5) * spread * 2;
      const pos = new THREE.Vector3(px, 0, pz);
      this.world.collideCircle(pos, 0.5);
      const mesh = makePersonMesh(0x8e44ad, 0x1a252f, SKIN[i % SKIN.length]);
      mesh.position.copy(pos);
      this.scene.add(mesh);
      const enemy = {
        mesh, pos, heading: Math.atan2(this.player.pos.x - pos.x, this.player.pos.z - pos.z),
        health: 100, alive: true, shootTimer: 0.6 + Math.random(), phase: Math.random() * 6,
      };
      this.enemies.push(enemy);
      spawned.push(enemy);
    }
    return spawned;
  }

  clearEnemies() {
    for (const e of this.enemies) this.scene.remove(e.mesh);
    this.enemies = [];
  }

  aliveEnemies() {
    return this.enemies.filter((e) => e.alive);
  }

  // Ray-sphere test: the nearest target the bullet crosses.
  _raycast(origin, dir, maxDist, targets) {
    let best = null;
    let bestT = maxDist;
    for (const t of targets) {
      const cx = t.pos.x - origin.x;
      const cy = (t.pos.y + 1.2) - origin.y;
      const cz = t.pos.z - origin.z;
      const along = cx * dir.x + cy * dir.y + cz * dir.z;
      if (along < 0 || along > bestT) continue;
      const px = origin.x + dir.x * along;
      const py = origin.y + dir.y * along;
      const pz = origin.z + dir.z * along;
      const d = Math.hypot(px - t.pos.x, py - (t.pos.y + 1.2), pz - t.pos.z);
      const radius = t.radius || 1.0;
      if (d < radius) { best = t; bestT = along; }
    }
    return best ? { target: best, dist: bestT } : null;
  }

  shootPistol(camera, peds, police) {
    if (this.shootCooldown > 0 || this.player.inCar) return false;
    this.shootCooldown = PLAYER_TUNING.pistolCooldown;
    const origin = this.player.pos.clone().add(new THREE.Vector3(0, 1.5, 0));
    const dir = this.player.aimDirection(camera);
    const targets = [];
    for (const e of this.enemies) if (e.alive) targets.push({ kind: 'enemy', ref: e, pos: e.pos, radius: 1.0 });
    for (const ped of peds.peds) if (ped.alive) targets.push({ kind: 'ped', ref: ped, pos: ped.pos, radius: 0.9 });
    for (const cop of police.cops) if (cop.alive) targets.push({ kind: 'cop', ref: cop, pos: cop.pos, radius: 1.0 });
    for (const car of police.cars) targets.push({ kind: 'policeCar', ref: car, pos: car.pos, radius: 2.2 });
    for (const t of this.extraTargets) targets.push(t);
    const hit = this._raycast(origin, dir, PLAYER_TUNING.pistolRange, targets);
    const end = origin.clone().addScaledVector(dir, hit ? hit.dist : PLAYER_TUNING.pistolRange);
    this._spawnTracer(origin, end);
    this.muzzle.position.copy(origin).addScaledVector(dir, 0.9);
    this.muzzle.lookAt(camera.position);
    this.muzzle.visible = true;
    this.muzzleTimer = 0.06;
    this.sound.gunshot();
    if (hit) {
      const { kind, ref } = hit.target;
      if (kind === 'enemy') {
        ref.health -= PLAYER_TUNING.pistolDamage;
        if (ref.health <= 0) this._killEnemy(ref);
      } else if (kind === 'ped') {
        peds.knockDown(ref);
        if (this.onPedShot) this.onPedShot(ref);
      } else if (kind === 'cop') {
        ref.health -= PLAYER_TUNING.pistolDamage;
        if (ref.health <= 0) {
          ref.alive = false;
          ref.mesh.rotation.x = Math.PI / 2;
          if (this.onCopShot) this.onCopShot(ref);
        }
      } else if (kind === 'policeCar') {
        ref.health -= PLAYER_TUNING.pistolDamage * 0.5;
      } else if (kind === 'courier') {
        ref.health -= PLAYER_TUNING.pistolDamage * 0.6;
      }
    }
    return true;
  }

  _killEnemy(enemy) {
    enemy.alive = false;
    enemy.mesh.rotation.x = Math.PI / 2;
    enemy.mesh.position.y = 0.45;
    // Drop a little cash where they fall.
    const drop = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.3, 0.6),
      new THREE.MeshLambertMaterial({ color: 0x2ecc71 }),
    );
    drop.position.set(enemy.pos.x, 0.4, enemy.pos.z);
    this.scene.add(drop);
    enemy.drop = drop;
    if (this.onEnemyKilled) this.onEnemyKilled(enemy);
  }

  punch(peds, police) {
    if (!this.player.punch()) return false;
    this.sound.punch();
    const px = this.player.pos.x + Math.sin(this.player.heading) * 1.4;
    const pz = this.player.pos.z + Math.cos(this.player.heading) * 1.4;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (Math.hypot(e.pos.x - px, e.pos.z - pz) < PLAYER_TUNING.punchRange) {
        e.health -= PLAYER_TUNING.punchDamage;
        e.pos.x += Math.sin(this.player.heading) * 0.8;
        e.pos.z += Math.cos(this.player.heading) * 0.8;
        if (e.health <= 0) this._killEnemy(e);
        return true;
      }
    }
    const ped = peds.nearestTo(px, pz, PLAYER_TUNING.punchRange);
    if (ped) {
      peds.knockDown(ped);
      if (this.onPedShot) this.onPedShot(ped);
      return true;
    }
    return true;
  }

  _spawnTracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.9 }));
    this.scene.add(line);
    this.tracers.push({ line, life: 0.08 });
  }

  // Enemy gang members advance, shoot, and miss a lot on purpose.
  update(dt, time) {
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    this.muzzleTimer -= dt;
    if (this.muzzleTimer <= 0) this.muzzle.visible = false;
    for (let i = this.tracers.length - 1; i >= 0; i -= 1) {
      this.tracers[i].life -= dt;
      if (this.tracers[i].life <= 0) {
        this.scene.remove(this.tracers[i].line);
        this.tracers.splice(i, 1);
      }
    }
    const pp = this.player.inCar ? this.player.vehicle.pos : this.player.pos;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = pp.x - e.pos.x;
      const dz = pp.z - e.pos.z;
      const dist = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      let diff = want - e.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      e.heading += Math.max(-3.5 * dt, Math.min(3.5 * dt, diff));
      if (dist > 22 && dist < 70) {
        e.pos.x += Math.sin(e.heading) * 3.4 * dt;
        e.pos.z += Math.cos(e.heading) * 3.4 * dt;
        this.world.collideCircle(e.pos, 0.5);
        e.phase += dt * 7;
        const swing = Math.sin(e.phase) * 0.5;
        e.mesh.userData.legs[0].rotation.x = swing;
        e.mesh.userData.legs[1].rotation.x = -swing;
      }
      e.mesh.position.copy(e.pos);
      e.mesh.rotation.y = e.heading;
      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && dist < 48 && dist > 2) {
        e.shootTimer = 0.9 + Math.random() * 0.8;
        const from = e.pos.clone().add(new THREE.Vector3(0, 1.5, 0));
        const to = pp.clone().add(new THREE.Vector3(0, 1.2, 0));
        this._spawnTracer(from, to);
        this.sound.gunshot();
        // Rough aim: about half the shots connect.
        if (Math.random() < 0.45) {
          this.player.damage(8 + Math.random() * 5, time);
        }
      }
    }
  }

  blips() {
    return this.enemies.filter((e) => e.alive).map((e) => ({ x: e.pos.x, z: e.pos.z, kind: 'enemy' }));
  }
}

const SKIN = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524];
