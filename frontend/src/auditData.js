export const ARCHITECTURES = {
  superbot_vps: {
    id: 'superbot_vps',
    label: 'Superbot / Grokbot VPS Orchestration (7-Tj5qaOUbc)',
    summary:
      'Multi-agent Rust + CLI harness executing inside a shared Debian 13 VPS with isolated cloud sandboxes, host-clipboard bridges, and autonomous cron loops pushing directly to origin/main.',
    metrics: {
      memorySafety: 'High (Compiled Rust Daemon, CWE-119/416 mitigated)',
      referenceMonitor: 'Absent (Authorization coupled to LLM inference)',
      memoryPoisoningResistance: '12.5% (87.5% compromise rate without quote provenance)',
      observability: 'High (Multi-thread visual canvas & supervisor logs)',
    },
    nodes: [
      { id: 'user', label: 'Operator (MacBook)', group: 'trusted', x: 70, y: 180 },
      { id: 'cloudroom', label: 'Cloud Room Orchestrator', group: 'bridge', x: 220, y: 100 },
      { id: 'rust_sup', label: 'Rust Supervisor & Bus', group: 'compute', x: 220, y: 260 },
      { id: 'cli_harness', label: 'Claude/Codex CLI Harness', group: 'compute', x: 390, y: 180 },
      { id: 'vps_host', label: 'Shared Debian 13 VPS', group: 'vulnerable', x: 540, y: 100 },
      { id: 'git_main', label: 'GitHub origin/main (Auto-Push)', group: 'vulnerable', x: 540, y: 270 },
    ],
    links: [
      { source: 'user', target: 'cloudroom', label: 'SSH + Clipboard Bridge', risk: 'high' },
      { source: 'cloudroom', target: 'cli_harness', label: 'OAuth Token Delegation', risk: 'high' },
      { source: 'rust_sup', target: 'cli_harness', label: '3x/Day Cron Loop', risk: 'medium' },
      { source: 'cli_harness', target: 'vps_host', label: 'Unbounded Shell Exec', risk: 'high' },
      { source: 'cli_harness', target: 'git_main', label: 'Direct Main Commit', risk: 'high' },
    ],
  },
  nod_local: {
    id: 'nod_local',
    label: 'n8n nod Reference-Monitor & Provenance Architecture (VSrarL8Ki_A)',
    summary:
      'Local-first personal agent decoupling secret injection and payment authorization from the neural model, enforcing first-party utterance citations before committing episodic memory.',
    metrics: {
      memorySafety: 'Standard (Node/Linux Sandbox)',
      referenceMonitor: 'Enforced (Out-of-band Vault + CVV Hardware/User Gate)',
      memoryPoisoningResistance: '100.0% (0/216 adversarial emails persisted)',
      observability: 'Low (Single monolithic thread; hidden reasoning logs)',
    },
    nodes: [
      { id: 'user', label: 'First-Party User', group: 'trusted', x: 70, y: 180 },
      { id: 'ref_mon', label: 'Deterministic Reference Monitor', group: 'trusted', x: 230, y: 95 },
      { id: 'vault', label: 'Out-of-Band Credential Vault', group: 'trusted', x: 410, y: 75 },
      { id: 'llm_core', label: 'Pluggable LLM / Local Model', group: 'compute', x: 230, y: 265 },
      { id: 'prov_gate', label: 'Utterance Citation Gate', group: 'trusted', x: 410, y: 265 },
      { id: 'mem_db', label: '5-Schema Episodic Memory', group: 'trusted', x: 560, y: 180 },
    ],
    links: [
      { source: 'user', target: 'ref_mon', label: 'CVV / Explicit Approval', risk: 'safe' },
      { source: 'ref_mon', target: 'vault', label: 'Blind DOM Injection', risk: 'safe' },
      { source: 'user', target: 'llm_core', label: 'Authenticated Prompt', risk: 'safe' },
      { source: 'llm_core', target: 'prov_gate', label: 'Candidate Fact + Quote', risk: 'safe' },
      { source: 'prov_gate', target: 'mem_db', label: 'Verified Commit (93.2% Recall)', risk: 'safe' },
    ],
  },
};

export const COMPARISON_ROWS = [
  {
    dimension: 'Execution Substrate & Isolation',
    superbot: 'Shared Debian 13 VPS (8 vCPU, 15 GB RAM) running containerized bots + cloud sandboxes with host MacBook clipboard/SSH bridge (7-Tj5qaOUbc [00:05:43], [00:12:46]).',
    nod: 'Local-first user workstation or self-hosted Linux workspace with deterministic sandbox boundary (VSrarL8Ki_A [00:00:53], [00:05:19]).',
  },
  {
    dimension: 'Privilege Separation & Secret Handling',
    superbot: 'CLI harnesses inherit active OAuth/API sessions; agents execute autonomous shell and SSH commands directly (7-Tj5qaOUbc [00:18:46]).',
    nod: 'Anderson (1972) Reference Monitor: Vault injects credentials/cards into DOM without LLM visibility; CVV required per transaction (VSrarL8Ki_A [00:07:13], [00:08:15]).',
  },
  {
    dimension: 'Long-Term Memory & Poisoning Defense',
    superbot: 'Modular Markdown files (AGENTS.md) mutated asynchronously by parallel agents and cron loops without cryptographic provenance (7-Tj5qaOUbc [00:04:56]).',
    nod: '5-partition private notebook requiring verbatim first-party user quote per memory write; 93.2% LongMemEval score; 0/216 injection compromises (VSrarL8Ki_A [00:10:04], [00:11:25]).',
  },
  {
    dimension: 'Control-Loop Stability & Observability',
    superbot: 'Multi-thread visual dashboard with explicit effort routing (High/Extra-High/Max), but unreviewed auto-push loops risk positive-feedback drift (7-Tj5qaOUbc [00:51:07]).',
    nod: 'Hourly deduplication/archival worker; suffers from monolithic single-thread context and opaque background execution logs (VSrarL8Ki_A [00:12:20], [00:12:50]).',
  },
];

export const VERIFIED_CITATIONS = [
  {
    title: 'Anderson, J. P. (1972). Computer Security Technology Planning Study (ESD-TR-73-51) — Formal Reference Monitor Specification',
    url: 'https://csrc.nist.gov/publications/history/ande72.pdf',
  },
  {
    title: 'Saltzer, J. H., & Schroeder, M. D. (1975). The Protection of Information in Computer Systems. Proceedings of the IEEE, 63(9), 1278–1308',
    url: 'https://doi.org/10.1109/PROC.1975.9939',
  },
  {
    title: 'Greshake, K., et al. (2023). Not what you’ve signed up for: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection',
    url: 'https://arxiv.org/abs/2302.12173',
  },
  {
    title: 'Wu, D., et al. (2024). LongMemEval: Benchmarking Chat Assistants on Long-Term Interactive Memory',
    url: 'https://arxiv.org/abs/2410.10813',
  },
  {
    title: 'Klabnik, S., & Nichols, C. (2023). The Rust Programming Language (2nd ed.). No Starch Press. ISBN 978-1718503106',
    url: 'https://doc.rust-lang.org/book/',
  },
  {
    title: 'Astrom, K. J., & Murray, R. M. (2021). Feedback Systems: An Introduction for Scientists and Engineers (2nd ed.). Princeton University Press. ISBN 978-0691193984',
    url: 'https://fbsbook.org/',
  },
  {
    title: 'SQLite Official Documentation: Write-Ahead Logging (WAL) & FTS5 Extension',
    url: 'https://www.sqlite.org/wal.html',
  },
];
