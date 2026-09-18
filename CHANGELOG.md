# Changelog

All notable changes to the **Stratum** platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] - 2026-09-18

### 🚀 Initial Platform Release

Developed and architected by **[Jojin John](https://www.linkedin.com/in/jojin-john/)** (`@jojin1709`).

#### Added
- **Core Engine (`apps/api`)**: High-performance Hono HTTP backend and Cloudflare Workers gateway with Hyperdrive connection pooling.
- **Console Dashboard (`apps/dashboard`)**: Production Next.js 14 dark-mode management console with 32 routes:
  - Table Data Grid, Column Schema viewer, and Visual Entity Relationship Diagram (ERD).
  - AI SQL Copilot with schema-aware natural language query synthesis.
  - Interactive OpenAPI 3.1 Documentation & Live Request Runner (`/docs`).
  - AI Schema Architect (`/database/ai-architect`) for 1-click natural language DDL synthesis.
  - Query Performance & Index Advisor (`/database/performance`) with visual `EXPLAIN ANALYZE` tree.
  - Continuous WAL Point-In-Time Recovery & Automated Backups (`/database/backups`).
  - PGVector Embeddings Studio & HNSW similarity search (`/database/vectors`).
  - Visual Row-Level Security (RLS) Policy Editor (`/database/policies`).
  - Real-Time Audit & Security Event Logs (`/logs`).
  - Drag-and-Drop S3/R2 Storage File Manager with image preview lightbox (`/storage`).
  - Realtime WebSocket Channel Simulator & CDC Event Broadcaster (`/realtime`).
  - In-Browser TypeScript Edge Functions Monaco Code Editor (`/functions`).
  - Custom Domain & SSL Routing Console (`/settings/domains`).
- **Developer CLI (`@stratum/cli`)**:
  - `npx @stratum/cli init [dir]`
  - `npx @stratum/cli dev`, `start`, `stop`, `status`
  - `npx @stratum/cli db migrate`, `rollback`, `pull`, `push`, `reset`
  - `npx @stratum/cli functions new`, `deploy`, `dev`
  - `npx @stratum/cli types generate`
- **Official Client SDK (`@stratum/client`)**: Isomorphic TypeScript client with query builder, realtime WebSocket subscriptions, storage helpers, and edge function invocations.
- **Community & Governance**: `CODE_OF_CONDUCT.md`, `SECURITY.md`, `CONTRIBUTING.md`, `SUPPORT.md`, and issue/PR templates.
