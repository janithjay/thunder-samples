// Copyright 2026 The ThunderID Authors
// SPDX-License-Identifier: Apache-2.0

import {ThunderIDProvider} from '@thunderid/react';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import ConfigNotice from './components/ConfigNotice';
import './styles/index.css';
import './styles/App.css';

const baseUrl = import.meta.env.VITE_THUNDERID_BASE_URL;
const clientId = import.meta.env.VITE_THUNDERID_CLIENT_ID;
// Optional. Space separated; when not set, the SDK requests its default scopes (openid profile).
const scopes = import.meta.env.VITE_THUNDERID_SCOPES?.split(/\s+/).filter(Boolean);

const missingEnvVars: string[] = [
  !baseUrl && 'VITE_THUNDERID_BASE_URL',
  !clientId && 'VITE_THUNDERID_CLIENT_ID',
].filter((key): key is string => Boolean(key));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {baseUrl && clientId ? (
      <ThunderIDProvider baseUrl={baseUrl} clientId={clientId} scopes={scopes}>
        <App />
      </ThunderIDProvider>
    ) : (
      <ConfigNotice missing={missingEnvVars} />
    )}
  </StrictMode>,
);
