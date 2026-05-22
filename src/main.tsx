import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initDb } from './services/localDb';

console.log('Main.tsx executing...');

const startApp = async () => {
  console.log('startApp init...');
  try {
    // Show loading state if needed
    const root = document.getElementById('root');
    if (root) root.innerHTML = '<div style="background:#0f172a;color:white;height:100vh;display:flex;align-items:center;justify-content:center;font-family:sans-serif">Loading system...</div>';

    console.log('Initializing local database...');
    await initDb();
    console.log('Database initialized');
    
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    console.log('React rendered');
  } catch (error) {
    console.error('CRITICAL STARTUP ERROR:', error);
    // Explicitly trigger the global onerror handler with more info
    window.onerror?.('Startup failed: ' + (error instanceof Error ? error.message : String(error)), window.location.href, 0, 0, error as Error);
  }
};

startApp();
