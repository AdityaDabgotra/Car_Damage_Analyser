import type { CVResponse } from '@/models/Claim';
import { CV_EXPECTED_PARTS } from '@/lib/validators/schemas';

export interface ShowroomWebhookBody {
  name: string;
  email: string;
  phone: string;
  totalEstimatedMin: number;
  totalEstimatedMax: number;
  urgency: string;
  brand: string;
  model: string;
  year: number;
  cvResponse: Record<string, string>;
}

export function buildShowroomWebhookPayload(input: {
  name: string;
  email: string;
  phone: string | undefined;
  brand: string;
  model: string;
  year: number;
  totalEstimatedMin?: number;
  totalEstimatedMax?: number;
  urgency: string;
  cvResponse: CVResponse | undefined;
}): ShowroomWebhookBody {
  const cvResponse: Record<string, string> = {};
  if (input.cvResponse) {
    for (const key of CV_EXPECTED_PARTS) {
      const v = input.cvResponse[key as keyof CVResponse];
      if (typeof v === 'string') cvResponse[key] = v;
    }
  }

  return {
    name: input.name,
    email: input.email,
    phone: input.phone?.trim() ?? '',
    totalEstimatedMin: input.totalEstimatedMin ?? 0,
    totalEstimatedMax: input.totalEstimatedMax ?? 0,
    urgency: input.urgency,
    brand: input.brand,
    model: input.model,
    year: input.year,
    cvResponse,
  };
}
