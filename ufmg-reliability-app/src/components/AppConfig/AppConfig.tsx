import React, { ChangeEvent, useState } from 'react';
import { lastValueFrom } from 'rxjs';
import { css } from '@emotion/css';
import { AppPluginMeta, GrafanaTheme2, PluginConfigPageProps, PluginMeta } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Button, Field, FieldSet, Input, useStyles2 } from '@grafana/ui';
import { testIds } from '../testIds';

type AppPluginSettings = {
  datasourceUid?: string;
  slo_erro?: number;
  slo_lat?: number;
  tau_ms?: number;
  window?: string;
  min_requests?: number;
};

type State = {
  datasourceUid: string;
  slo_erro: string;
  slo_lat: string;
  tau_ms: string;
  window: string;
  min_requests: string;
};

export interface AppConfigProps extends PluginConfigPageProps<AppPluginMeta<AppPluginSettings>> {}

const AppConfig = ({ plugin }: AppConfigProps) => {
  const s = useStyles2(getStyles);
  const { enabled, pinned, jsonData } = plugin.meta;
  const [state, setState] = useState<State>({
    datasourceUid: jsonData?.datasourceUid ?? 'webstore-metrics',
    slo_erro: String(jsonData?.slo_erro ?? 0.99),
    slo_lat: String(jsonData?.slo_lat ?? 0.95),
    tau_ms: String(jsonData?.tau_ms ?? 200),
    window: jsonData?.window ?? '5m',
    min_requests: String(jsonData?.min_requests ?? 100),
  });

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    setState({ ...state, [event.target.name]: event.target.value });
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updatePluginAndReload(plugin.meta.id, {
      enabled,
      pinned,
      jsonData: {
        datasourceUid: state.datasourceUid.trim(),
        slo_erro: Number(state.slo_erro),
        slo_lat: Number(state.slo_lat),
        tau_ms: Number(state.tau_ms),
        window: state.window.trim(),
        min_requests: Number(state.min_requests),
      },
    });
  };

  return (
    <form onSubmit={onSubmit}>
      <FieldSet label="Padrões de referência da proposta">
        <p className={s.note}>
          Estes valores ficam guardados como referência do grupo. Quem decide a conta é cada painel: as opções do
          painel e, por cima delas, as variáveis do dashboard (<code>$window</code>, <code>$min_req</code>,{' '}
          <code>$tau_ms</code> ou <code>$tau_s</code>, <code>$slo_erro</code>, <code>$slo_lat</code>,{' '}
          <code>$modo_falha</code>, <code>$censura_corta</code>, <code>$agrupar</code>). Veja a página Visão geral.
        </p>
        <Field label="Datasource UID" description="UID do datasource Prometheus com os sinais OpenTelemetry (padrão: webstore-metrics)">
          <Input
            width={40}
            name="datasourceUid"
            value={state.datasourceUid}
            data-testid={testIds.appConfig.datasourceUid}
            onChange={onChange}
          />
        </Field>

        <Field label="SLO erro" description="Confiabilidade mínima por janela no modo erro (0–1)" className={s.marginTop}>
          <Input width={20} name="slo_erro" value={state.slo_erro} data-testid={testIds.appConfig.sloErro} onChange={onChange} />
        </Field>

        <Field label="SLO latência" description="Fração mínima por janela de requisições abaixo de τ (0–1)" className={s.marginTop}>
          <Input width={20} name="slo_lat" value={state.slo_lat} data-testid={testIds.appConfig.sloLat} onChange={onChange} />
        </Field>

        <Field label="τ (ms)" description="Limite para a latência percebida como rápida (ex.: 200)" className={s.marginTop}>
          <Input width={20} name="tau_ms" value={state.tau_ms} data-testid={testIds.appConfig.tauMs} onChange={onChange} />
        </Field>

        <Field label="Janela" description="Duração da janela de agregação (formato Prom range, ex.: 5m, 15m, 1h)" className={s.marginTop}>
          <Input width={20} name="window" value={state.window} data-testid={testIds.appConfig.window} onChange={onChange} />
        </Field>

        <Field label="Volume mínimo" description="Mínimo de requisições para a janela entrar na amostra" className={s.marginTop}>
          <Input width={20} name="min_requests" value={state.min_requests} data-testid={testIds.appConfig.minRequests} onChange={onChange} />
        </Field>

        <div className={s.marginTop}>
          <Button type="submit" data-testid={testIds.appConfig.submit}>
            Salvar
          </Button>
        </div>
      </FieldSet>
    </form>
  );
};

export default AppConfig;

const getStyles = (theme: GrafanaTheme2) => ({
  note: css`
    opacity: 0.8;
    max-width: 720px;
  `,
  marginTop: css`
    margin-top: ${theme.spacing(2)};
  `,
});

const updatePluginAndReload = async (pluginId: string, data: Partial<PluginMeta<AppPluginSettings>>) => {
  try {
    await updatePlugin(pluginId, data);
    window.location.reload();
  } catch (e) {
    console.error('Error while updating the plugin', e);
  }
};

const updatePlugin = async (pluginId: string, data: Partial<PluginMeta>) => {
  const response = await getBackendSrv().fetch({
    url: `/api/plugins/${pluginId}/settings`,
    method: 'POST',
    data,
  });
  return lastValueFrom(response);
};
