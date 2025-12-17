import { Subscription } from 'rxjs';
import { StageItem } from '../../models/game-items/stage-item';
import { TickService } from '../../services/tick.service';

// Rotates given StageItems continuously using the TickService.
// - speedDegPerSec: degrees per second
// - direction: +1 for clockwise, -1 for counter-clockwise
export class Rotator {
  private sub?: Subscription;
  private lastTime?: number;
  private _items: StageItem[] = [];
  private _speedDegPerSec = 10;
  private _direction: 1 | -1 = 1;

  constructor(
    private ticker: TickService,
    items?: StageItem[],
    speedDegPerSec?: number,
    direction?: 1 | -1
  ) {
    if (items) this._items = items;
    if (typeof speedDegPerSec === 'number') this._speedDegPerSec = speedDegPerSec;
    if (direction === 1 || direction === -1) this._direction = direction;
  }

  setItems(items: StageItem[] | undefined): void {
    this._items = items ?? [];
  }

  setSpeed(speedDegPerSec: number): void {
    if (typeof speedDegPerSec === 'number' && !isNaN(speedDegPerSec)) {
      this._speedDegPerSec = speedDegPerSec;
    }
  }

  setDirection(direction: 1 | -1): void {
    if (direction === 1 || direction === -1) this._direction = direction;
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

  private onTick(time: number): void {
    if (!this._items?.length) {
      this.lastTime = time;
      return;
    }
    const prev = this.lastTime ?? time;
    this.lastTime = time;
    const dtSec = Math.max(0, (time - prev) / 1000);
    if (dtSec === 0) return;

    const delta = this._direction * this._speedDegPerSec * dtSec;
    for (const it of this._items) {
      if (!it?.Pose) continue;
      const r = (Number(it.Pose.Rotation ?? 0) + delta) % 360;
      it.Pose.Rotation = r < 0 ? r + 360 : r;
    }
  }
}
