import { CFG } from '../core/Config.js';

/**
 * Dane mapy + walidacja + obie maski + konwersje tile<->world + pathfinding.
 *
 * Konwencje (sekcja "Konwencje i kontrakty" briefu):
 *  - tiles[row][col] = tiles[y][x]
 *  - PathFinding.js przyjmuje (col, row) = (x, y)
 *  - KAŻDA konwersja tile<->px idzie przez tileToWorld/worldToTile — nigdzie ręcznie.
 *
 * Dwie NIEZALEŻNE maski budowane z tej samej mapy:
 *  - collisionMatrix (RUCH):  wall, window, door(closed) = 1
 *  - losMask (LOS/POCISKI):   wall, door(closed) = 1; window przepuszcza
 */

const TILE = { FLOOR: 'floor', WALL: 'wall', WINDOW: 'window' };
const KNOWN_TILES = new Set(Object.values(TILE));

export class MapData {
  /** @param {object} json — zwalidowany JSON mapy w naszym formacie */
  constructor(json) {
    validateMapJson(json);

    this.id = json.id;
    this.name = json.name;
    this.width = json.width;
    this.height = json.height;
    this.tileSize = json.tileSize ?? CFG.TILE_SIZE;
    this.legend = json.legend;
    this.tiles = json.tiles;
    this.playerSpawns = json.player_spawn;
    this.enemies = json.enemies ?? [];
    this.objectives = json.objectives ?? [];
    this.parTime = json.par_time ?? CFG.PAR_DEFAULT;

    /** Drzwi z runtime'owym stanem: closed / open / breached */
    this.doors = (json.doors ?? []).map((d) => ({ ...d, state: 'closed' }));

    this.widthPx = this.width * this.tileSize;
    this.heightPx = this.height * this.tileSize;

    this.finder = new PF.AStarFinder({ allowDiagonal: true, dontCrossCorners: true });
    this.rebuildMasks();
  }

  /** Wczytuje i waliduje mapę; błędny JSON = czytelny wyjątek, nie cicha porażka. */
  static async load(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Nie można wczytać mapy "${url}" (HTTP ${res.status})`);
    let json;
    try {
      json = await res.json();
    } catch {
      throw new Error(`Mapa "${url}" nie jest poprawnym JSON-em`);
    }
    return new MapData(json);
  }

  /** @returns {string} typ kafelka wg legendy ('floor'|'wall'|'window') */
  tileType(col, row) {
    return this.legend[String(this.tiles[row][col])];
  }

  tileToWorld(col, row) {
    const ts = this.tileSize;
    return { x: col * ts + ts / 2, y: row * ts + ts / 2 };
  }

  worldToTile(x, y) {
    const ts = this.tileSize;
    return { col: Math.floor(x / ts), row: Math.floor(y / ts) };
  }

  inBounds(col, row) {
    return col >= 0 && row >= 0 && col < this.width && row < this.height;
  }

  isWalkable(col, row) {
    return this.inBounds(col, row) && this.collisionMatrix[row][col] === 0;
  }

  blocksLos(col, row) {
    return !this.inBounds(col, row) || this.losMask[row][col] === 1;
  }

  doorAt(col, row) {
    return this.doors.find((d) => d.x === col && d.y === row) ?? null;
  }

  /**
   * Przebudowa obu masek + gridu PF. Wołać po KAŻDEJ zmianie stanu drzwi
   * (kontrakt briefu — drzwi, punkt a i b).
   */
  rebuildMasks() {
    const collision = [];
    const los = [];
    for (let row = 0; row < this.height; row++) {
      const cRow = new Array(this.width);
      const lRow = new Array(this.width);
      for (let col = 0; col < this.width; col++) {
        const type = this.tileType(col, row);
        cRow[col] = type === TILE.WALL || type === TILE.WINDOW ? 1 : 0;
        lRow[col] = type === TILE.WALL ? 1 : 0;
      }
      collision.push(cRow);
      los.push(lRow);
    }
    for (const door of this.doors) {
      const closed = door.state === 'closed' ? 1 : 0;
      collision[door.y][door.x] = closed;
      los[door.y][door.x] = closed;
    }
    this.collisionMatrix = collision;
    this.losMask = los;
    // matrix[y][x]: 0 = przejście, 1 = blokada. Jawne (width, height, matrix) —
    // bundle CDN bywa starszy niż npm i nie zna konstruktora Grid(matrix).
    this.pfGrid = new PF.Grid(this.width, this.height, collision);
  }

  /**
   * Ścieżka w world px (środki kafelków), wygładzona.
   * @returns {{x:number,y:number}[]|null} null gdy cel zablokowany / nieosiągalny
   */
  findPathWorld(fromX, fromY, toX, toY) {
    const start = this.worldToTile(fromX, fromY);
    const end = this.worldToTile(toX, toY);
    if (!this.isWalkable(end.col, end.row) || !this.isWalkable(start.col, start.row)) return null;

    // PF mutuje grid — klon do findPath; smoothenPath tylko czyta, dostaje bazowy grid
    const path = this.finder.findPath(start.col, start.row, end.col, end.row, this.pfGrid.clone());
    if (!path.length) return null;
    const smooth = PF.Util.smoothenPath(this.pfGrid, path);

    const waypoints = smooth.map(([col, row]) => this.tileToWorld(col, row));
    // Pierwszy punkt to środek kafelka startowego — operator już tam stoi (± pół kafelka),
    // pomijamy go, żeby nie cofał się do środka własnego kafelka.
    if (waypoints.length > 1) waypoints.shift();
    return waypoints;
  }
}

function validateMapJson(json) {
  const fail = (msg) => {
    throw new Error(`Błędna mapa "${json?.id ?? '???'}": ${msg}`);
  };

  if (!json || typeof json !== 'object') fail('brak danych');
  for (const key of ['id', 'name', 'width', 'height', 'tiles', 'legend', 'player_spawn']) {
    if (!(key in json)) fail(`brak pola "${key}"`);
  }
  const { width, height, tiles, legend } = json;
  if (!Number.isInteger(width) || width <= 0) fail('"width" musi być dodatnią liczbą całkowitą');
  if (!Number.isInteger(height) || height <= 0) fail('"height" musi być dodatnią liczbą całkowitą');

  if (!Array.isArray(tiles) || tiles.length !== height) {
    fail(`tiles ma ${tiles?.length ?? 0} wierszy, oczekiwano height=${height}`);
  }
  tiles.forEach((rowArr, row) => {
    if (!Array.isArray(rowArr) || rowArr.length !== width) {
      fail(`wiersz tiles[${row}] ma ${rowArr?.length ?? 0} kolumn, oczekiwano width=${width}`);
    }
    rowArr.forEach((v, col) => {
      const type = legend[String(v)];
      if (!type) fail(`tiles[${row}][${col}]=${v} nie występuje w legend`);
      if (!KNOWN_TILES.has(type)) fail(`legend["${v}"]="${type}" — nieznany typ kafelka`);
    });
  });

  const inBounds = (x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < width && y < height;
  const tileTypeAt = (x, y) => legend[String(tiles[y][x])];

  if (!Array.isArray(json.player_spawn) || json.player_spawn.length === 0) {
    fail('player_spawn musi zawierać co najmniej jeden punkt');
  }
  json.player_spawn.forEach((s, i) => {
    if (!inBounds(s.x, s.y)) fail(`player_spawn[${i}] (${s.x},${s.y}) poza mapą`);
    if (tileTypeAt(s.x, s.y) !== TILE.FLOOR) fail(`player_spawn[${i}] (${s.x},${s.y}) nie stoi na floor`);
  });

  (json.doors ?? []).forEach((d, i) => {
    if (!inBounds(d.x, d.y)) fail(`doors[${i}] "${d.id}" (${d.x},${d.y}) poza mapą`);
  });

  (json.enemies ?? []).forEach((e, i) => {
    if (!inBounds(e.x, e.y)) fail(`enemies[${i}] "${e.id}" (${e.x},${e.y}) poza mapą`);
    if (tileTypeAt(e.x, e.y) !== TILE.FLOOR) fail(`enemies[${i}] "${e.id}" (${e.x},${e.y}) nie stoi na floor`);
    (e.patrol ?? []).forEach(([px, py], j) => {
      if (!inBounds(px, py)) fail(`enemies[${i}].patrol[${j}] (${px},${py}) poza mapą`);
    });
  });
}
