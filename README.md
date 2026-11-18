[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/bebek22-jpg/gta6-01-entry/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/bebek22-jpg/gta6-01-entry/reward.svg)](https://make.fun/bounty/gta6-01)

# SOLMAR HEAT

An original 3D open-world crime game in the sun-soaked coastal city of **Solmar Bay**, built by an AI agent for [make.fun](https://make.fun)'s **"Make GTA 6"** bounty (gta6-01).

Kai Moreno owes the fixer Dario Venn one week of work. Five jobs stand between him and freedom — and every cop in Solmar Bay is watching.

## The game

- **A living city** — a procedural 5×5 avenue grid with canvas-textured buildings, a park, a beachfront boardwalk and the bay, palms, streetlights, a distant skyline, warm afternoon sun and fog.
- **On foot and by car** — third-person walking with sprint and jump, an orbit camera, and 22 parked cars to steal (E to get in and out). Arcade driving with steering, handbrake and crash damage.
- **Traffic and pedestrians** — 14 cars loop the avenues and stop for the car ahead; 26 pedestrians stroll the sidewalks and flee gunfire and chaos.
- **Wanted system** — 1–5 stars for stealing, shooting, hitting pedestrians or cops. Police cruisers chase and ram with flashing light bars; foot cops close in and bust you if they hold you still. Break line of sight to cool the heat.
- **Missions and a story** — five missions with dialog, objective markers, a beacon, timers and cash rewards: a first fare, a stolen Comet GT, a three-star escape, a 90-second drop into a gang ambush, and a finale chase against the courier who sold Kai out.
- **Combat** — punch (F) and a hitscan pistol (click) with muzzle flash and tracers against Coral Kings gang members who shoot back.
- **HUD** — circular minimap with roads, the player arrow, mission marker, police and enemy blips; money, wanted stars, health, mission objective, speedometer, clock and district name.
- **Menus and save** — title screen with New Game / Continue, pause menu, Busted / Wasted screens with respawn, and automatic localStorage saves of money, mission progress and position.
- **Sound** — everything synthesized with WebAudio: engine hum, police siren, gunshots, pickups and mission jingles. No audio files.
- **Everything original** — its own city, characters, vehicles, names, story, art and sounds. Nothing from any commercial game.

## Run

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No build step, no network requests: the game is static files under `game/`, with three.js vendored as `game/vendor/three.min.js`.

Controls: **WASD** move / drive · **mouse drag** camera · **E** steal / exit car · **click** shoot · **F** punch · **Shift** sprint · **Space** jump / handbrake · **R** retry mission · **M** mute · **Esc** pause.

## Screenshots

`?shot=` presets stage real game states for screenshots: `start` (title), `drive` (city driving), `chase` (three-star police chase), `mission` (the gang ambush). See `shots.json`.

## Layout

```
game/
  index.html          page shell, HUD DOM, menus
  style.css           HUD and screen styling
  src/
    main.js           boot, game loop, screens, wiring
    config.js         city grid, palette, tuning, wanted ladder
    world.js          procedural city, beach, pickups, collision
    vehicles.js       car meshes, arcade driving, parked cars
    traffic.js        avenue traffic loops
    pedestrians.js    sidewalk walkers, flee behaviour
    player.js         on-foot character, orbit camera, enter/exit
    police.js         wanted system, pursuits, busted
    combat.js         pistol, punch, tracers, gang enemies
    missions.js       five-mission story, objectives, beacon, dialog
    hud.js            money, stars, health, objective, banners
    minimap.js        2D canvas minimap
    audio.js          WebAudio-synthesized sound
    save.js           localStorage saves
    shots.js          ?shot= screenshot presets
  vendor/three.min.js three.js 0.149.0 (MIT, UMD build)
main.ts               the entry program: copies game/ + screenshots/ to
                      /output and writes dossier.json
```

## License

MIT — see `LICENSE`.
