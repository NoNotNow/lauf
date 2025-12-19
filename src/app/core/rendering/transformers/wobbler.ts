import { Subscription } from 'rxjs';
import { StageItem } from '../../models/game-items/stage-item';
import { TickService } from '../../services/tick.service';

// Applies a gentle wobble (sinusoidal position offset) to a single StageItem using TickService.
// - amplitudeCells: max offset in grid cells (applied on both axes)
// - frequencyHz: oscillations per second
// Each instance gets randomized phases so obstacles don't wobble in sync.
export class Wobbler {
  private sub?: Subscription;
  private _item?: StageItem;
  private _amplitudeCells = 0.15; // cells
  private _frequencyHz = 0.5; // Hz

  // Store base pose and random phase for the item
  private base?: { x0: number; y0: number; phaseX: number; phaseY: number };

  constructor(
    private ticker: TickService,
    item?: StageItem,
    amplitudeCells?: number,
    frequencyHz?: number
  ) {
    if (item) this._item = item;
    if (typeof amplitudeCells === 'number') this._amplitudeCells = amplitudeCells;
    if (typeof frequencyHz === 'number') this._frequencyHz = frequencyHz;
  }

  setItem(item: StageItem | undefined): void {
    this._item = item;
    // Reset base so it's re-initialized for the new item
    this.base = undefined;
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
    this.sub = this.ticker.ticks$.subscribe(({ dtSec }) => this.onTick(dtSec));
  }

  stop(): void {
    this.sub?.unsubscribe();
    this.sub = undefined;
  }

  private elapsed = 0;
  private onTick(dtSec: number): void {
    if (!this._item) return;
    this.elapsed += dtSec;
    const t = this.elapsed;
    const omega = 2 * Math.PI * this._frequencyHz;
    const it = this._item;
    // Ensure Pose and Position exist
    const pose = it.Pose ?? (it.Pose = { Position: undefined as any, Size: undefined as any, Rotation: undefined as any } as any);
    let pos = pose.Position;
    if (!pos) pos = pose.Position = { x: 0, y: 0 } as any;

    // Initialize metadata lazily
    if (!this.base) {
      const x0 = Number(pos.x ?? 0);
      const y0 = Number(pos.y ?? 0);
      this.base = { x0, y0, phaseX: Math.random() * Math.PI * 2, phaseY: Math.random() * Math.PI * 2 };
    }

    const m = this.base;
    const dx = this._amplitudeCells * Math.sin(omega * t + m!.phaseX);
    const dy = this._amplitudeCells * Math.sin(omega * t + m!.phaseY);
    pos.x = m!.x0 + dx;
    pos.y = m!.y0 + dy;
  }
}
