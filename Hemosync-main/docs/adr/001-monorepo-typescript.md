# ADR 001 — TypeScript Monorepo with Turborepo

**Date:** 2024-11-01
**Status:** Accepted

---

## Context

HemoSync has four distinct runtime targets:
- An Azure Functions API (Node.js, serverless)
- A React + Vite web dashboard (browser)
- A Bot Framework Teams bot (Node.js, long-running)
- An ACS WhatsApp webhook handler (Node.js, Express)

All four surfaces share common data structures: `BloodRequest`, `BroadcastJob`, `BloodBank`, `DonorRecord`, and a set of API contract types. Without a shared type layer, any change to a shared type (e.g., adding a field to `BroadcastJob`) requires coordinated updates across four separate repositories with no compile-time safety net.

We evaluated:
1. **Separate repos** — maximum isolation, but no shared type enforcement; drift is inevitable
2. **Copy-paste shared types** — no drift protection; maintenance overhead scales with team
3. **Published npm package** — shared types, but adds a publish-deploy cycle for every type change
4. **TypeScript monorepo** — shared types at the file system level; type errors across packages fail at build time

---

## Decision

Adopt a single TypeScript monorepo managed with **Turborepo** and **pnpm workspaces**. A dedicated `packages/types` package exports all shared interfaces and enums. All other packages (`api`, `apps/web`, `apps/teams-bot`, `apps/whatsapp-handler`) import from `@hemosync/types`.

Turborepo manages the build graph: `packages/types` is always built first, and downstream packages declare it as a dependency. Turborepo's remote cache (Azure Blob Storage) is configured for CI to skip unchanged packages.

---

## Consequences

**Positive:**
- Type safety across all 10+ packages enforced at compile time
- No drift between API contracts and UI expectations — a breaking API change will fail the web build immediately
- Single `pnpm install` at root; single `pnpm dev` starts everything
- Turborepo's task graph (`turbo.json`) makes build/test/lint pipelines self-documenting

**Negative:**
- VS Code can be slower with large monorepos; mitigated by `.vscode/settings.json` pointing to workspace TypeScript SDK
- Developers unfamiliar with monorepos need a brief onboarding (covered in `docs/local-development.md`)
- A change to `packages/types` triggers rebuilds of all downstream packages (acceptable trade-off)
