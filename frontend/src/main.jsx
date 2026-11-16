import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

/**
 * Display a visible diagnostic when an uncaught browser error occurs.
 *
 * The panel is deliberately non-destructive: it does not replace the
 * application root, so a graphics or optional-feature error cannot hide
 * the rest of the interface.
 */
function reportBrowserFailure(kind, message) {
  const safeMessage =
    typeof message === 'string' && message.trim()
      ? message
      : 'No additional error message was provided.';

  console.error(`[Agent Topology Auditor] ${kind}:`, safeMessage);

  let panel = document.getElementById('runtime-error-panel');

  if (!panel) {
    panel = document.createElement('section');
    panel.id = 'runtime-error-panel';
    panel.setAttribute('role', 'alert');
    panel.setAttribute('aria-live', 'assertive');

    Object.assign(panel.style, {
      position: 'fixed',
      zIndex: '2147483647',
      left: '12px',
      right: '12px',
      bottom: '12px',
      maxHeight: '35vh',
      overflow: 'auto',
      padding: '14px',
      border: '1px solid #f43f5e',
      borderRadius: '8px',
      background: '#240d17',
      color: '#ffe4e6',
      fontFamily: 'ui-monospace, monospace',
      fontSize: '12px',
      whiteSpace: 'pre-wrap',
      overflowWrap: 'anywhere',
      boxShadow: '0 8px 32px rgba(0,0,0,.5)',
    });

    document.body.appendChild(panel);
  }

  const entry = document.createElement('div');
  entry.style.marginBottom = '8px';
  entry.textContent = `${kind}: ${safeMessage}`;
  panel.appendChild(entry);
}

/**
 * Report JavaScript exceptions that are not handled by React.
 */
window.addEventListener('error', (event) => {
  reportBrowserFailure(
    'Uncaught browser error',
    event.message || event.error?.message || 'Unknown browser error'
  );
});

/**
 * Report rejected promises that are not caught by application code.
 */
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  reportBrowserFailure(
    'Unhandled promise rejection',
    reason?.message || String(reason)
  );
});

/**
 * React error boundary.
 *
 * A component render failure is converted into a visible diagnostic screen
 * rather than leaving the user with an unexplained dark page.
 */
class ApplicationErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error(
      '[Agent Topology Auditor] React component failure:',
      error,
      errorInfo
    );
  }

  render() {
    if (this.state.hasError) {
      const message =
        this.state.error?.message || 'Unknown React rendering error';

      return (
        <main
          style={{
            minHeight: '100vh',
            boxSizing: 'border-box',
            padding: '32px',
            background: '#0b0f17',
            color: '#e6edf7',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <h1 style={{ color: '#f43f5e' }}>
            Application rendering failed
          </h1>

          <p>
            React loaded, but a component failed while rendering.
          </p>

          <pre
            style={{
              padding: '16px',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              background: '#121826',
              border: '1px solid #f43f5e',
              borderRadius: '8px',
              color: '#fecdd3',
            }}
          >
            {message}
          </pre>

          <p>
            Open the browser developer console for the full component stack.
          </p>

          <button
            type="button"
            onClick={() => window.location.reload()}
          >
            Reload application
          </button>
        </main>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  reportBrowserFailure(
    'React mount failure',
    'The HTML document does not contain an element with id="root".'
  );
} else {
  try {
    const root = ReactDOM.createRoot(rootElement);

    root.render(
      <React.StrictMode>
        <ApplicationErrorBoundary>
          <App />
        </ApplicationErrorBoundary>
      </React.StrictMode>
    );

    rootElement.dataset.reactMountRequested = 'true';
  } catch (error) {
    reportBrowserFailure(
      'React initialization failure',
      error?.message || String(error)
    );
  }
}
