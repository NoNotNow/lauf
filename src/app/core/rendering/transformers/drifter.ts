import { Subscription } from 'rxjs';
import { StageItem } from '../../models/game-items/stage-item';
import { TickService } from '../../services/tick.service';
import { AxisAlignedBoundingBox } from '../collision';
import { StageItemPhysics } from '../physics/stage-item-physics';
import { toNumber } from '../../utils/number-utils';

// Moves a single StageItem with a (slow) velocity vector. Optionally bounces within a boundary.
// - directionalVelocityMax: cap for the velocity magnitude (cells/sec)
// - boundary: optional rectangle in cell coordinates; when set and bounce=true, item bounces off edges
// - bounce: whether to reflect velocity at the boundary (default true)
export class Drifter {
  private sub?: Subscription;
  private _item?: StageItem;
  private _vx = 0; // desired cells/sec
  private _vy = 0; // desired cells/sec
  private _directionalVelocityMax = 0.1; // cells/sec
  private _boundary?: AxisAlignedBoundingBox; // no longer used here; kept for API compatibility
  private _bounce = true; // no longer used here; kept for API compatibility

  constructor(
    private ticker: TickService,
    item?: StageItem,
    directionalVelocityMax?: number,
    boundary?: AxisAlignedBoundingBox,
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

  setBoundary(boundary: AxisAlignedBoundingBox | undefined): void {
    this._boundary = boundary;
  }

  setBounce(bounce: boolean): void {
    this._bounce = !!bounce;
  }

  // Explicitly set velocity (cells/sec). Will be clamped to the configured max magnitude.
  setVelocity(vx: number, vy: number): void {
    this._vx = toNumber(vx, 0);
    this._vy = toNumber(vy, 0);
    this.clampVelocityToMax();
    if (this._item) {
      StageItemPhysics.setVelocity(this._item, this._vx, this._vy);
    }
  }

  start(): void {
    if (this.sub) return;
    // Keep a lightweight subscription to keep velocity clamped/synchronized if someone changes StageItemPhysics externally.
    this.sub = this.ticker.ticks$.subscribe(() => this.onTick());
  }

  stop(): void {
    this.sub?.unsubscribe();
    this.sub = undefined;
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

  private onTick(): void {
    // Keep StageItemPhysics in sync with our desired velocity and clamped limits
    const it = this._item;
    if (!it) return;
    const phys = StageItemPhysics.get(it);
    // If someone externally changed physics velocity, adopt it but clamp to max
    this._vx = toNumber(phys.vx ?? this._vx, this._vx);
    this._vy = toNumber(phys.vy ?? this._vy, this._vy);
    this.clampVelocityToMax();
    StageItemPhysics.setVelocity(it, this._vx, this._vy);
  }
}
