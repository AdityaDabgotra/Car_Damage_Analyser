import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db/connect';
import Claim from '@/models/Claim';
import Car from '@/models/Car';
import { VideoUploadSchema } from '@/lib/validators/schemas';
import { successResponse, handleApiError, requireAuth, errorResponse } from '@/lib/api/response';
import { enqueueClaimAnalysis } from '@/lib/claims/processClaimAnalysis';
import { parseLimitParam, parsePageParam } from '@/lib/pagination';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    await connectDB();

    const { searchParams } = new URL(req.url);
    const page = parsePageParam(searchParams.get('page'), 1);
    const limit = parseLimitParam(searchParams.get('limit'), 10, 50);
    const skip = (page - 1) * limit;

    const [claims, total] = await Promise.all([
      Claim.find({ userId: user.id })
        .populate('carId', 'brand model year')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Claim.countDocuments({ userId: user.id }),
    ]);

    return successResponse(claims, 200, {
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const parsed = VideoUploadSchema.parse(body);

    await connectDB();

    // Verify car belongs to user
    const car = await Car.findOne({ _id: parsed.carId, userId: user.id });
    if (!car) return errorResponse('Car not found or access denied', 'NOT_FOUND', 404);

    const claim = await Claim.create({
      userId: user.id,
      carId: parsed.carId,
      videoUrl: parsed.videoUrl,
      videoPublicId: parsed.videoPublicId,
      videoDuration: parsed.videoDuration,
      status: 'queued',
    });

    // Enqueue async AI processing
    const jobId = enqueueClaimAnalysis(claim._id.toString());
    claim.jobId = jobId;
    await claim.save();

    return successResponse({ claimId: claim._id.toString(), jobId, status: 'queued' }, 202);
  } catch (err) {
    return handleApiError(err);
  }
}
