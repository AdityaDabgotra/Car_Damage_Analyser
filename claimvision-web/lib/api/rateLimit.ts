import { NextRequest } from 'next/server';
import { errorResponse } from '@/lib/api/response';

// Simple in-memory rate limiter (replace with Redis for distributed)
const rateMap = new Map<string, { count: number; resetAt: number }>();

interface RateLimitOptions {
  windowMs?: number;  // default 60s
  max?: number;       // requests per window
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'anonymous'
  );
}

export function rateLimit(options: RateLimitOptions = {}) {
  const windowMs = options.windowMs ?? 60_000;
  const max = options.max ?? 60;

  return function checkRateLimit(req: NextRequest): ReturnType<typeof errorResponse> | null {
    const key = getClientIp(req);
    const now = Date.now();
    const entry = rateMap.get(key);

    if (!entry || entry.resetAt < now) {
      rateMap.set(key, { count: 1, resetAt: now + windowMs });
      return null;
    }

    entry.count++;
    if (entry.count > max) {
      return errorResponse('Too many requests. Please try again later.', 'RATE_LIMIT_EXCEEDED', 429);
    }

    return null;
  };
}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateMap.entries()) {
    if (entry.resetAt < now) rateMap.delete(key);
  }
}, 60_000);
