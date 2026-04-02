import { z } from 'zod';

// ── Auth ─────────────────────────────────────────────────────────────────────

export const RegisterSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address').toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const LoginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

/** Post-login phone capture — digits, spaces, + - ( ) allowed; normalized server-side. */
export const PhoneSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(8, 'Enter a valid phone number')
    .max(20, 'Phone number is too long')
    .regex(/^[\d\s+().-]+$/, 'Use only digits and common phone symbols'),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

// ── Car ──────────────────────────────────────────────────────────────────────

const currentYear = new Date().getFullYear();

export const CarSchema = z.object({
  brand: z.string().min(1, 'Brand is required').max(50).trim(),
  model: z.string().min(1, 'Model is required').max(50).trim(),
  year: z
    .number()
    .int()
    .min(1900, 'Year too old')
    .max(currentYear + 1, 'Year cannot be in the future'),
  licensePlate: z.string().max(20).optional(),
  color: z.string().max(30).optional(),
  vin: z
    .string()
    .length(17, 'VIN must be exactly 17 characters')
    .toUpperCase()
    .optional()
    .or(z.literal('')),
});

export type CarInput = z.infer<typeof CarSchema>;

// ── Upload ────────────────────────────────────────────────────────────────────

export const VideoUploadSchema = z.object({
  carId: z.string().min(1, 'Car selection required'),
  videoUrl: z.string().url('Invalid video URL'),
  videoPublicId: z.string().min(1, 'Missing public ID'),
  videoDuration: z.number().max(30, 'Video must be 30 seconds or less').optional(),
});

export type VideoUploadInput = z.infer<typeof VideoUploadSchema>;

// ── API Responses (CV) ───────────────────────────────────────────────────────

/** Fixed vehicle regions returned by the CV API (keys in the response object). */
export const CV_EXPECTED_PARTS = [
  'front_bumper',
  'rear_bumper',
  'hood',
  'trunk',
  'roof',
  'windshield',
  'rear_window',
  'left_front_fender',
  'right_front_fender',
  'left_rear_quarter_panel',
  'right_rear_quarter_panel',
  'left_front_door',
  'right_front_door',
  'left_rear_door',
  'right_rear_door',
  'headlights',
  'taillights',
  'grille',
] as const;

export type CVPartKey = (typeof CV_EXPECTED_PARTS)[number];

/** Per-part assessment strings from the CV service (match API casing). */
export const CVPartAssessmentSchema = z.enum(['Replacement', 'No Damage', 'repair']);

export type CVPartAssessment = z.infer<typeof CVPartAssessmentSchema>;

const cvPartsRecord = Object.fromEntries(
  CV_EXPECTED_PARTS.map((key) => [key, CVPartAssessmentSchema])
) as Record<CVPartKey, typeof CVPartAssessmentSchema>;

export const CVResponseSchema = z
  .object(cvPartsRecord)
  .and(
    z.object({
      analysisId: z.string().optional(),
      processedAt: z.string().optional(),
      framesCaptured: z.number().optional(),
    })
  );

/** LLMs emit "replacement" or Title Case; normalize to Mongoose enum. */
const LlmRecommendationActionSchema = z
  .string()
  .transform((s) => s.trim().toLowerCase())
  .transform((s) => (s === 'replacement' ? 'replace' : s))
  .pipe(z.enum(['repair', 'replace', 'monitor']));

export const LlmRecommendationRowSchema = z.object({
  part: z.string(),
  action: LlmRecommendationActionSchema,
  reason: z.string(),
  estimatedCost: z.object({
    min: z.number(),
    max: z.number(),
    currency: z.string().default('INR'),
  }).optional(),
});

/** Chunked LLM calls return only the recommendations array (see lib/ai/llmService.ts). */
export const LLMChunkResponseSchema = z.object({
  recommendations: z.array(LlmRecommendationRowSchema),
});

export const LLMResponseSchema = z.object({
  recommendations: z.array(LlmRecommendationRowSchema),
  estimatedCostRange: z.string(),
  summary: z.string(),
  urgency: z.enum(['low', 'medium', 'high', 'critical']),
  totalEstimatedMin: z.number().optional(),
  totalEstimatedMax: z.number().optional(),
});

export type CVResponseType = z.infer<typeof CVResponseSchema>;
export type LLMResponseType = z.infer<typeof LLMResponseSchema>;
