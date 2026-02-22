# ado-pulse

PR hygiene & team productivity dashboard for Azure DevOps. Surfaces PR metrics, review velocity, stale PRs, org health checks, and 7Pace time tracking analytics.

## Tech stack

- Next.js 16 (App Router), React 19, TypeScript
- Tailwind CSS 4
- Jest 30 + ts-jest, Testing Library
- Playwright for UI testing *(planned — PRD complete, not yet implemented)*

## CI/CD & tooling

- CodeRabbit for automated PR review (Context7 MCP integration enabled)
- Dependabot enabled for npm and GitHub Actions (weekly schedule)
- UptimeRobot for uptime monitoring on Hetzner
- Axiom for structured logging (`lib/logger.ts`) with console fallback

## Commands

```bash
npm run dev       # Dev server at http://localhost:3000
npm run build     # Production build (standalone output)
npm start         # Start production server
npm run lint      # ESLint
npm test          # Jest tests
```

## Project structure

```
app/api/          # Next.js API routes
components/       # React components (PascalCase files)
lib/ado/          # Azure DevOps API client, types, and helpers
lib/              # Shared utilities (settings, dateUtils, sevenPace)
__tests__/        # Jest tests mirroring source structure
data/             # File-based settings storage (gitignored)
deploy/           # Deployment scripts
```

## Conventions

- Components: PascalCase files in `components/`, client components use `"use client"`
- API routes: Next.js App Router pattern in `app/api/`, return `NextResponse` with proper status codes
- ADO logic: typed functions (not classes) in `lib/ado/`
- Types: PascalCase interfaces in `lib/ado/types.ts`
- Path alias: `@/*` maps to project root
- Error handling: `AdoApiError` class for API failures (includes status, URL, message)
- Caching: in-memory TTL (60s) with request coalescing in `adoFetch()`
- Auth: Basic auth with PAT via request headers (`x-ado-org`, `x-ado-project`, `x-ado-pat`)

## Testing

- Jest + ts-jest, test environment: node
- Test files: `__tests__/**/*.test.ts(x)` mirroring source structure
- Run `npm test` before committing

## Environment variables

- `.env.example` has the template: `DOMAIN`, `BASIC_AUTH_USER`, `BASIC_AUTH_PASS`
- ADO credentials (org, project, PAT) passed via request headers at runtime
- 7Pace API token configured in Settings > Integrations

## Key files

- `app/page.tsx` — entry point, routes between ConnectionForm and Dashboard
- `components/Dashboard.tsx` — main dashboard container with tab navigation
- `lib/ado/client.ts` — base ADO fetch with caching and request coalescing
- `lib/ado/types.ts` — TypeScript interfaces for ADO entities
- `lib/sevenPace.ts` — 7Pace time tracking API client
- `lib/settings.ts` — file-based JSON settings persistence
- `lib/dateUtils.ts` — date manipulation utilities

## Git & commits

- **Always start new work from fresh main**: `git checkout main && git pull` then create a branch
- Branch naming: `feat/<name>` for features, `fix/<name>` for bugs
- Never push directly to `main` — repo rules require pull requests
- Commit style: imperative present tense, action-first (e.g. "Add feature X", "Fix bug in Y", "Remove unused Z")
- Always run `npm run lint` and `npm test` before committing

## Deployment

- Pushing to `main` triggers automatic production deployment via GitHub Actions
- Pipeline: SSH into server → git fetch/reset → Docker Compose build → restart services → prune images
- Stack: Docker (standalone output) + Caddy reverse proxy
- Domain: pulse.shawnjsandy.com
