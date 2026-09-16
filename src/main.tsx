import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { LangProvider } from './lib/lang';
import './styles.css';
import './styles/tokens.css';
import './styles/fx.css';
import './styles/gate.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root missing from index.html');

createRoot(container).render(
  <StrictMode>
    <LangProvider>
      <App />
    </LangProvider>
  </StrictMode>,
);
