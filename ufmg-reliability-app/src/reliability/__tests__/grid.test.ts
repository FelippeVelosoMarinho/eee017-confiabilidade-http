import { createDataFrame, FieldType } from '@grafana/data';
import { buildGrid } from '../../panels/window-grid/grid';
import { DEFAULT_WG_OPTIONS } from '../../panels/window-grid/types';

function frame(refId: string, componente: string, times: number[], values: number[]) {
  return createDataFrame({
    refId,
    fields: [
      { name: 'Time', type: FieldType.time, values: times },
      { name: 'Value', type: FieldType.number, values, labels: { componente } },
    ],
  });
}

const opts = {
  ...DEFAULT_WG_OPTIONS,
  rowLabel: 'componente',
  countMode: 'cumulative' as const,
  hideUnjudged: true,
};

describe('buildGrid com contador acumulado', () => {
  const t = [0, 300, 600, 900];
  const series = [
    frame('A', 'Site', t, [0, 500, 1000, 1500]),
    frame('B', 'Site', t, [0, 2, 12, 12]),
    frame('A', 'Fila', t, [0, 40, 80, 120]),
    frame('B', 'Fila', t, [0, 0, 0, 0]),
  ];

  it('diferença por janela, meta de erro e linha escondida sem janela julgada', () => {
    const g = buildGrid({ series } as any, opts);
    expect(g.times).toEqual([300, 600, 900]);
    expect(g.rows.map((r) => r.label)).toEqual(['Site']);
    expect(g.rows[0].cells).toEqual(['ok', 'bad', 'ok']);
  });

  it('sem esconder, a linha de baixo volume aparece toda censurada', () => {
    const g = buildGrid({ series } as any, { ...opts, hideUnjudged: false });
    const fila = g.rows.find((r) => r.label === 'Fila')!;
    expect(fila.cells).toEqual(['censored', 'censored', 'censored']);
  });
});

describe('buildGrid com latência', () => {
  const t = [0, 300, 600];
  const series = [
    frame('A', 'Site', t, [0, 500, 1000]),
    frame('B', 'Site', t, [0, 0, 0]),
    frame('C', 'Site', t, [NaN, 0.15, 0.31]),
  ];

  it('no modo "erro ou latência", janela com percentil acima de τ fica vermelha', () => {
    const g = buildGrid({ series } as any, { ...opts, latencyMode: 'p95' });
    expect(g.rows[0].cells).toEqual(['ok', 'bad']);
  });

  it('no modo "só erro", a latência não pesa', () => {
    const g = buildGrid({ series } as any, { ...opts, latencyMode: 'p95', failureMode: 'error' });
    expect(g.rows[0].cells).toEqual(['ok', 'ok']);
  });
});
