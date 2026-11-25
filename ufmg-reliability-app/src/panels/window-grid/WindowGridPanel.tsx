import React, { useEffect, useRef } from 'react';
import { PanelProps, dateTimeFormat } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { WindowGridOptions } from './types';
import { buildGrid, Cell } from './grid';
import { applyOverrides } from '../../reliability/overrides';

interface Props extends PanelProps<WindowGridOptions> {}

const LABEL_W = 190;
const COR: Record<Cell, string | null> = {
  ok: '#73bf69',
  bad: '#f2495c',
  censored: '#8e8e8e',
  empty: null,
};

export function WindowGridPanel({ data, options: painel, width, height, timeZone, replaceVariables }: Props) {
  const styles = useStyles2(getStyles);
  const options = applyOverrides(painel, replaceVariables);
  const { rows, times, stepMs } = buildGrid(data, options);

  if (rows.length === 0) {
    return (
      <div className={styles.empty}>
        Sem séries. Esperado, agrupado pelo rótulo {options.rowLabel}: A = total, B = erros e, se houver, C = latência.
      </div>
    );
  }

  const canvasW = Math.max(50, Math.floor(width - LABEL_W - 32));
  const cellH = Math.max(10, Math.min(28, Math.floor((height - 48) / rows.length) - 2));
  const fmt = (t: number) => dateTimeFormat(t, { timeZone, format: 'DD/MM/YYYY HH:mm' });

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        {times.length > 0 ? (
          <>
            <span>{fmt(stepMs > 0 ? times[0] - stepMs : times[0])}</span>
            <span>→</span>
            <span>{fmt(times[times.length - 1])}</span>
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
            <RowCanvas
              cells={row.cells}
              width={canvasW}
              height={cellH}
              label={row.label}
              times={times}
              stepMs={stepMs}
              fmt={fmt}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

const NOME_ESTADO: Record<Cell, string> = {
  ok: 'cumpriu a meta',
  bad: 'não cumpriu a meta (erro ou latência, conforme o modo de falha)',
  censored: 'menos requisições que o mínimo',
  empty: 'sem tráfego',
};

function RowCanvas(props: {
  cells: Cell[];
  width: number;
  height: number;
  label: string;
  times: number[];
  stepMs: number;
  fmt: (t: number) => string;
}) {
  const { cells, width, height, label, times, stepMs, fmt } = props;
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) {
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const n = cells.length;
    const w = width / Math.max(1, n);
    const gap = w >= 4 ? 1 : 0;
    for (const passo of ['fundo', 'falhas'] as const) {
      for (let i = 0; i < n; i++) {
        const c = cells[i];
        const cor = COR[c];
        if (!cor || (passo === 'fundo') === (c === 'bad')) {
          continue;
        }
        const x = i * w;
        const largura = c === 'bad' ? Math.max(2, w - gap) : w - gap;
        ctx.fillStyle = cor;
        ctx.fillRect(x, 0, largura, height);
      }
    }
  }, [cells, width, height]);

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.min(
      cells.length - 1,
      Math.max(0, Math.floor(((e.clientX - rect.left) / rect.width) * cells.length))
    );
    const fim = times[i] ?? 0;
    const inicio = stepMs > 0 ? fim - stepMs : fim;
    e.currentTarget.title = `${label} — ${fmt(inicio)} → ${fmt(fim)} — ${NOME_ESTADO[cells[i]]}`;
  };

  return <canvas ref={ref} style={{ width, height, display: 'block' }} onMouseMove={onMove} />;
}

function Legend() {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.legend}>
      <LegendDot cls={styles.ok} label="ok" />
      <LegendDot cls={styles.bad} label="falhou" />
      <LegendDot cls={styles.censored} label="não julgada (abaixo do mínimo)" />
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
    width: 180px;
    flex-shrink: 0;
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
