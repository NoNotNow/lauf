import { Subscription } from 'rxjs';
import { StageItem } from '../../models/game-items/stage-item';
import { TickService } from '../../services/tick.service';
import { poseContainmentAgainstAxisAlignedBoundingBox, AxisAlignedBoundingBox } from '../collision';
import { StageItemPhysics } from '../physics/stage-item-physics';
import { reflectVelocity, TINY_NUDGE } from '../physics/bounce';
import { applyAngularToLinearAtBoundary } from '../physics/coupling';
import { toNumber, clamp } from '../../utils/number-utils';

// Moves a single StageItem with a (slow) velocity vector. Optionally bounces within a boundary.
// - directionalVelocityMax: cap for the velocity magnitude (cells/sec)
// - boundary: optional rectangle in cell coordinates; when set and bounce=true, item bounces off edges
// - bounce: whether to reflect velocity at the boundary (default true)
export class Drifter {
  private sub?: Subscription;
  private lastTime?: number;
  private _item?: StageItem;
  private _vx = 0; // cells/sec
  private _vy = 0; // cells/sec
  private _directionalVelocityMax = 0.1; // cells/sec
  private _boundary?: AxisAlignedBoundingBox;
  private _bounce = true;

  // ---- Small helpers to keep methods focused ----
  private ensurePoseAndPosition(item: StageItem): { pose: any; pos: any } {
    const pose = item.Pose ?? (item.Pose = { Position: undefined as any, Size: undefined as any, Rotation: undefined as any } as any);
    const pos = pose.Position ?? (pose.Position = { x: 0, y: 0 } as any);
    return { pose, pos };
  }

  private syncVelocityFromPhysics(item: StageItem): void {
    const phys = StageItemPhysics.get(item);
    this._vx = toNumber(phys.vx ?? this._vx, this._vx);
    this._vy = toNumber(phys.vy ?? this._vy, this._vy);
  }

  private integratePosition(pos: { x: number; y: number }, dtSec: number): { x: number; y: number } {
    const x = toNumber(pos.x, 0) + this._vx * dtSec;
    const y = toNumber(pos.y, 0) + this._vy * dtSec;
    return { x, y };
  }

  private applyBoundaryContainmentAndBounce(
    item: StageItem,
    pose: any,
    x: number,
    y: number
  ): { x: number; y: number } {
    if (!this._boundary) return { x, y };
    const b: AxisAlignedBoundingBox = this._boundary as AxisAlignedBoundingBox;
    const testPose = {
      Position: { x, y },
      Size: { x: toNumber(pose.Size?.x, 0), y: toNumber(pose.Size?.y, 0) },
      Rotation: toNumber(pose.Rotation, 0)
    } as any;

    const res = poseContainmentAgainstAxisAlignedBoundingBox(testPose, b);
    if (res.overlaps) {
      // Correct position by MTV
      x += res.minimalTranslationVector.x;
      y += res.minimalTranslationVector.y;

      if (this._bounce) {
        // Reflect velocity around collision normal with restitution
        const restitution = StageItemPhysics.get(item).restitution ?? 1.0;
        const v = reflectVelocity({ x: this._vx, y: this._vy }, res.normal, restitution);
        this._vx = v.x;
        this._vy = v.y;
        // tiny nudge along normal to avoid re-penetration due to numeric issues
        x += res.normal.x * TINY_NUDGE;
        y += res.normal.y * TINY_NUDGE;
        // Transfer some spin into linear along the tangent; also damps omega
        applyAngularToLinearAtBoundary(item, pose as any, res.normal, 0.35, restitution);
        // persist reflected velocity to physics
        const s = StageItemPhysics.setVelocity(item, this._vx, this._vy);
      }
    } else if (!this._bounce) {
      // No overlap and not bouncing: still clamp the top-left to boundary (legacy behavior)
      x = Math.max(b.minX, Math.min(b.maxX, x));
      y = Math.max(b.minY, Math.min(b.maxY, y));
    }

    return { x, y };
  }

  constructor(
    private ticker: TickService,
    item?: StageItem,
    directionalVelocityMax?: number,
    boundary?: AxisAlignedBoundingBox,
    bounce: boolean = true
  ) {
    if (item) this._item = item;
    if (typeof directionalVelocityMax === 'number') this._directionalVelocityMax = directionalVelocityMax;
    if (boundary) this._boundary = boundary;
    this._bounce = !!bounce;
  }

  setItem(item: StageItem | undefined): void {
    this._item = item;
  }

  setDirectionalVelocityMax(max: number): void {
    if (typeof max === 'number' && !isNaN(max)) {
      this._directionalVelocityMax = Math.max(0, max);
      this.clampVelocityToMax();
    }
  }

  setBoundary(boundary: AxisAlignedBoundingBox | undefined): void {
    this._boundary = boundary;
  }

  setBounce(bounce: boolean): void {
    this._bounce = !!bounce;
  }

  // Explicitly set velocity (cells/sec). Will be clamped to the configured max magnitude.
  setVelocity(vx: number, vy: number): void {
    this._vx = toNumber(vx, 0);
    this._vy = toNumber(vy, 0);
    this.clampVelocityToMax();
    if (this._item) {
      StageItemPhysics.setVelocity(this._item, this._vx, this._vy);
    }
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

  private clampVelocityToMax(): void {
    const vMax = this._directionalVelocityMax;
    if (vMax <= 0) {
      this._vx = 0;
      this._vy = 0;
      return;
    }
    const mag = Math.hypot(this._vx, this._vy);
    if (mag > vMax) {
      const s = vMax / (mag || 1);
      this._vx *= s;
      this._vy *= s;
    }
  }

  private onTick(time: number): void {
    const it = this._item;
    if (!it) {
      this.lastTime = time;
      return;
    }
    const prev = this.lastTime ?? time;
    this.lastTime = time;
    const dtSec = Math.max(0, (time - prev) / 1000);
    if (dtSec === 0) return;

    // Ensure Pose and Position exist
    const { pose, pos } = this.ensurePoseAndPosition(it);

    // Get authoritative velocity from physics if present
    this.syncVelocityFromPhysics(it);

    // Proposed new position
    let { x, y } = this.integratePosition(pos, dtSec);

    // Boundary containment and bounce
    ({ x, y } = this.applyBoundaryContainmentAndBounce(it, pose, x, y));

    pos.x = x;
    pos.y = y;
    // persist velocity in case it changed elsewhere
    StageItemPhysics.setVelocity(it, this._vx, this._vy);
  }
}
