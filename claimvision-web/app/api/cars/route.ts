import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db/connect';
import Car from '@/models/Car';
import { CarSchema } from '@/lib/validators/schemas';
import { successResponse, handleApiError, requireAuth } from '@/lib/api/response';

export async function GET() {
  try {
    const user = await requireAuth();
    await connectDB();

    const cars = await Car.find({ userId: user.id })
      .sort({ createdAt: -1 })
      .lean();

    return successResponse(cars);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const parsed = CarSchema.parse(body);

    await connectDB();

    const car = await Car.create({ ...parsed, userId: user.id });
    return successResponse(car, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
