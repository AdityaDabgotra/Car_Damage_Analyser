import { CV_EXPECTED_PARTS, type CVPartAssessment } from '@/lib/validators/schemas';

function responseHasCvParts(obj: object): boolean {
  return CV_EXPECTED_PARTS.some((k) =>
    Object.prototype.hasOwnProperty.call(obj, k)
  );
}

const CANONICAL: readonly CVPartAssessment[] = ['Replacement', 'No Damage', 'repair'];

/**
 * Maps common CV API variants (casing, spacing) to the canonical enum used by Zod + Mongoose.
 * Accepts e.g. "No damage", "REPAIR", "Replacement".
 */
export function normalizeCvPartAssessmentString(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const t = raw.trim();
  if (CANONICAL.includes(t as CVPartAssessment)) return t;

  const n = t.toLowerCase().replace(/\s+/g, ' ').trim();
  if (n === 'no damage' || n === 'no_damage' || n === 'nodamage') return 'No Damage';
  if (n === 'replacement' || n === 'replace') return 'Replacement';
  if (n === 'repair') return 'repair';

  return t;
}

function normalizeCvFlatObject(obj: Record<string, unknown>): Record<string, unknown> {
  const out = { ...obj };
  for (const key of CV_EXPECTED_PARTS) {
    if (Object.prototype.hasOwnProperty.call(out, key)) {
      out[key] = normalizeCvPartAssessmentString(out[key]);
    }
  }
  return out;
}

/**
 * Express APIs often return `{ data: { front_bumper, ... } }` or the flat map at the root.
 * Produces a single object with all part keys (+ optional metadata) for `CVResponseSchema`.
 * Normalizes per-part assessment strings to canonical `Replacement` | `No Damage` | `repair`.
 */
export function normalizeCvApiResponse(raw: unknown): unknown {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return raw;
  }

  const root = raw as Record<string, unknown>;

  if (responseHasCvParts(root)) {
    return normalizeCvFlatObject(root);
  }

  for (const nk of ['data', 'result', 'assessment', 'payload', 'body'] as const) {
    const inner = root[nk];
    if (
      inner &&
      typeof inner === 'object' &&
      !Array.isArray(inner) &&
      responseHasCvParts(inner as object)
    ) {
      let out = { ...(inner as Record<string, unknown>) };
      out = normalizeCvFlatObject(out);
      for (const meta of ['analysisId', 'processedAt', 'framesCaptured'] as const) {
        if (meta in root && !(meta in out)) {
          out[meta] = root[meta];
        }
      }
      return out;
    }
  }

  return raw;
}
