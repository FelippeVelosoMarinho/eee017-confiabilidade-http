export interface BucketSeries {
  le: number;
  values: number[];
}

export function failuresAboveTau(buckets: BucketSeries[], tauMs: number): number[] {
  if (buckets.length === 0) {
    return [];
  }
  const sorted = [...buckets].sort((a, b) => a.le - b.le);
  const infBucket = sorted[sorted.length - 1];
  const tauSec = tauMs / 1000;

  let lowerIdx = -1;
  let upperIdx = sorted.length - 1;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].le >= tauSec) {
      upperIdx = i;
      lowerIdx = i - 1;
      break;
    }
  }

  const n = infBucket.values.length;
  const out = new Array<number>(n);

  for (let t = 0; t < n; t++) {
    const total = infBucket.values[t] ?? 0;
    const upper = sorted[upperIdx].values[t] ?? 0;
    const lower = lowerIdx >= 0 ? (sorted[lowerIdx].values[t] ?? 0) : 0;

    const leUpper = sorted[upperIdx].le;
    const leLower = lowerIdx >= 0 ? sorted[lowerIdx].le : 0;

    let belowTau: number;
    if (leUpper === tauSec || lowerIdx < 0) {
      belowTau = upper;
    } else {
      const frac = (tauSec - leLower) / (leUpper - leLower);
      belowTau = lower + frac * (upper - lower);
    }

    out[t] = Math.max(0, total - belowTau);
  }

  return out;
}
