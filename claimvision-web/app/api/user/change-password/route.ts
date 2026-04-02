import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/db/connect';
import User from '@/models/User';
import { ChangePasswordSchema } from '@/lib/validators/schemas';
import { successResponse, handleApiError, requireAuth, errorResponse } from '@/lib/api/response';

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await requireAuth();
    const body = await req.json();
    const parsed = ChangePasswordSchema.parse(body);

    await connectDB();

    const user = await User.findById(sessionUser.id).select('+password');
    if (!user) return errorResponse('User not found', 'NOT_FOUND', 404);
    if (user.provider !== 'credentials') {
      return errorResponse(
        'Password change is only available for email/password accounts',
        'OAUTH_ACCOUNT',
        403
      );
    }
    if (!user.password) return errorResponse('Invalid account state', 'INVALID_STATE', 500);

    const valid = await bcrypt.compare(parsed.currentPassword, user.password);
    if (!valid) return errorResponse('Current password is incorrect', 'INVALID_PASSWORD', 401);

    user.password = await bcrypt.hash(parsed.newPassword, 12);
    await user.save();

    return successResponse({ message: 'Password updated successfully' });
  } catch (err) {
    return handleApiError(err);
  }
}
