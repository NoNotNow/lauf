import { Subscription } from 'rxjs';
import { StageItem } from '../../models/game-items/stage-item';
import { TickService } from '../../services/tick.service';
import { AxisAlignedBoundingBox } from '../collision';
import { StageItemPhysics, PhysicsState } from '../physics/stage-item-physics';
import { toNumber } from '../../utils/number-utils';

import { ITransformer } from './transformer.interface';

// Moves a single StageItem with a (slow) velocity vector. Optionally bounces within a boundary.
// - directionalVelocityMax: cap for the velocity magnitude (cells/sec)
// - boundary: optional rectangle in cell coordinates; when set and bounce=true, item bounces off edges
// - bounce: whether to reflect velocity at the boundary (default true)
export class Drifter implements ITransformer {
  private sub?: Subscription;
  private _item?: StageItem;
  private _phys?: PhysicsState;
  private _vx = 0; // desired cells/sec
  private _vy = 0; // desired cells/sec
  private _directionalVelocityMax = 0.1; // cells/sec
  private _boundary?: AxisAlignedBoundingBox; // no longer used here; kept for API compatibility
  private _bounce = true; // no longer used here; kept for API compatibility

  constructor(
    private ticker: TickService,
    item?: StageItem,
    params?: any,
    boundary?: AxisAlignedBoundingBox
  ) {
    if (item) {
      this._item = item;
      this._phys = StageItemPhysics.get(item);
    }
    this._boundary = boundary;

    const maxSpeed = params?.maxSpeed ?? params?.MaxSpeed;
    if (typeof maxSpeed === 'number') {
      this._directionalVelocityMax = maxSpeed;
    } else {
      this._directionalVelocityMax = 0.02 + Math.random() * 15;
    }

    const vx = params?.vx ?? params?.Vx;
    const vy = params?.vy ?? params?.Vy;

    if (typeof vx === 'number' && typeof vy === 'number') {
      this.setVelocity(vx, vy);
    } else {
      this.setRandomVelocity(this._directionalVelocityMax);
    }

    if (params?.bounce !== undefined) {
      this._bounce = !!params.bounce;
    }
  }

  private setRandomVelocity(maxSpeed: number): void {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * (maxSpeed / 2);
    this.setVelocity(
      Math.cos(angle) * speed,
      Math.sin(angle) * speed
    );
  }

  setItem(item: StageItem | undefined): void {
    this._item = item;
    this._phys = item ? StageItemPhysics.get(item) : undefined;
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
    if (this._phys) {
      StageItemPhysics.setVelocity_(this._phys, this._vx, this._vy);
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
    if (!this._phys) return;
    
    // We should NOT adopt externally changed velocities if they are caused by damping
    // because that would lead to a feedback loop where we eventually stop.
    // Instead, we just ensure the physics state has our desired velocity.
    StageItemPhysics.setVelocity_(this._phys, this._vx, this._vy);
  }
}
