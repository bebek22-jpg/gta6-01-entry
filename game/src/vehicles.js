// Solmar Heat — vehicles: the car mesh, arcade driving physics, and the
// parked cars waiting on the street to be stolen.

import { CAR_TUNING, PALETTE } from './config.js';

let wheelGeo = null;
let wheelMat = null;

// A low-poly car from boxes and cylinders: body, cabin, wheels, lights.
export function makeCarMesh(color, kind = 'sedan') {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2733 });
  const bodyLen = kind === 'truck' ? 5.4 : 4.4;
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.75, bodyLen), bodyMat);
  body.position.y = 0.62;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.62, kind === 'truck' ? 1.4 : 2.2),
    kind === 'police' ? new THREE.MeshLambertMaterial({ color: 0x101418 }) : glassMat,
  );
  cabin.position.set(0, 1.28, kind === 'truck' ? -1.2 : -0.2);
  cabin.castShadow = true;
  group.add(cabin);
  if (!wheelGeo) {
    wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
    wheelGeo.rotateZ(Math.PI / 2);
    wheelMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  }
  group.userData.wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(wx, 0.38, wz * (bodyLen / 4.4));
    group.add(wheel);
    group.userData.wheels.push(wheel);
  }
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const sx of [-0.7, 0.7]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.1), headMat);
    head.position.set(sx, 0.66, bodyLen / 2 + 0.02);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.1), tailMat);
    tail.position.set(sx, 0.66, -bodyLen / 2 - 0.02);
    group.add(tail);
  }
  if (kind === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.22, 0.4), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    bar.position.set(0, 1.68, -0.2);
    group.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.42), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.set(-0.32, 1.7, -0.2);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.42), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    blue.position.set(0.32, 1.7, -0.2);
    group.add(red, blue);
    group.userData.lightRed = red;
    group.userData.lightBlue = blue;
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(2.02, 0.28, bodyLen * 0.9),
      new THREE.MeshLambertMaterial({ color: 0x14181d }),
    );
    stripe.position.y = 0.62;
    group.add(stripe);
  }
  return group;
}

// One drivable car: position, heading, speed and arcade handling.
export class Vehicle {
  constructor(mesh, x, z, heading, kind = 'sedan') {
    this.mesh = mesh;
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.kind = kind;
    this.health = CAR_TUNING.health;
    this.smoking = false;
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = heading;
  }

  // throttle -1..1, steerInput -1..1, handbrake bool. Returns distance moved.
  drive(dt, throttle, steerInput, handbrake, world) {
    const max = this.kind === 'sport' ? CAR_TUNING.maxSpeed * 1.25 : CAR_TUNING.maxSpeed;
    const grip = handbrake ? CAR_TUNING.handbrakeGrip : CAR_TUNING.grip;
    if (throttle > 0) this.speed += CAR_TUNING.accel * throttle * dt;
    else if (throttle < 0) {
      if (this.speed > 0.5) this.speed -= CAR_TUNING.brake * dt;
      else this.speed = Math.max(-CAR_TUNING.reverseMax, this.speed + CAR_TUNING.accel * 0.6 * throttle * dt);
    }
    this.speed -= this.speed * CAR_TUNING.drag * dt;
    if (Math.abs(this.speed) < 0.05 && throttle === 0) this.speed = 0;
    this.speed = Math.max(-CAR_TUNING.reverseMax, Math.min(max, this.speed));
    const steerTarget = steerInput * CAR_TUNING.steerRate * Math.min(1, Math.abs(this.speed) / 6);
    this.steer += (steerTarget - this.steer) * Math.min(1, dt * grip);
    this.heading += this.steer * dt * Math.sign(this.speed || 1) * (handbrake ? 1.5 : 1);
    const move = this.speed * dt;
    const nx = this.pos.x + Math.sin(this.heading) * move;
    const nz = this.pos.z + Math.cos(this.heading) * move;
    const before = { x: this.pos.x, z: this.pos.z };
    this.pos.x = nx;
    this.pos.z = nz;
    world.collideCircle(this.pos, CAR_TUNING.radius);
    const blocked = Math.hypot(this.pos.x - before.x, this.pos.z - before.z) < Math.abs(move) * 0.4;
    if (blocked && Math.abs(this.speed) > 4) {
      this.speed *= -0.25;
      this.health -= Math.abs(this.speed) * 0.4 + 4;
      return { crashed: true, impact: Math.abs(this.speed) };
    }
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
    const spin = (this.speed * dt) / 0.38;
    for (const w of this.mesh.userData.wheels) w.rotation.x += spin;
    if (this.health < 35 && !this.smoking) this.smoking = true;
    return { crashed: false, impact: 0 };
  }

  get velocity() {
    return new THREE.Vector3(Math.sin(this.heading) * this.speed, 0, Math.cos(this.heading) * this.speed);
  }
}

// Parked cars along the avenues, each stealable with E.
export function spawnParkedCars(scene, world) {
  const cars = [];
  const spots = [
    [-112, -40, 0], [-112, 80, 0], [-52, -100, Math.PI], [-52, 40, 0], [8, -80, 0],
    [8, 100, Math.PI], [68, -40, 0], [68, 60, Math.PI], [128, -100, 0], [128, 20, Math.PI],
    [-40, -112, Math.PI / 2], [80, -112, -Math.PI / 2], [-100, -52, Math.PI / 2], [40, -52, -Math.PI / 2],
    [-80, 8, Math.PI / 2], [100, 8, -Math.PI / 2], [-20, 68, Math.PI / 2], [-100, 128, Math.PI / 2],
    [20, 128, -Math.PI / 2], [100, 128, Math.PI / 2], [-52, 100, 0], [8, 20, Math.PI],
  ];
  for (let i = 0; i < spots.length; i += 1) {
    const [x, z, heading] = spots[i];
    const kind = i % 7 === 3 ? 'sport' : (i % 5 === 0 ? 'truck' : 'sedan');
    const color = PALETTE.car[i % PALETTE.car.length];
    const car = new Vehicle(makeCarMesh(color, kind), x, z, heading, kind);
    scene.add(car.mesh);
    cars.push(car);
  }
  return cars;
}
