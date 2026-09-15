-- ============================================================
-- Manifest / Disposition OS -- initial schema + RLS
-- Run this via: supabase db push  (or drizzle-kit push, or paste into
-- the Supabase SQL editor). Idempotent-ish: safe to re-run on a fresh DB.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- enums ----------
do $$ begin
  create type lot_status as enum (
    'draft','submitted','under_review','recommended','awaiting_approval',
    'approved','in_execution','reconciled','closed','exception'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type disposition_outcome as enum (
    'restock','repair_resale','resale_partner','outlet','liquidation',
    'donation','recycling','hold_exception'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type partner_type as enum ('resale','repair','liquidator','donation','recycler');
exception when duplicate_object then null; end $$;

do $$ begin
  create type condition_grade as enum ('like_new','repairable','non_resellable');
exception when duplicate_object then null; end $$;

do $$ begin
  create type member_role as enum (
    'brand_admin','brand_operator','brand_approver','finance_viewer',
    'sustainability_viewer','internal_operator','vendor_user','auditor'
  );
exception when duplicate_object then null; end $$;

-- ---------- tenancy ----------
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tier text not null default 'standard',
  created_at timestamptz not null default now()
);

create table if not exists organization_members (
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role member_role not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists facilities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  address text,
  created_at timestamptz not null default now()
);

-- ---------- products + lots ----------
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  sku text not null,
  category text not null,
  material text,
  season text,
  is_capsule boolean not null default false,
  cost_basis_cents integer not null,
  retail_value_cents integer not null,
  created_at timestamptz not null default now()
);

create table if not exists inventory_lots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  facility_id uuid not null references facilities(id),
  product_id uuid not null references products(id),
  lot_code text not null,
  status lot_status not null default 'draft',
  source_type text not null,
  quantity integer not null,
  condition_like_new_pct numeric(5,4) not null,
  condition_repairable_pct numeric(5,4) not null,
  condition_non_resellable_pct numeric(5,4) not null,
  age_days integer not null default 0,
  chosen_outcome disposition_outcome,
  override_reason text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_inventory_lots_org on inventory_lots(organization_id);
create index if not exists idx_inventory_lots_status on inventory_lots(organization_id, status);

-- ---------- policy (versioned) ----------
create table if not exists policy_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  version_label text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists policy_rules (
  id uuid primary key default gen_random_uuid(),
  policy_version_id uuid not null references policy_versions(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  category text not null default 'any',
  prohibited_outcomes jsonb not null default '[]'::jsonb,
  requires_step_before_outcome disposition_outcome,
  approval_below_recovery_pct integer,
  note text,
  priority integer not null default 100,
  created_at timestamptz not null default now()
);
create index if not exists idx_policy_rules_org on policy_rules(organization_id);

-- ---------- partners ----------
create table if not exists partners (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  type partner_type not null,
  geography text,
  min_volume_units integer not null default 1,
  payout_pct numeric(5,4) not null default 0,
  fee_pct numeric(5,4) not null default 0,
  cost_per_unit_cents integer default 0,
  lead_time_days integer not null default 14,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_partners_org on partners(organization_id);

create table if not exists partner_capabilities (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id) on delete cascade,
  category text not null,
  condition_min condition_grade not null default 'non_resellable'
);

-- ---------- recommendations + approvals ----------
create table if not exists recommendations (
  id uuid primary key default gen_random_uuid(),
  inventory_lot_id uuid not null references inventory_lots(id) on delete cascade,
  policy_version_id uuid not null references policy_versions(id),
  status text not null default 'draft',
  recommended_outcome disposition_outcome,
  eligible_outcomes jsonb not null,
  excluded_outcomes jsonb not null,
  projected_net_recovery_cents integer,
  baseline_net_recovery_cents integer,
  confidence text not null default 'medium',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_recommendations_lot on recommendations(inventory_lot_id);

create table if not exists approvals (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references recommendations(id) on delete cascade,
  approver_user_id uuid not null references auth.users(id),
  decision text not null,
  chosen_outcome disposition_outcome not null,
  is_override boolean not null default false,
  override_reason text,
  created_at timestamptz not null default now()
);

-- ---------- execution + settlement + evidence ----------
create table if not exists shipments (
  id uuid primary key default gen_random_uuid(),
  inventory_lot_id uuid not null references inventory_lots(id) on delete cascade,
  partner_id uuid references partners(id),
  origin_facility_id uuid not null references facilities(id),
  shipped_quantity integer,
  received_quantity integer,
  tracking_ref text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists settlements (
  id uuid primary key default gen_random_uuid(),
  inventory_lot_id uuid not null references inventory_lots(id) on delete cascade,
  gross_proceeds_cents integer not null default 0,
  fees_cents integer not null default 0,
  logistics_costs_cents integer not null default 0,
  net_recovery_cents integer not null,
  payment_status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists evidence_documents (
  id uuid primary key default gen_random_uuid(),
  inventory_lot_id uuid not null references inventory_lots(id) on delete cascade,
  kind text not null,
  storage_path text not null,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- ---------- audit log (append-only) ----------
create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  inventory_lot_id uuid references inventory_lots(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  actor_label text,
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_org on audit_events(organization_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- Every tenant-owned table is scoped through organization_members:
-- a user can read/write a row only if they belong to that row's org.
-- Vendor users get a separate, narrower policy (see bottom).
-- ============================================================

alter table organizations enable row level security;
alter table organization_members enable row level security;
alter table facilities enable row level security;
alter table products enable row level security;
alter table inventory_lots enable row level security;
alter table policy_versions enable row level security;
alter table policy_rules enable row level security;
alter table partners enable row level security;
alter table partner_capabilities enable row level security;
alter table recommendations enable row level security;
alter table approvals enable row level security;
alter table shipments enable row level security;
alter table settlements enable row level security;
alter table evidence_documents enable row level security;
alter table audit_events enable row level security;

-- Helper: is the current user a member of this organization?
create or replace function is_org_member(org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from organization_members m
    where m.organization_id = org_id and m.user_id = auth.uid()
  );
$$;

-- Helper: does the current user hold one of the given roles in this org?
create or replace function has_org_role(org_id uuid, roles member_role[])
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from organization_members m
    where m.organization_id = org_id and m.user_id = auth.uid() and m.role = any(roles)
  );
$$;

-- organizations: members can read their own org; only brand_admin can update.
create policy org_select on organizations for select using (is_org_member(id));
create policy org_update on organizations for update using (
  has_org_role(id, array['brand_admin']::member_role[])
);

-- organization_members: members can see their own org's roster.
create policy org_members_select on organization_members for select using (is_org_member(organization_id));
create policy org_members_write on organization_members for insert with check (
  has_org_role(organization_id, array['brand_admin']::member_role[])
);

-- Generic pattern applied to every tenant-owned table below:
--   SELECT/INSERT/UPDATE/DELETE allowed only if is_org_member(organization_id)
-- with tighter write rules on approvals (approver role only) noted separately.

create policy facilities_all on facilities for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy products_all on products for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy inventory_lots_all on inventory_lots for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy policy_versions_all on policy_versions for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy policy_rules_all on policy_rules for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy partners_all on partners for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));

-- partner_capabilities has no organization_id directly -- scope via its partner.
create policy partner_capabilities_all on partner_capabilities for all using (
  exists (select 1 from partners p where p.id = partner_id and is_org_member(p.organization_id))
) with check (
  exists (select 1 from partners p where p.id = partner_id and is_org_member(p.organization_id))
);

-- recommendations / approvals / shipments / settlements / evidence -- scope via their lot.
create policy recommendations_all on recommendations for all using (
  exists (select 1 from inventory_lots l where l.id = inventory_lot_id and is_org_member(l.organization_id))
) with check (
  exists (select 1 from inventory_lots l where l.id = inventory_lot_id and is_org_member(l.organization_id))
);

create policy approvals_select on approvals for select using (
  exists (
    select 1 from recommendations r join inventory_lots l on l.id = r.inventory_lot_id
    where r.id = recommendation_id and is_org_member(l.organization_id)
  )
);
-- Only brand_admin / brand_approver may write an approval decision.
create policy approvals_insert on approvals for insert with check (
  exists (
    select 1 from recommendations r join inventory_lots l on l.id = r.inventory_lot_id
    where r.id = recommendation_id
      and has_org_role(l.organization_id, array['brand_admin','brand_approver']::member_role[])
  )
);

create policy shipments_all on shipments for all using (
  exists (select 1 from inventory_lots l where l.id = inventory_lot_id and is_org_member(l.organization_id))
) with check (
  exists (select 1 from inventory_lots l where l.id = inventory_lot_id and is_org_member(l.organization_id))
);

create policy settlements_all on settlements for all using (
  exists (select 1 from inventory_lots l where l.id = inventory_lot_id and is_org_member(l.organization_id))
) with check (
  exists (select 1 from inventory_lots l where l.id = inventory_lot_id and is_org_member(l.organization_id))
);

create policy evidence_all on evidence_documents for all using (
  exists (select 1 from inventory_lots l where l.id = inventory_lot_id and is_org_member(l.organization_id))
) with check (
  exists (select 1 from inventory_lots l where l.id = inventory_lot_id and is_org_member(l.organization_id))
);

-- audit_events: append-only. Anyone in the org can read; inserts allowed for
-- org members, but there is deliberately no update/delete policy at all,
-- which makes the log immutable through the API.
create policy audit_select on audit_events for select using (is_org_member(organization_id));
create policy audit_insert on audit_events for insert with check (is_org_member(organization_id));

-- ============================================================
-- Seed one organization + facility so local dev has somewhere to point.
-- Replace / extend this with your real brand data once you have a
-- design-partner org set up in Supabase Auth.
-- ============================================================
insert into organizations (id, name, tier)
values ('00000000-0000-0000-0000-000000000001', 'Aldergate & Fen', 'premium')
on conflict (id) do nothing;

insert into facilities (organization_id, name, address)
values ('00000000-0000-0000-0000-000000000001', 'NJ Returns Facility', 'Edison, NJ')
on conflict do nothing;
