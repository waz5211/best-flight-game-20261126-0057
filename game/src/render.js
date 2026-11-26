// The three.js view: renderer, chase camera, sun and sky light, the glowing survey
// rings, and the beacon that marks the next objective. The camera trails the plane and
// never fights the pilot — mouse drag only offsets the view, it never steers.
import { buildValley } from './terrain.js';
import { buildAircraft } from './aircraft.js';
import { LEGS } from './missions.js';
import { RING_RADIUS } from './config.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xbfd9ea, 900, 4200);

  const sun = new THREE.DirectionalLight(0xfff2d8, 1.35);
  sun.position.set(900, 1400, 600);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260;
  sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260;
  sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 4000;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfd9ea, 0x5a6b4a, 0.85));

  scene.add(buildValley());

  const plane = buildAircraft();
  scene.add(plane);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 9000);

  // Rings: a torus each, gold while waiting, green once flown, plus a beacon column
  // of light over the next ring so it can be found from across the valley.
  const ringGroup = new THREE.Group();
  scene.add(ringGroup);
  const ringGeo = new THREE.TorusGeometry(RING_RADIUS, 1.1, 12, 40);
  const beaconGeo = new THREE.CylinderGeometry(2.2, 2.2, 500, 10, 1, true);
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0xffc44d, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false,
  });
  let ringMeshes = [];
  let beacon = null;

  const markerGeo = new THREE.ConeGeometry(6, 18, 4);
  const markerMat = new THREE.MeshBasicMaterial({ color: 0xffb02e });
  const destMarker = new THREE.Mesh(markerGeo, markerMat);
  destMarker.rotation.x = Math.PI;
  scene.add(destMarker);

  const camPos = new THREE.Vector3();
  const camTarget = new THREE.Vector3();
  let look = { x: 0, y: 0 };
  let cameraSnapped = false;

  function setRings(rings) {
    for (const mesh of ringMeshes) ringGroup.remove(mesh);
    ringMeshes = rings.map((ring) => {
      const mat = new THREE.MeshBasicMaterial({ color: ring.passed ? 0x37c978 : 0xffc44d });
      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.position.set(ring.x, ring.y, ring.z);
      ringGroup.add(mesh);
      return mesh;
    });
    if (beacon) ringGroup.remove(beacon);
    beacon = new THREE.Mesh(beaconGeo, beaconMat);
    ringGroup.add(beacon);
  }

  function updateRings(rings, nextIndex) {
    rings.forEach((ring, i) => {
      const mesh = ringMeshes[i];
      if (!mesh) return;
      mesh.material.color.setHex(ring.passed ? 0x37c978 : 0xffc44d);
      mesh.rotation.y += 0.002;
    });
    if (beacon && rings[nextIndex]) {
      const ring = rings[nextIndex];
      beacon.visible = true;
      beacon.position.set(ring.x, ring.y + 240, ring.z);
    } else if (beacon) {
      beacon.visible = false;
    }
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return {
    setRings,
    setLook(nextLook) {
      look = nextLook;
    },
    /** Put the chase camera exactly on its target spot on the next draw. */
    snapCamera() {
      cameraSnapped = false;
    },
    draw(state, mission, time) {
      // Plane first: the camera math below reads the plane's orientation.
      plane.position.copy(state.pos);
      plane.rotation.set(state.pitch, state.yaw, state.roll, 'YXZ');
      plane.userData.prop.rotation.z -= 0.35 + state.throttle * 1.6;

      // Chase camera: behind and above the plane, eased toward its spot each frame.
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(plane.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(plane.quaternion);
      const back = fwd.clone().multiplyScalar(-16 - state.speed * 0.07);
      const lift = up.clone().multiplyScalar(5.0 + look.y * 6);
      const side = new THREE.Vector3().crossVectors(fwd, up).multiplyScalar(look.x * 10);
      camTarget.copy(state.pos).add(back).add(lift).add(side);
      if (!cameraSnapped) {
        camPos.copy(camTarget);
        cameraSnapped = true;
      } else {
        camPos.lerp(camTarget, 0.12);
      }
      camera.position.copy(camPos);
      camera.up.copy(up).lerp(new THREE.Vector3(0, 1, 0), 0.35).normalize();
      camera.lookAt(state.pos.x + fwd.x * 30, state.pos.y + fwd.y * 30 + 1, state.pos.z + fwd.z * 30);
      // Keep the shadow frustum near the plane.
      sun.position.set(state.pos.x + 300, state.pos.y + 500, state.pos.z + 200);
      sun.target.position.copy(state.pos);
      sun.target.updateMatrixWorld();

      updateRings(mission.rings, mission.ringIndex);
      // Destination marker: a bobbing chevron over the strip to land at, once the rings are done.
      const showDest = !mission.complete && mission.ringIndex >= mission.rings.length;
      if (showDest) {
        const strip = LEGS[mission.legIndex].to;
        destMarker.visible = true;
        destMarker.position.set(strip.x, strip.elevation + 60 + Math.sin(time * 2) * 6, strip.z);
        destMarker.rotation.y = time * 0.8;
      } else {
        destMarker.visible = false;
      }
      // Cloud drift.
      scene.traverse((obj) => {
        if (obj.userData && obj.userData.isClouds) {
          obj.children.forEach((cloud) => {
            cloud.position.x += cloud.userData.drift * 0.016;
            if (cloud.position.x > 2100) cloud.position.x = -2100;
          });
        }
      });
      renderer.render(scene, camera);
    },
  };
}
