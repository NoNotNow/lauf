import { Vec2, degToRad } from '../collision';
import { Pose } from '../../models/pose';
import { StageItem } from '../../models/game-items/stage-item';
import { StageItemPhysics } from './stage-item-physics';

// Compute half-projection of an oriented rectangle (from Pose) onto a world axis unit vector
function projectedHalfExtentAlongAxis(pose: Pose | undefined, axisUnit: Vec2): number {
  const ex = Math.max(0, Number(pose?.Size?.x ?? 0)) / 2; // local half extents
  const ey = Math.max(0, Number(pose?.Size?.y ?? 0)) / 2;
  const theta = degToRad(Number(pose?.Rotation ?? 0));
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  // rotate axis into local space by -theta: u_local = R(-theta) * u
  const ux = axisUnit.x * c + axisUnit.y * s;
  const uy = -axisUnit.x * s + axisUnit.y * c;
  return Math.abs(ex * ux) + Math.abs(ey * uy);
}

function tangentOf(normal: Vec2): Vec2 {
  // Perpendicular to normal; choose right-hand rotation
  return { x: -normal.y, y: normal.x };
}

// Transfers a fraction of angular velocity into linear velocity along the boundary tangent at impact.
// - normal: inward collision normal (unit vector)
// - transfer: 0..1 fraction of tangential surface speed to inject into linear velocity; also reduces omega by same fraction
// - restitution: scales the transfer (uses same bounciness factor to keep it tame)
export function applyAngularToLinearAtBoundary(
  item: StageItem,
  pose: Pose | undefined,
  normal: Vec2,
  transfer: number = 0.35,
  restitution: number = 1.0
): void {
  const phys = StageItemPhysics.get(item);
  const omegaDeg = Number(phys.omega || 0);
  if (!isFinite(omegaDeg) || omegaDeg === 0) return;

  const t = tangentOf(normal);
  const r = projectedHalfExtentAlongAxis(pose as Pose, t);
  if (r <= 0) return;

  const omegaRad = omegaDeg * Math.PI / 180;
  const surfaceSpeed = Math.abs(omegaRad) * r; // tangential speed magnitude at contact
  const k = Math.max(0, Math.min(1, Number(transfer) || 0));
  const e = Math.max(0, Math.min(1, Number(restitution) || 0));
  const dv = k * e * surfaceSpeed;
  const sgn = Math.sign(omegaRad) || 1; // direction of spin maps to ±t

  // inject linear along tangent and damp omega
  const vx = phys.vx + sgn * dv * t.x;
  const vy = phys.vy + sgn * dv * t.y;
  const newOmega = omegaDeg * (1 - k * e);
  StageItemPhysics.set(item, { vx, vy, omega: newOmega });
}
