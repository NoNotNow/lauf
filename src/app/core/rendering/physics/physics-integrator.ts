import { Subscription } from 'rxjs';
import { TickService } from '../../services/tick.service';
import { StageItem } from '../../models/game-items/stage-item';
import { StageItemPhysics } from './stage-item-physics';
import { AxisAlignedBoundingBox, orientedBoundingBoxFromPose, poseContainmentAgainstAxisAlignedBoundingBox } from '../collision';
import { applyBoundaryCollisionImpulse } from './impulses';
import { toNumber } from '../../utils/number-utils';

const TINY_NUDGE = 1e-6;

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
      const pose = it?.Pose;
      if (!pose) continue;

      const pos = pose.Position;
      if (!pos) continue;

      // Read velocities
      const phys = StageItemPhysics.get(it);
      let vx = toNumber(phys.vx, 0);
      let vy = toNumber(phys.vy, 0);
      let omega = toNumber(phys.omega, 0); // deg/s

      // Apply damping
      if (phys.linearDamping > 0) {
        const factor = Math.max(0, 1 - phys.linearDamping * dtSec);
        vx *= factor;
        vy *= factor;
        StageItemPhysics.setVelocity(it, vx, vy);
      }
      if (phys.angularDamping > 0) {
        const factor = Math.max(0, 1 - phys.angularDamping * dtSec);
        omega *= factor;
        StageItemPhysics.setAngular(it, omega);
      }

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
          // Correct position by MTV - capped to avoid enormous jumps
          const mtvX = res.minimalTranslationVector.x;
          const mtvY = res.minimalTranslationVector.y;
          const dist = Math.hypot(mtvX, mtvY);
          const maxCorrection = 0.5;
          const scale = dist > maxCorrection ? maxCorrection / dist : 1.0;

          x += mtvX * scale;
          y += mtvY * scale;

          if (this.bounce) {
            const obb = orientedBoundingBoxFromPose(pose);
            applyBoundaryCollisionImpulse(
              it,
              obb,
              this.boundary,
              res.normal,
              { restitution: phys.restitution ?? 1.0, friction: 0.8 } // Default friction
            );

            x += res.normal.x * TINY_NUDGE;
            y += res.normal.y * TINY_NUDGE;

            // Re-read after impulse
            const updated = StageItemPhysics.get(it);
            vx = updated.vx;
            vy = updated.vy;
            omega = updated.omega;
          } else {
            // clamp inside (legacy behavior)
            x = Math.max(this.boundary.minX, Math.min(this.boundary.maxX, x));
            y = Math.max(this.boundary.minY, Math.min(this.boundary.maxY, y));
          }
        }
      }

      // Final velocity clamping to prevent system blow-up
      const maxVel = 200; // cells/s
      const speedSq = vx * vx + vy * vy;
      if (speedSq > maxVel * maxVel) {
        const speed = Math.sqrt(speedSq);
        vx = (vx / speed) * maxVel;
        vy = (vy / speed) * maxVel;
        StageItemPhysics.setVelocity(it, vx, vy);
      }

      // Commit new pose
      pos.x = x;
      pos.y = y;
      pose.Rotation = r;
    }
  }
}
