import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db/connect';
import Claim from '@/models/Claim';
import { successResponse, handleApiError, requireAuth, errorResponse } from '@/lib/api/response';
import { enqueueClaimAnalysis } from '@/lib/claims/processClaimAnalysis';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, { params }: RouteContext) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    await connectDB();

    const claim = await Claim.findOne({ _id: id, userId: user.id })
      .populate('carId', 'brand model year color licensePlate')
      .lean();

    if (!claim) return errorResponse('Claim not found', 'NOT_FOUND', 404);
    return successResponse(claim);
  } catch (err) {
    return handleApiError(err);
  }
}

// Re-run analysis for a failed claim
export async function POST(_: NextRequest, { params }: RouteContext) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    await connectDB();

    const claim = await Claim.findOne({ _id: id, userId: user.id });
    if (!claim) return errorResponse('Claim not found', 'NOT_FOUND', 404);

    if (claim.status === 'processing') {
      return errorResponse('Claim is already being processed', 'CONFLICT', 409);
    }

    if (claim.attemptCount >= 5) {
      return errorResponse('Maximum retry attempts reached', 'MAX_RETRIES', 422);
    }

    // Reset and re-queue
    claim.status = 'queued';
    claim.errorMessage = undefined;
    claim.cvResponse = undefined;
    claim.llmResponse = undefined;
    await claim.save();

    const jobId = enqueueClaimAnalysis(claim._id.toString());
    claim.jobId = jobId;
    await claim.save();

    return successResponse({ claimId: claim._id.toString(), jobId, status: 'queued' });
  } catch (err) {
    return handleApiError(err);
  }
}
