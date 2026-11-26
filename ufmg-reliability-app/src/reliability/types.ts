export interface WindowRow {
  /** Instante (ms) que fecha a janela. */
  t: number;
  /** Requisições na janela. */
  n: number;
  f_err: number;
  f_lat: number;
  r_erro: number;
  r_lat: number;
  bad_erro: boolean;
  bad_lat: boolean;
  /** Não julgada: volume abaixo do mínimo (inclui janela vazia). */
  censored: boolean;
  /** Sem nenhuma requisição. */
  empty: boolean;
  /** Erros ou falhas de latência maiores que o total, ou negativos: dado incoerente. */
  inconsistent: boolean;
}
