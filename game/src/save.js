// Solmar Heat — saving: money, mission progress and position persist in
// localStorage so a session can pick up where it left off.

import { SAVE_KEY } from './config.js';

export class SaveGame {
  static load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (typeof data !== 'object' || data === null) return null;
      return data;
    } catch (err) {
      return null;
    }
  }

  static hasSave() {
    return SaveGame.load() !== null;
  }

  static save(state) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        version: 1,
        savedAt: Date.now(),
        money: Math.floor(state.money),
        missionIndex: state.missionIndex,
        completedMissions: state.completedMissions,
        health: Math.round(state.health),
        x: Math.round(state.x * 10) / 10,
        z: Math.round(state.z * 10) / 10,
        totalEarned: Math.floor(state.totalEarned),
      }));
      return true;
    } catch (err) {
      return false;
    }
  }

  static clear() {
    try { localStorage.removeItem(SAVE_KEY); } catch (err) { /* private mode */ }
  }
}
