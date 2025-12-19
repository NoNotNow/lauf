import { Subscription } from 'rxjs';
import { TickService } from '../../services/tick.service';
import { StageItem } from '../../models/game-items/stage-item';
import { StageItemPhysics } from './stage-item-physics';
import { AxisAlignedBoundingBox, poseContainmentAgainstAxisAlignedBoundingBox } from '../collision';
import { reflectVelocity, TINY_NUDGE } from './bounce';
import { applyAngularToLinearAtBoundary } from './coupling';
import { toNumber } from '../../utils/number-utils';

// Integrates poses (position + rotation) from StageItemPhysics velocities each tick.
// Transformers (Drifter, Rotator, future KeyboardController) should only set velocities/omega.
export class PhysicsIntegrator {
  private sub?: Subscription;
  private lastTime?: number;
  private items: StageItem[] = [];
  private boundary?: AxisAlignedBoundingBox;
  private bounce: boolean = true;

  // Pre-allocated objects to avoid allocation per frame
  private testPose: any = { Position: { x: 0, y: 0 }, Size: { x: 0, y: 0 }, Rotation: 0 };

  constructor(private ticker: TickService) {}

  setBoundary(boundary?: AxisAlignedBoundingBox, bounce: boolean = true): void {
    this.boundary = boundary;
    this.bounce = !!bounce;
  }

  add(item: StageItem | undefined): void {
    if (!item) return;
    if (this.items.includes(item)) return;
    // Ensure physics state exists
    StageItemPhysics.get(item);
    this.items.push(item);
  }

  addMany(items: (StageItem | undefined)[] | undefined): void {
    if (!items) return;
    for (const it of items) this.add(it);
  }

  clear(): void { this.items = []; }

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
    const prev = this.lastTime ?? time;
    this.lastTime = time;
    const dtSec = Math.max(0, (time - prev) / 1000);
    if (dtSec === 0) return;

    for (const it of this.items) {
      const pose: any = it?.Pose;
      if (!pose) continue;

      pose.Position = pose.Position ?? { x: 0, y: 0 };
      const pos = pose.Position as { x: number; y: number };

      // Read velocities
      const phys = StageItemPhysics.get(it);
      const vx = toNumber(phys.vx, 0);
      const vy = toNumber(phys.vy, 0);
      const omega = toNumber(phys.omega, 0); // deg/s

      // Integrate linear
      let x = toNumber(pos.x, 0) + vx * dtSec;
      let y = toNumber(pos.y, 0) + vy * dtSec;

      // Integrate angular
      const r0 = toNumber(pose.Rotation, 0);
      let r = r0 + omega * dtSec;

      // Boundary containment and bounce (affects x,y and may reflect velocity)
      if (this.boundary) {
        // Reuse pre-allocated testPose object to avoid allocation
        const testPose = this.testPose;
        testPose.Position.x = x;
        testPose.Position.y = y;
        testPose.Size.x = toNumber(pose.Size?.x, 0);
        testPose.Size.y = toNumber(pose.Size?.y, 0);
        testPose.Rotation = r;
        const res = poseContainmentAgainstAxisAlignedBoundingBox(testPose, this.boundary);
        if (res.overlaps) {
          // Correct position by MTV
          x += res.minimalTranslationVector.x;
          y += res.minimalTranslationVector.y;
          if (this.bounce) {
            const restitution = phys.restitution ?? 1.0;
            const v = reflectVelocity({ x: vx, y: vy }, res.normal, restitution);
            StageItemPhysics.setVelocity(it, v.x, v.y);
            x += res.normal.x * TINY_NUDGE;
            y += res.normal.y * TINY_NUDGE;
            // Transfer some spin into linear along the tangent; also damps omega
            applyAngularToLinearAtBoundary(it, pose as any, res.normal, 0.35, restitution);
          } else {
            // clamp inside (legacy behavior)
            x = Math.max(this.boundary.minX, Math.min(this.boundary.maxX, x));
            y = Math.max(this.boundary.minY, Math.min(this.boundary.maxY, y));
          }
        }

        // Hard clamp to prevent objects from escaping bounds even at extreme velocities
        const halfW = testPose.Size.x / 2;
        const halfH = testPose.Size.y / 2;
        const margin = Math.max(halfW, halfH); // conservative margin accounting for rotation
        x = Math.max(this.boundary.minX + margin, Math.min(this.boundary.maxX - margin, x));
        y = Math.max(this.boundary.minY + margin, Math.min(this.boundary.maxY - margin, y));
      }

      // Commit new pose
      pos.x = x;
      pos.y = y;
      pose.Rotation = r;
    }
  }
}
