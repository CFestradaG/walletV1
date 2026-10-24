// In dev/preview environment, define App Check debug token on window before Firebase loads
if (typeof window !== 'undefined') {
  (window as any).FIREBASE_APPCHECK_DEBUG_TOKEN =
    import.meta.env.VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN || 'CC0CA449-E31D-4869-BC32-2C42DF2C7251';
}

import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);
