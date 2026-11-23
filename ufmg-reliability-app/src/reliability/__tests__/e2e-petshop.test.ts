import * as http from 'http';
import { createDataFrame, FieldType } from '@grafana/data';
import { compute } from '../../panels/summary/compute';
import { DEFAULT_SUMMARY_OPTIONS } from '../../panels/summary/types';

const PROM = process.env.PROM_URL ?? 'http://localhost:9090';
const describeMaybe = process.env.RUN_E2E === '1' ? describe : describe.skip;

function httpGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve(data));
        res.on('error', reject);
      })
      .on('error', reject);
  });
}

async function frame(refId: string, expr: string, start: number, end: number) {
  const url = new URL('/api/v1/query_range', PROM);
  url.searchParams.set('query', expr);
  url.searchParams.set('start', String(start));
  url.searchParams.set('end', String(end));
  url.searchParams.set('step', '300');
  const body = JSON.parse(await httpGet(url.toString())) as any;
  const values: Array<[number, string]> = body.data.result[0]?.values ?? [];
  return createDataFrame({
    refId,
    fields: [
      { name: 'Time', type: FieldType.time, values: values.map((v) => v[0] * 1000) },
      { name: 'Value', type: FieldType.number, values: values.map((v) => Number(v[1])) },
    ],
  });
}

const CENARIOS = [
  { nome: 'baixo', start: 1692608400, end: 1692785400, A_erro: 567 / 589, episodios: 13, mttrJanelas: 22 / 13 },
  { nome: 'alto', start: 1693922400, end: 1694099100, A_erro: 582 / 589, episodios: 6, mttrJanelas: 7 / 6 },
  { nome: 'variavel', start: 1682193300, end: 1682688900, A_erro: 1624 / 1652, episodios: 25, mttrJanelas: 28 / 25 },
];

describeMaybe('e2e PetShop (PetSite)', () => {
  it.each(CENARIOS)('$nome: painel bate com a análise em Python', async (c) => {
    const sel = `service_name="PetSite",scenario="${c.nome}"`;
    const data = {
      series: [
        await frame('A', `sum(http_server_request_duration_seconds_count{${sel}})`, c.start, c.end),
        await frame('B', `sum(http_server_request_duration_seconds_count{${sel},error_type!=""})`, c.start, c.end),
        await frame('C', `max(http_server_request_duration_window_seconds{${sel},quantile="0.95"})`, c.start, c.end),
      ],
    };
    const base = {
      ...DEFAULT_SUMMARY_OPTIONS,
      windowSeconds: 300,
      countMode: 'cumulative' as const,
      latencyMode: 'p95' as const,
    };

    const erro = compute(data, { ...base, failureMode: 'error' });
    expect(erro.availability).toBeCloseTo(c.A_erro, 10);
    expect(erro.episodesCount).toBe(c.episodios);
    expect(erro.mttr).toBeCloseTo(c.mttrJanelas, 10);
    expect(erro.censored).toBe(0);

    const ambos = compute(data, { ...base, failureMode: 'both' });
    expect(ambos.availability).toBeLessThan(0.01);
  });
});
