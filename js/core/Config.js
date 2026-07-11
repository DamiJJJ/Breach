/**
 * Centralne stałe gry — jedyne źródło "magicznych liczb" (zasada briefu).
 */
export const CFG = {
  TILE_SIZE: 32,            // px

  OPERATOR_SPEED: 150,      // px/s
  OPERATOR_RADIUS: 10,      // px (rysowanie + kolizja klik-zaznaczenie)
  OPERATOR_TURN_RATE: Math.PI * 3, // rad/s — obrót w miejscu (węzeł WATCH)
  SELECT_RADIUS: 16,        // px w world space — tolerancja kliknięcia w operatora

  LOS_FOV_DEG: 110,
  LOS_RANGE: 200,           // px
  LOS_RAYS: 60,

  PROXIMITY_VISION_TILES: 1.5, // widzenie 360° "kątem oka" wokół operatora (mgła + widoczność wrogów)
  FOG_COLOR: '#05070c',        // kolor przyciemnienia mgły
  FOG_DIM_ALPHA: 0.55,         // teren poza aktualnym wzrokiem: przyciemniony, nie zakryty
                               // (operatorzy znają plan obiektu — decyzja projektowa)
  FOG_REVEAL_PX: 12,           // przedłużenie promieni mgły w głąb blokującego kafelka,
                               // żeby obserwowana ściana/drzwi były odsłonięte, nie przyciemnione

  ENEMY_SPEED: 100,         // px/s
  ENEMY_RADIUS: 10,         // px (rysowanie)
  ENEMY_TURN_RATE: Math.PI * 2, // rad/s — obrót wroga w miejscu (ALERT/powrót)
  ALERT_COOLDOWN_S: 4,      // ile sekund bez kontaktu wróg zostaje w ALERT
  PATROL_PAUSE_S: 1,        // postój na punkcie patrolu

  ALERT_RADIUS_TILES: 5,
  KICK_ALERT_TILES: 5,
  DOOR_OPEN_SLOW_S: 0.8,    // czas cichego otwarcia drzwi
  DOOR_INTERACT_TILES: 1.5, // maks. odległość operator-środek drzwi dla akcji
  PAR_DEFAULT: 90,

  // Gadżety — Sprint 7 (brief #9: jeden slot na operatora)
  GADGET_COUNT: { FLASHBANG: 2, BREACH_CHARGE: 1 }, // zapas użyć na misję
  FLASH_STUN_S: 3,          // czas ogłuszenia (brief)
  FLASH_RADIUS_TILES: 3,    // promień ogłuszenia (brief); błysk nie przechodzi przez ściany
  FLASH_THROW_TILES: 6,     // maks. zasięg rzutu (dalej: operator podchodzi)
  FLASH_FUSE_S: 0.5,        // lot + zapalnik granatu
  FLASH_ALERT_TILES: 7,     // huk wybuchu — alarm przez ściany, jak strzał
  FLASH_EFFECT_S: 0.3,      // czas życia wizualnego rozbłysku
  BREACH_PLANT_S: 1.5,      // podłożenie ładunku (potem natychmiastowy wybuch)
  BREACH_ALERT_TILES: 8,    // wybuch słychać dalej niż kopniak
  BREACH_STUN_TILES: 3,     // zasięg ogłuszenia stożka breach
  BREACH_CONE_DEG: 90,      // stożek ogłuszenia od drzwi w głąb (brief)

  // Walka (hitscan) — Sprint 5
  OPERATOR_HP: 100,
  ENEMY_HP: { light: 50, heavy: 100, armored: 150 }, // HP wg klasy pancerza wroga
  OPERATOR_DAMAGE: 34,          // obrażenia na strzał
  ENEMY_DAMAGE: 18,
  OPERATOR_AIM_S: 0.25,         // ciągły kontakt wzrokowy przed pierwszym strzałem
  ENEMY_AIM_S: 0.7,             // wolniejszy — przybliża briefowe "ALERT: 1 s przed COMBAT"
  OPERATOR_FIRE_COOLDOWN_S: 0.35, // kadencja (brief: co X ms zależnie od broni)
  ENEMY_FIRE_COOLDOWN_S: 0.9,
  SHOT_ALERT_TILES: 7,          // hałas wystrzału operatora — przez ściany, jak KICK
  TRACER_TTL_S: 0.07,           // czas życia smugi (brief: ~50–80 ms)
  TRACER_POOL: 64,              // rozmiar puli tracerów — zero new w gorącej pętli

  MAX_DT: 1 / 30,           // klamp delty — bez teleportów po pauzie/zakładce
  STEP_MS: 1000 / 60,       // fixed timestep

  ZOOM_MIN: 0.5,
  ZOOM_MAX: 3.0,
  ZOOM_FACTOR: 1.1,         // mnożnik na jeden "klik" kółka
  CAMERA_LERP: 5,           // szybkość doganiania celu przez kamerę (1/s)
};
