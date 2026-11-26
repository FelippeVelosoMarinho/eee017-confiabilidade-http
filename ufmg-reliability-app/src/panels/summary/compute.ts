import { PanelData } from '@grafana/data';
import { SummaryOptions } from './types';
import { bucketSeries, framesByRefId, singleSeries } from '../../reliability/panelData';
import { buildWindows, Summary, summarize } from '../../reliability/engine';

export interface SummaryResult extends Summary {
  /** Duração da janela usada para converter MTBF e MTTR em tempo (s). */
  windowSeconds: number;
  hasData: boolean;
}

/**
 * Convenção das consultas do painel:
 * - A: total de requisições
 * - B: requisições com falha no modo erro
 * - C: latência (baldes `le` do histograma, ou o percentil da janela em segundos)
 */
export function compute(data: Pick<PanelData, 'series'>, options: SummaryOptions): SummaryResult {
  const byRef = framesByRefId(data as PanelData);
  const total = singleSeries(byRef['A']);
  const errors = singleSeries(byRef['B']);
  const latencyMode = options.latencyMode ?? 'histogram';

  const engineOptions = {
    sloErro: options.sloErro,
    sloLat: options.sloLat,
    tauMs: options.tauMs,
    minRequests: options.minRequests,
    countMode: options.countMode ?? 'perWindow',
    latencyMode,
    failureMode: options.failureMode ?? 'both',
    censoredBreaksEpisode: options.censoredBreaksEpisode ?? true,
  };

  const built = buildWindows(
    {
      total,
      errors,
      buckets: latencyMode === 'histogram' ? bucketSeries(byRef['C']) : undefined,
      p95: latencyMode === 'p95' ? singleSeries(byRef['C']) : undefined,
    },
    engineOptions
  );
  const s = summarize(built, engineOptions);
  const windowSeconds = options.windowSeconds > 0 ? options.windowSeconds : s.stepMs / 1000;
  return { ...s, windowSeconds, hasData: total !== null && built.rows.length > 0 };
}
