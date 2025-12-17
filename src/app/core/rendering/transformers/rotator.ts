import { Subscription } from 'rxjs';
import { StageItem } from '../../models/game-items/stage-item';
import { TickService } from '../../services/tick.service';
import { poseContainmentAgainstAxisAlignedBoundingBox, AxisAlignedBoundingBox } from '../collision';
import { StageItemPhysics } from '../physics/stage-item-physics';
import { toNumber, normalizeAngleDeg360 } from '../../utils/number-utils';
import { applyAngularToLinearAtBoundary } from '../physics/coupling';

// Rotates a single StageItem continuously using the TickService.
// - speedDegPerSec: degrees per second
// - direction: +1 for clockwise, -1 for counter-clockwise
export class Rotator {
  private sub?: Subscription;
  private lastTime?: number;
  private _item?: StageItem;
  private _speedDegPerSec = 10;
  private _direction: 1 | -1 = 1;
  private _boundary?: AxisAlignedBoundingBox;
  private _bounce = true;

  // ---- Small helpers to keep methods focused ----
  private tryApplyRotationWithinBoundary(pose: any, angle: number): boolean {
    if (!this._boundary) {
      pose.Rotation = normalizeAngleDeg360(angle);
      return true;
    }
    const b: AxisAlignedBoundingBox = this._boundary as AxisAlignedBoundingBox;
    const testPose = {
      Position: { x: toNumber(pose.Position?.x, 0), y: toNumber(pose.Position?.y, 0) },
      Size: { x: toNumber(pose.Size?.x, 0), y: toNumber(pose.Size?.y, 0) },
      Rotation: normalizeAngleDeg360(angle)
    } as any;
    const res = poseContainmentAgainstAxisAlignedBoundingBox(testPose, b);
    if (!res.overlaps) {
      pose.Rotation = testPose.Rotation;
      return true;
    }
    return false;
  }

  private flipDirectionAndBacktrack(item: StageItem | undefined, baseAngle: number, delta: number): number | null {
    if (!this._bounce) return null;
    this._direction = (this._direction === 1 ? -1 : 1);
    if (item) {
      const cur = StageItemPhysics.get(item).omega;
      StageItemPhysics.setAngular(item, -cur || -this._direction * this._speedDegPerSec);
    }
    const backtrack = (delta) * -0.5; // half step in the opposite direction
    return baseAngle + backtrack;
  }

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
      if (this._item) {
        // keep physics omega in sync with configured direction*speed
        StageItemPhysics.setAngular(this._item, this._direction * this._speedDegPerSec);
      }
    }
  }

  setDirection(direction: 1 | -1): void {
    if (direction === 1 || direction === -1) this._direction = direction;
    if (this._item) {
      StageItemPhysics.setAngular(this._item, this._direction * this._speedDegPerSec);
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
    this.lastTime = undefined;
    this.sub = this.ticker.ticks$.subscribe(({ time }) => this.onTick(time));
    // initialize physics omega if possible
    if (this._item) {
      StageItemPhysics.setAngular(this._item, this._direction * this._speedDegPerSec);
    }
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

    // prefer physics omega for angular velocity if present
    const physOmega = this._item ? StageItemPhysics.get(this._item).omega : (this._direction * this._speedDegPerSec);
    const delta = physOmega * dtSec;
    const it = this._item;
    if (!it?.Pose) return;
    const pose = it.Pose as any;
    const r0 = toNumber(pose.Rotation, 0);

    const r1 = r0 + delta;
    if (this.tryApplyRotationWithinBoundary(pose, r1)) return;

    // Collision on proposed rotation
    if (!this._bounce) return; // Do not rotate into collision

    // Determine collision normal at proposed rotation to transfer spin into linear velocity
    if (this._boundary) {
      const b: AxisAlignedBoundingBox = this._boundary as AxisAlignedBoundingBox;
      const testPose = {
        Position: { x: toNumber(pose.Position?.x, 0), y: toNumber(pose.Position?.y, 0) },
        Size: { x: toNumber(pose.Size?.x, 0), y: toNumber(pose.Size?.y, 0) },
        Rotation: normalizeAngleDeg360(r1)
      } as any;
      const res = poseContainmentAgainstAxisAlignedBoundingBox(testPose, b);
      if (res.overlaps) {
        const restitution = StageItemPhysics.get(it).restitution ?? 1.0;
        applyAngularToLinearAtBoundary(it, pose as any, res.normal, 0.35, restitution);
      }
    }

    // Dampen angular velocity instead of naïvely flipping; small backtrack to avoid penetration
    const phys = StageItemPhysics.get(it);
    StageItemPhysics.setAngular(it, phys.omega * 0.6);
    const backtracked = r0 + (delta * -0.25);
    if (this.tryApplyRotationWithinBoundary(pose, backtracked)) return;
    // As a fallback, keep original angle (no change this tick)
  }
}
