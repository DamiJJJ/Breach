/**
 * Centralne stałe gry — jedyne źródło "magicznych liczb" (zasada briefu).
 */
export const CFG = {
  TILE_SIZE: 32,            // px

  OPERATOR_SPEED: 150,      // px/s
  OPERATOR_RADIUS: 10,      // px (rysowanie + kolizja klik-zaznaczenie)
  SELECT_RADIUS: 16,        // px w world space — tolerancja kliknięcia w operatora

  LOS_FOV_DEG: 110,
  LOS_RANGE: 200,           // px
  LOS_RAYS: 60,

  ALERT_RADIUS_TILES: 5,
  KICK_ALERT_TILES: 5,
  FLASH_STUN_S: 3,
  PAR_DEFAULT: 90,

  MAX_DT: 1 / 30,           // klamp delty — bez teleportów po pauzie/zakładce
  STEP_MS: 1000 / 60,       // fixed timestep

  ZOOM_MIN: 0.5,
  ZOOM_MAX: 3.0,
  ZOOM_FACTOR: 1.1,         // mnożnik na jeden "klik" kółka
  CAMERA_LERP: 5,           // szybkość doganiania celu przez kamerę (1/s)
};
