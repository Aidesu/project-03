/** Shared geometry for the circular XP-progress ring (dashboard + progression). */
export const RING_RADIUS = 54;
export const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/** `stroke-dashoffset` for a ring filled to `pct` (0–100) of `circumference`. */
export function ringOffset(pct: number, circumference: number): number {
  return circumference - (pct / 100) * circumference;
}
