import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db/connect';
import User from '@/models/User';
import { PhoneSchema } from '@/lib/validators/schemas';
import { successResponse, handleApiError, requireAuth, errorResponse } from '@/lib/api/response';

function normalizePhone(input: string): string {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 8) return '';
  return trimmed.startsWith('+') ? `+${digits}` : digits;
}

export async function PATCH(req: NextRequest) {
  try {
    const sessionUser = await requireAuth();
    const body = await req.json();
    const parsed = PhoneSchema.parse(body);
    const normalized = normalizePhone(parsed.phone);
    if (!normalized) {
      return errorResponse('Enter a valid phone number with at least 8 digits', 'INVALID_PHONE', 422);
    }

    await connectDB();
    const user = await User.findById(sessionUser.id);
    if (!user) return errorResponse('User not found', 'NOT_FOUND', 404);

    user.phone = normalized;
    await user.save();

    return successResponse({ phone: normalized });
  } catch (err) {
    return handleApiError(err);
  }
}
