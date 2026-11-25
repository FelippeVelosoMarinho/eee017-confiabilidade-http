import { CommonOptions } from '../../reliability/panelOptions';

export interface WindowGridOptions extends CommonOptions {
  /** Rótulo que separa as linhas (qualquer rótulo da série). Variável: $agrupar */
  rowLabel: string;
  hideUnjudged: boolean;
}

export const DEFAULT_WG_OPTIONS: WindowGridOptions = {
  sloErro: 0.99,
  sloLat: 0.95,
  tauMs: 200,
  minRequests: 100,
  countMode: 'perWindow',
  latencyMode: 'histogram',
  failureMode: 'both',
  rowLabel: 'server_address',
  hideUnjudged: false,
};
