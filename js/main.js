import { MapData } from './map/MapData.js';
import { Game } from './core/Game.js';

async function boot() {
  try {
    if (typeof PF === 'undefined') {
      throw new Error('PathFinding.js nie załadował się z CDN — sprawdź połączenie.');
    }
    const map = await MapData.load('maps/mission_01.json');
    const game = new Game({
      map,
      canvases: {
        map: document.getElementById('map'),
        entities: document.getElementById('entities'),
        fog: document.getElementById('fog'),
      },
    });
    game.start();
  } catch (err) {
    const overlay = document.getElementById('error-overlay');
    overlay.textContent = `BŁĄD\n\n${err.message}`;
    overlay.classList.remove('hidden');
    throw err;
  }
}

boot();
