/**
 * Integração contra o Prometheus do lab (lab/docker-compose.yml, porta 9090).
 * Passa as séries pelo mesmo código do painel de resumo e confere com o relatório
 * do Hugging Face (casos/huggingface/relatorio-logs-huggingface.pdf).
 *
 *   cd lab && docker compose up --build -d
 *   RUN_E2E=1 npx jest e2e-huggingface
 */
import * as http from 'http';
import { createDataFrame, FieldType } from '@grafana/data';
import { compute } from '../../panels/summary/compute';
import { DEFAULT_SUMMARY_OPTIONS } from '../../panels/summary/types';

const PROM = process.env.PROM_HF_URL ?? 'http://localhost:9090';
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

const START = Date.parse('2024-01-01T00:00:00Z') / 1000;
const END = Date.parse('2024-02-07T00:00:00Z') / 1000;

async function frames(refId: string, expr: string) {
  const url = new URL('/api/v1/query_range', PROM);
  url.searchParams.set('query', expr);
  url.searchParams.set('start', String(START));
  url.searchParams.set('end', String(END));
  url.searchParams.set('step', '86400');
  const body = JSON.parse(await httpGet(url.toString())) as any;
  return (body.data.result as any[]).map((r) =>
    createDataFrame({
      refId,
      fields: [
        { name: 'Time', type: FieldType.time, values: r.values.map((v: [number, string]) => v[0] * 1000) },
        {
          name: 'Value',
          type: FieldType.number,
          values: r.values.map((v: [number, string]) => Number(v[1])),
          labels: r.metric,
        },
      ],
    })
  );
}

describeMaybe('e2e Hugging Face (janela de 24 h)', () => {
  it('bate com o relatório: 28 dias julgados, 0 dentro das metas, 6 episódios', async () => {
    const data = {
      series: [
        ...(await frames('A', 'sum(http_server_request_duration_seconds_count)')),
        ...(await frames('B', 'sum(http_server_request_duration_seconds_count{error_type!=""})')),
        ...(await frames('C', 'sum by (le) (http_server_request_duration_seconds_bucket)')),
      ],
    };
    const o = { ...DEFAULT_SUMMARY_OPTIONS, countMode: 'cumulative' as const };
    const s = compute(data, o);
    expect(s.windowSeconds).toBe(86400);
    expect(s.requests).toBe(5000);
    expect(s.judged).toBe(28);
    expect(s.good).toBe(0);
    expect(s.episodesCount).toBe(6);
    expect(s.mttr).toBeCloseTo(28 / 6, 10);
    expect(s.rErro).toBeCloseTo(0.978, 10);
    expect(s.rLat).toBeCloseTo(0.752, 10);

    const soErro = compute(data, { ...o, failureMode: 'error' });
    expect(soErro.good).toBe(4);
  });
});
