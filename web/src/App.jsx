import { useState } from 'react';

export default function App() {
  const [status, setStatus] = useState('API health has not been checked.');
  const [checking, setChecking] = useState(false);

  async function checkHealth() {
    setChecking(true);
    setStatus('Checking API…');
    try {
      const response = await fetch('/api/v1/health', {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error('Health request failed');
      const data = await response.json();
      if (data.status !== 'ok' || typeof data.service !== 'string'
          || typeof data.version !== 'string') {
        throw new Error('Unexpected health response');
      }
      setStatus(`${data.service} API is responding · v${data.version}`);
    } catch {
      setStatus('API unavailable. Start the backend on port 8000 and retry.');
    } finally {
      setChecking(false);
    }
  }

  return (
    <main>
      <p className="eyebrow">Multimodal AI Hackathon 2026 · Track B</p>
      <h1>TRINETRA</h1>
      <p>Flood mapping and infrastructure access analysis.</p>
      <section aria-labelledby="status-heading">
        <h2 id="status-heading">Project setup</h2>
        <p>The application scaffold is ready. Satellite analysis is not available yet.</p>
        <button onClick={checkHealth} disabled={checking}>
          {checking ? 'Checking…' : 'Check API health'}
        </button>
        <p role="status" aria-live="polite">{status}</p>
      </section>
    </main>
  );
}
