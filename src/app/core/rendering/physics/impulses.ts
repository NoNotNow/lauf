import { StageItem } from '../../models/game-items/stage-item';
import { Pose } from '../../models/pose';
import { OrientedBoundingBox } from '../collision';
import { StageItemPhysics } from './stage-item-physics';

// Simple 2D vector helpers (kept local to keep file small and focused)
function dot(ax: number, ay: number, bx: number, by: number): number { return ax * bx + ay * by; }
function len(x: number, y: number): number { return Math.hypot(x, y); }
function normalize(x: number, y: number): { x: number; y: number } {
  const l = len(x, y) || 1; return { x: x / l, y: y / l };
}
// 2D scalar cross products
function cross2(a: { x: number; y: number }, b: { x: number; y: number }): number { return a.x * b.y - a.y * b.x; }
function crossSV(s: number, v: { x: number; y: number }): { x: number; y: number } { return { x: -s * v.y, y: s * v.x }; }

export interface ItemItemImpulseParams {
  restitution: number;     // 0..1
  friction: number;        // >=0, typical 0.2..1
}

// Estimate a reasonable contact point between two OBBs using their centers midpoint.
// This is a simplification that still produces angular effects for off-center hits.
export function estimateContactPoint(a: OrientedBoundingBox, b: OrientedBoundingBox): { x: number; y: number } {
  return { x: (a.center.x + b.center.x) * 0.5, y: (a.center.y + b.center.y) * 0.5 };
}

// Resolve collision impulse between two items along normal and tangent, including angular effects.
// normal must point from A to B and be unit length.
export function applyItemItemCollisionImpulse(
  a: StageItem,
  b: StageItem,
  aPose: Pose | undefined,
  bPose: Pose | undefined,
  aObb: OrientedBoundingBox,
  bObb: OrientedBoundingBox,
  normal: { x: number; y: number },
  params: ItemItemImpulseParams
): void {
  const e = Math.min(1, Math.max(0, Number(params?.restitution ?? 1)));
  const mu = Math.max(0, Number(params?.friction ?? 0));

  const sa = StageItemPhysics.get(a);
  const sb = StageItemPhysics.get(b);
  const invMassA = sa.mass >= 1e6 ? 0 : 1 / Math.max(1e-6, sa.mass);
  const invMassB = sb.mass >= 1e6 ? 0 : 1 / Math.max(1e-6, sb.mass);
  const IA = StageItemPhysics.momentOfInertia(a);
  const IB = StageItemPhysics.momentOfInertia(b);
  const invIA = sa.mass >= 1e6 ? 0 : 1 / IA;
  const invIB = sb.mass >= 1e6 ? 0 : 1 / IB;

  // Contact point and lever arms
  const c = estimateContactPoint(aObb, bObb);
  const ra = { x: c.x - aObb.center.x, y: c.y - aObb.center.y };
  const rb = { x: c.x - bObb.center.x, y: c.y - bObb.center.y };

  // Velocities at contact, including angular component
  const omegaAr = StageItemPhysics.omegaDegToRadPerSec(sa.omega);
  const omegaBr = StageItemPhysics.omegaDegToRadPerSec(sb.omega);
  const va = { x: sa.vx, y: sa.vy };
  const vb = { x: sb.vx, y: sb.vy };
  const vAatC = { x: va.x + (-omegaAr * ra.y), y: va.y + (omegaAr * ra.x) };
  const vBatC = { x: vb.x + (-omegaBr * rb.y), y: vb.y + (omegaBr * rb.x) };
  const vRel = { x: vBatC.x - vAatC.x, y: vBatC.y - vAatC.y };

  // Early out if separating along normal
  const vRelN = dot(vRel.x, vRel.y, normal.x, normal.y);
  if (vRelN > 0) return;

  // Velocity threshold for resting contact: zero restitution for low-speed impacts
  // to prevent jitter and energy gain from micro-bounces.
  const velThreshold = 0.5; // cells/s
  const actualE = (-vRelN < velThreshold) ? 0 : e;

  // Effective mass along normal (includes rotational terms)
  const raXn = cross2(ra, normal);
  const rbXn = cross2(rb, normal);
  const kN = invMassA + invMassB + (raXn * raXn) * invIA + (rbXn * rbXn) * invIB;
  const jn = -(1 + actualE) * vRelN / (kN || 1);

  // Apply normal impulse
  const Jn = { x: jn * normal.x, y: jn * normal.y };
  sa.vx -= Jn.x * invMassA;
  sa.vy -= Jn.y * invMassA;
  sb.vx += Jn.x * invMassB;
  sb.vy += Jn.y * invMassB;
  // Angular impulses: τ = r × J
  const tauA = cross2(ra, Jn);
  const tauB = cross2(rb, Jn);
  const newOmegaAr = omegaAr - tauA * invIA; // minus because J applied to A is negative of B's
  const newOmegaBr = omegaBr + tauB * invIB;

  // Tangent (friction/spin transfer)
  const tangent0 = { x: vRel.x - vRelN * normal.x, y: vRel.y - vRelN * normal.y };
  const tLen = len(tangent0.x, tangent0.y);
  if (tLen > 0) {
    const t = { x: tangent0.x / tLen, y: tangent0.y / tLen };
    const vRelT = dot(vRel.x, vRel.y, t.x, t.y);
    const raXt = cross2(ra, t);
    const rbXt = cross2(rb, t);
    const kT = invMassA + invMassB + (raXt * raXt) * invIA + (rbXt * rbXt) * invIB;
    let jt = -vRelT / (kT || 1);
    const maxFric = mu * jn;
    if (jt > maxFric) jt = maxFric;
    if (jt < -maxFric) jt = -maxFric;
    const Jt = { x: jt * t.x, y: jt * t.y };
    sa.vx -= Jt.x * invMassA;
    sa.vy -= Jt.y * invMassA;
    sb.vx += Jt.x * invMassB;
    sb.vy += Jt.y * invMassB;
    // Angular due to friction
    const tauAf = cross2(ra, Jt);
    const tauBf = cross2(rb, Jt);
    // Update omegas accumulating both normal and tangential contributions
    const omegaArTotal = newOmegaAr - tauAf * invIA;
    const omegaBrTotal = newOmegaBr + tauBf * invIB;
    sa.omega = StageItemPhysics.omegaRadToDegPerSec(omegaArTotal);
    sb.omega = StageItemPhysics.omegaRadToDegPerSec(omegaBrTotal);
  } else {
    sa.omega = StageItemPhysics.omegaRadToDegPerSec(newOmegaAr);
    sb.omega = StageItemPhysics.omegaRadToDegPerSec(newOmegaBr);
  }

  // Persist
  StageItemPhysics.set(a, sa);
  StageItemPhysics.set(b, sb);
}
