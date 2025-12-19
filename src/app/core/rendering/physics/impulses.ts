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

// Estimate a reasonable contact point between two OBBs using support point clipping.
// This prevents objects from rotating "out of nowhere" when resting on a large flat surface.
export function estimateContactPoint(
  a: OrientedBoundingBox,
  b: OrientedBoundingBox,
  normal: { x: number; y: number }
): { x: number; y: number } {
  const n = normal;
  const t = { x: -n.y, y: n.x };

  const getSeg = (obb: OrientedBoundingBox, norm: { x: number; y: number }) => {
    let min = Infinity;
    let max = -Infinity;
    let bestDist = -Infinity;
    const eps = 1e-4;
    for (const p of obb.corners) {
      const d = p.x * norm.x + p.y * norm.y;
      if (d > bestDist + eps) {
        bestDist = d;
        min = max = p.x * t.x + p.y * t.y;
      } else if (d > bestDist - eps) {
        const proj = p.x * t.x + p.y * t.y;
        if (proj < min) min = proj;
        if (proj > max) max = proj;
      }
    }
    return { min, max, dist: bestDist };
  };

  const segA = getSeg(a, n);
  const segB = getSeg(b, { x: -n.x, y: -n.y });

  const overlapMin = Math.max(segA.min, segB.min);
  const overlapMax = Math.min(segA.max, segB.max);
  // If there's no overlap in projection (shouldn't happen if OBBs intersect), 
  // fall back to a simple average of face centers.
  const mid = (overlapMin <= overlapMax) ? (overlapMin + overlapMax) * 0.5 : (segA.min + segA.max + segB.min + segB.max) * 0.25;
  const interfaceDist = (segA.dist - segB.dist) * 0.5;

  return {
    x: n.x * interfaceDist + t.x * mid,
    y: n.y * interfaceDist + t.y * mid
  };
}

// Estimate a reasonable contact point between an OBB and a boundary (AABB).
// Strategy: average the corners of the OBB that are outside the AABB.
export function estimateBoundaryContactPoint(
  obb: OrientedBoundingBox,
  boundary: { minX: number; minY: number; maxX: number; maxY: number },
  normal: { x: number; y: number }
): { x: number; y: number } {
  let count = 0;
  let cx = 0;
  let cy = 0;

  // Small epsilon to catch points exactly on or slightly outside the boundary
  const eps = 1e-4;

  for (const p of obb.corners) {
    let outside = false;
    // Normal points INWARD to the boundary box
    if (normal.x > 0.9 && p.x < boundary.minX + eps) outside = true;
    else if (normal.x < -0.9 && p.x > boundary.maxX - eps) outside = true;
    else if (normal.y > 0.9 && p.y < boundary.minY + eps) outside = true;
    else if (normal.y < -0.9 && p.y > boundary.maxY - eps) outside = true;

    if (outside) {
      cx += p.x;
      cy += p.y;
      count++;
    }
  }

  if (count > 0) {
    return { x: cx / count, y: cy / count };
  }

  // Fallback: if no corners are clearly outside, use the point on the OBB surface 
  // in the direction of the normal relative to the center.
  // This is a simplification.
  return {
    x: obb.center.x - normal.x * Math.max(obb.half.x, obb.half.y),
    y: obb.center.y - normal.y * Math.max(obb.half.x, obb.half.y)
  };
}

// Resolve collision impulse between an item and a static boundary along normal and tangent.
export function applyBoundaryCollisionImpulse(
  item: StageItem,
  obb: OrientedBoundingBox,
  boundary: { minX: number; minY: number; maxX: number; maxY: number },
  normal: { x: number; y: number },
  params: ItemItemImpulseParams
): void {
  const e = Math.min(1, Math.max(0, Number(params?.restitution ?? 0.85)));
  const mu = Math.max(0, Number(params?.friction ?? 0));

  const s = StageItemPhysics.get(item);
  const invMass = s.mass >= 1e6 ? 0 : 1 / Math.max(1e-6, s.mass);
  if (invMass === 0) return;

  const I = StageItemPhysics.momentOfInertia(item);
  const invI = s.mass >= 1e6 ? 0 : 1 / I;

  // Contact point and lever arm
  const cp = estimateBoundaryContactPoint(obb, boundary, normal);
  const r = { x: cp.x - obb.center.x, y: cp.y - obb.center.y };

  // Velocity at contact
  const omegaRad = StageItemPhysics.omegaDegToRadPerSec(s.omega);
  const vAtC = { x: s.vx + (-omegaRad * r.y), y: s.vy + (omegaRad * r.x) };

  // Velocity along normal (inward normal, so v·n < 0 is approaching)
  const vRelN = dot(vAtC.x, vAtC.y, normal.x, normal.y);
  if (vRelN > 0) return; // Separating

  const velThreshold = 0.5;
  const actualE = (-vRelN < velThreshold) ? 0 : e;

  // Effective mass along normal
  const rXn = cross2(r, normal);
  const kN = invMass + (rXn * rXn) * invI;
  const jn = -(1 + actualE) * vRelN / (kN || 1);

  // Apply normal impulse
  const Jn = { x: jn * normal.x, y: jn * normal.y };
  s.vx += Jn.x * invMass;
  s.vy += Jn.y * invMass;
  const tau = cross2(r, Jn);
  const newOmegaRad = omegaRad + tau * invI;

  // Friction/Tangent
  const vRelT_vec = { x: vAtC.x - vRelN * normal.x, y: vAtC.y - vRelN * normal.y };
  const tLen = len(vRelT_vec.x, vRelT_vec.y);
  if (tLen > 1e-6) {
    const t = { x: -vRelT_vec.x / tLen, y: -vRelT_vec.y / tLen };
    const vRelT = dot(vAtC.x, vAtC.y, t.x, t.y);
    const rXt = cross2(r, t);
    const kT = invMass + (rXt * rXt) * invI;
    let jt = -(1 + actualE) * vRelT / (kT || 1); // Using restitution for friction too might be too much, but let's try
    // Actually, simple friction usually doesn't use restitution
    jt = -vRelT / (kT || 1);
    
    const maxFric = mu * jn;
    if (jt > maxFric) jt = maxFric;
    if (jt < -maxFric) jt = -maxFric;

    const Jt = { x: jt * t.x, y: jt * t.y };
    s.vx += Jt.x * invMass;
    s.vy += Jt.y * invMass;
    const tauF = cross2(r, Jt);
    s.omega = StageItemPhysics.omegaRadToDegPerSec(newOmegaRad + tauF * invI);
  } else {
    s.omega = StageItemPhysics.omegaRadToDegPerSec(newOmegaRad);
  }

  StageItemPhysics.set(item, s);
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
  const e = Math.min(1, Math.max(0, Number(params?.restitution ?? 0.85)));
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
  const c = estimateContactPoint(aObb, bObb, normal);
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
