// The valley: a deterministic heightfield with rim mountains, a river valley, a lake,
// a town, and three flattened dirt strips. groundHeight(x, z) is the single source of
// truth for the mesh, the physics and the ring placement, so they can never disagree.
import { fbm2, valueNoise2, createRandom } from './random.js';
import { STRIPS, WORLD } from './config.js';

const SEED = 20261126;
const LAKE = { x: 980, z: -860, r: 380 };
const RIVER_POINTS = [
  [-1900, 1500], [-1500, 1100], [-1150, 780], [-800, 520], [-450, 330],
  [-120, 180], [220, 40], [520, -180], [760, -480], [980, -860],
];

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(a, b, v) {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
}

function distToRiver(x, z) {
  let best = Infinity;
  for (let i = 0; i < RIVER_POINTS.length - 1; i += 1) {
    const [ax, az] = RIVER_POINTS[i];
    const [bx, bz] = RIVER_POINTS[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz;
    const t = clamp01(((x - ax) * dx + (z - az) * dz) / len2);
    const px = ax + dx * t;
    const pz = az + dz * t;
    const d = Math.hypot(x - px, z - pz);
    if (d < best) best = d;
  }
  return best;
}

function stripBlend(x, z, strip) {
  const rad = (strip.heading * Math.PI) / 180;
  const dx = x - strip.x;
  const dz = z - strip.z;
  const along = dx * Math.sin(rad) + dz * Math.cos(rad);
  const across = dx * Math.cos(rad) - dz * Math.sin(rad);
  const edge = Math.max(Math.abs(along) / (strip.length / 2 + 70), Math.abs(across) / (strip.width / 2 + 70));
  return 1 - smoothstep(0.55, 1, edge);
}

export function groundHeight(x, z) {
  const half = WORLD.size / 2;
  const cx = Math.max(-half, Math.min(half, x));
  const cz = Math.max(-half, Math.min(half, z));
  let h = fbm2(cx * 0.0011, cz * 0.0011, SEED, 4) * 55
    + fbm2(cx * 0.00028, cz * 0.00028, SEED + 7, 3) * 150
    + 42;
  // Rim mountains rise toward the map edge.
  const rim = Math.max(Math.abs(cx), Math.abs(cz)) / half;
  h += smoothstep(0.68, 1.0, rim) * 330 * (0.65 + 0.35 * fbm2(cx * 0.0006, cz * 0.0006, SEED + 21, 3));
  // River valley carve.
  const river = distToRiver(cx, cz);
  h -= smoothstep(190, 0, river) * 34;
  // Lake basin.
  const lakeDist = Math.hypot(cx - LAKE.x, cz - LAKE.z);
  h = h * (1 - smoothstep(LAKE.r, LAKE.r * 0.45, lakeDist)) + 4 * smoothstep(LAKE.r, LAKE.r * 0.45, lakeDist);
  // Flatten each strip to its surveyed elevation.
  for (const strip of STRIPS) {
    const b = stripBlend(cx, cz, strip);
    h = h * (1 - b) + strip.elevation * b;
  }
  return h;
}

function terrainColor(x, z, h, slope) {
  // Returns [r, g, b] in 0..1: valley grass, dry field, rock, snow caps, sand by the water.
  const n = valueNoise2(x * 0.004, z * 0.004, SEED + 55);
  let r;
  let g;
  let b;
  if (h > 300) { r = 0.82; g = 0.84; b = 0.88; } // snow
  else if (h > 190 || slope > 0.55) { r = 0.42; g = 0.38; b = 0.35; } // rock
  else if (h < 14) { r = 0.76; g = 0.68; b = 0.5; } // shore sand
  else if (n > 0.25) { r = 0.42; g = 0.55; b = 0.24; } // meadow
  else { r = 0.3; g = 0.47; b = 0.2; } // forest floor
  const shade = 0.92 + 0.08 * valueNoise2(x * 0.02, z * 0.02, SEED + 91);
  return [r * shade, g * shade, b * shade];
}

function buildTerrainMesh() {
  const geo = new THREE.PlaneGeometry(WORLD.size, WORLD.size, WORLD.segments, WORLD.segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = groundHeight(x, z);
    pos.setY(i, h);
    const hx = groundHeight(x + 6, z) - groundHeight(x - 6, z);
    const hz = groundHeight(x, z + 6) - groundHeight(x, z - 6);
    const slope = Math.hypot(hx, hz) / 12;
    const [r, g, b] = terrainColor(x, z, h, slope);
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  return new THREE.Mesh(geo, mat);
}

function buildLake() {
  const geo = new THREE.CircleGeometry(LAKE.r * 0.92, 48);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshLambertMaterial({ color: 0x2e7fb8, transparent: true, opacity: 0.92 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(LAKE.x, 8.5, LAKE.z);
  return mesh;
}

function buildRiverWater() {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x3a8cc4, transparent: true, opacity: 0.85 });
  for (let i = 0; i < RIVER_POINTS.length; i += 1) {
    const [x, z] = RIVER_POINTS[i];
    const disc = new THREE.Mesh(new THREE.CircleGeometry(46, 20), mat);
    disc.geometry.rotateX(-Math.PI / 2);
    disc.position.set(x, groundHeight(x, z) + 1.2, z);
    group.add(disc);
  }
  return group;
}

function buildRunway(strip) {
  const group = new THREE.Group();
  const rad = (strip.heading * Math.PI) / 180;
  const dirt = new THREE.Mesh(
    new THREE.PlaneGeometry(strip.width, strip.length),
    new THREE.MeshLambertMaterial({ color: 0x8a6f4d }),
  );
  dirt.geometry.rotateX(-Math.PI / 2);
  dirt.position.y = 0.4;
  group.add(dirt);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5f2e8 });
  for (let d = -strip.length / 2 + 30; d < strip.length / 2 - 20; d += 40) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(2, 16), dashMat);
    dash.geometry.rotateX(-Math.PI / 2);
    dash.position.set(0, 0.7, d);
    group.add(dash);
  }
  // Threshold bars at both ends.
  for (const end of [-1, 1]) {
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(strip.width * 0.8, 5), dashMat);
    bar.geometry.rotateX(-Math.PI / 2);
    bar.position.set(0, 0.7, end * (strip.length / 2 - 12));
    group.add(bar);
  }
  // Windsock beside the strip.
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 9, 6),
    new THREE.MeshLambertMaterial({ color: 0xdddddd }),
  );
  pole.position.set(strip.width / 2 + 12, 4.5, -strip.length / 2 + 24);
  group.add(pole);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(1.4, 5, 10),
    new THREE.MeshLambertMaterial({ color: 0xff7a1a }),
  );
  sock.rotation.z = Math.PI / 2;
  sock.position.set(strip.width / 2 + 15, 8.6, -strip.length / 2 + 24);
  group.add(sock);
  group.position.set(strip.x, strip.elevation, strip.z);
  group.rotation.y = rad;
  return group;
}

function buildTown() {
  const group = new THREE.Group();
  const rng = createRandom(777);
  const wallColors = [0xc9b8a3, 0xb8a88f, 0x9fb4c4, 0xd8c9b0, 0xa89a86];
  const windowMat = new THREE.MeshBasicMaterial({ color: 0xffd98a });
  for (let i = 0; i < 46; i += 1) {
    const x = -320 + rng() * 300;
    const z = 480 + rng() * 320;
    const w = 10 + rng() * 14;
    const d = 10 + rng() * 14;
    const h = 7 + rng() * 14;
    const house = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color: wallColors[i % wallColors.length] }),
    );
    const gy = groundHeight(x, z);
    house.position.set(x, gy + h / 2, z);
    house.rotation.y = rng() * Math.PI;
    group.add(house);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(Math.max(w, d) * 0.75, 4 + rng() * 3, 4),
      new THREE.MeshLambertMaterial({ color: 0x7a4a35 }),
    );
    roof.position.set(x, gy + h + 2, z);
    roof.rotation.y = Math.PI / 4 + house.rotation.y;
    group.add(roof);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.5, 2.2), windowMat);
    win.position.set(x, gy + h * 0.55, z + d / 2 + 0.1);
    win.rotation.y = house.rotation.y;
    group.add(win);
  }
  // Church tower as a landmark.
  const tower = new THREE.Mesh(
    new THREE.BoxGeometry(12, 34, 12),
    new THREE.MeshLambertMaterial({ color: 0xe8e2d4 }),
  );
  tower.position.set(-180, groundHeight(-180, 620) + 17, 620);
  group.add(tower);
  const spire = new THREE.Mesh(
    new THREE.ConeGeometry(9, 12, 4),
    new THREE.MeshLambertMaterial({ color: 0x4a6b8a }),
  );
  spire.position.set(-180, groundHeight(-180, 620) + 40, 620);
  spire.rotation.y = Math.PI / 4;
  group.add(spire);
  return group;
}

function buildTrees() {
  const rng = createRandom(4242);
  const positions = [];
  let tries = 0;
  while (positions.length < 420 && tries < 6000) {
    tries += 1;
    const x = (rng() * 2 - 1) * 1950;
    const z = (rng() * 2 - 1) * 1950;
    const h = groundHeight(x, z);
    if (h < 16 || h > 180) continue;
    let nearStrip = false;
    for (const s of STRIPS) {
      if (Math.hypot(x - s.x, z - s.z) < s.length) { nearStrip = true; break; }
    }
    if (nearStrip) continue;
    if (Math.hypot(x + 180, z - 620) < 260) continue; // keep the town clear
    positions.push([x, h, z, 0.7 + rng() * 0.9]);
  }
  const trunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 5, 5);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a4128 });
  const coneGeo = new THREE.ConeGeometry(4.2, 13, 7);
  const coneMat = new THREE.MeshLambertMaterial({ color: 0x2d5a26 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, positions.length);
  const cones = new THREE.InstancedMesh(coneGeo, coneMat, positions.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();
  positions.forEach(([x, h, z, sc], i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), i * 1.7);
    s.set(sc, sc, sc);
    v.set(x, h + 2.5 * sc, z);
    m.compose(v, q, s);
    trunks.setMatrixAt(i, m);
    v.set(x, h + (5 + 6.5) * sc, z);
    m.compose(v, q, s);
    cones.setMatrixAt(i, m);
  });
  const group = new THREE.Group();
  group.add(trunks);
  group.add(cones);
  return group;
}

function buildClouds() {
  const group = new THREE.Group();
  const rng = createRandom(99);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.88 });
  for (let i = 0; i < 16; i += 1) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(rng() * 3);
    for (let p = 0; p < puffs; p += 1) {
      const r = 26 + rng() * 34;
      const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), mat);
      puff.scale.y = 0.38;
      puff.position.set((rng() - 0.5) * 90, (rng() - 0.5) * 10, (rng() - 0.5) * 50);
      cloud.add(puff);
    }
    cloud.position.set((rng() * 2 - 1) * 1800, 380 + rng() * 180, (rng() * 2 - 1) * 1800);
    cloud.userData.drift = 1.5 + rng() * 2;
    group.add(cloud);
  }
  group.userData.isClouds = true;
  return group;
}

function buildSky() {
  const geo = new THREE.SphereGeometry(6000, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(0x3f7ec2) },
      mid: { value: new THREE.Color(0x9cc8e8) },
      low: { value: new THREE.Color(0xe8ddc0) },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 low;
      void main(){ float h = normalize(vP).y; vec3 c = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.65, h)) : mix(low, mid, smoothstep(-0.08, 0.12, h)); gl_FragColor = vec4(c, 1.0); }`,
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.renderOrder = -10;
  return sky;
}

/** Build every static piece of the valley and return them as one group. */
export function buildValley() {
  const group = new THREE.Group();
  group.add(buildSky());
  group.add(buildTerrainMesh());
  group.add(buildLake());
  group.add(buildRiverWater());
  group.add(buildTown());
  group.add(buildTrees());
  group.add(buildClouds());
  for (const strip of STRIPS) group.add(buildRunway(strip));
  return group;
}
