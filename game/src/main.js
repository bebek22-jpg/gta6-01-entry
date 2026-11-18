// Solmar Heat — the game itself: boot, the loop, screens, and every system
// wired together. Kai Moreno, getaway driver, one week to work off a debt
// in the sun-soaked city of Solmar Bay.

import { CITY, GAME_NAME, PLAYER_TUNING } from './config.js';
import { SoundBank } from './audio.js';
import { Input } from './input.js';
import { World } from './world.js';
import { spawnParkedCars } from './vehicles.js';
import { TrafficSystem } from './traffic.js';
import { PedestrianSystem } from './pedestrians.js';
import { Player } from './player.js';
import { PoliceSystem } from './police.js';
import { CombatSystem } from './combat.js';
import { MissionSystem } from './missions.js';
import { Hud } from './hud.js';
import { Minimap } from './minimap.js';
import { SaveGame } from './save.js';
import { stageShot } from './shots.js';

const RESPAWN_HOSPITAL = { x: -60, z: -120 };
const RESPAWN_STATION = { x: 60, z: -120 };

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

    this.world = new World(this.scene);
    this.player = new Player(this.scene, this.world, -3.5, 20);
    this.parkedCars = spawnParkedCars(this.scene, this.world);
    this.traffic = new TrafficSystem(this.scene, this.world);
    this.peds = new PedestrianSystem(this.scene, this.world);
    this.sound = new SoundBank();
    this.police = new PoliceSystem(this.scene, this.world, this.player, this.sound);
    this.combat = new CombatSystem(this.scene, this.world, this.player, this.sound);
    this.missions = new MissionSystem(this.scene, this.world, this.player, this.police, this.combat, this.sound);
    this.hud = new Hud();
    this.minimap = new Minimap(document.getElementById('minimap'));
    this.input = new Input(this.canvas);

    this.state = 'title';
    this.money = 250;
    this.totalEarned = 0;
    this.clockMinutes = 14 * 60 + 5;
    this.time = 0;
    this.autosaveTimer = 0;
    this.titleAngle = 0;
    this.shotName = new URLSearchParams(window.location.search).get('shot');

    this._wireScreens();
    this._wireMissionEvents();
    this._wireCombatEvents();
    window.addEventListener('resize', () => this._resize());
    document.addEventListener('keydown', () => this.sound.unlock(), { once: true });
    document.addEventListener('mousedown', () => this.sound.unlock(), { once: true });

    // A ?shot= preset stages a real game state for the screenshots.
    if (this.shotName && this.shotName !== 'start') {
      stageShot(this.shotName, this);
    }
    this._setScreen(this.state);
    this._loop(performance.now());
  }

  _wireScreens() {
    const $ = (id) => document.getElementById(id);
    $('btn-new').addEventListener('click', () => { this.sound.unlock(); this.sound.click(); SaveGame.clear(); this.startNewGame(); });
    $('btn-continue').addEventListener('click', () => { this.sound.unlock(); this.sound.click(); this.continueGame(); });
    $('btn-resume').addEventListener('click', () => { this.sound.click(); this.resume(); });
    $('btn-restart-mission').addEventListener('click', () => { this.sound.click(); this.missions.retry(); this.resume(); });
    $('btn-quit').addEventListener('click', () => { this.sound.click(); this.quitToTitle(); });
    $('btn-respawn').addEventListener('click', () => { this.sound.click(); this.respawn(); });
    if (!SaveGame.hasSave()) $('btn-continue').style.display = 'none';
    $('title-name').textContent = GAME_NAME;
  }

  _wireMissionEvents() {
    this.missions.onPassed = (mission, reward) => {
      this.money += reward;
      this.totalEarned += reward;
      this.hud.showBanner('MISSION PASSED', `${mission.title}  •  +$${reward}`, 4);
      this._save();
    };
    this.missions.onFailed = (mission, reason) => {
      this.hud.showBanner('MISSION FAILED', `${reason} — press R to retry`, 5);
    };
    this.missions.onDialog = (dialog) => this.hud.setDialog(dialog);
    this.missions.onObjective = (text) => this.hud.setObjective(text);
  }

  _wireCombatEvents() {
    this.combat.onEnemyKilled = () => this.missions.onKill();
    this.combat.onPedShot = () => { this.police.addStars(1, 'ped'); this.peds.panic(this.player.pos.x, this.player.pos.z, 8); };
    this.combat.onCopShot = () => { this.police.addStars(2, 'cop'); };
    this.police.onBusted = () => this._busted();
  }

  _setScreen(state) {
    this.state = state;
    document.body.dataset.screen = state;
    for (const id of ['screen-title', 'screen-pause', 'screen-end']) {
      document.getElementById(id).style.display = 'none';
    }
    if (state === 'title') document.getElementById('screen-title').style.display = 'flex';
    if (state === 'paused') document.getElementById('screen-pause').style.display = 'flex';
    if (state === 'busted' || state === 'wasted') document.getElementById('screen-end').style.display = 'flex';
  }

  // Shared by New Game, Continue and the ?shot= presets.
  beginPlaying() {
    this._setScreen('playing');
    this.hud.setMoney(this.money);
    this.hud.setStars(this.police.stars);
    this.hud.setHealth(this.player.health, PLAYER_TUNING.maxHealth);
  }

  startNewGame() {
    this.money = 250;
    this.totalEarned = 0;
    this.player.health = PLAYER_TUNING.maxHealth;
    this.player.pos.set(-3.5, 20, 0);
    this.player.pos.y = 0;
    this.player.mesh.position.copy(this.player.pos);
    this.police.clearWanted();
    this.beginPlaying();
    this.missions.start(0);
    this._save();
  }

  continueGame() {
    const save = SaveGame.load();
    if (!save) { this.startNewGame(); return; }
    this.money = save.money || 0;
    this.totalEarned = save.totalEarned || 0;
    this.player.health = save.health || PLAYER_TUNING.maxHealth;
    this.player.pos.set(save.x || -3.5, 0, save.z || 20);
    this.player.mesh.position.copy(this.player.pos);
    this.beginPlaying();
    const next = save.missionIndex || 0;
    this.missions.completedCount = save.completedMissions || 0;
    if (next < 5) this.missions.start(next);
    else this.hud.showBanner('WELCOME BACK', 'The story is done — Solmar Bay is yours.', 4);
  }

  quitToTitle() {
    this._save();
    if (this.player.inCar) this.player.exitCar(null);
    this.police.clearWanted();
    this.combat.clearEnemies();
    this.missions.active = false;
    this.missions.beacon.visible = false;
    this.hud.setObjective('');
    this.hud.setDialog(null);
    this._setScreen('title');
  }

  pause() {
    if (this.state !== 'playing') return;
    this._save();
    this._setScreen('paused');
  }

  resume() {
    if (this.state !== 'paused') return;
    this._setScreen('playing');
  }

  _busted() {
    if (this.state !== 'playing') return;
    const fine = Math.min(this.money, 150);
    this.money -= fine;
    this.missions.failIfPlayerDown();
    this.police.clearWanted();
    if (this.player.inCar) this.player.exitCar(null);
    this.sound.busted();
    document.getElementById('end-title').textContent = 'BUSTED';
    document.getElementById('end-sub').textContent = `The Solmar Bay PD took $${fine} in fines.`;
    this._setScreen('busted');
  }

  _wasted() {
    if (this.state !== 'playing') return;
    const bill = Math.min(this.money, 100);
    this.money -= bill;
    this.missions.failIfPlayerDown();
    this.police.clearWanted();
    if (this.player.inCar) this.player.exitCar(null);
    this.sound.busted();
    document.getElementById('end-title').textContent = 'WASTED';
    document.getElementById('end-sub').textContent = `The hospital took $${bill}. Try not to get shot next time.`;
    this._setScreen('wasted');
  }

  respawn() {
    const spot = this.state === 'busted' ? RESPAWN_STATION : RESPAWN_HOSPITAL;
    this.player.pos.set(spot.x, 0, spot.z);
    this.player.mesh.position.copy(this.player.pos);
    this.player.health = PLAYER_TUNING.maxHealth;
    this.beginPlaying();
  }

  _save() {
    SaveGame.save({
      money: this.money,
      missionIndex: Math.min(5, this.missions.index < 0 ? 0 : this.missions.index),
      completedMissions: this.missions.completedCount,
      health: this.player.health,
      x: this.player.pos.x,
      z: this.player.pos.z,
      totalEarned: this.totalEarned,
    });
  }

  _resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  _locationName(x, z) {
    if (z > CITY.BEACH_START) return 'Bayfront Beach';
    if (x < -60 && z < -60) return 'Coral Park';
    if (x > 60 && z > 60) return 'Harbor District';
    if (x < -60) return 'West Solmar';
    if (x > 60) return 'East Solmar';
    if (z < -60) return 'North Docks';
    return 'Downtown Solmar';
  }

  _nearestParkedCar(maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of this.parkedCars) {
      const d = Math.hypot(car.pos.x - this.player.pos.x, car.pos.z - this.player.pos.z);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  _updatePlaying(dt) {
    const input = this.input;
    const player = this.player;

    if (input.wasPressed('Escape')) { this.pause(); return; }
    if (input.wasPressed('KeyM')) this.sound.toggleMute();
    if (input.wasPressed('KeyR') && this.missions.failed) {
      this.missions.failed = false;
      this.missions.retry();
    }

    // Enter / exit cars.
    if (input.wasPressed('KeyE')) {
      if (player.inCar) {
        player.exitCar(this.sound);
      } else {
        const car = this._nearestParkedCar(3.6);
        if (car && car.health > 0) {
          player.enterCar(car, this.sound);
          if (this.police.nearestPoliceDistance() < 50) this.police.addStars(1, 'steal-seen');
        }
      }
    }

    // Driving or walking.
    if (player.inCar) {
      const axes = input.moveAxes();
      const handbrake = input.down('Space');
      const res = player.vehicle.drive(dt, axes.y, -axes.x, handbrake, this.world);
      if (res.crashed && res.impact > 5) {
        player.damage(res.impact * 0.4, this.time);
        this.sound.crash();
      }
      if (player.vehicle.health <= 0) {
        player.exitCar(null);
        this.hud.showBanner('CAR WRECKED', 'That one is done. Find another ride.', 3);
      }
      // Running someone over is a crime, and the crowd notices.
      const ped = this.peds.nearestTo(player.vehicle.pos.x, player.vehicle.pos.z, 2.4);
      if (ped && Math.abs(player.vehicle.speed) > 3) {
        this.peds.knockDown(ped);
        this.police.addStars(1, 'hit-ped');
        this.peds.panic(player.vehicle.pos.x, player.vehicle.pos.z, 8);
      }
    } else {
      player.updateOnFoot(dt, input, this.time);
      if (input.wasPressed('KeyF')) this.combat.punch(this.peds, this.police);
      if (input.takeClick()) {
        if (this.combat.shootPistol(this.camera, this.peds, this.police)) {
          if (this.police.stars === 0) this.police.addStars(1, 'shoot');
          this.peds.panic(player.pos.x, player.pos.z, 6);
        }
      }
    }
    player.tickTimers(dt);
    player.updateCameraInput(input, this.time);
    player.updateCamera(dt, this.time, this.camera);

    // World life.
    const blockers = [
      ...this.traffic.cars,
      ...(player.inCar ? [player.vehicle] : []),
      ...this.police.cars,
    ];
    this.traffic.update(dt, blockers);
    this.peds.update(dt, this.time);
    this.police.update(dt, this.time);
    this.combat.update(dt, this.time);
    this.missions.update(dt, this.time);
    this.world.update(dt, this.time);

    // Cash pickups and enemy drops.
    for (const p of this.world.pickups) {
      if (p.taken) continue;
      const pp = player.inCar ? player.vehicle.pos : player.pos;
      if (Math.hypot(p.x - pp.x, p.z - pp.z) < 2.2) {
        p.taken = true;
        p.respawn = 90;
        p.group.visible = false;
        this.money += p.value;
        this.totalEarned += p.value;
        this.sound.pickup();
        this.hud.showBanner('CASH FOUND', `+$${p.value}`, 1.5);
      }
    }
    for (const e of this.combat.enemies) {
      if (!e.drop) continue;
      if (Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z) < 1.8 && !player.inCar) {
        this.scene.remove(e.drop);
        e.drop = null;
        this.money += 25;
        this.totalEarned += 25;
        this.sound.pickup();
      }
    }

    // Clock and HUD.
    this.clockMinutes += dt * (1 / 1.5);
    const pp = player.inCar ? player.vehicle.pos : player.pos;
    this.hud.setMoney(this.money);
    this.hud.setStars(this.police.stars);
    this.hud.setHealth(player.health, PLAYER_TUNING.maxHealth);
    this.hud.setSpeed(player.inCar ? Math.abs(player.vehicle.speed) * 3.6 : 0, player.inCar);
    this.hud.setClock(this.clockMinutes);
    this.hud.setLocation(this._locationName(pp.x, pp.z));
    this.hud.setCrosshair(!player.inCar);
    this.hud.update(dt);
    this.minimap.draw({
      time: this.time,
      playerX: pp.x,
      playerZ: pp.z,
      headingX: Math.sin(player.inCar ? player.vehicle.heading : player.heading),
      headingZ: Math.cos(player.inCar ? player.vehicle.heading : player.heading),
      marker: this.missions.markerPosition(),
      traffic: this.traffic.positions(),
      blips: [...this.police.blips(), ...this.combat.blips()],
    });
    this.sound.update(dt, player.inCar ? Math.abs(player.vehicle.speed) : 0, this.police.stars > 0 && this.police.nearestPoliceDistance() < 60);

    // Autosave.
    this.autosaveTimer += dt;
    if (this.autosaveTimer > 20) {
      this.autosaveTimer = 0;
      this._save();
    }

    if (player.health <= 0) this._wasted();
  }

  _updateTitle(dt) {
    // Slow orbit over the living city behind the title screen.
    this.titleAngle += dt * 0.03;
    const r = 150;
    this.camera.position.set(Math.cos(this.titleAngle) * r, 70, Math.sin(this.titleAngle) * r + 20);
    this.camera.lookAt(0, 0, 10);
    this.traffic.update(dt, this.traffic.cars);
    this.peds.update(dt, this.time);
    this.world.update(dt, this.time);
  }

  _loop(now) {
    requestAnimationFrame((t) => this._loop(t));
    const dt = Math.min(0.05, (now - (this._last || now)) / 1000 || 0.016);
    this._last = now;
    this.time += dt;
    if (this.state === 'playing') this._updatePlaying(dt);
    else if (this.state === 'title') this._updateTitle(dt);
    else if (this.state === 'paused' || this.state === 'busted' || this.state === 'wasted') {
      this.hud.update(dt);
    }
    this.input.endFrame();
    this.renderer.render(this.scene, this.camera);
  }
}

new Game();
