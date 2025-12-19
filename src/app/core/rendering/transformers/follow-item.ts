import { Subscription } from 'rxjs';
import { StageItem } from '../../models/game-items/stage-item';
import { TickService } from '../../services/tick.service';
import { StageItemPhysics } from '../physics/stage-item-physics';
import { toNumber } from '../../utils/number-utils';

export interface FollowItemOptions {
  target: StageItem;
  distance?: number;
  maxSpeed?: number;
  direction?: 'horizontal' | 'vertical' | 'both';
}

/**
 * FollowItem: makes a StageItem follow another StageItem.
 * Maintains a specified distance and moves up to a maximum speed.
 */
export class FollowItem {
  private sub?: Subscription;
  private _item?: StageItem;
  private _target: StageItem;
  private _distance: number;
  private _maxSpeed: number;
  private _direction: 'horizontal' | 'vertical' | 'both';

  constructor(private ticker: TickService, item: StageItem | undefined, options: FollowItemOptions) {
    this._item = item;
    this._target = options.target;
    this._distance = options.distance ?? 0.5;
    this._maxSpeed = options.maxSpeed ?? 0.05;
    this._direction = options.direction ?? 'both';
  }

  setItem(item: StageItem | undefined): void {
    this._item = item;
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
    const item = this._item;
    const target = this._target;
    if (!item || !target || dt === 0) return;

    const pos = item.Pose.Position;
    const targetPos = target.Pose.Position;

    const dx = targetPos.x - pos.x;
    const dy = targetPos.y - pos.y;
    
    // Calculate distance based on effective axes
    let dist: number;
    if (this._direction === 'horizontal') {
      dist = Math.abs(dx);
    } else if (this._direction === 'vertical') {
      dist = Math.abs(dy);
    } else {
      dist = Math.hypot(dx, dy);
    }

    if (dist <= this._distance) {
      // Already close enough, stop moving on affected axes
      const currentVx = this._direction === 'vertical' ? StageItemPhysics.get(item).vx : 0;
      const currentVy = this._direction === 'horizontal' ? StageItemPhysics.get(item).vy : 0;
      StageItemPhysics.setVelocity(item, currentVx, currentVy);
      return;
    }

    // Calculate desired velocity
    let vx = 0;
    let vy = 0;

    if (this._direction === 'horizontal' || this._direction === 'both') {
      const nx = this._direction === 'horizontal' ? Math.sign(dx) : dx / dist;
      vx = nx * this._maxSpeed;
    }
    
    if (this._direction === 'vertical' || this._direction === 'both') {
      const ny = this._direction === 'vertical' ? Math.sign(dy) : dy / dist;
      vy = ny * this._maxSpeed;
    }

    // Preserve existing velocity on unmanaged axes if needed
    if (this._direction === 'horizontal') {
        vy = StageItemPhysics.get(item).vy;
    } else if (this._direction === 'vertical') {
        vx = StageItemPhysics.get(item).vx;
    }

    StageItemPhysics.setVelocity(item, vx, vy);
  }
}
