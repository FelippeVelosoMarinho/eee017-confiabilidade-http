import { perWindowFromCumulative } from '../panelData';

describe('perWindowFromCumulative', () => {
  it('diferença entre pontos seguidos; o primeiro ponto sai', () => {
    expect(perWindowFromCumulative([0, 480, 970, 1450])).toEqual([480, 490, 480]);
  });

  it('reset do contador: vale o valor novo', () => {
    expect(perWindowFromCumulative([0, 100, 30])).toEqual([100, 30]);
  });

  it('série vazia ou de um ponto não gera janela', () => {
    expect(perWindowFromCumulative([])).toEqual([]);
    expect(perWindowFromCumulative([5])).toEqual([]);
  });
});
