import { Subscription } from 'rxjs';
import { StageItem } from '../../models/game-items/stage-item';
import { TickService } from '../../services/tick.service';
import { poseContainmentAgainstAABB, AABB } from '../collision';
import { BoundaryRect } from './drifter';

// Rotates a single StageItem continuously using the TickService.
// - speedDegPerSec: degrees per second
// - direction: +1 for clockwise, -1 for counter-clockwise
export class Rotator {
  private sub?: Subscription;
  private lastTime?: number;
  private _item?: StageItem;
  private _speedDegPerSec = 10;
  private _direction: 1 | -1 = 1;
  private _boundary?: BoundaryRect;
  private _bounce = true;

  constructor(
    private ticker: TickService,
    item?: StageItem,
    speedDegPerSec?: number,
    direction?: 1 | -1
  ) {
    if (item) this._item = item;
    if (typeof speedDegPerSec === 'number') this._speedDegPerSec = speedDegPerSec;
    if (direction === 1 || direction === -1) this._direction = direction;
  }

  setItem(item: StageItem | undefined): void {
    this._item = item;
  }

  setSpeed(speedDegPerSec: number): void {
    if (typeof speedDegPerSec === 'number' && !isNaN(speedDegPerSec)) {
      this._speedDegPerSec = speedDegPerSec;
    }
  }

  setDirection(direction: 1 | -1): void {
    if (direction === 1 || direction === -1) this._direction = direction;
  }

  setBoundary(boundary: BoundaryRect | undefined): void {
    this._boundary = boundary;
  }

  setBounce(bounce: boolean): void {
    this._bounce = !!bounce;
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
    if (!this._item) {
      this.lastTime = time;
      return;
    }
    const prev = this.lastTime ?? time;
    this.lastTime = time;
    const dtSec = Math.max(0, (time - prev) / 1000);
    if (dtSec === 0) return;

    const delta = this._direction * this._speedDegPerSec * dtSec;
    const it = this._item;
    if (!it?.Pose) return;
    const pose = it.Pose as any;
    const r0 = Number(pose.Rotation ?? 0);
    const norm = (a: number) => {
      let x = a % 360;
      if (x < 0) x += 360;
      return x;
    };
    const tryApply = (angle: number): boolean => {
      if (!this._boundary) {
        pose.Rotation = norm(angle);
        return true;
      }
      const b: AABB = this._boundary as AABB;
      const testPose = {
        Position: { x: Number(pose.Position?.x ?? 0), y: Number(pose.Position?.y ?? 0) },
        Size: { x: Number(pose.Size?.x ?? 0), y: Number(pose.Size?.y ?? 0) },
        Rotation: norm(angle)
      } as any;
      const res = poseContainmentAgainstAABB(testPose, b);
      if (!res.overlaps) {
        pose.Rotation = testPose.Rotation;
        return true;
      }
      return false;
    };

    const r1 = r0 + delta;
    if (tryApply(r1)) return;

    // Collision on proposed rotation
    if (!this._bounce) {
      // Do not rotate into collision
      return;
    }

    // Flip direction and try a smaller backtrack step to mimic bounce
    this._direction = (this._direction === 1 ? -1 : 1);
    const backtrack = (delta) * -0.5; // half step in the opposite direction
    const r2 = r0 + backtrack;
    if (tryApply(r2)) return;

    // As a fallback, keep original angle (no change this tick)
  }
}
