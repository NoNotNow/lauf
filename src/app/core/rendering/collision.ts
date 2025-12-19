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

// Object pool for OBB allocations to reduce GC pressure
class OBBPool {
  private pool: OrientedBoundingBox[] = [];
  private index = 0;

  get(): OrientedBoundingBox {
    if (this.index >= this.pool.length) {
      this.pool.push({
        center: { x: 0, y: 0 },
        half: { x: 0, y: 0 },
        rotationDeg: 0,
        corners: [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }]
      });
    }
    return this.pool[this.index++];
  }

  reset(): void {
    this.index = 0;
  }
}

const obbPool = new OBBPool();

// Pre-allocated arrays for SAT test to avoid allocations per collision check
const satAxesCache: Vec2[] = [
  { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }
];
const projectionCache = { min: 0, max: 0 };

// Pre-allocated result objects to avoid allocations
const overlapResultCache: OverlapResult = {
  overlaps: false,
  minimalTranslationVector: { x: 0, y: 0 },
  normal: { x: 0, y: 0 }
};

const intersectionResultCache: OrientedBoundingBoxIntersectionResult = {
  overlaps: false,
  minimalTranslationVector: { x: 0, y: 0 },
  normal: { x: 0, y: 0 }
};

export interface OverlapResult {
  overlaps: boolean;  // true if shape violates the boundary interior (i.e., not fully contained)
  minimalTranslationVector: Vec2;          // minimal translation vector to bring OrientedBoundingBox fully inside AxisAlignedBoundingBox (0,0 if none)
  normal: Vec2;       // collision normal (unit vector) pointing inward (same direction as minimalTranslationVector), or {0,0}
}

export interface OrientedBoundingBoxIntersectionResult { overlaps: boolean; minimalTranslationVector: Vec2; normal: Vec2 }

export function degToRad(deg: number): number { return (deg || 0) * Math.PI / 180; }

// Builds an OrientedBoundingBox from a Pose. Convention:
// - Pose.Position is top-left cell of the axis-aligned bounding rect when rotation=0.
// - Rotation is around the rectangle center.
// Uses object pooling to avoid allocations - pool must be reset at frame start
export function orientedBoundingBoxFromPose(pose: Pose | undefined): OrientedBoundingBox {
  const p = pose?.Position;
  const s = pose?.Size;
  const px = p ? p.x : 0;
  const py = p ? p.y : 0;
  const w = s ? s.x : 0;
  const h = s ? s.y : 0;
  const rot = pose ? pose.Rotation : 0;

  const halfW = w * 0.5;
  const halfH = h * 0.5;
  const cx = px + halfW;
  const cy = py + halfH;

  const rad = rot * 0.017453292519943295; // Math.PI / 180
  const c = Math.cos(rad);
  const s_rad = Math.sin(rad);

  const hWc = halfW * c;
  const hWs = halfW * s_rad;
  const hHc = halfH * c;
  const hHs = halfH * s_rad;

  // Corners: (-halfW, -halfH), (halfW, -halfH), (halfW, halfH), (-halfW, halfH)
  // x' = x*c - y*s
  // y' = x*s + y*c

  // Get pooled OBB and mutate it instead of allocating
  const obb = obbPool.get();
  obb.center.x = cx;
  obb.center.y = cy;
  obb.half.x = halfW;
  obb.half.y = halfH;
  obb.rotationDeg = rot;
  obb.corners[0].x = cx - hWc + hHs;
  obb.corners[0].y = cy - hWs - hHc;
  obb.corners[1].x = cx + hWc + hHs;
  obb.corners[1].y = cy + hWs - hHc;
  obb.corners[2].x = cx + hWc - hHs;
  obb.corners[2].y = cy + hWs + hHc;
  obb.corners[3].x = cx - hWc - hHs;
  obb.corners[3].y = cy - hWs + hHc;

  return obb;
}

// Reset the OBB pool at the start of each frame
export function resetOBBPool(): void {
  obbPool.reset();
}

// Compute if OrientedBoundingBox is fully contained in AxisAlignedBoundingBox. If not, return minimal translation vector to move it inside.
// Strategy: compare OrientedBoundingBox extrema along world X and Y axes to AxisAlignedBoundingBox limits and choose the smallest correction.
export function containmentAgainstAxisAlignedBoundingBox(orientedBoundingBox: OrientedBoundingBox, axisAlignedBoundingBox: AxisAlignedBoundingBox): OverlapResult {
  // Avoid array allocation via map() - manually find min/max
  const corners = orientedBoundingBox.corners;
  let minX = corners[0].x;
  let maxX = minX;
  let minY = corners[0].y;
  let maxY = minY;
  for (let i = 1; i < corners.length; i++) {
    const x = corners[i].x;
    const y = corners[i].y;
    if (x < minX) minX = x;
    else if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    else if (y > maxY) maxY = y;
  }

  // Positive values mean the OrientedBoundingBox leaks outside in that direction
  const leakLeft = Math.max(0, axisAlignedBoundingBox.minX - minX);
  const leakRight = Math.max(0, maxX - axisAlignedBoundingBox.maxX);
  const leakTop = Math.max(0, axisAlignedBoundingBox.minY - minY);
  const leakBottom = Math.max(0, maxY - axisAlignedBoundingBox.maxY);

  const anyLeak = (leakLeft + leakRight + leakTop + leakBottom) > 0;
  const result = overlapResultCache;
  if (!anyLeak) {
    result.overlaps = false;
    result.minimalTranslationVector.x = 0;
    result.minimalTranslationVector.y = 0;
    result.normal.x = 0;
    result.normal.y = 0;
    return result;
  }

  // Choose the smallest magnitude correction; direction pushes inward
  // Find smallest leak without allocating candidate arrays
  let smallestMag = Infinity;
  let mtvX = 0;
  let mtvY = 0;

  if (leakLeft > 0 && leakLeft < smallestMag) {
    smallestMag = leakLeft;
    mtvX = leakLeft;
    mtvY = 0;
  }
  if (leakRight > 0 && leakRight < smallestMag) {
    smallestMag = leakRight;
    mtvX = -leakRight;
    mtvY = 0;
  }
  if (leakTop > 0 && leakTop < smallestMag) {
    smallestMag = leakTop;
    mtvX = 0;
    mtvY = leakTop;
  }
  if (leakBottom > 0 && leakBottom < smallestMag) {
    smallestMag = leakBottom;
    mtvX = 0;
    mtvY = -leakBottom;
  }

  const len = Math.hypot(mtvX, mtvY) || 1;
  result.overlaps = true;
  result.minimalTranslationVector.x = mtvX;
  result.minimalTranslationVector.y = mtvY;
  result.normal.x = mtvX / len;
  result.normal.y = mtvY / len;

  return result;
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
// Mutates provided result array to avoid allocation
function orientedBoundingBoxAxes(obb: OrientedBoundingBox, result: Vec2[], startIdx: number): void {
  const c = obb.corners;
  const dx0 = c[1].x - c[0].x;
  const dy0 = c[1].y - c[0].y;
  const dx1 = c[3].x - c[0].x;
  const dy1 = c[3].y - c[0].y;

  const l0 = Math.hypot(dx0, dy0) || 1;
  const l1 = Math.hypot(dx1, dy1) || 1;

  // Use their normals as separating axes - mutate result array
  result[startIdx].x = -dy0 / l0;
  result[startIdx].y = dx0 / l0;
  result[startIdx + 1].x = -dy1 / l1;
  result[startIdx + 1].y = dx1 / l1;
}

function projectOntoAxis(points: Vec2[], axis: Vec2, result: { min: number; max: number }): void {
  let min = points[0].x * axis.x + points[0].y * axis.y;
  let max = min;
  for (let i = 1; i < points.length; i++) {
    const v = points[i].x * axis.x + points[i].y * axis.y;
    if (v < min) min = v;
    else if (v > max) max = v;
  }
  result.min = min;
  result.max = max;
}

// SAT overlap test between two OBBs; returns MTV to push A out of B
export function orientedBoundingBoxIntersectsOrientedBoundingBox(a: OrientedBoundingBox, b: OrientedBoundingBox): OrientedBoundingBoxIntersectionResult {
  // Use pre-allocated arrays to avoid allocations
  const axes = satAxesCache;
  orientedBoundingBoxAxes(a, axes, 0);
  orientedBoundingBoxAxes(b, axes, 2);

  let smallestOverlap = Infinity;
  let mtvAxisX = 0;
  let mtvAxisY = 0;

  const cdx = b.center.x - a.center.x;
  const cdy = b.center.y - a.center.y;

  const projResult = projectionCache;

  for (let i = 0; i < 4; i++) {
    const axis = axes[i];
    projectOntoAxis(a.corners, axis, projResult);
    const paMin = projResult.min;
    const paMax = projResult.max;

    projectOntoAxis(b.corners, axis, projResult);
    const pbMin = projResult.min;
    const pbMax = projResult.max;

    const overlap = Math.min(paMax, pbMax) - Math.max(paMin, pbMin);
    if (overlap <= 0) {
      const result = intersectionResultCache;
      result.overlaps = false;
      result.minimalTranslationVector.x = 0;
      result.minimalTranslationVector.y = 0;
      result.normal.x = 0;
      result.normal.y = 0;
      return result;
    }

    if (overlap < smallestOverlap) {
      smallestOverlap = overlap;
      // determine axis direction to push A away from B
      if (cdx * axis.x + cdy * axis.y < 0) {
        mtvAxisX = -axis.x;
        mtvAxisY = -axis.y;
      } else {
        mtvAxisX = axis.x;
        mtvAxisY = axis.y;
      }
    }
  }

  const l = Math.hypot(mtvAxisX, mtvAxisY) || 1;
  const nx = mtvAxisX / l;
  const ny = mtvAxisY / l;

  const result = intersectionResultCache;
  result.overlaps = true;
  result.minimalTranslationVector.x = nx * smallestOverlap;
  result.minimalTranslationVector.y = ny * smallestOverlap;
  result.normal.x = nx;
  result.normal.y = ny;

  return result;
}
