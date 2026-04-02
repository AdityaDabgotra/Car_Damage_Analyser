import type { DefaultSession, DefaultUser } from 'next-auth';
import type { DefaultJWT } from 'next-auth/jwt';
import type { CVResponseType } from '@/lib/validators/schemas';

// Extend NextAuth session types
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: 'user' | 'admin';
      provider?: string;
      /** True when a phone number is stored (post-login onboarding complete). */
      phoneComplete: boolean;
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    role?: 'user' | 'admin';
    provider?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string;
    role: 'user' | 'admin';
    phoneComplete?: boolean;
  }
}

// ── Shared API types ─────────────────────────────────────────────────────────

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
  meta?: { pagination?: PaginationMeta } & Record<string, unknown>;
}

export interface ApiError {
  success: false;
  error: {
    message: string;
    code: string;
    details?: unknown;
  };
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;

// ── Domain types (client-safe — no mongoose) ─────────────────────────────────

export interface CarDTO {
  _id: string;
  brand: string;
  model: string;
  year: number;
  licensePlate?: string;
  color?: string;
  vin?: string;
  createdAt: string;
}

export interface RecommendationDTO {
  part: string;
  action: 'repair' | 'replace' | 'monitor';
  reason: string;
  estimatedCost?: { min: number; max: number; currency: string };
}

export interface ClaimDTO {
  _id: string;
  userId: string;
  carId: CarDTO | string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  videoUrl: string;
  videoPublicId: string;
  videoDuration?: number;
  cvResponse?: CVResponseType;
  llmResponse?: {
    recommendations: RecommendationDTO[];
    estimatedCostRange: string;
    summary: string;
    urgency: 'low' | 'medium' | 'high' | 'critical';
    totalEstimatedMin?: number;
    totalEstimatedMax?: number;
  };
  errorMessage?: string;
  attemptCount: number;
  jobId?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}
