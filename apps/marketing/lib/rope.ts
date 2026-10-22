/**
 * A tiny verlet rope for the hanging Z: N points, the first nailed to the
 * anchor, distance constraints that are deliberately soft so the cord
 * stretches like elastic. The last point carries the Z. While dragging, the
 * last point is pinned to the pointer (with rubber-band resistance); on
 * release it keeps the velocity it had, so a flick swings.
 *
 * Units are CSS pixels relative to the anchor; time step is fixed at 1/120s
 * with up to 4 sub-steps per frame, so it behaves the same at 60Hz and 120Hz.
 */
export type RopeConfig = {
  length: number;
  segments?: number;
  gravity?: number;
  damping?: number;
  /** 0–1. Lower is stretchier. */
  stiffness?: number;
  /** Max distance the Z can be pulled from the anchor, as a multiple of length. */
  maxReach?: number;
  /** A slow breeze that keeps it swaying. Off, the rope comes to rest. */
  wind?: boolean;
};

const DT = 1 / 120;

export class Rope {
  readonly n: number;
  readonly x: Float64Array;
  readonly y: Float64Array;
  private ox: Float64Array;
  private oy: Float64Array;
  private seg: number;
  private gravity: number;
  private damping: number;
  private stiffness: number;
  private maxReach: number;
  private wind: boolean;
  private acc = 0;
  private time = 0;
  readonly length: number;
  pin: { x: number; y: number } | null = null;

  constructor(cfg: RopeConfig) {
    this.length = cfg.length;
    this.n = (cfg.segments ?? 12) + 1;
    this.seg = cfg.length / (this.n - 1);
    this.gravity = cfg.gravity ?? 2400;
    this.damping = cfg.damping ?? 0.992;
    this.stiffness = cfg.stiffness ?? 0.55;
    this.maxReach = cfg.maxReach ?? 2.1;
    this.wind = cfg.wind ?? true;
    this.x = new Float64Array(this.n);
    this.y = new Float64Array(this.n);
    this.ox = new Float64Array(this.n);
    this.oy = new Float64Array(this.n);
    for (let i = 0; i < this.n; i++) {
      this.x[i] = this.ox[i] = 0;
      this.y[i] = this.oy[i] = i * this.seg;
    }
  }

  get endX() {
    return this.x[this.n - 1];
  }
  get endY() {
    return this.y[this.n - 1];
  }

  /** Angle of the last segment, in radians, 0 when hanging straight down. */
  get angle() {
    const i = this.n - 1;
    return Math.atan2(this.x[i] - this.x[i - 3], this.y[i] - this.y[i - 3]);
  }

  /** Let go of the end, keeping the pointer's velocity (px/s) so a flick swings. */
  release(vx: number, vy: number) {
    this.pin = null;
    const i = this.n - 1;
    const cap = 2600;
    const s = Math.hypot(vx, vy);
    const k = s > cap ? cap / s : 1;
    this.ox[i] = this.x[i] - vx * k * DT;
    this.oy[i] = this.y[i] - vy * k * DT;
  }

  /** Kick the Z sideways (a tap). */
  nudge(vx: number, vy = 0) {
    const i = this.n - 1;
    this.ox[i] -= vx * DT;
    this.oy[i] -= vy * DT;
  }

  /** Where the pinned end ends up for a pointer at (px, py): rubber band past the cord's length. */
  reach(px: number, py: number) {
    const d = Math.hypot(px, py) || 1;
    const L = this.length;
    if (d <= L) return { x: px, y: py };
    const extra = d - L;
    const max = L * (this.maxReach - 1);
    const eased = max * (1 - Math.exp(-extra / max));
    const k = (L + eased) / d;
    return { x: px * k, y: py * k };
  }

  /** How stretched the cord is right now: 1 at rest length. */
  get stretch() {
    return Math.hypot(this.endX, this.endY) / this.length;
  }

  /** Advance by real elapsed seconds. Returns the end's speed (px/s) for sleep checks. */
  update(elapsed: number): number {
    this.acc += Math.min(elapsed, 1 / 30);
    let steps = 0;
    while (this.acc >= DT && steps < 4) {
      this.step();
      this.acc -= DT;
      steps++;
    }
    const i = this.n - 1;
    return Math.hypot(this.x[i] - this.ox[i], this.y[i] - this.oy[i]) / DT;
  }

  private step() {
    this.time += DT;
    // A slow breeze so the idle Z sways a few degrees instead of hanging dead.
    const wind = this.wind ? Math.sin(this.time * 1.3) * 90 + Math.sin(this.time * 0.47) * 60 : 0;
    const g = this.gravity * DT * DT;
    const w = wind * DT * DT;
    for (let i = 1; i < this.n; i++) {
      const vx = (this.x[i] - this.ox[i]) * this.damping;
      const vy = (this.y[i] - this.oy[i]) * this.damping;
      this.ox[i] = this.x[i];
      this.oy[i] = this.y[i];
      // The Z end is heavier; the breeze mostly moves the cord.
      const windShare = i === this.n - 1 ? 0.6 : (i / this.n) * 0.9;
      this.x[i] += vx + w * windShare;
      this.y[i] += vy + g;
    }
    for (let k = 0; k < 10; k++) {
      this.x[0] = 0;
      this.y[0] = 0;
      for (let i = 0; i < this.n - 1; i++) {
        const dx = this.x[i + 1] - this.x[i];
        const dy = this.y[i + 1] - this.y[i];
        const d = Math.hypot(dx, dy) || 1e-6;
        // Only resist stretching; a slack cord bends freely.
        if (d < this.seg) continue;
        const diff = ((d - this.seg) / d) * this.stiffness;
        // Point 0 is nailed down; the last point (the Z) is 3x as heavy.
        const wa = i === 0 ? 0 : i + 1 === this.n - 1 ? 0.75 : 0.5;
        const wb = i === 0 ? 1 : i + 1 === this.n - 1 ? 0.25 : 0.5;
        this.x[i] += dx * diff * wa;
        this.y[i] += dy * diff * wa;
        this.x[i + 1] -= dx * diff * wb;
        this.y[i + 1] -= dy * diff * wb;
      }
      if (this.pin) {
        const i = this.n - 1;
        this.x[i] = this.pin.x;
        this.y[i] = this.pin.y;
      }
    }
  }

  /** A smooth SVG path through the points. */
  path(): string {
    let d = `M${this.x[0].toFixed(1)} ${this.y[0].toFixed(1)}`;
    for (let i = 1; i < this.n - 1; i++) {
      const mx = (this.x[i] + this.x[i + 1]) / 2;
      const my = (this.y[i] + this.y[i + 1]) / 2;
      d += ` Q${this.x[i].toFixed(1)} ${this.y[i].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
    }
    const e = this.n - 1;
    d += ` L${this.x[e].toFixed(1)} ${this.y[e].toFixed(1)}`;
    return d;
  }
}
