/**
 * Paleta y parámetros de escena: instalación militar, estilo low-poly / diorama.
 */

export const MilitaryTheme = {
  sceneBackground: 0x1a1e26,
  fogColor: 0x232830,
  fogNear: 20,
  fogFar: 48,

  /** Suelo damero (concreto / loseta técnica). */
  floorA: 0x3d474f,
  floorB: 0x343c44,

  /** Muros / obstáculos metálicos. */
  wallColor: 0x5a6575,
  wallMetalness: 0.38,
  wallRoughness: 0.68,

  /** Plataforma bajo el tablero. */
  baseColor: 0x252a32,
  baseRoughness: 0.92,

  ambientLightColor: 0xb8c4d4,
  ambientIntensity: 0.32,
  hemisphereSky: 0x7a8fa3,
  hemisphereGround: 0x1c2026,
  hemisphereIntensity: 0.42,

  /** Luz principal (taller / hangar). */
  keyLightColor: 0xe8f0ff,
  keyLightIntensity: 0.88,
  keyLightPosition: [14, 22, 12],

  /** Relleno desde el lado opuesto. */
  fillLightColor: 0x6a7a90,
  fillLightIntensity: 0.22,
  fillLightPosition: [-10, 12, -8],

  /** Punto tenue estilo alerta (muy bajo). */
  accentLightColor: 0xff5533,
  accentLightIntensity: 0.12,
  accentLightPosition: [6, 8, -6],

  /** Jugador: traje táctico + visor telequinético. */
  playerSuit: 0x3a4f5c,
  playerHelmet: 0x2a3338,
  playerVisor: 0x00c9b0,
  playerVisorEmissive: 0x00ffc8,

  /**
   * Seguridad interna de la instalación (uniforme acorde al suelo / muros).
   * Chaser: patrulla, franja reflectante fría. Static: puesto, alta visibilidad ámbar.
   */
  securityShirt: 0x334b5f,
  securityShirtDark: 0x2a3d4e,
  securityVest: 0x232c35,
  securityPants: 0x262f38,
  securityCap: 0x1a222a,
  securitySkin: 0xffc84a,
  securityStripeChaser: 0xb8c8d4,
  securityStripeStatic: 0xf0b429,
};
