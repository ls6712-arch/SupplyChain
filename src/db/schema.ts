import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
  primaryKey,
} from "drizzle-orm/pg-core";

/* ============================================================
   ENUMS
   ============================================================ */
export const lotStatusEnum = pgEnum("lot_status", [
  "draft",
  "submitted",
  "under_review",
  "recommended",
  "awaiting_approval",
  "approved",
  "in_execution",
  "reconciled",
  "closed",
  "exception",
]);

export const dispositionOutcomeEnum = pgEnum("disposition_outcome", [
  "restock",
  "repair_resale",
  "resale_partner",
  "outlet",
  "liquidation",
  "donation",
  "recycling",
  "hold_exception",
]);

export const partnerTypeEnum = pgEnum("partner_type", [
  "resale",
  "repair",
  "liquidator",
  "donation",
  "recycler",
]);

export const conditionEnum = pgEnum("condition_grade", [
  "like_new",
  "repairable",
  "non_resellable",
]);

export const memberRoleEnum = pgEnum("member_role", [
  "brand_admin",
  "brand_operator",
  "brand_approver",
  "finance_viewer",
  "sustainability_viewer",
  "internal_operator",
  "vendor_user",
  "auditor",
]);

/* ============================================================
   TENANCY
   ============================================================ */
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  tier: text("tier").notNull().default("standard"), // e.g. "premium" brand tier, used by policy gates
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Maps to auth.users via id (Supabase auth) -- no separate password/auth fields here.
export const organizationMembers = pgTable(
  "organization_members",
  {
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(), // references auth.users(id)
    role: memberRoleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.organizationId, t.userId] }),
  })
);

export const facilities = pgTable("facilities", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  address: text("address"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ============================================================
   PRODUCTS + INVENTORY LOTS
   ============================================================ */
export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  sku: text("sku").notNull(),
  category: text("category").notNull(), // dress, top, denim, outerwear, accessory ...
  material: text("material"),
  season: text("season"),
  isCapsule: boolean("is_capsule").notNull().default(false), // capsule/collaboration SKU flag
  costBasisCents: integer("cost_basis_cents").notNull(),
  retailValueCents: integer("retail_value_cents").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const inventoryLots = pgTable("inventory_lots", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  facilityId: uuid("facility_id").notNull().references(() => facilities.id),
  productId: uuid("product_id").notNull().references(() => products.id),
  lotCode: text("lot_code").notNull(), // human-readable, e.g. LOT-1001
  status: lotStatusEnum("status").notNull().default("draft"),
  sourceType: text("source_type").notNull(), // customer_return | aged_inventory | damaged | factory_waste
  quantity: integer("quantity").notNull(),
  // condition mix as fractions summing to ~1.0
  conditionLikeNewPct: numeric("condition_like_new_pct", { precision: 5, scale: 4 }).notNull(),
  conditionRepairablePct: numeric("condition_repairable_pct", { precision: 5, scale: 4 }).notNull(),
  conditionNonResellablePct: numeric("condition_non_resellable_pct", { precision: 5, scale: 4 }).notNull(),
  ageDays: integer("age_days").notNull().default(0),
  chosenOutcome: dispositionOutcomeEnum("chosen_outcome"),
  overrideReason: text("override_reason"),
  createdBy: uuid("created_by"), // auth.users(id)
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ============================================================
   POLICY (versioned -- never mutate a rule in place once used)
   ============================================================ */
export const policyVersions = pgTable("policy_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  versionLabel: text("version_label").notNull(), // e.g. "v3 - 2026-09-01"
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const policyRules = pgTable("policy_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  policyVersionId: uuid("policy_version_id").notNull().references(() => policyVersions.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull().default("any"), // "any" or a specific category
  prohibitedOutcomes: jsonb("prohibited_outcomes").$type<string[]>().notNull().default([]),
  requiresStepBeforeOutcome: dispositionOutcomeEnum("requires_step_before_outcome"),
  approvalBelowRecoveryPct: integer("approval_below_recovery_pct"), // e.g. 20 = requires approval if <20% of cost basis
  note: text("note"),
  priority: integer("priority").notNull().default(100),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ============================================================
   PARTNERS
   ============================================================ */
export const partners = pgTable("partners", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: partnerTypeEnum("type").notNull(),
  geography: text("geography"),
  minVolumeUnits: integer("min_volume_units").notNull().default(1),
  payoutPct: numeric("payout_pct", { precision: 5, scale: 4 }).notNull().default("0"),
  feePct: numeric("fee_pct", { precision: 5, scale: 4 }).notNull().default("0"),
  costPerUnitCents: integer("cost_per_unit_cents").default(0),
  leadTimeDays: integer("lead_time_days").notNull().default(14),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const partnerCapabilities = pgTable("partner_capabilities", {
  id: uuid("id").primaryKey().defaultRandom(),
  partnerId: uuid("partner_id").notNull().references(() => partners.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  conditionMin: conditionEnum("condition_min").notNull().default("non_resellable"),
});

/* ============================================================
   RECOMMENDATIONS + APPROVALS (immutable once submitted)
   ============================================================ */
export const recommendations = pgTable("recommendations", {
  id: uuid("id").primaryKey().defaultRandom(),
  inventoryLotId: uuid("inventory_lot_id").notNull().references(() => inventoryLots.id, { onDelete: "cascade" }),
  policyVersionId: uuid("policy_version_id").notNull().references(() => policyVersions.id),
  status: text("status").notNull().default("draft"), // draft | submitted | approved | rejected | superseded
  recommendedOutcome: dispositionOutcomeEnum("recommended_outcome"),
  eligibleOutcomes: jsonb("eligible_outcomes").$type<Record<string, unknown>[]>().notNull(),
  excludedOutcomes: jsonb("excluded_outcomes").$type<Record<string, unknown>[]>().notNull(),
  projectedNetRecoveryCents: integer("projected_net_recovery_cents"),
  baselineNetRecoveryCents: integer("baseline_net_recovery_cents"),
  confidence: text("confidence").notNull().default("medium"), // low | medium | high
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const approvals = pgTable("approvals", {
  id: uuid("id").primaryKey().defaultRandom(),
  recommendationId: uuid("recommendation_id").notNull().references(() => recommendations.id, { onDelete: "cascade" }),
  approverUserId: uuid("approver_user_id").notNull(),
  decision: text("decision").notNull(), // approved | rejected
  chosenOutcome: dispositionOutcomeEnum("chosen_outcome").notNull(),
  isOverride: boolean("is_override").notNull().default(false),
  overrideReason: text("override_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ============================================================
   EXECUTION + SETTLEMENT + EVIDENCE
   ============================================================ */
export const shipments = pgTable("shipments", {
  id: uuid("id").primaryKey().defaultRandom(),
  inventoryLotId: uuid("inventory_lot_id").notNull().references(() => inventoryLots.id, { onDelete: "cascade" }),
  partnerId: uuid("partner_id").references(() => partners.id),
  originFacilityId: uuid("origin_facility_id").notNull().references(() => facilities.id),
  shippedQuantity: integer("shipped_quantity"),
  receivedQuantity: integer("received_quantity"),
  trackingRef: text("tracking_ref"),
  status: text("status").notNull().default("pending"), // pending | shipped | received | discrepancy
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const settlements = pgTable("settlements", {
  id: uuid("id").primaryKey().defaultRandom(),
  inventoryLotId: uuid("inventory_lot_id").notNull().references(() => inventoryLots.id, { onDelete: "cascade" }),
  grossProceedsCents: integer("gross_proceeds_cents").notNull().default(0),
  feesCents: integer("fees_cents").notNull().default(0),
  logisticsCostsCents: integer("logistics_costs_cents").notNull().default(0),
  netRecoveryCents: integer("net_recovery_cents").notNull(),
  paymentStatus: text("payment_status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const evidenceDocuments = pgTable("evidence_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  inventoryLotId: uuid("inventory_lot_id").notNull().references(() => inventoryLots.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // certificate | receiving_confirmation | invoice | photo | treatment_statement
  storagePath: text("storage_path").notNull(), // path in Supabase Storage bucket
  uploadedBy: uuid("uploaded_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ============================================================
   AUDIT LOG (append-only, never edited)
   ============================================================ */
export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  inventoryLotId: uuid("inventory_lot_id").references(() => inventoryLots.id, { onDelete: "cascade" }),
  actorUserId: uuid("actor_user_id"),
  actorLabel: text("actor_label"), // "System" for automated rule-engine actions
  action: text("action").notNull(),
  detail: text("detail"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
