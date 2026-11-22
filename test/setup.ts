import { afterEach } from 'vitest';
import { resetSettings, Tween } from '../src';
import { resetClock, useManualClock } from '../src/core/clock';

// The frame loop never runs on its own in tests: time moves only through advance(), and native
// animations are paused and seeked to the exact time, so every assertion is deterministic.
useManualClock();

afterEach(() => {
  Tween.stopAll();
  resetSettings();
  resetClock();
  document.body.replaceChildren();
});
