import { computeWindows, badSequence } from '../indices';

describe('computeWindows', () => {
  const params = { sloErro: 0.99, sloLat: 0.95, minRequests: 100 };

  it('janela com volume abaixo do mínimo é censurada', () => {
    const r = computeWindows({ times: [0], total: [50], errors: [0], latencyFailures: [0] }, params);
    expect(r[0].censored).toBe(true);
    expect(r[0].bad_erro).toBe(false);
    expect(r[0].bad_lat).toBe(false);
  });

  it('janela ok: bad_erro e bad_lat falsos', () => {
    const r = computeWindows({ times: [0], total: [1000], errors: [5], latencyFailures: [40] }, params);
    expect(r[0].r_erro).toBeCloseTo(0.995, 10);
    expect(r[0].r_lat).toBeCloseTo(0.96, 10);
    expect(r[0].bad_erro).toBe(false);
    expect(r[0].bad_lat).toBe(false);
  });

  it('janela com R_erro abaixo do SLO fica ruim', () => {
    const r = computeWindows({ times: [0], total: [1000], errors: [20], latencyFailures: [0] }, params);
    expect(r[0].bad_erro).toBe(true);
    expect(r[0].bad_lat).toBe(false);
  });

  it('badSequence ignora censuradas', () => {
    const rows = computeWindows(
      { times: [0, 1, 2], total: [1000, 50, 1000], errors: [20, 0, 0], latencyFailures: [0, 0, 0] },
      params,
    );
    expect(badSequence(rows)).toEqual([true, false]);
  });
});

describe('computeWindows no modo p95', () => {
  const params = { sloErro: 0.99, sloLat: 0.95, minRequests: 100, tauMs: 200 };

  it('p95 acima de tau deixa a janela ruim na latência; abaixo, não', () => {
    const r = computeWindows(
      { times: [0, 1], total: [500, 500], errors: [0, 0], latencyFailures: [0, 0], p95Seconds: [0.31, 0.15] },
      params,
    );
    expect(r[0].bad_lat).toBe(true);
    expect(r[1].bad_lat).toBe(false);
    expect(Number.isNaN(r[0].r_lat)).toBe(true);
  });

  it('p95 igual a tau passa (pelo menos 95% até tau)', () => {
    const r = computeWindows({ times: [0], total: [500], errors: [0], latencyFailures: [0], p95Seconds: [0.2] }, params);
    expect(r[0].bad_lat).toBe(false);
  });

  it('sem percentil na janela, não marca falha de latência', () => {
    const r = computeWindows({ times: [0], total: [500], errors: [0], latencyFailures: [0], p95Seconds: [NaN] }, params);
    expect(r[0].bad_lat).toBe(false);
  });

  it('modo p95 sem tauMs é erro de configuração', () => {
    expect(() =>
      computeWindows(
        { times: [0], total: [500], errors: [0], latencyFailures: [0], p95Seconds: [0.1] },
        { sloErro: 0.99, sloLat: 0.95, minRequests: 100 },
      ),
    ).toThrow();
  });
});

describe('badSequence por modo de falha', () => {
  const rows = computeWindows(
    { times: [0, 1], total: [1000, 1000], errors: [20, 0], latencyFailures: [0, 100] },
    { sloErro: 0.99, sloLat: 0.95, minRequests: 100 },
  );
  it('erro, latência e os dois', () => {
    expect(badSequence(rows, 'error')).toEqual([true, false]);
    expect(badSequence(rows, 'latency')).toEqual([false, true]);
    expect(badSequence(rows, 'both')).toEqual([true, true]);
    expect(badSequence(rows)).toEqual([true, true]);
  });
});
