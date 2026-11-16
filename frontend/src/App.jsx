import React, { useCallback, useEffect, useState } from 'react';
import { ARCHITECTURES, COMPARISON_ROWS, VERIFIED_CITATIONS } from './auditData';
import TopologyThreeScene from './components/TopologyThreeScene';
import ProvenanceD3Graph from './components/ProvenanceD3Graph';

const DEFAULT_ENDPOINTS = [
  'https://localhost',
  'http://127.0.0.1:8787',
  'http://localhost:8787',
];

export default function App() {
  const [selectedArchId, setSelectedArchId] = useState('nod_local');
  const [backendUrl, setBackendUrl] = useState(DEFAULT_ENDPOINTS[0]);
  const [customUrlInput, setCustomUrlInput] = useState(DEFAULT_ENDPOINTS[0]);
  const [backendHealth, setBackendHealth] = useState(null);

  const [category, setCategory] = useState('routines');
  const [sourceChannel, setSourceChannel] = useState('first_party_user');
  const [synthesizedFact, setSynthesizedFact] = useState(
    'Archive stale episodic notes older than 30 days via hourly background worker.'
  );
  const [userQuote, setUserQuote] = useState(
    'Run a worker every hour to archive notes that are out of date or duplicated.'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [memoryRows, setMemoryRows] = useState([]);
  const [ingestBanner, setIngestBanner] = useState('');

  const [vectorName, setVectorName] = useState('Indirect Prompt Injection via Malicious Invoice Email');
  const [payloadSummary, setPayloadSummary] = useState(
    'Embedded hidden instruction in IMAP HTML body attempting to exfiltrate vault credentials and commit SSH key.'
  );
  const [auditEvents, setAuditEvents] = useState([]);

  const probeBackend = useCallback(async (candidateUrls) => {
    for (const base of candidateUrls) {
      const trimmed = base.replace(/\/+$/, '');
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 1600);
        const res = await fetch(`${trimmed}/api/health`, { signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
          const data = await res.json();
          setBackendUrl(trimmed);
          setCustomUrlInput(trimmed);
          setBackendHealth(data);
          return trimmed;
        }
      } catch {
        // Continue probing next candidate endpoint
      }
    }
    setBackendHealth(null);
    return null;
  }, []);

  const fetchMemories = useCallback(
    async (activeBase, q = '') => {
      if (!activeBase) return;
      try {
        const res = await fetch(`${activeBase}/api/memory/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setMemoryRows(data.results || []);
        }
      } catch {
        // Ignore transient network errors
      }
    },
    []
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      const detected = await probeBackend(DEFAULT_ENDPOINTS);
      if (mounted && detected) {
        await fetchMemories(detected, '');
      }
    })();
    return () => {
      mounted = false;
    };
  }, [probeBackend, fetchMemories]);

  const handleManualProbe = async (e) => {
    e.preventDefault();
    const detected = await probeBackend([customUrlInput, ...DEFAULT_ENDPOINTS]);
    if (detected) {
      await fetchMemories(detected, searchQuery);
    }
  };

  const handleIngestMemory = async (e) => {
    e.preventDefault();
    if (!backendHealth) {
      const blocked =
        selectedArchId === 'nod_local' &&
        (sourceChannel !== 'first_party_user' || userQuote.trim().length < 8);
      const localEntry = {
        id: Date.now(),
        architecture_id: selectedArchId,
        category,
        synthesized_fact: synthesizedFact,
        source_channel: sourceChannel,
        user_quote_citation: userQuote || null,
        accepted: blocked ? 0 : 1,
        rejection_reason: blocked
          ? 'STATIC_SIMULATION_BLOCKED: Missing first-party utterance citation.'
          : null,
      };
      setMemoryRows((prev) => [localEntry, ...prev]);
      setIngestBanner(
        blocked
          ? 'Blocked by Reference Monitor (Static Mode)'
          : 'Committed in Static Mode (Start Docker backend for SQLite WAL + FTS5 persistence)'
      );
      return;
    }

    const res = await fetch(`${backendUrl}/api/memory/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        architecture_id: selectedArchId,
        category,
        synthesized_fact: synthesizedFact,
        source_channel: sourceChannel,
        user_quote_citation: userQuote,
      }),
    });
    const data = await res.json();
    setIngestBanner(
      data.accepted
        ? `SQLite WAL Commit #${data.id} (SHA-256: ${data.provenance_sha256 || 'NONE'})`
        : data.rejection_reason
    );
    await fetchMemories(backendUrl, searchQuery);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (backendHealth) {
      await fetchMemories(backendUrl, searchQuery);
    }
  };

  const handleSimulateAttack = async (e) => {
    e.preventDefault();
    if (!backendHealth) {
      const compromised = selectedArchId === 'superbot_vps';
      setAuditEvents((prev) => [
        {
          id: Date.now(),
          architecture_id: selectedArchId,
          vector_name: vectorName,
          compromised: compromised ? 1 : 0,
          control_theory_notes: compromised
            ? 'STATIC_AUDIT: Shared VPS & unverified main auto-push compromised.'
            : 'STATIC_AUDIT: Reference monitor & utterance provenance gate blocked payload.',
        },
        ...prev,
      ]);
      return;
    }

    const res = await fetch(`${backendUrl}/api/audit/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        architecture_id: selectedArchId,
        vector_name: vectorName,
        payload_summary: payloadSummary,
      }),
    });
    const data = await res.json();
    if (data.recent_events) {
      setAuditEvents(data.recent_events);
    }
  };

  const activeArch = ARCHITECTURES[selectedArchId];

  return (
    <div className="app-shell">
      <header className="top-header">
        <div className="title-block">
          <h1>Autonomous Agent Topology &amp; Trust-Boundary Audit</h1>
          <p>
            Comparative systems analysis of VPS Multi-Agent Orchestration (<code>7-Tj5qaOUbc</code>) vs.
            Deterministic Reference-Monitor &amp; Provenance-Gated Memory (<code>VSrarL8Ki_A</code>)
          </p>
        </div>

        <div className="backend-status-card">
          <div className="status-row">
            <span>Execution Plane:</span>
            {backendHealth ? (
              <span className="badge badge-online">
                CADDY TLS + SQLITE ({backendHealth.journal_mode.toUpperCase()} + FTS5)
              </span>
            ) : (
              <span className="badge badge-static">STATIC GITHUB PAGES MODE</span>
            )}
          </div>
          <form className="endpoint-controls" onSubmit={handleManualProbe}>
            <input
              type="text"
              value={customUrlInput}
              onChange={(e) => setCustomUrlInput(e.target.value)}
              aria-label="Caddy/Docker Backend URL"
            />
            <button type="submit">Probe</button>
          </form>
        </div>
      </header>

      <div className="mode-switcher">
        {Object.values(ARCHITECTURES).map((arch) => (
          <button
            key={arch.id}
            type="button"
            className={selectedArchId === arch.id ? 'active-tab' : ''}
            onClick={() => setSelectedArchId(arch.id)}
          >
            {arch.label}
          </button>
        ))}
      </div>

      <section className="grid-two-col">
        <div className="panel">
          <h2>3D WebGL Isolation &amp; Trust-Plane Topology (Three.js)</h2>
          <p className="panel-sub">{activeArch.summary}</p>
          <TopologyThreeScene architectureId={selectedArchId} />
        </div>

        <div className="panel">
          <h2>Information-Flow &amp; Provenance DAG (D3.js)</h2>
          <p className="panel-sub">
            Dashed crimson vectors indicate unbounded privilege delegation; solid emerald vectors enforce
            Anderson (1972) reference-monitor mediation.
          </p>
          <ProvenanceD3Graph architecture={activeArch} />
        </div>
      </section>

      <section className="panel" style={{ marginTop: '20px' }}>
        <h2>PhD Systems Evaluation Matrix</h2>
        <table className="audit-table">
          <thead>
            <tr>
              <th style={{ width: '22%' }}>Architectural Dimension</th>
              <th style={{ width: '39%' }}>Superbot / Grokbot VPS Pattern (7-Tj5qaOUbc)</th>
              <th style={{ width: '39%' }}>n8n nod Reference-Monitor Pattern (VSrarL8Ki_A)</th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON_ROWS.map((row) => (
              <tr key={row.dimension}>
                <td>
                  <strong>{row.dimension}</strong>
                </td>
                <td>{row.superbot}</td>
                <td>{row.nod}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="lab-grid">
        <div className="panel">
          <h2>SQLite WAL + FTS5 Provenance-Gated Memory Lab</h2>
          <p className="panel-sub">
            Tests episodic memory ingestion against the active architecture ({activeArch.id}). Under{' '}
            <code>nod_local</code>, writes without a verbatim first-party user quote are rejected.
          </p>
          <form className="form-stack" onSubmit={handleIngestMemory}>
            <label>
              Memory Schema Partition
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="identity">identity</option>
                <option value="preferences">preferences</option>
                <option value="social_graph">social_graph</option>
                <option value="routines">routines</option>
                <option value="procedural_skill">procedural_skill</option>
              </select>
            </label>

            <label>
              Ingestion Source Channel
              <select value={sourceChannel} onChange={(e) => setSourceChannel(e.target.value)}>
                <option value="first_party_user">first_party_user (Authenticated)</option>
                <option value="external_email">external_email (Untrusted IMAP)</option>
                <option value="scraped_web">scraped_web (Untrusted DOM)</option>
                <option value="cron_loop">cron_loop (Autonomous Worker)</option>
              </select>
            </label>

            <label>
              Synthesized Episodic Fact
              <input
                type="text"
                value={synthesizedFact}
                onChange={(e) => setSynthesizedFact(e.target.value)}
                required
              />
            </label>

            <label>
              Verbatim User Quote Citation (Required by nod_local)
              <input
                type="text"
                value={userQuote}
                onChange={(e) => setUserQuote(e.target.value)}
                placeholder="Leave blank to simulate indirect memory poisoning..."
              />
            </label>

            <button type="submit">Commit Candidate Memory</button>
          </form>

          {ingestBanner && (
            <div className="log-item" style={{ marginTop: '10px' }}>
              {ingestBanner}
            </div>
          )}

          <form
            className="endpoint-controls"
            style={{ marginTop: '14px' }}
            onSubmit={handleSearch}
          >
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="FTS5 lexical query (e.g., archive OR inbox)..."
            />
            <button type="submit">FTS5 Search</button>
          </form>

          <div className="log-list">
            {memoryRows.map((row) => (
              <div
                key={row.id}
                className={`log-item ${row.accepted ? 'blocked' : 'compromised'}`}
              >
                <div>
                  <strong>[{row.architecture_id}]</strong> ({row.category} / {row.source_channel}) —{' '}
                  {row.accepted ? 'COMMITTED' : 'REJECTED'}
                </div>
                <div>{row.synthesized_fact}</div>
                {row.rejection_reason && (
                  <div style={{ color: '#f43f5e', marginTop: '4px' }}>{row.rejection_reason}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <h2>Adversarial Reference-Monitor Audit Simulator</h2>
          <p className="panel-sub">
            Simulates indirect prompt injection (Greshake et al., 2023) and evaluates containment under
            the selected architecture.
          </p>
          <form className="form-stack" onSubmit={handleSimulateAttack}>
            <label>
              Attack Vector Classification
              <input
                type="text"
                value={vectorName}
                onChange={(e) => setVectorName(e.target.value)}
                required
              />
            </label>

            <label>
              Adversarial Payload Specification
              <textarea
                rows={3}
                value={payloadSummary}
                onChange={(e) => setPayloadSummary(e.target.value)}
                required
              />
            </label>

            <button type="submit">Execute Boundary Audit</button>
          </form>

          <div className="log-list">
            {auditEvents.map((ev) => (
              <div
                key={ev.id}
                className={`log-item ${ev.compromised ? 'compromised' : 'blocked'}`}
              >
                <div>
                  <strong>[{ev.architecture_id}]</strong> {ev.vector_name} —{' '}
                  {ev.compromised ? 'COMPROMISED' : 'CONTAINED'}
                </div>
                <div>{ev.control_theory_notes}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="citations-box">
        <strong>Verified Academic &amp; Official Documentation References</strong>
        <ul>
          {VERIFIED_CITATIONS.map((cite) => (
            <li key={cite.url}>
              <a href={cite.url} target="_blank" rel="noreferrer">
                {cite.title}
              </a>
            </li>
          ))}
        </ul>
      </footer>
    </div>
  );
}
