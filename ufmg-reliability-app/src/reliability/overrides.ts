export interface Overridable {
  tauMs?: number;
  sloErro: number;
  sloLat: number;
  minRequests: number;
}

const VARIAVEIS: Array<[keyof Overridable, string]> = [
  ['tauMs', 'tau_ms'],
  ['sloErro', 'slo_erro'],
  ['sloLat', 'slo_lat'],
  ['minRequests', 'min_req'],
];

export function applyOverrides<T extends Overridable>(options: T, replaceVariables?: (s: string) => string): T {
  if (!replaceVariables) {
    return options;
  }
  const out = { ...options };
  for (const [campo, variavel] of VARIAVEIS) {
    const bruto = replaceVariables(`$${variavel}`);
    const v = Number(bruto);
    if (bruto !== `$${variavel}` && bruto.trim() !== '' && Number.isFinite(v)) {
      const ehMeta = campo === 'sloErro' || campo === 'sloLat';
      (out as any)[campo] = ehMeta && v > 1 && v <= 100 ? v / 100 : v;
    }
  }
  return out;
}
