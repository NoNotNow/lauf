// Trivial change to force re-evaluation
import { StageItem } from '../../models/game-items/stage-item';
import { Pose } from '../../models/pose';
import { OrientedBoundingBox } from '../collision';
import { StageItemPhysics, PhysicsState } from './stage-item-physics';

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
export function resolveBoundaryCollision(
  item: StageItem,
  phys: StageItemPhysics,
  obb: OrientedBoundingBox,
  boundary: { minX: number; minY: number; maxX: number; maxY: number },
  normal: { x: number; y: number },
  params: ItemItemImpulseParams
): void {
  const s = phys.State;
  const e = Math.min(1, Math.max(0, Number(params?.restitution ?? 0.85)));
  const mu = Math.max(0, Number(params?.friction ?? 0));

  const invMass = s.mass >= 1e6 ? 0 : 1 / Math.max(1e-6, s.mass);
  if (invMass === 0) return;

  const I = phys.momentOfInertia(item);
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
  let vx = s.vx + Jn.x * invMass;
  let vy = s.vy + Jn.y * invMass;
  const tau = cross2(r, Jn);
  const newOmegaRad = omegaRad + tau * invI;
  let omega = StageItemPhysics.omegaRadToDegPerSec(newOmegaRad);

  // Friction/Tangent
  const vRelT_vec = { x: vAtC.x - vRelN * normal.x, y: vAtC.y - vRelN * normal.y };
  const tLen = len(vRelT_vec.x, vRelT_vec.y);
  if (tLen > 1e-6) {
    const t = { x: -vRelT_vec.x / tLen, y: -vRelT_vec.y / tLen };
    const vRelT = dot(vAtC.x, vAtC.y, t.x, t.y);
    const rXt = cross2(r, t);
    const kT = invMass + (rXt * rXt) * invI;
    let jt = -vRelT / (kT || 1);
    
    const maxFric = mu * jn;
    if (jt > maxFric) jt = maxFric;
    if (jt < -maxFric) jt = -maxFric;

    const Jt = { x: jt * t.x, y: jt * t.y };
    vx += Jt.x * invMass;
    vy += Jt.y * invMass;
    const tauF = cross2(r, Jt);
    omega = StageItemPhysics.omegaRadToDegPerSec(newOmegaRad + tauF * invI);
  }

  phys.set({ vx, vy, omega });
}

// Resolve collision impulse between two items along normal and tangent, including angular effects.
// normal must point from A to B and be unit length.
export function resolveItemItemCollision(
  a: StageItem,
  b: StageItem,
  physA: StageItemPhysics,
  physB: StageItemPhysics,
  aObb: OrientedBoundingBox,
  bObb: OrientedBoundingBox,
  normal: { x: number; y: number },
  params: ItemItemImpulseParams
): void {
  const sa = physA.State;
  const sb = physB.State;
  const e = Math.min(1, Math.max(0, Number(params?.restitution ?? 0.85)));
  const mu = Math.max(0, Number(params?.friction ?? 0));

  const invMassA = sa.mass >= 1e6 ? 0 : 1 / Math.max(1e-6, sa.mass);
  const invMassB = sb.mass >= 1e6 ? 0 : 1 / Math.max(1e-6, sb.mass);
  const IA = physA.momentOfInertia(a);
  const IB = physB.momentOfInertia(b);
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
  let vax = sa.vx - Jn.x * invMassA;
  let vay = sa.vy - Jn.y * invMassA;
  let vbx = sb.vx + Jn.x * invMassB;
  let vby = sb.vy + Jn.y * invMassB;

  // Angular impulses: τ = r × J
  const tauA = cross2(ra, Jn);
  const tauB = cross2(rb, Jn);
  const newOmegaAr = omegaAr - tauA * invIA; // minus because J applied to A is negative of B's
  const newOmegaBr = omegaBr + tauB * invIB;
  let omegaA = StageItemPhysics.omegaRadToDegPerSec(newOmegaAr);
  let omegaB = StageItemPhysics.omegaRadToDegPerSec(newOmegaBr);

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
    
    vax -= Jt.x * invMassA;
    vay -= Jt.y * invMassA;
    vbx += Jt.x * invMassB;
    vby += Jt.y * invMassB;

    // Angular due to friction
    const tauAf = cross2(ra, Jt);
    const tauBf = cross2(rb, Jt);
    // Update omegas accumulating both normal and tangential contributions
    omegaA = StageItemPhysics.omegaRadToDegPerSec(newOmegaAr - tauAf * invIA);
    omegaB = StageItemPhysics.omegaRadToDegPerSec(newOmegaBr + tauBf * invIB);
  }

  // Persist using in-place updates
  physA.set({ vx: vax, vy: vay, omega: omegaA });
  physB.set({ vx: vbx, vy: vby, omega: omegaB });
}

/**
 * Resolve resting contact using constraint forces instead of impulses.
 * For resting contacts, we apply forces that counter external forces (like gravity)
 * and prevent penetration, rather than using velocity-based impulses.
 * 
 * @param a First item
 * @param b Second item
 * @param physA Physics state for item A
 * @param physB Physics state for item B
 * @param aObb OBB for item A
 * @param bObb OBB for item B
 * @param normal Contact normal (from A to B)
 * @param penetrationDepth Penetration depth (magnitude of MTV)
 * @param gravityY Gravity acceleration in Y direction (cells/s^2), default 9.81
 */
export function resolveRestingContactConstraint(
  a: StageItem,
  b: StageItem,
  physA: StageItemPhysics,
  physB: StageItemPhysics,
  aObb: OrientedBoundingBox,
  bObb: OrientedBoundingBox,
  normal: { x: number; y: number },
  penetrationDepth: number,
  gravityY: number = 9.81
): void {
  const sa = physA.State;
  const sb = physB.State;
  const mu = Math.min(sa.friction, sb.friction);

  const invMassA = sa.mass >= 1e6 ? 0 : 1 / Math.max(1e-6, sa.mass);
  const invMassB = sb.mass >= 1e6 ? 0 : 1 / Math.max(1e-6, sb.mass);
  const IA = physA.momentOfInertia(a);
  const IB = physB.momentOfInertia(b);
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

  // Relative velocity along normal
  const vRelN = dot(vRel.x, vRel.y, normal.x, normal.y);

  // Calculate gravity force components
  // Gravity acts downward (positive Y), so we need to counter it when normal points up
  const gravityForceA = { x: 0, y: sa.mass * gravityY };
  const gravityForceB = { x: 0, y: sb.mass * gravityY };

  // For truly resting contacts, we want to:
  // 1. Zero out relative velocity along normal (prevent bouncing)
  // 2. Counter gravity to maintain contact
  // 3. Use gentle position correction (position correction is handled separately)
  
  // Check if either object is static (infinite mass)
  const isAStatic = invMassA === 0;
  const isBStatic = invMassB === 0;
  
  // Calculate gravity component along normal
  const gravityDotNormalA = dot(gravityForceA.x, gravityForceA.y, normal.x, normal.y);
  const gravityDotNormalB = dot(gravityForceB.x, gravityForceB.y, -normal.x, -normal.y);
  
  // For resting contacts, use strong damping to zero out normal velocity
  // This prevents oscillations and bouncing
  const dampingFactor = 50; // Increased damping for stability
  const targetVRelN = 0; // Target is zero relative velocity along normal
  const velocityError = vRelN - targetVRelN;
  const dampingForce = -velocityError * dampingFactor;
  
  // Gentle position correction (position correction is mainly handled in applyPositionCorrection)
  const slop = 0.01;
  const penetration = Math.max(0, penetrationDepth - slop);
  const positionCorrectionFactor = 20; // Reduced from 100 to prevent overshoot
  const positionCorrectionForce = penetration * positionCorrectionFactor;
  
  // Total normal force needed
  const raXn = cross2(ra, normal);
  const rbXn = cross2(rb, normal);
  const kN = invMassA + invMassB + (raXn * raXn) * invIA + (rbXn * rbXn) * invIB;
  
  // Normal force magnitude
  // For static objects, only apply force to the moving object
  const gravityComponent = (isAStatic ? 0 : gravityDotNormalA) + (isBStatic ? 0 : gravityDotNormalB);
  const normalForceMagnitude = (gravityComponent + positionCorrectionForce + dampingForce) / (kN || 1);
  
  // Clamp to prevent excessive forces
  const maxForce = 500; // Reduced from 1000
  const clampedNormalForce = Math.max(-maxForce, Math.min(maxForce, normalForceMagnitude));
  
  // Apply normal force as impulse
  const dt = 0.016; // Approximate frame time
  const jn = clampedNormalForce * dt;
  
  // Apply normal constraint impulse
  const Jn = { x: jn * normal.x, y: jn * normal.y };
  // Only apply velocity changes to moving objects
  let vax = isAStatic ? sa.vx : sa.vx - Jn.x * invMassA;
  let vay = isAStatic ? sa.vy : sa.vy - Jn.y * invMassA;
  let vbx = isBStatic ? sb.vx : sb.vx + Jn.x * invMassB;
  let vby = isBStatic ? sb.vy : sb.vy + Jn.y * invMassB;

  // Angular impulses (only for moving objects)
  let newOmegaAr = omegaAr;
  let newOmegaBr = omegaBr;
  if (!isAStatic || !isBStatic) {
    const tauA = isAStatic ? 0 : cross2(ra, Jn);
    const tauB = isBStatic ? 0 : cross2(rb, Jn);
    newOmegaAr = omegaAr - tauA * invIA;
    newOmegaBr = omegaBr + tauB * invIB;
  }
  let omegaA = StageItemPhysics.omegaRadToDegPerSec(newOmegaAr);
  let omegaB = StageItemPhysics.omegaRadToDegPerSec(newOmegaBr);

  // Friction constraint for tangential motion
  // Only applies Coulomb friction to prevent sliding, not to oppose intentional movement
  const tangent0 = { x: vRel.x - vRelN * normal.x, y: vRel.y - vRelN * normal.y };
  const tLen = len(tangent0.x, tangent0.y);
  if (tLen > 1e-6 && mu > 0) {
    const t = { x: tangent0.x / tLen, y: tangent0.y / tLen };
    const vRelT = dot(vRel.x, vRel.y, t.x, t.y);
    
    // Apply minimal damping only for very small velocities (micro-slippage)
    // For resting contacts, we don't want to oppose intentional movement
    const microVelocityThreshold = 0.1; // cells/s
    let frictionForce = 0;
    if (Math.abs(vRelT) < microVelocityThreshold) {
      // Light damping to eliminate micro-slippage
      const frictionDamping = 1; // Reduced from 5 to avoid opposing intentional movement
      frictionForce = -vRelT * frictionDamping;
    }
    
    // Clamp by Coulomb friction limit
    const maxFrictionForce = mu * Math.abs(clampedNormalForce);
    const clampedFrictionForce = Math.max(-maxFrictionForce, Math.min(maxFrictionForce, frictionForce));
    
    const raXt = cross2(ra, t);
    const rbXt = cross2(rb, t);
    const kT = invMassA + invMassB + (raXt * raXt) * invIA + (rbXt * rbXt) * invIB;
    const jt = (clampedFrictionForce * dt) / (kT || 1);
    
    const Jt = { x: jt * t.x, y: jt * t.y };
    // Only apply friction to moving objects
    if (!isAStatic) {
      vax -= Jt.x * invMassA;
      vay -= Jt.y * invMassA;
    }
    if (!isBStatic) {
      vbx += Jt.x * invMassB;
      vby += Jt.y * invMassB;
    }

    // Angular due to friction (only for moving objects)
    // Use the already-updated angular velocities from normal impulse
    if (!isAStatic || !isBStatic) {
      const tauAf = isAStatic ? 0 : cross2(ra, Jt);
      const tauBf = isBStatic ? 0 : cross2(rb, Jt);
      newOmegaAr = newOmegaAr - tauAf * invIA;
      newOmegaBr = newOmegaBr + tauBf * invIB;
      omegaA = StageItemPhysics.omegaRadToDegPerSec(newOmegaAr);
      omegaB = StageItemPhysics.omegaRadToDegPerSec(newOmegaBr);
    }
  }

  // Persist using in-place updates
  physA.set({ vx: vax, vy: vay, omega: omegaA });
  physB.set({ vx: vbx, vy: vby, omega: omegaB });
}
