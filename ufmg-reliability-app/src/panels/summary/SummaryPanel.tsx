import React, { useMemo } from 'react';
import { PanelProps } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { SummaryOptions } from './types';
import { alignToReference, bucketSeries, framesByRefId, singleSeries } from '../../reliability/panelData';
import { computeWindows, badSequence } from '../../reliability/indices';
import { episodes } from '../../reliability/episodes';
import { failuresAboveTau } from '../../reliability/histogram';

interface Props extends PanelProps<SummaryOptions> {}

export function SummaryPanel({ data, options }: Props) {
  const styles = useStyles2(getStyles);
  const stats = useMemo(() => compute(data, options), [data, options]);

  return (
    <div className={styles.wrap}>
      <Stat label="Disponibilidade A" value={fmtPct(stats.availability)} ok={stats.availability >= 0.99} />
      <Stat label="MTBF (janelas)" value={fmt(stats.mtbf)} hint={fmtDuration(stats.mtbf, options.windowSeconds)} />
      <Stat label="MTTR (janelas)" value={fmt(stats.mttr)} hint={fmtDuration(stats.mttr, options.windowSeconds)} />
      <Stat label="Episódios" value={String(stats.episodesCount)} />
      <Stat label="Janelas boas / ruins" value={`${stats.good} / ${stats.bad}`} />
      <Stat label="Censuradas" value={String(stats.censored)} hint={`< ${options.minRequests} req`} />
    </div>
  );
}

function compute(data: any, options: SummaryOptions) {
  const byRef = framesByRefId(data);
  const total = singleSeries(byRef['A']);
  const errors = singleSeries(byRef['B']);
  const buckets = bucketSeries(byRef['C']);

  if (!total) {
    return { availability: NaN, mtbf: null as number | null, mttr: null as number | null, episodesCount: 0, good: 0, bad: 0, censored: 0 };
  }

  const times = total.times;
  const totalVals = total.values;
  const errVals = alignToReference(times, errors);

  let latFail: number[];
  if (buckets.length === 0) {
    latFail = times.map(() => 0);
  } else {
    const aligned = buckets.map((b) => {
      const map = new Map<number, number>();
      for (let i = 0; i < b.times.length; i++) {
        map.set(b.times[i], b.values[i]);
      }
      return { le: b.le, values: times.map((t) => map.get(t) ?? 0) };
    });
    latFail = failuresAboveTau(aligned, options.tauMs);
  }

  const rows = computeWindows(
    { times, total: totalVals, errors: errVals, latencyFailures: latFail },
    { sloErro: options.sloErro, sloLat: options.sloLat, minRequests: options.minRequests },
  );
  const seq = badSequence(rows);
  const ep = episodes(seq);
  const censored = rows.filter((r) => r.censored).length;

  return {
    availability: ep.availability,
    mtbf: ep.mtbf,
    mttr: ep.mttr,
    episodesCount: ep.episodes.length,
    good: ep.goodWindows,
    bad: ep.badWindows,
    censored,
  };
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
