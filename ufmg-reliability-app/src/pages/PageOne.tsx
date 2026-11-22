import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { LinkButton, useStyles2 } from '@grafana/ui';
import { PluginPage } from '@grafana/runtime';

function OverviewPage() {
  const s = useStyles2(getStyles);

  return (
    <PluginPage>
      <div className={s.root}>
        <p className={s.lead}>
          Este plugin mostra, em cima dos sinais OpenTelemetry, os índices de confiabilidade
          descritos na proposta: R_erro, R_lat, disponibilidade A, MTBF e MTTR.
          Cada medida é calculada por janela de tempo.
        </p>

        <h3>Critério de falha</h3>
        <p>
          Uma requisição falha quando o código de resposta é 5xx (modo <em>erro</em>) ou quando
          sua duração ultrapassa τ (modo <em>lentidão</em>, padrão 200&nbsp;ms). O tempo é dividido
          em janelas; só entram janelas com volume mínimo (padrão 100 req), para que uma única
          falha não derrube o índice.
        </p>

        <h3>Índices</h3>
        <ul className={s.list}>
          <li>
            <strong>I1 — R = 1 − f/n</strong> por janela, no modo erro (<code>R_erro</code>) e no
            modo lentidão (<code>R_lat</code>). Aproxima a indisponibilidade percebida pelo
            usuário.
          </li>
          <li>
            <strong>I2 — Disponibilidade A</strong>: fração de janelas em que ambos
            {' '}<code>R_erro ≥ 0,99</code> e <code>R_lat ≥ 0,95</code>. SLOs fixos, declarados
            antes da coleta.
          </li>
          <li>
            <strong>I3 — MTBF e MTTR</strong>: calculados a partir de episódios de janelas ruins
            consecutivas. MTBF = total de janelas boas / nº de episódios. MTTR = duração média
            de episódio. Vale a identidade <code>A = MTBF / (MTBF + MTTR)</code>.
          </li>
        </ul>

        <h3>Dataset</h3>
        <p>
          O backfill local (2024-01-01 → 2024-02-06, 5000 requisições reais) está em resolução
          de <strong>1h</strong>. Para a janela de 5&nbsp;min da metodologia, é preciso uma
          coleta nova com Prometheus coletando em tempo real. O dashboard provisionado usa 1h
          por padrão.
        </p>

        <h3>Fontes</h3>
        <ul className={s.list}>
          <li><code>docs/proposal/proposal.tex</code> e <code>metodologia.tex</code></li>
          <li>Motor Python de referência: <code>motor.py</code> (episódios, Weibull)</li>
          <li>Backfill: <code>data/reliability-backfill/README.md</code></li>
        </ul>

        <div className={s.actions}>
          <LinkButton icon="apps" href="/dashboards?query=reliability">
            Abrir dashboard de confiabilidade
          </LinkButton>
          <LinkButton icon="cog" variant="secondary" href="/plugins/ufmg-reliability-app">
            Ajustar SLOs
          </LinkButton>
        </div>
      </div>
    </PluginPage>
  );
}

export default OverviewPage;

const getStyles = (theme: GrafanaTheme2) => ({
  root: css`
    max-width: 820px;
    line-height: 1.5;
  `,
  lead: css`
    font-size: 15px;
    margin-bottom: ${theme.spacing(2)};
  `,
  list: css`
    padding-left: ${theme.spacing(3)};
    li {
      margin-bottom: ${theme.spacing(1)};
    }
  `,
  actions: css`
    display: flex;
    gap: ${theme.spacing(1)};
    margin-top: ${theme.spacing(3)};
  `,
});
