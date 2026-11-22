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
