-- sql/premium_expiry_stale_birkensteig.sql
-- NICHT AUSGEFÜHRT. Nur zur Diagnose — enthält bewusst KEIN UPDATE/keine Korrektur.
--
-- Gemessen am 08.09.2026 (Branch claude/abo-ablauf, Aufgabe "Premium laeuft ab"):
-- Genau ein Haushalt hat eine purchases-Zeile mit abgelaufenem expires_at, aber weiterhin
-- status='active' und households.plan_tier='premium':
--
--   household: "Birkensteig" (household_id 93da107c-f64f-47cb-af28-bc12955e67e9)
--   purchase_id: 82020122-9583-415c-8398-5da994d44bdc
--   expires_at: 2026-08-19 10:25:06 UTC  (~3 Wochen in der Vergangenheit)
--
-- Diese eine Zeile ist die letzte bekannte Google-Antwort von der ursprünglichen
-- Kaufverifizierung — nicht mehr, seitdem gab es keinen erneuten Aufruf (das war ja genau die
-- Lücke, die dieser Task schließt). Ein abgelaufenes expires_at heisst NICHT zwangsläufig
-- "Abo ist jetzt inaktiv" — es könnte seitdem stillschweigend bei Google verlängert worden
-- sein und wir haben es nur nie wieder abgefragt. Ohne eine echte, aktuelle Antwort von Google
-- wissen wir es schlicht nicht.
--
-- Deshalb KEIN "update households set plan_tier = 'free' ..." in dieser Datei: das würde exakt
-- gegen die in diesem Task explizit geforderte Regel verstossen ("nur herabstufen, wenn Google
-- eindeutig geantwortet hat"), nur eben händisch statt über den Code-Pfad. Eine geratene
-- Herabstufung könnte einen zahlenden Nutzer aussperren — genau der Fehler, den die Aufgabe
-- vermeiden soll.
--
-- Was diese eine Zeile stattdessen wirklich braucht: eine echte Re-Verifizierung des
-- gespeicherten purchase_token gegen die Play Developer API (derselbe Aufruf, den
-- verify-purchase server-seitig ohnehin macht). Das ist kein SQL-Vorgang und wird hier bewusst
-- NICHT ausgeführt — das würde den echten Premium-Status eines echten Haushalts ändern, was
-- ausserhalb dessen liegt, was diese Aufgabe verlangt hat.
--
-- Zwei Wege, wie sich das von selbst oder gezielt klärt, ohne dass hier SQL laufen muss:
--   1. Von selbst: Öffnet ein Mitglied von "Birkensteig" die App, läuft ohnehin bereits
--      restorePurchases() (app/_layout.tsx, unverändert seit vor diesem Task, bei jedem
--      Start). Liefert Google Play das Abo dabei noch über getAvailablePurchases() zurück
--      (z. B. weil es tatsächlich verlängert wurde oder noch in der Kulanzfrist ist), wird es
--      automatisch neu verifiziert — verify-purchase schreibt dann die aktuelle Wahrheit.
--   2. Gezielt: Der gespeicherte purchase_token dieser einen Zeile könnte manuell einmalig
--      gegen die Play Developer API geprüft werden (z. B. per direktem Aufruf von
--      verify-purchase mit diesem Token). Das ist ein bewusster, einzelner Eingriff auf einen
--      echten Zahlungsstatus und wird hier nicht ungefragt ausgeführt.
--
-- ─── Nur zur Kontrolle (read-only) ─────────────────────────────────────────────────────────
select p.id as purchase_id, p.household_id, h.name as household_name,
       p.status, p.expires_at, h.plan_tier,
       (p.expires_at < now()) as expires_at_in_vergangenheit
from public.purchases p
join public.households h on h.id = p.household_id
where p.expires_at is not null and p.expires_at < now()
order by p.expires_at desc;
