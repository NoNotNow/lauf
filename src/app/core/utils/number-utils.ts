// Tiny numeric helpers to keep code idiomatic and DRY

export function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return isNaN(n) ? fallback : n;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function normalizeAngleDeg360(a: number): number {
  let x = a % 360;
  if (x < 0) x += 360;
  return x;
}
