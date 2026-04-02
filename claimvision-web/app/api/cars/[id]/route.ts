import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db/connect';
import Car from '@/models/Car';
import { CarSchema } from '@/lib/validators/schemas';
import { successResponse, handleApiError, requireAuth, errorResponse } from '@/lib/api/response';

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await req.json();
    const parsed = CarSchema.parse(body);

    await connectDB();

    const car = await Car.findOneAndUpdate(
      { _id: id, userId: user.id },
      parsed,
      { new: true, runValidators: true }
    );

    if (!car) return errorResponse('Car not found', 'NOT_FOUND', 404);
    return successResponse(car);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_: NextRequest, { params }: RouteContext) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    await connectDB();

    const car = await Car.findOneAndDelete({ _id: id, userId: user.id });
    if (!car) return errorResponse('Car not found', 'NOT_FOUND', 404);

    return successResponse({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
