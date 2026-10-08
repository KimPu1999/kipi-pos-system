import React from 'react';
import { createRoot } from 'react-dom/client';
import Auth from './Auth';
import { api } from './api';
import { applySettings, type Settings } from './systemSettings';
void api<Settings>('/settings')
  .then(applySettings)
  .catch(() => {});
import './styles.css';
import './customer-dashboard.css';
import './theme.css';
import './responsive.css';
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Auth />
  </React.StrictMode>,
);
