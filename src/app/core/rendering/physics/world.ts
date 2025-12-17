import { Subscription } from 'rxjs';
import { TickService } from '../../services/tick.service';
import { StageItem } from '../../models/game-items/stage-item';
import { AxisAlignedBoundingBox, orientedBoundingBoxFromPose, orientedBoundingBoxIntersectsOrientedBoundingBox, OrientedBoundingBox } from '../collision';
import { StageItemPhysics } from './stage-item-physics';

// Minimal PhysicsWorld: single source of truth for stepping, broad-phase, and iterative impulses.
// This is an incremental introduction that coexists with the existing handlers.

interface Body {
  item: StageItem;
  obb: OrientedBoundingBox | null;
}

interface ContactPair {
  a: Body;
  b: Body;
  normal: { x: number; y: number };
}

export class PhysicsWorld {
  private sub?: Subscription;
  private bodies: Body[] = [];
  private iterations = 8;
  private restitutionDefault = 1.0;
  private frictionDefault = 0.8;

  constructor(private ticker: TickService) {}

  setIterations(n: number): void { this.iterations = Math.max(1, Math.floor(n || 1)); }
  setRestitutionDefault(e: number): void { this.restitutionDefault = Math.min(1, Math.max(0, Number(e) || 1)); }
  setFrictionDefault(mu: number): void { this.frictionDefault = Math.max(0, Number(mu) || 0); }

  add(item: StageItem): void {
    if (!item) return;
    if (this.bodies.find(b => b.item === item)) return;
    StageItemPhysics.get(item); // ensure state
    this.bodies.push({ item, obb: null });
  }

  remove(item: StageItem): void {
    this.bodies = this.bodies.filter(b => b.item !== item);
  }

  clear(): void { this.bodies = []; }

  start(): void {
    if (this.sub) return;
    this.sub = this.ticker.ticks$.subscribe(({ time }) => this.onTick(time));
  }

  stop(): void {
    this.sub?.unsubscribe();
    this.sub = undefined;
  }

  private onTick(_time: number): void {
    if (this.bodies.length < 2) return;
    // Build OBBs (narrow-phase also uses them)
    for (const b of this.bodies) {
      const p = b.item?.Pose;
      b.obb = p ? orientedBoundingBoxFromPose(p) : null;
    }

    // Broad-phase: naive all-pairs for now (can upgrade to SAP/grid later)
    const contacts: ContactPair[] = [];
    for (let i = 0; i < this.bodies.length - 1; i++) {
      const a = this.bodies[i];
      if (!a.obb) continue;
      for (let j = i + 1; j < this.bodies.length; j++) {
        const b = this.bodies[j];
        if (!b.obb) continue;
        const res = orientedBoundingBoxIntersectsOrientedBoundingBox(a.obb, b.obb);
        if (!res.overlaps) continue;
        contacts.push({ a, b, normal: res.normal });
      }
    }

    if (contacts.length === 0) return;

    // Iterative impulse solver (normal + friction). Reuse existing math from impulses.ts
    // To avoid circular deps, we import lazily.
    const { applyItemItemCollisionImpulse } = require('./impulses');

    for (let k = 0; k < this.iterations; k++) {
      for (const c of contacts) {
        const a = c.a.item;
        const b = c.b.item;
        const aPose = a.Pose;
        const bPose = b.Pose;
        const aObb = c.a.obb!;
        const bObb = c.b.obb!;
        const sa = StageItemPhysics.get(a);
        const sb = StageItemPhysics.get(b);
        const e = Math.min(
          this.restitutionDefault,
          Math.min(sa.restitution ?? this.restitutionDefault, sb.restitution ?? this.restitutionDefault)
        );
        applyItemItemCollisionImpulse(
          a,
          b,
          aPose,
          bPose,
          aObb,
          bObb,
          c.normal,
          { restitution: e, friction: this.frictionDefault }
        );
      }
    }

    // Split impulse-style small positional correction: move minimally along normal to reduce penetrations
    const slop = 0.001;
    for (const c of contacts) {
      const a = c.a.item;
      const b = c.b.item;
      const ap = a.Pose as any; const bp = b.Pose as any;
      ap.Position = ap.Position ?? { x: 0, y: 0 };
      bp.Position = bp.Position ?? { x: 0, y: 0 };
      // small separation along normal based on masses
      const sa = StageItemPhysics.get(a); const sb = StageItemPhysics.get(b);
      const invMassA = 1 / Math.max(1e-6, sa.mass);
      const invMassB = 1 / Math.max(1e-6, sb.mass);
      const wA = invMassA / (invMassA + invMassB);
      const wB = invMassB / (invMassA + invMassB);
      ap.Position.x -= c.normal.x * slop * wA;
      ap.Position.y -= c.normal.y * slop * wA;
      bp.Position.x += c.normal.x * slop * wB;
      bp.Position.y += c.normal.y * slop * wB;
    }
  }
}
