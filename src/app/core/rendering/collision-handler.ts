import { Subscription, Subject } from 'rxjs';
import { StageItem } from '../models/game-items/stage-item';
import { TickService } from '../services/tick.service';
import { orientedBoundingBoxFromPose, orientedBoundingBoxIntersectsOrientedBoundingBox, resetOBBPool } from './collision';
import { StageItemPhysics, PhysicsState } from './physics/stage-item-physics';
import { resolveItemItemCollision } from './physics/impulses';

export interface CollisionEvent {
  a: StageItem;
  b: StageItem;
  normal: { x: number; y: number }; // from A to B
  minimalTranslationVector: { x: number; y: number };    // push A by +minimalTranslationVector to separate
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
  private contacts: { a: StageItem; b: StageItem; physA: StageItemPhysics; physB: StageItemPhysics; normal: { x: number; y: number }; mtv: { x: number; y: number }; aobb: any; bobb: any; isCCD?: boolean }[] = [];

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

  clear(): void { this.items = []; }
  
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

    if (contacts.length === 0) return;

    // Iterative solver over contacts to distribute impulses like a physics engine
    for (let iter = 0; iter < this._iterations; iter++) {
      for (const c of contacts) {
        const stateA = c.physA.State;
        const stateB = c.physB.State;
        const e = Math.min(stateA.restitution, stateB.restitution);
        resolveItemItemCollision(
          c.a,
          c.b,
          c.physA,
          c.physB,
          c.aobb,
          c.bobb,
          c.normal,
          { restitution: e, friction: this._frictionDefault }
        );
      }
    }

    // Positional correction: resolve overlaps using Baumgarte stabilization
    // This prevents objects from getting stuck together while avoiding jerky over-correction
    const slop = 0.01;      // Allow 0.01 cells of overlap to prevent jitter
    const percent = 0.4;    // Resolve 40% of the overlap per frame

    for (const c of contacts) {
      if (c.isCCD) continue; // Skip positional correction for predictive CCD hits

      const stateA = c.physA.State;
      const stateB = c.physB.State;
      const invMassA = stateA.mass >= 1e6 ? 0 : 1 / Math.max(1e-6, stateA.mass);
      const invMassB = stateB.mass >= 1e6 ? 0 : 1 / Math.max(1e-6, stateB.mass);
      const sum = invMassA + invMassB;
      if (sum <= 0) continue;

      const mtvMagnitude = Math.hypot(c.mtv.x, c.mtv.y);
      // Cap maximum correction to avoid enormous jumps that upset the system
      const maxCorrection = 0.5; // max 0.5 cells per frame
      const correctionMagnitude = (Math.min(maxCorrection, Math.max(mtvMagnitude - slop, 0)) / sum) * percent;

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
}
