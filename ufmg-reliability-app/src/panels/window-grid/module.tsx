import { PanelPlugin } from '@grafana/data';
import { WindowGridPanel } from './WindowGridPanel';
import { DEFAULT_WG_OPTIONS, WindowGridOptions } from './types';
import { addCommonOptions } from '../../reliability/panelOptions';

export const plugin = new PanelPlugin<WindowGridOptions>(WindowGridPanel).setPanelOptions((builder) => {
  addCommonOptions(builder, DEFAULT_WG_OPTIONS);
  builder
    .addTextInput({
      path: 'rowLabel',
      name: 'Rótulo das linhas',
      description:
        'Rótulo da série que vira uma linha do quadro (ex.: server_address, http_route, componente, job). As consultas precisam agrupar por ele. Variável: $agrupar',
      defaultValue: DEFAULT_WG_OPTIONS.rowLabel,
      category: ['Exibição'],
    })
    .addBooleanSwitch({
      path: 'hideUnjudged',
      name: 'Esconder linhas sem janela julgada',
      description: 'Some com as linhas em que nenhuma janela chega ao volume mínimo',
      defaultValue: DEFAULT_WG_OPTIONS.hideUnjudged,
      category: ['Exibição'],
    });
});
