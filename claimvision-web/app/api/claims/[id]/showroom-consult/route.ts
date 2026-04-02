import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db/connect';
import Claim from '@/models/Claim';
import Car from '@/models/Car';
import User from '@/models/User';
import { successResponse, handleApiError, requireAuth, errorResponse } from '@/lib/api/response';
import { buildShowroomWebhookPayload } from '@/lib/showroom/webhookPayload';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: RouteContext) {
  try {
    const sessionUser = await requireAuth();
    const { id } = await params;
    const webhookUrl = process.env.SHOWROOM_CONSULT_WEBHOOK_URL;

    if (!webhookUrl?.trim()) {
      return errorResponse(
        'Showroom consult webhook URL is not configured (SHOWROOM_CONSULT_WEBHOOK_URL)',
        'NOT_CONFIGURED',
        503
      );
    }

    await connectDB();

    const claim = await Claim.findOne({ _id: id, userId: sessionUser.id }).lean();
    if (!claim) return errorResponse('Claim not found', 'NOT_FOUND', 404);

    if (claim.status !== 'completed' || !claim.llmResponse || !claim.cvResponse) {
      return errorResponse('Claim analysis must be completed first', 'INCOMPLETE', 422);
    }

    const car = await Car.findById(claim.carId).select('brand model year').lean();
    if (!car) return errorResponse('Vehicle not found for this claim', 'CAR_NOT_FOUND', 404);

    const userDoc = await User.findById(sessionUser.id).select('name email phone').lean();
    if (!userDoc) return errorResponse('User not found', 'NOT_FOUND', 404);

    const payload = buildShowroomWebhookPayload({
      name: userDoc.name,
      email: userDoc.email,
      phone: userDoc.phone,
      brand: car.brand,
      model: car.model,
      year: car.year,
      totalEstimatedMin: claim.llmResponse.totalEstimatedMin,
      totalEstimatedMax: claim.llmResponse.totalEstimatedMax,
      urgency: claim.llmResponse.urgency,
      cvResponse: claim.cvResponse,
    });

    const res = await fetch(webhookUrl.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return errorResponse(
        `Showroom service returned ${res.status}${body ? `: ${body.slice(0, 200)}` : ''}`,
        'WEBHOOK_FAILED',
        502
      );
    }

    return successResponse({ sent: true });
  } catch (err) {
    return handleApiError(err);
  }
}
