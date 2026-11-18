// Solmar Heat — the wanted system: stars, pursuing police cars that ram,
// foot cops who close in, losing the heat, and getting busted.

import { WANTED } from './config.js';
import { makeCarMesh, Vehicle } from './vehicles.js';
import { makePersonMesh } from './pedestrians.js';

export class PoliceSystem {
  constructor(scene, world, player, sound) {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.sound = sound;
    this.stars = 0;
    this.cars = [];
    this.cops = [];
    this.hiddenTimer = 0;
    this.bustedTimer = 0;
    this.flashTimer = 0;
    this.spawnCooldown = 0;
    this.onBusted = null;
  }

  addStars(n, reason) {
    const before = this.stars;
    this.stars = Math.min(WANTED.maxStars, this.stars + n);
    if (this.stars > before) this.hiddenTimer = 0;
    return this.stars;
  }

  clearWanted() {
    this.stars = 0;
    this.hiddenTimer = 0;
    this._removeAllUnits();
  }

  _removeAllUnits() {
    for (const c of this.cars) this.scene.remove(c.mesh);
    for (const c of this.cops) this.scene.remove(c.mesh);
    this.cars = [];
    this.cops = [];
  }

  _spawnCar() {
    const p = this.player.inCar ? this.player.vehicle.pos : this.player.pos;
    // Spawn on a road near the player, never inside a building.
    let x = p.x;
    let z = p.z;
    for (let tries = 0; tries < 8; tries += 1) {
      const a = Math.random() * Math.PI * 2;
      const r = 38 + Math.random() * 30;
      const rp = this.world.nearestRoadPoint(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r);
      x = rp.x;
      z = rp.z;
      if (Math.hypot(x - p.x, z - p.z) > 30) break;
    }
    const mesh = makeCarMesh(0xf5f5f5, 'police');
    const heading = Math.atan2(p.x - x, p.z - z);
    const car = new Vehicle(mesh, x, z, heading, 'police');
    car.stuckTimer = 0;
    car.reverseTimer = 0;
    this.scene.add(mesh);
    this.cars.push(car);
  }

  _spawnCop() {
    const p = this.player.pos;
    const a = Math.random() * Math.PI * 2;
    const r = 18 + Math.random() * 14;
    const pos = new THREE.Vector3(p.x + Math.cos(a) * r, 0, p.z + Math.sin(a) * r);
    this.world.collideCircle(pos, 0.5);
    const mesh = makePersonMesh(0x1a2a4a, 0x14181d, 0xc68642);
    mesh.position.copy(pos);
    this.scene.add(mesh);
    this.cops.push({
      mesh, pos, heading: Math.atan2(p.x - pos.x, p.z - pos.z),
      speed: 6.4, phase: Math.random() * 6, alive: true, health: 100,
    });
  }

  _wantedCarCount() {
    return Math.min(4, this.stars);
  }

  _wantedCopCount() {
    if (this.player.inCar) return 0;
    return this.stars >= 2 ? Math.min(3, this.stars - 1) : 0;
  }

  // Distance from the player to the nearest police unit.
  nearestPoliceDistance() {
    const p = this.player.inCar ? this.player.vehicle.pos : this.player.pos;
    let best = Infinity;
    for (const c of this.cars) best = Math.min(best, Math.hypot(c.pos.x - p.x, c.pos.z - p.z));
    for (const c of this.cops) if (c.alive) best = Math.min(best, Math.hypot(c.pos.x - p.x, c.pos.z - p.z));
    return best;
  }

  update(dt, time) {
    this.spawnCooldown -= dt;
    this.flashTimer += dt;
    if (this.stars > 0) {
      while (this.cars.length < this._wantedCarCount() && this.spawnCooldown <= 0) {
        this._spawnCar();
        this.spawnCooldown = 1.2;
      }
      while (this.cops.filter((c) => c.alive).length < this._wantedCopCount() && this.spawnCooldown <= 0) {
        this._spawnCop();
        this.spawnCooldown = 1.0;
      }
      // Losing the heat: stay far from every unit and the stars fade.
      if (this.nearestPoliceDistance() > WANTED.hideDistance) {
        this.hiddenTimer += dt;
        if (this.hiddenTimer > WANTED.decaySeconds) {
          this.stars -= 1;
          this.hiddenTimer = 0;
          if (this.stars === 0) this._removeAllUnits();
        }
      } else {
        this.hiddenTimer = 0;
      }
    }
    this._updateCars(dt, time);
    this._updateCops(dt, time);
  }

  _updateCars(dt, time) {
    const target = this.player.inCar ? this.player.vehicle.pos : this.player.pos;
    const targetVel = this.player.inCar ? this.player.vehicle.velocity : new THREE.Vector3();
    const flash = Math.sin(this.flashTimer * 10) > 0;
    for (const car of this.cars) {
      // Flash the light bar.
      if (car.mesh.userData.lightRed) {
        car.mesh.userData.lightRed.visible = flash;
        car.mesh.userData.lightBlue.visible = !flash;
      }
      // Aim slightly ahead of the target, like a real pursuit.
      const aimX = target.x + targetVel.x * 0.5;
      const aimZ = target.z + targetVel.z * 0.5;
      const dx = aimX - car.pos.x;
      const dz = aimZ - car.pos.z;
      const dist = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      let diff = want - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, diff * 1.6));
      // Unstick: if barely moving while trying, reverse and turn.
      if (Math.abs(car.speed) < 1 && dist > 4) car.stuckTimer += dt;
      else car.stuckTimer = 0;
      if (car.stuckTimer > 1.2) { car.reverseTimer = 0.9; car.stuckTimer = 0; }
      let throttle = 1;
      let steerIn = steer;
      if (car.reverseTimer > 0) {
        car.reverseTimer -= dt;
        throttle = -1;
        steerIn = -steer;
      }
      const res = car.drive(dt, throttle, steerIn, false, this.world);
      if (res.crashed && res.impact > 3) {
        // Ramming the player hurts; ramming a wall just slows the cruiser.
        if (dist < 6) {
          this.player.damage(4, time);
          this.sound.crash();
        }
      }
      // A hard ram on the player's car damages it too.
      if (this.player.inCar && dist < 3.4 && Math.abs(car.speed) > 8) {
        this.player.vehicle.health -= 6 * dt * 10;
      }
    }
    // Wrecked cruisers stay as smoking obstacles for a while, then despawn.
    for (let i = this.cars.length - 1; i >= 0; i -= 1) {
      if (this.cars[i].health <= 0) {
        this.scene.remove(this.cars[i].mesh);
        this.cars.splice(i, 1);
      }
    }
  }

  _updateCops(dt, time) {
    const p = this.player.pos;
    let touching = false;
    for (const cop of this.cops) {
      if (!cop.alive) continue;
      const dx = p.x - cop.pos.x;
      const dz = p.z - cop.pos.z;
      const dist = Math.hypot(dx, dz);
      if (this.player.inCar || dist > 90) {
        // Cops give up a chase they cannot win and jog back to the street.
        continue;
      }
      const want = Math.atan2(dx, dz);
      let diff = want - cop.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      cop.heading += Math.max(-4 * dt, Math.min(4 * dt, diff));
      const speed = dist > 3 ? cop.speed : 0;
      cop.pos.x += Math.sin(cop.heading) * speed * dt;
      cop.pos.z += Math.cos(cop.heading) * speed * dt;
      this.world.collideCircle(cop.pos, 0.5);
      cop.mesh.position.copy(cop.pos);
      cop.mesh.rotation.y = cop.heading;
      cop.phase += dt * speed * 2.2;
      const swing = Math.sin(cop.phase) * 0.55;
      cop.mesh.userData.legs[0].rotation.x = swing;
      cop.mesh.userData.legs[1].rotation.x = -swing;
      if (dist < 2.2 && this.player.speed < 1.5) touching = true;
    }
    // Busted: a cop holds the player still for two seconds.
    if (touching && !this.player.inCar && this.stars > 0) {
      this.bustedTimer += dt;
      if (this.bustedTimer > 2 && this.onBusted) this.onBusted();
    } else {
      this.bustedTimer = 0;
    }
  }

  // Cops and cruisers for the minimap.
  blips() {
    const out = [];
    for (const c of this.cars) out.push({ x: c.pos.x, z: c.pos.z, kind: 'police' });
    for (const c of this.cops) if (c.alive) out.push({ x: c.pos.x, z: c.pos.z, kind: 'police' });
    return out;
  }
}
