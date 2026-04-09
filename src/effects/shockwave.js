import * as THREE from 'three';

/**
 * Onda en línea sobre el suelo: se estira y avanza en la dirección del shift.
 */
export class Shockwave {
  constructor(scene) {
    this.scene = scene;
    this.mesh = null;
    this.active = false;
    this.time = 0;
    this.dirX = 0;
    this.dirZ = 0;
  }

  /**
   * @param {number} x - mundo X (ej. desde gridToWorld)
   * @param {number} z - mundo Z
   * @param {number} dirX - dirección grid / mundo en X
   * @param {number} dirZ - dirección grid / mundo en Z
   * @param {number} [color=0x00ffff] - cian base; rojo/amarillo/morado según acción
   */
  trigger(x, z, dirX, dirZ, color = 0x00ffff) {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this.mesh = null;
    }

    const geometry = new THREE.PlaneGeometry(1, 1);

    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.rotation.y = Math.atan2(dirX, dirZ);

    this.mesh.position.set(x, 0.06, z);

    this.mesh.scale.set(0.5, 0.5, 0.5);

    this.scene.add(this.mesh);

    this.active = true;
    this.time = 0;

    this.dirX = dirX;
    this.dirZ = dirZ;
  }

  update(delta) {
    if (!this.active || !this.mesh) return;

    this.time += delta;

    const speed = 8;
    const length = Math.max(0.4, this.time * speed);

    this.mesh.scale.set(1.4, length, 1);

    this.mesh.position.x += this.dirX * delta * speed * 0.5;
    this.mesh.position.z += this.dirZ * delta * speed * 0.5;

    this.mesh.material.opacity = Math.max(0, 0.65 - this.time * 1.6);

    if (this.time > 0.45) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this.mesh = null;
      this.active = false;
    }
  }
}
