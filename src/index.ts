/**
 * teemo-tween: one-line tweens, sequences and game-feel presets for web games, built on GSAP.
 *
 * @packageDocumentation
 */
export { Tween } from './core/tween';
export type {
  ColorOptions,
  CustomOptions,
  CycleMode,
  NumberOptions,
  PositionOptions,
  PropertiesOptions,
  PunchOptions,
  ScaleOptions,
  ShakeOptions,
  TweenOptions,
  Vec2,
} from './core/tween';
export { Sequence } from './core/sequence';
export type { SequenceOptions } from './core/sequence';
export { Ease, EASE_NAMES, eases, resolveEase } from './core/ease';
export type { EaseFunction, EaseName } from './core/ease';
export {
  configure,
  getSettings,
  hitStop,
  isReducedMotion,
  resetSettings,
} from './core/settings';
export type {
  MotionKind,
  ReducedBehavior,
  ReducedMotionMode,
  ReducedMotionPolicy,
  Settings,
  SettingsInput,
} from './core/settings';
export type { TweenTarget, Value } from './core/target';
