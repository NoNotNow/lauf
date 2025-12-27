import { Subscription } from 'rxjs';
import { StageItem } from '../../models/game-items/stage-item';
import { TickService } from '../../services/tick.service';
import { StageItemPhysics, PhysicsState } from '../physics/stage-item-physics';

import { ITransformer } from './transformer.interface';

export interface FollowItemOptions {
  distance:number;
  maxSpeed:number;
  direction?: 'horizontal' | 'vertical';
  force?: number;
}

/**
 * FollowItem: makes a StageItem gently accelerate towards another StageItem.
 */
export class FollowItem implements ITransformer {
  private sub?: Subscription;
  private _phys?: PhysicsState;
  private _options: FollowItemOptions = { distance: 0.4, maxSpeed: 0.2, direction: 'horizontal', force: 0.0001 };

  constructor(private ticker: TickService, private _item: StageItem | undefined, private _target: StageItem, params?: any) {
    if (this._item) {
      this._phys = StageItemPhysics.get(this._item);
    }
    if (params) {
      this._options = {
        distance: params.distance ?? params.Distance ?? 0.4,
        maxSpeed: params.maxSpeed ?? params.MaxSpeed ?? 0.2,
        direction: params.direction ?? params.Direction ?? 'horizontal',
        force: params.force ?? params.Force ?? 0.0001
      };
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

  private onTick(dt: number): void {
    if (!this._item || !this._phys || dt === 0) return;

    const dx = this._target.Pose.Position.x - this._item.Pose.Position.x;
    const dy = this._target.Pose.Position.y - this._item.Pose.Position.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 0.01) return; // Already at target

    let ax = (dx / dist) * this._options.force;
    let ay = (dy / dist) * this._options.force;
    if (this._options.direction === 'vertical') ax = 0;
    if (this._options.direction === 'horizontal') ay = 0;
    StageItemPhysics.accelerate_(this._phys, ax, ay, dt);
  }
}
