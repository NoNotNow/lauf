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
  
  return { 
    center: { x: cx, y: cy }, 
    half: { x: halfW, y: halfH }, 
    rotationDeg: rot, 
    corners: [
      { x: cx - hWc + hHs, y: cy - hWs - hHc },
      { x: cx + hWc + hHs, y: cy + hWs - hHc },
      { x: cx + hWc - hHs, y: cy + hWs + hHc },
      { x: cx - hWc - hHs, y: cy - hWs + hHc }
    ] 
  };
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
function orientedBoundingBoxAxes(obb: OrientedBoundingBox): Vec2[] {
  const c = obb.corners;
  const dx0 = c[1].x - c[0].x;
  const dy0 = c[1].y - c[0].y;
  const dx1 = c[3].x - c[0].x;
  const dy1 = c[3].y - c[0].y;
  
  const l0 = Math.hypot(dx0, dy0) || 1;
  const l1 = Math.hypot(dx1, dy1) || 1;

  // Use their normals as separating axes
  return [
    { x: -dy0 / l0, y: dx0 / l0 },
    { x: -dy1 / l1, y: dx1 / l1 }
  ];
}

function projectOntoAxis(points: Vec2[], axis: Vec2): { min: number; max: number } {
  let min = points[0].x * axis.x + points[0].y * axis.y;
  let max = min;
  for (let i = 1; i < points.length; i++) {
    const v = points[i].x * axis.x + points[i].y * axis.y;
    if (v < min) min = v;
    else if (v > max) max = v;
  }
  return { min, max };
}

export interface OrientedBoundingBoxIntersectionResult { overlaps: boolean; minimalTranslationVector: Vec2; normal: Vec2 }

// SAT overlap test between two OBBs; returns MTV to push A out of B
export function orientedBoundingBoxIntersectsOrientedBoundingBox(a: OrientedBoundingBox, b: OrientedBoundingBox): OrientedBoundingBoxIntersectionResult {
  const axesA = orientedBoundingBoxAxes(a);
  const axesB = orientedBoundingBoxAxes(b);
  
  let smallestOverlap = Infinity;
  let mtvAxisX = 0;
  let mtvAxisY = 0;

  const cdx = b.center.x - a.center.x;
  const cdy = b.center.y - a.center.y;

  for (let i = 0; i < 4; i++) {
    const axis = i < 2 ? axesA[i] : axesB[i - 2];
    const pa = projectOntoAxis(a.corners, axis);
    const pb = projectOntoAxis(b.corners, axis);
    
    const overlap = Math.min(pa.max, pb.max) - Math.max(pa.min, pb.min);
    if (overlap <= 0) {
      return { overlaps: false, minimalTranslationVector: { x: 0, y: 0 }, normal: { x: 0, y: 0 } };
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
  
  return { 
    overlaps: true, 
    minimalTranslationVector: { x: nx * smallestOverlap, y: ny * smallestOverlap }, 
    normal: { x: nx, y: ny } 
  };
}
