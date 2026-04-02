import OpenAI from 'openai';
import type { ChatCompletion, ChatCompletionChunk } from 'openai/resources/chat/completions';
import { jsonrepair } from 'jsonrepair';
import {
  CV_EXPECTED_PARTS,
  CVResponseType,
  LLMChunkResponseSchema,
  LLMResponseSchema,
  LLMResponseType,
} from '@/lib/validators/schemas';
import { formatInrRange } from '@/lib/currency/inr';
import { logger } from '@/lib/logger';

type MessageContent = ChatCompletion.Choice['message']['content'];

/** Exa OpenAI-compatible API — https://docs.exa.ai/reference/openai-sdk */
const EXA_BASE_URL = 'https://api.exa.ai';
const EXA_LLM_MODEL = process.env.EXA_LLM_MODEL ?? 'exa';

/** Exa often caps output around ~2–3k chars; split large damage lists across calls. */
const MAX_PARTS_PER_LLM_CALL = 6;

function createExaClient(): OpenAI {
  const apiKey = process.env.EXA_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error('EXA_API_KEY is required for claim LLM recommendations (Exa AI).');
  }
  return new OpenAI({
    baseURL: EXA_BASE_URL,
    apiKey,
    timeout: Number(process.env.EXA_TIMEOUT_MS) > 0 ? Number(process.env.EXA_TIMEOUT_MS) : 600_000,
  });
}

const MAX_RETRIES = 3;

const DEFAULT_MAX_TOKENS = 8192;
const EXPANDED_MAX_TOKENS = 32_768;
const CHUNK_MAX_TOKENS = 8192;

/** First complete `{...}` by brace depth (avoids broken slices from nested `}`). */
function extractFirstJsonObject(raw: string): string | null {
  const start = raw.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < raw.length; i++) {
    const c = raw[i]!;
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (c === '\\') escape = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }
  return null;
}

function looksLikeTruncatedJson(raw: string, hitLengthLimit: boolean): boolean {
  if (hitLengthLimit) return true;
  const s = raw.trim();
  if (!s.includes('{')) return false;
  try {
    parseJsonFromLlm(s);
    return false;
  } catch {
    return extractFirstJsonObject(s) === null;
  }
}

function parseJsonFromLlm(raw: string): unknown {
  let s = raw.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(s);
  if (fenced) s = fenced[1]!.trim();

  const tryParse = (input: string) => JSON.parse(input);

  try {
    return tryParse(s);
  } catch {
    const extracted = extractFirstJsonObject(s);
    if (extracted) {
      try {
        return tryParse(extracted);
      } catch {
        try {
          return tryParse(jsonrepair(extracted));
        } catch {
          /* fall through */
        }
      }
    }
    try {
      return tryParse(jsonrepair(s));
    } catch {
      throw new Error('Invalid or truncated JSON');
    }
  }
}

function messageContentToString(content: MessageContent | unknown): string {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const parts = content as unknown[];
    return parts
      .map((part: unknown) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part && typeof (part as { text: string }).text === 'string') {
          return (part as { text: string }).text;
        }
        return '';
      })
      .join('');
  }
  return '';
}

async function collectStreamingContent(
  client: OpenAI,
  payload: OpenAI.Chat.ChatCompletionCreateParams
): Promise<{ text: string; hitLengthLimit: boolean }> {
  const streamPayload = { ...payload, stream: true as const };
  const stream = await client.chat.completions.create(streamPayload);

  let text = '';
  let hitLengthLimit = false;
  for await (const chunk of stream as AsyncIterable<ChatCompletionChunk>) {
    const choice = chunk.choices[0];
    if (!choice) continue;
    if (choice.finish_reason === 'length') hitLengthLimit = true;
    const delta = choice.delta;
    if (delta?.content) {
      text += messageContentToString(delta.content as unknown);
    }
  }
  return { text: text.trim(), hitLengthLimit };
}

async function collectNonStreamingContent(
  client: OpenAI,
  payload: OpenAI.Chat.ChatCompletionCreateParams
): Promise<string> {
  const res = (await client.chat.completions.create({
    ...payload,
    stream: false,
  })) as ChatCompletion;

  const choice = res.choices[0];
  const raw = choice?.message ? messageContentToString(choice.message.content) : '';
  if (!raw && res.choices.length === 0) {
    logger.warn('[LLMService] Non-stream completion had no choices', {
      id: res.id,
      model: res.model,
    });
  }
  return raw.trim();
}

async function callExaForJsonText(
  client: OpenAI,
  base: Omit<OpenAI.Chat.ChatCompletionCreateParams, 'stream'>,
  maxTokens: number
): Promise<{ text: string; hitLengthLimit: boolean }> {
  const withExtra: OpenAI.Chat.ChatCompletionCreateParams = { ...base, max_tokens: maxTokens };
  if (EXA_LLM_MODEL === 'exa') {
    (withExtra as OpenAI.Chat.ChatCompletionCreateParams & { extra_body?: Record<string, unknown> }).extra_body = {
      text: true,
    };
  }

  let text = await collectNonStreamingContent(client, withExtra);
  if (text) {
    return { text, hitLengthLimit: false };
  }

  logger.info('[LLMService] Non-stream empty, using stream');
  return collectStreamingContent(client, withExtra);
}

interface CarContext {
  brand: string;
  model: string;
  year: number;
}

function pickDamagedCv(cv: CVResponseType): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of CV_EXPECTED_PARTS) {
    const v = cv[k];
    if (typeof v === 'string' && v !== 'No Damage') {
      out[k] = v;
    }
  }
  return out;
}

function inferUrgencyFromCv(cv: CVResponseType): 'low' | 'medium' | 'high' | 'critical' {
  let score = 0;
  for (const k of CV_EXPECTED_PARTS) {
    const v = cv[k];
    if (v === 'Replacement') score += 3;
    else if (v === 'repair') score += 1;
  }
  if (score >= 18) return 'critical';
  if (score >= 10) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
}

function buildAggregatesFromRecommendations(
  recommendations: LLMResponseType['recommendations'],
  cv: CVResponseType,
  car: CarContext
): Pick<LLMResponseType, 'estimatedCostRange' | 'summary' | 'urgency' | 'totalEstimatedMin' | 'totalEstimatedMax'> {
  let minSum = 0;
  let maxSum = 0;
  for (const r of recommendations) {
    if (r.estimatedCost) {
      minSum += r.estimatedCost.min;
      maxSum += r.estimatedCost.max;
    }
  }
  const n = recommendations.length;
  return {
    estimatedCostRange: formatInrRange(minSum, maxSum),
    summary: `Damage review for ${car.year} ${car.brand} ${car.model}: ${n} area(s) require repair or replacement per CV assessment. See per-part estimates below.`,
    urgency: inferUrgencyFromCv(cv),
    totalEstimatedMin: minSum,
    totalEstimatedMax: maxSum,
  };
}

function emptyLlmResponse(car: CarContext): LLMResponseType {
  const zero = formatInrRange(0, 0);
  return {
    recommendations: [],
    estimatedCostRange: zero,
    summary: `No body damage requiring repair or replacement was detected for ${car.year} ${car.brand} ${car.model} in the CV assessment.`,
    urgency: 'low',
    totalEstimatedMin: 0,
    totalEstimatedMax: 0,
  };
}

function buildFullPrompt(damaged: Record<string, string>, car: CarContext): string {
  const n = Object.keys(damaged).length;
  return `You are a senior automotive insurance adjuster.

## Vehicle
${car.year} ${car.brand} ${car.model}

## Damaged regions only (CV)
${JSON.stringify(damaged)}

## Task
Output EXACTLY ${n} objects in "recommendations" — one per region above (same "part" keys).
- action: exactly "repair", "replace", or "monitor" (use "replace" for full part swap, never the word "replacement")
- reason: max 40 characters per part
- estimatedCost: min and max as integers in INR per part
- estimatedCostRange: one line, INR only (e.g. ₹1,00,000 – ₹3,50,000)
- summary: max 160 characters
- urgency: one of low, medium, high, critical
- totalEstimatedMin / totalEstimatedMax: integers; should match the sum of per-part ranges approximately

Output valid JSON only — no markdown fences. End with closing }} for the root object.`;
}

function buildChunkPrompt(
  subset: Record<string, string>,
  car: CarContext,
  chunkIndex: number,
  chunkTotal: number
): string {
  const n = Object.keys(subset).length;
  return `You are a senior automotive insurance adjuster.

## Vehicle
${car.year} ${car.brand} ${car.model}

## CV regions (batch ${chunkIndex}/${chunkTotal}, ${n} part(s))
${JSON.stringify(subset)}

## Task
Output JSON with a single key "recommendations" containing EXACTLY ${n} objects — one per region above.
- part: use the snake_case key from the CV data
- action: "repair" | "replace" | "monitor"
- reason: max 35 characters
- estimatedCost: {"min": number, "max": number, "currency": "INR"}

No other top-level keys. Valid JSON only. Finish all brackets and strings.`;
}

function parseAndValidateLlmPayload(raw: string, hitLengthLimit: boolean): LLMResponseType {
  if (!raw) {
    logger.error('[LLMService] Empty content after stream and non-stream');
    throw new Error('Empty LLM response');
  }
  let json: unknown;
  try {
    json = parseJsonFromLlm(raw);
  } catch {
    logger.error('[LLMService] Non-JSON LLM output', {
      snippet: raw.slice(0, 800),
      length: raw.length,
      hitLengthLimit,
    });
    throw new Error('LLM response was not valid JSON');
  }
  const parsed = LLMResponseSchema.safeParse(json);
  if (!parsed.success) {
    logger.error('[LLMService] Invalid LLM response schema', parsed.error.flatten());
    throw new Error('LLM returned unexpected response shape');
  }
  return parsed.data;
}

function parseAndValidateChunkPayload(raw: string, hitLengthLimit: boolean) {
  if (!raw) {
    throw new Error('Empty LLM chunk response');
  }
  let json: unknown;
  try {
    json = parseJsonFromLlm(raw);
  } catch {
    logger.error('[LLMService] Chunk non-JSON', { snippet: raw.slice(0, 600), length: raw.length, hitLengthLimit });
    throw new Error('LLM chunk was not valid JSON');
  }
  const parsed = LLMChunkResponseSchema.safeParse(json);
  if (!parsed.success) {
    logger.error('[LLMService] Invalid chunk schema', parsed.error.flatten());
    throw new Error('LLM chunk had unexpected shape');
  }
  return parsed.data.recommendations;
}

async function fetchRecommendationChunk(
  client: OpenAI,
  subset: Record<string, string>,
  car: CarContext,
  chunkIndex: number,
  chunkTotal: number
): Promise<LLMResponseType['recommendations']> {
  const basePayload: Omit<OpenAI.Chat.ChatCompletionCreateParams, 'stream'> = {
    model: EXA_LLM_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You output one JSON object only. No markdown. Keep strings short. Close all braces.',
      },
      {
        role: 'user',
        content: buildChunkPrompt(subset, car, chunkIndex, chunkTotal),
      },
    ],
    temperature: 0.2,
  };

  let tokens = CHUNK_MAX_TOKENS;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    let tokens = CHUNK_MAX_TOKENS;
    try {
      for (let expandRound = 0; expandRound < 2; expandRound++) {
        logger.info(
          `[LLMService] Chunk ${chunkIndex}/${chunkTotal}, attempt ${attempt}, max_tokens=${tokens} (round ${expandRound})`
        );

        const { text: raw, hitLengthLimit } = await callExaForJsonText(client, basePayload, tokens);

        try {
          return parseAndValidateChunkPayload(raw, hitLengthLimit);
        } catch (parseErr) {
          const truncated = looksLikeTruncatedJson(raw || '', hitLengthLimit);
          if (expandRound === 0 && truncated && tokens < EXPANDED_MAX_TOKENS) {
            tokens = EXPANDED_MAX_TOKENS;
            logger.warn(`[LLMService] Chunk incomplete JSON; retrying with max_tokens=${tokens}`);
            continue;
          }
          throw parseErr;
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(`[LLMService] Chunk attempt ${attempt} failed: ${message}`);
      if (attempt === MAX_RETRIES) {
        throw new Error(`LLM chunk failed: ${message}`);
      }
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }

  throw new Error('Unreachable');
}

async function generateRecommendationsChunked(
  cv: CVResponseType,
  damaged: Record<string, string>,
  car: CarContext
): Promise<LLMResponseType> {
  const keys = Object.keys(damaged);
  const client = createExaClient();
  const chunks: string[][] = [];
  for (let i = 0; i < keys.length; i += MAX_PARTS_PER_LLM_CALL) {
    chunks.push(keys.slice(i, i + MAX_PARTS_PER_LLM_CALL));
  }

  const all: LLMResponseType['recommendations'] = [];
  let idx = 0;
  for (const keyChunk of chunks) {
    idx++;
    const subset = Object.fromEntries(keyChunk.map((k) => [k, damaged[k]]));
    const part = await fetchRecommendationChunk(client, subset, car, idx, chunks.length);
    all.push(...part);
  }

  const agg = buildAggregatesFromRecommendations(all, cv, car);
  return {
    recommendations: all,
    ...agg,
  };
}

export async function generateRecommendations(
  cvResponse: CVResponseType,
  car: CarContext
): Promise<LLMResponseType> {
  const damaged = pickDamagedCv(cvResponse);
  const damagedCount = Object.keys(damaged).length;

  if (damagedCount === 0) {
    return emptyLlmResponse(car);
  }

  if (damagedCount > MAX_PARTS_PER_LLM_CALL) {
    logger.info(
      `[LLMService] ${damagedCount} damaged parts → chunked LLM (${MAX_PARTS_PER_LLM_CALL} per call)`
    );
    return generateRecommendationsChunked(cvResponse, damaged, car);
  }

  const client = createExaClient();
  const envMax = Number(process.env.EXA_MAX_TOKENS);
  const initialMax =
    Number.isFinite(envMax) && envMax > 0 ? envMax : DEFAULT_MAX_TOKENS;

  const basePayload: Omit<OpenAI.Chat.ChatCompletionCreateParams, 'stream'> = {
    model: EXA_LLM_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You are an expert automotive insurance adjuster. Output one JSON object only — no markdown, no commentary. Finish every string and bracket.',
      },
      {
        role: 'user',
        content: buildFullPrompt(damaged, car),
      },
    ],
    temperature: 0.2,
  };

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      let tokens = initialMax;

      for (let expandRound = 0; expandRound < 2; expandRound++) {
        logger.info(
          `[LLMService] Exa chat (${EXA_LLM_MODEL}), attempt ${attempt}, max_tokens=${tokens} (round ${expandRound})`
        );

        const { text: raw, hitLengthLimit } = await callExaForJsonText(client, basePayload, tokens);

        try {
          const data = parseAndValidateLlmPayload(raw, hitLengthLimit);
          logger.info('[LLMService] Recommendations generated successfully');
          return data;
        } catch (parseErr) {
          const truncated = looksLikeTruncatedJson(raw || '', hitLengthLimit);
          if (expandRound === 0 && truncated && tokens < EXPANDED_MAX_TOKENS) {
            tokens = EXPANDED_MAX_TOKENS;
            logger.warn(
              '[LLMService] Incomplete JSON (likely token limit); retrying same attempt with max_tokens=' +
                String(tokens)
            );
            continue;
          }
          throw parseErr;
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(`[LLMService] Attempt ${attempt} failed: ${message}`);
      if (attempt === MAX_RETRIES) {
        throw new Error(`LLM analysis failed: ${message}`);
      }
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }

  throw new Error('Unreachable');
}
