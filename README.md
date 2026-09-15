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

RLS policies check `organization_members` against `auth.uid()`, so you need
at least one real Supabase Auth user mapped into that org before the app can
read or write anything:

```sql
insert into organization_members (organization_id, user_id, role)
values ('00000000-0000-0000-0000-000000000001', '<your-auth-user-id>', 'brand_admin');
```

Get `<your-auth-user-id>` from **Authentication → Users** after you sign up
once through Supabase Auth (magic link or email/password — wiring an actual
sign-in page is the next piece to build; for now you can create a user
directly in the dashboard and use the Supabase JS client's
`signInWithPassword` from a quick script or the browser console to get a
session cookie while you're the only user testing this).

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

**Still manual / not yet built:**
- A real sign-in page (magic link via Supabase Auth is the fastest path)
- An "active org" switcher — every page currently hardcodes the seeded
  org ID; fine for a single-brand pilot, not for multiple design partners
- Partner and policy-rule creation forms (the pages read live data, but
  adding new rows means using the Supabase table editor or SQL for now)
- CSV lot intake (currently one lot at a time via the form)
- Background jobs (Trigger.dev/Inngest) for reminders and scheduled syncs
- Temporal for the multi-day approval → pickup → reconciliation workflow,
  once a live pilot shows you actually need durable retries across days
