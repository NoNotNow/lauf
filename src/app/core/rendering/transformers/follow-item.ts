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
  force?: number;
}

/**
 * FollowItem: makes a StageItem follow another StageItem.
 * Maintains a specified distance by applying acceleration.
 */
export class FollowItem {
  private sub?: Subscription;
  private _item?: StageItem;
  private _target: StageItem;
  private _distance: number;
  private _maxSpeed: number;
  private _direction: 'horizontal' | 'vertical' | 'both';
  private _force: number;

  constructor(private ticker: TickService, item: StageItem | undefined, options: FollowItemOptions) {
    this._item = item;
    this._target = options.target;
    this._distance = options.distance ?? 0.5;
    this._maxSpeed = options.maxSpeed ?? 0.05;
    this._direction = options.direction ?? 'both';
    this._force = options.force ?? 1.0;
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

    const phys = StageItemPhysics.get(item);
    let vx = phys.vx;
    let vy = phys.vy;

    if (dist <= this._distance) {
      // Already close enough, apply damping to stop moving on affected axes
      const damping = Math.pow(0.5, dt * 10); // Simple damping
      if (this._direction === 'horizontal' || this._direction === 'both') {
        vx *= damping;
        if (Math.abs(vx) < 0.001) vx = 0;
      }
      if (this._direction === 'vertical' || this._direction === 'both') {
        vy *= damping;
        if (Math.abs(vy) < 0.001) vy = 0;
      }
      StageItemPhysics.setVelocity(item, vx, vy);
      return;
    }

    // Calculate desired acceleration direction
    let ax = 0;
    let ay = 0;

    if (this._direction === 'horizontal' || this._direction === 'both') {
      const nx = this._direction === 'horizontal' ? Math.sign(dx) : dx / dist;
      ax = nx * this._force;
    }
    
    if (this._direction === 'vertical' || this._direction === 'both') {
      const ny = this._direction === 'vertical' ? Math.sign(dy) : dy / dist;
      ay = ny * this._force;
    }

    // Apply acceleration
    vx += ax * dt;
    vy += ay * dt;

    // Clamp speed if both or individual axes are managed
    if (this._direction === 'both') {
      const speed = Math.hypot(vx, vy);
      if (speed > this._maxSpeed) {
        const s = this._maxSpeed / speed;
        vx *= s;
        vy *= s;
      }
    } else {
      if (this._direction === 'horizontal') {
        if (Math.abs(vx) > this._maxSpeed) vx = Math.sign(vx) * this._maxSpeed;
      }
      if (this._direction === 'vertical') {
        if (Math.abs(vy) > this._maxSpeed) vy = Math.sign(vy) * this._maxSpeed;
      }
    }

    StageItemPhysics.setVelocity(item, vx, vy);
  }
}
