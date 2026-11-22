import { episodes } from '../episodes';

describe('episodes (paridade com motor.py#episodios)', () => {
  it('sem janelas: mtbf/mttr nulos, availability NaN', () => {
    const r = episodes([]);
    expect(r.mtbf).toBeNull();
    expect(r.mttr).toBeNull();
    expect(Number.isNaN(r.availability)).toBe(true);
    expect(r.episodes).toEqual([]);
  });

  it('todas boas: nenhum episódio, availability 1', () => {
    const r = episodes([false, false, false, false]);
    expect(r.episodes).toHaveLength(0);
    expect(r.availability).toBe(1);
    expect(r.mtbf).toBeNull();
    expect(r.mttr).toBeNull();
  });

  it('todas ruins: 1 episódio, availability 0', () => {
    const r = episodes([true, true, true]);
    expect(r.episodes).toHaveLength(1);
    expect(r.episodes[0].length).toBe(3);
    expect(r.availability).toBe(0);
    expect(r.mttr).toBe(3);
    expect(r.mtbf).toBe(0);
  });

  it('F F B B F F F B B B F: 2 episódios, MTTR=2.5, MTBF=3, A=6/11', () => {
    const r = episodes([false, false, true, true, false, false, false, true, true, true, false]);
    expect(r.episodes).toHaveLength(2);
    expect(r.episodes[0].length).toBe(2);
    expect(r.episodes[1].length).toBe(3);
    expect(r.goodWindows).toBe(6);
    expect(r.badWindows).toBe(5);
    expect(r.availability).toBeCloseTo(6 / 11, 10);
    expect(r.mttr).toBeCloseTo(2.5, 10);
    expect(r.mtbf).toBe(3);
  });

  it('episódio aberto no fim é fechado', () => {
    const r = episodes([false, true, true]);
    expect(r.episodes).toHaveLength(1);
    expect(r.episodes[0].endIdx).toBe(2);
    expect(r.episodes[0].length).toBe(2);
  });

  it('identidade A = MTBF/(MTBF+MTTR) quando houver episódio', () => {
    const r = episodes([true, false, false, true, false]);
    const identity = (r.mtbf as number) / ((r.mtbf as number) + (r.mttr as number));
    expect(r.availability).toBeCloseTo(identity, 10);
  });
});
