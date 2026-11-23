import { PanelPlugin } from '@grafana/data';
import { SummaryPanel } from './SummaryPanel';
import { DEFAULT_SUMMARY_OPTIONS, SummaryOptions } from './types';

export const plugin = new PanelPlugin<SummaryOptions>(SummaryPanel).setPanelOptions((builder) => {
  builder
    .addNumberInput({
      path: 'sloErro',
      name: 'SLO erro',
      description: 'Confiabilidade mínima por janela no modo erro (ex.: 0.99)',
      defaultValue: DEFAULT_SUMMARY_OPTIONS.sloErro,
      settings: { min: 0, max: 1, step: 0.001 },
    })
    .addNumberInput({
      path: 'sloLat',
      name: 'SLO latência',
      description: 'Fração mínima de requisições abaixo de τ (ex.: 0.95)',
      defaultValue: DEFAULT_SUMMARY_OPTIONS.sloLat,
      settings: { min: 0, max: 1, step: 0.001 },
    })
    .addNumberInput({
      path: 'tauMs',
      name: 'τ (ms)',
      description: 'Limite de latência percebida como rápida',
      defaultValue: DEFAULT_SUMMARY_OPTIONS.tauMs,
      settings: { min: 1, step: 1 },
    })
    .addNumberInput({
      path: 'minRequests',
      name: 'Volume mínimo por janela',
      description: 'Janelas com volume abaixo deste número são censuradas',
      defaultValue: DEFAULT_SUMMARY_OPTIONS.minRequests,
      settings: { min: 1, step: 1 },
    })
    .addNumberInput({
      path: 'windowSeconds',
      name: 'Duração da janela (s)',
      description: 'Usado para converter MTBF/MTTR em tempo (ex.: 300 = 5m, 3600 = 1h)',
      defaultValue: DEFAULT_SUMMARY_OPTIONS.windowSeconds,
      settings: { min: 1, step: 1 },
    })
    .addRadio({
      path: 'countMode',
      name: 'Formato das contagens (A e B)',
      description: 'Por janela (ex.: increase) ou contador acumulado, com a diferença feita no painel',
      defaultValue: DEFAULT_SUMMARY_OPTIONS.countMode,
      settings: {
        options: [
          { value: 'perWindow', label: 'Por janela' },
          { value: 'cumulative', label: 'Acumulado' },
        ],
      },
    })
    .addRadio({
      path: 'latencyMode',
      name: 'Fonte da latência (C)',
      description: 'Baldes do histograma (le) ou o p95 da janela em segundos (janela ruim se p95 > τ)',
      defaultValue: DEFAULT_SUMMARY_OPTIONS.latencyMode,
      settings: {
        options: [
          { value: 'histogram', label: 'Histograma' },
          { value: 'p95', label: 'p95 da janela' },
        ],
      },
    })
    .addRadio({
      path: 'failureMode',
      name: 'Modo de falha',
      description: 'O que torna a janela ruim: erro ou latência (proposta), só erro ou só latência',
      defaultValue: DEFAULT_SUMMARY_OPTIONS.failureMode,
      settings: {
        options: [
          { value: 'both', label: 'Erro ou latência' },
          { value: 'error', label: 'Só erro' },
          { value: 'latency', label: 'Só latência' },
        ],
      },
    });
});
