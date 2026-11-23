export interface WindowGridOptions {
  sloErro: number;
  sloLat: number;
  minRequests: number;
  rowLabel: 'server_address' | 'http_route' | 'instance' | 'service_name' | 'componente';
  countMode: 'perWindow' | 'cumulative';
  hideUnjudged: boolean;
}

export const DEFAULT_WG_OPTIONS: WindowGridOptions = {
  sloErro: 0.99,
  sloLat: 0.95,
  minRequests: 100,
  rowLabel: 'server_address',
  countMode: 'perWindow',
  hideUnjudged: false,
};
