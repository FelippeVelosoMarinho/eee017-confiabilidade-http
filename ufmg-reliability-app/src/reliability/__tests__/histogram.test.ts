import { failuresAboveTau } from '../histogram';

describe('failuresAboveTau (interpolação linear)', () => {
  const buckets = [
    { le: 0.1, values: [100, 200] },
    { le: 0.25, values: [120, 260] },
    { le: 0.5, values: [130, 280] },
    { le: Infinity, values: [150, 300] },
  ];

  it('τ coincide com fronteira de bucket', () => {
    expect(failuresAboveTau(buckets, 100)).toEqual([50, 100]);
  });

  it('τ=200ms entre buckets 0.1 e 0.25, interpolação linear', () => {
    const r = failuresAboveTau(buckets, 200);
    expect(r[0]).toBeCloseTo(150 - (100 + (2 / 3) * 20), 10);
    expect(r[1]).toBeCloseTo(300 - (200 + (2 / 3) * 60), 10);
  });

  it('nunca retorna negativo', () => {
    const r = failuresAboveTau([{ le: 0.1, values: [50] }, { le: Infinity, values: [40] }], 100);
    expect(r[0]).toBe(0);
  });

  it('vazio para buckets vazios', () => {
    expect(failuresAboveTau([], 200)).toEqual([]);
  });
});
