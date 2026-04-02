import mongoose, { Document, Model, Schema } from 'mongoose';
import { CV_EXPECTED_PARTS, type CVPartAssessment } from '@/lib/validators/schemas';

export type ClaimStatus = 'queued' | 'processing' | 'completed' | 'failed';

/** CV payload: one assessment per fixed vehicle region. */
export type CVResponse = {
  [K in (typeof CV_EXPECTED_PARTS)[number]]: CVPartAssessment;
} & {
  analysisId?: string;
  processedAt?: string;
  framesCaptured?: number;
};

export interface RepairRecommendation {
  part: string;
  action: 'repair' | 'replace' | 'monitor';
  reason: string;
  estimatedCost?: { min: number; max: number; currency: string };
}

export interface LLMResponse {
  recommendations: RepairRecommendation[];
  estimatedCostRange: string;
  summary: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  totalEstimatedMin?: number;
  totalEstimatedMax?: number;
}

export interface IClaim extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  carId: mongoose.Types.ObjectId;
  status: ClaimStatus;
  videoUrl: string;
  videoPublicId: string;
  videoDuration?: number;
  cvResponse?: CVResponse;
  llmResponse?: LLMResponse;
  errorMessage?: string;
  jobId?: string;
  attemptCount: number;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CV_ASSESSMENT_ENUM: CVPartAssessment[] = ['Replacement', 'No Damage', 'repair'];

const cvResponseFields = Object.fromEntries(
  CV_EXPECTED_PARTS.map((part) => [
    part,
    { type: String, enum: CV_ASSESSMENT_ENUM, required: true },
  ])
) as Record<string, { type: typeof String; enum: CVPartAssessment[]; required: boolean }>;

const CVResponseMongooseSchema = new Schema<CVResponse>(
  {
    ...cvResponseFields,
    analysisId: { type: String },
    processedAt: { type: String },
    framesCaptured: { type: Number },
  },
  { _id: false }
);

const RepairRecommendationSchema = new Schema<RepairRecommendation>(
  {
    part: { type: String, required: true },
    action: { type: String, enum: ['repair', 'replace', 'monitor'], required: true },
    reason: { type: String, required: true },
    estimatedCost: {
      min: Number,
      max: Number,
      currency: { type: String, default: 'INR' },
    },
  },
  { _id: false }
);

const LLMResponseSchema = new Schema<LLMResponse>(
  {
    recommendations: [RepairRecommendationSchema],
    estimatedCostRange: { type: String },
    summary: { type: String },
    urgency: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
    totalEstimatedMin: { type: Number },
    totalEstimatedMax: { type: Number },
  },
  { _id: false }
);

const ClaimSchema = new Schema<IClaim>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    carId: { type: Schema.Types.ObjectId, ref: 'Car', required: true, index: true },
    status: {
      type: String,
      enum: ['queued', 'processing', 'completed', 'failed'],
      default: 'queued',
      index: true,
    },
    videoUrl: { type: String, required: true },
    videoPublicId: { type: String, required: true },
    videoDuration: { type: Number },
    cvResponse: CVResponseMongooseSchema,
    llmResponse: LLMResponseSchema,
    errorMessage: { type: String },
    jobId: { type: String, index: true },
    attemptCount: { type: Number, default: 0 },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

// Compound indexes
ClaimSchema.index({ userId: 1, createdAt: -1 });
ClaimSchema.index({ status: 1, createdAt: -1 });
ClaimSchema.index({ carId: 1, status: 1 });

const Claim: Model<IClaim> = mongoose.models.Claim || mongoose.model<IClaim>('Claim', ClaimSchema);
export default Claim;
