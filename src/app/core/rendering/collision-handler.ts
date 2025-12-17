import { Subscription, Subject } from 'rxjs';
import { StageItem } from '../models/game-items/stage-item';
import { TickService } from '../services/tick.service';
import { orientedBoundingBoxFromPose, orientedBoundingBoxIntersectsOrientedBoundingBox } from './collision';
import { StageItemPhysics } from './physics/stage-item-physics';
import { TINY_NUDGE } from './physics/bounce';

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
  public readonly events$ = new Subject<CollisionEvent>();

  constructor(private ticker: TickService) {}

  setRestitutionDefault(r: number): void {
    this._restitutionDefault = Math.min(1, Math.max(0, Number(r) || 1.0));
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

    for (let i = 0; i < n - 1; i++) {
      const ai = this.items[i];
      const ap = ai?.Pose;
      if (!ap) continue;
      const aobb = orientedBoundingBoxFromPose(ap);
      for (let j = i + 1; j < n; j++) {
        const bj = this.items[j];
        const bp = bj?.Pose;
        if (!bp) continue;
        const bobb = orientedBoundingBoxFromPose(bp);

        const res = orientedBoundingBoxIntersectsOrientedBoundingBox(aobb, bobb);
        if (!res.overlaps) continue;

        const normal = res.normal; // from A to B
        // Read velocities and properties
        const sa = StageItemPhysics.get(ai);
        const sb = StageItemPhysics.get(bj);
        const va = { x: sa.vx, y: sa.vy };
        const vb = { x: sb.vx, y: sb.vy };

        // Relative normal velocity (B relative to A)
        const vrn = (vb.x - va.x) * normal.x + (vb.y - va.y) * normal.y;
        if (vrn < 0) {
          // approaching: apply 1D impulse along normal
          const e = Math.min(
            this._restitutionDefault,
            Math.min(sa.restitution ?? this._restitutionDefault, sb.restitution ?? this._restitutionDefault)
          );
          const invMassA = 1 / Math.max(1e-6, sa.mass);
          const invMassB = 1 / Math.max(1e-6, sb.mass);
          const j = (-(1 + e) * vrn) / (invMassA + invMassB);
          // Apply impulse
          sa.vx -= (j * normal.x) * invMassA;
          sa.vy -= (j * normal.y) * invMassA;
          sb.vx += (j * normal.x) * invMassB;
          sb.vy += (j * normal.y) * invMassB;
          // persist
          StageItemPhysics.set(ai, sa);
          StageItemPhysics.set(bj, sb);
        }

        // Tiny positional nudge to prevent sticking
        const eps = 100 * TINY_NUDGE; // keep previous magnitude while reusing shared constant
        const apose = ai.Pose;
        const bpose = bj.Pose;
        apose.Position = apose.Position ?? ({ x: 0, y: 0 } as any);
        bpose.Position = bpose.Position ?? ({ x: 0, y: 0 } as any);
        apose.Position.x -= normal.x * eps;
        apose.Position.y -= normal.y * eps;
        bpose.Position.x += normal.x * eps;
        bpose.Position.y += normal.y * eps;

        this.events$.next({ a: ai, b: bj, normal, minimalTranslationVector: res.minimalTranslationVector });
      }
    }
  }
}
