# Argent Clair — Agent Guide

## Project Overview
Personal finance web app (FCFA) built with **Next.js 15**, **React 19**, **TypeScript**, **Supabase** (PostgreSQL + Auth + RLS). PWA with offline-first architecture (IndexedDB + Service Worker).

## Commands
```bash
npm run dev      # Start dev server (port 3000)
npm run build    # Production build
npm start        # Run production server
npm run lint     # Run Next.js ESLint
```

## Architecture

### Directory Structure
```
app/
  components/     # Client components (OfflineProvider, Dashboard, forms, lists)
  login/page.tsx  # Auth page (sign in / sign up / password reset)
  dashboard/      # Protected route, server component checks auth via getUser()
  layout.tsx      # Root layout, wraps everything in OfflineProvider
lib/
  supabase.ts          # Browser Supabase client (createBrowserClient)
  supabaseServer.ts    # Server Supabase client (createServerClient + cookies)
  useAuth.ts           # Auth hook: session + cached offline fallback
  useTransactions.ts   # Transactions CRUD + offline queue + local cache
  useSavings.ts        # Savings goals CRUD + offline queue + local cache
  useOnline.ts         # navigator.onLine listener
  offlineSync.ts       # Outbox pattern: enqueueOp, syncNow, replay()
  db.ts                # IndexedDB wrapper (KV + outbox stores)
  validation.ts        # Client-side validators (amount, email, password, name)
  types.ts             # Shared types (Transaction, SavingsGoal, categories)
supabase/
  schema.sql            # Full schema for fresh installs
  migrations/           # Incremental migrations for existing DBs
```

### Key Patterns

**Server Components** (`app/dashboard/page.tsx`): Use `getUser()` from `supabaseServer.ts` to protect routes. Redirect to `/login` if no user.

**Client Components** (`"use client"`): All hooks and UI components. Use `supabase()` browser client.

**Offline-First Data Flow**:
1. Optimistic UI update → `updateLocal()` → cache to IndexedDB
2. Try network write → on success: `refresh()` from server
3. On failure: `enqueueOp(type, payload)` → stored in IndexedDB outbox
4. `OfflineProvider` auto-syncs on `online` event via `syncNow()`
5. `syncNow()` replays outbox in order via `replay()` → removes synced ops
6. Dispatches `app:sync-done` → hooks refresh from server

**Supabase RLS**: All tables (`profiles`, `transactions`, `savings_goals`) have policies `auth.uid() = user_id`. Server and client clients use same anon key; auth cookie handled by `@supabase/ssr`.

**Auth**: `useAuth` caches session in IndexedDB (`session_user`) for offline reads. `onAuthStateChange` updates cache.

## Environment Variables
Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```
Copy from `.env.example` (not committed).

## Database Setup
1. Create Supabase project
2. Run `supabase/schema.sql` in SQL editor (fresh install)
3. For existing DB: run migrations in order (`001_*`, `002_*`)
4. Configure Auth redirect URL: `http://localhost:3000` (dev), production URL (deploy)

## TypeScript
- Strict mode enabled
- Path alias `@/*` → `./*`
- `next-env.d.ts` and `.next/types/**` included

## PWA / Service Worker
- `public/sw.js` caches `/_next/static/*` (cache-first) and navigation (network-first with offline shell fallback)
- Registered by `OfflineProvider` on mount
- Manifest at `app/manifest.ts`

## Testing / Verification
No automated test suite. Manual verification steps:
1. `npm run dev` → open localhost:3000
2. Sign up → verify email → login
3. Add transactions (income/expense), verify dashboard totals
4. Create savings goal, deposit/withdraw
5. Disconnect network → make changes → reconnect → verify sync banner appears and data persists

## Common Gotchas
- **Amounts stored as bigint (FCFA integers)** — validation enforces positive integers
- **Local IDs** use `local-${Date.now()}` prefix until server confirms
- **Outbox operations** must match `replay()` switch cases exactly
- **Server Components** cannot use browser-only hooks (`useAuth`, `useOnline`, etc.)
- **Cookies** for SSR auth handled by `@supabase/ssr` via `cookies()` in `supabaseServer.ts`
- **Service Worker** only caches same-origin GET requests

## Deployment
```bash
npm run build
npm start
```
Deploy to Vercel/Netlify. Ensure env vars set in platform. Update Supabase Auth redirect URL to production domain.