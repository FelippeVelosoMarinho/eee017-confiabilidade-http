export type CountMode = 'perWindow' | 'cumulative';
export type LatencyMode = 'histogram' | 'p95';
export type FailureModeOption = 'both' | 'error' | 'latency';

export interface SummaryOptions {
  sloErro: number;
  sloLat: number;
  tauMs: number;
  minRequests: number;
  windowSeconds: number;
  countMode: CountMode;
  latencyMode: LatencyMode;
  failureMode: FailureModeOption;
}

export const DEFAULT_SUMMARY_OPTIONS: SummaryOptions = {
  sloErro: 0.99,
  sloLat: 0.95,
  tauMs: 200,
  minRequests: 100,
  windowSeconds: 3600,
  countMode: 'perWindow',
  latencyMode: 'histogram',
  failureMode: 'both',
};
