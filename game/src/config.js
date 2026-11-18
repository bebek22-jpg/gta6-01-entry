// Solmar Heat — shared tuning and city constants.
// One place for every number the rest of the game agrees on: the street grid,
// the palette, movement speeds, the wanted ladder and the mission rewards.

export const CITY = {
  // Roads run on a 60-unit pitch; five avenues each way.
  PITCH: 60,
  ROAD_HALF: 7,
  ROAD_LINES: [-120, -60, 0, 60, 120],
  // Building blocks sit between the roads, four by four.
  BLOCK_CENTERS: [-90, -30, 30, 90],
  BLOCK_HALF: 19,
  SIDEWALK: 4,
  // The city spans -150..150; south of 150 is sand, then the bay.
  EDGE: 150,
  BEACH_START: 150,
  WATER_START: 178,
  GROUND_SIZE: 420,
};

export const PALETTE = {
  sky: 0x8ec9e8,
  fog: 0xa8d3e8,
  sun: 0xfff2d0,
  ground: 0x9db98a,
  asphalt: 0x3a3f46,
  sidewalk: 0xb9b3a4,
  sand: 0xead9a8,
  water: 0x2e7fa8,
  building: [0xf2e3c6, 0xe8b48f, 0xd98c7a, 0x9fc8c0, 0xf5f0e1, 0xc9a06a, 0xb7d3e0, 0xe0cfa8],
  car: [0xc0392b, 0x2980b9, 0xf1c40f, 0x27ae60, 0x8e44ad, 0xe67e22, 0xecf0f1, 0x2c3e50, 0x16a085, 0xd35400],
};

export const PLAYER_TUNING = {
  walkSpeed: 5.2,
  sprintSpeed: 8.6,
  jumpSpeed: 7.5,
  gravity: 19,
  radius: 0.55,
  maxHealth: 100,
  regenDelay: 8,
  regenRate: 2.5,
  punchDamage: 25,
  punchRange: 2.4,
  punchCooldown: 0.45,
  pistolDamage: 34,
  pistolRange: 90,
  pistolCooldown: 0.28,
};

export const CAR_TUNING = {
  accel: 16,
  brake: 26,
  maxSpeed: 34,
  reverseMax: 10,
  steerRate: 1.9,
  grip: 6.5,
  drag: 0.55,
  handbrakeGrip: 2.2,
  radius: 1.6,
  health: 100,
};

export const WANTED = {
  // Stars earned by each crime.
  stealCar: 1,
  hitPedestrian: 1,
  shoot: 1,
  killCop: 2,
  ramPolice: 1,
  // Seconds hidden before one star fades.
  decaySeconds: 12,
  // How far a cop must be before the player counts as hidden.
  hideDistance: 75,
  maxStars: 5,
};

export const MISSION_REWARDS = [150, 250, 300, 400, 600];

export const SAVE_KEY = 'solmar-heat-save-v1';

export const GAME_NAME = 'SOLMAR HEAT';
export const CITY_NAME = 'Solmar Bay';
