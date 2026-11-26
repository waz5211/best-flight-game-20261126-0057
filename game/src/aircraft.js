// The mail plane: a stubby high-wing bush plane built from primitives, cream paint with
// a red cheatline, a spinning propeller, wingtip navigation lights and a glass canopy.
// The model faces -Z (three.js forward) and is about 9 m long.
export function buildAircraft() {
  const plane = new THREE.Group();
  const cream = new THREE.MeshLambertMaterial({ color: 0xf2e8d5 });
  const red = new THREE.MeshLambertMaterial({ color: 0xc23b2e });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2b2f33 });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1d3a4a, transparent: true, opacity: 0.85 });
  const metal = new THREE.MeshLambertMaterial({ color: 0x8a8f94 });

  // Fuselage: a tapered cylinder along Z, nose at -Z.
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.55, 7.2, 12), cream);
  body.geometry.rotateX(Math.PI / 2);
  body.position.set(0, 0, 0.4);
  plane.add(body);
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.85, 1.4, 12), red);
  nose.geometry.rotateX(Math.PI / 2);
  nose.position.set(0, 0, -3.6);
  plane.add(nose);
  // Red cheatline stripe along the fuselage.
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.22, 6.6), red);
  stripe.position.set(0, -0.1, 0.4);
  plane.add(stripe);
  // Tail cone.
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.55, 2.2, 10), cream);
  tail.geometry.rotateX(Math.PI / 2);
  tail.position.set(0, 0.15, 4.6);
  plane.add(tail);

  // High wing across the top, slight dihedral via two panels.
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.16, 1.9), cream);
    wing.position.set(side * 2.7, 0.95, -0.3);
    wing.rotation.z = side * -0.06;
    plane.add(wing);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 1.9), red);
    tip.position.set(side * 5.35, 1.12, -0.3);
    tip.rotation.z = side * -0.06;
    plane.add(tip);
    // Wing struts.
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.9, 6), metal);
    strut.position.set(side * 2.2, 0.1, -0.3);
    strut.rotation.z = side * 0.5;
    plane.add(strut);
  }

  // Tailplane and fin.
  const stab = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 1.1), cream);
  stab.position.set(0, 0.35, 5.2);
  plane.add(stab);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.7, 1.5), red);
  fin.position.set(0, 1.0, 5.3);
  fin.rotation.x = 0.25;
  plane.add(fin);

  // Canopy: a glass bubble over the cockpit.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.72, 14, 10), glass);
  canopy.scale.set(1, 0.75, 1.7);
  canopy.position.set(0, 0.75, -1.2);
  plane.add(canopy);

  // Propeller hub + two blades, spinning around Z.
  const prop = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 10), dark);
  hub.geometry.rotateX(Math.PI / 2);
  prop.add(hub);
  for (const a of [0, Math.PI]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.4, 0.08), dark);
    blade.rotation.z = a;
    blade.position.z = -0.2;
    prop.add(blade);
  }
  prop.position.set(0, 0, -4.5);
  plane.add(prop);
  plane.userData.prop = prop;

  // Landing gear: two main wheels + tail wheel.
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 6), metal);
    leg.position.set(side * 0.8, -1.15, -0.6);
    leg.rotation.z = side * 0.25;
    plane.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12), dark);
    wheel.geometry.rotateZ(Math.PI / 2);
    wheel.position.set(side * 1.0, -1.65, -0.6);
    plane.add(wheel);
  }
  const tailWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.16, 10), dark);
  tailWheel.geometry.rotateZ(Math.PI / 2);
  tailWheel.position.set(0, -0.9, 5.4);
  plane.add(tailWheel);

  // Navigation lights: red port, green starboard, white tail — emissive so they glow.
  const navLight = (color, x, y, z) => {
    const light = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 8, 6),
      new THREE.MeshBasicMaterial({ color }),
    );
    light.position.set(x, y, z);
    plane.add(light);
  };
  navLight(0xff2222, -5.5, 1.1, -0.3);
  navLight(0x22ff44, 5.5, 1.1, -0.3);
  navLight(0xffffff, 0, 0.4, 5.7);

  // Cargo pod under the belly — she is a courier, after all.
  const pod = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 2.4), red);
  pod.position.set(0, -1.0, 0.8);
  plane.add(pod);

  plane.traverse((obj) => { if (obj.isMesh) obj.castShadow = true; });
  return plane;
}
