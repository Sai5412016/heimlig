-- sql/push_tokens_birkensteig_waisen.sql
-- NICHT AUSGEFÜHRT. Andi führt das selbst aus.
--
-- Zwei Zeilen in push_tokens zeigen auf Mitglieder, deren Zeile in `members` nicht mehr
-- existiert — nicht einmal als Tombstone. Ursache strukturell: push_tokens hat einen
-- Fremdschlüssel auf households, aber KEINEN auf members, also bleibt ein Token liegen, wenn
-- die Mitgliedszeile verschwindet.
--
-- Beide Aufräumpfade löschen heute korrekt:
--   remove_membership_unchecked:  delete from push_tokens where member_id = v_m.id;
--   delete_my_account:            delete from public.push_tokens where member_id = v_member_id;
-- Diese zwei Zeilen stammen also aus einer Zeit davor oder aus einem händischen Eingriff.
--
-- Gemessen am 07.09.2026: 17 Tokens gesamt, davon genau diese 2 verwaist, 0 Tombstones.
-- Es ist KEIN systemisches Problem und betrifft nur den Haushalt "Birkensteig".
--
-- Die DeviceNotRegistered-Bereinigung aus notify-message (dieser PR) entfernt diese beiden
-- Zeilen NICHT: sie greift nur, wenn Expo ein Token ausdrücklich als abgemeldet meldet. Solange
-- Expo die Tokens für gültig hält, bleiben sie liegen. Deshalb dieser einmalige Eingriff.

-- ─── Vorher ansehen ────────────────────────────────────────────────────────────────────────
-- Erst prüfen, dass wirklich genau diese zwei Zeilen betroffen sind und beide verwaist sind.
-- Erwartet: 2 Zeilen, Haushalt "Birkensteig", mitglied_weg = true bei beiden.
select pt.member_id,
       h.name as household,
       pt.updated_at,
       (m.id is null) as mitglied_weg
from public.push_tokens pt
join public.households h on h.id = pt.household_id
left join public.members m on m.id = pt.member_id
where pt.member_id in (
  'd6ba9e55-7ba4-4332-b355-07f02997da21',
  '9944b544-2f81-413a-a8d7-e9ae9f6a17e4'
);

-- ─── Löschen ───────────────────────────────────────────────────────────────────────────────
-- Gegenüber der ursprünglich vorgeschlagenen Fassung um zwei Bedingungen ergänzt, entsprechend
-- der Repo-Regel "Produktionsdaten nur streng gescopt und mit Guard":
--   1. `and not exists (...)` — löscht nur, wenn die Mitgliedszeile tatsächlich weg ist. Sollte
--      eine der beiden IDs inzwischen wieder ein echtes Mitglied sein, passiert nichts, statt
--      jemandem stillschweigend die Benachrichtigungen abzudrehen.
--   2. `and household_id = (...)` — bindet den Eingriff an den Haushalt, um den es geht. Eine
--      vertippte UUID kann so keine fremde Zeile treffen.
-- Ohne die Guards wäre der Befehl zwar ebenfalls exakt (member_id ist Primärschlüssel), aber
-- nicht mehr überprüfbar richtig.
--
-- Erwartet: DELETE 2
delete from public.push_tokens pt
where pt.member_id in (
        'd6ba9e55-7ba4-4332-b355-07f02997da21',
        '9944b544-2f81-413a-a8d7-e9ae9f6a17e4'
      )
  and not exists (select 1 from public.members m where m.id = pt.member_id)
  and pt.household_id = (select id from public.households where name = 'Birkensteig');

-- ─── Nachher prüfen ────────────────────────────────────────────────────────────────────────
-- Erwartet: waisen = 0
select count(*) filter (where m.id is null) as waisen,
       count(*)                              as tokens_gesamt
from public.push_tokens pt
left join public.members m on m.id = pt.member_id;
