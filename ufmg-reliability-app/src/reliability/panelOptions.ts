import { PanelOptionsEditorBuilder } from '@grafana/data';

/**
 * Opções comuns aos dois painéis. Toda opção numérica ou de modo pode ser
 * sobrescrita por uma variável do dashboard (ver overrides.ts).
 */
export interface CommonOptions {
  sloErro: number;
  sloLat: number;
  tauMs: number;
  minRequests: number;
  countMode: 'perWindow' | 'cumulative';
  latencyMode: 'histogram' | 'p95';
  failureMode: 'both' | 'error' | 'latency';
}

const CAT_META = ['Metas (variáveis: $slo_erro, $slo_lat, $tau_ms ou $tau_s, $min_req)'];
const CAT_DADO = ['Formato do dado'];
const CAT_FALHA = ['Critério de falha (variável: $modo_falha)'];

export function addCommonOptions<T extends CommonOptions>(builder: PanelOptionsEditorBuilder<T>, d: CommonOptions) {
  builder
    .addNumberInput({
      path: 'sloErro' as any,
      name: 'Meta de erro (R*_erro)',
      description: 'Fração mínima de requisições sem erro por janela. Proposta: 0.99',
      defaultValue: d.sloErro,
      category: CAT_META,
      settings: { min: 0, max: 1, step: 0.001 },
    })
    .addNumberInput({
      path: 'sloLat' as any,
      name: 'Meta de latência (R*_lat)',
      description: 'Fração mínima de requisições até τ por janela. Proposta: 0.95',
      defaultValue: d.sloLat,
      category: CAT_META,
      settings: { min: 0, max: 1, step: 0.001 },
    })
    .addNumberInput({
      path: 'tauMs' as any,
      name: 'τ — limite de requisição lenta (ms)',
      description: 'Acima disso a requisição conta como lenta. Proposta: 200 ms; ajuste ao sistema avaliado',
      defaultValue: d.tauMs,
      category: CAT_META,
      settings: { min: 1, step: 1 },
    })
    .addNumberInput({
      path: 'minRequests' as any,
      name: 'Volume mínimo por janela',
      description: 'Janelas com menos requisições não são julgadas. Proposta: 100',
      defaultValue: d.minRequests,
      category: CAT_META,
      settings: { min: 1, step: 1 },
    })
    .addRadio({
      path: 'countMode' as any,
      name: 'Formato das contagens (A, B e baldes de C)',
      description:
        'Por janela (consulta já devolve o volume da janela, ex.: increase) ou contador acumulado (o painel faz a diferença; exato e recomendado)',
      defaultValue: d.countMode,
      category: CAT_DADO,
      settings: {
        options: [
          { value: 'perWindow', label: 'Por janela' },
          { value: 'cumulative', label: 'Acumulado' },
        ],
      },
    })
    .addRadio({
      path: 'latencyMode' as any,
      name: 'Fonte da latência (C)',
      description: 'Baldes do histograma (le) ou o percentil da janela em segundos (janela ruim se percentil > τ)',
      defaultValue: d.latencyMode,
      category: CAT_DADO,
      settings: {
        options: [
          { value: 'histogram', label: 'Histograma' },
          { value: 'p95', label: 'Percentil da janela' },
        ],
      },
    })
    .addRadio({
      path: 'failureMode' as any,
      name: 'Modo de falha',
      description: 'O que torna a janela ruim: erro ou latência (proposta), só erro ou só latência',
      defaultValue: d.failureMode,
      category: CAT_FALHA,
      settings: {
        options: [
          { value: 'both', label: 'Erro ou latência' },
          { value: 'error', label: 'Só erro' },
          { value: 'latency', label: 'Só latência' },
        ],
      },
    });
  return builder;
}
