import React from 'react';
import { render, screen } from '@testing-library/react';
import { PluginType } from '@grafana/data';
import AppConfig, { AppConfigProps } from './AppConfig';
import { testIds } from 'components/testIds';

describe('Components/AppConfig', () => {
  let props: AppConfigProps;

  beforeEach(() => {
    jest.resetAllMocks();
    props = {
      plugin: {
        meta: {
          id: 'ufmg-reliability-app',
          name: 'Reliability-App',
          type: PluginType.app,
          enabled: true,
          jsonData: {},
        },
      },
      query: {},
    } as unknown as AppConfigProps;
  });

  test('renderiza os campos de SLO e janela', () => {
    // @ts-ignore - tests only exercise the config form
    render(<AppConfig plugin={props.plugin} query={props.query} />);
    expect(screen.queryByTestId(testIds.appConfig.sloErro)).toBeInTheDocument();
    expect(screen.queryByTestId(testIds.appConfig.sloLat)).toBeInTheDocument();
    expect(screen.queryByTestId(testIds.appConfig.tauMs)).toBeInTheDocument();
    expect(screen.queryByTestId(testIds.appConfig.window)).toBeInTheDocument();
    expect(screen.queryByTestId(testIds.appConfig.minRequests)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /salvar/i })).toBeInTheDocument();
  });
});
