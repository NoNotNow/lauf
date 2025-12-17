import { Subscription } from 'rxjs';
import { StageItem } from '../../models/game-items/stage-item';
import { TickService } from '../../services/tick.service';
import { poseContainmentAgainstAABB, AABB } from '../collision';
import { StageItemPhysics } from '../physics/stage-item-physics';
import { reflectVelocity } from '../physics/bounce';

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
  private _boundary?: AABB;
  private _bounce = true;

  constructor(
    private ticker: TickService,
    item?: StageItem,
    directionalVelocityMax?: number,
    boundary?: AABB,
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

  setBoundary(boundary: AABB | undefined): void {
    this._boundary = boundary;
  }

  setBounce(bounce: boolean): void {
    this._bounce = !!bounce;
  }

  // Explicitly set velocity (cells/sec). Will be clamped to the configured max magnitude.
  setVelocity(vx: number, vy: number): void {
    this._vx = Number(vx) || 0;
    this._vy = Number(vy) || 0;
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
    const pose = it.Pose ?? (it.Pose = { Position: undefined as any, Size: undefined as any, Rotation: undefined as any } as any);
    let pos = pose.Position;
    if (!pos) pos = pose.Position = { x: 0, y: 0 } as any;

    // Get authoritative velocity from physics if present
    const phys = StageItemPhysics.get(it);
    this._vx = Number(phys.vx ?? this._vx) || this._vx;
    this._vy = Number(phys.vy ?? this._vy) || this._vy;

    // Proposed new position
    let x = Number(pos.x ?? 0) + this._vx * dtSec;
    let y = Number(pos.y ?? 0) + this._vy * dtSec;

    // If boundary is present, check OBB containment using real Size & Rotation
    if (this._boundary) {
      const b: AABB = this._boundary as AABB;
      // Build a lightweight pose clone for collision check
      const testPose = {
        Position: { x, y },
        Size: { x: Number(pose.Size?.x ?? 0), y: Number(pose.Size?.y ?? 0) },
        Rotation: Number(pose.Rotation ?? 0)
      } as any;

      const res = poseContainmentAgainstAABB(testPose, b);
      if (res.overlaps) {
        // Correct position by MTV
        x += res.mtv.x;
        y += res.mtv.y;

        if (this._bounce) {
          // Reflect velocity around collision normal with restitution
          const restitution = StageItemPhysics.get(it).restitution ?? 1.0;
          const v = reflectVelocity({ x: this._vx, y: this._vy }, res.normal, restitution);
          this._vx = v.x;
          this._vy = v.y;
          // tiny nudge along normal to avoid re-penetration due to numeric issues
          x += res.normal.x * 1e-6;
          y += res.normal.y * 1e-6;
          // persist reflected velocity to physics
          StageItemPhysics.setVelocity(it, this._vx, this._vy);
        }
      } else if (!this._bounce) {
        // No overlap and not bouncing: still clamp the top-left to boundary (legacy behavior)
        x = Math.max(b.minX, Math.min(b.maxX, x));
        y = Math.max(b.minY, Math.min(b.maxY, y));
      }
    }

    pos.x = x;
    pos.y = y;
    // persist velocity in case it changed elsewhere
    StageItemPhysics.setVelocity(it, this._vx, this._vy);
  }
}
