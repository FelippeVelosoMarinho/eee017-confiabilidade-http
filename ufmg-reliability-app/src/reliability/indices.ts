import { WindowRow } from './types';
import { WindowState } from './episodes';

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
  /** Falso quando não há série de latência: a janela não é julgada na latência. */
  latencyAvailable?: boolean;
}

export function computeWindows(input: ComputeInput, params: ComputeParams): WindowRow[] {
  const { times, total, errors, latencyFailures, p95Seconds } = input;
  const { sloErro, sloLat, minRequests, tauMs } = params;
  const latencyAvailable = params.latencyAvailable ?? true;
  const modoP95 = p95Seconds !== undefined;
  if (modoP95 && tauMs === undefined) {
    throw new Error('computeWindows: o modo p95 precisa de tauMs');
  }
  const rows: WindowRow[] = [];

  for (let i = 0; i < times.length; i++) {
    const n = Number.isFinite(total[i]) ? total[i] : 0;
    const fErr = Number.isFinite(errors[i]) ? errors[i] : 0;
    const fLat = Number.isFinite(latencyFailures[i]) ? latencyFailures[i] : 0;
    const empty = n <= 0;
    const censored = empty || n < minRequests;
    const inconsistent = n > 0 && (fErr > n + 1e-9 || fLat > n + 1e-9 || fErr < 0 || fLat < 0);

    const rErro = n > 0 ? 1 - fErr / n : NaN;
    const rLat = modoP95 || !latencyAvailable ? NaN : n > 0 ? 1 - fLat / n : NaN;
    const badErro = !censored && rErro < sloErro;
    let badLat = false;
    if (latencyAvailable && !censored) {
      if (modoP95) {
        const p95 = p95Seconds![i];
        badLat = Number.isFinite(p95) && p95 * 1000 > tauMs!;
      } else {
        badLat = rLat < sloLat;
      }
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
      empty,
      inconsistent,
    });
  }

  return rows;
}

export type FailureMode = 'both' | 'error' | 'latency';

function isBad(r: WindowRow, mode: FailureMode): boolean {
  return mode === 'error' ? r.bad_erro : mode === 'latency' ? r.bad_lat : r.bad_erro || r.bad_lat;
}

/** Sequência só das janelas julgadas (as não julgadas são descartadas). */
export function badSequence(rows: WindowRow[], mode: FailureMode = 'both'): boolean[] {
  return rows.filter((r) => !r.censored).map((r) => isBad(r, mode));
}

/** Uma posição por janela: true ruim, false boa, null não julgada. */
export function windowStates(rows: WindowRow[], mode: FailureMode = 'both'): WindowState[] {
  return rows.map((r) => (r.censored ? null : isBad(r, mode)));
}
