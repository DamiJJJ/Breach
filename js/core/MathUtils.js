/**
 * Matematyka kątów. Konwencja jak w Entity.direction: radiany,
 * 0 = w prawo, oś Y w dół (czyli +90° = w dół ekranu).
 */

/** @param {number} deg stopnie @returns {number} radiany */
export function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Najmniejsza różnica kątowa from -> to, ze znakiem, w [-PI, PI].
 * Odporna na nieznormalizowane wejście.
 */
export function angleDiff(from, to) {
  const d = to - from;
  return Math.atan2(Math.sin(d), Math.cos(d));
}
