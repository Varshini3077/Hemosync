# Contributing to HemoSync

Thank you for your interest in contributing to HemoSync! HemoSync is an Azure-powered emergency
blood coordination platform built for the Microsoft hackathon. We welcome contributions of all
kinds — bug fixes, features, documentation, and infrastructure improvements.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)
- [Azure Service Guidelines](#azure-service-guidelines)
- [Security](#security)

---

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md). We are committed to a welcoming,
respectful community.

---

## Getting Started

### Prerequisites

- Node.js 20 LTS (use `nvm use` — see `.nvmrc`)
- pnpm 8+ (`npm install -g pnpm`)
- Docker Desktop (for local PostgreSQL, Redis, and Azurite)
- Azure CLI (for infrastructure work)
- An Azure subscription with sufficient credits

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/Varshini3077/Hemosync.git
cd Hemosync

# 2. Copy the environment file and fill in your values
cp .env.example .env

# 3. Install dependencies
pnpm install

# 4. Start local backing services (PostgreSQL, Redis, Azurite)
make docker-up

# 5. Seed the database with dev data
make seed

# 6. Start all dev servers
make dev
```

See [`docs/local-development.md`](docs/local-development.md) for a full walkthrough.

---

## Development Workflow

1. **Fork** the repository and create a branch from `main`.
2. Branch names should follow: `<type>/<short-description>`
   - `feat/voice-input-improvement`
   - `fix/broadcast-retry-logic`
   - `docs/fhir-integration-guide`
   - `infra/cosmos-geo-replication`
3. Make your changes in the appropriate package/app.
4. Ensure all checks pass before opening a PR:
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   ```
5. Add a changeset if your change is user-facing:
   ```bash
   pnpm changeset
   ```

---

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

[optional body]

[optional footer]
```

| Type     | When to use                              |
| -------- | ---------------------------------------- |
| `feat`   | New feature                              |
| `fix`    | Bug fix                                  |
| `docs`   | Documentation only                       |
| `infra`  | Bicep / infrastructure changes           |
| `chore`  | Tooling, config, dependency updates      |
| `test`   | Adding or updating tests                 |
| `perf`   | Performance improvement                  |
| `ci`     | CI/CD workflow changes                   |
| `refactor` | Code change that is neither fix nor feat |

**Examples:**

```
feat(broadcast): add retry logic for failed MSG91 SMS delivery

fix(ranked-banks): correct Redis TTL calculation for bank scores

infra(cosmos): enable geo-replication to southindia region
```

---

## Pull Request Process

1. Open a PR against `main` using the [PR template](.github/PULL_REQUEST_TEMPLATE.md).
2. Ensure the CI workflow passes (lint, typecheck, tests, build).
3. Request a review from at least one codeowner.
4. Address all review comments before merging.
5. PRs are merged using **Squash and Merge** to keep history clean.

---

## Testing

| Layer       | Command                  | Description                          |
| ----------- | ------------------------ | ------------------------------------ |
| Unit        | `pnpm test`              | Vitest unit tests per package        |
| Integration | `pnpm test:integration`  | Full flow tests (requires Docker)    |
| E2E         | `make test-e2e`          | Playwright browser tests             |
| Smoke       | `make smoke-test`        | End-to-end broadcast pipeline check  |

- Write tests for all new functions and API endpoints.
- Aim for >80% coverage on the `api/` package.
- Integration tests should be self-contained (mock external Azure services where possible).

---

## Azure Service Guidelines

When adding or modifying Azure service integrations:

1. **Secrets**: All secrets must go through Azure Key Vault in production. Never hardcode keys.
2. **Retry**: Use exponential backoff for all external service calls.
3. **Caching**: Cache expensive remote lookups (banks, FHIR queries) in Redis with appropriate TTLs.
4. **Logging**: Log structured events to Application Insights using the shared `logger.ts` middleware.
5. **Infrastructure**: All new Azure resources must be defined as Bicep modules in `infra/modules/`.
6. **DPDP Compliance**: Donor personal data must be anonymised in logs and handled per India DPDP Act.

---

## Security

Please report security vulnerabilities **privately** via the process described in [SECURITY.md](SECURITY.md).
Do **not** open a public GitHub issue for security bugs.
