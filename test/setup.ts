import { gsap } from 'gsap';
import { afterEach } from 'vitest';
import { resetSettings, Tween } from '../src';
import { resetClock } from './clock';

// GSAP never runs on its own in tests: time moves only through advance().
gsap.ticker.remove(gsap.updateRoot);
gsap.ticker.lagSmoothing(0);

afterEach(() => {
  Tween.stopAll();
  resetSettings();
  resetClock();
});
