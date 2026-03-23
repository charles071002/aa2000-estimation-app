import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './components/00_App';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  // Fail-safe: avoid a total blank screen if the mount node is missing.
  // React rendering will be skipped; the HTML will stay visible.
  // eslint-disable-next-line no-console
  console.error("Could not find root element to mount to");
}

if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  try {
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (err) {
    // Fail-safe: show an explicit error instead of a white screen.
    // eslint-disable-next-line no-console
    console.error("App failed to render:", err);
    root.render(
      <React.StrictMode>
        <div style={{ padding: 16, color: '#b91c1c', fontFamily: 'Arial' }}>
          Error: the app crashed while rendering. Open the browser console for details.
        </div>
      </React.StrictMode>
    );
  }
}
