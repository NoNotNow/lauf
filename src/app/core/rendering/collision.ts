// Reusable collision helpers for StageItem-like poses in grid cell coordinates
// Focus: oriented-rectangle (from Pose.Size and Pose.Rotation) against axis-aligned boundary rectangle.

import { Pose } from '../models/pose';

export interface Vec2 { x: number; y: number }

export interface AABB { minX: number; minY: number; maxX: number; maxY: number }

export interface OBB {
  center: Vec2;        // center in cell coordinates
  half: Vec2;          // half extents (width/2, height/2) in cells
  rotationDeg: number; // rotation in degrees (clockwise positive)
  corners: Vec2[];     // 4 corners in world coordinates, CCW starting from top-left
}

export interface OverlapResult {
  overlaps: boolean;  // true if shape violates the boundary interior (i.e., not fully contained)
  mtv: Vec2;          // minimal translation vector to bring OBB fully inside AABB (0,0 if none)
  normal: Vec2;       // collision normal (unit vector) pointing inward (same direction as mtv), or {0,0}
}

export function degToRad(deg: number): number { return (deg || 0) * Math.PI / 180; }

// Builds an OBB from a Pose. Convention:
// - Pose.Position is top-left cell of the axis-aligned bounding rect when rotation=0.
// - Rotation is around the rectangle center.
export function obbFromPose(pose: Pose | undefined): OBB {
  const px = Number(pose?.Position?.x ?? 0);
  const py = Number(pose?.Position?.y ?? 0);
  const w = Math.max(0, Number(pose?.Size?.x ?? 0));
  const h = Math.max(0, Number(pose?.Size?.y ?? 0));
  const rot = Number(pose?.Rotation ?? 0);

  const cx = px + w / 2;
  const cy = py + h / 2;
  const half = { x: w / 2, y: h / 2 };

  const c = Math.cos(degToRad(rot));
  const s = Math.sin(degToRad(rot));

  // Local corners relative to center (axis-aligned before rotation)
  const local: Vec2[] = [
    { x: -half.x, y: -half.y }, // top-left
    { x:  half.x, y: -half.y }, // top-right
    { x:  half.x, y:  half.y }, // bottom-right
    { x: -half.x, y:  half.y }, // bottom-left
  ];

  const corners = local.map(({ x, y }) => ({
    x: cx + (x * c - y * s),
    y: cy + (x * s + y * c),
  }));

  return { center: { x: cx, y: cy }, half, rotationDeg: rot, corners };
}

// Compute if OBB is fully contained in AABB. If not, return minimal translation vector to move it inside.
// Strategy: compare OBB extrema along world X and Y axes to AABB limits and choose the smallest correction.
export function containmentAgainstAABB(obb: OBB, aabb: AABB): OverlapResult {
  const xs = obb.corners.map(p => p.x);
  const ys = obb.corners.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  // Positive values mean the OBB leaks outside in that direction
  const leakLeft = Math.max(0, aabb.minX - minX);
  const leakRight = Math.max(0, maxX - aabb.maxX);
  const leakTop = Math.max(0, aabb.minY - minY);
  const leakBottom = Math.max(0, maxY - aabb.maxY);

  const anyLeak = (leakLeft + leakRight + leakTop + leakBottom) > 0;
  if (!anyLeak) return { overlaps: false, mtv: { x: 0, y: 0 }, normal: { x: 0, y: 0 } };

  // Choose the smallest magnitude correction; direction pushes inward
  let mtv: Vec2 = { x: 0, y: 0 };
  let normal: Vec2 = { x: 0, y: 0 };

  // Candidate corrections along x
  const corrLeft = leakLeft > 0 ? { x: leakLeft, y: 0 } : undefined;   // move +x
  const corrRight = leakRight > 0 ? { x: -leakRight, y: 0 } : undefined; // move -x
  // along y
  const corrTop = leakTop > 0 ? { x: 0, y: leakTop } : undefined;      // move +y
  const corrBottom = leakBottom > 0 ? { x: 0, y: -leakBottom } : undefined; // move -y

  const candidates = [corrLeft, corrRight, corrTop, corrBottom].filter(Boolean) as Vec2[];
  candidates.sort((a, b) => (a.x * a.x + a.y * a.y) - (b.x * b.x + b.y * b.y));
  mtv = candidates[0];
  const len = Math.hypot(mtv.x, mtv.y) || 1;
  normal = { x: mtv.x / len, y: mtv.y / len };

  return { overlaps: true, mtv, normal };
}

// Convenience: from a Pose and AABB
export function poseContainmentAgainstAABB(pose: Pose | undefined, aabb: AABB): OverlapResult {
  const obb = obbFromPose(pose);
  return containmentAgainstAABB(obb, aabb);
}
