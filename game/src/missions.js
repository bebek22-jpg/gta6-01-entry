// Solmar Heat — the story: five missions for Kai Moreno, a getaway driver
// who owes the fixer Dario Venn one last week of work in Solmar Bay.
// Each mission is a list of steps; the system runs them, moves the beacon,
// talks, and pays out on a pass.

import { MISSION_REWARDS } from './config.js';
import { makeCarMesh, Vehicle } from './vehicles.js';
import { makePersonMesh } from './pedestrians.js';

const DIALOG_TIME = 4.5;

export const MISSIONS = [
  {
    id: 'first-fare',
    title: 'First Fare',
    brief: 'Dario needs a driver he can trust. Pick up Lena at Coral & 2nd and get her to the Bayfront Hotel — smooth, no heat.',
    steps: [
      { type: 'goto', x: -60, z: -60, label: 'Pick up Lena at Coral & 2nd' },
      { type: 'enter', label: 'Get in a car' },
      { type: 'driveTo', x: 90, z: 60, label: 'Drop Lena at the Bayfront Hotel' },
    ],
    dialog: [
      ['DARIO', 'Kai. You owe me one week. First job is easy — a fare, not a felony.'],
      ['LENA', 'You must be the driver. Bayfront Hotel, and don\'t scratch the paint.'],
      ['KAI', 'Relax. I drive like the road owes me money.'],
    ],
  },
  {
    id: 'borrowed-wheels',
    title: 'Borrowed Wheels',
    brief: 'A Comet GT is sitting in the marina lot with the keys in it. Borrow it — permanently — and bring it to the chop shop on Harbor Ave.',
    steps: [
      { type: 'goto', x: -52, z: 40, label: 'Find the Comet GT in the marina lot' },
      { type: 'steal', x: -52, z: 40, label: 'Take the Comet GT' },
      { type: 'driveTo', x: 120, z: 60, label: 'Deliver it to the chop shop on Harbor Ave' },
    ],
    dialog: [
      ['DARIO', 'There\'s a Comet GT in the marina lot. Owner\'s on holiday. Keys in the visor.'],
      ['KAI', 'Borrowed. That\'s the word we\'re using? Borrowed.'],
      ['DARIO', 'Borrowed forever. Bring it to Harbor Ave and the cops can have the paperwork.'],
    ],
  },
  {
    id: 'heat-run',
    title: 'Heat Run',
    brief: 'Somebody talked. Three stars and every cruiser in Solmar Bay wants Kai. Lose them, then get to the safehouse on the north edge.',
    steps: [
      { type: 'loseWanted', label: 'Lose the cops — break line of sight and stay hidden' },
      { type: 'goto', x: -120, z: -120, label: 'Reach the safehouse' },
    ],
    dialog: [
      ['DARIO', 'Somebody talked, Kai. Three stars. Every cruiser in the bay is rolling.'],
      ['KAI', 'Then I drive like I mean it. Safehouse, north edge.'],
      ['DARIO', 'Stay out of sight till the heat cools. Then come home.'],
    ],
  },
  {
    id: 'the-drop',
    title: 'The Drop',
    brief: 'A package at the old pier warehouse, a buyer at the north docks, ninety seconds on the clock — and the Coral Kings know the route.',
    steps: [
      { type: 'goto', x: -60, z: 120, label: 'Pick up the package at the pier warehouse' },
      { type: 'timed', x: 120, z: -60, seconds: 90, label: 'Deliver to the north docks' },
      { type: 'kill', count: 4, x: 120, z: -60, label: 'The Coral Kings set a trap — fight them off' },
    ],
    dialog: [
      ['DARIO', 'Package at the pier, buyer at the north docks. Ninety seconds, Kai. The buyer does not wait.'],
      ['KAI', 'Ninety seconds across town? You owe me a faster car.'],
      ['DARIO', 'And watch your back. The Kings know the route.'],
    ],
  },
  {
    id: 'bayfront-finale',
    title: 'Bayfront Finale',
    brief: 'The courier who sold Kai out is running the avenues in a black Sultan. Run him down, then vanish onto the beach.',
    steps: [
      { type: 'chase', label: 'Run the courier off the road' },
      { type: 'goto', x: 0, z: 162, label: 'Escape to the beach and disappear' },
    ],
    dialog: [
      ['DARIO', 'The courier who sold you out is running the avenues in a black Sultan.'],
      ['KAI', 'Then today he learns what a rear bumper is for.'],
      ['DARIO', 'After that, beach. Vanish. The week is over, Kai. You\'re free.'],
    ],
  },
];

export class MissionSystem {
  constructor(scene, world, player, police, combat, sound) {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.police = police;
    this.combat = combat;
    this.sound = sound;
    this.index = -1; // no mission running
    this.stepIndex = 0;
    this.active = false;
    this.failed = false;
    this.completedCount = 0;
    this.timer = 0;
    this.killsNeeded = 0;
    this.killsDone = 0;
    this.beacon = this._makeBeacon();
    this.scene.add(this.beacon);
    this.beacon.visible = false;
    this.beaconTarget = null;
    this.markerPed = null;
    this.courier = null;
    this.courierWps = [];
    this.courierWp = 0;
    this.dialogQueue = [];
    this.dialogTimer = 0;
    this.currentDialog = null;
    this.nextMissionAt = -1;
    this.onPassed = null;
    this.onFailed = null;
    this.onDialog = null;
    this.onObjective = null;
  }

  _makeBeacon() {
    const group = new THREE.Group();
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 40, 12, 1, true), beamMat);
    beam.position.y = 20;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.8, 2.6, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.35;
    const diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.9),
      new THREE.MeshBasicMaterial({ color: 0xffd23f }),
    );
    diamond.position.y = 5;
    group.add(beam, ring, diamond);
    group.userData.diamond = diamond;
    group.userData.ring = ring;
    return group;
  }

  get mission() {
    return this.index >= 0 && this.index < MISSIONS.length ? MISSIONS[this.index] : null;
  }

  get currentStep() {
    const m = this.mission;
    return m && this.stepIndex < m.steps.length ? m.steps[this.stepIndex] : null;
  }

  start(index) {
    this.index = index;
    this.stepIndex = 0;
    this.active = true;
    this.failed = false;
    this.killsDone = 0;
    const m = this.mission;
    if (!m) { this.active = false; return; }
    this.dialogQueue = [...m.dialog];
    this.dialogTimer = 0;
    this.currentDialog = null;
    if (m.id === 'heat-run') this.police.addStars(3, 'setup');
    if (m.id === 'first-fare') this._placeMarkerPed(-60, -60);
    if (m.id === 'bayfront-finale') this._spawnCourier();
    this._enterStep();
    if (this.onObjective) this.onObjective(this.objectiveText());
  }

  _placeMarkerPed(x, z) {
    this._clearMarkerPed();
    const mesh = makePersonMesh(0xe74c3c, 0x2c3e50, 0xffdbac);
    mesh.position.set(x, 0.3, z);
    this.scene.add(mesh);
    this.markerPed = mesh;
  }

  _clearMarkerPed() {
    if (this.markerPed) {
      this.scene.remove(this.markerPed);
      this.markerPed = null;
    }
  }

  _spawnCourier() {
    const mesh = makeCarMesh(0x14181d, 'sport');
    const car = new Vehicle(mesh, 60, 0, Math.PI / 2, 'sport');
    car.health = 100;
    this.scene.add(mesh);
    this.courier = car;
    // A long loop around the central blocks.
    this.courierWps = [
      { x: 60, z: -60 }, { x: -60, z: -60 }, { x: -60, z: 60 }, { x: 60, z: 60 },
    ];
    this.courierWp = 0;
    this.combat.extraTargets = [{ kind: 'courier', ref: car, pos: car.pos, radius: 2.4 }];
  }

  _clearCourier() {
    if (this.courier) {
      this.scene.remove(this.courier.mesh);
      this.courier = null;
    }
    this.combat.extraTargets = [];
  }

  _enterStep() {
    const step = this.currentStep;
    if (!step) { this._pass(); return; }
    if (step.type === 'timed') this.timer = step.seconds;
    if (step.type === 'kill') {
      this.killsNeeded = step.count;
      this.killsDone = 0;
      this.combat.spawnGang(step.x, step.z, step.count, 8);
    }
    if (step.type === 'goto' || step.type === 'driveTo' || step.type === 'timed' || step.type === 'steal') {
      this.beaconTarget = { x: step.x, z: step.z };
      this.beacon.visible = true;
      this.beacon.position.set(step.x, 0, step.z);
    } else if (step.type === 'chase' && this.courier) {
      this.beacon.visible = true;
    } else {
      this.beacon.visible = false;
      this.beaconTarget = null;
    }
    if (this.onObjective) this.onObjective(this.objectiveText());
  }

  objectiveText() {
    const m = this.mission;
    if (!m || !this.active) return '';
    const step = this.currentStep;
    if (!step) return '';
    let text = `${m.title} — ${step.label}`;
    if (step.type === 'timed') text += ` (${Math.max(0, Math.ceil(this.timer))}s)`;
    if (step.type === 'kill') text += ` (${this.killsDone}/${this.killsNeeded})`;
    return text;
  }

  retry() {
    this.combat.clearEnemies();
    this._clearCourier();
    this._clearMarkerPed();
    this.police.clearWanted();
    this.start(this.index);
  }

  _advance() {
    this.stepIndex += 1;
    this.sound.pickup();
    this._enterStep();
  }

  _pass() {
    const m = this.mission;
    this.active = false;
    this.beacon.visible = false;
    this._clearMarkerPed();
    this._clearCourier();
    this.completedCount += 1;
    this.sound.missionPass();
    if (this.onPassed) this.onPassed(m, MISSION_REWARDS[this.index] || 0);
    this.index += 1;
    if (this.index < MISSIONS.length) this.nextMissionAt = performance.now() / 1000 + 5;
    else this.index = MISSIONS.length;
  }

  _fail(reason) {
    if (!this.active) return;
    this.active = false;
    this.failed = true;
    this.beacon.visible = false;
    this._clearMarkerPed();
    this._clearCourier();
    this.combat.clearEnemies();
    this.sound.missionFail();
    if (this.onFailed) this.onFailed(this.mission, reason);
  }

  onKill() {
    if (!this.active) return;
    const step = this.currentStep;
    if (step && step.type === 'kill') {
      this.killsDone += 1;
      if (this.killsDone >= this.killsNeeded) this._advance();
      else if (this.onObjective) this.onObjective(this.objectiveText());
    }
  }

  update(dt, time) {
    // Dialog playback.
    if (this.currentDialog) {
      this.dialogTimer -= dt;
      if (this.dialogTimer <= 0) {
        this.currentDialog = null;
        if (this.onDialog) this.onDialog(null);
      }
    } else if (this.dialogQueue.length > 0) {
      this.currentDialog = this.dialogQueue.shift();
      this.dialogTimer = DIALOG_TIME;
      if (this.onDialog) this.onDialog(this.currentDialog);
    }
    // Auto-start the next mission after a breather.
    if (!this.active && !this.failed && this.nextMissionAt > 0 && time > this.nextMissionAt && this.index < MISSIONS.length) {
      this.nextMissionAt = -1;
      this.start(this.index);
    }
    // Beacon pulse + chase tracking.
    if (this.beacon.visible) {
      const s = 1 + Math.sin(time * 3) * 0.12;
      this.beacon.userData.ring.scale.setScalar(s);
      this.beacon.userData.diamond.rotation.y += dt * 2;
      this.beacon.userData.diamond.position.y = 5 + Math.sin(time * 2) * 0.5;
      if (this.currentStep && this.currentStep.type === 'chase' && this.courier) {
        this.beacon.position.set(this.courier.pos.x, 0, this.courier.pos.z);
      }
    }
    if (this.courier) this._updateCourier(dt);
    if (!this.active) return;
    const step = this.currentStep;
    if (!step) return;
    const pp = this.player.inCar ? this.player.vehicle.pos : this.player.pos;
    if (step.type === 'goto' || step.type === 'driveTo' || step.type === 'timed' || step.type === 'steal') {
      const d = Math.hypot(pp.x - step.x, pp.z - step.z);
      if (step.type === 'timed') {
        this.timer -= dt;
        if (this.timer <= 0) { this._fail('Out of time'); return; }
        if (this.onObjective) this.onObjective(this.objectiveText());
      }
      if (step.type === 'steal') {
        if (this.player.inCar && d < 12) {
          this.police.addStars(1, 'steal');
          this._advance();
        }
        return;
      }
      if (d < 6) {
        if (this.mission.id === 'first-fare' && this.stepIndex === 0) this._clearMarkerPed();
        this._advance();
      }
    } else if (step.type === 'enter') {
      if (this.player.inCar) this._advance();
    } else if (step.type === 'loseWanted') {
      if (this.police.stars === 0) this._advance();
    } else if (step.type === 'chase') {
      if (this.courier && this.courier.health <= 0) this._advance();
    }
  }

  _updateCourier(dt) {
    const car = this.courier;
    if (car.health <= 0) return; // wrecked: it sits smoking until the step advances
    const target = this.courierWps[this.courierWp];
    const dx = target.x - car.pos.x;
    const dz = target.z - car.pos.z;
    if (Math.hypot(dx, dz) < 5) {
      this.courierWp = (this.courierWp + 1) % this.courierWps.length;
      return;
    }
    const want = Math.atan2(dx, dz);
    let diff = want - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const pp = this.player.inCar ? this.player.vehicle.pos : this.player.pos;
    const playerNear = Math.hypot(pp.x - car.pos.x, pp.z - car.pos.z) < 25;
    car.drive(dt, 1, Math.max(-1, Math.min(1, diff * 1.8)), false, this.world);
    // Ramming damage from the player's car.
    if (this.player.inCar) {
      const d = Math.hypot(pp.x - car.pos.x, pp.z - car.pos.z);
      const rel = Math.abs(this.player.vehicle.speed - car.speed);
      if (d < 3.6 && rel > 6) {
        car.health -= rel * 1.2;
        this.sound.crash();
        car.pos.x += (car.pos.x - pp.x) * 0.06;
        car.pos.z += (car.pos.z - pp.z) * 0.06;
      }
    }
    if (playerNear && car.speed < 20) car.speed = Math.min(30, car.speed + 12 * dt);
  }

  failIfPlayerDown() {
    if (this.active) this._fail('Mission failed');
  }

  markerPosition() {
    if (this.currentStep && this.currentStep.type === 'chase' && this.courier) {
      return { x: this.courier.pos.x, z: this.courier.pos.z };
    }
    return this.beaconTarget;
  }
}
