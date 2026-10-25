-- 03: Familjekontot får rollen skytte (2026-10-25)
-- Kontot skapas av Henrik i Supabase: Authentication → Users → Add user → Create new user,
-- e-post h.lundqvist+skytte@gmail.com, lösenord = familjekoden (sparas i lösenordshanteraren), Auto Confirm.
-- Kör sedan raden nedan (SQL Editor). Golfens konton påverkas inte och kan inte läsa skyttedata.
update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}') || '{"roll":"skytte"}'
  where email = 'h.lundqvist+skytte@gmail.com';
