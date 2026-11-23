import { SummaryOptions } from './types';
import {
  alignToReference,
  bucketSeries,
  framesByRefId,
  perWindowFromCumulative,
  singleSeries,
} from '../../reliability/panelData';
import { computeWindows, badSequence } from '../../reliability/indices';
import { episodes } from '../../reliability/episodes';
import { failuresAboveTau } from '../../reliability/histogram';

export function compute(data: any, options: SummaryOptions) {
  const byRef = framesByRefId(data);
  const total = singleSeries(byRef['A']);
  const errors = singleSeries(byRef['B']);
  const countMode = options.countMode ?? 'perWindow';
  const latencyMode = options.latencyMode ?? 'histogram';

  if (!total) {
    return {
      availability: NaN,
      mtbf: null as number | null,
      mttr: null as number | null,
      episodesCount: 0,
      good: 0,
      bad: 0,
      censored: 0,
    };
  }

  let times = total.times;
  let totalVals = total.values;
  let errVals = alignToReference(times, errors);

  let latFail: number[] = times.map(() => 0);
  let p95: number[] | undefined;
  if (latencyMode === 'p95') {
    p95 = alignToReference(times, singleSeries(byRef['C']), NaN);
  } else {
    const buckets = bucketSeries(byRef['C']);
    if (buckets.length > 0) {
      const aligned = buckets.map((b) => {
        const map = new Map<number, number>();
        for (let i = 0; i < b.times.length; i++) {
          map.set(b.times[i], b.values[i]);
        }
        return { le: b.le, values: times.map((t) => map.get(t) ?? 0) };
      });
      latFail = failuresAboveTau(aligned, options.tauMs);
    }
  }

  if (countMode === 'cumulative') {
    totalVals = perWindowFromCumulative(totalVals);
    errVals = perWindowFromCumulative(errVals);
    latFail = latFail.slice(1);
    p95 = p95?.slice(1);
    times = times.slice(1);
  }

  const rows = computeWindows(
    { times, total: totalVals, errors: errVals, latencyFailures: latFail, p95Seconds: p95 },
    { sloErro: options.sloErro, sloLat: options.sloLat, minRequests: options.minRequests, tauMs: options.tauMs }
  );
  const seq = badSequence(rows, options.failureMode ?? 'both');
  const ep = episodes(seq);
  const censored = rows.filter((r) => r.censored).length;

  return {
    availability: ep.availability,
    mtbf: ep.mtbf,
    mttr: ep.mttr,
    episodesCount: ep.episodes.length,
    good: ep.goodWindows,
    bad: ep.badWindows,
    censored,
  };
}
