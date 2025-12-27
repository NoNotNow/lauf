import { Subscription } from 'rxjs';
import { StageItem } from '../../models/game-items/stage-item';
import { TickService } from '../../services/tick.service';
import { AxisAlignedBoundingBox } from '../collision';
import { StageItemPhysics, PhysicsState } from '../physics/stage-item-physics';

import { ITransformer } from './transformer.interface';

// Rotates a single StageItem continuously using the TickService.
// - speedDegPerSec: degrees per second
// - direction: +1 for clockwise, -1 for counter-clockwise
export class Rotator implements ITransformer {
  private sub?: Subscription;
  private _item?: StageItem;
  private _phys?: PhysicsState;
  private _speedDegPerSec = 10;
  private _direction: 1 | -1 = 1;
  private _boundary?: AxisAlignedBoundingBox; // no longer used here; kept for API compatibility
  private _bounce = true; // no longer used here; kept for API compatibility

  constructor(
    private ticker: TickService,
    item?: StageItem,
    params?: any
  ) {
    if (item) {
      this._item = item;
      this._phys = StageItemPhysics.get(item);
    }
    
    const speed = params?.speed ?? params?.Speed;
    if (typeof speed === 'number') {
      this._speedDegPerSec = speed;
    } else {
      this._speedDegPerSec = 5 + Math.random() * 25;
    }

    const direction = params?.direction ?? params?.Direction;
    if (direction === 1 || direction === -1) {
      this._direction = direction;
    } else {
      this._direction = Math.random() < 0.5 ? -1 : 1;
    }
  }

  setItem(item: StageItem | undefined): void {
    this._item = item;
    this._phys = item ? StageItemPhysics.get(item) : undefined;
  }

  setSpeed(speedDegPerSec: number): void {
    if (typeof speedDegPerSec === 'number' && !isNaN(speedDegPerSec)) {
      this._speedDegPerSec = speedDegPerSec;
      if (this._phys) {
        // keep physics omega in sync with configured direction*speed
        StageItemPhysics.setAngular_(this._phys, this._direction * this._speedDegPerSec);
      }
    }
  }

  setDirection(direction: 1 | -1): void {
    if (direction === 1 || direction === -1) this._direction = direction;
    if (this._phys) {
      StageItemPhysics.setAngular_(this._phys, this._direction * this._speedDegPerSec);
    }
  }

  setBoundary(boundary: AxisAlignedBoundingBox | undefined): void {
    this._boundary = boundary;
  }

  setBounce(bounce: boolean): void {
    this._bounce = !!bounce;
  }

  start(): void {
    if (this.sub) return;
    // Lightweight subscription only to keep omega synced if someone adjusts parameters during runtime
    this.sub = this.ticker.ticks$.subscribe(() => this.onTick());
    // initialize physics omega
    if (this._phys) {
      StageItemPhysics.setAngular_(this._phys, this._direction * this._speedDegPerSec);
    }
  }

  stop(): void {
    this.sub?.unsubscribe();
    this.sub = undefined;
  }

  private onTick(): void {
    if (!this._phys) return;
    // Keep StageItemPhysics omega aligned with configured speed and direction.
    // We do NOT adopt externally changed omega to avoid losing speed to damping feedback.
    const desired = this._direction * this._speedDegPerSec;
    StageItemPhysics.setAngular_(this._phys, desired);
  }
}
