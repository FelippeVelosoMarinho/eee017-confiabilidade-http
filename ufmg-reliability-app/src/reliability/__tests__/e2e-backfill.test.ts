/**
 * Integração contra o Prometheus local do reliability-lab.
 * Confirma que o pipeline frontend (computeWindows + badSequence + episodes)
 * produz uma disponibilidade compatível com a PromQL de referência do backfill.
 *
 * Habilite com RUN_E2E=1 (não roda por padrão no CI).
 */
import { computeWindows, badSequence } from '../indices';
import { episodes } from '../episodes';

const PROM = process.env.PROM_URL ?? 'http://localhost:9090';
const describeMaybe = process.env.RUN_E2E === '1' ? describe : describe.skip;

import * as http from 'http';

function httpGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function queryRange(expr: string, start: string, end: string, step: string): Promise<Array<[number, number]>> {
  const url = new URL('/api/v1/query_range', PROM);
  url.searchParams.set('query', expr);
  url.searchParams.set('start', start);
  url.searchParams.set('end', end);
  url.searchParams.set('step', step);
  const body = JSON.parse(await httpGet(url.toString())) as any;
  if (body.status !== 'success' || body.data.result.length === 0) {
    return [];
  }
  return body.data.result[0].values.map((v: [number, string]) => [v[0] * 1000, Number(v[1])]);
}

describeMaybe('e2e backfill', () => {
  it('disponibilidade sobre todo o range coincide com a PromQL direta', async () => {
    const start = '2024-01-01T00:00:00Z';
    const end = '2024-02-06T23:59:59Z';
    const step = '3600';
    const total = await queryRange('sum(increase(http_server_request_duration_seconds_count[2h]))', start, end, step);
    const errors = await queryRange('sum(increase(http_server_request_duration_seconds_count{http_response_status_code=~"5.."}[2h]))', start, end, step);
    expect(total.length).toBeGreaterThan(100);

    const times = total.map((v) => v[0]);
    const totalVals = total.map((v) => v[1]);
    const errMap = new Map(errors.map((v) => [v[0], v[1]]));
    const errVals = times.map((t) => errMap.get(t) ?? 0);
    const latFail = times.map(() => 0);

    const rows = computeWindows(
      { times, total: totalVals, errors: errVals, latencyFailures: latFail },
      { sloErro: 0.99, sloLat: 0.95, minRequests: 1 },
    );
    const seq = badSequence(rows);
    const ep = episodes(seq);

    const promAvail = JSON.parse(await httpGet(`${PROM}/api/v1/query?query=${encodeURIComponent(
      '1-sum(increase(http_server_request_duration_seconds_count{http_response_status_code=~"5.."}[37d]))/sum(increase(http_server_request_duration_seconds_count[37d]))',
    )}&time=2024-02-06T23:59:59Z`)) as any;

    console.log(`[e2e] frontend availability=${ep.availability.toFixed(5)} episodes=${ep.episodes.length} mtbf=${ep.mtbf} mttr=${ep.mttr} good=${ep.goodWindows} bad=${ep.badWindows}`);
    console.log(`[e2e] prom per-request availability=${promAvail.data.result[0].value[1]}`);

    expect(ep.availability).toBeGreaterThan(0);
    expect(ep.availability).toBeLessThanOrEqual(1);
    expect(ep.goodWindows + ep.badWindows).toBe(seq.length);
  }, 30000);
});
