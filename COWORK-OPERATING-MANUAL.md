# Compass — Cowork Operating Manual

This manual is for **Claude operating inside Cowork**. It is the complete, self-contained guide to developing, changing, and deploying the Compass college-application web app with no further help from Claude Code.
Work in the imperative: run the commands as written, and treat **"verify after every deploy"** as a hard rule, not a suggestion.
Contains **no secret values** — credentials are referenced by location only. Public-safe identifiers (Supabase URL/ref, Vercel project/team, GitHub repo URL) are fine to use.

---

## Quick deploy cheat-sheet

Set the working directory and npm cache once per shell, then run the three surfaces deliberately. **Pushing to GitHub does not deploy; a migration does not redeploy; a deploy does not run migrations.**

```bash
# 0. Per-shell setup (the cache flag is MANDATORY on every npm/npx call)
cd "/Users/marcosrobertogomesdequeiroz/Documents/Claude CW College Apps/compass-app"
export npm_config_cache=/tmp/compass-npm-cache

# 1. De-risk: build locally first — never deploy a build you haven't run
npm run build

# 2. Source: branch, commit, push, open PR
git checkout -b <short-descriptive-branch>
git add -A && git status
git commit -m "<imperative summary>

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push -u origin <short-descriptive-branch>
# Then open the PR. NOTE: the `gh` CLI is NOT installed on this machine — see
# §Deploy Ops 1 for the no-gh path (web "Compare & pull request" URL).

# 3. Hosting: deploy to Vercel production
npx --yes vercel@latest deploy --prod --yes

# 4. VERIFY (never skip): 200/307 = live (the site is PUBLIC), 5xx = real failure,
#    401 = the Vercel auth wall (only if protection was re-enabled). Then open the route.
curl -sI https://luiscollegeapp.vercel.app
```

Migrations are a **separate surface** — apply them via the Supabase MCP `apply_migration` tool AND save a numbered `.sql` in `supabase/migrations/` (see §Deploy Ops 4). The live URL is **https://luiscollegeapp.vercel.app** and is **public** (Vercel Deployment Protection is off); a first-time visitor on a new device meets the app-level access-code gate (`src/components/AccessGate.tsx`), not a Vercel wall. A 401 would mean protection was turned back on.

---

## Keeping CoWork in sync (handoff prompts)

CoWork is the primary workspace and source of truth; this website is a downstream layer. So **every time Claude Code changes the site** — a feature, a deploy, a schema or domain change, a config flip — it hands Luis **one paste-in prompt** that tells CoWork what changed and how to operate within it, and that prompt **cites this manual**. This keeps CoWork current without re-deriving state. (Standing rule, recorded in Claude Code's memory.)

## Table of contents

1. [Stack & repo facts](#stack--repo-facts)
2. [Gotchas & Safety](#gotchas--safety) — read before any build, deploy, or DB change
3. [Deploy Ops](#deploy-ops) — the three surfaces, step by step
   - [1. Commit + push to GitHub (no `gh` CLI)](#1-commit--push-to-github-no-gh-cli)
   - [2. Deploy to Vercel production (CLI — primary)](#2-deploy-to-vercel-production-cli--primary)
   - [3. Deploy via MCP + reading build logs](#3-deploy-via-mcp--reading-build-logs)
   - [4. Run Supabase migrations + save the .sql](#4-run-supabase-migrations--save-the-sql)
   - [5. Change Vercel environment variables](#5-change-vercel-environment-variables)
   - [6. Roll back a bad deploy](#6-roll-back-a-bad-deploy)
   - [Deploy checklist](#deploy-checklist-run-top-to-bottom)
4. [Secrets & Access](#secrets--access)
5. [Making app changes (fields, nav, screens)](#making-app-changes-fields-nav-screens)
6. [Backlog Cowork can pick up](#backlog-cowork-can-pick-up)
7. [Files referenced in this manual](#files-referenced-in-this-manual)

---

## Stack & repo facts

| Thing | Value |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript, Tailwind 4) + Framer Motion |
| Backend | Supabase (Postgres + Row-Level Security) with silent single-user auto-login middleware |
| App dir | `/Users/marcosrobertogomesdequeiroz/Documents/Claude CW College Apps/compass-app` |
| Legacy reference | sibling `compass/` (single-file v1 — reference only, do not deploy) |
| `package.json` scripts | `dev="next dev"`, `build="next build"`, `start="next start"`, `lint="eslint"` |
| Default branch | `main` |
| GitHub repo | `https://github.com/Luis-F-Queiroz/Compass_College_App` |
| Vercel | project `compass-college-app` (id `prj_fIm1gwZAEL2DltEXvJ0IsQJF76wV`), team `luis-queiroz-s-projects` (CLI already authenticated). Project name is unchanged even though the domain changed. |
| Live URL | **https://luiscollegeapp.vercel.app** — public; first visit on a new device prompts the app-level access code (`AccessGate`). (Old `compass-college-app.vercel.app` is retired / 404s.) |
| Supabase | project ref `bubhsrgwaxolthihlqdd`, URL `https://bubhsrgwaxolthihlqdd.supabase.co` |
| Schema baseline | `supabase/migrations/0001_init.sql` |

**Data model.** Entity tables: `colleges`, `scholarship_deadlines`, `essays`, `essay_colleges`, `tasks`, `activities`, `ideas`, `profiles`, `competitions`, `summer_programs`, `counselor_reports`. Plus the sync ledger `sync_runs` / `sync_changes`. Every row has `user_id` and RLS (`auth.uid() = user_id`). Most entity tables carry `archived boolean` (0005/0007) — lists hide `archived = true` rows; an **Archive** button (next to Delete in the edit modal) sets it, and a **Show archived** toggle on each list unarchives. Archiving never deletes.

**Schema-driven UI.** The UI is generated from `src/lib/specs.ts` (one field-spec per entity) rendered by the generic `src/components/EntityScreen.tsx` (table + animated modal + debounced auto-save). Adding or editing a field = edit `specs.ts` (plus a migration only if the column is genuinely new). Navigation lives in `src/components/Sidebar.tsx`. **Each entity also needs its own route file** at `src/app/(app)/<entity>/page.tsx` — see §Making app changes.

**Auth = silent single-user, no sign-in.** `src/middleware.ts` auto-signs-in from server-only env vars `SINGLE_USER_EMAIL` / `SINGLE_USER_PASSWORD`. Keep this model and the future per-user path intact. The `/login` page exists but is unused — don't wire it into nav.

---

## Gotchas & Safety

Read this before any build, deploy, or DB change. These are real traps that have already bitten this project — minutes if you know them, an hour if you don't.

### 1. Always set the npm cache flag (`npm_config_cache`)

`~/.npm` contains root-owned files. Any bare `npm` / `npx` call can fail with `EACCES` while writing the default cache. **Every** npm/npx command in this project must redirect the cache:

```bash
export npm_config_cache=/tmp/compass-npm-cache
```

Set it once per shell and it persists for that session — but the working directory resets between Bash calls, so prefer the single-line `export npm_config_cache=/tmp/compass-npm-cache && <command>` form and use absolute paths. If you see an npm error mentioning `EACCES`, `permission denied`, or a path under `~/.npm`, you forgot this flag — re-run with it.

### 2. The site is PUBLIC at https://luiscollegeapp.vercel.app — entry is an app-level access code

Vercel Deployment Protection is **off**, so the production URL is reachable by anyone. Access is now controlled in the app by `src/components/AccessGate.tsx`: a device that hasn't entered the access code sees a code screen; once entered it is remembered in `localStorage`; a new device (or cleared storage) re-prompts.

- A plain `curl -sI https://luiscollegeapp.vercel.app` returns **307** (redirect to `/dashboard`) — the healthy public response. A **401 would mean Vercel protection was turned back on**.
- This gate is a **light shared-code lock, not security**: the code lives in the client bundle (and the repo is public), and the app auto-signs-in to the single account, so anyone past the gate has full read/write to the data. Do not treat it as authentication. The access code itself lives in `AccessGate.tsx` — don't duplicate it elsewhere.
- Making it private again (re-enabling protection) is a manual dashboard toggle only Luis can do (Project → Settings → Deployment Protection); don't script it.

### 3. Security-sensitive actions trigger an auto-mode permission prompt — Luis must approve

These operations pause for Luis's explicit approval. **Do not assume they'll go through; do not try to work around the prompt.** Surface the exact change, say plainly "This needs your approval — it's a security-sensitive action," and wait. They include:

- Disabling/changing Vercel Deployment Protection (also manual — see §2).
- Mutating `auth.users` in Supabase (creating/deleting/altering the single-user account, changing its password/email).
- Reading, moving, or rotating any credential.

Never silently retry to dodge the gate.

### 4. Single-user model caveats

Auth is a silent, single-account auto-login, not a real login flow. `src/middleware.ts` signs the app in from server-only `SINGLE_USER_EMAIL` / `SINGLE_USER_PASSWORD` on every request.

- **Keep this model intact.** Don't add a login gate, don't remove the auto-sign-in block, don't ship the credentials to the browser. Credentials stay in server-only env vars — never `NEXT_PUBLIC_*`, never in client components.
- **The `/login` page exists but is unused.** Don't wire it into navigation or "fix" it. The middleware comment documents the future per-user path (route unauthenticated users to `/login`, remove the auto-sign-in block — RLS, `user_id`, `AuthProvider`, and `/login` are already scaffolded). Preserve that path; don't delete the scaffolding.
- **Env-var parity matters.** If auto-login silently fails, the cause is almost always missing/mismatched env vars. The middleware logs `[compass] auto sign-in failed:` to the server console. If the app loads but shows no data, check that `SINGLE_USER_EMAIL`, `SINGLE_USER_PASSWORD`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set in **both** `.env.local` (local) and Vercel project env vars (prod). A var changed in one place but not the other is the classic "works locally, broken in prod" bug.
- **Every row is RLS-scoped** (`auth.uid() = user_id`). The normal write path handles `user_id` for you: `src/hooks/useCollection.ts` `create()` injects it automatically (`.insert({ ...values, user_id: session.user.id })`), so EntityScreen/spec-driven inserts are already covered — do **not** add a `user_id` field to a spec or form. You only need to set `user_id` yourself for **raw SQL inserts** (Supabase MCP `execute_sql`) or any new client code that bypasses `useCollection`. If new rows "vanish" or reads come back empty, suspect a missing `user_id` on a raw insert or an RLS gap on a new table — not a UI bug. New tables need their own RLS policies in the migration, or they're invisible to the app.

### 5. Known TypeScript build pitfalls + fixes

`next build` runs strict type-checking and fails the whole build on these. All three have been hit here — fix at the source.

- **Supabase `.then()` destructuring / untyped callbacks.** Avoid `supabase.from(...).select().then(({ data }) => ...)` with no annotations — implicit `any` and loose destructuring fail the build. **Fix:** `await` the query and type the result explicitly. The codebase already does this (`const { data } = await supabase.from(...).select(...)`, helpers typed as `Record<string, unknown>`, state typed like `useState<Row | "new" | null>(null)`). Match it.

- **Framer Motion `variants` objects need the `Variants` type.** A bare object passed as `variants` infers too wide (e.g. `ease: "easeOut"` widens to `string`) and fails the build. **Fix:** annotate, exactly as `src/app/(app)/dashboard/page.tsx` already does:

  ```ts
  import { motion, type Variants } from "framer-motion";
  const item: Variants = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.24, ease: "easeOut" } } };
  ```

- **Untyped callbacks generally** (`.map`, `.filter`, event handlers). Implicit-`any` params fail under strict mode. Annotate them.

**Rule: never push or deploy a build you haven't run locally first.** Catching a type error locally costs seconds; catching it in a Vercel build costs a failed deploy and a round trip.

### 6. Verify after every deploy

A successful CLI exit is not proof the app works. After each prod deploy:

1. Confirm the build succeeded (Vercel CLI output, or the Vercel MCP `get_deployment` / `get_deployment_build_logs`).
2. `curl -sI <production-url>` and read the status: **401 = Deployment Protection is ON (expected, not a failure)**; 200/307 = the app is open (only after Luis toggles protection off, §2); **5xx = a real failure** — investigate.
3. Load the deployed URL and confirm the app renders **and shows data** (auto-login worked → env-var parity is intact, per §4). If it shows the protection auth wall, that's expected until Luis toggles protection off (§2).
4. If anything is off, read the **runtime** logs before changing code.

### 7. Secrets hygiene

Never read, print, or paste secret values — not from `.env.local`, not from Vercel env vars, not from the Keychain. Reference them **by location** only (full map in [Secrets & Access](#secrets--access)). Public-safe identifiers are fine. **Standing flag for Luis:** the existing GitHub personal-access token is all-repo scope with no expiry and should be rotated.

---

## Deploy Ops

Everything here runs from the app directory. Set it once per shell:

```bash
cd "/Users/marcosrobertogomesdequeiroz/Documents/Claude CW College Apps/compass-app"
```

**The golden rule: every deploy ends with a verify step.** Never declare "done" off a green build log alone — open the live URL (or its API) and confirm the change is actually there. The pipeline has three independent surfaces — **GitHub** (source), **Vercel** (hosting/runtime), and **Supabase** (database) — and they are NOT auto-synced into one button. Pushing to GitHub does not run migrations; running a migration does not redeploy the app. Drive each one deliberately.

### 1. Commit + push to GitHub (no `gh` CLI)

Credentials come from the macOS Keychain credential helper — you never type or paste a token. If `git push` ever prompts for a username/password, **stop**: the helper isn't resolving. Do not type secrets into the prompt; tell Luis the Keychain credential needs re-linking.

```bash
git checkout -b <short-descriptive-branch>   # branch off main; don't commit straight to main
git add -A
git status                                    # eyeball what you're about to commit
git commit -m "<imperative summary>

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push -u origin <short-descriptive-branch>
```

**Opening the PR — the `gh` CLI is NOT installed on this machine.** Do not run `gh pr create`; it will fail with `command not found`. (A `github` Claude plugin may appear on PATH, but it does not provide a `gh` binary.) Use one of these instead:

- **Web PR (preferred):** after `git push -u`, GitHub prints a `Create a pull request` URL in the push output — open it, or go to `https://github.com/Luis-F-Queiroz/Compass_College_App/compare/main...<short-descriptive-branch>?expand=1` and submit.
- **Direct merge to `main`:** acceptable for this single-user project when no review is needed — merge the branch (or commit to `main`) and deploy.
- **If you want `gh`:** install and authenticate it first (`export npm_config_cache=/tmp/compass-npm-cache && brew install gh`, then `gh auth login`, confirm with `gh auth status`). Only after that is `gh pr create --fill --base main` usable. Do not assume it is present or authenticated.

Notes:
- Remote `origin` = `https://github.com/Luis-F-Queiroz/Compass_College_App`, default branch `main`.
- `.vercel/` is git-ignored (it holds the local project link) — never force-add it.
- **Pushing to GitHub does NOT deploy.** Vercel's git integration may build the branch, but production only changes when you run the prod deploy in step 2 (or merge + Vercel auto-promotes `main`, *if* that's configured — verify, don't assume).
- Run the secret scan in [Secrets & Access](#secrets--access) before every push.

### 2. Deploy to Vercel production (CLI — primary)

The CLI is already authenticated, and the dir is linked to project `compass-college-app` (team `luis-queiroz-s-projects`) via `.vercel/`. (The link file here is `.vercel/repo.json`, the repo-linked form — there is no `.vercel/project.json`, even though the bundled `.vercel/README.txt` references one. `vercel ls` / `vercel deploy` resolve the project correctly anyway.) The `npm_config_cache` flag is **mandatory** on every npm/npx call.

**De-risk first** — run a local build so you catch errors without burning a remote build:

```bash
export npm_config_cache=/tmp/compass-npm-cache
npm run build
```

**Local browser preview (optional, for UI changes).** To eyeball a change in a real browser before deploying, start the dev server with the preview tool: the workspace `.claude/launch.json` defines a single config, **`compass-app`** (`npm run dev`, port 3000). There is deliberately only one config — a legacy `compass` entry that statically served the superseded v1 `compass/index.html` was removed, because previewing it returns a bare "not found" for every real route and looks like the whole app is broken. Use `compass-app`, never assume `compass`.

Then deploy:

```bash
export npm_config_cache=/tmp/compass-npm-cache
npx --yes vercel@latest deploy --prod --yes
```

The command prints a deployment URL and streams the build. Recurring build errors to fix before deploying are documented in [Gotchas §5](#5-known-typescript-build-pitfalls--fixes) (Supabase `.then()` destructuring, untyped callbacks, Framer Motion `Variants`).

**Deployment Protection caveat:** the production deployment sits behind Vercel "Deployment Protection," so the public URL returns a login/SSO wall (HTTP 401) even after a clean deploy. Making it public is a **manual dashboard toggle Luis performs** — it cannot be reliably flipped via API/CLI, and attempting it is a security-sensitive action that trips an auto-mode permission prompt. If the live site is gated, that's expected; ask Luis to toggle it, don't try to script around it.

### 3. Deploy via MCP + reading build logs

If the CLI is unavailable, use the Vercel MCP tools (load schemas via ToolSearch first, e.g. `select:deploy_to_vercel,list_deployments,get_deployment,get_deployment_build_logs`):

- `deploy_to_vercel` — trigger a deployment for the `compass-college-app` project.
- `list_deployments` / `get_deployment` — find the latest deployment and read its status (`READY`, `ERROR`, `BUILDING`).
- `get_deployment_build_logs` — pull the full build log for a deployment id. **This is your primary debugging tool when a deploy fails** — read it top-to-bottom for the first error, usually a TypeScript/ESLint failure matching the patterns in §5.
- `get_runtime_logs` — for errors that appear *after* a successful build (runtime 500s, Supabase auth/RLS failures, missing env vars).

**Verify the deploy** (CLI or MCP) once status is `READY`:

```bash
curl -sI <production-url>   # 401 = Deployment Protection (expected); 200/307 = open; 5xx = real failure
```

Then load the page (or the affected route) and confirm the actual change is present. If the URL shows the SSO/protection wall (401), that's the Deployment Protection toggle (§2), not a failed deploy.

### 4. Run Supabase migrations + save the .sql

DB changes are a **separate deploy surface** — they don't ride along with a Vercel deploy and must be applied explicitly. Two artifacts every time: apply via MCP **and** save a numbered `.sql` so schema history stays reproducible.

Project ref `bubhsrgwaxolthihlqdd`. Schema history lives in `supabase/migrations/`; current baseline is `0001_init.sql`.

Load Supabase MCP schemas first (e.g. `select:apply_migration,execute_sql,list_migrations,list_tables`), then:

1. **Write the migration file** — next number, descriptive name, matching the existing convention (lowercase SQL, `create table if not exists`, a leading `-- comment` header). Example: `supabase/migrations/0002_scholarship_deadlines_ui.sql`. New tables need `user_id uuid not null references auth.users(id) on delete cascade` plus RLS policies (`auth.uid() = user_id`) to match every existing table.
2. **Apply it** with the Supabase MCP `apply_migration` tool (use `execute_sql` only for one-off read/inspection queries, not schema changes).
3. **Verify** with `list_tables` / `list_migrations`, or an `execute_sql` `select` against the new column/table.
4. **Redeploy the app** if the schema change pairs with code (new field in `src/lib/specs.ts`, new nav entry in `src/components/Sidebar.tsx`, new route file) — the migration alone won't update the UI. Go back to step 2 of Deploy Ops.

Adding/editing a **field on an existing entity** = edit `src/lib/specs.ts` (+ a migration only if it's a genuinely new column). No migration is needed for spec-only display changes.

**Mutating `auth.users`** (e.g. the single-user account) is security-sensitive and triggers an auto-mode permission prompt — get Luis's explicit approval first.

### 5. Change Vercel environment variables

Server-only secrets (`SINGLE_USER_EMAIL`, `SINGLE_USER_PASSWORD`, Supabase keys) live in **Vercel project env vars** for production and in `compass-app/.env.local` for local dev. Never read or print `.env.local`; never echo a value you're setting.

The canonical list of env vars the app actually needs (do **not** rely on `.env.local.example` for this — it is out of date; see [Secrets & Access](#secrets--access)):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SINGLE_USER_EMAIL` *(server-only — read by `src/middleware.ts`)*
- `SINGLE_USER_PASSWORD` *(server-only — read by `src/middleware.ts`)*
- `SUPABASE_SERVICE_ROLE_KEY` *(server-only; only if/when a privileged script needs it)*

```bash
export npm_config_cache=/tmp/compass-npm-cache
npx --yes vercel@latest env ls                    # list names + environments (no values)
npx --yes vercel@latest env add <NAME> production # prompts for the value; paste, don't log
npx --yes vercel@latest env rm <NAME> production
```

Critical: **env-var changes do NOT take effect on the live site until you redeploy.** After adding/changing one, re-run the prod deploy (step 2), then verify. The silent auto-login middleware reads `SINGLE_USER_EMAIL` / `SINGLE_USER_PASSWORD` at request time on the server — if those are wrong or missing in production, the app fails to auto-sign-in and routes bounce to the unused `/login` page. That's your first thing to check if a fresh deploy can't load data.

### 6. Roll back a bad deploy

Vercel keeps every prior deployment; rolling back = re-promoting a known-good one. Faster and safer than hot-fixing forward.

```bash
export npm_config_cache=/tmp/compass-npm-cache
npx --yes vercel@latest ls                                   # find the last good READY deployment
npx --yes vercel@latest promote <good-deployment-url-or-id>  # re-promote it to production
```

(MCP equivalent: `list_deployments` to find the good one, then re-promote/redeploy that ref.) The Vercel dashboard's "Instant Rollback" / "Promote to Production" is the safest manual path and needs no CLI.

Then **revert the source** so GitHub and production agree again:

```bash
git revert <bad-commit-sha>     # or: git reset --hard <good-sha> on a branch, then PR
git push
```

**Rolling back a migration is different and dangerous.** Vercel rollback does not touch Supabase. A schema change that dropped/renamed a column can't be un-applied by promoting an old deployment — and a destructive down-migration can lose data. Write a **forward-fix** migration instead (re-add the column, etc.), save it as the next numbered `.sql`, and apply it via the Supabase MCP. If data may already be lost, **stop and get Luis** before running anything destructive.

**After any rollback, verify:** `curl -sI` the production URL (401 = protected/expected, 5xx = still broken) and load the affected route to confirm you're back on the good build.

### Deploy checklist (run top to bottom)

1. `npm run build` locally (with `npm_config_cache` set) — green?
2. Migration needed? Write the `.sql`, `apply_migration` via Supabase MCP, verify with `list_tables`.
3. Commit on a branch, push, open the PR via the web "Compare & pull request" URL (no `gh`), or merge to `main` directly — after the secret scan.
4. `vercel deploy --prod --yes` (CLI) or `deploy_to_vercel` (MCP).
5. Deploy `READY`? If `ERROR`, read `get_deployment_build_logs` for the first failure.
6. **Verify live:** `curl -sI` (401 = Deployment Protection, expected; 5xx = real failure) + open the changed route.
7. If broken: `vercel promote <last-good>` and `git revert`, then verify again.

---

## Secrets & Access

Strict scheme: **no secret value ever lives in this manual, in the repo, or in any committed file.** This is the map of *where* each credential lives and *how* to use it by reference. If you need a secret to do something, you reference its location — you never read, print, paste, or commit it.

### The one rule that overrides everything

**Never commit or push a secret.** Not in a source file, migration, doc, commit message, code comment, or a pasted log. Public-safe identifiers are fine. Anything that grants access is not. When in doubt, treat it as a secret.

### Where each credential lives (reference by location only)

| Credential | Lives in | Used by / for | May mention? |
|---|---|---|---|
| GitHub auth (push/pull) | **macOS Keychain** (git credential helper) | `git push` / `git pull` — works with no token typed | Never write the token. Repo URL is public-safe. |
| Supabase URL + anon key | `compass-app/.env.local` (gitignored) and **Vercel project env vars** | Browser + server Supabase clients (`NEXT_PUBLIC_*`) | URL + project ref are public-safe; the anon key is a value — don't paste it. |
| `SINGLE_USER_EMAIL` / `SINGLE_USER_PASSWORD` | `compass-app/.env.local` (server-only) and **Vercel project env vars** | `src/middleware.ts` silent auto-login (never `NEXT_PUBLIC_`, never sent to browser) | Never write the password. **`SINGLE_USER_PASSWORD` is the load-bearing auth secret.** |
| `SUPABASE_SERVICE_ROLE_KEY` (if/when used) | `compass-app/.env.local` and **Vercel project env vars** — server-only | Privileged server ops only; bypasses RLS | Never write it. Never expose client-side. |
| Privileged DB access | **Supabase MCP** (user-scoped, already authenticated) | Schema + data changes via `apply_migration` / `execute_sql` | Use the MCP tools; never extract or print a DB credential. |

**The actual auth credentials.** `src/middleware.ts` reads **`SINGLE_USER_EMAIL`** and **`SINGLE_USER_PASSWORD`** for the silent auto-login — those are the server-only vars the app depends on, and `SINGLE_USER_PASSWORD` is the one truly load-bearing secret. They must be set in **both** `.env.local` and Vercel project env vars, and **never** prefixed `NEXT_PUBLIC_`. Note: these are **not** present in `.env.local.example` (that file predates single-user mode — see below). Do not confuse them with `NEXT_PUBLIC_ALLOWED_EMAIL`, which is only read by the unused `/login` page (`src/app/login/page.tsx`) and is not the single-user credential.

Public-safe identifiers you *may* write in code, docs, and commits: the GitHub repo URL (`https://github.com/Luis-F-Queiroz/Compass_College_App`), the Supabase URL (`https://bubhsrgwaxolthihlqdd.supabase.co`) and project ref (`bubhsrgwaxolthihlqdd`), and the Vercel project (`compass-college-app`) / team (`luis-queiroz-s-projects`).

### The gitignored / outside-repo secrets boundary

Secrets stay **out of the repo by construction.** Verify before assuming:

```bash
cd "/Users/marcosrobertogomesdequeiroz/Documents/Claude CW College Apps/compass-app"
grep -E '\.env|\.vercel' .gitignore   # confirms .env* and .vercel are ignored
git ls-files | grep -i env            # should print NOTHING (no env file is tracked)
```

`compass-app/.gitignore` ignores `.env*` (all env files) and `.vercel`.

**Important: `.env.local.example` is NOT tracked by git.** Despite the `.example` suffix, it is caught by the same `.env*` ignore rule (`.gitignore:34:.env*`) — `git ls-files` does not list it, and `git check-ignore -v .env.local.example` confirms it is ignored. So there is currently **no committed reference** in version control for which env vars exist. Two consequences:

- **Do not rely on `.env.local.example` as the source of truth for required env vars.** It is also stale: it lists only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `NEXT_PUBLIC_ALLOWED_EMAIL` — it is **missing `SINGLE_USER_EMAIL` / `SINGLE_USER_PASSWORD`** (the vars the middleware actually reads) and still carries `NEXT_PUBLIC_ALLOWED_EMAIL`, which nothing outside the unused `/login` page reads. Following it as a checklist would leave auto-login broken (the §4 no-data failure). Use the canonical list in [Deploy Ops §5](#5-change-vercel-environment-variables) instead, or **grep `src/` for `process.env.`** to discover the real vars.
- **If you want a committed env-key reference**, don't just `git add .env.local.example` — the `.env*` rule will ignore it (and naively forcing it in risks normalizing `git add -f` on env files, defeating the boundary). Instead add an explicit negation to `.gitignore` (`!.env.local.example`), **verify the file contains placeholders only** (no real values), update it to match the middleware (`SINGLE_USER_EMAIL` / `SINGLE_USER_PASSWORD` in, stale `NEXT_PUBLIC_ALLOWED_EMAIL` out), and only then commit it.

- **Do NOT read or reproduce the contents of `.env.local`.** To learn which variables exist, use the canonical list in Deploy Ops §5 or grep `src/` for `process.env.` usage — never open `.env.local` to echo values.
- **Adding a new secret env var:** add the real value to `.env.local` locally **and** to the Vercel project env vars (so production has it). If you also keep a committed key reference, update it per the negation step above — placeholder only. Never let the value reach a commit.

### Before every commit / push — secret scan

A habit. Inspect what you're about to commit, not just what changed:

```bash
git diff --cached            # review staged changes for any key/password/token-looking value
git status                   # confirm no .env* or .vercel slipped into staging
```

If a secret was ever staged or committed, **stop** — do not push. Rotating the exposed credential and rewriting history is required; rotation of auth-sensitive credentials needs Luis's explicit approval.

### Security-sensitive actions need Luis's approval

These trigger an auto-mode permission prompt and must not be done silently:

- Disabling Vercel **Deployment Protection** (manual dashboard toggle Luis owns; not reliably doable via API).
- Mutating `auth.users` or anything touching the single-user login.
- Reading, moving, or rotating any secret value.

### Action item: rotate the GitHub token

The existing GitHub personal-access token in the macOS Keychain is **all-repo scope with no expiry** — too broad, never-expiring. It should be rotated to a fine-grained token scoped to **only** `Luis-F-Queiroz/Compass_College_App` with an expiry. Security-sensitive: surface it to Luis, let him create the replacement token and update the Keychain entry. Never paste the old or new token into chat, a file, or a commit.

---

## Making app changes (fields, nav, screens)

The UI is schema-driven, so most changes are small and localized.

- **Add or edit a field on an existing entity** → edit the entity's field-spec in `src/lib/specs.ts`. `EntityScreen.tsx` renders it automatically (table column + modal input + debounced auto-save). Add a migration (§Deploy Ops 4) **only if** the field is a genuinely new DB column; spec-only display changes need no migration. Do not add a `user_id` field — it's injected on insert by `useCollection` (Gotchas §4).
- **Add a nav entry / new screen** → this takes **three artifacts**, all keyed off the same identifier:
  1. Add the entity spec in `src/lib/specs.ts` under a `SPECS` key.
  2. Add the nav entry in `src/components/Sidebar.tsx` (its `href` segment must equal the spec key).
  3. **Create the route file** `src/app/(app)/<entity>/page.tsx` — without it the new nav link 404s. Every existing entity has one; copy the 4-line shape exactly:
     ```tsx
     import EntityScreen from "@/components/EntityScreen";
     export default function Page() {
       return <EntityScreen entity="<entity>" />;
     }
     ```
  The **SPECS key, the `entity` prop, the nav `href` segment, and (for new tables) the table name must all match**. A new entity backed by a new table also needs a migration that creates the table **with `user_id` + RLS policies** (`auth.uid() = user_id`) — without them the table is invisible to the app (Gotchas §4).
- **Raw inserts must set `user_id`.** The spec/EntityScreen path handles it automatically via `useCollection.create()`. Only raw SQL (Supabase MCP `execute_sql`) or new code that bypasses `useCollection` needs to set `user_id` itself. Empty reads or "vanishing" rows on those paths usually mean a missing `user_id` or an RLS gap, not a UI bug.
- **After any change:** build locally (Gotchas §1, §5), push on a branch, deploy, and verify on the live route (Gotchas §6). If the change pairs code with schema, remember they are two surfaces — apply the migration *and* redeploy.

---

## Counselor report workflow (CoWork-run)

The **Reports for Counselor** tab (`/counselor`) shows a short (≤200-word) doc-style update for Luis's
external college counselor, who reaches the site through the shared access code. **CoWork generates and
publishes these reports on a schedule; the website only displays them.**

**Where it lives**
- Table `public.counselor_reports` (migration `0006`): `title`, `period_label`, `meeting_at`, `summary`
  (the main "what I've been doing / since last meeting" body), `wins`, `whats_next`, `through_line`,
  `published_at` (defaults to `now()` → **auto-published on insert**), plus `user_id` + RLS.
- Page `src/app/(app)/counselor/page.tsx` renders the **latest** report (by `published_at`) as a doc with
  the optional sections + a Print/Save-PDF button, and lists past reports as an archive.

**Generation workflow (CoWork runs this)**
1. Read the source material: Luis's `activities` on the site (Supabase MCP `select * from activities where
   archived = false`) plus `WEEKLY-IMPACT-TRACKER.md` (recent wins) and `02-activity-spike-strategy.md` /
   `MEMORY.md` (the spike through-line). **Never invent facts** — if nothing new happened, say so plainly.
2. Write a **≤200-word** report whose audience is **the college counselor** (warm, concrete, no jargon),
   mapped to the fields:
   - `summary` — what Luis has been doing / progress since the last meeting (the core).
   - `wins` — recent wins & impact, numbers when real (omit if none).
   - `whats_next` — near-term plans / deadlines (omit if none).
   - `through_line` — one line tying it to the finance-and-entrepreneurship spike.
   - `period_label` — e.g. `"Since our last meeting · <date>"`; `meeting_at` — the meeting it preps for.
3. **Publish** by inserting one row (auto-publish). Set `user_id` explicitly — the MCP bypasses RLS:
   ```sql
   insert into public.counselor_reports
     (user_id, title, period_label, meeting_at, summary, wins, whats_next, through_line)
   select id, 'Update for my counselor', '<period>', <meeting_at-or-null>,
          '<summary>', '<wins-or-null>', '<whats_next-or-null>', '<through_line-or-null>'
   from auth.users where email = 'luisqueiroz236@gmail.com';
   ```
   Each run inserts a NEW row (the history is the archive). To fix the latest without adding a row,
   `update` the most recent row instead.
4. Report back to Luis: the period covered and a one-line summary of what was published.

**Schedule (CoWork sets up its own tasks)**
- **Weekly:** a recurring task that runs the generation workflow once a week to keep the report current.
- **Before each meeting:** whenever Luis says he has a counselor meeting at time *T*, schedule a one-off
  task at **T − 3 hours** that re-runs the workflow (with `meeting_at = T`) so the report is freshest right
  before they meet. Luis announces each meeting; CoWork creates that T−3h task. Use CoWork's scheduled-task /
  cron tooling for both — the weekly job runs indefinitely, the pre-meeting job is one-off per meeting.

**Guardrails:** ≤200 words; audience is the counselor (not Luis); auto-published (no draft step, per Luis's
choice); never invent activities or numbers; the report is a projection of real activity data — CoWork docs
and the site DB remain the source of truth.

## Populating Competitions & Summer Programs (CoWork)

The **Competitions** (`/competitions`) and **Summer Programs** (`/summer_programs`) tabs are
CoWork-populated from Luis's "Competitions & Programs Mapping" research. The tables start empty; insert
rows via the Supabase MCP and set `user_id` explicitly (the MCP bypasses RLS). Use `source = 'cowork'`
and a stable `source_ref` (e.g. `comp:obecon`, `program:yygs`) — a unique index on
`(user_id, source, source_ref)` means re-using a `source_ref` keeps it one row. **Map only into existing
columns; never invent data.**

- **competitions:** `name` (required), `start_date`, `registration_deadline`, `phases` (freeform
  schedule), `topic`, `difficulty`, `prestige`, `result`, `status`, `website_url`.
- **summer_programs:** `name` (required), `host`, `focus`, `term`, `application_start`, `deadline`,
  `status`, `difficulty`, `prestige`, `cost`, `financial_aid`, `eligibility`, `recommendation_reqs`,
  `website_url`, `portal_url`, `logo_url`, `special_notes`.

```sql
-- first population = plain inserts; to revise later, UPDATE the row by its source_ref (don't re-insert)
insert into public.competitions (user_id, source, source_ref, name, topic, start_date, prestige, status)
select id, 'cowork', 'comp:<slug>', '<name>', '<topic>', <date-or-null>, '<prestige>', '<status>'
from auth.users where email = 'luisqueiroz236@gmail.com';
```
`difficulty` ∈ Low / Medium / Medium-Hard / Hard · `prestige` ∈ Low / Mid / High / Super High ·
competition `status` ∈ Researching / Registered / In progress / Completed / Not pursuing · program
`status` ∈ Researching / Considering / Planning to apply / Applied / Accepted / Rejected / Waitlisted /
Enrolled / Completed / Withdrawn. Removal uses the standard archive model (set `archived = true`).

## College "Learn More" research (read-only on the site)

The per-college **Learn More** page (`/colleges/<id>`) is **display-only** — it cannot be edited on the
website. CoWork maintains the 22 research fields directly in the `colleges` table (Supabase MCP
`update` / `insert`). Rules:
- **Grades are letters (A+ … F), never numbers** — `overall_grade`, `academic_grade`, `location_grade`,
  `social_grade`, `value_grade`. The chips/boxes are built for letters; a number won't display.
- `target_status` is freeform (Target / Semi-target / Non-target, optionally annotated).
- `acceptance_rate` is a number, rendered as a percent. SAT fields (`sat_range`, `sat_median`) are text.
- Many colleges are still empty (their Learn More shows "—"). Fill the research (location, majors,
  pros/cons, grades, etc.) the same way. Map only into existing columns; never invent data.

## Backlog Cowork can pick up

Ready-to-build items using the existing schema-driven pattern (spec + nav + route file, plus migration only if a new column/table is involved):

- **UI for `scholarship_deadlines`** — add a spec in `src/lib/specs.ts`, a nav entry in `src/components/Sidebar.tsx`, and a route file `src/app/(app)/scholarship_deadlines/page.tsx` (or your chosen matching segment). Table already exists, so likely no migration.
- **Essay ↔ college linking** (`essay_colleges`) — a join/relationship UI between essays and colleges.
- **Attaching tasks to a college/essay** (`parent_type` / `parent_id`) — let a task point at a parent entity; add the columns via a migration if they don't yet exist, then surface them in the `tasks` spec.

---

## Files referenced in this manual

- `/Users/marcosrobertogomesdequeiroz/Documents/Claude CW College Apps/compass-app/package.json` — `dev` / `build` / `start` / `lint` scripts.
- `/Users/marcosrobertogomesdequeiroz/Documents/Claude CW College Apps/compass-app/.vercel/repo.json` — local project link (`compass-college-app`, team `luis-queiroz-s-projects`); git-ignored. This is the repo-linked form; there is no `.vercel/project.json` (the bundled `.vercel/README.txt` references one that isn't present — the link still works).
- `/Users/marcosrobertogomesdequeiroz/Documents/Claude CW College Apps/compass-app/supabase/migrations/0001_init.sql` — schema baseline + the comment/RLS convention new migrations must follow.
- `/Users/marcosrobertogomesdequeiroz/Documents/Claude CW College Apps/compass-app/src/middleware.ts` — silent auto-login reading `SINGLE_USER_EMAIL` / `SINGLE_USER_PASSWORD`.
- `/Users/marcosrobertogomesdequeiroz/Documents/Claude CW College Apps/compass-app/src/hooks/useCollection.ts` — generic per-table list/create/update/delete; `create()` injects `user_id`.
- `/Users/marcosrobertogomesdequeiroz/Documents/Claude CW College Apps/compass-app/src/lib/specs.ts` — entity field-specs (field add/edit lives here).
- `/Users/marcosrobertogomesdequeiroz/Documents/Claude CW College Apps/compass-app/src/components/EntityScreen.tsx` — generic table + animated modal + debounced auto-save.
- `/Users/marcosrobertogomesdequeiroz/Documents/Claude CW College Apps/compass-app/src/components/Sidebar.tsx` — navigation (new-screen changes live here).
- `/Users/marcosrobertogomesdequeiroz/Documents/Claude CW College Apps/compass-app/src/app/(app)/colleges/page.tsx` — reference shape for an entity route file (`<EntityScreen entity="colleges" />`).
- `/Users/marcosrobertogomesdequeiroz/Documents/Claude CW College Apps/compass-app/src/app/(app)/dashboard/page.tsx` — reference for the Framer Motion `Variants` annotation pattern.
- `/Users/marcosrobertogomesdequeiroz/Documents/Claude CW College Apps/compass-app/.env.local.example` — **NOT git-tracked** (caught by the `.env*` ignore rule) and **stale**: lists `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_ALLOWED_EMAIL`, but is missing `SINGLE_USER_EMAIL` / `SINGLE_USER_PASSWORD`. Not a reliable env-var reference — use Deploy Ops §5 or grep `src/` for `process.env.`.
- `/Users/marcosrobertogomesdequeiroz/Documents/Claude CW College Apps/compass-app/.env.local` — local secrets; reference by location only, never read or print.