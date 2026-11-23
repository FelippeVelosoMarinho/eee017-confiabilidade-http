import { PanelPlugin } from '@grafana/data';
import { WindowGridPanel } from './WindowGridPanel';
import { DEFAULT_WG_OPTIONS, WindowGridOptions } from './types';

export const plugin = new PanelPlugin<WindowGridOptions>(WindowGridPanel).setPanelOptions((builder) => {
  builder
    .addNumberInput({
      path: 'sloErro',
      name: 'SLO erro',
      defaultValue: DEFAULT_WG_OPTIONS.sloErro,
      settings: { min: 0, max: 1, step: 0.001 },
    })
    .addNumberInput({
      path: 'sloLat',
      name: 'SLO latência',
      defaultValue: DEFAULT_WG_OPTIONS.sloLat,
      settings: { min: 0, max: 1, step: 0.001 },
    })
    .addNumberInput({
      path: 'minRequests',
      name: 'Volume mínimo por janela',
      defaultValue: DEFAULT_WG_OPTIONS.minRequests,
      settings: { min: 1, step: 1 },
    })
    .addRadio({
      path: 'rowLabel',
      name: 'Agrupamento das linhas',
      defaultValue: DEFAULT_WG_OPTIONS.rowLabel,
      settings: {
        options: [
          { value: 'server_address', label: 'server_address' },
          { value: 'http_route', label: 'http_route' },
          { value: 'instance', label: 'instance' },
          { value: 'service_name', label: 'service_name' },
          { value: 'componente', label: 'componente' },
        ],
      },
    })
    .addRadio({
      path: 'countMode',
      name: 'Formato das contagens (A e B)',
      defaultValue: DEFAULT_WG_OPTIONS.countMode,
      settings: {
        options: [
          { value: 'perWindow', label: 'Por janela' },
          { value: 'cumulative', label: 'Acumulado' },
        ],
      },
    })
    .addBooleanSwitch({
      path: 'hideUnjudged',
      name: 'Esconder componentes sem janela julgada',
      description: 'Some com as linhas em que nenhuma janela chega ao volume mínimo',
      defaultValue: DEFAULT_WG_OPTIONS.hideUnjudged,
    });
});
