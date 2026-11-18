// Solmar Heat — pedestrians: sidewalk walkers with a simple walk cycle who
// stroll the blocks and run when gunfire or a chase gets too close.

import { CITY } from './config.js';

const SHIRTS = [0xe74c3c, 0x3498db, 0xf1c40f, 0x2ecc71, 0x9b59b6, 0xe67e22, 0x1abc9c, 0xecf0f1];
const PANTS = [0x2c3e50, 0x34495e, 0x7f8c8d, 0x5d4037, 0x1a252f];
const SKINS = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];

export function makePersonMesh(shirt, pants, skin) {
  const group = new THREE.Group();
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.75, 0.34), shirtMat);
  torso.position.y = 1.12;
  torso.castShadow = true;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.32), skinMat);
  head.position.y = 1.72;
  head.castShadow = true;
  group.add(torso, head);
  const legs = [];
  for (const sx of [-0.16, 0.16]) {
    const leg = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.28), pantsMat);
    mesh.position.y = -0.36;
    leg.add(mesh);
    leg.position.set(sx, 0.78, 0);
    group.add(leg);
    legs.push(leg);
  }
  const arms = [];
  for (const sx of [-0.42, 0.42]) {
    const arm = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.22), shirtMat);
    mesh.position.y = -0.31;
    arm.add(mesh);
    arm.position.set(sx, 1.44, 0);
    group.add(arm);
    arms.push(arm);
  }
  group.userData.legs = legs;
  group.userData.arms = arms;
  return group;
}

export class PedestrianSystem {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.peds = [];
    this.panicAt = null; // {x, z, until} — gunfire or chaos point
    this._spawnCrowd();
  }

  _sidewalkRing(blockX, blockZ) {
    const r = CITY.PITCH / 2 - CITY.ROAD_HALF - 1.5;
    return [
      { x: blockX - r, z: blockZ - r }, { x: blockX + r, z: blockZ - r },
      { x: blockX + r, z: blockZ + r }, { x: blockX - r, z: blockZ + r },
    ];
  }

  _spawnCrowd() {
    const blocks = [];
    for (const bx of CITY.BLOCK_CENTERS) {
      for (const bz of CITY.BLOCK_CENTERS) blocks.push([bx, bz]);
    }
    for (let i = 0; i < 26; i += 1) {
      const [bx, bz] = blocks[i % blocks.length];
      const ring = this._sidewalkRing(bx, bz);
      const start = ring[i % 4];
      const mesh = makePersonMesh(
        SHIRTS[i % SHIRTS.length],
        PANTS[(i * 2) % PANTS.length],
        SKINS[i % SKINS.length],
      );
      mesh.position.set(start.x, 0.3, start.z);
      this.scene.add(mesh);
      this.peds.push({
        mesh,
        ring,
        wp: (i % 4) + 1 < 4 ? (i % 4) + 1 : 0,
        speed: 1.3 + (i % 5) * 0.25,
        heading: Math.atan2(ring[(i % 4) + 1 < 4 ? (i % 4) + 1 : 0].x - start.x, ring[(i % 4) + 1 < 4 ? (i % 4) + 1 : 0].z - start.z),
        pos: new THREE.Vector3(start.x, 0.3, start.z),
        phase: Math.random() * Math.PI * 2,
        fleeing: false,
        alive: true,
      });
    }
  }

  panic(x, z, seconds = 6) {
    this.panicAt = { x, z, until: performance.now() / 1000 + seconds };
  }

  update(dt, time) {
    const panicking = this.panicAt && time < this.panicAt.until;
    for (const ped of this.peds) {
      if (!ped.alive) continue;
      let speed = ped.speed;
      if (panicking) {
        const dx = ped.pos.x - this.panicAt.x;
        const dz = ped.pos.z - this.panicAt.z;
        const d = Math.hypot(dx, dz);
        if (d < 45) {
          ped.fleeing = true;
          speed = 5.5;
          const want = Math.atan2(dx, dz);
          let diff = want - ped.heading;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          ped.heading += Math.max(-4 * dt, Math.min(4 * dt, diff));
        } else {
          ped.fleeing = false;
        }
      } else {
        ped.fleeing = false;
      }
      if (!ped.fleeing) {
        const target = ped.ring[ped.wp];
        const dx = target.x - ped.pos.x;
        const dz = target.z - ped.pos.z;
        if (Math.hypot(dx, dz) < 1.5) {
          ped.wp = (ped.wp + 1) % ped.ring.length;
        } else {
          const want = Math.atan2(dx, dz);
          let diff = want - ped.heading;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          ped.heading += Math.max(-3 * dt, Math.min(3 * dt, diff));
        }
      }
      ped.pos.x += Math.sin(ped.heading) * speed * dt;
      ped.pos.z += Math.cos(ped.heading) * speed * dt;
      this.world.collideCircle(ped.pos, 0.5);
      ped.pos.y = 0.3;
      ped.mesh.position.copy(ped.pos);
      ped.mesh.rotation.y = ped.heading;
      ped.phase += dt * speed * 2.4;
      const swing = Math.sin(ped.phase) * 0.55;
      ped.mesh.userData.legs[0].rotation.x = swing;
      ped.mesh.userData.legs[1].rotation.x = -swing;
      ped.mesh.userData.arms[0].rotation.x = -swing * 0.7;
      ped.mesh.userData.arms[1].rotation.x = swing * 0.7;
    }
  }

  // A pedestrian hit by a car or a bullet falls and stays down.
  knockDown(ped) {
    if (!ped.alive) return;
    ped.alive = false;
    ped.mesh.rotation.x = Math.PI / 2;
    ped.mesh.position.y = 0.45;
    ped.mesh.userData.legs[0].rotation.x = 0;
    ped.mesh.userData.legs[1].rotation.x = 0;
    setTimeout(() => {
      if (!this.peds.includes(ped)) return;
      ped.alive = true;
      ped.mesh.rotation.x = 0;
      ped.mesh.position.y = 0.3;
    }, 20000);
  }

  nearestTo(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const ped of this.peds) {
      if (!ped.alive) continue;
      const d = Math.hypot(ped.pos.x - x, ped.pos.z - z);
      if (d < bestD) { bestD = d; best = ped; }
    }
    return best;
  }
}
