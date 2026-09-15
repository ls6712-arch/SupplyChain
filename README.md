# Manifest — Disposition OS (pilot codebase)

Next.js 14 + Supabase (Postgres, Auth, RLS) + Drizzle. This is the real,
deployable version of the workflow you tested in the interactive prototype —
same three-gate rules engine (`src/lib/rules-engine.ts`), same data model,
wired to your Supabase project at:

```
https://fayqjladqpexinykkuig.supabase.co
```

## 1. Get your keys

In the Supabase dashboard for this project:

- **Project Settings → API** → copy the `anon` `public` key
- **Project Settings → Database** → copy the connection string (use the
  "Transaction" pooler URI, port 6543, if you'll eventually deploy to Vercel;
  the direct 5432 URI is fine for running migrations from your laptop)

Copy `.env.local.example` to `.env.local` and fill in those two values (the
URL is already in there). Never commit `.env.local` or paste the
`service_role` key into anything that ships to the browser.

```bash
cp .env.local.example .env.local
```

## 2. Create the schema

Easiest path — paste the SQL directly into the Supabase SQL editor, in order:

1. `supabase/migrations/0001_init.sql` — tables, enums, and Row Level Security
2. `supabase/migrations/0002_seed_partners_and_rules.sql` — optional demo
   partners/policy rules so the app isn't empty on first load

Or, if you have the Supabase CLI installed and linked to this project:

```bash
supabase db push
```

Either way, `0001_init.sql` also seeds one organization ("Aldergate & Fen")
and one facility so there's somewhere for a lot to point. Grab the seeded
facility's `id` (`select id from facilities;`) and drop it into
`src/app/lots/new/page.tsx` where it currently says
`REPLACE_WITH_YOUR_SEEDED_FACILITY_ID`.

## 3. Auth

Sign-in is magic-link (email a one-time link, no passwords). There's a real
`/login` page now, wired to Supabase Auth. Two things to set up first:

**In the Supabase dashboard**, under **Authentication → URL Configuration**:
- **Site URL**: `http://localhost:3000` while developing locally (change to
  your real deployed URL later, and add that URL here too)
- **Redirect URLs**: add `http://localhost:3000/auth/callback` (and your
  production `.../auth/callback` once deployed)

Email sending works out of the box in Supabase's free tier for testing
(rate-limited), so you don't need to configure a separate email provider to
try this locally.

**Then, add yourself to the seeded organization.** RLS checks
`organization_members` against `auth.uid()`, so a signed-in user with no
membership row will see empty pages everywhere (that's RLS working
correctly, not a bug). Sign in once through `/login` first (so the user
exists), then in the Supabase SQL editor:

```sql
-- find your user id
select id, email from auth.users;

-- add yourself to the seeded org
insert into organization_members (organization_id, user_id, role)
values ('00000000-0000-0000-0000-000000000001', '<paste-your-user-id>', 'brand_admin');
```

Refresh the app — the dashboard should now load real data. Every other page
under the sidebar nav (`src/app/(app)/...`) is guarded by
`src/app/(app)/layout.tsx`, which redirects to `/login` if there's no
session; `/login` and `/auth/callback` sit outside that guard so they render
without the sidebar.

## 4. Install and run

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`. You should see the dashboard with zero lots.
Go to **Lots → + New lot**, run a recommendation, approve it, execute it,
reconcile it — same flow as the prototype, now backed by real Postgres rows
and an append-only audit log per lot.

## What's real vs. what's next

**Already wired:**
- Full schema with tenant isolation enforced by RLS (not just app-layer
  filtering) — see the policies at the bottom of `0001_init.sql`
- The rules engine as a pure, unit-testable TypeScript module
- Server actions for the whole lot lifecycle, each one writing to the
  audit log
- Recommendations are immutable once created — approving records a
  separate `approvals` row rather than mutating the recommendation
- Magic-link sign-in (`/login`), a session-refreshing middleware, and a
  route guard on every workspace page (`src/app/(app)/layout.tsx`)

**Still manual / not yet built:**
- An "active org" switcher — every page currently hardcodes the seeded
  org ID; fine for a single-brand pilot, not for multiple design partners
- Partner and policy-rule creation forms (the pages read live data, but
  adding new rows means using the Supabase table editor or SQL for now)
- CSV lot intake (currently one lot at a time via the form)
- Background jobs (Trigger.dev/Inngest) for reminders and scheduled syncs
- Temporal for the multi-day approval → pickup → reconciliation workflow,
  once a live pilot shows you actually need durable retries across days
