/**
 * Variáveis do dashboard que sobrescrevem as opções do painel.
 * Ordem de prioridade: variável do dashboard > opção do painel > padrão da proposta.
 *
 * | Variável        | Campo                  | Exemplo                       |
 * |-----------------|------------------------|-------------------------------|
 * | $tau_ms         | tauMs                  | 200                           |
 * | $tau_s          | tauMs (em segundos)    | 0.2                           |
 * | $slo_erro       | sloErro                | 0.99 ou 99                    |
 * | $slo_lat        | sloLat                 | 0.95 ou 95                    |
 * | $min_req        | minRequests            | 100                           |
 * | $meta_disp      | availabilityTarget     | 0.99 ou 99                    |
 * | $modo_falha     | failureMode            | ambos / erro / latencia       |
 * | $censura_corta  | censoredBreaksEpisode  | sim / nao                     |
 * | $agrupar        | rowLabel               | server_address, componente... |
 */
const NUMERICAS: Array<[string, string, 'num' | 'frac' | 'seg']> = [
  ['tauMs', 'tau_ms', 'num'],
  ['tauMs', 'tau_s', 'seg'],
  ['sloErro', 'slo_erro', 'frac'],
  ['sloLat', 'slo_lat', 'frac'],
  ['minRequests', 'min_req', 'num'],
  ['availabilityTarget', 'meta_disp', 'frac'],
];

const MODOS: Record<string, 'both' | 'error' | 'latency'> = {
  ambos: 'both',
  both: 'both',
  'erro ou latencia': 'both',
  erro: 'error',
  error: 'error',
  latencia: 'latency',
  'latência': 'latency',
  latency: 'latency',
};

const SIM = new Set(['sim', 'true', '1', 'yes', 's']);
const NAO = new Set(['nao', 'não', 'false', '0', 'no', 'n']);

function ler(replaceVariables: (s: string) => string, nome: string): string | null {
  const bruto = replaceVariables(`$${nome}`);
  if (bruto === `$${nome}` || bruto.trim() === '') {
    return null;
  }
  return bruto.trim();
}

export function applyOverrides<T extends object>(options: T, replaceVariables?: (s: string) => string): T {
  if (!replaceVariables) {
    return options;
  }
  const out: any = { ...options };
  const tem = (campo: string) => campo in out;

  for (const [campo, variavel, tipo] of NUMERICAS) {
    if (!tem(campo)) {
      continue;
    }
    const bruto = ler(replaceVariables, variavel);
    const v = bruto === null ? NaN : Number(bruto);
    if (!Number.isFinite(v)) {
      continue;
    }
    if (tipo === 'frac') {
      out[campo] = v > 1 && v <= 100 ? v / 100 : v;
    } else if (tipo === 'seg') {
      out[campo] = v * 1000;
    } else {
      out[campo] = v;
    }
  }

  const modo = tem('failureMode') ? ler(replaceVariables, 'modo_falha') : null;
  if (modo !== null && MODOS[modo.toLowerCase()]) {
    out.failureMode = MODOS[modo.toLowerCase()];
  }

  const corta = tem('censoredBreaksEpisode') ? ler(replaceVariables, 'censura_corta') : null;
  if (corta !== null) {
    const c = corta.toLowerCase();
    if (SIM.has(c)) {
      out.censoredBreaksEpisode = true;
    } else if (NAO.has(c)) {
      out.censoredBreaksEpisode = false;
    }
  }

  const agrupar = tem('rowLabel') ? ler(replaceVariables, 'agrupar') : null;
  if (agrupar !== null && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(agrupar)) {
    out.rowLabel = agrupar;
  }

  return out as T;
}
