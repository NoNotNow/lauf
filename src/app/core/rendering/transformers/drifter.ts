import { Subscription } from 'rxjs';
import { StageItem } from '../../models/game-items/stage-item';
import { TickService } from '../../services/tick.service';

export interface BoundaryRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// Moves a single StageItem with a (slow) velocity vector. Optionally bounces within a boundary.
// - directionalVelocityMax: cap for the velocity magnitude (cells/sec)
// - boundary: optional rectangle in cell coordinates; when set and bounce=true, item bounces off edges
// - bounce: whether to reflect velocity at the boundary (default true)
export class Drifter {
  private sub?: Subscription;
  private lastTime?: number;
  private _item?: StageItem;
  private _vx = 0; // cells/sec
  private _vy = 0; // cells/sec
  private _directionalVelocityMax = 0.1; // cells/sec
  private _boundary?: BoundaryRect;
  private _bounce = true;

  constructor(
    private ticker: TickService,
    item?: StageItem,
    directionalVelocityMax?: number,
    boundary?: BoundaryRect,
    bounce: boolean = true
  ) {
    if (item) this._item = item;
    if (typeof directionalVelocityMax === 'number') this._directionalVelocityMax = directionalVelocityMax;
    if (boundary) this._boundary = boundary;
    this._bounce = !!bounce;
  }

  setItem(item: StageItem | undefined): void {
    this._item = item;
  }

  setDirectionalVelocityMax(max: number): void {
    if (typeof max === 'number' && !isNaN(max)) {
      this._directionalVelocityMax = Math.max(0, max);
      this.clampVelocityToMax();
    }
  }

  setBoundary(boundary: BoundaryRect | undefined): void {
    this._boundary = boundary;
  }

  setBounce(bounce: boolean): void {
    this._bounce = !!bounce;
  }

  // Explicitly set velocity (cells/sec). Will be clamped to the configured max magnitude.
  setVelocity(vx: number, vy: number): void {
    this._vx = Number(vx) || 0;
    this._vy = Number(vy) || 0;
    this.clampVelocityToMax();
  }

  start(): void {
    if (this.sub) return;
    this.lastTime = undefined;
    this.sub = this.ticker.ticks$.subscribe(({ time }) => this.onTick(time));
  }

  stop(): void {
    this.sub?.unsubscribe();
    this.sub = undefined;
    this.lastTime = undefined;
  }

  private clampVelocityToMax(): void {
    const vMax = this._directionalVelocityMax;
    if (vMax <= 0) {
      this._vx = 0;
      this._vy = 0;
      return;
    }
    const mag = Math.hypot(this._vx, this._vy);
    if (mag > vMax) {
      const s = vMax / (mag || 1);
      this._vx *= s;
      this._vy *= s;
    }
  }

  private onTick(time: number): void {
    const it = this._item;
    if (!it) {
      this.lastTime = time;
      return;
    }
    const prev = this.lastTime ?? time;
    this.lastTime = time;
    const dtSec = Math.max(0, (time - prev) / 1000);
    if (dtSec === 0) return;

    // Ensure Pose and Position exist
    const pose = it.Pose ?? (it.Pose = { Position: undefined as any, Size: undefined as any, Rotation: undefined as any } as any);
    let pos = pose.Position;
    if (!pos) pos = pose.Position = { x: 0, y: 0 } as any;

    let x = Number(pos.x ?? 0) + this._vx * dtSec;
    let y = Number(pos.y ?? 0) + this._vy * dtSec;

    if (this._boundary) {
      const b = this._boundary;
      if (this._bounce) {
        // Bounce like a ball off walls: clamp to edge and reflect velocity component
        if (x < b.minX) {
          x = b.minX;
          this._vx = Math.abs(this._vx);
        } else if (x > b.maxX) {
          x = b.maxX;
          this._vx = -Math.abs(this._vx);
        }
        if (y < b.minY) {
          y = b.minY;
          this._vy = Math.abs(this._vy);
        } else if (y > b.maxY) {
          y = b.maxY;
          this._vy = -Math.abs(this._vy);
        }
      } else {
        // If not bouncing, just clamp to the boundary
        x = Math.max(b.minX, Math.min(b.maxX, x));
        y = Math.max(b.minY, Math.min(b.maxY, y));
      }
    }

    pos.x = x;
    pos.y = y;
  }
}
