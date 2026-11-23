import { DataFrame, FieldType, getFieldDisplayName } from '@grafana/data';
import { WindowGridOptions } from './types';

export type Cell = 'ok' | 'bad' | 'censored' | 'empty';

export interface RowData {
  label: string;
  cells: Cell[];
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

export function buildGrid(data: { series: DataFrame[] }, options: WindowGridOptions) {
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
  const allTimes = Array.from(timeSet).sort((a, b) => a - b);
  const cumulative = (options.countMode ?? 'perWindow') === 'cumulative';
  const times = cumulative ? allTimes.slice(1) : allTimes;

  const groups = Array.from(new Set(series.map((s) => s.group))).sort();
  const rows: RowData[] = [];
  for (const g of groups) {
    const groupSeries = series.filter((s) => s.group === g);
    let totals = seriesByRef(groupSeries, 'A');
    let errs = seriesByRef(groupSeries, 'B');
    if (cumulative) {
      totals = diffMap(totals, allTimes);
      errs = diffMap(errs, allTimes);
    }
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
    if (options.hideUnjudged && !cells.some((c) => c === 'ok' || c === 'bad')) {
      continue;
    }
    rows.push({ label: g, cells });
  }
  return { rows, times };
}

function diffMap(acum: Map<number, number>, times: number[]): Map<number, number> {
  const out = new Map<number, number>();
  for (let i = 1; i < times.length; i++) {
    const cur = acum.get(times[i]);
    const prev = acum.get(times[i - 1]);
    if (cur === undefined || prev === undefined) {
      continue;
    }
    const d = cur - prev;
    out.set(times[i], d >= 0 ? d : cur);
  }
  return out;
}

function seriesByRef(list: Series[], refId: string): Map<number, number> {
  const map = new Map<number, number>();
  for (const s of list) {
    if (s.refId !== refId) {
      continue;
    }
    for (let i = 0; i < s.times.length; i++) {
      map.set(s.times[i], s.values[i]);
    }
  }
  return map;
}
