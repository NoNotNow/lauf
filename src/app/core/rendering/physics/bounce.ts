import { Vec2 } from '../collision';

// Small physics helpers for bounce/reflection handling

// Reflects velocity vector v around collision normal n with restitution e (0..1)
// v' = v - (1 + e) * (v·n) * n
// Only reflects if moving TOWARDS the normal (v·n < 0)
export function reflectVelocity(v: Vec2, normal: Vec2, restitution: number = 1.0): Vec2 {
  const e = Math.min(1, Math.max(0, Number(restitution) || 0));
  const nx = normal.x;
  const ny = normal.y;
  const dot = v.x * nx + v.y * ny;

  // Only reflect if moving towards the collision surface
  if (dot >= 0) return { x: v.x, y: v.y };

  const scale = (1 + e) * dot;
  return { x: v.x - scale * nx, y: v.y - scale * ny };
}

export const TINY_NUDGE = 1e-6;
