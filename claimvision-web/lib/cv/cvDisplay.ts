import {
  CV_EXPECTED_PARTS,
  type CVPartAssessment,
  type CVPartKey,
  type CVResponseType,
} from '@/lib/validators/schemas';

export function formatCvPartLabel(key: string): string {
  return key
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function cvAffectedParts(cv: CVResponseType | undefined | null): CVPartKey[] {
  if (!cv) return [];
  return CV_EXPECTED_PARTS.filter((k) => cv[k] !== 'No Damage');
}

export function cvAffectedCount(cv: CVResponseType | undefined | null): number {
  return cvAffectedParts(cv).length;
}

/** Affected regions first, then alphabetical by key. */
export function cvPartsSorted(
  cv: CVResponseType
): Array<{ key: CVPartKey; assessment: CVPartAssessment }> {
  const rows = CV_EXPECTED_PARTS.map((k) => ({ key: k, assessment: cv[k] }));
  return rows.sort((a, b) => {
    const aNo = a.assessment === 'No Damage' ? 1 : 0;
    const bNo = b.assessment === 'No Damage' ? 1 : 0;
    if (aNo !== bNo) return aNo - bNo;
    return a.key.localeCompare(b.key);
  });
}

export const CV_ASSESSMENT_STYLE: Record<
  CVPartAssessment,
  { color: string; border: string }
> = {
  Replacement: { color: '#f87171', border: '#f8717140' },
  repair: { color: '#fbbf24', border: '#fbbf2440' },
  'No Damage': { color: '#94a3b8', border: '#94a3b840' },
};
