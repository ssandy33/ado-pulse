# ado-pulse

PR hygiene & team productivity dashboard for Azure DevOps. Surfaces PR metrics, review velocity, stale PRs, org health checks, and 7Pace time tracking analytics.

## Tech stack

- Next.js 16 (App Router), React 19, TypeScript
- Tailwind CSS 4
- Jest 30 + ts-jest, Testing Library
- Playwright for E2E testing (chromium + firefox)

## CI/CD & tooling

- **Jest CI** — unit, integration, and component tests on every PR and before deploy (`jest.yml`)
- **Playwright CI** — E2E tests on every PR and before deploy (`playwright.yml`)
- **Deploy pipeline** — requires both Jest and Playwright to pass (`deploy.yml`)
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
npm test          # Jest tests (local)
npm run test:ci   # Jest tests (CI mode — forceExit)
npm run test:e2e  # Playwright E2E tests
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
- **Every feature must include tests covering all acceptance criteria before committing.** Write unit tests for lib/helper functions, API route tests for endpoints, and component tests for UI — matching the acceptance criteria 1:1.

### Test layers

| Layer | Tool | Location | CI workflow |
|---|---|---|---|
| Unit | Jest | `__tests__/lib/` | `jest.yml` |
| Integration (API) | Jest | `__tests__/api/` | `jest.yml` |
| Component | Jest + jsdom | `__tests__/components/` | `jest.yml` |
| E2E | Playwright | `e2e/` | `playwright.yml` |

- Component tests must use `@jest-environment jsdom` docblock or per-file config
- CI runs both Jest and Playwright in parallel — deploy is blocked until both pass

## Definition of Done (DoD)

Every issue/PR must satisfy ALL of the following before merge:

### Code quality
- [ ] Code follows existing conventions (see Conventions section)
- [ ] No untyped `any` unless justified in a comment

### Testing
- [ ] Unit tests for new/changed lib functions (`__tests__/lib/`)
- [ ] Integration tests for new/changed API routes (`__tests__/api/`)
- [ ] Component tests for new/changed UI (`__tests__/components/`)
- [ ] E2E tests for new/changed user flows (`e2e/`)
- [ ] All acceptance criteria have a corresponding test
- [ ] `npm test` passes locally
- [ ] Jest CI check passes (green)
- [ ] Playwright CI check passes (green)

### Review & merge
- [ ] PR has a clear title and description
- [ ] CodeRabbit review addressed or acknowledged
- [ ] No merge conflicts with main

### Post-deploy (after merge to main)
- [ ] App loads — `curl -sf https://pulse.shawnjsandy.com/` returns 200
- [ ] API health — endpoints return expected JSON shape
- [ ] UI spot-check — feature works end-to-end on prod

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
- Always run `npm test` before committing
- **Branch protection**: `main` should require these status checks: `jest` and `e2e`

## Deployment

- Pushing to `main` triggers automatic production deployment via GitHub Actions
- Pipeline: SSH into server → git fetch/reset → Docker Compose build → restart services → prune images
- Stack: Docker (standalone output) + Caddy reverse proxy
- Domain: pulse.shawnjsandy.com
- **After every merge to main, run production smoke tests** to verify the deploy:
  1. App loads — `curl -sf https://pulse.shawnjsandy.com/` returns 200
  2. API health — curl any API endpoints touched by the feature and verify expected JSON shape
  3. UI spot-check — open the app and manually verify the feature works end-to-end on prod
