import { WindowRow } from './types';

export interface ComputeInput {
  times: number[];
  total: number[];
  errors: number[];
  latencyFailures: number[];
}

export interface ComputeParams {
  sloErro: number;
  sloLat: number;
  minRequests: number;
}

export function computeWindows(input: ComputeInput, params: ComputeParams): WindowRow[] {
  const { times, total, errors, latencyFailures } = input;
  const { sloErro, sloLat, minRequests } = params;
  const rows: WindowRow[] = [];

  for (let i = 0; i < times.length; i++) {
    const n = total[i] ?? 0;
    const fErr = errors[i] ?? 0;
    const fLat = latencyFailures[i] ?? 0;
    const censored = n < minRequests || !Number.isFinite(n);

    const rErro = n > 0 ? 1 - fErr / n : NaN;
    const rLat = n > 0 ? 1 - fLat / n : NaN;
    const badErro = !censored && rErro < sloErro;
    const badLat = !censored && rLat < sloLat;

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

export function badSequence(rows: WindowRow[]): boolean[] {
  return rows.filter((r) => !r.censored).map((r) => r.bad_erro || r.bad_lat);
}
