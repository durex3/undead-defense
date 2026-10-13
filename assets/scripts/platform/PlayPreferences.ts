import type { StoragePort } from './SaveStore';
export const PLAY_VERSION = '朋友试玩版 0.17.0';
export type Lesson = 'move' | 'xp' | 'upgrade' | 'nova' | 'elite';
const lessons: Lesson[] = ['move', 'xp', 'upgrade', 'nova', 'elite'];
export class PlayPreferences {
  muted = false;
  powerSaving = true;
  completed: Lesson[] = [];
  pending = false;
  private key = 'ashen-survivors-preferences-v1';
  constructor(private storage: StoragePort) {
    try {
      const d = JSON.parse(storage.getItem(this.key) || 'null');
      if (d?.version === 1) {
        this.muted = d.muted === true;
        this.powerSaving = d.powerSaving !== false;
        this.completed = lessons.filter(k => Array.isArray(d.completed) && d.completed.includes(k));
      }
    } catch { /* Invalid preferences must not block play. */ }
  }
  mark(k: Lesson) {
    if (!this.completed.includes(k)) { this.completed.push(k); this.flush(); }
  }
  toggleMute() { this.muted = !this.muted; this.flush(); }
  togglePowerSaving() { this.powerSaving = !this.powerSaving; this.flush(); }
  flush() {
    try {
      this.storage.setItem(this.key, JSON.stringify({version: 1, muted: this.muted, powerSaving: this.powerSaving, completed: this.completed}));
      this.pending = false;
    } catch { this.pending = true; }
  }
}
export function setupWechatShare() {
  const wx = (globalThis as any).wx;
  try {
    wx?.showShareMenu?.({menus: ['shareAppMessage']});
    wx?.onShareAppMessage?.(() => ({title: '余烬幸存者：你能撑过尸潮，击败领主吗？'}));
  } catch { /* Web and unsupported clients retain normal gameplay. */ }
}
