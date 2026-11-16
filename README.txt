================================================================================
AUTONOMOUS AGENT TOPOLOGY & TRUST-BOUNDARY AUDITOR (DUAL-PLANE ARCHITECTURE v3)
================================================================================

1. OVERVIEW
This repository provides an interactive PhD-level systems explainer and live
telemetry laboratory auditing the architectural trade-offs between:
  [A] Multi-Agent VPS / Cloud-Sandbox Orchestration (Superbot / Grokbot pattern,
      YouTube ID: 7-Tj5qaOUbc)
  [B] Local-First Deterministic Reference-Monitor & Provenance-Gated Memory
      Orchestration (n8n nod pattern, YouTube ID: VSrarL8Ki_A)

The system implements a hardened dual-plane architecture with Caddy TLS termination:
  - Plane 1 (Static GitHub Pages Frontend): Built with Vite, React, Three.js,
    and D3.js. Renders an interactive 3D WebGL hypervisor/container isolation
    topology and a D3.js trust-boundary & memory-provenance DAG.
  - Plane 2 (Docker Backend + Caddy Reverse Proxy): Automatically routes API
    requests through Caddy (`/api/*`), preventing mixed-content browser restrictions
    when communicating from HTTPS GitHub Pages static frontends.

2. ACADEMIC & TECHNICAL CITATIONS
  - Anderson, J. P. (1972). Computer Security Technology Planning Study (ESD-TR-73-51).
    https://csrc.nist.gov/publications/history/ande72.pdf
  - Saltzer, J. H., & Schroeder, M. D. (1975). The Protection of Information in
    Computer Systems. Proceedings of the IEEE, 63(9), 1278-1308.
    https://doi.org/10.1109/PROC.1975.9939
  - Greshake, K., et al. (2023). Not what you've signed up for: Compromising
    Real-World LLM-Integrated Applications with Indirect Prompt Injection.
    https://arxiv.org/abs/2302.12173
  - Wu, D., et al. (2024). LongMemEval: Benchmarking Chat Assistants on Long-Term
    Interactive Memory. https://arxiv.org/abs/2410.10813
  - Klabnik, S., & Nichols, C. (2023). The Rust Programming Language (2nd ed.).
    No Starch Press. ISBN 978-1718503106. https://doc.rust-lang.org/book/
  - Astrom, K. J., & Murray, R. M. (2021). Feedback Systems: An Introduction for
    Scientists and Engineers (2nd ed.). Princeton University Press.
    ISBN 978-0691193984. https://fbsbook.org/
  - SQLite Write-Ahead Logging (WAL) & FTS5 Official Documentation:
    https://www.sqlite.org/wal.html
    https://www.sqlite.org/fts5.html
  - Three.js & D3.js Official Documentation:
    https://threejs.org/docs/
    https://d3js.org/

3. DEPLOYMENT & VERIFICATION
  docker compose up --build -d
  curl -fsS https://localhost/api/health -k
================================================================================
