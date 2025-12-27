import { Subscription } from 'rxjs';
import { StageItem } from '../../models/game-items/stage-item';
import { TickService } from '../../services/tick.service';
import { StageItemPhysics, PhysicsState } from '../physics/stage-item-physics';

import { ITransformer } from './transformer.interface';

/**
 * Applies a constant downward acceleration (gravity) to a StageItem.
 * Measured in cells/s^2.
 */
export class Gravity implements ITransformer {
  private sub?: Subscription;
  private _item?: StageItem;
  private _phys?: PhysicsState;
  private _acceleration: number = 9.81; // cells/s^2

  constructor(
    private ticker: TickService,
    item?: StageItem,
    params?: any
  ) {
    if (item) {
      this._item = item;
      this._phys = StageItemPhysics.get(item);
    }
    const acceleration = params?.acceleration ?? params?.Acceleration ?? params;
    if (typeof acceleration === 'number') {
      this._acceleration = acceleration;
    } else {
      this._acceleration = 0.5;
    }
  }

  setItem(item: StageItem | undefined): void {
    this._item = item;
    this._phys = item ? StageItemPhysics.get(item) : undefined;
  }

  setAcceleration(acc: number): void {
    this._acceleration = acc;
  }

  start(): void {
    if (this.sub) return;
    this.sub = this.ticker.ticks$.subscribe(({ dtSec }) => this.onTick(dtSec));
  }

  stop(): void {
    this.sub?.unsubscribe();
    this.sub = undefined;
  }

  private onTick(dtSec: number): void {
    if (!this._phys || dtSec === 0) return;
    
    // dtSec is in seconds
    StageItemPhysics.accelerate(this._phys, 0, this._acceleration, dtSec);
  }
}
