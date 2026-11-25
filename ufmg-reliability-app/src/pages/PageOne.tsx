import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { LinkButton, useStyles2 } from '@grafana/ui';
import { PluginPage } from '@grafana/runtime';

const VARIAVEIS: Array<[string, string, string]> = [
  ['$window', 'Duração da janela. Vai no intervalo mínimo da consulta, para o passo ser igual à janela', '5m (proposta), 1d (HF)'],
  ['$min_req', 'Volume mínimo para a janela ser julgada', '100'],
  ['$tau_ms ou $tau_s', 'τ: acima disso a requisição é lenta', '200 ms'],
  ['$slo_erro', 'Meta de erro por janela (R*_erro)', '0,99'],
  ['$slo_lat', 'Meta de latência por janela (R*_lat)', '0,95'],
  ['$modo_falha', 'ambos, erro ou latencia', 'ambos'],
  ['$censura_corta', 'Janela não julgada corta o episódio (sim/nao)', 'sim'],
  ['$agrupar', 'Rótulo das linhas do quadro de janelas', 'server_address, componente, job'],
];

function OverviewPage() {
  const s = useStyles2(getStyles);

  return (
    <PluginPage>
      <div className={s.root}>
        <p className={s.lead}>
          O plugin calcula, em cima de métricas no formato do OpenTelemetry, os índices de confiabilidade da proposta:
          R por requisição (modelo de Nelson), disponibilidade em relação ao SLO, MTBF e MTTR. Tudo é calculado por
          janela de tempo, e os parâmetros mudam conforme o sistema avaliado.
        </p>

        <h3>De onde vem o dado</h3>
        <p>
          <code>fonte → conversor → Prometheus → plugin</code>. O conversor de cada fonte grava o mesmo contrato: o
          contador <code>http_server_request_duration_seconds_count</code>, o mesmo contador com{' '}
          <code>error_type</code> para as falhas, e a latência como baldes <code>le</code> ou como percentil da janela.
          Os painéis recebem três consultas: A = total, B = erros, C = latência.
        </p>

        <h3>Critério de falha</h3>
        <p>
          Uma requisição falha por erro (5xx, ou o que a fonte marca em <code>error_type</code>) ou por lentidão (duração
          acima de τ). A janela fica ruim quando R_erro &lt; R*_erro ou R_lat &lt; R*_lat. Janela com menos requisições
          que o mínimo não é julgada: não conta como boa nem como ruim e, por padrão, separa um episódio do outro.
        </p>

        <h3>Índices</h3>
        <ul className={s.list}>
          <li>
            <strong>R = 1 − f/n</strong> no período e por janela, nos modos erro e latência.
          </li>
          <li>
            <strong>Disponibilidade A</strong>: janelas boas / janelas julgadas.
          </li>
          <li>
            <strong>MTBF e MTTR</strong>: episódio é um trecho de janelas ruins seguidas. MTBF = janelas boas /
            episódios; MTTR = janelas ruins / episódios. Vale A = MTBF / (MTBF + MTTR).
          </li>
        </ul>

        <h3>O que se configura</h3>
        <p>Variável do dashboard &gt; opção do painel &gt; padrão da proposta.</p>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Variável</th>
              <th>O que faz</th>
              <th>Padrão / exemplo</th>
            </tr>
          </thead>
          <tbody>
            {VARIAVEIS.map(([v, o, p]) => (
              <tr key={v}>
                <td>
                  <code>{v}</code>
                </td>
                <td>{o}</td>
                <td>{p}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className={s.actions}>
          <LinkButton icon="apps" href="/dashboards?query=Confiabilidade">
            Abrir dashboards de confiabilidade
          </LinkButton>
        </div>
      </div>
    </PluginPage>
  );
}

export default OverviewPage;

const getStyles = (theme: GrafanaTheme2) => ({
  root: css`
    max-width: 860px;
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
  table: css`
    width: 100%;
    margin-bottom: ${theme.spacing(2)};
    th,
    td {
      padding: ${theme.spacing(0.5, 1)};
      border-bottom: 1px solid ${theme.colors.border.weak};
      text-align: left;
      vertical-align: top;
    }
  `,
  actions: css`
    display: flex;
    gap: ${theme.spacing(1)};
    margin-top: ${theme.spacing(3)};
  `,
});
