-- Optional: run after 0001_init.sql to seed the same demo partners and
-- policy rules used in the interactive prototype, so the app isn't empty
-- on first login. Safe to skip or edit before running.

do $$
declare
  org_id uuid := '00000000-0000-0000-0000-000000000001';
  policy_version_id uuid;
  p_resale uuid;
  p_repair uuid;
  p_liquidator uuid;
  p_donation uuid;
  p_recycler uuid;
begin
  insert into policy_versions (organization_id, version_label, is_active)
  values (org_id, 'v1 - initial pilot rules', true)
  returning id into policy_version_id;

  insert into policy_rules (policy_version_id, organization_id, name, category, prohibited_outcomes, note)
  values
    (policy_version_id, org_id, 'No uncontrolled liquidation for capsule/collaboration SKUs', 'any', '["liquidation"]'::jsonb, 'Brand channel-protection policy for limited runs.'),
    (policy_version_id, org_id, 'De-branding required before donation', 'any', '[]'::jsonb, 'Remove labels/branding prior to any donation handoff.');

  insert into policy_rules (policy_version_id, organization_id, name, category, approval_below_recovery_pct, note)
  values (policy_version_id, org_id, 'No off-price for current-season dresses', 'dress', 35, 'Requires approval if recovery falls under 35% of cost basis.');

  insert into partners (organization_id, name, type, geography, min_volume_units, payout_pct, fee_pct, cost_per_unit_cents, lead_time_days, notes)
  values (org_id, 'Rehab Recommerce Co.', 'resale', 'US', 20, 0.55, 0.30, null, 12, 'Approved recommerce partner, no off-price channel exposure.')
  returning id into p_resale;
  insert into partner_capabilities (partner_id, category) values (p_resale, 'dress'), (p_resale, 'top'), (p_resale, 'outerwear');

  insert into partners (organization_id, name, type, geography, min_volume_units, payout_pct, fee_pct, cost_per_unit_cents, lead_time_days, notes)
  values (org_id, 'Second Seam Repair', 'repair', 'Northeast US', 10, 0, 0, 650, 9, 'Repairs, then goods return for resale routing.')
  returning id into p_repair;
  insert into partner_capabilities (partner_id, category) values (p_repair, 'dress'), (p_repair, 'denim'), (p_repair, 'outerwear');

  insert into partners (organization_id, name, type, geography, min_volume_units, payout_pct, fee_pct, lead_time_days, notes)
  values (org_id, 'Meridian Off-Price Group', 'liquidator', 'US', 100, 0.22, 0.12, 18, 'Bulk liquidation — brand-restricted for premium capsule SKUs.')
  returning id into p_liquidator;
  insert into partner_capabilities (partner_id, category) values (p_liquidator, 'dress'), (p_liquidator, 'top'), (p_liquidator, 'denim'), (p_liquidator, 'outerwear'), (p_liquidator, 'accessory');

  insert into partners (organization_id, name, type, geography, min_volume_units, payout_pct, fee_pct, lead_time_days, notes)
  values (org_id, 'Second Thread Donation Network', 'donation', 'US', 1, 0, 0, 14, 'Requires label/branding removal before intake; issues donation receipt.')
  returning id into p_donation;
  insert into partner_capabilities (partner_id, category) values (p_donation, 'dress'), (p_donation, 'top'), (p_donation, 'denim'), (p_donation, 'outerwear'), (p_donation, 'accessory');

  insert into partners (organization_id, name, type, geography, min_volume_units, payout_pct, fee_pct, lead_time_days, notes)
  values (org_id, 'Circulose Fiber Recovery', 'recycler', 'US', 200, 0.03, 0.05, 21, 'Pays nominal per-lb rate; certified fiber-to-fiber recycling.')
  returning id into p_recycler;
  insert into partner_capabilities (partner_id, category) values (p_recycler, 'denim'), (p_recycler, 'top');
end $$;
