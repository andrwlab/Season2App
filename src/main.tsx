import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './AuthContext';
import { SeasonProvider } from './hooks/useSeason';
import './styles/theme.css';
import './styles/glass.css';
import './index.css';
import './styles/global.css';


ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <SeasonProvider>
        <App />
      </SeasonProvider>
    </AuthProvider>
  </React.StrictMode>
);
