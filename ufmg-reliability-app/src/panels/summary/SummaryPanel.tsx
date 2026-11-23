import React from 'react';
import { PanelProps } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { SummaryOptions } from './types';
import { compute } from './compute';
import { applyOverrides } from '../../reliability/overrides';

interface Props extends PanelProps<SummaryOptions> {}

export function SummaryPanel({ data, options: painel, replaceVariables }: Props) {
  const styles = useStyles2(getStyles);
  const options = applyOverrides(painel, replaceVariables);
  const stats = compute(data, options);

  return (
    <div className={styles.wrap}>
      <Stat label="Disponibilidade A" value={fmtPct(stats.availability)} ok={stats.availability >= 0.99} />
      <Stat label="MTBF" value={fmtDuration(stats.mtbf, options.windowSeconds) || '—'} hint={`${fmt(stats.mtbf)} janelas`} />
      <Stat label="MTTR" value={fmtDuration(stats.mttr, options.windowSeconds) || '—'} hint={`${fmt(stats.mttr)} janelas`} />
      <Stat label="Episódios" value={String(stats.episodesCount)} />
      <Stat label="Janelas boas / ruins" value={`${stats.good} / ${stats.bad}`} />
      <Stat label="Censuradas" value={String(stats.censored)} hint={`< ${options.minRequests} req`} />
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

function fmt(v: number | null): string {
  if (v === null || !Number.isFinite(v)) {
    return '—';
  }
  return v.toFixed(2);
}

function fmtPct(v: number): string {
  if (!Number.isFinite(v)) {
    return '—';
  }
  return `${(v * 100).toFixed(2)}%`;
}

function fmtDuration(v: number | null, windowSec: number): string {
  if (v === null || !Number.isFinite(v)) {
    return '';
  }
  const sec = v * windowSec;
  if (sec < 60) {
    return `${sec.toFixed(0)}s`;
  }
  if (sec < 3600) {
    return `${(sec / 60).toFixed(1)} min`;
  }
  if (sec < 86400) {
    return `${(sec / 3600).toFixed(1)} h`;
  }
  return `${(sec / 86400).toFixed(1)} d`;
}

const getStyles = () => ({
  wrap: css`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
    padding: 12px;
    height: 100%;
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
    font-size: 28px;
    font-weight: 600;
  `,
  valueOk: css`
    font-size: 28px;
    font-weight: 600;
    color: #73bf69;
  `,
  valueBad: css`
    font-size: 28px;
    font-weight: 600;
    color: #f2495c;
  `,
  hint: css`
    font-size: 11px;
    opacity: 0.6;
  `,
});
