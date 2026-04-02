/** All claim cost figures are treated and displayed as INR. */

const LOCALE = 'en-IN';

export function formatInrAmount(n: number): string {
  return `₹${n.toLocaleString(LOCALE)}`;
}

export function formatInrRange(min: number, max: number): string {
  return `${formatInrAmount(min)} – ${formatInrAmount(max)}`;
}

/** Free-text cost ranges from the LLM — normalize stray $ / USD to INR display. */
export function displayInrCostLabel(text: string): string {
  return text.replace(/\$/g, '₹').replace(/\bUSD\b/gi, 'INR');
}
