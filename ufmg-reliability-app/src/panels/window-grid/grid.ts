import { DataFrame, FieldType, getFieldDisplayName } from '@grafana/data';
import { WindowGridOptions } from './types';
import { buildWindows, inferStep, regularAxis, TimeValues } from '../../reliability/engine';
import { windowStates } from '../../reliability/indices';

export type Cell = 'ok' | 'bad' | 'censored' | 'empty';

export interface RowData {
  label: string;
  cells: Cell[];
}

interface Series extends TimeValues {
  group: string;
  refId: string;
  le?: number;
}

function readFrame(frame: DataFrame, labelKey: string): Series | null {
  const timeField = frame.fields.find((f) => f.type === FieldType.time);
  const valueField = frame.fields.find((f) => f.type === FieldType.number);
  if (!timeField || !valueField) {
    return null;
  }
  const labels = valueField.labels ?? {};
  const group = labels[labelKey] ?? getFieldDisplayName(valueField, frame);
  let le: number | undefined;
  if (labels.le !== undefined) {
    le = labels.le === '+Inf' ? Infinity : Number(labels.le);
  }
  return {
    times: Array.from(timeField.values as unknown as ArrayLike<number>),
    values: Array.from(valueField.values as unknown as ArrayLike<number>),
    group,
    refId: frame.refId ?? '',
    le,
  };
}

function merge(list: Series[]): TimeValues | null {
  if (list.length === 0) {
    return null;
  }
  if (list.length === 1) {
    return list[0];
  }
  const map = new Map<number, number>();
  for (const s of list) {
    for (let i = 0; i < s.times.length; i++) {
      map.set(s.times[i], (map.get(s.times[i]) ?? 0) + s.values[i]);
    }
  }
  const times = Array.from(map.keys()).sort((a, b) => a - b);
  return { times, values: times.map((t) => map.get(t)!) };
}

/**
 * Uma linha por valor do rótulo escolhido. Consultas esperadas, todas agrupadas pelo rótulo:
 * A = total, B = erros, C = latência (baldes com `le` ou percentil da janela).
 * A latência entra no julgamento conforme o modo de falha, como no painel de resumo.
 */
export function buildGrid(data: { series: DataFrame[] }, options: WindowGridOptions) {
  const series: Series[] = [];
  for (const f of data.series) {
    const s = readFrame(f, options.rowLabel);
    if (s) {
      series.push(s);
    }
  }
  const totals = series.filter((s) => s.refId === 'A');
  if (totals.length === 0) {
    return { rows: [] as RowData[], times: [] as number[], stepMs: 0 };
  }

  const timeSet = new Set<number>();
  for (const s of totals) {
    for (const t of s.times) {
      timeSet.add(t);
    }
  }
  const allTimes = Array.from(timeSet).sort((a, b) => a - b);
  const stepMs = inferStep(allTimes);
  const axis = regularAxis(allTimes, stepMs);

  const engine = {
    sloErro: options.sloErro,
    sloLat: options.sloLat,
    tauMs: options.tauMs,
    minRequests: options.minRequests,
    countMode: options.countMode ?? 'perWindow',
    latencyMode: options.latencyMode ?? 'histogram',
    failureMode: options.failureMode ?? 'both',
    censoredBreaksEpisode: true,
  };

  const groups = Array.from(new Set(totals.map((s) => s.group))).sort();
  const rows: RowData[] = [];
  let times: number[] = [];
  for (const g of groups) {
    const doGrupo = series.filter((s) => s.group === g);
    const c = doGrupo.filter((s) => s.refId === 'C');
    const built = buildWindows(
      {
        total: merge(doGrupo.filter((s) => s.refId === 'A')),
        errors: merge(doGrupo.filter((s) => s.refId === 'B')),
        buckets:
          engine.latencyMode === 'histogram'
            ? c.filter((s) => s.le !== undefined).map((s) => ({ le: s.le!, times: s.times, values: s.values }))
            : undefined,
        p95: engine.latencyMode === 'p95' ? (c[0] ?? null) : undefined,
      },
      engine,
      axis
    );
    let mode = engine.failureMode;
    if (!built.latencyAvailable && mode === 'both') {
      mode = 'error';
    }
    const states = windowStates(built.rows, mode);
    const cells: Cell[] = built.rows.map((r, i) =>
      r.empty ? 'empty' : r.censored ? 'censored' : states[i] ? 'bad' : 'ok'
    );
    times = built.rows.map((r) => r.t);
    if (options.hideUnjudged && !cells.some((x) => x === 'ok' || x === 'bad')) {
      continue;
    }
    rows.push({ label: g, cells });
  }
  return { rows, times, stepMs };
}
