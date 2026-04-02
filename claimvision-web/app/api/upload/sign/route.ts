import { NextRequest } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { successResponse, handleApiError, requireAuth } from '@/lib/api/response';
import { rateLimit } from '@/lib/api/rateLimit';
import { CLOUDINARY_VIDEO_INCOMING_TRANSFORMATION } from '@/lib/video/cloudinaryUpload';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

const limiter = rateLimit({ windowMs: 60_000, max: 5 }); // 5 uploads/min per IP

export async function POST(req: NextRequest) {
  const limited = limiter(req);
  if (limited) return limited;

  try {
    await requireAuth();

    const timestamp = Math.round(Date.now() / 1000);
    const folder = 'claimvision/videos';

    const paramsToSign = {
      eager: 'vc_auto/du_30',
      folder,
      timestamp,
      /** Downscale high-res uploads to ~360p before storage (signed + must match upload form). */
      transformation: CLOUDINARY_VIDEO_INCOMING_TRANSFORMATION,
    };

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET!
    );

    return successResponse({
      signature,
      timestamp,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      folder,
      eager: paramsToSign.eager,
      transformation: paramsToSign.transformation,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
