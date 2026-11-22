import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AppRootProps, PluginType } from '@grafana/data';
import { render, waitFor } from '@testing-library/react';
import App from './App';

describe('Components/App', () => {
  let props: AppRootProps;

  beforeEach(() => {
    jest.resetAllMocks();
    props = {
      basename: 'a/ufmg-reliability-app',
      meta: {
        id: 'ufmg-reliability-app',
        name: 'Reliability-App',
        type: PluginType.app,
        enabled: true,
        jsonData: {},
      },
      query: {},
      path: '',
      onNavChanged: jest.fn(),
    } as unknown as AppRootProps;
  });

  test('renderiza a página de visão geral', async () => {
    const { queryByText } = render(
      <MemoryRouter>
        <App {...props} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(queryByText(/índices de confiabilidade/i)).toBeInTheDocument(), { timeout: 2000 });
  });
});
