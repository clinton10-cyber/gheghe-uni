import { Quality } from "../game-assets/js/core/quality.js";

const PRESETS = {
  low: { pixelRatio: 1, antialias: false, shadows: false },
  medium: { pixelRatio: 1.25, antialias: false, shadows: false },
  high: { pixelRatio: 1.5, antialias: true, shadows: true }
};
const KEY = "ghegeh_quality_v1";
let saved = null;
try { saved = localStorage.getItem(KEY); } catch {}
Quality.detect(saved && PRESETS[saved] ? saved : undefined);
const detected = Quality.level === "potato" ? "low" : (PRESETS[Quality.level] ? Quality.level : "medium");
export const GameQuality = {
  level: detected,
  settings: { ...PRESETS[detected], pixelRatio: Math.min(PRESETS[detected].pixelRatio, window.devicePixelRatio || 1) },
  set(level, renderer) {
    const name = PRESETS[level] ? level : "medium"; this.level = name;
    this.settings = { ...PRESETS[name], pixelRatio: Math.min(PRESETS[name].pixelRatio, window.devicePixelRatio || 1) };
    Quality.setLevel(name); try { localStorage.setItem(KEY, name); } catch {}
    if (renderer) { renderer.setPixelRatio(this.settings.pixelRatio); renderer.shadowMap.enabled = this.settings.shadows; renderer.shadowMap.needsUpdate = true; renderer.setSize(window.innerWidth, window.innerHeight); }
    return this.settings;
  }
};
