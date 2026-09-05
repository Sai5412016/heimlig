-- sql/paywall_source_widen.sql — widen paywall_events.source so the whole paywall can be
-- measured, not just the AI-quota wall.
--
-- NOT APPLIED BY CLAUDE. Andi runs this. The app change that emits the new values ships in the
-- same build; until this runs, those inserts are rejected by the CHECK below and now surface as
-- a console warning instead of vanishing (see lib/paywallEvents.ts, which from this build on
-- checks the returned { error } like lib/inviteFunnel.ts and lib/reviewEvents.ts already do).
--
-- Background: paywall_events already HAS a source column (text, not null). The problem was
-- never a missing column — it was that paywall_events_source_check only allowed the three AI
-- features, so every entry into PremiumModal that did not come from the quota wall could not be
-- recorded at all. Four of the five ways into the upgrade screen were therefore invisible.

alter table public.paywall_events
  drop constraint if exists paywall_events_source_check;

alter table public.paywall_events
  add constraint paywall_events_source_check check (source in (
    -- The three AI features. Still emitted by components/AiQuotaWallModal.tsx, which keeps its
    -- per-feature source on purpose: "which feature ran out" is more useful than a single
    -- 'ai_quota' bucket, and analytics.v_paywall_conversion already groups by it.
    'recipe_import',
    'receipt_scan',
    'event_photo',
    -- Entries into PremiumModal, new in this build.
    'csv_export',         -- budget tab, export blocked for a free household
    'plan_row',           -- household tab, tap on "Plan: Free ✨ Upgrade"
    'quota_wall_button',  -- "Premium ansehen" inside the AI quota wall
    -- Reserved: PremiumModal opened for the AI quota by some route other than the wall button.
    -- Nothing emits it today — kept in the constraint so adding that route later needs a code
    -- change and not a second migration.
    'ai_quota'
  ));

-- analytics.v_paywall_conversion needs no change: it groups by source without a filter, so the
-- new values appear on their own. Worth knowing when reading it afterwards: rows from
-- AiQuotaWallModal and rows from PremiumModal now sit in the same table at two different
-- depths of the same funnel. A wall_shown with source 'quota_wall_button' is a PremiumModal
-- opening that was preceded by a wall_shown with source 'recipe_import' (or receipt_scan /
-- event_photo) — do not add those up as if they were separate people.
