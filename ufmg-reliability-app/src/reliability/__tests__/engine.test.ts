import { alignTo, buildWindows, diffCumulative, EngineOptions, inferStep, regularAxis, summarize } from '../engine';
import hf from './fixtures/hf_por_dia.json';

const base: EngineOptions = {
  sloErro: 0.99,
  sloLat: 0.95,
  tauMs: 200,
  minRequests: 100,
  countMode: 'perWindow',
  latencyMode: 'histogram',
  failureMode: 'both',
  censoredBreaksEpisode: true,
};

describe('utilitários do eixo', () => {
  it('passo é a mediana das diferenças', () => {
    expect(inferStep([0, 10, 20, 40, 50])).toBe(10);
  });
  it('eixo regular preenche os buracos', () => {
    expect(regularAxis([0, 10, 40], 10)).toEqual([0, 10, 20, 30, 40]);
  });
  it('acumulado repete o último valor no buraco', () => {
    expect(alignTo([0, 10, 20, 30], { times: [0, 10, 30], values: [1, 5, 9] }, true)).toEqual([1, 5, 5, 9]);
  });
  it('diferença do acumulado', () => {
    expect(diffCumulative([0, 5, 5, 9, 2])).toEqual([5, 0, 4, 2]);
  });
});

describe('histograma acumulado', () => {
  it('os baldes também viram contagem por janela antes de comparar com τ', () => {
    const times = [0, 1000, 2000];
    const built = buildWindows(
      {
        total: { times, values: [0, 100, 300] },
        errors: { times, values: [0, 0, 0] },
        buckets: [
          { le: 0.2, times, values: [0, 99, 150] },
          { le: Infinity, times, values: [0, 100, 300] },
        ],
      },
      { ...base, countMode: 'cumulative' }
    );
    expect(built.rows.map((r) => r.n)).toEqual([100, 200]);
    expect(built.rows.map((r) => r.f_lat)).toEqual([1, 149]);
    expect(built.rows.map((r) => r.bad_lat)).toEqual([false, true]);
  });
});

describe('dado incoerente', () => {
  it('erros maiores que o total são marcados', () => {
    const times = [0, 1];
    const built = buildWindows({ total: { times, values: [100, 100] }, errors: { times, values: [116, 0] } }, base);
    const s = summarize(built, base);
    expect(s.inconsistent).toBe(1);
  });
});

describe('sem série de latência', () => {
  it('"erro ou latência" vira "só erro", e R_lat fica indefinido', () => {
    const times = [0, 1];
    const built = buildWindows({ total: { times, values: [200, 200] }, errors: { times, values: [0, 10] } }, base);
    const s = summarize(built, base);
    expect(s.latencyAvailable).toBe(false);
    expect(s.effectiveMode).toBe('error');
    expect(Number.isNaN(s.rLat)).toBe(true);
    expect(s.episodesCount).toBe(1);
  });
});

/**
 * Gabarito: relatorio-logs-huggingface.pdf (janela de 24 h, mínimo 100, τ = 200 ms, metas 99% e 95%).
 * 37 dias, 28 julgados, nenhum dentro das duas metas, 6 episódios (6, 6, 5, 5, 5 e 1 dia), MTTR 4,7 dias.
 */
describe('Hugging Face por dia (contador acumulado, como sai do Prometheus)', () => {
  const dias = hf.dias as Array<[string, number, number, number]>;
  const DIA = 86_400_000;
  const t0 = Date.parse(`${dias[0][0]}T00:00:00Z`);
  const times = [t0, ...dias.map((_, i) => t0 + (i + 1) * DIA)];
  const acum = (col: number) => {
    let s = 0;
    return [0, ...dias.map((d) => (s += d[col] as number))];
  };
  const raw = {
    total: { times, values: acum(1) },
    errors: { times, values: acum(2) },
    buckets: [
      { le: 0.2, times, values: acum(3) },
      { le: Infinity, times, values: acum(1) },
    ],
  };
  const o: EngineOptions = { ...base, countMode: 'cumulative' };

  it('erro ou latência, dia não julgado corta o episódio', () => {
    const built = buildWindows(raw, o);
    const s = summarize(built, o);
    expect(built.rows).toHaveLength(37);
    expect(built.stepMs).toBe(DIA);
    expect(s.judged).toBe(28);
    expect(s.censored + s.empty).toBe(9);
    expect(s.good).toBe(0);
    expect(s.availability).toBe(0);
    expect(s.episodesCount).toBe(6);
    expect(s.mttr).toBeCloseTo(28 / 6, 10);
    expect(s.mtbf).toBe(0);
    expect(s.rErro).toBeCloseTo(1 - 110 / 5000, 10);
    expect(s.rLat).toBeCloseTo(3760 / 5000, 10);
    expect(s.inconsistent).toBe(0);
  });

  it('só erro: quatro dias passam (13/01, 17/01, 31/01 e 05/02)', () => {
    const oe: EngineOptions = { ...o, failureMode: 'error' };
    const built = buildWindows(raw, oe);
    const s = summarize(built, oe);
    expect(s.good).toBe(4);
    const bons = built.rows
      .filter((r) => !r.censored && !r.bad_erro)
      .map((r) => new Date(r.t - DIA).toISOString().slice(0, 10));
    expect(bons).toEqual(['2024-01-13', '2024-01-17', '2024-01-31', '2024-02-05']);
  });

  it('sem cortar no dia não julgado, os 28 dias viram um episódio só', () => {
    const on: EngineOptions = { ...o, censoredBreaksEpisode: false };
    const s = summarize(buildWindows(raw, on), on);
    expect(s.episodesCount).toBe(1);
    expect(s.mttr).toBe(28);
  });
});
