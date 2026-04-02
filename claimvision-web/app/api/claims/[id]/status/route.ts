import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db/connect';
import Claim from '@/models/Claim';
import { successResponse, handleApiError, requireAuth, errorResponse } from '@/lib/api/response';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, { params }: RouteContext) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    await connectDB();

    const claim = await Claim.findOne(
      { _id: id, userId: user.id },
      { status: 1, errorMessage: 1, completedAt: 1, attemptCount: 1, jobId: 1 }
    ).lean();

    if (!claim) return errorResponse('Claim not found', 'NOT_FOUND', 404);

    return successResponse({
      status: claim.status,
      errorMessage: claim.errorMessage,
      completedAt: claim.completedAt,
      attemptCount: claim.attemptCount,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
