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
});
