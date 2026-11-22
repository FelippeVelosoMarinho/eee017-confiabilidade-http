export interface WindowGridOptions {
  sloErro: number;
  sloLat: number;
  minRequests: number;
  rowLabel: 'server_address' | 'http_route' | 'instance';
}

export const DEFAULT_WG_OPTIONS: WindowGridOptions = {
  sloErro: 0.99,
  sloLat: 0.95,
  minRequests: 100,
  rowLabel: 'server_address',
};
