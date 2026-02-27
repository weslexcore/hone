# Shared API Key + Supabase Auth Implementation Plan

## Overview

Add server-side API keys (Anthropic, OpenAI, Ollama) via Vercel environment variables, Supabase authentication (magic link email), and per-user usage tracking with daily + monthly limits. This lets non-technical friends use the app without managing their own API keys, while preventing abuse.

## Architecture

```
User (no API key) → authenticates via magic link → API route checks usage limits
  → uses server-side env var key → logs usage to Supabase → returns response

User (own API key) → API route uses their key directly → no auth or limits needed
```

## Environment Variables

```env
# Server-side AI keys (set in Vercel dashboard)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
OLLAMA_BASE_URL=https://ollama.com    # optional, for hosted Ollama
OLLAMA_API_KEY=...                     # optional, for Ollama cloud

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Usage limits (configurable)
DAILY_REQUEST_LIMIT=30
MONTHLY_REQUEST_LIMIT=500
```

## Supabase Setup

### Table: `usage_logs`

```sql
create table usage_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  provider text not null,           -- 'anthropic' | 'openai' | 'ollama'
  model text not null,
  created_at timestamptz default now() not null
);

-- Indexes for fast limit checks
create index idx_usage_logs_user_daily
  on usage_logs (user_id, created_at desc);

-- RLS: users can only read their own usage
alter table usage_logs enable row level security;

create policy "Users read own usage"
  on usage_logs for select
  using (auth.uid() = user_id);

-- Insert via service role only (API routes insert server-side)
-- No insert policy for anon/authenticated - inserts go through API routes
```

### Helper SQL function (for fast limit checks)

```sql
create or replace function get_usage_counts(p_user_id uuid)
returns table(daily_count bigint, monthly_count bigint)
language sql stable
as $$
  select
    count(*) filter (where created_at > now() - interval '1 day') as daily_count,
    count(*) filter (where created_at > date_trunc('month', now())) as monthly_count
  from usage_logs
  where user_id = p_user_id;
$$;
```

## Implementation Steps

### Phase 1: Supabase Client Setup

**New files:**
- `src/lib/supabase/client.ts` — Browser Supabase client (uses `NEXT_PUBLIC_*` vars)
- `src/lib/supabase/server.ts` — Server-side Supabase client (for API routes)
- `.env.example` — Document all env vars

**Install:**
- `@supabase/supabase-js` and `@supabase/ssr`

### Phase 2: Authentication

**New files:**
- `src/app/(auth)/login/page.tsx` — Login page with magic link email form
- `src/app/(auth)/layout.tsx` — Minimal auth layout (no sidebar)
- `src/app/auth/confirm/route.ts` — Email confirmation callback handler
- `src/providers/auth-provider.tsx` — React context providing `{ user, session, signOut, isLoading }`

**Modified files:**
- `src/providers/app-provider.tsx` — Wrap with AuthProvider
- `src/app/(app)/layout.tsx` — Check auth state, but **don't force login** (users with own keys can use the app without auth)
- `src/components/layout/header.tsx` — Add user avatar / sign-in link

### Phase 3: Server-Side API Key + Usage Limits

**New files:**
- `src/lib/usage/check-limits.ts` — Server-side helper:
  - `checkAndLogUsage(userId, provider, model)` → calls `get_usage_counts()` RPC, checks against env var limits, inserts log row if allowed
  - Returns `{ allowed: true }` or `{ allowed: false, reason: string, daily: number, monthly: number }`

**Modified files:**
- `src/app/api/ai/anthropic/route.ts` — Add server-key fallback logic:
  ```
  1. Parse request body
  2. If apiKey provided → use user's key (no auth/limits needed)
  3. If no apiKey → check for auth token in request headers
     → verify with Supabase → check usage limits → use ANTHROPIC_API_KEY env var
     → log usage after successful response
  4. If no apiKey and no auth → return 401
  ```
- `src/app/api/ai/openai/route.ts` — Same pattern as Anthropic
- `src/app/api/ai/ollama/route.ts` — Same pattern, using OLLAMA_BASE_URL + OLLAMA_API_KEY env vars

### Phase 4: Client-Side Changes

**Modified files:**
- `src/lib/ai/client.ts` (`sendAIRequest`):
  - When using shared key mode (no user API key), send the Supabase access token in an `Authorization` header instead of an `apiKey` in the body
  - Add a `useSharedKey` flag or detect when `apiKey` is empty

- `src/providers/ai-provider.tsx`:
  - Update `hasKey()` to also return true when user is authenticated (shared key available)
  - Update `sendRequest()` to pass auth token when using shared key mode
  - Add `isUsingSharedKey` state to context

- `src/lib/storage/api-keys.ts`:
  - Add `hasServerKey()` — client-side check (hits a lightweight `/api/ai/status` endpoint that returns which server-side keys are configured)

**New files:**
- `src/app/api/ai/status/route.ts` — Returns `{ anthropic: boolean, openai: boolean, ollama: boolean }` indicating which server-side keys are configured (no secrets exposed)

### Phase 5: Settings & Usage UI

**Modified files:**
- `src/app/(app)/settings/page.tsx`:
  - Add "Shared Access" section showing:
    - Sign-in status
    - Which shared providers are available
    - Usage stats (today: X/30, this month: Y/500)
    - "Sign in to use shared AI" button if not authenticated
  - Update the "No API key? No problem" card to mention the shared key option

**New files:**
- `src/app/api/ai/usage/route.ts` — Returns current user's usage counts (requires auth)
- `src/hooks/use-usage.ts` — Client-side hook to fetch and cache usage data

## File Summary

### New files (10)
1. `src/lib/supabase/client.ts`
2. `src/lib/supabase/server.ts`
3. `src/providers/auth-provider.tsx`
4. `src/app/(auth)/login/page.tsx`
5. `src/app/(auth)/layout.tsx`
6. `src/app/auth/confirm/route.ts`
7. `src/lib/usage/check-limits.ts`
8. `src/app/api/ai/status/route.ts`
9. `src/app/api/ai/usage/route.ts`
10. `.env.example`

### Modified files (8)
1. `src/app/api/ai/anthropic/route.ts`
2. `src/app/api/ai/openai/route.ts`
3. `src/app/api/ai/ollama/route.ts`
4. `src/lib/ai/client.ts`
5. `src/providers/ai-provider.tsx`
6. `src/providers/app-provider.tsx`
7. `src/app/(app)/settings/page.tsx`
8. `src/components/layout/header.tsx`

### Key Design Decisions

1. **Auth is optional**: Users who bring their own API keys never need to sign in. Auth is only required for shared-key access.

2. **No middleware-based auth**: We check auth in API routes only when the shared key is being used, keeping the app fast and simple.

3. **Usage tracking is server-side only**: The Supabase `usage_logs` table is written to by API routes (using the anon key with RLS). Users can read their own usage via the `/api/ai/usage` endpoint.

4. **Limits are env-var configurable**: `DAILY_REQUEST_LIMIT` and `MONTHLY_REQUEST_LIMIT` can be adjusted without code changes.

5. **Provider detection endpoint**: `/api/ai/status` lets the client know which shared providers are available, so the UI can adapt.
