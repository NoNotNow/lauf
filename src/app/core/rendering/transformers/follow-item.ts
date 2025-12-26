import { Subscription } from 'rxjs';
import { StageItem } from '../../models/game-items/stage-item';
import { TickService } from '../../services/tick.service';
import { StageItemPhysics } from '../physics/stage-item-physics';

// "TargetId": "Avatar",
//     "Distance": 0.4,
//     "maxSpeed": 0.2,
//     "force": 0.0001,
//     "direction": "horizontal"


export interface FollowItemOptions {
  distance:number;
  maxSpeed:number;
  direction?: 'horizontal' | 'vertical';
  force?: number;
}

/**
 * FollowItem: makes a StageItem gently accelerate towards another StageItem.
 */
export class FollowItem {
  private sub?: Subscription;
  private _options: FollowItemOptions = { distance: 0.4, maxSpeed: 0.2, direction: 'horizontal', force: 0.0001 };

  constructor(private ticker: TickService, private _item: StageItem | undefined, private _target: StageItem, options?: FollowItemOptions) {
    if(options) this._options = options;
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
    if (!this._item || dt === 0) return;

    const dx = this._target.Pose.Position.x - this._item.Pose.Position.x;
    const dy = this._target.Pose.Position.y - this._item.Pose.Position.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 0.01) return; // Already at target

    const ax = (dx / dist) * this._options.force;
    const ay = (dy / dist) * this._options.force;

    StageItemPhysics.accelerate(this._item, ax, ay, dt);
  }
}
