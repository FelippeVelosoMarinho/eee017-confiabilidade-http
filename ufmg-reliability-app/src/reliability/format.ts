import { FailureMode } from './indices';

export function fmtNum(v: number | null): string {
  if (v === null || !Number.isFinite(v)) {
    return '—';
  }
  return v.toFixed(2);
}

export function fmtPct(v: number): string {
  if (!Number.isFinite(v)) {
    return '—';
  }
  return `${(v * 100).toFixed(2)}%`;
}

/** Duração em segundos, em texto curto. */
export function fmtSeconds(sec: number): string {
  if (!Number.isFinite(sec)) {
    return '—';
  }
  if (sec < 60) {
    return `${sec.toFixed(0)} s`;
  }
  if (sec < 3600) {
    return `${(sec / 60).toFixed(1)} min`;
  }
  if (sec < 86400) {
    return `${(sec / 3600).toFixed(1)} h`;
  }
  return `${(sec / 86400).toFixed(1)} d`;
}

/** Converte um número de janelas em tempo. */
export function fmtDuration(janelas: number | null, windowSeconds: number): string {
  if (janelas === null || !Number.isFinite(janelas) || !(windowSeconds > 0)) {
    return '—';
  }
  return fmtSeconds(janelas * windowSeconds);
}

const NOME_MODO: Record<FailureMode, string> = {
  both: 'erro ou latência',
  error: 'só erro',
  latency: 'só latência',
};

export function describeParams(
  o: { sloErro: number; sloLat: number; tauMs: number; minRequests: number; censoredBreaksEpisode?: boolean },
  mode: FailureMode,
  windowSeconds: number
): string {
  const partes = [
    `janela ${windowSeconds > 0 ? fmtSeconds(windowSeconds) : '?'}`,
    `mínimo ${o.minRequests} req`,
    `meta de erro ${(o.sloErro * 100).toFixed(1)}%`,
    `meta de latência ${(o.sloLat * 100).toFixed(0)}% até ${o.tauMs} ms`,
    `modo ${NOME_MODO[mode]}`,
  ];
  if (o.censoredBreaksEpisode !== undefined) {
    partes.push(o.censoredBreaksEpisode ? 'janela não julgada corta o episódio' : 'janela não julgada é ignorada');
  }
  return partes.join(' · ');
}
