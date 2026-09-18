# Contributing to Stratum

Thank you for your interest in contributing to **Stratum**! 

Stratum is created and maintained by **[Jojin John](https://www.linkedin.com/in/jojin-john/)** ([@jojin1709](https://github.com/jojin1709)). We welcome feedback, issue reports, documentation improvements, and pull requests.

---

## 🧭 Monorepo Structure

Stratum is organized as a Turborepo monorepo using `pnpm` workspaces:

```
stratum/
├── apps/
│   ├── api/             # Core Hono HTTP API & Cloudflare Worker Gateway
│   └── dashboard/       # Next.js 14 Console (stratum-sh.vercel.app)
├── packages/
│   ├── cli/             # Developer CLI binary (`@stratum/cli`)
│   ├── client/          # Isomorphic TypeScript SDK (`@stratum/client`)
│   ├── config/          # Centralized configuration & environment loader
│   ├── database/        # PostgreSQL adapter, introspection & migrations
│   ├── functions/       # Serverless function runner & Cloudflare deployer
│   ├── realtime/        # WebSocket hub & PostgreSQL CDC listener
│   ├── shared/          # Shared types, error definitions & cryptography
│   └── storage/         # Local & Cloudflare R2 / S3 storage providers
```

---

## 🛠️ Development Setup

### 1. Prerequisites
- **Node.js**: `>= 20.11.0`
- **pnpm**: `>= 9.0.0`
- **Docker** (optional, for local PostgreSQL testing)

### 2. Clone & Install
```bash
# Clone the repository
git clone https://github.com/jojin1709/Stratum.git
cd Stratum

# Install all workspace dependencies
pnpm install

# Build all packages
pnpm build

# Run the complete test suite
pnpm test
```

### 3. Local Development
```bash
# Start local PostgreSQL via Docker
pnpm db:up

# Start the API engine and dashboard
pnpm dev
```

---

## 📋 Pull Request Guidelines

1. **Branch Naming**: Use descriptive branch names:
   - `feat/feature-name`
   - `fix/bug-description`
   - `docs/documentation-update`
   - `perf/optimization`
2. **Commit Messages**: Follow Conventional Commits format (`feat: ...`, `fix: ...`, `docs: ...`, `refactor: ...`).
3. **Tests**: Ensure all existing tests pass (`pnpm test`) and add new unit/integration tests for your changes.
4. **Code Quality**: Run `pnpm typecheck` and verify zero lint or TypeScript compiler errors.

---

## 📬 Contact & Community

- **Creator & Lead Maintainer**: Jojin John
- **LinkedIn**: [linkedin.com/in/jojin-john](https://www.linkedin.com/in/jojin-john/)
- **GitHub**: [@jojin1709](https://github.com/jojin1709)
- **Live Console**: [https://stratum-sh.vercel.app](https://stratum-sh.vercel.app)
