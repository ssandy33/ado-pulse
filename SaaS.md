# SaaS Transformation Plan for ado-pulse

## Context

ado-pulse is a single-tenant internal tool deployed on one VPS. It has no user accounts, no tenant isolation, and stores credentials in localStorage. To sell it as a SaaS product, it needs real auth, multi-tenancy, a production database, billing, and onboarding. This plan lays out what changes in 4 phases, each independently deployable.

---

## Phase 1: Auth, Database, and Tenant Isolation

**Goal:** Real user accounts, PostgreSQL, tenant-scoped data. Users can sign up, connect ADO, and use the dashboard. Free for everyone (no billing yet).

### 1A. Authentication (Auth.js v5 + Azure AD OAuth)

Every ado-pulse user already has an Azure AD account, so Azure AD is the natural OAuth provider. Auth.js is free, self-hosted, and has native App Router support.

**New dependencies:** `next-auth@beta`, `@auth/drizzle-adapter`

**New files:**
| File | Purpose |
|------|---------|
| `auth.ts` | Auth.js config (Azure AD provider + email/password fallback) |
| `middleware.ts` | Protect all routes except `/auth/*` and `/api/auth/*` |
| `lib/auth.ts` | `getSession()` / `getTenantId()` helpers for API routes |
| `app/api/auth/[...nextauth]/route.ts` | Auth.js API handler |
| `app/auth/signin/page.tsx` | Sign-in page (Azure AD button + email form) |
| `app/auth/signup/page.tsx` | Registration page |

**Key architectural change — `extractConfig()` rewrite:**

Currently `lib/ado/helpers.ts:extractConfig()` pulls org/project/pat from request headers. Every API route calls it. Rewriting this one function to read from the session + tenant DB record gives all 23 API routes tenant-aware auth for free:

```
Before: headers -> extractConfig() -> AdoConfig
After:  session cookie -> extractConfig() -> tenant DB lookup -> decrypt PAT -> AdoConfig
```

**Remove `adoHeaders` prop threading:**

`Dashboard.tsx` currently receives `creds` and passes `adoHeaders` to 9 child components. After Phase 1, API routes authenticate via session cookie automatically, so all custom header passing is removed from:
- `Dashboard.tsx`, `TeamSelector.tsx`, `OrgHealthView.tsx`, `IdentityDebug.tsx`
- `SettingsPage.tsx`, `TimeTrackingTab.tsx`, `MemberRolesSettings.tsx`
- `MemberAgencySettings.tsx`, `TeamVisibilitySettings.tsx`

`app/page.tsx` becomes a server component that checks the session and redirects to `/auth/signin` or renders `<Dashboard />`.

### 1B. PostgreSQL (Neon + Drizzle ORM)

SQLite is single-writer and can't handle concurrent multi-tenant access. Neon serverless PostgreSQL (free: 0.5GB) + Drizzle ORM (lightweight, TypeScript-native).

**New dependencies:** `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`
**Remove:** `better-sqlite3`, `@types/better-sqlite3`

**New files:**
| File | Purpose |
|------|---------|
| `lib/db/schema.ts` | Drizzle table definitions |
| `lib/db/index.ts` | DB client singleton (replaces `lib/db.ts`) |
| `drizzle.config.ts` | Drizzle Kit config |

**Schema (shared DB, `tenant_id` column on every data table):**

- `users`, `accounts`, `sessions` — Auth.js standard tables
- `tenants` — id, name, slug, ado_org, ado_project, ado_pat_encrypted, seven_pace_token_encrypted, seven_pace_base_url
- `tenant_members` — tenant_id, user_id, role (owner/admin/member)
- `team_pr_snapshots` — existing columns + tenant_id
- `time_tracking_snapshots` — existing columns + tenant_id
- `member_role_exclusions` — replaces settings.json memberRoles
- `member_profiles` — replaces settings.json memberProfiles
- `team_visibility` — replaces settings.json teamVisibility
- `scheduler_log` — existing columns + tenant_id

### 1C. Settings Migration

`lib/settings.ts` currently reads/writes a single `data/settings.json` file. Rewrite every function to query PostgreSQL scoped by `tenantId`. Functions like `getMemberProfiles()`, `getExclusions()`, `upsertMemberProfile()` all gain a `tenantId` parameter.

### 1D. PAT Encryption

**New file:** `lib/crypto.ts` — AES-256-GCM encrypt/decrypt using `ENCRYPTION_KEY` env var. PATs encrypted before DB write, decrypted in `extractConfig()`.

### 1E. Tenant-Aware Cache

`lib/ado/client.ts` has a global in-memory cache keyed by URL. Prefix keys with `tenantId` to prevent cross-tenant collisions. Add `tenantId` to the `AdoConfig` interface in `lib/ado/types.ts`.

### 1F. Onboarding Flow

**New files:**
- `app/onboarding/page.tsx` — Create tenant, enter ADO org URL + PAT, test connection
- Reuses existing `/api/teams` validation logic from `ConnectionForm`

**Flow:** Sign up -> Create tenant -> Enter ADO credentials -> Test connection -> Dashboard

### 1G. Data Migration Script

**New file:** `scripts/migrate-v1.ts` — One-time script that creates a default tenant from existing `settings.json`, imports SQLite snapshots into PostgreSQL tagged with the default tenant ID.

### 1H. New Environment Variables

```
AUTH_SECRET, AUTH_AZURE_AD_CLIENT_ID, AUTH_AZURE_AD_CLIENT_SECRET, AUTH_AZURE_AD_TENANT_ID
DATABASE_URL (Neon connection string)
ENCRYPTION_KEY (64 hex chars for AES-256)
```

### Implementation Order

1. Set up Neon PostgreSQL, create Drizzle schema, run migration
2. Add Auth.js + middleware + auth pages
3. Create `lib/crypto.ts` for PAT encryption
4. Rewrite `extractConfig()` (linchpin — all API routes depend on it)
5. Rewrite `lib/settings.ts` for DB-backed per-tenant settings
6. Update `lib/ado/types.ts` (tenantId), `lib/ado/client.ts` (cache), `lib/sevenPace.ts`, `lib/snapshots.ts`
7. Build onboarding pages
8. Update `app/page.tsx` to server component
9. Remove `adoHeaders` prop threading from Dashboard + 9 child components
10. Write migration script
11. Update all tests
12. Update Dockerfile (remove SQLite, add pg)

---

## Phase 2: Billing, Team Management, Rate Limiting

**Goal:** Monetize with Stripe subscriptions. Gate features by plan tier. Tenant owners can invite teammates.

### 2A. Stripe Billing

**New dependency:** `stripe`

| Tier | Price | Users | Projects | Time Tracking | Snapshot History |
|------|-------|-------|----------|--------------|-----------------|
| Free | $0 | 1 | 1 | No | 7 days |
| Pro | $29/mo | 3 | 3 | Yes | 90 days |
| Team | $79/mo | 10 | Unlimited | Yes | 365 days |

**New files:**
- `lib/stripe.ts` — Stripe client + webhook handler
- `lib/billing.ts` — `canAccessFeature(tenantId, feature)` helper
- `app/api/billing/checkout/route.ts`, `app/api/billing/portal/route.ts`, `app/api/billing/webhook/route.ts`
- `app/settings/billing/page.tsx` — Billing UI

**Schema addition:** `subscriptions` table (tenant_id, stripe_customer_id, plan, status, current_period_end)

Feature gating via `withBilling()` wrapper on premium API routes (e.g., time tracking = Pro+).

### 2B. Team Invites

**New dependency:** `resend` (free: 100 emails/day)

- `app/settings/team/page.tsx` — Member management UI
- `app/api/team/invite/route.ts`, `app/api/team/accept/route.ts`

### 2C. Rate Limiting

**New dependencies:** `@upstash/ratelimit`, `@upstash/redis` (free: 10K req/day)

Add sliding window rate limiter in `middleware.ts`, limits vary by plan tier.

---

## Phase 3: Infrastructure and Ops

**Goal:** Move from single VPS to scalable hosting. Production-grade monitoring.

### 3A. Hosting Migration

**Recommendation: Railway** ($5/mo, auto-scaling, Docker support, GitHub auto-deploys). Remove `deploy/` scripts and `docker-compose.prod.yml`. Keep simplified `Dockerfile`.

### 3B. Background Jobs

**New dependency:** `inngest` (free: 25K events/mo)

Replace fire-and-forget `setImmediate()` calls with proper job queue for: daily snapshot aggregation, stale PR notifications, usage metering.

### 3C. Error Tracking

Add Sentry (`@sentry/nextjs`, free: 5K errors/mo). Keep Axiom for structured logging, UptimeRobot for uptime.

---

## Phase 4: Product Expansion

### 4A. Multi-Project Support
New `tenant_projects` table — one tenant can monitor multiple ADO org/project pairs. Move ADO credentials from `tenants` to join table.

### 4B. Audit Logging
Track settings changes per tenant (who changed what, when).

### 4C. Webhook / Slack Notifications
Alert channels on stale PRs, low time tracking compliance, etc.

### 4D. Marketing Site
`app/(marketing)/` route group with landing page and pricing page, separate layout from dashboard.

---

## File Change Summary (Phase 1)

| Action | Count | Files |
|--------|-------|-------|
| **Create** | 14 | `auth.ts`, `middleware.ts`, `lib/auth.ts`, `lib/crypto.ts`, `lib/db/schema.ts`, `lib/db/index.ts`, `drizzle.config.ts`, `app/api/auth/[...nextauth]/route.ts`, `app/auth/signin/page.tsx`, `app/auth/signup/page.tsx`, `app/onboarding/page.tsx`, `app/onboarding/connect/page.tsx`, `scripts/migrate-v1.ts`, `.env.example` update |
| **Rewrite** | 4 | `app/page.tsx`, `lib/ado/helpers.ts`, `lib/settings.ts`, `lib/db.ts` -> `lib/db/index.ts` |
| **Modify** | 14 | `lib/ado/types.ts`, `lib/ado/client.ts`, `lib/sevenPace.ts`, `lib/snapshots.ts`, `components/Dashboard.tsx`, `components/TeamSelector.tsx`, `components/OrgHealthView.tsx`, `components/IdentityDebug.tsx`, `components/SettingsPage.tsx`, `components/TimeTrackingTab.tsx`, `components/MemberRolesSettings.tsx`, `components/MemberAgencySettings.tsx`, `components/TeamVisibilitySettings.tsx`, `next.config.ts` |
| **Remove** | 2 | `lib/db.ts` (replaced), `components/ConnectionForm.tsx` (replaced by onboarding) |

---

## Dependency Summary

| Phase | Add | Remove |
|-------|-----|--------|
| **1** | `next-auth@beta`, `@auth/drizzle-adapter`, `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless` | `better-sqlite3`, `@types/better-sqlite3` |
| **2** | `stripe`, `resend`, `@upstash/ratelimit`, `@upstash/redis` | — |
| **3** | `inngest`, `@sentry/nextjs` | — |
| **4** | — | — |

---

## Verification (Phase 1)

1. `npm run build` compiles without errors
2. `npm test` — all existing tests updated and passing
3. Sign up with email/password -> creates account + tenant
4. Onboarding flow: enter ADO org URL + PAT -> test connection succeeds -> redirected to dashboard
5. Dashboard loads teams, PR metrics, time tracking (same as before)
6. Settings pages work (member profiles, integrations, team visibility) — data scoped to tenant
7. Sign out -> redirected to sign-in page
8. Second user signs up -> gets separate tenant -> cannot see first user's data
9. PATs encrypted in database (verify with raw SQL query)
