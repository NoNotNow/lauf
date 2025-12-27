import { Subscription } from 'rxjs';
import { TickService } from '../../services/tick.service';
import { StageItem } from '../../models/game-items/stage-item';
import { StageItemPhysics, PhysicsState } from './stage-item-physics';
import { AxisAlignedBoundingBox, orientedBoundingBoxFromPose, poseContainmentAgainstAxisAlignedBoundingBox } from '../collision';
import { resolveBoundaryCollision } from './impulses';
import { toNumber } from '../../utils/number-utils';

const TINY_NUDGE = 1e-6;

// Integrates poses (position + rotation) from StageItemPhysics velocities each tick.
// Transformers (Drifter, Rotator, future KeyboardController) should only set velocities/omega.
export class PhysicsIntegrator {
  private sub?: Subscription;
  private items: { it: StageItem; phys: PhysicsState }[] = [];
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
    if (this.items.some(e => e.it === item)) return;
    this.items.push({ it: item, phys: StageItemPhysics.get(item) });
  }

  addMany(items: (StageItem | undefined)[] | undefined): void {
    if (!items) return;
    for (const it of items) this.add(it);
  }

  clear(): void { this.items = []; }

  start(): void {
    if (this.sub) return;
    this.sub = this.ticker.ticks$.subscribe(({ dtSec }) => this.onTick(dtSec));
  }

  stop(): void {
    this.sub?.unsubscribe();
    this.sub = undefined;
  }

  private onTick(dtSec: number): void {
    if (dtSec === 0) return;

    for (const { it, phys } of this.items) {
      const pose = it?.Pose;
      if (!pose) continue;

      const pos = pose.Position;
      if (!pos) continue;

      // Read velocities
      let vx = toNumber(phys.vx, 0);
      let vy = toNumber(phys.vy, 0);
      let omega = toNumber(phys.omega, 0); // deg/s

      // Apply damping
      if (phys.linearDamping > 0) {
        const factor = Math.max(0, 1 - phys.linearDamping * dtSec);
        vx *= factor;
        vy *= factor;
        StageItemPhysics.setVelocity(phys, vx, vy);
      }
      if (phys.angularDamping > 0) {
        const factor = Math.max(0, 1 - phys.angularDamping * dtSec);
        omega *= factor;
        StageItemPhysics.setAngular(phys, omega);
      }

      // Integrate linear
      let x = toNumber(pos.x, 0) + vx * dtSec;
      let y = toNumber(pos.y, 0) + vy * dtSec;

      // Integrate angular
      const r0 = toNumber(pose.Rotation, 0);
      let r = r0 + omega * dtSec;

      // Boundary containment and bounce (affects x,y and may reflect velocity)
      // Note: collisionBox is NOT used for boundary containment - only for collision detection
      if (this.boundary) {
        // Reuse pre-allocated testPose object to avoid allocation
        const testPose = this.testPose;
        testPose.Position.x = x;
        testPose.Position.y = y;
        testPose.Size.x = toNumber(pose.Size?.x, 0);
        testPose.Size.y = toNumber(pose.Size?.y, 0);
        testPose.Rotation = r;
        // Boundary containment uses only the pose size, NOT the collision detection box
        const res = poseContainmentAgainstAxisAlignedBoundingBox(testPose, this.boundary, undefined);
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
            // For collision impulse calculation, we DO use the collision box
            const obb = orientedBoundingBoxFromPose(pose, it.Physics.collisionBox);
            resolveBoundaryCollision(
              it,
              phys,
              obb,
              this.boundary,
              res.normal,
              { restitution: phys.restitution ?? 0.85, friction: 0.8 } // Default friction
            );

            x += res.normal.x * TINY_NUDGE;
            y += res.normal.y * TINY_NUDGE;

            // Re-read after impulse (no lookup needed because it's updated in-place)
            vx = phys.vx;
            vy = phys.vy;
            omega = phys.omega;
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
        StageItemPhysics.setVelocity(phys, vx, vy);
      }

      // Commit new pose
      pos.x = x;
      pos.y = y;
      pose.Rotation = r;
    }
  }
}
