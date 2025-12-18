import { Subscription } from 'rxjs';
import { StageItem } from '../../models/game-items/stage-item';
import { TickService } from '../../services/tick.service';
import { StageItemPhysics } from '../physics/stage-item-physics';

/**
 * Applies a constant downward acceleration (gravity) to a StageItem.
 * Measured in cells/s^2.
 */
export class Gravity {
  private sub?: Subscription;
  private _item?: StageItem;
  private _acceleration: number = 9.81; // cells/s^2

  constructor(
    private ticker: TickService,
    item?: StageItem,
    acceleration?: number
  ) {
    if (item) this._item = item;
    if (typeof acceleration === 'number') this._acceleration = acceleration;
  }

  setItem(item: StageItem | undefined): void {
    this._item = item;
  }

  setAcceleration(acc: number): void {
    this._acceleration = acc;
  }

  start(): void {
    if (this.sub) return;
    this.sub = this.ticker.ticks$.subscribe(({ time }) => this.onTick(time));
  }

  stop(): void {
    this.sub?.unsubscribe();
    this.sub = undefined;
    this.lastTime = undefined;
  }

  private lastTime?: number;
  private onTick(time: number): void {
    if (!this._item) return;

    const prev = this.lastTime ?? time;
    this.lastTime = time;
    const dtSec = Math.max(0, (time - prev) / 1000);
    if (dtSec === 0) return;
    
    // dtSec is in seconds
    const phys = StageItemPhysics.get(this._item);
    const newVy = phys.vy + this._acceleration * dtSec;
    
    StageItemPhysics.setVelocity(this._item, phys.vx, newVy);
  }
}
