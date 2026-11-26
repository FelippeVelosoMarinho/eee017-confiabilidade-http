import { CountMode, LatencyMode } from '../../reliability/engine';
import { FailureMode } from '../../reliability/indices';

export type { CountMode, LatencyMode };
export type FailureModeOption = FailureMode;

export interface SummaryOptions {
  sloErro: number;
  sloLat: number;
  tauMs: number;
  minRequests: number;
  /** Duração da janela em segundos. 0 = ler do passo da própria série. */
  windowSeconds: number;
  countMode: CountMode;
  latencyMode: LatencyMode;
  failureMode: FailureModeOption;
  censoredBreaksEpisode: boolean;
  /** Só pinta a disponibilidade de verde ou vermelho. Não entra na conta. */
  availabilityTarget: number;
}

/** Padrões da proposta: metas 99% e 95%, τ = 200 ms, mínimo de 100 requisições. */
export const DEFAULT_SUMMARY_OPTIONS: SummaryOptions = {
  sloErro: 0.99,
  sloLat: 0.95,
  tauMs: 200,
  minRequests: 100,
  windowSeconds: 0,
  countMode: 'perWindow',
  latencyMode: 'histogram',
  failureMode: 'both',
  censoredBreaksEpisode: true,
  availabilityTarget: 0.99,
};
