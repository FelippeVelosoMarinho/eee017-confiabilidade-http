import { PanelPlugin } from '@grafana/data';
import { SummaryPanel } from './SummaryPanel';
import { DEFAULT_SUMMARY_OPTIONS, SummaryOptions } from './types';
import { addCommonOptions } from '../../reliability/panelOptions';

export const plugin = new PanelPlugin<SummaryOptions>(SummaryPanel).setPanelOptions((builder) => {
  addCommonOptions(builder, DEFAULT_SUMMARY_OPTIONS);
  builder
    .addBooleanSwitch({
      path: 'censoredBreaksEpisode',
      name: 'Janela não julgada corta o episódio',
      description:
        'Ligado: trechos ruins separados por uma janela sem volume mínimo contam como episódios diferentes. Variável: $censura_corta (sim/nao)',
      defaultValue: DEFAULT_SUMMARY_OPTIONS.censoredBreaksEpisode,
      category: ['Critério de falha (variável: $modo_falha)'],
    })
    .addNumberInput({
      path: 'windowSeconds',
      name: 'Duração da janela (s)',
      description: '0 = ler do passo da própria série (recomendado). Só converte MTBF e MTTR de janelas para tempo',
      defaultValue: DEFAULT_SUMMARY_OPTIONS.windowSeconds,
      category: ['Formato do dado'],
      settings: { min: 0, step: 1 },
    })
    .addNumberInput({
      path: 'availabilityTarget',
      name: 'Referência de cor da disponibilidade',
      description: 'Só pinta A de verde (≥) ou vermelho (<). Não entra na conta. Variável: $meta_disp',
      defaultValue: DEFAULT_SUMMARY_OPTIONS.availabilityTarget,
      category: ['Exibição'],
      settings: { min: 0, max: 1, step: 0.001 },
    });
});
