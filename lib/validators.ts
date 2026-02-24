/**
 * Converts an unknown value to a number or null.
 * Returns null for empty strings, null, undefined, or non-numeric values.
 */
export function toNumberOrNull(val: unknown): number | null {
  if (val === '' || val === null || val === undefined) return null
  const n = Number(val)
  return isNaN(n) ? null : n
}
