# Build Prompt: ado-pulse

## Overview

Build a new standalone Next.js application called `ado-pulse` — a containerized, deployable PR hygiene dashboard for Azure DevOps. This is a **separate project** from `ado-architecture-explorer` and should not be merged into it. Follow the same patterns and conventions established in that project (Next.js App Router, TypeScript, Tailwind CSS, Docker/Docker Compose for Hetzner deployment).

---

## Project Setup

Initialize a new Next.js 14+ project with:
- TypeScript
- Tailwind CSS
- App Router
- ESLint
- Same `package.json` structure and tooling as `ado-architecture-explorer`

Project name: `ado-pulse`

---

## Environment Variables

Same pattern as the architecture explorer. Create `.env.local` (gitignored) and `.env.example`:

```
ADO_ORG=arrivia
ADO_PROJECT=softeng
ADO_PAT=your_personal_access_token_here
ADO_DEFAULT_TEAM=Platform Engineering
```

---

## ADO API Client (`lib/ado/`)

Build a clean ADO client module in `lib/ado/`. It should:

- Use the Azure DevOps REST API directly (no MCP, no SDK — raw `fetch` calls with Basic auth using the PAT)
- Base URL pattern: `https://dev.azure.com/{org}/{project}/_apis/`
- Auth header: `Authorization: Basic ${Buffer.from(`:${PAT}`).toString('base64')}`
- Export typed functions, not a class
- Handle errors gracefully — return typed error responses rather than throwing

### `lib/ado/types.ts`

Define all shared TypeScript types here:

```typescript
export interface TeamMember {
  id: string;
  displayName: string;
  uniqueName: string;
}

export interface Team {
  id: string;
  name: string;
}

export interface PullRequest {
  pullRequestId: number;
  title: string;
  createdBy: {
    id: string;
    displayName: string;
    uniqueName: string;
  };
  creationDate: string;
  closedDate: string;
  repository: {
    id: string;
    name: string;
  };
  workItemRefs: { id: string; url: string }[];
}
```

### `lib/ado/teams.ts`

**`getProjectTeams()`**
- Endpoint: `GET https://dev.azure.com/{org}/_apis/projects/{project}/teams?api-version=7.1`
- Returns all teams in the project sorted alphabetically by name
- Returns: `Team[]`

**`getTeamMembers(teamName: string)`**
- First calls `getProjectTeams()` to resolve team name → team ID
- Then: `GET https://dev.azure.com/{org}/_apis/projects/{project}/teams/{teamId}/members?api-version=7.1`
- Returns: `TeamMember[]`

### `lib/ado/pullRequests.ts`

**`getPullRequests(days: number)`**
- Endpoint: `GET https://dev.azure.com/{org}/{project}/_apis/git/pullrequests?searchCriteria.status=completed&searchCriteria.minTime={isoDate}&$top=500&api-version=7.1`
- Calculate `minTime` from `days` parameter (today minus N days)
- Returns: `PullRequest[]`

**`getReviewsGivenByMember(memberId: string, days: number)`**
- Endpoint: `GET https://dev.azure.com/{org}/{project}/_apis/git/pullrequests?searchCriteria.reviewerId={memberId}&searchCriteria.status=completed&searchCriteria.minTime={isoDate}&$top=500&api-version=7.1`
- Filter out PRs where `createdBy.id === memberId` (don't count self-reviews)
- Returns: `number` (count of PRs reviewed)

---

## API Routes (`app/api/`)

### `GET /api/teams`

No query params.

Logic:
1. Call `getProjectTeams()`
2. Return the list plus the default team name

Response shape:
```typescript
{
  teams: { id: string; name: string }[];
  default: string; // value of ADO_DEFAULT_TEAM env var
}
```

Add a 5-minute `Cache-Control` header.

---

### `GET /api/prs/team-summary`

Query params:
- `days` — 7, 14, or 30 (default: 14)
- `team` — team name (default: `ADO_DEFAULT_TEAM` env var)

Logic:
1. Fetch team members for the `team` param (or `ADO_DEFAULT_TEAM` if not provided)
2. Fetch all completed PRs for the time window
3. Filter PRs to only team members (match on `createdBy.uniqueName`)
4. For each team member, call `getReviewsGivenByMember` in parallel using `Promise.all`
5. Compute per-member stats
6. Compute team-level totals and repo breakdown

**Flag logic:**
- `reviewFlagged: true` when `prCount >= 3` AND `reviewsGiven <= 1`
- Members with `prCount < 3` are never flagged — they may be new, on leave, or in a planning phase

Response shape:
```typescript
{
  period: { days: number; from: string; to: string };
  team: {
    name: string;
    totalPRs: number;
    activeContributors: number;
    totalMembers: number;
  };
  members: {
    id: string;
    displayName: string;
    uniqueName: string;
    prCount: number;
    repos: string[];          // distinct repos they merged PRs into
    lastPRDate: string | null;
    isActive: boolean;        // true if prCount > 0
    reviewsGiven: number;
    reviewFlagged: boolean;
  }[];
  byRepo: {
    repoName: string;
    totalPRs: number;
    contributors: string[];   // displayNames
  }[];
}
```

Add a 5-minute `Cache-Control` header.

---

## Dashboard UI

### Design Reference

Dark theme. Monospace font for data values and labels (DM Mono or similar). Sans-serif for names and descriptions. Clean, dense, data-forward — not decorative.

```
┌─────────────────────────────────────────────────────────────────────┐
│  ▌ PR Hygiene Dashboard                              ↻ refresh      │
│    arrivia / softeng / [Platform Engineering ▾]    [7d] [14d] [30d]│
│    refreshed Feb 17, 2026 at 9:42 AM                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │ PRs Merged   │  │ Active Contrib.  │  │ Most Active Repo     │  │
│  │              │  │                  │  │                      │  │
│  │  33          │  │  6 / 9           │  │  repo-api            │  │
│  │  last 14 days│  │  team members    │  │  18 PRs merged       │  │
│  └──────────────┘  └──────────────────┘  └──────────────────────┘  │
│                                                                     │
│  DEVELOPER BREAKDOWN                          Platform Engineering  │
│  ┌──────────┬──────┬───────────────┬──────────┬─────────┬────────┐ │
│  │ Dev      │ PRs  │ Repos Touched │ Last PR  │ Reviews │ Status │ │
│  ├──────────┼──────┼───────────────┼──────────┼─────────┼────────┤ │
│  │ A. Lee   │ 9    │ repo-web, ... │ Feb 16   │ 4       │ ✅     │ │
│  │ J. Smith │ 8    │ repo-api, ... │ Feb 13   │ 1 ⚠️    │ 🟡     │ │
│  │ M. Chen  │ 7    │ repo-api, ... │ Feb 15   │ 6       │ ✅     │ │
│  │ R. Patel │ 4    │ repo-shared.. │ Feb 14   │ 3       │ ✅     │ │
│  │ K. Doe   │ 5    │ repo-web      │ Feb 12   │ 0 ⚠️    │ 🔴     │ │
│  │ T. Park  │ 0    │ —             │ —        │ 4       │ 👁️     │ │
│  │ B. Wong  │ 0    │ —             │ —        │ 0       │ 👻     │ │
│  └──────────┴──────┴───────────────┴──────────┴─────────┴────────┘ │
│  ✅ active  🟡 low reviews  👁️ reviewing only  👻 no activity       │
│                                                                     │
│  PRs BY REPOSITORY                                                  │
│  ┌──────────────────┬────────────┬────────────────────────────────┐ │
│  │ Repository       │ PRs Merged │ Contributors                   │ │
│  ├──────────────────┼────────────┼────────────────────────────────┤ │
│  │ repo-api         │ 18         │ M. Chen, J. Smith, K. Doe +1   │ │
│  │ repo-web         │ 12         │ A. Lee, K. Doe                 │ │
│  │ repo-worker      │ 7          │ M. Chen, J. Smith              │ │
│  │ repo-shared      │ 5          │ M. Chen, R. Patel              │ │
│  │ repo-scripts     │ 3          │ J. Smith                       │ │
│  └──────────────────┴────────────┴────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Header bar

- Left: blue accent bar + title "PR Hygiene Dashboard"
- Below title: breadcrumb — `arrivia / softeng / [team dropdown]`
- The team name in the breadcrumb is the dropdown trigger — clicking it opens a menu of all ADO teams
- Right: refreshed timestamp, refresh button, time range pills `[7d] [14d] [30d]` with 14d as default

### Team dropdown behavior

- Loads teams from `GET /api/teams` on mount
- Shows "Loading teams..." while fetching
- Defaults to the `default` value returned by the API (`ADO_DEFAULT_TEAM`)
- On change: updates selected team in state and re-fetches all dashboard data
- Styled as a minimal dark dropdown, no external component libraries

### KPI row — 3 cards

- Total PRs Merged
- Active Contributors (e.g. "6 / 9")
- Most Active Repo (name + PR count)

### Developer Breakdown table

Columns: Developer | PRs Merged | Repos Touched | Last PR | Reviews Given | Status

- Sort by PRs Merged descending
- "Repos Touched": show up to 3 names, then "+N more"
- "Reviews Given": plain number; append ⚠️ if `reviewFlagged === true`
- Status column:

| Condition | Icon | Label |
|---|---|---|
| `prCount > 0 && !reviewFlagged` | ✅ | active |
| `prCount > 0 && reviewFlagged` | 🟡 | low reviews |
| `prCount === 0 && reviewsGiven > 0` | 👁️ | reviewing only |
| `prCount === 0 && reviewsGiven === 0` | 👻 | no activity |

### PRs by Repository table

Columns: Repository | PRs Merged | Contributors

- Sort by PRs Merged descending
- Contributors: up to 3 names, then "+N more"

### Loading & error states

- Skeleton loaders (Tailwind `animate-pulse`) while data is fetching
- When team changes, clear stale data and show skeletons immediately
- Error state with a retry button if any API call fails

### React state shape

```typescript
const [selectedTeam, setSelectedTeam] = useState<string>(defaultTeam)
const [days, setDays] = useState<number>(14)
```

Both changes trigger a data re-fetch.

---

## File Structure

```
ado-pulse/
├── app/
│   ├── api/
│   │   ├── teams/
│   │   │   └── route.ts
│   │   └── prs/
│   │       └── team-summary/
│   │           └── route.ts
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── Dashboard.tsx
│   ├── KPICard.tsx
│   ├── MemberTable.tsx
│   ├── RepoTable.tsx
│   ├── TeamSelector.tsx
│   ├── TimeRangeSelector.tsx
│   └── SkeletonLoader.tsx
├── lib/
│   └── ado/
│       ├── client.ts         # fetch wrapper, auth, base URL
│       ├── teams.ts          # getProjectTeams, getTeamMembers
│       ├── pullRequests.ts   # getPullRequests, getReviewsGivenByMember
│       └── types.ts          # shared TypeScript types
├── styles/
│   └── globals.css
├── .dockerignore
├── .env.example
├── .gitignore
├── Dockerfile
├── docker-compose.yml
├── docker-compose.prod.yml
├── next.config.mjs
├── package.json
├── postcss.config.mjs
├── tailwind.config.ts
└── tsconfig.json
```

---

## Docker Setup

Follow the exact same Dockerfile and Docker Compose patterns as `ado-architecture-explorer`.

**Dockerfile**: Multi-stage build (deps → builder → runner), non-root user, port 3000.

**`docker-compose.yml`** (local dev):
```yaml
services:
  app:
    build: .
    ports:
      - "3001:3000"
    env_file:
      - .env.local
```

**`docker-compose.prod.yml`** (Hetzner):
```yaml
services:
  app:
    image: ado-pulse:latest
    ports:
      - "3001:3000"
    env_file:
      - .env.local
    restart: unless-stopped
```

**`.env.example`** — committed to repo, no real values.  
**`.env.local`** — gitignored.

---

## What NOT to build yet

- Branch policy audit
- Story abuse / flagged stories detection
- Review load balance section
- Team activity heatmap
- Work item coverage / orphan PR tracking
- Email delivery
- Date picker (pre-defined selectors only)
- Mobile responsive layout
- Drill-down on row click
