import { DataFrame, FieldType, getFieldDisplayName, PanelData } from '@grafana/data';

export interface ExtractedSeries {
  times: number[];
  totalByFrame: Map<string, number[]>;
  errorsByFrame: Map<string, number[]>;
  latencyFailuresByFrame: Map<string, number[]>;
  bucketsByFrame: Map<string, Array<{ le: number; values: number[] }>>;
}

interface NumericSeries {
  times: number[];
  values: number[];
  refId?: string;
  displayName: string;
  labels: Record<string, string>;
}

function readNumeric(frame: DataFrame): NumericSeries | null {
  const timeField = frame.fields.find((f) => f.type === FieldType.time);
  const valueField = frame.fields.find((f) => f.type === FieldType.number);
  if (!timeField || !valueField) {
    return null;
  }
  return {
    times: Array.from(timeField.values as unknown as ArrayLike<number>),
    values: Array.from(valueField.values as unknown as ArrayLike<number>),
    refId: frame.refId,
    displayName: getFieldDisplayName(valueField, frame),
    labels: valueField.labels ?? {},
  };
}

export function framesByRefId(data: PanelData): Record<string, DataFrame[]> {
  const out: Record<string, DataFrame[]> = {};
  for (const f of data.series) {
    const key = f.refId ?? '';
    (out[key] ??= []).push(f);
  }
  return out;
}

export function singleSeries(frames: DataFrame[] | undefined): NumericSeries | null {
  if (!frames || frames.length === 0) {
    return null;
  }
  return readNumeric(frames[0]);
}

export function bucketSeries(frames: DataFrame[] | undefined): Array<{ le: number; values: number[]; times: number[] }> {
  if (!frames) {
    return [];
  }
  const out: Array<{ le: number; values: number[]; times: number[] }> = [];
  for (const frame of frames) {
    const read = readNumeric(frame);
    if (!read) {
      continue;
    }
    const leRaw = read.labels.le ?? '';
    const le = leRaw === '+Inf' ? Infinity : Number(leRaw);
    if (!Number.isFinite(le) && le !== Infinity) {
      continue;
    }
    out.push({ le, values: read.values, times: read.times });
  }
  return out;
}

export function alignToReference(
  reference: number[],
  other: NumericSeries | null,
  fill = 0,
): number[] {
  if (!other) {
    return reference.map(() => fill);
  }
  const map = new Map<number, number>();
  for (let i = 0; i < other.times.length; i++) {
    map.set(other.times[i], other.values[i]);
  }
  return reference.map((t) => map.get(t) ?? fill);
}

export function perWindowFromCumulative(values: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    out.push(d >= 0 ? d : values[i]);
  }
  return out;
}
