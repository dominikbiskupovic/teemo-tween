import { configure, Ease, EASE_NAMES, resolveEase, Sequence, Tween, type CycleMode, type EaseName } from 'teemo-tween';
import * as P from 'teemo-tween/presets';
import './style.css';

interface Example {
  group: 'presets' | 'core';
  title: string;
  code: string;
  /** Builds the stage contents; returns what `play` needs. */
  build: (stage: HTMLElement) => HTMLElement[];
  play: (els: HTMLElement[], stage: HTMLElement) => unknown;
}

const tile = (stage: HTMLElement, label = '', cls = ''): HTMLElement => {
  const d = document.createElement('div');
  d.className = `tile ${cls}`.trim();
  d.textContent = label;
  stage.append(d);
  return d;
};
const tiles = (n: number, labels = ''): ((stage: HTMLElement) => HTMLElement[]) => (stage) =>
  Array.from({ length: n }, (_, i) => tile(stage, labels[i] ?? '', 'small'));

const examples: Example[] = [
  // ------------------------------------------------------------ presets
  {
    group: 'presets', title: 'popIn / popOut',
    code: `await popIn(el)\nawait Tween.delay(0.4)\npopOut(el)`,
    build: (s) => [tile(s, '★')],
    play: async ([el]) => { await P.popIn(el!); await Tween.delay(0.4); await P.popOut(el!); P.popIn(el!); },
  },
  {
    group: 'presets', title: 'punchScale',
    code: `punchScale(el, { strength: 0.25 })`,
    build: (s) => [tile(s, '+1')],
    play: ([el]) => P.punchScale(el!, { strength: 0.25 }),
  },
  {
    group: 'presets', title: 'shake',
    code: `shake(el, { strength: 8 })`,
    build: (s) => [tile(s, '✕', 'bad')],
    play: ([el]) => P.shake(el!, { strength: 8 }),
  },
  {
    group: 'presets', title: 'traumaShake',
    code: `// trauma² amplitude, noise motion\ntraumaShake(stage, { trauma: 0.9 })`,
    build: (s) => [tile(s, '💥')],
    play: (_, stage) => P.traumaShake(stage, { trauma: 0.9 }),
  },
  {
    group: 'presets', title: 'impact',
    code: `impact(el, { strength: 1, hitStop: 0.06 })`,
    build: (s) => [tile(s, 'HIT', 'bad')],
    play: ([el]) => P.impact(el!, { strength: 1, hitStop: 0.06 }),
  },
  {
    group: 'presets', title: 'wiggle',
    code: `wiggle(el, { angle: 12 })`,
    build: (s) => [tile(s, '🔔')],
    play: ([el]) => P.wiggle(el!, { angle: 12 }),
  },
  {
    group: 'presets', title: 'dropIn + squashStretch',
    code: `dropIn(el, { height: 60 })`,
    build: (s) => [tile(s, 'K')],
    play: ([el]) => P.dropIn(el!, { height: 60 }),
  },
  {
    group: 'presets', title: 'punchWave',
    code: `punchWave(letters, { step: 0.05 })`,
    build: tiles(5, 'CHAIN'),
    play: (els) => P.punchWave(els, { step: 0.05, strength: 0.3 }),
  },
  {
    group: 'presets', title: 'staggerIn',
    code: `staggerIn(cards, { each: 0.06 })`,
    build: tiles(5, '12345'),
    play: (els) => P.staggerIn(els, { each: 0.06 }),
  },
  {
    group: 'presets', title: 'slideIn / slideOut',
    code: `await slideOut(el, { to: 'right' })\nslideIn(el, { from: 'left' })`,
    build: (s) => [tile(s, '→')],
    play: async ([el]) => { await P.slideOut(el!, { to: 'right' }); P.slideIn(el!, { from: 'left' }); },
  },
  {
    group: 'presets', title: 'bob / pulse',
    code: `const b = bob(a)          // forever\nconst p = pulse(b2)\n// later: b.stop(); p.stop()`,
    build: (s) => [tile(s, '☁'), tile(s, '♥', 'good')],
    play: ([a, b]) => {
      if (Tween.isTweening(a!)) { Tween.stopAll(a!); Tween.stopAll(b!); return; }
      P.bob(a!); P.pulse(b!);
    },
  },
  {
    group: 'presets', title: 'flash',
    code: `flash(el, { brightness: 2.4 })`,
    build: (s) => [tile(s, '⚡')],
    play: ([el]) => P.flash(el!, { brightness: 2.4 }),
  },
  {
    group: 'presets', title: 'countUp',
    code: `countUp(score, { to: 12840, locale: 'hr-HR' })`,
    build: (s) => [tile(s, '0', 'wide number')],
    play: ([el]) => P.countUp(el!, { from: 0, to: 12840, locale: 'hr-HR', duration: 1.2 }),
  },
  {
    group: 'presets', title: 'meterFill',
    code: `meterFill(bar, { value: Math.random() })`,
    build: (s) => {
      const track = tile(s, '', 'track');
      const bar = document.createElement('div');
      bar.className = 'bar';
      track.append(bar);
      return [bar];
    },
    play: ([bar]) => P.meterFill(bar!, { value: 0.15 + Math.random() * 0.85 }),
  },
  {
    group: 'presets', title: 'typewriter',
    code: `typewriter(el, { text: 'Bravo! Riješeno.' })`,
    build: (s) => [tile(s, '', 'wide text')],
    play: ([el]) => P.typewriter(el!, { text: 'Bravo! Riješeno.', speed: 24 }),
  },
  {
    group: 'presets', title: 'fadeIn / fadeOut',
    code: `await fadeOut(el)\nfadeIn(el)`,
    build: (s) => [tile(s, '◐')],
    play: async ([el]) => { await P.fadeOut(el!); P.fadeIn(el!); },
  },

  // ------------------------------------------------------------ core
  {
    group: 'core', title: 'Tween.position',
    code: `Tween.position(el, {\n  to: { x: 0, y: -24 },\n  duration: 0.3, ease: 'outBack',\n  cycles: 2, cycleMode: 'yoyo',\n})`,
    build: (s) => [tile(s, '↑')],
    play: ([el]) => Tween.position(el!, { to: { x: 0, y: -24 }, duration: 0.3, ease: 'outBack', cycles: 2, cycleMode: 'yoyo' }),
  },
  {
    group: 'core', title: 'Tween.scale / rotation',
    code: `Tween.scale(el, { from: 0.4, to: 1, ease: Ease.OutElastic, duration: 0.8 })\nTween.rotation(el, { from: -90, to: 0, ease: Ease.OutBack })`,
    build: (s) => [tile(s, '⟳')],
    play: ([el]) => {
      Tween.scale(el!, { from: 0.4, to: 1, ease: Ease.OutElastic, duration: 0.8 });
      Tween.rotation(el!, { from: -90, to: 0, ease: Ease.OutBack, duration: 0.5 });
    },
  },
  {
    group: 'core', title: 'Tween.color / alpha',
    code: `Tween.color(el, { to: '#5be3a4', cycles: 2, cycleMode: 'yoyo' })`,
    build: (s) => [tile(s, '🎨')],
    play: ([el]) => Tween.color(el!, { to: '#5be3a4', duration: 0.35, cycles: 2, cycleMode: 'yoyo' }),
  },
  {
    group: 'core', title: 'cycle modes',
    code: `// one row each: restart, yoyo, rewind, incremental\nTween.position(el, { to: { x: 40 }, cycles: 3, cycleMode, ease: 'inQuad' })`,
    build: (s) => {
      s.classList.add('rows');
      return (['restart', 'yoyo', 'rewind', 'incremental'] as const).map((m) => tile(s, m, 'pill'));
    },
    play: (els) => {
      const modes: CycleMode[] = ['restart', 'yoyo', 'rewind', 'incremental'];
      els.forEach((el, i) => {
        const cycleMode = modes[i]!;
        Tween.position(el, { from: { x: -60 }, to: { x: cycleMode === 'incremental' ? -20 : 40 }, duration: 0.5, cycles: 3, cycleMode, ease: 'inQuad' });
      });
    },
  },
  {
    group: 'core', title: 'Sequence',
    code: `Sequence.create()\n  .chain(Tween.scale(el, { to: 1.3 }))\n  .group(Tween.rotation(el, { to: 15 }))\n  .chainDelay(0.1)\n  .chain(Tween.scale(el, { to: 1, ease: 'outBack' }))\n  .group(Tween.rotation(el, { to: 0 }))\n  .insert(0.15, Tween.shakePosition(el, { strength: 5 }))`,
    build: (s) => [tile(s, '1-2-3')],
    play: ([el]) =>
      Sequence.create()
        .chain(Tween.scale(el!, { to: 1.3 }))
        .group(Tween.rotation(el!, { to: 15 }))
        .chainDelay(0.1)
        .chain(Tween.scale(el!, { to: 1, ease: 'outBack' }))
        .group(Tween.rotation(el!, { to: 0 }))
        .insert(0.15, Tween.shakePosition(el!, { strength: 5 })),
  },
  {
    group: 'core', title: 'Ease explorer',
    code: `// all 30 easings.net curves + linear\nTween.position(dot, { to: { x: 200 }, ease: Ease.OutBack })\n// or ease: 'outBack', or configure({ defaultEase: Ease.OutBack })`,
    build: (s) => {
      s.classList.add('ease-explorer');
      const select = document.createElement('select');
      select.setAttribute('aria-label', 'Ease');
      for (const name of EASE_NAMES) {
        const key = name[0]!.toUpperCase() + name.slice(1);
        select.add(new Option(`Ease.${key}`, name, false, name === 'outBack'));
      }
      const c = document.createElement('canvas');
      c.width = 240; c.height = 110; c.className = 'canvas curve';
      const track = tile(s, '', 'track ease-track');
      const dot = document.createElement('div');
      dot.className = 'dot';
      track.append(dot);
      s.insertBefore(c, track);
      // A select can't live inside the stage button: put it in the card header.
      s.closest('.card')!.querySelector('.meta')!.append(select);
      const draw = () => {
        const ctx = c.getContext('2d')!;
        const f = resolveEase(select.value as EaseName);
        const styles = getComputedStyle(document.documentElement);
        ctx.clearRect(0, 0, 240, 110);
        ctx.strokeStyle = styles.getPropertyValue('--line');
        ctx.strokeRect(20.5, 25.5, 200, 60);
        ctx.strokeStyle = '#ff8a3d';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let i = 0; i <= 100; i++) {
          const x = 20 + i * 2;
          const y = 85 - f(i / 100) * 60;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      };
      select.addEventListener('change', () => { draw(); s.closest<HTMLElement>('.stage')!.click(); });
      draw();
      return [dot, select];
    },
    play: ([dot, select]) => {
      const ease = (select as HTMLSelectElement).value as EaseName;
      return Tween.position(dot!, { from: { x: 0 }, to: { x: 196 }, duration: 0.9, ease, reducedMotion: 'animate' });
    },
  },
  {
    group: 'core', title: 'Tween.custom on a canvas',
    code: `Tween.custom({\n  from: 0, to: 1, duration: 1, ease: 'outBounce',\n  onValueChange: (v) => draw(v),\n})`,
    build: (s) => {
      const c = document.createElement('canvas');
      c.width = 240; c.height = 120; c.className = 'canvas';
      s.append(c);
      return [c];
    },
    play: ([c]) => {
      const ctx = (c as HTMLCanvasElement).getContext('2d')!;
      const draw = (v: number) => {
        ctx.clearRect(0, 0, 240, 120);
        ctx.fillStyle = '#ffb547';
        ctx.beginPath();
        ctx.arc(120, 14 + v * 86, 14, 0, Math.PI * 2);
        ctx.fill();
      };
      return Tween.custom({ from: 0, to: 1, duration: 1, ease: 'outBounce', onValueChange: draw });
    },
  },
  {
    group: 'core', title: 'replacement rule',
    code: `// click fast: the new tween takes over x\n// from wherever the old one stopped\nTween.position(el, { to: { x: side * 50 }, duration: 0.6 })`,
    build: (s) => [tile(s, '⇄')],
    play: ([el]) => {
      const side = el!.dataset.side === '1' ? -1 : 1;
      el!.dataset.side = side === 1 ? '1' : '0';
      return Tween.position(el!, { to: { x: side * 50 }, duration: 0.6, ease: 'inOutCubic' });
    },
  },
  {
    group: 'core', title: 'await + callbacks',
    code: `await Tween.punchScale(el, { strength: 0.3 })\nawait Tween.delay(0.2)\nel.textContent = 'done!'`,
    build: (s) => [tile(s, 'go')],
    play: async ([el]) => {
      el!.textContent = 'go';
      await Tween.punchScale(el!, { strength: 0.3 });
      await Tween.delay(0.2);
      el!.textContent = 'done!';
    },
  },
];

// ------------------------------------------------------------ render the page

const escape = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
const highlight = (code: string) =>
  escape(code)
    .replace(/(\/\/.*)/g, '<span class="c">$1</span>')
    .replace(/('[^']*')/g, '<span class="s">$1</span>')
    .replace(/\b(await|const|return)\b/g, '<span class="k">$1</span>')
    .replace(/\b(Tween|Sequence|Ease)\b/g, '<span class="t">$1</span>');

const players: Array<() => void> = [];

for (const ex of examples) {
  const card = document.createElement('article');
  card.className = 'card';
  card.innerHTML = `
    <button class="stage" type="button" aria-label="Play ${ex.title}"></button>
    <div class="meta"><h3>${ex.title}</h3><span class="hint">click to play</span></div>
    <pre><code>${highlight(ex.code)}</code></pre>`;
  const stage = card.querySelector<HTMLElement>('.stage')!;
  const inner = document.createElement('div');
  inner.className = 'stage-inner';
  stage.append(inner);
  const els = ex.build(inner);
  const play = () => void ex.play(els, inner);
  stage.addEventListener('click', play);
  players.push(play);
  document.querySelector(`[data-group="${ex.group}"]`)!.append(card);
}

// ------------------------------------------------------------ toolbar

const reduced = document.querySelector<HTMLInputElement>('#reduced')!;
const speed = document.querySelector<HTMLInputElement>('#speed')!;
const speedOut = document.querySelector<HTMLOutputElement>('#speed-out')!;

reduced.checked = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const applyReduced = () => configure({ reducedMotion: reduced.checked ? 'always' : 'never' });
applyReduced();
reduced.addEventListener('change', applyReduced);

speed.addEventListener('input', () => {
  const v = Number(speed.value);
  configure({ timeScale: v });
  speedOut.textContent = `${v.toFixed(2).replace(/\.?0+$/, '')}×`;
});

document.querySelector('#play-all')!.addEventListener('click', () => {
  players.forEach((p, i) => Tween.delay(i * 0.08, p));
});

// A small hello on load.
const logo = document.querySelector<HTMLElement>('#logo')!;
P.dropIn(logo, { height: 30, startDelay: 0.2 });
logo.addEventListener('click', () => P.impact(logo, { strength: 0.6 }));
P.staggerIn(document.querySelectorAll<HTMLElement>('.card'), {
  each: 0.025,
  animate: (t) => P.slideIn(t, { distance: 18, duration: 0.45 }),
});
