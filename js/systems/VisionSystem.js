import { CFG } from '../core/Config.js';
import { degToRad } from '../core/MathUtils.js';

/**
 * Widzenie drużyny gracza (Sprint 3 — LOS + Fog of War):
 *  - wielokąty widoczności operatorów: stożek FOV (te same stałe co percepcja
 *    wrogów: LOS_FOV_DEG / LOS_RANGE / LOS_RAYS) + krąg "kątem oka" tuż przy
 *    operatorze (PROXIMITY_VISION_TILES). Oba raycastowane po losMask przez
 *    MapData.castRay — okno przepuszcza wzrok, ściana/zamknięte drzwi ucinają.
 *  - zbiór wrogów widocznych dla gracza — dokładnie ten sam test co wielokąty
 *    (DetectionSystem.canSee dla stożka + LOS w kręgu bliskim), więc wróg jest
 *    rysowany wtedy i tylko wtedy, gdy stoi w odsłoniętym obszarze mgły.
 *
 * Czysta logika — rysuje FogRenderer/EntityRenderer. Wołany z fazy RENDERU
 * (nie update), bo mgła musi działać także w PLANNING, gdzie świat stoi.
 * Koszt: operatorzy × 2×LOS_RAYS raycastów na klatkę — pomijalny.
 */
export class VisionSystem {
  /**
   * @param {{map: import('../map/MapData.js').MapData,
   *          detection: import('./DetectionSystem.js').DetectionSystem}} deps
   *   detection wstrzykuje Game (systemy nie importują się nawzajem)
   */
  constructor({ map, detection }) {
    this.map = map;
    this.detection = detection;
  }

  /**
   * @param {import('../entities/Operator.js').Operator[]} operators
   * @param {import('../entities/Enemy.js').Enemy[]} enemies
   * @returns {{polygons: {x:number,y:number}[][], visibleEnemies: Set<import('../entities/Enemy.js').Enemy>}}
   */
  compute(operators, enemies) {
    const polygons = [];
    for (const op of operators) {
      if (!op.alive) continue;
      polygons.push(this._conePolygon(op), this._proximityPolygon(op));
    }

    const visibleEnemies = new Set();
    for (const enemy of enemies) {
      for (const op of operators) {
        if (!op.alive) continue;
        if (this._canSeeEnemy(op, enemy)) {
          visibleEnemies.add(enemy);
          break;
        }
      }
    }
    return { polygons, visibleEnemies };
  }

  /** Stożek FOV lub krąg bliski — spójne z geometrią wielokątów mgły. */
  _canSeeEnemy(op, enemy) {
    if (this.detection.canSee(op, enemy)) return true;
    const dist = Math.hypot(enemy.x - op.x, enemy.y - op.y);
    return dist <= CFG.PROXIMITY_VISION_TILES * this.map.tileSize
      && this.map.hasLineOfSight(op.x, op.y, enemy.x, enemy.y);
  }

  /** Wachlarz stożka widzenia: wierzchołek w operatorze + łuk uciętych promieni. */
  _conePolygon(op) {
    const fov = degToRad(CFG.LOS_FOV_DEG);
    const points = [{ x: op.x, y: op.y }];
    for (let i = 0; i <= CFG.LOS_RAYS; i++) {
      const angle = op.direction - fov / 2 + (fov * i) / CFG.LOS_RAYS;
      const end = this.map.castRay(op.x, op.y, angle, CFG.LOS_RANGE);
      points.push({ x: end.x, y: end.y });
    }
    return points;
  }

  /** Pierścień 360° krótkiego zasięgu — też ucinany na ścianach. */
  _proximityPolygon(op) {
    const range = CFG.PROXIMITY_VISION_TILES * this.map.tileSize;
    const points = [];
    for (let i = 0; i < CFG.LOS_RAYS; i++) {
      const angle = (Math.PI * 2 * i) / CFG.LOS_RAYS;
      const end = this.map.castRay(op.x, op.y, angle, range);
      points.push({ x: end.x, y: end.y });
    }
    return points;
  }
}
