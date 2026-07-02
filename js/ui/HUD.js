/**
 * HUD — logika HTML overlay (#hud). Manipuluje DOM, nie canvas (decyzja #5).
 */
const STATE_LABELS = {
  PLANNING: 'PLANOWANIE',
  EXECUTING: 'AKCJA',
  RESULT: 'WYNIK',
};

export class HUD {
  constructor() {
    this.badge = document.getElementById('state-badge');
    this.missionName = document.getElementById('mission-name');
    this.errorOverlay = document.getElementById('error-overlay');
  }

  setMission(name) {
    this.missionName.textContent = name;
  }

  /** @param {'PLANNING'|'EXECUTING'|'RESULT'} state */
  setState(state) {
    this.badge.textContent = STATE_LABELS[state] ?? state;
    this.badge.className = `badge ${state.toLowerCase()}`;
  }

  showError(message) {
    this.errorOverlay.textContent = `BŁĄD\n\n${message}`;
    this.errorOverlay.classList.remove('hidden');
  }
}
