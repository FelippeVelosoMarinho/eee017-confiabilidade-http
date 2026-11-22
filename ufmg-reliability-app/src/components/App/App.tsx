import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppRootProps } from '@grafana/data';

const OverviewPage = React.lazy(() => import('../../pages/PageOne'));

function App(_props: AppRootProps) {
  return (
    <Routes>
      <Route path="*" element={<OverviewPage />} />
    </Routes>
  );
}

export default App;
