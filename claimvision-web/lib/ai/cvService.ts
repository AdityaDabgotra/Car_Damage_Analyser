import { CV_EXPECTED_PARTS, CVResponseSchema, CVResponseType } from '@/lib/validators/schemas';
import { logger } from '@/lib/logger';
import { normalizeCvApiResponse } from '@/lib/ai/cvApiNormalize';

/** Base URL of the CV service (e.g. FastAPI), e.g. http://127.0.0.1:8000/analyze */
const CV_API_URL = process.env.CV_API_URL!;
const MAX_RETRIES = 3;
/** Video analysis can be slow; override with CV_API_TIMEOUT_MS (ms). */
const TIMEOUT_MS = (() => {
  const n = Number(process.env.CV_API_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : 90_000;
})();

interface CVServiceOptions {
  retries?: number;
}

/**
 * Circuit breaker state (in-memory; use Redis for distributed)
 */
let circuitOpen = false;
let circuitOpenedAt = 0;
const CIRCUIT_TIMEOUT_MS = 60_000;

function checkCircuit(): void {
  if (circuitOpen && Date.now() - circuitOpenedAt > CIRCUIT_TIMEOUT_MS) {
    circuitOpen = false; // half-open → attempt
    logger.info('[CVService] Circuit breaker: half-open, attempting request');
  }
  if (circuitOpen) throw new Error('CV API circuit breaker is open. Retry later.');
}

function tripCircuit(): void {
  circuitOpen = true;
  circuitOpenedAt = Date.now();
  logger.error('[CVService] Circuit breaker tripped');
}

async function fetchWithTimeout(url: string, options: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * FastAPI expects snake_case query names by default (`video_url`), not `videoUrl`.
 * `searchParams` encodes the value (Cloudinary URLs stay valid).
 */
function buildCvAnalyzeUrl(videoUrl: string): string {
  const u = new URL(CV_API_URL.trim());
  u.searchParams.set('video_url', videoUrl);
  return u.toString();
}

/**
 * GET `{CV_API_URL}?video_url=<encoded url>` — no API key.
 * Expects JSON per-part map (flat or under `data` / `result`). See `normalizeCvApiResponse`.
 */
export async function analyzeVideo(
  videoUrl: string,
  options: CVServiceOptions = {}
): Promise<CVResponseType> {
  const retries = options.retries ?? MAX_RETRIES;
  checkCircuit();

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const requestUrl = buildCvAnalyzeUrl(videoUrl);
      logger.info(`[CVService] Attempt ${attempt}/${retries} → GET ${CV_API_URL}`);

      const response = await fetchWithTimeout(
        requestUrl,
        { method: 'GET' },
        TIMEOUT_MS
      );

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`CV API error ${response.status}: ${body}`);
      }

      const raw = await response.json();
      const normalized = normalizeCvApiResponse(raw);
      const parsed = CVResponseSchema.safeParse(normalized);

      if (!parsed.success) {
        logger.error('[CVService] Invalid response schema', parsed.error.flatten());
        throw new Error('CV API returned unexpected response shape');
      }

      const affected = CV_EXPECTED_PARTS.filter((k) => parsed.data[k] !== 'No Damage').length;
      logger.info(`[CVService] Success: ${affected} parts with damage`);
      return parsed.data;
    } catch (err: any) {
      logger.warn(`[CVService] Attempt ${attempt} failed: ${err.message}`);

      if (attempt === retries) {
        // On final failure, trip circuit
        tripCircuit();
        throw new Error(`CV analysis failed after ${retries} attempts: ${err.message}`);
      }

      // Exponential backoff
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    }
  }

  throw new Error('Unreachable');
}
