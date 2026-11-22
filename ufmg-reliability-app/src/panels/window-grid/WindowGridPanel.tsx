import React, { useMemo } from 'react';
import { DataFrame, FieldType, PanelProps, getFieldDisplayName } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { WindowGridOptions } from './types';

interface Props extends PanelProps<WindowGridOptions> {}

type Cell = 'ok' | 'bad' | 'censored' | 'empty';

interface RowData {
  label: string;
  cells: Cell[];
}

export function WindowGridPanel({ data, options, width, height }: Props) {
  const styles = useStyles2(getStyles);
  const { rows, times } = useMemo(() => buildGrid(data, options), [data, options]);

  if (rows.length === 0) {
    return <div className={styles.empty}>Sem séries. Esperado: 2 queries por componente (total refId A, erros refId B) rotuladas por {options.rowLabel}.</div>;
  }

  const maxCols = Math.max(...rows.map((r) => r.cells.length));
  const cellW = Math.max(4, Math.floor((width - 180) / Math.max(1, maxCols)));
  const cellH = Math.max(10, Math.floor((height - 40) / Math.max(1, rows.length)) - 2);

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        {times.length > 0 ? (
          <>
            <span>{new Date(times[0]).toLocaleString()}</span>
            <span>→</span>
            <span>{new Date(times[times.length - 1]).toLocaleString()}</span>
            <span className={styles.spacer} />
            <Legend />
          </>
        ) : null}
      </div>
      <div className={styles.grid}>
        {rows.map((row) => (
          <div key={row.label} className={styles.row}>
            <div className={styles.rowLabel} title={row.label}>
              {row.label}
            </div>
            <div className={styles.cells}>
              {row.cells.map((c, i) => (
                <div
                  key={i}
                  title={`${row.label} @ ${new Date(times[i] ?? 0).toLocaleString()} — ${c}`}
                  className={cellClass(styles, c)}
                  style={{ width: cellW, height: cellH }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Legend() {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.legend}>
      <LegendDot cls={styles.ok} label="ok" />
      <LegendDot cls={styles.bad} label="falhou" />
      <LegendDot cls={styles.censored} label="censurada" />
      <LegendDot cls={styles.emptyCell} label="sem tráfego" />
    </div>
  );
}

function LegendDot({ cls, label }: { cls: string; label: string }) {
  const styles = useStyles2(getStyles);
  return (
    <span className={styles.legendItem}>
      <span className={cls} style={{ width: 10, height: 10, display: 'inline-block' }} />
      {label}
    </span>
  );
}

function cellClass(styles: ReturnType<typeof getStyles>, c: Cell) {
  switch (c) {
    case 'ok':
      return styles.ok;
    case 'bad':
      return styles.bad;
    case 'censored':
      return styles.censored;
    default:
      return styles.emptyCell;
  }
}

interface Series {
  times: number[];
  values: number[];
  group: string;
  refId: string;
}

function readFrame(frame: DataFrame, labelKey: string): Series | null {
  const timeField = frame.fields.find((f) => f.type === FieldType.time);
  const valueField = frame.fields.find((f) => f.type === FieldType.number);
  if (!timeField || !valueField) {
    return null;
  }
  const labels = valueField.labels ?? {};
  const group = labels[labelKey] ?? getFieldDisplayName(valueField, frame);
  return {
    times: Array.from(timeField.values as unknown as ArrayLike<number>),
    values: Array.from(valueField.values as unknown as ArrayLike<number>),
    group,
    refId: frame.refId ?? '',
  };
}

function buildGrid(data: { series: DataFrame[] }, options: WindowGridOptions) {
  const series: Series[] = [];
  for (const f of data.series) {
    const s = readFrame(f, options.rowLabel);
    if (s) {
      series.push(s);
    }
  }
  if (series.length === 0) {
    return { rows: [] as RowData[], times: [] as number[] };
  }

  const timeSet = new Set<number>();
  for (const s of series) {
    for (const t of s.times) {
      timeSet.add(t);
    }
  }
  const times = Array.from(timeSet).sort((a, b) => a - b);

  const groups = Array.from(new Set(series.map((s) => s.group))).sort();
  const rows: RowData[] = [];
  for (const g of groups) {
    const groupSeries = series.filter((s) => s.group === g);
    const totals = seriesByRef(groupSeries, 'A');
    const errs = seriesByRef(groupSeries, 'B');
    const cells: Cell[] = times.map((t) => {
      const n = totals.get(t);
      if (n === undefined || n === 0) {
        return 'empty';
      }
      if (n < options.minRequests) {
        return 'censored';
      }
      const f = errs.get(t) ?? 0;
      const r = 1 - f / n;
      return r < options.sloErro ? 'bad' : 'ok';
    });
    rows.push({ label: g, cells });
  }
  return { rows, times };
}

function seriesByRef(list: Series[], refId: string): Map<number, number> {
  const map = new Map<number, number>();
  for (const s of list) {
    if (s.refId !== refId) continue;
    for (let i = 0; i < s.times.length; i++) {
      map.set(s.times[i], s.values[i]);
    }
  }
  return map;
}

const getStyles = () => ({
  wrap: css`
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 8px 12px;
    gap: 8px;
  `,
  header: css`
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    opacity: 0.7;
  `,
  spacer: css`
    flex: 1;
  `,
  grid: css`
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow: auto;
  `,
  row: css`
    display: flex;
    align-items: center;
    gap: 6px;
  `,
  rowLabel: css`
    width: 170px;
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  cells: css`
    display: flex;
    gap: 1px;
  `,
  ok: css`
    background: #73bf69;
  `,
  bad: css`
    background: #f2495c;
  `,
  censored: css`
    background: #8e8e8e;
  `,
  emptyCell: css`
    background: transparent;
    border: 1px dashed rgba(255, 255, 255, 0.1);
  `,
  legend: css`
    display: flex;
    gap: 10px;
    font-size: 11px;
  `,
  legendItem: css`
    display: inline-flex;
    gap: 4px;
    align-items: center;
  `,
  empty: css`
    padding: 24px;
    opacity: 0.7;
  `,
});
