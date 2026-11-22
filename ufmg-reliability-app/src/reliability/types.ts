export interface AppOptions {
  datasourceUid: string;
  slo_erro: number;
  slo_lat: number;
  tau_ms: number;
  window: string;
  min_requests: number;
}

export const DEFAULT_OPTIONS: AppOptions = {
  datasourceUid: 'webstore-metrics',
  slo_erro: 0.99,
  slo_lat: 0.95,
  tau_ms: 200,
  window: '5m',
  min_requests: 100,
};

export interface WindowRow {
  t: number;
  n: number;
  f_err: number;
  f_lat: number;
  r_erro: number;
  r_lat: number;
  bad_erro: boolean;
  bad_lat: boolean;
  censored: boolean;
}
