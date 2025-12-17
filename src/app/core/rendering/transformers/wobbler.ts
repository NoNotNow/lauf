import { Subscription } from 'rxjs';
import { StageItem } from '../../models/game-items/stage-item';
import { TickService } from '../../services/tick.service';

// Applies a gentle wobble (sinusoidal position offset) to given StageItems using TickService.
// - amplitudeCells: max offset in grid cells (applied on both axes)
// - frequencyHz: oscillations per second
// Each item gets randomized phases so they don't wobble in sync.
export class Wobbler {
  private sub?: Subscription;
  private _items: StageItem[] = [];
  private _amplitudeCells = 0.15; // cells
  private _frequencyHz = 0.5; // Hz

  // Store base pose and random phase per item
  private meta = new WeakMap<StageItem, { x0: number; y0: number; phaseX: number; phaseY: number }>();

  constructor(
    private ticker: TickService,
    items?: StageItem[],
    amplitudeCells?: number,
    frequencyHz?: number
  ) {
    if (items) this._items = items;
    if (typeof amplitudeCells === 'number') this._amplitudeCells = amplitudeCells;
    if (typeof frequencyHz === 'number') this._frequencyHz = frequencyHz;
  }

  setItems(items: StageItem[] | undefined): void {
    this._items = items ?? [];
    // Populate metadata for new items lazily during ticks
  }

  setAmplitude(amplitudeCells: number): void {
    if (typeof amplitudeCells === 'number' && !isNaN(amplitudeCells)) {
      this._amplitudeCells = amplitudeCells;
    }
  }

  setFrequency(frequencyHz: number): void {
    if (typeof frequencyHz === 'number' && !isNaN(frequencyHz)) {
      this._frequencyHz = frequencyHz;
    }
  }

  start(): void {
    if (this.sub) return;
    this.sub = this.ticker.ticks$.subscribe(({ time }) => this.onTick(time));
  }

  stop(): void {
    this.sub?.unsubscribe();
    this.sub = undefined;
  }

  private onTick(timeMs: number): void {
    if (!this._items?.length) return;
    const t = Math.max(0, timeMs) / 1000; // seconds
    const omega = 2 * Math.PI * this._frequencyHz;

    for (const it of this._items) {
      if (!it) continue;
      // Ensure Pose and Position exist
      const pose = it.Pose ?? (it.Pose = { Position: undefined as any, Size: undefined as any, Rotation: undefined as any } as any);
      let pos = pose.Position;
      if (!pos) pos = pose.Position = { x: 0, y: 0 } as any;

      // Initialize metadata lazily
      let m = this.meta.get(it);
      if (!m) {
        const x0 = Number(pos.x ?? 0);
        const y0 = Number(pos.y ?? 0);
        m = { x0, y0, phaseX: Math.random() * Math.PI * 2, phaseY: Math.random() * Math.PI * 2 };
        this.meta.set(it, m);
      }

      const dx = this._amplitudeCells * Math.sin(omega * t + m.phaseX);
      const dy = this._amplitudeCells * Math.sin(omega * t + m.phaseY);
      pos.x = m.x0 + dx;
      pos.y = m.y0 + dy;
    }
  }
}
