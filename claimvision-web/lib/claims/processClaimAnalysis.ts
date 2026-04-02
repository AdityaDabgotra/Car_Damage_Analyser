import mongoose from 'mongoose';
import { connectDB } from '@/lib/db/connect';
import Claim from '@/models/Claim';
import Car from '@/models/Car';
import { analyzeVideo } from '@/lib/ai/cvService';
import { generateRecommendations } from '@/lib/ai/llmService';
import { logger } from '@/lib/logger';
import type { CVResponseType, LLMResponseType } from '@/lib/validators/schemas';

const inFlight = new Set<string>();


export async function runClaimAnalysis(claimId: string): Promise<void> {
  try {
    await connectDB();

    const claim = await Claim.findById(claimId);
    if (!claim) {
      logger.warn(`[ClaimAnalysis] Claim ${claimId} not found`);
      return;
    }

    claim.status = 'processing';
    claim.attemptCount += 1;
    await claim.save();

    const cvResponse: CVResponseType = await analyzeVideo(claim.videoUrl);
    claim.cvResponse = cvResponse;
    await claim.save();

    const car = await Car.findById(claim.carId);
    if (!car) throw new Error(`Car ${claim.carId} not found`);

    const llmResponse: LLMResponseType = await generateRecommendations(cvResponse, {
      brand: car.brand,
      model: car.model,
      year: car.year,
    });

    const oid = new mongoose.Types.ObjectId(claimId);
    const updated = await Claim.findOneAndUpdate(
      { _id: oid, status: 'processing' },
      {
        $set: {
          cvResponse,
          llmResponse,
          status: 'completed',
          completedAt: new Date(),
        },
        $unset: { errorMessage: 1 },
      },
      { new: true }
    );

    if (!updated) {
      logger.warn(
        `[ClaimAnalysis] Claim ${claimId}: could not mark completed (not in processing — may already be finished)`
      );
      return;
    }

    logger.info(`[ClaimAnalysis] Claim ${claimId} completed`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error(`[ClaimAnalysis] Claim ${claimId} failed: ${message}`);

    try {
      await connectDB();
      const oid = new mongoose.Types.ObjectId(claimId);
      const res = await Claim.findOneAndUpdate(
        { _id: oid, status: 'processing' },
        { $set: { status: 'failed', errorMessage: message } }
      );
      if (!res) {
        logger.warn(
          `[ClaimAnalysis] Claim ${claimId}: failure not persisted (not in processing — likely completed by another run)`
        );
      }
    } catch (persistErr) {
      logger.error('[ClaimAnalysis] Failed to persist error state', persistErr);
    }
  }
}

/**
 * Starts analysis without blocking the HTTP response. Returns a stable id for the UI (replaces BullMQ job id).
 */
export function enqueueClaimAnalysis(claimId: string): string {
  const jobId = `local-${claimId}`;

  if (inFlight.has(claimId)) {
    return jobId;
  }

  inFlight.add(claimId);
  void runClaimAnalysis(claimId).finally(() => {
    inFlight.delete(claimId);
  });

  return jobId;
}
