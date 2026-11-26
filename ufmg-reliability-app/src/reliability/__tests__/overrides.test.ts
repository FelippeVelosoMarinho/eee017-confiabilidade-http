import { applyOverrides } from '../overrides';

const base = { tauMs: 200, sloErro: 0.99, sloLat: 0.95, minRequests: 100, outro: 'x' };

describe('applyOverrides', () => {
  it('sem replaceVariables, nada muda', () => {
    expect(applyOverrides(base)).toEqual(base);
  });

  it('variáveis do dashboard substituem as opções', () => {
    const vars: Record<string, string> = { $tau_ms: '300', $slo_erro: '0.995', $slo_lat: '0.9', $min_req: '50' };
    const r = applyOverrides(base, (s) => vars[s] ?? s);
    expect(r).toEqual({ tauMs: 300, sloErro: 0.995, sloLat: 0.9, minRequests: 50, outro: 'x' });
  });

  it('variável ausente ou inválida mantém a opção do painel', () => {
    const r = applyOverrides(base, (s) => (s === '$tau_ms' ? 'abc' : s));
    expect(r).toEqual(base);
  });

  it('meta em porcentagem vira fração', () => {
    const vars: Record<string, string> = { $slo_erro: '99.5', $slo_lat: '90' };
    const r = applyOverrides(base, (s) => vars[s] ?? s);
    expect(r.sloErro).toBeCloseTo(0.995, 10);
    expect(r.sloLat).toBeCloseTo(0.9, 10);
  });

  it('τ em segundos', () => {
    const r = applyOverrides(base, (s) => (s === '$tau_s' ? '0.35' : s));
    expect(r.tauMs).toBeCloseTo(350, 10);
  });

  it('modo de falha, corte de episódio e agrupamento', () => {
    const o = { ...base, failureMode: 'both', censoredBreaksEpisode: true, rowLabel: 'server_address' };
    const vars: Record<string, string> = { $modo_falha: 'latencia', $censura_corta: 'nao', $agrupar: 'http_route' };
    const r = applyOverrides(o, (s) => vars[s] ?? s);
    expect(r.failureMode).toBe('latency');
    expect(r.censoredBreaksEpisode).toBe(false);
    expect(r.rowLabel).toBe('http_route');
  });

  it('não cria campo que o painel não tem', () => {
    const r = applyOverrides(base, (s) => (s === '$modo_falha' ? 'erro' : s));
    expect('failureMode' in r).toBe(false);
  });
});
