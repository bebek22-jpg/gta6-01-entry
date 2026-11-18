// Solmar Heat — the city of Solmar Bay, built procedurally at load.
// A 5x5 avenue grid with canvas-textured buildings, a park, a beachfront,
// palms, streetlights, a distant skyline, and the cash pickups hidden in it.

import { CITY, PALETTE } from './config.js';

function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// A facade texture: window grid on a neutral wall, tinted per building by
// the material colour. A few windows glow warm, as if lit from inside.
function makeFacadeTexture(rand, litRatio) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#e8e2d4';
  ctx.fillRect(0, 0, 128, 256);
  for (let row = 0; row < 12; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      const x = 8 + col * 23;
      const y = 10 + row * 20;
      const lit = rand() < litRatio;
      ctx.fillStyle = lit ? '#ffd98a' : '#5a6d7d';
      ctx.fillRect(x, y, 15, 12);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(x, y + 10, 15, 2);
    }
  }
  // Ground-floor shopfront band.
  ctx.fillStyle = '#7a6a55';
  ctx.fillRect(0, 232, 128, 24);
  ctx.fillStyle = '#ffe9b0';
  for (let i = 0; i < 4; i += 1) ctx.fillRect(8 + i * 31, 236, 24, 16);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  return tex;
}

// A flat sign texture with the venue's name in bold letters.
function makeSignTexture(text, bg, fg) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 48;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 48);
  ctx.fillStyle = fg;
  ctx.font = 'bold 26px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 26);
  return new THREE.CanvasTexture(canvas);
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];
    this.pickups = [];
    this.rand = seededRandom(20261118);
    this.facades = [0, 1, 2, 3].map(() => makeFacadeTexture(this.rand, 0.22));
    this.water = null;
    this.waveLine = null;
    this._buildLights();
    this._buildGround();
    this._buildRoads();
    this._buildBlocks();
    this._buildBeach();
    this._buildSkyline();
    this._buildPickups();
  }

  _buildLights() {
    this.scene.background = new THREE.Color(PALETTE.sky);
    this.scene.fog = new THREE.Fog(PALETTE.fog, 170, 430);
    const sun = new THREE.DirectionalLight(PALETTE.sun, 1.35);
    sun.position.set(140, 200, 90);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -190;
    sun.shadow.camera.right = 190;
    sun.shadow.camera.top = 190;
    sun.shadow.camera.bottom = -190;
    sun.shadow.camera.far = 600;
    sun.shadow.bias = -0.0006;
    this.scene.add(sun);
    this.scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.85));
  }

  _buildGround() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(CITY.GROUND_SIZE, CITY.GROUND_SIZE),
      new THREE.MeshLambertMaterial({ color: PALETTE.ground }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  _buildRoads() {
    const asphalt = new THREE.MeshLambertMaterial({ color: PALETTE.asphalt });
    const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5e9c8 });
    const span = CITY.EDGE * 2;
    for (const line of CITY.ROAD_LINES) {
      const v = new THREE.Mesh(new THREE.PlaneGeometry(CITY.ROAD_HALF * 2, span), asphalt);
      v.rotation.x = -Math.PI / 2;
      v.position.set(line, 0.02, 0);
      v.receiveShadow = true;
      this.scene.add(v);
      const h = new THREE.Mesh(new THREE.PlaneGeometry(span, CITY.ROAD_HALF * 2), asphalt);
      h.rotation.x = -Math.PI / 2;
      h.position.set(0, 0.02, line);
      h.receiveShadow = true;
      this.scene.add(h);
      // Dashed centre lines.
      for (let d = -CITY.EDGE + 8; d < CITY.EDGE - 4; d += 12) {
        const dv = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 5), dashMat);
        dv.rotation.x = -Math.PI / 2;
        dv.position.set(line, 0.05, d);
        this.scene.add(dv);
        const dh = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.5), dashMat);
        dh.rotation.x = -Math.PI / 2;
        dh.position.set(d, 0.05, line);
        this.scene.add(dh);
      }
    }
    // Sidewalk slabs, one per block, slightly raised.
    const slabSize = CITY.PITCH - CITY.ROAD_HALF * 2 + CITY.SIDEWALK * 2;
    for (const cx of CITY.BLOCK_CENTERS) {
      for (const cz of CITY.BLOCK_CENTERS) {
        const slab = new THREE.Mesh(new THREE.BoxGeometry(slabSize, 0.3, slabSize), walkMat);
        slab.position.set(cx, 0.15, cz);
        slab.receiveShadow = true;
        this.scene.add(slab);
      }
    }
    this._buildStreetlights();
  }

  _buildStreetlights() {
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x4a4f55 });
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
    const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 7, 6);
    const armGeo = new THREE.BoxGeometry(2.2, 0.12, 0.12);
    const lampGeo = new THREE.SphereGeometry(0.3, 8, 6);
    for (const x of CITY.ROAD_LINES) {
      for (const z of CITY.ROAD_LINES) {
        const lamp = new THREE.Group();
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.y = 3.5;
        const arm = new THREE.Mesh(armGeo, poleMat);
        arm.position.set(0.9, 6.9, 0);
        const bulb = new THREE.Mesh(lampGeo, lampMat);
        bulb.position.set(1.9, 6.8, 0);
        lamp.add(pole, arm, bulb);
        lamp.position.set(x + CITY.ROAD_HALF + 1.5, 0, z + CITY.ROAD_HALF + 1.5);
        lamp.rotation.y = this.rand() * Math.PI * 2;
        this.scene.add(lamp);
      }
    }
  }

  _addBuilding(cx, cz, w, d, h, sign) {
    const facade = this.facades[Math.floor(this.rand() * this.facades.length)];
    const tint = PALETTE.building[Math.floor(this.rand() * PALETTE.building.length)];
    const side = new THREE.MeshLambertMaterial({ map: facade, color: tint });
    const roof = new THREE.MeshLambertMaterial({ color: 0x6b6257 });
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      [side, side, roof, roof, side, side],
    );
    mesh.position.set(cx, h / 2 + 0.3, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    if (sign) {
      const signMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(Math.min(w * 0.8, 16), 2.4),
        new THREE.MeshBasicMaterial({ map: makeSignTexture(sign.text, sign.bg, sign.fg) }),
      );
      signMesh.position.set(cx, Math.min(h, 14) + 0.3, cz + d / 2 + 0.1);
      this.scene.add(signMesh);
    }
    // Rooftop box, for skyline variety.
    if (h > 18 && this.rand() < 0.6) {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.35, 3, d * 0.35),
        new THREE.MeshLambertMaterial({ color: 0x8a8074 }),
      );
      box.position.set(cx + w * 0.2, h + 1.8, cz - d * 0.15);
      box.castShadow = true;
      this.scene.add(box);
    }
    this.colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
    return mesh;
  }

  _addTree(x, z, palm) {
    const group = new THREE.Group();
    const trunkMat = new THREE.MeshLambertMaterial({ color: palm ? 0x8a6a48 : 0x6b4f35 });
    const leafMat = new THREE.MeshLambertMaterial({ color: palm ? 0x3f9e4d : 0x4e8f3a });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, palm ? 5.5 : 2.6, 6), trunkMat);
    trunk.position.y = palm ? 2.75 : 1.3;
    trunk.castShadow = true;
    group.add(trunk);
    if (palm) {
      for (let i = 0; i < 6; i += 1) {
        const frond = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.4, 4), leafMat);
        const a = (i / 6) * Math.PI * 2;
        frond.position.set(Math.cos(a) * 1.1, 5.6, Math.sin(a) * 1.1);
        frond.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
        frond.castShadow = true;
        group.add(frond);
      }
    } else {
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(2.1, 0), leafMat);
      crown.position.y = 4.2;
      crown.castShadow = true;
      group.add(crown);
    }
    group.position.set(x, 0.3, z);
    this.scene.add(group);
  }

  _buildBlocks() {
    const signs = [
      { text: 'HOTEL LUMINA', bg: '#1d4e89', fg: '#ffffff' },
      { text: 'DINER', bg: '#c0392b', fg: '#ffe9b0' },
      { text: 'MARKET', bg: '#1e8449', fg: '#ffffff' },
      { text: 'GARAGE', bg: '#2c3e50', fg: '#f1c40f' },
      { text: 'CINEMA', bg: '#6c3483', fg: '#ffffff' },
      { text: 'SURF SHOP', bg: '#117a65', fg: '#ffffff' },
    ];
    let signIndex = 0;
    for (const cx of CITY.BLOCK_CENTERS) {
      for (const cz of CITY.BLOCK_CENTERS) {
        // The north-west block is Coral Park: trees and lawn, no buildings.
        if (cx === -90 && cz === -90) {
          for (let i = 0; i < 14; i += 1) {
            this._addTree(cx + (this.rand() - 0.5) * 32, cz + (this.rand() - 0.5) * 32, false);
          }
          const pond = new THREE.Mesh(
            new THREE.CircleGeometry(6, 20),
            new THREE.MeshLambertMaterial({ color: PALETTE.water }),
          );
          pond.rotation.x = -Math.PI / 2;
          pond.position.set(cx, 0.32, cz);
          this.scene.add(pond);
          continue;
        }
        const dist = Math.hypot(cx, cz);
        const tall = 26 + this.rand() * 22 - dist * 0.08;
        const layout = this.rand();
        if (layout < 0.4) {
          const sign = signs[signIndex % signs.length];
          signIndex += 1;
          this._addBuilding(cx, cz, 26, 26, Math.max(12, tall), sign);
        } else if (layout < 0.75) {
          this._addBuilding(cx - 8, cz, 15, 26, Math.max(10, tall * 0.7), null);
          this._addBuilding(cx + 9, cz, 13, 26, Math.max(9, tall * 0.55), null);
        } else {
          for (const ox of [-9, 9]) {
            for (const oz of [-9, 9]) {
              this._addBuilding(cx + ox, cz + oz, 14, 14, 8 + this.rand() * 10, null);
            }
          }
        }
        // Corner trees on every block.
        for (const ox of [-17, 17]) {
          for (const oz of [-17, 17]) {
            if (this.rand() < 0.6) this._addTree(cx + ox, cz + oz, this.rand() < 0.4);
          }
        }
      }
    }
  }

  _buildBeach() {
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(CITY.GROUND_SIZE, CITY.WATER_START - CITY.BEACH_START + 6),
      new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.04, (CITY.BEACH_START + CITY.WATER_START) / 2);
    sand.receiveShadow = true;
    this.scene.add(sand);
    // Boardwalk along the sand's north edge.
    const walk = new THREE.Mesh(
      new THREE.BoxGeometry(CITY.GROUND_SIZE, 0.25, 6),
      new THREE.MeshLambertMaterial({ color: 0xc8a878 }),
    );
    walk.position.set(0, 0.12, CITY.BEACH_START + 1);
    this.scene.add(walk);
    for (let x = -180; x <= 180; x += 18) this._addTree(x, CITY.BEACH_START + 6, true);
    // The bay itself.
    this.water = new THREE.Mesh(
      new THREE.PlaneGeometry(CITY.GROUND_SIZE, CITY.GROUND_SIZE - CITY.WATER_START),
      new THREE.MeshLambertMaterial({ color: PALETTE.water, transparent: true, opacity: 0.92 }),
    );
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.set(0, 0.06, CITY.WATER_START + (CITY.GROUND_SIZE - CITY.WATER_START) / 2);
    this.scene.add(this.water);
    this.waveLine = new THREE.Mesh(
      new THREE.PlaneGeometry(CITY.GROUND_SIZE, 1.6),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }),
    );
    this.waveLine.rotation.x = -Math.PI / 2;
    this.waveLine.position.set(0, 0.09, CITY.WATER_START);
    this.scene.add(this.waveLine);
  }

  _buildSkyline() {
    // Distant towers and hills frame the city so the horizon is never empty.
    const mat = new THREE.MeshLambertMaterial({ color: 0x7fa8c4 });
    for (let i = 0; i < 26; i += 1) {
      const a = (i / 26) * Math.PI * 2;
      if (Math.sin(a) > 0.55) continue; // keep the bay open to the south
      const r = 235 + this.rand() * 60;
      const h = 25 + this.rand() * 55;
      const tower = new THREE.Mesh(new THREE.BoxGeometry(18 + this.rand() * 14, h, 18), mat);
      tower.position.set(Math.cos(a) * r, h / 2 - 2, Math.sin(a) * r);
      this.scene.add(tower);
    }
    const hillMat = new THREE.MeshLambertMaterial({ color: 0x7fa06a });
    for (let i = 0; i < 5; i += 1) {
      const hill = new THREE.Mesh(new THREE.ConeGeometry(70 + this.rand() * 40, 26 + this.rand() * 18, 7), hillMat);
      hill.position.set(-260 + i * 130, 0, -240 - this.rand() * 40);
      this.scene.add(hill);
    }
  }

  _buildPickups() {
    const spots = [
      [-30, -30], [30, -90], [90, -30], [-90, 30], [30, 30], [90, 90],
      [-30, 90], [-90, -30], [0, -120], [120, 0], [-120, 60], [60, 150],
    ];
    const cashMat = new THREE.MeshLambertMaterial({ color: 0x2ecc71 });
    const bandMat = new THREE.MeshLambertMaterial({ color: 0xf1f5f8 });
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.22, depthWrite: false });
    for (const [x, z] of spots) {
      const group = new THREE.Group();
      const stack = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 0.7), cashMat);
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.55, 0.75), bandMat);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 9, 10, 1, true), beamMat);
      beam.position.y = 4.5;
      stack.position.y = 1.2;
      band.position.y = 1.2;
      group.add(stack, band, beam);
      group.position.set(x, 0.3, z);
      this.scene.add(group);
      this.pickups.push({ group, x, z, taken: false, respawn: 0, value: 50 });
    }
  }

  // Push a circle (x, z, radius) out of every building it overlaps.
  collideCircle(pos, radius) {
    for (const c of this.colliders) {
      const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
      const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
      const dx = pos.x - nx;
      const dz = pos.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) continue;
      if (d2 < 1e-6) {
        pos.x = c.maxX + radius;
        continue;
      }
      const d = Math.sqrt(d2);
      pos.x = nx + (dx / d) * radius;
      pos.z = nz + (dz / d) * radius;
    }
    // Keep everything inside the world; the bay is not drivable.
    const lim = CITY.EDGE + 26;
    pos.x = Math.max(-lim, Math.min(lim, pos.x));
    pos.z = Math.max(-lim, Math.min(CITY.WATER_START - 2, pos.z));
  }

  nearestRoadPoint(x, z) {
    let best = null;
    let bestD = Infinity;
    for (const line of CITY.ROAD_LINES) {
      const dV = Math.abs(x - line);
      if (dV < bestD) { bestD = dV; best = { x: line, z }; }
      const dH = Math.abs(z - line);
      if (dH < bestD) { bestD = dH; best = { x, z: line }; }
    }
    return best;
  }

  isOnRoad(x, z) {
    for (const line of CITY.ROAD_LINES) {
      if (Math.abs(x - line) < CITY.ROAD_HALF || Math.abs(z - line) < CITY.ROAD_HALF) return true;
    }
    return false;
  }

  update(dt, time) {
    if (this.water) this.water.position.y = 0.06 + Math.sin(time * 0.7) * 0.02;
    if (this.waveLine) this.waveLine.position.z = CITY.WATER_START + Math.sin(time * 0.9) * 1.2;
    for (const p of this.pickups) {
      if (p.taken) {
        p.respawn -= dt;
        if (p.respawn <= 0) { p.taken = false; p.group.visible = true; }
        continue;
      }
      p.group.rotation.y += dt * 1.6;
      p.group.position.y = 0.3 + Math.sin(time * 2 + p.x) * 0.15;
    }
  }
}
