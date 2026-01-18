import { Subscription } from 'rxjs';
import { TickService } from '../../services/tick.service';
import { StageItem } from '../../models/game-items/stage-item';
import { StageItemPhysics, PhysicsState } from './stage-item-physics';
import { AxisAlignedBoundingBox, orientedBoundingBoxFromPose, poseContainmentAgainstAxisAlignedBoundingBox } from '../collision';
import { resolveBoundaryCollision } from './impulses';
import { toNumber } from '../../utils/number-utils';

const TINY_NUDGE = 1e-6;

// Integrates poses (position + rotation) from StageItemPhysics velocities each tick.
// Transformers (Drifter, Rotator, controllers) should only set velocities/omega.
interface BoundaryRestingContact {
  item: StageItem;
  normal: { x: number; y: number };
  framesActive: number;
  lastVelocityY: number;
}

export class PhysicsIntegrator {
  private sub?: Subscription;
  private items: { it: StageItem; phys: StageItemPhysics }[] = [];
  private boundary?: AxisAlignedBoundingBox;
  private bounce: boolean = true;

  // Pre-allocated objects to avoid allocation per frame
  private testPose: any = { Position: { x: 0, y: 0 }, Size: { x: 0, y: 0 }, Rotation: 0 };
  
  // Boundary resting contact tracking (for floor resting)
  private boundaryRestingContacts = new Map<StageItem, BoundaryRestingContact>();
  private readonly RESTING_VELOCITY_THRESHOLD = 0.3; // cells/s
  private readonly RESTING_FRAMES_THRESHOLD = 3; // frames

  constructor(private ticker: TickService) {}

  setBoundary(boundary?: AxisAlignedBoundingBox, bounce: boolean = true): void {
    this.boundary = boundary;
    this.bounce = !!bounce;
  }

  add(item: StageItem | undefined): void {
    if (!item) return;
    if (this.items.some(e => e.it === item)) return;
    this.items.push({ it: item, phys: StageItemPhysics.for(item) });
  }

  addMany(items: (StageItem | undefined)[] | undefined): void {
    if (!items) return;
    for (const it of items) this.add(it);
  }

  clear(): void { 
    this.items = [];
    this.boundaryRestingContacts.clear();
  }

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

      const state = phys.State;
      // Read velocities
      let vx = toNumber(state.vx, 0);
      let vy = toNumber(state.vy, 0);
      let omega = toNumber(state.omega, 0); // deg/s

      // Apply damping
      if (state.linearDamping > 0) {
        const factor = Math.max(0, 1 - state.linearDamping * dtSec);
        vx *= factor;
        vy *= factor;
        phys.setVelocity(vx, vy);
      }
      if (state.angularDamping > 0) {
        const factor = Math.max(0, 1 - state.angularDamping * dtSec);
        omega *= factor;
        phys.setAngularVelocity(omega);
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
            // Check if this is a floor contact (normal points up, i.e., normal.y < 0)
            const isFloorContact = res.normal.y < -0.5;
            const velocityTowardBoundary = vx * res.normal.x + vy * res.normal.y;
            
            // Update boundary resting contact tracking
            let restingContact = this.boundaryRestingContacts.get(it);
            if (restingContact) {
              // Check if contact is still active (same normal direction)
              const normalDot = restingContact.normal.x * res.normal.x + restingContact.normal.y * res.normal.y;
              if (normalDot > 0.7) {
                // Same contact, update it
                restingContact.framesActive++;
                restingContact.lastVelocityY = vy;
                restingContact.normal = { x: res.normal.x, y: res.normal.y };
              } else {
                // Different contact, reset
                restingContact = {
                  item: it,
                  normal: { x: res.normal.x, y: res.normal.y },
                  framesActive: 1,
                  lastVelocityY: vy
                };
                this.boundaryRestingContacts.set(it, restingContact);
              }
            } else {
              // New contact
              restingContact = {
                item: it,
                normal: { x: res.normal.x, y: res.normal.y },
                framesActive: 1,
                lastVelocityY: vy
              };
              this.boundaryRestingContacts.set(it, restingContact);
            }
            
            // Check if this is a resting contact (especially for floor)
            const isResting = isFloorContact && 
                             restingContact.framesActive >= this.RESTING_FRAMES_THRESHOLD &&
                             Math.abs(velocityTowardBoundary) < this.RESTING_VELOCITY_THRESHOLD &&
                             Math.abs(vy) < this.RESTING_VELOCITY_THRESHOLD;
            
            if (isResting) {
              // For resting on floor, zero vertical velocity and apply position correction
              // Don't apply bounce impulse
              vy = 0;
              vx *= 0.9; // Slight horizontal damping for stability
              phys.setVelocity(vx, vy);
              
              // Apply more aggressive position correction for resting
              const slop = 0.01;
              const penetration = Math.max(0, dist - slop);
              const correctionPercent = 0.8; // More aggressive correction
              const correctionX = res.normal.x * penetration * correctionPercent;
              const correctionY = res.normal.y * penetration * correctionPercent;
              
              x += correctionX;
              y += correctionY;
            } else {
              // Normal bounce behavior for impacting contacts
              const obb = orientedBoundingBoxFromPose(pose, it.Physics.collisionBox);
              resolveBoundaryCollision(
                it,
                phys,
                obb,
                this.boundary,
                res.normal,
                { restitution: state.restitution ?? 0.85, friction: state.friction ?? 0.8 }
              );

              x += res.normal.x * TINY_NUDGE;
              y += res.normal.y * TINY_NUDGE;

              // Re-read after impulse (no lookup needed because it's updated in-place)
              const updatedState = phys.State;
              vx = updatedState.vx;
              vy = updatedState.vy;
              omega = updatedState.omega;
            }
          } else {
            // clamp inside (legacy behavior)
            x = Math.max(this.boundary.minX, Math.min(this.boundary.maxX, x));
            y = Math.max(this.boundary.minY, Math.min(this.boundary.maxY, y));
            // Clear resting contact if not bouncing
            this.boundaryRestingContacts.delete(it);
          }
        } else {
          // No overlap, clear resting contact
          this.boundaryRestingContacts.delete(it);
        }
      }

      // Final velocity clamping to prevent system blow-up
      const maxVel = 200; // cells/s
      const speedSq = vx * vx + vy * vy;
      if (speedSq > maxVel * maxVel) {
        const speed = Math.sqrt(speedSq);
        vx = (vx / speed) * maxVel;
        vy = (vy / speed) * maxVel;
        phys.setVelocity(vx, vy);
      }

      // Commit new pose
      pos.x = x;
      pos.y = y;
      pose.Rotation = r;
    }
  }
}
