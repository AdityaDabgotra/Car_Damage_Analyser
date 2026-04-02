import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/db/connect';
import User from '@/models/User';
import { RegisterSchema } from '@/lib/validators/schemas';
import { successResponse, handleApiError, errorResponse } from '@/lib/api/response';
import { rateLimit } from '@/lib/api/rateLimit';

const limiter = rateLimit({ windowMs: 15 * 60_000, max: 10 }); // 10 registrations per 15min

export async function POST(req: NextRequest) {
  const limited = limiter(req);
  if (limited) return limited;

  try {
    const body = await req.json();
    const parsed = RegisterSchema.parse(body);

    await connectDB();

    const exists = await User.findOne({ email: parsed.email });
    if (exists) return errorResponse('An account with this email already exists', 'EMAIL_TAKEN', 409);

    const hashed = await bcrypt.hash(parsed.password, 12);

    const user = await User.create({
      name: parsed.name,
      email: parsed.email,
      password: hashed,
      provider: 'credentials',
    });

    return successResponse(
      { id: user._id.toString(), name: user.name, email: user.email },
      201
    );
  } catch (err) {
    return handleApiError(err);
  }
}
