export interface EpisodesSummary {
  mtbf: number | null;
  mttr: number | null;
  availability: number;
  episodes: Array<{ startIdx: number; endIdx: number; length: number }>;
  goodWindows: number;
  badWindows: number;
  judged: number;
}

export function episodes(bad: boolean[]): EpisodesSummary {
  const judged = bad.length;
  if (judged === 0) {
    return { mtbf: null, mttr: null, availability: NaN, episodes: [], goodWindows: 0, badWindows: 0, judged };
  }

  const good = bad.filter((b) => !b).length;
  const episodesList: Array<{ startIdx: number; endIdx: number; length: number }> = [];
  let runStart = -1;
  let runLen = 0;

  for (let i = 0; i < bad.length; i++) {
    if (bad[i]) {
      if (runLen === 0) {
        runStart = i;
      }
      runLen++;
    } else if (runLen > 0) {
      episodesList.push({ startIdx: runStart, endIdx: i - 1, length: runLen });
      runLen = 0;
    }
  }
  if (runLen > 0) {
    episodesList.push({ startIdx: runStart, endIdx: bad.length - 1, length: runLen });
  }

  const availability = good / judged;

  if (episodesList.length === 0) {
    return { mtbf: null, mttr: null, availability, episodes: [], goodWindows: good, badWindows: 0, judged };
  }

  const mttr = episodesList.reduce((s, e) => s + e.length, 0) / episodesList.length;
  const mtbf = good / episodesList.length;

  return {
    mtbf,
    mttr,
    availability,
    episodes: episodesList,
    goodWindows: good,
    badWindows: judged - good,
    judged,
  };
}
