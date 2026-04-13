import * as THREE from 'three';

/**
 * Cabina de ascensor en una casilla del grid; puertas hacia +Z (sur) — el jugador
 * espera en la casilla (gx, gz+1).
 */
export function buildElevatorStation(gridToWorldFn, gx, gz) {
  const w = gridToWorldFn(gx, gz);
  const lift = new THREE.Group();
  lift.position.set(w.x, 0, w.z);

  const metal = new THREE.MeshStandardMaterial({
    color: 0x454e5c,
    roughness: 0.52,
    metalness: 0.42,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x2a323c,
    roughness: 0.68,
    metalness: 0.24,
  });

  const back = new THREE.Mesh(new THREE.BoxGeometry(0.92, 1.34, 0.09), metal);
  back.position.set(0, 0.67, -0.465);
  back.castShadow = true;
  lift.add(back);

  const left = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.34, 0.92), metal);
  left.position.set(-0.465, 0.67, 0);
  left.castShadow = true;
  lift.add(left);

  const right = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.34, 0.92), metal);
  right.position.set(0.465, 0.67, 0);
  right.castShadow = true;
  lift.add(right);

  const top = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.11, 0.92), metal);
  top.position.set(0, 1.315, 0);
  top.castShadow = true;
  lift.add(top);

  const floor = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.05, 0.88), dark);
  floor.position.set(0, 0.025, 0);
  floor.receiveShadow = true;
  lift.add(floor);

  const hi = new THREE.MeshStandardMaterial({
    color: 0xf0b429,
    roughness: 0.45,
    metalness: 0.12,
    emissive: 0xaa7722,
    emissiveIntensity: 0.14,
  });
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.038, 0.94), hi);
  strip.position.set(0, 1.08, 0);
  lift.add(strip);

  const doorGeo = new THREE.BoxGeometry(0.43, 1.08, 0.055);
  const doorL = new THREE.Mesh(doorGeo, metal);
  doorL.position.set(-0.215, 0.58, 0.465);
  doorL.castShadow = true;
  lift.add(doorL);
  const doorR = new THREE.Mesh(doorGeo, metal);
  doorR.position.set(0.215, 0.58, 0.465);
  doorR.castShadow = true;
  lift.add(doorR);

  const btnMat = new THREE.MeshStandardMaterial({
    color: 0x2d8a5c,
    roughness: 0.4,
    metalness: 0.2,
    emissive: 0x0a3d20,
    emissiveIntensity: 0.25,
  });
  const btn = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.085, 0.025), btnMat);
  btn.position.set(0.48, 0.9, 0.38);
  lift.add(btn);

  const doorLClosedX = doorL.position.x;
  const doorRClosedX = doorR.position.x;

  return {
    liftGroup: lift,
    doorL,
    doorR,
    doorLClosedX,
    doorRClosedX,
    doorOpenAmt: 0.36,
    dispose(scene) {
      scene.remove(lift);
      lift.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry?.dispose();
          const m = o.material;
          if (Array.isArray(m)) m.forEach((x) => x?.dispose());
          else m?.dispose();
        }
      });
    },
  };
}
