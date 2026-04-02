/** Safe query parsing — avoids NaN in skip/limit when params are not numeric. */

export function parsePageParam(raw: string | null, fallback: number): number {
  const n = parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function parseLimitParam(raw: string | null, fallback: number, max: number): number {
  const n = parseInt(raw ?? '', 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(max, n);
}
