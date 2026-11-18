// Solmar Heat — traffic: cars that loop the avenues around city blocks,
// stopping for the car ahead, so the streets always feel alive.

import { CITY, PALETTE } from './config.js';
import { makeCarMesh } from './vehicles.js';

export class TrafficSystem {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.cars = [];
    this._spawnFleet();
  }

  // A loop hugs the four roads around one block, one lane out from centre.
  _loopFor(blockX, blockZ, clockwise) {
    const off = 3.5;
    const x0 = blockX - CITY.PITCH / 2;
    const x1 = blockX + CITY.PITCH / 2;
    const z0 = blockZ - CITY.PITCH / 2;
    const z1 = blockZ + CITY.PITCH / 2;
    const pts = clockwise
      ? [[x0 + off, z0], [x1, z0 + off], [x1 - off, z1], [x0, z1 - off]]
      : [[x0 + off, z1], [x1, z1 - off], [x1 - off, z0], [x0, z0 + off]];
    // Expand each corner into a short approach so turns look smooth.
    const waypoints = [];
    for (let i = 0; i < pts.length; i += 1) {
      const [x, z] = pts[i];
      const [nx, nz] = pts[(i + 1) % pts.length];
      waypoints.push({ x, z });
      waypoints.push({ x: x + (nx - x) * 0.5, z: z + (nz - z) * 0.5 });
    }
    return waypoints;
  }

  _spawnFleet() {
    const blocks = [];
    for (const bx of CITY.BLOCK_CENTERS) {
      for (const bz of CITY.BLOCK_CENTERS) blocks.push([bx, bz]);
    }
    for (let i = 0; i < 14; i += 1) {
      const [bx, bz] = blocks[i % blocks.length];
      const clockwise = i % 2 === 0;
      const waypoints = this._loopFor(bx, bz, clockwise);
      const start = waypoints[(i * 3) % waypoints.length];
      const mesh = makeCarMesh(PALETTE.car[(i * 3 + 1) % PALETTE.car.length], 'sedan');
      const next = waypoints[((i * 3) + 1) % waypoints.length];
      mesh.position.set(start.x, 0, start.z);
      mesh.rotation.y = Math.atan2(next.x - start.x, next.z - start.z);
      this.scene.add(mesh);
      this.cars.push({
        mesh,
        waypoints,
        wp: ((i * 3) + 1) % waypoints.length,
        speed: 8 + (i % 4),
        heading: mesh.rotation.y,
        pos: new THREE.Vector3(start.x, 0, start.z),
      });
    }
  }

  // Is anything slow directly ahead of this car?
  _blockedAhead(car, others) {
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    for (const o of others) {
      const dx = o.pos.x - car.pos.x;
      const dz = o.pos.z - car.pos.z;
      const ahead = dx * fx + dz * fz;
      if (ahead > 0 && ahead < 9 && Math.abs(dx * fz - dz * fx) < 2.2) return true;
    }
    return false;
  }

  update(dt, blockers) {
    for (const car of this.cars) {
      const target = car.waypoints[car.wp];
      const dx = target.x - car.pos.x;
      const dz = target.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 3) {
        car.wp = (car.wp + 1) % car.waypoints.length;
        continue;
      }
      const wantHeading = Math.atan2(dx, dz);
      let diff = wantHeading - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      const blocked = this._blockedAhead(car, blockers);
      const speed = blocked ? 0 : car.speed;
      car.pos.x += Math.sin(car.heading) * speed * dt;
      car.pos.z += Math.cos(car.heading) * speed * dt;
      car.mesh.position.copy(car.pos);
      car.mesh.rotation.y = car.heading;
      const spin = (speed * dt) / 0.38;
      for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
    }
  }

  // Positions for the minimap and for traffic-aware police.
  positions() {
    return this.cars.map((c) => ({ x: c.pos.x, z: c.pos.z }));
  }
}
