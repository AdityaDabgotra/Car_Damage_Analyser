import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { logger } from '@/lib/logger';

export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiError {
  success: false;
  error: {
    message: string;
    code: string;
    details?: unknown;
  };
}

export function successResponse<T>(data: T, status = 200, meta?: Record<string, unknown>) {
  return NextResponse.json({ success: true, data, ...(meta && { meta }) } satisfies ApiSuccess<T>, { status });
}

export function errorResponse(message: string, code: string, status = 400, details?: unknown) {
  const error: ApiError['error'] = details === undefined ? { message, code } : { message, code, details };
  return NextResponse.json(
    { success: false, error } satisfies ApiError,
    { status }
  );
}

export function handleApiError(err: unknown): NextResponse {
  if (err instanceof ZodError) {
    return errorResponse('Validation failed', 'VALIDATION_ERROR', 422, err.flatten());
  }

  if (err instanceof Error) {
    logger.error('[API Error]', err.message);

    if (err.message.includes('Unauthorized') || err.message.includes('sign in')) {
      return errorResponse(err.message, 'UNAUTHORIZED', 401);
    }
    if (err.message.includes('not found')) {
      return errorResponse(err.message, 'NOT_FOUND', 404);
    }

    return errorResponse(err.message, 'INTERNAL_ERROR', 500);
  }

  logger.error('[API Unknown Error]', err);
  return errorResponse('An unexpected error occurred', 'INTERNAL_ERROR', 500);
}

// Auth guard for API routes
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import User from '@/models/User';
import { connectDB } from '@/lib/db/connect';

export async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error('Unauthorized: please sign in');

  await connectDB();

  const sessionUser = session.user as { id?: unknown; email?: string | null; name?: string | null; role?: unknown };
  const idCandidate = sessionUser.id;

  const isValidObjectId = (value: unknown): value is string =>
    typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);

  // If the session already contains our Mongo user id, use it.
  if (isValidObjectId(idCandidate)) {
    return {
      id: idCandidate,
      email: sessionUser.email ?? '',
      name: sessionUser.name ?? '',
      role: typeof sessionUser.role === 'string' ? sessionUser.role : 'user',
    };
  }

  // Otherwise resolve to our DB user id (OAuth sessions can have provider ids here).
  if (sessionUser.email) {
    const dbUser = await User.findOne({ email: sessionUser.email.toLowerCase() }).select('_id role email name').lean();
    if (dbUser?._id) {
      return {
        id: dbUser._id.toString(),
        email: dbUser.email,
        name: dbUser.name,
        role: dbUser.role,
      };
    }
  }

  if (typeof idCandidate === 'string' && idCandidate) {
    const dbUser = await User.findOne({ providerId: idCandidate }).select('_id role email name').lean();
    if (dbUser?._id) {
      return {
        id: dbUser._id.toString(),
        email: dbUser.email,
        name: dbUser.name,
        role: dbUser.role,
      };
    }
  }

  throw new Error('Unauthorized: please sign in');
}
