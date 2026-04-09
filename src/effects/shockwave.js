import * as THREE from 'three';

/**
 * Anillo expansivo en el suelo: espectáculo circular; el empuje sigue siendo lineal en la lógica.
 */
export class Shockwave {
  constructor(scene) {
    this.scene = scene;
    this.mesh = null;
    this.active = false;
    this.time = 0;
  }

  /**
   * @param {number} x - mundo X
   * @param {number} z - mundo Z
   * @param {number} [color=0x00ffff] - tinte según contexto (misma paleta que antes)
   */
  trigger(x, z, color = 0x00ffff) {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this.mesh = null;
    }

    const geometry = new THREE.RingGeometry(0.2, 0.4, 32);

    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.set(x, 0.05, z);
    this.mesh.scale.set(0.5, 0.5, 0.5);

    this.scene.add(this.mesh);

    this.active = true;
    this.time = 0;
  }

  update(delta) {
    if (!this.active || !this.mesh) return;

    this.time += delta;

    const speed = 6;
    const scale = 0.5 + this.time * speed;
    this.mesh.scale.set(scale, scale * 0.6, scale);

    this.mesh.material.opacity = Math.max(0, 0.6 - this.time * 1.5);

    if (this.time > 0.5) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this.mesh = null;
      this.active = false;
    }
  }
}
