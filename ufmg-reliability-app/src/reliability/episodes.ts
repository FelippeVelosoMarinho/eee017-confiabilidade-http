/**
 * Estado de uma janela para a contagem de episódios:
 * - true  = janela julgada e fora do objetivo (ruim)
 * - false = janela julgada e dentro do objetivo (boa)
 * - null  = janela não julgada (volume abaixo do mínimo ou sem tráfego)
 */
export type WindowState = boolean | null;

export interface Episode {
  startIdx: number;
  endIdx: number;
  length: number;
}

export interface EpisodesSummary {
  mtbf: number | null;
  mttr: number | null;
  availability: number;
  episodes: Episode[];
  goodWindows: number;
  badWindows: number;
  judged: number;
}

export interface EpisodesOptions {
  /**
   * Quando verdadeiro (padrão), uma janela não julgada encerra o episódio em curso:
   * não se sabe o que aconteceu nela, então os trechos ruins de um lado e do outro
   * contam como episódios distintos. Quando falso, a janela não julgada é ignorada
   * e os vizinhos se juntam no mesmo episódio.
   */
  censoredBreaks?: boolean;
}

export function episodes(states: WindowState[], opts: EpisodesOptions = {}): EpisodesSummary {
  const censoredBreaks = opts.censoredBreaks ?? true;
  const list: Episode[] = [];
  let good = 0;
  let judged = 0;
  let runStart = -1;
  let runLen = 0;
  let lastIdx = -1;

  const close = (endIdx: number) => {
    if (runLen > 0) {
      list.push({ startIdx: runStart, endIdx, length: runLen });
      runLen = 0;
    }
  };

  for (let i = 0; i < states.length; i++) {
    const s = states[i];
    if (s === null) {
      if (censoredBreaks) {
        close(lastIdx);
      }
      continue;
    }
    judged++;
    if (s) {
      if (runLen === 0) {
        runStart = i;
      }
      runLen++;
    } else {
      close(lastIdx);
      good++;
    }
    lastIdx = i;
  }
  close(lastIdx);

  if (judged === 0) {
    return { mtbf: null, mttr: null, availability: NaN, episodes: [], goodWindows: 0, badWindows: 0, judged };
  }

  const availability = good / judged;
  if (list.length === 0) {
    return { mtbf: null, mttr: null, availability, episodes: [], goodWindows: good, badWindows: 0, judged };
  }

  const bad = judged - good;
  return {
    mtbf: good / list.length,
    mttr: bad / list.length,
    availability,
    episodes: list,
    goodWindows: good,
    badWindows: bad,
    judged,
  };
}
