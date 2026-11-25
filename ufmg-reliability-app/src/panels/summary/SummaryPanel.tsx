import React from 'react';
import { PanelProps } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { SummaryOptions } from './types';
import { compute } from './compute';
import { applyOverrides } from '../../reliability/overrides';
import { fmtDuration, fmtNum, fmtPct, describeParams } from '../../reliability/format';

interface Props extends PanelProps<SummaryOptions> {}

export function SummaryPanel({ data, options: painel, replaceVariables }: Props) {
  const styles = useStyles2(getStyles);
  const options = applyOverrides(painel, replaceVariables);
  const s = compute(data, options);

  if (!s.hasData) {
    return (
      <div className={styles.empty}>
        Sem dados. O painel espera A = total de requisições, B = requisições com erro e, se houver, C = latência
        (baldes <code>le</code> ou percentil da janela).
      </div>
    );
  }

  const win = s.windowSeconds;
  const naoJulgadas = s.censored + s.empty;

  return (
    <div className={styles.wrap}>
      {s.inconsistent > 0 ? (
        <div className={styles.warn}>
          Em {s.inconsistent} janela(s) as falhas passam do total. Confira se as consultas A (total) e B (erros) não
          estão trocadas.
        </div>
      ) : null}
      <div className={styles.grid}>
        <Stat
          label="Disponibilidade A"
          value={fmtPct(s.availability)}
          hint={`${s.good} de ${s.judged} janelas julgadas`}
          ok={Number.isFinite(s.availability) ? s.availability >= options.availabilityTarget : undefined}
        />
        <Stat label="MTBF" value={fmtDuration(s.mtbf, win)} hint={`${fmtNum(s.mtbf)} janelas`} />
        <Stat label="MTTR" value={fmtDuration(s.mttr, win)} hint={`${fmtNum(s.mttr)} janelas`} />
        <Stat label="Episódios" value={String(s.episodesCount)} />
        <Stat label="Janelas boas / ruins" value={`${s.good} / ${s.bad}`} />
        <Stat
          label="Não julgadas"
          value={String(naoJulgadas)}
          hint={`${s.censored} abaixo de ${options.minRequests} req · ${s.empty} sem tráfego`}
        />
        <Stat label="R erro (período)" value={fmtPct(s.rErro)} hint={`${Math.round(s.requests)} requisições`} />
        <Stat
          label="R latência (período)"
          value={fmtPct(s.rLat)}
          hint={s.latencyAvailable ? (options.latencyMode === 'p95' ? 'por percentil, sem R' : `até ${options.tauMs} ms`) : 'sem série de latência'}
        />
      </div>
      <div className={styles.params}>{describeParams(options, s.effectiveMode, win)}</div>
    </div>
  );
}

function Stat({ label, value, hint, ok }: { label: string; value: string; hint?: string; ok?: boolean }) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.stat}>
      <div className={styles.label}>{label}</div>
      <div className={ok === undefined ? styles.value : ok ? styles.valueOk : styles.valueBad}>{value}</div>
      {hint ? <div className={styles.hint}>{hint}</div> : null}
    </div>
  );
}

const getStyles = () => ({
  wrap: css`
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 12px;
    gap: 8px;
    overflow: auto;
  `,
  grid: css`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
    align-content: start;
  `,
  stat: css`
    display: flex;
    flex-direction: column;
    gap: 2px;
  `,
  label: css`
    font-size: 11px;
    text-transform: uppercase;
    opacity: 0.7;
  `,
  value: css`
    font-size: 26px;
    font-weight: 600;
  `,
  valueOk: css`
    font-size: 26px;
    font-weight: 600;
    color: #73bf69;
  `,
  valueBad: css`
    font-size: 26px;
    font-weight: 600;
    color: #f2495c;
  `,
  hint: css`
    font-size: 11px;
    opacity: 0.6;
  `,
  params: css`
    font-size: 11px;
    opacity: 0.6;
    margin-top: auto;
  `,
  warn: css`
    font-size: 12px;
    padding: 6px 8px;
    border-left: 3px solid #f2495c;
    background: rgba(242, 73, 92, 0.1);
  `,
  empty: css`
    padding: 24px;
    opacity: 0.7;
  `,
});
