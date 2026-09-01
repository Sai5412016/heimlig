// lib/memberNames.ts — turning a member reference into something displayable, in one place.
//
// Since accounts can be deleted (app/konto-loeschen.tsx), content can outlive the person who
// created it. Two shapes of that:
//
//   1. The member row is gone entirely. Tables without a foreign key to `members` —
//      household_messages, pantry_items, scan_history, rewards, settlements, household_notes —
//      keep the old id, so a lookup simply finds nothing.
//   2. The member row survives as an anonymised tombstone (`deleted_at` set, empty
//      display_name) because household content still references it. Those rows are filtered out
//      of the store, so from the UI's point of view this looks identical to case 1.
//
// Both resolve to "Ehemaliges Mitglied" / "Former member" rather than an empty string, a '?' or
// a crash on `display_name[0]`.
//
// What this is deliberately NOT for: distinguishing "nobody assigned" from "assignee deleted".
// A task with assigned_to = NULL means everyone, and a transaction with member_id = NULL means
// paid together — both are real states with their own labels, and call sites have to check the
// id for null *before* asking here.
import type { Member } from './supabase';

type Translate = (key: string, opts?: Record<string, unknown>) => string;

export function memberName(t: Translate, member: Member | null | undefined): string {
  const name = member?.display_name?.trim();
  return name ? name : t('common.formerMember');
}

export function memberNameById(t: Translate, members: Member[], id: string | null | undefined): string {
  return memberName(t, members.find(m => m.id === id));
}

// First letter for avatar bubbles. Same fallback, so a deleted member shows "E"/"F" instead of
// throwing on an empty string.
export function memberInitial(t: Translate, member: Member | null | undefined): string {
  return memberName(t, member).charAt(0).toUpperCase();
}
