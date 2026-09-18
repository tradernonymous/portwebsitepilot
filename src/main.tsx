import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { registerServiceWorker } from './lib/registerSw';
import { LangProvider } from './lib/lang';
import { Ambient } from './ui/fx/Ambient';
import { Doorway } from './ui/fx/Doorway';
import { LightTrail } from './ui/fx/LightTrail';
import './styles/tokens.css';
import './styles/base.css';
import './styles/ui.css';
import './styles/motifs.css';
import './styles/fx.css';
import './styles/gate.css';
import './styles/hall.css';
import './styles/atrium.css';
import './styles/room.css';
import './styles/reader.css';
import './styles/video.css';
import './styles/walk.css';
import './styles/flat.css';
import './styles/gallery.css';
import './styles/cursor.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root missing from index.html');

createRoot(container).render(
  <StrictMode>
    <LangProvider>
      {/* the air of the page — outside App, so it survives every route */}
      <Ambient />
      {/* the light that travels with the visitor, through the door and across the room */}
      <LightTrail />
      {/* and the door every room change passes through */}
      <Doorway />
      <App />
    </LangProvider>
  </StrictMode>,
);

registerServiceWorker();
