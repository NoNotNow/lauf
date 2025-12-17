// Reusable collision helpers for StageItem-like poses in grid cell coordinates
// Focus: oriented-rectangle (from Pose.Size and Pose.Rotation) against axis-aligned boundary rectangle.

import { Pose } from '../models/pose';

export interface Vec2 { x: number; y: number }

export interface AxisAlignedBoundingBox { minX: number; minY: number; maxX: number; maxY: number }

export interface OrientedBoundingBox {
  center: Vec2;        // center in cell coordinates
  half: Vec2;          // half extents (width/2, height/2) in cells
  rotationDeg: number; // rotation in degrees (clockwise positive)
  corners: Vec2[];     // 4 corners in world coordinates, CCW starting from top-left
}

export interface OverlapResult {
  overlaps: boolean;  // true if shape violates the boundary interior (i.e., not fully contained)
  minimalTranslationVector: Vec2;          // minimal translation vector to bring OrientedBoundingBox fully inside AxisAlignedBoundingBox (0,0 if none)
  normal: Vec2;       // collision normal (unit vector) pointing inward (same direction as minimalTranslationVector), or {0,0}
}

export function degToRad(deg: number): number { return (deg || 0) * Math.PI / 180; }

// Builds an OrientedBoundingBox from a Pose. Convention:
// - Pose.Position is top-left cell of the axis-aligned bounding rect when rotation=0.
// - Rotation is around the rectangle center.
export function orientedBoundingBoxFromPose(pose: Pose | undefined): OrientedBoundingBox {
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

// Compute if OrientedBoundingBox is fully contained in AxisAlignedBoundingBox. If not, return minimal translation vector to move it inside.
// Strategy: compare OrientedBoundingBox extrema along world X and Y axes to AxisAlignedBoundingBox limits and choose the smallest correction.
export function containmentAgainstAxisAlignedBoundingBox(orientedBoundingBox: OrientedBoundingBox, axisAlignedBoundingBox: AxisAlignedBoundingBox): OverlapResult {
  const xs = orientedBoundingBox.corners.map(p => p.x);
  const ys = orientedBoundingBox.corners.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  // Positive values mean the OrientedBoundingBox leaks outside in that direction
  const leakLeft = Math.max(0, axisAlignedBoundingBox.minX - minX);
  const leakRight = Math.max(0, maxX - axisAlignedBoundingBox.maxX);
  const leakTop = Math.max(0, axisAlignedBoundingBox.minY - minY);
  const leakBottom = Math.max(0, maxY - axisAlignedBoundingBox.maxY);

  const anyLeak = (leakLeft + leakRight + leakTop + leakBottom) > 0;
  if (!anyLeak) return { overlaps: false, minimalTranslationVector: { x: 0, y: 0 }, normal: { x: 0, y: 0 } };

  // Choose the smallest magnitude correction; direction pushes inward
  let mtv: Vec2;
  let normal: Vec2;

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

  return { overlaps: true, minimalTranslationVector: mtv, normal };
}

// Convenience: from a Pose and AxisAlignedBoundingBox
export function poseContainmentAgainstAxisAlignedBoundingBox(pose: Pose | undefined, axisAlignedBoundingBox: AxisAlignedBoundingBox): OverlapResult {
  const obb = orientedBoundingBoxFromPose(pose);
  return containmentAgainstAxisAlignedBoundingBox(obb, axisAlignedBoundingBox);
}

// ---------- OrientedBoundingBox vs OrientedBoundingBox (item–item) ----------

function dot(a: Vec2, b: Vec2): number { return a.x * b.x + a.y * b.y; }
function sub(a: Vec2, b: Vec2): Vec2 { return { x: a.x - b.x, y: a.y - b.y }; }
function len(v: Vec2): number { return Math.hypot(v.x, v.y); }
function normalize(v: Vec2): Vec2 { const l = len(v) || 1; return { x: v.x / l, y: v.y / l }; }

// Build 4 edge normals (axes) for an OrientedBoundingBox (two unique directions suffice)
function orientedBoundingBoxAxes(orientedBoundingBox: OrientedBoundingBox): Vec2[] {
  const c = orientedBoundingBox.corners;
  const e0 = normalize(sub(c[1], c[0])); // top edge direction
  const e1 = normalize(sub(c[3], c[0])); // left edge direction
  // Use their normals as separating axes
  const n0 = { x: -e0.y, y: e0.x };
  const n1 = { x: -e1.y, y: e1.x };
  return [normalize(n0), normalize(n1)];
}

function projectOntoAxis(points: Vec2[], axis: Vec2): { min: number; max: number } {
  let min = Infinity, max = -Infinity;
  for (const p of points) {
    const v = dot(p, axis);
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { min, max };
}

export interface OrientedBoundingBoxIntersectionResult { overlaps: boolean; minimalTranslationVector: Vec2; normal: Vec2 }

// SAT overlap test between two OBBs; returns MTV to push A out of B
export function orientedBoundingBoxIntersectsOrientedBoundingBox(a: OrientedBoundingBox, b: OrientedBoundingBox): OrientedBoundingBoxIntersectionResult {
  const axes = [...orientedBoundingBoxAxes(a), ...orientedBoundingBoxAxes(b)];
  let smallestOverlap = Infinity;
  let mtvAxis: Vec2 | null = null;

  const centersDir = sub(b.center, a.center);

  for (const axis of axes) {
    const pa = projectOntoAxis(a.corners, axis);
    const pb = projectOntoAxis(b.corners, axis);
    const overlap = Math.min(pa.max, pb.max) - Math.max(pa.min, pb.min);
    if (overlap <= 0) {
      return { overlaps: false, minimalTranslationVector: { x: 0, y: 0 }, normal: { x: 0, y: 0 } };
    }
    if (overlap < smallestOverlap) {
      // determine axis direction to push A away from B
      const dir = dot(centersDir, axis) < 0 ? { x: -axis.x, y: -axis.y } : axis;
      smallestOverlap = overlap;
      mtvAxis = dir;
    }
  }

  const normal = normalize(mtvAxis!);
  const mtv = { x: normal.x * smallestOverlap, y: normal.y * smallestOverlap };
  return { overlaps: true, minimalTranslationVector: mtv, normal };
}
