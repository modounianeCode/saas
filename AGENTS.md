# Argent Clair — Agent Guide

## Project Overview
Personal finance web app (FCFA) built with **Next.js 15**, **React 19**, **TypeScript**, **Supabase** (PostgreSQL + Auth + RLS). PWA with offline-first architecture (IndexedDB + Service Worker).

## Commands
```bash
npm run dev        # Start dev server (port 3000)
npm run build      # Production build
npm start          # Run production server
npm run lint       # ESLint (flat config)
npm run typecheck  # tsc --noEmit
npm run audit      # npm audit on production dependencies
```

## Architecture

### Directory Structure
```
app/
  components/        # Client components (OfflineProvider, Dashboard, forms, lists)
  login/page.tsx     # Auth page (sign in / sign up / password reset)
  reset-password/    # New-password page (session issued by the email link)
  auth/callback/     # PKCE code exchange for email links (route handler)
  dashboard/         # Protected route, server component checks auth via getUser()
  layout.tsx         # Root layout, wraps everything in OfflineProvider
  error.tsx          # Route error boundary
lib/
  supabase.ts          # Browser Supabase client (createBrowserClient)
  supabaseServer.ts    # Server Supabase client (createServerClient + cookies)
  useAuth.ts           # Auth hook: session + cached offline fallback + signOut
  useTransactions.ts   # Transactions CRUD + offline queue + local cache
  useSavings.ts        # Savings goals CRUD + offline queue + local cache
  useOnline.ts         # navigator.onLine listener
  offlineSync.ts       # Outbox pattern: enqueueOp, syncNow, replay, error policy
  db.ts                # IndexedDB wrapper (KV + outbox stores)
  validation.ts        # Client-side validators (amount, email, password, name)
  types.ts             # Shared types (Transaction, SavingsGoal, categories)
middleware.ts          # Refreshes the Supabase session on every request
next.config.ts         # Security headers + sw.js cache policy
supabase/
  schema.sql            # Full schema for fresh installs
  migrations/           # Incremental migrations for existing DBs
public/
  sw.js                 # Service worker (static cache, per-URL pages, RSC payloads)
  offline.html          # Offline fallback page
```

### Key Patterns

**Server Components** (`app/dashboard/page.tsx`): Use `getUser()` from `supabaseServer.ts` to protect routes. Redirect to `/login` if no user. Do **not** add an `app/loading.tsx`: a root Suspense boundary turns server redirects into HTTP 200 + client-side redirects.

**Client Components** (`"use client"`): All hooks and UI components. Use `supabase()` browser client.

**Middleware** (`middleware.ts`): refreshes the session and rotates cookies on every request. Without it, `getUser()` fails after ~1 h (expired access token, valid refresh token) and users get logged out at random.

**Auth emails (PKCE)**: `@supabase/ssr` forces `flowType: "pkce"`. Every `emailRedirectTo` / `redirectTo` must point to `/auth/callback?next=...`, which exchanges the code for a session (`exchangeCodeForSession`). There is no implicit-flow hash handling.

**Outbox op types**: `insert_transaction`, `update_transaction`, `delete_transaction` (soft delete), `restore_transaction`, `insert_goal`, `adjust_goal`, `delete_goal`, `update_profile`. A new type requires a `replay()` case, otherwise it is dropped as a permanent error.

**Transaction history**: `TransactionList` filters by month (the Dashboard owns the `period` state so the Summary follows it), type and category, and paginates client-side (20 rows). Deletion is **soft** (`deleted_at`, migration 005) and reversible for 6 s via the undo toast; `restore()` clears the flag. `TransactionEditor` handles inline edits. All reads filter `deleted_at is null`.

**Offline-First Data Flow**:
1. Optimistic UI update → `updateLocal()` → cache to IndexedDB
2. Try network write → on success: `refresh()` from server
3. On failure: `enqueueOp(type, payload, userId)` → stored in IndexedDB outbox
4. `OfflineProvider` auto-syncs on `online`, on mount, and every 30 s while online
5. `syncNow()` replays the current user's outbox in order → removes synced ops
6. Dispatches `app:sync-done` → hooks refresh from server

**Outbox error policy** (`isTransientError`):
- network / 5xx / 408 / 429 → keep the operation and retry later (the loop stops, order is preserved)
- 4xx, SQLSTATE `22*`/`23*`/`42*`/`28*` → the operation can never succeed: log and drop it, then continue with the next one (a poison op must not block the queue)

**Outbox ownership**: each operation carries the `userId` that created it. `syncNow()` skips operations belonging to another account (shared device) and `outboxCount(userId)` only counts the current user's. Signing out purges caches and Cache Storage but **keeps** the queue (it is replayed when that user signs back in).

**Supabase RLS**: All tables (`profiles`, `transactions`, `savings_goals`, `applied_ops`) have policies or are restricted to `security definer` functions. Server and client clients use the same anon key; auth cookie handled by `@supabase/ssr`.

**Auth**: `useAuth` caches the session in IndexedDB (`session_user`) for offline reads. `onAuthStateChange` updates that cache. `signOut()` clears the cache, purges the user's IndexedDB entries and Cache Storage, then redirects.

**Pagination**: PostgREST caps `max-rows` at 1000 by default. `useTransactions` pages through results (`.range()`), otherwise totals are silently truncated.

**Dates**: always derive `today()` / `currentMonth()` from `lib/types.ts` (local timezone). `new Date().toISOString()` is UTC and returns the previous day/month at the boundary.

## Environment Variables
Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```
Copy from `.env.example` (not committed).

## Database Setup
1. Create a Supabase project
2. Run `supabase/schema.sql` in the SQL editor (fresh install **only**)
3. For an existing DB: run `supabase/check_state.sql` (read-only diagnostic), then migrations in order (`001_*` → `002_*` → `003_*` → `004_*` → `005_*`). Migrations are idempotent and safe to re-run after a partial failure.
4. Configure Auth redirect URLs: `http://localhost:3000/auth/callback` (dev), `https://<domain>/auth/callback` (prod)

> `42703: column "client_id" does not exist` means migration `003` was never applied (it adds the offline idempotency key). Run `003` before `004`.

## TypeScript
- Strict mode enabled
- Path alias `@/*` → `./*`
- `next-env.d.ts` and `.next/types/**` included
- CI runs `typecheck`, `lint`, `audit` and `build`

## PWA / Service Worker
- `public/sw.js`: cache-first for `/_next/static/*`; network-first for navigations and RSC payloads; per-URL page cache; `offline.html` as last resort; `/auth/*` is never cached
- Bump `VERSION` in `public/sw.js` when changing caching strategy (old caches are deleted on `activate`)
- Registered by `OfflineProvider` on mount; `/sw.js` is served with `no-store`
- Manifest at `app/manifest.ts`
- Authenticated HTML is cached on the device: `signOut()` clears Cache Storage

## Testing / Verification
No automated test suite. Manual verification steps:
1. `npm run dev` → open localhost:3000
2. Sign up → verify email → login (the email link must go through `/auth/callback`)
3. Add transactions (income/expense), verify dashboard totals
4. Filter the history by month/type/category, edit a transaction, delete one and press “Annuler”
5. Create savings goal, deposit/withdraw
6. Disconnect network → make changes (add, edit, delete, undo) → reconnect → verify sync banner appears and data persists
7. Sign up as a second user → check that the first user's queued operations are not replayed
8. Reset password → link opens `/reset-password` → set a new password

## Common Gotchas
- **Amounts stored as bigint (FCFA integers)** — validation enforces positive integers
- **Local IDs** are client UUIDs (`client_id`) until the server confirms; deletions go through `client_id`
- **Outbox operations** must match `replay()` switch cases exactly
- **Outbox operations must be enqueued with `userId`** — never replay them with another session
- **Server Components** cannot use browser-only hooks (`useAuth`, `useOnline`, etc.)
- **Cookies** for SSR auth handled by `@supabase/ssr` via `cookies()` in `supabaseServer.ts`
- **Service Worker** only caches same-origin GET requests
- **Redirects** must keep `?code=` intact (`/auth/callback` handles it)

## Deployment
```bash
npm run build
npm start
```
Deploy to Vercel/Netlify. Set the env vars in the platform, add `/auth/callback` to the Supabase Auth redirect URLs, and apply migration `004`.
