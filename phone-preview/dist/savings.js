// Compare a user-provided usual spend with their target, never with a claimed live price.
export function savingsComparison(usual, target) {
  if (usual === '' || usual == null || !Number.isFinite(Number(usual)) || Number(usual) <= 0 || Number(usual) > 50000 || !Number.isFinite(Number(target)) || Number(target) < 0) return null;
  const before = Math.round(Number(usual) * 100);
  const planned = Math.round(Number(target) * 100);
  const weekly = Math.max(0, before - planned);
  return {before:before/100, target:planned/100, weekly:weekly/100, yearly:weekly*52/100, percent:Math.round(weekly/before*100), over:(Math.max(0,planned-before))/100};
}
