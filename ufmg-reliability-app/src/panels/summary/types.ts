export interface SummaryOptions {
  sloErro: number;
  sloLat: number;
  tauMs: number;
  minRequests: number;
  windowSeconds: number;
}

export const DEFAULT_SUMMARY_OPTIONS: SummaryOptions = {
  sloErro: 0.99,
  sloLat: 0.95,
  tauMs: 200,
  minRequests: 100,
  windowSeconds: 3600,
};
