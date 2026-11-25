/**
 * Motor único dos painéis: recebe as séries já separadas (total, erros, latência),
 * monta as janelas e resume disponibilidade, MTBF e MTTR.
 *
 * Os dois painéis (resumo e quadro de janelas) passam pelo mesmo código, para que
 * o mesmo dado nunca dê dois números diferentes.
 */
import { computeWindows, FailureMode, windowStates } from './indices';
import { episodes } from './episodes';
import { failuresAboveTau } from './histogram';
import { WindowRow } from './types';

export type CountMode = 'perWindow' | 'cumulative';
export type LatencyMode = 'histogram' | 'p95';

export interface EngineOptions {
  sloErro: number;
  sloLat: number;
  tauMs: number;
  minRequests: number;
  countMode: CountMode;
  latencyMode: LatencyMode;
  failureMode: FailureMode;
  censoredBreaksEpisode: boolean;
}

export interface TimeValues {
  times: number[];
  values: number[];
}

export interface RawSeries {
  total: TimeValues | null;
  errors: TimeValues | null;
  buckets?: Array<{ le: number } & TimeValues>;
  p95?: TimeValues | null;
}

/** Passo mais comum entre amostras seguidas (ms). 0 se não houver como saber. */
export function inferStep(times: number[]): number {
  const diffs: number[] = [];
  for (let i = 1; i < times.length; i++) {
    const d = times[i] - times[i - 1];
    if (d > 0) {
      diffs.push(d);
    }
  }
  if (diffs.length === 0) {
    return 0;
  }
  diffs.sort((a, b) => a - b);
  return diffs[Math.floor(diffs.length / 2)];
}

/** Eixo regular do primeiro ao último instante, no passo dado. */
export function regularAxis(times: number[], step: number): number[] {
  if (times.length === 0) {
    return [];
  }
  const sorted = [...times].sort((a, b) => a - b);
  if (step <= 0) {
    return Array.from(new Set(sorted));
  }
  const out: number[] = [];
  const t0 = sorted[0];
  const tN = sorted[sorted.length - 1];
  for (let t = t0; t <= tN + step / 2; t += step) {
    out.push(t);
  }
  return out;
}

/**
 * Leva uma série para o eixo. No modo acumulado, um ponto que falta repete o último
 * valor conhecido (o contador não andou); antes do primeiro ponto vale 0. No modo por
 * janela, o ponto que falta vale `fill`.
 */
export function alignTo(axis: number[], s: TimeValues | null | undefined, cumulative: boolean, fill = 0): number[] {
  if (!s || s.times.length === 0) {
    return axis.map(() => fill);
  }
  const map = new Map<number, number>();
  for (let i = 0; i < s.times.length; i++) {
    map.set(s.times[i], s.values[i]);
  }
  if (!cumulative) {
    return axis.map((t) => {
      const v = map.get(t);
      return v === undefined || v === null ? fill : v;
    });
  }
  let last = 0;
  return axis.map((t) => {
    const v = map.get(t);
    if (v !== undefined && v !== null && Number.isFinite(v)) {
      last = v;
    }
    return last;
  });
}

/** Diferença entre pontos seguidos de um contador acumulado. Um recomeço (queda) vira o valor novo. */
export function diffCumulative(values: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    out.push(d >= 0 ? d : values[i]);
  }
  return out;
}

export interface BuiltWindows {
  rows: WindowRow[];
  /** Passo das janelas, em ms. */
  stepMs: number;
  latencyAvailable: boolean;
}

/**
 * Monta as janelas a partir das séries cruas. `axisTimes`, quando dado, fixa o eixo
 * (o quadro usa o mesmo eixo para todas as linhas).
 */
export function buildWindows(raw: RawSeries, o: EngineOptions, axisTimes?: number[]): BuiltWindows {
  const cumulative = o.countMode === 'cumulative';
  const baseTimes = axisTimes ?? raw.total?.times ?? [];
  const stepMs = inferStep(baseTimes);
  let axis = axisTimes ?? regularAxis(baseTimes, stepMs);

  let total = alignTo(axis, raw.total, cumulative);
  let errors = alignTo(axis, raw.errors, cumulative);
  let buckets = (raw.buckets ?? []).map((b) => ({ le: b.le, values: alignTo(axis, b, cumulative) }));
  let p95 = raw.p95 ? alignTo(axis, raw.p95, false, NaN) : undefined;

  if (cumulative) {
    total = diffCumulative(total);
    errors = diffCumulative(errors);
    buckets = buckets.map((b) => ({ le: b.le, values: diffCumulative(b.values) }));
    p95 = p95?.slice(1);
    axis = axis.slice(1);
  }

  const usesP95 = o.latencyMode === 'p95';
  const latencyAvailable = usesP95
    ? !!p95 && p95.some((v) => Number.isFinite(v))
    : buckets.some((b) => Number.isFinite(b.le));

  const latFail = !usesP95 && latencyAvailable ? failuresAboveTau(buckets, o.tauMs) : axis.map(() => 0);

  const rows = computeWindows(
    { times: axis, total, errors, latencyFailures: latFail, p95Seconds: usesP95 ? p95 ?? axis.map(() => NaN) : undefined },
    { sloErro: o.sloErro, sloLat: o.sloLat, minRequests: o.minRequests, tauMs: o.tauMs, latencyAvailable }
  );
  return { rows, stepMs, latencyAvailable };
}

export interface Summary {
  availability: number;
  mtbf: number | null;
  mttr: number | null;
  episodesCount: number;
  good: number;
  bad: number;
  judged: number;
  /** Janelas com tráfego, mas abaixo do mínimo. */
  censored: number;
  /** Janelas sem tráfego. */
  empty: number;
  /** R = 1 − f/n no período inteiro (todas as requisições). */
  rErro: number;
  rLat: number;
  requests: number;
  inconsistent: number;
  latencyAvailable: boolean;
  /** Modo de falha efetivamente usado (sem latência, "os dois" vira "só erro"). */
  effectiveMode: FailureMode;
  stepMs: number;
}

export function summarize(built: BuiltWindows, o: EngineOptions): Summary {
  const { rows, latencyAvailable, stepMs } = built;
  let mode: FailureMode = o.failureMode;
  if (!latencyAvailable && mode === 'both') {
    mode = 'error';
  }
  const states = windowStates(rows, mode);
  const usable = mode === 'latency' && !latencyAvailable ? states.map(() => null) : states;
  const ep = episodes(usable, { censoredBreaks: o.censoredBreaksEpisode });

  let n = 0;
  let fe = 0;
  let fl = 0;
  for (const r of rows) {
    if (r.n > 0) {
      n += r.n;
      fe += r.f_err;
      fl += r.f_lat;
    }
  }
  const histogramLatency = latencyAvailable && o.latencyMode === 'histogram';

  return {
    availability: ep.availability,
    mtbf: ep.mtbf,
    mttr: ep.mttr,
    episodesCount: ep.episodes.length,
    good: ep.goodWindows,
    bad: ep.badWindows,
    judged: ep.judged,
    censored: rows.filter((r) => r.censored && !r.empty).length,
    empty: rows.filter((r) => r.empty).length,
    rErro: n > 0 ? 1 - fe / n : NaN,
    rLat: n > 0 && histogramLatency ? 1 - fl / n : NaN,
    requests: n,
    inconsistent: rows.filter((r) => r.inconsistent).length,
    latencyAvailable,
    effectiveMode: mode,
    stepMs,
  };
}
