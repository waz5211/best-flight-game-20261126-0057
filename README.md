# best-flight-game-20261126-0057

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/waz5211/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/waz5211/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

Ridge Runner is a 3D bush-pilot courier game: you fly a battered little cargo plane out of Pine Hollow strip, thread glowing survey rings through a river valley, and put her down on remote dirt strips — an island runway in the lake, a ridge-top strip in the mountains — to deliver the mail. Three legs, nine rings, one old airframe: throttle, bank and pitch all matter, fuel is short, hard landings bend the airframe, and the mountains do not forgive. It runs entirely from static files with zero network requests, with a chase camera, a lit artificial horizon and compass, full HUD (altitude, speed, heading, fuel, damage, score, timer), synthesised engine and wind audio, and a title screen, pause, crash and route-complete flow.

## Run it

```sh
node serve.ts # then open http://localhost:8080
```

Or serve `game/` with any static file server and open `game/index.html`.

## Controls

- **W** / **S** throttle · **↑** / **↓** pitch · **←** / **→** bank · **A** / **D** rudder
- **F** flaps · **B** brakes · **G** gear · **Mouse drag** look around
- **P** pause · **R** restart · **M** sound on/off · **Space** start / confirm

## How it is built

- `game/index.html` — the page, HUD and overlay screens
- `game/src/config.js` — tuning, strips and scoring
- `game/src/terrain.js` — the procedural valley: heightfield, river, lake, town, runways
- `game/src/aircraft.js` — the mail plane, built from primitives
- `game/src/physics.js` — the flight model: lift, stall, banked turns, landings, damage
- `game/src/missions.js` — the three-leg route, rings and scoring
- `game/src/render.js` — three.js scene, chase camera, rings and beacons
- `game/src/hud.js` — readouts, artificial horizon and compass tape
- `game/src/audio.js` — synthesised engine, wind and chimes (WebAudio, no audio files)
- `game/src/input.js` — keyboard and mouse
- `game/src/world.js` — screens and mission flow
- `game/src/shots.js` — the deterministic screenshot scenes (`?shot=start|play|ring|landing&seed=1`)
- `game/vendor/three.min.js` — vendored three.js r152 (UMD build, unmodified)

## Screenshots

`shots.json` lists the four shots: `1-start.jpg` (on the threshold at Pine Hollow), `2-play.jpg` (cruising the valley), `3-ring.jpg` (through a survey ring), `4-landing.jpg` (final approach to Lake Strip). Each is a real render of the game in headless Chromium, 1280×720.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
