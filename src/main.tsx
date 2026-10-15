import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/poppins/latin-400.css';
import '@fontsource/poppins/latin-600.css';
import '@fontsource/poppins/latin-700.css';
import '@fontsource/roboto/latin-400.css';
import '@fontsource/roboto/latin-700.css';
import '@fontsource/rubik-bubbles/latin-400.css';
import CloudRoot from './CloudRoot';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CloudRoot />
  </React.StrictMode>,
);

