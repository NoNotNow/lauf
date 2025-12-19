import { Subscription, Subject } from 'rxjs';
import { StageItem } from '../models/game-items/stage-item';
import { TickService } from '../services/tick.service';
import { orientedBoundingBoxFromPose, orientedBoundingBoxIntersectsOrientedBoundingBox, resetOBBPool } from './collision';
import { StageItemPhysics, PhysicsState } from './physics/stage-item-physics';
import { applyItemItemCollisionImpulse } from './physics/impulses';

export interface CollisionEvent {
  a: StageItem;
  b: StageItem;
  normal: { x: number; y: number }; // from A to B
  minimalTranslationVector: { x: number; y: number };    // push A by +minimalTranslationVector to separate
}

export class CollisionHandler {
  private sub?: Subscription;
  private items: StageItem[] = [];
  private _restitutionDefault = 1.0;
  private _frictionDefault = 0.8;
  private _iterations = 8; // sequential impulse iterations per tick
  public readonly events$ = new Subject<CollisionEvent>();

  // Pre-allocated arrays to avoid allocation per frame
  private obbCache: (ReturnType<typeof orientedBoundingBoxFromPose> | null)[] = [];
  private physicsCache: PhysicsState[] = [];
  private contacts: { a: StageItem; b: StageItem; normal: { x: number; y: number }; mtv: { x: number; y: number }; aobb: any; bobb: any }[] = [];

  // Pre-allocated event object to avoid allocation per collision
  private collisionEvent: CollisionEvent = {
    a: null as any,
    b: null as any,
    normal: { x: 0, y: 0 },
    minimalTranslationVector: { x: 0, y: 0 }
  };

  constructor(private ticker: TickService) {}

  setRestitutionDefault(r: number): void {
    this._restitutionDefault = Math.min(1, Math.max(0, Number(r) || 1.0));
  }

  setFrictionDefault(mu: number): void {
    this._frictionDefault = Math.max(0, Number(mu) || 0);
  }

  setIterations(n: number): void {
    this._iterations = Math.max(1, Math.floor(n || 1));
  }

  add(item: StageItem): void {
    if (!item) return;
    if (this.items.includes(item)) return;
    // ensure physics state exists (mass from size)
    StageItemPhysics.get(item);
    this.items.push(item);
  }

  remove(item: StageItem): void {
    const i = this.items.indexOf(item);
    if (i >= 0) this.items.splice(i, 1);
  }

  clear(): void { this.items = []; }

  start(): void {
    if (this.sub) return;
    this.sub = this.ticker.ticks$.subscribe(({ time }) => this.onTick(time));
  }

  stop(): void {
    this.sub?.unsubscribe();
    this.sub = undefined;
  }

  private onTick(_time: number): void {
    const n = this.items.length;
    if (n < 2) return;

    // Reset OBB object pool at frame start to avoid allocations
    resetOBBPool();

    // Cache OBBs and physics to avoid re-calculating them in the inner loop
    // Reuse pre-allocated arrays to avoid allocation
    const obbs = this.obbCache;
    const physics = this.physicsCache;
    obbs.length = n;
    physics.length = n;
    for (let i = 0; i < n; i++) {
      const item = this.items[i];
      const p = item?.Pose;
      obbs[i] = p ? orientedBoundingBoxFromPose(p) : null;
      physics[i] = StageItemPhysics.get(item);
    }

    // Build contact list once per tick - reuse pre-allocated array
    const contacts = this.contacts;
    contacts.length = 0;
    for (let i = 0; i < n - 1; i++) {
      const ai = this.items[i];
      const aobb = obbs[i];
      if (!aobb) continue;
      const physA = physics[i];

      for (let j = i + 1; j < n; j++) {
        const bj = this.items[j];
        const bobb = obbs[j];
        if (!bobb) continue;
        const physB = physics[j];

        // Broad-phase pruning: check distance between centers first
        const dx = bobb.center.x - aobb.center.x;
        const dy = bobb.center.y - aobb.center.y;
        const distSq = dx * dx + dy * dy;
        const radiusSum = Math.max(aobb.half.x, aobb.half.y) + Math.max(bobb.half.x, bobb.half.y);

        // Expand radius check based on relative velocity to catch fast-moving objects (CCD approximation)
        const relVx = (physA.vx ?? 0) - (physB.vx ?? 0);
        const relVy = (physA.vy ?? 0) - (physB.vy ?? 0);
        const relSpeedSq = relVx * relVx + relVy * relVy;
        const velocityExpansion = Math.sqrt(relSpeedSq) * 0.016; // assume ~16ms frame time
        const expandedRadiusSum = radiusSum + velocityExpansion;
        if (distSq > expandedRadiusSum * expandedRadiusSum) continue;

        const res = orientedBoundingBoxIntersectsOrientedBoundingBox(aobb, bobb);
        if (!res.overlaps) continue;
        contacts.push({ a: ai, b: bj, normal: res.normal, mtv: res.minimalTranslationVector, aobb, bobb });

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
        const sa = StageItemPhysics.get(c.a);
        const sb = StageItemPhysics.get(c.b);
        const e = Math.min(sa.restitution, sb.restitution);
        applyItemItemCollisionImpulse(
          c.a,
          c.b,
          c.a.Pose,
          c.b.Pose,
          c.aobb,
          c.bobb,
          c.normal,
          { restitution: e, friction: this._frictionDefault }
        );
      }
    }

    // Positional correction: fully separate overlapping objects immediately
    // This prevents objects from getting stuck together or entangled
    for (const c of contacts) {
      const aPose = c.a.Pose as any;
      const bPose = c.b.Pose as any;
      aPose.Position = aPose.Position ?? { x: 0, y: 0 };
      bPose.Position = bPose.Position ?? { x: 0, y: 0 };

      const sa = StageItemPhysics.get(c.a);
      const sb = StageItemPhysics.get(c.b);
      const invMassA = 1 / Math.max(1e-6, sa.mass);
      const invMassB = 1 / Math.max(1e-6, sb.mass);
      const sum = invMassA + invMassB;
      const wA = sum > 0 ? invMassA / sum : 0.5;
      const wB = sum > 0 ? invMassB / sum : 0.5;

      // Use the full MTV to completely separate objects, plus a small gap
      const separationGap = 0.02; // Add 0.02 cells gap to prevent immediate re-collision
      const mtvMagnitude = Math.hypot(c.mtv.x, c.mtv.y);
      const totalSeparation = mtvMagnitude + separationGap;

      if (totalSeparation > 0) {
        const correctionX = c.normal.x * totalSeparation;
        const correctionY = c.normal.y * totalSeparation;

        // Push objects apart based on mass ratio
        aPose.Position.x -= correctionX * wA;
        aPose.Position.y -= correctionY * wA;
        bPose.Position.x += correctionX * wB;
        bPose.Position.y += correctionY * wB;
      }
    }
  }
}
