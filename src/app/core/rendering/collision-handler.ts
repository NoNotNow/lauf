import { Subscription, Subject } from 'rxjs';
import { StageItem } from '../models/game-items/stage-item';
import { TickService } from '../services/tick.service';
import { orientedBoundingBoxFromPose, orientedBoundingBoxIntersectsOrientedBoundingBox, resetOBBPool } from './collision';
import { StageItemPhysics, PhysicsState } from './physics/stage-item-physics';
import { resolveItemItemCollision, resolveRestingContactConstraint } from './physics/impulses';

export interface CollisionEvent {
  a: StageItem;
  b: StageItem;
  normal: { x: number; y: number }; // from A to B
  minimalTranslationVector: { x: number; y: number };    // push A by +minimalTranslationVector to separate
}

interface RestingContact {
  itemA: StageItem;
  itemB: StageItem;
  normal: { x: number; y: number };
  framesActive: number;  // How many frames this contact has been active
  avgPenetration: number; // Average penetration depth
}

interface Contact {
  a: StageItem;
  b: StageItem;
  physA: StageItemPhysics;
  physB: StageItemPhysics;
  normal: { x: number; y: number };
  mtv: { x: number; y: number };
  aobb: any;
  bobb: any;
  isCCD?: boolean;
}

export class CollisionHandler {
  private sub?: Subscription;
  private items: { it: StageItem; phys: StageItemPhysics }[] = [];
  private _restitutionDefault = 0.85;
  private _frictionDefault = 0.8;
  private _iterations = 10; // sequential impulse iterations per tick
  public readonly events$ = new Subject<CollisionEvent>();

  // Pre-allocated arrays to avoid allocation per frame
  private obbCache: (ReturnType<typeof orientedBoundingBoxFromPose> | null)[] = [];
  private physicsCache: StageItemPhysics[] = [];
  private contacts: Contact[] = [];

  // Resting contact tracking
  private restingContacts = new Map<string, RestingContact>();
  private readonly RESTING_VELOCITY_THRESHOLD = 0.3; // cells/s
  private readonly RESTING_FRAMES_THRESHOLD = 3; // frames
  
  // Constants
  private readonly DEFAULT_GRAVITY = 9.81; // cells/s^2
  private readonly PENETRATION_SLOP = 0.01; // cells
  private readonly POSITION_CORRECTION_PERCENT_IMPACTING = 0.4; // 40% per frame
  private readonly POSITION_CORRECTION_PERCENT_RESTING = 0.8; // 80% per frame
  private readonly MAX_CORRECTION_IMPACTING = 0.5; // cells per frame
  private readonly MAX_CORRECTION_RESTING = 1.0; // cells per frame

  // Pre-allocated event object to avoid allocation per collision
  private collisionEvent: CollisionEvent = {
    a: null as any,
    b: null as any,
    normal: { x: 0, y: 0 },
    minimalTranslationVector: { x: 0, y: 0 }
  };

  constructor(private ticker: TickService) {}

  setRestitutionDefault(r: number): void {
    this._restitutionDefault = Math.min(1, Math.max(0, Number(r) || 0.85));
  }

  setFrictionDefault(mu: number): void {
    this._frictionDefault = Math.max(0, Number(mu) || 0);
  }

  setIterations(n: number): void {
    this._iterations = Math.max(1, Math.floor(n || 1));
  }

  add(item: StageItem): void {
    if (!item) return;
    if (this.items.some(e => e.it === item)) return;
    this.items.push({ it: item, phys: StageItemPhysics.for(item) });
  }

  remove(item: StageItem): void {
    const i = this.items.findIndex(e => e.it === item);
    if (i >= 0) this.items.splice(i, 1);
  }

  clear(): void { 
    this.items = [];
    this.restingContacts.clear();
  }

  /**
   * Generate a consistent key for tracking contacts between two items
   */
  private contactKey(a: StageItem, b: StageItem): string {
    // Use object identity as key since StageItem doesn't have a guaranteed Id
    const idA = (a as any).Id ?? String(a);
    const idB = (b as any).Id ?? String(b);
    return idA < idB ? `${idA}-${idB}` : `${idB}-${idA}`;
  }

  /**
   * Calculate relative velocity at contact point between two items
   */
  private calculateRelativeVelocityAtContact(c: Contact): { vRelN: number; vRelT: number; vRel: { x: number; y: number } } {
    const stateA = c.physA.State;
    const stateB = c.physB.State;
    
    const omegaAr = StageItemPhysics.omegaDegToRadPerSec(stateA.omega);
    const omegaBr = StageItemPhysics.omegaDegToRadPerSec(stateB.omega);
    
    // Estimate contact point as midpoint between OBB centers
    const cpx = (c.aobb.center.x + c.bobb.center.x) * 0.5;
    const cpy = (c.aobb.center.y + c.bobb.center.y) * 0.5;
    const ra = { x: cpx - c.aobb.center.x, y: cpy - c.aobb.center.y };
    const rb = { x: cpx - c.bobb.center.x, y: cpy - c.bobb.center.y };
    
    // Velocities at contact point including angular component
    const vAatC = { 
      x: stateA.vx + (-omegaAr * ra.y), 
      y: stateA.vy + (omegaAr * ra.x) 
    };
    const vBatC = { 
      x: stateB.vx + (-omegaBr * rb.y), 
      y: stateB.vy + (omegaBr * rb.x) 
    };
    const vRel = { 
      x: vBatC.x - vAatC.x, 
      y: vBatC.y - vAatC.y 
    };
    
    // Relative velocity along normal
    const vRelN = vRel.x * c.normal.x + vRel.y * c.normal.y;
    
    // Relative velocity tangential (perpendicular to normal)
    const tangent = { x: vRel.x - vRelN * c.normal.x, y: vRel.y - vRelN * c.normal.y };
    const vRelT = Math.hypot(tangent.x, tangent.y);
    
    return { vRelN, vRelT, vRel };
  }

  /**
   * Update resting contact tracking for all active contacts
   */
  private updateRestingContactTracking(contacts: Contact[]): Set<string> {
    const activeContactKeys = new Set<string>();
    
    for (const c of contacts) {
      const key = this.contactKey(c.a, c.b);
      activeContactKeys.add(key);

      const mtvMagnitude = Math.hypot(c.mtv.x, c.mtv.y);
      const { vRelN } = this.calculateRelativeVelocityAtContact(c);
      
      const existing = this.restingContacts.get(key);
      if (existing) {
        // Update existing contact
        existing.framesActive++;
        // Update average penetration (exponential moving average)
        existing.avgPenetration = existing.avgPenetration * 0.7 + mtvMagnitude * 0.3;
        existing.normal = { x: c.normal.x, y: c.normal.y };
      } else {
        // Create new resting contact entry
        this.restingContacts.set(key, {
          itemA: c.a,
          itemB: c.b,
          normal: { x: c.normal.x, y: c.normal.y },
          framesActive: 1,
          avgPenetration: mtvMagnitude
        });
      }
    }

    // Remove contacts that are no longer active
    for (const key of this.restingContacts.keys()) {
      if (!activeContactKeys.has(key)) {
        this.restingContacts.delete(key);
      }
    }

    return activeContactKeys;
  }

  /**
   * Separate contacts into resting vs impacting based on tracking and velocity
   * A contact is "resting" only if both normal AND tangential velocities are low
   */
  private separateRestingFromImpacting(contacts: Contact[]): { resting: Contact[]; impacting: Contact[] } {
    const restingContacts: Contact[] = [];
    const impactingContacts: Contact[] = [];
    
    for (const c of contacts) {
      const key = this.contactKey(c.a, c.b);
      const resting = this.restingContacts.get(key);
      
      if (resting && resting.framesActive >= this.RESTING_FRAMES_THRESHOLD) {
        const { vRelN, vRelT } = this.calculateRelativeVelocityAtContact(c);
        const absVRelN = Math.abs(vRelN);
        
        // For resting contact, both normal AND tangential velocities must be low
        // This prevents walking/moving objects from being treated as resting
        if (absVRelN < this.RESTING_VELOCITY_THRESHOLD && vRelT < this.RESTING_VELOCITY_THRESHOLD) {
          restingContacts.push(c);
          continue;
        }
      }
      
      impactingContacts.push(c);
    }

    return { resting: restingContacts, impacting: impactingContacts };
  }

  /**
   * Apply position correction using Baumgarte stabilization
   */
  private applyPositionCorrection(contacts: Contact[]): void {
    for (const c of contacts) {
      if (c.isCCD) continue; // Skip positional correction for predictive CCD hits

      const stateA = c.physA.State;
      const stateB = c.physB.State;
      const invMassA = stateA.mass >= 1e6 ? 0 : 1 / Math.max(1e-6, stateA.mass);
      const invMassB = stateB.mass >= 1e6 ? 0 : 1 / Math.max(1e-6, stateB.mass);
      const sum = invMassA + invMassB;
      if (sum <= 0) continue;

      // Determine if this is a resting contact
      const key = this.contactKey(c.a, c.b);
      const resting = this.restingContacts.get(key);
      const isResting = resting && resting.framesActive >= this.RESTING_FRAMES_THRESHOLD;
      
      // Use more accurate penetration depth calculation
      const mtvMagnitude = Math.hypot(c.mtv.x, c.mtv.y);
      const penetrationDepth = isResting && resting ? resting.avgPenetration : mtvMagnitude;
      
      // Use higher correction percentage for resting contacts
      const percent = isResting ? this.POSITION_CORRECTION_PERCENT_RESTING : this.POSITION_CORRECTION_PERCENT_IMPACTING;
      const maxCorrection = isResting ? this.MAX_CORRECTION_RESTING : this.MAX_CORRECTION_IMPACTING;
      const correctionMagnitude = (Math.min(maxCorrection, Math.max(penetrationDepth - this.PENETRATION_SLOP, 0)) / sum) * percent;

      const correctionX = c.normal.x * correctionMagnitude;
      const correctionY = c.normal.y * correctionMagnitude;

      const aPose = c.a.Pose as any;
      const bPose = c.b.Pose as any;
      if (aPose.Position) {
        aPose.Position.x -= correctionX * invMassA;
        aPose.Position.y -= correctionY * invMassA;
      }
      if (bPose.Position) {
        bPose.Position.x += correctionX * invMassB;
        bPose.Position.y += correctionY * invMassB;
      }
    }
  }
  
  /**
   * Checks if a given pose would collide with any items in the collision handler
   * (excluding the item itself if provided)
   * Note: This method uses the OBB pool, so it should be called carefully to avoid pool exhaustion
   * Note: This does NOT check boundaries - boundaries should be checked separately
   */
  wouldCollideAt(pose: any, excludeItem?: StageItem): boolean {
    if (this.items.length === 0) return false;
    
    // Reset pool to ensure we have available OBBs
    resetOBBPool();
    
    const testOBB = orientedBoundingBoxFromPose(pose, excludeItem?.Physics.collisionBox);
    
    for (const { it: item } of this.items) {
      if (item === excludeItem) continue;
      if (!item.Physics.hasCollision) continue;
      
      const itemOBB = orientedBoundingBoxFromPose(item.Pose, item.Physics.collisionBox);
      const result = orientedBoundingBoxIntersectsOrientedBoundingBox(testOBB, itemOBB);
      if (result.overlaps) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Checks if a given pose would collide with boundaries
   * Returns true if the pose would be outside or overlapping the boundary
   */
  wouldCollideWithBoundary(pose: any, boundary: { minX: number; minY: number; maxX: number; maxY: number }): boolean {
    if (!pose || !pose.Position || !pose.Size) return false;
    
    const pos = pose.Position;
    const size = pose.Size;
    const halfW = (size.x ?? 0) * 0.5;
    const halfH = (size.y ?? 0) * 0.5;
    const centerX = pos.x + halfW;
    const centerY = pos.y + halfH;
    
    // Check if center + half extents would be outside boundary
    const wouldHitLeft = (centerX - halfW) < boundary.minX;
    const wouldHitRight = (centerX + halfW) > boundary.maxX;
    const wouldHitTop = (centerY - halfH) < boundary.minY;
    const wouldHitBottom = (centerY + halfH) > boundary.maxY;
    
    return wouldHitLeft || wouldHitRight || wouldHitTop || wouldHitBottom;
  }

  start(): void {
    if (this.sub) return;
    this.sub = this.ticker.ticks$.subscribe(({ dtSec }) => this.onTick(dtSec));
  }

  stop(): void {
    this.sub?.unsubscribe();
    this.sub = undefined;
  }

  private onTick(dt: number): void {
    const n = this.items.length;
    if (n < 2) return;

    // If dt is 0, we can still run with a tiny epsilon or skip, 
    // but usually it's better to use a default for the first frame
    const effectiveDt = dt || 0.016;

    // Reset OBB object pool at frame start to avoid allocations
    resetOBBPool();

    // Cache OBBs and physics to avoid re-calculating them in the inner loop
    // Reuse pre-allocated arrays to avoid allocation
    const obbs = this.obbCache;
    const physics = this.physicsCache;
    obbs.length = n;
    physics.length = n;
    for (let i = 0; i < n; i++) {
      const { it: item, phys } = this.items[i];
      const p = item?.Pose;
      obbs[i] = p ? orientedBoundingBoxFromPose(p, item.Physics.collisionBox) : null;
      physics[i] = phys;
    }

    // Build contact list once per tick - reuse pre-allocated array
    const contacts = this.contacts;
    contacts.length = 0;
    for (let i = 0; i < n - 1; i++) {
      const { it: ai, phys: physA } = this.items[i];
      const aobb = obbs[i];
      if (!aobb) continue;

      for (let j = i + 1; j < n; j++) {
        const { it: bj, phys: physB } = this.items[j];
        const bobb = obbs[j];
        if (!bobb) continue;

        // Broad-phase pruning: check distance between centers first
        const dx = bobb.center.x - aobb.center.x;
        const dy = bobb.center.y - aobb.center.y;
        const distSq = dx * dx + dy * dy;
        const radiusSum = Math.max(aobb.half.x, aobb.half.y) + Math.max(bobb.half.x, bobb.half.y);

        // Expand radius check based on relative velocity to catch fast-moving objects (CCD approximation)
        const stateA = physA.State;
        const stateB = physB.State;
        const relVx = (stateA.vx ?? 0) - (stateB.vx ?? 0);
        const relVy = (stateA.vy ?? 0) - (stateB.vy ?? 0);
        const relSpeedSq = relVx * relVx + relVy * relVy;
        const velocityExpansion = Math.sqrt(relSpeedSq) * effectiveDt;
        const expandedRadiusSum = radiusSum + velocityExpansion;
        if (distSq > expandedRadiusSum * expandedRadiusSum) continue;

        let res = orientedBoundingBoxIntersectsOrientedBoundingBox(aobb, bobb) as any;

        // If not currently overlapping, try CCD look-ahead if they are moving fast
        if (!res.overlaps && relSpeedSq > 0) {
          const relSpeed = Math.sqrt(relSpeedSq);
          const minSize = Math.min(aobb.half.x, aobb.half.y, bobb.half.x, bobb.half.y) * 2;
          // If relative movement in this frame is more than half of the smallest dimension, sub-sample
          if (relSpeed * effectiveDt > minSize * 0.5) {
            const steps = Math.min(10, Math.ceil((relSpeed * effectiveDt) / (minSize * 0.5)));
            for (let s = 1; s <= steps; s++) {
              const t = s / steps;
              // Simple prediction: linear move. Rotation prediction is omitted for performance/simplicity
              const posA = { x: (ai.Pose?.Position?.x ?? 0) + (stateA.vx ?? 0) * t * effectiveDt, y: (ai.Pose?.Position?.y ?? 0) + (stateA.vy ?? 0) * t * effectiveDt };
              const posB = { x: (bj.Pose?.Position?.x ?? 0) + (stateB.vx ?? 0) * t * effectiveDt, y: (bj.Pose?.Position?.y ?? 0) + (stateB.vy ?? 0) * t * effectiveDt };
              
              // We need temporary OBBs for the predicted positions.
              // orientedBoundingBoxFromPose uses a pool, so this is safe as long as we don't exceed pool size too much.
              const predA = orientedBoundingBoxFromPose({ ...ai.Pose, Position: posA } as any, ai.Physics.collisionBox);
              const predB = orientedBoundingBoxFromPose({ ...bj.Pose, Position: posB } as any, bj.Physics.collisionBox);
              const predRes = orientedBoundingBoxIntersectsOrientedBoundingBox(predA, predB);
              if (predRes.overlaps) {
                res = {
                  overlaps: true,
                  isCCD: true,
                  normal: { x: predRes.normal.x, y: predRes.normal.y },
                  minimalTranslationVector: { x: predRes.minimalTranslationVector.x, y: predRes.minimalTranslationVector.y }
                } as any;
                break;
              }
            }
          }
        }

        if (!res.overlaps) continue;
        
        // Push a copy of the normal and MTV because the result object is from a singleton cache
        contacts.push({ 
          a: ai, 
          b: bj, 
          physA,
          physB,
          normal: { x: res.normal.x, y: res.normal.y }, 
          mtv: { x: res.minimalTranslationVector.x, y: res.minimalTranslationVector.y }, 
          aobb, 
          bobb,
          isCCD: !!res.isCCD
        });

        // Only emit events if there are subscribers to avoid allocation
        if (this.events$.observed) {
          const evt = this.collisionEvent;
          evt.a = ai;
          evt.b = bj;
          evt.normal.x = res.normal.x;
          evt.normal.y = res.normal.y;
          evt.minimalTranslationVector.x = res.minimalTranslationVector.x;
          evt.minimalTranslationVector.y = res.minimalTranslationVector.y;
          this.events$.next(evt);
        }
      }
    }

    if (contacts.length === 0) {
      this.restingContacts.clear();
      return;
    }

    // Update resting contact tracking
    this.updateRestingContactTracking(contacts);

    // Separate contacts into resting vs impacting
    const { resting: restingContacts, impacting: impactingContacts } = this.separateRestingFromImpacting(contacts);

    // Apply constraint forces to resting contacts
    for (const c of restingContacts) {
      const key = this.contactKey(c.a, c.b);
      const resting = this.restingContacts.get(key);
      if (resting) {
        const mtvMagnitude = Math.hypot(c.mtv.x, c.mtv.y);
        resolveRestingContactConstraint(
          c.a,
          c.b,
          c.physA,
          c.physB,
          c.aobb,
          c.bobb,
          c.normal,
          mtvMagnitude,
          this.DEFAULT_GRAVITY
        );
      }
    }

    // Iterative solver over impacting contacts to distribute impulses
    for (let iter = 0; iter < this._iterations; iter++) {
      for (const c of impactingContacts) {
        const stateA = c.physA.State;
        const stateB = c.physB.State;
        const e = Math.min(stateA.restitution, stateB.restitution);
        const mu = Math.min(stateA.friction, stateB.friction);
        resolveItemItemCollision(
          c.a,
          c.b,
          c.physA,
          c.physB,
          c.aobb,
          c.bobb,
          c.normal,
          { restitution: e, friction: mu }
        );
      }
    }

    // Apply position correction using Baumgarte stabilization
    this.applyPositionCorrection(contacts);
  }
}
