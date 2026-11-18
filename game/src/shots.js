// Solmar Heat — the screenshot scenes behind ?shot=start|drive|chase|mission.
// Each one stages a real game state (a car mid-drive, a live police chase, a
// mission firefight) and lets the simulation run, so the frame is the game
// itself, not a diorama.

export function stageShot(name, game) {
  const g = game;
  if (name === 'drive') {
    // Mid-city drive: Kai in a red sportscar on Coral Ave, traffic around,
    // mission one on the HUD.
    g.beginPlaying();
    const car = g.parkedCars.find((c) => c.kind === 'sport') || g.parkedCars[0];
    car.pos.set(3.5, 0, 60);
    car.heading = Math.PI;
    car.speed = 19;
    car.mesh.position.copy(car.pos);
    car.mesh.rotation.y = car.heading;
    g.player.enterCar(car);
    g.player.camYaw = Math.PI;
    g.player.camPitch = 0.3;
    g.missions.start(0);
    g.missions.stepIndex = 2;
    g.missions._enterStep();
    return;
  }
  if (name === 'chase') {
    // Three stars, three cruisers on the tail, Heat Run on the HUD.
    g.beginPlaying();
    const car = g.parkedCars.find((c) => c.kind === 'sport') || g.parkedCars[0];
    car.pos.set(-3.5, 0, 30);
    car.heading = Math.PI;
    car.speed = 26;
    car.mesh.position.copy(car.pos);
    car.mesh.rotation.y = car.heading;
    g.player.enterCar(car);
    g.player.camYaw = Math.PI;
    g.player.camPitch = 0.32;
    g.missions.start(2);
    g.police._spawnCar();
    g.police._spawnCar();
    g.police._spawnCar();
    // Line the cruisers up right behind the player for the frame.
    const spots = [[-6.5, 48, Math.PI], [0.5, 52, Math.PI], [-3.5, 62, Math.PI]];
    g.police.cars.forEach((cruiser, i) => {
      const [x, z, h] = spots[i % spots.length];
      cruiser.pos.set(x, 0, z);
      cruiser.heading = h;
      cruiser.speed = 24;
      cruiser.mesh.position.copy(cruiser.pos);
      cruiser.mesh.rotation.y = h;
    });
    g.peds.panic(-3.5, 40, 8);
    return;
  }
  if (name === 'mission') {
    // The Drop's ambush: Kai on foot, four Coral Kings ahead, objective live.
    g.beginPlaying();
    g.player.pos.set(104, 0, -46);
    g.player.heading = 2.36;
    g.player.camYaw = 2.36;
    g.player.camPitch = 0.26;
    g.player.mesh.position.copy(g.player.pos);
    g.player.mesh.rotation.y = g.player.heading;
    g.missions.start(3);
    g.missions.stepIndex = 2;
    g.missions._enterStep();
    g.money = 640;
    return;
  }
  // 'start' and anything else: the title screen over the living city.
}
