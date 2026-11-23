import { WindowRow } from './types';

export interface ComputeInput {
  times: number[];
  total: number[];
  errors: number[];
  latencyFailures: number[];
  p95Seconds?: number[];
}

export interface ComputeParams {
  sloErro: number;
  sloLat: number;
  minRequests: number;
  tauMs?: number;
}

export function computeWindows(input: ComputeInput, params: ComputeParams): WindowRow[] {
  const { times, total, errors, latencyFailures, p95Seconds } = input;
  const { sloErro, sloLat, minRequests, tauMs } = params;
  const modoP95 = p95Seconds !== undefined;
  if (modoP95 && tauMs === undefined) {
    throw new Error('computeWindows: o modo p95 precisa de tauMs');
  }
  const rows: WindowRow[] = [];

  for (let i = 0; i < times.length; i++) {
    const n = total[i] ?? 0;
    const fErr = errors[i] ?? 0;
    const fLat = latencyFailures[i] ?? 0;
    const censored = n < minRequests || !Number.isFinite(n);

    const rErro = n > 0 ? 1 - fErr / n : NaN;
    const rLat = modoP95 ? NaN : n > 0 ? 1 - fLat / n : NaN;
    const badErro = !censored && rErro < sloErro;
    let badLat: boolean;
    if (modoP95) {
      const p95 = p95Seconds![i];
      badLat = !censored && Number.isFinite(p95) && p95 * 1000 > tauMs!;
    } else {
      badLat = !censored && rLat < sloLat;
    }

    rows.push({
      t: times[i],
      n,
      f_err: fErr,
      f_lat: fLat,
      r_erro: rErro,
      r_lat: rLat,
      bad_erro: badErro,
      bad_lat: badLat,
      censored,
    });
  }

  return rows;
}

export type FailureMode = 'both' | 'error' | 'latency';

export function badSequence(rows: WindowRow[], mode: FailureMode = 'both'): boolean[] {
  return rows
    .filter((r) => !r.censored)
    .map((r) => (mode === 'error' ? r.bad_erro : mode === 'latency' ? r.bad_lat : r.bad_erro || r.bad_lat));
}
